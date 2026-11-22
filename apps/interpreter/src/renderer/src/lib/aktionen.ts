// Aktionen der Interpreter-Oberfläche (UX Welle 2a, Interpreter d): bildet die Haupttaste, den Download-Knopf und die Felder des
// Panels auf dieselben Aufrufe ab wie die alten Knöpfe und Felder (App.tsx:81-84, :110-177, :301-306 bei d7cdd79ce0). Keine Taste
// und kein Feld bekommt eine neue Wirkung: Die drei Geräte-Wahlen schreiben nur den Speicher (die Engine liest sie erst in
// start()), die Regler und der Bypass schreiben den Speicher und wirken über die Effekte der Wurzel-View sofort (setSettings,
// setBypass), „Ducking-Werte zurücksetzen“ ruft reset. Start und Stopp gibt es nur über die Haupttaste. Rein: kein window, kein
// navigator, kein Store-Import; die View reicht Engine, Store und Preload herein, die Tests Attrappen.
import type { JmInterpreterApi } from '@shared/api';
import type { Devices } from '@/core/engine';
import type { GestarteteEingaenge, InterpreterAktionen, ReglerSchluessel } from './oberflaeche';

/** Was die Haupttaste von der Engine braucht (InterpreterEngine.start/stop). */
export interface InterpreterMotor {
  start(devices: Devices): Promise<void>;
  stop(): Promise<void>;
}

/** Die Werte des Speichers, die das Panel schreibt (store/settings.ts, ohne set und reset). */
export interface SpeicherWerte {
  floorId: string;
  interpreterId: string;
  outputId: string;
  bypass: boolean;
  thresholdDb: number;
  duckDb: number;
  attackMs: number;
  releaseMs: number;
  holdMs: number;
  floorGainDb: number;
  interpreterGainDb: number;
}

/** Die Store-Aktionen unter ihren Namen (useSettings: set und reset). */
export interface InterpreterStore {
  set<K extends keyof SpeicherWerte>(key: K, value: SpeicherWerte[K]): void;
  reset(): void;
}

/** Aktionen des Live-Bereichs: die Haupttaste Starten/Stoppen und der Download des virtuellen Kabels. */
export interface LiveAktionen {
  umschalten(): void;
  kabelHerunterladen(): void;
}

/** Aktionen des Panels: die drei Geräte-Wahlen (aus lib/oberflaeche.ts), Bypass, die sieben Regler und das Zurücksetzen. */
export interface PanelAktionen extends InterpreterAktionen {
  bypass(an: boolean): void;
  regler(key: ReglerSchluessel, wert: number): void;
  zuruecksetzen(): void;
}

/**
 * Haupttaste wie der alte `toggle` (App.tsx:81-84): läuft die Engine, `stop()`, sonst `start()` mit den drei gemerkten Geräten.
 * Fix-Runde 1: Vor `start()` merkt sich die View die übergebenen Eingänge (`gestartetMerken`, die Engine liest sie nur dort und
 * gibt sie nicht heraus); nach dem erfüllten `stop()` vergisst sie sie wieder (null). Am Aufruf der Engine ändert das nichts.
 * Download wie der alte Knopf: der Rückruf der View (sie liest den Preload erst beim Klick).
 */
export function liveAktionen(
  motor: InterpreterMotor,
  laeuft: boolean,
  geraete: Devices,
  kabelHerunterladen: () => void,
  gestartetMerken: (g: GestarteteEingaenge | null) => void,
): LiveAktionen {
  return {
    umschalten: () => {
      if (laeuft) {
        void motor.stop().then(() => gestartetMerken(null));
      } else {
        gestartetMerken({ floorId: geraete.floorId, interpreterId: geraete.interpreterId });
        void motor.start(geraete);
      }
    },
    kabelHerunterladen,
  };
}

/**
 * Panel: Floor, Dolmetscher, Ausgabe → s.set('floorId' | 'interpreterId' | 'outputId', id) wie die alten Auswahlfelder
 * (App.tsx:110-123); Bypass → s.set('bypass', an) (App.tsx:155); Regler → s.set(Schlüssel, Zahl) (App.tsx:159-174);
 * Zurücksetzen → s.reset() (App.tsx:175).
 */
export function panelAktionen(store: Pick<InterpreterStore, 'set' | 'reset'>): PanelAktionen {
  return {
    floorWaehlen: (id) => store.set('floorId', id),
    dolmetscherWaehlen: (id) => store.set('interpreterId', id),
    ausgabeWaehlen: (id) => store.set('outputId', id),
    bypass: (an) => store.set('bypass', an),
    regler: (key, wert) => store.set(key, wert),
    zuruecksetzen: () => store.reset(),
  };
}

/**
 * „VB-CABLE herunterladen“ wie bisher (App.tsx:302-306): öffnet die Bezugsquelle über den Hauptprozess. Defensiv: Fehlt der
 * Preload, passiert nichts; ein Fehler wird still geschluckt, keine Rückmeldung.
 */
export function kabelHerunterladen(api: Pick<JmInterpreterApi, 'openCableDownload'> | undefined): void {
  void api?.openCableDownload().catch(() => {});
}
