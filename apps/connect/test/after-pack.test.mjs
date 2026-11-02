// Selbsttest fuer tools/after-pack.cjs - Waechter 2 (Spec Stage 4, 10.3): keine
// Zoom-SDK-Datei im fertigen win-unpacked, auch nicht IN der app.asar, und unter
// Windows liegt resources/zoom-bridge/zoom-bridge.exe dabei. Ohne electron-builder:
// der Haken bekommt ein nachgebautes context-Objekt mit einem Temp-Ordner.
//   node apps/connect/test/after-pack.test.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const afterPack = require('../tools/after-pack.cjs').default;

// Das Ergebnis darf nicht davon abhaengen, ob auf diesem PC ein SDK liegt:
// ohne ZOOM_SDK_DIR gilt die feste Namensliste fuer 7.1.5.43953.
delete process.env.ZOOM_SDK_DIR;

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

/** Legt eine Datei samt Ordnern an. */
function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
/** .asar wie von electron-builder: 16-Byte-Kopf (4, Laenge+8, Laenge+4, Laenge), dann { files: baum }. */
function baueAsar(pfad, baum) {
  const json = Buffer.from(JSON.stringify({ files: baum }), 'utf8');
  const kopf = Buffer.alloc(16);
  kopf.writeUInt32LE(4, 0);
  kopf.writeUInt32LE(json.length + 8, 4);
  kopf.writeUInt32LE(json.length + 4, 8);
  kopf.writeUInt32LE(json.length, 12);
  datei(pfad, Buffer.concat([kopf, json]));
}
const leer = { size: 0, offset: '0' };
const sauberesAsar = { out: { files: { main: { files: { 'index.cjs': leer } } } }, 'package.json': leer };

/** Ein frisches appOutDir mit einer sauberen resources/app.asar. */
function appOutDir() {
  const d = mkdtempSync(join(tmpdir(), 'jm-after-pack-'));
  baueAsar(join(d, 'resources', 'app.asar'), sauberesAsar);
  return d;
}
/** 'ok', wenn der Haken durchlaeuft, sonst die Meldung seines Fehlers. */
async function ergebnis(context) {
  try {
    await afterPack(context);
    return 'ok';
  } catch (e) {
    return e.message;
  }
}

