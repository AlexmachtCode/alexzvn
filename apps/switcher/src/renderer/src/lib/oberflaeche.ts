// Switcher-Oberfläche: reine Ableitungen (UX Welle 1, Aufgabe c; Spec 5.1, 6, 7.1–7.4, Anhang A „Switcher“). Aus dem Stand des
// Switchers (Einstellungen, Ausgabe-, NDI- und Audiozustand, Monitorliste, Master-Link- und Fernsteuerungs-Meldung) entstehen
// die Props der Einstellungs-Abschnitte, die Statusleiste, die Zustände der vier Haupttasten und der On-Air-Kopf. Kein window,
// kein IPC, kein localStorage: Die Aktionen kommen als Objekt herein, die Tests laufen ohne Browser. Statusleiste und Panel
// nutzen dieselben Ableitungen (eine Wahrheit).
// Regeln: E4 Bildschirm, E5 NDI, E7 Haupttasten, E8 On-Air, R4 Fernsteuerung (controlEnabled zuerst).
import {
  abschnittStatusItem,
  ABSCHNITT_TEXTE,
  audioDeviceView,
  fehlerStatus,
  NDI_TEXTE,
  ndiOutputView,
  REMOTE_TEXTE,
  remoteControlView,
  SCREEN_TEXTE,
  screenOutputView,
  type AudioDeviceOption,
  type AudioDeviceSectionProps,
  type NdiOutputSectionProps,
  type RemoteControlSectionProps,
  type ScreenOutputSectionProps,
} from '@jm/settings';
import { masterLinkStatusItem, type StatusItem, type TallyButtonProps } from '@jm/ui';
import { portBelegt, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { RESOLUTIONS, recommendedBitrate, type ProgramResolution } from '@shared/output-quality';
import type { DisplayInfo, MasterLinkMeldungZeile } from '@shared/types';
import type { AudioState } from '@/core/audio';
import type { NdiOutputState } from '@/core/ndiOutput';
import type { OutputState } from '@/core/output';
import type { SettingsState } from '@/store/settings';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  ndi: 'ndi',
  bildschirm: 'bildschirm',
  fernsteuerung: 'fernsteuerung',
  audio: 'audio',
  streaming: 'streaming',
  aufnahme: 'aufnahme',
  format: 'format',
} as const;

/**
 * Feste Texte des Switchers (neue sichtbare Texte; kein ASCII-Anführungszeichen). Wörtlich übernommen aus dem Bestand:
 * Grund des Stream-Knopfs (SwitcherView, title), Name des Companion-Moduls (SettingsView), Leerwert der Audiowahl.
 */
