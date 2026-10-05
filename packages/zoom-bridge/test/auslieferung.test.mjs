// Selbsttest fuer scripts/auslieferung.mjs (Spec Stage 4, 12.1 letzter Absatz):
// die Waechter gegen Zoom-SDK-Dateien (Ordner UND Inhalt einer .asar), die
// Frische der EXE und die PE-Leser. Alles gegen Temp-Ordner - kein SDK, kein
// Windows, kein Compiler noetig.
//   node packages/zoom-bridge/test/auslieferung.test.mjs
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  SDK_NAMEN_7_1_5,
  VC_PFLICHT,
  asarEintraege,
  bridgeExeFrisch,
  dateiFassung,
  dateienUnter,
  linkerFassung,
  mindestens,
  sdkNamen,
  verboteneAsarEintraege,
  verboteneZoomDateien,
  waehleVcLaufzeit,
} from '../scripts/auslieferung.mjs';

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

const temp = mkdtempSync(join(tmpdir(), 'jm-auslieferung-'));
/** Legt eine Datei samt Ordnern an. */
function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
/**
 * Baut eine .asar, wie electron-builder sie schreibt: 16-Byte-Kopf
 * (UInt32LE 4, Laenge+8, Laenge+4, Laenge), dann das JSON-Inhaltsverzeichnis
 * { files: baum }. Der Dateiinhalt bleibt leer - gelesen wird nur das Verzeichnis.
 */
function baueAsar(pfad, baum) {
  const json = Buffer.from(JSON.stringify({ files: baum }), 'utf8');
  const kopf = Buffer.alloc(16);
  kopf.writeUInt32LE(4, 0);
  kopf.writeUInt32LE(json.length + 8, 4);
  kopf.writeUInt32LE(json.length + 4, 8);
  kopf.writeUInt32LE(json.length, 12);
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, Buffer.concat([kopf, json]));
}
const leer = { size: 0, offset: '0' };

