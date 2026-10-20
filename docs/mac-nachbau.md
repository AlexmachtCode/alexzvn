# Mac-Nachbau aus einem bestehenden Tag

Der Workflow **Mac-Nachbau** (`.github/workflows/mac-nachbau.yml`) baut die Mac-Pakete eines Tools aus einem Tag, das es
schon gibt, und hängt sie an dessen Release. Er legt kein Release an, setzt kein neues Tag und hebt den Katalog nicht an:
`packages/suite-manifest/suite.json` nennt die Version schon, und der Release-Proxy liest die Releases bei jedem Aufruf neu.

Heute ist nur der **Editor** freigegeben (Stufe 1 des Entwurfs mac-fassungen, Owner-Freigabe 20.10.2026). Der Tag-Lauf
von `editor-v0.5.0` war an doppelten Schlüsseln in der Konfiguration gescheitert; ein Re-Run oder ein neues Tag nähme
wieder den Workflow aus dem Tag-Commit. Ein Hand-Start dagegen nimmt den Workflow von `main`. Entscheidungen, Belege und
Prüfschritte stehen im Umsetzungsplan `docs/superpowers/plans/2026-10-20-mac-nachbau-editor.md`; der Entwurf selbst
liegt nicht im Repo.

## Owner-Entscheide vom 20.10.2026

Auf dem Mac legt install.js von ffmpeg-static als `ffmpeg.LICENSE` keinen GPL-Volltext ab, sondern FFmpegs eigene
Lizenz-Übersicht (`LICENSE.md` von FFmpeg, 4 346 B für x64, 4 376 B für arm64 im Release b6.1.1). Der alte Sammler
verlangte dort einen GPL-Volltext und brach darum jeden Lauf ab. Der Owner hat entschieden:

- **A, Lizenztexte:** Als GPL-Text liegt der GPLv3-Volltext aus dem npm-Paket selbst bei
  (`node_modules/ffmpeg-static/LICENSE`, 35 149 B, über die Integrität im Lockfile gesichert, nicht heruntergeladen), am
  Release als `ffmpeg-GPLv3.LICENSE.txt`, einer für beide Arten. Die Mac-`ffmpeg.LICENSE` geht weiter mit, unter einem
  Namen, der keinen GPL-Volltext verspricht: `ffmpeg-mac-<Art>.FFmpeg-Lizenzuebersicht.txt`. Die Mac-`ffmpeg.README`
  bleibt `ffmpeg-mac-<Art>.README.txt` (Build-Angaben).
- **B, Reihenfolge der Pakete:** zuerst das arm64-DMG, dann das x64-DMG, je ein eigener Upload (Grund unter „Was am
  Release landet“).
- **C, Beilagen zuerst:** Alle Beilagen gehen in einem Aufruf vor den DMGs hoch, damit nie ein DMG ohne Lizenztext am
  Release hängt.
- **D, Quellenangabe:** Die genaue FFmpeg-Fassung und den Link zum Quellcode trägt der Quellen-Hinweis erst nach dem
  Probelauf nach. Bis dahin steht dort „FFmpeg 6.1.1“. Die README für Intel (JSON von evermeet.cx im Release b6.1.1)
  zeigt aber auf FFmpeg 8.0. Welche Fassung im Paket steckt, belegt erst der Probelauf: Die Laufzeitprobe des Prüfers
  druckt die erste Zeile von `ffmpeg -version`.

## Ablauf: drei Schritte, jeder nur mit Owner-OK

Zwei Läufe und dazwischen ein Commit. Gestartet wird immer auf `main`: Prüfer, Sammler, Lesestand und Quellen-Hinweis
kommen aus dem gestarteten Commit. Ein echter Lauf von einem anderen Zweig bricht darum vor dem Hochladen ab.

