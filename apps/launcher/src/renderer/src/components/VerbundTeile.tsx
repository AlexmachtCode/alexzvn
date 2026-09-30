import { useEffect, useState, type ReactNode } from 'react';
import { Button, cn } from '@jm/ui';
import type { Farbe } from '@/lib/kopfanzeige';
import type { Ton } from '@/lib/verbund-texte';

export const FARBE_KLASSE: Record<Farbe, string> = {
  gedaempft: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
  neutral: 'border-[var(--primary)]/40 bg-[var(--highlight)] text-[var(--foreground)]',
  gruen: 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/50 bg-[var(--warning)]/15 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]',
};

export const TON_KLASSE: Record<Ton, string> = {
  gruen: 'text-[var(--success)]',
  gelb: 'text-[var(--warning)]',
  rot: 'text-[var(--destructive)]',
  gedaempft: 'text-[var(--muted-foreground)]',
};

export const eingabeKlasse = cn(
  'h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--foreground)]',
  'placeholder:text-[var(--muted-foreground)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

export const beschriftung = 'text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]';

export function Pille({ farbe, children }: { farbe: Farbe; children: ReactNode }) {
  return (
    <span className={cn('inline-flex max-w-full shrink-0 items-center truncate rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[11px] font-bold', FARBE_KLASSE[farbe])}>
      {children}
    </span>
  );
}

export function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
      <p className={beschriftung}>{titel}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Eingabe, die erst beim Verlassen oder mit Enter speichert. */
export function TextFeld({ label, wert, platzhalter, onSpeichern }: {
  label: string;
  wert: string;
  platzhalter?: string;
  onSpeichern: (v: string) => void;
}) {
  const [text, setText] = useState(wert);
  useEffect(() => setText(wert), [wert]);
  const speichern = (): void => {
    if (text.trim() !== wert) onSpeichern(text.trim());
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className={beschriftung}>{label}</span>
      <input
        className={eingabeKlasse}
        value={text}
        placeholder={platzhalter}
        maxLength={60}
        onChange={(e) => setText(e.target.value)}
        onBlur={speichern}
        onKeyDown={(e) => e.key === 'Enter' && speichern()}
      />
    </label>
  );
}

/** Bestätigung direkt an der Aktion (kein confirm()-Dialog). */
export function Bestaetigung({ frage, jaText, onJa, onNein }: {
  frage: string;
  jaText: string;
  onJa: () => void;
  onNein: () => void;
}) {
  return (
    <div role="alertdialog" className="mt-3 rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3">
      <p className="text-xs">{frage}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="destructive" uppercase={false} onClick={onJa}>{jaText}</Button>
        <Button size="sm" variant="ghost" uppercase={false} onClick={onNein}>Abbrechen</Button>
      </div>
    </div>
  );
}
