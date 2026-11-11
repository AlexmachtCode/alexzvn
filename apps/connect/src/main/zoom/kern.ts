// ─────────────────────────────────────────────────────────────────────────────
// Zoom-Kern (Stage 4a, Spec 5.2–7.5) — OHNE Electron, per tsx gegen die echte Bridge und die
// Attrappe getestet (test/zoom-kern.test.ts). zoom.ts ist die dünne Electron-Hülle darüber
// (IPC, Dialoge, safeStorage, Tray). Muster: Master-Link Teil 2a (verbund/kern.ts).
//
// Der Kern hält Zustand, Mängel der Einrichtung, die laufende Bridge samt Generation (6.9),
// die Zoom-Slots (Slot-Spec 7.1, ab Connect 0.4.0) und Meldung. Er fasst kein Electron an und liest
// Einstellungen nur über `einstellungen` (Slot-Spec 7.10).
//
// GEHEIMNISSE (Spec 5.7, 8.7): Meeting-Nummer und Kenncode leben nur in `nummer`/`kenncode`
// und gehen nur in den join-Befehl. Jede stderr-Zeile der Bridge läuft durch `maskiere`.
// Client-ID/Secret gehen nur in buildJwt, nie an den Kindprozess (envRemove).
//
// WIEDERBEITRITT (Spec 6.4): Ein vorübergehender Abriss im Meeting startet bis zu fünf Versuche nach
// WIEDERBEITRITT_PLAN_S, jeder mit einer neuen Bridge; der Zustand bleibt die ganze Folge über `abriss`.
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path';
import {
  Bridge,
  buildJwt,
  normalizeMeetingId,
  readCredentials,
  type BridgeEvent,
  type BridgeOptions,
  type Command,
  type MeetingStatusName,
  type Session,
} from '@jm/zoom-bridge';
import type {
  AudioState, Participant, SlotAudioReason, SlotAudioSource, SlotMode, SlotReason, SlotSent, SlotState, SpeakerSignal,
} from '@jm/zoom-bridge/protocol';
import { AUDIO_ABO_FEHLER, SLOT_NR_MAX, sdkErrorName, type SlotFehler } from '@jm/zoom-bridge/protocol';
import { SDK_FASSUNG, SDK_FASSUNG_BRIDGE } from '@jm/zoom-bridge/sdk';
import type {
  ProxyKeySource,
  TonQuelle,
  ZoomAbbild,
  ZoomBefehlErgebnis,
  ZoomBefehlKennung,
  ZoomErgebnis,
  ZoomErlaubnis,
  ZoomKurz,
  ZoomLetztesMeeting,
  ZoomMangel,
  ZoomMesswerte,
  ZoomParticipant,
  ZoomSlotEinstellung,
  ZoomSlotLage,
  ZoomSlotVorgaben,
  ZoomSlotZustand,
  ZoomSprecherEinstellung,
  ZoomZustand,
} from '../../shared/types';
import {
  BETRIEBSGROESSE,
  dezimal,
  EINSTELLUNG_TEXT,
  kachelFehlerZeile,
  kachelZeile,
  KANDIDAT_KENNZEICHEN,
  kanaeleText,
  khzText,
  MESS_TEXT,
  nachfrageText,
  r5Text,
  SLOT_TEXT,
  slotMessZeile,
  slotTonZeile,
  stateKvAus,
  TEXT_A4_SCHREIBFEHLER,
  TEXT_SDK_SCHLUESSEL_NUR_SITZUNG_ENTFERNT,
  TEXT_VERGESSEN_FEHLER,
  TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT,
  UNBEKANNT,
  WIEDERBEITRITT_VERSUCHE,
  ZOOM_STATE_ZUSTANDSWORT,
  zoomZ,
  type ZoomStateKv,
  type ZoomZ,
} from '../../shared/zoom-text';
// T57 steht mit den übrigen Vorschau-Texten im reinen Modul der Kachel (Plan B, Task B7); der Kern braucht ihn für „Hinweise“.
import { VORSCHAU_TEXT } from '../../renderer/src/zoom/slot-vorschau';
import {
  KT,
  SLOT_FEHLER_TEXT,
  VORSATZ,
  audioBufferMismatchText,
  authMeldung,
  dllMeldung,
  endeMeldung,
  exitCodeAus,
  failMeldung,
  failText,
  fehlerDetail,
  fernLogText,
  FT,
  istEndgueltig,
  mangelText,
  maskiere,
  maskiereNamen,
  spawnMeldung,
  tonAboFehlerText,
  type Meldungstext,
  type VersuchsAusgang,
} from './klartext';
import {
  BRIDGE_EXE,
  kindPfad,
  pfadVarianten,
  PLATZ_RESERVE_BYTES,
  pruefeLaufzeit,
  pruefeSdkOrdner,
  richteEin,
  type EinrichtungsErgebnis,
  type KopieStand,
  type LaufzeitPfade,
  type LaufzeitPruefung,
  type SdkWahl,
} from './laufzeit';
import { fehlerCode, LADE_ORDNER, ladeFehlerText, SDK_LADEN_DIENSTE, type LadeFehler, type SdkLadenDienste } from './sdk-laden';
import { SDK_PAKET } from './sdk-paket';
import { deuteZoomBefehl, ladeZiel, type SlotSchalter } from './fernsteuerung';
import {
  gueltigeLetzteNummer, istSlotAufloesung, istSprecherSignal, neuerSlot, pruefeHaltezeit, pruefeNdiName, slotsFuerPlatte, uebergangsNdiName,
} from './einstellungen';
import {
  ERSATZBILD_ZU_BRIDGE,
  istOffen,
  MODUS_ZU_BRIDGE,
  planeSlotAbgleich,
  SIGNAL_ZU_BRIDGE,
  SITZUNG_LEER,
  sitzungNach,
  slotEndetMitMeeting,
  slotZustand,
  teilnehmerZiel,
  tonEingeschaltet,
  tonFuerBridge,
  zaehleSlots,
  ueber5Nach,
  zeigteSchonNachLive,
  type AbgleichEingabe,
  type SitzungsEreignis,
  type SlotSitzung,
  type ZielErgebnis,
} from './slots';
import { baueTeilnehmer, normName } from './teilnehmer';
import { WIEDERBEITRITT_PLAN_S } from './fristen';

// Feste Werte (Spec 5.2) stehen ab 4b in fristen.ts (rein). kern.ts reicht sie unverändert weiter, damit zoom.ts,
// index.ts, settings.ts und die Tests weiter von hier importieren.
import { HINWEISE_MAX, JWT_GUELTIG_S, ZOOM_FRISTEN, type ZoomFristen } from './fristen';
export {
  ANZEIGENAME_VORGABE, AUFLOESUNG, BEENDEN_FRIST_MS, BETRIEBSGROESSE, HINWEISE_MAX, JWT_GUELTIG_S, WIEDERBEITRITT_PLAN_S, ZOOM_FRISTEN,
} from './fristen';
export type { ZoomFristen } from './fristen';

