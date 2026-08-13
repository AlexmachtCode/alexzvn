#!/usr/bin/env node
// Prueft den nativen Befehlsleser (main.cpp/session.cpp) OHNE Zoom, OHNE
// Meeting und OHNE Zugangsdaten: startet die frisch gebaute .exe roh (KEIN
// "init"), schickt ihr Video-Befehlszeilen ueber stdin und liest die Antwort
// auf stdout.
//
// WARUM DAS OHNE MEETING FUNKTIONIERT: videoSubscribe() prueft in dieser
// Reihenfolge (native/video.cpp) - schon abonniert? -> Erlaubnis vorhanden?
// -> Teilnehmer bekannt? Ohne "init" bleibt sessionCanRecordRaw() IMMER
// false (das Merkzeichen wird ausschliesslich ueber echte SDK-Rueckrufe
// gesetzt) - die Pruefung kommt also NIE bis zur Teilnehmersuche. Das macht
// "videoNoPrivilege" zum verlaesslichen Beleg, dass die Kennung ("id")
// ERFOLGREICH gelesen wurde und die Pruefkette eine Stufe weiterkam.
//
// GENAU DAS deckt den Nachbesserungsrunde-1-Fehler auf: "id" ist laut
// Protokoll (Aufgabe 2) eine ZAHL. fieldFromJson() liest ausdruecklich nur
// Zeichenketten und lieferte fuer ein Zahlenfeld IMMER "" - jedes echte
// videoSubscribe/videoUnsubscribe meldete darum deterministisch
// videoUnknownParticipant, UNABHAENGIG davon, ob der Teilnehmer existierte.
// Kein bisheriger Lauf deckte das auf: die Attrappe (test/fake-bridge.mjs)
// prueft nur, ob "videoSubscribe" in der Zeile vorkommt, wertet die Kennung
// selbst nie aus. Dieser Pruefstand laeuft gegen die ECHTE .exe und liest
// die ECHTE Antwort.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';
import { LineSplitter, parseWireEvent } from '../src/protocol.ts';

// GEMESSEN (dieser Pruefstand, erster Lauf): zoom-bridge.exe ist seit Task 1
// zusaetzlich zur Zoom-SDK-Importbibliothek auch gegen die NDI-Import-
// bibliothek gebunden (siehe CMakeLists.txt) - der Windows-Lader loest ALLE
// eingebundenen DLLs beim Prozessstart auf, VOR main(), unabhaengig davon,
// ob dieser Pruefstand je eine NDI-Funktion beruehrt. Ohne die NDI-Laufzeit
// auf PATH scheitert der Start mit STATUS_DLL_NOT_FOUND (0xC0000135) - GENAU
// dieselbe Falle, die test/ndi-probe.mjs bereits dokumentiert (dort ueber
// den Nebeneffekt von require('@jm/ndi')) und die dieser Pruefstand beim
// ersten Lauf ohne diese Zeile reproduziert hat (Exitcode -1073741515 =
// 0xC0000135, leeres stdout/stderr - der Prozess kam nie bis zur ersten
// Zeile). Import laedt das native NDI-Addon UND haengt dabei (Nebenwirkung
// von packages/ndi/index.js, ensureNdiRuntimeOnPath()) das Verzeichnis der
// NDI-Laufzeit-DLL vorn an process.env.PATH - fuer DIESEN Prozess.
const require = createRequire(import.meta.url);
require('@jm/ndi');

// Dieselbe PATH-Erweiterung wie test/ndi-probe.mjs/test/join.mjs: ohne
// %ZOOM_SDK_DIR%\x64\bin scheitert der Prozessstart aus demselben Grund wie
// oben, nur fuer die Zoom-SDK-DLL statt der NDI-Laufzeit.
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';

/**
 * Startet die Bridge frisch, schickt GENAU eine Befehlszeile, liest die
 * ERSTE "video"-Fehlermeldung und beendet die Bridge danach sauber ueber
 * "quit". Jeder Fall bekommt seinen EIGENEN Prozess - ein Abo-Zustand
 * (g_subs in video.cpp) darf zwischen den drei Faellen nicht mitlaufen.
 */
