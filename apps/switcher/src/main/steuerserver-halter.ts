// Halter des Switcher-Steuerservers (UX Welle 1, Spec 3.9, nur lesend): Start, Stopp und der aktuelle Server, ohne Electron,
// damit der Selbsttest den Ablauf mit dem echten SuiteControlServer prüfen kann (test/ui/bruecken.test.ts).
import { SuiteControlServer, type SuiteControlServerOptions } from '@jm/suite-control-protocol/server';
import type { FernsteuerungEreignis } from '@shared/fernsteuerung';

export interface SteuerserverHalter {
  /** Der laufende bzw. zuletzt gestartete Server; null nach stoppe() und vor dem ersten Start. */
  aktuell(): SuiteControlServer | null;
  /** Stoppt einen vorhandenen Server, baut einen neuen und startet ihn auf `port`. Jeder Statuswechsel geht an onMeldung. */
  starte(
    opts: Omit<SuiteControlServerOptions, 'onStatus'>,
    port: number,
    onMeldung: (e: FernsteuerungEreignis) => void,
  ): Promise<{ ok: boolean; error?: string; port?: number }>;
  stoppe(): void;
}

export function erzeugeHalter(): SteuerserverHalter {
  let server: SuiteControlServer | null = null;
  const stoppe = (): void => {
    if (server) {
      server.stop();
      server = null;
    }
  };
  return {
    aktuell: () => server,
    starte(opts, port, onMeldung) {
      stoppe();
      const srv: SuiteControlServer = new SuiteControlServer({
        ...opts,
        // Nur der aktuelle Server meldet. stop() zerstört die Client-Sockets, ihr close kommt erst danach: Ohne diese Prüfung
        // überschriebe der Stillstand des alten Servers (running false, Port 0) nach einem Neustart die Meldung des neuen.
        // stop() selbst meldet noch, weil `server` in dem Moment auf den alten Server zeigt (Fund A1 der Gesamtprüfung).
        onStatus: (st) => {
          if (server === srv) onMeldung({ art: 'status', ...st, modus: srv.modus() });
        },
      });
      server = srv;
      return srv.start(port);
    },
    stoppe,
  };
}
