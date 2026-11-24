// Studio-Control-Oberflächentests (UX Welle 2b, Task 13): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in
// einem eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Studio-Control hat keinen älteren Selbsttest;
// selftest ist nur dieser Lauf.
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
import './bruecken.test';
import './oberflaeche.test';
import './rahmen.test';
import './panel.test';
import './live.test';
import './panels.test';
abschluss();
