// ─────────────────────────────────────────────────────────────────────────────
// iveo-Live-Sync (#11) — der Launcher ist der EINZIGE iveo-Client/Token-Halter.
//
// Seit Master-Link Teil 2a (Spec 7.0) die dünne Electron-Hülle um den Kern
// `iveo-abgleich-kern.ts` (ohne Electron, testbar):
//   • discoverIveoEvents  — Token einmal prüfen + lesbare Events auflisten (GET /).
//   • bindIveoEvent       — Token (verschlüsselt, pro Event) ablegen, Event-Snapshot
//                           holen, zentralen Ablauf materialisieren (für den Show-
//                           Editor) + sanitisierten Metadaten-Cache schreiben.
//   • onShowOpened/Takt   — Abfrage, Umschalten, Signatur, Generation, Schreiben und
//                           Status macht der Kern; die Hülle liefert Einstellungen,
//                           Token, Health, Cache, Renderer-Ereignisse und den Takt.
//   • speichereShowDatei  — Show aus dem Show-Editor atomar schreiben; ist es die
//                           offene Show, setzt sich der Kern neu auf (Spec 7.5).
//   • Materialien         — Auflisten/Herunterladen (Dialog, Shell) bleibt hier.
//
// SICHERHEIT: Das Bearer-Token verlässt diesen Prozess NIE — weder in die
// (portable) .jmshow noch in den Cache noch in den Renderer. In die Show/den Cache
// kommen nur Daten (Ablauf + sanitisierte, feld-allowlistete Metadaten).
// ─────────────────────────────────────────────────────────────────────────────

