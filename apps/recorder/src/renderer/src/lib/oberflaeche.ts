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
// Relativ statt über den Alias @shared/: der Store lädt dieses Modul (Texte, Altfehler Stufe 2), und sein Test läuft unter tsx ohne Aliase.
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '../../../shared/fernsteuerung';
import { netzwerkServer, saeubereAnzeige } from '../../../shared/presets';
import { SCHLIESSEN_TEXTE } from '../../../shared/schliessen';
import { ERST_AUFNAHME_STOPPEN, FERNBEFEHL_ABGELEHNT, type AudioDevice, type MasterLinkMeldungZeile, type RecorderFehler, type RecorderState } from '../../../shared/types';
import { basename } from './format';
import { bytesProSekunde, platzEintrag, platzOrdner, PLATZ_TEXTE } from './platz';

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
  /**
   * Haupttasten: Beschriftungen wie die alten Knöpfe (RecorderView.tsx:146-176). Altfehler RE-3: „Neu aufnehmen“ heißt die Aufnahme-Taste,
   * solange das Fehlerfeld des Hauptprozesses steht (ein gelungener Start löscht es).
   */
  taste: { eingangOeffnen: 'Eingang öffnen', eingangSchliessen: 'Eingang schließen', aufnahme: 'Aufnahme', stopp: 'Stopp', neuAufnehmen: 'Neu aufnehmen' },
  /**
   * Gründe gesperrter Tasten: Wortlaut der Meldungen von heute (Store: Kein Eingang gewählt.; Seitenkopf: Suche Audiogeräte…;
   * Hauptprozess: Erst den Eingang öffnen (Arm)., src/main/recorder.ts:298, ohne den Zusatz; Fix-Runde 1, für Z1).
   */
  grund: {
    keinEingang: 'Kein Eingang gewählt',
    sucheGeraete: 'Suche Audiogeräte…',
    zustandOffen: 'Aufnahmezustand wird abgefragt…',
    eingangZu: 'Erst den Eingang öffnen',
    /** Altfehler RE-2: „Eingang schließen“ in der Aufnahme, Wortlaut der Spec; derselbe Satz wie ERST_AUFNAHME_STOPPEN ohne den Punkt (K4). */
    aufnahmeLaeuft: ERST_AUFNAHME_STOPPEN.replace(/\.$/, ''),
  },
  /**
   * Abgelehnter Fernbefehl (B6; Altfehler RE-2, RE-2b, RE-7b), als Meldung bis „OK“ (recorder:notice). Das Verb wie Companion es schickt
   * (ARM, DISARM, RECORD ON, RECORD TOGGLE); „Companion“ wie im Player (PL-16a), auch wenn der Befehl von Rundown kommt.
   */
  fernbefehl: {
    /** Seit Ruling R11 nennt auch der Wächter des Hauptprozesses diesen Satz; er steht darum einmal in shared/types.ts (K4). */
    abgelehnt: FERNBEFEHL_ABGELEHNT.hinweis,
    grund: {
      aufnahmeLaeuft: ERST_AUFNAHME_STOPPEN,
      keinOrdner: 'Kein Zielordner gewählt.',
      netzordnerOffen: 'Der Netzwerkordner aus der Show ist noch nicht bestätigt.',
    },
  },
  /**
   * Altfehler RE-7b: ein Netzwerkordner aus der Show wartet im Hinweisband auf „Übernehmen“ (nie ein Dialog, B4); ein ungültiger Ordner aus
   * der Show wird nicht übernommen. Ersetzt den Hinweis „Zielordner aus der Show liegt im Netzwerk: … – nur verwenden, wenn dieser Ordner
   * bekannt ist.“ (store/recorder.ts bis 0.10.0). „Übernehmen“ wie der Knopf der Rückfrage im Preset-Import (main/ipc.ts).
   */
  netzordner: {
    hinweis: (pfad: string, server: string): string =>
      `Die Show möchte in einem Netzwerkordner aufnehmen: ${pfad} (Server ${server}). Erst nach „Übernehmen“ ist er gesetzt – Windows meldet sich dann bei diesem Server an.`,
    uebernehmen: 'Übernehmen',
    ungueltig: (pfad: string): string => `Zielordner aus der Show ist kein gültiger Ordner und wurde nicht übernommen: ${pfad}`,
  },
  /**
   * Altfehler RE-3: das Fehlerfeld des Hauptprozesses (die Aufnahme endete mit einem Fehler oder ein Start scheiterte). Die Marke heißt nie
   * „Fehler“, das ist UI_TEXTE.zustand.error; das Detail steht im Statuseintrag „Aufnahme“. Bei `eingang` ist der Grund der Text des
   * Fehlerfelds aus dem Hauptprozess („Keine Audiodaten vom Eingang“, AUFNAHME_FEHLER_TEXTE.eingangGrund), er steht nur dort.
   */
  fehler: {
    marke: { schreiben: 'Schreibfehler', eingang: 'Kein Eingang', start: 'Nicht gestartet' },
    detail: (f: Pick<RecorderFehler, 'art' | 'text'>): string =>
      f.art === 'schreiben' ? `Schreibfehler – Aufnahme beendet: ${f.text}` : f.art === 'eingang' ? `${f.text} – Aufnahme beendet` : `Aufnahme nicht gestartet: ${f.text}`,
  },
  /** Altfehler RE-7a: Rückfrage beim Schließen während einer Aufnahme (die Konstante steht in shared/schliessen.ts, K4). */
  schliessen: SCHLIESSEN_TEXTE,
  /** Altfehler RE-PLATZ: Statuseintrag „Platz“ (Restzeit im Zielordner; die Konstante steht in lib/platz.ts, K4). */
  platz: PLATZ_TEXTE,
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
    /**
     * Fußtext der Karte „Geplante Aufnahme“ (R9, für Z1): Zielordner, Dateiname und Spuren stehen jetzt im Panel, nicht mehr
     * „oben“; die Schlusszeichen sind typografisch. Alt (RecorderView.tsx:400-403 bei d7cdd79ce0): „… und „Spuren einzeln"
     * gelten wie oben eingestellt. …“
     */
    fusstext:
      'Start/Stopp laufen zuverlässig im Hintergrund (auch unbeaufsichtigt). Zielordner, Dateiname und „Spuren einzeln“ gelten wie in den Einstellungen unter Ziel eingestellt. Ein manueller Stopp hebt den Auto-Stopp auf.',
  },
  /** Statuseintrag, wenn die Geräteliste leer bleibt (das Addon lädt nicht, Nachmessung 5.2). */
  audioModul: { titel: 'Audio-Modul', fehlt: 'Audio-Modul fehlt' },
  /** Meldung des Hauptprozesses (`recorder:notice`), die bis „OK“ stehen bleibt (E13). */
  meldung: { titel: 'Meldung', ok: 'OK' },
  companionModul: 'JM Audio Recorder',
  /**
   * Ziel (tool-eigener Abschnitt im Panel und Ziel-Anzeige im Live-Bereich): Wortlaut wie bisher (RecorderView.tsx:187-233). Neu
   * ist nur der Titel „Ziel“; die Erläuterung der Spuren endet jetzt typografisch („““ statt ASCII-", R9, für Z1).
   */
  ziel: {
    titel: 'Ziel',
    ordner: 'Zielordner',
    ordnerWaehlen: 'Ordner wählen…',
    keinOrdner: 'noch keiner gewählt',
    dateiname: 'Dateiname (optional)',
    dateinamePlatzhalter: 'leer = Zeitstempel',
    spuren: 'Spuren zusätzlich einzeln speichern',
    spurenHinweis: 'je Kanal eine Mono-WAV im Unterordner „…-Spuren“',
    imOrdnerZeigen: 'Im Ordner zeigen',
  },
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
  /**
   * Altfehler RE-PLATZ: freier Platz (Store `platzFrei`: undefined = noch keine Antwort, null = nicht lesbar), der Spuren-Wunsch und der
   * Zielordner des Stores. Optional; fehlt er, steht „Platz unbekannt“.
   */
  platz?: { frei: number | null | undefined; spuren: boolean; dir: string | null };
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

