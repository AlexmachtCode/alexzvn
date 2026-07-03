// ─────────────────────────────────────────────────────────────────────────────
// @jm/iveo — Typen der iveo Public REST API v1 (read-only).
//
// Die Feld-Shapes spiegeln EXAKT den Consumer-Guide (public-rest-api-consumer-
// guide.md, §5). Bewusst tolerant: Felder, die der Guide als `null`-fähig
// markiert, sind optional/nullable. Wir übernehmen NICHT alle Felder in die Suite
// (Datensparsamkeit) — die sanitisierte `IveoShowMetadata` weiter unten ist die
// Allowlist dessen, was wirklich in Cache/Show landet.
//
// SICHERHEIT: Diese Typen beschreiben nur DATEN. Das Bearer-Token ist NICHT Teil
// irgendeines dieser Objekte und darf nie in einen Snapshot/Cache/Show wandern.
// ─────────────────────────────────────────────────────────────────────────────

/** Ein Bild-/Datei-Verweis der API — indirekte, auth-pflichtige Asset-URL (§7). */
export interface IveoAssetRef {
  /** Stabile `…/api/v1/assets/<id>`-URL. Mit Bearer holen, 302 folgen, NIE cachen. */
  url: string;
}

export type IveoEventKind = 'standalone' | 'global' | 'sub';

export interface IveoEvent {
  id: string;
  slug: string;
  name: string;
  /** UTC (Offset +00:00), kann null sein. */
  starts_at: string | null;
  ends_at: string | null;
  /** IANA-Zone für die lokale Anzeige. */
  timezone: string | null;
  program_day_start_local?: string | null;
  program_day_end_local?: string | null;
  host_organisation_id?: string | null;
  location?: string | null;
  logo?: IveoAssetRef | null;
  cover_video_url?: string | null;
  kind?: IveoEventKind;
  parent_event_id?: string | null;
  updated_at?: string;
}

export interface IveoProgram {
  id: string;
  event_id: string;
  type_slug?: string;
  format_slug?: string;
  stage_id?: string | null;
  title: string;
  subtitle?: string | null;
  /** Markdown, kann null sein. */
  description?: string | null;
  /** UTC (+00:00). */
  starts_at?: string | null;
  ends_at?: string | null;
  /** Venue-Wanduhr (ohne Offset). */
  starts_at_local?: string | null;
  ends_at_local?: string | null;
  timezone?: string | null;
  duration_minutes?: number | null;
  /** Gesprochene/gedolmetschte Sprachen — KEINE Übersetzungen. */
  spoken_languages?: string[];
  /** Reserviert; in v1 immer null (keine übersetzten Titel/Texte). */
  translations?: null;
  image?: IveoAssetRef | null;
  updated_at?: string;
  /**
   * Verknüpfte Speaker (#11, Phase 3b). Der v1-Guide dokumentiert die Verknüpfung
   * NICHT im generischen Programm-Shape, §8 erwähnt sie aber („linked speakers").
   * Sie taucht — falls überhaupt — am ehesten im Programm-DETAIL auf. Deshalb hier
   * BEWUSST tolerant/optional: verschiedene mögliche Formen werden von
   * `extractSpeakerIds` robust ausgewertet, Abwesenheit ist kein Fehler.
   */
  speaker_ids?: string[];
  speakers?: Array<string | { id?: string; uuid?: string; speaker_id?: string }>;
  speaker_id?: string;
}

export interface IveoSpeaker {
  id: string;
  event_id: string;
  salutation?: string | null;
  first_name: string;
  last_name: string;
  /** Funktion/Rolle, z. B. "Lead Negotiator". */
  title?: string | null;
  bio?: string | null;
  photo?: IveoAssetRef | null;
  languages?: string[];
  /** Frei-Form: {platform,url,…}. */
  social_links?: Array<Record<string, unknown>>;
  updated_at?: string;
}

export interface IveoOrganisation {
  id: string;
  name: string;
  logo?: IveoAssetRef | null;
  website_url?: string | null;
  description?: string | null;
  updated_at?: string;
}

export interface IveoStage {
  id: string;
  event_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  capacity?: number | null;
  sort_order?: number;
  image?: IveoAssetRef | null;
  updated_at?: string;
}

export interface IveoMaterialAsset {
  url: string;
  mime_type?: string | null;
  size_bytes?: number | null;
}

export interface IveoMaterial {
  id: string;
  kind: 'file' | 'link';
  label: string;
  sort_order?: number;
  asset?: IveoMaterialAsset | null;
  /** Bei kind:"link" ein öffentlicher Link (kein Token nötig). */
  external_url?: string | null;
}

export interface IveoAgendaItem {
  id: string;
  program_id: string;
  sort_order?: number;
  title: string;
  duration_minutes?: number | null;
  notes?: string | null;
  tools_other?: string | null;
  tools?: string[];
  materials?: IveoMaterial[];
  updated_at?: string;
}

/** Kurz-Referenz aus der Discovery (`GET /`). */
export interface IveoEventStub {
  id: string;
  slug: string;
  name: string;
}

// ── Antwort-Hülle (§4) ───────────────────────────────────────────────────────

export interface IveoPagination {
  next_cursor: string | null;
  limit: number;
}

export interface IveoMeta {
  /** Immer vorhanden; in Fehlerreports zitieren. */
  request_id: string;
  pagination?: IveoPagination;
}

export interface IveoSuccess<T> {
  data: T;
  meta: IveoMeta;
}

export interface IveoErrorEntry {
  /** Stabiler Maschinen-Code — hierauf verzweigen, NICHT auf `message`. */
  code: string;
  message: string;
}

export interface IveoErrorEnvelope {
  errors: IveoErrorEntry[];
  meta?: { request_id?: string };
}

// ── Suite-interne Ableitungen ────────────────────────────────────────────────

/**
 * Roher Event-Snapshot, wie ihn der Client bündelt. Enthält NUR Daten (kein
 * Token). Wird im Launcher-Main gehalten und zu `IveoShowMetadata` sanitisiert.
 */
export interface IveoSnapshot {
  event: IveoEvent;
  programs: IveoProgram[];
  speakers: IveoSpeaker[];
  organisations: IveoOrganisation[];
  stages: IveoStage[];
  /** ISO-Zeitpunkt des Abrufs (vom Aufrufer/Client gesetzt). */
  fetchedAt: string;
}

/**
 * Sanitisierte, feld-allowlistete Fassung für Cache (appData) und Konsum durch
 * Tools. Bewusst OHNE PII wie Bio/Fotos/Social-Links (kommen erst, wenn ein Tool
 * sie wirklich anzeigt) und OHNE jegliches Secret. Diese Form darf in die
 * `.jmshow`-Metadaten und über IPC in Renderer.
 */
export interface IveoShowMetadata {
  eventId: string;
  slug: string;
  name: string;
  timezone: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Basis-URL der Quelle (kein Secret) — für spätere gezielte Nachladungen. */
  baseUrl: string;
  programs: Array<{
    id: string;
    title: string;
    subtitle: string | null;
    stageId: string | null;
    startsAt: string | null;
    startsAtLocal: string | null;
    durationMs: number;
  }>;
  stages: Array<{ id: string; name: string; color: string | null }>;
  speakers: Array<{ id: string; name: string; title: string | null }>;
  fetchedAt: string;
}
