// Einstieg der Start-EXE zoom-join.exe im Einsatzpaket (README Abschnitt
// "Einsatzpaket"). Auf dem Projekt-PC ist KEIN Node installiert: diese Datei
// wird mit steuerung.mjs, laufzeit.mjs und src/ per esbuild zu EINER
// CommonJS-Datei gebuendelt und als Node "Single Executable Application" in
// eine Kopie von node.exe eingesetzt (scripts/build-release.mjs).
//
// Gestartet wird sie normalerweise vom Start-Skript (paket/start.ps1), das
// die Umgebung setzt - dieselben Variablen wie beim Konsolen-Pruefstand
// test/join.mjs (siehe cli/steuerung.mjs). Zwei Unterschiede zum Pruefstand:
//   - zoom-bridge.exe liegt unter <EXE-Ordner>\bin, die Zoom-DLLs kommen aus
//     dem Paket oder aus ZOOM_SDK_DIR (cli/laufzeit.mjs);
//   - ohne ZOOM_JOIN_SECONDS laeuft der Lauf bis "ende", Strg+C oder
//     Meeting-Ende (der Pruefstand: 60 s).
//
// OPTIONAL: ZOOM_VERSATZ_DATEI = "<Pfad>" - dorthin schreibt der Lauf am Ende
// den zuletzt von der Bridge BESTAETIGTEN Bild-Versatz (nur die Zahl). Das
// Start-Skript schlaegt ihn beim naechsten Start als Vorgabe vor: der Wert,
// der im Projekt per Klatschtest nachgestellt wurde, soll nicht verloren gehen.
//
// Der Ordner der EXE ist dirname(process.execPath): in einer Single Executable
// Application ist das die EXE selbst (gemessen mit Node 24.16), und im
// Rueckfall "node.exe + gebuendelte .cjs" liegt node.exe im Paketordner - beide
// Wege landen damit am selben Ort.
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loeseLaufzeitAuf } from './laufzeit.mjs';
import { starteSteuerung } from './steuerung.mjs';

// Beim Buendeln eingesetzt (esbuild define), sonst nicht vorhanden.
/* global __JM_ZOOM_BRIDGE_VERSION__ */
const VERSION = typeof __JM_ZOOM_BRIDGE_VERSION__ === 'string' ? __JM_ZOOM_BRIDGE_VERSION__ : '(Entwicklungsstand)';

async function main() {
  const env = process.env;
  console.log(`JM Zoom Bridge ${VERSION}`);

  // Laufdauer: ohne Angabe bis "ende". Eine kaputte Angabe ist ein Fehler und
  // nicht still "bis ende" - wer eine Zahl setzt, erwartet, dass sie gilt.
  let sekunden = null;
  const roh = env.ZOOM_JOIN_SECONDS;
  if (roh !== undefined && roh.trim() !== '') {
    sekunden = Number(roh);
    if (!(sekunden > 0) || !Number.isFinite(sekunden)) {
      console.error('ZOOM_JOIN_SECONDS: erwartet eine Zahl von Sekunden groesser 0 (oder gar nicht setzen = bis "ende").');
      return 1;
    }
  }

  const lz = loeseLaufzeitAuf({ exeOrdner: dirname(process.execPath), env });
  if ('fehler' in lz) {
    console.error(lz.fehler);
    return 1;
  }
  console.log(`Zoom-Laufzeit: ${lz.zoomDllDir}${lz.herkunft === 'paket' ? ' (aus dem Paket)' : ' (aus ZOOM_SDK_DIR)'}`);

  const versatzDatei = env.ZOOM_VERSATZ_DATEI;
  return starteSteuerung({
    exePath: lz.bridgeExe,
    zoomDllDir: lz.zoomDllDir,
    sekunden,
    beimEnde: (s) => {
      // Nur einen BESTAETIGTEN Wert weitergeben (state.ts, videoDelayMs) -
      // eine hier erfundene 0 ueberschriebe den zuletzt kalibrierten.
      if (!versatzDatei || s.videoDelayMs === null) return;
      writeFileSync(versatzDatei, String(s.videoDelayMs), 'utf8');
    },
  });
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`zoom-join: unerwarteter Fehler - ${e?.message ?? e}`);
    process.exit(1);
  },
);
