// Recorder-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, E4 ON AIR, E7 Umschalter, E13 Recorder).
// Aus dem Store des Recorders (Zustand vom Main, gemerkter Wunsch, Geräteliste), der Master-Link- und der Fernsteuerungs-Meldung
// und der Meldung des Hauptprozesses entstehen die Props der Panel-Abschnitte, die Statusleiste, das ON AIR des Kopfes und
// die zwei Haupttasten. Kein window, kein IPC, kein localStorage, kein Store-Import: Die Tests laufen ohne Browser.
// Statusleiste und Panel nutzen dieselben Ableitungen (eine Wahrheit): Der Eintrag Eingang nimmt Zustand und Gerätenamen aus
// der Sicht des Audio-Abschnitts. Keine Taste bekommt eine neue Wirkung.
import {
  abschnittStatusItem,
  AUDIO_TEXTE,
  audioDeviceView,
  REMOTE_TEXTE,
  remoteControlView,
  type AudioDeviceSectionProps,
  type RemoteControlSectionProps,
} from '@jm/settings';
import { formatUhrzeitKurz, masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { AudioDevice, MasterLinkMeldungZeile, RecorderState } from '@shared/types';
import { basename } from './format';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. `format` und `ziel` sind tool-eigen. */
export const ABSCHNITT = {
  eingang: 'eingang',
  format: 'format',
  ziel: 'ziel',
  fernsteuerung: 'fernsteuerung',
} as const;

/**
 * Feste Texte des Recorders (kein ASCII-Anführungszeichen). Beschriftungen wie bisher (RecorderView.tsx); Texte aus
 * @jm/settings und @jm/ui werden nie nachgebaut, sondern dort gelesen (AUDIO_TEXTE, REMOTE_TEXTE, MASTER_LINK_TEXTE).
 */
export const RECORDER_TEXTE = {
  /** Haupttasten: Beschriftungen wie die alten Knöpfe (RecorderView.tsx:146-176). */
  taste: { eingangOeffnen: 'Eingang öffnen', eingangSchliessen: 'Eingang schließen', aufnahme: 'Aufnahme', stopp: 'Stopp' },
  /** Gründe gesperrter Tasten: Wortlaut der Meldungen von heute (Store: Kein Eingang gewählt.; Seitenkopf: Suche Audiogeräte…). */
  grund: { keinEingang: 'Kein Eingang gewählt', sucheGeraete: 'Suche Audiogeräte…', zustandOffen: 'Aufnahmezustand wird abgefragt…' },
  /** ON AIR im Kopf (E4). */
  onAirLabel: 'REC',
  /** Eingang: Titel wie das Feld, Zustandswörter, Maßeinheiten; die Geräteliste „Name — Treiber (n ch)“ wie bisher. */
  eingang: {
    titel: 'Eingang',
    zu: 'zu',
    offen: 'offen',
    trenner: ' · ',
    kanaele: (n: number): string => `${n} ch`,
    rate: (hz: number): string => `${hz} Hz`,
    geraet: (d: Pick<AudioDevice, 'name' | 'hostApiName' | 'maxInputChannels'>): string => `${d.name} — ${d.hostApiName} (${d.maxInputChannels} ch)`,
  },
  /** Format (tool-eigener Abschnitt): Beschriftungen und ASIO-Hinweis wie bisher. */
  format: {
    titel: 'Format',
    kanaele: 'Kanäle',
    samplerate: 'Samplerate (Hz)',
    max: 'Max',
    alleKanaele: (n: number): string => `Alle ${n} Kanäle`,
    asioHinweis: 'ASIO: Samplerate muss exakt zur Geräte-Einstellung (z. B. DVSC) passen, sonst schlägt das Öffnen fehl.',
  },
  /** Statuseintrag der Aufnahme (Name wie die Seitenüberschrift). */
  aufnahme: { titel: 'Aufnahme', keine: 'keine Aufnahme', laeuft: 'läuft' },
  /** Statuseintrag des Zeitplans (Name wie die Karte „Geplante Aufnahme“, Wörter wie ihre Marken „Start in“ und „Auto-Stopp in“). */
  zeitplan: {
    titel: 'Zeitplan',
    keiner: 'kein Zeitplan',
    start: (zeit: string): string => `Start ${zeit}`,
    stopp: (zeit: string): string => `Auto-Stopp ${zeit}`,
    trenner: ' · ',
  },
  /** Statuseintrag, wenn die Geräteliste leer bleibt (das Addon lädt nicht, Nachmessung 5.2). */
  audioModul: { titel: 'Audio-Modul', fehlt: 'Audio-Modul fehlt' },
  /** Meldung des Hauptprozesses (`recorder:notice`), die bis „OK“ stehen bleibt (E13). */
  meldung: { titel: 'Meldung', ok: 'OK' },
  companionModul: 'JM Audio Recorder',
} as const;

/** Der Teil des Recorder-Stores, den die Ableitungen brauchen (der Store erfüllt ihn strukturell). */
export interface RecorderZustand {
  /** Gemerkter Wunsch: gewähltes Gerät, Kanäle, Samplerate (maßgeblich, solange der Eingang zu ist). */
  deviceIndex: number | null;
  channels: number;
  sampleRate: number;
  /**
   * Vorgabewert des Stores (IDLE, nie vom Main gefragt). Wird hier nie gelesen: Der gemessene Zustand kommt getrennt als
   * `OberflaechenStand.zustand`.
   */
  state?: RecorderState;
  /** true, bis `init` durch ist (Geräte werden gesucht). */
  loading: boolean;
  /** Gemerkter Eingang beim Start nicht gefunden (#291). */
  hinweisEingang: string | null;
  /**
   * Toast des Stores UND des Hauptprozesses in EINEM Feld (`notice`). Wird hier nie gelesen: Eine Store-Meldung ergibt keinen
   * Eintrag. Die Meldung des Hauptprozesses kommt getrennt als `OberflaechenStand.meldung`.
   */
  notice?: string | null;
}

export interface OberflaechenStand {
  /** Store des Recorders; undefined = noch nicht geladen (dann „unbekannt“, nie live). */
  recorder: RecorderZustand | undefined;
  /**
   * Gemessener Zustand des Hauptprozesses (Status, offenes Gerät mit Kanälen und Samplerate, Datei, Uhr, Plan); undefined, bis
   * Main wirklich geantwortet hat. Aufnahme, Zeitplan, ON AIR, Eingang offen/zu und die Haupttasten lesen NUR dies, nie
   * `recorder.state` (der Store startet mit dem Vorgabewert IDLE). Vertrag für die View: Sie füllt `zustand` aus einem
   * einmaligen `window.jmrec.getState()` beim Einhängen und aus `onState`, je nachdem was zuerst kommt. Ein späterer Push
   * gewinnt immer; die Antwort von getState gilt nur, solange noch kein Push kam. Nur lesend, der Store bleibt unverändert.
   */
  zustand: RecorderState | undefined;
  /** Geräteliste (`listDevices`); undefined = noch nicht gefragt. Eine leere Liste bei `loading` zählt als unbekannt. */
  geraete: readonly AudioDevice[] | undefined;
  /**
   * Meldung des Hauptprozesses (`onNotice`), die noch nicht quittiert ist; null = keine offene. Das ist Oberflächenzustand
   * der View (Ruling P3): `onNotice` setzt ihn auf den Text, der Knopf „OK“ (RECORDER_TEXTE.meldung.ok) setzt ihn auf null.
   * Er bleibt sonst stehen, bis quittiert; eine neuere Meldung ersetzt die ältere. Er gehört nicht in den Store.
   */
  meldung: string | null;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8729): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
}

