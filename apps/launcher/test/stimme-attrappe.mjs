// Prüfstand für scripts/anleitung-stimme.mjs (Plan Geführte Anleitungen P10): ersetzt Piper und ffmpeg im Test.
//   node test/stimme-attrappe.mjs piper -m <onnx> -i <text.txt> -f <aus.wav> [--sentence-silence s] [--length-scale f] [-s n]
//   node test/stimme-attrappe.mjs ffmpeg … -i <ein.wav> … <aus.ogg>
// piper: verlangt wie Piper 1.8.0 die Konfiguration <onnx>.json daneben, liest den Text als UTF-8 und schreibt eine gültige
// WAV (PCM 16 Bit, mono, 22 050 Hz, 10 ms je Zeichen), fast nur Stille: die ersten Proben tragen die UTF-8-Bytes des
// Textes, damit verschiedene Texte verschiedene Dateien ergeben; gleiche Eingabe → gleiche Bytes. ffmpeg: schreibt „OggS“
// und dahinter die Bytes der WAV.
// JM_ATTRAPPE_PROTOKOLL=<datei>: je Aufruf eine Zeile JSON { werkzeug, args, text? }.
// JM_ATTRAPPE_FEHLER=piper|ffmpeg: genau dieses Werkzeug endet mit Code 3 und einer Meldung auf stderr.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const [werkzeug, ...args] = process.argv.slice(2);
const wert = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const raus = (code, meldung) => {
  process.stderr.write(`${meldung}\n`);
  process.exit(code);
};
const text = werkzeug === 'piper' && wert('-i') && existsSync(wert('-i')) ? readFileSync(wert('-i'), 'utf8') : undefined;
if (process.env.JM_ATTRAPPE_PROTOKOLL) appendFileSync(process.env.JM_ATTRAPPE_PROTOKOLL, `${JSON.stringify({ werkzeug, args, text })}\n`);
if (process.env.JM_ATTRAPPE_FEHLER === werkzeug) raus(3, `Attrappe: absichtlicher Fehler in ${werkzeug}`);

if (werkzeug === 'piper') {
  const modell = wert('-m');
  const aus = wert('-f');
  if (!modell || text === undefined || !aus) raus(2, 'Attrappe piper: -m, -i (lesbar) und -f sind Pflicht');
  if (!existsSync(`${modell}.json`)) raus(2, `Attrappe piper: Konfiguration ${modell}.json fehlt`);
  const proben = 220 * [...text].length;
  const kopf = Buffer.alloc(44);
  kopf.write('RIFF', 0, 'ascii');
  kopf.writeUInt32LE(36 + proben * 2, 4);
  kopf.write('WAVE', 8, 'ascii');
  kopf.write('fmt ', 12, 'ascii');
  kopf.writeUInt32LE(16, 16);
  kopf.writeUInt16LE(1, 20);
  kopf.writeUInt16LE(1, 22);
  kopf.writeUInt32LE(22050, 24);
  kopf.writeUInt32LE(44100, 28);
  kopf.writeUInt16LE(2, 32);
  kopf.writeUInt16LE(16, 34);
  kopf.write('data', 36, 'ascii');
  kopf.writeUInt32LE(proben * 2, 40);
  const daten = Buffer.alloc(proben * 2);
  Buffer.from(text, 'utf8').copy(daten, 0, 0, daten.length);
  writeFileSync(aus, Buffer.concat([kopf, daten]));
} else if (werkzeug === 'ffmpeg') {
  const ein = wert('-i');
  const aus = args.at(-1);
  if (!ein || !existsSync(ein) || !aus) raus(2, 'Attrappe ffmpeg: Eingabe fehlt');
  writeFileSync(aus, Buffer.concat([Buffer.from('OggS', 'ascii'), readFileSync(ein)]));
} else {
  raus(2, `Attrappe: unbekanntes Werkzeug ${werkzeug}`);
}
