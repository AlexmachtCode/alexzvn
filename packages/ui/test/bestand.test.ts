// Task 2 · Bestandsschutz (Spec 4.1, Risiko „Token-Wert ändert sich“): Alte Tokens, die neun alten Komponenten,
// cn/titlebar, base.css (außer den zwei neuen Import-Zeilen), index.ts Zeilen 1–11 und die alten Einträge in
// package.json bleiben, wie sie am Spec-Stand 5a14352934 sind. Jede Änderung macht den Selbsttest rot.
import { tokenTabelle } from './lib/css';
import { BESTAND_DATEIEN, NEUE_BASE_IMPORTE, quellHash } from './lib/quellen';
import { gleich, leseText, ok } from './harness';

/** Vergleicht Token für Token; bei FAIL steht jeder abweichende Token mit Ist- und Soll-Wert darunter. */
function pruefeTabelle(ist: Record<string, string>, soll: Record<string, string>, msg: string): void {
  const abweichungen: string[] = [];
  for (const [name, wert] of Object.entries(soll)) {
    if (ist[name] !== wert) abweichungen.push(`${name}: ist ${ist[name] ?? '(fehlt)'} · soll ${wert}`);
  }
  for (const name of Object.keys(ist)) {
    if (!(name in soll)) abweichungen.push(`${name}: neu im Bestandsblock (neue Tokens gehören in eine neue Datei)`);
  }
  ok(abweichungen.length === 0, msg);
  for (const zeile of abweichungen) console.log(`     ${zeile}`);
}

const colors = leseText('src/tokens/colors.css');
const typography = leseText('src/tokens/typography.css');

// colors.css Zeilen 2–8 (Marke), wörtlich
const MARKE: Record<string, string> = {
  '--brand-yellow': 'oklch(0.922 0.187 99.5)',
  '--brand-yellow-soft': 'oklch(0.922 0.187 99.5 / 0.5)',
  '--brand-yellow-dim': 'oklch(0.922 0.187 99.5 / 0.12)',
  '--brand-dark': 'oklch(0.178 0 0)',
  '--brand-fg-on-dark': 'oklch(0.985 0 0)',
};

// colors.css Zeilen 10–37 (`:root, .dark`, Dunkel ist Standard), wörtlich
const DUNKEL: Record<string, string> = {
  '--background': 'oklch(0.178 0 0)',
  '--foreground': 'oklch(0.985 0 0)',
  '--card': 'oklch(0.215 0 0)',
  '--card-foreground': 'oklch(0.985 0 0)',
  '--popover': 'oklch(0.215 0 0)',
  '--popover-foreground': 'oklch(0.985 0 0)',
  '--primary': 'var(--brand-yellow)',
  '--primary-foreground': 'var(--brand-dark)',
  '--secondary': 'oklch(0.27 0 0)',
  '--secondary-foreground': 'oklch(0.985 0 0)',
  '--muted': 'oklch(0.27 0 0)',
  '--muted-foreground': 'oklch(0.65 0 0)',
  '--accent': 'var(--brand-yellow-soft)',
  '--accent-foreground': 'oklch(0.985 0 0)',
  '--highlight': 'var(--brand-yellow-dim)',
  '--destructive': 'oklch(0.65 0.2 27)',
  '--destructive-foreground': 'oklch(0.985 0 0)',
  '--border': 'oklch(0.30 0 0)',
  '--input': 'oklch(0.27 0 0)',
  '--ring': 'var(--brand-yellow)',
  '--slash': 'var(--brand-yellow)',
  '--sidebar': 'oklch(0.10 0 0)',
  '--success': 'oklch(0.72 0.17 145)',
  '--warning': 'var(--brand-yellow)',
};

// colors.css Zeilen 39–65 (`.light`), wörtlich
const HELL: Record<string, string> = {
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.178 0 0)',
  '--card': 'oklch(0.985 0 0)',
  '--card-foreground': 'oklch(0.178 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.178 0 0)',
  '--primary': 'var(--brand-dark)',
  '--primary-foreground': 'var(--brand-fg-on-dark)',
  '--secondary': 'oklch(0.96 0 0)',
  '--secondary-foreground': 'oklch(0.178 0 0)',
  '--muted': 'oklch(0.96 0 0)',
  '--muted-foreground': 'oklch(0.45 0 0)',
  '--accent': 'var(--brand-yellow)',
  '--accent-foreground': 'var(--brand-dark)',
  '--highlight': 'var(--brand-yellow-dim)',
  '--destructive': 'oklch(0.55 0.22 27)',
  '--destructive-foreground': 'oklch(0.985 0 0)',
  '--border': 'oklch(0.90 0 0)',
  '--input': 'oklch(0.92 0 0)',
  '--ring': 'var(--brand-dark)',
  '--slash': 'var(--brand-dark)',
  '--sidebar': 'oklch(0.96 0 0)',
  '--success': 'oklch(0.62 0.17 145)',
  '--warning': 'oklch(0.72 0.15 75)',
};

// typography.css Zeilen 3–29, wörtlich
const TYPOGRAFIE: Record<string, string> = {
  '--text-xs': '12px',
  '--text-sm': '13px',
  '--text-base': '15px',
  '--text-lg': '17px',
  '--text-xl': '20px',
  '--text-2xl': '24px',
  '--text-3xl': '30px',
  '--text-4xl': '40px',
  '--text-5xl': '56px',
  '--tracking-tight': '-0.01em',
  '--tracking-normal': '0',
  '--tracking-wide': '0.06em',
  '--tracking-wider': '0.12em',
  '--tracking-widest': '0.14em',
  '--leading-display': '1.05',
  '--leading-tight': '1.15',
  '--leading-snug': '1.35',
  '--leading-normal': '1.55',
  '--leading-relaxed': '1.7',
  '--radius-sm': '2px',
  '--radius': '4px',
  '--radius-md': '6px',
  '--radius-lg': '8px',
  '--radius-xl': '12px',
  '--radius-full': '9999px',
};

