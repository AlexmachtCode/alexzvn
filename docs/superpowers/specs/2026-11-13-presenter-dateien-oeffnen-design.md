# JM Presenter: Dateien hineinziehen (#298) und PDFs per Doppelklick öffnen (#299)

Stand 13.11.2026 · Ziel-Version Presenter 0.12.0 · Branch `feat/presenter-298-299-dateien`

## Wozu

Beide Issues kommen aus dem Feld (über den Launcher gemeldet). Das Vorbereiten einer
Präsentation soll weniger Klicks brauchen:

- **#298:** Eine oder mehrere Dateien (PDF, Bilder, PowerPoint/Office) direkt aus dem
  Explorer oder Finder in den Presenter ziehen. Sie landen als Folien im Ablauf (in der
  Folienliste), ohne Dateiauswahldialog.
- **#299:** Der Presenter meldet sich bei der Installation unter Windows und macOS für
  `.pdf` an. Er erscheint unter „Öffnen mit“, lässt sich in den Systemeinstellungen als
  Standard-App wählen, und ein Doppelklick auf ein PDF startet ihn (falls nötig) und lädt
  das PDF.

Beide Wünsche brauchen denselben Kern: eine Datei über ihren **Pfad** in den Editor holen.
Den gibt es schon für den Steuerbefehl `PRESENTER OPEN` (`src/main/control-open.ts`), der
aber immer das ganze Deck ersetzt.

## Ziele

1. Hineinziehen ins Editor-Fenster funktioniert für PDF, Bilder (`png jpg jpeg webp gif bmp`)
   und Office (`pptx ppt odp docx doc odt rtf`), einzeln und gemischt, mehrere auf einmal.
2. Doppelklick und „Öffnen mit“ auf ein PDF öffnen es im Presenter, egal ob er läuft oder nicht.
3. Der Presenter ist in „Öffnen mit“ und in den Standard-App-Einstellungen wählbar, auf
   Windows und auf dem Mac.

## Nicht-Ziele (dieses Paket)

- Doppelklick auf `.jmpres` oder `.pptx` (Anmeldung nur für `.pdf`, wie im Issue).
- Ablegen an einer bestimmten Stelle der Folienliste (es wird immer hinten angehängt).
- Ablegen in Referentenansicht oder Publikumsansicht.
- Linux.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch funktioniert)

- Der Presenter wird **still** zum PDF-Programm des Rechners, ohne dass jemand ihn gewählt hat.
- Ein Ablegen oder Doppelklick verändert das **Publikumsbild** einer laufenden Präsentation.
- Ungespeicherte Arbeit geht **ohne Rückfrage** verloren.
- Eine aus Versehen fallen gelassene Datei zerstört ein Fenster (siehe „Navigation absperren“).

## Rahmenbedingungen

- Electron 33: `File.path` gibt es nicht mehr. Der Pfad kommt im Preload über
  `webUtils.getPathForFile(file)` (Muster in `apps/copy`, `apps/daw`, `apps/editor`).
  Der Preload läuft mit `sandbox: true`.
- electron-builder 24.13.3, NSIS mit `perMachine: false`: Der Installer schreibt nach HKCU,
  ohne Adminrechte. Der Launcher installiert still (`/S`), eigene Installer-Schritte müssen
  also auch still laufen.
- Mac-Builds sind nicht signiert (`hardenedRuntime: false`). Hier steht kein Mac; der Mac-Teil
  kann lokal nur am Build-Ergebnis geprüft werden, der echte Doppelklick braucht einen Mac.
- Eine laufende Präsentation ist eine Kopie im Hauptprozess (`present.ts`, `payload`).
  Änderungen am Editor-Projekt erreichen das Publikumsbild nicht. Das bleibt so.
- Der Presenter wird von der CI gebaut (Tag `presenter-v*` → Build + `latestVersion`).
  Während COP31 (ab 09.11.) nur im Fenster **18:00–06:00 Berlin** releasen.
- Auf dem Arbeitsrechner ist der Presenter vermutlich über den Launcher installiert. Ein
  Test-Installer darf ihn nicht ohne Rückfrage ersetzen (und schreibt in die echte HKCU).

## Wege (verglichen, gewählt)

**Hineinziehen: Pfade statt Bytes.** Das Fenster liefert nur die Pfade, der Hauptprozess liest
und wandelt um. *Gewählt*, weil Office ohnehin den Pfad für LibreOffice braucht und damit
Hineinziehen, Doppelklick und `PRESENTER OPEN` über denselben Weg laufen. *Verworfen:* Bytes im
Fenster lesen (`file.arrayBuffer()`); für Office bräuchte es trotzdem einen zweiten Weg.