/** Aktionen des Panels: die View ruft damit den Store erst im Rückruf. */
export interface RecorderAktionen {
  geraetWaehlen(index: number): void;
  geraeteAktualisieren(): void;
}

const KEINE_AKTION: RecorderAktionen = { geraetWaehlen: () => {}, geraeteAktualisieren: () => {} };

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

/** Der Eingang ist offen (gemessen): `armed` oder `recording`. */
const eingangOffen = (z: RecorderState | undefined): boolean => z !== undefined && z.status !== 'idle';

/** Es wird aufgenommen (gemessen); `armed` zählt nicht (E4). */
const nimmtAuf = (z: RecorderState | undefined): boolean => z?.status === 'recording';

/** Geräteliste, wie sie der Abschnitt bekommt: undefined, solange sie nicht gefragt oder noch beim Suchen und leer ist. */
function geraeteListe(s: OberflaechenStand): readonly AudioDevice[] | undefined {
  if (s.geraete === undefined) return undefined;
  if (s.geraete.length === 0 && s.recorder?.loading !== false) return undefined;
  return s.geraete;
}

/** ON AIR (E4): nur gemessenes `recording`, nie `armed`; ohne Store nie live. */
export function kopfOnAir(s: Pick<OberflaechenStand, 'zustand'>): { live: boolean; label: string } {
  return { live: nimmtAuf(s.zustand), label: RECORDER_TEXTE.onAirLabel };
}

