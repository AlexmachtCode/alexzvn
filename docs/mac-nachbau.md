# Mac-Nachbau aus einem bestehenden Tag

Der Workflow **Mac-Nachbau** (`.github/workflows/mac-nachbau.yml`) baut die Mac-Pakete eines Tools aus einem Tag, das es
schon gibt, und hängt sie an dessen Release. Er legt kein Release an, setzt kein neues Tag und hebt den Katalog nicht an:
`packages/suite-manifest/suite.json` nennt die Version schon, und der Release-Proxy liest die Releases bei jedem Aufruf neu.

Heute ist nur der **Editor** freigegeben (Stufe 1 des Entwurfs mac-fassungen, Owner-Freigabe 20.10.2026). Der Tag-Lauf
von `editor-v0.5.0` war an doppelten Schlüsseln in der Konfiguration gescheitert; ein Re-Run oder ein neues Tag nähme
wieder den Workflow aus dem Tag-Commit. Ein Hand-Start dagegen nimmt den Workflow von `main`. Entscheidungen, Belege und
Prüfschritte stehen im Umsetzungsplan `docs/superpowers/plans/2026-10-20-mac-nachbau-editor.md`; der Entwurf selbst
liegt nicht im Repo.

## Vor dem echten Lauf offen: der Lizenztext (Owner-Entscheid)

Auf diesem Stand kann der echte Lauf nie hochladen. install.js von ffmpeg-static legt als `ffmpeg.LICENSE` die Datei
`darwin-<Art>.LICENSE` aus dem Release b6.1.1 ab. Sie ist 4 346 B (x64) bzw. 4 376 B (arm64) groß. Der Sammler verlangt
einen GPL-Volltext mit mindestens 15 000 B (GPLv2 hat 17 984 B, GPLv3 35 147 B). Darum endet jeder Bau-Job im Sammler
rot, der Probelauf ebenso wie der echte Lauf. Das ist gewollt: Ohne GPL-Text wird nichts hochgeladen.

F2 (ii) ist in der freigegebenen Form also nicht erfüllbar. Vor dem echten Lauf braucht es:

1. den Entscheid des Owners, welcher Lizenztext beiliegt. Vorschlag im Plan: den GPLv3-Text aus
   `node_modules/ffmpeg-static/LICENSE` beilegen (35 149 B, im npm-Paket, über die Integrität im Lockfile gesichert)
   und die Mac-`ffmpeg.LICENSE` unter einem Namen mitgeben, der keinen GPL-Text verspricht;
2. die passende Änderung an Sammler, Asset-Namen, Workflow, Workflow-Test (R15, R25) und Quellen-Hinweis;
3. einen neuen Probelauf, der grün endet.

Was Mac-LICENSE und Mac-README wirklich enthalten, zeigt erst der erste Probelauf (Steckbrief, Schritt 1).

## Ablauf: drei Schritte, jeder nur mit Owner-OK

Zwei Läufe und dazwischen ein Commit. Gestartet wird immer auf `main`: Prüfer, Sammler, Lesestand und Quellen-Hinweis
kommen aus dem gestarteten Commit. Ein echter Lauf von einem anderen Zweig bricht darum vor dem Hochladen ab.

1. **Probelauf.** GitHub, Actions, Mac-Nachbau, Run workflow: Zweig `main`, tag `editor-v0.5.0`, probe angehakt
   (Vorgabe). Oder: `gh workflow run mac-nachbau.yml --ref main -f tag=editor-v0.5.0 -f probe=true`.
   Der Lauf baut und prüft beide Mac-Arten und lädt nichts hoch. Auf diesem Stand endet er im Sammler rot (siehe oben).
   Weil der Prüfer vor dem Sammler läuft, liefert er trotzdem alles für Schritt 2 und den Owner-Entscheid:
   - ob es beide Runner gibt und ob `npm ci` mit der Lockfile des Tags durchläuft;
   - je Art eine Warnung „Lesestand für editor 0.5.0 … ist leer“ mit den SHA-256 von ffmpeg und ffprobe und einem
     fertigen JSON-Stück;
   - Laufzeitprobe und minos von App-Programm und ffmpeg. Eine Warnung über macOS 11 hält keinen Lauf an; jede geht vor
     Schritt 3 an den Owner;
   - den Steckbrief des Sammlers: Größe, SHA-256 und die ersten Zeilen von LICENSE und README. Er zeigt den Wortlaut für
     den Owner-Entscheid. Er zeigt auch, ob die README die Angaben trägt, die der Quellen-Hinweis nennt (FFmpeg 6.1.1,
     evermeet.cx für x64, osxexperts.net für arm64). Weicht sie ab, wird der Hinweis mit Owner-OK berichtigt.
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
3. **Echter Lauf.** Vorher liegen der Owner-Entscheid zum Lizenztext und ein grüner Probelauf vor (siehe oben). Vorher,
   spätestens zugleich, steht der Hinweis für Nutzer (siehe unten) in `packages/suite-manifest/changelog.json` auf
   `main`: Wortlaut mit Owner-Freigabe, eigener Commit ohne Versions-Bump. Der echte Lauf wirkt nämlich sofort, der
   Proxy liefert 0.5.0 dann an Macs aus. Gestartet wird wie 1, auf `main`, aber probe abgehakt (`-f probe=false`). Erst
   wenn beide Bau-Jobs grün sind, hängt der Job hochladen die Dateien an das bestehende Release. Starten zwei echte Läufe
   zugleich, wartet der zweite Hochlade-Job, bis der erste fertig ist.

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
- Sammler `scripts/ci/sammle-ffmpeg-beilagen.mjs`: GPL-Text und Build-Angaben, die ffmpeg-static neben das Programm
  legt, müssen da sein und zum ffmpeg im Paket gehören; der GPL-Text muss ein Volltext sein (auf diesem Stand der
  Abbruch, siehe oben); ffmpeg-static muss 5.3.0 mit Binär-Release b6.1.1 sein, denn dafür ist der Quellen-Hinweis
  geschrieben. Größe, SHA-256 und Anfang von LICENSE und README stehen immer im Protokoll.

