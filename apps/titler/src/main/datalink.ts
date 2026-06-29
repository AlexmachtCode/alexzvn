// --- JM Titler: DataLink-Watchfolder (#86) mit Recall (#93-Folgewunsch) ---
//
// Überwacht einen Ordner auf Datendateien und stellt daraus eine LISTE von
// Einträgen bereit, die einzeln „abgerufen" (recall) werden können — per UI,
// per Companion (RECALL/NEXT/PREV) oder per Steuerprotokoll. Der aktive Eintrag
// liefert die Variablen-Tabelle, aus der die `{{schlüssel}}`-Platzhalter in den
// Textfeldern aufgelöst werden (siehe shared/vars.ts). Vgl. TriCaster DataLink.
//
// Quellformate (alle Dateien im Ordner werden alphabetisch zusammengeführt):
//   • CSV/TSV  → tabellarische LISTE: erste Zeile = Spaltennamen (= Variablen),
//                jede weitere Zeile = ein Eintrag.
//   • .txt/.env/.ini/.properties → `schlüssel=wert` / `schlüssel: wert`,
//                die ganze Datei = EIN Eintrag (Label aus name/label/titel
//                oder Dateiname).
//
// Bewusst ohne Zusatz-Dependency (kein chokidar): fs.watch auf das Verzeichnis,
// entprellt, plus ein niederfrequenter mtime-Poll als Sicherheitsnetz gegen
// verschluckte Events (fs.watch ist je nach Plattform unzuverlässig).
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { basename, extname, join } from 'node:path';

/** Vom Watchfolder akzeptierte Endungen. */
const DATA_EXT = new Set(['.txt', '.env', '.csv', '.tsv', '.ini', '.properties']);
/** Spaltennamen/Schlüssel, die als Eintrags-Label (für Recall-by-name) dienen. */
const LABEL_KEYS = ['name', 'label', 'titel', 'title'];

export interface DataEntry {
  /** Anzeige-/Recall-Name des Eintrags. */
  label: string;
  /** Variablen dieses Eintrags (schlüssel → wert). */
  vars: Record<string, string>;
}

export interface DataState {
  /** Alle abrufbaren Einträge (Reihenfolge = Recall-Reihenfolge). */
  entries: DataEntry[];
  /** Index des aktiven Eintrags, -1 wenn keiner. */
  activeIndex: number;
  /** Variablen des aktiven Eintrags (Convenience; {} wenn keiner). */
  variables: Record<string, string>;
  /** Dateinamen, die beigetragen haben. */
  sources: string[];
  /** Lesefehler (z. B. Ordner fehlt) — sonst undefined. */
  error?: string;
}

const EMPTY: DataState = { entries: [], activeIndex: -1, variables: {}, sources: [] };

let watcher: FSWatcher | null = null;
let debounce: NodeJS.Timeout | null = null;
let poll: NodeJS.Timeout | null = null;
let watchedDir = '';
let lastSig = '';
let activeIndex = -1;
let current: DataState = EMPTY;
let listener: ((d: DataState) => void) | null = null;

/** Eine Datenzeile `key=value` / `key: value` parsen. Kommentare (#, //, ;) raus. */
function parseLine(line: string): [string, string] | null {
  const t = line.trim();
  if (!t || t.startsWith('#') || t.startsWith('//') || t.startsWith(';')) return null;
  let idx = t.indexOf('=');
  if (idx < 0) idx = t.indexOf(':');
  if (idx <= 0) return null;
  const key = t.slice(0, idx).trim();
  let value = t.slice(idx + 1).trim();
  if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

/** `schlüssel=wert`-Datei → ein Eintrag (Variablen-Map). */
function parseKvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const kv = parseLine(line);
    if (kv) vars[kv[0]] = kv[1];
  }
  return vars;
}

