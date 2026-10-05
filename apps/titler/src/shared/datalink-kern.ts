// --- JM Titler: DataLink-Kern (Master-Link Teil 2b, Spec 7.1–7.5) ---
//
// Ohne Electron und ohne fs: Tabellen und `schlüssel=wert`-Dateien lesen, je Eintrag einen
// Schlüssel bilden (Spec 7.2) und die Dateien eines Ordners zu einer Liste zusammenführen.
// `main/datalink.ts` liest die Dateien von der Platte und ruft diese Funktionen. Zur Laufzeit
// importiert das Modul nur `@jm/show` — der Selbsttest lädt es mit tsx, ohne Electron.
import { loeseDoppelteKennungenAuf } from '@jm/show';

/** Spalte mit der Speaker-Kennung (Spec 7.2). `@` ist kein Platzhalter-Zeichen, `{{@kennung}}` löst nie auf. */
export const KENNUNG_SPALTE = '@kennung';
/** Höchstlänge eines Schlüssels; längere werden gekürzt (Spec 7.2, wie 2a-Spec 3.5). */
export const SCHLUESSEL_MAX = 200;
/** Spaltennamen/Schlüssel, die als Eintrags-Label (für Recall-by-name) dienen. */
const LABEL_KEYS = ['name', 'label', 'titel', 'title'];

export interface DataEntry {
  /** Kennung aus der Spalte `@kennung`, sonst der Ersatz-Schlüssel (Spec 7.2). */
  key: string;
  /** Anzeige-/Recall-Name des Eintrags. */
  label: string;
  /** Dateiname ohne Ordner. Die Brücke (Spec 7.3) braucht ihn, ein `@kennung`-Schlüssel enthält ihn nicht. */
  datei: string;
  /** Variablen dieses Eintrags (schlüssel → wert), ohne die Spalte `@kennung`. */
  vars: Record<string, string>;
}

/**
 * Ersatz-Schlüssel (Spec 7.2), nur im Titler gebildet, nie geschrieben:
 * `ersatz:<Datei>|<Label>` für eine CSV/TSV-Zeile, `ersatz:<Datei>` für eine `schlüssel=wert`-Datei.
 */
export function ersatzSchluessel(datei: string, label?: string): string {
  return label === undefined ? `ersatz:${datei}` : `ersatz:${datei}|${label}`;
}

/** Ist das ein Ersatz-Schlüssel (und keine Kennung)? */
export function istErsatzSchluessel(key: string): boolean {
  return key.startsWith('ersatz:');
}

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

function splitDelimited(line: string, delim: string): string[] {
  return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/**
 * CSV/TSV mit Kopfzeile → Liste von Einträgen (Spalten = Variablen). Die Spalte `@kennung`
 * (ohne Rücksicht auf Groß- und Kleinschreibung) wird zum Schlüssel: Sie steht nicht in `vars`
 * und dient nie als Label, auch nicht als Rückfall. Fehlt sie oder ist sie leer, gilt der
 * Ersatz-Schlüssel `ersatz:<datei>|<Label>`.
 */
export function parseTable(content: string, datei: string): DataEntry[] {
  // Zeilen NICHT als Ganzes trimmen: Ein Tab am Zeilenanfang ist eine leere erste Zelle (z. B. eine
  // leere `@kennung` vorn). Getrimmt wird je Zelle in splitDelimited.
  const rows = content.split(/\r?\n/).filter((r) => r.trim() && !r.trim().startsWith('#'));
  if (rows.length < 2) return []; // nur Kopfzeile oder leer → keine Einträge
  const delim = rows[0].includes('\t') ? '\t' : rows[0].includes(';') ? ';' : ',';
  const header = splitDelimited(rows[0], delim);
  const kennungCol = header.findIndex((h) => h.toLowerCase() === KENNUNG_SPALTE);
  const labelCol = header.findIndex((h, i) => i !== kennungCol && LABEL_KEYS.includes(h.toLowerCase()));
  const out: DataEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = splitDelimited(rows[r], delim);
    if (cells.every((c) => !c)) continue;
    const vars: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) if (header[i] && i !== kennungCol) vars[header[i]] = cells[i] ?? '';
    const ohneKennung = cells.filter((_c, i) => i !== kennungCol);
    const label = ((labelCol >= 0 ? cells[labelCol] : '') || ohneKennung[0] || `#${out.length + 1}`).trim();
    const kennung = kennungCol >= 0 ? (cells[kennungCol] ?? '') : '';
    out.push({ key: kennung || ersatzSchluessel(datei, label), label, datei, vars });
  }
  return out;
}

/**
 * `schlüssel=wert`-Datei → ein Eintrag mit dem Schlüssel `ersatz:<datei>`; `null` ohne Variablen.
 * Label aus name/label/titel/title, sonst der Dateiname ohne Endung.
 */
export function parseKvDatei(content: string, datei: string): DataEntry | null {
  const vars: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const kv = parseLine(line);
    if (kv) vars[kv[0]] = kv[1];
  }
  if (!Object.keys(vars).length) return null;
  let label = '';
  for (const k of Object.keys(vars)) {
    if (LABEL_KEYS.includes(k.toLowerCase()) && vars[k].trim()) {
      label = vars[k].trim();
      break;
    }
  }
  // Dateiname ohne Endung, ohne node:path: „gast.txt“ → „gast“, „a.b.txt“ → „a.b“.
  if (!label) label = datei.replace(/(.)\.[^.]*$/, '$1');
  return { key: ersatzSchluessel(datei), label, datei, vars };
}

/**
 * Die Einträge aller Dateien (in Lesereihenfolge) zu einer Liste zusammenführen. Schlüssel über
 * 200 Zeichen werden gekürzt, doppelte über `loeseDoppelteKennungenAuf` aufgelöst (der erste
 * behält seinen, jeder weitere bekommt `#2`, `#3` …). Gleiche Eingabe → gleiche Schlüssel, also
 * stabil über das Neueinlesen.
 */
export function fuehreZusammen(teile: DataEntry[][]): DataEntry[] {
  const flach = teile
    .flat()
    .map((e) => (e.key.length > SCHLUESSEL_MAX ? { ...e, key: e.key.slice(0, SCHLUESSEL_MAX) } : e));
  return loeseDoppelteKennungenAuf(flach.map((e) => ({ id: e.key, e }))).map((x) =>
    x.id === x.e.key ? x.e : { ...x.e, key: x.id },
  );
}
