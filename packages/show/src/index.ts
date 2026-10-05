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
 * Ein Programmpunkt des zentralen Show-Ablaufs (#11/Sub-B, #78). Bewusst tool-agnostisch,
 * aber erweiterbar (Titel, optional: Dauer, Notiz, geplante Startzeit, Verantwortlich, Kategorie) —
 * dieselbe Form wie ein Timer-`TimetableItem` und eine Rundown-Zeile ohne Aktionen, damit ein
 * einmal zentral gepflegter Ablauf von mehreren Tools (Rundown, Timer) gelesen werden kann.
 */
export interface ShowAblaufItem {
  /**
   * Feste Kennung des Punkts (Teil 2a, #235): iveo-Programm- bzw. Agenda-Punkt-ID oder eine
   * im Show-Editor erzeugte UUID. Optional, damit alte Shows weiter laden. Bleibt über
   * Umbenennen und Umsortieren gleich — daran hängen Rundown-Aktionen und der aktive Timer-Punkt.
   */
  id?: string;
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
 * Sanitisierter Speaker für Konsumenten (z. B. Titler-Bauchbinden). Bewusst nur
 * Anzeigefelder — KEINE PII wie Bio/Foto/Kontakt, kein Secret.
 */
export interface ShowIveoSpeaker {
  /**
   * Speaker-Kennung (Teil 2b, Spec 5.1): die iveo-Speaker-ID. Optional, damit alte Shows weiter laden. Daran hält
   * der Titler seinen Eintrag (Spalte `@kennung`), und der Rundown-Picker speichert sie (`speakerId`).
   */
  id?: string;
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

/**
 * Optionale iveo-Bindung (#11): aus welchem iveo-Event der zentrale `ablauf`
 * materialisiert wurde. Enthält BEWUSST NIE ein Token — nur den Event-Slug und
 * die (nicht-geheime) Basis-URL. Der Launcher nutzt das fürs Live-Polling; das
 * Bearer-Token liegt getrennt und verschlüsselt im Launcher, nie in der Show
 * (die Show ist portabel/teilbar).
 */
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
   * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2): ISO-Zeit (UTC) des ersten Fehlschlags der iveo-Speakerliste.
   * Gesetzt, solange die Speaker aus einem früheren Stand stammen; der Titler zeigt daraus den Hinweis H7.
   * Setzen und Löschen schreibt nur der Launcher-Abgleich. Fehlt im Normalfall.
   */
  speakerVeraltetSeit?: string;
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

/** Höchstlänge einer Kennung (Teil 2a Spec 3.1; für Speaker Teil 2b Spec 5.1). Längere fallen beim Lesen weg. */
const ABLAUF_ID_MAX = 200;

function normalizeAblaufItem(value: unknown): ShowAblaufItem | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  if (!label.trim()) return null; // ohne Titel kein sinnvoller Programmpunkt
  // Kennung nur als String mit 1–200 Zeichen nach trim, sonst entfällt das Feld (der Punkt
  // bleibt). `id` steht vorn, damit die Serialisierung eine feste Feldreihenfolge hat.
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const item: ShowAblaufItem = id && id.length <= ABLAUF_ID_MAX ? { id, label } : { label };
  if (typeof o.durationMs === 'number' && o.durationMs > 0) item.durationMs = o.durationMs;
  if (typeof o.note === 'string' && o.note) item.note = o.note;
  if (typeof o.plannedStartMs === 'number' && o.plannedStartMs >= 0) item.plannedStartMs = o.plannedStartMs;
  if (typeof o.owner === 'string' && o.owner) item.owner = o.owner;
  if (typeof o.category === 'string' && o.category) item.category = o.category;
  return item;
}

/** Nächste freie Kennung `<basis>#n` ab n = 2, gekürzt auf 200 Zeichen (Spec 3.5). */
function freieKennung(basis: string, belegt: Set<string>): string {
  for (let n = 2; ; n++) {
    const zusatz = `#${n}`;
    // Kürzen statt überlaufen: eine id über 200 Zeichen verwürfe das nächste Lesen,
    // und normalizeAblauf wäre nicht mehr idempotent.
    const kandidat = basis.slice(0, ABLAUF_ID_MAX - zusatz.length) + zusatz;
    if (!belegt.has(kandidat)) return kandidat;
  }
}

/**
 * Doppelte Kennungen einer Liste auflösen (Teil 2a Spec 3.5, Teil 2b Spec 5.1) — die EINE Regel für Ablaufpunkte
 * und Speaker. Erste behält ihre Kennung, jede weitere `<id>#n` mit der nächsten freien Nummer.
 * Alle vorhandenen Kennungen gelten vorab als belegt. Zusatz gekürzt auf 200 Zeichen.
 * Einträge ohne id bleiben unverändert. Neue Objekte entstehen nur für umbenannte;
 * die Eingabe wird nicht verändert.
 */
export function loeseDoppelteKennungenAuf<T extends { id?: string }>(liste: T[]): T[] {
  // Alle vorhandenen Kennungen vorab als belegt, damit ein umbenannter Doppelter nie die
  // Kennung eines nachfolgenden Eintrags übernimmt (z. B. X, X, X#2 → X, X#3, X#2).
  const belegt = new Set<string>();
  for (const it of liste) if (it.id !== undefined) belegt.add(it.id);
  const gesehen = new Set<string>();
  return liste.map((it) => {
    if (it.id === undefined) return it;
    if (!gesehen.has(it.id)) {
      gesehen.add(it.id);
      return it;
    }
    const id = freieKennung(it.id, belegt);
    belegt.add(id);
    return { ...it, id };
  });
}

/**
 * Ablauf normalisieren (Teil 2a, Spec 3.1/3.5): je Punkt wie beim Lesen einer Show (ohne Titel
 * fällt er weg, `id` nur als String mit 1–200 Zeichen nach trim), danach doppelte Kennungen
 * über die ganze Liste auflösen (`loeseDoppelteKennungenAuf`): Der erste Punkt behält seine Kennung,
 * jeder weitere bekommt `<id>#2`, `#3` … — jeweils die nächste Nummer, die in der Liste noch frei ist.
 * Kein Array → []. `migrateShow` nutzt sie, also gilt das bei jedem `parseShow` und `serializeShow`.
 */
export function normalizeAblauf(value: unknown): ShowAblaufItem[] {
  if (!Array.isArray(value)) return [];
  const items = (value as unknown[])
    .map(normalizeAblaufItem)
    .filter((a): a is ShowAblaufItem => a !== null);
  return loeseDoppelteKennungenAuf(items);
}

/**
 * Hat die Show eine eigene Timer-Liste (Teil 2a, Spec 6.1)? Genau dann, wenn
 * `settings.timetable` ein Array mit mindestens einem Objekt ist — dieselbe Bedingung, unter
 * der der Timer (`parseTimetable`) eine Liste liefert. Dann hat sie Vorrang vor `show.ablauf`,
 * und ihre Punkte tragen keine Kennungen. Timer und Rundown nutzen beide diese Funktion.
 */
export function hatEigeneTimerListe(settings: Record<string, unknown> | undefined): boolean {
  const liste = settings?.timetable;
  return Array.isArray(liste) && liste.some((it) => Boolean(it) && typeof it === 'object');
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
        // Kennung wie am Ablaufpunkt (Teil 2b, Spec 5.1): nur als String mit 1–200 Zeichen nach trim, sonst
        // entfällt das Feld (der Speaker bleibt). `id` steht vorn: feste Feldreihenfolge id, name, title.
        const id = typeof sp.id === 'string' ? sp.id.trim() : '';
        const speaker: ShowIveoSpeaker = id && id.length <= ABLAUF_ID_MAX ? { id, name } : { name };
        if (typeof sp.title === 'string' && sp.title.trim()) speaker.title = sp.title.trim();
        return speaker;
      })
      .filter((s): s is ShowIveoSpeaker => s !== null);
    // Doppelte Kennungen → #2, #3 … (dieselbe Regel wie im Ablauf).
    if (speakers.length) binding.speakers = loeseDoppelteKennungenAuf(speakers);
  }
  // Merker „Speaker veraltet“ (Teil 2b, Spec 6.2): nur eine Zeit, die Date.parse lesen kann, sonst entfällt er.
  // Er steht in der Bindung direkt nach `speakers`.
  if (typeof o.speakerVeraltetSeit === 'string' && !Number.isNaN(Date.parse(o.speakerVeraltetSeit))) {
    binding.speakerVeraltetSeit = o.speakerVeraltetSeit;
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
  // Je Punkt normalisieren + doppelte Kennungen auflösen (Teil 2a, Spec 3.5).
  const ablauf = normalizeAblauf(obj.ablauf);
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
