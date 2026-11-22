// Player-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, W2-1 ON AIR, W2-10 Stop und Panik
// überall, E3 Ausgabezustand, E4 ON AIR, E7 Pause/Weiter, E14 Vollbild nur gemessen).
// Aus dem Store der Cue-Show, der Pad-Meldung der cueEngine, dem gemessenen Ausgabefenster (Zustand und Vollbild) und den
// Meldungen von Master-Link und Steuerserver entstehen die Props der Panel-Abschnitte, die Statusleiste, das ON AIR des
// Kopfes, die Tasten von Transport und Fußleiste und die Kürzel-Weiche für Eingabefelder.
// Kein window, kein IPC, kein localStorage, kein Store-Import: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen
// dieselben Ableitungen (eine Wahrheit). Keine Taste bekommt eine neue Wirkung.
import {
  abschnittStatusItem,
  REMOTE_TEXTE,
  remoteControlView,
  type RemoteControlSectionProps,
  type ScreenOption,
  type ScreenOutputSectionProps,
  SCREEN_TEXTE,
} from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { DisplayInfo, MasterLinkMeldungZeile, OutputTime, ShowCue } from '@shared/types';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  ausgabe: 'ausgabe',
  fernsteuerung: 'fernsteuerung',
} as const;

/**
 * Feste Texte des Players (kein ASCII-Anführungszeichen). Beschriftungen der Haupttasten und der Standby-Anzeige wie bisher
 * (ShowView.tsx); GO ohne das falsche „⏎“ (Spec 3.4: ausgelöst wird die Leertaste).
 */
export const PLAYER_TEXTE = {
  go: 'GO',
  pause: '❚❚ Pause',
  weiter: '▶ Weiter',
  stop: '■ Stop',
  panik: '⛔ Panik',
  /** Kürzel nur in der Cue-Show: Leertaste = GO, Escape = Stop; Pause/Weiter und Panik haben keines. */
  kuerzel: { go: 'Leertaste', stop: 'Esc' },
  /** Tooltip der Panik-Taste (alter Wortlaut); mit W2-10 stoppt Panik auch die Pads, der Satz stimmt damit. */
  tipps: { panik: 'Sofort alles stoppen' },
  /** Gründe der heute schon gesperrten Tasten (ShowView.tsx: GO ohne Standby-Cue, Pause/Weiter ohne laufenden Cue). */
  grund: { keinStandby: 'Kein Standby-Cue', keinCueLaeuft: 'Kein Cue läuft' },
  /** Standby-Anzeige im Transport (alter Wortlaut): Cue n · Beschriftung, sonst Dateiname, sonst —; ohne Cue — Ende —. */
  standby: {
    titel: 'Standby',
    cue: (n: number, name: string): string => `Cue ${n} · ${name}`,
    ohneName: '—',
    ende: '— Ende —',
  },
  /**
   * Video-Ausgabe (E3); Titel wie der alte Dialog „Video-Ausgabe“. `hinweis` und `primaer` sind der alte Wortlaut des Dialogs
   * (Text unter dem Titel, Zusatz der Bildschirmkarte des primären Bildschirms); beide stehen jetzt im Panel.
   */
  ausgabe: {
    titel: 'Video-Ausgabe',
    zu: 'zu',
    offen: 'offen',
    abgestuerzt: 'abgestürzt',
    trenner: ' · ',
    hinweis: 'Bildschirm für das Vollbild-Ausgabefenster wählen. Video-Cues erscheinen dort.',
    primaer: ' · Primär',
  },
  /** Statuseintrag der Cue-Show (Name wie der Reiter). */
  show: {
    titel: 'Cue-Show',
    laufend: (n: number): string => `${n} laufend`,
    pausiert: 'pausiert',
    keineShow: 'keine Show gewählt',
  },
  /** Statuseintrag der Pads (Name wie der Reiter). */
  pads: {
    titel: 'Soundboard',
    spielen: (n: number): string => (n === 0 ? 'kein Pad spielt' : n === 1 ? '1 Pad spielt' : `${n} Pads spielen`),
  },
  companionModul: 'JM Player',
} as const;