1. **Probelauf.** GitHub, Actions, Mac-Nachbau, Run workflow: Zweig `main`, tag `editor-v0.5.0`, probe angehakt
   (Vorgabe). Oder: `gh workflow run mac-nachbau.yml --ref main -f tag=editor-v0.5.0 -f probe=true`.
   Der Lauf baut und prüft beide Mac-Arten und lädt nichts hoch. Er liefert alles für Schritt 2 und Owner-Entscheid D:
   - ob es beide Runner gibt und ob `npm ci` mit der Lockfile des Tags durchläuft;
   - je Art eine Warnung „Lesestand für editor 0.5.0 … ist leer“ mit den SHA-256 von ffmpeg und ffprobe und einem
     fertigen JSON-Stück;
   - Laufzeitprobe und minos von App-Programm und ffmpeg. Eine Warnung über macOS 11 hält keinen Lauf an; jede geht vor
     Schritt 3 an den Owner;
   - den Steckbrief des Sammlers: Größe, SHA-256 und die ersten Zeilen von `ffmpeg.LICENSE` (Lizenz-Übersicht) und
     `ffmpeg.README`, dazu Größe und SHA-256 von `ffmpeg-static/LICENSE` (GPLv3). Zusammen mit der Laufzeitprobe zeigt er,
     ob der Quellen-Hinweis stimmt (FFmpeg 6.1.1, evermeet.cx für x64, osxexperts.net für arm64). Die genaue Fassung und
     den Quellcode-Link trägt der Hinweis danach mit Owner-OK nach (Entscheid D).
2. **Lesestand nachtragen.** Zuerst die Gegenprobe für ffprobe: Im arm64-Job muss der gemessene Wert
   `5b592e56f87ff754d94dadf99f38b4d0fb7d463eb780b50e0ca061d668d0e3f7` sein, im x64-Job
   `90fddf93d25a520bbda09e02f1f53a91f04acd1ef9b79e6dc602dc4dc6951f67` (lokal an ffprobe-static 3.1.0 gemessen, gleiche
   Lock-Integrität wie im Tag). Weicht ein Wert ab, wird nicht nachgetragen, sondern erst die Ursache geklärt. Für ffmpeg
   gibt es keine solche Gegenprobe: ffmpeg-static lädt es ohne Prüfsumme, der erste gemessene Wert beruht also auf
   Vertrauen. Ab dem Commit hält der Lesestand ihn fest.
   Dann die beiden JSON-Stücke (arm64 und x64) zusammen in `scripts/ci/mac-nachbau-lesestand.json` eintragen, als eigener
   Commit auf `main` (per PR, wie üblich), mit Owner-OK. Form:
   `{ "editor": { "0.5.0": { "arm64": { "ffmpeg": "…", "ffprobe": "…" }, "x64": { "ffmpeg": "…", "ffprobe": "…" } } } }`.
   Den Schlüssel `editor` gibt es dabei nur einmal: Wer die Stücke einfach hintereinander setzt, hat zweimal `editor`,
   und JSON.parse behielte still nur das letzte. Der Selbsttest in ci-checks prüft die Datei darum im PR (gültiges
   JSON, kein doppelter Schlüssel, nur freigegebene Apps, Versionen x.y.z, Arten arm64 und x64, je ffmpeg und ffprobe
   als SHA-256 in Kleinbuchstaben), und der Prüfer bricht bei so einer Datei jeden Lauf ab, auch den Probelauf.
   Ab jetzt bricht jeder Lauf ab, wenn ffmpeg oder ffprobe abweichen (ffmpeg-static lädt ohne Prüfsumme).
3. **Echter Lauf.** Vorher liegt ein grüner Probelauf vor. Der echte Lauf lädt den Quellen-Hinweis aus dem gestarteten
   Commit hoch; was Entscheid D daran ändert, steht also vorher auf `main`. Vorher, spätestens zugleich, steht der
   Hinweis für Nutzer (siehe unten) in `packages/suite-manifest/changelog.json` auf `main`: Wortlaut mit
   Owner-Freigabe, eigener Commit ohne Versions-Bump. Der echte Lauf wirkt nämlich sofort, der Proxy liefert 0.5.0 dann
   an Macs aus. Gestartet wird wie 1, auf `main`, aber probe abgehakt (`-f probe=false`). Erst wenn beide Bau-Jobs grün
   sind, hängt der Job hochladen die Dateien an das bestehende Release. Starten zwei echte Läufe zugleich, wartet der
   zweite Hochlade-Job, bis der erste fertig ist.

Danach:

- **Nachkontrolle:** Der Proxy liefert für Mac arm64 und x64 die Version 0.5.0 mit dem passenden DMG (Trockenlauf
  `services/release-proxy/tools/trockenlauf.mjs`, mit Owner-OK). Auf einem Mac mit einem Editor, den der Launcher
  installiert hat, steht „Update auf 0.5.0“ an.
- **Nachabnahme nach F3:** Sobald ein Mac zur Hand ist: Start, Import, Export. Erst dabei läuft auf Apple Silicon das
  ffprobe aus dem arm64-Paket (siehe unten), und erst dabei zählt das DMG selbst; der Prüfer liest den App-Ordner, aus
  dem electron-builder das DMG baut.
