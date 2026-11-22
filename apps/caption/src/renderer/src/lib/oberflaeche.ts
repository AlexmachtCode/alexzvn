// Caption-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, E4 ON AIR, E7 Hold, E8 NDI, E9 Mikrofonfehler).
// Aus der Antwort des Main (CaptionState), der gemessenen Geräteliste, dem Mikrofonfehler des Renderers, der Master-Link- und
// der Fernsteuerungs-Meldung entstehen die Props der Panel-Abschnitte, die Statusleiste, das ON AIR des Kopfes und die vier
// Haupttasten. Kein window, kein IPC, kein localStorage, kein Store-Import: Die Tests laufen ohne Browser.
// Statusleiste und Panel nutzen dieselben Ableitungen (eine Wahrheit): ndi, fernsteuerung und mikrofon nehmen Zustand und
// Text aus der Sicht des jeweiligen gemeinsamen Abschnitts. Keine Taste bekommt eine neue Wirkung.
import {
  abschnittStatusItem,
  audioDeviceView,
  ndiOutputView,
  REMOTE_TEXTE,
  remoteControlView,
  type AudioDeviceSectionProps,
  type NdiOutputSectionProps,
  type RemoteControlSectionProps,
} from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { CaptionConfig, CaptionState, MasterLinkMeldungZeile, WhisperModelId } from '@shared/types';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. `erkennung` und `darstellung` sind tool-eigen. */
export const ABSCHNITT = {
  ndi: 'ndi',
  mikrofon: 'mikrofon',
  fernsteuerung: 'fernsteuerung',
  erkennung: 'erkennung',
  darstellung: 'darstellung',
} as const;

/**
 * Feste Texte der Caption (kein ASCII-Anführungszeichen). Wortlaut wie bisher (App.tsx), Texte aus @jm/settings und @jm/ui
 * werden nie nachgebaut, sondern dort gelesen (AUDIO_TEXTE, NDI_TEXTE, REMOTE_TEXTE, MASTER_LINK_TEXTE).
 */
export const CAPTION_TEXTE = {
  /** Haupttasten: Beschriftungen wie die alten Knöpfe ohne Symbol (App.tsx:185-218). */
  taste: { start: 'Start', stopp: 'Stopp', hold: 'Hold', holdAn: 'Hold ✓', leeren: 'Leeren', ndiStarten: 'NDI starten', ndiAn: 'NDI an' },
  /** Grund gesperrter Tasten: vor der ersten Antwort des Main zeigte die App „Lädt …“ (App.tsx:134-136). */
  grund: { zustandOffen: 'Lädt …' },
  /** Statuseintrag der NDI-Ausgabe (kurz, wie die Taste „NDI“). */
  ndi: { titel: 'NDI' },
  /**
   * Mikrofon: Titel des Statuseintrags, Beschriftung der Wahl (Tooltip des alten Felds), die Option für die leere ID und der Name
   * eines Eingangs ohne Namen (wie bisher, App.tsx:172, Zählung ab 1).
   */
  mikrofon: { titel: 'Mikrofon', wahl: 'Audio-Eingang (Mikrofon)', standard: 'System-Standard (Mikrofon)', ohneName: (n: number) => `Audiogerät ${n}` },
  /** Live-Bereich: Wortlaut wie bisher (App.tsx:332-407); „Mikrofon: …“ steht jetzt als Text unter den Haupttasten (E9). */
  live: {
    bereit: '— bereit —',
    vorschau: 'NDI-Vorschau',
    eingefroren: 'eingefroren',
    pegel: 'Pegel',
    zeilen: (n: number) => `${n} Zeilen`,
    keineZeilen: 'Noch keine Untertitel.',
    korrigieren: 'Doppelklick: letzte Zeile korrigieren',
    mikrofonFehler: (meldung: string) => `Mikrofon: ${meldung}`,
  },
  /** Panel-Abschnitt Erkennung (vorher Kopfleiste und Klappe „Erweitert“); neu sind nur Titel, „Modell“ und „Sprache“. */
  erkennung: {
    titel: 'Erkennung',
    modell: 'Modell',
    sprache: 'Sprache',
    engine: 'Engine',
    woerterbuch: 'Fachwörter-Wörterbuch (eine je Zeile)',
    woerterbuchPlatzhalter: 'z. B.\nJakobs Medien\niveo\nNITROVON',
    maxAeusserung: 'Max. Äußerung (s)',
  },
  /** Panel-Abschnitt Darstellung (vorher NDI-Leiste); neu ist nur der Titel. */
  darstellung: { titel: 'Darstellung', schrift: 'Schrift', zeilen: 'Zeilen', band: 'Band' },
  /** Whisper: „transkribiert …“ wie das Wort neben dem Pegel (App.tsx:370); der lange Hinweis wie das gelbe Band (App.tsx:323-325). */
  whisper: {
    titel: 'Whisper',
    verfuegbar: 'verfügbar',
    arbeitet: 'transkribiert …',
    fehlt: 'fehlt',
    fehltHinweis: 'whisper.cpp ist hier nicht gebündelt — Transkription läuft erst nach dem Office-Build (Binary + Modell).',
  },
  /** Statuseintrag von `state.error` (die Meldung selbst steht als Text). */
  fehler: { titel: 'Fehler', keiner: 'kein Fehler' },
  /** Companion-Modul der Caption. */
  companionModul: 'JM Caption',
} as const;

