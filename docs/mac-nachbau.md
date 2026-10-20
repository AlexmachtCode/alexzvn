# Mac-Nachbau aus einem bestehenden Tag

Der Workflow **Mac-Nachbau** (`.github/workflows/mac-nachbau.yml`) baut die Mac-Pakete eines Tools aus einem Tag, das es
schon gibt, und hängt sie an dessen Release. Er legt kein Release an, setzt kein neues Tag und hebt den Katalog nicht an:
`packages/suite-manifest/suite.json` nennt die Version schon, und der Release-Proxy liest die Releases bei jedem Aufruf neu.

Heute ist nur der **Editor** freigegeben (Stufe 1 des Entwurfs mac-fassungen, Owner-Freigabe 20.10.2026). Der Tag-Lauf
von `editor-v0.5.0` war an doppelten Schlüsseln in der Konfiguration gescheitert; ein Re-Run oder ein neues Tag nähme
wieder den Workflow aus dem Tag-Commit. Ein Hand-Start dagegen nimmt den Workflow von `main`. Entscheidungen, Belege und
Prüfschritte stehen im Umsetzungsplan `docs/superpowers/plans/2026-10-20-mac-nachbau-editor.md`; der Entwurf selbst
liegt nicht im Repo.

## Ablauf: drei Läufe, jeder nur mit Owner-OK

1. **Probelauf.** GitHub, Actions, Mac-Nachbau, Run workflow: Zweig `main`, tag `editor-v0.5.0`, probe angehakt
   (Vorgabe). Oder: `gh workflow run mac-nachbau.yml -f tag=editor-v0.5.0 -f probe=true`.
   Der Lauf baut und prüft beide Mac-Arten und lädt nichts hoch. Solange der Lesestand leer ist, endet er grün mit je
   einer Warnung, die die gemessenen SHA-256 von ffmpeg und ffprobe nennt, samt fertigem JSON-Stück. Bricht danach der
   Sammler ab (siehe Fehlerbilder), ist der Lauf rot; die Warnung mit den SHA-256 steht trotzdem im Protokoll, weil der
   Prüfer vorher läuft.
2. **Lesestand nachtragen.** Die beiden JSON-Stücke (arm64 und x64) zusammen in `scripts/ci/mac-nachbau-lesestand.json`
   eintragen, als eigener Commit auf `main` (per PR, wie üblich), mit Owner-OK. Form:
   `{ "editor": { "0.5.0": { "arm64": { "ffmpeg": "…", "ffprobe": "…" }, "x64": { "ffmpeg": "…", "ffprobe": "…" } } } }`.
   Den Schlüssel `editor` gibt es dabei nur einmal: Wer die Stücke einfach hintereinander setzt, hat zweimal `editor`,
   und JSON.parse behielte still nur das letzte. Der Selbsttest in ci-checks prüft die Datei darum im PR (gültiges
   JSON, kein doppelter Schlüssel, nur freigegebene Apps, Versionen x.y.z, Arten arm64 und x64, je ffmpeg und ffprobe
   als SHA-256 in Kleinbuchstaben), und der Prüfer bricht bei so einer Datei jeden Lauf ab, auch den Probelauf.
   Ab jetzt bricht jeder Lauf ab, wenn ffmpeg oder ffprobe abweichen (ffmpeg-static lädt ohne Prüfsumme).
3. **Echter Lauf.** Vorher, spätestens zugleich, steht der Hinweis für Nutzer (siehe unten) in
   `packages/suite-manifest/changelog.json` auf `main`: Wortlaut mit Owner-Freigabe, eigener Commit ohne Versions-Bump.
   Der echte Lauf wirkt nämlich sofort, der Proxy liefert 0.5.0 dann an Macs aus. Gestartet wird wie 1, aber probe
   abgehakt (`-f probe=false`). Erst wenn beide Bau-Jobs grün sind, hängt der Job hochladen die Dateien an das
   bestehende Release.

## Was jeder Bau-Job prüft

- arm64 läuft auf `macos-26`, x64 auf `macos-26-intel`, und Node muss dieselbe Art haben. ffmpeg-static lädt ffmpeg nur
  für die Art des Bau-Rechners; ein Intel-Paket vom arm64-Runner hätte ein arm64-ffmpeg.
- Version in `apps/<app>/package.json` gleich der Tag-Version; die Konfiguration aus dem Tag trägt `electronVersion` und
  `npmRebuild: false` selbst und bleibt unverändert.
- Prüfer `scripts/ci/pruefe-mac-nachbau.mjs`: Lesestand-Datei gültig (wie in Schritt 2); genau ein DMG (das der
  Job-Art) und genau eine App; App-Programm und ffmpeg in der Job-Art; ffprobe im arm64-Paket als gedruckte Ausnahme
  x86_64 (ffprobe-static 3.1.0 hat kein arm64-Programm, auf Apple Silicon braucht der Import Rosetta 2); SHA-256 gegen
  den Lesestand; `ffmpeg -version` muss starten, im Intel-Job auch `ffprobe -version`; minos von App-Programm und
  ffmpeg wird gedruckt, über macOS 11 gibt es eine Warnung.
- Sammler `scripts/ci/sammle-ffmpeg-beilagen.mjs`: GPL-Text und Build-Angaben, die ffmpeg-static neben das Programm
  legt, müssen da sein und zum ffmpeg im Paket gehören; der GPL-Text muss ein Volltext sein; ffmpeg-static muss 5.3.0
  mit Binär-Release b6.1.1 sein, denn dafür ist der Quellen-Hinweis geschrieben. Größe, SHA-256 und Anfang von LICENSE
  und README stehen immer im Protokoll.

