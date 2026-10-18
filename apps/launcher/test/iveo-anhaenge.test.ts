// Anhänge der Side Events OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket Teil D (Spec 8.2–8.5, 12.3 Nr. 1–7): Abbildung, Löschregel, Laufzeitprüfung, Materialsignatur mit dem
// SHA-256 der Asset-Referenz (M1) und Anhang-Wächter (Ereignisse 8.4, Beobachtung 8.6).
import { createHash } from 'node:crypto';
import type { IveoAgendaItem, IveoMaterial } from '@jm/iveo';
import { IveoApiError } from '@jm/iveo';
import {
  erzeugeAnhangWaechter, istGeloescht, materialienAusAgenda, materialSignatur, pruefeAnhaenge, pruefeBeobachtung, referenzHash,
  TEXT_ANHAENGE_GEAENDERT, type AnhangEreignis, type AnhangWaechterAbh,
} from '../src/main/iveo-anhaenge';
import { toClientError } from '../src/main/iveo-abgleich-kern';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** base64url-Zeichen, deterministisch aus einem Samen (Form der gemessenen Referenz, M1). */
function b64(samen: string, n: number): string {
  let s = '';
  for (let i = 0; s.length < n; i++) s += createHash('sha256').update(`${samen}:${i}`).digest('base64url');
  return s.slice(0, n);
}
const MARKER = 'GEHEIM-ASSET';
/** Asset-Referenz in der gemessenen Form (M1): 279 Zeichen, genau ein Punkt (235 + 1 + 43), Marker am Anfang, in der Mitte oder am Ende. */
function referenz(variante: string, wo: 'anfang' | 'mitte' | 'ende' = 'mitte'): string {
  const vorn = b64(`vorn-${variante}`, 235);
  const hinten = b64(`sig-${variante}`, 43);
  if (wo === 'anfang') return `${MARKER}${vorn.slice(MARKER.length)}.${hinten}`;
  if (wo === 'ende') return `${vorn}.${hinten.slice(0, 43 - MARKER.length)}${MARKER}`;
  return `${vorn.slice(0, 100)}${MARKER}${vorn.slice(100 + MARKER.length)}.${hinten}`;
}
/** Alle Ausschnitte von 16 Zeichen (findet die Referenz auch gekürzt oder zerlegt, 12.4 Nr. 41). */
const ausschnitte = (s: string): string[] => Array.from({ length: s.length - 15 }, (_, i) => s.slice(i, i + 16));

const punkt = (id: string, title: string, materials: unknown[]): IveoAgendaItem =>
  ({ id, program_id: 'P-A', title, materials: materials as IveoMaterial[] });
const datei = (id: string, label: string, asset: unknown = { url: `ref-${id}`, mime_type: 'application/pdf', size_bytes: 1000 }, extra: Record<string, unknown> = {}): unknown =>
  ({ id, kind: 'file', label, asset, ...extra });
const link = (id: string, label: string, url: unknown, extra: Record<string, unknown> = {}): unknown =>
  ({ id, kind: 'link', label, external_url: url, ...extra });

