// ─────────────────────────────────────────────────────────────────────────────
// @jm/iveo — Mapper: iveo-Daten → Suite-Formen.
//
// Zielform ist der zentrale Show-Ablauf `ShowAblaufItem {label, durationMs?, note?}`
// (@jm/show) — identisch zu einem Timer-`TimetableItem` und einer @jm/regieplan-
// `ParsedRow`. Damit ist ein iveo-Import DERSELBE Datenweg wie der XLSX-Import.
//
// Datensparsamkeit: `buildShowMetadata` ist die Allowlist dessen, was in Cache/
// Show/Renderer landet — bewusst OHNE Bio/Fotos/Social-Links und ohne Secrets.
// ─────────────────────────────────────────────────────────────────────────────

import type { ShowAblaufItem, ShowIveoSpeaker } from '@jm/show';
import type {
  IveoAgendaItem,
  IveoProgram,
  IveoSnapshot,
  IveoSpeaker,
  IveoStage,
  IveoShowMetadata,
} from './types';

const MIN_PER_MS = 60_000;

/**
 * Beste Dauer in ms für ein Programm: `duration_minutes` bevorzugt, sonst aus
 * `ends_at - starts_at`, sonst 0 (unbekannt).
 */
export function durationMsOf(p: IveoProgram): number {
  if (typeof p.duration_minutes === 'number' && p.duration_minutes > 0) {
    return Math.round(p.duration_minutes * MIN_PER_MS);
  }
  if (p.starts_at && p.ends_at) {
    const start = Date.parse(p.starts_at);
    const end = Date.parse(p.ends_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) return end - start;
  }
  return 0;
}

/** Sortier-Schlüssel nach Startzeit (Programme ohne Startzeit ans Ende). */
function startKey(p: IveoProgram): number {
  const t = p.starts_at ? Date.parse(p.starts_at) : NaN;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/**
 * Kalendertag eines Programms (YYYY-MM-DD) aus der lokalen Venue-Zeit bevorzugt,
 * sonst UTC. Leer, wenn das Programm keine Startzeit hat (Entwurf ohne Termin).
 * Wichtigste Filter-Achse: iveo-Events liefern oft den GESAMTEN Mehrtages-Plan;
 * eine Live-Show läuft aber pro Tag.
 */
export function programDayKey(p: IveoProgram): string {
  const s = (p.starts_at_local || p.starts_at || '').trim();
  return s ? s.slice(0, 10) : '';
}

/**
 * Startzeit als ms seit LOKALER Mitternacht (Zeitzone der ausführenden Maschine) —
 * dieselbe Semantik wie `midnightMsLocal` im Timer, damit die Soll/Ist-Drift stimmt.
 * Primär `starts_at` (UTC mit Offset): eindeutig parsebar, `getHours()` liefert die
 * maschinen-lokale Zeit. Fallback `starts_at_local` (Venue-Wanduhr ohne Offset) —
 * Best-Effort, stimmt nur bei gleicher Zeitzone. Sonst null.
 */
export function localTimeOfDayMs(
  p: { starts_at?: string | null; starts_at_local?: string | null },
): number | null {
  const utc = (p.starts_at || '').trim();
  if (utc) {
    const t = Date.parse(utc);
    if (Number.isFinite(t)) {
      const d = new Date(t);
      return (d.getHours() * 60 + d.getMinutes()) * 60_000 + d.getSeconds() * 1000;
    }
  }
  const local = (p.starts_at_local || '').trim();
  const m = local.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] ?? '0');
    if (h <= 23 && min <= 59 && sec <= 59) return (h * 60 + min) * 60_000 + sec * 1000;
  }
  return null;
}

/**
 * Anzeigename(n) verknüpfter Speaker als „Verantwortlich". Ohne Verknüpfung oder
 * ohne Namensauflösung leer (undefined) — iveo v1 liefert die Verknüpfung oft nicht,
 * das ist ausdrücklich kein Fehler.
 */
