// ─────────────────────────────────────────────────────────────────────────────
// iveo-Live-Sync (#11) — der Launcher ist der EINZIGE iveo-Client/Token-Halter.
//
// Aufgaben:
//   • discoverIveoEvents  — Token einmal prüfen + lesbare Events auflisten (GET /).
//   • bindIveoEvent       — Token (verschlüsselt, pro Event) ablegen, Event-Snapshot
//                           holen, zentralen Ablauf materialisieren (für den Show-
//                           Editor) + sanitisierten Metadaten-Cache schreiben.
//   • onShowOpened/poll   — beim Öffnen einer iveo-gebundenen Show live pollen
//                           (?updated_since=), bei Änderung Show-Ablauf neu schreiben
//                           und laufende Tools nicht-destruktiv neu laden lassen.
//
// SICHERHEIT: Das Bearer-Token verlässt diesen Prozess NIE — weder in die
// (portable) .jmshow noch in den Cache noch in den Renderer. In die Show/den Cache
// kommen nur Daten (Ablauf + sanitisierte, feld-allowlistete Metadaten).
// ─────────────────────────────────────────────────────────────────────────────

import { app, dialog, shell } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { parseShow, serializeShow, type Show } from '@jm/show';
import {
  IveoApiError,
  IveoClient,
  agendaToAblauf,
  buildShowMetadata,
  extractSpeakerIds,
  type IveoMaterial,
  filterPrograms,
  localTimeOfDayMs,
  programDayKey,
  programTaxonomy,
  programsToAblauf,
  programToAblaufItem,
  snapshotToShowSpeakers,
  speakerName,
  speakersToShowSpeakers,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoShowMetadata,
  type IveoSnapshot,
} from '@jm/iveo';
import type { ShowIveoSpeaker } from '@jm/show';
import {
  getIveoToken,
  getIveoBaseToken,
  resolveIveoBaseUrl,
  setIveoToken,
  setIveoBaseToken,
} from './settings';
import { sendControlCommand } from './health';
import type {
  ActionResult,
  AppEvent,
  IveoBindInput,
  IveoBindResult,
  IveoDiscoverInput,
  IveoDiscoverResult,
  IveoDownloadInput,
  IveoMaterialRef,
  IveoMaterialsInput,
  IveoMaterialsResult,
  IveoProgramRef,
  IveoSideEventsInput,
  IveoSideEventsResult,
  IveoSwitchInput,
} from '@shared/types';

/** Poll-Intervall fürs Live-Update während einer offenen Show. */
const POLL_INTERVAL_MS = 45_000;

function nowIso(): string {
  return new Date().toISOString();
}

/** Ablauf-Filter für Log/UI knapp beschreiben (leer = „alle"). */
function describeFilter(f: IveoProgramFilter): string {
  if (f.programId) return 'ein Side Event (Agenda)';
  const parts: string[] = [];
  if (f.day) parts.push(`Tag ${f.day}`);
  if (f.typeSlug) parts.push(`Typ ${f.typeSlug}`);
  if (f.formatSlug) parts.push(`Format ${f.formatSlug}`);
  if (f.excludeBlockers) parts.push('ohne Blocker');
  return parts.length ? parts.join(', ') : 'alle';
}

/** Nur die gesetzten Filter-Kriterien in ein token-freies Show-Filter-Objekt übernehmen. */
function compactFilter(f: IveoProgramFilter): NonNullable<Show['iveo']>['filter'] | undefined {
  const out: NonNullable<NonNullable<Show['iveo']>['filter']> = {};
  if (f.typeSlug) out.typeSlug = f.typeSlug;
  if (f.formatSlug) out.formatSlug = f.formatSlug;
  if (f.day) out.day = f.day;
  if (f.excludeBlockers) out.excludeBlockers = true;
  if (f.programId) out.programId = f.programId;
  return Object.keys(out).length ? out : undefined;
}

/** Leichte Programm-Referenzen (id/title/day) für die Side-Event-Auswahl im Editor. */
function toProgramList(programs: IveoProgram[]): IveoProgramRef[] {
  return [...programs]
    .sort((a, b) => {
      const da = programDayKey(a);
      const db = programDayKey(b);
      if (da !== db) return da.localeCompare(db);
      return (a.starts_at_local || a.starts_at || '').localeCompare(b.starts_at_local || b.starts_at || '');
    })
    .map((p) => ({ id: p.id, title: p.title?.trim() || '(ohne Titel)', day: programDayKey(p) }));
}

/** id → Anzeigename aller Event-Speaker (für „Verantwortlich" am Ablauf-Punkt). */
function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string> {
  return new Map(speakers.map((s) => [s.id, speakerName(s)]));
}

/**
 * F3: `withSchedule` (Soll-Startzeit/Kategorie/Verantwortlich je Punkt) im
 * Listen-Pfad (mehrere Programme, KEIN Side Event „im Detail") nur setzen, wenn
 * der gefilterte Ablauf eindeutig EINEM Kalendertag zugehört. Ohne diese Bremse
 * behandelt die Timer-Kettenrechnung jede gesetzte Startzeit als neuen Anker; bei
 * einem mehrtägigen iveo-Plan OHNE Tagesfilter (Uhrzeit ohne Datum) springt die
 * Soll-Uhr für Tag 2 zurück auf dessen erste Startzeit, und die Drift-Pille meldet
 * zweistellige Stunden-Abweichungen gegen die heutige Mitternacht. Ein gesetzter
 * Tagesfilter macht die Zugehörigkeit explizit; ohne ihn (z. B. eintägige Events,
 * für die der Editor gar keinen Tagesfilter anbietet, weil `days.length <= 1`)
 * genügt es, dass alle gefilterten Programme mit Datum denselben Kalendertag
 * tragen. Keine Zahl ist im Livebetrieb besser als eine falsche → im Zweifel false.
 * Der Side-Event-/Agenda-Pfad (`resolveSideEvent`/`pollSideEvent`/
 * `resolveSideEventLight`) ist NICHT betroffen — dort gibt es genau einen Anker.
 */