console.log('— P5 · Abbildung, Löschregel, Laufzeitprüfung (Spec 8.2, 8.5; 12.3 Nr. 1)');
{
  const agenda = [
    punkt('i1', 'Eröffnung', [datei('m1', 'Deck'), link('m2', 'Website', 'https://example.org/')]),
    punkt('i2', 'Podium', [datei('m3', ''), datei('m4', 'Alt', undefined, { purged_at: '2026-10-16T09:00:00Z' })]),
    punkt('i3', 'Ende', [link('m5', 'Nachlese', 'https://example.org/nach')]),
  ];
  const liste = materialienAusAgenda(agenda);
  ck('P5 12.3 Nr. 1: flach über alle Agenda-Punkte, Reihenfolge wie iveo', liste.map((x) => x.id).join(',') === 'm1,m2,m3,m5');
  ck('P5 12.3 Nr. 1: gelöschter Anhang (purged_at gesetzt) fehlt', !liste.some((x) => x.id === 'm4'));
  ck('P5 12.3 Nr. 1: leeres Label → „(ohne Titel)“', liste.find((x) => x.id === 'm3')?.label === '(ohne Titel)');
  ck('P5 8.2: Abbildung feldweise wie iveo-sync.ts:639-653 (Datei)',
    JSON.stringify(liste[0]) === JSON.stringify({ id: 'm1', label: 'Deck', kind: 'file', agendaTitle: 'Eröffnung', mimeType: 'application/pdf', sizeBytes: 1000, externalUrl: null, hasAsset: true }));
  ck('P5 8.2: Abbildung feldweise (Link ohne Asset)',
    JSON.stringify(liste[1]) === JSON.stringify({ id: 'm2', label: 'Website', kind: 'link', agendaTitle: 'Eröffnung', mimeType: null, sizeBytes: null, externalUrl: 'https://example.org/', hasAsset: false }));
}
{
  const nein: Array<[string, unknown]> = [['null', null], ['fehlend', undefined], ['false', false], ['Leerstring', '']];
  const ja: Array<[string, unknown]> = [['Datum-String', '2026-10-16T09:00:00Z'], ['Zahl 1', 1], ['Zahl 0', 0], ['true', true], ['Objekt', {}]];
  ck('P5 12.3 Nr. 1: istGeloescht nein bei null, fehlend, false, Leerstring', nein.every(([, v]) => istGeloescht(v === undefined ? {} : { purged_at: v }) === false));
  ck('P5 12.3 Nr. 1: istGeloescht ja bei Datum-String, 1, 0, true, Objekt (jeder andere Wert, Annahme 8.5)', ja.every(([, v]) => istGeloescht({ purged_at: v }) === true));
}
{
  const agenda = [
    punkt('i1', 'A', [datei('', 'Leer'), datei('m1', 'Video', undefined, { kind: 'video' }), datei('m2', 'Text', { url: 'r2', size_bytes: '1000' }), null, 'kaputt']),
    punkt('i2', 'B', [datei('m2', 'Doppelt'), datei('m3', 'Minus', { url: 'r3', size_bytes: -1 }), datei('m4', 'Unendlich', { url: 'r4', size_bytes: Infinity }), datei('m5', 'Null', { url: 'r5', size_bytes: 0 })]),
    { id: 'i3', program_id: 'P-A', title: 'ohne Liste' } as IveoAgendaItem,
  ];
  const { gueltig, ungueltig } = pruefeAnhaenge(agenda);
  ck('P5 12.3 Nr. 1: leere id → ungültig (Feld id)', ungueltig.some((u) => u.id === null && u.feld === 'id' && u.item.id === 'i1'));
  ck('P5 12.3 Nr. 1: unbekanntes kind → ungültig (Feld kind, mit Kennung)', ungueltig.some((u) => u.id === 'm1' && u.feld === 'kind'));
  ck('P5 8.5: Eintrag, der kein Objekt ist (null, Text) → ungültig (Feld id)', ungueltig.filter((u) => u.id === null).length === 3);
  ck('P5 12.3 Nr. 1: size_bytes als Text → Größe unbekannt (null)', gueltig.find((g) => g.m.id === 'm2')?.groesse === null);
  ck('P5 8.5: size_bytes −1 und Infinity → unbekannt, 0 → 0', gueltig.find((g) => g.m.id === 'm3')?.groesse === null
    && gueltig.find((g) => g.m.id === 'm4')?.groesse === null && gueltig.find((g) => g.m.id === 'm5')?.groesse === 0);
  ck('P5 12.3 Nr. 1: dieselbe Kennung an zwei Punkten → einmal, das erste Vorkommen gilt',
    gueltig.filter((g) => g.m.id === 'm2').length === 1 && gueltig.find((g) => g.m.id === 'm2')?.item.id === 'i1');
  ck('P5 8.5: Agenda-Punkt ohne materials → nichts, kein Fehler', gueltig.length === 4 && ungueltig.length === 4);
  ck('P5 8.2: materialienAusAgenda trägt sizeBytes nur als gültige Größe',
    JSON.stringify(materialienAusAgenda(agenda).map((x) => x.sizeBytes)) === '[null,null,null,0]');
}

console.log('— P5 · Materialsignatur mit Referenz-Hash (Spec 8.3, M1; 12.3 Nr. 2)');
{
  const A = referenz('A');
  const B = referenz('B');
  const ag = (ref: string): IveoAgendaItem[] =>
    [punkt('i1', 'Eröffnung', [datei('m1', 'Deck', { url: ref, mime_type: 'application/pdf', size_bytes: 1_048_576 }), link('m2', 'Website', 'https://example.org/')])];
  ck('P5 12.3 Nr. 2: Referenz in der gemessenen Form (279 Zeichen, ein Punkt, Marker darin)',
    A.length === 279 && A.split('.').length === 2 && A.includes(MARKER) && referenz('X', 'anfang').length === 279 && referenz('X', 'ende').endsWith(MARKER));
  ck('P5 12.3 Nr. 2: andere Referenz, sonst gleich → andere Signatur', materialSignatur(ag(A)) !== materialSignatur(ag(B)));
  ck('P5 12.3 Nr. 2: gleiche Referenz (je Abruf gleich) → gleiche Signatur', materialSignatur(ag(A)) === materialSignatur(ag(referenz('A'))));
  const sig = materialSignatur(ag(A));
  ck('P5 12.3 Nr. 2: Signaturtext enthält den SHA-256 der Referenz', sig.includes(sha(A)) && referenzHash({ id: 'm1', kind: 'file', label: 'x', asset: { url: A } }) === sha(A));
  ck('P5 12.3 Nr. 2: Signaturtext enthält weder den Marker noch einen 16-Zeichen-Ausschnitt der Referenz',
    !sig.includes('GEHEIM') && ausschnitte(A).every((t) => !sig.includes(t)));
  const umgedreht = [punkt('i1', 'Eröffnung', [link('m2', 'Website', 'https://example.org/'), datei('m1', 'Deck', { url: A, mime_type: 'application/pdf', size_bytes: 1_048_576 })])];
  ck('P5 8.3: neue Reihenfolge in iveo → andere Signatur', materialSignatur(umgedreht) !== sig);
  const mitGeloeschtem = [punkt('i1', 'Eröffnung', [datei('m1', 'Deck', { url: A, mime_type: 'application/pdf', size_bytes: 1_048_576 }), link('m2', 'Website', 'https://example.org/'), datei('m9', 'Weg', undefined, { purged_at: true })])];
  ck('P5 8.3: gelöschter Anhang zählt nicht (Signatur gleich)', materialSignatur(mitGeloeschtem) === sig);
  ck('P5 8.3: referenzHash ohne Asset, mit leerer und mit fehlender Referenz → null',
    referenzHash({ id: 'x', kind: 'link', label: 'x' }) === null && referenzHash({ id: 'x', kind: 'file', label: 'x', asset: { url: '' } }) === null
    && referenzHash({ id: 'x', kind: 'file', label: 'x', asset: {} as IveoMaterial['asset'] }) === null);
}

