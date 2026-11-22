import { useEffect, useState } from 'react';
import { useStore } from '@/store/timer';
import { cn } from '@jm/ui';
import { Button } from '@jm/ui';

/**
 * Persistent operator bar for live messages to the Speaker view.
 * Sits between Topbar and main content; visible in every mode.
 */
export function MessageBar() {
  const message = useStore((s) => s.message);
  const setMessage = useStore((s) => s.setMessage);
  const setMessageBlink = useStore((s) => s.setMessageBlink);
  const clearMessage = useStore((s) => s.clearMessage);

  const [draft, setDraft] = useState(message.text);

  // Adopt external changes (initial server state, other operator, etc.)
  useEffect(() => {
    setDraft(message.text);
  }, [message.text]);

  const dirty = draft !== message.text;
  const live = message.text.trim().length > 0;

  function commit() {
    if (!dirty) return;
    setMessage(draft);
  }

  function handleClear() {
    setDraft('');
    clearMessage();
  }

  return (
    <div
      data-timer="messagebar"
      className={cn(
        'relative border-b border-[var(--border)]/60',
        'bg-[var(--card)]/40 backdrop-blur-md',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px
                   bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"
      />
      <div className="max-w-[1400px] mx-auto px-7 py-3 flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-2 shrink-0',
            'text-[10px] uppercase tracking-[0.14em] font-extrabold',
            live
              ? message.blinking
                ? 'text-[var(--destructive)]'
                : 'text-[var(--primary)]'
              : 'text-[var(--muted-foreground)]',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              live && message.blinking && 'jm-blink',
            )}
            style={{
              background: live
                ? message.blinking
                  ? 'var(--destructive)'
                  : 'var(--primary)'
                : 'var(--muted-foreground)',
            }}
          />
          <span className="text-[var(--slash)]">/</span>
          Nachricht
        </span>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setDraft(message.text);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Live-Nachricht für Speaker — z. B. „2 Minuten links“ oder „Bitte zum Ende kommen“"
          className={cn(
            'flex-1 h-9 px-3 rounded-[var(--radius)] min-w-0',
            'bg-[var(--input)] text-[var(--foreground)]',
            'border border-[var(--border)]',
            'placeholder:text-[var(--muted-foreground)] text-sm',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
            dirty && 'border-[var(--primary)]/60',
          )}
        />

        {dirty && (
          <Button size="sm" onClick={commit}>
            Senden
          </Button>
        )}

        <button
          type="button"
          disabled={!live}
          onClick={() => setMessageBlink(!message.blinking)}
          className={cn(
            'h-9 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
            !live && 'opacity-40 cursor-not-allowed',
            message.blinking
              ? 'border-[var(--destructive)] text-[var(--destructive)] bg-[var(--destructive)]/10'
              : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
          )}
          title="Nachricht im Speaker-View blinken lassen"
        >
          {message.blinking ? 'Blink an' : 'Blink'}
        </button>

        <button
          type="button"
          disabled={!live && !dirty}
          onClick={handleClear}
          className={cn(
            'h-9 px-3 rounded-[var(--radius)] text-xs uppercase tracking-wide font-extrabold',
            'border border-transparent text-[var(--muted-foreground)]',
            'hover:bg-[var(--highlight)] hover:text-[var(--foreground)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
            !live && !dirty && 'opacity-40 cursor-not-allowed',
          )}
        >
          Leeren
        </button>
      </div>
    </div>
  );
}
