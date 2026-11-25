// UX Welle 2b, Studio-Control · vorab (Task 13) · Werkzeug der Oberflächentests (Spec 11, Muster b Punkt 1): tsx mit
// tsconfig.test.json rendert JSX aus @jm/ui und @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler
// (@jm/ui/testhilfe). Dazu statische Wächter der Verdrahtung: Skripte, Abhängigkeit samt Lock-Zeile, CI-Schritt. Das @source
// für @jm/settings in globals.css kommt mit den Brücken (Plan Task 15) und wird dort geprüft.
// Arbeitsverzeichnis ist apps/studio-control (npm run selftest -w @jm/studio-control); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { useApp } from '@/store/app';
import { EVENTS } from '@shared/protocol';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { mitStore, ohneKommentare } from './testzustand';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'SC Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8735} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'SC Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  enthaelt(html, '8735', 'SC Werkzeug rendert: RemoteControlSection zeigt den übergebenen Steuerport (8735)');
  pruefeIdVerweise(html, 'SC Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  gleich(EVENTS.LIGHTING_STATE, 'lighting:state', 'SC Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/protocol)');
  gleich(useApp.getState().section, 'video', 'SC Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (store/app, Anfang „video“)');
}
{
  const Abschnitt = () => <span>{useApp((s) => s.section)}</span>;
  enthaelt(mitStore({ section: 'setup' }, () => render(<Abschnitt />)), '>setup<', 'SC Werkzeug rendert: mitStore setzt den App-Store für den Render');
  enthaelt(render(<Abschnitt />), '>video<', 'SC Werkzeug rendert: mitStore stellt den Anfangszustand danach zurück');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'SC Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'SC Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('SC Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
  gleich(ohneKommentare('a\n  // weg\nb /* weg */ c'), 'a\n\nb  c', 'SC Werkzeug rendert: ohneKommentare entfernt Zeilen- und Blockkommentare (für Quelltext-Wächter)');
}
{
  const paket = JSON.parse(leseText('package.json'));
  gleich(paket.scripts.selftest, 'tsx --tsconfig tsconfig.test.json test/ui/selftest.ts', 'SC Werkzeug rendert: selftest ist der tsx-Lauf der Oberflächentests (kein älterer Lauf)');
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'SC Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'SC Werkzeug rendert: @jm/settings ist Abhängigkeit von Studio-Control');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'SC Werkzeug rendert: tsx ist devDependency von Studio-Control (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/studio-control'].dependencies), sortiert(paket.dependencies), 'SC Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/studio-control gleich');
  gleich(sortiert(lock.packages['apps/studio-control'].devDependencies), sortiert(paket.devDependencies), 'SC Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/studio-control gleich');
}
{
  // Nur der Job „Selbsttests“ zählt: von seinem Schlüssel bis zum nächsten Job-Schlüssel (zwei Leerzeichen eingerückt).
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  const anfang = ci.indexOf('\n  selftests:\n');
  const rest = anfang < 0 ? '' : ci.slice(anfang + 1);
  const ende = rest.search(/\n {2}[a-z0-9-]+:\n/);
  const job = ende < 0 ? rest : rest.slice(0, ende + 1);
  ok(
    job.includes('      - name: Studio-Control (Oberfläche)\n        run: npm run selftest -w @jm/studio-control\n'),
    'SC Werkzeug rendert: die CI führt den Selbsttest von Studio-Control im Job Selbsttests aus (Schritt „Studio-Control (Oberfläche)“)',
  );
}
