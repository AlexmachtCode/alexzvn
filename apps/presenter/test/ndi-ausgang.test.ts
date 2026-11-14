// #303: NDI-Ausgang im Main – Schalter (userData), Fenster- und Senderleben, Empfängerzahl, Fehlerfall,
// Payload-Weitergabe ans NDI-Fenster. Fenster, Sender-Prozess und Electron sind Attrappen.
// npm run selftest -w @jm/presenter
Object.defineProperty(process, 'platform', { value: 'win32' }); // CI läuft unter Linux
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PresentationPayload } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

type Schein = { once(e: string, cb: () => void): void; isDestroyed(): boolean; webContents: object };
type Meldungen = { bereit(): void; fehler(g: string): void; empfaenger(n: number): void; beendet(c: number): void };
const g = globalThis as unknown as {
  __w: { aktuell: Schein | null; offen: number; zu: number; closed: (() => void) | null; anNdi: [string, unknown][]; status: unknown[] };
  __s: { m: Meldungen | null; gestartet: number; gestoppt: number; verbunden: number; datei: boolean; wirft: boolean };
  __userData: string;
};
const w = (g.__w = { aktuell: null, offen: 0, zu: 0, closed: null, anNdi: [], status: [] });
const s = (g.__s = { m: null, gestartet: 0, gestoppt: 0, verbunden: 0, datei: true, wirft: false });
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
    w.aktuell = { once: (e, cb) => { if (e === 'closed') w.closed = cb; }, isDestroyed: () => false, webContents: {} };
    w.offen++;
  }
  return w.aktuell;
}
export function closeNdiWindow() { w.zu++; w.aktuell = null; }
export function getNdiWindow() { return w.aktuell; }
export function sendeAnNdi(c, x) { w.anNdi.push([c, x]); }
export function broadcastAll(c, x) { if (c === 'ndi:status') w.status.push(x); }
export function closePresentationWindows() {}
export function openAudienceWindow() {}
export function openPresenterWindow() {}
export function setPresentationClosedHandler() {}`;
const SENDER = `
const s = globalThis.__s;
export function starteSender(m) { s.m = m; s.gestartet++; if (s.wirft) throw new Error('fork scheitert\\nDetails'); return s.datei; }
export function verbindeFenster() { s.verbunden++; }
export function stoppeSender() { s.gestoppt++; }`;
// Für config.ts reicht `app`; das echte windows.ts (zweiter Teil) braucht dazu Fenster und Bildschirm.
// Ein Fenster schließt wie in Electron erst später: close() merkt vor, raeumeAuf() feuert die `closed`.
const ELECTRON = `
export const app = { getPath: () => globalThis.__userData, isPackaged: false };
export const shell = { openExternal() {} };
const anzeige = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
export const screen = { getPrimaryDisplay: () => anzeige, getAllDisplays: () => [anzeige] };
const alle = [];
const schliessend = new Set();
export class BrowserWindow {
  constructor(opts) {
    this.opts = opts; this.zu = {}; this.weg = false; this.gesendet = []; this.suche = null;
    this.webContents = { on() {}, setWindowOpenHandler() {}, getURL: () => '', send: (c, x) => this.gesendet.push([c, x]) };
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
  fs.writeFileSync(datei, '{"an":true}'); a.initNdiAusgang();
  ck('gemerkt an → Sender und Fenster ab App-Start', s.gestartet === 1 && w.offen === 1 && a.ndiStatus().lage === 'startet');
  ck('startet → noch kein Bild', !a.ndiLiefert() && w.status.length === 1);
  s.m!.bereit(); ck('bereit → sendet, liefert Bild', a.ndiStatus().lage === 'sendet' && a.ndiLiefert());
  const vor = w.status.length; s.m!.empfaenger(2); s.m!.empfaenger(2);
  ck('Empfängerzahl einmal gemeldet', a.ndiStatus().empfaenger === 2 && w.status.length === vor + 1);
  ck('Status-Push trägt den Stand', eq(w.status.at(-1), { an: true, lage: 'sendet', empfaenger: 2, grund: null }));
  a.ndiFensterBereit(); ck('Fenster bereit → Port verbunden', s.verbunden === 1);
  p.startPresentation(payload, null); p.next();
  ck('Präsentationsstart → Folien genau einmal ans NDI-Fenster', w.anNdi.filter(([c, x]) => c === 'present:payload' && x === payload).length === 1);
  p.stopPresentation(); ck('Stopp → null ans NDI-Fenster', eq(w.anNdi.at(-1), ['present:payload', null]));
  const gestopptVorFehler = s.gestoppt;
  s.m!.fehler('Addon fehlt');
  ck('Fehler → nicht verfügbar mit Grund, kein Wurf', a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund!.includes('Addon fehlt') && !a.ndiLiefert());
  ck('Fehler → toter Sender wird beendet, Fenster bleibt', s.gestoppt === gestopptVorFehler + 1 && w.zu === 0 && w.aktuell !== null);
  ck('Fehler → eine Log-Zeile [ndi]', logZeilen.length === 1 && logZeilen[0].startsWith('[ndi]') && logZeilen[0].includes('Addon fehlt'));
  s.m!.beendet(1);
  ck('Nachzügler nach dem Fehler ändert nichts', a.ndiStatus().grund === 'Addon fehlt' && logZeilen.length === 1);
  a.ndiFensterBereit(); ck('Fenster bereit ohne Sender → kein Port', s.verbunden === 1);
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
  ck('Sender endet → nicht verfügbar', a.ndiStatus().lage === 'nicht-verfuegbar' && a.ndiStatus().grund === 'NDI-Sender beendet (Code 3).');
  const [o1, st1, v1] = [w.offen, s.gestartet, s.verbunden]; a.setzeNdiAn(true);
  ck('Neustart bei offenem Fenster: neuer Sender, kein zweites Fenster, Port sofort', s.gestartet === st1 + 1 && w.offen === o1 && s.verbunden === v1 + 1);
  ck('Neustart → startet', a.ndiStatus().lage === 'startet' && a.ndiStatus().grund === null);
  const gestoppt = s.gestoppt; w.aktuell = null; w.closed!(); ck('NDI-Fenster zu (letztes Fenster geschlossen) → Sender gestoppt', s.gestoppt > gestoppt);
  a.setzeNdiAn(false); s.datei = false; const offen = w.offen; a.setzeNdiAn(true);
  ck('Sender-Datei fehlt → nicht verfügbar, kein Fenster', a.ndiStatus().grund === 'NDI-Sender fehlt im Paket.' && w.offen === offen);
  a.setzeNdiAn(false); s.datei = true; s.wirft = true; a.setzeNdiAn(true);
  ck('Sender-Start wirft → nicht verfügbar mit erster Zeile, kein Fenster', a.ndiStatus().grund === 'NDI-Sender startet nicht: fork scheitert' && w.offen === offen);
  a.setzeNdiAn(false); s.wirft = false; Object.defineProperty(process, 'platform', { value: 'darwin' }); const st = s.gestartet; a.setzeNdiAn(true);
  ck('Mac → nicht verfügbar, kein Sender', a.ndiStatus().grund === 'NDI-Ausgang gibt es nur unter Windows.' && s.gestartet === st);
  ck('jeder Übergang nach „nicht verfügbar“ → eine Log-Zeile', logZeilen.length === 5 && logZeilen.every((z) => z.startsWith('[ndi] nicht verfügbar:')));
  ck('ndiLiefertBild nur bei an + sendet', ndi.ndiLiefertBild({ an: true, lage: 'sendet', empfaenger: 0, grund: null }) && !ndi.ndiLiefertBild({ an: false, lage: 'sendet', empfaenger: 0, grund: null }) && !ndi.ndiLiefertBild({ an: true, lage: 'startet', empfaenger: 0, grund: null }));
  ck('NDI_STATUS_AUS', eq(ndi.NDI_STATUS_AUS, { an: false, lage: 'aus', empfaenger: 0, grund: null }));

  // ---- Das echte windows.ts: NDI-Fenster, Rundruf, App-Ende mit dem letzten sichtbaren Fenster ----
  Object.defineProperty(process, 'platform', { value: 'win32' });
  (globalThis as { __dirname?: string }).__dirname = dir; // windows.ts ist CJS-gebaut und rechnet mit __dirname
  type ScheinFenster = {
    opts: { show?: boolean; width?: number; height?: number; skipTaskbar?: boolean; title?: string; webPreferences?: Record<string, unknown> };
    gesendet: [string, unknown][]; suche: string | null; isDestroyed(): boolean; close(): void;
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
} finally {
  console.error = echtesError;
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
