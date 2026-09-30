#!/usr/bin/env node
// Prueft den Befehl videoDelay an der ECHTEN zoom-bridge.exe - OHNE Zoom,
// OHNE Meeting, OHNE "init": der Versatz ist eine reine Einstellung und
// braucht weder SDK noch NDI-Sender. Geprueft wird, was die Bridge auf jede
// Befehlszeile ANTWORTET: eine Bestaetigung mit dem Wert, der ab jetzt gilt,
// oder videoBadDelay.
//
//   npm run delay-probe -w @jm/zoom-bridge
//
// WARUM GEGEN DIE ECHTE .EXE: der native Zahlenleser (numberFromJson in
// session.cpp) las "4.5" als 4 und "1e3" als 1 - fuer die Teilnehmerkennung
// fiel das nie auf, fuer einen Versatz waere es eine falsche Zahl, die als
// gueltig durchgeht. Die Attrappe (fake-bridge.mjs) kann das nicht sehen, sie
// parst mit JSON.parse.
//
// Rueckgabewert: 0 = alles wie erwartet, 1 = Abweichung, 9 = die Bridge kam
// nicht hoch (Einrichtung, nicht der Befehl).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';
import { LineSplitter, VIDEO_DELAY_MAX_MS, parseWireEvent } from '../src/protocol.ts';

// Dieselbe Einrichtung wie test/command-probe.mjs (siehe dort, GEMESSEN): die
// .exe ist gegen die NDI- UND die Zoom-Importbibliothek gebunden, der Lader
// loest beide VOR main() auf. Ohne beide Laufzeiten auf PATH startet der
// Prozess gar nicht (0xC0000135).
const require = createRequire(import.meta.url);
require('@jm/ndi');
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';

const OK = (ms) => `videoDelay ${ms}`;
const BAD = 'videoBadDelay';

// In EINEM Prozess, in fester Reihenfolge: die Bridge arbeitet stdin-Zeilen
// der Reihe nach ab und antwortet auf jede genau einmal. Eine fehlende oder
// ueberzaehlige Antwort verschiebt die ganze Liste - der Vergleich faengt
// damit auch "keine Antwort" und "zwei Antworten" ab, nicht nur falsche.
// Die Obergrenze kommt aus protocol.ts, nicht als abgeschriebene Zahl: so
// prueft dieser Lauf, dass die TS-Grenze und die native (kMaxVideoDelayMs)
// GLEICH sind - laeuft eine davon weg, faellt einer der beiden Faelle.
const MAX = VIDEO_DELAY_MAX_MS;
const cases = [
  ['gueltig', '{"cmd":"videoDelay","ms":480}', OK(480)],
  ['null ist ein Wert', '{"cmd":"videoDelay","ms":0}', OK(0)],
  [`die Obergrenze selbst (${MAX}, aus protocol.ts)`, `{"cmd":"videoDelay","ms":${MAX}}`, OK(MAX)],
  ['Leerzeichen vor der Klammer', '{"cmd":"videoDelay","ms":250 }', OK(250)],
  ['weiteres Feld dahinter', '{"cmd":"videoDelay","ms":480,"x":1}', OK(480)],
  [`ueber der Obergrenze (${MAX + 1})`, `{"cmd":"videoDelay","ms":${MAX + 1}}`, BAD],
  ['negativ', '{"cmd":"videoDelay","ms":-5}', BAD],
  ['Zeichenkette statt Zahl', '{"cmd":"videoDelay","ms":"480"}', BAD],
  ['Kommazahl (las frueher 4)', '{"cmd":"videoDelay","ms":4.5}', BAD],
  ['Exponent (las frueher 1)', '{"cmd":"videoDelay","ms":1e3}', BAD],
  ['Feld fehlt', '{"cmd":"videoDelay"}', BAD],
  ['Ueberlauf', '{"cmd":"videoDelay","ms":99999999999999999999999}', BAD],
];