/** Auflösungen der NDI-Ausgabe (wie `RES`, App.tsx:19-23); `id` = `${w}x${h}`. */
export const AUFLOESUNGEN = [
  { id: '1920x1080', label: '1080p', w: 1920, h: 1080 },
  { id: '1280x720', label: '720p', w: 1280, h: 720 },
  { id: '3840x2160', label: '2160p', w: 3840, h: 2160 },
] as const;

/** Bildraten der NDI-Ausgabe (wie bisher, App.tsx:244). */
export const BILDRATEN = [25, 30, 50, 60] as const;

/** Whisper-Modelle (wie `MODELS`, App.tsx:7-13). */
export const MODELLE: ReadonlyArray<{ id: WhisperModelId; label: string }> = [
  { id: 'tiny', label: 'Tiny (schnell)' },
  { id: 'base', label: 'Base' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large-v3', label: 'Large v3 (genau)' },
];

/** Sprachen der Erkennung (wie `LANGS`, App.tsx:14-18). */
export const SPRACHEN: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'Englisch' },
  { id: 'auto', label: 'Auto-Erkennung' },
];

/** Engines der Erkennung (wie die Auswahl „Engine“, App.tsx:307-308). */
export const ENGINES: ReadonlyArray<{ id: CaptionConfig['engine']; label: string }> = [
  { id: 'server', label: 'Server (schnell, Modell bleibt geladen)' },
  { id: 'cli', label: 'CLI (pro Äußerung)' },
];

/** Zeilen der NDI-Darstellung (wie bisher, App.tsx:259). */
export const NDI_ZEILEN = [1, 2, 3] as const;

/** Ein Audio-Eingang der gemessenen Liste (die View übersetzt MediaDeviceInfo: id = deviceId, label wie die alte Auswahl). */
export interface MikrofonGeraet {
  id: string;
  label: string;
}

export interface OberflaechenStand {
  /**
   * Antwort des Main (`getState`/`onState`/Befehlsantworten); undefined, bis Main wirklich geantwortet hat. Der Store hält
   * `state: CaptionState | null` ohne Vorgabewert: `caption = state ?? undefined`. Die Platzhalter-Config der View (FALLBACK_CFG)
   * ist keine Antwort und gehört nie hierher. Ohne Antwort sind ndi, whisper, fehler, ON AIR und alle vier Tasten unbekannt
   * bzw. gesperrt mit Grund, nie ein sicherer Zustand.
   */
  caption: CaptionState | undefined;
  /**
   * Gemessene Liste der Audio-Eingänge (`listAudioInputs`); undefined, bis die erste Abfrage zurück ist. Der Anfangswert
   * `[]` des React-Zustands ist keine Messung. Eine Abfrage, die scheitert, meldet `[]` (wie bisher, App.tsx:68): das ist eine
   * gemessene leere Liste.
   */
  geraete: readonly MikrofonGeraet[] | undefined;
  /** Mikrofonfehler des Renderers (E9); null = keiner. Er bleibt bis zur nächsten erfolgreich gestarteten Aufnahme stehen. */
  micError: string | null;
  /** Aktueller RMS-Pegel (linear, `store.level`); undefined = keine Messung. Er zählt nur bei `running`. */
  pegel?: number;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8732): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
}

/** Aktionen des Panels: die View ruft damit den Store erst im Rückruf. */
export interface CaptionAktionen {
  ndiSchalten(next: boolean): void;
  ndiName(name: string): void;
  aufloesung(w: number, h: number): void;
  bildrate(fps: number): void;
  geraetWaehlen(id: string): void;
  geraeteAktualisieren(): void;
}