function ownerFromIds(source: unknown, namesById?: Map<string, string>): string | undefined {
  if (!namesById || namesById.size === 0) return undefined;
  const names = extractSpeakerIds(source)
    .map((id) => namesById.get(id))
    .filter((n): n is string => !!n && n.trim().length > 0);
  return names.length ? names.join(' · ') : undefined;
}

/**
 * Heuristik für „Blocker"/Platzhalter-Einträge (kein echtes Programm), z. B.
 * „Blocker | Nov 17…", „Blocker Livestream …". Rein titelbasiert und bewusst
 * konservativ — nur damit der Operator sie optional aus dem Ablauf nehmen kann.
 */
export function isBlockerProgram(p: IveoProgram): boolean {
  return /\bblocker\b/i.test(p.title || '');
}

export interface ProgramMapOptions {
  /** Stage-Namen als Notiz ergänzen (aus einer stageId→Stage-Map). */
  stagesById?: Map<string, IveoStage>;
  /** Subtitle als Notiz nutzen, falls vorhanden (Default true). */
  includeSubtitle?: boolean;
  /**
   * Startzeit/Kategorie/Verantwortlich mit befüllen (#11 Sub-B). Default false →
   * Verhalten bestehender Aufrufer unverändert.
   */
  withSchedule?: boolean;
  /** id → Anzeigename, zur Auflösung verknüpfter Speaker (für `owner`). */
  speakerNamesById?: Map<string, string>;
}

function noteFor(p: IveoProgram, opts: ProgramMapOptions): string | undefined {
  const parts: string[] = [];
  if ((opts.includeSubtitle ?? true) && p.subtitle) parts.push(p.subtitle);
  if (p.stage_id && opts.stagesById) {
    const stage = opts.stagesById.get(p.stage_id);
    if (stage?.name) parts.push(stage.name);
  }
  const note = parts.join(' · ').trim();
  return note || undefined;
}

/** Ein Programm → ein Ablauf-Punkt. */
export function programToAblaufItem(p: IveoProgram, opts: ProgramMapOptions = {}): ShowAblaufItem {
  const item: ShowAblaufItem = { label: p.title?.trim() || '(ohne Titel)' };
  const durationMs = durationMsOf(p);
  if (durationMs > 0) item.durationMs = durationMs;
  const note = noteFor(p, opts);
  if (note) item.note = note;
  if (opts.withSchedule) {
    const startMs = localTimeOfDayMs(p);
    if (startMs !== null) item.plannedStartMs = startMs;
    const category = (p.format_slug || p.type_slug || '').trim();
    if (category) item.category = category;
    const owner = ownerFromIds(p, opts.speakerNamesById);
    if (owner) item.owner = owner;
  }
  return item;
}

/** Programme → zentraler Ablauf (nach Startzeit sortiert). */
export function programsToAblauf(
  programs: IveoProgram[],
  opts: ProgramMapOptions = {},
): ShowAblaufItem[] {
  return [...programs].sort((a, b) => startKey(a) - startKey(b)).map((p) => programToAblaufItem(p, opts));
}

/** Options für den Agenda-Pfad (#11 Sub-B). */
export interface AgendaMapOptions {
  /**
   * Soll-Startzeit des ERSTEN Punktes (ms seit lokaler Mitternacht) — Anker der
   * Kette. Die Folgepunkte bleiben leer; ihre Zeiten rechnet der Timer aus den
   * Dauern (computePlannedSchedule), damit die Kettenlogik nur einmal existiert.
   */
  firstStartMs?: number | null;
  /** Kategorie, die alle Punkte des Side Events erben. */
  category?: string;
  /** id → Anzeigename, zur Auflösung verknüpfter Speaker je Agenda-Punkt. */
  speakerNamesById?: Map<string, string>;
}

/**
 * Agenda-Punkte EINES Programms → zentraler Ablauf (#11 Phase 3b): der Feinablauf
 * eines Side Events (Begrüßung/Panel/Q&A …). Nach `sort_order` sortiert; Dauer aus
 * `duration_minutes`, Notiz aus `notes`. Mit Options zusätzlich Startzeit-Anker,
 * geerbte Kategorie und Verantwortlich (#11 Sub-B).
 */
