// ─────────────────────────────────────────────────────────────────────────────
// Live-Health-Aggregator für das System-Zustand-Dashboard.
//
// Während der Presence-Hub (presence.ts) weiß, WELCHE Tools lokal LAUFEN
// (Heartbeat: Version/Absturz), liefert dieser Aggregator den LIVE-Zustand der
// im LAN entdeckten Steuer-Endpunkte (REC/On-Air/läuft …): er browst per mDNS
// (@jm/discovery) nach `_jmps._tcp`-Steuer-Endpunkten und hält je Endpunkt einen
// SuiteControlClient, der den `STATE ns=<rolle> k=v`-Strom mitliest. So sieht das
// Dashboard auch Tools auf ANDEREN Rechnern (die nicht am lokalen Hub hängen).
//
// Steuer-Endpunkt = TXT `ctl=1` ODER role=switcher (dessen ctl-loser Advert IST
// sein Steuerserver) — dieselbe Regel wie im Companion-Modul (pickEndpoint).
//
// Best-effort: schlägt mDNS oder eine Verbindung fehl, läuft der Rest weiter.
import { discover, type DiscoveredService } from '@jm/discovery';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import type { SuiteState } from '@jm/suite-control-protocol';
import { controlClientOptions, readControlConfig } from '@jm/control-config';
import type { HealthEntry } from '@shared/types';

interface Conn {
  svc: DiscoveredService;
  client: SuiteControlClient;
  connected: boolean;
  kv: Record<string, string>;
}

const conns = new Map<string, Conn>(); // Schlüssel: host:port
let discovery: { stop: () => void } | null = null;
let notify: (() => void) | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
/**
 * Token/TLS für die Health-Clients (P1, secure-Modus). Provisioniert der Launcher
 * die Steuerebene secure, laufen ALLE Tool-Steuerserver verschlüsselt + token-auth
 * — die Dashboard-Clients müssen das mitbringen, sonst verbinden sie plain gegen
 * TLS-Server und das Dashboard bliebe dauerhaft leer/„offline".
 */
let clientSecurity: ReturnType<typeof controlClientOptions> = {};

/** Steuer-Endpunkt? ctl=1 oder der ctl-lose switcher-Advert. */
function isControl(s: DiscoveredService): boolean {
  return s.ctl || s.role === 'switcher';
}

function endpointKey(s: { host: string; port: number }): string {
  return `${s.host}:${s.port}`;
}

/** Änderungen gebündelt melden (STATE-Pushes kommen z. T. sekündlich). */
function emit(): void {
  if (debounce) return;
  debounce = setTimeout(() => {
    debounce = null;
    notify?.();
  }, 500);
}

function onDiscovered(services: DiscoveredService[]): void {
  const control = services.filter(isControl);
  const live = new Set(control.map(endpointKey));

  for (const svc of control) {
    const key = endpointKey(svc);
    const existing = conns.get(key);
    if (existing) {
      existing.svc = svc; // Metadaten auffrischen (appId/role/name)
      continue;
    }
    const client = new SuiteControlClient({
      ...clientSecurity, // P1: Token/TLS im secure-Modus (sonst leer = open)
      onState: (state: SuiteState) => {
        const c = conns.get(key);
        if (!c) return;
        c.kv = Object.fromEntries(Object.entries(state.kv).map(([k, v]) => [k, String(v)]));
        emit();
      },
      onConnectedChange: (connected: boolean) => {
        const c = conns.get(key);
        if (!c) return;
        c.connected = connected;
        emit();
      },
      reconnectMs: 3000,
    });
    conns.set(key, { svc, client, connected: false, kv: {} });
    client.connect(svc.host, svc.port);
  }

  // Verschwundene Endpunkte trennen.
  for (const [key, conn] of [...conns]) {
    if (!live.has(key)) {
      conn.client.disconnect();
      conns.delete(key);
    }
  }
  emit();
}

/**
 * mDNS-Browsing + Client-Pool starten. `onChange` feuert (gebündelt) bei Änderung.
 * `appDataDir` (app.getPath('appData')) → die geteilte control.json wird gelesen,
 * damit die Health-Clients im secure-Modus Token/TLS mitbringen.
 */
export function startHealth(onChange: () => void, appDataDir?: string): void {
  if (discovery) return;
  notify = onChange;
  if (appDataDir) clientSecurity = controlClientOptions(readControlConfig(appDataDir));
  try {
    discovery = discover(onDiscovered);
  } catch {
    discovery = null;
  }
}

export function stopHealth(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
  discovery?.stop();
  discovery = null;
  for (const conn of conns.values()) conn.client.disconnect();
  conns.clear();
}

/** Momentaufnahme aller entdeckten Steuer-Endpunkte + ihres Live-Zustands. */
export function getHealth(): HealthEntry[] {
  return [...conns.values()].map((c) => ({
    appId: c.svc.appId,
    role: c.svc.role,
    host: c.svc.host,
    port: c.svc.port,
    connected: c.connected,
    kv: c.kv,
  }));
}
