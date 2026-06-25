import { Bonjour } from 'bonjour-service';
import { signAdvertisement, verifyAdvertisement } from './sign';

/** Strukturelle Teilmenge eines Bonjour-Service — nur was wir wirklich lesen. */
interface MdnsService {
  txt?: Record<string, unknown> | null;
  addresses?: string[];
  host?: string;
  port: number;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// @jm/discovery — LAN-Auto-Discovery der Suite via mDNS/Bonjour.
//
// Quellen (Timer, Switcher, Presenter …) annoncieren sich als `_jmps._tcp` mit
// TXT-Records { appId, role }. Aggregatoren (z. B. Stage Display) finden sie und
// verbinden sich, ohne dass jemand IP/Port von Hand eintippen muss.
//
// Verallgemeinert das mDNS-Muster aus apps/studio-control auf die ganze Suite.
// Nutzt node-gebundene Multicast-Sockets → nur im Main-Prozess verwenden.
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_TYPE = 'jmps'; // → _jmps._tcp

export interface DiscoveredService {
  /** Tool-ID, z. B. "jm-timer" (aus dem TXT-Record). */
  appId: string;
  /** Frei wählbare Rolle, z. B. "timer" (aus dem TXT-Record). */
  role: string;
  /** IPv4-Adresse (bevorzugt) oder Hostname. */
  host: string;
  port: number;
  name: string;
  /**
   * Steuer-Endpunkt? `true`, wenn der TXT-Record `ctl=1` trägt — d. h. dieser
   * Dienst spricht das suite-weite TCP-Zeilenprotokoll (@jm/suite-control-
   * protocol), im Gegensatz zu einem tool-eigenen Endpunkt (Socket.IO/SSE).
   * Aggregatoren wählen damit den richtigen von zwei Endpunkten derselben Rolle
   * (z. B. Stage Display den Socket.IO-Timer, Companion den ctl=1-Timer).
   */
  ctl: boolean;
  /**
   * Signatur-Status (P1, #59, Befund A5):
   *  - kein `verifyKey` an `discover()` übergeben → immer `true` (keine Prüfung
   *    angefordert, Legacy-Verhalten).
   *  - `verifyKey` gesetzt → `true` nur, wenn der TXT-`sig`-Record per HMAC zum
   *    Key passt. Aggregatoren im secure-Betrieb ignorieren `verified:false`
   *    (gefälschte/unsignierte Annoncen).
   */
  verified: boolean;
}

export interface Advertiser {
  stop: () => void;
}

export interface Discovery {
  stop: () => void;
}

/** Veröffentlicht den eigenen Dienst im LAN als _jmps._tcp mit TXT {appId, role}. */
export function advertise(opts: {
  appId: string;
  role: string;
  port: number;
  name?: string;
  /**
   * Zusätzliche TXT-Felder (z. B. `{ ctl: '1' }`, um einen Steuer-Endpunkt zu
   * markieren). `appId`/`role` bleiben maßgeblich und überschreiben Extras.
   */
  txt?: Record<string, string>;
  /**
   * Pairing-Key (P1, #59): gesetzt → die Annonce wird signiert (TXT `sig`), damit
   * Aggregatoren ihre Echtheit prüfen können (Anti-Spoofing). Nicht gesetzt →
   * unsignierte Annonce wie bisher.
   */
  signKey?: string;
}): Advertiser {
  const bonjour = new Bonjour();
  const sig = opts.signKey
    ? { sig: signAdvertisement(opts.signKey, { appId: opts.appId, role: opts.role, port: opts.port }) }
    : {};
  const service = bonjour.publish({
    name: opts.name ?? opts.appId,
    type: SERVICE_TYPE,
    port: opts.port,
    txt: { ...opts.txt, ...sig, appId: opts.appId, role: opts.role },
  });
  return {
    stop: () => {
      try {
        service.stop?.();
      } catch {
        /* best-effort */
      }
      try {
        bonjour.destroy();
      } catch {
        /* best-effort */
      }
    },
  };
}

function toDiscovered(s: MdnsService, verifyKey?: string): DiscoveredService | null {
  const txt = (s.txt ?? {}) as Record<string, unknown>;
  const appId = typeof txt.appId === 'string' ? txt.appId : '';
  if (!appId) return null;
  // IPv4 bevorzugen (z. B. für TCP/HTTP-Clients), sonst Hostname.
  const host = s.addresses?.find((a) => a.includes('.')) ?? s.host;
  if (!host) return null;
  const role = typeof txt.role === 'string' ? txt.role : '';
  // Ohne verifyKey wird nicht geprüft (Legacy → verified:true). Mit Key muss die
  // TXT-Signatur passen.
  const verified = verifyKey
    ? verifyAdvertisement(verifyKey, { appId, role, port: s.port }, txt.sig != null ? String(txt.sig) : undefined)
    : true;
  return {
    appId,
    role,
    host,
    port: s.port,
    name: s.name,
    // TXT-Werte können String oder (bei manchen Respondern) Buffer/true sein →
    // tolerant auf '1' prüfen.
    ctl: String(txt.ctl ?? '') === '1',
    verified,
  };
}

/**
 * Sucht andere JM-Dienste im LAN. `onChange` wird mit der aktuellen Liste
 * gerufen, sobald ein Dienst auftaucht oder verschwindet.
 */
export function discover(
  onChange: (services: DiscoveredService[]) => void,
  opts: { verifyKey?: string } = {},
): Discovery {
  const bonjour = new Bonjour();
  const found = new Map<string, DiscoveredService>();
  const key = (d: DiscoveredService): string => `${d.appId}@${d.host}:${d.port}`;
  const emit = (): void => onChange([...found.values()]);

  const browser = bonjour.find({ type: SERVICE_TYPE }, (s: MdnsService) => {
    const d = toDiscovered(s, opts.verifyKey);
    if (d) {
      found.set(key(d), d);
      emit();
    }
  });
  browser.on('down', (s: MdnsService) => {
    const d = toDiscovered(s, opts.verifyKey);
    if (d && found.delete(key(d))) emit();
  });

  return {
    stop: () => {
      try {
        browser.stop();
      } catch {
        /* best-effort */
      }
      try {
        bonjour.destroy();
      } catch {
        /* best-effort */
      }
    },
  };
}
