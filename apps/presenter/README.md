# JM Presenter

PDF-Presenter und Folien-Editor für die **JM Production Suite**. Bereitet
PDF-, Bild- und Office-Dateien zu einer sauberen Präsentation auf und spielt sie
mit getrennter **Referenten-** und **Publikumsansicht** über zwei Bildschirme aus.

## Funktionen

- **Import** – PDF, Bilder (PNG/JPG/WebP) und Office-Dokumente (PPTX/DOCX/ODP …).
  Office wird über ein lokal installiertes **LibreOffice** nach PDF konvertiert
  (gleiche Technik wie JM Media Converter; ohne LibreOffice gibt es einen Hinweis).
- **Editor** – Folien per Drag neu anordnen, aus-/einblenden, duplizieren, löschen.
  Titel und **Sprecher-Notizen** je Folie. Einfache **Text- und Logo-Overlays**
  (verschieben, skalieren, Schrift/Farbe/Ausrichtung, Balken-Hintergrund).
- **Projekt** – Speichern als selbst-enthaltenes `.jmpres` (ZIP mit Manifest +
  Originaldateien) und jederzeit wieder öffnen.
- **PDF-Export** – sichtbare Folien inkl. eingebrannter Overlays in eine neue PDF.
- **Präsentationsmodus**
  - **Referentenansicht**: aktuelle + nächste Folie, Notizen, Folienzähler
    (aktuell / max), **Uhr + Laufzeit-Timer**, **Folienübersicht (Grid)** und
    **„Gehe zu Folie"**.
  - **Publikumsansicht**: nur die aktuelle Folie, formatfüllend auf Schwarz.
  - **Freie Bildschirm-Zuweisung** des Publikumsfensters, Vollbild-Umschaltung.
  - Steuerung per Tastatur/Maus und **USB-Presenter-Clicker** (PageUp/PageDown,
    Pfeiltasten, Leertaste; `Esc` beendet).
- **NDI-Ausgang (Windows, ab 0.13.0)** – das Publikumsbild zusätzlich als
  NDI-Quelle **„JM Presenter“** (das NDI-SDK ergänzt den Rechnernamen),
  1920×1080, 25 fps, BGRA mit Alphakanal.
  - **Schalter „NDI“** in der Werkzeugleiste und in der Referentenansicht,
    beide am selben Zustand; zeigt an/aus und die Zahl verbundener Empfänger.
    Vorgabe aus; der Zustand wird gemerkt, nach einem Neustart startet NDI von
    selbst. Fehlen Addon oder NDI-Laufzeit oder endet der Sender, zeigt der
    Schalter „NDI nicht verfügbar“ (eine Log-Zeile `[ndi] …`, kein Dialog), und
    Präsentation und Bildschirm laufen weiter. Auf dem Mac gibt es kein NDI.
  - **„Keiner – nur NDI“** im Feld „Publikums-Bildschirm“, wählbar nur bei
    eingeschaltetem NDI: „Präsentieren“ öffnet dann nur die Referentenansicht,
    das Bild geht allein über NDI. Ist NDI aus oder nicht verfügbar, gilt wieder
    die bisherige Bildschirmwahl.
  - **Transparenz:** Was die Folie auf der 16:9-Fläche nicht ausfüllt, ist
    durchsichtig; ein Bild mit eigener Transparenz (PNG) bleibt durchsichtig,
    PDF-/PowerPoint-Folien bleiben deckend (weiße Seite). Übergänge,
    Einblendungen und Weißbild wie auf dem Bildschirm; Schwarzbild, keine
    laufende Präsentation und eine beendete Präsentation sind vollständig
    durchsichtig.

## Architektur

Electron + electron-vite, React 18 + Zustand, Tailwind v4 – identisch zur
restlichen Suite. Die **Multi-Window-Logik** (zweites Fenster, Display-Erkennung,
Vollbild) folgt dem Muster von JM Timer; alle drei Ansichten teilen sich eine
Renderer-Bundle und werden per `?view=`-Query geladen.

Der Präsentationszustand (aktuelle Folie) lebt im **Main-Prozess** und wird per
IPC an Referenten- und Publikumsfenster gebroadcastet – beide Renderer bleiben so
immer synchron. Der **Slide-Compositor** (`lib/paint.ts`) ist die einzige Quelle
für das Aussehen einer Folie und wird von Publikumsansicht, Referenten-Previews
**und** PDF-Export genutzt, damit Editor, Bühne und Export identisch aussehen.

```
src/
  shared/      types.ts                          (geteilte Domänen-/IPC-Typen)
  main/
    windows.ts present.ts                         (3 Fenster, Display-Zuweisung, Sync-Hub)
    office/    locate.ts  convert.ts              (LibreOffice → PDF)
    ipc.ts  index.ts
  preload/     index.ts                           (window.jmpr Bridge, ?view-Parsing)
  renderer/
    lib/       pdf.ts  paint.ts  project-file.ts  export-pdf.ts  assets.ts …
    store/     project.ts                         (Editor-Zustand, Zustand)
    views/     EditorView · PresenterView · AudienceView
```

## Entwicklung

```bash
npm install
npm run dev               # Electron + Vite (Renderer-Port 5179)
npm run typecheck         # node + web
npm run build             # Production-Build nach out/
npm run dist:win          # NSIS-Installer (Windows, nur mit NDI_SDK_DIR – siehe unten)
npm run dist:mac          # DMG (macOS, arm64 + x64, ohne NDI)
```

### Release-Weg (ab 0.13.0, #303)

- **Windows baut der Owner lokal mit NDI.** `prepackage` (`tools/bundle-ndi.mjs`)
  legt das gebaute Addon (`packages/ndi/build/Release/jm_ndi.node`) und die
  NDI-Laufzeit (`Processing.NDI.Lib.x64.dll` aus `NDI_SDK_DIR`) nach
  `resources/bin/win/`. Ohne `NDI_SDK_DIR` bricht der Bau ab
  („NDI_SDK_DIR nicht gesetzt“) – ein Windows-Paket ohne NDI entsteht nie still.
  Der Lizenztext der NDI-Laufzeit liegt im Paket, in
  `resources\bin\win\Processing.NDI.Lib.Licenses.txt` (fehlt er im SDK, bricht der Bau ebenfalls ab).

  ```powershell
  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
  npm run dist:win -- --publish never   # → release/JM Presenter-<version>-win-x64.exe
  ```

- **Das Mac-Paket baut die CI ohne NDI.** Auf den Tag `presenter-v<version>`
  baut `.github/workflows/suite-release.yml` nur `macos-latest` (Job `plan`) und
  hängt beide DMGs (arm64, x64) an das Release; die exe lädt der Owner von Hand
  an dasselbe Release.
- **`latestVersion` erst nach exe + dmg.** Der automatische Katalog-Bump ist für
  den Presenter aus; erst wenn exe und beide DMGs am Release hängen, lokal
  `node scripts/bump-manifest.mjs presenter <version>`.

In GitHub Codespaces ohne Display:

```bash
npm run build && npm run start:codespace   # läuft via xvfb
```

> **Hinweis:** Office-Import benötigt ein installiertes LibreOffice auf dem
> Zielrechner. Der Präsentationsmodus entfaltet seinen Nutzen mit zwei
> Bildschirmen; mit nur einem Display überlagern sich Referenten- und
> Publikumsfenster (Vollbild).
