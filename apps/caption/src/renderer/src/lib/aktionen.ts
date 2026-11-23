// Aktionen der Caption-Oberfläche (UX Welle 2a, Caption d): bildet Tasten und Felder auf die Store-Aktionen ab, genau wie die
// alten Knöpfe und Felder sie riefen (App.tsx:145-321 und :376-405 bei d7cdd79ce0). Keine Taste und kein Feld bekommt eine neue
// Wirkung; jede Wahl im Panel speichert nur (setConfig), wie bisher. Rein: kein window, kein navigator, kein Store-Import; die
// View reicht die Store-Aktionen herein, die Tests Attrappen.
import type { CaptionConfig } from '@shared/types';
import { CAPTION_TEXTE, type CaptionAktionen, type MikrofonGeraet } from './oberflaeche';

/** Die Store-Aktionen unter ihren Namen (store/useCaption.ts). */
export interface CaptionStore {
  setConfig(patch: Partial<CaptionConfig>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setHold(hold: boolean): Promise<void>;
  clear(): Promise<void>;
  correctLast(text: string): Promise<void>;
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
  /** Übernahme der Korrektur (correctLast, gilt der jüngsten Zeile im Main). */
  korrigieren(text: string): void;
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
 * NDI → ndiStart(Quellname) bzw. ndiStop() (:212), Korrektur → correctLast(Text) (:387).
 */
export function liveAktionen(store: CaptionStore, ndiName: string | undefined, bearbeiten: (id: string | null) => void): LiveAktionen {
  return {
    start: () => void store.start(),
    stop: () => void store.stop(),
    hold: (an) => void store.setHold(an),
    leeren: () => void store.clear(),
    ndiStarten: () => void store.ndiStart(ndiName),
    ndiStoppen: () => void store.ndiStop(),
    korrigieren: (text) => void store.correctLast(text),
    bearbeiten,
  };
}

/** Gemessene Eingänge aus listAudioInputs: id = deviceId, ohne Namen „Audiogerät n“ (wie bisher, App.tsx:170-173). */
export function geraeteListe(devices: ReadonlyArray<{ deviceId: string; label: string }>): MikrofonGeraet[] {
  return devices.map((d, i) => ({ id: d.deviceId, label: d.label || CAPTION_TEXTE.mikrofon.ohneName(i + 1) }));
}