const seen = [];
let spawnError = null;
// Rueckgabewert bzw. Signal des Kindes. BERICHTIGT (Review 30.09.2026): eine
// fehlende DLL laesst den Prozess STARTEN und sofort mit 0xC0000135 enden -
// das ist ein 'exit', kein 'error'. Ohne diese Zahl stand dann zwoelfmal
// "(keine Antwort)" da, und die Suche ging zum Befehlsleser statt zur
// Einrichtung: zwei Ursachen, ein Name.
let kindEnde = null;

await new Promise((resolve) => {
  let fertig = false;
  let safety = null;
  const ende = () => {
    if (fertig) return;
    fertig = true;
    clearTimeout(safety);
    resolve();
  };
  const child = spawn(binPath(), [], {
    windowsHide: true,
    env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const splitter = new LineSplitter();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    for (const l of splitter.push(d)) {
      const ev = parseWireEvent(l);
      if (!ev) continue;
      if (ev.ev === 'videoDelay') seen.push(OK(ev.ms));
      else if (ev.ev === 'error' && ev.where === 'video' && ev.code === 'videoBadDelay') {
        // Ohne Kennung erwartet: der Versatz gilt fuer ALLE Quellen, eine id
        // waere erfunden.
        seen.push(ev.id === undefined ? BAD : `${BAD} MIT id=${ev.id}`);
      } else if (ev.ev === 'error') seen.push(`anderer Fehler ${ev.where}/${ev.code}`);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => process.stderr.write(`  [bridge] ${d}`));
  // 'error' LOEST AUF (berichtigt): bei einer fehlenden .exe (ENOENT) kommt
  // KEIN 'exit' - vorher blieb das Versprechen offen, und Node endete mit
  // "unsettled top-level await" (13) statt mit der 9.
  child.on('error', (e) => { spawnError = e; ende(); });
  child.on('exit', (code, signal) => { kindEnde = signal ?? code; ende(); });
  child.stdin.on('error', () => { /* Kind schon weg - das meldet 'exit'/'error' */ });
  // NICHT unref't: das Sicherheitsnetz muss den Prozess am Leben halten, bis
  // es entschieden hat; ende() raeumt es ab.
  safety = setTimeout(() => {
    try { child.kill(); } catch { /* schon weg */ }
    spawnError ??= new Error('Zeitueberschreitung: kein Prozessende');
    ende();
  }, 8000);
  for (const [, line] of cases) child.stdin.write(`${line}\n`);
  setTimeout(() => {
    try {
      child.stdin.write('{"cmd":"quit"}\n');
      child.stdin.end();
    } catch { /* Kind ist schon weg */ }
  }, 500);
});

// KEINE EINZIGE Antwort UND ein Kind, das nicht mit 0 endete: die Bridge kam
// nicht bis zum Befehlsleser. Das ist Einrichtung, nicht der Befehl.
const nichtHochgekommen = seen.length === 0 && kindEnde !== null && kindEnde !== 0;
if (spawnError || nichtHochgekommen) {
  const grund = spawnError
    ? spawnError.message
    : `Kindprozess endete mit ${typeof kindEnde === 'number' ? `0x${(kindEnde >>> 0).toString(16).toUpperCase()}` : kindEnde}, ohne eine Zeile zu beantworten`;
  console.error(`EINRICHTUNGSFEHLER - die Bridge kam nicht hoch: ${grund}`);
  console.error('Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH (0xC0000135) oder das Programm existiert nicht.');
  process.exit(9);
}

let fehler = 0;
cases.forEach(([name, , erwartet], i) => {
  const gesehen = seen[i] ?? '(keine Antwort)';
  const ok = gesehen === erwartet;
  if (!ok) fehler++;
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${name}: erwartet ${erwartet}, gesehen ${gesehen}`);
});
if (seen.length > cases.length) {
  fehler++;
  console.log(`  FEHL ueberzaehlige Antworten: ${seen.slice(cases.length).join(' | ')}`);
}
console.log(fehler === 0 ? '\nOK - videoDelay antwortet auf jede Zeile wie erwartet.' : `\n${fehler} Abweichung(en).`);
process.exit(fehler === 0 ? 0 : 1);
