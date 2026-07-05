import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface Props {
  /** Schließen (Escape, Klick auf den Hintergrund, ✕). */
  onClose: () => void;
  /**
   * Optionaler Titel — wird als Kopfzeile mit ✕ gerendert UND per `aria-labelledby`
   * mit dem Dialog verknüpft. Ohne Titel sollte der Aufrufer den Inhalt selbst
   * beschriften (eigene Überschrift via `children`).
   */
  title?: string;
  /** Klassen fürs Dialog-Panel — v. a. die Breite (z. B. "w-[40rem]"). */
  className?: string;
  /** Backdrop-Klick schließt (Default: true). Für kritische Formulare abschaltbar. */
  closeOnBackdrop?: boolean;
  /** z-Index-Klasse des Overlays (Default: "z-50"). */
  overlayClassName?: string;
  children: ReactNode;
}

/** Fokussierbare Elemente innerhalb des Dialogs (für den Focus-Trap). */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Barrierefreier modaler Dialog in der JM-Designsprache (D3, #165). Kapselt, was
 * die bisher handgerollten Overlays durchweg vermissen ließen:
 *  - `role="dialog"` + `aria-modal` (+ `aria-labelledby`, wenn ein Titel gesetzt ist),
 *  - Escape schließt,
 *  - Fokus wandert beim Öffnen in den Dialog und kehrt beim Schließen an das zuvor
 *    fokussierte Element zurück,
 *  - Tab bleibt im Dialog gefangen (Focus-Trap),
 *  - Klick auf den abgedunkelten Hintergrund schließt (abschaltbar).
 *
 * Das sichtbare Verhalten (Backdrop-Close + ✕) bleibt wie bei den bisherigen
 * Modals → kein Bedienungsverlust bei der Adoption. Bewusst OHNE react-dom-Portal:
 * das Overlay deckt via `fixed inset-0` ohnehin den Viewport, und @jm/ui bleibt
 * react-only (nur `react` als Peer).
 */
export function Modal({
  onClose,
  title,
  className,
  closeOnBackdrop = true,
  overlayClassName,
  children,
}: Props): React.JSX.Element {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    // Fokus in den Dialog holen: erstes fokussierbares Element, sonst das Panel selbst.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      // Focus-Trap: Tab zykliert innerhalb der fokussierbaren Elemente des Dialogs.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    // Capture-Phase, damit der Dialog Escape vor App-globalen Handlern greift.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className={cn('fixed inset-0 grid place-items-center bg-black/50 p-4', overlayClassName ?? 'z-50')}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl outline-none',
          className,
        )}
      >
        {title ? (
          <div className="mb-2 flex items-center">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="ml-auto rounded px-2 text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
            >
              ✕
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
