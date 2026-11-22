// UX Welle 2a, Stage-Display b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/stage-display (npm run selftest -w @jm/stage-display); leseText liest relativ dazu.
import { ScreenOutputSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'SD Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<ScreenOutputSection id="ausgabe" enabled={false} selectedId={null} capabilities={{ toggle: true }} />);
  enthaelt(html, 'einstellung-ausgabe', 'SD Werkzeug rendert: ScreenOutputSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'SD Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof MASTER_LINK_QUELLE.abfrage === 'function', 'SD Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  const typen = leseText('src/shared/types.ts');
  ok(typen.includes('export interface JmstageApi'), 'SD Werkzeug rendert: Alias @shared/ zeigt auf src/shared (types.ts liegt dort)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'SD Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'SD Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('SD Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'tsx --tsconfig tsconfig.test.json test/nachricht.test.tsx && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts',
    'SD Werkzeug rendert: selftest führt den älteren Lauf und danach die Oberflächentests aus',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'SD Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'SD Werkzeug rendert: @jm/settings ist Abhängigkeit des Stage-Displays');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'SD Werkzeug rendert: tsx ist devDependency des Stage-Displays (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/stage-display'].dependencies), sortiert(paket.dependencies), 'SD Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/stage-display gleich');
  gleich(sortiert(lock.packages['apps/stage-display'].devDependencies), sortiert(paket.devDependencies), 'SD Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/stage-display gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'SD Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
{
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  ok(ci.includes('run: npm run selftest -w @jm/stage-display'), 'SD Werkzeug rendert: die CI führt den Selbsttest des Stage-Displays im Job Selbsttests aus');
}
