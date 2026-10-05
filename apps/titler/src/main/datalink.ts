// --- JM Titler: DataLink-Watchfolder (#86) mit Recall (#93-Folgewunsch) ---
//
// Überwacht einen Ordner auf Datendateien und stellt daraus eine LISTE von
// Einträgen bereit, die einzeln „abgerufen" (recall) werden können — per UI,
// per Companion (RECALL/NEXT/PREV) oder per Steuerprotokoll. Der aktive Eintrag
// liefert die Variablen-Tabelle, aus der die `{{schlüssel}}`-Platzhalter in den
// Textfeldern aufgelöst werden (siehe shared/vars.ts). Vgl. TriCaster DataLink.
//
// Master-Link Teil 2b (Spec 7.1): Dieses Modul liest und beobachtet nur noch den
// Ordner. Dateien lesen, Schlüssel bilden, den aktiven Eintrag über seinen SCHLÜSSEL
// halten (nicht über die Nummer), Abruf und Hinweise macht der reine Kern
// `shared/datalink-kern.ts`. Hier dazu: die Uhr, die einen gehaltenen Eintrag 1 s
// nach dem Ende der Sendung fallen lässt (A4, HALTEN_NACH_SENDUNG_MS über
// `wegAbMs` im Kern).
//
// Quellformate (alle Dateien im Ordner werden alphabetisch zusammengeführt):
//   • CSV/TSV  → tabellarische LISTE: erste Zeile = Spaltennamen (= Variablen),
//                jede weitere Zeile = ein Eintrag; Spalte `@kennung` = Schlüssel.
//   • .txt/.env/.ini/.properties → `schlüssel=wert` / `schlüssel: wert`,
//                die ganze Datei = EIN Eintrag.
//
// Bewusst ohne Zusatz-Dependency (kein chokidar): fs.watch auf das Verzeichnis,
// entprellt, plus ein niederfrequenter mtime-Poll als Sicherheitsnetz gegen
// verschluckte Events (fs.watch ist je nach Plattform unzuverlässig).
// Ohne Electron: der Titler-Selbsttest (tsx) lädt das Modul direkt.
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';
import {
  companionWerte,
  fuehreZusammen,
  HALTEN_NACH_SENDUNG_MS,
  kernSicht,
  leererKern,
  neueListe,
  parseKvDatei,
  parseTable,
  rufeAb,
  rufeSchluesselAb,
  schritt,
  setzeSendung,
  uhrTick,
  type DataEntry,
  type KernSchritt,
  type KernSicht,
  type KernZustand,
} from '../shared/datalink-kern';

/** Vom Watchfolder akzeptierte Endungen. */
const DATA_EXT = new Set(['.txt', '.env', '.csv', '.tsv', '.ini', '.properties']);

export interface DataState extends KernSicht {
  /** Dateinamen, die beigetragen haben. */
  sources: string[];
  /** Lesefehler (z. B. Ordner fehlt) — sonst undefined. */
  error?: string;
  /** Werte für den Companion-STATE: entry, entry_index, entry_count (Spec 7.5). */
  companion: { entry: string; entryIndex: number; entryCount: number };
}

let watcher: FSWatcher | null = null;
let debounce: NodeJS.Timeout | null = null;
let poll: NodeJS.Timeout | null = null;
let watchedDir = '';
/** Zuletzt beobachteter Ordner; `null` = noch keiner (der erste Start zählt als Ordnerwechsel). */
let zuletztBeobachtet: string | null = null;
let lastSig = '';
/** Quelle Show/früher: eine leer gelesene Liste ändert nichts (A7, Spec 7.6). */
let leerHalten = false;
let kern: KernZustand = leererKern();
let quellen: { sources: string[]; error?: string } = { sources: [] };
let current: DataState = baueState();
let listener: ((d: DataState) => void) | null = null;
let logZeile: ((m: string) => void) | null = null;
/** Uhr für A4: feuert, wenn `kern.wegAbMs` erreicht ist. */
let uhr: NodeJS.Timeout | null = null;
let uhrZiel: number | null = null;
/** Schon abgelaufene Frist — wird nie ein zweites Mal geplant. */
let uhrErledigt: number | null = null;

