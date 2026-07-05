// Coupling (Main): entdeckt die Steuer-Endpunkte von Titler + Timer per mDNS,
// mischt manuelle Overrides darüber (Cross-Subnet) und hält je Rolle einen
// SuiteControlClient (Auto-Reconnect). fire(role,line) sendet eine Protokollzeile;
// der STATE-Rückkanal (Tally, z. B. Timer-Restzeit) wird gecacht und nach außen
// gereicht. Gleiches Muster wie apps/rundown/src/main/conductor.ts, aber auf die
// von Q&A angesteuerten Rollen beschränkt. Nur im Main.
import { discover, type DiscoveredService, type Discovery } from '@jm/discovery';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import type { SuiteState } from '@jm/suite-control-protocol';
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';
import { controlClientOptions, readControlConfig, mdnsSignKey } from '@jm/control-config';
import type { Endpoint, ToolLink } from '@shared/types';

/** Token/TLS-Optionen für die Steuer-Clients (P1, secure-Modus). */
type ClientSecurity = ReturnType<typeof controlClientOptions>;

/** Rollen, die Q&A ansteuert (Redezeit-Timer + Namens-Bauchbinde). */
export const COUPLED_ROLES = ['timer', 'titler'] as const;
const COUPLED = new Set<string>(COUPLED_ROLES);

interface DesiredEndpoint extends Endpoint {
  source: 'mdns' | 'manual';
}

/** Gewünschte Endpunkte je Rolle: Override gewinnt über mDNS-Fund. */
function mergeEndpoints(
  discovered: Record<string, Endpoint>,
  overrides: Record<string, Endpoint>,
): Record<string, DesiredEndpoint> {
  const out: Record<string, DesiredEndpoint> = {};
  for (const [role, ep] of Object.entries(discovered)) out[role] = { host: ep.host, port: ep.port, source: 'mdns' };
  for (const [role, ep] of Object.entries(overrides)) {
    if (COUPLED.has(role)) out[role] = { host: ep.host, port: ep.port, source: 'manual' };
  }
  return out;
}

interface Link {
  role: string;
  host: string;
  port: number;
  source: 'mdns' | 'manual';
  client: SuiteControlClient;
  connected: boolean;
  state: Record<string, string> | null;
}

export class Coupling {
  private discovery: Discovery | null = null;
  private discovered: Record<string, Endpoint> = {};
  private overrides: Record<string, Endpoint> = {};
  private readonly links = new Map<string, Link>();
  /**
   * Token/TLS für die Steuer-Clients (P1, secure-Modus). Aus der geteilten
   * control.json — ohne sie verbände sich Q&A plain gegen einen secure-Timer/
   * -Titler-Steuerserver und bliebe „offline" (Auto-Kopplung tot).
   */
  private clientSecurity: ClientSecurity = {};
  /** mDNS-Prüf-Key (secure-Modus, A3 #59) → gefälschte Annoncen werden verworfen. */
  private verifyKey: string | undefined;

  constructor(private readonly onChange: () => void) {}

  /**
   * Discovery starten. `appDataDir` (app.getPath('appData')) → die geteilte
   * Steuer-Konfig wird gelesen, damit die Clients im secure-Modus Token/TLS
   * mitbringen (sonst kein Connect zu den secure-Tool-Servern).
   */
  start(appDataDir?: string): void {
    if (appDataDir) {
      const cfg = readControlConfig(appDataDir);
      this.clientSecurity = controlClientOptions(cfg);
      this.verifyKey = mdnsSignKey(cfg);
    }
    if (this.discovery) return;
    try {
      this.discovery = discover((svcs) => this.onDiscovered(svcs), { verifyKey: this.verifyKey });
    } catch {
      /* mDNS optional — ohne Discovery laufen nur manuelle Overrides. */
    }
  }

  stop(): void {
    this.discovery?.stop();
    this.discovery = null;
    for (const l of this.links.values()) l.client.disconnect();
    this.links.clear();
  }

  setOverrides(overrides: Record<string, Endpoint>): void {
    this.overrides = overrides;
    this.reconcile();
  }

  private isControl(s: DiscoveredService): boolean {
    return COUPLED.has(s.role) && s.ctl && !!CAPABILITIES[s.role];
  }

  private onDiscovered(svcs: DiscoveredService[]): void {
    const next: Record<string, Endpoint> = {};
    for (const s of svcs) {
      if (this.isControl(s)) next[s.role] = { host: s.host, port: s.port };
    }
    this.discovered = next;
    this.reconcile();
  }

  private reconcile(): void {
    const want = mergeEndpoints(this.discovered, this.overrides);

    for (const [role, link] of this.links) {
      const w = want[role];
      if (!w || w.host !== link.host || w.port !== link.port) {
        link.client.disconnect();
        this.links.delete(role);
      }
    }

    for (const [role, w] of Object.entries(want)) {
      if (this.links.has(role)) continue;
      const client = new SuiteControlClient({
        ...this.clientSecurity, // P1: Token/TLS im secure-Modus (sonst leer = open)
        onState: (st: SuiteState) => {
          const l = this.links.get(role);
          if (!l) return;
          l.state = coerceState(st);
          this.onChange();
        },
        onConnectedChange: (connected) => {
          const l = this.links.get(role);
          if (l) {
            l.connected = connected;
            if (!connected) l.state = null;
            this.onChange();
          }
        },
      });
      this.links.set(role, { role, host: w.host, port: w.port, source: w.source, client, connected: false, state: null });
      client.connect(w.host, w.port);
    }

    this.onChange();
  }

  /** Protokollzeile an das Tool der Rolle senden. true, wenn verbunden. */
  fire(role: string, line: string): boolean {
    const l = this.links.get(role);
    if (!l) return false;
    l.client.send(line);
    return l.connected;
  }

  connected(role: string): boolean {
    return this.links.get(role)?.connected ?? false;
  }

  snapshot(): ToolLink[] {
    return [...this.links.values()]
      .map((l) => ({
        role: l.role,
        label: CAPABILITIES[l.role]?.label ?? l.role,
        host: l.host,
        port: l.port,
        connected: l.connected,
        source: l.source,
        state: l.state,
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }
}

function coerceState(st: SuiteState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(st.kv ?? {})) out[k] = String(v);
  return out;
}