export type BridgeArt = Pick<Bridge, 'start' | 'send' | 'stop' | 'session'>;
export type BridgeFabrik = (opts: BridgeOptions, startNr: number) => BridgeArt;
export interface ZugangDaten { clientId: string; clientSecret: string }
export interface ZugangStand { daten: ZugangDaten | null; herkunft: ProxyKeySource; grund?: 'schreibfehler'; unlesbar: boolean }
/** SDK-Schlüssel für „Zoom-SDK laden“ (Spec SDK nachladen 4.2). Der Wert bleibt im Main, das Abbild trägt nur die Herkunft. */
export interface SdkSchluesselStand { wert: string | null; herkunft: ProxyKeySource }
export interface LaufzeitDienste {
  pruefe(p: LaufzeitPfade): LaufzeitPruefung;
  pruefeOrdner(gewaehlt: string, ressourcen: string): SdkWahl;
  richteEin(e: Parameters<typeof richteEin>[0]): Promise<EinrichtungsErgebnis>;
}
export interface ZoomKernAbhaengigkeiten {
  pfade: LaufzeitPfade;
  /** loeschen(): für diese Sitzung immer weg; `false` = steht noch in der Einstellungsdatei (nicht schreibbar). */
  zugang: { lesen(): ZugangStand; speichern(d: ZugangDaten): 'stored' | 'session'; loeschen(): boolean };
  /** Umgebung JMPS_ZOOM_SDK_KEY > gespeichert (safeStorage) > Sitzung; speichern() bekommt den getrimmten Wert. loeschen() wie bei zugang. */
  sdkSchluessel: { lesen(): SdkSchluesselStand; speichern(wert: string): 'stored' | 'session'; loeschen(): boolean };
  einstellungen: {
    anzeigename(): string;
    setzeAnzeigename(n: string): void;
    versatzMs(): number;
    /** true = in der Einstellungsdatei gespeichert; false = gilt nur für diese Sitzung (Datei nicht schreibbar, L14). */
    setzeVersatzMs(ms: number): boolean;
    /** Der geltende Versatz steht nur im Arbeitsspeicher (N4b.3 Nr. 4). */
    versatzNurSitzung(): boolean;
    setzeLaufzeit(v: { dir: string; fassung: string; eingerichtetAm: string }): void;
    /**
     * Letztes Meeting (#290): bleibt über „Schließen“ und Neustart; der Kenncode nur verschlüsselt (`null` = keiner/nicht lesbar).
     * Ein Wurf hier oder in meetingMerken blockiert den Kern nie (zählt als nichts gemerkt bzw. nicht gespeichert).
     */
    letztesMeeting(): { nummer: string; kenncode: string | null } | null;
    /** `kenncodeGespeichert` false = Kenncode nicht auf der Platte (keine Verschlüsselung, Verschlüsselungs- oder Schreibfehler). */
    meetingMerken(nummer: string, kenncode: string): { kenncodeGespeichert: boolean };
    /** Wie zugang.loeschen(): `false` = steht noch in der Einstellungsdatei (nicht schreibbar). */
    meetingVergessen(): boolean;
    // Zoom-Slots (Slot-Spec 7.2, 7.10; Plan B, Task B12). Jedes setze…() liefert true = gespeichert, false = gilt nur für diese
    // Sitzung (T92). Der Kern übergibt setzeSlots nur dauerhafte Slots, `anNurMeeting` als `an: false` (slotsFuerPlatte).
    slots(): ZoomSlotEinstellung[];
    setzeSlots(s: readonly ZoomSlotEinstellung[]): boolean;
    vorgaben(): ZoomSlotVorgaben;
    setzeVorgaben(v: ZoomSlotVorgaben): boolean;
    sprecher(): ZoomSprecherEinstellung;
    setzeSprecher(s: ZoomSprecherEinstellung): boolean;
    vorschau(): boolean;
    setzeVorschau(an: boolean): boolean;
    ueber5(): boolean;
    setzeUeber5(an: boolean): boolean;
    /**
     * T90 (Sicherungskopie einer unlesbaren Datei), T91 (verworfene Slots) und T92 (`nurSitzung`: ein Slot-Feld gilt nur für
     * diese Sitzung, weil sein letztes Schreiben scheiterte; Nachtrag B, NB9). Fehlt `nurSitzung`, gilt false.
     */
    einstellungsLage(): { gesichert: string | null; verworfen: number; nurSitzung?: boolean };
  };
  gastLabels(): string[];
  /** Fertige Zeile mit Präfix, schon maskiert. */
  log(zeile: string): void;
  /** Gedrosselt (höchstens alle `abbildTaktMs`, der letzte Stand kommt immer an). */
  onAbbild(a: ZoomAbbild): void;
  /** Sofort, sobald sich die Kurzform ändert. */
  onKurz?(k: ZoomKurz): void;
  /** Vorgabe: (o) => new Bridge(o). */
  bridgeFabrik?: BridgeFabrik;
  /** Vorgabe: die echten Funktionen aus laufzeit.ts. */
  laufzeit?: Partial<LaufzeitDienste>;
  /** Adresse des Release-Proxys für „Zoom-SDK laden“ (settings.proxyUrl()). Ein Proxy-Schlüssel wird nicht gebraucht. */
  proxyUrl(): string;
  /** Vorgabe: die echten Funktionen aus sdk-laden.ts. */
  sdkLaden?: Partial<SdkLadenDienste>;
  /** Vorgabe: process.env. */
  env?: Record<string, string | undefined>;
  fristen?: Partial<ZoomFristen>;
  /** Wartezeit vor Versuch 1–5 in ms (Spec 6.4, 12.2). Vorgabe WIEDERBEITRITT_PLAN_S × 1000; Länge = WIEDERBEITRITT_VERSUCHE. */
  wiederbeitrittPlanMs?: readonly number[];
  /** Vorschaubild eines Slots (Slot-Spec 7.7): direkt an das Fenster, nie ins Abbild, nie ins Log; nur des aktuellen Ziels. */
  onVorschau?(bild: { nr: number; ziel: number; w: number; h: number; jpeg: string }): void;
  /** Startwert: Hauptfenster sichtbar und nicht minimiert (7.7, B-EP8); Vorgabe false. */
  fensterSichtbar?: boolean;
}
export interface ZoomKern {
  abbild(): ZoomAbbild;
  kurz(): ZoomKurz;
  stateKv(): ZoomStateKv | null;
  laeuft(): boolean;
  einrichtungSperre(): ZoomErgebnis;
  sdkWaehlen(ordner: string): Promise<ZoomErgebnis>;
  /** „Zoom-SDK laden“ (Spec SDK nachladen 4.3): Link, Download, Prüfung, Entpacken, dann dieselbe Strecke wie sdkWaehlen. */
  sdkLaden(): Promise<ZoomErgebnis>;
  /** Bricht ein laufendes Laden ab (Phasen link bis entpacken); während der Kopie wirkungslos. */
  sdkLadenAbbrechen(): void;
  zugangWaehlen(datei: string): ZoomErgebnis;
  zugangEintragen(e: { clientId: string; clientSecret: string }): ZoomErgebnis;
  zugangLoeschen(): ZoomErgebnis;
  sdkSchluesselEintragen(e: { schluessel: string }): ZoomErgebnis;
  sdkSchluesselLoeschen(): ZoomErgebnis;
  versatz(e: { ms: number }): ZoomErgebnis;
  pruefen(): Promise<ZoomErgebnis>;
  beitreten(e: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis>;
  erneut(): Promise<ZoomErgebnis>;
  /** Das gemerkte Meeting (#290): nur die Nummer, der Kenncode verlässt den Main nie. */
  letztesMeeting(): ZoomLetztesMeeting;
  /**
   * Gemerktes Meeting vergessen (#290); ein laufendes Meeting und „Erneut beitreten“ bleiben unberührt. Die Speicherkopie ist
   * danach immer leer; `ok: false` (TEXT_VERGESSEN_FEHLER), wenn die Daten noch auf der Platte stehen.
   */
  vergessen(): ZoomErgebnis;
  verlassen(): Promise<void>;
  /**
   * Spec 6.8 „Abbrechen“, nur Z11 (Folge wartet oder läuft): Zeitgeber löschen, Versuchs-Bridge stop(), Zustand
   * fehler mit R7, erneutMoeglich true; Slots, Nummer und Kenncode bleiben. Sonst wirkungslos.
   */
  abbrechen(): void;
  // ── Zoom-Slots (Slot-Spec 7.1, 7.3; Plan B, Task B12) ──
  /** Neuer Slot mit der kleinsten freien Nummer (Vorgaben 7.6); bei 16 Slots T32. */
  slotAnlegen(): ZoomErgebnis & { nr?: number };
  /** Ändert Felder eines Slots und speichert sofort; der NDI-Name nur bei ausgeschaltetem Slot (T35) und nach E26 (T43–T47). */
  slotAendern(nr: number, aenderung: Partial<Omit<ZoomSlotEinstellung, 'nr' | 'an'>>): ZoomErgebnis;
  /** Löscht einen ausgeschalteten Slot (sonst T36); die Nummer wird frei. */
  slotLoeschen(nr: number): ZoomErgebnis;
  /**
   * Start-Taste setzen (speichert, hebt `anNurMeeting` auf); der Abgleich startet bzw. stoppt sofort. Wären danach mehr als
   * BETRIEBSGROESSE Slots eingeschaltet und fehlt die Zustimmung: Nachfrage T40, nichts geändert; `trotz` setzt sie (7.4).
   */
  slotStart(nr: number, an: boolean, trotz?: boolean): ZoomErgebnis | { ok: false; nachfrage: true; text: string };
  /** „Als Slot laden“ (E13): dauerhafter Teilnehmer-Slot für diese Person nach der Übergangs-Namensregel, eingeschaltet; Nachfrage wie slotStart. */
  slotAusPerson(teilnehmerId: number, trotz?: boolean): ZoomErgebnis | { ok: false; nachfrage: true; text: string };
  /** Handwahl bei Doppelname oder Zweifel (7.3 Nr. 5): Der Slot zeigt diese Kennung. */
  slotPersonWaehlen(nr: number, teilnehmerId: number): ZoomErgebnis;
  /** „Behalten“ (7.2): macht einen vorübergehenden Slot dauerhaft bzw. das Einschalten mit `anNurMeeting` zur gespeicherten Start-Taste. */
  slotBehalten(nr: number): ZoomErgebnis;
  /** Vorgaben für neue Slots (7.6): Auflösung und Ton; gespeichert. */
  vorgabenSetzen(v: ZoomSlotVorgaben): ZoomErgebnis;
  /** Sprecher-Einstellungen (7.6): Signal und Haltezeit (T74 bei ungültiger Haltezeit); gespeichert, `speakerConfig` an die Bridge. */
  sprecherSetzen(s: ZoomSprecherEinstellung): ZoomErgebnis;
  /** Schalter „Vorschau“ (7.7): gespeichert; `previewMode {on: Schalter und Fenster sichtbar}` an die Bridge. */
  vorschauSetzen(an: boolean): ZoomErgebnis;
  /** Hauptfenster sichtbar und nicht minimiert (hide, show, minimize, restore; 7.7); ändert `previewMode`. */
  fensterSichtbar(sichtbar: boolean): void;
  /** „Messwerte kopieren“ (7.8): T61–T69 ohne Teilnehmer- und NDI-Namen, Slots als „Slot {nr} ({Modus})“ (0.23). */
  messwerteText(): string;
  schliessen(): void;
  meldungWeg(): void;
  gastLabelsGeaendert(): void;
  /** Spec 11.2: Fernsteuer-Verb (verb klein, args wie vom Parser). Setzt kurz().befehl; ruft nie den Renderer. */
  steuerbefehl(cmd: { verb: string; args: string[] }): void;
  beenden(fristMs: number): Promise<void>;
}

type FehlerEreignis = {
  ev: 'error'; where: string; code: number | string; id?: number; slot?: number; dropped?: number; detail?: string; name?: string;
  /** `slotSubscribeFailed`: SDKError-Zahl der Ablehnung (6.4, 6.10 Schritt 5); ihr Name steht in T20c. */
  sdk?: number;
};

/**
 * Aufbaufehler eines slotOn (7.3 Nr. 2): ohne Sender Fehlerstand `gescheitert` (SZ8, T23). Die übrigen Schlüssel mit Text
 * (`slotBad…` an einem laufenden Slot, `slotBufferMismatch`) setzen keinen Fehlerstand.
 */
const AUFBAU_FEHLER: ReadonlySet<string> = new Set<SlotFehler>([
  'slotRawRecordingFailed', 'slotSenderFailed', 'slotRendererFailed', 'slotNameTaken', 'slotBadName', 'slotBadMode',
  'slotBadResolution', 'slotBadAudio', 'slotBadFallback', 'slotBadFlag', 'slotBadTarget',
]);
/**
 * Nachtrag B (I-2): Antworten der Bridge auf ein slotOn, die keinen Sender anlegen (6.2, Zeile slotOn): die Aufbaufehler,
 * `slotNoPrivilege` und `slotReconnecting`. Jedes slotOn bekommt genau eine Antwort: einen Sender oder einen Fehler mit dieser Nummer.
 */
const SLOTON_ABLEHNUNG: ReadonlySet<string> = new Set<string>([...AUFBAU_FEHLER, 'slotNoPrivilege', 'slotReconnecting']);
const istSlotFehler = (code: string): code is SlotFehler => Object.prototype.hasOwnProperty.call(SLOT_FEHLER_TEXT, code);
/** So viele Sprecher-Signale hält das Abbild (7.8, T65). */
const SPRECHER_SIGNALE_MAX = 20;
/** Ein Ereignis ohne `ev`, wie es die Messwerte halten (Gemeldet<…>, 7.8). */
function ohneEv(ev: BridgeEvent): Record<string, unknown> {
  return Object.fromEntries(Object.entries(ev).filter(([k]) => k !== 'ev'));
}
type StatusEreignis = { ev: 'status'; status: MeetingStatusName; code: number };
type PrivilegEreignis = { ev: 'privilege'; canRecordRaw: boolean; source: 'broadcast' | 'requestAnswer' | 'check'; requested?: boolean; denied?: boolean; timedOut?: boolean };
/** `ndi`: NDI-Name des Senders, wie ihn die Bridge führt (6.3); Connect vergleicht ihn mit dem des Slots (Nachtrag B, I-3). */
type SlotEreignis = {
  ev: 'slot'; slot: number; state: SlotState; mode: SlotMode; target: number; share: number; reason: SlotReason; sent: SlotSent; ndi: string;
};
type SlotTonEreignis = {
  ev: 'slotAudio'; slot: number; state: AudioState; source: SlotAudioSource; configured: SlotAudioSource; reason: SlotAudioReason;
  sampleRate?: number; channels?: number;
};
/**
 * Ein Slot im Kern (Slot-Spec 7.1, ersetzt Quellen, Soll-Liste, Ton-Vorwahl, Abo-Fristen und Zeilenfehler). `bridge` ist der
 * Sender samt der Generation der Bridge, die ihn meldet (6.9; null ohne Sender). `s` gilt nur für diese Sitzung (7.3).
 */
interface SlotIntern {
  e: ZoomSlotEinstellung;
  voruebergehend: boolean;
  anNurMeeting: boolean;
  s: SlotSitzung;
  bridge: { gen: number; state: SlotState; mode: SlotMode; target: number; share: number; reason: SlotReason; sent: SlotSent } | null;
  /** `slotOff` gesendet, das `slot off` der Bridge steht aus (SZ9). */
  slotOffGesendet: boolean;
  /** Antwortfrist des gesendeten `slotOn` (10 s, 7.3 Nr. 2). */
  frist: ReturnType<typeof setTimeout> | null;
  /** Letztes `slotAudio` dieses Slots (bleibt auch bei `off`, A-EP6); null ohne Sender. */
  ton: { state: AudioState; reason: SlotAudioReason; source: SlotAudioSource; configured: SlotAudioSource; rate: number | null; kanaele: number | null } | null;
  /** Klartext der Fehlerzeile (10.9), Klartext für T23 (SZ8) und Fehlername für T20c; gesetzt ab Plan B, Task B14. */
  fehler: string | null;
  gescheitertText: string | null;
  aboFehlerName: string | null;
  /** Vor `zoom_slot_audio OFF` gemerkter Stand von Ton und Computerton (8.3); nie gespeichert. */
  tonGemerkt: { tonAn: boolean; computerton: boolean } | null;
  /** `zoom_unload` (7.2): Der vorübergehende Slot verschwindet, sobald kein Sender und keine Antwortfrist mehr besteht. */
  loeschen: boolean;
  /**
   * Messzeile (10.7): `geliefert` aus dem laufenden Fenster dieses Ziels (slotStats), `zuletzt` die letzte Größe dieses Ziels.
   * Fällt mit dem Sender und mit jedem `slot`-Ereignis, das Ziel, Freigabe oder Modus ändert (B55).
   */
  mess: { geliefert: { b: number; h: number; fps: number } | null; zuletzt: { b: number; h: number } | null } | null;
  /** Log 7.8 (B66): letzte Art `state/reason`, wann jede Art zuletzt geschrieben wurde, letzte Minutenzeile. */
  log: { art: string; zeiten: Map<string, number>; minute: number };
  /** persistentId der gezeigten Person beim Weggang ('' ohne) und der Vergleich bei ihrer Rückkehr (T62c, MS16). */
  wegPersistentId: string | null;
  rueckkehr: 'gleich' | 'verschieden' | 'fehlt' | null;
  /**
   * Nachtrag B (I-1, I-2): die Einstellungen, aus denen jedes gesendete und noch unbeantwortete `slotOn` gebaut wurde, älteste
   * zuerst (die Bridge beantwortet sie der Reihe nach: mit einem Sender oder einem Fehler mit dieser Nummer). Solange eins offen
   * ist, kann die Bridge noch einen Sender bauen; „Stopp“ und das Ende der Antwortfrist ändern daran nichts.
   */
  slotOnOffen: ZoomSlotEinstellung[];
  /** I-1: Die Einstellung, die die Bridge für den laufenden Sender zuletzt bekam (`slotOn` oder `slotSet`); null ohne Sender. */
  gesendet: ZoomSlotEinstellung | null;
}
type VorschauEreignis = { ev: 'preview'; slot: number; target: number; w: number; h: number; jpeg: string };
/** Log 7.8: eine Zustandsart je Slot höchstens einmal je 2 s (B66), Messwerte je Minute, Sprecher-Signale je Sekunde gebündelt. */
const LOG_ART_MS = 2000;
const LOG_MINUTE_MS = 60_000;
const LOG_SPRECHER_MS = 1000;
/** `ausgang` ordnet einen Fehler der Startfolge für den Wiederbeitritt ein (6.4); null bei Mangel oder Abbruch. */
type StartErgebnis =
  | { ok: true; bridge: BridgeArt; gen: number }
  | { ok: false; meldung: Meldungstext; mangel: ZoomMangel | null; ausgang: VersuchsAusgang | null };
type StartAusgang = { ok: true } | { ok: false; meldung: Meldungstext; ausgang: VersuchsAusgang | null };
interface StartBeobachter { gen: number; erledigt: boolean; ende(e: StartAusgang): void }

const GEHEIM = ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS', 'JMPS_ZOOM_SDK_KEY', 'JMPS_PROXY_KEY'];

const ABGEBROCHEN: Meldungstext = { text: '', detail: null };
const MIB = 1024 * 1024;
/** Phase und Bytes von „Zoom-SDK laden“ im Abbild (Spec SDK nachladen 4.4). */
type LadenStand = NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>;

function zeitgeber(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
  const t = setTimeout(fn, ms);
  t.unref?.();
  return t;
}

/** Kurzbeschreibung eines Ereignisses fürs Log — nie mit Nummer, Kenncode oder JWT (die stehen in keinem Ereignis). */
function beschreibe(ev: BridgeEvent): string {
  const e = ev as unknown as Record<string, unknown>;
  switch (ev.ev) {
    case 'status':
      return `status ${String(e.status)} (Code ${String(e.code)})`;
    // Slot-Spec 7.10, 0.23: Slot-Nummer, Zustand und Grund, nie der NDI-Name (`ndi`) und nie ein Teilnehmername.
    case 'slot':
    case 'slotAudio':
      return `${ev.ev} ${String(e.slot)} ${String(e.state)} (${String(e.reason)})`;
    case 'privilege':
      return `privilege canRecordRaw=${String(e.canRecordRaw)} source=${String(e.source)}`;
    default:
      return ev.ev;
  }
}

/** Die Zeilen Z6–Z9b: nur dort zeigt ein Slot laut STATE Bild (Slot-Spec 8.2, 10.4; Restrunde RR5). */
const Z_IM_MEETING: ReadonlySet<ZoomZ> = new Set<ZoomZ>(['Z6', 'Z7', 'Z7b', 'Z8', 'Z9', 'Z9b']);

/**
 * Was ein Slot laut Einstellung sendet, solange die Bridge noch kein `configured` gemeldet hat (Tonweg 6.10 Schritt 8 aus der
 * Ton-Abbildung 7.1): Teilnehmer Mischton bzw. Person, Sprecher nur Mischton, Freigabe Mischton und/oder Computerton.
 */
function tonWegEingestellt(e: ZoomSlotEinstellung): TonQuelle {
  const { audio, shareAudio } = tonFuerBridge(e);
  if (e.modus === 'teilnehmer') return audio === 'off' ? 'none' : audio;
  if (e.modus === 'sprecher') return audio === 'mix' ? 'mix' : 'none';
  if (audio === 'mix') return shareAudio ? 'mixShare' : 'mix';
  return shareAudio ? 'share' : 'none';
}

export function erzeugeZoomKern(d: ZoomKernAbhaengigkeiten): ZoomKern {
  const f: ZoomFristen = { ...ZOOM_FRISTEN, ...d.fristen };
  const lz: LaufzeitDienste = { pruefe: pruefeLaufzeit, pruefeOrdner: pruefeSdkOrdner, richteEin, ...d.laufzeit };
  const ld: SdkLadenDienste = { ...SDK_LADEN_DIENSTE, ...d.sdkLaden };
  const fabrik: BridgeFabrik = d.bridgeFabrik ?? ((o) => new Bridge(o));
  const env = d.env ?? process.env;
  const plan: readonly number[] = d.wiederbeitrittPlanMs ?? WIEDERBEITRITT_PLAN_S.map((s) => s * 1000);

  // ── Zustand ──────────────────────────────────────────────────────────────
  let zustand: ZoomZustand = 'bereit';
  /** Nur in `warteraum` gesetzt (Spec 6.2 Schritt 5). */
  let warten: 'warteraum' | 'host' | null = null;
  /** Gilt nur in `im_meeting` (Spec 6.2 Schritt 6). */
  let erlaubnis: ZoomErlaubnis = 'offen';
  let maengel: ZoomMangel[] = [];
  let laufzeitStand: LaufzeitPruefung = lz.pruefe(d.pfade);
  let zugang: ZugangStand = { daten: null, herkunft: 'none', unlesbar: false };
  let zugangFehler: string | null = null;
  /** Nur die Herkunft; den Wert liest erst das Laden (Spec SDK nachladen 4.2). */
  let sdkSchluesselHerkunft: ProxyKeySource = d.sdkSchluessel.lesen().herkunft;
  let sdkFehler: string | null = null;
  let kopie: KopieStand | null = null;
  let kopieAbbruch: AbortController | null = null;
  /** Das laufende richteEin; beenden wartet darauf, damit `.teil` gelöscht ist (Spec 6.1, 6.6). */
  let kopieLauf: Promise<EinrichtungsErgebnis> | null = null;
  /** „Zoom-SDK laden“: Phase und Bytes bis zum Ende des Entpackens, danach null (die Kopie zeigt `kopie`). */
  let ladung: LadenStand | null = null;
  /** Bricht die Phasen link bis entpacken ab; danach null (Spec SDK nachladen 4.3 „Abbrechen“). */
  let ladeAbbruch: AbortController | null = null;
  /** Das ganze Laden samt Kopie und Aufräumen; Sperre, laeuft() und beenden hängen daran (L24-Muster). */
  let ladeLauf: Promise<ZoomErgebnis> | null = null;
  let pruefungLaeuft = false;
  let meldung: ZoomAbbild['meldung'] = null;
  const hinweise: string[] = [];
  /** Ergebnis des letzten zoom_*-Befehls (11.2, zoom_cmd); null vor dem ersten. */
  let befehl: ZoomBefehlErgebnis | null = null;
  /** Nur im Arbeitsspeicher (Spec 5.7). */
  let nummer: { eingabe: string; normiert: string } | null = null;
  let kenncode: string | null = null;
  // Das gemerkte Meeting (#290): einmal beim Erzeugen gelesen, danach vom Kern selbst geführt; unabhängig von nummer/kenncode.
  // Wirft das Lesen, gilt „nichts gemerkt“: Das Gemerkte ist eine Bequemlichkeit und darf den Kern nie verhindern.
  let gemerkt: { nummer: string; kenncode: string | null } | null = null;
  try {
    gemerkt = d.einstellungen.letztesMeeting();
  } catch {
    gemerkt = null;
  }
  let kenncodeNichtGespeichert = false;
  /**
   * Wiederbeitritts-Folge (6.4), nur in `abriss`: gesetzt heißt Z11. `naechsterUm` nur in der Wartezeit vor einem
   * Versuch, `letzte` = Meldung des letzten gescheiterten Versuchs (R2; bis dahin der Anlass des Abrisses, beide stehen zusätzlich im Log), `beginn` = Start des laufenden Versuchs.
   * Den früheren Merker „war im Meeting“ (Ergänzung 0.10) tragen die Zustände: Auslöser gelten nur in im_meeting/abriss (L6).
   */
  let folge: { versuch: number; naechsterUm: number | null; zeitgeber: ReturnType<typeof setTimeout> | null; letzte: Meldungstext | null; beginn: number } | null = null;
  /** R5 steht aus: gesetzt beim Erfolg eines Versuchs, verbraucht vom ersten Abgleich mit Erlaubnis 'ja' (L3). */
  let r5Offen = false;
  /** Alle angelegten Slots nach Nummer (Slot-Spec 7.1, E1): dauerhafte aus den Einstellungen, vorübergehende nur hier (7.2). */
  const slots = new Map<number, SlotIntern>();
  /**
   * Verdeckt reservierte Nummern (Nachtrag B, I-2 bis I-5; Ruling R11): Die Bridge hält oder baut unter dieser Nummer einen
   * Sender, der zu keinem Connect-Slot gehört (der Slot wurde gelöscht, während sein slotOn unbeantwortet war, die Nummer kennt
   * Connect nicht, oder der Sender trägt einen anderen NDI-Namen). slotAnlegen, freieNummer und zoom_load überspringen sie, ein
   * Slot mit dieser Nummer startet nicht. Sie fällt mit `slot off` oder `slotNotOn` dieser Nummer und mit dem Ende von `gen`.
   * `slotOff`: schon gesendet (einmal je Sender). Kein Spiegel von Session.slots: Hier steht nur, was keinem Slot gehört.
   */
  const reserviert = new Map<number, { gen: number; slotOff: boolean }>();
  /** Die Logzeile zu T92 steht schon (einmal, bis settings.ts wieder alles gespeichert meldet); T92 selbst leitet abbild() ab (NB9). */
  let nurSitzungGeloggt = false;
  /** Beitrittsfolge je Teilnehmer dieser Sitzung (7.3 Nr. 5): Einträge aus `roster` 0, jedes `joined` die nächste Zahl. */
  const folgeJe = new Map<number, number>();
  let folgeZaehler = 0;
  /**
   * Ton-Abo-Fehler (7.1, Nachfix W6): Name des Merkers (T104 an jeder Kachel mit Ton), null ohne. `letzterTonAboFehler` bleibt
   * für Slots, deren eigener Ton auf `off/audioUnavailable` steht.
   */
  let tonAboFehler: string | null = null;
  let letzterTonAboFehler: string | null = null;
  // ── Vorschau, Messwerte und Log (Slot-Spec 7.7, 7.8; Plan B, Task B16) ──
  let fenster = d.fensterSichtbar ?? false;
  let vorschauVerfuegbar = true;
  /** {detail} von T57 an der Kachel: HRESULT des letzten previewUnavailable (6.4), null solange die Vorschau verfügbar ist. */
  let vorschauDetail: string | null = null;
  /** Log: letzte Prozesszeile, gesammelte Sprecher-Signale samt Zeitgeber, zuletzt geloggter Freigabe-Rückruf (Bridge-Uhr). */
  let bridgeLogZeit = 0;
  let sprecherLogZeit = 0;
  let sprecherGesammelt: string[] = [];
  let sprecherLogTimer: ReturnType<typeof setTimeout> | null = null;
  let rueckrufBis = -1;
  /** persistentId je Kennung aus roster und joined, nur im Arbeitsspeicher (T62c, MS16). */
  const persistentIds = new Map<number, string>();
  /** Lücken beim Sprecher-Wechsel (gapMs der Sprecher-Slots, je neuer Wert), die letzten 20 (T66). */
  let luecken: Array<{ ms: number; ungeprueft: boolean }> = [];
  const letzteLueckeJe = new Map<number, number>();
  /**
   * T67 (7.8, MS13): Zeitpunkte (Uhr von Connect), zu denen ein Sprecher-Slot eine andere Person zeigte als zuletzt, die letzten 20;
   * mehrere Sprecher-Slots mit derselben Person zählen einmal. Gilt je Bridge (die Kennungen gelten nur dort).
   */
  let sprecherWechsel: number[] = [];
  let letzterSprecher = 0;
  /** T65, T63c: Uhrzeit des Empfangs je Sprecher-Signal (gleich lang wie messwerte.sprecherSignale) und je Freigabe-Rückruf. */
  let sprecherZeiten: number[] = [];
  const rueckrufZeiten = new Map<number, number>();
  let beendenVersprechen: Promise<void> | null = null;

  // ── Bridge-Lebenslauf (Spec 5.2, 6.9) ────────────────────────────────────
  let aktiveBridge: BridgeArt | null = null;
  let aktiveGen = 0;
  const imAbbau = new Set<number>();
  const stopps = new Map<number, Promise<void>>();
  /** Generationen, deren start() gescheitert ist: es lief nie ein Prozess, stop() liefert nur 0. */
  const ohneProzess = new Set<number>();
  let startNr = 0;
  /** Jeder Abbruch (Verlassen, Beenden) zählt hoch; eine ältere Startfolge verwirft ihr Ergebnis. */
  let laufNr = 0;
  let jwt: string | null = null;
  let startBeob: StartBeobachter | null = null;

  /** L11: Anzeigenamen fremder Teilnehmer, die der Kern in dieser Programmsitzung gesehen hat; nur im Arbeitsspeicher. */
  const gesehenNamen = new Set<string>();

  // ── Slot-Abgleich (Slot-Spec 7.3) ────────────────────────────────────────
  let abgleichTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Abbild und Drossel ───────────────────────────────────────────────────
  let letzterPush = 0;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let letzteKurz = '';

  function aktiveSitzung(): Session | null {
    return aktiveBridge !== null && !imAbbau.has(aktiveGen) ? aktiveBridge.session : null;
  }

  // ── Slots: Lage, Zahlen, Kurzform (Slot-Spec 7.1, 7.3, 10.1–10.4) ─────────
  /** Messwerte (7.8) so, wie die Bridge sie zuletzt gemeldet hat; gefüllt ab Plan B, Task B15/B16. */
  const messwerte: ZoomMesswerte = { bridge: null, slots: [], freigaben: null, sprecherSignale: [] };

  function neuerIntern(e: ZoomSlotEinstellung, voruebergehend = false): SlotIntern {
    return {
      e, voruebergehend, anNurMeeting: false, s: { ...SITZUNG_LEER }, bridge: null, slotOffGesendet: false, frist: null, ton: null,
      fehler: null, gescheitertText: null, aboFehlerName: null, tonGemerkt: null, loeschen: false, mess: null,
      log: { art: '', zeiten: new Map(), minute: 0 }, wegPersistentId: null, rueckkehr: null, slotOnOffen: [], gesendet: null,
    };
  }

  /** Fremde Teilnehmer der aktiven Sitzung (ohne eigene Zeile), auch im Warteraum. */
  function fremde(): Participant[] {
    const s = aktiveSitzung();
    return s ? [...s.participants.values()].filter((p) => !p.self) : [];
  }

  /** Anzeigename zu einer Kennung der aktiven Sitzung; nur für Texte und STATE, nie fürs Log (0.23). */
  function nameVon(id: number): string | null {
    return id !== 0 ? (aktiveSitzung()?.participants.get(id)?.name ?? null) : null;
  }

  /** Zustand eines Slots nach der Vorrangfolge 7.3. Ein Sender zählt, bis seine Bridge abgebaut ist (10.1, 7.3 Nr. 10). */
  function zustandVon(x: SlotIntern): ZoomSlotZustand {
    return slotZustand({
      an: x.e.an,
      senderAktiv: x.bridge !== null,
      slotOffGesendet: x.slotOffGesendet,
      bridgeImAbbau: x.bridge !== null && imAbbau.has(x.bridge.gen),
      bridgeState: x.bridge?.state ?? null,
      meeting: zustand,
      erlaubnis: zustand === 'im_meeting' ? erlaubnis : null,
      fehlerstand: x.s.fehlerstand,
      fristLaeuft: x.frist !== null,
    });
  }

  /** Teilnehmer für Abgleich und Anzeige, mit Beitrittsfolge (7.3 Nr. 5). */
  function abgleichTeilnehmer(): AbgleichEingabe['teilnehmer'] {
    return fremde().map((p) => ({ id: p.id, name: p.name, imWarteraum: p.inWaitingRoom, folge: folgeJe.get(p.id) ?? 0 }));
  }

  interface SlotRoh { x: SlotIntern; zustand: ZoomSlotZustand; ziel: ZielErgebnis | null; offen: boolean }

  /** Je Slot nach Nummer: Zustand (7.3), Teilnehmer-Ziel wie im Abgleich (7.3 Nr. 5) und Offenheit (10.1). */
  function slotRohLagen(): SlotRoh[] {
    const t = aktiveSitzung() !== null ? abgleichTeilnehmer() : null;
    return [...slots.values()].sort((a, b) => a.e.nr - b.e.nr).map((x) => {
      const z = zustandVon(x);
      const ziel = x.e.modus === 'teilnehmer' && t !== null ? teilnehmerZiel(x.e, x.s, t) : null;
      const offen = istOffen({
        zustand: z, liefSchon: x.s.liefSchon, doppelt: ziel?.doppelt ?? 1, zweifel: ziel?.zweifel ?? false,
        grund: x.bridge?.reason ?? null, modus: x.e.modus, zeigteSchon: x.s.zeigteSchon,
      });
      return { x, zustand: z, ziel, offen };
    });
  }

  /** Name der Person, die der Slot gerade zeigt (Ziel der Bridge; bei Freigabe die teilende Person), sonst null. */
  function gezeigtVon(x: SlotIntern): string | null {
    return x.bridge !== null ? nameVon(x.bridge.target) : null;
  }

  /** Kennzeichen eines Kandidaten der Doppelname-Auswahl (7.5, OFP3): Kamera aus, Host, im Warteraum. */
  function kandidatHinweis(id: number): string {
    const p = aktiveSitzung()?.participants.get(id);
    if (!p) return '';
    const teile: string[] = [];
    if (!p.videoOn) teile.push(KANDIDAT_KENNZEICHEN.kameraAus);
    if (p.role === 'host') teile.push(KANDIDAT_KENNZEICHEN.host);
    if (p.inWaitingRoom) teile.push(KANDIDAT_KENNZEICHEN.imWarteraum);
    return teile.join(', ');
  }

  /** T97: kleinste Nummer eines anderen Slots, dessen Sender dasselbe Ziel hat (nur mit Ziel). */
  function andererSlotVon(x: SlotIntern): number | null {
    const b = x.bridge;
    if (b === null || b.target === 0) return null;
    const andere = [...slots.values()]
      .filter((y) => y !== x && y.bridge !== null && y.bridge.target === b.target && y.bridge.share === b.share)
      .map((y) => y.e.nr);
    return andere.length ? Math.min(...andere) : null;
  }

  /** T28b (10.2 Regel 4): laufende Bild-Freigaben (ohne reine Ton-Freigaben, 6.9) aus dem letzten `shares`, mit Namen. */
  function bildFreigaben(): { zahl: number; namen: string[] } {
    const bild = (messwerte.freigaben?.list ?? []).filter((f) => !f.audioOnly);
    return { zahl: bild.length, namen: bild.map((f) => nameVon(f.user)).filter((n): n is string => n !== null) };
  }

  /**
   * T104 an dieser Kachel (7.1, 10.6; Nachfix W6): nur mit eingeschaltetem Ton, solange der Merker steht oder der eigene Ton
   * des Slots auf `off/audioUnavailable` steht (dann mit dem zuletzt gemeldeten Ton-Abo-Fehler).
   */
  function tonAboFehlerAn(x: SlotIntern): string | null {
    if (!tonEingeschaltet(x.e)) return null;
    if (tonAboFehler !== null) return tonAboFehlerText(tonAboFehler);
    if (x.ton?.state === 'off' && x.ton.reason === 'audioUnavailable' && letzterTonAboFehler !== null) return tonAboFehlerText(letzterTonAboFehler);
    return null;
  }

  /**
   * T76 (10.6 Regel 5): Meldet die Bridge für den Ton des Slots `rateMismatch` (Mischer-Slot, 6.10 Schritt 8), nennt die Kachel
   * beide Formate aus dem letzten slotStats des Slots: {r1} Mischton (`audioRate`, `audioCh`), {r2} Computerton
   * (`shareAudioRate`, `shareAudioCh`), je „{rate} kHz, {kanäle}“ wie in T58c; ein fehlender Wert heißt „unbekannt“ (Vorgabe OFP10).
   */
  function rateMismatchAn(x: SlotIntern): { r1: string; r2: string } | null {
    if (x.ton?.reason !== 'rateMismatch') return null;
    const m = messwerte.slots.find((s) => s.slot === x.e.nr);
    const format = (rate: number | undefined, ch: number | undefined): string =>
      (rate === undefined ? UNBEKANNT : `${khzText(rate / 1000)} kHz, ${ch === undefined ? UNBEKANNT : kanaeleText(ch)}`);
    return { r1: format(m?.audioRate, m?.audioCh), r2: format(m?.shareAudioRate, m?.shareAudioCh) };
  }

  /** Der einzige Konstruktor von ZoomSlotLage (Slot-Spec 7.10, KF1). `z` = Zeile der Kurzform (für die Zustandszeile). */
  function slotLage(r: SlotRoh, z: ZoomZ): ZoomSlotLage {
    const { x, zustand: zst, ziel } = r;
    const e = x.e;
    const person = x.s.personJetzt ?? e.person;
    const gezeigt = gezeigtVon(x);
    const doppelt = ziel?.doppelt ?? 1;
    const zweifel = ziel?.zweifel ?? false;
    const imWarteraum = ziel?.imWarteraum ?? false;
    const andererSlot = andererSlotVon(x);
    const grund = x.bridge?.reason ?? null;
    const gesendet = x.bridge?.sent ?? null;
    const tonQuelle: TonQuelle = x.ton?.source ?? 'none';
    const tonEingestellt: TonQuelle = x.ton?.configured ?? tonWegEingestellt(e);
    const lageErlaubnis = zustand === 'im_meeting' ? erlaubnis : null;
    return {
      einstellung: { ...e },
      voruebergehend: x.voruebergehend,
      anNurMeeting: x.anNurMeeting,
      zustand: zst,
      grund,
      gesendet,
      zielName: gezeigt ?? (e.modus === 'teilnehmer' && person !== '' ? person : null),
      doppelt,
      zweifel,
      imWarteraum,
      wahl: ziel?.wahl ? ziel.wahl.map((w) => ({ id: w.id, name: w.name, hinweis: kandidatHinweis(w.id) })) : null,
      geliefert: x.mess?.geliefert ?? null,
      zuletzt: x.mess?.zuletzt ?? null,
      ton: x.ton?.state ?? 'aus',
      tonGrund: x.ton?.reason ?? null,
      tonQuelle,
      tonEingestellt,
      offen: r.offen,
      liefSchon: x.s.liefSchon,
      zeigteSchon: x.s.zeigteSchon,
      andererSlot,
      fehler: kachelFehlerZeile({ zustand: zst, letzterSlotFehler: x.fehler, seitDemLive: false }),
      // T46 an der Kachel (7.5 Nr. 9, E26, E42): bei jedem Abbild gegen die aktuelle Gast-Liste, also auch, wenn ein Gast später
      // mit diesem Namen dazukommt oder geht (zoomGastLabelsGeaendert schickt dann ein neues Abbild).
      ndiWarnung: pruefeNdiName(e.ndiName, e.nr, [], d.gastLabels()).warnung,
      text: kachelZeile({
        zustand: zst, z, erlaubnis: lageErlaubnis, modus: e.modus, grund, gesendet, ersatzbild: e.ersatzbild, zielName: gezeigt, person,
        doppelt, zweifel, imWarteraum, liefSchon: x.s.liefSchon, andererSlot, freigaben: bildFreigaben(),
        aboFehlerName: x.aboFehlerName, gescheitertText: x.gescheitertText,
      }),
      tonText: slotTonZeile({
        zustand: zst, modus: e.modus, ziel: x.bridge?.target ?? 0, grund, tonAn: e.tonAn, tonArt: e.tonArt, computerton: e.computerton,
        person, doppelt, zweifel, imWarteraum, ton: x.ton?.state ?? 'aus', tonGrund: x.ton?.reason ?? null, quelle: tonQuelle,
        eingestellt: tonEingestellt, rateKhz: x.ton?.rate != null ? x.ton.rate / 1000 : null, kanaele: x.ton?.kanaele ?? null,
        tonAboFehler: tonAboFehlerAn(x), rateMismatch: rateMismatchAn(x),
      }),
      messText: slotMessZeile({
        zustand: zst, modus: e.modus, stufe: e.aufloesung, geliefert: x.mess?.geliefert ?? null, zuletzt: x.mess?.zuletzt ?? null,
      }),
    };
  }

  /** Teilnehmerzeilen mit den Nummern der laufenden Slots (SZ4–SZ6), deren Ziel diese Person ist (10.10, KF4). */
  function teilnehmerAbbild(): ZoomParticipant[] {
    const s = aktiveSitzung();
    if (!s) return [];
    const slotNrn = new Map<number, number[]>();
    for (const r of slotRohLagen()) {
      const b = r.x.bridge;
      if (b === null || b.target === 0 || !(r.zustand === 'zeigt' || r.zustand === 'gehalten' || r.zustand === 'ersatz')) continue;
      slotNrn.set(b.target, [...(slotNrn.get(b.target) ?? []), r.x.e.nr]);
    }
    return baueTeilnehmer({ liste: [...s.participants.values()], slotNrn });
  }

  /** Die einzige Kurzform (Slot-Spec 7.1, KF2): n, k, o, e und je Slot die Werte für STATE und Companion (8.2, 10.4). */
  function kurz(): ZoomKurz {
    const roh = slotRohLagen();
    const lageErlaubnis = zustand === 'im_meeting' ? erlaubnis : null;
    const z = zaehleSlots(roh.map((r) => ({ zustand: r.zustand, offen: r.offen, an: r.x.e.an, erlaubnis: lageErlaubnis, liefSchon: r.x.s.liefSchon })));
    const k: ZoomKurz = {
      zustand,
      warten: zustand === 'warteraum' ? warten : null,
      erlaubnis: lageErlaubnis,
      slotsLaufen: z.n,
      slotsErsatz: z.k,
      slotsOffen: z.o,
      slotsAn: z.e,
      slotsGestopptEntzug: z.gestopptEntzug,
      slotKurz: [],
      versuch: zustand === 'abriss' ? (folge?.versuch ?? null) : null,
      maengel: [...maengel],
      // Spec SDK nachladen 4.4: Kopfzeile und Tray zeigen beim Laden dieselbe Einrichtungszeile wie bei der Kopie (Z1b).
      kopieLaeuft: kopie !== null || ladung !== null,
      befehl: befehl ? { ...befehl } : null,
    };
    // 8.2, 10.4 (RR5): `live`, `zeigt`, `gehalten` und `ersatz` nur in Z6–Z9b; außerhalb mit Sender `wartet`, Ziel leer.
    const imMeetingZ = Z_IM_MEETING.has(zoomZ(k));
    k.slotKurz = roh.map((r) => {
      const live = (r.zustand === 'zeigt' || r.zustand === 'gehalten') && imMeetingZ;
      const mitSender = r.zustand === 'zeigt' || r.zustand === 'gehalten' || r.zustand === 'ersatz';
      return {
        nr: r.x.e.nr,
        an: r.x.e.an,
        live,
        alarm: r.offen,
        tonEin: tonEingeschaltet(r.x.e),
        modus: r.x.e.modus,
        ziel: live ? (gezeigtVon(r.x) ?? '') : '',
        zustandWort: mitSender && !imMeetingZ ? 'wartet' : ZOOM_STATE_ZUSTANDSWORT[r.zustand],
      };
    });
    return k;
  }

  function abbild(): ZoomAbbild {
    const l = laufzeitStand;
    const stand = kopie !== null ? 'kopiert' : !l.ok && l.mangel === 'sdk_fehlt' ? 'fehlt' : !l.ok && l.mangel === 'sdk_defekt' ? 'defekt' : 'ok';
    const sdkText = sdkFehler ?? (!l.ok && (l.mangel === 'sdk_defekt' || l.mangel === 'bridge_fehlt') ? mangelText(l.mangel, mangelDatei()) : null);
    const zugangText = !zugang.daten && zugang.unlesbar ? KT.A5
      : zugang.herkunft === 'session' ? (zugang.grund === 'schreibfehler' ? TEXT_A4_SCHREIBFEHLER : KT.A4)
      : zugang.herkunft === 'env' ? KT.A6
      : zugangFehler;
    const id = zugang.daten?.clientId ?? null;
    const k = kurz();
    const z = zoomZ(k);
    const einstellungsLage = d.einstellungen.einstellungsLage();
    return {
      kurz: k,
      einrichtung: {
        sdk: { stand, fassung: stand === 'ok' ? SDK_FASSUNG : null, kopie: kopie ? { ...kopie } : null, laden: ladung ? { ...ladung } : null, text: sdkText },
        zugang: { herkunft: zugang.herkunft, ...(zugang.grund ? { grund: zugang.grund } : {}), clientIdEnde: id ? id.slice(-4) : null, text: zugangText },
        sdkSchluessel: { herkunft: sdkSchluesselHerkunft },
      },
      anzeigename: d.einstellungen.anzeigename(),
      // nurSitzung liest ab Aufgabe 11 (4b) einstellungen.versatzNurSitzung().
      versatz: { gewuenschtMs: d.einstellungen.versatzMs(), bestaetigtMs: aktiveSitzung()?.videoDelayMs ?? null, nurSitzung: d.einstellungen.versatzNurSitzung() },
      teilnehmer: teilnehmerAbbild(),
      slots: slotRohLagen().map((r) => slotLage(r, z)),
      vorgaben: d.einstellungen.vorgaben(),
      sprecher: d.einstellungen.sprecher(),
      vorschauAn: d.einstellungen.vorschau(),
      vorschauVerfuegbar,
      vorschauDetail,
      ueber5: d.einstellungen.ueber5(),
      messwerte: {
        bridge: messwerte.bridge, slots: [...messwerte.slots], freigaben: messwerte.freigaben, sprecherSignale: [...messwerte.sprecherSignale],
      },
      // NB9 (Nachtrag B): T92 steht genau, solange settings.ts für ein Slot-Feld einen Sitzungswert hält.
      einstellungen: { nurSitzung: einstellungsLage.nurSitzung === true, gesichert: einstellungsLage.gesichert },
      abriss: zustand === 'abriss' ? { versuch: folge?.versuch ?? null, versuche: WIEDERBEITRITT_VERSUCHE, naechsterUm: folge?.naechsterUm ?? null } : null,
      meldung: meldung ? { ...meldung } : null,
      hinweise: [...hinweise],
      erneutMoeglich: nummer !== null,
      pruefungLaeuft,
      // L13: Eine gestoppte Bridge baut noch ab; die Karte sperrt die Einrichtung (S10).
      abbauLaeuft: stopps.size > 0,
    };
  }

  /** Nach jeder Änderung: Kurzform sofort (bei Änderung), Abbild höchstens alle abbildTaktMs. */
  function abbildGeaendert(): void {
    const k = kurz();
    const kj = JSON.stringify(k);
    if (kj !== letzteKurz) {
      letzteKurz = kj;
      d.onKurz?.(k);
    }
    if (pushTimer !== null) return;
    const rest = letzterPush + f.abbildTaktMs - Date.now();
    if (rest <= 0) {
      letzterPush = Date.now();
      d.onAbbild(abbild());
      return;
    }
    pushTimer = zeitgeber(rest, () => {
      pushTimer = null;
      letzterPush = Date.now();
      d.onAbbild(abbild());
    });
  }

  function setzeZustand(z: ZoomZustand): void {
    if (z !== zustand) {
      d.log(`[zoom] Zustand ${zustand} → ${z}`);
      zustand = z;
    }
    if (z !== 'warteraum') warten = null;
    abbildGeaendert();
  }

  function melde(art: 'info' | 'warnung' | 'fehler', m: Meldungstext): void {
    meldung = { art, text: m.text, detail: m.detail };
    d.log(`[zoom] Meldung (${art}): ${m.text}${m.detail ? ` [${m.detail}]` : ''}`);
  }

  /** Das Abbild bekommt `text`, das Log `logText` (N4b.2: dort nie ein Teilnehmername). */
  function hinweis(text: string, logText = text): void {
    hinweise.push(text);
    while (hinweise.length > HINWEISE_MAX) hinweise.shift();
    d.log(`[zoom] Hinweis: ${logText}`);
  }

  // ── Einrichtung (Spec 5.3, 6.1) ──────────────────────────────────────────
  /** Mängel neu bestimmen: Laufzeit-Mangel zuerst, dann Zugangs-Mangel. */
  function bestimmeMaengel(neu?: LaufzeitPruefung): void {
    if (neu) {
      laufzeitStand = neu;
      meldeLaufzeit(neu);
    }
    zugang = d.zugang.lesen();
    const m: ZoomMangel[] = [];
    if (!laufzeitStand.ok) m.push(laufzeitStand.mangel);
    if (!zugang.daten) m.push(zugang.unlesbar ? 'zugang_unlesbar' : 'zugang_fehlt');
    maengel = m;
  }

  /** Spec 8.7: die Diagnose der Laufzeit-Prüfung (Grund, warum eine eigene Datei nicht ersetzt werden konnte) gehört ins Log. */
  function meldeLaufzeit(l: LaufzeitPruefung): void {
    if (!l.ok && l.mangel === 'sdk_defekt' && l.detail) d.log(`[zoom] Laufzeit defekt: ${l.datei} (${l.detail})`);
    if (l.ok && l.ersetzt.length) d.log(`[zoom] Eigene Dateien ersetzt: ${l.ersetzt.join(', ')}`);
  }

  function mangelDatei(): string | null {
    return !laufzeitStand.ok && laufzeitStand.mangel === 'sdk_defekt' ? laufzeitStand.datei : null;
  }

  /** Spec 5.3: Ein Mangel beendet die Sitzung der Slots (Slot-Spec 7.3 Nr. 2, 7, 8; RR1) und leert Nummer und Kenncode. */
  function mangelFolgen(): void {
    sitzungsEnde('mangel');
    nummer = null;
    kenncode = null;
  }

  function einrichtungSperre(): ZoomErgebnis {
    // Spec SDK nachladen 4.4: zusätzlich nur ohne laufendes Laden (ladeLauf umfasst ladung !== null und die Kopie danach).
    // N4b.3 Nr. 8, L13: auch solange eine gestoppte Bridge noch abbaut (stopps), bleibt die Einrichtung gesperrt.
    const frei = ladeLauf === null && stopps.size === 0
      && ((zustand === 'einrichtung' && kopie === null) || (zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler');
    return frei ? { ok: true } : { ok: false, text: KT.S10 };
  }

  async function sdkWaehlen(ordner: string): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    sdkFehler = null;
    return pruefeUndRichteEin(ordner, 'Ordner');
  }

  /**
   * Gemeinsame Strecke von „SDK-Ordner wählen“ und „Zoom-SDK laden“ (Spec SDK nachladen 4.3 Schritt 6): Ordner
   * prüfen, kopieren mit dem `kopie`-Fortschritt, Einstellungen, Mängel, Zustand. Sperre, fehler→schliessen und
   * `sdkFehler = null` stehen bei den Aufrufern. `herkunft` ändert nur die Logzeile einer Abweisung.
   */
  async function pruefeUndRichteEin(ordner: string, herkunft: 'Ordner' | 'Laden'): Promise<ZoomErgebnis> {
    const wahl = lz.pruefeOrdner(ordner, d.pfade.ressourcen);
    if (!wahl.ok) {
      sdkFehler = wahl.text;
      d.log(herkunft === 'Ordner' ? `[zoom] SDK-Ordner abgewiesen: ${wahl.text}` : `[zoom] Geladenes Zoom-SDK abgewiesen: ${wahl.text}`);
      // Beim Ordner steht der Zustand schon so (kein Wechsel, keine Logzeile). Beim Laden steht noch der Lade-Zustand
      // `einrichtung`, ohne ladung und ohne kopie: Ein bloßes abbildGeaendert() meldete kurz Z1a an Tray und Kopfzeile.
      setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
      return { ok: false, text: wahl.text };
    }
    const abbruch = new AbortController();
    kopieAbbruch = abbruch;
    kopie = { dateien: 0, dateienGesamt: wahl.dateien.length, bytes: 0, bytesGesamt: wahl.bytesGesamt };
    d.log(`[zoom] Zoom-SDK ${wahl.fassung} wird kopiert (${wahl.dateien.length} Dateien)`);
    setzeZustand('einrichtung');
    let erg: EinrichtungsErgebnis;
    try {
      kopieLauf = lz.richteEin({
        wahl,
        pfade: d.pfade,
        signal: abbruch.signal,
        fortschritt: (k) => {
          kopie = { ...k };
          abbildGeaendert();
        },
      });
      erg = await kopieLauf;
    } catch (e) {
      erg = { ok: false, text: KT.S6((e as { code?: string }).code ?? (e instanceof Error ? e.message : String(e))) };
    }
    kopie = null;
    kopieAbbruch = null;
    kopieLauf = null;
    if (erg.ok) {
      d.einstellungen.setzeLaufzeit({ dir: erg.ordner, fassung: erg.stempel.sdkFassung, eingerichtetAm: erg.stempel.eingerichtetAm });
      d.log(`[zoom] Zoom-SDK eingerichtet in ${erg.ordner}`);
      if (erg.aufraeumFehler) d.log(`[zoom] Aufräumen nach der Einrichtung unvollständig (${erg.aufraeumFehler})`);
    } else {
      sdkFehler = erg.text;
      d.log(`[zoom] Einrichtung des Zoom-SDK gescheitert: ${erg.text}`);
    }
    bestimmeMaengel(lz.pruefe(d.pfade));
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return erg.ok ? { ok: true } : { ok: false, text: erg.text };
  }

  // ── Zoom-SDK laden (Spec 2026-10-06, 4.3, 4.4) ───────────────────────────
  /**
   * Schritte 1–2 hier, synchron: Sperre (S10), fehler→schliessen, Schlüssel (S11). Danach sind `ladung`,
   * `ladeAbbruch` und `ladeLauf` gesetzt, bevor irgendetwas wartet: ein zweiter Klick trifft schon die Sperre.
   */
  function sdkLaden(): Promise<ZoomErgebnis> {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return Promise.resolve(sperre);
    if (zustand === 'fehler') schliessen();
    const schluessel = d.sdkSchluessel.lesen().wert;
    if (schluessel === null) {
      d.log('[zoom] Zoom-SDK laden abgewiesen: ' + KT.S11);
      return Promise.resolve({ ok: false, text: KT.S11 });
    }
    sdkFehler = null;
    const abbruch = new AbortController();
    ladeAbbruch = abbruch;
    ladung = { phase: 'link', bytes: 0, bytesGesamt: SDK_PAKET.bytes };
    d.log(`[zoom] Zoom-SDK wird geladen (${Math.round(SDK_PAKET.bytes / MIB)} MB)`);
    setzeZustand('einrichtung');
    const lauf = ladeAblauf(schluessel, abbruch.signal).finally(() => {
      ladeLauf = null;
    });
    ladeLauf = lauf;
    return lauf;
  }

  /** Schritte 3–8. Jeder Ausgang räumt den Arbeitsordner (Schritt 7) und lässt die bisherige Einrichtung stehen. */
  async function ladeAblauf(schluessel: string, signal: AbortSignal): Promise<ZoomErgebnis> {
    const arbeit = join(d.pfade.basis, LADE_ORDNER);
    const zip = join(arbeit, SDK_PAKET.datei);
    const entpackt = join(arbeit, 'sdk');
    const phase = (p: LadenStand['phase'], bytes = ladung?.bytes ?? 0): void => {
      ladung = { phase: p, bytes, bytesGesamt: SDK_PAKET.bytes };
      abbildGeaendert();
    };
    /** Ende ohne Kopie: ladung weg, Text ins Abbild, Zustand wie vorher (die Laufzeit hat sich nicht geändert). */
    const ende = (text: string, zeile: string): ZoomErgebnis => {
      ladung = null;
      sdkFehler = text;
      d.log(zeile);
      setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
      return { ok: false, text };
    };
    const scheitert = (text: string): ZoomErgebnis => ende(text, `[zoom] Laden des Zoom-SDK gescheitert: ${text}`);
    const abgebrochen = (): ZoomErgebnis => ende(KT.S17, '[zoom] Laden des Zoom-SDK abgebrochen');
    // Ein Abbruch zählt immer als Abbruch (S17), auch wenn entpacke ihn als `entpacken` meldet.
    const fehlschlag = (f: LadeFehler): ZoomErgebnis => (signal.aborted || f.art === 'abgebrochen' ? abgebrochen() : scheitert(ladeFehlerText(f)));
    try {
      // (4) Arbeitsordner: Reste eines früheren Laufs weg, und zwar VOR der Platzmessung (A12): Sie zählen sonst
      // gegen den Bedarf (ZIP und Entpackordner, bis rund 460 MB). Angelegt wird dabei nichts.
      ld.loesche(arbeit);
      // (3) Platz: ZIP + Entpackordner + Kopie + Reserve, sonst S5 — dann ist noch nichts angelegt.
      const bedarf = SDK_PAKET.bytes + 2 * SDK_PAKET.bytesEntpackt + PLATZ_RESERVE_BYTES;
      const frei = await ld.freierPlatz(d.pfade.basis);
      if (frei < bedarf) return scheitert(KT.S5(Math.ceil(bedarf / MIB), Math.floor(frei / MIB)));
      // (5) Phasen link → download → pruefen → entpacken. Vom Proxy steht nur der Host im Log.
      const base = d.proxyUrl();
      let host = 'unbekannt';
      try {
        host = new URL(base).host;
      } catch {
        // ungültige Adresse: holeLink meldet sie als S14
      }
      d.log(`[zoom] SDK-Link angefragt bei ${host}`);
      const link = await ld.holeLink({ base, schluessel, fassung: SDK_PAKET.fassung, signal });
      if (!link.ok) return fehlschlag(link);
      phase('download', 0);
      const geladen = await ld.lade({
        url: link.url,
        size: link.size,
        ziel: zip,
        erwartet: SDK_PAKET,
        signal,
        fortschritt: (bytes) => phase('download', bytes),
        beimPruefen: () => phase('pruefen'),
      });
      if (!geladen.ok) return fehlschlag(geladen);
      if (signal.aborted) return abgebrochen();
      phase('entpacken');
      const ausgepackt = await ld.entpacke({ zip, ordner: entpackt, signal });
      if (!ausgepackt.ok) {
        // Die einzige Diagnose von tar.exe (Platte, Rechte, Virenscanner, Pfadlänge) gehört ins Log; nur lokale Pfade.
        if (ausgepackt.art === 'entpacken' && ausgepackt.ausgabe) d.log(`[zoom] Ausgabe von tar.exe: ${ausgepackt.ausgabe}`);
        return fehlschlag(ausgepackt);
      }
      if (signal.aborted) return abgebrochen();
      d.log('[zoom] Zoom-SDK geladen und geprüft');
      // (6) Dieselbe Strecke wie „SDK-Ordner wählen“. Ab hier greift „Abbrechen“ nicht mehr (die Kopie hat keinen).
      ladung = null;
      ladeAbbruch = null;
      // Danach steht der Zustand: nach der Kopie wie bei der Ordnerwahl, nach einer Abweisung setzt ihn deren Zweig.
      const r = await pruefeUndRichteEin(entpackt, 'Laden');
      // Auch nach Abweisung oder Kopierfehler endet ein gescheitertes Laden mit der Zeile aus Spec 4.3.
      if (!r.ok) d.log(`[zoom] Laden des Zoom-SDK gescheitert: ${r.text}`);
      return r;
    } catch (e) {
      return signal.aborted ? abgebrochen() : scheitert(KT.S16(fehlerCode(e)));
    } finally {
      ladung = null;
      ladeAbbruch = null;
      // (7) ZIP und Entpackordner immer weg; ein Fehler hier wird nur geloggt.
      try {
        ld.loesche(arbeit);
      } catch (e) {
        d.log(`[zoom] Aufräumen nach dem Laden unvollständig (${fehlerCode(e)})`);
      }
      abbildGeaendert();
    }
  }

  function sdkLadenAbbrechen(): void {
    if (ladung !== null) ladeAbbruch?.abort();
  }

  function zugangWaehlen(datei: string): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    let daten: ZugangDaten;
    try {
      // Mit dieser Umgebung ist die Datei die EINZIGE Quelle (jwt.ts); BOM wird vertragen,
      // ein Parse-Fehler zitiert den Inhalt nicht.
      daten = readCredentials({ ZOOM_SDK_CREDENTIALS: datei });
    } catch (e) {
      const err = e as Error & { code?: string };
      const text = err.message.includes('kein gueltiges JSON') ? KT.A1
        : err.message.includes('Zugangsdaten fehlen') ? KT.A2
        : KT.A3(err.code ?? err.name);
      zugangFehler = text;
      d.log(`[zoom] Zugangsdaten-Datei abgewiesen: ${text}`);
      abbildGeaendert();
      return { ok: false, text };
    }
    return zugangUebernehmen(daten, 'Datei');
  }

  /** Gemeinsamer Schluss von Datei-Weg und Handeingabe: speichern, loggen (nie einen Wert), Mängel und Zustand neu. */
  // Sperre und fehler→schliessen stehen bewusst bei den beiden Aufrufern: sonst änderte sich der Datei-Weg bei A1–A3.
  function zugangUebernehmen(daten: ZugangDaten, weg: 'Datei' | 'Hand'): ZoomErgebnis {
    zugangFehler = null;
    const herkunft = d.zugang.speichern({ clientId: daten.clientId, clientSecret: daten.clientSecret });
    const wo = herkunft === 'session' ? 'nur für diese Sitzung' : 'verschlüsselt';
    d.log(`[zoom] Zugangsdaten hinterlegt (${weg === 'Hand' ? `von Hand, ${wo}` : wo})`);
    bestimmeMaengel();
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: true };
  }

