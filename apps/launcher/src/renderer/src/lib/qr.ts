// QR-Code als Data-URL (für das Pairing der sicheren Steuerebene: Token +
// TLS-Fingerprint auf einen zweiten Rechner/Companion übertragen, ohne Abtippen).
// qrcode ist reines JS → im Renderer bündelbar (gleiche Nutzung wie apps/qa,
// apps/prompter, apps/battle).
import QRCode from 'qrcode';

export function toDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    // Feste Schwarz-auf-Weiß-Module: unabhängig vom App-Theme zuverlässig scanbar
    // (die Karte legt das QR auf weißen Grund).
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Pairing-Nutzlast für die sichere Steuerebene als forward-kompatible URL.
 * Ein künftiger „Scannen zum Koppeln"-Import kann `jmps://pair?token&fp` parsen;
 * heute überträgt der QR die Werte bequem auf ein zweites Gerät zum Kopieren.
 */
export function pairingUrl(token: string, fingerprint?: string): string {
  const params = new URLSearchParams({ token });
  if (fingerprint) params.set('fp', fingerprint);
  return `jmps://pair?${params.toString()}`;
}