/**
 * Eingang (Audiogerät, eine Wahl): `id = String(device.index)`, Beschriftung „Name — Treiber (n ch)“. Bei offenem Eingang
 * gilt das gemessene Gerät und der Abschnitt ist gesperrt (Auswahl und „Geräte aktualisieren“, wie bisher `disabled={open}`).
 * Kein Pegel (die Meter bleiben im Live-Bereich).
 */
export function eingangAbschnitt(s: OberflaechenStand, a: RecorderAktionen = KEINE_AKTION): AudioDeviceSectionProps {
  const r = s.recorder;
  const offen = eingangOffen(s.zustand);
  const gemessen = offen ? s.zustand?.device : null;
  const wahl = gemessen ?? r?.deviceIndex ?? null;
  const liste = geraeteListe(s);
  const sperre = offen ? AUDIO_TEXTE.sperreEingangOffen : undefined;
  return {
    id: ABSCHNITT.eingang,
    locked: sperre,
    choices: [
      {
        key: 'eingang',
        label: RECORDER_TEXTE.eingang.titel,
        direction: 'input',
        devices: liste?.map((d) => ({ id: String(d.index), label: RECORDER_TEXTE.eingang.geraet(d) })),
        value: wahl === null ? '' : String(wahl),
        required: true,
        lockedReason: sperre,
        onChange: (id) => a.geraetWaehlen(Number(id)),
      },
    ],
    capabilities: { refresh: true },
    onRefresh: () => a.geraeteAktualisieren(),
  };
}

/** Felder des tool-eigenen Abschnitts Format. Ohne `lockedReason` ist das Feld frei. */
export interface FormatAbschnittProps {
  id: string;
  kanaele: { wert: number; min: number; max: number; lockedReason?: string };
  samplerate: { wert: number; min: number; lockedReason?: string };
  /** „Max“ und sein Tooltip: nur mit gewähltem Gerät (alle Eingangskanäle des Geräts). */
  alleKanaele?: { kanaele: number; lockedReason?: string };
  /** ASIO-Hinweis: nur beim gewählten ASIO-Gerät. */
  asioHinweis: boolean;
}

/** Format: Kanäle und Samplerate, gesperrt bei offenem Eingang (E13; die Werte sind der gemerkte Wunsch). */
export function formatAbschnitt(s: OberflaechenStand): FormatAbschnittProps {
  const r = s.recorder;
  const gewaehlt = s.geraete?.find((d) => d.index === r?.deviceIndex);
  const lockedReason = eingangOffen(s.zustand) ? AUDIO_TEXTE.sperreEingangOffen : undefined;
  const mitGrund = <T extends object>(o: T): T & { lockedReason?: string } => (lockedReason === undefined ? o : { ...o, lockedReason });
  return {
    id: ABSCHNITT.format,
    kanaele: mitGrund({ wert: r?.channels ?? 2, min: 1, max: gewaehlt?.maxInputChannels ?? 64 }),
    samplerate: mitGrund({ wert: r?.sampleRate ?? 48000, min: 8000 }),
    ...(gewaehlt === undefined ? {} : { alleKanaele: mitGrund({ kanaele: gewaehlt.maxInputChannels }) }),
    asioHinweis: gewaehlt !== undefined && /asio/i.test(gewaehlt.hostApiName),
  };
}

/** Fernsteuerung: Meldung des Steuerservers (Port 8729), Einrichten nur im Launcher. */
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
    companionModule: RECORDER_TEXTE.companionModul,
    capabilities: {},
  };
}

