// Aktionen und Abos der Recorder-Oberfläche (UX Welle 2a, Recorder d; E13, E15, Ruling P3): rein, ohne window, ohne
// Store-Import und ohne Effekte. Die View reicht die Store-Aktionen unter ihren Namen im Store herein (R/store/recorder.ts);
// so ruft jedes Feld des Panels genau die Store-Aktion, die das alte Feld in RecorderView.tsx rief, und das Panel bleibt
// ohne Effekte. Die Abläufe (init im App-Wurzelknoten, Brücken, Meldungs-Abo, Toast) laufen in der View, auch bei
// geschlossenem Panel.
import type { RecorderAktionen } from './oberflaeche';

/** Die Store-Aktionen, die das Panel braucht, unter ihrem Namen im Store. */
export interface PanelStore {
  selectDevice(index: number): void;
  refreshDevices(): Promise<void>;
  setChannels(n: number): void;
  setSampleRate(n: number): void;
  pickDir(): Promise<void>;
  setFileName(s: string): void;
  setSeparateTracks(v: boolean): void;
}

/** Aktionen des Panels: Eingang (Wahl, Aktualisieren; lib/oberflaeche.ts), dazu Format und Ziel. */
export interface EinstellungenAktionen extends RecorderAktionen {
  kanaeleSetzen(n: number): void;
  samplerateSetzen(n: number): void;
  ordnerWaehlen(): void;
  dateinameSetzen(name: string): void;
  spurenSetzen(an: boolean): void;
}

/**
 * Die Aktionen des Panels aus den Store-Aktionen, je Feld die alte (RecorderView.tsx bei d7cdd79ce0): Eingang → selectDevice
 * (:86), „Geräte aktualisieren“ → refreshDevices (:51), Kanäle und „Max“ → setChannels (:106, :113), Samplerate → setSampleRate
 * (:130), „Ordner wählen…“ → pickDir (:190), Dateiname → setFileName (:202), Spuren → setSeparateTracks (:213).
 */
export function panelAktionen(s: PanelStore): EinstellungenAktionen {
  return {
    geraetWaehlen: (index) => s.selectDevice(index),
    geraeteAktualisieren: () => void s.refreshDevices(),
    kanaeleSetzen: (n) => s.setChannels(n),
    samplerateSetzen: (n) => s.setSampleRate(n),
    ordnerWaehlen: () => void s.pickDir(),
    dateinameSetzen: (name) => s.setFileName(name),
    spurenSetzen: (an) => s.setSeparateTracks(an),
  };
}

/**
 * Meldung des Hauptprozesses abonnieren (`recorder:notice`; E13, Ruling P3): jede Meldung setzt den Text, eine neuere ersetzt
 * die ältere. Das Abo ist getrennt vom Store, der dieselbe Meldung weiter als 5-s-Toast zeigt (init setzt `notice`); der Store
 * kann Main- und eigene Meldungen nicht unterscheiden. Quittiert („OK“) wird in der View (null). Ohne Preload meldet sich
 * nichts an. Rückgabe: abmelden.
 */
export function meldungAbonnieren(ereignis: ((cb: (text: string) => void) => () => void) | undefined, setze: (text: string) => void): () => void {
  if (ereignis === undefined) return () => undefined;
  return ereignis((text) => setze(text));
}