- **Wiederholen:** Ein neuer echter Lauf baut neu und überschreibt alle Dateien am Release (`--clobber`). ffmpeg und
  ffprobe hält der Lesestand fest, das übrige DMG nicht. Darum nur mit Owner-OK.

## Was jeder Bau-Job prüft

- arm64 läuft auf `macos-26`, x64 auf `macos-26-intel`, und Node muss dieselbe Art haben. ffmpeg-static lädt ffmpeg nur
  für die Art des Bau-Rechners; ein Intel-Paket vom arm64-Runner hätte ein arm64-ffmpeg.
- Version in `apps/<app>/package.json` gleich der Tag-Version; die Konfiguration aus dem Tag trägt `electronVersion` und
  `npmRebuild: false` selbst und bleibt unverändert.
- Prüfer `scripts/ci/pruefe-mac-nachbau.mjs`: Lesestand-Datei gültig (wie in Schritt 2); genau ein DMG (das der
  Job-Art) und genau eine App; App-Programm und ffmpeg in der Job-Art; ffprobe im arm64-Paket als gedruckte Ausnahme
  x86_64 (ffprobe-static 3.1.0 hat kein arm64-Programm, auf Apple Silicon braucht der Import Rosetta 2); SHA-256 gegen
  den Lesestand; `ffmpeg -version` muss starten. Im Intel-Job startet auch `ffprobe -version`, und zwar das ffprobe des
  Intel-Pakets (`bin/darwin/x64` von ffprobe-static, FFmpeg 4.0.2). Das ffprobe im arm64-Paket (`bin/darwin/arm64`,
  FFmpeg 4.4-tessus, ein x86_64-Programm) startet in der CI nie; gesichert ist es nur über den SHA-256, laufen sieht man
  es erst bei der Nachabnahme. minos von App-Programm und ffmpeg wird gedruckt, über macOS 11 gibt es eine Warnung.
- Sammler `scripts/ci/sammle-ffmpeg-beilagen.mjs`: `ffmpeg-static/LICENSE` muss der GPLv3-Volltext sein (Kopf
  „GNU GENERAL PUBLIC LICENSE“, „Version 3“ in der zweiten Zeile, mindestens 15 000 B, Schluss „END OF TERMS AND
  CONDITIONS“). Lizenz-Übersicht (`ffmpeg.LICENSE`) und Build-Angaben (`ffmpeg.README`), die install.js neben das
  Programm legt, müssen da sein, Text tragen und zum ffmpeg im Paket gehören; die Übersicht muss „FFmpeg“ und „General
  Public License“ nennen. ffmpeg-static muss 5.3.0 mit Binär-Release b6.1.1 sein, denn dafür ist der Quellen-Hinweis
  geschrieben. Größe, SHA-256 und Anfang von Übersicht und README, dazu Größe und SHA-256 des GPLv3-Texts stehen immer
  im Protokoll.

## Was am Release landet

Der Reihe nach, je ein eigener Upload (Owner-Entscheide C und B):

1. alle Beilagen in einem Aufruf: `ffmpeg-GPLv3.LICENSE.txt` (GPLv3-Volltext aus dem npm-Paket ffmpeg-static),
   `ffmpeg-QUELLEN.txt` (Wortlaut: `scripts/ci/ffmpeg-quellen-hinweis.txt`), `ffmpeg-mac-arm64.FFmpeg-Lizenzuebersicht.txt`,
   `ffmpeg-mac-arm64.README.txt`, `ffmpeg-mac-x64.FFmpeg-Lizenzuebersicht.txt` und `ffmpeg-mac-x64.README.txt`;
2. `JM.Editor-0.5.0-mac-arm64.dmg`;
3. `JM.Editor-0.5.0-mac-x64.dmg` (GitHub macht aus dem Leerzeichen einen Punkt).

Jeder Bau-Job legt fünf Dateien ins Artefakt: sein DMG, den GPLv3-Text, Lizenz-Übersicht, README und den
Quellen-Hinweis. GPLv3-Text und Quellen-Hinweis müssen in beiden Artefakten Byte für Byte gleich sein und gehen nur
einmal hoch. Die Beilagen enden auf `.txt` und passen nie auf die Paketwahl von Proxy und Launcher, die nur `.dmg`
bzw. `.exe` nimmt. Das DMG selbst bleibt wie im Tag; GPL-Text und Quellen liegen nicht im Paket (vom Owner bewusst
akzeptierte Restlücke, F2).