**Windows-Anmeldung: eigene NSIS-Einträge.** Über `nsis.include` (`build/installer.nsh`,
Makros `customInstall`/`customUnInstall`). *Gewählt*, weil nur so der Presenter angeboten wird,
ohne `.pdf` zu übernehmen. *Verworfen:* `fileAssociations` von electron-builder für Windows. Ihr
Makro `APP_ASSOCIATE` (`templates/nsis/include/FileAssociation.nsh`) setzt den Standardwert von
`HKCU\Software\Classes\.pdf` auf die eigene ProgID. Auf Rechnern ohne `UserChoice` für `.pdf`
wird der Presenter dadurch still zum PDF-Programm (Anti-Ziel 1). *Verworfen:* Einträge beim
ersten App-Start schreiben; sie blieben nach der Deinstallation liegen.

**Mac-Anmeldung: `fileAssociations` nur im `mac:`-Block**, Rang `Alternate`. electron-builder
hängt plattformspezifische Zuordnungen nur an die eigene Plattform an
(`platformPackager.js`: `config.fileAssociations` + `platformSpecificBuildOptions.fileAssociations`),
der Windows-Installer sieht sie also nicht. Mit `Alternate` beansprucht der Presenter auf dem Mac
nichts von selbst.

**Doppelklick bei offenem Deck: Nachfragen (Owner-Wahl C, 13.11.).** *Verworfen:* immer ersetzen
(verliert ein Deck in Arbeit), immer anhängen (aus „zeig mir dieses PDF“ wird ein Mischdeck).

## Entwurf

### 1. Ein Lade-Weg im Hauptprozess

Eine Funktion nimmt eine Liste von Pfaden und liefert, was der Editor braucht: die gelesenen
Dateien (`ImportedFile[]`), ggf. ein `.jmpres`-Projekt und eine Liste von Hinweisen für
übersprungene Dateien. Die Einordnung nach Endung (PDF / Bild / Office / Projekt /
nicht unterstützt) ist eine reine Funktion, die `control-open.ts` und `ipc.ts` teilen
(heute stehen `IMAGE_EXT` und `OFFICE_EXT` doppelt da).

Office geht genau den Weg des Office-Knopfs (`files:importOffice` in `ipc.ts`): flach umwandeln,
bei `.pptx` die Aufbau-Animationen lesen und, wenn die Einstellung „Aufbau-Schritte aufteilen“
an ist, die aufgeteilte Fassung nehmen, sofern die Seitenzahl passt. Das Ergebnis im Editor ist
dasselbe wie beim Knopf, einschließlich der Folien-Notizen „▸ Original-Animation: …“ und der
Hinweiszeile. Der Knopf-Weg wird dafür so herausgelöst, dass er einen Pfad nimmt; der Dialog
bleibt davor. Mehrere Office-Dateien werden nacheinander umgewandelt.

`PRESENTER OPEN` verhält sich wie heute (ersetzt immer).

### 2. Hineinziehen ins Editor-Fenster (#298)

- **Ziel:** das ganze Editor-Fenster, auch der leere Startbildschirm.
- **Rückmeldung beim Ziehen:** Sobald Dateien über dem Fenster sind, liegt eine Fläche darüber:
  „Dateien hier ablegen – PDF, Bilder, PowerPoint“. Sie erscheint nur, wenn wirklich Dateien
  gezogen werden (`dataTransfer.types` enthält `Files`), nicht beim Umsortieren der Folien
  (`SlideList.tsx` nutzt eigenes Ziehen).
- **Ergebnis:** Die Dateien werden **hinten angehängt** (wie „PDF / Bilder importieren“), in der
  Reihenfolge, die das System liefert. Die Auswahl bleibt wie beim Knopf.
- **Nicht unterstützte Dateien** werden übersprungen. Die Fehlerzeile nennt sie mit Namen,
  z. B. „Nicht unterstützt, übersprungen: Video.mp4, Notizen.txt“. Der Rest wird importiert.
- **`.jmpres` allein abgelegt:** öffnet das Projekt (ersetzt). Liegen Folien vor und gibt es
  ungespeicherte Änderungen, kommt vorher dieselbe Rückfrage wie bei „Neu“.
  **`.jmpres` zusammen mit anderen Dateien:** das Projekt wird übersprungen (Hinweis), der Rest
  angehängt.