/** Das Fehlerfeld des Hauptprozesses (Altfehler RE-3); null, wenn keins steht oder der Zustand unbekannt ist. */
const fehlerVon = (z: RecorderState | undefined): RecorderFehler | null => z?.fehler ?? null;

/** ON AIR (E4): nur gemessenes `recording`, nie `armed`; ohne Store nie live; nie bei einem Fehlerfeld (Altfehler RE-3, B2). */
export function kopfOnAir(s: Pick<OberflaechenStand, 'zustand'>): { live: boolean; label: string } {
  return { live: nimmtAuf(s.zustand) && fehlerVon(s.zustand) === null, label: RECORDER_TEXTE.onAirLabel };
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
 * unbekannt. Altfehler RE-3: steht das Fehlerfeld, ist der Eintrag error mit dem Grund (bis ein Start gelingt, ein Stopp quittiert oder
 * jemand den Eingang schließt).
 */
function aufnahmeItem(s: OberflaechenStand): StatusItem {
  const T = RECORDER_TEXTE.aufnahme;
  const kopf = { id: 'aufnahme', group: 'ausgabe', label: T.titel } as const;
  const z = s.zustand;
  if (z === undefined) return unbekannt(kopf);
  const f = fehlerVon(z);
  if (f !== null) return { ...kopf, state: 'error', detail: RECORDER_TEXTE.fehler.detail(f) };
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

/**
 * Altfehler RE-PLATZ: der freie Platz als Restzeit für das Format, das gerade gilt: vor der Aufnahme der Wunsch des Stores (Kanäle,
 * Samplerate, Spuren), bei offenem Eingang die gemessenen Kanäle und die Samplerate, in der Aufnahme zusätzlich die gemessenen Spuren und
 * der Ordner der Datei. Ohne Platz-Stand „Platz unbekannt“ (G15).
 */
function platzItem(s: OberflaechenStand): StatusItem {
  const p = s.platz;
  if (p === undefined) return platzEintrag(undefined, 0, null);
  const z = s.zustand;
  const offen = eingangOffen(z);
  const kanaele = offen && z ? z.channels : (s.recorder?.channels ?? 0);
  const rate = offen && z ? z.sampleRate : (s.recorder?.sampleRate ?? 0);
  const spuren = nimmtAuf(z) && z ? z.spuren : p.spuren;
  return platzEintrag(p.frei, bytesProSekunde({ kanaele, rate, spuren }), platzOrdner(z, p.dir));
}

/**
 * Statusleiste: master-link, aufnahme, platz (Altfehler RE-PLATZ), fernsteuerung, eingang, zeitplan, audio-modul (nur bei Fehler), meldung
 * (nur offen).
 */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    aufnahmeItem(s),
    platzItem(s),
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
 * Hinweis zu einem Netzwerkordner aus der Show, der auf „Übernehmen“ wartet (Altfehler RE-7b): Pfad und Server gesäubert wie im
 * Dialog des Imports (saeubereAnzeige, netzwerkServer); ohne erkennbaren Server steht der Pfad dort.
 */
export function netzordnerHinweis(pfad: string): string {
  return RECORDER_TEXTE.netzordner.hinweis(saeubereAnzeige(pfad), saeubereAnzeige(netzwerkServer(pfad) ?? pfad));
}

/**
 * Die zwei Haupttasten (E7): eine Taste Eingang öffnen/schließen mit wechselnder Beschriftung, eine Taste Aufnahme/Stopp.
 * - Eingang: nie `live`. „Eingang öffnen“ ist gesperrt ohne gewähltes Gerät (RecorderView.tsx:147, `deviceIndex == null`), Grund
 *   „Kein Eingang gewählt“, solange die Geräte noch gesucht werden „Suche Audiogeräte…“; „Eingang schließen“ ist bereit bei `armed`
 *   und seit Altfehler RE-2 in der Aufnahme gesperrt mit „Erst die Aufnahme stoppen“ (bisher bereit, `:177-181`; es beendete die
 *   Aufnahme ohne Rückfrage).
 * - Aufnahme: `live` bei `recording` mit „Stopp“ (`:151-163`), bereit bei `armed` (`:160-170`), mit Fehlerfeld als „Neu aufnehmen“
 *   (Altfehler RE-3). Bei zu gab es bisher keine
 *   Aufnahme-Taste, und ein Start scheitert dort immer im Main: gesperrt mit „Erst den Eingang öffnen“ (Fix-Runde 1, Ruling). Der
 *   Fernbefehl RECORD läuft weiter über den Store (Nr. 80).
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
  const eingang = nimmtAuf(z)
    ? taste(T.taste.eingangSchliessen, 'gesperrt', T.grund.aufnahmeLaeuft)
    : eingangOffen(z)
      ? taste(T.taste.eingangSchliessen, 'bereit')
      : ohneGeraet
        ? taste(T.taste.eingangOeffnen, 'gesperrt', sucht ? T.grund.sucheGeraete : T.grund.keinEingang)
        : taste(T.taste.eingangOeffnen, 'bereit');
  // Altfehler RE-3: bei offenem Eingang mit Fehlerfeld heißt die Taste „Neu aufnehmen“ (bereit; ein gelungener Start löscht den Fehler).
  const aufnahme = nimmtAuf(z)
    ? taste(T.taste.stopp, 'live')
    : eingangOffen(z)
      ? taste(fehlerVon(z) !== null ? T.taste.neuAufnehmen : T.taste.aufnahme, 'bereit')
      : taste(T.taste.aufnahme, 'gesperrt', T.grund.eingangZu);
  return { eingang, aufnahme };
}