Mit der Paketwahl seit 19.10.2026 (Proxy und Launcher) bekommt ein Intel-Mac nie ein arm64-DMG, ein arm64-Mac aber das
x64-DMG, solange am Release kein arm64-DMG hängt (Rosetta). Darum geht arm64 zuerst. Zwischen den Uploads gilt:

- Scheitert der Beilagen-Upload, hängt noch kein DMG am Release, und nichts wird ausgeliefert.
- Zwischen arm64- und x64-Upload bekommt ein arm64-Mac schon 0.5.0 für arm64, ein Intel-Mac noch 0.4.0. Scheitert der
  x64-Upload, bleibt das bis zum Neustart so.
- In beiden Fällen den Job hochladen neu starten (Re-run failed jobs); `--clobber` ersetzt, was schon hängt. Das geht
  nur, solange die Artefakte der Bau-Jobs leben, also einen Tag lang (`retention-days: 1`); danach hilft nur ein neuer
  echter Lauf.

Hinweise für Nutzer (Quarantäne beim Laden von Hand, Rosetta für ffprobe) kommen als Eintrag in
`packages/suite-manifest/changelog.json`, vor dem echten Lauf (Ablauf, Schritt 3). Der Launcher zeigt diese Notes,
nicht die von GitHub; der Proxy liest `changelog.json` bei jedem Aufruf aus `main`.

## Fehlerbilder

