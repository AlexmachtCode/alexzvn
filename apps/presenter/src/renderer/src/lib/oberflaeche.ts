// Presenter-Oberfläche: reine Ableitungen (UX Welle 2b, Presenter c; Spec 5.1, 7.1–7.4, B3 ON AIR, B10 Tastenfilter,
// B11 Bildschirm, B13 Sperren). Aus dem Präsentationszustand des Hauptprozesses, der Bildschirmliste (`current` = dort steht
// das Publikumsfenster), NDI, Handy-Fernsteuerung, Gast-Klicker, Timer und den Meldungen von Master-Link und Steuerserver
// entstehen die Props der Panel-Abschnitte, die Statusleiste, das ON AIR des Kopfes, die Haupttasten von Editor und Referent
// und die Kürzel-Weiche für Textfelder.
// Kein window, kein IPC, kein localStorage, kein React und kein lib/pdf.ts: Die Tests laden nur diese Datei. Statusleiste und
// Panel nutzen dieselben Ableitungen (eine Wahrheit). Keine Taste bekommt eine neue Wirkung; die Kürzel sind der bisherige
// switch aus usePresentation.ts hinter dem Filter B10.
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
  NDI_TEXTE,
  type NdiOutputSectionProps,
  ndiOutputView,
  type PeerRow,
  peerZeileStatus,
  type PeersSectionProps,
  REMOTE_TEXTE,
  type RemoteControlSectionProps,
  remoteControlView,
  type ScreenOutputSectionProps,
  SCREEN_TEXTE,
} from '@jm/settings';
import { masterLinkStatusItem, unbekannt, zahlText, type StatusItem } from '@jm/ui';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { statusText, type GastKlickerStatus } from '@shared/gast-klicker';
import { NDI_NAME, nurNdiBehalten } from '@shared/ndi';
import type { DisplayInfo, JmprApi, MasterLinkMeldungZeile, NdiStatus, PresentationState, RemoteStatus, TimerSyncConfig } from '@shared/types';
import { naechsterIndex } from '@shared/wiedergabe';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  ausgabe: 'ausgabe',
  ndi: 'ndi',
  fernsteuerung: 'fernsteuerung',
  handy: 'handy',
  gastKlicker: 'gast-klicker',
  timer: 'timer',
  import: 'import',
} as const;

/**
 * Feste Texte des Presenters (kein ASCII-Anführungszeichen). Übernommen: „Keine sichtbaren Folien zum Präsentieren.“
 * (Toolbar.tsx:81), „Keiner – nur NDI“ (Toolbar.tsx:183, PresenterView.tsx:91), „JM Timer“ (TimerBar.tsx:138),
 * „Handy-Fernsteuerung“ (PresenterView.tsx:135). Die Tasten heißen wie im Plan (App-Werte): „Präsentieren“, „Beenden“, „Zurück“
 * und „Weiter“ ohne die Zeichen ▶ ■ ‹ › der alten Knöpfe; Schwarz und Weiß ersetzen ⬛ und ⬜. Alles Übrige ist neu (Z1).
 */
