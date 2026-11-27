// UX Welle 2b, Presenter b · Werkzeug der Oberflächentests (Spec 11): tsx mit tsconfig.test.json rendert JSX aus @jm/ui und
// @jm/settings, löst die Aliase @/ und @shared/ auf und zählt mit EINEM Zähler (@jm/ui/testhilfe). Die Ansichten laden ohne
// Vite, obwohl lib/pdf.ts den Worker über `…?url` importiert (Lade-Hook in selftest.ts). Dazu statische Wächter der Verdrahtung: Skripte, Abhängigkeiten
// samt Lock-Block, @source für @jm/settings, CI-Schritt.
// Arbeitsverzeichnis ist apps/presenter (npm run selftest -w @jm/presenter); leseText liest relativ dazu.
import { RemoteControlSection } from '@jm/settings';
import { Button } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { FERNSTEUERUNG_QUELLE } from '@/lib/bruecken';
import { STEUER_PORT } from '@shared/fernsteuerung';
import { fallText, kreuz, pruefeFaelle, vergleiche } from './hilfe';

{
  const html = render(<Button>Start</Button>);
  enthaelt(html, '>Start<', 'PS Werkzeug rendert: Button aus @jm/ui rendert unter tsx');
}
{
  const html = render(<RemoteControlSection id="fernsteuerung" running port={8728} clients={0} mode="open" capabilities={{}} />);
  enthaelt(html, 'einstellung-fernsteuerung', 'PS Werkzeug rendert: RemoteControlSection aus @jm/settings rendert unter tsx (Panel-Anker)');
  pruefeIdVerweise(html, 'PS Werkzeug rendert: id-Verweise im gerenderten Abschnitt gültig');
}
{
  ok(typeof FERNSTEUERUNG_QUELLE.abfrage === 'function', 'PS Werkzeug rendert: Alias @/ lädt ein Modul aus dem Renderer (lib/bruecken)');
  gleich(STEUER_PORT, 8728, 'PS Werkzeug rendert: Alias @shared/ lädt einen Wert (shared/fernsteuerung)');
}
{
  const faelle = kreuz({ a: [1, 2], b: ['x', 'y', 'z'] } as const);
  gleich(faelle.map(fallText), ['a=1 b="x"', 'a=1 b="y"', 'a=1 b="z"', 'a=2 b="x"', 'a=2 b="y"', 'a=2 b="z"'], 'PS Werkzeug rendert: kreuz bildet das volle Kreuzprodukt in fester Reihenfolge');
  gleich([fallText({ a: undefined }), vergleiche('a', 'a'), vergleiche('a', undefined)], ['a=undefined', null, 'ist: a soll: undefined'], 'PS Werkzeug rendert: fallText zeigt undefined, vergleiche meldet ist/soll');
  pruefeFaelle('PS Werkzeug rendert: pruefeFaelle schreibt eine Zeile je Tabelle', faelle, (f) => (f.a > 0 ? null : 'nie'));
}

// ── PS Ansichten laden ohne Vite: lib/pdf.ts importiert `pdfjs-dist/build/pdf.worker.min.mjs?url` (nur Vite kennt `?url`);
// usePresentation.ts, store/project.ts, SlideCanvas.tsx und EditorStage.tsx ziehen pdf.ts mit. Ohne Auflösung im Testlauf
// bräche jeder Test ab, der eine dieser Ansichten lädt (Lade-Hook in selftest.ts). Geladen wird dynamisch, damit ein Wurf als
// FAIL zählt statt den Lauf zu beenden; ohne window (kein Modul darf es beim Import lesen). Die Konsole wird beim Laden
// mitgeschrieben: pdf.js meldet unter Node einmal beim ersten Import seinen Hinweis auf den legacy-Build (im Electron-Renderer
// gilt sein isNodeJS nicht). Genau diese eine Zeile wird abgefangen und geprüft; jede andere Ausgabe fiele hier auf ──
{
  const zeilen: string[] = [];
  const konsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  const mitschreiben = (...a: unknown[]): void => void zeilen.push(a.map(String).join(' '));
  console.log = console.info = console.warn = console.error = mitschreiben;
  let ergebnis: unknown;
  try {
    const editor = await import('@/views/EditorView');
    const referent = await import('@/views/PresenterView');
    ergebnis = [typeof editor.EditorView, typeof referent.PresenterView];
  } catch (e) {
    ergebnis = String(e);
  } finally {
    Object.assign(console, konsole);
  }
  gleich(ergebnis, ['function', 'function'], 'PS Ansichten laden ohne Vite: @/views/EditorView und @/views/PresenterView laden unter tsx ohne Wurf');
  gleich(zeilen, ['Warning: Please use the `legacy` build in Node.js environments.'], 'PS Ansichten laden ohne Vite: beim Laden schreibt nur pdf.js seinen Node-Hinweis (abgefangen, sonst nichts)');
  ok(typeof (globalThis as { window?: unknown }).window === 'undefined', 'PS Ansichten laden ohne Vite: der Import legt kein window an (Render-Tests laufen weiter ohne window)');
}
{
  let ergebnis: unknown;
  try {
    const pdf = await import('@/lib/pdf');
    const pdfjs = await import('pdfjs-dist');
    ergebnis = [typeof pdf.pdfPageCount, pdfjs.GlobalWorkerOptions.workerSrc];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, ['function', ''], 'PS Ansichten laden ohne Vite: lib/pdf lädt, die Worker-Adresse kommt aus dem Stub (leer, kein Worker im Test)');
}