function scheduleSafeForList(filter: IveoProgramFilter, programs: IveoProgram[]): boolean {
  if ((filter.day || '').trim()) return true;
  const days = new Set<string>();
  for (const p of programs) {
    const d = programDayKey(p);
    if (d) days.add(d);
  }
  return days.size <= 1;
}

/**
 * EIN Side Event „im Detail" auflösen (#11 Phase 3b): Ablauf = dessen Agenda-Punkte
 * (Fallback: das Programm selbst als ein Punkt), Speaker auf dieses Programm
 * eingegrenzt. iveo v1 verknüpft Programme nicht einheitlich mit Speakern — daher
 * tolerant (Detail + Listen-Programm auswerten) mit Fallback auf ALLE Speaker.
 */
async function resolveSideEvent(
  client: IveoClient,
  event: string,
  programId: string,
  snap: IveoSnapshot,
  onNote: (msg: string) => void,
): Promise<{
  ablauf: ReturnType<typeof agendaToAblauf>;
  speakers: ShowIveoSpeaker[];
  warning?: string;
  sideCtx: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
}> {
  const listProgram = snap.programs.find((p) => p.id === programId);
  let detail: IveoProgram | null = null;
  try {
    detail = await client.getProgram(event, programId);
  } catch (e) {
    onNote(`Programm-Detail „${programId}" nicht abrufbar (${(e as Error).message}) — Listen-Daten genutzt.`);
  }
  let agenda: Awaited<ReturnType<IveoClient['listAgendaItems']>> = [];
  let agendaError = false;
  try {
    agenda = await client.listAgendaItems(event, programId);
  } catch (e) {
    agendaError = true;
    getLog().warn(`iveo: agenda-items „${programId}" nicht abrufbar (${(e as Error).message}).`);
    onNote(`Agenda nicht abrufbar (${(e as Error).message}).`);
  }
  const source = detail ?? listProgram;
  const title = source?.title?.trim() || programId;
  // Diagnose deutlich in den Haupt-Log: Agenda leer vs. Fehler vs. vorhanden.
  if (!agendaError) {
    getLog().info(`iveo: Side Event „${title}" — Agenda-Punkte: ${agenda.length}${agenda.length ? '' : ' (in iveo keine Agenda gepflegt → Programm als 1 Punkt)'}.`);
  }
  const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
  const names = speakerNameMap(snap.speakers);
  const firstStartMs = source ? localTimeOfDayMs(source) : null;
  const category = ((source?.format_slug || source?.type_slug) || '').trim() || undefined;
  const ablauf =
    agenda.length > 0
      ? agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: names })
      : source
        ? [programToAblaufItem(source, { stagesById, withSchedule: true, speakerNamesById: names })]
        : [];
  const sideCtx = { firstStartMs, category, speakerNames: [...names] as Array<[string, string]> };
  // Speaker-Verknüpfung tolerant aus Detail + Listen-Programm + Agenda-Items ziehen
  // (iveo v1 surft die Verknüpfung bislang nicht; sobald sie kommt — egal ob am
  // Programm oder an den Agenda-Punkten — greift das hier automatisch).
  const ids = new Set<string>([
    ...extractSpeakerIds(detail),
    ...extractSpeakerIds(listProgram),
    ...agenda.flatMap((it) => extractSpeakerIds(it)),
  ]);
  let speakers: ShowIveoSpeaker[];
  let warning: string | undefined;
  if (ids.size > 0) {
    speakers = speakersToShowSpeakers(snap.speakers.filter((s) => ids.has(s.id)));
    getLog().info(`iveo: Side Event „${title}" — ${ids.size} Speaker verknüpft, ${speakers.length} im Event aufgelöst.`);
  } else {
    // Diagnose: welche Felder tragen Detail UND ein Agenda-Item? (nur Schlüssel,
    // keine PII) — zeigt eine evtl. anders benannte/verschobene Speaker-Verknüpfung.
    if (detail) getLog().info(`iveo: Programm-Detail-Felder = ${Object.keys(detail).join(', ')}`);
    if (agenda[0]) getLog().info(`iveo: Agenda-Item-Felder = ${Object.keys(agenda[0]).join(', ')}`);
    speakers = snapshotToShowSpeakers(snap);
    warning = 'iveo verknüpft für dieses Side Event keine Speaker — es werden alle Event-Speaker gezeigt.';
  }
  return { ablauf, speakers, warning, sideCtx };
}

// ── Metadaten-Cache (appData, token-frei) ────────────────────────────────────
function cacheDir(): string {
  return join(app.getPath('userData'), 'iveo-cache');
}
function cacheFile(slug: string): string {
  return join(cacheDir(), `${slug.replace(/[^a-z0-9_-]/gi, '_')}.json`);
}
function writeCache(meta: IveoShowMetadata): void {
  try {
    mkdirSync(cacheDir(), { recursive: true });
    writeFileSync(cacheFile(meta.slug), JSON.stringify(meta, null, 2), { mode: 0o600 });
  } catch (e) {
    getLog().warn(`iveo: Metadaten-Cache schreiben fehlgeschlagen: ${(e as Error).message}`);
  }
}
function readCache(slug: string): IveoShowMetadata | null {
  try {
    return JSON.parse(readFileSync(cacheFile(slug), 'utf8')) as IveoShowMetadata;
  } catch {
    return null; // kein Cache (Show auf anderem Rechner gebunden) — kein Fehler
  }
}

