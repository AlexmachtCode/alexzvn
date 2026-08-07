// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Kein Netz — der fetch wird injiziert (opts.fetchImpl). Deckt Mapping, Cursor-
// Pagination, Fehler-Envelope, Retry/Backoff und Datensparsamkeit/Token-Hygiene.

import {
  IveoClient,
  IveoApiError,
  normalizeIveoBaseUrl,
  createIveoClient,
  durationMsOf,
  programsToAblauf,
  snapshotToAblauf,
  snapshotToShowSpeakers,
  programTaxonomy,
  filterPrograms,
  programDayKey,
  isBlockerProgram,
  agendaToAblauf,
  extractSpeakerIds,
  speakersToShowSpeakers,
  buildShowMetadata,
  speakerName,
  localTimeOfDayMs,
  programToAblaufItem,
  type IveoFetchLike,
  type IveoFetchResponse,
  type IveoProgram,
  type IveoSnapshot,
} from '../src/index';
import { createShow, parseShow, serializeShow } from '@jm/show';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const prog = (over: Partial<IveoProgram>): IveoProgram => ({
  id: 'p',
  event_id: 'e1',
  title: 'T',
  ...over,
});

const snapshot: IveoSnapshot = {
  event: {
    id: 'e1',
    slug: 'cop30',
    name: 'COP30',
    starts_at: '2026-11-10T00:00:00+00:00',
    ends_at: '2026-11-21T23:59:00+00:00',
    timezone: 'America/Belem',
  },
  programs: [
    prog({ id: 'p2', title: 'Zweitens', starts_at: '2026-11-12T12:00:00+00:00', duration_minutes: 90, subtitle: 'Sub', stage_id: 's1' }),
    prog({ id: 'p1', title: 'Erstens', starts_at: '2026-11-12T09:00:00+00:00', ends_at: '2026-11-12T09:30:00+00:00' }),
    prog({ id: 'p3', title: 'Ohne Zeit' }),
  ],
  speakers: [
    { id: 'sp1', event_id: 'e1', salutation: 'Dr.', first_name: 'Ana', last_name: 'Ferreira', title: 'Lead Negotiator', bio: 'GEHEIM-BIO sollte nicht in Metadaten', photo: { url: 'https://x/api/v1/assets/photo1' } },
  ],
  organisations: [{ id: 'o1', name: 'UNFCCC' }],
  stages: [{ id: 's1', event_id: 'e1', name: 'Blue Zone Plenary', color: '#1B66FF' }],
  fetchedAt: '2026-11-09T07:55:02+00:00',
};

// ── durationMsOf ──────────────────────────────────────────────────────────────
ok(durationMsOf(prog({ duration_minutes: 90 })) === 90 * 60_000, 'durationMsOf: duration_minutes → ms');
ok(
  durationMsOf(prog({ starts_at: '2026-11-12T09:00:00+00:00', ends_at: '2026-11-12T09:30:00+00:00' })) === 30 * 60_000,
  'durationMsOf: Fallback ends_at - starts_at',
);
ok(durationMsOf(prog({})) === 0, 'durationMsOf: unbekannt → 0');

// ── programsToAblauf ─────────────────────────────────────────────────────────
const stagesById = new Map(snapshot.stages.map((s) => [s.id, s]));
const ablauf = programsToAblauf(snapshot.programs, { stagesById });
ok(ablauf[0].label === 'Erstens', 'programsToAblauf: nach starts_at sortiert (Erstens zuerst)');
ok(ablauf[1].label === 'Zweitens' && ablauf[1].durationMs === 90 * 60_000, 'programsToAblauf: Dauer aus duration_minutes');
ok(ablauf[1].note === 'Sub · Blue Zone Plenary', 'programsToAblauf: Notiz = Subtitle · Stage-Name');
ok(ablauf[2].label === 'Ohne Zeit' && ablauf[2].durationMs === undefined, 'programsToAblauf: Programm ohne Zeit ans Ende, keine Dauer');

