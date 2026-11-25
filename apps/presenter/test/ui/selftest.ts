// Presenter-Oberflächentests (UX Welle 2b): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Läuft im Skript selftest nach den älteren
// Presenter-Tests.
//
// Vite-Importe mit `?url`: lib/pdf.ts holt die Worker-Adresse über `pdfjs-dist/build/pdf.worker.min.mjs?url`, das kennt nur
// Vite; usePresentation.ts, store/project.ts, SlideCanvas.tsx und EditorStage.tsx ziehen pdf.ts mit. Ein `paths`-Eintrag in
// tsconfig.test.json greift dafür nicht: tsx trennt die Abfrage vor dem paths-Abgleich ab (`specifier.split('?')`, tsx 4.22)
// und hängt sie danach wieder an, Node lädt dann den echten Worker ohne default-Export (Werkzeugtest „PS Ansichten laden
// ohne Vite“ war damit rot). Darum bildet ein Lade-Hook (module.register) jeden Bezeichner, der auf `?url` endet, auf
// test/ui/stub-url.ts ab.
//
// Der Hook muss stehen, bevor ein Testmodul aufgelöst wird. Statische import-Zeilen löst Node vor dem Rumpf dieser Datei auf
// (also vor register); darum kommen die Testmodule per `await import`, in fester Reihenfolge.
// Einfügemarke: neue Testmodule als eigene Zeile `await import('./<name>.test');` direkt vor der Zeile `abschluss();`.
import { register } from 'node:module';
import { abschluss } from '@jm/ui/testhilfe';

const STUB_URL = new URL('./stub-url.ts', import.meta.url).href;
const URL_HOOK = `export async function resolve(bezeichner, kontext, weiter) {
  return /\\?url$/.test(bezeichner) ? { url: ${JSON.stringify(STUB_URL)}, shortCircuit: true } : weiter(bezeichner, kontext);
}`;
register(`data:text/javascript,${encodeURIComponent(URL_HOOK)}`);

await import('./werkzeug.test');
await import('./bruecken.test');
await import('./oberflaeche.test');
await import('./rahmen.test');
await import('./panel.test');
await import('./referent.test');
await import('./live.test');
await import('./funktionsliste.test');
await import('./rueckspiel.test');
abschluss();