export const SWITCHER_TEXTE = {
  /** Grund für gesperrtes Cut (E7): nach `canTake`; bei Auto auch ohne laufende Überblendung (Vorschau = Programm). */
  keineSzeneInVorschau: 'Keine andere Szene in der Vorschau',
  /** Grund für gesperrtes Auto (E7), nach `transitioning`. */
  ueberblendungLaeuft: 'Überblendung läuft',
  /** Grund für gesperrten Stream-Start ohne RTMP-Ziel: wörtlich der heutige title des Knopfs. */
  keinStreamZiel: 'Stream-Ziel in den Einstellungen festlegen',
  /** Statustext bei kurzer Angabe zu laufender Aufnahme oder Sendung ohne Dateinamen. */
  laeuft: 'läuft',
  keinZiel: 'kein Ziel',
  stumm: 'stumm',
  /** Name des Companion-Moduls (packages/companion-jm-switcher): wörtlich aus dem heutigen Hinweis. */
  companionModul: 'jm-switcher',
  /** Name der heutigen Wahl „kein Ton“: wörtlich die bisherige Option. */
  keinTon: '— Kein Ton (stille Spur) —',
  /** Auswahl-Titel der Programm-Audioquelle in der Audio-Wahl. */
  programmAudio: 'Programm-Audio',
  onAirLive: 'LIVE',
  onAirRec: 'REC',
  /** Haupttasten und Dauer-Feld des Live-Bereichs (E7): wörtlich die bisherigen Beschriftungen der Knöpfe. */
  haupttaste: {
    cut: 'Cut',
    auto: 'Auto',
    dauer: 'Dauer',
    ms: 'ms',
    aufnehmen: 'Aufnehmen',
    aufnahmeStoppen: 'Aufnahme stoppen',
    streamStarten: 'Stream starten',
    streamStoppen: 'Stream stoppen',
  },
  label: {
    ndi: 'NDI',
    audio: 'Audio',
    aufnahme: 'Aufnahme',
    stream: 'Stream',
  },
  /** Erklärtexte der alten Einstellungs-Karten (R8): wörtlich aus der bisherigen SettingsView, unverändert auch dort, wo sie auf die frühere „Mischer-Leiste“ verweisen (Textfrage Z1). */
  panelText: {
    einleitung: 'Stream-Ziel und Qualität. Aufnahme & Stream startest du in der Mischer-Ansicht.',
    ndi: 'So erscheint die Ausgabe im Netz (z. B. als Eingang in TriCaster, vMix, OBS oder einem NDI-Monitor). In der Mischer-Leiste wählst du, ob das Program-Bild oder das Multiview gesendet wird, und schaltest die Ausgabe live an/aus.',
    bildschirm:
      'Zeigt das On-Air-Programmbild formatfüllend auf dem gewählten Monitor — per HDMI direkt an Beamer, Kontrollmonitor oder Encoder. Läuft unabhängig von NDI und der Aufnahme; wähle für die Regie am besten einen anderen Monitor als den mit der Bedienoberfläche.',
    audio:
      'Mikro / Line-In / Capture-Ton. Wird in Aufnahme + Stream gemischt; Pegel & Mute in der Mischer-Leiste. Audio folgt (noch) nicht der Bildquelle — feste Programm-Audioquelle.',
    fernsteuerung:
      'Zeilenprotokoll (PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM) für ein Stream-Deck via Bitfocus Companion — Modul: packages/companion-jm-switcher. Im Companion-Modul Host (IP dieses Rechners) + Port eintragen.',
    monitoreAktualisieren: 'Monitore aktualisieren',
  },
  /** Titel der tool-eigenen Panel-Abschnitte (E5; „Streaming“ hieß „Streaming (RTMP)“, „Programm-Format“ steckte in der NDI-Karte). */
  titel: {
    streaming: 'Streaming',
    aufnahme: 'Aufnahme',
    format: 'Programm-Format',
  },
  /** Beschriftungen und Hinweise der tool-eigenen Felder: wörtlich aus der bisherigen SettingsView. */
  feld: {
    rtmpZiel: 'RTMP-Ziel',
    rtmpPlatzhalter: 'rtmp://server/app/streamkey',
    rtmpHinweis: 'Vollständige URL inkl. Streamkey (z. B. YouTube-/Twitch-Ingest oder lokaler nginx-rtmp).',
    streamBitrate: 'Stream-Bitrate',
    streamBitrateHinweis: 'Video-Bitrate des H.264-Streams (x264).',
    aufnahmeBitrate: 'Aufnahme-Bitrate',
    aufnahmeBitrateHinweis: 'Video-Bitrate der WebM-Aufnahme.',
    einheitKbit: 'kbit/s',
    empfohlenFuer: 'Empfohlen für',
    ndiQuelle: 'NDI-Quelle',
    ndiQuelleHinweis: 'Was als NDI-Quelle ausgegeben wird',
    quelleProgram: 'Program',
    quelleMultiview: 'Multiview',
    aufloesung: 'Programm-Auflösung',
    bildrate: 'Ausgabe-Bildrate',
    aufloesungFullHd: 'Full-HD 1080p',
    aufloesungHd: 'HD 720p',
    streamHinweisAufloesung: 'Auflösung:',
    streamHinweisTon: 'Ton:',
    tonMitQuelle: 'Programm-Ton der gewählten Audioquelle',
    tonStille: 'stille AAC-Spur (keine Audioquelle gewählt)',
    streamHinweisSchluss:
      'Der Stream wird aus dem Program-Bild kodiert (libx264, zerolatency) — die Auflösung folgt der Programm-Auflösung, es wird nie hochskaliert.',
    aufnahmeHinweis:
      'Aufnahmen werden als WebM gespeichert (Speicherort wird beim Start abgefragt). Für MP4 die Datei im JM Media Converter umwandeln.',
    formatHinweis:
      'Auflösung und Bildrate gelten für alle Ausgaben — NDI, Aufnahme, RTMP und den zweiten Bildschirm. Das Programm wird in dieser Auflösung komponiert (kein Hochskalieren). 1080p ist echtes Full-HD und kostet mehr Rechenleistung; auf schwächeren Rechnern 720p wählen. Das Multiview bleibt 720p und zeigt Program + Preview groß plus alle Szenen als Kacheln mit Tally.',
    bildrateHinweis:
      'Eine geänderte Bildrate greift, sobald weder Aufnahme noch Sendung läuft — solange eine von beiden läuft, behält auch eine neu gestartete zweite Ausgabe die bisherige Rate.',
  },
  /** Projekt-Leiste in der Werkzeugleiste (E6): wörtlich aus der bisherigen Leiste im Mischer. */
  projekt: {
    titel: 'Projekt',
    neu: 'Neu',
    oeffnen: 'Öffnen…',
    speichern: 'Speichern',
    speichernUnter: 'Speichern unter…',
    ungespeichert: '· ungespeichert',
    nichtGespeichert: 'Nicht gespeichert',
  },
} as const;

