// Task 3 · Neue Tokens (Spec 4.2, 4.3, 3.8; E4, E5, E6): Werte wörtlich, nur neue Namen, nur Custom Properties,
// über base.css in jede App eingebunden und als Paket-Export erreichbar.
import { leseCustomProperties, tokenTabelle } from './lib/css';
import { NEUE_BASE_IMPORTE } from './lib/quellen';
import { gleich, leseText, ok } from './harness';

const signal = leseText('src/tokens/signal-colors.css');
const groessen = leseText('src/tokens/sizes.css');

// Spec 4.2 (Farben) und E4 (--surface-raised), wörtlich
const SOLL_DUNKEL: Record<string, string> = {
  '--tally-live': 'oklch(0.62 0.23 27)',
  '--tally-ready': 'oklch(0.72 0.17 145)',
  '--tally-selected': 'var(--brand-yellow)',
  '--status-warn': 'oklch(0.76 0.16 60)',
  '--status-error': 'var(--destructive)',
  '--status-off': 'var(--muted-foreground)',
  '--surface-raised': 'oklch(0.25 0 0)',
  '--field-border': 'oklch(0.58 0 0)',
};
const SOLL_HELL: Record<string, string> = {
  '--tally-live': 'oklch(0.55 0.22 27)',
  '--tally-ready': 'oklch(0.60 0.17 145)',
  '--tally-selected': 'var(--brand-dark)',
  '--status-warn': 'oklch(0.66 0.16 55)',
  '--status-error': 'var(--destructive)',
  '--status-off': 'var(--muted-foreground)',
  '--surface-raised': 'oklch(1 0 0)',
  '--field-border': 'oklch(0.6 0 0)',
};

const dunkel = tokenTabelle(signal, ':root, .dark');
const hell = tokenTabelle(signal, '.light');
for (const [name, wert] of Object.entries(SOLL_DUNKEL)) ok(dunkel[name] === wert, `Tokens dunkel: ${name} = ${wert}`);
for (const [name, wert] of Object.entries(SOLL_HELL)) ok(hell[name] === wert, `Tokens hell: ${name} = ${wert}`);
gleich(Object.keys(dunkel), Object.keys(SOLL_DUNKEL), 'Tokens dunkel: genau die 8 neuen Namen');
gleich(Object.keys(hell), Object.keys(SOLL_HELL), 'Tokens hell: genau die 8 neuen Namen');

// Spec 4.3 (Größen) und E6 (Dichte), wörtlich
gleich(
  tokenTabelle(groessen, ':root'),
  { '--header-h': '44px', '--statusbar-h': '28px', '--control-h': '32px', '--control-h-lg': '48px', '--panel-w': '360px' },
  'Tokens: Größen 44/28/32/48/360 px',
);
gleich(
  tokenTabelle(groessen, '[data-dichte="kompakt"]'),
  { '--header-h': '36px', '--statusbar-h': '24px' },
  'Tokens: kompakt setzt nur header-h 36 px und statusbar-h 24 px',
);

{
  const bestand = [leseText('src/tokens/colors.css'), leseText('src/tokens/typography.css')]
    .flatMap((css) => leseCustomProperties(css))
    .flatMap((block) => Object.keys(block.werte));
  const neu = [signal, groessen].flatMap((css) => leseCustomProperties(css)).flatMap((block) => Object.keys(block.werte));
  const doppelt = neu.filter((name) => bestand.includes(name));
  ok(doppelt.length === 0, 'Tokens: keine neue Datei definiert einen Bestandsnamen');
  if (doppelt.length > 0) console.log(`     ${doppelt.join(', ')}`);
}

{
  // G2: neue CSS definiert nur Custom Properties, keine Regeln, die bestehendes Markup umfärben oder umbauen.
  const fremd: string[] = [];
  for (const [datei, css] of [['signal-colors.css', signal], ['sizes.css', groessen]] as const) {
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const block of ohneKommentare.matchAll(/\{([^{}]*)\}/g)) {
      for (const deklaration of block[1].split(';')) {
        const name = deklaration.split(':')[0].trim();
        if (name !== '' && !name.startsWith('--')) fremd.push(`${datei}: ${name}`);
      }
    }
  }
  ok(fremd.length === 0, 'Tokens: neue CSS-Dateien deklarieren nur Custom Properties');
  for (const zeile of fremd) console.log(`     ${zeile}`);
}

{
  // G2: genau diese Blöcke und keine At-Regel außer @layer. Eine weitere Regel (z. B. `body { --spacing: … }` oder
  // `.rounded-md { --tw-ring-color: … }`) träfe bestehendes Markup in jeder App, obwohl sie nur Custom Properties setzt.
  const selektoren = (css: string): string[] => leseCustomProperties(css).map((block) => block.selektor);
  gleich(selektoren(signal), [':root, .dark', '.light'], 'Tokens: signal-colors.css hat genau die Blöcke „:root, .dark“ und „.light“');
  gleich(selektoren(groessen), [':root', '[data-dichte="kompakt"]'], 'Tokens: sizes.css hat genau die Blöcke „:root“ und „[data-dichte="kompakt"]“');
  const atRegeln = [signal, groessen].flatMap((css) => css.replace(/\/\*[\s\S]*?\*\//g, '').match(/@[\w-]+/g) ?? []);
  gleich(atRegeln, ['@layer', '@layer'], 'Tokens: einzige At-Regel ist @layer (kein @theme, @utility, @custom-variant, @import)');
}

{
  const zeilen = leseText('src/base.css').split('\n');
  const typo = zeilen.indexOf('@import "./tokens/typography.css";');
  const theme = zeilen.findIndex((zeile) => zeile.startsWith('@theme'));
  ok(
    typo >= 0 &&
      JSON.stringify(zeilen.slice(typo + 1, typo + 3)) === JSON.stringify(NEUE_BASE_IMPORTE) &&
      theme > typo + 2,
    'Tokens: base.css importiert signal-colors.css und sizes.css direkt nach typography.css, vor @theme',
  );
}

{
  const exporte = (JSON.parse(leseText('package.json')) as { exports: Record<string, string> }).exports;
  ok(
    exporte['./tokens/signal-colors.css'] === './src/tokens/signal-colors.css' &&
      exporte['./tokens/sizes.css'] === './src/tokens/sizes.css',
    'Tokens: package.json exportiert ./tokens/signal-colors.css und ./tokens/sizes.css',
  );
}
