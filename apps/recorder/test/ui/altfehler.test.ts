// Altfehler Stufe 2, Recorder A (Plan 2026-11-26, Task 6): Quelltext-Wächter für den Hauptprozess und den Preload, die unter tsx nicht
// laufen (importieren electron, R3). RE-2 (Wächter in arm, `schliesseEingang` hinter rec:disarm), B6 (Kanal recorder:ablehnung), RE-7b
// (Show-Ordner geprüft, settings:load ohne existsSync, „Übernehmen“ im Import merkt den Netzwerkordner, Kanal
// recorder:netzordnerBestaetigen) und K4 (der Satz „Erst die Aufnahme stoppen.“ steht genau einmal im Code). Task 7: RE-3 (Fehlerfeld, Block-Wächter,
// Steuerserver unverändert), RE-7a (Rückfrage beim Schließen im Hauptprozess), RE-PLATZ (fs:platz) und Ruling R11 (Logzeile im Wettlauf).
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
  // Ruling R11 (Task 7): der Aufruf läuft über meldeWettlauf, das eine Ablehnung im Wettlauf protokolliert (Wächter umgestellt).
  ok(ipc.includes("ipcMain.handle('rec:disarm', () => meldeWettlauf('DISARM', rec.schliesseEingang()));") && !ipc.includes('rec.disarm()'), 'RE-2 Wächter (Ruling R11): rec:disarm ruft schliesseEingang (über meldeWettlauf), nicht mehr disarm');
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

// ── Task 7 · RE-3 (B1, B2, D3): Block-Wächter rein, Steuerserver unverändert, main/recorder.ts ohne @jm/app-runtime ──
{
  type Lage = 'ok' | 'stau' | 'fehlen';
  type Waechter = { KEINE_BLOECKE_MS?: number; BLOECKE_TAKT_MS?: number; bloeckeLage?: (l: { jetzt: number; letzterBlock: number; letzterTakt: number }) => Lage };
  let ew: Waechter | null = null;
  try {
    ew = (await import('../../src/main/eingang-waechter')) as Waechter;
  } catch {
    ew = null;
  }
  const lage = (jetzt: number, letzterBlock: number, letzterTakt: number): Lage | undefined => ew?.bloeckeLage?.({ jetzt, letzterBlock, letzterTakt });
  gleich(
    [ew?.KEINE_BLOECKE_MS, ew?.BLOECKE_TAKT_MS, lage(1999, 0, 1749), lage(2000, 0, 1750), lage(10000, 9000, 9501), lage(10000, 9000, 9500), lage(10000, 0, 8000), lage(10000, 0, 9750), lage(2050, 0, 100)],
    [2000, 250, 'ok', 'fehlen', 'ok', 'stau', 'stau', 'fehlen', 'stau'],
    'RE-3 eingang-waechter bloeckeLage an den Grenzen (Fix-Runde 1, Ruling R18a): 1999 ms ohne Block ok, 2000 fehlen; ein Takt, der 499 ms nach dem letzten kommt, ok, nach 500 ms (zwei Takte) stau; der Stau geht vor, auch wenn der letzte Block älter ist (ein Takt kurz vor dem Hängen gab sonst falschen Alarm)',
  );
  const cs = Q('src/main/control-server.ts');
  const suite = stueck(cs, 'function toSuiteState(): SuiteState {', '\n}\n');
  const felder = [...suite.matchAll(/\bs\.(\w+)/g)].map((m) => m[1]);
  ok(
    suite !== '' && felder.length >= 4 && felder.every((f) => f === 'status' || f === 'recordedSec') && felder.includes('status') && felder.includes('recordedSec'),
    `RE-3 Wächter (B2): toSuiteState in main/control-server.ts liest nur status und recordedSec; Companion sieht recording=0 ohne neuen Zustandswert (${felder.join(', ')})`,
  );
  // Fix-Welle (Ruling S2-R28): recorder.test.ts rechnet die Companion-Werte nach einem Geräteverlust mit dieser Abbildung (idle → armed=0).
  ok(
    suite.includes("recording: s.status === 'recording',") && suite.includes("armed: s.status === 'armed',"),
    'RE-3 Wächter (S2-R28): toSuiteState meldet recording und armed allein aus status; nach einem Geräteverlust (idle) sieht Companion armed=0',
  );
  ok(!/from '@jm\/app-runtime'/.test(recM) && !/^import \{[^}]*\} from 'electron'/m.test(recM), 'RE-3 Wächter (D3): main/recorder.ts bleibt ohne @jm/app-runtime und ohne Electron-Werte (testbar unter tsx); die Logzeile kommt über setProtokoll');
  ok(/rec\.setProtokoll\(\(zeile\) => getLog\(\)\.warn\(zeile\.slice\(0, 500\)\)\);/.test(ipc), 'RE-3 Wächter (D3): main/ipc.ts hängt getLog().warn über rec.setProtokoll ein (500 Zeichen)');
  const block = stueck(recM, 'function onFrames(', '\n}\n');
  ok(
    /try \{[\s\S]*writer\.writeBlock\(planar, channels, frames\);[\s\S]*multiWriter\?\.writeBlock\(planar, channels, frames\);[\s\S]*state\.recordedSec \+= frames[\s\S]*\} catch \(e\) \{\s*schreibfehler\('schreiben', e\);/.test(block),
    'RE-3 Wächter (B2): onFrames fasst Stille, beide writeBlock und recordedSec in try, der catch ruft schreibfehler (kein Wurf erreicht das Addon)',
  );
}

