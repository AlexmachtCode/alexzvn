// Altfehler Stufe 2, Recorder A (Plan 2026-11-26, Task 6): Quelltext-Wächter für den Hauptprozess und den Preload, die unter tsx nicht
// laufen (importieren electron, R3). RE-2 (Wächter in arm, `schliesseEingang` hinter rec:disarm), B6 (Kanal recorder:ablehnung), RE-7b
// (Show-Ordner geprüft, settings:load ohne existsSync, „Übernehmen“ im Import merkt den Netzwerkordner, Kanal
// recorder:netzordnerBestaetigen) und K4 (der Satz „Erst die Aufnahme stoppen.“ steht genau einmal im Code).
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { ohneKommentare, quellen } from './testzustand';

const Q = (pfad: string): string => ohneKommentare(leseText(pfad));
const index = Q('src/main/index.ts');
const ipc = Q('src/main/ipc.ts');
const recM = Q('src/main/recorder.ts');
const preload = Q('src/preload/index.ts');
const typen = Q('src/shared/types.ts');
const store = Q('src/renderer/src/store/recorder.ts');
/** Ausschnitt von `von` bis vor `bis` (leer, wenn ein Anker fehlt). */
const stueck = (t: string, von: string, bis: string): string => {
  const a = t.indexOf(von);
  const b = a < 0 ? -1 : t.indexOf(bis, a + von.length);
  return a < 0 || b < 0 ? '' : t.slice(a, b);
};

