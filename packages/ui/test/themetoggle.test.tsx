// Task 12 · useTheme und ThemeToggle (Spec 3.7, 8, 3.8; E10): Der Knopf zeigt den ZUSTAND („Dunkel“/„Hell“), das
// aria-label nennt Zustand und Ziel. Ohne Browser bleibt es bei Dunkel; ein gemerktes „light“ wird gelesen.
import { ThemeToggle, themeKnopfProps } from '../src/components/ThemeToggle';
import { THEME_SCHLUESSEL } from '../src/lib/theme';
import { useTheme } from '../src/lib/useTheme';
import { leseText, ok, render } from './harness';
import { attr, hatKlassen, ohneVersteckt, tags, text } from './lib/markup';

{
  const html = render(<ThemeToggle />);
  const [k] = tags(html, 'button');
  ok(
    text(ohneVersteckt(html)) === 'Dunkel' &&
      attr(k, 'aria-label') === 'Darstellung: Dunkel. Umschalten auf Hell' &&
      attr(k, 'title') === 'Darstellung: Dunkel. Umschalten auf Hell' &&
      attr(k, 'data-theme') === 'dark',
    'ThemeToggle unter Node: „Dunkel“, aria-label „Darstellung: Dunkel. Umschalten auf Hell“',
  );
  ok(
    attr(k, 'type') === 'button' && (attr(k, 'style') ?? '').includes('-webkit-app-region:no-drag'),
    'ThemeToggle: type=button, -webkit-app-region:no-drag im style',
  );
  ok(hatKlassen(k, 'h-[var(--control-h)] rounded-[var(--radius-md)]'), 'ThemeToggle: h-[var(--control-h)], rounded-[var(--radius-md)]');
}
{
  function Probe(): React.JSX.Element {
    const t = useTheme();
    return (
      <span data-theme={t.theme}>
        {typeof t.setTheme}/{typeof t.toggle}
      </span>
    );
  }
  let html = '';
  let fehler = '';
  try {
    html = render(<Probe />);
  } catch (e) {
    fehler = String(e);
  }
  ok(fehler === '' && html === '<span data-theme="dark">function/function</span>', 'useTheme ohne window wirft nicht, Vorgabe dark');
}
{
  // Browser-Speicher nachgestellt (nur für diesen Block): gemerktes „light“ → Zustand „Hell“, Ziel „Dunkel“.
  const g = globalThis as unknown as { window?: unknown };
  const speicher = new Map<string, string>([[THEME_SCHLUESSEL, 'light']]);
  g.window = {
    localStorage: {
      getItem: (k: string) => speicher.get(k) ?? null,
      setItem: (k: string, v: string) => void speicher.set(k, v),
    },
  };
  try {
    const html = render(<ThemeToggle />);
    ok(
      text(ohneVersteckt(html)) === 'Hell' && attr(tags(html, 'button')[0], 'aria-label') === 'Darstellung: Hell. Umschalten auf Dunkel',
      'ThemeToggle mit gemerktem „light“: zeigt den Zustand „Hell“, Ziel „Dunkel“',
    );
  } finally {
    delete g.window;
  }
  g.window = {
    get localStorage(): never {
      throw new Error('Speicher gesperrt');
    },
  };
  try {
    ok(text(ohneVersteckt(render(<ThemeToggle />))) === 'Dunkel', 'ThemeToggle: Speicher wirft → Dunkel');
  } finally {
    delete g.window;
  }
}
{
  let umgeschaltet = 0;
  const props = themeKnopfProps('light', () => {
    umgeschaltet++;
  });
  props.onClick();
  ok(
    umgeschaltet === 1 &&
      props.type === 'button' &&
      props['data-theme'] === 'light' &&
      props['aria-label'] === 'Darstellung: Hell. Umschalten auf Dunkel' &&
      props.title === props['aria-label'],
    'ThemeToggle Knopf-Props: Klick schaltet um, Zustand und Ziel im aria-label',
  );
}
{
  const hook = leseText('src/lib/useTheme.ts');
  const knopf = leseText('src/components/ThemeToggle.tsx');
  const fehlt = [
    [hook, 'useSyncExternalStore(themeStore.abonniere, themeStore.lies, themeStore.lies)'],
    [hook, 'useEffect(() => wendeThemeAn(browserHtml(), theme), [theme]);'],
    [knopf, '<button {...themeKnopfProps(theme, toggle, className)}>'],
  ]
    .filter(([quelle, zeile]) => quelle.split(zeile).length !== 2)
    .map(([, zeile]) => zeile);
  ok(
    fehlt.length === 0 && !/\son[A-Z]\w*=\{/.test(knopf),
    'useTheme Verdrahtung: ein Store für alle Aufrufe, <html> im Effekt, Knopf-Props per Spread',
  );
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
}
