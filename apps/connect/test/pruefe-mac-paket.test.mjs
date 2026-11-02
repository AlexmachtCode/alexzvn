// Selbsttest für tools/pruefe-mac-paket.mjs (iveo-Paket, Spec 10.2; E39, EP7; ab Connect 0.4.0 Spec Zoom-Slots 22.7, E45,
// E46, E54, E56, PK49, PK50, PK59): nachgebaute release-Ordner und SDK-Ordner in einem Temp-Ordner (nie ein Ordner namens
// release im Repo, .gitignore:6). Die iveo-Fälle laufen mit --ndi nein (GEP8), die app.asar trägt einen echten Kopf.
//   node apps/connect/test/pruefe-mac-paket.test.mjs
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asarNdiNodeEintraege, machOArchitekturen, macNdiZeile, ndiErwartet, NDI_LESESTAND_MAC, NDI_LESESTAND_WINDOWS,
  NDI_ZEILE_MUSTER, pruefeMacPaket, pruefeNdiLesestand, pruefeNdiSdk,
} from '../tools/pruefe-mac-paket.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const skript = join(hier, '..', 'tools', 'pruefe-mac-paket.mjs');

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
/** .asar wie von electron-builder: 16-Byte-Kopf (4, Laenge+8, Laenge+4, Laenge), dann { files: baum } (wie after-pack.test.mjs). */
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
/** app.asar wie nach Spec 22.7 (E56): @jm/ndi nur mit JavaScript, ohne build/ und bin/. */
const sauberesAsar = {
  out: { files: { main: { files: { 'index.cjs': leer } } } },
  node_modules: { files: { '@jm': { files: { ndi: { files: { 'index.js': leer, 'package.json': leer } } } } } },
  'package.json': leer,
};
/** Mach-O-Kopf wie lipo ihn liest: eine Architektur dünn (MH_MAGIC_64), mehrere universell (FAT_MAGIC), dahinter Füllbytes. */
function machO(...archs) {
  const cpu = { arm64: 0x0100000c, x86_64: 0x01000007 };
  if (archs.length === 1) {
    const b = Buffer.alloc(64);
    b.writeUInt32LE(0xfeedfacf, 0);
    b.writeUInt32LE(cpu[archs[0]], 4);
    return b;
  }
  const b = Buffer.alloc(8 + 20 * archs.length + 64);
  b.writeUInt32BE(0xcafebabe, 0);
  b.writeUInt32BE(archs.length, 4);
  archs.forEach((a, i) => b.writeUInt32BE(cpu[a], 8 + 20 * i));
  return b;
}

const ordner = [];
/** Ein Mac-Bau wie von electron-builder (dmg arm64 + x64, EP7): zwei DMGs samt Beiwerk, zwei .app mit app.asar. */
function sauber() {
  const d = mkdtempSync(join(tmpdir(), 'jm-mac-paket-'));
  ordner.push(d);
  datei(join(d, 'JM Connect-0.3.0-mac-arm64.dmg'), 'dmg');
  datei(join(d, 'JM Connect-0.3.0-mac-x64.dmg'), 'dmg');
  datei(join(d, 'JM Connect-0.3.0-mac-arm64.dmg.blockmap'), 'x');
  datei(join(d, 'latest-mac.yml'), 'x');
  for (const m of ['mac-arm64', 'mac']) {
    const res = join(d, m, 'JM Connect.app', 'Contents', 'Resources');
    baueAsar(join(res, 'app.asar'), sauberesAsar);
    datei(join(res, 'icon.png'), 'png');
  }
  return d;
}
/**
 * Ein Mac-Bau mit NDI (22.7): je App der Mach-O-Kopf der App (arm64 bzw. x86_64), in bin/mac das universelle Addon, die
 * universelle libndi.dylib und eine Lizenzdatei. Ordner `mac-arm64` und `mac` wie heute; `ordnerNamen` tauscht sie.
 */
function sauberMitNdi(version = '0.4.0', ordnerNamen = ['mac-arm64', 'mac']) {
  const d = mkdtempSync(join(tmpdir(), 'jm-mac-paket-ndi-'));
  ordner.push(d);
  datei(join(d, `JM Connect-${version}-mac-arm64.dmg`), 'dmg');
  datei(join(d, `JM Connect-${version}-mac-x64.dmg`), 'dmg');
  ordnerNamen.forEach((m, i) => {
    const app = join(d, m, 'JM Connect.app');
    datei(join(app, 'Contents', 'MacOS', 'JM Connect'), machO(i === 0 ? 'arm64' : 'x86_64'));
    const res = join(app, 'Contents', 'Resources');
    baueAsar(join(res, 'app.asar'), sauberesAsar);
    datei(join(res, 'LIZENZ.txt'), 'JM Connect – Lizenzbedingungen');
    datei(join(res, 'bin', 'mac', 'jm_ndi.node'), machO('arm64', 'x86_64'));
    datei(join(res, 'bin', 'mac', 'libndi.dylib'), machO('x86_64', 'arm64'));
    datei(join(res, 'bin', 'mac', 'libndi_licenses.txt'), 'Lizenztexte der Drittbibliotheken');
  });
  return d;
}
const lauf = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8' });

