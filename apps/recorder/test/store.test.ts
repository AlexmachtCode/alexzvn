// Renderer-Store (#291): gemerkte Einstellungen beim Start wiederherstellen und Änderungen
// speichern. Attrappe statt window.jmrec; jeder Fall lädt den Store frisch (eigene Modul-Instanz).
// npm run selftest -w @jm/recorder
import type { AudioDevice, GeladeneEinstellungen, RecEinstellungen, RecShowSettings } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MME: AudioDevice = { index: 0, name: 'Mikrofon (Realtek)', hostApiName: 'MME', maxInputChannels: 2, defaultSampleRate: 44100 };
const DANTE: AudioDevice = { index: 7, name: 'Dante Virtual Soundcard (x64)', hostApiName: 'ASIO', maxInputChannels: 64, defaultSampleRate: 48000 };
const FOCUS: AudioDevice = { index: 3, name: 'Focusrite USB ASIO', hostApiName: 'ASIO', maxInputChannels: 8, defaultSampleRate: 44100 };

interface Lage {
  devices: AudioDevice[];
  geladen: GeladeneEinstellungen;
  show?: RecShowSettings | null;
  altGain?: string | null;
  /** Läuft mitten im Laden: hier kommt z. B. eine Show-Vorgabe per Deep-Link herein. */
  beimLaden?: (showPush: (s: RecShowSettings) => void) => void;
}
let n = 0;
async function starte(lage: Lage) {
  const gespeichert: RecEinstellungen[] = [];
  const gain: number[] = [];
  let showPush: (s: RecShowSettings) => void = () => {};
  const api = {
    platform: 'win32',
    listDevices: async () => lage.devices,
    setGain: async (db: number) => { gain.push(db); },
    onLevels: () => () => {}, onState: () => () => {}, onNotice: () => () => {},
    onRemoteCommand: () => () => {},
    onShowSettings: (cb: (s: RecShowSettings) => void) => { showPush = cb; return () => {}; },
    takeShowSettings: async () => lage.show ?? null,
    settings: {
      load: async () => { await Promise.resolve(); lage.beimLaden?.(showPush); return lage.geladen; },
      save: (e: RecEinstellungen) => { gespeichert.push(JSON.parse(JSON.stringify(e))); },
    },
  };
  const ls = new Map<string, string>();
  if (lage.altGain != null) ls.set('jmrec.gainDb', lage.altGain);
  const g = globalThis as Record<string, unknown>;
  g.window = { jmrec: api, addEventListener: () => {} };
  g.localStorage = { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => ls.set(k, v) };
  const mod = await import(`../src/renderer/src/store/recorder.ts?fall=${n++}`);
  await mod.useRec.getState().init();
  return { useRec: mod.useRec as typeof import('../src/renderer/src/store/recorder').useRec, gespeichert, gain, MERK_MS: mod.MERK_VERZOEGERUNG_MS as number };
}

const VOLL: RecEinstellungen = {
  eingang: { name: DANTE.name, hostApiName: 'ASIO' },
  channels: 16, sampleRate: 96000, dir: 'D:\\VA', fileName: 'Plenum', separateTracks: true, gainDb: 6, scheduleDurationMin: 90,
};

// --- 1. Alles gemerkt, Eingang da (auf anderer Nummer als beim Speichern ist egal).
{
  const t = await starte({ devices: [MME, DANTE], geladen: { einstellungen: VOLL, ordnerDa: true } });
  const s = t.useRec.getState();
  ck('1: gemerkter Eingang gewählt, nicht die Vorauswahl', s.deviceIndex === 7);
  ck('1: Kanäle + Samplerate wie gemerkt, nicht Gerätevorgabe', s.channels === 16 && s.sampleRate === 96000);
  ck('1: Ordner, Name, Einzelspuren, Dauer wie gemerkt', s.dir === 'D:\\VA' && s.fileName === 'Plenum' && s.separateTracks && s.scheduleDurationMin === 90);
  ck('1: Verstärkung wie gemerkt und an den Main gegeben', s.gainDb === 6 && t.gain.at(-1) === 6);
  ck('1: keine Hinweise', s.hinweisEingang === null && s.hinweisOrdner === null);
  ck('1: Start allein speichert nichts', t.gespeichert.length === 0);
  ck('1: loading aus', s.loading === false);

  s.setFileName('Plenum Tag 2');
  await warte(t.MERK_MS + 50);
  ck('1: Änderung wird gespeichert', t.gespeichert.length === 1 && t.gespeichert[0].fileName === 'Plenum Tag 2');
  ck('1: gespeichert mit Eingang über Name + Treiber', JSON.stringify(t.gespeichert[0]?.eingang) === JSON.stringify(VOLL.eingang));
  t.useRec.setState({ peaks: [0.5, 0.2] });
  await warte(t.MERK_MS + 50);
  ck('1: Pegel lösen kein Speichern aus', t.gespeichert.length === 1);
}