import { app, dialog, shell } from 'electron';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { serializeShow, type Show } from '@jm/show';
import {
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
  snapshotToShowSpeakers,
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
import {
  einPunktAblauf,
  erzeugeKern,
  scheduleSafeForList,
  speakerNameMap,
  toClientError,
  type IveoKern,
  type IveoSyncStatus,
} from './iveo-abgleich-kern';
import {
  abfrageTakt,
  gleicherShowPfad,
  IVEO_ABRUF_ZEITGRENZE_MS,
  mitZeitgrenze,
  nurBeiWechsel,
  showLeserFuerKern,
  showSchreiberFuerKern,
} from './iveo-huelle-hilfen';
import { schreibeShowAtomar, warteSync } from './show-schreiben';
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

/** Abfragetakt fürs Live-Update der offenen Show: 45 s; nur Tests verkürzen ihn (JMPS_IVEO_POLL_MS, Spec 7.0). */
const POLL_INTERVAL_MS = abfrageTakt(process.env['JMPS_IVEO_POLL_MS']);

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

// speakerNameMap, scheduleSafeForList (F3), toClientError und einPunktAblauf liegen
// seit Teil 2a im Kern (iveo-abgleich-kern.ts) und werden von dort importiert.

/**
 * EIN Side Event „im Detail" auflösen (#11 Phase 3b): Ablauf = dessen Agenda-Punkte
 * (Fallback: das Programm selbst als ein Punkt), Speaker auf dieses Programm
 * eingegrenzt. iveo v1 verknüpft Programme nicht einheitlich mit Speakern — daher
 * tolerant (Detail + Listen-Programm auswerten) mit Fallback auf ALLE Speaker.
 * Den 1-Punkt-Ablauf baut `einPunktAblauf` aus dem Kern, OHNE `stagesById` — genau
 * wie Abfrage und Umschalten. Sonst brächte die erste Abfrage nach dem Binden bei
 * jedem Side Event ohne Agenda ein Schein-„geändert“ (Spec 7.2).
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
  const names = speakerNameMap(snap.speakers);
  const firstStartMs = source ? localTimeOfDayMs(source) : null;
  const category = ((source?.format_slug || source?.type_slug) || '').trim() || undefined;
  const ablauf =
    agenda.length > 0
      ? agendaToAblauf(agenda, { firstStartMs, category, speakerNamesById: names })
      : source
        ? [einPunktAblauf(source, names)]
        : [];
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

/** iveo-Client mit Zeitgrenze je Abruf (15 s, Spec 7.0) — Abfrage, Umschalten, Binden, Listen. */
function iveoClient(token: string, baseUrl: string): IveoClient {
  return new IveoClient({
    token,
    baseUrl,
    fetchImpl: mitZeitgrenze((url, init) => fetch(url, init), IVEO_ABRUF_ZEITGRENZE_MS),
  });
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
    const client = iveoClient(token, baseUrl);
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
    const client = iveoClient(token, baseUrl);
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
      const listPrograms = filterPrograms(snap.programs, filter);
      ablauf = programsToAblauf(listPrograms, {
        stagesById,
        // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
        withSchedule: scheduleSafeForList(filter, listPrograms),
        speakerNamesById: speakerNameMap(snap.speakers),
      });
      speakers = snapshotToShowSpeakers(snap);
    }
    // Den Side-Event-Kontext der laufenden Abfrage frischt das Binden nicht mehr auf:
    // ihn hält der Kern (Spec 7.0). Speichert der Show-Editor die neu gebundene
    // offene Show, setzt sich der Kern aus der Datei neu auf und holt den Kontext bei
    // der nächsten Abfrage nach (speichereShowDatei → offeneShowGespeichert).
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

// ── Kern und Takt (Master-Link Teil 2a, Spec 7.0–7.6) ────────────────────────
// Abfrage (Listen- und Agenda-Modus), Umschalten, Signatur, Generation, sicheres
// Schreiben und Status liegen im Electron-freien Kern (iveo-abgleich-kern.ts). Die
// Hülle reicht Einstellungen, Token, Health, Cache und Renderer-Ereignisse hinein
// und treibt den Takt.

/** Dateizugriffe fürs atomare Schreiben (show-schreiben.ts); synchron gewartet wird mit `warteSync` von dort. */
const dateiSystem = { writeFileSync, renameSync, unlinkSync };

/**
 * Spec 7.6 (Log): Lesen und Schreiben der Abfragen scheitern bei fehlender, gesperrter oder kaputter Show bei JEDER
 * Abfrage erneut (Agenda-Modus liest jedes Mal; im Listen-Modus rückt lastSyncIso dann nicht vor). Die Warnung mit dem
 * Grund kommt deshalb nur beim ersten Fehlschlag und bei einem Wechsel ins Log; ein Erfolg setzt zurück.
 */
const leseWarnung = nurBeiWechsel((m) => getLog().warn(m));
const schreibWarnung = nurBeiWechsel((m) => getLog().warn(m));

/** Show lesen für den Kern: er bekommt nur null, den Grund hält der Leser im Log fest (K1). Nie Dateiinhalt (G6). */
const leseShowDatei = showLeserFuerKern((pfad) => readFileSync(pfad, 'utf8'), leseWarnung);

/** Show atomar schreiben: Zwischendatei, dann umbenennen; bei EPERM/EBUSY/EACCES bis zu 5 Versuche (Spec 7.4). */
function schreibeShowDatei(pfad: string, show: Show, log: (m: string) => void): boolean {
  return schreibeShowAtomar(pfad, serializeShow(show, nowIso()), dateiSystem, warteSync, log);
}

/** Schreiben für den Kern (Abfrage, Umschalten): die Warnung nur beim ersten Fehlschlag und bei einem Wechsel. */
const schreibeShowFuerKern = showSchreiberFuerKern(schreibeShowDatei, schreibWarnung);

/**
 * Token-freier Merker der aktuell offenen iveo-Show (auch wenn HIER kein Token
 * liegt) — für das Auflisten der Side Events im Launcher-Panel und die Basis-URL
 * der Materialien. Ob live umgeschaltet werden kann, weiß der Kern (`aktiv()`).
 */
interface OpenShowIveo {
  path: string;
  slug: string;
  name: string;
  day?: string;
  /** Basis-URL der Bindung, wie der Kern sie nutzt. */
  baseUrl: string;
}
let openShowIveo: OpenShowIveo | null = null;
/** Pfad der offenen Show, auch ohne iveo (Spec 7.5: Speichern im Editor erkennen). */
let offeneShowPfad: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
/**
 * Letzter Zustand des Abgleichs (Spec 7.6), wie der Kern ihn gemeldet hat (er meldet
 * nur Wechsel und setzt beim Öffnen/Schließen einer Show selbst auf ok zurück). Das
 * Panel liest ihn beim Öffnen nach.
 */
let syncStatus: IveoSyncStatus = { ok: true };

/** Renderer-Emitter (aus index.ts injiziert) — Panel über aktive Show/Side-Event informieren. */
let emitIveo: ((e: AppEvent) => void) | null = null;
export function setIveoEmitter(fn: (e: AppEvent) => void): void {
  emitIveo = fn;
}

function setzeStatus(s: IveoSyncStatus): void {
  syncStatus = s;
  emitIveo?.({
    type: 'iveo-sync-status',
    ok: s.ok,
    ...(s.text ? { text: s.text } : {}),
    ...(s.seit ? { seit: s.seit } : {}),
  });
}

let kernInstanz: IveoKern | null = null;
function kern(): IveoKern {
  if (!kernInstanz) {
    kernInstanz = erzeugeKern({
      clientFabrik: (token, baseUrl) => iveoClient(token, baseUrl),
      token: (event) => getIveoToken(event),
      leseShow: leseShowDatei,
      schreibeShow: schreibeShowFuerKern,
      benachrichtige: (appId, zeile) => sendControlCommand(appId, zeile),
      schreibeCache: (meta) => writeCache(meta as IveoShowMetadata),
      log: { info: (m) => getLog().info(m), warn: (m) => getLog().warn(m) },
      jetztIso: nowIso,
      meldeStatus: (s) => setzeStatus(s),
      meldeAktiv: () => emitActiveChanged(),
      baseUrlStandard: () => resolveIveoBaseUrl(),
    });
  }
  return kernInstanz;
}

function merkeOffeneShow(showPath: string, show: Show): void {
  const binding = show.iveo;
  openShowIveo = binding?.event
    ? {
        path: showPath,
        slug: binding.event,
        name: binding.name || binding.event,
        day: binding.filter?.day,
        baseUrl: binding.baseUrl || resolveIveoBaseUrl(),
      }
    : null;
}

function emitActiveChanged(): void {
  if (!openShowIveo) {
    emitIveo?.({ type: 'iveo-active-changed', event: '', canSwitch: false }); // Panel leeren
    return;
  }
  const a = kern().aktiv();
  emitIveo?.({
    type: 'iveo-active-changed',
    event: openShowIveo.name,
    day: a?.filter.day ?? openShowIveo.day,
    activeProgramId: a?.filter.programId,
    canSwitch: a !== null,
  });
}

/** STATE-Werte für den Launcher-Steuerserver (Companion-Variablen, #11). */
export function iveoStateKv(): Record<string, string> {
  const a = kern().aktiv();
  return {
    iveo_event: openShowIveo?.name ?? '',
    iveo_day: a?.filter.day ?? openShowIveo?.day ?? '',
    iveo_side_event: a?.filter.programId ?? '',
  };
}

/**
 * Takt starten, sobald eine Show offen ist — auch ohne iveo: Bindet der Show-Editor
 * die offene Show neu, fragt der Kern ab dem nächsten Takt ab. Ohne aktive iveo-Show
 * kehrt `abfrage()` sofort zurück; eine laufende Abfrage startet keine zweite.
 */
function starteTakt(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void kern().abfrage(); // wirft nie (Vertrag des Kerns); Fehler landen im Status
  }, POLL_INTERVAL_MS);
}

