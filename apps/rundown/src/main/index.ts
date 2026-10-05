import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShowDeepLink, type Show, type ShowIveoProgramRef, type ShowIveoSpeaker } from '@jm/show';
import { berichtIstLeer, wendeShowAn } from '@shared/abgleich';
import { waehleAusgangsstand, type DateiStand, type GedaechtnisInhalt } from '@shared/ausgangsstand';
import { buildActionLine, navigate, newId } from '@shared/conductor';
import {
  abweisungText,
  berichtText,
  DATEI_AUSSERHALB,
  fuegeHinweisAn,
  GEDAECHTNIS_DEFEKT,
  GEDAECHTNIS_GESPERRT,
  kontextWechselText,
  ohneHinweisText,
  RELOAD_OHNE_SHOW,
  scharfVerruecktText,
  showNichtLesbarText,
  sprungEntfallenText,
} from '@shared/hinweise';
import {
  alsEigeneZeile,
  bereinigeQuellen,
  erzeugeBuendler,
  indexVon,
  nimmAenderungAn,
  scharfNachBearbeitung,
} from '@shared/scharf';
import { bildeZielAb, loeseSprungZiel } from '@shared/sprung';
import {
  ablaufNeuEntstanden,
  ablaufSchluesselAusZeilen,
  ersteLebendeZeile,
  kontextIstIveo,
  loeseSpeakerZiel,
  sendeArgs,
  sprungZielTitel,
  titlerKannKennung,
} from '@shared/zeilen';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type {
  FireReport,
  RundownAction,
  RundownDoc,
  RundownHinweis,
  RundownNav,
  RundownRow,
  RundownState,
} from '@shared/types';
import { Conductor } from './conductor';
import { getOverrides, setOverride } from './config';
import { startControlServer, stopControlServer, pushControlState } from './control-server';
import {
  dateiStand,
  gedaechtnisSchluessel,
  legeGedaechtnisFehlerBei,
  leseGedaechtnis,
  leseShowSicher,
  leseZeiger,
  loescheZeiger,
  REGIE_ORDNER,
  rundownDateiDerShow,
  schreibeGedaechtnis,
  schreibeZeiger,
  sichereAltenAutosave,
  sichereDefektesGedaechtnis,
  type ShowGelesen,
} from './gedaechtnis';
import { defaultDoc, loadAutosave, migrate, readDoc, saveAutosave, writeDoc } from './store';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
const preloadPath = join(__dirname, '../preload/index.cjs');

// ── Autoritativer Zustand (lebt im Main, damit auch der spätere RUNDOWN-
//    Steuerserver / Companion navigieren kann) ───────────────────────────────
// Das Dokument steht im Main immer in der Form von `migrate` (feste Feldreihenfolge):
// so ist der Stand nach einem Neustart aus dem Gedächtnis gleich dem davor.
let doc: RundownDoc = migrate(defaultDoc());
/** Scharfe Zeile über ihre Kennung (5.3); `index` wird bei Bedarf daraus errechnet. */
let scharfId: string | null = null;
let filePath: string | null = null;
let dirty = false;
let lastFired: FireReport | null = null;
/** iveo-Speaker der zuletzt geöffneten Show (für Titler-Cues im Row-Editor). */
let iveoSpeakers: ShowIveoSpeaker[] = [];
/** iveo-Side-Events der zuletzt geöffneten Show (für LAUNCHER-SIDEEVENT-Cues). */
let iveoSideEvents: ShowIveoProgramRef[] = [];

// ── Gemerkte Show, Gedächtnis und Abgleich (Teil 2a, Spec 4.6–4.8, 5.1–5.5) ──
/** Absoluter Pfad der gemerkten Show (5.2) oder null. */
let showPfad: string | null = null;
/** Name der gemerkten Show (steht im Gedächtnis). */
let showName = '';
/** Die gemerkte Show hat eine iveo-Bindung. */
let showHatIveo = false;
/** Eigene `.jmrundown` der gemerkten Show (4.8), aufgelöst, oder null. */
let showRundownDatei: string | null = null;
/** Stand der eigenen Rundown-Datei, wie das Gedächtnis ihn zuletzt sah (4.8). */
let gedaechtnisDatei: DateiStand | null = null;
/** Schlüssel des normalisierten show.ablauf in Reihenfolge (6.2). */
let ablaufSchluessel: string[] = [];
/** Die gemerkte Show hat eine eigene Timer-Liste (6.2). */
let eigeneTimerListe = false;
/** Was in der Autosave-Datei steht (Übergangsregel 5.2); null = beim Start gab es keinen. */
let autosaveDoc: RundownDoc | null = null;
/** Steigt bei jeder Änderung am Dokument (5.5). */
let rev = 0;
/** `rev`, bei dem der letzte Abgleich lief (5.5). */
let abgleichRev = 0;
/** Abgewiesene Änderungen (5.5). */
let abweisungen = 0;
let hinweise: RundownHinweis[] = [];
let hinweisNr = 0;
/** Schlüssel des Gedächtnisses, das nicht lesbar war und nicht überschrieben wird; null = keine Sperre. */
let gedaechtnisSperre: string | null = null;
/** Die Sperre wurde schon einmal ins Log geschrieben (sichere() läuft oft). */
let sperreGemeldet = false;
/**
 * Umbenennungen (R0) der Abgleiche, solange GO-Folgen ausstehen. Verzögerte
 * Sprünge bilden ihre beim GO festgehaltene zielId darüber ab (6.2).
 */