const KEINE_AKTION: CaptionAktionen = {
  ndiSchalten: () => {},
  ndiName: () => {},
  aufloesung: () => {},
  bildrate: () => {},
  geraetWaehlen: () => {},
  geraeteAktualisieren: () => {},
};

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

/** ON AIR (E4): nur wenn der Sender Bilder meldet, die Aufnahme läuft und kein Mikrofonfehler vorliegt; ohne Antwort nie live. */
export function kopfOnAir(s: Pick<OberflaechenStand, 'caption' | 'micError'>): { live: boolean } {
  const c = s.caption;
  return { live: c !== undefined && c.status.ndiSendet && c.running && s.micError === null };
}

/**
 * NDI-Ausgabe (E8): `enabled` = Prozess existiert (`ndiActive`), `sending` nur als gemessenes `true` (`ndiSendet`); ohne es
 * bleibt es „an, keine Rückmeldung“ (warn), nie ok. Empfänger zählen nur bei sendendem Sender. `networkName` ist der Name, mit
 * dem der Sender gestartet wurde (`ndiNetzName`), nur bei laufendem NDI und nie leer; `sourceName` bleibt das Feld der
 * Einstellung. Keine Transparenz-Wahl (die Quelle ist immer transparent). Ohne Antwort gibt es keinen Eintrag mit Zustand
 * (siehe statusLeiste), die Felder zeigen dann Platzhalter.
 */
export function ndiAbschnitt(s: Pick<OberflaechenStand, 'caption'>, a: CaptionAktionen = KEINE_AKTION): NdiOutputSectionProps {
  const c = s.caption;
  const cfg = c?.config;
  const st = c?.status;
  const netz = st?.ndiActive === true ? (st.ndiNetzName ?? '').trim() : '';
  return {
    id: ABSCHNITT.ndi,
    enabled: st?.ndiActive === true,
    sending: st?.ndiSendet === true ? true : undefined,
    sourceName: cfg?.ndiName ?? '',
    networkName: netz === '' ? undefined : (st?.ndiNetzName as string),
    receivers: st?.ndiSendet === true ? st.connections : undefined,
    resolution: cfg === undefined ? undefined : `${cfg.ndiWidth}x${cfg.ndiHeight}`,
    resolutionOptions: AUFLOESUNGEN.map((r) => ({ value: r.id, label: r.label })),
    fps: cfg === undefined ? undefined : String(cfg.ndiFps),
    fpsOptions: BILDRATEN.map((f) => ({ value: String(f), label: String(f) })),
    capabilities: { toggle: true, rename: true, resolution: true, fps: true },
    onToggle: (next) => a.ndiSchalten(next),
    onRename: (name) => a.ndiName(name),
    onResolution: (v) => {
      const r = AUFLOESUNGEN.find((x) => x.id === v);
      if (r !== undefined) a.aufloesung(r.w, r.h);
    },
    onFps: (v) => {
      const n = Number(v);
      if (BILDRATEN.some((f) => f === n)) a.bildrate(n);
    },
  };
}

/** Pegel in dB aus dem linearen RMS; 0 = kein Signal (-Infinity). */
const inDb = (rms: number): number => (rms > 0 ? 20 * Math.log10(rms) : -Infinity);

/**
 * Mikrofon (Audiogerät, eine Wahl): die gespeicherte ID gegen die gemessene Liste. Eine ID, die nicht in der Liste steht, bleibt
 * gewählt und der Status ist „Gerät nicht gefunden“ (Helfer des Abschnitts), nie der Standard. Ohne Antwort des Main oder ohne
 * gemessene Liste ist die Liste unbekannt. `micError` ist der Fehler des Abschnitts (E9). Pegel nur bei `running`.
 */
export function mikrofonAbschnitt(s: Pick<OberflaechenStand, 'caption' | 'geraete' | 'micError' | 'pegel'>, a: CaptionAktionen = KEINE_AKTION): AudioDeviceSectionProps {
  const c = s.caption;
  return {
    id: ABSCHNITT.mikrofon,
    error: s.micError ?? undefined,
    choices: [
      {
        key: 'mikrofon',
        label: CAPTION_TEXTE.mikrofon.wahl,
        direction: 'input',
        devices: c === undefined ? undefined : s.geraete?.map((d) => ({ id: d.id, label: d.label })),
        value: c?.config.audioInputDeviceId ?? '',
        defaultLabel: CAPTION_TEXTE.mikrofon.standard,
        levelDb: c?.running === true && s.pegel !== undefined ? inDb(s.pegel) : undefined,
        onChange: (id) => a.geraetWaehlen(id),
      },
    ],
    capabilities: { level: true, refresh: true },
    onRefresh: () => a.geraeteAktualisieren(),
  };
}