export function agendaToAblauf(items: IveoAgendaItem[], opts: AgendaMapOptions = {}): ShowAblaufItem[] {
  const category = (opts.category || '').trim();
  return [...items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it, idx) => {
      const item: ShowAblaufItem = { label: it.title?.trim() || '(ohne Titel)' };
      if (typeof it.duration_minutes === 'number' && it.duration_minutes > 0) {
        item.durationMs = Math.round(it.duration_minutes * MIN_PER_MS);
      }
      const note = (it.notes || '').trim();
      if (note) item.note = note;
      if (idx === 0 && typeof opts.firstStartMs === 'number') item.plannedStartMs = opts.firstStartMs;
      if (category) item.category = category;
      const owner = ownerFromIds(it, opts.speakerNamesById);
      if (owner) item.owner = owner;
      return item;
    });
}

/**
 * Speaker-IDs, die an einem Programm hängen, robust aus einem (Detail-)Programm
 * ziehen (#11 Phase 3b). Laut iveo Entity-Map (v1) existiert der DB-Join
 * `program_speakers` (role_on_program, speaking_time), wird aber über die API v1
 * NICHT ausgeliefert. Ergänzt iveo das später, ist die Feldform unbekannt — daher
 * tolerant: `speaker_ids`, `speakers`/`program_speakers` als (string|{id|uuid|
 * speaker_id})[] und `speaker_id`. Fehlend → leeres Array (kein Fehler).
 */
export function extractSpeakerIds(program: unknown): string[] {
  if (!program || typeof program !== 'object') return [];
  const o = program as Record<string, unknown>;
  const out = new Set<string>();
  const pushId = (v: unknown): void => {
    if (typeof v === 'string' && v.trim()) out.add(v.trim());
    else if (v && typeof v === 'object') {
      const r = v as Record<string, unknown>;
      const id = r.id ?? r.uuid ?? r.speaker_id;
      if (typeof id === 'string' && id.trim()) out.add(id.trim());
    }
  };
  for (const key of ['speaker_ids', 'speakerIds', 'speakers', 'program_speakers', 'speaker_id']) {
    const val = o[key];
    if (Array.isArray(val)) val.forEach(pushId);
    else if (val != null) pushId(val);
  }
  return [...out];
}

/**
 * Ablauf-Filter (#11): welche Programme in den Ablauf übernommen werden. Alle
 * Kriterien sind UND-verknüpft; leere Kriterien lassen alles durch.
 */
export interface IveoProgramFilter {
  typeSlug?: string;
  formatSlug?: string;
  /** Nur Programme dieses Kalendertags (YYYY-MM-DD, lokale Venue-Zeit). */
  day?: string;
  /** „Blocker"/Platzhalter-Einträge weglassen. */
  excludeBlockers?: boolean;
  /**
   * Ein einzelnes Side Event „im Detail" (#11 Phase 3b): der Ablauf wird dann NICHT
   * aus der Programmliste, sondern aus den Agenda-Punkten dieses Programms gebildet
   * und die Speaker auf dieses Programm eingegrenzt. Von `filterPrograms` ignoriert
   * (dort geht es nur um die Programm-Auswahl der Liste) — die Agenda-Auflösung
   * passiert im Launcher (bind/poll).
   */
  programId?: string;
}

/** Programme nach Typ/Format/Tag filtern + optional Blocker weglassen. */
export function filterPrograms(programs: IveoProgram[], filter: IveoProgramFilter = {}): IveoProgram[] {
  const type = (filter.typeSlug || '').trim();
  const format = (filter.formatSlug || '').trim();
  const day = (filter.day || '').trim();
  const excludeBlockers = !!filter.excludeBlockers;
  return programs.filter(
    (p) =>
      (!type || (p.type_slug || '') === type) &&
      (!format || (p.format_slug || '') === format) &&
      (!day || programDayKey(p) === day) &&
      (!excludeBlockers || !isBlockerProgram(p)),
  );
}