// ── programTaxonomy + filterPrograms (Side-Events-Filter, #11) ───────────────
{
  const progs = [
    prog({ id: 'a', type_slug: 'side_event', format_slug: 'onsite' }),
    prog({ id: 'b', type_slug: 'side_event', format_slug: 'hybrid' }),
    prog({ id: 'c', type_slug: 'plenary', format_slug: 'onsite' }),
  ];
  const tax = programTaxonomy(progs);
  ok(tax.types[0].value === 'side_event' && tax.types[0].count === 2, 'programTaxonomy: häufigster Typ zuerst');
  ok(tax.types.length === 2 && tax.formats.length === 2, 'programTaxonomy: distinkte Typen + Formate');
  ok(filterPrograms(progs, { typeSlug: 'side_event' }).length === 2, 'filterPrograms: nach Typ');
  ok(filterPrograms(progs, { formatSlug: 'onsite' }).length === 2, 'filterPrograms: nach Format');
  ok(filterPrograms(progs, {}).length === 3, 'filterPrograms: leer → alle');
  ok(
    filterPrograms(progs, { typeSlug: 'side_event', formatSlug: 'onsite' }).length === 1,
    'filterPrograms: Typ UND Format',
  );
}

// ── Tag-Filter + Blocker (mehrtägiger iveo-Plan → ein Tag, #11) ──────────────
{
  const progs = [
    prog({ id: 'd1a', starts_at_local: '2024-11-15T10:00:00', title: 'Side Event A' }),
    prog({ id: 'd1b', starts_at_local: '2024-11-15T14:00:00', title: 'Side Event B' }),
    prog({ id: 'd2a', starts_at_local: '2024-11-16T09:00:00', title: 'Side Event C' }),
    prog({ id: 'blk', starts_at_local: '2024-11-15T20:00:00', title: 'Blocker | Nov 15, 8pm' }),
    prog({ id: 'draft', title: 'Entwurf ohne Termin' }), // kein starts_at → kein Tag
  ];
  ok(programDayKey(progs[0]) === '2024-11-15', 'programDayKey: lokale Startzeit → YYYY-MM-DD');
  ok(programDayKey(progs[4]) === '', 'programDayKey: ohne Startzeit → leer');
  ok(isBlockerProgram(progs[3]) && !isBlockerProgram(progs[0]), 'isBlockerProgram: nur Blocker-Titel');
  const tax = programTaxonomy(progs);
  ok(tax.days.length === 2 && tax.days[0].value === '2024-11-15', 'programTaxonomy: Tage chronologisch');
  ok(tax.days[0].count === 3 && tax.days[1].count === 1, 'programTaxonomy: Programme je Tag (inkl. Blocker)');
  ok(tax.blockerCount === 1, 'programTaxonomy: Blocker gezählt');
  ok(filterPrograms(progs, { day: '2024-11-15' }).length === 3, 'filterPrograms: nur ein Tag');
  ok(
    filterPrograms(progs, { day: '2024-11-15', excludeBlockers: true }).length === 2,
    'filterPrograms: Tag UND ohne Blocker → nur echte Side Events',
  );
  ok(filterPrograms(progs, { excludeBlockers: true }).length === 4, 'filterPrograms: nur Blocker raus');
  ok(filterPrograms(progs, { programId: 'irrelevant' }).length === 5, 'filterPrograms: ignoriert programId');
}

