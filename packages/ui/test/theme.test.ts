// Task 7 · Hell/Dunkel-Speicher (Spec 3.7, 8; E10): Dunkel ist Standard und Rückfall, Schlüssel jm-theme,
// jeder Zugriff in try/catch, auf <html> steht danach genau eine der Klassen dark/light.
import * as ui from '../src/index';
import {
  THEME_SCHLUESSEL,
  browserHtml,
  browserSpeicher,
  erzeugeThemeStore,
  leseTheme,
  schreibeTheme,
  themeStore,
  wendeThemeAn,
  type ThemeSpeicher,
} from '../src/lib/theme';
import { gleich, ok } from './harness';

function speicher(werte: Record<string, string>): ThemeSpeicher & { werte: Record<string, string> } {
  return {
    werte,
    getItem: (k) => werte[k] ?? null,
    setItem: (k, v) => {
      werte[k] = v;
    },
  };
}

const WIRFT: ThemeSpeicher = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

/** Ergebnis von f oder 'WURF', wenn f wirft (dann wird der Test rot statt abzubrechen). */
function ohneWurf<T>(f: () => T): T | 'WURF' {
  try {
    return f();
  } catch {
    return 'WURF';
  }
}

function ziel(start: string[]): { klassen: Set<string>; classList: { add(c: string): void; remove(c: string): void } } {
  const klassen = new Set(start);
  return {
    klassen,
    classList: {
      add: (c) => {
        klassen.add(c);
      },
      remove: (c) => {
        klassen.delete(c);
      },
    },
  };
}

gleich([leseTheme(null), leseTheme(undefined)], ['dark', 'dark'], 'Theme: kein Speicher → dark');
gleich(ohneWurf(() => leseTheme(WIRFT)), 'dark', 'Theme: getItem wirft → dark, kein Wurf');
gleich(leseTheme(speicher({})), 'dark', 'Theme: nichts gespeichert → dark');
gleich(
  ['light', 'dark', 'LIGHT', 'blau', ''].map((wert) => leseTheme(speicher({ 'jm-theme': wert }))),
  ['light', 'dark', 'dark', 'dark', 'dark'],
  "Theme: 'light' → light; 'dark' → dark; 'LIGHT', 'blau', '' → dark",
);
gleich(ohneWurf(() => schreibeTheme(WIRFT, 'light')), false, 'Theme: schreibeTheme – setItem wirft → false, kein Wurf');
gleich([schreibeTheme(null, 'light'), schreibeTheme(undefined, 'dark')], [false, false], 'Theme: schreibeTheme ohne Speicher → false');
{
  const s = speicher({});
  const ergebnis = schreibeTheme(s, 'light');
  gleich([ergebnis, s.werte, THEME_SCHLUESSEL], [true, { 'jm-theme': 'light' }, 'jm-theme'], 'Theme: schreibeTheme ok → true, Schlüssel jm-theme');
}
{
  const html = ziel(['dark', 'jm-andere']);
  wendeThemeAn(html, 'light');
  const nachHell = [...html.klassen].sort();
  wendeThemeAn(html, 'light');
  const nachZweitemHell = [...html.klassen].sort();
  wendeThemeAn(html, 'dark');
  gleich(
    [nachHell, nachZweitemHell, [...html.klassen].sort()],
    [['jm-andere', 'light'], ['jm-andere', 'light'], ['dark', 'jm-andere']],
    'Theme: wendeThemeAn – aus dark wird light, genau eine Klasse; doppelt angewandt gleich; andere Klassen bleiben',
  );
  const beide = ziel(['dark', 'light']);
  wendeThemeAn(beide, 'dark');
  gleich([...beide.klassen], ['dark'], 'Theme: wendeThemeAn – stehen beide Klassen, bleibt genau eine');
}
gleich(
  [ohneWurf(() => wendeThemeAn(null, 'light')), ohneWurf(() => wendeThemeAn(undefined, 'dark'))],
  [undefined, undefined],
  'Theme: wendeThemeAn(null) wirft nicht',
);
ok(browserSpeicher() === null, 'Theme: browserSpeicher unter Node (ohne window) → null');
{
  const s = speicher({});
  const html = ziel(['dark', 'jm-andere']);
  const store = erzeugeThemeStore({ speicher: () => s, html: () => html });
  const gemeldet = { a: 0, b: 0 };
  const abmelden = store.abonniere(() => {
    gemeldet.a++;
  });
  store.abonniere(() => {
    gemeldet.b++;
  });
  const start = store.lies();
  store.setze('light');
  const nachHell = [store.lies(), s.werte['jm-theme'], [...html.klassen].sort().join(' ')];
  abmelden();
  store.setze('dark');
  gleich(
    [start, ...nachHell, store.lies(), gemeldet.a, gemeldet.b],
    ['dark', 'light', 'light', 'jm-andere light', 'dark', 1, 2],
    'Theme-Store: ein Wert für alle Abonnenten (zwei Schalter zeigen nie Verschiedenes), gemerkt, auf <html>; Abgemeldete hören nichts mehr',
  );
}
{
  const store = erzeugeThemeStore({ speicher: () => WIRFT, html: () => null });
  const start = ohneWurf(() => store.lies());
  const nachWahl = ohneWurf(() => {
    store.setze('light');
    return store.lies();
  });
  gleich([start, nachWahl], ['dark', 'light'], 'Theme-Store: Speicher gesperrt → Start Dunkel, die Wahl gilt trotzdem für das Dokument');
}
gleich([themeStore.lies(), browserHtml()], ['dark', null], 'Theme-Store: der Store des Dokuments liest unter Node Dunkel, ohne <html>');
ok(ui.THEME_SCHLUESSEL === 'jm-theme', 'Theme: Export THEME_SCHLUESSEL aus src/index.ts');