/** Uhrzeit hh:mm eines Zeitstempels (epoch ms). */
const uhrzeit = (ms: number): string => formatUhrzeitKurz(new Date(ms).toISOString()) as string;

/**
 * Eingang: gleiche Wahrheit wie der Abschnitt (Gerät gefunden, fehlt, nicht gewählt, Liste unbekannt). Offen steht NUR aus
 * dem Gemessenen (device, channels, sampleRate des Hauptprozesses); zu zeigt den gemerkten Wunsch und `hinweisEingang`,
 * nie ok („zu“ ist off wie bei den Ausgabefenstern, E3). Ohne Store unbekannt.
 */
function eingangItem(s: OberflaechenStand): StatusItem {
  const T = RECORDER_TEXTE.eingang;
  const r = s.recorder;
  const kopf = { id: ABSCHNITT.eingang, group: 'tool', label: T.titel, settingsSection: ABSCHNITT.eingang } as const;
  // Ohne gemessenen Zustand weiß niemand, ob der Eingang offen ist: kein „zu“ aus dem Vorgabewert.
  if (r === undefined || s.zustand === undefined) return unbekannt(kopf);
  const z = s.zustand;
  const basis = abschnittStatusItem(audioDeviceView(eingangAbschnitt(s)), { group: 'tool', label: T.titel });
  const liste = geraeteListe(s);
  const masse = (kanaele: number, rate: number): string => `${T.kanaele(kanaele)}${T.trenner}${T.rate(rate)}`;
  if (eingangOffen(z)) {
    const name = liste?.find((d) => d.index === z.device)?.name;
    // Gerät nicht in der gemessenen Liste: der Abschnitt hat recht (Fehler), die Aufnahme läuft trotzdem weiter.
    if (liste !== undefined && name === undefined) return { ...basis, detail: `${T.offen}${T.trenner}${basis.detail}` };
    const wer = name === undefined ? '' : `${name}${T.trenner}`;
    return { ...kopf, state: 'ok', detail: `${T.offen}${T.trenner}${wer}${masse(z.channels, z.sampleRate)}` };
  }
  if (r.hinweisEingang !== null) return { ...kopf, state: 'warn', detail: `${T.zu}${T.trenner}${r.hinweisEingang}` };
  if (basis.state !== 'ok') return basis.detail === AUDIO_TEXTE.unbekannt ? basis : { ...basis, detail: `${T.zu}${T.trenner}${basis.detail}` };
  const name = liste?.find((d) => d.index === r.deviceIndex)?.name;
  return { ...kopf, state: 'off', detail: `${T.zu}${T.trenner}${name === undefined ? '' : `${name}${T.trenner}`}${masse(r.channels, r.sampleRate)}` };
}

/**
 * Aufnahme: live NUR bei gemessenem `recording` (E4, `armed` nicht), mit Dateiname; sonst off „keine Aufnahme“. Ohne Store
 * unbekannt.
 */
function aufnahmeItem(s: OberflaechenStand): StatusItem {
  const T = RECORDER_TEXTE.aufnahme;
  const kopf = { id: 'aufnahme', group: 'ausgabe', label: T.titel } as const;
  const z = s.zustand;
  if (z === undefined) return unbekannt(kopf);
  if (!nimmtAuf(z)) return { ...kopf, state: 'off', detail: T.keine };
  return { ...kopf, state: 'live', detail: z.filePath ? basename(z.filePath) : T.laeuft };
}

/**
 * Zeitplan (gemessen vom Hauptprozess): ein wartender Start (mit Stopp, falls geplant) oder ein Auto-Stopp in der laufenden
 * Aufnahme → ok mit Uhrzeit; sonst off. Ohne Store unbekannt.
 */
