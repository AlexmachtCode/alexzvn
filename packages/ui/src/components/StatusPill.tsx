import { cn } from '../lib/cn';
import { LIVE_EINTRAG_KLASSE, STATUS_RAND_KLASSE, STATUS_SYMBOL, STATUS_SYMBOL_KLASSE, type StatusState } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

export interface StatusPillProps {
  state: StatusState;
  text: string;
  title?: string;
  className?: string;
}

/**
 * Kleine Zustandsanzeige (Spec 3.3, 4.2): Symbol (Form je Zustand) plus Text, nie nur Farbe. Die Statusfarbe färbt nur
 * Symbol und Rand; das Wort steht in Vordergrundfarbe. Das Zustandswort („Fehler: “ …) liest nur der Screenreader.
 * live ist rot gefüllt mit der Kennung „LIVE“ (E14), error nur umrandet.
 */
export function StatusPill({ state, text, title, className }: StatusPillProps): React.JSX.Element {
  const live = state === 'live';
  return (
    <span
      data-state={state}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border px-2 py-0.5',
        'text-[11px] font-semibold',
        live ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]',
        STATUS_RAND_KLASSE[state],
        className,
      )}
    >
      <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE[state]}>
        {STATUS_SYMBOL[state]}
      </span>
      {live ? (
        <span aria-hidden="true" className="font-extrabold tracking-[0.08em]">
          {UI_TEXTE.live}
        </span>
      ) : null}
      <span className="sr-only">{UI_TEXTE.zustand[state]}: </span>
      {text}
    </span>
  );
}