/** Tag (YYYY-MM-DD) eines gecachten Programms — camelCase, NICHT über programDayKey. */
function metaProgramDay(p: IveoShowMetadata['programs'][number]): string {
  return (p.startsAtLocal || p.startsAt || '').slice(0, 10);
}
/** Lokale Uhrzeit (HH:MM) eines gecachten Programms, falls vorhanden. */
function metaProgramTime(p: IveoShowMetadata['programs'][number]): string | undefined {
  const s = p.startsAtLocal || '';
  const m = /T(\d{2}:\d{2})/.exec(s);
  return m ? m[1] : undefined;
}

// ── Fehler → nutzerfreundlich, ohne rohe Upstream-Antwort ────────────────────
function humanize(e: IveoApiError): string {
  if (e.isUnauthorized) return 'Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).';
  if (e.isNotFoundOrOutOfScope) return 'Event nicht gefunden oder außerhalb des Token-Scopes (404).';
  if (e.status >= 500)
    return `iveo-Server-Fehler (HTTP ${e.status}) — vorübergehend oder serverseitiger Bug. Bitte an den iveo-Entwickler melden (Details im Launcher-Log).`;
  return `iveo-Fehler (${e.code}).`;
}
function toClientError(e: unknown): { code?: string; error: string } {
  if (e instanceof IveoApiError) return { code: e.code, error: humanize(e) };
  return { error: (e as Error)?.message || 'iveo: unbekannter Fehler.' };
}

// ── Discover / Bind (vom Show-Editor via IPC aufgerufen) ─────────────────────

