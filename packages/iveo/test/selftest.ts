// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Kein Netz — der fetch wird injiziert (opts.fetchImpl). Deckt Mapping, Cursor-
// Pagination, Fehler-Envelope, Retry/Backoff und Datensparsamkeit/Token-Hygiene.

import {
  IveoClient,
  IveoApiError,
  IveoAssetAdresseError,
  assetAnfrage,
  IVEO_DEFAULT_BASE_URL,
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
  organisationenVon,
  buildShowMetadata,
  speakerName,
  localTimeOfDayMs,
  programToAblaufItem,
  type IveoFetchLike,
  type IveoFetchResponse,
  type IveoProgram,
  type IveoSnapshot,
  type IveoSpeaker,
} from '../src/index';
import {
  createShow, hatEigeneTimerListe, loeseDoppelteKennungenAuf, migrateShow, normalisiereOrganisationen, normalizeAblauf,
  parseShow, serializeShow, showFuerVerbund, VERBUND_EINSTELLUNGEN, type Show,
} from '@jm/show';
import { kennungenAus, kennungsBericht, kennungsForm, leseKennungsListe, vergleicheMengen, vergleicheMitCache } from '../tools/messung-2b-kern';

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
    {
      id: 'sp1', event_id: 'e1', salutation: 'Dr.', first_name: 'Ana', last_name: 'Ferreira', title: 'Lead Negotiator',
      bio: 'GEHEIM-BIO sollte nicht in Metadaten', photo: { url: 'https://x/api/v1/assets/photo1' },
      // iveo-Paket P2 (12.1 Nr. 5): Hauptorganisation an zweiter Stelle, eine Rolle, Leerraum im Namen.
      organisations: [
        { id: 'org-2', name: ' Ministério do  Meio Ambiente ', role_at_organisation: 'Vorsitz', is_primary: false },
        { id: 'org-1', name: 'UNFCCC', is_primary: true },
      ],
    },
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

// ── Asset-Anfrage: Token nur an die Herkunft der Basis-URL (iveo-Paket P4, E52, Spec 9.6; 12.1 Nr. 11) ──
{
  const BASIS = 'https://app.my-iveo.de/api/v1';
  const T77 = 'Datei-Adresse auf anderem Server ohne https';
  // Referenz in der auf Prod gemessenen Form (M1): base64url eines JSON-Arrays aus drei Texten (16, 114, 36 Zeichen),
  // ein Punkt, 32 Byte Signatur als base64url — 279 Zeichen. Zur Laufzeit gebaut, damit kein signaturartiger Text im
  // Quelltext steht.
  const REF =
    Buffer.from(JSON.stringify(['k'.repeat(16), 'w'.repeat(114), '3f2b8c1e-9a4d-4e2f-8b1a-0c6d5e4f3a21'])).toString('base64url') +
    '.' +
    Buffer.alloc(32, 7).toString('base64url');
  ok(REF.length === 279 && REF.split('.').length === 2, 'P4 12.1 Nr. 11: Prüf-Referenz in der gemessenen Form (279 Zeichen, ein Punkt)');
  type Soll = { url: string; mitToken: boolean } | 'abgelehnt';
  const FAELLE: ReadonlyArray<[string, string, Soll]> = [
    ['nackte Kennung', 'a1b2c3', { url: `${BASIS}/assets/a1b2c3`, mitToken: true }],
    ['assets/‹id›', 'assets/a1b2c3', { url: `${BASIS}/assets/a1b2c3`, mitToken: true }],
    ['Referenz in der gemessenen Form', REF, { url: `${BASIS}/assets/${REF}`, mitToken: true }],
    ['volle Adresse gleicher Herkunft', `${BASIS}/assets/a1b2c3`, { url: `${BASIS}/assets/a1b2c3`, mitToken: true }],
    ['fremder Host über https', 'https://fremd.example/x', { url: 'https://fremd.example/x', mitToken: false }],
    ['anderer Port', 'https://app.my-iveo.de:8443/x', { url: 'https://app.my-iveo.de:8443/x', mitToken: false }],
    ['fremder Host über http', 'http://fremd.example/x', 'abgelehnt'],
    ['eigener Host über http (anderes Schema)', 'http://app.my-iveo.de/x', 'abgelehnt'],
  ];
  const wohin = (soll: Soll): string => (soll === 'abgelehnt' ? 'kein Abruf (T77)' : soll.mitToken ? 'mit Token' : 'ohne Token');
  for (const [name, ref, soll] of FAELLE) {
    let ist: unknown;
    try {
      ist = assetAnfrage(ref, BASIS);
    } catch (e) {
      ist = e;
    }
    ok(
      soll === 'abgelehnt' ? ist instanceof IveoAssetAdresseError && ist.message === T77 : JSON.stringify(ist) === JSON.stringify(soll),
      `P4 12.1 Nr. 11 assetAnfrage: ${name} → ${wohin(soll)}`,
    );
  }
  const fehlerVon = (ref: string): unknown => {
    try {
      return assetAnfrage(ref, BASIS);
    } catch (e) {
      return e;
    }
  };
  const leer = fehlerVon('  ');
  const unlesbar = fehlerVon('https://');
  ok(
    leer instanceof Error && !(leer instanceof IveoAssetAdresseError) && leer.message === 'iveo: leere Asset-Referenz' &&
      unlesbar instanceof Error && !(unlesbar instanceof IveoAssetAdresseError) && unlesbar.message === 'iveo: ungültige Asset-Adresse',
    'P4 assetAnfrage: leere Referenz wie bisher, unlesbare Adresse → Fehler ohne Adresse (kein T77)',
  );

  // Dieselben Fälle über oeffneAsset und fetchAsset: Die Attrappe protokolliert Adresse und Authorization jedes Abrufs.
  const leererStrom = (): ReadableStream<Uint8Array> => new ReadableStream<Uint8Array>({ start: (c) => c.close() });
  const protokoll: Array<{ url: string; auth?: string }> = [];
  const fetchImpl: IveoFetchLike = async (url, init) => {
    protokoll.push({ url, auth: init?.headers?.['Authorization'] });
    return { ...mkRes(200, '', { 'content-type': 'application/pdf' }), body: leererStrom() };
  };
  const client = new IveoClient({ token: 'iveo_live_GEHEIM', baseUrl: BASIS, fetchImpl });
  const alle: Array<{ url: string; auth?: string }> = [];
  for (const weg of ['oeffneAsset', 'fetchAsset'] as const) {
    for (const [name, ref, soll] of FAELLE) {
      protokoll.length = 0;
      let fehler: unknown = null;
      try {
        if (weg === 'oeffneAsset') await client.oeffneAsset(ref);
        else await client.fetchAsset(ref);
      } catch (e) {
        fehler = e;
      }
      alle.push(...protokoll);
      const sollProtokoll = soll === 'abgelehnt' ? [] : [{ url: soll.url, auth: soll.mitToken ? 'Bearer iveo_live_GEHEIM' : undefined }];
      ok(
        JSON.stringify(protokoll) === JSON.stringify(sollProtokoll) &&
          (soll === 'abgelehnt' ? fehler instanceof IveoAssetAdresseError : fehler === null),
        `P4 12.1 Nr. 11 ${weg}: ${name} → ${wohin(soll)}`,
      );
    }
  }
  const mitToken = alle.filter((a) => (a.auth ?? '').includes('GEHEIM'));
  ok(
    alle.length === 12 && mitToken.length === 8 && mitToken.every((a) => new URL(a.url).host === 'app.my-iveo.de'),
    'P4 12.1 Nr. 11: iveo_live_GEHEIM steht nur in Anfragen an app.my-iveo.de',
  );

  // Basis http://127.0.0.1:‹Port› (wie die Tests des Launchers): dieselbe Herkunft mit Token, anderer Port über http nie.
  const LOKAL = 'http://127.0.0.1:47123/api/v1';
  const lokalProtokoll: Array<{ url: string; auth?: string }> = [];
  const lokal = new IveoClient({
    token: 'iveo_live_GEHEIM',
    baseUrl: LOKAL,
    fetchImpl: async (url, init) => {
      lokalProtokoll.push({ url, auth: init?.headers?.['Authorization'] });
      return { ...mkRes(200, ''), body: leererStrom() };
    },
  });
  await lokal.oeffneAsset('x1');
  await lokal.fetchAsset(`${LOKAL}/assets/x2`);
  let andererPort: unknown;
  try {
    await lokal.oeffneAsset('http://127.0.0.1:47124/x3');
  } catch (e) {
    andererPort = e;
  }
  ok(
    JSON.stringify(lokalProtokoll) ===
      JSON.stringify([
        { url: `${LOKAL}/assets/x1`, auth: 'Bearer iveo_live_GEHEIM' },
        { url: `${LOKAL}/assets/x2`, auth: 'Bearer iveo_live_GEHEIM' },
      ]) && andererPort instanceof IveoAssetAdresseError,
    'P4 12.1 Nr. 11: Basis http://127.0.0.1:‹Port› — gleiche Herkunft mit Token, anderer Port über http kein Abruf',
  );
}

