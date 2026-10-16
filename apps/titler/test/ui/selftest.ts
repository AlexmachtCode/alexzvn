// Titler-Oberflächentests (Suite-UX-Update Welle 0, Spec 11): Render ohne Browser und reine Ableitungen, mit
// @jm/ui/testhilfe in einem eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Der alte Selbsttest
// test/selftest.ts hat einen eigenen Zähler und läuft vorher als eigener Prozess (package.json, selftest).
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
abschluss();
