// Lizenztext der NDI-Laufzeit im Bündel (nur Windows), Probe im Temp-Baum. npm run selftest -w @jm/ndi-screen-capture
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { probeNdiBuendel } from '../../../scripts/ndi-buendel-probe.mjs';

let pass = 0, fail = 0;
function ck(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
// CRLF → LF: unter Windows (autocrlf) liegen die Dateien mit \r\n im Arbeitsverzeichnis.
const lies = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const bundle = lies('../tools/bundle-ndi.mjs');
ck('Windows: Lizenztext steht in den Quellen neben der DLL', bundle.includes("name: 'Processing.NDI.Lib.Licenses.txt'") && bundle.includes("join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.Licenses.txt')"));
// Verhalten auf jedem OS: die Probe überschreibt process.platform.
const W = 'Processing.NDI.Lib.Licenses.txt';
const wFehlt = probeNdiBuendel('ndi-screen-capture', 'fehlt');
ck('Windows ohne Lizenztext: Abbruch mit Hinweis, nichts kopiert', wFehlt.status !== 0 && wFehlt.ausgabe.includes(W) && wFehlt.kopiert === null);
const wLeer = probeNdiBuendel('ndi-screen-capture', 'leer');
ck('Windows leerer Lizenztext (0 Byte): Abbruch wie ohne, nichts kopiert', wLeer.status !== 0 && wLeer.ausgabe.includes(W) && wLeer.kopiert === null);
const wDa = probeNdiBuendel('ndi-screen-capture', 'da');
ck('Windows mit Lizenztext: Addon, DLL und Lizenztext in resources/bin/win', wDa.status === 0 && JSON.stringify(wDa.kopiert) === JSON.stringify([W, 'Processing.NDI.Lib.x64.dll', 'jm_ndi.node']));
// Kein Mac-Zweig: auf Nicht-Windows wird übersprungen, auch mit vorhandenem Lizenztext nichts kopiert.
const mac = probeNdiBuendel('ndi-screen-capture', 'da', { plattform: 'darwin' });
ck('Mac: übersprungen, Exit 0, nichts kopiert', mac.status === 0 && mac.ausgabe.includes('übersprungen') && mac.kopiert === null);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
