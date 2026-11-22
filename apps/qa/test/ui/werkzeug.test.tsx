// UX Welle 1, Q&A b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/qa (npm run selftest -w @jm/qa); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE } from '@/lib/bruecken';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'QA Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8733} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'QA Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'QA Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof FERNSTEUERUNG_QUELLE.abfrage === 'function', 'QA Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  gleich(STEUER_PORT, 8733, 'QA Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/fernsteuerung)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'QA Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'QA Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('QA Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'node --experimental-strip-types test/selftest.ts && node --experimental-strip-types test/cloud-zugang.test.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts',
    'QA Werkzeug rendert: selftest ruft alle drei Läufe (Selbsttest und Zugangstest mit eigenen Zählern, dann die Oberfläche)',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'QA Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'QA Werkzeug rendert: @jm/settings ist Abhängigkeit von Q&A');
  ok(typeof paket.devDependencies.tsx === 'string', 'QA Werkzeug rendert: tsx ist devDependency von Q&A');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  gleich(lock.packages['apps/qa'].dependencies, paket.dependencies, 'QA Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/qa gleich');
  gleich(lock.packages['apps/qa'].devDependencies, paket.devDependencies, 'QA Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/qa gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'QA Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
