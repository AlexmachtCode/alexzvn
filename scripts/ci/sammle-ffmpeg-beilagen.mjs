// Sammelt Lizenztexte und Build-Angaben zu ffmpeg für das Release (Mac-Nachbau, Entwurf mac-fassungen F2 (ii),
// Owner-Freigabe 20.10.2026, Owner-Entscheid A vom selben Tag). install.js von ffmpeg-static legt ffmpeg.LICENSE und
// ffmpeg.README neben das Programm (install.js:175-176, :184, :187), lädt sie ohne Prüfsumme und warnt bei 404 nur
// (:29-32). Auf dem Mac ist ffmpeg.LICENSE kein GPL-Volltext, sondern FFmpegs Lizenz-Übersicht (LICENSE.md, 4 346 bzw.
// 4 376 B im Release b6.1.1). Darum nach Owner-Entscheid A:
//   - der GPL-Text ist der GPLv3-Volltext aus dem npm-Paket selbst (ffmpeg-static/LICENSE, 35 149 B, über die Integrität
//     im Lockfile gesichert): Kopf, Version 3, mindestens 15 000 B und Schluss, sonst Abbruch;
//   - ffmpeg.LICENSE geht als FFmpegs Lizenz-Übersicht mit, unter einem Namen, der keinen GPL-Volltext verspricht; sie muss
//     da sein, Text tragen und FFmpeg sowie General Public License nennen;
//   - ffmpeg.README (Build-Angaben) muss da sein und Text tragen.
// Dazu muss das ffmpeg im Paket Byte für Byte das aus ffmpeg-static sein, und Fassung und Binär-Release müssen die sein,
// für die ffmpeg-quellen-hinweis.txt geschrieben ist. Der Sammler druckt immer Größe, SHA-256 und Anfang von ffmpeg.LICENSE
// und ffmpeg.README und Größe und SHA-256 von ffmpeg-static/LICENSE, auch beim Abbruch.
//
//   node scripts/ci/sammle-ffmpeg-beilagen.mjs --app editor --art arm64 --release apps/editor/release \
//     --ffmpeg-static node_modules/ffmpeg-static --hinweis scripts/ci/ffmpeg-quellen-hinweis.txt --ziel paket
//
// Exit 0: vier Dateien in --ziel. Exit 1: Abweichung (stderr), nichts kopiert. Exit 2: Aufruf falsch. Nur node:-Module und
// der Prüfer daneben; der Workflow holt beide aus seinem eigenen Commit (werkzeug/scripts/ci/).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { APPS, ARTEN, appPfade } from './pruefe-mac-nachbau.mjs';

/** Fassung, für die ffmpeg-quellen-hinweis.txt geschrieben ist (editor-v0.5.0:package-lock.json, ffmpeg-static/package.json). */
export const BELEGT = { ffmpegStatic: '5.3.0', binaerRelease: 'b6.1.1' };
/** Damit lenkt ffmpeg-static Programm, Release oder Quelle um (index.js:16-17, install.js:163-172). */
export const UMLENKUNGEN = ['FFMPEG_BIN', 'FFMPEG_BINARY_RELEASE', 'FFMPEG_BINARIES_URL'];

/**
 * Asset-Namen am Release (Owner-Entscheid A). gpl und quellen sind für beide Arten gleich und gehen einmal hoch; die
 * Lizenz-Übersicht heißt so, dass sie keinen GPL-Volltext verspricht. Keiner endet auf .dmg oder .exe, keiner passt also
 * auf die Paketwahl (paketwahl.js:26-33).
 */
export function beilagenNamen(art) {
  return {
    gpl: 'ffmpeg-GPLv3.LICENSE.txt',
    uebersicht: `ffmpeg-mac-${art}.FFmpeg-Lizenzuebersicht.txt`,
    angaben: `ffmpeg-mac-${art}.README.txt`,
    quellen: 'ffmpeg-QUELLEN.txt',
  };
}

/** Merkmale des GPLv3-Volltexts (gemessen: GPLv2 17 984 B, GPLv3 35 147 B, ffmpeg-static/LICENSE 35 149 B mit
 *  „Version 3, 29 June 2007“ in Zeile 2; LGPL beginnt mit GNU LESSER …). */
const GPL_VOLLTEXT = { kopf: 'GNU GENERAL PUBLIC LICENSE', fassung: 'Version 3', mindestBytes: 15000, schluss: 'END OF TERMS AND CONDITIONS' };
/** Was FFmpegs Lizenz-Übersicht mindestens nennt (LICENSE.md: „Most files in FFmpeg are under the GNU Lesser General Public
 *  License …“). Ein GPL-Volltext schreibt den Titel in Großbuchstaben und nennt FFmpeg nicht. */
