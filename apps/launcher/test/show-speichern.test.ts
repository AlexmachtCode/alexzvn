// Show-Editor ohne Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a, Spec 7.5 (Show-Editor verliert nichts mehr) und Tests 9.5.
import { isDeepStrictEqual } from 'node:util';
import { parseShow, serializeShow, type Show } from '@jm/show';
import {
  baueAblauf, baueGespeicherteShow, bindungAusEditor, formularAusShow, zeilenAusAblauf, zeilenAusSeed, type FormularStand,
} from '../src/renderer/src/lib/show-speichern';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

/** Kennungs-Erzeuger mit Zähler — zeigt, ob und wie viele neue Kennungen entstanden. */
function zaehler(): { neueId: () => string; anzahl: () => number } {
  let n = 0;
  return { neueId: () => `neu-${++n}`, anzahl: () => n };
}
/** Show ohne updatedAt (das setzt erst serializeShow beim Schreiben). */
function ohneZeit(s: Show): Omit<Show, 'updatedAt'> {
  const { updatedAt: _zeit, ...rest } = s;
  return rest;
}

const ROH = {
  schemaVersion: 1,
  name: 'COP31 Tag 1',
  updatedAt: '2026-09-29T08:00:00.000Z',
  tools: [
    { appId: 'jm-timer', network: { host: '10.0.0.5', port: 7777 }, settings: { timetable: [{ label: 'Eigene Liste', durationMs: 90_000 }], durationMs: 300_000 } },
    { appId: 'jm-presenter', document: 'folien/tag1.jmpres', settings: { pin: '4711' } },
    { appId: 'jm-battle', settings: { nameA: 'Team Rot', nameB: 'Team Blau', rounds: 3, crewA: ['Ada'], crewB: ['Bo'] } },
    { appId: 'jm-qa', settings: { speakSeconds: 90, moderation: true, autoTimer: true } },
    { appId: 'jm-rundown', document: 'regie.jmrundown' },
  ],
  ablauf: [
    { id: 'aaaa-1', label: 'Begrüßung', durationMs: 90_000, note: 'kurz', plannedStartMs: 36_000_000, owner: 'Ada', category: 'side-event' },
    { id: 'aaaa-2', label: 'Panel', durationMs: 1_200_000 },
    { id: 'aaaa-3', label: 'Abschluss' },
  ],
  iveo: {
    event: 'cop31',
    baseUrl: 'https://my-iveo.de/api/v1',
    name: 'COP31',
    syncedAt: '2026-09-29T07:59:00.000Z',
    speakers: [{ name: 'Ada Lovelace', title: 'Moderation' }],
    sideEvents: [{ id: 'p1', title: 'Side Event A' }],
    filter: { programId: 'p1' },
  },
};
const geladen = parseShow(JSON.stringify(ROH));
const tool = (s: Show, id: string) => s.tools.find((t) => t.appId === id);

console.log('— Laden und Speichern ohne Änderung (9.5)');
{
  const z = zaehler();
  const ergebnis = baueGespeicherteShow(geladen, formularAusShow(geladen), geladen, z.neueId);
  ck('deepEqual(geladen, ergebnis) bis auf updatedAt', isDeepStrictEqual(ohneZeit(ergebnis), ohneZeit(geladen)));
  const AT = '2026-10-01T12:00:00.000Z';
  ck('Datei byte-gleich (serializeShow)', serializeShow(ergebnis, AT) === serializeShow(geladen, AT));
  ck('keine neuen Kennungen erfunden', z.anzahl() === 0);
  ck('eigene Timer-Liste bleibt', isDeepStrictEqual(tool(ergebnis, 'jm-timer')?.settings, ROH.tools[0].settings));
  ck('Presenter-PIN bleibt', tool(ergebnis, 'jm-presenter')?.settings?.pin === '4711');
  ck('network.port bleibt', tool(ergebnis, 'jm-timer')?.network?.port === 7777);
  ck('iveo.syncedAt bleibt', ergebnis.iveo?.syncedAt === ROH.iveo.syncedAt);
  ck('90-s-Dauer sekundengenau', ergebnis.ablauf?.[0].durationMs === 90_000);
  ck('Kennungen bleiben', ergebnis.ablauf?.map((a) => a.id).join(',') === 'aaaa-1,aaaa-2,aaaa-3');
  const ohneDatei = baueGespeicherteShow(geladen, formularAusShow(geladen), null, z.neueId);
  ck('… auch wenn die aktuelle Datei nicht lesbar ist', isDeepStrictEqual(ohneZeit(ohneDatei), ohneZeit(geladen)));
}

