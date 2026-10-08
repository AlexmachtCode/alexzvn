// Selbsttest des STATE, den der Presenter über das Suite-Steuerprotokoll meldet:
//   node --experimental-strip-types test/suite-state.test.ts
//
// #228: Der Launcher zeigt „ON AIR“, sobald ein Tool live=1 meldet. Der Presenter
// steht im Leerlauf (und nach dem Beenden) auf screen='live' — live darf deshalb
// erst gelten, wenn wirklich eine Präsentation läuft.
import assert from 'node:assert/strict';
import { presenterStateKv } from '../src/main/suite-state.ts';
import type { PresentationState } from '../src/shared/types.ts';

let pass = 0;
let fail = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    pass++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message.split('\n').join('\n      ')}`);
  }
}

const IDLE: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };
const running = (screen: PresentationState['screen'], index = 2, total = 10): PresentationState => ({
  active: true,
  index,
  total,
  screen,
});

check('Leerlauf (active=false, screen live) → live false, nicht schwarz/weiß', () => {
  assert.deepEqual(presenterStateKv(IDLE), {
    slide: 0,
    total: 0,
    active: false,
    live: false,
    black: false,
    white: false,
  });
});

check('Präsentation läuft, screen live → live true', () => {
  assert.deepEqual(presenterStateKv(running('live')), {
    slide: 3, // 1-basiert
    total: 10,
    active: true,
    live: true,
    black: false,
    white: false,
  });
});

check('Präsentation läuft, Schwarzbild → live false, black true', () => {
  const kv = presenterStateKv(running('black'));
  assert.equal(kv.live, false);
  assert.equal(kv.black, true);
  assert.equal(kv.white, false);
  assert.equal(kv.active, true);
});

check('Präsentation läuft, Weißbild → live false, white true', () => {
  const kv = presenterStateKv(running('white'));
  assert.equal(kv.live, false);
  assert.equal(kv.white, true);
  assert.equal(kv.black, false);
  assert.equal(kv.active, true);
});

check('nach dem Beenden (stopPresentation setzt den Leerlauf-Zustand) → live false', () => {
  // present.ts/stopPresentation: state = { active:false, index:0, total:0, screen:'live' }
  const afterStop: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };
  const kv = presenterStateKv(afterStop);
  assert.equal(kv.live, false);
  assert.equal(kv.active, false);
  assert.equal(kv.slide, 0);
});

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`);
if (fail > 0) process.exit(1);
