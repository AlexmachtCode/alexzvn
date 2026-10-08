// Selbsttest der Variablen-Aktionen im Editor-Store (#231):
//   node --experimental-strip-types --import ./test/register.mjs test/vars-store.test.ts
//
// Der Name einer Variable ist zugleich ihr Verweis in Regeln und Elementen. Der
// Store adressiert Variablen deshalb über die Position, und Umbenennen ist genau
// EIN Undo-Schritt, der alle Verweise mitzieht. Tippen im Startwert bleibt ein
// Schritt, egal wie viele Tasten.

import assert from 'node:assert/strict';
import { makeEmptyProject, makeNode, type AppProject } from '@jm/appkit';
import { useEditor } from '../src/renderer/src/store.ts';

let checks = 0;
function check(name: string, fn: () => void): void {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
}

/** punkte + punkte2, eine Regel und eine Text-Bindung auf punkte. */
function project(): AppProject {
  const doc = makeEmptyProject('Store');
  doc.variables = [
    { name: 'punkte', type: 'number', initial: 0 },
    { name: 'punkte2', type: 'number', initial: 5 },
  ];
  const text = makeNode('text');
  if (text.type !== 'text') throw new Error('makeNode lieferte den falschen Typ');
  text.props.bindTextTo = 'punkte';
  doc.scenes[0].nodes = [text];
  doc.scenes[0].rules = [
    {
      id: 'r1',
      enabled: true,
      trigger: { type: 'onVarChange', varName: 'punkte' },
      conditions: [{ varName: 'punkte', op: '>=', value: 3 }],
      actions: [{ verb: 'addVar', args: ['punkte', 1], enabled: true }],
    },
  ];
  return doc;
}

const st = () => useEditor.getState();
function fresh(): AppProject {
  const doc = project();
  st().loadDoc(doc, [], null);
  return doc;
}

check('patchVar: adressiert die Variable über die Position', () => {
  fresh();
  st().patchVar(1, { initial: 7 });
  assert.deepEqual(st().doc.variables, [
    { name: 'punkte', type: 'number', initial: 0 },
    { name: 'punkte2', type: 'number', initial: 7 },
  ]);
});

check('patchVar: Tippen im Startwert ist EIN Undo-Schritt', () => {
  fresh();
  st().patchVar(0, { initial: 1 });
  st().patchVar(0, { initial: 12 });
  st().patchVar(0, { initial: 123 });
  assert.equal(st().past.length, 1);
  st().undo();
  assert.equal(st().doc.variables[0].initial, 0);
});

check('renameVar: benennt samt Verweisen um — als EIN Undo-Schritt', () => {
  const before = fresh();
  st().renameVar(0, 'score');
  const doc = st().doc;
  assert.equal(doc.variables[0].name, 'score');
  assert.equal(doc.scenes[0].rules[0].trigger.varName, 'score');
  assert.equal(doc.scenes[0].rules[0].conditions[0].varName, 'score');
  assert.deepEqual(doc.scenes[0].rules[0].actions[0].args, ['score', 1]);
  const text = doc.scenes[0].nodes[0];
  assert.ok(text.type === 'text' && text.props.bindTextTo === 'score');
  assert.equal(st().past.length, 1);
  assert.equal(st().dirty, true);

  st().undo();
  assert.deepEqual(st().doc, before, 'ein Undo stellt Name UND Verweise wieder her');
});

check('renameVar: verschmilzt nicht mit dem Tippen davor', () => {
  fresh();
  st().patchVar(0, { initial: 5 });
  st().renameVar(0, 'score');
  assert.equal(st().past.length, 2);
  st().undo();
  assert.equal(st().doc.variables[0].name, 'punkte');
  assert.equal(st().doc.variables[0].initial, 5, 'nur das Umbenennen ist zurückgenommen');
});

check('renameVar: unverändert, leer oder vergeben → kein Undo-Schritt, nicht geändert', () => {
  const before = fresh();
  st().renameVar(0, 'punkte');
  st().renameVar(0, ' punkte ');
  st().renameVar(0, '');
  st().renameVar(0, 'punkte2');
  assert.deepEqual(st().doc, before);
  assert.equal(st().past.length, 0);
  assert.equal(st().dirty, false);
});

check('removeVar: entfernt die Variable an der Position', () => {
  fresh();
  st().removeVar(0);
  assert.deepEqual(st().doc.variables, [{ name: 'punkte2', type: 'number', initial: 5 }]);
});

console.log(`\n${checks} Prüfungen bestanden.`);
