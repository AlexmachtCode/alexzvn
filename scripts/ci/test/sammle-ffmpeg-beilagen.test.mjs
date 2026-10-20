// Selbsttest für scripts/ci/sammle-ffmpeg-beilagen.mjs (Mac-Nachbau, F2 (ii)): nachgebautes ffmpeg-static im Temp-Ordner,
// dazu die Namensprobe gegen die echte Paketwahl des Proxys (services/release-proxy/paketwahl.js; der Launcher hat dieselbe
// Regel in apps/launcher/src/main/release-wahl.ts, beide prüfen test/paketwahl-faelle.json) und der Wortlaut des Hinweises.
//   node scripts/ci/test/sammle-ffmpeg-beilagen.test.mjs
import { spawnSync } from 'node:child_process';
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

const GPL = '                    GNU GENERAL PUBLIC LICENSE\r\n                       Version 3, 29 June 2007\r\n';
const ordner = [];
/** ffmpeg-static nach npm ci auf einem Mac (install.js legt ffmpeg, ffmpeg.LICENSE, ffmpeg.README), dazu die App. */
function lage(art = 'arm64', { version = '5.3.0', release = 'b6.1.1', lizenz = GPL } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'jm-ffmpeg-beilagen-'));
  ordner.push(d);
  const fs = join(d, 'node_modules', 'ffmpeg-static');
  datei(join(fs, 'package.json'), JSON.stringify({ name: 'ffmpeg-static', version, 'ffmpeg-static': { 'binary-release-tag': release } }));
  datei(join(fs, 'ffmpeg'), `ffmpeg-${art}`);
  datei(join(fs, 'ffmpeg.LICENSE'), lizenz);
  datei(join(fs, 'ffmpeg.README'), 'FFmpeg 64-bit static build\n\nVersion: 6.1.1\n');
  const release1 = join(d, 'apps', 'editor', 'release');
  datei(appPfade(release1, 'editor', art).ffmpeg, `ffmpeg-${art}`);
  datei(join(d, 'hinweis.txt'), 'Hinweis\n');
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
    // Ohne Zielordner eine FAIL-Zeile statt eines Absturzes, der alle folgenden Prüfungen verschluckte.
    const ziel = existsSync(l.optionen.ziel) ? readdirSync(l.optionen.ziel).sort() : [];
    assert(r.ok && JSON.stringify(ziel) === JSON.stringify(['ffmpeg-QUELLEN.txt', 'ffmpeg-mac-arm64.LICENSE.txt', 'ffmpeg-mac-arm64.README.txt'])
      && readFileSync(join(l.optionen.ziel, 'ffmpeg-mac-arm64.LICENSE.txt'), 'utf8') === GPL, 'B3: sauber → genau drei Dateien, Inhalt unverändert');
    assert(r.angabenKopf.join('|') === 'FFmpeg 64-bit static build|Version: 6.1.1', 'B3: Anfang der Build-Angaben fürs Protokoll');
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
  {
    const l = lage();
    const r = sammleFfmpegBeilagen({ ...l.optionen, env: { FFMPEG_BINARIES_URL: 'https://example.org' } });
    assert(!r.ok && r.fehler.includes('FFMPEG_BINARIES_URL ist gesetzt; der Quellen-Hinweis gilt nur für das Standard-Release von ffmpeg-static.'),
      'B7 Gegenprobe: Umlenkung per Umgebungsvariable → rot');
  }
  {
    const r = sammleFfmpegBeilagen(lage('arm64', { lizenz: 'MIT License\n' }).optionen);
    assert(!r.ok && r.fehler.includes('ffmpeg.LICENSE ist kein GPL-Text (erste Zeile: MIT License).'), 'B8 Gegenprobe: LICENSE ist kein GPL-Text → rot');
    const l = lage();
    writeFileSync(l.optionen.hinweis, '');
    const s = sammleFfmpegBeilagen(l.optionen);
    assert(!s.ok && s.fehler.some((f) => f.startsWith('Quellen-Hinweis fehlt oder ist leer:')), 'B8 Gegenprobe: Quellen-Hinweis leer → rot');
  }

  console.log('sammle-ffmpeg-beilagen — Kommandozeile und Hinweis im Repo:');
  {
    const env = { ...process.env };
    for (const v of ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL']) delete env[v];
    const lauf = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8', env });
    const l = lage('x64');
    const args = ['--app', 'editor', '--art', 'x64', '--release', l.release, '--ffmpeg-static', l.ffmpegStatic, '--hinweis', l.optionen.hinweis, '--ziel', l.optionen.ziel];
    const gut = lauf(...args);
    assert(gut.status === 0 && gut.stdout.includes('sammle-ffmpeg-beilagen: in Ordnung (ffmpeg-mac-x64.LICENSE.txt, ffmpeg-mac-x64.README.txt, ffmpeg-QUELLEN.txt).'),
      'B9: Kommandozeile sauber → Exit 0');
    rmSync(join(l.ffmpegStatic, 'ffmpeg.LICENSE'));
    const schlecht = lauf(...args);
    const ohne = lauf();
    const app = lauf(...args.map((a) => (a === 'editor' ? 'titler' : a)));
    assert(schlecht.status === 1 && schlecht.stderr.includes('sammle-ffmpeg-beilagen: fehlt: ') && ohne.status === 2 && app.status === 2,
      'B9 Gegenprobe: Kommandozeile mit fehlender LICENSE → Exit 1; ohne Argumente oder fremde App → Exit 2');

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
      const sauber = ueberLink('--app', 'editor', '--art', 'arm64', '--release', k.release, '--ffmpeg-static', k.ffmpegStatic,
        '--hinweis', k.optionen.hinweis, '--ziel', k.optionen.ziel);
      assert(leer.status === 2 && sauber.status === 0 && existsSync(join(k.optionen.ziel, 'ffmpeg-mac-arm64.LICENSE.txt')),
        'B11: Aufruf über einen Ordner-Link → arbeitet (Exit 2 ohne Argumente, sauber Exit 0 mit Beilagen), nie still Exit 0');
    } finally {
      unlinkSync(link);
      rmSync(linkOrdner, { recursive: true, force: true });
    }
  }
  {
    const text = readFileSync(hinweisImRepo, 'utf8');
    assert(['ffmpeg-static 5.3.0', 'b6.1.1', 'GPL', 'evermeet.cx', 'osxexperts.net', 'ffprobe-static 3.1.0', 'ffmpeg-mac-x64.LICENSE.txt', 'ffmpeg-mac-arm64.README.txt']
      .every((s) => text.includes(s)), 'B10: Hinweis im Repo nennt Fassung, Binär-Release, Lizenz, Herkunft und die Beilagen');
    assert(!/["']/.test(text), 'B10: Hinweis ohne ASCII-Anführungszeichen');
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle sammle-ffmpeg-beilagen-Tests bestanden.' : `\n${failures} sammle-ffmpeg-beilagen-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
