// Selbsttest der reinen Kernstücke — ohne DOM, ohne Electron.
//   node --experimental-strip-types test/selftest.ts
//
// Deckt ab, was still falsch sein kann: die Gewichtung des Glücksrads, die
// Bedingungs-Auswertung, die Migration alter/kaputter Dokumente und das
// Einbetten des Dokuments in die index.html.
//
// Muster: apps/qa/test/selftest.ts

import assert from 'node:assert/strict';
import { compare, evalConditions, triggersFor, type Condition } from '../src/logic.ts';
import { migrateProject } from '../src/migrate.ts';
import { buildIndexHtml } from '../src/export/bundle.ts';
import { makeEmptyProject, makeNode, type DropZoneNode, type WheelSegment } from '../src/model.ts';
import { segmentAt, sliceSegments } from '../src/runtime/wheel.ts';

let checks = 0;
function check(name: string, fn: () => void): void {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
}

// ── Bedingungen ──────────────────────────────────────────────────────────────

check('compare: Zahlen numerisch, auch als String aus dem Formular', () => {
  assert.equal(compare('3', '>', 2), true);
  assert.equal(compare(3, '>=', '3'), true);
  assert.equal(compare(2, '<', 10), true);
  // Ohne numerische Interpretation wäre "2" < "10" falsch (String-Vergleich).
  assert.equal(compare('2', '<', '10'), true);
});

check('compare: Text vergleicht als Text', () => {
  assert.equal(compare('gewinn', '==', 'gewinn'), true);
  assert.equal(compare('gewinn', '!=', 'niete'), true);
});

check('compare: fehlende Variable ist nur "ungleich"', () => {
  assert.equal(compare(undefined, '==', 'x'), false);
  assert.equal(compare(undefined, '!=', 'x'), true);
});

check('evalConditions: UND-verknüpft, $result getrennt', () => {
  const conds: Condition[] = [
    { varName: 'punkte', op: '>=', value: 3 },
    { varName: '$result', op: '==', value: 'gewinn' },
  ];
  assert.equal(evalConditions(conds, { punkte: 3 }, 'gewinn'), true);
  assert.equal(evalConditions(conds, { punkte: 2 }, 'gewinn'), false);
  assert.equal(evalConditions(conds, { punkte: 3 }, 'niete'), false);
  assert.equal(evalConditions([], {}, undefined), true);
});

// ── Glücksrad ────────────────────────────────────────────────────────────────

const SEGMENTS: WheelSegment[] = [
  { id: 'a', label: 'Gewinn', color: '#0f0', weight: 1, value: 'gewinn' },
  { id: 'b', label: 'Niete', color: '#333', weight: 2, value: 'niete' },
  { id: 'c', label: 'Gewinn', color: '#0f0', weight: 1, value: 'gewinn' },
  { id: 'd', label: 'Niete', color: '#333', weight: 2, value: 'niete' },
  { id: 'e', label: 'Hauptpreis', color: '#fa0', weight: 0.5, value: 'hauptpreis' },
  { id: 'f', label: 'Niete', color: '#333', weight: 2, value: 'niete' },
];

check('sliceSegments: Sektoren summieren sich exakt auf 360°', () => {
  const slices = sliceSegments(SEGMENTS);
  assert.equal(slices.length, 6);
  assert.equal(slices[0].from, 0);
  assert.equal(slices[slices.length - 1].to, 360);
  for (let i = 1; i < slices.length; i++) assert.equal(slices[i].from, slices[i - 1].to);
});

check('sliceSegments: Gewicht 0 entfällt (nie ziehbar)', () => {
  const slices = sliceSegments([...SEGMENTS, { id: 'z', label: 'Nie', color: '#000', weight: 0, value: 'nie' }]);
  assert.equal(slices.length, 6);
  assert.ok(!slices.some((s) => s.seg.id === 'z'));
});

check('sliceSegments: leer bei nur Gewicht 0 (kein Absturz)', () => {
  assert.deepEqual(sliceSegments([{ id: 'z', label: 'x', color: '#000', weight: 0, value: 'x' }]), []);
});

// Die Rotation, die spin() berechnet — hier nachgebaut, um segmentAt zu prüfen.
const POINTER = 270;
const mod360 = (d: number): number => ((d % 360) + 360) % 360;
function rotationFor(target: number, current: number, turns: number): number {
  const base = current + turns * 360;
  return base + mod360(POINTER - target - base);
}

check('segmentAt: der gezogene Zielwinkel landet unter dem Zeiger', () => {
  const slices = sliceSegments(SEGMENTS);
  for (const target of [0, 1, 44.9, 45, 90, 180, 270, 359.9]) {
    const rot = rotationFor(target, 0, 5);
    const expected = slices.find((s) => target >= s.from && target < s.to)!.seg;
    assert.equal(segmentAt(slices, rot)!.id, expected.id, `Zielwinkel ${target}`);
  }
});

