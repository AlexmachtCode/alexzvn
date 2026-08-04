// Selbsttest der reinen Timetable-/Drift-Helfer:
//   node --experimental-strip-types test/selftest.ts
import {
  computePlannedSchedule,
  computeDrift,
  midnightMsLocal,
  type TimetableItem,
  type TimetableState,
  type CountdownState,
} from '../src/shared/timer-state.ts';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const H = 3_600_000, MIN = 60_000;
function item(id: string, durMin: number, plannedStartMs?: number): TimetableItem {
  return { id, label: id, durationMs: durMin * MIN, ...(plannedStartMs !== undefined ? { plannedStartMs } : {}) };
}
function tt(items: TimetableItem[], activeIndex: number | null): TimetableState {
  return { items, activeIndex, autoAdvance: false, autoAdvanceGraceSec: 5 };
}

// computePlannedSchedule
ck('kein Anker → alle null', computePlannedSchedule([item('a', 10), item('b', 10)]).every((v) => v === null));
const sched = computePlannedSchedule([item('a', 10, 9 * H), item('b', 10), item('c', 5, 12 * H)]);
ck('Anker gesetzt', sched[0] === 9 * H);
ck('Kette: b = a + Dauer', sched[1] === 9 * H + 10 * MIN);
ck('Fixslot verankert neu', sched[2] === 12 * H);
const sched2 = computePlannedSchedule([item('a', 10), item('b', 10, 10 * H)]);
ck('vor erstem Anker → null', sched2[0] === null && sched2[1] === 10 * H);

// computeDrift (synthetische Uhrzeiten am heutigen Tag)
const base = midnightMsLocal(Date.now());
const items = [item('a', 10, 9 * H), item('b', 10)]; // A 09:00 (10min), B chained 09:10
// Aktiv A, gestartet 09:00, jetzt 09:05 (pünktlich, läuft)
const cdOnTime: CountdownState = { durationMs: 10 * MIN, delayMs: 0, startedAtMs: base + 9 * H, pausedRemainingMs: null };
const dOn = computeDrift(tt(items, 0), cdOnTime, base + 9 * H + 5 * MIN);
ck('pünktlich → Drift 0', dOn.driftMs === 0);
// Aktiv A, gestartet 09:00, jetzt 09:20 (10 min Überzug)
const dOver = computeDrift(tt(items, 0), cdOnTime, base + 9 * H + 20 * MIN);
ck('Überzug → +10min hinter Plan', dOver.driftMs === 10 * MIN);
// Kein Plan hinterlegt → driftMs null
const dNone = computeDrift(tt([item('a', 10), item('b', 10)], 0), cdOnTime, base + 9 * H);
ck('kein Plan → driftMs null', dNone.driftMs === null && dNone.perItem.every((v) => v === null));
// Idle (kein aktives Item) → null
ck('idle → null', computeDrift(tt(items, null), cdOnTime, base + 9 * H).driftMs === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
