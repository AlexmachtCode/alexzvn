// Selbsttest für scripts/ci/pruefe-mac-nachbau.mjs (Mac-Nachbau, Entwurf mac-fassungen Stufe 1). Läuft unter Linux und
// Windows: nachgebaute release-Ordner im Temp-Ordner, gefälschte Mach-O-Köpfe, und die macOS-Teile (Programmstart,
// otool) als Attrappe. Die Kommandozeile entfällt unter macOS, weil sie dort echte Werkzeuge auf die Attrappen ansetzt.
//   node scripts/ci/test/pruefe-mac-nachbau.test.mjs
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appPfade, erwarteterDmgName, leseMinos, machoArten, pruefeMacNachbau, ueberMacos11,
} from '../pruefe-mac-nachbau.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const skript = join(hier, '..', 'pruefe-mac-nachbau.mjs');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}
const sha = (inhalt) => createHash('sha256').update(inhalt).digest('hex');

// Mach-O-Köpfe: x64 wie gemessen an node_modules/ffprobe-static/bin/darwin/arm64/ffprobe (cf fa ed fe 07 00 00 01).
const KOPF = {
  x64: Buffer.from('cffaedfe07000001030000800200000000000000', 'hex'),
  arm64: Buffer.from('cffaedfe0c000001000000000200000000000000', 'hex'),
};
function fat(groesse, ...cpus) {
  const b = Buffer.alloc(8 + cpus.length * groesse);
  b.writeUInt32BE(groesse === 20 ? 0xcafebabe : 0xcafebabf, 0);
  b.writeUInt32BE(cpus.length, 4);
  cpus.forEach((c, i) => b.writeUInt32BE(c, 8 + i * groesse));
  return b;
}
const CPU = { x64: 0x01000007, arm64: 0x0100000c };

const ORDNER = { arm64: 'mac-arm64', x64: 'mac' };
const ordner = [];
/**
 * Ein release-Ordner wie von electron-builder 24.13.3 mit --mac dmg --<art>: ein DMG samt Beiwerk und eine .app. ffmpeg in
 * der Art des Jobs, ffprobe immer x64 (ffprobe-static 3.1.0). Liefert Ordner, Inhalte und den passenden Lesestand.
 */
function bau(art, { ffmpegKopf = KOPF[art], ffprobeKopf = KOPF.x64, programmKopf = KOPF[art] } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'jm-mac-nachbau-'));
  ordner.push(d);
  datei(join(d, `JM Editor-0.5.0-mac-${art}.dmg`), 'dmg');
  datei(join(d, `JM Editor-0.5.0-mac-${art}.dmg.blockmap`), 'x');
  datei(join(d, 'latest-mac.yml'), 'x');
  datei(join(d, 'builder-debug.yml'), 'x');
  const inhalt = { ffmpeg: Buffer.concat([ffmpegKopf, Buffer.from(`ffmpeg-${art}`)]), ffprobe: Buffer.concat([ffprobeKopf, Buffer.from('ffprobe')]) };
  const c = join(d, ORDNER[art], 'JM Editor.app', 'Contents');
  datei(join(c, 'MacOS', 'JM Editor'), programmKopf);
  datei(join(c, 'Resources', 'bin', 'mac', 'ffmpeg'), inhalt.ffmpeg);
  datei(join(c, 'Resources', 'bin', 'mac', 'ffprobe'), inhalt.ffprobe);
  datei(join(c, 'Resources', 'app.asar'), 'asar');
  const lesestand = { editor: { '0.5.0': { [art]: { ffmpeg: sha(inhalt.ffmpeg), ffprobe: sha(inhalt.ffprobe) } } } };
  return { d, inhalt, lesestand };
}
const optionen = (art, b, mehr = {}) => ({ release: b.d, app: 'editor', version: '0.5.0', art, lesestand: b.lesestand, probe: false, ...mehr });