console.log('— P6 · Anhang-Wächter: Ereignisse, Beobachtung, Takt (Spec 8.2, 8.4, 8.6; 12.3 Nr. 3–7)');
/** Prüfstand: Wächter mit nachgebauter Hülle; die Uhr rückt nur über weiter(). */
function pruefstand(aktiv: string | null = null, ereignisKennung: string | null = 'cop31') {
  const ereignisse: AnhangEreignis[] = [];
  const logs: string[] = [];
  const z = { aktiv, uhr: Date.UTC(2026, 9, 17, 10, 0, 0) };
  const d: AnhangWaechterAbh = {
    aktivProgramId: () => z.aktiv,
    event: () => ereignisKennung,
    jetztIso: () => new Date(z.uhr).toISOString(),
    sende: (e) => { ereignisse.push(e); },
    titelVon: (id) => (id === 'A' ? 'Side Event A' : null),
    log: { info: (m) => { logs.push(m); } },
  };
  return { w: erzeugeAnhangWaechter(d), ereignisse, logs, z, weiter: (ms = 45_000) => { z.uhr += ms; } };
}
/** iveo-Client-Attrappe: Agenda je programId (oder ein Fehler), zählt die Abrufe. */
function attrappe(agenden: Record<string, IveoAgendaItem[] | Error>) {
  const abrufe: string[] = [];
  return {
    abrufe,
    agenden,
    client: {
      listAgendaItems: async (_event: string, program: string): Promise<IveoAgendaItem[]> => {
        abrufe.push(program);
        const a = agenden[program];
        if (a instanceof Error) throw a;
        return a ?? [];
      },
    },
  };
}
const agendaA = (label = 'Deck', mitLink = true): IveoAgendaItem[] =>
  [punkt('i1', 'Eröffnung', [datei('m1', label), ...(mitLink ? [link('m2', 'Website', 'https://example.org/')] : [])])];
const ohneListe = (e: AnhangEreignis | undefined): boolean => !!e && e.materials === undefined;

