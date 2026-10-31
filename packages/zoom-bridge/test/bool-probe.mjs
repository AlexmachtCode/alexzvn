#!/usr/bin/env node
// Belegt OHNE Meeting, dass der native Befehlsleser die beiden Schalter der Slots
// ("shareAudio", "showNoVideo") mit true UND false liest und die Werte so ankommen,
// wie sie gesendet wurden (stderr-Zeile "Felder gelesen: ...", Nachbesserung a3) - und
// dass ein Wert, der WEDER true NOCH false ist ("ja", 1, "false", trueX, falsehood),
// als slotBadFlag gemeldet wird statt still als irgendein Wert durchzugehen (Spec 6.2,
// Gliederung 3.2 Nr. 5).
//
// BELEG "GELESEN": ohne "init" endet jede gueltige slotOn-Zeile mit slotNoPrivilege
// und schreibt vorher die stderr-Zeilen "Befehl gelesen: slotOn <n>, ..." und "Felder
// gelesen: slotOn <n>, ..."; jede Zeile mit unlesbarem Schalter endet frueher mit
// slotBadFlag und OHNE diese Zeilen. slotSet ohne laufenden Slot schreibt nach der
// Feldpruefung "Felder gelesen: slotSet <n>, ..." und endet mit slotNotOn.
//
// WAS DIESER LAUF NICHT ZEIGT: ob der gelesene Wert spaeter wirkt (Ton, Ersatzbild).
// KEIN init, KEIN join, kein Netz, kein NDI-Sender (GG5).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';

const require = createRequire(import.meta.url);
// Nebenwirkung: haengt die NDI-Laufzeit an process.env.PATH (siehe
// packages/ndi/index.js). Ohne sie startet zoom-bridge.exe gar nicht.
require('@jm/ndi');

const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';
const child = spawn(binPath(), [], {
  windowsHide: true,
  env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
});

let err = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => { err += d; });
let out = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => { out += d; });

const slotOn = (nr, felder) => JSON.stringify({ cmd: 'slotOn', slot: nr, ndi: `Probe ${nr}`, mode: 'participant', resolution: '720p',
  audio: 'mix', fallback: 'black', ...felder });
child.stdin.write(`${slotOn(11, { shareAudio: true, showNoVideo: false })}\n`);
child.stdin.write(`${slotOn(12, { shareAudio: false, showNoVideo: true })}\n`);
child.stdin.write(`${slotOn(13, { shareAudio: 'ja', showNoVideo: true })}\n`);
child.stdin.write(`${slotOn(14, { shareAudio: true, showNoVideo: 1 })}\n`);
child.stdin.write(`${slotOn(15, { shareAudio: true })}\n`);
// Kein gueltiges JSON (Nachbesserung a3, NB-a3-2): der Wert endet nicht nach true bzw. false.
child.stdin.write(`${slotOn(9, { shareAudio: true, showNoVideo: true }).replace('"shareAudio":true', '"shareAudio":trueX')}\n`);
child.stdin.write(`${slotOn(10, { shareAudio: true, showNoVideo: false }).replace('"showNoVideo":false', '"showNoVideo":falsehood')}\n`);
child.stdin.write('{"cmd":"slotSet","slot":16,"shareAudio":true,"showNoVideo":false}\n');
child.stdin.write('{"cmd":"slotSet","slot":16,"showNoVideo":"false"}\n');
child.stdin.end();

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Kindprozess endete mit ${code}.`);
    console.error('Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH oder das Programm existiert nicht.');
    process.exit(1);
  }
  const fehler = out.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } })
    .filter((e) => e.ev === 'error');
  const codes = (nr) => fehler.filter((e) => e.slot === nr).map((e) => e.code);
  // Das KOMMA hinter der Nummer gehoert zum Suchmuster: "slotOn 1" faende sonst auch 11..15.
  const gelesen = (nr) => err.includes(`Befehl gelesen: slotOn ${nr},`);
  // Die gelesenen Werte (Nachbesserung a3, NB-a3-3): ein Schalter, der still kippt, faellt nur hier auf.
  const zeilen = err.split(/\r?\n/);
  const felder = (befehl, nr) => zeilen.find((z) => z.startsWith(`Felder gelesen: ${befehl} ${nr},`)) ?? '';
  const faelle = [
    ['shareAudio:true, showNoVideo:false kommen so an', gelesen(11) && codes(11).join() === 'slotNoPrivilege'
      && felder('slotOn', 11).endsWith(', Computerton ja, ohne Kamera nein, Ziel keins')],
    ['shareAudio:false, showNoVideo:true kommen so an', gelesen(12) && codes(12).join() === 'slotNoPrivilege'
      && felder('slotOn', 12).endsWith(', Computerton nein, ohne Kamera ja, Ziel keins')],
    ['shareAudio:"ja" wird als slotBadFlag gemeldet, nicht gelesen', !gelesen(13) && codes(13).join() === 'slotBadFlag'],
    ['showNoVideo:1 wird als slotBadFlag gemeldet, nicht gelesen', !gelesen(14) && codes(14).join() === 'slotBadFlag'],
    ['slotOn ohne showNoVideo ist ein Fehler (Pflichtfeld)', !gelesen(15) && codes(15).join() === 'slotBadFlag'],
    ['shareAudio:trueX (der Wert endet nicht nach true) ist slotBadFlag, nicht gelesen', !gelesen(9) && codes(9).join() === 'slotBadFlag'],
    ['showNoVideo:falsehood (der Wert endet nicht nach false) ist slotBadFlag, nicht gelesen', !gelesen(10) && codes(10).join() === 'slotBadFlag'],
    ['slotSet liest beide Schalter wie gesendet (danach slotNotOn), "false" als Text ist slotBadFlag',
      felder('slotSet', 16) === 'Felder gelesen: slotSet 16, Computerton ja, ohne Kamera nein' && codes(16).join() === 'slotNotOn,slotBadFlag'],
  ];
  let schlecht = 0;
  for (const [name, ok] of faelle) {
    console.log(`  [${name}] ${ok ? 'OK' : 'FEHLGESCHLAGEN'}`);
    if (!ok) schlecht++;
  }
  if (schlecht > 0) {
    console.error('\nFEHLGESCHLAGEN — die Schalter der Slots kommen nicht wie erwartet an.');
    console.error('Rohausgabe stderr:\n' + err);
    console.error('Rohausgabe stdout:\n' + out);
    process.exit(2);
  }
  console.log('\nOK — der native Befehlsleser liest die Schalter der Slots.');
});