/**
 * Nach dem Öffnen einer Show: Kern aufsetzen (Signatur aus der Datei, Generation + 1,
 * Status zurück auf ok bzw. „kein iveo-Token …“ bei fehlendem Token; danach meldet der
 * Kern `meldeAktiv()` → Panel) und den Takt sicherstellen. Fehlt das Token (Show auf
 * anderem Rechner gebunden), läuft der Ablauf aus der Datei offline weiter.
 */
export function onShowOpened(showPath: string, show: Show): void {
  // Eine geöffnete Show beginnt neu: ihr erster Lese- oder Schreibfehler kommt wieder ins Log (Spec 7.6).
  leseWarnung.ok();
  schreibWarnung.ok();
  offeneShowPfad = showPath;
  merkeOffeneShow(showPath, show); // vor dem Kern: dessen meldeAktiv() braucht den Merker
  kern().showGeoeffnet(showPath, show);
  starteTakt();
  const a = kern().aktiv();
  if (a) getLog().info(`iveo: Live-Polling für Event „${a.event}" aktiv (alle ${POLL_INTERVAL_MS / 1000}s).`);
}

export function stopIveoPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  kern().showGeschlossen();
}

/**
 * Show aus dem Show-Editor schreiben (Spec 7.4, 7.5): atomar. Ist es die offene
 * Show, setzt der Kern direkt danach — ohne await dazwischen (Aufrufvertrag aus A14) —
 * seinen Stand aus der Datei neu auf (Generation + 1, Filter, Signatur, Kontext),
 * schickt RELOAD an Timer, Titler und Rundown und meldet `meldeAktiv()`.
 * `neuGebunden` = im Editor neu an iveo gebunden.
 */
