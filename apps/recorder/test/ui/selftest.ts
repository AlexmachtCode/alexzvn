// Recorder-Oberflächentests (UX Welle 2a): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Der ältere Selbsttest der App läuft davor
// (siehe Skript selftest in package.json); dieser Lauf kommt dahinter.
// Einfügemarke: neue Testmodule als eigene Zeile `await lade(…)` direkt vor der Zeile `abschluss();`.
// Reihenfolge: Die Module laufen nacheinander (await je Modul). Module mit top-level await, die globalThis.window setzen
// und löschen, liefen als statische Geschwister-Importe verschränkt. Ein Modul, das beim Laden oder Ausführen wirft,
// zählt als FAIL, die übrigen laufen weiter.
import { abschluss, ok } from '@jm/ui/testhilfe';

async function lade(name: string, modul: () => Promise<unknown>): Promise<void> {
  try {
    await modul();
  } catch (e) {
    ok(false, `RE Testmodul ${name}: lädt oder läuft nicht (${e instanceof Error ? e.message : String(e)})`);
  }
}

await lade('werkzeug', () => import('./werkzeug.test'));
await lade('bruecken', () => import('./bruecken.test'));
await lade('oberflaeche', () => import('./oberflaeche.test'));
abschluss();