| Meldung | Bedeutung |
|---|---|
| Tag „…“ hat nicht die Form ‹App›-v‹Version› | Eingabe tag falsch geschrieben (richtig etwa `editor-v0.5.0`); nichts gebaut |
| App „…“ ist für den Nachbau nicht freigegeben | Tag einer App außerhalb von `ERLAUBTE_APPS` |
| `fatal: couldn't find remote ref refs/tags/…` (Schritt „Quellen aus dem Tag und Prüfer holen“) | Das Tag gibt es auf GitHub nicht (Tippfehler oder nicht gepusht); nichts gebaut |
| Der Job für x64 läuft mit Node für arm64 | Runner-Label zeigt auf die falsche Art |
| apps/…/package.json nennt …, das Tag … | Die Version im Tag passt nicht zum Tag-Namen: falsches Tag, nichts gebaut |
| … trägt kein electronVersion … (oder kein npmRebuild: false) | Die Konfiguration im Tag trägt die Schlüssel nicht selbst, und der Workflow hängt bewusst nichts an: Owner fragen |
| Lesestand „…“ ungültig: … | Die Datei ist kaputt (kein JSON, doppelter Schlüssel, fremde App, Version oder Art); der Selbsttest in ci-checks zeigt dasselbe. Datei berichtigen, mit Owner-OK |
| genau ein DMG „…“ erwartet | electron-builder hat mehr oder andere Pakete gebaut |
| genau eine App „…“ erwartet | electron-builder hat keine, mehrere oder eine anders benannte App gebaut |
| App-Programm fehlt, ffmpeg fehlt oder ffprobe fehlt: … | Das Programm liegt nicht an seinem Platz (`Contents/MacOS` bzw. `Contents/Resources/bin/mac`); bei ffmpeg und ffprobe hat prepackage nicht gebündelt |
| … ist kein Mach-O-Programm | An der Stelle liegt kein Mac-Programm |
| App-Programm hat …, erwartet … | Electron in der falschen Art im Paket |
| ffmpeg hat arm64, erwartet x64 | falsches ffmpeg im Paket, der Fehler aus dem Juni |
| ffprobe hat …, erwartet … | ffprobe-static hat ein anderes Programm geliefert; erlaubt ist die Job-Art, im arm64-Job dazu nur x86_64 |
| Lesestand … ist leer; ohne Lesestand wird nicht hochgeladen | echter Lauf vor dem Lesestand-Commit |
| Lesestand … ist unvollständig oder ungültig | Der Eintrag für diese App, Version und Art ist halb oder kein SHA-256 in Kleinbuchstaben: Lesestand-Commit prüfen |
| SHA-256 von ffmpeg weicht vom Lesestand ab | ffmpeg-static hat ein anderes Programm geladen: nicht hochladen, Ursache klären |
| Laufzeitprobe: ffmpeg -version endete mit … (im Intel-Job auch ffprobe) | Das Programm startet auf dem Runner nicht. Nach F3 ersetzt diese Probe die Abnahme auf einem echten Mac: nicht hochladen, Owner fragen |
| Laufzeitprobe und minos fehlen (nur unter macOS) | echter Lauf, aber der Prüfer lief nicht unter macOS: ohne Laufzeitprobe wird nicht hochgeladen |
| ffmpeg-static …, der Quellen-Hinweis ist für 5.3.0 geschrieben (oder Binär-Release …, … für b6.1.1) | Die Lockfile des Tags bringt eine andere Fassung als die, für die der Hinweis geschrieben ist: Hinweis und Sammler mit Owner-OK nachziehen |
| FFMPEG_BIN ist gesetzt (oder FFMPEG_BINARY_RELEASE, FFMPEG_BINARIES_URL) | Eine Umlenkung von ffmpeg-static steht in der Umgebung von Runner oder Workflow; der Hinweis gälte dann nicht: Umlenkung entfernen |
| fehlt: …/ffmpeg.LICENSE (oder …/ffmpeg.README) | install.js hat Lizenz-Übersicht oder README nicht geladen (bei 404 nur eine Warnung) |
| fehlt: …/ffmpeg-static/LICENSE | Dem npm-Paket ffmpeg-static fehlt sein GPLv3-Text: nicht hochladen, Ursache klären |
| ffmpeg-static/LICENSE ist kein GPLv3-Volltext: … | Das npm-Paket trägt einen anderen Lizenztext als den GPLv3-Volltext (Kopf, Version 3, Länge oder Schluss passen nicht): nicht hochladen, Owner fragen |
| ffmpeg.LICENSE ist leer; erwartet ist FFmpegs Lizenz-Übersicht | install.js hat zur Mac-Fassung eine leere Lizenz-Datei abgelegt: Steckbrief lesen, nicht hochladen |
| ffmpeg.LICENSE ist nicht FFmpegs Lizenz-Übersicht: ohne … | Die Lizenz-Datei zur Mac-Fassung nennt FFmpeg oder die General Public License nicht. Auch ein GPL-Volltext an dieser Stelle (wie unter Windows) endet so, weil der Name am Release „Lizenzuebersicht“ sagt: Steckbrief lesen, Owner fragen |
| ffmpeg.README ist leer | install.js hat leere Build-Angaben abgelegt: nicht hochladen |
| ffmpeg im Paket ist nicht das aus ffmpeg-static | Lizenz-Übersicht und README gehörten zu einem anderen Programm: nicht hochladen, Ursache klären |
| Quellen-Hinweis fehlt oder ist leer | `scripts/ci/ffmpeg-quellen-hinweis.txt` fehlt im gestarteten Commit oder ist leer |
| Hochladen nur aus einem Lauf von main | echter Lauf von einem anderen Zweig oder einem Tag gestartet: auf `main` neu starten; nichts hochgeladen |
| Für … genau ein DMG und fünf Dateien erwartet | Hochlade-Job: Ein Bau-Artefakt hat zu viele oder zu wenige Dateien; nichts hochgeladen |
| DMG „…“ passt nicht zu Version … und Art … | Hochlade-Job: Ein Bau-Artefakt trägt ein DMG mit anderer Version oder Art; nichts hochgeladen |
| Beilage fehlt oder ist leer: … | Hochlade-Job: Einem Bau-Artefakt fehlt eine Beilage, oder sie ist leer; nichts hochgeladen |
| Der Quellen-Hinweis der beiden Bau-Jobs ist verschieden | Hochlade-Job: Die Artefakte passen nicht zusammen, obwohl beide Bau-Jobs den Hinweis aus demselben Commit holen; nichts hochgeladen, Ursache klären |
| Der GPLv3-Text der beiden Bau-Jobs ist verschieden | Hochlade-Job: Die Bau-Jobs hatten verschiedene ffmpeg-static-Pakete, obwohl beide dieselbe Lockfile aus dem Tag nutzen; nichts hochgeladen, Ursache klären |
| Zum Tag … gibt es kein Release | der Workflow legt keins an |

## Eine App aufnehmen (später, Stufe 2)

`ERLAUBTE_APPS` im Workflow und `APPS` im Prüfer gemeinsam erweitern (der Selbsttest hält beide gleich; `APPS` gilt
auch für die Lesestand-Datei), Lesestand je Version und Art nachtragen, und für Apps mit NDI oder whisper fehlen die
Schritte aus Stufe 2 noch ganz. Wie beim Editor setzt der Prüfer heute ffmpeg und ffprobe im Paket voraus, der Sammler
ffmpeg aus ffmpeg-static 5.3.0; eine App ohne sie braucht dort einen eigenen Zweig.
