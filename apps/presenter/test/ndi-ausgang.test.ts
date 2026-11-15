// #303: NDI-Ausgang im Main – Schalter (userData), Fenster- und Senderleben, Empfängerzahl, Fehlerfall,
// Payload-Weitergabe ans NDI-Fenster. Fenster, Sender-Prozess und Electron sind Attrappen.
// npm run selftest -w @jm/presenter
Object.defineProperty(process, 'platform', { value: 'win32' }); // CI läuft unter Linux
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NdiLage, NdiStatus, PresentationPayload } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Eingespeiste Fristen (statt 10 s Start-Frist und 60 s Absturz-Fenster). */
const FRIST = 40, ABSTURZ = 60;

type Schein = { once(e: string, cb: () => void): void; isDestroyed(): boolean; webContents: object };
type Meldungen = { bereit(): void; fehler(g: string): void; empfaenger(n: number): void; beendet(c: number): void };
type FakeKind = { getoetet: number };
const g = globalThis as unknown as {
  __w: {
    aktuell: Schein | null; offen: number; zu: number; closed: (() => void) | null; absturz: ((grund: string) => void) | null;
    anNdi: [string, unknown][]; status: unknown[]; publikum: unknown[];
  };
  __s: { m: Meldungen | null; gestartet: number; gestoppt: number; verbunden: number; datei: boolean; wirft: boolean; kindLaeuft: boolean };
  __sp: { initWirft: boolean; kinder: FakeKind[] };
  __app: Record<string, () => void>;
  __ipc: { zu: string[]; initWirft: boolean; status: NdiStatus; h: Record<string, (...a: unknown[]) => unknown> };
  __userData: string;
};
const w = (g.__w = { aktuell: null, offen: 0, zu: 0, closed: null, absturz: null, anNdi: [], status: [], publikum: [] });
const s = (g.__s = { m: null, gestartet: 0, gestoppt: 0, verbunden: 0, datei: true, wirft: false, kindLaeuft: false });
g.__sp = { initWirft: false, kinder: [] };
g.__app = {};
g.__ipc = { zu: [], initWirft: false, status: { an: false, lage: 'aus', empfaenger: 0, grund: null }, h: {} };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmpr-ndi-'));
g.__userData = dir;
const datei = path.join(dir, 'ndi-config.json');

// Log-Zeilen des Ausgangs mitschreiben statt ausgeben (sauberer Testlauf, und die Zeile selbst wird geprüft).
const logZeilen: string[] = [];
const echtesError = console.error;
console.error = (...a: unknown[]) => { logZeilen.push(a.map(String).join(' ')); };