export const PRESENTER_TEXTE = {
  /** Haupttasten. Schwarz und Weiß sind Umschalter ohne Sendezustand (B6): bereit, mit „ · an“, solange die Pause steht. */
  taste: {
    praesentieren: 'Präsentieren',
    beenden: 'Beenden',
    zurueck: 'Zurück',
    weiter: 'Weiter',
    schwarz: 'Schwarz',
    weiss: 'Weiß',
    an: ' · an',
  },
  /** Angezeigte Kürzel: je eines der vorhandenen (N2b 1.7), keine neuen. */
  kuerzel: { schwarz: 'B', zurueck: '←', weiter: '→', weiss: 'W' },
  /** Gründe gesperrter Tasten (gesperrt nie ohne Grund). `zustandOffen` gilt nur vor der ersten Antwort des Hauptprozesses. */
  grund: {
    zustandOffen: 'Lädt …',
    keineFolien: 'Keine sichtbaren Folien zum Präsentieren.',
    /** Nur falls `busy.label` leer wäre (heute setzt der Store immer einen Text). */
    beschaeftigt: 'Beschäftigt …',
    ersteFolie: 'Erste Folie',
    letzteFolie: 'Letzte Folie',
  },
  /** Publikumsfenster (B11). „aus“ und „aus, Fenster noch offen“ kommen aus @jm/settings. */
  publikum: {
    titel: 'Publikum',
    nurNdi: 'Keiner – nur NDI',
    trenner: ' · ',
    /** Sperrgrund des Abschnitts `ausgabe`, solange die Wahl „Keiner – nur NDI“ steht. */
    nurNdiGewaehlt: '„Keiner – nur NDI“ ist gewählt.',
  },
  /** NDI: nur, wenn der Hauptprozess bei „nicht verfügbar“ keinen Grund mitschickt. */
  ndi: { nichtVerfuegbar: 'nicht verfügbar' },
  timer: { titel: 'JM Timer' },
  handy: { titel: 'Handy-Fernsteuerung', laeuft: 'läuft' },
  /** Übrige Zustände wörtlich aus statusText (shared/gast-klicker.ts), wie im Abschnitt. */
  gastKlicker: { titel: 'Gast-Klicker', pausiert: 'pausiert' },
  praesentation: {
    titel: 'Präsentation',
    keine: 'keine',
    folie: (n: number, m: number): string => `Folie ${zahlText(n)} von ${zahlText(m)}`,
  },
  companionModul: 'JM Presenter',
} as const;

export interface OberflaechenStand {
  /** Präsentationszustand des Hauptprozesses (`present:state`); undefined = noch keine Antwort. */
  praesentation: PresentationState | undefined;
  /** Bildschirmliste (`present.displays()`), `current` = dort steht das Publikumsfenster; undefined = noch keine Antwort. */
  bildschirme: DisplayInfo[] | undefined;
  /** NDI-Ausgang (`ndi:status`); undefined = noch keine Antwort. */
  ndi: NdiStatus | undefined;
  /** Handy-Fernsteuerung (`remote:status`); undefined = noch keine Antwort. */
  handy: RemoteStatus | undefined;
  /** Gast-Klicker (`gastKlicker:status`); undefined = noch keine Antwort. */
  gastKlicker: GastKlickerStatus | undefined;
  /** Timer-Sync: Einstellung und gemessene Verbindung; undefined, solange eines davon fehlt. */
  timer: { config: TimerSyncConfig; verbunden: boolean } | undefined;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8728): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
  /** Welches Bedienfenster: Sprungziele der Statusleiste nur zu Abschnitten, die im Panel dieses Fensters stehen. */
  fenster: 'editor' | 'referent';
  /** `window.jmpr.platform`; NDI gibt es nur unter Windows. */
  plattform: string;
}

