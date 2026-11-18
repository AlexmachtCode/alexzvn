# Presenter: weitere Bildformate (AVIF, SVG) – Entwurf (#313)

Stand 18.11.2026. Kleine Änderung, kurzer Entwurf. Umfang vom Owner freigegeben („passt“, 18.11. 10:02).

## Anlass und Ziel

Issue #313 (Crew, aus dem Launcher auf macOS): Eine WebP-Datei „wurde zwar abgelegt, ließ sich aber nicht anzeigen“; Wunsch nach mehr Formaten (WebP, HEIC/HEIF, AVIF, SVG, TIFF).
Ziel für JM Presenter 0.13.2 (Release 18.11. im Fenster 18–06): **AVIF** und **SVG** öffnen und zeigen – als Folie und als Bild-Overlay, auf allen Wegen (Ablegen, Doppelklick/„Öffnen mit“, Dialog, `PRESENTER OPEN`), in Publikums-, Referenten- und NDI-Ansicht und im PDF-Export.

## Nicht-Ziele

- TIFF (eigener Decoder nötig) und HEIC/HEIF (Decoder mit Lizenzfrage LGPL, unter Windows kein Systemweg) – nach der COP.
- Die WebP-Meldung selbst: WebP ist im Code auf allen Wegen schon erlaubt (`shared/dateien.ts`, `main/ipc.ts`, `main/control-open.ts`) und wird über Chromium dekodiert. Die Ursache ist ohne die Datei nicht bestimmbar; sie wird nachgezogen, sobald Datei, Presenter-Version und Ablageort vorliegen. Bis dahin prüft der Prüfstand, dass WebP in der echten App angezeigt wird.
- Doppelklick-Zuordnung von Bildern im Installer (heute nur `.pdf`) bleibt, wie sie ist.

## Heute

Ein Bild wird als Quelle `kind: 'image'` mit seinen Bytes gespeichert und an zwei Stellen dekodiert: Folien in `renderer/src/lib/pdf.ts` (`loadImage`), Overlays in `renderer/src/lib/paint.ts` (`ensureOverlayBitmaps`) – beide per `createImageBitmap(Blob ohne Typ)`. Chromium (Electron 33) erkennt PNG, JPEG, WebP, GIF, BMP und AVIF am Inhalt, **SVG nicht**. Die Endungen stehen in drei Listen (`shared/dateien.ts IMAGE_EXT`, `main/ipc.ts IMAGE_EXT`, `main/control-open.ts IMAGE_EXT`) plus zwei Dialogfiltern in `main/ipc.ts`, die schon heute voneinander abweichen (Filter ohne GIF/BMP).

## Ansätze für SVG

1. **Über ein `<img>` rastern (gewählt):** SVG-Bytes als `Blob` mit Typ `image/svg+xml` in ein `HTMLImageElement` laden und mit `createImageBitmap(img, { resizeWidth, resizeHeight })` in fester Größe rastern. Chromium führt in `<img>` keine Skripte aus und lädt keine externen Ressourcen; die CSP erlaubt `blob:`-Bilder schon. Kein neues Paket.
2. Eigener SVG-Renderer (z. B. canvg): neues Paket, weniger vollständig als Chromium. Verworfen.
3. Im Hauptprozess über `nativeImage`: kann SVG unter Windows nicht. Verworfen.

## Entscheidungen (meine Calls, im Rahmen der Freigabe)

- **Eine Endungsliste:** `shared/dateien.ts IMAGE_EXT` bekommt `.avif` und `.svg` und ist die einzige Liste; `main/ipc.ts` und `main/control-open.ts` nutzen sie, die Dialogfilter werden aus ihr gebildet (damit zeigen die Dialoge auch GIF/BMP, die beim Ablegen schon gingen).
- **Ein Dekodier-Helfer** für Folien und Overlays: erkennt SVG **am Inhalt** (nicht an der Endung – Projektdateien `.jmpres` tragen nur Bytes), alles andere wie bisher per `createImageBitmap(Blob)`.
- **Rastergröße SVG:** in **1920×1080** eingepasst, Seitenverhältnis bleibt. *(Geändert nach der Gesamtprüfung am 18.11.: ursprünglich 3840×2160 „für 4K-Ausgänge“ – aber kein Abnehmer zeichnet breiter als 1920 px: Publikum `SlideCanvas maxWidth 1920`, NDI 1920×1080, PDF-Ersatzraster 1920. 4K kostete je Folie und Fenster 33 statt 8 MB ohne sichtbaren Gewinn.)* Seitenverhältnis aus `width`/`height` des Wurzelelements (Zahl oder `px`), sonst aus `viewBox`, sonst 16:9. Ein SVG ohne verwertbare Größe wird also 3840×2160 gerastert.
- **Erkennung SVG:** erste 4 KiB als Text; nach BOM/Leerraum, XML-Kopf, Kommentaren und DOCTYPE muss `<svg` stehen. Gezippte `.svgz` sind nicht dabei.
- Fehler beim Dekodieren verhalten sich wie heute (Folie bleibt leer bzw. Overlay entfällt, Fehler im bestehenden Weg).

## Prüfen

- Selbsttest (Node): Endungen, SVG-Erkennung, Größen- und Rasterrechnung.
- Prüfstand in der echten App: AVIF, SVG mit Größe, SVG nur mit `viewBox`, WebP – je als Folie (nicht leer, Seitenverhältnis stimmt) und als Overlay; PDF-Export einer AVIF- und einer SVG-Folie liefert Seiten.
- Rauchtest des gebauten Windows-Pakets wie bei 0.13.1.

## Auslieferung

Version 0.13.2, Changelog-Text vorab zur Owner-Freigabe, Release per Windows-Aufgabe im Fenster 18–06 (Weg wie 0.13.1), Merge des PR erst nach dem Release.