{
  const p = pruefstand();
  const c = attrappe({ A: agendaA() });
  p.w.beobachte(['A']);
  ck('P6 12.3 Nr. 7: Anmeldung ohne bekannten Stand → kein Ereignis', p.ereignisse.length === 0);
  await p.w.takt(c.client);
  const e1 = p.ereignisse[0];
  ck('P6 12.3 Nr. 3: erste Beobachtung → Ereignis ok mit materials und der Zeit des Abrufs',
    p.ereignisse.length === 1 && e1.ok && e1.programId === 'A' && e1.materials?.map((m) => m.id).join(',') === 'm1,m2' && e1.abgerufen === '2026-10-17T10:00:00.000Z');
  for (let i = 0; i < 3; i++) { p.weiter(); await p.w.takt(c.client); }
  const drei = p.ereignisse.slice(1);
  ck('P6 12.3 Nr. 3: drei Takte unverändert → drei Ereignisse ohne materials, jedes mit neuer Zeit',
    drei.length === 3 && drei.every((e) => e.ok && ohneListe(e)) && new Set(drei.map((e) => e.abgerufen)).size === 3
    && drei[2].abgerufen === '2026-10-17T10:02:15.000Z');
  ck('P6 12.3 Nr. 3: T17 nicht bei der ersten Beobachtung und nicht ohne Änderung', p.logs.length === 0);
  c.agenden.A = agendaA('Deck neu');
  p.weiter(); await p.w.takt(c.client);
  const e5 = p.ereignisse[4];
  ck('P6 12.3 Nr. 3: Label geändert → Ereignis mit materials', e5?.ok === true && e5.materials?.[0].label === 'Deck neu');
  ck('P6 8.4: T17 bei Änderung nach der ersten Beobachtung, Titel aus der Bindung',
    p.logs.length === 1 && p.logs[0] === 'iveo: Anhänge von „Side Event A“ geändert, jetzt 2.' && p.logs[0] === TEXT_ANHAENGE_GEAENDERT('Side Event A', 2));
  c.agenden.A = [punkt('i1', 'Eröffnung', [datei('m1', 'Deck neu'), link('m2', 'Website', 'https://example.org/', { purged_at: '2026-10-17T10:04:00Z' })])];
  p.weiter(); await p.w.takt(c.client);
  const e6 = p.ereignisse[5];
  ck('P6 12.3 Nr. 3: Anhang gelöscht → Ereignis mit materials ohne ihn', e6?.ok === true && e6.materials?.map((m) => m.id).join(',') === 'm1');
  ck('P6 8.4: T17 nennt die neue Zahl', p.logs[1] === 'iveo: Anhänge von „Side Event A“ geändert, jetzt 1.');
}
{
  const p = pruefstand();
  const c = attrappe({ A: agendaA(), B: agendaA() });
  p.w.beobachte(['B']);
  await p.w.takt(c.client);
  c.agenden.B = new IveoApiError(500, 'http_500', 'iveo: Serverfehler');
  p.weiter(); await p.w.takt(c.client);
  const f = p.ereignisse[1];
  ck('P6 12.3 Nr. 4: gelungen → Fehler → ok:false mit dem Text aus toClientError',
    p.ereignisse.length === 2 && f.ok === false && f.error === toClientError(new IveoApiError(500, 'http_500', 'x')).error && f.materials === undefined);
  ck('P6 12.3 Nr. 4: abgerufen bei ok:false = Zeit der letzten gelungenen Prüfung', f.abgerufen === '2026-10-17T10:00:00.000Z');
  ck('P6 8.4: Logzeile T17 nur bei Änderung, nicht bei Fehlern', p.logs.length === 0);
  p.weiter(); await p.w.takt(c.client);
  ck('P6 12.3 Nr. 4: gleicher Fehler wieder → kein Ereignis', p.ereignisse.length === 2);
  const zeit = new Error('Zeitgrenze'); zeit.name = 'TimeoutError';
  c.agenden.B = zeit;
  p.weiter(); await p.w.takt(c.client);
  ck('P6 12.3 Nr. 4: anderer Fehlertext → ein Ereignis', p.ereignisse.length === 3 && p.ereignisse[2].ok === false && p.ereignisse[2].error === toClientError(zeit).error);
  c.agenden.B = agendaA();
  p.weiter(); await p.w.takt(c.client);
  const g = p.ereignisse[3];
  ck('P6 12.3 Nr. 4: Erfolg bei unveränderter Liste → ok:true mit materials (gescheitert → gelungen)',
    p.ereignisse.length === 4 && g.ok === true && g.materials?.length === 2 && g.abgerufen === '2026-10-17T10:03:00.000Z');
  ck('P6 8.4: unveränderte Liste nach dem Wechsel → kein T17', p.logs.length === 0);
}
{
  const p = pruefstand();
  const c = attrappe({ A: new IveoApiError(404, 'not_found', 'weg') });
  p.w.beobachte(['A']);
  await p.w.takt(c.client);
  const f = p.ereignisse[0];
  ck('P6 8.4: erster Abruf scheitert → ok:false, abgerufen leer (noch keine gelungen)', f?.ok === false && f.abgerufen === '' && !!f.error);
  c.agenden.A = agendaA();
  p.weiter(); await p.w.takt(c.client);
  ck('P6 8.4: danach gelungen → ok:true mit materials, kein T17 (erste gelungene Prüfung)',
    p.ereignisse[1]?.ok === true && p.ereignisse[1].materials?.length === 2 && p.logs.length === 0);
}
{
  const p = pruefstand('B');
  const c = attrappe({ A: agendaA(), B: agendaA() });
  p.w.beobachte(['A']);
  await p.w.takt(c.client);
  await p.w.takt(c.client);
  ck('P6 12.3 Nr. 5: aufgeklappte Liste (nicht aktiv) → ein Agenda-Abruf je Takt', c.abrufe.join(',') === 'A,A');
  p.w.beobachte(['B']);
  await p.w.takt(c.client);
  ck('P6 12.3 Nr. 5: aktives Side Event aufgeklappt → kein eigener Abruf', c.abrufe.join(',') === 'A,A');
  const vorher = p.ereignisse.length;
  p.w.agendaVomKern('B', { ok: true, agenda: agendaA('Deck B'), abgerufen: '2026-10-17T10:00:30.000Z' });
  const eb = p.ereignisse[vorher];
  ck('P6 12.3 Nr. 5: die Liste des aktiven kommt aus agendaVomKern, mit der Zeit des Kerns',
    eb?.programId === 'B' && eb.ok && eb.materials?.[0].label === 'Deck B' && eb.abgerufen === '2026-10-17T10:00:30.000Z');
  p.w.beobachte([]);
  const n = p.ereignisse.length;
  await p.w.takt(c.client);
  ck('P6 12.3 Nr. 5: zugeklappt → kein Abruf', c.abrufe.join(',') === 'A,A' && p.ereignisse.length === n);
  p.w.agendaVomKern('C', { ok: true, agenda: agendaA(), abgerufen: '2026-10-17T10:01:00.000Z' });
  ck('P6 8.2: Agenda für eine nicht beobachtete Liste → kein Ereignis', p.ereignisse.length === n);
  p.w.agendaVomKern('B', { ok: false, fehler: new IveoApiError(500, 'http_500', 'x') });
  ck('P6 8.2: gescheiterte Agenda des Kerns → ok:false für das aktive', p.ereignisse[n]?.programId === 'B' && p.ereignisse[n].ok === false);
  p.z.aktiv = null;
  p.w.beobachte(['A']);
  const m = p.ereignisse.length;
  await p.w.takt(null);
  ck('P6 8.2: ohne Client (kein Token) kein Abruf, obwohl eine Liste beobachtet wird', c.abrufe.length === 2 && p.ereignisse.length === m);
  const q = pruefstand(null, null);
  const cq = attrappe({ A: agendaA() });
  q.w.beobachte(['A']);
  await q.w.takt(cq.client);
  ck('P6 8.2: ohne Event (null) kein Abruf, obwohl eine Liste beobachtet wird', cq.abrufe.length === 0 && q.ereignisse.length === 0);
}
{
  const p = pruefstand();
  const c = attrappe({ A: agendaA() });
  p.w.beobachte(['A']);
  await p.w.takt(c.client);
  p.w.zuruecksetzen();
  p.w.beobachte(['A']);
  ck('P6 12.3 Nr. 6: nach zuruecksetzen ist kein Stand bekannt (Anmeldung sendet nichts)', p.ereignisse.length === 1);
  c.agenden.A = agendaA('Anderes Deck');
  await p.w.takt(c.client);
  ck('P6 12.3 Nr. 6: nächste Beobachtung gilt als erste (mit materials, ohne T17)',
    p.ereignisse.length === 2 && p.ereignisse[1].materials?.[0].label === 'Anderes Deck' && p.logs.length === 0);
  {
    // Beobachtung bleibt über zuruecksetzen erhalten (der Renderer meldet nur bei Wechsel neu, 8.2): Takt ruft weiter ab.
    const r = pruefstand();
    const cr = attrappe({ A: agendaA() });
    r.w.beobachte(['A']);
    await r.w.takt(cr.client);
    r.w.zuruecksetzen();
    r.weiter(); await r.w.takt(cr.client);
    ck('P6 8.2: nach zuruecksetzen ohne neue Anmeldung ruft der Takt A weiter ab und sendet materials',
      cr.abrufe.join(',') === 'A,A' && r.ereignisse.length === 2 && r.ereignisse[1].programId === 'A' && r.ereignisse[1].materials?.length === 2);
  }
  let loese: (a: IveoAgendaItem[]) => void = () => {};
  const haengt = { listAgendaItems: (): Promise<IveoAgendaItem[]> => new Promise((r) => { loese = r; }) };
  const lauf = p.w.takt(haengt);
  p.w.zuruecksetzen();
  p.w.beobachte(['A']);
  loese(agendaA('zu spät'));
  await lauf;
  ck('P6 8.2: Ergebnis eines Abrufs, der vor zuruecksetzen begann, wird verworfen (auch bei neu angemeldeter Liste)', p.ereignisse.length === 2);
}
{
  ck('P6 12.3 Nr. 7: 8 Kennungen → angenommen', JSON.stringify(pruefeBeobachtung({ programIds: ['1', '2', '3', '4', '5', '6', '7', '8'] })) === '["1","2","3","4","5","6","7","8"]');
  ck('P6 12.3 Nr. 7: 9 Kennungen → verworfen', pruefeBeobachtung({ programIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }) === null);
  ck('P6 12.3 Nr. 7: Kennung mit 200 Zeichen → angenommen, mit 201 → verworfen',
    pruefeBeobachtung({ programIds: ['x'.repeat(200)] })?.length === 1 && pruefeBeobachtung({ programIds: ['x'.repeat(201)] }) === null);
  ck('P6 12.3 Nr. 7: kein Array, keine Eingabe, Nicht-String, leere Kennung → verworfen',
    pruefeBeobachtung({ programIds: 'A' }) === null && pruefeBeobachtung(null) === null && pruefeBeobachtung(undefined) === null
    && pruefeBeobachtung({ programIds: [1] }) === null && pruefeBeobachtung({ programIds: [''] }) === null);
  ck('P6 12.3 Nr. 7: leere Liste → angenommen (Zuklappen), Doppelte einmal',
    JSON.stringify(pruefeBeobachtung({ programIds: [] })) === '[]' && JSON.stringify(pruefeBeobachtung({ programIds: ['A', 'A'] })) === '["A"]');
}
{
  const p = pruefstand('B');
  const c = attrappe({ A: agendaA(), B: agendaA() });
  p.w.agendaVomKern('B', { ok: true, agenda: agendaA('Deck B'), abgerufen: '2026-10-17T10:00:00.000Z' });
  p.w.beobachte(['A']);
  await p.w.takt(c.client);
  p.ereignisse.length = 0;
  p.w.beobachte([]);
  ck('P6 12.3 Nr. 7: Anmeldung mit [] → Ereignis mit materials für das aktive Side Event',
    p.ereignisse.length === 1 && p.ereignisse[0].programId === 'B' && p.ereignisse[0].materials?.[0].label === 'Deck B');
  p.ereignisse.length = 0;
  p.w.beobachte(['A']);
  ck('P6 12.3 Nr. 7: jede Anmeldung sendet für jede beobachtete Liste mit Stand (aufgeklappt und aktiv), mit materials',
    p.ereignisse.map((e) => `${e.programId}:${e.materials?.length}:${e.ok}`).sort().join(',') === 'A:2:true,B:2:true');
  c.agenden.A = new IveoApiError(500, 'http_500', 'x');
  await p.w.takt(c.client);
  p.ereignisse.length = 0;
  p.w.beobachte(['A']);
  const a = p.ereignisse.find((e) => e.programId === 'A');
  ck('P6 8.4: Anmeldung bei gescheiterter letzter Prüfung → ok:false mit Fehler und der Liste des letzten Stands',
    a?.ok === false && !!a.error && a.materials?.length === 2 && a.abgerufen === '2026-10-17T10:00:00.000Z');
}
{
  // 8.1, Review Focus 6: Zeitpunkt VOR dem Abruf. Der Abruf dauert in der Testuhr 20 s; das Ereignis trägt die Startzeit,
  // mit der der Renderer ein älteres Ergebnis verwirft, wenn sich Abruf und Wächter kreuzen.
  const p = pruefstand();
  const langsam = { listAgendaItems: async (): Promise<IveoAgendaItem[]> => { p.weiter(20_000); return agendaA(); } };
  p.w.beobachte(['A']);
  await p.w.takt(langsam);
  ck('P6 8.1: abgerufen = Zeit vor dem Abruf (Abruf dauert 20 s)',
    p.ereignisse[0]?.abgerufen === '2026-10-17T10:00:00.000Z' && p.z.uhr === Date.UTC(2026, 9, 17, 10, 0, 20));
}
{
  // 11.3 L3 als Folge (EP20): Der Renderer lädt eine angemeldete Liste selbst und löscht dabei seinen Fehler (Task 7). Der
  // nächste Fehlschlag muss danach wieder ankommen, auch mit demselben Text; sonst stünde L5 „Stand ‹hh:mm›“ trotz Störung da.
  const p = pruefstand();
  const c = attrappe({ B: agendaA() });
  const fehler500 = toClientError(new IveoApiError(500, 'http_500', 'x')).error;
  p.w.beobachte(['B']);
  await p.w.takt(c.client);
  c.agenden.B = new IveoApiError(500, 'http_500', 'iveo: Serverfehler');
  p.weiter(); await p.w.takt(c.client);
  p.weiter(); await p.w.takt(c.client);
  const vorher = p.ereignisse.length; // gelungen, gescheitert; der gleiche Fehler danach ist still
  p.w.beobachte([]);
  p.w.beobachte(['B']); // zu- und wieder aufgeklappt: der Renderer lädt selbst
  const nachAnmeldung = p.ereignisse.length;
  p.weiter(); await p.w.takt(c.client);
  const e = p.ereignisse[nachAnmeldung];
  ck('P6 11.3 L3: nach erneuter Anmeldung kommt derselbe Fehler wieder an (ok:false, ohne materials)',
    vorher === 2 && p.ereignisse.length === nachAnmeldung + 1 && e?.ok === false && e.error === fehler500 && e.materials === undefined);
  p.weiter(); await p.w.takt(c.client);
  ck('P6 12.3 Nr. 4: danach ist derselbe Fehler wieder still', p.ereignisse.length === nachAnmeldung + 1);
  p.w.beobachte(['B']); // „Erneut versuchen“: dieselbe Liste noch einmal angemeldet
  const nachErneut = p.ereignisse.length;
  p.weiter(); await p.w.takt(c.client);
  ck('P6 11.3 L3: „Erneut versuchen“ (dieselbe Liste neu angemeldet) → der nächste gleiche Fehler kommt wieder an',
    p.ereignisse.length === nachErneut + 1 && p.ereignisse[nachErneut]?.ok === false && p.ereignisse[nachErneut]?.error === fehler500);
}
{
  // EP20, Nachprüfung 18.10.2026: Ein Wächter-Abruf, der VOR der Anmeldung begann und danach scheitert, löst die Ausnahme
  // nicht ein (hier in derselben Millisekunde: zählt als davor). Sonst gelänge danach das eigene Laden des Renderers, und L5
  // „Stand ‹hh:mm›“ stünde trotz Störung da (gemessen mit echtem Wächter und echtem anhangListeSchritt).
  const p = pruefstand();
  const c = attrappe({ B: agendaA() });
  const fehler500 = toClientError(new IveoApiError(500, 'http_500', 'x')).error;
  p.w.beobachte(['B']);
  await p.w.takt(c.client);
  c.agenden.B = new IveoApiError(500, 'http_500', 'iveo: Serverfehler');
  p.weiter(); await p.w.takt(c.client); // gelungen → gescheitert: ein Ereignis
  p.weiter();
  let lehne: (f: unknown) => void = () => {};
  const haengt = { listAgendaItems: (): Promise<IveoAgendaItem[]> => new Promise((_ok, nein) => { lehne = nein; }) };
  const lauf = p.w.takt(haengt); // der Abruf beginnt …
  p.w.beobachte(['B']); // … dann „Erneut versuchen“ (Anmeldung) in derselben Millisekunde
  const n = p.ereignisse.length;
  p.weiter(5_000);
  lehne(new IveoApiError(500, 'http_500', 'iveo: Serverfehler'));
  await lauf;
  ck('P6 EP20: gleicher Fehler eines Abrufs, der vor der Anmeldung begann (dieselbe Millisekunde) → kein Ereignis, die Ausnahme bleibt',
    p.ereignisse.length === n);
  p.weiter(); await p.w.takt(c.client);
  ck('P6 EP20: … der nächste Abruf (nach der Anmeldung begonnen) scheitert gleich → genau ein Ereignis ok:false mit dem Fehler',
    p.ereignisse.length === n + 1 && p.ereignisse[n]?.ok === false && p.ereignisse[n]?.error === fehler500 && p.ereignisse[n]?.materials === undefined);
  p.weiter(); await p.w.takt(c.client);
  ck('P6 EP20: … danach ist derselbe Fehler wieder still (Ausnahme eingelöst)', p.ereignisse.length === n + 1);
}
{
  // Dasselbe für das aktive Side Event: Seine Agenda kommt aus der Abfrage des Kerns (meldeAgenda, Task 24); ein Fehlschlag
  // trägt den Zeitpunkt vor seinem Abruf. Vor der Anmeldung begonnen → still; danach begonnen → ein Ereignis.
  const p = pruefstand('B');
  const iso = (): string => new Date(p.z.uhr).toISOString();
  const kernFehler = () => ({ ok: false as const, fehler: new IveoApiError(500, 'http_500', 'iveo: Serverfehler'), abgerufen: iso() });
  p.w.beobachte(['B']);
  p.w.agendaVomKern('B', { ok: true, agenda: agendaA(), abgerufen: iso() });
  p.weiter();
  p.w.agendaVomKern('B', kernFehler()); // gelungen → gescheitert: ein Ereignis
  p.weiter();
  const alt = kernFehler(); // die Abfrage des Kerns beginnt …
  p.weiter(1_000);
  p.w.beobachte(['B']); // … „Erneut versuchen“ eine Sekunde später
  const n = p.ereignisse.length;
  p.w.agendaVomKern('B', alt);
  ck('P6 EP20: aktives Side Event, gleicher Fehler aus einer Abfrage des Kerns, die vor der Anmeldung begann → kein Ereignis',
    p.ereignisse.length === n);
  p.weiter();
  p.w.agendaVomKern('B', kernFehler());
  ck('P6 EP20: … aus der nächsten Abfrage des Kerns (nach der Anmeldung begonnen) → ein Ereignis ok:false',
    p.ereignisse.length === n + 1 && p.ereignisse[n]?.programId === 'B' && p.ereignisse[n]?.ok === false);
}
{
  // EP20, Nachfix 18.10.2026: Der Abruf nach der Anmeldung scheitert schnell (Ereignis, die Ausnahme ist eingelöst); das eigene
  // Laden des Renderers, das mit der Anmeldung begann, gelingt erst danach und löscht seinen Fehler. Die Hülle meldet es
  // (eigenesLaden, Task 28); der nächste Fehlschlag eines danach begonnenen Abrufs kommt wieder an, sonst stünde L5 trotz Störung.
  const p = pruefstand();
  const c = attrappe({ B: agendaA() });
  const iso = (): string => new Date(p.z.uhr).toISOString();
  p.w.beobachte(['B']);
  await p.w.takt(c.client);
  c.agenden.B = new IveoApiError(500, 'http_500', 'iveo: Serverfehler');
  p.weiter(); await p.w.takt(c.client);
  p.weiter(10_000);
  p.w.beobachte(['B']); // „Erneut versuchen“: Anmeldung, das eigene Laden beginnt
  const eigenesLadenBeginn = iso();
  p.weiter(1_000); await p.w.takt(c.client); // Abruf nach der Anmeldung, scheitert schnell: Ausnahme eingelöst
  const n = p.ereignisse.length;
  p.weiter(3_000);
  p.w.eigenesLaden('B', eigenesLadenBeginn); // das eigene Laden gelingt erst jetzt
  ck('P6 EP20: gelungenes eigenes Laden → kein Ereignis, kein Abruf', p.ereignisse.length === n && c.abrufe.length === 3);
  p.weiter(); await p.w.takt(c.client);
  ck('P6 EP20: … nach dem eigenen Laden kommt der nächste gleiche Fehler wieder an (der Renderer hat seinen Fehler gelöscht)',
    p.ereignisse.length === n + 1 && p.ereignisse[n]?.ok === false);
  p.weiter(); await p.w.takt(c.client);
  ck('P6 EP20: … und ist danach wieder still', p.ereignisse.length === n + 1);
}
{
  // EP20, Nachfix 2 (18.10.2026): Die Ausnahme gilt ab dem BEGINN des eigenen Ladens (`abgerufen` der Hülle), nicht ab seinem
  // Ende. Ein Abruf des Wächters, der während des Ladens beginnt und erst nach dessen Erfolg gleich scheitert, kommt an: Der
  // Renderer hat seinen Fehler mit dem eigenen Laden gelöscht.
  const p = pruefstand();
  const c = attrappe({ B: agendaA() });
  const iso = (): string => new Date(p.z.uhr).toISOString();
  const fehler500 = toClientError(new IveoApiError(500, 'http_500', 'x')).error;
  p.w.beobachte(['B']);
  await p.w.takt(c.client);
  c.agenden.B = new IveoApiError(500, 'http_500', 'iveo: Serverfehler');
  p.weiter(); await p.w.takt(c.client);
  p.weiter(10_000);
  p.w.beobachte(['B']); // „Erneut versuchen“: Anmeldung, das eigene Laden beginnt
  const eigenesLadenBeginn = iso();
  p.weiter(1_000); await p.w.takt(c.client); // Abruf nach der Anmeldung, scheitert schnell: Ausnahme eingelöst
  p.weiter(1_000);
  let lehne: (f: unknown) => void = () => {};
  const haengt = { listAgendaItems: (): Promise<IveoAgendaItem[]> => new Promise((_ok, nein) => { lehne = nein; }) };
  const lauf = p.w.takt(haengt); // der nächste Abruf beginnt während des eigenen Ladens …
  p.weiter(2_000);
  p.w.eigenesLaden('B', eigenesLadenBeginn); // … das eigene Laden gelingt, während er noch läuft …
  const n = p.ereignisse.length;
  p.weiter(1_000);
  lehne(new IveoApiError(500, 'http_500', 'iveo: Serverfehler')); // … und er scheitert erst danach, gleich
  await lauf;
  ck('P6 EP20: Abruf während des eigenen Ladens begonnen, gleicher Fehler erst nach dessen Erfolg → ein Ereignis ok:false (die Ausnahme gilt ab dem Beginn des Ladens)',
    p.ereignisse.length === n + 1 && p.ereignisse[n]?.ok === false && p.ereignisse[n]?.error === fehler500);
}

