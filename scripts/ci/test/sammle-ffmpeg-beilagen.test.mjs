// Selbsttest für scripts/ci/sammle-ffmpeg-beilagen.mjs (Mac-Nachbau, F2 (ii)): nachgebautes ffmpeg-static im Temp-Ordner,
// dazu die Namensprobe gegen die echte Paketwahl des Proxys (services/release-proxy/paketwahl.js; der Launcher hat dieselbe
// Regel in apps/launcher/src/main/release-wahl.ts, beide prüfen test/paketwahl-faelle.json) und der Wortlaut des Hinweises.
//   node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waehleRelease } from '../../../services/release-proxy/paketwahl.js';
import { appPfade } from '../pruefe-mac-nachbau.mjs';
import { beilagenNamen, sammleFfmpegBeilagen } from '../sammle-ffmpeg-beilagen.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const skript = join(hier, '..', 'sammle-ffmpeg-beilagen.mjs');
const hinweisImRepo = join(hier, '..', 'ffmpeg-quellen-hinweis.txt');

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
/** Byte für Byte gleich; fehlt eine Seite, ist das ungleich und kein Absturz. */
const gleich = (a, b) => existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));

/** Wie ein GPL-Volltext: Kopf, Schluss und `bytes` Bytes (gemessen: GPLv2 17 984 B, GPLv3 35 147 B). */
function gplText({ kopf = '                    GNU GENERAL PUBLIC LICENSE', bytes = 18000, schluss = true } = {}) {
  const anfang = `${kopf}\r\n                       Version 3, 29 June 2007\r\n\r\n                       TERMS AND CONDITIONS\r\n\r\n`;
  const ende = schluss ? '\r\n                     END OF TERMS AND CONDITIONS\r\n' : '\r\n';
  const zeile = '  Absatz der Lizenz.\r\n';
  const rest = bytes - anfang.length - ende.length;
  return anfang + zeile.repeat(Math.floor(rest / zeile.length)) + ' '.repeat(rest % zeile.length) + ende;
}
const GPL = gplText();
const README = 'FFmpeg 64-bit static build\n\nVersion: 6.1.1\n';
const HINWEIS = 'Hinweis\n';
/** So ungefähr sieht FFmpegs LICENSE.md aus (sinngemäß); 4 316 B wie R1 der Prüfung, Release b6.1.1 hat 4 346 bzw. 4 376 B. */
const LIZENZ_MD = (() => {
  const kopf = '# License\n\nMost files in FFmpeg are under the GNU Lesser General Public License version 2.1\nor later (LGPL v2.1+).\n';
  const zeile = 'Einige optionale Teile stehen unter der GPL.\n';
  const rest = 4316 - kopf.length;
  return kopf + zeile.repeat(Math.floor(rest / zeile.length)) + '-'.repeat(rest % zeile.length);
})();

const ordner = [];
/** ffmpeg-static nach npm ci auf einem Mac (install.js legt ffmpeg, ffmpeg.LICENSE, ffmpeg.README), dazu die App. */
function lage(art = 'arm64', { version = '5.3.0', release = 'b6.1.1', lizenz = GPL } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-'));
  ordner.push(d);
  const fs = join(d, 'node_modules', 'ffmpeg-static');
  datei(join(fs, 'package.json'), JSON.stringify({ name: 'ffmpeg-static', version, 'ffmpeg-static': { 'binary-release-tag': release } }));
  datei(join(fs, 'ffmpeg'), `ffmpeg-${art}`);
  datei(join(fs, 'ffmpeg.LICENSE'), lizenz);
  datei(join(fs, 'ffmpeg.README'), README);
  const release1 = join(d, 'apps', 'editor', 'release');
  datei(appPfade(release1, 'editor', art).ffmpeg, `ffmpeg-${art}`);
  datei(join(d, 'hinweis.txt'), HINWEIS);
  return {
    d, ffmpegStatic: fs, release: release1,
    optionen: { ffmpegStatic: fs, appFfmpeg: appPfade(release1, 'editor', art).ffmpeg, hinweis: join(d, 'hinweis.txt'), ziel: join(d, 'paket'), art, env: {} },
  };
}

