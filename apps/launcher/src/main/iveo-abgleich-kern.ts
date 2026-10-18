// ─────────────────────────────────────────────────────────────────────────────
// iveo-Abgleich-Kern (Master-Link Teil 2a, Spec 7.0–7.6) — OHNE Electron, per tsx getestet
// (test/iveo-abgleich.test.ts, mit nachgebautem iveo-Client). iveo-sync.ts ist die dünne Electron-Hülle darüber:
// Einstellungen, Token, Health, Renderer-Ereignisse, Takt (Muster wie verbund/kern.ts).
//
// Der Kern hält die offene Show (`active`), fragt iveo ab (Listen- und Agenda-Modus), vergleicht über die
// Signatur (7.2), schreibt die Show über `schreibeShow` (7.4) und benachrichtigt Timer, Titler UND Rundown (7.1).
// Abfrage und Umschalten überholen sich nicht: Generation + Prüfung „active === a“ direkt vor dem Schreiben (7.3).
// Merker (lastSig, lastSyncIso, filter, sideCtx) rücken erst nach erfolgreichem Schreiben vor (7.2).
//
// SICHERHEIT: Das Token kommt nur über `token(event)` herein und geht nur an `clientFabrik` — nie in Log,
// Status, Show oder Cache.
// ─────────────────────────────────────────────────────────────────────────────

import { resolve } from 'node:path';
import { migrateShow, normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoProgramRef, type ShowIveoSpeaker } from '@jm/show';
import {
  IveoApiError,
  agendaToAblauf,
  buildShowMetadata,
  extractSpeakerIds,
  filterPrograms,
  localTimeOfDayMs,
  programDayKey,
  programToAblaufItem,
  programsToAblauf,
  snapshotToShowSpeakers,
  speakerName,
  speakersToShowSpeakers,
  type IveoAgendaItem,
  type IveoClient,
  type IveoProgram,
  type IveoProgramFilter,
  type IveoSnapshot,
  type IveoSpeaker,
  type ProgramMapOptions,
} from '@jm/iveo';
import { IVEO_ABFRAGE_TAKT_MS, IVEO_ABRUF_ZEITGRENZE_MS, auffrischenFaellig } from './iveo-huelle-hilfen';
import { bildeSideEventListe } from './iveo-side-events';
import type { AgendaErgebnis } from './iveo-anhaenge';

/** Die Teilmenge des iveo-Clients, die der Kern braucht. Im Test nachgebaut. */
export type IveoClientLike = Pick<
  IveoClient,
  'listProgramsUpdatedSince' | 'getEventSnapshot' | 'listAgendaItems' | 'getProgram' | 'listSpeakers' | 'listPrograms'
>;

/** Zustand des Abgleichs fürs iveo-Panel (Ereignis `iveo-sync-status`, Spec 7.6). */
export interface IveoSyncStatus {
  ok: boolean;
  text?: string;
  /** ISO-Zeit, seit der der Abgleich gestört ist. */
  seit?: string;
}

export interface KernAbhaengigkeiten {
  /** Client für eine Abfrage. Die Hülle setzt hier den fetchImpl mit 15-s-Zeitgrenze ein (7.0). */
  clientFabrik(token: string, baseUrl: string): IveoClientLike;
  /** Token für dieses Event auf diesem Rechner, sonst undefined. */
  token(event: string): string | undefined;
  /** Show-Datei lesen (parseShow). null = nicht lesbar. */
  leseShow(pfad: string): Show | null;
  /** Show serialisieren und atomar schreiben (show-schreiben.ts). SYNCHRON; true = geschrieben. */
  schreibeShow(pfad: string, show: Show): boolean;
  /** Steuerbefehl an alle verbundenen Instanzen eines Tools; Rückgabe = Anzahl. */
  benachrichtige(appId: 'jm-timer' | 'jm-titler' | 'jm-rundown', zeile: string): number;
  /** Token-freien Metadaten-Cache schreiben (IveoShowMetadata). */
  schreibeCache(meta: unknown): void;
  log: { info(m: string): void; warn(m: string): void };
  jetztIso(): string;
  /** Neuer Abgleich-Zustand. Kommt nur bei einem Wechsel. */
  meldeStatus(s: IveoSyncStatus): void;
  /** aktiv() hat sich geändert (Öffnen, Umschalten, Speichern der offenen Show): die Hülle meldet das Panel neu. */
  meldeAktiv(): void;
  /** Basis-URL, wenn die Show keine trägt (resolveIveoBaseUrl). */
  baseUrlStandard(): string;
  /**
   * Teil 2b R2, Spec 15.1: Die offene Show ist geöffnet, geschrieben oder im Editor gespeichert worden — so, wie sie in
   * der Datei steht; `null` = gerade gespeichert und nicht lesbar. Die Hülle reicht sie an den Verteiler. Optional: ohne
   * sie liest der Kern nach dem Schreiben nichts zurück (E10).
   */
  meldeShow?(pfad: string, show: Show | null): void;
  /**
   * Teil 2b R2, Spec 15.3/15.6 (E12): null = Rolle nicht Master (Logzeile aus 2a); sonst k = Tools anderer Rechner mit
   * Abo für die Logzeile „… auf diesem Rechner; k Tools anderer Rechner …“. Optional.
   */
  verbundReload?(): { andereRechner: number } | null;
  /**
   * iveo-Paket, Spec 6.1: Abfragetakt der Hülle (POLL_INTERVAL_MS), Standard IVEO_ABFRAGE_TAKT_MS. Die Regel „fällig“
   * zieht ihn ab: Bei regelmäßigem Takt kommt das Auffrischen so spätestens 300 s nach dem letzten Abruf der Liste.
   */
  taktMs?: number;
  /**
   * iveo-Paket, Spec 8.2 (E19): Agenda des aktiven Side Events direkt nach ihrem Abruf in der Agenda-Abfrage, für den
   * Anhang-Wächter der Hülle; `abgerufen` = Zeitpunkt vor dem Abruf. Nur, solange die Abfrage gilt; im Listen-Modus nie.
   * Optional. Die Hülle reicht nur weiter und wirft nicht.
   */
  meldeAgenda?(programId: string, e: AgendaErgebnis): void;
}

export interface IveoKern {
  /** Show geöffnet: active aus der Datei, lastSig aus der Datei, Generation + 1, Status. */
  showGeoeffnet(pfad: string, show: Show): void;
  /** Keine Show mehr offen: Generation + 1, active = null. */
  showGeschlossen(): void;
  /** Ein Takt. Läuft noch eine Abfrage, kehrt sie sofort zurück. Wirft nie. */
  abfrage(): Promise<void>;
  /** Auf ein Side Event (programId) oder die Tagesübersicht (day) umschalten. Wirft nie. */
  umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }>;
  /** Der Show-Editor hat eine Show gespeichert; zählt nur, wenn es die offene ist (Spec 7.5). */
  offeneShowGespeichert(pfad: string, neuGebunden: boolean): void;
  /** Für Panel und STATE: offene iveo-Show mit Token, sonst null. */
  aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null;
}

// ── Texte (Spec 7.6, wortgleich) ─────────────────────────────────────────────
const TEXT_TOKEN_UNGUELTIG = 'Token ungültig oder widerrufen';
const TEXT_KEIN_TOKEN = 'kein iveo-Token auf diesem Rechner, nur Offline-Ablauf';
/** Spec 7.2 (Umschalten); derselbe Text, wenn eine Abfrage nicht schreiben kann. */
const TEXT_NICHT_GESCHRIEBEN = 'Show konnte nicht geschrieben werden';
const TEXT_SHOW_NICHT_LESBAR = 'Show-Datei nicht lesbar';
/** Spec 7.6 (Umschalten), wortgleich. */
const TEXT_AGENDA_NICHT_ABRUFBAR = 'Agenda von iveo nicht abrufbar, bitte erneut versuchen';
const TEXT_UMSCHALTEN_VERWORFEN = 'Show wurde inzwischen gewechselt oder gespeichert, Umschalten verworfen.';
/** Zeitgrenze je Abruf abgelaufen (Spec 7.0). Erweitert die Abbildung aus 7.6 — Text außerhalb der Spec, Ruling offen. */
const TEXT_ZEITGRENZE = `iveo antwortet nicht innerhalb von ${IVEO_ABRUF_ZEITGRENZE_MS / 1000} s`;
/**
 * Teil 2b, Spec 6.3 (wortgleich): Speakerliste nicht abrufbar. Ohne Präfix — „iveo-Abgleich gestört: “ und
 * „ (seit ⟨hh:mm⟩)“ setzt das iveo-Panel aus `status.text` und `status.seit` davor bzw. dahinter (iveo-status.ts).
 */
const TEXT_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand';
/** Teil 2b, Spec 6.3: Antwort beim Umschalten auf die Tagesübersicht, hinter „Umgeschaltet — “. */
const TEXT_UMSCHALTEN_SPEAKER_VERALTET = 'Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.';
/**
 * iveo-Paket, Spec 6.4 und 11.6 T4 (wortgleich): Antwort beim Umschalten auf ein Side Event ohne Verknüpfung und ohne
 * Merker, hinter „Umgeschaltet — “. Ohne feste Frist: Scheitert die Agenda des Side Events, kommt auch keine Auffrischung.
 */
const TEXT_UMSCHALTEN_OHNE_VERKNUEPFUNG =
  'iveo verknüpft keine Speaker mit diesem Side Event. Die bisherige Speakerliste bleibt bis zur nächsten Auffrischung (in der Regel binnen 5 Minuten), danach gelten alle Speaker des Events.';
/**
 * Teil 2b R2, Spec 15.4 (wortgleich): Zusatzabruf der Side-Event-Liste in der Agenda-Abfrage gescheitert. Ohne Präfix und
 * ohne Uhrzeit wie TEXT_SPEAKER_VERALTET; gelten beide Merker, stehen beide Texte durch „; “ getrennt in der Statuszeile.
 */
const TEXT_SELISTE_VERALTET = 'Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand';
/**
 * iveo-Paket, Spec 5.10 und 11.6 T51 (wortgleich): Merker „Organisationen fehlen“ (nur im Speicher). Ohne Präfix und
 * ohne Uhrzeit wie TEXT_SPEAKER_VERALTET; mit anderen Merkern durch „; “ getrennt (statusAusMerkern).
 */
export const TEXT_ORG_FEHLEN = 'iveo liefert keine Organisationen (Feld fehlt), Organisationen aus früherem Stand';
/** iveo-Paket, Spec 5.10 und 11.6 T71 (wortgleich): Warnung, wenn der Merker „Organisationen fehlen“ entsteht. */
const TEXT_ORG_FEHLEN_LOG = 'iveo: kein Speaker trägt Organisationen (Feld fehlt), Organisationen aus der Datei bleiben.';
/** iveo-Paket, Spec 6.2 und 11.6 T2 (wortgleich): Info, wenn ein Auffrischen nichts geändert hat; ‹n› = Speaker in der Datei. */
const textAufgefrischt = (n: number): string => `iveo: Speakerliste aufgefrischt, unverändert (${n} Speaker).`;
/**
 * iveo-Paket, Spec 6.3 und 11.6 T50 (wortgleich): Merker „Speaker-Verknüpfung veraltet“ (nur im Speicher), das Programm-
 * Detail scheiterte beim Auffrischen. Ohne Präfix und ohne Uhrzeit wie TEXT_SPEAKER_VERALTET.
 */
