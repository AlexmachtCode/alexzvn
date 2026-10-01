// Alle Zeiten und Grenzen des Master-Links an EINER Stelle (Spec 3.2, 4.5, 5.1, 6.3, 7.1).
// Jede Frist ist einstellbar, damit die Selbsttests mit echten, kurzen Zeiten
// laufen statt mit einer vorgetäuschten Uhr.

export interface Fristen {
  /** TCP-Aufbau je Kandidat. */
  tcpMs: number;
  /** Ab TCP 'connect' bis 'hallo' empfangen (TLS inklusive). */
  tlsHalloMs: number;
  /** Ab Senden von 'anmelden'/'teilnehmer' bis 'angemeldet'. */
  angemeldetMs: number;
  /** Slave: ab Senden von 'koppeln' bis 'gekoppelt'/'abgelehnt' — hart (Spec 3.3). */
  koppelnMs: number;
  pulsMs: number;
  /** Ohne jede Zeile so lange → getrennt. */
  stilleMs: number;
  /** tls.createServer handshakeTimeout. */
  handshakeMs: number;
  /** Master: ab TCP-Annahme bis anmelden/koppeln. */
  anmeldefristMs: number;
  codeGueltigMs: number;
  suchrundeMs: number;
  rueckzugBasisMs: number;
  rueckzugMaxMs: number;
  zertifikatWiederholMs: number;
  protokollWiederholMs: number;
  ersetztWiederholMs: number;
  lastMinMs: number;
  ratenFensterMs: number;
  dateiPruefMs: number;
  kartenPruefMs: number;
  gesehenSchreibMs: number;
}

export const STANDARD_FRISTEN: Fristen = {
  tcpMs: 3000,
  tlsHalloMs: 5000,
  angemeldetMs: 10_000,
  koppelnMs: 10_000,
  pulsMs: 10_000,
  stilleMs: 25_000,
  handshakeMs: 10_000,
  anmeldefristMs: 10_000,
  codeGueltigMs: 120_000,
  suchrundeMs: 1500,
  rueckzugBasisMs: 1000,
  rueckzugMaxMs: 10_000,
  zertifikatWiederholMs: 30_000,
  protokollWiederholMs: 60_000,
  ersetztWiederholMs: 60_000,
  lastMinMs: 5000,
  ratenFensterMs: 60_000,
  dateiPruefMs: 5000,
  kartenPruefMs: 10_000,
  gesehenSchreibMs: 60_000,
};

export function fristen(teil: Partial<Fristen> = {}): Fristen {
  return { ...STANDARD_FRISTEN, ...teil };
}

export const GRENZEN = {
  vorAnmeldung: 4 * 1024,
  nachAnmeldung: 1024 * 1024,
  maxUnangemeldet: 64,
  ratenLimit: 20,
  maxFehlversuche: 5,
  /** mDNS-TXT ≤ 255 Byte je Eintrag: 60 Zeichen à ≤ 4 Byte + "name=" passen. */
  maxNamenLaenge: 60,
} as const;

export const MASTER_PORT = 8738;
export const SUITE_ORDNER = 'JM Production Suite';

/**
 * Anzeigename bzw. Fremdtext säubern: Steuer- und Formatzeichen (Zeilenumbruch, ESC, Bidi-Overrides, U+2028/2029)
 * werden Leerzeichen — sonst fälschen Fremdtexte Zeilen im zeilenbasierten Log oder verdrehen Namen in Listen
 * (Endprüfung A6). Dann Leerzeichen zusammenziehen, trimmen, auf 60 ganze Zeichen kürzen, erneut trimmen, nie leer.
 */
export function kuerzeName(name: string): string {
  const sauber = name.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ' ').replace(/ {2,}/g, ' ').trim();
  const gekuerzt = [...sauber].slice(0, GRENZEN.maxNamenLaenge).join('').trim();
  return gekuerzt.length > 0 ? gekuerzt : 'Unbenannt';
}