export async function discoverIveoEvents(input: IveoDiscoverInput): Promise<IveoDiscoverResult> {
  const baseUrl = input.baseUrl?.trim() || resolveIveoBaseUrl();
  // C4: kein Token im Feld → den für diese Basis gemerkten nutzen (ein Token gilt
  // basis-weit — die Discovery listet ALLE lesbaren Events), damit ein neues Event
  // derselben Org kein erneutes Einfügen erzwingt. Discover persistiert selbst nichts.
  const token = input.token?.trim() || getIveoBaseToken(baseUrl);
  if (!token) return { ok: false, error: 'Token fehlt.' };
  try {
    const client = new IveoClient({ token, baseUrl });
    const events = await client.discovery();
    return { ok: true, events };
  } catch (e) {
    getLog().warn(`iveo discover fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
}

export async function bindIveoEvent(input: IveoBindInput): Promise<IveoBindResult> {
  const baseUrl = input.baseUrl?.trim() || resolveIveoBaseUrl();
  // C4: Token-Fallback wie bei discover (basis-weit gemerkter Token).
  const token = input.token?.trim() || getIveoBaseToken(baseUrl);
  const event = input.event?.trim();
  if (!token || !event) return { ok: false, error: 'Token und Event erforderlich.' };
  try {
    const client = new IveoClient({ token, baseUrl });
    // Initialer Bind resilient: ein serverseitiger 500 (z. B. auf /programs) soll
    // nicht ALLES blockieren — Event + verfügbare Daten binden, Rest als Warnung.
    const skipped: string[] = [];
    const snap = await client.getEventSnapshot(event, nowIso(), {
      programsBestEffort: true,
      onSubError: (resource, e) => {
        skipped.push(resource);
        getLog().warn(`iveo bind: „${resource}" übersprungen (${(e as Error).message})`);
      },
    });
    // Programm-Filter (#11): nur gewählten Typ/Format/Tag in den Ablauf (z. B. Side
    // Events). Taxonomie + Programm-Liste aus ALLEN Programmen für die Auswahl im Editor.
    const taxonomy = programTaxonomy(snap.programs);
    const programList = toProgramList(snap.programs);
    // Side Events des Tages (token-frei, id+title) → in die Show backen, damit
    // Launcher-Panel/Rundown live umschalten können (ohne selbst iveo abzufragen).
    const dayFilter: IveoProgramFilter = {
      typeSlug: input.typeSlug,
      formatSlug: input.formatSlug,
      day: input.day,
      excludeBlockers: input.excludeBlockers,
    };
    const sideEvents = toProgramList(filterPrograms(snap.programs, dayFilter)).map((p) => ({
      id: p.id,
      title: p.title,
    }));
    const filter: IveoProgramFilter = {
      typeSlug: input.typeSlug,
      formatSlug: input.formatSlug,
      day: input.day,
      excludeBlockers: input.excludeBlockers,
      programId: input.programId,
    };
    const subWarnings: string[] = [];
    let ablauf: ReturnType<typeof programsToAblauf>;
    let speakers: ShowIveoSpeaker[];
    let agendaMode = false;
    let sideCtx: ActiveShow['sideCtx'];
    if (input.programId) {
      // Mode B (#11 Phase 3b): EIN Side Event „im Detail" — Ablauf aus dessen
      // Agenda, Speaker auf dieses Programm eingegrenzt.
      agendaMode = true;
      const resolved = await resolveSideEvent(client, event, input.programId, snap, (m) => subWarnings.push(m));
      ablauf = resolved.ablauf;
      speakers = resolved.speakers;
      sideCtx = resolved.sideCtx;
      if (resolved.warning) subWarnings.push(resolved.warning);
    } else {
      // Mode A: Liste (Tag/Typ/Format, ohne Blocker) → mehrere Side Events als Ablauf.
      const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
      const listPrograms = filterPrograms(snap.programs, filter);
      ablauf = programsToAblauf(listPrograms, {
        stagesById,
        // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
        withSchedule: scheduleSafeForList(filter, listPrograms),
        speakerNamesById: speakerNameMap(snap.speakers),
      });
      speakers = snapshotToShowSpeakers(snap);
    }
    // Re-Bind einer bereits aktiv pollenden Show DESSELBEN Events (#11 Sub-B):
    // `bindIveoEvent` selbst hat keinen Show-Pfad und setzt `active` nicht (das
    // passiert erst später beim Öffnen, s. `onShowOpened`). Ist aber GENAU diese
    // Show gerade schon aktiv (gleicher Event-Slug), den frischen Side-Event-
    // Kontext sofort übernehmen — sonst würde der nächste Poll ohne die neuen
    // Felder rechnen und sie aus der Datei wieder entfernen (Signatur-Stabilität).
    // F2: NEBEN dem Event-Slug auch die programId vergleichen — sonst überschreibt
    // ein Vorbereitungs-Bind desselben Events auf ein ANDERES Side Event (z. B.
    // P2, während die laufende Show noch an P1 gebunden ist) sofort den sideCtx
    // der laufenden Show, während `active.filter.programId` weiter auf P1 steht:
    // der nächste Poll baut P1s Agenda dann mit P2s Startzeit/Kategorie und stößt
    // ein RELOAD mit falschen Werten an. Nur ein Re-Bind DESSELBEN Side Events
    // darf den Kontext auffrischen.
    if (active && active.event === snap.event.slug && active.filter.programId === input.programId) {
      active.sideCtx = agendaMode ? sideCtx : undefined;
    }
    const meta = buildShowMetadata(snap, baseUrl);
    // Token verschlüsselt ablegen (Schlüssel = kanonischer Slug), Cache schreiben.
    setIveoToken(snap.event.slug, token);
    // C4: zusätzlich basis-weit merken → nächstes Event derselben Org ohne Neu-Eingabe.
    setIveoBaseToken(baseUrl, token);
    writeCache(meta);
    const warnParts = [
      ...(skipped.length ? [`iveo lieferte für ${skipped.join(', ')} keine Daten (Server-Fehler)`] : []),
      ...subWarnings,
    ];
    const warning = warnParts.length ? warnParts.join(' · ') : undefined;
    const filterLabel = describeFilter(filter);
    getLog().info(
      `iveo: Event „${snap.event.name}" gebunden — ${ablauf.length}/${snap.programs.length} Programmpunkte ` +
        `(Filter: ${filterLabel}), ${speakers.length} Speaker${skipped.length ? ` (übersprungen: ${skipped.join(', ')})` : ''}.`,
    );
    return {
      ok: true,
      ablauf,
      speakers,
      event: { slug: snap.event.slug, name: snap.event.name },
      programTypes: taxonomy,
      programList,
      sideEvents,
      programCount: ablauf.length,
      agenda: agendaMode,
      ...(warning ? { warning } : {}),
    };
  } catch (e) {
    getLog().warn(`iveo bind fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
}

// ── Live-Polling der aktuell geöffneten Show ─────────────────────────────────

interface ActiveShow {
  path: string;
  /** Kanonischer Event-Slug (Token-Schlüssel). */
  event: string;
  baseUrl: string;
  /** Letzter erfolgreicher Sync (ISO) — Basis fürs ?updated_since=. */
  lastSyncIso: string;
  /** Ablauf-Filter der Show (identisch zum Bind) — für konsistente Live-Updates. */
  filter: IveoProgramFilter;
  /** Signatur des zuletzt geschriebenen Ablaufs (Agenda-Modus) — verhindert unnötige RELOADs. */
  lastSig?: string;
  /**
   * Beim Bind/Switch ermittelter Side-Event-Kontext (#11 Sub-B). `pollSideEvent`
   * hat keinen Snapshot; ohne diesen Merker würde der Poll einen Ablauf OHNE
   * Startzeit/Kategorie/Verantwortlich erzeugen → andere `lastSig` bei jedem Poll
   * (RELOAD-Sturm) und Feldverlust in der Show. Namen als Array-Paare, damit der
   * Merker klonbar/serialisierbar bleibt.
   */
  sideCtx?: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
}

let active: ActiveShow | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Token-freier Merker der aktuell offenen iveo-Show (auch wenn HIER kein Token
 * liegt) — für das Auflisten der Side Events im Launcher-Panel. `canSwitch` sagt,
 * ob live umgeschaltet werden kann (nur mit Token = `active !== null`).
 */
interface OpenShowIveo {
  path: string;
  slug: string;
  name: string;
  day?: string;
}
let openShowIveo: OpenShowIveo | null = null;

/** Renderer-Emitter (aus index.ts injiziert) — Panel über aktive Show/Side-Event informieren. */
let emitIveo: ((e: AppEvent) => void) | null = null;
export function setIveoEmitter(fn: (e: AppEvent) => void): void {
  emitIveo = fn;
}
function emitActiveChanged(): void {
  if (!openShowIveo) return;
  emitIveo?.({
    type: 'iveo-active-changed',
    event: openShowIveo.name,
    day: openShowIveo.day,
    activeProgramId: active?.filter.programId,
    canSwitch: active !== null,
  });
}

/** STATE-Werte für den Launcher-Steuerserver (Companion-Variablen, #11). */
export function iveoStateKv(): Record<string, string> {
  return {
    iveo_event: openShowIveo?.name ?? '',
    iveo_day: active?.filter.day ?? openShowIveo?.day ?? '',
    iveo_side_event: active?.filter.programId ?? '',
  };
}

/**
 * Nach dem Öffnen einer Show ggf. Live-Polling starten. Bedingung: die Show trägt
 * eine iveo-Bindung UND hier liegt ein Token für dieses Event. Fehlt das Token
 * (Show auf anderem Rechner gebunden), läuft der bereits materialisierte Ablauf
 * aus der Datei offline weiter — kein Fehler.
 */
export function onShowOpened(showPath: string, show: Show): void {
  stopIveoPolling();
  openShowIveo = null;
  const binding = show.iveo;
  if (!binding?.event) {
    emitIveo?.({ type: 'iveo-active-changed', event: '', canSwitch: false }); // Panel leeren
    return;
  }
  // Merker IMMER setzen (auch ohne Token) → Panel kann Side Events aus dem Cache listen.
  openShowIveo = {
    path: showPath,
    slug: binding.event,
    name: binding.name || binding.event,
    day: binding.filter?.day,
  };
  const token = getIveoToken(binding.event);
  if (!token) {
    getLog().info(
      `iveo: Show ist an Event „${binding.event}" gebunden, aber hier ist kein Token hinterlegt — nur Offline-Ablauf (kein Live-Umschalten).`,
    );
    emitActiveChanged();
    return;
  }
  active = {
    path: showPath,
    event: binding.event,
    baseUrl: binding.baseUrl || resolveIveoBaseUrl(),
    lastSyncIso: binding.syncedAt || nowIso(),
    filter: binding.filter ?? {},
  };
  pollTimer = setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);
  getLog().info(`iveo: Live-Polling für Event „${binding.event}" aktiv (alle ${POLL_INTERVAL_MS / 1000}s).`);
  emitActiveChanged();
}

