// Folien-Kopplung (Welle 6.3c): ein Remote-Sprecher blättert seine Folien im JM Presenter weiter,
// der im Saal läuft. Der Durable Object kennt kein LAN — er meldet nur den Cue an die Operator-App,
// und DIESE spricht die Suite-Control-Plane.
//
// Aufbau nach dem Client-Pool-Muster von apps/launcher/src/main/health.ts:
//   mDNS-discover → Endpunkte mit role='presenter' und ctl=1 → je Endpunkt ein SuiteControlClient.
//
// ⚠️ `controlClientOptions(cfg)` MUSS in die Client-Optionen. Im secure-Modus spricht der Server TLS
// (+ HMAC-Challenge); ein Plain-Client verbindet dann NIE und bleibt wortlos „offline". Genau das
// war die P1-Lücke, die quer durch die Suite gefixt wurde.
import { app } from 'electron';
import { discover, type DiscoveredService, type Discovery } from '@jm/discovery';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import { controlClientOptions, mdnsSignKey, readControlConfig } from '@jm/control-config';
import type { SlideDir } from '@jm/rtc/protocol';

interface Link {
  svc: DiscoveredService;
  client: SuiteControlClient;
  connected: boolean;
}

const links = new Map<string, Link>(); // `host:port` → Presenter
let discovery: Discovery | null = null;
let onChange: () => void = () => {};

/** Ist mindestens ein Presenter erreichbar? (Für die Operator-Anzeige.) */
export function presenterConnected(): boolean {
  for (const l of links.values()) if (l.connected) return true;
  return false;
}

export function startPresenterLink(deps: { onChange: () => void }): void {
  if (discovery) return;
  onChange = deps.onChange;
  const cfg = readControlConfig(app.getPath('appData'));
  const security = controlClientOptions(cfg);
  const verifyKey = mdnsSignKey(cfg);

  discovery = discover((services) => {
    const found = services.filter((s) => s.role === 'presenter' && s.ctl);
    const alive = new Set(found.map((s) => `${s.host}:${s.port}`));

    for (const svc of found) {
      const key = `${svc.host}:${svc.port}`;
      if (links.has(key)) continue;
      const client = new SuiteControlClient({
        ...security,
        onState: () => {}, // uns interessiert nur der Ausgang; STATE ignorieren
        onConnectedChange: (connected) => {
          const l = links.get(key);
          if (!l) return;
          l.connected = connected;
          onChange();
        },
        reconnectMs: 3000,
      });
      links.set(key, { svc, client, connected: false });
      client.connect(svc.host, svc.port);
    }

    // Verschwundene Presenter abräumen.
    for (const [key, l] of links) {
      if (alive.has(key)) continue;
      l.client.disconnect();
      links.delete(key);
    }
    onChange();
  }, verifyKey ? { verifyKey } : {});
}

export function stopPresenterLink(): void {
  discovery?.stop();
  discovery = null;
  for (const l of links.values()) l.client.disconnect();
  links.clear();
}

/**
 * Folie blättern. Sendet an ALLE gefundenen Presenter (wie `sendControlCommand` des Launchers):
 * im Saal läuft genau einer; mehrere wären ein Betriebsfehler, kein Grund zum Raten.
 * Liefert die Zahl der erreichten Presenter — 0 heißt „niemand hat es gehört".
 */
export function slideCue(dir: SlideDir): number {
  const line = dir === 'prev' ? 'PRESENTER PREV' : 'PRESENTER NEXT';
  let sent = 0;
  for (const l of links.values()) {
    if (!l.connected) continue;
    l.client.send(line);
    sent += 1;
  }
  return sent;
}
