// Interpreter-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, E4 ON AIR, E10 Wechselhinweis und Ducking).
// Aus dem Zustand der Engine im Renderer, den Einstellungen, der gemessenen Geräteliste und der Master-Link-Meldung entstehen die
// Props des Geräte-Abschnitts, die Statusleiste, das ON AIR des Kopfes und die Haupttaste. Kein window, kein IPC, kein
// localStorage, kein Store-Import: Die Tests laufen ohne Browser. Der Geräte-Abschnitt ist die eine Wahrheit: floor, dolmetscher
// und ausgabe nehmen Zustand und Text aus der Sicht von `audioDeviceView`, nie aus eigenen Texten.
import { abschnittStatusItem, audioDeviceView, type AudioDeviceSectionProps, type AudioWahlView } from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import type { MasterLinkMeldungZeile } from '@shared/api';
import type { EngineState } from '@/core/engine';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. `ducking` ist tool-eigen. */
export const ABSCHNITT = {
  geraete: 'geraete',
  ducking: 'ducking',
} as const;

/**
 * Feste Texte des Interpreters (kein ASCII-Anführungszeichen). Wortlaut wie bisher (App.tsx), Texte aus @jm/settings und @jm/ui
 * werden nie nachgebaut, sondern dort gelesen (AUDIO_TEXTE, UNBEKANNT).
 */
export const INTERPRETER_TEXTE = {
  /** Haupttaste: Beschriftungen wie der alte Knopf (App.tsx:101). */
  taste: { starten: 'Starten', stoppen: 'Stoppen' },
  /** Grund der gesperrten Haupttaste: `eingaengeFehlen` wörtlich wie App.tsx:96; `zustandOffen` gilt nur vor der ersten Antwort. */
  grund: { eingaengeFehlen: 'Erst beide Eingänge wählen', zustandOffen: 'Lädt …' },
  /** ON AIR (E4): Beschriftung des Kopfes. */
  onAir: 'MIX AKTIV',
  /** E10 / W2-V3: Hinweis an jeder der drei Geräte-Wahlen (die Wahl greift nur beim Start, engine.start). */
  wechselWirktNachNeustart: 'Wirkt erst nach Stopp und erneutem Start.',
  /** Geräte-Wahlen: Beschriftungen wie die alten Auswahlfelder (App.tsx:120-137), Kurznamen der Statuseinträge, Standardoption. */
  geraete: {
    floor: 'Floor (O-Ton)',
    floorKurz: 'Floor',
    dolmetscher: 'Dolmetscher',
    ausgabe: 'Ausgabe (virtuelles Kabel)',
    ausgabeKurz: 'Ausgabegerät',
    standard: 'Systemstandard',
  },
  /** Ducking: Titel des Statuseintrags, Zustände (vorher FLOOR ABGESENKT / Floor offen, App.tsx:163) und Überbrückt (E10). */
  ducking: { titel: 'Ducking', abgesenkt: 'abgesenkt', offen: 'offen', ueberbrueckt: 'überbrückt' },
  /** Statuseintrag von `state.error` (die Meldung selbst steht als Text). */
  fehler: { titel: 'Fehlermeldung', keiner: 'kein Fehler' },
  /**
   * E10, R9: ersetzt „… Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.“ (App.tsx:326-327). Falsch beim
   * Start: `route()` ruft setSinkId mit der unbekannten ID, setSinkId lehnt ab, `start()` stoppt und meldet den Fehler. Es
   * läuft nie auf dem Systemstandard. Für ein Gerät, das erst im Lauf verschwindet, ist nichts gemessen und nichts behauptet.
   */
  ausgabeNichtVerfuegbar: 'Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Start schlägt damit fehl.',
} as const;

/** Ein Gerät der gemessenen Liste (wie `DeviceInfo` des Motors: id = deviceId, label wie die alte Auswahl). */
export interface GeraetEintrag {
  deviceId: string;
  label: string;
}

/** Ergebnis von `listDevices`: nur eine echte Antwort ist ein Wert. */
export interface GeraeteStand {
  eingaenge: readonly GeraetEintrag[];
  ausgaenge: readonly GeraetEintrag[];
  /** Ohne lesbare Namen sind auch die IDs leer: die Liste ist dann keine Messung (siehe `OberflaechenStand.geraete`). */
  labelsAvailable: boolean;
}

/** Die Einstellungen, die die Oberfläche braucht (Store `useSettings`, ohne die Ducking-Regler). */
export interface Einstellungen {
  floorId: string;
  interpreterId: string;
  /** Leer = Systemstandard. */
  outputId: string;
  bypass: boolean;
}

/**
 * Gemessener Stand. Jeder Wert ist undefined, solange er nicht wirklich gemessen ist; ohne Wert sind die Einträge unbekannt
 * und die Haupttaste gesperrt mit sichtbarem Grund, nie ein sicherer Zustand.
 */
