// Raum-Verwaltung: öffnet einen ConnectRoom in der Cloud (Worker-Admin), hält das
// per-event Verify-Secret (single-holder, wie der Launcher iveo-Token) und mintet
// Operator-/Gast-Join-Token. Der Renderer bekommt nur fertige URLs — das Secret und
// der PROXY_KEY bleiben im Main-Prozess.
//
// Konfiguration: siehe `settings.ts` — Adresse und Key gibt der Operator in der Oberfläche ein;
// die Umgebungsvariablen JMPS_PROXY_URL / JMPS_PROXY_KEY überschreiben sie (Dev-Workflow).
// Ohne Key ist die App „nicht konfiguriert" (openRoom wirft klar).
import { mintJoinToken, randomEventSecret, randomId } from '@jm/rtc/token';
import { dropRoomSecret, loadRoomSecret, saveRoomSecret } from './secrets';
import { proxyKey, proxyUrl } from './settings';
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

export function isConfigured(): boolean {
  const { base, key } = proxyConfig();
  return !!base && !!key;
}

export function currentRoom(): string | null {
  return current?.room ?? null;
}

/** Raum in der Cloud öffnen (Worker-Admin) und die Operator-Verbindung vorbereiten. */
export async function openRoom(room?: string, nowMs = Date.now()): Promise<RoomSession> {
  const { base, key } = proxyConfig();
  if (!base || !key) {
    throw new Error('Cloud-Proxy nicht konfiguriert (JMPS_PROXY_URL / JMPS_PROXY_KEY).');
  }
  // Idempotent: ohne expliziten Raum den bereits offenen weiterverwenden, statt bei jedem
  // Klick einen neuen Zufallsraum zu erzeugen (sonst landen Gast und Operator in verschiedenen
  // Räumen). Ein gespeichertes Secret wird wiederverwendet — sonst wären alle vorab verteilten
  // Join-Links nach einem App-Neustart tot. Nur ein wirklich unbekannter Raum bekommt ein frisches.
  const id = sanitizeRoom(room) || current?.room || randomId(8);
  const secretHex =
    current && current.room === id ? current.secretHex : (loadRoomSecret(id) ?? randomEventSecret());

  const res = await fetch(`${base}/connect/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'X-Proxy-Key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ secretHex, consentText: CONSENT_TEXT }),
  });
  if (!res.ok) throw new Error(`Raum öffnen fehlgeschlagen (Proxy ${res.status}).`);

  current = { room: id, secretHex };
  saveRoomSecret(id, secretHex);
  const operatorToken = await mintJoinToken(secretHex, {
    room: id,
    guestId: 'operator',
    scope: 'operator',
    exp: nowMs + OPERATOR_TTL_MS,
  });
  const wsBase = base.replace(/^http/, 'ws');
  return {
    room: id,
    wsUrl: `${wsBase}/connect/${encodeURIComponent(id)}/ws?t=${encodeURIComponent(operatorToken)}`,
    proxyBase: base,
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
  const { base, key } = proxyConfig();
  if (current && base && key) {
    await fetch(`${base}/connect/${encodeURIComponent(current.room)}`, {
      method: 'DELETE',
      headers: { 'X-Proxy-Key': key },
    }).catch(() => {});
  }
  if (current) dropRoomSecret(current.room);
  current = null;
}

function sanitizeRoom(room?: string): string {
  return (room || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}