// ── RE-2: der Hauptprozess beendet nie eine laufende Aufnahme über arm oder „Eingang schließen“ ──
{
  ok(
    /export function arm\(input: ArmInput\): OpResult \{\s*if \(state\.status === 'recording'\) return \{ ok: false, error: ERST_AUFNAHME_STOPPEN \};/.test(recM),
    'RE-2 Wächter: arm() beginnt mit der Ablehnung in der Aufnahme (vor dem Schließen und Neuöffnen)',
  );
  const sch = stueck(recM, 'export function schliesseEingang(): OpResult {', '\n}\n');
  ok(
    sch.includes("if (state.status === 'recording') return { ok: false, error: ERST_AUFNAHME_STOPPEN };") && sch.includes('disarm();') && sch.includes('return { ok: true };'),
    'RE-2 Wächter: schliesseEingang lehnt in der Aufnahme ab, sonst disarm() und ok',
  );
  ok(ipc.includes("ipcMain.handle('rec:disarm', () => rec.schliesseEingang());") && !ipc.includes('rec.disarm()'), 'RE-2 Wächter: rec:disarm ruft schliesseEingang, nicht mehr disarm');
  ok(recM.includes("'Erst den Eingang öffnen (Arm).'") && /export function shutdown\(\): void \{\s*disarm\(\);/.test(recM), 'RE-2 Wächter: „Erst den Eingang öffnen (Arm).“ bleibt wörtlich, shutdown() schließt weiter mit disarm()');
  ok(preload.includes("disarm: () => ipcRenderer.invoke('rec:disarm') as Promise<OpResult>,") && typen.includes('disarm: () => Promise<OpResult>;'), 'RE-2 Wächter: disarm liefert ein OpResult (Preload und JmrecApi)');
}

// ── B6: gemeinsamer Ablehnungsweg recorder:ablehnung ──
{
  const h = stueck(ipc, "ipcMain.handle('recorder:ablehnung'", '});');
  ok(
    h.includes('getLog().warn(') && h.includes('log.slice(0, 500)') && h.includes("'recorder:notice'") && h.includes('hinweis.slice(0, 500)'),
    'B6 Wächter: recorder:ablehnung schreibt die Logzeile mit getLog().warn (500 Zeichen) und schickt den Hinweis (500 Zeichen) als recorder:notice ans Fenster',
  );
  ok(
    preload.includes("ablehnung: (a) => ipcRenderer.invoke('recorder:ablehnung', a) as Promise<void>,") && typen.includes('ablehnung: (a: { hinweis: string; log: string }) => Promise<void>;'),
    'B6 Wächter: Preload und JmrecApi haben ablehnung(a: { hinweis, log }): Promise<void>',
  );
  const fern = stueck(store, 'window.jmrec.onRemoteCommand((cmd) => {', 'window.jmrec.onShowSettings');
  ok(
    fern.indexOf('pruefeFernbefehl(cmd, { status: s.state.status, dir: s.dir, netzordnerOffen: s.netzordnerOffen })') >= 0 &&
      fern.indexOf('pruefeFernbefehl(') < fern.indexOf('switch (cmd.t)') &&
      fern.includes('window.jmrec.ablehnung({ hinweis: p.hinweis, log: p.log })'),
    'B6 Wächter: der Store prüft jeden Fernbefehl vor jeder Wirkung und meldet eine Ablehnung über ablehnung',
  );
  ok(/record: async \(\) => \{\s*let dir = get\(\)\.dir;\s*if \(!dir\) \{\s*await get\(\)\.pickDir\(\);/.test(store), 'RE-2b Wächter: record() bleibt, von Hand im Fenster öffnet ein Start ohne Zielordner weiter den Dialog (Spec)');
}

// ── RE-7b: Show-Ordner geprüft, kein blockierendes existsSync, „Übernehmen“ merkt ──
{
  const show = stueck(index, 'function applyShowFromDeepLink(url: string): void {', '\n}\n');
  ok(
    show.includes('pruefeShowOrdner(s.dir, (p) => netzordnerListe().enthaelt(p))') && !/out\.dir\s*=\s*s\.dir/.test(show) && show.includes('readFileSync(showPath'),
    'RE-7b Wächter: main/index.ts prüft den Show-Ordner mit pruefeShowOrdner und übernimmt s.dir nicht mehr direkt; die Show-Datei liest er weiter synchron (B4)',
  );
  ok(
    show.includes('Show-Zielordner wartet auf Bestätigung: ') && show.includes('Show-Zielordner ungültig, nicht übernommen: ') && show.includes('out.netzordnerOffen') && show.includes('out.ordnerUngueltig'),
    'RE-7b Wächter: wartet ein Netzwerkordner oder ist der Ordner ungültig, steht eine Logzeile im Protokoll',
  );
  const laden = stueck(ipc, "ipcMain.handle('settings:load'", "ipcMain.on('settings:save'");
  ok(laden !== '' && !laden.includes('existsSync') && /ordnerDa: null/.test(laden) && !/\bexistsSync\b/.test(ipc), 'RE-7b Wächter: settings:load prüft den gemerkten Ordner nicht mehr synchron (kein existsSync), ordnerDa ist null');
  const netz = stueck(ipc, 'const netzFrage = async', 'const erg = await importiere(');
  ok(/'uebernehmen'/.test(netz) && netz.includes('netzordnerListe().merke('), 'RE-7b Wächter: der Import-Zweig „uebernehmen“ ruft netzordnerListe().merke( (B4)');
  const best = stueck(ipc, "ipcMain.handle('recorder:netzordnerBestaetigen'", '});');
  ok(
    best.includes('istNetzwerkPfad(pfad)') && best.includes('istErlaubterOrdner(pfad)') && best.includes('netzordnerListe().merke(pfad)') && best.includes('return true;'),
    'RE-7b Wächter: recorder:netzordnerBestaetigen merkt nur einen erlaubten Netzwerkordner und antwortet true',
  );
  ok(
    ipc.includes("join(app.getPath('userData'), 'recorder-netzordner.json')") && /export function netzordnerListe\(\): NetzordnerListe \{/.test(ipc),
    'RE-7b Wächter: die Liste liegt als recorder-netzordner.json unter userData, netzordnerListe() erzeugt sie einmal',
  );
  ok(
    preload.includes("netzordnerBestaetigen: (pfad) => ipcRenderer.invoke('recorder:netzordnerBestaetigen', pfad) as Promise<boolean>,") &&
      typen.includes('netzordnerBestaetigen: (pfad: string) => Promise<boolean>;') &&
      typen.includes('netzordnerOffen?: string;') &&
      typen.includes('ordnerUngueltig?: string;'),
    'RE-7b Wächter: Preload und Typen haben netzordnerBestaetigen und die Felder netzordnerOffen und ordnerUngueltig der Show-Vorgabe',
  );
  ok(!store.includes('nur verwenden, wenn dieser Ordner bekannt ist'), 'RE-7b Wächter: der Hinweis „Zielordner aus der Show liegt im Netzwerk: … – nur verwenden, wenn dieser Ordner bekannt ist.“ entfällt');
}

// ── K4: „Erst die Aufnahme stoppen.“ steht genau einmal im Code, als Konstante unter src/shared/ ──
{
  const treffer = quellen('src').flatMap((d) => {
    const n = ohneKommentare(leseText(d)).split('Erst die Aufnahme stoppen').length - 1;
    return n > 0 ? [`${d}:${n}`] : [];
  });
  gleich(treffer, ['src/shared/types.ts:1'], 'K4 Wächter: der Satz „Erst die Aufnahme stoppen.“ steht genau einmal im Code (src/shared/types.ts), alle Stellen importieren ihn');
  ok(typen.includes("export const ERST_AUFNAHME_STOPPEN = 'Erst die Aufnahme stoppen.';"), 'K4 Wächter: die Konstante ERST_AUFNAHME_STOPPEN in src/shared/types.ts');
}
