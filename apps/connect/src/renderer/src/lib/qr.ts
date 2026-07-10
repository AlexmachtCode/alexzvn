import QRCode from 'qrcode';

/** Join-Link als QR-Code (Data-URL). Gleicher Wrapper wie in qa/battle/prompter/launcher. */
export function toDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
