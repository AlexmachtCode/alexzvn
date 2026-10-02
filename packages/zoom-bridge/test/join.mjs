#!/usr/bin/env node
// Konsolen-Pruefstand: tritt einem echten Meeting bei, druckt jedes Ereignis in
// Klartext und geht wieder.
//
// Die Logik steht seit dem Einsatzpaket (01.10.2026) in cli/steuerung.mjs -
// dieselbe, die im Einsatzpaket als zoom-join.exe laeuft. Dort stehen auch
// alle Erklaerungen und gemessenen Fallen. Dieser Pruefstand legt nur fest,
// was ihn vom Einsatz unterscheidet: zoom-bridge.exe aus build\Release, die
// Zoom-DLLs aus %ZOOM_SDK_DIR%\x64\bin, und eine feste Laufdauer (Vorgabe 60 s).
//
// ZUGANGSDATEN: kommen aus der Umgebung oder aus einer Datei AUSSERHALB des
// Repos. Meeting-Nummer und Kenncode gehoeren nirgends ins Repo, auch nicht als
// Beispiel - deshalb stehen unten nur Platzhalter, keine Ziffern. Der Kenncode
// wird nie gedruckt.
//
//   $env:ZOOM_SDK_DIR          = "<Pfad zum entpackten Zoom-Meeting-SDK>"
//   $env:ZOOM_SDK_CREDENTIALS  = "<Pfad ausserhalb des Repos>\zoom-credentials.json"
//   $env:ZOOM_MEETING_ID       = "<nur Ziffern>"
//   $env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
//   npm run join -w @jm/zoom-bridge
//
// OPTIONAL (Einzelheiten in cli/steuerung.mjs): ZOOM_JOIN_SECONDS (Vorgabe
// 60), ZOOM_DISPLAY_NAME, ZOOM_VIDEO_SUBSCRIBE, ZOOM_AUDIO_OFF,
// ZOOM_VIDEO_DELAY_MS, ZOOM_NUR_ANMELDEN=1 (nur Zugangsdaten pruefen, KEIN
// Beitritt).
//
// WAEHREND DES LAUFS: Zeile tippen + Enter - "<Zahl>" Bild-Versatz, "+<id>"
// abonnieren, "+<id> stumm" ohne Ton, "-<id>" abbestellen, "liste", "ende",
// "hilfe". ("-<id>" war bis zum Einsatzpaket ein - ungueltiger - negativer
// Versatz; jetzt heisst es abbestellen.)
import { join } from 'node:path';
import { starteSteuerung } from '../cli/steuerung.mjs';

const seconds = Number(process.env.ZOOM_JOIN_SECONDS ?? '60');

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.error('ZOOM_SDK_DIR ist nicht gesetzt.');
  process.exit(1);
}

// exePath bleibt leer: dann gilt binPath() aus src/bridge.ts, build\Release.
process.exit(await starteSteuerung({ zoomDllDir: join(sdk, 'x64', 'bin'), sekunden: seconds }));