/** Aktionen des Panels: die Wurzel-View ruft damit `window.jmpr` erst im Rückruf. */
export interface PresenterAktionen {
  /** Editor: Startbildschirm merken, nur in der Wurzel-View (B11); öffnet und verschiebt nichts. */
  startBildschirmWaehlen(id: number | null): void;
  ndiSchalten(an: boolean): void;
  timerSchalten(an: boolean): void;
  timerSetzen(host: string, port: number): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung und, wo es eines gibt, dem angezeigten Kürzel. */
export type Haupttaste = TasteZustand & { label: string; shortcut?: string };

/** Die Zeile des Publikumsfensters, falls die Liste bekannt ist und eine Zeile `current` trägt. */
function publikumsBildschirm(s: Pick<OberflaechenStand, 'bildschirme'>): DisplayInfo | undefined {
  return s.bildschirme?.find((d) => d.current);
}

/**
 * Präsentation läuft ohne Publikumsfenster („Keiner – nur NDI“): `active`, Liste bekannt, keine Zeile mit `current`. Eine
 * unbekannte Liste heißt nur „noch keine Antwort“, nie „nur NDI“. Dieselbe Ableitung für `publikum` und `ausgabeAbschnitt`.
 */
export function nurNdiLaeuft(s: Pick<OberflaechenStand, 'praesentation' | 'bildschirme'>): boolean {
  return s.praesentation?.active === true && s.bildschirme !== undefined && publikumsBildschirm(s) === undefined;
}

/** Steht die Wahl „Keiner – nur NDI“ für den nächsten Start? Wie startZielFuer (shared/ndi.ts): nur solange nurNdiBehalten. */
function nurNdiSteht(s: Pick<OberflaechenStand, 'ndi' | 'plattform'>, startWahl: { nurNdi: boolean }): boolean {
  return s.plattform === 'win32' && startWahl.nurNdi && s.ndi !== undefined && nurNdiBehalten(s.ndi);
}

/**
 * Ausgabe auf Bildschirm (nur Editor, B11): wählt den Startbildschirm (`startWahl.bildschirm`, gemerkt in der Wurzel-View).
 * `enabled` = Präsentation läuft und nicht „nur NDI“, so zeigt die Pille bei „nur NDI“ „aus“ statt eines Fehlers.
 * `windowOpen` und `measuredId` kommen aus der Liste (`current`), nie aus der Wahl. Kein Schalter, kein Vollbild (nicht
 * gemessen), kein Hintergrund. Steht „Keiner – nur NDI“, ist der Abschnitt gesperrt.
 */
export function ausgabeAbschnitt(
  s: OberflaechenStand,
  startWahl: { bildschirm: number | null; nurNdi: boolean },
  a?: Pick<PresenterAktionen, 'startBildschirmWaehlen'>,
): ScreenOutputSectionProps {
  const publikum = publikumsBildschirm(s);
  return {
    id: ABSCHNITT.ausgabe,
    enabled: s.praesentation?.active === true && !nurNdiLaeuft(s),
    windowOpen: s.bildschirme === undefined ? undefined : publikum !== undefined,
    screens: s.bildschirme?.map((d) => ({ id: d.id, label: d.label, primary: d.primary })),
    selectedId: startWahl.bildschirm,
    measuredId: publikum?.id,
    ...(nurNdiSteht(s, startWahl) ? { locked: PRESENTER_TEXTE.publikum.nurNdiGewaehlt } : {}),
    capabilities: { toggle: false, fullscreen: false, background: false },
    ...(a === undefined ? {} : { onSelect: (id: number | null) => a.startBildschirmWaehlen(id) }),
  };
}

/**
 * NDI-Ausgabe (nur Windows): Schalter = `an`, „sendet“ und „startet“ gemessen, Empfänger nur beim Senden (nie eine erfundene 0).
 * „nicht verfügbar“ steht als Fehler mit dem Grund des Hauptprozesses. Name, Auflösung und Bildrate sind fest (shared/ndi.ts).
 */
export function ndiAbschnitt(s: Pick<OberflaechenStand, 'ndi'>, a?: Pick<PresenterAktionen, 'ndiSchalten'>): NdiOutputSectionProps {
  const n = s.ndi;
  const nichtVerfuegbar = n?.lage === 'nicht-verfuegbar';
  return {
    id: ABSCHNITT.ndi,
    enabled: n?.an === true,
    sending: n === undefined ? undefined : n.lage === 'sendet',
    starting: n?.lage === 'startet',
    sourceName: NDI_NAME,
    receivers: n?.lage === 'sendet' ? n.empfaenger : undefined,
    ...(nichtVerfuegbar ? { error: n.grund?.trim() || PRESENTER_TEXTE.ndi.nichtVerfuegbar } : {}),
    capabilities: { toggle: true },
    ...(a === undefined ? {} : { onToggle: (an: boolean) => a.ndiSchalten(an) }),
  };
}

/** Fernsteuerung: Meldung des Steuerservers (Port 8728), Einrichten nur im Launcher. */
export function fernsteuerungAbschnitt(s: Pick<OberflaechenStand, 'fernsteuerung'>): RemoteControlSectionProps {
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
    companionModule: PRESENTER_TEXTE.companionModul,
    capabilities: {},
  };
}

