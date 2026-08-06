// ─────────────────────────────────────────────────────────────────────────────
// @jm/show — gemeinsames Show-/Event-Format der JM Production Suite.
//
// Eine .jmshow-Datei bündelt eine ganze Produktion: pro beteiligtem Tool eine
// Referenz auf dessen Dokument (z. B. .jmdaw, .jmpres), das Netzwerk-Binding der
// Quelle (für Aggregatoren wie Stage Display) und freie tool-spezifische
// Einstellungen. Der Launcher öffnet eine Show und startet die Tools koordiniert
// (jmps://open?show=<pfad>); jedes Tool lädt daraus seinen eigenen Teil.
//
// Bewusst OHNE Abhängigkeiten und OHNE I/O — nur reine Daten + Funktionen, damit
// das Paket in Main- wie Renderer-Prozessen jedes Tools nutzbar ist.
// ─────────────────────────────────────────────────────────────────────────────

export const SHOW_FILE_EXT = '.jmshow';
export const SHOW_SCHEMA_VERSION = 1;
export const SHOW_PROTOCOL = 'jmps';

export interface ShowNetworkBinding {
  host?: string;
  port?: number;
}

export interface ShowToolRef {
  /** Tool-ID — entspricht ToolManifest.id bzw. der app-runtime appId (z. B. "jm-timer"). */
  appId: string;
  /** Optionaler Pfad zu einem tool-eigenen Dokument (z. B. .jmdaw, .jmpres). */
  document?: string;
  /** Netzwerk-Binding der Quelle (für Aggregatoren wie Stage Display). */
  network?: ShowNetworkBinding;
  /** Frei interpretierbare, tool-spezifische Einstellungen. */
  settings?: Record<string, unknown>;
}

/**
 * Ein Programmpunkt des zentralen Show-Ablaufs (#78). Bewusst tool-agnostisch und
 * minimal (Titel/Dauer/Notiz) — dieselbe Form wie ein Timer-`TimetableItem` und
 * eine Rundown-Zeile ohne Aktionen, damit ein einmal zentral gepflegter Ablauf
 * von mehreren Tools (Rundown, Timer) gelesen werden kann.
 */
export interface ShowAblaufItem {
  /** Segment-/Programmpunkt-Titel. */
  label: string;
  /** Geplante Dauer in Millisekunden (optional). */
  durationMs?: number;
  /** Freie Notiz (optional). */
  note?: string;
  /** Geplante Startzeit als ms seit LOKALER Mitternacht (Tageszeit, optional). */
  plannedStartMs?: number;
  /** Verantwortlich (freier Text, optional). */
  owner?: string;
  /** Kategorie (freier Text, optional). */
  category?: string;
}

/**
 * Optionale iveo-Bindung (#11): aus welchem iveo-Event der zentrale `ablauf`
 * materialisiert wurde. Enthält BEWUSST NIE ein Token — nur den Event-Slug und
 * die (nicht-geheime) Basis-URL. Der Launcher nutzt das fürs Live-Polling; das
 * Bearer-Token liegt getrennt und verschlüsselt im Launcher, nie in der Show
 * (die Show ist portabel/teilbar).
 */
/**
 * Sanitisierter Speaker für Konsumenten (z. B. Titler-Bauchbinden). Bewusst nur
 * Anzeigefelder — KEINE PII wie Bio/Foto/Kontakt, kein Secret.
 */
export interface ShowIveoSpeaker {
  /** Anzeigename (Anrede + Vor- + Nachname). */
  name: string;
  /** Funktion/Rolle (z. B. „Lead Negotiator"). */
  title?: string;
}

/**
 * Token-freie Referenz eines Side Events (#11) — id + Titel. Erlaubt Tools (Rundown
 * Row-Editor, Launcher-Panel), die Side Events des Tages aufzulisten und per id live
 * umzuschalten, ohne selbst bei iveo abzufragen.
 */
export interface ShowIveoProgramRef {
  id: string;
  title: string;
}

