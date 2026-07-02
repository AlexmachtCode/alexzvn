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

import { app } from 'electron';
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
  filterPrograms,
  programDayKey,
  programTaxonomy,
  programsToAblauf,
  programToAblaufItem,
  snapshotToShowSpeakers,
  speakersToShowSpeakers,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoShowMetadata,
  type IveoSnapshot,
} from '@jm/iveo';
import type { ShowIveoSpeaker } from '@jm/show';
import { getIveoToken, resolveIveoBaseUrl, setIveoToken } from './settings';
import { sendControlCommand } from './health';
import type {
  IveoBindInput,
  IveoBindResult,
  IveoDiscoverInput,
  IveoDiscoverResult,
  IveoProgramRef,
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
): Promise<{ ablauf: ReturnType<typeof agendaToAblauf>; speakers: ShowIveoSpeaker[]; warning?: string }> {
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
  const ablauf =
    agenda.length > 0
      ? agendaToAblauf(agenda)
      : source
        ? [programToAblaufItem(source, { stagesById })]
        : [];
  // Speaker-Verknüpfung tolerant aus Detail + Listen-Programm ziehen.
  const ids = new Set<string>([...extractSpeakerIds(detail), ...extractSpeakerIds(listProgram)]);
  let speakers: ShowIveoSpeaker[];
  let warning: string | undefined;
  if (ids.size > 0) {
    speakers = speakersToShowSpeakers(snap.speakers.filter((s) => ids.has(s.id)));
  } else {
    // Diagnose: welche Felder trägt das Detail? (nur Schlüssel, keine PII) — hilft,
    // eine evtl. anders benannte Speaker-Verknüpfung künftig gezielt auszuwerten.
    if (detail) getLog().info(`iveo: Programm-Detail-Felder = ${Object.keys(detail).join(', ')}`);
    speakers = snapshotToShowSpeakers(snap);
    warning = 'iveo verknüpft für dieses Side Event keine Speaker — es werden alle Event-Speaker gezeigt.';
  }
  return { ablauf, speakers, warning };
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
  const token = input.token?.trim();
  if (!token) return { ok: false, error: 'Token fehlt.' };
  const baseUrl = input.baseUrl?.trim() || resolveIveoBaseUrl();
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
  const token = input.token?.trim();
  const event = input.event?.trim();
  if (!token || !event) return { ok: false, error: 'Token und Event erforderlich.' };
  const baseUrl = input.baseUrl?.trim() || resolveIveoBaseUrl();
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
    if (input.programId) {
      // Mode B (#11 Phase 3b): EIN Side Event „im Detail" — Ablauf aus dessen
      // Agenda, Speaker auf dieses Programm eingegrenzt.
      agendaMode = true;
      const resolved = await resolveSideEvent(client, event, input.programId, snap, (m) => subWarnings.push(m));
      ablauf = resolved.ablauf;
      speakers = resolved.speakers;
      if (resolved.warning) subWarnings.push(resolved.warning);
    } else {
      // Mode A: Liste (Tag/Typ/Format, ohne Blocker) → mehrere Side Events als Ablauf.
      const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
      ablauf = programsToAblauf(filterPrograms(snap.programs, filter), { stagesById });
      speakers = snapshotToShowSpeakers(snap);
    }
    const meta = buildShowMetadata(snap, baseUrl);
    // Token verschlüsselt ablegen (Schlüssel = kanonischer Slug), Cache schreiben.
    setIveoToken(snap.event.slug, token);
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
}

let active: ActiveShow | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Nach dem Öffnen einer Show ggf. Live-Polling starten. Bedingung: die Show trägt
 * eine iveo-Bindung UND hier liegt ein Token für dieses Event. Fehlt das Token
 * (Show auf anderem Rechner gebunden), läuft der bereits materialisierte Ablauf
 * aus der Datei offline weiter — kein Fehler.
 */
export function onShowOpened(showPath: string, show: Show): void {
  stopIveoPolling();
  const binding = show.iveo;
  if (!binding?.event) return;
  const token = getIveoToken(binding.event);
  if (!token) {
    getLog().info(
      `iveo: Show ist an Event „${binding.event}" gebunden, aber hier ist kein Token hinterlegt — nur Offline-Ablauf.`,
    );
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
    const ablauf = programsToAblauf(filterPrograms(snap.programs, active.filter), { stagesById });
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
  const agenda = await client.listAgendaItems(a.event, programId); // essenziell → wirft = Poll überspringen
  let ablauf = agendaToAblauf(agenda);
  if (!ablauf.length) {
    // Kein/leerer Agenda → das Programm selbst als ein Punkt (Detail best-effort).
    const detail = await client.getProgram(a.event, programId).catch(() => null);
    if (detail) ablauf = [programToAblaufItem(detail, {})];
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
    show.ablauf = ablauf;
    const compact = compactFilter(filter);
    show.iveo = {
      event: slug,
      baseUrl,
      name,
      syncedAt: nowIso(),
      ...(speakers.length ? { speakers } : {}),
      ...(compact ? { filter: compact } : {}),
    };
    writeFileSync(path, serializeShow(show, nowIso()), 'utf8');
  } catch (e) {
    getLog().warn(`iveo: Show-Ablauf aktualisieren fehlgeschlagen: ${(e as Error).message}`);
  }
}
