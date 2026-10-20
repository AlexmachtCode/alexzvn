// Sammelt GPL-Text und Build-Angaben von ffmpeg-static für das Release (Mac-Nachbau, Entwurf mac-fassungen F2 (ii),
// Owner-Freigabe 20.10.2026). install.js von ffmpeg-static legt beides neben das Programm (ffmpeg.LICENSE und
// ffmpeg.README, install.js:175-176, :184, :187), lädt es ohne Prüfsumme und warnt bei 404 nur (:29-32). Darum hier:
// Beides muss da sein, das ffmpeg im Paket muss Byte für Byte das aus ffmpeg-static sein, und Fassung und Binär-Release
// müssen die sein, für die ffmpeg-quellen-hinweis.txt geschrieben ist. LICENSE muss ein GPL-Volltext sein; die Mac-Dateien
// im Release b6.1.1 sind laut gh release view nur 4 346 bzw. 4 376 B groß, also wohl keiner (Prüfung Task 2, W1). Darum
// druckt der Sammler immer Größe, SHA-256 und Anfang von LICENSE und README, auch beim Abbruch.
//
//   node scripts/ci/sammle-ffmpeg-beilagen.mjs --app editor --art arm64 --release apps/editor/release \
//     --ffmpeg-static node_modules/ffmpeg-static --hinweis scripts/ci/ffmpeg-quellen-hinweis.txt --ziel paket
//
// Exit 0: drei Dateien in --ziel. Exit 1: Abweichung (stderr), nichts kopiert. Exit 2: Aufruf falsch. Nur node:-Module und
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

/** Asset-Namen am Release. Keiner endet auf .dmg oder .exe, keiner passt also auf die Paketwahl (paketwahl.js:26-33). */
export function beilagenNamen(art) {
  return { lizenz: `ffmpeg-mac-${art}.LICENSE.txt`, angaben: `ffmpeg-mac-${art}.README.txt`, quellen: 'ffmpeg-QUELLEN.txt' };
}

/** Merkmale eines GPL-Volltexts (gemessen: GPLv2 17 984 B, GPLv3 35 147 B; LGPL beginnt mit GNU LESSER …). */
const GPL_VOLLTEXT = { kopf: 'GNU GENERAL PUBLIC LICENSE', mindestBytes: 15000, schluss: 'END OF TERMS AND CONDITIONS' };
/** So viele Zeilen von LICENSE und README kommen ins Protokoll. */
const STECKBRIEF_ZEILEN = 10;

const istDatei = (p) => existsSync(p) && statSync(p).isFile();
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const zeilen = (p) => readFileSync(p, 'utf8').split(/\r?\n/).map((z) => z.trim()).filter((z) => z !== '');
/**
 * Text aus dem Netz fürs CI-Protokoll: Der Runner trennt Zeilen auch an einem einzelnen \r (danach könnte ::befehl::
 * stehen), und ##[befehl] wirkt an jeder Stelle der Zeile. Darum Steuerzeichen als ? und ##[ als #?[, höchstens 160 Zeichen.
 */
const fuersProtokoll = (z) => z.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?').replaceAll('##[', '#?[').slice(0, 160);

/** Größe, SHA-256 und Anfang einer Datei, damit schon das Protokoll eines Abbruchs zeigt, was ffmpeg-static geliefert hat. */
function steckbrief(p, name) {
  if (!istDatei(p)) return [`${name}: fehlt`];
  return [`${name}: ${statSync(p).size} B, SHA-256 ${sha256(p)}`, ...zeilen(p).slice(0, STECKBRIEF_ZEILEN).map((z) => `  | ${fuersProtokoll(z)}`)];
}

/**
 * Prüft ffmpeg-static und kopiert LICENSE, README und Hinweis nach `ziel` (nur wenn alles stimmt).
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
  const lizenz = join(ffmpegStatic, 'ffmpeg.LICENSE');
  const angaben = join(ffmpegStatic, 'ffmpeg.README');
  for (const p of [quelle, lizenz, angaben]) if (!istDatei(p)) fehler.push(`fehlt: ${p}`);
  if (!istDatei(appFfmpeg)) fehler.push(`ffmpeg im Paket fehlt: ${appFfmpeg}`);
  if (istDatei(quelle) && istDatei(appFfmpeg) && sha256(quelle) !== sha256(appFfmpeg)) {
    fehler.push('ffmpeg im Paket ist nicht das aus ffmpeg-static; LICENSE und README gehörten dann zu einem anderen Programm.');
  }
  if (istDatei(lizenz)) {
    const erste = zeilen(lizenz)[0];
    const groesse = statSync(lizenz).size;
    const maengel = [];
    if (!erste?.includes(GPL_VOLLTEXT.kopf)) maengel.push(erste ? `erste Zeile „${fuersProtokoll(erste)}“ ohne ${GPL_VOLLTEXT.kopf}` : 'keine Textzeile');
    if (groesse < GPL_VOLLTEXT.mindestBytes) maengel.push(`${groesse} B statt mindestens ${GPL_VOLLTEXT.mindestBytes} B`);
    if (!readFileSync(lizenz, 'utf8').includes(GPL_VOLLTEXT.schluss)) maengel.push(`ohne Schluss ${GPL_VOLLTEXT.schluss}`);
    if (maengel.length) fehler.push(`ffmpeg.LICENSE ist kein GPL-Volltext: ${maengel.join('; ')}.`);
  }
  if (!istDatei(hinweis) || zeilen(hinweis).length === 0) fehler.push(`Quellen-Hinweis fehlt oder ist leer: ${hinweis}`);
  const brief = [...steckbrief(lizenz, 'ffmpeg.LICENSE'), ...steckbrief(angaben, 'ffmpeg.README')];
  if (fehler.length) return { ok: false, fehler, dateien: [], steckbrief: brief };

  const namen = beilagenNamen(art);
  mkdirSync(ziel, { recursive: true });
  copyFileSync(lizenz, join(ziel, namen.lizenz));
  copyFileSync(angaben, join(ziel, namen.angaben));
  copyFileSync(hinweis, join(ziel, namen.quellen));
  return { ok: true, fehler, dateien: [namen.lizenz, namen.angaben, namen.quellen], steckbrief: brief };
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
