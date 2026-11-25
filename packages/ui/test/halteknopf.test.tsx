// UX Welle 2b, Task 2 · Halte-Knopf (Spec 4.1): Halten über Zeiger, Leertaste und Enter, Abbruchwege, Markup, Wächter.
// Geprüft wird das Prop-Objekt (halteKnopfProps) und die Verdrahtung im Quelltext; Effekte laufen nur im Browser.
import { HalteKnopf, halteKnopfProps, type HalteKnopfProps } from '../src/components/HalteKnopf';
import { haltenBeiAbbau, haltenBeiZustand, haltenFuerRender } from '../src/components/TallyButton';
import { beobachteFensterVerlust, type FensterZiel, type HaltenSteuerung } from '../src/lib/halten';
import { UI_TEXTE } from '../src/lib/texte';
import { gleich, leseText, ok, render } from './harness';
import { attr, hatKlassen, klassen, tags } from './lib/markup';

interface Aufbau {
  z: { press: number; release: number };
  halten: HaltenSteuerung;
  props: ReturnType<typeof halteKnopfProps>;
}
function aufbau(zusatz: Partial<HalteKnopfProps> = {}): Aufbau {
  const z = { press: 0, release: 0 };
  const p: HalteKnopfProps = {
    label: 'Sprechen',
    title: 'Zum Sprechen halten',
    aktiv: false,
    onPress: () => void z.press++,
    onRelease: () => void z.release++,
    ...zusatz,
  };
  const ref: { current: HaltenSteuerung | null } = { current: null };
  const halten = haltenFuerRender(ref, p);
  return { z, halten, props: halteKnopfProps(p, halten) };
}
const zeiger = (button = 0) => ({ button, pointerId: 1, currentTarget: { setPointerCapture: () => undefined } });
const taste = (key: string, repeat = false) => ({ key, repeat, preventDefault: () => undefined });

// ── Wege ──
{
  const a = aufbau();
  a.props.onPointerDown(zeiger());
  a.props.onPointerUp();
  gleich([a.z.press, a.z.release], [1, 1], 'X Halte-Knopf Wege: Zeiger – Druck → onPress einmal, Loslassen → onRelease einmal');
  const b = aufbau();
  b.props.onPointerDown(zeiger(2));
  gleich([b.z.press, b.z.release], [0, 0], 'X Halte-Knopf Wege: andere Maustaste startet nicht');
}
for (const k of [' ', 'Enter']) {
  const a = aufbau();
  a.props.onKeyDown(taste(k));
  a.props.onKeyDown(taste(k, true));
  a.props.onKeyUp(taste(k));
  gleich([a.z.press, a.z.release], [1, 1], `X Halte-Knopf Wege: ${k === ' ' ? 'Leertaste' : 'Enter'} – Druck → onPress einmal, Loslassen → onRelease einmal`);
}
{
  const a = aufbau();
  a.props.onKeyDown(taste('Enter', true));
  gleich([a.z.press, a.z.release], [0, 0], 'X Halte-Knopf Wege: Enter mit repeat startet nicht');
  a.props.onKeyDown(taste('a'));
  gleich(a.z.press, 0, 'X Halte-Knopf Wege: andere Taste startet nicht');
}
{
  const a = aufbau();
  a.props.onPointerDown(zeiger());
  a.props.onKeyUp(taste(' '));
  gleich(a.z.release, 0, 'X Halte-Knopf Wege: Loslassen nur über dieselbe Quelle (Taste beendet kein Zeiger-Halten)');
  a.props.onPointerUp();
  gleich(a.z.release, 1, 'X Halte-Knopf Wege: … der Zeiger beendet es');
}
function ziel(zusatz: Partial<FensterZiel>): FensterZiel & { hoerer: Array<() => void> } {
  const hoerer: Array<() => void> = [];
  return { hoerer, addEventListener: (_t, h) => void hoerer.push(h), removeEventListener: () => undefined, ...zusatz };
}
const ABBRUECHE: Array<[string, (a: Aufbau) => void]> = [
  ['pointercancel', (a) => a.props.onPointerCancel()],
  ['lostpointercapture', (a) => a.props.onLostPointerCapture()],
  ['blur', (a) => a.props.onBlur()],
  ['Sperre', (a) => haltenBeiZustand('gesperrt', a.halten)],
  ['Aushängen', (a) => haltenBeiAbbau(a.halten)],
  [
    'Fensterverlust (blur am Fenster)',
    (a) => {
      const fenster = ziel({});
      beobachteFensterVerlust(fenster, null, a.halten);
      fenster.hoerer.forEach((h) => h());
    },
  ],
  [
    'Fensterverlust (Dokument hidden)',
    (a) => {
      const dok = ziel({ visibilityState: 'hidden' });
      beobachteFensterVerlust(null, dok, a.halten);
      dok.hoerer.forEach((h) => h());
    },
  ],
];
for (const [name, abbruch] of ABBRUECHE) {
  for (const start of ['zeiger', 'Leertaste', 'Enter'] as const) {
    const a = aufbau();
    if (start === 'zeiger') a.props.onPointerDown(zeiger());
    else a.props.onKeyDown(taste(start === 'Enter' ? 'Enter' : ' '));
    abbruch(a);
    abbruch(a);
    a.props.onPointerUp();
    a.props.onKeyUp(taste(' '));
    a.props.onKeyUp(taste('Enter'));
    gleich([a.z.press, a.z.release], [1, 1], `X Halte-Knopf Wege: Abbruch ${name} beim Halten per ${start} → onRelease genau einmal`);
  }
}
{
  const a = aufbau({ gesperrt: 'Kein Kanal' });
  a.props.onPointerDown(zeiger());
  a.props.onKeyDown(taste(' '));
  a.props.onKeyDown(taste('Enter'));
  gleich([a.z.press, a.z.release, a.halten.gehalten], [0, 0, false], 'X Halte-Knopf Wege: gesperrt startet nichts');
}
ok(!('onClick' in aufbau().props), 'X Halte-Knopf Wege: click tut nichts (kein onClick am Knopf)');

