// Timer-Oberfläche: reine Ableitungen (UX Welle 1, Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Timer“). Aus dem Stand des Timers
// (Countdown und Ablauf, Socket-Zustand, Speaker-Fenster, Master-Link-, Fernsteuerungs- und Verbund-Meldung) entstehen die
// Props des Fernsteuerungs-Abschnitts, die Statusleiste, die Zustände der Haupttasten und die Kürzel-Weiche für Eingabefelder.
// Kein window, kein IPC, kein localStorage: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit).
// Regeln: E3 Speaker-Fenster, E9 Modi, E10 Fernsteuerung ohne Lauschzustand, U6 Bedienlogik bleibt.
import { abschnittStatusItem, REMOTE_TEXTE, remoteControlView, type RemoteControlSectionProps } from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem, type StatusState } from '@jm/ui';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { isCountdownPaused, isCountdownRunning, type SyncedState } from '@shared/timer-state';
import type { MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/verbund';
import type { Mode } from '@/store/timer';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  fernsteuerung: 'fernsteuerung',
  speaker: 'speaker',
  lan: 'lan',
  farben: 'farben',
} as const;

/**
 * Feste Texte des Timers (kein ASCII-Anführungszeichen). Beschriftungen und die Sync-Texte sind wörtlich der Bestand
 * (Countdown.tsx, Timetable.tsx, Topbar.tsx); neu sind Gründe, Titel der Panel-Abschnitte und die Speaker-Zustände.
 */
export const TIMER_TEXTE = {
  /** Beschriftungen der Haupttasten (Countdown.tsx, Timetable.tsx): wörtlich wie bisher. */
  start: 'Start',
  resume: 'Resume',
  pause: 'Pause',
  reset: 'Reset',
  zurueck: '← Prev',
  weiter: 'Next →',
  /** Kürzel nur im Countdown (Countdown.tsx: Space und R); `TallyButton.shortcut` zeigt nur vorhandene Kürzel. */
  kuerzel: { startPause: 'Leertaste', reset: 'R' },
  /** Gründe gesperrter Haupttasten: an Anfang und Ende des Ablaufs, ohne Punkte, Reset ohne Wirkung. */
  grund: {
    ersterPunkt: 'Erster Programmpunkt',
    letzterPunkt: 'Letzter Programmpunkt',
    keinePunkte: 'Keine Programmpunkte',
    nichtsZuruecksetzen: 'Nichts zurückzusetzen',
  },
  /** Sync-Pille der Kopfzeile (Topbar.tsx, title): wörtlich wie bisher. */
  sync: { label: 'Sync', verbunden: 'Verbunden mit JM Timer-Sync', offline: 'Keine Verbindung' },
  /** Speaker-Fenster (E3): Zustände der Statusleiste und Hinweis im Panel; Label und Titel sind `titel.speaker`. */
  speaker: {
    offen: 'Fenster offen',
    zu: 'Fenster zu',
    hinweis: 'Öffnet auf dem zweiten Bildschirm, falls vorhanden.',
    oeffnen: 'Speaker-Fenster öffnen',
    schliessen: 'Speaker-Fenster schließen',
    /** Knopf der Kopfmitte (Topbar.tsx): wörtlich wie bisher. */
    knopfOffen: 'Speaker · Open',
    knopfZu: 'Open Speaker',
  },
  /** Hinweis unter der Dauer im Countdown; „Delay-Karte rechts“ wurde zu „Delay“, weil die Karte nun darunter als Collapsible steht. */
  dauerHinweis: 'Während der Timer läuft, Dauer per Delay anpassen.',
  /** Titel der tool-eigenen Panel-Abschnitte (E3, E9). */
  titel: { speaker: 'Speaker-Fenster', lan: 'LAN-Fernbedienung', farben: 'Farben' },
} as const;

/** Der Teil des synchronisierten Stands, den die Ableitungen brauchen: Countdown und Ablauf. */
export type TimerState = Pick<SyncedState, 'countdown' | 'timetable'>;

export interface OberflaechenStand {
  timer: TimerState;
  /**
   * Socket-Zustand (store.connected): undefined = noch kein Ereignis (dann „unbekannt“), true = verbunden, false = offline.
   * Die Ableitung nimmt den Wert, wie er kommt; der Store startet mit false, die View reicht bis zum ersten Ereignis undefined.
   */
  connected: boolean | undefined;
  /** Speaker-Fenster aus `speaker.isOpen()` und `onStatus`: undefined = noch nicht gefragt oder ohne Preload (E3). */
  speakerOffen: boolean | undefined;
  /** Meldung der Master-Link-Brücke: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8724): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
  /** V-Zeile „Show vom Master“ für die Kopfmitte: null = Einzelplatz, undefined = offen. */
  verbund: VerbundAnzeigeZeile | null | undefined;
}

