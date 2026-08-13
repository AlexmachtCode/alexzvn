#!/usr/bin/env node
// Prueft OHNE Zoom, OHNE Meeting und OHNE Anmeldung, dass die Bridge einen
// NDI-Sender aufmacht, den ein anderer Prozess auch FINDET. Sucht mit dem
// bestehenden Addon aus packages/ndi - das ist ein unabhaengiger Zeuge:
// derselbe Code, mit dem der Switcher seine Quellen findet.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';

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

// ABWEICHUNG VOM BRIEF, GEMESSEN: zoom-bridge.exe ist gegen sdk.lib
// (Zoom-SDK-Importbibliothek) UND jetzt zusaetzlich gegen die NDI-Importbibliothek
// gebunden - der Windows-Lader loest ALLE eingebundenen DLLs beim Prozessstart
// auf, unabhaengig davon, ob --ndi-selftest je eine Zoom-Funktion aufruft. Ohne
// %ZOOM_SDK_DIR%\x64\bin auf PATH scheitert der Start mit STATUS_DLL_NOT_FOUND
// (0xC0000135), GEMESSEN vor dieser Zeile: der Kindprozess kam nie bis zur
// ersten emitRaw()-Zeile, weder auf stdout noch auf stderr - ein Fehlschlag,
// der von einem falschen NDI-Quellnamen (Schritt 7, Mutationsprobe) sonst nicht
// zu unterscheiden waere. Dieselbe Anforderung dokumentiert bereits README.md
// Abschnitt 8 und loest bereits test/join.mjs auf demselben Weg
// (env.PATH = "<sdk>/x64/bin;" + process.env.PATH). Hier derselbe Weg, nur mit
// dem bereits (durch require('@jm/ndi') oben) um die NDI-Laufzeit erweiterten
// process.env als Grundlage, damit beide Erweiterungen gemeinsam gelten.
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';
const child = spawn(binPath(), ['--ndi-selftest'], {
  windowsHide: true,
  env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
});
child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => process.stdout.write(`  bridge: ${d}`));
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

await new Promise((r) => child.on('exit', r));

if (gefunden) {
  console.log(`\nOK — die Quelle "${ERWARTET}" war im Netz auffindbar.`);
  process.exit(0);
}
console.error(`\nFEHLGESCHLAGEN — die Quelle "${ERWARTET}" wurde nicht gefunden.`);
process.exit(1);
