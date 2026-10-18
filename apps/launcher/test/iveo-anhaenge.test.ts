// Anhänge der Side Events OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket Teil D (Spec 8.2–8.5, 12.3 Nr. 1–7): Abbildung, Löschregel, Laufzeitprüfung, Materialsignatur mit dem
// SHA-256 der Asset-Referenz (M1) und Anhang-Wächter (Ereignisse 8.4, Beobachtung 8.6).
import { createHash } from 'node:crypto';
import type { IveoAgendaItem, IveoMaterial } from '@jm/iveo';
import { istGeloescht, materialienAusAgenda, materialSignatur, pruefeAnhaenge, referenzHash } from '../src/main/iveo-anhaenge';

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

// ── Ende der Fälle ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
