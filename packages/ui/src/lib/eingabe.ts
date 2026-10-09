// Reine Logik der Eingaben (Spec 3.5; E11, E12, E13). Ohne DOM testbar; Field, NumberInput und Select nutzen sie.
import { UI_TEXTE, zahlTextVoll } from './texte';

// ── Zahlen (NumberInput) ──

export interface ZahlRegeln {
  min?: number;
  max?: number;
  ganzzahl?: boolean;
}

export type ZahlErgebnis = { ok: true; wert: number } | { ok: false; fehler: string };

const ZAHL = /^-?\d+([.,]\d+)?$/;

/** Prüft einen Eingabetext. Komma und Punkt sind Dezimaltrenner. Außerhalb von min/max wird nie geklemmt. */
export function parseZahl(text: string, regeln: ZahlRegeln = {}): ZahlErgebnis {
  const roh = text.trim();
  if (!ZAHL.test(roh)) return { ok: false, fehler: UI_TEXTE.zahlFehlt };
  const wert = Number(roh.replace(',', '.'));
  if (regeln.ganzzahl && !Number.isInteger(wert)) return { ok: false, fehler: UI_TEXTE.ganzzahlFehlt };
  if (regeln.min !== undefined && wert < regeln.min) return { ok: false, fehler: UI_TEXTE.mindestens(regeln.min) };
  if (regeln.max !== undefined && wert > regeln.max) return { ok: false, fehler: UI_TEXTE.hoechstens(regeln.max) };
  return { ok: true, wert };
}

/**
 * Entwurf im Feld: Text, wie getippt; fehler nach einem misslungenen Übernehmen oder nach der Frist; geaendert = weicht vom
 * Wert ab; gesendet = per onChange gemeldet, aber noch nicht als Wert zurückgekommen (E27).
 */
export interface ZahlEntwurf {
  text: string;
  fehler?: string;
  geaendert: boolean;
  gesendet?: number;
}

export type ZahlEreignis =
  | { art: 'tippen'; text: string }
  | { art: 'uebernehmen' } // Enter oder Verlassen
  | { art: 'verwerfen' } // Escape
  | { art: 'aussen'; wert: number | null } // neuer Wert von außen
  | { art: 'frist' }; // die Frist nach dem Melden ist um (E27)

export function zahlEntwurfAus(wert: number | null): ZahlEntwurf {
  return { text: wert === null ? '' : zahlTextVoll(wert), geaendert: false };
}

/**
 * Ein Schritt des Entwurfs. neuerWert nur, wenn eine gültige Zahl übernommen wird, die sich vom aktuellen Wert
 * unterscheidet. verbraucht = Escape hat einen geänderten Entwurf verworfen (dann gehört Escape dem Feld, nicht dem Panel).
 */
export function zahlSchritt(
  z: ZahlEntwurf,
  e: ZahlEreignis,
  regeln: ZahlRegeln,
  aktuell: number | null,
): { z: ZahlEntwurf; neuerWert?: number; verbraucht: boolean } {
  if (e.art === 'tippen') {
    return { z: { text: e.text, geaendert: e.text !== zahlEntwurfAus(aktuell).text }, verbraucht: false };
  }
  if (e.art === 'uebernehmen') {
    if (!z.geaendert) return { z: zahlEntwurfAus(aktuell), verbraucht: false };
    const ergebnis = parseZahl(z.text, regeln);
    if (!ergebnis.ok) return { z: { text: z.text, fehler: ergebnis.fehler, geaendert: true }, verbraucht: false };
    if (ergebnis.wert === aktuell) return { z: zahlEntwurfAus(aktuell), verbraucht: false };
    // Schon gemeldet und noch nicht zurück: nicht noch einmal melden (Verlassen nach Enter, abgelehnter Wert; E27).
    if (ergebnis.wert === z.gesendet) return { z, verbraucht: false };
    // Gemeldet ist noch nicht übernommen: Der Entwurf bleibt geändert und merkt sich den Wert, bis er von außen
    // zurückkommt („aussen“); bleibt die Antwort aus, zeigt das Feld nach der Frist „Noch nicht übernommen.“ („frist“).
    // Escape gehört bis dahin weiter dem Feld.
    return { z: { text: zahlTextVoll(ergebnis.wert), geaendert: true, gesendet: ergebnis.wert }, neuerWert: ergebnis.wert, verbraucht: false };
  }
  if (e.art === 'verwerfen') {
    return { z: zahlEntwurfAus(aktuell), verbraucht: z.geaendert };
  }
  if (e.art === 'frist') {
    return { z: z.gesendet === undefined || z.fehler ? z : { ...z, fehler: UI_TEXTE.nochNichtUebernommen }, verbraucht: false };
  }
  // aussen: ein ungeänderter oder schon gemeldeter Entwurf folgt dem neuen Wert (das Tool hat geantwortet); ein
  // angefangener bleibt stehen (nichts Getipptes geht verloren)
  if (!z.geaendert || z.gesendet !== undefined || z.text === zahlEntwurfAus(e.wert).text) {
    return { z: zahlEntwurfAus(e.wert), verbraucht: false };
  }
  return { z, verbraucht: false };
}

