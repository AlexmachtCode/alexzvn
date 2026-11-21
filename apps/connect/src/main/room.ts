// Raum-Verwaltung: öffnet einen ConnectRoom in der Cloud (Worker-Admin), hält das
// per-event Verify-Secret (single-holder, wie der Launcher iveo-Token) und mintet
// Operator-/Gast-Join-Token. Der Renderer bekommt nur fertige URLs — das Secret und
// der PROXY_KEY bleiben im Main-Prozess.
//
// Zugang (Anmeldung Teil 2): Connect hält keinen dauerhaften Key mehr. Für jedes Öffnen und Schließen holt es beim Halter
// (`zugang/huelle`) eine Freigabe des Launchers für genau diese Raum-ID und schickt sie als Bearer. Nur im Übergang gilt
// weiter der alte Proxy-Key (JMPS_PROXY_KEY oder hinterlegt); ohne beides wirft openRoom mit dem Grund des Launchers.
// Die Adresse gibt der Operator in der Oberfläche ein (`settings.ts`); JMPS_PROXY_URL überschreibt sie (Dev-Workflow).
import { getLog } from '@jm/app-runtime';
import { mintJoinToken, randomEventSecret, randomId } from '@jm/rtc/token';
import { dropRoomSecret, loadRoomSecret, saveRoomSecret } from './secrets';
import { proxyKey, proxyUrl } from './settings';
import { raumId } from './raum-id';
import { zugangsHalter } from './zugang/huelle';
import { ZUGANG_TEXT, grundText, leseFehlerCode, zugangsKopf, type ZugangsWahl } from './zugang/regeln';
import type { GuestInvite, RoomSession } from '@shared/types';

const CONSENT_TEXT = 'Bild und Ton werden live übertragen und ggf. aufgezeichnet.';
const OPERATOR_TTL_MS = 8 * 60 * 60 * 1000;
const GUEST_TTL_MS = 12 * 60 * 60 * 1000;

interface OpenRoom {
  room: string;
  secretHex: string;
}

let current: OpenRoom | null = null;

export function proxyConfig(): { base: string | null; key: string | null } {
  return { base: proxyUrl() || null, key: proxyKey() };
}

/** Eingerichtet, sobald eine Adresse da ist; ob ein Zugang besteht, zeigt die Zeile „Cloud-Zugang“ (cloudZeile). */
export function isConfigured(): boolean {
  return !!proxyConfig().base;
}

/** Nach einer Antwort 401/403 den Halter unterrichten (er verwirft Freigabe bzw. Key); der Rumpf nennt höchstens einen Code. */
async function meldeAntwort(w: ZugangsWahl, res: Response): Promise<string | null> {
  if (res.status !== 401 && res.status !== 403) return null;
  let code: string | null = null;
  try {
    code = leseFehlerCode(await res.json());
  } catch {
    code = null;
  }
  zugangsHalter().antwort('connect-raum', w, res.status, code);
  return code;
}

export function currentRoom(): string | null {
  return current?.room ?? null;
}

