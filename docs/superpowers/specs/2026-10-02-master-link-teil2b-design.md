# Master-Link, Teil 2b: Der Titler hält seinen Speaker, Show-Daten über den Verbund

**Stand:** 02.10.2026, **vom Owner freigegeben am 02.10.2026** (Antworten auf die offenen Fragen in Abschnitt 27). Überarbeitet nach der Spec-Prüfung vom 02.10.2026 (zwei Linsen, Code und Vollständigkeit). Offene Fragen an den Owner stehen in Abschnitt 27.
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
| 1 | Rundown-Picker speichert die Kennung | Neues Feld `speakerId` an der Aktion. `args[0]` behält den Namen. Versteht der Titler Kennungen (STATE `recall_kennung=1`), sendet der Rundown `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`. Der Titler sucht dann die Kennung und fällt auf den genauen Namen zurück (7.4). Sonst sendet der Rundown den aktuellen Namen (8.3). | Ein Titler 0.9.0 findet eine Kennung nicht und tut nichts (`apps/titler/src/main/datalink.ts:204-219`). Das folgende TAKE brächte den vorher aktiven Speaker auf Sendung. Der Name in der `@`-Form deckt Listen ohne Kennungen ab (eigene CSV, frühere Show, Bestands-Show). Das Feld `zielId` ist für `timer goto` belegt und wird bei R0 umgeschrieben (2a-Spec 4.2). |
| 2 | D2: Fällt die Person weg, bleibt die Bauchbinde stehen | Das gilt **auf Sendung**. Ohne Sendung gibt es danach keinen aktiven Eintrag, mit Hinweis. Geht eine gehaltene Bauchbinde von der Sendung, fällt der gehaltene Eintrag 1 s später weg (7.3). | Sonst brächte ein späteres TAKE eine gestrichene Person auf Sendung. Die 1 s deckt die Ausblendung ab (450 ms, `apps/titler/src/renderer/src/lib/engine.ts:15`). Sonst verschwänden die Texte mitten in der Animation. Die Vorlage zur Owner-Frage O2 (Variante A) sah „ohne Sendung kein aktiver Eintrag“ schon vor. |
| 3 | Launcher unterscheidet Abruffehler von „0 Speaker“ | Nach einem Fehler holt jede weitere Listen-Abfrage den Snapshot, bis die Speakerliste wieder kommt. So lange bleibt die Statuszeile „gestört“ (6.2). | Im Listen-Modus holt die Abfrage den Snapshot nur bei einer Programmänderung (`apps/launcher/src/main/iveo-abgleich-kern.ts:394-398`). Ohne Nachholen stünde die Statuszeile auf „in Ordnung“, obwohl die Speaker veraltet sind. |
| 4 | Tool-Settings ohne rechnergebundene Felder | Umgesetzt als **Freigabeliste** je Tool. Nur genannte Schlüssel reisen, alles andere bleibt lokal. Die Presenter-PIN bleibt lokal (14.2). | Eine Sperrliste ließe jeden neuen Schlüssel ungeprüft über das Netz, auch Geheimnisse wie die PIN (`apps/stage-display/src/main/index.ts:253-255`). |
| 5 | RELOAD an fremde Rechner wird durch Daten ersetzt | Doppelt abgesichert: Der Master-Launcher schickt RELOAD nur noch an Tools auf seinem eigenen Rechner (15.3). Ein Tool, das dem Master folgt, ignoriert RELOAD (16.1). | Ein zweiter Launcher mit iveo-Token oder ein alter Master schickt sonst weiter an jedes Tool im LAN (`apps/launcher/src/main/health.ts:195-205`). |
| 6 | – | Tools auf dem **Master-Rechner** abonnieren nicht. Sie lesen weiter die Datei und bekommen RELOAD (16.1). | „Einzelplatz-RELOAD bleibt“. Die Datei am Master ist die Quelle des Verteilers. Ein zweiter Weg auf demselben Rechner brächte doppeltes Anwenden. |
| 7 | – | Jedes Tool legt den zuletzt angewendeten Stand vom Master auf der Platte ab (16.3). | Sonst zeigt ein Tool, das neu startet, während der Master fehlt, weder Daten noch „letzter Stand“ (D4). |
| 8 | – | Antwortet der Master 5 s nicht auf das Abo, arbeitet das Tool wie in 2a weiter, zeigt „⟨M⟩ antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)“ (16.4, V3) und wiederholt das Abo alle 30 s (13.3). | Ein Master ohne 2b ignoriert `abo` (`packages/master-link/src/server.ts:230-238`). Ohne Frist stünde „Show wird geladen…“ für immer da. Die Frage-Form, weil auch ein voller Verteiler (32 Abos) schweigt; ein Stand, den das Tool verwirft, hat eine eigene Zeile (V15). |
| 9 | – | Die eigene Rundown-Datei einer Show wird auf Rechner B nicht geladen (17.3). | Sie ist ein Dokument mit einem Pfad am Master. Dokumente gehören in den eigenen Zyklus. |
| 10 | – | Das Verbund-Modal am Master zeigt die Zeile „Show im Verbund …“ (15.5). | Für die Abnahme muss sichtbar sein, was der Master verteilt. |
| 11 | – | Im Titler gibt es den Knopf „Zurück zum eigenen Ordner“ (7.7). | Wenn die Show den eigenen DataLink-Ordner nicht mehr überschreibt, braucht der Bediener einen Weg zurück zu seinem Ordner. |
| 12 | e2e „Name bleibt Alan“ als Prüfung | Die **Owner-Abnahme** von Release 1 prüft live über das Umschalten eines Side Events, nicht über einen eingefügten Speaker (10). | Ein neuer Speaker im Prod-Event kann öffentlich sichtbar werden. Das Einfügen prüft der Durchgang mit nachgebautem iveo (9.6). |
| 13 | – | Ein Abruf ohne Treffer hält nie still den alten Eintrag. Ohne Sendung gibt es danach keinen aktiven Eintrag, auf Sendung bleibt das Bild eingefroren stehen, jeweils mit Hinweis (7.3 A10/A11). | Heute bleibt der alte Eintrag aktiv (`datalink.ts:216`). Das TAKE der GO-Folge brächte dann die vorherige Person auf Sendung, also genau den Fehler aus Nr. 1. |
| 14 | – | **Brücke** zwischen Ersatz-Schlüssel und Kennung über Datei und Name (7.3), wie die Titel-Brücke R0 in 2a. | Beim Nachschreiben der Kennungen (5.3) ändert sich jeder Schlüssel einer Bestands-Show. Ohne Brücke meldete der Titler „nicht mehr in der Liste“, obwohl niemand fehlt. |
| 15 | (4) Abruffehler: alte Liste mit Hinweis „Liste aus früherem Stand“ | Der Merker steht in der Show (`iveo.speakerVeraltetSeit`, 6.2). Der Titler zeigt daraus H7 (7.8). | Den Abruffehler sieht sonst nur das iveo-Panel des Launchers, nicht der Titler-Bediener, in Release 2 auch nicht auf Rechner B. |
| 16 | – | Scheitert die Speakerliste, kommt „Verantwortlich“ aus der gelesenen Datei (6.2). | Heute entsteht `owner` aus der Speakerliste (`iveo-abgleich-kern.ts:410`). Eine leere Liste löschte jeden `owner` und schickte RELOAD. |
| 17 | D4 | Auf Rechner B nutzt der Titler seinen eigenen DataLink-Ordner nur, solange die Show am Master keine Speaker trägt (17.2). | D4 „folgt immer“. Die Alternative steht als Frage O1 in Abschnitt 27. |
| 18 | D4 | Endet die Kopplung, bleiben die Daten vom Master mit dem Hinweis „Daten vom früheren Master“ stehen, bis eine eigene Show sie ersetzt (16.1). | Sonst zeigten die Tools Master-Daten ohne jede Anzeige, und ein Neustart fände einen Zeiger auf einen Master, den es nicht mehr gibt. |

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
| **Brücke** | Zuordnung eines Eintrags über Datei und Label, wenn sein Schlüssel zwischen Ersatz-Schlüssel und Kennung wechselt (7.3). |
| **`@`-Form** | `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`: Abruf über die Kennung, mit dem genauen Namen als Rückfall (7.4). |
| **Merker „Speaker veraltet“** | Feld `iveo.speakerVeraltetSeit` der Show: Die Speakerliste von iveo war seit diesem Zeitpunkt nicht abrufbar (6.2). |
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
| SP9 | `apps/launcher/test/iveo-abgleich.test.ts:217`, Testdaten `ANA` | Testdaten | `id: 'sp1'`, passend zum nachgebauten iveo (`:159`). Ohne Kennung wiche die Signatur nach jedem Snapshot von der Datei ab: Fast alle Listen-Tests bauen ihre Show mit `[ANA]` (`:349`, `:452`, `:515`, `:601`, `:745`, `:880`, `:900`, `:924`, `:977`), und die 2a-Prüfung „Nr. 2: … nichts geschrieben, kein RELOAD“ würde rot. Für 9.2 Nr. 2 (Nachschreiben) bekommt der Test ein **eigenes** Fixture ohne `id`. |
| SP10 | `apps/launcher/test/show-speichern.test.ts:48`, Testdaten | Testdaten | Speaker mit `id`, damit 9.2 Nr. 8 die Kennung über Laden und Speichern prüfen kann |

**Durchreicher** (bauen nichts neu, das Feld überlebt): Launcher-Kern `:305`, `:483`, `:541`, `:624`; Binden `apps/launcher/src/main/iveo-sync.ts:185`, `:192`, `:323`; Show-Editor `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:229`, `:242`, `:346` und `apps/launcher/src/renderer/src/lib/show-speichern.ts:136`; IPC-Typ `apps/launcher/src/shared/types.ts:240`; Rundown `apps/rundown/src/main/index.ts:563`. Ein Test prüft, dass Laden und Speichern im Show-Editor die Kennung behält (9.2).

**Nicht angefasst:** `mapper.ts:369` (Cache-Metadaten, eigener Typ, trägt `id` schon).

### 5.3 Signatur und einmaliges Nachschreiben

- Die Signatur nimmt die Kennung auf. Nach dem Update unterscheidet sich die Signatur einer Bestands-Show deshalb einmal von der Datei. Die nächste schreibende Abfrage trägt die Kennungen nach und schickt RELOAD, wie in 2a-Spec 7.2.
- **Wann eine Bestands-Show die Kennungen bekommt:**
  - Listen-Modus: bei der ersten Programmänderung, beim Umschalten auf die Tagesübersicht oder beim Binden.
  - Agenda-Modus: beim Binden oder beim Umschalten auf ein Side Event mit verknüpften Speakern. Der Agenda-Modus nimmt die Speaker sonst aus der Datei (`iveo-abgleich-kern.ts:483`).
- Bis dahin hält der Titler über den Ersatz-Schlüssel, also über Datei und Namen (7.2). Ein Zwangs-Schreiben gibt es nicht.
- Beim Nachschreiben wechselt jeder Schlüssel von `ersatz:speakers.tsv|⟨Name⟩` auf die Kennung. Die Brücke in 7.3 ordnet den aktiven und den gehaltenen Eintrag dabei über Datei und Namen zu. Ohne sie gälte der aktive Schlüssel als „fehlt“ (A2/A3).

### 5.4 Verträglichkeit

| Kombination | Verhalten |
| --- | --- |
| Neuer Launcher, alter Titler (0.9.0) | Der alte Normalisierer verwirft `id`. Der Titler verhält sich wie heute. |
| Alter Launcher (0.13.x), neuer Titler | Speaker ohne Kennung. Der Titler hält über den Ersatz-Schlüssel: Die Person bleibt, solange ihr Name gleich bleibt. |
| Neue Show, alter Rundown (0.6.0) | Der Picker schreibt weiter Namen. Der Titler findet sie über das Label (7.4). |
| Alter Launcher speichert eine Show mit Kennungen im Show-Editor | Die Kennungen gehen verloren. Der Titler wechselt auf Ersatz-Schlüssel. Die Brücke (7.3) ordnet zu: Ein Name, der in der Datei genau einmal vorkommt, hält. Ein doppelter Name hält nicht (A2/A3 mit Hinweis). |
| Bestands-Show bekommt Kennungen (5.3) | Brücke von Ersatz-Schlüssel auf Kennung, wie in der Zeile davor in Gegenrichtung |

---

## 6 · Launcher: ein Abruffehler ist nicht „0 Speaker“

### 6.1 Heute

Scheitert `/speakers`, gilt das als leere Liste (2.3, Nr. 1–3). Die Show verliert ihre Speaker. Der Rundown-Picker verliert die Liste, der Titler behält zufällig seine alte (`apps/titler/src/main/index.ts:149`). Dazu verliert jeder Ablaufpunkt sein „Verantwortlich“: `owner` entsteht aus `speakerNameMap(snap.speakers)` (`iveo-abgleich-kern.ts:410`, `:612`), eine leere Liste ergibt keinen Namen (`packages/iveo/src/mapper.ts:89-90`). Die Signatur enthält `owner` (`:184`), also wird geschrieben und RELOAD geschickt. Der Agenda-Modus bricht aus genau diesem Grund ab (`:461-462`).

### 6.2 Neu

**Merker in der Show.** `ShowIveoBinding` bekommt das optionale Feld `speakerVeraltetSeit?: string`, die ISO-Zeit (UTC) des ersten Fehlschlags.
- Der Normalisierer in `@jm/show` übernimmt es, wenn es ein String ist, den `Date.parse` lesen kann. Sonst entfällt es.
- Die Signatur (5.3) nimmt es auf. Setzen und Löschen des Merkers schreiben deshalb die Show und schicken RELOAD. Nur so erfährt der Titler davon (H7, 7.8).
- Der Kern führt den Merker in `AktiveShow` und liest ihn in `setzeAuf` (`:318-352`) aus der Datei, also beim Öffnen und nach dem Speichern. Ein Neustart des Launchers verliert ihn deshalb nicht.
- Durchreicher: Show-Editor (`ShowEditorModal.tsx`, `show-speichern.ts:136`) und IPC-Typ (`apps/launcher/src/shared/types.ts:240`) behalten ihn. Das Binden (`iveo-sync.ts`) holt frische Speaker und schreibt ihn nicht.

**Ablauf je Weg:**
- Der Kern übergibt `getEventSnapshot` ein `onSubError` und merkt sich, ob `speakers` gescheitert ist. Das gilt in der Listen-Abfrage und beim Umschalten auf die Tagesübersicht.
- **Scheitert die Speakerliste** (Listen-Abfrage, Umschalten auf die Tagesübersicht):
  - Es gelten die Speaker der gerade gelesenen Show-Datei (`basis.iveo?.speakers ?? []`). Dafür liest der Kern die Datei vor dem Signaturvergleich, nicht erst danach (heute `:422`).
  - **„Verantwortlich“ kommt aus der Datei:** Ein Punkt mit Gegenstück gleicher Kennung in der Datei übernimmt dessen `owner`. Ein neuer Punkt bekommt die Namen aus den Speakern der Datei mit Kennung (Kennung → Name, wie `speakerNameMap`). Ohne Treffer bleibt `owner` leer, bis die Speakerliste wieder kommt.
  - Merker: Ein schon gesetzter `speakerVeraltetSeit` bleibt, sonst gilt jetzt.
  - Der Status wird „gestört“ mit dem Text aus 6.3. Ins Log kommt eine Warnung beim ersten Fehlschlag und bei jedem neuen Fehlertext, wie in 2a-Spec 7.6.
  - Danach wird verglichen und geschrieben wie sonst. Der erste Fehlschlag schreibt deshalb genau einmal (der Merker ist neu) und schickt RELOAD. Weitere Fehlschläge ohne andere Änderung schreiben nicht.