// --- 2. Mehr Kanäle gemerkt als das Gerät hat → auf das Gerät begrenzt.
{
  const t = await starte({ devices: [FOCUS], geladen: { einstellungen: { ...VOLL, eingang: { name: FOCUS.name, hostApiName: 'ASIO' }, channels: 32 }, ordnerDa: true } });
  ck('2: Kanäle auf Gerätemaximum 8 begrenzt', t.useRec.getState().channels === 8);
}

// --- 3. Gemerkter Eingang fehlt (DVS noch nicht gestartet): Vorauswahl + bleibender Hinweis,
//        der gemerkte Eingang wird NICHT durch die Vorauswahl ersetzt, bis jemand selbst wählt.
{
  const lage: Lage = { devices: [MME, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: true } };
  const t = await starte(lage);
  const s = t.useRec.getState();
  ck('3: Vorauswahl (ASIO) statt nichts', s.deviceIndex === 3);
  ck('3: Hinweis nennt den gemerkten Eingang', (s.hinweisEingang ?? '').includes('Dante Virtual Soundcard (x64)'));
  s.setFileName('anders');
  await warte(t.MERK_MS + 50);
  ck('3: gespeichert bleibt der gemerkte Eingang + seine Werte', t.gespeichert.length === 1
    && t.gespeichert[0].eingang?.name === DANTE.name && t.gespeichert[0].channels === 16 && t.gespeichert[0].sampleRate === 96000);

  // DVS wird gestartet, „Aktualisieren" gedrückt → gemerkter Eingang wieder da.
  lage.devices = [MME, FOCUS, { ...DANTE, index: 12 }];
  await t.useRec.getState().refreshDevices();
  const s2 = t.useRec.getState();
  ck('3: nach Aktualisieren gemerkter Eingang gewählt', s2.deviceIndex === 12 && s2.channels === 16 && s2.sampleRate === 96000);
  ck('3: Hinweis verschwindet', s2.hinweisEingang === null);
}

// --- 4. Fehlender Eingang, aber jemand wählt selbst → diese Wahl wird gemerkt.
{
  const t = await starte({ devices: [MME, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: true } });
  t.useRec.getState().selectDevice(0);
  await warte(t.MERK_MS + 50);
  ck('4: eigene Wahl gemerkt', t.gespeichert.at(-1)?.eingang?.name === MME.name && t.gespeichert.at(-1)?.eingang?.hostApiName === 'MME');
  ck('4: Hinweis weg', t.useRec.getState().hinweisEingang === null);
}

// --- 5. Zielordner nicht erreichbar → bleibender Hinweis; neuer Ordner nimmt ihn weg.
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: false } });
  ck('5: Ordner-Hinweis nennt den Pfad', (t.useRec.getState().hinweisOrdner ?? '').includes('D:\\VA'));
  ck('5: Ordner bleibt eingetragen', t.useRec.getState().dir === 'D:\\VA');
}

// --- 6. Show-Vorgaben schlagen die gemerkten Werte.
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: true }, show: { sampleRate: 44100, dir: 'E:\\Show' } });
  const s = t.useRec.getState();
  ck('6: Show-Samplerate gilt', s.sampleRate === 44100);
  ck('6: Show-Ordner gilt', s.dir === 'E:\\Show');
  ck('6: Rest bleibt gemerkt', s.fileName === 'Plenum' && s.channels === 16);
}

// --- 7. Erster Start ohne Datei: Verhalten wie bisher; alte Verstärkung aus localStorage übernommen.
{
  const t = await starte({ devices: [MME, DANTE], geladen: { einstellungen: {}, ordnerDa: null }, altGain: '9' });
  const s = t.useRec.getState();
  ck('7: Vorauswahl Dante mit Gerätevorgabe', s.deviceIndex === 7 && s.channels === 2 && s.sampleRate === 48000);
  ck('7: alte Verstärkung übernommen', s.gainDb === 9);
  ck('7: keine Hinweise', s.hinweisEingang === null && s.hinweisOrdner === null);
}

// --- 8. Show-Vorgabe kommt per Deep-Link WÄHREND des Startens (Review-Befund): darf nicht von den
//        gemerkten Werten überschrieben werden.
{
  const t = await starte({
    devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: true },
    beimLaden: (push) => push({ sampleRate: 44100, fileName: 'Live-Show' }),
  });
  const s = t.useRec.getState();
  ck('8: Show-Samplerate aus dem Deep-Link gilt', s.sampleRate === 44100);
  ck('8: Show-Dateiname aus dem Deep-Link gilt', s.fileName === 'Live-Show');
}

console.log(`\nstore: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
