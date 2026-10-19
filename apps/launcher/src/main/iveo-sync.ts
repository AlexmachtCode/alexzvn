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
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import { serializeShow, type Show } from '@jm/show';
import {
  IveoAssetAdresseError,
  IveoClient,
  agendaToAblauf,
  assetAnfrage,
  buildShowMetadata,
  extractSpeakerIds,
  type IveoMaterial,
  filterPrograms,
  localTimeOfDayMs,
  normalizeIveoBaseUrl,
  programTaxonomy,
  programsToAblauf,
  snapshotToShowSpeakers,
  speakersToShowSpeakers,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoShowMetadata,
  type IveoSnapshot,
} from '@jm/iveo';
import type { ShowIveoProgramRef, ShowIveoSpeaker } from '@jm/show';
import {
  getIveoAnhangOrdner,
  getIveoToken,
  getIveoBaseToken,
  resolveIveoBaseUrl,
  setIveoAnhangOrdner,
  setIveoToken,
  setIveoBaseToken,
} from './settings';
import { sendControlCommand } from './health';
import { meldeShowAnVerbund, verbundReloadInfo, verbundRolle } from './verbund';
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
  ablageShow,
  gleicherShowPfad,
  IVEO_ABRUF_ZEITGRENZE_MS,
  iveoDownloadClient,
  mitZeitgrenze,
  nurBeiWechsel,
  showLeserFuerKern,
  showSchreiberFuerKern,
} from './iveo-huelle-hilfen';
import { schreibeShowAtomar, warteSync } from './show-schreiben';
import { bildeSideEventListe, toProgramList } from './iveo-side-events';
import {
  assetGroesse,
  erzeugeAnhangWaechter,
  materialienAusAgenda,
  pruefeBeobachtung,
  type AgendaErgebnis,
  type AnhangWaechter,
} from './iveo-anhaenge';
import { erzeugeOrdnerLauf, GrundFehler, grundText, ladeAsset, pruefeAssetGroesse, type OrdnerLauf } from './side-event-ordner-lauf';
import { ohneAdressen, panelAnhangSchritt, panelDateiOeffnen } from './side-event-ordner';
import type {
  ActionResult,
  AnhangOrdnerStand,
  AppEvent,
  IveoBindInput,
  IveoBindResult,
  IveoDiscoverInput,
  IveoDiscoverResult,
  IveoDownloadInput,
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

// toProgramList und bildeSideEventListe liegen seit Teil 2b R2 (Spec 15.4) in iveo-side-events.ts: Binden und
// Abgleich-Kern bilden die Side-Event-Liste mit derselben Funktion.

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
    // iveo-Paket, Spec 9.3: Tag und Titel für die Ablage kommen aus dem Speicher, nie synchron von der Platte im Takt.
    if (openShowIveo && meta.slug === openShowIveo.slug) offenerCache = meta;
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
  // Der Token-Fallback normalisiert über den Basis-Schlüssel und würfe bei ungültiger Adresse (T8) außerhalb des try:
  // zuerst und in eigenem try, damit die Antwort ok:false mit dem Text ist statt eines IPC-Fehlers.
  let genutzteAdresse: string;
  try {
    genutzteAdresse = normalizeIveoBaseUrl(baseUrl);
  } catch (e) {
    getLog().warn(`iveo discover fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
  const token = input.token?.trim() || getIveoBaseToken(genutzteAdresse);
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
  // iveo-Paket, Spec 7.4 (E16, EP1): die genutzte Adresse normalisiert zurückgeben; der Show-Editor schreibt sie in die
  // Bindung. normalizeIveoBaseUrl wirft bei ungültiger Eingabe (T8) — auch der Token-Fallback unten normalisiert (über
  // den Basis-Schlüssel) und würfe außerhalb eines try. Darum zuerst und in eigenem try: Die Antwort ist dann ok:false
  // mit dem Text statt eines IPC-Fehlers, ob das Token-Feld gefüllt ist oder leer.
  let genutzteAdresse: string;
  try {
    genutzteAdresse = normalizeIveoBaseUrl(baseUrl);
  } catch (e) {
    getLog().warn(`iveo bind fehlgeschlagen: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e) };
  }
  // C4: Token-Fallback wie bei discover (basis-weit gemerkter Token).
  const token = input.token?.trim() || getIveoBaseToken(genutzteAdresse);
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
    const sideEvents = bildeSideEventListe(snap.programs, dayFilter);
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
      baseUrl: genutzteAdresse,
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
      // Teil 2b R2, Spec 15.3 (O3): In der Rolle Master geht RELOAD nur an Tools dieses Rechners.
      benachrichtige: (appId, zeile) => sendControlCommand(appId, zeile, { nurDieserRechner: verbundReloadInfo() !== null }),
      schreibeCache: (meta) => writeCache(meta as IveoShowMetadata),
      log: { info: (m) => getLog().info(m), warn: (m) => getLog().warn(m) },
      jetztIso: nowIso,
      meldeStatus: (s) => setzeStatus(s),
      meldeAktiv: () => emitActiveChanged(),
      baseUrlStandard: () => resolveIveoBaseUrl(),
      // Teil 2b R2, Spec 15.1: die offene Show an den Verteiler; 15.6: k für die RELOAD-Logzeile.
      meldeShow: (pfad, show) => {
        meldeShowAnVerbund(pfad, show);
        // iveo-Paket: die Side-Event-Liste der Bindung, wie sie jetzt in der Datei steht (Titel für T17).
        if (show) bindungsListe = show.iveo?.sideEvents ?? [];
      },
      verbundReload: () => verbundReloadInfo(),
      // iveo-Paket, Spec 6.1: derselbe Takt wie die Hülle (Regel „fällig“ nach 255 s bei 45 s).
      taktMs: POLL_INTERVAL_MS,
      // iveo-Paket, Spec 8.2 (E19): die Agenda des aktiven Side Events direkt nach ihrem Abruf, ohne eigenen Abruf.
      meldeAgenda: (programId, e) => agendaAktiv(programId, e),
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
  bindungsListe = binding?.sideEvents ?? [];
  // iveo-Paket, Spec 9.3: Cache der offenen Show einmal beim Öffnen lesen (wie das Panel); danach nur noch im Speicher.
  offenerCache = openShowIveo ? readCache(openShowIveo.slug) : null;
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

