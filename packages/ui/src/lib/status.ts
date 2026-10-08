// Statusleiste: Typen (Spec 3.3 wörtlich), feste Reihenfolge, Symbole und Klassen je Zustand, „unbekannt“, Uhrzeit.
// Reine Logik ohne DOM. Jeder Zustand hat Symbol UND Text (Spec 3.3, 4.2). Die Statusfarben färben nur Symbole,
// Ränder und Flächen, nie Wörter: STATUS_SYMBOL_KLASSE ist die einzige Stelle mit Statusfarbe als Schrift (G7).
import { UNBEKANNT } from './texte';

export type StatusState = 'ok' | 'warn' | 'error' | 'off' | 'live';
export type StatusGroup = 'verbindung' | 'ausgabe' | 'fernsteuerung' | 'tool';
export interface StatusItem {
  id: string;
  group: StatusGroup;
  label: string;
  state: StatusState;
  detail?: string;
  settingsSection?: string;
}

/** Feste Reihenfolge der Gruppen in der Statusleiste (Spec 3.3). */
export const STATUS_GRUPPEN: readonly StatusGroup[] = ['verbindung', 'ausgabe', 'fernsteuerung', 'tool'];

/** Form statt nur Farbe (Spec 3.3): ok ●, warn ▲, error ⚠, off ○, live ■. */
export const STATUS_SYMBOL: Readonly<Record<StatusState, string>> = {
  ok: '●',
  warn: '▲',
  error: '⚠',
  off: '○',
  live: '■',
};

/**
 * Farbe des Symbols je Zustand. Einziger Ort mit Statusfarbe als Schrift-Klasse (Quellregel in Task 3). live steht auf
 * der roten Fläche (LIVE_EINTRAG_KLASSE) und trägt deshalb deren Schriftfarbe.
 */
export const STATUS_SYMBOL_KLASSE: Readonly<Record<StatusState, string>> = {
  ok: 'text-[var(--tally-ready)]',
  warn: 'text-[var(--status-warn)]',
  error: 'text-[var(--status-error)]',
  off: 'text-[var(--status-off)]',
  live: 'text-[var(--background)]',
};

/** Rand je Zustand: error rot umrandet, live rot, warn orange, ok und off neutral (Spec 3.3). */
export const STATUS_RAND_KLASSE: Readonly<Record<StatusState, string>> = {
  ok: 'border-[var(--border)]',
  warn: 'border-[var(--status-warn)]',
  error: 'border-[var(--status-error)]',
  off: 'border-[var(--border)]',
  live: 'border-[var(--tally-live)]',
};

/**
 * Fläche eines live-Eintrags (StatusBar, StatusPill): rot gefüllt, Symbol und Schrift in Hintergrundfarbe (Spec 3.3
 * „live ■ rot gefüllt“, 4.2 „gefüllt + LIVE gegen Rahmen + ⚠“; E14). Normale Schrift genügt: dunkel 4,63, hell 5,43 : 1.
 */
export const LIVE_EINTRAG_KLASSE = 'bg-[var(--tally-live)] text-[var(--background)]';

/**
 * Text auf der roten LIVE-Fläche (TallyButton live, ON AIR im Kopf). Weiß auf --tally-live erreicht dunkel nur
 * 3,90 : 1, also nur „große Schrift“ (≥ 18,66 px fett, WCAG 1.4.3): deshalb 19 px extrafett (E3).
 */
export const LIVE_FLAECHE_KLASSE = 'bg-[var(--tally-live)] text-[var(--brand-fg-on-dark)] text-[19px] leading-none font-extrabold';

/** Stabil nach STATUS_GRUPPEN, innerhalb einer Gruppe in Array-Reihenfolge; die Eingabe bleibt unverändert. */
export function ordneStatus(items: readonly StatusItem[]): StatusItem[] {
  const rang = (gruppe: StatusGroup): number => {
    const i = STATUS_GRUPPEN.indexOf(gruppe);
    return i === -1 ? STATUS_GRUPPEN.length : i;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rang(a.item.group) - rang(b.item.group) || a.index - b.index)
    .map((eintrag) => eintrag.item);
}

/** Eintrag für einen Zustand, den das Tool nicht kennt: off mit Text „unbekannt“, nie ok (Spec 7.2). */
export function unbekannt(item: Omit<StatusItem, 'state' | 'detail'>): StatusItem {
  return { ...item, state: 'off', detail: UNBEKANNT };
}

const zweistellig = (n: number): string => String(n).padStart(2, '0');

/** hh:mm:ss in Ortszeit (Uhr rechts in der Statusleiste). */
export function formatUhrzeit(d: Date): string {
  return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}:${zweistellig(d.getSeconds())}`;
}

/** hh:mm in Ortszeit aus einem ISO-Zeitpunkt; leer oder ungültig → undefined. */
export function formatUhrzeitKurz(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`;
}
