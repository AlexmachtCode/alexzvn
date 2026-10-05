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
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle after-pack-Tests bestanden.' : `\n${failures} after-pack-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