## Was am Release landet

Der Reihe nach, je ein eigener Upload: zuerst `JM.Editor-0.5.0-mac-x64.dmg`, dann `JM.Editor-0.5.0-mac-arm64.dmg`
(GitHub macht aus dem Leerzeichen einen Punkt). Ein arm64-Mac kann das x64-Paket unter Rosetta starten, ein Intel-Mac
das arm64-Paket nie. Danach, in einem dritten Aufruf, `ffmpeg-mac-x64.LICENSE.txt`, `ffmpeg-mac-x64.README.txt`,
`ffmpeg-mac-arm64.LICENSE.txt`, `ffmpeg-mac-arm64.README.txt` und `ffmpeg-QUELLEN.txt` (Wortlaut:
`scripts/ci/ffmpeg-quellen-hinweis.txt`). Die Beilagen enden auf `.txt` und passen nie auf die Paketwahl von Proxy und
Launcher, die nur `.dmg` bzw. `.exe` nimmt. Das DMG selbst bleibt wie im Tag; GPL-Text und Quellen liegen nicht im
Paket (vom Owner bewusst akzeptierte Restlücke, F2).

Hinweise für Nutzer (Quarantäne beim Laden von Hand, Rosetta für ffprobe) kommen als Eintrag in
`packages/suite-manifest/changelog.json`, vor dem echten Lauf (Ablauf, Schritt 3). Der Launcher zeigt diese Notes,
nicht die von GitHub; der Proxy liest `changelog.json` bei jedem Aufruf aus `main`.

## Fehlerbilder

| Meldung | Bedeutung |
|---|---|
| App „…“ ist für den Nachbau nicht freigegeben | Tag einer App außerhalb von `ERLAUBTE_APPS` |
| Der Job für x64 läuft mit Node für arm64 | Runner-Label zeigt auf die falsche Art |
| apps/…/package.json nennt …, das Tag … | Die Version im Tag passt nicht zum Tag-Namen: falsches Tag, nichts gebaut |
| … trägt kein electronVersion … (oder kein npmRebuild: false) | Die Konfiguration im Tag trägt die Schlüssel nicht selbst, und der Workflow hängt bewusst nichts an: Owner fragen |
| Lesestand „…“ ungültig: … | Die Datei ist kaputt (kein JSON, doppelter Schlüssel, fremde App, Version oder Art); der Selbsttest in ci-checks zeigt dasselbe. Datei berichtigen, mit Owner-OK |
| genau ein DMG „…“ erwartet | electron-builder hat mehr oder andere Pakete gebaut |
| ffmpeg hat arm64, erwartet x64 | falsches ffmpeg im Paket, der Fehler aus dem Juni |
| Lesestand … ist leer; ohne Lesestand wird nicht hochgeladen | echter Lauf vor dem Lesestand-Commit |
| Lesestand … ist unvollständig oder ungültig | Der Eintrag für diese App, Version und Art ist halb oder kein SHA-256 in Kleinbuchstaben: Lesestand-Commit prüfen |
| SHA-256 von ffmpeg weicht vom Lesestand ab | ffmpeg-static hat ein anderes Programm geladen: nicht hochladen, Ursache klären |
| Laufzeitprobe: ffmpeg -version endete mit … (im Intel-Job auch ffprobe) | Das Programm startet auf dem Runner nicht. Nach F3 ersetzt diese Probe die Abnahme auf einem echten Mac: nicht hochladen, Owner fragen |
| Laufzeitprobe und minos fehlen (nur unter macOS) | echter Lauf, aber der Prüfer lief nicht unter macOS: ohne Laufzeitprobe wird nicht hochgeladen |
| fehlt: …/ffmpeg.LICENSE | install.js hat LICENSE oder README nicht geladen (bei 404 nur eine Warnung) |
| ffmpeg.LICENSE ist kein GPL-Volltext: … | ffmpeg-static hat keinen GPL-Volltext neben das Programm gelegt; Steckbrief im Protokoll lesen, nicht hochladen, Owner fragen |
| ffmpeg im Paket ist nicht das aus ffmpeg-static | LICENSE und README gehörten zu einem anderen Programm: nicht hochladen, Ursache klären |
| Für … genau ein DMG und vier Dateien erwartet | Hochlade-Job: Ein Bau-Artefakt hat zu viele oder zu wenige Dateien; nichts hochgeladen |
| Der Quellen-Hinweis der beiden Bau-Jobs ist verschieden | Hochlade-Job: Die Artefakte passen nicht zusammen, obwohl beide Bau-Jobs den Hinweis aus demselben Commit holen; nichts hochgeladen, Ursache klären |
| Zum Tag … gibt es kein Release | der Workflow legt keins an |

## Eine App aufnehmen (später, Stufe 2)

`ERLAUBTE_APPS` im Workflow und `APPS` im Prüfer gemeinsam erweitern (der Selbsttest hält beide gleich; `APPS` gilt
auch für die Lesestand-Datei), Lesestand je Version und Art nachtragen, und für Apps mit NDI oder whisper fehlen die
Schritte aus Stufe 2 noch ganz. Wie beim Editor setzt der Prüfer heute ffmpeg und ffprobe im Paket voraus, der Sammler
ffmpeg aus ffmpeg-static 5.3.0; eine App ohne sie braucht dort einen eigenen Zweig.
