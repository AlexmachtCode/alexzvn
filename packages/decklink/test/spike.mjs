// Sondierlauf an echter Hardware: Karten auflisten, Normen mit Urteil und Grund zeigen,
// eine Norm oeffnen und ein BEWEGTES Testbild senden.
//
// Warum bewegt: ein Standbild sieht auf dem Monitor gleich aus, ob 25 Bilder je Sekunde
// ankommen oder eines. Es beweist nur, dass irgendwann irgendein Bild durchging. Der
// Laufbalken unten wandert genau einen Schritt je Bild — faellt eines aus, springt er.
//
//   npm run spike -w @jm/decklink
//   npm run spike -w @jm/decklink -- --device 0 --mode Hp50 --seconds 30 --preroll 3
//
// Das Skript ist .mjs, importiert aber modes.ts — deshalb laeuft es ueber
// `node --experimental-strip-types` (siehe package.json). Ohne die Schalterangabe
// scheitert der Import mit ERR_UNKNOWN_FILE_EXTENSION.
import dl from '../index.cjs';
import { judgeModes } from '../src/modes.ts';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

/**
 * Zahlen-Argument lesen und pruefen. Ein unbrauchbarer Wert (z. B. "--seconds abc",
 * NaN) darf NICHT stillschweigend durchrutschen — sonst wird z. B. die
 * Abbruchbedingung `(Date.now()-started)/1000 >= seconds` nie wahr, und der Lauf
 * ist nur per Strg-C zu beenden. Klarer Satz statt Haenger.
 */
function numberArg(name, fallback, min) {
  const raw = arg(name, null);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) {
    console.error(`--${name} erwartet eine Zahl ab ${min}, bekommen: "${raw}"`);
    process.exit(1);
  }
  return n;
}

const wantDevice = numberArg('device', 0, 0);
const wantMode = arg('mode', null);
const seconds = numberArg('seconds', 15, 0.1);
const preroll = numberArg('preroll', 2, 1);

// Variablen, die außerhalb des try-Blocks von finish() oder dem SIGINT-Handler
// gebraucht werden, müssen hier deklariert sein.
let n = 0; // Versuche (jeder Interval-Tick)
let sent = 0; // tatsaechlich ANGENOMMEN — scheduleFrameBGRA() gab true zurueck
let FPS;
let timer;
let started;
let finished = false;

