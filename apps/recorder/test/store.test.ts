// Renderer-Store (#291): gemerkte Einstellungen beim Start wiederherstellen und Änderungen
// speichern. Attrappe statt window.jmrec; jeder Fall lädt den Store frisch (eigene Modul-Instanz).
// npm run selftest -w @jm/recorder
import type { AudioDevice, GeladeneEinstellungen, PresetDateiErgebnis, RecEinstellungen, RecPreset, RecorderRemoteCommand, RecorderState, RecShowSettings } from '../src/shared/types';

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
  /** Schon gespeicherte Presets (Attrappe von presets.list). */
  presets?: RecPreset[];
  /** Antwort von ordnerDa (Standard: true). */
  ordnerDa?: boolean;
  /** Antwort von ordnerDa je Pfad (geht `ordnerDa` vor), z. B. ein Versprechen, das nie antwortet. */
  ordnerDaFn?: (dir: string) => Promise<boolean>;
  /** Antwort des Ordnerdialogs (Standard: Abbruch, null). */
  pickDir?: string | null;
  /** Antwort von netzordnerBestaetigen (Standard: true). */
  bestaetigen?: boolean;
  /** Antwort von arm (Standard: ok). */
  armErgebnis?: { ok: boolean; error?: string };
  /** arm antwortet erst nach dieser Zeit (ms). */
  armVerzoegerungMs?: number;
  exportErgebnis?: PresetDateiErgebnis;
  importErgebnis?: PresetDateiErgebnis;
  /** Lässt die jeweilige presets-Funktion ablehnen. */
  presetFehler?: { list?: string; speichern?: string; loeschen?: string; exportieren?: string; importieren?: string };
}
let n = 0;
async function starte(lage: Lage) {
  const gespeichert: RecEinstellungen[] = [];
  const gain: number[] = [];
  let showPush: (s: RecShowSettings) => void = () => {};
  let pushState: (s: RecorderState) => void = () => {};
  let fernbefehl: (cmd: RecorderRemoteCommand) => void = () => {};
  const aufrufe = {
    arm: [] as unknown[], disarm: 0, speichern: [] as RecPreset[], loeschen: [] as string[], ordnerDa: [] as string[],
    // Altfehler Stufe 2 (Task 6): Ordnerdialog, Start/Stopp, Ablehnungen und Bestätigungen zählen.
    pickDir: 0, start: [] as { dir: string }[], stop: 0, ablehnung: [] as { hinweis: string; log: string }[], bestaetigen: [] as string[],
  };
  let ablage: RecPreset[] = (lage.presets ?? []).map((p) => JSON.parse(JSON.stringify(p)));
  const fehler = lage.presetFehler ?? {};
  const api = {
    platform: 'win32',
    listDevices: async () => lage.devices,
    setGain: async (db: number) => { gain.push(db); },
    onLevels: () => () => {}, onState: (cb: (s: RecorderState) => void) => { pushState = cb; return () => {}; }, onNotice: () => () => {},
    onRemoteCommand: (cb: (cmd: RecorderRemoteCommand) => void) => { fernbefehl = cb; return () => {}; },
    dialog: { pickDir: async () => { aufrufe.pickDir++; return lage.pickDir ?? null; } },
    startRecording: async (r: { dir: string }) => { aufrufe.start.push(JSON.parse(JSON.stringify(r))); return { ok: true }; },
    stopRecording: async () => { aufrufe.stop++; return { ok: true, filePath: 'E:\\Alt\\Tag.wav' }; },
    ablehnung: async (a: { hinweis: string; log: string }) => { aufrufe.ablehnung.push(a); },
    netzordnerBestaetigen: async (p: string) => { aufrufe.bestaetigen.push(p); return lage.bestaetigen ?? true; },
    onShowSettings: (cb: (s: RecShowSettings) => void) => { showPush = cb; return () => {}; },
    takeShowSettings: async () => lage.show ?? null,
    // arm/disarm schieben den Ist-Zustand wie der Main (emitState): offen mit den Werten oder zu.
    arm: async (a: { device: number; channels: number; sampleRate: number }) => {
      aufrufe.arm.push(a);
      if (lage.armVerzoegerungMs) await warte(lage.armVerzoegerungMs);
      const erg = lage.armErgebnis ?? { ok: true };
      pushState({ ...ZU, ...(erg.ok ? { status: 'armed' as const, ...a } : {}) });
      return erg;
    },
    disarm: async () => { aufrufe.disarm++; pushState({ ...ZU }); return { ok: true }; },
    ordnerDa: async (d: string) => { aufrufe.ordnerDa.push(d); return lage.ordnerDaFn ? lage.ordnerDaFn(d) : (lage.ordnerDa ?? true); },
    presets: {
      list: async () => { if (fehler.list) throw new Error(fehler.list); return ablage; },
      speichern: async (p: RecPreset) => {
        if (fehler.speichern) throw new Error(fehler.speichern);
        aufrufe.speichern.push(JSON.parse(JSON.stringify(p)));
        ablage = [...ablage.filter((x) => x.name !== p.name), p];
        return ablage;
      },
      loeschen: async (name: string) => {
        if (fehler.loeschen) throw new Error(fehler.loeschen);
        aufrufe.loeschen.push(name);
        ablage = ablage.filter((x) => x.name !== name);
        return ablage;
      },
      exportieren: async () => { if (fehler.exportieren) throw new Error(fehler.exportieren); return lage.exportErgebnis ?? { ok: false }; },
      importieren: async () => { if (fehler.importieren) throw new Error(fehler.importieren); return lage.importErgebnis ?? { ok: false }; },
    },
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
  return {
    useRec: mod.useRec as typeof import('../src/renderer/src/store/recorder').useRec,
    gespeichert, gain, aufrufe, MERK_MS: mod.MERK_VERZOEGERUNG_MS as number,
    presetGeaendert: mod.presetGeaendert as (s: unknown) => boolean,
    /** Schiebt einen Zustand vom Main herein, wie onState es täte. */
    setzeZustand: (z: Partial<RecorderState>) => pushState({ ...ZU, ...z }),
    /** Ein Befehl der Fernsteuerung (Companion), wie onRemoteCommand ihn liefert. */
    fernbefehl: (cmd: RecorderRemoteCommand) => fernbefehl(cmd),
    /** Eine Show-Vorgabe zur Laufzeit (Push recorder:show-settings). */
    schickeShow: (s: RecShowSettings) => showPush(s),
  };
}
/** Ruft eine Store-Aktion, die es vor der Änderung nicht gibt: ein Wurf wird zur Zeile, damit jeder Fall für sich rot zeigt. */
async function rufe(f: () => unknown): Promise<void> {
  try {
    await f();
  } catch (e) {
    console.log(`      (Wurf: ${(e as Error).message})`);
  }
}
const ZU: RecorderState = { status: 'idle', device: null, channels: 0, sampleRate: 0, filePath: null, recordedSec: 0 };

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
//        Altfehler RE-7b: settings:load prüft nicht mehr selbst (ordnerDa null); der Store fragt ordnerDa nach dem Setzen, ohne zu warten.
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null }, ordnerDa: false });
  await warte(10);
  ck('5: Ordner-Hinweis nennt den Pfad', (t.useRec.getState().hinweisOrdner ?? '').includes('D:\\VA'));
  ck('5: Ordner bleibt eingetragen', t.useRec.getState().dir === 'D:\\VA');
}

