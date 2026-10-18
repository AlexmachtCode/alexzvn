// ─────────────────────────────────────────────────────────────────────────────
// @jm/iveo — HTTP-Client für die iveo Public REST API v1.
//
// ⚠️  NUR IM MAIN-PROZESS verwenden. Das Bearer-Token ist ein Secret; laut Guide
//     (§1) ist die API server-side-only (kein CORS). Kein Renderer, kein Bundle
//     mit Client-Auslieferung darf dieses Modul mit echtem Token instanziieren.
//
// Der `fetch` wird injizierbar gehalten (opts.fetchImpl) — Default ist der globale
// fetch (Node ≥18 / Electron). Das erlaubt Selftests ohne Netz und entkoppelt uns
// von der DOM-lib-Typisierung.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IveoAgendaItem,
  IveoEvent,
  IveoEventStub,
  IveoMeta,
  IveoOrganisation,
  IveoProgram,
  IveoSpeaker,
  IveoStage,
  IveoSnapshot,
} from './types';

/** Production ist der Standard (Owner 16.10.2026, I5); Staging ist veraltet. */
export const IVEO_DEFAULT_BASE_URL = 'https://app.my-iveo.de/api/v1';

/** T8 (iveo-Paket, Spec 11.6): Fehler bei ungültiger Basis-URL, die Eingabe in typografischen Anführungszeichen. */
const textUngueltigeBasisUrl = (eingabe: string | undefined): string =>
  `Ungültige iveo-Basis-URL: „${eingabe}“. Beispiel: https://app.my-iveo.de/api/v1`;

/**
 * Basis-URL robust normalisieren: trimmen, fehlendes Schema als https:// ergänzen,
 * trailing Slashes weg, und als absolute URL validieren. Leer → Default. Wirft mit
 * klarer Meldung statt eines kryptischen „Failed to parse URL" tief in fetch.
 */
export function normalizeIveoBaseUrl(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return IVEO_DEFAULT_BASE_URL;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const cleaned = withScheme.replace(/\/+$/, '');
  let host = '';
  try {
    host = new URL(cleaned).host;
  } catch {
    host = '';
  }
  if (!host) {
    throw new Error(textUngueltigeBasisUrl(raw));
  }
  return cleaned;
}

/** Minimaler fetch-Vertrag — strukturell kompatibel zum globalen fetch. */
export interface IveoFetchResponse {
  ok: boolean;
  status: number;
  url?: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Datenstrom der Antwort (iveo-Paket, Spec 9.6): `oeffneAsset` reicht ihn weiter, statt alles in den Speicher zu laden. */
  body?: ReadableStream<Uint8Array> | null;
}
export type IveoFetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    redirect?: 'follow' | 'manual';
    /** Signal des Aufrufers (iveo-Paket, Spec 9.6); ein Abbruch darüber wird nicht wiederholt (`fetchWithRetry`). */
    signal?: AbortSignal;
  },
) => Promise<IveoFetchResponse>;

export interface IveoClientOptions {
  /** Bearer-Token (`iveo_live_…`). Pro Event, kurzlebig. Bleibt im Speicher. */
  token: string;
  /** Basis-URL inkl. `/api/v1`. Default: Production (`IVEO_DEFAULT_BASE_URL`). */
  baseUrl?: string;
  /** Für Tests/Sonderfälle injizierbar; Default = globaler fetch. */
  fetchImpl?: IveoFetchLike;
  /** Wiederholungen bei 429/5xx (Default 3). */
  maxRetries?: number;
  /** Backoff-Basis in ms (Default 500); wächst exponentiell, gedeckelt. */
  retryBaseMs?: number;
  /** Wartefunktion (Tests können sie überspringen). Default: setTimeout. */
  sleepImpl?: (ms: number) => Promise<void>;
}

/** Fehler mit stabilem `code` (aus `errors[0].code`) statt nur Text (§4/§9). */
export class IveoApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'IveoApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
  /** true, wenn Ressource fehlt ODER außerhalb des Token-Scopes liegt (§9). */
  get isNotFoundOrOutOfScope(): boolean {
    return this.status === 404;
  }
  /** true bei fehlendem/ungültigem/revoziertem Token oder deaktiviertem Zugang. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** T77 (a) (iveo-Paket, Spec 11.6): Grund, wenn eine Asset-Adresse anderer Herkunft nicht über https geht (E52). */