/**
 * Ist die Geräteliste zum Abgleichen brauchbar? Ohne Mikrofon-Berechtigung liefert enumerateDevices Einträge ohne deviceId;
 * dann darf die Statusleiste nie „Gerät nicht gefunden“ behaupten (R6). Leer oder ohne eine id zählt als unbrauchbar.
 */
export function listeVerwendbar(geraete: AudioDeviceOption[]): boolean {
  return geraete.some((g) => g.id !== '');
}

/** Name der Programm-Auflösung wie in der bisherigen Auswahl und im Hinweis. */
export function aufloesungName(r: ProgramResolution): string {
  return r === '1080p' ? SWITCHER_TEXTE.feld.aufloesungFullHd : SWITCHER_TEXTE.feld.aufloesungHd;
}

/** Empfehlung der Bitrate für die gewählte Auflösung, z. B. „Empfohlen für Full-HD 1080p: 6.000–12.000 kbit/s.“ */
export function bitrateEmpfehlung(r: ProgramResolution, art: 'stream' | 'record'): string {
  const b = recommendedBitrate(r, art);
  const F = SWITCHER_TEXTE.feld;
  return `${F.empfohlenFuer} ${aufloesungName(r)}: ${b.min.toLocaleString('de-DE')}–${b.max.toLocaleString('de-DE')} ${F.einheitKbit}.`;
}

/** Hinweis unter dem Streaming-Abschnitt: Auflösung, Bildrate und Ton der Sendung (wie bisher unter der Bitrate). */
export function streamHinweis(r: ProgramResolution, fps: number, audioInputId: string): string {
  const F = SWITCHER_TEXTE.feld;
  const ton = audioInputId ? F.tonMitQuelle : F.tonStille;
  return `${F.streamHinweisAufloesung} ${RESOLUTIONS[r].w}×${RESOLUTIONS[r].h} @ ${fps} fps · ${F.streamHinweisTon} ${ton}. ${F.streamHinweisSchluss}`;
}

export interface OberflaechenStand {
  /** Persistierte Einstellungen (Store). */
  settings: SettingsState;
  /** Zustand von Aufnahme und Stream (`output.getState()`). */
  output: OutputState;
  /** Zustand der NDI-Ausgabe (`NdiOutputController.getState()`). */
  ndi: NdiOutputState;
  /** Zustand des Programm-Audios (`AudioController.getState()`). */
  audio: AudioState;
  /** Liste der Audioeingänge; undefined = noch nicht geladen (Gerätesuche), dann „unbekannt“. */
  audioGeraete?: AudioDeviceOption[] | undefined;
  /** Monitorliste aus listDisplays; undefined = noch nicht geladen (dann „unbekannt“, nie eine leere Liste, E4). */
  displays: DisplayInfo[] | undefined;
  /** Meldung der Master-Link-Brücke: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers: undefined/null = noch keine Antwort (R4). */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
  /** Es gibt eine Szene in der Vorschau (heute `previewSceneId != null`). */
  canTake: boolean;
  /** Auto ist möglich (Vorschau ≠ Programm, keine Überblendung). */
  canAuto: boolean;
  /** Eine Überblendung läuft. */
  transitioning: boolean;
}