// --- RE-7b: settings:load wartet nicht. Antwortet ordnerDa nie (totes NAS), ist der Start trotzdem fertig.
{
  const fertig = await Promise.race([
    starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null }, ordnerDaFn: () => new Promise<boolean>(() => {}) }),
    warte(1000).then(() => null),
  ]);
  const s = fertig?.useRec.getState();
  ck('RE-7b settings:load wartet nicht: init ist fertig, obwohl ordnerDa nie antwortet (loading false, Eingang gewählt)', s !== undefined && s.loading === false && s.deviceIndex === 7);
  ck('RE-7b settings:load wartet nicht: der Store fragt ordnerDa für den gemerkten Ordner', fertig?.aufrufe.ordnerDa.includes('D:\\VA') === true);
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

// --- Presets (Task 3) ---------------------------------------------------------------------
const FOCUS_E = { name: FOCUS.name, hostApiName: 'ASIO' };
const pv = (o: Partial<RecEinstellungen> = {}): RecEinstellungen => ({
  eingang: FOCUS_E, channels: 8, sampleRate: 44100, dir: 'E:\\Show', fileName: '', separateTracks: false, gainDb: 3, scheduleDurationMin: 0, ...o,
});
const ersterStart: GeladeneEinstellungen = { einstellungen: {}, ordnerDa: null };

// --- 9. Speichern: ohne preset-Feld, aktiv, „geändert“ erst nach einer Änderung.
{
  const t = await starte({ devices: [DANTE], geladen: ersterStart });
  await t.useRec.getState().presetSpeichern('  Dante ');
  const s = t.useRec.getState();
  const p = t.aufrufe.speichern[0];
  ck('9: speichern mit Namen (getrimmt) und Werten', p?.name === 'Dante' && p.werte.channels === 2 && p.werte.sampleRate === 48000);
  ck('9: werte ohne preset-Feld', p !== undefined && !('preset' in p.werte));
  ck('9: aktivesPreset + Liste + Meldung', s.aktivesPreset === 'Dante' && s.presets.length === 1 && s.notice === 'Preset „Dante“ gespeichert.');
  ck('9: nicht geändert direkt nach Speichern', t.presetGeaendert(s) === false);
  s.setFileName('x');
  ck('9: nach Änderung geändert', t.presetGeaendert(t.useRec.getState()) === true);
  await t.useRec.getState().presetSpeichern('   ');
  ck('9: leerer Name -> Hinweis, kein Speichern', t.aufrufe.speichern.length === 1 && t.useRec.getState().notice === 'Bitte einen Namen für das Preset eingeben.');
  t.useRec.getState().presetAbwaehlen();
  ck('9: Abwählen lässt Werte, löscht aktives', t.useRec.getState().aktivesPreset === null && t.useRec.getState().fileName === 'x');
}

// --- 10. Anwenden: Gerät, Kanäle, Rate, Ordner, Gain.
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv() }] });
  ck('10: Ausgangslage Dante', t.useRec.getState().deviceIndex === 7);
  await t.useRec.getState().presetAnwenden('Fo');
  const s = t.useRec.getState();
  ck('10: Gerät/Kanäle/Rate', s.deviceIndex === 3 && s.channels === 8 && s.sampleRate === 44100);
  ck('10: Ordner + Gain', s.dir === 'E:\\Show' && s.gainDb === 3 && t.gain.at(-1) === 3);
  ck('10: aktiv + Meldung', s.aktivesPreset === 'Fo' && s.notice === 'Preset „Fo“ angewendet.');
  ck('10: nicht geändert', t.presetGeaendert(s) === false);
}

// --- 11. Offener Eingang, Gerät wechselt -> neu öffnen mit begrenzten Kanälen.
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv({ channels: 32 }) }] });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  await t.useRec.getState().presetAnwenden('Fo');
  const s = t.useRec.getState();
  const a = t.aufrufe.arm[0] as { device: number; channels: number } | undefined;
  ck('11: Kanäle auf Gerät begrenzt', s.channels === 8);
  ck('11: disarm 1x, arm 1x mit Gerät 3 / 8 Kanälen', t.aufrufe.disarm === 1 && t.aufrufe.arm.length === 1 && a?.device === 3 && a.channels === 8);
  ck('11: Meldung nennt das Neuöffnen', s.notice === 'Preset „Fo“ angewendet. Eingang neu geöffnet.');
}

// --- 11b. Neu öffnen scheitert -> keine Erfolgsmeldung, Fehlertext bleibt, Preset trotzdem aktiv.
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv() }], armErgebnis: { ok: false, error: 'Gerät belegt' } });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  await t.useRec.getState().presetAnwenden('Fo');
  const s = t.useRec.getState();
  ck('11b: Meldung nennt Scheitern + Fehlertext', (s.notice ?? '').includes('nicht wieder öffnen') && (s.notice ?? '').includes('Gerät belegt'));
  ck('11b: keine Erfolgsmeldung', !(s.notice ?? '').includes('Eingang neu geöffnet'));
  ck('11b: Preset bleibt aktiv', s.aktivesPreset === 'Fo');
}