try {
  console.log('sammle-ffmpeg-beilagen — Namen gegen die Paketwahl:');
  {
    const n = beilagenNamen('arm64');
    assert(n.lizenz === 'ffmpeg-mac-arm64.LICENSE.txt' && n.angaben === 'ffmpeg-mac-arm64.README.txt' && n.quellen === 'ffmpeg-QUELLEN.txt',
      'B1: Beilagen-Namen je Art (LICENSE, README) und ein Quellen-Hinweis');
    const beilagen = ['x64', 'arm64'].flatMap((a) => Object.values(beilagenNamen(a)));
    const asset = (name) => ({ name });
    const voll = [{
      tag_name: 'editor-v0.5.0', draft: false,
      assets: ['JM.Editor-0.5.0-win-x64.exe', 'JM.Editor-0.5.0-mac-x64.dmg', 'JM.Editor-0.5.0-mac-arm64.dmg', ...beilagen].map(asset),
    }];
    const w = (rel, p, a) => waehleRelease(rel, 'editor-v', p, a);
    assert(w(voll, 'mac', 'arm64').asset?.name === 'JM.Editor-0.5.0-mac-arm64.dmg' && w(voll, 'mac', 'x64').asset?.name === 'JM.Editor-0.5.0-mac-x64.dmg'
      && w(voll, 'win', 'x64').asset?.name === 'JM.Editor-0.5.0-win-x64.exe', 'B2: Release mit DMGs, exe und Beilagen → die Paketwahl nimmt DMG bzw. exe');
    const nurBeilagen = [{ tag_name: 'editor-v0.5.0', draft: false, assets: beilagen.map(asset) }];
    assert(['arm64', 'x64'].every((a) => w(nurBeilagen, 'mac', a).art === 'kein-paket') && w(nurBeilagen, 'win', 'x64').art === 'kein-paket',
      'B2 Gegenprobe: Release nur mit Beilagen → kein Paket für Mac (arm64, x64) und Windows; keine Beilage passt aufs Paketmuster');
  }

  console.log('sammle-ffmpeg-beilagen — Einsammeln:');
  {
    const l = lage('arm64');
    const r = sammleFfmpegBeilagen(l.optionen);
    const z = l.optionen.ziel;
    // Ohne Zielordner eine FAIL-Zeile statt eines Absturzes, der alle folgenden Prüfungen verschluckte.
    const ziel = existsSync(z) ? readdirSync(z).sort() : [];
    // Die drei Quellen unterscheiden sich; nur so fällt eine vertauschte Kopie auf.
    assert(new Set([GPL, README, HINWEIS]).size === 3 && r.ok
      && JSON.stringify(ziel) === JSON.stringify(['ffmpeg-QUELLEN.txt', 'ffmpeg-mac-arm64.LICENSE.txt', 'ffmpeg-mac-arm64.README.txt'])
      && gleich(join(z, 'ffmpeg-mac-arm64.LICENSE.txt'), join(l.ffmpegStatic, 'ffmpeg.LICENSE'))
      && gleich(join(z, 'ffmpeg-mac-arm64.README.txt'), join(l.ffmpegStatic, 'ffmpeg.README'))
      && gleich(join(z, 'ffmpeg-QUELLEN.txt'), l.optionen.hinweis), 'B3: sauber → genau drei Dateien, jede Byte für Byte aus ihrer Quelle');
    const s = r.steckbrief ?? [];
    const iReadme = s.indexOf(`ffmpeg.README: ${README.length} B, SHA-256 ${sha(README)}`);
    assert(s[0] === `ffmpeg.LICENSE: ${GPL.length} B, SHA-256 ${sha(GPL)}` && s[1] === '  | GNU GENERAL PUBLIC LICENSE'
      && iReadme >= 2 && iReadme <= 11 && s[iReadme + 1] === '  | FFmpeg 64-bit static build' && s[iReadme + 2] === '  | Version: 6.1.1',
    'B3: Steckbrief fürs Protokoll (Größe, SHA-256 und Anfang von LICENSE und README, je höchstens 10 Zeilen)');
  }
  {
    const l = lage();
    rmSync(join(l.ffmpegStatic, 'ffmpeg.LICENSE'));
    rmSync(join(l.ffmpegStatic, 'ffmpeg.README'));
    const r = sammleFfmpegBeilagen(l.optionen);
    assert(!r.ok && r.fehler.some((f) => f.startsWith('fehlt: ') && f.endsWith('ffmpeg.LICENSE')) && r.fehler.some((f) => f.endsWith('ffmpeg.README'))
      && readdirSync(l.d).every((n) => n !== 'paket'), 'B4 Gegenprobe: install.js hat LICENSE und README nicht geladen (404 = nur Warnung) → rot, nichts kopiert');
  }
  {
    const l = lage();
    writeFileSync(l.optionen.appFfmpeg, 'ffmpeg-anders');
    const r = sammleFfmpegBeilagen(l.optionen);
    assert(!r.ok && r.fehler.includes('ffmpeg im Paket ist nicht das aus ffmpeg-static; LICENSE und README gehörten dann zu einem anderen Programm.'),
      'B5 Gegenprobe: ffmpeg im Paket weicht von ffmpeg-static ab → rot');
  }
  {
    const a = sammleFfmpegBeilagen(lage('x64', { version: '5.2.0' }).optionen);
    const b = sammleFfmpegBeilagen(lage('x64', { release: 'b6.0' }).optionen);
    assert(!a.ok && a.fehler.includes('ffmpeg-static 5.2.0, der Quellen-Hinweis ist für 5.3.0 geschrieben.')
      && !b.ok && b.fehler.includes('Binär-Release b6.0, der Quellen-Hinweis ist für b6.1.1 geschrieben.'),
    'B6 Gegenprobe: andere ffmpeg-static-Fassung oder anderes Binär-Release → rot (der Hinweis nennt 5.3.0 und b6.1.1)');
  }
  // Fest geschrieben, nicht aus UMLENKUNGEN abgeleitet: index.js:16-17 und install.js:163-172 von ffmpeg-static 5.3.0.
  for (const v of ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL']) {
    const r = sammleFfmpegBeilagen({ ...lage().optionen, env: { [v]: 'x' } });
    assert(!r.ok && r.fehler.includes(`${v} ist gesetzt; der Quellen-Hinweis gilt nur für das Standard-Release von ffmpeg-static.`),
      `B7 Gegenprobe: Umlenkung per ${v} → rot`);
  }
  {
    // Je Fall fehlt genau ein Merkmal des Volltexts, damit jede Teilprüfung allein rot werden kann.
    const ein = (lizenz) => sammleFfmpegBeilagen(lage('arm64', { lizenz }).optionen).fehler;
    const kopf = ein(gplText({ kopf: '                  GNU LESSER GENERAL PUBLIC LICENSE' }));
    assert(JSON.stringify(kopf) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: erste Zeile „GNU LESSER GENERAL PUBLIC LICENSE“ ohne GNU GENERAL PUBLIC LICENSE.']),
      'B8 Gegenprobe: LGPL-Volltext (Länge und Schluss passen) → rot wegen der ersten Zeile');
    const kurz = ein(gplText({ kopf: 'GNU GENERAL PUBLIC LICENSE (Auszug)', bytes: 4337 }));
    assert(JSON.stringify(kurz) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: 4337 B statt mindestens 15000 B.']),
      'B8 Gegenprobe (R2): 4 337 B mit GPL-Kopf und Schluss → rot wegen der Länge');
    const ohneSchluss = ein(gplText({ schluss: false }));
    assert(JSON.stringify(ohneSchluss) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: ohne Schluss END OF TERMS AND CONDITIONS.']),
      'B8 Gegenprobe: GPL-Kopf und Länge, aber ohne Schluss → rot');
    const md = ein(LIZENZ_MD);
    assert(JSON.stringify(md) === JSON.stringify(['ffmpeg.LICENSE ist kein GPL-Volltext: erste Zeile „# License“ ohne GNU GENERAL PUBLIC LICENSE; '
      + '4316 B statt mindestens 15000 B; ohne Schluss END OF TERMS AND CONDITIONS.']), 'B8 Gegenprobe (R1): Text wie FFmpegs LICENSE.md → rot, alle drei Mängel genannt');
  }
  for (const [inhalt, name] of [['', 'leer'], ['\n\n \r\n\t\n', 'nur Leerzeilen']]) {
    const l = lage();
    writeFileSync(l.optionen.hinweis, inhalt);
    const s = sammleFfmpegBeilagen(l.optionen);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Quellen-Hinweis fehlt oder ist leer:')), `B8 Gegenprobe: Quellen-Hinweis ${name} → rot`);
  }

  console.log('sammle-ffmpeg-beilagen — Kommandozeile und Hinweis im Repo:');
  {
    const env = { ...process.env };
    for (const v of ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL']) delete env[v];
    const lauf = (args, mitEnv = env) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8', env: mitEnv });
    const argsFuer = (l, art) => ['--app', 'editor', '--art', art, '--release', l.release, '--ffmpeg-static', l.ffmpegStatic,
      '--hinweis', l.optionen.hinweis, '--ziel', l.optionen.ziel];
    const l = lage('x64');
    const args = argsFuer(l, 'x64');
    const gut = lauf(args);
    assert(gut.status === 0 && gut.stdout.includes('sammle-ffmpeg-beilagen: in Ordnung (ffmpeg-mac-x64.LICENSE.txt, ffmpeg-mac-x64.README.txt, ffmpeg-QUELLEN.txt).')
      && gut.stdout.includes(`sammle-ffmpeg-beilagen: ffmpeg.README: ${README.length} B, SHA-256 ${sha(README)}\n`),
    'B9: Kommandozeile sauber → Exit 0, Steckbrief im Protokoll');
    rmSync(join(l.ffmpegStatic, 'ffmpeg.LICENSE'));
    const schlecht = lauf(args);
    const ohne = lauf([]);
    const app = lauf(args.map((a) => (a === 'editor' ? 'titler' : a)));
    assert(schlecht.status === 1 && schlecht.stderr.includes('sammle-ffmpeg-beilagen: fehlt: ') && ohne.status === 2 && app.status === 2,
      'B9 Gegenprobe: Kommandozeile mit fehlender LICENSE → Exit 1; ohne Argumente oder fremde App → Exit 2');

    // Die Kommandozeile muss die echte Umgebung durchreichen; der Workflow ruft genau sie auf.
    const u = lage('x64');
    const umgelenkt = lauf(argsFuer(u, 'x64'), { ...env, FFMPEG_BINARY_RELEASE: 'b9.9' });
    assert(umgelenkt.status === 1 && umgelenkt.stderr.includes('sammle-ffmpeg-beilagen: FFMPEG_BINARY_RELEASE ist gesetzt;')
      && !existsSync(u.optionen.ziel), 'B7 Gegenprobe (Kommandozeile): FFMPEG_BINARY_RELEASE in der Umgebung → Exit 1, nichts kopiert');

    // Bricht der Sammler ab, muss das Protokoll schon die Grundlage für den Entscheid tragen (Prüfung Task 2, W1).
    const m = lage('arm64', { lizenz: LIZENZ_MD });
    const abbruch = lauf(argsFuer(m, 'arm64'));
    assert(abbruch.status === 1
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen: ffmpeg.LICENSE ist kein GPL-Volltext: erste Zeile „# License“')
      && abbruch.stderr.includes(`sammle-ffmpeg-beilagen: ffmpeg.LICENSE: 4316 B, SHA-256 ${sha(LIZENZ_MD)}\n`)
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen:   | # License\n')
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen:   | or later (LGPL v2.1+).\n')
      && abbruch.stderr.includes(`sammle-ffmpeg-beilagen: ffmpeg.README: ${README.length} B, SHA-256 ${sha(README)}\n`)
      && abbruch.stderr.includes('sammle-ffmpeg-beilagen:   | Version: 6.1.1\n'),
    'B12: Abbruch → stderr nennt Größe, SHA-256 und Anfang von LICENSE und README');

    // Text aus dem Netz darf im Protokoll keinen Workflow-Befehl bilden: Der Runner trennt Zeilen auch an \r, und ##[…]
    // wirkt an jeder Stelle der Zeile.
    const f = lage('arm64', { lizenz: '# Lizenz\r::error::falsch ##[add-mask]geheim\n' });
    const falle = lauf(argsFuer(f, 'arm64'));
    const zeilen = falle.stderr.split(/\r\n|\r|\n/);
    assert(falle.status === 1 && falle.stderr.includes('Lizenz') && falle.stderr.includes('geheim')
      && zeilen.every((z) => !z.trimStart().startsWith('::')) && !falle.stderr.includes('##['),
    'B12 Gegenprobe: Steuerzeichen und ##[ aus LICENSE werden im Protokoll entschärft');

    // Wie pruefe-mac-nachbau (N18, EP7): Über einen Ordner-Link aufgerufen muss der Sammler arbeiten, statt still mit Exit 0
    // und ohne Beilagen zu enden. Der Prüfer kommt mit, weil der Sammler ihn über den relativen Pfad lädt.
    const echt = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-skript-'));
    ordner.push(echt);
    copyFileSync(skript, join(echt, 'sammle-ffmpeg-beilagen.mjs'));
    copyFileSync(join(hier, '..', 'pruefe-mac-nachbau.mjs'), join(echt, 'pruefe-mac-nachbau.mjs'));
    const linkOrdner = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-link-'));
    const link = join(linkOrdner, 'werkzeug');
    symlinkSync(echt, link, 'junction');
    try {
      const ueberLink = (...a) => spawnSync(process.execPath, [join(link, 'sammle-ffmpeg-beilagen.mjs'), ...a], { encoding: 'utf8', env });
      const k = lage('arm64');
      const leer = ueberLink();
      const sauber = ueberLink(...argsFuer(k, 'arm64'));
      assert(leer.status === 2 && sauber.status === 0 && existsSync(join(k.optionen.ziel, 'ffmpeg-mac-arm64.LICENSE.txt')),
        'B11: Aufruf über einen Ordner-Link → arbeitet (Exit 2 ohne Argumente, sauber Exit 0 mit Beilagen), nie still Exit 0');
    } finally {
      unlinkSync(link);
      rmSync(linkOrdner, { recursive: true, force: true });
    }
  }
  {
    const text = readFileSync(hinweisImRepo, 'utf8');
    // Die Beilagen-Namen kommen aus beilagenNamen; quellen ist der Hinweis selbst und steht darum nicht im Text.
    const namen = ['x64', 'arm64'].flatMap((a) => [beilagenNamen(a).lizenz, beilagenNamen(a).angaben]);
    assert(['ffmpeg-static 5.3.0', 'b6.1.1', 'GPL', 'evermeet.cx', 'osxexperts.net', 'ffprobe-static 3.1.0', 'FFmpeg 4.0.2', '4.4-tessus', ...namen]
      .every((s) => text.includes(s)) && namen.length === 4,
    'B10: Hinweis im Repo nennt Fassungen (ffmpeg und ffprobe), Binär-Release, Lizenz, Herkunft und alle vier Beilagen aus beilagenNamen');
    assert(!/["']/.test(text), 'B10: Hinweis ohne ASCII-Anführungszeichen');
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle sammle-ffmpeg-beilagen-Tests bestanden.' : `\n${failures} sammle-ffmpeg-beilagen-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
