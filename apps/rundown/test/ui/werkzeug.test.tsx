// UX Welle 1, Timer b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/rundown (npm run selftest -w @jm/rundown); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE } from '@/lib/bruecken';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'RD Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8731} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'RD Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'RD Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof FERNSTEUERUNG_QUELLE.abfrage === 'function', 'RD Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  gleich(STEUER_PORT, 8731, 'RD Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/fernsteuerung)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'RD Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'RD Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('RD Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'node --experimental-strip-types test/selftest.ts && node --experimental-strip-types --import ./test/register.mjs test/gedaechtnis.test.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts',
    'RD Werkzeug rendert: selftest ruft alle drei Läufe (Selbsttest und Gedächtnistest mit eigenen Zählern, dann die Oberfläche)',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'RD Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'RD Werkzeug rendert: @jm/settings ist Abhängigkeit des Rundowns');
  ok(typeof paket.devDependencies.tsx === 'string', 'RD Werkzeug rendert: tsx ist devDependency des Rundowns');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  gleich(lock.packages['apps/rundown'].dependencies, paket.dependencies, 'RD Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/rundown gleich');
  gleich(lock.packages['apps/rundown'].devDependencies, paket.devDependencies, 'RD Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/rundown gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'RD Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