// --- 12. Offener Eingang, nur der Dateiname ändert sich -> kein Neuöffnen.
{
  const werte = pv({ eingang: { name: DANTE.name, hostApiName: 'ASIO' }, channels: 2, sampleRate: 48000, fileName: 'Neu' });
  const t = await starte({ devices: [DANTE], geladen: ersterStart, presets: [{ name: 'Nur', werte }] });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  await t.useRec.getState().presetAnwenden('Nur');
  ck('12: Dateiname gesetzt', t.useRec.getState().fileName === 'Neu');
  ck('12: weder disarm noch arm', t.aufrufe.disarm === 0 && t.aufrufe.arm.length === 0);
}

// --- 13. Während Aufnahme / Planung wird nichts angewendet.
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv() }] });
  t.setzeZustand({ status: 'idle', scheduledStartAt: Date.now() + 60000 });
  await t.useRec.getState().presetAnwenden('Fo');
  let s = t.useRec.getState();
  ck('13: geplant -> nichts geändert, Meldung', s.deviceIndex === 7 && s.dir === null && s.aktivesPreset === null && (s.notice ?? '').includes('geplanten Aufnahme'));
  t.setzeZustand({ status: 'recording' });
  t.useRec.setState({ notice: null });
  await t.useRec.getState().presetAnwenden('Fo');
  s = t.useRec.getState();
  ck('13: Aufnahme -> nichts geändert, Meldung', s.deviceIndex === 7 && s.aktivesPreset === null && (s.notice ?? '').includes('geplanten Aufnahme'));
}

// --- 14. Preset-Gerät fehlt -> Hinweis, Preset-Gerät wird gemerkt.
{
  const t = await starte({ devices: [DANTE], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv() }] });
  await t.useRec.getState().presetAnwenden('Fo');
  const s = t.useRec.getState();
  ck('14: Hinweis nennt Preset und Gerät', (s.hinweisEingang ?? '').includes('„Fo“') && (s.hinweisEingang ?? '').includes(FOCUS.name));
  await warte(t.MERK_MS + 50);
  const g = t.gespeichert.at(-1);
  ck('14: gemerkt wird das Preset-Gerät samt Werten', g?.eingang?.name === FOCUS.name && g.channels === 8 && g.sampleRate === 44100);
  ck('14: nicht geändert', t.presetGeaendert(s) === false);
}

// --- 15. Ordner nicht erreichbar; init stellt das aktive Preset nur wieder her, wenn es existiert.
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, ordnerDa: false, presets: [{ name: 'Fo', werte: pv() }] });
  await t.useRec.getState().presetAnwenden('Fo');
  ck('15: Ordner-Hinweis nennt Pfad', (t.useRec.getState().hinweisOrdner ?? '').includes('E:\\Show'));
  const a = await starte({ devices: [DANTE], geladen: { einstellungen: { preset: 'Dante' }, ordnerDa: true }, presets: [{ name: 'Dante', werte: pv() }] });
  ck('15: init: gemerktes Preset aktiv, Start speichert nichts', a.useRec.getState().aktivesPreset === 'Dante' && a.gespeichert.length === 0);
  const b = await starte({ devices: [DANTE], geladen: { einstellungen: { preset: 'Weg' }, ordnerDa: true }, presets: [{ name: 'Dante', werte: pv() }] });
  ck('15: init: unbekanntes Preset -> null', b.useRec.getState().aktivesPreset === null);
  const c = await starte({ devices: [DANTE], geladen: ersterStart, presetFehler: { list: 'kaputt' } });
  ck('15: init übersteht kaputte Liste', c.useRec.getState().presets.length === 0 && c.useRec.getState().loading === false);
}

// --- 16. Löschen, Fehler, Export/Import.
{
  const t = await starte({ devices: [DANTE], geladen: ersterStart, presets: [{ name: 'A', werte: pv() }, { name: 'B', werte: pv() }] });
  await t.useRec.getState().presetAnwenden('A');
  await t.useRec.getState().presetLoeschen('B');
  ck('16: anderes gelöscht -> aktiv bleibt', t.useRec.getState().aktivesPreset === 'A' && t.useRec.getState().notice === 'Preset „B“ gelöscht.');
  await t.useRec.getState().presetLoeschen('A');
  ck('16: aktives gelöscht -> null, Liste leer', t.useRec.getState().aktivesPreset === null && t.useRec.getState().presets.length === 0);

  const f = await starte({ devices: [DANTE], geladen: ersterStart, presetFehler: { speichern: 'Platte voll' } });
  await f.useRec.getState().presetSpeichern('X');
  ck('16: Speichern-Fehler als Meldung', f.useRec.getState().notice === 'Preset konnte nicht gespeichert werden: Platte voll' && f.useRec.getState().aktivesPreset === null);

  const e = await starte({ devices: [DANTE], geladen: ersterStart, exportErgebnis: { ok: true, meldung: '2 Presets exportiert.' } });
  await e.useRec.getState().presetsExportieren();
  ck('16: Export-Meldung', e.useRec.getState().notice === '2 Presets exportiert.');
  const ab = await starte({ devices: [DANTE], geladen: ersterStart });
  await ab.useRec.getState().presetsImportieren();
  ck('16: Abbruch -> keine Meldung', ab.useRec.getState().notice === null);
  const im = await starte({ devices: [DANTE], geladen: ersterStart, importErgebnis: { ok: true, meldung: '1 importiert.', presets: [{ name: 'I', werte: pv() }] } });
  await im.useRec.getState().presetsImportieren();
  ck('16: Import übernimmt Liste + Meldung', im.useRec.getState().presets.length === 1 && im.useRec.getState().notice === '1 importiert.');
  const ie = await starte({ devices: [DANTE], geladen: ersterStart, importErgebnis: { ok: false, error: 'Keine Presets-Datei.' } });
  await ie.useRec.getState().presetsImportieren();
  ck('16: Import-Fehlertext', ie.useRec.getState().notice === 'Keine Presets-Datei.');
  const ir = await starte({ devices: [DANTE], geladen: ersterStart, presetFehler: { importieren: 'boom' } });
  await ir.useRec.getState().presetsImportieren();
  ck('16: Import-Ablehnung', ir.useRec.getState().notice === 'Import fehlgeschlagen: boom');
}