{
  // Fix-Runde 2 (Task 7): Der Renderer verwirft einen veralteten Fehlschlag nur, wenn das Ereignis den Beginn des Versuchs trägt.
  const p = pruefstand();
  const c = attrappe({ A: new IveoApiError(500, 'http_500', 'x') });
  p.w.beobachte(['A']);
  const beginn = new Date(p.z.uhr).toISOString();
  await p.w.takt(c.client);
  ck('P6 Fix 2: Fehlschlag des Wächter-Takts trägt den Beginn des Abrufs (begann), abgerufen bleibt die letzte gelungene Prüfung',
    p.ereignisse[0]?.ok === false && p.ereignisse[0].begann === beginn && p.ereignisse[0].abgerufen === '');
  const kern = '2026-10-17T10:05:00.000Z';
  p.w.agendaVomKern('A', { ok: false, fehler: new IveoApiError(503, 'http_503', 'y'), abgerufen: kern });
  const k = p.ereignisse[p.ereignisse.length - 1];
  ck('P6 Fix 2: Fehlschlag aus dem Kern trägt dessen Beginn (begann)', k?.ok === false && k.begann === kern);
  const q = pruefstand();
  q.w.beobachte(['A']);
  await q.w.takt(attrappe({ A: agendaA() }).client);
  ck('P6 Fix 2: gelungene Prüfung trägt kein begann', q.ereignisse[0]?.ok === true && !('begann' in q.ereignisse[0]));
}

