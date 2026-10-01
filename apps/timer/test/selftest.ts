// Selbsttest der reinen Timetable-/Drift-Helfer:
//   node --experimental-strip-types test/selftest.ts
import {
  computePlannedSchedule,
  computeDrift,
  midnightMsLocal,
  reduce,
  INITIAL_STATE,
  aktiverPunktVerschwunden,
  type TimetableItem,
  type TimetableState,
  type CountdownState,
  type SyncedState,
} from '../src/shared/timer-state.ts';
import { ablaufToTimetable, parseTimetable } from '../src/shared/show-ablauf.ts';
import { createShow, hatEigeneTimerListe, normalizeAblauf, parseShow, serializeShow } from '../../../packages/show/src/index.ts';
import { agendaToAblauf } from '../../../packages/iveo/src/mapper.ts';
import { buildCsp } from '../../../packages/app-runtime/src/csp.ts';
import {
  BIND_HOST,
  CLIENT_HOST,
  PRELOAD_SERVER_URL,
  RENDERER_CSP,
  SERVER_PORT,
} from '../src/shared/net.ts';

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

// ── CSP deckt die Adresse, die der Renderer wirklich waehlt ──────────────────
// Der Renderer bekommt seine Server-Adresse aus dem Preload und spricht sie per
// Websocket an. Steht diese Adresse NICHT in der connect-src der CSP, blockt
// Chromium die Verbindung — die Oberflaeche bleibt still auf "Offline" und jedes
// Kommando versickert in sendCommand. Im Dev faellt das nie auf (dort laesst die
// CSP ws:/http: pauschal durch), erst der gepackte Build stirbt. Genau so lag der
// Timer von 0.5.0 bis 0.11.0 lahm: CSP aus der LAUSCH-Adresse 0.0.0.0 gebaut,
// verbunden wurde aber nach 127.0.0.1.
const strictCsp = buildCsp(RENDERER_CSP, false);
const connectSrc = strictCsp.split('; ').find((d) => d.startsWith('connect-src ')) ?? '';
ck('CSP erlaubt die Preload-Adresse', connectSrc.includes(PRELOAD_SERVER_URL));
ck('CSP erlaubt den Websocket dorthin', connectSrc.includes(`ws://${CLIENT_HOST}:${SERVER_PORT}`));
ck('CSP nennt nicht die Lausch-Adresse', !strictCsp.includes(BIND_HOST));

// ── Teil 2a: Show-Ablauf → Timer-Punkte (Spec 6.1, src/shared/show-ablauf.ts) ──
{
  const punkte = ablaufToTimetable([
    { id: 'ag-1', label: 'Begrüßung', durationMs: 10 * MIN, plannedStartMs: 9 * H, category: 'panel' },
    { label: 'Ohne Kennung', note: 'Notiz', owner: 'Ada' },
  ]);
  ck('ablaufToTimetable: gibt die Kennung mit', punkte?.[0].id === 'ag-1');
  ck(
    'ablaufToTimetable: id vorn, übrige Felder wie bisher',
    JSON.stringify(punkte?.[0]) ===
      JSON.stringify({ id: 'ag-1', label: 'Begrüßung', durationMs: 10 * MIN, plannedStartMs: 9 * H, category: 'panel' }),
  );
  ck(
    'ablaufToTimetable: ohne Kennung kein id-Feld',
    !!punkte && !('id' in punkte[1]) && punkte[1].durationMs === 0 && punkte[1].note === 'Notiz' && punkte[1].owner === 'Ada',
  );
  ck('ablaufToTimetable: leer/fehlend → null', ablaufToTimetable([]) === null && ablaufToTimetable(undefined) === null);

  // parseTimetable unverändert: drei Felder, keine Kennung (eigene Timer-Liste hat keine, Spec 12).
  ck(
    'parseTimetable: übernimmt label/durationMs/note, verwirft id',
    JSON.stringify(parseTimetable([{ id: 'x', label: 'A', durationMs: 5 * MIN, note: 'n', owner: 'o' }, null, { durationMs: -1 }])) ===
      JSON.stringify([{ label: 'A', durationMs: 5 * MIN, note: 'n' }, { label: '', durationMs: 0 }]),
  );
  ck(
    'parseTimetable: kein Array / nur Nicht-Objekte → null',
    parseTimetable('x') === null && parseTimetable([1, 'a', null]) === null && parseTimetable([]) === null,
  );

  // hatEigeneTimerListe (@jm/show) ist genau die Bedingung, unter der parseTimetable eine Liste liefert.
  const proben: unknown[] = [undefined, null, 'x', 3, {}, [], [null], [1, 'a'], [{}], [null, { label: 'A' }], [[]], [{ label: 'A', durationMs: 1 }]];
  ck(
    'hatEigeneTimerListe ⇔ parseTimetable liefert eine Liste',
    proben.every((raw) => hatEigeneTimerListe({ timetable: raw }) === (parseTimetable(raw) !== null)),
  );
  ck('hatEigeneTimerListe: ohne Einstellungen → nein', hatEigeneTimerListe(undefined) === false);
}

