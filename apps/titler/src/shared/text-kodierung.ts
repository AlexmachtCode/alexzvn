// --- JM Titler: Dateikodierung für DataLink-Dateien ---
//
// Reines Modul (ohne Electron, ohne node:fs): wandelt die Bytes einer Datendatei in Text.
// Excel schreibt „CSV (Trennzeichen-getrennt)“ als Windows-1252, „Unicode-Text“ als UTF-16 mit BOM,
// moderne Editoren UTF-8 (mit oder ohne BOM). Erkannt wird nur, was sich sicher erkennen lässt:
// - BOM EF BB BF → UTF-8 (BOM entfällt); BOM FF FE → UTF-16LE; BOM FE FF → UTF-16BE.
// - Ohne BOM: streng als UTF-8 lesen; scheitert das, gilt Windows-1252.
// BOM-loses UTF-16 wird bewusst NICHT erraten: Das Raten trifft auch gültige Windows-1252-Dateien.
// Der Text kommt immer in Normalform NFC heraus (Schlüssel- und Labelvergleiche hängen daran).

export type DateiKodierung = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'windows-1252';

export function dekodiereDatei(bytes: Uint8Array): { text: string; kodierung: DateiKodierung } {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(b.subarray(3));
    return { text: text.normalize('NFC'), kodierung: 'utf-8-bom' };
  }
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(b.subarray(2)).normalize('NFC'), kodierung: 'utf-16le' };
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(b.subarray(2)).normalize('NFC'), kodierung: 'utf-16be' };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(b);
    return { text: text.normalize('NFC'), kodierung: 'utf-8' };
  } catch {
    return { text: windows1252Dekodieren(b).normalize('NFC'), kodierung: 'windows-1252' };
  }
}

// Windows-1252, Bytes 0x80–0x9F (WHATWG-Tabelle). Bewusst NICHT TextDecoder('windows-1252'): In Electron 33
// (Node 20, ohne volle ICU-Tabelle) liefert das für diese Bytes Latin-1-Steuerzeichen statt €, „ “, – usw.
// Die fünf unbelegten Bytes (0x81, 0x8D, 0x8F, 0x90, 0x9D) bleiben U+0081 usw. Alles andere ist wie Latin-1.
const W1252_80_9F =
  '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f' +
  '\u0090‘’“”•–—˜™š›œ\u009džŸ';

export function windows1252Dekodieren(bytes: Uint8Array): string {
  const teile: string[] = [];
  const BLOCK = 8192;
  for (let von = 0; von < bytes.length; von += BLOCK) {
    let s = '';
    const bis = Math.min(von + BLOCK, bytes.length);
    for (let i = von; i < bis; i++) {
      const c = bytes[i];
      s += c >= 0x80 && c <= 0x9f ? W1252_80_9F[c - 0x80] : String.fromCharCode(c);
    }
    teile.push(s);
  }
  return teile.join('');
}

/** Logzeile für eine nicht als UTF-8 gelesene Datei; `null` für UTF-8 (mit oder ohne BOM). */
export function kodierungsLogZeile(datei: string, kodierung: DateiKodierung): string | null {
  if (kodierung === 'windows-1252') return `DataLink: Datei „${datei}“ als Windows-1252 gelesen (keine UTF-8-Datei).`;
  if (kodierung === 'utf-16le' || kodierung === 'utf-16be') return `DataLink: Datei „${datei}“ als UTF-16 gelesen.`;
  return null;
}
