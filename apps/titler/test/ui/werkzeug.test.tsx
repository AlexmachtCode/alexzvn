// UX-Pilot C7 · Werkzeug der Titler-Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische Wächter
// der Verdrahtung, die in der CI mitlaufen: Skripte, Abhängigkeit samt Lock-Zeile, @source für @jm/settings.
// Arbeitsverzeichnis ist apps/titler (npm run selftest -w @jm/titler); leseText liest relativ dazu.
import { NdiOutputSection } from '@jm/settings';
import { TallyButton } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { zaehlerText } from '@/lib/datalink-anzeige';
import { DEFAULT_CONFIG } from '@shared/types';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<TallyButton state="live" label="Take" onClick={() => {}} />);
  enthaelt(html, 'data-state="live"', 'Werkzeug: TallyButton aus @jm/ui rendert unter tsx (live)');
  enthaelt(html, '>LIVE<', 'Werkzeug: TallyButton live zeigt die Kennung LIVE');
}
{
  const html = render(<NdiOutputSection id="ndi" enabled sourceName="JM Titler" capabilities={{ toggle: true, rename: true }} />);
  enthaelt(html, 'an (ohne Rückmeldung)', 'Werkzeug: NdiOutputSection aus @jm/settings rendert unter tsx (an, ohne Rückmeldung)');
  pruefeIdVerweise(html, 'Werkzeug: id-Verweise im gerenderten Abschnitt gültig');
}
{
  gleich(zaehlerText(1, 5), 'Einträge · 2/5', 'Werkzeug: Alias @/ lädt einen Wert aus dem Renderer (lib/datalink-anzeige)');
  gleich(DEFAULT_CONFIG.ndiName, 'JM Titler', 'Werkzeug: Alias @shared/ lädt einen Wert (shared/types)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'Werkzeug: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'Werkzeug: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('Werkzeug: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(
    paket.scripts.selftest,
    'tsx test/selftest.ts && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts',
    'Werkzeug: selftest ruft beide Läufe (alter Selbsttest mit eigenem Zähler, dann die Oberfläche)',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'Werkzeug: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'Werkzeug: @jm/settings ist Abhängigkeit des Titlers');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  gleich(lock.packages['apps/titler'].dependencies, paket.dependencies, 'Werkzeug: Abhängigkeiten in package.json und im Lock-Block apps/titler gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";') && css.includes('@source "../../../../../packages/settings/src";'),
    'Werkzeug: globals.css scannt @jm/ui und @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
