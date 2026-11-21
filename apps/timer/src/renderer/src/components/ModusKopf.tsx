// Kopf einer Modus-Ansicht (Uhr, Countdown, Ablauf): Titel links, Zustandsanzeigen rechts. Ersetzt den lokalen SectionHeader.
import type { ReactNode } from 'react';

export function ModusKopf({ titel, children }: { titel: string; children?: ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 pb-6">
      <h2 className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
        <span className="mr-2 font-extrabold text-[var(--slash)]">/</span>
        {titel}
      </h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
