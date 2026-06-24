# Release-Runbook: JM Titler (nativ, Office-Build)

JM Titler ist **nativ** (`@jm/ndi`-Addon + NDI-Runtime-DLL) und wird daher — wie Caption,
Recorder, Transcribe, DAW, NDI Screen Capture — **lokal auf Windows** gebaut. Die CI
(`suite-release.yml`) überspringt das Tool (Tag-Präfix `titler-v`). Der **Code liegt auf
`main`** (nach Merge von PR #50: `0.4.0`).

> ⚠️ **Reihenfolge ist Pflicht** (Memory `launcher-catalog-publishing` /
> `changelog-json-quote-trap`): Der Proxy liest den Katalog **live von `main`**. Erst muss
> das GitHub-Release `titler-v<version>` mit der `.exe` existieren, **dann** darf `suite.json`
> (`latestVersion`) auf `main` nachgezogen werden. Niemals umgekehrt — sonst zeigt der
> Launcher ein Update mit kaputtem Download. (`changelog.json` wurde für 0.4.0 bereits in
> PR #50 ergänzt.)

## Voraussetzungen (einmalig)

- Windows-Rechner mit installiertem **NDI-SDK** → `…\Bin\x64\Processing.NDI.Lib.x64.dll`.
- Gebautes natives Addon **`@jm/ndi`** → `packages/ndi/build/Release/jm_ndi.node`
  (entsteht beim `npm install` über `scripts/maybe-build.mjs`; bei Bedarf
  `npm run rebuild --workspace @jm/ndi` mit passendem Electron-Header).
- `gh` CLI angemeldet (`gh auth status`).

## Build + Release

```powershell
git checkout main
git pull

# Umgebungsvariable fuer das Bundle-Skript (prepackage → bundle-ndi.mjs):
$env:NDI_SDK_DIR = "C:\Program Files\NDI\NDI 6 SDK"   # enthaelt Bin\x64\Processing.NDI.Lib.x64.dll

# Baut Renderer/Main/Preload (+ ndi-sender.cjs), staged das NDI-Addon + die
# Runtime-DLL nach resources\bin\win\, packt die NSIS-.exe:
npm run dist:win --workspace @jm/titler
# Ergebnis: apps\titler\release\JM Titler-0.4.0-win-x64.exe
```

`dist:win` = `electron-vite build` → `prepackage` (`bundle-ndi.mjs` → kopiert `jm_ndi.node`
+ `Processing.NDI.Lib.x64.dll` nach `resources/bin/win/`) → `electron-builder --win`.

Wer die Veröffentlichung von electron-builder explizit unterbinden will (empfohlen beim
manuellen Lauf), hängt `-- --publish never` an und setzt `CSC_IDENTITY_AUTO_DISCOVERY=false`
(unsigniert, wie die CI):

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist:win --workspace @jm/titler -- --publish never
```

### GitHub-Release (Binary MUSS zuerst existieren)

```powershell
gh release create titler-v0.4.0 `
  "apps/titler/release/JM Titler-0.4.0-win-x64.exe" `
  --title "JM Titler 0.4.0" `
  --prerelease `
  --notes "Suite-Verbindung sichtbar (neue Kopf-Anzeige Suite verbunden), Steuerserver-Logging + mDNS-Fehlerhinweise. Live-Bauchbinden/CG als transparente NDI-Quelle, per Companion steuerbar (Port 8726)."
```

Artefaktname muss exakt zum Katalog passen: `JM Titler-${version}-win-x64.exe`
→ `JM Titler-0.4.0-win-x64.exe`. Kurz prüfen, dass der Asset-Download zieht.

### Katalog veröffentlichen (erst NACH dem Release)

Titler liegt nach dem Merge auf `main` — es wird **nicht erneut gemergt**, nur der Katalog
nachgezogen (wie bei allen nativen Tools):

```powershell
git checkout main
git pull
# latestVersion in suite.json auf die neue Version setzen:
node scripts/bump-manifest.mjs titler 0.4.0
# changelog.json (0.4.0-Eintrag fuer app "titler") ist bereits aus PR #50 vorhanden.
git add packages/suite-manifest/suite.json
git commit -m "chore(manifest): JM Titler latestVersion -> 0.4.0 [skip ci]"
git push
```

Danach im Launcher prüfen: **JM Titler** erscheint unter **Studio** mit den 0.4.0-Patchnotes;
Update/Install funktioniert.

## Smoke-Test (im Büro)

1. Titler starten → Kopfzeile zeigt **Suite getrennt**, solange kein Steuerclient verbunden ist.
2. `jm-titler/main.log` enthält jetzt `Titler-Steuerserver (Companion) lauscht auf :8726`
   (oder eine konkrete Fehlermeldung — genau das war der Diagnose-Kern für #49/#46).
3. NDI starten → in NDI Studio Monitor / vMix / OBS die Quelle `JM Titler` öffnen; Take/Clear
   blendet die Bauchbinde ein/aus.
4. Steuerung verbinden (Companion **oder** ein Tool mit Auto-Kopplung, z. B. Q&A/Battle):
   Die Kopf-Badge wechselt auf **Suite · N verbunden**.
5. `telnet <host> 8726` → `TITLER TAKE` / `TITLER CLEAR` / `TITLER TOGGLE` /
   `TITLER TEMPLATE banner`; `STATE?` liefert `STATE ns=titler on_air=… template=… ndi=… connections=…`.
6. System-Zustand im Launcher: **JM Titler** taucht mit Live-Status auf (mDNS-Discovery + ctl=1).