// --- 17. Presets schnell hintereinander (Pfeiltasten auf der Auswahl): nacheinander angewendet,
//         am Ende ist offen, was die Oberfläche zeigt; das aktive Preset steht sofort.
const MI = pv({ eingang: { name: MME.name, hostApiName: 'MME' }, channels: 2, sampleRate: 44100 });
const DA = pv({ eingang: { name: DANTE.name, hostApiName: 'ASIO' }, channels: 2, sampleRate: 48000 });
const offenWieGezeigt = (s: { state: RecorderState; deviceIndex: number | null; channels: number; sampleRate: number }): boolean =>
  s.state.status === 'armed' && s.state.device === s.deviceIndex && s.state.channels === s.channels && s.state.sampleRate === s.sampleRate;
{
  const t = await starte({
    devices: [DANTE, FOCUS, MME], geladen: ersterStart, armVerzoegerungMs: 30,
    presets: [{ name: 'Fo', werte: pv() }, { name: 'Mi', werte: MI }],
  });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  const erst = t.useRec.getState().presetAnwenden('Fo');
  ck('17: aktivesPreset sofort gesetzt, kein „(geändert)“', t.useRec.getState().aktivesPreset === 'Fo' && t.presetGeaendert(t.useRec.getState()) === false);
  const dann = t.useRec.getState().presetAnwenden('Mi');
  await Promise.all([erst, dann]);
  const s = t.useRec.getState();
  const letzter = t.aufrufe.arm.at(-1) as { device: number } | undefined;
  ck('17: aktivesPreset = zweites', s.aktivesPreset === 'Mi');
  ck('17: letzter arm mit dem Gerät des zweiten', letzter?.device === 0);
  ck('17: offen ist, was die Oberfläche zeigt', offenWieGezeigt(s));
}
{
  // Drei hintereinander, während das erste noch öffnet: das mittlere wartende entfällt.
  const t = await starte({
    devices: [DANTE, FOCUS, MME], geladen: ersterStart, armVerzoegerungMs: 30,
    presets: [{ name: 'Fo', werte: pv() }, { name: 'Mi', werte: MI }, { name: 'Da', werte: DA }],
  });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  const s0 = t.useRec.getState();
  await Promise.all([s0.presetAnwenden('Fo'), s0.presetAnwenden('Mi'), s0.presetAnwenden('Da')]);
  const s = t.useRec.getState();
  const geraete = (t.aufrufe.arm as { device: number }[]).map((a) => a.device);
  ck(`17: überholtes wartendes Preset entfällt (arm: ${geraete.join(',')})`, geraete.join(',') === '3,7');
  ck('17: am Ende das letzte Preset, offen wie gezeigt', s.aktivesPreset === 'Da' && offenWieGezeigt(s));
}

// --- 18. Langer Name: gekürzt wie im Main, das aktive Preset trägt den gespeicherten Namen.
{
  const t = await starte({ devices: [DANTE], geladen: ersterStart });
  await t.useRec.getState().presetSpeichern(`  ${'a'.repeat(59)} ${'b'.repeat(10)}`);
  const n = t.aufrufe.speichern[0]?.name;
  ck('18: Name auf 60 Zeichen gekürzt und getrimmt', n === 'a'.repeat(59));
  ck('18: aktivesPreset = gespeicherter Name', t.useRec.getState().aktivesPreset === n);
}

// --- 19. Preset ohne Ordner: „(geändert)“ vergleicht nur, was das Preset kennt.
{
  const t = await starte({
    devices: [DANTE, FOCUS], geladen: { einstellungen: { dir: 'D:\\VA' }, ordnerDa: true },
    presets: [{ name: 'OhneDir', werte: pv({ dir: undefined, eingang: undefined }) }],
  });
  await t.useRec.getState().presetAnwenden('OhneDir');
  const s = t.useRec.getState();
  ck('19: Ordner blieb, Preset aktiv', s.dir === 'D:\\VA' && s.aktivesPreset === 'OhneDir');
  ck('19: Preset ohne dir/eingang -> nicht geändert', t.presetGeaendert(s) === false);
  s.setSampleRate(96000);
  ck('19: anderer sampleRate -> geändert', t.presetGeaendert(t.useRec.getState()) === true);
}

// --- 20. Vorbehalt + Bedienung: setChannels beendet den Vorbehalt, gemerkt wird der gewählte Eingang.
{
  const t = await starte({ devices: [MME, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: true } });
  t.useRec.getState().setChannels(4);
  await warte(t.MERK_MS + 50);
  const g = t.gespeichert.at(-1);
  ck('20: gemerkt wird der gewählte Eingang mit 4 Kanälen', g?.eingang?.name === FOCUS.name && g.channels === 4);
  ck('20: Banner zum fehlenden Eingang weg', t.useRec.getState().hinweisEingang === null);
}
{
  const t = await starte({ devices: [MME, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: true } });
  t.useRec.getState().setSampleRate(32000);
  await warte(t.MERK_MS + 50);
  const g = t.gespeichert.at(-1);
  ck('20: setSampleRate beendet den Vorbehalt auch', g?.eingang?.name === FOCUS.name && g.sampleRate === 32000);
  ck('20: Banner weg (setSampleRate)', t.useRec.getState().hinweisEingang === null);
}

// --- 21. Show-Vorgaben mit Kanälen/Samplerate lassen den Vorbehalt stehen.
{
  const t = await starte({ devices: [MME, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: true }, show: { channels: 4, sampleRate: 44100 } });
  const s = t.useRec.getState();
  ck('21: Show-Werte gelten', s.channels === 4 && s.sampleRate === 44100);
  s.setFileName('Show-Tag');
  await warte(t.MERK_MS + 50);
  const g = t.gespeichert.at(-1);
  ck('21: gemerkt bleibt der fehlende Eingang (Vorbehalt steht)', g?.eingang?.name === DANTE.name);
  ck('21: Hinweis zum fehlenden Eingang bleibt', (t.useRec.getState().hinweisEingang ?? '').includes(DANTE.name));
}

