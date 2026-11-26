// Interpreter-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, E4 ON AIR, E10 Wechselhinweis und Ducking).
// Aus dem Zustand der Engine im Renderer, den Einstellungen, der gemessenen Geräteliste und der Master-Link-Meldung entstehen die
// Props des Geräte-Abschnitts, die Statusleiste, das ON AIR des Kopfes und die Haupttaste. Kein window, kein IPC, kein
// localStorage, kein Store-Import: Die Tests laufen ohne Browser. Der Geräte-Abschnitt ist die eine Wahrheit: floor, dolmetscher
// und ausgabe nehmen Zustand und Text aus der Sicht von `audioDeviceView`, nie aus eigenen Texten.
// Aufgabe d ergänzt die Texte des Live-Bereichs und des Abschnitts „Ducking“ (Wortlaut wie bisher, nur „Überbrückt“ neu) und die
// Tabelle der sieben Regler (Bereich, Schritt, Einheit, Hinweis wie im alten App.tsx).
import { abschnittStatusItem, audioDeviceView, type AudioDeviceSectionProps, type AudioWahlView } from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import type { MasterLinkMeldungZeile } from '@shared/api';
import type { DuckSettings } from '@shared/ducking';
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
  /**
   * Grund der gesperrten Haupttaste: `eingaengeFehlen` wörtlich wie App.tsx:96; `zustandOffen` gilt nur vor der ersten Antwort;
   * `startet`, solange die Engine startet (Altfehler IN-3).
   */
  grund: { eingaengeFehlen: 'Erst beide Eingänge wählen', zustandOffen: 'Lädt …', startet: 'Startet …' },
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
  /**
   * Ducking: Titel des Statuseintrags und des Panel-Abschnitts (wie die alte Karte, App.tsx:153), Zustände des Statuseintrags und
   * Überbrückt (E10); dazu wörtlich wie bisher Kästchen, Unterüberschrift und Knopf des Abschnitts (App.tsx:156, :172, :176).
   */
  ducking: {
    titel: 'Ducking',
    abgesenkt: 'abgesenkt',
    offen: 'offen',
    ueberbrueckt: 'überbrückt',
    bypass: 'Überbrücken (zum Vergleichshören)',
    vorverstaerkung: 'Vorverstärkung',
    zuruecksetzen: 'Ducking-Werte zurücksetzen',
  },
  /**
   * Live-Bereich: Karte „Pegel“ und Pille wörtlich wie bisher (App.tsx:138-144), Pegel mit einer Nachkommastelle bzw. „—“
   * (App.tsx:226), Tooltip der Schwellenmarke (App.tsx:232); „Überbrückt“ neu (E10, nur bei Bypass).
   */
  live: {
    pegel: 'Pegel',
    abgesenkt: 'FLOOR ABGESENKT',
    offen: 'Floor offen',
    ueberbrueckt: 'Überbrückt',
    keinPegel: '—',
    pegelWert: (db: number) => `${db.toFixed(1)} dB`,
    schwelle: (db: number) => `Schwelle ${db} dB`,
  },
  /** Regler des Abschnitts „Ducking“: Beschriftungen und Hinweise wörtlich wie bisher (App.tsx:159-168). */
  regler: {
    schwelle: 'Schwelle',
    schwelleHinweis: 'Ab diesem Dolmetscher-Pegel wird der O-Ton abgesenkt.',
    absenkung: 'Absenkung',
    absenkungHinweis: 'Wie weit der O-Ton zurückgeht, solange gesprochen wird.',
    attack: 'Attack',
    attackHinweis: 'Wie schnell abgesenkt wird.',
    release: 'Release',
    releaseHinweis: 'Wie schnell der O-Ton zurückkommt.',
    nachlauf: 'Nachlauf',
    nachlaufHinweis: 'Atempausen kürzer als der Nachlauf reißen den O-Ton nicht hoch (verhindert Pumpen).',
  },
  /** Statuseintrag von `state.error` (die Meldung selbst steht als Text). */
  fehler: { titel: 'Fehlermeldung', keiner: 'kein Fehler' },
  /**
   * E10, R9: ersetzt „… Der Mix geht auf den Systemstandard und erreicht die Konferenz nicht.“ (App.tsx:326-327). Falsch beim
   * Start: `route()` ruft setSinkId mit der unbekannten ID, setSinkId lehnt ab, `start()` stoppt und meldet den Fehler. Es
   * läuft nie auf dem Systemstandard. Für ein Gerät, das erst im Lauf verschwindet, ist nichts gemessen und nichts behauptet.
   */
  ausgabeNichtVerfuegbar: 'Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Start schlägt damit fehl.',
} as const;

