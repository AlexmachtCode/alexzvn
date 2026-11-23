// UX Welle 2a, Prompter b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/prompter (npm run selftest -w @jm/prompter); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE } from '@/lib/bruecken';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'PR Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8727} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'PR Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'PR Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof FERNSTEUERUNG_QUELLE.abfrage === 'function', 'PR Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  gleich(STEUER_PORT, 8727, 'PR Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/fernsteuerung)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'PR Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'PR Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('PR Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(paket.scripts.selftest, 'tsx --tsconfig tsconfig.test.json test/ui/selftest.ts', 'PR Werkzeug rendert: selftest ist der tsx-Lauf der Oberflächentests (kein älterer Lauf)');
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'PR Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'PR Werkzeug rendert: @jm/settings ist Abhängigkeit des Prompters');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'PR Werkzeug rendert: tsx ist devDependency des Prompters (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/prompter'].dependencies), sortiert(paket.dependencies), 'PR Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/prompter gleich');
  gleich(sortiert(lock.packages['apps/prompter'].devDependencies), sortiert(paket.devDependencies), 'PR Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/prompter gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'PR Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
{
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  ok(ci.includes('run: npm run selftest -w @jm/prompter'), 'PR Werkzeug rendert: die CI führt den Selbsttest des Prompters im Job Selbsttests aus');
}