/** Fernsteuerung: Meldung des Steuerservers (Port 8732), Einrichten nur im Launcher. */
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
    companionModule: CAPTION_TEXTE.companionModul,
    capabilities: {},
  };
}

/** ndi: ohne Antwort unbekannt; sonst die Sicht des Abschnitts, bei ok mit der gemessenen Empfängerzahl. */
function ndiItem(s: OberflaechenStand): StatusItem {
  const kopf = { id: ABSCHNITT.ndi, group: 'ausgabe', label: CAPTION_TEXTE.ndi.titel, settingsSection: ABSCHNITT.ndi } as const;
  if (s.caption === undefined) return unbekannt(kopf);
  const v = ndiOutputView(ndiAbschnitt(s));
  const mitZahl = v.status.state === 'ok' && v.empfaenger !== undefined ? `${v.status.text}, ${v.empfaenger}` : undefined;
  return abschnittStatusItem(v, { group: 'ausgabe', label: CAPTION_TEXTE.ndi.titel, ...(mitZahl === undefined ? {} : { detail: mitZahl }) });
}

function whisperItem(s: OberflaechenStand): StatusItem {
  const T = CAPTION_TEXTE.whisper;
  const kopf = { id: 'whisper', group: 'tool', label: T.titel } as const;
  const c = s.caption;
  if (c === undefined) return unbekannt(kopf);
  if (!c.whisperAvailable) return { ...kopf, state: 'warn', detail: T.fehlt };
  return { ...kopf, state: 'ok', detail: c.busy ? T.arbeitet : T.verfuegbar };
}

function fehlerItem(s: OberflaechenStand): StatusItem {
  const T = CAPTION_TEXTE.fehler;
  const kopf = { id: 'fehler', group: 'tool', label: T.titel } as const;
  const c = s.caption;
  if (c === undefined) return unbekannt(kopf);
  return c.error === null ? { ...kopf, state: 'ok', detail: T.keiner } : { ...kopf, state: 'error', detail: c.error };
}

/** Statusleiste: master-link, ndi, fernsteuerung, mikrofon, whisper, fehler (`state.error`; `micError` steht bei mikrofon, E9). */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    ndiItem(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    abschnittStatusItem(audioDeviceView(mikrofonAbschnitt(s)), { group: 'tool', label: CAPTION_TEXTE.mikrofon.titel }),
    whisperItem(s),
    fehlerItem(s),
  ];
}

function taste(label: string, state: TasteZustand['state'], grund?: string): Haupttaste {
  return { label, state, ...(grund === undefined ? {} : { disabledReason: grund }) };
}

/**
 * Die vier Haupttasten (E4, E7, E9). Heute ist keine gesperrt (App.tsx:185-218); gesperrt ist nur, solange Main noch nicht
 * geantwortet hat (`caption` undefined, App.tsx:134-136 „Lädt …“), Grund `CAPTION_TEXTE.grund.zustandOffen`.
 * - Start/Stopp: „Stopp“ bei `running`, `live` nur ohne `micError`; mit `micError` bleibt die Taste bedienbar (Stopp), nie live.
 * - Hold: `bereit`, Beschriftung wechselt „Hold“ / „Hold ✓“ (E7).
 * - Leeren: `bereit`.
 * - NDI: Beschriftung nach `ndiActive`, `live` nur bei `ndiSendet`.
 */
export function hauptTasten(s: Pick<OberflaechenStand, 'caption' | 'micError'>): { start: Haupttaste; hold: Haupttaste; leeren: Haupttaste; ndi: Haupttaste } {
  const T = CAPTION_TEXTE;
  const c = s.caption;
  if (c === undefined) {
    const g = T.grund.zustandOffen;
    return { start: taste(T.taste.start, 'gesperrt', g), hold: taste(T.taste.hold, 'gesperrt', g), leeren: taste(T.taste.leeren, 'gesperrt', g), ndi: taste(T.taste.ndiStarten, 'gesperrt', g) };
  }
  return {
    start: c.running ? taste(T.taste.stopp, s.micError === null ? 'live' : 'bereit') : taste(T.taste.start, 'bereit'),
    hold: taste(c.hold ? T.taste.holdAn : T.taste.hold, 'bereit'),
    leeren: taste(T.taste.leeren, 'bereit'),
    ndi: taste(c.status.ndiActive ? T.taste.ndiAn : T.taste.ndiStarten, c.status.ndiSendet ? 'live' : 'bereit'),
  };
}