function runCase(name, line, expectedCode) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = spawn(binPath(), [], {
      windowsHide: true,
      env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let sawCode = null;
    let spawnError = null;
    const splitter = new LineSplitter();

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      process.stdout.write(`  bridge[${name}]: ${d}`);
      for (const l of splitter.push(d)) {
        const ev = parseWireEvent(l);
        if (ev && ev.ev === 'error' && ev.where === 'video' && sawCode === null) {
          sawCode = ev.code;
        }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => process.stderr.write(`  [bridge:${name}] ${d}`));

    // Eine gescheiterte spawn() darf nicht als unbeantwortete Promise haengen
    // bleiben - dann waere aus einem gemeldeten Fehler ein STILLER Haenger
    // geworden (derselbe Grundsatz wie test/ndi-probe.mjs).
    child.on('error', (e) => {
      spawnError = e;
    });

    child.on('exit', () => {
      settle({ ok: sawCode === expectedCode, sawCode, spawnError });
    });

    // Sicherheitsnetz: reagiert die Bridge nie (z. B. der Prozess startet
    // gar nicht erst), soll der Pruefstand nicht ewig haengen, sondern
    // GEMELDET abbrechen - nichts verschwindet still.
    const safety = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* schon weg */
      }
      settle({ ok: false, sawCode, spawnError: spawnError ?? new Error('Zeitueberschreitung: kein Prozessende') });
    }, 5000);
    safety.unref?.();

    child.stdin.write(`${line}\n`);
    // Kurz warten, damit die Antwort sicher verarbeitet ist (die Bridge pumpt
    // alle 10 ms), dann sauber ueber "quit" beenden statt abzuschiessen.
    setTimeout(() => {
      try {
        child.stdin.write('{"cmd":"quit"}\n');
        child.stdin.end();
      } catch {
        /* Kind ist schon weg */
      }
    }, 300);
  });
}

const cases = [
  {
    name: 'gueltige Zahl -> Erlaubnis fehlt (Beleg: die Zahl WURDE gelesen)',
    line: '{"cmd":"videoSubscribe","id":42}',
    expected: 'videoNoPrivilege',
    failExitCode: 1,
  },
  {
    name: '"id" fehlt -> unbekannte Kennung',
    line: '{"cmd":"videoSubscribe"}',
    expected: 'videoUnknownParticipant',
    failExitCode: 2,
  },
  {
    name: 'gueltige Zahl, ungueltige Aufloesung -> videoBadResolution',
    line: '{"cmd":"videoSubscribe","id":42,"resolution":"4k"}',
    expected: 'videoBadResolution',
    failExitCode: 3,
  },
];

let firstFailure = null;
let anySpawnError = null;
for (const c of cases) {
  const r = await runCase(c.name, c.line, c.expected);
  if (r.spawnError && !anySpawnError) anySpawnError = r.spawnError;
  const ok = r.ok && !r.spawnError;
  console.log(
    `  [${c.name}] erwartet ${c.expected}, gesehen ${r.sawCode ?? '(keine video-Fehlermeldung)'} - ${ok ? 'OK' : 'FEHLGESCHLAGEN'}`,
  );
  if (!ok && firstFailure === null) firstFailure = c;
}

// EIN systemischer Einrichtungsfehler (Prozess startet gar nicht) erklaert
// ALLE drei Fallausfaelle mit EINER Ursache - den einzelnen Faellen die
// Schuld zu geben waere hier irrefuehrend (Kernregel: eine Ursache, ein
// Name). Bekommt darum Vorrang vor den fallspezifischen Codes.
if (anySpawnError) {
  console.error(`\nEINRICHTUNGSFEHLER — die Bridge kam nicht hoch: ${anySpawnError.message}`);
  console.error('Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH oder das Programm existiert nicht.');
  process.exit(9);
}

if (firstFailure === null) {
  console.log('\nOK — alle drei Faelle des nativen Befehlslesers wie erwartet.');
  process.exit(0);
}

console.error(`\nFEHLGESCHLAGEN — Fall "${firstFailure.name}" wich vom erwarteten Code ab.`);
process.exit(firstFailure.failExitCode);
