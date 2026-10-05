// iveo-Abgleich des Launchers OHNE Electron (tsx): npm run selftest:iveo -w @jm/launcher
// Master-Link Teil 2a, Spec 7 und 9.6: atomares Schreiben der Show (show-schreiben.ts) und der Abgleich-Kern
// (iveo-abgleich-kern.ts) mit nachgebautem iveo-Client — ohne Netz, ohne Fenster.
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseShow, serializeShow, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
import {
  IveoApiError,
  agendaToAblauf,
  filterPrograms,
  localTimeOfDayMs,
  programsToAblauf,
  type IveoAgendaItem,
  type IveoProgram,
  type IveoSnapshot,
  type IveoSpeaker,
  type IveoStage,
} from '@jm/iveo';
import {
  ablaufSignatur, einPunktAblauf, erzeugeKern, speakerNamenAusDatei, toClientError, uebernimmOwnerAusDatei,
  type IveoClientLike, type IveoKern, type IveoSyncStatus,
} from '../src/main/iveo-abgleich-kern';
import { schreibeShowAtomar, warteSync, type DateiSystem } from '../src/main/show-schreiben';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// --- schreibeShow: Zwischendatei + Umbenennen, Wiederholung bei Sperre (Spec 7.4, 9.6 Nr. 11) -----------------
{
  const PFAD = 'C:/Shows/Tag1.jmshow';
  const gesperrt = (code: string): Error => Object.assign(new Error(`${code}: Datei gesperrt`), { code });
  /** Nachgebautes fs: Dateien im Speicher. `umbenennen` gibt je Versuch einen Fehlercode vor, null = gelingt. */
  function nachgebautesFs(umbenennen: Array<string | null>, anlegeFehler: string | null = null) {
    const dateien = new Map<string, string>([[PFAD, 'ALT']]);
    const aufrufe: string[] = [];
    let versuch = 0;
    const fs: DateiSystem = {
      writeFileSync(p, inhalt) {
        aufrufe.push(`schreibe ${p}`);
        if (anlegeFehler) throw gesperrt(anlegeFehler);
        dateien.set(p, inhalt);
      },
      renameSync(von, nach) {
        aufrufe.push(`benenne ${von}`);
        const f = umbenennen[versuch++] ?? null;
        if (f) throw gesperrt(f);
        dateien.set(nach, dateien.get(von)!);
        dateien.delete(von);
      },
      unlinkSync(p) {
        aufrufe.push(`loesche ${p}`);
        if (!dateien.delete(p)) throw gesperrt('ENOENT');
      },
    };
    return { fs, dateien, aufrufe, versuche: () => aufrufe.filter((a) => a.startsWith('benenne')).length };
  }
  const pausen: number[] = [];
  const warte = (ms: number): void => { pausen.push(ms); };
  const logZeilen: string[] = [];
  const log = (m: string): void => { logZeilen.push(m); };

  const zwei = nachgebautesFs(['EBUSY', 'EBUSY', null]);
  ck('Nr. 11: Umbenennen scheitert zweimal mit EBUSY → der dritte Versuch gelingt', schreibeShowAtomar(PFAD, 'NEU', zwei.fs, warte, log) === true);
  ck('Nr. 11: … drei Versuche, dazwischen zweimal 50 ms', zwei.versuche() === 3 && JSON.stringify(pausen) === '[50,50]');
  ck('Nr. 11: … die Show trägt den neuen Inhalt, keine Zwischendatei bleibt liegen', zwei.dateien.get(PFAD) === 'NEU' && zwei.dateien.size === 1);
  ck('Nr. 11: … kein Logeintrag', logZeilen.length === 0);
  const zwischen = zwei.aufrufe[0].slice('schreibe '.length);
  ck('Zwischendatei liegt im selben Ordner wie die Show und ist nicht die Show', dirname(zwischen) === dirname(PFAD) && zwischen !== PFAD);

  pausen.length = 0;
  const immer = nachgebautesFs(['EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY']);
  ck('Nr. 11: scheitert es immer → false', schreibeShowAtomar(PFAD, 'NEU', immer.fs, warte, log) === false);
  ck('Nr. 11: … genau 5 Versuche, 4 Pausen à 50 ms', immer.versuche() === 5 && JSON.stringify(pausen) === '[50,50,50,50]');
  ck('Nr. 11: … Zwischendatei gelöscht, Original unverändert',
    immer.aufrufe.includes(`loesche ${zwischen}`) && immer.dateien.get(PFAD) === 'ALT' && immer.dateien.size === 1);
  ck('Nr. 11: … eine Warnung mit dem Code, ohne Inhalt und ohne Pfad',
    logZeilen.length === 1 && logZeilen[0].includes('EBUSY') && !logZeilen[0].includes('NEU') && !logZeilen[0].includes(PFAD));

  pausen.length = 0;
  const andere = nachgebautesFs(['EPERM', 'EACCES', null]);
  ck('EPERM und EACCES gelten ebenso als vorübergehend',
    schreibeShowAtomar(PFAD, 'NEU', andere.fs, warte, log) === true && andere.dateien.get(PFAD) === 'NEU' && pausen.length === 2);

  pausen.length = 0;
  logZeilen.length = 0;
  const fremd = nachgebautesFs(['EXDEV']);
  ck('anderer Fehler beim Umbenennen (EXDEV) → sofort false, ohne Pause',
    schreibeShowAtomar(PFAD, 'NEU', fremd.fs, warte, log) === false && fremd.versuche() === 1 && pausen.length === 0);
  ck('… Zwischendatei gelöscht, Original unverändert, eine Warnung',
    fremd.aufrufe.includes(`loesche ${zwischen}`) && fremd.dateien.get(PFAD) === 'ALT' && fremd.dateien.size === 1 && logZeilen.length === 1);

  logZeilen.length = 0;
  const voll = nachgebautesFs([], 'ENOSPC');
  ck('Zwischendatei nicht anlegbar (ENOSPC) → false, kein Umbenennen, Original unverändert',
    schreibeShowAtomar(PFAD, 'NEU', voll.fs, warte, log) === false && voll.versuche() === 0
    && voll.dateien.get(PFAD) === 'ALT' && logZeilen.length === 1 && logZeilen[0].includes('ENOSPC'));

  // Echtes Dateisystem: ein Durchlauf in einem Temp-Ordner (so verdrahtet die Hülle es in der Produktion).
  const ordner = mkdtempSync(join(tmpdir(), 'jmiveo-'));
  try {
    const datei = join(ordner, 'Tag 1.jmshow');
    writeFileSync(datei, 'ALT', 'utf8');
    const ok = schreibeShowAtomar(datei, 'NEU', { writeFileSync, renameSync, unlinkSync }, warteSync, log);
    ck('echtes fs: geschrieben, im Ordner liegt nur die Show',
      ok && readFileSync(datei, 'utf8') === 'NEU' && JSON.stringify(readdirSync(ordner)) === JSON.stringify(['Tag 1.jmshow']));
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
  const t0 = Date.now();
  warteSync(30);
  ck('warteSync wartet synchron (30 ms)', Date.now() - t0 >= 25);
}

// --- Abgleich-Kern: Prüfstand (nachgebautes iveo, Show-Dateien im Speicher) -------------------------------------
const EVENT = 'cop31';
const BASIS = 'https://iveo.test/api/v1';
const TOKEN = 'iveo_live_geheim';
const SHOW_PFAD = 'C:/Shows/COP31 Tag 1.jmshow';
const TAG = '2026-11-10';

type Abruf = 'geaendert' | 'snapshot' | 'agenda' | 'programm' | 'speakers';
/** Nachgebautes iveo: Daten, Fehler je Abruf, Sperren („Abfrage läuft gerade“) und Mitschrift der Abrufe. */
interface NachgebautesIveo {
  programme: IveoProgram[];
  agenda: Record<string, IveoAgendaItem[]>;
  speakers: IveoSpeaker[];
  stages: IveoStage[];
  /** Antwort auf ?updated_since= */
  geaendert: IveoProgram[];
  fehler: Partial<Record<Abruf, unknown>>;
  sperre: (abruf: Abruf, arg: string) => Promise<void> | null;
  abrufe: string[];
}

function programm(id: string, title: string, extra: Partial<IveoProgram> = {}): IveoProgram {
  return {
    id, event_id: 'ev-1', title, type_slug: 'side-event', duration_minutes: 60,
    starts_at: `${TAG}T09:00:00+00:00`, starts_at_local: `${TAG}T10:00:00`, ...extra,
  };
}
function punkt(programId: string, id: string, title: string, sort: number, minuten = 10): IveoAgendaItem {
  return { id, program_id: programId, sort_order: sort, title, duration_minutes: minuten };
}
/** P1 mit drei Agenda-Punkten, P2 mit zwei, P3 ohne Agenda (alle am 10.11.), P4 am 11.11. */
function neuesIveo(): NachgebautesIveo {
  return {
    programme: [
      programm('P1', 'Side Event Klima', { stage_id: 'S1', subtitle: 'Raum A' }),
      programm('P2', 'Side Event Wasser', { starts_at: `${TAG}T11:00:00+00:00`, starts_at_local: `${TAG}T12:00:00` }),
      programm('P3', 'Side Event Wald', { starts_at: `${TAG}T13:00:00+00:00`, starts_at_local: `${TAG}T14:00:00`, stage_id: 'S1' }),
      programm('P4', 'Side Event Ozean', { starts_at: '2026-11-11T09:00:00+00:00', starts_at_local: '2026-11-11T10:00:00' }),
    ],
    agenda: {
      P1: [punkt('P1', 'a1', 'Begrüßung', 1, 5), punkt('P1', 'a2', 'Panel', 2, 40), punkt('P1', 'a3', 'Fragen', 3, 15)],
      P2: [punkt('P2', 'b1', 'Einführung', 1), punkt('P2', 'b2', 'Diskussion', 2, 30)],
    },
    speakers: [{ id: 'sp1', event_id: 'ev-1', first_name: 'Ana', last_name: 'Silva', title: 'Ministerin' }],
    stages: [{ id: 'S1', event_id: 'ev-1', name: 'Bühne 1' }],
    geaendert: [],
    fehler: {},
    sperre: () => null,
    abrufe: [],
  };
}

function nachgebauterClient(iv: NachgebautesIveo): IveoClientLike {
  const schritt = async (abruf: Abruf, arg: string): Promise<void> => {
    iv.abrufe.push(`${abruf}:${arg}`);
    const halt = iv.sperre(abruf, arg);
    if (halt) await halt;
    if (iv.fehler[abruf]) throw iv.fehler[abruf];
  };
  return {
    async listProgramsUpdatedSince(_event: string, seit: string) {
      await schritt('geaendert', seit);
      return iv.geaendert;
    },
    async getEventSnapshot(
      event: string,
      jetzt: string,
      opts: { onSubError?: (resource: string, err: unknown) => void } = {},
    ): Promise<IveoSnapshot> {
      await schritt('snapshot', jetzt);
      // Wie der echte Client (packages/iveo/src/client.ts:313-320): Speaker best effort. Ein Fehler meldet onSubError
      // und ergibt eine leere Liste; der Snapshot selbst gelingt (Teil 2b, Spec 6.1).
      let speakers = iv.speakers;
      if (iv.fehler.speakers) {
        opts.onSubError?.('speakers', iv.fehler.speakers);
        speakers = [];
      }
      return {
        event: { id: 'ev-1', slug: event, name: 'COP31', starts_at: null, ends_at: null, timezone: null },
        programs: iv.programme, speakers, organisations: [], stages: iv.stages, fetchedAt: jetzt,
      };
    },
    async listAgendaItems(_event: string, programId: string) {
      await schritt('agenda', programId);
      return iv.agenda[programId] ?? [];
    },
    async getProgram(_event: string, programId: string) {
      await schritt('programm', programId);
      const p = iv.programme.find((x) => x.id === programId);
      if (!p) throw new IveoApiError(404, 'not_found', `Programm ${programId} fehlt`);
      return p;
    },
    async listSpeakers() {
      await schritt('speakers', '');
      return iv.speakers;
    },
  };
}

/** Agenda-Ablauf, wie ihn das Binden schreibt (Startzeit-Anker und Kategorie aus dem Programm). */
function agendaAblauf(iv: NachgebautesIveo, programId: string): ShowAblaufItem[] {
  const p = iv.programme.find((x) => x.id === programId)!;
  return agendaToAblauf(iv.agenda[programId] ?? [], { firstStartMs: localTimeOfDayMs(p), category: p.type_slug });
}
/** Listen-Ablauf eines Tages, wie ihn das Binden schreibt. */
function listenAblauf(iv: NachgebautesIveo, day: string): ShowAblaufItem[] {
  return programsToAblauf(filterPrograms(iv.programme, { day }), {
    stagesById: new Map(iv.stages.map((s) => [s.id, s])),
    withSchedule: true,
    speakerNamesById: new Map([['sp1', 'Ana Silva']]),
  });
}
const ANA: ShowIveoSpeaker = { name: 'Ana Silva', title: 'Ministerin' };
function showMit(ablauf: ShowAblaufItem[], filter: NonNullable<Show['iveo']>['filter'], speakers: ShowIveoSpeaker[] = []): Show {
  return {
    schemaVersion: 1,
    name: 'COP31 Tag 1',
    tools: [{ appId: 'jm-timer' }, { appId: 'jm-titler' }, { appId: 'jm-rundown' }],
    ablauf,
    iveo: {
      event: EVENT, baseUrl: BASIS, name: 'COP31', syncedAt: '2026-10-01T08:00:00.000Z',
      ...(speakers.length ? { speakers } : {}),
      sideEvents: [{ id: 'P1', title: 'Side Event Klima' }, { id: 'P2', title: 'Side Event Wasser' }],
      filter,
    },
  };
}

interface Umgebung {
  kern: IveoKern;
  iveo: NachgebautesIveo;
  dateien: Map<string, string>;
  token: string | undefined;
  schreibFehler: boolean;
  schreibversuche: number;
  reloads: string[];
  antworten: Record<'jm-timer' | 'jm-titler' | 'jm-rundown', number>;
  status: IveoSyncStatus[];
  aktivMeldungen: number;
  info: string[];
  warn: string[];
  clients: string[];
  cache: unknown[];
  /** Die nächsten N Lesezugriffe auf Show-Dateien scheitern (null). */
  leseAus: number;
}
/** Show-Datei anlegen, Kern bauen, Show öffnen (wie onShowOpened). */
function umgebung(baue: (iv: NachgebautesIveo) => Show, opt: { ohneToken?: boolean } = {}): Umgebung {
  let uhr = Date.parse('2026-10-01T10:00:00.000Z');
  const iveo = neuesIveo();
  const u: Umgebung = {
    kern: undefined as unknown as IveoKern,
    iveo,
    dateien: new Map([[SHOW_PFAD, serializeShow(baue(iveo))]]),
    token: opt.ohneToken ? undefined : TOKEN,
    schreibFehler: false,
    schreibversuche: 0,
    reloads: [],
    antworten: { 'jm-timer': 1, 'jm-titler': 1, 'jm-rundown': 1 },
    status: [],
    aktivMeldungen: 0,
    info: [],
    warn: [],
    clients: [],
    cache: [],
    leseAus: 0,
  };
  u.kern = erzeugeKern({
    clientFabrik: (token, baseUrl) => {
      u.clients.push(`${token}@${baseUrl}`);
      return nachgebauterClient(u.iveo);
    },
    token: () => u.token,
    leseShow: (p) => {
      if (u.leseAus > 0) { u.leseAus--; return null; }
      const text = u.dateien.get(p);
      if (text === undefined) return null;
      try {
        return parseShow(text);
      } catch {
        return null;
      }
    },
    schreibeShow: (p, show) => {
      u.schreibversuche++;
      if (u.schreibFehler) return false;
      u.dateien.set(p, serializeShow(show));
      return true;
    },
    benachrichtige: (appId, zeile) => {
      u.reloads.push(`${appId} ${zeile}`);
      return u.antworten[appId];
    },
    schreibeCache: (meta) => { u.cache.push(meta); },
    log: { info: (m) => u.info.push(m), warn: (m) => u.warn.push(m) },
    jetztIso: () => new Date((uhr += 1000)).toISOString(),
    meldeStatus: (s) => u.status.push({ ...s }),
    meldeAktiv: () => { u.aktivMeldungen++; },
    baseUrlStandard: () => 'https://standard.test/api/v1',
  });
  u.kern.showGeoeffnet(SHOW_PFAD, parseShow(u.dateien.get(SHOW_PFAD)!));
  return u;
}
const datei = (u: Umgebung, pfad = SHOW_PFAD): Show => parseShow(u.dateien.get(pfad)!);
const ids = (show: Show): string => (show.ablauf ?? []).map((p) => p.id ?? '-').join(',');
const warteMs = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));
function sperre(): { halt: Promise<void>; frei: () => void } {
  let frei: () => void = () => {};
  const halt = new Promise<void>((r) => { frei = r; });
  return { halt, frei };
}
const agendaP1 = (iv: NachgebautesIveo): Show => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' });

