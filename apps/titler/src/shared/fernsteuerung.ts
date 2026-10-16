// ─────────────────────────────────────────────────────────────────────────────
// Fernsteuerungs-Meldung des Titlers (Suite-UX-Update Welle 0, Spec 3.9, UO3; N2 im Pilot-Plan).
//
// Rein, ohne Electron und ohne Importe: Aus den Meldungen des vorhandenen Steuerservers (Port 8726 fest)
// entsteht { laeuft, port, clients, modus?, fehler? } für den Statuseintrag „Fernsteuerung“. Der Main ruft
// naechsteFernsteuerung bei jedem Statuswechsel des Servers, beim Start-Ergebnis und bei einem Wurf; Port,
// Protokoll, Befehle und Bedienlogik bleiben unverändert (nur lesend). `clients` zählt jeden Steuerclient
// (Companion, Launcher-Health, Rundown …), nicht nur Companion.
// ─────────────────────────────────────────────────────────────────────────────

/** Steuerport des Titlers. Gleichlauf mit CONTROL_PORT in main/control-server.ts (Quelltext-Wächter im Selbsttest). */
export const STEUER_PORT = 8726;

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
  | { art: 'start'; ok: boolean; error?: string }
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
    case 'start':
      return e.ok
        ? meldung(true, altPort, alt?.clients ?? 0, alt?.modus)
        : meldung(false, altPort, 0, alt?.modus, fehlerText(e.error));
    case 'wurf':
      return meldung(false, altPort, 0, alt?.modus, fehlerText(e.text));
  }
}

/** Port belegt: Der Startfehler enthält EADDRINUSE (Node: „listen EADDRINUSE: address already in use …“). */
export function portBelegt(m: FernsteuerungMeldung | undefined): boolean {
  return m?.fehler?.includes('EADDRINUSE') ?? false;
}
