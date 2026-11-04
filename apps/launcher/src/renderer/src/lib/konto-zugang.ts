import type { KontoAnsicht } from '@shared/konto';
import type { KontoIveoEvent } from '@shared/types';
import { sitzungGueltig } from './konto-anzeige';

// Anmeldung im Launcher (Plan P28; Spec 3, 6.4; EP12, EP13, EP14, OFP3): der Zugang über die Anmeldung in den Einstellungen
// (T20–T23) und iveo im Show-Editor und im Side-Events-Panel (I5–I9) als REINE Funktionen, getestet in
// test/konto-anzeige.test.ts. Eingaben sind Ansicht, Schlüssel und Namen — nie ein Token, nie eine Sitzung.

/** Texte T20–T23 (Texttabelle 9.9, wörtlich). */
export const ZUGANG_TEXTE = {
  /** T20 */ feld: 'Server-Adresse', hinweis: 'Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.',
  /** T21 */ angemeldet: 'Angemeldet', nichtAngemeldet: 'Nicht angemeldet', entwicklung: 'Entwicklung',
  /** T22 */ zeile: 'Downloads, Updates und iveo laufen über deine Anmeldung.',
  /** T23 */ env: 'Die Server-Adresse wird per Umgebungsvariable gesetzt und kann hier nicht überschrieben werden.',
} as const;

/** Texte I5–I9 (Texttabelle 9.8, wörtlich); I6 steht als Text im Side-Events-Panel (A-D7). */
export const IVEO_TEXTE = {
  /** I5 */ bezeichner: 'iveo-Event', waehlen: 'Event wählen',
  /** I5b */ nichtAngemeldet: 'Für iveo im Launcher anmelden (oben rechts).',
  /** I5c */ keineEvents: 'Für dein Konto ist noch kein iveo-Event hinterlegt. Ein Admin hinterlegt Events in der Admin-Maske.',
  /** I5d */ gebunden: 'Dieser Rechner gleicht die Show mit iveo ab.',
  /** I7 */ uebernehmen: 'Abgleich hier übernehmen', beenden: 'Abgleich hier beenden',
  /** I8 */ ansehen: 'Side Events des Tages ansehen (Live-Umschalten nur am Rechner, der die Show abgleicht).',
  /** I9 */ warnung: 'Gleicht ein anderer Rechner diese Show noch ab, beende dort den Abgleich, sonst schreiben beide die Show.',
} as const;

export type ZugangsArt = 'angemeldet' | 'nicht-angemeldet' | 'entwicklung';

/**
 * T21 (Spec 3, EP12): Abzeichen oben rechts in den Einstellungen. „Entwicklung“, sobald eine Entwicklungs-Variable gesetzt ist
 * (dieselbe Liste wie K31 im Konto-Dialog); sonst „Angemeldet“ nur mit gültiger Sitzung (G7: vor der ersten Ansicht nicht).
 */
export function zugangsAbzeichen(a: KontoAnsicht | null): { art: ZugangsArt; text: string } {
  if (a !== null && a.devVariablen.length > 0) return { art: 'entwicklung', text: ZUGANG_TEXTE.entwicklung };
  if (a !== null && sitzungGueltig(a)) return { art: 'angemeldet', text: ZUGANG_TEXTE.angemeldet };
  return { art: 'nicht-angemeldet', text: ZUGANG_TEXTE.nichtAngemeldet };
}

/** I5b, I5c: was der iveo-Block des Show-Editors zeigt — noch offen, nicht angemeldet, keine Events oder die Auswahl. */
export function editorIveoLage(
  a: KontoAnsicht | null,
  events: KontoIveoEvent[] | null,
): { fall: 'laedt' | 'nicht-angemeldet' | 'keine' | 'auswahl'; text: string | null } {
  if (a === null) return { fall: 'laedt', text: null };
  if (!sitzungGueltig(a)) return { fall: 'nicht-angemeldet', text: IVEO_TEXTE.nichtAngemeldet };
  if (events === null) return { fall: 'laedt', text: null };
  if (events.length === 0) return { fall: 'keine', text: IVEO_TEXTE.keineEvents };
  return { fall: 'auswahl', text: null };
}

/**
 * I5 (EP13): das gewählte Event als Schlüssel ‹Basis›|‹Slug›. Eine gültige Wahl bleibt; sonst das Event der geladenen Show (Slug,
 * dazu die Basis, wenn die Show eine trägt); sonst keine Wahl — die Auswahl zeigt dann „Event wählen“.
 */
export function editorEventWahl(events: KontoIveoEvent[], wahl: string, showBasis: string, showSlug: string | null): string {
  if (wahl && events.some((e) => e.key === wahl)) return wahl;
  if (showSlug) {
    const basis = showBasis.trim();
    const e = events.find((x) => x.slug === showSlug && (!basis || x.basis === basis));
    if (e) return e.key;
  }
  return '';
}

/**
 * I7, I9 (EP14, OFP3): Knopf im Side-Events-Panel. „beenden“ dort, wo dieser Rechner abgleicht; „übernehmen“ (mit der Warnung I9)
 * nur angemeldet und mit Recht — `moeglich` meldet der Main nur mit einem Token für genau dieses Event.
 */
export function abgleichKnoepfe(
  ab: { key: string; hier: boolean; moeglich: boolean } | undefined,
  a: KontoAnsicht | null,
): { knopf: 'uebernehmen' | 'beenden' | null; warnung: string | null } {
  if (!ab) return { knopf: null, warnung: null };
  if (ab.hier) return { knopf: 'beenden', warnung: null };
  if (ab.moeglich && a !== null && sitzungGueltig(a)) return { knopf: 'uebernehmen', warnung: IVEO_TEXTE.warnung };
  return { knopf: null, warnung: null };
}
