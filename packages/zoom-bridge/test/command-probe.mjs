#!/usr/bin/env node
// Prueft den nativen Befehlsleser der Slots (main.cpp/session.cpp) OHNE Zoom, OHNE
// Meeting und OHNE Zugangsdaten: startet die frisch gebaute .exe roh (KEIN "init"),
// schickt ihr je Fall GENAU eine Befehlszeile ueber stdin und liest die Antwort auf
// stdout und die Zeile "Befehl gelesen: slotOn ..." auf stderr.
//
// WARUM DAS OHNE MEETING FUNKTIONIERT: slotOn prueft in der Reihenfolge der
// Gliederung 3.2 (Spec 6.2) erst alle Felder (1.-7.), schreibt dann die stderr-Zeile
// und prueft erst danach Sperre und Erlaubnis. Ohne "init" bleibt
// sessionCanRecordRaw() IMMER false - jeder GUELTIGE slotOn endet darum mit
// slotNoPrivilege. Das ist der Beleg, dass alle Felder gelesen wurden; jede
// ungueltige Zeile endet frueher mit ihrem eigenen Schluessel. slotSet und slotOff
// enden ohne laufenden Slot mit slotNotOn.
//
// DIE FAELLE kommen aus test/slot-pruefung-faelle.json - derselben Tabelle, die der
// Selbsttest gegen die Attrappe faehrt (A-EP12): ein Vertrag, zwei Umsetzungen,
// getrennt gemessen. Faelle, die laufende Slots oder die Renderer-Sperre brauchen
// (slotNameTaken, slotAlreadyOn, slotReconnecting), sind ohne Meeting nicht
// erreichbar und werden mit einer Zeile uebersprungen. Faelle fuer Befehle, die erst
// eine spaetere Aufgabe einfuehrt (NOCH_NICHT), ebenso. Dazu kommen unten die Faelle,
// die nur die echte Bridge pruefen kann (genauer Text der stderr-Zeilen samt der
// gelesenen Werte, Zeilen ohne gueltiges JSON; Nachbesserung a3); jeder Vertragsfall
// steht in der Tabelle (Nachbesserung a1). Eine Bestaetigung (speakerConfig,
// previewMode) muss die gesendeten Werte tragen (Spec 6.3 „wie gesendet“).
//
// KEIN init, KEIN join, kein Netz, kein NDI-Sender (GG5).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';
import { LineSplitter, parseWireEvent } from '../src/protocol.ts';

// Nebenwirkung: haengt die NDI-Laufzeit an process.env.PATH (packages/ndi/index.js).
// Ohne sie startet zoom-bridge.exe gar nicht (STATUS_DLL_NOT_FOUND, 0xC0000135).
const require = createRequire(import.meta.url);
require('@jm/ndi');

// Ohne %ZOOM_SDK_DIR%\x64\bin scheitert der Prozessstart aus demselben Grund.
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';

const OHNE_MEETING_UNERREICHBAR = new Set(['slotNameTaken', 'slotAlreadyOn', 'slotReconnecting']);
// Befehle der Tabelle, die erst A12 (speakerConfig) und A13 (previewMode) einfuehren.
const NOCH_NICHT = new Set(['speakerConfig', 'previewMode']);

/**
 * Startet die Bridge frisch, schickt eine Zeile, sammelt Ereignisse und stderr und
 * beendet sie nach 300 ms ueber "quit". Jeder Fall bekommt seinen EIGENEN Prozess.
 */
