// Geführte Anleitungen (Spec 3, 3.1, 4, 7, 8; Plan EP1–EP3): Format einer Anleitung und reiner Ablaufkern ohne DOM.
// Keine Laufzeit-Importe, nur `import type` (G5): Der Launcher-Selbsttest und die Skripte laden diese Datei als
// `@jm/ui/anleitung` mit `node --experimental-strip-types`. Darum auch kein enum, kein namespace, keine Parameter-Properties.
// Den Speicher bekommt der Kern eingespeist (Quellregel: localStorage nur in lib/theme.ts). Bedingungen sind Daten, nie
// Funktionen; sie lesen nur Zustände, Ereignisse und Entscheidungen und lösen nichts aus (Spec 7).
// Neue Teile stehen direkt vor der Zeile „Ende des Moduls“ (P2, P3).

/** Fassung des Formats und des gespeicherten Fortschritts. */
export const ANLEITUNG_FORMAT = 1;
/** Kennungen von Anleitung, Kapiteln und Schritten; zugleich Name der Ansage-Datei. */
export const ID_MUSTER: RegExp = /^[a-z0-9]+(\.[a-z0-9-]+)*$/;
/** Ziel-Kennung `data-anleitung="bereich.name"` (EP10). */
export const ZIEL_MUSTER: RegExp = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** „erledigt, wenn“ bzw. „gilt nur, wenn“ (EP2): ein fehlender Name ist nie erfüllt. */
export type Bedingung =
  | { zustand: string }
  | { ereignis: string }
  | { entscheidung: string }
  | { alle: readonly Bedingung[] }
  | { eineVon: readonly Bedingung[] }
  | { nicht: Bedingung };
export type SchrittArt = 'erklaeren' | 'handeln' | 'entscheiden' | 'neustart';
/** Knopf eines Entscheidungs-Schritts; ohne `entscheidung` wirkt er wie „Weiter“. */
export interface AnleitungsOption {
  knopf: string;
  entscheidung?: string;
}
export interface AnleitungsSchritt {
  id: string;
  art: SchrittArt;
  text: string;
  /** Gesprochener Text, wenn er vom angezeigten abweicht (sonst wird `text` gesprochen). */
  sprechtext?: string;
  ziel?: string;
  /** Angezeigt, wenn das Ziel gerade nicht zu sehen ist (Spec 7). */
  zielFehlt?: string;
  /** Schritt geht ohne Internet, zweiten Rechner oder Master nicht: die Blase zeigt `Anleitung.wiederfinden` (Spec 5). */
  ueberspringenHinweis?: boolean;
  /** Pflicht bei 'handeln', sonst verboten. */
  erledigtWenn?: Bedingung;
  giltWenn?: Bedingung;
  /** Greift in eine laufende Produktion ein: dann nur zeigen, mit Warnung (Spec 7). */
  eingriff?: boolean;
  /** Pflicht bei 'entscheiden', sonst verboten. */
  optionen?: readonly AnleitungsOption[];
}
export interface AnleitungsKapitel {
  id: string;
  titel: string;
  kurz: string;
  /** Gesprochener Text der Blase „Schon erledigt“ (Ansage `‹Kapitel›.erledigt`). */
  erledigt: string;
  erledigtWenn: Bedingung;
  brauchtNicht: boolean;
  schritte: readonly AnleitungsSchritt[];
}
export interface Anleitung {
  format: 1;
  id: string;
  titel: string;
  /** IDs fest: 'einleitung', 'rueckfrage', 'abschluss'. */
  einleitung: AnleitungsSchritt;
  rueckfrage: AnleitungsSchritt;
  abschluss: AnleitungsSchritt;
  /** Angezeigt (nicht gesprochen) bei Schritten mit `ueberspringenHinweis`. */
  wiederfinden: string;
  kapitel: readonly AnleitungsKapitel[];
}
/** Zustände des Tools; ein fehlender Name ist false. */
export type Zustand = Readonly<Record<string, boolean>>;
export interface NamensListen {
  zustaende: readonly string[];
  ereignisse: readonly string[];
  entscheidungen: readonly string[];
}
export type KapitelZustand = 'erledigt' | 'nichtGebraucht' | 'uebersprungen' | 'offen';
export type AnleitungsStatus = 'nieGestartet' | 'laeuft' | 'pausiert' | 'durchlaufen' | 'abgeschlossen';
/** Ort einer Sprechblase; `schritt: null` ist die Blase „Schon erledigt“ eines Kapitels. */
export type AnleitungsPosition =
  | { ort: 'einleitung' }
  | { ort: 'rueckfrage' }
  | { ort: 'abschluss' }
  | { ort: 'kapitel'; kapitel: string; schritt: string | null; nurZeigen: boolean; warErfuellt: boolean };