try {
  dl.init();

  const devices = dl.listDevices();
  if (devices.length === 0) {
    console.log('Keine Blackmagic-Karte gefunden. (Desktop Video installiert? Karte gesteckt?)');
    dl.destroy();
    process.exit(0);
  }

  console.log('Karten:');
  for (const d of devices) {
    console.log(`  [${d.index}] ${d.name}${d.hasOutput ? '' : '  (KEIN Ausgang)'}`);
  }

  const dev = devices.find((d) => d.index === wantDevice);
  if (!dev) {
    console.error(`Karte ${wantDevice} gibt es nicht.`);
    dl.destroy();
    process.exit(1);
  }
  if (!dev.hasOutput) {
    console.error(`Karte ${wantDevice} hat keinen Ausgang.`);
    dl.destroy();
    process.exit(1);
  }

  const judged = judgeModes(dl.listOutputModes(wantDevice));
  const GRUND = {
    interlaced: 'Halbbild',
    segmented: 'segmentiertes Vollbild (PsF)',
    resolution: 'Aufloesung koennen wir nicht komponieren',
    framerate: 'Bildrate bieten wir nicht an',
    pixelformat: 'Karte kann diese Norm nicht mit BGRA',
  };

  console.log(`\nNormen von "${dev.name}":`);
  for (const m of judged) {
    const mark = m.usable ? ' ok ' : '  - ';
    const why = m.usable ? '' : `   (${GRUND[m.reason]})`;
    console.log(
      `${mark}${m.mode}  ${m.name.padEnd(22)} ${m.width}x${m.height} @ ${(m.fpsN / m.fpsD).toFixed(2)}${why}`,
    );
  }

  const usable = judged.filter((m) => m.usable);
  // Zwei verschiedene Lagen bei --mode, zwei verschiedene Saetze: die Norm gibt es auf
  // dieser Karte gar nicht (Tippfehler wie "Zzzz"), oder es gibt sie, aber sie ist nicht
  // benutzbar (z. B. "Hi50" — Halbbild). `judged` (nicht nur `usable`) kennt den Unterschied
  // bereits, per Grund.
  let chosen;
  if (wantMode) {
    const found = judged.find((m) => m.mode === wantMode);
    if (!found) {
      console.error(`\nNorm ${wantMode} kennt diese Karte nicht.`);
      dl.destroy();
      process.exit(1);
    }
    if (!found.usable) {
      console.error(`\nNorm ${wantMode} ist nicht benutzbar (${GRUND[found.reason]}).`);
      dl.destroy();
      process.exit(1);
    }
    chosen = found;
  } else {
    chosen = usable[0];
    if (!chosen) {
      console.error('\nKeine benutzbare Norm gefunden.');
      dl.destroy();
      process.exit(1);
    }
  }

  const W = chosen.width;
  const H = chosen.height;
  FPS = Math.round(chosen.fpsN / chosen.fpsD);
  console.log(`\nOeffne ${chosen.name} (${W}x${H} @ ${FPS}), Vorlauf ${preroll} Bilder …`);

  // started VOR dem SIGINT-Handler setzen — sonst kann finish() bei einem sehr
  // fruehen Strg-C auf ein noch undefiniertes started treffen und "in NaN s" drucken.
  started = Date.now();
  // Zweite Zuweisung folgt unmittelbar vor setInterval: diese hier deckt nur ein sehr
  // fruehes Strg-C waehrend der Ruestzeit ab, die spaetere misst den eigentlichen Lauf.

  // SIGINT-Handler anmelden, BEVOR der Ausgang geoeffnet wird (Befund 3).
  process.on('SIGINT', () => {
    if (timer !== undefined) {
      clearInterval(timer);
    }
    if (!finished) {
      finished = true;
      finish();
    }
    process.exit(0);
  });

  dl.openOutput(wantDevice, chosen.mode, preroll);

  // Acht Farbbalken als Hintergrund (BGRA, also B,G,R,A je Bildpunkt).
  const BARS = [
    [255, 255, 255], [0, 255, 255], [255, 255, 0], [0, 255, 0],
    [255, 0, 255], [0, 0, 255], [255, 0, 0], [0, 0, 0],
  ];
  const frame = new Uint8Array(W * H * 4);
  const barW = Math.floor(W / 8);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = BARS[Math.min(7, Math.floor(x / barW))];
      const i = (y * W + x) * 4;
      frame[i] = c[0];
      frame[i + 1] = c[1];
      frame[i + 2] = c[2];
      frame[i + 3] = 255;
    }
  }
  const bars = frame.slice(); // unveraenderte Vorlage zum Zuruecksetzen

  const PULSE_H = Math.max(1, Math.floor(H * 0.05));
  const SWEEP_W = 8;
  const step = W / FPS; // eine volle Bahn je Sekunde

  // Jetzt beginnt der eigentliche Lauf. Ohne diese zweite Zuweisung enthielte `elapsed`
  // die Ruestzeit (Ausgang oeffnen, Farbbalken malen), und die erwartete Bildzahl laege
  // systematisch ueber der tatsaechlich gesendeten.
  started = Date.now();

  timer = setInterval(() => {
    try {
      // Hintergrund zuruecksetzen (nur die beiden bemalten Baender, nicht das ganze Bild).
      frame.set(bars.subarray(0, PULSE_H * W * 4), 0);
      const sweepTop = H - PULSE_H;
      frame.set(bars.subarray(sweepTop * W * 4), sweepTop * W * 4);

      // Pulsstreifen oben: wechselt im Sekundentakt. Gegen eine Stoppuhr gehalten zeigt er,
      // ob die Karte im richtigen Tempo laeuft.
      const on = Math.floor(n / FPS) % 2 === 0;
      const v = on ? 255 : 0;
      for (let y = 0; y < PULSE_H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          frame[i] = v;
          frame[i + 1] = v;
          frame[i + 2] = v;
        }
      }

      // Laufbalken unten: genau ein Schritt je Bild. DAS ist die eigentliche Messung —
      // faellt ein Bild aus, springt er sichtbar.
      const px = Math.floor((n * step) % W);
      for (let y = sweepTop; y < H; y++) {
        for (let dx = 0; dx < SWEEP_W; dx++) {
          const i = (y * W + ((px + dx) % W)) * 4;
          frame[i] = 255;
          frame[i + 1] = 255;
          frame[i + 2] = 255;
        }
      }

      if (dl.scheduleFrameBGRA(frame, W, H)) sent++;
      n++;

      if ((Date.now() - started) / 1000 >= seconds) {
        clearInterval(timer);
        if (!finished) {
          finished = true;
          finish();
        }
      }
    } catch (e) {
      console.error(e.message);
      clearInterval(timer);
      dl.closeOutput();
      dl.destroy();
      process.exit(1);
    }
  }, Math.round(1000 / FPS));

} catch (e) {
  console.error(e.message);
  dl.destroy();
  process.exit(1);
}

function finish() {
  const elapsed = (Date.now() - started) / 1000;
  const s = dl.stats();
  // n zaehlt VERSUCHE (jeden Interval-Tick), nicht Gesendetes — der Rueckgabewert von
  // scheduleFrameBGRA() wurde bislang ignoriert. Die erste Zeile darf fuer ein Werkzeug,
  // dessen einziger Zweck ehrliches Messen ist, nicht die optimistischere sein: "sent"
  // (tatsaechlich angenommen) steht deshalb gleichrangig direkt daneben, nicht "Gesendet"
  // fuer die blosse Versuchszahl.
  console.log(
    `\nVersucht: ${n} Bilder, angenommen ${sent} in ${elapsed.toFixed(2)} s ` +
      `(erwartet rund ${Math.round(FPS * elapsed)}).`,
  );
  console.log(
    `stats: eingereiht=${s.scheduled} vorlauf(wirksam)=${s.preroll} warteschlange=${s.queued} ` +
      `zu-spaet=${s.late} verworfen=${s.dropped} leergelaufen=${s.repeated} abgewiesen=${s.rejected} ` +
      `fehlgeschlagen=${s.failed}`,
  );
  if (s.late || s.dropped) {
    console.log('  → zu-spaet/verworfen kommen von der KARTE: der Vorlauf ist zu klein. --preroll erhoehen.');
  }
  if (s.repeated) {
    console.log(
      '  → leergelaufen kommt von UNS: der Zulieferer stockt oder die Takte driften. ' +
        'Wir schicken dabei KEIN Bild erneut — die KARTE haelt von sich aus ihr letztes Bild.',
    );
  }
  if (s.rejected) {
    console.log('  → abgewiesen kommt von UNS: wir liefern schneller, als die Karte abnimmt.');
  }
  if (s.failed) {
    console.log(
      '  → fehlgeschlagen kommt von der KARTE/Treiber und ist WEDER rejected NOCH late/dropped — ' +
        'z. B. eine im Betrieb gezogene Karte. Ernst nehmen.',
    );
  }
  if (!s.late && !s.dropped && !s.repeated && !s.rejected && !s.failed) {
    console.log('  → sauber, kein einziges Bild verloren.');
  }
  dl.closeOutput();
  dl.destroy();
}
