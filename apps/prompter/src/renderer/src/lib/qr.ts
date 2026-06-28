// QR-Code als Data-URL aus einer URL (für die Handy-Fernbedienung im WLAN).
// qrcode ist reines JS → im Renderer bündelbar (gleiche Nutzung wie apps/qa).
import QRCode from 'qrcode';

export function toDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