// --- 22. „— kein Preset —“ streicht ein wartendes Anwenden.
{
  const t = await starte({
    devices: [DANTE, FOCUS, MME], geladen: ersterStart, armVerzoegerungMs: 30,
    presets: [{ name: 'Fo', werte: pv() }, { name: 'Mi', werte: MI }],
  });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  const a = t.useRec.getState().presetAnwenden('Fo');
  const b = t.useRec.getState().presetAnwenden('Mi');
  t.useRec.getState().presetAbwaehlen();
  ck('22: aktivesPreset sofort null', t.useRec.getState().aktivesPreset === null);
  await Promise.all([a, b]);
  const geraete = (t.aufrufe.arm as { device: number }[]).map((x) => x.device);
  ck(`22: das wartende B läuft nicht (arm: ${geraete.join(',')})`, geraete.join(',') === '3');
  ck('22: aktivesPreset bleibt null', t.useRec.getState().aktivesPreset === null);
}

// --- 23. Neu öffnen kommt VOR der Ordnerabfrage (ein unerreichbares NAS hält den Gerätewechsel nicht auf).
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv() }] });
  let antworte: (v: boolean) => void = () => {};
  (globalThis as unknown as { window: { jmrec: { ordnerDa: (d: string) => Promise<boolean> } } }).window.jmrec.ordnerDa =
    () => new Promise<boolean>((r) => { antworte = r; });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  const lauf = t.useRec.getState().presetAnwenden('Fo');
  await warte(20);
  ck('23: arm lief, bevor ordnerDa antwortet', t.aufrufe.arm.length === 1);
  antworte(false);
  await lauf;
  const s = t.useRec.getState();
  ck('23: danach Ordner-Hinweis + Meldung', (s.hinweisOrdner ?? '').includes('E:\\Show') && s.notice === 'Preset „Fo“ angewendet. Eingang neu geöffnet.');
}

// --- 24. Altfehler RE-7b: einen Netzwerkordner aus der Show schickt der Main als `dir` nur, wenn er bestätigt ist → gesetzt, kein
//         Hinweis (bisher: Hinweis „… liegt im Netzwerk …“). Ein lokaler Show-Ordner ebenso ohne Hinweis.
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null }, show: { dir: '\\\\nas\\x' } });
  const s = t.useRec.getState();
  ck('24: Ordner gesetzt', s.dir === '\\\\nas\\x');
  ck('24 (Altfehler RE-7b): bestätigter Netzwerkordner → gesetzt, kein Hinweis', s.hinweisOrdner === null && s.netzordnerOffen === null);
  const l = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null }, ordnerDa: false, show: { dir: 'E:\\Show' } });
  await warte(10);
  ck('24: lokaler Show-Ordner -> kein Hinweis (auch nicht der späte für den gemerkten Ordner)', l.useRec.getState().hinweisOrdner === null && l.useRec.getState().dir === 'E:\\Show');
}

// --- 25. Show-Werte wandern in den Vorbehalt: gemerkt wird der Show-Wert, und er gilt, wenn der Eingang zurückkommt.
{
  const lage: Lage = { devices: [MME, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: true }, show: { channels: 4, sampleRate: 44100 } };
  const t = await starte(lage);
  t.useRec.getState().setFileName('Show-Tag');
  await warte(t.MERK_MS + 50);
  const g = t.gespeichert.at(-1);
  ck('25: gemerkt: Dante mit Show-Kanälen/-Samplerate', g?.eingang?.name === DANTE.name && g.channels === 4 && g.sampleRate === 44100);
  lage.devices = [MME, FOCUS, { ...DANTE, index: 12 }];
  await t.useRec.getState().refreshDevices();
  const s2 = t.useRec.getState();
  ck('25: nach Aktualisieren Dante mit 4 / 44100', s2.deviceIndex === 12 && s2.channels === 4 && s2.sampleRate === 44100);
}

// --- 26. Schließen/Öffnen wirft beim Anwenden: Meldung mit Fehlertext, Ordner-Hinweis trotzdem, Promise löst auf.
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: ersterStart, presets: [{ name: 'Fo', werte: pv() }], ordnerDa: false });
  (globalThis as unknown as { window: { jmrec: { disarm: () => Promise<unknown> } } }).window.jmrec.disarm =
    async () => { throw new Error('kaputt'); };
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  await t.useRec.getState().presetAnwenden('Fo');
  const s = t.useRec.getState();
  ck('26: Ordner-Hinweis gesetzt', (s.hinweisOrdner ?? '').includes('E:\\Show'));
  ck('26: Meldung mit Fehlertext', s.notice === 'Preset „Fo“ angewendet – der Eingang ließ sich nicht wieder öffnen: kaputt');
}

// ═══ Altfehler Stufe 2, Recorder A (Plan 2026-11-26, Task 6) ═══════════════════════════════════════════════════════════════
const AUFNAHME: Partial<RecorderState> = { status: 'recording', device: 7, channels: 16, sampleRate: 96000, filePath: 'D:\\VA\\Plenum.wav' };
const OFFEN: Partial<RecorderState> = { status: 'armed', device: 7, channels: 16, sampleRate: 96000 };
const NETZ = '\\\\nas\\x';
const json = (v: unknown): string => JSON.stringify(v);

