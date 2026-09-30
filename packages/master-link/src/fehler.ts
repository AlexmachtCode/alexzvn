import type { Fristen } from './fristen';
import { PROTOKOLL, type Grund } from './rahmen';

// Fehlerbilder am Slave (Spec 9). Einordnung AUSSCHLIESSLICH nach err.code, nie nach Meldungstext
// (OpenSSL und BoringSSL/Electron formulieren verschieden, die Codes sind gleich — gemessen).

export type FehlerCode =
  | 'zeit' | 'nicht-gefunden' | 'verweigert' | 'netz' | 'kein-master' | 'zertifikat' | 'uhr'
  | 'protokoll' | 'unbekannt' | 'signatur' | 'ersetzt' | 'datei' | 'sonstig';

export type VersuchsErgebnis =
  | { art: 'tcp-timeout' }
  | { art: 'fehler'; code: string }
  | { art: 'frist' }
  | { art: 'abgelehnt'; grund: Grund; master?: number; suite?: string };

export type Einordnung = { art: 'code'; code: FehlerCode } | { art: 'intern'; grund: 'anmeldefrist' | 'last' };

/** Eigener Code des Pin-Vergleichs in checkServerIdentity. */
export const PIN_FALSCH = 'PIN_FALSCH';
/** Kaputte oder zu lange Zeile vom Gegenüber. */
export const RAHMEN = 'RAHMEN';

const ZERTIFIKAT = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_SIGNATURE_FAILURE', PIN_FALSCH,
]);
const UHR = new Set(['CERT_NOT_YET_VALID', 'CERT_HAS_EXPIRED']);
const NETZ = new Set(['EHOSTUNREACH', 'ENETUNREACH']);

export function ordneEin(e: VersuchsErgebnis, mdnsGesehen: boolean): Einordnung {
  const code = (c: FehlerCode): Einordnung => ({ art: 'code', code: c });
  switch (e.art) {
    case 'tcp-timeout':
      // Windows-Stealth: auch „niemand lauscht“ endet im Timeout — „Firewall?“ nur mit mDNS-Sichtung.
      return code(mdnsGesehen ? 'zeit' : 'nicht-gefunden');
    case 'frist':
      return code('kein-master');
    case 'abgelehnt':
      switch (e.grund) {
        case 'anmeldefrist':
        case 'last':
          return { art: 'intern', grund: e.grund };
        case 'unbekannt':
        case 'signatur':
        case 'protokoll':
        case 'ersetzt':
          return code(e.grund);
        default:
          return code('sonstig');
      }
    case 'fehler':
      if (ZERTIFIKAT.has(e.code)) return code('zertifikat');
      if (UHR.has(e.code)) return code('uhr');
      if (e.code === 'ECONNREFUSED') return code('verweigert');
      if (NETZ.has(e.code)) return code('netz');
      if (e.code === 'ETIMEDOUT') return code(mdnsGesehen ? 'zeit' : 'nicht-gefunden');
      if (e.code === RAHMEN || e.code.startsWith('ERR_SSL_')) return code('kein-master');
      return code('sonstig');
  }
}

export const RANGFOLGE: readonly FehlerCode[] = [
  'unbekannt', 'signatur', 'zertifikat', 'uhr', 'protokoll', 'kein-master', 'verweigert', 'zeit', 'sonstig', 'netz', 'nicht-gefunden',
];

export function staerkster(codes: FehlerCode[]): FehlerCode | null {
  for (const c of RANGFOLGE) if (codes.includes(c)) return c;
  return codes[0] ?? null;
}

export type Wiederholung = { art: 'rueckzug' } | { art: 'fest'; ms: number } | { art: 'keine' };

export function wiederholung(code: FehlerCode | 'last' | 'anmeldefrist', f: Fristen): Wiederholung {
  switch (code) {
    case 'zertifikat':
    case 'uhr':
      return { art: 'fest', ms: f.zertifikatWiederholMs };
    case 'protokoll':
      return { art: 'fest', ms: f.protokollWiederholMs };
    case 'ersetzt':
      return { art: 'fest', ms: f.ersetztWiederholMs };
    case 'last':
      return { art: 'fest', ms: f.lastMinMs };
    case 'unbekannt':
    case 'signatur':
    case 'datei':
      return { art: 'keine' };
    default:
      return { art: 'rueckzug' };
  }
}

/** 1 → 2 → 4 → 8 → 10 s (gedeckelt), jeweils ±25 % Zufall gegen Gleichschritt nach Master-Ausfall. */
export function rueckzugMs(versuch: number, f: Fristen, zufall: () => number = Math.random): number {
  const basis = Math.min(f.rueckzugBasisMs * 2 ** Math.max(0, versuch), f.rueckzugMaxMs);
  return Math.round(basis * (0.75 + 0.5 * zufall()));
}

export interface TextKontext {
  masterName: string;
  adresse?: string;
  errCode?: string;
  suite?: string;
  masterProtokoll?: number;
}

export function fehlerText(code: FehlerCode, k: TextKontext): string {
  const name = k.masterName || 'Der Master';
  switch (code) {
    case 'zeit':
      return `${name} ist im Netz sichtbar, aber Port 8738 antwortet nicht. Wahrscheinlich sperrt die Firewall am Master (Regel und Netzprofil prüfen).`;
    case 'nicht-gefunden':
      return `${name} nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus, anderes Netz oder Firewall. Gleiches Netz? Sonst feste Adresse eintragen.`;
    case 'verweigert':
      return 'Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?';
    case 'netz':
      return 'Netz zum Master nicht erreichbar. Richtiges Netz/Kabel? Netzwerkwahl prüfen.';
    case 'kein-master':
      return `Unter ${k.adresse ?? 'dieser Adresse'} antwortet ein Dienst, aber nicht als Master.`;
    case 'zertifikat':
      return 'Unter dieser Adresse antwortet ein anderer Master, oder der Master wurde neu aufgesetzt. Neu koppeln.';
    case 'uhr':
      return 'Die Uhrzeit dieses Rechners oder des Masters stimmt nicht. Uhrzeit prüfen.';
    case 'protokoll':
      return `Versionen passen nicht: Master hat Launcher ${k.suite ?? '?'} (Protokoll ${k.masterProtokoll ?? '?'}), dieses Programm Protokoll ${PROTOKOLL}. Bitte angleichen.`;
    case 'unbekannt':
      return 'Dieser Rechner wurde am Master entfernt. Neu koppeln.';
    case 'signatur':
      return 'Anmeldung abgelehnt: Der Schlüssel passt nicht zur Kopplung. Neu koppeln.';
    case 'ersetzt':
      // Endprüfung D1: „Neu koppeln“ allein sperrte das Original aus — am Klon braucht es eine eigene Kennung.
      return 'Diese Rechnerkennung meldet sich ein zweites Mal beim Master an (Ordner kopiert oder Rechner geklont?). Auf dem kopierten Rechner „Neue Kennung“ wählen, dann neu koppeln.';
    case 'datei':
      return 'Kopplungsdatei beschädigt. Neu koppeln.';
    case 'sonstig':
      return `Verbindungsfehler ${k.errCode ?? 'unbekannt'}.`;
  }
}
