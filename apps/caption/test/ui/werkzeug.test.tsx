// UX Welle 2a, Caption b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/caption (npm run selftest -w @jm/caption); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE } from '@/lib/bruecken';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'CA Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8732} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'CA Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'CA Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof FERNSTEUERUNG_QUELLE.abfrage === 'function', 'CA Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  gleich(STEUER_PORT, 8732, 'CA Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/fernsteuerung)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'CA Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'CA Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('CA Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  const aelter = 'node --experimental-strip-types test/selftest.ts && node test/bundle-ndi.test.mjs';
  gleich(
    paket.scripts.selftest,
    `${aelter} && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts`,
    'CA Werkzeug rendert: selftest ist der bisherige Lauf plus der tsx-Lauf der Oberflächentests',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'CA Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'CA Werkzeug rendert: @jm/settings ist Abhängigkeit der Caption');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'CA Werkzeug rendert: tsx ist devDependency der Caption (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/caption'].dependencies), sortiert(paket.dependencies), 'CA Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/caption gleich');
  gleich(sortiert(lock.packages['apps/caption'].devDependencies), sortiert(paket.devDependencies), 'CA Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/caption gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'CA Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
{
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  ok(ci.includes('run: npm run selftest -w @jm/caption'), 'CA Werkzeug rendert: die CI führt den Selbsttest der Caption im Job Selbsttests aus');
}