/** Schlüssel eines Reglers = Feld der Ducking-Einstellungen im Store (`useSettings`, `DuckSettings`). */
export type ReglerSchluessel = keyof DuckSettings;

/** Ein Regler des Panels: Beschriftung, Einheit, Bereich und Schritt wie der alte `Slider` (Schritt-Vorgabe 1). */
export interface Regler {
  key: ReglerSchluessel;
  label: string;
  einheit: 'dB' | 'ms';
  min: number;
  max: number;
  step: number;
  hinweis?: string;
}

/** Die fünf Ducking-Regler in der Reihenfolge der alten Karte „Ducking“ (App.tsx:159-168). */
export const DUCKING_REGLER: readonly Regler[] = [
  { key: 'thresholdDb', label: INTERPRETER_TEXTE.regler.schwelle, einheit: 'dB', min: -70, max: -10, step: 1, hinweis: INTERPRETER_TEXTE.regler.schwelleHinweis },
  { key: 'duckDb', label: INTERPRETER_TEXTE.regler.absenkung, einheit: 'dB', min: -40, max: 0, step: 1, hinweis: INTERPRETER_TEXTE.regler.absenkungHinweis },
  { key: 'attackMs', label: INTERPRETER_TEXTE.regler.attack, einheit: 'ms', min: 5, max: 300, step: 5, hinweis: INTERPRETER_TEXTE.regler.attackHinweis },
  { key: 'releaseMs', label: INTERPRETER_TEXTE.regler.release, einheit: 'ms', min: 50, max: 2000, step: 10, hinweis: INTERPRETER_TEXTE.regler.releaseHinweis },
  { key: 'holdMs', label: INTERPRETER_TEXTE.regler.nachlauf, einheit: 'ms', min: 0, max: 1500, step: 10, hinweis: INTERPRETER_TEXTE.regler.nachlaufHinweis },
];

/** Die zwei Vorverstärkungen der alten Karte „Vorverstärkung“ (App.tsx:173-174), ohne Hinweis, Beschriftung „Floor“ und „Dolmetscher“. */
export const VORVERSTAERKUNG_REGLER: readonly Regler[] = [
  { key: 'floorGainDb', label: INTERPRETER_TEXTE.geraete.floorKurz, einheit: 'dB', min: -24, max: 12, step: 1 },
  { key: 'interpreterGainDb', label: INTERPRETER_TEXTE.geraete.dolmetscher, einheit: 'dB', min: -24, max: 12, step: 1 },
];

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
  /**
   * Fix-Runde 1: die Eingänge, mit denen die View `engine.start` zuletzt gerufen hat (die Engine liest sie nur in `start()`,
   * engine.ts:156-157, und gibt sie nicht heraus); null vor dem ersten Start und nach dem Stopp. Wirksam nur, solange die Engine
   * läuft: Dann zeigen floor und dolmetscher dieses Gerät, nicht die (vielleicht inzwischen geänderte) Einstellung. Das
   * Ausgabegerät meldet die Engine selbst (`startedOutputId`).
   */
  gestartet: GestarteteEingaenge | null;
}