export function speichereShowDatei(pfad: string, show: Show, neuGebunden: boolean): boolean {
  // Speichern im Editor ist eine Handlung des Bedieners: jede Warnung ins Log (saveShow verweist darauf).
  if (!schreibeShowDatei(pfad, show, (m) => getLog().warn(m))) return false;
  schreibWarnung.ok(); // die Datei ist wieder schreibbar: der nächste Fehlschlag einer Abfrage kommt wieder ins Log
  if (offeneShowPfad && gleicherShowPfad(offeneShowPfad, pfad)) {
    // Merker (Name, Tag, Basis-URL) aus der geschriebenen Show, bevor der Kern meldeAktiv() ruft.
    merkeOffeneShow(offeneShowPfad, show);
    kern().offeneShowGespeichert(offeneShowPfad, neuGebunden);
    starteTakt();
  }
  return true;
}

// ── Live-Umschalter für Side Events (#11) ────────────────────────────────────
// Die .jmshow bindet Event+Tag EINMAL; welches Side Event „live" läuft, ist
// Laufzeit-Zustand — kein neues Show-File je Side Event. Auflisten geht token-frei
// aus dem Cache; Umschalten braucht das Token (Launcher = single-holder) und läuft
// im Kern (nacheinander, Generation + 1, Spec 7.3).

/** Side Events der offenen Show (aus dem Cache, token-frei) für das Umschalt-Panel. */
export function listSideEvents(input: IveoSideEventsInput = {}): IveoSideEventsResult {
  if (!openShowIveo) return { ok: false, error: 'Keine iveo-gebundene Show geöffnet.' };
  const a = kern().aktiv();
  const meta = readCache(openShowIveo.slug);
  if (!meta) {
    return {
      ok: false,
      error: 'Kein iveo-Cache vorhanden (Show auf anderem Rechner gebunden?).',
      event: openShowIveo.name,
      canSwitch: a !== null,
      syncStatus,
    };
  }
  const dayMap = new Map<string, number>();
  for (const p of meta.programs) {
    const d = metaProgramDay(p);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const days = [...dayMap.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((x, y) => x.value.localeCompare(y.value));
  const day = input.day || a?.filter.day || openShowIveo.day || days[0]?.value || '';
  const programs: IveoProgramRef[] = meta.programs
    .filter((p) => !day || metaProgramDay(p) === day)
    .sort((x, y) => (x.startsAtLocal || x.startsAt || '').localeCompare(y.startsAtLocal || y.startsAt || ''))
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
    activeProgramId: a?.filter.programId,
    canSwitch: a !== null,
    syncStatus,
  };
}

/**
 * Live auf ein Side Event umschalten (oder zurück auf die Tagesübersicht). Der Kern
 * schreibt Ablauf+Speaker in die offene Show und schickt RELOAD an Timer, Titler und
 * Rundown; scheitert das Schreiben, kommt ok:false zurück (Spec 7.2).
 */
export async function switchSideEvent(input: IveoSwitchInput): Promise<ActionResult> {
  return kern().umschalten({ programId: input.programId, day: input.day });
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

/** Basis-URL der offenen iveo-Show (wie der Kern sie nutzt). */
function offeneBaseUrl(): string {
  return openShowIveo?.baseUrl ?? resolveIveoBaseUrl();
}

/** Alle Materialien eines Side Events (aus dessen Agenda-Punkten) auflisten. */
export async function listSideEventMaterials(input: IveoMaterialsInput): Promise<IveoMaterialsResult> {
  const a = kern().aktiv();
  if (!a) return { ok: false, error: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(a.event);
  if (!token) return { ok: false, error: 'Kein iveo-Token für die offene Show.' };
  const programId = input.programId?.trim();
  if (!programId) return { ok: false, error: 'programId fehlt.' };
  try {
    const client = iveoClient(token, offeneBaseUrl());
    const agenda = await client.listAgendaItems(a.event, programId);
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
  const a = kern().aktiv();
  if (!a) return { ok: false, message: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(a.event);
  if (!token) return { ok: false, message: 'Kein iveo-Token für die offene Show.' };
  try {
    // Die Agenda ist ein JSON-Abruf und bekommt die Zeitgrenze von 15 s (Spec 7.0).
    const agenda = await iveoClient(token, offeneBaseUrl()).listAgendaItems(a.event, input.programId);
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
    // Nur dieser Abruf läuft OHNE Zeitgrenze: eine große Datei darf länger als 15 s
    // laden (Spec 7.0, O6).
    const client = new IveoClient({ token, baseUrl: offeneBaseUrl() });
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
