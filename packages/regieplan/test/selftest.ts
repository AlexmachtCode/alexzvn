// Selbsttest für @jm/regieplan:
//   node --experimental-strip-types packages/regieplan/test/selftest.ts
import { parseDuration, formatHms, rowsToAoa, parseRegieplan, parseTimeOfDay, formatTimeOfDay, REGIEPLAN_HEADER, extractRowsFromMapping, inspectRegieplan } from '../src/index.ts';

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
ck('rowsToAoa Header', aoa[0].join('|') === 'Programmpunkt|Startzeit|Dauer|Notiz|Verantwortlich|Kategorie');
ck('rowsToAoa Zeile1', aoa[1].join('|') === 'A||00:05:00|x||');
ck('rowsToAoa Zeile2 (leer)', aoa[2].join('|') === 'B|||||');

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

// Startzeit-Spalte
ck('REGIEPLAN_HEADER 6-spaltig', REGIEPLAN_HEADER.join('|') === 'Programmpunkt|Startzeit|Dauer|Notiz|Verantwortlich|Kategorie');
const aoaS = rowsToAoa([{ label: 'A', plannedStartMs: (9 * 60) * 60_000, durationMs: 300_000, note: 'x' }]);
ck('rowsToAoa mit Startzeit', aoaS[1].join('|') === 'A|09:00|00:05:00|x||');
function buildBufS(rows: (string)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz'], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regieplan');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
const bufS = buildBufS([['Keynote', '09:00', '00:30:00', '']]);
const parsedS = await parseRegieplan(bufS, { requireDuration: true });
ck('Startzeit-Spalte erkannt (getrennt von Dauer)', parsedS.source.columns.start !== null && parsedS.source.columns.duration !== null && parsedS.source.columns.start !== parsedS.source.columns.duration);
ck('plannedStartMs geparst', parsedS.rows[0]?.plannedStartMs === (9 * 60) * 60_000);
ck('Dauer weiterhin korrekt', parsedS.rows[0]?.durationMs === 1_800_000);

// extractRowsFromMapping (rein, ohne XLSX)
const rawMap = [
  { A: 'Programmpunkt', B: 'Dauer', C: 'Notiz' },
  { A: 'Keynote', B: '00:30:00', C: 'Bühne' },
  { A: 'Talk', B: '', C: '' },
];
const ex = extractRowsFromMapping(rawMap, 0, { label: 'A', start: null, duration: 'B', note: 'C' }, { requireDuration: true });
ck('extract: Talk ohne Dauer verworfen', ex.rows.length === 1 && ex.skippedRows === 1);
ck('extract: Keynote Dauer+Notiz', ex.rows[0].durationMs === 1_800_000 && ex.rows[0].note === 'Bühne');
// Remap: Start B, Dauer C, positional ab Zeile 0
const rawPos = [{ A: 'Begrüßung', B: '09:00', C: '00:05:00' }];
const exPos = extractRowsFromMapping(rawPos, -1, { label: 'A', start: 'B', duration: 'C', note: null }, { requireDuration: true });
ck('extract positional (headerRow -1)', exPos.rows.length === 1 && exPos.rows[0].plannedStartMs === (9 * 60) * 60_000 && exPos.rows[0].durationMs === 300_000);

// inspectRegieplan (über ein echtes Workbook)
function buildBufAoa(aoa: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Regieplan');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
const insBuf = buildBufAoa([
  ['Programmpunkt', 'Startzeit', 'Dauer', 'Notiz'],
  ['Keynote', '09:00', '00:30:00', 'Bühne'],
]);
const ins = await inspectRegieplan(insBuf, { requireDuration: true });
ck('inspect: headerRow 0', ins.headerRow === 0);
ck('inspect: Auto-columns (label A, start B, duration C)', ins.columns.label === 'A' && ins.columns.start === 'B' && ins.columns.duration === 'C');
ck('inspect: 4 availableColumns', ins.availableColumns.length === 4);
ck('inspect: Dauer-Spalte Header+Sample', (() => { const c = ins.availableColumns.find((x) => x.key === 'C'); return c?.header === 'Dauer' && c?.sample === '00:30:00'; })());
ck('inspect: rawRows durchgereicht', ins.rawRows.length === 2);
const posBuf = buildBufAoa([['Meeting', '00:10:00'], ['Talk', '00:20:00']]);
const insPos = await inspectRegieplan(posBuf, { requireDuration: true });
ck('inspect positional: headerRow -1', insPos.headerRow === -1);
ck('inspect positional: Header leer, Sample gesetzt', insPos.availableColumns[0].header === '' && insPos.availableColumns[0].sample === 'Meeting');

// owner/category
const rawOC = [
  { A: 'Titel', B: 'Wer', C: 'Kat' },
  { A: 'Keynote', B: 'Anna', C: 'Live' },
];
const exOC = extractRowsFromMapping(rawOC, 0, { label: 'A', start: null, duration: null, note: null, owner: 'B', category: 'C' }, {});
ck('extract owner/category gesetzt', exOC.rows[0]?.owner === 'Anna' && exOC.rows[0]?.category === 'Live');
const exNoOC = extractRowsFromMapping(rawOC, 0, { label: 'A', start: null, duration: null, note: null }, {});
ck('extract owner/category nicht gemappt → undefined', exNoOC.rows[0]?.owner === undefined && exNoOC.rows[0]?.category === undefined);
const aoaOC = rowsToAoa([{ label: 'A', durationMs: 300_000, note: 'n', owner: 'Anna', category: 'Live' }]);
ck('rowsToAoa owner/category Spalten', aoaOC[1].join('|') === 'A||00:05:00|n|Anna|Live');
const insOC = await inspectRegieplan(buildBufAoa([
  ['Programmpunkt', 'Verantwortlich', 'Kategorie', 'Dauer'],
  ['Keynote', 'Anna', 'Live', '00:30:00'],
]), { requireDuration: true });
ck('inspect: owner/category erkannt', insOC.columns.owner === 'B' && insOC.columns.category === 'C');
const insArt = await inspectRegieplan(buildBufAoa([
  ['Programmpunkt', 'Startzeit', 'Dauer'],
  ['Keynote', '09:00', '00:30:00'],
]), { requireDuration: true });
ck('inspect: Startzeit nicht als Kategorie (kein bloßes art)', insArt.columns.start === 'B' && insArt.columns.category == null && insArt.columns.duration === 'C');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
