// Was JM Connect ueber das Zoom-SDK wissen muss, bevor es eine Datei daraus
// anfasst (Spec Stage 4, Abschnitte 3.3, 5.1, 6.1 Schritte 3-4).
//
// SCHNITT: kein fs, kein Buffer. peInfo() bekommt die Bytes, findeSdkBin() bekommt
// die Frage "gibt es diese Datei?" als Funktion - beides ist darum ohne SDK und
// ohne Windows pruefbar (test/selftest.ts erzeugt die PE-Puffer selbst).
import { join } from 'node:path';

/** Die einzige SDK-Fassung, mit der diese Bridge gebaut und abgenommen ist (E6). */
export const SDK_FASSUNG = '7.1.5.43953';
/** Dieselbe Fassung, wie die Bridge sie im ready-Ereignis meldet (sdkVersion). */
export const SDK_FASSUNG_BRIDGE = '7.1.5 (43953)';

/** IMAGE_FILE_MACHINE_AMD64 im COFF-Kopf. */
export const PE_MASCHINE_X64 = 0x8664;
/** IMAGE_FILE_MACHINE_I386 im COFF-Kopf - das 32-Bit-SDK (Text S2). */
export const PE_MASCHINE_X86 = 0x014c;

export interface PeInfo {
  maschine: 'x64' | 'x86' | 'andere';
  /** Der rohe Wert aus dem COFF-Kopf, fuer Meldungen ueber 'andere'. */
  maschinenTyp: number;
  /** Dateifassung "a.b.c.d" aus VS_FIXEDFILEINFO; null ohne Versionsressource (Text S3b). */
  fassung: string | null;
}

/**
 * Liest Maschinentyp und Dateifassung aus einer PE-Datei (DLL/EXE).
 * Wirft, wenn `buf` keine PE-Datei ist - ein Ordner mit einer kaputten oder
 * fremden sdk.dll ist kein SDK, und "keine Fassung" waere dort eine Luege.
 */
export function peInfo(buf: Uint8Array): PeInfo {
  // byteOffset/byteLength sind TRAGEND: ein Buffer aus readFileSync ist bei
  // kleinen Dateien ein Ausschnitt aus Nodes gemeinsamem Pool - buf.buffer
  // beginnt dann NICHT bei Byte 0 dieser Datei.
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const keinePe = (): Error => new Error('Keine PE-Datei (Signatur PE\\0\\0 fehlt).');
  if (buf.length < 0x40) throw keinePe();
  const peKopf = dv.getUint32(0x3c, true); // e_lfanew
  if (peKopf + 6 > buf.length) throw keinePe();
  if (buf[peKopf] !== 0x50 || buf[peKopf + 1] !== 0x45 || buf[peKopf + 2] !== 0 || buf[peKopf + 3] !== 0) {
    throw keinePe();
  }
  const maschinenTyp = dv.getUint16(peKopf + 4, true);
  const maschine = maschinenTyp === PE_MASCHINE_X64 ? 'x64' : maschinenTyp === PE_MASCHINE_X86 ? 'x86' : 'andere';

  // VS_FIXEDFILEINFO beginnt mit der Signatur 0xFEEF04BD (Bytes BD 04 EF FE);
  // dwFileVersionMS folgt bei +8, dwFileVersionLS bei +12. Gelesen wie
  // scripts/build-release.mjs (dateiFassung): erste Fundstelle in der Datei.
  let fassung: string | null = null;
  for (let i = 0; i + 16 <= buf.length; i++) {
    if (buf[i] === 0xbd && buf[i + 1] === 0x04 && buf[i + 2] === 0xef && buf[i + 3] === 0xfe) {
      const ms = dv.getUint32(i + 8, true);
      const ls = dv.getUint32(i + 12, true);
      fassung = `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
      break;
    }
  }
  return { maschine, maschinenTyp, fassung };
}

/**
 * Sucht sdk.dll unter dem gewaehlten Ordner: direkt darin (der Bediener hat
 * x64\bin gewaehlt), in bin (er hat x64 gewaehlt) oder in x64\bin (er hat die
 * SDK-Wurzel gewaehlt). Liefert den ORDNER der ersten Fundstelle, sonst null
 * (Text S1). `gibtEs` ist im Betrieb existsSync, im Test ein Set.
 */
export function findeSdkBin(gewaehlt: string, gibtEs: (pfad: string) => boolean): string | null {
  for (const ordner of [gewaehlt, join(gewaehlt, 'bin'), join(gewaehlt, 'x64', 'bin')]) {
    if (gibtEs(join(ordner, 'sdk.dll'))) return ordner;
  }
  return null;
}
