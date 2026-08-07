// Selbsttest der reinen Normen-Logik (Lane D2a). Braucht KEINE Karte und KEIN SDK.
//   npm run selftest -w @jm/decklink
import { judgeModes, modeToProgramSettings, type DisplayMode } from '../src/modes.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

/** Baut eine Norm, wie die Karte sie liefern wuerde. fpsN/fpsD = Zeitskala/Dauer. */
function mode(over: Partial<DisplayMode>): DisplayMode {
  return {
    mode: 'Hp25',
    name: '1080p25',
    width: 1920,
    height: 1080,
    fpsN: 25000,
    fpsD: 1000,
    interlaced: false,
    segmented: false,
    supportsBGRA: true,
    ...over,
  };
}

console.log('modes — Urteil je Norm:');
{
  const judged = judgeModes([
    mode({}), // 1080p25 — benutzbar
    mode({ mode: 'Hp50', name: '1080p50', fpsN: 50000 }), // benutzbar
    mode({ mode: 'hp50', name: '720p50', width: 1280, height: 720, fpsN: 50000 }), // benutzbar
    mode({ mode: 'Hi50', name: '1080i50', interlaced: true }), // Halbbild
    mode({ mode: 'Hp2f', name: '1080PsF25', segmented: true }), // segmentiert
    mode({ mode: '4k25', name: '2160p25', width: 3840, height: 2160 }), // Aufloesung
    mode({ mode: 'Hp23', name: '1080p23.98', fpsN: 24000, fpsD: 1001 }), // Bildrate
    mode({ mode: 'Hp30', name: '1080p30', fpsN: 30000, supportsBGRA: false }), // Pixelformat
  ]);
  const by = (m: string) => judged.find((j) => j.mode === m)!;

  assert(by('Hp25').usable && by('Hp25').reason === undefined, '1080p25 ist benutzbar, ohne Grund');
  assert(by('Hp50').usable, '1080p50 ist benutzbar');
  assert(by('hp50').usable, '720p50 ist benutzbar');
  assert(!by('Hi50').usable && by('Hi50').reason === 'interlaced', '1080i50: Grund interlaced');
  assert(!by('Hp2f').usable && by('Hp2f').reason === 'segmented', 'PsF: Grund segmented');
  assert(!by('4k25').usable && by('4k25').reason === 'resolution', '2160p25: Grund resolution');
  assert(!by('Hp23').usable && by('Hp23').reason === 'framerate', '23.98p: Grund framerate');
  assert(!by('Hp30').usable && by('Hp30').reason === 'pixelformat', 'ohne BGRA: Grund pixelformat');

  // Kein stilles Weglassen: JEDE eingehende Norm kommt zurueck, und jede unbenutzbare
  // traegt einen Grund. Eine Liste, aus der etwas kommentarlos fehlt, ist eine Anzeige,
  // die luegt — die Lehre aus switcher-v0.10.0.
  assert(judged.length === 8, 'jede eingehende Norm kommt zurueck');
  assert(
    judged.every((j) => j.usable || j.reason !== undefined),
    'jede unbenutzbare Norm traegt einen Grund',
  );
}

console.log('modes — Vorrang der Gruende (mehrere Maengel zugleich):');
{
  // Echte Karten melden durchaus Normen mit ZWEI Maengeln — 2160i50 und 1080i23.98
  // sind gewoehnliche Eintraege. Der Vorrang ist im Modul als Absicht dokumentiert;
  // ohne diese Pruefungen koennte man die Reihenfolge umstellen, ohne dass ein Test
  // es bemerkt.
  const judged = judgeModes([
    mode({ mode: '4ki5', name: '2160i50', width: 3840, height: 2160, interlaced: true }),
    mode({ mode: 'Hi23', name: '1080i23.98', fpsN: 24000, fpsD: 1001, interlaced: true }),
    mode({ mode: '4k23', name: '2160p23.98', width: 3840, height: 2160, fpsN: 24000, fpsD: 1001 }),
    mode({ mode: 'Hp2b', name: '1080p23.98', fpsN: 24000, fpsD: 1001, supportsBGRA: false }),
    mode({ mode: '4kpf', name: '2160PsF25', width: 3840, height: 2160, segmented: true }),
  ]);
  const by = (m: string) => judged.find((j) => j.mode === m)!;

  assert(by('4ki5').reason === 'interlaced', 'Halbbild + Aufloesung: interlaced gewinnt');
  assert(by('Hi23').reason === 'interlaced', 'Halbbild + Bildrate: interlaced gewinnt');
  assert(by('4k23').reason === 'resolution', 'Aufloesung + Bildrate: resolution gewinnt');
  assert(by('Hp2b').reason === 'framerate', 'Bildrate + Pixelformat: framerate gewinnt');
  assert(by('4kpf').reason === 'segmented', 'PsF + Aufloesung: segmented gewinnt');
}

console.log('modes — Randfaelle:');
{
  assert(judgeModes([]).length === 0, 'leere Liste bleibt leer');
  // fpsD === 0 waere eine Division durch null. Der Wachposten in roundedFps faengt sie;
  // die Norm ist dann unbenutzbar wegen der Bildrate — nicht durch einen Absturz.
  const zero = judgeModes([mode({ mode: 'zero', fpsD: 0 })])[0];
  assert(!zero.usable && zero.reason === 'framerate', 'fpsD=0 ergibt framerate, keinen Absturz');
}

console.log('modes — Abbildung auf Switcher-Einstellungen:');
{
  assert(
    modeToProgramSettings(mode({})).resolution === '1080p',
    '1920x1080 wird zu 1080p',
  );
  assert(
    modeToProgramSettings(mode({ width: 1280, height: 720 })).resolution === '720p',
    '1280x720 wird zu 720p',
  );
  assert(modeToProgramSettings(mode({})).fps === 25, '25000/1000 wird zu 25');
  // Bruchraten sind zugelassen und driften bewusst: 30000/1001 ist 29,97, nicht 30.
  // Der Switcher taktet danach 0,1 % schneller als die Karte — sichtbar in den
  // repeated/rejected-Zaehlern, nicht wegdefiniert.
  assert(
    modeToProgramSettings(mode({ fpsN: 30000, fpsD: 1001 })).fps === 30,
    '30000/1001 wird auf 30 gerundet',
  );
  assert(
    modeToProgramSettings(mode({ fpsN: 60000, fpsD: 1001 })).fps === 60,
    '60000/1001 wird auf 60 gerundet',
  );
}

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/decklink-Selbsttests gruen.');
