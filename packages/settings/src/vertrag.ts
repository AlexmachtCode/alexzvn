// --- @jm/settings: gemeinsamer Vertrag der Einstellungs-Abschnitte (Spec 6.1, 7) ---
//
// Ein Abschnitt bekommt Rohdaten (`SectionInput` plus eigene Felder) und leitet daraus in einer
// reinen Funktion `…View(props)` seine Sicht ab. Die Sicht erfüllt `SectionBase` aus Spec 6.1:
// Der Status wird im Paket berechnet, nicht vom Tool geliefert (Plan E1). So liegen alle
// Statustexte fest im Paket (6.1) und die Regeln aus Spec 7 sind hier als Kreuzprodukt testbar.
import { UNBEKANNT, type StatusGroup, type StatusItem, type StatusState } from '@jm/ui';

/** Spec 6.1 wörtlich. */
export interface SectionStatus { state: StatusState; text: string }

/** Spec 6.1 wörtlich: die abgeleitete Sicht eines Abschnitts. */
export interface SectionBase {
  id: string;                  // Sprungziel für StatusItem.settingsSection
  status: SectionStatus;
  locked?: string;             // gesperrt + Grund, z. B. „Vom Master vorgegeben“
  error?: string;              // Fehlertext, immer unter den Feldern
}

/** Eingabe jedes Abschnitts (Plan E1): alles aus SectionBase außer dem Status. */
export type SectionInput = Omit<SectionBase, 'status'>;

/** Spec 7.4: Abschnitte melden nie `live`. */
export type AbschnittZustand = Exclude<StatusState, 'live'>;

/** Feste Texte, die mehrere Abschnitte teilen. */
export const ABSCHNITT_TEXTE = {
  imLauncherEinrichten: 'Im Launcher einrichten',
  anOhneRueckmeldung: 'an (ohne Rückmeldung)',
  aus: 'aus',
  gesperrtVomMaster: 'Vom Master vorgegeben',
  gesperrt: (grund: string) => `Gesperrt: ${grund}`,
  bitteWaehlen: '– bitte wählen –',
  nochNichtUebernommen: 'Noch nicht übernommen.',
} as const;

/** Status eines Abschnitts bauen. Wirft bei `live` (Spec 7.4), auch wenn der Typ umgangen wird. */
export function st(state: AbschnittZustand, text: string): SectionStatus {
  if ((state as StatusState) === 'live') throw new Error('Ein Einstellungs-Abschnitt meldet nie „live“ (Spec 7.4).');
  return { state, text };
}

/** Spec 7.2: Unbekannt ist `off` mit Text „unbekannt“, nie `ok`. */
export const STATUS_UNBEKANNT: SectionStatus = Object.freeze({ state: 'off', text: UNBEKANNT });

/** Fehler aus `SectionInput.error` bzw. ein gemessener Fehler: „Fehler: {detail}“. */
export function fehlerStatus(detail: string): SectionStatus {
  return st('error', `Fehler: ${detail}`);
}

/** Ist der Abschnitt gesperrt? Ein leerer Grund zählt nicht (gesperrt nie ohne Grund). */
export function istGesperrt(view: Pick<SectionBase, 'locked'>): boolean {
  return typeof view.locked === 'string' && view.locked !== '';
}

/** Hat der Abschnitt einen Fehlertext? Ein leerer Text zählt nicht. */
export function hatFehler(input: Pick<SectionBase, 'error'>): input is { error: string } {
  return typeof input.error === 'string' && input.error !== '';
}

/**
 * Statusleisten-Eintrag aus der Sicht eines Abschnitts: gleicher Zustand wie die Statuspille,
 * Detail = Statustext, Klick springt zum Abschnitt. Ein eigenes Detail des Tools ersetzt den Statustext nur bei
 * `ok`; in jedem anderen Zustand steht der Statustext dahinter (Spec 7.2/7.3: „unbekannt“, „ohne Rückmeldung“
 * und „Fehler: …“ dürfen nie verschwinden).
 */
export function abschnittStatusItem(
  view: SectionBase,
  eintrag: { group: StatusGroup; label: string; detail?: string },
): StatusItem {
  return {
    id: view.id,
    group: eintrag.group,
    label: eintrag.label,
    state: view.status.state,
    detail: eintrag.detail === undefined ? view.status.text : view.status.state === 'ok' ? eintrag.detail : `${eintrag.detail} · ${view.status.text}`,
    settingsSection: view.id,
  };
}