/** Was die Abschnitte auslösen; die View reicht Store-Setter und Ausgabe-Handler herein (Namen wie heute). */
export interface SwitcherAktionen {
  setRtmpUrl(v: string): void;
  setStreamBitrateKbps(v: number): void;
  setRecordBitrateKbps(v: number): void;
  setControlEnabled(v: boolean): void;
  setControlPort(v: number): void;
  setAudioInputId(v: string): void;
  setNdiOutputName(v: string): void;
  setNdiOutputSource(v: 'program' | 'multiview'): void;
  setProgramResolution(v: SettingsState['programResolution']): void;
  setOutputFps(v: number): void;
  setSecondScreenEnabled(v: boolean): void;
  setSecondScreenDisplayId(v: number): void;
  /** Schaltet die NDI-Ausgabe um (SwitcherView.toggleNdiOutput). */
  toggleNdiOutput(): void;
  toggleRecording(): void;
  toggleStreaming(): void;
  /** Audiogeräte neu suchen (SettingsView.scanAudio). */
  scanAudio(): void;
  /** Monitorliste neu lesen (SettingsView.scanDisplays; R8). */
  scanDisplays(): void;
}

/** Projekt-Aktionen der Werkzeugleiste (E6); die Abläufe bleiben in SwitcherView. */
export interface ProjektAktionen {
  neu(): void;
  oeffnen(): void;
  speichern(): void;
  speichernUnter(): void;
}

/**
 * Was SwitcherView dem Rahmen meldet (die Controller und das Projekt leben dort, der Rahmen zeigt sie in Kopf, Statusleiste,
 * Toolbar und Panel): gemessene Zustände, die Eingänge der Haupttasten und die Aktionen, die der Rahmen auslösen darf.
 */
export interface FrameMeldung {
  output: OutputState;
  ndi: NdiOutputState;
  audio: AudioState;
  canTake: boolean;
  canAuto: boolean;
  transitioning: boolean;
  projekt: { name: string; pfad: string | null };
  aktionen: Pick<SwitcherAktionen, 'toggleNdiOutput' | 'toggleRecording' | 'toggleStreaming'> & ProjektAktionen;
}

const KEIN_ABLAUF = (): void => {};

/** Frame vor der ersten Meldung der View: alles aus, ohne Wirkung der Aktionen. */
export const FRAME_ANFANG: FrameMeldung = {
  output: { recording: false, streaming: false, recPath: null, error: null },
  ndi: { active: false, name: '', connections: 0, error: null },
  audio: { hasDevice: false, muted: false, gain: 1, level: 0, error: null },
  canTake: false,
  canAuto: false,
  transitioning: false,
  projekt: { name: '', pfad: null },
  aktionen: {
    toggleNdiOutput: KEIN_ABLAUF,
    toggleRecording: KEIN_ABLAUF,
    toggleStreaming: KEIN_ABLAUF,
    neu: KEIN_ABLAUF,
    oeffnen: KEIN_ABLAUF,
    speichern: KEIN_ABLAUF,
    speichernUnter: KEIN_ABLAUF,
  },
};

/** Zustand einer Haupttaste: Form der Titler-Taste (state + Grund); ein gesperrter Zustand trägt immer einen Grund. */
export interface TasteZustand {
  state: TallyButtonProps['state'];
  disabledReason?: string;
}

/** NDI-Ausgabe (E5): nur Schalter und Name; Quelle, Auflösung und Bildrate liegen im Abschnitt „Programm-Format“. */
export function ndiAbschnitt(s: OberflaechenStand, a: SwitcherAktionen): NdiOutputSectionProps {
  const st = s.settings;
  const n = s.ndi;
  return {
    id: ABSCHNITT.ndi,
    enabled: n.active,
    sourceName: st.ndiOutputName,
    // Die Empfängerzahl kommt erst nach den ersten gesendeten Bildern; 0 ist nicht von „noch keine Meldung“ zu unterscheiden,
    // und nach dem Stopp stünde sonst die alte Zahl hinter „aus“. „sending“ bleibt leer: Der Main meldet nur „Sender-
    // Prozess läuft“, keine Rückmeldung des Senders (→ „an (ohne Rückmeldung)“).
    receivers: n.active && n.connections > 0 ? n.connections : undefined,
    // Der Startfehler (NdiOutputState.error) wurde bisher nirgends angezeigt; er steht im Abschnitt und in der Statusleiste.
    error: n.error ?? undefined,
    capabilities: { toggle: true, rename: true },
    // Der Abschnitt meldet den Zielzustand; die Ausgabe schaltet nur um, wenn er vom gemessenen abweicht.
    onToggle: (an) => {
      if (an !== n.active) a.toggleNdiOutput();
    },
    onRename: (name) => a.setNdiOutputName(name),
  };
}

