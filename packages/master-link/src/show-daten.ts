// Show-Daten im Verbund (Teil 2b, Spec 13.1–13.3): Inhalt der Nachrichten abo, stand und aenderung — reine Funktionen.
// Der Rahmen nimmt die drei Typen mit lockeren Prüfern an (rahmen.ts); geprüft wird hier, beim Empfänger. Ungültiger
// Inhalt wird verworfen, die Leitung bleibt. `grund` einer fehlgeschlagenen Prüfung ist immer ein Feldname aus der
// Tabelle 13.2 — nie ein Wert aus dem Netz (er geht so ins Log).

/** Fassung der Show-Daten. PROTOKOLL bleibt 1; Fähigkeiten laufen über die Fassung (Spec 13.1). */
export const SHOW_FASSUNG = 1;

/** Warum ein Stand keine Show trägt (Spec 13.1). */
export type DatenGrund = 'keine-show' | 'zu-gross' | 'nicht-lesbar';

export interface AboInhalt {
  art: 'show';
  fassung: number;
}

export interface StandInhalt {
  art: 'show';
  fassung: number;
  epoche: string;
  folge: number;
  /** Erste 16 Hex-Zeichen von SHA-256 über den normalisierten Show-Pfad am Master; null ohne offene Show. */
  schluessel: string | null;
  /** Der Ausschnitt (Spec 14) oder null; das Tool liest ihn mit migrateShow. */
  show: Record<string, unknown> | null;
  /** Genau dann gesetzt, wenn show null ist. */
  grund?: DatenGrund;
  /** appIds der Tools, deren Eintrag am Master ein Dokument trägt (ohne Pfad). */
  mitDokument: string[];
}

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; grund: string };

type Objekt = Record<string, unknown>;
const istObjekt = (v: unknown): v is Objekt => typeof v === 'object' && v !== null && !Array.isArray(v);
const istFassung = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const EPOCHE = /^[A-Za-z0-9-]{1,64}$/;
const SCHLUESSEL = /^[0-9a-f]{16}$/;
const APP_ID = /^[a-z0-9-]{1,64}$/;
const MAX_DOKUMENTE = 64;
const GRUENDE: ReadonlySet<unknown> = new Set<DatenGrund>(['keine-show', 'zu-gross', 'nicht-lesbar']);

/** abo (Spec 13.1/13.2): art genau 'show', fassung ganze Zahl ≥ 1. Kein Objekt → grund 'art'. */
export function pruefeAbo(o: unknown): Pruefung<AboInhalt> {
  if (!istObjekt(o) || o.art !== 'show') return { ok: false, grund: 'art' };
  if (!istFassung(o.fassung)) return { ok: false, grund: 'fassung' };
  return { ok: true, wert: { art: 'show', fassung: o.fassung } };
}

/** stand und aenderung (Spec 13.2): jede Regel der Tabelle, in ihrer Reihenfolge. Kein Objekt → grund 'art'. */
export function pruefeStand(o: unknown): Pruefung<StandInhalt> {
  if (!istObjekt(o) || o.art !== 'show') return { ok: false, grund: 'art' };
  if (!istFassung(o.fassung)) return { ok: false, grund: 'fassung' };
  if (typeof o.epoche !== 'string' || !EPOCHE.test(o.epoche)) return { ok: false, grund: 'epoche' };
  if (typeof o.folge !== 'number' || !Number.isSafeInteger(o.folge) || o.folge < 0) return { ok: false, grund: 'folge' };
  if (o.schluessel !== null && (typeof o.schluessel !== 'string' || !SCHLUESSEL.test(o.schluessel))) {
    return { ok: false, grund: 'schluessel' };
  }
  if (o.show !== null && !istObjekt(o.show)) return { ok: false, grund: 'show' };
  if (o.show === null ? !GRUENDE.has(o.grund) : o.grund !== undefined) return { ok: false, grund: 'grund' };
  const liste = o.mitDokument === undefined ? [] : o.mitDokument;
  if (!Array.isArray(liste) || liste.length > MAX_DOKUMENTE || !liste.every((a) => typeof a === 'string' && APP_ID.test(a))) {
    return { ok: false, grund: 'mitDokument' };
  }
  const wert: StandInhalt = {
    art: 'show',
    fassung: o.fassung,
    epoche: o.epoche,
    folge: o.folge,
    schluessel: o.schluessel,
    show: o.show,
    ...(o.show === null ? { grund: o.grund as DatenGrund } : {}),
    mitDokument: [...(liste as string[])],
  };
  return { ok: true, wert };
}

/** Die Abo-Zeile des Tools, genau eine Zeile mit '\n'. */
export function kodiereAbo(fassung: number = SHOW_FASSUNG): string {
  return `${JSON.stringify({ t: 'abo', art: 'show', fassung })}\n`;
}

/**
 * Eine stand- bzw. aenderung-Zeile in fester Feldreihenfolge, genau eine Zeile mit '\n' (JSON.stringify maskiert
 * Zeilenumbrüche in Texten). Der Master serialisiert so einmal und schreibt dieselbe Zeile an alle Abos (Spec 13.6).
 */
export function kodiereStand(t: 'stand' | 'aenderung', s: StandInhalt): string {
  const zeile = {
    t,
    art: s.art,
    fassung: s.fassung,
    epoche: s.epoche,
    folge: s.folge,
    schluessel: s.schluessel,
    show: s.show,
    ...(s.grund !== undefined ? { grund: s.grund } : {}),
    mitDokument: s.mitDokument,
  };
  return `${JSON.stringify(zeile)}\n`;
}

/** UTF-8-Bytes einer fertigen Zeile — dagegen gilt GRENZEN.maxStandZeile (Spec 13.4), nicht gegen Zeichen. */
export function zeilenBytes(zeile: string): number {
  return Buffer.byteLength(zeile, 'utf8');
}

/** Spec 13.1: die höchste eigene Fassung, die nicht über der erbetenen liegt. */
export function antwortFassung(erbeten: number): number {
  return Math.min(erbeten, SHOW_FASSUNG);
}
