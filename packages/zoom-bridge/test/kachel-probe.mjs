#!/usr/bin/env node
// Musterprobe der Zoom-Kachel (#306): startet die gebaute Bridge im Sonderweg `--kachel-muster <ordner>` und
// prüft, was sie schreibt. OHNE Zoom-Anmeldung, OHNE Meeting, OHNE NDI-Sender – der Sonderweg zeichnet nur die
// 21 Musterkacheln mit Direct2D/DirectWrite, wandelt sie in I420 und zurück (genau das Bild, das der Mischer
// sieht) und legt sie als PNG ab. Die Bilder selbst sieht sich ein Mensch an; diese Probe prüft, was sich ohne
// Augen prüfen lässt: Exitcode, Schlusszeile, Dateien samt Maßen, die Fehlerzeilen der kaputten Profilbilder und
// dass keine Logzeile einen Namen oder Dateinamen trägt.
//
// Aufruf: node test/kachel-probe.mjs [--exe <pfad>] [<ordner>]
//   --exe     Bridge-Programm (Vorgabe: binPath() aus src/bridge.ts, also build/Release/zoom-bridge.exe)
//   <ordner>  Zielordner der Musterkacheln (Vorgabe: <Temp>/jm-kachel-muster-<pid>); bleibt nach dem Lauf stehen.
//
// Rückgabe: 0 = alles grün, 1 = mindestens ein Befund (je Befund eine FAIL-Zeile).
import { spawn } from 'node:child_process';
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { binPath } from '../src/bridge.ts';
import { LineSplitter } from '../src/protocol.ts';

// Nebenwirkung: hängt die NDI-Laufzeit vorn an process.env.PATH (packages/ndi/index.js). zoom-bridge.exe ist
// gegen die NDI-Importbibliothek gebunden; ohne die DLL startet sie gar nicht (STATUS_DLL_NOT_FOUND,
// 0xC0000135), auch wenn der Sonderweg nie einen NDI-Sender aufmacht – wie in test/command-probe.mjs.
const require = createRequire(import.meta.url);
require('@jm/ndi');

// Aus demselben Grund %ZOOM_SDK_DIR%\x64\bin vorn auf PATH: der Lader löst die Zoom-SDK-DLL beim Prozessstart
// auf, vor main(), obwohl der Sonderweg InitSDK nie ruft (Muster test/ndi-probe.mjs).
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';

const ZEITGRENZE_MS = 60_000;

// --- Befehlszeile ------------------------------------------------------------------------------------------
let exe = binPath();
let ordner = join(tmpdir(), `jm-kachel-muster-${process.pid}`);
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--exe') {
      if (i + 1 >= args.length) {
        console.error('kachel-probe: --exe ohne Pfad');
        process.exit(1);
      }
      exe = args[++i];
    } else {
      ordner = args[i];
    }
  }
}

// --- Erwartung ---------------------------------------------------------------------------------------------
// Datei → [Breite, Höhe, erwarteter Profilbild-Befund laut stdout-Zeile].
const ERWARTET = new Map();
for (const [stufe, w, h] of [['360p', 640, 360], ['720p', 1280, 720], ['1080p', 1920, 1080]]) {
  ERWARTET.set(`${stufe}-mit-profilbild.png`, [w, h, 'keiner']);
  ERWARTET.set(`${stufe}-initialen.png`, [w, h, 'keinPfad']);
  ERWARTET.set(`${stufe}-langer-name.png`, [w, h, 'keinPfad']);
  ERWARTET.set(`${stufe}-bild-unterbrochen.png`, [w, h, 'keiner']);
}
ERWARTET.set('720p-kaputtes-profilbild.png', [1280, 720, 'unlesbar']);
ERWARTET.set('720p-riesiges-profilbild.png', [1280, 720, 'zuGross']);
ERWARTET.set('720p-fehlendes-profilbild.png', [1280, 720, 'fehlt']);
ERWARTET.set('360x640-initialen.png', [360, 640, 'keinPfad']);
ERWARTET.set('640x480-mit-profilbild.png', [640, 480, 'keiner']);
ERWARTET.set('320x180-initialen.png', [320, 180, 'keinPfad']);
ERWARTET.set('720p-chinesisch.png', [1280, 720, 'keinPfad']);
ERWARTET.set('720p-arabisch.png', [1280, 720, 'keinPfad']);
ERWARTET.set('720p-nur-emoji.png', [1280, 720, 'keinPfad']);

const SCHLUSSZEILE = '{"ev":"kachelMuster","fertig":true,"dateien":21,"gleichInitialen":true}';

// --- Lauf --------------------------------------------------------------------------------------------------
const stdoutZeilen = [];
const stderrZeilen = [];
let spawnFehler = null;
let zeitUeberschritten = false;