let umbenennungen: Record<string, string>[] = [];

const conductor = new Conductor(() => broadcastLinks());

function resourcePath(filename: string): string {
  if (app.isPackaged) return path.join(process.resourcesPath, filename);
  return path.join(__dirname, '..', '..', 'resources', filename);
}

/** Texte mit „iveo“ (4.5, 4.6): Bindung der gemerkten Show, ohne Show der Kontext des Dokuments. */
function mitIveo(): boolean {
  return showPfad !== null ? showHatIveo : kontextIstIveo(doc.kontext);
}

function buildState(): RundownState {
  return {
    doc,
    index: indexVon(doc.rows, scharfId),
    scharfId,
    filePath,
    dirty,
    links: conductor.snapshot(),
    overrides: getOverrides(),
    lastFired,
    iveoSpeakers,
    iveoSideEvents,
    rev,
    hinweise,
    abweisungen,
    ablaufSchluessel,
    eigeneTimerListe,
    showGemerkt: showPfad !== null,
    showMitIveo: mitIveo(),
  };
}

function regieOrdner(): string {
  return join(app.getPath('userData'), REGIE_ORDNER);
}

/** Hinweis an den Renderer anhängen (4.6). Kurze entfernt der Main nach 6 s (höchstens 6 gleichzeitig); stehende bleiben. */
function hinweis(text: string, art: RundownHinweis['art']): void {
  const id = ++hinweisNr;
  hinweise = fuegeHinweisAn(hinweise, { id, text, art });
  if (art === 'kurz') setTimeout(() => entferneHinweis(id), 6000);
}

function entferneHinweis(id: number): void {
  const vorher = hinweise.length;
  hinweise = hinweise.filter((h) => h.id !== id);
  if (hinweise.length !== vorher) broadcast();
}

/** Stand sichern (4.7): mit gemerkter Show ins Gedächtnis, sonst wie bisher in den Autosave. */
function sichere(): void {
  if (showPfad) {
    if (gedaechtnisSperre !== null && gedaechtnisSperre === gedaechtnisSchluessel(showPfad)) {
      // Das Gedächtnis war nicht lesbar: nicht überschreiben, bis ein Lesen wieder gelingt.
      if (!sperreGemeldet) {
        sperreGemeldet = true;
        getLog().warn('Gedächtnis der Show ist gesperrt (nicht lesbar), Stand wird nicht ins Gedächtnis geschrieben.');
      }
      return;
    }
    const ok = schreibeGedaechtnis(regieOrdner(), {
      schemaVersion: 2,
      showPfad,
      showName,
      doc,
      scharfId,
      gespeichertAm: new Date().toISOString(),
      ...(gedaechtnisDatei ? { datei: gedaechtnisDatei } : {}),
    });
    if (!ok) getLog().warn('Gedächtnis der Show konnte nicht geschrieben werden.');
  } else {
    saveAutosave(doc);
    autosaveDoc = doc;
  }
}

function broadcast(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('rundown:state', buildState());
  pushControlState(buildSuiteState());
}

/** Zustand fürs Suite-Steuerprotokoll (Companion liest cue/total/label). */
function buildSuiteState(): SuiteState {
  // STATE cue= aus der Kennung der scharfen Zeile errechnet (5.3).
  const index = indexVon(doc.rows, scharfId);
  const cur = doc.rows[index];
  return {
    ns: 'rundown',
    kv: {
      cue: doc.rows.length ? index + 1 : 0,
      total: doc.rows.length,
      // STATE ist whitespace-getrennt → Leerzeichen im Titel ersetzen.
      label: cur ? cur.label.trim().replace(/\s+/g, '_') || '-' : '-',
    },
  };
}

/** RUNDOWN-Befehl (von Companion) → Navigation. */
function handleSuiteCommand(cmd: SuiteCommand): void {
  switch (cmd.verb) {
    case 'go':
      doNav({ t: 'go' });
      break;
    case 'next':
      doNav({ t: 'next' });
      break;
    case 'prev':
      doNav({ t: 'prev' });
      break;
    case 'goto': {
      const n = Number(cmd.args[0]);
      if (Number.isFinite(n)) doNav({ t: 'goto', n: Math.trunc(n) });
      break;
    }
    case 'reload':
      // Vom Launcher nach einer iveo-Änderung (7.1). Intern wie TIMER RELOAD, nicht
      // im Companion-Katalog. Mehrere binnen 300 ms → ein Abgleich (5.1).
      buendleReload(() => reloadShow());
      break;
    default:
      getLog().warn(`RUNDOWN ${cmd.verb.toUpperCase()}: unbekannter Befehl, ignoriert.`);
  }
}