// ── Anhang-Wächter (iveo-Paket, Spec 8.2, 8.4) ───────────────────────────────
// Beobachtet die aufgeklappte Anhang-Liste des Panels und das aktive Side Event. Die Agenda des aktiven Side Events
// meldet der Kern direkt nach ihrem Abruf (meldeAgenda); eine aufgeklappte andere Liste holt der Wächter im Takt.

/** Side-Event-Liste der Bindung, wie sie zuletzt in der Datei stand (Titel für T17). */
let bindungsListe: ShowIveoProgramRef[] = [];
/** Titel eines Side Events aus der Bindung; sonst null (der Wächter nimmt dann die programId, T17). */
function titelAusBindung(programId: string): string | null {
  return bindungsListe.find((p) => p.id === programId)?.title || null;
}

let waechterInstanz: AnhangWaechter | null = null;
function anhangWaechter(): AnhangWaechter {
  if (!waechterInstanz) {
    waechterInstanz = erzeugeAnhangWaechter({
      aktivProgramId: () => kern().aktiv()?.filter.programId ?? null,
      event: () => kern().aktiv()?.event ?? null,
      jetztIso: nowIso,
      sende: (e) => emitIveo?.(e),
      titelVon: (programId) => titelAusBindung(programId),
      log: { info: (m) => getLog().info(m) },
    });
  }
  return waechterInstanz;
}