// --- ablaufSignatur (Spec 7.2) ---------------------------------------------------------------------------------
{
  const a: ShowAblaufItem[] = [{ id: 'a1', label: 'Begrüßung', durationMs: 300_000, category: 'side-event' }];
  const umgestellt: ShowAblaufItem[] = [{ category: 'side-event', durationMs: 300_000, label: 'Begrüßung', id: 'a1' }];
  ck('Signatur: Feldreihenfolge im Objekt zählt nicht', ablaufSignatur(a, []) === ablaufSignatur(umgestellt, []));
  ck('Signatur: die Kennung zählt (Bestands-Show ohne id ≠ mit id)',
    ablaufSignatur(a, []) !== ablaufSignatur([{ label: 'Begrüßung', durationMs: 300_000, category: 'side-event' }], []));
  ck('Signatur: Speaker zählen (Funktion geändert)', ablaufSignatur(a, [ANA]) !== ablaufSignatur(a, [{ name: 'Ana Silva', title: 'Botschafterin' }]));
  ck('Signatur: so normalisiert wie die Datei (Punkt ohne Titel fällt weg, doppelte id → #2)',
    ablaufSignatur([...a, { label: '  ' }], []) === ablaufSignatur(a, [])
    && ablaufSignatur([{ id: 'x', label: 'A' }, { id: 'x', label: 'B' }], []) === ablaufSignatur([{ id: 'x', label: 'A' }, { id: 'x#2', label: 'B' }], []));
}

// --- Teil 2b, 9.2 Nr. 1 und 2: Signatur mit Speaker-Kennung und Merker, einmaliges Nachschreiben ------------------
/** Spec 23, M1: ja → `ANA` trägt die Kennung `sp1` (SP9); nein → ohne, und der Umwandler setzt keine. */
const MIT_KENNUNG = ANA.id !== undefined;
/** Bestands-Show von vor 2b: derselbe Speaker ohne Kennung (eigenes Fixture für 9.2 Nr. 2). */
const ANA_OHNE_ID: ShowIveoSpeaker = { name: 'Ana Silva', title: 'Ministerin' };
const TEXT_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand';
const MERKER = '2026-10-01T07:30:00.000Z';
/** Dieselbe Show mit Merker „Speaker veraltet“ in der Datei. */
const mitMerker = (s: Show, seit = MERKER): Show => ({ ...s, iveo: { ...s.iveo!, speakerVeraltetSeit: seit } });
{
  const a: ShowAblaufItem[] = [{ id: 'a1', label: 'Begrüßung', durationMs: 300_000 }];
  ck('Nr. 1 (2b): gleicher Name, andere Kennung → andere Signatur',
    ablaufSignatur(a, [{ id: 'sp1', name: 'Ana Silva' }]) !== ablaufSignatur(a, [{ id: 'sp2', name: 'Ana Silva' }]));
  ck('Nr. 1 (2b): mit und ohne Kennung → andere Signatur',
    ablaufSignatur(a, [{ id: 'sp1', name: 'Ana Silva' }]) !== ablaufSignatur(a, [{ name: 'Ana Silva' }]));
  ck('Nr. 1 (2b): Merker gesetzt oder nicht → andere Signatur',
    ablaufSignatur(a, [ANA], '2026-10-02T08:00:00.000Z') !== ablaufSignatur(a, [ANA]));
  ck('Nr. 1 (2b): ohne Merker = Merker undefined', ablaufSignatur(a, [ANA]) === ablaufSignatur(a, [ANA], undefined));
  ck('Nr. 1 (2b): Speaker so normalisiert wie die Datei (Kennung getrimmt, doppelte → #2, über 200 Zeichen → ohne)',
    ablaufSignatur(a, [{ id: ' sp1 ', name: 'Ana Silva' }]) === ablaufSignatur(a, [{ id: 'sp1', name: 'Ana Silva' }])
    && ablaufSignatur(a, [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }]) === ablaufSignatur(a, [{ id: 'x', name: 'A' }, { id: 'x#2', name: 'B' }])
    && ablaufSignatur(a, [{ id: 'k'.repeat(201), name: 'A' }]) === ablaufSignatur(a, [{ name: 'A' }]));
}
{
  // 9.2 Nr. 2: Bestands-Show ohne Kennungen. Die erste schreibende Listen-Abfrage trägt sie nach, danach ist Ruhe.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA_OHNE_ID]));
  ck('Nr. 2 (2b): Ausgangslage — Bestands-Show, Speaker ohne Kennung', datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(u).iveo?.speakers?.[0]?.id === undefined);
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  ck('Nr. 2 (2b): die erste schreibende Listen-Abfrage trägt die Kennungen nach, genau ein RELOAD-Satz (M1 = nein: es gibt keine, nichts geschrieben)',
    MIT_KENNUNG
      ? u.schreibversuche === 1 && datei(u).iveo?.speakers?.[0]?.id === 'sp1' && u.reloads.length === 3
      : u.schreibversuche === 0 && u.reloads.length === 0);
  await u.kern.abfrage();
  ck('Nr. 2 (2b): … danach bleibt die Signatur gleich: kein zweites Schreiben, kein weiteres RELOAD',
    u.schreibversuche === (MIT_KENNUNG ? 1 : 0) && u.reloads.length === (MIT_KENNUNG ? 3 : 0));
}
{
  // Der Merker aus der Datei steht in `active` (setzeAuf) und geht beim Schreiben nicht verloren.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Merker (2b): Umschalten auf ein Side Event ohne Verknüpfung schreibt den Merker der Datei unverändert mit',
    r.ok && u.schreibversuche === 1 && datei(u).iveo?.speakerVeraltetSeit === MERKER);
}