/** Aktionen des Panels (E3): der Speaker-Knopf ruft `window.jm.speaker.toggle` erst im Rückruf der View. */
export interface TimerAktionen {
  toggleSpeaker(): void;
}

/**
 * Welcher Modus gezeigt wird (E9): Das Panel ist kein Modus, der Typ `Mode` bleibt (Main und Socket teilen ihn). Kommt ein
 * unbenutzter Wert (`remote`, `settings`) an, zeigt die Oberfläche den Countdown statt eines leeren Bildschirms.
 */
export function anzeigeModus(mode: Mode): 'clock' | 'countdown' | 'timetable' {
  return mode === 'clock' || mode === 'timetable' ? mode : 'countdown';
}

/** Lauf-Pille im Kopf des Countdowns und des Ablaufs: laufend ok, pausiert warn, sonst off; nie live (E8). Texte wie bisher. */
export function laufPille(laeuft: boolean, pausiert: boolean): { state: 'ok' | 'warn' | 'off'; text: string } {
  return laeuft ? { state: 'ok', text: 'Running' } : pausiert ? { state: 'warn', text: 'Paused' } : { state: 'off', text: 'Idle' };
}

/** Ereignisse des Socket-Clients, die den Verbindungszustand bestimmen (sync/client.ts, App.tsx). */
export type VerbindungsEreignis = 'connect' | 'disconnect' | 'connect_error';

/** Verbunden ist nur nach `connect`; `disconnect` und ein gescheiterter Aufbau (`connect_error`) sind offline. */
export function verbindungNach(ereignis: VerbindungsEreignis): boolean {
  return ereignis === 'connect';
}

/** Der Store startet mit connected=false: Vor dem ersten Ereignis ist der Zustand unbekannt (undefined), nie „offline“ oder „ok“. */
export function anzeigeVerbindung(ereignisGehabt: boolean, connected: boolean): boolean | undefined {
  return ereignisGehabt ? connected : undefined;
}

/** Mindestbreite einer Haupttaste in px (Label bis „← Prev“/„Resume“ plus Kürzel „Leertaste“, px-4): darunter bricht das Raster um. */
export const TASTEN_MIN_BREITE = 160;

/** Containerbreite, ab der vier Tasten nebeneinander stehen: 4×160 + 3 Lücken à 12 (gap-3) = 676 px. Steht als `@[676px]` in LiveBereich.tsx. */
export const TASTEN_VIER_BREITE = 4 * TASTEN_MIN_BREITE + 3 * 12;

/**
 * Spalten der Haupttasten bei gegebener Containerbreite (Container-Query, kein Viewport): zwei Tasten immer 2 (eine Reihe),
 * vier Tasten 4 ab TASTEN_VIER_BREITE, sonst 2 (2×2); nie eine dritte Spalte (kein 3+1).
 */
export function tastenSpalten(anzahl: number, containerBreite: number): 2 | 4 {
  return anzahl === 4 && containerBreite >= TASTEN_VIER_BREITE ? 4 : 2;
}

/**
 * Breiten der Ablauf-Liste in px (Timetable.tsx, TimetableRow.tsx): feste Spalten 36+96+120+96+136, sechs Lücken à 12 (gap-3),
 * Innenabstand der Zeile 2×16 (px-4). Titel und Notiz brauchen je mindestens `textMin`; daraus folgt die Mindestbreite der Liste
 * (876 + 32 = 908, aufgerundet 920). Ist das Fenster schmaler (1024 px mit Sidebar und Panel), scrollt die Liste waagerecht.
 */
export const ABLAUF_LAYOUT = { festSpalten: 484, luecken: 72, innenAbstand: 32, textMin: 160, listeMin: 920 } as const;

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung (Start, Resume und Pause teilen sich eine Taste) und, wo es eines gibt, dem Kürzel. */
export type Haupttaste = TasteZustand & { label: string; shortcut?: string };

/** Fernsteuerung (E10): Meldung des Steuerservers, ohne Schalter und Port-Feld; Einrichten nur im Launcher. */
export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps {
  const m = s.fernsteuerung ?? undefined;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“.
  const belegt = portBelegt(m);
  return {
    id: ABSCHNITT.fernsteuerung,
    running: m?.laeuft,
    mode: m?.modus,
    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,
    // Verbundene Clients zählen nur bei laufendem Server (der Abschnitt zeigt die Zahl nur bei running).
    clients: m?.laeuft ? m.clients : undefined,
    portInUse: belegt,
    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,
    capabilities: {},
  };
}

/** Sync (Socket.IO :7777): Das erste Ereignis fehlt noch (undefined) → unbekannt, nie ok. Ohne Abschnitt, kein Sprung. */
function syncItem(connected: boolean | undefined): StatusItem {
  const kopf = { id: 'sync', group: 'verbindung', label: TIMER_TEXTE.sync.label } as const;
  if (connected === undefined) return unbekannt(kopf);
  return connected
    ? { ...kopf, state: 'ok', detail: TIMER_TEXTE.sync.verbunden }
    : { ...kopf, state: 'error', detail: TIMER_TEXTE.sync.offline };
}