- **Solange der Merker gilt,** holt jede Listen-Abfrage den Snapshot, auch wenn `listProgramsUpdatedSince` nichts liefert.
- **Agenda-Abfrage mit Merker:** Sie holt zusätzlich `listSpeakers`, auch wenn der Side-Event-Kontext gemerkt ist.
  - Gelingt das und verknüpft das Side Event Speaker, gelten die verknüpften (wie beim Umschalten). Verknüpft es keine, gilt die ganze Liste (wie im Listen-Modus).
  - Der Merker entfällt, die Signatur weicht ab, die Show wird geschrieben.
  - Scheitert es, bleiben die Speaker der Datei und der Merker. Der Status bleibt „gestört“. Fehlt dabei zugleich der Kontext, bricht die Abfrage wie in 2a ab (`:461-462`).
- **Gelingt die Speakerliste** auf irgendeinem Weg, entfällt der Merker. Der Status geht auf „in Ordnung“, wenn sonst nichts gestört ist.
- **Status „in Ordnung“** darf eine Abfrage nur melden, wenn kein Merker gilt, weder dieser noch ab Release 2 der für die Side-Event-Liste (15.4). Sonst bleibt der Text aus 6.3 stehen. Das gilt auch für die Agenda-Abfrage.
- **Umschalten auf ein Side Event:**
  - Gelingt dort die Speakerliste, entfällt der Merker.
  - Scheitert sie, bleibt es wie heute bei der Liste der Datei (`:543-547`), und der Merker wird gesetzt.
  - Verknüpft das Side Event keine Speaker, holt das Umschalten keine Liste. Der Merker bleibt, wie er ist; die Agenda-Abfrage frischt nach.
- **Erfolgreich 0 Speaker** (iveo meldet ausdrücklich keine) bleibt wie heute: Das Feld fehlt in der Datei. Der Titler behält seine Liste und zeigt den Hinweis aus 7.6.

### 6.3 Texte (wörtlich)

| Anlass | Ort | Text |
| --- | --- | --- |
| Speakerliste nicht abrufbar | Status im iveo-Panel | „iveo-Abgleich gestört: Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand (seit ⟨hh:mm⟩)“ |
| dasselbe | Log (Warnung) | „iveo: Speakerliste nicht abrufbar (⟨Fehler⟩), Speaker aus der Datei bleiben.“ |
| Umschalten auf die Tagesübersicht mit gescheiterter Speakerliste | Antwort des Umschaltens | „Umgeschaltet — Speakerliste von iveo nicht abrufbar, Speaker aus früherem Stand.“ |
| Speakerliste wieder abrufbar | Log (Info) | „iveo: Speakerliste wieder abrufbar, Speaker aktualisiert.“ |

`⟨hh:mm⟩` ist die Ortszeit aus `speakerVeraltetSeit`.

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
- **Kennungen aus reinen Ziffern** sind erlaubt. Ein Abruf mit reinen Ziffern meint aber immer die Nummer (7.4). Per Schlüssel erreicht man sie nur mit der `@`-Form, etwa `TITLER RECALL @17`.
- `DataEntry` wird `{ key: string; label: string; datei: string; vars: Record<string, string> }`. `datei` ist der Dateiname ohne Ordner. Die Brücke (7.3) braucht ihn, weil ein Schlüssel aus `@kennung` die Datei nicht enthält.

### 7.3 Aktiver Eintrag

Der Titler führt den aktiven Eintrag über seinen Schlüssel. Dazu kommen ein gehaltener Eintrag und ein Hinweis. Ob die Bauchbinde auf Sendung ist, meldet der Renderer schon heute (`index.ts:452-456`, `lastOnAir`).

| # | Lage beim Neueinlesen | Auf Sendung | Danach | Gezeichnet wird | Hinweis |
| --- | --- | --- | --- | --- | --- |
| A1 | Schlüssel steht in der neuen Liste | egal | derselbe Eintrag, an seiner neuen Stelle | seine Variablen aus der neuen Liste. Eine Korrektur aus iveo wirkt sofort (D2). | – |
| A2 | Schlüssel fehlt | ja | gehaltener Eintrag, kein Eintrag der Liste markiert | die zuletzt gültigen Variablen, eingefroren | H1 |
| A3 | Schlüssel fehlt | nein | kein aktiver Eintrag | leere Variablen | H2 |
| A4 | gehaltener Eintrag, die Sendung endet (gemeldetes `on_air` 0) | – | 1 s später kein aktiver Eintrag. Kommt vorher wieder ein TAKE, bleibt er gehalten. | danach leere Variablen | H2; war der Eintrag nach A10 gehalten, H5 |
| A5 | nach A2 gehaltener Eintrag, sein Schlüssel steht wieder in der Liste | egal | wieder dieser Eintrag | seine neuen Variablen | – |
| A6 | Abruf, Weiter, Zurück oder Klick | egal | der gewählte Eintrag | seine Variablen | – |
| A7 | die neue Liste ist leer | egal | unverändert, siehe 7.6 | unverändert | H3 |
| A8 | anderer Ordner (Quellenwechsel, 7.7) | ja | Schlüssel gefunden: A1; sonst A2 | wie A1/A2 | wie A1/A2 |
| A9 | anderer Ordner | nein | Schlüssel gefunden: A1; sonst Eintrag 1, wie heute (`datalink.ts:243`) | dessen Variablen | – |
| A10 | Abruf ohne Treffer (7.4) | ja | der bisher aktive oder gehaltene Eintrag wird gehalten; gab es keinen, bleibt es ohne Eintrag | die zuletzt gültigen Variablen, eingefroren | H6 |
| A11 | Abruf ohne Treffer (7.4) | nein | kein aktiver Eintrag, auch kein gehaltener | leere Variablen | H5 |

**Brücke (wie R0 in 2a-Spec 4.3).** Sie läuft vor A1–A5, für den aktiven und für den gehaltenen Eintrag:
- Sie greift nur, wenn der Schlüssel in der neuen Liste fehlt.
- Kandidaten sind die Einträge der neuen Liste aus **derselben Datei** (`datei`) mit **demselben Label** (Vergleich ohne Rücksicht auf Groß- und Kleinschreibung, Leerraum zusammengefasst).
- Überbrückt wird nur, wenn es genau einen Kandidaten gibt **und** genau einer der beiden Schlüssel, der alte oder der des Kandidaten, ein Ersatz-Schlüssel ist. Der Wechsel geht also von Ersatz auf Kennung oder von Kennung auf Ersatz.
- Dann übernimmt der Eintrag den Schlüssel des Kandidaten. Es gilt A1 (bzw. A5 für einen gehaltenen Eintrag), ohne Hinweis. Logzeile aus 7.9.
- Sonst greift die Tabelle (A2/A3).
- Zwei verschiedene Kennungen mit gleichem Namen werden **nie** überbrückt. Für iveo sind das zwei Personen.

Ein Abruf auf Sendung ändert den Text weiter sofort, ohne Animation. Das ist heute so und bleibt so. Ein TAKE ohne aktiven Eintrag zeigt leere Platzhalter, wie heute bei einem leeren Ordner; der Hinweis H2 bzw. H5 steht dann schon da.

### 7.4 Abruf

- **`recall(ref)`**, genutzt von Companion, Steuerprotokoll und Rundown. Reihenfolge:
  1. nur Ziffern → Nummer (1-basiert), wie bisher (2a-Spec 6.3)
  2. Schlüssel exakt, ohne Rücksicht auf Groß- und Kleinschreibung
  3. Label exakt
  4. Label als Teilstring

  Es gilt jeweils der erste Treffer. Danach hält der Titler den **Schlüssel**, nicht die Nummer.
- **`@`-Form:** Beginnt `ref` mit `@`, ist das erste Wort ohne `@` die Kennung, der Rest der Name (Leerraum zählt als ein Leerzeichen). Reihenfolge:
  1. Schlüssel exakt, ohne Rücksicht auf Groß- und Kleinschreibung; nur echte Kennungen (Spalte `@kennung`), nie Ersatz-Schlüssel (`ersatz:…`, 7.2). Nachgetragen 05.10.2026 (Vor-Release V3, Owner-Freigabe der Notes).
  2. Label exakt gleich dem Namen, wenn ein Name dabei ist

  Ein Teilstring zählt hier **nicht**. Sonst träfe „Ana“ auch „Anabel“. Die Form senden Rundown 0.7.0 und neuer (8.3), und Companion-Nutzer können sie von Hand nutzen, auch für Kennungen aus reinen Ziffern (7.2).
- **Abruf ohne Treffer** (keine Stufe trifft, Nummer außerhalb der Liste oder leere Liste): A10 auf Sendung, A11 ohne Sendung (7.3), mit Hinweis und Logzeile. Der alte Eintrag bleibt nie still aktiv. Ein leerer `ref` bleibt wirkungslos wie heute.
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
- **Neu im STATE:** `recall_kennung=1`. Der Rundown liest daraus, dass dieser Titler die `@`-Form versteht (8.3). Der Wert ist eine feste Fähigkeit und hängt nicht davon ab, ob die geladene Liste Kennungen trägt. Fehlt die Kennung in der Liste, fängt der Name in der `@`-Form den Abruf auf (7.4).
- Das Companion-Modul übernimmt aus dem STATE nur die Variablen seiner Tabelle (`packages/companion-jm-suite/main.js:372-378`). Ein zusätzlicher Schlüssel ändert dort nichts. Es braucht keinen Protokoll-Sync und kein Companion-Release.
- `TITLER RECALL <nr>`, `NEXT`, `PREV` bleiben, wie sie sind. Neu ist nur: Eine Nummer außerhalb der Liste gilt als Abruf ohne Treffer (A10/A11) statt still nichts zu tun.

### 7.6 Leere Liste

| Lage | Verhalten |
| --- | --- |
| Die Datenquelle ist eine Show, dieselbe Show hat jetzt keine Speaker | Die alte TSV bleibt, Hinweis H3. |
| Eine **andere** Show ohne Speaker wird geöffnet | Die Datenquelle wechselt auf den eigenen Ordner (7.7). Ohne eigenen Ordner ist die Liste leer, mit dem heutigen Text „Kein Datenordner aktiv …“ (`OperatorView.tsx:449-453`). So erscheinen nach einem Showwechsel keine fremden Speaker. |
| Die gemerkte Show ist beim RELOAD oder Start nicht lesbar | Die alte TSV bleibt, Hinweis H4. |
| Die Show trägt den Merker `speakerVeraltetSeit` (6.2) | Die Liste der Show gilt wie sonst, dazu Hinweis H7. |

Fehlen derselben Show die Speaker oder ist sie nicht lesbar, leert der Titler seine Liste nie. Leer wird sie nur durch einen Showwechsel ohne Speaker und ohne eigenen Ordner oder durch die Wahl des Bedieners.

### 7.7 Datenquelle und gemerkte Show

**Grundsatz:** `config.dataFolder` ist nur noch der Ordner des Bedieners. Die Show schreibt ihn nie mehr (heute `index.ts:151`). `userData/iveo-data` gilt **nie** als eigener Ordner: Zeigt `config.dataFolder` dorthin (Pfadvergleich nach `path.resolve`, ohne Rücksicht auf Groß- und Kleinschreibung), behandelt `datenquelle.ts` das wie „kein eigener Ordner“.

**Datenquelle** (Laufzeit, im Status als `datenQuelle`):

| Art | Gelesen wird | Entsteht |
| --- | --- | --- |
| `show` | `userData/iveo-data` | Eine Show mit mindestens einem Speaker wurde angewendet |
| `ordner` | `config.dataFolder`; ist er leer, nichts | Vorgabe; nach einer Show ohne Speaker; nach Ordnerwahl oder Knopf |
| `frueher` | `userData/iveo-data` | Übergang (unten); in Release 2 auch nach dem Ende des Verbundmodus (17.2) |

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

**Übergang:** Steht `config.dataFolder` beim ersten Start auf `userData/iveo-data`, hat ein früherer Titler ihn überschrieben. Den Ordner von davor kennt niemand mehr. Das ist im Bestand der Normalfall: Jeder Titler, der je eine Show mit Speakern angewendet hat, steht so.
- Ohne gemerkte Show wird die Datenquelle `frueher`. Die alte Liste bleibt sichtbar.
- `config.dataFolder` wird einmalig auf leer gesetzt, Logzeile „DataLink: Ordner iveo-data war von einer Show gesetzt, kein eigener Ordner mehr eingetragen.“ Der Wert war nie der Ordner des Bedieners. Ohne das Leeren zeigte „andere Show ohne Speaker → `ordner`“ die Speaker der vorigen Show als „eigener Ordner …\iveo-data“, und die Einstellungen zeigten iveo-data als eigenen Ordner.
- Die erste Show mit Speakern macht daraus `show`.
- Ein Rückweg auf Titler 0.9.0 findet `dataFolder` leer und zeigt bis zur nächsten Show keine Liste. Das steht in den Release-Notes.

### 7.8 Oberfläche und Texte (wörtlich)

| # | Ort | Text |
| --- | --- | --- |
| H1 | Daten / Recall, stehend; Board oben | „„⟨Label⟩“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.“ |
| H2 | Daten / Recall, stehend | „„⟨Label⟩“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.“ |
| H3 | Daten / Recall, stehend | „Liste aus früherem Stand: Die Show enthält gerade keine Speaker.“ |
| H4 | Daten / Recall, stehend | „Liste aus früherem Stand: Show nicht lesbar (⟨Grund⟩).“ |
| H5 | Daten / Recall, stehend; Board oben | „Abruf „⟨ref⟩“: nicht in der Liste. Bitte einen Eintrag abrufen.“ |
| H6 | dasselbe | „Abruf „⟨ref⟩“: nicht in der Liste. Auf Sendung bleibt „⟨Label⟩“, bis du sie ausblendest oder einen Eintrag abrufst.“ |
| H7 | Daten / Recall, stehend | „Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit ⟨hh:mm⟩).“ |
| Q1 | Daten / Recall, Zeile über der Liste | „Quelle: Show „⟨Showname⟩“ · ⟨n⟩ Speaker“ |
| Q2 | dasselbe | „Quelle: eigener Ordner ⟨Pfad⟩“ |
| Q3 | dasselbe | „Quelle: Speaker aus einer früheren Show“ |
| K1 | Einstellungen › DataLink, nur bei Quelle `show` und einem eigenen Ordner, der nicht `iveo-data` ist | Knopf „Zurück zum eigenen Ordner (⟨Ordnername⟩)“ |
| B1 | Board, Karte über den Einträgen, nur bei gehaltenem Eintrag | „Auf Sendung, nicht in der Liste: ⟨Label⟩“ |

- Die Bedingung „Kein Datenordner aktiv“ (`OperatorView.tsx:448-453`) prüft künftig die Datenquelle, nicht `config.dataFolder`.
- Ein gehaltener Eintrag erscheint in der Liste nicht als markierter Eintrag. Die Zähleranzeige zeigt „Einträge · ⟨n⟩“ ohne Stelle.
- Stehen mehrere Hinweise an, gilt der Vorrang H1/H6 vor H2/H5 vor H4 vor H3/H7. `⟨ref⟩` ist bei der `@`-Form der Name, ohne Namen die Kennung. In H7 ist `⟨hh:mm⟩` die Ortszeit aus `speakerVeraltetSeit`.
- H5 und H6 enden mit dem nächsten Abruf, der trifft. H6 wird mit dem Ende der Sendung (A4) zu H5.
- Bei A10 steht der gehaltene Eintrag oft noch in der Liste; er ist trotzdem nicht markiert. So bringt das nächste TAKE nach dem Ausblenden nicht ihn, sondern leere Platzhalter, bis ein Abruf trifft.

### 7.9 Log