// --- 9.6 Nr. 1: Öffnen + erste Abfrage mit gleichem Stand → kein Schreiben, kein RELOAD -------------------------
// (Im Log von #235: 45 s nach dem Öffnen ein RELOAD ohne Änderung, weil lastSig beim Öffnen fehlte.)
{
  const u = umgebung(agendaP1);
  ck('Öffnen: aktiv() trägt Pfad, Event und Filter, das Panel ist benachrichtigt',
    JSON.stringify(u.kern.aktiv()) === JSON.stringify({ path: SHOW_PFAD, event: EVENT, filter: { day: TAG, programId: 'P1' } })
    && u.aktivMeldungen === 1);
  await u.kern.abfrage();
  ck('Nr. 1: gleicher Stand → nichts geschrieben, kein RELOAD', u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Nr. 1: … der Client nutzt Token und Basis-URL der Bindung', u.clients[0] === `${TOKEN}@${BASIS}`);
  ck('Nr. 1: … der Side-Event-Kontext wurde nachgeladen', u.iveo.abrufe.includes('programm:P1'));
  await u.kern.abfrage();
  ck('Nr. 1: zweite Abfrage: Kontext gemerkt, wieder nichts geschrieben',
    u.iveo.abrufe.filter((x) => x === 'programm:P1').length === 1 && u.schreibversuche === 0 && u.reloads.length === 0);
}

// --- 9.6 Nr. 2: Listen-Modus, updated_since trifft, Ablauf gleich → kein Schreiben --------------------------------
{
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  u.iveo.geaendert = [u.iveo.programme[3]]; // geändert hat sich nur P4 (anderer Tag)
  await u.kern.abfrage();
  ck('Nr. 2: Listen-Modus, Treffer, gefilterter Ablauf gleich → nichts geschrieben, kein RELOAD',
    u.schreibversuche === 0 && u.reloads.length === 0);
  await u.kern.abfrage();
  const seit = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).map((x) => x.slice('geaendert:'.length));
  const snap1 = u.iveo.abrufe.find((x) => x.startsWith('snapshot:'))?.slice('snapshot:'.length) ?? '(kein Snapshot)';
  ck('Nr. 2: … das updated_since-Fenster rückt trotzdem vor', seit[0] === '2026-10-01T08:00:00.000Z' && seit[1] === snap1);
  u.iveo.programme[1] = { ...u.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  await u.kern.abfrage();
  ck('Nr. 2: Gegenprobe: echte Änderung → geschrieben und RELOAD',
    u.schreibversuche === 1 && u.reloads.length === 3 && datei(u).ablauf?.[1]?.label === 'Side Event Wasser und Meer');
  ck('Nr. 2: … die Datei trägt die iveo-Programm-IDs als Kennungen', ids(datei(u)) === 'P1,P2,P3');
  ck('Nr. 2: … nach dem Schreiben steht das Token weder in Show-Datei, Cache, Status noch Log (der Cache wurde geschrieben)',
    u.cache.length >= 1 && ![...u.dateien.values()].some((t) => t.includes(TOKEN)) && !JSON.stringify(u.cache).includes(TOKEN)
    && !JSON.stringify(u.status).includes(TOKEN) && ![...u.info, ...u.warn].some((z) => z.includes(TOKEN)));
  ck('Nr. 2: … Filter, Speaker und Side-Event-Liste bleiben in der Bindung',
    datei(u).iveo?.filter?.day === TAG && datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(u).iveo?.sideEvents?.length === 2);
}

// --- 9.6 Nr. 3: Agenda-Abruf scheitert → kein Schreiben, gestört; danach Erfolg → ok ------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2); // in iveo geändert …
  u.iveo.fehler.agenda = new Error('fetch failed'); // … aber nicht abrufbar
  await u.kern.abfrage();
  ck('Nr. 3: Agenda-Abruf scheitert → nichts geschrieben, kein RELOAD, kein 1-Punkt-Ablauf',
    u.schreibversuche === 0 && u.reloads.length === 0 && datei(u).ablauf?.length === 3);
  const st = u.status[0];
  ck('Nr. 3: … Zustand gestört mit Text und Zeit', u.status.length === 1 && st.ok === false && st.text === 'fetch failed' && typeof st.seit === 'string');
  const gestoertWarnungen = (): number => u.warn.filter((w) => w.startsWith('iveo-Abgleich gestört')).length;
  ck('Nr. 3: … eine Warnung im Log', gestoertWarnungen() === 1);
  await u.kern.abfrage();
  ck('Nr. 3: derselbe Fehler noch einmal → keine neue Meldung, keine neue Warnung', u.status.length === 1 && gestoertWarnungen() === 1);
  u.iveo.fehler.agenda = new IveoApiError(503, 'unavailable', 'iveo HTTP 503 @ /events [HTTP 503]');
  await u.kern.abfrage();
  ck('Nr. 3: anderer Fehlertext → neue Meldung und Warnung, „seit“ bleibt',
    u.status.length === 2 && u.status[1].text === 'iveo-Server-Fehler (HTTP 503) — vorübergehend oder serverseitiger Bug. Bitte an den iveo-Entwickler melden (Details im Launcher-Log).'
    && u.status[1].seit === st.seit && gestoertWarnungen() === 2);
  ck('Nr. 3: … die Warnung trägt die Rohmeldung (Pfad, HTTP-Status), der Statustext sie nicht',
    u.warn.some((w) => w.includes('@ /events') && w.includes('HTTP 503')) && !u.status[1].text?.includes('@ /events'));
  delete u.iveo.fehler.agenda;
  await u.kern.abfrage();
  ck('Nr. 3: danach Erfolg → ok, der neue Stand ist geschrieben',
    u.status.at(-1)?.ok === true && u.schreibversuche === 1 && datei(u).ablauf?.length === 2 && u.reloads.length === 3);
}

// --- 9.6 Nr. 4: getProgram scheitert bei fehlendem sideCtx → kein Schreiben, gestört ------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  u.iveo.fehler.programm = new Error('socket hang up');
  await u.kern.abfrage();
  ck('Nr. 4: getProgram scheitert bei fehlendem Kontext → nichts geschrieben (kein Ablauf ohne Startzeit/Kategorie)',
    u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Nr. 4: … Zustand gestört', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'socket hang up');
  delete u.iveo.fehler.programm;
  await u.kern.abfrage();
  const a = datei(u).ablauf ?? [];
  ck('Nr. 4: nächster Versuch klappt → mit Startzeit-Anker und Kategorie geschrieben',
    u.schreibversuche === 1 && a.length === 2 && a[0].plannedStartMs === localTimeOfDayMs(u.iveo.programme[0]) && a[0].category === 'side-event');
}

// --- 7.6 / Spec 0 Nr. 1: Speakerliste nicht ladbar → wie getProgram: abbrechen, nichts schreiben, Kontext nicht merken -----
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.map((p, i) => (i === 0 ? { ...p, speaker_id: 'sp1' } as IveoAgendaItem : p));
  u.iveo.fehler.speakers = new Error('speakers kaputt');
  await u.kern.abfrage();
  ck('Speaker: listSpeakers scheitert → nichts geschrieben, kein RELOAD (kein Ablauf ohne „Verantwortlich“)',
    u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Speaker: … Zustand gestört mit dem Fehlertext', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'speakers kaputt');
  delete u.iveo.fehler.speakers;
  await u.kern.abfrage();
  ck('Speaker: danach Erfolg → ok, „Verantwortlich“ steht in der Datei (der Kontext war nicht gemerkt)',
    u.status.at(-1)?.ok === true && u.schreibversuche === 1 && u.reloads.length === 3 && datei(u).ablauf?.[0]?.owner === 'Ana Silva');
}

// --- 7.3 / kern:330: eine veraltete Abfrage, die WIRFT, setzt keinen Status -----------------------------------------
{
  const u = umgebung(agendaP1);
  const s = sperre();
  u.iveo.sperre = (abruf) => (abruf === 'agenda' ? s.halt : null);
  const lauf = u.kern.abfrage();
  const tag2 = 'C:/Shows/COP31 Tag 2.jmshow';
  u.dateien.set(tag2, serializeShow({ schemaVersion: 1, name: 'COP31 Tag 2', tools: [] }));
  u.kern.showGeoeffnet(tag2, datei(u, tag2));
  u.iveo.fehler.agenda = new Error('fetch failed');
  s.frei();
  await lauf;
  ck('7.3: veraltete Abfrage wirft → kein Status, keine Warnung', u.status.length === 0 && u.warn.length === 0);
}

// --- 7.6: Show-Datei nicht lesbar → gestört, nichts geschrieben, kein RELOAD ---------------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  u.dateien.delete(SHOW_PFAD);
  await u.kern.abfrage();
  ck('Datei nicht lesbar (Agenda-Modus): gestört „Show-Datei nicht lesbar“, nichts geschrieben, kein RELOAD',
    u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'Show-Datei nicht lesbar' && u.schreibversuche === 0 && u.reloads.length === 0);

  const v = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  v.iveo.geaendert = [v.iveo.programme[1]];
  v.iveo.programme[1] = { ...v.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  v.dateien.delete(SHOW_PFAD);
  await v.kern.abfrage();
  await v.kern.abfrage();
  const seit = v.iveo.abrufe.filter((x) => x.startsWith('geaendert:'));
  ck('Datei nicht lesbar (Listen-Modus): gestört, nichts geschrieben, kein RELOAD',
    v.status.at(-1)?.text === 'Show-Datei nicht lesbar' && v.schreibversuche === 0 && v.reloads.length === 0);
  ck('Datei nicht lesbar (Listen-Modus): lastSyncIso rückt nicht vor (zweite Abfrage fragt dasselbe Fenster)',
    seit.length === 2 && seit[0] === seit[1]);
}

// --- Show-Wechsel nimmt die Störung der vorigen Show nicht mit (setzeAuf) ----------------------------------------
{
  const u = umgebung(agendaP1, { ohneToken: true });
  const erste = u.status.at(-1);
  const b = 'C:/Shows/COP31 Tag 2.jmshow';
  u.dateien.set(b, serializeShow(agendaP1(u.iveo)));
  u.kern.showGeoeffnet(b, datei(u, b));
  ck('Show-Wechsel A gestört → B ohne Token: neue Meldung mit neuem „seit“ (nicht das von A)',
    u.status.length === 2 && u.status[1].ok === false && u.status[1].text === erste?.text && u.status[1].seit !== erste?.seit);
}