const TIMER_PORT = 7777;

/** Die eine Zeile „JM Timer“: Ein/Aus und Host/Port aus der Einstellung, `connected` gemessen; ohne Auto (keine Quelle). */
function timerZeile(s: Pick<OberflaechenStand, 'timer'>): PeerRow {
  const t = s.timer;
  return {
    role: 'timer',
    label: PRESENTER_TEXTE.timer.titel,
    host: t?.config.host ?? '',
    port: t?.config.port ?? TIMER_PORT,
    defaultPort: TIMER_PORT,
    enabled: t?.config.enabled,
    connected: t?.verbunden,
  };
}

/** Timer-Sync als Gegenstelle (Modell Stage-Display, W15): Ein/Aus je Zeile, Setzen von Host und Port, kein Auto. */
export function timerAbschnitt(s: Pick<OberflaechenStand, 'timer'>, a?: Pick<PresenterAktionen, 'timerSchalten' | 'timerSetzen'>): PeersSectionProps {
  return {
    id: ABSCHNITT.timer,
    peers: [timerZeile(s)],
    capabilities: { toggle: true },
    ...(a === undefined
      ? {}
      : {
          onToggle: (_role: string, an: boolean) => a.timerSchalten(an),
          onSet: (_role: string, host: string, port: number) => a.timerSetzen(host, port),
        }),
  };
}

/** Timer: dieselbe Zeile wie im Panel (peerZeileStatus): unbekannt, aus, verbunden, nicht gefunden. */
function timerItem(s: OberflaechenStand): StatusItem {
  const st = peerZeileStatus(timerZeile(s));
  return { id: ABSCHNITT.timer, group: 'verbindung', label: PRESENTER_TEXTE.timer.titel, settingsSection: ABSCHNITT.timer, state: st.state, detail: st.text };
}

/**
 * Publikum (B11): wo das Publikumsfenster gemessen steht. Ohne Antwort (Präsentation oder Liste) unbekannt; läuft die
 * Präsentation, nennt der Eintrag den Bildschirm mit `current` oder „Keiner – nur NDI“. Ohne Präsentation „aus“; steht das
 * Fenster dann noch gemessen auf einem Bildschirm, warnt der Eintrag wie die Pille des Abschnitts („aus, Fenster noch offen“).
 * Sprungziel nur im Editor: Der Referent hat keinen Abschnitt `ausgabe`.
 */