/** Agenda des aktiven Side Events aus dem Kern (meldeAgenda, E19): an den Wächter und an die Ablage. */
function agendaAktiv(programId: string, e: AgendaErgebnis): void {
  anhangWaechter().agendaVomKern(programId, e);
  // iveo-Paket, Spec 9.4: dieselbe Agenda an die Ablage (aktives Side Event in jedem Takt, ohne eigenen Abruf).
  ordner().agendaAktiv(programId, e);
}

/** Client für den Wächter (15-s-Zeitgrenze wie Kern und Panel); ohne offene Show mit Token keiner. */
function waechterClient(): IveoClient | null {
  const a = kern().aktiv();
  const token = a ? getIveoToken(a.event) : undefined;
  if (!a || !token) return null;
  try {
    return iveoClient(token, offeneBaseUrl());
  } catch {
    return null; // ungültige Adresse: die Statuszeile des Kerns zeigt sie schon
  }
}

/**
 * IPC iveo:watchMaterials (Spec 8.4, 8.6): die beobachtete Liste des Renderers. Mehr als 8 Kennungen oder eine mit mehr
 * als 200 Zeichen → verworfen. Jede Anmeldung, auch [], lässt den Wächter den Stand jeder beobachteten Liste neu senden.
 */
export function watchIveoMaterials(input: unknown): void {
  const ids = pruefeBeobachtung(input);
  if (ids === null) return;
  anhangWaechter().beobachte(ids);
}

// ── Ablage der Anhänge in Side-Event-Ordnern (iveo-Paket, Spec 9) ────────────
// Den Ablauf hält side-event-ordner-lauf.ts ohne Electron; die Hülle reicht nur ein: node:fs/promises (nie synchron, G7),
// Uhr und Zeitgeber, Rolle (9.2 Nr. 3), Token (Nr. 2), Schalter (Nr. 4, 9.14), Tag und Titel aus dem Cache (9.3), zwei
// Clients (Agenda mit 15-s-Zeitgrenze, Download ohne, E46), Rechnername und Prozesskennung für die Sperrdatei (E45).

/** Cache-Metadaten der offenen Show im Speicher: gelesen beim Öffnen, nachgeführt bei jedem Schreiben des Caches. */
let offenerCache: IveoShowMetadata | null = null;
/** Tag (JJJJ-MM-TT) eines Side Events aus dem Cache, sonst null (Spec 9.3, wie das Panel). */
function tagAusCache(programId: string): string | null {
  const p = offenerCache?.programs.find((x) => x.id === programId);
  return p ? metaProgramDay(p) || null : null;
}
/** Titel eines Side Events aus dem Cache, sonst null (die Liste der Bindung liest der Lauf selbst aus der Datei, 9.1). */
function titelAusCache(programId: string): string | null {
  return offenerCache?.programs.find((x) => x.id === programId)?.title?.trim() || null;
}
/**
 * Gebundene offene Show ohne Blick aufs Token (9.2 Nr. 1, 11.1 K0): Pfad und Event aus dem Merker der Hülle. Ohne Token
 * hat der Kern keine aktive Show; der Lauf zeigt dann K1 bzw. K2 statt K0 (ablageShow).
 */
function offeneIveoShow(): { path: string; event: string } | null {
  return openShowIveo ? { path: openShowIveo.path, event: openShowIveo.slug } : null;
}
/** Token der offenen Show auf diesem Rechner (9.2 Nr. 2), bei jedem Aufruf neu gelesen. */
function tokenDerOffenenShow(): string | undefined {
  const a = kern().aktiv();
  return a ? getIveoToken(a.event) : undefined;
}
/** Schalter (9.14): einmal gelesen, danach im Speicher; geändert wird er nur über setzeAnhangOrdner. */
let schalterStand: boolean | null = null;
function schalterAn(): boolean {
  if (schalterStand === null) schalterStand = getIveoAnhangOrdner();
  return schalterStand;
}