| Anlass | Zeile |
| --- | --- |
| A1 mit neuer Stelle | „DataLink: „⟨Label⟩“ hält seinen Eintrag (jetzt Nr. ⟨n⟩ von ⟨m⟩).“ |
| A2 | „DataLink: aktiver Eintrag „⟨Label⟩“ nicht mehr in der Liste, auf Sendung gehalten.“ |
| A3, A4 | „DataLink: aktiver Eintrag „⟨Label⟩“ nicht mehr in der Liste, kein aktiver Eintrag.“ |
| Brücke | „DataLink: „⟨Label⟩“ hält seinen Eintrag, Schlüssel wechselt (⟨Ersatz-Schlüssel bzw. Kennung⟩ → ⟨neu⟩).“ |
| A10, A11 | „DataLink: Abruf „⟨ref⟩“ ohne Treffer, ⟨auf Sendung gehalten \| kein aktiver Eintrag⟩.“ |
| H7 | „iveo: Show meldet Speakerliste nicht abrufbar seit ⟨hh:mm⟩, Liste aus früherem Stand.“ |
| H3 | „iveo: Show ohne Speaker, Liste aus früherem Stand bleibt.“ |
| Gemerkte Show | „Show gemerkt: ⟨Pfad⟩“ |

---

## 8 · Rundown: Speaker-Aktion über die Kennung

### 8.1 Feld

- `RundownAction` bekommt `speakerId?: string` (`apps/rundown/src/shared/types.ts:10-32`). `normAction` übernimmt es als String mit 1 bis 200 Zeichen (`apps/rundown/src/shared/doc-format.ts:22-37`).
- `args[0]` behält den **Namen**. Er dient der Anzeige und als Rückfall.
- `schemaVersion` bleibt 2. Ein Rundown 0.6.0 übernimmt nur bekannte Felder und verwirft `speakerId`. Die Aktion wirkt dort weiter über den Namen.
- **Wann `speakerId` entfällt.** Neue reine Funktion `aktionAendern(aktion, patch): RundownAction` in `apps/rundown/src/shared/zeilen.ts`. `updateAction` (`apps/rundown/src/renderer/src/lib/doc.ts:103`) ruft sie. Sie entfernt `speakerId`, wenn
  - sich Rolle oder Verb ändern (heute setzen `setRole`/`setVerb` nur `zielId` zurück, `RowEditor.tsx:175-182`),
  - im Picker „— Speaker wählen —“ gewählt wird,
  - `args[0]` sich ändert, ohne dass der Patch eine neue `speakerId` mitbringt. Das ist die freie Eingabe, die erscheint, wenn die Show keine Speaker hat (`RowEditor.tsx:160-161`, `:336`, `setArg` `:191-195`). Eine von Hand auf „Grace“ geänderte Aktion trägt danach nicht mehr die Kennung von Alan.

### 8.2 Picker im Zeilen-Editor

- Optionen: je Speaker der Show „⟨Name⟩ — ⟨Funktion⟩“ bzw. „⟨Name⟩“ (`RowEditor.tsx:257-275`). Der Wert ist die Kennung, ohne Kennung der Name.
- Eine Auswahl schreibt `speakerId` (falls vorhanden) und `args[0] = Name`.
- **Alte Aktion ohne `speakerId`:** Ausgewählt steht die zusätzliche Option „⟨Name⟩ · per Name (nicht gebunden)“. Gebunden wird erst durch eine Auswahl, nie stillschweigend (wie 2a-Spec 6.2).
- **Eintrag nur aus Ziffern** (etwa die Vorgabe „1“ einer neuen Aktion): Ausgewählt steht „Nr. ⟨n⟩ · per Nummer (nicht gebunden)“, denn der Titler ruft ihn als Nummer ab (7.4 Stufe 1). Nachgetragen 05.10.2026 (Vor-Release V2, Text vom Owner freigegeben).
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
| Aktion ist nicht `titler recall` | `args` unverändert. Eine übrig gebliebene `speakerId` wird nie ausgewertet. |
| kein `speakerId` | `args` unverändert, wie heute |
| `speakerId`, der Titler meldet `recall_kennung=1` | `TITLER RECALL @⟨speakerId⟩ ⟨Name⟩`. `⟨Name⟩` ist der aktuelle Name zu `speakerId` in `iveoSpeakers`, ohne Treffer `args[0]`. |
| dasselbe, aber `speakerId` enthält Leerraum | wie die nächste Zeile (die `@`-Form trennt am ersten Leerzeichen) |
| `speakerId`, der Titler meldet es nicht (alt oder gerade nicht verbunden) | `TITLER RECALL ⟨aktueller Name zu speakerId⟩`, ohne Treffer `⟨args[0]⟩` |

- `titlerKannKennung` kommt aus dem STATE der Rolle `titler` im Conductor (`conductor.snapshot()`, `apps/rundown/src/main/conductor.ts:140`). Welcher Titler das ist, wählt der Conductor heute nach „zuletzt gefunden“ (`conductor.ts:81-88`); das bleibt in 2b so (FA4, Frage O2).
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
6. `speakerVeraltetSeit`: eine lesbare ISO-Zeit bleibt, ein unlesbarer Wert entfällt; `serializeShow` → `parseShow` behält ihn.

### 9.2 Launcher (`npm run selftest:iveo -w @jm/launcher`)

Vorweg: Die Testdaten `ANA` bekommen die Kennung `sp1` (SP9). Die 2a-Fälle laufen danach unverändert grün; ein roter 2a-Fall ist ein Fehler im Kern, nicht im Test.

1. Signatur: gleiche Namen, andere Kennung → andere Signatur. Merker gesetzt oder nicht → andere Signatur.
2. Bestands-Show ohne Kennungen (eigenes Fixture ohne `id`): Die erste schreibende Listen-Abfrage trägt die Kennungen nach. Danach bleibt die Signatur gleich.
3. `/speakers` scheitert im Listen-Modus, eine Programmänderung liegt vor → Speaker der Datei bleiben; jeder Punkt behält seinen `owner` aus der Datei; ein neuer Punkt bekommt `owner` aus den Speakern der Datei; der Merker steht in der Datei; Status „gestört“ mit dem Text aus 6.3; genau ein RELOAD.
4. Danach eine Abfrage **ohne** Programmänderung, `/speakers` scheitert weiter → der Snapshot wird geholt, nichts geschrieben, kein RELOAD. Danach gelingt die Liste → Merker weg, geschrieben, RELOAD, Status „in Ordnung“.
5. Agenda-Abfrage mit Merker, `listSpeakers` scheitert → der Status bleibt „gestört“. Danach gelingt sie → verknüpfte Speaker (bzw. ohne Verknüpfung die ganze Liste) geschrieben, Merker weg, Status „in Ordnung“.
6. Tagesübersicht umschalten mit gescheiterter Speakerliste → Speaker der Datei, `owner` aus der Datei, Merker gesetzt, Meldung aus 6.3.
7. iveo meldet erfolgreich 0 Speaker → Feld fehlt in der Datei (heutiges Verhalten), kein Merker.
8. Show-Editor: Laden und Speichern ohne Änderung behält die Speaker-Kennungen und den Merker (`baueGespeicherteShow`, Erweiterung von 2a-Spec 9.5; Testdaten SP10).
9. Öffnen einer Show mit Merker → die erste Listen-Abfrage holt den Snapshot, auch ohne Programmänderung.

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
15. **Brücke Ersatz → Kennung:** Alan aktiv mit `ersatz:speakers.tsv|Alan`, neue Liste mit `@kennung` → derselbe Eintrag, neuer Schlüssel, kein Hinweis. Je einmal auf Sendung und ohne Sendung.
16. **Brücke Kennung → Ersatz:** dasselbe in Gegenrichtung, je einmal auf Sendung und ohne Sendung.
17. Brücke mit gehaltenem Eintrag → A5.
18. Brücke ohne eindeutigen Kandidaten (Name zweimal in der Datei; Name nur in einer anderen Datei) → A2 bzw. A3.
19. Zwei verschiedene Kennungen, gleicher Name → keine Brücke, A2 bzw. A3.
20. **Abruf ohne Treffer** (unbekannter Name; Nummer 7 bei 5 Einträgen; leere Liste): ohne Sendung → kein aktiver Eintrag, H5 (A11); auf Sendung → bisheriger Eintrag gehalten, H6 (A10). Danach ein Abruf mit Treffer → Hinweis weg.
21. **`@`-Form:** Kennung trifft; Kennung fehlt, Name genau gleich → trifft; Name nur als Teilstring → kein Treffer (A10/A11); `@17` trifft den Schlüssel „17“, `17` die Nummer 17.
22. Show mit Merker → H7; ohne Merker kein H7.

**`datenquelle`:** jede Zeile der Tabellen in 7.6 und 7.7, dazu der Übergang: `config.dataFolder` auf iveo-data → Quelle `frueher` und `dataFolder` danach leer; danach „andere Show ohne Speaker“ → `ordner` ohne Liste, nicht die Speaker der vorigen Show. `config.dataFolder` von Hand auf iveo-data gesetzt → gilt als kein eigener Ordner.

**Gegenprobe:** Fall 3 wird absichtlich gegen eine Variante geprüft, die die Stelle statt des Schlüssels hält. Sie muss rot werden. Das Ergebnis kommt in den Aufgabenbericht.

### 9.4 Rundown (`npm run selftest -w @jm/rundown`)

1. `normAction` behält `speakerId`, verwirft leere und zu lange.
2. `loeseSpeakerZiel`: jede Zeile der Tabelle in 8.3, darunter eine Aktion `timer goto` mit übrig gebliebener `speakerId` → `args` unverändert.
3. Umbenennung in iveo: Gesendet wird der **neue** Name, mit Kennungs-Fähigkeit in der `@`-Form, ohne als Name allein.
4. Chip-Text mit bekannter und unbekannter Kennung.
5. `aktionAendern`: Rollenwechsel, Verbwechsel, „— Speaker wählen —“ und eine Hand-Änderung an `args[0]` entfernen `speakerId`; eine Picker-Auswahl setzt sie neu.

### 9.5 CI

`.github/workflows/ci-checks.yml`, Job `selftests`: neuer Schritt „Titler (DataLink-Schlüssel, Datenquelle)“ mit `npm run selftest -w @jm/titler`. Er darf kein Electron laden.

### 9.6 Durchgang mit gebauten Programmen

`apps/rundown/test/e2e-teil2a.mjs`, Abschnitt 9 wird von der Messung zur **Prüfung**:

- **9** wie heute, Prüfung: nach dem Einfügen steht weiter „Alan“ auf Sendung (`entry === 'Alan'`, `on_air === '1'`). Heute prüft die Zeile nur, dass gemessen wurde (`:553`).
- **Reihenfolge und Testdaten für 9b–9e:** Diese Abschnitte laufen am Ende des Skripts, nach Abschnitt 8. Davor öffnet das Skript wieder die Show aus Abschnitt 9 (Launcher-Deep-Link) und schaltet auf die Tagesübersicht. Erst dann fügt das Skript dem nachgebauten iveo ein drittes Programm `p-c` hinzu: Side Event mit `speaker_ids: ['s-1', 's-2']` (Ada und Grace, **ohne** Alan) und einem Agenda-Punkt. Die Programme `p-a` und `p-b` haben keine Verknüpfung (`e2e-teil2a.mjs:121-122`); ein Umschalten dorthin behielte die Liste der Datei, Alan bliebe drin. Verknüpfungen an `p-a`/`p-b` verschöben die Ablauf-Erwartungen der Abschnitte 1–8 (`agendaAblauf` „ohne verknüpfte Speaker“, `:172-176`).
- **9b Umschalten:** Alan auf Sendung (Listen-Modus, Tagesübersicht), dann `LAUNCHER SIDEEVENT p-c` → `entry === 'Alan'`, `entry_index === '0'`, Logzeile A2, **und** Bild gleich A (Messpunkt aus 9e).
- **9c Ausblenden:** danach `TITLER CLEAR`, 2 s warten → `entry === ''`. Dann `TITLER TAKE`, 1,5 s warten → Bild ungleich A (leere Platzhalter statt Alan); danach `TITLER CLEAR`.
- **9d Umbenennen:** zurück auf die Tagesübersicht (`LAUNCHER SIDEEVENT`, Listen-Modus). Grace abrufen, TAKE, Bild G merken. Im nachgebauten iveo die Funktion von Grace ändern **und** `updated_at` von `p-a` hochsetzen (Muster `:544`); ohne Programmänderung holt der Listen-Modus die Speaker nicht (2.3, Nr. 4). → `entry === 'Grace'` und Bild ungleich G. `funktion` steht nicht im STATE (`control-server.ts:52-65`); das Bild zeigt sie über `{{funktion}}`.
- **9e Bild:**
  - Vor dem Start schreibt das Skript `titler-config.json` mit `template: 'lowerthird'`, `name: '{{name}}'`, `subtitle: '{{funktion}}'`. Der Titler startet mit `--remote-debugging-port=9335`.
  - Messpunkt ist die SHA-256 von `toDataURL()` des Vorschau-Canvas, gelesen über CDP, 1,5 s nach jeder Aktion.
  - Prüfung: Alan auf Sendung (Bild A), Speaker davor einfügen, Abfrage abwarten → Bild gleich A.
  - **Kontrolle, dass der Messpunkt einen Namenswechsel sehen kann:** `TITLER RECALL 2` → Bild ungleich A; wieder Alan abrufen → Bild gleich A.
  - Der Messpunkt gilt auch für 9b, 9c und 9d. STATE `entry` nennt bei einem gehaltenen Eintrag das Label aus `gehalten` (7.5), also eine eigene Quelle; ob die eingefrorenen Variablen das Bild erreichen, zeigt nur das Bild.
- **Speakerdaten** im Skript (`speakerListe()`, `:177-178`) tragen die Kennung.
- **Gegenprobe:** Abschnitt 9 einmal gegen den gebauten Titler 0.9.0 laufen lassen. Er muss rot werden. Das Ergebnis kommt in den PR-Text.

---

## 10 · Release 1: Abnahme (Owner, ein Rechner, echtes iveo-Event auf Prod)

`apps/titler/ABNAHME-2b-R1.md`, je Schritt mit Ergebnisspalte. In iveo wird nichts geschrieben.

**Termin (Owner 02.10.2026):** Die noch offene 2a-Abnahme (`apps/rundown/ABNAHME-2a.md`) läuft im selben Termin, vor den Schritten dieser Tabelle. Release 1 wartet nicht auf sie.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Launcher 0.14.0, Titler 0.10.0, Rundown 0.7.0 installieren | Versionen im Launcher sichtbar |
| 2 | Im Titler eine Vorlage mit `{{name}}` und `{{funktion}}` wählen. Eine Bestands-Show mit iveo öffnen (vor dem Update gespeichert, ihre Speaker haben noch keine Kennung). Einen Speaker abrufen, TAKE. Dann im Panel die Tagesübersicht wählen; das schreibt die Kennungen nach (5.3). | Daten / Recall zeigt „Quelle: Show „⟨Show⟩“ · ⟨n⟩ Speaker“. Dieselbe Person bleibt auf Sendung, **kein** Hinweis „nicht mehr in der Liste“ (Brücke, 7.3). Log: „… hält seinen Eintrag, Schlüssel wechselt …“ |
| 3 | Ein Side Event suchen, mit dem iveo Speaker verknüpft (beim Umschalten kommt **keine** Meldung „verknüpft keine Speaker“). Zurück auf die Tagesübersicht, einen Speaker abrufen, der dort **nicht** verknüpft ist. TAKE. | Bauchbinde zeigt ihn |
| 4 | Im Panel auf dieses Side Event umschalten | Dieselbe Person bleibt auf Sendung, Hinweis „… ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen …“ |
| 5 | Ausblenden | Nach etwa 1 s Hinweis „… Bitte einen Eintrag abrufen.“ |
| 6 | Zurück auf die Tagesübersicht, einen Speaker abrufen, TAKE, dann auf ein Side Event umschalten, das ihn verknüpft | Dieselbe Person bleibt, ohne Hinweis |
| 7 | Im Rundown an eine Zeile „Titler · Eintrag abrufen“ hängen, im Picker einen Speaker wählen, GO | Die richtige Person wird abgerufen. Chip zeigt den Namen. |
| 8 | Titler schließen und über die **Kachel** neu starten | Liste und Quelle wie vorher. Die nächste Umschaltung im Panel kommt an. |
| 9 | Im Titler einen eigenen DataLink-Ordner mit einer CSV wählen | Quelle „eigener Ordner“. Die Show-Liste ist weg. |
| 10 | Show erneut öffnen, dann „Zurück zum eigenen Ordner“ | erst Quelle Show, dann wieder der eigene Ordner mit der CSV |
| 11 | Companion: `TITLER RECALL 2` und Weiter | wie bisher über die Nummer |
| 11b | Companion: `TITLER RECALL Niemand` (ein Name, den die Liste nicht hat), ohne Sendung, dann TAKE | Hinweis „Abruf „Niemand“: nicht in der Liste …“; die Bauchbinde zeigt **nicht** den vorher aktiven Speaker |
| 12 (optional) | Nur mit einem unveröffentlichten Test-Speaker und im **Listen-Modus** (Tagesübersicht): dessen Funktion in iveo ändern, während er auf Sendung ist, auf die nächste Programmänderung warten. Im Agenda-Modus kommen Speaker-Änderungen nie an (2.3, Nr. 5). | Funktion auf Sendung wechselt, Name bleibt. Zeigt der Titler stattdessen „… ist nicht mehr in der Liste“, hat iveo die ID beim Bearbeiten gewechselt (M1 b). |