// ── Markup ──
const keine = (): void => undefined;
{
  const html = render(<HalteKnopf label="Sprechen" title="Zum Sprechen halten" aktiv={false} onPress={keine} onRelease={keine} />);
  const [knopf] = tags(html, 'button');
  ok(
    attr(knopf, 'aria-pressed') === 'false' &&
      attr(knopf, 'title') === 'Zum Sprechen halten' &&
      attr(knopf, 'aria-label') === 'Zum Sprechen halten' &&
      attr(knopf, 'type') === 'button' &&
      attr(knopf, 'aria-disabled') === undefined,
    'X Halte-Knopf Markup: ruhig – aria-pressed=false, title und aria-label = title',
  );
  ok(
    hatKlassen(knopf, 'min-h-[var(--control-h)]') && !klassen(knopf).some((k) => /^h-/.test(k)),
    'X Halte-Knopf Markup: Mindesthöhe min-h-[var(--control-h)], keine feste Höhe',
  );
  ok(html.includes('>Sprechen<'), 'X Halte-Knopf Markup: Beschriftung sichtbar');
}
{
  const html = render(<HalteKnopf label="Sprechen" title="Zum Sprechen halten" aktiv onPress={keine} onRelease={keine} />);
  ok(attr(tags(html, 'button')[0], 'aria-pressed') === 'true', 'X Halte-Knopf Markup: aktiv – aria-pressed=true');
}
{
  const html = render(<HalteKnopf label="Sprechen" title="Zum Sprechen halten" aktiv={false} gesperrt="Kein Kanal" onPress={keine} onRelease={keine} />);
  const [knopf] = tags(html, 'button');
  ok(
    attr(knopf, 'title') === UI_TEXTE.gesperrt('Kein Kanal') &&
      attr(knopf, 'aria-label') === UI_TEXTE.gesperrt('Kein Kanal') &&
      attr(knopf, 'aria-disabled') === 'true' &&
      attr(knopf, 'disabled') === undefined,
    'X Halte-Knopf Markup: gesperrt – title und aria-label „Gesperrt: Kein Kanal“, aria-disabled (bleibt fokussierbar)',
  );
}
{
  const html = render(<HalteKnopf label="PTZ" title="t" aktiv={false} className="h-12 w-12" onPress={keine} onRelease={keine} />);
  ok(hatKlassen(tags(html, 'button')[0], 'h-12 w-12 min-h-[var(--control-h)]'), 'X Halte-Knopf Markup: className hängt an, die Mindesthöhe bleibt');
}
{
  const quelle = leseText('src/components/HalteKnopf.tsx');
  const roh = quelle.match(/(?:bg|text|border)-(?:red|green|blue|yellow|gray|slate|zinc|white|black|neutral)\b|#[0-9a-fA-F]{3,8}\b|oklch\(|rgb\(/g) ?? [];
  ok(roh.length === 0, 'X Halte-Knopf Markup: keine rohen Farben');
}

// ── Wächter ──
{
  const quelle = leseText('src/components/HalteKnopf.tsx');
  const code = quelle.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(
    /import\s*\{[^}]*\btallyHandler\b[^}]*\}\s*from '\.\/TallyButton'/.test(code) && !/\bon(?:Pointer|Key|Blur|LostPointer)\w*\s*[=(:]/.test(code),
    'X Halte-Knopf Wächter: importiert tallyHandler und definiert keine eigenen Zeiger-, Tasten- oder Blur-Handler',
  );
  const baustein = quelle.slice(quelle.indexOf('export function HalteKnopf('));
  const PFLICHT = [
    'const haltenRef = useRef<HaltenSteuerung | null>(null);',
    'const halten = haltenFuerRender(haltenRef, p);',
    "useEffect(() => haltenBeiZustand(p.gesperrt === undefined ? 'bereit' : 'gesperrt', halten, p.gesperrt), [p.gesperrt, halten]);",
    'useEffect(() => () => haltenBeiAbbau(halten), [halten]);',
    "useEffect(() => beobachteFensterVerlust(typeof window === 'undefined' ? null : window, typeof document === 'undefined' ? null : document, halten), [halten]);",
    '<button {...halteKnopfProps(p, halten)}>',
  ];
  const fehlt = PFLICHT.filter((zeile) => baustein.split(zeile).length !== 2);
  ok(fehlt.length === 0, 'X Halte-Knopf Wächter: Spread, Effekte für Sperre, Abbau und Fensterverlust, neueste Rückrufe – je genau einmal');
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
  ok(
    leseText('src/index.ts').includes("export { HalteKnopf, type HalteKnopfProps } from './components/HalteKnopf';"),
    'X Halte-Knopf Wächter: Export HalteKnopf und HalteKnopfProps aus index.ts',
  );
}