  /** Von Hand eingetragen (A7): getrimmt, ohne Leerraum in den Werten. Nichts davon in Log, Text oder Rückgabe. */
  function zugangEintragen(e: { clientId: string; clientSecret: string }): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    const clientId = e.clientId.trim();
    const clientSecret = e.clientSecret.trim();
    if (!clientId || !clientSecret || /\s/.test(clientId) || /\s/.test(clientSecret)) {
      // Eingabefehler, kein Zustand der hinterlegten Zugangsdaten: nur im Ergebnis, nicht im Abbild.
      d.log('[zoom] Zugangsdaten von Hand abgewiesen: ' + KT.A7);
      return { ok: false, text: KT.A7 };
    }
    return zugangUebernehmen({ clientId, clientSecret }, 'Hand');
  }

  function zugangLoeschen(): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    // false: für diese Sitzung weg, aber noch in der Einstellungsdatei; nach einem Neustart wären sie wieder da.
    const vonPlatte = d.zugang.loeschen();
    zugangFehler = null;
    d.log(vonPlatte ? '[zoom] Zugangsdaten entfernt' : '[zoom] Zugangsdaten nur für diese Sitzung entfernt (Einstellungsdatei nicht schreibbar)');
    bestimmeMaengel();
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return vonPlatte ? { ok: true } : { ok: false, text: TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT };
  }

  /** Spec SDK nachladen 4.2: getrimmt, nur druckbare ASCII-Zeichen, sonst S18 (A13). Der Wert geht nie in Log, Abbild oder Rückgabe. */
  function sdkSchluesselEintragen(e: { schluessel: string }): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    const wert = e.schluessel.trim();
    // Nur druckbare ASCII-Zeichen: kein Leerraum in der Mitte (Spec 4.2) und nichts, was kein HTTP-Header tragen kann.
    if (!/^[\x21-\x7e]+$/.test(wert)) {
      // Eingabefehler, kein Zustand des hinterlegten Schlüssels: nur im Ergebnis, nicht im Abbild.
      d.log('[zoom] SDK-Schlüssel abgewiesen: ' + KT.S18);
      return { ok: false, text: KT.S18 };
    }
    const herkunft = d.sdkSchluessel.speichern(wert);
    sdkSchluesselHerkunft = d.sdkSchluessel.lesen().herkunft;
    sdkAblehnungVergessen();
    d.log(`[zoom] SDK-Schlüssel hinterlegt (${herkunft === 'session' ? 'nur für diese Sitzung' : 'verschlüsselt'})`);
    abbildGeaendert();
    return { ok: true };
  }

  /**
   * S12 („Schlüssel abgelehnt“) gilt dem Schlüssel, der damals galt. Nach einem neuen oder entfernten Schlüssel
   * stünde er sonst bis zum nächsten Laden neben „SDK-Schlüssel: hinterlegt“ bzw. „fehlt“. Andere Fehler bleiben
   * stehen. Ein Schlüssel aus der Umgebung hat Vorrang und gilt weiter: dann bleibt auch S12.
   */
  function sdkAblehnungVergessen(): void {
    if (sdkFehler === KT.S12 && sdkSchluesselHerkunft !== 'env') sdkFehler = null;
  }

  function sdkSchluesselLoeschen(): ZoomErgebnis {
    const sperre = einrichtungSperre();
    if (!sperre.ok) return sperre;
    if (zustand === 'fehler') schliessen();
    // false: für diese Sitzung weg, aber noch in der Einstellungsdatei; nach einem Neustart wäre er wieder da.
    const vonPlatte = d.sdkSchluessel.loeschen();
    sdkSchluesselHerkunft = d.sdkSchluessel.lesen().herkunft;
    sdkAblehnungVergessen();
    d.log(vonPlatte ? '[zoom] SDK-Schlüssel entfernt' : '[zoom] SDK-Schlüssel nur für diese Sitzung entfernt (Einstellungsdatei nicht schreibbar)');
    abbildGeaendert();
    return vonPlatte ? { ok: true } : { ok: false, text: TEXT_SDK_SCHLUESSEL_NUR_SITZUNG_ENTFERNT };
  }

  function versatz(e: { ms: number }): ZoomErgebnis {
    if (!Number.isInteger(e.ms) || e.ms < 0 || e.ms > 1000) return { ok: false, text: KT.Q13 };
    const gespeichert = d.einstellungen.setzeVersatzMs(e.ms);
    sende({ cmd: 'videoDelay', ms: e.ms });
    abbildGeaendert();
    // L14: nur für diese Sitzung gemerkt → ehrliche Antwort (Muster „Entfernen“); der Versatz gilt trotzdem.
    return gespeichert ? { ok: true } : { ok: false, text: TEXT_A4_SCHREIBFEHLER };
  }

  /** Spec 6.8 „Schließen“: nur in Z2 und Z13. */
  function schliessen(): void {
    if (zustand !== 'bereit' && zustand !== 'fehler') return;
    folgeBeenden();
    meldung = null;
    sitzungsEnde('schliessen');
    nummer = null;
    kenncode = null;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  /** Spec 6.8 „Meldung quittieren“: in jedem Zustand außer Z13. */
  function meldungWeg(): void {
    if (zustand === 'fehler') return;
    meldung = null;
    abbildGeaendert();
  }

  function laeuft(): boolean {
    return kopie !== null || ladeLauf !== null || pruefungLaeuft || aktiveBridge !== null || stopps.size > 0;
  }

  // ── Bridge starten und stoppen (Spec 5.2, 6.2 Startfolge, 6.9) ───────────
  function geheimnisse(): string[] {
    const g = gemerkt;
    let gNormiert = '';
    if (g) {
      try {
        gNormiert = normalizeMeetingId(g.nummer);
      } catch {
        // keine gültige Nummer: nur die Eingabe selbst maskieren
      }
    }
    return [kenncode ?? '', nummer?.eingabe ?? '', nummer?.normiert ?? '', jwt ?? '', g?.nummer ?? '', gNormiert, g?.kenncode ?? ''];
  }

  function beiLog(zeile: string): void {
    // N4b.2, L11: erst die Namen der Teilnehmer (‹Name›), dann Nummer, Kenncode und JWT (•••).
    d.log(`[zoom-bridge] ${maskiere(maskiereNamen(zeile, [...gesehenNamen]), geheimnisse())}`);
  }

  /** L11: Namen aus roster, joined und renamed merken (jede Generation), die eigene Zeile nicht. */
  function namenMerken(ev: BridgeEvent): void {
    const e = ev as unknown as { list?: Array<{ name: string; self: boolean }>; p?: { name: string; self: boolean }; name?: unknown };
    if (ev.ev === 'roster') {
      for (const t of e.list ?? []) if (!t.self) gesehenNamen.add(t.name);
    } else if (ev.ev === 'joined') {
      if (e.p && !e.p.self) gesehenNamen.add(e.p.name);
    } else if (ev.ev === 'renamed') {
      if (typeof e.name === 'string') gesehenNamen.add(e.name);
    }
  }

  /** Sendet an die aktive Bridge (nicht im Abbau). Nie den Inhalt loggen: join trägt Nummer und Kenncode. */
  function sende(cmd: Command): boolean {
    if (aktiveBridge === null || imAbbau.has(aktiveGen)) return false;
    try {
      aktiveBridge.send(cmd);
      return true;
    } catch (e) {
      d.log(`[zoom] Befehl ${cmd.cmd} nicht gesendet: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  function stoppeBridge(): Promise<void> {
    const b = aktiveBridge;
    const gen = aktiveGen;
    if (b === null) return Promise.resolve();
    const laufend = stopps.get(gen);
    if (laufend) return laufend;
    imAbbau.add(gen);
    if (startBeob !== null && startBeob.gen === gen) startBeob.ende({ ok: false, meldung: ABGEBROCHEN, ausgang: null });
    // Ohne Prozess (Start gescheitert) gibt es nichts zu beenden: keine Beenden-Zeilen, die einen Prozess erfinden.
    const lief = !ohneProzess.has(gen);
    if (lief) d.log(`[zoom] Zoom-Bridge ${gen} wird beendet`);
    const p = b
      .stop()
      .then(
        (code) => {
          if (lief) d.log(code === -1 ? '[zoom] Zoom-Bridge hart beendet' : `[zoom] Zoom-Bridge beendet (Rückgabewert ${code})`);
        },
        (e: unknown) => d.log(`[zoom] Zoom-Bridge ließ sich nicht beenden: ${e instanceof Error ? e.message : String(e)}`),
      )
      .then(() => {
        // 6.9: Kehrt stop() zurück, gehören die Sender dieser Generation nicht mehr zum Abbild (Slot-Spec 7.3 Nr. 10).
        for (const x of slots.values()) if (x.bridge?.gen === gen) senderWeg(x);
        // Nachtrag B (I-2): Mit der Generation enden ihre unbeantworteten slotOn und ihre verdeckten Reservierungen. Eine neue
        // Generation startet erst danach (starteBridge wartet auf stopps), die offenen slotOn gehören also zu dieser.
        for (const x of slots.values()) x.slotOnOffen = [];
        for (const [nr, r] of reserviert) if (r.gen === gen) reserviert.delete(nr);
        stopps.delete(gen);
        ohneProzess.delete(gen);
        if (aktiveBridge === b) {
          aktiveBridge = null;
          jwt = null;
        }
        abbildGeaendert();
      });
    stopps.set(gen, p);
    return p;
  }

  function startBewerten(beob: StartBeobachter, ev: BridgeEvent): void {
    if (beob.erledigt) return;
    if (ev.ev === 'ready') {
      const v = String((ev as { sdkVersion?: unknown }).sdkVersion);
      if (v !== SDK_FASSUNG_BRIDGE) beob.ende({ ok: false, meldung: { text: KT.B7(v), detail: null }, ausgang: { art: 'sdkFassung' } });
      return;
    }
    if (ev.ev === 'auth') {
      const code = (ev as { code: number }).code;
      beob.ende(code === 0 ? { ok: true } : { ok: false, meldung: authMeldung(code), ausgang: { art: 'auth', code } });
      return;
    }
    if (ev.ev !== 'error') return;
    const e = ev as unknown as FehlerEreignis;
    const name = e.name ?? String(e.code);
    if (e.where === 'ndi') beob.ende({ ok: false, meldung: { text: KT.Q7, detail: fehlerDetail(e) }, ausgang: { art: 'ndi' } });
    else if (e.where === 'auth') beob.ende({ ok: false, meldung: { text: KT.B18(name), detail: fehlerDetail(e) }, ausgang: { art: 'authSofort' } });
    else if (e.where === 'init') {
      beob.ende({ ok: false, meldung: { text: e.code === 14 ? KT.B8_14 : KT.B8(name), detail: fehlerDetail(e) }, ausgang: { art: 'init' } });
    } else if (e.where === 'exit') {
      const exitCode = exitCodeAus(e.detail);
      beob.ende({
        ok: false,
        meldung: dllMeldung(exitCode) ?? { text: KT.B6(e.detail ?? fehlerDetail(e)), detail: fehlerDetail(e) },
        ausgang: { art: 'exited', exitCode },
      });
    }
  }

  /** Spec 6.2 Startfolge S-a bis S-f. Setzt keinen Zustand; jeder Fehler stoppt die Bridge. */
  async function starteBridge(): Promise<StartErgebnis> {
    const lauf = laufNr;
    const abgebrochen: StartErgebnis = { ok: false, meldung: ABGEBROCHEN, mangel: null, ausgang: null };
    if (stopps.size > 0) await Promise.all([...stopps.values()]);
    if (lauf !== laufNr || beendenVersprechen !== null) return abgebrochen;
    // S-a, S-b
    const lzErg = lz.pruefe(d.pfade);
    bestimmeMaengel(lzErg);
    if (!lzErg.ok) {
      return { ok: false, meldung: { text: mangelText(lzErg.mangel, mangelDatei()), detail: null }, mangel: lzErg.mangel, ausgang: null };
    }
    const daten = zugang.daten;
    if (!daten) {
      const m: ZoomMangel = zugang.unlesbar ? 'zugang_unlesbar' : 'zugang_fehlt';
      return { ok: false, meldung: { text: mangelText(m, null), detail: null }, mangel: m, ausgang: null };
    }
    // S-c
    const gen = aktiveGen + 1;
    startNr += 1;
    // Slot-Spec 7.3 Nr. 2, 5: Mit jeder neuen Bridge fallen Fristen und Fehlerstände; die Kennungen der alten gelten nicht mehr.
    // Fehlerzeile (10.9) und Ton-Abo-Merker (7.1, W6) fallen ebenso.
    for (const x of slots.values()) {
      fristBeantwortet(x);
      fehlerWeg(x);
      x.s = sitzungNach(x.s, 'neueBridge');
      x.slotOnOffen = [];
    }
    // Nachtrag B (I-2): Alle früheren Generationen sind beendet (oben abgewartet), ihre Reservierungen gelten nicht mehr.
    reserviert.clear();
    tonAboFehler = null;
    // 7.7: Eine neue Bridge richtet die Vorschau neu ein; die Uhr ihrer Freigabe-Rückrufe beginnt bei 0 (7.8).
    vorschauVerfuegbar = true;
    vorschauDetail = null;
    messwerteLeeren();
    const ordner = lzErg.ordner;
    const exePfad = join(ordner, BRIDGE_EXE);
    const bridge = fabrik(
      {
        exePath: exePfad,
        // PATH immer selbst setzen, INKLUSIVE des geerbten Werts (Falle 3.2-4), und jede andere
        // Schreibweise von PATH entfernen (bridge.ts mischt process.env als einfaches Objekt).
        env: { PATH: kindPfad(env, ordner) },
        // Nie an die Bridge (sie lädt die Zoom-DLLs): Zoom-Zugangsdaten und Schlüssel für den Release-Proxy (G2).
        // Auch abweichend geschriebene Namen (Windows liest process.env ohne Rücksicht auf Groß-/Kleinschreibung,
        // bridge.ts mischt aber ein einfaches Objekt ein, dessen Schlüssel ihre Schreibung behalten).
        envRemove: [
          ...GEHEIM,
          ...Object.keys(process.env).filter((k) => GEHEIM.includes(k.toUpperCase())),
          ...pfadVarianten(env),
        ],
        joinTimeoutMs: f.joinTimeoutMs,
        killTimeoutMs: f.killTimeoutMs,
        onEvent: (ev) => beiEreignis(gen, ev),
        onLog: beiLog,
      },
      startNr,
    );
    aktiveBridge = bridge;
    aktiveGen = gen;
    d.log(`[zoom] Zoom-Bridge ${gen} startet`);
    let anmeldeFrist: ReturnType<typeof setTimeout> | null = null;
    const beob: StartBeobachter = { gen, erledigt: false, ende: () => {} };
    const ausgang = new Promise<StartAusgang>((resolve) => {
      beob.ende = (e) => {
        if (beob.erledigt) return;
        beob.erledigt = true;
        if (anmeldeFrist !== null) clearTimeout(anmeldeFrist);
        if (startBeob === beob) startBeob = null;
        // Es zählt der ERSTE Fehler: die Bridge ist ab hier im Abbau, spätere Ereignisse nur noch Log (6.9).
        if (!e.ok && e.meldung.text !== '') void stoppeBridge();
        resolve(e);
      };
    });
    startBeob = beob;
    try {
      await bridge.start();
    } catch (e) {
      // Die Logzeile trägt Grund (mit Code) und versuchten EXE-Pfad — die einzige Spur, wenn z. B. Smart
      // App Control blockiert (M7, B2) oder der Fehler keinen code hat (B2 „unbekannt“). Den Pfad nennt
      // Node nur bei den asynchronen Spawn-Fehlern ENOENT, EACCES, EAGAIN, EMFILE, ENFILE („spawn <pfad>
      // <code>“); jeden anderen Code, also auch EPERM, wirft spawn() synchron als „spawn <code>“ OHNE Pfad
      // (Node 24, lib/internal/child_process.js; gemessen: Textdatei als EXE → „spawn UNKNOWN“). Darum
      // hängt der Kern den Pfad selbst an, wenn er nicht schon in der Meldung steht.
      ohneProzess.add(gen);
      const grund = e instanceof Error ? e.message : String(e);
      d.log(`[zoom] Start der Zoom-Bridge gescheitert: ${grund.includes(exePfad) ? grund : `${grund} (EXE: ${exePfad})`}`);
      beob.ende({ ok: false, meldung: spawnMeldung((e as { code?: string }).code), ausgang: { art: 'spawn' } });
    }
    if (!beob.erledigt) {
      // S-d
      jwt = buildJwt({ clientId: daten.clientId, clientSecret: daten.clientSecret, ttlSeconds: JWT_GUELTIG_S });
      const v = d.einstellungen.versatzMs();
      const ms = Number.isInteger(v) && v >= 0 && v <= 1000 ? v : 0;
      const sp = d.einstellungen.sprecher();
      try {
        bridge.send({ cmd: 'init' });
        bridge.send({ cmd: 'auth', jwt });
        bridge.send({ cmd: 'videoDelay', ms });
        // Slot-Spec 7.6, 7.7: zusammen mit videoDelay die gespeicherten Sprecher-Einstellungen und die Vorschau nach Schalter
        // „Vorschau“ und Fenster (die Bridge beginnt mit ausgeschalteter Vorschau, 6.16).
        bridge.send({ cmd: 'speakerConfig', signal: SIGNAL_ZU_BRIDGE[sp.signal], holdMs: sp.haltezeitMs });
        bridge.send({ cmd: 'previewMode', on: vorschauWunsch() });
      } catch {
        // Bridge schon tot: ihr exit-Ereignis kam vorher und hat die Startfolge entschieden.
      }
      // S-f
      if (!beob.erledigt) {
        anmeldeFrist = zeitgeber(f.anmeldeMs, () => beob.ende({ ok: false, meldung: { text: KT.B16, detail: null }, ausgang: { art: 'keineAuthAntwort' } }));
      }
    }
    const a = await ausgang;
    if (!a.ok) {
      await stopps.get(gen);
      return lauf !== laufNr ? abgebrochen : { ok: false, meldung: a.meldung, mangel: null, ausgang: a.ausgang };
    }
    if (lauf !== laufNr) return abgebrochen;
    return { ok: true, bridge, gen };
  }

  /** Ereignisse einer Bridge im Abbau oder alter Generation (6.9): nur Sender dieser Generation abbauen, sonst Log (PK22). */
  function abbauEreignis(gen: number, ev: BridgeEvent): void {
    if (ev.ev === 'slot' && (ev as unknown as SlotEreignis).state === 'off') {
      const nr = (ev as unknown as SlotEreignis).slot;
      const x = slots.get(nr);
      if (x && x.bridge?.gen === gen) senderWeg(x);
      if (reserviert.get(nr)?.gen === gen) reserviert.delete(nr);
      return;
    }
    if (ev.ev === 'slotAudio' && (ev as unknown as SlotTonEreignis).state === 'off') {
      const a = ev as unknown as SlotTonEreignis;
      const x = slots.get(a.slot);
      if (x && x.bridge?.gen === gen && x.ton) x.ton = { ...x.ton, state: 'off', reason: a.reason, source: a.source };
      return;
    }
    if (ev.ev !== 'error') d.log(`[zoom] (Abbau) ${beschreibe(ev)}`);
  }

  function beiEreignis(gen: number, ev: BridgeEvent): void {
    namenMerken(ev);
    const aktiv = gen === aktiveGen && !imAbbau.has(gen);
    if (ev.ev === 'error') {
      const e = ev as unknown as FehlerEreignis;
      d.log(`[zoom] ${aktiv ? '' : '(Abbau) '}Fehler where=${e.where} code=${String(e.code)} name=${e.name ?? '-'}${e.detail ? ` (${e.detail})` : ''}`);
    }
    if (!aktiv) {
      abbauEreignis(gen, ev);
      abbildGeaendert();
      return;
    }
    if (startBeob !== null && startBeob.gen === gen) startBewerten(startBeob, ev);
    if (imAbbau.has(gen)) {
      abbildGeaendert();
      return;
    }
    switch (ev.ev) {
      case 'status':
        statusEreignis(ev as unknown as StatusEreignis);
        break;
      case 'privilege':
        privilegEreignis(ev as unknown as PrivilegEreignis);
        break;
      case 'error':
        fehlerEreignis(ev as unknown as FehlerEreignis);
        break;
      case 'slot':
        slotEreignis(ev as unknown as SlotEreignis);
        break;
      case 'slotAudio':
        slotTonEreignis(ev as unknown as SlotTonEreignis);
        break;
      case 'roster':
      case 'joined':
      case 'left':
      case 'renamed':
        teilnehmerEreignis(ev);
        abgleichPlanen();
        break;
      case 'videoStatus':
        // Der Reducer führt videoOn des Teilnehmers nach (0.18); der Abgleich prüft das Ziel neu (7.3 „Auslöser“).
        abgleichPlanen();
        break;
      // Slot-Spec 7.8, 7.10: Messwerte, Freigaben und Sprecher-Signale (Plan B, Task B15); die Vorschau folgt mit Task B16.
      case 'slotStats':
        slotStatsEreignis(ohneEv(ev) as ZoomMesswerte['slots'][number]);
        break;
      case 'bridgeStats':
        bridgeStatsEreignis(ohneEv(ev) as NonNullable<ZoomMesswerte['bridge']>);
        break;
      case 'shares':
        freigabenEreignis(ohneEv(ev) as NonNullable<ZoomMesswerte['freigaben']>);
        break;
      case 'speakerSignal':
        sprecherSignalEreignis(ohneEv(ev) as Omit<ZoomMesswerte['sprecherSignale'][number], 'namen'>);
        break;
      case 'preview':
        // 7.7: direkt an das Fenster, nicht über Abbild und Kurzform (bis zu 2 Bilder/s je Slot).
        vorschauEreignis(ev as unknown as VorschauEreignis);
        return;
      case 'speakerConfig':
      case 'previewMode':
        break;
    }
    abbildGeaendert();
  }

  /** Spec 6.1 „Einrichtung prüfen“: Startfolge ohne join, Zustand bleibt bereit. */
  async function pruefen(): Promise<ZoomErgebnis> {
    if (zustand !== 'bereit' || pruefungLaeuft) return { ok: false, text: '' };
    const lauf = laufNr;
    pruefungLaeuft = true;
    meldung = null;
    d.log('[zoom] Einrichtung prüfen');
    abbildGeaendert();
    const r = await starteBridge();
    if (r.ok) await stoppeBridge();
    pruefungLaeuft = false;
    if (lauf !== laufNr) {
      abbildGeaendert();
      return { ok: false, text: '' };
    }
    if (r.ok) {
      melde('info', { text: KT.PRUEFUNG_OK, detail: null });
      abbildGeaendert();
      return { ok: true };
    }
    if (r.mangel !== null) mangelFolgen();
    melde('fehler', r.meldung);
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
    return { ok: false, text: r.meldung.text };
  }

  // ── Beitritt (Spec 6.2) ──────────────────────────────────────────────────
  function scheitert(m: Meldungstext): void {
    melde('fehler', m);
    void stoppeBridge();
    setzeZustand('fehler');
  }

  async function starteBeitritt(): Promise<ZoomErgebnis> {
    if (nummer === null) return { ok: false, text: '' };
    const lauf = laufNr;
    const name = d.einstellungen.anzeigename();
    meldung = null;
    r5Offen = false;
    d.log(`[zoom] Beitritt gestartet (Anzeigename „${name}“)`);
    setzeZustand('startet');
    const r = await starteBridge();
    if (lauf !== laufNr) return { ok: false, text: '' };
    if (!r.ok) {
      if (r.mangel !== null) mangelFolgen();
      melde('fehler', r.meldung);
      setzeZustand(r.mangel !== null ? 'einrichtung' : 'fehler');
      return { ok: false, text: r.meldung.text };
    }
    sende({ cmd: 'join', meetingId: nummer.normiert, passcode: kenncode ?? '', displayName: name });
    setzeZustand('tritt_bei');
    return { ok: true };
  }

  async function beitreten(e: { nummer: string; kenncode: string; anzeigename: string }): Promise<ZoomErgebnis> {
    if (zustand === 'einrichtung') return maengel.length ? { ok: false, text: mangelText(maengel[0], mangelDatei()) } : { ok: false, text: '' };
    if (!((zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler')) return { ok: false, text: '' };
    let normiert: string;
    try {
      normiert = normalizeMeetingId(e.nummer);
    } catch {
      return { ok: false, text: KT.N0 };
    }
    const name = e.anzeigename.trim();
    if (name.length < 1 || name.length > 64) return { ok: false, text: KT.N0b };
    d.einstellungen.setzeAnzeigename(name);
    // Leeres Feld + dieselbe Nummer (egal wie geschrieben) → gemerkter Kenncode; sonst leer (#290).
    let wirksam = e.kenncode;
    if (wirksam === '' && gemerkt) {
      let gleich = false;
      try {
        gleich = normalizeMeetingId(gemerkt.nummer) === normiert;
      } catch {
        gleich = false;
      }
      if (gleich) wirksam = gemerkt.kenncode ?? '';
    }
    // Merken ist eine Bequemlichkeit: Ein Wurf (Datei, Verschlüsselung) blockiert den Beitritt nie, er zählt als nicht gespeichert.
    let merk: { kenncodeGespeichert: boolean };
    try {
      merk = d.einstellungen.meetingMerken(e.nummer, wirksam);
    } catch {
      merk = { kenncodeGespeichert: false };
    }
    // Dieselbe Regel wie settings.ts: Eine Nummer, die gueltigeLetzteNummer verwirft, merkt auch der Kern nicht (die Datei löscht beide Felder).
    const gemerkteNummer = gueltigeLetzteNummer(e.nummer);
    gemerkt = gemerkteNummer === null ? null : { nummer: gemerkteNummer, kenncode: wirksam === '' ? null : wirksam };
    kenncodeNichtGespeichert = gemerkt !== null && wirksam !== '' && !merk.kenncodeGespeichert;
    nummer = { eingabe: e.nummer, normiert };
    kenncode = wirksam;
    sitzungsEnde('beitritt');
    // N4b.3 Nr. 6, L15: Hinweise gehören zum letzten Meeting; „Erneut beitreten“ behält sie.
    hinweise.length = 0;
    return starteBeitritt();
  }

  function letztesMeeting(): ZoomLetztesMeeting {
    return { nummer: gemerkt?.nummer ?? null, kenncodeGespeichert: !!gemerkt?.kenncode, kenncodeNichtGespeichert };
  }

  function vergessen(): ZoomErgebnis {
    // Die Speicherkopie ist in jedem Fall leer; ob die Platte folgte, sagt das Ergebnis (Muster zugangLoeschen).
    gemerkt = null;
    kenncodeNichtGespeichert = false;
    let geloescht: boolean;
    try {
      geloescht = d.einstellungen.meetingVergessen();
    } catch {
      geloescht = false;
    }
    return geloescht ? { ok: true } : { ok: false, text: TEXT_VERGESSEN_FEHLER };
  }

  async function erneut(): Promise<ZoomErgebnis> {
    if (nummer === null || !((zustand === 'bereit' && !pruefungLaeuft) || zustand === 'fehler')) return { ok: false, text: '' };
    return starteBeitritt();
  }

  function imMeetingAngekommen(): void {
    erlaubnis = 'offen';
    setzeZustand('im_meeting');
    abgleichPlanen();
  }

  function zumWarteraum(s: 'waitingRoom' | 'waitingForHost'): void {
    warten = s === 'waitingRoom' ? 'warteraum' : 'host';
    setzeZustand('warteraum');
  }

  /** Spec 6.5: Meeting-Ende durch den Host (nur aktive Bridge, nicht im Abbau). */
  function meetingEnde(code: number): void {
    const m = endeMeldung(code, d.einstellungen.anzeigename());
    // L4: auch während eines Versuchs ist ended ein Meeting-Ende, die Folge endet.
    folgeBeenden();
    void stoppeBridge();
    // L12: Mit ended sind die Sender der aktiven Generation weg (n = 0 in Z2); die Bridge baut sie ohnehin selbst ab.
    for (const x of slots.values()) if (x.bridge?.gen === aktiveGen) senderWeg(x);
    sitzungsEnde('meetingEnde');
    melde('warnung', m);
    setzeZustand('bereit');
  }

  function statusEreignis(e: StatusEreignis): void {
    const s = e.status;
    const name = d.einstellungen.anzeigename();
    if (s === 'ended') {
      if (zustand === 'tritt_bei' || zustand === 'warteraum' || zustand === 'im_meeting' || zustand === 'abriss') meetingEnde(e.code);
      return;
    }
    if (zustand === 'tritt_bei' || zustand === 'warteraum') {
      if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
      // Gemessener Einlass aus dem Warteraum (3.2-19): kein Abriss, kein Alarm.
      else if ((s === 'reconnecting' || s === 'connecting') && zustand === 'warteraum') setzeZustand('tritt_bei');
      else if (s === 'inMeeting') imMeetingAngekommen();
      else if (s === 'failed') scheitert(failMeldung(VORSATZ.beitritt, e.code, name));
      return;
    }
    if (zustand === 'abriss' && folge !== null) {
      // 6.4 Schritt 2.4: Ausgang des laufenden Versuchs (Z11); connecting und reconnecting ändern nichts.
      if (s === 'inMeeting') versuchErfolgreich();
      else if (s === 'waitingRoom' || s === 'waitingForHost') {
        // Angekommen: keine weiteren Versuche, ab hier gilt 6.2 Schritt 5 (Einlass, reconnectTimeout → CE).
        d.log(`[zoom] Wiederbeitritt: Versuch ${folge.versuch} erfolgreich nach ${Date.now() - folge.beginn} ms`);
        folgeBeenden();
        zumWarteraum(s);
      } else if (s === 'failed') {
        versuchGescheitert({ art: 'failed', code: e.code }, { text: failText(e.code, name), detail: failMeldung(VORSATZ.wiederbeitritt, e.code, name).detail });
      }
      return;
    }
    if (zustand === 'im_meeting' || zustand === 'abriss') {
      if (s === 'reconnecting' || s === 'connecting') {
        if (zustand === 'im_meeting') setzeZustand('abriss');
      } else if (s === 'inMeeting') {
        if (zustand === 'abriss') {
          // Erst planen, dann den Zustand setzen (Prüfung Code Q8, Befund 1): setzeZustand schickt sofort ein Abbild. Ohne
          // geplanten Abgleich zeigte es nach Q8 oder einem Ladefehler in Z10 kurz „… bitte von Hand laden“, obwohl der Abgleich
          // die Person gleich neu lädt („wird geladen …“ hat Vorrang).
          abgleichPlanen();
          setzeZustand('im_meeting');
        }
      } else if (s === 'waitingRoom' || s === 'waitingForHost') zumWarteraum(s);
      else if (s === 'failed') {
        // 6.4: ein endgültiger Code endet mit „Verbindung verloren: “, jeder andere startet den Wiederbeitritt.
        const m = failMeldung(VORSATZ.verbindung, e.code, name);
        if (istEndgueltig({ art: 'failed', code: e.code })) scheitert(m);
        else starteWiederbeitritt({ text: failText(e.code, name), detail: m.detail });
      }
    }
  }

  /** Spec 6.2 Schritt 6, Tabelle. */
  function privilegEreignis(e: PrivilegEreignis): void {
    const vorher = erlaubnis;
    if (e.canRecordRaw) erlaubnis = 'ja';
    else if (e.denied) erlaubnis = 'abgelehnt';
    else if (e.timedOut) erlaubnis = 'abgelaufen';
    else if (e.source === 'broadcast') {
      if (vorher === 'ja') erlaubnis = 'entzogen';
    } else if (e.source === 'check' && e.requested) erlaubnis = 'offen';
    if (erlaubnis === vorher) return;
    d.log(`[zoom] Aufnahme-Erlaubnis: ${erlaubnis}`);
    if (erlaubnis === 'ja') abgleichPlanen();
    // 7.1 (W6): Mit dem Entzug ist das Ton-Abo abgemeldet (6.15), der Merker fällt.
    if (erlaubnis === 'entzogen') tonAboFehler = null;
  }

  function fehlerEreignis(e: FehlerEreignis): void {
    if (e.where === 'slot' || e.where === 'audio' || e.where === 'video') {
      slotFehlerEreignis(e);
      return;
    }
    const name = e.name ?? String(e.code);
    if (e.where === 'privilege') {
      melde('warnung', { text: KT.Q12(name), detail: fehlerDetail(e) });
      return;
    }
    const amBeitreten = zustand === 'tritt_bei' || zustand === 'warteraum';
    // Z11: Fehler der Versuchs-Bridge sind Ausgänge des Versuchs (6.4 Schritt 2.4), keine neuen Auslöser.
    const imVersuch = zustand === 'abriss' && folge !== null;
    const imMeeting = zustand === 'im_meeting' || zustand === 'abriss';
    if (e.where === 'join' && e.code === 'joinTimeout') {
      if (amBeitreten) scheitert({ text: KT.CT, detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'joinTimeout' }, { text: KT.CT, detail: fehlerDetail(e) });
    } else if (e.where === 'join' && typeof e.code === 'number') {
      if (amBeitreten) scheitert({ text: KT.CJ(name), detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'joinFehler' }, { text: KT.CJ(name), detail: fehlerDetail(e) });
    } else if (e.where === 'meeting' && e.code === 'reconnectTimeout') {
      if (amBeitreten) scheitert({ text: KT.CE, detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'reconnectTimeout' }, { text: KT.CT, detail: fehlerDetail(e) });
      // 6.4: In Z10 hat Zoom selbst nicht neu verbunden: Wiederbeitritt.
      else if (zustand === 'abriss') starteWiederbeitritt(null);
    } else if (e.where === 'exit' && e.code === 'exited') {
      const exitCode = exitCodeAus(e.detail);
      const dll = dllMeldung(exitCode);
      const detail = e.detail ?? fehlerDetail(e);
      // Spec 6.2 Schritt 5 und 8.3: im Beitritt gilt CB, nicht B3–B5 — die nennt 8.2 nur für den Tod vor `auth`.
      if (amBeitreten) scheitert({ text: KT.CB(detail), detail: fehlerDetail(e) });
      else if (imVersuch) versuchGescheitert({ art: 'exited', exitCode }, { text: KT.CB(detail), detail: fehlerDetail(e) });
      // 6.4: Die drei DLL-Rückgabewerte sind endgültig (B3–B5); jeder andere Tod im Meeting startet den Wiederbeitritt mit R4.
      else if (imMeeting && dll) scheitert(dll);
      else if (imMeeting) {
        hinweis(KT.R4(detail));
        starteWiederbeitritt(null);
      }
    }
  }

  /** Spec 6.8 „Verlassen“: Z3–Z11, ohne Fehler und ohne Alarm. */
  async function verlassen(): Promise<void> {
    if (!(zustand === 'startet' || zustand === 'tritt_bei' || zustand === 'warteraum' || zustand === 'im_meeting' || zustand === 'abriss')) return;
    laufNr += 1;
    // 6.8: Wiederbeitritts-Zeitgeber löschen; ein laufender Versuch verwirft sein Ergebnis (laufNr).
    folgeBeenden();
    d.log('[zoom] Meeting verlassen');
    // Ruling 08.10.2026, Slot-Spec 7.3 Nr. 8: Die Sitzung der Slots endet VOR Z12 und vor dem Warten auf die Bridge (bis 5 s,
    // hängt sie, bis killTimeoutMs). Im Abbau startet nichts: der Abgleich verlangt im_meeting, Ereignisse der Bridge im Abbau
    // gehen an abbauEreignis.
    sitzungsEnde('verlassen');
    setzeZustand('verlaesst');
    await stoppeBridge();
    nummer = null;
    kenncode = null;
    meldung = null;
    setzeZustand(maengel.length ? 'einrichtung' : 'bereit');
  }

  // ── Wiederbeitritt (Spec 6.4) ────────────────────────────────────────────
  /** Schritt 1: Die alte Bridge stoppen (ab jetzt im Abbau, 6.9), Zustand abriss, Versuch 1 planen. */
  function starteWiederbeitritt(anlass: Meldungstext | null): void {
    if (folge !== null) return;
    void stoppeBridge();
    // Der Anlass wäre sonst nirgends zu sehen (kein Leser außer R2 nach Versuch 5, und dort überschrieben).
    if (anlass !== null) d.log(`[zoom] Wiederbeitritt: Anlass: ${anlass.text}${anlass.detail ? ` [${anlass.detail}]` : ''}`);
    folge = { versuch: 1, naechsterUm: null, zeitgeber: null, letzte: anlass, beginn: 0 };
    planeVersuch(1);
  }

  /** Schritt 2.1: Versuch i nach plan[i - 1] ms; das Abbild zeigt den Countdown über `naechsterUm`. */
  function planeVersuch(i: number): void {
    if (folge === null) return;
    const ms = plan[i - 1] ?? 0;
    folge.versuch = i;
    folge.naechsterUm = Date.now() + ms;
    d.log(`[zoom] Wiederbeitritt: Versuch ${i} von ${WIEDERBEITRITT_VERSUCHE} in ${ms / 1000} s`);
    folge.zeitgeber = zeitgeber(ms, () => {
      if (folge === null) return;
      folge.zeitgeber = null;
      const lauf = laufNr;
      versuchStarten(i).catch((err: unknown) => versuchAusnahme(i, lauf, err));
    });
    setzeZustand('abriss');
  }

  /**
   * Eine Ausnahme in der Startfolge eines Versuchs (lz.pruefe, Bridge-Fabrik, buildJwt, Einstellungen) beendet die Folge
   * wie ein endgültiger Fehler. Ohne das bliebe Z11 für immer auf „läuft …“, und niemand sähe den Grund.
   */
  function versuchAusnahme(i: number, lauf: number, err: unknown): void {
    const grund = err instanceof Error ? err.message : String(err);
    d.log(`[zoom] Wiederbeitritt: Versuch ${i}: Ausnahme in der Startfolge: ${grund}`);
    // Verlassen, Abbrechen oder Beenden in der Zwischenzeit: Die Folge ist schon beendet.
    if (folge === null || folge.versuch !== i || lauf !== laufNr) return;
    d.log(`[zoom] Wiederbeitritt: Versuch ${i} gescheitert nach ${Date.now() - folge.beginn} ms (endgültig)`);
    folgeBeenden();
    scheitert({ text: VORSATZ.wiederbeitritt + grund, detail: null });
  }

  /** Schritte 2.2 und 2.3: Startfolge mit neuer Bridge, dann join. Der Zustand bleibt abriss mit versuch i. */
  async function versuchStarten(i: number): Promise<void> {
    if (folge === null) return;
    const lauf = laufNr;
    folge.naechsterUm = null;
    folge.beginn = Date.now();
    abbildGeaendert();
    const r = await starteBridge();
    // Verlassen, Abbrechen oder Beenden während der Startfolge: kein weiterer Schritt, keine Meldung.
    if (folge === null || folge.versuch !== i || lauf !== laufNr || nummer === null) return;
    if (!r.ok) {
      if (r.mangel !== null) {
        // Schritt 2.4 „Mangel aus der Startfolge“ (Einordnung: endgültig): Zustand einrichtung (5.3), die Folge endet.
        d.log(`[zoom] Wiederbeitritt: Versuch ${i} gescheitert nach ${Date.now() - folge.beginn} ms (endgültig)`);
        folgeBeenden();
        mangelFolgen();
        melde('fehler', r.meldung);
        setzeZustand('einrichtung');
        return;
      }
      if (r.ausgang !== null) versuchGescheitert(r.ausgang, r.meldung);
      return;
    }
    if (imAbbau.has(r.gen)) return;
    sende({ cmd: 'join', meetingId: nummer.normiert, passcode: kenncode ?? '', displayName: d.einstellungen.anzeigename() });
  }

  /** Schritt 2.4 „inMeeting“: Erfolg. Der Abgleich lädt die Soll-Liste, sobald die Erlaubnis da ist; danach R5 (L3). */
  function versuchErfolgreich(): void {
    if (folge === null) return;
    d.log(`[zoom] Wiederbeitritt: Versuch ${folge.versuch} erfolgreich nach ${Date.now() - folge.beginn} ms`);
    folgeBeenden();
    r5Offen = true;
    imMeetingAngekommen();
  }

  /** Schritte 2.4 und 3: einordnen. Endgültig → fehler; vorübergehend → nächster Versuch; nach dem letzten R2. */
  function versuchGescheitert(a: VersuchsAusgang, m: Meldungstext): void {
    if (folge === null) return;
    const i = folge.versuch;
    const endgueltig = istEndgueltig(a);
    d.log(`[zoom] Wiederbeitritt: Versuch ${i} gescheitert nach ${Date.now() - folge.beginn} ms (${endgueltig ? 'endgültig' : 'vorübergehend'})`);
    d.log(`[zoom] Wiederbeitritt: Versuch ${i} Grund: ${m.text}${m.detail ? ` [${m.detail}]` : ''}`);
    if (endgueltig) {
      folgeBeenden();
      // 6.4 Schritt 2.4: jeder endgültige Fehler im Versuch bekommt „Wiederbeitritt abgebrochen: “, auch der DLL-Tod (dann B3–B5).
      const t = (a.art === 'exited' ? dllMeldung(a.exitCode) : null) ?? m;
      scheitert({ text: VORSATZ.wiederbeitritt + t.text, detail: t.detail });
      return;
    }
    folge.letzte = m;
    if (i >= WIEDERBEITRITT_VERSUCHE) {
      const letzte = folge.letzte;
      folgeBeenden();
      scheitert({ text: KT.R2(letzte.text), detail: letzte.detail });
      return;
    }
    void stoppeBridge();
    planeVersuch(i + 1);
  }

  /** Zeitgeber löschen, Folge vergessen (G17). */
  function folgeBeenden(): void {
    if (folge?.zeitgeber) clearTimeout(folge.zeitgeber);
    folge = null;
  }

  /** Spec 6.8 „Abbrechen“ (nur Z11): Zeitgeber weg, Versuchs-Bridge stoppen, fehler mit R7; Soll, Nummer, Kenncode bleiben. */
  function abbrechen(): void {
    if (zustand !== 'abriss' || folge === null) return;
    // Eine laufende Startfolge verwirft ihr Ergebnis (wie Verlassen).
    laufNr += 1;
    folgeBeenden();
    d.log('[zoom] Wiederbeitritt abgebrochen');
    scheitert({ text: KT.R7, detail: null });
  }

  // ── Slots: Ereignisse, Abgleich, Bedienung (Slot-Spec 7.1–7.3; Plan B, Task B12) ──
  /** Die Antwortfrist eines gesendeten slotOn ist erledigt (Ereignis, Fehler, neue Bridge, Sitzungsende). */
  function fristBeantwortet(x: SlotIntern): void {
    if (x.frist === null) return;
    clearTimeout(x.frist);
    x.frist = null;
  }

  /** Der Sender des Slots ist weg (slot off, Abbau der Generation, Meeting-Ende). */
  function senderWeg(x: SlotIntern): void {
    x.bridge = null;
    x.ton = null;
    x.slotOffGesendet = false;
    x.gesendet = null;
    // 10.7 (B55): Messzeile und Messwerte gehören zum Sender.
    x.mess = null;
    messwerte.slots = messwerte.slots.filter((m) => m.slot !== x.e.nr);
    x.log.art = '';
    loeschenWennFrei(x);
  }

  /** Fehlerzeile (10.9), Klartext für T23 und Fehlername für T20c fallen: „Stopp“/„Start“, neue Bridge, Sitzungsende. */
  function fehlerWeg(x: SlotIntern): void {
    x.fehler = null;
    x.gescheitertText = null;
    x.aboFehlerName = null;
  }

  /**
   * `zoom_unload` (7.2): Ein vorübergehender Slot verschwindet, sobald kein Sender und keine Antwortfrist mehr besteht. Ist sein
   * slotOn dann noch unbeantwortet (Fristablauf), geht zuerst slotOff hinaus und die Nummer bleibt reserviert (Nachtrag B, I-5).
   */
  function loeschenWennFrei(x: SlotIntern): void {
    if (!x.loeschen || x.bridge !== null || x.frist !== null || slots.get(x.e.nr) !== x) return;
    slotEntfernen(x, true);
    d.log(`[zoom] Slot ${x.e.nr} gelöscht (vorübergehend)`);
  }

  /**
   * Löscht einen Slot für den Bediener sofort (Karte, Zählung, STATE). Hält oder baut die Bridge für ihn noch einen Sender
   * (Sender bekannt oder ein slotOn unbeantwortet), bleibt seine Nummer verdeckt reserviert (Nachtrag B, I-2), und mit
   * `mitSlotOff` geht vorher slotOff hinaus (I-5, I-6): Die Bridge arbeitet der Reihe nach, das slotOff stoppt also auch einen
   * Sender, den das unbeantwortete slotOn erst noch baut, oder sie antwortet slotNotOn. Ohne `mitSlotOff` (Sitzungsende) wird
   * die Bridge ohnehin gestoppt; die Reservierung endet mit ihrer Generation.
   */
  function slotEntfernen(x: SlotIntern, mitSlotOff: boolean): void {
    const nr = x.e.nr;
    fristBeantwortet(x);
    if (slots.get(nr) === x) slots.delete(nr);
    const gen = x.bridge?.gen ?? (x.slotOnOffen.length > 0 ? aktiveGen : null);
    if (gen === null) return;
    // Eine bestehende Reservierung bleibt (Nachtrag C, R15): Hat fremderSender für diese Nummer schon slotOff geschickt, geht kein
    // zweites hinaus (I-3, einmal je Sender).
    const r = reserviert.get(nr) ?? { gen, slotOff: x.slotOffGesendet };
    reserviert.set(nr, r);
    if (!mitSlotOff || r.slotOff || gen !== aktiveGen || !sende({ cmd: 'slotOff', slot: nr })) return;
    r.slotOff = true;
    d.log(`[zoom] Slot ${nr} wird gestoppt (Antwort steht aus)`);
  }

  /**
   * I-3, I-4 (Nachtrag B): Die Bridge meldet unter `nr` einen Sender, der keinem Connect-Slot gehört. Die Nummer bleibt
   * reserviert; slotOff geht einmal je Sender hinaus, keine Flut. Die Logzeile nennt nur Nummer und Anlass (GG21).
   */
  function fremderSender(nr: number, anlass: string): void {
    let r = reserviert.get(nr);
    if (r === undefined) {
      r = { gen: aktiveGen, slotOff: false };
      reserviert.set(nr, r);
    }
    if (r.slotOff || !sende({ cmd: 'slotOff', slot: nr })) return;
    r.slotOff = true;
    d.log(`[zoom] Slot ${nr}: fremder Sender (${anlass}), wird gestoppt`);
  }

  /** Die Bridge hält unter `nr` nachweislich keinen Sender mehr (slot off, slotNotOn): Nummer frei; ein eingeschalteter Slot plant neu (I-4). */
  function reservierungFrei(nr: number): void {
    if (!reserviert.delete(nr)) return;
    d.log(`[zoom] Slot ${nr}: Nummer wieder frei`);
    if (slots.get(nr)?.e.an) abgleichen();
  }

  /**
   * Sitzungsende für alle Slots (Slot-Spec 7.2, 7.3 Nr. 2, 5, 7, 8; RR1, RR7): Meeting-Ende, „Verlassen“, „Schließen“, neuer
   * Beitritt, Beenden und ein Mangel der Einrichtung. Sitzung, Frist und Fehlerstand fallen, die Beitrittsfolge beginnt neu;
   * vorübergehende Slots verschwinden, `anNurMeeting` geht aus (gespeichert war schon `an: false`).
   */
  function sitzungsEnde(ereignis: SitzungsEreignis): void {
    for (const [nr, x] of slots) {
      fristBeantwortet(x);
      fehlerWeg(x);
      x.s = sitzungNach(x.s, ereignis);
      const folgen = slotEndetMitMeeting(x, ereignis);
      // Nachtrag B (I-2): ohne slotOff, die Bridge wird ohnehin gestoppt; die Nummer bleibt bis zum Ende ihrer Generation reserviert.
      if (folgen === 'loeschen') slotEntfernen(x, false);
      else if (folgen === 'ausschalten') {
        x.e = { ...x.e, an: false };
        x.anNurMeeting = false;
      }
    }
    folgeJe.clear();
    folgeZaehler = 0;
    tonAboFehler = null;
    r5Offen = false;
    messwerteLeeren();
    // 7.4: Gehen vorübergehende Slots und `anNurMeeting` mit dem Meeting, verfällt die Zustimmung wie bei jedem Ausschalten.
    zustimmungPruefen();
  }

  /**
   * Messwerte, die zu einer Bridge und einem Meeting gehören (7.8): die Uhr der Freigabe-Rückrufe und die Sprecher-Wechsel (B16),
   * dazu ab Nachtrag B (NB17, NB18) Prozess-Messwerte, Freigaben, Sprecher-Signale samt Uhrzeiten, Lücken und die Rückkehr je
   * Slot (T62c). Jede neue Bridge und jedes Sitzungsende leeren sie; die Messwerte je Slot fallen mit dem Sender (senderWeg).
   */
  function messwerteLeeren(): void {
    rueckrufBis = -1;
    rueckrufZeiten.clear();
    sprecherWechsel = [];
    letzterSprecher = 0;
    messwerte.bridge = null;
    messwerte.freigaben = null;
    messwerte.sprecherSignale = [];
    sprecherZeiten = [];
    luecken = [];
    letzteLueckeJe.clear();
    for (const x of slots.values()) {
      x.rueckkehr = null;
      x.wegPersistentId = null;
    }
  }

  /** Dauerhafte Slots auf die Platte (7.2); false → nur diese Sitzung (T92). */
  function speichern(): void {
    schreibErgebnis(d.einstellungen.setzeSlots(slotsFuerPlatte([...slots.values()].sort((a, b) => a.e.nr - b.e.nr))));
  }

  /**
   * Ein Setter der Einstellungen meldete false: Die Werte gelten nur für diese Sitzung (T92). Die Anzeige leitet abbild() aus
   * settings.ts ab (NB9); hier steht nur die Logzeile, einmal, bis settings.ts wieder alles gespeichert meldet.
   */
  function schreibErgebnis(ok: boolean): void {
    if (ok) {
      if (d.einstellungen.einstellungsLage().nurSitzung !== true) nurSitzungGeloggt = false;
      return;
    }
    if (!nurSitzungGeloggt) d.log('[zoom] Slots nur für diese Sitzung gemerkt (Einstellungsdatei nicht schreibbar)');
    nurSitzungGeloggt = true;
  }

  /**
   * Beitrittsfolge und Weggang (7.3 Nr. 5): roster setzt alle auf 0 (neue Kennungen), joined zählt weiter, left merkt wegSeq;
   * renamed der gezeigten Person setzt `personJetzt` für dieses Meeting (Nr. 6).
   */
  function teilnehmerEreignis(ev: BridgeEvent): void {
    const e = ev as unknown as { list?: Participant[]; p?: Participant; id?: number; name?: unknown };
    if (ev.ev === 'roster') {
      folgeJe.clear();
      folgeZaehler = 0;
      persistentIds.clear();
      for (const p of e.list ?? []) {
        if (p.self) continue;
        folgeJe.set(p.id, 0);
        persistentIds.set(p.id, p.persistentId);
      }
      // Neue Kennungen (etwa nach Z10): gewaehlteId, wegSeq und personJetzt gelten nicht mehr (7.3 Nr. 5).
      for (const x of slots.values()) x.s = sitzungNach(x.s, 'z10Roster');
    } else if (ev.ev === 'joined' && e.p && !e.p.self) {
      folgeZaehler += 1;
      folgeJe.set(e.p.id, folgeZaehler);
      persistentIds.set(e.p.id, e.p.persistentId);
    } else if (ev.ev === 'left' && typeof e.id === 'number') {
      for (const x of slots.values()) {
        if (x.s.gewaehlteId !== e.id) continue;
        x.s = { ...x.s, wegSeq: folgeZaehler };
        x.wegPersistentId = persistentIds.get(e.id) ?? '';
      }
    } else if (ev.ev === 'renamed' && typeof e.id === 'number' && typeof e.name === 'string') {
      for (const x of slots.values()) if (x.s.gewaehlteId === e.id) x.s = { ...x.s, personJetzt: e.name };
    }
  }

  /** slotStats (7.8, 10.7): Messwerte je laufendem Slot und die Messzeile seiner Kachel. */
  function slotStatsEreignis(e: ZoomMesswerte['slots'][number]): void {
    const x = slots.get(e.slot);
    if (x === undefined || x.bridge === null) return;
    messwerte.slots = [...messwerte.slots.filter((m) => m.slot !== e.slot), e].sort((a, b) => a.slot - b.slot);
    const geliefert = e.w !== undefined && e.h !== undefined && e.fps !== undefined ? { b: e.w, h: e.h, fps: e.fps } : null;
    // NB16 (Nachtrag B): ohne jede Größe im slotStats bleibt die bekannte letzte Größe dieses Ziels stehen.
    const zuletzt = geliefert !== null ? { b: geliefert.b, h: geliefert.h }
      : e.lastW !== undefined && e.lastH !== undefined ? { b: e.lastW, h: e.lastH } : x.mess?.zuletzt ?? null;
    x.mess = { geliefert, zuletzt };
    // T66: jede neue Lücke eines Sprecher-Slots.
    if (x.e.modus === 'sprecher' && e.gapMs !== undefined && letzteLueckeJe.get(e.slot) !== e.gapMs) {
      letzteLueckeJe.set(e.slot, e.gapMs);
      luecken = [...luecken, { ms: e.gapMs, ungeprueft: e.gapUngeprueft === true }].slice(-SPRECHER_SIGNALE_MAX);
    }
    // 7.8: je laufendem Slot jede Minute eine Zeile mit den Messwerten.
    const jetzt = Date.now();
    if (jetzt - x.log.minute >= LOG_MINUTE_MS) {
      x.log.minute = jetzt;
      d.log(slotLogZeile(x));
    }
  }

  /** Logzeile eines Slots (7.8): Nummer, Modus, Zustand, Grund, `sent`, Messwerte, Ton und Zähler; nie ein Name (0.23). */
  function slotLogZeile(x: SlotIntern): string {
    const b = x.bridge;
    const m = messwerte.slots.find((s) => s.slot === x.e.nr);
    const w = (v: number | undefined): string => (v === undefined ? '-' : String(v));
    const teile = [
      `${b?.state ?? 'off'}/${b?.reason ?? '-'}`, `sent ${b?.sent ?? '-'}`, `${w(m?.w)}×${w(m?.h)}`, `fps ${w(m?.fps)}`,
      `fallbackFps ${w(m?.fallbackFps)}`, `workUs ${w(m?.workUs)}`, `copyUs ${w(m?.copyUs)}`, `previewUs ${w(m?.previewUs)}`,
      `memKb ${w(m?.memKb)}`, `resSet ${w(m?.resSet)}`, `resGot ${w(m?.resGot)}`, `rawType ${w(m?.rawType)}`,
      `Ton ${x.ton?.source ?? 'none'}/${x.ton?.configured ?? 'none'}`, `audioPps ${w(m?.audioPps)}`, `mixDrops ${w(m?.mixDrops)}`,
      `mixSilenceMs ${w(m?.mixSilenceMs)}`, `foreignFrames ${w(m?.foreignFrames)}`, `lateFrames ${w(m?.lateFrames)}`,
      `tooFrequent ${w(m?.tooFrequent)}`, `noShareData ${w(m?.noShareData)}`, `rendererNew ${w(m?.rendererNew)}`, `rendererLost ${w(m?.rendererLost)}`,
    ];
    return `[zoom] Slot ${x.e.nr} (${x.e.modus}): ${teile.join(' · ')}`;
  }

  /** bridgeStats (7.8): Messwerte im Abbild, jede Minute eine Logzeile mit allen Feldern (ohne Namen). */
  function bridgeStatsEreignis(e: NonNullable<ZoomMesswerte['bridge']>): void {
    messwerte.bridge = e;
    const jetzt = Date.now();
    if (jetzt - bridgeLogZeit < LOG_MINUTE_MS) return;
    bridgeLogZeit = jetzt;
    d.log(`[zoom] Zoom-Bridge: ${Object.entries(e).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(' · ')}`);
  }

  /** shares (7.8): Freigaben im Abbild; jeder neue Freigabe-Rückruf eine Logzeile mit Zustand, Kennungen und Typ. */
  function freigabenEreignis(e: NonNullable<ZoomMesswerte['freigaben']>): void {
    messwerte.freigaben = e;
    for (const k of [...rueckrufZeiten.keys()]) if (!e.recent.some((r) => r.ms === k)) rueckrufZeiten.delete(k);
    for (const r of e.recent) {
      if (r.ms <= rueckrufBis) continue;
      rueckrufBis = r.ms;
      // 6.3: Die Bridge meldet shares bei jedem Freigabe-Rückruf; der Empfang ist die Uhrzeit des Rückrufs in T63c.
      rueckrufZeiten.set(r.ms, Date.now());
      d.log(`[zoom] Freigabe-Rückruf: ${r.cb} ${r.status} (Person ${r.user}, Freigabe ${r.share}, Typ ${r.type})`);
    }
  }

  /** Sprecher-Signale gebündelt, höchstens eine Logzeile je Sekunde, nur mit Kennungen (7.8). */
  function sprecherLoggen(e: { signal: SpeakerSignal; ids: number[] }): void {
    sprecherGesammelt.push(`${e.signal} ${e.ids.join(',') || '-'}`);
    if (sprecherLogTimer !== null) return;
    const schreiben = (): void => {
      sprecherLogTimer = null;
      sprecherLogZeit = Date.now();
      d.log(`[zoom] Sprecher-Signale: ${sprecherGesammelt.join(' · ')}`);
      sprecherGesammelt = [];
    };
    const rest = sprecherLogZeit + LOG_SPRECHER_MS - Date.now();
    if (rest <= 0) schreiben();
    else sprecherLogTimer = zeitgeber(rest, schreiben);
  }

  /** speakerSignal (7.8): die letzten SPRECHER_SIGNALE_MAX Signale mit den Namen der Kennungen (nur für die Anzeige, 0.23). */
  function sprecherSignalEreignis(e: Omit<ZoomMesswerte['sprecherSignale'][number], 'namen'>): void {
    const namen = e.ids.map(nameVon).filter((n): n is string => n !== null);
    messwerte.sprecherSignale = [...messwerte.sprecherSignale, { ...e, namen }].slice(-SPRECHER_SIGNALE_MAX);
    sprecherZeiten = [...sprecherZeiten, Date.now()].slice(-SPRECHER_SIGNALE_MAX);
    sprecherLoggen(e);
  }

  function slotEreignis(e: SlotEreignis): void {
    const x = slots.get(e.slot);
    // I-2, I-3 (Nachtrag B): Für eine Nummer ohne Connect-Slot oder mit fremdem Sender gibt es keine Lage, nur slotOff bzw. das
    // Ende der Reservierung (danach plant ein eingeschalteter Slot dieser Nummer neu).
    if (x === undefined || reserviert.has(e.slot)) {
      if (x !== undefined) fristBeantwortet(x);
      if (e.state === 'off') reservierungFrei(e.slot);
      else fremderSender(e.slot, e.state);
      return;
    }
    fristBeantwortet(x);
    if (e.state === 'off') {
      // Die Bridge arbeitet der Reihe nach: Nach diesem slot off baut kein früher gesendetes slotOn mehr einen Sender.
      x.slotOnOffen = [];
      senderWeg(x);
      if (e.reason === 'privilegeRevoked') {
        d.log(`[zoom] Slot ${e.slot} gestoppt (Entzug)`);
        // 7.3 „Auslöser“, B14: Die Erlaubnis flatterte; der Abbau kam nach der Wiedererteilung und ihrem Abgleich (PK28).
        if (zustand === 'im_meeting' && erlaubnis === 'ja') abgleichPlanen();
      }
      // „Stopp“ und „Start“ kurz nacheinander: Erst jetzt ist der Sender weg, der Abgleich startet den Slot neu.
      if (e.reason === 'command' && x.e.an) abgleichen();
      r5Pruefen();
      return;
    }
    const vorher = x.bridge;
    if (e.ndi !== x.e.ndiName) {
      // I-3 (Nachtrag B): Ein Sender mit anderem NDI-Namen gehört nicht zu diesem Slot (etwa die späte Antwort auf ein slotOn mit
      // dem alten Namen). Er wird nicht übernommen; ohne bekannten Sender ist er die Antwort auf das älteste offene slotOn.
      if (vorher === null) x.slotOnOffen.shift();
      else senderWeg(x);
      fremderSender(e.slot, e.state);
      r5Pruefen();
      return;
    }
    // I-1: Die erste Antwort übernimmt die Einstellung des ältesten offenen slotOn; danach zieht nachziehen() nach.
    if (vorher === null) x.gesendet = x.slotOnOffen.shift() ?? { ...x.e };
    // NB13: Kommt der Sender nach der Frist doch noch, gilt „keine Antwort“ nicht mehr (sonst startete er nach seinem Ende nie neu).
    if (x.s.fehlerstand === 'keine_antwort') x.s = { ...x.s, fehlerstand: null };
    // 10.7 (B55): neues Ziel, neue Freigabe oder neuer Modus → Messzeile neu; ohne Bild gilt die letzte Größe (T51c).
    if (vorher !== null && (vorher.target !== e.target || vorher.share !== e.share || vorher.mode !== e.mode)) x.mess = null;
    else if (e.state !== 'live' && x.mess?.geliefert) x.mess = { geliefert: null, zuletzt: { b: x.mess.geliefert.b, h: x.mess.geliefert.h } };
    x.bridge = { gen: aktiveGen, state: e.state, mode: e.mode, target: e.target, share: e.share, reason: e.reason, sent: e.sent };
    if (e.mode === 'speaker' && e.target !== 0 && e.target !== letzterSprecher) {
      letzterSprecher = e.target;
      sprecherWechsel = [...sprecherWechsel, Date.now()].slice(-SPRECHER_SIGNALE_MAX);
    }
    // 10.9: Die Fehlerzeile fällt, sobald der Slot danach `live` meldet.
    if (e.state === 'live') x.fehler = null;
    // 7.8 (B66, W1): eine Logzeile je Zustandswechsel; dieselbe Art höchstens einmal je 2 s, `sent` allein ist kein Wechsel.
    const art = `${e.state}/${e.reason}`;
    const jetzt = Date.now();
    if (art !== x.log.art && jetzt - (x.log.zeiten.get(art) ?? 0) >= LOG_ART_MS) {
      x.log.zeiten.set(art, jetzt);
      d.log(slotLogZeile(x));
    }
    x.log.art = art;
    // 7.3 Nr. 7: liefSchon, sobald in diesem Meeting ein Sender bestand; zeigteSchon nur über zeigteSchonNachLive (N3).
    if (!x.s.liefSchon) x.s = { ...x.s, liefSchon: true };
    if (e.state === 'live' && x.e.modus === 'teilnehmer') x.s = { ...x.s, zeigteSchon: zeigteSchonNachLive(x.s, e) };
    // 7.3 Nr. 4: Ging der Slot aus, während sein slotOn unterwegs war („Stopp“, zoom_unload), stoppt ihn der Kern, sobald die
    // Bridge den Sender meldet (vorher kennt der Abgleich keinen Sender).
    if (!x.e.an) stoppSenden(x);
    // I-1 (Nachtrag B, NB8): erste Antwort oder neuer Modus → Unterschied nachsenden und sofort abgleichen.
    else if (vorher === null || vorher.mode !== e.mode) nachziehen(x);
    r5Pruefen();
  }

  /**
   * I-1 (Nachtrag B, NB8): Was sich seit dem Bau des letzten slotOn oder slotSet geändert hat (Modus, Ton, Auflösung,
   * Ersatzbild, ohne Kamera), geht als EIN slotSet nach, nur an einen laufenden Sender (B-EP21). Danach gleicht der Kern
   * sofort ab: Ziel nach dem Moduswechsel, eine Person oder Handwahl, die während des slotOn kam (7.3 Nr. 5).
   */
  function nachziehen(x: SlotIntern): void {
    const set = laufenderSender(x) && x.gesendet !== null ? slotSetFuer(x.gesendet, x.e) : null;
    if (set !== null) {
      if (set.mode === 'participant') zielMitnehmen(x, set);
      if (sende(set)) {
        x.gesendet = { ...x.e };
        d.log(`[zoom] Slot ${x.e.nr}: slotSet nach der Antwort (${Object.keys(set).filter((k) => k !== 'cmd' && k !== 'slot').join(', ')})`);
      }
    }
    abgleichen();
  }

  /** 7.3 Nr. 5: Der Wechsel auf Teilnehmer nimmt das Ziel gleich mit (sonst stünde der Slot bis zum nächsten Abgleich ohne). */
  function zielMitnehmen(x: SlotIntern, set: Extract<Command, { cmd: 'slotSet' }>): void {
    const z = teilnehmerZiel(x.e, x.s, abgleichTeilnehmer());
    if (z.gewaehlteId !== x.s.gewaehlteId) x.s = { ...x.s, gewaehlteId: z.gewaehlteId, wegSeq: null };
    set.id = z.ziel;
  }

  function slotTonEreignis(e: SlotTonEreignis): void {
    const x = slots.get(e.slot);
    // I-3 (Nachtrag B): Ton eines Senders, der keinem Connect-Slot gehört → slotOff, einmal je Sender; `off` folgt dem slot off.
    if (x === undefined || reserviert.has(e.slot)) {
      if (e.state !== 'off') fremderSender(e.slot, `slotAudio ${e.state}`);
      return;
    }
    x.ton = {
      state: e.state, reason: e.reason, source: e.source, configured: e.configured, rate: e.sampleRate ?? null, kanaele: e.channels ?? null,
    };
    // 7.1 (W6): `waiting/command` oder `live` meldet die Bridge nur mit stehendem Ton-Abo; der Merker fällt.
    if ((e.state === 'waiting' && e.reason === 'command') || e.state === 'live') tonAboFehler = null;
  }

  /**
   * Fehler der Slots und des Tons (Slot-Spec 7.1 „Fehler und ihr Anzeigeort“, 9.6, 10.9). `where:"slot"` mit Slot: Fehlerzeile,
   * ein Aufbaufehler ohne Sender zusätzlich SZ8 (T23), nie `slotNoPrivilege` (T100, der Slot wartet); ohne (bekannten) Slot
   * „Hinweise“; `'keine'` (Wettlauf, Neuverbinden) nur die Frist; `slotSubscribeFailed` den Namen für T20c. Ton: die drei Ton-Abo-Fehler setzen den
   * Merker (T104); `audioQueueOverflow` Q6 und `audioBufferMismatch` T106 nur als Hinweis (W6). Bild-Versatz Q13 wie 0.3.0.
   */
  function slotFehlerEreignis(e: FehlerEreignis): void {
    const name = e.name ?? String(e.code);
    const x = typeof e.slot === 'number' ? slots.get(e.slot) : undefined;
    // NB11 (Nachtrag B): Nur Antworten zum Video-Slot beenden die Frist eines slotOn, ein Ton-Fehler (`where:"audio"`) nicht.
    if (x && e.where === 'slot') fristBeantwortet(x);
    const code = String(e.code);
    if (e.where === 'slot' && typeof e.slot === 'number') {
      // Nachtrag B (I-2): die Antwort auf das älteste offene slotOn ohne Sender (eine Ablehnung) bzw. auf ein weiteres (slotAlreadyOn).
      if (x && (code === 'slotAlreadyOn' || (x.bridge === null && SLOTON_ABLEHNUNG.has(code)))) x.slotOnOffen.shift();
      // I-4: slotAlreadyOn, während Connect für den Slot keinen Sender kennt: Der Sender dort ist fremd → slotOff, nach dem slot off neu.
      if (code === 'slotAlreadyOn' && (x === undefined || x.bridge === null)) fremderSender(e.slot, code);
      // slotNotOn: Die Bridge hält unter dieser Nummer keinen Sender (Antwort auf ein slotOff der Reservierung): Nummer frei.
      else if (code === 'slotNotOn' && reserviert.has(e.slot)) reservierungFrei(e.slot);
    }
    if (e.where === 'slot' && istSlotFehler(code)) {
      const text = SLOT_FEHLER_TEXT[code];
      if (code === 'slotSubscribeFailed') {
        if (x) x.aboFehlerName = typeof e.sdk === 'number' ? sdkErrorName(e.sdk) : name;
      } else if (code === 'previewUnavailable') {
        // 7.1, 7.7: vorschauVerfuegbar falsch (T57 an jeder Kachel) und einmal unter „Hinweise“.
        if (vorschauVerfuegbar) hinweis(VORSCHAU_TEXT.T57(e.detail ?? name));
        vorschauVerfuegbar = false;
        vorschauDetail = e.detail ?? name;
      } else if (text !== 'keine') {
        const klartext = text({ name, nr: e.slot ?? null });
        if (x === undefined || code === 'slotBufferMismatch') hinweis(klartext);
        else {
          x.fehler = klartext;
          if (AUFBAU_FEHLER.has(code) && x.bridge === null) {
            x.s = { ...x.s, fehlerstand: 'gescheitert' };
            x.gescheitertText = klartext;
          }
        }
      }
    } else if (e.where === 'audio') {
      if ((AUDIO_ABO_FEHLER as readonly string[]).includes(code)) {
        tonAboFehler = name;
        letzterTonAboFehler = name;
      } else if (code === 'audioQueueOverflow') hinweis(KT.Q6(e.dropped ?? 0));
      else if (code === 'audioBufferMismatch' && typeof e.slot === 'number') hinweis(audioBufferMismatchText(e.slot));
    } else if (e.where === 'video' && e.code === 'videoBadDelay') hinweis(KT.Q13);
    if (x) loeschenWennFrei(x);
    r5Pruefen();
  }

  /**
   * T87 (10.11, B63): nach einem Wiederbeitritt (Z11 → im_meeting), sobald nach dem ersten Abgleich mit Erlaubnis jeder
   * gestartete Slot geantwortet hat oder seine Frist abgelaufen ist. Gezählt werden die eingeschalteten Slots.
   */
  function r5Pruefen(): void {
    if (!r5Offen || zustand !== 'im_meeting' || erlaubnis !== 'ja' || abgleichTimer !== null) return;
    const an = slotRohLagen().filter((r) => r.x.e.an);
    if (an.some((r) => r.zustand === 'startet' || r.zustand === 'geplant')) return;
    r5Offen = false;
    const zahl = (f: (r: (typeof an)[number]) => boolean): number => an.filter(f).length;
    hinweis(r5Text({
      gestartet: zahl((r) => r.zustand === 'zeigt' || r.zustand === 'gehalten' || r.zustand === 'ersatz'),
      zweifel: zahl((r) => r.x.e.modus === 'teilnehmer' && r.ziel !== null && (r.ziel.doppelt > 1 || r.ziel.zweifel)),
      nicht: zahl((r) => r.zustand === 'keine_antwort' || r.zustand === 'gescheitert'),
      grenze: zahl((r) => r.zustand === 'zurueckgestellt'),
    }));
  }

  /** slotOn senden und die Antwortfrist stellen (7.3 Nr. 2). Die Logzeile nennt Nummer und Modus, nie Namen (0.23). */
  function startSenden(x: SlotIntern, befehl: Extract<Command, { cmd: 'slotOn' }>): void {
    if (!sende(befehl)) return;
    // Nachtrag B (I-1, I-2): Der Abgleich hat den Befehl eben aus x.e gebaut; bis zur Antwort kann die Bridge einen Sender bauen.
    x.slotOnOffen.push({ ...x.e });
    d.log(`[zoom] Slot ${x.e.nr} startet (${x.e.modus})`);
    const gen = aktiveGen;
    x.frist = zeitgeber(f.aboAntwortMs, () => {
      x.frist = null;
      loeschenWennFrei(x);
      if (gen !== aktiveGen || imAbbau.has(gen)) return;
      // 7.3 Nr. 2: ohne Antwort Fehlerstand `keine_antwort` (SZ7, T21); kein neuer Versuch von selbst.
      x.s = { ...x.s, fehlerstand: 'keine_antwort' };
      d.log(`[zoom] Slot ${x.e.nr}: keine Antwort der Zoom-Bridge`);
      r5Pruefen();
      abbildGeaendert();
    });
  }

  function stoppSenden(x: SlotIntern): void {
    if (x.slotOffGesendet || x.bridge === null) return;
    if (!sende({ cmd: 'slotOff', slot: x.e.nr })) return;
    x.slotOffGesendet = true;
    d.log(`[zoom] Slot ${x.e.nr} wird gestoppt`);
  }

  /** Eingabe des reinen Abgleichs (slots.ts) aus der Lage des Kerns. */
  function abgleichEingabe(): AbgleichEingabe {
    return {
      meeting: zustand,
      erlaubnis: zustand === 'im_meeting' ? erlaubnis : null,
      ueber5: d.einstellungen.ueber5(),
      teilnehmer: aktiveSitzung() !== null ? abgleichTeilnehmer() : [],
      slots: [...slots.values()].map((x) => ({
        e: x.e,
        voruebergehend: x.voruebergehend,
        anNurMeeting: x.anNurMeeting,
        s: { ...x.s, frist: x.frist !== null },
        bridge: x.bridge !== null ? {
          laeuft: true, imAbbau: x.slotOffGesendet || imAbbau.has(x.bridge.gen), mode: x.bridge.mode, target: x.bridge.target,
        }
          // I-4 (Nachtrag B): Unter dieser Nummer läuft ein fremder Sender, sein slotOff ist gesendet (7.3 Nr. 10: nichts planen
          // bis zu dessen slot off, danach plant reservierungFrei neu). So entsteht weder T14 auf Dauer noch eine slotOn-Flut.
          : reserviert.has(x.e.nr) ? { laeuft: false, imAbbau: true, mode: MODUS_ZU_BRIDGE[x.e.modus], target: 0 } : null,
      })),
    };
  }

  /** 300 ms nach roster, joined, left, renamed, videoStatus, inMeeting und Erlaubnis „ja“; jeder Auslöser startet neu (7.3). */
  function abgleichPlanen(): void {
    if (abgleichTimer !== null) clearTimeout(abgleichTimer);
    abgleichTimer = zeitgeber(f.abgleichMs, () => {
      abgleichTimer = null;
      abgleichen();
    });
  }

  /**
   * Slot-Abgleich (7.3 Nr. 1–10), synchron: kein await zwischen Prüfen und Senden. Startet, hängt um (slotSet {id}), stoppt
   * und stellt zurück, was planeSlotAbgleich ergibt; sofort nach jeder Änderung des Bedieners, sonst über abgleichPlanen.
   */
  function abgleichen(): void {
    if (beendenVersprechen !== null || aktiveBridge === null || imAbbau.has(aktiveGen)) return;
    for (const h of planeSlotAbgleich(abgleichEingabe())) {
      const x = slots.get(h.nr);
      if (x === undefined) continue;
      if (h.art === 'nameMerken') {
        if (x.s.wegSeq !== null && h.gewaehlteId !== null) rueckkehrMerken(x, h.gewaehlteId);
        x.s = { ...x.s, gewaehlteId: h.gewaehlteId, wegSeq: null };
      }
      else if (h.art === 'starten') startSenden(x, h.befehl);
      else if (h.art === 'aendern') {
        if (sende(h.befehl)) d.log(`[zoom] Slot ${h.nr}: neues Ziel ${String(h.befehl.id)}`);
      } else if (h.art === 'stoppen') stoppSenden(x);
      else x.s = { ...x.s, fehlerstand: 'zurueckgestellt' };
    }
    r5Pruefen();
    abbildGeaendert();
  }

  /** e (10.1): eingeschaltete Slots, vorübergehende und `anNurMeeting` eingerechnet (7.4). */
  function eingeschaltet(): number {
    let n = 0;
    for (const x of slots.values()) if (x.e.an) n += 1;
    return n;
  }

  /** 7.4: Sind höchstens BETRIEBSGROESSE Slots eingeschaltet, verfällt die Zustimmung. */
  function zustimmungPruefen(): void {
    const zustimmung = d.einstellungen.ueber5();
    if (!zustimmung || ueber5Nach(eingeschaltet(), zustimmung)) return;
    // M2 (Nachtrag B): wie jeder Setter über schreibErgebnis (T92, Logzeile).
    schreibErgebnis(d.einstellungen.setzeUeber5(false));
    d.log('[zoom] Zustimmung über 5 Slots verfallen');
  }

  /**
   * 7.4: Wären mit einem weiteren eingeschalteten Slot mehr als BETRIEBSGROESSE an und fehlt die Zustimmung: ohne `trotz` die
   * Nachfrage T40 (nichts geändert), mit `trotz` wird die Zustimmung gespeichert. `null` = weiter.
   */
  function nachfrage(trotz: boolean): { ok: false; nachfrage: true; text: string } | null {
    const n = eingeschaltet() + 1;
    if (n <= BETRIEBSGROESSE || d.einstellungen.ueber5()) return null;
    if (!trotz) return { ok: false, nachfrage: true, text: nachfrageText(n) };
    schreibErgebnis(d.einstellungen.setzeUeber5(true));
    d.log('[zoom] Zustimmung über 5 Slots gegeben');
    return null;
  }

  /** T46 (E26, PK24): gleicher NDI-Name wie ein Browser-Gast ist nur eine Warnung; das Log nennt den Namen nicht (0.23). */
  function gastWarnung(nr: number, warnung: string | null): void {
    if (warnung !== null) hinweis(warnung, `Slot ${nr}: NDI-Name wie ein Browser-Gast`);
  }

  /** Start-Taste (7.2, 7.3 Nr. 2): hebt Fehlerstand, Frist und `anNurMeeting` auf, speichert und gleicht sofort ab. */
  function startTaste(x: SlotIntern, an: boolean): void {
    // M1 (Nachtrag B): „Start“ an einem Slot, der schon an ist und einen Sender hat, ändert nichts: Fehlerstand, Fehlerzeile und
    // Frist bleiben (die Diagnose steht weiter), kein zweites slotOn. Nur die Start-Taste gilt nun als gesetzt (7.2: anNurMeeting
    // fällt und wird gespeichert). Ein Slot ohne Sender wird wie bisher neu versucht.
    if (an && x.e.an && x.bridge !== null) {
      if (x.anNurMeeting) {
        x.anNurMeeting = false;
        if (!x.voruebergehend) speichern();
      }
      return;
    }
    x.s = sitzungNach(x.s, 'stoppStart');
    fristBeantwortet(x);
    fehlerWeg(x);
    x.e = { ...x.e, an };
    x.anNurMeeting = false;
    // NB1: „Start“ nach zoom_unload eines vorübergehenden Slots hebt das Entladen auf (sonst löschte ihn sein nächstes slot off).
    if (an) x.loeschen = false;
    if (!x.voruebergehend) speichern();
    d.log(`[zoom] Slot ${x.e.nr} ${an ? 'eingeschaltet' : 'ausgeschaltet'}`);
    if (!an) zustimmungPruefen();
    abgleichen();
  }

  /** Rückkehr der gezeigten Person (7.3 Nr. 5 c): persistentId beim Weggang gegen die neue (MS16); Logzeile und T62c, ohne Namen. */
  function rueckkehrMerken(x: SlotIntern, neueId: number): void {
    const alt = x.wegPersistentId ?? '';
    const neu = aktiveSitzung()?.participants.get(neueId)?.persistentId ?? '';
    x.rueckkehr = alt === '' || neu === '' ? 'fehlt' : alt === neu ? 'gleich' : 'verschieden';
    x.wegPersistentId = null;
    d.log(`[zoom] Slot ${x.e.nr}: Rückkehr: persistentId ${x.rueckkehr}`);
  }

  function slotAnlegen(): ZoomErgebnis & { nr?: number } {
    const nr = freieNummer();
    if (nr > SLOT_NR_MAX) return { ok: false, text: SLOT_TEXT.hoechstens };
    const e = neuerSlot(nr, d.einstellungen.vorgaben(), [...slots.values()].map((x) => x.e.ndiName));
    slots.set(nr, neuerIntern(e));
    speichern();
    d.log(`[zoom] Slot ${nr} angelegt`);
    abbildGeaendert();
    return { ok: true, nr };
  }

  function slotAendern(nr: number, aenderung: Partial<Omit<ZoomSlotEinstellung, 'nr' | 'an'>>): ZoomErgebnis {
    const x = slots.get(nr);
    if (x === undefined) return { ok: false, text: '' };
    let warnung: string | null = null;
    if (aenderung.ndiName !== undefined && aenderung.ndiName !== x.e.ndiName) {
      if (x.e.an || x.bridge !== null) return { ok: false, text: SLOT_TEXT.nameGesperrt };
      const andere = [...slots.values()].map((y) => ({ nr: y.e.nr, ndiName: y.e.ndiName }));
      const p = pruefeNdiName(aenderung.ndiName, nr, andere, d.gastLabels());
      if (p.fehler !== null) return { ok: false, text: p.fehler };
      warnung = p.warnung;
    }
    const neu: ZoomSlotEinstellung = { ...x.e, ...aenderung, nr: x.e.nr, an: x.e.an };
    // 7.3 Nr. 5, 7 (RR9): Mit der Person fallen gewaehlteId, wegSeq, personJetzt und zeigteSchon, mit dem Modus zeigteSchon.
    if (neu.person !== x.e.person) x.s = sitzungNach(x.s, 'personGeaendert');
    if (neu.modus !== x.e.modus) x.s = sitzungNach(x.s, 'modusGeaendert');
    // Nachtrag B (I-1): der Unterschied zu dem, was die Bridge zuletzt bekam; ohne laufenden Sender zieht nachziehen() ihn nach.
    const set = laufenderSender(x) ? slotSetFuer(x.gesendet ?? x.e, neu) : null;
    x.e = neu;
    if (set !== null && set.mode === 'participant') zielMitnehmen(x, set);
    if (!x.voruebergehend) speichern();
    d.log(`[zoom] Slot ${nr} geändert (${Object.keys(aenderung).sort().join(', ')})`);
    if (set !== null && sende(set)) {
      x.gesendet = { ...neu };
      d.log(`[zoom] Slot ${nr}: slotSet (${Object.keys(set).filter((k) => k !== 'cmd' && k !== 'slot').join(', ')})`);
    }
    gastWarnung(nr, warnung);
    abgleichen();
    return { ok: true };
  }

  /** Der Slot hat einen Sender der aktiven Bridge, der nicht gerade abgebaut wird (slotSet ist möglich, 6.2). */
  function laufenderSender(x: SlotIntern): boolean {
    return x.bridge !== null && !x.slotOffGesendet && x.bridge.gen === aktiveGen && !imAbbau.has(aktiveGen);
  }

  /**
   * slotSet an einen laufenden Slot (7.1, 6.2): nur die geänderten Felder, ohne Neustart; Ton immer `audio` und `shareAudio`
   * zusammen aus tonFuerBridge (PK14, N9-1). Person (Abgleich, 7.3 Nr. 5) und NDI-Name (nur ausgeschaltet) nie; `null` = nichts.
   */
  function slotSetFuer(alt: ZoomSlotEinstellung, neu: ZoomSlotEinstellung): Extract<Command, { cmd: 'slotSet' }> | null {
    const set: Extract<Command, { cmd: 'slotSet' }> = { cmd: 'slotSet', slot: alt.nr };
    if (neu.modus !== alt.modus) set.mode = MODUS_ZU_BRIDGE[neu.modus];
    if (neu.aufloesung !== alt.aufloesung) set.resolution = neu.aufloesung;
    if (neu.ersatzbild !== alt.ersatzbild) set.fallback = ERSATZBILD_ZU_BRIDGE[neu.ersatzbild];
    if (neu.ohneKamera !== alt.ohneKamera) set.showNoVideo = neu.ohneKamera;
    const tonAlt = tonFuerBridge(alt);
    const tonNeu = tonFuerBridge(neu);
    if (tonAlt.audio !== tonNeu.audio || tonAlt.shareAudio !== tonNeu.shareAudio) {
      set.audio = tonNeu.audio;
      set.shareAudio = tonNeu.shareAudio;
    }
    return Object.keys(set).length > 2 ? set : null;
  }

  function vorgabenSetzen(v: ZoomSlotVorgaben): ZoomErgebnis {
    if (!istSlotAufloesung(v.aufloesung) || typeof v.tonAn !== 'boolean') return { ok: false, text: '' };
    schreibErgebnis(d.einstellungen.setzeVorgaben({ aufloesung: v.aufloesung, tonAn: v.tonAn }));
    d.log(`[zoom] Vorgaben für neue Slots: ${v.aufloesung}, Ton ${v.tonAn ? 'an' : 'aus'}`);
    abbildGeaendert();
    return { ok: true };
  }

  function sprecherSetzen(s: ZoomSprecherEinstellung): ZoomErgebnis {
    if (!istSprecherSignal(s.signal)) return { ok: false, text: '' };
    const fehler = pruefeHaltezeit(s.haltezeitMs);
    if (fehler !== null) return { ok: false, text: fehler };
    schreibErgebnis(d.einstellungen.setzeSprecher({ signal: s.signal, haltezeitMs: s.haltezeitMs }));
    // 7.6: jede Änderung geht sofort an die Bridge (ohne Bridge kommt sie mit der nächsten Startfolge).
    sende({ cmd: 'speakerConfig', signal: SIGNAL_ZU_BRIDGE[s.signal], holdMs: s.haltezeitMs });
    d.log(`[zoom] Sprecher: ${s.signal}, Haltezeit ${s.haltezeitMs} ms`);
    abbildGeaendert();
    return { ok: true };
  }

  // ── Vorschau und Messwerte (Slot-Spec 7.7, 7.8; Plan B, Task B16) ──────────
  /** 7.7 (E17): Vorschau an, wenn der Schalter an und das Hauptfenster sichtbar und nicht minimiert ist. */
  function vorschauWunsch(): boolean {
    return d.einstellungen.vorschau() && fenster;
  }

  function vorschauSetzen(an: boolean): ZoomErgebnis {
    schreibErgebnis(d.einstellungen.setzeVorschau(an));
    d.log(`[zoom] Vorschau ${an ? 'an' : 'aus'}`);
    sende({ cmd: 'previewMode', on: vorschauWunsch() });
    abbildGeaendert();
    return { ok: true };
  }

  function fensterSichtbar(sichtbar: boolean): void {
    if (sichtbar === fenster) return;
    fenster = sichtbar;
    sende({ cmd: 'previewMode', on: vorschauWunsch() });
  }

  /** 7.7 (B53): nur Bilder des Ziels, das die Bridge für diesen Slot zuletzt meldete (bei Freigabe die Freigabe-Kennung). */
  function vorschauEreignis(e: VorschauEreignis): void {
    // NB19 (Nachtrag B): Bilder im Flug nach dem Ausschalten oder Verbergen erreichen das Fenster nicht mehr.
    if (!vorschauWunsch()) return;
    const b = slots.get(e.slot)?.bridge;
    if (!b) return;
    const ziel = b.mode === 'share' ? b.share : b.target;
    if (ziel === 0 || e.target !== ziel) return;
    d.onVorschau?.({ nr: e.slot, ziel: e.target, w: e.w, h: e.h, jpeg: e.jpeg });
  }

  /** Spalte „Uhrzeit“ in T63c und T65: Empfang in Connect als hh:mm:ss.mmm (Ortszeit); ohne Zeit „unbekannt“. */
  function uhrzeit(t: number | undefined): string {
    if (t === undefined) return UNBEKANNT;
    const d0 = new Date(t);
    const zwei = (v: number): string => String(v).padStart(2, '0');
    return `${zwei(d0.getHours())}:${zwei(d0.getMinutes())}:${zwei(d0.getSeconds())}.${String(d0.getMilliseconds()).padStart(3, '0')}`;
  }

  /**
   * „Messwerte kopieren“ (7.8, T61–T69): Prozess, je Slot T62, T62b, T69 und T62c, Freigabe (T63/T64/T64c, T64b, T63c),
   * Sprecher (T65–T67). Slots heißen „Slot {nr} ({Modus})“, Personen erscheinen nur als Kennung, nie ein Name (0.23).
   */
  function messwerteText(): string {
    const z: string[] = [];
    const u = (v: number | undefined): number | string => v ?? UNBEKANNT;
    const fps = (v: number | undefined): string => (v === undefined ? UNBEKANNT : dezimal(v));
    const b = messwerte.bridge;
    if (b) {
      z.push(MESS_TEXT.T61({
        cpu: dezimal(b.cpuPct), sys: dezimal(b.sysPct), mem: dezimal(b.memMb), q: b.audioQueueMax, d: b.audioDropped, mv: b.merkerVerworfen, hl: b.halteliste,
      }));
    }
    for (const m of messwerte.slots) {
      const x = slots.get(m.slot);
      if (x === undefined) continue;
      z.push(MESS_TEXT.T62({
        nr: m.slot, modus: x.e.modus, b: u(m.w), h: u(m.h), fps: fps(m.fps), ffps: dezimal(m.fallbackFps), work: dezimal(m.workUs / 1000),
        copy: dezimal(m.copyUs / 1000), prev: dezimal(m.previewUs / 1000), mem: dezimal(m.memKb / 1024), res: m.resWanted,
        resSetName: m.resSet !== undefined ? sdkErrorName(m.resSet) : UNBEKANNT, resGot: u(m.resGot), pps: u(m.audioPps), md: u(m.mixDrops),
        ms: u(m.mixSilenceMs),
      }));
      z.push(MESS_TEXT.T62b({
        nr: m.slot, ub: m.userVideoW ?? null, uh: m.userVideoH ?? null, hd: b?.hdVideo ?? null, og: b?.originalSize ?? null,
        rv: b?.recvVideo ?? null, rs: b?.recvShare ?? null,
      }));
      z.push(MESS_TEXT.T69({
        f: m.foreignFrames, l: m.lateFrames, t: m.tooFrequent, nsd: m.noShareData, r: m.rendererNew, rl: m.rendererLost, typ: u(m.rawType),
      }));
    }
    for (const x of [...slots.values()].sort((p, q) => p.e.nr - q.e.nr)) if (x.rueckkehr !== null) z.push(MESS_TEXT.T62c(x.e.nr, x.rueckkehr));
    const fr = messwerte.freigaben;
    if (fr) {
      const gezeigt = fr.list.find((f) => f.share === fr.shown);
      const fm = messwerte.slots.find((m) => slots.get(m.slot)?.bridge?.share === fr.shown && slots.get(m.slot)?.e.modus === 'freigabe');
      if (gezeigt && fm) {
        const bild = { b: u(fm.w), h: u(fm.h), fps: fps(fm.fps) };
        if (fm.shareAudioRate !== undefined) {
          z.push(MESS_TEXT.T63({ ...bild, rate: khzText(fm.shareAudioRate / 1000), kanaele: kanaeleText(fm.shareAudioCh ?? 1), p: gezeigt.pauses, g: fm.heldFrames }));
        } else if (b && b.shareAudioUnassigned > 0) z.push(MESS_TEXT.T64c({ ...bild, x: b.shareAudioUnassigned, k: u(b.shareAudioLastId) }));
        else z.push(MESS_TEXT.T64(bild));
      }
      if (fr.seeded) z.push(MESS_TEXT.T64b[fr.seeded]);
      z.push(`${MESS_TEXT.T63c.titel}: ${MESS_TEXT.T63c.spalten.join(' | ')}`);
      for (const r of fr.recent) z.push(`${uhrzeit(rueckrufZeiten.get(r.ms))} | ${r.cb} | ${r.status} | ${r.user} | ${r.share} | ${r.type}`);
    }
    z.push(`${MESS_TEXT.T65.titel}: ${MESS_TEXT.T65.spalten.join(' | ')}`);
    const spalte = (s: { signal: SpeakerSignal; ids: number[] }, sig: SpeakerSignal): string => (s.signal === sig ? s.ids.join(',') : '');
    messwerte.sprecherSignale.forEach((s, i) => {
      z.push(`${uhrzeit(sprecherZeiten[i])} | ${spalte(s, 'speakerVideo')} | ${spalte(s, 'activeVideo')} | ${spalte(s, 'activeAudio')}`);
    });
    if (luecken.length > 0) {
      const werte = luecken.map((l) => l.ms).sort((p, q) => p - q);
      const median = werte.length % 2 === 1 ? werte[(werte.length - 1) / 2] : (werte[werte.length / 2 - 1] + werte[werte.length / 2]) / 2;
      z.push(MESS_TEXT.T66({
        a: luecken[luecken.length - 1].ms, m: dezimal(median), x: werte[werte.length - 1], w: luecken.length, ungeprueft: luecken.some((l) => l.ungeprueft),
      }));
    }
    // T67: Wechsel der Sprecher-Slots seit dem ältesten gemerkten (der erste ist die erste Person, kein Wechsel), je Minute.
    if (sprecherWechsel.length > 0) {
      const minuten = (Date.now() - sprecherWechsel[0]) / LOG_MINUTE_MS;
      z.push(MESS_TEXT.T67(minuten > 0 ? dezimal((sprecherWechsel.length - 1) / minuten) : UNBEKANNT));
    }
    return z.join('\n');
  }

  function slotLoeschen(nr: number): ZoomErgebnis {
    const x = slots.get(nr);
    if (x === undefined) return { ok: false, text: '' };
    if (x.e.an || x.bridge !== null) return { ok: false, text: SLOT_TEXT.loeschenGesperrt };
    // I-2, I-6 (Nachtrag B): Ist sein slotOn noch unbeantwortet („Stopp“ im Flug), bleibt die Nummer reserviert und slotOff geht hinaus.
    slotEntfernen(x, true);
    if (!x.voruebergehend) speichern();
    d.log(`[zoom] Slot ${nr} gelöscht`);
    abbildGeaendert();
    return { ok: true };
  }

  function slotStart(nr: number, an: boolean, trotz = false): ZoomErgebnis | { ok: false; nachfrage: true; text: string } {
    const x = slots.get(nr);
    if (x === undefined) return { ok: false, text: '' };
    if (an && !x.e.an) {
      const frage = nachfrage(trotz);
      if (frage !== null) return frage;
    }
    // 7.3 Nr. 2, 7.2: „Stopp“ und „Start“ heben Fehlerstand und `anNurMeeting` auf; die Start-Taste wird gespeichert.
    startTaste(x, an);
    return { ok: true };
  }

  /** E13 (7.2 „Übergang“): Übergangs-Namensregel, Person = Anzeigename, Ersatzbild transparent, Vorgaben, an. */
  function slotFuerPerson(nr: number, anzeigename: string): ZoomSlotEinstellung {
    const belegt = [...slots.values()].map((x) => x.e.ndiName);
    return { ...neuerSlot(nr, d.einstellungen.vorgaben(), belegt), ndiName: uebergangsNdiName(anzeigename, belegt), person: anzeigename, an: true };
  }

  /**
   * Kleinste freie Slot-Nummer; über SLOT_NR_MAX, wenn alle belegt sind (vorübergehende eingerechnet). Verdeckt reservierte
   * Nummern sind belegt, bis die Bridge für sie keinen Sender mehr hält (Nachtrag B, I-2).
   */
  function freieNummer(): number {
    let nr = 1;
    while (slots.has(nr) || reserviert.has(nr)) nr += 1;
    return nr;
  }

  function slotAusPerson(teilnehmerId: number, trotz = false): ZoomErgebnis | { ok: false; nachfrage: true; text: string } {
    const p = aktiveSitzung()?.participants.get(teilnehmerId);
    if (!p || p.self) return { ok: false, text: KT.Q2 };
    if (p.inWaitingRoom) return { ok: false, text: SLOT_TEXT.warteraumTooltip };
    const nr = freieNummer();
    if (nr > SLOT_NR_MAX) return { ok: false, text: SLOT_TEXT.hoechstens };
    const frage = nachfrage(trotz);
    if (frage !== null) return frage;
    const e = slotFuerPerson(nr, p.name);
    const x = neuerIntern(e);
    // M3 (Nachtrag B): Der Slot zeigt die angeklickte Person, auch bei einem Namensvetter (Sitzungswahl wie die Handwahl, 7.3 Nr. 5);
    // gespeichert wird nur der Name.
    x.s = { ...x.s, gewaehlteId: teilnehmerId };
    slots.set(nr, x);
    speichern();
    d.log(`[zoom] Slot ${nr} aus Teilnehmer ${teilnehmerId} angelegt`);
    gastWarnung(nr, pruefeNdiName(e.ndiName, nr, [], d.gastLabels()).warnung);
    abgleichen();
    return { ok: true };
  }

  function slotPersonWaehlen(nr: number, teilnehmerId: number): ZoomErgebnis {
    const x = slots.get(nr);
    const p = aktiveSitzung()?.participants.get(teilnehmerId);
    if (x === undefined || !p || p.self) return { ok: false, text: KT.Q2 };
    x.s = { ...x.s, gewaehlteId: teilnehmerId, wegSeq: null };
    d.log(`[zoom] Slot ${nr}: Person gewählt (Teilnehmer ${teilnehmerId})`);
    abgleichen();
    return { ok: true };
  }

  function slotBehalten(nr: number): ZoomErgebnis {
    const x = slots.get(nr);
    if (x === undefined) return { ok: false, text: '' };
    if (!x.voruebergehend && !x.anNurMeeting) return { ok: true };
    // 7.2: dauerhaft und gespeichert; die Start-Taste gilt wie eingestellt (ein ausgeschalteter vorübergehender bleibt aus).
    x.voruebergehend = false;
    x.anNurMeeting = false;
    x.loeschen = false;
    speichern();
    d.log(`[zoom] Slot ${nr} behalten`);
    abbildGeaendert();
    return { ok: true };
  }

  // ── Fernsteuerung (Spec 8.3, 8.6; Plan B, Task B13) ──────────────────────
  type FernErgebnis = { kennung: ZoomBefehlKennung; text: string | null };
  const FERN_OK: FernErgebnis = { kennung: 'ok', text: null };

  /**
   * 7.4, 8.3: Wären mit `neu` weiteren eingeschalteten Slots mehr als BETRIEBSGROESSE an, setzt Companion die Zustimmung
   * (vor dem Abgleich, sonst stellte er den Slot zurück) und warnt mit F8; der Befehl ist ausgeführt.
   */
  function fernUeber5(neu: number): FernErgebnis {
    const n = eingeschaltet() + neu;
    if (n <= BETRIEBSGROESSE) return FERN_OK;
    if (!d.einstellungen.ueber5()) schreibErgebnis(d.einstellungen.setzeUeber5(true));
    return { kennung: 'f8', text: FT.F8(n) };
  }

  /** Teilnehmer-Slots, deren Person nach dem normierten Namen so heißt (8.3), nach Nummer. */
  function slotsMitPerson(name: string): SlotIntern[] {
    const gesucht = normName(name);
    return [...slots.values()].filter((x) => x.e.modus === 'teilnehmer' && normName(x.e.person) === gesucht).sort((a, b) => a.e.nr - b.e.nr);
  }

  /**
   * `zoom_load` (8.3, 7.2; ersetzt fernLaden): Prüfungen wie 0.3.0 (F4, dann F2/F3/F4 nach dem Ladeziel). Ist ein
   * Teilnehmer-Slot dieses Namens an, ändert sich nichts; sonst geht der mit der kleinsten Nummer an, ein dauerhafter nur für
   * dieses Meeting (`anNurMeeting`, gespeichert bleibt `an: false`); ohne solchen Slot entsteht ein vorübergehender nach E13
   * (ohne freie Nummer F14). Kein await zwischen Prüfen und Anlegen (B79 c).
   */
  function fernSlotAnlegen(name: string): FernErgebnis {
    if (zustand !== 'im_meeting') return { kennung: 'f4', text: FT.F4('nicht im Meeting') };
    if (erlaubnis !== 'ja') return { kennung: 'f4', text: FT.F4('keine Aufnahme-Erlaubnis') };
    const ziel = ladeZiel(name, fremde().map((p) => ({ id: p.id, name: p.name, imWarteraum: p.inWaitingRoom })));
    if (ziel.art === 'niemand') return { kennung: 'f2', text: FT.F2(name) };
    if (ziel.art === 'mehrdeutig') return { kennung: 'f3', text: FT.F3(name, ziel.n) };
    if (ziel.art === 'warteraum') return { kennung: 'f4', text: FT.F4('die Person ist im Warteraum') };
    const vorhanden = slotsMitPerson(name);
    if (vorhanden.some((x) => x.e.an)) return FERN_OK;
    const x = vorhanden.at(0);
    const nr = x?.e.nr ?? freieNummer();
    if (nr > SLOT_NR_MAX) return { kennung: 'f14', text: FT.F14 };
    const erg = fernUeber5(1);
    if (x !== undefined) {
      x.s = sitzungNach(x.s, 'stoppStart');
      x.e = { ...x.e, an: true };
      x.loeschen = false;
      if (!x.voruebergehend) x.anNurMeeting = true;
      d.log(`[zoom] Slot ${nr} per Companion eingeschaltet${x.voruebergehend ? '' : ' (nur dieses Meeting)'}`);
    } else {
      const e = slotFuerPerson(nr, aktiveSitzung()?.participants.get(ziel.id)?.name ?? name);
      slots.set(nr, neuerIntern(e, true));
      d.log(`[zoom] Slot ${nr} vorübergehend angelegt (Teilnehmer ${ziel.id})`);
      gastWarnung(nr, pruefeNdiName(e.ndiName, nr, [], d.gastLabels()).warnung);
    }
    abgleichen();
    return erg;
  }

  /**
   * `zoom_unload` (8.3, 7.2; ersetzt fernEntladen): alle eingeschalteten Teilnehmer-Slots dieses Namens aus; vorübergehende
   * verschwinden (nach dem Abbau ihres Senders), dauerhafte bleiben gespeichert, `anNurMeeting` fällt. Ohne Treffer F5.
   */
  function fernSlotEntladen(name: string): FernErgebnis {
    const treffer = slotsMitPerson(name).filter((x) => x.e.an);
    if (treffer.length === 0) return { kennung: 'f5', text: FT.F5(name) };
    for (const x of treffer) {
      x.e = { ...x.e, an: false };
      x.anNurMeeting = false;
      x.loeschen = x.voruebergehend;
      d.log(`[zoom] Slot ${x.e.nr} per Companion ausgeschaltet`);
    }
    if (treffer.some((x) => !x.voruebergehend)) speichern();
    zustimmungPruefen();
    abgleichen();
    for (const x of treffer) loeschenWennFrei(x);
    return FERN_OK;
  }

  /** `zoom_slot <nr> ON|OFF|TOGGLE` (8.3): Start-Taste wie an der Kachel, über BETRIEBSGROESSE ohne Nachfrage mit F8. */
  function fernSlot(nr: number, wert: SlotSchalter): FernErgebnis {
    const x = slots.get(nr);
    if (x === undefined) return { kennung: 'f9', text: FT.F9(String(nr)) };
    const an = wert === 'toggle' ? !x.e.an : wert === 'on';
    const erg = an && !x.e.an ? fernUeber5(1) : FERN_OK;
    startTaste(x, an);
    return erg;
  }

  /** `zoom_slot_mode` und `zoom_slot_person` (8.3): wie eine Änderung an der Kachel. */
  function fernAendern(nr: number, aenderung: Partial<Omit<ZoomSlotEinstellung, 'nr' | 'an'>>): FernErgebnis {
    if (!slots.has(nr)) return { kennung: 'f9', text: FT.F9(String(nr)) };
    slotAendern(nr, aenderung);
    return FERN_OK;
  }

  /**
   * `zoom_slot_audio <nr> ON|OFF|TOGGLE` (8.3, B57): OFF macht die Quelle still (Ton und Computerton aus) und merkt den
   * vorigen Stand; ON stellt ihn her, ohne gemerkten Stand Ton an. TOGGLE löst über „Ton eingeschaltet“ auf (8.2). F12 warnt
   * bei Tonart Person außerhalb des Modus Teilnehmer (ausgeführt).
   */
  function fernSlotTon(nr: number, wert: SlotSchalter): FernErgebnis {
    const x = slots.get(nr);
    if (x === undefined) return { kennung: 'f9', text: FT.F9(String(nr)) };
    const an = wert === 'toggle' ? !tonEingeschaltet(x.e) : wert === 'on';
    if (!an) {
      if (x.e.tonAn || x.e.computerton) x.tonGemerkt = { tonAn: x.e.tonAn, computerton: x.e.computerton };
      slotAendern(nr, { tonAn: false, computerton: false });
      return FERN_OK;
    }
    const g = x.tonGemerkt;
    x.tonGemerkt = null;
    slotAendern(nr, g ?? { tonAn: true });
    return x.e.tonAn && x.e.tonArt === 'person' && x.e.modus !== 'teilnehmer' ? { kennung: 'f12', text: FT.F12(nr) } : FERN_OK;
  }

  function steuerbefehl(cmd: { verb: string; args: string[] }): void {
    const verb = cmd.verb.toLowerCase();
    const b = deuteZoomBefehl(cmd.verb, cmd.args);
    let erg: FernErgebnis = FERN_OK;
    switch (b.art) {
      case 'abgelehnt':
        erg = { kennung: b.kennung, text: b.text };
        break;
      case 'laden':
        erg = fernSlotAnlegen(b.name);
        break;
      case 'entladen':
        erg = fernSlotEntladen(b.name);
        break;
      case 'versatz':
        // Wie 6.7; „nur für diese Sitzung gemerkt“ zählt über die Fernsteuerung als ausgeführt (L14).
        versatz({ ms: b.ms });
        break;
      case 'slot':
        erg = fernSlot(b.nr, b.wert);
        break;
      case 'slotModus':
        erg = fernAendern(b.nr, { modus: b.modus });
        break;
      case 'slotPerson':
        erg = fernAendern(b.nr, { person: b.name, modus: 'teilnehmer' });
        break;
      case 'slotTon':
        erg = fernSlotTon(b.nr, b.wert);
        break;
    }
    // 8.3: abgelehnt bei F1–F7, F9–F11, F13, F14; F8 und F12 sind Warnungen zu einem ausgeführten Befehl.
    befehl = { kennung: erg.kennung, abgelehnt: erg.kennung !== 'ok' && erg.kennung !== 'f8' && erg.kennung !== 'f12' };
    // N4b.2: der Hinweis nennt den Namen, das Log nur Kennung und Verb.
    if (erg.text !== null) hinweis(erg.text, fernLogText(erg.kennung, verb));
    else d.log(`[zoom] ${fernLogText(erg.kennung, verb)}`);
    abbildGeaendert();
  }

  // ── Beenden (Spec 6.6) ───────────────────────────────────────────────────
  /** Wartet höchstens `ms` auf `p` (eine Ablehnung zählt als Ende); true = `p` war rechtzeitig fertig. */
  async function mitFrist(p: Promise<unknown>, ms: number): Promise<boolean> {
    let frist: ReturnType<typeof setTimeout> | null = null;
    const rechtzeitig = await Promise.race([
      p.then(
        () => true,
        () => true,
      ),
      new Promise<boolean>((resolve) => {
        frist = zeitgeber(ms, () => resolve(false));
      }),
    ]);
    if (frist !== null) clearTimeout(frist);
    return rechtzeitig;
  }

  function beenden(fristMs: number): Promise<void> {
    if (beendenVersprechen !== null) return beendenVersprechen;
    beendenVersprechen = (async () => {
      laufNr += 1;
      // 6.6: Wiederbeitritt abbrechen (G17): kein Versuch startet mehr eine Bridge.
      folgeBeenden();
      ladeAbbruch?.abort();
      kopieAbbruch?.abort();
      d.log(`[zoom] Connect wird beendet (Frist ${fristMs} ms)`);
      // Spec 6.1: richteEin bricht nach der laufenden Datei ab und löscht <ziel>.teil selbst. Ohne dieses
      // Warten endet der Prozess vorher (before-quit ruft danach app.quit()) und .teil bliebe liegen.
      // Ein Laden schließt seine Kopie und das Aufräumen von ZIP und Entpackordner ein: dann auf das Laden warten.
      if (ladeLauf !== null) {
        if (!(await mitFrist(ladeLauf, fristMs))) d.log('[zoom] Laden des Zoom-SDK nicht rechtzeitig abgebrochen');
      } else if (kopieLauf !== null && !(await mitFrist(kopieLauf, fristMs))) d.log('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen');
      // Ruling 08.10.2026, Slot-Spec 7.3 Nr. 8: Die Sitzung der Slots endet wie beim Verlassen VOR Z12 und vor dem Warten auf
      // die Bridge.
      sitzungsEnde('beenden');
      // Kopie und Bridge laufen nie gleichzeitig (Sperre S10): insgesamt höchstens fristMs.
      if (aktiveBridge !== null) {
        // N4b.3 Nr. 8: Z12 („verlässt das Meeting …“) nur mit Meeting, nicht bei „Einrichtung prüfen“.
        const imMeetingZustand = zustand === 'startet' || zustand === 'tritt_bei' || zustand === 'warteraum' || zustand === 'im_meeting' || zustand === 'abriss';
        if (imMeetingZustand) setzeZustand('verlaesst');
        if (!(await mitFrist(stoppeBridge(), fristMs))) d.log('[zoom] Zoom-Bridge nicht rechtzeitig beendet');
      }
      nummer = null;
      kenncode = null;
      gesehenNamen.clear();
      abbildGeaendert();
    })();
    return beendenVersprechen;
  }

  // ── Start ────────────────────────────────────────────────────────────────
  bestimmeMaengel();
  zustand = maengel.length ? 'einrichtung' : 'bereit';
  d.log(`[zoom] Zoom-Kern bereit: ${zustand}${maengel.length ? ` (Mängel: ${maengel.join(', ')})` : ''}`);
  meldeLaufzeit(laufzeitStand);
  // Slot-Spec 7.2: die gespeicherten (dauerhaften) Slots; verworfene Einträge nennt der Hinweis T91 (die Zahl, nie ein Name).
  for (const e of d.einstellungen.slots()) slots.set(e.nr, neuerIntern(e));
  // 7.4, RR7: Eine Zustimmung über 5 aus einer früheren Sitzung (etwa nach einem Absturz mit einem zoom_load-Slot) gilt nur,
  // solange mehr als 5 Slots eingeschaltet sind.
  zustimmungPruefen();
  const lage = d.einstellungen.einstellungsLage();
  if (lage.verworfen > 0) hinweis(EINSTELLUNG_TEXT.verworfen(lage.verworfen));
  d.log(`[zoom] ${slots.size === 1 ? '1 Slot' : `${slots.size} Slots`} gelesen`);
  letzteKurz = JSON.stringify(kurz());

  return {
    abbild,
    kurz,
    stateKv: () => stateKvAus(kurz()),
    laeuft,
    einrichtungSperre,
    sdkWaehlen,
    sdkLaden,
    sdkLadenAbbrechen,
    zugangWaehlen,
    zugangEintragen,
    zugangLoeschen,
    sdkSchluesselEintragen,
    sdkSchluesselLoeschen,
    versatz,
    pruefen,
    beitreten,
    erneut,
    letztesMeeting,
    vergessen,
    verlassen,
    abbrechen,
    slotAnlegen,
    slotAendern,
    slotLoeschen,
    slotStart,
    slotAusPerson,
    slotPersonWaehlen,
    slotBehalten,
    vorgabenSetzen,
    sprecherSetzen,
    vorschauSetzen,
    fensterSichtbar,
    messwerteText,
    schliessen,
    meldungWeg,
    gastLabelsGeaendert: () => abbildGeaendert(),
    steuerbefehl,
    beenden,
  };
}