const ordner = [];
try {
  console.log('after-pack — Waechter 2:');
  {
    const d = appOutDir();
    ordner.push(d);
    baueAsar(join(d, 'resources', 'app.asar'), {
      ...sauberesAsar,
      node_modules: { files: { '@jm': { files: { 'zoom-bridge': { files: { 'package.json': leer } } } } } },
    });
    const r = await ergebnis({ appOutDir: d, electronPlatformName: 'linux' });
    assert(r.startsWith('Zoom-SDK-Dateien im Installer:'), 'Bridge-Paketordner IN der app.asar: der Haken wirft "Zoom-SDK-Dateien im Installer"');
    assert(r.includes('node_modules/@jm/zoom-bridge/package.json'), '... und nennt den Eintrag');
  }
  {
    const d = appOutDir();
    ordner.push(d);
    datei(join(d, 'resources', 'app.asar.unpacked', 'x', 'sdk.dll'));
    const r = await ergebnis({ appOutDir: d, electronPlatformName: 'linux' });
    assert(r.startsWith('Zoom-SDK-Dateien im Installer:') && r.includes('sdk.dll'), 'sdk.dll in app.asar.unpacked: der Haken wirft und nennt die Datei');
  }
  {
    const d = appOutDir();
    ordner.push(d);
    assert((await ergebnis({ appOutDir: d, electronPlatformName: 'linux' })) === 'ok', 'sauber, nicht Windows: der Haken laeuft durch');
    assert(
      (await ergebnis({ appOutDir: d, electronPlatformName: 'win32' })) === 'zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).',
      'sauber, Windows, ohne resources/zoom-bridge/zoom-bridge.exe: der Haken wirft',
    );
    datei(join(d, 'resources', 'zoom-bridge', 'zoom-bridge.exe'), 'MZ');
    datei(join(d, 'resources', 'zoom-bridge', 'msvcp140.dll'), 'MZ');
    assert((await ergebnis({ appOutDir: d, electronPlatformName: 'win32' })) === 'ok', 'sauber, Windows, mit EXE und VC-Laufzeit: der Haken laeuft durch');
  }

  console.log('\nbundle-zoom-bridge — ohne Windows:');
  if (process.platform !== 'win32') {
    const r = spawnSync(process.execPath, [join(hier, '..', 'tools', 'bundle-zoom-bridge.mjs')], { encoding: 'utf8' });
    assert(r.status === 0 && r.stdout.includes('[bundle-zoom-bridge] Nicht-Windows — übersprungen.'), 'ausserhalb von Windows: Meldung "übersprungen", Rueckgabe 0');
  } else {
    console.log('  --  ausserhalb von Windows: Meldung "übersprungen", Rueckgabe 0 (übersprungen: nur ohne Windows)');
  }

  console.log('\nafter-pack — Waechter 2, NDI-Regel (Spec 22.7, E56; PK57):');
  {
    /** Wie ergebnis(), liest dazu die Zeilen des Hakens mit (Erfolgszeile, Spec 13 Nr. 7, C-EP13). */
    const mitZeilen = async (context) => {
      const zeilen = [];
      const alt = console.log;
      console.log = (...a) => { zeilen.push(a.join(' ')); };
      try {
        return { r: await ergebnis(context), zeilen };
      } finally {
        console.log = alt;
      }
    };
    /** app.asar mit diesem Inhalt unter node_modules/@jm/ndi/, sonst sauber. */
    const mitNdi = (ndi) => ({ ...sauberesAsar, node_modules: { files: { '@jm': { files: { ndi: { files: ndi } } } } } });
    /** appOutDir für win32 (resources/app.asar, mit zoom-bridge.exe) bzw. darwin (JM Connect.app/Contents/Resources/app.asar). */
    const ausgabe = (plattform, baum) => {
      const d = mkdtempSync(join(tmpdir(), 'jm-after-pack-ndi-'));
      ordner.push(d);
      if (plattform === 'win32') {
        baueAsar(join(d, 'resources', 'app.asar'), baum);
        datei(join(d, 'resources', 'zoom-bridge', 'zoom-bridge.exe'), 'MZ');
      } else baueAsar(join(d, 'JM Connect.app', 'Contents', 'Resources', 'app.asar'), baum);
      return d;
    };
    const ERFOLG = '[after-pack] Wächter 2: keine Zoom-SDK-Dateien im Installer, keine NDI-Kopie in der app.asar (';
    const kopien = [
      ['jm_ndi.node unter build/Release', { 'index.js': leer, build: { files: { Release: { files: { 'jm_ndi.node': leer } } } } }, 'node_modules/@jm/ndi/build/Release/jm_ndi.node'],
      ['eine andere .node-Datei', { 'index.js': leer, prebuilds: { files: { 'darwin-arm64': { files: { 'ndi.node': leer } } } } }, 'node_modules/@jm/ndi/prebuilds/darwin-arm64/ndi.node'],
    ];
    for (const plattform of ['win32', 'darwin']) {
      for (const [was, ndi, eintrag] of kopien) {
        const { r, zeilen } = await mitZeilen({ appOutDir: ausgabe(plattform, mitNdi(ndi)), electronPlatformName: plattform });
        assert(r.startsWith('NDI-Kopie in der app.asar (Spec 22.7, E56):') && r.includes(`app.asar:${eintrag}`) && zeilen.length === 0,
          `C16 PK57 ${plattform}${plattform === 'win32' ? ' mit EXE' : ''}: ${was} unter node_modules/@jm/ndi/ in der app.asar → der Haken wirft, nennt den Eintrag, keine Erfolgszeile`);
      }
      const { r, zeilen } = await mitZeilen({ appOutDir: ausgabe(plattform, mitNdi({ 'index.js': leer, 'package.json': leer })), electronPlatformName: plattform });
      assert(r === 'ok' && zeilen.length === 1 && zeilen[0].startsWith(ERFOLG),
        `C16 PK57 ${plattform}${plattform === 'win32' ? ' mit EXE' : ''}: node_modules/@jm/ndi/index.js allein → durch, Erfolgszeile mit „keine NDI-Kopie in der app.asar“`);
      const sauber = await mitZeilen({ appOutDir: ausgabe(plattform, sauberesAsar), electronPlatformName: plattform });
      assert(sauber.r === 'ok' && sauber.zeilen.length === 1 && sauber.zeilen[0].startsWith(ERFOLG),
        `C16 PK57 ${plattform}${plattform === 'win32' ? ' mit EXE' : ''}: saubere app.asar ohne @jm/ndi → durch, Erfolgszeile mit „keine NDI-Kopie in der app.asar“`);
    }
    const fremd = { ...sauberesAsar, node_modules: { files: { andere: { files: { 'x.node': leer } } } } };
    const { r, zeilen } = await mitZeilen({ appOutDir: ausgabe('darwin', fremd), electronPlatformName: 'darwin' });
    assert(r === 'ok' && zeilen.length === 1 && zeilen[0].startsWith(ERFOLG), 'C16 E56 eine .node-Datei eines anderen Pakets → durch (die Regel gilt nur @jm/ndi)');

    // Lizenzdateien in einem Paket mit NDI-Laufzeit (Spec 22.8 LP4, LP5; über 22.8 hinaus, Owner-Frage OFC4, C4E16).
    const resVon = (d, plattform) => (plattform === 'win32' ? join(d, 'resources') : join(d, 'JM Connect.app', 'Contents', 'Resources'));
    /** Paket mit NDI-Laufzeit und Lizenzdateien; `ohne` (Dateiname) fehlt, `leer` (Dateiname) ist leer. */
    const mitLaufzeit = (plattform, { ohne = null, leer: leerName = null } = {}) => {
      const d = ausgabe(plattform, sauberesAsar);
      const res = resVon(d, plattform);
      const win = plattform === 'win32';
      const dateien = [[join('bin', win ? 'win' : 'mac', win ? 'Processing.NDI.Lib.x64.dll' : 'libndi.dylib'), 'NDI'], ['LIZENZ.txt', 'JM Connect – Lizenzbedingungen']];
      if (win) dateien.push([join('bin', 'win', 'Processing.NDI.Lib.Licenses.txt'), 'Lizenztexte der Drittbibliotheken']);
      for (const [rel, inhalt] of dateien) {
        const name = rel.split(/[\\/]/).pop();
        if (name !== ohne) datei(join(res, rel), name === leerName ? '' : inhalt);
      }
      return { d, res };
    };
    for (const [plattform, liste] of [['win32', 'LIZENZ.txt, Processing.NDI.Lib.Licenses.txt'], ['darwin', 'LIZENZ.txt']]) {
      const { d } = mitLaufzeit(plattform);
      const { r: rl, zeilen: zl } = await mitZeilen({ appOutDir: d, electronPlatformName: plattform });
      assert(rl === 'ok' && zl.length === 1 && zl[0].startsWith(ERFOLG) && zl[0].endsWith(`; neben der NDI-Laufzeit beigelegt: ${liste}).`),
        `C16 LP4 LP5 OFC4 ${plattform}: Paket mit NDI-Laufzeit und Lizenzdateien → durch, die Erfolgszeile nennt ${liste}`);
    }
    const lizenzFaelle = [
      ['win32', 'LIZENZ.txt fehlt', { ohne: 'LIZENZ.txt' }, (res) => join(res, 'LIZENZ.txt')],
      ['win32', 'LIZENZ.txt ist leer', { leer: 'LIZENZ.txt' }, (res) => join(res, 'LIZENZ.txt')],
      ['win32', 'Processing.NDI.Lib.Licenses.txt fehlt', { ohne: 'Processing.NDI.Lib.Licenses.txt' }, (res) => join(res, 'bin', 'win', 'Processing.NDI.Lib.Licenses.txt')],
      ['darwin', 'LIZENZ.txt fehlt', { ohne: 'LIZENZ.txt' }, (res) => join(res, 'LIZENZ.txt')],
    ];
    for (const [plattform, was, wie, pfad] of lizenzFaelle) {
      const { d, res } = mitLaufzeit(plattform, wie);
      const { r: rl, zeilen: zl } = await mitZeilen({ appOutDir: d, electronPlatformName: plattform });
      assert(rl === `Lizenzdateien fehlen oder sind leer (Spec 22.8 LP4, LP5):\n  ${pfad(res)}` && zl.length === 0,
        `C16 LP4 LP5 OFC4 ${plattform}: Paket mit NDI-Laufzeit, ${was} → der Haken wirft und nennt genau diese Datei, keine Erfolgszeile`);
    }
    const ohneLaufzeit = await mitZeilen({ appOutDir: ausgabe('win32', sauberesAsar), electronPlatformName: 'win32' });
    assert(ohneLaufzeit.r === 'ok' && ohneLaufzeit.zeilen.length === 1 && ohneLaufzeit.zeilen[0].startsWith(ERFOLG) && !ohneLaufzeit.zeilen[0].includes('beigelegt'),
      'C16 OFC4 win32 mit EXE, ohne NDI-Laufzeit: keine Lizenzpflicht (Altfälle, Tag connect-v0.3.0), die Erfolgszeile nennt keine Lizenzdateien');
  }
  {
    const { readFileSync } = await import('node:fs');
    const yml = readFileSync(join(hier, '..', 'electron-builder.yml'), 'utf8').replace(/\r\n/g, '\n').split('\n');
    const von = yml.indexOf('files:');
    const bis = yml.findIndex((z, i) => i > von && /^\S/.test(z));
    const files = von < 0 ? [] : yml.slice(von + 1, bis);
    assert(files.includes('  - "!**/node_modules/@jm/ndi/build/**"') && files.includes('  - "!**/node_modules/@jm/ndi/bin/**"'),
      'C16 E56 electron-builder.yml: files schließt node_modules/@jm/ndi/build/** und /bin/** aus');
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle after-pack-Tests bestanden.' : `\n${failures} after-pack-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
