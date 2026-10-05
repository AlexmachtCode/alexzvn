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
import { migrateShow, normalizeAblauf, type Show, type ShowAblaufItem, type ShowIveoSpeaker } from '@jm/show';
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
import { IVEO_ABRUF_ZEITGRENZE_MS } from './iveo-huelle-hilfen';

/** Die Teilmenge des iveo-Clients, die der Kern braucht. Im Test nachgebaut. */
export type IveoClientLike = Pick<
  IveoClient,
  'listProgramsUpdatedSince' | 'getEventSnapshot' | 'listAgendaItems' | 'getProgram' | 'listSpeakers'
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
 * der Bindung), Felder in fester Reihenfolge. Die Speaker-Kennung zählt: Eine Bestands-Show ohne Kennungen weicht
 * deshalb einmal ab, und die nächste schreibende Abfrage trägt sie nach. Der Merker „Speaker veraltet“ zählt ebenso:
 * Setzen und Löschen schreiben die Show und schicken RELOAD — nur so erfährt der Titler davon.
 */
export function ablaufSignatur(ablauf: ShowAblaufItem[], speakers: ShowIveoSpeaker[], speakerVeraltetSeit?: string): string {
  const punkte = normalizeAblauf(ablauf).map((p) => [
    p.id ?? null,
    p.label,
    p.durationMs ?? null,
    p.note ?? null,
    p.plannedStartMs ?? null,
    p.owner ?? null,
    p.category ?? null,
  ]);
  const sprecher = speakerWieInDerDatei(speakers).map((s) => [s.id ?? null, s.name.trim(), s.title?.trim() || null]);
  return JSON.stringify([punkte, sprecher, speakerVeraltetSeit ?? null]);
}

/**
 * Was zwischen zwei Signaturen (`ablaufSignatur`: Ablauf, Speaker, Merker) abweicht, als Satzteil für die Logzeile
 * einer Abfrage ohne Programmänderung, etwa „der Merker „Speaker veraltet“ weicht von der Datei ab“.
 */
