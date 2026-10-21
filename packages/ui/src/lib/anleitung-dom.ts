// Reine DOM-Helfer der geführten Anleitungen (P4; Plan EP10, EP11, EP18): Ziel finden, Platz der Sprechblase, Taste, Fokus.
// Ohne DOM mit Attrappen getestet (Muster SettingsPanel: panelTaste, panelFokus). Nur aus dieser Datei exportiert.
// blasenTaste und blasenFokus sind die Körper von Tasten-Handler und Fokus-Effekt der Sprechblase (die Komponente ruft nur sie).
import { ZIEL_MUSTER, type AnleitungsEreignis } from './anleitung';

/** Attribut der festen Ziel-Kennungen (Spec 7, EP10): `data-anleitung="bereich.name"`. */
export const ZIEL_ATTRIBUT = 'data-anleitung';
/** Mindestabstand der Sprechblase zum Fensterrand (px). */
export const BLASEN_RAND = 8;

export interface Rechteck {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}
export interface Groesse {
  breite: number;
  hoehe: number;
}
/** Größe, mit der die Sprechblase geplant wird: Breite --panel-w (360 px), Höhe höchstens max-h-[300px]. */
export const BLASEN_GROESSE: Groesse = { breite: 360, hoehe: 300 };

/** Was findeZiel von einem Element braucht (Element passt). */
export interface ZielElement {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}
/** Was findeZiel von der Wurzel braucht (document passt). */
export interface ZielWurzel {
  querySelectorAll(selektor: string): ArrayLike<ZielElement>;
}

/**
 * Erstes Element mit der Kennung, das eine Fläche hat und das Fenster schneidet (mehrere Instanzen wie „Installieren“ je
 * Tool: die erste sichtbare). Ungültige Kennung, keine Wurzel oder nichts Sichtbares → null (die Blase sagt es ehrlich).
 */
export function findeZiel(w: ZielWurzel | null, kennung: string, fenster: Groesse): Rechteck | null {
  if (w === null || !ZIEL_MUSTER.test(kennung)) return null;
  const liste = w.querySelectorAll(`[${ZIEL_ATTRIBUT}="${kennung}"]`);
  for (let i = 0; i < liste.length; i++) {
    const r = liste[i].getBoundingClientRect();
    const sichtbar = r.width > 0 && r.height > 0 && r.left < fenster.breite && r.top < fenster.hoehe && r.left + r.width > 0 && r.top + r.height > 0;
    if (sichtbar) return { x: r.left, y: r.top, breite: r.width, hoehe: r.height };
  }
  return null;
}

/** Gleiche Lage und Größe (der Hook ersetzt den Zustand nur bei einer Änderung). */
export function gleichesRechteck(a: Rechteck | null, b: Rechteck | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.breite === b.breite && a.hoehe === b.hoehe;
}

/** Eine Messung des Hooks: das Rechteck (null = nicht zu sehen) zusammen mit der Kennung, für die gemessen wurde. */
export interface ZielMessung {
  kennung: string;
  rechteck: Rechteck | null;
}
/** Ziel einer Sprechblase: gemessen (Rechteck), gemessen und nicht zu sehen (null) oder noch nicht gemessen. */
export type ZielStand = Rechteck | null | 'ungemessen';

/**
 * Was useAnleitungsZiel zurückgibt (Körper des Hooks, mit Attrappen getestet; G7): Eine Messung gilt nur für ihre Kennung.
 * Gibt es für die Kennung noch keine (erster Render, Schrittwechsel), ist das Ziel 'ungemessen': weder Hervorhebung noch
 * „Ziel fehlt“, denn die Diagnose stünde sonst vor der ersten Messung da, genau wenn der Fokus in die Blase geht. Ohne Kennung null.
 */
export function zielStand(m: ZielMessung | null, kennung: string | null): ZielStand {
  if (kennung === null) return null;
  return m !== null && m.kennung === kennung ? m.rechteck : 'ungemessen';
}

/** Neue Messung übernehmen; gleiche Kennung und gleiches Rechteck → der alte Zustand (kein neues Rendern). */
export function neueMessung(alt: ZielMessung | null, neu: ZielMessung): ZielMessung {
  return alt !== null && alt.kennung === neu.kennung && gleichesRechteck(alt.rechteck, neu.rechteck) ? alt : neu;
}

const klemme = (wert: number, min: number, max: number): number => Math.max(min, Math.min(wert, max));

/** Wie viel eine Strecke [von, von + laenge] von der Strecke [zielVon, zielVon + zielLaenge] abdeckt (px). */
const deckt = (von: number, laenge: number, zielVon: number, zielLaenge: number): number =>
  Math.max(0, Math.min(von + laenge, zielVon + zielLaenge) - Math.max(von, zielVon));

/**
 * Platz der Sprechblase (EP11): unter dem Ziel, sonst darüber, rechts, links; ohne Ziel in der Mitte. Nie außerhalb des
 * Fensters (Abstand BLASEN_RAND). Passt sie an keine Seite ganz neben das Ziel (großes Ziel: Raster, Karte, Abschnitt), steht
 * sie in der Fensterecke, in der sie am wenigsten vom Ziel abdeckt: je Achse der Rand mit der kleineren Überdeckung. Weil die
 * Fläche das Produkt beider Achsen ist und jede Achse am Rand am kleinsten wird, ist das die kleinste Überdeckung aller Lagen im
 * Fenster. Nie mittig über dem Ziel (die Blase nimmt Klicks an, dort fing sie etwa „Los“ der ersten Vorlage); über dem Ziel
 * steht sie nur so weit, wie der freie Platz nicht reicht.
 */
