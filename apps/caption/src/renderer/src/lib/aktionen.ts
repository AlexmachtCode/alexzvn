// Aktionen der Caption-Oberfläche (UX Welle 2a, Caption d): bildet Tasten und Felder auf die Store-Aktionen ab, genau wie die
// alten Knöpfe und Felder sie riefen (App.tsx:145-321 und :376-405 bei d7cdd79ce0). Keine Taste und kein Feld bekommt eine neue
// Wirkung; jede Wahl im Panel speichert nur (setConfig), wie bisher. Rein: kein window, kein navigator, kein Store-Import; die
// View reicht die Store-Aktionen herein, die Tests Attrappen.
import { AUDIO_TEXTE } from '@jm/settings';
import type { CaptionConfig } from '@shared/types';
import { CAPTION_TEXTE, type CaptionAktionen, type MikrofonGeraet } from './oberflaeche';

/** Die Store-Aktionen unter ihren Namen (store/useCaption.ts). */
export interface CaptionStore {
  setConfig(patch: Partial<CaptionConfig>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setHold(hold: boolean): Promise<void>;
  clear(): Promise<void>;
  correctLine(id: string, text: string): Promise<void>;
  ndiStart(name?: string): Promise<void>;
  ndiStop(): Promise<void>;
}

/** Aktionen des Panels: die gemeinsamen Abschnitte (CaptionAktionen) und die tool-eigenen Felder (eine Konfigurationsänderung). */
export interface EinstellungenAktionen extends CaptionAktionen {
  konfigurieren(patch: Partial<CaptionConfig>): void;
}

/** Aktionen des Live-Bereichs: die vier Haupttasten und die Korrektur der jüngsten Zeile. */
export interface LiveAktionen {
  start(): void;
  stop(): void;
  hold(an: boolean): void;
  leeren(): void;
  ndiStarten(): void;
  ndiStoppen(): void;
  /** Übernahme der Korrektur für die Zeile mit dieser Kennung (correctLine, Altfehler CA-5: die angeklickte Zeile). */
  korrigieren(id: string, text: string): void;
  /** Korrekturmodus einer Zeile an (Id) bzw. aus (null); Oberflächenzustand der View. */
  bearbeiten(id: string | null): void;
}

/**
 * Panel: NDI-Schalter → ndiStart(Quellname)/ndiStop wie die Taste NDI (App.tsx:212); Quellname, Auflösung, Bildrate, Eingang und
 * die tool-eigenen Felder → setConfig mit demselben Teil wie bisher; „Geräte aktualisieren“ → refreshDevices der View (⟳).
 */
export function panelAktionen(store: Pick<CaptionStore, 'setConfig' | 'ndiStart' | 'ndiStop'>, ndiName: string | undefined, geraeteAktualisieren: () => void): EinstellungenAktionen {
  return {
    ndiSchalten: (next) => void (next ? store.ndiStart(ndiName) : store.ndiStop()),
    ndiName: (name) => void store.setConfig({ ndiName: name }),
    aufloesung: (w, h) => void store.setConfig({ ndiWidth: w, ndiHeight: h }),
    bildrate: (fps) => void store.setConfig({ ndiFps: fps }),
    geraetWaehlen: (id) => void store.setConfig({ audioInputDeviceId: id }),
    geraeteAktualisieren,
    konfigurieren: (patch) => void store.setConfig(patch),
  };
}

/**
 * Live-Bereich: Start → start(), Stopp → stop() (App.tsx:186), Hold → setHold(an) (:193), Leeren → clear() (:201),
 * NDI → ndiStart(Quellname) bzw. ndiStop() (:212), Korrektur → correctLine(Kennung, Text) (früher correctLast(Text), :387;
 * Altfehler CA-5).
 */
export function liveAktionen(store: CaptionStore, ndiName: string | undefined, bearbeiten: (id: string | null) => void): LiveAktionen {
  return {
    start: () => void store.start(),
    stop: () => void store.stop(),
    hold: (an) => void store.setHold(an),
    leeren: () => void store.clear(),
    ndiStarten: () => void store.ndiStart(ndiName),
    ndiStoppen: () => void store.ndiStop(),
    korrigieren: (id, text) => void store.correctLine(id, text),
    bearbeiten,
  };
}

/**
 * Altfehler CA-1: Scheitert der Start der Aufnahme (getUserMedia), steht die Meldung im Fenster („Mikrofon: …“, bis zum nächsten
 * Start) und die Transkription endet über stop(): caption:stop → running false → Companion running=0. Mit running false startet der
 * Aufnahme-Effekt nicht von selbst neu. Kein eigener Kanal.
 */
export function mikrofonGescheitert(store: Pick<CaptionStore, 'stop'>, setzeFehler: (m: string) => void, e: unknown): void {
  setzeFehler(mikrofonGrund(e));
  void store.stop();
}

/**
 * Grund eines Mikrofonfehlers für das Fenster („Mikrofon: …“) und den Abschnitt Audiogerät (Altfehler CA-1, Ruling R8): die Meldung
 * des Browsers, wie sie ist. Ist sie leer (gemessen: ein gemerkter Eingang, den es nicht mehr gibt, ergibt OverconstrainedError ohne
 * Meldung), dann bei OverconstrainedError und NotFoundError der Text „Gerät nicht gefunden“ aus @jm/settings, sonst
 * CAPTION_TEXTE.mikrofon.nichtVerfuegbar. Nie leer.
 */
export function mikrofonGrund(e: unknown): string {
  const meldung = String((e as Error)?.message ?? e);
  if (meldung.trim() !== '') return meldung;
  const name = (e as Error)?.name;
  if (name === 'OverconstrainedError' || name === 'NotFoundError') return AUDIO_TEXTE.nichtGefunden;
  return CAPTION_TEXTE.mikrofon.nichtVerfuegbar;
}

/** Gemessene Eingänge aus listAudioInputs: id = deviceId, ohne Namen „Audiogerät n“ (wie bisher, App.tsx:170-173). */
export function geraeteListe(devices: ReadonlyArray<{ deviceId: string; label: string }>): MikrofonGeraet[] {
  return devices.map((d, i) => ({ id: d.deviceId, label: d.label || CAPTION_TEXTE.mikrofon.ohneName(i + 1) }));
}