const BUILD = 'Load command 9\n      cmd LC_BUILD_VERSION\n  cmdsize 32\n platform 1\n    minos 11.0\n      sdk 14.0\n   ntools 1\n     tool 3\n  version 1015.7\n';
const ALT = 'Load command 8\n      cmd LC_VERSION_MIN_MACOSX\n  cmdsize 16\n  version 10.9\n      sdk 10.15\n';
/** macOS-Attrappe: protokolliert jeden Aufruf; Rückgabe und otool-Text lassen sich je Fall setzen. */
function attrappe({ status = 0, error = undefined, otool = BUILD } = {}) {
  const aufrufe = [];
  return {
    aufrufe,
    starte(pfad, args) {
      aufrufe.push(`starte ${pfad.split(/[\\/]/).pop()} ${args.join(' ')}`);
      return { status, error, stdout: 'ffmpeg version 6.1.1 Copyright (c) 2000-2023\nweiter', stderr: status ? 'dyld: Bad CPU type' : '' };
    },
    otool(pfad, arch) {
      aufrufe.push(`otool ${arch} ${pfad.split(/[\\/]/).pop()}`);
      return otool;
    },
  };
}

try {
  console.log('pruefe-mac-nachbau — Mach-O-Kopf, minos, Namen:');
  assert(JSON.stringify(machoArten(KOPF.x64)) === '["x64"]', 'N1: dünnes x86_64 (cf fa ed fe 07 00 00 01) → x64');
  assert(JSON.stringify(machoArten(KOPF.arm64)) === '["arm64"]', 'N1: dünnes arm64 (cf fa ed fe 0c 00 00 01) → arm64');
  assert(JSON.stringify(machoArten(fat(20, CPU.x64, CPU.arm64))) === '["x64","arm64"]', 'N1: Fat/Universal (cafebabe) → beide Arten');
  assert(JSON.stringify(machoArten(fat(32, CPU.arm64))) === '["arm64"]', 'N1: Fat mit 64-Bit-Einträgen (cafebabf) → arm64');
  assert(JSON.stringify(machoArten(Buffer.from('cffaedfe0c000000', 'hex'))) === '["unbekannt:0x0000000c"]', 'N1: unbekannter CPU-Typ wird benannt, nicht geraten');
  // 4096 Bytes wie kopfVon im Prüfer: Nur so trägt der Schutz n > 30, sonst fiele die Klasse schon an der Länge durch.
  assert(machoArten(Buffer.concat([Buffer.from('cafebabe00000034', 'hex'), Buffer.alloc(4088)])) === null, 'N1: Java-Klasse (cafebabe, Fassung 52, 4096 Bytes) → kein Mach-O');
  assert(machoArten(Buffer.from('#!/bin/sh\n')) === null && machoArten(Buffer.from('cffa', 'hex')) === null, 'N1: Skript und zu kurzer Kopf → kein Mach-O');
  assert(leseMinos(BUILD) === '11.0', 'N2: LC_BUILD_VERSION → minos 11.0 (nicht die Werkzeug-Fassung 1015.7)');
  assert(leseMinos(ALT) === '10.9', 'N2: LC_VERSION_MIN_MACOSX → version 10.9');
  assert(leseMinos(ALT + BUILD.replace('11.0', '12.0')) === '12.0', 'N2: beide da → LC_BUILD_VERSION gilt');
  assert(leseMinos(BUILD.replace(/\n/g, '\r\n')) === '11.0' && leseMinos('') === null, 'N2: CRLF gelesen, leere Ausgabe → null');
  assert(!ueberMacos11('11.0') && !ueberMacos11('10.9') && ueberMacos11('11.1') && ueberMacos11('12.0'), 'N2: über macOS 11 heißt größer als 11.0');
  assert(erwarteterDmgName('editor', '0.5.0', 'arm64') === 'JM Editor-0.5.0-mac-arm64.dmg', 'N3: DMG-Name wie artifactName und Katalog');
  assert(appPfade('/r', 'editor', 'arm64').ffmpeg === join('/r', 'mac-arm64', 'JM Editor.app', 'Contents', 'Resources', 'bin', 'mac', 'ffmpeg')
    && appPfade('/r', 'editor', 'x64').programm === join('/r', 'mac', 'JM Editor.app', 'Contents', 'MacOS', 'JM Editor'),
  'N3: Pfade in der App (release/mac-arm64 bzw. release/mac, bin/mac aus extraResources)');

  console.log('pruefe-mac-nachbau — Ablauf am nachgebauten release-Ordner:');
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64')), null);
    assert(r.ok && r.fehler.length === 0 && r.warnungen.length === 0, 'N4: sauberer arm64-Bau mit passendem Lesestand → in Ordnung');
    assert(r.hinweise.some((h) => h.startsWith('Ausnahme: ffprobe ist ein Intel-Programm (x86_64)')), 'N4: ffprobe x86_64 im arm64-Paket → gedruckte Ausnahme, kein Abbruch');
    assert(r.hinweise.includes('macOS-Teile (Laufzeitprobe, minos) übersprungen: nur unter macOS.'), 'N4: ohne macOS → Hinweis, dass Laufzeitprobe und minos fehlen');
  }
  {
    const r = pruefeMacNachbau(optionen('x64', bau('x64')), null);
    assert(r.ok && !r.hinweise.some((h) => h.startsWith('Ausnahme:')), 'N5: sauberer x64-Bau → in Ordnung, ohne Ausnahme');
  }
  {
    const b = bau('arm64');
    datei(join(b.d, 'JM Editor-0.5.0-mac-x64.dmg'), 'dmg');
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.includes('genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 2: JM Editor-0.5.0-mac-arm64.dmg, JM Editor-0.5.0-mac-x64.dmg.'),
      'N6 Gegenprobe: zwei DMGs (ohne Zielnamen baute --arm64 beide) → rot');
  }
  {
    const b = bau('x64');
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler[0] === 'genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 1: JM Editor-0.5.0-mac-x64.dmg.'
      && r.fehler[1] === 'genau eine App „mac-arm64/JM Editor.app“ erwartet, gefunden 1: mac/JM Editor.app.',
    'N7 Gegenprobe: x64-Bau im arm64-Job → rot (DMG und App der falschen Art)');
  }
  {
    const b = bau('arm64');
    datei(join(b.d, 'mac', 'JM Editor.app', 'Contents', 'MacOS', 'JM Editor'), KOPF.x64);
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0] === 'genau eine App „mac-arm64/JM Editor.app“ erwartet, gefunden 2: mac-arm64/JM Editor.app, mac/JM Editor.app.',
      'N8 Gegenprobe: zwei .app → rot, und nichts weiter geprüft');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffmpegKopf: KOPF.x64 })), null);
    assert(!r.ok && r.fehler.includes('ffmpeg hat x64, erwartet arm64 (die Mac-Art der App).'), 'N9 Gegenprobe: x64-ffmpeg im arm64-Paket → rot');
    const s = pruefeMacNachbau(optionen('x64', bau('x64', { ffmpegKopf: KOPF.arm64 })), null);
    assert(!s.ok && s.fehler.includes('ffmpeg hat arm64, erwartet x64 (die Mac-Art der App).'), 'N9 Gegenprobe: arm64-ffmpeg im Intel-Paket (Juni-Fehler) → rot');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffmpegKopf: fat(20, CPU.x64, CPU.arm64) })), null);
    assert(r.ok, 'N10: universelles ffmpeg (x64+arm64) enthält die Art → in Ordnung');
  }
  {
    const r = pruefeMacNachbau(optionen('x64', bau('x64', { ffprobeKopf: KOPF.arm64 })), null);
    assert(!r.ok && r.fehler.includes('ffprobe hat arm64, erwartet x64.'), 'N11 Gegenprobe: arm64-ffprobe im Intel-Paket → rot (dort gibt es keine Ausnahme)');
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64', { ffprobeKopf: Buffer.from('#!/bin/sh\nexit 0\n') })), null);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('ffprobe ist kein Mach-O-Programm:')), 'N11 Gegenprobe: ffprobe kein Mach-O → rot');
  }
  {
    const b = bau('arm64');
    rmSync(join(b.d, 'mac-arm64', 'JM Editor.app', 'Contents', 'Resources', 'bin', 'mac', 'ffmpeg'));
    const r = pruefeMacNachbau(optionen('arm64', b), null);
    assert(!r.ok && r.fehler.some((f) => f.startsWith('ffmpeg fehlt:')), 'N11 Gegenprobe: ffmpeg fehlt im Paket → rot');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64', { programmKopf: KOPF.x64 })), null);
    assert(!r.ok && r.fehler.includes('App-Programm hat x64, erwartet arm64.'), 'N12 Gegenprobe: App-Programm der falschen Art → rot');
  }

  console.log('pruefe-mac-nachbau — Lesestand (SHA-256 von ffmpeg und ffprobe):');
  {
    const b = bau('arm64');
    b.lesestand.editor['0.5.0'].arm64.ffmpeg = '0'.repeat(64);
    for (const probe of [false, true]) {
      const r = pruefeMacNachbau(optionen('arm64', b, { probe }), null);
      assert(!r.ok && r.fehler.includes(`SHA-256 von ffmpeg weicht vom Lesestand ab: gemessen ${sha(b.inhalt.ffmpeg)}, Lesestand ${'0'.repeat(64)}.`),
        `N13 Gegenprobe: ffmpeg weicht vom Lesestand ab → rot (probe=${probe})`);
    }
  }
  {
    const b = bau('x64');
    const vorschlag = JSON.stringify({ editor: { '0.5.0': { x64: { ffmpeg: sha(b.inhalt.ffmpeg), ffprobe: sha(b.inhalt.ffprobe) } } } });
    const r = pruefeMacNachbau(optionen('x64', b, { lesestand: {}, probe: true }), null);
    assert(r.ok && r.warnungen.length === 1 && r.warnungen[0].startsWith('Lesestand für editor 0.5.0 x64 ist leer.')
      && r.warnungen[0].endsWith(`Zum Nachtragen (mit Owner-OK): ${vorschlag}`), 'N14: leerer Lesestand im Probe-Lauf → Warnung mit den gemessenen Werten, kein Abbruch');
    assert(r.gemessen.ffmpeg === sha(b.inhalt.ffmpeg) && r.gemessen.ffprobe === sha(b.inhalt.ffprobe), 'N14: gemessene SHA-256 im Ergebnis');
    const s = pruefeMacNachbau(optionen('x64', b, { lesestand: {}, probe: false }), null);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Lesestand für editor 0.5.0 x64 ist leer; ohne Lesestand wird nicht hochgeladen.')),
      'N14 Gegenprobe: leerer Lesestand im echten Lauf → rot');
  }
  {
    const b = bau('arm64');
    delete b.lesestand.editor['0.5.0'].arm64.ffprobe;
    const r = pruefeMacNachbau(optionen('arm64', b, { probe: true }), null);
    assert(!r.ok && r.fehler.includes('Lesestand für editor 0.5.0 arm64 ist unvollständig oder ungültig (erwartet ffmpeg und ffprobe als SHA-256 in Kleinbuchstaben).'),
      'N15 Gegenprobe: halber Lesestand-Eintrag → rot, auch im Probe-Lauf');
  }

  console.log('pruefe-mac-nachbau — macOS-Teile (Attrappe):');
  {
    const m = attrappe();
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64')), m);
    assert(r.ok && JSON.stringify(m.aufrufe) === JSON.stringify(['starte ffmpeg -version', 'otool arm64 JM Editor', 'otool arm64 ffmpeg']),
      'N16: arm64-Job startet nur ffmpeg und liest minos von App-Programm und ffmpeg (otool -arch arm64)');
    assert(r.hinweise.includes('Laufzeitprobe ffmpeg: ffmpeg version 6.1.1 Copyright (c) 2000-2023')
      && r.hinweise.includes('Laufzeitprobe ffprobe nur im Intel-Job (x64).') && r.hinweise.includes('minos App-Programm: 11.0'),
    'N16: Laufzeitprobe und minos werden gedruckt');
  }
  {
    const m = attrappe({ otool: ALT });
    const r = pruefeMacNachbau(optionen('x64', bau('x64')), m);
    assert(r.ok && JSON.stringify(m.aufrufe) === JSON.stringify(['starte ffmpeg -version', 'starte ffprobe -version', 'otool x86_64 JM Editor', 'otool x86_64 ffmpeg'])
      && r.hinweise.includes('minos ffmpeg: 10.9') && r.warnungen.length === 0, 'N16: Intel-Job startet auch ffprobe; minos 10.9 → keine Warnung');
  }
  {
    const r = pruefeMacNachbau(optionen('arm64', bau('arm64')), attrappe({ otool: BUILD.replace('11.0', '12.0') }));
    assert(r.ok && r.warnungen.includes('minos von ffmpeg ist 12.0, also über macOS 11 (Electron 33 läuft ab macOS 11).'),
      'N16: minos über macOS 11 → Warnung, kein Abbruch');
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64')), attrappe({ otool: '' }));
    assert(s.ok && s.warnungen.includes('minos von App-Programm nicht lesbar (otool -l).'), 'N16: otool liefert nichts → Warnung');
  }
  {
    const r = pruefeMacNachbau(optionen('x64', bau('x64')), attrappe({ status: 1 }));
    assert(!r.ok && r.fehler.includes('Laufzeitprobe: ffmpeg -version endete mit Rückgabe 1 (dyld: Bad CPU type).')
      && r.fehler.includes('Laufzeitprobe: ffprobe -version endete mit Rückgabe 1 (dyld: Bad CPU type).'), 'N16 Gegenprobe: Programm startet nicht → rot');
    const e = Object.assign(new Error('spawnSync EACCES'), { code: 'EACCES' });
    const s = pruefeMacNachbau(optionen('arm64', bau('arm64')), attrappe({ status: null, error: e }));
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Laufzeitprobe: ffmpeg -version endete mit EACCES')), 'N16 Gegenprobe: nicht ausführbar (EACCES) → rot');
  }
  {
    const r = pruefeMacNachbau({ release: join(tmpdir(), 'jm-mac-nachbau-gibt-es-nicht'), app: 'editor', version: '0.5.0', art: 'x64', lesestand: {}, probe: true }, null);
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0].startsWith('Ordner „'), 'N17: release-Ordner fehlt → rot');
  }

  if (process.platform === 'darwin') {
    console.log('  --  N18 (Kommandozeile) übersprungen: unter macOS liefen echte Werkzeuge gegen die Attrappen.');
  } else {
    console.log('pruefe-mac-nachbau — Kommandozeile:');
    const lauf = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8' });
    const stand = (b) => {
      const p = join(b.d, '..', `${b.d.split(/[\\/]/).pop()}-lesestand.json`);
      ordner.push(p);
      writeFileSync(p, JSON.stringify(b.lesestand));
      return p;
    };
    const args = (art, b, lesestand) => ['--app', 'editor', '--version', '0.5.0', '--art', art, '--release', b.d, '--lesestand', lesestand];
    {
      const b = bau('arm64');
      const k = lauf(...args('arm64', b, stand(b)));
      assert(k.status === 0 && k.stdout.includes('pruefe-mac-nachbau: in Ordnung (editor 0.5.0 arm64).')
        && k.stdout.includes('pruefe-mac-nachbau: macOS-Teile (Laufzeitprobe, minos) übersprungen: nur unter macOS.'), 'N18: sauber → Exit 0, Hinweise auf stdout');
    }
    {
      const b = bau('arm64');
      datei(join(b.d, 'JM Editor-0.5.0-mac-x64.dmg'), 'dmg');
      const k = lauf(...args('arm64', b, stand(b)));
      assert(k.status === 1 && k.stderr.includes('pruefe-mac-nachbau: genau ein DMG „JM Editor-0.5.0-mac-arm64.dmg“ erwartet, gefunden 2'),
        'N18 Gegenprobe: zwei DMGs → Exit 1, Grund auf stderr');
    }
    {
      const b = bau('x64');
      const leer = join(b.d, '..', `${b.d.split(/[\\/]/).pop()}-leer.json`);
      ordner.push(leer);
      writeFileSync(leer, '{}\n');
      const probe = lauf(...args('x64', b, leer), '--probe');
      const echt = lauf(...args('x64', b, leer));
      assert(probe.status === 0 && probe.stdout.includes('::warning::pruefe-mac-nachbau: Lesestand für editor 0.5.0 x64 ist leer.')
        && probe.stdout.includes('pruefe-mac-nachbau: in Ordnung (editor 0.5.0 x64, Probe).') && echt.status === 1,
      'N18: leerer Lesestand → mit --probe Exit 0 und ::warning::, ohne --probe Exit 1');
      const kaputt = lauf(...args('x64', b, join(b.d, 'gibt-es-nicht.json')));
      assert(kaputt.status === 1 && kaputt.stderr.includes('pruefe-mac-nachbau: Lesestand „'), 'N18 Gegenprobe: Lesestand unlesbar → Exit 1');
    }
    {
      const b = bau('x64');
      const ohne = lauf();
      const app = lauf('--app', 'titler', '--version', '0.12.1', '--art', 'x64', '--release', b.d, '--lesestand', 'x.json');
      const art = lauf('--app', 'editor', '--version', '0.5.0', '--art', 'universal', '--release', b.d, '--lesestand', 'x.json');
      const fremd = lauf('--app', 'editor', '--version', '0.5.0', '--art', 'x64', '--release', b.d, '--lesestand', 'x.json', '--hochladen');
      const version = lauf('--app', 'editor', '--version', '0.5', '--art', 'x64', '--release', b.d, '--lesestand', 'x.json');
      assert([ohne, app, art, fremd, version].every((k) => k.status === 2)
        && app.stderr.includes('pruefe-mac-nachbau: App „titler“ ist nicht freigegeben (bekannt: editor).'),
      'N18 Gegenprobe: falscher Aufruf (nichts, App titler, Art universal, fremde Option, Version 0.5) → Exit 2');
    }
    {
      // Wie pruefe-mac-paket (EP7): über einen Ordner-Link aufgerufen muss das Skript prüfen, statt still mit Exit 0 zu enden.
      const echt = mkdtempSync(join(tmpdir(), 'jm-mac-nachbau-skript-'));
      ordner.push(echt);
      copyFileSync(skript, join(echt, 'pruefe-mac-nachbau.mjs'));
      const linkOrdner = mkdtempSync(join(tmpdir(), 'jm-mac-nachbau-link-'));
      const link = join(linkOrdner, 'werkzeug');
      symlinkSync(echt, link, 'junction');
      try {
        const ohne = spawnSync(process.execPath, [join(link, 'pruefe-mac-nachbau.mjs')], { encoding: 'utf8' });
        const b = bau('arm64');
        datei(join(b.d, 'JM Editor-0.5.0-mac-x64.dmg'), 'dmg');
        const schlecht = spawnSync(process.execPath, [join(link, 'pruefe-mac-nachbau.mjs'), ...args('arm64', b, stand(b))], { encoding: 'utf8' });
        assert(ohne.status === 2 && schlecht.status === 1, 'N18: Aufruf über einen Ordner-Link → prüft (Exit 2 ohne Argumente, 1 bei zwei DMGs), nie still Exit 0');
      } finally {
        unlinkSync(link);
        rmSync(linkOrdner, { recursive: true, force: true });
      }
    }
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle pruefe-mac-nachbau-Tests bestanden.' : `\n${failures} pruefe-mac-nachbau-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
