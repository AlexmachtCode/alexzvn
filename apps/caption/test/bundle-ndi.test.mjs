// Lizenztext der NDI-Laufzeit im Bündel (Windows und Mac), Probe im Temp-Baum. npm run selftest -w @jm/caption
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
// Verhalten auf jedem OS: die Probe überschreibt process.platform (Mac: Abbruch/Kopie bis zum fehlenden otool).
const W = 'Processing.NDI.Lib.Licenses.txt';
const wFehlt = probeNdiBuendel('caption', 'fehlt');
ck('Windows ohne Lizenztext: Abbruch mit Hinweis, nichts kopiert', wFehlt.status !== 0 && wFehlt.ausgabe.includes(W) && wFehlt.kopiert === null);
const wLeer = probeNdiBuendel('caption', 'leer');
ck('Windows leerer Lizenztext (0 Byte): Abbruch wie ohne, nichts kopiert', wLeer.status !== 0 && wLeer.ausgabe.includes(W) && wLeer.kopiert === null);
const wDa = probeNdiBuendel('caption', 'da');
ck('Windows mit Lizenztext: Addon, DLL und Lizenztext in resources/bin/win', wDa.status === 0 && JSON.stringify(wDa.kopiert) === JSON.stringify([W, 'Processing.NDI.Lib.x64.dll', 'jm_ndi.node']));
const mac = { plattform: 'darwin' };
const mFehlt = probeNdiBuendel('caption', 'fehlt', mac);
ck('Mac ohne Lizenzdatei: Abbruch mit Hinweis, nichts kopiert', mFehlt.status !== 0 && mFehlt.ausgabe.includes('keine Lizenzdatei der NDI-Laufzeit') && mFehlt.kopiert === null);
const mLeer = probeNdiBuendel('caption', 'leer', mac);
ck('Mac leere Lizenzdatei (0 Byte): Abbruch, nichts kopiert', mLeer.status !== 0 && mLeer.ausgabe.includes('Lizenzdatei leer') && mLeer.kopiert === null);
const mDa = probeNdiBuendel('caption', 'da', mac);
ck('Mac mit Lizenzdatei: drei gleiche Kopien nur einmal, examples ignoriert, vor otool kopiert', !mDa.ausgabe.includes('Lizenzdatei leer') && JSON.stringify(mDa.kopiert) === JSON.stringify(['jm_ndi.node', 'libndi.dylib', 'libndi_licenses.txt']));

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