try {
  console.log('pruefe-mac-paket — macOS ohne Zoom und ohne NDI:');
  {
    const d = sauber();
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(r.ok && r.fehler.length === 0, 'P38 10.2: sauberer Bau (zwei DMGs arm64/x64, zwei .app ohne zoom-bridge und ohne jm_ndi.node) → in Ordnung');
    const k = lauf(d, '--ndi', 'nein');
    assert(k.status === 0 && k.stdout.startsWith('pruefe-mac-paket: in Ordnung'), 'P38 10.2: Kommandozeile, sauberer Bau → Exit 0');
  }
  {
    const d = sauber();
    mkdirSync(join(d, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'zoom-bridge'), { recursive: true });
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(!r.ok && r.fehler.some((f) => f.startsWith('Ordner zoom-bridge im Mac-Paket:') && f.includes('mac-arm64')),
      'P38 10.2 Gegenprobe: Ordner zoom-bridge in der arm64-App → rot, mit Pfad');
    const k = lauf(d, '--ndi', 'nein');
    assert(k.status === 1 && k.stderr.includes('pruefe-mac-paket: Ordner zoom-bridge im Mac-Paket:'),
      'P38 10.2: Kommandozeile mit zoom-bridge → Exit 1, Grund auf stderr');
  }
  {
    const d = sauber();
    datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'jm_ndi.node'), 'addon');
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(!r.ok && r.fehler.some((f) => f.startsWith('NDI-Addon im Mac-Paket') && f.includes('jm_ndi.node')),
      'P38 10.2 Gegenprobe: bin/mac/jm_ndi.node in der x64-App → rot (OF1 Variante A)');
  }
  {
    const d = sauber();
    rmSync(join(d, 'JM Connect-0.3.0-mac-x64.dmg'));
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(!r.ok && r.fehler.includes('genau zwei DMGs erwartet, gefunden 1: JM Connect-0.3.0-mac-arm64.dmg.')
      && r.fehler.includes('genau ein DMG mit „x64“ im Namen erwartet, gefunden 0.'),
    'P38 10.2 Gegenprobe: nur ein DMG → rot (Zahl und fehlende Architektur)');
  }
  {
    const d = sauber();
    rmSync(join(d, 'JM Connect-0.3.0-mac-x64.dmg'));
    datei(join(d, 'JM Connect-0.3.0-mac-arm64-kopie.dmg'), 'dmg');
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(!r.ok && r.fehler.length === 2 && r.fehler.includes('genau ein DMG mit „arm64“ im Namen erwartet, gefunden 2.'),
      'P38 10.2: zwei DMGs, beide arm64 → rot');
  }
  {
    const d = sauber();
    rmSync(join(d, 'mac'), { recursive: true });
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0] === 'genau zwei „JM Connect.app“ unter mac*/ erwartet, gefunden 1.',
      'P38 EP7: nur eine .app unter mac*/ → rot (sicherer Fehlschlag)');
  }
  {
    const r = pruefeMacPaket(join(tmpdir(), 'jm-mac-paket-gibt-es-nicht'), { ndi: 'nein' });
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0].startsWith('Ordner „'), 'P38 10.2: release-Ordner fehlt → rot');
    const k = lauf();
    assert(k.status === 2 && k.stderr.includes('Aufruf: node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner>'),
      'P38 10.2: Kommandozeile ohne Ordner → Exit 2 mit Aufruf');
  }
  {
    // Gesamtprüfung Befund 7 (EP7 „sicherer Fehlschlag“): Node löst das Hauptmodul über realpath auf, argv[1] nur mit resolve.
    // Über einen Ordner-Link (Junction unter Windows, Symlink sonst) aufgerufen, muss das Skript trotzdem prüfen, statt still
    // mit Exit 0 zu enden. Die Kopie liegt im Temp-Ordner; der Link wird zuerst einzeln entfernt (nie rekursiv durch ihn).
    const echt = mkdtempSync(join(tmpdir(), 'jm-mac-paket-skript-'));
    ordner.push(echt);
    copyFileSync(skript, join(echt, 'pruefe-mac-paket.mjs'));
    const linkOrdner = mkdtempSync(join(tmpdir(), 'jm-mac-paket-link-'));
    const link = join(linkOrdner, 'werkzeug');
    symlinkSync(echt, link, 'junction');
    try {
      const ohne = spawnSync(process.execPath, [join(link, 'pruefe-mac-paket.mjs')], { encoding: 'utf8' });
      const d = sauber();
      const mitZoom = sauber();
      mkdirSync(join(mitZoom, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'zoom-bridge'), { recursive: true });
      const gut = spawnSync(process.execPath, [join(link, 'pruefe-mac-paket.mjs'), d, '--ndi', 'nein'], { encoding: 'utf8' });
      const schlecht = spawnSync(process.execPath, [join(link, 'pruefe-mac-paket.mjs'), mitZoom, '--ndi', 'nein'], { encoding: 'utf8' });
      assert(ohne.status === 2 && gut.status === 0 && gut.stdout.startsWith('pruefe-mac-paket: in Ordnung') && schlecht.status === 1,
        'Gesamt-Fix EP7: Aufruf über einen Ordner-Link → die Kommandozeile prüft (Exit 2 ohne Ordner, 0 sauber, 1 mit zoom-bridge), nie still Exit 0');
    } finally {
      unlinkSync(link);
      rmSync(linkOrdner, { recursive: true, force: true });
    }
  }
  console.log('\npruefe-mac-paket — Versionsregel, --ndi, Mach-O, asar (Spec 22.7, E45, E46, E56; PK49, PK50):');
  {
    assert(ndiErwartet('0.3.0') === 'nein' && ndiErwartet('0.3.9') === 'nein' && ndiErwartet('0.4.0') === 'ja'
      && ndiErwartet('0.10.0') === 'ja' && ndiErwartet('1.0.0') === 'ja',
    'C14 PK49 ndiErwartet: 0.3.0 und 0.3.9 nein, 0.4.0, 0.10.0 und 1.0.0 ja (Zahl für Zahl, nicht als Zeichenkette)');
    let geworfen = '';
    try { ndiErwartet('v0.4.0'); } catch (err) { geworfen = err.message; }
    assert(geworfen.includes('v0.4.0') && geworfen.includes('nicht die Form'), 'C14 PK49 ndiErwartet: v0.4.0 ist keine Version → Fehler');
    const ja = lauf('--ndi-fuer', '0.4.0');
    const nein = lauf('--ndi-fuer', '0.3.0');
    const zehn = lauf('--ndi-fuer', '0.10.0');
    assert(ja.status === 0 && ja.stdout === 'ja\n' && nein.status === 0 && nein.stdout === 'nein\n' && zehn.stdout === 'ja\n',
      'C14 PK49 --ndi-fuer 0.4.0 druckt ja, 0.3.0 nein, 0.10.0 ja (genau eine Zeile, Exit 0)');
    const schief = lauf('--ndi-fuer', 'connect-v0.4.0');
    assert(schief.status === 2 && schief.stdout === '' && schief.stderr.includes('nicht die Form'), 'C14 PK49 --ndi-fuer mit Tag statt Version → Exit 2, nichts auf stdout');
  }
  {
    const d = sauber();
    const ohne = lauf(d);
    const falsch = lauf(d, '--ndi', 'vielleicht');
    assert(ohne.status === 2 && ohne.stderr.includes('--ndi fehlt')
      && ohne.stderr.includes('Aufruf: node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner> --ndi ja|nein [--probe]'),
    'C14 PK49 GEP8 ohne --ndi → Exit 2 mit erweiterter Aufrufzeile');
    assert(falsch.status === 2 && falsch.stderr.includes('--ndi vielleicht'), 'C14 PK49 --ndi vielleicht → Exit 2');
    let geworfen = false;
    try { pruefeMacPaket(d); } catch { geworfen = true; }
    assert(geworfen, 'C14 PK49 pruefeMacPaket ohne ndi wirft (die Angabe ist Pflicht)');
    const k = lauf(d, '--ndi', 'nein');
    assert(k.status === 0 && k.stdout.startsWith('pruefe-mac-paket: in Ordnung (zwei DMGs arm64 und x64, Version 0.3.0;')
      && k.stdout.includes('ohne zoom-bridge und ohne jm_ndi.node, app.asar ohne NDI-Kopie'),
    'C14 GEP9 Erfolgszeile mit --ndi nein: Anfang wie bisher, dazu Version und asar-Prüfung');
  }
  {
    const d = sauber();
    const ja = pruefeMacPaket(d, { ndi: 'ja' });
    assert(!ja.ok && ja.fehler.includes('--ndi ja passt nicht zur Version 0.3.0: erwartet --ndi nein (nur ein Probelauf mit --probe darf abweichen).'),
      'C14 PK49 --ndi ja bei DMGs 0.3.0 ohne --probe → Fehler');
    const n = sauberMitNdi('0.4.0');
    const nein = pruefeMacPaket(n, { ndi: 'nein' });
    assert(!nein.ok && nein.fehler.includes('--ndi nein passt nicht zur Version 0.4.0: erwartet --ndi ja (nur ein Probelauf mit --probe darf abweichen).'),
      'C14 PK49 --ndi nein bei DMGs 0.4.0 → Fehler');
    const probe = sauberMitNdi('0.3.0');
    const p = pruefeMacPaket(probe, { ndi: 'ja', probe: true });
    assert(p.ok && p.version === '0.3.0' && p.apps.map((a) => a.arch).sort().join(' ') === 'arm64 x86_64',
      'C14 PK49 Probelauf: --ndi ja --probe bei DMGs 0.3.0 → Prüfung mit NDI, in Ordnung');
    const k = lauf(probe, '--ndi', 'ja', '--probe');
    const zeilen = k.stdout.trim().split('\n');
    assert(k.status === 0 && zeilen[0].startsWith('pruefe-mac-paket: in Ordnung (zwei DMGs arm64 und x64, Version 0.3.0, Probelauf;')
      && zeilen[0].includes('mit NDI (arm64 und x86_64) und Lizenzdatei, ohne zoom-bridge')
      && zeilen[0].endsWith(', app.asar ohne NDI-Kopie, Lizenzbedingungen LIZENZ.txt beigelegt).')
      && zeilen[1] === `pruefe-mac-paket: App arm64: ${join(probe, 'mac-arm64', 'JM Connect.app')}`
      && zeilen[2] === `pruefe-mac-paket: App x86_64: ${join(probe, 'mac', 'JM Connect.app')}` && zeilen.length === 3,
    'C14 GEP9 Erfolgszeile mit --ndi ja (Probelauf) und je App eine Zeile „App ‹Architektur›: ‹Pfad›“');
  }
  {
    const d = sauberMitNdi('0.4.0');
    rmSync(join(d, 'JM Connect-0.4.0-mac-x64.dmg'));
    datei(join(d, 'JM Connect-0.4.1-mac-x64.dmg'), 'dmg');
    const r = pruefeMacPaket(d, { ndi: 'ja' });
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0] === 'die DMGs nennen verschiedene Versionen: 0.4.0 und 0.4.1.',
      'C14 PK49 ungleiche Versionen der DMGs → Fehler');
    const e = sauberMitNdi('0.4.0');
    rmSync(join(e, 'JM Connect-0.4.0-mac-x64.dmg'));
    datei(join(e, 'JM Connect-0.4.0-9.9.9-mac-x64.dmg'), 'dmg');
    const s = pruefeMacPaket(e, { ndi: 'ja' });
    assert(s.ok && s.version === '0.4.0', 'C14 PK49 Version aus der ersten Gruppe -‹Zahl›.‹Zahl›.‹Zahl›- im Namen');
    const f = sauber();
    rmSync(join(f, 'JM Connect-0.3.0-mac-x64.dmg'));
    const t = pruefeMacPaket(f, { ndi: 'ja' });
    assert(!t.ok && t.version === null && !t.fehler.some((x) => /Version|passt nicht/.test(x)),
      'C14 PK49 falsche Zahl der DMGs: kein weiterer Fehler zur Version');
  }
  {
    const d = sauber();
    baueAsar(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'app.asar'), {
      ...sauberesAsar,
      node_modules: { files: { '@jm': { files: { ndi: { files: { 'index.js': leer, build: { files: { Release: { files: { 'jm_ndi.node': leer } } } } } } } } } },
    });
    const r = pruefeMacPaket(d, { ndi: 'nein' });
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0].startsWith('NDI-Kopie in der app.asar (E56):')
      && r.fehler[0].endsWith(':node_modules/@jm/ndi/build/Release/jm_ndi.node'),
    'C14 PK49 --ndi nein: jm_ndi.node unter node_modules/@jm/ndi/ in der app.asar → rot, mit Eintrag');
    const e = sauber();
    rmSync(join(e, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'app.asar'));
    const s = pruefeMacPaket(e, { ndi: 'nein' });
    assert(!s.ok && s.fehler.length === 1 && s.fehler[0].startsWith('app.asar fehlt:'), 'C14 PK49 --ndi nein: fehlende app.asar → rot');
    const f = sauber();
    datei(join(f, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'app.asar'), 'asar');
    const t = pruefeMacPaket(f, { ndi: 'nein' });
    assert(!t.ok && t.fehler.length === 1 && t.fehler[0].startsWith('app.asar unlesbar:') && t.fehler[0].includes('Kopf kürzer als 16 Byte'),
      'C14 PK49 --ndi nein: unlesbare app.asar (Kopf kürzer als 16 Byte) → rot');
    const g = join(f, 'kaputt.asar');
    const kopf = Buffer.alloc(16);
    kopf.writeUInt32LE(4000, 12);
    datei(g, Buffer.concat([kopf, Buffer.from('{"files":{}}')]));
    let geworfen = '';
    try { asarNdiNodeEintraege(g); } catch (err) { geworfen = err.message; }
    assert(geworfen.includes('Inhaltsverzeichnis abgeschnitten'), 'C14 asarNdiNodeEintraege: abgeschnittenes Inhaltsverzeichnis → Fehler statt Leerlauf');
    const h = join(f, 'andere.asar');
    baueAsar(h, { node_modules: { files: { '@jm': { files: { ndi: { files: { prebuilds: { files: { 'x.node': leer } }, 'index.js': leer } } } }, other: { files: { 'y.node': leer } } } } });
    assert(JSON.stringify(asarNdiNodeEintraege(h)) === '["node_modules/@jm/ndi/prebuilds/x.node"]',
      'C14 E56 asarNdiNodeEintraege: jede .node unter node_modules/@jm/ndi/, nicht die anderer Pakete');
  }
  {
    const arm = machO('arm64');
    const x86 = machO('x86_64');
    const beide = machO('arm64', 'x86_64');
    const nurArm = machO('arm64', 'arm64');
    const java = Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00, 0x00, 0x34, 0, 0, 0, 0]);
    assert(JSON.stringify(machOArchitekturen(arm)) === '["arm64"]', 'C14 PK50 Mach-O dünn arm64 → [arm64]');
    assert(JSON.stringify(machOArchitekturen(x86)) === '["x86_64"]', 'C14 PK50 Mach-O dünn x86_64 → [x86_64]');
    assert(JSON.stringify(machOArchitekturen(beide)) === '["arm64","x86_64"]', 'C14 PK50 Mach-O universell mit beiden → [arm64, x86_64]');
    assert(JSON.stringify(machOArchitekturen(nurArm)) === '["arm64","arm64"]' && !machOArchitekturen(nurArm).includes('x86_64'),
      'C14 PK50 Mach-O universell nur arm64 → ohne x86_64');
    assert(machOArchitekturen(Buffer.from('#!/bin/sh\necho\n')).length === 0 && machOArchitekturen(java).length === 0
      && machOArchitekturen(Buffer.alloc(3)).length === 0, 'C14 PK50 keine Mach-O-Datei (Text, Java-Klasse, 3 Byte) → leere Liste');
  }
  {
    const d = sauberMitNdi('0.4.0');
    const r = pruefeMacPaket(d, { ndi: 'ja' });
    assert(r.ok && r.fehler.length === 0, 'C14 PK49 --ndi ja, Bau 0.4.0 sauber → in Ordnung');
    const k = lauf(d, '--ndi', 'ja');
    assert(k.status === 0 && k.stdout.startsWith('pruefe-mac-paket: in Ordnung (zwei DMGs arm64 und x64, Version 0.4.0;'),
      'C14 PK49 Kommandozeile --ndi ja, Bau 0.4.0 sauber → Exit 0');
    const getauscht = sauberMitNdi('0.4.0', ['mac', 'mac-arm64']);
    const g = pruefeMacPaket(getauscht, { ndi: 'ja' });
    assert(g.ok && g.apps.find((a) => a.app.includes(`${join('mac-arm64', 'JM Connect.app')}`)).arch === 'x86_64',
      'C14 PK49 Architektur aus Contents/MacOS/JM Connect, nicht aus dem Ordnernamen (x86_64-App im Ordner mac-arm64)');
  }
  {
    // Je ein roter Fall mit --ndi ja (PK49); Pfade relativ zum Bau.
    const faelle = [
      ['jm_ndi.node fehlt in einer App', (d) => rmSync(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'jm_ndi.node')),
        (f) => f.startsWith('genau eine jm_ndi.node erwartet, gefunden 0:')],
      ['jm_ndi.node außerhalb von bin/mac', (d) => datei(join(d, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', '@jm', 'ndi', 'build', 'Release', 'jm_ndi.node'), machO('arm64')),
        (f) => f.startsWith('jm_ndi.node außerhalb von bin/mac:')],
      ['.node-Datei unter node_modules/@jm/ndi/ in der app.asar', (d) => baueAsar(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'app.asar'), {
        ...sauberesAsar, node_modules: { files: { '@jm': { files: { ndi: { files: { 'index.js': leer, bin: { files: { mac: { files: { 'jm_ndi.node': leer } } } } } } } } } },
      }), (f) => f.startsWith('NDI-Kopie in der app.asar (E56):') && f.endsWith(':node_modules/@jm/ndi/bin/mac/jm_ndi.node')],
      ['libndi.dylib fehlt', (d) => rmSync(join(d, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'libndi.dylib')),
        (f) => f.startsWith('libndi.dylib fehlt:')],
      ['Lizenzdatei fehlt', (d) => rmSync(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'libndi_licenses.txt')),
        (f) => f.startsWith('keine Lizenzdatei der NDI-Laufzeit (.txt) in')],
      ['dünnes arm64-Addon in der x64-App', (d) => datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'jm_ndi.node'), machO('arm64')),
        (f) => f.startsWith('jm_ndi.node ohne x86_64 (enthält arm64), App x86_64:')],
      ['dünne arm64-libndi.dylib in der x64-App', (d) => datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'libndi.dylib'), machO('arm64')),
        (f) => f.startsWith('libndi.dylib ohne x86_64 (enthält arm64), App x86_64:')],
      ['*.h im Paket', (d) => datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'Processing.NDI.Lib.h'), '#pragma once'),
        (f) => f.startsWith('SDK-Rest im Mac-Paket:') && f.endsWith('Processing.NDI.Lib.h')],
      ['*.pdf im Paket', (d) => datei(join(d, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'NDI SDK License Agreement.pdf'), '%PDF'),
        (f) => f.startsWith('SDK-Rest im Mac-Paket:') && f.endsWith('NDI SDK License Agreement.pdf')],
      ['*.pkg im Paket', (d) => datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'Install_NDI_SDK_v6_Apple.pkg'), 'xar!'),
        (f) => f.startsWith('SDK-Rest im Mac-Paket:') && f.endsWith('Install_NDI_SDK_v6_Apple.pkg')],
      ['Ordner NDI SDK for Apple im Paket', (d) => mkdirSync(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'NDI SDK for Apple'), { recursive: true }),
        (f) => f.startsWith('SDK-Rest im Mac-Paket:') && f.endsWith('NDI SDK for Apple')],
      ['Ordner zoom-bridge', (d) => mkdirSync(join(d, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'zoom-bridge'), { recursive: true }),
        (f) => f.startsWith('Ordner zoom-bridge im Mac-Paket:')],
      ['Architektur der App unlesbar', (d) => datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'MacOS', 'JM Connect'), '#!/bin/sh'),
        (f) => f.startsWith('Architektur der App nicht eindeutig (kein Mach-O-Kopf):')],
      ['beide Apps arm64', (d) => datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'MacOS', 'JM Connect'), machO('arm64')),
        (f) => f === 'je eine App arm64 und x86_64 erwartet, gefunden arm64 und arm64.'],
    ];
    for (const [name, mache, erkenne] of faelle) {
      const d = sauberMitNdi('0.4.0');
      mache(d);
      const r = pruefeMacPaket(d, { ndi: 'ja' });
      assert(!r.ok && r.fehler.some(erkenne), `C14 PK49 --ndi ja rot: ${name}`);
    }
    const d = sauberMitNdi('0.4.0');
    rmSync(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'libndi.dylib'));
    const k = lauf(d, '--ndi', 'ja');
    assert(k.status === 1 && k.stdout === '' && k.stderr.startsWith('pruefe-mac-paket: libndi.dylib fehlt:'), 'C14 PK49 Kommandozeile --ndi ja mit Fehler → Exit 1, Grund auf stderr, keine App-Zeile');
  }
  {
    // Lizenzbedingungen nach FR16 (LP5) in jeder App mit NDI, über die Prüfungen aus 22.8 (PK52, ND13) hinaus (Owner-Frage
    // OFC4, C4E15): Sonst käme ein Paket ohne LIZENZ.txt (etwa durch einen Filter in extraResources) bis ans Release und fiele
    // erst in ND13 auf. Mit --ndi nein verlangt das Prüfskript sie nicht (Tag connect-v0.3.0; Prüfordner sauber() ohne Datei).
    for (const [was, m, mache] of [
      ['fehlt', 'mac', (p) => rmSync(p)],
      ['ist leer', 'mac-arm64', (p) => datei(p, '')],
    ]) {
      const d = sauberMitNdi('0.4.0');
      const p = join(d, m, 'JM Connect.app', 'Contents', 'Resources', 'LIZENZ.txt');
      mache(p);
      const r = pruefeMacPaket(d, { ndi: 'ja' });
      assert(!r.ok && r.fehler.length === 1 && r.fehler[0] === `Lizenzbedingungen fehlen oder sind leer (LIZENZ.txt, LP5): ${p}`,
        `C14 LP5 OFC4 --ndi ja: LIZENZ.txt in der App unter ${m}/ ${was} → rot, genau dieser Fehler mit Pfad`);
    }
  }
  {
    const quelle = readFileSync(skript, 'utf8');
    const module = [...quelle.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]);
    assert(module.length >= 4 && module.every((m) => m.startsWith('node:')) && !/\bimport\(|\brequire\(/.test(quelle),
      'C14 PK49 Quelltext: nur Importe aus node:-Modulen, kein dynamischer Import, kein require (eine Datei für den Workflow)');
  }

  console.log('\npruefe-mac-paket — Fassungsprüfung und NDI-Zeile (Spec 22.7 Nr. 2, E54; PK59):');
  {
    const L = NDI_LESESTAND_WINDOWS;
    const M = NDI_LESESTAND_MAC;
    assert(L.kennzeichen === '6.3.2.0' && L.lizenz === '11ae13ae038d5af06d2fd5f9e55cbbdb97e75d2526656a0dbaa4dafcb7bf48e6'
      && L.doku === 'e9d3a84ece970f3181b23cdef6433cb205e940d28abe61d4d9d1e7477a81cc6b' && Object.isFrozen(L)
      && M.kennzeichen === '5aa101a01b00494724c60b7e1e15b5d1743bf9c68b61739c22ac54932dde95fb' && M.lizenz === '11ae13ae038d5af06d2fd5f9e55cbbdb97e75d2526656a0dbaa4dafcb7bf48e6'
      && M.doku === 'e9d3a84ece970f3181b23cdef6433cb205e940d28abe61d4d9d1e7477a81cc6b' && Object.isFrozen(M),
    'C14 E54 Lesestand Windows 6.3.2.0 mit Lizenz 11ae13ae… und Doku e9d3a84e…, Lesestand Mac 5aa101a0… (Paket), Lizenz und Doku gleich Windows, eingefroren');
    const h = (c) => c.repeat(64);
    const stand = { kennzeichen: h('a'), lizenz: h('b'), doku: h('c') };
    const gleich = pruefeNdiLesestand({ ...stand, datum: '10.04.2026' }, stand);
    assert(gleich.weiter && gleich.meldung.startsWith('Fassungsprüfung: weiter'), 'C14 PK59 alle Werte gleich dem Lesestand → weiter');
    const neu = pruefeNdiLesestand({ ...stand, kennzeichen: h('d') }, stand);
    assert(!neu.weiter && neu.meldung.includes('neue Fassung') && !neu.meldung.includes('Lizenz weicht ab') && !neu.meldung.includes('Doku weicht ab'),
      'C14 PK59 neues Kennzeichen bei gleicher Lizenz und Doku → Abbruch „neue Fassung“');
    const win = pruefeNdiLesestand({ kennzeichen: '6.3.3.0', lizenz: L.lizenz, doku: L.doku }, L);
    assert(!win.weiter && win.meldung.includes('neue Fassung (Kennzeichen 6.3.3.0, gelesen 6.3.2.0)'), 'C14 PK59 Windows: neue Dateiversion bei gleicher Lizenz und Doku → Abbruch');
    const liz = pruefeNdiLesestand({ ...stand, lizenz: h('e') }, stand);
    assert(!liz.weiter && liz.meldung.includes('Lizenz weicht ab') && !liz.meldung.includes('neue Fassung'), 'C14 PK59 abweichende Lizenz → Abbruch, nennt die Lizenz');
    const doku = pruefeNdiLesestand({ ...stand, doku: h('f') }, stand);
    assert(!doku.weiter && doku.meldung.includes('Doku weicht ab'), 'C14 PK59 abweichende Doku → Abbruch, nennt die Doku');
    const fehltBeide = pruefeNdiLesestand({ ...stand, doku: 'fehlt' }, { ...stand, doku: 'fehlt' });
    assert(fehltBeide.weiter, 'C14 PK59 Doku „fehlt“ im Lesestand und in der Messung → weiter');
    const ohneLizenz = pruefeNdiLesestand({ ...stand, lizenz: null }, stand);
    assert(!ohneLizenz.weiter && ohneLizenz.meldung.includes('Abbruch, Lizenz fehlt'), 'C14 PK59 Lizenz fehlt → Abbruch');
    const leerStand = pruefeNdiLesestand({ kennzeichen: h('1'), lizenz: h('2'), doku: h('3'), datum: '10.04.2026' }, null);
    assert(!leerStand.weiter && leerStand.meldung.includes('Abbruch, Lesestand leer')
      && [h('1'), h('2'), h('3'), '10.04.2026'].every((w) => leerStand.meldung.includes(w)),
    'C14 PK59 leerer Lesestand → Abbruch mit allen gemessenen Werten');
    const wieWin = pruefeNdiLesestand({ kennzeichen: h('1'), lizenz: L.lizenz, doku: h('3') }, null);
    assert(wieWin.meldung.includes('Lizenz gleich der unter Windows gelesenen') && wieWin.meldung.includes('Doku nicht gleich der unter Windows gelesenen')
      && leerStand.meldung.includes('Lizenz nicht gleich der unter Windows gelesenen'),
    'C14 PK59 Meldung sagt für Lizenz und Doku je, ob sie den unter Windows gelesenen gleichen');
  }
  {
    const muster = new RegExp(NDI_ZEILE_MUSTER);
    const w = { fassung: '6.3.2.0', paket: 'a'.repeat(64), laufzeit: 'b'.repeat(64), lizenz: 'c'.repeat(64), datum: '10.04.2026', doku: 'd'.repeat(64) };
    const z = macNdiZeile(w);
    assert(z === `Enthaltene NDI-Laufzeit unter macOS: 6.3.2.0 (SHA-256: Paket ${'a'.repeat(64)}, Laufzeit ${'b'.repeat(64)}, Lizenz ${'c'.repeat(64)} vom 10.04.2026, Doku ${'d'.repeat(64)})`
      && muster.test(z) && muster.test(macNdiZeile({ ...w, fassung: 'unbekannt', doku: 'fehlt' })),
    'C14 PK59 macNdiZeile baut die Zeile aus 22.7 Nr. 2; das Muster nimmt sie an, auch mit „unbekannt“ und Doku „fehlt“');
    assert(!muster.test(`${z}\nNDI_ZEILE=x`) && !muster.test(z.replace('a'.repeat(64), 'A'.repeat(64)))
      && !muster.test(z.replace(/, Doku [0-9a-f]{64}/, '')) && !muster.test(macNdiZeile({ ...w, fassung: '6.3.2.0 (Build 7)' })),
    'C14 PK59 NDI_ZEILE_MUSTER verwirft Zeilenumbruch, Hex in Großbuchstaben, fehlendes Feld und Zusatztext in der Fassung');
    assert(NDI_ZEILE_MUSTER.startsWith('^') && NDI_ZEILE_MUSTER.endsWith('$') && !/\\[dswb]|\(\?|\.\*/.test(NDI_ZEILE_MUSTER),
      'C14 PK59 NDI_ZEILE_MUSTER über die ganze Zeichenkette, nur Mittel, die auch bash liest (kein \\d, \\s, \\w, \\b, (?, .*)');
  }
  {
    /** Ein nachgebautes NDI-SDK für Apple (Orte nach AN37) samt Paket. */
    function sdk({ doku = true, version = 'NDI SDK v6.3.2.0 (Build 7)', laufzeit = true, lizenz = true } = {}) {
      const d = mkdtempSync(join(tmpdir(), 'jm-ndi-sdk-'));
      ordner.push(d);
      const w = join(d, 'NDI SDK for Apple');
      if (laufzeit) datei(join(w, 'lib', 'macOS', 'libndi.dylib'), machO('arm64', 'x86_64'));
      datei(join(w, 'include', 'Processing.NDI.Lib.h'), '#pragma once');
      datei(join(w, 'licenses', 'libndi_licenses.txt'), 'Lizenztexte');
      if (lizenz) {
        datei(join(w, 'NDI SDK License Agreement.pdf'), '%PDF Lizenz');
        const t = new Date(Date.UTC(2026, 3, 10, 12));
        utimesSync(join(w, 'NDI SDK License Agreement.pdf'), t, t);
      }
      if (doku) datei(join(w, 'Documentation', 'NDI SDK Documentation.pdf'), '%PDF Doku');
      if (version !== null) datei(join(w, 'Version.txt'), version);
      datei(join(d, 'Install_NDI_SDK_v6_Apple.pkg'), 'xar! Paket');
      return { wurzel: w, paket: join(d, 'Install_NDI_SDK_v6_Apple.pkg') };
    }
    const muster = new RegExp(NDI_ZEILE_MUSTER);
    const s = sdk();
    const k = lauf('--ndi-sdk', s.wurzel, '--ndi-paket', s.paket);
    const zeilen = k.stdout.split('\n');
    const iZeile = zeilen.findIndex((z) => z.startsWith('Enthaltene NDI-Laufzeit unter macOS: '));
    const iAbbruch = zeilen.findIndex((z) => z.startsWith('Fassungsprüfung: Abbruch, neue Fassung'));
    assert(k.status === 1 && iZeile > 0 && iAbbruch > iZeile && muster.test(zeilen[iZeile]) && zeilen[iZeile].startsWith('Enthaltene NDI-Laufzeit unter macOS: 6.3.2.0 (')
      && zeilen[iZeile].includes(' vom 10.04.2026, Doku '),
    'C14 PK59 --ndi-sdk, eingetragener Lesestand Mac (neue Fassung): die geprüfte NDI-Zeile (Fassung 6.3.2.0 aus „NDI SDK v6.3.2.0 (Build 7)“) steht vor dem Abbruch, Exit 1');
    assert(zeilen.includes('  lib/') && zeilen.includes('  lib/macOS/') && zeilen.includes('  Version.txt (26 Byte)')
      && zeilen.includes('  licenses/libndi_licenses.txt (11 Byte)') && !zeilen.some((z) => z.includes('libndi.dylib (')),
    'C14 PK59 --ndi-sdk druckt die Dateiliste der Wurzel bis zur zweiten Ebene, nur Namen und Größen');
    const ohneDoku = sdk({ doku: false, version: null });
    // Leerer Lesestand ausdrücklich (null): Der Fall fängt Probe 17 auch dann noch, wenn NDI_LESESTAND_MAC nach dem Owner-OK
    // gefüllt ist („Nach der Umsetzung“ Nr. 2).
    const r = pruefeNdiSdk(ohneDoku.wurzel, ohneDoku.paket, null);
    const zd = r.zeilen.find((z) => z.startsWith('Enthaltene NDI-Laufzeit unter macOS: '));
    assert(!r.ok && zd && muster.test(zd) && zd.startsWith('Enthaltene NDI-Laufzeit unter macOS: unbekannt (') && zd.endsWith(', Doku fehlt)'),
      'C14 PK59 ohne Doku und ohne Version.txt → Zeile mit „unbekannt“ und „Doku fehlt“, die das Muster erfüllt');
    const gemessen = pruefeNdiSdk(s.wurzel, s.paket);
    const werte = (n) => gemessen.zeilen.find((z) => z.startsWith(`SHA-256 ${n} `)).split(' ')[2];
    const stand = { kennzeichen: werte('Paket'), lizenz: werte('Lizenz'), doku: werte('Doku') };
    const weiter = pruefeNdiSdk(s.wurzel, s.paket, stand);
    assert(weiter.ok && muster.test(weiter.ndiZeile) && weiter.zeilen.at(-1).startsWith('Fassungsprüfung: weiter'),
      'C14 PK59 --ndi-sdk mit gleichem Lesestand → weiter, NDI-Zeile für die Notes');
    const ohneLaufzeit = sdk({ laufzeit: false });
    const l = lauf('--ndi-sdk', ohneLaufzeit.wurzel, '--ndi-paket', ohneLaufzeit.paket);
    assert(l.status === 1 && l.stdout.includes('Fassungsprüfung: Abbruch, Laufzeit fehlt: lib/macOS/libndi.dylib.') && !l.stdout.includes('Enthaltene NDI-Laufzeit'),
      'C14 PK59 Laufzeit fehlt → Abbruch ohne NDI-Zeile');
    const ohneLizenz = sdk({ lizenz: false });
    const z = pruefeNdiSdk(ohneLizenz.wurzel, ohneLizenz.paket, stand);
    assert(!z.ok && z.ndiZeile === null && z.zeilen.at(-1).startsWith('Fassungsprüfung: Abbruch, Lizenz fehlt'), 'C14 PK59 Lizenz fehlt im SDK → Abbruch');
    const nurSdk = lauf('--ndi-sdk', s.wurzel);
    assert(nurSdk.status === 2 && nurSdk.stderr.includes('--ndi-sdk und --ndi-paket gehören zusammen'), 'C14 --ndi-sdk ohne --ndi-paket → Exit 2');
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle pruefe-mac-paket-Tests bestanden.' : `\n${failures} pruefe-mac-paket-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