const TEXT_ASSET_ADRESSE = 'Datei-Adresse auf anderem Server ohne https';

/**
 * Asset-Adresse anderer Herkunft als die Basis-URL ohne `https:` (iveo-Paket, E52, Spec 9.6): Sie wird nie abgerufen.
 * Die Meldung ist T77 (a) und nennt die Adresse bewusst nicht (keine Asset-Referenz in einer Ausgabe, Spec 11.5).
 */
export class IveoAssetAdresseError extends Error {
  constructor() {
    super(TEXT_ASSET_ADRESSE);
    this.name = 'IveoAssetAdresseError';
  }
}

/** Anfrage für ein Asset (E52): die fertige Adresse und ob das Token mitgeht. */
export interface IveoAssetAnfrage {
  url: string;
  mitToken: boolean;
}

/** Datenstrom eines Assets (Spec 9.6): bewusst ohne Adresse und ohne weitere Kopfzeilen. */
export interface IveoAssetStrom {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  /** `Content-Length` als ganze Zahl ≥ 0, sonst null (unbekannt). */
  contentLength: number | null;
}

/**
 * Asset-Referenz → Anfrage (iveo-Paket, Spec 9.6, E52). iveo ist hier inkonsistent: manche Assets liefern die volle
 * `…/api/v1/assets/<id>`-URL (`IveoAssetRef`), Material-Assets nur die nackte ID bzw. die signierte Referenz (auf Prod
 * 279 Zeichen mit einem Punkt, M1). Endpoint ist in beiden Fällen `GET /assets/{id}` (§7): Aus einer nackten ID (auch
 * „/assets/<id>“ oder „assets/<id>“) wird `<baseUrl>/assets/<id>`, eine volle http(s)-Adresse bleibt unverändert. Danach
 * zählt die Herkunft (Schema, Host, Port) der fertigen Adresse: gleich der Basis-URL → mit Token; anders und `https:` →
 * ohne Token; anders und nicht `https:` → kein Abruf (`IveoAssetAdresseError`). Die Basis-URL gilt, wie sie eingetragen
 * ist (auch `http:`), normalisiert wie im Client; leer → Standard. Leere Referenz → Fehler wie bisher.
 */
export function assetAnfrage(ref: string, baseUrl: string): IveoAssetAnfrage {
  const v = (ref ?? '').trim();
  if (!v) throw new Error('iveo: leere Asset-Referenz');
  const basis = normalizeIveoBaseUrl(baseUrl);
  const url = /^https?:\/\//i.test(v) ? v : `${basis}/assets/${v.replace(/^\/+/, '').replace(/^assets\//, '')}`;
  let ziel: URL;
  try {
    ziel = new URL(url);
  } catch {
    // Ohne die Adresse in der Meldung (Spec 11.5).
    throw new Error('iveo: ungültige Asset-Adresse');
  }
  if (ziel.origin === new URL(basis).origin) return { url, mitToken: true };
  if (ziel.protocol === 'https:') return { url, mitToken: false };
  throw new IveoAssetAdresseError();
}