export function stopIveoPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  active = null;
}

async function pollOnce(): Promise<void> {
  if (!active) return;
  const token = getIveoToken(active.event);
  if (!token) {
    stopIveoPolling();
    return;
  }
  try {
    const client = new IveoClient({ token, baseUrl: active.baseUrl });
    // Agenda-Modus (ein Side Event): Agenda-Änderungen bumpen das Programm-
    // `updated_at` NICHT (§8) → hier die Agenda direkt neu holen und nur bei
    // echter Änderung neu schreiben (Signatur-Vergleich, kein RELOAD-Spam).
    if (active.filter.programId) {
      await pollSideEvent(client, active);
      return;
    }
    const changed = await client.listProgramsUpdatedSince(active.event, active.lastSyncIso);
    if (!changed.length) return; // nichts Neues seit dem letzten Sync
    getLog().info(`iveo: ${changed.length} Programm(e) geändert → Ablauf neu materialisieren.`);
    // Poll: Programme ESSENZIELL (kein programsBestEffort) — ein transienter 500
    // soll den vorhandenen Ablauf NICHT mit [] überschreiben (Snapshot wirft dann,
    // der catch unten überspringt diesen Poll-Durchlauf).
    const snap = await client.getEventSnapshot(active.event, nowIso(), {
      onSubError: (resource, e) =>
        getLog().warn(`iveo poll: Metadaten „${resource}" übersprungen (${(e as Error).message})`),
    });
    const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
    const listPrograms = filterPrograms(snap.programs, active.filter);
    const ablauf = programsToAblauf(listPrograms, {
      stagesById,
      // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
      withSchedule: scheduleSafeForList(active.filter, listPrograms),
      speakerNamesById: speakerNameMap(snap.speakers),
    });
    const speakers = snapshotToShowSpeakers(snap);
    writeCache(buildShowMetadata(snap, active.baseUrl));
    rewriteShowAblauf(active.path, snap.event.slug, active.baseUrl, snap.event.name, ablauf, speakers, active.filter);
    active.lastSyncIso = snap.fetchedAt;
    // Laufende Tools nicht-destruktiv neu laden lassen (sie lesen die Datei neu).
    const timers = sendControlCommand('jm-timer', 'TIMER RELOAD');
    const titlers = sendControlCommand('jm-titler', 'TITLER RELOAD');
    getLog().info(
      `iveo: RELOAD → ${timers} Timer, ${titlers} Titler benachrichtigt.`,
    );
  } catch (e) {
    // Transient (Netz/5xx/429) — Poller läuft weiter; nur warnen.
    getLog().warn(`iveo poll: ${(e as Error).message}`);
  }
}

/**
 * Agenda-Modus-Poll (#11 Phase 3b): nur die Agenda-Punkte des gebundenen Side
 * Events neu holen und bei echter Änderung den Ablauf neu schreiben. Speaker
 * bleiben wie beim Bind (Neu-Eingrenzung nur beim erneuten Binden) — sie ändern
 * sich selten und ein voller Speaker-Abruf je Poll wäre unnötig teuer.
 */