export interface ShowIveoBinding {
  /** iveo Event-Slug oder UUID. */
  event: string;
  /** Basis-URL der iveo-API (kein Secret; Default = Staging). */
  baseUrl?: string;
  /** Anzeigename des Events (Komfort/Anzeige). */
  name?: string;
  /** Zeitpunkt der letzten Materialisierung (ISO-8601). */
  syncedAt?: string;
  /**
   * Sanitisierte Speaker-Liste (#11, Phase 3) für Tools wie den Titler —
   * token-frei, ohne PII. Speist die DataLink-Variablen/Recall-Einträge.
   */
  speakers?: ShowIveoSpeaker[];
  /**
   * Side Events des Tages (#11), token-frei (id + Titel) — Grundlage fürs Live-
   * Umschalten (Launcher-Panel / Rundown-GO), ohne dass ein Tool selbst iveo abfragt.
   */
  sideEvents?: ShowIveoProgramRef[];
  /**
   * Optionaler Programm-Filter (#11): welche Programme in den Ablauf übernommen
   * werden — nach Typ/Format, nach Kalendertag (mehrtägige iveo-Pläne → ein Tag)
   * und/oder ohne „Blocker"-Platzhalter. Der Launcher-Poller filtert identisch,
   * damit Live-Updates konsistent bleiben.
   */
  filter?: {
    typeSlug?: string;
    formatSlug?: string;
    /** Nur Programme dieses Kalendertags (YYYY-MM-DD, lokale Venue-Zeit). */
    day?: string;
    /** „Blocker"/Platzhalter-Einträge aus dem Ablauf nehmen. */
    excludeBlockers?: boolean;
    /**
     * Ein einzelnes Side Event „im Detail": Ablauf = dessen Agenda-Punkte, Speaker
     * auf dieses Programm eingegrenzt. Der Launcher-Poller löst identisch auf.
     */
    programId?: string;
  };
}

export interface Show {
  schemaVersion: number;
  /** Anzeigename der Produktion. */
  name: string;
  /** Letzte Änderung (ISO-8601), vom Schreiber gesetzt. */
  updatedAt?: string;
  /** Beteiligte Tools und ihre Show-spezifischen Referenzen. */
  tools: ShowToolRef[];
  /**
   * Zentraler Ablauf der Produktion (#78): einmal beim Erstellen der Show
   * gepflegt, von Tools wie Rundown/Timer gelesen — kein separater Ablauf je Tool
   * mehr nötig. Optional/abwärtskompatibel: alte Shows ohne Ablauf bleiben gültig.
   */
  ablauf?: ShowAblaufItem[];
  /** Optionale iveo-Event-Bindung (#11), token-frei. */
  iveo?: ShowIveoBinding;
}

/** Leere Show mit aktuellem Schema. */
export function createShow(name: string): Show {
  return { schemaVersion: SHOW_SCHEMA_VERSION, name, tools: [] };
}

function normalizeAblaufItem(value: unknown): ShowAblaufItem | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  if (!label.trim()) return null; // ohne Titel kein sinnvoller Programmpunkt
  const item: ShowAblaufItem = { label };
  if (typeof o.durationMs === 'number' && o.durationMs > 0) item.durationMs = o.durationMs;
  if (typeof o.note === 'string' && o.note) item.note = o.note;
  return item;
}

function normalizeIveoBinding(value: unknown): ShowIveoBinding | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const event = typeof o.event === 'string' ? o.event.trim() : '';
  if (!event) return null; // ohne Event-Slug keine sinnvolle Bindung
  const binding: ShowIveoBinding = { event };
  if (typeof o.baseUrl === 'string' && o.baseUrl.trim()) binding.baseUrl = o.baseUrl.trim();
  if (typeof o.name === 'string' && o.name.trim()) binding.name = o.name.trim();
  if (typeof o.syncedAt === 'string' && o.syncedAt) binding.syncedAt = o.syncedAt;
  if (Array.isArray(o.speakers)) {
    const speakers = (o.speakers as unknown[])
      .map((s): ShowIveoSpeaker | null => {
        if (!s || typeof s !== 'object') return null;
        const sp = s as Record<string, unknown>;
        const name = typeof sp.name === 'string' ? sp.name.trim() : '';
        if (!name) return null;
        const speaker: ShowIveoSpeaker = { name };
        if (typeof sp.title === 'string' && sp.title.trim()) speaker.title = sp.title.trim();
        return speaker;
      })
      .filter((s): s is ShowIveoSpeaker => s !== null);
    if (speakers.length) binding.speakers = speakers;
  }
  if (Array.isArray(o.sideEvents)) {
    const refs = (o.sideEvents as unknown[])
      .map((s): ShowIveoProgramRef | null => {
        if (!s || typeof s !== 'object') return null;
        const r = s as Record<string, unknown>;
        const id = typeof r.id === 'string' ? r.id.trim() : '';
        const title = typeof r.title === 'string' ? r.title.trim() : '';
        return id ? { id, title: title || id } : null;
      })
      .filter((r): r is ShowIveoProgramRef => r !== null);
    if (refs.length) binding.sideEvents = refs;
  }
  if (o.filter && typeof o.filter === 'object') {
    const f = o.filter as Record<string, unknown>;
    const filter: NonNullable<ShowIveoBinding['filter']> = {};
    if (typeof f.typeSlug === 'string' && f.typeSlug.trim()) filter.typeSlug = f.typeSlug.trim();
    if (typeof f.formatSlug === 'string' && f.formatSlug.trim()) filter.formatSlug = f.formatSlug.trim();
    if (typeof f.day === 'string' && f.day.trim()) filter.day = f.day.trim();
    if (f.excludeBlockers === true) filter.excludeBlockers = true;
    if (typeof f.programId === 'string' && f.programId.trim()) filter.programId = f.programId.trim();
    if (filter.typeSlug || filter.formatSlug || filter.day || filter.excludeBlockers || filter.programId)
      binding.filter = filter;
  }
  return binding;
}

