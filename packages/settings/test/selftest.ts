// @jm/settings – Selbsttest ohne Electron und ohne Browser: npm run selftest -w @jm/settings
// tsx lädt die Testmodule, react-dom/server rendert mit renderToStaticMarkup (Spec 11).
// Einfügemarke: Neue Testmodule kommen als eigene import-Zeile direkt vor den Abschluss-Aufruf in der
// letzten Zeile. ES-Importe laufen vor dem Rumpf, der Abschluss zählt also alle Module mit.
import { abschluss } from '@jm/ui/testhilfe';
import './vertrag.test';
import './quellregeln.test';
import './ndi-output.test';
import './screen-output.test';
import './remote-control.test';
import './audio-device.test';
import './iveo.test';
import './datalink.test';
import './peers.test';
abschluss();