async function pollSideEvent(client: IveoClient, a: ActiveShow): Promise<void> {
  const programId = a.filter.programId!;
  // agenda-items (staging) kann instabil sein → still auf das Programm-Detail
  // zurückfallen statt jede 45s zu warnen (der Fehler ist beim Umschalten/bei den
  // Materialien bereits sichtbar).
  let agenda: Awaited<ReturnType<IveoClient['listAgendaItems']>> = [];
  try {
    agenda = await client.listAgendaItems(a.event, programId);
  } catch {
    /* Endpoint-Fehler → Fallback unten (Programm als 1 Punkt), kein RELOAD-Spam */
  }
  // F5: `detail` einmal für BEIDE Stellen halten, die es ggf. brauchen (lazy
  // sideCtx-Auflösung unten + der Empty-Ablauf-Fallback weiter unten) — sonst ruft
  // der allererste Poll mit leerer Agenda `getProgram` zweimal. Weiterhin nur
  // abrufen, wenn tatsächlich gebraucht (kein sideCtx ODER leere Agenda), nicht
  // pauschal bei jedem Poll.
  let cachedDetail: IveoProgram | null = null;
  let detailFetched = false;
  const ensureDetail = async (): Promise<IveoProgram | null> => {
    if (!detailFetched) {
      cachedDetail = await client.getProgram(a.event, programId).catch(() => null);
      detailFetched = true;
    }
    return cachedDetail;
  };
  // Beim Öffnen einer gespeicherten Show ist kein sideCtx gesetzt (der entsteht nur
  // beim Binden/Umschalten). Einmalig nachziehen — sonst schreibt der erste Poll den
  // Ablauf ohne Startzeit/Kategorie/Verantwortlich zurück und löscht die Felder.
  if (!a.sideCtx) {
    const detail = await ensureDetail();
    const ids = [
      ...new Set<string>([...extractSpeakerIds(detail), ...agenda.flatMap((it) => extractSpeakerIds(it))]),
    ];
    let speakerNames: Array<[string, string]> | undefined;
    if (ids.length) {
      try {
        const all = await client.listSpeakers(a.event);
        speakerNames = [...speakerNameMap(all)] as Array<[string, string]>;
      } catch {
        /* Speakerliste nicht ladbar → owner bleibt leer, kein Fehler */
      }
    }
    // F4: den Kontext nur dauerhaft merken, wenn das Detail tatsächlich geladen
    // wurde — sonst würde ein transienter Netzfehler beim allerersten Poll
    // `a.sideCtx` mit Leerwerten setzen, der Guard `if (!a.sideCtx)` griffe nie
    // wieder, und die Felder fehlten für den Rest der Sitzung ohne Warnung.
    // Bleibt `detail` null, bleibt `a.sideCtx` undefined → nächster Poll versucht
    // es erneut (kein zusätzlicher Abruf im Normalfall, nur bei Fehlschlag).
    if (detail) {
      a.sideCtx = {
        firstStartMs: localTimeOfDayMs(detail),
        category: ((detail.format_slug || detail.type_slug) || '').trim() || undefined,
        speakerNames,
      };
    }
  }
  const ctx = a.sideCtx;
  const names = ctx?.speakerNames ? new Map(ctx.speakerNames) : undefined;
  let ablauf = agendaToAblauf(agenda, {
    firstStartMs: ctx?.firstStartMs ?? null,
    category: ctx?.category,
    speakerNamesById: names,
  });
  if (!ablauf.length) {
    // Kein/leerer Agenda → das Programm selbst als ein Punkt (Detail best-effort).
    const detail = await ensureDetail();
    if (detail) ablauf = [programToAblaufItem(detail, { withSchedule: true, speakerNamesById: names })];
  }
  if (!ablauf.length) return;
  const sig = JSON.stringify(ablauf);
  if (sig === a.lastSig) return; // nichts geändert → kein RELOAD
  a.lastSig = sig;
  // Vorhandene Speaker/Name aus der Datei erhalten (nicht neu eingrenzen).
  let name = a.event;
  let speakers: ShowIveoSpeaker[] = [];
  try {
    const cur = parseShow(readFileSync(a.path, 'utf8'));
    name = cur.iveo?.name || name;
    speakers = cur.iveo?.speakers ?? [];
  } catch {
    /* Datei nicht lesbar → mit Defaults weiterschreiben */
  }
  getLog().info(`iveo: Agenda von Side Event geändert → ${ablauf.length} Punkte neu materialisieren.`);
  rewriteShowAblauf(a.path, a.event, a.baseUrl, name, ablauf, speakers, a.filter);
  const timers = sendControlCommand('jm-timer', 'TIMER RELOAD');
  const titlers = sendControlCommand('jm-titler', 'TITLER RELOAD');
  getLog().info(`iveo: RELOAD → ${timers} Timer, ${titlers} Titler benachrichtigt.`);
}

/** Ablauf + Speaker + token-freie iveo-Bindung (inkl. Filter) in die .jmshow zurückschreiben. */
function rewriteShowAblauf(
  path: string,
  slug: string,
  baseUrl: string,
  name: string,
  ablauf: Show['ablauf'],
  speakers: ShowIveoSpeaker[],
  filter: IveoProgramFilter,
): void {
  try {
    const show = parseShow(readFileSync(path, 'utf8'));
    // Vorhandene, token-freie Side-Event-Liste erhalten (fürs Live-Umschalten).
    const sideEvents = show.iveo?.sideEvents;
    show.ablauf = ablauf;
    const compact = compactFilter(filter);
    show.iveo = {
      event: slug,
      baseUrl,
      name,
      syncedAt: nowIso(),
      ...(speakers.length ? { speakers } : {}),
      ...(sideEvents?.length ? { sideEvents } : {}),
      ...(compact ? { filter: compact } : {}),
    };
    writeFileSync(path, serializeShow(show, nowIso()), 'utf8');
  } catch (e) {
    getLog().warn(`iveo: Show-Ablauf aktualisieren fehlgeschlagen: ${(e as Error).message}`);
  }
}

// ── Live-Umschalter für Side Events (#11) ────────────────────────────────────
// Die .jmshow bindet Event+Tag EINMAL; welches Side Event „live" läuft, ist
// Laufzeit-Zustand — kein neues Show-File je Side Event. Auflisten geht token-frei
// aus dem Cache; Umschalten braucht das Token (Launcher = single-holder).

