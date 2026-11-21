// UX Welle 1, Switcher b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/switcher (npm run selftest -w @jm/switcher); leseText liest relativ dazu.
import { NdiOutputSection } from '@jm/settings';
import { TallyButton } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE } from '@/lib/bruecken';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<TallyButton state="live" label="Take" onClick={() => {}} />);
  enthaelt(html, 'data-state="live"', 'SW Werkzeug rendert: TallyButton aus @jm/ui rendert unter tsx (live)');
  enthaelt(html, '>LIVE<', 'SW Werkzeug rendert: TallyButton live zeigt die Kennung LIVE');
}
{
  const html = render(<NdiOutputSection id="ndi" enabled sourceName="JM Switcher" capabilities={{ toggle: true, rename: true }} />);
  enthaelt(html, 'an (ohne Rückmeldung)', 'SW Werkzeug rendert: NdiOutputSection aus @jm/settings rendert unter tsx (an, ohne Rückmeldung)');
  pruefeIdVerweise(html, 'SW Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof FERNSTEUERUNG_QUELLE.abfrage === 'function', 'SW Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  gleich(STEUER_PORT, 8723, 'SW Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/fernsteuerung)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'SW Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'SW Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('SW Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'node --experimental-strip-types test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts && node test/bundle-ndi.test.mjs',
    'SW Werkzeug rendert: selftest ruft alle drei Läufe (alter Selbsttest mit eigenem Zähler, dann die Oberfläche, dann das NDI-Bündel)',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'SW Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'SW Werkzeug rendert: @jm/settings ist Abhängigkeit des Switchers');
  ok(typeof paket.devDependencies.tsx === 'string', 'SW Werkzeug rendert: tsx ist devDependency des Switchers');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  gleich(lock.packages['apps/switcher'].dependencies, paket.dependencies, 'SW Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/switcher gleich');
  gleich(lock.packages['apps/switcher'].devDependencies, paket.devDependencies, 'SW Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/switcher gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'SW Werkzeug rendert: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