// ── Agenda-Drill + Speaker-Eingrenzung (ein Side Event, #11 Phase 3b) ────────
{
  const items = [
    { id: 'a2', program_id: 'p', sort_order: 1, title: 'Panel', duration_minutes: 45, notes: 'Bühne' },
    { id: 'a1', program_id: 'p', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
    { id: 'a3', program_id: 'p', sort_order: 2, title: 'Q&A' },
  ];
  const ab = agendaToAblauf(items);
  ok(ab[0].label === 'Begrüßung' && ab[1].label === 'Panel' && ab[2].label === 'Q&A', 'agendaToAblauf: nach sort_order');
  ok(ab[1].durationMs === 45 * 60_000 && ab[1].note === 'Bühne', 'agendaToAblauf: Dauer + Notiz');
  ok(ab[2].durationMs === undefined, 'agendaToAblauf: ohne Dauer → keine');

  // Speaker-Verknüpfung tolerant: verschiedene Formen + Abwesenheit.
  ok(JSON.stringify(extractSpeakerIds({ speaker_ids: ['s1', 's2'] })) === '["s1","s2"]', 'extractSpeakerIds: speaker_ids[]');
  ok(JSON.stringify(extractSpeakerIds({ speakers: [{ id: 's3' }, 's4'] })) === '["s3","s4"]', 'extractSpeakerIds: speakers[{id}|str]');
  ok(JSON.stringify(extractSpeakerIds({ speaker_id: 's5' })) === '["s5"]', 'extractSpeakerIds: speaker_id');
  ok(extractSpeakerIds({ title: 'nix' }).length === 0, 'extractSpeakerIds: keine Verknüpfung → leer');
  ok(extractSpeakerIds(null).length === 0, 'extractSpeakerIds: null → leer');

  // Eingegrenzte Speaker-Liste (nur die verknüpften) → sanitisiert.
  const scoped = speakersToShowSpeakers(
    snapshot.speakers.filter((s) => new Set(['sp1']).has(s.id)),
  );
  ok(scoped.length === 1 && scoped[0].name === 'Dr. Ana Ferreira', 'speakersToShowSpeakers: eingegrenzte Auswahl');
}

// localTimeOfDayMs — maschinen-lokale Tageszeit aus UTC (TZ-unabhängig geprüft,
// indem der Erwartungswert mit derselben Date-API gebildet wird).
{
  const utcIso = '2026-11-12T09:30:00+00:00';
  const d = new Date(utcIso);
  const expectLocal = (d.getHours() * 60 + d.getMinutes()) * 60_000 + d.getSeconds() * 1000;
  ok(localTimeOfDayMs({ starts_at: utcIso }) === expectLocal, 'localTimeOfDayMs: starts_at → maschinen-lokale Tageszeit');
  ok(
    localTimeOfDayMs({ starts_at_local: '2026-11-12T14:05:00' }) === (14 * 60 + 5) * 60_000,
    'localTimeOfDayMs: starts_at_local-Fallback (Wanduhr)',
  );
  ok(localTimeOfDayMs({}) === null && localTimeOfDayMs({ starts_at: 'quatsch' }) === null, 'localTimeOfDayMs: fehlend/Müll → null');

  // Programm-Pfad mit Options
  const pSched = prog({ id: 'p9', title: 'Panel', starts_at: utcIso, duration_minutes: 30, format_slug: 'panel', type_slug: 'side-event', speaker_ids: ['sp1'] });
  const names = new Map([['sp1', 'Ada Lovelace']]);
  const withOpts = programToAblaufItem(pSched, { withSchedule: true, speakerNamesById: names });
  ok(withOpts.plannedStartMs === expectLocal, 'programToAblaufItem: plannedStartMs aus starts_at');
  ok(withOpts.category === 'panel', 'programToAblaufItem: category aus format_slug');
  ok(withOpts.owner === 'Ada Lovelace', 'programToAblaufItem: owner aus verknüpftem Speaker');
  const noOpts = programToAblaufItem(pSched);
  ok(
    noOpts.plannedStartMs === undefined && noOpts.category === undefined && noOpts.owner === undefined,
    'programToAblaufItem: ohne Options unverändert (Regression)',
  );

  // Agenda-Pfad mit Options — NUR Punkt 1 trägt den Anker, alle erben category
  const items = [
    { id: 'a2', program_id: 'p', sort_order: 1, title: 'Panel', duration_minutes: 45, notes: 'Bühne' },
    { id: 'a1', program_id: 'p', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
    { id: 'a3', program_id: 'p', sort_order: 2, title: 'Q&A' },
  ];
  const agOpts = agendaToAblauf(items, { firstStartMs: expectLocal, category: 'panel', speakerNamesById: names });
  ok(agOpts[0].plannedStartMs === expectLocal, 'agendaToAblauf: erster Punkt trägt Anker');
  ok(agOpts[1].plannedStartMs === undefined && agOpts[2].plannedStartMs === undefined, 'agendaToAblauf: Folgepunkte ohne Startzeit (Kette im Timer)');
  ok(agOpts.every((a) => a.category === 'panel'), 'agendaToAblauf: category vererbt');
  const agNo = agendaToAblauf(items);
  ok(
    agNo[0].plannedStartMs === undefined && agNo[0].category === undefined,
    'agendaToAblauf: ohne Options unverändert (Regression)',
  );
  ok(
    agendaToAblauf(items, { speakerNamesById: names })[0].owner === undefined,
    'agendaToAblauf: ohne Speaker-Verknüpfung bleibt owner leer (kein Fehler)',
  );
}

// ── speakerName ──────────────────────────────────────────────────────────────
ok(speakerName(snapshot.speakers[0]) === 'Dr. Ana Ferreira', 'speakerName: Anrede + Vor- + Nachname');

// ── buildShowMetadata: Allowlist / keine PII / kein Token ─────────────────────
const meta = buildShowMetadata(snapshot, 'https://staging-dev.my-iveo.de/api/v1');
const metaJson = JSON.stringify(meta);
ok(meta.programs.length === 3 && meta.programs[0].title === 'Erstens', 'buildShowMetadata: Programme sortiert übernommen');
ok(!metaJson.includes('GEHEIM-BIO'), 'buildShowMetadata: keine Bio (PII) in den Metadaten');
ok(!metaJson.includes('photo1'), 'buildShowMetadata: keine Foto-URL (PII) in den Metadaten');
ok(meta.speakers[0].name === 'Dr. Ana Ferreira' && meta.speakers[0].title === 'Lead Negotiator', 'buildShowMetadata: Speaker-Name+Titel erlaubt');

// ── Fake-fetch-Infrastruktur ─────────────────────────────────────────────────
function mkRes(status: number, body: unknown, headers: Record<string, string> = {}): IveoFetchResponse {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => raw,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

// ── Cursor-Pagination (§6) ───────────────────────────────────────────────────
{
  const seenUrls: string[] = [];
  const fetchImpl: IveoFetchLike = async (url) => {
    seenUrls.push(url);
    if (url.includes('cursor=')) {
      return mkRes(200, { data: [prog({ id: 'p3' })], meta: { request_id: 'r', pagination: { next_cursor: null, limit: 200 } } });
    }
    return mkRes(200, { data: [prog({ id: 'p1' }), prog({ id: 'p2' })], meta: { request_id: 'r', pagination: { next_cursor: 'CUR2', limit: 200 } } });
  };
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl });
  const programs = await client.listPrograms('cop30');
  ok(programs.length === 3, 'Cursor-Pagination: alle Seiten eingesammelt (2 + 1)');
  ok(seenUrls.length === 2 && seenUrls[1].includes('cursor=CUR2'), 'Cursor-Pagination: zweite Seite mit next_cursor angefragt');
  ok(!seenUrls.some((u) => u.includes('iveo_live_')), 'Token NICHT in der Query-URL (nur Header, §3)');
}

// ── Header-Injektion + Token-Hygiene ─────────────────────────────────────────
{
  let authHeader: string | undefined;
  const fetchImpl: IveoFetchLike = async (_url, init) => {
    authHeader = init?.headers?.['Authorization'];
    return mkRes(200, { data: { events: [{ id: 'e1', slug: 'cop30', name: 'COP30' }], _links: {} }, meta: { request_id: 'r' } });
  };
  const client = createIveoClient({ token: 'iveo_live_SECRET', fetchImpl });
  const events = await client.discovery();
  ok(authHeader === 'Bearer iveo_live_SECRET', 'Bearer-Header wird gesetzt');
  ok(!JSON.stringify(events).includes('iveo_live_'), 'Discovery-Ergebnis enthält kein Token');
}

// ── Fehler-Envelope → IveoApiError.code (§4/§9) ──────────────────────────────
{
  const fetchImpl: IveoFetchLike = async () =>
    mkRes(404, { errors: [{ code: 'event_not_found', message: 'Event not found.' }], meta: { request_id: 'r9' } });
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl });
  let caught: unknown;
  try {
    await client.getEvent('missing');
  } catch (e) {
    caught = e;
  }
  ok(caught instanceof IveoApiError, 'Fehler wirft IveoApiError');
  ok(caught instanceof IveoApiError && caught.code === 'event_not_found', 'Fehler-code aus errors[0].code');
  ok(caught instanceof IveoApiError && caught.isNotFoundOrOutOfScope, '404 → isNotFoundOrOutOfScope');
  ok(caught instanceof IveoApiError && caught.requestId === 'r9', 'request_id übernommen');
}