try {
  console.log('auslieferung — SDK-Namensliste:');
  {
    assert(SDK_NAMEN_7_1_5.length === 152, 'SDK_NAMEN_7_1_5 hat 152 Namen (153 Dateien, 152 verschiedene Namen)');
    assert(new Set(SDK_NAMEN_7_1_5.map((n) => n.toLowerCase())).size === 152, '... ohne Doppelte, auch ohne Gross-/Kleinschreibung');
    assert(SDK_NAMEN_7_1_5.includes('sdk.dll') && SDK_NAMEN_7_1_5.includes('zoom_meeting_bridge.dll'), '... mit sdk.dll und zoom_meeting_bridge.dll');
    assert(VC_PFLICHT.join(',') === 'msvcp140.dll,msvcp140_codecvt_ids.dll,vcruntime140.dll,vcruntime140_1.dll', 'VC_PFLICHT: die vier Pflicht-DLLs');
    assert(!SDK_NAMEN_7_1_5.some((n) => VC_PFLICHT.includes(n.toLowerCase())), 'keine VC-Pflicht-DLL steht in der SDK-Liste (sonst sperrte der Waechter die eigene Laufzeit)');
    const fest = sdkNamen();
    assert(fest.has('sdk.dll') && fest.has('cmmlib.dll') && fest.size === 152, 'sdkNamen() ohne sdkBin: die feste Liste, klein geschrieben');
    assert(sdkNamen({ sdkBin: join(temp, 'gibt es nicht') }).size === 152, 'sdkNamen() mit fehlendem sdkBin-Ordner: die feste Liste');
  }

  console.log('\nauslieferung — Waechter fuer Ordner:');
  {
    const ordner = join(temp, 'resources');
    datei(join(ordner, 'zoom-bridge', 'zoom-bridge.exe'));
    datei(join(ordner, 'zoom-bridge', 'msvcp140.dll'));
    datei(join(ordner, 'bin', 'win', 'Processing.NDI.Lib.x64.dll'));
    assert(verboteneZoomDateien(ordner).length === 0, 'sauberer Ordner (Bridge, VC-Laufzeit, NDI): keine Treffer');
    datei(join(ordner, 'unter', 'sdk.dll'));
    datei(join(ordner, 'tief', 'x', 'SDK.DLL'));
    const treffer = verboteneZoomDateien(ordner).sort();
    assert(
      treffer.join('|') === [join('tief', 'x', 'SDK.DLL'), join('unter', 'sdk.dll')].join('|'),
      'findet unter/sdk.dll und tief/x/SDK.DLL (ohne Gross-/Kleinschreibung), relativ zum Ordner',
    );
    assert(dateienUnter(ordner).length === 5, 'dateienUnter: alle Dateien, rekursiv');

    // Mit sdkBin gilt die ECHTE Liste aus dem SDK-Ordner, nicht die feste.
    const sdkBin = join(temp, 'sdk', 'x64', 'bin');
    datei(join(sdkBin, 'nur-echt.dll'));
    datei(join(ordner, 'nur-echt.dll'));
    const echt = verboteneZoomDateien(ordner, { sdkBin });
    assert(echt.join('|') === 'nur-echt.dll', 'mit sdkBin: meldet nur-echt.dll und nicht mehr sdk.dll');
  }

  console.log('\nauslieferung — Waechter fuer .asar:');
  {
    const ordner = join(temp, 'win-unpacked');
    const asar = join(ordner, 'resources', 'app.asar');
    baueAsar(asar, {
      out: { files: { main: { files: { 'index.cjs': leer } } } },
      'package.json': leer,
      node_modules: {
        files: {
          '@jm': {
            files: {
              'zoom-bridge': { files: { 'package.json': leer, release: { files: { 'x.zip': leer } } } },
              ndi: { files: { 'index.js': leer } },
            },
          },
        },
      },
      // paket.zip liegt AUSSERHALB von node_modules/@jm/zoom-bridge/ und heisst nicht wie eine SDK-Datei:
      // nur die .zip-Regel (Spec 10.3, dritte Regel) kann sie melden.
      irgendwo: { files: { 'sdk.dll': { size: 0, unpacked: true }, 'paket.zip': leer } },
    });
    const eintraege = asarEintraege(asar);
    assert(
      eintraege.join('|') ===
        'out/main/index.cjs|package.json|node_modules/@jm/zoom-bridge/package.json|node_modules/@jm/zoom-bridge/release/x.zip|node_modules/@jm/ndi/index.js|irgendwo/sdk.dll|irgendwo/paket.zip',
      'asarEintraege: genau die Datei-Eintraege, mit / getrennt (Ordner = Knoten mit files)',
    );
    const rel = join('resources', 'app.asar');
    const treffer = verboteneAsarEintraege(ordner);
    assert(
      treffer.join('|') ===
        [
          `${rel}:node_modules/@jm/zoom-bridge/package.json`,
          `${rel}:node_modules/@jm/zoom-bridge/release/x.zip`,
          `${rel}:irgendwo/sdk.dll`,
          `${rel}:irgendwo/paket.zip`,
        ].join('|'),
      'meldet node_modules/@jm/zoom-bridge/package.json, .../release/x.zip, irgendwo/sdk.dll und irgendwo/paket.zip - je einmal',
    );

    const sauber = join(temp, 'sauber');
    baueAsar(join(sauber, 'resources', 'app.asar'), { out: { files: { main: { files: { 'index.cjs': leer } } } } });
    assert(verboteneAsarEintraege(sauber).length === 0, '.asar nur mit out/main/index.cjs: keine Treffer');
    datei(join(sauber, 'resources', 'irgendwas.zip'));
    assert(verboteneAsarEintraege(sauber).length === 0, 'eine .zip-DATEI ausserhalb einer .asar ist nicht Sache dieses Waechters');
  }

  console.log('\nauslieferung — Frische der EXE:');
  {
    const pkg = join(temp, 'paket');
    datei(join(pkg, 'native', 'x.cpp'), '// Quelle');
    datei(join(pkg, 'CMakeLists.txt'), '# Bau');
    const exe = join(pkg, 'build', 'Release', 'zoom-bridge.exe');
    let r = bridgeExeFrisch(pkg);
    assert(!r.ok && r.text.includes('fehlt') && r.text.includes('npm run rebuild -w @jm/zoom-bridge'), 'EXE fehlt: ok false, Text nennt "fehlt" und den Bau-Befehl');
    datei(exe, 'MZ');
    const jetzt = Date.now() / 1000;
    utimesSync(exe, jetzt - 3600, jetzt - 3600);
    r = bridgeExeFrisch(pkg);
    assert(!r.ok && r.text.includes('AELTER'), 'EXE aelter als native\\x.cpp: ok false, Text nennt "AELTER"');
    utimesSync(exe, jetzt + 60, jetzt + 60);
    r = bridgeExeFrisch(pkg);
    assert(r.ok && r.exe === exe, 'EXE juenger als native\\ und CMakeLists.txt: ok true mit Pfad');
  }

  console.log('\nauslieferung — PE-Leser und Fassungsvergleich:');
  {
    // PE mit Linker 14.44 (Optional Header ab pe+24, MajorLinkerVersion bei +2)
    // und VS_FIXEDFILEINFO 14.44.35211.0.
    const b = Buffer.alloc(0x200);
    b.write('MZ', 0, 'latin1');
    b.writeUInt32LE(0x80, 0x3c);
    b.write('PE\0\0', 0x80, 'latin1');
    b[0x80 + 24 + 2] = 14;
    b[0x80 + 24 + 3] = 44;
    b.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
    b.writeUInt32LE(((14 << 16) | 44) >>> 0, 0x108);
    b.writeUInt32LE(((35211 << 16) | 0) >>> 0, 0x10c);
    const pe = join(temp, 'pe', 'probe.dll');
    datei(pe, b);
    assert(linkerFassung(pe).join('.') === '14.44', 'linkerFassung liest 14.44');
    assert(dateiFassung(pe)?.join('.') === '14.44.35211.0', 'dateiFassung liest 14.44.35211.0');
    const text = join(temp, 'pe', 'text.txt');
    datei(text, 'kein PE');
    let meldung = '';
    try {
      linkerFassung(text);
    } catch (e) {
      meldung = e.message;
    }
    assert(meldung === `${text} ist keine PE-Datei.`, 'linkerFassung WIRFT bei einer Nicht-PE-Datei (statt process.exit)');
    assert(dateiFassung(text) === null, 'dateiFassung ohne Versionsressource: null');
    assert(mindestens([14, 44, 35211, 0], [14, 44]) && mindestens([14, 50, 0, 0], [14, 44]), 'mindestens: gleich oder neuer -> true');
    assert(!mindestens([14, 29, 30133, 0], [14, 44]), 'mindestens: aelter -> false');
  }
  console.log('auslieferung — waehleVcLaufzeit (EINE Auswahlregel fuer Einsatzpaket und Installer):');
  {
    /** Minimale PE-Datei: Linker major.minor, optional VS_FIXEDFILEINFO mit Fassung. */
    const pe = (major, minor) => {
      const b = Buffer.alloc(0x200);
      b.writeUInt32LE(0x80, 0x3c);
      b.write('PE  ', 0x80, 'latin1');
      b[0x80 + 24 + 2] = major;
      b[0x80 + 24 + 3] = minor;
      b.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
      b.writeUInt32LE(((major << 16) | minor) >>> 0, 0x108);
      return b;
    };
    const crt = join(temp, 'vc', 'Microsoft.VC143.CRT');
    for (const f of VC_PFLICHT) datei(join(crt, f), pe(14, 44));
    const pkg = join(temp, 'vc', 'pkg');
    const exeNeu = join(temp, 'vc', 'neu.exe');
    const exeAlt = join(temp, 'vc', 'alt.exe');
    const exeZukunft = join(temp, 'vc', 'zukunft.exe');
    const exeKaputt = join(temp, 'vc', 'kaputt.exe');
    datei(exeNeu, pe(14, 40));
    datei(exeAlt, pe(14, 44));
    datei(exeZukunft, pe(99, 0));
    datei(exeKaputt, 'kein PE');
    const vorher = process.env.VC_CRT_DIR;
    process.env.VC_CRT_DIR = crt;
    try {
      const ok = waehleVcLaufzeit(pkg, exeNeu);
      assert(ok.ok === true && ok.linker.join('.') === '14.40', 'brauchbare Laufzeit: ok mit Linker-Fassung');
      assert(ok.ok && ok.vcLaufzeit.fassung.join('.') !== '0.0.0.0' && mindestens(ok.vcLaufzeit.fassung, ok.linker), '... Laufzeit mindestens so neu wie der Linker');
      assert(ok.ok && VC_PFLICHT.every((f) => ok.dateien.includes(f)), '... dateien nennt alle *.dll des Ordners');
      const alt = waehleVcLaufzeit(pkg, exeZukunft);
      assert(alt.ok === false && /AELTER als der Linker 99\.0/.test(alt.text) && /VC_CRT_DIR/.test(alt.text), 'Laufzeit aelter als der Linker: ok false mit Text');
      const kaputt = waehleVcLaufzeit(pkg, exeKaputt);
      assert(kaputt.ok === false && kaputt.text === `${exeKaputt} ist keine PE-Datei.`, 'Nicht-PE-EXE: ok false statt Ausnahme');
      assert(waehleVcLaufzeit(pkg, exeAlt).ok === true, 'gleiche Fassung wie der Linker genuegt');
    } finally {
      if (vorher === undefined) delete process.env.VC_CRT_DIR;
      else process.env.VC_CRT_DIR = vorher;
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle Auslieferungs-Tests bestanden.' : `\n${failures} Auslieferungs-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