pruefeTabelle(tokenTabelle(colors, ':root'), MARKE, 'Bestand: colors.css :root (Marke) – 5 Werte unverändert');
pruefeTabelle(tokenTabelle(colors, ':root, .dark'), DUNKEL, 'Bestand: colors.css :root, .dark – 24 Werte unverändert');
pruefeTabelle(tokenTabelle(colors, '.light'), HELL, 'Bestand: colors.css .light – 24 Werte unverändert');
pruefeTabelle(tokenTabelle(typography, ':root'), TYPOGRAFIE, 'Bestand: typography.css – 25 Werte unverändert');

// SHA-256 über den LF-normalisierten Text, gemessen am Spec-Stand 5a14352934 (08.10.2026).
const HASHES: Record<string, string> = {
  'src/components/Badge.tsx': '20df0b4c3653242a9af5e72b30efc7b2ab11ab1d2c928d92c206f39f36fcb308',
  'src/components/Button.tsx': 'b0f800ccc306da8cc441ca891869624dbcac08abfa94bc559bdef0d419d2120d',
  'src/components/Card.tsx': 'e3423bb22ac0126a5ba347d14fa7f07670e6989742eed8db23a856b8757127fa',
  'src/components/Collapsible.tsx': 'eb38ea288fa50ebeb2ffe0362b7bf62246288ae4840c6558b57ecf9882e357f9',
  'src/components/Logo.tsx': '74a0bbd7dd77f62e0eeea273cf672d032cc2c8571e45324521563fd7c34225ca',
  'src/components/Modal.tsx': '8d0e0f2bf32e473d45bc71a513f6bb9ed25ee2f1f925f55e3b27d412df28322b',
  'src/components/SettingsSection.tsx': 'b19bc60491399993ed22a7dcd734660bb2d58096d6398af9bf099e5365b254d1',
  'src/components/Splitter.tsx': '854b7a4ddff41593b047568033ae253851be3f7965b8675861426a99606020e0',
  'src/components/Tabs.tsx': 'a07fd0ec082a678876084c5504e3de3c8028ff1bcb5f21e6eb7e7dc74ba36982',
  'src/lib/cn.ts': '3320a516fb4c3a5eca6468a22c1383d866d7ddf4414fb9942d7120afdbc89ed3',
  'src/lib/titlebar.ts': '01566bc4fb19d66a3850cac14a305f315c8d3946de014fa2f8fee19b9bd43637',
  'src/tokens/colors.css': 'dcceb8d5ed1ddf02e11a41e57720b109f42bf2c4cc85f70e891c4623dfab886c',
  'src/tokens/typography.css': '2771a2ee8e8ab2a8b5a8580973ea8a4a86d6ae04d5cf89dd592187cc42f0cd41',
};

gleich(Object.keys(HASHES), [...BESTAND_DATEIEN], 'Bestand: Hash-Liste deckt genau BESTAND_DATEIEN (13 Dateien)');
for (const datei of BESTAND_DATEIEN) {
  const ist = quellHash(leseText(datei));
  ok(ist === HASHES[datei], `Bestand: Quelltext unverändert · ${datei}`);
  if (ist !== HASHES[datei]) console.log(`     Hash ist ${ist}`);
}

{
  const ohneNeue = leseText('src/base.css')
    .split('\n')
    .filter((zeile) => !NEUE_BASE_IMPORTE.includes(zeile))
    .join('\n');
  ok(
    quellHash(ohneNeue) === '1a96bddf767f5e45ce5969be6a163e5a184ef361d9446807137e6fcbcc5c72a0',
    'Bestand: base.css ohne die neuen Import-Zeilen unverändert',
  );
}

gleich(
  leseText('src/index.ts').split('\n').slice(0, 11),
  [
    "export { cn } from './lib/cn';",
    "export { dragRegion, noDragRegion, isElectronMac } from './lib/titlebar';",
    "export { Button } from './components/Button';",
    "export { Card } from './components/Card';",
    "export { Badge } from './components/Badge';",
    "export { Logo } from './components/Logo';",
    "export { Splitter } from './components/Splitter';",
    "export { Collapsible } from './components/Collapsible';",
    "export { Modal } from './components/Modal';",
    "export { SettingsSection } from './components/SettingsSection';",
    "export { Tabs, type TabItem } from './components/Tabs';",
  ],
  'Bestand: index.ts Zeilen 1–11 unverändert',
);

{
  const paket = JSON.parse(leseText('package.json')) as Record<string, unknown>;
  const exporte = paket.exports as Record<string, string>;
  gleich(
    {
      name: paket.name,
      private: paket.private,
      type: paket.type,
      exporte: [exporte['.'], exporte['./base.css'], exporte['./tokens/colors.css'], exporte['./tokens/typography.css']],
      dependencies: paket.dependencies,
      peerDependencies: paket.peerDependencies,
    },
    {
      name: '@jm/ui',
      private: true,
      type: 'module',
      exporte: ['./src/index.ts', './src/base.css', './src/tokens/colors.css', './src/tokens/typography.css'],
      dependencies: { '@fontsource-variable/manrope': '^5.1.1' },
      peerDependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    },
    'Bestand: package.json – alte Einträge unverändert (Name, Exporte, Abhängigkeiten)',
  );
}