---

## 11 · Release 1: Aufbau, Release, Doku

| Paket/App | Dateien | Inhalt |
| --- | --- | --- |
| `@jm/show` | `src/index.ts` | `ShowIveoSpeaker.id`, `loeseDoppelteKennungenAuf` (5.1), `ShowIveoBinding.speakerVeraltetSeit` (6.2) |
| `@jm/iveo` | `src/mapper.ts`, `test/selftest.ts` | 5.2, 9.1 |
| Launcher | `src/main/iveo-abgleich-kern.ts`, `src/shared/types.ts`, `src/renderer/src/lib/show-speichern.ts`, `ShowEditorModal.tsx`, `test/iveo-abgleich.test.ts`, `test/show-speichern.test.ts` | 5.3, 6, 9.2 |
| Titler | 7.1 | 7 |
| Rundown | `src/shared/types.ts`, `doc-format.ts`, `zeilen.ts`; `src/main/index.ts`; `RowEditor.tsx`, `RundownList.tsx`, `lib/capabilities.ts`, `lib/doc.ts`; `test/selftest.ts`, `test/e2e-teil2a.mjs` | 8, 9.4, 9.6 |
| CI | `.github/workflows/ci-checks.yml` | 9.5 |

**Nicht angefasst:** `packages/master-link`, `packages/app-runtime`, `packages/suite-control-protocol`, Companion-Modul.

**Release:**
- Titler **0.10.0**, Launcher **0.14.0**, Rundown **0.7.0**.
- Changelog in `packages/suite-manifest/changelog.json`, ohne ASCII-Anführungszeichen in Texten. Vor dem Commit: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
- Release-Notes nennen: Rundown 0.7.0 ruft Speaker über die Kennung ab, wenn der Titler 0.10.0 läuft, sonst über den Namen. Der Titler überschreibt den eigenen DataLink-Ordner nicht mehr; ein von einer Show eingetragener Ordner `iveo-data` wird einmalig geleert (7.7). Ein Abruf ohne Treffer lässt nicht mehr den vorherigen Speaker aktiv. Neu für Companion: `TITLER RECALL @⟨Kennung⟩ ⟨Name⟩`.
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
| M → C | `stand` | `art: 'show'`, `fassung: 1`, `epoche`, `folge`, `schluessel`, `show`, `grund?`, `mitDokument` |
| M → C | `aenderung` | wie `stand` |

- `stand` ist die Antwort auf ein `abo`. `aenderung` kommt unaufgefordert.
- Der Master schickt beides nur an Sitzungen mit Abo und nie vor `angemeldet`.
- `schluessel`: Kennung der Show am Master, die ersten 16 Hex-Zeichen von SHA-256 über den mit `path.resolve` normalisierten, kleingeschriebenen Pfad. Das ist die Formel aus 2a-Spec 4.7 (`apps/rundown/src/main/gedaechtnis.ts:83-85`). Ohne offene Show `null`; bei `nicht-lesbar` der Schlüssel der offenen Show.
- `show`: der Ausschnitt (14) oder `null`.
- `grund` steht genau dann da, wenn `show` `null` ist: `keine-show`, `zu-gross` oder `nicht-lesbar`.
- `mitDokument`: die appIds der Tools, deren Eintrag in der Show am Master ein Dokument trägt (`tools[].document`), ohne Pfad. Sonst `[]`. Der Ausschnitt selbst trägt kein Dokument (14.1); der Rundown auf B braucht aber die Tatsache für seinen Hinweis (17.3).
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
| `mitDokument` | Liste mit höchstens 64 Einträgen aus `[a-z0-9-]{1,64}`; fehlt sie, gilt `[]` |

- Ungültiger Inhalt wird verworfen. Ins Log kommt eine Warnung, je Verbindung einmal je Typ und Fehlergrund. Die Leitung bleibt.
- Das Tool merkt sich den Verwurf (`verworfen` in 16.2) und zeigt ihn an (V15). Der nächste gültige Stand löscht den Merker.

### 13.3 Epoche, Folge, Neuabo

- **Epoche:** `crypto.randomUUID()`, neu bei jedem Start des Verteilers, also bei jedem Start der Rolle Master (Launcher-Start, Rollenwechsel, „Master-Identität erneuern“).
- **Folge:** beginnt in jeder Epoche bei 0 mit dem ersten Stand. Sie steigt um 1, sobald sich `schluessel`, `show`, `grund` oder `mitDokument` vom vorigen Stand unterscheiden (Vergleich der serialisierten Form). Ein unveränderter Ausschnitt erzeugt keinen neuen Stand.
- **Am Tool:** Es merkt sich Epoche und Folge des zuletzt **angewendeten** Stands. Ein eingehender Stand gilt als neu, wenn seine Epoche abweicht oder seine Folge größer ist. Sonst wird er nicht angewendet; nur die Anzeige wechselt auf „aktuell“.
- **Neuabo:** Nach jeder Anmeldung (Ereignis `angemeldet`, `client.ts:550`), also auch nach jedem Wiederverbinden, schickt das Tool erneut `abo`. Die Sitzung am Master ist dann neu. Ein Stand mit gleicher Epoche und Folge wird nicht noch einmal angewendet.
- **Abo wiederholen:** Bleibt die Antwort aus (Frist 5 s, Zustand `ohne-daten`), schickt das Tool das `abo` alle 30 s erneut, solange die Verbindung steht. Ein Master ohne 2b ignoriert es weiter (2.4, Nr. 2). Ein Master, der wegen der Grenze von 32 Abos geschwiegen hat, antwortet, sobald ein Platz frei ist.
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
| **Grenze je Stück statt je Zeile** (2.4, Nr. 3) | `ZeilenLeser` gibt Zeilen einzeln heraus. `Verbindung.aufDaten` entnimmt eine Zeile, gibt sie aus und entnimmt erst danach die nächste. Die Grenze gilt beim Entnehmen. So gilt für die Zeile nach `angemeldet` schon 1 MiB. Eine unvollständige Zeile über der Grenze wirft weiter. | Mit einem nachgebauten Server, der rohe Zeilen schreibt: `angemeldet` und eine Zeile mit 900 KiB im selben Stück → beide kommen an, keine Trennung. Vor der Anmeldung eine Zeile mit 4 KiB + 1 Byte → Trennung wie bisher. |
| **Kopieren je Stück** (`rahmen.ts:113`, `:123`) | Der Puffer ist eine Liste von Stücken. Gesucht wird nur im neuen Stück, ab der letzten Suchstelle. Zusammengefügt wird nur die fertige Zeile. | Ein Zähler für kopierte Bytes (nur im Test gesetzt): Eine Zeile von 1 MiB in Stücken zu 16 KiB kopiert höchstens 2 MiB. |
| **Übergabe nach `angemeldet`** (`client.ts:167-180`, `:532-584`) | `betreibe` gibt nachgeholte `stand`- und `aenderung`-Nachrichten wie neue aus (Ereignis `daten`). | Mit dem nachgebauten Server: `angemeldet` und `aenderung` im selben Stück → `daten` kommt an. |
| **Strenge Prüfer** | lockere Prüfer (13.2) | Ein `stand` mit falschem Feld → Warnung, Verbindung bleibt. |
| **`PROTOKOLL` erhöhen** | bleibt 1 | Ein Teil-1-Client (ohne `abo`) bleibt angemeldet und bekommt keine 2b-Zeile. |

**Warum die Zeilen 1 und 3 trotzdem nötig sind:** Im Ablauf „erst Abo, dann Stand“ schickt ein richtig gebauter Master nach `angemeldet` nichts Großes, bevor das `abo` des Tools da ist. Mit Sitzungs-Kennungen (13.6) bleibt das auch beim schnellen Neuaufbau so. Die beiden Reparaturen sichern gegen einen Master, der das bricht. Ohne sie träfe eine 900-KiB-Zeile im selben Stück wie `angemeldet` noch die 4-KiB-Grenze und kappte die Leitung.

**Koppeln braucht keine Reparatur:** Nach `gekoppelt` sendet der Master nichts, bis `teilnehmer` kommt, auch keinen Puls (`server.ts:240-245`, `:447-449`). `teilnehmer` geht erst in `warteAufAngemeldet` hinaus (`client.ts:183-217`, nach `uebernehme` `:331-346`), und dort hält `halteFest` schon heute alle Zeilen nach `angemeldet` fest (`client.ts:212`). Das `removeAllListeners` in `koppeln.ts:158` verliert deshalb nichts. Außerdem betrifft der Koppel-Weg nur den Slave-Launcher, dessen `abo` ohnehin ignoriert wird (15.2).

### 13.6 Rückdruck

- `Verbindung.sende` gibt zurück, ob die Zeile in den Puffer ging. Neu ist `sendeZeile(zeile)` für eine schon serialisierte Zeile. So serialisiert der Master einen Stand einmal und schreibt ihn an alle Abos.
- **Sitzungs-Kennung:** Der Server vergibt jeder angemeldeten Sitzung eine eigene Zahl `sitzung` (Zähler je Serverlauf). Daten, Abos, Stau und Ende hängen an ihr, **nicht** am Teilnehmer-Schlüssel `rechnerId\0appId` (`server.ts:390`). Grund: Meldet sich dasselbe Tool schnell neu an (gleiche pid und Adresse, `server.ts:393`), ersetzt die neue Sitzung die alte unter demselben Schlüssel (`:391-401`). Die alte endet bis zu 200 ms später (`verbindung.ts`, `schliesse`). Hinge das Abo am Schlüssel, löschte dieses späte Ende das schon eingetragene Abo der neuen Sitzung. Das Tool bliebe grün auf altem Stand und bekäme keine `aenderung` mehr.
- `MasterLinkServer.sendeDaten(sitzung, zeile)` liefert `'gesendet'`, `'gestaut'` oder `'weg'`.
  - Liegen im Schreibpuffer der Sitzung (`socket.writableLength`) mehr als 1 MiB, schreibt er nicht und markiert die Sitzung als gestaut.
  - Beim nächsten `drain` meldet er das Ereignis `entstaut(sitzung)`. Der Verteiler schickt dann den **neuesten** Stand, wenn er neuer ist als der zuletzt an diese Sitzung gesendete.
- Der Puls bleibt unberührt. Er ist klein.
- Ein Rechner im langsamen WLAN bekommt so nie mehr als einen ausstehenden Stand. Zwischenstände fallen weg; das ist richtig, weil jeder Stand vollständig ist.

### 13.7 API in `@jm/master-link`

**Server** (`server.ts`). Das bestehende Ereignis `aenderung` (Teilnehmerliste geändert, ohne Nutzlast) bleibt. Es hat mit der Nachricht `aenderung` nichts zu tun.
- Ereignis `daten(teilnehmer, n)`: eine `abo`-Nachricht einer angemeldeten Sitzung. `teilnehmer` = `{ sitzung, schluessel, rechnerId, art, appId, dieserRechner }`.
- Ereignis `getrennt(sitzung)`: **genau einmal** je angemeldeter Sitzung. Beim Ersetzen kommt es für die alte Sitzung sofort in `meldeAn`, noch vor `angemeldet` an die neue; sonst beim Ende der Sitzung (heute meldet `sitzungEnde` nur `aenderung`, und nur wenn die Map noch auf die Sitzung zeigt, `:424-432`).
- Ereignis `entstaut(sitzung)` (13.6).
- Methode `sendeDaten(sitzung, zeile)` (13.6).

**Client** (`client.ts`):
- `sende(n)`: nur im Zustand verbunden. Liefert `false`, wenn nichts hinausging.
- Ereignis `daten(n)` für `stand` und `aenderung`, auch für nachgeholte (13.5).
- `kopplung()`: `{ rolle, masterId, masterName, letzteAdresse, adressen } | null`. Rolle, Master und `letzteAdresse` stammen aus `master-link.json`, `adressen` aus dem letzten `angemeldet` (heute privat als `gelernteAdressen`, `client.ts:285`). `waehleLauncher` im Rundown braucht diese Werte (17.4).

**Adressen** (`adresswahl.ts`): neu `istDieserRechner(host, eigeneAdressen)`, neben `listeKarten`. Der Launcher (15.3) und der Rundown (17.4) nutzen dieselbe Prüfung.

**Rahmen** (`rahmen.ts`): die drei Typen in `Nachricht` und in der Prüfer-Tabelle; `kodiere` kann sie.

---

## 14 · Inhalt: der Ausschnitt

### 14.1 Felder

`@jm/show` exportiert die reine Funktion `showFuerVerbund(show): { show: Show; lokalGeblieben: string[]; mitDokument: string[] }`. Sie arbeitet auf dem Ergebnis von `migrateShow`.

| Feld der Show | Im Ausschnitt |
| --- | --- |
| `schemaVersion`, `name`, `updatedAt` | ja |
| `ablauf` | ja, mit Kennungen (2a) |
| `iveo.event`, `iveo.name`, `iveo.syncedAt` | ja |
| `iveo.speakers` | ja, mit Kennungen (5) |
| `iveo.speakerVeraltetSeit` | ja (6.2). Der Titler auf B zeigt daraus H7. |
| `iveo.sideEvents`, `iveo.filter` | ja |
| `iveo.baseUrl` | **nein**. Kein Tool braucht sie. |
| `tools[].appId` | ja |
| `tools[].settings` | nur freigegebene Schlüssel (14.2) |
| `tools[].document` | **nein** (Dokumente, eigener Zyklus). Nur die Tatsache reist, als `mitDokument` im Stand (13.1). |
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
- Abos sind nach `sitzung` geführt (13.6), nicht nach dem Teilnehmer-Schlüssel.
- Ein `abo` von einer Sitzung mit `art: 'tool'` wird eingetragen und mit `stand` beantwortet. Ein zweites `abo` derselben Sitzung beantwortet der Verteiler erneut mit dem aktuellen Stand (Wiederholung, 13.3).
- Ein `abo` von `art: 'launcher'` wird ignoriert, mit einer Logzeile. Der Slave-Launcher braucht in 2b keine Daten.
- Das Abo endet mit `getrennt(sitzung)`. Das Ende einer ersetzten Sitzung trifft nur deren eigenes Abo.
- Die Grenze von 32 Abos zählt die Abos aller Sitzungen eines Rechners (`rechnerId`).
- Der Verteiler merkt sich je Sitzung Epoche und Folge des zuletzt gesendeten Stands.

### 15.3 RELOAD nur an diesen Rechner