/** Fasst RELOADs binnen 300 ms zu einem Abgleich zusammen (5.1). */
const buendleReload = erzeugeBuendler(
  300,
  (fn, ms) => setTimeout(fn, ms),
  (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
);

// Tally/Verbindungen ändern sich häufig (z. B. Timer-Tick 1×/s je Tool) → nur die
// Links separat und gedrosselt senden, nicht den ganzen Doc.
let linksTimer: ReturnType<typeof setTimeout> | null = null;
function broadcastLinks(): void {
  if (linksTimer) return;
  linksTimer = setTimeout(() => {
    linksTimer = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('rundown:links', conductor.snapshot());
  }, 100);
}

/**
 * Dokument ersetzen („Öffnen…“, „Neu“): bricht ausstehende verzögerte Aktionen ab
 * wie bisher (5.4) — sie gehörten zum alten Stand. Scharf ist die erste nicht
 * entfallene Zeile.
 */
function ersetzeDoc(next: RundownDoc, nextPath: string | null): void {
  cancelPendingFires();
  lastFired = null;
  doc = migrate(next);
  scharfId = ersteLebendeZeile(doc.rows);
  filePath = nextPath;
  dirty = false;
  rev++;
  // Eine verspätete Bearbeitung des alten Dokuments darf das neue nicht überschreiben (5.5).
  abgleichRev = rev;
  sichere();
  broadcast();
}

/**
 * Bearbeitung aus dem Editor übernehmen. Bricht KEINE GO-Folge ab (5.4). Mit
 * gemerkter Show gilt die Absicherung aus 4.5; die scharfe Zeile hält
 * `scharfNachBearbeitung` über ihre Kennung (5.3). Kontext, Archiv und
 * Zuordnungs-Marke führt der Main, nicht der Renderer.
 */
function uebernimmBearbeitung(next: RundownDoc): void {
  let rows = next.rows;
  if (showPfad) {
    const bisherEntfallen = new Set(doc.rows.filter((r) => r.entfallen).map((r) => r.id));
    rows = bereinigeQuellen(rows, ablaufSchluessel, bisherEntfallen, () => newId('r'));
  }
  const neu = migrate({
    schemaVersion: 2,
    name: next.name,
    rows,
    ...(doc.kontext !== undefined ? { kontext: doc.kontext } : {}),
    ...(doc.archiv ? { archiv: doc.archiv } : {}),
    ...(doc.zuordnungOffen ? { zuordnungOffen: true as const } : {}),
  });
  scharfId = scharfNachBearbeitung(doc.rows, neu.rows, scharfId);
  doc = neu;
  rev++;
  dirty = true;
  sichere();
  broadcast();
}

/** „Öffnen…“ und „Neu“ (5.2): gemerkte Show und Zeiger vergessen; ein folgendes RELOAD warnt. */
function vergissShow(): void {
  showPfad = null;
  showName = '';
  showHatIveo = false;
  showRundownDatei = null;
  gedaechtnisDatei = null;
  ablaufSchluessel = [];
  eigeneTimerListe = false;
  loescheZeiger(regieOrdner());
}

// ── Verzögerte GO-Feuerung (Issue #80) ───────────────────────────────────────
// Aktionen einer Zeile können je eine Verzögerung (delayMs) vor dem Feuern tragen,
// kumulativ über die Sequenz. Ohne Verzögerungen verhält sich GO exakt wie bisher
// (alle Aktionen synchron). Ausstehende Timer werden bei jeder neuen Navigation
// oder jedem Dokumentwechsel abgebrochen, damit nichts in die nächste Cue feuert.
let fireTimers: ReturnType<typeof setTimeout>[] = [];

function cancelPendingFires(): void {
  for (const t of fireTimers) clearTimeout(t);
  fireTimers = [];
  umbenennungen = [];
}

/**
 * Argumente, mit denen eine Aktion JETZT gesendet würde; null = Sprung-Ziel entfallen.
 * Erst das Sprung-Ziel (6.2), dann die Speaker-Kennung (Teil 2b, Spec 8.3): mit
 * `recall_kennung=1` im STATE des Titlers `@<Kennung> <Name>`, sonst der aktuelle Name.
 * Beides erst beim Senden, also für GO, verzögerte Aktionen und den Test-Knopf.
 */
function argsZumSenden(a: RundownAction): (string | number)[] | null {
  const args = sendeArgs(a, (x) => loeseSprungZiel(x, ablaufSchluessel, eigeneTimerListe));
  if (!args) return null;
  return loeseSpeakerZiel({ ...a, args }, iveoSpeakers, titlerKannKennung(conductor.snapshot()));
}

function fireOne(row: RundownRow, festgehalten: RundownAction, sent: FireReport['sent'], seitGo: number): void {
  // 6.2: Das Sprung-Ziel wird erst beim Senden aufgelöst — bei verzögerten
  // Aktionen also nach delayMs, gegen den dann aktuellen Ablauf (5.4). Die beim GO
  // festgehaltene zielId wird zuvor über die R0-Umbenennungen seit dem GO abgebildet.
  const a = festgehalten.zielId
    ? { ...festgehalten, zielId: bildeZielAb(festgehalten.zielId, umbenennungen.slice(seitGo)) }
    : festgehalten;
  const args = argsZumSenden(a);
  if (!args) {
    const titel = sprungZielTitel(doc.rows, a);
    sent.push({ role: 'timer', line: 'TIMER GOTO (Ziel entfallen)', delivered: false });
    getLog().warn(`GO „${row.label}": TIMER GOTO nicht gesendet, Ziel „${titel}" ist entfallen`);
    hinweis(sprungEntfallenText(titel), 'kurz');
    return;
  }
  const line = buildActionLine(a.role, a.verb, args);
  const delivered = conductor.fire(a.role, line);
  sent.push({ role: a.role, line, delivered });
  getLog().info(`GO „${row.label}": ${line}${delivered ? '' : ' (offline)'}`);
}

/** Aktionen der scharfen Zeile feuern — sofort und/oder zeitversetzt nach delayMs. */
function fireRow(row: RundownRow | undefined, actions: RundownAction[]): void {
  if (!row) {
    lastFired = null;
    return;
  }
  const sent: FireReport['sent'] = [];
  lastFired = { rowId: row.id, rowLabel: row.label, sent };
  let offset = 0;
  const seitGo = umbenennungen.length;
  for (const a of actions) {
    offset += Math.max(0, a.delayMs ?? 0);
    if (offset === 0) {
      fireOne(row, a, sent, seitGo); // kein Versatz → synchron (wie bisher)
    } else {
      const t = setTimeout(() => {
        fireTimers = fireTimers.filter((x) => x !== t);
        fireOne(row, a, sent, seitGo);
        if (fireTimers.length === 0) umbenennungen = [];
        broadcast(); // UI-Quittung aktualisieren, sobald die Aktion rausging
      }, offset);
      fireTimers.push(t);
    }
  }
}

/** Navigation auswerten; bei GO die Aktionen der scharfen Zeile feuern. */
function doNav(cmd: RundownNav): void {
  // Neue Navigation bricht noch ausstehende verzögerte Aktionen der vorigen Zeile ab.
  cancelPendingFires();
  const index = indexVon(doc.rows, scharfId);
  const res = navigate(doc, index, cmd);
  if (cmd.t === 'go') fireRow(doc.rows[index], res.fire);
  scharfId = doc.rows[res.index]?.id ?? null;
  // Die scharfe Zeile gehört ins Gedächtnis (4.7); der Autosave kennt sie nicht.
  if (showPfad) sichere();
  broadcast();
}

async function openDialog(): Promise<void> {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JM Rundown', extensions: ['jmrundown'] }],
  });
  if (r.canceled || !r.filePaths[0]) return;
  try {
    const d = readDoc(r.filePaths[0]);
    vergissShow();
    ersetzeDoc(d, r.filePaths[0]);
  } catch (err) {
    // G6: Die JSON-Meldung zitiert Dateiinhalt → nur „kein gültiges JSON“ ins Log.
    const grund = err instanceof SyntaxError ? 'kein gültiges JSON' : (err as Error).message;
    getLog().error(`Öffnen fehlgeschlagen: ${grund}`);
  }
}

