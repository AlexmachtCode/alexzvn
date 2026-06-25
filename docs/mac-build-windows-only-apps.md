# Runbook: Windows-only-Tools auf macOS bauen (Titler, Transcribe, Caption)

Drei Tools der Suite waren **Windows-only**: **Titler**, **Transcribe**, **Caption**.
Das war **kein Code-Limit**, sondern ein Packaging-Gate. Dieses Runbook beschreibt den
nun **umgesetzten** macOS-Build (arm64) — und wie man ihn lokal ausführt.

> Status: **umgesetzt + verifiziert** für macOS/arm64 (lokaler Build, wie der bestehende
> lokale Windows-Build). CI baut die drei weiterhin nicht (Win-Seite + NDI-SDK fehlen auf
> Runnern). Geändert:
> - `apps/{transcribe,caption}/tools/bundle-whisper.mjs` — Mac-Zweig (whisper-cli + *.dylib)
> - `apps/{titler,caption}/tools/bundle-ndi.mjs` — Mac-Zweig (jm_ndi.node + libndi.dylib)
> - `apps/{transcribe,titler,caption}/electron-builder.yml` — `mac: dmg` (arm64)
> - `apps/{transcribe,titler,caption}/package.json` — `dist:mac`-Script
>
> **Verifiziert am 2026-06-25** (Apple Silicon, macOS 15, NDI 6.3.2):
> - **JM Transcribe-0.2.0-mac-arm64.dmg** — whisper transkribiert die jfk-Sample (Metal/GPU), 0 Build-Pfad-Leaks
> - **JM Titler-0.4.0-mac-arm64.dmg** — NDI-Addon lädt in Electron, `init()`→true, `createSender` OK
> - **JM Caption-0.3.0-mac-arm64.dmg** — beides (whisper **und** NDI) funktional, 0 Leaks
>
> Reihenfolge zum Bauen: **1) Transcribe → 2) Titler → 3) Caption**.

## 1. Warum sie heute Win-only sind

Die Win-only-Sperre sitzt an **genau drei Stellen** — nirgends in der App-Logik:

| Stelle | Datei | Was sie tut |
|---|---|---|
| Bundle-Skript NDI | [`apps/titler/tools/bundle-ndi.mjs`](../apps/titler/tools/bundle-ndi.mjs), [caption](../apps/caption/tools/bundle-ndi.mjs), [ndi-screen-capture](../apps/ndi-screen-capture/tools/bundle-ndi.mjs) | `if (process.platform !== 'win32') process.exit(0)` |
| Bundle-Skript whisper | [`apps/caption/tools/bundle-whisper.mjs`](../apps/caption/tools/bundle-whisper.mjs), [transcribe](../apps/transcribe/tools/bundle-whisper.mjs) | whisper/Modell nur für `win32` (ffmpeg läuft schon davor cross-platform) |
| Kein `mac:`-Target | [`apps/titler/electron-builder.yml`](../apps/titler/electron-builder.yml), [transcribe](../apps/transcribe/electron-builder.yml), [caption](../apps/caption/electron-builder.yml) | nur `win: nsis`, kein `mac: dmg` |
| CI-Ausschluss | [`.github/workflows/suite-release.yml:25`](../.github/workflows/suite-release.yml#L25) | filtert `titler-v`, `transcribe-v`, `caption-v` raus |

## 2. Was schon Mac-fähig ist (muss NICHT angefasst werden)

- **`binding.gyp`** hat bereits einen `mac`-Zweig (`-lndi` aus `$NDI_SDK_DIR/lib/macOS`) →
  das native NDI-Addon **kompiliert auf Mac**. [`packages/ndi/binding.gyp`](../packages/ndi/binding.gyp)
- **Loader** löst `resources/bin/mac` schon auf. [`packages/ndi/index.js`](../packages/ndi/index.js)
- **`locate.ts`** mappt `darwin → mac` und lässt das `.exe` weg; `whisperPath()` sucht
  `whisper-cli`/`whisper`/`main` ohne Suffix. [`apps/caption/src/main/locate.ts`](../apps/caption/src/main/locate.ts)
- **ffmpeg-Bundling ist schon cross-platform** — `bundleFfmpeg()` läuft in `bundle-whisper.mjs`
  **vor** dem win32-Guard, zieht die Binaries für die aktuelle Plattform.
- **`apps/ndi-screen-capture`** nutzt `@jm/ndi` und hat **schon ein `mac: dmg`-Target +
  `dist:mac`** — NDI-auf-Mac ist also ein bereits begangener Pfad und liefert die Vorlage.

## 3. Die drei Mac-Stolpersteine

1. **dylib-Loading.** macOS findet Libs über `@rpath`/install_name, **nicht über `PATH`** —
   der Windows-Trick `ensureNdiRuntimeOnPath` in `index.js` greift auf Mac nicht. Lösung:
   `libndi.dylib` neben die `.node` legen und per `install_name_tool` einen
   `@loader_path`-rpath setzen (einmalig im Bundle-Skript). **Das ist der einzige wirklich
   neue native Code.**
2. **Gatekeeper/Notarisierung.** Unsignierte DMGs mit nativen Binaries landen in Quarantäne
   („… ist beschädigt"). `ndi-screen-capture` setzt `hardenedRuntime: false` +
   `gatekeeperAssess: false` → reicht für interne Verteilung (Nutzer muss 1× rechtsklick →
   „Öffnen" bzw. `xattr -dr com.apple.quarantine`). Sauberes Doppelklicken braucht
   Apple-Developer-ID-Signierung + Notarisierung (separater, optionaler Schritt).
3. **Arch.** `ndi-screen-capture` zielt auf `arm64` + `x64`. libndi (macOS) ist universal;
   whisper.cpp muss pro Arch oder universal vorliegen. Empfehlung: **erst `arm64`** (Apple
   Silicon, die reale Office-Hardware), `x64` später bei Bedarf.

---

## 4. Build-Runbook (Code umgesetzt — das hier ist die Bedienung)

Die Skript-/Config-Änderungen (Mac-Zweige, `mac:`-Targets, `dist:mac`) sind **erledigt**.
Pro App bleibt: macOS-Binaries beschaffen, Env setzen, `dist:mac` laufen lassen, verifizieren.

### Phase 1: Transcribe (kein NDI, schnellster Proof-of-Concept)

Transcribe braucht nur **whisper.cpp + ffmpeg**. ffmpeg ist schon gelöst → es fehlt nur die
macOS-whisper-Binary.

**4.1 macOS-whisper.cpp beschaffen** (einmalig, lokal auf einem Mac):
```bash
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build -DGGML_METAL=ON            # Metal-Beschleunigung auf Apple Silicon
cmake --build build -j --config Release
# Ergebnis: build/bin/whisper-cli  +  build/src/libwhisper.dylib, build/ggml/src/libggml*.dylib
```
WHISPER_DIR = der Ordner mit `whisper-cli` **und** den `*.dylib` — beim aktuellen Build legt
cmake alles nach `build/bin/` (Binary + dylibs zusammen), also `WHISPER_DIR="…/build/bin"`.
Modell: `./models/download-ggml-model.sh base` → `models/ggml-base.bin`.

> ✅ **Verifiziert am 2026-06-25** (Apple Silicon, macOS 15): DMG gebaut, gepackte `whisper-cli`
> hat nur `@loader_path` (kein Build-Pfad-Leak), lädt self-contained, transkribiert die
> jfk-Sample mit dem gebündelten Modell, **Metal aktiv** (`use gpu = 1`). Das Bundle-Skript
> repariert die rpaths automatisch (Build-Pfad raus, `@loader_path` rein — CLI **und** dylibs)
> und wählt bei mehreren CLI-Treffern `whisper-cli` (Stub `main` wird mitgeliefert/repariert).

**4.2 Mac-Zweig in `bundle-whisper.mjs`** — ✅ **bereits umgesetzt**. Hintergrund: statt
`process.exit(0)` für `darwin` wird echt gestaged (whisper-cli + *.dylib → resources/bin/mac,
`@loader_path`-rpath auf der Binary). Implementierte Logik entspricht dieser Skizze:
```js
if (process.platform === 'darwin') {
  const whisperDir = process.env.WHISPER_DIR;           // enthält whisper-cli + *.dylib
  if (!whisperDir) throw new Error('[bundle-whisper] WHISPER_DIR nicht gesetzt (macOS).');
  const binDest = join(appRoot, 'resources', 'bin', 'mac');
  mkdirSync(binDest, { recursive: true });
  for (const name of readdirSync(whisperDir)) {
    const src = join(whisperDir, name);
    if (!statSync(src).isFile()) continue;
    if (!/(^whisper-cli$|^whisper$|^main$|\.dylib$)/.test(name)) continue;
    copyFileSync(src, join(binDest, name));
  }
  chmodSync(join(binDest, 'whisper-cli'), 0o755);
  // dylibs liegen neben der Binary → rpath @loader_path setzen, damit sie ohne
  // DYLD_* gefunden werden:
  execFileSync('install_name_tool', ['-add_rpath', '@loader_path',
    join(binDest, 'whisper-cli')]);  // idempotent absichern (otool -l prüfen)
  // Basismodell wie im Win-Zweig nach resources/models kopieren …
  process.exit(0);
}
```
> `whisperPath()` findet die Binary danach automatisch (sucht `whisper-cli` ohne `.exe`).
> Der `spawn(whisper, …)`-Aufruf in [`engine.ts`](../apps/transcribe/src/main/engine.ts#L133)
> ist plattformneutral.

**4.3 `mac:`-Block in [`apps/transcribe/electron-builder.yml`](../apps/transcribe/electron-builder.yml)**
(analog ndi-screen-capture):
```yaml
mac:
  target:
    - target: dmg
      arch: [arm64]          # x64 später
  category: public.app-category.productivity
  icon: build/icon.png       # PNG statt .ico anlegen
  hardenedRuntime: false
  gatekeeperAssess: false
```

**4.4 `dist:mac`-Script** in [`apps/transcribe/package.json`](../apps/transcribe/package.json):
```json
"dist:mac": "electron-vite build && npm run prepackage && electron-builder --mac"
```

**4.5 Lokal bauen & verifizieren**:
```bash
export WHISPER_DIR="…/whisper.cpp/build/bin"
export WHISPER_MODEL_BASE="…/ggml-base.bin"
npm run dist:mac -w @jm/transcribe
# DMG mounten, App starten, eine Datei transkribieren → SRT prüfen
```

### Phase 2: Titler (nur NDI)

**4.6 NDI-SDK für Apple** installieren (Standard: `/Library/NDI SDK for Apple`, libndi
universal in `lib/macOS/libndi.dylib`).

> ⚠️ **Leerzeichen-Falle:** `binding.gyp` baut den Include-Pfad per String-Konkatenation
> (`$NDI_SDK_DIR/Include`) **ohne Quoting** → mit Leerzeichen im Pfad bricht `node-gyp` mit
> `clang: error: no such file or directory: 'SDK'` ab. Workaround: einen **leerzeichenfreien
> Symlink** aufs SDK legen und `NDI_SDK_DIR` darauf zeigen lassen. (Betrifft prinzipiell auch
> Windows-Pfade mit Leerzeichen; der MSVC-Generator quotet dort aber selbst.)

```bash
ln -sfn "/Library/NDI SDK for Apple" "$HOME/ndi-sdk-apple"   # einmalig, leerzeichenfrei
export NDI_SDK_DIR="$HOME/ndi-sdk-apple"
npm run rebuild -w @jm/ndi                                   # nutzt den mac-Zweig der binding.gyp
# → packages/ndi/build/Release/jm_ndi.node (arm64; via NAPI in Electron ladbar)
```

**4.7 Mac-Zweig in `bundle-ndi.mjs`** — ✅ **bereits umgesetzt** (für titler **und** caption).
Hintergrund: `jm_ndi.node` + `libndi.dylib` → resources/bin/mac, und die libndi-Referenz der
`.node` wird per `otool -L` ermittelt und mit `install_name_tool -change` auf
`@loader_path/libndi.dylib` umgebogen (+ rpath `@loader_path`). Implementierte Logik:
```js
if (process.platform === 'darwin') {
  const sdk = process.env.NDI_SDK_DIR;
  const destDir = join(appRoot, 'resources', 'bin', 'mac');
  mkdirSync(destDir, { recursive: true });
  copyFileSync(join(repoRoot, 'packages/ndi/build/Release/jm_ndi.node'),
               join(destDir, 'jm_ndi.node'));
  const dylib = join(sdk, 'lib', 'macOS', 'libndi.dylib');   // ggf. versioniert (libndi.4.dylib)
  copyFileSync(dylib, join(destDir, 'libndi.dylib'));
  // jm_ndi.node soll libndi neben sich finden:
  execFileSync('install_name_tool', ['-add_rpath', '@loader_path',
    join(destDir, 'jm_ndi.node')]);
  // Falls die .node auf einen absoluten/install-Pfad zeigt (otool -L prüfen),
  // zusätzlich -change <alterPfad> @rpath/libndi.dylib:
  // execFileSync('install_name_tool', ['-change', '<alt>', '@rpath/libndi.dylib', <node>]);
  process.exit(0);
}
```
> Der Loader [`index.js`](../packages/ndi/index.js) lädt die `.node` aus `resources/bin/mac`
> schon korrekt; `ensureNdiRuntimeOnPath` ist Windows-only und stört auf Mac nicht. Mit dem
> `@loader_path`-rpath wird `libndi.dylib` daneben gefunden — kein NDI-SDK auf dem Zielrechner nötig.

**4.8** `mac:`-Block + `dist:mac` — ✅ umgesetzt (Category `public.app-category.video`). Bauen:
```bash
export NDI_SDK_DIR="/Library/NDI SDK for Apple"
npm run rebuild -w @jm/ndi        # einmalig bzw. nach Electron-Upgrade
npm run dist:mac -w @jm/titler
```

**4.9 Verifizieren**: NDI-Quelle „JM Titler" muss in NDI Studio Monitor / OBS (mit
NDI-Plugin) auf einem **zweiten** Gerät im LAN sichtbar sein. Tipp bei Ladefehler:
`otool -L "JM Titler.app/Contents/Resources/bin/mac/jm_ndi.node"` — die libndi-Zeile muss
`@loader_path/libndi.dylib` zeigen.

### Phase 3: Caption (NDI + whisper)

Kombiniert Phase 1 + 2 — ✅ beide Mac-Zweige umgesetzt (Caption ruft im `prepackage`
`bundle-whisper.mjs` **und** `bundle-ndi.mjs` auf). Bauen mit allen drei Env-Variablen:
```bash
export NDI_SDK_DIR="/Library/NDI SDK for Apple"
export WHISPER_DIR="…/whisper.cpp/build/bin"
export WHISPER_MODEL_BASE="…/ggml-base.bin"
npm run rebuild -w @jm/ndi
npm run dist:mac -w @jm/caption
```
Verifizieren: Live-Untertitel als transparente NDI-Quelle im LAN.

---

## 5. CI (optional, nach lokalem Erfolg)

Heute laufen die **anderen** Tools schon auf `macos-latest` in der Matrix; die drei sind nur
per `if`-Filter ausgeschlossen ([suite-release.yml:25](../.github/workflows/suite-release.yml#L25)).
Um sie auf Mac auch in CI zu bauen:

- **whisper** (Transcribe): in CI per `cmake` aus Quelle bauen — kein Secret nötig. Machbar
  ohne großen Aufwand.
- **NDI** (Titler/Caption): Das **NDI-SDK darf nicht ins Repo** (Lizenz). Optionen: SDK in
  einem Setup-Step von einer secret-gegateten URL ziehen und cachen, oder diese zwei Tools
  weiterhin **lokal** bauen (wie heute Windows) und nur Transcribe in CI heben.
- Mechanik: den Filter so anpassen, dass `*-v`-Tags auf `macos-latest` durchlaufen, auf
  `windows-latest` aber nur wo sinnvoll — d. h. die Matrix-`exclude`-Logik statt globalem `if`.

**Empfehlung:** Phase 1–3 erst **lokal** grün bekommen (spiegelt euren heutigen
„lokal-auf-Windows"-Prozess), dann selektiv in CI heben — Transcribe zuerst, weil ohne SDK-Lizenzfrage.

## 6. Aufwand & Risiko

| App | Neuer Code | Risiko | Hauptrisiko |
|---|---|---|---|
| Transcribe | Mac-Zweig in 1 Bundle-Skript + yml/json | niedrig | whisper-dylib-rpath |
| Titler | Mac-Zweig in bundle-ndi + yml/json | mittel | `.node`/libndi install_name |
| Caption | beide Zweige + yml/json | mittel | Summe der beiden |

Querschnitt für alle drei: PNG-Icon (`build/icon.png`) anlegen und Gatekeeper-Hinweis in die
Release-Notes (rechtsklick → „Öffnen" bzw. `xattr -dr com.apple.quarantine`), solange nicht
signiert/notarisiert.