- Läuft die Rolle Master, schickt der Launcher `TIMER/TITLER/RUNDOWN RELOAD` nur an Endpunkte auf seinem eigenen Rechner.
- Eigener Rechner heißt: Die Adresse des Endpunkts ist `127.0.0.1`, `::1` oder eine Adresse einer eigenen Netzwerkkarte (`os.networkInterfaces()`). Die reine Prüfung `istDieserRechner(host, eigeneAdressen)` liegt in `@jm/master-link` (`adresswahl.ts`, 13.7), weil auch der Rundown sie braucht (17.4).
- `sendControlCommand` (`health.ts:195-205`) bekommt dafür die Option `{ nurDieserRechner: true }`.
- **Nachholen:** Der RELOAD-Merker (`reload-nachholen.ts`, `health.ts:74-77`) merkt sich zur Zeile, ob sie nur für diesen Rechner galt. Zählt er dann 0 erreichte Endpunkte, holt er die Zeile nur bei einer neuen Verbindung zu einem Endpunkt **dieses** Rechners nach. Heute schickte er sie dem nächsten Endpunkt der appId, gleich auf welchem Rechner; läuft am Master kein Timer, bekäme so jeder Timer auf B beim Verbinden ein RELOAD.
- In den Rollen „aus“ und „Mit Master verbinden“ bleibt alles wie heute.
- **Rechner ohne Kopplung im selben Netz** (Rechner C): Seine Tools bekamen in 2a das RELOAD des Master-Launchers mit. Wirksam war das nur, wenn C die Show über einen gemeinsamen Pfad geöffnet hatte. Mit 15.3 entfällt es; Daten bekommt C nicht, weil C nicht gekoppelt ist. Das steht in den Release-Notes und als Frage O3 in Abschnitt 27.

### 15.4 Side-Event-Liste auffrischen (Z3)

- **Listen-Abfrage und Umschalten auf die Tagesübersicht:** Mit dem Snapshot wird die Liste neu gebildet, wie beim Binden (`iveo-sync.ts:284-293`): Programme nach dem Filter ohne `programId`, daraus `{ id, title }`.
- **Agenda-Abfrage:** Sie fragt zusätzlich `listProgramsUpdatedSince(event, a.seListeIso)`. Liefert das etwas, lädt sie `listPrograms(event)` und bildet die Liste neu. Neuer Merker `seListeIso`, Anfangswert `syncedAt` der Show, rückt nach jedem erfolgreichen Zusatzabruf vor.
- Scheitert der Zusatzabruf, bleibt die Liste der Datei, und die Abfrage läuft weiter. Wie in 2a-Spec 7.6 („jeder Fehlschlag einer Abfrage setzt `gestört` mit Text“) setzt der Kern dazu den Merker `seListeVeraltet` (nur im Speicher) und den Status „gestört“ mit dem Text „iveo-Abgleich gestört: Side-Event-Liste von iveo nicht abrufbar, Liste aus früherem Stand (seit ⟨hh:mm⟩)“. Ins Log kommt eine Warnung beim ersten Fehlschlag und bei jedem neuen Fehlertext. Der nächste gelungene Zusatzabruf löscht den Merker. Gelten beide Merker (6.2), stehen beide Texte in der Statuszeile, durch „; “ getrennt.
- `schreibeAblauf` (`:290-311`) bekommt die Side Events als Parameter, statt sie nur aus der Datei zu übernehmen.
- Die Signatur (5.3) nimmt die Side Events als `[id, title]` auf. Eine geänderte Liste schreibt und benachrichtigt.

### 15.5 Anzeige im Verbund-Modal am Master

Eine Zeile unter „Gekoppelte Rechner“, je nach `grund` des zuletzt verteilten Stands:
- mit Show: „Show im Verbund: „⟨Show⟩“ · Stand ⟨hh:mm⟩ · ⟨n⟩ Tools beziehen sie“
- `keine-show`: „Show im Verbund: keine Show offen“
- `zu-gross`: „Show „⟨Show⟩“ nicht verteilt: zu groß für den Verbund (⟨n⟩ KiB)“ (rot)
- `nicht-lesbar`: „Show „⟨Dateiname⟩“ nicht verteilt: nicht lesbar“ (rot; der Showname ist dann unbekannt)

**Je Tool** in der Liste der gekoppelten Rechner (wie „Update nötig“ in Teil 1, `packages/master-link/ABNAHME.md` Schritt 13): Timer, Titler und Rundown mit Abo zeigen „bezieht Show-Daten“. Diese drei ohne Abo zeigen 10 s nach ihrer Anmeldung „ohne Show-Daten (Update nötig)“. Andere Tools zeigen nichts dazu; sie wenden in 2b keine Daten an.

### 15.6 Log

| Anlass | Zeile |
| --- | --- |
| neuer Stand | „Verbund: Show „⟨Show⟩“ verteilt (Stand ⟨Folge⟩, ⟨n⟩ KiB, ⟨k⟩ Abos). Lokal geblieben: ⟨Liste oder „nichts“⟩.“ |
| zu groß | „Verbund: Show zu groß für den Verbund (⟨n⟩ KiB > 900 KiB), nicht verteilt.“ |
| nicht lesbar | „Verbund: Show „⟨Dateiname⟩“ nicht lesbar, nicht verteilt.“ |
| Abo-Grenze | „Verbund: ⟨Rechnername⟩ hat 32 Abos, weitere werden nicht beantwortet.“ (einmal je Rechner) |
| neues Abo | „Verbund: Abo von ⟨Rechnername⟩/⟨appId⟩ (⟨k⟩ Abos).“ |
| Stau | „Verbund: Sendung an ⟨Rechnername⟩/⟨appId⟩ gestaut, der neueste Stand folgt danach.“ |
| RELOAD (Rolle Master) | „iveo: RELOAD → ⟨n⟩ Timer, ⟨n⟩ Titler, ⟨n⟩ Rundown auf diesem Rechner; ⟨k⟩ Tools anderer Rechner bekommen die Daten über den Verbund.“ |

---

## 16 · Tool-Seite: `@jm/app-runtime`

### 16.1 Wann ein Tool dem Master folgt

| Lage (aus `master-link.json`) | Verhalten |
| --- | --- |
| Datei fehlt, Rolle „aus“, Rolle Slave ohne Kopplung | **Einzelplatz:** wie 2a. Kein Abo. Anzeige nur, wenn noch Daten eines früheren Masters stehen (V13, unten). |
| Datei beschädigt (Client-Fehler `datei`, `client.ts:361`) | wie Einzelplatz, kein Abo. Anzeige V14 bzw. V13 mit dem Text aus Teil 1 („Kopplungsdatei beschädigt. Neu koppeln.“). Ohne Launcher auf B sähe sonst niemand diese Diagnose. |
| Rolle Master (Tool auf dem Master-Rechner) | **Einzelplatz-Weg:** Datei und RELOAD wie 2a, kein Abo, keine Anzeige. Ausnahme wie in Zeile 1: War der Rechner vorher Slave und stehen noch Daten des früheren Masters, gilt V13. |
| Rolle Slave mit Kopplung | Abo nach jeder Anmeldung. Der Verbundmodus beginnt mit dem ersten gültigen Stand **mit Show** von diesem Master oder beim Start mit einem zwischengespeicherten Stand desselben Masters (16.3). |

**Im Verbundmodus:**
- Ablauf, Speaker und Settings kommen nur vom Master.
- Ein Show-Deep-Link liefert nur noch Dokumente, etwa die Titler-Vorlage. Logzeile: „Verbund: Show-Deep-Link „⟨Pfad⟩“ liefert hier nur Dokumente, die Show-Daten kommen vom Master „⟨M⟩“.“
- RELOAD wird ignoriert. Logzeile: „Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „⟨M⟩“.“ Beide Zeilen erscheinen höchstens einmal je Minute.

**Vor dem Verbundmodus** (warten, Master ohne 2b, Master ohne Show, noch nie verbunden) arbeitet das Tool wie in 2a.

**Ende des Verbundmodus:** Rolle oder Kopplung ändern sich in der Datei (entkoppelt, Rolle „aus“ oder Master), oder die Datei ist beschädigt.
- Die Daten im Tool bleiben stehen. Der Zustand heißt `frueher` (16.2), die Anzeige V13 „Daten vom früheren Master ⟨M⟩ (nicht mehr gekoppelt)“ + Zusatz L.
- Der Zwischenspeicher (16.3) bleibt, damit ein Neustart dieselben Daten mit demselben Hinweis zeigt.
- Ab jetzt wirken Show-Deep-Link und RELOAD wieder wie in 2a. Wendet das Tool eine eigene Show an (Deep-Link, RELOAD, Start mit einer eigenen gemerkten Show), ruft es `verbundDatenErsetzt()`. Das löscht den Zwischenspeicher und beendet `frueher`; die Anzeige verschwindet.
- **Anderer Master:** Koppelt der Rechner neu an einen anderen Master, ist das kein Ende, sondern ein neuer Verbund. Die alten Daten bleiben als `angewendet` stehen (Zusatz L), bis der erste Stand mit Show des neuen Masters sie ersetzt (`neueShow`, 16.2) und den Zwischenspeicher überschreibt.
- Je Tool: Timer 17.1, Titler 17.2 (Datenquelle `frueher`), Rundown 17.3.

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
  mitDokument: string[];        // appIds mit Dokument am Master (13.1)
  empfangenAm: number;          // ms, Uhr dieses Rechners
}

interface MitStand {
  masterName: string;
  angewendet: MasterStand | null;               // zuletzt angewendeter Stand (auch aus dem Zwischenspeicher)
  fehler?: string;                              // Grund, wenn anwenden zuletzt geworfen hat
  verworfen?: { grund: string; seit: number };  // letzter eingehender Stand ungültig (13.2)
}
export type VerbundDaten =
  | { art: 'einzelplatz' }
  | ({ art: 'warte' } & MitStand)        // verbunden, Abo gesendet, noch keine Antwort (≤ 5 s)
  | ({ art: 'ohne-daten' } & MitStand)   // verbunden, 5 s ohne Antwort; Abo alle 30 s erneut (13.3)
  | ({ art: 'aktuell'; letzter: MasterStand } & MitStand)
  | ({ art: 'getrennt'; client: ClientZustand } & MitStand)
  | ({ art: 'frueher'; grund: 'entkoppelt' | 'datei' } & MitStand)  // Ende des Verbundmodus, Daten stehen noch (16.1)
  | { art: 'datei-defekt' };             // Datei beschädigt, keine Master-Daten im Tool

export interface VerbundKopplung {
  rolle: 'aus' | 'master' | 'slave';
  masterId: string | null;
  masterName: string | null;
  masterAdresse: string | null;   // Adresse der laufenden Verbindung, sonst null
  adressen: string[];             // aus dem letzten `angemeldet` (13.7)
  letzteAdresse: string | null;   // aus master-link.json
}

export function folgeMasterShow(h: {
  /** Nur mit show !== null. Wirft = nicht angewendet. */
  anwenden(stand: MasterStand & { show: Show }, neueShow: boolean): void;
  beiWechsel?(d: VerbundDaten): void;
}): void;
export function verbundDaten(): VerbundDaten;
export function imVerbundmodus(): boolean;
/** Das Tool hat eine eigene Show angewendet: Zwischenspeicher löschen, `frueher` beenden (16.1). */
export function verbundDatenErsetzt(): void;
/** Für die Wahl des Launchers im Rundown (17.4). null ohne master-link.json. */
export function verbundKopplung(): VerbundKopplung | null;
```

- `neueShow` ist wahr, wenn `masterId` oder `schluessel` vom zuletzt angewendeten Stand abweichen. Für den allerersten Stand ist es wahr.
- `letzter` ist der zuletzt **empfangene** gültige Stand, `angewendet` der zuletzt angewendete. Bei `keine-show` unterscheiden sie sich.
- `fehler` trägt den Grund, wenn `anwenden` geworfen hat. Dann bleibt `angewendet` auf dem alten Stand, und der Zwischenspeicher bleibt unverändert.
  - **Neuer Versuch:** Die Zustandsmaschine wendet den zuletzt empfangenen Stand bis zu fünfmal im Abstand von 1 s erneut an (etwa bei `EBUSY` auf der TSV). Danach versucht es erst der nächste Stand.
  - Ein Stand ohne Show (`keine-show`, `zu-gross`, `nicht-lesbar`) löscht `fehler`, denn es gibt nichts mehr anzuwenden. Die Anzeige zeigt dann die Zeile dieses Grundes mit Zusatz L.
- `verworfen` entsteht, wenn ein eingehender `stand` oder eine `aenderung` die Prüfung aus 13.2 nicht besteht. Der nächste gültige Stand löscht es.
- `@jm/app-runtime` bekommt `@jm/show` als Abhängigkeit.

### 16.3 Zwischenspeicher

- `<userData des Tools>/verbund/master-stand.json` mit dem zuletzt angewendeten Stand und `fassung: 1`.
- Geschrieben wird nach erfolgreichem `anwenden`, atomar mit bis zu 5 Versuchen im Abstand von 50 ms (wie 2a-Spec 7.4).
- Beim Start wird ein lesbarer Zwischenspeicher immer mit `anwenden(stand, false)` angewendet. Der Zustand danach:
  - `masterId` gleich der Kopplung: sofort Verbundmodus.
  - ohne Kopplung oder Datei beschädigt: `frueher` (16.1).
  - an einen **anderen** Master gekoppelt: kein Verbundmodus. Der Zustand folgt der Verbindung zum neuen Master; Zusatz L nennt den alten Stand, bis der erste Stand mit Show des neuen Masters ihn ersetzt.
- Gelöscht wird der Zwischenspeicher nur durch `verbundDatenErsetzt()` (16.1) und überschrieben durch den nächsten angewendeten Stand.
- Ist die Datei nicht lesbar, wird sie ignoriert, mit einer Warnung. Der nächste Stand überschreibt sie.

### 16.4 Anzeige

Dauerhafte Anzeigen lügen, wenn ein Zustand vergessen wurde (#208). Die Anzeige ist deshalb eine reine Funktion `verbundAnzeige(d: VerbundDaten): { text: string; farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft' } | null` in `packages/app-runtime/src/verbund-anzeige.ts`, ohne Electron. Sie prüft den Union-Typ vollständig (`never`). Getestet wird **jede Zeile** dieser Tabelle.

`⟨M⟩` = Name des Masters. `⟨S⟩ ⟨hh:mm⟩` = Name der Show (höchstens 40 Zeichen, sonst gekürzt mit „…“) und Empfangszeit des **angewendeten** Stands auf der Uhr dieses Rechners.

„… · letzter Stand: ⟨S⟩ ⟨hh:mm⟩“ heißt unten **Zusatz L**. Er steht genau dann da, wenn `angewendet` nicht `null` ist.

| # | Lage | Text | Farbe |
| --- | --- | --- | --- |
| V1 | `einzelplatz` | keine Anzeige | – |
| V2 | `warte` | „Verbunden mit ⟨M⟩ · Show wird geladen…“ + Zusatz L | gelb |
| V3 | `ohne-daten` | „⟨M⟩ antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)“ + Zusatz L | gelb |
| V4 | `aktuell`, `letzter` mit Show | „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“ | grün |
| V5 | `aktuell`, `keine-show`, etwas angewendet | „⟨M⟩ hat keine Show offen“ + Zusatz L | gelb |
| V6 | `aktuell`, `keine-show`, nichts angewendet | „⟨M⟩ hat keine Show offen“ | gedämpft |
| V7 | `aktuell`, `zu-gross` | „Show am Master zu groß für den Verbund“ + Zusatz L | rot |
| V8 | `aktuell`, `nicht-lesbar` | „Show am Master nicht lesbar“ + Zusatz L | rot |
| V9 | `getrennt`, Client sucht oder verbindet, etwas angewendet | „⟨M⟩ nicht verbunden“ + Zusatz L | gelb |
| V10 | `getrennt`, Client sucht oder verbindet, nichts angewendet | „Suche ⟨M⟩…“ | gelb |
| V11 | `getrennt`, Client-Fehler | der Text des Clients (`ClientZustand.fehler.text`, `fehlerText` aus `fehler.ts`) + Zusatz L | rot |
| V12 | jede Lage außer `einzelplatz` und `datei-defekt` mit `fehler` | „Show vom Master nicht übernommen: ⟨Fehler⟩“, mit angewendetem Stand dazu „ · in Benutzung: ⟨S⟩ ⟨hh:mm⟩“ | rot |
| V13 | `frueher` | `entkoppelt`: „Daten vom früheren Master ⟨M⟩ (nicht mehr gekoppelt)“; `datei`: „Kopplungsdatei beschädigt. Neu koppeln.“; jeweils + Zusatz L | gelb bzw. rot |
| V14 | `datei-defekt` | „Kopplungsdatei beschädigt. Neu koppeln.“ | rot |
| V15 | jede Lage außer `einzelplatz` und `datei-defekt` mit `verworfen` | „Show-Daten von ⟨M⟩ nicht lesbar (Tool-Update nötig?)“ + Zusatz L | rot |

