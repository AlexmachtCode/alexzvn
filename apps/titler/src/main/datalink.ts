// --- JM Titler: DataLink-Watchfolder (#86) ---
//
// Überwacht einen Ordner auf Datendateien (.txt/.env/.csv/.tsv) und führt deren
// `schlüssel=wert`-Paare zu EINER Variablen-Tabelle zusammen. Ändert sich eine
// Datei, wird neu eingelesen und der Renderer benachrichtigt (Live-Auflösung der
// `{{schlüssel}}`-Platzhalter in den Textfeldern — siehe shared/vars.ts).
//
// Bewusst ohne Zusatz-Dependency (kein chokidar): fs.watch auf das Verzeichnis,
// entprellt, plus ein niederfrequenter mtime-Poll als Sicherheitsnetz gegen
// verschluckte Events (fs.watch ist je nach Plattform unzuverlässig).
import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join } from 'node:path';

/** Vom Watchfolder akzeptierte Endungen. */
const DATA_EXT = new Set(['.txt', '.env', '.csv', '.tsv', '.ini', '.properties']);

export interface DataState {
  /** Aufgelöste Variablen (gemergt über alle Dateien, alphabetisch zuletzt gewinnt). */
  variables: Record<string, string>;
  /** Dateinamen, die beigetragen haben. */
  sources: string[];
  /** Lesefehler (z. B. Ordner fehlt) — sonst undefined. */
  error?: string;
}

let watcher: FSWatcher | null = null;
let debounce: NodeJS.Timeout | null = null;
let poll: NodeJS.Timeout | null = null;
let watchedDir = '';
let lastSig = '';
let current: DataState = { variables: {}, sources: [] };
let listener: ((d: DataState) => void) | null = null;

/** Eine Datenzeile `key=value` / `key: value` parsen. Kommentare (#, //) raus. */
function parseLine(line: string): [string, string] | null {
  const t = line.trim();
  if (!t || t.startsWith('#') || t.startsWith('//') || t.startsWith(';')) return null;
  // Trennzeichen: erstes `=` oder `:` (Doppelpunkt nur, wenn vor einem `=`).
  let idx = t.indexOf('=');
  if (idx < 0) idx = t.indexOf(':');
  if (idx <= 0) return null;
  const key = t.slice(0, idx).trim();
  let value = t.slice(idx + 1).trim();
  // Umschließende Anführungszeichen entfernen.
  if (value.length >= 2 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

/** CSV/TSV als zweispaltige key,value-Tabelle parsen (Trennzeichen autoerkannt). */
function parseDelimited(content: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const delim = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const cells = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length >= 2 && cells[0]) out.push([cells[0], cells.slice(1).join(' ').trim()]);
  }
  return out;
}

function parseFile(path: string): Array<[string, string]> {
  const content = readFileSync(path, 'utf8');
  const ext = extname(path).toLowerCase();
  if (ext === '.csv' || ext === '.tsv') return parseDelimited(content);
  const out: Array<[string, string]> = [];
  for (const line of content.split(/\r?\n/)) {
    const kv = parseLine(line);
    if (kv) out.push(kv);
  }
  return out;
}

/** Ordner scannen, alle Datendateien lesen + mergen. */
function scan(dir: string): DataState {
  if (!dir) return { variables: {}, sources: [] };
  if (!existsSync(dir)) return { variables: {}, sources: [], error: 'Ordner nicht gefunden' };
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => DATA_EXT.has(extname(f).toLowerCase()));
  } catch (err) {
    return { variables: {}, sources: [], error: (err as Error).message };
  }
  files.sort((a, b) => a.localeCompare(b));
  const variables: Record<string, string> = {};
  const sources: string[] = [];
  for (const f of files) {
    try {
      const pairs = parseFile(join(dir, f));
      if (pairs.length) {
        for (const [k, v] of pairs) variables[k] = v;
        sources.push(f);
      }
    } catch {
      // einzelne Datei korrupt → überspringen
    }
  }
  return { variables, sources };
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

function rescan(): void {
  current = scan(watchedDir);
  lastSig = signature(watchedDir);
  listener?.(current);
}

function scheduleRescan(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(rescan, 250);
}

export function getDataState(): DataState {
  return current;
}

/**
 * Watchfolder (neu) setzen. Leerer Pfad = deaktivieren. `cb` wird bei jeder
 * Änderung (und initial) mit dem neuen Zustand aufgerufen.
 */
export function startDataWatch(dir: string, cb: (d: DataState) => void): void {
  listener = cb;
  if (dir === watchedDir && watcher) {
    // gleicher Ordner → nur frisch einlesen
    rescan();
    return;
  }
  stopDataWatch(true);
  watchedDir = dir || '';
  rescan(); // initialer Stand (auch Fehler, falls Ordner fehlt)
  if (!watchedDir) return;
  try {
    watcher = watch(watchedDir, { persistent: false }, () => scheduleRescan());
  } catch {
    watcher = null; // Ordner fehlt o. Ä. → Poll fängt es ab
  }
  // Sicherheitsnetz: alle 3 s Signatur prüfen (verschluckte fs.watch-Events).
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
  if (!keepListener) listener = null;
}