// --- RE-2: Companion ARM und DISARM in der Aufnahme werden abgelehnt; nichts ändert sich, Grund und Logzeile gehen an den Main.
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.setzeZustand(AUFNAHME);
  t.fernbefehl({ t: 'arm' });
  await warte(20);
  ck('RE-2 Companion ARM in der Aufnahme: arm wird nicht gerufen (und kein disarm)', t.aufrufe.arm.length === 0 && t.aufrufe.disarm === 0);
  ck(
    'RE-2 Companion ARM in der Aufnahme: Ablehnung mit Hinweis und Logzeile',
    json(t.aufrufe.ablehnung) === json([{ hinweis: 'Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.', log: 'Fernbefehl abgelehnt: ARM (Aufnahme läuft)' }]),
  );
  t.fernbefehl({ t: 'disarm' });
  await warte(20);
  ck('RE-2 Companion DISARM in der Aufnahme: disarm wird nicht gerufen', t.aufrufe.disarm === 0 && t.aufrufe.arm.length === 0);
  ck(
    'RE-2 Companion DISARM in der Aufnahme: Ablehnung mit Hinweis und Logzeile',
    json(t.aufrufe.ablehnung[1]) === json({ hinweis: 'Companion „DISARM“ abgelehnt: Erst die Aufnahme stoppen.', log: 'Fernbefehl abgelehnt: DISARM (Aufnahme läuft)' }),
  );
  ck('RE-2 Companion in der Aufnahme: der Zustand bleibt recording', t.useRec.getState().state.status === 'recording');
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.setzeZustand(OFFEN);
  t.fernbefehl({ t: 'arm' });
  await warte(20);
  ck('RE-2 ARM bei armed wirkt wie heute (arm 1×, keine Ablehnung)', t.aufrufe.arm.length === 1 && t.aufrufe.ablehnung.length === 0);
  t.fernbefehl({ t: 'disarm' });
  await warte(20);
  ck('RE-2 DISARM bei armed wirkt wie heute (disarm 1×, keine Ablehnung)', t.aufrufe.disarm === 1 && t.aufrufe.ablehnung.length === 0);
}
{
  // Der Main lehnt „Eingang schließen“ in der Aufnahme ab (Wettlauf): der Store zeigt den Grund und lässt die Pegel stehen.
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  (globalThis as unknown as { window: { jmrec: { disarm: () => Promise<unknown> } } }).window.jmrec.disarm = async () => ({ ok: false, error: 'Erst die Aufnahme stoppen.' });
  t.useRec.setState({ peaks: [0.5, 0.5] });
  await t.useRec.getState().disarm();
  ck('RE-2 disarm abgelehnt: der Store setzt notice mit dem Grund, die Pegel bleiben', t.useRec.getState().notice === 'Erst die Aufnahme stoppen.' && t.useRec.getState().peaks.length === 2);
}

// --- RE-2b: Companion RECORD ON ohne Zielordner wird abgelehnt; am Rechner öffnet sich kein Ordnerdialog.
{
  const t = await starte({ devices: [DANTE], geladen: ersterStart, pickDir: 'E:\\Gewaehlt' });
  t.setzeZustand(OFFEN);
  t.fernbefehl({ t: 'record', mode: 'on' });
  await warte(20);
  ck('RE-2b Companion RECORD ON ohne Zielordner: kein Ordnerdialog, keine Aufnahme', t.aufrufe.pickDir === 0 && t.aufrufe.start.length === 0 && t.useRec.getState().dir === null);
  ck(
    'RE-2b Companion RECORD ON ohne Zielordner: Ablehnung „Kein Zielordner gewählt.“',
    json(t.aufrufe.ablehnung) === json([{ hinweis: 'Companion „RECORD ON“ abgelehnt: Kein Zielordner gewählt.', log: 'Fernbefehl abgelehnt: RECORD ON (kein Zielordner)' }]),
  );
  t.fernbefehl({ t: 'record', mode: 'toggle' });
  await warte(20);
  ck('RE-2b Companion RECORD TOGGLE bei armed ohne Zielordner: kein Ordnerdialog, keine Aufnahme', t.aufrufe.pickDir === 0 && t.aufrufe.start.length === 0);
  ck(
    'RE-2b Companion RECORD TOGGLE ohne Zielordner: Ablehnung „Kein Zielordner gewählt.“',
    json(t.aufrufe.ablehnung[1]) === json({ hinweis: 'Companion „RECORD TOGGLE“ abgelehnt: Kein Zielordner gewählt.', log: 'Fernbefehl abgelehnt: RECORD TOGGLE (kein Zielordner)' }),
  );
  // Von Hand im Fenster bleibt der Dialog wie heute (Spec).
  await t.useRec.getState().record();
  ck('RE-2b von Hand: „Aufnahme“ ohne Zielordner öffnet weiter den Ordnerdialog und startet danach', t.aufrufe.pickDir === 1 && json(t.aufrufe.start.map((s) => s.dir)) === json(['E:\\Gewaehlt']));
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.setzeZustand(OFFEN);
  t.fernbefehl({ t: 'record', mode: 'on' });
  await warte(20);
  ck('RE-2b mit Zielordner: startRecording 1× wie heute, ohne Dialog und ohne Ablehnung', json(t.aufrufe.start.map((s) => s.dir)) === json(['D:\\VA']) && t.aufrufe.pickDir === 0 && t.aufrufe.ablehnung.length === 0);
  t.setzeZustand(AUFNAHME);
  t.useRec.setState({ dir: null });
  t.fernbefehl({ t: 'record', mode: 'off' });
  await warte(20);
  ck('RE-2b RECORD OFF wird nie abgelehnt, auch ohne Zielordner: stopRecording 1×', t.aufrufe.stop === 1 && t.aufrufe.ablehnung.length === 0);
}