/** Die Eingänge eines Starts (Teil der Geräte, die die View an `engine.start` gibt). */
export interface GestarteteEingaenge {
  floorId: string;
  interpreterId: string;
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

/** Die drei Geräte-Felder der Einstellungen (= Felder von `Devices`, die `engine.start` bekommt). */
type GeraetFeld = 'floorId' | 'interpreterId' | 'outputId';

/**
 * Das Gerät, das gerade wirkt (undefined = unbekannt). Ohne Lauf die Einstellung. Im Lauf: die Ausgabe wie bisher aus der Engine
 * (`startedOutputId`; `engine.route()` läuft nur in `start()`, App.tsx:271-274), die Eingänge aus `stand.gestartet` (Fix-Runde 1;
 * die Engine öffnet sie nur in `start()`). Läuft die Engine ohne aufgezeichneten Start, sind die Eingänge unbekannt, nie die
 * Einstellung.
 */
function wirksam(s: Pick<OberflaechenStand, 'engine' | 'einstellungen' | 'gestartet'>, feld: GeraetFeld): string | undefined {
  const e = s.engine;
  if (e?.running !== true) return s.einstellungen?.[feld];
  if (feld === 'outputId') return e.startedOutputId !== null ? e.startedOutputId : s.einstellungen?.outputId;
  return s.gestartet?.[feld];
}

/** Eine Liste ist nur mit lesbaren Namen eine Messung; sonst bleibt sie unbekannt (undefined), nie leer. */
function liste(s: Pick<OberflaechenStand, 'geraete'>, art: 'eingaenge' | 'ausgaenge'): Array<{ id: string; label: string }> | undefined {
  const g = s.geraete;
  if (g === undefined || !g.labelsAvailable) return undefined;
  return g[art].map((d) => ({ id: d.deviceId, label: d.label }));
}

/** Werte der drei Wahlen und ob unter Floor bzw. Dolmetscher ein Pegel steht. */
interface AbschnittWerte {
  floorId: string;
  interpreterId: string;
  outputId: string;
  pegelFloor: boolean;
  pegelDolmetscher: boolean;
}

function abschnitt(s: OberflaechenStand, w: AbschnittWerte, a: InterpreterAktionen): AudioDeviceSectionProps {
  const e = s.einstellungen;
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
        value: w.floorId,
        required: true,
        levelDb: w.pegelFloor ? s.engine?.floorDb : undefined,
        changeWarning: warnung,
        onChange: (id) => a.floorWaehlen(id),
      },
      {
        key: 'dolmetscher',
        label: INTERPRETER_TEXTE.geraete.dolmetscher,
        direction: 'input',
        devices: eingaenge,
        value: w.interpreterId,
        required: true,
        levelDb: w.pegelDolmetscher ? s.engine?.interpreterDb : undefined,
        changeWarning: warnung,
        onChange: (id) => a.dolmetscherWaehlen(id),
      },
      {
        key: 'ausgabe',
        label: INTERPRETER_TEXTE.geraete.ausgabe,
        direction: 'output',
        devices: ausgaenge,
        value: w.outputId,
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
 * `wechselWirktNachNeustart` (E10). Das Panel zeigt die Einstellung. Pegel nur bei laufender Engine und nur unter einer Wahl,
 * deren Wert das gestartete Gerät ist (Fix-Runde 1): unter einer im Lauf geänderten Wahl gehörte der Pegel dem alten Gerät.
 */
export function geraeteAbschnitt(s: OberflaechenStand, a: InterpreterAktionen = KEINE_AKTION): AudioDeviceSectionProps {
  const e = s.einstellungen;
  const laeuft = s.engine?.running === true;
  return abschnitt(
    s,
    {
      floorId: e?.floorId ?? '',
      interpreterId: e?.interpreterId ?? '',
      outputId: e?.outputId ?? '',
      pegelFloor: laeuft && e !== undefined && s.gestartet?.floorId === e.floorId,
      pegelDolmetscher: laeuft && e !== undefined && s.gestartet?.interpreterId === e.interpreterId,
    },
    a,
  );
}

function wahlItem(w: AudioWahlView | undefined, id: string, label: string, group: 'ausgabe' | 'tool'): StatusItem {
  const kopf = { id, group, label, settingsSection: ABSCHNITT.geraete } as const;
  return w === undefined ? unbekannt(kopf) : { ...kopf, state: w.status.state, detail: w.status.text };
}

/** Eintrag je Wahl: Schlüssel im Abschnitt, Feld der Einstellungen, Kurzname, Gruppe. */
const WAHL_EINTRAG = {
  floor: { feld: 'floorId', label: INTERPRETER_TEXTE.geraete.floorKurz, group: 'tool' },
  dolmetscher: { feld: 'interpreterId', label: INTERPRETER_TEXTE.geraete.dolmetscher, group: 'tool' },
  ausgabe: { feld: 'outputId', label: INTERPRETER_TEXTE.geraete.ausgabeKurz, group: 'ausgabe' },
} as const satisfies Record<string, { feld: GeraetFeld; label: string; group: 'ausgabe' | 'tool' }>;

/**
 * Geräte-Eintrag (floor, dolmetscher, ausgabe): das WIRKSAME Gerät gegen die gemessene Liste (Sicht des Abschnitts). Ohne Lauf
 * die Einstellung. Im Lauf das gestartete Gerät; weicht die Einstellung davon ab, ist ein `ok` nur eine Warnung mit dem Hinweis,
 * dass die Änderung erst nach Stopp und Start wirkt (Fix-Runde 1: für die Eingänge wie bisher für die Ausgabe).
 */
function geraetItem(s: OberflaechenStand, key: keyof typeof WAHL_EINTRAG): StatusItem {
  const { feld, label, group } = WAHL_EINTRAG[key];
  const geraet = wirksam(s, feld);
  if (geraet === undefined) return unbekannt({ id: key, group, label, settingsSection: ABSCHNITT.geraete });
  const werte: AbschnittWerte = { floorId: '', interpreterId: '', outputId: '', pegelFloor: false, pegelDolmetscher: false };
  werte[feld] = geraet;
  const w = audioDeviceView(abschnitt(s, werte, KEINE_AKTION)).wahlen.find((x) => x.key === key);
  const item = wahlItem(w, key, label, group);
  const offen = s.einstellungen !== undefined && geraet !== s.einstellungen[feld];
  if (offen && item.state === 'ok') return { ...item, state: 'warn', detail: `${item.detail} · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}` };
  return item;
}

/**
 * Ducking: ohne Motor oder Einstellungen unbekannt; mit bypass „überbrückt“ (nie „offen“); sonst nach dem gemessenen Zustand.
 * Im Stillstand ist der Eintrag aus (Gesamtprüfung M6): „offen“ ist dann nur der Ruhewert der Engine, nicht gemessen; der Text bleibt.
 */
function duckingItem(s: OberflaechenStand): StatusItem {
  const T = INTERPRETER_TEXTE.ducking;
  const kopf = { id: 'ducking', group: 'tool', label: T.titel, settingsSection: ABSCHNITT.ducking } as const;
  if (s.engine === undefined || s.einstellungen === undefined) return unbekannt(kopf);
  if (s.einstellungen.bypass) return { ...kopf, state: 'warn', detail: T.ueberbrueckt };
  return { ...kopf, state: s.engine.running ? 'ok' : 'off', detail: s.engine.ducking ? T.abgesenkt : T.offen };
}

function fehlerItem(s: OberflaechenStand): StatusItem {
  const T = INTERPRETER_TEXTE.fehler;
  const kopf = { id: 'fehler', group: 'tool', label: T.titel } as const;
  if (s.engine === undefined) return unbekannt(kopf);
  return s.engine.error === null ? { ...kopf, state: 'ok', detail: T.keiner } : { ...kopf, state: 'error', detail: s.engine.error };
}

/**
 * Statusleiste: master-link, floor, dolmetscher, ausgabe (das wirksame Gerät aus der Sicht des Geräte-Abschnitts), ducking,
 * fehler (`state.error`).
 */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [masterLinkStatusItem(s.masterLink), geraetItem(s, 'floor'), geraetItem(s, 'dolmetscher'), geraetItem(s, 'ausgabe'), duckingItem(s), fehlerItem(s)];
}

function taste(label: string, state: TasteZustand['state'], grund?: string): Haupttaste {
  return { label, state, ...(grund === undefined ? {} : { disabledReason: grund }) };
}

/**
 * Haupttaste Starten/Stoppen (E4). Gesperrt mit Grund, genau wenn bisher `disabled` galt (App.tsx:95): `!floorId ||
 * !interpreterId`, auch während des Laufs (Eingang wieder auf „— bitte wählen —“ sperrt auch „Stoppen“, U6 bleibt). Zusätzlich
 * gesperrt, solange Engine oder Einstellungen nicht geantwortet haben (Grund `zustandOffen`). Altfehler IN-3: gesperrt mit „Startet …“,
 * solange die Engine startet (`starting`, höchstens bis zur Frist der Engine); einen zweiten Start im selben Bild verwirft die Engine
 * selbst. `live` bei `running`.
 */
export function hauptTaste(s: Pick<OberflaechenStand, 'engine' | 'einstellungen'>): Haupttaste {
  const T = INTERPRETER_TEXTE;
  const e = s.einstellungen;
  if (s.engine === undefined || e === undefined) return taste(T.taste.starten, 'gesperrt', T.grund.zustandOffen);
  if (s.engine.starting) return taste(T.taste.starten, 'gesperrt', T.grund.startet);
  const laeuft = s.engine.running;
  const label = laeuft ? T.taste.stoppen : T.taste.starten;
  if (!e.floorId || !e.interpreterId) return taste(label, 'gesperrt', T.grund.eingaengeFehlen);
  return taste(label, laeuft ? 'live' : 'bereit');
}