- **Während ein Import läuft** (`busy.active`): Ablegen wird ignoriert, mit kurzem Hinweis.
- **Startbildschirm:** Der Text nennt das Hineinziehen („…oder Dateien hierher ziehen“).

### 3. Navigation absperren (alle drei Fenster)

Electron lädt standardmäßig eine auf ein Fenster fallen gelassene Datei als Seite, wenn niemand
das Ablegen abfängt (Chromium-Verhalten; für den Presenter noch **nicht gemessen** — vor dem Fix
an der gepackten App einmal nachstellen und das Ergebnis im PR festhalten). Der Editor verlöre
sein ungespeichertes Projekt, die Publikumsansicht mitten in der Show ihr Bild. Darum:

- Im Hauptprozess wird jedes Wegnavigieren von der eigenen Seite verhindert (`will-navigate`),
  für Editor-, Referenten- und Publikumsfenster. Neu laden in der Entwicklung muss weiter gehen.
- In Referenten- und Publikumsansicht tut ein Ablegen schlicht nichts.

### 4. Doppelklick und „Öffnen mit“ (#299)

**Wie Pfade ankommen:**
- *Windows, App läuft nicht:* Pfad in `process.argv`.
- *Windows, App läuft:* zweite Instanz → `second-instance` mit deren `argv`. Die bestehende
  Behandlung (Fenster nach vorn) bleibt; dazu kommen die Pfade.
- *Mac:* Ereignis `open-file` (mit `preventDefault()`), kann vor `ready` und vor dem Fenster
  eintreffen. Der Zuhörer muss also früh hängen, Pfade werden bis zum Fenster gepuffert.
- Aus `argv` zählen nur Einträge, die vorhandene Dateien mit unterstützter Endung sind.
  Schalter (`--…`), `jmps://`-Links (die bleiben beim Show-Deep-Link-Weg) und die Exe selbst
  zählen nicht. Diese Auswahl ist eine reine, testbare Funktion.
- `@jm/app-runtime` hängt selbst schon an `second-instance` und `open-url` (Show-Deep-Links).
  Die neue Datei-Behandlung kommt daneben, darf nicht doppelt auslösen und keinen
  `jmps://`-Link schlucken (Prüfpunkt im Test: Start per Show-Link lädt weiter das `.jmpres`).
- **Sammeln:** Markiert jemand im Explorer mehrere PDFs und drückt Enter, startet Windows je Datei
  eine Instanz. Pfade, die kurz nacheinander ankommen (Größenordnung 0,5 s), werden zu **einem**
  Vorgang gebündelt, damit nur eine Frage kommt.

**Was der Editor damit tut (Owner-Wahl C):**
- Fenster nach vorn (wiederherstellen, zeigen, fokussieren).
- **Editor leer** (keine Folien): direkt laden, ohne Frage.
- **Folien vorhanden:** eine Frage im Editor-Fenster:
  > **„Bericht.pdf“ öffnen** (bzw. „3 PDFs öffnen“)
  > Im Presenter liegt schon eine Präsentation.
  > [Ersetzen] [Anhängen] [Abbrechen]

  Gibt es ungespeicherte Änderungen, steht dabei: „Beim Ersetzen gehen nicht gespeicherte
  Änderungen verloren.“ Eine zweite Rückfrage gibt es nicht.
- Läuft gerade eine Präsentation, bleibt das Publikumsbild unberührt (Kopie). Der Editor kommt
  nach vorn, weil jemand am Rechner gerade bewusst eine Datei geöffnet hat.
- Kommt ein neuer Vorgang an, während die Frage noch offen ist, werden seine Dateien der offenen
  Frage hinzugefügt (keine zweite Frage).
- Fehlt die Datei oder ist sie nicht lesbar: Fehlerzeile mit dem Namen, sonst nichts.

Die Nachricht an den Editor bekommt dafür eine Angabe, wie geöffnet wird: `ersetzen`
(`PRESENTER OPEN`), `anhaengen` (Hineinziehen) oder `fragen` (Doppelklick). Heute ist das ein
`replace: boolean` in `OpenFilesPayload`.

### 5. Anmeldung beim System

**Windows (Installer, HKCU, `build/installer.nsh`):**
- ProgID `JMPresenter.pdf`: Beschreibung „PDF-Dokument“, Symbol = App-Symbol,
  `shell\open\command` = `"<Installationsordner>\JM Presenter.exe" "%1"`.
