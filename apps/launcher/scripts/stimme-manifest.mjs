// Ansagen der geführten Anleitungen: Pins der Stimmen, Text-Prüfsumme, Manifest und die Prüfung „zu jedem gesprochenen
// Text genau die passende Ansage“ (Plan Geführte Anleitungen P9; Spec 6; EP12, EP13, EP14, EP21).
//
// Nur node:-Module, kein Piper, kein ffmpeg, kein Netz: Der Launcher-Selbsttest (auch in der CI) prüft damit Manifest,
// Texte und Dateien. Der Erzeuger scripts/anleitung-stimme.mjs und die Bau-Prüfung scripts/pruefe-bau-stimme.mjs nutzen
// dieselben Funktionen. Piper ist zufallsbehaftet: verglichen wird nie Audio gegen Audio, sondern der Text über seine
// Prüfsumme (EP13).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Die zwei Kandidaten aus OFP1, gepinnt über die SHA-256 der .onnx (Ist-S 2.1 und 3, je aus zwei Quellen abgelesen).
 * `namensnennung` zeigt die Kapitelübersicht unter dem Stimmen-Schalter (EP21); bei de_DE-mls-medium ist sie nach
 * CC BY 4.0 Pflicht. Herkunft und Lizenzlage beider Stimmen: src/renderer/src/anleitung/stimme/HERKUNFT.md.
 */
export const STIMMEN = Object.freeze({
  'de_DE-mls-medium': Object.freeze({
    onnxSha256: '69cd1d2aa5a35839a518966fcc4924b5f93e5f8c948ed0752b1a616ad53f65bf',
    lizenz: 'CC BY 4.0',
    namensnennung: 'Stimme „de_DE-mls-medium“ aus rhasspy/piper-voices (huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/mls/medium), trainiert mit Multilingual LibriSpeech (Pratap u. a. 2020, Hörbücher von LibriVox), Lizenz CC BY 4.0 (creativecommons.org/licenses/by/4.0). Die Ansagen sind damit erzeugt.',
    quelle: 'https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/mls/medium',
  }),
  'de_DE-thorsten-medium': Object.freeze({
    onnxSha256: '7e64762d8e5118bb578f2eea6207e1a35a8e0c30595010b666f983fc87bb7819',
    lizenz: 'CC0',
    namensnennung: 'Stimme „de_DE-thorsten-medium“ aus rhasspy/piper-voices, Datensatz Thorsten-Voice von Thorsten Müller (CC0). Die Ansagen sind damit erzeugt.',
    quelle: 'https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/medium',
  }),
});

/**
 * Start-Wächter der Skripte: ist dieses Modul das Hauptmodul (modulPfad = fileURLToPath(import.meta.url))? Node löst für das Hauptmodul den Realpfad auf, process.argv[1]
 * aber nicht; über eine Junction oder einen Symlink (Checkout unter /tmp auf macOS, Arbeitsverzeichnis als Junction) liefe
 * ein Vergleich ohne realpathSync nie an, und ein Prüftor endete stumm mit Exit 0 (Fix-Runde 1 zu P11).
 */
export function istHauptmodul(modulPfad, argv1) {
  if (argv1 === undefined) return false;
  let aufruf;
  try {
    aufruf = realpathSync(argv1);
  } catch {
    return false;
  }
  return aufruf.toLowerCase() === modulPfad.toLowerCase();
}

/** SHA-256 (hex) über UTF-8 des NFC-normalisierten Textes (EP13). Nie über Datei-Bytes: Windows hat CRLF, die CI LF. */
export function textSha256(text) {
  return createHash('sha256').update(String(text).normalize('NFC'), 'utf8').digest('hex');
}

/** SHA-256 (hex) einer Datei. */
export function dateiSha256(pfad) {
  return createHash('sha256').update(readFileSync(pfad)).digest('hex');
}

/** Dateiname der Ansage zu einer Text-ID (die IDs folgen ID_MUSTER aus @jm/ui/anleitung). */
export function ansageDatei(id) {
  return `${id}.ogg`;
}

/** Manifest ohne Stimme: ein gültiger Zustand („In dieser Fassung gibt es keine Stimme.“, EP14). Jedes Mal ein neues Objekt. */
export function leeresManifest() {
  return { format: 1, stimme: null, werkzeug: null, parameter: null, eintraege: [] };
}

/** Text des Manifests: JSON mit zwei Leerzeichen, LF, Schluss-LF (G12). */
export function manifestText(m) {
  return `${JSON.stringify(m, null, 2)}\n`;
}