/** Verteilung der Programmtypen/-formate/-tage (für die Filter-Auswahl im Show-Editor). */
export interface IveoProgramTaxonomy {
  types: Array<{ value: string; count: number }>;
  formats: Array<{ value: string; count: number }>;
  /** Kalendertage mit Anzahl (chronologisch); Basis fürs „nur dieser Tag"-Filter. */
  days: Array<{ value: string; count: number }>;
  /** Wie viele Programme als „Blocker"/Platzhalter erkannt wurden. */
  blockerCount: number;
}

export function programTaxonomy(programs: IveoProgram[]): IveoProgramTaxonomy {
  const tally = (get: (p: IveoProgram) => string | null | undefined): Array<{ value: string; count: number }> => {
    const m = new Map<string, number>();
    for (const p of programs) {
      const v = (get(p) || '').trim();
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  // Tage chronologisch (nicht nach Häufigkeit) — der Operator denkt in Datums-Reihenfolge.
  const dayMap = new Map<string, number>();
  for (const p of programs) {
    const d = programDayKey(p);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const days = [...dayMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
  const blockerCount = programs.reduce((n, p) => n + (isBlockerProgram(p) ? 1 : 0), 0);
  return { types: tally((p) => p.type_slug), formats: tally((p) => p.format_slug), days, blockerCount };
}

/** Bequemer Ablauf aus einem ganzen Snapshot (nutzt Stages für Notizen). */
export function snapshotToAblauf(snap: IveoSnapshot): ShowAblaufItem[] {
  const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
  return programsToAblauf(snap.programs, { stagesById });
}

/** Voller Sprecher-Name (Anrede + Vor- + Nachname), robust getrimmt. */
export function speakerName(s: IveoSpeaker): string {
  return [s.salutation, s.first_name, s.last_name].map((x) => (x || '').trim()).filter(Boolean).join(' ');
}

/**
 * Rohe Speaker → sanitisierte Show-Speaker (#11, Phase 3): nur Anzeigename +
 * Funktion (Titel). KEINE PII (Bio/Foto/Social) und kein Token — darf in die
 * portable .jmshow und speist die Titler-DataLink/Recall-Einträge. Speaker ohne
 * Namen werden ausgelassen.
 */
export function speakersToShowSpeakers(speakers: IveoSpeaker[]): ShowIveoSpeaker[] {
  return speakers
    .map((s): ShowIveoSpeaker => {
      const speaker: ShowIveoSpeaker = { name: speakerName(s) };
      if (s.title && s.title.trim()) speaker.title = s.title.trim();
      return speaker;
    })
    .filter((s) => s.name.length > 0);
}

/** Wie `speakersToShowSpeakers`, aber für den ganzen Snapshot (alle Speaker). */
export function snapshotToShowSpeakers(snap: IveoSnapshot): ShowIveoSpeaker[] {
  return speakersToShowSpeakers(snap.speakers);
}

/**
 * Snapshot → sanitisierte, feld-allowlistete Metadaten für Cache/Show/Renderer.
 * KEIN Token, KEINE Bio/Fotos/Social-Links. `baseUrl` ist kein Secret.
 */
export function buildShowMetadata(snap: IveoSnapshot, baseUrl: string): IveoShowMetadata {
  return {
    eventId: snap.event.id,
    slug: snap.event.slug,
    name: snap.event.name,
    timezone: snap.event.timezone ?? null,
    startsAt: snap.event.starts_at ?? null,
    endsAt: snap.event.ends_at ?? null,
    baseUrl,
    programs: [...snap.programs]
      .sort((a, b) => startKey(a) - startKey(b))
      .map((p) => ({
        id: p.id,
        title: p.title?.trim() || '(ohne Titel)',
        subtitle: p.subtitle ?? null,
        stageId: p.stage_id ?? null,
        startsAt: p.starts_at ?? null,
        startsAtLocal: p.starts_at_local ?? null,
        durationMs: durationMsOf(p),
      })),
    stages: snap.stages.map((s) => ({ id: s.id, name: s.name, color: s.color ?? null })),
    speakers: snap.speakers.map((s) => ({ id: s.id, name: speakerName(s), title: s.title ?? null })),
    fetchedAt: snap.fetchedAt,
  };
}