/** Der Teil des Player-Stores, den die Ableitungen brauchen (der Store erfüllt ihn strukturell). */
export interface PlayerZustand {
  activeShowId: number | null;
  showCues: readonly ShowCue[];
  standbyIndex: number;
  /** Klingende Cues und Cues im Pre-Wait (wie Companion sie zählt). */
  playingCueIds: readonly number[];
  /** Cues im Pre-Wait (Vorlaufzeit), zugleich in playingCueIds. */
  vorlaufCueIds: readonly number[];
  showPaused: boolean;
  /** Video-Cue im Ausgabefenster, gesetzt vor dem Laden. */
  videoCue: { id: number } | null;
  /** Gemeldete Position des Ausgabevideos: null bis zur ersten Meldung (erst dann ist das Video geladen). */
  videoProgress: OutputTime | null;
  outputDisplayId: number | null;
}

export interface OberflaechenStand {
  /** Store der Cue-Show; undefined = noch nicht geladen (dann „unbekannt“, nie live). */
  player: PlayerZustand | undefined;
  /** Pad-Meldung der cueEngine (IDs spielender Pads); undefined = noch keine Meldung (wie ohne Pad, Statusleiste unbekannt). */
  pads: number[] | undefined;
  /** Gemessenes Ausgabefenster: undefined = noch keine Antwort, null = keine Brücke (beides „unbekannt“). */
  ausgabe: AusgabeZustand | null | undefined;
  /** Gemessenes Vollbild (`output:isFullscreen`): undefined = nicht gefragt, null = kein Fenster; beides nicht angeboten (E14). */
  vollbild: boolean | null | undefined;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8725): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
  /** Bildschirmliste, falls bekannt (frisch aus `output.displays()`): Auswahl im Panel und Name in „offen · …“. */
  bildschirme?: readonly ScreenOption[];
}

