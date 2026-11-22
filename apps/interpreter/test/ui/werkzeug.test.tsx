// UX Welle 2a, Interpreter b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeiten samt Lock-Zeilen, @source für @jm/settings, CI-Schritt.
// Arbeitsverzeichnis ist apps/interpreter (npm run selftest -w @jm/interpreter); leseText liest relativ dazu.
import { ScreenOutputSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'IN Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<ScreenOutputSection id="ausgabe" enabled={false} selectedId={null} capabilities={{ toggle: true }} />);
  enthaelt(html, 'einstellung-ausgabe', 'IN Werkzeug rendert: ScreenOutputSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'IN Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof MASTER_LINK_QUELLE.abfrage === 'function', 'IN Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  const api = leseText('src/shared/api.ts');
  ok(api.includes('export interface JmInterpreterApi'), 'IN Werkzeug rendert: Alias @shared/ zeigt auf src/shared (api.ts liegt dort)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'IN Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'IN Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('IN Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'node --experimental-strip-types test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts',
    'IN Werkzeug rendert: selftest führt den bisherigen Lauf und danach die Oberflächentests aus',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'IN Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'IN Werkzeug rendert: @jm/settings ist Abhängigkeit des Interpreters');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'IN Werkzeug rendert: tsx ist devDependency des Interpreters (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/interpreter'].dependencies), sortiert(paket.dependencies), 'IN Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/interpreter gleich');
  gleich(sortiert(lock.packages['apps/interpreter'].devDependencies), sortiert(paket.devDependencies), 'IN Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/interpreter gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'IN Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
{
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  ok(ci.includes('run: npm run selftest -w @jm/interpreter'), 'IN Werkzeug rendert: die CI führt den Selbsttest des Interpreters im Job Selbsttests aus');
}
