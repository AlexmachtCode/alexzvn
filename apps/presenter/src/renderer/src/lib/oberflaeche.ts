// Presenter-Oberfläche: reine Ableitungen (UX Welle 2b, Presenter c; Spec 5.1, 7.1–7.4, B3 ON AIR, B10 Tastenfilter,
// B11 Bildschirm, B13 Sperren). Aus dem Präsentationszustand des Hauptprozesses, der Bildschirmliste (`current` = dort steht
// das Publikumsfenster), NDI, Handy-Fernsteuerung, Gast-Klicker, Timer und den Meldungen von Master-Link und Steuerserver
// entstehen die Props der Panel-Abschnitte, die Statusleiste, das ON AIR des Kopfes, die Haupttasten von Editor und Referent,
// Wahl und Sperrgrund von „Auf diesen Bildschirm“ (d2) und die Kürzel-Weiche für Textfelder samt Schutz vor Strg+W.
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
  screenOutputView,
  SCREEN_TEXTE,
} from '@jm/settings';
import { masterLinkStatusItem, unbekannt, UNBEKANNT, zahlText, type StatusItem } from '@jm/ui';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { statusText, type GastKlickerStatus } from '@shared/gast-klicker';
import { NDI_NAME, ndiLiefertBild, nurNdiBehalten } from '@shared/ndi';
import type { DisplayInfo, JmprApi, MasterLinkMeldungZeile, NdiStatus, NetInterface, PresentationState, RemoteStatus, TimerSource, TimerSyncConfig } from '@shared/types';
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
    /** Kopf-Aktion des Referenten (B7), wörtlich der alte Knopf ganz rechts im Kopf; als title das vorhandene Kürzel Esc (neu, Z1). */
    kopfBeenden: '■ Beenden',
    kopfBeendenKuerzel: 'Esc',
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
    /** Sperrgrund der Zeile „Keiner – nur NDI“ (Editor-Panel), solange NDI kein Bild liefert und die Wahl nicht steht. Neu (Z1). */
    nurNdiGesperrt: 'Erst wählbar, wenn NDI ein Bild liefert.',
    /** Tooltip der Bildschirmwahl im Referenten, wörtlich (PresenterView.tsx:86). */
    bildschirmWahl: 'Publikums-Bildschirm',
    /** Ohne Publikumsfenster bei laufender Präsentation, wörtlich der alte Tooltip von „Publikum Vollbild“ (PresenterView.tsx:121). */
    keinFensterNurNdi: 'Kein Publikumsfenster – Bild nur über NDI',
  },
  /**
   * „Auf diesen Bildschirm“ im Referenten (B11): Beschriftung wie im Plan, die Sperrgründe (als title) sind neu (Z1). „Bildschirm
   * fehlt“ kommt aus @jm/settings (SCREEN_TEXTE.bildschirmFehlt), „Kein Publikumsfenster – Bild nur über NDI“ steht unter publikum.
   */
  verschieben: {
    knopf: 'Auf diesen Bildschirm',
    unbekannt: 'Bildschirm des Publikums unbekannt',
    keinFenster: 'Kein Publikumsfenster',
    keineWahl: 'Kein Bildschirm gewählt',
    gleich: 'Das Publikum steht schon auf diesem Bildschirm.',
  },
  /**
   * NDI: `nichtVerfuegbar` nur, wenn der Hauptprozess bei „nicht verfügbar“ keinen Grund mitschickt. `tipp` wörtlich aus dem
   * Tooltip des Schalters (NdiSchalter.tsx), im Panel als Hinweis zu Name, Auflösung und Bildrate. `schalterUnbekannt` ist neu (Z1):
   * der Schalter vor der ersten Antwort, statt eines erfundenen „NDI aus“.
   */
  ndi: {
    nichtVerfuegbar: 'nicht verfügbar',
    tipp: 'NDI-Ausgang „JM Presenter“: 1920×1080, 25 fps, transparente Ränder',
    schalterUnbekannt: `NDI ${UNBEKANNT}`,
  },
  /** Timer: `erklaerung` wörtlich aus dem alten ⚙-Menü (Toolbar.tsx:249-251). */
  timer: { titel: 'JM Timer', erklaerung: 'Zeigt den Countdown des JM Timers live in der Referentenansicht.' },
  /** Handy-Fernsteuerung: alle Texte außer `titel` und `laeuft` wörtlich aus dem alten Fenster (RemotePanel.tsx). */
  handy: {
    titel: 'Handy-Fernsteuerung',
    laeuft: 'läuft',
    erklaerung: 'Steuere die Präsentation vom Handy oder Tablet im selben Netzwerk.',
    serverAn: 'Server aktiv',
    serverAus: 'Server aus',
    hinweisAn: 'Telefone können sich verbinden.',
    hinweisAus: 'Einschalten, um ein Gerät zu koppeln.',
    netzwerkkarte: 'Netzwerkkarte',
    pin: 'PIN-Schutz (empfohlen im offenen WLAN)',
    amHandy: 'Am Handy öffnen',
    pinTitel: 'PIN',
    ohnePin: 'Ohne PIN — jeder im Netzwerk kann steuern.',
    qrAlt: 'QR',
    /** Sperrgründe von „Setzen“ (Netzwerkkarte und Port wirken erst damit, Wahl ≠ Bewegung; neu in Task 12, Z1). */
    setzenUnveraendert: 'Netzwerkkarte und Port sind schon so eingestellt.',
    setzenPort: 'Setzen geht erst mit einem Port von 1024 bis 65535.',
    setzenLaeuft: 'Wird angewendet …',
  },
  /**
   * Gast-Klicker: übrige Zustände wörtlich aus statusText (shared/gast-klicker.ts), wie im Abschnitt; alles außer `titel` und
   * `pausiert` wörtlich aus GastKlickerAbschnitt.tsx, `neuerLinkFrage` ist der Text des window.confirm.
   */
  gastKlicker: {
    titel: 'Gast-Klicker',
    pausiert: 'pausiert',
    erklaerung: 'Remote-Gäste öffnen einen Link im Browser und schalten ihre Folien selbst weiter – ohne Installation.',
    an: 'Gast-Klicker an',
    aus: 'Gast-Klicker aus',
    schalter: 'Gast-Klicker ein/aus',
    link: 'Link für die Gäste',
    kopieren: 'Für den Zoom-Chat kopieren',
    kopiert: 'Kopiert ✓',
    pausieren: 'Gast-Klick pausieren',
    fortsetzen: 'Gast-Klick fortsetzen',
    neuerLink: 'Neuer Link',
    neuerLinkFrage: 'Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.',
    hinweis: 'Wer den Link hat, kann vor/zurück klicken. Ist Publikum im Chat, den Link privat an den Gast schicken. Dein eigener Clicker und die Tastatur wirken immer.',
  },
  /** Import (Editor-Panel): `titel` ist neu (Z1), die übrigen Texte wörtlich aus dem alten ⚙-Menü (Toolbar.tsx:215-222). */
  import: {
    titel: 'Import',
    einzelschritte: 'PPTX-Aufbau-Animationen als Einzelschritte',
    experimentell: 'experimentell',
    erklaerung: 'Splittet On-Click-Animationen beim Office-Import in einzelne Folien. Bei Problemen wird automatisch auf das flache PDF zurückgefallen.',
  },
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
  /** Netzwerkkarten des Handy-Servers (`remote.interfaces()`, gelesen beim Öffnen des Panels); undefined = noch nicht gelesen. */
  netzwerkkarten: NetInterface[] | undefined;
  /** Live-Zustand des JM Timers (`timer:state`) für die Timer-Leiste des Referenten; undefined = noch keine Antwort. */
  timerZustand: TimerSource | undefined;
  /** Vollbild des Referentenfensters (`present:referentVollbild`, Push bei jedem Wechsel); nur der Referent liest es, sonst undefined. */
  referentVollbild: boolean | undefined;
}