// ── Task 7 · RE-7a (B3, D4): Rückfrage beim Schließen im Hauptprozess, nativer Rückfall nicht blockierend, Abmelden ohne Frage ──
// Fix-Runde 1 (Befund 1, Ruling R15; Wächter umgestellt): die Rückfrage führt SchliessenSteuerung (shared/schliessen.ts, mit Ports getestet
// in schliessen.test.tsx); main/index.ts verdrahtet nur noch Ereignisse und Ports. Neuladen, Absturz und powerMonitor kamen dazu.
{
  const sch = Q('src/shared/schliessen.ts');
  const bs = stueck(sch, 'beimSchliessen(): boolean {', '\n  }\n');
  ok(
    bs.includes('schliessenEntscheid({ status: this.p.status(), bestaetigt: this.bestaetigt, frageOffen: this.ablauf.offen })') &&
      bs.includes('this.ablauf.stelle(this.rueckfall)') &&
      bs.includes('this.ablauf.erneut(this.rueckfall)') &&
      bs.includes('this.p.sendeFrage(true)'),
    'RE-7a Wächter (Fix-Runde 1, Befund 1a): SchliessenSteuerung.beimSchliessen fragt schliessenEntscheid, stellt die Frage und stellt sie bei offener Frage erneut (Frist neu)',
  );
  const rueck = stueck(sch, 'private readonly rueckfall = (): void => {', '\n  };\n');
  ok(
    rueck.includes('this.p.sendeFrage(false)') && rueck.includes('this.p.frageNativ()') && rueck.indexOf('this.p.sendeFrage(false)') < rueck.indexOf('this.p.frageNativ()'),
    'RE-7a Wächter: der Rückfall schließt erst die Frage im Fenster, dann fragt der native Dialog',
  );
  const close = stueck(index, "win.on('close', (e) => {", '\n  });\n');
  ok(/if \(steuerung\.beimSchliessen\(\)\) e\.preventDefault\(\);/.test(close), 'RE-7a Wächter: main/index.ts hört auf win.on(close) und verhindert das Schließen (preventDefault), solange die Steuerung fragt');
  // Fix-Welle (Ruling S2-R26, I1): der Port kopfAktualisieren der Steuerung ist der des Aufnahmekerns (main/recorder.ts), nicht ein leerer.
  ok(
    /\n {4}kopfAktualisieren: \(\) => kopfAktualisieren\(\),\n/.test(index) && /import \{[^}]*\bkopfAktualisieren\b[^}]*\} from '\.\/recorder';/.test(index),
    'RE-7a Wächter (Fix-Welle, S2-R26): main/index.ts gibt der SchliessenSteuerung als Port kopfAktualisieren den Aufruf des Aufnahmekerns (main/recorder.ts)',
  );
  ok(
    index.includes("win.webContents.on('did-finish-load', () => steuerung.geladen());") && index.includes("win.webContents.on('render-process-gone', () => steuerung.rendererWeg());"),
    'RE-7a Wächter (Fix-Runde 1, Befund 1b): nach einem Neuladen geht eine offene Frage erneut ans Fenster, ist der Renderer weg, fragt sofort der native Dialog',
  );
  const nativ = stueck(index, 'frageNativ: () =>', '.then((r) => r.response)');
  ok(
    /dialog\s*\.showMessageBox\(win, \{\s*type: 'warning',\s*message: SCHLIESSEN_TEXTE\.frage,\s*detail: SCHLIESSEN_TEXTE\.detail,\s*buttons: \[SCHLIESSEN_TEXTE\.beenden, SCHLIESSEN_TEXTE\.weiter\],\s*defaultId: 1,\s*cancelId: 1,?\s*\}\)/.test(nativ) &&
      index.includes("win.webContents.send('recorder:schliessenFrage', offen)"),
    'RE-7a Wächter: der native Rückfall fragt asynchron mit dialog.showMessageBox(win, …) und SCHLIESSEN_TEXTE (Vorgabe und Abbruch „Weiter aufnehmen“); die Frage geht als recorder:schliessenFrage ans Fenster',
  );
  ok(!index.includes('showMessageBoxSync'), 'RE-7a Wächter: nie showMessageBoxSync (hielte Hauptprozess, Audioblöcke, IPC und Steuerserver an)');
  ok(/win\.on\('session-end', \(\) => \{\s*steuerung\.ohneFrage\(\);\s*shutdown\(\);/.test(index), 'RE-7a Wächter: Abmelden und Herunterfahren unter Windows (session-end) beenden ohne Frage und schließen die Datei sauber ab (shutdown)');
  // Fix-Runde 2 (Ruling R19, Wächter umgestellt): der Hörer gilt nur unter Linux. Abmelden, Herunterfahren und Cmd+Q auf dem Mac bleiben beim
  // Kandidaten RE-K3 (der Recorder wird nur für Windows gebaut, R14).
  ok(
    /if \(process\.platform === 'linux'\) \{\s*powerMonitor\.on\('shutdown', \(\) => \{\s*schliessenSteuerung\?\.ohneFrage\(\);\s*shutdown\(\);/.test(index) &&
      index.split("powerMonitor.on('shutdown'").length === 2 &&
      /import \{[^}]*\bpowerMonitor\b[^}]*\} from 'electron';/.test(index),
    'RE-7a Wächter (Ruling R15, B3; Fix-Runde 2, R19): nur unter Linux (process.platform === linux) hört der Recorder auf powerMonitor „shutdown“, genau einmal; er beendet ohne Frage und schließt die Datei sauber ab (nicht unter Linux gemessen)',
  );
  ok(/win\.on\('closed', \(\) => \{\s*shutdown\(\);/.test(index), 'RE-7a Wächter: closed ruft weiter shutdown() (Kopf mit echter Länge)');
  const vorEnde = stueck(index, "app.on('before-quit'", ');\n');
  const nachEnde = stueck(index, "app.on('will-quit'", ');\n');
  ok(
    vorEnde !== '' && !vorEnde.includes('stopControlServer') && vorEnde.includes('beendenWunsch = true') && nachEnde.includes('stopControlServer()'),
    'RE-7a Wächter (Mac Cmd+Q): before-quit merkt nur den Beenden-Wunsch, will-quit hält den Steuerserver an (erst fragen, dann beenden)',
  );
  const antw = stueck(index, "ipcMain.handle('recorder:schliessenAntwort'", '\n    });\n');
  ok(
    antw.includes("a === 'gezeigt'") && antw.includes("a === 'beenden'") && antw.includes("a === 'weiter'") && antw.includes('schliessenSteuerung?.antwortFenster(a)') &&
      index.includes('beendenGewuenscht: () => beendenWunsch,') && index.includes('beende: () => app.quit(),') && /if \(!this\.ablauf\.antwort\(\)\) return;/.test(sch),
    'RE-7a Wächter: recorder:schliessenAntwort kennt gezeigt, beenden und weiter; die erste Antwort gilt (ablauf.antwort), nach „Aufnahme beenden“ auf Cmd+Q hin beendet der Main die App (D4)',
  );
  ok(
    /let letzteFrage = false;/.test(preload) &&
      preload.includes("ipcRenderer.on('recorder:schliessenFrage', (_e: unknown, offen: boolean): void => {") &&
      /onSchliessenFrage: \(cb\) => \{\s*frageHoerer\.add\(cb\);\s*if \(letzteFrage\) cb\(true\);/.test(preload) &&
      preload.includes("schliessenAntwort: (a) => {") && preload.includes("ipcRenderer.invoke('recorder:schliessenAntwort', a) as Promise<void>") &&
      typen.includes('onSchliessenFrage: (cb: (offen: boolean) => void) => () => void;') &&
      typen.includes("schliessenAntwort: (a: 'gezeigt' | 'beenden' | 'weiter') => Promise<void>;"),
    'RE-7a Wächter (Fix-Runde 1): Preload und JmrecApi haben onSchliessenFrage und schliessenAntwort; der Preload hört ab dem Laden mit und reicht eine offene Frage an ein spätes Abo weiter (nach einem Neuladen geht sie nicht verloren)',
  );
  ok(
    /window\.jmrec\.onSchliessenFrage\(\(offen\) => \{\s*set\(\{ schliessenFrage: offen \}\);\s*if \(offen\) void window\.jmrec\.schliessenAntwort\('gezeigt'\)/.test(store),
    'RE-7a Wächter: der Store abonniert onSchliessenFrage in init und meldet „gezeigt“ sofort (sonst greift nach 1 s der native Rückfall)',
  );
}

// ── Fix-Runde 1 · Ruling R18 (c), K4: „kein Zielordner“ steht genau einmal im Code ──
{
  const treffer = quellen('src').flatMap((d) => {
    const n = ohneKommentare(leseText(d)).split("'kein Zielordner'").length - 1;
    return n > 0 ? [`${d}:${n}`] : [];
  });
  gleich(treffer, ['src/renderer/src/lib/platz.ts:1'], 'K4 Wächter (Ruling R18c): „kein Zielordner“ steht genau einmal im Code (lib/platz.ts), die Logzeile der Fernbefehle importiert ihn');
}

// ── Task 7 · Ruling R11: eine Ablehnung des Main-Wächters im Wettlauf hat eine Logzeile und den Hinweis wie die Store-Ablehnung ──
{
  ok(ipc.includes("ipcMain.handle('rec:arm', (_e, input: ArmInput) => meldeWettlauf('ARM', rec.arm(input)));"), 'RE-2 R11 Wächter: rec:arm geht über meldeWettlauf');
  const mw = stueck(ipc, 'const meldeWettlauf = ', '\n  };\n');
  ok(
    mw.includes('if (r.ok) return r;') && mw.includes('rec.wettlaufAblehnung(verb, r)') && mw.includes('getLog().warn(') && mw.includes("'recorder:notice'") && mw.includes('w.hinweis'),
    'RE-2 R11 Wächter: meldeWettlauf schreibt bei !ok eine Logzeile mit getLog().warn und schickt im Wettlauf den Hinweis der Store-Ablehnung als recorder:notice (Band bis „OK“)',
  );
}

// ── Task 7 · RE-PLATZ (B5): fs:platz im Hauptprozess über PlatzAbfrage, im Store ein Takt von 5 s ──
{
  const h = stueck(ipc, "ipcMain.handle('fs:platz'", ');\n');
  ok(h.includes("typeof dir === 'string'") && h.includes('platz.frage(dir)') && /const platz = new PlatzAbfrage\(\);/.test(ipc), 'RE-PLATZ Wächter: fs:platz fragt über eine PlatzAbfrage (je Pfad eine Messung, Zeitgrenze 3 s)');
  ok(preload.includes("platz: (dir) => ipcRenderer.invoke('fs:platz', dir) as Promise<number | null>,") && typen.includes('platz: (dir: string) => Promise<number | null>;'), 'RE-PLATZ Wächter: Preload und JmrecApi haben platz(dir)');
  ok(/setInterval\(frage, PLATZ_TAKT_MS\)/.test(store) && store.includes('useRec.subscribe('), 'RE-PLATZ Wächter: der Store fragt im Takt PLATZ_TAKT_MS und bei jeder Änderung über useRec.subscribe');
  ok(/state\.spuren = multiWriter !== null;/.test(recM), 'RE-PLATZ Wächter: startRecording setzt spuren = multiWriter !== null (gemessen, nicht der Wunsch)');
}
