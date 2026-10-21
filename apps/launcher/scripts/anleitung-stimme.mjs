// Erzeuger der Ansagen für die geführten Anleitungen (Plan Geführte Anleitungen P10; Spec 6; EP12, EP13, G14).
//
//   node --experimental-strip-types scripts/anleitung-stimme.mjs --stimme <Name> [--sprecher <n>]
//   npm run stimme:erzeugen -w @jm/launcher -- --stimme <Name> [--sprecher <n>]
//
// Läuft NUR am Rechner des Controllers, nie in der CI. Piper 1.8.0 (Python-venv), die Stimme (.onnx und .onnx.json
// daneben) und ffmpeg liegen außerhalb des Repos; ihre Pfade kommen aus JM_PIPER_PYTHON, JM_PIPER_STIMME und JM_FFMPEG,
// die nur der Controller in seiner Befehlszeile setzt (Plan, Task 11 Step 15; nie ein Umsetzer). Piper wird nur über die
// Kommandozeile aufgerufen (kein import piper), Python nur isoliert (-I: weder Arbeitsverzeichnis noch PYTHON*-Variablen im
// Suchpfad); Text- und WAV-Zwischendateien bleiben im Temp-Ordner. Je gesprochenem Text: Text-Prüfsumme, Stimme,
// Sprecher und Parameter unverändert und die Datei stimmt →
// übersprungen; sonst Piper → WAV → ffmpeg (Opus in Ogg, bitgleich) → <id>.ogg. Alles oder nichts: erst wenn jede Ansage
// erzeugt ist, kommen Dateien und Manifest in den Ordner; verwaiste .ogg werden gelöscht und gemeldet. Jeder Fehler endet
// sichtbar mit Exit 1.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_MUSTER, sprechTexte } from '@jm/ui/anleitung';
import { EINRICHTUNG } from '../src/renderer/src/anleitung/einrichtung.ts';
import { ansageDatei, dateiSha256, istHauptmodul, leeresManifest, leseOrdner, manifestText, pruefeStimme, STIMMEN, textSha256 } from './stimme-manifest.mjs';

export const PIPER_FASSUNG = '1.8.0';
export const STANDARD_PARAMETER = Object.freeze({ lengthScale: 1.05, sentenceSilence: 0.3, opusKbps: 24 });
export const UMGEBUNG = Object.freeze(['JM_PIPER_PYTHON', 'JM_PIPER_STIMME', 'JM_FFMPEG']);
export const STIMMEN_ORDNER = fileURLToPath(new URL('../src/renderer/src/anleitung/stimme/', import.meta.url));

