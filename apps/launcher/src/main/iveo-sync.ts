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
  buildShowMetadata,
  filterPrograms,
  programTaxonomy,
  programsToAblauf,
  snapshotToShowSpeakers,
  type IveoProgramFilter,
  type IveoShowMetadata,
} from '@jm/iveo';
import type { ShowIveoSpeaker } from '@jm/show';
import { getIveoToken, resolveIveoBaseUrl, setIveoToken } from './settings';
import { sendControlCommand } from './health';
import type { IveoBindInput, IveoBindResult, IveoDiscoverInput, IveoDiscoverResult } from '@shared/types';

/** Poll-Intervall fürs Live-Update während einer offenen Show. */
const POLL_INTERVAL_MS = 45_000;

function nowIso(): string {
  return new Date().toISOString();
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
    // Programm-Filter (#11): nur gewählten Typ/Format in den Ablauf (z. B. Side
    // Events). Taxonomie aus ALLEN Programmen für die Filter-Auswahl im Editor.
    const taxonomy = programTaxonomy(snap.programs);
    const filter: IveoProgramFilter = { typeSlug: input.typeSlug, formatSlug: input.formatSlug };
    const stagesById = new Map(snap.stages.map((s) => [s.id, s]));
    const filtered = filterPrograms(snap.programs, filter);
    const ablauf = programsToAblauf(filtered, { stagesById });
    const speakers = snapshotToShowSpeakers(snap);
    const meta = buildShowMetadata(snap, baseUrl);
    // Token verschlüsselt ablegen (Schlüssel = kanonischer Slug), Cache schreiben.
    setIveoToken(snap.event.slug, token);
    writeCache(meta);
    const warning = skipped.length
      ? `iveo lieferte für ${skipped.join(', ')} keine Daten (Server-Fehler) — nur teilweise übernommen.`
      : undefined;
    const filterLabel = input.typeSlug || input.formatSlug || 'alle';
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
      programCount: ablauf.length,
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
    show.iveo = {
      event: slug,
      baseUrl,
      name,
      syncedAt: nowIso(),
      ...(speakers.length ? { speakers } : {}),
      ...(filter.typeSlug || filter.formatSlug
        ? { filter: { ...(filter.typeSlug ? { typeSlug: filter.typeSlug } : {}), ...(filter.formatSlug ? { formatSlug: filter.formatSlug } : {}) } }
        : {}),
    };
    writeFileSync(path, serializeShow(show, nowIso()), 'utf8');
  } catch (e) {
    getLog().warn(`iveo: Show-Ablauf aktualisieren fehlgeschlagen: ${(e as Error).message}`);
  }
}
