// Player-Oberflächentests (UX Welle 2a): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Der Player hat keinen älteren Selbsttest;
// selftest ist nur dieser Lauf.
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
// Achtung: Module mit top-level await (bruecken, store) laufen neben ihren Geschwistern verschränkt. Wer globalThis.window
// setzt und dabei wartet, importiert die anderen window-Tests vorher selbst (Muster: store.test.ts importiert bruecken.test).
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
import './bruecken.test';
import './store.test';
import './oberflaeche.test';
abschluss();