/** Startet ein Werkzeug ohne Shell; Exit ≠ 0 → Fehler mit stderr. Ergebnis: stdout. */
function lauf(name, befehl, args) {
  return new Promise((fertig, scheitern) => {
    let aus = '';
    let fehler = '';
    const p = spawn(befehl[0], [...befehl.slice(1), ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', (d) => { aus += d; });
    p.stderr.on('data', (d) => { fehler += d; });
    p.on('error', (e) => scheitern(new Error(`${name} startet nicht (${befehl[0]}): ${e.message}`)));
    p.on('close', (code) => (code === 0 ? fertig(aus) : scheitern(new Error(`${name} endete mit Code ${code}: ${fehler.trim() || '(keine Meldung auf stderr)'}`))));
  });
}

/**
 * Prüft die Stimme vor jedem Aufruf: Name gepinnt, Datei da, SHA-256 = Pin, <onnx>.json daneben (Piper 1.8.0 liest die
 * Konfiguration nur unter diesem Namen, -c wertet es nicht aus). Ergebnis: Pin, Prüfsumme und Zahl der Sprecher.
 */
export function pruefeStimmenDatei(stimmePfad, stimmeName, stimmen = STIMMEN) {
  const pin = Object.hasOwn(stimmen, stimmeName) ? stimmen[stimmeName] : null;
  if (!pin) throw new Error(`Stimme ${stimmeName} ist nicht gepinnt (gepinnt: ${Object.keys(stimmen).join(', ')})`);
  if (!existsSync(stimmePfad)) throw new Error(`Stimme fehlt: ${stimmePfad}`);
  const onnxSha256 = dateiSha256(stimmePfad);
  if (onnxSha256 !== pin.onnxSha256) throw new Error(`Prüfsumme der Stimme passt nicht zu ${stimmeName}: ${onnxSha256}, gepinnt ${pin.onnxSha256}`);
  const konfigPfad = `${stimmePfad}.json`;
  if (!existsSync(konfigPfad)) throw new Error(`Konfiguration der Stimme fehlt: ${konfigPfad} (Piper 1.8.0 liest sie nur unter diesem Namen)`);
  let konfig;
  try {
    konfig = JSON.parse(readFileSync(konfigPfad, 'utf8'));
  } catch (e) {
    throw new Error(`Konfiguration der Stimme unlesbar: ${konfigPfad} (${e.message})`);
  }
  const sprecherZahl = Number.isInteger(konfig?.num_speakers) && konfig.num_speakers > 0 ? konfig.num_speakers : 1;
  return { pin, onnxSha256, sprecherZahl };
}

function leseManifest(pfad) {
  if (!existsSync(pfad)) return leeresManifest();
  let m;
  try {
    m = JSON.parse(readFileSync(pfad, 'utf8'));
  } catch (e) {
    throw new Error(`Manifest unlesbar: ${pfad} (${e.message})`);
  }
  if (typeof m !== 'object' || m === null || m.format !== 1 || !Array.isArray(m.eintraege)) {
    throw new Error(`Manifest unlesbar: ${pfad} (erwartet format 1 mit der Liste eintraege)`);
  }
  return m;
}

const gleicheParameter = (a, b) => !!a && a.lengthScale === b.lengthScale && a.sentenceSilence === b.sentenceSilence && a.opusKbps === b.opusKbps;

/**
 * Erzeugt die Ansagen (EP12, EP13).
 *   o.texte       { id, text }[] — sprechTexte(EINRICHTUNG)
 *   o.ziel        Stimmen-Ordner mit manifest.json
 *   o.stimmePfad  Pfad der .onnx; o.stimmeName Schlüssel in o.stimmen (Vorgabe STIMMEN)
 *   o.sprecher    ganze Zahl oder null/undefined (Pflicht bei Stimmen mit mehreren Sprechern)
 *   o.piper       Befehl ohne Argumente, z. B. [python, '-I', '-m', 'piper']; o.ffmpeg z. B. [ffmpeg]
 *   o.werkzeug    { piper, ffmpeg } — die gemessenen Fassungen, kommen ins Manifest
 *   o.parameter   Abweichungen von STANDARD_PARAMETER
 * Ergebnis: { erzeugt: id[], uebersprungen: id[], entfernt: Dateiname[], bytes }.
 */
export async function erzeugeAnsagen(o) {
  const stimmen = o.stimmen ?? STIMMEN;
  const parameter = { ...STANDARD_PARAMETER, ...(o.parameter ?? {}) };
  const sprecher = o.sprecher ?? null;
  const { pin, onnxSha256, sprecherZahl } = pruefeStimmenDatei(o.stimmePfad, o.stimmeName, stimmen);
  if (sprecherZahl > 1 && sprecher === null) {
    throw new Error(`Die Stimme ${o.stimmeName} hat ${sprecherZahl} Sprecher: einen mit --sprecher wählen (Hörprobe, OFP1)`);
  }
  if (sprecher !== null && !(Number.isInteger(sprecher) && sprecher >= 0 && sprecher < sprecherZahl)) {
    throw new Error(`Sprecher ${sprecher} gibt es nicht: ${sprecherZahl === 1 ? `die Stimme ${o.stimmeName} hat nur einen Sprecher (--sprecher weglassen)` : `erlaubt sind 0 bis ${sprecherZahl - 1}`}`);
  }
  const ids = new Set();
  for (const { id } of o.texte) {
    if (typeof id !== 'string' || !ID_MUSTER.test(id)) throw new Error(`Ungültige Text-ID für einen Dateinamen: ${JSON.stringify(id)}`);
    if (ids.has(id)) throw new Error(`Text-ID doppelt: ${id}`);
    ids.add(id);
  }
  mkdirSync(o.ziel, { recursive: true });
  const manifestPfad = join(o.ziel, 'manifest.json');
  const alt = leseManifest(manifestPfad);
  const stimme = { name: o.stimmeName, onnxSha256, lizenz: pin.lizenz, namensnennung: pin.namensnennung, sprecher };
  const gleicheStimme = alt.stimme !== null && alt.stimme.name === stimme.name && alt.stimme.onnxSha256 === onnxSha256
    && (alt.stimme.sprecher ?? null) === sprecher && gleicheParameter(alt.parameter, parameter);
  const altJeId = new Map(alt.eintraege.map((e) => [e.id, e]));
  const tmp = mkdtempSync(join(tmpdir(), 'jm-ansagen-'));
  const eintraege = [];
  const erzeugt = [];
  const uebersprungen = [];
  const neu = [];
  try {
    for (const { id, text } of o.texte) {
      const datei = ansageDatei(id);
      const pfad = join(o.ziel, datei);
      const ts = textSha256(text);
      const e = altJeId.get(id);
      if (gleicheStimme && e && e.textSha256 === ts && e.datei === datei && existsSync(pfad) && dateiSha256(pfad) === e.dateiSha256) {
        uebersprungen.push(id);
        eintraege.push({ id, textSha256: e.textSha256, datei, dateiSha256: e.dateiSha256, bytes: statSync(pfad).size });
        continue;
      }
      const txt = join(tmp, `${id}.txt`);
      const wav = join(tmp, `${id}.wav`);
      const ogg = join(tmp, datei);
      writeFileSync(txt, text.normalize('NFC'), 'utf8');
      await lauf('Piper', o.piper, [
        '-m', o.stimmePfad, '-i', txt, '-f', wav,
        '--sentence-silence', String(parameter.sentenceSilence), '--length-scale', String(parameter.lengthScale),
        ...(sprecher === null ? [] : ['-s', String(sprecher)]),
      ]);
      if (!existsSync(wav) || statSync(wav).size <= 44) throw new Error(`Piper hat für ${id} keine WAV geschrieben: ${wav}`);
      await lauf('ffmpeg', o.ffmpeg, [
        '-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
        '-c:a', 'libopus', '-b:a', `${parameter.opusKbps}k`, '-ac', '1',
        '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', ogg,
      ]);
      if (!existsSync(ogg) || statSync(ogg).size === 0) throw new Error(`ffmpeg hat für ${id} keine Ogg-Datei geschrieben: ${ogg}`);
      erzeugt.push(id);
      neu.push([ogg, pfad]);
      eintraege.push({ id, textSha256: ts, datei, dateiSha256: dateiSha256(ogg), bytes: statSync(ogg).size });
    }
    for (const [von, nach] of neu) copyFileSync(von, nach);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const behalten = new Set(eintraege.map((e) => e.datei));
  const entfernt = [];
  for (const name of readdirSync(o.ziel).sort()) {
    if (name.endsWith('.ogg') && !behalten.has(name)) {
      unlinkSync(join(o.ziel, name));
      entfernt.push(name);
    }
  }
  const manifest = { format: 1, stimme, werkzeug: { piper: o.werkzeug.piper, ffmpeg: o.werkzeug.ffmpeg }, parameter, eintraege };
  writeFileSync(manifestPfad, manifestText(manifest), 'utf8');
  return { erzeugt, uebersprungen, entfernt, bytes: eintraege.reduce((s, e) => s + e.bytes, 0) };
}

/** Fassungen der Werkzeuge, gemessen statt angenommen: piper-tts aus den Paketdaten (kein import piper), ffmpeg aus -version. */
export async function werkzeugFassungen(python, ffmpeg) {
  const piper = (await lauf('Python', [python], ['-I', '-c', "import importlib.metadata as m; print(m.version('piper-tts'))"])).trim();
  const zeile = (await lauf('ffmpeg', [ffmpeg], ['-version'])).split(/\r?\n/)[0] ?? '';
  const ff = /^ffmpeg version n?(\d+(?:\.\d+)*)/.exec(zeile)?.[1];
  if (!ff) throw new Error(`ffmpeg-Fassung nicht erkannt: ${zeile}`);
  return { piper, ffmpeg: ff };
}

function leseArgumente(argv) {
  let stimme = null;
  let sprecher = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stimme') stimme = argv[++i] ?? null;
    else if (argv[i] === '--sprecher') {
      const w = argv[++i];
      if (!/^\d+$/.test(w ?? '')) throw new Error(`--sprecher braucht eine ganze Zahl ab 0, nicht ${JSON.stringify(w ?? null)}`);
      sprecher = Number(w);
    } else throw new Error(`Unbekanntes Argument: ${argv[i]} (erlaubt: --stimme <Name>, --sprecher <n>)`);
  }
  if (!stimme) throw new Error(`--stimme fehlt (OFP1: ${Object.keys(STIMMEN).join(' oder ')})`);
  if (!Object.hasOwn(STIMMEN, stimme)) throw new Error(`Stimme ${stimme} ist nicht gepinnt (gepinnt: ${Object.keys(STIMMEN).join(', ')})`);
  return { stimme, sprecher };
}

/** Kommandozeile: Ergebnis ist der Exit-Code (0 oder 1); Meldungen über log bzw. fehler. */
export async function kommandozeile(argv, env, log = console.log, fehler = console.error) {
  try {
    const a = leseArgumente(argv);
    const fehlt = UMGEBUNG.filter((k) => !env[k]);
    if (fehlt.length) {
      throw new Error(`Es fehlen Umgebungsvariablen: ${fehlt.join(', ')}. Piper ${PIPER_FASSUNG} (Python-venv), die Stimme und ffmpeg stellt der Controller außerhalb des Repos bereit (Plan, Vor der Umsetzung); mit diesen Pfaden startet nur er den Erzeuger (Task 11 Step 15).`);
    }
    pruefeStimmenDatei(env.JM_PIPER_STIMME, a.stimme);
    const werkzeug = await werkzeugFassungen(env.JM_PIPER_PYTHON, env.JM_FFMPEG);
    if (werkzeug.piper !== PIPER_FASSUNG) throw new Error(`piper-tts ${werkzeug.piper} gefunden, erwartet ${PIPER_FASSUNG} (Aufruf mit -i und -f, EP12)`);
    const texte = sprechTexte(EINRICHTUNG);
    const r = await erzeugeAnsagen({
      texte, ziel: STIMMEN_ORDNER, stimmePfad: env.JM_PIPER_STIMME, stimmeName: a.stimme, sprecher: a.sprecher,
      piper: [env.JM_PIPER_PYTHON, '-I', '-m', 'piper'], ffmpeg: [env.JM_FFMPEG], werkzeug,
    });
    for (const id of r.erzeugt) log(`erzeugt:  ${id}`);
    for (const name of r.entfernt) log(`entfernt: ${name} (kein Text mehr dazu)`);
    log(`Ansagen: ${r.erzeugt.length} erzeugt, ${r.uebersprungen.length} übersprungen, ${r.entfernt.length} entfernt, ${r.bytes} Bytes (Stimme ${a.stimme}${a.sprecher === null ? '' : `, Sprecher ${a.sprecher}`}; piper-tts ${werkzeug.piper}, ffmpeg ${werkzeug.ffmpeg}).`);
    const befunde = pruefeStimme(texte, JSON.parse(readFileSync(join(STIMMEN_ORDNER, 'manifest.json'), 'utf8')), leseOrdner(STIMMEN_ORDNER).ogg);
    if (befunde.length) throw new Error(`Prüfung nach der Erzeugung: ${befunde.join('; ')}`);
    log('Prüfung nach der Erzeugung: zu jedem gesprochenen Text gehört genau die passende Ansage.');
    return 0;
  } catch (e) {
    fehler(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

const direkt = istHauptmodul(fileURLToPath(import.meta.url), process.argv[1]);
if (direkt) process.exitCode = await kommandozeile(process.argv.slice(2), process.env);