export const TEXT_DETAIL_VERALTET = 'Programm-Detail von iveo nicht abrufbar, Speaker-Verknüpfung aus früherem Stand';
/** iveo-Paket, Spec 6.3 und 11.6 T3 (wortgleich): Warnung beim ersten Fehlschlag des Details und bei jedem neuen Text. */
const textDetailAlt = (fehler: string): string =>
  `iveo: Programm-Detail beim Auffrischen nicht abrufbar (${fehler}), Verknüpfung, Startzeit und Kategorie aus früherem Stand.`;

// ── Reine Helfer (aus iveo-sync.ts hierher gezogen; die Hülle importiert sie für Binden/Discover) ──────────

/** Nur die gesetzten Filter-Kriterien in ein token-freies Show-Filter-Objekt übernehmen. */
export function compactFilter(f: IveoProgramFilter): NonNullable<Show['iveo']>['filter'] | undefined {
  const out: NonNullable<NonNullable<Show['iveo']>['filter']> = {};
  if (f.typeSlug) out.typeSlug = f.typeSlug;
  if (f.formatSlug) out.formatSlug = f.formatSlug;
  if (f.day) out.day = f.day;
  if (f.excludeBlockers) out.excludeBlockers = true;
  if (f.programId) out.programId = f.programId;
  return Object.keys(out).length ? out : undefined;
}

/** id → Anzeigename aller Event-Speaker (für „Verantwortlich" am Ablauf-Punkt). */
export function speakerNameMap(speakers: Array<Parameters<typeof speakerName>[0]>): Map<string, string> {
  return new Map(speakers.map((s) => [s.id, speakerName(s)]));
}

/**
 * Teil 2b, Spec 6.2: Kennung → Name aus den Speakern der Show-Datei (wie `speakerNameMap`, nur aus der Datei). Gilt,
 * wenn die iveo-Speakerliste gescheitert ist: Ein neuer Ablaufpunkt bekommt sein „Verantwortlich“ dann aus diesen
 * Namen. Speaker ohne Kennung fehlen, denn über sie gibt es keine Verknüpfung.
 */
export function speakerNamenAusDatei(speakers: ShowIveoSpeaker[]): Map<string, string> {
  const namen = new Map<string, string>();
  for (const s of speakers) if (s.id !== undefined) namen.set(s.id, s.name);
  return namen;
}

/**
 * Teil 2b, Spec 6.2: Ist die iveo-Speakerliste gescheitert, kommt „Verantwortlich“ aus der Datei. Ein Punkt mit
 * Gegenstück gleicher Kennung in der Datei übernimmt dessen `owner`; hat das Gegenstück keinen, entfällt das Feld.
 * Ein neuer Punkt (ohne Gegenstück) und ein Punkt ohne Kennung bleiben, wie sie sind. Neue Liste, die Eingabe bleibt.
 */