// --- RE-7b: ein Netzwerkordner aus der Show gilt erst nach „Übernehmen“; bis dahin ist kein Ordner gesetzt.
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null }, show: { netzordnerOffen: NETZ } });
  await warte(10);
  const s = t.useRec.getState();
  ck('RE-7b Show mit netzordnerOffen (Kaltstart): dir null, netzordnerOffen gesetzt, kein Hinweis', s.dir === null && s.netzordnerOffen === NETZ && s.hinweisOrdner === null);
  ck('RE-7b Show mit netzordnerOffen: kein ordnerDa-Aufruf für den Netzwerkordner (kein Zugriff auf den Server)', !t.aufrufe.ordnerDa.includes(NETZ));
  await rufe(() => t.useRec.getState().netzordnerUebernehmen());
  const n = t.useRec.getState();
  ck('RE-7b netzordnerUebernehmen ruft netzordnerBestaetigen mit dem Pfad und setzt dir', json(t.aufrufe.bestaetigen) === json([NETZ]) && n.dir === NETZ && n.netzordnerOffen === null);
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.schickeShow({ netzordnerOffen: NETZ });
  ck('RE-7b Show mit netzordnerOffen (zur Laufzeit): dir null, netzordnerOffen gesetzt', t.useRec.getState().dir === null && t.useRec.getState().netzordnerOffen === NETZ);
  await rufe(() => t.useRec.getState().pickDir());
  ck('RE-7b pickDir ohne Wahl (Abbruch) lässt den Vorschlag stehen', t.useRec.getState().netzordnerOffen === NETZ && t.useRec.getState().dir === null);
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null }, pickDir: 'E:\\Neu' });
  t.schickeShow({ netzordnerOffen: NETZ });
  await rufe(() => t.useRec.getState().pickDir());
  ck('RE-7b pickDir leert netzordnerOffen (wer selbst wählt, hat entschieden)', t.useRec.getState().dir === 'E:\\Neu' && t.useRec.getState().netzordnerOffen === null);
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.schickeShow({ netzordnerOffen: NETZ });
  t.schickeShow({ netzordnerOffen: '\\\\nas\\y' });
  const zwei = t.useRec.getState();
  await rufe(() => t.useRec.getState().hinweiseSchliessen());
  const s = t.useRec.getState();
  ck('RE-7b ein zweiter Vorschlag ersetzt den ersten', zwei.netzordnerOffen === '\\\\nas\\y' && zwei.dir === null);
  ck('RE-7b × stellt den Ordner von vorher her (D1), auch nach zwei Vorschlägen', s.dir === 'D:\\VA' && s.netzordnerOffen === null && t.aufrufe.bestaetigen.length === 0);
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: { ...VOLL, dir: '\\\\NAS\\x\\' }, ordnerDa: null } });
  t.schickeShow({ netzordnerOffen: NETZ });
  await warte(10);
  const s = t.useRec.getState();
  ck('RE-7b gleicher Ordner gilt als bestätigt (D2): dir gesetzt, kein Vorschlag, kein Hinweis', s.dir === NETZ && s.netzordnerOffen === null && s.hinweisOrdner === null);
  ck('RE-7b gleicher Ordner gilt als bestätigt (D2): gemerkt wie nach „Übernehmen“ (netzordnerBestaetigen 1×)', json(t.aufrufe.bestaetigen) === json([NETZ]));
}
{
  const t = await starte({ devices: [DANTE, FOCUS], geladen: { einstellungen: VOLL, ordnerDa: null }, presets: [{ name: 'Fo', werte: pv() }] });
  t.schickeShow({ netzordnerOffen: NETZ });
  await t.useRec.getState().presetAnwenden('Fo');
  ck('RE-7b Preset mit Ordner beendet den Vorschlag', t.useRec.getState().dir === 'E:\\Show' && t.useRec.getState().netzordnerOffen === null);
}
{
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.schickeShow({ netzordnerOffen: NETZ });
  t.useRec.getState().setFileName('Neu');
  await warte(t.MERK_MS + 50);
  // Nur die eigenen Einträge (Dateiname „Neu“): frühere Fälle schreiben ihr spätes Merken in die jeweils aktuelle Attrappe.
  const eigene = t.gespeichert.filter((e) => e.fileName === 'Neu');
  ck(
    'RE-7b Einstellungen behalten den alten Ordner, solange die Frage offen ist (dir null, gespeichert wird der alte)',
    t.useRec.getState().dir === null && eigene.length === 1 && eigene[0].dir === 'D:\\VA',
  );
}
{
  // Review Focus 1: der Vorschlag kommt während der Aufnahme. Sie läuft weiter in ihren Ordner, nur der nächste Start hat keinen.
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: { ...VOLL, dir: 'E:\\Alt' }, ordnerDa: null } });
  t.setzeZustand({ ...AUFNAHME, filePath: 'E:\\Alt\\Tag.wav' });
  t.schickeShow({ netzordnerOffen: NETZ });
  await warte(20);
  ck('RE-7b Show-Vorschlag während der Aufnahme: kein disarm, kein stopRecording', t.aufrufe.disarm === 0 && t.aufrufe.stop === 0 && t.aufrufe.arm.length === 0);
  t.fernbefehl({ t: 'record', mode: 'off' });
  await warte(20);
  ck('RE-7b Show-Vorschlag während der Aufnahme: Companion RECORD OFF stoppt (stopRecording 1×)', t.aufrufe.stop === 1);
  t.setzeZustand(OFFEN);
  t.fernbefehl({ t: 'record', mode: 'on' });
  await warte(20);
  ck('RE-7b Show-Vorschlag während der Aufnahme: danach RECORD ON startet nicht (startRecording 0×, kein Dialog)', t.aufrufe.start.length === 0 && t.aufrufe.pickDir === 0);
  ck(
    'RE-7b Show-Vorschlag während der Aufnahme: Ablehnung „Der Netzwerkordner aus der Show ist noch nicht bestätigt.“',
    json(t.aufrufe.ablehnung) ===
      json([{ hinweis: 'Companion „RECORD ON“ abgelehnt: Der Netzwerkordner aus der Show ist noch nicht bestätigt.', log: 'Fernbefehl abgelehnt: RECORD ON (Netzwerkordner aus der Show nicht bestätigt)' }]),
  );
  t.useRec.getState().setFileName('Tag 2');
  await warte(t.MERK_MS + 50);
  const eigene = t.gespeichert.filter((e) => e.fileName === 'Tag 2');
  ck('RE-7b Show-Vorschlag während der Aufnahme: gespeichert bleibt der alte Ordner E:\\Alt', eigene.length === 1 && eigene[0].dir === 'E:\\Alt');
}
{
  // Ungültiger Ordner aus der Show: Hinweis, der Ordner bleibt.
  const t = await starte({ devices: [DANTE], geladen: { einstellungen: VOLL, ordnerDa: null } });
  t.schickeShow({ ordnerUngueltig: '\\\\?\\C:\\x' });
  const s = t.useRec.getState();
  ck('RE-7b ungültiger Show-Ordner: Hinweis nennt den Pfad, dir bleibt', s.hinweisOrdner === 'Zielordner aus der Show ist kein gültiger Ordner und wurde nicht übernommen: \\\\?\\C:\\x' && s.dir === 'D:\\VA' && s.netzordnerOffen === null);
}