// ── Teil 2a: Kennungen im Timer-Zustand (Spec 6.1, 9.4) ─────────────────────
const laufend: CountdownState = { durationMs: 10 * MIN, delayMs: 0, startedAtMs: 1_000_000, pausedRemainingMs: null };
function zustand(items: TimetableItem[], activeIndex: number | null): SyncedState {
  return { ...INITIAL_STATE, countdown: laufend, timetable: tt(items, activeIndex) };
}
const kennungen = (s: SyncedState): string => JSON.stringify(s.timetable.items.map((i) => i.id));

{
  // Einschub vor dem aktiven Punkt: activeIndex folgt der Kennung, der Countdown bleibt.
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const eingang = [
    { id: 'u1', label: 'Begrüßung', durationMs: 5 * MIN },
    { id: 'neu', label: 'Einschub', durationMs: 3 * MIN },
    { id: 'u2', label: 'Panel', durationMs: 10 * MIN },
    { id: 'u3', label: 'Q&A', durationMs: 5 * MIN },
  ];
  const nachher = reduce(vorher, { type: 'tt:replaceItems', items: eingang });
  ck('replaceItems: mitgegebene Kennungen übernommen', kennungen(nachher) === '["u1","neu","u2","u3"]');
  ck('replaceItems: aktiver Punkt folgt seiner Kennung (Einschub davor)', nachher.timetable.activeIndex === 2);
  ck('replaceItems: Countdown bleibt unangetastet', nachher.countdown === vorher.countdown);
  ck('replaceItems: Kennung gefunden → keine Logzeile', !aktiverPunktVerschwunden(vorher.timetable, nachher.timetable, eingang));
}
{
  // Umsortieren: der aktive Punkt wandert nach vorn, die Markierung mit ihm.
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const nachher = reduce(vorher, {
    type: 'tt:replaceItems',
    items: [
      { id: 'u2', label: 'u2', durationMs: 10 * MIN },
      { id: 'u1', label: 'u1', durationMs: 5 * MIN },
      { id: 'u3', label: 'u3', durationMs: 5 * MIN },
    ],
  });
  ck('replaceItems: umsortiert → aktiver Punkt an neuer Stelle', nachher.timetable.activeIndex === 0);
}
{
  // Aktiver Punkt entfällt: die Nummer bleibt (heutiges Verhalten), die Logzeile ist fällig.
  const vorher = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 1);
  const eingang = [
    { id: 'u1', label: 'u1', durationMs: 5 * MIN },
    { id: 'u3', label: 'u3', durationMs: 5 * MIN },
    { id: 'u4', label: 'u4', durationMs: 5 * MIN },
  ];
  const nachher = reduce(vorher, { type: 'tt:replaceItems', items: eingang });
  ck('replaceItems: aktiver Punkt weg → Nummer gehalten', nachher.timetable.activeIndex === 1);
  ck('replaceItems: aktiver Punkt weg → Countdown bleibt', nachher.countdown === vorher.countdown);
  ck('aktiverPunktVerschwunden: Kennung fehlt → ja', aktiverPunktVerschwunden(vorher.timetable, nachher.timetable, eingang));
  // … und am Ende der Liste wird die Nummer wie bisher begrenzt.
  const amEnde = zustand([item('u1', 5), item('u2', 10), item('u3', 5)], 2);
  const kurz = reduce(amEnde, { type: 'tt:replaceItems', items: [eingang[0], eingang[2]] });
  ck('replaceItems: aktiver Punkt weg, Liste kürzer → auf das Ende begrenzt', kurz.timetable.activeIndex === 1);
}
{
  // Doppelte, leere und fremde Kennungen (z. B. über den Socket :7777) → makeId().
  const s = reduce(INITIAL_STATE, {
    type: 'tt:setAll',
    items: [
      { id: 'x', label: 'a', durationMs: 0 },
      { id: 'x', label: 'b', durationMs: 0 },
      { id: '', label: 'c', durationMs: 0 },
      { id: '   ', label: 'd', durationMs: 0 },
      { id: 7 as unknown as string, label: 'e', durationMs: 0 },
    ],
  });
  const k = s.timetable.items.map((i) => i.id);
  ck('setAll: erste Kennung übernommen', k[0] === 'x');
  ck(
    'setAll: doppelte/leere/fremde Kennung → neu vergeben',
    k.slice(1).every((id) => typeof id === 'string' && id.trim() !== '' && id !== 'x'),
  );
  ck('setAll: alle Kennungen eindeutig', new Set(k).size === k.length);
  ck('setAll: setzt wie bisher zurück', s.timetable.activeIndex === null && s.countdown.startedAtMs === null);
}
{
  // Ohne Kennungen wie heute: Nummer gehalten (begrenzt), neue Zufallskennungen, keine Logzeile.
  const vorher = zustand([item('a', 5), item('b', 10), item('c', 5)], 2);
  const eingang = [
    { label: 'a', durationMs: 5 * MIN },
    { label: 'b', durationMs: 10 * MIN },
  ];
  const nachher = reduce(vorher, { type: 'tt:replaceItems', items: eingang });
  ck('ohne Kennungen: Nummer gehalten, auf das Ende begrenzt', nachher.timetable.activeIndex === 1);
  ck(
    'ohne Kennungen: frische, eindeutige Kennungen',
    nachher.timetable.items.every((i) => typeof i.id === 'string' && i.id.length > 0 && !['a', 'b', 'c'].includes(i.id)) &&
      new Set(nachher.timetable.items.map((i) => i.id)).size === 2,
  );
  ck('ohne Kennungen: Countdown bleibt', nachher.countdown === vorher.countdown);
  ck('ohne Kennungen: keine Logzeile', !aktiverPunktVerschwunden(vorher.timetable, nachher.timetable, eingang));
}
{
  // Ohne aktiven Punkt oder ohne gehaltene Nummer gibt es nichts zu melden.
  const nichtsAktiv = zustand([item('u1', 5)], null);
  ck(
    'aktiverPunktVerschwunden: nichts aktiv → nein',
    !aktiverPunktVerschwunden(nichtsAktiv.timetable, tt([item('u9', 5)], null), [{ id: 'u9', label: 'u9', durationMs: 0 }]),
  );
  const aktiv = zustand([item('u1', 5)], 0);
  const geleert = reduce(aktiv, { type: 'tt:replaceItems', items: [] });
  ck(
    'aktiverPunktVerschwunden: Liste leer, keine Nummer gehalten → nein',
    geleert.timetable.activeIndex === null && !aktiverPunktVerschwunden(aktiv.timetable, geleert.timetable, []),
  );
}
{
  // Kennungs-Durchlauf (Spec 9.3): iveo-Agenda → Show schreiben/lesen → Timer-Punkte tragen die iveo-ID.
  const agenda = agendaToAblauf([
    { id: 'ag-2', program_id: 'se1', sort_order: 1, title: 'Panel', duration_minutes: 45 },
    { id: 'ag-1', program_id: 'se1', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
  ]);
  const show = parseShow(serializeShow({ ...createShow('Durchlauf'), ablauf: normalizeAblauf(agenda) }));
  const s = reduce(INITIAL_STATE, { type: 'tt:setAll', items: ablaufToTimetable(show.ablauf) ?? [] });
  ck('Kennungs-Durchlauf: Timer-Punkte tragen die iveo-Agenda-IDs', kennungen(s) === '["ag-1","ag-2"]');
  // RELOAD mit einem Einschub davor: der Timer bleibt auf „Panel“.
  const aufPanel = reduce(s, { type: 'tt:loadItem', index: 1 });
  const neu = agendaToAblauf([
    { id: 'ag-1', program_id: 'se1', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
    { id: 'ag-0', program_id: 'se1', sort_order: 1, title: 'Grußwort', duration_minutes: 5 },
    { id: 'ag-2', program_id: 'se1', sort_order: 2, title: 'Panel', duration_minutes: 45 },
  ]);
  const nachReload = reduce(aufPanel, { type: 'tt:replaceItems', items: ablaufToTimetable(normalizeAblauf(neu)) ?? [] });
  ck(
    'Kennungs-Durchlauf: nach RELOAD steht der Timer weiter auf „Panel“',
    nachReload.timetable.activeIndex === 2 && nachReload.timetable.items[2].label === 'Panel',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