export function uebernimmOwnerAusDatei(ablauf: ShowAblaufItem[], datei: ShowAblaufItem[]): ShowAblaufItem[] {
  const ownerJeKennung = new Map<string, string | undefined>();
  for (const p of datei) if (p.id !== undefined && !ownerJeKennung.has(p.id)) ownerJeKennung.set(p.id, p.owner);
  return ablauf.map((p) => {
    if (p.id === undefined || !ownerJeKennung.has(p.id)) return p;
    const owner = ownerJeKennung.get(p.id);
    if (owner) return { ...p, owner };
    const { owner: _ohne, ...rest } = p;
    return rest;
  });
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
 * Der Side-Event-/Agenda-Pfad ist NICHT betroffen — dort gibt es genau einen Anker.
 */
export function scheduleSafeForList(filter: IveoProgramFilter, programs: IveoProgram[]): boolean {
  if ((filter.day || '').trim()) return true;
  const days = new Set<string>();
  for (const p of programs) {
    const d = programDayKey(p);
    if (d) days.add(d);
  }
  return days.size <= 1;
}

// Fehler → nutzerfreundlich, ohne rohe Upstream-Antwort.
function humanize(e: IveoApiError): string {
  if (e.isUnauthorized) return 'Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).';
  if (e.isNotFoundOrOutOfScope) return 'Event nicht gefunden oder außerhalb des Token-Scopes (404).';
  if (e.status >= 500)
    return `iveo-Server-Fehler (HTTP ${e.status}) — vorübergehend oder serverseitiger Bug. Bitte an den iveo-Entwickler melden (Details im Launcher-Log).`;
  return `iveo-Fehler (${e.code}).`;
}
export function toClientError(e: unknown): { code?: string; error: string } {
  if (e instanceof IveoApiError) return { code: e.code, error: humanize(e) };
  if (istZeitgrenze(e)) return { error: TEXT_ZEITGRENZE };
  return { error: (e as Error)?.message || 'iveo: unbekannter Fehler.' };
}

/**
 * Abbruch durch die Zeitgrenze je Abruf (Spec 7.0, AbortSignal.timeout im fetchImpl der Hülle): TimeoutError, je nach
 * Stelle im Abruf auch AbortError. Einen anderen Abbruch gibt es nicht. Sonst stünde im Panel die englische Rohmeldung.
 * Gilt für die Abrufe des Kerns und der Hülle; Abbrüche der Ordner-Ablage bildet `ordnerFehlerText` selbst ab.
 */
function istZeitgrenze(e: unknown): boolean {
  const name = (e as { name?: unknown } | null | undefined)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** Statustext eines Abfragefehlers (Spec 7.6): 401 eigens, sonst die bestehende Abbildung toClientError. */
function stoerungsText(e: unknown): string {
  if (e instanceof IveoApiError && e.isUnauthorized) return TEXT_TOKEN_UNGUELTIG;
  return toClientError(e).error;
}

/**
 * Signatur eines Ablaufs samt Speakern und Merker (Spec 7.2; Teil 2b, Spec 5.3 und 6.2). Gleich = nichts zu
 * schreiben, kein RELOAD. Punkte und Speaker so, wie sie in der Datei stehen (normalizeAblauf bzw. der Normalisierer
 * der Bindung), Felder in fester Reihenfolge. Die Speaker-Kennung zählt: Liefert der Umwandler Kennungen (Spec 23,
 * M1 = ja), weicht eine Bestands-Show ohne Kennungen deshalb einmal ab, und die nächste schreibende Abfrage trägt sie
 * nach. Im geltenden Zweig B (M1 = nein) setzt er keine, dann gibt es nichts nachzutragen. Der Merker „Speaker
 * veraltet“ zählt ebenso: Setzen und Löschen schreiben die Show und schicken RELOAD — nur so erfährt der Titler davon.
 * Teil 2b R2, Spec 15.4: Die Side Events zählen als `[id, title]`, so wie sie in der Datei stehen. Eine geänderte Liste
 * schreibt und benachrichtigt; fehlt der Parameter, gilt die leere Liste.
 * Die Organisationen eines Speakers zählen (iveo-Paket, Spec 5.5).
 */
export function ablaufSignatur(
  ablauf: ShowAblaufItem[],
  speakers: ShowIveoSpeaker[],
  speakerVeraltetSeit?: string,
  sideEvents: ShowIveoProgramRef[] = [],
): string {
  const punkte = normalizeAblauf(ablauf).map((p) => [
    p.id ?? null,
    p.label,
    p.durationMs ?? null,
    p.note ?? null,
    p.plannedStartMs ?? null,
    p.owner ?? null,
    p.category ?? null,
  ]);
  const sprecher = speakerWieInDerDatei(speakers).map((s) => [s.id ?? null, s.name.trim(), s.title?.trim() || null, s.organisationen ?? []]);
  const seiten = sideEventsWieInDerDatei(sideEvents).map((s) => [s.id, s.title]);
  return JSON.stringify([punkte, sprecher, speakerVeraltetSeit ?? null, seiten]);
}

/** Side Events so, wie sie nach dem Schreiben in der Datei stehen (Normalisierer der Bindung: getrimmt, leerer Titel → id). */
function sideEventsWieInDerDatei(sideEvents: ShowIveoProgramRef[]): ShowIveoProgramRef[] {
  return migrateShow({ iveo: { event: '-', sideEvents } }).iveo?.sideEvents ?? [];
}

/**
 * Was zwischen zwei Signaturen (`ablaufSignatur`: Ablauf, Speaker, Merker) abweicht, als Satzteil für die Logzeile
 * einer Listen-Abfrage ohne Programmänderung und jeder schreibenden Agenda-Abfrage, etwa „der Merker „Speaker
 * veraltet“ weicht von der Datei ab“.
 */
function abweichungVonDatei(alt: string, neu: string): string {
  const teile = ['der Ablauf', 'die Speakerliste', 'der Merker „Speaker veraltet“', 'die Side-Event-Liste'];
  let anders: string[] = [];
  try {
    const a = JSON.parse(alt) as unknown[];
    const b = JSON.parse(neu) as unknown[];
    anders = teile.filter((_t, i) => JSON.stringify(a[i]) !== JSON.stringify(b[i]));
  } catch {
    // keine lesbare alte Signatur → ohne Einzelheiten
  }
  if (!anders.length) return 'der Stand weicht von der Datei ab';
  const liste = anders.length === 1 ? anders[0] : `${anders.slice(0, -1).join(', ')} und ${anders[anders.length - 1]}`;
  return `${liste} ${anders.length === 1 ? 'weicht' : 'weichen'} von der Datei ab`;
}

/**
 * Speaker so, wie sie nach dem Schreiben in der Datei stehen: derselbe Normalisierer wie parseShow (Kennung nur mit
 * 1–200 Zeichen nach trim, doppelte → #2, ohne Namen fällt der Speaker weg). Sonst wiche die Signatur einer Liste,
 * die der Normalisierer ändert, nach jedem Abruf von der Datei ab — und jede Abfrage schriebe und schickte RELOAD.
 */
function speakerWieInDerDatei(speakers: ShowIveoSpeaker[]): ShowIveoSpeaker[] {
  return migrateShow({ iveo: { event: '-', speakers } }).iveo?.speakers ?? [];
}

/**
 * iveo-Paket, Spec 5.10: Trägt kein Speaker der iveo-Liste ein Array `organisations` (Feld fehlt überall, etwa nach einer
 * Schemaänderung), gilt das nicht als „alle Organisationen gelöscht“. Eine leere Liste zählt nicht.
 */
function ohneOrganisationsFeld(roh: IveoSpeaker[]): boolean {
  return roh.length > 0 && !roh.some((s) => Array.isArray(s.organisations));
}

/**
 * iveo-Paket, Spec 5.10: `frisch` sind die aus `roh` (Speakerliste aus iveo) gebauten Speaker, `datei` die der Datei.
 * Trägt kein Speaker in `roh` das Feld und hat die Datei Organisationen, bekommt jeder frische Speaker die Organisationen
 * des Datei-Speakers mit derselben Kennung, sonst mit demselben Namen nach Trimmen (der Mapper setzt keine Kennung); ohne
 * Treffer bleibt das Feld weg; `feldFehlt` ist wahr, wenn mindestens ein frischer Speaker Organisationen übernommen hat
 * (Merker `orgFehlenSeit`). Sonst gilt `frisch` unverändert. Beim
 * Binden gibt es keine Datei; dort gilt die Liste, wie sie kommt (iveo-sync.ts nutzt diese Regel nicht).
 */
export function organisationenAusDatei(
  frisch: ShowIveoSpeaker[],
  roh: IveoSpeaker[],
  datei: ShowIveoSpeaker[],
): { speakers: ShowIveoSpeaker[]; feldFehlt: boolean } {
  if (!ohneOrganisationsFeld(roh) || !datei.some((s) => s.organisationen?.length)) return { speakers: frisch, feldFehlt: false };
  const gegenstueck = (s: ShowIveoSpeaker): ShowIveoSpeaker | undefined =>
    (s.id !== undefined ? datei.find((x) => x.id === s.id) : undefined) ?? datei.find((x) => x.name.trim() === s.name.trim());
  const speakers = frisch.map((s) => {
    const orgs = gegenstueck(s)?.organisationen;
    return orgs?.length ? { ...s, organisationen: [...orgs] } : s;
  });
  return { speakers, feldFehlt: speakers.some((s) => s.organisationen?.length) };
}

/** Merker, die die Statuszeile zeigt (Teil 2b, 2b R2, iveo-Paket Spec 6.5), aus der Datei und aus dem Speicher. */
export interface StatusMerker {
  speakerVeraltetSeit?: string;
  seListeVeraltetSeit?: string;
  detailVeraltetSeit?: string;
  orgFehlenSeit?: string;
}

/**
 * Statuszeile aus den Merkern (Teil 2b, Spec 6.2; 2b R2, Spec 15.4; iveo-Paket, Spec 6.5): die EINE Regel für Abfrage,
 * Umschalten, Öffnen und Speichern der offenen Show. Ohne Merker „in Ordnung“; sonst ihre Texte in der festen
 * Reihenfolge der Liste unten durch „; “ getrennt, „seit“ = der früheste Merker. Rein; für das Kreuzprodukt im Test
 * exportiert.
 */
export function statusAusMerkern(m: StatusMerker): IveoSyncStatus {
  const da = ([
    [m.speakerVeraltetSeit, TEXT_SPEAKER_VERALTET],
    [m.seListeVeraltetSeit, TEXT_SELISTE_VERALTET],
    [m.detailVeraltetSeit, TEXT_DETAIL_VERALTET],
    [m.orgFehlenSeit, TEXT_ORG_FEHLEN],
  ] as Array<[string | undefined, string]>).filter((t): t is [string, string] => !!t[0]);
  if (!da.length) return { ok: true };
  const seit = da.map(([s]) => s).reduce((x, y) => (Date.parse(y) < Date.parse(x) ? y : x));
  return { ok: false, text: da.map(([, t]) => t).join('; '), seit };
}

/**
 * 1-Punkt-Ablauf eines Side Events ohne Agenda: das Programm selbst als ein Punkt. Binden, Abfrage und Umschalten
 * bilden ihn gleich, OHNE stagesById (Spec 7.2) — sonst trüge nur das Binden den Bühnennamen in der Notiz, und
 * jede Abfrage danach meldete ein Schein-„geändert“.
 */
export function einPunktAblauf(programm: IveoProgram, namen?: Map<string, string>): ShowAblaufItem {
  return programToAblaufItem(programm, { withSchedule: true, speakerNamesById: namen });
}

/** Windows: Groß-/Kleinschreibung im Pfad zählt nicht (gleiche Regel wie der Gedächtnis-Schlüssel, Spec 4.7). */
function pfadSchluessel(p: string): string {
  return resolve(p).toLowerCase();
}

type SideKontext = {
  firstStartMs: number | null;
  category?: string;
  speakerNames?: Array<[string, string]>;
  /**
   * Speaker-IDs aus dem Programm-Detail (Teil 2b, Spec 6.2). Die Agenda-Abfrage holt das Detail nur ohne Kontext; mit
   * Merker braucht sie die Verknüpfungen trotzdem, um die frische Speakerliste wie beim Umschalten einzugrenzen.
   */
  detailSpeakerIds: string[];
};

/** Speaker-IDs, die iveo an ein Side Event (Detail oder Agenda-Punkte) hängt. */
function sideSpeakerIds(detail: IveoProgram | null, agenda: IveoAgendaItem[]): string[] {
  return [...new Set<string>([...extractSpeakerIds(detail), ...agenda.flatMap((it) => extractSpeakerIds(it))])];
}

/**
 * Side-Event-Kontext (Startzeit-Anker, Kategorie, Speakernamen) — der EINE Aufbau für Abfrage und Umschalten.
 * `alleSpeaker` ist die volle Speakerliste des Events; sie muss da sein, wenn `sideSpeakerIds` etwas liefert
 * (sonst fehlte „Verantwortlich“, der Kontext wäre nicht vollständig → der Aufrufer merkt ihn dann nicht).
 */
function sideKontext(detail: IveoProgram | null, alleSpeaker?: IveoSpeaker[]): SideKontext {
  return {
    firstStartMs: detail ? localTimeOfDayMs(detail) : null,
    category: ((detail?.format_slug || detail?.type_slug) || '').trim() || undefined,
    speakerNames: alleSpeaker ? [...speakerNameMap(alleSpeaker)] : undefined,
    detailSpeakerIds: extractSpeakerIds(detail),
  };
}

/**
 * Ergebnis eines Listen-Snapshots (Listen-Abfrage, Tagesübersicht), so wie es zu schreiben ist: Ablauf, Speaker und
 * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2; `undefined` = kein Merker). `orgFehlen` (iveo-Paket, Spec 5.10): Ergebnis
 * der Regel „Feld fehlt“, nur mit gelungener Speakerliste.
 */
type ListenStand = { ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; merker: string | undefined; orgFehlen?: boolean };

interface AktiveShow {
  path: string;
  /** Kanonischer Event-Slug (Token-Schlüssel). */
  event: string;
  baseUrl: string;
  /** Letzter erfolgreicher Abgleich (ISO) — Basis fürs ?updated_since=. */
  lastSyncIso: string;
  /** Ablauf-Filter der Show (identisch zum Binden). */
  filter: IveoProgramFilter;
  /** Signatur des Stands in der Datei (7.2). */
  lastSig: string;
  /**
   * Side-Event-Kontext (Startzeit-Anker, Kategorie, Speakernamen). Die Agenda-Abfrage hat keinen Snapshot; ohne
   * diesen Merker fehlten Startzeit/Kategorie/Verantwortlich. Namen als Array-Paare (klonbar).
   */
  sideCtx?: SideKontext;
  /**
   * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2): ISO-Zeit des ersten Fehlschlags der iveo-Speakerliste, so wie er in
   * der Datei steht. `setzeAuf` liest ihn aus der Datei (Öffnen, Speichern); ein Neustart verliert ihn deshalb nicht.
   * Er rückt wie lastSig erst nach erfolgreichem Schreiben vor.
   */
  speakerVeraltetSeit?: string;
  /**
   * Teil 2b R2, Spec 15.4: `updated_since` für den Zusatzabruf der Side-Event-Liste in der Agenda-Abfrage. Anfangs
   * `syncedAt` der Show; rückt nach jedem gelungenen Zusatzabruf vor, dessen Stand in der Datei steht.
   */
  seListeIso: string;
  /** Teil 2b R2, Spec 15.4: Merker „Side-Event-Liste veraltet“ (nur im Speicher), ISO-Zeit des ersten Fehlschlags. */
  seListeVeraltetSeit?: string;
  /**
   * iveo-Paket, Spec 6.3: Merker „Speaker-Verknüpfung veraltet“ (nur im Speicher, nicht in der Signatur), ISO-Zeit des
   * ersten Fehlschlags des Programm-Details beim Auffrischen. Solange er gilt, holt jede Agenda-Abfrage das Detail.
   */
  detailVeraltetSeit?: string;
  /**
   * iveo-Paket, Spec 5.10: Merker „Organisationen fehlen“ (nur im Speicher, nicht in der Signatur), ISO-Zeit, seit kein
   * Speaker der iveo-Liste das Feld trägt und die Organisationen der Datei gelten.
   */
  orgFehlenSeit?: string;
  /**
   * iveo-Paket, Spec 6.1: Zeitpunkt (ISO) vor dem letzten gelungenen Abruf der Speakerliste, dessen Ergebnis in der Datei
   * steht (geschrieben oder Signatur gleich). Startwert ist das Öffnen. Gegen ihn prüft `faellig` (nur im Speicher).
   */
  speakerAbgerufen: string;
}

/**
 * iveo-Paket, Spec 6.5: was `setzeAuf` beim Speichern der offenen Show aus der vorigen `AktiveShow` übernimmt (sonst gelten
 * die Startwerte): `speakerAbgerufen` und `orgFehlenSeit` bei gleicher Bindung, `seListeVeraltetSeit` und
 * `detailVeraltetSeit` nur beim selben Side Event.
 */
type SpeicherStand = Partial<Pick<AktiveShow, 'speakerAbgerufen' | 'seListeVeraltetSeit' | 'detailVeraltetSeit' | 'orgFehlenSeit'>>;

/** Ergebnis des Zusatzabrufs der Side-Event-Liste (Spec 15.4); `liste` null = seit `seListeIso` nichts geändert. */
type SeListeAbruf = { ok: true; liste: ShowIveoProgramRef[] | null; ab: string } | { ok: false; fehler: unknown };

export function erzeugeKern(d: KernAbhaengigkeiten): IveoKern {
  let active: AktiveShow | null = null;
  /** Pfad der offenen Show, auch ohne iveo (Spec 7.5). */
  let offenePfad: string | null = null;
  /** Steigt bei Öffnen, Schließen, Umschalten und Speichern der offenen Show (7.3). */
  let generation = 0;
  let abfrageLaeuft = false;
  /** Während eines Umschaltens startet der Takt keine Abfrage — sie rechnete noch mit dem alten Filter. */
  let umschaltenLaeuft = false;
  /** Umschaltungen laufen nacheinander (7.3). */
  let kette: Promise<unknown> = Promise.resolve();
  let status: IveoSyncStatus = { ok: true };
  /** Zuletzt geloggter Fehlertext der Speakerliste (Spec 6.3): gleichbleibende Wiederholungen nicht erneut loggen. */
  let letzterSpeakerFehler: string | null = null;
  /** Teil 2b R2, Spec 15.4: zuletzt geloggter Fehlertext des Zusatzabrufs der Side-Event-Liste. */
  let letzterSeListeFehler: string | null = null;
  /** iveo-Paket, Spec 6.3: zuletzt geloggter Fehlertext des Programm-Details beim Auffrischen (T3). */
  let letzterDetailFehler: string | null = null;

  /** 7.3: Ergebnis gilt nur, wenn Show UND Generation noch dieselben sind wie beim Start. */
  const istAktuell = (a: AktiveShow, gen: number): boolean => active === a && generation === gen;
  /** iveo-Paket, Spec 6.1: Abfragetakt der Hülle für die Regel „fällig“. */
  const taktMs = d.taktMs ?? IVEO_ABFRAGE_TAKT_MS;
  /** iveo-Paket, Spec 6.1: Auffrischen der Speakerliste fällig (jetzt − speakerAbgerufen + Takt ≥ 300 s, im Takt ab 255 s). */
  const faellig = (a: AktiveShow, jetzt: string): boolean =>
    auffrischenFaellig(Date.parse(a.speakerAbgerufen), Date.parse(jetzt), taktMs);

  // Spec 7.6: nur Wechsel melden. Der erste Fehlschlag und jeder neue Fehlertext kommen als Warnung ins Log,
  // gleichbleibende Wiederholungen nicht (sonst wüchse das Log alle 45 s).
  function statusOk(): void {
    if (status.ok) return;
    status = { ok: true };
    d.log.info('iveo-Abgleich wieder in Ordnung.');
    d.meldeStatus(status);
  }
  /**
   * `seit` gesetzt (Teil 2b, Spec 6.3: der Merker „Speaker veraltet“) → status.seit = seit. Die Statuszeile nennt
   * dann die Zeit des ersten Fehlschlags, auch über einen Neustart hinweg. Ohne `seit` wie in 2a.
   */
  function statusGestoert(text: string, roh?: string, seit?: string): void {
    if (!status.ok && status.text === text && (seit === undefined || status.seit === seit)) return;
    // „seit“ = Beginn der Störung; ein neuer Text innerhalb derselben Störung behält ihn.
    status = { ok: false, text, seit: seit ?? (status.ok ? d.jetztIso() : status.seit) };
    d.log.warn(`iveo-Abgleich gestört: ${text}${roh && roh !== text ? ` [${roh}]` : ''}`);
    d.meldeStatus(status);
  }
  /**
   * Teil 2b, Spec 6.2: Nach einer Abfrage oder einem Umschalten „in Ordnung“ nur ohne Merker. Mit Merker bleibt der
   * Text aus 6.3 stehen, „seit“ = erster Fehlschlag. Teil 2b R2, Spec 15.4, und iveo-Paket, Spec 6.5: ebenso mit den
   * Merkern im Speicher; gelten mehrere, stehen ihre Texte durch „; “ getrennt da, „seit“ = der früheste (statusAusMerkern).
   */
  function statusNachAbfrage(a: AktiveShow): void {
    const s = statusAusMerkern(a);
    if (s.ok) statusOk();
    else statusGestoert(s.text ?? '', undefined, s.seit);
  }
  /** Teil 2b R2, Spec 15.4: Warnung beim ersten Fehlschlag des Zusatzabrufs und bei jedem neuen Fehlertext. */
  function meldeSeListeFehler(e: unknown): void {
    const text = (e as Error)?.message || String(e);
    if (text === letzterSeListeFehler) return;
    letzterSeListeFehler = text;
    d.log.warn(`iveo: Side-Event-Liste nicht abrufbar (${text}), Liste aus der Datei bleibt.`);
  }
  /** iveo-Paket, Spec 6.3 (T3): Warnung beim ersten Fehlschlag des Programm-Details und bei jedem neuen Fehlertext. */
  function meldeDetailFehler(e: unknown): void {
    const text = (e as Error)?.message || String(e);
    if (text === letzterDetailFehler) return;
    letzterDetailFehler = text;
    d.log.warn(textDetailAlt(text));
  }
  /**
   * Teil 2b R2, Spec 15.4: Zusatzabruf der Agenda-Abfrage. Fragt `listProgramsUpdatedSince(event, seListeIso)`; liefert
   * das etwas, lädt er `listPrograms(event)` und bildet die Liste neu. `ab` (vor dem Abruf genommen) wird das nächste
   * `seListeIso`. Wirft nie: ein Fehlschlag hält die Abfrage nicht an.
   */
  async function seListeZusatzabruf(client: IveoClientLike, a: AktiveShow): Promise<SeListeAbruf> {
    const ab = d.jetztIso();
    try {
      const geaendert = await client.listProgramsUpdatedSince(a.event, a.seListeIso);
      if (!geaendert.length) return { ok: true, liste: null, ab };
      return { ok: true, liste: bildeSideEventListe(await client.listPrograms(a.event), a.filter), ab };
    } catch (e) {
      return { ok: false, fehler: e };
    }
  }
  /** Teil 2b, Spec 6.3 (wie 2a-Spec 7.6): Warnung beim ersten Fehlschlag der Speakerliste und bei jedem neuen Text. */
  function meldeSpeakerFehler(e: unknown): void {
    const text = (e as Error)?.message || String(e);
    if (text === letzterSpeakerFehler) return;
    letzterSpeakerFehler = text;
    d.log.warn(`iveo: Speakerliste nicht abrufbar (${text}), Speaker aus der Datei bleiben.`);
  }
  /** Teil 2b, Spec 6.3: Die Speakerliste kam wieder und steht jetzt in der Datei. */
  function meldeSpeakerWieder(): void {
    letzterSpeakerFehler = null;
    d.log.info('iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.');
  }
  /**
   * iveo-Paket, Spec 5.10: nach einer gelungenen Speakerliste, deren Stand in der Datei steht (geschrieben oder Signatur
   * gleich). `feldFehlt` undefined = keine frische Liste, der Merker bleibt. Wahr: der Merker gilt, „seit“ bleibt der erste
   * Zeitpunkt, T71 nur beim Entstehen. Falsch: der Merker entfällt.
   */
  function merkeOrgFehlen(a: AktiveShow, feldFehlt: boolean | undefined): void {
    if (feldFehlt === undefined) return;
    if (!feldFehlt) {
      a.orgFehlenSeit = undefined;
      return;
    }
    if (a.orgFehlenSeit) return;
    a.orgFehlenSeit = d.jetztIso();
    d.log.warn(TEXT_ORG_FEHLEN_LOG);
  }
  /**
   * Ergebnis eines Abrufs der Speakerliste (Snapshot, Agenda-Abfrage, Side-Event-Umschalten), nur für eine Abfrage bzw.
   * ein Umschalten, das noch gilt (7.3), und vor dem Lesen der Datei — sonst verschluckte eine nicht lesbare Datei die
   * Diagnose. Ein Fehlschlag kommt als Warnung ins Log; kam die Liste, gilt der gemerkte Text nicht mehr, auch wenn der
   * Merker nie in der Show stand (etwa weil das Schreiben scheiterte). Ein späterer Fehlschlag mit demselben Text wird
   * dann wieder gemeldet.
   */
  function speakerListeErgebnis(fehler: unknown[]): void {
    if (fehler.length) meldeSpeakerFehler(fehler[0]);
    else letzterSpeakerFehler = null;
  }
  /**
   * Teilfehler eines Snapshots (Spec 6.2): Ein Fehlschlag der Speakerliste wird gesammelt, nicht verschluckt; andere
   * Metadaten (Bühnen, Organisationen) fehlen dann im Ablauf und kommen als Warnung ins Log.
   */
  function snapshotTeilfehler(wo: 'poll' | 'switch'): { speakerFehler: unknown[]; onSubError: (resource: string, e: unknown) => void } {
    const speakerFehler: unknown[] = [];
    return {
      speakerFehler,
      onSubError: (resource, e) => {
        if (resource === 'speakers') speakerFehler.push(e);
        else d.log.warn(`iveo ${wo}: Metadaten „${resource}" übersprungen (${(e as Error).message})`);
      },
    };
  }

  /**
   * Spec 7.1: an allen drei Stellen geht auch RUNDOWN RELOAD hinaus. Teil 2b R2, Spec 15.3/15.6: In der Rolle Master
   * schickt die Hülle nur an diesen Rechner, und die Logzeile nennt die Tools anderer Rechner, die die Daten über den
   * Verbund bekommen. Ein Wurf von verbundReload ändert am RELOAD nichts (Logzeile aus 2a).
   */
  function benachrichtigeAlle(): void {
    let verbund: { andereRechner: number } | null = null;
    try {
      verbund = d.verbundReload?.() ?? null;
    } catch {
      verbund = null;
    }
    const timer = d.benachrichtige('jm-timer', 'TIMER RELOAD');
    const titler = d.benachrichtige('jm-titler', 'TITLER RELOAD');
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    if (verbund) {
      d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown auf diesem Rechner; `
        + `${verbund.andereRechner} Tools anderer Rechner bekommen die Daten über den Verbund.`);
    } else {
      d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
    }
  }

  /** Teil 2b R2, Spec 15.1: an den Verteiler melden. Ein Wurf hält den Abgleich nie an; eine Warnung ohne Fremdtext (G6). */
  function melde(pfad: string, show: Show | null): void {
    if (!d.meldeShow) return;
    try {
      d.meldeShow(pfad, show);
    } catch (e) {
      d.log.warn(`Verbund: Show-Stand nicht weitergegeben (${(e as Error | null)?.name || 'Fehler'}).`);
    }
  }
  /** Teil 2b R2 (E10): die zuletzt erfolgreich geschriebene Show, falls das Zurücklesen gleich danach scheitert. */
  let geschriebeneShow: Show | null = null;
  /**
   * E10: nach einem erfolgreichen Schreiben die Datei zurücklesen, mit dem `updatedAt`, das die Hülle beim Schreiben
   * setzt. Scheitert gerade dieses Lesen (etwa EBUSY durch einen Virenscanner), geht die eben geschriebene Show hinaus
   * (ohne das `updatedAt` der Hülle), nie `null`: Die Datei ist geschrieben, „nicht-lesbar“ wäre falsch (15.1 kennt `null`
   * nur in `offeneShowGespeichert`). Den Grund des Lesefehlers hat der Leser der Hülle schon im Log.
   */
  function meldeGeschrieben(pfad: string): void {
    if (!d.meldeShow) return;
    const show = d.leseShow(pfad) ?? geschriebeneShow;
    if (show) melde(pfad, show);
  }

  /**
   * Stand aus einem Snapshot mit Speakerliste (wie 2a): Speaker und „Verantwortlich“ aus iveo, kein Merker. iveo-Paket,
   * Spec 5.10: `datei` sind die Speaker der Datei; trägt kein Speaker das Feld `organisations`, bleiben ihre Organisationen.
   */
  function standMitSpeakerliste(
    snap: IveoSnapshot,
    listPrograms: IveoProgram[],
    optionen: ProgramMapOptions,
    datei: ShowIveoSpeaker[],
  ): ListenStand {
    const o = organisationenAusDatei(snapshotToShowSpeakers(snap), snap.speakers, datei);
    return {
      ablauf: programsToAblauf(listPrograms, { ...optionen, speakerNamesById: speakerNameMap(snap.speakers) }),
      speakers: o.speakers,
      merker: undefined,
      orgFehlen: o.feldFehlt,
    };
  }

  /**
   * Teil 2b, Spec 6.2: Stand, wenn die Speakerliste gescheitert ist. Es gelten die Speaker der gelesenen Datei. Der
   * Ablauf wird mit deren Namen gebaut (ein neuer Punkt bekommt so sein „Verantwortlich“), danach übernimmt jeder
   * Punkt mit Gegenstück in der Datei dessen `owner`. Ein schon gesetzter Merker bleibt, sonst gilt jetzt.
   */
  function standOhneSpeakerliste(basis: Show, listPrograms: IveoProgram[], optionen: ProgramMapOptions, a: AktiveShow): ListenStand {
    const speakers = basis.iveo?.speakers ?? [];
    const ablauf = programsToAblauf(listPrograms, { ...optionen, speakerNamesById: speakerNamenAusDatei(speakers) });
    return {
      ablauf: uebernimmOwnerAusDatei(ablauf, basis.ablauf ?? []),
      speakers,
      merker: a.speakerVeraltetSeit ?? d.jetztIso(),
    };
  }

  /**
   * Ablauf + Speaker + token-freie Bindung (inkl. Filter) in die Show schreiben (früher rewriteShowAblauf).
   * SYNCHRON — der Aufrufer prüft direkt davor `istAktuell`. `basis` ist die eben gelesene Datei. Die Side-Event-Liste
   * kommt als Parameter (Teil 2b R2, Spec 15.4): neu gebildet oder die Liste der Datei (fürs Live-Umschalten).
   */
  function schreibeAblauf(
    pfad: string,
    basis: Show,
    w: {
      slug: string;
      baseUrl: string;
      name: string;
      ablauf: ShowAblaufItem[];
      speakers: ShowIveoSpeaker[];
      filter: IveoProgramFilter;
      /** Merker „Speaker veraltet“ (Spec 6.2). Fehlt er, steht er nicht in der Datei. */
      speakerVeraltetSeit?: string;
      /** Side-Event-Liste (Spec 15.4). Leer → das Feld fehlt in der Datei. */
      sideEvents: ShowIveoProgramRef[];
    },
  ): boolean {
    const sideEvents = w.sideEvents;
    const compact = compactFilter(w.filter);
    const show: Show = {
      ...basis,
      ablauf: w.ablauf,
      iveo: {
        event: w.slug,
        baseUrl: w.baseUrl,
        name: w.name,
        syncedAt: d.jetztIso(),
        ...(w.speakers.length ? { speakers: w.speakers } : {}),
        ...(w.speakerVeraltetSeit ? { speakerVeraltetSeit: w.speakerVeraltetSeit } : {}),
        ...(sideEvents?.length ? { sideEvents } : {}),
        ...(compact ? { filter: compact } : {}),
      },
    };
    const ok = d.schreibeShow(pfad, show);
    // E10: Scheitert das Zurücklesen gleich danach, meldet meldeGeschrieben diese Show.
    geschriebeneShow = ok ? show : null;
    return ok;
  }

  /**
   * `active` aus einer gelesenen Show neu aufsetzen. Generation + 1: eine laufende Abfrage verwirft ihr Ergebnis.
   * lastSig kommt aus der Datei (7.2) — sonst schrieb die erste Abfrage nach jedem Öffnen ohne Änderung neu und
   * schickte ein Schein-RELOAD (im Log von #235 sichtbar). iveo-Paket, Spec 6.5: `mit` trägt beim Speichern der offenen
   * Show die Merker im Speicher und den Zeitpunkt des letzten Abrufs der Speakerliste (offeneShowGespeichert); sonst leer.
   */
  function setzeAuf(pfad: string, show: Show, mit: SpeicherStand = {}): AktiveShow | null {
    generation++;
    offenePfad = pfad;
    active = null;
    // Die Störung der vorigen Show gehört nicht zu dieser: zurücksetzen. War sie der UI gemeldet und folgt
    // unten keine neue, geht „wieder in Ordnung“ hinaus (sonst bliebe die Statuszeile auf A's Störung stehen).
    const vorher = status;
    status = { ok: true };
    const nachStoerungOk = (): void => {
      if (vorher.ok) return;
      d.log.info('iveo-Abgleich wieder in Ordnung.');
      d.meldeStatus(status);
    };
    const binding = show.iveo;
    if (!binding?.event) {
      nachStoerungOk();
      return null;
    }
    if (!d.token(binding.event)) {
      // Show auf einem anderen Rechner gebunden: der Ablauf aus der Datei läuft offline weiter (7.6).
      statusGestoert(TEXT_KEIN_TOKEN);
      return null;
    }
    const seit = binding.syncedAt || d.jetztIso();
    active = {
      path: pfad,
      event: binding.event,
      baseUrl: binding.baseUrl || d.baseUrlStandard(),
      lastSyncIso: seit,
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? [], binding.speakerVeraltetSeit, binding.sideEvents),
      speakerVeraltetSeit: binding.speakerVeraltetSeit,
      seListeIso: seit,
      // Der Merker „Side-Event-Liste veraltet“ liegt nur im Speicher (15.4): beim Speichern der offenen Show reicht
      // der Aufrufer ihn durch, damit die Statuszeile von Anfang an stimmt. iveo-Paket, Spec 6.5: ebenso die Merker
      // „Speaker-Verknüpfung veraltet“ und „Organisationen fehlen“ und der Zeitpunkt des letzten Abrufs der Speakerliste;
      // ohne ihn ist der Startwert des Auffrischens das Öffnen (6.1).
      seListeVeraltetSeit: mit.seListeVeraltetSeit,
      detailVeraltetSeit: mit.detailVeraltetSeit,
      orgFehlenSeit: mit.orgFehlenSeit,
      speakerAbgerufen: mit.speakerAbgerufen ?? d.jetztIso(),
    };
    // iveo-Paket, Spec 6.5: Die Bedingung prüft alle Merker aus Datei und Speicher, mit derselben Regel wie die Statuszeile.
    if (!statusAusMerkern(active).ok) {
      // Teil 2b, Spec 6.2/6.3: Mit Merker ist die Statuszeile von Anfang an „gestört“. Stand vorher schon derselbe
      // Text mit demselben „seit“ (Speichern der offenen Show), bleibt er ohne Meldung und ohne Log.
      if (!vorher.ok) status = vorher;
      statusNachAbfrage(active);
    } else nachStoerungOk();
    d.log.info(`iveo: Live-Abgleich für Event „${binding.event}“ aktiv.`);
    return active;
  }

  function showGeoeffnet(pfad: string, show: Show): void {
    setzeAuf(pfad, show);
    // Spec 15.1: jede geöffnete Show, auch ohne iveo-Bindung oder Token.
    melde(pfad, show);
    d.meldeAktiv();
  }

  function showGeschlossen(): void {
    generation++;
    active = null;
    offenePfad = null;
    statusOk();
  }

  async function abfrage(): Promise<void> {
    // 7.3: Abfragen laufen nacheinander. Läuft noch eine (oder ein Umschalten), startet der Takt keine zweite.
    if (abfrageLaeuft || umschaltenLaeuft) return;
    const a = active;
    if (!a) return;
    const gen = generation;
    abfrageLaeuft = true;
    try {
      const tok = d.token(a.event);
      if (!tok) {
        statusGestoert(TEXT_KEIN_TOKEN);
        return;
      }
      const client = d.clientFabrik(tok, a.baseUrl);
      // Agenda-Modus (ein Side Event): Agenda-Änderungen erhöhen das Programm-`updated_at` NICHT (§8) → die Agenda
      // bei jeder Abfrage direkt holen und nur bei echter Änderung schreiben.
      if (a.filter.programId) await abfrageAgenda(client, a, gen);
      else await abfrageListe(client, a, gen);
    } catch (e) {
      // Netz, 5xx, 429, 401: der Takt läuft weiter, Zustand „gestört“ (7.6). Eine veraltete Abfrage zählt nicht.
      if (istAktuell(a, gen)) statusGestoert(stoerungsText(e), (e as Error)?.message);
    } finally {
      abfrageLaeuft = false;
    }
  }

  /**
   * Listen-Modus (früher pollOnce): nur bei einem `updated_since`-Treffer den Snapshot holen, dann Signatur (7.2).
   * Teil 2b, Spec 6.2: Solange der Merker „Speaker veraltet“ gilt, holt jede Abfrage den Snapshot, bis die
   * Speakerliste wieder kommt. Scheitert sie, gelten Speaker und „Verantwortlich“ der Datei, der Merker bleibt oder
   * ist jetzt. Gelingt sie, entfällt der Merker. iveo-Paket, Spec 6.2 (E10): Ist das Auffrischen fällig, läuft der
   * Snapshot-Weg wie bei einer Programmänderung; geschrieben wird nur bei abweichender Signatur.
   */
  async function abfrageListe(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const geaendert = await client.listProgramsUpdatedSince(a.event, a.lastSyncIso);
    // iveo-Paket, Spec 6.1: Zeitpunkt vor dem Snapshot. Gegen ihn prüft „fällig“, auf ihn rückt `speakerAbgerufen` vor
    // (nicht auf die Zeit nach dem Abruf: ein langsamer Abruf schöbe sonst das nächste Auffrischen hinaus).
    const ab = d.jetztIso();
    if (!geaendert.length && !a.speakerVeraltetSeit && !faellig(a, ab)) {
      // iveo-Paket, Spec 5.10/6.5: Merker im Speicher (etwa „Organisationen fehlen“) bleiben in der Statuszeile stehen.
      if (istAktuell(a, gen)) statusNachAbfrage(a);
      return; // nichts Neues seit dem letzten Abgleich
    }
    // Programme ESSENZIELL (kein programsBestEffort): ein transienter 500 soll den Ablauf nicht mit [] überschreiben.
    // Speaker best effort, aber ein Fehlschlag ist NICHT „0 Speaker“ (Spec 6.2): er wird hier gemerkt.
    const { speakerFehler, onSubError } = snapshotTeilfehler('poll');
    const snap = await client.getEventSnapshot(a.event, ab, { onSubError });
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    speakerListeErgebnis(speakerFehler);
    const listPrograms = filterPrograms(snap.programs, a.filter);
    // Teil 2b R2, Spec 15.4: Mit dem Snapshot wird die Side-Event-Liste neu gebildet, wie beim Binden.
    const sideEvents = bildeSideEventListe(snap.programs, a.filter);
    const optionen: ProgramMapOptions = {
      stagesById: new Map(snap.stages.map((s) => [s.id, s])),
      // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
      withSchedule: scheduleSafeForList(a.filter, listPrograms),
    };
    // Spec 6.2: Scheitert die Speakerliste, wird die Datei VOR dem Vergleich gelesen — ihre Speaker und ihr
    // „Verantwortlich“ gelten. iveo-Paket, Spec 5.10: ebenso, wenn kein Speaker das Feld `organisations` trägt — dann
    // bleiben die Organisationen der Datei. Sonst wie in 2a erst, wenn sich etwas geändert hat.
    let basis: Show | null = null;
    if (speakerFehler.length || ohneOrganisationsFeld(snap.speakers)) {
      basis = d.leseShow(a.path);
      if (!basis) {
        statusGestoert(TEXT_SHOW_NICHT_LESBAR);
        return;
      }
    }
    const { ablauf, speakers, merker, orgFehlen } = speakerFehler.length && basis
      ? standOhneSpeakerliste(basis, listPrograms, optionen, a)
      : standMitSpeakerliste(snap, listPrograms, optionen, basis?.iveo?.speakers ?? []);
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers, merker, sideEvents);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
      a.seListeIso = snap.fetchedAt;
      a.seListeVeraltetSeit = undefined;
      merkeOrgFehlen(a, orgFehlen);
      // iveo-Paket, Spec 6.1: Die Liste kam, und die Datei hat genau diesen Stand → das Auffrischen gilt ab `ab`.
      if (!speakerFehler.length) a.speakerAbgerufen = ab;
      // Spec 6.2 (T2): ohne Programmänderung die einzige Spur eines Auffrischens (Logzeile, kein Schreiben, kein RELOAD).
      if (geaendert.length) d.log.info(`iveo: ${geaendert.length} Programm(e) geändert, Ablauf unverändert.`);
      else if (!speakerFehler.length) d.log.info(textAufgefrischt(speakerWieInDerDatei(speakers).length));
      statusNachAbfrage(a);
      return;
    }
    if (!basis) basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
      sideEvents,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    // Erst nach erfolgreichem Schreiben (Schliff F1): Scheitert es, stünde sonst bei jeder Abfrage eine falsche Zeile im Log.
    if (geaendert.length) d.log.info(`iveo: ${geaendert.length} Programm(e) geändert → Ablauf neu (${ablauf.length} Punkte).`);
    else d.log.info(`iveo: kein Programm geändert, aber ${abweichungVonDatei(a.lastSig, sig)} → Show neu geschrieben (${ablauf.length} Punkte).`);
    const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    a.seListeIso = snap.fetchedAt;
    a.seListeVeraltetSeit = undefined;
    a.speakerVeraltetSeit = merker;
    merkeOrgFehlen(a, orgFehlen);
    // iveo-Paket, Spec 6.1: erst nach erfolgreichem Schreiben; scheitert es, holt der nächste Takt die Liste erneut.
    if (!speakerFehler.length) a.speakerAbgerufen = ab;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    meldeGeschrieben(a.path);
    benachrichtigeAlle();
  }

  /**
   * Agenda-Modus (früher pollSideEvent). Spec 7.6: Scheitert die Agenda oder das Nachladen des Side-Event-Kontexts,
   * bricht die Abfrage ab (nichts geschrieben, kein RELOAD, „gestört“). Nur eine erfolgreich LEERE Agenda wird zum
   * 1-Punkt-Ablauf. Speaker und Name kommen aus der Datei (neu eingegrenzt wird nur beim Binden und Umschalten).
   * Teil 2b, Spec 6.2: Mit Merker „Speaker veraltet“ holt die Abfrage zusätzlich die Speakerliste, auch bei gemerktem
   * Kontext. Gelingt sie, gelten die verknüpften Speaker (ohne Verknüpfung die ganze Liste), und der Merker entfällt.
   * Scheitert sie, bleiben Speaker und Merker der Datei; fehlt zugleich der Kontext, bricht die Abfrage ab wie in 2a.
   * iveo-Paket, Spec 6.3 (E11, E12): Ist das Auffrischen fällig, holt sie Speakerliste und Programm-Detail; der Detail-
   * Anteil des Kontexts kommt dann aus dem frischen Detail, die Namen aus der frischen Liste. Scheitert nur das Detail,
   * gilt der Merker „Speaker-Verknüpfung veraltet“ (nur im Speicher), und jede weitere Abfrage holt das Detail.
   */
  async function abfrageAgenda(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const programId = a.filter.programId!;
    // iveo-Paket, Spec 6.1: Zeitpunkt vor den Abrufen. Gegen ihn prüft „fällig“, auf ihn rückt `speakerAbgerufen` vor.
    const ab = d.jetztIso();
    const auffrischen = faellig(a, ab);
    // iveo-Paket, Spec 8.2 (E19): Die Agenda geht direkt nach ihrem Abruf an den Anhang-Wächter, solange die Abfrage gilt;
    // so kommt sie auch an, wenn ein späterer Abruf dieser Abfrage wirft (Detail und Speakerliste ohne Kontext, Detail bei
    // leerer Agenda). Scheitert der Abruf, erfährt der Wächter es (mit dem Zeitpunkt vor dem Abruf, EP20), und die Abfrage
    // bricht ab wie bisher.
    const agenda = await client.listAgendaItems(a.event, programId).catch((e: unknown): never => {
      if (istAktuell(a, gen)) d.meldeAgenda?.(programId, { ok: false, fehler: e, abgerufen: ab });
      throw e;
    });
    if (istAktuell(a, gen)) d.meldeAgenda?.(programId, { ok: true, agenda, abgerufen: ab });
    let detail: IveoProgram | null = null;
    let ctx = a.sideCtx;
    /** Volle Speakerliste, falls diese Abfrage sie geholt hat (für den Kontext, wegen des Merkers oder weil fällig). */
    let alle: IveoSpeaker[] | undefined;
    /** Fehlschlag der Speakerliste bei gemerktem Kontext; gemeldet erst, wenn die Abfrage noch gilt. */
    const speakerFehler: unknown[] = [];
    /** iveo-Paket, Spec 6.3: Fehlschlag des Programm-Details bei gemerktem Kontext; bricht die Abfrage nie ab. */
    const detailFehler: unknown[] = [];
    if (!ctx) {
      // Nach dem Öffnen einer gespeicherten Show fehlt der Kontext (er entsteht beim Binden/Umschalten). Ohne ihn
      // fehlten Startzeit, Kategorie und Verantwortlich → nachladen; scheitert das, bricht die Abfrage ab (7.6).
      detail = await client.getProgram(a.event, programId);
      // Scheitert die Speakerliste, bricht die Abfrage ab (wie getProgram): sonst entstünde ein Ablauf ohne „Verantwortlich“.
      // Mit Merker wird sie auch ohne Verknüpfung geholt (Spec 6.2), ebenso, wenn das Auffrischen fällig ist (iveo-Paket,
      // Spec 6.3: dort zählt „fällig“ wie der Merker); ein Fehlschlag bricht dann ebenso ab.
      // Fix-Runde 1 (P22): Ohne Verknüpfung braucht der Ablauf die Liste nicht (kein „Verantwortlich“): Wird sie nur
      // wegen „fällig“ geholt, sammelt ein Fehlschlag wie im Zweig mit Kontext (Merker unten), statt die Agenda des
      // Side Events zu blockieren. Fix-Runde 2: Mit Merker bleibt es beim Abbruch (Teil-2b-Spec :248, iveo-Paket 12.2 Nr. 12).
      const verknuepft = sideSpeakerIds(detail, agenda).length > 0;
      if (verknuepft || a.speakerVeraltetSeit || auffrischen) {
        try {
          alle = await client.listSpeakers(a.event);
        } catch (e) {
          if (verknuepft || a.speakerVeraltetSeit) throw e;
          speakerFehler.push(e);
        }
      }
      ctx = sideKontext(detail, alle);
    } else {
      // iveo-Paket, Spec 6.3: Fällig holt die Speakerliste und das Programm-Detail, nacheinander. Der Merker „Speaker
      // veraltet“ allein holt wie bisher nur die Liste, der Merker „Speaker-Verknüpfung veraltet“ allein nur das Detail.
      // Kein Fehlschlag bricht die Abfrage ab.
      if (auffrischen || a.speakerVeraltetSeit) {
        try {
          alle = await client.listSpeakers(a.event);
        } catch (e) {
          // Speaker der Datei bleiben, der Merker gilt (unten); die Statuszeile sagt es (statusNachAbfrage).
          speakerFehler.push(e);
        }
      }
      if (auffrischen || a.detailVeraltetSeit) {
        try {
          detail = await client.getProgram(a.event, programId);
        } catch (e) {
          // Verknüpfung, Startzeit und Kategorie bleiben aus dem gemerkten Kontext; Merker und T3 unten.
          detailFehler.push(e);
        }
      }
      // Der Detail-Anteil des Kontexts aus einem Stand, dem frischen Detail; die Namen für „Verantwortlich“ aus der
      // frischen Liste, bevor der Ablauf gebaut wird.
      if (detail) {
        const frisch = sideKontext(detail);
        ctx = { ...ctx, firstStartMs: frisch.firstStartMs, category: frisch.category, detailSpeakerIds: frisch.detailSpeakerIds };
      }
      if (alle) ctx = { ...ctx, speakerNames: [...speakerNameMap(alle)] };
    }
    // Wie in den Snapshot-Zweigen (Befund 7b/7c, Schliff F4): Eine verworfene Abfrage meldet und merkt nichts. Kam die
    // Liste, gilt der gemerkte Fehlertext nicht mehr, auch wenn das Schreiben unten scheitert.
    if ((alle || speakerFehler.length) && istAktuell(a, gen)) speakerListeErgebnis(speakerFehler);
    const names = ctx.speakerNames ? new Map(ctx.speakerNames) : undefined;
    let ablauf = agendaToAblauf(agenda, {
      firstStartMs: ctx.firstStartMs,
      category: ctx.category,
      speakerNamesById: names,
    });
    if (!ablauf.length) {
      // Erfolgreich leere Agenda → das Programm selbst als ein Punkt, wie beim Binden und Umschalten (7.2).
      if (!detail) detail = await client.getProgram(a.event, programId);
      ablauf = [einPunktAblauf(detail, names)];
    }
    // Teil 2b R2, Spec 15.4: Zusatzabruf der Side-Event-Liste. Ein Fehlschlag hält die Abfrage nicht an.
    const se = await seListeZusatzabruf(client, a);
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    if (se.ok) {
      // Der nächste gelungene Zusatzabruf löscht den Merker; ein späterer Fehlschlag kommt wieder ins Log.
      letzterSeListeFehler = null;
      a.seListeVeraltetSeit = undefined;
    } else {
      // Die Liste der Datei bleibt; Merker nur im Speicher, „seit“ = erster Fehlschlag.
      meldeSeListeFehler(se.fehler);
      a.seListeVeraltetSeit ??= d.jetztIso();
    }
    // iveo-Paket, Spec 6.3: Merker „Speaker-Verknüpfung veraltet“ nur im Speicher, „seit“ = erster Fehlschlag; T3 beim
    // ersten Fehlschlag und bei jedem neuen Text. Ein gelungenes Detail löscht ihn, ein späterer Fehlschlag kommt wieder ins Log.
    if (detailFehler.length) {
      meldeDetailFehler(detailFehler[0]);
      a.detailVeraltetSeit ??= d.jetztIso();
    } else if (detail) {
      letzterDetailFehler = null;
      a.detailVeraltetSeit = undefined;
    }
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    let speakers = basis.iveo?.speakers ?? [];
    let merker = a.speakerVeraltetSeit;
    /** iveo-Paket, Spec 5.10: Ergebnis der Regel „Feld fehlt“; undefined = keine frische Speakerliste. */
    let orgFehlen: boolean | undefined;
    if (alle) {
      // Spec 6.2: verknüpfte Speaker wie beim Umschalten (Detail und Agenda-Punkte), ohne Verknüpfung die ganze Liste.
      // iveo-Paket, Spec 6.3: dieselbe Regel für den Merker und das Auffrischen (vorher nur mit Merker).
      // iveo-Paket, Spec 5.10: Trägt kein Speaker das Feld `organisations`, bleiben die Organisationen der Datei.
      const verknuepft = new Set<string>([...ctx.detailSpeakerIds, ...agenda.flatMap((it) => extractSpeakerIds(it))]);
      const frisch = speakersToShowSpeakers(verknuepft.size ? alle.filter((s) => verknuepft.has(s.id)) : alle);
      const o = organisationenAusDatei(frisch, alle, speakers);
      speakers = o.speakers;
      orgFehlen = o.feldFehlt;
      merker = undefined;
    } else if (speakerFehler.length) {
      // iveo-Paket, Spec 6.5: Scheitert die Liste beim Auffrischen, gilt der Merker schon beim ersten Fehlschlag: Die Show
      // wird einmal geschrieben (der Merker ist Teil der Signatur), RELOAD geht hinaus, der Titler zeigt H7.
      merker = a.speakerVeraltetSeit ?? d.jetztIso();
    }
    // Spec 15.4: neu gebildete Liste, sonst die der Datei (nichts geändert oder Zusatzabruf gescheitert).
    const sideEvents = se.ok && se.liste ? se.liste : basis.iveo?.sideEvents ?? [];
    const sig = ablaufSignatur(ablauf, speakers, merker, sideEvents);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      if (se.ok) a.seListeIso = se.ab;
      merkeOrgFehlen(a, orgFehlen);
      if (alle) {
        // iveo-Paket, Spec 6.1 und 6.3: Die Liste kam, die Datei hat genau diesen Stand → das Auffrischen gilt ab `ab`; T2.
        a.speakerAbgerufen = ab;
        d.log.info(textAufgefrischt(speakerWieInDerDatei(speakers).length));
      }
      statusNachAbfrage(a);
      return; // nichts geändert → kein RELOAD
    }
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
      sideEvents,
    });
    if (!ok) {
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    // Erst nach erfolgreichem Schreiben (wie Schliff F1): Scheitert es, stünde sonst bei jeder Abfrage eine falsche Zeile im Log.
    // Die Zeile sagt wie Befund 7a, was von der Datei abwich: Oft ist es nur der Merker oder die Speakerliste, nicht die Agenda.
    d.log.info(`iveo: Side Event abgefragt, ${abweichungVonDatei(a.lastSig, sig)} → Show neu geschrieben (${ablauf.length} Punkte).`);
    const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
    a.lastSig = sig;
    a.sideCtx = ctx;
    if (se.ok) a.seListeIso = se.ab;
    a.speakerVeraltetSeit = merker;
    merkeOrgFehlen(a, orgFehlen);
    // iveo-Paket, Spec 6.1: erst nach erfolgreichem Schreiben.
    if (alle) a.speakerAbgerufen = ab;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    meldeGeschrieben(a.path);
    benachrichtigeAlle();
  }

  /**
   * Ein Side Event leichtgewichtig auflösen (früher resolveSideEventLight): Detail + Agenda, KEIN voller Snapshot.
   * Spec 7.6: Scheitert die Agenda, scheitert das Umschalten (null) — nie ein Ersatz-Ablauf aus dem Detail.
   * Speaker werden nur neu eingegrenzt, wenn iveo eine Verknüpfung liefert; sonst bleibt die Liste der Datei.
   */
  async function loeseSideEventLeicht(
    client: IveoClientLike,
    event: string,
    programId: string,
  ): Promise<{
    ablauf: ShowAblaufItem[];
    speakers: ShowIveoSpeaker[] | null;
    warning?: string;
    sideCtx?: SideKontext;
    /** Teil 2b, Spec 6.2: Speakerliste geholt und gelungen, gescheitert oder ohne Verknüpfung gar nicht geholt. */
    speakerAbruf: 'ok' | 'gescheitert' | 'ohne-verknuepfung';
    /** iveo-Paket, Spec 5.10: die volle Speakerliste, wenn sie gelang (für die Regel „Feld fehlt“). */
    alle?: IveoSpeaker[];
    /** iveo-Paket, Spec 6.1: Zeitpunkt vor dem Abruf der Speakerliste (nur mit `speakerAbruf` 'ok' maßgeblich). */
    ab?: string;
  } | null> {
    const detail = await client.getProgram(event, programId).catch((e: unknown) => {
      d.log.warn(`iveo switch: Detail „${programId}" nicht abrufbar (${(e as Error).message}).`);
      return null;
    });
    let agenda: IveoAgendaItem[];
    try {
      agenda = await client.listAgendaItems(event, programId);
    } catch (e) {
      d.log.warn(`iveo switch: agenda-items „${programId}" nicht abrufbar (${(e as Error).message}).`);
      return null;
    }
    const ids = sideSpeakerIds(detail, agenda);
    // null = die Liste der Datei bleibt; der Aufrufer nimmt sie aus dem Lesen, das er auch schreibt.
    let speakers: ShowIveoSpeaker[] | null = null;
    let warning: string | undefined;
    // Vollständig nur mit der Speakerliste (Namensquelle für „Verantwortlich“); ohne Verknüpfung braucht es sie nicht.
    let vollstaendig = true;
    let alle: IveoSpeaker[] | undefined;
    let speakerAbruf: 'ok' | 'gescheitert' | 'ohne-verknuepfung' = 'ohne-verknuepfung';
    let ab: string | undefined;
    if (ids.length) {
      try {
        ab = d.jetztIso();
        alle = await client.listSpeakers(event);
        speakers = speakersToShowSpeakers(alle.filter((s) => ids.includes(s.id)));
        speakerAbruf = 'ok';
        d.log.info(`iveo switch: ${ids.length} Speaker verknüpft, ${speakers.length} aufgelöst.`);
      } catch (e) {
        // Liste der Datei bleibt, owner bleibt leer — und kein Kontext merken: die nächste Abfrage lädt vollständig nach.
        vollstaendig = false;
        speakerAbruf = 'gescheitert';
        d.log.warn(`iveo switch: Speakerliste nicht abrufbar (${(e as Error).message}) — Verantwortlich wird bei der nächsten Abfrage nachgeladen.`);
      }
    } else {
      if (detail) d.log.info(`iveo switch: Programm-Detail-Felder = ${Object.keys(detail).join(', ')}`);
      if (agenda[0]) d.log.info(`iveo switch: Agenda-Item-Felder = ${Object.keys(agenda[0]).join(', ')}`);
      warning = TEXT_UMSCHALTEN_OHNE_VERKNUEPFUNG;
    }
    const kontext = sideKontext(detail, alle);
    const namen = kontext.speakerNames ? new Map(kontext.speakerNames) : undefined;
    let ablauf = agendaToAblauf(agenda, { firstStartMs: kontext.firstStartMs, category: kontext.category, speakerNamesById: namen });
    if (!ablauf.length && detail) ablauf = [einPunktAblauf(detail, namen)];
    d.log.info(
      `iveo: Side Event „${detail?.title?.trim() || programId}" — Agenda-Punkte: ${agenda.length}` +
        `${agenda.length ? '' : ' (keine → Programm als 1 Punkt)'}.`,
    );
    return {
      ablauf,
      speakers,
      warning,
      // Ohne Detail oder ohne Speakerliste keinen Kontext merken: die nächste Abfrage lädt ihn nach (7.6).
      sideCtx: detail && vollstaendig ? kontext : undefined,
      speakerAbruf,
      alle,
      ab,
    };
  }

  /**
   * Ein Umschalten (früher switchSideEvent). Generation + 1: eine laufende Abfrage verwirft ihr Ergebnis, das
   * Umschalten wartet NICHT auf sie (7.3) — so bleibt `LAUNCHER SIDEEVENT` per Rundown-GO schnell, wenn iveo hängt.
   * Merker (filter, sideCtx, lastSig, lastSyncIso) erst nach erfolgreichem Schreiben (7.2).
   */
  async function umschaltenJetzt(
    input: { programId?: string; day?: string },
    angefordertFuer: AktiveShow | null,
  ): Promise<{ ok: boolean; message: string }> {
    // Ein wartendes Umschalten gilt für die Show, die beim ANFORDERN offen war — nicht für die beim Ausführen.
    if (active !== angefordertFuer) return { ok: false, message: TEXT_UMSCHALTEN_VERWORFEN };
    const a = active;
    if (!a) return { ok: false, message: 'Kein iveo-Token für die offene Show — Live-Umschalten nicht möglich.' };
    const tok = d.token(a.event);
    if (!tok) return { ok: false, message: 'iveo-Token nicht mehr vorhanden.' };
    const gen = ++generation;
    umschaltenLaeuft = true;
    try {
      const client = d.clientFabrik(tok, a.baseUrl);
      const programId = input.programId?.trim();
      let ablauf: ShowAblaufItem[];
      let speakers: ShowIveoSpeaker[] | null;
      let filter: IveoProgramFilter;
      let sideCtx: SideKontext | undefined;
      let warning: string | undefined;
      let name: string | undefined;
      let lastSyncIso = a.lastSyncIso;
      /** Merker „Speaker veraltet“, wie er nach dem Umschalten in der Datei steht (Teil 2b, Spec 6.2). */
      let merker = a.speakerVeraltetSeit;
      /**
       * Schon gelesene Datei (Speakerliste gescheitert oder, iveo-Paket Spec 5.10, Feld `organisations` fehlt überall);
       * genau sie wird dann auch geschrieben.
       */
      let basisFrueh: Show | null = null;
      /** Teil 2b R2, Spec 15.4: neu gebildete Liste der Tagesübersicht; null = die Liste der Datei bleibt (Side Event). */
      let sideEvents: ShowIveoProgramRef[] | null = null;
      /** iveo-Paket, Spec 5.10: volle Speakerliste beim Umschalten auf ein Side Event, wenn sie gelang. */
      let roh: IveoSpeaker[] | undefined;
      /** Spec 5.10: Ergebnis der Regel „Feld fehlt“; undefined = keine frische Speakerliste. */
      let orgFehlen: boolean | undefined;
      /** iveo-Paket, Spec 6.1: Zeitpunkt vor dem Abruf der Speakerliste, wenn sie gelang (Side Event, Tagesübersicht). */
      let ab: string | undefined;
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        // Schliff F4: Kam die Speakerliste, gilt der gemerkte Fehlertext nicht mehr, auch wenn das Schreiben scheitert.
        // Einen Fehlschlag meldet loeseSideEventLeicht selbst.
        if (r.speakerAbruf === 'ok' && istAktuell(a, gen)) speakerListeErgebnis([]);
        ({ ablauf, speakers, warning, sideCtx } = r);
        roh = r.alle;
        if (r.speakerAbruf === 'ok') ab = r.ab;
        filter = { ...a.filter, programId };
        // Teil 2b, Spec 6.2: Gelingt die Speakerliste, entfällt der Merker; scheitert sie, wird er gesetzt (ein schon
        // gesetzter bleibt). Ohne Verknüpfung holt das Umschalten keine Liste, der Merker bleibt, wie er ist.
        if (r.speakerAbruf === 'ok') merker = undefined;
        else if (r.speakerAbruf === 'gescheitert') merker = a.speakerVeraltetSeit ?? d.jetztIso();
        // Mit gesetztem Merker ersetzt die nächste Agenda-Abfrage die Liste durch die ganze Event-Liste: der Text sagt das.
        if (r.speakerAbruf === 'ohne-verknuepfung' && merker) warning = 'Speakerliste wird bei der nächsten Abfrage aus iveo aufgefrischt (ganze Liste).';
      } else {
        // Tagesübersicht: alle Side Events des Tages (voller Snapshot nötig).
        const day = input.day || a.filter.day;
        // Teil 2b, Spec 6.2: Ein Fehlschlag der Speakerliste ist nicht „0 Speaker“. Er wird gemerkt, nicht verschluckt.
        const { speakerFehler, onSubError } = snapshotTeilfehler('switch');
        const snap = await client.getEventSnapshot(a.event, d.jetztIso(), { onSubError });
        // Ab hier kein await mehr bis zum Schreiben: Ein verworfenes Umschalten meldet und merkt keinen Speaker-Fehler.
        if (istAktuell(a, gen)) speakerListeErgebnis(speakerFehler);
        filter = { ...a.filter, programId: undefined, day };
        const listPrograms = filterPrograms(snap.programs, filter);
        const optionen: ProgramMapOptions = {
          stagesById: new Map(snap.stages.map((s) => [s.id, s])),
          // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
          withSchedule: scheduleSafeForList(filter, listPrograms),
        };
        let stand: ListenStand;
        if (speakerFehler.length) {
          // Speaker und „Verantwortlich“ aus der Datei, Merker bleibt oder ist jetzt; die Antwort sagt es (6.3).
          basisFrueh = d.leseShow(a.path);
          if (!basisFrueh) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
          stand = standOhneSpeakerliste(basisFrueh, listPrograms, optionen, a);
          warning = TEXT_UMSCHALTEN_SPEAKER_VERALTET;
        } else {
          // iveo-Paket, Spec 5.10: Trägt kein Speaker das Feld `organisations`, wird die Datei schon hier gelesen; genau
          // sie wird dann auch geschrieben.
          if (ohneOrganisationsFeld(snap.speakers)) {
            basisFrueh = d.leseShow(a.path);
            if (!basisFrueh) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
          }
          stand = standMitSpeakerliste(snap, listPrograms, optionen, basisFrueh?.iveo?.speakers ?? []);
          // iveo-Paket, Spec 6.4: Der Snapshot trug die Speakerliste; sein Zeitpunkt wurde vor dem Abruf genommen.
          ab = snap.fetchedAt;
        }
        ({ ablauf, speakers, merker, orgFehlen } = stand);
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        sideEvents = bildeSideEventListe(snap.programs, filter);
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
      }
      if (!ablauf.length) return { ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' };
      // Ab hier kein await mehr (7.3): Show inzwischen gewechselt oder gespeichert → verwerfen, nichts schreiben.
      if (!istAktuell(a, gen)) return { ok: false, message: TEXT_UMSCHALTEN_VERWORFEN };
      const basis = basisFrueh ?? d.leseShow(a.path);
      // Ohne Verknüpfung bleibt die Speakerliste der Datei — aus genau diesem Lesen, das auch geschrieben wird.
      let speakersNeu = speakers ?? basis?.iveo?.speakers ?? [];
      if (speakers && roh) {
        // iveo-Paket, Spec 5.10: Side Event mit Verknüpfung; trägt kein Speaker das Feld, bleiben die Organisationen der Datei.
        const o = organisationenAusDatei(speakers, roh, basis?.iveo?.speakers ?? []);
        speakersNeu = o.speakers;
        orgFehlen = o.feldFehlt;
      }
      const sideEventsNeu = sideEvents ?? basis?.iveo?.sideEvents ?? [];
      const geschrieben =
        basis !== null &&
        schreibeAblauf(a.path, basis, {
          slug: a.event,
          baseUrl: a.baseUrl,
          name: name ?? (basis.iveo?.name || a.event),
          ablauf,
          speakers: speakersNeu,
          filter,
          speakerVeraltetSeit: merker,
          sideEvents: sideEventsNeu,
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, merker, sideEventsNeu);
      a.lastSyncIso = lastSyncIso;
      if (sideEvents) {
        // Tagesübersicht: Die Liste ist frisch aus dem Snapshot.
        a.seListeIso = lastSyncIso;
        a.seListeVeraltetSeit = undefined;
      }
      a.speakerVeraltetSeit = merker;
      merkeOrgFehlen(a, orgFehlen);
      // iveo-Paket, Spec 6.1/6.4: Kam die Speakerliste, gilt das Auffrischen ab dem Zeitpunkt vor ihrem Abruf. Spec 6.5:
      // Das Umschalten setzt den Kontext neu; der Merker „Speaker-Verknüpfung veraltet“ gilt nicht mehr (fehlt das Detail
      // jetzt, lädt die nächste Abfrage es ohne Kontext nach, und ein Fehlschlag bricht sie sichtbar ab).
      if (ab) a.speakerAbgerufen = ab;
      a.detailVeraltetSeit = undefined;
      letzterDetailFehler = null;
      if (speakerWieder) meldeSpeakerWieder();
      d.log.info(`iveo: Side-Event-Umschaltung → ${ablauf.length} Punkte, ${speakersNeu.length} Speaker.`);
      // Teil 2b, Spec 6.2: „in Ordnung“ nur ohne Merker.
      statusNachAbfrage(a);
      meldeGeschrieben(a.path);
      benachrichtigeAlle();
      d.meldeAktiv();
      return { ok: true, message: warning ? `Umgeschaltet — ${warning}` : `Umgeschaltet (${ablauf.length} Punkte).` };
    } catch (e) {
      d.log.warn(`iveo switch fehlgeschlagen: ${(e as Error).message}`);
      return { ok: false, message: toClientError(e).error };
    } finally {
      umschaltenLaeuft = false;
    }
  }

  /** Umschaltungen nacheinander (7.3); ein Umschalten wartet nie auf eine Abfrage. */
  function umschalten(input: { programId?: string; day?: string }): Promise<{ ok: boolean; message: string }> {
    const angefordertFuer = active;
    const lauf = kette.then(() => umschaltenJetzt(input, angefordertFuer));
    kette = lauf.catch(() => {});
    return lauf;
  }

  /**
   * Spec 7.5: Der Show-Editor hat eine Show gespeichert. Zählt nur für die gerade offene Show (auch ohne iveo).
   * Die Hülle ruft das SYNCHRON direkt nach dem synchronen Schreiben auf, ohne await dazwischen — sonst könnte
   * eine laufende Abfrage die eben gespeicherte Datei noch überschreiben. Generation + 1, `active` aus der Datei
   * neu (Filter, lastSig), RELOAD an Timer, Titler und Rundown.
   */
  function offeneShowGespeichert(pfad: string, neuGebunden: boolean): void {
    if (offenePfad === null || pfadSchluessel(pfad) !== pfadSchluessel(offenePfad)) return;
    const vorher = active;
    const pfadOffen = offenePfad;
    const show = d.leseShow(pfadOffen);
    // Spec 15.1: gespeichert und lesbar → die Show; nicht lesbar → null (der Verteiler meldet „nicht-lesbar“).
    melde(pfadOffen, show);
    if (show) {
      // Der Merker „Side-Event-Liste veraltet“ gilt nur im Agenda-Modus: er geht nur mit, wenn Event und Side Event
      // gleich bleiben (15.4). „seit“ bleibt der erste Fehlschlag, nicht die Zeit nach dem Speichern. iveo-Paket, Spec 6.5:
      // ebenso „Speaker-Verknüpfung veraltet“; der Zeitpunkt des letzten Abrufs der Speakerliste und „Organisationen
      // fehlen“ gelten bei gleicher Bindung weiter. Neu gebunden: alles neu.
      const gleicheBindung = !!vorher && !neuGebunden && vorher.event === show.iveo?.event;
      const gleichesProgramm = gleicheBindung && vorher!.filter.programId === show.iveo?.filter?.programId;
      const mit: SpeicherStand = gleicheBindung
        ? {
            speakerAbgerufen: vorher!.speakerAbgerufen,
            orgFehlenSeit: vorher!.orgFehlenSeit,
            ...(gleichesProgramm ? { seListeVeraltetSeit: vorher!.seListeVeraltetSeit, detailVeraltetSeit: vorher!.detailVeraltetSeit } : {}),
          }
        : {};
      const neu = setzeAuf(pfadOffen, show, mit);
      // Gleiche Bindung: Abfragefenster und Side-Event-Kontext gelten weiter. Neu gebunden: beides frisch.
      if (neu && vorher && !neuGebunden && vorher.event === neu.event) {
        neu.lastSyncIso = vorher.lastSyncIso;
        neu.seListeIso = vorher.seListeIso;
        if (vorher.filter.programId === neu.filter.programId) neu.sideCtx = vorher.sideCtx;
      }
    } else {
      // Gerade gespeichert und doch nicht lesbar: lieber anhalten als mit dem alten Filter weiterschreiben.
      generation++;
      active = null;
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
    }
    benachrichtigeAlle();
    d.meldeAktiv();
  }

  function aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null {
    return active ? { path: active.path, event: active.event, filter: { ...active.filter } } : null;
  }

  return { showGeoeffnet, showGeschlossen, abfrage, umschalten, offeneShowGespeichert, aktiv };
}