console.log('— iveo-Abfrage zwischen Laden und Speichern (7.5 Regel 1)');
{
  const nachAbfrage = parseShow(JSON.stringify({
    ...ROH,
    ablauf: [...ROH.ablauf, { id: 'aaaa-4', label: 'Nachtrag aus iveo', durationMs: 600_000 }],
    iveo: { ...ROH.iveo, syncedAt: '2026-09-29T08:30:00.000Z' },
  }));
  const f: FormularStand = { ...formularAusShow(geladen), name: 'COP31 Tag 1 (Regie)' };
  const ergebnis = baueGespeicherteShow(geladen, f, nachAbfrage, zaehler().neueId);
  ck('Ablauf unverändert → Ablauf der aktuellen Datei', isDeepStrictEqual(ergebnis.ablauf, nachAbfrage.ablauf));
  ck('… Bindung der aktuellen Datei (neues syncedAt)', ergebnis.iveo?.syncedAt === '2026-09-29T08:30:00.000Z');
  ck('… Name aus dem Formular', ergebnis.name === 'COP31 Tag 1 (Regie)');
  const basis = formularAusShow(geladen);
  const geaendert: FormularStand = { ...basis, ablauf: basis.ablauf.map((r, i) => (i === 1 ? { ...r, minutes: '25' } : r)) };
  const mitFormular = baueGespeicherteShow(geladen, geaendert, nachAbfrage, zaehler().neueId);
  ck('Ablauf im Formular geändert → das Formular gilt', mitFormular.ablauf?.length === 3 && mitFormular.ablauf?.[1].durationMs === 1_500_000);
  ck('… unveränderte Zeile bleibt in allen Feldern gleich', isDeepStrictEqual(mitFormular.ablauf?.[0], geladen.ablauf?.[0]));
  ck('… Bindung bleibt die geladene (ohne neue Bindung)', mitFormular.iveo?.syncedAt === ROH.iveo.syncedAt);
}

console.log('— Tools: nur document, network.host und die Formularfelder');
{
  const basis = formularAusShow(geladen);
  const f: FormularStand = {
    ...basis,
    tools: [
      ...basis.tools.filter((t) => t.appId !== 'jm-rundown').map((t) => (t.appId === 'jm-timer' ? { ...t, host: '10.0.0.9' } : t)),
      { appId: 'jm-titler', document: '', host: '' },
    ],
    battle: { ...basis.battle, nameA: 'Team Grün' },
    qaSpeak: '',
  };
  const e = baueGespeicherteShow(geladen, f, null, zaehler().neueId);
  ck('abgewähltes Tool fällt weg', !tool(e, 'jm-rundown'));
  ck('neues Tool kommt ans Ende, ohne leere Felder', e.tools[e.tools.length - 1].appId === 'jm-titler' && isDeepStrictEqual(tool(e, 'jm-titler'), { appId: 'jm-titler' }));
  ck('Reihenfolge der übrigen bleibt', e.tools.map((t) => t.appId).join(',') === 'jm-timer,jm-presenter,jm-battle,jm-qa,jm-titler');
  ck('Host geändert, Port bleibt', tool(e, 'jm-timer')?.network?.host === '10.0.0.9' && tool(e, 'jm-timer')?.network?.port === 7777);
  ck('Timer-Einstellungen bleiben', isDeepStrictEqual(tool(e, 'jm-timer')?.settings, ROH.tools[0].settings));
  const battle = tool(e, 'jm-battle')?.settings;
  ck('Battle: nameA neu, andere Schlüssel bleiben', battle?.nameA === 'Team Grün' && battle?.nameB === 'Team Blau' && battle?.rounds === 3 && isDeepStrictEqual(battle?.crewA, ['Ada']));
  const qa = tool(e, 'jm-qa')?.settings;
  ck('Q&A: Redezeit geleert → Schlüssel weg, andere bleiben', !!qa && !('speakSeconds' in qa) && qa.moderation === true && qa.autoTimer === true);
  ck('Ablauf unverändert, keine aktuelle Datei → geladener Ablauf', isDeepStrictEqual(e.ablauf, geladen.ablauf));
  const ohneHost = baueGespeicherteShow(geladen, { ...basis, tools: basis.tools.map((t) => (t.appId === 'jm-timer' ? { ...t, host: '' } : t)) }, null, zaehler().neueId);
  ck('Host geleert → nur der Port bleibt', isDeepStrictEqual(tool(ohneHost, 'jm-timer')?.network, { port: 7777 }));
}

