// RELOAD ohne erreichten Empfaenger wird bei der Wiederverbindung nachgeholt (A17 Fix-Runde 1).
// Ohne Electron (tsx): npm run selftest:iveo -w @jm/launcher
import { erzeugeReloadMerker, waehleReloadZiele } from '../src/main/reload-nachholen';

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
// Teil 2b R2, Spec 15.3 (O3): In der Rolle Master geht RELOAD nur an diesen Rechner, auch beim Nachholen.
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-timer', 'TIMER RELOAD', 0, true);
  ck('15.3: Zeile nur fuer diesen Rechner, niemand erreicht -> Endpunkt eines fremden Rechners holt nicht nach', m.beiVerbindung('jm-timer', false) === null);
  ck('15.3: ... ohne Angabe des Rechners ebenso nicht', m.beiVerbindung('jm-timer') === null);
  ck('15.3: ... ein Endpunkt dieses Rechners holt nach, genau einmal',
    m.beiVerbindung('jm-timer', true) === 'TIMER RELOAD' && m.beiVerbindung('jm-timer', true) === null);
}
{
  const m = erzeugeReloadMerker();
  m.nachSenden('jm-timer', 'TIMER RELOAD', 0);
  ck('15.3: ohne nurDieserRechner wie bisher: auch ein fremder Rechner holt nach', m.beiVerbindung('jm-timer', false) === 'TIMER RELOAD');
}
{
  const eintraege = [
    { appId: 'jm-timer', host: '127.0.0.1', verbunden: true, n: 1 },
    { appId: 'jm-timer', host: '10.0.0.7', verbunden: true, n: 2 },
    { appId: 'jm-timer', host: '10.0.0.5', verbunden: false, n: 3 },
    { appId: 'jm-titler', host: '127.0.0.1', verbunden: true, n: 4 },
  ];
  const hier = (host: string): boolean => host === '127.0.0.1';
  ck('waehleReloadZiele: mit istHier nur verbundene Endpunkte der appId auf diesem Rechner',
    waehleReloadZiele(eintraege, 'jm-timer', hier).map((e) => e.n).join(',') === '1');
  ck('waehleReloadZiele: mit null alle verbundenen der appId (wie bisher)',
    waehleReloadZiele(eintraege, 'jm-timer', null).map((e) => e.n).join(',') === '1,2');
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
