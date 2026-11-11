// Loopback-Stille (reine Uhr, Zeiten von Hand): wann fehlen Stille-Frames, und wie viele?
// npm run selftest -w @jm/recorder
import { istLoopback, StilleUhr, STILLE_PAUSE_MS } from '../src/main/stille';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

ck('Pause-Schwelle 250 ms', STILLE_PAUSE_MS === 250);
ck('Lautsprecher [Loopback] erkannt', istLoopback('Lautsprecher (Realtek) [Loopback]'));
ck('Mikrofon ist kein Loopback', !istLoopback('Mikrofon (Realtek)'));

// Fließende Blöcke: nie Stille nötig.
const a = new StilleUhr(1000, 0);
let nie = true;
for (let t = 10; t <= 1000; t += 10) if (a.block(10, t) !== 0) nie = false;
ck('Blöcke alle 10 ms: nie Stille', nie);
ck('fehlend während Blöcke fließen = 0', a.fehlend(1005) === 0);

// Pause nach dem letzten Block bei 1000 (gesamt 1000 Frames).
ck('Pause: fehlend(1300) = 300', a.fehlend(1300) === 300);
a.aufgefuellt(300);
ck('nach Auffüllen: fehlend(1350) = 50', a.fehlend(1350) === 50);
ck('Block nach langer Pause: 690', a.block(10, 2000) === 690);

// Stau im Hauptprozess: gepufferte Blöcke kommen nach einer Lücke, ohne dass der Wächter sie
// als Stille bestätigt hat → keine Stille davor.
const s = new StilleUhr(1000, 0);
for (let t = 10; t <= 1000; t += 10) s.block(10, t);
ck('Stau: Block nach unbestätigter Lücke = 0', s.block(10, 1400) === 0);
s.weiter(2000);
ck('weiter: neue Grundlinie, fehlend(2100) = 0', s.fehlend(2100) === 0);

// Kein Block je.
ck('kein Block je: fehlend(600) = 600', new StilleUhr(1000, 0).fehlend(600) === 600);

// Uhr vorgehend: nie negativ.
const v = new StilleUhr(1000, 0);
v.aufgefuellt(5000);
ck('vorgehend: fehlend nie negativ', v.fehlend(1000) === 0);
ck('vorgehend: block nie negativ', v.block(10, 1000) === 0);

console.log(`\nstille: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
