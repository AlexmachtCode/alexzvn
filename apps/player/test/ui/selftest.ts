// Player-Oberflächentests (UX Welle 2a): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Der Player hat keinen älteren Selbsttest;
// selftest ist nur dieser Lauf.
// Einfügemarke: neue Testmodule als eigene Zeile `await lade(…)` direkt vor der Zeile `abschluss();`.
// Reihenfolge: Die Module laufen nacheinander (await je Modul, Player d1). Module mit top-level await (bruecken, store)
// setzen und löschen globalThis.window zwischen eigenen await-Stellen; statische Geschwister-Importe liefen daneben
// verschränkt. Ein Modul, das beim Laden oder Ausführen wirft, zählt als FAIL, die übrigen laufen weiter.
import { abschluss, ok } from '@jm/ui/testhilfe';

async function lade(name: string, modul: () => Promise<unknown>): Promise<void> {
  try {
    await modul();
  } catch (e) {
    ok(false, `PL Testmodul ${name}: lädt oder läuft nicht (${e instanceof Error ? e.message : String(e)})`);
  }
}

await lade('werkzeug', () => import('./werkzeug.test'));
await lade('bruecken', () => import('./bruecken.test'));
await lade('store', () => import('./store.test'));
await lade('oberflaeche', () => import('./oberflaeche.test'));
await lade('rahmen', () => import('./rahmen.test'));
await lade('panel', () => import('./panel.test'));
await lade('live', () => import('./live.test'));
await lade('funktionsliste', () => import('./funktionsliste.test'));
abschluss();