async function saveDialog(forceNew: boolean): Promise<void> {
  let target = filePath;
  if (forceNew || !target) {
    const r = await dialog.showSaveDialog({
      defaultPath: `${doc.name}.jmrundown`,
      filters: [{ name: 'JM Rundown', extensions: ['jmrundown'] }],
    });
    if (r.canceled || !r.filePath) return;
    target = r.filePath;
  }
  try {
    writeDoc(target, doc);
    filePath = target;
    dirty = false;
    // 4.8: „Speichern“ der eigenen Rundown-Datei der Show → ihr Stand kommt ins Gedächtnis.
    if (showPfad && showRundownDatei && path.resolve(target).toLowerCase() === showRundownDatei.toLowerCase()) {
      // Stand unter dem Pfad aus der Show bilden — so vergleicht 4.8 beim nächsten Öffnen gleich.
      gedaechtnisDatei = dateiStand(showRundownDatei);
      sichere();
    }
    broadcast();
  } catch (err) {
    getLog().error(`Speichern fehlgeschlagen: ${(err as Error).message}`);
  }
}

function registerIpc(): void {
  ipcMain.handle('rundown:getState', () => buildState());
  ipcMain.handle('rundown:nav', (_e, cmd: RundownNav) => {
    doNav(cmd);
    return buildState();
  });
  ipcMain.handle('rundown:fireAction', (_e, rowId: string, actionId: string) => {
    // Test-Knopf (6.2): Der Main sucht die Aktion und löst auf wie beim GO.
    const a = doc.rows.find((r) => r.id === rowId)?.actions.find((x) => x.id === actionId);
    if (!a) return false;
    const args = argsZumSenden(a);
    if (!args) {
      getLog().warn('Test-Fire TIMER GOTO nicht gesendet: Ziel entfallen');
      return false;
    }
    const line = buildActionLine(a.role, a.verb, args);
    const delivered = conductor.fire(a.role, line);
    getLog().info(`Test-Fire ${line}${delivered ? '' : ' (offline)'}`);
    return delivered;
  });
  ipcMain.handle('rundown:setEndpoint', (_e, role: string, host: string, port: number) => {
    conductor.setOverrides(setOverride(role, host || null, Number.isFinite(port) ? port : null));
    return buildState();
  });
  ipcMain.handle('rundown:pickFile', async () => {
    // Datei-Dialog für Pfad-Argumente (z. B. PRESENTER OPEN). Hinweis: Der Pfad
    // gilt auf dem Ziel-Rechner — sinnvoll bei gemeinsamem/UNC-Laufwerk oder
    // gleichem Rechner; sonst Pfad direkt eintippen.
    const r = await dialog.showOpenDialog({
      title: 'Datei wählen',
      properties: ['openFile'],
      filters: [
        { name: 'Präsentationen', extensions: ['pdf', 'pptx', 'ppt', 'odp', 'jmpres', 'png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });
  ipcMain.handle('rundown:importRegieplan', async () => {
    // Regieplan (Excel/CSV) wählen + Bytes an den Renderer geben (parst dort mit
    // SheetJS, Issue #82). Dasselbe Spaltenformat wie der JM-Timer-Import.
    const r = await dialog.showOpenDialog({
      title: 'Regieplan importieren',
      properties: ['openFile'],
      filters: [
        { name: 'Regieplan (Excel/CSV)', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return { name: path.basename(r.filePaths[0]), bytes: new Uint8Array(readFileSync(r.filePaths[0])) };
  });
  ipcMain.handle('rundown:setDoc', (_e, next: RundownDoc, basisRev: number) => {
    // 5.5: Abgewiesen wird nur, wenn seit dem Stand des Renderers ein Abgleich lief.
    if (typeof basisRev !== 'number' || !nimmAenderungAn(basisRev, abgleichRev)) {
      abweisungen++;
      hinweis(abweisungText(mitIveo()), 'stehend');
      getLog().warn(`Änderung abgewiesen: Stand ${String(basisRev)}, letzter Abgleich bei ${abgleichRev}.`);
      broadcast();
      return buildState();
    }
    uebernimmBearbeitung(next);
    return buildState();
  });
  ipcMain.handle('rundown:hinweisWeg', (_e, id: number) => {
    entferneHinweis(id);
    return buildState();
  });
  ipcMain.handle('rundown:alsEigeneZeile', (_e, rowId: string) => {
    // 4.3: Eine entfallene Zeile wird an derselben Stelle zur eigenen Zeile mit
    // neuer id; war sie scharf, bleibt sie es.
    const i = doc.rows.findIndex((r) => r.id === rowId);
    const alt = doc.rows[i];
    if (alt && alt.quelle === 'ablauf' && alt.entfallen) {
      const eigen = alsEigeneZeile(alt, newId('r'));
      const rows = doc.rows.slice();
      rows[i] = eigen;
      if (scharfId === rowId) scharfId = eigen.id;
      doc = migrate({ ...doc, rows });
      rev++;
      dirty = true;
      sichere();
      broadcast();
    }
    return buildState();
  });
  ipcMain.handle('rundown:new', () => {
    vergissShow();
    ersetzeDoc(defaultDoc(), null);
    return buildState();
  });
  ipcMain.handle('rundown:open', async () => {
    await openDialog();
    return buildState();
  });
  ipcMain.handle('rundown:save', async () => {
    await saveDialog(false);
    return buildState();
  });
  ipcMain.handle('rundown:saveAs', async () => {
    await saveDialog(true);
    return buildState();
  });
}

// ── Show-Integration (Teil 2a, Spec 5.2): Ladewege über Gedächtnis und Abgleich ──
// Die Show liefert den Ablauf (show.ablauf, aus iveo oder dem Show-Editor); der
// Rundown gleicht ihn mit seinem Stand ab (wendeShowAn), statt ihn zu ersetzen.
// Eine eigene `.jmrundown` der Show ist nur noch der Ausgangsstand (4.8).

/** Bei jedem Lesen der Show auffrischen (5.2): iveo-Listen und die Daten für 6.2. */
function merkeShowDaten(g: Extract<ShowGelesen, { ok: true }>): void {
  iveoSpeakers = g.show.iveo?.speakers ?? [];
  iveoSideEvents = g.show.iveo?.sideEvents ?? [];
  ablaufSchluessel = g.ablaufSchluessel;
  eigeneTimerListe = g.eigeneTimerListe;
  showHatIveo = !!g.show.iveo;
  showName = g.show.name;
}

/** R0-Umbenennungen eines Abgleichs für verzögerte Sprünge festhalten (6.2); nur solange GO-Folgen ausstehen. */
function merkeUmbenennungen(umbenannt: Record<string, string>): void {
  if (fireTimers.length > 0 && Object.keys(umbenannt).length > 0) umbenennungen.push(umbenannt);
}

/** Hinweise zu einem Abgleich (4.6): Kontextwechsel ODER Bericht, dazu ggf. die verrückte scharfe Zeile. */
function zeigeAbgleichHinweise(res: ReturnType<typeof wendeShowAn>, show: Show): void {
  if (res.kontextGewechselt) {
    hinweis(kontextWechselText(res.doc.kontext ?? '', show.iveo?.sideEvents ?? []), 'kurz');
  } else if (res.bericht && !berichtIstLeer(res.bericht)) {
    const text = berichtText(res.bericht, !!show.iveo);
    if (text) hinweis(text, 'kurz');
  }
  if (res.bericht?.scharfVerrueckt) hinweis(scharfVerruecktText(res.bericht.scharfVerrueckt), 'stehend');
}

/**
 * Gedächtnis lesen. Inhalt kaputt → beiseitelegen und melden, aber nur wenn die
 * Kopie gelang. Lesefehler (EBUSY, EPERM …) oder gescheiterte Kopie → NICHT als
 * beschädigt behandeln, sondern sperren: `sichere()` überschreibt es nicht, ein
 * stehender Hinweis sagt es. Jedes Lesen hebt eine frühere Sperre auf, wenn es gelingt.
 */
function leseGedaechtnisMitMeldung(schluessel: string): GedaechtnisInhalt | null {
  const gelesen = leseGedaechtnis(regieOrdner(), schluessel);
  if (!gelesen.fehler) {
    if (gedaechtnisSperre !== null) getLog().info('Gedächtnis der Show wieder lesbar, Sperre aufgehoben.');
    gedaechtnisSperre = null;
    sperreGemeldet = false;
    hinweise = ohneHinweisText(hinweise, GEDAECHTNIS_GESPERRT);
    return gelesen.inhalt;
  }
  const folge = legeGedaechtnisFehlerBei(regieOrdner(), schluessel, gelesen.fehler);
  if (folge === 'beiseite') {
    gedaechtnisSperre = null;
    sperreGemeldet = false;
    hinweise = ohneHinweisText(hinweise, GEDAECHTNIS_GESPERRT);
    getLog().warn(`Gedächtnis ${schluessel}.json nicht lesbar (${gelesen.fehler}), als .defekt.json beiseitegelegt.`);
    hinweis(GEDAECHTNIS_DEFEKT, 'stehend');
  } else {
    if (gedaechtnisSperre !== schluessel) sperreGemeldet = false;
    gedaechtnisSperre = schluessel;
    getLog().warn(`Gedächtnis ${schluessel}.json nicht lesbar (${gelesen.fehler}), gesperrt: wird nicht überschrieben.`);
    if (!hinweise.some((h) => h.text === GEDAECHTNIS_GESPERRT)) hinweis(GEDAECHTNIS_GESPERRT, 'stehend');
  }
  return null;
}

/** Eigene Rundown-Datei der Show lesen (4.8); null, wenn sie fehlt oder kaputt ist. */
function leseRundownDatei(pfad: string): { doc: RundownDoc; stand: DateiStand } | null {
  const stand = dateiStand(pfad);
  if (!stand) {
    getLog().warn(`Rundown-Datei der Show nicht gefunden: ${pfad}`);
    return null;
  }
  try {
    return { doc: readDoc(pfad), stand };
  } catch (err) {
    // G6: die JSON-Meldung zitiert Dateiinhalt → nur die Art des Fehlers.
    const grund = err instanceof SyntaxError ? 'kein gültiges JSON' : ((err as NodeJS.ErrnoException).code ?? 'Lesefehler');
    getLog().warn(`Rundown-Datei der Show nicht lesbar (${grund}): ${pfad}`);
    return null;
  }
}

/**
 * Andere Show laden (5.2, Zeile „andere Show“; auch Start über den Zeiger):
 * Show merken, Ausgangsstand wählen (Gedächtnis bzw. eigene Datei nach 4.8 →
 * alter Autosave nach der Übergangsregel → leer), dann wendeShowAn. Bricht
 * laufende GO-Folgen ab wie bisher (5.4).
 */
function ladeAndereShow(pfad: string, g: Extract<ShowGelesen, { ok: true }>): void {
  const schluessel = gedaechtnisSchluessel(pfad);
  const gedaechtnis = leseGedaechtnisMitMeldung(schluessel);
  const rdPfad = rundownDateiDerShow(pfad, g.show);
  const datei = rdPfad ? leseRundownDatei(rdPfad) : null;

  merkeShowDaten(g);
  showPfad = pfad;
  showRundownDatei = rdPfad;
  if (!schreibeZeiger(regieOrdner(), { showPfad: pfad, schluessel })) {
    getLog().warn('Zeiger auf die gemerkte Show konnte nicht geschrieben werden.');
  }

  if (g.ablaufSchluessel.length === 0 && !rdPfad && !gedaechtnis) {
    // 5.2: Show ohne Ablauf und ohne eigene Rundown-Datei → merken, das aktuelle
    // Dokument bleibt unangetastet und wird NICHT als Gedächtnis der Show geschrieben
    // (es gehört nicht zu ihr, 4.7). Bekommt sie danach einen Ablauf, lädt RELOAD sie
    // wie eine andere Show.
    gedaechtnisDatei = null;
    rev++;
    abgleichRev = rev;
    broadcast();
    return;
  }

  const a = waehleAusgangsstand({
    gedaechtnis,
    datei,
    autosave: autosaveDoc,
    autosaveWarV1: autosaveDoc?.zuordnungOffen === true,
    showName: g.show.name,
  });
  let start: RundownDoc = { schemaVersion: 2, name: g.show.name, rows: [] };
  let startScharf: string | null = null;
  switch (a.quelle) {
    case 'gedaechtnis':
      start = a.doc;
      startScharf = a.scharfId;
      dirty = a.ungespeichert;
      filePath = rdPfad;
      gedaechtnisDatei = rdPfad ? (gedaechtnis?.datei ?? null) : null;
      break;
    case 'datei':
      start = a.doc;
      dirty = false;
      filePath = rdPfad;
      gedaechtnisDatei = datei?.stand ?? null;
      if (a.hinweisAusserhalb) hinweis(DATEI_AUSSERHALB, 'kurz');
      break;
    case 'autosave-v1': {
      start = a.doc;
      dirty = false;
      filePath = null;
      gedaechtnisDatei = null;
      // Übergangsregel 5.2: vorher einmal sichern. Danach gilt der Autosave als
      // übernommen (Ergänzung 0.7: einmalig) und wird ohne Altformat-Marke abgelegt.
      if (sichereAltenAutosave(app.getPath('userData'))) {
        if (autosaveDoc) {
          const uebernommen: RundownDoc = { ...autosaveDoc };
          delete uebernommen.zuordnungOffen;
          saveAutosave(uebernommen);
          autosaveDoc = uebernommen;
        }
        getLog().info('Alter Autosave übernommen, gesichert als rundown.autosave.v1.jmrundown.');
      } else {
        getLog().warn('Alter Autosave übernommen, die Sicherung rundown.autosave.v1.jmrundown ist gescheitert.');
      }
      break;
    }
    case 'leer':
      dirty = false;
      filePath = null;
      gedaechtnisDatei = null;
      break;
  }

  cancelPendingFires();
  lastFired = null;
  const res = wendeShowAn({ doc: start, scharfId: startScharf, show: g.show });
  merkeUmbenennungen(res.umbenannt);
  doc = migrate(res.doc);
  scharfId = res.scharfId;
  rev++;
  abgleichRev = rev;
  // Hinweise nur bei einem schon abgeglichenen Vorstand; ein leeres oder nie
  // abgeglichenes Dokument „ändert“ sich nicht, es entsteht.
  if (start.kontext !== undefined) zeigeAbgleichHinweise(res, g.show);
  sichere();
  broadcast();
}

/**
 * RUNDOWN RELOAD (5.1) bzw. dieselbe Show erneut per Deep-Link: Show neu lesen und
 * abgleichen, Position nach R7 bzw. 4.4. Bricht keine GO-Folge ab (5.4). Ist die
 * Show nicht lesbar, bleibt der Stand stehen (Review-Focus 1).
 */
function reloadShow(): void {
  if (!showPfad) {
    getLog().warn(RELOAD_OHNE_SHOW);
    hinweis(RELOAD_OHNE_SHOW, 'kurz');
    broadcast();
    return;
  }
  const g = leseShowSicher(showPfad);
  if (!g.ok) {
    getLog().error(`RELOAD: ${showNichtLesbarText(g.grund)}`);
    hinweis(showNichtLesbarText(g.grund), 'kurz');
    broadcast();
    return;
  }
  // Sperre prüfen: ein Lesen, das jetzt gelingt, hebt sie auf (Ruling Fix-Runde 1).
  if (gedaechtnisSperre !== null) leseGedaechtnisMitMeldung(gedaechtnisSperre);
  const warOhneAblauf = ablaufSchluessel.length === 0;
  if (ablaufNeuEntstanden(warOhneAblauf, g.ablaufSchluessel.length)) {
    // 5.2: Die Show hatte keinen Ablauf und hat jetzt einen → wie „andere Show“.
    ladeAndereShow(showPfad, g);
    return;
  }
  merkeShowDaten(g);
  showRundownDatei = rundownDateiDerShow(showPfad, g.show);
  const res = wendeShowAn({ doc, scharfId, show: g.show });
  merkeUmbenennungen(res.umbenannt);
  const neu = migrate(res.doc);
  if (res.scharfId !== scharfId || JSON.stringify(neu) !== JSON.stringify(doc)) {
    doc = neu;
    scharfId = res.scharfId;
    rev++;
    abgleichRev = rev;
    if (filePath) dirty = true;
    sichere();
  }
  zeigeAbgleichHinweise(res, g.show);
  broadcast();
}

/** Show-Deep-Link (5.2). Liefert true, wenn es ein Show-Link war. */
function applyShowFromDeepLink(url: string): boolean {
  const roh = parseShowDeepLink(url);
  if (!roh) return false;
  const pfad = path.resolve(roh);
  if (showPfad && gedaechtnisSchluessel(pfad) === gedaechtnisSchluessel(showPfad)) {
    // Dieselbe Show erneut: Abgleich wie RELOAD, Position bleibt (R7).
    reloadShow();
    return true;
  }
  const g = leseShowSicher(pfad);
  if (!g.ok) {
    getLog().error(`Show-Deep-Link konnte nicht geladen werden: ${g.grund}`);
    hinweis(showNichtLesbarText(g.grund), 'kurz');
    broadcast();
    return true;
  }
  ladeAndereShow(pfad, g);
  return true;
}

/**
 * Start ohne Show-Deep-Link (5.2: Launcher-Kachel, Neustart nach Absturz). Der
 * Zeiger führt zur gemerkten Show: lesbar → wie „andere Show“; nicht lesbar →
 * Gedächtnisstand laden, die Show bleibt gemerkt, das nächste RELOAD versucht es
 * erneut. Ohne Zeiger oder ohne Gedächtnis bleibt der Autosave wie bisher.
 */
function starteOhneDeepLink(): void {
  const z = leseZeiger(regieOrdner());
  if (!z) return;
  const g = leseShowSicher(z.showPfad);
  if (g.ok) {
    ladeAndereShow(z.showPfad, g);
    return;
  }
  getLog().error(`Gemerkte Show: ${showNichtLesbarText(g.grund)}`);
  hinweis(showNichtLesbarText(g.grund), 'kurz');
  const gedaechtnis = leseGedaechtnisMitMeldung(gedaechtnisSchluessel(z.showPfad));
  if (gedaechtnis) {
    showPfad = z.showPfad;
    showName = gedaechtnis.showName;
    doc = gedaechtnis.doc;
    const gemerkt = gedaechtnis.scharfId;
    scharfId = gemerkt !== null && doc.rows.some((r) => r.id === gemerkt) ? gemerkt : ersteLebendeZeile(doc.rows);
    gedaechtnisDatei = gedaechtnis.datei ?? null;
    showRundownDatei = gedaechtnisDatei?.pfad ?? null;
    filePath = showRundownDatei;
    // Ohne lesbare Show: Schlüssel aus den lebenden Ablaufzeilen (Stand des letzten
    // Abgleichs), iveo aus dem Kontext; die eigene Timer-Liste ist unbekannt.
    ablaufSchluessel = ablaufSchluesselAusZeilen(doc.rows);
    eigeneTimerListe = false;
    showHatIveo = kontextIstIveo(doc.kontext);
    rev++;
    abgleichRev = rev;
  }
  broadcast();
}

function rendererUrl(): string | undefined {
  return process.env['ELECTRON_RENDERER_URL'];
}
function rendererFile(): string {
  return join(__dirname, '../renderer/index.html');
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Rundown',
    icon: resourcePath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.on('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  const url = rendererUrl();
  if (url) win.loadURL(url);
  else win.loadFile(rendererFile());
  mainWindow = win;
  return win;
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
const runtime = initAppRuntime({ csp: true,
  appId: 'jm-rundown',
  appName: 'JM Rundown',
  onDeepLink: (url) => applyShowFromDeepLink(url),
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    // Letzten Stand wiederherstellen (sofern weder Deep-Link noch Zeiger greift).
    const saved = loadAutosave();
    autosaveDoc = saved;
    if (saved) doc = saved;
    scharfId = ersteLebendeZeile(doc.rows);
    registerIpc();
    createMainWindow();
    // Ein Show-Deep-Link hat Vorrang; sonst führt der Zeiger zur gemerkten Show (5.2).
    const perShowLink = runtime.initialDeepLink ? applyShowFromDeepLink(runtime.initialDeepLink) : false;
    if (!perShowLink) starteOhneDeepLink();
    // start() zuerst: liest die geteilte Steuer-Konfig (Token/TLS für secure-Modus),
    // bevor setOverrides die ersten Clients erzeugt — sonst verbänden sie plain.
    conductor.start(app.getPath('appData'));
    conductor.setOverrides(getOverrides());
    // Eigener Steuerserver: Rundown selbst per Companion fern-GO-bar (Port 8731).
    void startControlServer({ getState: buildSuiteState, onCommand: handleSuiteCommand });
  });

  app.on('before-quit', () => {
    conductor.stop();
    stopControlServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