// ── Asset-Fetch: nackte ID → /assets/<id>, volle URL unangetastet (§7) ───────
{
  const seen: string[] = [];
  const fetchImpl: IveoFetchLike = async (url) => {
    seen.push(url);
    return mkRes(200, '', { 'content-type': 'application/pdf' });
  };
  const client = new IveoClient({
    token: 'iveo_live_SECRET',
    baseUrl: 'https://staging-dev.my-iveo.de/api/v1',
    fetchImpl,
  });
  // Material-Asset liefert nur die signierte Asset-ID (keine URL) → selbst bauen.
  const assetId = 'WyJhZ2VuZGEtbWF0ZXJpYWxzIiwiZm9vLnBwdHgiXQ.SIG-_abc'; // gitleaks:allow — erfundene Test-Fixture, kein Secret
  await client.fetchAsset(assetId);
  ok(
    seen[0] === `https://staging-dev.my-iveo.de/api/v1/assets/${assetId}`,
    'fetchAsset: nackte ID → <baseUrl>/assets/<id>',
  );
  // IveoAssetRef (Logos/Fotos) liefert die volle URL → unverändert benutzen.
  await client.fetchAsset('https://cdn.example/api/v1/assets/logo1');
  ok(seen[1] === 'https://cdn.example/api/v1/assets/logo1', 'fetchAsset: volle URL bleibt unverändert');
  // „/assets/<id>" bzw. „assets/<id>" nicht verdoppeln.
  await client.fetchAsset('/assets/xyz');
  ok(seen[2] === 'https://staging-dev.my-iveo.de/api/v1/assets/xyz', 'fetchAsset: „/assets/<id>" wird nicht verdoppelt');
  ok(!seen.some((u) => u.includes('iveo_live_')), 'fetchAsset: kein Token in der URL (nur Header)');
}