// --- RE-NAS: die Ordnerprüfung eines Presets läuft außerhalb der Warteschlange (Spec Abschnitt 8; Pre-flight K6).
const NI = pv({ eingang: { name: MME.name, hostApiName: 'MME' }, channels: 2, sampleRate: 44100, dir: NETZ });
{
  const t = await starte({
    devices: [DANTE, FOCUS, MME], geladen: ersterStart,
    presets: [{ name: 'Fo', werte: pv() }, { name: 'Mi', werte: NI }],
    ordnerDaFn: (d) => (d === 'E:\\Show' ? new Promise<boolean>(() => {}) : Promise.resolve(true)),
  });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  void t.useRec.getState().presetAnwenden('Fo');
  void t.useRec.getState().presetAnwenden('Mi');
  await warte(60);
  const geraete = (t.aufrufe.arm as { device: number }[]).map((a) => a.device);
  ck(`RE-NAS langsame Ordnerprüfung hält das nächste Preset nicht auf (arm: ${geraete.join(',')})`, geraete.includes(0) && t.useRec.getState().aktivesPreset === 'Mi');
}
{
  let antworteFo: (v: boolean) => void = () => {};
  const t = await starte({
    devices: [DANTE, FOCUS, MME], geladen: ersterStart,
    presets: [{ name: 'Fo', werte: pv() }, { name: 'Mi', werte: NI }],
    ordnerDaFn: (d) => (d === 'E:\\Show' ? new Promise<boolean>((r) => { antworteFo = r; }) : Promise.resolve(true)),
  });
  t.setzeZustand({ status: 'armed', device: 7, channels: 2, sampleRate: 48000 });
  const fo = t.useRec.getState().presetAnwenden('Fo');
  const mi = t.useRec.getState().presetAnwenden('Mi');
  await warte(60);
  const vorher = t.useRec.getState().dir;
  antworteFo(false);
  await Promise.all([fo, mi]);
  await warte(10);
  const s = t.useRec.getState();
  ck(
    `RE-NAS späte Antwort für einen alten Ordner überschreibt den Hinweis nicht (dir vor der Antwort: ${vorher})`,
    vorher === NETZ && s.dir === NETZ && !(s.hinweisOrdner ?? '').includes('E:\\Show'),
  );
}
{
  const t = await starte({
    devices: [DANTE], geladen: ersterStart,
    presets: [{ name: 'A', werte: pv({ eingang: undefined, gainDb: 3 }) }, { name: 'B', werte: pv({ eingang: undefined, gainDb: 6 }) }],
    ordnerDaFn: () => warte(30).then(() => true),
  });
  await Promise.all([t.useRec.getState().presetAnwenden('A'), t.useRec.getState().presetAnwenden('B')]);
  const n = t.aufrufe.ordnerDa.filter((d) => d === 'E:\\Show').length;
  ck(`RE-NAS zwei Prüfungen desselben Pfads zugleich: ein ordnerDa-Aufruf (${n})`, n === 1 && t.useRec.getState().gainDb === 6);
}
{
  // K6: ein Netzwerkordner eines Presets gilt erst, wenn seine Prüfung geantwortet hat; das Übrige des Presets wirkt sofort.
  let antworte: (v: boolean) => void = () => {};
  const t = await starte({
    devices: [DANTE], geladen: { einstellungen: { dir: 'D:\\VA' }, ordnerDa: null },
    presets: [{ name: 'N', werte: pv({ eingang: undefined, dir: NETZ, gainDb: 9 }) }],
    ordnerDaFn: (d) => (d === NETZ ? new Promise<boolean>((r) => { antworte = r; }) : Promise.resolve(true)),
  });
  const lauf = t.useRec.getState().presetAnwenden('N');
  await warte(20);
  const offen = t.useRec.getState();
  ck('RE-NAS Netzwerkordner gilt erst nach der Prüfung: vorher bleibt der alte Ordner, Verstärkung und Preset wirken sofort', offen.dir === 'D:\\VA' && offen.gainDb === 9 && offen.aktivesPreset === 'N');
  antworte(false);
  await lauf;
  const s = t.useRec.getState();
  ck('RE-NAS Netzwerkordner gilt erst nach der Prüfung: nach der Antwort gesetzt, mit Hinweis, wenn er nicht erreichbar ist', s.dir === NETZ && (s.hinweisOrdner ?? '').includes('Zielordner des Presets „N“ nicht erreichbar: \\\\nas\\x'));
}
{
  // K6: wählt jemand inzwischen etwas Neueres (Preset mit lokalem Ordner, Ordnerdialog), setzt die späte Antwort den Netzwerkordner nicht.
  let antworte: (v: boolean) => void = () => {};
  const t = await starte({
    devices: [DANTE], geladen: { einstellungen: { dir: 'D:\\VA' }, ordnerDa: null }, pickDir: 'F:\\Hand',
    presets: [{ name: 'N', werte: pv({ eingang: undefined, dir: NETZ }) }, { name: 'L', werte: pv({ eingang: undefined, dir: 'E:\\Show' }) }],
    ordnerDaFn: (d) => (d === NETZ ? new Promise<boolean>((r) => { antworte = r; }) : Promise.resolve(true)),
  });
  const n = t.useRec.getState().presetAnwenden('N');
  await warte(10);
  // Begrenzt gewartet: hinge „L“ hinter der Prüfung von „N“, käme es nie an (dann rot statt eines hängenden Laufs).
  await Promise.race([t.useRec.getState().presetAnwenden('L'), warte(200)]);
  ck('RE-NAS ein nächstes Preset wirkt sofort, während die Prüfung des Netzwerkordners hängt', t.useRec.getState().dir === 'E:\\Show' && t.useRec.getState().aktivesPreset === 'L');
  antworte(true);
  await n;
  await warte(10);
  ck('RE-NAS die späte Antwort setzt den Netzwerkordner nicht, wenn inzwischen ein Preset gewählt wurde', t.useRec.getState().dir === 'E:\\Show');
  const n2 = t.useRec.getState().presetAnwenden('N');
  await warte(10);
  await t.useRec.getState().pickDir();
  antworte(true);
  await n2;
  await warte(10);
  ck('RE-NAS die späte Antwort setzt den Netzwerkordner nicht, wenn inzwischen im Dialog gewählt wurde', t.useRec.getState().dir === 'F:\\Hand');
}

console.log(`\nstore: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
