import { cn } from '@jm/ui';
import type { NdiStatus } from '@shared/types';
import { ndiSchalterText } from '../../../shared/ndi';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';

// Aussehen wie die Knöpfe der jeweiligen Leiste (Werkzeugleiste: Button size="sm" aus @jm/ui; Referent: LeistenKnopf).
const GRUNDFORM = {
  editor: 'inline-flex h-8 items-center justify-center px-3 rounded-[var(--radius)] text-xs font-extrabold tracking-wide whitespace-nowrap border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
  referent: 'h-8 px-3 shrink-0 rounded-md text-xs font-semibold whitespace-nowrap border transition-colors disabled:opacity-40 disabled:pointer-events-none',
} as const;

const RUHIG = 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--highlight)]';
const SENDET = 'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)]';
// An, aber nicht verfügbar (früher bernsteinfarben): Rand und Fläche in der Warnfarbe, Schrift in Vordergrundfarbe.
const WARNUNG = 'border-[var(--status-warn)] bg-[var(--status-warn)]/15 text-[var(--foreground)] hover:bg-[var(--status-warn)]/25';

/**
 * NDI-Schalter mit Empfängerzahl als reine Anzeige (UX Welle 2b, d1 und d2): der Status kommt herein (Editor und Referent: aus
 * useStand), der Klick meldet `onSchalten(!an)`. Vor der ersten Antwort gesperrt mit „Lädt …“ und „NDI unbekannt“ statt eines
 * erfundenen „aus“; außer unter Windows gesperrt (wie bisher). In der Leiste des Referenten steht der Tooltip (auch der Sperrgrund)
 * am Rahmen wie bei den anderen Leistenknöpfen (Gesamtprüfung UX Welle 2b, M6); in der Werkzeugleiste des Editors wie bisher.
 */
export function NdiKnopf({
  variante,
  status,
  plattform,
  onSchalten,
}: {
  variante: 'editor' | 'referent';
  status: NdiStatus | undefined;
  plattform: string;
  onSchalten(an: boolean): void;
}) {
  const sendet = status?.lage === 'sendet';
  const warnung = status?.an === true && status.lage === 'nicht-verfuegbar';
  const titel = status === undefined ? PRESENTER_TEXTE.grund.zustandOffen : status.grund ?? PRESENTER_TEXTE.ndi.tipp;
  const amRahmen = variante === 'referent';
  const knopf = (
    <button
      type="button"
      data-presenter="ndi"
      onClick={() => {
        if (status) onSchalten(!status.an);
      }}
      disabled={plattform !== 'win32' || status === undefined}
      title={amRahmen ? undefined : titel}
      className={cn(GRUNDFORM[variante], warnung ? WARNUNG : sendet ? SENDET : RUHIG)}
    >
      {status === undefined ? PRESENTER_TEXTE.ndi.schalterUnbekannt : ndiSchalterText(status)}
    </button>
  );
  return amRahmen ? (
    <span title={titel} className="inline-flex shrink-0">
      {knopf}
    </span>
  ) : (
    knopf
  );
}