check('segmentAt: dreht immer vorwärts, auch nach vielen Spins', () => {
  const slices = sliceSegments(SEGMENTS);
  let rot = 0;
  for (let i = 0; i < 50; i++) {
    const target = (i * 37) % 360;
    const next = rotationFor(target, rot, 5);
    assert.ok(next > rot, `Spin ${i}: ${next} muss > ${rot} sein`);
    rot = next;
    const expected = slices.find((s) => target >= s.from && target < s.to)!.seg;
    assert.equal(segmentAt(slices, rot)!.id, expected.id);
  }
});

check('Verteilung folgt den Gewichten (was man sieht, ist die Chance)', () => {
  const slices = sliceSegments(SEGMENTS);
  const total = SEGMENTS.reduce((a, s) => a + s.weight, 0); // 8.5
  const counts: Record<string, number> = {};
  const N = 120_000;
  for (let i = 0; i < N; i++) {
    // Uniformer Zielwinkel — exakt wie spin().
    const target = ((i + 0.5) / N) * 360;
    const seg = segmentAt(slices, rotationFor(target, 0, 5))!;
    counts[seg.value] = (counts[seg.value] ?? 0) + 1;
  }
  const expect = (w: number): number => w / total;
  const near = (got: number, want: number, tol = 0.01): void =>
    assert.ok(Math.abs(got - want) < tol, `erwartet ~${want.toFixed(3)}, war ${got.toFixed(3)}`);

  near(counts['gewinn'] / N, expect(2));
  near(counts['niete'] / N, expect(6));
  near(counts['hauptpreis'] / N, expect(0.5));
});

// ── Trigger je Node-Typ ──────────────────────────────────────────────────────

check('triggersFor: Spiel-Trigger nur am passenden Widget', () => {
  assert.ok(triggersFor('wheel').includes('onWheelStop'));
  assert.ok(!triggersFor('button').includes('onWheelStop'));

  assert.ok(triggersFor('quiz').includes('onCorrect'));
  assert.ok(triggersFor('quiz').includes('onComplete'));
  assert.ok(!triggersFor('memory').includes('onCorrect'));

  assert.ok(triggersFor('memory').includes('onMatch'));
  assert.ok(triggersFor('memory').includes('onComplete'));

  assert.ok(triggersFor('dropzone').includes('onDropped'));
  assert.ok(triggersFor('dropzone').includes('onRejected'));
  assert.ok(!triggersFor('text').includes('onDropped'));

  // onClick und onTimer bietet jeder Typ.
  for (const t of ['text', 'button', 'wheel', 'quiz', 'memory', 'dragitem', 'dropzone'] as const) {
    assert.ok(triggersFor(t).includes('onClick'), `${t} sollte onClick können`);
    assert.ok(triggersFor(t).includes('onTimer'), `${t} sollte onTimer können`);
  }
});

check('makeNode: jeder Widget-Typ hat brauchbare Voreinstellungen', () => {
  const quiz = makeNode('quiz');
  assert.equal(quiz.type, 'quiz');
  assert.ok(quiz.props.questions.length >= 1);
  assert.ok(quiz.props.questions[0].answers.some((a) => a.correct), 'eine Antwort muss richtig sein');

  const memory = makeNode('memory');
  assert.equal(memory.type, 'memory');
  assert.ok(memory.props.pairs.length >= 2);

  const item = makeNode('dragitem');
  assert.equal(item.type, 'dragitem');
  const zone = makeNode('dropzone') as DropZoneNode;
  // Voreinstellung muss zusammenpassen, sonst nimmt die Fläche nichts an.
  assert.ok(zone.props.accepts.includes(item.type === 'dragitem' ? item.props.tag : ''));
});

// ── Migration ────────────────────────────────────────────────────────────────

check('migrateProject: Müll wirft nicht, sondern liefert ein leeres Projekt', () => {
  for (const bad of [null, undefined, 42, 'x', [], {}]) {
    const p = migrateProject(bad);
    assert.equal(p.scenes.length >= 1, true);
    assert.equal(p.startSceneId, p.scenes[0].id);
  }
});