{
  const ohne = { schemaVersion: 1, name: 'Ohne iveo', tools: [], ablauf: [{ id: 'x1', label: 'Begrüßung' }] };
  const u = umgebung(agendaP1, { ohneToken: true });
  const b = 'C:/Shows/Ohne iveo.jmshow';
  u.dateien.set(b, serializeShow(ohne as Show));
  u.kern.showGeoeffnet(b, datei(u, b));
  ck('Show-Wechsel A gestört → B ohne iveo: UI bekommt „wieder in Ordnung“', u.status.length === 2 && u.status[1].ok === true);
  const v = umgebung(agendaP1, { ohneToken: true });
  v.token = TOKEN;
  const c = 'C:/Shows/COP31 Tag 3.jmshow';
  v.dateien.set(c, serializeShow(agendaP1(v.iveo)));
  v.kern.showGeoeffnet(c, datei(v, c));
  ck('Show-Wechsel A gestört → B mit Token: UI bekommt „wieder in Ordnung“', v.status.length === 2 && v.status[1].ok === true);
}

// --- 9.6 Nr. 5: leere Agenda → 1-Punkt-Ablauf; gleich gebunden und abgefragt → kein Schein-„geändert“ -------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = [];
  await u.kern.abfrage();
  const a = datei(u).ablauf ?? [];
  ck('Nr. 5: erfolgreich leere Agenda → das Programm als ein Punkt, mit iveo-Programm-ID, RELOAD',
    a.length === 1 && a[0].label === 'Side Event Klima' && a[0].id === 'P1' && u.reloads.length === 3);
  ck('Nr. 5: … Notiz ohne Bühnennamen (ohne stagesById, Spec 7.2)', a[0].note === 'Raum A');
  const v = umgebung((iv) => showMit([einPunktAblauf(iv.programme[2])], { day: TAG, programId: 'P3' }));
  await v.kern.abfrage();
  await v.kern.abfrage();
  ck('Nr. 5: so gebunden (einPunktAblauf) und abgefragt → nichts geschrieben, kein RELOAD', v.schreibversuche === 0 && v.reloads.length === 0);
}

// --- 9.6 Nr. 6: HTTP 401 → „Token ungültig oder widerrufen“ -------------------------------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.fehler.agenda = new IveoApiError(401, 'token_revoked', 'Token revoked @ /events/cop31/programs/P1/agenda-items [HTTP 401 token_revoked]');
  await u.kern.abfrage();
  ck('Nr. 6: HTTP 401 → Text „Token ungültig oder widerrufen“', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'Token ungültig oder widerrufen');
  ck('Nr. 6: … das Token steht nirgends im Log', ![...u.info, ...u.warn].some((z) => z.includes(TOKEN)));
  ck('Nr. 6: … und nicht in Status, Show-Datei und Cache',
    !JSON.stringify(u.status).includes(TOKEN) && ![...u.dateien.values()].some((t) => t.includes(TOKEN)) && !JSON.stringify(u.cache).includes(TOKEN));
  const v = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  v.iveo.fehler.geaendert = new IveoApiError(401, 'unauthorized', 'iveo HTTP 401 @ /events/cop31/programs [HTTP 401]');
  await v.kern.abfrage();
  ck('Nr. 6: … ebenso im Listen-Modus', v.status.at(-1)?.text === 'Token ungültig oder widerrufen' && v.schreibversuche === 0);
}

// --- 7.6 (Erweiterung, Ruling offen): Zeitgrenze je Abruf (15 s, Spec 7.0) → deutscher Text, keine Rohmeldung ----
{
  const ZEITGRENZE = 'iveo antwortet nicht innerhalb von 15 s';
  const zeit = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  ck('toClientError: TimeoutError → deutscher Text', toClientError(zeit).error === ZEITGRENZE);
  ck('toClientError: AbortError ebenso (die Zeitgrenze ist der einzige Abbruch)',
    toClientError(new DOMException('This operation was aborted', 'AbortError')).error === ZEITGRENZE);
  ck('toClientError: anderer Fehler wie bisher', toClientError(new Error('fetch failed')).error === 'fetch failed');
  const u = umgebung(agendaP1);
  u.iveo.fehler.agenda = zeit;
  await u.kern.abfrage();
  ck('Abfrage läuft in die Zeitgrenze → Status mit deutschem Text, nichts geschrieben, kein RELOAD',
    u.status.at(-1)?.ok === false && u.status.at(-1)?.text === ZEITGRENZE && u.schreibversuche === 0 && u.reloads.length === 0);
  ck('… die Rohmeldung steht für die Diagnose im Log', u.warn.some((w) => w.includes(ZEITGRENZE) && w.includes('aborted due to timeout')));
  const v = umgebung(agendaP1);
  v.iveo.fehler.snapshot = zeit;
  const r = await v.kern.umschalten({ day: '2026-11-11' });
  ck('Umschalten auf die Tagesübersicht in die Zeitgrenze → ok:false mit deutschem Text', !r.ok && r.message === ZEITGRENZE);
}

// --- 9.6 Nr. 7: kein Token → „kein iveo-Token auf diesem Rechner, nur Offline-Ablauf“ -----------------------------
{
  const u = umgebung(agendaP1, { ohneToken: true });
  ck('Nr. 7: kein Token beim Öffnen → Status-Text', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf');
  ck('Nr. 7: … kein aktiver Abgleich, das Panel ist trotzdem benachrichtigt', u.kern.aktiv() === null && u.aktivMeldungen === 1);
  await u.kern.abfrage();
  ck('Nr. 7: … eine Abfrage fragt iveo nicht', u.clients.length === 0 && u.iveo.abrufe.length === 0);
  const v = umgebung(agendaP1);
  v.token = undefined;
  await v.kern.abfrage();
  ck('Nr. 7: Token fehlt bei einer Abfrage → derselbe Text, kein Abruf',
    v.status.at(-1)?.text === 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf' && v.clients.length === 0);
  const w = umgebung(() => ({ schemaVersion: 1, name: 'Ohne iveo', tools: [], ablauf: [{ id: 'x1', label: 'Begrüßung' }] }));
  ck('Show ohne iveo: kein Abgleich, Status bleibt ok', w.kern.aktiv() === null && w.status.length === 0);
}

// --- 9.6 Nr. 9 und 7.3: Show-Wechsel während einer Abfrage; Abfragen nacheinander ---------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2); // die Abfrage hätte etwas zu schreiben
  const s = sperre();
  u.iveo.sperre = (abruf) => (abruf === 'agenda' ? s.halt : null);
  const lauf = u.kern.abfrage();
  const zweite = await Promise.race([u.kern.abfrage().then(() => 'fertig'), warteMs(500).then(() => 'hängt')]);
  ck('7.3: läuft noch eine Abfrage, startet keine zweite (kehrt sofort zurück, kein zweiter Abruf)',
    zweite === 'fertig' && u.iveo.abrufe.filter((x) => x.startsWith('agenda:')).length === 1);
  const tag2 = 'C:/Shows/COP31 Tag 2.jmshow';
  u.dateien.set(tag2, serializeShow({ schemaVersion: 1, name: 'COP31 Tag 2', tools: [] }));
  u.kern.showGeoeffnet(tag2, datei(u, tag2));
  s.frei();
  await lauf;
  ck('Nr. 9: Show-Wechsel während einer Abfrage → nichts geschrieben, kein RELOAD', u.schreibversuche === 0 && u.reloads.length === 0);
  ck('Nr. 9: … beide Dateien unverändert', datei(u).ablauf?.length === 3 && datei(u, tag2).ablauf === undefined);

  const v = umgebung(agendaP1);
  v.iveo.agenda.P1 = v.iveo.agenda.P1.slice(0, 2);
  const s2 = sperre();
  v.iveo.sperre = (abruf) => (abruf === 'agenda' ? s2.halt : null);
  const lauf2 = v.kern.abfrage();
  v.kern.showGeschlossen();
  s2.frei();
  await lauf2;
  ck('Nr. 9: Show geschlossen während einer Abfrage → nichts geschrieben', v.schreibversuche === 0 && v.reloads.length === 0 && v.kern.aktiv() === null);
}

// --- 9.6 Nr. 10: Schreiben scheitert → kein RELOAD, lastSig unverändert; die nächste Abfrage schreibt erneut -------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  u.schreibFehler = true;
  await u.kern.abfrage();
  ck('Nr. 10: Schreiben scheitert → kein RELOAD, Datei unverändert', u.schreibversuche === 1 && u.reloads.length === 0 && datei(u).ablauf?.length === 3);
  ck('Nr. 10: … Zustand gestört „Show konnte nicht geschrieben werden“', u.status.at(-1)?.text === 'Show konnte nicht geschrieben werden');
  u.schreibFehler = false;
  await u.kern.abfrage();
  ck('Nr. 10: nächste Abfrage mit gleichem iveo-Stand schreibt erneut und schickt RELOAD',
    u.schreibversuche === 2 && u.reloads.length === 3 && datei(u).ablauf?.length === 2 && u.status.at(-1)?.ok === true);
  await u.kern.abfrage();
  ck('Nr. 10: … danach gleicher Stand → nichts mehr', u.schreibversuche === 2 && u.reloads.length === 3);

  const v = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  v.iveo.geaendert = [v.iveo.programme[1]];
  v.iveo.programme[1] = { ...v.iveo.programme[1], title: 'Side Event Wasser und Meer' };
  v.schreibFehler = true;
  await v.kern.abfrage();
  v.schreibFehler = false;
  await v.kern.abfrage();
  const seit = v.iveo.abrufe.filter((x) => x.startsWith('geaendert:'));
  ck('Nr. 10: Listen-Modus: nach dem Schreibfehler fragt die nächste Abfrage dasselbe Fenster ab und schreibt',
    seit.length === 2 && seit[0] === seit[1] && v.schreibversuche === 2 && v.reloads.length === 3);
}

// --- 9.6 Nr. 12: RELOAD-Zählung enthält den Rundown (Spec 7.1) -------------------------------------------------
{
  const u = umgebung(agendaP1);
  u.antworten = { 'jm-timer': 1, 'jm-titler': 0, 'jm-rundown': 2 };
  u.iveo.agenda.P1 = [...u.iveo.agenda.P1, punkt('P1', 'a4', 'Abschluss', 4)];
  await u.kern.abfrage();
  ck('Nr. 12: RELOAD geht an Timer, Titler und Rundown',
    JSON.stringify(u.reloads) === JSON.stringify(['jm-timer TIMER RELOAD', 'jm-titler TITLER RELOAD', 'jm-rundown RUNDOWN RELOAD']));
  ck('Nr. 12: … die Logzeile zählt den Rundown', u.info.includes('iveo: RELOAD → 1 Timer, 0 Titler, 2 Rundown benachrichtigt.'));
}

