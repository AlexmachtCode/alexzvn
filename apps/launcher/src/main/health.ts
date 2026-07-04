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
import type { HealthEntry, ManualEndpoint } from '@shared/types';

interface Conn {
  svc: DiscoveredService;
  client: SuiteControlClient;
  connected: boolean;
  kv: Record<string, string>;
  /** Manuell eingetragener Endpunkt (A4) — vom mDNS-Pruning ausgenommen. */
  manual: boolean;
}

const conns = new Map<string, Conn>(); // Schlüssel: host:port
const manualKeys = new Set<string>(); // A4: manuell eingetragene host:port
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

/** Einen Steuer-Client für einen Endpunkt anlegen + verbinden (mDNS oder manuell). */
function addConn(svc: DiscoveredService, manual: boolean): void {
  const key = endpointKey(svc);
  const client = new SuiteControlClient({
    ...clientSecurity, // P1: Token/TLS im secure-Modus (sonst leer = open)
    onState: (state: SuiteState) => {
      const c = conns.get(key);
      if (!c) return;
      c.kv = Object.fromEntries(Object.entries(state.kv).map(([k, v]) => [k, String(v)]));
      // Manueller Endpunkt kennt Rolle/appId erst aus dem STATE-Namespace (ns).
      if (c.manual && state.ns && !c.svc.role) {
        c.svc = { ...c.svc, role: state.ns, appId: c.svc.appId || `jm-${state.ns}` };
      }
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
  conns.set(key, { svc, client, connected: false, kv: {}, manual });
  client.connect(svc.host, svc.port);
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
    addConn(svc, false);
  }

  // Verschwundene Endpunkte trennen — manuelle bleiben (mDNS-unabhängig, A4).
  for (const [key, conn] of [...conns]) {
    if (conn.manual) continue;
    if (!live.has(key)) {
      conn.client.disconnect();
      conns.delete(key);
    }
  }
  emit();
}

/**
 * A4: manuell eingetragene Steuer-Adressen setzen (Fallback bei blockiertem mDNS).
 * Verbindet neue, trennt entfernte. Überschneidet sich eine manuelle Adresse mit
 * einem bereits per mDNS gefundenen Endpunkt (gleicher host:port), bleibt die
 * bestehende Verbindung erhalten (nur als manuell gemerkt, damit sie nicht gepruned wird).
 */
export function setManualEndpoints(list: ManualEndpoint[]): void {
  const want = new Map(list.map((e) => [endpointKey(e), e]));
  for (const [key, ep] of want) {
    manualKeys.add(key);
    if (conns.has(key)) continue;
    addConn(
      { appId: '', role: '', host: ep.host, port: ep.port, name: key, ctl: true, verified: true },
      true,
    );
  }
  // Entfernte manuelle Adressen trennen (nur solche, die nur manuell existieren).
  for (const key of [...manualKeys]) {
    if (want.has(key)) continue;
    manualKeys.delete(key);
    const conn = conns.get(key);
    if (conn?.manual) {
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

/**
 * Eine rohe Steuer-Zeile an alle VERBUNDENEN Endpunkte eines Tools senden (z. B.
 * `TIMER RELOAD` an jeden entdeckten Timer). Liefert die Anzahl erreichter
 * Endpunkte. Nutzt der iveo-Live-Sync, um nach einem Update den Ablauf in
 * laufenden Tools nicht-destruktiv neu laden zu lassen. Best-effort (send ist
 * no-op, wenn eine Verbindung inzwischen weg ist).
 */
export function sendControlCommand(appId: string, line: string): number {
  let sent = 0;
  for (const conn of conns.values()) {
    if (conn.connected && conn.svc.appId === appId) {
      conn.client.send(line);
      sent += 1;
    }
  }
  return sent;
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
    manual: c.manual,
  }));
}
