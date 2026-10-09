import type { CSSProperties } from 'react';
import { cn } from '../lib/cn';
import { UI_TEXTE } from '../lib/texte';
import type { Theme } from '../lib/theme';
import { noDragRegion } from '../lib/titlebar';
import { useTheme } from '../lib/useTheme';

export interface ThemeToggleProps {
  className?: string;
}

/** Alle Props des Schalters (E10). Nur aus dieser Datei exportiert. */
export interface ThemeKnopfProps {
  type: 'button';
  style: CSSProperties;
  onClick(): void;
  'data-theme': Theme;
  'aria-label': string;
  title: string;
  className: string;
}

/**
 * Props des Schalters als reine Funktion: Zustand in data-theme, aria-label und title „Darstellung: {Zustand}. Umschalten
 * auf {Ziel}“, Klick → toggle, noDragRegion (liegt in der Ziehfläche der Kopfzeile). Nur aus dieser Datei exportiert.
 */
export function themeKnopfProps(theme: Theme, toggle: () => void, className?: string): ThemeKnopfProps {
  const dunkel = theme === 'dark';
  const beschreibung = UI_TEXTE.themeUmschalten(dunkel ? UI_TEXTE.dunkel : UI_TEXTE.hell, dunkel ? UI_TEXTE.hell : UI_TEXTE.dunkel);
  return {
    type: 'button',
    style: noDragRegion,
    onClick: () => toggle(),
    'data-theme': theme,
    'aria-label': beschreibung,
    title: beschreibung,
    className: cn(
      'inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5',
      'text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
      'motion-safe:transition-colors motion-safe:duration-150',
      className,
    ),
  };
}

/**
 * Hell/Dunkel-Schalter für die Kopfzeile (Spec 3.7; E10). Zeigt den ZUSTAND („Dunkel“ ☾ / „Hell“ ☀), nicht das Ziel;
 * aria-label und title nennen beides.
 */
export function ThemeToggle({ className }: ThemeToggleProps): React.JSX.Element {
  const { theme, toggle } = useTheme();
  const dunkel = theme === 'dark';
  const jetzt = dunkel ? UI_TEXTE.dunkel : UI_TEXTE.hell;
  return (
    <button {...themeKnopfProps(theme, toggle, className)}>
      <span aria-hidden="true">{dunkel ? '☾' : '☀'}</span>
      <span>{jetzt}</span>
    </button>
  );
}