// ── Verdrahtung ──
{
  const paket = JSON.parse(leseText('package.json'));
  const aelter =
    'node --experimental-strip-types test/suite-state.test.ts && tsx test/wiedergabe.test.ts && tsx test/publikumsbild.test.ts && tsx test/ndi-bild.test.ts && tsx test/dateien.test.ts && tsx test/bildformat.test.ts && tsx test/dateien-laden.test.ts && tsx test/ndi-sender-kern.test.ts && tsx test/ndi-ausgang.test.ts && tsx test/ndi-schalter.test.ts && tsx test/nur-ndi.test.ts && tsx test/release-weg.test.ts && tsx test/referent-vollbild.test.ts && tsx test/gast-klicker.test.ts';
  // Altfehler Stufe 2: die Tests der Handy-Seite (PS-15) und der Wahl an Schwarz/Weiß (PS-18) hängen vor den Oberflächentests.
  const stufe2 = 'tsx test/handy-seite.test.ts && tsx test/schirm-wahl.test.ts';
  gleich(
    paket.scripts.selftest,
    `${aelter} && ${stufe2} && tsx --tsconfig tsconfig.test.json test/ui/selftest.ts`,
    'PS Werkzeug rendert: selftest ist der bisherige Lauf, dann Handy-Seite und Schirm-Wahl (Altfehler PS-15, PS-18), dann der tsx-Lauf der Oberflächentests',
  );
  ok(
    paket.scripts.typecheck === 'npm run typecheck:node && npm run typecheck:web && npm run typecheck:test' &&
      paket.scripts['typecheck:test'] === 'tsc --noEmit -p tsconfig.test.json',
    'PS Werkzeug rendert: typecheck prüft auch die Oberflächentests (typecheck:test ist verkettet, sonst sähe die CI sie nicht)',
  );
  ok(paket.dependencies['@jm/settings'] === '*', 'PS Werkzeug rendert: @jm/settings ist Abhängigkeit des Presenters');
  ok(paket.dependencies['@jm/output-window'] === '*', 'PS Werkzeug rendert: @jm/output-window ist Abhängigkeit des Presenters (beobachteBildschirme im Main)');
  gleich(paket.devDependencies.tsx, JSON.parse(leseText('../timer/package.json')).devDependencies.tsx, 'PS Werkzeug rendert: tsx ist devDependency des Presenters (Version wie Timer)');
  const lock = JSON.parse(leseText('../../package-lock.json'));
  // npm sortiert die Schlüssel im Lock; verglichen wird der Inhalt, nicht die Reihenfolge.
  const sortiert = (o: Record<string, string>): Array<[string, string]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1));
  gleich(sortiert(lock.packages['apps/presenter'].dependencies), sortiert(paket.dependencies), 'PS Werkzeug rendert: Abhängigkeiten in package.json und im Lock-Block apps/presenter gleich');
  gleich(sortiert(lock.packages['apps/presenter'].devDependencies), sortiert(paket.devDependencies), 'PS Werkzeug rendert: devDependencies in package.json und im Lock-Block apps/presenter gleich');
}
{
  const css = leseText('src/renderer/src/globals.css');
  ok(
    css.includes('@source "../../../../../packages/ui/src";\n@source "../../../../../packages/settings/src";\n'),
    'PS Werkzeug rendert: globals.css scannt @jm/ui und direkt danach @jm/settings (@source), sonst fehlen Klassen der Einstellungs-Abschnitte',
  );
}
{
  const ci = leseText('../../.github/workflows/ci-checks.yml');
  ok(
    ci.includes('      - name: Presenter (Suite-Status, On Air nur in der Präsentation, Oberfläche)\n        run: npm run selftest -w @jm/presenter\n'),
    'PS Werkzeug rendert: die CI führt den Selbsttest des Presenters samt Oberfläche im Job Selbsttests aus (Schrittname mit „, Oberfläche“)',
  );
}