/**
 * zahlSchritt für ein Feld, das gesperrt sein kann: Ein gesperrtes Feld nimmt weder Tippen noch Verlassen an und meldet
 * nichts (ein blur beim Sperren darf keinen Wert aus dem gesperrten Feld senden). Verwerfen und aussen laufen weiter; das
 * Feld verwirft beim Sperren den Entwurf, damit es den echten Wert zeigt und beim Entsperren nichts Altes meldet.
 */
export function zahlSchrittMitSperre(
  gesperrt: boolean,
  z: ZahlEntwurf,
  e: ZahlEreignis,
  regeln: ZahlRegeln,
  aktuell: number | null,
): { z: ZahlEntwurf; neuerWert?: number; verbraucht: boolean } {
  if (gesperrt && (e.art === 'tippen' || e.art === 'uebernehmen')) return { z, verbraucht: false };
  return zahlSchritt(z, e, regeln, aktuell);
}

/**
 * Zeigt das Feld eine Zahl, die gilt? Gültig ist ein unveränderter Entwurf (er zeigt den Wert) oder einer, den Übernehmen
 * annähme; ungültig ist alles, was das Feld mit Fehlertext stehen ließe – schon beim Tippen. Für Aufrufer, die neben dem
 * Feld handeln (z. B. „Setzen“): onChange meldet nur gültige Zahlen, der zuletzt gemeldete Wert ist bei einem ungültigen
 * Entwurf also nicht das, was das Feld zeigt.
 */
export function zahlEntwurfGueltig(z: ZahlEntwurf, regeln: ZahlRegeln): boolean {
  return !z.geaendert || parseZahl(z.text, regeln).ok;
}

// ── Frist nach dem Melden (E27) ──

/** So lange wartet ein Feld auf den gemeldeten Wert, bevor es „Noch nicht übernommen.“ zeigt. */
export const UEBERNAHME_FRIST_MS = 2000;

/** Was starteFrist vom Takt braucht (setTimeout/clearTimeout passen). */
export interface FristTakt {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTE_FRIST: FristTakt = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Körper des Frist-Effekts: meldet einmal nach UEBERNAHME_FRIST_MS; liefert das Aufräumen (neue Eingabe, Antwort, Abbau). */
export function starteFrist(melde: () => void, takt: FristTakt = ECHTE_FRIST): () => void {
  const id = takt.setTimeout(melde, UEBERNAHME_FRIST_MS);
  return () => takt.clearTimeout(id);
}

// ── Auswahl (Select) ──

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Optionen für ein natives <select>, die den Wert nie still umspringen lassen (E11):
 * - Wert vorhanden → Kopie der Liste.
 * - Wert '' und nicht in der Liste → erste Option { value: '', label: placeholder ?? „– bitte wählen –“ }.
 * - Wert fehlt → erste Option „nicht verfügbar: {fehlendLabel ?? value}“, disabled, damit sie gewählt bleibt.
 */
export function selectOptionen(
  options: readonly SelectOption[],
  value: string,
  opts: { placeholder?: string; fehlendLabel?: string } = {},
): Array<SelectOption & { disabled?: boolean }> {
  const liste = options.map((o) => ({ value: o.value, label: o.label }));
  if (options.some((o) => o.value === value)) return liste;
  if (value === '') return [{ value: '', label: opts.placeholder ?? UI_TEXTE.bitteWaehlen }, ...liste];
  return [{ value, label: UI_TEXTE.nichtVerfuegbar(opts.fehlendLabel ?? value), disabled: true }, ...liste];
}

// ── Feld-IDs (Field) ──

export interface FeldIds {
  input: string;
  hilfe: string;
  sperre: string;
  fehler: string;
}

export function feldIds(basis: string): FeldIds {
  return { input: basis, hilfe: `${basis}-hilfe`, sperre: `${basis}-sperre`, fehler: `${basis}-fehler` };
}

/** aria-describedby in der Reihenfolge Hilfe, Sperre, Fehler, dann extra; nichts → undefined. */
export function beschreibtDurch(
  ids: FeldIds,
  hat: { hilfe?: boolean; sperre?: boolean; fehler?: boolean; extra?: string[] },
): string | undefined {
  const teile: string[] = [];
  if (hat.hilfe) teile.push(ids.hilfe);
  if (hat.sperre) teile.push(ids.sperre);
  if (hat.fehler) teile.push(ids.fehler);
  teile.push(...(hat.extra ?? []));
  return teile.length > 0 ? teile.join(' ') : undefined;
}