const UEBERSICHT_WORTE = ['FFmpeg', 'General Public License'];
/** So viele Zeilen von ffmpeg.LICENSE und ffmpeg.README kommen ins Protokoll. */
const STECKBRIEF_ZEILEN = 10;

const istDatei = (p) => existsSync(p) && statSync(p).isFile();
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const zeilen = (p) => readFileSync(p, 'utf8').split(/\r?\n/).map((z) => z.trim()).filter((z) => z !== '');
/**
 * Text aus dem Netz fürs CI-Protokoll: Der Runner trennt Zeilen auch an einem einzelnen \r (danach könnte ::befehl::
 * stehen), und ##[befehl] wirkt an jeder Stelle der Zeile. Darum Steuerzeichen als ? und ##[ als #?[, höchstens 160 Zeichen.
 */
const fuersProtokoll = (z) => z.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?').replaceAll('##[', '#?[').slice(0, 160);

/** Größe, SHA-256 und (mit `anfang`) die ersten Zeilen einer Datei, damit schon das Protokoll eines Abbruchs zeigt, was
 *  ffmpeg-static geliefert hat. */
function steckbrief(p, name, anfang = STECKBRIEF_ZEILEN) {
  if (!istDatei(p)) return [`${name}: fehlt`];
  return [`${name}: ${statSync(p).size} B, SHA-256 ${sha256(p)}`, ...zeilen(p).slice(0, anfang).map((z) => `  | ${fuersProtokoll(z)}`)];
}

/**
 * Prüft ffmpeg-static und kopiert GPLv3-Text, Lizenz-Übersicht, README und Hinweis nach `ziel` (nur wenn alles stimmt).
 * @returns {{ ok: boolean, fehler: string[], dateien: string[], steckbrief: string[] }}
 */
export function sammleFfmpegBeilagen({ ffmpegStatic, appFfmpeg, hinweis, ziel, art, env }) {
  const fehler = [];
  for (const v of UMLENKUNGEN) {
    if (env[v]) fehler.push(`${v} ist gesetzt; der Quellen-Hinweis gilt nur für das Standard-Release von ffmpeg-static.`);
  }
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(join(ffmpegStatic, 'package.json'), 'utf8'));
  } catch {
    fehler.push(`package.json von ffmpeg-static fehlt oder ist unlesbar: ${ffmpegStatic}`);
  }
  if (pkg) {
    if (pkg.version !== BELEGT.ffmpegStatic) fehler.push(`ffmpeg-static ${pkg.version}, der Quellen-Hinweis ist für ${BELEGT.ffmpegStatic} geschrieben.`);
    const rel = pkg['ffmpeg-static']?.['binary-release-tag'];
    if (rel !== BELEGT.binaerRelease) fehler.push(`Binär-Release ${rel}, der Quellen-Hinweis ist für ${BELEGT.binaerRelease} geschrieben.`);
  }
  const quelle = join(ffmpegStatic, 'ffmpeg');
  const gpl = join(ffmpegStatic, 'LICENSE');
  const uebersicht = join(ffmpegStatic, 'ffmpeg.LICENSE');
  const angaben = join(ffmpegStatic, 'ffmpeg.README');
  for (const p of [quelle, gpl, uebersicht, angaben]) if (!istDatei(p)) fehler.push(`fehlt: ${p}`);
  if (!istDatei(appFfmpeg)) fehler.push(`ffmpeg im Paket fehlt: ${appFfmpeg}`);
  if (istDatei(quelle) && istDatei(appFfmpeg) && sha256(quelle) !== sha256(appFfmpeg)) {
    fehler.push('ffmpeg im Paket ist nicht das aus ffmpeg-static; LICENSE und README gehörten dann zu einem anderen Programm.');
  }
  if (istDatei(gpl)) {
    const [erste, zweite] = zeilen(gpl);
    const groesse = statSync(gpl).size;
    const maengel = [];
    if (!erste?.includes(GPL_VOLLTEXT.kopf)) maengel.push(erste ? `erste Zeile „${fuersProtokoll(erste)}“ ohne ${GPL_VOLLTEXT.kopf}` : 'keine Textzeile');
    if (erste && !zweite?.includes(GPL_VOLLTEXT.fassung)) {
      maengel.push(zweite ? `zweite Zeile „${fuersProtokoll(zweite)}“ ohne ${GPL_VOLLTEXT.fassung}` : 'keine zweite Textzeile');
    }
    if (groesse < GPL_VOLLTEXT.mindestBytes) maengel.push(`${groesse} B statt mindestens ${GPL_VOLLTEXT.mindestBytes} B`);
    if (!readFileSync(gpl, 'utf8').includes(GPL_VOLLTEXT.schluss)) maengel.push(`ohne Schluss ${GPL_VOLLTEXT.schluss}`);
    if (maengel.length) fehler.push(`ffmpeg-static/LICENSE ist kein GPLv3-Volltext: ${maengel.join('; ')}.`);
  }
  if (istDatei(uebersicht)) {
    const text = readFileSync(uebersicht, 'utf8');
    if (zeilen(uebersicht).length === 0) fehler.push('ffmpeg.LICENSE ist leer; erwartet ist FFmpegs Lizenz-Übersicht.');
    else {
      const ohne = UEBERSICHT_WORTE.filter((w) => !text.includes(w));
      if (ohne.length) fehler.push(`ffmpeg.LICENSE ist nicht FFmpegs Lizenz-Übersicht: ${ohne.map((w) => `ohne ${w}`).join('; ')}.`);
    }
  }
  if (istDatei(angaben) && zeilen(angaben).length === 0) fehler.push('ffmpeg.README ist leer.');
  if (!istDatei(hinweis) || zeilen(hinweis).length === 0) fehler.push(`Quellen-Hinweis fehlt oder ist leer: ${hinweis}`);
  const brief = [...steckbrief(uebersicht, 'ffmpeg.LICENSE'), ...steckbrief(angaben, 'ffmpeg.README'), ...steckbrief(gpl, 'ffmpeg-static/LICENSE', 0)];
  if (fehler.length) return { ok: false, fehler, dateien: [], steckbrief: brief };

  const namen = beilagenNamen(art);
  mkdirSync(ziel, { recursive: true });
  copyFileSync(gpl, join(ziel, namen.gpl));
  copyFileSync(uebersicht, join(ziel, namen.uebersicht));
  copyFileSync(angaben, join(ziel, namen.angaben));
  copyFileSync(hinweis, join(ziel, namen.quellen));
  return { ok: true, fehler, dateien: [namen.gpl, namen.uebersicht, namen.angaben, namen.quellen], steckbrief: brief };
}