function zeitplanItem(s: OberflaechenStand): StatusItem {
  const T = RECORDER_TEXTE.zeitplan;
  const kopf = { id: 'zeitplan', group: 'tool', label: T.titel } as const;
  const z = s.zustand;
  if (z === undefined) return unbekannt(kopf);
  const start = z.scheduledStartAt;
  const stopp = z.scheduledStopAt;
  if (typeof start === 'number') {
    const teile = [T.start(uhrzeit(start)), ...(typeof stopp === 'number' ? [T.stopp(uhrzeit(stopp))] : [])];
    return { ...kopf, state: 'ok', detail: teile.join(T.trenner) };
  }
  if (nimmtAuf(z) && typeof stopp === 'number') return { ...kopf, state: 'ok', detail: T.stopp(uhrzeit(stopp)) };
  return { ...kopf, state: 'off', detail: T.keiner };
}

/** Audio-Modul: nur bei gemessen leerer Liste und fertigem Start ein Fehler (Befund 3); sonst kein Eintrag. */
function audioModulItem(s: OberflaechenStand): StatusItem[] {
  const leer = s.geraete !== undefined && s.geraete.length === 0 && s.recorder?.loading === false;
  return leer ? [{ id: 'audio-modul', group: 'tool', label: RECORDER_TEXTE.audioModul.titel, state: 'error', detail: RECORDER_TEXTE.audioModul.fehlt }] : [];
}

/** Meldung des Hauptprozesses: warn, bis sie quittiert ist (E13). Eine Meldung des Stores ergibt nie einen Eintrag. */
function meldungItem(s: OberflaechenStand): StatusItem[] {
  const text = s.meldung?.trim() ?? '';
  return text === '' ? [] : [{ id: 'meldung', group: 'tool', label: RECORDER_TEXTE.meldung.titel, state: 'warn', detail: text }];
}

/** Statusleiste: master-link, aufnahme, fernsteuerung, eingang, zeitplan, audio-modul (nur bei Fehler), meldung (nur offen). */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    aufnahmeItem(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    eingangItem(s),
    zeitplanItem(s),
    ...audioModulItem(s),
    ...meldungItem(s),
  ];
}

function taste(label: string, state: TasteZustand['state'], grund?: string): Haupttaste {
  return { label, state, ...(grund === undefined ? {} : { disabledReason: grund }) };
}

/**
 * Die zwei Haupttasten (E7): eine Taste Eingang öffnen/schließen mit wechselnder Beschriftung, eine Taste Aufnahme/Stopp.
 * - Eingang: nie `live`. „Eingang öffnen“ ist gesperrt ohne gewähltes Gerät (RecorderView.tsx:147, `deviceIndex == null`), Grund
 *   „Kein Eingang gewählt“, solange die Geräte noch gesucht werden „Suche Audiogeräte…“; „Eingang schließen“ ist immer bereit
 *   (`:177-181`, auch während der Aufnahme).
 * - Aufnahme: `live` bei `recording` mit „Stopp“ (`:151-163`); sonst bereit, auch bei zu: Das Starten scheitert dort mit einem
 *   Toast (Funktionsliste Nr. 80), gesperrt wird nicht.
 * - Ohne gemessenen Zustand (`zustand` undefined) sind beide gesperrt, Grund „Aufnahmezustand wird abgefragt…“.
 */
export function hauptTasten(s: Pick<OberflaechenStand, 'recorder' | 'zustand'>): { eingang: Haupttaste; aufnahme: Haupttaste } {
  const T = RECORDER_TEXTE;
  const r = s.recorder;
  const z = s.zustand;
  // Ohne gemessenen Zustand ist offen/zu und Aufnahme unbekannt: beide Tasten gesperrt, mit sichtbarem Grund.
  if (z === undefined) return { eingang: taste(T.taste.eingangOeffnen, 'gesperrt', T.grund.zustandOffen), aufnahme: taste(T.taste.aufnahme, 'gesperrt', T.grund.zustandOffen) };
  const sucht = r === undefined || r.loading;
  const ohneGeraet = r === undefined || r.deviceIndex === null;
  const eingang = eingangOffen(z)
    ? taste(T.taste.eingangSchliessen, 'bereit')
    : ohneGeraet
      ? taste(T.taste.eingangOeffnen, 'gesperrt', sucht ? T.grund.sucheGeraete : T.grund.keinEingang)
      : taste(T.taste.eingangOeffnen, 'bereit');
  const aufnahme = nimmtAuf(z) ? taste(T.taste.stopp, 'live') : taste(T.taste.aufnahme, 'bereit');
  return { eingang, aufnahme };
}