export function blasenPlatz(
  ziel: Rechteck | null,
  fenster: Groesse,
  blase: Groesse,
  abstand = 12,
): { x: number; y: number; seite: 'unten' | 'oben' | 'rechts' | 'links' | 'ecke' | 'mitte' } {
  const maxX = Math.max(BLASEN_RAND, fenster.breite - blase.breite - BLASEN_RAND);
  const maxY = Math.max(BLASEN_RAND, fenster.hoehe - blase.hoehe - BLASEN_RAND);
  const mitte = { x: klemme((fenster.breite - blase.breite) / 2, BLASEN_RAND, maxX), y: klemme((fenster.hoehe - blase.hoehe) / 2, BLASEN_RAND, maxY), seite: 'mitte' as const };
  if (ziel === null) return mitte;
  const x = klemme(ziel.x + ziel.breite / 2 - blase.breite / 2, BLASEN_RAND, maxX);
  const y = klemme(ziel.y + ziel.hoehe / 2 - blase.hoehe / 2, BLASEN_RAND, maxY);
  const unten = ziel.y + ziel.hoehe + abstand;
  if (unten + blase.hoehe <= fenster.hoehe - BLASEN_RAND) return { x, y: unten, seite: 'unten' };
  const oben = ziel.y - abstand - blase.hoehe;
  if (oben >= BLASEN_RAND) return { x, y: oben, seite: 'oben' };
  const rechts = ziel.x + ziel.breite + abstand;
  if (rechts + blase.breite <= fenster.breite - BLASEN_RAND) return { x: rechts, y, seite: 'rechts' };
  const links = ziel.x - abstand - blase.breite;
  if (links >= BLASEN_RAND) return { x: links, y, seite: 'links' };
  const eckeX = deckt(maxX, blase.breite, ziel.x, ziel.breite) <= deckt(BLASEN_RAND, blase.breite, ziel.x, ziel.breite) ? maxX : BLASEN_RAND;
  const eckeY = deckt(maxY, blase.hoehe, ziel.y, ziel.hoehe) <= deckt(BLASEN_RAND, blase.hoehe, ziel.y, ziel.hoehe) ? maxY : BLASEN_RAND;
  return { x: eckeX, y: eckeY, seite: 'ecke' };
}

/** Escape = „Später weiter“, wenn die Taste noch niemandem gehört (Spec 3, EP18). Nur bei Fokus in der Sprechblase gerufen. */
export function anleitungTaste(e: { key: string; defaultPrevented: boolean }): 'spaeter' | null {
  return e.key === 'Escape' && !e.defaultPrevented ? 'spaeter' : null;
}

/**
 * Fokus in die Sprechblase (EP18)? Ja, wenn der Bediener die Anleitung öffnet oder in ihr bedient; geht sie von selbst
 * weiter (erkannt), bleibt der Fokus, wo er ist, außer er lag schon in der Blase.
 */
export function fokusInBlase(grund: 'geoeffnet' | 'bedienung' | 'erkannt', fokusWarInBlase: boolean): boolean {
  return grund === 'erkannt' ? fokusWarInBlase : true;
}

/** Was blasenTaste vom Tastenereignis braucht (React.KeyboardEvent passt). */
export interface TastenEreignis {
  key: string;
  defaultPrevented: boolean;
  stopPropagation(): void;
  preventDefault(): void;
}

/**
 * Körper des Tasten-Handlers der Sprechblase (Spec 3, EP18): Escape = „Später weiter“, nur wenn die Blase den Knopf anbietet
 * und die Taste noch niemandem gehört. Dann hält die Blase die Taste bei sich (stopPropagation: Verbund- und System-Dialog
 * hören Escape auf window und schlössen sonst mit) und meldet `spaeter`. Rückgabe: Taste genommen?
 */
export function blasenTaste(e: TastenEreignis, spaeterAngeboten: boolean, melde: (ereignis: AnleitungsEreignis) => void): boolean {
  if (anleitungTaste(e) !== 'spaeter' || !spaeterAngeboten) return false;
  e.stopPropagation();
  e.preventDefault();
  melde({ art: 'spaeter' });
  return true;
}

/** Was blasenFokus vom Element der Sprechblase braucht (HTMLElement passt). */
export interface FokusElement {
  contains(anderes: unknown): boolean;
  focus(optionen: { preventScroll: boolean }): void;
}

/**
 * Körper des Fokus-Effekts der Sprechblase (EP18): holt den Fokus nur, wenn fokusInBlase es sagt (Öffnen, Bedienen oder
 * Fokus schon in der Blase); geht die Anleitung von selbst weiter, bleibt er, wo er ist. Rückgabe: geholt?
 */
export function blasenFokus(el: FokusElement | null, aktiv: unknown, grund: 'geoeffnet' | 'bedienung' | 'erkannt'): boolean {
  if (el === null || !fokusInBlase(grund, el.contains(aktiv))) return false;
  el.focus({ preventScroll: true });
  return true;
}