let ordnerInstanz: OrdnerLauf | null = null;
function ordner(): OrdnerLauf {
  if (!ordnerInstanz) {
    ordnerInstanz = erzeugeOrdnerLauf({
      fs: fsp,
      jetzt: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      // 9.2 Nr. 1, 11.1: die gebundene offene Show auch ohne Token (K1, K2 statt K0); abgelegt wird nur mit tokenDa.
      aktiv: () => ablageShow(kern().aktiv(), offeneIveoShow()),
      rolle: () => verbundRolle(),
      tokenDa: () => tokenDerOffenenShow() !== undefined,
      schalterAn: () => schalterAn(),
      tagVon: (programId) => tagAusCache(programId),
      titelVon: (programId) => titelAusCache(programId),
      agendaClient: () => {
        const token = tokenDerOffenenShow();
        return token ? iveoClient(token, offeneBaseUrl()) : null;
      },
      downloadClient: () => {
        const token = tokenDerOffenenShow();
        return token ? iveoDownloadClient(token, offeneBaseUrl(), (url, init) => fetch(url, init)) : null;
      },
      rechner: hostname(),
      pid: process.pid,
      neueSitzungsKennung: () => randomUUID(),
      log: { info: (m) => getLog().info(m), warn: (m) => getLog().warn(m) },
      melde: (stand) => emitIveo?.({ type: 'iveo-anhang-ordner', stand }),
    });
  }
  return ordnerInstanz;
}

/** IPC iveo:anhangOrdner (Spec 9.15): Stand der Ablage für Kopfzeile und Zeilen des Panels. */
export function anhangOrdnerStand(): AnhangOrdnerStand {
  return ordner().stand();
}

/**
 * IPC iveo:setzeAnhangOrdner (Spec 9.14, OF8): Schalter dieses Rechners. „Aus“ stößt den Lauf sofort an, damit ein
 * laufender Download abbricht und die eigene Sperrdatei gelöscht wird; „an“: die nächste Runde im nächsten Takt.
 */
export function setzeAnhangOrdner(input: unknown): AnhangOrdnerStand {
  const an = (input as { an?: unknown } | null)?.an;
  if (typeof an === 'boolean') {
    setIveoAnhangOrdner(an);
    schalterStand = an;
    if (!an) ordner().takt();
    // Frischer Stand ohne Arbeitsbeginn, auch bei „an“ und bei laufendem Takt: Schalter und Kopfzeile lügen nicht.
    return ordner().bedingungenNeu();
  }
  return ordner().stand();
}

/** T31: Notice, wenn ein Ordner nicht zu öffnen ist. */
function textOrdnerNichtZuOeffnen(grund: string): string {
  return `Ordner nicht zu öffnen: ${grund}`;
}

/**
 * IPC iveo:oeffneAnhangOrdner (Spec 9.13, E35): „Ordner öffnen“ nur über die programId, ohne Kennung der Basisordner.
 * Der Renderer übergibt nie einen Pfad; den kennt nur der Lauf.
 */
export async function oeffneAnhangOrdner(input: unknown): Promise<ActionResult> {
  const roh = (input as { programId?: unknown } | null)?.programId;
  const programId = typeof roh === 'string' && roh.trim() ? roh.trim() : undefined;
  const pfad = ordner().ordnerPfadFuer(programId);
  if (!pfad) return { ok: false, message: textOrdnerNichtZuOeffnen('Ordner nicht gefunden') };
  const fehler = await shell.openPath(pfad);
  return fehler ? { ok: false, message: textOrdnerNichtZuOeffnen(fehler) } : { ok: true };
}

/** before-quit (Spec 9.2 „Ende der Ablage“): das Löschen der eigenen Sperrdatei nur anstoßen, nie abwarten. */
export function ablageBeenden(): void {
  ordnerInstanz?.beenden();
}

/** Sperre gegen Überholen (Spec 8.2): ein Takt beginnt erst, wenn der vorige fertig ist. */
let taktLaeuft = false;