export type KapitelPosition = Extract<AnleitungsPosition, { ort: 'kapitel' }>;
export interface AnleitungsFortschritt {
  format: 1;
  anleitung: string;
  status: AnleitungsStatus;
  /** Hauptlauf; bei 'pausiert' der Ort zum Fortsetzen. */
  position: AnleitungsPosition | null;
  /** „Zeig mir“: ein einzelnes Kapitel, ändert den Hauptlauf nie. */
  einzeln: KapitelPosition | null;
  uebersprungen: string[];
  nichtGebraucht: string[];
  /** Name → ISO-Zeit; auch 'neustart:‹Schritt-ID›'. */
  ereignisse: Record<string, string>;
  /** Name → ISO-Zeit. */
  entscheidungen: Record<string, string>;
  neustart: { schritt: string; seit: string } | null;
  hinweisGesehen: boolean;
}

const hat = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Wertet eine Bedingung aus: Zustand live, Ereignis und Entscheidung aus dem Fortschritt; fehlender Name = false. */
export function bedingungErfuellt(b: Bedingung, z: Zustand, f: AnleitungsFortschritt): boolean {
  if ('zustand' in b) return hat(z, b.zustand) && z[b.zustand] === true;
  if ('ereignis' in b) return hat(f.ereignisse, b.ereignis);
  if ('entscheidung' in b) return hat(f.entscheidungen, b.entscheidung);
  if ('alle' in b) return b.alle.every((t) => bedingungErfuellt(t, z, f));
  if ('eineVon' in b) return b.eineVon.some((t) => bedingungErfuellt(t, z, f));
  if ('nicht' in b) return !bedingungErfuellt(b.nicht, z, f);
  return false;
}

function findeKapitel(a: Anleitung, kapitel: string): AnleitungsKapitel | undefined {
  return a.kapitel.find((k) => k.id === kapitel);
}

/** Schritte eines Kapitels, die gerade gelten (`giltWenn` fehlt oder ist erfüllt), in Dateireihenfolge. */
export function geltendeSchritte(a: Anleitung, kapitel: string, z: Zustand, f: AnleitungsFortschritt): AnleitungsSchritt[] {
  const k = findeKapitel(a, kapitel);
  return k ? k.schritte.filter((s) => s.giltWenn === undefined || bedingungErfuellt(s.giltWenn, z, f)) : [];
}

/** Zustand eines Kapitels mit Vorrang erledigt > nicht gebraucht > übersprungen > offen (Spec 3.1). */
export function kapitelZustand(a: Anleitung, kapitel: string, z: Zustand, f: AnleitungsFortschritt): KapitelZustand {
  const k = findeKapitel(a, kapitel);
  if (!k) return 'offen';
  if (bedingungErfuellt(k.erledigtWenn, z, f)) return 'erledigt';
  if (f.nichtGebraucht.includes(k.id)) return 'nichtGebraucht';
  if (f.uebersprungen.includes(k.id)) return 'uebersprungen';
  return 'offen';
}

/** Satzenden: `.`, `!` oder `?` vor Leerraum oder am Textende. */
function saetze(text: string): number {
  return (text.match(/[.!?](?=\s|$)/g) ?? []).length;
}