// --- 7.2: Bestands-Show ohne Kennungen → die erste Abfrage schreibt sie einmal nach -------------------------------
{
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1').map(({ id: _id, ...rest }) => rest), { day: TAG, programId: 'P1' }));
  ck('7.2: Ausgangslage: Datei ohne Kennungen', ids(datei(u)) === '-,-,-');
  await u.kern.abfrage();
  ck('7.2: erste Abfrage schreibt die Kennungen einmal nach und schickt RELOAD',
    u.schreibversuche === 1 && u.reloads.length === 3 && ids(datei(u)) === 'a1,a2,a3');
  await u.kern.abfrage();
  ck('7.2: … danach stabil', u.schreibversuche === 1 && u.reloads.length === 3);
}

// --- Umschalten: Side Event, 1-Punkt, Tagesübersicht (Spec 7.2) ------------------------------------------------
{
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten auf ein Side Event: ok, RELOAD an alle drei, Panel benachrichtigt',
    r.ok && u.schreibversuche === 1 && u.reloads.length === 3 && u.aktivMeldungen === 2);
  ck('… Meldung nennt die fehlende Speaker-Verknüpfung',
    r.message === 'Umgeschaltet — iveo verknüpft keine Speaker mit diesem Side Event — bestehende Speakerliste bleibt.');
  ck('… Datei: Agenda von P2 mit Kennungen, Filter P2, Tag und Speaker bleiben',
    ids(datei(u)) === 'b1,b2' && datei(u).iveo?.filter?.programId === 'P2' && datei(u).iveo?.filter?.day === TAG
    && datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva');
  ck('… aktiv() zeigt das neue Side Event', u.kern.aktiv()?.filter.programId === 'P2');
  await u.kern.abfrage();
  ck('… die nächste Abfrage findet denselben Stand: nichts geschrieben (lastSig gesetzt, Kontext gemerkt)',
    u.schreibversuche === 1 && u.reloads.length === 3 && !u.iveo.abrufe.slice(2).includes('programm:P2'));
}
{
  const u = umgebung(agendaP1);
  const r = await u.kern.umschalten({ programId: 'P3' }); // P3 hat keine Agenda
  const a = datei(u).ablauf ?? [];
  ck('Umschalten auf ein Side Event ohne Agenda → 1 Punkt mit Programm-ID, ohne Bühnennamen (Spec 7.2)',
    r.ok && a.length === 1 && a[0].id === 'P3' && a[0].note === undefined);
  await u.kern.abfrage();
  ck('… danach kein Schein-„geändert“', u.schreibversuche === 1 && u.reloads.length === 3);
}
{
  const u = umgebung(agendaP1);
  const r = await u.kern.umschalten({ day: '2026-11-11' });
  ck('Tagesübersicht: ok, Filter ohne Side Event, neuer Tag',
    r.ok && u.kern.aktiv()?.filter.programId === undefined && u.kern.aktiv()?.filter.day === '2026-11-11');
  ck('… Datei: die Side Events dieses Tages, Bindung ohne programId', ids(datei(u)) === 'P4' && datei(u).iveo?.filter?.programId === undefined);
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  const seit = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).map((x) => x.slice('geaendert:'.length));
  const snap = u.iveo.abrufe.find((x) => x.startsWith('snapshot:'))?.slice('snapshot:'.length) ?? '(kein Snapshot)';
  ck('… die nächste Listen-Abfrage fragt ab dem Umschalt-Snapshot ab und schreibt nichts', seit[0] === snap && u.schreibversuche === 1);
}

// --- Umschalten: Fehler (Spec 7.6, 7.2) ---------------------------------------------------------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.fehler.agenda = new Error('fetch failed');
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('7.6: Agenda nicht abrufbar → Umschalten scheitert mit „Agenda von iveo nicht abrufbar, bitte erneut versuchen“',
    !r.ok && r.message === 'Agenda von iveo nicht abrufbar, bitte erneut versuchen');
  ck('7.6: … nichts geschrieben, kein RELOAD, Filter unverändert',
    u.schreibversuche === 0 && u.reloads.length === 0 && u.kern.aktiv()?.filter.programId === 'P1');
}
{
  const u = umgebung(agendaP1);
  u.schreibFehler = true;
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('7.2: Schreiben scheitert beim Umschalten → ok:false „Show konnte nicht geschrieben werden“',
    !r.ok && r.message === 'Show konnte nicht geschrieben werden');
  ck('7.2: … Merker nicht vorgerückt (Filter P1), kein RELOAD', u.kern.aktiv()?.filter.programId === 'P1' && u.reloads.length === 0);
  u.schreibFehler = false;
  await u.kern.abfrage();
  ck('7.2: … die nächste Abfrage läuft weiter auf P1 und findet den Stand der Datei', u.schreibversuche === 1 && u.iveo.abrufe.includes('agenda:P1'));
}
{
  const u = umgebung(agendaP1, { ohneToken: true });
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten ohne Token → abgelehnt wie bisher',
    !r.ok && r.message === 'Kein iveo-Token für die offene Show — Live-Umschalten nicht möglich.' && u.clients.length === 0);
}

// --- 9.6 Nr. 8 und 7.3: Umschalten während laufender Abfrage; Umschaltungen nacheinander --------------------------
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2); // die Abfrage hätte etwas zu schreiben
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P1' ? s.halt : null);
  const abfrage = u.kern.abfrage();
  const r = await Promise.race([u.kern.umschalten({ programId: 'P2' }), warteMs(1000).then(() => null)]);
  ck('Nr. 8: Umschalten während laufender Abfrage → wartet nicht, gelingt', r !== null && r.ok);
  s.frei();
  await abfrage;
  ck('Nr. 8: … die Abfrage verwirft ihr Ergebnis: nur das Umschalten hat geschrieben',
    u.schreibversuche === 1 && u.reloads.length === 3 && ids(datei(u)) === 'b1,b2' && datei(u).iveo?.filter?.programId === 'P2');
}
{
  const u = umgebung(agendaP1);
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P2' ? s.halt : null);
  const erstes = u.kern.umschalten({ programId: 'P2' });
  const zweites = u.kern.umschalten({ programId: 'P3' });
  await warteMs(20);
  ck('7.3: Umschaltungen laufen nacheinander (das zweite wartet auf das erste)', !u.iveo.abrufe.includes('programm:P3'));
  await u.kern.abfrage();
  ck('7.3: während eines Umschaltens startet keine Abfrage', !u.iveo.abrufe.includes('agenda:P1'));
  s.frei();
  const [r1, r2] = await Promise.all([erstes, zweites]);
  ck('7.3: … beide gelingen, am Ende gilt das zweite',
    r1.ok && r2.ok && u.kern.aktiv()?.filter.programId === 'P3' && datei(u).iveo?.filter?.programId === 'P3');
}
{
  const u = umgebung(agendaP1);
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P2' ? s.halt : null);
  const lauf = u.kern.umschalten({ programId: 'P2' });
  await warteMs(20);
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  s.frei();
  const r = await lauf;
  ck('7.3: die Show wird gespeichert, während ein Umschalten läuft → Umschalten verworfen, nichts geschrieben',
    !r.ok && u.schreibversuche === 0 && u.kern.aktiv()?.filter.programId === 'P1');
}

// --- 9.6 Nr. 13: Speichern der offenen Show im Editor (Spec 7.5) ---------------------------------------------------
{
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  // Der Show-Editor bindet neu an Side Event P2 und speichert (synchron); dann meldet die Hülle es dem Kern.
  u.dateien.set(SHOW_PFAD, serializeShow(showMit(agendaAblauf(u.iveo, 'P2'), { day: TAG, programId: 'P2' })));
  u.kern.offeneShowGespeichert(SHOW_PFAD, true);
  ck('Nr. 13: Speichern der offenen Show → RELOAD an Timer, Titler und Rundown mit der Logzeile aus 7.1',
    u.reloads.length === 3 && u.info.includes('iveo: RELOAD → 1 Timer, 1 Titler, 1 Rundown benachrichtigt.'));
  ck('Nr. 13: … active neu aufgesetzt (neuer Filter), Panel benachrichtigt', u.kern.aktiv()?.filter.programId === 'P2' && u.aktivMeldungen === 2);
  await u.kern.abfrage();
  ck('Nr. 13: bei neuer Bindung nutzt die nächste Abfrage den neuen Filter (Agenda von P2)',
    u.iveo.abrufe.includes('agenda:P2') && !u.iveo.abrufe.some((x) => x.startsWith('geaendert:')));
  ck('Nr. 13: … und schreibt nichts (lastSig aus der gespeicherten Datei)', u.schreibversuche === 0);
}
{
  const u = umgebung(agendaP1);
  await u.kern.abfrage(); // Kontext geladen
  u.dateien.set(SHOW_PFAD, serializeShow({ ...datei(u), name: 'COP31 Tag 1 (umbenannt)' }));
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  ck('7.5: gleiche Bindung gespeichert → Side-Event-Kontext bleibt (kein zweiter Detail-Abruf), nichts geschrieben',
    u.iveo.abrufe.filter((x) => x === 'programm:P1').length === 1 && u.schreibversuche === 0 && u.reloads.length === 3);
}
{
  const u = umgebung(agendaP1);
  u.iveo.agenda.P1 = u.iveo.agenda.P1.slice(0, 2);
  const s = sperre();
  u.iveo.sperre = (abruf) => (abruf === 'agenda' ? s.halt : null);
  const lauf = u.kern.abfrage();
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  s.frei();
  await lauf;
  ck('7.5: Speichern während einer Abfrage → die Abfrage verwirft ihr Ergebnis (Generation)', u.schreibversuche === 0);
}
{
  const u = umgebung(() => ({ schemaVersion: 1, name: 'Ohne iveo', tools: [], ablauf: [{ id: 'x1', label: 'Begrüßung' }] }));
  u.kern.offeneShowGespeichert('C:/Shows/Andere.jmshow', false);
  ck('7.5: eine ANDERE Show gespeichert → kein RELOAD', u.reloads.length === 0);
  u.kern.offeneShowGespeichert(SHOW_PFAD.toUpperCase(), false);
  ck('Spec 0.2: offene Show ohne iveo gespeichert (Pfad in anderer Schreibweise) → RELOAD an alle drei',
    u.reloads.length === 3 && u.kern.aktiv() === null);
}

