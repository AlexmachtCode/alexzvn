// --- @jm/settings: iveo (Spec 6.2, Regeln 7.1–7.3, Plan E15) ---
//
// Das iveo-Token bleibt ausschließlich im Launcher: Der Abschnitt hat kein Token-Feld und keine
// Eingabe. „verbunden“ steht nur, wenn das Tool eine Lieferung gemessen hat (`delivery === 'ok'`);
// eine Show-Bindung allein ist ein Zwischenspeicher, also ohne Messung „unbekannt“.
import { formatUhrzeitKurz, zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface IveoSectionProps extends SectionInput {
  bound: boolean;                    // Show mit iveo-Bindung offen
  eventName?: string; stage?: string; speakerCount?: number;
  delivery?: 'ok' | 'veraltet';      // gemessen; undefined = unbekannt
  staleSince?: string;               // ISO, nur bei 'veraltet'
  onOpenLauncher?(): void;
}

export const IVEO_TEXTE = {
  titel: 'iveo',
  event: 'Event',
  buehne: 'Bühne',
  speaker: 'Speaker',
  verbunden: 'verbunden',
  verbundenMitEvent: (event: string) => `verbunden · ${event}`,
  nichtEingerichtet: 'nicht eingerichtet',
  frueherStand: 'Liste aus früherem Stand',
  frueherStandSeit: (hhmm: string) => `Liste aus früherem Stand (seit ${hhmm})`,
  tokenImLauncher: 'Das Zugriffstoken bleibt im Launcher.',
  imLauncherEinrichten: ABSCHNITT_TEXTE.imLauncherEinrichten,
} as const;

export interface IveoView extends SectionBase {
  sichtbar: { event: boolean; buehne: boolean; speaker: boolean; imLauncher: boolean };
  speakerText?: string;
}

function iveoStatus(p: IveoSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (!p.bound) return st('off', IVEO_TEXTE.nichtEingerichtet);
  if (p.delivery === 'veraltet') {
    const seit = formatUhrzeitKurz(p.staleSince);
    return st('warn', seit ? IVEO_TEXTE.frueherStandSeit(seit) : IVEO_TEXTE.frueherStand);
  }
  if (p.delivery === 'ok') return st('ok', p.eventName ? IVEO_TEXTE.verbundenMitEvent(p.eventName) : IVEO_TEXTE.verbunden);
  return STATUS_UNBEKANNT;
}

export function iveoView(p: IveoSectionProps): IveoView {
  const da = (t: string | undefined): boolean => p.bound && typeof t === 'string' && t !== '';
  return {
    id: p.id,
    status: iveoStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      event: da(p.eventName),
      buehne: da(p.stage),
      speaker: p.bound && typeof p.speakerCount === 'number',
      imLauncher: typeof p.onOpenLauncher === 'function',
    },
    speakerText: p.bound && typeof p.speakerCount === 'number' ? zahlText(p.speakerCount) : undefined,
  };
}
