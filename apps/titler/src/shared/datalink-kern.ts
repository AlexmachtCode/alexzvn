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
// ── Aktiver Eintrag über den Schlüssel (Spec 7.3, 7.5, 7.8, 7.9) ─────────────────────────────

/** Stehender Hinweis (Spec 7.8). H1, H2, H5, H6 setzt der Kern, H3, H4, H7 die Datenquelle. */
export type Hinweis =
  | { art: 'H1'; label: string }
  | { art: 'H2'; label: string }
  | { art: 'H3' }
  | { art: 'H4'; grund: string }
  | { art: 'H5'; ref: string }
  | { art: 'H6'; ref: string; label: string }
  | { art: 'H7'; seit: string };

/** Ortszeit `hh:mm` einer ISO-Zeit (H7: `speakerVeraltetSeit`). Unlesbar → `--:--`. */
export function uhrzeit(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Text eines Hinweises, wörtlich aus Spec 7.8. */
export function hinweisText(h: Hinweis): string {
  switch (h.art) {
    case 'H1':
      return `„${h.label}“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.`;
    case 'H2':
      return `„${h.label}“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.`;
    case 'H3':
      return 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.';
    case 'H4':
      return `Liste aus früherem Stand: Show nicht lesbar (${h.grund}).`;
    case 'H5':
      return `Abruf „${h.ref}“: nicht in der Liste. Bitte einen Eintrag abrufen.`;
    case 'H6':
      return `Abruf „${h.ref}“: nicht in der Liste. Auf Sendung bleibt „${h.label}“, bis du sie ausblendest oder einen Eintrag abrufst.`;
    case 'H7':
      return `Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit ${uhrzeit(h.seit)}).`;
  }
}

/** Logzeile zu einem Hinweis der Datenquelle (Spec 7.9): nur H3 und H7, sonst null. */
export function hinweisLogZeile(h: Hinweis): string | null {
  if (h.art === 'H7') return `iveo: Show meldet Speakerliste nicht abrufbar seit ${uhrzeit(h.seit)}, Liste aus früherem Stand.`;
  if (h.art === 'H3') return 'iveo: Show ohne Speaker, Liste aus früherem Stand bleibt.';
  return null;
}

/** Vorrang (Spec 7.8): H1/H6 vor H2/H5 vor H4 vor H7 vor H3. Kleiner = steht vorn. */
const RANG: Record<Hinweis['art'], number> = { H1: 0, H6: 0, H2: 1, H5: 1, H4: 2, H7: 3, H3: 4 };

/** Den einen Hinweis wählen, der steht. Bei gleichem Rang gilt der zuerst übergebene. */
export function waehleHinweis(...hinweise: Array<Hinweis | null | undefined>): Hinweis | null {
  let vorn: Hinweis | null = null;
  for (const h of hinweise) if (h && (vorn === null || RANG[h.art] < RANG[vorn.art])) vorn = h;
  return vorn;
}

/** Halten nach dem Ende der Sendung (Spec 7.3 A4). Deckt die Ausblendung (450 ms, engine.ts:15) ab. */
export const HALTEN_NACH_SENDUNG_MS = 1000;

/** Ein Eintrag, der auf Sendung war und nicht mehr gilt. Seine Variablen bleiben eingefroren (Spec 7.3). */
export interface Gehalten {
  key: string;
  label: string;
  datei: string;
  vars: Record<string, string>;
  /** A2: aus der Liste verschwunden, kommt mit A5 zurück. A10: Abruf ohne Treffer, wird nie wieder aktiv. */
  grund: 'A2' | 'A10';
  /** Nur bei A10: der Abruf ohne Treffer (H6, nach dem Ende der Sendung H5). */
  ref?: string;
}

export interface KernZustand {
  eintraege: DataEntry[];
  /** Schlüssel des aktiven Eintrags, null ohne. Nie zugleich mit `gehalten` gesetzt. */
  aktiv: string | null;
  gehalten: Gehalten | null;
  /** Hinweis des Kerns: nur H1, H2, H5, H6. */
  hinweis: Hinweis | null;
  /** Zuletzt gemeldet: Bauchbinde auf Sendung (`on_air`). */
  aufSendung: boolean;
  /** Ab diesem Zeitpunkt fällt der gehaltene Eintrag weg (Ende der Sendung + 1 s); null = keine Frist. */
  wegAbMs: number | null;
}

/** Neuer Zustand und die Logzeilen dieses Schritts (Spec 7.9). */
export interface KernSchritt {
  zustand: KernZustand;
  log: string[];
}

export function leererKern(): KernZustand {
  return { eintraege: [], aktiv: null, gehalten: null, hinweis: null, aufSendung: false, wegAbMs: null };
}

/** Label-Vergleich für Brücke und Abruf: getrimmt, Leerraum zusammengefasst, klein. */
function normLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function stelleVon(eintraege: DataEntry[], key: string | null): number {
  return key === null ? -1 : eintraege.findIndex((e) => e.key === key);
}

/**
 * Brücke (Spec 7.3): der Kandidat der neuen Liste aus derselben Datei mit demselben Label — nur bei
 * genau einem Kandidaten und nur, wenn genau einer der beiden Schlüssel ein Ersatz-Schlüssel ist.
 * Zwei verschiedene Kennungen werden nie überbrückt.
 */
function bruecke(alt: { key: string; label: string; datei: string }, eintraege: DataEntry[]): DataEntry | null {
  const kandidaten = eintraege.filter((e) => e.datei === alt.datei && normLabel(e.label) === normLabel(alt.label));
  if (kandidaten.length !== 1) return null;
  return istErsatzSchluessel(alt.key) !== istErsatzSchluessel(kandidaten[0].key) ? kandidaten[0] : null;
}

function brueckenZeile(label: string, alt: string, neu: string): string {
  return `DataLink: „${label}“ hält seinen Eintrag, Schlüssel wechselt (${alt} → ${neu}).`;
}

/**
 * Eine neu eingelesene Liste anwenden (Spec 7.3: A1–A3, A5, A7–A9, Brücke).
 * - `leerHalten`: Eine leere Liste aus demselben Ordner lässt alles unverändert (A7). Der Aufrufer
 *   setzt es bei der Datenquelle Show bzw. frühere Show, nicht beim eigenen Ordner.
 * - `andererOrdner`: Der Ordner hat gewechselt (Quellenwechsel, auch der erste Start).
 */
export function neueListe(
  z: KernZustand,
  eintraege: DataEntry[],
  o: { andererOrdner: boolean; leerHalten: boolean },
): KernSchritt {
  const log: string[] = [];
  if (eintraege.length === 0 && o.leerHalten && !o.andererOrdner) return { zustand: z, log }; // A7
  const aktivWird = (stelle: number): KernZustand => ({
    ...z,
    eintraege,
    aktiv: eintraege[stelle].key,
    gehalten: null,
    hinweis: null,
    wegAbMs: null,
  });

  if (z.aktiv !== null) {
    const altStelle = stelleVon(z.eintraege, z.aktiv);
    const alt = altStelle >= 0 ? z.eintraege[altStelle] : null;
    const stelle = stelleVon(eintraege, z.aktiv);
    if (stelle >= 0) {
      // A1: derselbe Eintrag an seiner neuen Stelle, gezeichnet mit den Variablen der neuen Liste.
      if (stelle !== altStelle) {
        log.push(`DataLink: „${eintraege[stelle].label}“ hält seinen Eintrag (jetzt Nr. ${stelle + 1} von ${eintraege.length}).`);
      }
      return { zustand: { ...z, eintraege }, log };
    }
    const b = alt ? bruecke(alt, eintraege) : null;
    if (alt && b) {
      log.push(brueckenZeile(b.label, alt.key, b.key));
      return { zustand: { ...z, eintraege, aktiv: b.key }, log };
    }
    const label = alt?.label ?? '';
    if (o.andererOrdner && !z.aufSendung) {
      // A9: anderer Ordner, nicht auf Sendung → Eintrag 1 (bei leerer Liste keiner).
      return { zustand: eintraege.length ? aktivWird(0) : { ...z, eintraege, aktiv: null }, log };
    }
    if (z.aufSendung) {
      // A2 (auch A8): auf Sendung gehalten, Variablen eingefroren.
      log.push(`DataLink: aktiver Eintrag „${label}“ nicht mehr in der Liste, auf Sendung gehalten.`);
      const gehalten: Gehalten = { key: z.aktiv, label, datei: alt?.datei ?? '', vars: alt?.vars ?? {}, grund: 'A2' };
      return { zustand: { ...z, eintraege, aktiv: null, gehalten, hinweis: { art: 'H1', label } }, log };
    }
    // A3: kein aktiver Eintrag.
    log.push(`DataLink: aktiver Eintrag „${label}“ nicht mehr in der Liste, kein aktiver Eintrag.`);
    return { zustand: { ...z, eintraege, aktiv: null, hinweis: { art: 'H2', label } }, log };
  }

  if (z.gehalten !== null) {
    const g = z.gehalten;
    if (g.grund === 'A2') {
      let stelle = stelleVon(eintraege, g.key);
      if (stelle < 0) {
        const b = bruecke(g, eintraege);
        if (b) {
          log.push(brueckenZeile(b.label, g.key, b.key));
          stelle = eintraege.indexOf(b);
        }
      }
      if (stelle >= 0) return { zustand: aktivWird(stelle), log }; // A5
    }
    // Weiter gehalten. Ein nach A10 gehaltener Eintrag wird nie wieder aktiv.
    return { zustand: { ...z, eintraege }, log };
  }

  // Ohne aktiven und ohne gehaltenen Eintrag: nur ein Ordnerwechsel (auch der erste Start) ohne Sendung wählt
  // Eintrag 1 (A9). Auf Sendung (A8) bleibt es ohne Eintrag: Die Bauchbinde zeigt weiter leere Platzhalter,
  // statt ohne Abruf auf Person 1 zu springen; ein stehender Hinweis H2/H5 bleibt.
  if (o.andererOrdner && !z.aufSendung && eintraege.length) return { zustand: aktivWird(0), log };
  // Ein stehender H2 endet, sobald die Zeile wieder in der Liste steht: Der Hinweis "nicht mehr in der Liste" wäre sonst falsch.
  const h = z.hinweis;
  const h2Erledigt = h?.art === 'H2' && eintraege.some((e) => normLabel(e.label) === normLabel(h.label));
  return { zustand: { ...z, eintraege, hinweis: h2Erledigt ? null : z.hinweis }, log };
}

/**
 * Sendung gemeldet (`on_air`). Ein TAKE löscht die Frist. Endet die Sendung, fällt ein gehaltener
 * Eintrag `HALTEN_NACH_SENDUNG_MS` später weg (A4); eine wiederholte Meldung verschiebt die Frist nicht.
 */
export function setzeSendung(z: KernZustand, aufSendung: boolean, jetztMs: number): KernSchritt {
  if (aufSendung) return { zustand: { ...z, aufSendung: true, wegAbMs: null }, log: [] };
  const wegAbMs = z.gehalten ? (z.wegAbMs ?? jetztMs + HALTEN_NACH_SENDUNG_MS) : null;
  return { zustand: { ...z, aufSendung: false, wegAbMs }, log: [] };
}

/** Uhr (A4): Ist die Frist erreicht, gibt es keinen aktiven und keinen gehaltenen Eintrag mehr. */
export function uhrTick(z: KernZustand, jetztMs: number): KernSchritt {
  if (z.gehalten === null || z.wegAbMs === null || jetztMs < z.wegAbMs) return { zustand: z, log: [] };
  const g = z.gehalten;
  const leer: KernZustand = { ...z, aktiv: null, gehalten: null, wegAbMs: null };
  // Nach A10 wird H6 zu H5, ohne Logzeile: Der Eintrag steht oft noch in der Liste.
  if (g.grund === 'A10') return { zustand: { ...leer, hinweis: { art: 'H5', ref: g.ref ?? g.label } }, log: [] };
  return {
    zustand: { ...leer, hinweis: { art: 'H2', label: g.label } },
    log: [`DataLink: aktiver Eintrag „${g.label}“ nicht mehr in der Liste, kein aktiver Eintrag.`],
  };
}

/** Was die Fenster sehen (Spec 7.4): Einträge mit Schlüssel, Stelle des aktiven, gehaltener Eintrag. */
export interface KernSicht {
  entries: Array<{ key: string; label: string }>;
  /** Stelle des aktiven Eintrags, −1 ohne (auch bei gehaltenem). */
  activeIndex: number;
  gehalten?: { label: string };
  /** Variablen des aktiven, sonst des gehaltenen Eintrags, sonst leer. */
  variables: Record<string, string>;
  hinweis: Hinweis | null;
}

export function kernSicht(z: KernZustand): KernSicht {
  const activeIndex = stelleVon(z.eintraege, z.aktiv);
  const sicht: KernSicht = {
    entries: z.eintraege.map((e) => ({ key: e.key, label: e.label })),
    activeIndex,
    variables: activeIndex >= 0 ? z.eintraege[activeIndex].vars : (z.gehalten?.vars ?? {}),
    hinweis: z.hinweis,
  };
  if (z.gehalten) sicht.gehalten = { label: z.gehalten.label };
  return sicht;
}

/** Companion-STATE (Spec 7.5): `entry`, `entry_index` (1-basiert, gehalten/keiner 0), `entry_count`. */
export function companionWerte(z: KernZustand): { entry: string; entryIndex: number; entryCount: number } {
  const stelle = stelleVon(z.eintraege, z.aktiv);
  return {
    entry: stelle >= 0 ? z.eintraege[stelle].label : (z.gehalten?.label ?? ''),
    entryIndex: stelle + 1,
    entryCount: z.eintraege.length,
  };
}

// ── Abruf (Spec 7.4; 7.3 A6, A10, A11) ───────────────────────────────────────────────────────

/** A6: Der gewählte Eintrag wird aktiv. Gehaltener Eintrag, Hinweis und Frist entfallen. */
function waehle(z: KernZustand, stelle: number): KernSchritt {
  return { zustand: { ...z, aktiv: z.eintraege[stelle].key, gehalten: null, hinweis: null, wegAbMs: null }, log: [] };
}

/**
 * Abruf ohne Treffer (A10, A11). Der alte Eintrag bleibt nie still aktiv.
 * - Auf Sendung (A10): Der bisher aktive oder gehaltene Eintrag wird mit seinen Variablen gehalten, H6.
 *   Gab es keinen, bleibt es ohne Eintrag, H5.
 * - Ohne Sendung (A11): kein aktiver und kein gehaltener Eintrag, H5.
 */
function ohneTreffer(z: KernZustand, ref: string): KernSchritt {
  const stelle = stelleVon(z.eintraege, z.aktiv);
  const e = stelle >= 0 ? z.eintraege[stelle] : null;
  const bisher: Gehalten | null = e
    ? { key: e.key, label: e.label, datei: e.datei, vars: e.vars, grund: 'A10', ref }
    : z.gehalten
      ? { ...z.gehalten, grund: 'A10', ref }
      : null;
  if (z.aufSendung && bisher) {
    return {
      zustand: { ...z, aktiv: null, gehalten: bisher, hinweis: { art: 'H6', ref, label: bisher.label }, wegAbMs: null },
      log: [`DataLink: Abruf „${ref}“ ohne Treffer, auf Sendung gehalten.`],
    };
  }
  return {
    zustand: { ...z, aktiv: null, gehalten: null, hinweis: { art: 'H5', ref }, wegAbMs: null },
    log: [`DataLink: Abruf „${ref}“ ohne Treffer, kein aktiver Eintrag.`],
  };
}

/**
 * Eintrag abrufen (Spec 7.4) — Companion, Steuerprotokoll, Rundown. Danach hält der Titler den
 * Schlüssel, nicht die Nummer. Ein leerer `ref` bleibt wirkungslos.
 * - `@⟨Kennung⟩ ⟨Name⟩`: Schlüssel exakt (ohne Groß-/Kleinschreibung), sonst ein Label genau gleich
 *   dem Namen. Kein Teilstring. ⟨ref⟩ in H5/H6 ist der Name, ohne Namen die Kennung.
 * - nur Ziffern: Nummer (1-basiert), außerhalb der Liste = ohne Treffer
 * - sonst: Schlüssel exakt (ohne Groß-/Kleinschreibung), Label exakt, Label als Teilstring
 */
export function rufeAb(z: KernZustand, ref: string): KernSchritt {
  const t = (ref ?? '').trim();
  if (!t) return { zustand: z, log: [] };
  const liste = z.eintraege;
  if (t.startsWith('@')) {
    const [kennung = '', ...rest] = t.slice(1).trim().split(/\s+/);
    if (!kennung) return { zustand: z, log: [] };
    const name = rest.join(' ');
    let stelle = liste.findIndex((e) => e.key.toLowerCase() === kennung.toLowerCase());
    if (stelle < 0 && name) stelle = liste.findIndex((e) => normLabel(e.label) === normLabel(name));
    return stelle >= 0 ? waehle(z, stelle) : ohneTreffer(z, name || kennung);
  }
  if (/^\d+$/.test(t)) {
    const stelle = Number(t) - 1;
    return stelle >= 0 && stelle < liste.length ? waehle(z, stelle) : ohneTreffer(z, t);
  }
  const lc = t.toLowerCase();
  const gesucht = normLabel(t);
  let stelle = liste.findIndex((e) => e.key.toLowerCase() === lc);
  if (stelle < 0) stelle = liste.findIndex((e) => normLabel(e.label) === gesucht);
  if (stelle < 0) stelle = liste.findIndex((e) => normLabel(e.label).includes(gesucht));
  return stelle >= 0 ? waehle(z, stelle) : ohneTreffer(z, t);
}

/** Klick in Liste oder Board (IPC `titler:recallSchluessel`): nur der Schlüssel, exakt. */
export function rufeSchluesselAb(z: KernZustand, key: string): KernSchritt {
  if (!key) return { zustand: z, log: [] };
  const stelle = stelleVon(z.eintraege, key);
  return stelle >= 0 ? waehle(z, stelle) : ohneTreffer(z, key);
}

/**
 * Weiter (+1) / Zurück (−1) von der Stelle des aktiven Eintrags, begrenzt auf die Liste (kein Umlauf).
 * Ohne aktiven Eintrag, auch bei einem gehaltenen, gilt Eintrag 1. Leere Liste → unverändert.
 */
export function schritt(z: KernZustand, delta: number): KernSchritt {
  const n = z.eintraege.length;
  if (!n) return { zustand: z, log: [] };
  const stelle = stelleVon(z.eintraege, z.aktiv);
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return waehle(z, stelle < 0 ? 0 : Math.min(n - 1, Math.max(0, stelle + d)));
}
