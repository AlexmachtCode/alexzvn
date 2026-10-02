// RELOAD ohne erreichten Empfaenger wird bei der Wiederverbindung nachgeholt (A17 Fix-Runde 1).
// Ohne Electron (tsx): npm run selftest:iveo -w @jm/launcher
import { erzeugeReloadMerker } from '../src/main/reload-nachholen';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-rundown', 'RUNDOWN RELOAD', 0);
  ck('verpasstes RELOAD wird bei der Verbindung nachgeholt', m.beiVerbindung('jm-rundown') === 'RUNDOWN RELOAD');
  ck('nur einmal', m.beiVerbindung('jm-rundown') === null);
}
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-rundown', 'RUNDOWN RELOAD', 1);
  ck('erreichtes RELOAD wird nicht nachgeholt', m.beiVerbindung('jm-rundown') === null);
}
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-timer', 'TIMER GOTO 3', 0);
  ck('nur RELOAD-Zeilen werden gemerkt', m.beiVerbindung('jm-timer') === null);
}
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-rundown', 'RUNDOWN RELOAD', 0);
  ck('anderes Tool bekommt es nicht', m.beiVerbindung('jm-timer') === null);
  m.nachSenden('jm-rundown', 'RUNDOWN RELOAD', 1);
  ck('spaeter erreichtes RELOAD loescht den Merker', m.beiVerbindung('jm-rundown') === null);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