- `Software\Classes\.pdf\OpenWithProgids` → Wert `JMPresenter.pdf` (für „Öffnen mit“).
- `Software\Classes\Applications\JM Presenter.exe` mit `SupportedTypes\.pdf` und
  `FriendlyAppName` „JM Presenter“.
- `Capabilities` (ApplicationName, ApplicationDescription, `FileAssociations\.pdf` =
  `JMPresenter.pdf`) und ein Eintrag unter `Software\RegisteredApplications`, damit der Presenter
  in Einstellungen › Apps › Standard-Apps auftaucht.
- **Nie** den Standardwert von `Software\Classes\.pdf` und nie `UserChoice` anfassen.
- Danach das System benachrichtigen (`SHChangeNotify` mit `SHCNE_ASSOCCHANGED`).
- Deinstallation entfernt genau diese Einträge. Bei einem Update (der alte Uninstaller läuft
  mit) dürfen sie nicht verschwinden bzw. müssen danach wieder stehen.

Ein Programm kann sich unter Windows 10/11 nicht selbst zum Standard machen. Das tut der Benutzer:
über „Öffnen mit › Andere App auswählen › Immer“ oder in den Einstellungen.

**Mac (`electron-builder.yml`, nur im `mac:`-Block):**
`fileAssociations: [{ ext: pdf, name: PDF, role: Viewer, rank: Alternate }]`.
Im fertigen `Info.plist` muss ein `CFBundleDocumentTypes`-Eintrag für PDF mit
`LSHandlerRank = Alternate` stehen; falls der Finder PDFs nur über den Inhaltstyp zuordnet,
zusätzlich `LSItemContentTypes = com.adobe.pdf`.

### 6. Release

Presenter **0.12.0**. Changelog- und Katalogtexte gehen vor dem Release zur Owner-Freigabe.
Tag-Push im COP-Fenster 18:00–06:00 Berlin.

## Prüfung

- Selbsttests (`npm run selftest`, Node 22 und 24) für die reinen Funktionen: Einordnung nach
  Endung, Auswahl der Pfade aus `argv`, Bündeln, Wahl des Öffnen-Modus.
- `npm run typecheck`.
- Vorher-Messung an der gepackten 0.11.0-Fassung: Was passiert heute beim Ablegen einer Datei
  auf Editor und Publikumsansicht?
- Gepackte App per CDP: Ablegen echter Dateien (`Input.dispatchDragEvent` mit `data.files`):
  PDF, Bild, `.pptx`, Mischung mit nicht unterstützter Datei, `.jmpres`; Ablegen auf die
  Publikumsansicht ändert nichts; Start mit PDF-Pfad in `argv`; zweite Instanz mit PDF bei
  leerem und bei gefülltem Editor (Frage erscheint, alle drei Knöpfe).
- Windows-Installer: die Einträge nach stiller Installation, nach Update und nach Deinstallation
  prüfen, ohne den installierten Presenter des Arbeitsrechners ungefragt zu ersetzen.
- Mac: `Info.plist` aus dem CI-Build lesen. Der echte Doppelklick im Finder braucht einen Mac
  und steht als offene Abnahme im PR.

## Dem Bauenden überlassen

- Wie der Office-Weg aus `ipc.ts` herausgelöst wird und wie die Animations-Notizen beim
  Hineinziehen ins Projekt kommen.
- Aussehen der Ablege-Fläche und der Frage im Stil der App (die Fragen sind heute
  `window.confirm`; eine eigene kleine Box mit drei Knöpfen ist nötig, weil `confirm` nur zwei hat).
- Genaue Sammelzeit beim Bündeln.
- Wie das Absperren der Navigation das Neuladen in der Entwicklung zulässt.
- Aufbau von `installer.nsh` im Einzelnen, solange die Einträge oben stimmen.

## Nachtrag zu §5 (beim Bauen entschieden)

- **ProgID** ist `${APP_ID}.pdf` (also `gmbh.jakobs.presenter.pdf`) statt `JMPresenter.pdf`. So überschreibt ein Prüfbau mit eigener `appId` nichts vom echten Presenter. Überall, wo oben `JMPresenter.pdf` steht, gilt dieser Name.
- **macOS** läuft über `mac.extendInfo.CFBundleDocumentTypes` (mit `LSHandlerRank: Alternate` und `LSItemContentTypes: [com.adobe.pdf]`) statt über `mac.fileAssociations`, weil electron-builder 24.13.3 dort kein `LSItemContentTypes` kennt. Das wirkt ebenfalls nur auf dem Mac.
