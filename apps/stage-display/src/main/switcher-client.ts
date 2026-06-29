import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import { switcherStateFromSuite } from '@jm/suite-control-protocol';
import type { controlClientOptions } from '@jm/control-config';
import type { SwitcherSource } from '@shared/types';

/** Token/TLS-Optionen für den Steuer-Client (P1, secure-Modus). */
type ClientSecurity = ReturnType<typeof controlClientOptions>;

export const SWITCHER_OFFLINE: SwitcherSource = {
  connected: false,
  program: 0,
  preview: 0,
  recording: false,
  streaming: false,
  scenes: 0,
};

/**
 * TCP-Client auf den Switcher-Steuerserver. Dünner Wrapper um den geteilten
 * SuiteControlClient (suite-weites Zeilenprotokoll, Auto-Reconnect): liest die
 * `ns=switcher`-STATE-Zeilen und mappt sie auf die Stage-Display-Quelle. Die
 * öffentliche API (connect/disconnect/onChange) bleibt unverändert.
 */
export class SwitcherClient {
  private readonly client: SuiteControlClient;

  /**
   * `security` trägt Token/TLS im secure-Modus (aus der geteilten control.json).
   * Leer (open-Modus) → unverändertes Klartext-Verhalten. Ohne sie verbände sich
   * Stage Display plain gegen einen secure-Switcher-Steuerserver und bliebe „offline".
   */
  constructor(onChange: (s: SwitcherSource) => void, security: ClientSecurity = {}) {
    this.client = new SuiteControlClient({
      ...security,
      onState: (st) => {
        const s = switcherStateFromSuite(st);
        onChange({
          connected: true,
          program: s.program,
          preview: s.preview,
          recording: s.recording,
          streaming: s.streaming,
          scenes: s.scenes,
        });
      },
      onConnectedChange: (connected) => {
        // Bei Trennung (close/disconnect) auf „offline" zurückfallen; beim
        // Connect warten wir auf die erste STATE-Zeile (wie bisher).
        if (!connected) onChange({ ...SWITCHER_OFFLINE });
      },
    });
  }

  connect(host: string, port: number): void {
    this.client.connect(host, port);
  }

  disconnect(): void {
    this.client.disconnect();
  }
}
