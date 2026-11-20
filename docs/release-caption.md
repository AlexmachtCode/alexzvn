# Release-Runbook: JM Caption (nativ, Office-Build)

JM Caption ist **nativ** (whisper.cpp-CLI + Basismodell, @jm/ndi-Addon + NDI-Runtime-DLL)
und wird daher — wie Titler, Recorder, Transcribe, DAW, NDI Screen Capture — **lokal im
Büro auf Windows** gebaut. Die CI (`suite-release.yml`) überspringt das Tool (Tag-Präfix
`caption-v`). Der **Code liegt auf `main`** (0.1.0 ist released + im Katalog).

**Aktueller Stand: 0.2.0 wartet auf den Office-Build.** Auf `main` ist bereits die
**Show-Teilnahme** eingebaut (Caption übernimmt beim koordinierten Start über eine
`.jmshow` Modell, Sprache und NDI-Name aus `ShowToolRef.settings` von `jm-caption`)
und `package.json` auf `0.2.0` gebumpt. Im Katalog steht weiterhin `0.1.0` — der
nächste Build veröffentlicht `0.2.0`.

> ⚠️ **Reihenfolge ist Pflicht** (Memory `launcher-catalog-publishing` /
> `changelog-json-quote-trap`): Der Proxy liest den Katalog **live von `main`**. Erst muss
> das GitHub-Release `caption-v<version>` mit der `.exe` existieren, **dann** darf
> `suite.json` (`latestVersion`) + `changelog.json` auf `main` nachgezogen werden. Niemals
> umgekehrt — sonst zeigt der Launcher einen kaputten Download.

## Voraussetzungen (einmalig)

- Windows-Rechner mit installiertem **NDI-SDK** (für `Processing.NDI.Lib.x64.dll`).
- **whisper.cpp**-Windows-Build (`whisper-cli.exe` + DLLs, z. B. aus `whisper-bin-x64`).
- **Basismodell** `ggml-base.bin` (lokal abgelegt).
- Gebautes natives Addon **`@jm/ndi`** → `packages/ndi/build/Release/jm_ndi.node`
  (entsteht beim `npm install` über `scripts/maybe-build.mjs`; bei Bedarf
  `npm run rebuild --workspace @jm/ndi` mit passendem Electron-Header, gleicher Ablauf wie
  bei Titler / NDI Screen Capture).
- `gh` CLI angemeldet (`gh auth status`).

## Build + Release

```powershell
git checkout main
git pull

# Umgebungsvariablen für die Bundle-Skripte (prepackage):
$env:NDI_SDK_DIR     = "C:\Program Files\NDI\NDI 6 SDK"        # enthält Bin\x64\Processing.NDI.Lib.x64.dll
$env:WHISPER_DIR     = "C:\tools\whisper-bin-x64\Release"     # whisper-cli.exe + DLLs (liegen im Unterordner Release; 20.11.2026 nachgemessen)
$env:WHISPER_MODEL_BASE = "C:\tools\models\ggml-base.bin"     # Basismodell

# Baut Renderer/Main/Preload (+ ndi-sender.cjs), staged whisper + ffmpeg + NDI,
# packt die NSIS-.exe:
npm run dist:win --workspace @jm/caption
# Ergebnis: apps/caption/release/JM Caption-0.2.0-win-x64.exe
```

`dist:win` = `electron-vite build` → `prepackage` (`bundle-whisper.mjs` +
`bundle-ndi.mjs`) → `electron-builder --win`.

### GitHub-Release (Binary MUSS zuerst existieren)

```powershell
gh release create caption-v0.2.0 `
  "apps/caption/release/JM Caption-0.2.0-win-x64.exe" `
  --title "JM Caption 0.2.0" `
  --notes "Show-Teilnahme: uebernimmt beim koordinierten Start ueber eine .jmshow Modell, Sprache und NDI-Name. Plus Live-Untertitel via whisper.cpp als transparente NDI-Quelle, per Companion steuerbar."
```

Artefaktname muss exakt zum Katalog passen: `JM Caption-${version}-win-x64.exe`
→ `JM Caption-0.2.0-win-x64.exe`. Kurz prüfen, dass der Release-Asset-Download zieht.

### Katalog veröffentlichen (erst NACH dem Release)

Caption liegt bereits auf `main` — es wird **nicht mehr gemergt**, sondern nur der
Katalog nachgezogen (wie bei allen nativen Tools):

```powershell
git checkout main
git pull
# latestVersion in suite.json auf die neue Version setzen:
node scripts/bump-manifest.mjs caption 0.2.0
# changelog.json: einen 0.2.0-Eintrag für app "caption" ergänzen (oben einfügen,
# KEINE ASCII-Anführungszeichen in den Notes — Memory changelog-json-quote-trap).
# Beispiel-Note: "Show-Teilnahme: Caption uebernimmt beim koordinierten Start ueber
# eine .jmshow Modell, Sprache und NDI-Name aus der Show."
git add packages/suite-manifest/suite.json packages/suite-manifest/changelog.json
git commit -m "chore(manifest): JM Caption latestVersion -> 0.2.0 + Changelog [skip ci]"
git push
```

Danach im Launcher prüfen: **JM Caption** erscheint unter **Studio** mit den neuen
Patch-Notes; Update/Install funktioniert. Optional: in eine `.jmshow` (Launcher
Show-Editor) `jm-caption` aufnehmen und den koordinierten Start prüfen — Caption soll
Modell/Sprache/NDI-Name aus der Show übernehmen.

## Companion (separat, Office-Standalone-Checkout)

Das generische Modul `companion-jm-suite` kennt die Rolle `caption` bereits (regeneriert via
`scripts/sync-companion-protocol.mjs`). Caption annonciert seinen Steuerendpunkt per mDNS als
`jm-caption-ctl` (TXT `ctl=1`, Port **8732**) → erscheint automatisch in Companion. Actions:
`transcribe on|off|toggle`, `hold on|off|toggle`, `ndi on|off|toggle`, `clear`; Feedbacks für
Transkription/Hold/NDI; Variablen `running/hold/ndi/connections/lines`.

## Smoke-Test (im Büro)

1. Caption starten → Mikrofon erlauben → **● Start**: Pegel schlägt aus, nach Sprechpausen
   erscheinen Untertitelzeilen (echte Transkription, da Binary + Modell jetzt gebündelt).
2. **NDI starten** → in NDI Studio Monitor / vMix / OBS die Quelle `JM Caption` öffnen:
   transparenter Untertitel unten, folgt dem Gesprochenen.
3. **Hold** → NDI-Ausgabe friert auf der letzten Zeile ein, neue Transkripte erst nach Lösen.
4. `telnet <host> 8732` → `CAPTION hold on` friert ein, `CAPTION ndi off` stoppt NDI,
   `CAPTION clear` leert; `STATE?` liefert `STATE ns=caption running=… hold=… ndi=… …`.
5. Companion: Tool erscheint per mDNS, Buttons schalten, Feedback-Farben stimmen.