console.log('— Dauern und Kennungen im geänderten Ablauf');
{
  const alt = parseShow(JSON.stringify({ schemaVersion: 1, name: 'Alt', tools: [{ appId: 'jm-rundown' }], ablauf: [{ label: 'A', durationMs: 90_000 }, { label: 'B', durationMs: 120_000 }] }));
  const basis = formularAusShow(alt);
  ck('Minuten-Text der 90-s-Zeile ist „2“', basis.ablauf[0].minutes === '2');
  const z = zaehler();
  const f: FormularStand = {
    ...basis,
    ablauf: [...basis.ablauf.map((r, i) => (i === 1 ? { ...r, minutes: '3' } : r)), { id: 'neu-x', label: 'C', minutes: '1.5', note: '' }],
  };
  const e = baueGespeicherteShow(alt, f, null, z.neueId);
  ck('unveränderte Minuten → geladene Dauer (90 s)', e.ablauf?.[0].durationMs === 90_000);
  ck('geänderte Minuten → Eingabe gilt', e.ablauf?.[1].durationMs === 180_000);
  ck('neue Zeile mit 1,5 min und ihrer Kennung', e.ablauf?.[2].durationMs === 90_000 && e.ablauf?.[2].id === 'neu-x');
  ck('Zeilen ohne Kennung bekommen beim Speichern eine', e.ablauf?.[0].id === 'neu-1' && e.ablauf?.[1].id === 'neu-2' && z.anzahl() === 2);
  const unveraendert = baueGespeicherteShow(alt, basis, null, zaehler().neueId);
  ck('Altshow ohne Änderung bleibt byte-gleich (keine Kennungen nachgetragen)', serializeShow(unveraendert, 'x') === serializeShow(alt, 'x'));
  ck('leere Titel fallen weg', baueAblauf([{ label: '  ', minutes: '5', note: '' }], z.neueId).length === 0);
  ck('zeilenAusAblauf trägt Kennung und geladene Dauer mit', isDeepStrictEqual(
    zeilenAusAblauf([{ id: 'x', label: 'L', durationMs: 90_000, owner: 'O' }])[0],
    { id: 'x', label: 'L', minutes: '2', note: '', owner: 'O', geladenDurationMs: 90_000, geladenMinutes: '2' },
  ));
}

console.log('— Name');
{
  const unbenannt = parseShow(JSON.stringify({ schemaVersion: 1, name: '', tools: [{ appId: 'jm-timer' }] }));
  ck('„Unbenannte Show“ erscheint als leeres Namensfeld', formularAusShow(unbenannt).name === '');
  ck('… und bleibt beim Speichern', baueGespeicherteShow(unbenannt, formularAusShow(unbenannt), null, zaehler().neueId).name === 'Unbenannte Show');
}

console.log('— Neue Bindung');
{
  const neu = bindungAusEditor({ event: 'cop31', name: 'COP31', speakers: [], sideEvents: [{ id: 'p2', title: 'Side Event B' }], filter: { programId: 'p2' } });
  ck('Bindung ohne leere Felder', isDeepStrictEqual(neu, { event: 'cop31', name: 'COP31', sideEvents: [{ id: 'p2', title: 'Side Event B' }], filter: { programId: 'p2' } }));
  ck('leerer Filter fällt weg', !('filter' in bindungAusEditor({ event: 'e', name: 'E', filter: {} })));
  const basis = formularAusShow(geladen);
  const zeilen = zeilenAusAblauf([{ id: 'b-1', label: 'Keynote', durationMs: 1_800_000 }]);
  const e = baueGespeicherteShow(geladen, { ...basis, ablauf: zeilen, iveoNeuGebunden: neu }, geladen, zaehler().neueId);
  ck('neue Bindung ersetzt iveo (ohne altes syncedAt)', isDeepStrictEqual(e.iveo, neu));
  ck('… und der neue Ablauf gilt', e.ablauf?.length === 1 && e.ablauf?.[0].id === 'b-1' && e.ablauf?.[0].durationMs === 1_800_000);
}

console.log('— Neue Show (ohne editPath)');
{
  const z = zaehler();
  const f: FormularStand = {
    name: ' Gala ',
    tools: [{ appId: 'jm-battle', document: '', host: '' }, { appId: 'jm-qa', document: ' fragen.jmqa ', host: ' 10.0.0.7 ' }],
    ablauf: [...zeilenAusSeed([{ label: 'Begrüßung', minutes: 5 }], z.neueId), { label: 'ohne Kennung', minutes: '', note: ' Notiz ' }],
    battle: { nameA: 'Rot', nameB: '', rounds: '3' },
    qaSpeak: '120',
    iveoNeuGebunden: null,
  };
  const e = baueGespeicherteShow(null, f, null, z.neueId);
  ck('Name getrimmt', e.name === 'Gala');
  ck('Tools wie bisher gebaut', isDeepStrictEqual(e.tools, [
    { appId: 'jm-battle', settings: { nameA: 'Rot', rounds: 3 } },
    { appId: 'jm-qa', document: 'fragen.jmqa', network: { host: '10.0.0.7' }, settings: { speakSeconds: 120 } },
  ]));
  ck('Szenario-Zeile trägt ihre Kennung', e.ablauf?.[0].id === 'neu-1' && e.ablauf?.[0].durationMs === 300_000);
  ck('Zeile ohne Kennung bekommt eine', e.ablauf?.[1].id === 'neu-2' && e.ablauf?.[1].note === 'Notiz');
  ck('ohne Bindung kein iveo', !('iveo' in e));
  ck('Schema-Version gesetzt', e.schemaVersion === 1);
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