// ── Retry/Backoff auf 5xx (§9) ───────────────────────────────────────────────
{
  let calls = 0;
  const fetchImpl: IveoFetchLike = async () => {
    calls++;
    if (calls < 3) return mkRes(503, { errors: [{ code: 'internal', message: 'x' }] });
    return mkRes(200, { data: { id: 'e1', slug: 'cop30', name: 'COP30', starts_at: null, ends_at: null, timezone: null }, meta: { request_id: 'r' } });
  };
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl, sleepImpl: async () => {}, retryBaseMs: 1 });
  const ev = await client.getEvent('cop30');
  ok(calls === 3 && ev.slug === 'cop30', 'Retry: 503,503 → 200 nach 3 Versuchen');
}

// ── normalizeIveoBaseUrl (Robustheit gegen „Failed to parse URL") ─────────────
ok(normalizeIveoBaseUrl('') === 'https://staging-dev.my-iveo.de/api/v1', 'baseUrl: leer → Default');
ok(normalizeIveoBaseUrl('  ') === 'https://staging-dev.my-iveo.de/api/v1', 'baseUrl: nur Whitespace → Default');
ok(
  normalizeIveoBaseUrl('staging-dev.my-iveo.de/api/v1') === 'https://staging-dev.my-iveo.de/api/v1',
  'baseUrl: fehlendes Schema → https:// ergänzt',
);
ok(
  normalizeIveoBaseUrl('https://x.example/api/v1/') === 'https://x.example/api/v1',
  'baseUrl: trailing slash entfernt',
);
{
  let threw = false;
  try {
    normalizeIveoBaseUrl('http://'); // Schema ohne Host
  } catch {
    threw = true;
  }
  ok(threw, 'baseUrl: Schema ohne Host → wirft klar (statt „Failed to parse URL")');
}