{
  // Fix-Runde 3 (Task 7): Der Main verwirft einen Fehlschlag, der vor seiner gespeicherten gelungenen Prüfung begann, selbst
  // (der Renderer verwirft ihn ebenfalls); er merkt ihn nicht und bucht ihn nicht als gemeldet, sonst bliebe ein späterer
  // gleicher Fehler still, und der Renderer zeigte L5 trotz Störung.
  const p = pruefstand();
  p.w.beobachte(['A']);
  p.w.agendaVomKern('A', { ok: true, agenda: agendaA(), abgerufen: '2026-10-17T10:03:00.000Z' });
  const n = p.ereignisse.length;
  const zeitgrenze = (): IveoApiError => new IveoApiError(500, 'http_500', 'iveo: Zeitgrenze');
  p.w.agendaVomKern('A', { ok: false, fehler: zeitgrenze(), abgerufen: '2026-10-17T10:01:00.000Z' });
  ck('P6 Fix 3: Fehlschlag, der vor der gespeicherten gelungenen Prüfung begann, wird nicht gesendet', p.ereignisse.length === n);
  p.w.agendaVomKern('A', { ok: false, fehler: zeitgrenze(), abgerufen: '2026-10-17T10:04:00.000Z' });
  ck('P6 Fix 3: der verworfene Fehlschlag war nicht als gemeldet gebucht, der gleiche Fehler danach kommt (ein Ereignis ok:false)',
    p.ereignisse.length === n + 1 && p.ereignisse[n]?.ok === false && p.ereignisse[n]?.begann === '2026-10-17T10:04:00.000Z');
}

// ── Ende der Fälle ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
