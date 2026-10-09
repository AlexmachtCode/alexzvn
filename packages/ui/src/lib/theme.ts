// Hell/Dunkel (Spec 3.7, 8; E10): gemerkt je Tool unter dem Schlüssel jm-theme. Dunkel ist Standard und der Rückfall
// bei jedem Fehler. Auf <html> steht danach genau eine der Klassen dark/light (Klassenvertrag der index.html aller Apps).
// Einzige Datei in @jm/ui mit localStorage (Quellregel in Task 3); jeder Zugriff in try/catch, ohne window kein Speicher.

export type Theme = 'dark' | 'light';

export const THEME_SCHLUESSEL = 'jm-theme';

export interface ThemeSpeicher {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** Gespeichertes Theme; fehlender Speicher, Fehler oder ein fremder Wert → 'dark'. */
export function leseTheme(speicher: ThemeSpeicher | null | undefined): Theme {
  if (!speicher) return 'dark';
  try {
    return speicher.getItem(THEME_SCHLUESSEL) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Merkt das Theme. false, wenn es nicht gespeichert werden konnte; wirft nie. */
export function schreibeTheme(speicher: ThemeSpeicher | null | undefined, t: Theme): boolean {
  if (!speicher) return false;
  try {
    speicher.setItem(THEME_SCHLUESSEL, t);
    return true;
  } catch {
    return false;
  }
}

/** Setzt genau eine der Klassen dark/light; andere Klassen bleiben. Ohne Ziel passiert nichts. */
export function wendeThemeAn(
  ziel: { classList: { add(c: string): void; remove(c: string): void } } | null | undefined,
  t: Theme,
): void {
  if (!ziel) return;
  ziel.classList.remove(t === 'dark' ? 'light' : 'dark');
  ziel.classList.add(t);
}

/** window.localStorage, wenn erreichbar; ohne window (Node, Tests) oder bei gesperrtem Speicher → null. */
export function browserSpeicher(): ThemeSpeicher | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Ein Hell/Dunkel-Zustand für das ganze Dokument (E10): jeder useTheme-Aufruf liest und setzt denselben Wert. */
export interface ThemeStore {
  lies(): Theme;
  setze(t: Theme): void;
  abonniere(hoerer: () => void): () => void;
}

/** Woher der Store Speicher und <html> nimmt (im Test nachgestellt). */
export interface ThemeUmgebung {
  speicher(): ThemeSpeicher | null | undefined;
  html(): { classList: { add(c: string): void; remove(c: string): void } } | null | undefined;
}

/**
 * Store für Hell/Dunkel: Bis zur ersten Wahl liest er den Speicher (jeder Fehler → Dunkel). Eine Wahl gilt sofort für
 * alle Abonnenten, auch wenn der Speicher sie nicht aufnimmt; sie wird gemerkt und auf <html> gesetzt.
 */
export function erzeugeThemeStore(u: ThemeUmgebung): ThemeStore {
  let gewaehlt: Theme | undefined;
  const hoerer = new Set<() => void>();
  return {
    lies: () => gewaehlt ?? leseTheme(u.speicher()),
    setze(t) {
      gewaehlt = t;
      schreibeTheme(u.speicher(), t);
      wendeThemeAn(u.html(), t);
      for (const h of [...hoerer]) h();
    },
    abonniere(h) {
      hoerer.add(h);
      return () => {
        hoerer.delete(h);
      };
    },
  };
}

/** <html> im Browser; ohne document (Node, Tests) null. */
export function browserHtml(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

/** Der Store des Dokuments; useTheme (Task 12) liest ihn über useSyncExternalStore. */
export const themeStore: ThemeStore = erzeugeThemeStore({ speicher: browserSpeicher, html: browserHtml });
