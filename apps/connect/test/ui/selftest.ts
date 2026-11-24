// Connect-Oberflächentests (UX Welle 2b, Task 21): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Die älteren Tests von Connect (test/*.test.ts) laufen
// davor in der Kette des Skripts selftest; dieser Lauf kommt als letzter Schritt dazu.
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
import './bruecken.test';
import './oberflaeche.test';
abschluss();