const AUFRUF = 'Aufruf: node scripts/ci/sammle-ffmpeg-beilagen.mjs --app <app> --art arm64|x64 --release <Ordner> --ffmpeg-static <Ordner> --hinweis <Datei> --ziel <Ordner>';

function hauptprogramm(argv) {
  let w;
  try {
    ({ values: w } = parseArgs({
      args: argv.slice(2),
      options: {
        app: { type: 'string' }, art: { type: 'string' }, release: { type: 'string' },
        'ffmpeg-static': { type: 'string' }, hinweis: { type: 'string' }, ziel: { type: 'string' },
      },
    }));
  } catch (e) {
    console.error(`sammle-ffmpeg-beilagen: ${e.message}`);
    console.error(AUFRUF);
    return 2;
  }
  if (!w.app || !w.art || !w.release || !w['ffmpeg-static'] || !w.hinweis || !w.ziel
    || !Object.hasOwn(APPS, w.app) || !Object.hasOwn(ARTEN, w.art)) {
    console.error(AUFRUF);
    return 2;
  }
  const r = sammleFfmpegBeilagen({
    ffmpegStatic: resolve(w['ffmpeg-static']), appFfmpeg: appPfade(resolve(w.release), w.app, w.art).ffmpeg,
    hinweis: resolve(w.hinweis), ziel: resolve(w.ziel), art: w.art, env: process.env,
  });
  if (!r.ok) {
    for (const f of r.fehler) console.error(`sammle-ffmpeg-beilagen: ${f}`);
    for (const z of r.steckbrief) console.error(`sammle-ffmpeg-beilagen: ${z}`);
    return 1;
  }
  for (const z of r.steckbrief) console.log(`sammle-ffmpeg-beilagen: ${z}`);
  console.log(`sammle-ffmpeg-beilagen: in Ordnung (${r.dateien.join(', ')}).`);
  return 0;
}

/** Hauptprogramm? Beide Seiten über realpath (wie pruefe-mac-nachbau.mjs, EP7). */
function istHauptprogramm(arg) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (istHauptprogramm(process.argv[1])) process.exitCode = hauptprogramm(process.argv);