/** Ausgabe auf Bildschirm (E4): Ob das Ausgabefenster offen ist, meldet kein Kanal → „an (ohne Rückmeldung)“. */
export function bildschirmAbschnitt(s: OberflaechenStand, a: SwitcherAktionen): ScreenOutputSectionProps {
  const st = s.settings;
  return {
    id: ABSCHNITT.bildschirm,
    enabled: st.secondScreenEnabled,
    // windowOpen bleibt unbelegt (core/screenOutput.ts hat keinen Zustand).
    screens: s.displays?.map((d) => ({ id: d.id, label: d.label, primary: d.primary })),
    selectedId: st.secondScreenDisplayId === 0 ? null : st.secondScreenDisplayId,
    capabilities: { toggle: true },
    onToggle: (an) => a.setSecondScreenEnabled(an),
    onSelect: (id) => a.setSecondScreenDisplayId(id ?? 0),
  };
}

/**
 * Fernsteuerung (R4): Zuerst gilt die Einstellung. Aus = der Server ist gestoppt; ein alter Fehler in der Meldung
 * (naechsteFernsteuerung behält ihn nach dem Stopp) darf dann nicht mehr stehen. An: Meldung des Steuerservers.
 */
export function fernsteuerungAbschnitt(s: OberflaechenStand, a: SwitcherAktionen): RemoteControlSectionProps {
  const st = s.settings;
  const basis = {
    id: ABSCHNITT.fernsteuerung,
    port: st.controlPort,
    enabled: st.controlEnabled,
    companionModule: SWITCHER_TEXTE.companionModul,
    capabilities: { portEditable: true, enableToggle: true },
    onToggle: (an: boolean) => a.setControlEnabled(an),
    onPortChange: (port: number) => a.setControlPort(port),
  };
  if (!st.controlEnabled) return { ...basis, running: false };
  const m = s.fernsteuerung ?? undefined;
  // Ohne Meldung: running bleibt leer → „unbekannt“ (nie „aus“ oder „bereit“).
  if (m === undefined) return basis;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“.
  const belegt = portBelegt(m);
  return {
    ...basis,
    running: m.laeuft,
    mode: m.modus,
    // Verbundene Clients zählen nur bei laufendem Server (der Abschnitt zeigt die Zahl nur bei running).
    clients: m.laeuft ? m.clients : undefined,
    portInUse: belegt,
    error: m.fehler !== undefined && !belegt ? m.fehler : undefined,
  };
}

/**
 * Programm-Audio (eine Wahl). Fehler von getUserMedia stehen als Fehler im Abschnitt, außer das gewählte Gerät fehlt in der
 * gemessenen Liste: Dann gilt „Gerät nicht gefunden“ (der Fehlertext des Browsers wäre dieselbe Ursache, nur unverständlicher).
 */
export function audioAbschnitt(s: OberflaechenStand, a: SwitcherAktionen): AudioDeviceSectionProps {
  const wahl = s.settings.audioInputId;
  const liste = s.audioGeraete;
  const fehlt = wahl !== '' && liste !== undefined && !liste.some((d) => d.id === wahl);
  return {
    id: ABSCHNITT.audio,
    error: s.audio.error !== null && !fehlt ? s.audio.error : undefined,
    choices: [
      {
        key: 'programm',
        label: SWITCHER_TEXTE.programmAudio,
        direction: 'input',
        devices: liste,
        value: wahl,
        // Die Option „kein Ton“ bleibt wählbar; ohne Wahl meldet der Abschnitt „kein Gerät gewählt“ (required).
        defaultLabel: SWITCHER_TEXTE.keinTon,
        required: true,
        onChange: (id) => a.setAudioInputId(id),
      },
    ],
    capabilities: { refresh: true },
    onRefresh: () => a.scanAudio(),
  };
}