/** Aktionen des Panels: die View ruft damit `window.jmplay` bzw. den Store erst im Rückruf. */
export interface PlayerAktionen {
  ausgabeUmschalten(an: boolean): void;
  bildschirmWaehlen(id: number | null): void;
  vollbildUmschalten(an: boolean): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung, wo es eines gibt dem Kürzel und dem Tooltip (TallyButton kennt keinen; die View hüllt ihn). */
export type Haupttaste = TasteZustand & { label: string; shortcut?: string; tipp?: string };

/** Standby-Text wie die Standby-Anzeige im Transport: „Cue n · ‹Name›“ oder „— Ende —“. */
export function standbyText(p: PlayerZustand | undefined): string {
  const S = PLAYER_TEXTE.standby;
  const cue = p?.showCues[p.standbyIndex];
  if (p === undefined || cue === undefined) return S.ende;
  return S.cue(p.standbyIndex + 1, cue.label || cue.media?.fileName || S.ohneName);
}

/**
 * Zahl der Show-Cues, die wirklich spielen (W2-1): IDs aus playingCueIds, die nicht im Vorlauf stehen, nicht der Video-Cue
 * sind und deren Show-Cue kein Video ist, dazu der Video-Cue, sobald das Ausgabefenster eine Position gemeldet hat. Video
 * zählt also nur über den Videofortschritt: Eine Video-ID, die nach dem Ende eines späteren Videos in playingCueIds
 * stehen bleibt (Companion zählt sie weiter, U6), ist nicht auf Sendung. Eine ID ohne Eintrag in der Cue-Liste zählt
 * (Irrtum zur Seite „an“: der Vorlauf-Zeitgeber eines entfernten Cues startet ihn trotzdem). Pause zählt hier nicht.
 */
function spielendeCues(p: PlayerZustand): number {
  const videoId = p.videoCue?.id;
  const istVideo = (id: number): boolean => p.showCues.find((c) => c.id === id)?.media?.kind === 'video';
  const audio = new Set(p.playingCueIds.filter((id) => !p.vorlaufCueIds.includes(id) && id !== videoId && !istVideo(id))).size;
  return audio + (p.videoCue !== null && p.videoProgress !== null ? 1 : 0);
}

/**
 * Die Show spielt wirklich (W2-1, Wahrheitstabelle Task 14, Fix vor Prüfung): nicht pausiert und (eine ID in
 * playingCueIds, die weder in vorlaufCueIds noch die ID von videoCue ist und deren Show-Cue kein Video ist, oder videoCue
 * mit gemeldetem Fortschritt). Ohne Store nie.
 */
export function showSpielt(s: Pick<OberflaechenStand, 'player'>): boolean {
  const p = s.player;
  return p !== undefined && !p.showPaused && spielendeCues(p) > 0;
}

/** ON AIR (E4): die Show spielt wirklich oder mindestens ein Pad spielt; noch keine Pad-Meldung zählt wie kein Pad. Kein Label. */
export function kopfOnAir(s: Pick<OberflaechenStand, 'player' | 'pads'>): { live: boolean } {
  return { live: showSpielt(s) || (s.pads?.length ?? 0) > 0 };
}

/**
 * Etikett eines Bildschirms in der Auswahl des Panels, aus der alten Bildschirmkarte: Name, beim primären „ · Primär“, dazu
 * Breite×Höhe in Klammern (wie Prompter und Stage-Display).
 */
export function bildschirmEtikett(d: Pick<DisplayInfo, 'label' | 'primary' | 'width' | 'height'>): string {
  return `${d.label}${d.primary ? PLAYER_TEXTE.ausgabe.primaer : ''} (${d.width}×${d.height})`;
}

/** Das Ausgabefenster soll offen sein: Es existiert gemessen in irgendeiner Form (auch abgestürzt oder ohne Bildschirm). */
const fensterSollOffen = (a: AusgabeZustand | null | undefined): boolean => a !== undefined && a !== null && a.art !== 'zu';

/**
 * Video-Ausgabe (E14): Schalter und Bildschirmwahl; Vollbild nur mit Messwert. Ohne Messwert (undefined, null) fehlt
 * `fullscreen` ganz. Ein gemessenes „zu“ widerlegt einen alten Messwert (ohne Fenster misst Main null).
 */
export function ausgabeAbschnitt(s: OberflaechenStand, a?: PlayerAktionen): ScreenOutputSectionProps {
  const z = s.ausgabe ?? undefined;
  const vollbild = typeof s.vollbild === 'boolean' && z?.art !== 'zu' ? s.vollbild : undefined;
  return {
    id: ABSCHNITT.ausgabe,
    enabled: fensterSollOffen(z),
    windowOpen: z === undefined ? undefined : z.art === 'offen' || z.art === 'bildschirm-fehlt',
    screens: s.bildschirme === undefined ? undefined : [...s.bildschirme],
    selectedId: s.player?.outputDisplayId ?? null,
    ...(vollbild === undefined ? {} : { fullscreen: vollbild }),
    capabilities: vollbild === undefined ? { toggle: true } : { toggle: true, fullscreen: true },
    ...(a === undefined
      ? {}
      : {
          onToggle: (an: boolean) => a.ausgabeUmschalten(an),
          onSelect: (id: number | null) => a.bildschirmWaehlen(id),
          ...(vollbild === undefined ? {} : { onFullscreen: (an: boolean) => a.vollbildUmschalten(an) }),
        }),
  };
}

/** Fernsteuerung: Meldung des Steuerservers (Port 8725), Einrichten nur im Launcher. */
export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps {
  const m = s.fernsteuerung ?? undefined;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“.
  const belegt = portBelegt(m);
  return {
    id: ABSCHNITT.fernsteuerung,
    running: m?.laeuft,
    mode: m?.modus,
    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,
    // Verbundene Clients zählen nur bei laufendem Server.
    clients: m?.laeuft ? m.clients : undefined,
    portInUse: belegt,
    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,
    companionModule: PLAYER_TEXTE.companionModul,
    capabilities: {},
  };
}

/** Video-Ausgabe (E3): noch keine Antwort oder keine Brücke → unbekannt, nie ok. „offen“ nennt den Bildschirm nur, wenn die Liste ihn kennt. */
function videoAusgabeItem(s: OberflaechenStand): StatusItem {
  const T = PLAYER_TEXTE.ausgabe;
  const kopf = { id: 'video-ausgabe', group: 'ausgabe', label: T.titel, settingsSection: ABSCHNITT.ausgabe } as const;
  const z = s.ausgabe;
  if (z === undefined || z === null) return unbekannt(kopf);
  switch (z.art) {
    case 'zu':
      return { ...kopf, state: 'off', detail: T.zu };
    case 'offen': {
      const name = z.displayId === null ? undefined : s.bildschirme?.find((b) => b.id === z.displayId)?.label;
      return { ...kopf, state: 'ok', detail: name === undefined ? T.offen : `${T.offen}${T.trenner}${name}` };
    }
    case 'bildschirm-fehlt':
      return { ...kopf, state: 'warn', detail: SCREEN_TEXTE.bildschirmFehlt };
    case 'abgestuerzt':
      return { ...kopf, state: 'error', detail: T.abgestuerzt };
  }
}

/**
 * Cue-Show: pausiert → warn; wirklich spielende Cues → ok „n laufend“ (Vorlauf, Video vor dem Laden und veraltete Video-IDs
 * zählen nicht);
 * keine Show gewählt → off; sonst off „Standby ‹Name›“. Ohne Store unbekannt. Nie live (ON AIR sitzt im Kopf).
 */
function showItem(p: PlayerZustand | undefined): StatusItem {
  const T = PLAYER_TEXTE.show;
  const kopf = { id: 'show', group: 'tool', label: T.titel } as const;
  if (p === undefined) return unbekannt(kopf);
  if (p.showPaused) return { ...kopf, state: 'warn', detail: T.pausiert };
  const n = spielendeCues(p);
  if (n > 0) return { ...kopf, state: 'ok', detail: T.laufend(n) };
  if (p.activeShowId === null) return { ...kopf, state: 'off', detail: T.keineShow };
  return { ...kopf, state: 'off', detail: `${PLAYER_TEXTE.standby.titel} ${standbyText(p)}` };
}

/** Pads: Meldung der cueEngine; noch keine Meldung → unbekannt, sonst die Zahl spielender Pads (0 → off). */
function padsItem(pads: number[] | undefined): StatusItem {
  const T = PLAYER_TEXTE.pads;
  const kopf = { id: 'pads', group: 'tool', label: T.titel } as const;
  if (pads === undefined) return unbekannt(kopf);
  return { ...kopf, state: pads.length > 0 ? 'ok' : 'off', detail: T.spielen(pads.length) };
}

/** Statusleiste in fester Reihenfolge: master-link, video-ausgabe, fernsteuerung, show, pads. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    videoAusgabeItem(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    showItem(s.player),
    padsItem(s.pads),
  ];
}

function taste(label: string, grund?: string, extra: { shortcut?: string; tipp?: string } = {}): Haupttaste {
  return { label, state: grund === undefined ? 'bereit' : 'gesperrt', ...(grund === undefined ? {} : { disabledReason: grund }), ...extra };
}

/**
 * Transport der Cue-Show (vier Haupttasten, Spec 5.1): GO (`showGo`, Leertaste), Pause/Weiter (`showTogglePause`), Stop
 * (`showStop`, Esc), Panik (`showPanic`). Gesperrt wie heute (ShowView.tsx): GO ohne Standby-Cue, Pause/Weiter, wenn weder
 * ein Cue in playingCueIds steht (auch im Vorlauf) noch die Show pausiert ist. Nie live: GO nicht (E4), Pause/Weiter ist ein
 * Umschalter mit wechselnder Beschriftung (E7), Stop und Panik sind immer bereit.
 */
export function transportTasten(s: Pick<OberflaechenStand, 'player'>): { go: Haupttaste; pauseWeiter: Haupttaste; stop: Haupttaste; panik: Haupttaste } {
  const p = s.player;
  const T = PLAYER_TEXTE;
  const standby = p !== undefined && p.showCues[p.standbyIndex] !== undefined;
  const pausiert = p?.showPaused === true;
  const pauseGesperrt = (p?.playingCueIds.length ?? 0) === 0 && !pausiert;
  return {
    go: taste(T.go, standby ? undefined : T.grund.keinStandby, { shortcut: T.kuerzel.go }),
    pauseWeiter: taste(pausiert ? T.weiter : T.pause, pauseGesperrt ? T.grund.keinCueLaeuft : undefined),
    stop: taste(T.stop, undefined, { shortcut: T.kuerzel.stop }),
    panik: taste(T.panik, undefined, { tipp: T.tipps.panik }),
  };
}

/** Fußleiste in Bibliothek und Soundboard (W2-10): Stop und Panik wie im Transport, dieselben Handler, ohne Kürzel. */
export function fussleistenTasten(s: Pick<OberflaechenStand, 'player'>): { stop: Haupttaste; panik: Haupttaste } {
  const { stop, panik } = transportTasten(s);
  const { shortcut: _ohneKuerzel, ...stopOhneKuerzel } = stop;
  return { stop: stopOhneKuerzel, panik };
}

/**
 * Ist das Ziel eines Tastendrucks ein Feld, in das getippt wird? Dann gehören Leertaste, Escape und Pad-Tasten dem Feld.
 * Wie bisher INPUT, TEXTAREA und SELECT, dazu contentEditable (wie Prompter und Timer). Ein Knopf zählt nicht (O1:
 * Leertaste auf einem Knopf im Panel geht ans Tool). Ohne DOM nutzbar: gelesen werden nur tagName und isContentEditable.
 */
export function istEingabeZiel(ziel: EventTarget | null): boolean {
  if (ziel === null) return false;
  const t = ziel as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
}
