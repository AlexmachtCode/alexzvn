// Stage-Display-Oberflächentests (UX Welle 2a): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Der ältere Lauf test/nachricht.test.tsx bleibt
// davor im selftest-Skript.
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
import './bruecken.test';
abschluss();