function splitDelimited(line: string, delim: string): string[] {
  return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/** CSV/TSV mit Kopfzeile → Liste von Einträgen (Spalten = Variablen). */
function parseTable(content: string): DataEntry[] {
  const rows = content
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r && !r.startsWith('#'));
  if (rows.length < 2) return []; // nur Kopfzeile oder leer → keine Einträge
  const delim = rows[0].includes('\t') ? '\t' : rows[0].includes(';') ? ';' : ',';
  const header = splitDelimited(rows[0], delim);
  let labelCol = header.findIndex((h) => LABEL_KEYS.includes(h.toLowerCase()));
  if (labelCol < 0) labelCol = 0;
  const out: DataEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = splitDelimited(rows[r], delim);
    if (cells.every((c) => !c)) continue;
    const vars: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) if (header[i]) vars[header[i]] = cells[i] ?? '';
    const label = (cells[labelCol] || cells[0] || `#${out.length + 1}`).trim();
    out.push({ label, vars });
  }
  return out;
}

/** Label für einen key=wert-Eintrag aus bevorzugten Schlüsseln (sonst Dateiname). */
function labelFor(vars: Record<string, string>, file: string): string {
  for (const k of Object.keys(vars)) if (LABEL_KEYS.includes(k.toLowerCase()) && vars[k].trim()) return vars[k].trim();
  return basename(file, extname(file));
}

/** Ordner scannen: alle Datendateien lesen + zu einer Eintrags-Liste bündeln. */
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
  const entries: DataEntry[] = [];
  const sources: string[] = [];
  for (const f of files) {
    try {
      const content = readFileSync(join(dir, f), 'utf8');
      const ext = extname(f).toLowerCase();
      if (ext === '.csv' || ext === '.tsv') {
        const es = parseTable(content);
        if (es.length) {
          entries.push(...es);
          sources.push(f);
        }
      } else {
        const vars = parseKvFile(content);
        if (Object.keys(vars).length) {
          entries.push({ label: labelFor(vars, f), vars });
          sources.push(f);
        }
      }
    } catch {
      // einzelne Datei korrupt → überspringen
    }
  }
  return { entries, sources };
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

function emit(): void {
  current = {
    entries: current.entries,
    activeIndex,
    variables: activeIndex >= 0 ? current.entries[activeIndex].vars : {},
    sources: current.sources,
    error: current.error,
  };
  listener?.(current);
}

function rescan(): void {
  const r = scan(watchedDir);
  if (r.entries.length === 0) activeIndex = -1;
  else if (activeIndex < 0 || activeIndex >= r.entries.length) activeIndex = 0;
  current = { entries: r.entries, activeIndex, variables: {}, sources: r.sources, error: r.error };
  lastSig = signature(watchedDir);
  emit();
}

function scheduleRescan(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(rescan, 250);
}

export function getDataState(): DataState {
  return current;
}

/** Eintrag abrufen — `ref` = 1-basierte Nummer oder (Teil-)Name. */
export function recall(ref: string): void {
  if (!current.entries.length) return;
  const t = (ref ?? '').trim();
  if (!t) return;
  let idx = -1;
  if (/^\d+$/.test(t)) {
    idx = Number(t) - 1;
  } else {
    const lc = t.toLowerCase();
    idx = current.entries.findIndex((e) => e.label.toLowerCase() === lc);
    if (idx < 0) idx = current.entries.findIndex((e) => e.label.toLowerCase().includes(lc));
  }
  if (idx < 0 || idx >= current.entries.length) return;
  activeIndex = idx;
  emit();
}

/** Aktiven Eintrag um `delta` verschieben (geklemmt, kein Umlauf). */
export function step(delta: number): void {
  if (!current.entries.length) return;
  let idx = (activeIndex < 0 ? 0 : activeIndex) + delta;
  if (idx < 0) idx = 0;
  if (idx >= current.entries.length) idx = current.entries.length - 1;
  activeIndex = idx;
  emit();
}

/**
 * Watchfolder (neu) setzen. Leerer Pfad = deaktivieren. `cb` wird bei jeder
 * Änderung (und initial) mit dem neuen Zustand aufgerufen.
 */
export function startDataWatch(dir: string, cb: (d: DataState) => void): void {
  listener = cb;
  if (dir === watchedDir && watcher) {
    rescan(); // gleicher Ordner → nur frisch einlesen (activeIndex bleibt)
    return;
  }
  stopDataWatch(true);
  watchedDir = dir || '';
  activeIndex = -1; // neuer Ordner → erster Eintrag wird aktiv
  rescan();
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

export function stopDataWatch(keepListener = false): void {
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
  watchedDir = '';
  activeIndex = -1;
  current = EMPTY;
  if (!keepListener) listener = null;
}
