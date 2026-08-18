#!/usr/bin/env node
// Prueft OHNE Zoom, OHNE Meeting und OHNE Anmeldung, dass die Bridge einen
// NDI-Sender aufmacht, den ein anderer Prozess auch FINDET. Sucht mit dem
// bestehenden Addon aus packages/ndi - das ist ein unabhaengiger Zeuge:
// derselbe Code, mit dem der Switcher seine Quellen findet.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';
import { LineSplitter, parseWireEvent } from '../src/protocol.ts';

const require = createRequire(import.meta.url);
// Laedt das native NDI-Addon UND haengt dabei (Nebenwirkung von
// packages/ndi/index.js, ensureNdiRuntimeOnPath()) das Verzeichnis der
// NDI-Laufzeit-DLL vorn an process.env.PATH - fuer DIESEN Prozess. Der
// Spawn unten erbt process.env und damit auch diese Erweiterung, SOFERN wir
// PATH weiter unten nicht durch ein eigenes env-Objekt ersetzen, ohne es
// wieder mit hineinzunehmen.
const ndi = require('@jm/ndi');

// ABWEICHUNG VOM BRIEF, GEMESSEN: Name OHNE Doppelpunkt - siehe den
// gleichlautenden Kommentar bei s.open(...) in native/main.cpp. Die NDI-SDK
// ersetzt ':' im Quellnamen durch ein Leerzeichen (Quellname dient zugleich
// als mDNS/Bonjour-Dienstname); mit Doppelpunkt haette dieser Pruefstand auf
// KEINEM Rechner je "gefunden" liefern koennen. Muss mit dem Namen in
// native/main.cpp (s.open(...)) uebereinstimmen.
const ERWARTET = 'JM Connect – Zoom Selbsttest';

// ABWEICHUNG VOM BRIEF, GEMESSEN: --ndi-selftest ruft Zooms InitSDK NIE auf,
// BRAUCHT die Zoom-SDK-DLL aber trotzdem zum Laden - zoom-bridge.exe ist
// weiterhin gegen sdk.lib (Zoom-SDK-Importbibliothek) UND jetzt zusaetzlich
// gegen die NDI-Importbibliothek gebunden, und der Windows-Lader loest ALLE
// eingebundenen DLLs beim Prozessstart auf, BEVOR main() ueberhaupt laeuft -
// unabhaengig davon, ob der Code den Zoom-Teil je aufruft. Ohne
// %ZOOM_SDK_DIR%\x64\bin auf PATH scheitert der Start deshalb mit
// STATUS_DLL_NOT_FOUND (0xC0000135) - ein Zoom-EINRICHTUNGSFEHLER, der sich
// sonst als "NDI-Quelle nicht gefunden" tarnen wuerde (siehe die
// Ursachen-Unterscheidung weiter unten, die genau das auseinanderhaelt).
// GEMESSEN vor dieser Zeile: der Kindprozess kam nie bis zur ersten
// emitRaw()-Zeile, weder auf stdout noch auf stderr. Dieselbe Abhaengigkeit
// dokumentiert bereits README.md Abschnitt 8 und loest bereits test/join.mjs
// auf demselben Weg (env.PATH = "<sdk>/x64/bin;" + process.env.PATH). Hier
// derselbe Weg, nur mit dem bereits (durch require('@jm/ndi') oben) um die
// NDI-Laufzeit erweiterten process.env als Grundlage, damit beide
// Erweiterungen gemeinsam gelten.
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';
const child = spawn(binPath(), ['--ndi-selftest'], {
  windowsHide: true,
  env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
});
// NACHBESSERUNG (Runde 1, Befund 1): Exitcode UND Rohausgabe des Kindes
// werden ausgewertet, nicht nur "wurde die Quelle gefunden" - vorher meldeten
// ein falscher Name, ein nicht startender Prozess (z. B. fehlendes
// %ZOOM_SDK_DIR%\x64\bin auf PATH, siehe Kommentar oben) und ein
// fehlgeschlagenes NDIlib_initialize() alle DIESELBE Meldung
// "FEHLGESCHLAGEN ... wurde nicht gefunden" - drei Ursachen hinter einem
// Namen, gegen die Kernregel "eine Ursache, ein Name". Mitgelesen wird per
// LineSplitter/parseWireEvent (derselbe Zerleger wie in src/bridge.ts), nicht
// per Text-Grep auf die Rohzeile.
let sawSending = false;
let sawNdiInitFailed = false;
let sawVideoSenderFailed = false;
let spawnError = null;
const splitter = new LineSplitter();

// NUR aufgesetzt, NICHT hier schon abgewartet - das muss NACH der
// Sucheschleife unten passieren, sonst wuerde auf das Prozessende gewartet,
// BEVOR ueberhaupt einmal gesucht wurde, und die zwei Sekunden Sendezeit
// waeren fuer die Suche verloren.
const exitPromise = new Promise((resolve) => {
  child.on('exit', (code) => resolve(code));
  // Eine gescheiterte spawn() (z. B. binPath() zeigt ins Leere) darf nicht
  // als unbeantwortete Promise haengen bleiben - dann waere aus einem
  // gemeldeten Fehler ein STILLER Haenger geworden.
  child.on('error', (e) => {
    spawnError = e;
    resolve(null);
  });
});

child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => {
  process.stdout.write(`  bridge: ${d}`);
  for (const line of splitter.push(d)) {
    const ev = parseWireEvent(line);
    if (!ev) continue;
    if (ev.ev === 'ndiSelftest' && ev.state === 'sending') sawSending = true;
    if (ev.ev === 'error' && ev.code === 'ndiInitFailed') sawNdiInitFailed = true;
    if (ev.ev === 'error' && ev.code === 'videoSenderFailed') sawVideoSenderFailed = true;
  }
});
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => process.stderr.write(`  [bridge] ${d}`));

// Der Sender sendet zwei Sekunden. Innerhalb dieser Zeit mehrfach suchen:
// NDI-Erkennung im Netz braucht ein paar hundert Millisekunden.
let gefunden = false;
for (let i = 0; i < 8 && !gefunden; i++) {
  for (const s of ndi.findSources(250)) {
    if (String(s).includes(ERWARTET)) gefunden = true;
  }
}

const exitCode = await exitPromise;

if (gefunden) {
  console.log(`\nOK — die Quelle "${ERWARTET}" war im Netz auffindbar.`);
  process.exit(0);
}

// Ab hier: NICHT gefunden. Vier unterscheidbare Ursachen, vier Meldungen,
// vier Rueckgabewerte - siehe Kommentar oben.
if (sawNdiInitFailed) {
  console.error(`\nEINRICHTUNGSFEHLER — die NDI-Laufzeit fehlt auf diesem Rechner (ndiInitFailed).`);
  process.exit(2);
}
if (sawVideoSenderFailed) {
  console.error(`\nEINRICHTUNGSFEHLER — NDIlib_send_create ist fehlgeschlagen (videoSenderFailed).`);
  process.exit(4);
}
if (!sawSending) {
  const grund = spawnError ? `spawn-Fehler: ${spawnError.message}` : `Exitcode ${exitCode}`;
  console.error(
    `\nEINRICHTUNGSFEHLER — die Bridge kam nie bis "sending" (${grund}). ` +
      'Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH (siehe Kommentar oben) oder das Programm existiert nicht.',
  );
  process.exit(3);
}
console.error(`\nFEHLGESCHLAGEN — die Quelle "${ERWARTET}" wurde nicht gefunden.`);
process.exit(1);
