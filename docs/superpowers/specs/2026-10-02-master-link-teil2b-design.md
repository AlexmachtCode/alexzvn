# Master-Link, Teil 2b: Der Titler hält seinen Speaker, Show-Daten über den Verbund

**Stand:** 02.10.2026, **Entwurf** zur Freigabe durch den Owner.
**Anlass:** Zwei offene Punkte aus 2a. Eine Bauchbinde auf Sendung wechselt den Namen, wenn sich die Speaker-Liste verschiebt (gemessen: Alan → Grace, 2a-Spec 6.4). Tools auf einem zweiten Rechner lesen weiter ihre eigene Show-Datei (2a-Spec 12).
**Vorgänger:** Teil 2a (Merge `9844722450`, released 02.10.2026: Launcher 0.13.0, Timer 0.13.0, Rundown 0.6.0, dazu Launcher 0.13.1). Teil 1 (PR #239, released 01.10.2026: Launcher 0.12.0, Timer 0.12.0, Titler 0.9.0). Die Zwei-PC-Abnahme von Teil 1 ist bestanden (`packages/master-link/ABNAHME.md`, 02.10.2026).
**Bezug:** #235. 2a hat es am Einzelplatz behoben. Über das Netz trägt es erst 2b (2a-Spec `:5`).
**Zyklusplan:** Ansatz A „Stern zum Master“, Teile 0 → 1 → 2 → 3 → 4. Teil 2 ist geteilt (Owner 01.10.2026): **2a** feste Kennungen + Abgleich (released) → **2b** Show-Daten über den Master-Link (diese Spec) → **2c** iveo-Live je Bühne (Prod). Präsentationen, Materialien und Fotos folgen in einem eigenen Zyklus.
**Eine Spec, zwei Releases** (Owner 02.10.2026): zuerst **Release 1 „Titler hält seinen Speaker“** (Einzelplatz, kein Netz-Code), dann **Release 2 „Show-Daten über den Verbund“**.
**Ziel in einem Satz:** Eine Bauchbinde auf Sendung zeigt nie unbemerkt eine andere Person, und Timer, Titler und Rundown auf einem gekoppelten Rechner arbeiten mit der Show, die am Master offen ist.

**Nicht-Ziele von 2b:**
- Anmeldung am Timer-Socket `:7777`
- Dokumente, Medien, Fotos, Präsentationen (eigener Zyklus)
- Connect als Empfänger von Speakern über den Verbund. Connect liest weiter beim Show-Deep-Link.
- „Zuletzt gefunden“ in Q&A und Battle
- iveo-Live je Bühne (2c)
- Fernstart (Teil 3), Show-Zentrale (Teil 4)
- Änderungen am Companion-Protokoll (`packages/suite-control-protocol`)

Die ersten fünf stehen als Folgeaufgaben in Abschnitt 24 (FA1–FA4, FA8).

**Code-Stand dieser Spec:** Worktree `.claude/worktrees/master-link-2b`, Branch `feat/master-link-teil2b` = `main` @ `b666e5c5f4`. Jede Fundstelle unten ist an diesem Stand gelesen. Pfade sind relativ zum Repo.

---

## 0 · Ergänzungen gegenüber der Besprechung (bitte bewusst prüfen)

Beim Ausarbeiten kamen Stellen heraus, die die Besprechung nicht abdeckte oder an denen der Code mehr verlangt. Nur dort ergänzt diese Spec:

| # | Besprochen | Jetzt | Warum |
| --- | --- | --- | --- |
| 1 | Rundown-Picker speichert die Kennung | Neues Feld `speakerId` an der Aktion. `args[0]` behält den Namen. Gesendet wird die Kennung nur, wenn der Titler sie versteht (STATE `recall_kennung=1`), sonst der aktuelle Name (8.3). | Ein Titler 0.9.0 findet eine Kennung nicht und tut nichts (`apps/titler/src/main/datalink.ts:204-219`). Das folgende TAKE brächte den vorher aktiven Speaker auf Sendung. Das Feld `zielId` ist für `timer goto` belegt und wird bei R0 umgeschrieben (2a-Spec 4.2). |
| 2 | D2: Fällt die Person weg, bleibt die Bauchbinde stehen | Das gilt **auf Sendung**. Ohne Sendung gibt es danach keinen aktiven Eintrag, mit Hinweis. Geht eine gehaltene Bauchbinde von der Sendung, fällt der gehaltene Eintrag 1 s später weg (7.3). | Sonst brächte ein späteres TAKE eine gestrichene Person auf Sendung. Die 1 s deckt die Ausblendung ab (450 ms, `apps/titler/src/renderer/src/lib/engine.ts:15`). Sonst verschwänden die Texte mitten in der Animation. Die Vorlage zur Owner-Frage O2 (Variante A) sah „ohne Sendung kein aktiver Eintrag“ schon vor. |
| 3 | Launcher unterscheidet Abruffehler von „0 Speaker“ | Nach einem Fehler holt jede weitere Listen-Abfrage den Snapshot, bis die Speakerliste wieder kommt. So lange bleibt die Statuszeile „gestört“ (6.2). | Im Listen-Modus holt die Abfrage den Snapshot nur bei einer Programmänderung (`apps/launcher/src/main/iveo-abgleich-kern.ts:394-398`). Ohne Nachholen stünde die Statuszeile auf „in Ordnung“, obwohl die Speaker veraltet sind. |
| 4 | Tool-Settings ohne rechnergebundene Felder | Umgesetzt als **Freigabeliste** je Tool. Nur genannte Schlüssel reisen, alles andere bleibt lokal. Die Presenter-PIN bleibt lokal (14.2). | Eine Sperrliste ließe jeden neuen Schlüssel ungeprüft über das Netz, auch Geheimnisse wie die PIN (`apps/stage-display/src/main/index.ts:253-255`). |
| 5 | RELOAD an fremde Rechner wird durch Daten ersetzt | Doppelt abgesichert: Der Master-Launcher schickt RELOAD nur noch an Tools auf seinem eigenen Rechner (15.3). Ein Tool, das dem Master folgt, ignoriert RELOAD (16.1). | Ein zweiter Launcher mit iveo-Token oder ein alter Master schickt sonst weiter an jedes Tool im LAN (`apps/launcher/src/main/health.ts:195-205`). |
| 6 | – | Tools auf dem **Master-Rechner** abonnieren nicht. Sie lesen weiter die Datei und bekommen RELOAD (16.1). | „Einzelplatz-RELOAD bleibt“. Die Datei am Master ist die Quelle des Verteilers. Ein zweiter Weg auf demselben Rechner brächte doppeltes Anwenden. |
| 7 | – | Jedes Tool legt den zuletzt angewendeten Stand vom Master auf der Platte ab (16.3). | Sonst zeigt ein Tool, das neu startet, während der Master fehlt, weder Daten noch „letzter Stand“ (D4). |
| 8 | – | Antwortet der Master 5 s nicht auf das Abo, arbeitet das Tool wie in 2a weiter und zeigt „⟨M⟩ sendet keine Show-Daten (Launcher-Update nötig)“ (16.4). | Ein Master ohne 2b ignoriert `abo` (`packages/master-link/src/server.ts:230-238`). Ohne Frist stünde „Show wird geladen…“ für immer da. |
| 9 | – | Die eigene Rundown-Datei einer Show wird auf Rechner B nicht geladen (17.3). | Sie ist ein Dokument mit einem Pfad am Master. Dokumente gehören in den eigenen Zyklus. |
| 10 | – | Das Verbund-Modal am Master zeigt die Zeile „Show im Verbund …“ (15.5). | Für die Abnahme muss sichtbar sein, was der Master verteilt. |
| 11 | – | Im Titler gibt es den Knopf „Zurück zum eigenen Ordner“ (7.7). | Wenn die Show den eigenen DataLink-Ordner nicht mehr überschreibt, braucht der Bediener einen Weg zurück zu seinem Ordner. |
| 12 | e2e „Name bleibt Alan“ als Prüfung | Die **Owner-Abnahme** von Release 1 prüft live über das Umschalten eines Side Events, nicht über einen eingefügten Speaker (10). | Ein neuer Speaker im Prod-Event kann öffentlich sichtbar werden. Das Einfügen prüft der Durchgang mit nachgebautem iveo (9.6). |

---

## 1 · Owner-Entscheidungen

| Datum | # | Entscheidung |
| --- | --- | --- |
| 01.10.2026 | Zuschnitt | Teil 2 = 2a (feste Kennungen + Abgleich, inzwischen released) → 2b Show-Daten über den Master-Link → 2c iveo-Live je Bühne (Prod). Präsentationen, Materialien und Fotos bekommen einen eigenen Zyklus. |
| 01.10.2026 | Umfang 2b | Ablauf, Speaker, Side Events, Settings ohne rechnergebundene Felder, dazu die Tool-Anzeige. |
| 02.10.2026 | D1 | **Eine** 2b-Spec, **zwei** Releases. Release 1 „Titler hält seinen Speaker“ zuerst, mit der Speaker-Kennung aus iveo. Es braucht keinen Netz-Code. Danach Release 2 „Show-Daten über den Verbund“. |
| 02.10.2026 | D2 | Auf Sendung: Person halten, Text aktuell. Fällt die Person weg, bleibt die Bauchbinde stehen, dazu der Hinweis „nicht mehr in der Liste“. |
| 02.10.2026 | D3 | Weg der Daten: Die Tools holen den Stand **direkt** über ihre bestehende Verbund-Verbindung zum Master (Abo → Stand → Änderungen), auch ohne Launcher auf Rechner B. Der Master-Launcher verteilt. Die Tools wenden den Stand an wie eine gelesene Datei. |
| 02.10.2026 | D4 | Ein Tool auf einem gekoppelten Rechner B folgt **immer** der offenen Show des Masters. Es zeigt „Show vom Master: X · Stand hh:mm“. Schließt der Master die Show, bleibt der letzte Stand mit Hinweis. Der Einzelplatz bleibt unverändert. |
| 02.10.2026 | D5 | Das Design aus der Besprechung ist freigegeben. Es ist hier ausgearbeitet; Ergänzungen stehen in Abschnitt 0. |

---

## 2 · Ausgangslage (am Code nachgelesen)

### 2.1 Titler

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Der aktive Eintrag ist eine reine Zahl. Beim Neueinlesen bleibt die Zahl. Liegt sie außerhalb der Liste, wird Eintrag 1 aktiv, nicht der letzte. | `apps/titler/src/main/datalink.ts:54`, `:185-192` |
| 2 | Abruf per Name löst einmal auf und hält danach die Zahl. Bei Namen gilt erst exakt, dann Teilstring. | `datalink.ts:204-219` |
| 3 | Die Oberfläche ruft per Stelle ab: `recallEntry(String(i + 1))`. | `apps/titler/src/renderer/src/views/OperatorView.tsx:501`; `RecallBoard.tsx:51` |
| 4 | Vorschau und Sendung haben keinen getrennten Stand. Die Engine übernimmt die aufgelösten Texte in jedem Render und zeichnet jedes Frame daraus. Eine Änderung der Variablen ändert die Bauchbinde auf Sendung sofort. | `OperatorView.tsx:49-60`; `OutputView.tsx:25-31`; `engine.ts:31-32` |
| 5 | Jede Kopfspalte einer CSV/TSV wird zur Variable. Platzhalter erlauben nur `[A-Za-z0-9_.-]`. | `datalink.ts:103`; `apps/titler/src/shared/vars.ts:12` |
| 6 | Die Speaker-TSV hat die Spalten `name`, `funktion`, `title`, keine Kennung. | `apps/titler/src/main/iveo-show.ts:36-45` |
| 7 | Eine Show ohne Speaker lässt den DataLink unverändert (frühes `return`). | `apps/titler/src/main/index.ts:149` |
| 8 | Die Show überschreibt den DataLink-Ordner des Bedieners dauerhaft. | `index.ts:151`; `apps/titler/src/main/config.ts:43`, `:60` |
| 9 | Der Show-Pfad liegt nur im Speicher. Nach einem Start über die Kachel wird RELOAD ignoriert. | `index.ts:33`, `:159-170` |
| 10 | Companion-STATE: `entry`, `entry_index`, `entry_count`. | `apps/titler/src/main/control-server.ts:52-65` |
| 11 | Der Titler hat keinen Selbsttest. Die CI kennt ihn nicht. | `apps/titler/package.json:8-20`; `.github/workflows/ci-checks.yml:32-60` |

### 2.2 Die Speaker-Kennung geht unterwegs verloren

iveo liefert eine `id` je Speaker (`packages/iveo/src/types.ts:78-92`). Der Umwandler wirft sie weg (`packages/iveo/src/mapper.ts:329-337`). `ShowIveoSpeaker` hat kein Feld dafür (`packages/show/src/index.ts:72-77`), und der Normalisierer lässt nur `name` und `title` durch (`:232-245`). Die vollständige Liste der Stellen steht in 5.2.

### 2.3 Launcher

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Der Snapshot lädt Speaker „best effort“. Ein Fehler ergibt eine leere Liste. | `packages/iveo/src/client.ts:313-320`, `:326` |
| 2 | Im Listen-Modus wird daraus `speakers = []`. Die Signatur weicht ab, die Show wird ohne Speaker geschrieben, und RELOAD geht hinaus. | `apps/launcher/src/main/iveo-abgleich-kern.ts:412-415`, `:305`, `:444` |
| 3 | Beim Umschalten auf die Tagesübersicht wird der Fehler ganz verschluckt (`onSubError: () => {}`). | `iveo-abgleich-kern.ts:605`, `:614` |
| 4 | Speaker kommen im Listen-Modus nur mit einer Programmänderung, denn nur dann wird der Snapshot geholt. | `iveo-abgleich-kern.ts:394-398` |
| 5 | Der Agenda-Modus nimmt die Speaker immer aus der Datei. | `iveo-abgleich-kern.ts:483` |
| 6 | Die Side-Event-Liste wird nur beim Binden geschrieben. Jede Abfrage übernimmt sie unverändert. | `apps/launcher/src/main/iveo-sync.ts:290-293`; `iveo-abgleich-kern.ts:295`, `:306` |
| 7 | RELOAD geht an jeden verbundenen Endpunkt der appId, im ganzen LAN. | `apps/launcher/src/main/health.ts:195-205` |
| 8 | Einen Befehl „Show schließen“ gibt es nicht. `stopIveoPolling` hat keinen Aufrufer. Eine Show ist offen, bis eine andere geöffnet wird oder der Launcher endet. | `iveo-sync.ts:519-525` (`git grep stopIveoPolling`: nur die Definition) |

### 2.4 Master-Link heute

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Es gibt nur die acht Nachrichten aus Teil 1. `PROTOKOLL = 1`. Der Master lehnt jede andere Protokollnummer ab. | `packages/master-link/src/rahmen.ts:5`, `:19-27`; `server.ts:270-273` |
| 2 | Unbekannte Typen gelten als `unbekannt` und werden ignoriert. Ein bekannter Typ mit falschem Feld gilt als `kaputt` und kappt die Leitung. | `rahmen.ts:88-90`; `verbindung.ts:47-52` |
| 3 | `ZeilenLeser.fuettere` prüft alle Zeilen eines Stücks gegen die gerade gültige Grenze (vor der Anmeldung 4 KiB). Die Grenze steigt erst im Handler von `angemeldet`. Es kopiert den Puffer bei jedem Stück neu. | `rahmen.ts:112-126`; `client.ts:150-153`; `fristen.ts:62-64` |
| 4 | `halteFest` sammelt nach `angemeldet` nur `nachricht`. `betreibe` wertet davon nur `abgelehnt` aus. Beim Koppeln entfernt `removeAllListeners` alle Zuhörer, ohne Folgezeilen festzuhalten. | `client.ts:167-180`, `:532-584`; `koppeln.ts:158` |
| 5 | Der Server hat keine Sende-Methode für Daten. Nach der Anmeldung wirkt nur `teilnehmer`. | `server.ts:230-238`, `:447-449` |
| 6 | `Verbindung.sende` schreibt ohne Rückdruck. | `verbindung.ts:68-70` |
| 7 | `app-runtime` hält den Client modulprivat. `getMasterLinkStatus()` hat keinen Aufrufer. | `packages/app-runtime/src/index.ts:116`, `:390-393` |

### 2.5 Wer liest was aus der Show

- `show.ablauf` lesen nur Launcher, Rundown und Timer.
- `show.iveo.speakers` lesen nur Launcher, Rundown, Titler und Connect (`apps/connect/src/main/show-open.ts:59`).
- RELOAD verstehen nur Timer, Titler und Rundown (`iveo-abgleich-kern.ts:278-283`).
- Der Titler liest aus der Show nur die Speaker und sein Dokument, keine Settings.
- Der Rundown liest die Settings des Timers, um eine eigene Timer-Liste zu erkennen (`apps/rundown/src/main/gedaechtnis.ts:249-250`).

---

## 3 · Zählung Z1–Z9 und Zuordnung zu den Releases

Die Ist-Karten nutzten kollidierende Nummern. Diese Spec nutzt nur diese Zählung:

| Z | Inhalt | Herkunft | Release | Abschnitt |
| --- | --- | --- | --- | --- |
| Z1 | Tools auf anderen Rechnern bekommen den Stand vom Master | 2a-Spec `:840`; `docs/jm-show.md:226-227` | 2 | 12–17 |
| Z2 | Zwei Launcher im Netz: Der Rundown nimmt den gekoppelten Master, nicht den zuletzt gefundenen | 2a-Spec `:841`; `apps/rundown/src/main/conductor.ts:81-88` | 2 | 17.4 |
| Z3 | Die Side-Event-Liste wird bei Abfragen aufgefrischt | 2a-Spec `:842` | 2 | 15.4 |
| Z4 | Der Titler hält den Eintrag über einen Schlüssel, nicht über die Nummer. Dazu gehören die Speaker-Kennung, der Abruffehler im Launcher, die gemerkte Show und der eigene Ordner. | 2a-Spec `:507`, `:848` | **1** | 5–8 |
| Z5 | Das Rundown-Gedächtnis bezieht sich auf die Show des Masters | 2a-Spec `:347` | 2 | 17.3 |
| Z6 | Datenumfang: Ablauf, Speaker, Side Events, Filter, freigegebene Settings | Owner 01.10.2026 | 2 | 14 |
| Z7 | Anzeige in Timer, Titler und Rundown | Teil-1-Spec `:395`, `:892` | 2 | 16.4 |
| Z8 | Transport-Reparaturen: ZeilenLeser, Übergabe, lockere Prüfer, Rückdruck | Teil-1-Spec `:458`; 2.4 | 2 | 13.5, 13.6 |
| Z9 | RELOAD an fremde Rechner durch Daten ersetzen. Am Einzelplatz bleibt RELOAD. | Owner 02.10.2026 | 2 | 15.3, 16.1 |

---

## 4 · Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Speaker-Kennung** | Feld `ShowIveoSpeaker.id`, die iveo-Speaker-ID (5.1). |
| **Schlüssel eines Eintrags** | Interner Schlüssel je DataLink-Eintrag im Titler: die Kennung aus der Spalte `@kennung`, sonst der Ersatz-Schlüssel (7.2). |
| **Ersatz-Schlüssel** | `ersatz:` + Dateiname + Label, nur im Titler gebildet, nie geschrieben. |
| **Aktiver Eintrag** | Der Eintrag der Liste, dessen Variablen gerade gezeichnet werden. |
| **Gehaltener Eintrag** | Ein Eintrag, der auf Sendung war und aus der Liste verschwunden ist. Seine Variablen bleiben eingefroren stehen (7.3). |
| **Datenquelle** | Woher der Titler seine Einträge liest: die Show, der eigene Ordner oder „eine frühere Show“ (7.7). |
| **Gemerkte Show** | Die Show, mit der ein Tool verbunden ist. Sie übersteht einen Neustart. Im Rundown gibt es sie seit 2a, im Titler ab Release 1. |
| **Master-Rechner** | Der Rechner, dessen Launcher die Rolle Master hat. |
| **Rechner B** | Ein gekoppelter Rechner mit der Rolle „Mit Master verbinden“. |
| **Ausschnitt** | Der Teil der offenen Show, der über den Verbund reist (14). |
| **Stand** | Ein vollständiger Ausschnitt mit Epoche und Folge, wie ihn `stand` und `aenderung` tragen (13). |
| **Abo** | Die Bitte eines Tools an den Master, ihm den Stand zu schicken. |
| **Epoche** | Zufällige Kennung je Start des Verteilers am Master (13.3). |
| **Folge** | Zähler der Stände innerhalb einer Epoche (13.3). |
| **Verbundmodus** | Ein Tool auf Rechner B, das dem Master folgt. Es nimmt die Show-Daten nur noch vom Master (16.1). |

---

# Teil A · Release 1 „Titler hält seinen Speaker“

Release 1 ändert keinen Code in `packages/master-link` und `packages/app-runtime`. Es gilt am Einzelplatz und auf jedem Rechner für sich.

## 5 · Speaker-Kennung von iveo bis in den Titler

### 5.1 Das Feld

- `ShowIveoSpeaker` bekommt das optionale Feld `id?: string`. Feldreihenfolge `id`, `name`, `title`, wie bei `ShowAblaufItem`.
- Der Normalisierer übernimmt `id`, wenn es ein String ist, der nach `trim()` 1 bis 200 Zeichen lang ist. Sonst entfällt das Feld, der Speaker bleibt (gleiche Regel wie 2a-Spec 3.1).
- **Doppelte Kennungen** in der Liste löst er auf wie 2a-Spec 3.5: Die erste behält ihre Kennung, jede weitere bekommt `#2`, `#3` und so weiter.
- `@jm/show` exportiert dafür neu `loeseDoppelteKennungenAuf(liste)`. Die Funktion arbeitet auf Objekten mit optionalem `id`. `normalizeAblauf` (`packages/show/src/index.ts:190-210`) nutzt sie künftig ebenfalls, damit es nur eine Regel gibt. Ihr Verhalten bleibt gleich, die 2a-Fälle im iveo-Selbsttest sichern das.

### 5.2 Alle Stellen, die Speaker bauen

Gesucht wurde mit `git grep "ShowIveoSpeaker\|speakers:"` und nach den Umwandlern, also nach Konstruktoren, nicht nach Lesern (Lehre aus 2a: „neun Stellen unterschlagen neue Felder still“).

| # | Stelle | Art | Änderung |
| --- | --- | --- | --- |
| SP1 | `packages/show/src/index.ts:232-245`, Speaker in `normalizeIveoBinding` | Normalisierer, läuft bei jedem `parseShow` und `serializeShow` | übernimmt `id` nach 5.1 |
| SP2 | `packages/iveo/src/mapper.ts:329-337`, `speakersToShowSpeakers`; `:340-342`, `snapshotToShowSpeakers` nutzt SP2 | Erzeuger | setzt `id: s.id` |
| SP3 | `apps/launcher/src/main/iveo-abgleich-kern.ts:187-189`, Signatur | Neubau als Tupel | `[id ?? null, name, title ?? null]` (5.3) |
| SP4 | `apps/titler/src/main/iveo-show.ts:36-45`, `writeSpeakersTsv` | Neubau als TSV-Zeile | vierte Spalte `@kennung` (7.2) |
| SP5 | `apps/titler/src/main/datalink.ts:88-108`, `parseTable` | Neubau als `DataEntry` | Schlüssel statt Variable (7.2) |
| SP6 | `apps/rundown/src/renderer/src/components/RowEditor.tsx:267-268`, Wert der Picker-Option | Neubau als Optionswert | Kennung statt Name (8.2) |
| SP7 | `apps/rundown/test/e2e-teil2a.mjs:177-178`, `speakerListe()` | Testdaten | mit `id` |
| SP8 | `apps/connect/src/main/show-open.ts:59` | eigener Typ `ShowSpeaker` | **bewusst ohne Kennung.** Connect erkennt Eingeladene über den Namen (`apps/connect/src/renderer/src/App.tsx:164`) und ist kein 2b-Empfänger (24). |

**Durchreicher** (bauen nichts neu, das Feld überlebt): Launcher-Kern `:305`, `:483`, `:541`, `:624`; Binden `apps/launcher/src/main/iveo-sync.ts:185`, `:192`, `:323`; Show-Editor `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:229`, `:242`, `:346` und `apps/launcher/src/renderer/src/lib/show-speichern.ts:136`; IPC-Typ `apps/launcher/src/shared/types.ts:240`; Rundown `apps/rundown/src/main/index.ts:563`. Ein Test prüft, dass Laden und Speichern im Show-Editor die Kennung behält (9.2).

**Nicht angefasst:** `mapper.ts:369` (Cache-Metadaten, eigener Typ, trägt `id` schon).

### 5.3 Signatur und einmaliges Nachschreiben

- Die Signatur nimmt die Kennung auf. Nach dem Update unterscheidet sich die Signatur einer Bestands-Show deshalb einmal von der Datei. Die nächste schreibende Abfrage trägt die Kennungen nach und schickt RELOAD, wie in 2a-Spec 7.2.
- **Wann eine Bestands-Show die Kennungen bekommt:**
  - Listen-Modus: bei der ersten Programmänderung, beim Umschalten auf die Tagesübersicht oder beim Binden.
  - Agenda-Modus: beim Binden oder beim Umschalten auf ein Side Event mit verknüpften Speakern. Der Agenda-Modus nimmt die Speaker sonst aus der Datei (`iveo-abgleich-kern.ts:483`).
- Bis dahin hält der Titler über den Ersatz-Schlüssel, also über Datei und Namen (7.2). Ein Zwangs-Schreiben gibt es nicht.

### 5.4 Verträglichkeit

| Kombination | Verhalten |
| --- | --- |
| Neuer Launcher, alter Titler (0.9.0) | Der alte Normalisierer verwirft `id`. Der Titler verhält sich wie heute. |
| Alter Launcher (0.13.x), neuer Titler | Speaker ohne Kennung. Der Titler hält über den Ersatz-Schlüssel: Die Person bleibt, solange ihr Name gleich bleibt. |
| Neue Show, alter Rundown (0.6.0) | Der Picker schreibt weiter Namen. Der Titler findet sie über das Label (7.4). |
| Alter Launcher speichert eine Show mit Kennungen im Show-Editor | Die Kennungen gehen verloren. Der Titler wechselt auf Ersatz-Schlüssel. Ein Name, der gleich bleibt, hält. |

---

## 6 · Launcher: ein Abruffehler ist nicht „0 Speaker“

### 6.1 Heute

Scheitert `/speakers`, gilt das als leere Liste (2.3, Nr. 1–3). Die Show verliert ihre Speaker. Der Rundown-Picker verliert die Liste, der Titler behält zufällig seine alte (`apps/titler/src/main/index.ts:149`).

### 6.2 Neu

- Der Kern übergibt `getEventSnapshot` ein `onSubError` und merkt sich, ob `speakers` gescheitert ist. Das gilt in der Listen-Abfrage und beim Umschalten auf die Tagesübersicht.
- **Scheitert die Speakerliste:**
  - Es gelten die Speaker der gerade gelesenen Show-Datei (`basis.iveo?.speakers ?? []`). Dafür liest der Kern die Datei vor dem Signaturvergleich, nicht erst danach (heute `:422`).
  - Die aktive Show bekommt den Merker `speakerVeraltet = true`.
  - Der Status wird „gestört“ mit dem Text aus 6.3. Ins Log kommt eine Warnung beim ersten Fehlschlag und bei jedem neuen Fehlertext, wie in 2a-Spec 7.6.
  - Ablauf und Side Events werden wie sonst verglichen und geschrieben.
- **Solange `speakerVeraltet` gilt,** holt jede Listen-Abfrage den Snapshot, auch wenn `listProgramsUpdatedSince` nichts liefert.
- **Gelingt die Speakerliste,** wird `speakerVeraltet = false`. Der Status geht auf „in Ordnung“, wenn sonst nichts gestört ist.
- **Status „in Ordnung“** darf eine Abfrage nur melden, wenn `speakerVeraltet` falsch ist. Sonst bleibt der Text aus 6.3 stehen. Das gilt auch für die Agenda-Abfrage.
- **Umschalten auf ein Side Event:** Gelingt dort die Speakerliste, wird `speakerVeraltet = false`. Scheitert sie, bleibt es wie heute bei der Liste der Datei (`:543-547`), und `speakerVeraltet = true`.
- **Öffnen und Speichern** einer Show setzen `speakerVeraltet = false` (neue aktive Show, `setzeAuf` `:318-352`).
- **Erfolgreich 0 Speaker** (iveo meldet ausdrücklich keine) bleibt wie heute: Das Feld fehlt in der Datei. Der Titler behält seine Liste und zeigt den Hinweis aus 7.6.

### 6.3 Texte (wörtlich)

| Anlass | Ort | Text |
| --- | --- | --- |
| Speakerliste nicht abrufbar | Status im iveo-Panel | „iveo-Abgleich gestört: Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand (seit ⟨hh:mm⟩)“ |
| dasselbe | Log (Warnung) | „iveo: Speakerliste nicht abrufbar (⟨Fehler⟩), Speaker aus der Datei bleiben.“ |
| Umschalten auf die Tagesübersicht mit gescheiterter Speakerliste | Antwort des Umschaltens | „Umgeschaltet — Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.“ |

---

## 7 · Titler

### 7.1 Aufbau

| Datei | Inhalt |
| --- | --- |
| **neu** `apps/titler/src/shared/datalink-kern.ts` | ohne Electron und ohne fs: Tabellen und `schlüssel=wert` lesen, Schlüssel bilden (7.2), aktiven Eintrag abgleichen (7.3), Abruf (7.4), Werte für Companion (7.5) |
| **neu** `apps/titler/src/shared/datenquelle.ts` | ohne Electron: Regeln der Datenquelle (7.7) |
| `apps/titler/src/main/datalink.ts` | nur noch Ordner lesen, beobachten, Kern aufrufen |
| **neu** `apps/titler/src/main/show-quelle.ts` | gemerkte Show lesen und schreiben, Show anwenden |
| `apps/titler/src/main/index.ts`, `iveo-show.ts`, `control-server.ts` | Anbindung |
| `apps/titler/src/shared/types.ts`, `src/preload/index.ts` | Status und IPC (7.4, 7.8) |
| `OperatorView.tsx`, `RecallBoard.tsx` | Anzeige (7.8) |
| **neu** `apps/titler/test/selftest.ts` | 9.3 |

Die beiden neuen Module importieren zur Laufzeit nur `@jm/show`. Der Selbsttest läuft deshalb mit `tsx`, wie `selftest:iveo` im Launcher. Der Titler bekommt `tsx` als devDependency.

### 7.2 Schlüssel je Eintrag

- **Spalte für die Kennung:** Die TSV heißt weiter `speakers.tsv`, Kopf `name\tfunktion\ttitle\t@kennung`. Die Spalte steht hinten.
- **Kein Platzhalter:** `@` liegt außerhalb der erlaubten Zeichen (`vars.ts:12`). `{{@kennung}}` ist deshalb nie auflösbar. `parseTable` legt den Wert der Spalte in `DataEntry.key` ab, nicht in `vars`, und nutzt sie nicht als Label.
- **Eigene Dateien:** Eine eigene CSV darf die Spalte `@kennung` ebenfalls tragen. Sie wird dann als Schlüssel genutzt.
- **Ersatz-Schlüssel**, wenn die Spalte fehlt oder leer ist:
  - Zeile einer CSV/TSV: `ersatz:<Dateiname>|<Label>`
  - `schlüssel=wert`-Datei (ein Eintrag je Datei): `ersatz:<Dateiname>`
- **Doppelte Schlüssel** über die zusammengeführte Liste aller Dateien löst `loeseDoppelteKennungenAuf` aus `@jm/show` auf (5.1). Ein Schlüssel ist höchstens 200 Zeichen lang, gekürzt wie in 2a-Spec 3.5.
- `DataEntry` wird `{ key: string; label: string; vars: Record<string, string> }`.

### 7.3 Aktiver Eintrag

Der Titler führt den aktiven Eintrag über seinen Schlüssel. Dazu kommen ein gehaltener Eintrag und ein Hinweis. Ob die Bauchbinde auf Sendung ist, meldet der Renderer schon heute (`index.ts:452-456`, `lastOnAir`).

| # | Lage beim Neueinlesen | Auf Sendung | Danach | Gezeichnet wird | Hinweis |
| --- | --- | --- | --- | --- | --- |
| A1 | Schlüssel steht in der neuen Liste | egal | derselbe Eintrag, an seiner neuen Stelle | seine Variablen aus der neuen Liste. Eine Korrektur aus iveo wirkt sofort (D2). | – |
| A2 | Schlüssel fehlt | ja | gehaltener Eintrag, kein Eintrag der Liste markiert | die zuletzt gültigen Variablen, eingefroren | H1 |
| A3 | Schlüssel fehlt | nein | kein aktiver Eintrag | leere Variablen | H2 |
| A4 | gehaltener Eintrag, die Sendung endet (gemeldetes `on_air` 0) | – | 1 s später kein aktiver Eintrag. Kommt vorher wieder ein TAKE, bleibt er gehalten. | danach leere Variablen | H2 |
| A5 | gehaltener Eintrag, sein Schlüssel steht wieder in der Liste | egal | wieder dieser Eintrag | seine neuen Variablen | – |
| A6 | Abruf, Weiter, Zurück oder Klick | egal | der gewählte Eintrag | seine Variablen | – |
| A7 | die neue Liste ist leer | egal | unverändert, siehe 7.6 | unverändert | H3 |
| A8 | anderer Ordner (Quellenwechsel, 7.7) | ja | Schlüssel gefunden: A1; sonst A2 | wie A1/A2 | wie A1/A2 |
| A9 | anderer Ordner | nein | Schlüssel gefunden: A1; sonst Eintrag 1, wie heute (`datalink.ts:243`) | dessen Variablen | – |

Ein Abruf auf Sendung ändert den Text weiter sofort, ohne Animation. Das ist heute so und bleibt so. Ein TAKE ohne aktiven Eintrag zeigt leere Platzhalter, wie heute bei einem leeren Ordner; der Hinweis H2 steht dann schon da.

### 7.4 Abruf

- **`recall(ref)`**, genutzt von Companion, Steuerprotokoll und Rundown. Reihenfolge:
  1. nur Ziffern → Nummer (1-basiert), wie bisher (2a-Spec 6.3)
  2. Schlüssel exakt, ohne Rücksicht auf Groß- und Kleinschreibung
  3. Label exakt
  4. Label als Teilstring

  Es gilt jeweils der erste Treffer. Danach hält der Titler den **Schlüssel**, nicht die Nummer.
- **Oberfläche:** Ein Klick in Liste oder Board ruft den neuen IPC `titler:recallSchluessel(key)` auf. Er sucht nur den Schlüssel. So trifft ein Klick nie die Stelle einer veralteten Liste.
- **Weiter und Zurück** gehen von der Stelle des aktiven Eintrags aus, begrenzt auf die Liste. Ohne aktiven Eintrag, auch bei einem gehaltenen, wählen beide Eintrag 1.
- **Status an die Fenster** (`apps/titler/src/shared/types.ts:152-169`):
  - `entries: { key: string; label: string }[]` statt `string[]`
  - `activeEntry`: Stelle des aktiven Schlüssels, sonst −1
  - neu `gehalten?: { label: string }`
  - neu `hinweis?: string`
  - neu `datenQuelle` (7.7)
- React-Schlüssel in Liste und Board sind künftig die Eintrags-Schlüssel (heute `` `${i}-${label}` ``, `OperatorView.tsx:500`, `RecallBoard.tsx:50`).

### 7.5 Companion

- STATE bleibt bei `entry`, `entry_index`, `entry_count`:
  - `entry`: Label des aktiven oder gehaltenen Eintrags, sonst leer
  - `entry_index`: Stelle des aktiven Eintrags (1-basiert), bei gehaltenem oder keinem Eintrag 0
  - `entry_count`: Länge der Liste
- **Neu im STATE:** `recall_kennung=1`. Der Rundown liest daraus, dass dieser Titler Kennungen abrufen kann (8.3).
- Das Companion-Modul übernimmt aus dem STATE nur die Variablen seiner Tabelle (`packages/companion-jm-suite/main.js:372-378`). Ein zusätzlicher Schlüssel ändert dort nichts. Es braucht keinen Protokoll-Sync und kein Companion-Release.
- `TITLER RECALL <nr>`, `NEXT`, `PREV` bleiben, wie sie sind.

### 7.6 Leere Liste

| Lage | Verhalten |
| --- | --- |
| Die Datenquelle ist eine Show, dieselbe Show hat jetzt keine Speaker | Die alte TSV bleibt, Hinweis H3. |
| Eine **andere** Show ohne Speaker wird geöffnet | Die Datenquelle wechselt auf den eigenen Ordner (7.7). |
| Die gemerkte Show ist beim RELOAD oder Start nicht lesbar | Die alte TSV bleibt, Hinweis H4. |

Der Titler leert seine Liste nie von selbst. Leeren kann nur der Bediener, indem er einen anderen Ordner wählt.

### 7.7 Datenquelle und gemerkte Show

**Grundsatz:** `config.dataFolder` ist nur noch der Ordner des Bedieners. Die Show schreibt ihn nie mehr (heute `index.ts:151`).

**Datenquelle** (Laufzeit, im Status als `datenQuelle`):

| Art | Gelesen wird | Entsteht |
| --- | --- | --- |
| `show` | `userData/iveo-data` | Eine Show mit mindestens einem Speaker wurde angewendet |
| `ordner` | `config.dataFolder` | Vorgabe; nach einer Show ohne Speaker; nach Ordnerwahl oder Knopf |
| `frueher` | `userData/iveo-data` | Übergang (unten) |

**Gemerkte Show:** `<userData>/show-zuletzt.json` mit `{ showPfad, showName, mitSpeakern }`. Geschrieben wird atomar (Zwischendatei, dann umbenennen), wenn eine Show angewendet wird. `mitSpeakern` sagt, ob die Datenquelle danach `show` war.

| Ereignis | Datenquelle danach | Gemerkte Show |
| --- | --- | --- |
| Show-Deep-Link oder RELOAD, Show mit Speakern | `show` | diese Show |
| Show-Deep-Link, andere Show ohne Speaker | `ordner` | diese Show (RELOAD wirkt weiter) |
| RELOAD oder Show-Deep-Link, dieselbe Show ohne Speaker | unverändert, H3 | unverändert |
| Start ohne Deep-Link (Kachel, Neustart), gemerkte Show lesbar | wie Deep-Link, aber **ohne** Vorlagen-Import (C3, `index.ts:172-193`) | unverändert |
| Start ohne Deep-Link, gemerkte Show nicht lesbar, `mitSpeakern` | `show` mit der vorhandenen TSV, H4 | bleibt, ein späteres RELOAD versucht es erneut |
| Start ohne Deep-Link, gemerkte Show nicht lesbar, ohne Speaker | `ordner`, Logzeile | bleibt |
| Bediener wählt einen DataLink-Ordner | `ordner` | gelöscht; ein späteres RELOAD warnt wie heute |
| Knopf „Zurück zum eigenen Ordner“ | `ordner` | gelöscht |

**Übergang:** Steht `config.dataFolder` beim ersten Start auf `userData/iveo-data`, hat ein früherer Titler ihn überschrieben. Den Ordner von davor kennt niemand mehr.
- Ohne gemerkte Show wird die Datenquelle `frueher`. Die alte Liste bleibt sichtbar.
- `config.dataFolder` wird dabei nicht verändert.
- Die erste Show mit Speakern macht daraus `show`.

### 7.8 Oberfläche und Texte (wörtlich)

| # | Ort | Text |
| --- | --- | --- |
| H1 | Daten / Recall, stehend; Board oben | „„⟨Label⟩“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.“ |
| H2 | Daten / Recall, stehend | „„⟨Label⟩“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.“ |
| H3 | Daten / Recall, stehend | „Liste aus früherem Stand: Die Show enthält gerade keine Speaker.“ |
| H4 | Daten / Recall, stehend | „Liste aus früherem Stand: Show nicht lesbar (⟨Grund⟩).“ |
| Q1 | Daten / Recall, Zeile über der Liste | „Quelle: Show „⟨Showname⟩“ · ⟨n⟩ Speaker“ |
| Q2 | dasselbe | „Quelle: eigener Ordner ⟨Pfad⟩“ |
| Q3 | dasselbe | „Quelle: Speaker aus einer früheren Show“ |
| K1 | Einstellungen › DataLink, nur bei Quelle `show` und einem eigenen Ordner, der nicht `iveo-data` ist | Knopf „Zurück zum eigenen Ordner (⟨Ordnername⟩)“ |
| B1 | Board, Karte über den Einträgen, nur bei gehaltenem Eintrag | „Auf Sendung, nicht in der Liste: ⟨Label⟩“ |

- Die Bedingung „Kein Datenordner aktiv“ (`OperatorView.tsx:448-453`) prüft künftig die Datenquelle, nicht `config.dataFolder`.
- Ein gehaltener Eintrag erscheint in der Liste nicht als markierter Eintrag. Die Zähleranzeige zeigt „Einträge · ⟨n⟩“ ohne Stelle.

### 7.9 Log

| Anlass | Zeile |
| --- | --- |
| A1 mit neuer Stelle | „DataLink: „⟨Label⟩“ hält seinen Eintrag (jetzt Nr. ⟨n⟩ von ⟨m⟩).“ |
| A2 | „DataLink: aktiver Eintrag „⟨Label⟩“ nicht mehr in der Liste, auf Sendung gehalten.“ |
| A3, A4 | „DataLink: aktiver Eintrag „⟨Label⟩“ nicht mehr in der Liste, kein aktiver Eintrag.“ |
| H3 | „iveo: Show ohne Speaker, Liste aus früherem Stand bleibt.“ |
| Gemerkte Show | „Show gemerkt: ⟨Pfad⟩“ |

---

## 8 · Rundown: Speaker-Aktion über die Kennung

### 8.1 Feld

- `RundownAction` bekommt `speakerId?: string` (`apps/rundown/src/shared/types.ts:10-32`). `normAction` übernimmt es als String mit 1 bis 200 Zeichen (`apps/rundown/src/shared/doc-format.ts:22-37`).
- `args[0]` behält den **Namen**. Er dient der Anzeige und als Rückfall.
- `schemaVersion` bleibt 2. Ein Rundown 0.6.0 übernimmt nur bekannte Felder und verwirft `speakerId`. Die Aktion wirkt dort weiter über den Namen.

### 8.2 Picker im Zeilen-Editor

- Optionen: je Speaker der Show „⟨Name⟩ — ⟨Funktion⟩“ bzw. „⟨Name⟩“ (`RowEditor.tsx:257-275`). Der Wert ist die Kennung, ohne Kennung der Name.
- Eine Auswahl schreibt `speakerId` (falls vorhanden) und `args[0] = Name`.
- **Alte Aktion ohne `speakerId`:** Ausgewählt steht die zusätzliche Option „⟨Name⟩ · per Name (nicht gebunden)“. Gebunden wird erst durch eine Auswahl, nie stillschweigend (wie 2a-Spec 6.2).
- **`speakerId` nicht in der Liste:** Ausgewählt steht „⟨args[0]⟩ · nicht in der Speaker-Liste“.
- Der Kommentar `RowEditor.tsx:158-159` („Programme↔Speaker sind in iveo NICHT verknüpft“) ist überholt (`iveo-abgleich-kern.ts:209-212`) und wird berichtigt.

### 8.3 Senden

Neue reine Funktion in `apps/rundown/src/shared/zeilen.ts`:

```ts
export function loeseSpeakerZiel(
  aktion: RundownAction,
  speakers: ShowIveoSpeaker[],
  titlerKannKennung: boolean,
): (string | number)[];
```

| Lage | Gesendet |
| --- | --- |
| kein `speakerId` | `args` unverändert, wie heute |
| `speakerId`, der Titler meldet `recall_kennung=1` | `TITLER RECALL ⟨speakerId⟩` |
| `speakerId`, der Titler meldet es nicht (alt oder gerade nicht verbunden) | `TITLER RECALL ⟨aktueller Name zu speakerId⟩`, ohne Treffer `⟨args[0]⟩` |

- `titlerKannKennung` kommt aus dem STATE der Rolle `titler` im Conductor (`conductor.snapshot()`, `apps/rundown/src/main/conductor.ts:140`).
- Die Auflösung läuft in `argsZumSenden` (`apps/rundown/src/main/index.ts:343`), zusammen mit der Sprung-Auflösung aus 2a, also erst beim Senden. Das gilt für GO, verzögerte Aktionen und den Test-Knopf.

### 8.4 Anzeige in Liste und Vorschau

- Chip und Vorschau zeigen bei `speakerId` den aktuellen Namen aus `iveoSpeakers` (`apps/rundown/src/renderer/src/components/RundownList.tsx:188-193`, `lib/capabilities.ts:21-24`).
- Fehlt die Kennung in der Liste: „JM Titler · DataLink-Eintrag abrufen (⟨args[0]⟩, nicht in der Speaker-Liste)“.
- `RundownList` bekommt dafür `iveoSpeakers` aus dem Zustand.

---

## 9 · Release 1: Tests, CI, Durchgang

Alle Selbsttests laufen ohne Netz und ohne Fenster.

### 9.1 `@jm/show` und `@jm/iveo` (`npm run selftest -w @jm/iveo`)

1. Speaker mit Kennung: `trim`; 200 Zeichen bleiben, 201 entfallen; kein String entfällt.
2. Doppelte Kennungen → `#2`, `#3`. Bei „X“, „X“, „X#2“ → „X“, „X#3“, „X#2“.
3. `serializeShow` → `parseShow` behält die Kennung.
4. `speakersToShowSpeakers` setzt `id`.
5. Die 2a-Fälle für `normalizeAblauf` laufen unverändert grün (gemeinsame Funktion, 5.1).

### 9.2 Launcher (`npm run selftest:iveo -w @jm/launcher`)

1. Signatur: gleiche Namen, andere Kennung → andere Signatur.
2. Bestands-Show ohne Kennungen: Die erste schreibende Listen-Abfrage trägt die Kennungen nach. Danach bleibt die Signatur gleich.
3. `/speakers` scheitert im Listen-Modus → Speaker der Datei bleiben, Status „gestört“ mit dem Text aus 6.3.
4. Danach eine Abfrage **ohne** Programmänderung → der Snapshot wird trotzdem geholt. Gelingt die Liste, wird der Status „in Ordnung“.
5. Agenda-Abfrage bei `speakerVeraltet` → der Status bleibt „gestört“.
6. Tagesübersicht umschalten mit gescheiterter Speakerliste → Speaker der Datei, Meldung aus 6.3.
7. iveo meldet erfolgreich 0 Speaker → Feld fehlt in der Datei (heutiges Verhalten).
8. Show-Editor: Laden und Speichern ohne Änderung behält die Speaker-Kennungen (`baueGespeicherteShow`, Erweiterung von 2a-Spec 9.5).

### 9.3 Titler (neu, `npm run selftest -w @jm/titler`)

**`datalink-kern`:**
1. `@kennung` landet in `key`, nicht in `vars`. `{{@kennung}}` löst nicht auf.
2. Ersatz-Schlüssel `ersatz:speakers.tsv|Alan`, doppelt → `#2`; `schlüssel=wert`-Datei → `ersatz:<Datei>`.
3. **Alan bleibt Alan:** Ada, Grace, Alan (aktiv), Hedy; davor kommt „Neu“ → aktiv bleibt Alan, jetzt an Stelle 4.
4. Umbenennen der Funktion bei gleichem Schlüssel → neue Variablen, derselbe Eintrag.
5. Schlüssel fehlt, auf Sendung → gehalten, eingefrorene Variablen, H1.
6. Schlüssel fehlt, nicht auf Sendung → kein aktiver Eintrag, H2.
7. Gehalten, Sendung endet → nach 1 s kein aktiver Eintrag (übergebene Uhr). Ein TAKE innerhalb 1 s → bleibt gehalten.
8. Gehalten, Schlüssel kommt zurück → wieder aktiv, Hinweis weg.
9. Liste komplett ersetzt (Umschalten), Person an anderer Stelle → dieselbe Person.
10. Liste schrumpft unter die alte Stelle, Person noch da → dieselbe Person.
11. Abruf: „3“ → Nummer; Schlüssel exakt; Label exakt; Teilstring.
12. Weiter und Zurück ohne aktiven Eintrag → Eintrag 1.
13. Companion-Werte: aktiv, gehalten, keiner.
14. Anderer Ordner, nicht auf Sendung, Schlüssel fehlt → Eintrag 1 (A9).

**`datenquelle`:** jede Zeile der Tabellen in 7.6 und 7.7, dazu der Übergang.

**Gegenprobe:** Fall 3 wird absichtlich gegen eine Variante geprüft, die die Stelle statt des Schlüssels hält. Sie muss rot werden. Das Ergebnis kommt in den Aufgabenbericht.

### 9.4 Rundown (`npm run selftest -w @jm/rundown`)

1. `normAction` behält `speakerId`, verwirft leere und zu lange.
2. `loeseSpeakerZiel`: jede Zeile der Tabelle in 8.3.
3. Umbenennung in iveo: Gesendet wird ohne Kennungs-Fähigkeit der **neue** Name.
4. Chip-Text mit bekannter und unbekannter Kennung.

### 9.5 CI

`.github/workflows/ci-checks.yml`, Job `selftests`: neuer Schritt „Titler (DataLink-Schlüssel, Datenquelle)“ mit `npm run selftest -w @jm/titler`. Er darf kein Electron laden.

### 9.6 Durchgang mit gebauten Programmen

`apps/rundown/test/e2e-teil2a.mjs`, Abschnitt 9 wird von der Messung zur **Prüfung**:

- **9** wie heute, Prüfung: nach dem Einfügen steht weiter „Alan“ auf Sendung (`entry === 'Alan'`, `on_air === '1'`). Heute prüft die Zeile nur, dass gemessen wurde (`:553`).
- **9b Umschalten:** Alan auf Sendung, auf ein Side Event umschalten, dessen verknüpfte Speaker Alan nicht enthalten → `entry === 'Alan'`, `entry_index === '0'`, Logzeile A2.
- **9c Ausblenden:** danach `TITLER CLEAR`, 2 s warten → `entry === ''`.
- **9d Umbenennen:** Grace auf Sendung, im nachgebauten iveo die Funktion von Grace ändern → `entry === 'Grace'`, die Variable `funktion` ist neu.
- **9e Bild:**
  - Vor dem Start schreibt das Skript `titler-config.json` mit `template: 'lowerthird'`, `name: '{{name}}'`, `subtitle: '{{funktion}}'`. Der Titler startet mit `--remote-debugging-port=9335`.
  - Messpunkt ist die SHA-256 von `toDataURL()` des Vorschau-Canvas, gelesen über CDP, 1,5 s nach jeder Aktion.
  - Prüfung: Alan auf Sendung (Bild A), Speaker davor einfügen, Abfrage abwarten → Bild gleich A.
  - **Kontrolle, dass der Messpunkt einen Namenswechsel sehen kann:** `TITLER RECALL 2` → Bild ungleich A; wieder Alan abrufen → Bild gleich A.
- **Speakerdaten** im Skript (`speakerListe()`, `:177-178`) tragen die Kennung.
- **Gegenprobe:** Abschnitt 9 einmal gegen den gebauten Titler 0.9.0 laufen lassen. Er muss rot werden. Das Ergebnis kommt in den PR-Text.

---

## 10 · Release 1: Abnahme (Owner, ein Rechner, echtes iveo-Event auf Prod)

`apps/titler/ABNAHME-2b-R1.md`, je Schritt mit Ergebnisspalte. In iveo wird nichts geschrieben.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Launcher 0.14.0, Titler 0.10.0, Rundown 0.7.0 installieren | Versionen im Launcher sichtbar |
| 2 | Im Titler eine Vorlage mit `{{name}}` und `{{funktion}}` wählen. Eine Bestands-Show mit iveo öffnen, im Panel die Tagesübersicht wählen. | Daten / Recall zeigt „Quelle: Show „⟨Show⟩“ · ⟨n⟩ Speaker“ |
| 3 | Ein Side Event suchen, mit dem iveo Speaker verknüpft (beim Umschalten kommt **keine** Meldung „verknüpft keine Speaker“). Zurück auf die Tagesübersicht, einen Speaker abrufen, der dort **nicht** verknüpft ist. TAKE. | Bauchbinde zeigt ihn |
| 4 | Im Panel auf dieses Side Event umschalten | Dieselbe Person bleibt auf Sendung, Hinweis „… ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen …“ |
| 5 | Ausblenden | Nach etwa 1 s Hinweis „… Bitte einen Eintrag abrufen.“ |
| 6 | Zurück auf die Tagesübersicht, einen Speaker abrufen, TAKE, dann auf ein Side Event umschalten, das ihn verknüpft | Dieselbe Person bleibt, ohne Hinweis |
| 7 | Im Rundown an eine Zeile „Titler · Eintrag abrufen“ hängen, im Picker einen Speaker wählen, GO | Die richtige Person wird abgerufen. Chip zeigt den Namen. |
| 8 | Titler schließen und über die **Kachel** neu starten | Liste und Quelle wie vorher. Die nächste Umschaltung im Panel kommt an. |
| 9 | Im Titler einen eigenen DataLink-Ordner mit einer CSV wählen | Quelle „eigener Ordner“. Die Show-Liste ist weg. |
| 10 | Show erneut öffnen, dann „Zurück zum eigenen Ordner“ | erst Quelle Show, dann wieder der eigene Ordner mit der CSV |
| 11 | Companion: `TITLER RECALL 2` und Weiter | wie bisher über die Nummer |
| 12 (optional) | Nur mit einem unveröffentlichten Test-Speaker: dessen Funktion in iveo ändern, während er auf Sendung ist, auf die nächste Programmänderung warten | Funktion auf Sendung wechselt, Name bleibt |

---

## 11 · Release 1: Aufbau, Release, Doku

| Paket/App | Dateien | Inhalt |
| --- | --- | --- |
| `@jm/show` | `src/index.ts` | `ShowIveoSpeaker.id`, `loeseDoppelteKennungenAuf` (5.1) |
| `@jm/iveo` | `src/mapper.ts`, `test/selftest.ts` | 5.2, 9.1 |
| Launcher | `src/main/iveo-abgleich-kern.ts`, `test/iveo-abgleich.test.ts`, `test/show-speichern.test.ts` | 5.3, 6, 9.2 |
| Titler | 7.1 | 7 |
| Rundown | `src/shared/types.ts`, `doc-format.ts`, `zeilen.ts`; `src/main/index.ts`; `RowEditor.tsx`, `RundownList.tsx`, `lib/capabilities.ts`; `test/selftest.ts`, `test/e2e-teil2a.mjs` | 8, 9.4, 9.6 |
| CI | `.github/workflows/ci-checks.yml` | 9.5 |

**Nicht angefasst:** `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, Companion-Modul.

**Release:**
- Titler **0.10.0**, Launcher **0.14.0**, Rundown **0.7.0**.
- Changelog in `packages/suite-manifest/changelog.json`, ohne ASCII-Anführungszeichen in Texten. Vor dem Commit: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
- Release-Notes nennen: Rundown 0.7.0 ruft Speaker über die Kennung ab, wenn der Titler 0.10.0 läuft, sonst über den Namen. Der Titler überschreibt den eigenen DataLink-Ordner nicht mehr.
- Tags einzeln pushen (mehr als drei in einem Push lösen keine Workflows aus).
- **Doku:** `docs/jm-show.md:226-229` („Grenzen“) bekommt den Titler-Absatz: Die Bauchbinde hält ihre Person. `TITLER RECALL <nr>` bleibt nummernbasiert.
- Push, PR, Merge, Tags und Release erst nach Freigabe durch den Owner.

---

# Teil B · Release 2 „Show-Daten über den Verbund“

## 12 · Überblick

```
Master-Rechner A                                   Rechner B (ohne Launcher möglich)
 Launcher (Rolle Master)                            Timer / Titler / Rundown
   Show offen ── Ausschnitt (14) ── Verteiler (15)     Client (Teil 1) ── app-runtime (16)
                                      │  ▲                    │  angemeldet
                                      │  └──── abo ───────────┘
                                      ├──── stand ──────────▶ anwenden wie gelesene Datei (17)
                                      └──── aenderung ─────▶ anwenden (nur wenn neuer, 13.3)
 Tools auf A: Datei + RELOAD wie bisher (Einzelplatz-Weg)
```

- Ein Tool schickt nach jeder Anmeldung ein `abo`. Der Master antwortet mit `stand`. Jede spätere Änderung der offenen Show geht als `aenderung` an alle Abos.
- `stand` und `aenderung` tragen immer den **vollständigen** Ausschnitt. Ein verpasster Stand wird vom nächsten ersetzt.
- Die Leitung ist die bestehende Verbindung aus Teil 1, je Tool eine (Stern). Der Launcher auf B ist nicht beteiligt.

## 13 · Protokoll

### 13.1 Nachrichten

| Richtung | `t` | Felder |
| --- | --- | --- |
| C → M | `abo` | `art: 'show'`, `fassung: 1` |
| M → C | `stand` | `art: 'show'`, `fassung: 1`, `epoche`, `folge`, `schluessel`, `show`, `grund?` |
| M → C | `aenderung` | wie `stand` |

- `stand` ist die Antwort auf ein `abo`. `aenderung` kommt unaufgefordert.
- Der Master schickt beides nur an Sitzungen mit Abo und nie vor `angemeldet`.
- `schluessel`: Kennung der Show am Master, die ersten 16 Hex-Zeichen von SHA-256 über den mit `path.resolve` normalisierten, kleingeschriebenen Pfad. Das ist die Formel aus 2a-Spec 4.7 (`apps/rundown/src/main/gedaechtnis.ts:83-85`). Ohne offene Show `null`; bei `nicht-lesbar` der Schlüssel der offenen Show.
- `show`: der Ausschnitt (14) oder `null`.
- `grund` steht genau dann da, wenn `show` `null` ist: `keine-show`, `zu-gross` oder `nicht-lesbar`.
- `PROTOKOLL` bleibt 1. Fähigkeiten laufen über `fassung`. Der Master antwortet mit der höchsten Fassung, die er kennt und die nicht über der erbetenen liegt. In 2b gibt es nur Fassung 1.

### 13.2 Prüfung

- **Lockere Prüfer:** `abo`, `stand` und `aenderung` stehen in der Prüfer-Tabelle (`rahmen.ts:64-76`) mit einem Prüfer, der jedes Objekt annimmt. Sie gelten so nie als `kaputt` und kappen nie die Leitung (2.4, Nr. 2).
- **Inhalt** prüfen reine Funktionen in `packages/master-link/src/show-daten.ts`, `pruefeAbo` und `pruefeStand`:

| Feld | Regel |
| --- | --- |
| `art` | genau `'show'` |
| `fassung` | ganze Zahl ≥ 1 |
| `epoche` | 1–64 Zeichen aus `[A-Za-z0-9-]` |
| `folge` | ganze Zahl von 0 bis `Number.MAX_SAFE_INTEGER` |
| `schluessel` | `null` oder genau 16 Zeichen `[0-9a-f]` |
| `show` | `null` oder ein Objekt; das Tool liest es mit `migrateShow` |
| `grund` | fehlt, wenn `show` ein Objekt ist; sonst einer der drei Werte |

- Ungültiger Inhalt wird verworfen. Ins Log kommt eine Warnung, je Verbindung einmal je Typ und Fehlergrund. Die Leitung bleibt.

### 13.3 Epoche, Folge, Neuabo

- **Epoche:** `crypto.randomUUID()`, neu bei jedem Start des Verteilers, also bei jedem Start der Rolle Master (Launcher-Start, Rollenwechsel, „Master-Identität erneuern“).
- **Folge:** beginnt in jeder Epoche bei 0 mit dem ersten Stand. Sie steigt um 1, sobald sich `schluessel`, `show` oder `grund` vom vorigen Stand unterscheiden (Vergleich der serialisierten Form). Ein unveränderter Ausschnitt erzeugt keinen neuen Stand.
- **Am Tool:** Es merkt sich Epoche und Folge des zuletzt **angewendeten** Stands. Ein eingehender Stand gilt als neu, wenn seine Epoche abweicht oder seine Folge größer ist. Sonst wird er nicht angewendet; nur die Anzeige wechselt auf „aktuell“.
- **Neuabo:** Nach jeder Anmeldung (Ereignis `angemeldet`, `client.ts:550`), also auch nach jedem Wiederverbinden, schickt das Tool erneut `abo`. Die Sitzung am Master ist dann neu. Ein Stand mit gleicher Epoche und Folge wird nicht noch einmal angewendet.
- Eine Lückenerkennung braucht es nicht, weil jeder Stand vollständig ist.

### 13.4 Grenzen

| Grenze | Wert | Ort |
| --- | --- | --- |
| Zeile nach der Anmeldung | 1 MiB, unverändert | `fristen.ts:64` |
| Größte `aenderung`-Zeile, die der Master verschickt | 900 KiB (921 600 Byte) | Verteiler. Darüber geht `show: null`, `grund: 'zu-gross'` hinaus, und der Master schreibt eine Warnung (15.6). |
| Antwortfrist auf ein Abo | 5 s | app-runtime (16.2, 16.4 Zeile V3) |
| Abos je gekoppeltem Rechner | 32 | Verteiler. Weitere werden nicht beantwortet, eine Warnung je Rechner. |
| Stau-Grenze je Sitzung | 1 MiB im Schreibpuffer | Server (13.6) |

### 13.5 Transport-Reparaturen

| Falle | Reparatur | Test |
| --- | --- | --- |
| **Grenze je Stück statt je Zeile** (2.4, Nr. 3) | `ZeilenLeser` gibt Zeilen einzeln heraus. `Verbindung.aufDaten` entnimmt eine Zeile, gibt sie aus und entnimmt erst danach die nächste. Die Grenze gilt beim Entnehmen. So gilt für die Zeile nach `angemeldet` schon 1 MiB. Eine unvollständige Zeile über der Grenze wirft weiter. | `angemeldet` und eine Zeile mit 900 KiB im selben Stück → beide kommen an, keine Trennung. Vor der Anmeldung eine Zeile mit 4 KiB + 1 Byte → Trennung wie bisher. |
| **Kopieren je Stück** (`rahmen.ts:113`, `:123`) | Der Puffer ist eine Liste von Stücken. Gesucht wird nur im neuen Stück, ab der letzten Suchstelle. Zusammengefügt wird nur die fertige Zeile. | Ein Zähler für kopierte Bytes (nur im Test gesetzt): Eine Zeile von 1 MiB in Stücken zu 16 KiB kopiert höchstens 2 MiB. |
| **Übergabe nach `angemeldet`** (`client.ts:167-180`, `:532-584`) | `betreibe` gibt nachgeholte `stand`- und `aenderung`-Nachrichten wie neue aus (Ereignis `daten`). | `angemeldet` und `aenderung` im selben Stück → `daten` kommt an. |
| **Übergabe beim Koppeln** (`koppeln.ts:158`) | statt `removeAllListeners` wie `halteFest`. `uebernehme` gibt die festgehaltenen Zeilen an `betreibe` weiter. | `gekoppelt`, `angemeldet`, `stand` in einem Stück → nichts geht verloren. |
| **Strenge Prüfer** | lockere Prüfer (13.2) | Ein `stand` mit falschem Feld → Warnung, Verbindung bleibt. |
| **`PROTOKOLL` erhöhen** | bleibt 1 | Ein Teil-1-Client (ohne `abo`) bleibt angemeldet und bekommt keine 2b-Zeile. |

### 13.6 Rückdruck

- `Verbindung.sende` gibt zurück, ob die Zeile in den Puffer ging. Neu ist `sendeZeile(zeile)` für eine schon serialisierte Zeile. So serialisiert der Master einen Stand einmal und schreibt ihn an alle Abos.
- `MasterLinkServer.sendeDaten(schluessel, zeile)` liefert `'gesendet'`, `'gestaut'` oder `'weg'`.
  - Liegen im Schreibpuffer der Sitzung (`socket.writableLength`) mehr als 1 MiB, schreibt er nicht und markiert die Sitzung als gestaut.
  - Beim nächsten `drain` meldet er das Ereignis `entstaut(schluessel)`. Der Verteiler schickt dann den **neuesten** Stand, wenn er neuer ist als der zuletzt an diese Sitzung gesendete.
- Der Puls bleibt unberührt. Er ist klein.
- Ein Rechner im langsamen WLAN bekommt so nie mehr als einen ausstehenden Stand. Zwischenstände fallen weg; das ist richtig, weil jeder Stand vollständig ist.

### 13.7 API in `@jm/master-link`

**Server** (`server.ts`). Das bestehende Ereignis `aenderung` (Teilnehmerliste geändert, ohne Nutzlast) bleibt. Es hat mit der Nachricht `aenderung` nichts zu tun.
- Ereignis `daten(teilnehmer, n)`: eine `abo`-Nachricht einer angemeldeten Sitzung. `teilnehmer` = `{ schluessel, rechnerId, art, appId, dieserRechner }`.
- Ereignis `getrennt(schluessel)`: Sitzung zu (heute nur `aenderung`, `:424-432`).
- Ereignis `entstaut(schluessel)` (13.6).
- Methode `sendeDaten(schluessel, zeile)` (13.6).

**Client** (`client.ts`):
- `sende(n)`: nur im Zustand verbunden. Liefert `false`, wenn nichts hinausging.
- Ereignis `daten(n)` für `stand` und `aenderung`, auch für nachgeholte (13.5).
- `kopplung()`: `{ rolle, masterId, masterName } | null` aus `master-link.json`.

**Rahmen** (`rahmen.ts`): die drei Typen in `Nachricht` und in der Prüfer-Tabelle; `kodiere` kann sie.

---

## 14 · Inhalt: der Ausschnitt

### 14.1 Felder

`@jm/show` exportiert die reine Funktion `showFuerVerbund(show): { show: Show; lokalGeblieben: string[] }`. Sie arbeitet auf dem Ergebnis von `migrateShow`.

| Feld der Show | Im Ausschnitt |
| --- | --- |
| `schemaVersion`, `name`, `updatedAt` | ja |
| `ablauf` | ja, mit Kennungen (2a) |
| `iveo.event`, `iveo.name`, `iveo.syncedAt` | ja |
| `iveo.speakers` | ja, mit Kennungen (5) |
| `iveo.sideEvents`, `iveo.filter` | ja |
| `iveo.baseUrl` | **nein**. Kein Tool braucht sie. |
| `tools[].appId` | ja |
| `tools[].settings` | nur freigegebene Schlüssel (14.2) |
| `tools[].document` | **nein** (Dokumente, eigener Zyklus) |
| `tools[].network` | **nein** (Host und Port bleiben am Rechner) |

Ein Token steht nie in einer Show (`packages/show/src/index.ts:61-67`). Der Ausschnitt entsteht trotzdem aus einer Freigabeliste, damit ein falsch abgelegtes Feld nicht mitreist.

### 14.2 Einstellungen: was reist, was lokal bleibt

Es reisen nur die Schlüssel dieser Liste. Sie steht als `VERBUND_EINSTELLUNGEN` in `@jm/show`. Alles andere bleibt am Master und erscheint in `lokalGeblieben` als `⟨appId⟩.⟨Schlüssel⟩`.

| appId | reist | bleibt lokal (bekannt) | Fundstelle |
| --- | --- | --- | --- |
| `jm-timer` | `timetable`, `durationMs` | – | `apps/timer/src/main/index.ts:322-357` |
| `jm-qa` | `speakSeconds`, `moderation`, `autoTimer`, `autoTitler` | – | `apps/qa/src/main/index.ts:590-603` |
| `jm-battle` | `rounds`, `nameA`, `nameB`, `crewA`, `crewB` | – | `apps/battle/src/main/index.ts:436-450` |
| `jm-caption` | `model`, `language`, `ndiName` | – | `apps/caption/src/main/index.ts:285-295` |
| `jm-transcribe` | `model`, `language`, `task`, `formats` | `outputDir` (Ordner des Rechners) | `apps/transcribe/src/main/index.ts:160-181` |
| `jm-recorder` | `fileName`, `separateTracks` | `dir`, `channels`, `sampleRate` (Ordner und Audiogerät des Rechners) | `apps/recorder/src/main/index.ts:26-37` |
| `jm-player` | – | `show` (Bibliothek des Rechners), `outputDisplayId` (Bildschirm) | `apps/player/src/main/index.ts:26-37` |
| `jm-presenter` | – | `pin` (Geheimnis) | `apps/stage-display/src/main/index.ts:253-255` |
| `jm-connect` | `room` | – | `apps/connect/src/main/show-open.ts:33-35` |
| alle anderen | – | alles | – |

In 2b wenden nur Timer, Titler und Rundown den Ausschnitt an. Die Liste gilt trotzdem für alle Tools, damit spätere Empfänger kein neues Protokoll brauchen. Ein neuer Schlüssel braucht einen Eintrag in dieser Liste.

### 14.3 Größe

Gemessene `.jmshow` liegen bei 0,7 bis 15 KB, 270 Speaker ergaben 14 945 Byte (Ist-Karte Teil 2 vom 01.10.2026). Das liegt weit unter 900 KiB. Ins Log des Masters kommt bei jedem neuen Stand die Größe (15.6).

---

## 15 · Master-Launcher: Verteiler

### 15.1 Quelle und Auslöser

- **Neu:** `apps/launcher/src/main/verbund/verteiler.ts`, ohne Electron, getestet mit `tsx` wie `verbund/kern.ts`.
- **Quelle** ist die offene Show des Launchers, wie sie in der Datei steht, nach `migrateShow`.
- **Auslöser:** Der iveo-Kern bekommt die neue Abhängigkeit `meldeShow(pfad, show)`. Er ruft sie
  - in `showGeoeffnet` (`iveo-abgleich-kern.ts:354-357`, aufgerufen für jede Show, auch ohne iveo, `apps/launcher/src/main/show.ts:59`),
  - nach jedem erfolgreichen Schreiben, an denselben Stellen wie `benachrichtigeAlle()` (`:444`, `:507`, `:641`),
  - in `offeneShowGespeichert` (`:666-685`). Ist die gerade gespeicherte Show dort nicht lesbar (`:677-682`), ruft der Kern `meldeShow(pfad, null)`. Daraus wird `grund: 'nicht-lesbar'`.
- Die Hülle `iveo-sync.ts` reicht `meldeShow` an den Verteiler weiter, wenn die Rolle Master läuft.
- **Start der Rolle Master:** neue Epoche. Ist eine Show offen, wird sie gemeldet, sonst gilt `grund: 'keine-show'`.
- **Launcher-Start:** Es ist keine Show offen, bis der Bediener eine öffnet (2.3, Nr. 8). Abos bekommen bis dahin `keine-show`.

### 15.2 Abo-Verwaltung

- `MasterRolle` (`apps/launcher/src/main/verbund/master.ts`) gibt die Ereignisse `daten`, `getrennt` und `entstaut` des Servers an den Verteiler weiter, und `sendeDaten` zurück. Der Server bleibt privat.
- Ein `abo` von einer Sitzung mit `art: 'tool'` wird eingetragen und mit `stand` beantwortet.
- Ein `abo` von `art: 'launcher'` wird ignoriert, mit einer Logzeile. Der Slave-Launcher braucht in 2b keine Daten.
- Das Abo endet mit der Sitzung (`getrennt`).
- Der Verteiler merkt sich je Sitzung Epoche und Folge des zuletzt gesendeten Stands.

### 15.3 RELOAD nur an diesen Rechner

- Läuft die Rolle Master, schickt der Launcher `TIMER/TITLER/RUNDOWN RELOAD` nur an Endpunkte auf seinem eigenen Rechner.
- Eigener Rechner heißt: Die Adresse des Endpunkts ist `127.0.0.1`, `::1` oder eine Adresse einer eigenen Netzwerkkarte (`os.networkInterfaces()`). Die reine Prüfung `istDieserRechner(host, eigeneAdressen)` liegt in `health.ts`.
- `sendControlCommand` (`health.ts:195-205`) bekommt dafür die Option `{ nurDieserRechner: true }`.
- In den Rollen „aus“ und „Mit Master verbinden“ bleibt alles wie heute.

### 15.4 Side-Event-Liste auffrischen (Z3)

- **Listen-Abfrage und Umschalten auf die Tagesübersicht:** Mit dem Snapshot wird die Liste neu gebildet, wie beim Binden (`iveo-sync.ts:284-293`): Programme nach dem Filter ohne `programId`, daraus `{ id, title }`.
- **Agenda-Abfrage:** Sie fragt zusätzlich `listProgramsUpdatedSince(event, a.seListeIso)`. Liefert das etwas, lädt sie `listPrograms(event)` und bildet die Liste neu. Neuer Merker `seListeIso`, Anfangswert `syncedAt` der Show, rückt nach jedem erfolgreichen Zusatzabruf vor.
- Scheitert der Zusatzabruf, bleibt die Liste der Datei. Die Abfrage läuft weiter. Ins Log kommt eine Warnung beim ersten Fehlschlag.
- `schreibeAblauf` (`:290-311`) bekommt die Side Events als Parameter, statt sie nur aus der Datei zu übernehmen.
- Die Signatur (5.3) nimmt die Side Events als `[id, title]` auf. Eine geänderte Liste schreibt und benachrichtigt.

### 15.5 Anzeige im Verbund-Modal am Master

Eine Zeile unter „Gekoppelte Rechner“:
- „Show im Verbund: „⟨Show⟩“ · Stand ⟨hh:mm⟩ · ⟨n⟩ Tools beziehen sie“
- ohne offene Show: „Show im Verbund: keine Show offen“

### 15.6 Log

| Anlass | Zeile |
| --- | --- |
| neuer Stand | „Verbund: Show „⟨Show⟩“ verteilt (Stand ⟨Folge⟩, ⟨n⟩ KiB, ⟨k⟩ Abos). Lokal geblieben: ⟨Liste oder „nichts“⟩.“ |
| zu groß | „Verbund: Show zu groß für den Verbund (⟨n⟩ KiB > 900 KiB), nicht verteilt.“ |
| neues Abo | „Verbund: Abo von ⟨Rechnername⟩/⟨appId⟩ (⟨k⟩ Abos).“ |
| Stau | „Verbund: Sendung an ⟨Rechnername⟩/⟨appId⟩ gestaut, der neueste Stand folgt danach.“ |
| RELOAD (Rolle Master) | „iveo: RELOAD → ⟨n⟩ Timer, ⟨n⟩ Titler, ⟨n⟩ Rundown auf diesem Rechner; ⟨k⟩ Tools anderer Rechner bekommen die Daten über den Verbund.“ |

---

## 16 · Tool-Seite: `@jm/app-runtime`

### 16.1 Wann ein Tool dem Master folgt

| Lage (aus `master-link.json`) | Verhalten |
| --- | --- |
| Datei fehlt, Rolle „aus“, Rolle Slave ohne Kopplung, Datei nicht lesbar | **Einzelplatz:** wie 2a. Kein Abo, keine Anzeige. |
| Rolle Master (Tool auf dem Master-Rechner) | **Einzelplatz-Weg:** Datei und RELOAD wie 2a, kein Abo, keine Anzeige. |
| Rolle Slave mit Kopplung | Abo nach jeder Anmeldung. Der Verbundmodus beginnt mit dem ersten gültigen Stand **mit Show** von diesem Master oder beim Start mit einem zwischengespeicherten Stand desselben Masters (16.3). |

**Im Verbundmodus:**
- Ablauf, Speaker und Settings kommen nur vom Master.
- Ein Show-Deep-Link liefert nur noch Dokumente, etwa die Titler-Vorlage. Logzeile: „Verbund: Show-Deep-Link „⟨Pfad⟩“ liefert hier nur Dokumente, die Show-Daten kommen vom Master „⟨M⟩“.“
- RELOAD wird ignoriert. Logzeile: „Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „⟨M⟩“.“ Beide Zeilen erscheinen höchstens einmal je Minute.

**Vor dem Verbundmodus** (warten, Master ohne 2b, Master ohne Show, noch nie verbunden) arbeitet das Tool wie in 2a.

**Ende des Verbundmodus:** Rolle oder Kopplung ändern sich in der Datei. Der Zwischenspeicher wird gelöscht. Die Daten im Tool bleiben stehen, bis der nächste Deep-Link kommt.

### 16.2 API

```ts
// packages/app-runtime/src/index.ts (neu)
export interface MasterStand {
  masterId: string;
  masterName: string;
  epoche: string;
  folge: number;
  schluessel: string | null;
  show: Show | null;            // nach migrateShow
  grund?: 'keine-show' | 'zu-gross' | 'nicht-lesbar';
  empfangenAm: number;          // ms, Uhr dieses Rechners
}

interface MitStand {
  masterName: string;
  angewendet: MasterStand | null; // zuletzt angewendeter Stand (auch aus dem Zwischenspeicher)
  fehler?: string;                // Grund, wenn anwenden zuletzt geworfen hat
}
export type VerbundDaten =
  | { art: 'einzelplatz' }
  | ({ art: 'warte' } & MitStand)        // verbunden, Abo gesendet, noch keine Antwort (≤ 5 s)
  | ({ art: 'ohne-daten' } & MitStand)   // verbunden, 5 s ohne Antwort
  | ({ art: 'aktuell'; letzter: MasterStand } & MitStand)
  | ({ art: 'getrennt'; client: ClientZustand } & MitStand);

export function folgeMasterShow(h: {
  /** Nur mit show !== null. Wirft = nicht angewendet. */
  anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void;
  beiWechsel?(d: VerbundDaten): void;
}): void;
export function verbundDaten(): VerbundDaten;
export function imVerbundmodus(): boolean;
```

- `neueShow` ist wahr, wenn `masterId` oder `schluessel` vom zuletzt angewendeten Stand abweichen. Für den allerersten Stand ist es wahr.
- `letzter` ist der zuletzt **empfangene** Stand, `angewendet` der zuletzt angewendete. Bei `keine-show` unterscheiden sie sich.
- `fehler` trägt den Grund, wenn `anwenden` geworfen hat. Dann bleibt `angewendet` auf dem alten Stand, der Zwischenspeicher bleibt unverändert, und der nächste Stand versucht es erneut.
- `@jm/app-runtime` bekommt `@jm/show` als Abhängigkeit.

### 16.3 Zwischenspeicher

- `<userData des Tools>/verbund/master-stand.json` mit dem zuletzt angewendeten Stand und `fassung: 1`.
- Geschrieben wird nach erfolgreichem `anwenden`, atomar mit bis zu 5 Versuchen im Abstand von 50 ms (wie 2a-Spec 7.4).
- Beim Start: Stimmt `masterId` mit der Kopplung überein, gilt das Tool sofort im Verbundmodus. `anwenden` wird dann mit `neueShow = false` aufgerufen. Sonst wird die Datei gelöscht.
- Ist die Datei nicht lesbar, wird sie ignoriert, mit einer Warnung. Der nächste Stand überschreibt sie.

### 16.4 Anzeige

Dauerhafte Anzeigen lügen, wenn ein Zustand vergessen wurde (#208). Die Anzeige ist deshalb eine reine Funktion `verbundAnzeige(d: VerbundDaten): { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' } | null` in `packages/app-runtime/src/verbund-anzeige.ts`, ohne Electron. Sie prüft den Union-Typ vollständig (`never`). Getestet wird **jede Zeile** dieser Tabelle.

`⟨M⟩` = Name des Masters. `⟨S⟩ ⟨hh:mm⟩` = Name der Show (höchstens 40 Zeichen, sonst gekürzt mit „…“) und Empfangszeit des **angewendeten** Stands auf der Uhr dieses Rechners.

„… · letzter Stand: ⟨S⟩ ⟨hh:mm⟩“ heißt unten **Zusatz L**. Er steht genau dann da, wenn `angewendet` nicht `null` ist.

| # | Lage | Text | Farbe |
| --- | --- | --- | --- |
| V1 | `einzelplatz` | keine Anzeige | – |
| V2 | `warte` | „Verbunden mit ⟨M⟩ · Show wird geladen…“ + Zusatz L | gelb |
| V3 | `ohne-daten` | „⟨M⟩ sendet keine Show-Daten (Launcher-Update nötig)“ + Zusatz L | gelb |
| V4 | `aktuell`, `letzter` mit Show | „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“ | grün |
| V5 | `aktuell`, `keine-show`, etwas angewendet | „⟨M⟩ hat keine Show offen“ + Zusatz L | gelb |
| V6 | `aktuell`, `keine-show`, nichts angewendet | „⟨M⟩ hat keine Show offen“ | gedämpft |
| V7 | `aktuell`, `zu-gross` | „Show am Master zu groß für den Verbund“ + Zusatz L | rot |
| V8 | `aktuell`, `nicht-lesbar` | „Show am Master nicht lesbar“ + Zusatz L | rot |
| V9 | `getrennt`, Client sucht oder verbindet, etwas angewendet | „⟨M⟩ nicht verbunden“ + Zusatz L | gelb |
| V10 | `getrennt`, Client sucht oder verbindet, nichts angewendet | „Suche ⟨M⟩…“ | gelb |
| V11 | `getrennt`, Client-Fehler | „⟨M⟩ nicht erreichbar (⟨Code⟩)“ + Zusatz L | rot |
| V12 | jede Lage außer `einzelplatz` mit `fehler` | „Show vom Master nicht übernommen: ⟨Fehler⟩“, mit angewendetem Stand dazu „ · in Benutzung: ⟨S⟩ ⟨hh:mm⟩“ | rot |

- V12 hat Vorrang vor allen anderen Zeilen.
- Im Test wird jede Zeile mit und ohne angewendeten Stand geprüft, wo die Zeile beides zulässt.
- `⟨Code⟩` ist der Fehlercode aus Teil 1 (`fehler.ts`), etwa `zeit` oder `zertifikat`.
- Die Uhrzeit ist bewusst die Empfangszeit, nicht die Zeit des Masters. Die Uhren zweier Rechner können abweichen.

### 16.5 IPC und Platz in den Tools

- app-runtime registriert `ipcMain.handle('jmps:verbund-anzeige')` und schickt bei jedem Wechsel `jmps:verbund-anzeige` an alle Fenster. Die Netzarbeit bleibt im Main; die CSP bleibt unberührt.
- Jedes der drei Preloads bekommt `verbundAnzeige()` und `onVerbundAnzeige(cb)`.
- **Platz:**
  - Timer: Pille neben „Sync“ (`apps/timer/src/renderer/src/components/Topbar.tsx:57-58`)
  - Titler: Abzeichen vor „Suite · ⟨n⟩ verbunden“ (`OperatorView.tsx:249-277`); dazu Quelle Q4 „Quelle: Show vom Master „⟨S⟩““ in Daten / Recall
  - Rundown: im Statusstreifen der Tool-Verbindungen (`apps/rundown/src/renderer/src/App.tsx:163`, `components/ToolLinks.tsx`)

---

## 17 · Anwenden je Tool

Jedes Tool wendet den Stand an wie eine gelesene Datei (D3). Der Einstieg ist dieselbe Funktion wie beim Lesen der Datei, nur mit dem Show-Objekt statt des Pfads.

### 17.1 Timer

`applyShowFromPath` (`apps/timer/src/main/index.ts:322-357`) wird geteilt in Lesen und `wendeShowAn(show, mode)`.

| Lage | Verhalten |
| --- | --- |
| `neueShow` (erster Stand, Master hat eine andere Show geöffnet) | `wendeShowAn(show, 'initial')`: `tt:setAll` und `settings.durationMs`, wie beim Öffnen einer Show |
| gleiche Show, neuer Stand | `wendeShowAn(show, 'reload')`: `tt:replaceItems`, der aktive Punkt folgt seiner Kennung (2a-Spec 6.1), der Countdown bleibt |
| Start mit Zwischenspeicher | `'reload'` |
| `keine-show`, `zu-gross`, `nicht-lesbar` | nichts |

### 17.2 Titler

| Lage | Verhalten |
| --- | --- |
| Stand mit Speakern | TSV schreiben (mit `@kennung`), Datenquelle `master` (wie `show`, Ordner `iveo-data`), Schlüssel halten nach 7.3 |
| gleiche Show, keine Speaker | Liste bleibt, H3 |
| neue Show, keine Speaker | Datenquelle `ordner` |
| `keine-show`, `zu-gross`, `nicht-lesbar` | nichts |
| Deep-Link im Verbundmodus | nur die Vorlage importieren (C3) |

`show-zuletzt.json` bekommt im Verbundmodus `{ quelle: 'master', masterId, schluessel, showName }`.

### 17.3 Rundown

**Gedächtnis (Z5):**
- Auf Rechner B ist der Schlüssel des Gedächtnisses `sha256("master|" + masterId + "|" + schluessel)`, die ersten 16 Hex-Zeichen. Er passt damit in das Format des Zeigers (`apps/rundown/src/main/gedaechtnis.ts:177-196`).
- Auf dem Master-Rechner und am Einzelplatz bleibt der Pfad-Schlüssel aus 2a.
- Der Zeiger `regie/zuletzt.json` bekommt optional `quelle: 'master'`, `masterId`, `masterSchluessel`, `showName`. `showPfad` darf dann leer sein. Ein Rundown 0.6.0 verwirft einen solchen Zeiger und startet wie ohne Zeiger.

**Ladewege im Verbundmodus** (Ergänzung zu 2a-Spec 5.2):

| Weg | Verhalten |
| --- | --- |
| Stand mit `neueShow` | wie „Show-Deep-Link, andere Show“ (`ladeAndereShow`, `apps/rundown/src/main/index.ts:641`): Show merken, Ausgangsstand aus dem Gedächtnis mit Master-Schlüssel → Übergang (unten) → leer, dann `wendeShowAn`. Hinweis „Show vom Master „⟨S⟩“ übernommen.“ (kurz) |
| neuer Stand, gleiche Show | wie RELOAD (`reloadShow`, `:737`): `wendeShowAn`, Position nach R7 bzw. 4.4, bricht keine GO-Folge ab |
| `keine-show`, `zu-gross`, `nicht-lesbar` | nichts am Dokument |
| Start ohne Deep-Link, Zeiger mit `quelle: 'master'` | Gedächtnis mit Master-Schlüssel laden. Liegt ein Zwischenspeicher desselben Masters und derselben Show vor, wird er danach angewendet wie „neuer Stand, gleiche Show“. Sonst wartet der Rundown auf den Master. |
| Show-Deep-Link | Daten ignoriert (16.1) |
| `RUNDOWN RELOAD` | ignoriert (16.1) |
| „Öffnen…“ einer `.jmrundown` | Die Datei wird Ausgangsstand und sofort mit dem angewendeten Stand abgeglichen. „Speichern“ schreibt in die Datei (2a-Spec 4.8). |
| „Neu“ | leeres Dokument, sofort abgeglichen |

- **Neue oder gleiche Show** entscheidet der Rundown über seinen Zeiger (gemerkte Show = `masterId` + `masterSchluessel`), nicht über `neueShow`. So passt es auch dann, wenn app-runtime beim Start den Zwischenspeicher mit `neueShow = false` liefert, der Rundown aber zuletzt eine andere Show gemerkt hatte.
- **Übergang:** Gibt es für den Master-Schlüssel noch kein Gedächtnis, gilt der aktuelle Stand des Rundowns als Ausgangsstand, wenn sein Name dem Namen der Show gleicht. So bleiben Aktionen erhalten, wenn B bisher mit einer kopierten Datei derselben Show lief. Der Abgleich über die Kennungen ordnet sie zu.
- **Eigene Rundown-Datei der Show:** wird auf B nicht geladen. Logzeile einmal je Show: „Verbund: Die Rundown-Datei der Show liegt am Master und wird hier nicht geladen.“
- `ablaufSchluessel` und `eigeneTimerListe` (2a-Spec 6.2) kommen aus dem Stand. Timer und Rundown auf B haben damit dieselbe Liste. Die Annahme in `apps/rundown/src/shared/sprung.ts:19-20` gilt so auch über Rechner hinweg, bis auf das kurze Fenster, in dem ein Stand den einen schon erreicht hat und den anderen noch nicht.

### 17.4 Zwei Launcher (Z2)

- Der Conductor sammelt für die Rolle `launcher` alle Funde, statt den letzten zu nehmen (`apps/rundown/src/main/conductor.ts:81-88`).
- Reine Funktion `waehleLauncher(funde, ziel)`:

| Lage | Gewählt |
| --- | --- |
| Rolle Slave, verbunden | Fund, dessen Adresse die Adresse des Masters ist (Client-Zustand) oder in `angemeldet.adressen` steht. Ohne passenden Fund: direkt die Master-Adresse mit Port 8736. |
| Rolle Slave, nicht verbunden | Fund passend zur letzten Master-Adresse, sonst keiner |
| Rolle Master | Fund auf diesem Rechner (15.3) |
| Einzelplatz | wie heute: der letzte Fund |

- Manuelle Endpunkte haben weiter Vorrang (`mergeEndpoints`).
- Folge: `LAUNCHER SIDEEVENT` aus einem Rundown auf B landet beim Master, auch wenn auf B ein eigener Launcher läuft.

---

## 18 · Verhalten bei Master weg, Show zu, gemischten Versionen

| Lage | Tool auf B im Verbundmodus | Anzeige |
| --- | --- | --- |
| Netz kurz weg | Daten bleiben. Nach dem Wiederverbinden Neuabo; gleicher Stand wird nicht neu angewendet. | V9, danach V4 |
| Master-Launcher beendet | Daten bleiben | V9, nach dem ersten Fehlschlag der Suche V11 |
| Master-Launcher startet ohne Show | Daten bleiben | V5 |
| Master öffnet dieselbe Show wieder | neue Epoche; angewendet wird, das Ergebnis ist gleich (Abgleich idempotent) | V4 |
| Master öffnet eine andere Show | `neueShow`: Timer wie Show öffnen, Rundown anderes Gedächtnis, Titler neue Liste | V4 |
| Master-Rolle aus | Daten bleiben | V11 |
| Kopplung an B getrennt | Verbundmodus endet (16.1) | keine |
| Tool auf B startet neu, Master fehlt | Daten aus dem Zwischenspeicher | V9 bzw. V11 |
| Stand nicht anwendbar | alter Stand bleibt | V12 |

**Gemischte Versionen:**

| Master-Launcher | Tool auf B | Ergebnis |
| --- | --- | --- |
| ≤ 0.14 (ohne Verteiler) | 2b-Tool | `abo` wird ignoriert. Nach 5 s V3; das Tool arbeitet wie in 2a. |
| 0.15 | Timer ≤ 0.13, Titler ≤ 0.10, Rundown ≤ 0.7 | kein Abo, keine Daten. RELOAD vom Master erreicht B nicht mehr (15.3). Die Tools lesen ihre Datei nur beim Deep-Link. |
| 0.15 | 2b-Tool | Daten |
| beliebig | Tool auf dem Master-Rechner | Einzelplatz-Weg, unverändert |
| 0.15 | Slave-Launcher beliebiger Version | nicht beteiligt |
| Rolle „aus“ | alle | unverändert |

Ein Teil-1-Teilnehmer (Timer 0.12.0, Titler 0.9.0, Launcher 0.12.0) bekommt nie eine 2b-Zeile, weil der Master nur an Abos sendet.

---

## 19 · Release 2: Tests, CI, Durchgang

### 19.1 `@jm/master-link` (`npm run selftest -w @jm/master-link`)

- alle Tests aus 13.5
- `pruefeAbo`, `pruefeStand`: jede Regel aus 13.2, jeweils gültig und ungültig
- Server: `abo` → Ereignis `daten`; Sitzung zu → `getrennt`; `sendeDaten` an eine weg-Sitzung → `'weg'`
- Rückdruck: Der Client liest nicht (Socket pausiert) → nach mehr als 1 MiB `'gestaut'`; der Client liest wieder → `entstaut`
- Ein Teil-1-Client ohne `abo` bleibt angemeldet und bekommt keine 2b-Zeile
- Client: `sende` nur im Zustand verbunden; `kopplung()` liefert Rolle und Master

### 19.2 `@jm/show` (im iveo-Selbsttest)

- `showFuerVerbund`: `document`, `network`, `baseUrl` fehlen; jeder Schlüssel aus 14.2 reist oder bleibt; ein unbekannter Schlüssel `token` bleibt lokal und steht in `lokalGeblieben`
- Das Ergebnis läuft unverändert durch `migrateShow` (idempotent)

### 19.3 Launcher

- **neu `test/verteiler.test.ts`** (an `selftest:verbund` angehängt):
  1. Abo → `stand` mit Epoche und Folge 0 bzw. dem aktuellen Stand
  2. gleiche Show zweimal gemeldet → keine neue Folge
  3. geänderte Show → Folge + 1, `aenderung` an alle Abos, einmal serialisiert
  4. Ausschnitt über 900 KiB → `zu-gross`
  5. neue Epoche bei Neustart der Rolle
  6. `launcher`-Abo ignoriert; das 33. Abo eines Rechners ignoriert
  7. gestaut → nur der neueste Stand nach `entstaut`
  8. **Kein Token:** Der Test legt ein Token im nachgebauten Token-Speicher ab und eine Presenter-PIN in der Show. Beide stehen in keiner gesendeten Zeile.
- **Kern** (`test/iveo-abgleich.test.ts`): `meldeShow` an allen Stellen aus 15.1; Side-Event-Liste im Listen- und im Agenda-Modus; Zusatzabruf scheitert → Liste der Datei, Abfrage läuft weiter
- `istDieserRechner`: Loopback, eigene Adresse, fremde Adresse

### 19.4 app-runtime (neu `npm run selftest -w @jm/app-runtime`, mit `tsx`)

- `verbundAnzeige`: jede Zeile V1–V12
- Ablauf der reinen Zustandsmaschine (ohne Electron, mit übergebener Uhr): Abo nach `angemeldet`; nach 5 s `ohne-daten`; neuer und alter Stand nach 13.3; `neueShow`; `anwenden` wirft → `fehler`, Zwischenspeicher unverändert
- Zwischenspeicher: gleicher Master → Verbundmodus beim Start; anderer Master → gelöscht

### 19.5 Tools

- Timer: `wendeShowAn` mit `initial` und `reload`; RELOAD im Verbundmodus ignoriert
- Titler: Stand mit Speakern, gleiche Show ohne Speaker, neue Show ohne Speaker
- Rundown: Gedächtnis-Schlüssel auf B; Zeiger mit `quelle: 'master'` lesen und schreiben; Übergang mit gleichem Namen; `waehleLauncher` für jede Zeile aus 17.4

### 19.6 CI

Neuer Schritt im Job `selftests`: „app-runtime (Verbund-Anzeige, Abo-Zustand)“ mit `npm run selftest -w @jm/app-runtime`. Die übrigen Tests laufen in bestehenden Schritten; `selftest:verbund` im Launcher bekommt `tsx test/verteiler.test.ts` angehängt. Keiner lädt Electron. Die Zeitgrenze bleibt 15 min.

### 19.7 Durchgang mit gebauten Tools und Test-Master

`apps/launcher/test/e2e-teil2b-verbund.ts` (tsx), auf einem Rechner:
- Das Skript startet einen `MasterLinkServer` mit Test-Identität auf Port 8738 und den Verteiler mit einer Test-Show.
- Es schreibt für die Tools eine `master-link.json` mit Rolle Slave und fester Adresse `127.0.0.1`, wie die bestehenden Helfer der Master-Link-Tests. Vorher legt es die vorhandene Datei beiseite (Muster aus `e2e-teil2a.mjs:49-57`).
- Gestartet werden gebaute Timer, Titler und Rundown ohne Deep-Link.

**Prüfungen:**
1. Alle drei zeigen die Test-Show (STATE von Timer, Titler, Rundown).
2. Änderung am Ablauf → angewendet in höchstens 2 s.
3. Bauchbinde auf Sendung, Speakerliste ohne diese Person verteilen → `entry` bleibt.
4. Server stoppen → Daten bleiben; Server mit neuer Epoche und gleicher Show starten → kein Hinweis im Rundown.
5. Tool neu starten, ohne Server → Daten aus dem Zwischenspeicher.
6. Gleichzeitiges RELOAD über den Steuerport → ignoriert, Logzeile.

---

## 20 · Release 2: Abnahme (Owner, zwei Rechner)

`packages/master-link/ABNAHME-2b.md`, je Schritt mit Ergebnisspalte. Rechner A = Master, Rechner B gekoppelt wie in Teil 1.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Launcher 0.15.0, Timer 0.14.0, Titler 0.11.0, Rundown 0.8.0 auf A und B | Versionen sichtbar |
| 2 | An A eine iveo-Show öffnen. Auf B Timer, Titler und Rundown über die Kachel starten, **ohne** Show auf B. | Alle drei zeigen „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“ und die Daten der Show. Das Verbund-Modal an A zeigt „… · 3 Tools beziehen sie“. |
| 3 | An A im Panel ein Side Event umschalten | Auf B wechseln Timer, Titler und Rundown in höchstens 3 s. Der Rundown meldet den Kontextwechsel. |
| 4 | In iveo am Test-Side-Event einen Agenda-Punkt einfügen (wie 2a-Abnahme) | Auf B nach der Abfrage am Master (höchstens 45 s) plus höchstens 3 s |
| 5 | Auf B eine Bauchbinde auf Sendung, an A auf ein Side Event umschalten, das die Person nicht verknüpft | Die Person bleibt auf Sendung, mit Hinweis |
| 6 | Auf B den Launcher starten. Im Rundown auf B ein GO mit „Launcher · Side Event“ | Die Umschaltung passiert an A (Log an A), nicht am Launcher von B |
| 7 | Netzkabel an B 60 s ziehen, dann wieder stecken | Während der Trennung „⟨M⟩ nicht verbunden · letzter Stand …“, die Daten bleiben. Danach wieder grün, ohne Hinweis im Rundown. |
| 8 | Launcher an A beenden; dann ohne Show starten; dann die Show öffnen | erst „nicht verbunden · letzter Stand“, dann „hat keine Show offen · letzter Stand“, dann grün |
| 9 | An A eine andere Show öffnen | Auf B: Timer neu wie beim Öffnen einer Show, Rundown mit der neuen Show, Titler mit der neuen Liste |
| 10 | Auf B den Titler schließen, Launcher an A beenden, Titler auf B starten | Daten aus dem letzten Stand, „nicht verbunden · letzter Stand …“ |
| 11 | Show an A mit Timer-Einstellungen und einem Recorder-Ordner öffnen | Timer auf B nutzt die Timer-Liste. Log an A: „Lokal geblieben: jm-recorder.dir …“ |
| 12 | Auf B einen Timer 0.13.0 laufen lassen (falls zur Hand) | läuft wie bisher, ohne Daten und ohne Absturz |
| 13 | An A die Rolle „aus“, ein Rechner allein | Show-Start, RELOAD und Anzeigen wie vor 2b |

---

## 21 · Release 2: Aufbau, Release, Doku

| Paket/App | Dateien | Inhalt |
| --- | --- | --- |
| `@jm/master-link` | `src/rahmen.ts`, `verbindung.ts`, `client.ts`, `server.ts`, `koppeln.ts`, **neu** `show-daten.ts`, Tests | 13 |
| `@jm/show` | `src/index.ts` | `showFuerVerbund`, `VERBUND_EINSTELLUNGEN` (14) |
| `@jm/app-runtime` | `src/index.ts`, **neu** `verbund-anzeige.ts`, **neu** `verbund-daten.ts` (Zustandsmaschine ohne Electron), **neu** `test/`, `package.json` | 16 |
| Launcher Main | **neu** `verbund/verteiler.ts`, `verbund/master.ts`, `verbund/kern.ts`, `iveo-abgleich-kern.ts`, `iveo-sync.ts`, `health.ts`, Tests | 15 |
| Launcher Renderer | Verbund-Modal am Master | 15.5 |
| Timer | `src/main/index.ts`, `src/preload/index.ts`, `Topbar.tsx`, Selbsttest | 17.1, 16.5 |
| Titler | `src/main/index.ts`, `show-quelle.ts`, `src/shared/datenquelle.ts`, Preload, `OperatorView.tsx`, Selbsttest | 17.2, 16.5 |
| Rundown | `src/main/index.ts`, `conductor.ts`, `gedaechtnis.ts`, Preload, `ToolLinks.tsx`, Selbsttest | 17.3, 17.4, 16.5 |
| CI | `.github/workflows/ci-checks.yml` | 19.6 |

**Nicht angefasst:** `packages/suite-control-protocol`, Companion-Modul, Timer-Socket `:7777`, Connect, Q&A, Battle.

**Release:**
- Launcher **0.15.0**, Timer **0.14.0**, Titler **0.11.0**, Rundown **0.8.0**. Die Tools bringen das neue `app-runtime` und `master-link` mit.
- Changelog, Tags und Freigabe wie in 11.
- Release-Notes nennen: Tools auf einem zweiten Rechner brauchen das Update, sonst bekommen sie keine Show-Daten und kein RELOAD mehr vom Master.
- **Doku:** `docs/suite-verbund.md` bekommt den Abschnitt „Show-Daten im Verbund“: was reist, was lokal bleibt, die Anzeige. `docs/jm-show.md:226-229` verweist darauf statt auf „folgt mit Teil 2b“.

---

# Gemeinsam

## 22 · Sicherheit

- **Kein Token verlässt den Master.** Eine Show trägt nie ein Token (`packages/show/src/index.ts:61-67`). Der Ausschnitt entsteht aus einer Freigabeliste (14). Der Test 19.3 Nr. 8 prüft jede gesendete Zeile gegen das Test-Token.
- **Keine Geheimnisse in Settings:** Die Presenter-PIN bleibt lokal. Neue Schlüssel reisen erst nach einem Eintrag in `VERBUND_EINSTELLUNGEN`.
- **Wer Daten bekommt:** nur Sitzungen, die sich mit dem Ed25519-Schlüssel eines gekoppelten Rechners angemeldet haben (Teil 1). Die appId meldet der Teilnehmer selbst. Jeder Prozess, der `master-link.json` eines gekoppelten Rechners lesen kann, kann also abonnieren. Das ist dieselbe Vertrauensstufe wie in Teil 1; die Daten sind token-frei.
- **Begrenzt:** höchstens 32 Abos je Rechner, Zeilen höchstens 900 KiB, Stau-Grenze 1 MiB je Sitzung.
- **Eine Richtung:** Tools schreiben nichts an den Master zurück. Ungültige Inhalte werden verworfen, ohne die Leitung zu kappen.
- **Steuerebene:** `LAUNCHER SIDEEVENT` aus einem Rundown auf B läuft über den Steuerport 8736 des Masters. Im secure-Modus klappt das nur mit gleich provisionierter `control.json` auf beiden Rechnern (heute je Rechner eigenes Token, `apps/launcher/src/main/control-provision.ts:42-56`). Das bleibt so; Folgeaufgabe FA7.
- **Timer `:7777`:** unverändert offen ohne Anmeldung (Folgeaufgabe FA1).

---

## 23 · Messaufgaben (vor Beginn des Plans von Release 1)

Gemessen wird an einem echten Prod-Event mit dem iveo-Token des Owners. M1, M2 (b) und M3 lesen nur. M2 (a) setzt am unveröffentlichten Test-Side-Event eine Speaker-Verknüpfung und nimmt sie danach zurück. Die Ergebnisse kommen in diese Spec und in den Plan.

| # | Frage | Messung | Wenn ja | Wenn nein |
| --- | --- | --- | --- | --- |
| M1 | Sind iveo-Speaker-IDs je Event eindeutig und stabil? | `GET /events/{e}/speakers` zweimal im Abstand von mindestens 10 min, dazu nach dem Binden einer Show der Vergleich mit dem Launcher-Cache (`mapper.ts:369` legt die IDs dort ab). Prüfen: UUID-Form, keine Doppelten, gleiche Menge. | Release 1 wie beschrieben | Der Mapper (SP2) lässt `id` weg. Titler und Rundown arbeiten dann mit Ersatz-Schlüsseln bzw. Namen, die 7.2 und 8.3 schon vorsehen. Das ist eine Zeile im Mapper. |
| M2 | Meldet iveo Speaker-Änderungen über `updated_at` bzw. `updated_since`? | (a) Am unveröffentlichten Test-Side-Event: Kommt bei `GET /programs?updated_since=⟨t0⟩` ein Programm, nachdem ein Speaker mit ihm verknüpft wurde? (b) Filtert `GET /speakers?updated_since=⟨t⟩`? Dafür reicht ein Aufruf mit einem Zeitpunkt in der Zukunft: Kommt eine leere Liste, filtert iveo. | (b) filtert: Folgeaufgabe FA5, Variante A. Das Ergebnis von (a) steht dabei. | (b) filtert nicht: Folgeaufgabe FA5, Variante B |
| M3 | Ist die Reihenfolge der Speaker stabil? | Drei Abrufe von `/speakers` ohne Änderung, Reihenfolge vergleichen. | Reihenfolge der API bleibt | Der Mapper (SP2) sortiert stabil nach Nachname, Vorname, Kennung (`localeCompare` mit `de`). Damit bleiben `TITLER RECALL <nr>`, Weiter und Zurück verlässlich. Die Bauchbinde auf Sendung hängt seit Release 1 ohnehin nicht mehr an der Reihenfolge. |

Release 2 braucht keine weitere Messung vorab. Die Zeiten aus 20 (höchstens 3 s) misst die Abnahme.

---

## 24 · Nicht in 2b: Folgeaufgaben

| # | Aufgabe | Warum nicht jetzt |
| --- | --- | --- |
| FA1 | **Anmeldung am Timer-Socket `:7777`** (Teil-1-Spec `:728`, `:896`). Stage Display und Presenter müssen dann ein Token senden (`apps/stage-display/src/main/timer-client.ts:32-46`). | Ändert drei Tools. 2b-Daten laufen über den angemeldeten Master-Link, nicht über `:7777`. |
| FA2 | **Dokumente, Medien, Fotos** (`.jmpres` bis 33 MB, Materialien, Speaker-Fotos, eigene Rundown-Datei auf B) | eigener Zyklus (Owner 01.10.2026). Braucht einen Binärkanal. |
| FA3 | **Connect als Speaker-Empfänger** über den Verbund | Connect liest weiter beim Deep-Link. Kein Positionsrisiko (Erkennung über den Namen). |
| FA4 | **„Zuletzt gefunden“ in Q&A und Battle** (`apps/qa/src/main/coupling.ts:99-106`, `apps/battle/src/main/coupling.ts:82`) | gleiche Regel wie 17.4, aber außerhalb des Auftrags 2a `:841` |
| FA5 | **Speaker-Änderungen ohne Programmänderung** (2.3, Nr. 4). Variante A: Die Listen-Abfrage fragt zusätzlich `/speakers?updated_since`. Variante B: Sie holt `/speakers` bei jeder Abfrage (bei 270 Speakern zwei Seiten zu 200, alle 45 s). | Hängt an M2. Release 1 macht den Titler sicher gegen jede Änderung; wie schnell Änderungen ankommen, ist eine eigene Frage. |
| FA6 | **RELOAD im secure-Modus vor der Auth** (`docs/roadmap.md:206`) | vorbestehend, betrifft den Einzelplatz-Weg |
| FA7 | **Steuerebene über Rechner im secure-Modus** (gemeinsame Provisionierung) | eigenes Sicherheitsthema |
| FA8 | **iveo-Live je Bühne** über denselben Kanal (neue `art` im Abo) | 2c |
| FA9 | **Anzeige in weiteren Tools**, sobald sie den Stand anwenden (Q&A, Battle, Caption) | in 2b wenden nur Timer, Titler, Rundown an |
| FA10 | **Roadmap** `docs/roadmap.md` kennt den Master-Link nicht (Stand 07.08.2026) | Doku-Pflege außerhalb von 2b |

---

## 25 · Risiken

| # | Risiko | Gegenmittel |
| --- | --- | --- |
| 1 | Die 2a-Abnahme auf Prod ist noch offen (`apps/rundown/ABNAHME-2a.md`, keine Ergebnisse). Release 1 baut auf 2a auf. | Release 1 erst nach der 2a-Abnahme releasen oder beide Abnahmen in einem Termin. |
| 2 | Gemischte Versionen Rundown/Titler bringen den falschen Speaker auf Sendung. | `recall_kennung` im STATE (8.3), Rückfall auf den Namen |
| 3 | Bestands-Shows im Agenda-Modus bekommen Speaker-Kennungen spät (5.3). | Ersatz-Schlüssel halten über den Namen. Abnahme Schritt 2 schaltet auf die Tagesübersicht; das schreibt die Kennungen nach. |
| 4 | Ein Timer auf B wird zurückgesetzt, wenn der Master eine andere Show öffnet. | gewollt, wie das Öffnen einer Show am Einzelplatz (2a-Spec 12). Steht in den Release-Notes. |
| 5 | Zwei Quellen auf B (lokaler Deep-Link und Master) verwirren. | Vorrang-Regel und Logzeilen (16.1), Anzeige |
| 6 | Rückdruck im echten WLAN ist nicht gemessen. | Stau-Grenze, nur neuester Stand (13.6); Abnahme Schritt 7 |
| 7 | Tools auf B ohne Update verlieren RELOAD vom Master (15.3). | Release-Notes; das RELOAD brachte ihnen ohnehin nur ihre eigene, alte Datei (2a-Spec `:840`). |
| 8 | Der Test-Master im Durchgang 19.7 nutzt Port 8738. Ein laufender Launcher im Master-Modus stört. | Das Skript prüft vorher, dass der Port frei ist, und bricht sonst mit Meldung ab. |
| 9 | Die Uhrzeit „Stand hh:mm“ ist die Empfangszeit auf B, nicht die Zeit der Änderung am Master. | bewusst (16.4); bei abweichenden Uhren wäre die Master-Zeit irreführend |

---

## 26 · Vorschlag: zwei Pläne

Die Spec bleibt eine. Ich schlage **je Release einen eigenen Plan** vor:

- **Release 1** ist in sich geschlossen. Es fasst keinen Netz-Code an und wird am Einzelplatz abgenommen. Es behebt einen gemessenen Fehler auf Sendung und soll deshalb schnell raus (D1).
- **Release 2** berührt vier Pakete (`master-link`, `app-runtime`, `show`, Launcher-Verbund) und drei Tools und braucht eine Abnahme an zwei Rechnern. Zum Vergleich: Der Plan von 2a hat 14 598 Zeilen, der von Teil 1 9 305. Ein gemeinsamer Plan käme erst spät zur ersten Prüfung.
- **Abhängigkeit:** Release 2 setzt die Speaker-Kennung und den Titler-Schlüssel aus Release 1 voraus. Der Plan von Release 2 beginnt deshalb erst, wenn Release 1 gemergt ist. Die Messaufgaben (23) gehören an den Anfang des Plans von Release 1.