// --- Fix-Runde 1 (A14): Umschalten gilt für die Show beim ANFORDERN, Speakerliste, Testlücken ----------------------
{
  const u = umgebung(agendaP1);
  u.token = undefined; // Token nach dem Öffnen entfernt
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten: Token inzwischen weg → „iveo-Token nicht mehr vorhanden.“, nichts geschrieben',
    !r.ok && r.message === 'iveo-Token nicht mehr vorhanden.' && u.schreibversuche === 0 && u.clients.length === 0);
}
{
  // Ein wartendes Umschalten gilt für die Show beim Anfordern: wird dazwischen Show B geöffnet, schreibt es nichts.
  const u = umgebung(agendaP1);
  const PFAD_B = 'C:/Shows/COP31 Tag 2.jmshow';
  u.dateien.set(PFAD_B, serializeShow({ ...agendaP1(u.iveo), name: 'COP31 Tag 2' }));
  const s = sperre();
  u.iveo.sperre = (abruf, arg) => (abruf === 'agenda' && arg === 'P2' ? s.halt : null);
  const erstes = u.kern.umschalten({ programId: 'P2' });
  const zweites = u.kern.umschalten({ programId: 'P3' });
  await warteMs(20);
  u.kern.showGeoeffnet(PFAD_B, parseShow(u.dateien.get(PFAD_B)!));
  s.frei();
  const [r1, r2] = await Promise.all([erstes, zweites]);
  ck('7.3: Show B geöffnet, während Umschalten 1 hängt und 2 wartet → beide verworfen',
    !r1.ok && !r2.ok && r2.message === 'Show wurde inzwischen gewechselt oder gespeichert, Umschalten verworfen.');
  ck('7.3: … Show B unberührt (kein Schreiben, kein RELOAD, kein Abruf für P3)',
    u.schreibversuche === 0 && u.reloads.length === 0 && !u.iveo.abrufe.includes('programm:P3') && u.kern.aktiv()?.path === PFAD_B);
}
{
  // Umschalten mit verknüpften Speakern: Neu-Eingrenzung, Verantwortlich, Kontext gemerkt, kein Schein-„geändert“.
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA, { name: 'Otto Alt' }]));
  u.iveo.programme[1] = { ...u.iveo.programme[1], speaker_ids: ['sp1'] } as IveoProgram;
  u.iveo.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp1'] } as IveoAgendaItem, punkt('P2', 'b2', 'Diskussion', 2, 30)];
  const r = await u.kern.umschalten({ programId: 'P2' });
  const sp = datei(u).iveo?.speakers ?? [];
  ck('Umschalten, Speaker verknüpft: ok ohne Warnung, Speaker auf die verknüpften eingegrenzt',
    r.ok && r.message === 'Umgeschaltet (2 Punkte).' && sp.length === 1 && sp[0].name === 'Ana Silva');
  ck('… Verantwortlich am Punkt gesetzt', datei(u).ablauf?.[0]?.owner === 'Ana Silva');
  await u.kern.abfrage();
  ck('… die nächste Abfrage: Kontext gemerkt (kein Detail-Abruf), nichts geschrieben, kein RELOAD',
    u.schreibversuche === 1 && u.reloads.length === 3 && u.iveo.abrufe.filter((x) => x === 'programm:P2').length === 1);

  // Speakerliste beim Umschalten nicht ladbar: Warnung im Log, kein Kontext → die nächste Abfrage lädt vollständig nach.
  const v = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  v.iveo.programme[1] = { ...v.iveo.programme[1], speaker_ids: ['sp1'] } as IveoProgram;
  v.iveo.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp1'] } as IveoAgendaItem];
  v.iveo.fehler.speakers = new Error('fetch failed');
  const r2 = await v.kern.umschalten({ programId: 'P2' });
  ck('Umschalten, Speakerliste nicht ladbar: gelingt, Warnung im Log (ohne Token), Ersatzliste bleibt, kein Verantwortlich',
    r2.ok && v.warn.some((w) => w.includes('Speakerliste')) && !v.warn.some((w) => w.includes(TOKEN))
    && datei(v).iveo?.speakers?.[0]?.name === 'Ana Silva' && datei(v).ablauf?.[0]?.owner === undefined);
  v.iveo.fehler.speakers = undefined;
  await v.kern.abfrage();
  ck('… die nächste Abfrage lädt Kontext samt Speakern nach und trägt Verantwortlich nach',
    v.iveo.abrufe.filter((x) => x === 'programm:P2').length === 2 && datei(v).ablauf?.[0]?.owner === 'Ana Silva' && v.schreibversuche === 2);
}
{
  // getProgram scheitert beim Umschalten: gelingt trotzdem (Agenda da), aber kein Kontext → die nächste Abfrage lädt nach.
  const u = umgebung(agendaP1);
  u.iveo.fehler.programm = new Error('fetch failed');
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten, Detail nicht abrufbar: gelingt (Agenda genügt)', r.ok && ids(datei(u)) === 'b1,b2');
  u.iveo.fehler.programm = undefined;
  await u.kern.abfrage();
  ck('… kein Kontext gemerkt: die nächste Abfrage holt das Detail nach (Startzeit/Kategorie) und schreibt',
    u.iveo.abrufe.filter((x) => x === 'programm:P2').length === 2 && u.schreibversuche === 2 && datei(u).ablauf?.[0]?.plannedStartMs !== undefined);
}
{
  // Die Ersatz-Speakerliste kommt aus dem Lesen, das auch geschrieben wird: ein Lesefehler vorher darf sie nicht leeren.
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  u.leseAus = 1;
  await u.kern.umschalten({ programId: 'P3' });
  ck('Umschalten ohne Verknüpfung, ein Lesefehler: die Speakerliste der Datei bleibt (nie leer geschrieben)',
    datei(u).iveo?.speakers?.[0]?.name === 'Ana Silva');
}
{
  // Tagesübersicht: iveo antwortet 401 → die Meldung kommt aus toClientError, das Token steht nirgends.
  const u = umgebung(agendaP1);
  u.iveo.fehler.snapshot = new IveoApiError(401, 'unauthorized', 'nope');
  const r = await u.kern.umschalten({ day: '2026-11-11' });
  ck('Tagesübersicht, Snapshot 401 → ok:false mit der 401-Meldung, nichts geschrieben, Filter unverändert',
    !r.ok && r.message === 'Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).' && u.schreibversuche === 0
    && u.kern.aktiv()?.filter.programId === 'P1' && !u.warn.some((w) => w.includes(TOKEN)));
}
{
  // Speichern der offenen Show, danach nicht lesbar: anhalten, Status melden, RELOAD trotzdem.
  const u = umgebung(agendaP1);
  u.dateien.set(SHOW_PFAD, '{ kaputt');
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  ck('7.5: gespeichert und danach nicht lesbar → Abgleich angehalten (aktiv() null), Status „Show-Datei nicht lesbar“, RELOAD trotzdem',
    u.kern.aktiv() === null && u.status.at(-1)?.text === 'Show-Datei nicht lesbar' && u.reloads.length === 3);
  await u.kern.abfrage();
  ck('… die Abfrage tut nichts', u.iveo.abrufe.length === 0);
}
{
  // Listen-Modus, gleiche Bindung gespeichert: das Abfragefenster (lastSyncIso) bleibt, es springt nicht auf syncedAt zurück.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  const snap = u.iveo.abrufe.find((x) => x.startsWith('snapshot:'))!.slice('snapshot:'.length);
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  const seit = u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).map((x) => x.slice('geaendert:'.length));
  ck('7.5: Listen-Modus, gleiche Bindung gespeichert → die nächste Abfrage fragt ab dem letzten Abgleich (nicht ab syncedAt)',
    seit.length === 2 && seit[1] === snap && seit[1] !== '2026-10-01T08:00:00.000Z');
}

// --- „Trotzdem speichern“ im Show-Editor (2026-10-02): wann kommt der iveo-Stand zurück? ---------------------------
// Messung für TEXT_SPEICHERN_DATEI_NICHT_LESBAR (renderer/src/lib/show-speichern.ts). „Trotzdem speichern“ schreibt die
// Show so, wie sie beim Öffnen des Editors war (baueGespeicherteShow mit aktuelleDatei = null, dort getestet); die Hülle
// meldet es dem Kern wie jedes Speichern der offenen Show (offeneShowGespeichert, gleiche Bindung, nicht neu gebunden).
const titel = (s: Show): string[] => (s.ablauf ?? []).map((p) => p.label);
const letztesFenster = (u: Umgebung): string =>
  u.iveo.abrufe.filter((x) => x.startsWith('geaendert:')).at(-1)!.slice('geaendert:'.length);
{
  // Listen-Modus: die Abfrage hatte eine iveo-Änderung seit dem Öffnen schon geschrieben, danach war nichts mehr offen.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  const beimOeffnen = u.dateien.get(SHOW_PFAD)!;
  u.iveo.programme[1] = { ...u.iveo.programme[1], title: 'Side Event Wasser (verlegt)' };
  u.iveo.geaendert = [u.iveo.programme[1]];
  await u.kern.abfrage();
  ck('Trotzdem/Liste: Ausgangslage — die Abfrage hat die iveo-Änderung geschrieben',
    titel(datei(u)).includes('Side Event Wasser (verlegt)') && u.schreibversuche === 1);
  const fenster = u.iveo.abrufe.find((x) => x.startsWith('snapshot:'))!.slice('snapshot:'.length);
  u.iveo.geaendert = []; // iveo meldet seit diesem Abgleich kein geändertes Programm
  u.dateien.set(SHOW_PFAD, beimOeffnen); // „Trotzdem speichern“: Stand vom Öffnen des Editors
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  ck('Trotzdem/Liste: die nächste Abfrage fragt ab dem letzten Abgleich, nicht ab syncedAt der Datei', letztesFenster(u) === fenster);
  ck('… und schreibt nichts: die iveo-Änderung bleibt überschrieben',
    u.schreibversuche === 1 && !titel(datei(u)).includes('Side Event Wasser (verlegt)'));
  // Ein anderes Programm ändert sich in iveo — sogar eines außerhalb des Tagesfilters (P4 am 11.11.).
  u.iveo.programme[3] = { ...u.iveo.programme[3], title: 'Side Event Ozean (neu)' };
  u.iveo.geaendert = [u.iveo.programme[3]];
  await u.kern.abfrage();
  ck('Trotzdem/Liste: sobald iveo irgendein geändertes Programm meldet (auch außerhalb des Filters), ist die Änderung zurück',
    titel(datei(u)).includes('Side Event Wasser (verlegt)') && u.schreibversuche === 2);
}
{
  // Listen-Modus: die Datei wurde unlesbar, bevor die Abfrage eine weitere iveo-Änderung schreiben konnte.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  const beimOeffnen = u.dateien.get(SHOW_PFAD)!;
  u.iveo.programme[1] = { ...u.iveo.programme[1], title: 'Side Event Wasser (verlegt)' };
  u.iveo.geaendert = [u.iveo.programme[1]];
  await u.kern.abfrage();
  u.dateien.set(SHOW_PFAD, '{ kaputt');
  u.iveo.programme[2] = { ...u.iveo.programme[2], title: 'Side Event Wald (neu)' };
  u.iveo.geaendert = [u.iveo.programme[2]];
  await u.kern.abfrage();
  const fenster = letztesFenster(u);
  ck('Trotzdem/Liste, Datei unlesbar: die Abfrage kann nicht schreiben, Status „Show-Datei nicht lesbar“',
    u.schreibversuche === 1 && u.status.at(-1)?.text === 'Show-Datei nicht lesbar');
  u.dateien.set(SHOW_PFAD, beimOeffnen);
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  ck('… nach „Trotzdem speichern“ fragt die nächste Abfrage im selben Fenster und schreibt beide Änderungen zurück',
    letztesFenster(u) === fenster && u.schreibversuche === 2
    && titel(datei(u)).includes('Side Event Wasser (verlegt)') && titel(datei(u)).includes('Side Event Wald (neu)'));
}
{
  // Side Event im Detail (Agenda-Modus): die Agenda wird bei jeder Abfrage geholt.
  const u = umgebung(agendaP1);
  const beimOeffnen = u.dateien.get(SHOW_PFAD)!;
  u.iveo.agenda.P1 = [...u.iveo.agenda.P1, punkt('P1', 'a4', 'Schlusswort', 4, 5)];
  await u.kern.abfrage();
  ck('Trotzdem/Side Event: Ausgangslage — die Abfrage hat den neuen Agenda-Punkt geschrieben', ids(datei(u)) === 'a1,a2,a3,a4');
  u.dateien.set(SHOW_PFAD, beimOeffnen);
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  await u.kern.abfrage();
  ck('Trotzdem/Side Event: die nächste Abfrage schreibt den iveo-Stand zurück', ids(datei(u)) === 'a1,a2,a3,a4' && u.schreibversuche === 2);
}
// Nachbesserung (Prüfer): Live-Umschaltung seit dem Öffnen des Editors, dann „Trotzdem speichern“. Der Stand vom Öffnen
// enthält den Filter (die damalige Side-Event-Auswahl); der Kern übernimmt ihn aus der Datei (setzeAuf). Der Text sagt
// darum „auch die Side-Event-Auswahl von damals“ — die Umschaltung kommt nicht von selbst zurück.
{
  // Editor geöffnet mit Side Event P1, danach live auf P2 umgeschaltet (Panel oder LAUNCHER SIDEEVENT).
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  const beimOeffnen = u.dateien.get(SHOW_PFAD)!;
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Trotzdem/Umschaltung: Ausgangslage — P2 live geschaltet und geschrieben',
    r.ok && datei(u).iveo?.filter?.programId === 'P2' && ids(datei(u)) === 'b1,b2');
  u.dateien.set(SHOW_PFAD, beimOeffnen); // „Trotzdem speichern“: Stand vom Öffnen des Editors
  const reloadsVorher = u.reloads.length;
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  ck('Trotzdem/Umschaltung: der Kern übernimmt die Auswahl von damals (P1) und schickt RELOAD an Timer, Titler, Rundown',
    u.kern.aktiv()?.filter.programId === 'P1' && u.reloads.length - reloadsVorher === 3);
  u.iveo.agenda.P1 = [...u.iveo.agenda.P1, punkt('P1', 'a4', 'Schlusswort', 4, 5)];
  for (let i = 0; i < 3; i++) await u.kern.abfrage();
  ck('… iveo-Änderungen dieser Auswahl kommen mit der nächsten Abfrage zurück, P2 kommt nicht von selbst zurück',
    datei(u).iveo?.filter?.programId === 'P1' && ids(datei(u)) === 'a1,a2,a3,a4');
}
{
  // Editor geöffnet mit der Tagesliste, danach live auf Side Event P2 umgeschaltet.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  const beimOeffnen = u.dateien.get(SHOW_PFAD)!;
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Trotzdem/Umschaltung, Liste: Ausgangslage — P2 live geschaltet', r.ok && datei(u).iveo?.filter?.programId === 'P2');
  u.dateien.set(SHOW_PFAD, beimOeffnen);
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  u.iveo.programme[3] = { ...u.iveo.programme[3], title: 'Side Event Ozean (neu)' };
  u.iveo.geaendert = [u.iveo.programme[3]];
  await u.kern.abfrage();
  await u.kern.abfrage();
  ck('Trotzdem/Umschaltung, Liste: zurück auf der Tagesliste von damals, P2 kommt nicht von selbst zurück',
    u.kern.aktiv()?.filter.programId === undefined && !datei(u).iveo?.filter?.programId && datei(u).iveo?.filter?.day === TAG);
}