/**
 * Ein Takt der Hülle (Spec 8.2, E28): erst die Abfrage des Kerns, dann der Anhang-Wächter, nacheinander. Dauert ein Takt
 * länger als 45 s, fällt der nächste aus, statt parallel eine zweite Abfrage zu starten. Beide werfen nie (Vertrag; Fehler
 * landen im Status bzw. als Ereignis ok:false).
 */
async function takt(): Promise<void> {
  if (taktLaeuft) return;
  taktLaeuft = true;
  try {
    await kern().abfrage();
    await anhangWaechter().takt(waechterClient());
    // iveo-Paket, Spec 9.4: die Ablage nur anstoßen; sie arbeitet ihre Warteschlange im Hintergrund ab (E28).
    ordner().takt();
  } finally {
    taktLaeuft = false;
  }
}

/**
 * Takt starten, sobald eine Show offen ist — auch ohne iveo: Bindet der Show-Editor
 * die offene Show neu, fragt der Kern ab dem nächsten Takt ab. Ohne aktive iveo-Show
 * kehrt `abfrage()` sofort zurück; eine laufende Abfrage startet keine zweite.
 */
function starteTakt(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void takt();
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
  // iveo-Paket, Spec 8.2: eine geöffnete Show beginnt neu — die nächste Beobachtung gilt als erste (8.4 Nr. 1).
  anhangWaechter().zuruecksetzen();
  kern().showGeoeffnet(showPath, show);
  // iveo-Paket, Spec 9.2, 9.4: neue Sitzung der Ablage (Generation + 1, die eigene Sperre der vorigen Show löschen).
  ordner().sitzung();
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
  anhangWaechter().zuruecksetzen();
  ordner().sitzung();
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
    // iveo-Paket, Spec 8.2: neu gebunden = neue Liste der Side Events, die nächste Beobachtung gilt als erste.
    if (neuGebunden) anhangWaechter().zuruecksetzen();
    // iveo-Paket, Spec 9.4: neu gebunden = neue Sitzung der Ablage (Generation + 1).
    if (neuGebunden) ordner().sitzung();
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

// ── Anhänge eines Side Events (#11 Phase 4; iveo-Paket, Spec 8) ──────────────
// Präsentationen, Dateien und Links hängen in iveo an den Agenda-Punkten eines Programms (materials[]). Datei-Assets
// werden über die 302-Indirektion mit Token geladen (der Launcher hält es); die signierte Adresse wird NIE gespeichert.
// Namen, Endungen und die Sperrliste stehen seit dem iveo-Paket in side-event-ordner.ts (MIME_EXT, 9.12): Panel und
// Ordner benennen gleich.

/** Basis-URL der offenen iveo-Show (wie der Kern sie nutzt). */
function offeneBaseUrl(): string {
  return openShowIveo?.baseUrl ?? resolveIveoBaseUrl();
}

/** Alle Anhänge eines Side Events (aus dessen Agenda-Punkten) auflisten (iveo-Paket, Spec 8.2, 8.6). */
export async function listSideEventMaterials(input: IveoMaterialsInput): Promise<IveoMaterialsResult> {
  const a = kern().aktiv();
  if (!a) return { ok: false, error: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(a.event);
  if (!token) return { ok: false, error: 'Kein iveo-Token für die offene Show.' };
  const programId = input.programId?.trim();
  if (!programId) return { ok: false, error: 'programId fehlt.' };
  // Spec 8.6: Zeit des Abrufs, vor dem Abruf genommen. Der Renderer verwirft damit ein älteres Ergebnis, wenn sich der
  // Abruf und ein Ereignis des Wächters kreuzen (8.1); auch ein Fehlschlag trägt sie.
  const abgerufen = nowIso();
  try {
    const client = iveoClient(token, offeneBaseUrl());
    const agenda = await client.listAgendaItems(a.event, programId);
    // Spec 8.2, 8.5: dieselbe Abbildung wie der Wächter, ohne gelöschte und ungültige Anhänge.
    const materials = materialienAusAgenda(agenda);
    getLog().info(`iveo: Side Event „${programId}“: ${materials.length} Anhänge.`);
    // EP20: Der Renderer übernimmt diese Liste und löscht dabei seinen Fehler; der Wächter sendet darum den nächsten
    // Fehlschlag eines danach begonnenen Abrufs wieder, auch mit gleichem Text (sonst stünde L5 trotz Störung da).
    anhangWaechter().eigenesLaden(programId, abgerufen);
    return { ok: true, materials, abgerufen };
  } catch (e) {
    getLog().warn(`iveo materials: ${(e as Error).message}`);
    return { ok: false, ...toClientError(e), abgerufen };
  }
}

// iveo-Paket, Spec 8.5, 8.6: Texte des manuellen Downloads (11.6 wörtlich).
/** T16: Der Anhang fehlt beim Herunterladen ganz. */
const TEXT_ANHANG_NICHT_DA = 'Anhang nicht mehr in iveo vorhanden.';
/** T18: Titel des Speichern-Dialogs. */
const TEXT_ANHANG_SPEICHERN = 'Anhang speichern';
/** T77 (b): Asset-Adresse auf anderem Server ohne https (E52) — kein Dialog, kein Abruf. */
const TEXT_ADRESSE_ABGELEHNT = 'Anhang nicht geladen: Datei-Adresse auf anderem Server ohne https.';
/** T20: gespeichert und geöffnet. */
function textGespeichertGeoeffnet(label: string): string {
  return `Gespeichert und geöffnet: ${label}`;
}
/** T74: gespeichert, wegen gesperrter Endung nicht geöffnet (‹ext› aus dem Label, sonst die des gewählten Namens). */
function textNichtGeoeffnet(ext: string, dateiname: string): string {
  return `Gespeichert, nicht automatisch geöffnet (Endung „${ext}“ gesperrt): ${dateiname}`;
}
/** T56: Logzeile nach dem Speichern. */
function logGespeichert(label: string, bytes: number, pfad: string): string {
  return `iveo: Anhang „${label}“ gespeichert (${bytes} Bytes) → ${pfad}`;
}
/** Leerlauf-Grenze (Spec 9.6): 60 s ohne Daten, auch vor dem ersten Byte → Abbruch; eine Gesamtgrenze gibt es nicht. */
const ANHANG_LEERLAUF_MS = 60_000;

/**
 * Einen Anhang speichern (Datei) bzw. öffnen (Link), iveo-Paket Spec 8.6. Alle Entscheidungen trifft der reine Helfer
 * panelAnhangSchritt (side-event-ordner.ts, getestet in 12.4 Nr. 19 und 48); hier wird nur ausgeführt: Agenda holen,
 * Herkunft der Asset-Adresse prüfen (E52, VOR dem Dialog), Dialog, Datenstrom in eine Zwischendatei neben dem Ziel,
 * Umbenennen, Öffnen nur, wenn panelDateiOeffnen es erlaubt.
 */
export async function downloadSideEventMaterial(input: IveoDownloadInput): Promise<ActionResult> {
  const a = kern().aktiv();
  if (!a) return { ok: false, message: 'Keine iveo-Show mit Token geöffnet.' };
  const token = getIveoToken(a.event);
  if (!token) return { ok: false, message: 'Kein iveo-Token für die offene Show.' };
  // Token und Basis-URL gehören zusammen: beide jetzt, einmal. Der Dialog ist nicht modal; öffnet der Bediener währenddessen
  // eine andere Show, darf das Token dieses Events nie an die Herkunft der anderen gehen (wie im Ordner, der beide im selben Moment bildet).
  const basis = offeneBaseUrl();
  try {
    // Die Agenda ist ein JSON-Abruf und bekommt die Zeitgrenze von 15 s (Spec 7.0).
    const agenda = await iveoClient(token, basis).listAgendaItems(a.event, input.programId);
    let target: IveoMaterial | undefined;
    for (const item of agenda) {
      const m = (item.materials ?? []).find((x) => x.id === input.materialId);
      if (m) {
        target = m;
        break;
      }
    }
    if (!target) return { ok: false, message: TEXT_ANHANG_NICHT_DA };
    const schritt = panelAnhangSchritt(target);
    // Gelöscht (T15), Link ohne Adresse, ungültiger Link (T53), Datei ohne Asset (T54): der Text des Helfers.
    if (schritt.art === 'fehler') return { ok: false, message: schritt.text };
    if (schritt.art === 'link') {
      // Nur der geprüfte href (http/https, ohne Steuerzeichen, 9.7), nie der Rohtext aus iveo.
      await shell.openExternal(schritt.href);
      return { ok: true, message: `Link geöffnet: ${target.label}` };
    }
    // E52: die Herkunft der Asset-Adresse VOR dem Dialog prüfen — abgelehnt heißt: weder Dialog noch Abruf.
    const ref = target.asset?.url ?? '';
    try {
      assetAnfrage(ref, basis);
    } catch (e) {
      if (e instanceof IveoAssetAdresseError) return { ok: false, message: TEXT_ADRESSE_ABGELEHNT };
      throw e;
    }
    // Spec 9.6 (E29): Größe wie im Ordner (ein Baustein, side-event-ordner-lauf.ts). Ein gültiges size_bytes über 2 GiB wird nicht geladen, schon vor dem Dialog (T22 a).
    const groesse = assetGroesse(target.asset?.size_bytes);
    try {
      pruefeAssetGroesse(groesse);
    } catch (e) {
      if (e instanceof GrundFehler) return { ok: false, message: e.message };
      throw e;
    }
    // Der Dialog kommt VOR dem Abruf: sonst liefe während des Dialogs die Leerlauf-Grenze (Spec 8.6).
    const r = await dialog.showSaveDialog({ title: TEXT_ANHANG_SPEICHERN, defaultPath: schritt.vorschlag });
    if (r.canceled || !r.filePath) return { ok: false };
    const ziel = r.filePath;
    const zwischen = `${ziel}.${process.pid}.jm-laden`;
    try {
      // Derselbe Ladeschritt wie in der Ablage: Leerlauf-Grenze auch vor dem ersten Byte, Bytezahl gegen size_bytes, Grund wie T22.
      const bytes = await ladeAsset({
        fs: fsp, client: iveoDownloadClient(token, basis, (url, init) => fetch(url, init)), ref, ziel: zwischen, groesse, leerlaufMs: ANHANG_LEERLAUF_MS,
        jetzt: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
      });
      // Der Dialog hat ein Überschreiben des gewählten Ziels schon bestätigt.
      await fsp.rename(zwischen, ziel);
      getLog().info(logGespeichert(target.label, bytes, ziel));
    } catch (e) {
      // Jeder Fehler löscht die Zwischendatei (Spec 9.6); ladeAsset tut das nicht selbst.
      await fsp.unlink(zwischen).catch(() => undefined);
      getLog().warn(`iveo download: ${ohneAdressen(String((e as Error | null)?.message ?? e))}`);
      return { ok: false, message: grundText(e, 'download') };
    }
    const name = basename(ziel);
    if (panelDateiOeffnen(name, schritt.gesperrt)) {
      void shell.openPath(ziel);
      return { ok: true, message: textGespeichertGeoeffnet(target.label) };
    }
    // Gesperrte Endung im Label oder im gewählten Namen: gespeichert, aber nie automatisch geöffnet (E49, T74).
    const ext = schritt.gesperrt ?? name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    return { ok: true, message: textNichtGeoeffnet(ext, name) };
  } catch (e) {
    getLog().warn(`iveo download: ${ohneAdressen((e as Error).message)}`);
    return { ok: false, message: ohneAdressen(toClientError(e).error) };
  }
}
