// Selbsttest für tools/bundle-ndi.mjs und tools/ndi-universal.mjs (Spec Zoom-Slots 22.7, E46, E54, LP4; PK51): die reinen
// Teile des Bundle-Skripts (libndi-Referenz aus otool -L, Auswahl der Lizenzdateien, Zeile der Windows-Laufzeit), der
// Quelltext der Fassungsprüfung im Windows-Zweig, die Skripte in package.json und beide Skripte ohne SDK bzw. außerhalb
// von macOS. Baut nichts, lädt nichts, schreibt nichts nach resources/ (frischerOrdner nur in einem Temp-Ordner).
//   node apps/connect/test/bundle-ndi.test.mjs
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { istHauptprogramm, libndiReferenz, lizenzAuswahl, lizenzDateien, windowsNdiZeile } from '../tools/bundle-ndi.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const tools = join(hier, '..', 'tools');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

console.log('bundle-ndi — reine Teile (PK51):');
{
  const otool = (zeile) => `/x/bin/mac/jm_ndi.node:\n${zeile}\n\t/usr/lib/libc++.1.dylib (compatibility version 1.0.0, current version 1700.255.5)\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1345.100.2)\n`;
  const absolut = libndiReferenz(otool('\t/Library/NDI SDK for Apple/lib/macOS/libndi.dylib (compatibility version 0.0.0, current version 0.0.0)'));
  assert(absolut?.alt === '/Library/NDI SDK for Apple/lib/macOS/libndi.dylib' && absolut.aendern === true,
    'C15 PK51 libndiReferenz: absoluter Pfad (mit Leerzeichen) → ganz, wird umgebogen');
  const rpath = libndiReferenz(otool('\t@rpath/libndi.dylib (compatibility version 0.0.0, current version 0.0.0)'));
  assert(rpath?.alt === '@rpath/libndi.dylib' && rpath.aendern === true, 'C15 PK51 libndiReferenz: @rpath/libndi.dylib → wird umgebogen');
  const schon = libndiReferenz(otool('\t@loader_path/libndi.dylib (compatibility version 0.0.0, current version 0.0.0)'));
  assert(schon?.alt === '@loader_path/libndi.dylib' && schon.aendern === false, 'C15 PK51 libndiReferenz: schon @loader_path/libndi.dylib → bleibt');
  const fassung = libndiReferenz(otool('\t@rpath/libndi.4.dylib (compatibility version 4.0.0, current version 4.0.0)'));
  assert(fassung?.alt === '@rpath/libndi.4.dylib' && fassung.aendern === true, 'C15 PK51 libndiReferenz: libndi.4.dylib → erkannt');
  assert(libndiReferenz('/x/libndi.dylib:\n\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1345.100.2)\n') === null,
    'C15 PK51 libndiReferenz: ohne Referenz → null (die erste Zeile, die Datei selbst, zählt nicht)');
}
{
  const sdk = [
    'NDI SDK License Agreement.pdf', 'Version.txt', 'include/Processing.NDI.Lib.h', 'lib/macOS/libndi.dylib',
    'licenses/libndi_licenses.txt', 'licenses/README.md', 'Documentation/NDI SDK Documentation.pdf',
    'examples/C++/NDIlib_Send/LICENSE.txt', 'Examples/licenses/x.txt', 'include/license.h', 'Bin/x64/Processing.NDI.Lib.Licenses.TXT',
  ];
  assert(JSON.stringify(lizenzDateien(sdk)) === '["licenses/libndi_licenses.txt","Bin/x64/Processing.NDI.Lib.Licenses.TXT"]',
    'C15 PK51 lizenzDateien: nur Textdateien mit „licen“ im Pfad, keine Header, PDFs, Beispiele, Version.txt oder README.md');
}
{
  const h = (c) => c.repeat(64);
  const z = windowsNdiZeile({ dateiversion: '6.3.2.0', dll: h('a'), lizenz: h('b'), lizenzDatum: '10.04.2026', doku: h('c'), dokuDatum: '10.04.2026' });
  assert(z === `[bundle-ndi] NDI-Laufzeit Windows: Dateiversion 6.3.2.0 (SHA-256: DLL ${h('a')}, Lizenz ${h('b')} vom 10.04.2026, Doku ${h('c')} vom 10.04.2026)`,
    'C15 PK51 windowsNdiZeile: Dateiversion, SHA-256 der DLL, Lizenz und Doku je mit Datum');
  const ohne = windowsNdiZeile({ dateiversion: '6.3.2.0', dll: h('a'), lizenz: h('b'), lizenzDatum: '10.04.2026', doku: 'fehlt', dokuDatum: null });
  const ohneLizenz = windowsNdiZeile({ dateiversion: '6.3.2.0', dll: h('a'), lizenz: 'fehlt', lizenzDatum: null, doku: h('c'), dokuDatum: '10.04.2026' });
  assert(ohne.endsWith(`Lizenz ${h('b')} vom 10.04.2026, Doku fehlt)`) && ohneLizenz.endsWith(`DLL ${h('a')}, Lizenz fehlt, Doku ${h('c')} vom 10.04.2026)`),
    'C15 PK51 windowsNdiZeile: Doku bzw. Lizenz fehlt');
}
{
  const quelle = readFileSync(join(tools, 'bundle-ndi.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const win = quelle.slice(quelle.indexOf('function windowsZweig('), quelle.indexOf('function hauptprogramm('));
  const mac = quelle.slice(quelle.indexOf('function macZweig('), quelle.indexOf('function windowsZweig('));
  assert(/^import \{[^}]*\bNDI_LESESTAND_WINDOWS\b[^}]*\bpruefeNdiLesestand\b[^}]*\} from '\.\/pruefe-mac-paket\.mjs';$/m.test(quelle)
    && /pruefeNdiLesestand\(\{ kennzeichen: werte\.dateiversion, [^\n]*\}, NDI_LESESTAND_WINDOWS\);\n\s*if \(!r\.weiter\) throw new Error\(/.test(win)
    && win.indexOf('pruefeNdiLesestand(') < win.indexOf('copyFileSync('),
  'C15 PK51 Quelltext: der Windows-Zweig ruft pruefeNdiLesestand mit NDI_LESESTAND_WINDOWS und bricht vor dem Kopieren ab');
  assert(win.includes("'Processing.NDI.Lib.Licenses.txt'") && win.includes('VersionInfo.FileVersion') && win.includes('windowsNdiZeile('),
    'C15 LP4 Quelltext: der Windows-Zweig legt Processing.NDI.Lib.Licenses.txt bei und druckt Dateiversion und Prüfsummen');
  assert(/machOArchitekturen\(/.test(mac) && /'--force', '--sign', '-', nodeDest/.test(mac) && /'--verify', '--verbose', d/.test(mac)
    && /lizenzDateien\(/.test(mac) && mac.indexOf("'install_name_tool', ['-change'") < mac.indexOf("'--force', '--sign', '-', nodeDest"),
  'C15 E46 Quelltext: der Mac-Zweig prüft beide Architekturen, legt Lizenzdateien bei, signiert nach install_name_tool ad hoc und prüft mit codesign --verify');
}
{
  assert(istHauptprogramm(process.argv[1]) === false && istHauptprogramm(join(tools, 'bundle-ndi.mjs')) === true && istHauptprogramm(undefined) === false,
    'C15 C-EP6 istHauptprogramm: der Test ist es nicht, das Bundle-Skript schon; ein Import läuft nicht als Hauptprogramm');
  const pkg = JSON.parse(readFileSync(join(hier, '..', 'package.json'), 'utf8'));
  assert(pkg.scripts['rebuild:native:mac'] === 'node tools/ndi-universal.mjs'
    && pkg.scripts['dist:mac'] === 'electron-vite build && npm run prepackage && electron-builder --mac'
    && pkg.scripts.prepackage === 'node tools/bundle-ndi.mjs && node tools/bundle-zoom-bridge.mjs',
  'C15 22.7 package.json: rebuild:native:mac ruft ndi-universal.mjs, dist:mac ruft prepackage wie der Titler');
}

console.log('\nbundle-ndi und ndi-universal — Hauptprogramm ohne SDK bzw. außerhalb von macOS:');
{
  const env = { ...process.env };
  delete env.NDI_SDK_DIR;
  const r = spawnSync(process.execPath, [join(tools, 'bundle-ndi.mjs')], { encoding: 'utf8', env });
  if (process.platform === 'win32' || process.platform === 'darwin') {
    assert(r.status === 1 && r.stderr.includes('[bundle-ndi] NDI_SDK_DIR nicht gesetzt'), 'C15 22.7 bundle-ndi ohne NDI_SDK_DIR → Abbruch, Rückgabe 1');
  } else {
    assert(r.status === 0 && r.stdout.includes('[bundle-ndi] Nicht-Windows/Mac — übersprungen'), 'C15 22.7 bundle-ndi unter Linux → übersprungen, Rückgabe 0');
  }
  if (process.platform !== 'darwin') {
    const u = spawnSync(process.execPath, [join(tools, 'ndi-universal.mjs')], { encoding: 'utf8' });
    assert(u.status === 2 && u.stderr.includes('[ndi-universal] nur unter macOS') && u.stdout === '',
      'C15 E46 ndi-universal außerhalb von macOS → Rückgabe 2, nichts gebaut');
  } else {
    console.log('  --  ndi-universal außerhalb von macOS → Rückgabe 2 (übersprungen: nur ohne macOS)');
  }
}

console.log('\nbundle-ndi — Windows-Zweig frisch wie der Mac-Zweig (Nachtrag C, I-C15-1, R23; nur im Temp-Ordner):');
{
  const fs = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const modul = await import('../tools/bundle-ndi.mjs');
  const tmp = fs.mkdtempSync(join(tmpdir(), 'jm-bundle-ndi-'));
  try {
    // Ein früherer Lauf hinterließ eine Datei unter altem Namen, eine unter heutigem Namen und einen Unterordner.
    const ziel = join(tmp, 'resources', 'bin', 'win');
    fs.mkdirSync(join(ziel, 'unter'), { recursive: true });
    fs.writeFileSync(join(ziel, 'Processing.NDI.Lib.x64.alt.dll'), 'alt');
    fs.writeFileSync(join(ziel, 'jm_ndi.node'), 'alt');
    fs.writeFileSync(join(ziel, 'unter', 'rest.txt'), 'alt');
    let fehler = null;
    try {
      modul.frischerOrdner(ziel);
    } catch (e) {
      fehler = e;
    }
    assert(fehler === null && fs.existsSync(ziel) && fs.statSync(ziel).isDirectory() && fs.readdirSync(ziel).length === 0,
      'Nachtrag C I-C15-1 frischerOrdner: die Restdateien eines früheren Laufs (auch im Unterordner) sind weg, der Ordner steht leer da');
    const neu = join(tmp, 'neu', 'bin', 'win');
    try {
      modul.frischerOrdner(neu);
    } catch {
      /* unten geprüft */
    }
    assert(fs.existsSync(neu) && fs.readdirSync(neu).length === 0, 'Nachtrag C I-C15-1 frischerOrdner: ein fehlender Ordner wird angelegt');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  // Der Windows-Zweig leert seinen Ordner erst nach der Fassungsprüfung (eine gescheiterte Prüfung lässt ihn stehen) und vor dem
  // Kopieren, wie der Mac-Zweig (C4E8); kein mkdirSync mehr, das alte Dateien stehen ließe.
  const quelle = readFileSync(join(tools, 'bundle-ndi.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const win = quelle.slice(quelle.indexOf('function windowsZweig('), quelle.indexOf('function hauptprogramm('));
  const frisch = win.indexOf('frischerOrdner(destDir);');
  assert(frisch > win.indexOf('if (!r.weiter) throw new Error(') && frisch < win.indexOf('copyFileSync(') && !win.includes('mkdirSync(destDir'),
    'Nachtrag C I-C15-1 Quelltext: der Windows-Zweig ruft frischerOrdner(destDir) nach der Fassungsprüfung und vor dem Kopieren');
}

// Das echte Apple-SDK (Install_NDI_SDK_v6_Apple.pkg, Laufzeit 6.3.2.0) legt libndi_licenses.txt dreimal ab (bin/, lib/macOS/,
// licenses/); der Mac-Zweig brach am gleichen Namen ab (Lauf 41449930195). Gleiche Kopien kommen nur einmal, verschiedene Texte
// gleichen Namens brechen weiter ab.
{
  const tmp = mkdtempSync(join(tmpdir(), 'bundle-ndi-lizenz-'));
  try {
    const sha = (rel) => createHash('sha256').update(readFileSync(join(tmp, rel))).digest('hex');
    const lege = (rel, text) => {
      mkdirSync(dirname(join(tmp, rel)), { recursive: true });
      writeFileSync(join(tmp, rel), text);
    };
    const hashVon = (text) => createHash('sha256').update(text).digest('hex');
    // (a) dreimal gleich → genau eine, die in lib/macOS
    for (const r of ['bin/x.txt', 'lib/macOS/x.txt', 'licenses/x.txt']) lege(r, 'gleicher Text');
    const a = lizenzAuswahl(['bin/x.txt', 'lib/macOS/x.txt', 'licenses/x.txt'], sha);
    assert(JSON.stringify(a.kopieren) === '["lib/macOS/x.txt"]' && a.gruppen.length === 1 && a.gruppen[0].name === 'x.txt'
      && a.gruppen[0].beigelegt === 'lib/macOS/x.txt' && JSON.stringify(a.gruppen[0].gleich) === '["bin/x.txt","licenses/x.txt"]'
      && a.gruppen[0].hash === hashVon('gleicher Text'),
    'Mac-Lizenzen lizenzAuswahl: dreimal gleicher Inhalt → nur lib/macOS/x.txt, die Gruppe nennt die beiden anderen und den Hash');
    // (b) gleicher Name, verschiedener Inhalt → wirft mit beiden Pfaden und Hashes
    lege('bin/y.txt', 'Text eins');
    lege('licenses/y.txt', 'Text zwei');
    let meldung = '';
    try {
      lizenzAuswahl(['bin/y.txt', 'licenses/y.txt'], sha);
    } catch (err) {
      meldung = String(err.message);
    }
    assert(meldung.includes('verschiedenem Inhalt') && meldung.includes(`bin/y.txt (${hashVon('Text eins')})`)
      && meldung.includes(`licenses/y.txt (${hashVon('Text zwei')})`),
    'Mac-Lizenzen lizenzAuswahl: gleicher Name, verschiedener Inhalt → Abbruch, die Meldung nennt je Pfad die SHA-256');
    // (c) eindeutige Namen → alle, in Listenreihenfolge, keine Gruppe
    lege('licenses/a.txt', 'a');
    lege('bin/b.txt', 'b');
    const c = lizenzAuswahl(['licenses/a.txt', 'bin/b.txt'], sha);
    assert(JSON.stringify(c.kopieren) === '["licenses/a.txt","bin/b.txt"]' && c.gruppen.length === 0,
      'Mac-Lizenzen lizenzAuswahl: eindeutige Namen → beide beigelegt, in Listenreihenfolge, keine Gruppe');
    // (d) gleich, aber keine Kopie in lib/macOS → die erste in Listenreihenfolge
    for (const r of ['licenses/z.txt', 'bin/z.txt']) lege(r, 'z-Text');
    const d = lizenzAuswahl(['licenses/z.txt', 'bin/z.txt'], sha);
    assert(JSON.stringify(d.kopieren) === '["licenses/z.txt"]' && d.gruppen[0].beigelegt === 'licenses/z.txt'
      && JSON.stringify(d.gruppen[0].gleich) === '["bin/z.txt"]',
    'Mac-Lizenzen lizenzAuswahl: gleich, ohne Kopie in lib/macOS → die erste in Listenreihenfolge');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  // Der Mac-Zweig wählt mit lizenzAuswahl, bevor er kopiert (nicht mehr der Abbruch bei gleichem Namen).
  const quelle = readFileSync(join(tools, 'bundle-ndi.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const mac = quelle.slice(quelle.indexOf('function macZweig('), quelle.indexOf('function windowsZweig('));
  const wahl = mac.indexOf('lizenzAuswahl(');
  assert(wahl !== -1 && wahl < mac.indexOf('copyFileSync('),
    'Mac-Lizenzen Quelltext: lizenzAuswahl( steht in macZweig vor copyFileSync(');
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(failures === 0 ? '\nAlle bundle-ndi-Tests bestanden.' : `\n${failures} bundle-ndi-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