const KEINE_AKTION: SwitcherAktionen = {
  setRtmpUrl: () => {},
  setStreamBitrateKbps: () => {},
  setRecordBitrateKbps: () => {},
  setControlEnabled: () => {},
  setControlPort: () => {},
  setAudioInputId: () => {},
  setNdiOutputName: () => {},
  setNdiOutputSource: () => {},
  setProgramResolution: () => {},
  setOutputFps: () => {},
  setSecondScreenEnabled: () => {},
  setSecondScreenDisplayId: () => {},
  toggleNdiOutput: () => {},
  toggleRecording: () => {},
  toggleStreaming: () => {},
  scanAudio: () => {},
  scanDisplays: () => {},
};

/** Hat der Stream ein Ziel? Leer oder nur Leerraum zählt nicht (wie `hasTarget` der heutigen Ausgabeleiste). */
function hatStreamZiel(s: { settings: Pick<SettingsState, 'rtmpUrl'> }): boolean {
  return s.settings.rtmpUrl.trim().length > 0;
}

/** Dateiname der laufenden Aufnahme (wie `recName` der heutigen Ausgabeleiste). */
function aufnahmeName(o: OutputState): string | null {
  return o.recPath ? o.recPath.replace(/^.*[\\/]/, '') : null;
}

/** Audio-Eintrag: Abschnittsstatus, dazu zwei Zustände, die nur das Audio kennt (kein Gerät offen, stumm). */
function audioItem(s: OberflaechenStand): StatusItem {
  const item = abschnittStatusItem(audioDeviceView(audioAbschnitt(s, KEINE_AKTION)), { group: 'tool', label: SWITCHER_TEXTE.label.audio });
  // Nur wenn Wahl und Liste stimmen (ok) und kein Fehler vorliegt, zählt die Messung des Graphen: hasDevice und muted.
  if (item.state !== 'ok') return item;
  if (!s.audio.hasDevice) return { ...item, state: 'warn', detail: `${item.detail} · ${NDI_TEXTE.startet}` };
  if (s.audio.muted) return { ...item, state: 'warn', detail: `${item.detail} · ${SWITCHER_TEXTE.stumm}` };
  return item;
}

/** Aufnahme (live nur beim Aufnehmen, Anhang A). Der Fehler ist einer für beide Ausgaben (OutputState.error). */
function aufnahmeItem(s: OberflaechenStand): StatusItem {
  const o = s.output;
  const kopf = { id: 'aufnahme', group: 'ausgabe', label: SWITCHER_TEXTE.label.aufnahme, settingsSection: ABSCHNITT.aufnahme } as const;
  if (o.recording) return { ...kopf, state: 'live', detail: aufnahmeName(o) ?? SWITCHER_TEXTE.laeuft };
  // Es gibt nur einen Fehlerwert für Aufnahme und Stream; ein laufender Stream hat den Fehler nicht ausgelöst (Start löscht ihn).
  if (o.error) return { ...kopf, state: 'error', detail: fehlerStatus(o.error).text };
  return { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
}

/** Stream (live nur beim Senden; Ziel aus der Einstellung, Fehler gemeinsam mit der Aufnahme). */
function streamItem(s: OberflaechenStand): StatusItem {
  const o = s.output;
  const kopf = { id: 'stream', group: 'ausgabe', label: SWITCHER_TEXTE.label.stream, settingsSection: ABSCHNITT.streaming } as const;
  if (o.streaming) return { ...kopf, state: 'live', detail: SWITCHER_TEXTE.laeuft };
  if (o.error) return { ...kopf, state: 'error', detail: fehlerStatus(o.error).text };
  if (!hatStreamZiel(s)) return { ...kopf, state: 'off', detail: SWITCHER_TEXTE.keinZiel };
  return { ...kopf, state: 'ok', detail: REMOTE_TEXTE.bereit };
}

/** Statusleiste schon in der Reihenfolge der Gruppen: verbindung, ausgabe, fernsteuerung, tool (Anhang A). */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  const L = SWITCHER_TEXTE.label;
  // „Bildschirm“ und „Fernsteuerung“ sind die Titel der gemeinsamen Abschnitte (nicht nachgebaut).
  const ndi = ndiOutputView(ndiAbschnitt(s, KEINE_AKTION));
  return [
    masterLinkStatusItem(s.masterLink),
    abschnittStatusItem(ndi, { group: 'ausgabe', label: L.ndi, detail: ndi.empfaenger }),
    abschnittStatusItem(screenOutputView(bildschirmAbschnitt(s, KEINE_AKTION)), { group: 'ausgabe', label: SCREEN_TEXTE.bildschirm }),
    aufnahmeItem(s),
    streamItem(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s, KEINE_AKTION)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    audioItem(s),
  ];
}