function publikumItem(s: OberflaechenStand): StatusItem {
  const T = PRESENTER_TEXTE.publikum;
  const kopf = {
    id: 'publikum',
    group: 'ausgabe',
    label: T.titel,
    ...(s.fenster === 'editor' ? { settingsSection: ABSCHNITT.ausgabe } : {}),
  } as const;
  if (s.praesentation === undefined || s.bildschirme === undefined) return unbekannt(kopf);
  if (nurNdiLaeuft(s)) return { ...kopf, state: 'off', detail: T.nurNdi };
  const publikum = publikumsBildschirm(s);
  if (publikum === undefined) return { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
  return s.praesentation.active
    ? { ...kopf, state: 'ok', detail: publikum.label }
    : { ...kopf, state: 'warn', detail: `${SCREEN_TEXTE.ausFensterOffen}${T.trenner}${publikum.label}` };
}

/** NDI (nur Windows): Ansicht des Abschnitts; „sendet, n Empfänger“ wie in der Caption; vor der ersten Antwort unbekannt. */
function ndiItem(s: OberflaechenStand): StatusItem {
  const kopf = { id: ABSCHNITT.ndi, group: 'ausgabe', label: NDI_TEXTE.titel, settingsSection: ABSCHNITT.ndi } as const;
  if (s.ndi === undefined) return unbekannt(kopf);
  const v = ndiOutputView(ndiAbschnitt(s));
  const mitZahl = v.status.state === 'ok' && v.empfaenger !== undefined ? `${v.status.text}, ${v.empfaenger}` : undefined;
  return abschnittStatusItem(v, { group: 'ausgabe', label: NDI_TEXTE.titel, ...(mitZahl === undefined ? {} : { detail: mitZahl }) });
}

/** Handy-Fernsteuerung: Fehler des Servers (wörtlich vom Hauptprozess) vor „läuft“, sonst „aus“. */
function handyItem(s: OberflaechenStand): StatusItem {
  const T = PRESENTER_TEXTE.handy;
  const kopf = { id: 'handy', group: 'fernsteuerung', label: T.titel, settingsSection: ABSCHNITT.handy } as const;
  const h = s.handy;
  if (h === undefined) return unbekannt(kopf);
  if (h.error !== null) return { ...kopf, state: 'error', detail: h.error };
  return h.running ? { ...kopf, state: 'ok', detail: T.laeuft } : { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
}

/**
 * Gast-Klicker: aus; verbindet und getrennt (verbindet neu) warnen; abgelehnt ist ein Fehler (nur Aus und wieder Ein hilft);
 * verbunden mit Gästezahl, pausiert warnt (Gäste können nicht blättern). Texte wie im Abschnitt (statusText).
 */
function gastKlickerItem(s: OberflaechenStand): StatusItem {
  const kopf = { id: 'gast-klicker', group: 'fernsteuerung', label: PRESENTER_TEXTE.gastKlicker.titel, settingsSection: ABSCHNITT.gastKlicker } as const;
  const g = s.gastKlicker;
  if (g === undefined) return unbekannt(kopf);
  if (!g.an || g.lage === 'aus') return { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
  switch (g.lage) {
    case 'verbindet':
    case 'getrennt':
      return { ...kopf, state: 'warn', detail: statusText(g) };
    case 'abgelehnt':
      return { ...kopf, state: 'error', detail: statusText(g) };
    case 'verbunden':
      return g.pausiert ? { ...kopf, state: 'warn', detail: PRESENTER_TEXTE.gastKlicker.pausiert } : { ...kopf, state: 'ok', detail: statusText(g) };
  }
}

/** Präsentation: keine, Folie n von m, Schwarz oder Weiß (Pause; das Publikum sieht keine Folie, darum warn). Nie live. */
function praesentationItem(s: OberflaechenStand): StatusItem {
  const T = PRESENTER_TEXTE;
  const kopf = { id: 'praesentation', group: 'tool', label: T.praesentation.titel } as const;
  const p = s.praesentation;
  if (p === undefined) return unbekannt(kopf);
  if (!p.active) return { ...kopf, state: 'off', detail: T.praesentation.keine };
  if (p.screen === 'black') return { ...kopf, state: 'warn', detail: T.taste.schwarz };
  if (p.screen === 'white') return { ...kopf, state: 'warn', detail: T.taste.weiss };
  return { ...kopf, state: 'ok', detail: T.praesentation.folie(p.index + 1, p.total) };
}

/** Statusleiste in fester Reihenfolge: master-link, timer, publikum, ndi (nur Windows), fernsteuerung, handy, gast-klicker, praesentation. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    timerItem(s),
    publikumItem(s),
    ...(s.plattform === 'win32' ? [ndiItem(s)] : []),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    handyItem(s),
    gastKlickerItem(s),
    praesentationItem(s),
  ];
}

/** Das Publikum sieht Folien: Präsentation läuft und keine Pause (dieselbe Regel wie STATE `live`, main/suite-state.ts). */
const publikumSiehtFolien = (s: Pick<OberflaechenStand, 'praesentation'>): boolean => s.praesentation?.active === true && s.praesentation.screen === 'live';

/** ON AIR (B3), in Editor und Referent: `active && screen === 'live'`; ohne Antwort nicht live. Kein Label (Kopf-Vorgabe). */
export function kopfOnAir(s: Pick<OberflaechenStand, 'praesentation'>): { live: boolean } {
  return { live: publikumSiehtFolien(s) };
}

/**
 * Haupttaste des Editors (B14): „Beenden“ (`present.stop()`) während jeder Präsentation, nie gesperrt, live nach derselben Regel
 * wie das ON AIR im Kopf. Sonst „Präsentieren“ (`present.start(…)`), gesperrt wie heute bei `busy.active` (Grund `busy.label`)
 * oder ohne sichtbare Folie (Grund wie die alte Fehlermeldung), vor der ersten Antwort mit „Lädt …“. Kein Kürzel.
 */
export function editorTaste(s: Pick<OberflaechenStand, 'praesentation'>, sichtbar: number, busy: { active: boolean; label: string }): Haupttaste {
  const T = PRESENTER_TEXTE;
  const p = s.praesentation;
  if (p === undefined) return { label: T.taste.praesentieren, state: 'gesperrt', disabledReason: T.grund.zustandOffen };
  if (p.active) return { label: T.taste.beenden, state: publikumSiehtFolien(s) ? 'live' : 'bereit' };
  if (busy.active) return { label: T.taste.praesentieren, state: 'gesperrt', disabledReason: busy.label.trim() || T.grund.beschaeftigt };
  if (sichtbar <= 0) return { label: T.taste.praesentieren, state: 'gesperrt', disabledReason: T.grund.keineFolien };
  return { label: T.taste.praesentieren, state: 'bereit' };
}

/**
 * Haupttasten des Referenten (B12, B13, B6): Zurück gesperrt bei `index <= 0` („Erste Folie“); Weiter gesperrt nur, wenn
 * `naechsterIndex` auf der Folie bliebe („Letzte Folie“), mit Schleife also auf der letzten Folie bedienbar (der Main springt zur
 * ersten). Schwarz und Weiß sind Umschalter: immer bereit, „ · an“ solange die Pause steht; nie live (B3). Vor der ersten
 * Antwort alle gesperrt mit „Lädt …“.
 */
export function referentTasten(s: Pick<OberflaechenStand, 'praesentation'>): { schwarz: Haupttaste; zurueck: Haupttaste; weiter: Haupttaste; weiss: Haupttaste } {
  const T = PRESENTER_TEXTE;
  const K = T.kuerzel;
  const p = s.praesentation;
  const taste = (label: string, shortcut: string, grund?: string): Haupttaste =>
    grund === undefined ? { label, state: 'bereit', shortcut } : { label, state: 'gesperrt', disabledReason: grund, shortcut };
  if (p === undefined) {
    const g = T.grund.zustandOffen;
    return { schwarz: taste(T.taste.schwarz, K.schwarz, g), zurueck: taste(T.taste.zurueck, K.zurueck, g), weiter: taste(T.taste.weiter, K.weiter, g), weiss: taste(T.taste.weiss, K.weiss, g) };
  }
  return {
    schwarz: taste(p.screen === 'black' ? `${T.taste.schwarz}${T.taste.an}` : T.taste.schwarz, K.schwarz),
    zurueck: taste(T.taste.zurueck, K.zurueck, p.index <= 0 ? T.grund.ersteFolie : undefined),
    weiter: taste(T.taste.weiter, K.weiter, naechsterIndex(p.index, p.total, p.schleife === true) === p.index ? T.grund.letzteFolie : undefined),
    weiss: taste(p.screen === 'white' ? `${T.taste.weiss}${T.taste.an}` : T.taste.weiss, K.weiss),
  };
}

/**
 * „Auf diesen Bildschirm“ im Referenten (B11): Die Auswahl merkt nur, der Knopf verschiebt (`assignAudience`). Bedienbar nur,
 * wenn das Publikumsfenster gemessen auf einem Bildschirm steht und die Wahl ein anderer Bildschirm der Liste ist.
 */
export function verschiebenMoeglich(s: Pick<OberflaechenStand, 'praesentation' | 'bildschirme'>, gewaehlt: number | null): boolean {
  const publikum = publikumsBildschirm(s);
  return (
    s.praesentation?.active === true &&
    publikum !== undefined &&
    gewaehlt !== null &&
    gewaehlt !== publikum.id &&
    s.bildschirme?.some((d) => d.id === gewaehlt) === true
  );
}

/** Eingabetypen von `input`, die keine Textfelder sind (B10): dort wirken die Kürzel weiter. */
const KEIN_TEXTFELD = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'color']);

/**
 * Ist das Ziel eines Tastendrucks ein Textfeld (B10)? `textarea`, contentEditable und `input` außer checkbox, radio, range,
 * button, submit und color. Bewusst anders als `istEingabeZiel` aus 2a (Prompter): `select` zählt hier nicht, damit der
 * Klicker (Bild↓, Pfeile) auch bei fokussierter Bildschirmwahl weiterblättert; `preventDefault` hält die Auswahl fest. Knöpfe
 * zählen ebenfalls nicht. Ohne DOM nutzbar: gelesen werden nur tagName, type und isContentEditable.
 */
export function istTextfeld(ziel: EventTarget | null): boolean {
  if (ziel === null) return false;
  const t = ziel as { tagName?: unknown; type?: unknown; isContentEditable?: unknown };
  if (t.isContentEditable === true) return true;
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  return !KEIN_TEXTFELD.has(typeof t.type === 'string' ? t.type.toLowerCase() : 'text');
}

/** Strg+W bzw. Cmd+W: schließt über das Electron-Standardmenü das Fenster, wenn niemand preventDefault ruft. */
const istFensterSchliessen = (e: { key: string; ctrlKey?: boolean; metaKey?: boolean }): boolean =>
  (e.key === 'w' || e.key === 'W') && (e.ctrlKey === true || e.metaKey === true);

/**
 * Tastatur und USB-Klicker in Referent und Publikum (N2b 1.7): der bisherige switch aus usePresentation.ts, unverändert, hinter
 * dem Filter B10 (aus einem Textfeld wirkt kein Kürzel, auch kein preventDefault). Einzige Ausnahme im Textfeld: Strg+W bzw.
 * Cmd+W ruft nur preventDefault (Controller-Entscheid zu Task 9): Sonst schlösse das Standardmenü das Fenster, und das beendet
 * die Präsentation; bisher fing der switch die Taste ab. Außerhalb von Feldern prüft er Zusatztasten wie bisher nicht
 * (Strg+W schaltet Weiß).
 */
export function verarbeiteTaste(
  e: { key: string; target: EventTarget | null; preventDefault(): void; ctrlKey?: boolean; metaKey?: boolean },
  present: Pick<JmprApi['present'], 'next' | 'prev' | 'goto' | 'setScreen' | 'stop'>,
): void {
  if (istTextfeld(e.target)) {
    if (istFensterSchliessen(e)) e.preventDefault();
    return;
  }
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
    case 'Enter':
      e.preventDefault();
      void present.next();
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
    case 'Backspace':
      e.preventDefault();
      void present.prev();
      break;
    case 'Home':
      e.preventDefault();
      void present.goto(0);
      break;
    case 'End':
      e.preventDefault();
      void present.goto(9999);
      break;
    // PowerPoint-style pause screens: B = black, W = white (toggle).
    case 'b':
    case 'B':
    case '.':
      e.preventDefault();
      void present.setScreen('black');
      break;
    case 'w':
    case 'W':
    case ',':
      e.preventDefault();
      void present.setScreen('white');
      break;
    case 'Escape':
      e.preventDefault();
      void present.stop();
      break;
    default:
      break;
  }
}