export interface OberflaechenStand {
  /**
   * Zustand der Engine im Renderer (`engine.getState()` nach dem Verdrahten des Effekts). undefined, bis die View die
   * Engine verdrahtet und den ersten Zustand gelesen hat: `useState(() => engine.getState())` vor dem Effekt ist nur der
   * Konstruktor-Vorgabewert (nichts läuft) und gehört nicht hierher. Die erste echte Antwort ist der erste `getState()`
   * im Effekt (App.tsx:26-28), `setState(engine.getState())`.
   */
  engine: EngineState | undefined;
  /** Die Einstellungen, sobald der Store sie geliefert hat; undefined = noch nicht gelesen. */
  einstellungen: Einstellungen | undefined;
  /**
   * Antwort des ersten `listDevices()`; undefined, bis sie da ist. Der Anfangswert `[]` des React-Zustands ist keine Messung
   * (devicesLoaded, App.tsx:18-21). Mit `labelsAvailable: false` ist die Antwort leer an Namen und IDs und zählt als
   * unbekannt, nicht als „Gerät nicht gefunden“. Eine Liste mit `[]` bei lesbaren Namen ist eine gemessene leere Liste.
   */
  geraete: GeraeteStand | undefined;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
}

/** Aktionen des Panels: die View ruft damit den Store erst im Rückruf. */
export interface InterpreterAktionen {
  floorWaehlen(id: string): void;
  dolmetscherWaehlen(id: string): void;
  ausgabeWaehlen(id: string): void;
}

const KEINE_AKTION: InterpreterAktionen = {
  floorWaehlen: () => {},
  dolmetscherWaehlen: () => {},
  ausgabeWaehlen: () => {},
};

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

/** ON AIR (E4): nur solange der Motor läuft, Beschriftung „MIX AKTIV“; ohne Antwort nie live. */
export function kopfOnAir(s: Pick<OberflaechenStand, 'engine'>): { live: boolean; label: string } {
  return { live: s.engine?.running === true, label: INTERPRETER_TEXTE.onAir };
}

/**
 * Das Ausgabegerät, das gerade wirkt: während des Laufs das beim Start gewählte (`engine.route()` läuft nur in `start()`,
 * App.tsx:271-274), sonst die Einstellung. undefined = noch unbekannt.
 */
function wirksameAusgabe(s: Pick<OberflaechenStand, 'engine' | 'einstellungen'>): string | undefined {
  const e = s.engine;
  if (e?.running === true && e.startedOutputId !== null) return e.startedOutputId;
  return s.einstellungen?.outputId;
}

/** Eine Liste ist nur mit lesbaren Namen eine Messung; sonst bleibt sie unbekannt (undefined), nie leer. */
function liste(s: Pick<OberflaechenStand, 'geraete'>, art: 'eingaenge' | 'ausgaenge'): Array<{ id: string; label: string }> | undefined {
  const g = s.geraete;
  if (g === undefined || !g.labelsAvailable) return undefined;
  return g[art].map((d) => ({ id: d.deviceId, label: d.label }));
}

function abschnitt(s: OberflaechenStand, ausgabeId: string | undefined, a: InterpreterAktionen): AudioDeviceSectionProps {
  const e = s.einstellungen;
  const laeuft = s.engine?.running === true;
  // Ohne Einstellungen ist jede Wahl ungelesen: die Liste bleibt unbekannt, sonst hieße die leere ID fälschlich „nicht gewählt“.
  const eingaenge = e === undefined ? undefined : liste(s, 'eingaenge');
  const ausgaenge = e === undefined ? undefined : liste(s, 'ausgaenge');
  const warnung = INTERPRETER_TEXTE.wechselWirktNachNeustart;
  return {
    id: ABSCHNITT.geraete,
    choices: [
      {
        key: 'floor',
        label: INTERPRETER_TEXTE.geraete.floor,
        direction: 'input',
        devices: eingaenge,
        value: e?.floorId ?? '',
        required: true,
        levelDb: laeuft ? s.engine?.floorDb : undefined,
        changeWarning: warnung,
        onChange: (id) => a.floorWaehlen(id),
      },
      {
        key: 'dolmetscher',
        label: INTERPRETER_TEXTE.geraete.dolmetscher,
        direction: 'input',
        devices: eingaenge,
        value: e?.interpreterId ?? '',
        required: true,
        levelDb: laeuft ? s.engine?.interpreterDb : undefined,
        changeWarning: warnung,
        onChange: (id) => a.dolmetscherWaehlen(id),
      },
      {
        key: 'ausgabe',
        label: INTERPRETER_TEXTE.geraete.ausgabe,
        direction: 'output',
        devices: ausgaenge,
        value: ausgabeId ?? '',
        defaultLabel: INTERPRETER_TEXTE.geraete.standard,
        changeWarning: warnung,
        onChange: (id) => a.ausgabeWaehlen(id),
      },
    ],
    capabilities: { level: true, refresh: false },
  };
}

/**
 * Geräte (Audiogerät, drei Wahlen): Floor und Dolmetscher (Eingang, Pflicht), Ausgabe (Standard = leere ID). Die gespeicherte
 * ID gegen die gemessene Liste: eine ID, die nicht in der Liste steht, bleibt gewählt und der Status ist „Gerät nicht
 * gefunden“ (Helfer des Abschnitts), nie der Standard. Ohne Liste oder Einstellungen ist die Wahl unbekannt. Jede Wahl trägt
 * `wechselWirktNachNeustart` (E10). Pegel nur bei laufender Engine. Das Panel zeigt die Einstellung.
 */