/** Side Events der offenen Show (aus dem Cache, token-frei) für das Umschalt-Panel. */
export function listSideEvents(input: IveoSideEventsInput = {}): IveoSideEventsResult {
  if (!openShowIveo) return { ok: false, error: 'Keine iveo-gebundene Show geöffnet.' };
  const meta = readCache(openShowIveo.slug);
  if (!meta) {
    return {
      ok: false,
      error: 'Kein iveo-Cache vorhanden (Show auf anderem Rechner gebunden?).',
      event: openShowIveo.name,
      canSwitch: active !== null,
    };
  }
  const dayMap = new Map<string, number>();
  for (const p of meta.programs) {
    const d = metaProgramDay(p);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const days = [...dayMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
  const day = input.day || openShowIveo.day || days[0]?.value || '';
  const programs: IveoProgramRef[] = meta.programs
    .filter((p) => !day || metaProgramDay(p) === day)
    .sort((a, b) => (a.startsAtLocal || a.startsAt || '').localeCompare(b.startsAtLocal || b.startsAt || ''))
    .map((p) => {
      const time = metaProgramTime(p);
      return { id: p.id, title: p.title, day: metaProgramDay(p), ...(time ? { time } : {}) };
    });
  return {
    ok: true,
    event: meta.name,
    day,
    days,
    programs,
    activeProgramId: active?.filter.programId,
    canSwitch: active !== null,
  };
}

/** Aktuelle Speaker-Liste aus der offenen Show lesen (Fallback beim Umschalten). */
function readShowSpeakers(path: string): ShowIveoSpeaker[] {
  try {
    return parseShow(readFileSync(path, 'utf8')).iveo?.speakers ?? [];
  } catch {
    return [];
  }
}

/**
 * Ein Side Event leichtgewichtig auflösen (nur Detail + agenda-items, KEIN voller
 * Snapshot) — für schnelles Live-Umschalten. Speaker werden nur dann neu geholt/
 * eingegrenzt, wenn iveo tatsächlich eine Verknüpfung liefert; sonst bleibt die
 * bestehende (Event-)Speakerliste erhalten.
 */
async function resolveSideEventLight(
  client: IveoClient,
  event: string,
  programId: string,
  fallbackSpeakers: ShowIveoSpeaker[],
): Promise<{
  ablauf: ReturnType<typeof agendaToAblauf>;
  speakers: ShowIveoSpeaker[];
  warning?: string;
  sideCtx: { firstStartMs: number | null; category?: string; speakerNames?: Array<[string, string]> };
}> {
  const detail = await client.getProgram(event, programId).catch((e) => {
    getLog().warn(`iveo switch: Detail „${programId}" nicht abrufbar (${(e as Error).message}).`);
    return null;
  });
  let agenda: Awaited<ReturnType<IveoClient['listAgendaItems']>> = [];
  try {
    agenda = await client.listAgendaItems(event, programId);
  } catch (e) {
    getLog().warn(`iveo switch: agenda-items „${programId}" nicht abrufbar (${(e as Error).message}).`);
  }
  const ids = [
    ...new Set<string>([...extractSpeakerIds(detail), ...agenda.flatMap((it) => extractSpeakerIds(it))]),
  ];
  let speakers = fallbackSpeakers;
  let warning: string | undefined;
  // Namensquelle für „Verantwortlich" (#11 Sub-B): nur die volle Speakerliste trägt
  // ids; die sanitisierten fallbackSpeakers haben keine. Ohne Verknüpfung bleibt die
  // Map leer → owner bleibt leer (kein Fehler).
  let namesMap: Map<string, string> | undefined;
  if (ids.length) {
    try {
      const all = await client.listSpeakers(event);
      speakers = speakersToShowSpeakers(all.filter((s) => ids.includes(s.id)));
      namesMap = speakerNameMap(all);
      getLog().info(`iveo switch: ${ids.length} Speaker verknüpft, ${speakers.length} aufgelöst.`);
    } catch {
      /* Speakerliste nicht ladbar → Fallback bleibt, owner bleibt leer */
    }
  } else {
    if (detail) getLog().info(`iveo switch: Programm-Detail-Felder = ${Object.keys(detail).join(', ')}`);
    if (agenda[0]) getLog().info(`iveo switch: Agenda-Item-Felder = ${Object.keys(agenda[0]).join(', ')}`);
    warning = 'iveo verknüpft keine Speaker mit diesem Side Event — bestehende Speakerliste bleibt.';
  }
  const firstStartMs = detail ? localTimeOfDayMs(detail) : null;
  const category = ((detail?.format_slug || detail?.type_slug) || '').trim() || undefined;
  let ablauf = agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: namesMap });
  if (!ablauf.length && detail) {
    ablauf = [programToAblaufItem(detail, { withSchedule: true, speakerNamesById: namesMap })];
  }
  getLog().info(
    `iveo: Side Event „${detail?.title?.trim() || programId}" — Agenda-Punkte: ${agenda.length}` +
      `${agenda.length ? '' : ' (keine → Programm als 1 Punkt)'}.`,
  );
  return {
    ablauf,
    speakers,
    warning,
    sideCtx: { firstStartMs, category, speakerNames: namesMap ? ([...namesMap] as Array<[string, string]>) : undefined },
  };
}

/**
 * Live auf ein Side Event umschalten (oder zurück auf die Tagesübersicht) — schreibt
 * Ablauf+Speaker in die offene Show und lässt Timer/Titler neu laden. Braucht ein
 * Token für die offene Show (`active`).
 */