const FENSTER = `
const w = globalThis.__w;
export function openNdiWindow() {
  if (!w.aktuell) {
    const webContents = {
      on: (e, cb) => { if (e === 'render-process-gone') w.absturz = (grund) => cb({}, { reason: grund, exitCode: 1 }); },
    };
    w.aktuell = { once: (e, cb) => { if (e === 'closed') w.closed = cb; }, isDestroyed: () => false, webContents };
    w.offen++;
  }
  return w.aktuell;
}
export function closeNdiWindow() { if (w.aktuell) w.zu++; w.aktuell = null; }
export function getNdiWindow() { return w.aktuell; }
export function sendeAnNdi(c, x) { w.anNdi.push([c, x]); }
export function broadcastAll(c, x) { if (c === 'ndi:status') w.status.push(x); }
export function closePresentationWindows() {}
export function openAudienceWindow(ziel) { w.publikum.push(ziel); }
export function openPresenterWindow() {}
export function setPresentationClosedHandler() {}
export function getDisplays() { return []; }
export function getEditorWindow() { return null; }
export function moveAudienceToDisplay() {}
export function toggleAudienceFullscreen() { return false; }`;
// Sender-Attrappe: `wirft` = Wurf beim init NACH dem Fork – das Kind läuft dann schon.
const SENDER = `
const s = globalThis.__s;
export function starteSender(m) {
  s.m = m; s.gestartet++;
  if (s.wirft) { s.kindLaeuft = true; throw new Error('init scheitert\\nDetails'); }
  if (s.datei) s.kindLaeuft = true;
  return s.datei;
}
export function verbindeFenster() { s.verbunden++; }
export function stoppeSender() { s.gestoppt++; s.kindLaeuft = false; }`;
// Für ipc.ts (letzter Teil): alles, was registerIpc außer NDI braucht, als stumme Attrappe.
const IPC_TEILE: Record<string, string> = {
  './dateien-laden': 'export function ladeDateien() {} export function pruefeImportPfade() { return null; }',
  './office/import': 'export function importOfficeFile() {}',
  '@shared/dateien': 'export const IMAGE_EXT = new Set(); export const OFFICE_EXT = new Set();',
  './remote': `export function applyRemoteConfig() {} export function getRemoteStatus() {} export function listInterfaces() { return []; }
    export function setRemoteStatusHandler() {} export function shutdownRemote() { globalThis.__ipc.zu.push('remote'); }`,
  './remote-config': 'export function loadRemoteConfig() { return { enabled: false }; } export function saveRemoteConfig() {}',
  './timer-sync': `export function applyTimerConfig() {} export function getTimerConfig() {} export function getTimerState() {}
    export function setTimerStateHandler() {} export function shutdownTimer() { globalThis.__ipc.zu.push('timer'); }`,
  './timer-config': 'export function loadTimerConfig() { return {}; } export function saveTimerConfig() {}',
  './ndi/ausgang': `export function beendeNdi() { globalThis.__ipc.zu.push('ndi'); } export function ndiFensterBereit() {}
    export function ndiStatus() { return globalThis.__ipc.status; } export function setzeNdiAn() {}
    export function initNdiAusgang() { if (globalThis.__ipc.initWirft) throw new Error('init wirft'); }`,
};
// Für config.ts reicht `app`; das echte windows.ts (zweiter Teil) braucht dazu Fenster und Bildschirm.
// Ein Fenster schließt wie in Electron erst später: close() merkt vor, raeumeAuf() feuert die `closed`.
const ELECTRON = `
export const app = { getPath: () => globalThis.__userData, isPackaged: false, on: (e, cb) => { globalThis.__app[e] = cb; } };
export const shell = { openExternal() {} };
export const dialog = {};
export const ipcMain = { handle(k, f) { globalThis.__ipc.h[k] = f; }, on() {} };
// Echter sender-process.ts: fork liefert ein Schein-Kind; \`initWirft\` lässt das init-postMessage werfen.
export const utilityProcess = {
  fork() {
    const k = { getoetet: 0, on() {}, kill() { k.getoetet++; },
      postMessage(m) { if (m && m.type === 'init' && globalThis.__sp.initWirft) throw new Error('init scheitert'); } };
    globalThis.__sp.kinder.push(k);
    return k;
  },
};
export class MessageChannelMain { constructor() { this.port1 = {}; this.port2 = { on() {}, start() {}, close() {} }; } }
const anzeige = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
export const screen = { getPrimaryDisplay: () => anzeige, getAllDisplays: () => [anzeige] };
const alle = [];
const schliessend = new Set();
export class BrowserWindow {
  constructor(opts) {
    this.opts = opts; this.zu = {}; this.wcZu = {}; this.weg = false; this.gesendet = []; this.suche = null;
    this.webContents = { on: (e, cb) => { (this.wcZu[e] ??= []).push(cb); }, setWindowOpenHandler() {}, getURL: () => '',
      send: (c, x) => this.gesendet.push([c, x]) };
    alle.push(this);
  }
  static getAllWindows() { return alle.filter((w) => !w.weg); }
  static raeumeAuf() {
    while (schliessend.size) {
      const [w] = schliessend; schliessend.delete(w); w.weg = true;
      for (const cb of w.zu.closed ?? []) cb();
    }
  }
  on(e, cb) { (this.zu[e] ??= []).push(cb); return this; }
  once(e, cb) { return this.on(e, cb); }
  loadURL() { return Promise.resolve(); }
  loadFile(_p, o) { this.suche = o?.search ?? null; return Promise.resolve(); }
  isDestroyed() { return this.weg; }
  close() { if (!this.weg) schliessend.add(this); }
}`;
const ATTRAPPEN: Record<string, [string, string]> = {
  './windows': ['mock:windows', FENSTER],
  '../windows': ['mock:windows', FENSTER],
  './sender-process': ['mock:sender', SENDER],
  electron: ['mock:electron', ELECTRON],
  ...Object.fromEntries(Object.entries(IPC_TEILE).map(([spec, q]) => [spec, [`mock:ipc:${spec}`, q] as [string, string]])),
};
const QUELLEN = new Map(Object.values(ATTRAPPEN));
registerHooks({
  resolve(spec, ctx, next) {
    const a = ATTRAPPEN[spec];
    if (a) return { url: a[0], shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    const q = QUELLEN.get(url);
    if (q) return { format: 'module', source: q, shortCircuit: true };
    return next(url, ctx);
  },
});

const cfg = await import('../src/main/ndi/config');
const a = await import('../src/main/ndi/ausgang');
const p = await import('../src/main/present');
const ndi = await import('../src/shared/ndi');
/** Kommt gerade ein Bild bei den NDI-Empfängern an? */
const liefert = (): boolean => ndi.ndiLiefertBild(a.ndiStatus());

const folie = (id: string, pageIndex: number) => ({ id, sourceId: 'q', pageIndex, title: id, notes: '', hidden: false, overlays: [] });
const payload: PresentationPayload = {
  slides: [folie('a', 0), folie('b', 1)],
  sources: { q: { kind: 'pdf', bytes: Uint8Array.of(37, 80, 68, 70) } },
  images: {},
  startIndex: 0,
};

try {
  ck('ohne Datei → aus', eq(cfg.ladeNdiConfig(), { an: false }));
  fs.writeFileSync(datei, 'kaputt'); ck('Müll → aus', eq(cfg.ladeNdiConfig(), { an: false }));
  fs.writeFileSync(datei, '{"an":"ja"}'); ck('kein echtes true → aus', eq(cfg.ladeNdiConfig(), { an: false }));
  fs.writeFileSync(datei, '{"an":true}'); a.initNdiAusgang({ startFristMs: FRIST, absturzFensterMs: ABSTURZ });
  ck('gemerkt an → Sender und Fenster ab App-Start', s.gestartet === 1 && w.offen === 1 && a.ndiStatus().lage === 'startet');
  ck('startet → noch kein Bild', !liefert() && w.status.length === 1);
  s.m!.bereit();
  ck('Erststart: Sender bereit, Fenster noch nicht → bleibt startet, kein Bild', a.ndiStatus().lage === 'startet' && !liefert() && s.verbunden === 0);
  a.ndiFensterBereit();
  ck('… Fenster bereit → Port verbunden, sendet, liefert Bild', s.verbunden === 1 && a.ndiStatus().lage === 'sendet' && liefert());
  const vor = w.status.length; s.m!.empfaenger(2); s.m!.empfaenger(2);
  ck('Empfängerzahl einmal gemeldet', a.ndiStatus().empfaenger === 2 && w.status.length === vor + 1);
  ck('Status-Push trägt den Stand', eq(w.status.at(-1), { an: true, lage: 'sendet', empfaenger: 2, grund: null }));
  p.startPresentation(payload, null); p.next();
  ck('Präsentationsstart → Folien genau einmal ans NDI-Fenster', w.anNdi.filter(([c, x]) => c === 'present:payload' && x === payload).length === 1);
  p.stopPresentation(); ck('Stopp → null ans NDI-Fenster', eq(w.anNdi.at(-1), ['present:payload', null]));
  const gestopptVorFehler = s.gestoppt;
  s.m!.fehler('Addon fehlt');
  ck('Fehler → nicht verfügbar mit Grund, kein Wurf', a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund!.includes('Addon fehlt') && !liefert());
  ck('Fehler → toter Sender wird beendet, NDI-Fenster zu (es zeichnete sonst weiter ins Leere)', s.gestoppt === gestopptVorFehler + 1 && w.zu === 1 && w.aktuell === null);
  ck('Fehler → eine Log-Zeile [ndi]', logZeilen.length === 1 && logZeilen[0].startsWith('[ndi]') && logZeilen[0].includes('Addon fehlt'));
  s.m!.beendet(1);
  ck('Nachzügler nach dem Fehler ändert nichts', a.ndiStatus().grund === 'Addon fehlt' && logZeilen.length === 1);
  a.ndiFensterBereit(); ck('Nachzügler „Fenster bereit“ ohne Sender und Fenster → kein Port', s.verbunden === 1);
  p.startPresentation(payload, null); ck('Präsentation unberührt', p.getState().active); p.stopPresentation();
  a.setzeNdiAn(false);
  ck('aus → Sender gestoppt, Fenster zu, gemerkt', s.gestoppt >= 1 && w.zu === 1 && a.ndiStatus().lage === 'aus' && eq(JSON.parse(fs.readFileSync(datei, 'utf8')), { an: false }));
  const anNdiAus = w.anNdi.length; p.startPresentation(payload, null);
  ck('NDI aus → keine Folien ans NDI-Fenster', w.anNdi.length === anNdiAus);
  const alterRueckruf = w.closed!; a.setzeNdiAn(true); const g1 = s.gestoppt; alterRueckruf();
  ck('schnelles Aus/An: closed des alten Fensters beendet den neuen Sender nicht', s.gestoppt === g1);
  ck('Einschalten während der Präsentation → kein Doppel, Fenster holt die laufende selbst', w.anNdi.length === anNdiAus);
  ck('an → gemerkt', eq(JSON.parse(fs.readFileSync(datei, 'utf8')), { an: true }));
  p.next(); ck('Folienwechsel mit demselben Payload → nichts Neues ans NDI-Fenster', w.anNdi.length === anNdiAus);
  p.stopPresentation(); ck('Stopp nach dem Einschalten → null ans NDI-Fenster', eq(w.anNdi.at(-1), ['present:payload', null]));
  const st0 = s.gestartet; a.setzeNdiAn(true); ck('an, wenn schon gestartet → kein zweiter Sender', s.gestartet === st0);
  s.m!.beendet(3);
  ck('Sender endet → nicht verfügbar, NDI-Fenster zu', a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Sender beendet (Code 3).' && w.aktuell === null);
  const [o1, st1, v1] = [w.offen, s.gestartet, s.verbunden]; a.setzeNdiAn(true);
  ck('Neustart nach dem Ende: neuer Sender, neues Fenster, Port erst, wenn es sich meldet', s.gestartet === st1 + 1 && w.offen === o1 + 1 && s.verbunden === v1);
  ck('Neustart → startet', a.ndiStatus().lage === 'startet' && a.ndiStatus().grund === null);
  const gestoppt = s.gestoppt; w.aktuell = null; w.closed!(); ck('NDI-Fenster zu (letztes Fenster geschlossen) → Sender gestoppt', s.gestoppt > gestoppt);
  a.setzeNdiAn(false); s.datei = false; const offen = w.offen; a.setzeNdiAn(true);
  ck('Sender-Datei fehlt → nicht verfügbar, kein Fenster', a.ndiStatus().grund === 'NDI-Sender fehlt im Paket.' && w.offen === offen);
  a.setzeNdiAn(false); s.datei = true; s.wirft = true; const logWurf = logZeilen.length; a.setzeNdiAn(true);
  ck('Sender-Start wirft → nicht verfügbar mit erster Zeile, kein Fenster', a.ndiStatus().grund === 'NDI-Sender startet nicht: init scheitert' && w.offen === offen);
  ck('Wurf beim init nach dem Fork → kein laufendes Kind, genau eine [ndi]-Zeile', !s.kindLaeuft && logZeilen.length === logWurf + 1);
  a.setzeNdiAn(false); s.wirft = false; Object.defineProperty(process, 'platform', { value: 'darwin' }); const st = s.gestartet; a.setzeNdiAn(true);
  ck('Mac → nicht verfügbar, kein Sender', a.ndiStatus().grund === 'NDI-Ausgang gibt es nur unter Windows.' && s.gestartet === st);
  ck('jeder Übergang nach „nicht verfügbar“ → eine Log-Zeile', logZeilen.length === 5 && logZeilen.every((z) => z.startsWith('[ndi] nicht verfügbar:')));
  ck('ndiLiefertBild nur bei an + sendet', ndi.ndiLiefertBild({ an: true, lage: 'sendet', empfaenger: 0, grund: null }) && !ndi.ndiLiefertBild({ an: false, lage: 'sendet', empfaenger: 0, grund: null }) && !ndi.ndiLiefertBild({ an: true, lage: 'startet', empfaenger: 0, grund: null }));
  ck('NDI_STATUS_AUS', eq(ndi.NDI_STATUS_AUS, { an: false, lage: 'aus', empfaenger: 0, grund: null }));

  // ---- Härtung: Start-Frist (eingespeist statt 10 s) ----
  Object.defineProperty(process, 'platform', { value: 'win32' });
  a.setzeNdiAn(false);
  let log0 = logZeilen.length;
  a.setzeNdiAn(true); const mFrist = s.m!;
  ck('Start → startet, Kind läuft', a.ndiStatus().lage === 'startet' && s.kindLaeuft);
  await warte(FRIST * 2 + 20);
  ck('weder bereit noch fehler binnen Frist → nicht verfügbar „NDI-Sender antwortet nicht.“',
    a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Sender antwortet nicht.');
  ck('… Sender beendet, Fenster zu, genau eine [ndi]-Zeile', !s.kindLaeuft && w.aktuell === null && eq(logZeilen.slice(log0), ['[ndi] nicht verfügbar: NDI-Sender antwortet nicht.']));
  mFrist.bereit(); ck('spätes bereit nach Ablauf → ignoriert', a.ndiStatus().lage === 'nicht-verfuegbar');
  a.setzeNdiAn(true); s.m!.bereit(); a.ndiFensterBereit(); await warte(FRIST * 2 + 20);
  ck('Sender und Fenster bereit vor Ablauf → sendet bleibt', a.ndiStatus().lage === 'sendet' && s.kindLaeuft);
  // Review Focus 5: „Keiner – nur NDI“ läuft, dann fällt NDI aus bzw. wird ausgeschaltet → die Präsentation läuft weiter.
  p.startPresentation(payload, 'keiner'); s.m!.fehler('Addon fehlt');
  ck('nur NDI: Sender fällt aus → Präsentation läuft weiter', a.ndiStatus().lage === 'nicht-verfuegbar' && p.getState().active);
  a.setzeNdiAn(true); s.m!.bereit(); a.setzeNdiAn(false);
  ck('nur NDI: NDI aus → Präsentation läuft weiter', a.ndiStatus().lage === 'aus' && p.getState().active);
  p.stopPresentation();
  a.setzeNdiAn(false); log0 = logZeilen.length; a.setzeNdiAn(true); s.m!.fehler('Addon fehlt'); await warte(FRIST * 2 + 20);
  ck('fehler vor Ablauf → nur dessen Zeile', a.ndiStatus().grund === 'Addon fehlt' && logZeilen.length === log0 + 1);
  a.setzeNdiAn(false); log0 = logZeilen.length; a.setzeNdiAn(true); a.setzeNdiAn(false); await warte(FRIST * 2 + 20);
  ck('aus vor Ablauf → keine Frist-Meldung', a.ndiStatus().lage === 'aus' && logZeilen.length === log0);
  // `sendet` erst, wenn Sender UND Fenster bereit sind, gleich in welcher Reihenfolge; die Frist läuft, bis beides da ist.
  a.setzeNdiAn(true); const vFb = s.verbunden; a.ndiFensterBereit();
  ck('Fenster vor dem Sender bereit → Port schon verbunden, bleibt startet', s.verbunden === vFb + 1 && a.ndiStatus().lage === 'startet');
  s.m!.bereit(); ck('… dann Sender bereit → sendet', a.ndiStatus().lage === 'sendet');
  a.setzeNdiAn(false); log0 = logZeilen.length; const zFb = w.zu; a.setzeNdiAn(true); s.m!.bereit(); await warte(FRIST * 2 + 20);
  ck('Sender bereit, Fenster meldet sich nie → nach der Frist nicht verfügbar „NDI-Bild antwortet nicht.“',
    a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Bild antwortet nicht.');
  ck('… genau eine [ndi]-Zeile, Fenster zu, Sender beendet',
    eq(logZeilen.slice(log0), ['[ndi] nicht verfügbar: NDI-Bild antwortet nicht.']) && w.aktuell === null && w.zu === zFb + 1 && !s.kindLaeuft);
  a.setzeNdiAn(false);

  // ---- Härtung: Renderer des NDI-Fensters stirbt (render-process-gone) ----
  a.setzeNdiAn(true); s.m!.bereit(); a.ndiFensterBereit();
  p.startPresentation(payload, null);
  ck('Ausgang vor dem Absturz: sendet, Präsentation läuft', a.ndiStatus().lage === 'sendet' && p.getState().active);
  const [o0, z0, st0b, sp0, v0] = [w.offen, w.zu, s.gestartet, s.gestoppt, s.verbunden];
  log0 = logZeilen.length;
  const absturzAlt = w.absturz; const closedAlt = w.closed!;
  absturzAlt?.('crashed');
  ck('Absturz → eine [ndi]-Zeile mit Grund', eq(logZeilen.slice(log0), ['[ndi] NDI-Bild abgestürzt: crashed']));
  ck('Absturz → NDI-Fenster zu und neu, Sender läuft weiter',
    w.zu === z0 + 1 && w.offen === o0 + 1 && s.gestartet === st0b && s.gestoppt === sp0 && s.kindLaeuft);
  ck('Absturz → startet, bis das neue Fenster bereit ist', a.ndiStatus().lage === 'startet' && !liefert());
  closedAlt(); ck('closed des abgestürzten Fensters beendet den Sender nicht', s.gestoppt === sp0 && s.kindLaeuft);
  absturzAlt?.('crashed'); ck('Nachzügler des alten Fensters ändert nichts', logZeilen.length === log0 + 1 && w.offen === o0 + 1);
  const anNdiVor = w.anNdi.length; p.next();
  ck('neues Fenster holt das laufende Payload selbst, kein Doppel', w.anNdi.length === anNdiVor);
  a.ndiFensterBereit();
  ck('neues Fenster bereit → neuer Port, sendet', s.verbunden === v0 + 1 && a.ndiStatus().lage === 'sendet');
  p.stopPresentation(); ck('Payload-Weitergabe geht ans neue Fenster', eq(w.anNdi.at(-1), ['present:payload', null]));
  const o1b = w.offen; log0 = logZeilen.length;
  w.absturz?.('oom');
  ck('zweiter Absturz binnen Frist → nicht verfügbar „NDI-Bild abgestürzt.“',
    a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Bild abgestürzt.');
  ck('… kein neues Fenster, Sender gestoppt', w.offen === o1b && w.aktuell === null && !s.kindLaeuft);
  ck('… Zeilen: Absturz mit Grund, dann nicht verfügbar',
    eq(logZeilen.slice(log0), ['[ndi] NDI-Bild abgestürzt: oom', '[ndi] nicht verfügbar: NDI-Bild abgestürzt.']));
  a.setzeNdiAn(true); s.m!.bereit(); a.ndiFensterBereit(); await warte(ABSTURZ + 30);
  const o2b = w.offen; w.absturz?.('crashed');
  ck('Absturz nach Ablauf des Absturz-Fensters → wieder neu geöffnet', w.offen === o2b + 1 && a.ndiStatus().lage === 'startet');
  log0 = logZeilen.length; const zEf = w.zu; await warte(FRIST * 2 + 20);
  ck('Ersatzfenster meldet sich nie → nach der Frist nicht verfügbar „NDI-Bild antwortet nicht.“',
    a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Bild antwortet nicht.');
  ck('… genau eine [ndi]-Zeile, Ersatzfenster zu, Sender beendet',
    eq(logZeilen.slice(log0), ['[ndi] nicht verfügbar: NDI-Bild antwortet nicht.']) && w.aktuell === null && w.zu === zEf + 1 && !s.kindLaeuft);
  a.setzeNdiAn(false); a.setzeNdiAn(true); s.m!.bereit(); a.ndiFensterBereit();
  const o3b = w.offen; w.absturz?.('crashed');
  ck('nach Aus zählt ein Absturz wieder als erster', w.offen === o3b + 1 && a.ndiStatus().lage === 'startet');
  a.setzeNdiAn(false); a.setzeNdiAn(true); s.m!.fehler('Addon fehlt');
  const o4b = w.offen; w.absturz?.('crashed');
  ck('Absturz-Nachzügler des mit dem Sender geschlossenen Fensters → kein neues Fenster, Status bleibt „nicht verfügbar“',
    w.offen === o4b && w.aktuell === null && a.ndiStatus().grund === 'Addon fehlt');
  a.setzeNdiAn(true);
  ck('… Neustart danach → neuer Sender, neues Fenster, startet', w.offen === o4b + 1 && a.ndiStatus().lage === 'startet');
  s.m!.bereit(); a.ndiFensterBereit(); ck('… sendet, sobald beide bereit sind', a.ndiStatus().lage === 'sendet');
  a.setzeNdiAn(false);

  // ---- Das echte windows.ts: NDI-Fenster, Rundruf, App-Ende mit dem letzten sichtbaren Fenster ----
  Object.defineProperty(process, 'platform', { value: 'win32' });
  (globalThis as { __dirname?: string }).__dirname = dir; // windows.ts ist CJS-gebaut und rechnet mit __dirname
  type ScheinFenster = {
    opts: { show?: boolean; width?: number; height?: number; skipTaskbar?: boolean; title?: string; webPreferences?: Record<string, unknown> };
    gesendet: [string, unknown][]; suche: string | null; isDestroyed(): boolean; close(): void;
    wcZu: Record<string, ((...a: unknown[]) => void)[]>;
  };
  const el = (await import('electron')) as unknown as { BrowserWindow: { getAllWindows(): ScheinFenster[]; raeumeAuf(): void } };
  const wm = (await import('../src/main/windows')) as unknown as {
    openNdiWindow(): ScheinFenster; closeNdiWindow(): void; getNdiWindow(): ScheinFenster | null; sendeAnNdi(c: string, x: unknown): void;
    broadcastAll(c: string, x: unknown): void; createEditorWindow(): ScheinFenster; openPresenterWindow(): ScheinFenster;
    openAudienceWindow(id: number | null): ScheinFenster;
  };
  const n1 = wm.openNdiWindow();
  ck('NDI-Fenster: versteckt, 1920×1080, ohne Taskleiste, ohne Drosselung, Sandbox, Ansicht ndi',
    n1.opts.show === false && n1.opts.width === 1920 && n1.opts.height === 1080 && n1.opts.skipTaskbar === true
    && n1.opts.title === 'JM Presenter · NDI' && n1.opts.webPreferences?.backgroundThrottling === false
    && n1.opts.webPreferences?.sandbox === true && n1.suche === 'view=ndi');
  ck('offenes NDI-Fenster wird wiederverwendet', wm.openNdiWindow() === n1 && wm.getNdiWindow() === n1);
  const e1 = wm.createEditorWindow();
  wm.broadcastAll('ndi:status', 1); wm.sendeAnNdi('present:payload', 2);
  ck('Rundruf erreicht auch das NDI-Fenster', eq(n1.gesendet[0], ['ndi:status', 1]) && eq(e1.gesendet, [['ndi:status', 1]]));
  ck('sendeAnNdi nur ans NDI-Fenster', eq(n1.gesendet[1], ['present:payload', 2]));
  wm.closeNdiWindow();
  ck('closeNdiWindow: Verweis sofort weg, noch vor closed', wm.getNdiWindow() === null && !n1.isDestroyed());
  const n2 = wm.openNdiWindow(); el.BrowserWindow.raeumeAuf();
  ck('schnelles Aus/An: closed des alten Fensters löscht den neuen Verweis nicht', n1.isDestroyed() && wm.getNdiWindow() === n2 && n2 !== n1);
  wm.closeNdiWindow(); wm.sendeAnNdi('present:payload', 3); el.BrowserWindow.raeumeAuf();
  ck('ohne NDI-Fenster: sendeAnNdi still', n2.gesendet.length === 0);
  const n3 = wm.openNdiWindow();
  e1.close(); el.BrowserWindow.raeumeAuf();
  ck('Editor als letztes sichtbares Fenster zu → NDI-Fenster geht mit, kein Fenster bleibt',
    n3.isDestroyed() && wm.getNdiWindow() === null && el.BrowserWindow.getAllWindows().length === 0);
  const e2 = wm.createEditorWindow(); const ref = wm.openPresenterWindow(); const pub = wm.openAudienceWindow(null); const n4 = wm.openNdiWindow();
  e2.close(); el.BrowserWindow.raeumeAuf();
  ck('Editor zu, Präsentation läuft → NDI bleibt', !n4.isDestroyed() && wm.getNdiWindow() === n4);
  pub.close(); el.BrowserWindow.raeumeAuf();
  ck('Publikum zu, Referent offen → NDI bleibt', !n4.isDestroyed());
  ref.close(); el.BrowserWindow.raeumeAuf();
  ck('letztes sichtbares Fenster (Referent) zu → NDI-Fenster geht mit', n4.isDestroyed() && el.BrowserWindow.getAllWindows().length === 0);

  // Diagnose des versteckten Fensters: nur seine [ndi]-Warnungen/-Fehler ins Main-Log, dieselbe Zeile höchstens alle 10 s.
  const warnZeilen: string[] = [];
  const echtesWarn = console.warn; const echtesNow = Date.now;
  console.warn = (...x: unknown[]) => { warnZeilen.push(x.map(String).join(' ')); };
  let uhr = 1_000_000; Date.now = () => uhr;
  try {
    const e5 = wm.createEditorWindow(); const n5 = wm.openNdiWindow();
    const meld = (stufe: number, text: string): void => { for (const cb of n5.wcZu['console-message'] ?? []) cb({}, stufe, text, 1, 'x.js'); };
    const l0 = logZeilen.length;
    meld(3, '[ndi] Folie nicht gemalt: Error: kaputt');
    ck('NDI-Fenster: [ndi]-Fehler landet im Main-Log, gekennzeichnet als [ndi-bild]', eq(logZeilen.slice(l0), ['[ndi-bild] Folie nicht gemalt: Error: kaputt']));
    meld(3, '[ndi] Folie nicht gemalt: Error: kaputt'); uhr += 9_999; meld(3, '[ndi] Folie nicht gemalt: Error: kaputt');
    ck('… dieselbe Zeile binnen 10 s kein zweites Mal', logZeilen.length === l0 + 1);
    meld(3, '[ndi] Zeichnen fehlgeschlagen: Error: x');
    ck('… eine andere Zeile schon', logZeilen.length === l0 + 2 && logZeilen.at(-1) === '[ndi-bild] Zeichnen fehlgeschlagen: Error: x');
    uhr += 1; meld(3, '[ndi] Folie nicht gemalt: Error: kaputt');
    ck('… nach 10 s wieder', logZeilen.length === l0 + 3);
    meld(2, '[ndi] Warnung');
    ck('… Warnung als Warnung', eq(warnZeilen, ['[ndi-bild] Warnung']));
    meld(1, '[ndi] nur Info'); meld(3, 'Uncaught TypeError: fremd'); meld(3, 'vorne [ndi] mitten');
    ck('… ohne [ndi]-Präfix oder unter Warnstufe nichts', logZeilen.length === l0 + 3 && warnZeilen.length === 1);
    ck('… nur das NDI-Fenster wird abgehört', !(e5.wcZu['console-message']?.length) && (n5.wcZu['console-message']?.length ?? 0) === 1);
    e5.close(); el.BrowserWindow.raeumeAuf();
  } finally {
    console.warn = echtesWarn; Date.now = echtesNow;
  }

  // ---- Das echte sender-process.ts: Wurf beim init NACH dem Fork (Grund für stoppeSender im catch) ----
  fs.writeFileSync(path.join(dir, 'ndi-sender.cjs'), '');
  const sp = await import('../src/main/ndi/sender-process');
  g.__sp.initWirft = true;
  const stumm = { bereit() {}, fehler() {}, empfaenger() {}, beendet() {} };
  let spWurf = false;
  try { sp.starteSender(stumm); } catch { spWurf = true; }
  const kind = g.__sp.kinder.at(-1);
  ck('echter Sender: Wurf beim init → Kind schon geforkt, noch nicht beendet', spWurf && kind?.getoetet === 0);
  sp.stoppeSender(); ck('… stoppeSender beendet genau dieses Kind', kind?.getoetet === 1);

  // ---- ipc.ts: ein Wurf in initNdiAusgang überspringt das Aufräumen bei will-quit nicht ----
  g.__ipc.initWirft = true;
  const ipc = await import('../src/main/ipc');
  try { ipc.registerIpc(); } catch { /* Wurf darf durchgehen – will-quit muss trotzdem stehen */ }
  const willQuit = g.__app['will-quit'];
  willQuit?.();
  ck('initNdiAusgang wirft → will-quit steht und räumt Fernsteuerung, Timer, NDI auf',
    typeof willQuit === 'function' && eq(g.__ipc.zu, ['remote', 'timer', 'ndi']));

  // ---- ipc.ts present:start: „Keiner – nur NDI“, solange NDI an ist und sendet oder (durch die Start-Frist begrenzt) startet ----
  const start = g.__ipc.h['present:start'];
  const ndiSt = (an: boolean, lage: NdiLage): NdiStatus => ({ an, lage, empfaenger: 0, grund: lage === 'nicht-verfuegbar' ? 'x' : null });
  const pub0 = w.publikum.length;
  g.__ipc.status = ndiSt(true, 'sendet'); start?.({}, payload, 'keiner');
  ck('present:start „keiner“, NDI sendet → Präsentation ohne Publikumsfenster', p.getState().active && w.publikum.length === pub0);
  p.stopPresentation();
  g.__ipc.status = ndiSt(true, 'startet'); start?.({}, payload, 'keiner');
  ck('present:start „keiner“, NDI startet (z. B. Ersatzfenster nach Absturz) → nur NDI, kein Publikumsfenster', p.getState().active && w.publikum.length === pub0);
  p.stopPresentation();
  g.__ipc.status = ndiSt(true, 'nicht-verfuegbar'); start?.({}, payload, 'keiner'); p.stopPresentation();
  g.__ipc.status = ndiSt(false, 'aus'); start?.({}, payload, 'keiner'); p.stopPresentation();
  g.__ipc.status = ndiSt(false, 'startet'); start?.({}, payload, 'keiner'); p.stopPresentation();
  start?.({}, payload, 7); p.stopPresentation();
  start?.({}, payload, 'Unsinn'); p.stopPresentation();
  ck('present:start: „keiner“ bei nicht verfügbar, aus oder Schalter aus → automatisch, Bildschirm-ID bleibt, Unsinn → automatisch',
    eq(w.publikum.slice(pub0), [null, null, null, 7, null]));
} finally {
  console.error = echtesError;
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