/**
 * Haupttasten (E7): Cut und Auto bereit oder gesperrt mit Grund; Aufnahme und Stream live, solange sie laufen. Stop ist nie
 * gesperrt; nur der Stream-Start ohne Ziel ist gesperrt. Keine Kürzel (UO5).
 */
export function hauptTasten(
  s: Pick<OberflaechenStand, 'canTake' | 'canAuto' | 'transitioning' | 'output'> & { settings: Pick<SettingsState, 'rtmpUrl'> },
): { cut: TasteZustand; auto: TasteZustand; aufnahme: TasteZustand; stream: TasteZustand } {
  const gesperrt = (grund: string): TasteZustand => ({ state: 'gesperrt', disabledReason: grund });
  const bereit: TasteZustand = { state: 'bereit' };
  const live: TasteZustand = { state: 'live' };
  return {
    cut: s.canTake ? bereit : gesperrt(SWITCHER_TEXTE.keineSzeneInVorschau),
    // Laufende Überblendung hat Vorrang; ohne sie sperrt canAuto nur bei fehlender Vorschau oder Vorschau = Programm.
    auto: s.canAuto && !s.transitioning ? bereit : gesperrt(s.transitioning ? SWITCHER_TEXTE.ueberblendungLaeuft : SWITCHER_TEXTE.keineSzeneInVorschau),
    aufnahme: s.output.recording ? live : bereit,
    stream: s.output.streaming ? live : hatStreamZiel(s) ? bereit : gesperrt(SWITCHER_TEXTE.keinStreamZiel),
  };
}

/**
 * Ab dieser Höhe des Fensterinhalts (innerHeight, px) startet das untere Panel offen. Herleitung bei Mindesthöhe 720
 * (main/index.ts): Fensterrahmen 39 px (Titelleiste 31 + Rand 8, Windows bei 100 %; Annahme, nicht gemessen) → 681 px Inhalt.
 * Fest über dem Mischer: Kopf 44 + Toolbar 45 + Statusleiste 28 = 117 (sizes.css), im Mischer Monitor-Rand 40,
 * Haupttasten 88 (Taste mit zweizeiligem Grund 76 + 12), Ausgabeleiste 56, Collapsible zu 32 bzw. offen 32 + 10 + 300 = 342.
 * Offen bleiben bei 681 px nur 681 − 117 − 40 − 88 − 56 − 342 = 38 px für die Monitore, zu sind es 348 px. Brauchbar sind
 * mindestens 180 px (16:9 bei 320 px Breite, gut die Hälfte der Monitorbreite von rund 500 px im Mindestfenster); offen
 * reicht das ab 117 + 40 + 88 + 56 + 342 + 180 = 823 px, aufgerundet 830.
 */
export const UNTEN_OFFEN_AB = 830;

/** Startzustand des unteren Panels (Collapsible switcher.unten): offen nur, wenn die Monitore danach noch brauchbar groß sind. */
export function untenStartOffen(innenHoehe: number): boolean {
  return innenHoehe >= UNTEN_OFFEN_AB;
}

/** On-Air im Kopf (E8): LIVE geht vor REC. */
export function onAirKopf(s: OberflaechenStand): { live: boolean; label: string } {
  return {
    live: s.output.streaming || s.output.recording,
    label: s.output.streaming ? SWITCHER_TEXTE.onAirLive : SWITCHER_TEXTE.onAirRec,
  };
}