/** Raum in der Cloud öffnen (Worker-Admin) und die Operator-Verbindung vorbereiten. */
export async function openRoom(room?: string, nowMs = Date.now()): Promise<RoomSession> {
  const { base } = proxyConfig();
  if (!base) {
    throw new Error('Cloud-Proxy nicht konfiguriert (JMPS_PROXY_URL / JMPS_PROXY_KEY).');
  }
  // Idempotent: ohne expliziten Raum den bereits offenen weiterverwenden, statt bei jedem
  // Klick einen neuen Zufallsraum zu erzeugen (sonst landen Gast und Operator in verschiedenen
  // Räumen). Ein gespeichertes Secret wird wiederverwendet — sonst wären alle vorab verteilten
  // Join-Links nach einem App-Neustart tot. Nur ein wirklich unbekannter Raum bekommt ein frisches.
  const id = raumId(room ?? '') || current?.room || randomId(8);
  const secretHex =
    current && current.room === id ? current.secretHex : (loadRoomSecret(id) ?? randomEventSecret());

  const w = await zugangsHalter().zugang('connect-raum', id);
  if (w.art === 'keiner') {
    const lage = zugangsHalter().lage('connect-raum');
    throw new Error(ZUGANG_TEXT.raumNicht(grundText('connect-raum', lage.letzterGrund ?? 'kein-launcher', lage.detail)));
  }
  const res = await fetch(`${base}/connect/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { ...zugangsKopf('connect-raum', w), 'content-type': 'application/json' },
    body: JSON.stringify({ secretHex, consentText: CONSENT_TEXT }),
  });
  if (!res.ok) {
    const code = await meldeAntwort(w, res);
    if (res.status === 403 && code === 'raum-vergeben') throw new Error(ZUGANG_TEXT.raumVergeben);
    if (res.status === 401 && w.art === 'freigabe') throw new Error(ZUGANG_TEXT.raumFreigabeAbgelehnt);
    throw new Error(`Raum öffnen fehlgeschlagen (Proxy ${res.status}).`);
  }

  current = { room: id, secretHex };
  saveRoomSecret(id, secretHex);
  // Ablauf der Anmeldung (E57): EINE Variable für exp des Tokens und operatorBis der Sitzung.
  const operatorBis = nowMs + OPERATOR_TTL_MS;
  const operatorToken = await mintJoinToken(secretHex, {
    room: id,
    guestId: 'operator',
    scope: 'operator',
    exp: operatorBis,
  });
  const wsBase = base.replace(/^http/, 'ws');
  return {
    room: id,
    wsUrl: `${wsBase}/connect/${encodeURIComponent(id)}/ws?t=${encodeURIComponent(operatorToken)}`,
    proxyBase: base,
    operatorBis,
  };
}

/**
 * Verbindungsdaten für den versteckten Peer-Renderer: eine eigene Operator-WS zum DO
 * (für das SFU-Medien-Signalling) + die token-gegatete ICE-URL. Frischer Operator-Token.
 */
export async function peerConnectInfo(nowMs = Date.now()): Promise<{ wsUrl: string; iceUrl: string } | null> {
  if (!current) return null;
  const { base } = proxyConfig();
  if (!base) return null;
  const token = await mintJoinToken(current.secretHex, {
    room: current.room,
    guestId: 'peer',
    scope: 'operator',
    exp: nowMs + OPERATOR_TTL_MS,
  });
  const wsBase = base.replace(/^http/, 'ws');
  const enc = encodeURIComponent;
  return {
    wsUrl: `${wsBase}/connect/${enc(current.room)}/ws?t=${enc(token)}`,
    iceUrl: `${base}/connect/${enc(current.room)}/ice?t=${enc(token)}`,
  };
}

/** Join-Token/-Link für einen neuen Gast erzeugen (als QR verteilbar). */
export async function mintGuest(name: string, nowMs = Date.now()): Promise<GuestInvite> {
  if (!current) throw new Error('Kein offener Raum.');
  const { base } = proxyConfig();
  const guestId = randomId(8);
  const token = await mintJoinToken(current.secretHex, {
    room: current.room,
    guestId,
    scope: 'guest',
    name: (name || 'Gast').slice(0, 60),
    exp: nowMs + GUEST_TTL_MS,
  });
  const joinUrl = `${base}/connect/${encodeURIComponent(current.room)}?t=${encodeURIComponent(token)}`;
  return { guestId, name, joinUrl };
}

/** Raum in der Cloud schließen. Rotiert bewusst das Secret → alle verteilten Join-Links sterben. */
export async function closeRoom(): Promise<void> {
  const { base } = proxyConfig();
  if (current && base) {
    try {
      const w = await zugangsHalter().zugang('connect-raum', current.room);
      if (w.art === 'keiner') {
        getLog().warn('[connect] Raum schließen: kein Zugang');
      } else {
        const res = await fetch(`${base}/connect/${encodeURIComponent(current.room)}`, { method: 'DELETE', headers: zugangsKopf('connect-raum', w) });
        if (!res.ok) {
          const code = await meldeAntwort(w, res);
          getLog().warn(`[connect] Raum schließen: Proxy ${res.status}${code ? ` ${code}` : ''}`);
        }
      }
    } catch {
      // Best effort, aber nicht stumm: der Raum bleibt sonst bis zum Ablauf an dieses Konto gebunden. Nur ein fester Text, nie die Ausnahme (sie könnte Kopfzeilen tragen).
      getLog().warn('[connect] Raum schließen: Ausnahme');
    }
  }
  if (current) dropRoomSecret(current.room);
  current = null;
}