// ── bad_envelope-Diagnose (falsche Basis-URL → HTML) ─────────────────────────
{
  const fetchImpl: IveoFetchLike = async () =>
    mkRes(200, '<!doctype html><html><body>Nicht die API</body></html>', { 'content-type': 'text/html' });
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl });
  let caught: unknown;
  try {
    await client.discovery();
  } catch (e) {
    caught = e;
  }
  ok(caught instanceof IveoApiError && caught.code === 'bad_envelope', 'HTML-Antwort → bad_envelope');
  ok(
    caught instanceof IveoApiError && /api\/v1/.test(caught.message),
    'bad_envelope-Meldung nennt die api/v1-Ursache',
  );
}

// ── snapshotToShowSpeakers (Phase 3, Titler) ─────────────────────────────────
{
  const speakers = snapshotToShowSpeakers(snapshot);
  ok(speakers.length === 1 && speakers[0].name === 'Dr. Ana Ferreira', 'snapshotToShowSpeakers: Name');
  ok(speakers[0].title === 'Lead Negotiator', 'snapshotToShowSpeakers: Titel/Funktion');
  ok(!JSON.stringify(speakers).includes('GEHEIM-BIO'), 'snapshotToShowSpeakers: keine Bio (PII)');
}

// ── getEventSnapshot resilient (Best-Effort-Nebendaten + programsBestEffort) ──
// Fabrik: 500 auf allen Pfaden, die eines der `fail`-Segmente enthalten; sonst 200.
function snapshotFetch(fail: string[]): IveoFetchLike {
  return async (url) => {
    if (fail.some((f) => url.includes(f))) return mkRes(500, '');
    if (url.includes('/programs')) {
      return mkRes(200, { data: [prog({ id: 'p1', duration_minutes: 10 })], meta: { request_id: 'r', pagination: { next_cursor: null, limit: 200 } } });
    }
    if (url.includes('/speakers') || url.includes('/organisations')) {
      return mkRes(200, { data: [], meta: { request_id: 'r', pagination: { next_cursor: null, limit: 200 } } });
    }
    if (url.includes('/stages')) return mkRes(200, { data: [], meta: { request_id: 'r' } });
    return mkRes(200, { data: { id: 'e1', slug: 'cop30', name: 'COP30', starts_at: null, ends_at: null, timezone: null }, meta: { request_id: 'r' } });
  };
}
{
  // (a) 500 nur auf Nebendaten → Snapshot ok, leere Listen, onSubError meldet sie.
  const sub: string[] = [];
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl: snapshotFetch(['/speakers', '/stages']), sleepImpl: async () => {}, retryBaseMs: 1 });
  const snap = await client.getEventSnapshot('cop30', '2026-01-01T00:00:00Z', { onSubError: (r) => sub.push(r) });
  ok(snap.event.slug === 'cop30' && snap.programs.length === 1, 'Snapshot: Event+Programme geladen (Nebendaten-500)');
  ok(snap.speakers.length === 0 && snap.stages.length === 0, 'Snapshot: 500-Nebendaten → leere Listen');
  ok(sub.includes('speakers') && sub.includes('stages'), 'Snapshot: onSubError meldet speakers+stages');
}
{
  // (b) 500 auf /programs, Default (essenziell) → wirft mit Pfad in der Meldung.
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl: snapshotFetch(['/programs']), sleepImpl: async () => {}, retryBaseMs: 1 });
  let caught: unknown;
  try {
    await client.getEventSnapshot('cop30', 'now');
  } catch (e) {
    caught = e;
  }
  ok(caught instanceof IveoApiError && caught.status === 500, 'Snapshot: /programs-500 essenziell → wirft (Poller-Schutz)');
  ok(caught instanceof IveoApiError && /\/programs/.test(caught.message), 'Snapshot: Fehlermeldung nennt /programs');
}
{
  // (c) 500 auf /programs, programsBestEffort → Snapshot ok mit leerem Ablauf.
  const sub: string[] = [];
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl: snapshotFetch(['/programs']), sleepImpl: async () => {}, retryBaseMs: 1 });
  const snap = await client.getEventSnapshot('cop30', 'now', { programsBestEffort: true, onSubError: (r) => sub.push(r) });
  ok(snap.programs.length === 0 && sub.includes('programs'), 'Snapshot: programsBestEffort → /programs-500 wird übersprungen');
}

