// Überschreibschutz (#291): Mit gemerktem Dateinamen würde die erste Aufnahme am zweiten Tag die
// vom Vortag still überschreiben (openSync 'w'). freierBasisname hängt -2, -3 … an, bis nichts
// Vorhandenes getroffen wird. npm run selftest -w @jm/recorder
import { join } from 'node:path';
import { freierBasisname } from '../src/main/dateiname';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const dir = join('D:', 'Aufnahmen');
const mit = (...namen: string[]) => {
  const da = new Set(namen.map((n) => join(dir, n)));
  return (p: string): boolean => da.has(p);
};

ck('frei: Name bleibt', freierBasisname(dir, 'Tag', mit()) === 'Tag');
ck('Name.wav vorhanden → Name-2', freierBasisname(dir, 'Tag', mit('Tag.wav')) === 'Tag-2');
ck('Name.wav und Name-2.wav vorhanden → Name-3', freierBasisname(dir, 'Tag', mit('Tag.wav', 'Tag-2.wav')) === 'Tag-3');
ck('nur Spuren-Ordner vorhanden → Name-2', freierBasisname(dir, 'Tag', mit('Tag-Spuren')) === 'Tag-2');
ck('nur Folgedatei vorhanden → Name-2', freierBasisname(dir, 'Tag', mit('Tag_002.wav')) === 'Tag-2');
ck('Lücke: Name-2 frei, obwohl Name-3 existiert', freierBasisname(dir, 'Tag', mit('Tag.wav', 'Tag-3.wav')) === 'Tag-2');

console.log(`\ndateiname: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);