- Vorrang: V12 vor V15 vor allen anderen Zeilen.
- Im Test wird jede Zeile mit und ohne angewendeten Stand geprüft, wo die Zeile beides zulässt. V11 wird für **jeden** `FehlerCode` aus `fehler.ts` einzeln geprüft: Der Text kommt unverändert aus dem Client. „nicht erreichbar“ wäre für `unbekannt`, `ersetzt`, `signatur`, `protokoll`, `uhr`, `zertifikat` und `kein-master` falsch, denn dort antwortet der Master; die Teil-1-Abnahme hat genau diese Unterscheidungen abgenommen (`packages/master-link/ABNAHME.md` Schritte 7, 8a, 8b).
- **Was die Anzeige vom Client erbt (Teil 1, `client.ts:606-611`, `fristen.ts`):** Nach dem ersten Fehlschlag bleibt der Client auf `fehler`, bis ein neues Ergebnis kommt; „sucht“ und „verbindet“ überschreiben ihn nicht (Ruling jj). V9/V10 erscheinen deshalb nur bis zum ersten Fehlschlag, danach gilt V11. Fällt die Leitung still weg (Kabel gezogen), bleibt der Client bis zur Stille-Frist von 25 s `verbunden`; so lange bleibt V4 grün.
- Die Uhrzeit ist bewusst die Empfangszeit, nicht die Zeit des Masters. Die Uhren zweier Rechner können abweichen.

### 16.5 IPC und Platz in den Tools

- app-runtime registriert `ipcMain.handle('jmps:verbund-anzeige')` und schickt bei jedem Wechsel `jmps:verbund-anzeige` an alle Fenster. Die Netzarbeit bleibt im Main; die CSP bleibt unberührt.
- Jedes der drei Preloads bekommt `verbundAnzeige()` und `onVerbundAnzeige(cb)`. Darüber liest auch der Durchgang 19.7 die Anzeige per CDP.
- Wo der Platz knapp ist (Pille, Abzeichen), kürzt die Stelle den Text mit „…“ und zeigt den vollen Text als Tooltip.
- **Platz:**
  - Timer: Pille neben „Sync“ (`apps/timer/src/renderer/src/components/Topbar.tsx:57-58`)
  - Titler: Abzeichen vor „Suite · ⟨n⟩ verbunden“ (`OperatorView.tsx:249-277`); dazu Quelle Q4 „Quelle: Show vom Master „⟨S⟩““ in Daten / Recall
  - Rundown: im Statusstreifen der Tool-Verbindungen (`apps/rundown/src/renderer/src/App.tsx:163`, `components/ToolLinks.tsx`)

---

## 17 · Anwenden je Tool

Jedes Tool wendet den Stand an wie eine gelesene Datei (D3). Der Einstieg ist dieselbe Funktion wie beim Lesen der Datei, nur mit dem Show-Objekt statt des Pfads.

### 17.1 Timer

`applyShowFromPath` (`apps/timer/src/main/index.ts:322-357`) wird geteilt in Lesen und Anwenden.
- **Neu, rein:** `apps/timer/src/shared/show-anwenden.ts` mit `timerAktionenAusShow(show, mode): TimerAktion[]`. Die Funktion liefert die Aktionen (`tt:setAll` bzw. `tt:replaceItems`, `setDuration`), statt sie auszuführen. Sie importiert nur `@jm/show` und `src/shared`, also kein Electron. So läuft sie im bestehenden Timer-Selbsttest (`node --experimental-strip-types`, `apps/timer/test/selftest.ts:3-24`) zusammen mit `reduce` aus `timer-state.ts`.
- `index.ts` ruft sie und führt die Aktionen mit `dispatch` aus; die Logzeile „Aktiver Punkt … nicht mehr vorhanden“ bleibt dort.
- Der Verbundweg und `applyShowFromPath` nutzen dieselbe Funktion.

| Lage | Verhalten |
| --- | --- |
| `neueShow` (erster Stand, Master hat eine andere Show geöffnet) | Modus `'initial'`: `tt:setAll` und `settings.durationMs`, wie beim Öffnen einer Show |
| gleiche Show, neuer Stand | Modus `'reload'`: `tt:replaceItems`, der aktive Punkt folgt seiner Kennung (2a-Spec 6.1), der Countdown bleibt |
| Start mit Zwischenspeicher | `'reload'` |
| `keine-show`, `zu-gross`, `nicht-lesbar` | nichts |
| `frueher` (16.1) | nichts; Deep-Link und RELOAD wirken wieder und rufen `verbundDatenErsetzt()` |

### 17.2 Titler

| Lage | Verhalten |
| --- | --- |
| Stand mit Speakern | TSV schreiben (mit `@kennung`), Datenquelle `master` (wie `show`, Ordner `iveo-data`), Schlüssel halten nach 7.3 |
| gleiche Show, keine Speaker | Liste bleibt, H3 |
| neue Show, keine Speaker | Datenquelle `ordner` |
| `keine-show`, `zu-gross`, `nicht-lesbar` | nichts |
| Deep-Link im Verbundmodus | nur die Vorlage importieren (C3) |
| Ende des Verbundmodus (`frueher`, 16.1) | Datenquelle `frueher` (Q3), die TSV bleibt. Ein Deep-Link oder RELOAD einer eigenen Show ersetzt sie wie in 7.7 und ruft `verbundDatenErsetzt()`. |
| Start ohne Deep-Link, `show-zuletzt.json` mit `quelle: 'master'` | gleicher Master gekoppelt: Datenquelle `master`, die TSV gilt, danach folgt der Zwischenspeicher bzw. der nächste Stand. Sonst Datenquelle `frueher` (Q3). |

`show-zuletzt.json` bekommt im Verbundmodus `{ quelle: 'master', masterId, schluessel, showName }`. 7.7 liest diese Form ebenfalls (Zeile oben); `mitSpeakern` und `showPfad` fehlen dann.

**Eigener DataLink-Ordner auf Rechner B (D4).** D4 sagt: Das Tool folgt **immer** der Show des Masters. Für den Titler heißt das:
- Trägt die Show am Master Speaker (Datenquelle `master`), ist die Ordnerwahl unter Einstellungen › DataLink gesperrt, mit dem Text „Im Verbund kommen die Speaker vom Master „⟨M⟩“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.“ So überschreibt kein Stand still eine gerade gewählte eigene CSV.
- Trägt die Show am Master keine Speaker (Datenquelle `ordner`), ist der eigene Ordner frei wählbar wie am Einzelplatz. Kommt danach ein Stand mit Speakern, wechselt die Quelle auf `master`; ein Eintrag aus der CSV auf Sendung wird nach A8 gehalten.
- Die Alternative, bei der eine Ordnerwahl die Master-Speaker bis zu einem Knopf „Zurück zur Show vom Master“ anhält, widerspräche „immer“. Sie steht als Frage O1 in Abschnitt 27.

### 17.3 Rundown