/** Aktionen des Panels: die Wurzel-View ruft damit `window.jmpr` erst im Rückruf. */
export interface PresenterAktionen {
  /** Editor: Startbildschirm merken, nur in der Wurzel-View (B11); öffnet und verschiebt nichts. */
  startBildschirmWaehlen(id: number | null): void;
  ndiSchalten(an: boolean): void;
  timerSchalten(an: boolean): void;
  timerSetzen(host: string, port: number): void;
}

/**
 * Aktionen des Referenten (Leiste, Haupttasten, Übersicht, Kopf-Aktion): die Wurzel-View ruft damit `window.jmpr.present` erst im
 * Rückruf, jede mit dem bisherigen Befehl (prev, next, goto, setScreen, setSchleife, toggleAudienceFullscreen,
 * toggleReferentVollbild, assignAudience, stop). NDI und Gast-Klick nutzen die Panel-Aktionen.
 */
export interface ReferentAktionen {
  zurueck(): void;
  weiter(): void;
  geheZu(index: number): void;
  schwarz(): void;
  weiss(): void;
  schleife(an: boolean): void;
  publikumVollbild(): void;
  vollbild(): void;
  /** „Auf diesen Bildschirm“ (B11): das Publikum auf den gewählten Bildschirm verschieben. */
  verschieben(bildschirm: number): void;
  beenden(): void;
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

/**
 * Startwahl des Editors (B11), gemerkt nur in der Wurzel-View: Startbildschirm und „Keiner – nur NDI“. Der Editor reicht als
 * `bildschirm` immer eine echte id (startBildschirm); null nur, solange keine Bildschirmliste bekannt ist.
 */
export interface StartWahl {
  bildschirm: number | null;
  nurNdi: boolean;
}

/** Steht die Wahl „Keiner – nur NDI“ für den nächsten Start? Wie startZielFuer (shared/ndi.ts): nur solange nurNdiBehalten. */
function nurNdiSteht(s: Pick<OberflaechenStand, 'ndi' | 'plattform'>, startWahl: Pick<StartWahl, 'nurNdi'>): boolean {
  return s.plattform === 'win32' && startWahl.nurNdi && s.ndi !== undefined && nurNdiBehalten(s.ndi);
}

/**
 * Vorgabe des Startbildschirms (B11, wie bisher Toolbar.tsx:49-51): der erste nicht-primäre Bildschirm der Liste, sonst der
 * erste; ohne bekannte oder mit leerer Liste keine (null). Das ist auch, wohin der Main bei `null` öffnet (main/windows.ts:199-203).
 */
export function vorgabeBildschirm(liste: readonly DisplayInfo[] | undefined): number | null {
  return liste?.find((d) => !d.primary)?.id ?? liste?.[0]?.id ?? null;
}

/**
 * Startbildschirm für Abschnitt, Statusleiste und Start: die Wahl der Wurzel-View (undefined = noch nichts gewählt), sonst die
 * Vorgabe aus der aktuellen Liste, immer als echte id. So bietet die Auswahl nie „Automatisch (Hauptmonitor)“ an, während der
 * Main bei `null` den zweiten Bildschirm nähme. Eine gewählte, aber fehlende id bleibt stehen (der Abschnitt meldet „Bildschirm
 * fehlt“, die Auswahl springt nie still um).
 */
export function startBildschirm(gewaehlt: number | undefined, liste: readonly DisplayInfo[] | undefined): number | null {
  return gewaehlt ?? vorgabeBildschirm(liste);
}

/**
 * Was die Wurzel-View aus einer Wahl im Abschnitt `ausgabe` merkt: eine id bleibt; „Automatisch (Hauptmonitor)“ (null) wird zur
 * id des Hauptbildschirms, denn der Main öffnete bei `null` den ersten nicht-primären (Anzeige und Main stimmen so überein). Ohne
 * bekannten Hauptbildschirm undefined: dann gilt wieder die Vorgabe.
 */
export function bildschirmWahl(id: number | null, liste: readonly DisplayInfo[] | undefined): number | undefined {
  return id ?? liste?.find((d) => d.primary)?.id;
}

/**
 * Zeile „Keiner – nur NDI“ unter dem Abschnitt `ausgabe` (B11): nur im Editor unter Windows. An, solange die Wahl steht (wie
 * startZielFuer). Gesperrt mit Grund, solange NDI kein Bild liefert und die Wahl nicht schon steht (Regel Toolbar.tsx:181-185); vor
 * der ersten NDI-Antwort ebenso gesperrt.
 */
export function nurNdiZeile(s: Pick<OberflaechenStand, 'ndi' | 'plattform' | 'fenster'>, startWahl: Pick<StartWahl, 'nurNdi'>): { sichtbar: boolean; an: boolean; gesperrt?: string } {
  const an = nurNdiSteht(s, startWahl);
  const waehlbar = s.ndi !== undefined && ndiLiefertBild(s.ndi);
  return {
    sichtbar: s.fenster === 'editor' && s.plattform === 'win32',
    an,
    ...(waehlbar || an ? {} : { gesperrt: PRESENTER_TEXTE.publikum.nurNdiGesperrt }),
  };
}

/** Der gewählte Startbildschirm steht nicht (mehr) in der bekannten Liste (abgesteckt oder neue Display-id nach dem Wiederverbinden). */
function wahlFehlt(s: Pick<OberflaechenStand, 'bildschirme'>, startWahl: Pick<StartWahl, 'bildschirm'>): boolean {
  return startWahl.bildschirm !== null && s.bildschirme !== undefined && !s.bildschirme.some((d) => d.id === startWahl.bildschirm);
}

/**
 * Ausgabe auf Bildschirm (nur Editor, B11): wählt den Startbildschirm (`startWahl.bildschirm`, gemerkt in der Wurzel-View).
 * `enabled` = Präsentation läuft und nicht „nur NDI“, so zeigt die Pille bei „nur NDI“ „aus“ statt eines Fehlers.
 * `windowOpen` und `measuredId` kommen aus der Liste (`current`), nie aus der Wahl. Kein Schalter, kein Vollbild (nicht
 * gemessen), kein Hintergrund. Steht „Keiner – nur NDI“, ist der Abschnitt gesperrt.
 * Läuft nur NDI und fehlt die Startwahl in der Liste, bekommt der Abschnitt keine Wahl (null): Sonst meldete die Pille
 * „Bildschirm fehlt“ als Fehler (die Prüfung steht in @jm/settings vor `enabled`), während die Statusleiste „Keiner – nur
 * NDI“ zeigt. Außerhalb von „nur NDI“ bleibt die fehlende Wahl stehen und ist ein Fehler, in Pille und Statusleiste gleich.
 */
export function ausgabeAbschnitt(s: OberflaechenStand, startWahl: StartWahl, a?: Pick<PresenterAktionen, 'startBildschirmWaehlen'>): ScreenOutputSectionProps {
  const publikum = publikumsBildschirm(s);
  return {
    id: ABSCHNITT.ausgabe,
    enabled: s.praesentation?.active === true && !nurNdiLaeuft(s),
    windowOpen: s.bildschirme === undefined ? undefined : publikum !== undefined,
    screens: s.bildschirme?.map((d) => ({ id: d.id, label: d.label, primary: d.primary })),
    selectedId: nurNdiLaeuft(s) && wahlFehlt(s, startWahl) ? null : startWahl.bildschirm,
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
 * Mit Startwahl (Editor) gilt außerhalb von „nur NDI“ und ohne gemessen laufendes Publikum: Fehlt die Wahl in der Liste,
 * meldet der Eintrag, was der Abschnitt meldet („Bildschirm fehlt“, aus screenOutputView; eine Wahrheit, nicht nachgebaut).
 * Sprungziel nur im Editor: Der Referent hat keinen Abschnitt `ausgabe` und keine Startwahl.
 */
function publikumItem(s: OberflaechenStand, startWahl?: StartWahl): StatusItem {
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
  if (s.praesentation.active && publikum !== undefined) return { ...kopf, state: 'ok', detail: publikum.label };
  if (startWahl !== undefined && wahlFehlt(s, startWahl)) {
    const v = screenOutputView(ausgabeAbschnitt(s, startWahl));
    return { ...kopf, state: v.status.state, detail: v.status.text };
  }
  return publikum === undefined
    ? { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus }
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

/**
 * Statusleiste in fester Reihenfolge: master-link, timer, publikum, ndi (nur Windows), fernsteuerung, handy, gast-klicker,
 * praesentation. `startWahl` gibt nur der Editor mit (dieselbe wie für `ausgabeAbschnitt`), damit `publikum` eine fehlende
 * Startwahl so meldet wie die Pille des Abschnitts; der Referent ruft ohne.
 */
export function statusLeiste(s: OberflaechenStand, startWahl?: StartWahl): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    timerItem(s),
    publikumItem(s, startWahl),
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
 * Bildschirmwahl des Referenten (B11) für die Auswahl in der Leiste und „Auf diesen Bildschirm“: die in der Wurzel-View gemerkte
 * Wahl, solange sie in der bekannten Liste steht, sonst der gemessene Bildschirm des Publikums (`current`); ohne beides null. So
 * zeigt die Auswahl nie einen Bildschirm, den es nicht gibt, und ohne eigene Wahl steht dort, wo das Publikum gemessen steht.
 */
export function referentWahl(gewaehlt: number | undefined, liste: readonly DisplayInfo[] | undefined): number | null {
  if (gewaehlt !== undefined && liste?.some((d) => d.id === gewaehlt) === true) return gewaehlt;
  return liste?.find((d) => d.current)?.id ?? null;
}

/**
 * Sperrgrund von „Auf diesen Bildschirm“ im Referenten (B11), angezeigt als title; undefined = bedienbar. Die Auswahl merkt nur,
 * der Knopf verschiebt (`assignAudience`). In dieser Reihenfolge: Messung unbekannt (Präsentation oder Liste ohne Antwort); kein
 * Publikumsfenster (bei laufender Präsentation „nur NDI“ mit dem alten Wortlaut, sonst keine Präsentation); keine Wahl; die Wahl
 * fehlt in der Liste; die Wahl ist der gemessene Bildschirm. Bedienbar also nur, wenn das Publikumsfenster gemessen auf einem
 * Bildschirm steht und die Wahl ein anderer Bildschirm der Liste ist.
 */
export function verschiebenGrund(s: Pick<OberflaechenStand, 'praesentation' | 'bildschirme'>, gewaehlt: number | null): string | undefined {
  const T = PRESENTER_TEXTE;
  if (s.praesentation === undefined || s.bildschirme === undefined) return T.verschieben.unbekannt;
  if (nurNdiLaeuft(s)) return T.publikum.keinFensterNurNdi;
  const publikum = publikumsBildschirm(s);
  if (!s.praesentation.active || publikum === undefined) return T.verschieben.keinFenster;
  if (gewaehlt === null) return T.verschieben.keineWahl;
  if (!s.bildschirme.some((d) => d.id === gewaehlt)) return SCREEN_TEXTE.bildschirmFehlt;
  if (gewaehlt === publikum.id) return T.verschieben.gleich;
  return undefined;
}

/** „Auf diesen Bildschirm“ bedienbar (B11): genau dann, wenn verschiebenGrund keinen Grund nennt (eine Ableitung, zwei Sichten). */
export function verschiebenMoeglich(s: Pick<OberflaechenStand, 'praesentation' | 'bildschirme'>, gewaehlt: number | null): boolean {
  return verschiebenGrund(s, gewaehlt) === undefined;
}

/** Eingabetypen von `input`, die keine Textfelder sind (B10): dort wirken die Kürzel weiter. */
const KEIN_TEXTFELD = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'color']);

/**
 * Ist das Ziel eines Tastendrucks ein Textfeld (B10)? `textarea`, contentEditable und `input` außer checkbox, radio, range,
 * button, submit und color. Bewusst anders als `istEingabeZiel` aus 2a (Prompter): `select` zählt hier nicht, damit der
 * Klicker (Bild↓, Pfeile) auch bei fokussierter Bildschirmwahl weiterblättert; `preventDefault` hält die Auswahl fest. Knöpfe
 * zählen ebenfalls nicht. Ein schreibgeschütztes Feld (readOnly, Gast-Link im Panel) auch nicht: dort tippt niemand, der Klicker blättert
 * (Gesamtprüfung UX Welle 2b, I2). Ohne DOM nutzbar: gelesen werden nur tagName, type, readOnly und isContentEditable.
 */
export function istTextfeld(ziel: EventTarget | null): boolean {
  if (ziel === null) return false;
  const t = ziel as { tagName?: unknown; type?: unknown; readOnly?: unknown; isContentEditable?: unknown };
  if (t.isContentEditable === true) return true;
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA') return t.readOnly !== true;
  if (tag !== 'INPUT') return false;
  if (t.readOnly === true) return false;
  return !KEIN_TEXTFELD.has(typeof t.type === 'string' ? t.type.toLowerCase() : 'text');
}

/**
 * Felder im Referent-Panel, deren Tasten trotzdem die Kürzel erreichen (Gesamtprüfung UX Welle 2b, I2; AppShell `panelToolTasten`): jedes
 * Ziel, das nach B10 kein Textfeld ist, also die Auswahl „Netzwerkkarte“ und der schreibgeschützte Gast-Link. Sonst hält das Panel jede
 * Taste aus einem Feld an, und der USB-Klicker bliebe tot, solange der Fokus nach einer Mauswahl dort liegt. In Textfeldern (Timer-Host,
 * Port, PIN) gilt B10 weiter; Escape bleibt beim Panel und schließt es. Nur der Referent gibt das an, der Editor hat keine Kürzel.
 */
export function referentPanelTasten(ziel: unknown): boolean {
  return !istTextfeld((ziel ?? null) as EventTarget | null);
}

/** Strg+W bzw. Cmd+W: schließt über das Electron-Standardmenü das Fenster, wenn niemand preventDefault ruft. */
const istFensterSchliessen = (e: { key: string; ctrlKey?: boolean; metaKey?: boolean }): boolean =>
  (e.key === 'w' || e.key === 'W') && (e.ctrlKey === true || e.metaKey === true);

/**
 * Strg+W bzw. Cmd+W im Referenten, in der Erfassungsphase am window (vor jedem anderen Hörer): nur preventDefault, keine Aktion.
 * Grund (gemessen in Task 11): Das Panel hält Tasten aus seinen Feldern an (stopPropagation, @jm/ui panelTaste), verarbeiteTaste
 * sieht sie nie; ohne preventDefault schloss das Standardmenü mit Strg+W aus dem Feld „Host“ das Referentenfenster und beendete die
 * Präsentation. Das setzt den Controller-Entscheid zu Task 9 auch für die Felder des Panels um. Außerhalb von Feldern schaltet
 * verarbeiteTaste wie bisher Weiß (preventDefault hält die Weitergabe nicht an).
 */
export function fensterSchliessenAbfangen(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; preventDefault(): void }): void {
  if (istFensterSchliessen(e)) e.preventDefault();
}

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