check('migrateProject: unbekannte Node-Typen und Verben fliegen raus', () => {
  const p = migrateProject({
    scenes: [
      {
        id: 'sc1',
        name: 'S',
        nodes: [
          { id: 'n1', type: 'text', props: { text: 'hi' }, rules: [] },
          { id: 'n2', type: 'hologramm', props: {} },
          {
            id: 'n3',
            type: 'button',
            rules: [
              {
                id: 'r1',
                trigger: { type: 'onClick' },
                actions: [
                  { verb: 'goToScene', args: ['sc1'] },
                  { verb: 'selbstzerstoerung', args: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
    startSceneId: 'sc1',
  });
  assert.equal(p.scenes[0].nodes.length, 2);
  assert.equal(p.scenes[0].nodes[1].rules[0].actions.length, 1);
  assert.equal(p.scenes[0].nodes[1].rules[0].actions[0].verb, 'goToScene');
});

check('migrateProject: fehlende Aktions-Argumente werden aufgefüllt', () => {
  const p = migrateProject({
    scenes: [
      {
        id: 'sc1',
        nodes: [
          {
            id: 'n',
            type: 'button',
            rules: [{ id: 'r', trigger: { type: 'onClick' }, actions: [{ verb: 'setVar', args: [] }] }],
          },
        ],
      },
    ],
    startSceneId: 'sc1',
  });
  // setVar erwartet zwei Argumente (Variable, Wert).
  assert.deepEqual(p.scenes[0].nodes[0].rules[0].actions[0].args, ['', '']);
});

check('migrateProject: startSceneId auf eine nicht existierende Szene wird korrigiert', () => {
  const p = migrateProject({ scenes: [{ id: 'a', nodes: [] }], startSceneId: 'weg' });
  assert.equal(p.startSceneId, 'a');
});

check('migrateProject: Spiel-Widgets aus dünnem JSON bekommen Defaults', () => {
  const p = migrateProject({
    scenes: [
      {
        id: 'sc1',
        nodes: [
          { id: 'q', type: 'quiz' },
          { id: 'm', type: 'memory' },
          { id: 'i', type: 'dragitem' },
          { id: 'z', type: 'dropzone' },
        ],
      },
    ],
    startSceneId: 'sc1',
  });
  const [q, m, i, z] = p.scenes[0].nodes;
  assert.equal(q.type === 'quiz' && Array.isArray(q.props.questions), true);
  assert.equal(m.type === 'memory' && m.props.columns >= 1, true);
  // Bestandsdokumente kennen lockOnDrop nicht — der Default muss `true` sein,
  // sonst zählen Zähler-Regeln plötzlich Ablage-Vorgänge statt Elemente.
  assert.equal(i.type === 'dragitem' && i.props.lockOnDrop, true);
  assert.equal(z.type === 'dropzone' && Array.isArray(z.props.accepts), true);
});

check('migrateProject: `accepts` toleriert einen kommaseparierten String', () => {
  const p = migrateProject({
    scenes: [{ id: 'sc1', nodes: [{ id: 'z', type: 'dropzone', props: { accepts: ' a , b ,, c ' } }] }],
    startSceneId: 'sc1',
  });
  const z = p.scenes[0].nodes[0];
  assert.equal(z.type, 'dropzone');
  if (z.type === 'dropzone') assert.deepEqual(z.props.accepts, ['a', 'b', 'c']);
});

check('migrateProject: unbekannter Trigger fällt auf onClick zurück', () => {
  const p = migrateProject({
    scenes: [
      {
        id: 'sc1',
        nodes: [{ id: 'n', type: 'button', rules: [{ id: 'r', trigger: { type: 'onTelepathy' }, actions: [] }] }],
      },
    ],
    startSceneId: 'sc1',
  });
  assert.equal(p.scenes[0].nodes[0].rules[0].trigger.type, 'onClick');
});

// ── Export-HTML ──────────────────────────────────────────────────────────────

check('buildIndexHtml: Runtime als klassisches Script, Dokument inline', () => {
  const html = buildIndexHtml({ doc: makeEmptyProject('Test') });
  // Kein type="module" — unter file:// blockiert CORS ES-Module.
  assert.ok(!/<script[^>]+type="module"/.test(html));
  assert.ok(html.includes('<script src="runtime.js"></script>'));
  // Kein fetch('app.json') — unter file:// scheitert es an der null-Origin.
  assert.ok(html.includes('<script type="application/json" id="jmapp-doc">'));
});

check('buildIndexHtml: </script> im Inhalt zerreißt die Seite nicht', () => {
  const doc = makeEmptyProject('Test');
  doc.scenes[0].nodes.push({
    id: 'n1',
    type: 'text',
    name: 'T',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    rules: [],
    props: { text: '</script><script>alert(1)</script>', fontSize: 12, color: '#fff', weight: 400, align: 'center', lineHeight: 1 },
  });
  const html = buildIndexHtml({ doc });
  // Genau zwei <script>-Tags: das JSON und die Runtime.
  assert.equal(html.match(/<script/g)?.length, 2);
  assert.ok(html.includes('\\u003c/script'));

  // Und der eingebettete Block ist weiterhin gültiges JSON.
  const m = /<script type="application\/json" id="jmapp-doc">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, 'JSON-Block gefunden');
  const parsed = JSON.parse(m![1]) as { scenes: { nodes: { props: { text: string } }[] }[] };
  assert.equal(parsed.scenes[0].nodes[0].props.text, '</script><script>alert(1)</script>');
});

check('buildIndexHtml: Titel wird escaped', () => {
  const html = buildIndexHtml({ doc: makeEmptyProject('A & B <c>') });
  assert.ok(html.includes('<title>A &amp; B &lt;c&gt;</title>'));
});

console.log(`\n${checks} Prüfungen bestanden.`);