## Was am Release landet

Der Reihe nach, je ein eigener Upload: zuerst `JM.Editor-0.5.0-mac-x64.dmg`, dann `JM.Editor-0.5.0-mac-arm64.dmg`
(GitHub macht aus dem Leerzeichen einen Punkt). Danach, in einem dritten Aufruf, `ffmpeg-mac-x64.LICENSE.txt`,
`ffmpeg-mac-x64.README.txt`, `ffmpeg-mac-arm64.LICENSE.txt`, `ffmpeg-mac-arm64.README.txt` und `ffmpeg-QUELLEN.txt`
(Wortlaut: `scripts/ci/ffmpeg-quellen-hinweis.txt`). Die Beilagen enden auf `.txt` und passen nie auf die Paketwahl von
Proxy und Launcher, die nur `.dmg` bzw. `.exe` nimmt. Das DMG selbst bleibt wie im Tag; GPL-Text und Quellen liegen
nicht im Paket (vom Owner bewusst akzeptierte Restlücke, F2).

Die Reihenfolge verlangt der Auftrag. Ihr Grund im Entwurf war der alte Proxy, der einer Mac-Art das zuerst
hochgeladene DMG der anderen gab. Mit der Paketwahl seit 19.10.2026 (Proxy und Launcher) bekommt ein Intel-Mac nie ein
arm64-DMG, ein arm64-Mac aber das x64-DMG, solange am Release kein arm64-DMG hängt (Rosetta). Zwischen den Uploads gilt:

- Ein arm64-Mac, der genau dann installiert, bekommt das x64-Paket von 0.5.0 und behält es: Die Version ist dieselbe,
  ein Update kommt nicht mehr. Scheitert der arm64-Upload, bleibt das bis zum nächsten Lauf so. Ginge arm64 zuerst
  hoch, bliebe ein Intel-Mac in der Lücke einfach auf 0.4.0. Den Tausch entscheidet der Owner.
- Scheitert der dritte Upload, hängen beide DMGs schon am Release und werden ausgeliefert, aber ohne GPL-Text und
  Quellen-Hinweis. Dann den Job hochladen neu starten (Re-run failed jobs). Das geht nur, solange die Artefakte der
  Bau-Jobs leben, also einen Tag lang (`retention-days: 1`); danach hilft nur ein neuer echter Lauf. Ob die Beilagen
  zuerst hochgehen, entscheidet der Owner; die Paketwahl berühren sie nicht.

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
| fehlt: …/ffmpeg.LICENSE | install.js hat LICENSE oder README nicht geladen (bei 404 nur eine Warnung) |
| ffmpeg.LICENSE ist kein GPL-Volltext: … | Auf diesem Stand sicher (siehe oben): Steckbrief im Protokoll lesen, nicht hochladen; weiter erst nach Owner-Entscheid, Code-Änderung und neuem Probelauf |
| ffmpeg im Paket ist nicht das aus ffmpeg-static | LICENSE und README gehörten zu einem anderen Programm: nicht hochladen, Ursache klären |
| Quellen-Hinweis fehlt oder ist leer | `scripts/ci/ffmpeg-quellen-hinweis.txt` fehlt im gestarteten Commit oder ist leer |
| Hochladen nur aus einem Lauf von main | echter Lauf von einem anderen Zweig oder einem Tag gestartet: auf `main` neu starten; nichts hochgeladen |
| Für … genau ein DMG und vier Dateien erwartet | Hochlade-Job: Ein Bau-Artefakt hat zu viele oder zu wenige Dateien; nichts hochgeladen |
| DMG „…“ passt nicht zu Version … und Art … | Hochlade-Job: Ein Bau-Artefakt trägt ein DMG mit anderer Version oder Art; nichts hochgeladen |
| Beilage fehlt oder ist leer: … | Hochlade-Job: Einem Bau-Artefakt fehlt eine Beilage, oder sie ist leer; nichts hochgeladen |
| Der Quellen-Hinweis der beiden Bau-Jobs ist verschieden | Hochlade-Job: Die Artefakte passen nicht zusammen, obwohl beide Bau-Jobs den Hinweis aus demselben Commit holen; nichts hochgeladen, Ursache klären |
| Zum Tag … gibt es kein Release | der Workflow legt keins an |

## Eine App aufnehmen (später, Stufe 2)

`ERLAUBTE_APPS` im Workflow und `APPS` im Prüfer gemeinsam erweitern (der Selbsttest hält beide gleich; `APPS` gilt
auch für die Lesestand-Datei), Lesestand je Version und Art nachtragen, und für Apps mit NDI oder whisper fehlen die
Schritte aus Stufe 2 noch ganz. Wie beim Editor setzt der Prüfer heute ffmpeg und ffprobe im Paket voraus, der Sammler
ffmpeg aus ffmpeg-static 5.3.0; eine App ohne sie braucht dort einen eigenen Zweig.
