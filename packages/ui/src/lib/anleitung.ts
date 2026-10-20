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
  | { zustand: string; ereignis?: never; entscheidung?: never; alle?: never; eineVon?: never; nicht?: never }
  | { ereignis: string; zustand?: never; entscheidung?: never; alle?: never; eineVon?: never; nicht?: never }
  | { entscheidung: string; zustand?: never; ereignis?: never; alle?: never; eineVon?: never; nicht?: never }
  | { alle: readonly Bedingung[]; zustand?: never; ereignis?: never; entscheidung?: never; eineVon?: never; nicht?: never }
  | { eineVon: readonly Bedingung[]; zustand?: never; ereignis?: never; entscheidung?: never; alle?: never; nicht?: never }
  | { nicht: Bedingung; zustand?: never; ereignis?: never; entscheidung?: never; alle?: never; eineVon?: never };
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
  if (b.zustand !== undefined) return hat(z, b.zustand) && z[b.zustand] === true;
  if (b.ereignis !== undefined) return hat(f.ereignisse, b.ereignis);
  if (b.entscheidung !== undefined) return hat(f.entscheidungen, b.entscheidung);
  if (b.alle !== undefined) return b.alle.every((t) => bedingungErfuellt(t, z, f));
  if (b.eineVon !== undefined) return b.eineVon.some((t) => bedingungErfuellt(t, z, f));
  if (b.nicht !== undefined) return !bedingungErfuellt(b.nicht, z, f);
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
    if (b.zustand !== undefined) {
      if (!n.zustaende.includes(b.zustand)) befunde.push(`unbekannter Zustand: ${b.zustand} (${ort})`);
    } else if (b.ereignis !== undefined) {
      if (!n.ereignisse.includes(b.ereignis)) befunde.push(`unbekanntes Ereignis: ${b.ereignis} (${ort})`);
    } else if (b.entscheidung !== undefined) {
      if (!n.entscheidungen.includes(b.entscheidung)) befunde.push(`unbekannte Entscheidung: ${b.entscheidung} (${ort})`);
    } else if (b.alle !== undefined) {
      for (const t of b.alle) namen(t, ort);
    } else if (b.eineVon !== undefined) {
      for (const t of b.eineVon) namen(t, ort);
    } else if (b.nicht !== undefined) {
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

// ── Ablauf (P2): Ereignisse, Start nach dem Laden, Speicher (Gliederung 11, Regeln 1–13) ──

export type AnleitungsEreignis =
  | { art: 'starten'; kapitel?: string }
  | { art: 'weiter' }
  | { art: 'zurueck' }
  | { art: 'ueberspringen' }
  | { art: 'spaeter' }
  | { art: 'option'; index: number }
  | { art: 'anleitungUeberspringen' }
  | { art: 'beenden' }
  | { art: 'brauchtNicht'; kapitel: string }
  | { art: 'dochGebraucht'; kapitel: string }
  | { art: 'zustand' }
  | { art: 'toolEreignis'; name: string };
/** Wie window.localStorage (nur getItem/setItem); jeder Zugriff darf werfen. */
export interface AnleitungSpeicher {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
export type SpeicherZustand = 'ok' | 'leer' | 'nichtLesbar' | 'kaputt' | 'neuer';
export interface GelesenerFortschritt {
  fortschritt: AnleitungsFortschritt | null;
  zustand: SpeicherZustand;
}
export interface StartErgebnis {
  fortschritt: AnleitungsFortschritt;
  /** Was beim Start von selbst erscheint: die Anleitung, der Hinweis „Neu: geführte Einrichtung“ oder nichts. */
  oeffnen: 'anleitung' | 'hinweis' | null;
  /** Fortschritt speichern? Nie bei 'nichtLesbar' und 'neuer' (G8). */
  schreiben: boolean;
}

interface Lage {
  a: Anleitung;
  z: Zustand;
  f: AnleitungsFortschritt;
}

/** Was gerade als Sprechblase zu sehen ist: „Zeig mir“ vor dem Hauptlauf, der Hauptlauf nur, solange er läuft (A1). */
type AktiveBlase = { art: 'einzeln'; p: KapitelPosition } | { art: 'haupt'; p: AnleitungsPosition } | null;

function aktiveBlase(f: AnleitungsFortschritt): AktiveBlase {
  if (f.einzeln !== null) return { art: 'einzeln', p: f.einzeln };
  if (f.status === 'laeuft' && f.position !== null) return { art: 'haupt', p: f.position };
  return null;
}

function kapitelIndex(a: Anleitung, kapitel: string): number {
  return a.kapitel.findIndex((k) => k.id === kapitel);
}

/** Der Schritt eines Orts; „Schon erledigt“ und unbekannte IDs → undefined. */
function schrittVon(a: Anleitung, p: AnleitungsPosition): AnleitungsSchritt | undefined {
  if (p.ort !== 'kapitel') return a[p.ort];
  if (p.schritt === null) return undefined;
  return findeKapitel(a, p.kapitel)?.schritte.find((s) => s.id === p.schritt);
}

function gilt(l: Lage, s: AnleitungsSchritt): boolean {
  return s.giltWenn === undefined || bedingungErfuellt(s.giltWenn, l.z, l.f);
}

/** Ort eines Kapitel-Schritts beim Betreten: warErfuellt = Bedingung jetzt erfüllt (Regel 3). */
function kapitelOrt(l: Lage, k: AnleitungsKapitel, s: AnleitungsSchritt | null, nurZeigen: boolean): KapitelPosition {
  const war = s !== null && s.art === 'handeln' && s.erledigtWenn !== undefined && bedingungErfuellt(s.erledigtWenn, l.z, l.f);
  return { ort: 'kapitel', kapitel: k.id, schritt: s === null ? null : s.id, nurZeigen, warErfuellt: war };
}

/** Kapitel ab Index `ab` im Hauptlauf betreten (Regel 3): erledigt → „Schon erledigt“, nicht gebraucht → still weiter. */
function eintritt(l: Lage, ab: number): KapitelPosition | null {
  for (let i = ab; i < l.a.kapitel.length; i++) {
    const k = l.a.kapitel[i];
    const zk = kapitelZustand(l.a, k.id, l.z, l.f);
    if (zk === 'nichtGebraucht') continue;
    if (zk === 'erledigt') return kapitelOrt(l, k, null, false);
    const erster = geltendeSchritte(l.a, k.id, l.z, l.f)[0];
    if (erster !== undefined) return kapitelOrt(l, k, erster, false);
  }
  return null;
}

/** Nächster geltender Schritt nach `schritt` in K (auch wenn `schritt` selbst nicht mehr gilt); „Schon erledigt“ → keiner. */
function naechsterImKapitel(l: Lage, k: AnleitungsKapitel, schritt: string | null): AnleitungsSchritt | undefined {
  if (schritt === null) return undefined;
  const i = k.schritte.findIndex((s) => s.id === schritt);
  return k.schritte.slice(i + 1).find((s) => gilt(l, s));
}

/** Nächster Ort im Hauptlauf nach einem Kapitel-Ort (Modus führen, Regel 4). */
function folgeHaupt(l: Lage, p: KapitelPosition): AnleitungsPosition {
  const ki = kapitelIndex(l.a, p.kapitel);
  const k = l.a.kapitel[ki];
  const s = k === undefined ? undefined : naechsterImKapitel(l, k, p.schritt);
  if (k !== undefined && s !== undefined) return kapitelOrt(l, k, s, false);
  return eintritt(l, ki + 1) ?? { ort: 'abschluss' };
}

/** Nächster Ort bei „Zeig mir“: nur im Kapitel, Modus bleibt; hinter dem letzten Schritt endet „Zeig mir“. */
function folgeEinzeln(l: Lage, p: KapitelPosition): KapitelPosition | null {
  const k = findeKapitel(l.a, p.kapitel);
  const s = k === undefined ? undefined : naechsterImKapitel(l, k, p.schritt);
  return k !== undefined && s !== undefined ? kapitelOrt(l, k, s, p.nurZeigen) : null;
}

/** Letzter geltender Schritt des nächsten gebrauchten Kapitels vor Index `vor`, sonst die Einleitung. */
function letzterVor(l: Lage, vor: number): AnleitungsPosition {
  for (let j = vor - 1; j >= 0; j--) {
    const k = l.a.kapitel[j];
    if (kapitelZustand(l.a, k.id, l.z, l.f) === 'nichtGebraucht') continue;
    const geltend = geltendeSchritte(l.a, k.id, l.z, l.f);
    if (geltend.length > 0) return kapitelOrt(l, k, geltend[geltend.length - 1], true);
  }
  return { ort: 'einleitung' };
}

/** Vorige Blase (Regel 5): im Modus „nur zeigen“, nie vor der Einleitung; bei „Zeig mir“ nie vor den ersten Schritt. */
function vorOrt(l: Lage, p: AnleitungsPosition, einzeln: boolean): AnleitungsPosition | null {
  if (p.ort === 'einleitung') return null;
  if (p.ort === 'rueckfrage') return { ort: 'einleitung' };
  if (p.ort === 'abschluss') return letzterVor(l, l.a.kapitel.length);
  const ki = kapitelIndex(l.a, p.kapitel);
  const k = l.a.kapitel[ki];
  const geltend = k === undefined ? [] : geltendeSchritte(l.a, k.id, l.z, l.f);
  const i = p.schritt === null ? -1 : geltend.findIndex((s) => s.id === p.schritt);
  if (k !== undefined && i > 0) return kapitelOrt(l, k, geltend[i - 1], true);
  return einzeln ? null : letzterVor(l, ki);
}

/**
 * Bietet die Blase „Weiter“ an (A2)? `zeigtEingriff` sagt, ob ein Schritt mit eingriff gerade nur gezeigt wird (Ansicht:
 * in der Produktion; Kern: immer möglich, denn der Kern kennt die Produktion nicht).
 */
function weiterDa(a: Anleitung, p: AnleitungsPosition, zeigtEingriff: (s: AnleitungsSchritt) => boolean): boolean {
  if (p.ort === 'einleitung' || p.ort === 'abschluss') return true;
  if (p.ort === 'rueckfrage') return false;
  if (p.schritt === null) return true;
  const s = schrittVon(a, p);
  if (s === undefined) return false;
  const zeigen = p.nurZeigen || zeigtEingriff(s);
  if (s.art === 'erklaeren') return true;
  if (s.art === 'entscheiden') return false;
  if (s.art === 'neustart') return zeigen;
  return zeigen || p.warErfuellt;
}

/** Hauptlauf auf einen Ort setzen; `neustart` merkt nur ein laufender Hauptlauf, der einen Neustart-Schritt führt (EP7). */
function mitOrt(f: AnleitungsFortschritt, p: AnleitungsPosition | null, a: Anleitung, jetzt: string): AnleitungsFortschritt {
  const s = p === null ? undefined : schrittVon(a, p);
  const fuehrt = p !== null && p.ort === 'kapitel' && !p.nurZeigen;
  const neustart =
    f.status === 'laeuft' && fuehrt && s !== undefined && s.art === 'neustart'
      ? f.neustart !== null && f.neustart.schritt === s.id
        ? f.neustart
        : { schritt: s.id, seit: jetzt }
      : null;
  return { ...f, position: p, neustart };
}

/** Gespeicherter Ort, der nicht mehr zur Anleitung passt (Regel 13): nächster gültiger Ort statt eines Wurfs. */
function gueltigerOrt(l: Lage, p: AnleitungsPosition | null): AnleitungsPosition | null {
  if (p === null || p.ort !== 'kapitel') return p;
  const ki = kapitelIndex(l.a, p.kapitel);
  if (ki < 0) return eintritt(l, 0) ?? { ort: 'abschluss' };
  if (p.schritt === null || l.a.kapitel[ki].schritte.some((s) => s.id === p.schritt)) return p;
  return eintritt(l, ki) ?? { ort: 'abschluss' };
}

function gueltigesEinzeln(a: Anleitung, p: KapitelPosition | null): KapitelPosition | null {
  if (p === null || p.schritt === null) return null;
  const k = findeKapitel(a, p.kapitel);
  return k !== undefined && k.schritte.some((s) => s.id === p.schritt) ? p : null;
}

/** Erstes Kapitel, das weder erledigt noch nicht gebraucht ist; gibt es keins, das erste Kapitel (Regel 1). */
function ersterOffenerOrt(l: Lage): AnleitungsPosition {
  for (const k of l.a.kapitel) {
    const zk = kapitelZustand(l.a, k.id, l.z, l.f);
    if (zk === 'erledigt' || zk === 'nichtGebraucht') continue;
    const erster = geltendeSchritte(l.a, k.id, l.z, l.f)[0];
    if (erster !== undefined) return kapitelOrt(l, k, erster, false);
  }
  const k = l.a.kapitel[0];
  if (k === undefined) return { ort: 'abschluss' };
  if (kapitelZustand(l.a, k.id, l.z, l.f) === 'erledigt') return kapitelOrt(l, k, null, false);
  return kapitelOrt(l, k, geltendeSchritte(l.a, k.id, l.z, l.f)[0] ?? null, false);
}

/** Gemerkter Ort beim Fortsetzen: im Modus führen, warErfuellt neu nach dem Zustand jetzt. */
function wiederBetreten(l: Lage, p: AnleitungsPosition): AnleitungsPosition {
  if (p.ort !== 'kapitel') return p;
  const k = findeKapitel(l.a, p.kapitel);
  if (k === undefined) return p;
  return kapitelOrt(l, k, p.schritt === null ? null : (k.schritte.find((s) => s.id === p.schritt) ?? null), false);
}

function allesErledigt(l: Lage): boolean {
  return l.a.kapitel.every((k) => {
    const zk = kapitelZustand(l.a, k.id, l.z, l.f);
    return zk === 'erledigt' || zk === 'nichtGebraucht';
  });
}

/** Einen Schritt weiter in der Reihenfolge (Regel 4 ohne die Angebots-Prüfung; auch Option ohne Entscheidung). */
function vorwaerts(f: AnleitungsFortschritt, blase: NonNullable<AktiveBlase>, a: Anleitung, z: Zustand, jetzt: string): AnleitungsFortschritt {
  const l = { a, z, f };
  if (blase.art === 'einzeln') return { ...f, einzeln: folgeEinzeln(l, blase.p) };
  const p = blase.p;
  if (p.ort === 'einleitung') return mitOrt(f, eintritt(l, 0) ?? { ort: 'abschluss' }, a, jetzt);
  if (p.ort === 'abschluss') return { ...f, status: allesErledigt(l) ? 'abgeschlossen' : 'durchlaufen', position: null, neustart: null };
  if (p.ort === 'rueckfrage') return f;
  return mitOrt(f, folgeHaupt(l, p), a, jetzt);
}

/** Hinter das Kapitel der Blase springen (Überspringen, „Brauche ich nicht“, Entscheidung erledigt das Kapitel). */
function hinterKapitel(f: AnleitungsFortschritt, blase: 'einzeln' | 'haupt', kapitel: string, a: Anleitung, z: Zustand, jetzt: string): AnleitungsFortschritt {
  if (blase === 'einzeln') return { ...f, einzeln: null };
  return mitOrt(f, eintritt({ a, z, f }, kapitelIndex(a, kapitel) + 1) ?? { ort: 'abschluss' }, a, jetzt);
}

/** Regel 11: gilt der Schritt nicht mehr → weiter; erkannte Handlung im Modus führen → weiter; sonst warErfuellt nachführen; „Schon erledigt“ ohne erledigtes Kapitel → ersten Schritt betreten. */
function nachZustand(f: AnleitungsFortschritt, a: Anleitung, z: Zustand, jetzt: string): AnleitungsFortschritt {
  const blase = aktiveBlase(f);
  if (blase === null || blase.p.ort !== 'kapitel') return f;
  if (blase.p.schritt === null) {
    // „Schon erledigt“ im Hauptlauf: fällt die Bedingung des Kapitels weg, stimmt der Kapiteltext nicht mehr → ersten geltenden Schritt betreten.
    const kap = blase.p.kapitel;
    if (blase.art !== 'haupt' || kapitelZustand(a, kap, z, f) === 'erledigt') return f;
    return mitOrt(f, eintritt({ a, z, f }, kapitelIndex(a, kap)) ?? { ort: 'abschluss' }, a, jetzt);
  }
  const p = blase.p;
  const s = schrittVon(a, p);
  if (s === undefined) return f;
  const l = { a, z, f };
  const erfuellt = s.art === 'handeln' && s.erledigtWenn !== undefined && bedingungErfuellt(s.erledigtWenn, z, f);
  const weg = !gilt(l, s) || (s.art === 'handeln' && !p.nurZeigen && !p.warErfuellt && erfuellt);
  if (weg) return blase.art === 'einzeln' ? { ...f, einzeln: folgeEinzeln(l, p) } : mitOrt(f, folgeHaupt(l, p), a, jetzt);
  if (p.warErfuellt === erfuellt) return f;
  const neu = { ...p, warErfuellt: erfuellt };
  return blase.art === 'einzeln' ? { ...f, einzeln: neu } : { ...f, position: neu };
}

/**
 * Ein Ereignis auf den Fortschritt anwenden (rein, Gliederung 11 Regeln 1–13). Bedien-Ereignisse der Sprechblase wirken
 * nur, wenn die Blase den Knopf anbietet (A2); „Zeig mir“ (`einzeln`) geht dem Hauptlauf vor. Wirft nie.
 */
export function anleitungSchritt(a: Anleitung, f0: AnleitungsFortschritt, e: AnleitungsEreignis, z: Zustand, jetzt: string): AnleitungsFortschritt {
  const f: AnleitungsFortschritt = { ...f0, position: gueltigerOrt({ a, z, f: f0 }, f0.position), einzeln: gueltigesEinzeln(a, f0.einzeln) };
  const blase = aktiveBlase(f);
  switch (e.art) {
    case 'starten': {
      if (e.kapitel !== undefined) {
        const k = findeKapitel(a, e.kapitel);
        const erster = k === undefined ? undefined : geltendeSchritte(a, k.id, z, f)[0];
        if (k === undefined || erster === undefined) return f;
        return { ...f, einzeln: kapitelOrt({ a, z, f }, k, erster, kapitelZustand(a, k.id, z, f) === 'erledigt') };
      }
      const laufend: AnleitungsFortschritt = { ...f, status: 'laeuft', einzeln: null };
      const l = { a, z, f: laufend };
      const ort = f.status === 'pausiert' && f.position !== null ? wiederBetreten(l, f.position) : ersterOffenerOrt(l);
      return mitOrt(laufend, ort, a, jetzt);
    }
    case 'weiter':
      return blase !== null && weiterDa(a, blase.p, (s) => s.eingriff === true) ? vorwaerts(f, blase, a, z, jetzt) : f;
    case 'zurueck': {
      if (blase === null) return f;
      const ort = vorOrt({ a, z, f }, blase.p, blase.art === 'einzeln');
      if (ort === null) return f;
      return blase.art === 'einzeln' ? { ...f, einzeln: ort as KapitelPosition } : mitOrt(f, ort, a, jetzt);
    }
    case 'ueberspringen': {
      if (blase === null || blase.p.ort !== 'kapitel') return f;
      const k = blase.p.kapitel;
      const markiert =
        kapitelZustand(a, k, z, f) === 'erledigt' || f.uebersprungen.includes(k) ? f : { ...f, uebersprungen: [...f.uebersprungen, k] };
      return hinterKapitel(markiert, blase.art, k, a, z, jetzt);
    }
    case 'spaeter': {
      if (blase === null) return f;
      if (blase.art === 'einzeln') return { ...f, einzeln: null };
      if (blase.p.ort === 'rueckfrage') return f;
      const amNeustart = blase.p.ort === 'kapitel' && f.neustart !== null && blase.p.schritt === f.neustart.schritt;
      return { ...f, status: 'pausiert', neustart: amNeustart ? f.neustart : null };
    }
    case 'option': {
      if (blase === null || blase.p.ort !== 'kapitel') return f;
      const s = schrittVon(a, blase.p);
      const o = s !== undefined && s.art === 'entscheiden' ? s.optionen?.[e.index] : undefined;
      if (o === undefined) return f;
      if (o.entscheidung === undefined) return vorwaerts(f, blase, a, z, jetzt);
      const entschieden = { ...f, entscheidungen: { ...f.entscheidungen, [o.entscheidung]: jetzt } };
      const k = blase.p.kapitel;
      if (kapitelZustand(a, k, z, entschieden) === 'erledigt') return hinterKapitel(entschieden, blase.art, k, a, z, jetzt);
      return vorwaerts(entschieden, blase, a, z, jetzt);
    }
    case 'anleitungUeberspringen':
      return blase !== null && blase.art === 'haupt' && blase.p.ort === 'einleitung' ? mitOrt(f, { ort: 'rueckfrage' }, a, jetzt) : f;
    case 'beenden':
      return { ...f, status: 'abgeschlossen', position: null, einzeln: null, neustart: null };
    case 'brauchtNicht': {
      const k = findeKapitel(a, e.kapitel);
      const zk = kapitelZustand(a, e.kapitel, z, f);
      if (k === undefined || !k.brauchtNicht || zk === 'erledigt' || zk === 'nichtGebraucht') return f;
      let neu: AnleitungsFortschritt = {
        ...f,
        nichtGebraucht: [...f.nichtGebraucht, k.id],
        uebersprungen: f.uebersprungen.filter((x) => x !== k.id),
      };
      if (neu.einzeln !== null && neu.einzeln.kapitel === k.id) neu = { ...neu, einzeln: null };
      if (neu.position !== null && neu.position.ort === 'kapitel' && neu.position.kapitel === k.id) neu = hinterKapitel(neu, 'haupt', k.id, a, z, jetzt);
      return neu;
    }
    case 'dochGebraucht':
      return f.nichtGebraucht.includes(e.kapitel) ? { ...f, nichtGebraucht: f.nichtGebraucht.filter((x) => x !== e.kapitel) } : f;
    case 'zustand':
      return nachZustand(f, a, z, jetzt);
    case 'toolEreignis': {
      const gemerkt = hat(f.ereignisse, e.name) ? f : { ...f, ereignisse: { ...f.ereignisse, [e.name]: jetzt } };
      return nachZustand(gemerkt, a, z, jetzt);
    }
  }
  return f;
}

/**
 * Entscheidung beim Start des Tools (Spec 4, EP7, EP8; Gliederung 11 „Start“). Beim Start ist noch kein Zustand geladen:
 * gerechnet wird mit leerem Zustand, das erste Ereignis 'zustand' danach führt Ort und warErfuellt nach (Regel 11).
 * „Zeig mir“ endet mit jedem Start; ein laufender Hauptlauf ist danach pausiert, außer ein Neustart-Schritt hat den
 * Neustart verlangt: dann geht es beim folgenden Schritt von selbst weiter.
 */
export function beimStart(a: Anleitung, g: GelesenerFortschritt, u: { bestehenderRechner: boolean }, jetzt: string): StartErgebnis {
  const leer = leererFortschritt(a.id);
  if (g.zustand === 'nichtLesbar' || g.zustand === 'neuer') return { fortschritt: leer, oeffnen: null, schreiben: false };
  if (g.zustand === 'leer') {
    if (u.bestehenderRechner) return { fortschritt: { ...leer, hinweisGesehen: true }, oeffnen: 'hinweis', schreiben: true };
    return { fortschritt: { ...leer, status: 'laeuft', position: { ort: 'einleitung' } }, oeffnen: 'anleitung', schreiben: true };
  }
  if (g.zustand === 'kaputt' || g.fortschritt === null) return { fortschritt: leer, oeffnen: null, schreiben: true };
  const roh = g.fortschritt;
  const z: Zustand = {};
  let f: AnleitungsFortschritt = { ...roh, einzeln: null };
  f = { ...f, position: gueltigerOrt({ a, z, f }, f.position) };
  if (f.neustart !== null) {
    const schritt = f.neustart.schritt;
    const k = a.kapitel.find((kap) => kap.schritte.some((s) => s.id === schritt));
    if (k !== undefined) {
      const name = `neustart:${schritt}`;
      const weiter: AnleitungsFortschritt = {
        ...f,
        status: 'laeuft',
        ereignisse: hat(f.ereignisse, name) ? f.ereignisse : { ...f.ereignisse, [name]: jetzt },
        neustart: null,
      };
      const ort = folgeHaupt({ a, z, f: weiter }, { ort: 'kapitel', kapitel: k.id, schritt, nurZeigen: false, warErfuellt: false });
      return { fortschritt: mitOrt(weiter, ort, a, jetzt), oeffnen: 'anleitung', schreiben: true };
    }
    f = { ...f, neustart: null };
  }
  if (f.status === 'laeuft') f = { ...f, status: 'pausiert' };
  let oeffnen: StartErgebnis['oeffnen'] = null;
  if (f.status === 'nieGestartet' && u.bestehenderRechner && !f.hinweisGesehen) {
    f = { ...f, hinweisGesehen: true };
    oeffnen = 'hinweis';
  }
  return { fortschritt: f, oeffnen, schreiben: JSON.stringify(f) !== JSON.stringify(roh) };
}

/**
 * Fortschritt aus dem Speicher (G8): ohne Speicher oder bei Wurf 'nichtLesbar', fehlt → 'leer', kein JSON-Objekt oder
 * `format` keine ganze Zahl ≥ 1 → 'kaputt', `format` > 1 → 'neuer' (nie überschreiben), sonst normalisiert 'ok'.
 */
export function leseFortschritt(s: AnleitungSpeicher | null, schluessel: string, anleitung: string): GelesenerFortschritt {
  if (s === null) return { fortschritt: null, zustand: 'nichtLesbar' };
  let text: string | null;
  try {
    text = s.getItem(schluessel);
  } catch {
    return { fortschritt: null, zustand: 'nichtLesbar' };
  }
  if (text === null) return { fortschritt: null, zustand: 'leer' };
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { fortschritt: null, zustand: 'kaputt' };
  }
  if (!istObjekt(roh) || typeof roh.format !== 'number' || !Number.isInteger(roh.format) || roh.format < 1) {
    return { fortschritt: null, zustand: 'kaputt' };
  }
  if (roh.format > ANLEITUNG_FORMAT) return { fortschritt: null, zustand: 'neuer' };
  return { fortschritt: normalisiereFortschritt(roh, anleitung), zustand: 'ok' };
}

/** Fortschritt merken; false, wenn es keinen Speicher gibt oder er wirft. Wirft nie (G8). */
export function schreibeFortschritt(s: AnleitungSpeicher | null, schluessel: string, f: AnleitungsFortschritt): boolean {
  if (s === null) return false;
  try {
    s.setItem(schluessel, JSON.stringify(f));
    return true;
  } catch {
    return false;
  }
}

// ── Ansicht (P3): was Sprechblase, Kapitelübersicht und Knopf zeigen (Gliederung 11 A1–A6, G7) ──

export interface AnleitungsUmgebung {
  /** Läuft auf diesem Rechner eine Produktion (EP17)? Dann Stimme aus und Eingriffe nur zeigen (Spec 7). */
  produktion: boolean;
  /** vorhanden: Fassung mit Ansagen; an: je Rechner gemerkt; trotzdem: „Stimme trotzdem an“ für diese Sitzung. */
  stimme: { vorhanden: boolean; an: boolean; trotzdem: boolean };
}
export interface KapitelZeile {
  id: string;
  nummer: number;
  titel: string;
  kurz: string;
  zustand: KapitelZustand;
  zeigMir: boolean;
  brauchtNicht: boolean;
  dochGebraucht: boolean;
}
export interface BlasenAnsicht {
  art: 'einleitung' | 'rueckfrage' | 'abschluss' | 'schonErledigt' | SchrittArt;
  kapitel: { id: string; titel: string } | null;
  /** n = Nummer des Kapitels, m = Zahl der Kapitel (EP3); null außerhalb der Kapitel. */
  zaehler: { n: number; m: number } | null;
  text: string;
  ziel: string | null;
  zielFehlt: string | null;
  wiederfinden: string | null;
  nurZeigen: boolean;
  produktionsWarnung: boolean;
  wartetAufNeustart: boolean;
  knoepfe: {
    zurueck: boolean;
    weiter: boolean;
    ueberspringen: boolean;
    spaeter: boolean;
    brauchtNicht: boolean;
    anleitungUeberspringen: boolean;
    jaUeberspringen: boolean;
  };
  optionen: readonly AnleitungsOption[];
  /** hinweis 'eingriff': Schritt mit eingriff in der Produktion, nie gesprochen (Spec 7: nur zeigen, nicht auffordern). */
  ansage: { id: string; spielen: boolean; hinweis: 'produktion' | 'eingriff' | 'keineStimme' | 'aus' | null };
}
export interface AnleitungsAnsicht {
  /** null = keine Sprechblase. */
  blase: BlasenAnsicht | null;
  kapitel: KapitelZeile[];
  /** Nur bei 'pausiert' und nicht alles erledigt („‹Titel› fortsetzen · Schritt ‹n› von ‹m›“). */
  fortsetzen: { n: number; m: number } | null;
  hauptknopf: 'starten' | 'fortsetzen';
  /** Titel der Anleitung (Anleitung.titel); die Texte U11, U12 und U34 bilden sich daraus (Spec 2: jedes Tool). */
  titel: string;
  /** Jedes Kapitel erledigt oder nicht gebraucht („‹Titel› abgeschlossen“). */
  abgeschlossen: boolean;
  /** Beendet („Ja, überspringen“, „Anleitung beenden“), aber nicht alles erledigt: nie „abgeschlossen“ behaupten (G7). */
  beendet: boolean;
}

function blasenAnsicht(
  a: Anleitung,
  f: AnleitungsFortschritt,
  z: Zustand,
  u: AnleitungsUmgebung,
  p: AnleitungsPosition,
  einzeln: boolean,
): BlasenAnsicht | null {
  const ki = p.ort === 'kapitel' ? kapitelIndex(a, p.kapitel) : -1;
  const k = ki >= 0 ? a.kapitel[ki] : undefined;
  const s = schrittVon(a, p);
  if (p.ort === 'kapitel' && (k === undefined || (p.schritt !== null && s === undefined))) return null;
  const zeigtEingriff = (x: AnleitungsSchritt): boolean => u.produktion && x.eingriff === true;
  const eingriffJetzt = s !== undefined && zeigtEingriff(s);
  const zk = k === undefined ? 'offen' : kapitelZustand(a, k.id, z, f);
  return {
    art: p.ort !== 'kapitel' ? p.ort : s === undefined ? 'schonErledigt' : s.art,
    kapitel: k === undefined ? null : { id: k.id, titel: k.titel },
    zaehler: k === undefined ? null : { n: ki + 1, m: a.kapitel.length },
    text: s !== undefined ? s.text : (k?.erledigt ?? ''),
    ziel: s?.ziel ?? null,
    zielFehlt: s?.zielFehlt ?? null,
    wiederfinden: s?.ueberspringenHinweis === true ? a.wiederfinden : null,
    nurZeigen: p.ort === 'kapitel' && (p.nurZeigen || (s !== undefined && zeigtEingriff(s))),
    produktionsWarnung: s !== undefined && zeigtEingriff(s),
    wartetAufNeustart: s !== undefined && s.art === 'neustart' && f.neustart !== null && f.neustart.schritt === s.id,
    knoepfe: {
      zurueck: vorOrt({ a, z, f }, p, einzeln) !== null,
      weiter: weiterDa(a, p, zeigtEingriff),
      ueberspringen: p.ort === 'kapitel',
      spaeter: p.ort !== 'rueckfrage',
      brauchtNicht: k !== undefined && k.brauchtNicht && zk !== 'erledigt' && zk !== 'nichtGebraucht',
      anleitungUeberspringen: p.ort === 'einleitung',
      jaUeberspringen: p.ort === 'rueckfrage',
    },
    optionen: s !== undefined && s.art === 'entscheiden' ? (s.optionen ?? []) : [],
    ansage: {
      id: s !== undefined ? s.id : `${k?.id}.erledigt`,
      spielen: u.stimme.vorhanden && u.stimme.an && (!u.produktion || u.stimme.trotzdem) && !eingriffJetzt,
      hinweis: !u.stimme.vorhanden ? 'keineStimme' : !u.stimme.an ? 'aus' : eingriffJetzt ? 'eingriff' : u.produktion && !u.stimme.trotzdem ? 'produktion' : null,
    },
  };
}

/** Kapitelnummer zum Fortsetzen: Einleitung, Rückfrage und kein Ort → 1, Abschluss → letztes Kapitel. */
function fortsetzenNummer(a: Anleitung, p: AnleitungsPosition | null): number {
  if (p === null || p.ort === 'einleitung' || p.ort === 'rueckfrage') return 1;
  if (p.ort === 'abschluss') return a.kapitel.length;
  return Math.max(kapitelIndex(a, p.kapitel), 0) + 1;
}

/**
 * Was zu zeigen ist (rein, A1–A6): Sprechblase nur bei „Zeig mir“ oder laufendem Hauptlauf, Kapitelzeilen mit Haken
 * genau bei erfüllter Bedingung, Fortsetzen nur pausiert und nicht alles erledigt, „abgeschlossen“ nur, wenn alles erledigt
 * ist (sonst nach dem Beenden „beendet“). Jede Anzeige stimmt in jedem Zustand (G7); das Kreuzprodukt im Test hält das fest.
 */
export function anleitungAnsicht(a: Anleitung, f0: AnleitungsFortschritt, z: Zustand, u: AnleitungsUmgebung): AnleitungsAnsicht {
  const f: AnleitungsFortschritt = { ...f0, position: gueltigerOrt({ a, z, f: f0 }, f0.position), einzeln: gueltigesEinzeln(a, f0.einzeln) };
  const kapitel = a.kapitel.map((k, i): KapitelZeile => {
    const zustand = kapitelZustand(a, k.id, z, f);
    return {
      id: k.id,
      nummer: i + 1,
      titel: k.titel,
      kurz: k.kurz,
      zustand,
      zeigMir: true,
      brauchtNicht: k.brauchtNicht && zustand !== 'erledigt' && zustand !== 'nichtGebraucht',
      dochGebraucht: zustand === 'nichtGebraucht',
    };
  });
  const alles = kapitel.every((r) => r.zustand === 'erledigt' || r.zustand === 'nichtGebraucht');
  const blase = aktiveBlase(f);
  const pausiert = f.status === 'pausiert' && !alles;
  return {
    blase: blase === null ? null : blasenAnsicht(a, f, z, u, blase.p, blase.art === 'einzeln'),
    kapitel,
    fortsetzen: pausiert ? { n: fortsetzenNummer(a, f.position), m: a.kapitel.length } : null,
    hauptknopf: pausiert ? 'fortsetzen' : 'starten',
    titel: a.titel,
    abgeschlossen: alles,
    beendet: f.status === 'abgeschlossen' && !alles,
  };
}

// ── Ende des Moduls ──
