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

export interface ProgramMapOptions {
  /** Stage-Namen als Notiz ergänzen (aus einer stageId→Stage-Map). */
  stagesById?: Map<string, IveoStage>;
  /** Subtitle als Notiz nutzen, falls vorhanden (Default true). */
  includeSubtitle?: boolean;
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
  return item;
}

/** Programme → zentraler Ablauf (nach Startzeit sortiert). */
export function programsToAblauf(
  programs: IveoProgram[],
  opts: ProgramMapOptions = {},
): ShowAblaufItem[] {
  return [...programs].sort((a, b) => startKey(a) - startKey(b)).map((p) => programToAblaufItem(p, opts));
}

/** Filter auf Programmtyp/-format (#11): z. B. nur „Side Events". Leer = alle. */
export interface IveoProgramFilter {
  typeSlug?: string;
  formatSlug?: string;
}

/** Programme nach type_slug/format_slug filtern (leere Kriterien lassen alle durch). */
export function filterPrograms(programs: IveoProgram[], filter: IveoProgramFilter = {}): IveoProgram[] {
  const type = (filter.typeSlug || '').trim();
  const format = (filter.formatSlug || '').trim();
  return programs.filter(
    (p) => (!type || (p.type_slug || '') === type) && (!format || (p.format_slug || '') === format),
  );
}

/** Verteilung der Programmtypen/-formate (für den Filter-Auswahl im Show-Editor). */
export interface IveoProgramTaxonomy {
  types: Array<{ value: string; count: number }>;
  formats: Array<{ value: string; count: number }>;
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
  return { types: tally((p) => p.type_slug), formats: tally((p) => p.format_slug) };
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
 * Snapshot → sanitisierte Speaker-Liste für die Show (#11, Phase 3): nur
 * Anzeigename + Funktion (Titel). KEINE PII (Bio/Foto/Social) und kein Token —
 * darf in die portable .jmshow und speist die Titler-DataLink/Recall-Einträge.
 * Speaker ohne Namen werden ausgelassen.
 */
export function snapshotToShowSpeakers(snap: IveoSnapshot): ShowIveoSpeaker[] {
  return snap.speakers
    .map((s): ShowIveoSpeaker => {
      const speaker: ShowIveoSpeaker = { name: speakerName(s) };
      if (s.title && s.title.trim()) speaker.title = s.title.trim();
      return speaker;
    })
    .filter((s) => s.name.length > 0);
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
