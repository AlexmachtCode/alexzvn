// Selbsttest des Einrastens.
//   node --experimental-strip-types test/snap.test.ts
//
// Reine Geometrie, keine DOM-Abhängigkeit — genau die Sorte Logik, bei der ein
// Vorzeichenfehler im Editor als „das rastet komisch ein" durchrutscht.

import assert from 'node:assert/strict';
import { snapRect, snapToGrid, type Rect } from '../src/renderer/src/lib/snap.ts';

let checks = 0;
function check(name: string, fn: () => void): void {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
}

const canvas = { width: 1000, height: 800 };
const base = { grid: 10, tolerance: 6, canvas, others: [] as Rect[] };

check('rastet an der linken Bühnenkante ein', () => {
  const r = snapRect({ x: 3, y: 300, w: 100, h: 50 }, base);
  assert.equal(r.x, 0);
  assert.deepEqual(r.guides.find((g) => g.axis === 'x'), { axis: 'x', at: 0 });
});

check('rastet mittig auf der Bühne ein (Mitte an Mitte)', () => {
  // Element 100 breit → mittig wäre x=450. Aus 452 muss 450 werden.
  const r = snapRect({ x: 452, y: 10, w: 100, h: 50 }, base);
  assert.equal(r.x, 450);
  assert.deepEqual(r.guides.find((g) => g.axis === 'x'), { axis: 'x', at: 500 });
});

check('rastet an der Kante eines Nachbarn ein', () => {
  const others: Rect[] = [{ x: 200, y: 0, w: 100, h: 50 }];
  // Linke Kante bei 204 → springt auf 200.
  const r = snapRect({ x: 204, y: 300, w: 80, h: 40 }, { ...base, others });
  assert.equal(r.x, 200);
});

check('rastet rechte Kante an linke Kante des Nachbarn (bündig)', () => {
  const others: Rect[] = [{ x: 300, y: 0, w: 100, h: 50 }];
  // Element 80 breit, x=222 → rechte Kante 302 → soll auf 300 → x=220.
  const r = snapRect({ x: 222, y: 300, w: 80, h: 40 }, { ...base, others });
  assert.equal(r.x, 220);
});

check('ohne Treffer greift das Raster', () => {
  const r = snapRect({ x: 137, y: 244, w: 30, h: 30 }, base);
  assert.equal(r.x, 140);
  assert.equal(r.y, 240);
  assert.deepEqual(r.guides, [], 'Raster erzeugt keine Hilfslinie');
});

check('grid 0 lässt die Position unangetastet, wenn nichts trifft', () => {
  const r = snapRect({ x: 137, y: 244, w: 30, h: 30 }, { ...base, grid: 0 });
  assert.equal(r.x, 137);
  assert.equal(r.y, 244);
});

check('Ausrichten schlägt das Raster', () => {
  const others: Rect[] = [{ x: 203, y: 0, w: 100, h: 50 }];
  // 204 läge auf dem Raster bei 200, die Nachbarkante aber bei 203.
  const r = snapRect({ x: 204, y: 300, w: 80, h: 40 }, { ...base, others });
  assert.equal(r.x, 203, 'die Kante des Nachbarn gewinnt gegen das Raster');
});

check('der NÄHERE Kandidat gewinnt', () => {
  const others: Rect[] = [
    { x: 100, y: 0, w: 10, h: 10 },
    { x: 104, y: 0, w: 10, h: 10 },
  ];
  const r = snapRect({ x: 103, y: 300, w: 20, h: 20 }, { ...base, others, tolerance: 6 });
  assert.equal(r.x, 104);
});

check('außerhalb der Toleranz passiert nichts (außer Raster)', () => {
  const others: Rect[] = [{ x: 200, y: 0, w: 100, h: 50 }];
  const r = snapRect({ x: 240, y: 300, w: 80, h: 40 }, { ...base, others, grid: 0 });
  assert.equal(r.x, 240);
  assert.deepEqual(r.guides, []);
});

check('beide Achsen rasten unabhängig ein', () => {
  const others: Rect[] = [{ x: 200, y: 400, w: 100, h: 50 }];
  const r = snapRect({ x: 203, y: 397, w: 80, h: 40 }, { ...base, others });
  assert.equal(r.x, 200);
  assert.equal(r.y, 400);
  assert.equal(r.guides.length, 2);
});

check('snapToGrid rundet zur nächsten Rasterlinie, 0 = aus', () => {
  assert.equal(snapToGrid(14, 10), 10);
  assert.equal(snapToGrid(15, 10), 20);
  assert.equal(snapToGrid(-4, 10), -0);
  assert.equal(snapToGrid(137, 0), 137);
});

console.log(`\n${checks} Prüfungen bestanden.`);