export function geraeteAbschnitt(s: OberflaechenStand, a: InterpreterAktionen = KEINE_AKTION): AudioDeviceSectionProps {
  return abschnitt(s, s.einstellungen?.outputId, a);
}

function wahlItem(w: AudioWahlView | undefined, id: string, label: string, group: 'ausgabe' | 'tool'): StatusItem {
  const kopf = { id, group, label, settingsSection: ABSCHNITT.geraete } as const;
  return w === undefined ? unbekannt(kopf) : { ...kopf, state: w.status.state, detail: w.status.text };
}

/**
 * Ausgabe-Eintrag: das WIRKSAME Gerät gegen die gemessene Liste (Sicht des Abschnitts). Weicht die Einstellung vom beim Start
 * gewählten Gerät ab, ist ein `ok` nur eine Warnung mit dem Hinweis, dass die Änderung erst nach Stopp und Start wirkt.
 */
function ausgabeItem(s: OberflaechenStand): StatusItem {
  const wirksam = wirksameAusgabe(s);
  const w = audioDeviceView(abschnitt(s, wirksam, KEINE_AKTION)).wahlen.find((x) => x.key === 'ausgabe');
  const item = wahlItem(w, 'ausgabe', INTERPRETER_TEXTE.geraete.ausgabeKurz, 'ausgabe');
  const offen = wirksam !== undefined && s.einstellungen !== undefined && wirksam !== s.einstellungen.outputId;
  if (offen && item.state === 'ok') return { ...item, state: 'warn', detail: `${item.detail} · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}` };
  return item;
}

/** Ducking: ohne Motor oder Einstellungen unbekannt; mit bypass „überbrückt“ (nie „offen“); sonst nach dem gemessenen Zustand. */
function duckingItem(s: OberflaechenStand): StatusItem {
  const T = INTERPRETER_TEXTE.ducking;
  const kopf = { id: 'ducking', group: 'tool', label: T.titel, settingsSection: ABSCHNITT.ducking } as const;
  if (s.engine === undefined || s.einstellungen === undefined) return unbekannt(kopf);
  if (s.einstellungen.bypass) return { ...kopf, state: 'warn', detail: T.ueberbrueckt };
  return { ...kopf, state: 'ok', detail: s.engine.ducking ? T.abgesenkt : T.offen };
}

function fehlerItem(s: OberflaechenStand): StatusItem {
  const T = INTERPRETER_TEXTE.fehler;
  const kopf = { id: 'fehler', group: 'tool', label: T.titel } as const;
  if (s.engine === undefined) return unbekannt(kopf);
  return s.engine.error === null ? { ...kopf, state: 'ok', detail: T.keiner } : { ...kopf, state: 'error', detail: s.engine.error };
}

/** Statusleiste: master-link, floor, dolmetscher, ausgabe (aus dem Geräte-Abschnitt), ducking, fehler (`state.error`). */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  const wahlen = audioDeviceView(geraeteAbschnitt(s)).wahlen;
  return [
    masterLinkStatusItem(s.masterLink),
    wahlItem(wahlen.find((w) => w.key === 'floor'), 'floor', INTERPRETER_TEXTE.geraete.floorKurz, 'tool'),
    wahlItem(wahlen.find((w) => w.key === 'dolmetscher'), 'dolmetscher', INTERPRETER_TEXTE.geraete.dolmetscher, 'tool'),
    ausgabeItem(s),
    duckingItem(s),
    fehlerItem(s),
  ];
}

function taste(label: string, state: TasteZustand['state'], grund?: string): Haupttaste {
  return { label, state, ...(grund === undefined ? {} : { disabledReason: grund }) };
}

/**
 * Haupttaste Starten/Stoppen (E4). Gesperrt mit Grund, genau wenn bisher `disabled` galt (App.tsx:95): `!floorId ||
 * !interpreterId`, auch während des Laufs (Eingang wieder auf „— bitte wählen —“ sperrt auch „Stoppen“, U6 bleibt). Zusätzlich
 * gesperrt, solange Engine oder Einstellungen nicht geantwortet haben (Grund `zustandOffen`). Keine Sperre während des Starts
 * (die Engine setzt `running` erst nach dem Öffnen der Geräte). `live` bei `running`.
 */
export function hauptTaste(s: Pick<OberflaechenStand, 'engine' | 'einstellungen'>): Haupttaste {
  const T = INTERPRETER_TEXTE;
  const e = s.einstellungen;
  if (s.engine === undefined || e === undefined) return taste(T.taste.starten, 'gesperrt', T.grund.zustandOffen);
  const laeuft = s.engine.running;
  const label = laeuft ? T.taste.stoppen : T.taste.starten;
  if (!e.floorId || !e.interpreterId) return taste(label, 'gesperrt', T.grund.eingaengeFehlen);
  return taste(label, laeuft ? 'live' : 'bereit');
}
