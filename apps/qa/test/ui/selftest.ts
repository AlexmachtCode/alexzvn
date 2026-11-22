// Q&A-Oberflächentests (UX Welle 1): Render ohne Browser und reine Ableitungen, mit @jm/ui/testhilfe in einem
// eigenen tsx-Lauf mit tsconfig.test.json (jsx, Aliase @/ und @shared/). Die alten Selbsttests test/selftest.ts und
// cloud-zugang.test.ts haben eigene Zähler und laufen vorher als eigene Prozesse (package.json, selftest).
// Einfügemarke: neue Testmodule als eigene import-Zeile direkt vor der Zeile `abschluss();`.
import { abschluss } from '@jm/ui/testhilfe';
import './werkzeug.test';
import './bruecken.test';
import './oberflaeche.test';
import './rahmen.test';
import './live.test';
import './panel.test';
abschluss();
