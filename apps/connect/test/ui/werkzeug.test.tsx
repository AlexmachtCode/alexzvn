// UX Welle 2b, Connect b (Task 21) · Werkzeug der Oberflächentests (Muster b Punkt 1): tsx mit tsconfig.test.json rendert JSX
// aus @jm/ui und @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Dazu statische
// Wächter der Verdrahtung: Skripte (die älteren Tests bleiben in der Kette), Abhängigkeiten samt Lock-Zeile, CI-Schritt; seit dem
// Rahmen (Task 23) auch globals.css mit @source für @jm/ui und @jm/settings, die Schrift Manrope und index.html mit class="dark".
// Arbeitsverzeichnis ist apps/connect (npm run selftest -w @jm/connect); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { existsSync } from 'node:fs';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { toDataUrl } from '@/lib/qr';
import { IPC } from '@shared/ipc';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { ohneKommentare } from './testzustand';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'CN Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8737} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'CN Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  enthaelt(html, '8737', 'CN Werkzeug rendert: RemoteControlSection zeigt den übergebenen Steuerport (8737)');
  pruefeIdVerweise(html, 'CN Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  gleich(IPC.openRoom, 'jmc:open-room', 'CN Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/ipc)');
  gleich(typeof toDataUrl, 'function', 'CN Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/qr)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'CN Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'CN Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('CN Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
  gleich(ohneKommentare('a\n  // weg\nb /* weg */ c'), 'a\n\nb  c', 'CN Werkzeug rendert: ohneKommentare entfernt Zeilen- und Blockkommentare (für Quelltext-Wächter)');
}
{
  const paket = JSON.parse(leseText('package.json'));
  const kette: string = paket.scripts.selftest;
  const teile = kette.split('&&').map((t) => t.trim());
  ok(
    teile[0] === 'tsx test/zoom-text.test.ts' && teile.includes('tsx test/ndi-text.test.ts') && teile.includes('node test/bundle-ndi.test.mjs') && teile.length === 21,
    'CN Werkzeug rendert: die 20 älteren Tests bleiben in der Kette des Selbsttests (' + (teile.length - 1) + ' gezählt, mit dem Oberflächenlauf 21)',
  );
  gleich(teile[teile.length - 1], 'tsx --tsconfig tsconfig.test.json test/ui/selftest.ts', 'CN Werkzeug rendert: der Oberflächenlauf ist der letzte Schritt des Selbsttests');
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' && paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'CN Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*' && paket.dependencies['@jm/ui'] === '*', 'CN Werkzeug rendert: @jm/ui und @jm/settings sind Abhängigkeiten von Connect');
  ok(typeof paket.dependencies['@fontsource-variable/manrope'] === 'string', 'CN Werkzeug rendert: die Schrift Manrope ist Abhängigkeit von Connect (base.css bindet sie ein)');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'CN Werkzeug rendert: tsx ist devDependency von Connect (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/connect'].dependencies), sortiert(paket.dependencies), 'CN Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/connect gleich');
  gleich(sortiert(lock.packages['apps/connect'].devDependencies), sortiert(paket.devDependencies), 'CN Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/connect gleich');
}
{
  // Muster Interpreter/Presenter (Task 23): ohne @source fände Tailwind die Klassen der Bausteine nicht, sie wären still ungestylt.
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes(['@import "tailwindcss";', '@import "@jm/ui/base.css";', '@source "../../../../../packages/ui/src";', '@source "../../../../../packages/settings/src";', ''].join(String.fromCharCode(10))),
    'CN Werkzeug rendert: globals.css lädt Tailwind und @jm/ui/base.css und scannt @jm/ui und direkt danach @jm/settings (@source), sonst fehlen Klassen der Bausteine',
  );
  ok(css.includes('--font-sans: "Manrope Variable", ui-sans-serif, system-ui, sans-serif;') && css.includes('font-family: var(--font-sans);'), 'CN Werkzeug rendert: globals.css schaltet die Schrift auf Manrope (Tokens aus @jm/ui)');
  ok(!existsSync('src/renderer/src/index.css') && /^import '\.\/globals\.css';$/m.test(leseText('src/renderer/src/main.tsx')) && !leseText('src/renderer/src/main.tsx').includes('index.css'), 'CN Werkzeug rendert: index.css ist nach globals.css umgezogen, main.tsx lädt globals.css');
  const html = leseText('src/renderer/index.html');
  ok(html.includes('<html lang="de" class="dark">') && html.includes('http-equiv="Content-Security-Policy"'), 'CN Werkzeug rendert: index.html trägt class="dark" (B4) und behält die Meta-CSP');
  // Manrope bringt kleine Schnitte, die Vite als data:-Schrift einbettet; die Meta-CSP erlaubt Schriften wie die Laufzeit-CSP
  // (packages/app-runtime/src/csp.ts: font-src 'self' data:), sonst meldet die Konsole bei jedem Start einen Fehler (Task 23, gemessen).
  const csp = /content="([^"]*)"/.exec(html.slice(html.indexOf('Content-Security-Policy')))?.[1] ?? '';
  ok(
    csp.split(';').map((d) => d.trim()).includes("font-src 'self' data:") && csp.includes("connect-src 'self' https: wss:") && csp.includes("img-src 'self' data:") && csp.includes("script-src 'self'"),
    'CN Werkzeug rendert: die Meta-CSP erlaubt Schriften wie die Laufzeit-CSP (font-src self data:) und behält connect-src, img-src und script-src',
  );
}
{
  // Nur der Job „Selbsttests“ zählt: von seinem Schlüssel bis zum nächsten Job-Schlüssel (zwei Leerzeichen eingerückt).
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  const anfang = ci.indexOf('\n  selftests:\n');
  const rest = anfang < 0 ? '' : ci.slice(anfang + 1);
  const ende = rest.search(/\n {2}[a-z0-9-]+:\n/);
  const job = ende < 0 ? rest : rest.slice(0, ende + 1);
  ok(
    job.includes('      - name: Connect (Zoom-Kern gegen die Attrappe, Laufzeit, Statustexte, Oberfläche)\n        run: npm run selftest -w @jm/connect\n'),
    'CN Werkzeug rendert: die CI führt den Selbsttest von Connect (samt Oberflächentests) im Job Selbsttests aus',
  );
}