const exitCode = await new Promise((resolve) => {
  const child = spawn(exe, ['--kachel-muster', ordner], {
    windowsHide: true,
    env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // stdin sofort zu: ohne Sonderweg endet die Bridge so am stdin-EOF, statt auf Befehle zu warten (Rot-Fall).
  child.stdin.on('error', () => { /* Kind schon weg – zählt über den Exitcode */ });
  child.stdin.end();
  const aus = new LineSplitter();
  const fehl = new LineSplitter();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    for (const z of aus.push(d)) {
      stdoutZeilen.push(z);
      console.log(`  bridge: ${z}`);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => {
    for (const z of fehl.push(d)) {
      stderrZeilen.push(z);
      console.log(`  [bridge] ${z}`);
    }
  });
  const sicherung = setTimeout(() => {
    zeitUeberschritten = true;
    try { child.kill(); } catch { /* schon weg */ }
  }, ZEITGRENZE_MS);
  child.on('error', (e) => {
    spawnFehler = e;
    clearTimeout(sicherung);
    resolve(null);
  });
  child.on('close', (code) => {
    clearTimeout(sicherung);
    // Ein Rest ohne Zeilenende zählt als letzte Zeile (LineSplitter hält ihn bis zum nächsten '\n').
    for (const z of aus.push('\n')) stdoutZeilen.push(z);
    for (const z of fehl.push('\n')) stderrZeilen.push(z);
    resolve(code);
  });
});

// --- Prüfen ------------------------------------------------------------------------------------------------
const befunde = [];
const fail = (text) => befunde.push(text);

if (spawnFehler) fail(`Bridge nicht startbar (${spawnFehler.message}) – Programm ${exe}`);
if (zeitUeberschritten) fail(`Zeitgrenze ${ZEITGRENZE_MS / 1000} s überschritten, Bridge abgebrochen`);

// 1. Exitcode und Schlusszeile
if (exitCode !== 0) fail(`Exitcode ${exitCode}, erwartet 0`);
const letzte = stdoutZeilen.length > 0 ? stdoutZeilen[stdoutZeilen.length - 1].trim() : '';
if (letzte !== SCHLUSSZEILE) fail(`letzte stdout-Zeile ist ${letzte === '' ? '(keine)' : letzte}, erwartet ${SCHLUSSZEILE}`);

// 2. die 21 PNG: Signatur, Breite × Höhe aus dem IHDR (Bytes 16–23), dazu die stdout-Zeile des Falls
const PNG_SIGNATUR = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const faelle = new Map();
for (const z of stdoutZeilen) {
  let ev = null;
  try { ev = JSON.parse(z); } catch { continue; }
  if (ev && ev.ev === 'kachelMuster' && typeof ev.datei === 'string') faelle.set(ev.datei, ev);
}
for (const [datei, [w, h, profilbild]] of ERWARTET) {
  const pfad = join(ordner, datei);
  if (!existsSync(pfad)) {
    fail(`${datei} fehlt`);
    continue;
  }
  const kopf = Buffer.alloc(24);
  let gelesen = 0;
  try {
    const fd = openSync(pfad, 'r');
    try { gelesen = readSync(fd, kopf, 0, 24, 0); } finally { closeSync(fd); }
  } catch (e) {
    fail(`${datei} nicht lesbar (${e instanceof Error ? e.message : String(e)})`);
    continue;
  }
  if (gelesen < 24 || !kopf.subarray(0, 8).equals(PNG_SIGNATUR) || kopf.toString('latin1', 12, 16) !== 'IHDR') {
    fail(`${datei} ist kein PNG mit IHDR am Anfang`);
    continue;
  }
  const iw = kopf.readUInt32BE(16);
  const ih = kopf.readUInt32BE(20);
  if (iw !== w || ih !== h) fail(`${datei} ist ${iw}×${ih}, erwartet ${w}×${h}`);
  const ev = faelle.get(datei);
  if (!ev) fail(`${datei}: keine stdout-Zeile {"ev":"kachelMuster","datei":…}`);
  else if (ev.w !== w || ev.h !== h || ev.profilbild !== profilbild || typeof ev.ms !== 'number') {
    fail(`${datei}: stdout-Zeile ${JSON.stringify(ev)}, erwartet w ${w}, h ${h}, profilbild "${profilbild}", ms als Zahl`);
  }
}
if (faelle.size !== ERWARTET.size) fail(`${faelle.size} Fall-Zeilen auf stdout, erwartet ${ERWARTET.size}`);

// 3. stderr: genau drei Zeilen „Profilbild nicht verwendet“, je eine je Fehler; kein Name, kein Dateiname
const nichtVerwendet = stderrZeilen.filter((z) => z.includes('Profilbild nicht verwendet'));
if (nichtVerwendet.length !== 3) fail(`${nichtVerwendet.length} stderr-Zeilen „Profilbild nicht verwendet“, erwartet 3`);
for (const art of ['(unlesbar', '(zuGross', '(fehlt']) {
  const n = nichtVerwendet.filter((z) => z.includes(art)).length;
  if (n !== 1) fail(`${n} stderr-Zeilen „Profilbild nicht verwendet ${art}…“, erwartet 1`);
}
for (const z of stderrZeilen) {
  for (const verboten of ['Anna', 'Müller', '.png']) {
    if (z.includes(verboten)) fail(`stderr-Zeile nennt „${verboten}“: ${z}`);
  }
}

if (befunde.length > 0) {
  for (const b of befunde) console.error(`FAIL kachel-probe: ${b}`);
  process.exit(1);
}
console.log(`kachel-probe: 21 Musterkacheln in ${ordner} – alle Prüfungen grün`);
process.exit(0);
