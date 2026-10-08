// ─────────────────────────────────────────────────────────────────────────────
// Selbsttest @jm/ui: npm run selftest -w @jm/ui (tsx, ohne Browser, ohne Electron).
// Jedes Testmodul prüft beim Import (Blöcke auf oberster Ebene), in der Reihenfolge der Importe.
// Neue Testmodule bekommen eine Import-Zeile direkt vor der letzten Zeile.
// ─────────────────────────────────────────────────────────────────────────────

import { abschluss } from './harness';
import './werkzeug.test';
import './bestand.test';
import './tokens.test';
import './quellregeln.test';
import './kontrast.test';
abschluss();