function abweichungVonDatei(alt: string, neu: string): string {
  const teile = ['der Ablauf', 'die Speakerliste', 'der Merker „Speaker veraltet“'];
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
 * Merker „Speaker veraltet“ (Teil 2b, Spec 6.2; `undefined` = kein Merker).
 */
type ListenStand = { ablauf: ShowAblaufItem[]; speakers: ShowIveoSpeaker[]; merker: string | undefined };

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
}

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

  /** 7.3: Ergebnis gilt nur, wenn Show UND Generation noch dieselben sind wie beim Start. */
  const istAktuell = (a: AktiveShow, gen: number): boolean => active === a && generation === gen;

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
   * Text aus 6.3 stehen, „seit“ = erster Fehlschlag.
   */
  function statusNachAbfrage(a: AktiveShow): void {
    if (a.speakerVeraltetSeit) statusGestoert(TEXT_SPEAKER_VERALTET, undefined, a.speakerVeraltetSeit);
    else statusOk();
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
   * Ergebnis der Speakerliste eines Snapshots, nur für eine Abfrage bzw. ein Umschalten, das noch gilt (7.3), und vor
   * dem Lesen der Datei — sonst verschluckte eine nicht lesbare Datei die Diagnose. Ein Fehlschlag kommt als Warnung ins
   * Log; kam die Liste, gilt der gemerkte Text nicht mehr, auch wenn der Merker nie in der Show stand (etwa weil das
   * Schreiben scheiterte). Ein späterer Fehlschlag mit demselben Text wird dann wieder gemeldet.
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

  /** Spec 7.1: an allen drei Stellen geht auch RUNDOWN RELOAD hinaus. */
  function benachrichtigeAlle(): void {
    const timer = d.benachrichtige('jm-timer', 'TIMER RELOAD');
    const titler = d.benachrichtige('jm-titler', 'TITLER RELOAD');
    const rundown = d.benachrichtige('jm-rundown', 'RUNDOWN RELOAD');
    d.log.info(`iveo: RELOAD → ${timer} Timer, ${titler} Titler, ${rundown} Rundown benachrichtigt.`);
  }

  /** Stand aus einem Snapshot mit Speakerliste (wie 2a): Speaker und „Verantwortlich“ aus iveo, kein Merker. */
  function standMitSpeakerliste(snap: IveoSnapshot, listPrograms: IveoProgram[], optionen: ProgramMapOptions): ListenStand {
    return {
      ablauf: programsToAblauf(listPrograms, { ...optionen, speakerNamesById: speakerNameMap(snap.speakers) }),
      speakers: snapshotToShowSpeakers(snap),
      merker: undefined,
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
   * SYNCHRON — der Aufrufer prüft direkt davor `istAktuell`. `basis` ist die eben gelesene Datei; ihre
   * Side-Event-Liste bleibt erhalten (fürs Live-Umschalten).
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
    },
  ): boolean {
    const sideEvents = basis.iveo?.sideEvents;
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
    return d.schreibeShow(pfad, show);
  }

  /**
   * `active` aus einer gelesenen Show neu aufsetzen. Generation + 1: eine laufende Abfrage verwirft ihr Ergebnis.
   * lastSig kommt aus der Datei (7.2) — sonst schrieb die erste Abfrage nach jedem Öffnen ohne Änderung neu und
   * schickte ein Schein-RELOAD (im Log von #235 sichtbar).
   */
  function setzeAuf(pfad: string, show: Show): AktiveShow | null {
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
    active = {
      path: pfad,
      event: binding.event,
      baseUrl: binding.baseUrl || d.baseUrlStandard(),
      lastSyncIso: binding.syncedAt || d.jetztIso(),
      filter: { ...(binding.filter ?? {}) },
      lastSig: ablaufSignatur(show.ablauf ?? [], binding.speakers ?? [], binding.speakerVeraltetSeit),
      speakerVeraltetSeit: binding.speakerVeraltetSeit,
    };
    const merker = binding.speakerVeraltetSeit;
    if (merker) {
      // Teil 2b, Spec 6.2/6.3: Mit Merker in der Datei ist die Statuszeile von Anfang an „gestört“. Stand vorher schon
      // derselbe Text mit demselben „seit“ (Speichern der offenen Show), bleibt er ohne Meldung und ohne Log.
      if (!vorher.ok && vorher.text === TEXT_SPEAKER_VERALTET && vorher.seit === merker) status = vorher;
      else statusNachAbfrage(active);
    } else nachStoerungOk();
    d.log.info(`iveo: Live-Abgleich für Event „${binding.event}“ aktiv.`);
    return active;
  }

  function showGeoeffnet(pfad: string, show: Show): void {
    setzeAuf(pfad, show);
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
   * ist jetzt. Gelingt sie, entfällt der Merker.
   */
  async function abfrageListe(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const geaendert = await client.listProgramsUpdatedSince(a.event, a.lastSyncIso);
    if (!geaendert.length && !a.speakerVeraltetSeit) {
      if (istAktuell(a, gen)) statusOk();
      return; // nichts Neues seit dem letzten Abgleich
    }
    // Programme ESSENZIELL (kein programsBestEffort): ein transienter 500 soll den Ablauf nicht mit [] überschreiben.
    // Speaker best effort, aber ein Fehlschlag ist NICHT „0 Speaker“ (Spec 6.2): er wird hier gemerkt.
    const { speakerFehler, onSubError } = snapshotTeilfehler('poll');
    const snap = await client.getEventSnapshot(a.event, d.jetztIso(), { onSubError });
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    speakerListeErgebnis(speakerFehler);
    const listPrograms = filterPrograms(snap.programs, a.filter);
    const optionen: ProgramMapOptions = {
      stagesById: new Map(snap.stages.map((s) => [s.id, s])),
      // F3: nur bei eindeutiger Tageszugehörigkeit (s. scheduleSafeForList).
      withSchedule: scheduleSafeForList(a.filter, listPrograms),
    };
    // Spec 6.2: Scheitert die Speakerliste, wird die Datei VOR dem Vergleich gelesen — ihre Speaker und ihr
    // „Verantwortlich“ gelten. Sonst wie in 2a erst, wenn sich etwas geändert hat.
    let basis: Show | null = null;
    if (speakerFehler.length) {
      basis = d.leseShow(a.path);
      if (!basis) {
        statusGestoert(TEXT_SHOW_NICHT_LESBAR);
        return;
      }
    }
    const { ablauf, speakers, merker } = basis
      ? standOhneSpeakerliste(basis, listPrograms, optionen, a)
      : standMitSpeakerliste(snap, listPrograms, optionen);
    d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
    const sig = ablaufSignatur(ablauf, speakers, merker);
    if (sig === a.lastSig) {
      // 7.2: nichts geändert → nicht schreiben, kein RELOAD; das Abfragefenster rückt trotzdem vor.
      a.lastSyncIso = snap.fetchedAt;
      if (geaendert.length) d.log.info(`iveo: ${geaendert.length} Programm(e) geändert, Ablauf unverändert.`);
      statusNachAbfrage(a);
      return;
    }
    if (!basis) basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    if (geaendert.length) d.log.info(`iveo: ${geaendert.length} Programm(e) geändert → Ablauf neu (${ablauf.length} Punkte).`);
    else d.log.info(`iveo: kein Programm geändert, aber ${abweichungVonDatei(a.lastSig, sig)} → Show neu geschrieben (${ablauf.length} Punkte).`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: snap.event.slug,
      baseUrl: a.baseUrl,
      name: snap.event.name,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
    });
    if (!ok) {
      // 7.2: kein RELOAD, Merker bleiben → die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
    a.lastSig = sig;
    a.lastSyncIso = snap.fetchedAt;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
    benachrichtigeAlle();
  }

  /**
   * Agenda-Modus (früher pollSideEvent). Spec 7.6: Scheitert die Agenda oder das Nachladen des Side-Event-Kontexts,
   * bricht die Abfrage ab (nichts geschrieben, kein RELOAD, „gestört“). Nur eine erfolgreich LEERE Agenda wird zum
   * 1-Punkt-Ablauf. Speaker und Name kommen aus der Datei (neu eingegrenzt wird nur beim Binden und Umschalten).
   * Teil 2b, Spec 6.2: Mit Merker „Speaker veraltet“ holt die Abfrage zusätzlich die Speakerliste, auch bei gemerktem
   * Kontext. Gelingt sie, gelten die verknüpften Speaker (ohne Verknüpfung die ganze Liste), und der Merker entfällt.
   * Scheitert sie, bleiben Speaker und Merker der Datei; fehlt zugleich der Kontext, bricht die Abfrage ab wie in 2a.
   */
  async function abfrageAgenda(client: IveoClientLike, a: AktiveShow, gen: number): Promise<void> {
    const programId = a.filter.programId!;
    const agenda = await client.listAgendaItems(a.event, programId);
    let detail: IveoProgram | null = null;
    let ctx = a.sideCtx;
    /** Volle Speakerliste, falls diese Abfrage sie geholt hat (für den Kontext oder wegen des Merkers). */
    let alle: IveoSpeaker[] | undefined;
    if (!ctx) {
      // Nach dem Öffnen einer gespeicherten Show fehlt der Kontext (er entsteht beim Binden/Umschalten). Ohne ihn
      // fehlten Startzeit, Kategorie und Verantwortlich → nachladen; scheitert das, bricht die Abfrage ab (7.6).
      detail = await client.getProgram(a.event, programId);
      // Scheitert die Speakerliste, bricht die Abfrage ab (wie getProgram): sonst entstünde ein Ablauf ohne „Verantwortlich“.
      // Mit Merker wird sie auch ohne Verknüpfung geholt (Spec 6.2); ein Fehlschlag bricht dann ebenso ab.
      alle = sideSpeakerIds(detail, agenda).length || a.speakerVeraltetSeit ? await client.listSpeakers(a.event) : undefined;
      ctx = sideKontext(detail, alle);
    } else if (a.speakerVeraltetSeit) {
      try {
        alle = await client.listSpeakers(a.event);
      } catch (e) {
        // Speaker und Merker der Datei bleiben; der Status bleibt „gestört“ (statusNachAbfrage unten).
        meldeSpeakerFehler(e);
      }
    }
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
    // Ab hier kein await mehr: Prüfen und Schreiben stehen direkt hintereinander (7.3).
    if (!istAktuell(a, gen)) return;
    const basis = d.leseShow(a.path);
    if (!basis) {
      statusGestoert(TEXT_SHOW_NICHT_LESBAR);
      return;
    }
    let speakers = basis.iveo?.speakers ?? [];
    let merker = a.speakerVeraltetSeit;
    if (merker && alle) {
      // Spec 6.2: verknüpfte Speaker wie beim Umschalten (Detail und Agenda-Punkte), ohne Verknüpfung die ganze Liste.
      const verknuepft = new Set<string>([...ctx.detailSpeakerIds, ...agenda.flatMap((it) => extractSpeakerIds(it))]);
      speakers = speakersToShowSpeakers(verknuepft.size ? alle.filter((s) => verknuepft.has(s.id)) : alle);
      merker = undefined;
    }
    const sig = ablaufSignatur(ablauf, speakers, merker);
    if (sig === a.lastSig) {
      // Die Datei entspricht genau diesem Kontext → merken, sonst lädt jede Abfrage ihn neu.
      a.sideCtx = ctx;
      statusNachAbfrage(a);
      return; // nichts geändert → kein RELOAD
    }
    d.log.info(`iveo: Agenda von Side Event geändert → ${ablauf.length} Punkte neu.`);
    const ok = schreibeAblauf(a.path, basis, {
      slug: a.event,
      baseUrl: a.baseUrl,
      name: basis.iveo?.name || a.event,
      ablauf,
      speakers,
      filter: a.filter,
      speakerVeraltetSeit: merker,
    });
    if (!ok) {
      statusGestoert(TEXT_NICHT_GESCHRIEBEN);
      return;
    }
    const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
    a.lastSig = sig;
    a.sideCtx = ctx;
    a.speakerVeraltetSeit = merker;
    if (speakerWieder) meldeSpeakerWieder();
    statusNachAbfrage(a);
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
    if (ids.length) {
      try {
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
      warning = 'iveo verknüpft keine Speaker mit diesem Side Event — bestehende Speakerliste bleibt.';
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
      /** Schon gelesene Datei (nur wenn die Speakerliste gescheitert ist); genau sie wird dann auch geschrieben. */
      let basisFrueh: Show | null = null;
      if (programId) {
        const r = await loeseSideEventLeicht(client, a.event, programId);
        if (!r) return { ok: false, message: TEXT_AGENDA_NICHT_ABRUFBAR };
        ({ ablauf, speakers, warning, sideCtx } = r);
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
          stand = standMitSpeakerliste(snap, listPrograms, optionen);
        }
        ({ ablauf, speakers, merker } = stand);
        name = snap.event.name;
        lastSyncIso = snap.fetchedAt;
        d.schreibeCache(buildShowMetadata(snap, a.baseUrl));
      }
      if (!ablauf.length) return { ok: false, message: 'Side Event nicht auflösbar (leerer Ablauf).' };
      // Ab hier kein await mehr (7.3): Show inzwischen gewechselt oder gespeichert → verwerfen, nichts schreiben.
      if (!istAktuell(a, gen)) return { ok: false, message: TEXT_UMSCHALTEN_VERWORFEN };
      const basis = basisFrueh ?? d.leseShow(a.path);
      // Ohne Verknüpfung bleibt die Speakerliste der Datei — aus genau diesem Lesen, das auch geschrieben wird.
      const speakersNeu = speakers ?? basis?.iveo?.speakers ?? [];
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
        });
      if (!geschrieben) return { ok: false, message: TEXT_NICHT_GESCHRIEBEN };
      const speakerWieder = a.speakerVeraltetSeit !== undefined && merker === undefined;
      a.filter = filter;
      a.sideCtx = sideCtx;
      a.lastSig = ablaufSignatur(ablauf, speakersNeu, merker);
      a.lastSyncIso = lastSyncIso;
      a.speakerVeraltetSeit = merker;
      if (speakerWieder) meldeSpeakerWieder();
      d.log.info(`iveo: Side-Event-Umschaltung → ${ablauf.length} Punkte, ${speakersNeu.length} Speaker.`);
      // Teil 2b, Spec 6.2: „in Ordnung“ nur ohne Merker.
      statusNachAbfrage(a);
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
    const show = d.leseShow(offenePfad);
    if (show) {
      const neu = setzeAuf(offenePfad, show);
      // Gleiche Bindung: Abfragefenster und Side-Event-Kontext gelten weiter. Neu gebunden: beides frisch.
      if (neu && vorher && !neuGebunden && vorher.event === neu.event) {
        neu.lastSyncIso = vorher.lastSyncIso;
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