// --- Teil 2b, Spec 6.2: „Verantwortlich“ aus der Datei (reine Helfer) --------------------------------------------
{
  const namen = speakerNamenAusDatei([
    { id: 'sp1', name: 'Ana Silva' },
    { name: 'Ohne Kennung' },
    { id: 'sp2', name: 'Bo Berg', title: 'Moderation' },
  ]);
  ck('speakerNamenAusDatei: nur Speaker mit Kennung, Kennung → Name', JSON.stringify([...namen]) === '[["sp1","Ana Silva"],["sp2","Bo Berg"]]');
  ck('speakerNamenAusDatei: leere Liste → leere Map', speakerNamenAusDatei([]).size === 0);
  const neu: ShowAblaufItem[] = [
    { id: 'P1', label: 'A', owner: 'Ana Silva' },
    { id: 'P2', label: 'B', owner: 'Ana Silva' },
    { id: 'P5', label: 'Neu', owner: 'Ana Silva' },
    { label: 'Ohne Kennung', owner: 'X' },
  ];
  const ausDatei: ShowAblaufItem[] = [{ id: 'P1', label: 'A', owner: 'Dr. Ana Silva (Datei)' }, { id: 'P2', label: 'B' }];
  const r = uebernimmOwnerAusDatei(neu, ausDatei);
  ck('uebernimmOwnerAusDatei: Gegenstück gleicher Kennung → dessen owner', r[0].owner === 'Dr. Ana Silva (Datei)');
  ck('uebernimmOwnerAusDatei: Gegenstück ohne owner → owner entfällt', r[1].id === 'P2' && !('owner' in r[1]));
  ck('uebernimmOwnerAusDatei: neuer Punkt und Punkt ohne Kennung bleiben unverändert', r[2] === neu[2] && r[3] === neu[3]);
  ck('uebernimmOwnerAusDatei: die Eingabe bleibt unverändert', neu[0].owner === 'Ana Silva' && neu[1].owner === 'Ana Silva');
  ck('uebernimmOwnerAusDatei: ein Punkt ohne owner bekommt den der Datei',
    uebernimmOwnerAusDatei([{ id: 'P1', label: 'A' }], ausDatei)[0].owner === 'Dr. Ana Silva (Datei)');
}

// --- Teil 2b, 9.2 Nr. 3, 4, 6, 7, 9: Speakerliste nicht abrufbar ist nicht „0 Speaker“ (Spec 6.2, 6.3) -------------
/** Listen-Show: P1 verknüpft sp1; in der Datei trägt P1 ein eigenes „Verantwortlich“. */
function listenShowMitOwner(iv: NachgebautesIveo): Show {
  iv.programme[0] = { ...iv.programme[0], speaker_ids: ['sp1'] } as IveoProgram;
  const ablauf = listenAblauf(iv, TAG).map((p) => (p.id === 'P1' ? { ...p, owner: 'Dr. Ana Silva (Datei)' } : p));
  return showMit(ablauf, { day: TAG }, [ANA]);
}
/** Neues Programm am selben Tag, mit sp1 verknüpft. */
const P5 = (): IveoProgram =>
  programm('P5', 'Side Event Boden', { starts_at: `${TAG}T15:00:00+00:00`, starts_at_local: `${TAG}T16:00:00`, speaker_ids: ['sp1'] });
const ownerVon = (s: Show, id: string): string | undefined => s.ablauf?.find((p) => p.id === id)?.owner;
const speakerWarnungen = (u: Umgebung): string[] => u.warn.filter((w) => w.startsWith('iveo: Speakerliste nicht abrufbar'));
{
  // Nr. 3: /speakers scheitert im Listen-Modus, eine Programmänderung liegt vor.
  const u = umgebung(listenShowMitOwner);
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  u.iveo.programme.push(P5());
  u.iveo.geaendert = [u.iveo.programme[4]];
  await u.kern.abfrage();
  const d1 = datei(u);
  const merker = d1.iveo?.speakerVeraltetSeit;
  ck('Nr. 3: /speakers scheitert, Programmänderung → die Speaker der Datei bleiben', JSON.stringify(d1.iveo?.speakers) === JSON.stringify([ANA]));
  ck('Nr. 3: … jeder Punkt behält seinen owner aus der Datei', ownerVon(d1, 'P1') === 'Dr. Ana Silva (Datei)');
  ck('Nr. 3: … ein neuer Punkt bekommt owner aus den Speakern der Datei (M1 = nein: ohne Kennung keinen)',
    ids(d1) === 'P1,P2,P3,P5' && ownerVon(d1, 'P5') === (MIT_KENNUNG ? 'Ana Silva' : undefined));
  ck('Nr. 3: … der Merker steht in der Datei', typeof merker === 'string' && !Number.isNaN(Date.parse(merker)));
  ck('Nr. 3: … Status „gestört“ mit dem Text aus 6.3, „seit“ = Merker',
    JSON.stringify(u.status.at(-1)) === JSON.stringify({ ok: false, text: TEXT_SPEAKER_VERALTET, seit: merker }));
  ck('Nr. 3: … genau einmal geschrieben, genau ein RELOAD-Satz', u.schreibversuche === 1 && u.reloads.length === 3);
  ck('Nr. 3: … Warnung aus 6.3 im Log, mit dem Fehlertext',
    JSON.stringify(speakerWarnungen(u)) === JSON.stringify(['iveo: Speakerliste nicht abrufbar (kaputt), Speaker aus der Datei bleiben.']));
  ck('Nr. 3: … das Token steht nirgends', ![...u.info, ...u.warn].some((z) => z.includes(TOKEN)) && !JSON.stringify(u.status).includes(TOKEN));

  // Nr. 4: keine Programmänderung, /speakers scheitert weiter.
  u.iveo.geaendert = [];
  const vorher = u.iveo.abrufe.length;
  await u.kern.abfrage();
  ck('Nr. 4: Merker gilt, keine Programmänderung → der Snapshot wird trotzdem geholt',
    u.iveo.abrufe.slice(vorher).some((x) => x.startsWith('snapshot:')));
  ck('Nr. 4: … Fehler bleibt → nichts geschrieben, kein RELOAD, Merker unverändert, keine zweite Warnung',
    u.schreibversuche === 1 && u.reloads.length === 3 && datei(u).iveo?.speakerVeraltetSeit === merker && speakerWarnungen(u).length === 1);
  ck('Nr. 4: … Status bleibt „gestört“', u.status.at(-1)?.ok === false && u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET);

  // Nr. 4: die Liste kommt wieder.
  delete u.iveo.fehler.speakers;
  await u.kern.abfrage();
  ck('Nr. 4: Liste gelingt → Merker weg, geschrieben, RELOAD',
    datei(u).iveo?.speakerVeraltetSeit === undefined && u.schreibversuche === 2 && u.reloads.length === 6);
  ck('Nr. 4: … Status „in Ordnung“, Info-Zeile aus 6.3',
    u.status.at(-1)?.ok === true && u.info.includes('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.'));
  ck('Nr. 4: … „Verantwortlich“ wieder aus iveo', ownerVon(datei(u), 'P1') === 'Ana Silva');
  const danach = u.iveo.abrufe.length;
  await u.kern.abfrage();
  ck('Nr. 4: … ohne Merker und ohne Programmänderung kein Snapshot mehr', !u.iveo.abrufe.slice(danach).some((x) => x.startsWith('snapshot:')));
}
{
  // Nr. 6: Umschalten auf die Tagesübersicht, die Speakerliste scheitert.
  const u = umgebung(listenShowMitOwner);
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  const r = await u.kern.umschalten({ day: TAG });
  const m = datei(u).iveo?.speakerVeraltetSeit;
  ck('Nr. 6: Tagesübersicht mit gescheiterter Speakerliste → Meldung aus 6.3',
    r.ok && r.message === 'Umgeschaltet — Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.');
  ck('Nr. 6: … Speaker und owner aus der Datei, Merker gesetzt',
    JSON.stringify(datei(u).iveo?.speakers) === JSON.stringify([ANA]) && ownerVon(datei(u), 'P1') === 'Dr. Ana Silva (Datei)' && typeof m === 'string');
  ck('Nr. 6: … Status „gestört“ mit dem Merker als „seit“, Warnung im Log',
    u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === m && speakerWarnungen(u).length === 1);
  delete u.iveo.fehler.speakers;
  const r2 = await u.kern.umschalten({ day: TAG });
  ck('Nr. 6: danach gelingt die Liste → Meldung wie bisher, Merker weg, Status „in Ordnung“',
    r2.ok && r2.message === 'Umgeschaltet (3 Punkte).' && datei(u).iveo?.speakerVeraltetSeit === undefined && u.status.at(-1)?.ok === true);
}
{
  // Nr. 7: iveo meldet erfolgreich 0 Speaker → wie bisher.
  const u = umgebung((iv) => showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA]));
  u.iveo.speakers = [];
  u.iveo.geaendert = [u.iveo.programme[0]];
  await u.kern.abfrage();
  ck('Nr. 7: iveo meldet erfolgreich 0 Speaker → Feld fehlt in der Datei, kein Merker',
    u.schreibversuche === 1 && datei(u).iveo?.speakers === undefined && datei(u).iveo?.speakerVeraltetSeit === undefined);
  ck('Nr. 7: … Status bleibt „in Ordnung“, keine Speaker-Warnung', u.status.length === 0 && speakerWarnungen(u).length === 0);
}
{
  // Nr. 9: Öffnen einer Show mit Merker → die erste Listen-Abfrage holt den Snapshot, auch ohne Programmänderung.
  const u = umgebung((iv) => mitMerker(showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA])));
  await u.kern.abfrage();
  ck('Nr. 9: Show mit Merker geöffnet, keine Programmänderung → die erste Abfrage holt den Snapshot',
    u.iveo.abrufe.some((x) => x.startsWith('snapshot:')));
  ck('Nr. 9: … die Liste gelingt → Merker weg, geschrieben, RELOAD',
    datei(u).iveo?.speakerVeraltetSeit === undefined && u.schreibversuche === 1 && u.reloads.length === 3);
}