function lauf(zeile) {
  return new Promise((resolve) => {
    let fertig = false;
    const ende = (r) => { if (!fertig) { fertig = true; resolve(r); } };
    const child = spawn(binPath(), [], {
      windowsHide: true,
      env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const ereignisse = [];
    let fehler = '';
    let spawnError = null;
    const splitter = new LineSplitter();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      for (const l of splitter.push(d)) {
        const ev = parseWireEvent(l);
        if (ev) ereignisse.push(ev);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => { fehler += d; });
    child.on('error', (e) => { spawnError = e; });
    child.on('exit', () => ende({ ereignisse, fehler, spawnError }));
    const sicherung = setTimeout(() => {
      try { child.kill(); } catch { /* schon weg */ }
      ende({ ereignisse, fehler, spawnError: spawnError ?? new Error('Zeitueberschreitung: kein Prozessende') });
    }, 5000);
    sicherung.unref?.();
    child.stdin.write(`${zeile}\n`);
    setTimeout(() => {
      try {
        child.stdin.write('{"cmd":"quit"}\n');
        child.stdin.end();
      } catch { /* Kind ist schon weg */ }
    }, 300);
  });
}

const tabelle = JSON.parse(readFileSync(new URL('./slot-pruefung-faelle.json', import.meta.url), 'utf8'));

// Faelle nur fuer die echte Bridge (ohne init), die die Attrappe nicht nachbildet:
// (a) der GENAUE Text der stderr-Zeilen „Befehl gelesen: …“ (A-EP3) und „Felder gelesen: …“ mit den gelesenen Werten
//     (Nachbesserung a3, NB-a3-3): so faellt ein still verlorener oder vertauschter Wert auf (1080p als 720p, false
//     als true, weiss als schwarz); jede Aufloesung und jedes Ersatzbild kommt einmal vor;
// (b) eine Zeile, die kein gueltiges JSON ist (fuehrende Null): die Attrappe antwortet parse/badJson, die EXE prueft
//     das Wertende selbst (NB-a3-2; trueX und falsehood prueft bool-probe).
// Jeder Vertragsfall der Pruefreihenfolge steht in der Tabelle (Nachbesserung a1). previewMode {on:true} startet
// COM/WIC und steht darum in keiner der beiden Listen (A13).
const vollerSlotOn = (nr, extra = {}) => JSON.stringify({ cmd: 'slotOn', slot: nr, ndi: 'JM Connect – Zoom Probe', mode: 'participant', id: 42,
  resolution: '720p', audio: 'mix', shareAudio: true, fallback: 'transparent', showNoVideo: true, ...extra });
// Der Befehl einer Zeile ohne JSON.parse: der Fall mit fuehrender Null ist absichtlich kein gueltiges JSON.
const befehlVon = (zeile) => /"cmd"\s*:\s*"(\w+)"/.exec(zeile)?.[1] ?? '';
const nurExe = [
  { name: 'gueltiger slotOn -> stderr-Zeilen, dann slotNoPrivilege', zeile: vollerSlotOn(3), where: 'slot', code: 'slotNoPrivilege', mitSlot: true, stderr: true,
    stderrText: ['Befehl gelesen: slotOn 3, Modus participant, Ton mix',
      'Felder gelesen: slotOn 3, Aufloesung 720p, Ersatzbild transparent, Computerton ja, ohne Kamera ja, Ziel 42'] },
  { name: 'gueltiger slotOn ohne id (kein Ziel) -> slotNoPrivilege', zeile: vollerSlotOn(4, { id: undefined, mode: 'speaker', audio: 'off' }),
    where: 'slot', code: 'slotNoPrivilege', mitSlot: true, stderr: true,
    stderrText: ['Befehl gelesen: slotOn 4, Modus speaker, Ton off',
      'Felder gelesen: slotOn 4, Aufloesung 720p, Ersatzbild transparent, Computerton ja, ohne Kamera ja, Ziel keins'] },
  { name: 'slotOn 1080p, weiss, beide Schalter aus -> Werte wie gesendet',
    zeile: vollerSlotOn(5, { id: 7, resolution: '1080p', audio: 'person', shareAudio: false, fallback: 'white', showNoVideo: false }),
    where: 'slot', code: 'slotNoPrivilege', mitSlot: true, stderr: true,
    stderrText: ['Befehl gelesen: slotOn 5, Modus participant, Ton person',
      'Felder gelesen: slotOn 5, Aufloesung 1080p, Ersatzbild white, Computerton nein, ohne Kamera nein, Ziel 7'] },
  { name: 'slotOn 360p, eingefroren, Freigabe -> Werte wie gesendet', zeile: vollerSlotOn(7, { id: undefined, mode: 'share', resolution: '360p', fallback: 'freeze' }),
    where: 'slot', code: 'slotNoPrivilege', mitSlot: true, stderr: true,
    stderrText: ['Befehl gelesen: slotOn 7, Modus share, Ton mix',
      'Felder gelesen: slotOn 7, Aufloesung 360p, Ersatzbild freeze, Computerton ja, ohne Kamera ja, Ziel keins'] },
  { name: 'slotOn schwarz -> Wert wie gesendet', zeile: vollerSlotOn(8, { fallback: 'black' }), where: 'slot', code: 'slotNoPrivilege', mitSlot: true, stderr: true,
    stderrText: ['Felder gelesen: slotOn 8, Aufloesung 720p, Ersatzbild black, Computerton ja, ohne Kamera ja, Ziel 42'] },
  { name: 'slotSet mit allen Feldern ohne laufenden Slot -> Werte wie gesendet, dann slotNotOn',
    zeile: JSON.stringify({ cmd: 'slotSet', slot: 9, mode: 'speaker', id: 42, resolution: '360p', audio: 'off', shareAudio: false, fallback: 'black', showNoVideo: false }),
    where: 'slot', code: 'slotNotOn', mitSlot: true, stderr: false,
    stderrText: ['Felder gelesen: slotSet 9, Modus speaker, Ton off, Aufloesung 360p, Ersatzbild black, Computerton nein, ohne Kamera nein, Ziel 42'] },
  { name: 'slotSet nur 1080p -> nur dieses Feld, dann slotNotOn', zeile: '{"cmd":"slotSet","slot":10,"resolution":"1080p"}',
    where: 'slot', code: 'slotNotOn', mitSlot: true, stderr: false, stderrText: ['Felder gelesen: slotSet 10, Aufloesung 1080p'] },
  { name: 'slot 01 (fuehrende Null, kein JSON) -> slotBadNumber ohne slot', zeile: vollerSlotOn(1).replace('"slot":1,', '"slot":01,'),
    where: 'slot', code: 'slotBadNumber', mitSlot: false, stderr: false },
];

/** Aus einem Tabellenfall die Erwartung an die echte Bridge ohne init. */
function erwartung(fall) {
  if (fall.ev && fall.ev !== 'error') return { ...fall, bestaetigung: fall.ev };
  if (typeof fall.code === 'string' || typeof fall.code === 'number') return fall;
  // Ein Fall ohne Fehler (gueltige Zeile) endet ohne init mit dem ersten Schritt nach 7.
  const cmd = befehlVon(fall.zeile);
  if (cmd === 'slotOn') return { ...fall, where: 'slot', code: 'slotNoPrivilege', mitSlot: true, stderr: true };
  if (cmd === 'slotSet' || cmd === 'slotOff') return { ...fall, where: 'slot', code: 'slotNotOn', mitSlot: true, stderr: false };
  return { ...fall, bestaetigung: cmd };
}

let schlecht = 0;
let spawnFehler = null;
let gelaufen = 0;
let uebersprungen = 0;
for (const roh of [...tabelle, ...nurExe]) {
  const fall = erwartung(roh);
  if (OHNE_MEETING_UNERREICHBAR.has(fall.code)) {
    console.log(`  [${fall.name}] uebersprungen: ${fall.code} braucht laufende Slots oder die Renderer-Sperre`);
    uebersprungen++;
    continue;
  }
  const befehl = befehlVon(fall.zeile);
  if (NOCH_NICHT.has(befehl)) {
    console.log(`  [${fall.name}] uebersprungen: ${befehl} kommt mit einer spaeteren Aufgabe`);
    uebersprungen++;
    continue;
  }
  const r = await lauf(fall.zeile);
  gelaufen++;
  if (r.spawnError && !spawnFehler) spawnFehler = r.spawnError;
  const err = r.ereignisse.find((e) => e.ev === 'error');
  const zeileDa = /Befehl gelesen: slotOn /.test(r.fehler);
  const stderrZeilen = r.fehler.split(/\r?\n/);
  let ok;
  let gesehen;
  let soll;
  if (fall.bestaetigung) {
    // „wie gesendet“ (Spec 6.3; Nachbesserung a3, NB-a3-3): jedes gesendete Feld ausser cmd steht gleich in der
    // Bestaetigung. speakerConfig meldet aus dem gespeicherten Zustand - eine verlorene Haltezeit faellt so auf.
    const gesendet = JSON.parse(fall.zeile);
    const felder = Object.keys(gesendet).filter((k) => k !== 'cmd');
    const echo = r.ereignisse.find((e) => e.ev === fall.bestaetigung);
    ok = !err && !!echo && felder.every((k) => echo[k] === gesendet[k]);
    soll = `Bestaetigung ${fall.bestaetigung} ${felder.map((k) => `${k}=${gesendet[k]}`).join(' ')}`;
    gesehen = err ? `${err.where}/${err.code}` : echo ? `${echo.ev} ${felder.map((k) => `${k}=${echo[k]}`).join(' ')}` : (r.ereignisse.map((e) => e.ev).join(',') || '(nichts)');
  } else {
    const texte = fall.stderrText ?? [];
    ok = !!err && err.where === fall.where && err.code === fall.code && ('slot' in err) === fall.mitSlot && zeileDa === fall.stderr &&
      texte.every((t) => stderrZeilen.includes(t));
    soll = `${fall.where}/${fall.code}${fall.mitSlot ? ' mit slot' : ''}, stderr-Zeile ${fall.stderr ? 'ja' : 'nein'}`;
    gesehen = err ? `${err.where}/${err.code}${'slot' in err ? `/slot=${err.slot}` : ''}` : '(kein Fehler)';
    // Diagnose sichtbar: Fehlt eine erwartete stderr-Zeile, steht sie hier; bei „Felder gelesen“ die Zeile, die die
    // EXE stattdessen geschrieben hat (die gelesenen Werte).
    for (const t of texte.filter((x) => !stderrZeilen.includes(x))) {
      const kopf = t.slice(0, t.indexOf(',') + 1);
      const statt = t.startsWith('Felder gelesen: ') ? stderrZeilen.find((z) => z.startsWith(kopf)) : undefined;
      gesehen += statt ? `; stderr „${statt}“` : `; fehlt „${t}“`;
    }
  }
  console.log(`  [${fall.name}] erwartet ${soll}, gesehen ${gesehen}, stderr-Zeile ${zeileDa ? 'ja' : 'nein'} - ${ok && !r.spawnError ? 'OK' : 'FEHLGESCHLAGEN'}`);
  if (!ok || r.spawnError) schlecht++;
}

// EIN Einrichtungsfehler (Prozess startet gar nicht) erklaert alle Ausfaelle mit einer
// Ursache und bekommt Vorrang (Kernregel: eine Ursache, ein Name).
if (spawnFehler) {
  console.error(`\nEINRICHTUNGSFEHLER — die Bridge kam nicht hoch: ${spawnFehler.message}`);
  console.error('Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH oder das Programm existiert nicht.');
  process.exit(9);
}
if (schlecht > 0) {
  console.error(`\nFEHLGESCHLAGEN — ${schlecht} von ${gelaufen} Faellen des nativen Befehlslesers wichen ab.`);
  process.exit(1);
}
console.log(`\nOK — alle ${gelaufen} Faelle des nativen Befehlslesers wie erwartet (${uebersprungen} uebersprungen).`);