// ── oeffneAsset: Datenstrom, Signal des Aufrufers, kein Retry nach Abbruch (iveo-Paket P4, E46, Spec 9.6; 12.1 Nr. 8) ──
{
  const BASIS = 'https://app.my-iveo.de/api/v1';
  const dreiBytes = (): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
      start: (c) => {
        c.enqueue(new Uint8Array([1, 2, 3]));
        c.close();
      },
    });
  const abbruch = (name: 'AbortError' | 'TimeoutError'): Error => Object.assign(new Error(name), { name });

  // Signal, Umleitung, Adresse wie fetchAsset, Datenstrom; die Attrappe setzt res.url auf eine signierte Adresse.
  {
    const gesehen: Array<{ url: string; redirect?: string; signal?: AbortSignal }> = [];
    const stroeme: Array<ReadableStream<Uint8Array>> = [];
    const fetchImpl: IveoFetchLike = async (url, init) => {
      gesehen.push({ url, redirect: init?.redirect, signal: init?.signal });
      const body = dreiBytes();
      stroeme.push(body);
      return {
        ...mkRes(200, '', { 'content-type': 'application/pdf', 'content-length': '3' }),
        url: 'https://signed.example/x?X-Amz-Signature=GEHEIM-SIG',
        body,
      };
    };
    const client = new IveoClient({ token: 'iveo_live_SECRET', baseUrl: BASIS, fetchImpl });
    const ctrl = new AbortController();
    const r = await client.oeffneAsset('assets/a1', { signal: ctrl.signal });
    await client.fetchAsset('assets/a1');
    ok(
      gesehen[0]?.signal === ctrl.signal && gesehen[0]?.redirect === 'follow',
      'P4 12.1 Nr. 8: oeffneAsset übergibt das Signal des Aufrufers und folgt der Umleitung (redirect: follow)',
    );
    ok(
      gesehen.length === 2 && gesehen[0].url === `${BASIS}/assets/a1` && gesehen[0].url === gesehen[1].url,
      'P4 12.1 Nr. 8: Anfrage-URL wie bei fetchAsset',
    );
    const leser = r.body.getReader();
    const gelesen: number[] = [];
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      gelesen.push(...value);
    }
    ok(
      r.body === stroeme[0] && JSON.stringify(gelesen) === '[1,2,3]' && r.contentType === 'application/pdf' && r.contentLength === 3,
      'P4 12.1 Nr. 8: oeffneAsset liefert den Datenstrom (body), Inhaltstyp und Länge',
    );
    ok(
      JSON.stringify(Object.keys(r)) === '["body","contentType","contentLength"]' &&
        Object.values(r).every((w) => !String(w).includes('GEHEIM')),
      'P4 12.1 Nr. 8: keine Weiterleitungsadresse im Ergebnis (kein Wert enthält GEHEIM)',
    );
  }
  // 404 → IveoApiError; Antwort ohne Datenstrom → Fehler; Länge, die keine Zahl ist, und fehlender Inhaltstyp → null.
  {
    let fehler404: unknown;
    try {
      await new IveoClient({ token: 'iveo_live_SECRET', baseUrl: BASIS, fetchImpl: async () => mkRes(404, '') }).oeffneAsset('a1');
    } catch (e) {
      fehler404 = e;
    }
    ok(fehler404 instanceof IveoApiError && fehler404.status === 404, 'P4 12.1 Nr. 8: oeffneAsset wirft IveoApiError bei 404');
    let ohneStrom: unknown;
    try {
      await new IveoClient({ token: 'iveo_live_SECRET', baseUrl: BASIS, fetchImpl: async () => mkRes(200, '') }).oeffneAsset('a1');
    } catch (e) {
      ohneStrom = e;
    }
    const ohneLaenge = await new IveoClient({
      token: 'iveo_live_SECRET',
      baseUrl: BASIS,
      fetchImpl: async () => ({ ...mkRes(200, '', { 'content-length': 'viel' }), body: dreiBytes() }),
    }).oeffneAsset('a1');
    ok(
      ohneStrom instanceof Error && ohneStrom.message === 'iveo: Asset ohne Datenstrom' &&
        ohneLaenge.contentLength === null && ohneLaenge.contentType === null,
      'P4 oeffneAsset: Antwort ohne Datenstrom → Fehler; Länge keine Zahl und Inhaltstyp fehlt → null',
    );
  }
  // Gesamtprüfung Befund 3 (Spec T22 (r)): die Meldung eines gescheiterten Asset-Abrufs nennt den HTTP-Status, sonst sehen ein
  // abgelaufener Link (403) und eine Drosselung (429) in Zeile, Log und Panel gleich aus; Status und Code bleiben am Fehler.
  {
    for (const status of [400, 403, 410, 429]) {
      const client = new IveoClient({ token: 'iveo_live_SECRET', baseUrl: BASIS, maxRetries: 0, fetchImpl: async () => mkRes(status, '') });
      const fehler: unknown[] = [];
      for (const weg of [() => client.oeffneAsset('a1'), () => client.fetchAsset('a1')]) {
        try {
          await weg();
        } catch (e) {
          fehler.push(e);
        }
      }
      ok(
        fehler.length === 2 &&
          fehler.every((e) => e instanceof IveoApiError && e.status === status && e.code === `http_${status}` && e.message === `iveo: Asset nicht abrufbar (HTTP ${status})`),
        `Gesamt-Fix T22 (r): oeffneAsset und fetchAsset mit HTTP ${status} → „iveo: Asset nicht abrufbar (HTTP ${status})“, Status und Code am Fehler`,
      );
    }
  }
  // Abbruch durch den Aufrufer: genau ein Aufruf, keine Wartezeit, der Abbruch kommt unverändert heraus.
  {
    const ctrl = new AbortController();
    let aufrufe = 0;
    const pausen: number[] = [];
    const client = new IveoClient({
      token: 'iveo_live_SECRET',
      baseUrl: BASIS,
      maxRetries: 3,
      sleepImpl: async (ms) => void pausen.push(ms),
      fetchImpl: async () => {
        aufrufe++;
        ctrl.abort();
        throw abbruch('AbortError');
      },
    });
    let fehler: unknown;
    try {
      await client.oeffneAsset('a1', { signal: ctrl.signal });
    } catch (e) {
      fehler = e;
    }
    ok(
      aufrufe === 1 && pausen.length === 0 && fehler instanceof Error && fehler.name === 'AbortError',
      'P4 12.1 Nr. 8: Signal des Aufrufers abgebrochen und fetchImpl wirft → genau ein Aufruf, keine Wartezeit',
    );
  }
  // TimeoutError ohne Signal des Aufrufers (wie aus mitZeitgrenze) → wie bisher wiederholt: 1 + maxRetries Aufrufe.
  {
    let aufrufe = 0;
    const pausen: number[] = [];
    const client = new IveoClient({
      token: 'iveo_live_SECRET',
      baseUrl: BASIS,
      maxRetries: 2,
      sleepImpl: async (ms) => void pausen.push(ms),
      fetchImpl: async () => {
        aufrufe++;
        throw abbruch('TimeoutError');
      },
    });
    let fehler: unknown;
    try {
      await client.oeffneAsset('a1');
    } catch (e) {
      fehler = e;
    }
    ok(
      aufrufe === 3 && pausen.length === 2 && fehler instanceof Error && fehler.name === 'TimeoutError',
      'P4 12.1 Nr. 8: TimeoutError ohne Signal des Aufrufers → 1 + maxRetries Aufrufe (wie bisher)',
    );
  }
  // Signal des Aufrufers gesetzt, aber nicht abgebrochen: ein Wurf wird weiter wiederholt.
  {
    const ctrl = new AbortController();
    let aufrufe = 0;
    const client = new IveoClient({
      token: 'iveo_live_SECRET',
      baseUrl: BASIS,
      maxRetries: 2,
      sleepImpl: async () => {},
      fetchImpl: async () => {
        aufrufe++;
        if (aufrufe < 3) throw abbruch('TimeoutError');
        return { ...mkRes(200, ''), body: dreiBytes() };
      },
    });
    const r = await client.oeffneAsset('a1', { signal: ctrl.signal });
    ok(aufrufe === 3 && r.body instanceof ReadableStream, 'P4 12.1 Nr. 8: Signal des Aufrufers nicht abgebrochen → ein Wurf wird wiederholt');
  }
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
// iveo-Paket P3 (Spec 7.1, 12.8): Der Standard ist Production; die Schema-Ergänzung darunter bleibt mit Staging-Host als Eingabe.
ok(normalizeIveoBaseUrl('') === 'https://app.my-iveo.de/api/v1', 'baseUrl: leer → Default');
ok(normalizeIveoBaseUrl('  ') === 'https://app.my-iveo.de/api/v1', 'baseUrl: nur Whitespace → Default');
ok(
  IVEO_DEFAULT_BASE_URL === 'https://app.my-iveo.de/api/v1' && normalizeIveoBaseUrl('') === IVEO_DEFAULT_BASE_URL,
  'P3 12.1 Nr. 7: IVEO_DEFAULT_BASE_URL und normalizeIveoBaseUrl(leer) = Production',
);
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
{
  // T8 (iveo-Paket, Spec 11.6) wörtlich: typografische Anführungszeichen um die Eingabe, Beispiel Production.
  let meldung = '';
  try {
    normalizeIveoBaseUrl('http://');
  } catch (e) {
    meldung = e instanceof Error ? e.message : String(e);
  }
  ok(
    meldung === 'Ungültige iveo-Basis-URL: „http://“. Beispiel: https://app.my-iveo.de/api/v1',
    'P3 T8: Fehlertext bei ungültiger Adresse wörtlich (typografische Anführungszeichen, Beispiel Production)',
  );
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

// ── snapshotToShowSpeakers (Phase 3, Titler; Teil 2b: ohne Kennung, Spec 23 M1 = nein) ──────────
{
  const speakers = snapshotToShowSpeakers(snapshot);
  ok(speakers.length === 1 && speakers[0].name === 'Dr. Ana Ferreira', 'snapshotToShowSpeakers: Name');
  ok(speakers[0].title === 'Lead Negotiator', 'snapshotToShowSpeakers: Titel/Funktion');
  ok(!JSON.stringify(speakers).includes('GEHEIM-BIO'), 'snapshotToShowSpeakers: keine Bio (PII)');
  ok(speakers.every((s) => !('id' in s)), 'speakersToShowSpeakers ohne Kennung (Spec 23: M1 = nein)');
  const rund = parseShow(serializeShow({ ...createShow('Speaker'), iveo: { event: 'cop30', speakers } }));
  ok(JSON.stringify(rund.iveo?.speakers) === JSON.stringify(speakers), 'speakersToShowSpeakers: Ausgabe ist ein Fixpunkt des Normalisierers');
}

// ── organisationenVon und Organisationen am Show-Speaker (iveo-Paket P2, Spec 5.1, 5.2, E3, E7; 12.1 Nr. 1, 5, 6) ──
{
  const mitOrganisationen = (organisations: unknown): IveoSpeaker =>
    ({ id: 'sp-o', event_id: 'e1', first_name: 'Ada', last_name: 'Lovelace', organisations }) as IveoSpeaker;
  // 12.1 Nr. 1: jede Zeile der Tabelle 5.2 — Ergebnis von organisationenVon und der Show-Speaker aus dem Mapper.
  const TABELLE: ReadonlyArray<[string, unknown, string[]]> = [
    ['fehlt', undefined, []],
    ['null', null, []],
    ['kein Array', { name: 'UNFCCC' }, []],
    ['[]', [], []],
    ['eine Hauptorganisation', [{ name: 'UNFCCC', is_primary: true }], ['UNFCCC']],
    ['Haupt an zweiter Stelle', [{ name: 'A', is_primary: false }, { name: 'B', is_primary: true }], ['B', 'A']],
    ['ohne is_primary', [{ name: 'A' }, { name: 'B' }], ['A', 'B']],
    ['zwei mit is_primary', [{ name: 'A', is_primary: true }, { name: 'B', is_primary: true }], ['A', 'B']],
    ['Haupt kommt noch einmal vor', [{ name: 'B', is_primary: true }, { name: 'A' }, { name: 'B' }], ['B', 'A']],
    ['Leerraum, danach doppelt', [{ name: '  A  ' }, { name: 'A' }], ['A']],
    ['Tab und Zeilenumbruch', [{ name: 'A\tB\nC' }], ['A B C']],
    ['Groß- und Kleinschreibung zählt', [{ name: 'a' }, { name: 'A' }], ['a', 'A']],
    ['nur ungültige Einträge', [{ name: '' }, { name: '  ' }, { name: null }, 'x', null], []],
    ['Kennung und Rolle entfallen', [{ id: 'o1', name: 'A', role_at_organisation: 'Chair', is_primary: true }], ['A']],
    // Über die Tabelle hinaus (5.2 Schritte 2 und 3): Ein ungültiger Eintrag ist nie die Hauptorganisation.
    ['Haupt mit leerem Namen zählt nicht', [{ name: '  ', is_primary: true }, { name: 'B' }, { name: 'A', is_primary: true }], ['A', 'B']],
  ];
  for (const [name, organisations, soll] of TABELLE) {
    const s = mitOrganisationen(organisations);
    const sollShow = soll.length ? { name: 'Ada Lovelace', organisationen: soll } : { name: 'Ada Lovelace' };
    ok(
      JSON.stringify(organisationenVon(s)) === JSON.stringify(soll) &&
        JSON.stringify(speakersToShowSpeakers([s])[0]) === JSON.stringify(sollShow),
      `P2 12.1 Nr. 1 Tabelle 5.2: ${name} → ${soll.length ? JSON.stringify(soll) : 'Feld fehlt'}`,
    );
  }
  // 12.1 Nr. 6: Fixpunkt — die Mapper-Ausgabe aller Tabellenzeilen läuft unverändert durch den Normalisierer.
  const alle = speakersToShowSpeakers(TABELLE.map(([, organisations]) => mitOrganisationen(organisations)));
  ok(
    JSON.stringify(migrateShow({ ...createShow('Fixpunkt'), iveo: { event: 'cop31', speakers: alle } }).iveo?.speakers) === JSON.stringify(alle),
    'P2 12.1 Nr. 6: Mapper-Ausgabe aller Tabellenzeilen = Ausgabe nach migrateShow (Fixpunkt)',
  );

  // 12.1 Nr. 5: Fixture mit Hauptorganisation an zweiter Stelle und einer Rolle → nur Namen, Haupt vorn.
  const speakers = snapshotToShowSpeakers(snapshot);
  const json = JSON.stringify(speakers);
  ok(
    JSON.stringify(speakers[0]) ===
      '{"name":"Dr. Ana Ferreira","title":"Lead Negotiator","organisationen":["UNFCCC","Ministério do Meio Ambiente"]}',
    'P2 12.1 Nr. 5: speakersToShowSpeakers setzt organisationen (Haupt vorn, Leerraum nach der gemeinsamen Regel)',
  );
  ok(
    !json.includes('org-1') && !json.includes('org-2') && !json.includes('Vorsitz') && !json.includes('is_primary') && !json.includes('GEHEIM-BIO'),
    'P2 12.1 Nr. 5: ohne Kennung, Rolle und Bio',
  );
  ok(
    JSON.stringify(migrateShow({ ...createShow('Fixpunkt'), iveo: { event: 'cop31', speakers } }).iveo?.speakers) === json,
    'P2 12.1 Nr. 6: Fixture-Speaker mit Organisationen = Ausgabe nach migrateShow (Fixpunkt)',
  );

  // E7: Die Cache-Metadaten bleiben ohne Organisationen.
  const m = buildShowMetadata(snapshot, 'https://app.my-iveo.de/api/v1');
  ok(
    JSON.stringify(Object.keys(m.speakers[0])) === '["id","name","title"]' &&
      !JSON.stringify(m).includes('Meio Ambiente') && !JSON.stringify(m).includes('UNFCCC'),
    'P2 E7: buildShowMetadata bleibt ohne Organisationen',
  );
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

// ── @jm/show: Kennung am Ablaufpunkt, normalizeAblauf, hatEigeneTimerListe (Teil 2a) ──
{
  // Kennung wird übernommen, getrimmt und steht vorn (stabile Serialisierung).
  const a = normalizeAblauf([{ label: 'Begrüßung', id: '  ag-1  ', durationMs: 600_000 }]);
  ok(
    JSON.stringify(a) === '[{"id":"ag-1","label":"Begrüßung","durationMs":600000}]',
    '@jm/show: id übernommen, getrimmt, als erstes Feld',
  );

  // Ungültige Kennungen fallen weg, der Punkt selbst bleibt.
  const ungueltig = normalizeAblauf([
    { id: 42, label: 'Zahl' },
    { id: '', label: 'Leer' },
    { id: '   ', label: 'Nur Leerzeichen' },
    { id: 'k'.repeat(201), label: 'Zu lang' },
    { id: null, label: 'Null' },
  ]);
  ok(ungueltig.length === 5 && ungueltig.every((p) => !('id' in p)), '@jm/show: ungültige id entfällt, Punkt bleibt');
  ok(normalizeAblauf([{ id: 'k'.repeat(200), label: 'Grenze' }])[0].id === 'k'.repeat(200), '@jm/show: id mit 200 Zeichen bleibt');

  // Doppelte Kennungen: die erste behält ihre, jede weitere bekommt #2, #3 …
  const doppelt = normalizeAblauf([
    { id: 'X', label: 'a' },
    { id: 'X', label: 'b' },
    { id: 'X', label: 'c' },
  ]);
  ok(JSON.stringify(doppelt.map((p) => p.id)) === '["X","X#2","X#3"]', '@jm/show: doppelte id → #2, #3');
  // … und überspringt Nummern, die in der Liste schon vergeben sind.
  const belegt = normalizeAblauf([
    { id: 'X', label: 'a' },
    { id: 'X', label: 'b' },
    { id: 'X#2', label: 'c' },
  ]);
  ok(JSON.stringify(belegt.map((p) => p.id)) === '["X","X#3","X#2"]', '@jm/show: belegte #2 → nächste freie Nummer');
  ok(JSON.stringify(normalizeAblauf(belegt)) === JSON.stringify(belegt), '@jm/show: normalizeAblauf ist idempotent');
  // Lange Kennung: Der Zusatz bleibt in 200 Zeichen, sonst verwürfe das nächste Lesen die id.
  const grenze = normalizeAblauf([
    { id: 'k'.repeat(200), label: 'a' },
    { id: 'k'.repeat(200), label: 'b' },
  ]);
  ok(grenze[1].id === 'k'.repeat(198) + '#2', '@jm/show: Zusatz #2 kürzt eine 200-Zeichen-id');
  ok(JSON.stringify(normalizeAblauf(grenze)) === JSON.stringify(grenze), '@jm/show: gekürzte id übersteht erneutes Normalisieren');

  // Wie bisher: ohne Titel fällt der Punkt weg, ohne id bekommt er keine, kein Array → [].
  const gemischt = normalizeAblauf([{ id: 'p1', label: '  ' }, null, 'x', { label: 'Ohne id' }]);
  ok(JSON.stringify(gemischt) === '[{"label":"Ohne id"}]', '@jm/show: ohne Titel weg, ohne id bleibt ohne id');
  ok(
    normalizeAblauf(undefined).length === 0 && normalizeAblauf({ ablauf: [] }).length === 0 && normalizeAblauf('x').length === 0,
    '@jm/show: kein Array → leere Liste',
  );

  // parseShow/serializeShow laufen über migrateShow → normalizeAblauf.
  const gelesen = parseShow(
    JSON.stringify({ schemaVersion: 1, name: 'Doppelt', tools: [], ablauf: [{ id: 'u1', label: 'A' }, { id: 'u1', label: 'B' }] }),
  );
  ok(JSON.stringify(gelesen.ablauf?.map((p) => p.id)) === '["u1","u1#2"]', '@jm/show: doppelte id beim Lesen aufgelöst');
  const altText = serializeShow({ ...createShow('Alt'), ablauf: [{ label: 'A', durationMs: 60_000 }] });
  ok(!altText.includes('"id"'), '@jm/show: alte Show ohne Kennungen bleibt ohne id (byte-nah)');

  // hatEigeneTimerListe: genau dann, wenn settings.timetable ein Array mit mindestens einem Objekt ist.
  ok(hatEigeneTimerListe(undefined) === false, 'hatEigeneTimerListe: keine Einstellungen → nein');
  ok(hatEigeneTimerListe({}) === false, 'hatEigeneTimerListe: ohne timetable → nein');
  ok(hatEigeneTimerListe({ timetable: [] }) === false, 'hatEigeneTimerListe: leeres Array → nein');
  ok(hatEigeneTimerListe({ timetable: [null, 3, 'x'] }) === false, 'hatEigeneTimerListe: nur Nicht-Objekte → nein');
  ok(hatEigeneTimerListe({ timetable: 'x' }) === false, 'hatEigeneTimerListe: kein Array → nein');
  ok(hatEigeneTimerListe({ timetable: [{ label: 'A', durationMs: 60_000 }] }) === true, 'hatEigeneTimerListe: Array mit einem Objekt → ja');
  ok(hatEigeneTimerListe({ timetable: [null, {}] }) === true, 'hatEigeneTimerListe: ein Objekt genügt, auch ein leeres');
}

// ── Kennungs-Durchlauf (Teil 2a, Spec 3.2/9.3): iveo-Antwort → Umwandler → Show → Lesen ──
{
  // Nachgebaute iveo-Antworten: Agenda eines Side Events (absichtlich unsortiert) und Programmliste.
  const agendaAntwort = [
    { id: 'ag-2', program_id: 'se1', sort_order: 1, title: 'Panel', duration_minutes: 45, notes: 'Bühne' },
    { id: 'ag-1', program_id: 'se1', sort_order: 0, title: 'Begrüßung', duration_minutes: 10 },
    { id: 'ag-3', program_id: 'se1', sort_order: 2, title: 'Q&A' },
  ];
  const programmAntwort = [
    prog({ id: 'p-b', title: 'Zweitens', starts_at: '2026-11-12T12:00:00+00:00', duration_minutes: 30 }),
    prog({ id: 'p-a', title: 'Erstens', starts_at: '2026-11-12T09:00:00+00:00', duration_minutes: 60 }),
  ];
  const seite = (data: unknown) => mkRes(200, { data, meta: { request_id: 'r', pagination: { next_cursor: null, limit: 200 } } });
  const fetchImpl: IveoFetchLike = async (url) => (url.includes('/agenda-items') ? seite(agendaAntwort) : seite(programmAntwort));
  const client = new IveoClient({ token: 'iveo_live_SECRET', fetchImpl });

  // Agenda-Modus: Kennung = iveo-Agenda-Punkt-ID, als erstes Feld.
  const agenda = agendaToAblauf(await client.listAgendaItems('cop30', 'se1'));
  ok(JSON.stringify(agenda.map((a) => a.id)) === '["ag-1","ag-2","ag-3"]', 'Kennungen: agendaToAblauf setzt die Agenda-Punkt-ID');
  ok(agenda.every((a) => Object.keys(a)[0] === 'id'), 'Kennungen: id steht im Agenda-Punkt vorn');

  // Listen-Modus: Kennung = iveo-Programm-ID, auch nach dem Sortieren nach Startzeit.
  const liste = programsToAblauf(await client.listPrograms('cop30'));
  ok(JSON.stringify(liste.map((a) => a.id)) === '["p-a","p-b"]', 'Kennungen: programsToAblauf setzt die Programm-ID');
  ok(liste.every((a) => Object.keys(a)[0] === 'id'), 'Kennungen: id steht im Programm-Punkt vorn');
  ok(snapshotToAblauf(snapshot).map((a) => a.id).join(',') === 'p1,p2,p3', 'Kennungen: snapshotToAblauf trägt die Programm-IDs');

  // Side Event ohne Agenda → 1 Punkt mit der Programm-ID (wie Binden/Abfrage/Umschalten ihn bauen).
  const einzeln = programToAblaufItem(prog({ id: 'se1', title: 'Side Event' }), { withSchedule: true });
  ok(einzeln.id === 'se1' && einzeln.label === 'Side Event', 'Kennungen: 1-Punkt-Ablauf trägt die Programm-ID');
  // Fremddaten ohne brauchbare ID → Punkt ohne id statt leerer Kennung.
  ok(!('id' in programToAblaufItem(prog({ id: '   ' }))), 'Kennungen: Programm mit leerer ID → kein id-Feld');
  ok(
    !('id' in agendaToAblauf([{ id: '', program_id: 'se1', title: 'Ohne ID' }])[0]),
    'Kennungen: Agenda-Punkt mit leerer ID → kein id-Feld',
  );

  // Umwandler-Ausgabe ist ein Fixpunkt von normalizeAblauf (Signatur im Launcher, Spec 7.2).
  ok(JSON.stringify(normalizeAblauf(agenda)) === JSON.stringify(agenda), 'Kennungen: normalizeAblauf lässt die Agenda unverändert');

  // Show schreiben und lesen: Kennungen und Feldreihenfolge überstehen den Round-Trip.
  const show = {
    ...createShow('Kennungen'),
    ablauf: normalizeAblauf(agenda),
    iveo: { event: 'cop30', filter: { programId: 'se1' } },
  };
  const gelesen = parseShow(serializeShow(show));
  ok(
    JSON.stringify(gelesen.ablauf?.map((a) => a.id)) === '["ag-1","ag-2","ag-3"]' &&
      JSON.stringify(gelesen.ablauf) === JSON.stringify(agenda),
    'Kennungs-Durchlauf: iveo-IDs überstehen Schreiben und Lesen',
  );

  // Doppelte Kennung aus iveo (darf nicht vorkommen, wird trotzdem aufgefangen) → #2.
  const doppelt = agendaToAblauf([
    { id: 'ag-x', program_id: 'se1', sort_order: 0, title: 'A' },
    { id: 'ag-x', program_id: 'se1', sort_order: 1, title: 'B' },
  ]);
  ok(
    JSON.stringify(normalizeAblauf(doppelt).map((a) => a.id)) === '["ag-x","ag-x#2"]',
    'Kennungs-Durchlauf: doppelte iveo-ID → normalizeAblauf vergibt #2',
  );
  // Von Hand verdoppelte Kennung in der Datei → beim Lesen aufgelöst.
  const roh = JSON.stringify({ schemaVersion: 1, name: 'Kopie', tools: [], ablauf: [...agenda, { ...agenda[0], label: 'Begrüßung (Kopie)' }] });
  ok(
    JSON.stringify(parseShow(roh).ablauf?.map((a) => a.id)) === '["ag-1","ag-2","ag-3","ag-1#2"]',
    'Kennungs-Durchlauf: doppelte id in der Datei → beim Lesen #2',
  );
}

// ── Messung M1/M3 (Teil 2b, Spec 23): Form, Leerraum, Doppelte, Hashes, Abgleich mit dem Launcher-Cache, zwei Abrufe ──
{
  ok(kennungsForm('3f2b8c1e-9a4d-4e2f-8b1a-0c6d5e4f3a21') === 'uuid', 'Messung: UUID erkannt');
  ok(kennungsForm('3F2B8C1E-9A4D-4E2F-8B1A-0C6D5E4F3A21') === 'uuid', 'Messung: UUID auch in Großbuchstaben');
  ok(kennungsForm('17') === 'ziffern', 'Messung: nur Ziffern');
  ok(kennungsForm('ab c') === 'andere', 'Messung: alles andere');
  ok(kennungsForm(' 17') === 'andere', 'Messung: Ziffern mit Leerraum zählen als andere');

  const b = kennungsBericht(['b', 'a', 'a', ' c']);
  ok(b.anzahl === 4 && b.doppelte === 1 && b.mitLeerraum === 1, 'Messung: Anzahl, Doppelte und Leerraum gezählt');
  ok(JSON.stringify(b.formen) === '{"uuid":0,"ziffern":0,"andere":4}', 'Messung: Formen gezählt');

  const ab = kennungsBericht(['a', 'b']);
  const ba = kennungsBericht(['b', 'a']);
  ok(ab.mengenHash === ba.mengenHash, 'Messung: mengenHash hängt nicht an der Reihenfolge');
  ok(ab.reihenfolgeHash !== ba.reihenfolgeHash, 'Messung: reihenfolgeHash hängt an der Reihenfolge');
  ok(
    ab.mengenHash === '7e18f737311b2dc3' && ba.reihenfolgeHash === 'c4a78e5bdf318c85',
    'Messung: Hash = erste 16 Hex-Zeichen von SHA-256 über die mit \\n verbundenen Kennungen',
  );
  ok(kennungsBericht(['a', 'c']).mengenHash !== ab.mengenHash, 'Messung: andere Menge → anderer mengenHash');

  ok(
    JSON.stringify(vergleicheMitCache(['a', 'b'], ['b', 'a'])) === '{"nurApi":0,"nurCache":0,"gleich":true}',
    'Messung: API und Cache gleich',
  );
  ok(
    JSON.stringify(vergleicheMitCache(['a', 'b', 'c'], ['a', 'b'])) === '{"nurApi":1,"nurCache":0,"gleich":false}',
    'Messung: eine Kennung nur in der API → nurApi 1',
  );
  ok(
    JSON.stringify(vergleicheMitCache(['a'], ['a', 'x'])) === '{"nurApi":0,"nurCache":1,"gleich":false}',
    'Messung: eine Kennung nur im Cache → nurCache 1',
  );

  // Zwei Abrufe im Abstand von 10 min (M1 a): ein neuer Speaker ist etwas anderes als eine gewechselte Kennung.
  ok(
    JSON.stringify(vergleicheMengen(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])) === '{"nurErste":1,"nurZweite":2,"gleich":false}',
    'Messung: Mengenvergleich zählt, was nur im ersten und was nur im zweiten Abruf steht',
  );
  ok(
    JSON.stringify(vergleicheMengen(['b', 'a'], ['a', 'b'])) === '{"nurErste":0,"nurZweite":0,"gleich":true}',
    'Messung: gleiche Menge in anderer Reihenfolge → gleich',
  );
  ok(JSON.stringify(leseKennungsListe('["s-1","s 2"]')) === '["s-1","s 2"]', 'Messung: gespeicherte Kennungsliste wird gelesen');
  ok(
    leseKennungsListe('kaputt') === null && leseKennungsListe('{"a":1}') === null && leseKennungsListe('[1,2]') === null,
    'Messung: kein JSON, kein Array oder keine Texte → null',
  );
  ok(kennungsBericht(['a', null, 'b', null]).ohneKennung === 2, 'Messung: ohne Kennung gezählt');
  ok(kennungsBericht(['a', null, 'b', null]).doppelte === 0, 'Messung: zwei ohne Kennung sind keine Doppelten');
  ok(kennungsBericht(['a', null, 'b', null]).anzahl === 4, 'Messung: Anzahl zählt Speaker ohne Kennung mit');
  ok(kennungsBericht(['a', null, 'b', null]).formen.andere === 2, 'Messung: Formen nur über echte Kennungen');
  ok(
    kennungsBericht(['a', 'a', null]).doppelte === 1 && kennungsBericht(['a', 'a', null]).ohneKennung === 1,
    'Messung: Doppelte und ohne Kennung getrennt',
  );
  ok(
    kennungsBericht(['a', null, 'b']).mengenHash === kennungsBericht(['b', 'a']).mengenHash,
    'Messung: mengenHash ohne die Speaker ohne Kennung',
  );
  ok(
    kennungsBericht([]).anzahl === 0 &&
      kennungsBericht([]).doppelte === 0 &&
      kennungsBericht([]).ohneKennung === 0 &&
      /^[0-9a-f]{16}$/.test(kennungsBericht([]).mengenHash),
    'Messung: leere Liste',
  );
  ok(vergleicheMengen(['a', 'a'], ['a']).gleich, 'Messung: doppelte Kennung ändert die Menge nicht');
  ok(vergleicheMengen([], []).gleich, 'Messung: zwei leere Listen sind gleich');
  ok(
    JSON.stringify(kennungenAus([{ id: 'x' }, { id: '' }, {}, null, { id: 7 }])) === JSON.stringify(['x', null, null, null, null]),
    'Messung: kennungenAus macht fehlende, leere und Nicht-Text-Kennungen zu null',
  );
}

// ── @jm/show: Speaker-Kennung, loeseDoppelteKennungenAuf, Merker speakerVeraltetSeit (Teil 2b, Spec 5.1, 6.2, 9.1) ──
{
  /** iveo-Bindung so, wie parseShow sie aus einer Datei liest. */
  const binde = (iveo: Record<string, unknown>) =>
    parseShow(JSON.stringify({ schemaVersion: 1, name: 'S', tools: [], iveo: { event: 'cop31', ...iveo } })).iveo;

  // 9.1 Nr. 1: Kennung getrimmt, als erstes Feld; 200 Zeichen bleiben; 201, Nicht-Strings und Leeres entfallen.
  ok(
    JSON.stringify(binde({ speakers: [{ name: 'Ada', id: '  sp-1  ' }] })?.speakers?.[0]) === '{"id":"sp-1","name":"Ada"}',
    '@jm/show: Speaker-Kennung getrimmt, als erstes Feld',
  );
  ok(
    JSON.stringify(binde({ speakers: [{ title: 'Admiral', name: 'Grace', id: 'sp-2' }] })?.speakers) ===
      '[{"id":"sp-2","name":"Grace","title":"Admiral"}]',
    '@jm/show: Feldreihenfolge des Speakers id, name, title',
  );
  ok(
    binde({ speakers: [{ id: 'k'.repeat(200), name: 'Grenze' }] })?.speakers?.[0].id === 'k'.repeat(200),
    '@jm/show: Speaker-Kennung mit 200 Zeichen bleibt',
  );
  const ungueltig =
    binde({
      speakers: [
        { id: 'k'.repeat(201), name: 'Zu lang' },
        { id: 42, name: 'Zahl' },
        { id: '   ', name: 'Leer' },
        { id: null, name: 'Null' },
      ],
    })?.speakers ?? [];
  ok(
    ungueltig.length === 4 && ungueltig.every((s) => !('id' in s)),
    '@jm/show: ungültige Speaker-Kennung entfällt, der Speaker bleibt',
  );

  // 9.1 Nr. 2: Doppelte → #2, #3; schon belegte Nummern werden übersprungen; der Zusatz bleibt in 200 Zeichen.
  const dreimal = binde({ speakers: [{ id: 'X', name: 'a' }, { id: 'X', name: 'b' }, { id: 'X', name: 'c' }] })?.speakers ?? [];
  ok(JSON.stringify(dreimal.map((s) => s.id)) === '["X","X#2","X#3"]', '@jm/show: doppelte Speaker-Kennung → #2, #3');
  const belegt = binde({ speakers: [{ id: 'X', name: 'a' }, { id: 'X', name: 'b' }, { id: 'X#2', name: 'c' }] })?.speakers ?? [];
  ok(JSON.stringify(belegt.map((s) => s.id)) === '["X","X#3","X#2"]', '@jm/show: belegte #2 → nächste freie Nummer (Speaker)');
  const lang = binde({ speakers: [{ id: 'k'.repeat(200), name: 'a' }, { id: 'k'.repeat(200), name: 'b' }] })?.speakers ?? [];
  ok(lang[1]?.id === 'k'.repeat(198) + '#2', '@jm/show: Zusatz #2 kürzt eine 200-Zeichen-Kennung (Speaker)');

  // Die gemeinsame Regel direkt: gleiche Ergebnisse, Eingabe unverändert, neue Objekte nur für umbenannte.
  const eingabe = [{ id: 'X', name: 'a' }, { name: 'ohne' }, { id: 'X', name: 'b' }, { id: 'X#2', name: 'c' }];
  const vorherText = JSON.stringify(eingabe);
  const aufgeloest = loeseDoppelteKennungenAuf(eingabe);
  ok(
    JSON.stringify(aufgeloest.map((s) => s.id ?? '-')) === '["X","-","X#3","X#2"]',
    'loeseDoppelteKennungenAuf: X, X, X#2 → X, X#3, X#2; ohne id bleibt ohne',
  );
  ok(JSON.stringify(eingabe) === vorherText && aufgeloest !== eingabe, 'loeseDoppelteKennungenAuf: verändert die Eingabe nicht');
  ok(
    aufgeloest[0] === eingabe[0] && aufgeloest[1] === eingabe[1] && aufgeloest[2] !== eingabe[2] && aufgeloest[3] === eingabe[3],
    'loeseDoppelteKennungenAuf: neue Objekte nur für umbenannte',
  );
  ok(loeseDoppelteKennungenAuf([]).length === 0, 'loeseDoppelteKennungenAuf: leere Liste → leere Liste');

  // 9.1 Nr. 3: serializeShow → parseShow behält die Kennung; ein Speaker ohne Kennung bleibt ohne.
  const rund = parseShow(
    serializeShow({
      ...createShow('Speaker'),
      iveo: { event: 'cop31', speakers: [{ id: 'sp-1', name: 'Ada', title: 'Moderation' }, { name: 'Ohne Kennung' }] },
    }),
  );
  ok(
    JSON.stringify(rund.iveo?.speakers) === '[{"id":"sp-1","name":"Ada","title":"Moderation"},{"name":"Ohne Kennung"}]',
    '@jm/show: Speaker-Kennung übersteht serializeShow → parseShow',
  );
  // 12.8 zweiter Fall (iveo-Paket P2): die Mapper-Ausgabe mit Organisationen übersteht serializeShow → parseShow exakt.
  const ausIveo = speakersToShowSpeakers([
    {
      id: 'sp-9', event_id: 'e1', first_name: 'Ada', last_name: 'Lovelace', title: 'Moderation',
      organisations: [{ id: 'org-2', name: 'GIZ', is_primary: false }, { id: 'org-1', name: 'UNFCCC', role_at_organisation: 'Vorsitz', is_primary: true }],
    },
    { id: 'sp-10', event_id: 'e1', first_name: 'Ohne', last_name: 'Organisation', organisations: [] },
  ]);
  const rundOrg = parseShow(serializeShow({ ...createShow('Speaker'), iveo: { event: 'cop31', speakers: ausIveo } }));
  ok(
    JSON.stringify(rundOrg.iveo?.speakers) ===
      '[{"name":"Ada Lovelace","title":"Moderation","organisationen":["UNFCCC","GIZ"]},{"name":"Ohne Organisation"}]',
    'P2 12.8 zweiter Fall: Mapper-Ausgabe mit Organisationen übersteht serializeShow → parseShow (exaktes JSON)',
  );

  // 9.1 Nr. 6: Merker speakerVeraltetSeit — lesbare Zeit bleibt, Unlesbares entfällt, Rundreise und Platz nach speakers.
  const MERKER = '2026-10-02T08:00:00.000Z';
  ok(binde({ speakerVeraltetSeit: MERKER })?.speakerVeraltetSeit === MERKER, '@jm/show: lesbarer Merker bleibt');
  ok(!('speakerVeraltetSeit' in (binde({ speakerVeraltetSeit: 'gestern' }) ?? {})), '@jm/show: unlesbarer Merker entfällt');
  ok(!('speakerVeraltetSeit' in (binde({ speakerVeraltetSeit: 42 }) ?? {})), '@jm/show: Merker als Zahl entfällt');
  const mitMerker = parseShow(
    serializeShow({
      ...createShow('Merker'),
      iveo: {
        event: 'cop31',
        name: 'COP31',
        speakers: [{ id: 'sp-1', name: 'Ada' }],
        speakerVeraltetSeit: MERKER,
        sideEvents: [{ id: 'p1', title: 'A' }],
        filter: { day: '2026-11-10' },
      },
    }),
  );
  ok(mitMerker.iveo?.speakerVeraltetSeit === MERKER, '@jm/show: Merker übersteht serializeShow → parseShow');
  ok(
    JSON.stringify(Object.keys(mitMerker.iveo ?? {})) === '["event","name","speakers","speakerVeraltetSeit","sideEvents","filter"]',
    '@jm/show: Merker steht in der Bindung direkt nach speakers',
  );
  ok(!('speakerVeraltetSeit' in (binde({ speakers: [{ name: 'Ada' }] }) ?? {})), '@jm/show: ohne Merker kein Feld');
}

// ── @jm/show: Organisationen am Speaker (iveo-Paket P1, Spec 5.3, E1, E2, E4; 12.1 Nr. 2–4) ──
{
  const N = normalisiereOrganisationen;
  const gleich = (ist: unknown, soll: unknown): boolean => JSON.stringify(ist) === JSON.stringify(soll);

  // 12.1 Nr. 2: die gemeinsame Regel für Mapper und Normalisierer (Schritte 1–6 aus 5.3).
  ok([undefined, null, 'UNFCCC', 42, { 0: 'A' }].every((w) => gleich(N(w), [])), 'P1 12.1 Nr. 2: kein Array → []');
  ok(gleich(N([1, null, { name: 'A' }, ['B'], true, 'C']), ['C']), 'P1 12.1 Nr. 2: Nicht-Strings fallen weg');
  ok(gleich(N(['Cafe\u0301']), ['Caf\u00e9']), 'P1 12.1 Nr. 2: NFC');
  ok(
    gleich(N(['  A \t B\n\u00a0 C  ', '   ', '']), ['A B C']),
    'P1 12.1 Nr. 2: jede Folge von Leerraum wird ein Leerzeichen, trim, leer fällt weg',
  );
  ok(
    gleich(N(['a'.repeat(200)]), ['a'.repeat(200)]) && gleich(N(['a'.repeat(201)]), ['a'.repeat(200)]),
    'P1 12.1 Nr. 2: 200 Codepunkte bleiben, 201 werden auf 200 gekürzt',
  );
  ok(
    gleich(N(['a'.repeat(199) + '\u{1F600}b']), ['a'.repeat(199) + '\u{1F600}']),
    'P1 12.1 Nr. 2: Emoji an der Grenze bleibt ganz (Codepunkte, nie ein halbes Surrogatpaar)',
  );
  ok(gleich(N(['a'.repeat(199) + ' b']), ['a'.repeat(199)]), 'P1 12.1 Nr. 2: nach dem Kürzen erneut trim');
  const einundzwanzig = Array.from({ length: 21 }, (_, i) => `Org ${i + 1}`);
  ok(gleich(N(einundzwanzig), einundzwanzig.slice(0, 20)), 'P1 12.1 Nr. 2: 20 bleiben, der 21. fällt weg');
  ok(
    gleich(N(['A', 'B', 'A', ' A ', 'a']), ['A', 'B', 'a']),
    'P1 12.1 Nr. 2: Doppelte nur einmal (nach Leerraum; Groß- und Kleinschreibung zählt)',
  );
  ok(gleich(N(['D', 'D', ...einundzwanzig]), ['D', ...einundzwanzig.slice(0, 19)]), 'P1 12.1 Nr. 2: Doppelte zählen nicht zu den 20');
  ok(gleich(N(['Zeta', 'Alpha', 'Mu']), ['Zeta', 'Alpha', 'Mu']), 'P1 12.1 Nr. 2: Reihenfolge bleibt (kein Sortieren)');
  const roh = ['  B ', 'A'];
  N(roh);
  ok(gleich(roh, ['  B ', 'A']), 'P1 12.1 Nr. 2: Eingabe bleibt unverändert');

  // 12.1 Nr. 3: Normalisierer der Show (OR2), Feldreihenfolge id, name, title, organisationen.
  const binde = (iveo: Record<string, unknown>) =>
    parseShow(JSON.stringify({ schemaVersion: 1, name: 'S', tools: [], iveo: { event: 'cop31', ...iveo } })).iveo;
  const sp = binde({
    speakers: [{ organisationen: ['UNFCCC', '  Ministerium  für Umwelt '], title: 'Ministerin', name: 'Ana', id: 'sp-1' }],
  })?.speakers?.[0];
  ok(
    gleich(sp, { id: 'sp-1', name: 'Ana', title: 'Ministerin', organisationen: ['UNFCCC', 'Ministerium für Umwelt'] }),
    'P1 12.1 Nr. 3: Normalisierer behält organisationen (nach der gemeinsamen Regel)',
  );
  ok(
    gleich(Object.keys(sp ?? {}), ['id', 'name', 'title', 'organisationen']),
    'P1 12.1 Nr. 3: Schlüsselreihenfolge des Speakers ["id","name","title","organisationen"]',
  );
  const ohne =
    binde({ speakers: [{ name: 'A', organisationen: [] }, { name: 'B', organisationen: ['  ', 7] }, { name: 'C', organisationen: 'UNFCCC' }] })
      ?.speakers ?? [];
  ok(ohne.length === 3 && ohne.every((s) => !('organisationen' in s)), 'P1 12.1 Nr. 3: leere oder ungültige Liste → Feld fehlt');
  const doppelt =
    binde({ speakers: [{ id: 'X', name: 'a', organisationen: ['A'] }, { id: 'X', name: 'b', organisationen: ['B'] }] })?.speakers ?? [];
  ok(
    gleich(doppelt, [{ id: 'X', name: 'a', organisationen: ['A'] }, { id: 'X#2', name: 'b', organisationen: ['B'] }]),
    'P1 12.1 Nr. 3: doppelte Kennung → #2, organisationen bleiben (loeseDoppelteKennungenAuf)',
  );

  // 12.1 Nr. 4: serializeShow → parseShow behält das Feld; ein Speaker ohne Organisation bleibt ohne.
  const text = serializeShow({
    ...createShow('Organisationen'),
    iveo: {
      event: 'cop31',
      speakers: [{ id: 'sp-1', name: 'Ada', title: 'Moderation', organisationen: ['UNFCCC', 'GIZ'] }, { name: 'Ohne Organisation' }],
    },
  });
  ok(
    JSON.stringify(parseShow(text).iveo?.speakers) ===
      '[{"id":"sp-1","name":"Ada","title":"Moderation","organisationen":["UNFCCC","GIZ"]},{"name":"Ohne Organisation"}]',
    'P1 12.1 Nr. 4: serializeShow → parseShow behält organisationen',
  );
}

// ── @jm/show: Ausschnitt für den Verbund (Teil 2b Release 2, Spec 14, 19.2) ──
{
  /** Jedes Tool aus Tabelle 14.2, dazu Dokumente, Netz-Bindungen, Basis-URL und fremde Schlüssel. */
  const eingabe: Show = migrateShow({
    schemaVersion: 1,
    name: 'COP31 Tag 1',
    updatedAt: '2026-10-08T09:00:00.000Z',
    tools: [
      {
        appId: 'jm-timer',
        network: { host: '10.0.0.5', port: 7777 },
        settings: { timetable: [{ label: 'A', durationMs: 60000 }], durationMs: 300000, token: 'iveo_live_geheim' },
      },
      { appId: 'jm-qa', settings: { speakSeconds: 90, moderation: true, autoTimer: true, autoTitler: false } },
      { appId: 'jm-battle', settings: { rounds: 3, nameA: 'Rot', nameB: 'Blau', crewA: ['a'], crewB: ['b'] } },
      { appId: 'jm-caption', settings: { model: 'small', language: 'de', ndiName: 'CAP' } },
      {
        appId: 'jm-transcribe',
        settings: { model: 'base', language: 'de', task: 'transcribe', formats: ['srt'], outputDir: 'D:/Mitschnitt' },
      },
      {
        appId: 'jm-recorder',
        settings: { dir: 'D:/Aufnahmen', fileName: 'tag1', separateTracks: true, channels: 8, sampleRate: 48000 },
      },
      { appId: 'jm-player', settings: { show: 'C:/Bibliothek/show1', outputDisplayId: 2 } },
      { appId: 'jm-presenter', network: { host: '10.0.0.9', port: 8080 }, settings: { pin: '4711' } },
      { appId: 'jm-connect', settings: { room: 'Saal 2' } },
      { appId: 'jm-rundown', document: 'C:/Shows/Tag1.jmrundown' },
      { appId: 'jm-daw', document: 'C:/Shows/Tag1.jmdaw', settings: { mixer: 'x' } },
      { appId: 'jm-rundown', document: 'C:/Shows/Kopie.jmrundown' },
      { appId: 'jm-titler', document: '   ' },
      { appId: 'JM-Gross', document: 'C:/Shows/x.doc' },
    ],
    ablauf: [{ id: 'a1', label: 'Begrüßung', durationMs: 300000 }],
    iveo: {
      event: 'cop31',
      baseUrl: 'https://iveo.example/api/v1',
      name: 'COP31',
      syncedAt: '2026-10-08T08:00:00.000Z',
      speakers: [{ name: 'Ana Silva', title: 'Ministerin', organisationen: ['UNFCCC', 'Ministerium für Umwelt'] }],
      speakerVeraltetSeit: '2026-10-08T07:30:00.000Z',
      sideEvents: [{ id: 'P1', title: 'Klima' }],
      filter: { day: '2026-11-10', programId: 'P1' },
    },
  });
  const vorher = JSON.stringify(eingabe);
  const r = showFuerVerbund(eingabe);
  const einstellungen = (appId: string) => r.show.tools.find((t) => t.appId === appId)?.settings;
  const schluessel = (appId: string): string => JSON.stringify(Object.keys(einstellungen(appId) ?? {}));
  const lokal = (...namen: string[]): boolean => namen.every((n) => r.lokalGeblieben.includes(n));

  ok(
    r.show.tools.every((t) => !('document' in t) && !('network' in t)) && !('baseUrl' in (r.show.iveo ?? {})),
    'showFuerVerbund: document, network und iveo.baseUrl fehlen',
  );
  ok(schluessel('jm-timer') === '["timetable","durationMs"]' && lokal('jm-timer.token'), '14.2 jm-timer: timetable, durationMs reisen');
  ok(schluessel('jm-qa') === '["speakSeconds","moderation","autoTimer","autoTitler"]', '14.2 jm-qa: alle vier reisen');
  ok(schluessel('jm-battle') === '["rounds","nameA","nameB","crewA","crewB"]', '14.2 jm-battle: alle fünf reisen');
  ok(schluessel('jm-caption') === '["model","language","ndiName"]', '14.2 jm-caption: alle drei reisen');
  ok(
    schluessel('jm-transcribe') === '["model","language","task","formats"]' && lokal('jm-transcribe.outputDir'),
    '14.2 jm-transcribe: outputDir bleibt lokal',
  );
  ok(
    schluessel('jm-recorder') === '["fileName","separateTracks"]' && lokal('jm-recorder.dir', 'jm-recorder.channels', 'jm-recorder.sampleRate'),
    '14.2 jm-recorder: dir, channels, sampleRate bleiben lokal',
  );
  ok(einstellungen('jm-player') === undefined && lokal('jm-player.show', 'jm-player.outputDisplayId'), '14.2 jm-player: show, outputDisplayId bleiben lokal');
  ok(einstellungen('jm-presenter') === undefined && lokal('jm-presenter.pin'), '14.2 jm-presenter: pin bleibt lokal');
  ok(schluessel('jm-connect') === '["room"]', '14.2 jm-connect: room reist');
  ok(
    JSON.stringify(r.lokalGeblieben) ===
      '["jm-timer.token","jm-transcribe.outputDir","jm-recorder.dir","jm-recorder.channels","jm-recorder.sampleRate",' +
        '"jm-player.show","jm-player.outputDisplayId","jm-presenter.pin","jm-daw.mixer"]',
    'showFuerVerbund: unbekannte Schlüssel (token, mixer) bleiben lokal, lokalGeblieben als ⟨appId⟩.⟨Schlüssel⟩',
  );
  ok(
    !('settings' in r.show.tools.find((t) => t.appId === 'jm-daw')!) && !('settings' in r.show.tools.find((t) => t.appId === 'jm-player')!),
    'showFuerVerbund: Tool ohne freigegebene Settings → settings fehlt',
  );
  ok(JSON.stringify(r.mitDokument) === '["jm-rundown","jm-daw"]', 'showFuerVerbund: mitDokument genau die Tools mit Dokument, ohne Doppelte');
  ok(!r.mitDokument.includes('jm-titler') && !r.mitDokument.includes('JM-Gross'), 'showFuerVerbund: Dokument nur aus Leerzeichen und ungültige appId zählen nicht');
  ok(
    r.show.iveo?.speakerVeraltetSeit === '2026-10-08T07:30:00.000Z'
      && JSON.stringify(Object.keys(r.show.iveo ?? {})) === '["event","name","syncedAt","speakers","speakerVeraltetSeit","sideEvents","filter"]',
    'showFuerVerbund: speakerVeraltetSeit, Speaker, Side Events und Filter reisen',
  );
  ok(
    JSON.stringify(Object.keys(r.show)) === '["schemaVersion","name","updatedAt","tools","ablauf","iveo"]' && r.show.ablauf?.[0]?.id === 'a1',
    'showFuerVerbund: schemaVersion, name, updatedAt und Ablauf mit Kennungen reisen',
  );
  ok(
    JSON.stringify(r.show.iveo?.speakers) ===
      '[{"name":"Ana Silva","title":"Ministerin","organisationen":["UNFCCC","Ministerium für Umwelt"]}]' &&
      r.show.iveo?.speakers?.[0]?.organisationen !== eingabe.iveo?.speakers?.[0]?.organisationen,
    'P1 12.1 Nr. 9: showFuerVerbund reicht organisationen weiter (als eigene Kopie)',
  );
  const leer = showFuerVerbund(createShow('Leer'));
  ok(
    !('iveo' in leer.show) && leer.show.tools.length === 0 && leer.lokalGeblieben.length === 0 && leer.mitDokument.length === 0,
    'showFuerVerbund: ohne iveo kein iveo-Feld',
  );
  ok(JSON.stringify(eingabe) === vorher, 'showFuerVerbund: Eingabe bleibt unverändert');
  const timerAus = einstellungen('jm-timer') as { timetable: unknown[] };
  const timerEin = eingabe.tools[0].settings as { timetable: unknown[] };
  timerAus.timetable.push({ label: 'B' });
  ok(
    timerAus.timetable !== timerEin.timetable && timerEin.timetable.length === 1 && r.show.ablauf![0] !== eingabe.ablauf![0]
      && r.show.iveo!.speakers !== eingabe.iveo!.speakers,
    'showFuerVerbund: Ergebnis teilt keine Objekte mit der Eingabe',
  );
  timerAus.timetable.pop();
  ok(JSON.stringify(migrateShow(r.show)) === JSON.stringify(r.show), 'showFuerVerbund: Ergebnis läuft unverändert durch migrateShow');
  ok(JSON.stringify(showFuerVerbund(r.show).show) === JSON.stringify(r.show), 'showFuerVerbund: zweimal angewendet gleich');
  ok(
    JSON.stringify(VERBUND_EINSTELLUNGEN) ===
      '{"jm-timer":["timetable","durationMs"],"jm-qa":["speakSeconds","moderation","autoTimer","autoTitler"],' +
        '"jm-battle":["rounds","nameA","nameB","crewA","crewB"],"jm-caption":["model","language","ndiName"],' +
        '"jm-transcribe":["model","language","task","formats"],"jm-recorder":["fileName","separateTracks"],' +
        '"jm-player":[],"jm-presenter":[],"jm-connect":["room"]}',
    'VERBUND_EINSTELLUNGEN: Tabelle 14.2 wörtlich',
  );
  ok(Object.isFrozen(VERBUND_EINSTELLUNGEN) && Object.isFrozen(VERBUND_EINSTELLUNGEN['jm-timer']), 'VERBUND_EINSTELLUNGEN: eingefroren');
  const fremd = showFuerVerbund(
    migrateShow({ tools: [{ appId: 'constructor', settings: { a: 1 } }, { appId: '__proto__', settings: { b: 2 } }] }),
  );
  ok(
    fremd.show.tools.every((t) => !('settings' in t)) && JSON.stringify(fremd.lokalGeblieben) === '["constructor.a","__proto__.b"]',
    'showFuerVerbund: appId constructor/__proto__ findet keine Freigabe',
  );
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');
