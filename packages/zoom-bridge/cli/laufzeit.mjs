// Wo die Start-EXE (zoom-join.exe) ihre Bridge und die Zoom-Laufzeit findet.
//
// DAS EINSATZPAKET (README Abschnitt "Einsatzpaket"):
//
//   <EXE-Ordner>\zoom-join.exe
//   <EXE-Ordner>\bin\zoom-bridge.exe
//   <EXE-Ordner>\bin\Processing.NDI.Lib.x64.dll     (NDI-Laufzeit, liegt bei)
//   <EXE-Ordner>\bin\sdk.dll + Rest von x64\bin      (NUR im Komplett-Paket)
//
// Die Zoom-DLLs liegen im OEFFENTLICHEN Paket absichtlich NICHT bei - ihre
// Weitergabe-Lizenz ist ungeklaert, und das Repo ist oeffentlich. Darum zwei
// Wege, in fester Reihenfolge:
//   1. <EXE-Ordner>\bin\sdk.dll liegt vor  -> dieses bin auf den PATH des Kindes
//      (Komplett-Paket, oder der Operator hat x64\bin hineinkopiert).
//   2. ZOOM_SDK_DIR ist gesetzt und %ZOOM_SDK_DIR%\x64\bin\sdk.dll liegt vor
//      -> dieses Verzeichnis auf den PATH.
// Sonst ein Fehler, der BEIDE Auswege nennt. Er kommt VOR dem Start des
// Kindes: zoom-bridge.exe ist gegen sdk.dll gebunden, und ohne sie stirbt sie
// mit STATUS_DLL_NOT_FOUND (0xC0000135), BEVOR main() laeuft - ohne eine
// einzige Zeile Ausgabe (README Abschnitt 8, "Eine fehlende DLL sieht aus wie
// ein Anmeldefehler"). Diese Pruefung ersetzt dort das Raten.
//
// Geprueft wird die DATEI sdk.dll, nicht das Verzeichnis: ein gesetztes
// ZOOM_SDK_DIR auf einen falschen Ordner ist der haeufigere Fall als gar
// keins (dieselbe Regel wie in src/ndi-path.ts).
//
// Die NDI-Laufzeit braucht hier keinen eigenen Weg: sie liegt im Paket NEBEN
// zoom-bridge.exe, und der Windows-Lader sucht zuerst im Ordner der .exe.
// withNdiRuntimeOnPath() (src/ndi-path.ts) bleibt in Bridge.start() als
// Rueckfall stehen.
//
// win32.join statt join: diese Aufloesung gilt nur fuer Windows, und so
// liefert der Selbsttest auch auf Linux dieselben Pfade.
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

/**
 * @param {object} o
 * @param {string} o.exeOrdner  Ordner, in dem zoom-join.exe liegt.
 * @param {Record<string, string | undefined>} o.env  Umgebung (ZOOM_SDK_DIR).
 * @param {(p: string) => boolean} [o.gibtEs]  Dateipruefung; nur Tests setzen sie.
 * @returns {{ bridgeExe: string, zoomDllDir: string, herkunft: 'paket' | 'ZOOM_SDK_DIR' } | { fehler: string }}
 */
export function loeseLaufzeitAuf({ exeOrdner, env, gibtEs = existsSync }) {
  const bin = win32.join(exeOrdner, 'bin');
  const bridgeExe = win32.join(bin, 'zoom-bridge.exe');
  if (!gibtEs(bridgeExe)) {
    return {
      fehler:
        `zoom-bridge.exe fehlt: ${bridgeExe}\n` +
        'Das Paket ist unvollstaendig entpackt - den ganzen Ordner aus dem ZIP entpacken, nicht nur zoom-join.exe.',
    };
  }

  const paketDll = win32.join(bin, 'sdk.dll');
  if (gibtEs(paketDll)) return { bridgeExe, zoomDllDir: bin, herkunft: 'paket' };

  const sdk = env.ZOOM_SDK_DIR;
  if (sdk) {
    const sdkBin = win32.join(sdk, 'x64', 'bin');
    const sdkDll = win32.join(sdkBin, 'sdk.dll');
    if (gibtEs(sdkDll)) return { bridgeExe, zoomDllDir: sdkBin, herkunft: 'ZOOM_SDK_DIR' };
    return {
      fehler:
        `ZOOM_SDK_DIR ist gesetzt, aber dort liegt keine sdk.dll: ${sdkDll}\n` +
        'ZOOM_SDK_DIR muss auf den entpackten Zoom-Meeting-SDK-Ordner zeigen (der mit dem Unterordner x64\\bin).',
    };
  }

  return {
    fehler:
      'Die Zoom-Laufzeitdateien fehlen (sdk.dll und ihre Begleiter).\n' +
      'Sie liegen dem oeffentlichen Paket aus Lizenzgruenden NICHT bei. Zwei Wege:\n' +
      `  1. den GESAMTEN Inhalt von <Zoom-SDK>\\x64\\bin (mit Unterordnern) nach\n     ${bin}\n     kopieren, oder\n` +
      '  2. die Umgebungsvariable ZOOM_SDK_DIR auf den entpackten Zoom-Meeting-SDK-Ordner setzen.',
  };
}
