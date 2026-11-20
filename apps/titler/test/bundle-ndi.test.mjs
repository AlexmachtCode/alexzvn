// Lizenztext der NDI-Laufzeit im Bündel (Windows und Mac), Probe im Temp-Baum. npm run selftest -w @jm/titler
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
ck('Mac: Lizenzdateien wie Connect, ohne Fund Abbruch', bundle.includes("import('../../connect/tools/bundle-ndi.mjs')") && bundle.includes('lizenzDateien(') && bundle.includes('lizenzAuswahl(') && bundle.includes('keine Lizenzdatei der NDI-Laufzeit'));
if (process.platform === 'win32') {
  const fehlt = probeNdiBuendel('titler', 'fehlt');
  ck('ohne Lizenztext: Abbruch mit Hinweis, nichts kopiert', fehlt.status !== 0 && fehlt.ausgabe.includes('Processing.NDI.Lib.Licenses.txt') && fehlt.kopiert === null);
  const leer = probeNdiBuendel('titler', 'leer');
  ck('leerer Lizenztext (0 Byte): Abbruch wie ohne, nichts kopiert', leer.status !== 0 && leer.ausgabe.includes('Processing.NDI.Lib.Licenses.txt') && leer.kopiert === null);
  const da = probeNdiBuendel('titler', 'da');
  ck('mit Lizenztext: Addon, DLL und Lizenztext in resources/bin/win', da.status === 0 && JSON.stringify(da.kopiert) === JSON.stringify(['Processing.NDI.Lib.Licenses.txt', 'Processing.NDI.Lib.x64.dll', 'jm_ndi.node']));
} else if (process.platform === 'linux') {
  const l = probeNdiBuendel('titler', 'fehlt');
  ck('Linux: übersprungen wie bisher, nichts kopiert', l.status === 0 && l.ausgabe.includes('übersprungen') && l.kopiert === null);
} else console.log('skip  Mac-Zweig: nur im Mac-Bau prüfbar (otool, install_name_tool)');

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
