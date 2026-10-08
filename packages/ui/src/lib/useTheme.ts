import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { browserHtml, themeStore, wendeThemeAn, type Theme } from './theme';

/**
 * Hell/Dunkel je Tool (Spec 3.7, 8; E10). Alle Aufrufe teilen einen Zustand (themeStore aus lib/theme.ts): Zwei Schalter
 * im selben Dokument zeigen nie Verschiedenes. Der Store liest beim ersten Zugriff den gemerkten Wert (jeder Fehler →
 * Dunkel), merkt jede Wahl und setzt sie auf <html>; der Effekt setzt den Startwert auf <html> (Klassenvertrag der
 * index.html). Ohne Browser (Tests, Server-Rendering) bleibt es bei Dunkel und fasst nichts an.
 */
export function useTheme(): { theme: Theme; setTheme(t: Theme): void; toggle(): void } {
  const theme = useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies);
  useEffect(() => wendeThemeAn(browserHtml(), theme), [theme]);
  const setTheme = useCallback((t: Theme) => themeStore.setze(t), []);
  const toggle = useCallback(() => themeStore.setze(themeStore.lies() === 'dark' ? 'light' : 'dark'), []);
  return { theme, setTheme, toggle };
}