function normalizeToolRef(value: unknown): ShowToolRef | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  if (typeof o.appId !== 'string' || !o.appId) return null;

  const ref: ShowToolRef = { appId: o.appId };
  if (typeof o.document === 'string') ref.document = o.document;
  if (o.network && typeof o.network === 'object') {
    const n = o.network as Record<string, unknown>;
    const network: ShowNetworkBinding = {};
    if (typeof n.host === 'string') network.host = n.host;
    if (typeof n.port === 'number') network.port = n.port;
    if (network.host !== undefined || network.port !== undefined) ref.network = network;
  }
  if (o.settings && typeof o.settings === 'object') {
    ref.settings = o.settings as Record<string, unknown>;
  }
  return ref;
}

/**
 * Hebt ein (möglicherweise altes/fremdes) Objekt auf das aktuelle Show-Schema.
 * Tolerant gegenüber fehlenden/ungültigen Feldern — spiegelt das Migrations-
 * Muster von migrateProject in der DAW.
 */
export function migrateShow(raw: unknown): Show {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const tools = Array.isArray(obj.tools)
    ? (obj.tools as unknown[]).map(normalizeToolRef).filter((t): t is ShowToolRef => t !== null)
    : [];
  const ablauf = Array.isArray(obj.ablauf)
    ? (obj.ablauf as unknown[])
        .map(normalizeAblaufItem)
        .filter((a): a is ShowAblaufItem => a !== null)
    : [];
  const name =
    typeof obj.name === 'string' && obj.name.trim() ? (obj.name as string) : 'Unbenannte Show';
  const iveo = normalizeIveoBinding(obj.iveo);
  return {
    schemaVersion: SHOW_SCHEMA_VERSION,
    name,
    updatedAt: typeof obj.updatedAt === 'string' ? (obj.updatedAt as string) : undefined,
    tools,
    // Leeren Ablauf weglassen → alte Shows bleiben byte-nah, kein Rauschen.
    ...(ablauf.length ? { ablauf } : {}),
    // Ungültige/fehlende iveo-Bindung weglassen → alte Shows byte-nah.
    ...(iveo ? { iveo } : {}),
  };
}

/** Parst .jmshow-Dateiinhalt und migriert auf das aktuelle Schema. */
export function parseShow(text: string): Show {
  return migrateShow(JSON.parse(text));
}

/** Serialisiert eine Show als formatiertes JSON. `at` setzt updatedAt (ISO). */
export function serializeShow(show: Show, at?: string): string {
  const migrated = migrateShow(show);
  const out: Show = { ...migrated, updatedAt: at ?? migrated.updatedAt };
  return JSON.stringify(out, null, 2) + '\n';
}

/** Baut den Deep-Link, der eine Show öffnet: jmps://open?show=<encoded path>. */
export function showOpenUrl(showPath: string): string {
  return `${SHOW_PROTOCOL}://open?show=${encodeURIComponent(showPath)}`;
}

/** Liest den Show-Pfad aus einem jmps://open?show=… Deep-Link (oder null). */
export function parseShowDeepLink(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol.replace(/:$/, '') !== SHOW_PROTOCOL) return null;
    return u.searchParams.get('show') || null;
  } catch {
    return null;
  }
}