/** Befunde einer Anleitung gegen das Format und die Namen des Tools; leer = in Ordnung (Spec 7 „Test gegen stillen Bruch“). */
export function pruefeAnleitung(a: Anleitung, n: NamensListen): string[] {
  const befunde: string[] = [];
  const ids: string[] = [];
  const text = (wert: string, ort: string, sprechblase: boolean): void => {
    if (wert.trim() === '') befunde.push(`Text leer: ${ort}`);
    if (wert.includes('"')) befunde.push(`ASCII-Anführungszeichen: ${ort}`);
    if (sprechblase && saetze(wert) > 3) befunde.push(`mehr als drei Sätze: ${ort}`);
  };
  const namen = (b: Bedingung | undefined, ort: string): void => {
    if (b === undefined) return;
    if ('zustand' in b) {
      if (!n.zustaende.includes(b.zustand)) befunde.push(`unbekannter Zustand: ${b.zustand} (${ort})`);
    } else if ('ereignis' in b) {
      if (!n.ereignisse.includes(b.ereignis)) befunde.push(`unbekanntes Ereignis: ${b.ereignis} (${ort})`);
    } else if ('entscheidung' in b) {
      if (!n.entscheidungen.includes(b.entscheidung)) befunde.push(`unbekannte Entscheidung: ${b.entscheidung} (${ort})`);
    } else if ('alle' in b) {
      for (const t of b.alle) namen(t, ort);
    } else if ('eineVon' in b) {
      for (const t of b.eineVon) namen(t, ort);
    } else if ('nicht' in b) {
      namen(b.nicht, ort);
    }
  };
  const schritt = (s: AnleitungsSchritt): void => {
    ids.push(s.id);
    if (!ID_MUSTER.test(s.id)) befunde.push(`ID ungültig: ${s.id}`);
    if (s.art === 'handeln' && s.erledigtWenn === undefined) befunde.push(`handeln ohne erledigtWenn: ${s.id}`);
    if (s.art !== 'handeln' && s.erledigtWenn !== undefined) befunde.push(`erledigtWenn nur bei handeln: ${s.id}`);
    if (s.art === 'entscheiden' && (s.optionen === undefined || s.optionen.length === 0)) befunde.push(`entscheiden ohne Optionen: ${s.id}`);
    if (s.art !== 'entscheiden' && s.optionen !== undefined) befunde.push(`Optionen nur bei entscheiden: ${s.id}`);
    if (s.ziel !== undefined && !ZIEL_MUSTER.test(s.ziel)) befunde.push(`Ziel ungültig: ${s.ziel} (${s.id})`);
    text(s.text, s.id, true);
    if (s.sprechtext !== undefined) text(s.sprechtext, `${s.id}.sprechtext`, true);
    if (s.zielFehlt !== undefined) text(s.zielFehlt, `${s.id}.zielFehlt`, true);
    (s.optionen ?? []).forEach((o, i) => {
      text(o.knopf, `${s.id}.option${i + 1}`, false);
      if (o.entscheidung !== undefined && !n.entscheidungen.includes(o.entscheidung)) {
        befunde.push(`unbekannte Entscheidung: ${o.entscheidung} (${s.id}.option${i + 1})`);
      }
    });
    namen(s.erledigtWenn, s.id);
    namen(s.giltWenn, s.id);
  };

  if (a.format !== ANLEITUNG_FORMAT) befunde.push(`Format ist nicht ${ANLEITUNG_FORMAT}`);
  if (!ID_MUSTER.test(a.id)) befunde.push(`ID ungültig: ${a.id}`);
  text(a.titel, 'titel', false);
  text(a.wiederfinden, 'wiederfinden', false);
  for (const fest of ['einleitung', 'rueckfrage', 'abschluss'] as const) {
    if (a[fest].id !== fest) befunde.push(`feste ID erwartet: ${fest} (ist ${a[fest].id})`);
    schritt(a[fest]);
  }
  for (const k of a.kapitel) {
    ids.push(k.id, `${k.id}.erledigt`);
    if (!ID_MUSTER.test(k.id)) befunde.push(`ID ungültig: ${k.id}`);
    text(k.titel, `${k.id}.titel`, false);
    text(k.kurz, `${k.id}.kurz`, false);
    text(k.erledigt, `${k.id}.erledigt`, true);
    namen(k.erledigtWenn, k.id);
    if (k.schritte.length === 0) befunde.push(`Kapitel ohne Schritt: ${k.id}`);
    for (const s of k.schritte) {
      if (!s.id.startsWith(`${k.id}.`)) befunde.push(`Schritt ohne Kapitel-Präfix: ${s.id} in ${k.id}`);
      schritt(s);
    }
  }
  const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of [...new Set(doppelt)]) befunde.push(`ID doppelt: ${id}`);
  return befunde;
}