function baueState(): DataState {
  return { ...kernSicht(kern), sources: quellen.sources, error: quellen.error, companion: companionWerte(kern) };
}

/** Einen Kern-Schritt übernehmen: Zustand, Logzeilen (Spec 7.9), Uhr, Meldung an den Main. */
function anwenden(s: KernSchritt): void {
  kern = s.zustand;
  for (const zeile of s.log) logZeile?.(zeile);
  planeUhr();
  current = baueState();
  listener?.(current);
}

/** Die Uhr an `kern.wegAbMs` ausrichten: planen, verschieben oder abbrechen. */
function planeUhr(): void {
  const ziel = kern.wegAbMs;
  if (ziel === uhrZiel || (ziel !== null && ziel === uhrErledigt)) return;
  if (uhr) clearTimeout(uhr);
  uhr = null;
  uhrZiel = ziel;
  if (ziel === null) return;
  // Höchstens HALTEN_NACH_SENDUNG_MS: eine zurückgestellte Systemuhr verlängert das Halten nicht.
  const warten = Math.min(Math.max(0, ziel - Date.now()), HALTEN_NACH_SENDUNG_MS);
  uhr = setTimeout(uhrLaeuft, warten);
}

function uhrLaeuft(): void {
  const ziel = uhrZiel;
  uhr = null;
  uhrZiel = null;
  uhrErledigt = ziel; // eine abgelaufene Frist wird nie ein zweites Mal geplant
  if (ziel === null) return;
  // Feuert die Uhr, ist die Frist um. Node-Timer können eine Millisekunde vor Date.now()
  // feuern, deshalb gilt mindestens die Frist selbst als „jetzt“.
  anwenden(uhrTick(kern, Math.max(Date.now(), ziel)));
}

/** Ordner scannen: alle Datendateien lesen und über den Kern zu einer Liste zusammenführen. */
function scan(dir: string): { entries: DataEntry[]; sources: string[]; error?: string } {
  if (!dir) return { entries: [], sources: [] };
  if (!existsSync(dir)) return { entries: [], sources: [], error: 'Ordner nicht gefunden' };
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => DATA_EXT.has(extname(f).toLowerCase()));
  } catch (err) {
    return { entries: [], sources: [], error: (err as Error).message };
  }
  files.sort((a, b) => a.localeCompare(b));
  const teile: DataEntry[][] = [];
  const sources: string[] = [];
  for (const f of files) {
    try {
      const content = readFileSync(join(dir, f), 'utf8');
      const ext = extname(f).toLowerCase();
      let es: DataEntry[];
      if (ext === '.csv' || ext === '.tsv') {
        es = parseTable(content, f);
      } else {
        const e = parseKvDatei(content, f);
        es = e ? [e] : [];
      }
      if (es.length) {
        teile.push(es);
        sources.push(f);
      }
    } catch {
      // einzelne Datei korrupt oder gerade gesperrt → überspringen
    }
  }
  return { entries: fuehreZusammen(teile), sources };
}

/** Signatur über Datei-Namen+mtime+Größe für den Poll-Fallback. */
function signature(dir: string): string {
  if (!dir || !existsSync(dir)) return '';
  try {
    return readdirSync(dir)
      .filter((f) => DATA_EXT.has(extname(f).toLowerCase()))
      .sort()
      .map((f) => {
        try {
          const s = statSync(join(dir, f));
          return `${f}:${s.mtimeMs}:${s.size}`;
        } catch {
          return f;
        }
      })
      .join('|');
  } catch {
    return '';
  }
}