/** `Content-Length` → ganze Zahl ≥ 0, sonst null (fehlt, leer, keine Zahl). */
function laengeAus(wert: string | null): number | null {
  if (wert === null || wert.trim() === '') return null;
  const n = Number(wert);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Abbruch über ein AbortSignal (z. B. AbortSignal.timeout im fetchImpl): TimeoutError bzw. AbortError. */
function istAbbruch(e: unknown): boolean {
  const name = (e as { name?: unknown } | null | undefined)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** Kurzer, whitespace-normalisierter Ausschnitt einer Antwort für Fehlermeldungen. */
function snippet(s: string, max = 180): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

export class IveoClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: IveoFetchLike;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: IveoClientOptions) {
    if (!opts.token) throw new Error('IveoClient: token fehlt');
    this.token = opts.token;
    this.baseUrl = normalizeIveoBaseUrl(opts.baseUrl);
    const globalFetch = (globalThis as { fetch?: IveoFetchLike }).fetch;
    const impl = opts.fetchImpl ?? globalFetch;
    if (!impl) throw new Error('IveoClient: kein fetch verfügbar (fetchImpl injizieren)');
    this.fetchImpl = impl;
    this.maxRetries = opts.maxRetries ?? 3;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.sleep = opts.sleepImpl ?? defaultSleep;
  }

  private authHeaders(): Record<string, string> {
    // Token IMMER im Header (nie Query — §3 lehnt Query mit 400 ab).
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/json' };
  }

  /** Kopfzeilen eines Asset-Abrufs (E52): das Token nur an die Herkunft der Basis-URL, sonst keine Kopfzeile. */
  private assetKoepfe(mitToken: boolean): Record<string, string> {
    return mitToken ? this.authHeaders() : {};
  }

  /**
   * fetch mit Backoff auf 429/5xx; respektiert Retry-After. Ein Wurf wird wiederholt, außer das Signal des Aufrufers
   * (`init.signal`) ist abgebrochen: Dann wirft es sofort weiter, ohne Wartezeit (iveo-Paket, E46, Spec 9.6). Eine
   * Zeitgrenze aus `mitZeitgrenze` ist ein eigenes Signal im fetchImpl, kein Signal des Aufrufers: Sie wird wie bisher
   * wiederholt.
   */
  private async fetchWithRetry(url: string, init?: Parameters<IveoFetchLike>[1]): Promise<IveoFetchResponse> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let res: IveoFetchResponse;
      try {
        res = await this.fetchImpl(url, init);
      } catch (e) {
        // Abbruch durch den Aufrufer: nie wiederholen.
        if (init?.signal?.aborted) throw e;
        // Netzfehler → wie transient behandeln.
        lastErr = e;
        if (attempt === this.maxRetries) break;
        await this.sleep(this.backoffMs(attempt, undefined));
        continue;
      }
      if (res.status !== 429 && res.status < 500) return res;
      if (attempt === this.maxRetries) return res; // letzter Versuch: Antwort durchreichen
      const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
      await this.sleep(this.backoffMs(attempt, retryAfter));
    }
    throw lastErr instanceof Error ? lastErr : new Error('iveo: Netzwerkfehler');
  }

  private backoffMs(attempt: number, retryAfterSec?: number): number {
    if (retryAfterSec && retryAfterSec > 0) return Math.min(retryAfterSec * 1000, 30_000);
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /** Roh-Call: liefert `{ data, meta }` oder wirft `IveoApiError`. */
  private async call<T>(path: string): Promise<{ data: T; meta: IveoMeta }> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const res = await this.fetchWithRetry(url, { headers: this.authHeaders() });
    // Erst als Text lesen → erlaubt eine aussagekräftige Diagnose, falls die
    // Antwort kein/anderes JSON ist (z. B. HTML einer falschen Basis-URL).
    // Ein Abbruch über das Signal des Aufrufers (Zeitgrenze) wird NICHT verschluckt:
    // sonst käme bei HTTP 200 die falsche Diagnose „bad_envelope“ (Basis-URL) heraus.
    const raw = await res.text().catch((e: unknown) => {
      if (istAbbruch(e)) throw e;
      return '';
    });
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      // kein JSON → unten als Fehler behandeln
    }
    if (!res.ok) {
      const env = body as { errors?: Array<{ code?: string; message?: string }>; meta?: { request_id?: string } } | null;
      const first = env?.errors?.[0];
      const reqId = env?.meta?.request_id;
      // Status/Code/request_id an die Meldung hängen → jede Log-Zeile ist ein
      // vollständiger, an den iveo-Dev weiterreichbarer Fehlerbericht.
      const diag = `[HTTP ${res.status}${first?.code ? ` ${first.code}` : ''}${reqId ? ` req=${reqId}` : ''}]`;
      throw new IveoApiError(
        res.status,
        first?.code || `http_${res.status}`,
        `${first?.message || `iveo HTTP ${res.status}`} @ ${path} ${diag}${!first?.message && raw ? `: ${snippet(raw)}` : ''}`,
        reqId,
      );
    }
    const env = body as { data?: T; meta?: IveoMeta } | null;
    if (!env || typeof env !== 'object' || env.data === undefined) {
      // Häufigste Ursache: Basis-URL zeigt nicht auf …/api/v1 (dann kommt HTML/
      // andere JSON). Diagnose mitgeben (Status + Content-Type + Body-Anfang).
      const ct = res.headers.get('content-type') || '?';
      throw new IveoApiError(
        res.status,
        'bad_envelope',
        `iveo: unerwartete Antwortstruktur @ ${path} (HTTP ${res.status}, ${ct}). ` +
          `Zeigt die Basis-URL auf …/api/v1? Antwort-Anfang: ${snippet(raw)}`,
      );
    }
    return { data: env.data, meta: env.meta ?? { request_id: '' } };
  }

  /** `data` einer Einzelressource. */
  private async get<T>(path: string): Promise<T> {
    return (await this.call<T>(path)).data;
  }

  /** Alle Seiten einer Collection über Cursor-Pagination einsammeln (§6). */
  private async getAll<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let cursor: string | null = null;
    // Schutz gegen fehlerhafte Endlos-Cursor.
    for (let page = 0; page < 1000; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const url: string = cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path;
      const res = await this.call<T[]>(url);
      if (Array.isArray(res.data)) out.push(...res.data);
      cursor = res.meta.pagination?.next_cursor ?? null;
      if (!cursor) break;
    }
    return out;
  }

  // ── Öffentliche Endpunkte ──────────────────────────────────────────────────

  /** Discovery (`GET /`): welche Events das Token lesen darf. Validiert das Token. */
  async discovery(): Promise<IveoEventStub[]> {
    const data = await this.get<{ events?: IveoEventStub[] }>('/');
    return data.events ?? [];
  }

  getEvent(event: string): Promise<IveoEvent> {
    return this.get<IveoEvent>(`/events/${encodeURIComponent(event)}`);
  }

  listPrograms(event: string, query = ''): Promise<IveoProgram[]> {
    const q = query ? (query.startsWith('?') ? query : `?${query}`) : '?limit=200';
    return this.getAll<IveoProgram>(`/events/${encodeURIComponent(event)}/programs${q}`);
  }

  /** Einzelnes Programm (Detail) — kann mehr Felder tragen als die Liste (z. B. Speaker-Verknüpfung). */
  getProgram(event: string, program: string): Promise<IveoProgram> {
    return this.get<IveoProgram>(
      `/events/${encodeURIComponent(event)}/programs/${encodeURIComponent(program)}`,
    );
  }

  /** Agenda-Punkte eines Programms (Feinablauf eines Side Events, #11 Phase 3b). */
  listAgendaItems(event: string, program: string): Promise<IveoAgendaItem[]> {
    return this.getAll<IveoAgendaItem>(
      `/events/${encodeURIComponent(event)}/programs/${encodeURIComponent(program)}/agenda-items?limit=200`,
    );
  }

  listSpeakers(event: string): Promise<IveoSpeaker[]> {
    return this.getAll<IveoSpeaker>(`/events/${encodeURIComponent(event)}/speakers?limit=200`);
  }

  listOrganisations(event: string): Promise<IveoOrganisation[]> {
    return this.getAll<IveoOrganisation>(`/events/${encodeURIComponent(event)}/organisations?limit=200`);
  }

  listStages(event: string): Promise<IveoStage[]> {
    return this.get<IveoStage[]>(`/events/${encodeURIComponent(event)}/stages`);
  }

  /**
   * Voller Event-Snapshot (Event + Programme + Speaker + Orgs + Stages).
   * `now` als ISO-String übergeben (Main-Prozess kennt die Zeit) → `fetchedAt`.
   *
   * Resilient: Event + Programme sind ESSENZIELL (→ Ablauf) — scheitern sie,
   * scheitert der Snapshot. Speaker/Orgs/Stages sind BEST-EFFORT — ein Fehler
   * (z. B. HTTP 500 auf einer Ressource, kommt auf Staging vor) liefert nur eine
   * leere Liste + optionalen `onSubError`, statt den ganzen Bind zu kippen.
   */
  async getEventSnapshot(
    event: string,
    now: string,
    opts: {
      /** Callback je übersprungener Best-Effort-Ressource (Logging/Diagnose). */
      onSubError?: (resource: string, err: unknown) => void;
      /**
       * Programme best-effort behandeln (leere Liste statt Abbruch) — für den
       * INITIALEN Bind, damit ein serverseitiger 500 auf /programs den Bind nicht
       * komplett blockiert. Default false = essenziell: der Live-Poller MUSS
       * abbrechen (nicht mit [] den vorhandenen Ablauf überschreiben).
       */
      programsBestEffort?: boolean;
    } = {},
  ): Promise<IveoSnapshot> {
    const ev = await this.getEvent(event); // gültiges Event ist Voraussetzung
    const bestEffort = async <T>(resource: string, p: Promise<T[]>): Promise<T[]> => {
      try {
        return await p;
      } catch (e) {
        opts.onSubError?.(resource, e);
        return [];
      }
    };
    const programsP = opts.programsBestEffort
      ? bestEffort('programs', this.listPrograms(event))
      : this.listPrograms(event); // essenziell → Rejection kippt den Snapshot
    const [programs, speakers, organisations, stages] = await Promise.all([
      programsP,
      bestEffort('speakers', this.listSpeakers(event)),
      bestEffort('organisations', this.listOrganisations(event)),
      bestEffort('stages', this.listStages(event)),
    ]);
    return { event: ev, programs, speakers, organisations, stages, fetchedAt: now };
  }

  /**
   * Nur die seit `sinceIso` geänderten Programme (§8, `?updated_since=`). Für das
   * Live-Polling — deutlich billiger als ein voller Snapshot.
   */
  listProgramsUpdatedSince(event: string, sinceIso: string): Promise<IveoProgram[]> {
    return this.listPrograms(event, `?limit=200&updated_since=${encodeURIComponent(sinceIso)}`);
  }

  /**
   * Asset-Bytes über die indirekte URL/ID holen (§7): 302 dem signierten Kurzlebigen folgen (Default
   * `redirect:'follow'`). Die signierte URL wird NICHT zurückgegeben/gespeichert — nur die Bytes. Akzeptiert eine volle
   * `…/assets/<id>`-URL ODER die nackte Asset-ID (Material-Assets). Adresse und Token nach `assetAnfrage` (E52): das
   * Token nur an die Herkunft der Basis-URL.
   */
  async fetchAsset(assetUrlOrId: string): Promise<{ bytes: ArrayBuffer; contentType: string | null }> {
    const anfrage = assetAnfrage(assetUrlOrId, this.baseUrl);
    const res = await this.fetchWithRetry(anfrage.url, {
      headers: this.assetKoepfe(anfrage.mitToken),
      redirect: 'follow',
    });
    if (!res.ok) throw new IveoApiError(res.status, `http_${res.status}`, 'iveo: Asset nicht abrufbar');
    return { bytes: await res.arrayBuffer(), contentType: res.headers.get('Content-Type') };
  }

  /**
   * Asset als Datenstrom öffnen (iveo-Paket, Spec 9.6, E46): wie `fetchAsset` (Adresse und Token nach `assetAnfrage`,
   * Umleitung folgen), aber ohne die Bytes in den Speicher zu laden. `signal` ist das Signal des Aufrufers; ein Abbruch
   * darüber wird nicht wiederholt. Das Ergebnis enthält nur Datenstrom, Inhaltstyp und Länge — nie `res.url` oder andere
   * Kopfzeilen, denn nach der Umleitung ist das die signierte Adresse.
   */
  async oeffneAsset(ref: string, opts: { signal?: AbortSignal } = {}): Promise<IveoAssetStrom> {
    const anfrage = assetAnfrage(ref, this.baseUrl);
    const res = await this.fetchWithRetry(anfrage.url, {
      headers: this.assetKoepfe(anfrage.mitToken),
      redirect: 'follow',
      signal: opts.signal,
    });
    if (!res.ok) {
      // Den unbenutzten Datenstrom freigeben, damit die Verbindung nicht offen bleibt.
      void res.body?.cancel().catch(() => undefined);
      throw new IveoApiError(res.status, `http_${res.status}`, 'iveo: Asset nicht abrufbar');
    }
    if (!res.body) throw new Error('iveo: Asset ohne Datenstrom');
    return { body: res.body, contentType: res.headers.get('Content-Type'), contentLength: laengeAus(res.headers.get('Content-Length')) };
  }
}