// ── @jm/show Round-Trip mit iveo-Bindung (Materialisierungs-/Poller-Pfad) ──────
{
  const ablauf = snapshotToAblauf(snapshot);
  // Ergänze ein Element mit den neuen Feldern (#11/Sub-B)
  ablauf[0] = {
    ...ablauf[0],
    plannedStartMs: 32400000, // 09:00 Uhr = 9 * 60 * 60 * 1000 ms seit Mitternacht
    owner: 'Dr. Ana Ferreira',
    category: 'Plenary',
  };
  const show = {
    ...createShow('Testshow'),
    ablauf,
    iveo: {
      event: 'cop30',
      baseUrl: 'https://staging-dev.my-iveo.de/api/v1',
      name: 'COP30',
      speakers: snapshotToShowSpeakers(snapshot),
      filter: { day: '2026-11-12', excludeBlockers: true },
    },
  };
  const text = serializeShow(show);
  const round = parseShow(text);
  ok(round.iveo?.event === 'cop30', '@jm/show: iveo-Bindung übersteht Round-Trip');
  ok(round.iveo?.baseUrl === 'https://staging-dev.my-iveo.de/api/v1', '@jm/show: iveo baseUrl erhalten');
  ok(round.ablauf?.length === 3, '@jm/show: materialisierter Ablauf übersteht Round-Trip');
  ok(round.iveo?.speakers?.length === 1 && round.iveo.speakers[0].name === 'Dr. Ana Ferreira', '@jm/show: iveo-Speaker übersteht Round-Trip');
  ok(
    round.iveo?.filter?.day === '2026-11-12' && round.iveo.filter.excludeBlockers === true,
    '@jm/show: Ablauf-Filter (Tag + ohne Blocker) übersteht Round-Trip',
  );
  ok(
    round.ablauf?.[0]?.plannedStartMs === 32400000 &&
      round.ablauf?.[0]?.owner === 'Dr. Ana Ferreira' &&
      round.ablauf?.[0]?.category === 'Plenary',
    '@jm/show: plannedStartMs/owner/category überstehen Round-Trip',
  );
  ok(!text.includes('iveo_live_'), '@jm/show: kein Token in der serialisierten Show');
  ok(!text.includes('GEHEIM-BIO'), '@jm/show: keine Bio (PII) in der serialisierten Show');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');