/** Inhalt eines Stimmen-Ordners: die .ogg mit SHA-256 und die Namen aller übrigen Dateien (fehlt der Ordner: beides leer). */
export function leseOrdner(ordner) {
  const ogg = [];
  const andere = [];
  if (!existsSync(ordner)) return { ogg, andere };
  for (const name of readdirSync(ordner).sort()) {
    if (name.endsWith('.ogg')) ogg.push({ name, sha256: dateiSha256(join(ordner, name)) });
    else andere.push(name);
  }
  return { ogg, andere };
}

const istObjekt = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Prüft, ob zu jedem gesprochenen Text genau die passende Ansage gehört (Spec 6, EP13, EP14). Wirft nie.
 *   texte:    { id, text }[] — sprechTexte(EINRICHTUNG)
 *   manifest: das geparste manifest.json
 *   dateien:  { name, sha256 }[] — die .ogg im Stimmen-Ordner (leseOrdner(...).ogg)
 *   stimmen:  Pin-Tabelle (Vorgabe STIMMEN; der Prüfstand speist eine eigene ein)
 * Ergebnis: Befunde als Text, leer = in Ordnung.
 */
export function pruefeStimme(texte, manifest, dateien, stimmen = STIMMEN) {
  if (!istObjekt(manifest) || !Array.isArray(manifest.eintraege)) return ['Manifest unlesbar: erwartet ein Objekt mit der Liste eintraege'];
  const befunde = [];
  if (manifest.format !== 1) befunde.push(`Manifest-Format unbekannt: ${JSON.stringify(manifest.format)}`);
  const ogg = new Map(dateien.map((d) => [d.name, d.sha256]));
  if (manifest.stimme === null) {
    if (manifest.werkzeug !== null || manifest.parameter !== null) befunde.push('Ohne Stimme müssen werkzeug und parameter null sein');
    for (const e of manifest.eintraege) befunde.push(`Ohne Stimme darf es keinen Eintrag geben: ${istObjekt(e) ? e.id : JSON.stringify(e)}`);
    for (const name of ogg.keys()) befunde.push(`Ohne Stimme darf es keine Datei geben: ${name}`);
    return befunde;
  }
  const s = manifest.stimme;
  const name = istObjekt(s) ? s.name : undefined;
  const pin = typeof name === 'string' && Object.hasOwn(stimmen, name) ? stimmen[name] : null;
  if (!pin || s.onnxSha256 !== pin.onnxSha256) befunde.push(`Stimme nicht gepinnt: ${typeof name === 'string' ? name : JSON.stringify(s)}`);
  else if (s.lizenz !== pin.lizenz || s.namensnennung !== pin.namensnennung) befunde.push(`Lizenz oder Namensnennung weicht vom Pin ab: ${name}`);
  if (istObjekt(s) && s.sprecher !== null && !(Number.isInteger(s.sprecher) && s.sprecher >= 0)) befunde.push(`Sprecher ungültig: ${JSON.stringify(s.sprecher)}`);
  const w = manifest.werkzeug;
  if (!istObjekt(w) || typeof w.piper !== 'string' || typeof w.ffmpeg !== 'string') befunde.push('Werkzeug fehlt im Manifest (piper, ffmpeg)');
  const p = manifest.parameter;
  if (!istObjekt(p) || ![p.lengthScale, p.sentenceSilence, p.opusKbps].every(Number.isFinite)) befunde.push('Parameter fehlen im Manifest (lengthScale, sentenceSilence, opusKbps)');
  const jeId = new Map();
  for (const e of manifest.eintraege) {
    if (!istObjekt(e) || typeof e.id !== 'string') { befunde.push(`Eintrag unlesbar: ${JSON.stringify(e)}`); continue; }
    if (jeId.has(e.id)) befunde.push(`Eintrag doppelt: ${e.id}`);
    else jeId.set(e.id, e);
  }
  const textIds = new Set();
  const benutzt = new Set();
  for (const { id, text } of texte) {
    textIds.add(id);
    const e = jeId.get(id);
    if (!e) { befunde.push(`Ansage fehlt: ${id}`); continue; }
    if (e.textSha256 !== textSha256(text)) befunde.push(`Text geändert: ${id}`);
    if (e.datei !== ansageDatei(id)) { befunde.push(`Dateiname falsch: ${id} (${e.datei})`); continue; }
    benutzt.add(e.datei);
    if (!ogg.has(e.datei)) befunde.push(`Datei fehlt: ${e.datei}`);
    else if (ogg.get(e.datei) !== e.dateiSha256) befunde.push(`Prüfsumme falsch: ${e.datei}`);
  }
  for (const id of jeId.keys()) if (!textIds.has(id)) befunde.push(`Eintrag ohne Text: ${id}`);
  for (const datei of ogg.keys()) if (!benutzt.has(datei)) befunde.push(`Datei ohne Text: ${datei}`);
  return befunde;
}