{
  // Fix-Runde 1: Die Statuszeile folgt dem Merker auch beim Öffnen und beim Speichern der offenen Show (Spec 6.2/6.3).
  const u = umgebung((iv) => mitMerker(showMit(listenAblauf(iv, TAG), { day: TAG }, [ANA])));
  ck('Fix 1a: Show mit Merker geöffnet → Status sofort „gestört“, seit = Merker',
    JSON.stringify(u.status.at(-1)) === JSON.stringify({ ok: false, text: TEXT_SPEAKER_VERALTET, seit: MERKER }));
  const statusVorher = u.status.length;
  const infoVorher = u.info.length;
  const warnVorher = u.warn.length;
  u.kern.offeneShowGespeichert(SHOW_PFAD, false);
  ck('Fix 1b: Speichern der offenen Show mit unverändertem Merker → kein neues Status-Ereignis',
    u.status.length === statusVorher);
  ck('Fix 1b: … kein „wieder in Ordnung“ im Log, keine zweite Warnung',
    !u.info.slice(infoVorher).some((z) => z.includes('wieder in Ordnung')) && u.warn.length === warnVorher);
}

// --- Teil 2b, 9.2 Nr. 5 und Spec 6.2: Agenda-Abfrage mit Merker, Umschalten auf ein Side Event ---------------------
/** Zweiter Speaker im nachgebauten iveo. */
const BO: IveoSpeaker = { id: 'sp2', event_id: 'ev-1', first_name: 'Bo', last_name: 'Berg', title: 'Moderation' };
/** Speaker-Namen der Datei, sortiert: so gilt der Test mit und ohne Zusatz Sortierung (Spec 23, M3). */
const namenIn = (s: Show): string => JSON.stringify((s.iveo?.speakers ?? []).map((sp) => sp.name).sort());
{
  // Nr. 5: Show auf Side Event P1 (ohne Speaker-Verknüpfung) mit Merker in der Datei.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  await u.kern.abfrage();
  ck('Nr. 5 (a): Merker, Kontext fehlt, Speakerliste scheitert → Abbruch wie in 2a: nichts geschrieben, Status gestört, Merker bleibt',
    u.schreibversuche === 0 && u.reloads.length === 0 && u.status.at(-1)?.ok === false && datei(u).iveo?.speakerVeraltetSeit === MERKER);

  const r = await u.kern.umschalten({ programId: 'P1' });
  ck('Nr. 5 (b): Umschalten auf P1 ohne Verknüpfung → keine Speakerliste geholt, Merker unverändert',
    r.ok && u.iveo.abrufe.filter((x) => x === 'speakers:').length === 1 && datei(u).iveo?.speakerVeraltetSeit === MERKER);
  ck('Nr. 5 (b): … Status „gestört“ mit dem Text aus 6.3', u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === MERKER);

  const vorher = u.iveo.abrufe.length;
  await u.kern.abfrage();
  const neu = u.iveo.abrufe.slice(vorher);
  ck('Nr. 5 (c): Kontext gemerkt → kein Detail-Abruf, aber die Speakerliste wird zusätzlich geholt',
    neu.includes('speakers:') && !neu.includes('programm:P1'));
  ck('Nr. 5 (c): … sie scheitert → Status bleibt „gestört“ (Text aus 6.3, „seit“ = Merker), Merker bleibt, nichts geschrieben',
    u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === MERKER
    && datei(u).iveo?.speakerVeraltetSeit === MERKER && u.schreibversuche === 1);
  ck('Nr. 5 (c): … Warnung aus 6.3 im Log', u.warn.includes('iveo: Speakerliste nicht abrufbar (kaputt), Speaker aus der Datei bleiben.'));

  delete u.iveo.fehler.speakers;
  u.iveo.speakers.push(BO);
  await u.kern.abfrage();
  ck('Nr. 5 (d): Liste gelingt, Side Event ohne Verknüpfung → die ganze Liste geschrieben, Merker weg, RELOAD',
    namenIn(datei(u)) === '["Ana Silva","Bo Berg"]' && datei(u).iveo?.speakerVeraltetSeit === undefined
    && u.schreibversuche === 2 && u.reloads.length === 6);
  ck('Nr. 5 (d): … Status „in Ordnung“, Info-Zeile aus 6.3',
    u.status.at(-1)?.ok === true && u.info.includes('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.'));
  const danach = u.iveo.abrufe.length;
  await u.kern.abfrage();
  ck('Nr. 5 (d): … ohne Merker holt die Agenda-Abfrage keine Speakerliste mehr, nichts geschrieben',
    !u.iveo.abrufe.slice(danach).includes('speakers:') && u.schreibversuche === 2);
}
{
  // Nr. 5 (e): Ein Agenda-Punkt von P2 verknüpft sp2 → nur die verknüpften Speaker.
  const u = umgebung((iv) => {
    iv.speakers.push(BO);
    iv.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp2'] } as IveoAgendaItem, punkt('P2', 'b2', 'Diskussion', 2, 30)];
    return mitMerker(showMit(agendaAblauf(iv, 'P2'), { day: TAG, programId: 'P2' }, [ANA]));
  });
  await u.kern.abfrage();
  ck('Nr. 5 (e): Agenda-Punkt verknüpft sp2 → nur dieser Speaker geschrieben, Merker weg, RELOAD',
    namenIn(datei(u)) === '["Bo Berg"]' && datei(u).iveo?.speakerVeraltetSeit === undefined && u.reloads.length === 3);
}
{
  // Nr. 5 (f): Die Verknüpfung steht nur im Programm-Detail, nicht an den Agenda-Punkten → sie zählt ebenso.
  const u = umgebung((iv) => {
    iv.speakers.push(BO);
    iv.programme[1] = { ...iv.programme[1], speaker_ids: ['sp2'] } as IveoProgram;
    return mitMerker(showMit(agendaAblauf(iv, 'P2'), { day: TAG, programId: 'P2' }, [ANA]));
  });
  await u.kern.abfrage();
  ck('Nr. 5 (f): Verknüpfung nur im Programm-Detail → nur dieser Speaker geschrieben, Merker weg',
    namenIn(datei(u)) === '["Bo Berg"]' && datei(u).iveo?.speakerVeraltetSeit === undefined);
}
{
  // Umschalten auf ein verknüpftes Side Event, die Speakerliste gelingt → Merker weg.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  u.iveo.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp1'] } as IveoAgendaItem];
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten (2b): verknüpftes Side Event, Speakerliste gelingt → Merker weg, Info-Zeile, Status in Ordnung',
    r.ok && datei(u).iveo?.speakerVeraltetSeit === undefined
    && u.info.includes('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.') && u.status.at(-1)?.ok === true);
}
{
  // … die Speakerliste scheitert → Merker gesetzt, Status gestört, Antwort wie bisher.
  const u = umgebung((iv) => showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA]));
  u.iveo.agenda.P2 = [{ ...punkt('P2', 'b1', 'Einführung', 1), speaker_ids: ['sp1'] } as IveoAgendaItem];
  u.iveo.fehler.speakers = new IveoApiError(500, 'server_error', 'kaputt');
  const r = await u.kern.umschalten({ programId: 'P2' });
  const m = datei(u).iveo?.speakerVeraltetSeit;
  ck('Umschalten (2b): Speakerliste scheitert → Merker gesetzt, Speaker der Datei bleiben',
    r.ok && typeof m === 'string' && JSON.stringify(datei(u).iveo?.speakers) === JSON.stringify([ANA]));
  ck('Umschalten (2b): … Status „gestört“ mit dem Merker als „seit“, Antwort wie bisher',
    u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET && u.status.at(-1)?.seit === m && r.message === 'Umgeschaltet (1 Punkte).');
}
{
  // … ohne Verknüpfung → keine Speakerliste, Merker unverändert, Status bleibt gestört.
  const u = umgebung((iv) => mitMerker(showMit(agendaAblauf(iv, 'P1'), { day: TAG, programId: 'P1' }, [ANA])));
  const r = await u.kern.umschalten({ programId: 'P2' });
  ck('Umschalten (2b): ohne Verknüpfung → keine Speakerliste geholt, Merker unverändert, Status „gestört“',
    r.ok && !u.iveo.abrufe.includes('speakers:') && datei(u).iveo?.speakerVeraltetSeit === MERKER
    && u.status.at(-1)?.text === TEXT_SPEAKER_VERALTET);
}

// --- Zusammenfassung ---
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
