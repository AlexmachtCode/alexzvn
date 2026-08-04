// Selbsttest für @jm/regieplan:
//   node --experimental-strip-types packages/regieplan/test/selftest.ts
import { parseDuration, formatHms, rowsToAoa, parseRegieplan, parseTimeOfDay, formatTimeOfDay, REGIEPLAN_HEADER } from '../src/index.ts';

let pass = 0;
let fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}`);
  }
}

// parseDuration
ck('parseDuration HH:MM:SS', parseDuration('00:05:30') === 330_000);
ck('parseDuration MM:SS', parseDuration('05:30') === 330_000);
ck('parseDuration "5 min"', parseDuration('5 min') === 300_000);
ck('parseDuration "2,5m"', parseDuration('2,5m') === 150_000);
ck('parseDuration Zahl=Minuten', parseDuration(5) === 300_000);
ck('parseDuration Excel-Bruch', parseDuration(5 / 1440) === 300_000); // 5 min als Tagesbruch
ck('parseDuration Date', parseDuration(new Date(Date.UTC(1899, 11, 31, 0, 5, 30))) === 330_000);
ck('parseDuration leer → 0', parseDuration('') === 0 && parseDuration(null) === 0);

// formatHms
ck('formatHms 330000 → 00:05:30', formatHms(330_000) === '00:05:30');
ck('formatHms 0 → leer', formatHms(0) === '' && formatHms(undefined) === '');

// rowsToAoa
const aoa = rowsToAoa([{ label: 'A', durationMs: 300_000, note: 'x' }, { label: 'B' }]);
ck('rowsToAoa Header', aoa[0].join('|') === 'Programmpunkt|Dauer|Notiz');
ck('rowsToAoa Zeile1', aoa[1].join('|') === 'A|00:05:00|x');
ck('rowsToAoa Zeile2 (ohne Dauer/Notiz)', aoa[2].join('|') === 'B||');

// parseTimeOfDay
ck('parseTimeOfDay HH:MM', parseTimeOfDay('09:30') === (9 * 60 + 30) * 60_000);
ck('parseTimeOfDay HH:MM:SS', parseTimeOfDay('09:30:15') === ((9 * 60 + 30) * 60 + 15) * 1000);
ck('parseTimeOfDay Excel-Bruch', parseTimeOfDay(9.5 / 24) === Math.round((9.5 / 24) * 86_400_000));
ck('parseTimeOfDay Date', parseTimeOfDay(new Date(Date.UTC(1899, 11, 31, 9, 30, 0))) === (9 * 60 + 30) * 60_000);
ck('parseTimeOfDay leer → null', parseTimeOfDay('') === null && parseTimeOfDay(null) === null);
ck('parseTimeOfDay Müll → null', parseTimeOfDay('abc') === null && parseTimeOfDay('99:99') === null);
ck('parseTimeOfDay nackte Zahl → null', parseTimeOfDay(5) === null);

// formatTimeOfDay
ck('formatTimeOfDay 09:30', formatTimeOfDay((9 * 60 + 30) * 60_000) === '09:30');
ck('formatTimeOfDay null → leer', formatTimeOfDay(null) === '' && formatTimeOfDay(undefined) === '');

// parseRegieplan über ein echtes Workbook (Dauer optional vs. Pflicht)
const XLSX = await import('xlsx');
function buildBuf(rows: string[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([['Programmpunkt', 'Dauer', 'Notiz'], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regieplan');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
const buf = buildBuf([
  ['Begrüßung', '00:05:00', 'live'],
  ['Talk', '', ''], // ohne Dauer
  ['Pause', '00:10:00', ''],
  ['', '00:01:00', 'kein Titel'], // ohne Titel → immer übersprungen
]);

const lax = await parseRegieplan(buf, { requireDuration: false });
ck('Rundown (Dauer optional): 3 Zeilen', lax.rows.length === 3);
ck('Rundown: Talk ohne Dauer behalten (durationMs 0)', lax.rows.some((r) => r.label === 'Talk' && r.durationMs === 0));
ck('Rundown: Begrüßung-Dauer geparst', lax.rows.find((r) => r.label === 'Begrüßung')?.durationMs === 300_000);

const strict = await parseRegieplan(buf, { requireDuration: true });
ck('Timer (Dauer Pflicht): 2 Zeilen', strict.rows.length === 2);
ck('Timer: Talk ohne Dauer verworfen', !strict.rows.some((r) => r.label === 'Talk'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