/**
 * Alle gesprochenen Texte mit ihrer Ansage-ID (Spec 6): einleitung, rueckfrage, abschluss, dann je Kapitel
 * `‹Kapitel›.erledigt` und jeder Schritt (unabhängig von `giltWenn`); gesprochen wird `sprechtext`, sonst `text`.
 */
export function sprechTexte(a: Anleitung): Array<{ id: string; text: string }> {
  const aus = (s: AnleitungsSchritt): { id: string; text: string } => ({ id: s.id, text: s.sprechtext ?? s.text });
  const liste = [aus(a.einleitung), aus(a.rueckfrage), aus(a.abschluss)];
  for (const k of a.kapitel) {
    liste.push({ id: `${k.id}.erledigt`, text: k.erledigt });
    for (const s of k.schritte) liste.push(aus(s));
  }
  return liste;
}

/** Fortschritt einer nie gestarteten Anleitung (Vorgabe jedes Feldes). */
export function leererFortschritt(anleitung: string): AnleitungsFortschritt {
  return {
    format: 1,
    anleitung,
    status: 'nieGestartet',
    position: null,
    einzeln: null,
    uebersprungen: [],
    nichtGebraucht: [],
    ereignisse: {},
    entscheidungen: {},
    neustart: null,
    hinweisGesehen: false,
  };
}

const STATUS_WERTE: readonly AnleitungsStatus[] = ['nieGestartet', 'laeuft', 'pausiert', 'durchlaufen', 'abgeschlossen'];

function istObjekt(w: unknown): w is Record<string, unknown> {
  return typeof w === 'object' && w !== null && !Array.isArray(w);
}

function kapitelOrtAus(w: unknown): KapitelPosition | null {
  if (!istObjekt(w) || w.ort !== 'kapitel' || typeof w.kapitel !== 'string') return null;
  if (w.schritt !== null && typeof w.schritt !== 'string') return null;
  return { ort: 'kapitel', kapitel: w.kapitel, schritt: w.schritt, nurZeigen: w.nurZeigen === true, warErfuellt: w.warErfuellt === true };
}

function ortAus(w: unknown): AnleitungsPosition | null {
  if (istObjekt(w) && (w.ort === 'einleitung' || w.ort === 'rueckfrage' || w.ort === 'abschluss')) return { ort: w.ort };
  return kapitelOrtAus(w);
}

function namenAus(w: unknown): string[] {
  return Array.isArray(w) ? [...new Set(w.filter((x): x is string => typeof x === 'string'))] : [];
}

function zeitenAus(w: unknown): Record<string, string> {
  const aus: Record<string, string> = {};
  if (!istObjekt(w)) return aus;
  for (const [k, v] of Object.entries(w)) if (typeof v === 'string') aus[k] = v;
  return aus;
}

/**
 * Fortschritt aus gespeichertem JSON (G8): jedes Feld geprüft, ein falsch getyptes Feld bekommt die Vorgabe aus
 * leererFortschritt; null nur, wenn `roh` kein Objekt ist. Wer ein Feld ergänzt, ergänzt es hier und in leererFortschritt
 * (G9; die Rundreise im Test fängt das Vergessen).
 */
export function normalisiereFortschritt(roh: unknown, anleitung: string): AnleitungsFortschritt | null {
  if (!istObjekt(roh)) return null;
  const n = roh.neustart;
  return {
    format: 1,
    anleitung,
    status: STATUS_WERTE.find((s) => s === roh.status) ?? 'nieGestartet',
    position: ortAus(roh.position),
    einzeln: kapitelOrtAus(roh.einzeln),
    uebersprungen: namenAus(roh.uebersprungen),
    nichtGebraucht: namenAus(roh.nichtGebraucht),
    ereignisse: zeitenAus(roh.ereignisse),
    entscheidungen: zeitenAus(roh.entscheidungen),
    neustart: istObjekt(n) && typeof n.schritt === 'string' && typeof n.seit === 'string' ? { schritt: n.schritt, seit: n.seit } : null,
    hinweisGesehen: roh.hinweisGesehen === true,
  };
}

// ── Ende des Moduls ──
