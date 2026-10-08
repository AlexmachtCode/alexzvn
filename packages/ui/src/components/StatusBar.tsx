import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import {
  LIVE_EINTRAG_KLASSE,
  STATUS_RAND_KLASSE,
  STATUS_SYMBOL,
  STATUS_SYMBOL_KLASSE,
  formatUhrzeit,
  ordneStatus,
  type StatusItem,
} from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

export interface StatusBarProps {
  items: readonly StatusItem[];
  onOpenSection?(sectionId: string): void;
  /** Uhr-Quelle; Vorgabe () => new Date(). Tests setzen eine feste Zeit. */
  jetzt?: () => Date;
  className?: string;
}

const jetztVorgabe = (): Date => new Date();

/** Was starteUhr vom Takt braucht (setTimeout/clearTimeout passen). */
export interface Takt {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTER_TAKT: Takt = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Körper des Uhr-Effekts (E14): meldet hh:mm:ss aus jetzt() jeweils kurz nach der vollen Sekunde und plant den nächsten
 * Takt aus jetzt() neu; liefert das Aufräumen. Ein fester 1-s-Takt ab dem Einhängen ginge bis zu 1 s nach und übersprünge
 * durch Drift gelegentlich eine Sekunde. Reine Funktion mit austauschbarem Takt, damit sie ohne Browser prüfbar ist. Nur
 * aus dieser Datei exportiert.
 */
export function starteUhr(jetzt: () => Date, melde: (uhr: string) => void, takt: Takt = ECHTER_TAKT): () => void {
  let id: unknown;
  const plane = (): void => {
    id = takt.setTimeout(() => {
      melde(formatUhrzeit(jetzt()));
      plane();
    }, 1000 - jetzt().getMilliseconds());
  };
  plane();
  return () => takt.clearTimeout(id);
}

/**
 * Statusleiste am unteren Fensterrand (Spec 3.3, 7; E14).
 * - Reihenfolge fest nach Gruppen (ordneStatus), jeder Eintrag mit Symbol UND Zustandswort, nie nur Farbe.
 * - Ein Eintrag ist nur dann ein Knopf, wenn er `settingsSection` hat UND die Leiste `onOpenSection` bekommt.
 * - Ein Detail erscheint nur, wenn das Tool eines liefert (kein Ersatzzeichen). Unter 900 px Fensterbreite nur Symbol
 *   und Label; das volle Detail steht im title.
 * - Die Uhr steht außerhalb der role="status"-Region, sonst läse ein Screenreader jede Sekunde vor.
 */
export function StatusBar({ items, onOpenSection, jetzt = jetztVorgabe, className }: StatusBarProps): React.JSX.Element {
  const jetztRef = useRef(jetzt);
  jetztRef.current = jetzt;
  const [uhr, setUhr] = useState(() => formatUhrzeit(jetzt()));

  useEffect(() => starteUhr(() => jetztRef.current(), setUhr), []);

  return (
    <footer
      className={cn(
        'flex h-[var(--statusbar-h)] shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] px-2',
        'text-[11px] text-[var(--foreground)]',
        className,
      )}
    >
      <div role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {ordneStatus(items).map((item) => (
          <Eintrag key={item.id} item={item} onOpenSection={onOpenSection} />
        ))}
      </div>
      <span data-uhr="" className="tabular shrink-0 text-[var(--muted-foreground)]">
        <span className="sr-only">{UI_TEXTE.uhrzeit}: </span>
        {uhr}
      </span>
    </footer>
  );
}

function Eintrag({
  item,
  onOpenSection,
}: {
  item: StatusItem;
  onOpenSection?(sectionId: string): void;
}): React.JSX.Element {
  const id = useId();
  const ziel = item.settingsSection;
  const knopf = Boolean(ziel) && onOpenSection !== undefined;
  const zustandId = knopf ? `${id}-zustand` : undefined;
  const detailId = knopf && item.detail ? `${id}-detail` : undefined;
  const titel = item.detail ? `${item.label}: ${item.detail}` : undefined;
  const live = item.state === 'live';
  const klasse = cn(
    'inline-flex h-5 min-w-0 shrink items-center gap-1 rounded-[var(--radius-md)] border px-1.5',
    STATUS_RAND_KLASSE[item.state],
    live ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]',
  );
  const inhalt = (
    <>
      <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE[item.state]}>
        {STATUS_SYMBOL[item.state]}
      </span>
      {live ? (
        <span aria-hidden="true" className="font-extrabold tracking-[0.08em]">
          {UI_TEXTE.live}
        </span>
      ) : null}
      <span id={zustandId} className="sr-only">
        {UI_TEXTE.zustand[item.state]}:{' '}
      </span>
      <span className="font-semibold">{item.label}</span>
      {item.detail ? (
        <>
          {' '}
          <span
            id={detailId}
            className={cn(
              'min-w-0 max-w-[16rem] truncate select-text max-[900px]:sr-only',
              live ? undefined : 'text-[var(--muted-foreground)]',
            )}
          >
            {item.detail}
          </span>
        </>
      ) : null}
    </>
  );

  if (ziel && onOpenSection) {
    return (
      <button
        type="button"
        data-status-id={item.id}
        data-state={item.state}
        title={titel}
        aria-label={UI_TEXTE.statusOeffnen(item.label)}
        aria-describedby={detailId ? `${zustandId} ${detailId}` : zustandId}
        onClick={() => onOpenSection(ziel)}
        className={cn(
          klasse,
          'cursor-pointer',
          // Hover ohne Fläche: auf --muted erreichte das ▲ von --status-warn hell nur 2,91 : 1 (Task 4, E14)
          'hover:underline',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]',
          'motion-safe:transition-colors motion-safe:duration-150',
        )}
      >
        {inhalt}
      </button>
    );
  }
  return (
    <span data-status-id={item.id} data-state={item.state} title={titel} className={klasse}>
      {inhalt}
    </span>
  );
}