**Gedächtnis (Z5):**
- **Eine Schlüsselfunktion für beide Fälle:** `gedaechtnisSchluesselFuer(q)` mit `q = { art: 'pfad', showPfad } | { art: 'master', masterId, schluessel }`. Für `pfad` bleibt die Formel aus 2a (`gedaechtnis.ts:83-85`). Für `master` ist es `sha256("master|" + masterId + "|" + schluessel)`, die ersten 16 Hex-Zeichen. Er passt damit in das Format des Zeigers (`gedaechtnis.ts:177-196`).
- Auf dem Master-Rechner und am Einzelplatz bleibt der Pfad-Schlüssel aus 2a.
- **Inhalt des Gedächtnisses** (heute verlangt `pruefeGedaechtnis` einen nicht leeren `showPfad`, `gedaechtnis.ts:100`, und `schreibeGedaechtnis` bildet den Dateinamen aus `showPfad`, `:142`):
  - neu optional `quelle: 'master'`, `masterId`, `masterSchluessel`. Mit `quelle: 'master'` sind `masterId` (nicht leer) und `masterSchluessel` (16 Hex-Zeichen) Pflicht, `showPfad` ist dann leer.
  - Ohne `quelle` gilt wie in 2a: `showPfad` nicht leer.
  - `schreibeGedaechtnis` nimmt den Dateinamen aus `gedaechtnisSchluesselFuer`, je nach `quelle`. Wer der alten Funktion einen leeren Pfad gäbe, schriebe alle Master-Shows unter den Hash des Arbeitsordners; beim nächsten Start legte `pruefeGedaechtnis` die Datei als „unlesbar“ beiseite, und die Aktionen wären weg (#235).
  - Rundown 0.6/0.7 lesen solche Dateien nie: Sie bilden Schlüssel nur aus Pfaden.
- Der Zeiger `regie/zuletzt.json` bekommt optional `quelle: 'master'`, `masterId`, `masterSchluessel`, `showName`. `showPfad` ist dann leer. Ein Rundown 0.6.0 oder 0.7.0 verwirft einen solchen Zeiger (`leseZeiger` verlangt `showPfad`, `:182`) und startet wie ohne Zeiger.

**Ladewege im Verbundmodus** (Ergänzung zu 2a-Spec 5.2):

| Weg | Verhalten |
| --- | --- |
| Stand mit `neueShow` | wie „Show-Deep-Link, andere Show“ (`ladeAndereShow`, `apps/rundown/src/main/index.ts:641`): Show merken, Ausgangsstand aus dem Gedächtnis mit Master-Schlüssel → Übergang (unten) → leer, dann `wendeShowAn`. Hinweis „Show vom Master „⟨S⟩“ übernommen.“ (kurz) |
| neuer Stand, gleiche Show | wie RELOAD (`reloadShow`, `:737`): `wendeShowAn`, Position nach R7 bzw. 4.4, bricht keine GO-Folge ab |
| `keine-show`, `zu-gross`, `nicht-lesbar` | nichts am Dokument |
| Start ohne Deep-Link, Zeiger mit `quelle: 'master'` | Gedächtnis mit Master-Schlüssel laden. Liegt ein Zwischenspeicher desselben Masters und derselben Show vor, wird er danach angewendet wie „neuer Stand, gleiche Show“. Sonst wartet der Rundown auf den nächsten Stand; die Anzeige (16.4) sagt, worauf. Ist der Rechner nicht mehr an diesen Master gekoppelt, gilt `frueher` (V13): Das Dokument bleibt, bis eine eigene Show es ersetzt. |
| `frueher` (16.1) | nichts am Dokument. Deep-Link und RELOAD wirken wieder (2a) und rufen `verbundDatenErsetzt()`. |
| Show-Deep-Link | Daten ignoriert (16.1) |
| `RUNDOWN RELOAD` | ignoriert (16.1) |
| „Öffnen…“ einer `.jmrundown` | Die Datei wird Ausgangsstand und sofort mit dem angewendeten Stand abgeglichen. „Speichern“ schreibt in die Datei (2a-Spec 4.8). |
| „Neu“ | leeres Dokument, sofort abgeglichen |

- **Neue oder gleiche Show** entscheidet der Rundown über seinen Zeiger (gemerkte Show = `masterId` + `masterSchluessel`), nicht über `neueShow`. So passt es auch dann, wenn app-runtime beim Start den Zwischenspeicher mit `neueShow = false` liefert, der Rundown aber zuletzt eine andere Show gemerkt hatte.
- **Übergang:** Gibt es für den Master-Schlüssel noch kein Gedächtnis, gilt der aktuelle Stand des Rundowns als Ausgangsstand, wenn sein Name dem Namen der Show gleicht. So bleiben Aktionen erhalten, wenn B bisher mit einer kopierten Datei derselben Show lief. Der Abgleich über die Kennungen ordnet sie zu.
- **Eigene Rundown-Datei der Show:** wird auf B nicht geladen. Ob es sie gibt, sagt `mitDokument` im Stand (13.1): Enthält es `jm-rundown`, zeigt der Rundown auf B einen **stehenden** Hinweis „Die Rundown-Datei dieser Show liegt am Master und wird hier nicht geladen. Ihre Aktionen fehlen auf diesem Rechner.“ und schreibt einmal je Show dieselbe Logzeile. Ohne diese Angabe könnte B es nicht wissen, denn der Ausschnitt trägt kein `document` (14.1).
- `ablaufSchluessel` und `eigeneTimerListe` (2a-Spec 6.2) kommen aus dem Stand. Timer und Rundown auf B haben damit dieselbe Liste. Die Annahme in `apps/rundown/src/shared/sprung.ts:19-20` gilt so auch über Rechner hinweg, bis auf das kurze Fenster, in dem ein Stand den einen schon erreicht hat und den anderen noch nicht.

### 17.4 Zwei Launcher (Z2)

- Der Conductor sammelt für die Rolle `launcher` alle Funde, statt den letzten zu nehmen (`apps/rundown/src/main/conductor.ts:81-88`).
- Reine Funktion `waehleLauncher(funde, kopplung, eigeneAdressen)` in `apps/rundown/src/shared/conductor.ts`. `kopplung` kommt aus `verbundKopplung()` (16.2), `eigeneAdressen` aus `os.networkInterfaces()`, die Prüfung „auf diesem Rechner“ ist `istDieserRechner` aus `@jm/master-link` (13.7):

| Lage | Gewählt |
| --- | --- |
| Rolle Slave, verbunden | Fund, dessen Adresse `kopplung.masterAdresse` ist oder in `kopplung.adressen` steht. Ohne passenden Fund: direkt `kopplung.masterAdresse` mit Port 8736. |
| Rolle Slave, nicht verbunden | Fund passend zu `kopplung.letzteAdresse`, sonst keiner |
| Rolle Master | Fund auf diesem Rechner (`istDieserRechner`) |
| Einzelplatz | wie heute: der letzte Fund |

- Manuelle Endpunkte haben weiter Vorrang (`mergeEndpoints`).
- Folge: `LAUNCHER SIDEEVENT` aus einem Rundown auf B landet beim Master, auch wenn auf B ein eigener Launcher läuft.
- **Andere Rollen bleiben bei „zuletzt gefunden“.** Laufen Titler oder Timer auf A und auf B (am Master startet `openShow` die Tools der Show, `apps/launcher/src/main/show.ts:51-53`), kann ein GO aus dem Rundown auf B das Tool an A treffen, und `titlerKannKennung` (8.3) stammt dann von dort. Das ist vorbestehend und steht als FA4 in Abschnitt 24; ob 2b es gleich mitlöst, ist Frage O2. Bis dahin legt die Abnahme (20) die Endpunkte für Titler und Timer im Rundown auf B von Hand fest.

---

## 18 · Verhalten bei Master weg, Show zu, gemischten Versionen

| Lage | Tool auf B im Verbundmodus | Anzeige |
| --- | --- | --- |
| Netz kurz weg (unter 25 s, die Leitung reißt nicht) | Daten bleiben, die Verbindung hält | V4 |
| Netz länger weg (Kabel gezogen) | Daten bleiben. Nach dem Wiederverbinden Neuabo; gleicher Stand wird nicht neu angewendet. | bis 25 s V4 (Stille-Frist), kurz V9, nach dem ersten Fehlschlag V11 mit dem Text des Clients (etwa `netz` oder `nicht-gefunden`); danach V2, V4 |
| Master-Launcher beendet | Daten bleiben | kurz V9, nach dem ersten Fehlschlag V11 (etwa `nicht-gefunden` oder `verweigert`) |
| Master-Launcher startet ohne Show | Daten bleiben | V5 |
| Master öffnet dieselbe Show wieder | neue Epoche; angewendet wird, das Ergebnis ist gleich (Abgleich idempotent) | V4 |
| Master öffnet eine andere Show | `neueShow`: Timer wie Show öffnen, Rundown anderes Gedächtnis, Titler neue Liste | V4 |
| Master-Rolle aus | Daten bleiben | V11 |
| Kopplung an B getrennt | Verbundmodus endet (16.1), Daten bleiben bis zu einer eigenen Show | V13 |
| Tool auf B startet neu, Master fehlt | Daten aus dem Zwischenspeicher | kurz V9, dann V11 |
| Stand nicht anwendbar | alter Stand bleibt, bis zu fünf neue Versuche | V12 |
| Stand ungültig (Prüfung 13.2) | alter Stand bleibt | V15 |

**Gemischte Versionen:**

| Master-Launcher | Tool auf B | Ergebnis |
| --- | --- | --- |
| ≤ 0.14 (ohne Verteiler) | 2b-Tool | `abo` wird ignoriert. Nach 5 s V3; das Tool arbeitet wie in 2a. |
| 0.15 | Timer ≤ 0.13, Titler ≤ 0.10, Rundown ≤ 0.7 | kein Abo, keine Daten. RELOAD vom Master erreicht B nicht mehr (15.3). Die Tools lesen ihre Datei nur beim Deep-Link. |
| 0.15 | 2b-Tool | Daten |
| 0.15 | Rundown 0.8 und Titler 0.10 auf B | Der Rundown schickt die `@`-Form. Der Titler 0.10 liest seine eigene, ältere Datei: Er findet die Kennung oder den genauen Namen; sonst gilt A10/A11 mit Hinweis, nie die vorherige Person. |
| beliebig | Tool auf dem Master-Rechner | Einzelplatz-Weg, unverändert |
| 0.15 | Slave-Launcher beliebiger Version | nicht beteiligt |
| 0.15, Rolle Master | Tools auf einem Rechner C **ohne** Kopplung im selben Netz | kein RELOAD mehr vom Master (15.3), keine Daten. Bisher wirkte das RELOAD dort nur bei gemeinsamem Show-Pfad. Frage O3. |
| Rolle „aus“ | alle | unverändert |

Ein Teil-1-Teilnehmer (Timer 0.12.0, Titler 0.9.0, Launcher 0.12.0) bekommt nie eine 2b-Zeile, weil der Master nur an Abos sendet.

---

## 19 · Release 2: Tests, CI, Durchgang

### 19.1 `@jm/master-link` (`npm run selftest -w @jm/master-link`)

- alle Tests aus 13.5
- `pruefeAbo`, `pruefeStand`: jede Regel aus 13.2, jeweils gültig und ungültig
- Server: `abo` → Ereignis `daten` mit `sitzung`; Sitzung zu → `getrennt(sitzung)` genau einmal; `sendeDaten` an eine weg-Sitzung → `'weg'`
- **Ersetzung:** Ein Tool meldet sich mit gleicher pid und Adresse neu an, die neue Sitzung schickt ihr `abo`, bevor die alte zu ist. Erwartet: `getrennt` nur für die alte Sitzung (sofort in `meldeAn`), das Abo der neuen bleibt, die nächste `aenderung` kommt bei ihr an, und sie bekommt keine `aenderung` vor ihrem `abo`.
- `istDieserRechner`: Loopback, eigene Adresse, fremde Adresse
- Rückdruck: Der Client liest nicht (Socket pausiert) → nach mehr als 1 MiB `'gestaut'`; der Client liest wieder → `entstaut`
- Ein Teil-1-Client ohne `abo` bleibt angemeldet und bekommt keine 2b-Zeile
- Client: `sende` nur im Zustand verbunden; `kopplung()` liefert Rolle, Master, letzte Adresse und die Adressen aus `angemeldet`

### 19.2 `@jm/show` (im iveo-Selbsttest)

- `showFuerVerbund`: `document`, `network`, `baseUrl` fehlen; jeder Schlüssel aus 14.2 reist oder bleibt; ein unbekannter Schlüssel `token` bleibt lokal und steht in `lokalGeblieben`; `mitDokument` nennt genau die Tools mit Dokument; `speakerVeraltetSeit` reist
- Das Ergebnis läuft unverändert durch `migrateShow` (idempotent)

### 19.3 Launcher

- **neu `test/verteiler.test.ts`** (an `selftest:verbund` angehängt):
  1. Abo → `stand` mit Epoche und Folge 0 bzw. dem aktuellen Stand
  2. gleiche Show zweimal gemeldet → keine neue Folge
  3. geänderte Show → Folge + 1, `aenderung` an alle Abos, einmal serialisiert
  4. Ausschnitt über 900 KiB → `zu-gross`
  5. neue Epoche bei Neustart der Rolle
  6. `launcher`-Abo ignoriert; das 33. Abo eines Rechners ignoriert; nach dem Ende eines Abos wird ein wiederholtes Abo beantwortet
  7. gestaut → nur der neueste Stand nach `entstaut`
  8. **Kein Token:** Der Test legt ein Token im nachgebauten Token-Speicher ab und eine Presenter-PIN in der Show. Beide stehen in keiner gesendeten Zeile.
  9. Abos hängen an der Sitzung: `getrennt` einer ersetzten Sitzung löscht nicht das Abo der neuen
  10. Zeile des Verbund-Modals (reine Funktion): jede Variante aus 15.5, dazu „bezieht Show-Daten“ und „ohne Show-Daten (Update nötig)“ je Tool
- **Kern** (`test/iveo-abgleich.test.ts`): `meldeShow` an allen Stellen aus 15.1; Side-Event-Liste im Listen- und im Agenda-Modus; Zusatzabruf scheitert → Liste der Datei, Abfrage läuft weiter, Status „gestört“ mit dem Text aus 15.4; nächster Zusatzabruf gelingt → „in Ordnung“
- **RELOAD-Merker** (`test/reload-nachholen.test.ts`): Eine Zeile mit `nurDieserRechner`, die niemanden erreichte, wird bei der Verbindung eines Endpunkts auf einem fremden Rechner **nicht** nachgeholt, bei einem Endpunkt dieses Rechners schon.

### 19.4 app-runtime (bestehenden Selbsttest erweitern)

`packages/app-runtime` hat schon `test/selftest.ts` (CSP) und das Skript `selftest` mit `node --experimental-strip-types`, bisher nicht in der CI. Der CSP-Test bleibt. Neu kommt `test/verbund.test.ts` dazu, mit `tsx` (neue devDependency, wie in `@jm/master-link`), weil die neuen Module `@jm/show` und `@jm/master-link` ohne `.ts`-Endungen importieren. Das Skript wird `node --experimental-strip-types test/selftest.ts && tsx test/verbund.test.ts`.

- `verbundAnzeige`: jede Zeile V1–V15; V11 für jeden `FehlerCode` einzeln (Text unverändert aus dem Client)
- Ablauf der reinen Zustandsmaschine (ohne Electron, mit übergebener Uhr): Abo nach `angemeldet`; nach 5 s `ohne-daten`; Abo alle 30 s erneut; neuer und alter Stand nach 13.3; `neueShow`; `anwenden` wirft → `fehler`, Zwischenspeicher unverändert, fünf neue Versuche im Abstand von 1 s; ein Stand `keine-show` löscht `fehler`; ungültiger Stand → `verworfen`, der nächste gültige löscht es; `imVerbundmodus()` liefert wahr nur im Verbundmodus (Grundlage für „RELOAD ignoriert“ in allen drei Tools)
- Ende des Verbundmodus: Entkoppeln → `frueher`, Zwischenspeicher bleibt; `verbundDatenErsetzt()` → `einzelplatz`, Zwischenspeicher weg; Datei beschädigt → `frueher` mit `datei` bzw. `datei-defekt`
- Zwischenspeicher beim Start: gleicher Master → Verbundmodus; ohne Kopplung → `frueher`; anderer Master → angewendet, kein Verbundmodus, der erste Stand des neuen Masters ersetzt ihn
- `verbundKopplung()`: Rolle, Master, Adressen

### 19.5 Tools

- Timer: `timerAktionenAusShow` (17.1) mit `initial` und `reload`, geprüft über `reduce`; im bestehenden Selbsttest. „RELOAD im Verbundmodus ignoriert“ prüfen die Zustandsmaschine (19.4, `imVerbundmodus`) und der Durchgang (19.7 Nr. 6).
- Titler: Stand mit Speakern, gleiche Show ohne Speaker, neue Show ohne Speaker; Ordnerwahl gesperrt bei Quelle `master`, frei bei `ordner`; `frueher` nach dem Entkoppeln; Start mit `show-zuletzt.json` `quelle: 'master'` gekoppelt und ungekoppelt
- Rundown: `gedaechtnisSchluesselFuer` für beide Arten; Gedächtnis mit `quelle: 'master'` schreiben, neu lesen, die Aktionen bleiben (Neustart auf B); Zeiger mit `quelle: 'master'` lesen und schreiben; Übergang mit gleichem Namen; stehender Hinweis bei `mitDokument` mit `jm-rundown`; `waehleLauncher` für jede Zeile aus 17.4

### 19.6 CI

Neuer Schritt im Job `selftests`: „app-runtime (CSP, Verbund-Anzeige, Abo-Zustand)“ mit `npm run selftest -w @jm/app-runtime`. Er führt beide Teile aus 19.4 aus. Die übrigen Tests laufen in bestehenden Schritten; `selftest:verbund` im Launcher bekommt `tsx test/verteiler.test.ts` angehängt. Keiner lädt Electron. Die Zeitgrenze bleibt 15 min.

### 19.7 Durchgang mit gebauten Tools und Test-Master

`apps/launcher/test/e2e-teil2b-verbund.ts` (tsx), auf einem Rechner:
- Das Skript startet einen `MasterLinkServer` mit Test-Identität auf Port 8738 und den Verteiler mit einer Test-Show.
- Es schreibt für die Tools eine `master-link.json` mit Rolle Slave und fester Adresse `127.0.0.1`, wie die bestehenden Helfer der Master-Link-Tests. Vorher legt es die vorhandene Datei beiseite (Muster aus `e2e-teil2a.mjs:49-57`).
- Gestartet werden gebaute Timer, Titler und Rundown ohne Deep-Link, jeweils mit `--remote-debugging-port`.
- **Messpunkte:** STATE über den Steuerport; die V-Zeile je Tool per CDP über `verbundAnzeige()` aus dem Preload (16.5); die Hinweise des Rundowns per CDP, gesammelt wie in `apps/rundown/test/e2e-teil2a.mjs` (kurze Hinweise verschwinden nach 6 s); das Bild des Titlers als SHA-256 von `toDataURL()` wie in 9.6 (9e), mit der Vorlage `{{name}}`/`{{funktion}}`.

**Prüfungen:**
1. Alle drei zeigen die Test-Show (STATE von Timer, Titler, Rundown) und V4.
2. Änderung am Ablauf → angewendet in höchstens 2 s.
3. Bauchbinde auf Sendung (Bild A), Speakerliste ohne diese Person verteilen → `entry` bleibt **und** Bild gleich A.
4. Server stoppen → Daten bleiben, V9 bzw. V11; Server mit neuer Epoche und gleicher Show starten → V4, und die gesammelten Hinweise des Rundowns enthalten keinen neuen Eintrag.
5. Tool neu starten, ohne Server → Daten aus dem Zwischenspeicher, V9 bzw. V11 mit Zusatz L.
6. Gleichzeitiges RELOAD über den Steuerport → ignoriert, Logzeile.
7. `master-link.json` auf Rolle „aus“ umschreiben → V13 „Daten vom früheren Master …“, Daten bleiben.

---

## 20 · Release 2: Abnahme (Owner, zwei Rechner)

`packages/master-link/ABNAHME-2b.md`, je Schritt mit Ergebnisspalte. Rechner A = Master, Rechner B gekoppelt wie in Teil 1.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Launcher 0.15.0, Timer 0.14.0, Titler 0.11.0, Rundown 0.8.0 auf A und B. Im Rundown auf B die Endpunkte für Titler und Timer von Hand auf `127.0.0.1` setzen (17.4, FA4). | Versionen sichtbar |
| 2 | An A eine iveo-Show öffnen. Auf B Timer, Titler und Rundown über die Kachel starten, **ohne** Show auf B. | Alle drei zeigen „Show vom Master: ⟨S⟩ · Stand ⟨hh:mm⟩“ und die Daten der Show. Das Verbund-Modal an A zeigt „… · 3 Tools beziehen sie“ und bei den drei Tools von B „bezieht Show-Daten“. |
| 3 | An A im Panel ein Side Event umschalten | Auf B wechseln Timer, Titler und Rundown in höchstens 3 s. Der Rundown meldet den Kontextwechsel. |
| 4 | In iveo am Test-Side-Event einen Agenda-Punkt einfügen (wie 2a-Abnahme) | Auf B nach der Abfrage am Master (höchstens 45 s) plus höchstens 3 s |
| 5 | Auf B eine Bauchbinde auf Sendung, an A auf ein Side Event umschalten, das die Person nicht verknüpft | Die Person bleibt auf Sendung, mit Hinweis |
| 6 | Auf B den Launcher starten. Im Rundown auf B ein GO mit „Launcher · Side Event“ | Die Umschaltung passiert an A (Log an A), nicht am Launcher von B |
| 7 | Netzkabel an B 60 s ziehen, dann wieder stecken | Bis zu 25 s bleibt die Anzeige grün (Stille-Frist aus Teil 1, 16.4). Danach kurz gelb „⟨M⟩ nicht verbunden · letzter Stand …“, dann rot mit dem Text aus Teil 1 (etwa „Netz zum Master nicht erreichbar …“ oder „⟨M⟩ nicht erreichbar: ausgeschaltet …“) und „· letzter Stand …“. Die Daten bleiben. Nach dem Stecken innerhalb von etwa 15 s wieder grün, ohne Hinweis im Rundown. |
| 8 | Launcher an A beenden; dann ohne Show starten; dann die Show öffnen | erst kurz gelb „nicht verbunden · letzter Stand“, dann rot mit dem Text aus Teil 1 (wie in Teil-1-Abnahme 8a, etwa „⟨M⟩ nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus …“) · letzter Stand; dann gelb „hat keine Show offen · letzter Stand“; dann grün |
| 9 | An A eine andere Show öffnen | Auf B: Timer neu wie beim Öffnen einer Show, Rundown mit der neuen Show, Titler mit der neuen Liste |
| 10 | Auf B den Titler schließen, Launcher an A beenden, Titler auf B starten | Daten aus dem letzten Stand; kurz gelb „nicht verbunden · letzter Stand …“, dann rot mit dem Text aus Teil 1 · letzter Stand … |
| 10b | Auf B im Launcher die Kopplung lösen | Timer, Titler und Rundown auf B zeigen „Daten vom früheren Master ⟨M⟩ (nicht mehr gekoppelt) · letzter Stand …“, die Daten bleiben. Danach auf B eine eigene Show öffnen: Die Anzeige verschwindet. Danach B wieder koppeln. |
| 11 | Show an A mit Timer-Einstellungen und einem Recorder-Ordner öffnen | Timer auf B nutzt die Timer-Liste. Log an A: „Lokal geblieben: jm-recorder.dir …“ |
| 12 | Auf B einen Timer 0.13.0 laufen lassen (falls zur Hand) | läuft wie bisher, ohne Daten und ohne Absturz |
| 13 | An A die Rolle „aus“, ein Rechner allein | Show-Start, RELOAD und Anzeigen wie vor 2b |

---

## 21 · Release 2: Aufbau, Release, Doku

| Paket/App | Dateien | Inhalt |
| --- | --- | --- |
| `@jm/master-link` | `src/rahmen.ts`, `verbindung.ts`, `client.ts`, `server.ts`, `adresswahl.ts` (`istDieserRechner`), **neu** `show-daten.ts`, Tests. `koppeln.ts` bleibt unverändert (13.5). | 13 |
| `@jm/show` | `src/index.ts` | `showFuerVerbund`, `VERBUND_EINSTELLUNGEN` (14) |
| `@jm/app-runtime` | `src/index.ts`, **neu** `verbund-anzeige.ts`, **neu** `verbund-daten.ts` (Zustandsmaschine ohne Electron), `test/selftest.ts` bleibt, **neu** `test/verbund.test.ts`, `package.json` (Skript, `tsx`, `@jm/show`) | 16, 19.4 |
| Launcher Main | **neu** `verbund/verteiler.ts`, `verbund/master.ts`, `verbund/kern.ts`, `iveo-abgleich-kern.ts`, `iveo-sync.ts`, `health.ts`, `reload-nachholen.ts`, Tests | 15 |
| Launcher Renderer | Verbund-Modal am Master | 15.5 |
| Timer | **neu** `src/shared/show-anwenden.ts`, `src/main/index.ts`, `src/preload/index.ts`, `Topbar.tsx`, `test/selftest.ts` | 17.1, 16.5 |
| Titler | `src/main/index.ts`, `show-quelle.ts`, `src/shared/datenquelle.ts`, Preload, `OperatorView.tsx`, Selbsttest | 17.2, 16.5 |
| Rundown | `src/main/index.ts`, `src/main/conductor.ts`, `src/shared/conductor.ts` (`waehleLauncher`), `gedaechtnis.ts`, Preload, `ToolLinks.tsx`, Selbsttest | 17.3, 17.4, 16.5 |
| CI | `.github/workflows/ci-checks.yml` | 19.6 |

**Nicht angefasst:** `packages/suite-control-protocol`, Companion-Modul, Timer-Socket `:7777`, Connect, Q&A, Battle.

**Release:**
- Launcher **0.15.0**, Timer **0.14.0**, Titler **0.11.0**, Rundown **0.8.0**. Die Tools bringen das neue `app-runtime` und `master-link` mit.
- Changelog, Tags und Freigabe wie in 11.
- Release-Notes nennen: Tools auf einem zweiten Rechner brauchen das Update, sonst bekommen sie keine Show-Daten und kein RELOAD mehr vom Master. Tools auf einem Rechner **ohne** Kopplung bekommen ebenfalls kein RELOAD mehr vom Master; wer dort Daten braucht, koppelt den Rechner. Nach dem Entkoppeln bleiben die Daten vom Master mit Hinweis stehen, bis eine eigene Show geöffnet wird.
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

Gemessen wird an einem echten Prod-Event mit dem iveo-Token des Owners. M1 (a), der erste Teil von M2 (b) und M3 lesen nur. M2 (a) setzt am unveröffentlichten Test-Side-Event eine Speaker-Verknüpfung und nimmt sie danach zurück. M1 (b) und der zweite Teil von M2 (b) bearbeiten nur einen unveröffentlichten Test-Speaker und nehmen die Änderung zurück; gibt es keinen, entfallen sie. Die Ergebnisse kommen in diese Spec und in den Plan.

| # | Frage | Messung | Wenn ja | Wenn nein |
| --- | --- | --- | --- | --- |
| M1 | Sind iveo-Speaker-IDs je Event eindeutig und stabil? | (a) `GET /events/{e}/speakers` zweimal im Abstand von mindestens 10 min, dazu nach dem Binden einer Show der Vergleich mit dem Launcher-Cache (`mapper.ts:369` legt die IDs dort ab). Prüfen: Form (UUID, nur Ziffern oder anderes), Leerraum in der ID, keine Doppelten, gleiche Menge. (b) **Stabil beim Bearbeiten:** Nur wenn ein unveröffentlichter Test-Speaker vorhanden ist: seine ID lesen, eine Kleinigkeit bearbeiten (etwa die Funktion), ID erneut lesen, die Änderung zurücknehmen. Ohne Test-Speaker bleibt (b) offen (Risiko 10 in Abschnitt 25). | Release 1 wie beschrieben. Reine Ziffern sind kein Hindernis: Der Rundown sendet immer die `@`-Form (8.3). | Instabil oder doppelt: Der Mapper (SP2) lässt `id` weg. Titler und Rundown arbeiten dann mit Ersatz-Schlüsseln bzw. Namen, die 7.2 und 8.3 schon vorsehen. Das ist eine Zeile im Mapper. Neue ID nur beim Bearbeiten: wie instabil, denn jede Korrektur wäre sonst A2 „nicht mehr in der Liste“ statt „Text aktuell“ (D2). |
| M2 | Meldet iveo Speaker-Änderungen über `updated_at` bzw. `updated_since`? | (a) Am unveröffentlichten Test-Side-Event: Kommt bei `GET /programs?updated_since=⟨t0⟩` ein Programm, nachdem ein Speaker mit ihm verknüpft wurde? (b) Filtert `GET /speakers?updated_since=⟨t⟩`? Erst ein Aufruf mit einem Zeitpunkt in der Zukunft: Kommt eine leere Liste, filtert iveo **irgendwie**. Antwortet iveo mit 400 oder 422, kennt es den Parameter nicht. Dann, nur mit dem Test-Speaker aus M1 (b): `t0` vor dessen Bearbeitung → der bearbeitete Speaker muss kommen, ein unbearbeiteter nicht. Erst das zeigt, dass nach `updated_at` gefiltert wird und nicht nach `created_at`. | (b) filtert nach `updated_at`: Folgeaufgabe FA5, Variante A. Das Ergebnis von (a) steht dabei. | (b) filtert nicht, nur nach `created_at` oder 4xx: Folgeaufgabe FA5, Variante B. Ohne Test-Speaker bleibt offen, wonach gefiltert wird; dann gilt vorsichtig Variante B. |
| M3 | Ist die Reihenfolge der Speaker stabil? | Drei Abrufe von `/speakers` ohne Änderung, Reihenfolge vergleichen. | Reihenfolge der API bleibt | Der Mapper (SP2) sortiert stabil nach Nachname, Vorname, Kennung (`localeCompare` mit `de`). Damit bleiben `TITLER RECALL <nr>`, Weiter und Zurück verlässlich. Die Bauchbinde auf Sendung hängt seit Release 1 ohnehin nicht mehr an der Reihenfolge. |

Release 2 braucht keine weitere Messung vorab. Die Zeiten aus 20 (höchstens 3 s) misst die Abnahme.

### Ergebnisse (05.10.2026)

Nicht gemessen. Der Owner hat am 05.10.2026 entschieden, Release 1 ohne die Messung zu bauen und in der Suite zu testen. Bis zu einer Messung gelten diese sicheren Annahmen:

| # | Annahme | Folge |
| --- | --- | --- |
| M1 | nein (nicht gemessen) | Der Mapper (SP2) lässt `id` weg. Titler und Rundown arbeiten mit Ersatz-Schlüsseln bzw. Namen, wie 7.2 und 8.3 es vorsehen. Doppelte Namen in einer Liste hält die Brücke bewusst nicht (A2/A3 mit Hinweis). |
| M2 | nicht gemessen, darum vorsichtig Variante B | FA5 Variante B, kein Code in Release 1 |
| M3 | ja (angenommen, nicht gemessen) | Keine Sortierung: Die Reihenfolge der API gilt wie bisher. Die Bauchbinde auf Sendung hängt seit Release 1 ohnehin nicht mehr an der Reihenfolge. |

Das Messwerkzeug `packages/iveo/tools/messung-2b.ts` bleibt im Repo. Ergibt eine spätere Messung M1 = ja, schaltet eine Zeile im Mapper die Kennung ein. Ergibt sie M3 = nein, kommt die Sortierung aus der Tabelle oben dazu.

---

## 24 · Nicht in 2b: Folgeaufgaben

| # | Aufgabe | Warum nicht jetzt |
| --- | --- | --- |
| FA1 | **Anmeldung am Timer-Socket `:7777`** (Teil-1-Spec `:728`, `:896`). Stage Display und Presenter müssen dann ein Token senden (`apps/stage-display/src/main/timer-client.ts:32-46`). | Ändert drei Tools. 2b-Daten laufen über den angemeldeten Master-Link, nicht über `:7777`. |
| FA2 | **Dokumente, Medien, Fotos** (`.jmpres` bis 33 MB, Materialien, Speaker-Fotos, eigene Rundown-Datei auf B) | eigener Zyklus (Owner 01.10.2026). Braucht einen Binärkanal. |
| FA3 | **Connect als Speaker-Empfänger** über den Verbund | Connect liest weiter beim Deep-Link. Kein Positionsrisiko (Erkennung über den Namen). |
| FA4 | **„Zuletzt gefunden“ in Q&A und Battle** (`apps/qa/src/main/coupling.ts:99-106`, `apps/battle/src/main/coupling.ts:82`) **und im Rundown-Conductor für alle Rollen außer `launcher`** (`apps/rundown/src/main/conductor.ts:84-88`): Laufen Titler oder Timer auf A und B, trifft ein GO aus dem Rundown auf B das zuletzt gefundene Tool. Vorschlag: `waehleLauncher` zu `waehleEndpunkt(rolle, …)` verallgemeinern, Vorrang für ein Tool auf diesem Rechner. | gleiche Regel wie 17.4, aber außerhalb des Auftrags 2a `:841` und der Owner-Entscheidung vom 02.10.2026 (5). Frage O2. |
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
| 2 | Gemischte Versionen Rundown/Titler oder Listen ohne Kennungen bringen den falschen Speaker auf Sendung. | `recall_kennung` im STATE und `@`-Form mit Namen als Rückfall (8.3, 7.4); ein Abruf ohne Treffer lässt nie den vorherigen Eintrag aktiv (A10/A11). |
| 3 | Bestands-Shows im Agenda-Modus bekommen Speaker-Kennungen spät (5.3). Der Wechsel vom Ersatz-Schlüssel zur Kennung kommt dann mitten im Betrieb. | Ersatz-Schlüssel halten über den Namen; die Brücke (7.3) trägt den Wechsel. Abnahme R1 Schritt 2 prüft genau diesen Wechsel mit einer Person auf Sendung. Doppelte Namen in einer Liste hält die Brücke bewusst nicht (A2/A3 mit Hinweis). |
| 4 | Ein Timer auf B wird zurückgesetzt, wenn der Master eine andere Show öffnet. | gewollt, wie das Öffnen einer Show am Einzelplatz (2a-Spec 12). Steht in den Release-Notes. |
| 5 | Zwei Quellen auf B (lokaler Deep-Link und Master) verwirren. | Vorrang-Regel und Logzeilen (16.1), Anzeige |
| 6 | Rückdruck im echten WLAN ist nicht gemessen. | Stau-Grenze, nur neuester Stand (13.6); Abnahme Schritt 7 |
| 7 | Tools auf B ohne Update verlieren RELOAD vom Master (15.3). | Release-Notes; das RELOAD brachte ihnen ohnehin nur ihre eigene, alte Datei (2a-Spec `:840`). |
| 8 | Der Test-Master im Durchgang 19.7 nutzt Port 8738. Ein laufender Launcher im Master-Modus stört. | Das Skript prüft vorher, dass der Port frei ist, und bricht sonst mit Meldung ab. |
| 9 | Die Uhrzeit „Stand hh:mm“ ist die Empfangszeit auf B, nicht die Zeit der Änderung am Master. | bewusst (16.4); bei abweichenden Uhren wäre die Master-Zeit irreführend |
| 10 | Ohne unveröffentlichten Test-Speaker bleibt offen, ob iveo die Speaker-ID beim Bearbeiten behält (M1 b). | Folge wäre H1/H2 statt „Text aktuell“ bei jeder Korrektur, nie eine falsche Person. Die erste echte Korrektur im Betrieb zeigt es; dann Mapper-Zeile aus M1 „Wenn nein“. |
| 11 | Ein Tool auf B bleibt bei gezogenem Kabel bis zu 25 s grün (Stille-Frist aus Teil 1). | bewusst übernommen (16.4); in dieser Zeit kommen ohnehin keine Änderungen an. Abnahme R2 Schritt 7 nennt es. |

---

## 26 · Vorschlag: zwei Pläne

Die Spec bleibt eine. Ich schlage **je Release einen eigenen Plan** vor:

- **Release 1** ist in sich geschlossen. Es fasst keinen Netz-Code an und wird am Einzelplatz abgenommen. Es behebt einen gemessenen Fehler auf Sendung und soll deshalb schnell raus (D1).
- **Release 2** berührt vier Pakete (`master-link`, `app-runtime`, `show`, Launcher-Verbund) und drei Tools und braucht eine Abnahme an zwei Rechnern. Zum Vergleich: Der Plan von 2a hat 14 598 Zeilen, der von Teil 1 9 305. Ein gemeinsamer Plan käme erst spät zur ersten Prüfung.
- **Abhängigkeit:** Release 2 setzt die Speaker-Kennung und den Titler-Schlüssel aus Release 1 voraus. Der Plan von Release 2 beginnt deshalb erst, wenn Release 1 gemergt ist. Die Messaufgaben (23) gehören an den Anfang des Plans von Release 1.

---

## 27 · Offene Fragen an den Owner

Die Spec nimmt bei jeder Frage eine Vorgabe an, damit der Plan beginnen kann. Eine andere Antwort ändert nur die genannten Abschnitte.

| # | Frage | Vorgabe in dieser Spec | Betrifft |
| --- | --- | --- | --- |
| O1 | **Eigener DataLink-Ordner auf Rechner B.** D4 sagt „folgt immer der Show des Masters“. Soll eine Ordnerwahl auf B die Speaker vom Master anhalten können, bis der Bediener „Zurück zur Show vom Master“ drückt? Das widerspräche „immer“. | Nein. Trägt die Show am Master Speaker, ist die Ordnerwahl auf B gesperrt, mit Text; ohne Speaker ist sie frei (17.2). | 17.2, 19.5 |
| O2 | **Rundown auf B wählt Titler und Timer nach „zuletzt gefunden“.** Laufen sie auf A und B, kann ein GO auf B das Tool an A treffen. Die Entscheidung vom 02.10.2026 (5) verschiebt „zuletzt gefunden“ in Q&A und Battle als Folgeaufgabe. Soll 2b den Rundown-Fall für alle Rollen mitlösen (Vorrang für ein Tool auf diesem Rechner)? | Nein, Folgeaufgabe FA4. Die Abnahme legt die Endpunkte auf B von Hand fest (20 Schritt 1). | 17.4, 20, 24 |
| O3 | **Rechner C ohne Kopplung im selben Netz.** Seine Tools bekamen das RELOAD des Master-Launchers bisher mit (wirksam nur bei gemeinsamem Show-Pfad). „RELOAD an fremde Rechner durch Daten ersetzt“ deckt C nicht, weil C keine Daten bekommt. Ist der Wegfall für C gewollt? | Ja: RELOAD nur an diesen Rechner (15.3); wer Daten braucht, koppelt. Steht in den Release-Notes. | 15.3, 18, 21 |

**Antworten des Owners (02.10.2026):**
- **O1:** **Nein, gesperrt**, wie die Vorgabe. Trägt die Show am Master Speaker, ist die Ordnerwahl im Titler auf B gesperrt (17.2).
- **O2:** nicht gesondert gefragt; die Vorgabe gilt mit der Freigabe der Spec (Folgeaufgabe FA4).
- **O3:** **Ja**, wie die Vorgabe. RELOAD geht nur an diesen Rechner; wer Daten braucht, koppelt (15.3).
- **2a-Abnahme:** im selben Termin wie die Abnahme von Release 1 (Abschnitt 10).
