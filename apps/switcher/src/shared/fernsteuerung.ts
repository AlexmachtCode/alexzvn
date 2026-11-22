// ─────────────────────────────────────────────────────────────────────────────
// Fernsteuerungs-Meldung des Switchers (UX Welle 1, Aufgabe b; Spec 3.9, UO3; Muster Titler N2).
//
// Rein, ohne Electron und ohne Laufzeit-Importe: Aus den Meldungen des vorhandenen Steuerservers entsteht
// { laeuft, port, clients, modus?, fehler? } für den Statuseintrag „Fernsteuerung“. Der Main ruft naechsteFernsteuerung
// bei jedem Statuswechsel des Servers, beim Start-Ergebnis und bei einem Wurf; Port, Protokoll, Befehle und Bedienlogik
// bleiben unverändert (nur lesend). `clients` zählt jeden Steuerclient (Companion, Launcher-Health …).
// Auf dem Draht bleibt der Kanal control:status mit ControlStatus (Ruling R1); die zwei Wandler unten übersetzen
// laeuft ↔ running, alles andere 1:1.
// Abweichung vom Titler: Das Start-Ereignis trägt den angeforderten Port (`port?`), weil der Switcher-Port einstellbar ist.
// ─────────────────────────────────────────────────────────────────────────────
import type { ControlStatus } from './types';

/**
 * Standard-Steuerport des Switchers (DEFAULT_CONTROL_PORT des Steuerprotokolls, Standard der Einstellung `controlPort`).
 * Der Port ist einstellbar; diese Zahl gilt nur, solange noch keine Meldung einen Port nannte. Gleichlauf mit
 * DEFAULT_CONTROL_PORT prüft der Quelltext-Wächter im Selbsttest.
 */
export const STEUER_PORT = 8723;

export interface FernsteuerungMeldung {
  /** Der Steuerserver lauscht. */
  laeuft: boolean;
  /** Zuletzt gemeldeter Port; ohne Meldung mit Port (Startfehler meldet 0) STEUER_PORT. */
  port: number;
  /** Verbundene Steuerclients aller Art; 0, solange der Server nicht läuft. */
  clients: number;
  /** Wirksamer Modus (SuiteControlServer.modus()); fehlt, solange kein Status mit Modus kam. */
  modus?: 'open' | 'secure';
  /** Startfehler oder Wurf, wörtlich; fällt weg, sobald der Server läuft. */
  fehler?: string;
}

export type FernsteuerungEreignis =
  | { art: 'status'; running: boolean; port: number; clients: number; modus?: 'open' | 'secure' }
  | { art: 'start'; ok: boolean; error?: string; port?: number }
  | { art: 'wurf'; text: string };

/** Felder ohne Wert fehlen im Objekt (nie undefined); Reihenfolge laeuft, port, clients, modus, fehler. */
function meldung(laeuft: boolean, port: number, clients: number, modus?: 'open' | 'secure', fehler?: string): FernsteuerungMeldung {
  const m: FernsteuerungMeldung = { laeuft, port, clients };
  if (modus !== undefined) m.modus = modus;
  if (fehler !== undefined) m.fehler = fehler;
  return m;
}

/** Fehlertext ohne Leerraum am Rand; leer → „unbekannt“. */
function fehlerText(t: string | undefined): string {
  return t?.trim() || 'unbekannt';
}

export function naechsteFernsteuerung(alt: FernsteuerungMeldung | undefined, e: FernsteuerungEreignis): FernsteuerungMeldung {
  const altPort = alt?.port ?? STEUER_PORT;
  switch (e.art) {
    case 'status':
      return meldung(e.running, e.port > 0 ? e.port : altPort, e.running ? e.clients : 0, e.modus ?? alt?.modus, e.running ? undefined : alt?.fehler);
    case 'start': {
      const port = e.port !== undefined && e.port > 0 ? e.port : altPort;
      return e.ok ? meldung(true, port, alt?.clients ?? 0, alt?.modus) : meldung(false, port, 0, alt?.modus, fehlerText(e.error));
    }
    case 'wurf':
      return meldung(false, altPort, 0, alt?.modus, fehlerText(e.text));
  }
}

/** Port belegt: Der Startfehler enthält EADDRINUSE (Node: „listen EADDRINUSE: address already in use …“). */
export function portBelegt(m: FernsteuerungMeldung | undefined): boolean {
  return m?.fehler?.includes('EADDRINUSE') ?? false;
}

/** Draht → Meldung: running → laeuft, port/clients/modus/fehler 1:1, fehlende Felder bleiben fehlend. */
export function controlStatusZuMeldung(s: ControlStatus): FernsteuerungMeldung {
  return meldung(s.running, s.port, s.clients, s.modus, s.fehler);
}

/** Meldung → Draht: laeuft → running, port/clients/modus/fehler 1:1, fehlende Felder bleiben fehlend. */
export function meldungZuControlStatus(m: FernsteuerungMeldung): ControlStatus {
  const s: ControlStatus = { running: m.laeuft, port: m.port, clients: m.clients };
  if (m.modus !== undefined) s.modus = m.modus;
  if (m.fehler !== undefined) s.fehler = m.fehler;
  return s;
}
