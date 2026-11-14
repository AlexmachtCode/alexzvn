// #303: Beschriftung des NDI-Schalters je Status. npm run selftest -w @jm/presenter
import type { NdiLage, NdiStatus } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const n = await import('../src/shared/ndi');

const st = (lage: NdiLage, an = true, empfaenger = 0): NdiStatus => ({ an, lage, empfaenger, grund: null });
ck('aus', n.ndiSchalterText(st('aus', false)) === 'NDI aus');
ck('startet', n.ndiSchalterText(st('startet')) === 'NDI startet …');
ck('sendet, 0 Empfänger', n.ndiSchalterText(st('sendet')) === 'NDI ● an · 0 Empfänger');
ck('sendet, 2 Empfänger', n.ndiSchalterText(st('sendet', true, 2)) === 'NDI ● an · 2 Empfänger');
ck('ausgefallen', n.ndiSchalterText(st('nicht-verfuegbar')) === 'NDI nicht verfügbar');
ck('Mac', n.ndiSchalterText(st('nicht-verfuegbar', false)) === 'NDI nicht verfügbar');

console.log(`\n${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
