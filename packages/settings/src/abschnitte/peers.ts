// --- @jm/settings: Gegenstellen (Spec 6.2, UO4, Regeln 7.1–7.3) ---
//
// Je Rolle Host, Port, Quelle (gefunden/manuell) und Verbindung. Standard ist automatisch (mDNS),
// ein gesetzter Host überschreibt den Fund, „Auto“ nimmt das zurück (Rundown, Q&A, Battle). Stage-
// Display kennt kein Auto, sondern Ein/Aus je Quelle (`enabled`, ohne `source`). Eine unbekannte
// Verbindung ist „unbekannt“, nie „nicht gefunden“; ausgeschaltete Zeilen zählen nicht mit.
import { zahlText, type StatusState } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface PeerRow {
  role: string; label: string;
  host: string;                      // '' = automatisch (mDNS)
  port: number; defaultPort?: number;
  connected?: boolean;               // gemessen; undefined = unbekannt
  source?: 'mdns' | 'manual';        // undefined = Modell ohne Auto (Stage-Display)
  enabled?: boolean;                 // nur mit capabilities.toggle
}

export interface PeersSectionProps extends SectionInput {
  peers: PeerRow[];
  capabilities: { auto?: boolean; toggle?: boolean };
  onSet?(role: string, host: string, port: number): void; onAuto?(role: string): void;
  onToggle?(role: string, enabled: boolean): void;
}

export const PEERS_TEXTE = {
  titel: 'Gegenstellen',
  aktiv: 'Aktiv',
  host: 'Host',
  port: 'Port',
  quelle: 'Quelle',
  verbunden: 'Verbunden',
  quelleGefunden: 'gefunden',
  quelleManuell: (host: string, port: number) => `manuell: ${host}:${zahlText(port)}`,
  zeileVerbunden: 'verbunden',
  zeileNichtGefunden: 'nicht gefunden',
  zeileManuellNichtVerbunden: (host: string, port: number) => `manuell: ${host}:${zahlText(port)} · nicht verbunden`,
  zeileAus: ABSCHNITT_TEXTE.aus,
  alleVerbunden: 'verbunden',
  kVonN: (k: number, n: number) => `${zahlText(k)} von ${zahlText(n)} verbunden`,
  keineGegenstellen: 'keine Gegenstellen',
  setzen: 'Setzen',
  auto: 'Auto',
  setzenFuer: (label: string) => `Setzen: ${label}`,
  autoFuer: (label: string) => `Auto: ${label}`,
  platzhalterHost: 'leer = automatisch',
  setzenOhnePort: 'Setzen geht erst mit einem gültigen Port.',
  erklaerung:
    'Standard ist automatisch (mDNS). Für ein anderes Subnetz oder blockiertes mDNS Host und Port setzen – das überschreibt den Fund. „Auto“ nimmt das wieder zurück.',
} as const;

export interface PeerZeileView {
  role: string;
  label: string;
  status: SectionStatus;
  aktiv: boolean;                    // enabled !== false
  quelleText?: string;               // „gefunden“ bzw. „manuell: {host}:{port}“; ohne source keins
}

export interface PeersView extends SectionBase {
  sichtbar: { auto: boolean; schalter: boolean; erklaerung: boolean };
  zeilen: PeerZeileView[];
}

export function peerZeileStatus(r: PeerRow): SectionStatus {
  if (r.enabled === false) return st('off', PEERS_TEXTE.zeileAus);
  if (r.connected === undefined) return STATUS_UNBEKANNT;
  if (r.connected) return st('ok', PEERS_TEXTE.zeileVerbunden);
  if (r.source === 'manual' && r.host !== '') return st('warn', PEERS_TEXTE.zeileManuellNichtVerbunden(r.host, r.port));
  return st('warn', PEERS_TEXTE.zeileNichtGefunden);
}

function zeileView(r: PeerRow): PeerZeileView {
  return {
    role: r.role,
    label: r.label,
    status: peerZeileStatus(r),
    aktiv: r.enabled !== false,
    quelleText:
      r.source === 'mdns'
        ? PEERS_TEXTE.quelleGefunden
        : r.source === 'manual' && r.host !== '' // manuell ohne Host ist automatisch, wie im Status (peerZeileStatus)
          ? PEERS_TEXTE.quelleManuell(r.host, r.port)
          : undefined,
  };
}

function peersStatus(p: PeersSectionProps, zeilen: readonly PeerZeileView[]): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  const aktive = zeilen.filter((z) => z.aktiv);
  if (aktive.length === 0) return st('off', PEERS_TEXTE.keineGegenstellen);
  const hat = (state: StatusState): boolean => aktive.some((z) => z.status.state === state);
  if (hat('warn')) return st('warn', PEERS_TEXTE.kVonN(aktive.filter((z) => z.status.state === 'ok').length, aktive.length));
  if (hat('off')) return STATUS_UNBEKANNT;
  return st('ok', PEERS_TEXTE.alleVerbunden);
}

export function peersView(p: PeersSectionProps): PeersView {
  const zeilen = p.peers.map(zeileView);
  const auto = p.capabilities.auto === true && typeof p.onAuto === 'function';
  return {
    id: p.id,
    status: peersStatus(p, zeilen),
    locked: p.locked,
    error: p.error,
    sichtbar: { auto, schalter: p.capabilities.toggle === true, erklaerung: auto && typeof p.onSet === 'function' }, // die Erklärung nennt Setzen und Auto
    zeilen,
  };
}

/** Port, den das Feld zeigt: der gesetzte, sonst der Standardport; null = das Feld ist leer. */
export function startPort(row: PeerRow): number | null {
  return row.port > 0 ? row.port : (row.defaultPort ?? null);
}

/**
 * Setzen: Host ohne Leerraum und der Port aus dem Feld. Ohne gültigen Port kein Aufruf (nie eine Zahl, die das Feld nicht
 * zeigt): weder bei leerem Feld (port null) noch bei einem ungültigen Entwurf (portGueltig false; NumberInput meldet nur
 * gültige Zahlen, port stünde dann noch beim letzten gültigen Wert).
 */
export function peerSetzen(p: PeersSectionProps, row: PeerRow, host: string, port: number | null, portGueltig = true): boolean {
  if (!p.onSet || port === null || !portGueltig) return false;
  p.onSet(row.role, host.trim(), port);
  return true;
}

/**
 * Warum „Setzen“ gesperrt ist, sichtbar am Knopf (gesperrt nie ohne Grund, Spec 6.1): ohne gültigen Port im Feld. Ist der
 * Abschnitt gesperrt, nennt SectionFrame den Grund schon vor den Feldern; dann kein zweiter.
 */
export function peerSetzenGrund(gesperrt: boolean, port: number | null, portGueltig: boolean): string | undefined {
  if (gesperrt) return undefined;
  return port === null || !portGueltig ? PEERS_TEXTE.setzenOhnePort : undefined;
}

/** Auto: meldet es und gibt den Entwurf zurück, auf den die Zeile zurückfällt (Host leer, Port wie angezeigt). */
export function peerAuto(p: PeersSectionProps, row: PeerRow): { host: string; port: number | null } {
  p.onAuto?.(row.role);
  return { host: '', port: startPort(row) };
}

export function peerToggle(p: PeersSectionProps, row: PeerRow, enabled: boolean): void {
  p.onToggle?.(row.role, enabled);
}