/**
 * Speaker-Fenster (E3): offen ist gemessen (`isOpen`/`onStatus`) und gesund → ok. Zu ist der Normalzustand, keine Störung → off.
 * Weder live (der Timer hat keine On-Air-Quelle) noch warn.
 */
function speakerItem(offen: boolean | undefined): StatusItem {
  const kopf = { id: 'speaker', group: 'ausgabe', label: TIMER_TEXTE.titel.speaker, settingsSection: ABSCHNITT.speaker } as const;
  if (offen === undefined) return unbekannt(kopf);
  return offen ? { ...kopf, state: 'ok', detail: TIMER_TEXTE.speaker.offen } : { ...kopf, state: 'off', detail: TIMER_TEXTE.speaker.zu };
}

/** Statusleiste in fester Reihenfolge (E10): master-link, sync, speaker, fernsteuerung. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    syncItem(s.connected),
    speakerItem(s.speakerOffen),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
  ];
}

const VERBUND_ZUSTAND: Readonly<Record<VerbundAnzeigeZeile['farbe'], StatusState>> = {
  gruen: 'ok',
  gelb: 'warn',
  rot: 'error',
  gedaempft: 'off',
};

/** V-Zeile „Show vom Master“ als StatusPill: Farbe der Anzeige → Zustand; unbekannt → off, nie live. */
export function verbundZeileZustand(farbe: VerbundAnzeigeZeile['farbe']): StatusState {
  return Object.prototype.hasOwnProperty.call(VERBUND_ZUSTAND, farbe) ? VERBUND_ZUSTAND[farbe] : 'off';
}

/**
 * Haupttasten je Modus (Anhang A, E9): Start/Pause ist eine Taste (Start, Resume oder Pause wie bisher), nie live und nie
 * gesperrt. Reset ist im Leerlauf ohne Delay gesperrt (wie `disabled` heute). Im Ablauf kommen Prev und Next dazu, an Anfang
 * und Ende gesperrt mit Grund. Kürzel gibt es nur im Countdown (Leertaste, R); Uhr, Remote und Farben haben keine Haupttasten.
 */
export function hauptTasten(
  s: Pick<OberflaechenStand, 'timer'>,
  mode: Mode,
): { start: Haupttaste; reset: Haupttaste; prev?: Haupttaste; next?: Haupttaste } | null {
  if (mode !== 'countdown' && mode !== 'timetable') return null;
  const { countdown: cd, timetable: tt } = s.timer;
  const laeuft = isCountdownRunning(cd);
  const pausiert = isCountdownPaused(cd);
  const countdown = mode === 'countdown';
  const taste = (label: string, grund?: string, shortcut?: string): Haupttaste => ({
    label,
    state: grund === undefined ? 'bereit' : 'gesperrt',
    ...(grund === undefined ? {} : { disabledReason: grund }),
    ...(shortcut === undefined ? {} : { shortcut }),
  });
  const tasten = {
    start: taste(laeuft ? TIMER_TEXTE.pause : pausiert ? TIMER_TEXTE.resume : TIMER_TEXTE.start, undefined, countdown ? TIMER_TEXTE.kuerzel.startPause : undefined),
    reset: taste(TIMER_TEXTE.reset, !laeuft && !pausiert && cd.delayMs === 0 ? TIMER_TEXTE.grund.nichtsZuruecksetzen : undefined, countdown ? TIMER_TEXTE.kuerzel.reset : undefined),
  };
  if (countdown) return tasten;
  // Wie Timetable.tsx: ohne aktiven Punkt zählt der Index 0.
  const i = tt.activeIndex ?? 0;
  const G = TIMER_TEXTE.grund;
  const leer = tt.items.length === 0;
  return {
    ...tasten,
    prev: taste(TIMER_TEXTE.zurueck, leer ? G.keinePunkte : i <= 0 ? G.ersterPunkt : undefined),
    next: taste(TIMER_TEXTE.weiter, leer ? G.keinePunkte : i >= tt.items.length - 1 ? G.letzterPunkt : undefined),
  };
}

/**
 * Ist das Ziel eines Tastendrucks ein Feld, in das getippt wird? Dann gehören Leertaste und R dem Feld, nicht dem Countdown.
 * Wie bisher INPUT und TEXTAREA, dazu SELECT und contentEditable (Felder im Einstellungs-Panel). Ein Knopf zählt nicht (O1).
 * Ohne DOM nutzbar: gelesen werden nur tagName und isContentEditable.
 */
export function istEingabeZiel(ziel: EventTarget | null): boolean {
  if (ziel === null) return false;
  const t = ziel as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
}