function rescan(andererOrdner = false): void {
  const r = scan(watchedDir);
  // A7 (wie neueListe nur im selben Ordner): bleibt die alte Liste stehen, bleiben auch ihre Quellen stehen.
  const behalten = r.entries.length === 0 && leerHalten && !andererOrdner;
  quellen = { sources: behalten ? quellen.sources : r.sources, error: r.error };
  lastSig = signature(watchedDir);
  anwenden(neueListe(kern, r.entries, { andererOrdner, leerHalten }));
}

function scheduleRescan(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => rescan(), 250);
}

function schliesseBeobachter(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  if (poll) {
    clearInterval(poll);
    poll = null;
  }
  if (watcher) {
    try {
      watcher.close();
    } catch {
      /* egal */
    }
    watcher = null;
  }
}

export function getDataState(): DataState {
  return current;
}

/** Eintrag abrufen (Spec 7.4): Nummer, Schlüssel, Label, Teilstring oder `@⟨Kennung⟩ ⟨Name⟩`. */
export function recall(ref: string): void {
  anwenden(rufeAb(kern, ref));
}

/** Klick in Liste oder Board: sucht nur den Schlüssel (Spec 7.4). */
export function recallSchluessel(key: string): void {
  anwenden(rufeSchluesselAb(kern, key));
}

/** Aktiven Eintrag um `delta` verschieben (geklemmt; ohne aktiven Eintrag → Eintrag 1). */
export function step(delta: number): void {
  anwenden(schritt(kern, delta));
}

/**
 * Sendung an den Kern melden (A2/A4). Nur ein Wechsel zählt: der Renderer meldet seinen
 * Zustand auch bei NDI- oder Vorlagen-Änderungen, und jede weitere Meldung „aus“ würde
 * die 1-s-Frist sonst neu starten.
 */
export function setzeAufSendung(onAir: boolean): void {
  if (kern.aufSendung === onAir) return;
  anwenden(setzeSendung(kern, onAir, Date.now()));
}

/** Ordner sofort neu einlesen (für Tests; im Betrieb lesen fs.watch und der Poll). */
export function rescanJetzt(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  rescan();
}

/**
 * Watchfolder (neu) setzen. Leerer Pfad = nichts lesen (leere Liste). `cb` bekommt jeden
 * neuen Stand (und den ersten). Der Kernzustand bleibt bei einem Ordnerwechsel erhalten
 * (A8/A9): der Kern gleicht den aktiven Eintrag über seinen Schlüssel ab.
 * `leerHalten`: Quelle Show/früher (A7). `log`: Logzeilen des Kerns (Spec 7.9).
 */
export function startDataWatch(
  dir: string,
  cb: (d: DataState) => void,
  o: { leerHalten: boolean; log?: (m: string) => void },
): void {
  listener = cb;
  leerHalten = o.leerHalten;
  logZeile = o.log ?? null;
  const ziel = dir || '';
  if (ziel === watchedDir && watcher) {
    rescan(); // gleicher Ordner → nur frisch einlesen
    return;
  }
  schliesseBeobachter();
  const andererOrdner = ziel !== zuletztBeobachtet;
  watchedDir = ziel;
  zuletztBeobachtet = ziel;
  rescan(andererOrdner);
  if (!watchedDir) return;
  try {
    watcher = watch(watchedDir, { persistent: false }, () => scheduleRescan());
  } catch {
    watcher = null; // Ordner fehlt o. Ä. → Poll fängt es ab
  }
  poll = setInterval(() => {
    if (signature(watchedDir) !== lastSig) rescan();
  }, 3000);
}

/** Beobachtung beenden und den Kern zurücksetzen — nur beim Beenden der App (und im Test). */
export function stopDataWatch(keepListener = false): void {
  schliesseBeobachter();
  if (uhr) {
    clearTimeout(uhr);
    uhr = null;
  }
  uhrZiel = null;
  uhrErledigt = null;
  watchedDir = '';
  zuletztBeobachtet = null;
  lastSig = '';
  kern = leererKern();
  quellen = { sources: [] };
  current = baueState();
  if (!keepListener) {
    listener = null;
    logZeile = null;
  }
}