export async function switchSideEvent(input: IveoSwitchInput): Promise<ActionResult> {
  if (!active) {
    return { ok: false, message: 'Kein iveo-Token für die offene Show — Live-Umschalten nicht möglich.' };
  }
  const token = getIveoToken(active.event);
  if (!token) return { ok: false, message: 'iveo-Token nicht mehr vorhanden.' };
  const programId = input.programId?.trim();
  try {
    const client = new IveoClient({ token, baseUrl: active.baseUrl });
    let ablauf: ReturnType<typeof agendaToAblauf> = [];
    let speakers: ShowIveoSpeaker[] = [];
    let name = openShowIveo?.name ?? active.event;
    let warning: string | undefined;
    if (programId) {
      const r = await resolveSideEventLight(client, active.event, programId, readShowSpeakers(active.path));
      ablauf = r.ablauf;
      speakers = r.speakers;
      warning = r.warning;
      active.sideCtx = r.sideCtx;
      active.filter = { ...active.filter, programId };
    } else {
      // Tagesübersicht: alle Side Events des Tages (voller Snapshot nötig).
      const day = input.day || active.filter.day;
      const snap = await client.getEventSnapshot(active.event, nowIso(), { onSubError: () => {} });
      const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
      const f: IveoProgramFilter = { ...active.filter, programId: undefined, day };
      const listPrograms = filterPrograms(snap.programs, f);
      ablauf = programsToAblauf(listPrograms, {
        stagesById,
        // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
        withSchedule: scheduleSafeForList(f, listPrograms),
        speakerNamesById: speakerNameMap(snap.speakers),
      });
      active.sideCtx = undefined;
      speakers = snapshotToShowSpeakers(snap);
      name = snap.event.name;
      active.filter = f;
      writeCache(buildShowMetadata(snap, active.baseUrl));
    }
    if (!ablauf.length) return { ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' };
    active.lastSig = JSON.stringify(ablauf);
    if (openShowIveo) openShowIveo.day = active.filter.day;
    rewriteShowAblauf(active.path, active.event, active.baseUrl, name, ablauf, speakers, active.filter);
    const timers = sendControlCommand('jm-timer', 'TIMER RELOAD');
    const titlers = sendControlCommand('jm-titler', 'TITLER RELOAD');
    getLog().info(
      `iveo: Side-Event-Umschaltung → ${ablauf.length} Punkte, ${speakers.length} Speaker; RELOAD ${timers} Timer/${titlers} Titler.`,
    );
    emitActiveChanged();
    return {
      ok: true,
      message: warning ? `Umgeschaltet — ${warning}` : `Umgeschaltet (${ablauf.length} Punkte).`,
    };
  } catch (e) {
    getLog().warn(`iveo switch fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, message: toClientError(e).error };
  }
}

// ── Materialien eines Side Events (#11 Phase 4) ──────────────────────────────
// Präsentationen/Dateien hängen in iveo an den Agenda-Punkten eines Programms
// (materials[]). Datei-Assets werden über die 302-Indirektion mit Token geladen
// (der Launcher hält es); die signierte URL wird NIE gespeichert.

const MIME_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'text/plain': '.txt',
  'video/mp4': '.mp4',
};
/** Passende Dateiendung: liegt sie schon im Label, keine ergänzen; sonst aus dem MIME. */
function extFor(label: string, mime?: string | null): string {
  if (/\.[a-z0-9]{2,5}$/i.test(label || '')) return '';
  return (mime && MIME_EXT[mime.toLowerCase()]) || '';
}

/** Alle Materialien eines Side Events (aus dessen Agenda-Punkten) auflisten. */
export async function listSideEventMaterials(input: IveoMaterialsInput): Promise<IveoMaterialsResult> {
  if (!active) return { ok: false, error: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(active.event);
  if (!token) return { ok: false, error: 'Kein iveo-Token für die offene Show.' };
  const programId = input.programId?.trim();
  if (!programId) return { ok: false, error: 'programId fehlt.' };
  try {
    const client = new IveoClient({ token, baseUrl: active.baseUrl });
    const agenda = await client.listAgendaItems(active.event, programId);
    const materials: IveoMaterialRef[] = [];
    for (const item of agenda) {
      for (const m of item.materials ?? []) {
        materials.push({
          id: m.id,
          label: m.label || '(ohne Titel)',
          kind: m.kind,
          agendaTitle: item.title,
          mimeType: m.asset?.mime_type ?? null,
          sizeBytes: m.asset?.size_bytes ?? null,
          externalUrl: m.external_url ?? null,
          hasAsset: !!m.asset?.url,
        });
      }
    }
    getLog().info(`iveo: Side Event „${programId}" — ${materials.length} Material(ien).`);
    return { ok: true, materials };
  } catch (e) {
    getLog().warn(`iveo materials: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
}

/** Ein Material herunterladen (Datei speichern + öffnen) bzw. öffnen (Link). */
export async function downloadSideEventMaterial(input: IveoDownloadInput): Promise<ActionResult> {
  if (!active) return { ok: false, message: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(active.event);
  if (!token) return { ok: false, message: 'Kein iveo-Token für die offene Show.' };
  try {
    const client = new IveoClient({ token, baseUrl: active.baseUrl });
    const agenda = await client.listAgendaItems(active.event, input.programId);
    let target: IveoMaterial | undefined;
    for (const item of agenda) {
      const m = (item.materials ?? []).find((x) => x.id === input.materialId);
      if (m) {
        target = m;
        break;
      }
    }
    if (!target) return { ok: false, message: 'Material nicht gefunden.' };
    // Link → einfach im Browser öffnen (kein Token nötig).
    if (target.kind === 'link' || (!target.asset?.url && target.external_url)) {
      if (!target.external_url) return { ok: false, message: 'Kein Link vorhanden.' };
      await shell.openExternal(target.external_url);
      return { ok: true, message: `Link geöffnet: ${target.label}` };
    }
    if (!target.asset?.url) return { ok: false, message: 'Kein Datei-Asset vorhanden.' };
    // Datei-Asset: mit Token holen (302-Follow im Client), dann speichern.
    const { bytes, contentType } = await client.fetchAsset(target.asset.url);
    const ext = extFor(target.label, target.asset.mime_type ?? contentType);
    const safe = (target.label || 'material').replace(/[\\/:*?"<>|]/g, '_');
    const r = await dialog.showSaveDialog({ title: 'Material speichern', defaultPath: `${safe}${ext}` });
    if (r.canceled || !r.filePath) return { ok: false };
    writeFileSync(r.filePath, Buffer.from(bytes));
    void shell.openPath(r.filePath); // zum Testen gleich öffnen
    getLog().info(`iveo: Material „${target.label}" gespeichert (${bytes.byteLength} Bytes) → ${r.filePath}`);
    return { ok: true, message: `Gespeichert & geöffnet: ${target.label}` };
  } catch (e) {
    getLog().warn(`iveo download: ${(e as Error).message}`);
    return { ok: false, message: toClientError(e).error };
  }
}
