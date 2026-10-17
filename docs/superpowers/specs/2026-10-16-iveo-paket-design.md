# iveo-Paket: Organisationen in der Bauchbinde, aktuelle Speaker, Production als Standard, Anhänge, Side-Event-Ordner, Connect auf dem Mac

## 0 · Kopf

**Status:** Entwurf. Die Owner-Fragen OF1–OF10 (Abschnitt 17) sind entschieden: Der Owner hat am 17.10.2026 alle Vorgaben mit „passt“ bestätigt. Zu OF1 ist ein Wechsel auf Variante C angeboten und offen; bis zu einer Antwort gilt A, der Plan hängt nicht davon ab. Die Messaufgaben M1 und M5 sind am 17.10.2026 gemessen (12.11). Die Nachbesserung nach der Spec-Prüfung (Befunde B1–B90), der Nachfix nach der Nachprüfung (NP1, NP2) und die Restbefunde der Nachprüfung (NR1–NR9) stehen in Abschnitt 18.
**Datum:** 16.10.2026, nachgebessert 17.10.2026, Owner-Entscheide und Messungen M1/M5 eingetragen 17.10.2026
**Bezug:** #255 (Speaker-Sync; durch den iveo-Patch vom 15.10. behoben, die Speakerliste liefert auf Prod wieder beide Seiten mit HTTP 200), #264 (Anhänge erst nach Reload), #265 (laufende Ablage in Side-Event-Ordnern), #256 (Connect auf dem Mac: „Release-Abfrage fehlgeschlagen: Proxy 404 Not Found“), dazu die Owner-Wünsche im Chat vom 16.10.2026 (Organisationen für Bauchbinden, iveo-Standard-URL im Launcher auf Production). Die Issues sind für diese Spec nicht neu abgerufen worden (kein Netz); ihr Wortlaut stammt aus dem freigegebenen Entwurf.
**Basis:** `main` @ `5e5b234ec3` (Launcher 0.15.0, Titler 0.11.0, Timer 0.14.0, Rundown 0.8.0, Connect 0.3.0; Master-Link 2b R2 released). Worktree `.claude/worktrees/iveo-paket`, Branch `feat/iveo-paket`. Jede Fundstelle ist an diesem Stand gelesen, Pfade relativ zur Repo-Wurzel. Was nicht am Code belegt ist, steht ausdrücklich als **Annahme** da. `origin/main` steht inzwischen bei `934ceefcce` (zwei Doku-Commits: `docs/roadmap.md`, `packages/master-link/ABNAHME-2b.md`; `git diff --stat 5e5b234ec3 origin/main`); Code-Fundstellen sind davon nicht berührt, `docs/roadmap.md:280` steht dort unverändert. Vor dem Plan werden die Zeilen nachgemessen (Lehre „Roadmaps nachmessen“).
**Zielversionen:** Launcher **0.16.0** (CI-Tag), Titler **0.11.1** (lokal gebaut), Connect: Mac-Paket per CI **ohne Versionssprung** an das bestehende Release `connect-v0.3.0` (Nachlauf), Release-Proxy: Deploy mit Owner-Freigabe. Timer, Rundown und der Connect-Code bekommen keine neue Version (E44).
**Grundlagen:** der freigegebene Entwurf vom 16.10.2026 (Owner „passt“ auf beide Abschnitte), die Prod-Messung vom 16.10.2026 (Prüfskript, nur Feldnamen und Anzahlen), die Messungen M1 und M5 vom 17.10.2026 (Prüfskript, nur lesend, nur Formen, Längen und Anzahlen; 8.3, 12.11), die Ist-Karte des Explorer-Agenten (nachgeprüft, Abweichungen in 4.0).
**Ziel in einem Satz:** Die Bauchbinde zeigt die Organisation aus iveo, Speaker-Änderungen kommen spätestens nach fünf Minuten an, die Anhänge der Side Events sind im Launcher immer aktuell und liegen laufend in Ordnern neben der Show, und Connect lässt sich auf dem Mac installieren.

**Titler-Pilot:** Der Branch `feat/ux-titler-pilot` (Titler 0.12.0, Plan `docs/superpowers/plans/2026-10-13-ux-titler-pilot.md` @ `848fc448a6`) läuft parallel. Er wird nach dem Release von Titler 0.11.1 auf diesen Stand nachgezogen (14.3). Laut seinem Plan fasst der Pilot `packages/show/**`, `apps/titler/src/main/iveo-show.ts` und `apps/titler/src/shared/datalink-kern.ts` nicht an (Plan Zeilen 136–141); er ändert aber `apps/titler/test/selftest.ts` (Plan Zeile 348).

### Owner-Entscheidungen (16.10.2026, wörtlich)

| # | Frage | Antwort |
| --- | --- | --- |
| I1 | Organisation in der Bauchbinde | **Hauptorg + alle als Variablen**: `{{organisation}}` = als Hauptorganisation markierte (sonst die erste), `{{organisationen}}` = alle mit „ · “ verbunden. Bestehende Vorlagen bleiben unverändert. |
| I2 | Aktualität der Speaker-Daten (heute nur Binden/Umschalten/Programmänderung) | **Alle 5 Minuten neu**: Live-Abgleich holt die Speakerliste zusätzlich alle 5 Minuten; geschrieben und gemeldet nur bei echter Änderung. |
| I3 | Side-Event-Ordner (#265) | **Neben der Show-Datei**: je Side Event ein Ordner (Name = Titel), der Launcher am Master lädt neue/geänderte Anhänge selbst, von iveo gelöschte Anhänge wandern in „entfernt“ statt gelöscht zu werden. |
| I4 | Connect auf dem Mac (#256) | **Connect auch für Mac bauen**: CI baut für Connect-Releases zusätzlich das Mac-Paket (ohne Zoom; Gäste und Cloud-Raum laufen); Windows bleibt lokal gebaut; Launcher zeigt bei fehlenden Paketen den echten Grund; Proxy nimmt das neueste Release mit passendem Paket. |
| I5 | Standard-URL | **Production** `https://app.my-iveo.de/api/v1` im Launcher (Staging veraltet). |

### 0.1 Ergänzungen gegenüber dem freigegebenen Entwurf (bitte bewusst prüfen)

Beim Ausarbeiten zeigte der Code Stellen, die der Entwurf nicht abdeckt. Nur dort ergänzt diese Spec; die Liste ist nach der Spec-Prüfung (Abschnitt 18) vervollständigt worden. Die Punkte mit Owner-Frage (Nr. 1, 2, 5, 9, 10, 16) sind mit OF1–OF10 am 17.10.2026 entschieden (Vorgaben bestätigt, 17). Zwei Punkte sind keine Ergänzung, sondern Umsetzung des Entwurfs: 6.5 („fällt die Liste aus, bleibt das heutige Verhalten … Statuszeile sagt es“; dafür braucht es den Merker auch beim ersten Fehlschlag) und 9.11 („Ohne gespeicherte Show-Datei kein Ordner, und das Panel sagt es“; der Launcher öffnet Shows nur aus Dateien).

| # | Entwurf | Jetzt | Warum |
| --- | --- | --- | --- |
| 1 | Connect-Mac „ohne Zoom; Gäste und Cloud-Raum laufen“ | Das Mac-Paket aus der CI hat **auch kein NDI**. Gäste kommen in den Raum, erscheinen aber nicht als NDI-Quelle und sehen und hören das Programm nicht (der Programm-Rückkanal kommt per NDI-Empfang). Vorgabe und Alternativen in **OF1**; der Owner hat die Vorgabe A am 17.10.2026 bestätigt, ein Wechsel auf Variante C ist angeboten und offen. | `apps/connect/tools/bundle-ndi.mjs:18-21` überspringt alles außer Windows; der NDI-Lader wirft ohne Addon (`packages/ndi/index.js:58-70`); jeder Gast-Sender und der Programm-Empfänger importieren `@jm/ndi` (`apps/connect/src/utility/ndi-guest-sender.ts:11`, `apps/connect/src/utility/ndi-program-receiver.ts:21`). |
| 2 | „Speakerliste zusätzlich alle 5 Minuten (Liste und Agenda)“ | Im Agenda-Modus holt die Auffrischung auch das Programm-Detail (Verknüpfung) und frischt die Namen für „Verantwortlich“ auf. Aus dem frischen Detail kommen dabei auch **Startzeit-Anker und Kategorie** des Side Events; geschrieben wird nur bei echter Abweichung. Ohne Verknüpfung gilt die ganze Event-Liste (**OF2**). | Die Verknüpfung steht auf Prod im Programm-Detail (`speakers[] {speaker_id, role_on_program, sort_order}`, Messdatei); ohne neues Detail käme ein neu verknüpfter Speaker nie an. Startzeit und Kategorie kommen heute schon beim Öffnen, Umschalten und bei leerer Agenda frisch (`apps/launcher/src/main/iveo-abgleich-kern.ts:806-813`, `:833-834`); ein Kontext aus zwei Detail-Ständen wäre schlechter (6.3). |
| 3 | „alle 5 Minuten“ | Fällig, sobald seit dem letzten gelungenen Abruf 5 Minuten weniger ein Abfragetakt vergangen sind (255 s). So liegen zwischen Änderung und Show bei regelmäßigem Takt höchstens 5 Minuten. | Der Takt ist 45 s (`apps/launcher/src/main/iveo-sync.ts:91-92`). Mit „≥ 300 s“ wären es bis zu 5:45. |
| 4 | Standard-URL | Das Binden schreibt die genutzte Adresse in die Bindung; der Show-Editor zeigt beim Bearbeiten einer Show deren gespeicherte Adresse; die Einstellungen zeigen eine eingetragene Adresse beim Öffnen an und darunter die Zeile T9 („Standard für neue Bindungen …“). | Ohne Adresse in der Bindung zeigt eine Show nach jedem Standardwechsel woandershin. Das Einstellungsfeld startet heute immer leer (7.2), ein „Speichern“ löscht dann die eingetragene Adresse. Das Editorfeld startet beim Bearbeiten leer (`apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:298`, `:326`), ein Neubinden nähme sonst die wirksame statt der gespeicherten Adresse (7.4). |
| 5 | Ordner „‹Showname› – Side Events“ | ‹Showname› = Dateiname der Show ohne `.jmshow` (**OF3**). Unterordner erst beim ersten Anhang (**OF4**). | Der Dateiname ist am Speicherort eindeutig und entsteht aus dem Showname (`apps/launcher/src/main/show.ts:108-111`). Leere Ordner für jedes Programm des Tages wären Rauschen. |
| 6 | Anhänge nachladen | Die Zahl am 📎 steht nur noch an beobachteten Listen. Texte heißen „Anhänge“ statt „Materialien“, auch in den Logzeilen. Unter einer aufgeklappten Liste steht „Stand ‹hh:mm›“ (Zeit der letzten gelungenen Prüfung). | Eine Zahl an einer nicht beobachteten Liste kann veraltet sein; die Owner-Sprache ist „Anhänge“. |
| 7 | Proxy nimmt das neueste Release mit passendem Paket | Dieselbe Regel gilt in der GitHub-Quelle des Launchers. Auf dem Mac wird die Architektur streng geprüft: ein x64-Launcher bekommt nie ein arm64-Paket. | Heute nimmt der Proxy notfalls irgendein DMG (`services/release-proxy/worker.js:313-316`), auf einem Intel-Mac also ein nicht lauffähiges. |
| 8 | CI baut Connect-Mac | Eigener Workflow `connect-mac.yml`; `suite-release.yml` bleibt unverändert; der Katalog-Bump für Connect bleibt lokal. | Der Bump soll erst kommen, wenn auch das lokal gebaute Windows-Paket am Release hängt. |
| 9 | „je Side Event ein Ordner“ | Abgelegt werden die Side Events **der Show-Bindung** (Liste in der Show-Datei), begrenzt auf **den Tag der Bindung bzw. des aktiven Side Events**, dazu das aktive Side Event (**OF7**). Side Events, die das Panel an einem anderen Tag zeigt, bekommen keinen Ordner; Side Events der Ablage, die das Panel nicht zeigt, stehen in einem eigenen Block „Weitere Side Events der Ablage“ (9.13). | Der Entwurf nennt keine Menge. Ohne Grenze wären es auf Prod bis zu 67 Programme über alle Tage (Messdatei „Programme (Seite 1): HTTP 200, 67“): Im Agenda-Modus speichert der Show-Editor als Filter nur `{programId}` (`ShowEditorModal.tsx:231-232`), und der Kern bildet die Liste beim nächsten Zusatzabruf mit diesem Filter, also ohne Tagesgrenze (`iveo-abgleich-kern.ts:454`, `apps/launcher/src/main/iveo-side-events.ts:29-36`). |
| 10 | – | **Schalter** „Anhänge in Side-Event-Ordnern ablegen“ je Rechner (Standard an) und eine **Kopfzeile** im Panel mit „Ordner öffnen“ für den Basisordner (**OF8**). | Der Entwurf kennt beides nicht. Ein Not-Aus für langsame Netze am Veranstaltungsort ist eine Vorgabe dieser Spec, kein Entwurfszitat. |
| 11 | Diagnosen | Zusätzlich sichtbar: Zahl der Speaker mit Organisation nach „Ablauf übernehmen“ (E8, T1); Merker „Speaker-Verknüpfung veraltet“ (6.3, T50) und „Organisationen fehlen“ (5.10, T51) in der Statuszeile, im zweiten Fall bleiben die Organisationen der Datei stehen; Logzeile T2 bei jedem unveränderten Auffrischen. | Owner-Regel „Jede Diagnose wird angezeigt“. T2 ist eine Logzeile (rund 13 je Stunde), kein RELOAD, keine Notice, keine Statusänderung; „gemeldet“ in I2 meint die Tools (6.2). |
| 12 | „alle“ Organisationen (I1) | Jeder Name höchstens 200 Codepunkte, höchstens 20 Namen je Speaker (E4). | Schutz vor kaputten Daten. Auf Prod greift die Grenze nicht: 173 Einträge bei 157 Speakern, 14 mit mehreren (Messdatei), also höchstens 17 je Speaker. |
| 13 | – | Textkosmetik in bestehenden Meldungen: „Gespeichert & geöffnet“ → „Gespeichert und geöffnet“ (T20), „Material“ → „Anhang“ in Logzeilen (11.6), Proxy-Fehler mit Klartext (10.4). | Owner-Sprache und typografische Anführungszeichen. |
| 14 | – | CI: neuer Schritt „Release-Proxy“ im Job `selftests` von `.github/workflows/ci-checks.yml` (der Workflow schützt `main`); das Skript `selftest:iveo` des Launchers wird um die neuen Testdateien verlängert (12.9). | Der Proxy-Selbsttest läuft heute nicht in der CI (4.6 Nr. 10). |
| 15 | „lädt neue und geänderte Datei-Anhänge“ | Eine geänderte Datei erkennt der Launcher an MIME-Typ, Größe und dem SHA-256 der Asset-Referenz (`asset.url`, gemessen in M1 am 17.10.2026: stabil, ohne Zeitangabe, 8.3). Ob eine ersetzte Datei gleicher Größe eine neue Referenz bekommt, misst M4 in der Abnahme; bis dahin kann sie unerkannt bleiben (Risiko 3). | iveo liefert keine Prüfsumme; ob sich die Referenz, die Anhang-Kennung oder `updated_at` des Agenda-Punkts beim Ersetzen ändern, ist nicht gemessen (M4). |
| 16 | Ablage | Schutzregeln, die der Entwurf nicht nennt: Sperrliste für ausführbare Endungen und Steuer-/Bidi-Zeichen in Namen (9.12), Links nur als normalisierte Adresse ohne Steuerzeichen (9.7, auch beim Öffnen im Panel, 8.6), das iveo-Token nur an die Herkunft der Basis-URL, eine Datei-Adresse auf einem anderen Server nur über `https:` und ohne Token (E52, 9.6, in Ordner und Panel; heute geht das Token an jede absolute `asset.url`, `packages/iveo/src/client.ts:351`, `:364-366`), dieselben Namensregeln samt Sperrliste beim Speichern im Panel und dort kein automatisches Öffnen einer Datei mit gesperrter Endung (8.6, heute öffnet der Launcher jede gespeicherte Datei sofort, `apps/launcher/src/main/iveo-sync.ts:697`), eine **Sperrdatei** gegen zwei Rechner im selben Ordner (9.2, **OF10**; der Entwurf sagt „der Launcher mit Token lädt“, mit Sperre lädt von zwei Rechnern mit Token nur einer; eigen ist eine Sperre mit dem eigenen Rechnernamen, auch nach einem Neustart), Rückhaltung bei wiederholt scheiternden Downloads, auch beim aktiven Side Event (9.6, **OF5**). Eine Herkunftsmarkierung bekommen abgelegte Dateien nicht (**OF9**, Vorgabe vom Owner am 17.10.2026 bestätigt). | Die Anhänge kommen von Dritten und werden ohne Klick abgelegt; ein Bediener-Doppelklick soll keine fremde Programmdatei starten. |

---

## 1 · Ziele und Nicht-Ziele

**Ziele:**
- **Z1** Eine Bauchbinde kann die Organisation des Speakers zeigen: `{{organisation}}` und `{{organisationen}}` (I1).
- **Z2** Speaker-Änderungen in iveo erreichen die Show in beiden Abgleich-Arten spätestens nach 5 Minuten; geschrieben und gemeldet wird nur bei echter Änderung (I2).
- **Z3** Ohne eingetragene Adresse spricht der Launcher mit iveo Production (I5).
- **Z4** Die Anhang-Liste eines Side Events ist bei jedem Aufklappen frisch, lädt sich nach, solange sie offen ist, und bietet in iveo gelöschte Anhänge nicht mehr an (#264).
- **Z5** Der Launcher mit Token legt die Anhänge der Side Events laufend in Ordnern neben der Show ab; nichts wird gelöscht (I3, #265).
- **Z6** Connect lässt sich auf dem Mac über den Launcher installieren; fehlt ein Paket, nennt der Launcher den Grund; der Proxy nimmt das neueste Release mit passendem Paket (I4, #256).

**Nicht-Ziele:**
- Keine Rollen (`role_at_organisation`), Kennungen, Logos oder Beschreibungen der Organisationen in Show, Titler oder Cache. Keine Auflösung über `/organisations`.
- Keine Vorschau der Anhänge im Launcher. Kein Öffnen der Ordner-Dateien durch Tools.
- Keine Ordner und keine Anhänge auf Verbund-Rechnern ohne Token (Rolle „Mit Master verbinden“); kein Binärkanal über den Master-Link (2b-Spec FA2).
- Keine Änderung an der Bedienlogik der Tools: Abruf, Recall, Companion-Befehle, PSD-Import, Datenquellen des Titlers, Rundown-Picker, Connect bleiben, wie sie sind.
- Kein NDI für Connect auf dem Mac in diesem Paket (OF1: Vorgabe A vom Owner am 17.10.2026 bestätigt; ein Wechsel auf Variante C, einen lokalen Mac-Bau von Connect mit NDI, ist angeboten und offen; der Plan setzt A um und hängt nicht davon ab).
- Keine Speaker-Kennungen (2b-Spec 23: M1 = nein gilt weiter). Kein `updated_since` für `/speakers` (2b-Spec FA5 Variante A bleibt Folgepunkt).
- Keine Signierung oder Notarisierung der Mac-Pakete.
- Kein Umzug gespeicherter Tokens zwischen Staging und Production.

---

## 2 · Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Organisationen eines Speakers** | Feld `ShowIveoSpeaker.organisationen`: Namen der Organisationen aus iveo, Hauptorganisation zuerst (5.3). |
| **Hauptorganisation** | Die erste Organisation mit `is_primary === true`, sonst die erste gültige (5.2). |
| **Auffrischen** | Zusätzlicher Abruf der Speakerliste im Live-Abgleich, unabhängig von Programmänderungen (6). |
| **fällig** | Das Auffrischen steht an: seit dem letzten gelungenen Abruf der Speakerliste sind mindestens 255 s vergangen (6.1). |
| **Merker „Speaker veraltet“** | Feld `iveo.speakerVeraltetSeit` der Show aus 2b (2b-Spec 6.2), unverändert. |
| **Anhang** | Ein Eintrag aus `materials[]` eines Agenda-Punkts: Datei (`kind: 'file'`) oder Link (`kind: 'link'`). Im Code heißt er weiter `IveoMaterial`. |
| **Anhang-Liste** | Die aufklappbare Liste unter einem Side Event im Side-Events-Panel des Launchers. |
| **Materialsignatur** | Vergleichswert der Anhänge eines Side Events (8.3). |
| **Asset-Referenz** | Der Wert von `materials[].asset.url`. Auf Prod keine Adresse, sondern eine nackte signierte Referenz (M1, 8.3); der Client macht daraus `‹Basis-URL›/assets/‹Referenz›`. Gespeichert wird nur ihr SHA-256, nie sie selbst. |
| **Anhang-Wächter** | Teil der Launcher-Hülle, der im 45-s-Takt die beobachteten Anhang-Listen prüft (8.2). |
| **beobachtet** | Eine Anhang-Liste ist beobachtet, wenn sie im Panel aufgeklappt ist oder zum aktiven Side Event gehört. |
| **Basisordner** | `‹Dateiname der Show› – Side Events` neben der `.jmshow` (9.1). |
| **Side-Event-Ordner** | Unterordner des Basisordners für genau ein Side Event (9.1). |
| **Indexdatei** | `.jm-anhaenge.json` in jedem Side-Event-Ordner (9.8). |
| **entfernt/** | Unterordner eines Side-Event-Ordners für Dateien, die iveo entfernt hat oder die eine neue Fassung ersetzt hat (9.10). |
| **Ablage-Menge** | Die Side Events, die einen Ordner bekommen: Liste der Bindung, begrenzt auf den Ablage-Tag, dazu das aktive (9.3, OF7). |
| **Runde** | Ein Abgleich aller Side Events der Ablage-Menge mit ihren Ordnern, nacheinander (9.4). |
| **Sitzung** | Die Zeit seit dem Öffnen einer Show in diesem Launcher-Prozess bis zum Schließen oder Wechsel der Show. |
| **Sperrdatei** | `.jm-ablage-sperre.json` im Basisordner: welcher Rechner (Rechnername aus `os.hostname()`) die Ablage gerade pflegt (9.2). |
| **eigene Sperre** | Eine Sperrdatei mit der `sitzung` dieser Sitzung oder, solange diese Sitzung sie noch nicht gehalten hat, mit dem Rechnernamen dieses Rechners (Rest aus einer früheren Sitzung: Neustart, Update, Absturz, Show neu geöffnet; 9.2). |
| **fremde Sperre** | Eine Sperrdatei mit einem anderen Rechnernamen; sie hält diesen Rechner von der Ablage ab, solange ihr Lebenszeichen jünger als 15 Minuten ist (9.2 Regeln 5, 6). |
| **Verbund-Slave** | Ein Launcher mit der Rolle „Mit Master verbinden“ (`rolle === 'slave'`, `apps/launcher/src/main/verbund/kern.ts:155`, `:467`). |
| **Nachlauf** | Nachträglicher CI-Bau des Mac-Pakets für ein schon bestehendes Connect-Release (10.3). |
| **passendes Paket** | Ein Release-Asset, das zur Plattform und Architektur des Rechners passt (10.5). |

---

## 3 · Entscheidungen

| # | Entscheidung | Begründung | Abschnitt |
| --- | --- | --- | --- |
| E1 | `ShowIveoSpeaker` bekommt `organisationen?: string[]`, nur Namen. Feldreihenfolge `id`, `name`, `title`, `organisationen`. | I1; Datensparsamkeit wie `ShowIveoSpeaker` heute (`packages/show/src/index.ts:61-64`). Deutscher Feldname wie `speakerVeraltetSeit`. | 5.3 |
| E2 | Eine Regel für Mapper und Normalisierer: `normalisiereOrganisationen` in `@jm/show`. | Die Mapper-Ausgabe muss ein Fixpunkt des Normalisierers sein (Test `packages/iveo/test/selftest.ts:368`), sonst wiche die Signatur nach jedem Abruf ab. Vorbild: `loeseDoppelteKennungenAuf` (`packages/show/src/index.ts:201-217`). | 5.2, 5.3 |
| E3 | Hauptorganisation = erste mit `is_primary === true`, sonst die erste gültige; sie steht vorn. | I1 wörtlich; `is_primary` ist auf Prod immer gesetzt (173 von 173). | 5.2 |
| E4 | Doppelte fallen nach Trimmen und Zusammenfassen von Leerraum weg, Groß- und Kleinschreibung zählt. Jeder Name höchstens 200 Codepunkte (gekürzt), höchstens 20 Namen je Speaker. | Vorhersehbar ohne Annahmen über Schreibweisen. Auf Prod gibt es 173 Einträge bei 157 Speakern, mehr als 17 je Speaker sind also ausgeschlossen. | 5.2 |
| E5 | Die Signatur (`ablaufSignatur`) nimmt die Organisationen auf. Jede Bestands-Show mit Organisationen in iveo wird einmal neu geschrieben, Timer, Titler und Rundown laden einmal neu. | Sonst erreichte eine Organisations-Änderung die Show nie (I2: „geschrieben und gemeldet nur bei echter Änderung“). | 5.5 |
| E6 | `speakers.tsv` bekommt die Spalten `organisation` und `organisationen` vor `@kennung`. | I1; `@kennung` bleibt bewusst letzte Spalte (`apps/titler/src/main/iveo-show.ts:41`). | 5.6 |
| E7 | Cache-Metadaten (`buildShowMetadata`) und Connect bleiben ohne Organisationen. | Beide brauchen sie nicht (`apps/launcher/src/main/iveo-sync.ts:547-586` liest aus dem Cache nur Programme; Connect erkennt Gäste über den Namen). | 5.4 |
| E8 | Die Meldung nach „Ablauf übernehmen“ nennt, wie viele Speaker eine Organisation haben. | Diagnose sichtbar: Man sieht beim Binden, ob iveo Organisationen liefert. | 5.9 |
| E9 | Auffrischen: fällig nach 255 s seit dem letzten gelungenen Abruf der Speakerliste; Startwert ist das Öffnen der Show; der Zeitpunkt wird **vor** dem Abruf genommen und rückt erst nach Schreiben oder gleicher Signatur vor. | Garantiert bei regelmäßigem Takt höchstens 5 min (0.1 Nr. 3), auch wenn ein Abruf länger dauert. Ein gescheitertes Schreiben wird im nächsten Takt wiederholt, nicht erst nach 5 min. | 6.1 |
| E10 | Listen-Modus: fällig erzwingt den Snapshot, wie heute der Merker. | Der Snapshot ist der einzige Weg, der Ablauf, „Verantwortlich“ und Speaker gemeinsam baut (`apps/launcher/src/main/iveo-abgleich-kern.ts:544-550`). | 6.2 |
| E11 | Agenda-Modus: fällig holt Speakerliste und Programm-Detail; der Merker „Speaker veraltet“ allein holt wie heute nur die Liste. Es gelten die verknüpften Speaker, ohne Verknüpfung die ganze Event-Liste (OF2); die Namen für „Verantwortlich“ kommen aus der frischen Liste; Startzeit-Anker und Kategorie kommen aus dem frischen Detail (0.1 Nr. 2). | Gleiche Regel wie heute mit Merker (`iveo-abgleich-kern.ts:856-860`) und wie beim Binden (`iveo-sync.ts:184-185`). Der Kontext stammt so immer aus einem Detail-Stand. | 6.3 |
| E12 | Scheitert das Auffrischen, gilt das heutige Fehlerverhalten: Speaker aus der Datei, Merker gesetzt (einmal schreiben, RELOAD), Statuszeile sagt es, jede weitere Abfrage holt die Liste. Scheitert nur das Detail, setzt der Kern den Merker „Speaker-Verknüpfung veraltet“ im Speicher; die Statuszeile sagt es, jede weitere Abfrage holt das Detail. | Entwurf: „fällt die Liste aus, bleibt das heutige Verhalten“; Owner-Regel „Jede Diagnose wird angezeigt“. Vorbild für den Merker im Speicher: `seListeVeraltetSeit` (`iveo-abgleich-kern.ts:845-847`, `:428-431`). | 6.3, 6.5 |
| E13 | Die Antwort beim Umschalten auf ein Side Event ohne Verknüpfung sagt, was bei der nächsten Auffrischung passiert. | Heute steht dort „bestehende Speakerliste bleibt“ (`iveo-abgleich-kern.ts:951`); mit E11 wäre das bei der nächsten Auffrischung falsch. „spätestens“ verspricht die Antwort nicht: Scheitert die Agenda, kommt keine Auffrischung (6.4). | 6.4 |
| E14 | Die Standard-URL ändert sich an einer Stelle: `IVEO_DEFAULT_BASE_URL` in `@jm/iveo`. | Der Launcher nutzt sie über `resolveIveoBaseUrl` (`apps/launcher/src/main/settings.ts:174-176`). | 7.1 |
| E15 | Eine eingetragene Adresse gilt weiter. Das Einstellungsfeld zeigt sie beim Öffnen an. | I5; heute startet das Feld immer leer und ein Speichern löscht die Adresse (7.2). | 7.2 |
| E16 | Das Binden schreibt die tatsächlich genutzte Adresse in die Bindung. Beim Bearbeiten einer bestehenden Show füllt der Show-Editor das Feld „Basis-URL“ mit der gespeicherten Adresse der Show. | Sonst zeigt eine Show ohne Adresse nach dem nächsten Standardwechsel still auf einen anderen Server, und ein Neubinden beim Bearbeiten machte eine eingetragene Adresse still rückgängig (`ShowEditorModal.tsx:298`, `:326`, `:208`). | 7.4 |
| E17 | Kein Umzug von Tokens; Schlüssel `base:‹URL›` bleiben, wie sie sind. | Staging-Tokens schaden nicht; ein Umzug wäre falsch (anderer Server, anderes Token). | 7.5 |
| E18 | Renderer ohne Dauer-Cache: jedes Aufklappen lädt frisch; Schließen des Panels und Show-Wechsel leeren die Listen **und klappen sie zu** (der Aufklapp-Zustand liegt im Store); beim Öffnen des Panels sendet der Main den Stand des aktiven Side Events neu; die Zahl am 📎 steht nur an beobachteten Listen. Die Entscheidungen liegen in einem reinen Helfer mit Test. | Ursache von #264 (`apps/launcher/src/renderer/src/components/SideEventsPanel.tsx:66`); der Aufklapp-Zustand überlebt heute das Schließen (`SideEventsPanel.tsx:39`, `:41`; Panel immer eingehängt, `apps/launcher/src/renderer/src/App.tsx:74`). | 8.1 |
| E19 | Anhang-Wächter in der Hülle beobachtet die aufgeklappte Liste und das aktive Side Event; die Agenda des aktiven Side Events kommt ohne Zusatzabruf aus dem Kern, gemeldet **direkt nach** ihrem Abruf. | Der Kern holt sie im Agenda-Modus ohnehin jeden Takt (`iveo-abgleich-kern.ts:799`); eine Meldung erst am Ende ginge verloren, wenn ein späterer Abruf derselben Abfrage wirft (`:809`, `:812`, `:833`). | 8.2 |
| E20 | Die Materialsignatur und die Inhaltssignatur des Ordners enthalten `asset.url` nie selbst, sondern ihren SHA-256 (seit M1, 17.10.2026; vorher ohne die Referenz). | Die Referenz ist signiert (`packages/iveo/src/client.ts:342-346`) und darf nie gespeichert oder ausgegeben werden. M1 hat sie auf Prod als nackte signierte Referenz ohne Zeitangabe gemessen, nach 10,5 min bei allen 4 Anhängen gleich (8.3); ihr Hash erkennt also eine neue Referenz, ohne bei jedem Abruf auszuschlagen. Ein Test sucht nach allen Ordner-Fällen in jeder geschriebenen Datei, Logzeile und jedem Ereignis nach Referenz, Adresse und Token (12.4 Nr. 41). | 8.3 |
| E21 | Das Ereignis an den Renderer kommt nach jeder gelungenen Prüfung (mit Zeit, die Liste nur bei Änderung), beim Wechsel zwischen gelungen und gescheitert in beide Richtungen und bei jedem neuen Fehlertext. | Kein zweiter Abruf im Renderer; „Stand ‹hh:mm›“ zeigt die letzte gelungene Prüfung, auch bei unveränderter Liste. | 8.4 |
| E22 | `purged_at` gesetzt = gelöscht: nicht angeboten, nicht ladbar, im Ordner nach `entfernt/`. „Gesetzt“ = jeder Wert außer `null`, fehlend, `false` und Leerstring (**Annahme**, Typ unbekannt). | Entwurf; das Feld ist auf Prod vorhanden, aber nie gesetzt (Messdatei: `purged_at` Typ `null`, 0-mal gesetzt). | 8.5 |
| E23 | Nutzertexte und Logzeilen sagen „Anhänge“ statt „Materialien“. | Owner-Sprache, Statuszeile „Anhänge: 3 im Ordner“ aus dem Entwurf. | 11.6 |
| E24 | Basisordner `‹Dateiname der Show ohne .jmshow› – Side Events` neben der Show (OF3). | 0.1 Nr. 5. | 9.1 |
| E25 | Ein Side-Event-Ordner entsteht erst beim ersten Anhang (OF4). | 0.1 Nr. 5. | 9.1 |
| E26 | Nur ein Launcher mit Token für die Show und ohne Rolle „Mit Master verbinden“ legt ab, und nur, wenn kein anderer Rechner (anderer Rechnername) die Sperrdatei hält und kein zweiter Launcher gleichen Rechnernamens sie dieser Sitzung abgenommen hat (9.2). Dazu ein Schalter je Rechner, Standard an (Vorgabe dieser Spec, **OF8**). | Entwurf: „Der Launcher mit Token (Master oder Einzelplatz) lädt …“; Slaves haben kein Token für die Ablage (Nicht-Ziel). Der Schalter steht nicht im Entwurf (0.1 Nr. 10). | 9.2, 9.14 |
| E27 | Abgeglichen wird die Ablage-Menge: die Side Events der Bindung (`show.iveo.sideEvents` der Datei), begrenzt auf den Ablage-Tag, und das aktive Side Event (Vorgabe, **OF7**). | Der Entwurf nennt keine Menge (0.1 Nr. 9); I3 sagt „je Side Event ein Ordner“. Die Grenze hält die Last und die Zahl der Ordner beim Tag der Show; das aktive kann außerhalb der Liste liegen. | 9.3 |
| E28 | Aktives Side Event in jedem Takt (Agenda aus dem Kern), alle anderen in einer Runde nach der Regel aus E9; innerhalb des Ordner-Teils alles nacheinander, je Side Event höchstens ein Eintrag in der Warteschlange, das aktive vorn. Neben dem Ordner-Teil laufen aus dem Takt nur dessen Abrufe (Kern und Anhang-Wächter, nacheinander); aus Takt und Ablage also höchstens zwei Abrufe gegen iveo gleichzeitig. Bedienaktionen kommen dazu: Umschalten, Aufklappen einer Anhang-Liste, manueller Download. | Entwurf („nacheinander“); ein Download darf den 45-s-Takt des Kerns nicht anhalten. Ein Umschalten wartet nie auf eine Abfrage (`iveo-abgleich-kern.ts:1096`); Aufklappen und manueller Download rufen iveo direkt (`iveo-sync.ts:629-660`, `:663-704`). | 9.4 |
| E29 | Download in eine Zwischendatei im Zielordner, dann Umbenennen ohne Überschreiben. Leerlauf-Grenze 60 s, keine Gesamtgrenze, höchstens `min(size_bytes, 2 GiB)` Bytes je Datei (auch während des Ladens), freier Platz mindestens Größe + 1 GiB, Bytezahl geprüft, jeder Fehler löscht die Zwischendatei, Abbruch bei Show-, Rollen- oder Schalterwechsel. Wiederholt scheiternde Downloads werden zurückgehalten (doppelt so lange je Fehlschlag, höchstens 10 min), sichtbar in der Zeile. Grenzen und Rückhaltung sind Vorgaben (**OF5**). | Nie eine halbe Datei unter dem echten Namen; große Präsentationen dürfen lange laden, hängende nicht ewig; ein stockender Download soll nicht alle 45 s das Netz vor Ort belasten. | 9.6 |
| E30 | Eine neue Fassung ersetzt die alte; die alte wandert nach `entfernt/` mit Zusatz „(ersetzt ‹Datum Zeit›)“. Ist die alte Datei geöffnet, wartet die neue als `.‹Kennung›.‹pid›.jm-neu` auf die nächste Runde. | „Nichts wird gelöscht“; Windows sperrt geöffnete Dateien. | 9.6, 9.10 |
| E31 | Links werden `.url`-Dateien, nur `http` und `https`, nur die normalisierte Adresse (`new URL(roh).href`), Rohtext mit Steuerzeichen abgelehnt; eine geänderte Adresse schreibt eine neue `.url`, die alte wandert nach `entfernt/`. | Entwurf („Links als .url“, „nichts wird gelöscht“); der WHATWG-Parser entfernt Tab, CR und LF still, der Rohtext könnte sonst Zeilen in die `.url` schmuggeln (gemessen, 9.7). | 9.7 |
| E32 | Indexdatei je Side-Event-Ordner (Format 1); Ordner werden über ihren Index wiedergefunden, ohne lesbaren Index über den erwarteten Namen; ein beschädigter oder unplausibler Index wird beiseitegelegt und durch Übernahme neu aufgebaut; ein neueres Format wird nicht angefasst. | Entwurf; robust gegen Umbenennen, Verschieben und Löschen der Datei. | 9.1, 9.8 |
| E33 | Fremde Dateien im Ordner werden nie angefasst; eine vom Bediener gelöschte Datei wird neu geladen; eine vom Bediener geänderte bleibt, bis iveo eine neue Fassung liefert, dann wandert sie nach `entfernt/`. Kein Schritt überschreibt eine bestehende Datei. | Laufende Ablage ohne Datenverlust; `rename` überschreibt unter Windows und macOS still (gemessen, 9.6). | 9.9 |
| E34 | Feste Namensregeln für Windows und macOS (9.12), für jeden erzeugten Pfad (auch `entfernt/`, Zusätze, Zwischendateien), mit Sperrliste für ausführbare Endungen. | Pfad-Traversal, reservierte Namen, Längen, Steuer- und Bidi-Zeichen, Endungen aus fremden Labels. | 9.12 |
| E35 | „Ordner öffnen“ geht über die `programId`; der Renderer übergibt nie Pfade. | Kein Pfad aus dem Renderer in `shell.openPath`. | 9.15 |
| E36 | Connect-Mac in einem eigenen Workflow `.github/workflows/connect-mac.yml` (Tag-Push `connect-v*` und Hand-Start mit Tag). `suite-release.yml` bleibt unverändert. | Kein Risiko für die übrigen CI-Releases; `suite-release.yml:35` schließt `connect-v` weiter aus. | 10.1 |
| E37 | Kein Katalog-Bump für Connect in der CI; der Bump bleibt lokal, nach dem Windows-Paket. | Der Katalog soll erst eine Version nennen, wenn beide Pakete am Release hängen. | 10.1 |
| E38 | Nachlauf 0.3.0 = Hand-Start des Workflows mit `connect-v0.3.0`; er lädt nur DMGs an das bestehende Release und legt keins an. | Ohne Versionssprung; die Connect-Quellen sind seit dem Tag unverändert (4.6 Nr. 8). | 10.3 |
| E39 | Der Workflow prüft nach dem Packen mit einem Node-Skript, das einen eigenen Selbsttest mit Gegenprobe hat: zwei DMGs (arm64, x64), keine Zoom-Bridge, keine Zoom-SDK-Datei, kein NDI-Addon (Vorgabe OF1). | Die Katalogaussage wird prüfbar statt behauptet; der Prüfschritt läuft sonst erstmals am echten Release. | 10.2 |
| E40 | Der Launcher zeigt den Fehlertext des Proxys; Auswahl, Auswertung der Proxy-Antwort, Fehlertexte und `compareVersions` liegen als reine Helfer in `apps/launcher/src/main/release-wahl.ts`; die Electron-Module rufen nur noch diese Helfer. | I4; heute geht der Text verloren (`apps/launcher/src/main/release-source.ts:181`). `release-source.ts` lädt über `./settings` Electron (`:2`, `settings.ts:1`) und ist deshalb nicht im Selbsttest prüfbar. | 10.4 |
| E41 | Proxy und GitHub-Quelle nehmen das neueste Release mit passendem Paket; Mac-Architektur streng nach der Architektur des Launcher-Prozesses (x64 nie arm64, arm64 notfalls x64). | I4; 0.1 Nr. 7. Die Architektur kommt aus `process.arch` (`release-source.ts:31-33`); ein x64-Launcher unter Rosetta zählt als x64 (FP12). | 10.5 |
| E42 | Katalog-Beschreibung von Connect sagt, was auf dem Mac fehlt, auch dass Gäste dort das Programm nicht sehen und hören. | `packages/suite-manifest/suite.json:471` verspricht heute „Windows + macOS (nutzt die NDI-Runtime)“ und „jeder Gast sieht das Programm“. | 10.6 |
| E43 | Proxy-Deploy nur mit Owner-Freigabe, nach Vorprüfung mit Trockenlauf: alte und neue Wahl für jedes Katalog-Tool auf Windows, Mac arm64 und Mac x64 gegenübergestellt. Deploy außerhalb laufender Connect-Sitzungen. | Der Proxy bedient alle Tools; welche Releases die neue Regel betrifft, ist sonst nicht gemessen (10.5). | 10.7 |
| E44 | Releases: Launcher 0.16.0, Titler 0.11.1. Timer, Rundown, Connect ohne neue Version. Die Versionen stehen vor dem Merge in `package.json` und `package-lock.json` (Release-Commit auf dem Branch). | Nur Launcher (schreibt Shows) und Titler (liest das neue Feld, schreibt die TSV) ändern Verhalten. Timer und Rundown lesen keine Organisationen; ihr altes `@jm/show` verwirft das Feld beim Lesen still und schreibt keine Show. Der Artefaktname kommt aus `package.json` (`apps/launcher/electron-builder.yml:3`). | 14 |
| E45 | Sperrdatei je Basisordner (Vorgabe, **OF10**): Nur der Rechner, der sie hält, legt ab; ein anderer zeigt es und tut nichts. Eigen ist eine Sperre mit dem eigenen Rechnernamen (`os.hostname()`), auch aus einer früheren Sitzung, nicht nur eine mit derselben `sitzung`. Endet die Ablage (Show-Wechsel, Rolle `slave`, Token weg, Schalter aus, Beenden), löscht der Launcher seine Sperre. Zwischendateien tragen die Prozesskennung; aufgeräumt werden nur eigene. | Der Entwurf schließt den Einzelplatz ein; eine Show auf einem Netzlaufwerk kann von zwei Rechnern mit Token geöffnet sein. Ohne Sperre löschte das Aufräumen den laufenden Download des anderen, und der Index hätte zwei Schreiber. Ein Rechner startet keinen zweiten Launcher (`apps/launcher/src/main/index.ts:63`, `packages/electron-kit/src/index.ts:101-109`; je Benutzer, **Annahme**); eine liegen gebliebene Sperre mit dem eigenen Namen stammt also von einem beendeten Prozess, sonst greift 9.2 Regel 4. Nach der Regel „andere `sitzung` = fremd“ hätte ein Neustart die eigene Ablage bis zu 15 Minuten gesperrt (Nachprüfung, NP1). | 9.2, 9.6 |
| E46 | Zwei Abrufer im Ordner-Teil: Agenda mit 15-s-Zeitgrenze (wie heute), Download **ohne** Zeitgrenze mit dem Signal des Laufs. Ein Abbruch durch den Aufrufer wird nicht wiederholt und ist kein Fehler; Leerlauf ist ein eigener Grund. | `mitZeitgrenze` ersetzt jedes Signal durch `AbortSignal.timeout(15 s)` (`apps/launcher/src/main/iveo-huelle-hilfen.ts:38-40`), auch beim Lesen des Datenstroms; `fetchWithRetry` wiederholt jeden Wurf (`packages/iveo/src/client.ts:148-170`). | 9.6, 9.15 |
| E47 | Der Index-Stand je Side Event liegt zusätzlich im Speicher und wird in jeder Runde nachgeschrieben, bis es gelingt; eine Datei mit dem erwarteten Namen und der Größe eines Anhangs wird übernommen, auch wenn der Index die Kennung nicht kennt, eine `.url` mit dem erwarteten Namen und genau dem Inhalt aus 9.7 ebenso. Ein Datei-Anhang ohne gültiges `size_bytes` wird nie übernommen (Grenze, 9.5). | Scheitert das Index-Schreiben (Virenscanner, Cloud-Sync, Absturz), würde der Anhang sonst als „(2)“, „(3)“ … erneut geladen. | 9.5, 9.8 |
| E48 | Die Warteschlange hält je Side Event höchstens einen Eintrag; der Plan entsteht erst beim Ausführen; unmittelbar vor jedem Platzieren wird der Zielname neu geprüft, und es wird nie überschrieben. | Ein Plan aus einem älteren Takt lud sonst doppelt; eine Datei, die während eines langen Downloads unter dem Zielnamen auftaucht, ginge verloren. | 9.4, 9.6 |
| E49 | Endungen aus dem Label nur, wenn sie nicht auf der Sperrliste stehen und einen Buchstaben enthalten; Steuer-, Format- und Bidi-Zeichen werden ersetzt. Dieselbe Namensregel gilt für den Vorschlag beim Speichern im Panel; dort öffnet der Launcher eine Datei mit gesperrter Endung nicht automatisch (8.6). Eine Herkunftsmarkierung (Windows: Zone.Identifier, macOS: Quarantäne) bekommt die Ablage nicht (**OF9**, Vorgabe vom Owner am 17.10.2026 bestätigt). | Fremde Labels wie „Agenda.exe“ oder „Slides‹U+202E›txt.exe“ sollen keine ausführbare Datei erzeugen (nachgerechnet, 9.12). Eine Markierung bremst Office (geschützte Ansicht) und ist deshalb eine Betriebsfrage. | 9.12 |
| E50 | Merker im Speicher, die die Statuszeile zeigt, aber nicht die Signatur: „Speaker-Verknüpfung veraltet“ (Detail scheitert) und „Organisationen fehlen“ (kein Speaker trägt das Feld, die Datei hat Organisationen; dann bleiben die Organisationen der Datei). | Owner-Regel „Jede Diagnose wird angezeigt“; eine Schemaänderung bei iveo soll Bauchbinden nicht still leeren. | 5.10, 6.3, 6.5 |
| E51 | Statuszeilen versprechen keine Uhrzeit, die sie nicht garantieren: „gegen ‹hh:mm›“ statt „spätestens“, nach Ablauf „Abgleich überfällig“, eine laufende Runde ohne Fortschritt „kein Fortschritt seit ‹hh:mm›“ (T76). Jede Zeile wird über alle Kombinationen ihrer Zustandsachsen getestet, nicht nur je Tabellenzeile. | Der Takt hat eine Sperre gegen Überholen; eine lange Abfrage verschiebt die nächste Runde (gemessen per Simulation, 11.1). Dateizugriffe haben keine Zeitgrenze (9.8). Owner-Regel „Kreuzprodukt“. | 11, 12.4 |
| E52 | Das iveo-Token geht nur an die Herkunft (Schema, Host, Port) der Basis-URL. Eine Asset-Adresse anderer Herkunft wird ohne `Authorization` abgerufen, und nur über `https:`; eine Adresse anderer Herkunft ohne `https:` wird nie abgerufen (Fehler T77). Geprüft wird die fertige Anfrage-URL, für Ordner-Ablage und manuellen Download (`oeffneAsset`, ebenso `fetchAsset`). | `resolveAssetUrl` übernimmt eine absolute `asset.url` unverändert (`packages/iveo/src/client.ts:351`), `fetchAsset` schickt immer `authHeaders()` mit (`:364-366`). Node entfernt `Authorization` nur bei einer Weiterleitung auf eine andere Herkunft (18, „Nicht umgesetzt“); eine direkt fremde Adresse bekäme das Token, mit der Ordner-Ablage künftig ohne Klick. M1 (17.10.2026): Auf Prod ist `asset.url` eine nackte Referenz, die `resolveAssetUrl` zu `‹Basis-URL›/assets/‹Referenz›` macht (`:353-354`), also zur Herkunft der Basis-URL; der fremde Fall kommt in den Prod-Daten nicht vor, die Regel bleibt als Schutz. | 9.6 |

---

## 4 · Ist-Stand je Teil (am Code nachgeprüft)

### 4.0 Abweichungen zur Ist-Karte

| # | Ist-Karte | Am Code | Fundstelle |
| --- | --- | --- | --- |
| 1 | „Fallback auf falsches Arch-DMG (`release-source.ts:128-137`, Worker `:313-316`)“ | Nur der Worker kann ein falsches DMG wählen. Die GitHub-Quelle des Launchers verlangt im Rückfall auf dem Mac die Architektur. | `apps/launcher/src/main/release-source.ts:132-137`; `services/release-proxy/worker.js:313-316` |
| 2 | „Die App baut unter macOS (`package.json:23` dist:mac)“ | Sie baut, aber ohne NDI: `dist:mac` ruft kein `prepackage`, und `bundle-ndi.mjs` überspringt Nicht-Windows. | `apps/connect/package.json:19`, `:23`; `apps/connect/tools/bundle-ndi.mjs:18-21` |
| 3 | – (nicht erfasst) | Das Einstellungsfeld „iveo Basis-URL“ startet immer leer; „Speichern“ schreibt den leeren Wert und löscht damit eine eingetragene Adresse. | 7.2 |
| 4 | „Rundown nutzt nur name/title/id (`apps/rundown/src/main/index.ts:115, :699`)“ | `:699` bestätigt; `:115` hier nicht nachgeprüft und nicht verwendet. | `apps/rundown/src/main/index.ts:699` |
| 5 | „Keine Größengrenze im Verbund-Pfad gefunden“ | Es gibt eine: Die Stand-Zeile des Masters darf höchstens 921 600 Bytes haben; darüber verteilt der Master die Show nicht (Grund `zu-gross`). Wirkung der Organisationen: 5.8. | `packages/master-link/src/fristen.ts:71`; `apps/launcher/src/main/verbund/verteiler.ts:262-268` |

Die übrigen verwendeten Aussagen der Ist-Karte sind unten mit eigener Fundstelle geführt; nach der Spec-Prüfung gilt das nur für Aussagen, die diese Spec mit einer Fundstelle belegt.

### 4.1 Teil A · Organisationen

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | `IveoSpeaker` kennt kein `organisations`. | `packages/iveo/src/types.ts:78-92` |
| 2 | Der Snapshot holt `/organisations` best effort; der Mapper nutzt die Liste nicht. | `packages/iveo/src/client.ts:280-282`, `:324-330`; `packages/iveo/src/mapper.ts:331-373` |
| 3 | Der Konstruktor der Show-Speaker baut `{name}` plus `title`, ohne Kennung, und wirft namenlose weg. | `packages/iveo/src/mapper.ts:331-339` |
| 4 | `ShowIveoSpeaker` = `{id?, name, title?}`. | `packages/show/src/index.ts:65-75` |
| 5 | Der Normalisierer baut jeden Speaker neu; jedes unbekannte Feld fällt still weg. Doppelte Kennungen löst er mit `{...it, id}` auf (weitere Felder bleiben). | `packages/show/src/index.ts:254-271`, `:215` |
| 6 | Die Signatur führt Speaker als `[id, name, title]`. | `apps/launcher/src/main/iveo-abgleich-kern.ts:252` |
| 7 | Der Titler schreibt die TSV mit festem Kopf `name\tfunktion\ttitle\t@kennung`. | `apps/titler/src/main/iveo-show.ts:41`, Zeilen `:43-44` |
| 8 | Jede Kopfspalte wird Variable (außer `@kennung`); eine unbekannte Variable wird leer. | `apps/titler/src/shared/datalink-kern.ts:72-79`; `apps/titler/src/shared/vars.ts:23-31` |
| 9 | Der Titler liest die Show mit seinem eigenen `@jm/show`; im Verbund läuft der Stand durch `migrateShow` aus `@jm/app-runtime`. | `apps/titler/src/main/show-quelle.ts:97`; `packages/app-runtime/src/verbund-daten.ts:298`; `packages/app-runtime/src/verbund-speicher.ts:54` |
| 10 | Die Verbund-Freigabe reicht `speakers` als Ganzes weiter. | `packages/show/src/index.ts:448-449` |
| 11 | Nur der Launcher schreibt Shows (einziger `serializeShow`-Aufruf unter `apps/*/src`). | `apps/launcher/src/main/iveo-sync.ts:374` (`git grep "serializeShow("`) |
| 12 | Prod 16.10.: 239 Speaker, 157 mit Organisation, 14 mit mehreren, 173 Einträge; `is_primary` immer gesetzt, `role_at_organisation` 4-mal; `/organisations` hat 1 Eintrag, nur 2 Speaker-Organisationen lösen dort auf. | Messdatei `iveo-prod-felder-2026-10-16.txt` |

### 4.2 Teil B · Aktualität

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Takt 45 s, in Tests per `JMPS_IVEO_POLL_MS` verkürzbar. | `apps/launcher/src/main/iveo-sync.ts:91-92`, `:487-492`; `apps/launcher/src/main/iveo-huelle-hilfen.ts:9-26` |
| 2 | Listen-Modus: Snapshot (mit Speakern) nur bei einem `updated_since`-Treffer oder gesetztem Merker. | `apps/launcher/src/main/iveo-abgleich-kern.ts:710-714` |
| 3 | Agenda-Modus: Speaker aus der Datei; die Liste kommt nur ohne Kontext mit Verknüpfung oder mit Merker. | `iveo-abgleich-kern.ts:806-821`, `:854-861` |
| 4 | Der Kontext hält Startzeit, Kategorie, Namen und Detail-Verknüpfung; im Agenda-Modus wird er nach dem ersten Erfolg nicht mehr erneuert. | `iveo-abgleich-kern.ts:305-333`, `:866-867`, `:891` |
| 5 | Umschalten ohne Verknüpfung holt keine Liste, die Liste der Datei bleibt, Antwort „… bestehende Speakerliste bleibt.“ | `iveo-abgleich-kern.ts:948-952`, `:1054` |
| 6 | Fehlerweg: Merker, „Speaker aus früherem Stand“, Log nur bei neuem Text. | `iveo-abgleich-kern.ts:119`, `:419-436`, `:460-465`, `:557-565` |
| 7 | `/speakers` hat kein `updated_since`. | `packages/iveo/src/client.ts:276-278` |
| 8 | Die Doku beschreibt, dass eine Speaker-Korrektur allein die Show nicht mit jeder Abfrage erreicht. | `docs/jm-show.md:232-237` |

### 4.3 Teil C · Standard-URL

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Standard ist Staging. | `packages/iveo/src/client.ts:26` |
| 2 | Wirksam: Umgebungsvariable vor gespeicherter Adresse vor Standard. | `apps/launcher/src/main/settings.ts:174-176` |
| 3 | Basis-Tokens liegen unter `base:‹normalisierte URL›`. | `settings.ts:238-252` |
| 4 | Der Kern nimmt ohne Adresse in der Show den Standard und schreibt beim ersten Schreiben die Adresse in die Show. | `iveo-abgleich-kern.ts:642`, `:595` |
| 5 | Der Show-Editor bindet mit leerem Feld ohne Adresse; die Bindung trägt dann keine. | `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:208`, `:241`; `apps/launcher/src/renderer/src/lib/show-speichern.ts:135` |
| 6 | Texte nennen Staging: Hinweis und Platzhalter in den Einstellungen, Platzhalter im Show-Editor, Beispiel in der Fehlermeldung, Kommentare. | `SettingsModal.tsx:83`, `:96`; `ShowEditorModal.tsx:465`; `client.ts:25`, `:45`, `:72`; `settings.ts:14`, `:173`; `packages/show/src/index.ts:97`; `apps/launcher/src/shared/types.ts:56` („leer = Staging-Default“) |
| 7 | Roadmap: „iveo-Prod-URL scharfschalten (📌 langstehend; Staging-Base bleibt bis dahin)“. | `docs/roadmap.md:280` |

### 4.4 Teil D · Anhänge

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Ursache #264: Das Panel lädt nur, wenn noch keine Liste im Speicher ist; der Speicher wird nie geleert. | `SideEventsPanel.tsx:60-67` (`:66`); `apps/launcher/src/renderer/src/store/tools.ts:427-458` (einzige Schreibstelle `:438`), keine Leerung in `:264-275`, `:405-426` |
| 2 | Das 📎 erscheint nur mit Token. | `SideEventsPanel.tsx:177-191` |
| 3 | Der Main holt bei jedem Aufruf frisch. | `apps/launcher/src/main/iveo-sync.ts:629-660` (`:638`) |
| 4 | `purged_at` kennt der Code nicht. | `packages/iveo/src/types.ts:121-129`; `iveo-sync.ts:640-652` |
| 5 | Der Live-Abgleich kennt Anhänge nicht: Die Agenda kommt im Agenda-Modus jeden Takt, `agendaToAblauf` ignoriert `materials`, die Signatur auch. | `iveo-abgleich-kern.ts:799`; `packages/iveo/src/mapper.ts:192-212`; `iveo-abgleich-kern.ts:237-255` |
| 6 | Kein Ereignis an den Renderer für Anhänge. | `apps/launcher/src/shared/types.ts:344-361` |
| 7 | Der Download fragt immer per Dialog, lädt ohne Zeitgrenze ganz in den Speicher und schreibt direkt. Der Vorschlagsname ersetzt nur neun Zeichen und nimmt die Endung aus dem Label, sonst aus `asset.mime_type` bzw. dem `Content-Type` der Antwort; danach öffnet der Launcher die Datei sofort, ohne Prüfung der Endung. | `iveo-sync.ts:686-698` (Name `:692-694`, `extFor` `:618-621`, Öffnen `:697`) |
| 8 | Keine Tests mit `materials`. | `apps/launcher/test/iveo-abgleich.test.ts:124-238` (nachgebautes iveo ohne Anhänge) |

### 4.5 Teil E · Side-Event-Ordner

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Es gibt kein Ordner-Konzept und keine Ordner-Einstellung. | `apps/launcher/src/main/settings.ts:7-28` |
| 2 | Die Show liegt, wo der Speichern-Dialog sie hinlegt; vorgeschlagener Name `‹Showname›.jmshow`, die Zeichen `\/:*?"<>|` durch `_` ersetzt. | `apps/launcher/src/main/show.ts:104-116` (`:108`) |
| 3 | Eine Show ist im Launcher immer mit einem Pfad geöffnet. | `show.ts:29-64`; `iveo-sync.ts:500-510` |
| 4 | Atomares Schreiben mit Wiederholung bei EPERM/EBUSY/EACCES gibt es schon. | `apps/launcher/src/main/show-schreiben.ts:34-70` |
| 5 | Die Verbund-Rolle kennt `aus`, `master`, `slave`; die Hülle fragt sie heute nur für RELOAD ab. | `apps/launcher/src/main/verbund/kern.ts:152-169`, `:467`; `apps/launcher/src/main/verbund/index.ts:132-134` |
| 6 | Signierte Download-Adressen werden nie gespeichert. | `iveo-sync.ts:597-600`; `packages/iveo/src/client.ts:357-362` |
| 7 | Dateinamen aus Labels ersetzen heute nur neun Zeichen; Endung aus Label oder MIME. | `iveo-sync.ts:602-621`, `:693` |
| 8 | Ein zweiter Launcher-Start beendet sich sofort (Einzelinstanz über `app.requestSingleInstanceLock()`); dass die Sperre je Benutzer und nicht je Rechner gilt, ist **Annahme**. Eine Show wird nur durch das Öffnen einer anderen ersetzt: `stopIveoPolling` (ruft `kern().showGeschlossen()`) hat keinen Aufrufer. `before-quit` stoppt nur den Steuerserver; das Launcher-Update beendet die App mit `app.quit()`. Fehlt das Token mitten in der Sitzung, bleibt die Show im Kern aktiv (`aktiv()` liefert weiter einen Wert), nur der Status wird „gestört“. | `apps/launcher/src/main/index.ts:63`, `:94`; `packages/electron-kit/src/index.ts:101-109`; `iveo-sync.ts:500-518` (`grep -rn stopIveoPolling apps packages` findet nur `:512`); `apps/launcher/src/main/installer.ts:395`; `apps/launcher/src/main/iveo-abgleich-kern.ts:685-689`, `:1139-1141` |

### 4.6 Teil F · Connect auf dem Mac

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Der Katalog führt Connect für Mac und Windows und verspricht „Windows + macOS (nutzt die NDI-Runtime)“. | `packages/suite-manifest/suite.json:471`, `:476-485` |
| 2 | Die CI baut Connect nicht; Release und Katalog-Bump laufen lokal. | `.github/workflows/suite-release.yml:35`, `:143-145` |
| 3 | Der Proxy wählt das höchste Release ohne Blick auf die Pakete und antwortet ohne DMG mit `404 {error: "kein mac-Asset im Release"}`. Dass `connect-v0.3.0` kein DMG trägt, ist eine **Annahme** (kein Netz); sie passt zur Meldung in #256. | `services/release-proxy/worker.js:303-317` |
| 4 | Der Launcher verwirft den Fehlertext des Proxys und zeigt „Proxy ‹Status› ‹Statustext›“. | `apps/launcher/src/main/release-source.ts:181`; `apps/launcher/src/main/installer.ts:233-240` |
| 5 | Die Update-Prüfung verschluckt Fehler (kein falscher Update-Hinweis). | `apps/launcher/src/main/updates.ts:43-50` |
| 6 | Mac-Bau ohne Zoom-SDK ist am Code möglich: `bundle-zoom-bridge.mjs` beendet sich auf Nicht-Windows nach dem Laden von `auslieferung.mjs` (nur `node:`-Importe); der After-Pack-Wächter verlangt die `zoom-bridge.exe` nur unter Windows; `electron-builder.yml` hat Mac-DMG für arm64 und x64 sowie `electronVersion` und `npmRebuild` schon gesetzt. | `apps/connect/tools/bundle-zoom-bridge.mjs:17-30`; `packages/zoom-bridge/scripts/auslieferung.mjs:11-13`; `apps/connect/tools/after-pack.cjs:20`; `apps/connect/electron-builder.yml:36-48` |
| 7 | NDI fehlt im Mac-Paket: `bundle-ndi.mjs` überspringt Nicht-Windows; `@jm/ndi` baut nur mit `NDI_SDK_DIR`; der Lader wirft ohne Addon; die Gast-Sender und der Programm-Empfänger importieren `@jm/ndi`; der Main nicht. Ein gestorbener Gast-Sender landet nur im Log, es gibt keinen Zuhörer auf sein Ende. Endet der Programm-Empfänger, wird sein Zustand `off`, und das Abzeichen verschwindet ohne Text. Programmbild und Programm-Ton der Gäste kommen nur über diesen Empfänger; Gast-zu-Gast-Ton und Talkback nicht. | `bundle-ndi.mjs:18-21`; `packages/ndi/scripts/maybe-build.mjs:10-16`; `packages/ndi/index.js:58-70`; `apps/connect/src/utility/ndi-guest-sender.ts:11`; `apps/connect/src/utility/ndi-program-receiver.ts:1-4`, `:21`; `apps/connect/src/main/ndi-guests.ts:38-79`; `apps/connect/src/main/ndi-program.ts:69-74`, `:84`; `apps/connect/src/renderer/src/App.tsx:611-620`; `apps/connect/src/renderer/src/peer.tsx:663-666`, `:742-765`, `:775-790` |
| 8 | Die Quellen von Connect selbst sind seit `connect-v0.3.0` unverändert. Connect bündelt aber auch `@jm/app-runtime` und `@jm/show`, und die haben sich seitdem geändert. Für den Nachlauf ist das ohne Belang: Er baut aus dem Tag, also wie das Windows-Paket 0.3.0. | `git diff --stat connect-v0.3.0 HEAD -- apps/connect packages/ndi packages/zoom-bridge/scripts` ist leer; `apps/connect/package.json:26`, `:32`; `git diff --stat connect-v0.3.0 HEAD -- packages/app-runtime packages/show` ist nicht leer |
| 9 | Das Handbuch sagt „unter macOS zeigt Connect nur die Browser-Gäste“. | `packages/cookbook/content/tool-manuals/tool-jm-connect.md:29` |
| 10 | Der Proxy-Selbsttest läuft nicht in der CI; die CI hat Node 22. | `services/release-proxy/test/worker.test.mjs:1-3`; `.github/workflows/ci-checks.yml:39-42` |

---

## 5 · Teil A · Organisationen

### 5.1 iveo-Typ (`packages/iveo/src/types.ts`)

Neu, nach `IveoSpeaker`:

```ts
/** Organisation am Speaker (Prod seit 15.10.2026, eingebettet MIT Namen). */
export interface IveoSpeakerOrganisation {
  id: string;
  name: string;
  role_at_organisation?: string | null;
  is_primary?: boolean;
}
```

`IveoSpeaker` bekommt `organisations?: IveoSpeakerOrganisation[]`. Der Typ ist tolerant: Der Mapper prüft jeden Eintrag zur Laufzeit (5.2), weil iveo bisher Felder unangekündigt geändert hat.

### 5.2 Mapper-Regel (`packages/iveo/src/mapper.ts`)

Neue Funktion `organisationenVon(s: IveoSpeaker): string[]`:

1. Ist `s.organisations` kein Array → `[]`.
2. Gültig ist ein Eintrag, der ein Objekt ist und dessen `name` ein String ist, der nach der Normalform aus `@jm/show` (5.3, Schritt 2) nicht leer ist.
3. Hauptorganisation = der erste gültige Eintrag mit `is_primary === true`; gibt es keinen, der erste gültige.
4. Reihenfolge: Hauptorganisation, danach die übrigen gültigen in iveo-Reihenfolge.
5. Die Namen gehen durch `normalisiereOrganisationen` (5.3): Leerraum, Länge, Doppelte, Anzahl. Die Hauptorganisation steht dadurch immer vorn, auch wenn ihr Name später noch einmal vorkommt.
6. `id`, `role_at_organisation` und alle übrigen Felder entfallen.

`speakersToShowSpeakers` (`mapper.ts:331-339`) setzt nach `title`: `if (orgs.length) speaker.organisationen = orgs`. Die Kopfzeile des Moduls (`:8-10`, `:323-330`) nennt die Organisationsnamen als erlaubtes Feld.

| Eingabe `organisations` | Ergebnis `organisationen` |
| --- | --- |
| fehlt, `null`, kein Array | Feld fehlt |
| `[]` | Feld fehlt |
| `[{name:'UNFCCC', is_primary:true}]` | `['UNFCCC']` |
| `[{name:'A', is_primary:false}, {name:'B', is_primary:true}]` | `['B', 'A']` |
| `[{name:'A'}, {name:'B'}]` (ohne `is_primary`) | `['A', 'B']` |
| `[{name:'A', is_primary:true}, {name:'B', is_primary:true}]` | `['A', 'B']` |
| `[{name:'B', is_primary:true}, {name:'A'}, {name:'B'}]` | `['B', 'A']` |
| `[{name:'  A  '}, {name:'A'}]` | `['A']` |
| `[{name:'A\tB\nC'}]` | `['A B C']` |
| `[{name:'a'}, {name:'A'}]` | `['a', 'A']` |
| `[{name:''}, {name:'  '}, {name:null}, 'x', null]` | Feld fehlt |
| `[{id:'o1', name:'A', role_at_organisation:'Chair', is_primary:true}]` | `['A']` (Kennung und Rolle entfallen) |

### 5.3 Show-Feld (`packages/show/src/index.ts`)

- **Name und Typ:** `ShowIveoSpeaker.organisationen?: string[]` mit Doku-Kommentar „Namen der Organisationen aus iveo, Hauptorganisation zuerst; ohne Kennungen und Rollen (iveo-Paket, Spec 5.3)“.
- **Gemeinsame Regel:** `export function normalisiereOrganisationen(wert: unknown): string[]`, exportiert wie `loeseDoppelteKennungenAuf`:
  1. Kein Array → `[]`.
  2. Je Element: nur Strings; `normalize('NFC')`, jede Folge von Leerraum (`\s+`) wird ein Leerzeichen, dann `trim()`. Leer → weg.
  3. Länger als 200 Codepunkte → auf 200 Codepunkte gekürzt (`Array.from`, nie mitten in einem Surrogatpaar), danach erneut `trim()`.
  4. Doppelte (exakt gleicher String nach 2 und 3) → nur das erste Vorkommen bleibt.
  5. Höchstens 20 Einträge; der Rest fällt weg.
  6. Die Reihenfolge bleibt (der Normalisierer sortiert nie).
- **Normalisierer:** `normalizeIveoBinding` (`:254-271`) setzt nach `title`: `const orgs = normalisiereOrganisationen(sp.organisationen); if (orgs.length) speaker.organisationen = orgs;`. Leere Liste → Feld fehlt (wie `title`, alte Shows bleiben byte-nah).
- **Feldreihenfolge:** `id`, `name`, `title`, `organisationen`. Die Bindung behält ihre Reihenfolge (`event`, `baseUrl`, `name`, `syncedAt`, `speakers`, `speakerVeraltetSeit`, `sideEvents`, `filter`).
- **Fixpunkt:** `organisationenVon` ruft am Ende `normalisiereOrganisationen`; die Ausgabe des Mappers läuft unverändert durch den Normalisierer (Test 12.1 Nr. 6).
- **Verbund-Freigabe:** keine Änderung nötig. `showFuerVerbund` reicht `speakers` als Ganzes weiter (`:448-449`), nach `migrateShow` (`:417`) mit dem neuen Normalisierer. Der Kommentar `:446-447` bekommt den Satz „Felder eines Speakers reisen mit, sobald der Normalisierer sie kennt.“ Ein Test sichert es (12.1 Nr. 9).
- `SHOW_SCHEMA_VERSION` bleibt 1: Das Feld ist optional, alte Leser verwerfen es ohne Fehler.

### 5.4 Alle Stellen, die Speaker bauen oder kopieren

Gesucht mit `git grep -n "ShowIveoSpeaker\|speakersToShowSpeakers\|snapshotToShowSpeakers\|iveo?.speakers\|speakers:"` über `apps/*/src`, `packages/*/src` und die Tests (Lehre „Konstruktoren greppen, nicht Leser“).

**Konstruktoren (bauen neu, müssen das Feld kennen):**

| # | Stelle | Art | Trägt das Feld? |
| --- | --- | --- | --- |
| OR1 | `packages/iveo/src/mapper.ts:331-339` `speakersToShowSpeakers` | Erzeuger aus iveo | **neu: ja** (5.2) |
| OR2 | `packages/show/src/index.ts:254-271` Normalisierer (läuft in jedem `parseShow`, `serializeShow`, `migrateShow`, `showFuerVerbund`) | Neubau je Speaker | **neu: ja** (5.3) |
| OR3 | `apps/launcher/src/main/iveo-abgleich-kern.ts:252` Signatur-Tupel | Neubau als Tupel | **neu: ja**, viertes Element (5.5) |
| OR4 | `apps/titler/src/main/iveo-show.ts:40-47` `speakersTsvText` | Neubau als TSV-Zeile | **neu: ja**, zwei Spalten (5.6) |
| OR5 | `apps/connect/src/main/show-open.ts:59` eigener Typ `{name, title}` | Neubau | **bewusst nein** (E7; Connect erkennt Gäste über den Namen) |
| OR6 | `packages/iveo/src/mapper.ts:371` `buildShowMetadata` (Cache, eigener Typ) | Neubau | **bewusst nein** (E7) |
| OR7 | `apps/titler/src/shared/datalink-kern.ts:65-86` `parseTable` | Neubau als `DataEntry` | ja, ohne Änderung: jede Kopfspalte wird Variable |

**Durchreicher (kopieren ganze Objekte, das Feld überlebt):**

| Stelle | Woher die Speaker kommen |
| --- | --- |
| `apps/launcher/src/main/iveo-sync.ts:177`, `:184`, `:312`, Rückgabe `:337` | OR1 |
| `iveo-abgleich-kern.ts:547` (`standMitSpeakerliste`), `:859` (Agenda mit Merker bzw. fällig), `:939` (Umschalten) | OR1 |
| `iveo-abgleich-kern.ts:558`, `:854`, `:1054` | Datei (OR2) |
| `iveo-abgleich-kern.ts:287-289` `speakerWieInDerDatei` | OR2 über `migrateShow` |
| `iveo-abgleich-kern.ts:598` `schreibeAblauf` | Spread `speakers: w.speakers` |
| `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:229`, `:242`, `:346` | Bind-Ergebnis bzw. Datei |
| `apps/launcher/src/renderer/src/lib/show-speichern.ts:136`, `:349-351`, `:360` | Editor-Bindung bzw. aktuelle Datei |
| `apps/launcher/src/shared/types.ts:240` `IveoBindResult.speakers` | Typ `ShowIveoSpeaker[]` |
| `packages/show/src/index.ts:448-449` `showFuerVerbund`; `apps/launcher/src/main/verbund/verteiler.ts:260` | OR2 |
| `packages/app-runtime/src/verbund-daten.ts:298`, `verbund-speicher.ts:54` | OR2 |
| `apps/titler/src/main/show-quelle.ts:97`; `apps/titler/src/shared/datenquelle.ts:146-151`, `:190-201`; `apps/titler/src/main/index.ts:260`, `:293` | OR2, weiter an OR4 |

**Leser ohne Bedarf:** Rundown (`apps/rundown/src/main/index.ts:699`, `apps/rundown/src/shared/zeilen.ts:87-181`) nutzt nur `id` und `name`; Timer liest keine Speakerfelder.

**Testdaten (bleiben gültig, bekommen Ergänzungen in 12):** `packages/iveo/test/selftest.ts:67-70`, `:155-158`; `apps/launcher/test/iveo-abgleich.test.ts:162`, `:203`, `:241`, `:396`; `apps/launcher/test/show-speichern.test.ts:48`; `apps/launcher/test/verteiler.test.ts:75`; `apps/launcher/test/verbund-kette.test.ts:88`; `apps/launcher/test/e2e-teil2b-verbund.ts:211`; `apps/rundown/test/selftest.ts:1730-1732`; `apps/rundown/test/e2e-teil2a.mjs:197-199`; `apps/titler/test/selftest.ts:68-74`, `:1093-1097`, `:1159`.

### 5.5 Signatur und einmaliges Neuschreiben

- `ablaufSignatur` (`iveo-abgleich-kern.ts:252`) führt Speaker als `[s.id ?? null, s.name.trim(), s.title?.trim() || null, s.organisationen ?? []]`. Die Speaker laufen vorher durch `speakerWieInDerDatei`, also durch denselben Normalisierer wie die Datei.
- `lastSig` entsteht beim Öffnen mit derselben Funktion aus der Datei (`:645`). Eine Show ohne Organisationen und ein iveo ohne Organisationen ergeben also dieselbe Signatur; nichts wird geschrieben.
- **Wann eine Bestands-Show die Organisationen bekommt:** bei der ersten Abfrage, die Speaker frisch holt: im Listen-Modus beim ersten Auffrischen oder bei der ersten Programmänderung, im Agenda-Modus beim ersten Auffrischen, in beiden beim Umschalten mit Speakerliste. Mit E9 also spätestens 5 Minuten nach dem Öffnen. Dann wird die Show genau einmal geschrieben und RELOAD geht an Timer, Titler und Rundown (bzw. in der Rolle Master nur an Tools dieses Rechners, 2b-Spec 15.3; Rechner B bekommt den Stand über den Verbund). Die Logzeile kommt aus `abweichungVonDatei` (`:267-280`): „… die Speakerliste weicht von der Datei ab → Show neu geschrieben …“.
- Der Kommentar `:227-236` bekommt den Satz „Die Organisationen eines Speakers zählen (iveo-Paket, Spec 5.5).“
- Doku: Release-Notes (14.2) und `docs/jm-show.md` (15) sagen, dass eine offene iveo-Show nach dem Update einmal neu geschrieben wird, wenn ihre Speaker in iveo Organisationen haben und der Rechner das Token hält; eine Show ohne Organisationen bei einem iveo ohne Organisationen bleibt unverändert (Satz oben).

### 5.6 Titler: TSV-Spalten und Variablen (`apps/titler/src/main/iveo-show.ts`)

- **Kopf, genau:** `name\tfunktion\ttitle\torganisation\torganisationen\t@kennung`
- **Zeile:** `name`, `funktion` (= `title`), `title` (= `title`), `organisation` = `organisationen[0] ?? ''`, `organisationen` = `organisationen.join(' · ')` (Trenner U+0020 U+00B7 U+0020), `@kennung` = `id ?? ''`. Alle Zellen gehen wie heute durch `cell()` (`:28-30`).
- **Beispiel** (Tabs als `→`):
  `Dr. Ana Ferreira→Lead Negotiator→Lead Negotiator→UNFCCC→UNFCCC · Ministry of Environment→`
- **Variablen:** `{{organisation}}` und `{{organisationen}}`, ohne Änderung in `datalink-kern.ts` oder `vars.ts` (jede Kopfspalte wird Variable, `VAR_RE` erlaubt beide Namen, `vars.ts:12`).
- **Label:** bleibt `name` (`LABEL_KEYS`, `datalink-kern.ts:14`, `:73`).
- Der Modul-Kopf (`iveo-show.ts:1-15`) und der Funktionskommentar (`:32-39`) nennen die zwei neuen Spalten.
- **Bestehende Vorlagen:** unverändert; sie nutzen die neuen Variablen nicht und sehen dieselben Werte wie bisher.

### 5.7 Verhalten ohne Organisation

| Lage | `{{organisation}}` | `{{organisationen}}` |
| --- | --- | --- |
| Speaker ohne Organisation in iveo | leer | leer |
| Show von einem Launcher vor 0.16.0 | leer (Spalte da, Wert leer) | leer |
| Titler vor 0.11.1 | leer (Variable unbekannt, `vars.ts:27-29`) | leer |
| eigene CSV/TSV des Bedieners ohne diese Spalten | leer | leer |

Eine leere Variable erzeugt nie Rohtext auf Sendung (`vars.ts:19-20`). Wer in einer Vorlage „{{name}} · {{organisation}}“ schreibt, sieht bei Speakern ohne Organisation „Name · “; das ist Vorlagengestaltung und steht im Titler-Handbuch (15).

### 5.8 Gemischte Versionen und Verbund

| Kombination | Verhalten |
| --- | --- |
| Launcher 0.16.0, Titler 0.11.0 | Der alte Normalisierer im Titler verwirft das Feld still; TSV ohne die Spalten; Variablen leer. |
| Launcher 0.15.0, Titler 0.11.1 | Keine Organisationen in der Show; Spalten da, Werte leer. |
| Master-Launcher 0.16.0, Titler 0.11.0 auf Rechner B | Das Feld reist, `migrateShow` des alten `@jm/app-runtime` verwirft es; Variablen leer, kein Fehler. |
| Master-Launcher 0.15.0, Titler 0.11.1 auf B | Kein Feld; Werte leer. |
| Ein Launcher vor 0.16.0 speichert eine Show im Show-Editor | Das Feld geht verloren. Öffnet ein Launcher 0.16.0 die Show, stellt seine nächste Speaker-Abfrage es wieder her (Signatur weicht ab, einmal schreiben). Wechseln sich zwei Launcher ab, wird bei jedem Wechsel geschrieben (Risiko 9). |
| Rundown, Timer, Connect (alle Versionen) | Lesen das Feld nicht; ihr `@jm/show` verwirft es beim Lesen; sie schreiben keine Show (4.1 Nr. 11). |

**Größe im Verbund:** Der Master verteilt eine Show nur, wenn ihre Stand-Zeile höchstens 921 600 Bytes hat (4.0 Nr. 5); sonst bekommt Rechner B keine Show und sieht den Grund `zu-gross`. Zuwachs durch die Organisationen bei COP31: 173 Namen; bei angenommen höchstens 80 Bytes je Name samt JSON-Zeichen rund 14 KB (**Annahme**: die Namenslänge ist nicht gemessen). Die Kappungen aus E4 erlauben rechnerisch 239 × 20 × 200 Codepunkte, also mehrere MB; eine Gesamtkappe gibt es bewusst nicht, weil die gemessenen Daten weit darunter liegen und `zu-gross` schon heute sichtbar ist. Test 12.1 Nr. 10 sichert eine COP31-ähnliche Show (239 Speaker, je zwei Organisationen mit 80 Zeichen) unter der Grenze.

### 5.9 Show-Editor-Meldung

`ShowEditorModal.tsx:258-261` hängt bei `speakers.length > 0` nach „Speaker (Titler)“ an: „, davon ‹o› mit Organisation“ (T1). `‹o›` = Zahl der Speaker mit nicht leerem `organisationen`. So sieht der Bediener schon beim Binden, ob iveo Organisationen liefert. Der bestehende Zusatz „ ⚠ ‹Warnung›“ (`:260`, z. B. „iveo verknüpft … keine Speaker“, `iveo-sync.ts:185`) bleibt am Ende erhalten; das Filterlabel „Side Event „‹Titel›“ (Agenda)“ (`:249`, heute mit ASCII-Schlusszeichen) wird typografisch. Den ganzen Text baut ein reiner Helfer `bindMeldung(…)` in `apps/launcher/src/renderer/src/lib/show-speichern.ts`, getestet in 12.6 Nr. 4.

### 5.10 Fehlendes Feld `organisations`

Liefert iveo eine Speakerliste, in der **kein** Speaker ein Array `organisations` trägt (Feld fehlt überall, etwa nach einer Schemaänderung), während die Datei Speaker mit `organisationen` hat, gilt das nicht als „alle Organisationen gelöscht“:
- Die Organisationen der Datei bleiben: Ein frischer Speaker bekommt die `organisationen` des Datei-Speakers mit derselben Kennung, sonst mit demselben Namen nach Trimmen (der Mapper setzt keine Kennung, `packages/iveo/src/mapper.ts:331-339`); ohne Treffer bleibt das Feld weg.
- Wo: an jeder Stelle, an der der Kern frische Speaker übernimmt, über einen reinen Helfer `organisationenAusDatei(frisch, roh, datei)` im Kern: `standMitSpeakerliste` (`apps/launcher/src/main/iveo-abgleich-kern.ts:547`, genutzt im Listen-Modus `:742` und in der Tagesübersicht `:1041`), Agenda-Abfrage (`:859`) und Umschalten auf ein Side Event (`:939`). `roh` ist die Speakerliste aus iveo (für die Prüfung „kein Speaker trägt das Feld“), `datei` die Speaker der Datei. Nur in diesem seltenen Fall liest der Kern die Datei schon vor dem Vergleich, wie heute bei einem Speakerfehler (`:733-739`). Beim Binden (`apps/launcher/src/main/iveo-sync.ts:177`, `:184`) gibt es keine Datei; dort gilt die Liste, wie sie kommt.
- Der Kern setzt im Speicher den Merker `orgFehlenSeit` (nicht Teil der Signatur, wie `seListeVeraltetSeit`); `statusNachAbfrage` zeigt T51; eine Warnung kommt beim ersten Mal ins Log.
- Trägt wieder mindestens ein Speaker das Feld (auch leer), entfällt der Merker.
- Auf Prod hatten 157 Speaker eine nicht leere Liste, und die Messung meldet für das Feld auch leere Arrays (`array<?>`, Messdatei). Ob jeder Speaker das Feld trägt, ist nicht gemessen (**Annahme**); deshalb prüft die Regel „kein einziger“, nicht „einer fehlt“.

---

## 6 · Teil B · Aktualität der Speaker

### 6.1 Regel „fällig“

- `AktiveShow` (`iveo-abgleich-kern.ts:341-370`) bekommt `speakerAbgerufen: string` (ISO): Zeitpunkt des letzten gelungenen Abrufs der Speakerliste, **dessen Ergebnis in der Datei steht** (geschrieben oder Signatur gleich).
- Startwert in `setzeAuf` (`:615-661`): `d.jetztIso()`. In `offeneShowGespeichert` (`:1110-1137`) übernimmt die neue `AktiveShow` den Wert der vorigen, wenn Event und Bindung gleich bleiben (wie `lastSyncIso`, `:1124-1128`).
- `KernAbhaengigkeiten` (`:55-87`) bekommt `taktMs?: number` (Standard `IVEO_ABFRAGE_TAKT_MS` = 45 000, `iveo-huelle-hilfen.ts:9`). Die Hülle reicht `POLL_INTERVAL_MS` (`iveo-sync.ts:92`).
- Konstante `SPEAKER_AUFFRISCHEN_MS = 300_000`. **Fällig**, wenn `Date.parse(jetzt) − Date.parse(a.speakerAbgerufen) + taktMs ≥ SPEAKER_AUFFRISCHEN_MS`, im Normalbetrieb also ab 255 s. Bei regelmäßigem Takt kommt das Auffrischen in jedem sechsten Takt (alle 270 s); zwischen einer Änderung in iveo und ihrem Abruf liegen dann höchstens 270 s plus Abrufdauer, also unter 5 Minuten. Das erste Auffrischen nach dem Öffnen kommt bei regelmäßigem Takt spätestens 300 s danach. Fällt ein Takt durch die Sperre gegen Überholen aus (eine Abfrage dauert länger als 45 s, 8.2) oder scheitert die Agenda, verschiebt sich das Auffrischen entsprechend; die Zusage gilt nur bei regelmäßigem Takt.
- Der Zeitpunkt, der vorrückt, wird **vor** dem Abruf der Speakerliste genommen (`const ab = d.jetztIso()` wie beim Zusatzabruf, `iveo-abgleich-kern.ts:450`), nicht danach oder beim Schreiben. Sonst schöbe ein langsamer Abruf das nächste Auffrischen um seine eigene Dauer hinaus.
- `speakerAbgerufen` rückt auf diesen Zeitpunkt vor: nach einer Listen-Abfrage mit Snapshot ohne Speakerfehler, einer Agenda-Abfrage mit gelungener Speakerliste, einem Umschalten mit `speakerAbruf === 'ok'` oder einer Tagesübersicht ohne Speakerfehler, jeweils erst nach erfolgreichem Schreiben oder bei gleicher Signatur. Scheitert das Schreiben, bleibt der Wert; der nächste Takt holt die Liste erneut (wie `lastSig`, `:769-773`).

### 6.2 Listen-Modus (`abfrageListe`, `:709-787`)

- Bedingung `:711` wird zu `if (!geaendert.length && !a.speakerVeraltetSeit && !faellig(a))`. Ist das Auffrischen fällig, läuft der Snapshot-Weg wie bei einer Programmänderung: `standMitSpeakerliste`, Signatur, Schreiben nur bei Abweichung.
- Bei gleicher Signatur, ohne Programmänderung und mit gelungener Speakerliste schreibt der Kern die Info-Zeile T2 („iveo: Speakerliste aufgefrischt, unverändert (‹n› Speaker).“, ‹n› = Zahl der Speaker, die danach in der Datei stehen), damit Bediener und Abnahme das Auffrischen sehen (rund 13 Zeilen je Stunde bei 270 s). T2 ist eine Logzeile: kein Schreiben, kein RELOAD, keine Notice, keine Statusänderung. I2 („geschrieben und gemeldet nur bei echter Änderung“) meint die Datei und die Tools; die Logzeile ist eine Ergänzung (0.1 Nr. 11).
- Bei abweichender Signatur gilt die bestehende Logzeile `:776` („kein Programm geändert, aber die Speakerliste weicht von der Datei ab …“).

### 6.3 Agenda-Modus (`abfrageAgenda`, `:797-898`)

- **Was geholt wird** (mit Kontext): Ist das Auffrischen fällig, holt die Abfrage die Speakerliste (`listSpeakers`) **und** das Programm-Detail (`getProgram`), nacheinander. Ist nur der Merker „Speaker veraltet“ gesetzt, holt sie wie heute nur die Liste (`:814-821`; der Bestandstest `apps/launcher/test/iveo-abgleich.test.ts:1294-1297` „Kontext gemerkt → kein Detail-Abruf“ bleibt so gültig). Ist der Merker „Speaker-Verknüpfung veraltet“ (unten) gesetzt, holt sie in jedem Takt das Detail, bis es gelingt. Ohne Kontext (`!ctx`, `:806-813`) bleibt der heutige Weg; dort zählt „fällig“ wie der Merker.
- **Detail:** Gelingt es, ersetzt die Abfrage im Kontext `detailSpeakerIds`, `firstStartMs` und `category` (`sideKontext`, `:326-333`), also den ganzen Detail-Anteil aus einem Stand (0.1 Nr. 2). Startzeit-Anker (`mapper.ts:206`) und Kategorie (`mapper.ts:207`) des Side Events können sich dadurch ändern; geschrieben und RELOAD nur, wenn die Signatur abweicht (`:864-871`). Scheitert es, bleibt der alte Kontext, und der Kern setzt im Speicher den Merker `detailVeraltetSeit` (nicht Teil der Signatur, Vorbild `seListeVeraltetSeit`, `:845-847`). `statusNachAbfrage` zeigt dann T50; eine Warnung kommt beim ersten Fehlschlag und bei jedem neuen Text ins Log (T3). Das Detail bricht die Abfrage nie ab. Der nächste gelungene Detail-Abruf löscht den Merker.
- **Speaker:** Gelingt die Liste, gelten die verknüpften Speaker (Detail und Agenda-Punkte, `:858`), ohne Verknüpfung die ganze Event-Liste (`:859`; OF2). Die Namen für „Verantwortlich“ kommen aus der frischen Liste: Der Kontext bekommt `speakerNames = [...speakerNameMap(alle)]`, bevor der Ablauf gebaut wird (`:825`). Der Merker entfällt.
- **Fehlschlag** der Liste: siehe 6.5.
- Die Bedingung `:856` `if (merker && alle)` wird zu `if (alle)`; damit gilt die Regel für Merker und Auffrischen gleich.
- Bei gleicher Signatur und gelungener Speakerliste kommt wie im Listen-Modus T2 ins Log.

### 6.4 Umschalten (`umschaltenJetzt`, `:976-1094`)

- Unverändert in der Sache: Mit Verknüpfung holt es die Liste (danach rückt `speakerAbgerufen` vor), ohne Verknüpfung nicht.
- Ohne Verknüpfung und ohne Merker lautet die Antwort T4 statt `:951`. Mit Merker bleibt `:1017`. T4 nennt keine feste Frist: Scheitert die Agenda des Side Events, kommt auch keine Auffrischung (`:799`, `:695-697`).
- Die Tagesübersicht holt den Snapshot wie heute; danach rückt `speakerAbgerufen` vor (6.1).

### 6.5 Fehlerverhalten

- Listen-Modus: Scheitert die Speakerliste im Snapshot, gilt `standOhneSpeakerliste` (`:557-565`) wie heute: Speaker und „Verantwortlich“ aus der Datei, Merker gesetzt oder behalten, Status mit dem Text aus 2b-Spec 6.3, einmal schreiben und RELOAD.
- Agenda-Modus mit Kontext: Scheitert die Liste beim Auffrischen, bleibt die Liste der Datei, und der Merker wird gesetzt (`merker = a.speakerVeraltetSeit ?? jetzt`). Heute kann dieser Fall nur mit schon gesetztem Merker eintreten; neu setzt ihn auch der erste Fehlschlag des Auffrischens. Er schreibt die Show einmal (der Merker ist Teil der Signatur), schickt RELOAD, und der Titler zeigt H7.
- Solange der Merker gilt, holt jede Abfrage die Liste (heutiges Verhalten, `:711`, `:814-821`), unabhängig von „fällig“.
- `statusNachAbfrage` (`:419-436`) bleibt die einzige Quelle der Statuszeile. Sie kennt danach vier Merker: `speakerVeraltetSeit` (Text aus 2b-Spec 6.3), `seListeVeraltetSeit` (2b R2), neu `detailVeraltetSeit` (T50, 6.3) und `orgFehlenSeit` (T51, 5.10). Gelten mehrere, stehen die Texte wie heute durch „; “ getrennt, „seit“ = der früheste.
- **Jede Stelle, die eine `AktiveShow` baut, kennt die neuen Felder** (Lehre „Konstruktoren greppen, nicht Leser“). Es gibt zwei: `setzeAuf` (`:639-651`) und `offeneShowGespeichert` (`:1122-1128`, über `setzeAuf`). Die Felder `speakerAbgerufen` (6.1), `detailVeraltetSeit` und `orgFehlenSeit` liegen nur im Speicher wie `seListeVeraltetSeit` und reisen beim Speichern der offenen Show auf demselben Weg mit: `speakerAbgerufen` und `orgFehlenSeit` bei gleichem Event und ohne Neubinden, `detailVeraltetSeit` nur bei gleichem Side Event (wie `:1120-1122`). Die Bedingung `:653` (`if (merker || seMerker)`) prüft alle Merker im Speicher, damit die Statuszeile nach dem Speichern sofort stimmt und nicht bis zur nächsten Abfrage „in Ordnung“ zeigt. Umschalten auf ein anderes Side Event oder auf die Tagesübersicht löscht `detailVeraltetSeit`: Das Umschalten setzt den Kontext neu (`:1071`); fehlt dabei das Detail, geht die nächste Abfrage den Weg ohne Kontext, und dort bricht ein Detail-Fehler die Abfrage sichtbar ab (`:806-809`, `:695-697`). Test 12.2 Nr. 10.

### 6.6 Schreiben und RELOAD

Nur über die Signatur (`:745`, `:865`). Eine Auffrischung ohne Änderung schreibt nichts und schickt kein RELOAD. Jede echte Änderung (Name, Funktion, Organisationen, Reihenfolge, Verknüpfung, „Verantwortlich“) schreibt einmal und schickt RELOAD an Timer, Titler und Rundown; Timer und Rundown lesen dabei ohne Positionsverlust neu (Kennungen aus 2a).

### 6.7 Last bei iveo

Annahmen für COP31: Speakerliste 2 Seiten (239 Speaker, `limit=200`), Programme 1 Seite (67 Programme über alle Tage, Messdatei), `n` Side Events in der Ablage-Menge (9.3). Gemessen (M5, 17.10.2026, 12.11): 67 Programme mit den Typ-Slugs `program` 62, `invite_only` 4 und `open` 1; einen Typ „Side Event“ gibt es nicht, und die Ablage-Menge filtert ohnehin nicht nach Typ (9.3). Je Tag sind es höchstens 8 (alle Typen zusammen), dazu 4 ohne Tag, keine Blocker. Einträge ohne bekannten Tag zählen nach 9.3 an jedem Tag mit (**Annahme**: auch der Cache kennt für diese 4 keinen Tag); mit Tagesgrenze ist also n ≤ 12. Die frühere Annahme n ≤ 30 bleibt als Obergrenze stehen, über der eine Owner-Frage käme; sie wird nicht erreicht. Ohne Tagesgrenze (Listen-Modus „alle“, OF7) ist n bis 67.

| Abruf | heute je Stunde | neu je Stunde |
| --- | --- | --- |
| Listen-Modus, Grundtakt (`updated_since`) | 80 | 80 |
| Listen-Modus, Auffrischen (Event, Programme, 2 × Speaker, Organisationen, Bühnen = 6 Abrufe, 13,3-mal) | 0 | 80 |
| Agenda-Modus, Grundtakt (Agenda + `updated_since` der Side-Event-Liste) | 160 | 160 |
| Agenda-Modus, Auffrischen (2 × Speaker + Detail = 3, 13,3-mal) | 0 | 40 |
| Agenda-Modus, Merker „Speaker-Verknüpfung veraltet“ (Detail je Takt, nur im Fehlerfall) | 0 | bis 80 |
| Teil D: aufgeklappte Anhang-Liste (nur solange offen, nicht das aktive Side Event) | 0 | bis 80 |
| Teil E: Runden über die übrigen Side Events (n Abrufe, 13,3-mal) | 0 | 13,3 · n (n = 12, gemessen: 160; n = 30: 400; n = 67: 890) |
| Teil E: Downloads | 0 | nur neue oder geänderte Dateien, wiederholt scheiternde zurückgehalten (9.6) |

Summen bei n = 12 (gemessen, M5) im Normalfall (ohne Fehler-Merker): **Listen-Modus** 80 + 80 + bis 80 + 160 = bis 400 je Stunde; **Agenda-Modus** 160 + 40 + bis 80 + 160 = bis 440 je Stunde (rund 0,12 je Sekunde). Bei der Obergrenze n = 30 wären es bis 640 bzw. bis 680 je Stunde (unter 0,2 je Sekunde), bei n = 67 ohne Tagesgrenze bis rund 1 170 je Stunde (0,33 je Sekunde). Innerhalb des Ordner-Teils laufen alle Abrufe nacheinander; daneben laufen aus dem Takt nur dessen Abrufe (Kern und Anhang-Wächter), aus Takt und Ablage also höchstens zwei gleichzeitig; Bedienaktionen (Umschalten, Aufklappen, manueller Download) kommen dazu (E28). Antwortet iveo mit 429, wartet der Client nach `Retry-After` (`packages/iveo/src/client.ts:164-167`). Ein Limit von iveo ist nicht bekannt (**Annahme**: unkritisch).

---

## 7 · Teil C · Standard-URL Production

### 7.1 Wo der Standard steht

- `packages/iveo/src/client.ts:26`: `IVEO_DEFAULT_BASE_URL = 'https://app.my-iveo.de/api/v1'`; Kommentar `:25` „Production ist der Standard (Owner 16.10.2026, I5); Staging ist veraltet.“
- Damit gilt der neue Standard überall, wo heute der alte gilt: `normalizeIveoBaseUrl('')` (`client.ts:35`), `resolveIveoBaseUrl` (`settings.ts:175`), `baseUrlStandard` des Kerns (`iveo-sync.ts:435`), `merkeOffeneShow` (`:452`), `offeneBaseUrl` (`:625`), Discover und Binden (`:236`, `:253`).
- Texte: T5–T8; Kommentare `client.ts:25`, `:72`, `settings.ts:14`, `:173`, `packages/show/src/index.ts:97` („Default = Production“) und `apps/launcher/src/shared/types.ts:56` („leer = Standard (Production)“). `client.ts:294` nennt Staging nur als Fundort eines früheren Fehlers und bleibt.

### 7.2 Gespeicherte Adresse

- Wirksam bleibt: Umgebungsvariable `JMPS_IVEO_BASE_URL`, sonst die eingetragene Adresse, sonst der Standard (`settings.ts:174-176`). Eine eingetragene Staging-Adresse gilt also weiter.
- **Befund (am Code gelesen, nicht im Programm beobachtet):** Das Einstellungsfenster wird beim Start des Launchers eingehängt (`apps/launcher/src/renderer/src/App.tsx:64`), wenn `settings` noch `null` ist (`apps/launcher/src/renderer/src/store/tools.ts:192`, geladen erst in `:297-302`). `useState(settings?.iveoBaseUrl ?? '')` (`SettingsModal.tsx:16`) startet deshalb immer leer und bleibt leer. „Speichern“ schickt den leeren Wert (`:117`), und `settings.ts:355-356` löscht damit eine eingetragene Adresse. Eine eingetragene Adresse überlebt heute also nur, solange niemand die Einstellungen erneut speichert.
- **Neu:** `SuiteSettingsView` bekommt `iveoBaseUrlEingetragen: string | null` (der gespeicherte Wert, nicht der wirksame). `SettingsModal` füllt das Feld bei jedem Öffnen (`useEffect` auf `open`) mit diesem Wert, sonst leer. Unter dem Feld steht T9 „Standard für neue Bindungen und Shows ohne Adresse: ‹URL›“, aus `settings.iveoBaseUrl` (Umgebungsvariable, sonst eingetragen, sonst Standard). Der Text sagt bewusst nicht „wirksam“: Eine offene Show mit eigener `baseUrl` fragt ihre eigene Adresse ab (`iveo-abgleich-kern.ts:642`, `iveo-sync.ts:452`), und nach E16 hat das jede neu gebundene Show.
- Dasselbe Muster bei Proxy-, Katalog-URL und GitHub-Token ist ein Folgepunkt (FP8), nicht Teil dieses Pakets.

### 7.3 Bestehende Shows

| Show | Nach dem Update |
| --- | --- |
| mit `iveo.baseUrl` (jede Show, die der Kern einmal geschrieben hat, `iveo-abgleich-kern.ts:595`) | unverändert dieselbe Adresse |
| ohne `iveo.baseUrl` (gebunden mit leerem Feld, seitdem nie vom Kern geschrieben) | die Standardadresse dieses Rechners (ohne Eintrag: Production). War sie gegen Staging gebunden, passt das Token nicht. Welche Statuszeile dann erscheint, ist nicht gemessen (**Annahme**): bei HTTP 401 „Token ungültig oder widerrufen“ (`iveo-abgleich-kern.ts:105`), bei HTTP 404 „Event nicht gefunden oder außerhalb des Token-Scopes (404).“ (`:201`; `packages/iveo/src/client.ts:97-103`). Abhilfe im Show-Editor: Show bearbeiten, Adresse eintragen und neu binden (das Feld zeigt danach die gespeicherte Adresse, 7.4). Steht mit beiden möglichen Texten in den Release-Notes. |

### 7.4 Binden schreibt die Adresse

- `IveoBindResult` (`apps/launcher/src/shared/types.ts:231-253`) bekommt `baseUrl?: string`: die beim Binden genutzte, normalisierte Adresse (`iveo-sync.ts:253`, über `normalizeIveoBaseUrl`).
- Neuer reiner Helfer `bindungsAdresse(resBaseUrl: string | undefined, feld: string): string | undefined` in `apps/launcher/src/renderer/src/lib/show-speichern.ts`: `resBaseUrl`, sonst das getrimmte Feld, sonst `undefined`. `ShowEditorModal.tsx:239-245` setzt `baseUrl: bindungsAdresse(res.baseUrl, iveoBaseUrl)`. Damit trägt jede neu gebundene Show ihre Adresse.
- **Bearbeiten einer bestehenden Show:** Neuer reiner Helfer `editorAdresseAusShow(show: Show): string` (gleiche Datei): `show.iveo?.baseUrl ?? ''`. `loadForEdit` (`ShowEditorModal.tsx:322-352`) setzt nach `resetForm()` (`:326`, das das Feld leert, `:298`) `setIveoBaseUrl(editorAdresseAusShow(show))`. Ohne das bänden „Events laden“ und jeder Filter- oder Tageswechsel (`:519`, `:534`, `:554`, `:615`) mit leerem Feld, also mit der Standardadresse dieses Rechners (`iveo-sync.ts:236`, `:253`), und E16 schriebe sie fest. Der Token-Effekt (`:123`) fragt danach den Basis-Token der Show-Adresse ab.
- Tests: 12.6 Nr. 2 und Nr. 3 mit Gegenprobe.

### 7.5 Token-Schlüssel `base:‹URL›`

- Unverändert (`settings.ts:240-242`). Mit leerem Feld fragt der Show-Editor das Token der Standardadresse dieses Rechners ab (`ShowEditorModal.tsx:123` über `getIveoBaseToken`, `settings.ts:251`, das über `resolveIveoBaseUrl` auflöst); ohne eingetragene Adresse und ohne Umgebungsvariable ist das `base:https://app.my-iveo.de/api/v1`. Wer COP31 mit eingetragener Production-Adresse gebunden hat, hat dort schon ein Token (`iveo-sync.ts:322`) und sieht „Token gemerkt“.
- Tokens unter `base:https://staging-dev.my-iveo.de/api/v1` bleiben liegen und gelten weiter für Shows mit Staging-Adresse.
- Bekannte Grenze, nicht neu: Event-Tokens sind nur nach Slug geschlüsselt (`settings.ts:185-206`); ein gleichnamiger Slug auf Staging und Production teilt sich einen Platz (FP9).

---

## 8 · Teil D · Anhänge nachladen (#264)

### 8.1 Renderer

- **Aufklapp-Zustand im Store:** Der lokale Zustand `openMat` (`SideEventsPanel.tsx:39`) wandert als `materialsOffen: string | null` in den Store (`tools.ts`). Grund: Das Panel ist immer eingehängt (`App.tsx:74`) und gibt geschlossen nur `null` zurück (`SideEventsPanel.tsx:41`), der lokale Zustand überlebt also Schließen und Wiederöffnen; mit dem Leeren unten stünde sonst nach dem Wiederöffnen dauerhaft „Lade Anhänge…“, ohne dass ein Abruf läuft.
- **Reiner Helfer** `apps/launcher/src/renderer/src/lib/anhang-liste.ts` (ohne React, getestet in 12.3 Nr. 9): `anhangListeSchritt(zustand, ereignis)` mit den Ereignissen `aufklappen(id)`, `zuklappen`, `panelZu`, `eventWechsel`, `aktivWechsel(id)`, `ergebnis(id, abgerufen, …)`. Der Zustand trägt neben `materialsOffen` die Kennung des aktiven Side Events (`aktiv`, aus `activeProgramId`); beobachtet ist eine Liste, wenn sie `materialsOffen` oder `aktiv` ist (2 Begriffe). Er entscheidet: Aufklappen lädt **immer** (kein „nur ohne Liste“) und meldet die Beobachtung; Zuklappen meldet `[]`; `panelZu` und `eventWechsel` leeren Listen und Fehler und setzen `materialsOffen` auf `null`; `aktivWechsel(id)` setzt `aktiv` auf die neue Kennung (`null` in der Tagesübersicht) und leert Liste, Stand und Fehler des bisher aktiven, wenn es nicht aufgeklappt ist (sonst bliebe dort eine Zahl ohne Beobachtung stehen, L7); ein Ergebnis mit älterem `abgerufen` als dem gespeicherten wird verworfen (Abruf und Wächter können sich kreuzen); ein Ergebnis für eine nicht beobachtete Liste wird verworfen, nach einem Wechsel also auch eines für das bisher aktive. Store und Panel rufen nur diesen Helfer.
- `toggleMaterials` (`SideEventsPanel.tsx:60-67`) ruft den Helfer: Aufklappen → `void loadMaterials(programId)` ohne Bedingung und `watchIveoMaterials({programIds: [programId]})`; Zuklappen → `watchIveoMaterials({programIds: []})`.
- `loadMaterials` (`tools.ts:427-458`) setzt vor dem Abruf `materials[programId]` auf `undefined` (Anzeige T10) und nach dem Abruf Liste und `abgerufen`.
- `closeSideEvents` (`tools.ts:409`) leert `materials`, `materialsError`, setzt `materialsOffen` auf `null` und meldet `[]` an den Main. `iveo-active-changed` (`:264-271`) tut dasselbe, wenn sich `event` ändert, und ruft danach, auch bei gleichem `event`, den Helfer mit `aktivWechsel(activeProgramId)`, wenn sich die Kennung geändert hat (Umschalten auf ein anderes Side Event oder die Tagesübersicht). Ohne dieses Ereignis bliebe im Helfer die alte Kennung stehen, er verwürfe die erste Meldung des neuen aktiven Side Events, und L6 erschiene erst nach der nächsten Anmeldung.
- `openSideEvents` (`tools.ts:405-407`) ruft zusätzlich `watchIveoMaterials({programIds: []})`; der Main antwortet auf **jede** Anmeldung, indem er für jede beobachtete Liste, deren Stand er kennt (auch das aktive Side Event), das Ereignis 8.4 erneut sendet. So steht die Zahl am 📎 des aktiven Side Events nach dem Wiederöffnen sofort wieder da (L6), statt bis zur nächsten Änderung zu fehlen.
- Die Zahl am 📎 (`SideEventsPanel.tsx:189`) steht nur an beobachteten Listen mit bekanntem Stand (aufgeklappt oder aktives Side Event, 2 Begriffe); sonst 📎 ohne Zahl.
- Unter einer aufgeklappten Liste steht „Stand ‹hh:mm›“ (T13) = Zeit der letzten gelungenen Prüfung (8.4); bei einem gescheiterten Nachladen T14, die Liste bleibt mit ihrem Stand stehen.

### 8.2 Anhang-Wächter (Main)

Neues Modul `apps/launcher/src/main/iveo-anhaenge.ts`, ohne Electron, mit Abhängigkeiten von außen:

- `materialienAusAgenda(agenda: IveoAgendaItem[]): IveoMaterialRef[]` — die Abbildung aus `iveo-sync.ts:639-653`, dorthin verschoben; sie lässt Anhänge mit gesetztem `purged_at` weg (8.5). `listSideEventMaterials` nutzt sie.
- `erzeugeAnhangWaechter(d)` mit `beobachte(programIds)`, `agendaVomKern(programId, ergebnis)`, `takt(client)`, `zuruecksetzen()`.
- **Beobachtet:** die vom Renderer gemeldete Liste und das aktive Side Event (`kern().aktiv()?.filter.programId`).
- **Aktives Side Event:** keine eigene Abfrage. Der Kern meldet über die neue optionale Abhängigkeit `meldeAgenda?(programId, ergebnis: {ok: true; agenda; abgerufen} | {ok: false; fehler})` die Agenda seiner Agenda-Abfrage **direkt nach** dem Abruf in `iveo-abgleich-kern.ts:799`, wenn die Abfrage zu diesem Zeitpunkt noch gilt (`istAktuell(a, gen)`). So kommt sie auch an, wenn ein späterer Abruf derselben Abfrage wirft (Detail ohne Kontext `:809`, Speakerliste ohne Kontext `:812`, Detail bei leerer Agenda `:833`); am 15.10. scheiterte die Speakerliste auf Prod eine Stunde lang mit HTTP 500. Scheitert der Abruf in `:799`, meldet der Kern `{ok: false, fehler}` und wirft weiter wie bisher. Im Listen-Modus gibt es kein aktives Side Event.
- **Aufgeklappte Liste:** Ist sie nicht das aktive Side Event, holt `takt` ihre Agenda (Client mit 15-s-Zeitgrenze, `iveo-sync.ts:225-231`).
- **Takt der Hülle:** Der Intervall-Rückruf (`iveo-sync.ts:489-491`) wird zu einer async-Funktion mit Sperre gegen Überholen: erst `await kern().abfrage()`, dann `await anhangWaechter.takt(...)`, dann `ordner.takt()` (9.4). `ordner.takt()` stößt nur an und kehrt sofort zurück; der Ordner-Teil arbeitet seine Warteschlange danach im Hintergrund ab und überlappt mit späteren Takten. Innerhalb des Ordner-Teils läuft immer nur ein Abruf oder Download; aus Takt und Ablage sind es also höchstens zwei Abrufe gegen iveo gleichzeitig. Bedienaktionen kommen dazu: Umschalten (wartet nie auf eine Abfrage, `iveo-abgleich-kern.ts:1096`), Aufklappen (`loadMaterials` → `iveo-sync.ts:629-660`) und manueller Download (`:663-704`) (E28).
- Show geöffnet, gewechselt, geschlossen oder gespeichert mit neuer Bindung → `zuruecksetzen()`.

### 8.3 Materialsignatur

Je `programId` ein JSON-String, gebildet aus der Agenda (gelöschte Anhänge ausgelassen, iveo-Reihenfolge), je Anhang `[item.id, m.id, m.kind, m.label, m.sort_order ?? null, m.asset?.mime_type ?? null, m.asset?.size_bytes ?? null, m.external_url ?? null, refHash]` (`item` = Agenda-Punkt, `m` = Anhang); `refHash` = SHA-256 (hex, `node:crypto`) der Asset-Referenz `m.asset.url`, wenn sie ein nicht leerer String ist, sonst `null` (M1, unten). **Nicht** enthalten: die Referenz selbst (E20). Eine neue Reihenfolge in iveo zählt als Änderung. Die Funktion `materialSignatur(agenda)` und der Helfer `referenzHash(m)` liegen im selben Modul wie `materialienAusAgenda`; die Inhaltssignatur des Ordners (9.5, 9.8) nimmt denselben Helfer.

**Messaufgabe M1** (erledigt am 17.10.2026; Prod, Event `cop31-gcp`, Owner-Freigabe OF6; Prüfskript nur lesend, ohne Asset-Abruf, Ausgabe nur Formen, Längen und Gleichheit, nie der Wert). Auftrag war: Side Events mit Datei-Anhang zweimal im Abstand von mindestens 10 min abrufen und je `materials[].asset.url` Form, Herkunft, Länge und Gleichheit ausgeben.

**Ergebnis:**
- 4 Datei-Anhänge im ganzen Event, alle in einem Programm vom Typ `program`, alle mit `mime_type` und `size_bytes`.
- Form: keine Adresse und keine UUID, sondern eine nackte signierte Referenz mit 279 Zeichen und genau einem Punkt. Vor dem Punkt 235 Zeichen base64url, ein JSON-Array aus drei Strings (16 Zeichen base64url-artig, 114 Zeichen, eine UUID mit 36 Zeichen); nach dem Punkt 43 Zeichen base64url, 32 Byte in der Form einer HMAC-SHA-256-Signatur. Kein Teil ist datumsartig oder eine Zahl; eine Ablaufzeit ist nicht erkennbar.
- Zweiter Abruf nach 10,5 min: Referenz, `mime_type`, `size_bytes` und `updated_at` des Agenda-Punkts bei allen vier gleich.
- Herkunft: `resolveAssetUrl` macht daraus `‹Basis-URL›/assets/‹Referenz›` (`packages/iveo/src/client.ts:353-354`); das Token geht also an die Herkunft der Basis-URL. Der fremde Fall aus E52 kommt in den Prod-Daten nicht vor, die Regel bleibt als Schutz.

**Folge** nach der vorab festgelegten Regel („gleich und keine Signatur-Parameter → SHA-256 in die Signatur; sonst ohne Referenz, Risiko 3“): Die Referenz trägt zwar eine Signatur, aber keine zeitabhängigen Teile, und sie war beim zweiten Abruf gleich; gemeint waren Parameter, die je Abruf wechseln. Es gilt also der erste Fall: Materialsignatur und Inhaltssignatur des Ordners (9.5, Index-Feld `inhalt` 9.8) nehmen den SHA-256 der Referenz auf, nie die Referenz selbst. Damit erkennt der Launcher eine ersetzte Datei gleicher Größe, sofern iveo dabei eine neue Referenz vergibt (M4 in der Abnahme, Risiko 3). Restrisiko: Rotiert iveo den Signaturschlüssel oder ändert sich der 16-Zeichen-Teil periodisch (in 10,5 min nicht beobachtet), gelten alle Datei-Anhänge einmal als geändert (Risiko 22).

### 8.4 Ereignis an den Renderer

Neu in `AppEvent` (`apps/launcher/src/shared/types.ts:344-361`):

```ts
| { type: 'iveo-anhaenge'; programId: string; abgerufen: string;
    ok: boolean; materials?: IveoMaterialRef[]; error?: string }
```

- `abgerufen` = Zeit der letzten **gelungenen** Prüfung dieser Liste (auch bei `ok: false`: dann die Zeit der letzten gelungenen davor).
- Gesendet:
  1. nach jeder gelungenen Prüfung, mit `ok: true`; `materials` nur bei der ersten Beobachtung, bei einer Änderung der Materialsignatur und beim Wechsel von „gescheitert“ auf „gelungen“, sonst ohne `materials` (nur die neue Zeit);
  2. beim Wechsel von „gelungen“ auf „gescheitert“ und bei jedem neuen Fehlertext, mit `ok: false` und `error`;
  3. als Antwort auf jede Anmeldung über `iveo:watchMaterials` für jede beobachtete Liste mit bekanntem Stand (8.1), mit `materials`.
  Bei einem wiederholten gleichen Fehler kommt kein Ereignis. Je beobachteter Liste ist das höchstens ein kleines Ereignis je Takt.
- Der Renderer übernimmt `abgerufen`, `materials` bzw. `error` für diese `programId`, wenn die Liste beobachtet ist; sonst verwirft er es (Helfer 8.1). Ein `ok: true` löscht einen gespeicherten Fehler dieser Liste.
- Log (Info) bei einer Änderung nach der ersten Beobachtung: T17.

### 8.5 `purged_at`

- `IveoMaterial` bekommt `purged_at?: unknown` (`packages/iveo/src/types.ts:121-129`). Auf Prod war das Feld vorhanden, aber nie gesetzt (Messdatei: Typ `null`, 0-mal gesetzt); welchen Typ ein gesetzter Wert hat, ist unbekannt. **Annahme:** Gelöscht = jeder Wert außer `null`, fehlend, `false` und Leerstring (also auch eine Zahl, `true` oder ein Datum-String). Helfer `istGeloescht(m)` im neuen Modul `iveo-anhaenge.ts`.
- Gelöschte Anhänge fehlen in der Liste (8.2), lassen sich nicht laden (`downloadSideEventMaterial`, `iveo-sync.ts:671-679`: T15) und wandern im Ordner nach `entfernt/` (9.10).
- Fehlt der Anhang beim Herunterladen ganz: T16 statt „Material nicht gefunden.“ (`:679`).
- **Laufzeitprüfung der Anhang-Felder** (wie bei den Organisationen, 5.1): Ein Anhang ist gültig, wenn `id` ein nicht leerer String ist und `kind` `'file'` oder `'link'`. `size_bytes` zählt nur als endliche Zahl ≥ 0, sonst als „unbekannt“. Ein ungültiger Anhang erscheint in der Liste nicht und im Ordner als Problem „ungültiger Anhang in iveo (‹Feld›)“ (T22). Dieselbe Kennung an zwei Agenda-Punkten: Es gilt das erste Vorkommen in iveo-Reihenfolge, die weiteren entfallen ohne Fehler. Die Prod-Basis sind nur 4 Anhänge (Messdatei).

### 8.6 Typen und IPC

| Was | Wo | Neu |
| --- | --- | --- |
| `IveoMaterial.purged_at` | `packages/iveo/src/types.ts` | 8.5 |
| `IveoMaterialsResult.abgerufen?: string` | `apps/launcher/src/shared/types.ts:210-214` | ISO-Zeit des Abrufs |
| IPC `iveo:watchMaterials` (`{programIds: string[]}` → `void`) | `apps/launcher/src/main/ipc.ts` bei `:173`; Preload `apps/launcher/src/preload/index.ts` bei `:81` als `watchIveoMaterials`; Typ im Interface `JmpsApi` (`apps/launcher/src/shared/types.ts:364`), mit dem der Preload typisiert ist (`preload/index.ts:20`) | höchstens 8 Kennungen, je höchstens 200 Zeichen, sonst verworfen; jede Anmeldung löst 8.4 Nr. 3 aus |
| `AppEvent` `iveo-anhaenge` | `shared/types.ts` | 8.4 |
| `KernAbhaengigkeiten.meldeAgenda`, `.taktMs` | `iveo-abgleich-kern.ts:55-87` | 8.2, 6.1 |
| Speichern-Dialog | `iveo-sync.ts:694` | Titel T18, Vorschlagsname aus `panelAnhangSchritt` (unten) |

**Manueller Download und Öffnen im Panel** (`iveo-sync.ts:663-704`), fünf Änderungen, sonst unverändert. Alle Entscheidungen trifft ein reiner Helfer in `side-event-ordner.ts` (9.15, getestet in 12.4 Nr. 19 und 48); `downloadSideEventMaterial` führt nur noch aus (Agenda holen, Dialog, Abruf, `shell.openExternal`, `shell.openPath`). Grund: Die Verdrahtung lädt Electron (`iveo-sync.ts:22`: `app`, `dialog`, `shell`) und ist im Selbsttest nicht erreichbar.
- **Helfer:** `panelAnhangSchritt(m: IveoMaterial)` → `{art: 'link', href}` | `{art: 'datei', vorschlag, gesperrt: string | null}` | `{art: 'fehler', text}`, in dieser Reihenfolge: gelöscht (8.5) → T15; Link (Kind `link` oder ohne Asset mit `external_url`, wie `:681`) ohne `external_url` → „Kein Link vorhanden.“ wie heute (`:682`), sonst `pruefeLink` (9.7), ungültig → T53; Datei ohne Asset → T54; sonst `datei` mit dem Vorschlagsnamen und der gesperrten Endung aus dem Label (oder `null`). Den Wert von `asset.url` gibt der Helfer nie heraus; die Verdrahtung reicht ihn nur an `oeffneAsset`. Dazu `panelDateiOeffnen(gewaehlterName, gesperrt)` → `boolean`: wahr nur, wenn `gesperrt` `null` ist und die letzte Endung des im Dialog gewählten Namens (Text nach dem letzten Punkt, Kleinschreibung) nicht auf der Sperrliste aus 9.12 Regel 9 steht.
- **Link öffnen:** Heute geht `external_url` ungeprüft an `shell.openExternal` (`:681-683`), also mit jedem Schema (`file:`, `smb:`, `search-ms:`, `ms-…`). Neu entscheidet `panelAnhangSchritt` mit demselben reinen Helfer wie in 9.7 (`pruefeLink(roh)`: ohne Steuerzeichen, `http:` oder `https:`, `href` höchstens 2048 Zeichen); geöffnet wird `href`. Sonst Notice T53, kein Aufruf. Das Panel zeigt das Ziel nicht (`SideEventsPanel.tsx:236`), deshalb gilt dieselbe Regel wie im Ordner.
- **Dateiname:** Heute ersetzt der Vorschlag nur neun Zeichen und übernimmt jede Endung aus dem Label (`:692-694`, `extFor` `:618-621`). Neu entsteht er mit derselben Namensfunktion wie im Ordner: 9.12 Regeln 1–9 samt Sperrliste und die Namensgrenzen aus Regel 10 (120 Codepunkte, 240 Bytes), ohne Pfadbudget, weil der Bediener den Ordner wählt. „Agenda.exe“ mit `application/pdf` heißt damit im Panel wie im Ordner „Agenda_exe.pdf“. Der Dialog kommt **vor** dem Abruf, sonst liefe während des Dialogs die Leerlauf-Grenze (9.6). Die Endung kommt deshalb nur aus dem Label oder aus `asset.mime_type`; der Rückfall auf den `Content-Type` der Antwort (heute `:692`, `?? contentType`) entfällt, wie im Ordner (9.12 Regel 9). Auf Prod trugen alle 4 Datei-Anhänge `asset.mime_type` (Messdatei); fehlen Endung im Label und `mime_type`, schlägt der Dialog einen Namen ohne Endung vor, und der Bediener trägt sie ein.
- **Öffnen nach dem Speichern:** Heute öffnet `shell.openPath` jede gespeicherte Datei sofort (`:697`). Neu nur, wenn `panelDateiOeffnen` wahr ist; sonst bleibt die Datei gespeichert und ungeöffnet, Notice T74 statt T20. Grund: Ohne Prüfung startete ein Anhang „Agenda.exe“ sofort, ohne Doppelklick (0.1 Nr. 16). Geprüft wird auch der im Dialog gewählte Name, denn der Bediener kann den Vorschlag zurückbenennen; speichern darf er so, geöffnet wird es nicht.
- **Datei laden:** Statt `fetchAsset` und `arrayBuffer()` (`:691`, `client.ts:369`), das bis 2 GiB in den Main-Speicher lädt, streamt der Download über `oeffneAsset` (9.6) in eine Zwischendatei `‹Ziel›.‹pid›.jm-laden` neben dem gewählten Ziel und benennt sie danach um; Client ohne Zeitgrenze wie heute (`:688-690`), Leerlauf-Grenze 60 s wie 9.6. Das Token geht nur an die Herkunft der Basis-URL (E52): Die Verdrahtung prüft `asset.url` **vor** dem Dialog mit `assetAnfrage` (9.6); lehnt die Regel die Adresse ab, kommt Notice T77 (b), ohne Dialog und ohne Abruf.
- **Texte:** „Kein Datei-Asset vorhanden.“ (`:686`) → T54; Logzeilen „Material(ien)“ (`:654`) und `Material „…" gespeichert` (`:698`, heute mit ASCII-Schlusszeichen) → T55, T56.

---

## 9 · Teil E · Side-Event-Ordner (#265)

### 9.1 Ort und Namen

- **Basisordner:** neben der `.jmshow`, Name `‹Stamm› – Side Events`, ‹Stamm› = Dateiname der Show ohne `.jmshow` (OF3), Trenner U+0020 U+2013 U+0020. Beispiel: `D:\Shows\COP31 Tag 1.jmshow` → `D:\Shows\COP31 Tag 1 – Side Events\`.
- **Side-Event-Ordner:** darin je Side Event der Ablage-Menge (9.3) ein Ordner, Name = Titel des Side Events nach 9.12. Woher der Titel kommt, in dieser Reihenfolge: Liste der Bindung in der Datei, Programme im iveo-Cache (`meta.programs`, dieselbe Quelle wie das Panel, `apps/launcher/src/main/iveo-sync.ts:568-575`), sonst die `programId`. Grund: Das aktive Side Event kann außerhalb der Liste liegen, und `kern().aktiv()` liefert nur Pfad, Event und Filter (`iveo-abgleich-kern.ts:1139-1141`). Gleiche Titel → „ (2)“, „ (3)“.
- Beide entstehen erst, wenn ein Side Event mindestens einen nicht gelöschten Anhang hat (OF4).
- **Wiederfinden**, beim ersten Zugriff je Sitzung und nach jedem Neustart, in dieser Reihenfolge:
  1. Der Unterordner des Basisordners, dessen Indexdatei gültig ist (9.8) und diese `programId` trägt.
  2. Gibt es keinen: der Unterordner mit genau dem Namen, den das Side Event nach 9.12 bekäme (Vergleichsform, 9.9), wenn er **keine** oder eine ungültige Indexdatei hat. Er wird übernommen und sein Index nach 9.8 („kaputt“ bzw. „fehlt“) neu aufgebaut. Ein Ordner mit gültigem Index einer anderen `programId` wird nie so übernommen.
  3. Tragen mehrere Ordner dieselbe `programId` (etwa eine Explorer-Kopie mit Index), wird der gepflegt, dessen Name dem Index-Feld `ordnerName` entspricht, sonst der mit dem kleinsten Namen in Vergleichsform. Die anderen bleiben unberührt; die Zeile bekommt den Zusatz T66.
  Unter Windows ist `.jm-anhaenge.json` sichtbar (ein Punkt am Anfang versteckt eine Datei nur unter macOS). Das Handbuch sagt „Indexdatei nicht löschen“; fehlt sie trotzdem, greift Schritt 2 und nichts wird doppelt geladen, solange Name und Größe (bei Links Name und Inhalt) passen (9.5; dort auch die Grenze für Anhänge ohne gültiges `size_bytes`).
- **Titel geändert in iveo** (oder erst jetzt bekannt, weil der Ordner unter der `programId` angelegt wurde): Trägt der Ordner noch genau den Namen, der aus dem alten Titel entstand (Index-Feld `ordnerName`), benennt der Launcher ihn um, wenn der neue Name frei ist und kein Inhalt gesperrt ist. Scheitert das, bleibt der alte Name; Problem-Form „Ordner-Umbenennen wartet, Inhalt ist geöffnet“ (11.2), nächste Runde erneut. Hat der Bediener ihn umbenannt, bleibt sein Name.

### 9.2 Wer ablegt

Abgelegt wird nur, wenn alles gilt:
1. Eine Show ist offen und an iveo gebunden.
2. Für sie liegt auf diesem Rechner ein Token: `kern().aktiv() !== null` **und** `getIveoToken(a.event)` liefert einen Wert (`apps/launcher/src/main/settings.ts:209-224`), gelesen in jedem Takt. Grund: Fehlt das Token mitten in der Sitzung, bleibt die Show im Kern aktiv (`iveo-abgleich-kern.ts:685-689`, 4.5 Nr. 8). Der Lauf bekommt es als `tokenDa()` eingereicht (9.15); ein Wegfall bricht ab wie ein Rollenwechsel (9.4).
3. Die Verbund-Rolle ist nicht `slave` (neue Funktion `verbundRolle()` in `apps/launcher/src/main/verbund/index.ts`, aus `kern.rolle()`, `verbund/kern.ts:467`). Master und Einzelplatz (`aus`) legen ab. Die Hülle liest die Rolle in jedem Takt und vor jedem Schritt der Warteschlange; ein Wechsel bricht ab (9.4). Ein eigenes Ereignis für den Rollenwechsel gibt es nicht; `rolle()` ist nur ein Lesezugriff.
4. Der Schalter „Anhänge in Side-Event-Ordnern ablegen“ ist an (9.14, Vorgabe, OF8).
5. Die Show-Datei existiert am Öffnungspfad und ist lesbar (9.11).
6. Die Sperrdatei ist frei, eigen oder abgelaufen (Regeln unten); sie gehört weder einem anderen Rechner mit gültigem Lebenszeichen, noch hat ein zweiter Launcher gleichen Rechnernamens sie dieser Sitzung abgenommen.

Sonst ruft der Ordner-Teil iveo nicht ab und fasst kein Dateisystem an. Es gibt genau drei Ausnahmen, jede nur unter ihrer Bedingung (12.4 Nr. 27 zählt sie):
- Gelten Nr. 1–4: die Prüfung aus Nr. 5; gilt auch sie, das Lesen der Sperrdatei für Nr. 6.
- Gelten Nr. 1–3 und ist der Schalter aus (K3): eine Existenzprüfung des Basisordners (`stat`; nichts anlegen, nichts lesen) für „Ordner öffnen“ in K3 (11.1, 9.13), höchstens eine je Takt und keine neue, solange die vorige noch aussteht.
- Endet die Ablage (unten): einmal Lesen, Vergleichen und Löschen der eigenen Sperrdatei.

Gilt Nr. 1, 2 oder 3 nicht (keine Show, kein Token, Rolle `slave`), bleibt also nur das einmalige Löschen am Ende der Ablage; sonst gibt es keinen Zugriff. Das Panel sagt den Grund (11.1).

**Sperrdatei** (E45): `.jm-ablage-sperre.json` im Basisordner, UTF-8, atomar geschrieben (9.8), Inhalt `{"format": 1, "rechner": ‹os.hostname()›, "pid": ‹process.pid›, "sitzung": ‹Zufallskennung je Sitzung›, "lebenszeichen": ‹ISO›}`. Der Launcher schreibt sie mit dem Anlegen des Basisordners und erneuert das Lebenszeichen in jedem Takt, solange er ablegt. Vor jedem Schreiben liest er sie und bewertet sie mit dem reinen Helfer `sperreBewerten(gelesen, ich, gehalten, jetzt)` (9.15): `ich` = Rechnername (`os.hostname()`, exakt verglichen) und `sitzung` dieser Sitzung, `gehalten` = diese Sitzung hat die Sperre schon geschrieben oder als eigen gelesen. Die erste zutreffende Regel gilt:
1. Keine Sperrdatei → **frei**: schreiben und ablegen.
2. Gleiche `sitzung` → **eigen**: Lebenszeichen erneuern.
3. Gleicher `rechner`, diese Sitzung hat sie noch nicht gehalten → **eigen aus einer früheren Sitzung** dieses Rechners (Neustart, Update, Absturz, Show neu geöffnet): sofort übernehmen, unabhängig vom Lebenszeichen. Grund: Ein Rechner startet keinen zweiten Launcher (4.5 Nr. 8; ein zweiter Benutzer fällt unter Regel 4); der Prozess, der sie schrieb, ist beendet oder hat die Show gewechselt. Eine Regel nur nach `sitzung` hätte die eigene Ablage nach jedem Neustart bis zu 15 Minuten angehalten und in K5 den eigenen Rechnernamen gezeigt (NP1).
4. Gleicher `rechner`, diese Sitzung hat sie schon gehalten → **namensgleich**: Ein zweiter Launcher mit demselben Rechnernamen hat sie übernommen, also ein anderer Benutzer an diesem Rechner (**Annahme**: die Einzelinstanz gilt je Benutzer) oder ein Rechner mit gleichem Namen, etwa aus demselben Abbild (vgl. „geklonter Rechner“ im Verbund, `apps/launcher/src/main/verbund/kern.ts:428-433`). Dieser Launcher hört auf (Lauf-Generation, 9.4), löscht die Sperre nicht und zeigt K5 mit T73, bis die Show neu geöffnet wird. Ab dem nächsten Takt des ersten Launchers legt so nur noch einer ab.
5. Anderer `rechner`, Lebenszeichen jünger als 15 Minuten (drei Runden) → **fremd**: nichts ablegen, K5 mit T57.
6. Anderer `rechner`, Lebenszeichen 15 Minuten oder älter → **abgelaufen**: übernehmen.

**Ende der Ablage:** Hört dieser Launcher auf abzulegen, weil Nr. 1–4 nicht mehr gelten oder die Sitzung endet (eine Show geöffnet, auch dieselbe; Rolle `slave`; Token weg; Schalter aus), oder wird er beendet, löscht er seine Sperrdatei, aber nur, wenn sie noch seine `sitzung` trägt (lesen, vergleichen, löschen). Auslöser in der Hülle: jedes Öffnen einer Show (`onShowOpened`, `iveo-sync.ts:500`; eine Show wird heute nur so ersetzt, `stopIveoPolling` `:512` hat keinen Aufrufer, 4.5 Nr. 8), die Prüfung der Bedingungen in jedem Takt und vor jedem Schritt (9.4) und `before-quit` (`apps/launcher/src/main/index.ts:94`), das zusätzlich `ablageBeenden()` der Hülle ruft. Beim Beenden wird das Löschen nur angestoßen und hält das Beenden nicht auf: Das Launcher-Update beendet die App 2 s nach dem Start des Installers, damit dessen Dateien frei sind (`apps/launcher/src/main/installer.ts:393-395`); ein Warten auf ein hängendes Netzlaufwerk verzögerte das. Ob das angestoßene Löschen vor dem Prozessende fertig wird, ist **Annahme** (auf einem erreichbaren Laufwerk ja), geprüft in Abnahme Schritt 20. Bleibt die Sperre liegen, übernimmt dieser Rechner sie beim nächsten Öffnen sofort (Regel 3), ein anderer nach 15 Minuten (Regel 6); bis dahin nennt dessen Kopfzeile T57 die Zeit der Übernahme. Scheitert das Löschen, steht T75 im Log; sichtbar wird die Folge auf dem anderen Rechner (T57). Fehlt nur die Show-Datei (Nr. 5), bleibt die Sperre liegen: Die Ablage läuft von selbst weiter, sobald die Datei wieder da ist (9.11); bleibt sie 15 Minuten weg, darf ein anderer Rechner übernehmen.

Grenzen, benannt: Legen zwei Rechner den Basisordner im selben Takt zum ersten Mal an, gewinnt der letzte Schreiber, der andere hört im nächsten Takt auf (Restfenster ein Takt). Zwei Launcher mit gleichem Rechnernamen legen bis zur Erkennung nach Regel 4 beide ab; das Aufräumen des übernehmenden (9.6) kann dabei die Zwischendatei des anderen löschen, dessen Download dann mit einem Fehler endet. In einem Cloud-Sync-Ordner kommt die Sperre nur verzögert an, und eine vom Sync-Dienst zurückgeholte ältere Fassung kann Regel 4 fälschlich auslösen (Risiko 6).

### 9.3 Welche Side Events (Ablage-Menge, OF7)

- Grundlage ist die Liste der Bindung, wie sie in der Datei steht (`show.iveo.sideEvents`, `packages/show/src/index.ts:118`), gelesen zu Beginn jeder Runde über den Leser der Hülle (`iveo-sync.ts:370`). Sie bleibt unverändert; der Rundown nutzt sie (`apps/rundown/src/main/index.ts:700`, `:715`).
- **Ablage-Tag:** `a.filter.day`, sonst der Tag des aktiven Side Events, sonst keiner. Den Tag eines Side Events liefert die Hülle als `tagVon(programId): string | null` aus dem iveo-Cache (`metaProgramDay`, wie das Panel, `iveo-sync.ts:561-575`).
- **Menge:** die Einträge der Liste, deren Tag der Ablage-Tag ist; ohne Ablage-Tag alle Einträge; ein Eintrag ohne bekannten Tag (nicht im Cache, kein Cache) zählt mit, lieber ein Ordner zu viel als eine stille Lücke. Dazu das aktive Side Event (`a.filter.programId`), auch wenn es nicht in der Liste steht.
- **Warum eine Tagesgrenze:** Im Agenda-Modus speichert der Show-Editor als Filter nur `{programId}` (`apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:231-232`). Der Kern bildet die Liste beim nächsten Zusatzabruf mit diesem Filter, also ohne Tag, Typ und Format (`iveo-abgleich-kern.ts:454`, `apps/launcher/src/main/iveo-side-events.ts:29-36`, `packages/iveo/src/mapper.ts:264-276`); nach der ersten Programmänderung stehen dann alle Programme des Events in der Datei, auf Prod 67 (Messdatei). Ohne Grenze lüde die Ablage Anhänge aller Tage. Die Ursache im Kern ist ein Folgepunkt (FP13).
- Ein Side Event, das aus der Menge fällt, bleibt mit seinem Ordner unberührt (S2, 11.2).
- Das Panel listet die Programme des gewählten Tags aus dem Cache, ohne Typ-, Format- oder Blockerfilter (`iveo-sync.ts:568-575`, Tagwahl `SideEventsPanel.tsx:119-134`). Ein Side Event dort, das nicht in der Menge ist, bekommt S1 oder S2; ein Side Event der Menge, das dort nicht steht, steht im Block „Weitere Side Events der Ablage“ (9.13).
- Ohne Tagesgrenze (Listen-Modus ohne Tag, „alle“) ist die Menge die ganze Liste, auf Prod bis zu 67; Last in 6.7.

### 9.4 Takt

- **Aktives Side Event:** in jedem Takt, aus der Agenda, die der Kern meldet (8.2). Kein eigener Abruf.
- **Alle anderen:** in einer Runde. Eine Runde startet im ersten Takt, in dem keine Runde läuft und seit dem Start der vorigen Runde die Regel aus 6.1 erfüllt ist (255 s mit Takt). Die erste Runde startet im ersten Takt nach dem Öffnen der Show.
- **Warteschlange (E48):** je Side Event höchstens ein Eintrag (`programId`, beim aktiven mit der gemeldeten Agenda). Kommt für ein wartendes Side Event ein neuer Anlass, ersetzt er den Eintrag (die neuere Agenda gilt). Läuft sein Eintrag gerade, wird er nach dem Ende genau einmal neu eingereiht. Das aktive Side Event steht vorn und läuft nach dem gerade laufenden Schritt.
- **Je Eintrag, nacheinander:** Agenda holen (nicht beim aktiven; 15-s-Zeitgrenze), dann den Plan **beim Ausführen** bilden (9.5) aus Index-Stand und frisch gelesener Dateiliste, dann Schritt für Schritt ausführen (Umbenennen, Verschieben, Laden); vor jedem Platzieren wird der Zielname neu geprüft (9.6). Innerhalb des Ordner-Teils nie zwei Abrufe oder Downloads gleichzeitig.
- **Vorrang:** Ein laufender Download eines anderen Side Events wird für das aktive nicht abgebrochen; solange das aktive dahinter wartet, sagt seine Zeile S6 (11.2). Andere Side Events in der Warteschlange zeigen dabei ihre gewöhnliche Zeile (S7–S13); ihre Fehler und Stände bleiben sichtbar.
- **Lauf-Generation:** Die Hülle hält eine Zahl, die bei Show öffnen, schließen oder neu binden, beim Rollenwechsel, beim Wegfall des Tokens, beim Ausschalten, beim Beenden und bei einer fremden oder namensgleichen Sperre (9.2 Regeln 4, 5) steigt. Der Lauf prüft sie nach jedem `await`; ein Ergebnis aus einer älteren Generation (etwa ein Agenda-Abruf, der nach dem Wechsel zurückkommt) wird verworfen, ohne Plan und ohne Dateizugriff.
- **Abbruch:** Bei jedem Generationswechsel wird ein laufender Download abgebrochen (AbortController, Grund `bedienung`), die Zwischendatei gelöscht und die Warteschlange geleert. Ein Abbruch mit Grund `bedienung` ist kein Fehler: kein Status, kein Log (9.13).

### 9.5 Abgleich je Side Event (reine Logik)

Eingaben: Index-Stand (der im Speicher, wenn er neuer ist als die Datei, sonst die Datei, sonst keiner, 9.8), Liste der Dateien im Ordner (Name, wie das Dateisystem ihn liefert, Größe, Änderungszeit), Anhänge aus der Agenda (geprüft nach 8.5, ohne gelöschte). Ausgabe: ein Plan aus diesen Schritten. Alle Namensvergleiche nehmen die **Vergleichsform** (9.9).

| Lage | Schritt |
| --- | --- |
| Anhang neu (Kennung nicht im Index); im Ordner liegt eine Datei mit dem Namen, den er nach 9.12 bekäme, kein anderer Index-Eintrag nennt sie, und sie passt: bei einem Datei-Anhang gültiges `size_bytes` (8.5) und genau diese Größe; bei einem Link genau der Inhalt, den 9.7 für sein `href` schriebe (erst die Größe, dann byteweise verglichen) | übernehmen: Index-Eintrag, kein Download (E47) |
| Anhang neu, sonst | Name nach 9.9, Datei laden bzw. `.url` schreiben |
| Anhang da, Datei da, Inhaltssignatur gleich, Label gleich | nichts |
| Label geändert | umbenennen (9.9) |
| Inhaltssignatur geändert (Datei: MIME, Größe und SHA-256 der Asset-Referenz, 8.3; Link: Adresse) | neue Fassung laden bzw. neue `.url` schreiben; die alte vorher nach `entfernt/` (9.10) |
| Index nennt die Datei, sie fehlt im Ordner (Bediener hat gelöscht) | neu laden |
| Index-Eintrag `laedt` (Absturz zwischen Index und Umbenennen) | liegt die Datei unter dem Namen des Eintrags da und hat sie die Bytezahl `bytes` des Eintrags (9.6, auch ohne `size_bytes`): `aktiv`; sonst neu laden |
| Größe weicht vom Index ab, Änderungszeit gleich (Schreiben unterbrochen, etwa Stromausfall) | Datei nach `entfernt/‹Stamm› (unvollständig ‹JJJJ-MM-TT hh-mm›)‹.Endung›`, neu laden |
| Datei vom Bediener geändert (Änderungszeit weicht vom Index ab), Anhang in iveo gleich | nichts (E33); zählt als „im Ordner“, Zusatz „vom Bediener geändert“ (11.2) |
| Index-Eintrag „aktiv“, Anhang fehlt in iveo oder ist gelöscht | Datei nach `entfernt/` |
| Index-Eintrag „entfernt“, Anhang wieder da | Datei aus `entfernt/` zurück, wenn sie dort noch liegt und ihre Signatur passt; sonst neu laden |
| Datei-Anhang ohne Asset | Fehler „in iveo ohne Datei“ |
| Link ohne gültige Adresse (9.7) | Fehler „Link ohne gültige Adresse“ |
| ungültiger Anhang (8.5) | Fehler „ungültiger Anhang in iveo (‹Feld›)“ |
| Download zurückgehalten (9.6, Rückhaltung) | nichts bis zur genannten Zeit |

**Grenze der Übernahme, benannt:** Ein Datei-Anhang ohne gültiges `size_bytes` wird nie übernommen. Der Name allein belegt nicht, dass die Datei der Anhang ist; eine Übernahme machte eine fremde Datei zu einer gepflegten, die später nach `entfernt/` wandern könnte (gegen E33). Fehlt sein Index-Eintrag (Index kaputt oder fehlt, Neustart ohne nachgeschriebenen Stand, 9.8), wird er neu geladen und bekommt „ (2)“ (9.9); die vorhandene Datei bleibt als fremde unberührt. Auf Prod trugen alle 4 Datei-Anhänge `size_bytes` (Messdatei).

Nur ein erfolgreicher Agenda-Abruf erzeugt einen Plan. Eine erfolgreich leere Agenda verschiebt alle Dateien nach `entfernt/` (Risiko 5).

### 9.6 Download

- **Zwei Abrufer (E46):** Die Hülle reicht dem Lauf zwei Clients ein. `agendaClient` ist der Hüllen-Client mit 15-s-Zeitgrenze (`iveo-sync.ts:225-231`). `downloadClient` ist ein Client **ohne** `mitZeitgrenze`, wie heute beim manuellen Download (`iveo-sync.ts:688-690`), gebaut vom neuen reinen Helfer `iveoDownloadClient(token, baseUrl, fetchImpl)` in `apps/launcher/src/main/iveo-huelle-hilfen.ts`, damit ein Test ihn mit echtem `fetch` prüfen kann (12.4 Nr. 47). Grund: `mitZeitgrenze` ersetzt jedes Signal des Aufrufers durch `AbortSignal.timeout(15 s)` (`iveo-huelle-hilfen.ts:38-40`); über diesen Client bräche jeder Download nach 15 s ab, auch beim Lesen des Datenstroms, und der Abbruch aus 9.4 ginge verloren (gemessen auf 127.0.0.1 in der Spec-Prüfung).
- **Abruf:** neue Client-Methode `oeffneAsset(ref, {signal})` in `packages/iveo/src/client.ts`: wie `fetchAsset` (`:363-370`), aber sie liefert den Datenstrom statt `arrayBuffer()`. Dafür bekommt der fetch-Vertrag (`:51-67`) `body?: ReadableStream<Uint8Array> | null` und `init.signal?: AbortSignal`, und `fetchWithRetry` (`:148-170`) reicht `init.signal` durch. **Keine Wiederholung nach einem Abbruch durch den Aufrufer:** Wirft `fetchImpl` und ist `init.signal?.aborted`, wirft `fetchWithRetry` sofort weiter. Eine Zeitgrenze aus `mitZeitgrenze` (eigenes Signal, kein Signal des Aufrufers) wird wie heute wiederholt (`iveo-huelle-hilfen.ts:34-36`). Die signierte Adresse nach dem 302 verlässt den Client nie: Der Rückgabewert enthält nur `body`, `contentType` und `contentLength`, weder `res.url` noch andere Kopfzeilen.
- **Token nur an die Herkunft der Basis-URL (E52):** Den Abruf beschreibt der neue reine, exportierte Helfer `assetAnfrage(ref, baseUrl)` in `packages/iveo/src/client.ts`; `oeffneAsset` und `fetchAsset` nutzen ihn, `resolveAssetUrl` (`:348-355`) geht darin auf. Er baut die Anfrage-URL wie heute und vergleicht dann deren Herkunft (`new URL(…).origin`: Schema, Host, Port) mit der der Basis-URL. Gleich → mit `Authorization` wie heute. Anders und `https:` → ohne `Authorization`. Anders und nicht `https:` (auch `http:`) → kein Abruf, Fehler `IveoAssetAdresseError` (T77). Die Basis-URL selbst gilt, wie sie eingetragen ist (Tests nutzen `http://127.0.0.1`). Weiterleitungen folgen wie heute; beim Wechsel der Herkunft entfernt Node `Authorization` dort selbst (18, „Nicht umgesetzt“). Die Regel gilt für die Ordner-Ablage und den manuellen Download (8.6).
- **Abbruchgründe:** Der Lauf merkt sich, warum er abbricht: `leerlauf` → Fehler „keine Daten seit 60 s, abgebrochen“; `bedienung` (9.4) → kein Fehler. Alle anderen Fehler bildet `ordnerFehlerText` ab (9.13).
- **Ohne Gesamtgrenze, mit Leerlauf-Grenze:** Kommen 60 s lang keine Daten (auch vor dem ersten Byte), bricht der Download ab.
- **Größe (E29):** Grenze G = `min(size_bytes, 2 GiB)`, ohne gültiges `size_bytes` (8.5) 2 GiB. Ist `size_bytes` größer als 2 GiB, wird nicht geladen („zu groß“). Kommen während des Ladens mehr als G Bytes, bricht der Download ab: mit `size_bytes` „mehr Daten als angekündigt“, ohne „zu groß“.
- **Platz:** Vor dem Laden prüft `fs.statfs` auf dem Side-Event-Ordner (bzw. dem Basisordner, wenn der noch fehlt): mit `size_bytes` mindestens G + 1 GiB frei, ohne mindestens 1 GiB; ohne `size_bytes` wiederholt der Lauf die Prüfung nach je 64 MiB und bricht ab, sobald weniger als 1 GiB frei bliebe. Sonst Fehler „zu wenig Speicherplatz“. Scheitert `statfs` selbst, wird nicht geladen: „Speicherplatz nicht prüfbar (‹Code›)“.
- **Zwischendatei:** `.‹Kennung›.‹pid›.jm-laden` im Side-Event-Ordner (gleicher Datenträger), ‹Kennung› nach 9.12 Regel 10, ‹pid› = `process.pid` (E45). Strom → Datei mit `stream.pipeline` und dem Signal des Laufs; vor dem Umbenennen `fh.sync()`, damit nach einem Stromausfall keine halb geschriebene Datei unter dem echten Namen steht.
- **Prüfung:** Ist `size_bytes` bekannt und weicht die geschriebene Bytezahl ab → Fehler „unvollständig“.
- **Jeder Fehler** nach dem Anlegen der Zwischendatei (Leerlauf, Abbruch, ENOSPC, Schreibfehler, Prüfung, Größe) löscht die Zwischendatei, bevor der nächste Schritt läuft. Scheitert das Löschen, räumt das Aufräumen sie später weg.
- **Platzieren ohne Überschreiben (E33, E48):** `rename` ersetzt eine bestehende Datei still, auch eine mit anderer Groß- und Kleinschreibung (gemessen in der Spec-Prüfung: Windows 11, Node v24.16.0, `renameSync` machte aus „FREMD“ „NEU“; ext4 und APFS verhalten sich bei `rename` ebenso, **Annahme** für APFS). Deshalb liest der Lauf unmittelbar vor jedem Umbenennen oder Verschieben die Dateiliste des Zielordners neu und prüft den Zielnamen in Vergleichsform. Ist er belegt (etwa eine Datei, die der Bediener während des Downloads abgelegt hat), bekommt die neue Datei den nächsten freien Zusatz nach 9.9. Zwischen Prüfung und `rename` bleibt ein Restfenster von wenigen Millisekunden (Risiko 17).
- **Reihenfolge beim Platzieren:** (1) Index-Eintrag mit `zustand: "laedt"`, dem Zielnamen und der geschriebenen Bytezahl `bytes` schreiben (9.8; scheitert das, gilt der Stand im Speicher); (2) gibt es eine alte Fassung, sie nach `entfernt/` verschieben (9.10); (3) Zielname prüfen und Zwischendatei umbenennen; (4) Index-Eintrag `aktiv`. Scheitert (2) mit EBUSY, EPERM oder EACCES (unter Windows: Datei geöffnet), wird die Zwischendatei zu `.‹Kennung›.‹pid›.jm-neu`; der Index merkt sich das (`wartet`), die Zeile sagt „neue Fassung wartet, Datei ist geöffnet“; jede folgende Runde versucht zuerst nur das Tauschen, ohne neuen Download.
- **Rückhaltung (E29):** Scheitert das Laden eines Anhangs oder das Schreiben seiner `.url` mit einem anderen Grund als `bedienung`, merkt sich der Lauf im Speicher je Anhang und Inhaltssignatur die Zahl f der Fehlschläge und „nicht vor“ = Zeit des Fehlschlags + min(45 s × 2^(f−1), 10 min). Davor lädt er diesen Anhang nicht; die Zeile sagt „‹Datei›: ‹Grund› · nächster Versuch gegen ‹hh:mm›“. Eine neue Inhaltssignatur oder eine neue Sitzung setzt f zurück. Die Agenda des aktiven Side Events wird davon unberührt in jedem Takt abgeglichen (Entwurf „im 45-s-Takt“); zurückgehalten wird nur der wiederholte Download derselben Fassung.
- **Fortschritt:** Das Ereignis `iveo-anhang-ordner` mit dem Fortschritt (S5) kommt höchstens einmal je Sekunde und am Ende. Der Stand trägt `letzterFortschritt` (ISO): Beginn und Ende jedes Schritts der Runde und neue Bytes eines Downloads, höchstens einmal je Sekunde nachgeführt. Daran misst die Kopfzeile „kein Fortschritt“ (K7, T76).
- **Aufräumen:** Beim ersten Zugriff auf einen Side-Event-Ordner in dieser Sitzung und nur, wenn dieser Rechner die Sperrdatei hält (auch nach Übernahme aus einer früheren Sitzung, 9.2 Regel 3; dann räumt er die Reste des beendeten Prozesses weg), löscht der Launcher übrig gebliebene **eigene** Zwischendateien nach genauem Muster: `.‹Kennung›.‹Ziffern›.jm-laden`, `.‹Kennung›.‹Ziffern›.jm-neu`, die der Index nicht nennt, und `‹Name›.‹Ziffern›.tmp` zu einer eigenen Datei (`.jm-anhaenge.json`, `.jm-ablage-sperre.json`, eine `.url` des Index), wie sie der atomare Schreiber anlegt (`apps/launcher/src/main/show-schreiben.ts:42`). Eine fremde Datei, die zufällig auf `.jm-laden` endet, aber dem Muster nicht folgt, bleibt. `.jm-neu`-Dateien, die der Index nennt, bleiben.
- **Fehler** je Datei kommen in den Status (11.2) und einmal je neuem Text ins Log (T23).

### 9.7 Links

- Kind `link` (oder ohne Asset mit `external_url`, wie `iveo-sync.ts:681`) → Datei `‹Label›.url`, UTF-8 ohne BOM, Zeilenenden CRLF, Inhalt genau diese zwei Zeilen:
  ```
  [InternetShortcut]
  URL=‹href›
  ```
- **Prüfer** `pruefeLink(roh)` (reiner Helfer, auch für das Öffnen im Panel, 8.6):
  1. `roh` muss ein String sein; Leerzeichen U+0020 am Anfang und Ende fallen weg.
  2. Enthält `roh` danach ein Zeichen U+0000–U+001F oder U+007F → Fehler „Link ohne gültige Adresse“, keine Datei.
  3. `new URL(roh)` muss gelingen, Protokoll `http:` oder `https:`.
  4. `href` höchstens 2048 Zeichen.
  Ergebnis ist `href`; nur `href` kommt in die `.url` und in das Index-Feld `inhalt`.
- **Gemessen** (Spec-Prüfung, Node v24.16.0, Skript `pruef-url-injektion.mjs`): Der Rohtext `https://ok.example/pfad` + CR LF + `IconFile=\\evil\share\x.ico` wird von `new URL()` gelesen (Protokoll `https:`), weil der Parser Tab, CR und LF still entfernt; der Rohtext enthält sie noch. Würde er geschrieben, stünde eine zweite Zeile mit einem UNC-Pfad in der `.url`. Regel 2 lehnt ihn ab, statt die verstümmelte Adresse abzulegen.
- **Geänderte Adresse:** Die alte `.url` wandert nach `entfernt/‹Stamm› (ersetzt ‹JJJJ-MM-TT hh-mm›).url` (9.10), dann wird die neue geschrieben (atomar, 9.8). Nichts wird überschrieben.
- macOS öffnet `.url`-Dateien im Standard-Browser: **Annahme**, geprüft in der Abnahme (13, Schritt 15).

### 9.8 Indexdatei

- Je Side-Event-Ordner `.jm-anhaenge.json`, UTF-8, LF, atomar geschrieben: Zwischendatei `.jm-anhaenge.json.‹pid›.tmp`, `fh.sync()`, Umbenennen mit Wiederholung bei EPERM, EBUSY und EACCES wie `show-schreiben.ts:34-70`, aber **asynchron** mit `fs/promises`. `show-schreiben.ts` wartet zwischen den Versuchen synchron (`Atomics.wait`, `:26-28`); im Ordner-Teil hielte das bei einem hängenden Netzlaufwerk den ganzen Main-Prozess an. Dasselbe gilt für jeden Dateizugriff des Ordner-Teils: nur `fs/promises`, nie die synchronen Varianten.
- Format:
  ```json
  {
    "format": 1,
    "programId": "…",
    "titel": "Side Event Klima",
    "ordnerName": "Side Event Klima",
    "stand": "2026-10-16T10:30:00.000Z",
    "eintraege": [
      { "id": "m-1", "art": "datei", "zustand": "aktiv", "datei": "Präsentation.pptx",
        "label": "Präsentation", "inhalt": "application/vnd…|1048576|9f86d081…", "bytes": 1048576, "mtimeMs": 1760610600000 },
      { "id": "m-2", "art": "link", "zustand": "aktiv", "datei": "Website.url", "label": "Website", "inhalt": "https://example.org/" },
      { "id": "m-3", "art": "datei", "zustand": "entfernt", "datei": "entfernt/Alt.pdf", "label": "Alt", "seit": "…" },
      { "id": "m-4", "art": "datei", "zustand": "aktiv", "datei": "Agenda.pdf", "wartet": ".m-4.4711.jm-neu", "inhaltNeu": "…" },
      { "id": "m-5", "art": "datei", "zustand": "laedt", "datei": "Video.mp4", "bytes": 52428800 }
    ]
  }
  ```
  `inhalt` ist die Inhaltssignatur (bei Dateien MIME, Größe und der SHA-256 der Asset-Referenz als 64 Hex-Zeichen, `referenzHash`, 8.3, M1; bei Links `href` aus 9.7). Die Asset-Referenz selbst, eine Weiterleitungsadresse oder ein Token steht nie im Index (12.4 Nr. 41).
- **Index im Speicher (E47):** Der Lauf hält je Side Event den zuletzt gewollten Index-Stand im Speicher (Sitzung). Ein Plan nimmt diesen Stand, wenn er neuer ist als die Datei. Scheitert das Schreiben auch nach den Wiederholungen, bleibt der Stand im Speicher, die Zeile zeigt das Problem „Index nicht schreibbar (‹Code›)“ (11.2), und jede folgende Runde schreibt ihn zuerst nach. Nach einem Neustart fängt die Übernahme (9.5: Name und Größe, bei Links Name und Inhalt) eine abgelegte Datei auf, die der Index nicht mehr kennt; für einen Datei-Anhang ohne gültiges `size_bytes` gilt die Grenze aus 9.5.
- **Prüfung beim Lesen** (gültig nur, wenn alles gilt): JSON; `format` ist eine Zahl; `programId` ein nicht leerer String; `eintraege` ein Array; je Eintrag `id` ein String, `art` `datei` oder `link`, `zustand` `aktiv`, `entfernt` oder `laedt`; `datei` ein **reiner Name** (nach den Regeln 1–8 aus 9.12 unverändert, ohne `/` und `\`) oder bei `entfernt` genau `entfernt/` + reiner Name; `wartet` fehlt oder ist genau `.‹Kennung›.‹Ziffern›.jm-neu` mit der Kennung dieses Eintrags. Sonst gilt der Index als „kaputt“. So kann ein manipulierter, beschädigter oder von einem anderen Rechner synchronisierter Index (`datei = ..\..\Projekt\Budget.xlsx`, `C:\x`, `\\Server\x`, `entfernt/../../x`) den Launcher keine Datei außerhalb des Side-Event-Ordners anfassen lassen; zusätzlich prüft der Wächter aus 9.12 Regel 11 Quelle **und** Ziel jedes Schritts.
- **Kaputt** (Prüfung oben nicht bestanden): Datei umbenennen in `.jm-anhaenge.kaputt-‹JJJJMMTT-hhmmss›.json`, neu aufbauen durch Übernahme: Eine Datei im Ordner, die in Vergleichsform genau den Namen trägt, den der Anhang nach 9.12 bekäme, und nach der ersten Zeile der Tabelle in 9.5 passt (Größe gleich `size_bytes`, bei Links Inhalt wie 9.7; ohne gültiges `size_bytes` keine Übernahme), wird übernommen; alle anderen Anhänge werden geladen (gleichnamige fremde Dateien bekommen dann einen Zusatz, 9.9). Status-Zusatz „Index war beschädigt und ist neu aufgebaut“ bis zur nächsten Runde; Log T24.
- **`format` größer als 1:** Ordner nicht anfassen; Status S3 (11.2).
- **Index fehlt, Ordner hat Dateien:** wie „kaputt“, ohne Umbenennen.

### 9.9 Umbenennen und Kollisionen

- **Vergleichsform:** Jeder Namensvergleich (Kollision, „Datei fehlt“, Übernahme, Wiederfinden, Prüfung vor dem Platzieren) nimmt `normalize('NFC')` und dann `toLowerCase()`. Die Dateiliste selbst bleibt, wie das Dateisystem sie liefert. Grund: macOS mit HFS+ und SMB-Freigaben vom Mac liefern Namen in NFD (**Annahme**, nicht gemessen); NTFS hält NFC- und NFD-Namen als zwei verschiedene Dateien und findet einen NFC-Namen nicht, wenn nur die NFD-Datei da ist (gemessen in der Spec-Prüfung, Windows 11); Windows und macOS unterscheiden beim Öffnen nicht nach Groß- und Kleinschreibung.
- Ein Anhang behält seinen Dateinamen, solange sein Label gleich bleibt. Ein neuer Anhang verschiebt nie den Namen eines bestehenden.
- Kollision in Vergleichsform mit einer fremden Datei, einem anderen Index-Eintrag, einer Zwischendatei, `.jm-anhaenge.json`, `.jm-ablage-sperre.json` oder `entfernt` → Zusatz „ (2)“, „ (3)“ … vor der Endung.
- Label geändert → neuer Name nach diesen Regeln (der eigene alte Name zählt nicht als belegt), dann `rename` nach der Prüfung aus 9.6. Scheitert es (Datei geöffnet), bleibt der alte Name; nächste Runde erneut; Problem-Form „‹alt›: Umbenennen wartet, Datei ist geöffnet“.
- Fremde Dateien (nicht im Index) werden nie umbenannt, verschoben, überschrieben oder gelöscht.

### 9.10 `entfernt/`

- Unterordner `entfernt` im Side-Event-Ordner, angelegt beim ersten Bedarf. Er muss ein echter Ordner sein (`lstat`: Ordner, keine symbolische Verknüpfung; Node meldet eine Windows-Junction bei `lstat` als Verknüpfung, **Annahme**). Sonst Fehler „„entfernt“ ist kein Ordner“, nichts wird verschoben.
- **Von iveo entfernt oder gelöscht:** Datei nach `entfernt/‹Name›`; Kollision dort → Zusatz „ (2)“ …
- **Durch neue Fassung ersetzt:** alte Datei nach `entfernt/‹Stamm› (ersetzt ‹JJJJ-MM-TT hh-mm›)‹.Endung›` (Ortszeit; `-` statt `:`); gilt auch für eine alte `.url` (9.7).
- **Unvollständig:** `entfernt/‹Stamm› (unvollständig ‹JJJJ-MM-TT hh-mm›)‹.Endung›` (9.5).
- Jeder dieser Pfade geht durch die Längenregel aus 9.12 Regel 10.
- Nichts wird gelöscht außer den eigenen Zwischendateien (9.6) und der eigenen Sperrdatei (9.2).

### 9.11 Show verschoben, umbenannt, ohne Datei

- Vor jeder Runde und jedem Plan prüft der Ordner-Teil, ob die Show-Datei am Öffnungspfad existiert und lesbar ist; er liest ohnehin die Liste der Bindung aus ihr (9.3). Fehlt sie oder ist sie nicht lesbar: nichts tun, Kopfzeile K4 (11.1). Sobald sie wieder da ist (etwa ein Netzlaufwerk ist zurück), läuft die Ablage im nächsten Takt von selbst weiter. Der Kern meldet „Show-Datei nicht lesbar“ (`iveo-abgleich-kern.ts:109`) nur, wenn er die Datei liest: im Agenda-Modus in jeder Abfrage (`:849`), im Listen-Modus nur bei einem Speakerfehler oder einer abweichenden Signatur (`:733-758`); die Kopfzeile verlässt sich deshalb nicht auf ihn.
- Wird die Show am neuen Ort geöffnet, gilt der Basisordner neben dem neuen Ort. Hat der Bediener den Basisordner mitverschoben (gleicher Stamm), findet der Launcher die Side-Event-Ordner über ihre Indexdateien (9.1) und lädt nichts doppelt. Sonst entsteht ein neuer Basisordner; der alte bleibt unberührt.
- Eine umbenannte Show bekommt einen neuen Basisordner (anderer Stamm). Das Handbuch sagt: Basisordner mit umbenennen.
- „Ohne gespeicherte Show-Datei“: Der Launcher öffnet Shows nur aus Dateien (4.5 Nr. 3). Ohne geöffnete iveo-Show zeigt das Panel wie heute „Keine iveo-gebundene Show geöffnet.“ (`SideEventsPanel.tsx:108`) und darunter T52, damit es auch über die Ablage etwas sagt (Entwurf „und das Panel sagt es“).

### 9.12 Dateinamen-Sicherheit

Gilt für jeden Namen und Pfad, den der Ordner-Teil erzeugt: Ordnernamen (Titel), Dateinamen (Label + Endung), die Zusätze „ (2)“, „(ersetzt …)“, „(unvollständig …)“, Pfade unter `entfernt/`, Zwischendateien und die `.kaputt`-Datei. Eine Funktion `ordnerPfad(…)` baut sie alle; die Regeln laufen in dieser Reihenfolge:
1. `normalize('NFC')`.
2. Durch `_` ersetzt: Steuerzeichen U+0000–U+001F, U+007F und U+0080–U+009F (C1), jedes Zeichen der Unicode-Kategorie Cf (Format; darunter die Bidi-Steuerzeichen U+202A–U+202E und U+2066–U+2069, U+200B–U+200F, U+FEFF) sowie `<>:"/\|?*`. Grund für Cf: Mit U+202E würde aus „Slides‹U+202E›txt.exe“ im Explorer scheinbar eine Textdatei (nachgerechnet in der Spec-Prüfung: die bisherige Regel ließ U+202E und U+0085 stehen).
3. Leerraumfolgen → ein Leerzeichen; `trim()`.
4. Punkte und Leerzeichen am Ende entfernen. Grund: Node legt solche Namen unter Windows wörtlich an (Pfad mit `\\?\`), Explorer, cmd und Office erreichen sie dann nicht (gemessen in der Spec-Prüfung, Windows 11 26200, Node v24.16.0: „Klima “, „Klima.“ und „Bericht “ angelegt, `cmd /c dir` fand sie nicht). Windows entfernt sie also **nicht** still.
5. Beginnt der Name mit `.` → `_` davor (sonst unter macOS versteckt und Kollision mit eigenen Dateien).
6. `.` und `..` allein → `_`.
7. Reservierte Windows-Namen: Ist der Teil vor dem ersten Punkt **nach Entfernen von Leerzeichen am Ende** ohne Rücksicht auf Groß- und Kleinschreibung `CON`, `PRN`, `AUX`, `NUL`, `COM0`–`COM9`, `COM¹`–`COM³`, `LPT0`–`LPT9`, `LPT¹`–`LPT³`, `CONIN$` oder `CONOUT$` → `_` davor. („CON .pdf“: unter Windows 11 26200 eine normale Datei, gemessen; unter Windows 10 ein Gerät, **Annahme**.)
8. Leer → „Anhang“ bzw. „Side Event“.
9. **Endung** (nur Datei-Anhänge; bei Links hängt der Launcher `.url` selbst an den nach 1–8 und 10 gebauten Stamm, 9.7): aus dem Label, wenn es auf `.` + 2–5 Buchstaben oder Ziffern mit **mindestens einem Buchstaben** endet („Version 2.10“ hat keine Endung), sonst aus dem MIME-Typ (`MIME_EXT`, aus `iveo-sync.ts:602-621` in das neue Modul verschoben), sonst keine. Danach die **Sperrliste** (E49): Ist die letzte Endung des fertigen Namens (Text nach dem letzten Punkt, Kleinschreibung, beliebige Länge) eine der folgenden, wird ihr Punkt zu `_`, und es kommt die MIME-Endung dazu, sonst `.bin`. Windows: `exe com scr pif bat cmd msi msp mst msc cpl hta js jse vbs vbe wsf wsh wsc ps1 psm1 psd1 ps1xml reg inf lnk url scf library-ms searchconnector-ms settingcontent-ms appref-ms application gadget chm jar diagcab vhd vhdx iso img`; macOS: `app command tool terminal scpt workflow pkg mpkg dmg sh`. Beispiele: „Agenda.exe“ mit `application/pdf` → „Agenda_exe.pdf“; Datei-Anhang „x.url“ → „x_url.‹MIME-Endung›“; „www.example.com“ → „www.example_com.‹MIME-Endung›“. Eine reine Positivliste wäre ein Funktionsverlust (Keynote, `.mov`, `.mkv` stehen nicht in `MIME_EXT`, `iveo-sync.ts:602-616`). Makro-Formate (`.pptm`, `.docm`, `.xlsm`) bleiben erlaubt; eine Herkunftsmarkierung bekommen abgelegte Dateien nicht (OF9, Vorgabe vom Owner am 17.10.2026 bestätigt). Eine gesperrte Endung zeigt die Zeile als Zusatz „‹Datei›: Endung „‹ext›“ gesperrt“ (11.2).
10. **Länge**, für den fertigen Pfad samt allen Zusätzen:
    - Jeder Name höchstens 120 Codepunkte und höchstens 240 Bytes UTF-8 (macOS: 255 Bytes je Name).
    - **Pfadbudget** 250 UTF-16-Einheiten (Windows, Explorer und Office). Ein Side-Event-Ordnername wird so gekürzt, dass `‹Ordnerpfad›\entfernt\` plus eine Reserve von 60 Einheiten im Budget bleibt; bleiben weniger als 8 Zeichen für den Ordnernamen, Fehler „Pfad zu lang“ für dieses Side Event (S4). Ein Dateistamm wird so gekürzt, dass auch seine längste Form `entfernt\‹Stamm› (unvollständig JJJJ-MM-TT hh-mm) (99)‹.Endung›` im Budget bleibt (6 Einheiten länger als die Form mit „ersetzt“, 9.10); bleiben weniger als 8 Zeichen, Fehler „Pfad zu lang“ für diese Datei. Die Reserve von 60 Einheiten deckt diese Form auch beim Mindeststamm: 8 + 33 für „ (unvollständig JJJJ-MM-TT hh-mm)“ + 5 für „ (99)“ + höchstens 6 für die Endung samt Punkt (Regel 9) = 52.
    - Gekürzt wird an Codepunkt-Grenzen; danach laufen die Regeln 3–8 erneut (ein gekürzter Name kann sonst auf Leerzeichen oder Punkt enden; so auch die Organisationen, 5.3 Schritt 3).
    - In Zwischennamen wird die Anhang-Kennung auf höchstens 40 Codepunkte begrenzt: länger → die ersten 31, „-“ und 8 Hex-Zeichen ihres SHA-256.
11. **Wächter gegen Pfad-Traversal:** Quelle **und** Ziel jedes Schritts werden mit `path.relative(seitenOrdner, pfad)` geprüft; beginnt das Ergebnis mit `..` oder ist es absolut, bricht der Schritt mit Fehler ab. Zusätzlich müssen Basisordner, Side-Event-Ordner und `entfernt` echte Ordner sein (`lstat`, keine Verknüpfung). Der Wächter greift auch, wenn Regel 2 oder die Indexprüfung (9.8) einmal versagt.

### 9.13 Statusanzeige, „Ordner öffnen“, Diagnosen

- Das Side-Events-Panel bekommt unter der Störungszeile eine **Kopfzeile** (11.1) mit Schalter (9.14, OF8) und „Ordner öffnen“ (Basisordner, OF8) und unter jedem Side Event der Panel-Liste eine **Ordner-Zeile** (11.2) mit „Ordner öffnen“ (Side-Event-Ordner).
- **Block „Weitere Side Events der Ablage“** (T65): Side Events der Ablage-Menge, die die Panel-Liste nicht zeigt (anderer Tag, Typfilter, Programm nicht im Cache, kein Cache), stehen unter der Liste mit Titel und Ordner-Zeile. Der Block steht auch da, wenn das Panel „Kein iveo-Cache vorhanden …“ meldet (`iveo-sync.ts:551-559`, `SideEventsPanel.tsx:106-109`); das Panel rendert Kopfzeile und Block unabhängig von `data.ok`. Sonst sähe niemand die Fehler dieser Side Events.
- „Ordner öffnen“ ist in jeder Zeile genau dann aktiv, wenn der Ordner beim letzten Zugriff existierte; der Main öffnet ihn mit `shell.openPath` und meldet einen Fehler als Notice (T31).
- Jeder Fehler steht in der Zeile seines Side Events, nicht nur im Log. Die Kopfzeile zählt die gestörten Side Events (S4, S9, S10, S13 mit Problem) als Zusatz T64.
- **Fehlertexte des Ordner-Teils:** reiner Helfer `ordnerFehlerText(e, wo: 'agenda' | 'download' | 'datei', grund?)` im neuen Modul:
  - Grund `bedienung` → kein Fehler (kein Status, kein Log);
  - Grund `leerlauf` → „keine Daten seit 60 s, abgebrochen“;
  - `IveoApiError` 404 → bei `agenda` „Agenda in iveo nicht gefunden (404)“, bei `download` „Datei in iveo nicht gefunden (404)“ (der Kern-Text „Event nicht gefunden …“, `iveo-abgleich-kern.ts:201`, wäre hier falsch: Die Agenda gelang gerade);
  - 401 → „Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).“ (wie `:200`);
  - ≥ 500 → „iveo-Server-Fehler (HTTP ‹Status›)“, ohne den Verweis „Details im Launcher-Log“ (`:203`), weil die Details erst die Logzeile trägt;
  - `TimeoutError` → „iveo antwortet nicht innerhalb von 15 s“;
  - `IveoAssetAdresseError` (E52) → T77 (a);
  - Dateisystemfehler → „Schreibfehler (‹Code›)“;
  - sonst die Meldung des Fehlers, höchstens 200 Zeichen, ohne Zeilenumbrüche.
  - In jedem Text und in jeder Rohmeldung für das Log wird jede Adresse (ab `http://` oder `https://` bis zum nächsten Leerraum) durch „‹Adresse›“ ersetzt; eine Fehlermeldung mit der Anfrage- oder Weiterleitungsadresse trüge sonst eine signierte Kennung in Statuszeile und Log (12.4 Nr. 41).
  Die Logzeilen T23 und T25 tragen zusätzlich die Rohmeldung (`e.message`; bei Abrufen über `call()` mit `request_id`, `packages/iveo/src/client.ts:206-215`). ‹Text› in T44 und T45 ist `ordnerFehlerText` des Agenda-Fehlers, beim aktiven Side Event des Fehlers aus `meldeAgenda` (8.2). `toClientError` (`iveo-abgleich-kern.ts:206-210`) bleibt für Kern und Panel; der Kommentar `:213-214` („Einen anderen Abbruch gibt es nicht“) bekommt den Satz „Gilt für die Abrufe des Kerns und der Hülle; Abbrüche der Ordner-Ablage bildet `ordnerFehlerText` selbst ab.“
- Das Log bekommt je Datei und neuem Grund eine Zeile (T21–T25), keine Wiederholungen je Takt.

### 9.14 Abschalten (Vorgabe, OF8)

- Neue Einstellung `iveoAnhangOrdner?: boolean` in `StoredSettings` (`settings.ts:7-28`); fehlt sie, gilt „an“.
- Schalter in der Kopfzeile des Panels (T26), nur sichtbar, wenn 9.2 Nr. 1–3 gelten.
- Aus: laufender Download wird abgebrochen (9.4), nichts weiter abgerufen oder geschrieben, die eigene Sperrdatei gelöscht; vorhandene Ordner bleiben unberührt. Danach greift nur noch die Existenzprüfung des Basisordners für „Ordner öffnen“ in K3 (9.2). Wieder an: nächste Runde im nächsten Takt.
- Der Schalter und das „Ordner öffnen“ der Kopfzeile sind Vorgaben dieser Spec (0.1 Nr. 10); der Owner hat sie am 17.10.2026 bestätigt (OF8). Ohne Schalter (OF8 B, nicht gewählt) entfielen 9.2 Nr. 4, dieser Abschnitt, K3 mit T34, T26, `iveo:setzeAnhangOrdner`, der Teil „Schalter aus“ von 12.4 Nr. 27, Abnahme Schritt 16 und der Satz „Abschaltbar …“ in den Notes.

### 9.15 Module, Typen, IPC

| Was | Wo |
| --- | --- |
| Reine Logik: Namen und Pfade (9.12), Vergleichsform (9.9), Plan (9.5), Index lesen, prüfen und als Text bauen (9.8), Linkprüfer `pruefeLink` (9.7, auch 8.6), `ordnerFehlerText` (9.13), Ablage-Menge (9.3), Rückhaltung (9.6), Sperrdatei auswerten `sperreBewerten` (9.2), Panel-Entscheidungen `panelAnhangSchritt` und `panelDateiOeffnen` (8.6) | neu `apps/launcher/src/main/side-event-ordner.ts` (ohne Electron) |
| Ablauf: Warteschlange, Runde, Lauf-Generation, Download mit Leerlauf-Grenze, Abbruch mit Grund, Platzieren mit Prüfung, Index im Speicher, Sperrdatei schreiben und am Ende der Ablage löschen (`beenden()`, 9.2); mit eingereichtem Dateisystem (Form von `fs/promises`), Uhr, Zeitgebern, `agendaClient`, `downloadClient`, `rolle()`, `tokenDa()`, `schalterAn()`, `tagVon()`, Rechnername und Prozesskennung | neu `apps/launcher/src/main/side-event-ordner-lauf.ts` (ohne Electron) |
| `iveoDownloadClient(token, baseUrl, fetchImpl)` | `apps/launcher/src/main/iveo-huelle-hilfen.ts` (ohne Electron) |
| Anbindung: `node:fs/promises`, `shell`, `dialog`, Takt, Einstellung, Rolle, Token (`getIveoToken`), Cache (`tagVon`, Titel), Ereignisse; `ablageBeenden()` für `before-quit`; manueller Download nach den Helfern aus 8.6 | `apps/launcher/src/main/iveo-sync.ts`; Aufruf aus `apps/launcher/src/main/index.ts:94` |
| `verbundRolle()` | `apps/launcher/src/main/verbund/index.ts` |
| Typen `AnhangOrdnerStand`, `SideEventOrdnerStand` (je Side Event: `programId`, Titel, Ordnername, `existiert`, Zustand nach 11.2, Zahlen, Probleme, Zusätze; dazu im Stand `naechsteRundeGegen`, `letzterFortschritt` (9.6) und `sperre`: `null` oder `{art, rechner, lebenszeichen}` mit `art` = `fremd` oder `namensgleich`, 9.2) | `apps/launcher/src/shared/types.ts` |
| IPC `iveo:anhangOrdner` (→ `AnhangOrdnerStand`), `iveo:setzeAnhangOrdner` (`{an: boolean}`), `iveo:oeffneAnhangOrdner` (`{programId?: string}` → `ActionResult`) | `ipc.ts`, `preload/index.ts`, Typen im Interface `JmpsApi` (`shared/types.ts:364`) |
| `AppEvent` `{ type: 'iveo-anhang-ordner'; stand: AnhangOrdnerStand }` bei jeder Änderung des Stands, Fortschritt höchstens einmal je Sekunde (9.6) | `shared/types.ts` |
| Renderer-Zustand und Zeilen; Kopfzeile mit der aktuellen Uhrzeit des Renderers bewertet (11.1, „überfällig“ und „kein Fortschritt“), neu bewertet alle 15 s, solange das Panel offen ist | `store/tools.ts`, `SideEventsPanel.tsx`, neu `apps/launcher/src/renderer/src/lib/ordner-zeilen.ts` (rein) |

Der Renderer bekommt Ordnernamen und Zustände, nie Pfade zum Öffnen; „Ordner öffnen“ übergibt nur die `programId` (E35). Den vollen Pfad zeigt ein `title`-Tooltip.

---

## 10 · Teil F · Connect auf dem Mac (#256)

### 10.1 CI-Job

Neuer Workflow `.github/workflows/connect-mac.yml`:

- **Auslöser:** `push` mit Tag `connect-v*.*.*`, und `workflow_dispatch` mit Eingabe `tag` (Pflicht, muss auf `connect-v` beginnen und existieren).
- **Job** auf `macos-latest`, `permissions: contents: write`:
  1. `TAG` = Eingabe oder `github.ref_name`; Prüfung `connect-v` + Version.
  2. `actions/checkout@v5` mit `ref: ${{ env.TAG }}`.
  3. `actions/setup-node@v5` mit Node 20 (wie `suite-release.yml:46-48`).
  4. `npm ci` (die `install`-Skripte von `@jm/ndi` und `@jm/zoom-bridge` überspringen den nativen Bau ohne SDK bzw. auf Nicht-Windows, `packages/ndi/scripts/maybe-build.mjs:10-16`, `packages/zoom-bridge/scripts/maybe-build.mjs:9-12`).
  5. `npm run build -w @jm/connect`.
  6. `npm run prepackage -w @jm/connect` (beide Bundle-Skripte beenden sich auf macOS ohne Arbeit, 4.6 Nr. 6).
  7. `npx electron-builder --mac --publish never` in `apps/connect`, `CSC_IDENTITY_AUTO_DISCOVERY=false`.
  8. Prüfschritt (10.2).
  9. Hochladen, mit `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (wie `suite-release.yml:121-122`; ohne Token läuft `gh` in der CI nicht): Gibt es das Release: `gh release upload "$TAG" apps/connect/release/*.dmg --clobber`. Gibt es keins: beim Tag-Push `gh release create "$TAG" --prerelease --title "connect $TAG" --notes "Mac-Paket aus der CI; das Windows-Paket und die Notes folgen."` und hochladen; beim Hand-Start abbrechen (E38).
- **Kein** Katalog-Bump (E37). `suite-release.yml` bleibt unverändert; es schließt `connect-v` weiter aus (`:35`), sein Bump-Job läuft für Connect deshalb nie (`:148-149`).
- **Ablauf eines künftigen Connect-Releases:** (1) Windows lokal bauen (`dist:win`). (2) `gh release create connect-vX --prerelease` mit EXE und Notes; das legt das Tag an. (3) Ob das so angelegte Tag den Workflow auslöst, ist eine **Annahme** (Messaufgabe M3); sonst den Workflow von Hand mit dem Tag starten. (4) Nach den DMGs lokal `node scripts/bump-manifest.mjs connect X` auf `main`.

### 10.2 Prüfung „macOS ohne Zoom-SDK“

Am Code nachgeprüft (4.6 Nr. 6): Die Bundle-Skripte und der After-Pack-Wächter laufen auf macOS ohne Zoom-SDK durch. Der Workflow prüft es am Ergebnis, nach Schritt 7, mit einem Node-Skript `apps/connect/tools/pruefe-mac-paket.mjs` (Eingabe: Ordner `release`):

- genau zwei Dateien `apps/connect/release/*.dmg`, eine mit `arm64`, eine mit `x64` im Namen;
- in beiden `.app` (`release/mac*/JM Connect.app/Contents/Resources`) kein Ordner `zoom-bridge`;
- keine Zoom-SDK-Datei: prüft schon der After-Pack-Wächter (`apps/connect/tools/after-pack.cjs:15-19`), der Bau bricht sonst ab;
- kein `bin/mac/jm_ndi.node` (OF1, Vorgabe A vom Owner am 17.10.2026 bestätigt; käme es doch zu NDI auf dem Mac, Variante C ist angeboten und offen, kehrte sich die Prüfung für ein solches Paket um).

Das Skript hat einen eigenen Selbsttest `apps/connect/test/pruefe-mac-paket.test.mjs` im Skript `selftest` von `@jm/connect` (neben `node test/after-pack.test.mjs`) mit nachgebauten Ordnern: sauberer Ordner → grün; **Gegenproben:** Ordner mit `zoom-bridge` → rot, mit `jm_ndi.node` → rot, nur ein DMG → rot. So läuft der Prüfschritt nicht erst am echten Release `connect-v0.3.0` zum ersten Mal. Schlägt eine Prüfung fehl, wird nichts hochgeladen.

### 10.3 Nachlauf für 0.3.0

- Nach dem Merge (der Workflow muss auf `main` liegen) startet der Owner oder der Agent mit Owner-Freigabe den Workflow von Hand mit `tag = connect-v0.3.0`.
- Er baut aus dem Tag (`2df1f79357`), also aus denselben Quellen wie das Windows-Paket 0.3.0 (4.6 Nr. 8). Er lädt `JM Connect-0.3.0-mac-arm64.dmg` und `…-mac-x64.dmg` an das bestehende Release (dort mit Punkten statt Leerzeichen, `JM.Connect-0.3.0-mac-arm64.dmg`, wie 14.1 Nr. 8) und ändert sonst nichts.
- Ab dann findet auch der alte Proxy ein DMG (`worker.js:313-316`); Launcher 0.15.0 auf dem Mac installiert Connect. #256 ist damit behoben, unabhängig von 10.4 und 10.5.
- Vorher geht die neue Katalog-Beschreibung (10.6) auf `main`, damit Mac-Nutzer vor dem Installieren lesen, was fehlt.

### 10.4 Launcher zeigt den Fehlertext des Proxys

Neues reines Modul `apps/launcher/src/main/release-wahl.ts` (ohne Electron, testbar mit `node --experimental-strip-types` im Launcher-Selbsttest, Skript `selftest` in `apps/launcher/package.json`):

- `compareVersions` zieht aus `release-source.ts:49` hierher; `release-source.ts` importiert es von hier. Grund: `release-source.ts` importiert `./settings` (`:2`), und `settings.ts` lädt Electron (`:1`); Selbsttest und CI (`.github/workflows/ci-checks.yml:43-48`, Kommentar `:51-52`) können es nicht laden.
- `proxyFehlerText(status: number, statusText: string, body: string): string` — Ist `body` JSON mit String-Feld `error`, dann „Proxy ‹Status›: ‹error›“ (Text auf 200 Zeichen gekürzt, Zeilenumbrüche zu Leerzeichen); sonst „Proxy ‹Status› ‹Statustext›“ wie heute.
- `proxyAntwortAuswerten(res)` (async; `res` mit `ok`, `status`, `statusText`, `text()`, `json()`) — die ganze Auswertung der Proxy-Antwort, die heute in `release-source.ts:170-199` steht: bei `!res.ok` den Text lesen (Fehler beim Lesen → leerer Text) und `new Error(proxyFehlerText(...))` werfen, sonst das Ergebnis prüfen und zurückgeben. `release-source.ts` ruft nur noch diesen Helfer; testbar mit einem Response-ähnlichen Objekt (12.7 Nr. 2).
- `keinPaketText(plattform, arch, wer: 'tool' | 'launcher'): string` — T29 bzw. T69.
- Die GitHub-Quelle (`release-source.ts:111-138`) bildet `latest` und `latestVersion` über `waehleRelease` (10.5) aus der geholten Release-Liste und liefert `null`, wenn kein Release ein passendes Paket hat; `installer.ts:242` sagt dann `keinPaketText(…, 'tool')` (T29) statt „Kein passendes Artefakt für diese Plattform gefunden.“.
- Anzeige wie heute in `installer.ts:237`: „Release-Abfrage fehlgeschlagen: ‹Text›“ (T27).
- **Launcher selbst** (`updateLauncher`, `installer.ts:350-366`): derselbe Weg. „Update-Abfrage fehlgeschlagen: ‹Text›“ (`:358`) trägt jetzt den Text aus `proxyFehlerText` (F10), und „Kein Launcher-Installer für diese Plattform gefunden.“ (`:363`) wird T69 (F11).

### 10.5 Proxy und GitHub-Quelle: neuestes Release mit passendem Paket

Regel (in `worker.js` und in `release-wahl.ts` als `waehleRelease(releases, praefix, plattform, arch)`, zwei Umsetzungen mit **einer** Testtabelle `services/release-proxy/test/paketwahl-faelle.json`, die beide Tests lesen, 12.7):

1. Kandidaten: nicht `draft`, Tag beginnt mit `‹app›-v`, absteigend nach Version (`compareVersions`).
2. **Passend** auf Windows: Name endet auf `.exe`.
3. **Passend** auf dem Mac: Name endet auf `.dmg` und
   - enthält die Architektur des Launcher-Prozesses (`process.arch`, `release-source.ts:31-33`), oder
   - enthält weder `arm64` noch `x64` (universell), oder
   - der Launcher ist `arm64` und der Name enthält `x64` (läuft über Rosetta).
   Ein `x64`-Launcher nimmt nie ein `arm64`-Paket. Ein x64-Launcher unter Rosetta auf einem Apple-Silicon-Mac zählt als x64; die Texte sagen deshalb „Launcher-Architektur“ (FP12).
4. Innerhalb eines Releases: genaue Architektur vor universell vor `x64` auf `arm64`. In der GitHub-Quelle zuerst der genaue Name aus dem Katalog (`release-source.ts:125-129`), dann diese Reihenfolge.
5. Gewählt wird das **erste** Release (höchste Version), das ein passendes Paket hat.
6. Kein Release mit Präfix → `404 {error: "kein Release für ‹app›"}` (wie `worker.js:307`). Releases da, keins passend → `404 {error: "kein Release von ‹app› mit einem Paket für ‹macOS|Windows› (‹arch›)"}` (T28; ‹arch› nur bei macOS).
7. `latestVersion` (Update-Prüfung) folgt derselben Wahl: Ein Release ohne Paket für diesen Rechner gilt nicht als Update (`updates.ts:43-50`).

Das gilt für alle Tools und den Launcher selbst (`updates.ts:56-60`, `installer.ts:350-366`). Wirkung: Ein Intel-Mac bekam bisher bei einem Release, das nur ein `arm64`-DMG trägt, dieses nicht lauffähige Paket (`worker.js:316`); jetzt bekommt er die Meldung T28. Hat das neueste Release eines Tools kein DMG, ein älteres aber schon, bekommt ein Mac jetzt das ältere (bisher: 404 „kein mac-Asset im Release“, `worker.js:317`). Kandidaten dafür sind die lokal und nur für Windows gebauten Tools (`suite-release.yml:35`); der Titler führt im Katalog ein Mac-Artefakt (`packages/suite-manifest/suite.json:288-289`), seine Releases 0.10.1 und 0.11.0 waren laut Pilot-Plan nur für Windows. Welche Releases es genau betrifft, misst der Trockenlauf vor dem Deploy (10.7); in dieser Spec ist es nicht abgefragt (kein Netz).

### 10.6 Katalog-Beschreibung

`packages/suite-manifest/suite.json:471` wird (Vorgabe OF1) ganz neu gefasst, weil auch die Sätze vor dem Schlusssatz Windows-Funktionen versprechen („erscheinen automatisch als NDI-Quelle“, „jeder Gast sieht das Programm“), die auf dem Mac fehlen:

„Hybride Konferenzen: Remote-Gäste kommen per Browser dazu (nur ein Join-Link, keine Software). Voller Green Room mit Warteraum, Vorschau, Freigabe und Tally. Der Raum-PC öffnet keinen eingehenden Port. Per Bitfocus Companion und JM Rundown fernsteuerbar (eine GO-Zeile holt den Standby-Gast auf Sendung). Unter Windows (nutzt die NDI-Runtime) erscheinen die Gäste automatisch als NDI-Quelle im JM Switcher, Titler und Rundown, und der Rückkanal mit Mix-Minus läuft: Jeder Gast sieht das Programm und hört alle anderen, aber nie sich selbst; die Regie spricht per Talkback ins Ohr; dazu Zoom. Unter macOS: Raum, Einladungen und Green Room, ohne Zoom und ohne NDI. Die Gäste erscheinen dort nicht als NDI-Quelle und sehen und hören das Programm nicht; einander und die Regie per Talkback hören sie weiter.“

Der letzte Halbsatz folgt aus dem Code (Gast-zu-Gast-Ton und Talkback brauchen kein NDI, 4.6 Nr. 7) und ist bis zur Abnahme (13, Schritt 15) eine **Annahme**; scheitert er dort, wird er vor dem Nachlauf gestrichen. Keine ASCII-Anführungszeichen. Vor dem Commit `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/suite.json','utf8'))"`. Der Proxy liefert den Katalog live aus `MANIFEST_REF` (`worker.js:212-231`); ein Launcher-Release ist dafür nicht nötig.

### 10.7 Proxy-Deploy

- Nur mit ausdrücklicher Owner-Freigabe; kein Deploy durch den Agenten ohne sie.
- **Vorprüfung:** aktuelle Bereitstellungen und Versionen des Workers ansehen, ungemergte Commits unter `services/release-proxy` gegen `main` prüfen, Selbsttest grün (12.7).
- **Trockenlauf (E43):** Ein Node-Skript holt lesend die Release-Liste des Repos (über `gh api`, dieselben Seiten wie der Worker) und stellt für jedes Tool aus `suite.json` auf Windows, Mac arm64 und Mac x64 die alte Wahl (heutiger `worker.js`) der neuen (`waehleRelease`) gegenüber: Version, Paketname oder Fehlertext. Jede Zeile mit Unterschied geht mit Begründung an den Owner, bevor er den Deploy freigibt. Das Skript schreibt nichts und gibt keine Tokens aus.
- **Zeitpunkt:** außerhalb laufender Connect-Sitzungen. Der Worker trägt auch die Connect-Räume (`services/release-proxy/worker.js:33`, Durable-Object-Bindung `services/release-proxy/wrangler.toml:29-31`). Ob ein Deploy ihre WebSockets trennt, ist nicht am Code belegbar (**Annahme**: ja, kurz); der Client verbindet sich selbst wieder (`packages/rtc/src/signalling.ts:54-73`).
- **Gegenprobe danach**, ohne Mac, mit Proxy-Key: `GET /tools/jm-connect/latest?platform=mac&arch=arm64` liefert `version 0.3.0` und ein DMG (nach dem Nachlauf); `…&arch=x64` liefert das x64-DMG; ein Windows-Tool liefert dieselbe Version wie vor dem Deploy.

---

## 11 · Statuszeilen- und Text-Wahrheit

Jede dauerhaft sichtbare Zeile wird aus einer reinen Funktion gebildet. Getestet wird nicht nur je Tabellenzeile, sondern über das **Kreuzprodukt** der genannten Zustandsachsen (E51, Owner-Regel „eine Statuszeile muss in jedem Zustand stimmen“): Ein Test zählt alle Kombinationen der Achsenwerte auf, prüft, dass in der Vorrangkette genau eine erste Zeile zutrifft, und vergleicht deren Text mit der Erwartung je Kombinationsklasse (12.3 Nr. 8, 12.4 Nr. 30). Achsen, die eine Zeile nicht beeinflussen, begründet der Vorrang. Ausnahme 11.5: F1 und F7 sind unverändert und entstehen nicht in einer reinen Funktion; F2–F6, F8, F10 und F11 bilden die Helfer aus 10.4 (12.7).

### 11.1 Ordner: Kopfzeile im Side-Events-Panel

Achsen: Show (keine offen / offen) · Rolle (`aus`, `master`, `slave`; `slave` auch ohne Kopplung, `apps/launcher/src/main/verbund/kern.ts:421-423`, `:166-169`) · Token (ja / nein) · Schalter (an / aus) · Show-Datei (da / fehlt / nicht lesbar) · Sperre nach 9.2 (frei / eigen, auch aus einer früheren Sitzung dieses Rechners / anderer Rechner, gültig / anderer Rechner, abgelaufen / namensgleich) · Basisordner (existiert / fehlt / nicht anlegbar) · Runde (läuft / nicht) · erste Runde der Sitzung (gestartet / ausstehend) · Uhr (vor / nach „gegen“ + 45 s; in K7: letzter Fortschritt höchstens 105 s her / länger).

Genau eine Zeile; die erste zutreffende Bedingung gewinnt.

| # | Bedingung | Zeile | Schalter | „Ordner öffnen“ |
| --- | --- | --- | --- | --- |
| K0 | keine iveo-Show offen | keine Kopfzeile; das Panel sagt „Keine iveo-gebundene Show geöffnet.“ und darunter T52 | nein | nein |
| K1 | Rolle `slave` | T32 | nein | nein |
| K2 | kein Token | T33 | nein | nein |
| K3 | Schalter aus | T34 | ja | wenn Basisordner existiert |
| K4 | Show-Datei fehlt oder ist nicht lesbar | T35 | ja | nein |
| K5 | Sperre eines anderen Rechners mit gültigem Lebenszeichen (9.2 Regel 5) bzw. namensgleiche Sperre (Regel 4); eine eigene Sperre, auch aus einer früheren Sitzung, und eine abgelaufene führen nie hierher | T57 bzw. T73 | ja | ja |
| K6 | Basisordner nicht anlegbar | T36 | ja | nein |
| K7 | Runde läuft | T37, nach mehr als 105 s ohne Fortschritt T76 (+ T64) | ja | wenn existiert |
| K8 | erste Runde dieser Sitzung noch nicht gestartet | T58 | ja | wenn existiert |
| K9 | bereit, Basisordner existiert | T38, nach Ablauf T59 (+ T64) | ja | ja |
| K10 | bereit, Basisordner fehlt | T39, nach Ablauf T59 | ja | nein |

„gegen ‹hh:mm›“ = Start der vorigen Runde + 270 s (bei regelmäßigem Takt startet die nächste Runde im sechsten Takt danach, 6.1); in K6 die Zeit des nächsten Versuchs nach derselben Regel. „Nach Ablauf“ = die Uhr des Renderers steht mehr als 45 s nach „gegen“, ohne dass eine neue Runde begonnen hat; dann T59 „… Abgleich überfällig seit ‹hh:mm›“. Der Renderer bewertet das selbst (9.15), also auch dann, wenn der Takt im Main steht. Eine Zusage „spätestens“ gibt es nicht: Der Takt hat eine Sperre gegen Überholen, und eine lange Abfrage verschiebt die nächste Runde. Gemessen per Simulation in der Spec-Prüfung (`gegenpruef-spaetestens/sim.mjs`): Mit „spätestens Start + 300 s“ wäre die Zusage schon bei einem Abruf mit einer Zeitüberschreitung und Wiederholung (31,5 s) um 0,5 s gebrochen, bei vier Zeitüberschreitungen (63,5 s) um 32,5 s und bei HTTP 429 mit Retry-After um 61 s.

„Ohne Fortschritt“ in K7 = die Uhr des Renderers steht mehr als 105 s nach `letzterFortschritt` des Stands (9.6: Beginn oder Ende eines Schritts, neue Bytes eines Downloads); dann T76 mit dieser Zeit. 105 s = Leerlauf-Grenze (60 s) plus ein Takt (45 s): Ein Download ohne Daten bricht nach 60 s selbst ab, und der nächste Schritt beginnt; Dateizugriffe haben dagegen keine Zeitgrenze (9.8, hängendes Netzlaufwerk), und ohne diese Achse stünde „Abgleich läuft (‹i› von ‹n›)“ ohne Ende da. Der Text sagt „kein Fortschritt“, nicht „hängt“: Auch ein Agenda-Abruf mit Wiederholungen nach HTTP 429 (Retry-After bis 30 s je Versuch, `packages/iveo/src/client.ts:173`) kann so lange dauern. Wie bei „überfällig“ bewertet der Renderer selbst (9.15).

### 11.2 Ordner: Zeile je Side Event

Achsen: in der Ablage-Menge (ja / nein) · Ordner mit dieser `programId` gefunden (ja / nein) · Indexformat (1 / neuer / kaputt / fehlt) · Ordner anlegbar (ja / nein, auch „Pfad zu lang“) · Download (lädt dieses / dieses ist das aktive Side Event und wartet hinter dem Download eines anderen / sonst, auch ein nicht aktives in der Warteschlange) · Agenda-Abruf in dieser Sitzung (keiner / gelungen / gescheitert) · Stand aus einer früheren Sitzung (Index-Feld `stand` da / nicht da) · `n` (0 / > 0) · `k` (= `n` / < `n`) · Wartende oder Problem (ja / nein).

Nur in K7 bis K10, für jedes Side Event der Panel-Liste und jedes im Block „Weitere Side Events der Ablage“ (9.13). Die erste zutreffende Bedingung gewinnt. `n` = Anhänge laut iveo (gültig, ohne gelöschte), `k` = davon in aktueller Fassung im Ordner (Datei bzw. `.url`; eine vom Bediener geänderte Datei zählt mit, E33). ‹Stand› = „‹hh:mm›“, wenn der Zeitpunkt von heute ist, sonst „‹TT.MM.› ‹hh:mm›“.

| # | Bedingung | Zeile | „Ordner öffnen“ |
| --- | --- | --- | --- |
| S1 | nicht in der Ablage-Menge, kein Ordner gefunden | T40 | nein |
| S2 | nicht in der Ablage-Menge, Ordner gefunden (9.1) | T60 | ja |
| S3 | Indexformat neuer als 1 | T41 | ja |
| S4 | Ordner dieses Side Events nicht anlegbar oder „Pfad zu lang“ (9.12 Regel 10) | T63 | nein |
| S5 | lädt gerade eine Datei dieses Side Events | T43 | wenn existiert |
| S6 | aktives Side Event, wartet in der Warteschlange hinter dem Download eines anderen Side Events (9.4); ein anderes wartendes Side Event fällt nicht hierher, sondern zeigt seine Zeile nach S7–S13 | T62 | wenn existiert |
| S7 | in dieser Sitzung noch kein Abruf, kein Index | T42 | wenn existiert |
| S8 | in dieser Sitzung noch kein Abruf, Index vorhanden | T61 | wenn existiert |
| S9 | letzter Agenda-Abruf gescheitert, früher schon einmal gelungen (in dieser Sitzung oder Index-Feld `stand`) | T44 | wenn existiert |
| S10 | letzter Agenda-Abruf gescheitert, nie gelungen | T45 | wenn existiert |
| S11 | gelungen, `n` = 0 | T46 | wenn existiert (z. B. alles in `entfernt/`) |
| S12 | gelungen, `k` = `n`, keine Wartenden, kein Problem | T47 | wenn existiert |
| S13 | gelungen, sonst (`k` < `n`, Wartende oder ein Problem) | T48 | wenn existiert |

„Stand“ = Zeit des letzten gelungenen Agenda-Abrufs dieses Side Events, nach dem der Plan ausgeführt wurde; aus einer früheren Sitzung das Index-Feld `stand`.

**Zusätze**, an die Zeile gehängt: T72 (Index neu aufgebaut, bis zur nächsten Runde), T66 (weiterer Ordner mit derselben Kennung), T67 (vom Bediener geändert), T68 (gesperrte Endungen).

**‹Problem›-Formen** in T48, das erste nach Dateiname sortiert, bei mehreren „ (und ‹m› weitere)“:
- „‹Datei›: ‹Grund›“ (Gründe T22)
- „‹Datei›: ‹Grund› · nächster Versuch gegen ‹hh:mm›“ (Rückhaltung, 9.6)
- „‹Datei›: neue Fassung wartet, Datei ist geöffnet“
- „‹Datei›: Umbenennen wartet, Datei ist geöffnet“
- „Ordner-Umbenennen wartet, Inhalt ist geöffnet“ (9.1)
- „Index nicht schreibbar (‹Code›)“ (9.8)

### 11.3 Anhang-Liste

Achsen: Token (ja / nein) · aufgeklappt (ja / nein) · aktives Side Event (ja / nein) · Stand bekannt (ja / nein) · erster Abruf (läuft / gescheitert / gelungen) · letzte Prüfung (gelungen / gescheitert) · Liste (leer / nicht leer).

| # | Zustand (erste zutreffende Zeile) | Anzeige |
| --- | --- | --- |
| L0 | kein Token | kein 📎 (wie heute, `SideEventsPanel.tsx:177`) |
| L1 | aufgeklappt, erster Abruf läuft | T10 |
| L2 | aufgeklappt, erster Abruf gescheitert, kein Stand | T11 + „Erneut versuchen“ |
| L3 | aufgeklappt, Stand da, letzte Prüfung gescheitert | die Liste (leer: „Keine Anhänge an diesem Side Event“) + T14 |
| L4 | aufgeklappt, leer | T12 |
| L5 | aufgeklappt, Liste | Liste + T13 |
| L6 | zugeklappt, aktives Side Event, Stand bekannt | „📎 ‹n›“ |
| L7 | zugeklappt, sonst (nicht beobachtet, oder Stand noch unbekannt, etwa vor dem ersten Takt nach dem Öffnen oder bei gescheiterter Agenda) | 📎 ohne Zahl |

Panel schließen oder Show-Wechsel: alle Listen geleert und zugeklappt (8.1). Nach dem Wiederöffnen gilt L6, sobald der Main den Stand neu gesendet hat (8.1, 8.4 Nr. 3), bis dahin L7. „Stand ‹hh:mm›“ ist die Zeit der letzten gelungenen Prüfung (8.4), auch bei unveränderter Liste; ein hängender Wächter zeigt also eine alte Zeit.

### 11.4 Titler-Variablen

| Speaker in iveo | Launcher | Titler | `{{organisation}}` | `{{organisationen}}` |
| --- | --- | --- | --- | --- |
| ohne Organisation | 0.16.0 | 0.11.1 | leer | leer |
| eine: A | 0.16.0 | 0.11.1 | A | A |
| A, B; B Haupt | 0.16.0 | 0.11.1 | B | B · A |
| A, B; keine Haupt | 0.16.0 | 0.11.1 | A | A · B |
| A, A (doppelt) | 0.16.0 | 0.11.1 | A | A |
| beliebig | 0.15.0 | 0.11.1 | leer | leer |
| beliebig | 0.16.0 | 0.11.0 | leer | leer |
| beliebig, Rechner B | Master 0.16.0 | B: 0.11.1 | wie Zeilen 1–5 | wie Zeilen 1–5 |
| beliebig, Rechner B | Master 0.16.0 | B: 0.11.0 | leer | leer |
| eigene CSV ohne diese Spalten | – | 0.11.1 | leer | leer |

### 11.5 Launcher: Installationsfehler

| # | Lage | Meldung |
| --- | --- | --- |
| F1 | keine Quelle | „Keine Release-Quelle konfiguriert — Token oder Proxy in den Einstellungen hinterlegen.“ (`installer.ts:229`, unverändert) |
| F2 | Proxy 404, kein Release | T27 mit „Proxy 404: kein Release für ‹app›“ |
| F3 | Proxy 404, kein passendes Paket | T27 mit T28 |
| F4 | Proxy 401 | T27 mit „Proxy 401: unauthorized“ |
| F5 | Proxy 5xx mit JSON-`error` | T27 mit „Proxy ‹Status›: ‹error›“ (höchstens 200 Zeichen) |
| F6 | Proxy-Antwort ohne JSON | T27 mit „Proxy ‹Status› ‹Statustext›“ |
| F7 | Netzfehler | T27 mit der Meldung von `fetch` (wie heute) |
| F8 | GitHub-Quelle, kein passendes Paket (ebenso eine Proxy-Antwort mit Version, aber ohne Paket für diese Plattform, `apps/launcher/src/main/release-source.ts:195`) | T29 |
| F9 | Paket gefunden | Download wie heute |
| F10 | Launcher-Update: Abfrage gescheitert (F2–F7 sinngemäß) | „Update-Abfrage fehlgeschlagen: ‹Text aus 10.4›“ (`installer.ts:358`, Form unverändert) |
| F11 | Launcher-Update: kein passendes Paket | T69 statt „Kein Launcher-Installer für diese Plattform gefunden.“ (`installer.ts:363`) |

Der Proxy-Key und Header erscheinen nie in einer Meldung.

### 11.6 Texte (wörtlich)

Schreibweise: Jeder Text steht in einer eigenen Zeile oder als Variante (a), (b) …; die äußeren „…“ einer Zelle umschließen den Text, alles darin gehört zum Text. Platzhalter stehen in ‹…›.

| # | Ort | Text |
| --- | --- | --- |
| T1 | Show-Editor, Meldung nach „Ablauf übernehmen“ (baut `bindMeldung`, 5.9) | „„‹Event›“ übernommen — ‹p› Programmpunkte (Filter: ‹Filter›), ‹s› Speaker (Titler), davon ‹o› mit Organisation.“ Der Teil „, davon ‹o› mit Organisation“ nur bei ‹s› > 0. ‹Filter› im Agenda-Modus „Side Event „‹Titel›“ (Agenda)“ (typografisch statt ASCII-Schlusszeichen, `ShowEditorModal.tsx:249`), sonst die Kriterien oder „alle“. Bei einer Warnung folgt wie heute „ ⚠ ‹Warnung›“ (`:260`). |
| T2 | Launcher-Log (Info), Auffrischen ohne Änderung | „iveo: Speakerliste aufgefrischt, unverändert (‹n› Speaker).“ (‹n› = Speaker in der Datei) |
| T3 | Launcher-Log (Warnung), Detail beim Auffrischen gescheitert | „iveo: Programm-Detail beim Auffrischen nicht abrufbar (‹Fehler›), Verknüpfung, Startzeit und Kategorie aus früherem Stand.“ |
| T4 | Antwort beim Umschalten ohne Verknüpfung, ohne Merker (hinter „Umgeschaltet — “) | „iveo verknüpft keine Speaker mit diesem Side Event. Die bisherige Speakerliste bleibt bis zur nächsten Auffrischung (in der Regel binnen 5 Minuten), danach gelten alle Speaker des Events.“ |
| T5 | Einstellungen, Hinweis iveo | „iveo-Eventplattform (#11): Basis-URL der API. Leer = Standard (Production). Das Token ist pro Event und wird beim Anlegen einer Show eingetragen — es liegt verschlüsselt hier und nie in der Show-Datei.“ |
| T6 | Einstellungen, Platzhalter | „https://app.my-iveo.de/api/v1“ |
| T7 | Show-Editor, Platzhalter Basis-URL | „Basis-URL (leer = ‹Standardadresse dieses Rechners›)“, ‹…› aus `settings.iveoBaseUrl` des Renderers, z. B. „Basis-URL (leer = https://app.my-iveo.de/api/v1)“ |
| T8 | Fehler bei ungültiger Adresse (`client.ts:45`) | „Ungültige iveo-Basis-URL: „‹Eingabe›“. Beispiel: https://app.my-iveo.de/api/v1“ |
| T9 | Einstellungen, unter dem Feld | „Standard für neue Bindungen und Shows ohne Adresse: ‹URL›“ |
| T10 | Anhang-Liste, lädt | „Lade Anhänge…“ |
| T11 | Anhang-Liste, Fehler | „Anhänge konnten nicht geladen werden: ‹Fehler›“ (ohne Fehlertext: „Anhänge konnten nicht geladen werden.“) |
| T12 | Anhang-Liste, leer | „Keine Anhänge an diesem Side Event · Stand ‹hh:mm›“ |
| T13 | Anhang-Liste, Stand | „Stand ‹hh:mm›“ |
| T14 | Anhang-Liste, Nachladen gescheitert | „Stand ‹hh:mm› · Aktualisieren gescheitert: ‹Fehler›“ |
| T15 | Notice, Download eines gelöschten Anhangs | „Anhang wurde in iveo gelöscht.“ |
| T16 | Notice, Anhang nicht mehr da | „Anhang nicht mehr in iveo vorhanden.“ |
| T17 | Launcher-Log (Info), Anhänge geändert | „iveo: Anhänge von „‹Titel›“ geändert, jetzt ‹n›.“ (‹Titel› aus der Bindung, sonst die `programId`) |
| T18 | Speichern-Dialog, Titel | „Anhang speichern“ |
| T19 | 📎, Tooltip | „Anhänge (Präsentationen, Dateien, Links) anzeigen“ |
| T20 | Notice nach Download (statt „Gespeichert & geöffnet: …“, `iveo-sync.ts:699`) | „Gespeichert und geöffnet: ‹Label›“ |
| T21 | Launcher-Log (Info) | (a) „iveo-Ordner: „‹Datei›“ geladen (‹x› MB).“ (b) „iveo-Ordner: „‹alt›“ in „‹neu›“ umbenannt.“ (c) „iveo-Ordner: „‹Datei›“ nach „entfernt“ verschoben (in iveo entfernt).“ (d) „iveo-Ordner: „‹Datei›“ nach „entfernt“ verschoben (durch neue Fassung ersetzt).“ (e) „iveo-Ordner: „‹Datei›“ aus „entfernt“ zurückgeholt.“ (f) „iveo-Ordner: „‹Datei›“ übernommen (lag schon im Ordner).“ |
| T22 | Gründe (Status und Log) | (a) „zu groß (‹x› MB, Grenze 2048 MB)“ (b) „mehr Daten als angekündigt (‹x› MB)“ (c) „zu wenig Speicherplatz (frei ‹x› MB)“ (d) „Speicherplatz nicht prüfbar (‹Code›)“ (e) „keine Daten seit 60 s, abgebrochen“ (f) „unvollständig (‹x› von ‹y› Bytes)“ (g) „in iveo ohne Datei“ (h) „Link ohne gültige Adresse“ (i) „ungültiger Anhang in iveo (‹Feld›)“ (j) „Pfad zu lang“ (k) „Schreibfehler (‹Code›)“ (l) „„entfernt“ ist kein Ordner“ (m) „Agenda in iveo nicht gefunden (404)“ (n) „Datei in iveo nicht gefunden (404)“ (o) „Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).“ (p) „iveo-Server-Fehler (HTTP ‹Status›)“ (q) „iveo antwortet nicht innerhalb von 15 s“ (r) sonst die Meldung des Fehlers (höchstens 200 Zeichen) (s) T77 (a) |
| T23 | Launcher-Log (Warnung) | „iveo-Ordner: „‹Datei›“ nicht geladen: ‹Grund› (‹Rohmeldung›).“ |
| T24 | Launcher-Log (Warnung) | „iveo-Ordner: Index von „‹Ordner›“ beschädigt, beiseitegelegt und neu aufgebaut (‹n› Dateien übernommen).“ |
| T25 | Launcher-Log (Warnung) | „iveo-Ordner: Agenda von „‹Titel›“ nicht abrufbar: ‹Grund› (‹Rohmeldung›).“ |
| T26 | Schalter in der Kopfzeile (Vorgabe, OF8) | „Anhänge in Side-Event-Ordnern ablegen“ |
| T27 | Installationsfehler | „Release-Abfrage fehlgeschlagen: ‹Text aus 10.4›“ |
| T28 | Proxy-Fehler (404) | (a) „kein Release von ‹app› mit einem Paket für macOS (‹arch›)“ (b) „kein Release von ‹app› mit einem Paket für Windows“ |
| T29 | Quelle liefert kein Paket (F8) | (a) „Kein Release mit einem Paket für diesen Rechner gefunden (macOS, Launcher-Architektur ‹arch›).“ (b) „Kein Release mit einem Paket für diesen Rechner gefunden (Windows).“ |
| T30 | Knopf | „Ordner öffnen“ |
| T31 | Notice, Ordner nicht zu öffnen | „Ordner nicht zu öffnen: ‹Grund›“ |
| T32 | Kopfzeile K1 | „Dieser Rechner hat die Rolle „Mit Master verbinden“ und legt keine Anhänge ab.“ |
| T33 | Kopfzeile K2 | „Anhänge lädt nur der Launcher mit dem iveo-Token dieser Show.“ |
| T34 | Kopfzeile K3 | „Ablage in Side-Event-Ordnern ausgeschaltet.“ |
| T35 | Kopfzeile K4 | „Show-Datei am Öffnungspfad nicht gefunden oder nicht lesbar. Ablage pausiert, bis sie wieder da ist.“ |
| T36 | Kopfzeile K6 | „Ordner „‹Name›“ nicht anlegbar (‹Code›). Nächster Versuch gegen ‹hh:mm›.“ |
| T37 | Kopfzeile K7 | „Ablage: „‹Name›“ · Abgleich läuft (‹i› von ‹n›)“ |
| T38 | Kopfzeile K9 | „Ablage: „‹Name›“ · nächster Abgleich gegen ‹hh:mm›“ |
| T39 | Kopfzeile K10 | „Ablage: „‹Name›“ · noch nichts abgelegt · nächster Abgleich gegen ‹hh:mm›“ |
| T40 | Zeile S1 | „Nicht in der Ablage dieser Show, kein Ordner.“ |
| T41 | Zeile S3 | „Ordner stammt von einem neueren Launcher und wird hier nicht verändert.“ |
| T42 | Zeile S7 | „Anhänge: noch nicht abgeglichen“ |
| T43 | Zeile S5 | „Anhänge: lädt „‹Datei›“ (‹x› von ‹y› MB) …“ (ohne Größe: „Anhänge: lädt „‹Datei›“ (‹x› MB) …“) |
| T44 | Zeile S9 | „Anhänge: ‹k› von ‹n› im Ordner · Stand ‹Stand› · Abgleich gestört: ‹Text› (seit ‹hh:mm›)“ (‹Text› = `ordnerFehlerText`, 9.13) |
| T45 | Zeile S10 | „Anhänge: Abgleich gestört: ‹Text› (seit ‹hh:mm›)“ |
| T46 | Zeile S11 | „Keine Anhänge · Stand ‹Stand›“ |
| T47 | Zeile S12 | „Anhänge: ‹n› im Ordner · Stand ‹Stand›“ |
| T48 | Zeile S13 | „Anhänge: ‹k› von ‹n› im Ordner · Stand ‹Stand› · ‹Problem›“ |
| T49 | Katalog, Connect | 10.6 |
| T50 | Statuszeile (Merker `detailVeraltetSeit`, 6.3) | „Programm-Detail von iveo nicht abrufbar, Speaker-Verknüpfung aus früherem Stand“ |
| T51 | Statuszeile (Merker `orgFehlenSeit`, 5.10) | „iveo liefert keine Organisationen (Feld fehlt), Organisationen aus früherem Stand“ |
| T52 | Panel unter „Keine iveo-gebundene Show geöffnet.“ (K0) | „Anhänge werden erst mit einer geöffneten Show-Datei in Ordnern neben ihr abgelegt.“ |
| T53 | Notice, Link im Panel ungültig (8.6) | „Link ohne gültige Adresse, nicht geöffnet.“ |
| T54 | Notice, Datei-Anhang ohne Datei (`iveo-sync.ts:686`) | „Kein Datei-Anhang vorhanden.“ |
| T55 | Launcher-Log (Info), Liste geholt (`iveo-sync.ts:654`) | „iveo: Side Event „‹programId›“: ‹n› Anhänge.“ |
| T56 | Launcher-Log (Info), manuell gespeichert (`iveo-sync.ts:698`) | „iveo: Anhang „‹Label›“ gespeichert (‹n› Bytes) → ‹Pfad›“ |
| T57 | Kopfzeile K5, anderer Rechner (9.2 Regel 5) | „Ablage liegt bei Rechner „‹Name›“ (letztes Lebenszeichen ‹hh:mm›); dieser Rechner legt nichts ab und übernimmt gegen ‹hh:mm›, wenn kein neues Lebenszeichen kommt.“ (‹Name› = `rechner` der Sperrdatei, nie der eigene; die zweite Zeit = Lebenszeichen + 15 min) |
| T58 | Kopfzeile K8 | „Ablage: „‹Name›“ · erster Abgleich folgt“ |
| T59 | Kopfzeile K9 und K10 nach Ablauf | „Ablage: „‹Name›“ · Abgleich überfällig seit ‹hh:mm›“ |
| T60 | Zeile S2 | „Nicht mehr in der Ablage dieser Show, Ordner bleibt unverändert.“ |
| T61 | Zeile S8 | „Anhänge: ‹k› im Ordner · Stand ‹Stand› (frühere Sitzung) · Abgleich folgt“ |
| T62 | Zeile S6 | „Anhänge: wartet auf den laufenden Download „‹Datei›“ (anderes Side Event)“ |
| T63 | Zeile S4 | „Anhänge: Ordner nicht anlegbar: ‹Grund›“ |
| T64 | Zusatz Kopfzeile K7, K9 (nur bei ‹m› > 0) | „ · ‹m› Side Events gestört“ |
| T65 | Überschrift des Blocks (9.13) | „Weitere Side Events der Ablage“ |
| T66 | Zusatz Zeile | „ · weiterer Ordner „‹Name›“ mit derselben Kennung wird nicht gepflegt“ |
| T67 | Zusatz Zeile | „ · ‹m› vom Bediener geändert“ |
| T68 | Zusatz Zeile | „ · ‹m› Dateien mit gesperrter Endung umbenannt“ |
| T69 | Launcher-Update ohne Paket (F11) | (a) „Kein Launcher-Installer für diesen Rechner gefunden (macOS, Launcher-Architektur ‹arch›).“ (b) „Kein Launcher-Installer für diesen Rechner gefunden (Windows).“ |
| T70 | Launcher-Log (Info) | „iveo-Ordner: Endung „‹ext›“ von „‹Label›“ gesperrt, abgelegt als „‹Datei›“.“ |
| T71 | Launcher-Log (Warnung), 5.10 | „iveo: kein Speaker trägt Organisationen (Feld fehlt), Organisationen aus der Datei bleiben.“ |
| T72 | Zusatz Zeile (9.8) | „ · Index war beschädigt und ist neu aufgebaut“ |
| T73 | Kopfzeile K5, namensgleich (9.2 Regel 4) | „Ablage von einem zweiten Launcher mit demselben Rechnernamen „‹Name›“ übernommen (anderer Benutzer an diesem Rechner oder Rechner mit gleichem Namen); dieser Launcher legt nichts ab, bis die Show neu geöffnet wird.“ |
| T74 | Notice nach Download, Datei nicht geöffnet (8.6) | „Gespeichert, nicht automatisch geöffnet (Endung „‹ext›“ gesperrt): ‹Dateiname›“ (‹ext› = gesperrte Endung aus dem Label, sonst die des gewählten Namens) |
| T75 | Launcher-Log (Warnung), Sperre nicht gelöscht (9.2) | „iveo-Ordner: Sperrdatei in „‹Ordner›“ nicht gelöscht (‹Code›); ein anderer Rechner übernimmt die Ablage erst nach 15 Minuten.“ |
| T76 | Kopfzeile K7 ohne Fortschritt (11.1) | „Ablage: „‹Name›“ · Abgleich läuft (‹i› von ‹n›) · kein Fortschritt seit ‹hh:mm›“ (‹hh:mm› = `letzterFortschritt`, 9.6) |
| T77 | Asset-Adresse abgelehnt (E52, 9.6) | (a) Grund in Zeile und Log wie T22: „Datei-Adresse auf anderem Server ohne https“ (b) Notice beim Speichern im Panel (8.6): „Anhang nicht geladen: Datei-Adresse auf anderem Server ohne https.“ |

Bestehende Texte, die sich ändern: „Lade Materialien…“ → T10; „Materialien konnten nicht geladen werden: …“ und „Materialien konnten nicht geladen werden.“ (`apps/launcher/src/renderer/src/store/tools.ts:447`, `:455`) → T11; „Keine Materialien an diesem Side Event.“ → T12; „Materialien (Präsentationen/Dateien) anzeigen“ → T19; „Material nicht gefunden.“ → T16; „Material speichern“ → T18; „Kein Datei-Asset vorhanden.“ → T54; die Logzeilen `iveo-sync.ts:654` und `:698` → T55, T56; „Leer = Standard (Staging)“ → T5; „Basis-URL (leer = Standard/Staging)“ → T7; „Kein passendes Artefakt für diese Plattform gefunden.“ → T29; „Kein Launcher-Installer für diese Plattform gefunden.“ → T69; „Gespeichert & geöffnet: …“ → T20; „iveo verknüpft keine Speaker mit diesem Side Event — bestehende Speakerliste bleibt.“ → T4; der Kommentar „leer = Staging-Default“ (`apps/launcher/src/shared/types.ts:56`) → „leer = Standard (Production)“.

---

## 12 · Tests

Alle Selbsttests laufen ohne Netz und ohne Fenster (Ausnahme: 12.4 Nr. 47 öffnet einen Server auf 127.0.0.1). Jede **Gegenprobe** wird einmal im Plan ausgeführt, ihr Ergebnis (rot an der erwarteten Stelle) kommt in den Aufgabenbericht.

### 12.1 `@jm/iveo` und `@jm/show` (`npm run selftest -w @jm/iveo`)

1. `organisationenVon`: jede Zeile der Tabelle 5.2.
2. `normalisiereOrganisationen`: kein Array → `[]`; Nicht-Strings fallen weg; NFC; Leerraum; 200 Codepunkte bleiben, 201 werden gekürzt (Emoji an der Grenze bleibt ganz); 20 bleiben, der 21. fällt weg; Doppelte; Reihenfolge bleibt.
3. Normalisierer: `organisationen` bleibt; leer → Feld fehlt; Schlüsselreihenfolge des Speakers `["id","name","title","organisationen"]`.
4. `serializeShow` → `parseShow` behält `organisationen`.
5. `speakersToShowSpeakers` setzt `organisationen`, ohne Kennung und Rolle, ohne Bio (Fixture `:67-70` bekommt `organisations` mit Haupt an zweiter Stelle und einer Rolle).
6. Fixpunkt: Ausgabe des Mappers = Ausgabe nach `migrateShow` (wie `:368`).
7. `IVEO_DEFAULT_BASE_URL` und `normalizeIveoBaseUrl('')` = `https://app.my-iveo.de/api/v1`.
8. `oeffneAsset`: übergibt `signal`, liefert `body`, wirft `IveoApiError` bei 404, folgt der Umleitung mit `redirect: 'follow'`; die Anfrage-URL ist wie bei `fetchAsset` (`packages/iveo/test/selftest.ts:289-304`). **Abbruch:** Ist das Signal des Aufrufers abgebrochen und wirft `fetchImpl`, gibt es genau einen Aufruf und keine Wartezeit; ein `TimeoutError` ohne Signal des Aufrufers wird wie heute wiederholt (1 + `maxRetries` Aufrufe). **Keine Weiterleitungsadresse:** Die Attrappe setzt `res.url` auf `https://signed.example/x?X-Amz-Signature=GEHEIM-SIG`; kein Wert im Ergebnis von `oeffneAsset` enthält „GEHEIM“.
9. `showFuerVerbund` reicht `organisationen` weiter (Fixture `:805` bekommt einen Speaker mit Organisationen).
10. Größe im Verbund (5.8), in `apps/launcher/test/verteiler.test.ts`, wo die Stand-Zeile gebaut wird: COP31-ähnliche Show (239 Speaker, je zwei Organisationen mit 80 Zeichen) → die kodierte Stand-Zeile bleibt unter `GRENZEN.maxStandZeile` (921 600 Bytes, `packages/master-link/src/fristen.ts:71`).
11. **Herkunft des Tokens (E52):** `assetAnfrage` mit Basis `https://app.my-iveo.de/api/v1`; die Attrappe protokolliert Adresse und Kopfzeilen jedes Abrufs. Nackte Kennung, `assets/‹id›` und eine Referenz in der gemessenen Form (279 Zeichen, ein Punkt, M1) → `https://app.my-iveo.de/api/v1/assets/‹id bzw. Referenz›` mit `Authorization`; volle Adresse gleicher Herkunft → mit; `https://fremd.example/x` → ohne; `https://app.my-iveo.de:8443/x` (anderer Port) → ohne; `http://fremd.example/x` und `http://app.my-iveo.de/x` (anderes Schema) → kein Abruf, `IveoAssetAdresseError`; Basis `http://127.0.0.1:‹Port›` mit Adresse derselben Herkunft → mit. Dieselben Fälle über `oeffneAsset` und `fetchAsset`: Das Token `iveo_live_GEHEIM` steht nur in Anfragen an `app.my-iveo.de`.

**Gegenproben:** (a) Nr. 4 gegen den alten Normalisierer (Speaker-Block ohne `organisationen`) → rot. (b) `fetchWithRetry` ohne Abbruchprüfung → Nr. 8 „genau ein Aufruf“ rot. (c) Herkunftsregel weg (`authHeaders()` für jede Adresse, wie heute `client.ts:365`) → das Token geht an `https://fremd.example`, Nr. 11 rot.

### 12.2 Launcher-Kern (`apps/launcher/test/iveo-abgleich.test.ts`)

Vorweg: Das nachgebaute iveo (`:124-238`) bekommt Speaker mit `organisations` (eigene Fixture-Variante; `ANA` bleibt ohne, damit die 2a/2b-Fälle unverändert laufen) und Agenda-Punkte mit `materials` (Datei, Link, gelöscht). `getProgram` liefert auf Wunsch `speakers[] {speaker_id, role_on_program, sort_order}` wie auf Prod. Fälle, die „fällig“ brauchen, setzen Uhr und `taktMs` ausdrücklich (M2).

1. Signatur: gleiche Speaker, andere Organisationen → andere Signatur; Feld fehlt und `[]` → gleiche.
2. Listen-Modus, Bestands-Show ohne Organisationen, keine Programmänderung: Abfrage 254 s nach dem Öffnen → kein Snapshot; Abfrage 255 s nach dem Öffnen → Snapshot, genau einmal geschrieben, genau ein RELOAD, Logzeile „… die Speakerliste weicht von der Datei ab …“. Nächste Auffrischung ohne Änderung → nichts geschrieben, T2 im Log.
3. Zeitgarantie: Takt alle 45 s, Änderung in iveo zu einem beliebigen Zeitpunkt → spätestens 300 s später in der Datei (Schleife über 45 Startversätze).
4. Agenda-Modus mit Verknüpfung über das Detail: Auffrischen holt Speakerliste und Detail; neu verknüpfter Speaker kommt in die Datei; umbenannter Speaker ändert „Verantwortlich“; Startzeit in iveo verschoben → neuer Startzeit-Anker in der Datei, genau ein RELOAD; unverändertes Detail → nichts geschrieben.
5. Agenda-Modus ohne Verknüpfung: Auffrischen schreibt die ganze Event-Liste (OF2).
6. **Agenda-Modus mit Kontext**, kein Merker vorher, Auffrischen scheitert (Speaker 500) → Merker gesetzt, einmal geschrieben, Status mit Text aus 2b-Spec 6.3, H7-fähig; nächste Abfrage holt die Liste wieder (unabhängig von „fällig“); Erfolg → Merker weg.
7. Detail scheitert beim Auffrischen → Speaker trotzdem aufgefrischt, alte Verknüpfung; Merker `detailVeraltetSeit` gesetzt, Statuszeile mit T50 (`ok: false`), T3 einmal im Log, kein Abbruch, nicht geschrieben (der Merker ist nicht Teil der Signatur); der nächste Takt holt das Detail erneut, auch wenn nicht „fällig“; gelingt es → Merker weg, Statuszeile in Ordnung. **Gegenprobe:** Variante ohne den Merker (nur Log) → rot.
8. Schreiben scheitert nach dem Auffrischen → `speakerAbgerufen` rückt nicht vor; nächster Takt holt erneut.
9. Umschalten mit Verknüpfung → `speakerAbgerufen` rückt vor; Umschalten ohne Verknüpfung → Antwort T4 (ersetzt die Prüfung `:750-751`, 12.8).
10. `offeneShowGespeichert` mit gleicher Bindung behält `speakerAbgerufen`, `orgFehlenSeit` und (gleiches Side Event) `detailVeraltetSeit`, und die Statuszeile bleibt direkt nach dem Speichern „gestört“ mit T50 bzw. T51; neu gebunden → alles neu. Umschalten löscht `detailVeraltetSeit` (6.5). **Gegenprobe:** `setzeAuf` ohne die neuen Felder → Statuszeile nach dem Speichern „in Ordnung“, rot.
11. `meldeAgenda`: direkt nach einer gültigen Agenda mit der Agenda; nicht bei einer Abfrage, die ein Umschalten überholt hat; `{ok: false}` bei Agenda-Fehler, danach Status „gestört“ wie heute.
12. `meldeAgenda` kommt auch, wenn derselbe Takt danach wirft: Show ohne Kontext mit Merker, Speakerliste 500 (`:812` wirft) → Wächter hat die Agenda, Status „gestört“ wie heute. **Gegenprobe:** Meldung erst nach `:839` → rot.
13. Fehlendes Feld (5.10): Speakerliste ohne `organisations` an allen Speakern, Datei mit Organisationen → Organisationen bleiben, Statuszeile mit T51, T71 einmal im Log; Feld wieder da (auch leer) → Merker weg. **Gegenprobe:** ohne die Regel → Organisationen verschwinden, rot.
14. `speakerAbgerufen` = Zeit **vor** dem Abruf: `listSpeakers` dauert in der Testuhr 20 s → das nächste Auffrischen ist 255 s nach Abrufbeginn fällig, nicht nach Abrufende.

**Gegenproben:** (a) Kern ohne Organisationen in der Signatur → Nr. 2 rot. (b) Schwelle 300 s ohne Takt-Abzug → Nr. 3 rot.

### 12.3 Anhang-Wächter (neu `apps/launcher/test/iveo-anhaenge.test.ts`, in `selftest:iveo`) und Renderer-Helfer

1. `materialienAusAgenda`: flach über alle Agenda-Punkte; gelöschte fehlen; Label-Rückfall „(ohne Titel)“; Reihenfolge wie iveo. `istGeloescht`: `null`, fehlend, `false`, `''` → nicht gelöscht; `'2026-10-16T…'`, `1`, `true` → gelöscht. Laufzeitprüfung (8.5): leere `id`, unbekanntes `kind` → ungültig; `size_bytes` als Text → unbekannt; dieselbe Kennung an zwei Punkten → einmal.
2. Signatur (8.3, M1): Die Attrappe liefert Referenzen in der gemessenen Form, je Abruf gleich, mit dem Marker `GEHEIM-ASSET` darin. Andere Referenz, sonst gleich → andere Signatur; gleiche Referenz → gleiche Signatur; der Signaturtext enthält den SHA-256 der Referenz, aber weder den Marker noch einen 16-Zeichen-Ausschnitt der Referenz.
3. Ereignisse: erste Beobachtung → Ereignis mit `materials`; drei Takte unverändert → drei Ereignisse **ohne** `materials`, jedes mit neuer Zeit `abgerufen`; Label geändert → mit `materials`; Anhang gelöscht → mit `materials` ohne ihn.
4. Fehler mit Vorgeschichte: gelungen → Fehler → `ok: false`; gleicher Fehler wieder → keins; anderer Text → eins; Erfolg bei unveränderter Liste → `ok: true` mit `materials`. **Gegenprobe:** Wächter ohne den Auslöser „gescheitert → gelungen“ → rot.
5. Aufgeklappte Liste (nicht aktiv) → ein Agenda-Abruf je Takt; aktives Side Event → kein Abruf, die Liste kommt aus `agendaVomKern`; zugeklappt → kein Abruf.
6. `zuruecksetzen` nach Show-Wechsel → nächste Beobachtung gilt als erste.
7. IPC-Eingabe: mehr als 8 Kennungen oder zu lange → verworfen. Jede Anmeldung, auch `[]`, sendet für jede beobachtete Liste mit bekanntem Stand (auch das aktive Side Event) ein Ereignis mit `materials`.
8. Renderer-Zeilen L0–L7 (reine Funktion für Zahl am 📎 und Stand-Zeile) über das Kreuzprodukt der Achsen aus 11.3.
9. Renderer-Helfer `anhangListeSchritt` (8.1), im Launcher-Selbsttest (`apps/launcher/test/selftest.ts`, wie die Renderer-Helfer in `:5`, `:7`): Aufklappen mit schon vorhandener Liste → lädt; `panelZu` → Listen leer, `materialsOffen` `null`; danach Aufklappen → lädt; Ergebnis mit älterem `abgerufen` → verworfen; Ergebnis für eine nicht beobachtete Liste → verworfen. Wechsel des aktiven Side Events im selben Event: `aktiv` = A mit Stand, A zugeklappt; `aktivWechsel(B)` → A ohne Zahl (L7); erstes Ergebnis für B → übernommen (L6); ein danach eintreffendes Ergebnis für A → verworfen. **Gegenproben:** alte Bedingung „nur ohne Liste laden“ (`SideEventsPanel.tsx:66`) → rot; Helfer ohne `aktivWechsel` (`aktiv` bleibt A) → das erste Ergebnis für B wird verworfen, rot.

**Gegenproben (Signatur):** Signatur ohne den Hash (Fassung vor M1) → Nr. 2 „andere Referenz → andere Signatur“ rot; Signatur mit der Referenz selbst statt ihres Hashes → Nr. 2 „kein Marker im Signaturtext“ rot.

### 12.4 Side-Event-Ordner (neu `apps/launcher/test/side-event-ordner.test.ts`, in `selftest:iveo`)

**Dateisystem-Attrappe** im Speicher, in der Form von `fs/promises`:
- Namen werden unverändert gespeichert und zurückgegeben (auch NFD). Drei Profile für das Nachschlagen: „NTFS“ (Groß- und Kleinschreibung egal, NFC und NFD verschieden; gemessen), „APFS“ (beides egal; **Annahme**), „HFS+/SMB vom Mac“ (liefert Namen in NFD zurück; **Annahme**).
- `rename` auf einen bestehenden Namen **ersetzt** die Datei still, auch bei anderer Schreibweise (wie gemessen); `rename` mit EBUSY für als „geöffnet“ markierte Dateien.
- `statfs` mit einstellbarem freien Platz und auf Wunsch mit Fehler; Fehler auf Wunsch (EACCES beim Anlegen, ENOSPC nach N Bytes, Index-Schreiben scheitert); auf Wunsch eine Operation, die nicht zurückkehrt (hängendes Netzlaufwerk, Nr. 49); „fremde Datei taucht auf“ zu einem gewählten Zeitpunkt; `sync` und `rename` werden protokolliert; symbolische Verknüpfungen für `lstat`.
- Zwei Läufe können sich eine Attrappe teilen (Nr. 40).

**Download-Attrappe:** Datenstrom in Stücken, mit Stillstand, mit zu wenigen und zu vielen Bytes, mit den Markern aus Nr. 41. Uhr und Zeitgeber von außen.

Namen (9.12):
1. Tabelle: `CON`, `con.txt`, `CON .pdf`, `nul  .txt`, `CONIN$`, `COM¹`, `LPT9.pdf`, `Präsentation.`, `Präsentation  `, `.versteckt`, `..`, `../x`, `a/b`, `a\b`, `a:b`, `a*?"<>|b`, Steuerzeichen, U+0085, U+200B, `Slides‹U+202E›txt.exe`, NFD-Eingabe, 300 Zeichen mit Emoji an der Schnittstelle, leer, `entfernt`.
2. Endung aus Label; aus MIME; keine; „Version 2.10“ → MIME-Endung. Sperrliste: „Agenda.exe“ mit `application/pdf` → „Agenda_exe.pdf“; Datei-Anhang „x.url“ → „x_url.‹MIME-Endung›“; „www.example.com“ → „www.example_com.‹MIME-Endung›“; „x.library-ms“ ohne bekannten MIME-Typ → „x_library-ms.bin“; „Deck.pptm“ bleibt. Log T70, Zusatz T68.
3. Kollision mit fremder Datei (anders geschrieben) → „ (2)“; zwei gleichnamige Anhänge → „ (2)“ stabil, auch wenn ein dritter dazukommt.
4. Pfadlänge: tiefer Basisordner → Stamm gekürzt; zu tief → „Pfad zu lang“ (S4); an der Grenze bleibt die längste Form `entfernt\… (unvollständig …) (99)…` ≤ 250 (9.12 Regel 10), ebenso die mit „ersetzt“; Ordner an der Grenze seines Budgets, Stamm mit 8 Zeichen, „ (99)“ und eine Endung mit 5 Zeichen → die längste Form passt in die Reserve von 60; eine Kürzung, die auf Leerzeichen oder Punkt endet, wird nachbereinigt; Side-Event-Ordner lässt Platz für `entfernt\` und die Reserve; lange Kennung im Zwischennamen mit Hash gekürzt. **Gegenprobe:** Kürzung nach der Form mit „ersetzt“ (erste Fassung von Regel 10) → die Form mit „unvollständig“ überschreitet 250 um bis zu 6 Einheiten, rot.
5. Traversal-Wächter: Bereinigung absichtlich ausgeschaltet, Label `../../x` → Schritt bricht ab, kein Zugriff außerhalb.

Plan und Ausführung (9.5–9.10):
6. Neuer Datei-Anhang (Agenda-Modus) → geladen über `.‹id›.‹pid›.jm-laden`, Index-Eintrag `laedt` vor dem Umbenennen, dann `aktiv`; **solange Bytes fließen, existiert der Zielname nicht**.
7. Label geändert → umbenannt, kein Download.
8. Größe geändert → neue Fassung geladen, alte in `entfernt/… (ersetzt ‹Datum Zeit›)…`. Asset-Referenz geändert bei gleicher Größe und gleichem MIME-Typ → ebenso; gleiche Referenz über zehn Runden → kein Download; das Index-Feld `inhalt` trägt den SHA-256 der Referenz, nicht die Referenz (8.3, M1). **Gegenprobe:** Inhaltssignatur ohne den Hash (Fassung vor M1) → „Referenz geändert → neue Fassung“ rot.
9. Anhang fehlt in iveo → nach `entfernt/`; kommt zurück → zurückgeholt ohne Download.
10. `purged_at` gesetzt → nach `entfernt/`.
11. Vom Bediener gelöschte Datei → neu geladen.
12. Vom Bediener geänderte Datei, iveo gleich → unberührt, Zusatz T67; iveo neue Fassung → Bediener-Datei nach `entfernt/`.
13. Fremde Datei im Ordner → nie angefasst (Inhalt und Name gleich nach zehn Runden).
14. Alte Fassung geöffnet → neue wartet als `.‹id›.‹pid›.jm-neu`, Status „neue Fassung wartet …“; nächste Runde ohne Download getauscht, sobald frei.
15. Umbenennen bei geöffneter Datei → wartet, Problem-Form.
16. Index kaputt → beiseitegelegt als `.jm-anhaenge.kaputt-…`, gleichnamige Dateien gleicher Größe übernommen, andere geladen; Zusatz T72; T24.
17. Index `format: 2` → nichts geändert, S3.
18. Ordner wiederfinden über `programId` nach Umbenennen durch den Bediener; Titel in iveo geändert → Ordner umbenannt nur, wenn er noch den alten Namen trägt.
19. Link: `.url`-Inhalt byteweise (CRLF, kein BOM, genau zwei Zeilen); `javascript:`, `file:`, `smb:`, `search-ms:` → Fehler, keine Datei; Rohtext mit führenden Leerzeichen → `.url` enthält genau `href`; die Eingabe aus der Messung (CR LF + `IconFile=…`) → Fehler „Link ohne gültige Adresse“, keine Datei; Adresse geändert → alte `.url` nach `entfernt/… (ersetzt …).url`, neue geschrieben. Dieselben Fälle für das Öffnen im Panel über `panelAnhangSchritt` (8.6): nur gültige Links ergeben `{art: 'link', href}` mit genau `href`, sonst `{art: 'fehler'}` mit T53; Link ohne `external_url` → „Kein Link vorhanden.“. **Gegenproben:** Variante schreibt den Rohtext → rot; `panelAnhangSchritt` gibt `external_url` ungeprüft zurück → rot.
20. Größe > 2 GiB → nicht geladen, Grund; wenig Platz → nicht geladen; `statfs` scheitert → „Speicherplatz nicht prüfbar“; ohne `size_bytes` fällt der freie Platz während des Ladens unter 1 GiB → Abbruch; mehr Bytes als `size_bytes` → Abbruch „mehr Daten als angekündigt“, Zwischendatei gelöscht.
21. Stillstand 60 s (Zeitgeber) → abgebrochen, Zwischendatei gelöscht, Grund; während Bytes flossen, existierte der Zielname nie.
22. Zu wenige Bytes → Fehler, Zwischendatei gelöscht.
23. Abbruch durch Show-Wechsel mitten im Download → Zwischendatei gelöscht, Warteschlange leer, **kein** Fehler, kein Log, kein Status; ein Agenda-Ergebnis, das danach zurückkommt, wird verworfen (Lauf-Generation).
24. Aufräumen nur mit eigener Sperre und nur nach Muster: übrig gebliebene `.‹id›.‹pid›.jm-laden` und `….‹pid›.tmp` gelöscht; eine fremde Datei `notiz.jm-laden` bleibt; eine `.jm-neu`, die der Index nennt, bleibt, eine ungenannte nach Muster wird gelöscht.
25. Side Event ohne Anhänge → kein Ordner (OF4); erster Anhang → Basis- und Side-Event-Ordner entstehen.
26. Show-Datei fehlt → kein Dateizugriff außer der Prüfung, K4; Datei wieder da → nächster Takt legt wieder ab.
27. Je eigener Fall: Rolle `slave`, kein Token, Schalter aus, fremde gültige Sperre, namensgleiche Sperre → kein iveo-Abruf; Dateizugriffe nur nach den Ausnahmen aus 9.2, die Attrappen zählen: bei `slave` und ohne Token null; bei „Schalter aus“ nur die Existenzprüfung des Basisordners (`stat`, höchstens eine je Takt, auch bei einer `stat`, die nicht zurückkehrt, keine zweite); bei der Sperre nur die Prüfung der Show-Datei und das Lesen der Sperrdatei. Rolle und Token kommen eingereicht (`rolle()`, `tokenDa()`, 9.15); „kein Token“ zusätzlich als Wegfall mitten in der Sitzung bei weiter aktivem Kern: danach kein Abruf und außer dem einmaligen Löschen der eigenen Sperre (Nr. 40 c) kein Dateizugriff. **Gegenproben:** Variante ignoriert die Rolle → rot; Variante mit den Ausnahmen ohne Bedingung (Prüfung der Show-Datei und Lesen der Sperrdatei auch bei `slave` und ohne Token, wie die erste Fassung von 9.2) → „null“ rot.
28. Takt (9.4): aktives Side Event jeden Takt ohne eigenen Abruf; Runde startet nach Regel 6.1; innerhalb des Ordner-Teils nie zwei Abrufe oder Downloads gleichzeitig (Attrappe misst Überlappung); Vorrang des aktiven Side Events nach dem laufenden Schritt, solange wartend S6; ein nicht aktives Side Event, das während desselben Downloads in der Warteschlange steht, zeigt nicht S6, sondern seine Zeile nach S7–S13 (etwa T44 nach einem gescheiterten Abruf); je Side Event höchstens ein Eintrag: der Download des aktiven Side Events dauert drei Takte → genau ein Download. **Gegenproben:** Warteschlange hängt an statt zu ersetzen → rot; S6 für jedes wartende Side Event (Bedingung der ersten Fassung von 11.2) → „nicht S6“ rot.
29. Basisordner nicht anlegbar → K6 mit Code.
30. Kopfzeile und Zeilen: alle Kombinationen der Achsen aus 11.1 und 11.2 → genau eine erste zutreffende Zeile je Kombination, Text wörtlich je Klasse; K9 und K10 nach Ablauf mit der Uhr des Renderers T59; K7 ohne Fortschritt T76 (Nr. 49).
31. Fremde Datei taucht während des Downloads unter dem Zielnamen auf → sie bleibt unverändert (Inhalt und Name), die neue Datei bekommt „ (2)“. **Gegenprobe:** Platzieren ohne Prüfung → rot (die Attrappe ersetzt wie NTFS).
32. Index-Schreiben scheitert drei Runden → genau ein Download, Problem „Index nicht schreibbar“; vierte Runde gelingt → Index geschrieben, Problem weg. Ebenso: Label umbenannt und Index-Schreiben scheitert → keine Kopie, kein Neuladen.
33. Neustart (frischer Lauf, dieselbe Attrappe) mit gültigem Index ohne die Kennung, Datei mit Name und Größe liegt da → übernommen (T21 f), kein Download. Link: `.url` mit dem erwarteten Namen und byteweise dem Inhalt aus 9.7 → übernommen, keine „‹Stamm› (2).url“; `.url` mit anderem Inhalt (andere Adresse, eine Zeile mehr) → nicht übernommen, neue `.url` mit „ (2)“, die alte bleibt unverändert. Datei-Anhang ohne gültiges `size_bytes`, Datei mit dem erwarteten Namen → nicht übernommen, geladen als „ (2)“, die vorhandene bleibt unverändert (Grenze, 9.5). Dieselben Fälle mit kaputtem Index (Nr. 16). Eintrag `laedt` mit `bytes`, Datei ohne `size_bytes` mit genau dieser Bytezahl unter dem Namen des Eintrags → `aktiv`, kein Download. **Gegenproben:** Übernahme nur nach Name und Größe (erste Fassung) → Link „keine (2)“ rot; Links nur nach dem Namen übernommen → „anderer Inhalt → nicht übernommen“ rot; Datei-Anhang ohne `size_bytes` nach dem Namen übernommen → „nicht übernommen“ rot.
34. Wiederfinden nach Neustart: Ordner mit dem erwarteten Namen ohne Index → übernommen, Index neu (T24, T72), kein Ordner „Titel (2)“, kein Download bei passender Größe; mit kaputtem Index ebenso; zwei Ordner mit derselben `programId` → nur der mit passendem `ordnerName` gepflegt, Zusatz T66. **Gegenprobe:** Wiederfinden nur über den Index → rot.
35. Index-Quellen: `datei` = `../x`, `C:\x`, `\\h\s\x`, `entfernt/../../x` und `wartet` mit Traversal → Index gilt als kaputt, null Zugriffe außerhalb des Side-Event-Ordners; Quelle beim Umbenennen außerhalb → Abbruch; `entfernt` als Verknüpfung → Fehler, nichts verschoben.
36. Vergleichsform: Profil „HFS+/SMB“ liefert NFD-Namen → über zehn Runden kein Neuladen; Bediener ändert nur die Schreibweise einer Datei → kein Neuladen, kein Überschreiben.
37. Rückhaltung: dauerhaft zu wenige Bytes → Versuche nach 45 s, 90 s, 180 s …, höchstens alle 10 min; Zeile „nächster Versuch gegen ‹hh:mm›“; neue Inhaltssignatur → sofort.
38. ENOSPC mitten im Strom → Zwischendatei gelöscht, Grund „Schreibfehler (ENOSPC)“, die nächste Platzprüfung misst ohne Rest.
39. Gleiche Änderungszeit, andere Größe als im Index → nach `entfernt/… (unvollständig …)`, neu geladen.
40. Sperre (9.2), Läufe auf derselben Attrappe, `sperreBewerten` zusätzlich als Tabelle über alle sechs Regeln:
    (a) Zwei Läufe mit verschiedenem `rechner` → nur einer legt ab, der andere zeigt K5 mit T57 (fremder Name, Übernahmezeit = Lebenszeichen + 15 min) und liest nur die Sperrdatei; Lebenszeichen 15 min alt → übernommen; das Aufräumen des einen löscht keine Zwischendatei des anderen.
    (b) Neustart: Lauf 1 hält die Sperre und hinterlässt eine `.‹id›.‹pid1›.jm-laden`; Lauf 2 mit gleichem `rechner`, neuer `sitzung` und neuer `pid`, Lebenszeichen 1 min alt → übernimmt im ersten Takt, kein K5, keine Zeile mit dem eigenen Namen, die Reste von Lauf 1 werden aufgeräumt. Ebenso nach einem Show-Wechsel hin und zurück im selben Lauf.
    (c) Ende der Ablage: Rolle wird `slave`, Token fällt weg, Schalter aus, andere Show geöffnet, `beenden()` → je Fall die eigene Sperrdatei gelöscht; trägt sie inzwischen eine andere `sitzung`, bleibt sie; ein wartender Lauf mit anderem `rechner` übernimmt im nächsten Takt statt nach 15 min. Show-Datei fehlt → Sperre bleibt. Löschen scheitert → T75 im Log.
    (d) Namensgleich: zwei Läufe mit gleichem `rechner`, beide aktiv → ab dem nächsten Takt des ersten legt nur noch einer ab; der andere zeigt K5 mit T73 und löscht die Sperre nicht.
    **Gegenproben:** Variante ohne Sperre → (a) rot; Regel nur nach `sitzung` (wie die erste Fassung) → (b) rot; Variante ohne Löschen am Ende der Ablage → (c) „übernimmt im nächsten Takt“ rot; Variante ohne Regel 4 → (d) rot.
41. **Geheimnis-Suche (E20):** Attrappe mit Token `iveo_live_GEHEIM`, `asset.url` als Referenz in der gemessenen Form (279 Zeichen, ein Punkt, M1) mit dem Marker `GEHEIM-ASSET` am Anfang, in der Mitte und am Ende, Weiterleitung `https://signed.example/x?X-Amz-Signature=GEHEIM-SIG`, ein Download-Fehler, dessen Meldung die Anfrage-URL enthält. Nach den Fällen 1–40 werden jede geschriebene Datei (Index, `.kaputt`, `.url`, `entfernt/`, Sperrdatei), jede Logzeile, jedes Ereignis `iveo-anhang-ordner` und `iveo-anhaenge` und jeder Statustext durchsucht: 0 Treffer für „GEHEIM“ und 0 Treffer für jeden Ausschnitt von 16 Zeichen der Referenz (findet sie auch gekürzt oder zerlegt); der SHA-256 in `inhalt` ist erlaubt. **Gegenproben:** (a) die Referenz statt ihres Hashes in `inhalt` → rot; (b) `oeffneAsset` gibt `res.url` mit → rot; (c) `ordnerFehlerText` ohne Ersetzen von Adressen → rot; (d) wie (c) mit einer Referenz, deren Marker nur am Ende steht, und einer auf 200 Zeichen gekürzten Meldung → kein „GEHEIM“ mehr darin, aber die Ausschnitt-Suche findet den Rest der Referenz, rot.
42. Ablage-Menge (9.3): Liste mit 67 Programmen über drei Tage, Filter `{programId}`, aktives Side Event an Tag 2 → nur Tag 2 und das aktive; Eintrag ohne Tag im Cache zählt mit; Listen-Modus ohne Tag → alle. Block (9.13): Side Event der Menge, das die Panel-Liste nicht zeigt → im Block; ohne Cache → alle im Block, Kopfzeile da.
43. Laufzeitprüfung (8.5): ungültiger Anhang → Problem „ungültiger Anhang in iveo (‹Feld›)“; dieselbe Kennung an zwei Agenda-Punkten → einmal geladen.
44. Für jede abgelegte Datei protokolliert die Attrappe `sync` vor `rename`.
45. Fortschritt: 1000 Stücke über 3 s Testuhr → höchstens 4 Fortschritts-Ereignisse.
46. Sitzung: Index mit `stand` vom Vortag → S8 mit Datum („‹TT.MM.› ‹hh:mm›“); nach dem ersten Abruf S12 mit Uhrzeit.
47. **Echter Download-Client:** `iveoDownloadClient` mit echtem `fetch` gegen einen Server auf 127.0.0.1 (wie `apps/launcher/test/iveo-huelle.test.ts:66-101`), Leerlauf-Grenze im Test 1 s: Datenstrom über 3 s in Stücken mit 0,2 s Pause → Download gelingt; Server stockt nach N Bytes 1,5 s → Abbruch „keine Daten …“, Zwischendatei gelöscht; Abbruch durch den Aufrufer nach 0,5 s → genau ein Abruf, kein Fehler. **Gegenprobe:** derselbe Strom über den Hüllen-Client (`mitZeitgrenze` mit 1 s) → rot.
48. **Speichern im Panel (8.6):** `panelAnhangSchritt` schlägt für jedes Label und jeden MIME-Typ aus Nr. 1 und 2 genau den Dateinamen vor, den der Ordner bekäme (ohne Pfadbudget); „Agenda.exe“ mit `application/pdf` → `{art: 'datei', vorschlag: "Agenda_exe.pdf", gesperrt: "exe"}`; „Slides‹U+202E›txt.exe“ → kein U+202E im Vorschlag, gesperrt; gelöschter Anhang → T15; Datei ohne Asset → T54; kein Ergebnis enthält den Marker aus `asset.url` (Nr. 41). `panelDateiOeffnen`: „Bericht.pdf“ ohne Sperre → öffnen; „Agenda_exe.pdf“ mit `gesperrt: "exe"` → nicht öffnen (T74); im Dialog zurückbenannt „Bericht.exe“ bzw. „Bericht.EXE“ → nicht öffnen; „Deck.pptm“ → öffnen. **Gegenproben:** Vorschlag nach der alten Regel (`extFor` und neun ersetzte Zeichen, `iveo-sync.ts:618-621`, `:693`) → „Agenda.exe“ bleibt, rot; `panelDateiOeffnen` immer wahr (wie `:697` heute) → rot.
49. **K7 ohne Fortschritt (11.1):** Die Attrappe lässt das Umbenennen der Index-Zwischendatei nicht zurückkehren (hängendes Netzlaufwerk). Kopfzeile mit der Uhr des Renderers 105 s nach `letzterFortschritt` → T37, 106 s → T76 mit der Zeit von `letzterFortschritt`; ein Download mit neuen Bytes alle 0,5 s über 10 min Testuhr → nie T76; nach einem Leerlauf-Abbruch beginnt der nächste Schritt, `letzterFortschritt` rückt vor → T37. **Gegenprobe:** Kopfzeile ohne Uhr-Achse für K7 (erste Fassung von 11.1) → „106 s → T76“ rot.

**Echte Dateisysteme (B37):** Ein zusätzlicher Test `apps/launcher/test/side-event-ordner-echt.test.ts` im Temp-Ordner führt die Fallliste aus, die die Attrappe nur annimmt: feindliche Namen aus Nr. 1, `rename` auf einen bestehenden Namen (erwartet: der Lauf weicht mit „ (2)“ aus), Umbenennen nur in Groß- und Kleinschreibung, ein NFD-Name in der Liste, `entfernt\` an der Längengrenze, Umlaute. Er läuft in der CI auf ubuntu und im Plan je einmal auf Windows 11 und auf macOS (Mac der Abnahme); die Ergebnisse kommen mit Betriebssystem, Dateisystem und Node-Version in den Aufgabenbericht. Weicht ein Ergebnis von der Attrappe ab, wird die Attrappe angepasst, nicht die Erwartung.

**Gegenproben 12.4** (zusätzlich zu den oben genannten): (a) Variante schreibt direkt auf den Zielnamen → Nr. 6 und Nr. 21 „Zielname existiert nicht, solange Bytes fließen“ rot. (b) Variante löscht statt zu verschieben → Nr. 9/10 „nichts wird gelöscht“ (die Menge aller jemals angelegten Nicht-Zwischendateien bleibt erhalten) rot. (c) Variante ohne Traversal-Wächter → Nr. 5 und Nr. 35 rot.

### 12.5 Titler (`npm run selftest -w @jm/titler`)

1. `speakersTsvText`: Kopf genau `name\tfunktion\ttitle\torganisation\torganisationen\t@kennung`; Zeile mit zwei Organisationen; ohne Organisationen leere Zellen; Tab und Zeilenumbruch in Organisationsnamen → Leerzeichen.
2. `parseTable` auf diese TSV: `vars` = `name`, `funktion`, `title`, `organisation`, `organisationen` (genau, in dieser Reihenfolge); `@kennung` bleibt Schlüssel.
3. `resolveVars('{{name}} · {{organisation}}')` und `'{{organisationen}}'` wie 11.4; Vorlage ohne die Variablen ändert sich nicht.
4. Show mit Organisationen **als JSON-Text** → `parseShow` des Titlers (Weg von `leseShowSicher`, `apps/titler/src/main/show-quelle.ts:97`) → `quellSchritt` mit `gelesen` → TSV mit beiden Spalten (`apps/titler/src/shared/datenquelle.ts:146-151`); derselbe Stand über `masterStand` (`:190-201`) → dieselbe TSV.

**Gegenprobe:** alter `speakersTsvText` → Nr. 1 rot.

### 12.6 Show-Editor (`apps/launcher/test/show-speichern.test.ts`)

1. Laden und Speichern ohne Änderung behalten `organisationen` (Fixture `:48` bekommt sie).
2. `bindungsAdresse(res.baseUrl, feld)` (7.4): Ergebnis-Adresse vor Feld; ohne Ergebnis-Adresse das getrimmte Feld; beides leer → `undefined`. **Gegenprobe:** Variante nimmt nur das Feld → rot.
3. `editorAdresseAusShow(show)` (7.4): Show mit Staging-Adresse → diese Adresse; ohne Adresse → leer. **Gegenprobe:** der heutige Weg (Feld bleibt nach `resetForm` leer) → rot.
4. `bindMeldung(…)` (5.9): T1 wörtlich mit „, davon ‹o› mit Organisation“; ohne Speaker ohne diesen Teil; mit Warnung „ ⚠ ‹Warnung›“ am Ende; Agenda-Filterlabel mit typografischen Anführungszeichen.

### 12.7 Release-Wahl und Proxy

**Launcher** (`apps/launcher/test/selftest.ts`, Modul `release-wahl.ts`):
1. `waehleRelease` über die gemeinsame Tabelle `services/release-proxy/test/paketwahl-faelle.json`: 0.3.1 ohne DMG, 0.3.0 mit DMG → 0.3.0 auf dem Mac, 0.3.1 auf Windows; nur `arm64`-DMG → x64 `null`, arm64 gewählt; nur `x64`-DMG → arm64 gewählt; universelles DMG → beide; Draft ignoriert; fremdes Präfix ignoriert; genauer Katalogname vor Muster.
2. `proxyFehlerText`: JSON mit `error`; JSON ohne `error`; kein JSON; langer Text gekürzt; Zeilenumbrüche. `proxyAntwortAuswerten` mit einem Response-ähnlichen Objekt: 404 mit JSON-`error`; 404 ohne JSON; `text()` wirft; 200 mit gültigem Ergebnis.
3. `keinPaketText` (T29, T69); `compareVersions` (aus `release-source.ts` hierher gezogen, Fälle wie bisher).

**Proxy** (`services/release-proxy/test/worker.test.mjs`):
4. Dieselbe Tabelle (`paketwahl-faelle.json`) über `/tools/:id/latest`; die neuen 404-Texte; Windows unverändert; Seitenwechsel aus `:64-110` weiter grün.

**Gegenprobe:** alte Wahl (höchstes Release, Rückfall „irgendein DMG“) → Nr. 1 und 4 „0.3.1 ohne DMG → 0.3.0“ und „x64 nie arm64“ rot.

### 12.8 Bestehende Tests, die Formen festnageln

| Test | Heute | Anpassung |
| --- | --- | --- |
| `packages/iveo/test/selftest.ts:322-323` | Standard = Staging | auf Production; `:324-326` (Schema ergänzen) bleibt mit Staging-Host als Eingabe |
| `packages/iveo/test/selftest.ts:212`, `:289-304`, `:430-439` | Staging-Host als Testeingabe | bleiben (Eingabewerte, kein Standard) |
| `packages/iveo/test/selftest.ts:360-368` | Speaker ohne Kennung, Fixpunkt | bleiben grün; Fixture `:67-70` bekommt `organisations`, `:366` bleibt, neue Prüfungen dazu |
| `packages/iveo/test/selftest.ts:729-737` | exaktes JSON der Speaker | bleibt grün (Fixture ohne Organisationen); ein zweiter Fall mit Organisationen dazu |
| `packages/iveo/test/selftest.ts:757-761`, `:848-852` | Schlüsselreihenfolge der Bindung | bleiben grün (Bindung unverändert) |
| `apps/titler/test/selftest.ts:68-74`, `:77`, `:85-88` | exakte TSV, exakte `vars` | **bewusst neu**: Kopf und `vars` mit den zwei Spalten; Gegenprobe 12.5 |
| `apps/titler/test/selftest.ts:1093-1097`, `:1100-1101` | Kopf und Zeilen aus `writeSpeakersTsv` und `schreibeSpeakersTsvSicher` | **bewusst neu**: `Grace\t\t\t\t\t` und `Hedy\t\t\t\t\t` (fünf Tabs; die Prüfungen stehen auf `:1097` und `:1101`), Kopf mit sechs Spalten |
| `apps/titler/test/selftest.ts:1159-1163` | eigene TSV-Fixture mit altem Kopf | bleibt (eine fremde TSV ohne die Spalten ist weiter gültig) |
| `apps/launcher/test/iveo-abgleich.test.ts:162`, `:203`, `:241`, `:396` | Speaker ohne Organisationen, `organisations: []` | bleiben; Testuhr: siehe Messaufgabe M2 |
| `apps/launcher/test/iveo-abgleich.test.ts:750-751` | wörtlich der alte Text von `iveo-abgleich-kern.ts:951` | **bewusst neu**: T4 (11.6); geprüft in 12.2 Nr. 9 |
| `apps/launcher/test/iveo-abgleich.test.ts:1294-1297` („Kontext gemerkt → kein Detail-Abruf, aber die Speakerliste …“) | Merker „Speaker veraltet“ holt nur die Liste | bleibt grün: Der Merker allein holt kein Detail (6.3); nur „fällig“ oder der Merker „Speaker-Verknüpfung veraltet“ holen es. Die Testuhr bleibt dort unter 255 s (M2) |
| `apps/launcher/test/iveo-abgleich.test.ts:1180`, `:1313-1314` („ohne Merker … kein Snapshot mehr“, „… keine Speakerliste mehr“) | Regel ohne Auffrischen | bleiben grün, weil die Testuhr unter 255 s bleibt (M2); die Testnamen bekommen den Zusatz „(innerhalb von 255 s)“ (bewusst neu, nur Text) |
| `apps/launcher/test/show-speichern.test.ts:48`, `:72`, `:77` | Speaker mit Kennung | bleiben grün; 12.6 dazu |
| `apps/launcher/test/verteiler.test.ts:75`, `verbund-kette.test.ts:88`, `e2e-teil2b-verbund.ts:211` | Speaker ohne Organisationen | bleiben |
| `apps/rundown/test/selftest.ts:1730-1732`, `:1777` | Speaker mit Kennung | bleiben |
| `services/release-proxy/test/worker.test.mjs` (Fälle zur Asset-Wahl) | höchstes Release | Erwartungen nach 10.5; jede geänderte Erwartung mit Begründung im Bericht |

Ein roter Bestandstest außerhalb dieser Tabelle ist ein Fehler im Code, nicht im Test. Ausnahme: Er prüft wörtlich einen Text, den 11.6 ändert. Dann wird er mit Begründung im Aufgabenbericht und in dieser Tabelle nachgetragen, der Code bleibt bei 11.6.

### 12.9 CI

`.github/workflows/ci-checks.yml`, Job `selftests` (Node 22, `:39-42`):
- `selftest:iveo` des Launchers ist eine feste Kette (`apps/launcher/package.json`: `tsx test/iveo-abgleich.test.ts && tsx test/iveo-huelle.test.ts && tsx test/show-speichern.test.ts && tsx test/reload-nachholen.test.ts`). Sie wird verlängert um `&& tsx test/iveo-anhaenge.test.ts && tsx test/side-event-ordner.test.ts && tsx test/side-event-ordner-echt.test.ts`. Ein neuer CI-Schritt ist dafür nicht nötig (der Schritt „Launcher (iveo-Abgleich-Kern, Hülle, Show-Editor)“, `:53-54`, ruft das Skript).
- Der Launcher-Selbsttest (`node --experimental-strip-types test/selftest.ts`, Schritt `:47-48`) importiert zusätzlich `src/main/release-wahl.ts` und die reinen Renderer-Helfer `anhang-liste.ts` und `ordner-zeilen.ts`; keiner lädt Electron.
- Der Selbsttest von `@jm/connect` (Schritt `:80-81`) bekommt `node test/pruefe-mac-paket.test.mjs` (10.2).
- Neuer Schritt „Release-Proxy (Paketwahl, Routing)“: `node --experimental-strip-types services/release-proxy/test/worker.test.mjs`. Das ändert den Workflow, der `main` schützt (0.1 Nr. 14).
- Der Workflow `connect-mac.yml` hat seinen eigenen Prüfschritt (10.2).

### 12.10 Durchgang mit gebauten Programmen (optional im Plan)

`apps/rundown/test/e2e-teil2a.mjs` misst Bauchbinden über den Bild-Hash (2b-Spec 9.6). Ein zusätzlicher Abschnitt: Speaker mit Organisation im nachgebauten iveo, Vorlage `{{organisation}}`, Bild ungleich dem Bild ohne Organisation. Optional, weil 12.5 die Kette bis zur Variable schon prüft.

### 12.11 Messaufgaben vor dem Plan

| # | Frage | Wer, wie | Folge |
| --- | --- | --- | --- |
| M1 | Ist `materials[].asset.url` stabil und unsigniert, und welche Herkunft hat sie? | Owner-Token, Prüfskript, nur lesend, nur Form, Schema, Herkunft gleich der Basis-URL ja/nein und Gleichheit (8.3) | **Erledigt am 17.10.2026** (OF6): nackte signierte Referenz mit 279 Zeichen, ohne Zeitangabe, nach 10,5 min bei allen 4 Anhängen gleich; Herkunft = Basis-URL. Folge: SHA-256 der Referenz in Material- und Inhaltssignatur (8.3); E52 bleibt als Schutz; Restrisiko 22 |
| M2 | Erreicht die Testuhr in `iveo-abgleich.test.ts` (`:293`, `:349`, +1 s je Aufruf) in einem Fall 255 s? | lokal, Zähler im Test | Betroffene Fälle bekommen `taktMs`/Uhr ausdrücklich gesetzt, ihre Erwartung wird begründet, nicht still geändert |
| M3 | Löst ein per `gh release create` angelegtes Tag `push: tags` aus? | beim nächsten Connect-Release beobachten | sonst Hand-Start (10.1) |
| M4 | Was ändert sich in iveo, wenn eine Datei an einem Anhang **ersetzt** wird: `materials[].id`, Form von `asset.url`, `size_bytes`, `updated_at` des Agenda-Punkts? Ausgabe nur „geändert ja/nein“ je Feld. | in der Abnahme am unveröffentlichten Test-Side-Event (13, Schritt 12), Owner-Token, Prüfskript | Ändert sich etwas außer der Größe, kommt es in die Inhaltssignatur (FP11); bis dahin gilt Risiko 3 |
| M5 | Wie viele Programme hat ein COP31-Tag, je Typ? (Gefragt war nach dem Typ „Side Event“; den gibt es nicht, gemessen.) | Owner-Token, Prüfskript, nur lesend, nur Anzahlen je Tag und Typ | **Erledigt am 17.10.2026** (OF6): 67 Programme, Typ-Slugs `program` 62, `invite_only` 4, `open` 1; je Tag höchstens 8 (alle Typen), 4 ohne Tag, keine Blocker. Last 6.7 mit n ≤ 12 (8 je Tag und die 4 ohne Tag, die nach 9.3 an jedem Tag mitzählen); die Schwelle 30 für eine Owner-Frage (6.7, OF6) wird nicht erreicht |

---

## 13 · Abnahme

Datei `apps/launcher/ABNAHME-iveo-paket.md`, je Schritt mit Ergebnisspalte, Datum und Namen. In iveo wird nur an einem **unveröffentlichten Test-Side-Event** und einem **unveröffentlichten Test-Speaker** geschrieben (Annahme: beide gibt es in COP31 oder werden vom Owner angelegt); fehlen sie, gelten die Schritte 6, 7, 9, 10, 12 und 13 als „entfällt“, und die Selbsttests tragen den Nachweis.

Voraussetzungen: Rechner A (Windows) mit Launcher 0.16.0 und Titler 0.11.1; ein Mac mit Launcher 0.16.0; für Schritt 14 Rechner B mit Rolle „Mit Master verbinden“ und **Titler 0.11.1** (ein älterer Titler verwirft das Feld, 5.8).

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Versionen im Launcher ansehen | Launcher 0.16.0, Titler 0.11.1 |
| 2 | Einstellungen öffnen; im Ergebnis notieren, ob eine Adresse eingetragen ist und welche | Feld „iveo Basis-URL“ zeigt die eingetragene Adresse oder ist leer mit Platzhalter T6; darunter T9 mit der Adresse, die neue Bindungen bekommen. Speichern ohne Änderung, erneut öffnen → gleiche Anzeige. |
| 3 | Show-Editor: neue Show, Basis-URL leer, „Events laden“, COP31 binden, speichern; die Show danach im Editor wieder öffnen | Events kommen von der Adresse aus T9 in Schritt 2 (ohne Eintrag: Production); Platzhalter T7 nennt sie. Meldung T1 mit „davon ‹o› mit Organisation“, ‹o› > 0. Gespeicherte Show trägt `iveo.baseUrl` = diese Adresse; beim Wiederöffnen zeigt das Feld genau sie (E16). |
| 4 | Bestehende COP31-Show öffnen; im Timer einen Punkt laufen lassen und im Rundown eine Zeile scharf stellen; Launcher-Log beobachten | spätestens 5 min nach dem Öffnen genau eine Zeile „… die Speakerliste weicht von der Datei ab → Show neu geschrieben …“; Timer bleibt auf seinem Punkt, die scharfe Rundown-Zeile bleibt; danach etwa alle 4,5 min T2 |
| 5 | Titler: Vorlage mit `{{name}}`, `{{organisation}}`, Untertitel `{{organisationen}}`; einen Speaker mit mehreren Organisationen abrufen, TAKE | Hauptorganisation bzw. alle mit „ · “; ein Speaker ohne Organisation zeigt leere Felder; eine bestehende Vorlage ohne die Variablen sieht aus wie vorher |
| 6 | Test-Speaker: Organisation oder Funktion in iveo ändern; Uhrzeit notieren | Änderung in der Bauchbinde spätestens 5 min später, ohne Programmänderung; im Listen-Modus und (Schritt 7) im Agenda-Modus |
| 7 | Auf ein Side Event mit verknüpften Speakern umschalten, Schritt 6 wiederholen | wie Schritt 6 |
| 8 | Side-Events-Panel, 📎 am Test-Side-Event aufklappen; dann das Panel schließen und wieder öffnen | Liste mit „Stand hh:mm“, die Zeit rückt bei unveränderter Liste etwa alle 45 s vor; nach dem Wiederöffnen sind alle Listen zugeklappt (kein hängendes „Lade Anhänge…“), und am aktiven Side Event steht „📎 ‹n›“ (L6) |
| 9 | In iveo einen Anhang hinzufügen, Liste offen lassen | Liste zeigt ihn spätestens 45 s später, ohne Neuladen |
| 10 | In iveo den Anhang löschen | verschwindet aus der Liste spätestens 45 s später; „Herunterladen“ eines vorher sichtbaren gelöschten Anhangs → T15 |
| 11 | Ordner: neben der Show „‹Show› – Side Events“ öffnen (Knopf „Ordner öffnen“ im Panel) | Unterordner je Side Event der Ablage-Menge mit Anhängen; Dateien vollständig; Links als `.url` öffnen den Browser; Kopfzeile T38; Zeile „Anhänge: n im Ordner · Stand hh:mm“; im Basisordner `.jm-ablage-sperre.json` mit dem Namen von Rechner A |
| 12 | Im Test-Side-Event: Anhang umbenennen, Datei ersetzen, Anhang entfernen; dabei M4 messen (12.11) | umbenannt; alte Fassung in `entfernt/… (ersetzt …)`; entfernter Anhang in `entfernt/`; nichts gelöscht; M4-Ergebnis im Bericht |
| 13 | Eine Datei im Ordner in PowerPoint öffnen, in iveo ersetzen | Zeile „… neue Fassung wartet, Datei ist geöffnet“; nach dem Schließen spätestens in der nächsten Runde getauscht |
| 14 | Rechner B (Rolle „Mit Master verbinden“, gekoppelt, Titler 0.11.1): eine Kopie derselben Show öffnen, Side-Events-Panel ansehen; im Titler auf B eine Bauchbinde mit `{{organisation}}` abrufen | Kopfzeile T32; neben der Kopie entsteht kein Ordner; am Master läuft die Ablage weiter; die Bauchbinde auf B zeigt dieselbe Organisation wie auf A |
| 15 | Mac: Launcher 0.16.0, Connect installieren und starten; eine Gast-Einladung öffnen; zwei Gäste und Talkback probieren | Installation ohne Fehler; Connect startet; Verhalten nach OF1 (Vorgabe A, vom Owner am 17.10.2026 bestätigt: Gast kommt in den Raum, keine NDI-Quelle, kein Programmbild und kein Programm-Ton beim Gast, keine Zoom-Karte; Gäste hören einander und die Regie, sonst wird der letzte Halbsatz in 10.6 gestrichen); eine `.url` aus Schritt 11 öffnet sich auf dem Mac im Browser |
| 16 | Schalter „Anhänge in Side-Event-Ordnern ablegen“ aus (OF8, Vorgabe vom Owner bestätigt) | T34; keine Downloads mehr; Ordner unverändert; Sperrdatei weg. Wieder an → nächste Runde im nächsten Takt |
| 17 (optional) | Eine Show mit eingetragener Staging-Adresse öffnen | fragt weiter Staging ab |
| 18 | Auf Rechner A die offene Show-Datei im Explorer umbenennen, eine Runde abwarten, dann zurückbenennen | Kopfzeile T35, keine Downloads; nach dem Zurückbenennen läuft die Ablage im nächsten Takt weiter |
| 19 | Mac: ein Tool installieren, dessen Releases laut Trockenlauf (10.7) kein passendes Paket für diesen Mac haben (gibt es keins, „entfällt“) | T27 mit T28 (über den Proxy) bzw. T29 (GitHub-Quelle); kein Download |
| 20 | Rechner A, Show mit laufender Ablage: (a) den Launcher im Task-Manager beenden (Absturz nachstellen), neu starten, dieselbe Show öffnen; (b) den Launcher normal beenden und in den Basisordner sehen; (c) im Panel einen Anhang mit ausführbarer Endung (falls im Test-Side-Event vorhanden) speichern | (a) keine Zeile T57 oder T73, nach „erster Abgleich folgt“ läuft die Ablage im ersten Takt weiter, keine `.jm-laden`-Reste des alten Prozesses; (b) `.jm-ablage-sperre.json` ist weg (sonst im Ergebnis notieren: Annahme aus 9.2 widerlegt, ein zweiter Rechner wartet dann bis zu 15 min); (c) Vorschlag mit „_‹ext›“, Notice T74, die Datei öffnet sich nicht |

---

## 14 · Release-Reihenfolge

### 14.1 Reihenfolge

Push, PR, Merge, Tags, Releases, Workflow-Starts und Deploy nur nach Owner-Freigabe.

1. **Release-Commit auf dem Branch, vor dem Merge** (E44; Vorbild Release-Commit `74bb01b301`, der `apps/*/package.json`, `package-lock.json` und `changelog.json` vor den Tags änderte):
   - Versionen: `apps/launcher/package.json:3` → `0.16.0`, `apps/titler/package.json:3` → `0.11.1`, dazu die Versionszeilen der Lock-Blöcke `apps/launcher` (`package-lock.json:295`) und `apps/titler` (`package-lock.json:738`). Grund: Der Artefaktname kommt aus `package.json` (`apps/launcher/electron-builder.yml:3`, `${version}`); die CI nimmt aus dem Tag nur den App-Namen (`.github/workflows/suite-release.yml:50-64`) und baut mit der Version aus `package.json` (`:111-113`); der Launcher vergleicht Updates mit `app.getVersion()` (`apps/launcher/src/main/updates.ts:73`, `:92-96`). Ohne Anheben hießen die Pakete von `launcher-v0.16.0` „…-0.15.0-…“, der installierte Launcher meldete sich als 0.15.0 und böte 0.16.0 dauerhaft wieder an, und die GitHub-Quelle fände das Paket nicht (`apps/launcher/src/main/release-source.ts:125-138`).
   - Changelog-Einträge (14.2) in `packages/suite-manifest/changelog.json`, Blöcke `launcher` und `titler`; Connect bekommt keinen Eintrag (Version bleibt). Der Proxy liefert den Changelog live von `main` (`services/release-proxy/worker.js:233-252`, `services/release-proxy/wrangler.toml:55`); stünde er erst nach den Tags dort, erschienen die Updates ohne Notes.
   - Prüfmuster vor dem Commit: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"` und dasselbe für `suite.json` (10.6); Versionen in Paket, Lock und Changelog gleich; keine ASCII-Anführungszeichen in den neuen Notes.
2. PR `feat/iveo-paket` → Review → Owner-Freigabe → Merge. Die Katalog-Beschreibung Connect (10.6) ist im Merge enthalten.
3. `main` gepusht **vor** allen Tags: Ein Tag muss auf einem gepushten Commit liegen. Der Bump-Job der CI (`suite-release.yml:146-152`) ändert für den Launcher nichts: Der Launcher steht nicht im Katalog (`scripts/bump-manifest.mjs:31-35`, „kein Bump“), sein Selbst-Update liest die Releases direkt (`apps/launcher/src/main/updates.ts:61-96`).
4. **Launcher 0.16.0:** Tag `launcher-v0.16.0` auf dem Merge-Commit, allein gepusht (mehrere Tags in einem Push lösen keine Workflows aus, Lehre „Rundown-Cluster Release“). Die CI baut Mac und Windows (`suite-release.yml:39`) und legt das Release an (`:119-122`).
5. **Titler 0.11.1** nach dem Runbook `docs/release-titler.md` („Reihenfolge ist Pflicht“, `:8-13`), mit diesen Festlegungen:
   - Tag `titler-v0.11.1` auf dem Merge-Commit, allein gepusht (die CI überspringt `titler-v`, `suite-release.yml:35`).
   - Gebaut wird lokal aus genau diesem Tag (`npm run dist:win --workspace @jm/titler -- --publish never` mit NDI-SDK, `docs/release-titler.md:29-48`), in einem eigenen Worktree auf dem Tag statt `git checkout main` (`:26`), damit kein Review-Branch in einem geteilten Worktree verschoben wird (Lehre „Shared-Worktree-Falle“).
   - `gh release create titler-v0.11.1 "apps/titler/release/JM Titler-0.11.1-win-x64.exe" --title "JM Titler 0.11.1" --prerelease --notes "…"` (Notes aus 14.2). Das Tag existiert dann schon. Wer es stattdessen von `gh` anlegen lässt, gibt `--target ‹Merge-Commit›` mit; ohne `--target` legt `gh` es auf den aktuellen Kopf des Standard-Branches (**Annahme** aus der `gh`-Hilfe, nicht gemessen). Den Asset-Download kurz prüfen (`:60-61`).
   - Danach auf `main`: `node scripts/bump-manifest.mjs titler 0.11.1`, Commit „chore(manifest): titler latestVersion → 0.11.1 [skip ci]“ (Form wie `5e5b234ec3`), pushen.
6. **Connect-Mac-Nachlauf:** Workflow `connect-mac.yml` von Hand mit `connect-v0.3.0` (10.3); Ergebnis: zwei DMGs am Release. Kein Bump (Version bleibt 0.3.0).
7. **Proxy-Deploy** (10.7) nach Trockenlauf und Owner-Freigabe, außerhalb laufender Connect-Sitzungen.
8. **Prüfung:** Die Launcher-Pakete heißen am Release `JM.Production.Suite-0.16.0-…` (gebaut `JM Production Suite-0.16.0-…`, `apps/launcher/electron-builder.yml:2-3`; GitHub ersetzt Leerzeichen in Asset-Namen durch Punkte, `apps/launcher/src/main/release-source.ts:126-127`, Lehre „Release-Artefakt-Benennung“); der Launcher zeigt an den Updates die Notes aus 14.2; `suite.json` nennt Titler 0.11.1.
9. Abnahme (13), danach Roadmap nachführen (15).

Der Titler darf vor dem Launcher erscheinen: Mit Launcher 0.15.0 bleiben die Spalten leer (5.8).

### 14.2 Notes-Entwurf (zur Owner-Freigabe)

**Launcher 0.16.0**
- „Organisationen der Speaker aus iveo kommen in die Show; der Titler bietet sie als Variablen an. Nach dem Binden zeigt der Show-Editor, wie viele Speaker eine Organisation haben.“
- „Der Live-Abgleich holt die Speakerliste zusätzlich etwa alle 5 Minuten. Die Show wird nur bei einer echten Änderung neu geschrieben.“
- „Ist ein Side Event in iveo mit keinem Speaker verknüpft, bekommt die Show bei der nächsten Auffrischung alle Speaker des Events, wie schon beim Binden.“
- „Haben die Speaker einer offenen iveo-Show in iveo Organisationen, schreibt der Launcher mit dem iveo-Token die Show nach dem Update einmal neu, in der Regel binnen 5 Minuten; Timer, Titler und Rundown laden dabei einmal neu.“
- „Standard für iveo ist jetzt Production (app.my-iveo.de). Eine eingetragene Adresse gilt weiter und bleibt beim Speichern der Einstellungen erhalten; neue Bindungen merken sich ihre Adresse, und der Show-Editor zeigt sie beim Bearbeiten an. Eine Show, die ohne eingetragene Adresse an Staging gebunden wurde, fragt jetzt die Standardadresse ab; die Statuszeile meldet dann „Token ungültig oder widerrufen“ oder „Event nicht gefunden oder außerhalb des Token-Scopes (404).“. Abhilfe: die Show im Show-Editor bearbeiten, die Adresse eintragen und neu binden.“
- „Anhänge eines Side Events werden bei jedem Aufklappen frisch geholt und aktualisieren sich, solange die Liste offen ist; „Stand“ nennt die letzte Prüfung. In iveo gelöschte Anhänge verschwinden. Beim Speichern aus der Liste gelten dieselben Dateinamen wie im Ordner; eine Datei mit ausführbarer Endung wird gespeichert, aber nicht automatisch geöffnet.“
- „Neu: Der Launcher mit dem iveo-Token legt die Anhänge der Side Events in Ordnern neben der Show-Datei ab („‹Show› – Side Events“) und hält sie aktuell. Was iveo entfernt oder ersetzt, wandert nach „entfernt“, nichts wird gelöscht. Dateien mit ausführbarer Endung bekommen eine geänderte Endung. Abschaltbar im Side-Events-Panel.“ (Der letzte Satz bleibt: OF8, Vorgabe vom Owner bestätigt.)
- „Fehlt für diesen Rechner ein Installationspaket, nennt der Launcher den Grund. Er nimmt das neueste Release, das ein Paket für diesen Rechner hat; ein Mac mit Intel-Prozessor bekommt nie ein Paket nur für Apple Silicon.“

Alle Anführungszeichen in den Notes sind typografisch, auch die verschachtelten.

**Titler 0.11.1**
- „Neue Variablen {{organisation}} (Hauptorganisation) und {{organisationen}} (alle, mit „ · “ verbunden) für Bauchbinden aus iveo. Bestehende Vorlagen bleiben unverändert.“
- „Die Werte kommen mit Launcher 0.16.0; mit einem älteren Launcher bleiben die beiden Variablen leer. Im Verbund braucht auch der gekoppelte Rechner Titler 0.11.1.“

**Connect** (keine neue Version): nur Katalog-Beschreibung (10.6); der Changelog-Eintrag von 0.3.0 bleibt.

### 14.3 Nachzug des Titler-Piloten

- **Weg:** wie der Pilot-Plan es vorsieht (Pilot-Plan @ `848fc448a6`, „Vor der Umsetzung“ Zeilen 13688-13693, „Nach der Umsetzung“ Punkt 1, Zeilen 13700-13702): Hat sich `main` bewegt, setzt der Controller den Plan bzw. den Branch auf den neuen Stand neu auf und misst nach (Vorher-Texte, Zählstände, Lock-Zeilen, Rot-Meldungen); Abweichungen werden vor dem Start nachgebessert (G16 des Plans). Ein Merge von `main` in den Pilot-Branch oder ein Rebase nur nach Owner-Entscheid.
- **Sichere Konflikte** (in der Spec-Prüfung mit `git merge-file` gegen den Pilot-Stand gemessen):
  - `packages/cookbook/content/tool-manuals/tool-jm-titler.md`: Der Pilot ändert Zeile 47, fügt nach Zeile 51 zwei Zeilen ein und ändert die Zeilen 75 und 76 (Plan Zeilen 12908-12926, 12955-12970); dieses Paket ändert `:51`, `:66`, `:77` (15.1).
  - `packages/cookbook/cookbook.json`: Beide bauen sie neu (Plan Zeilen 12972-12974; 15.1). Nicht von Hand auflösen, sondern nach dem Nachzug `npm run cookbook:build` und `npm run cookbook:check`.
- **Verschobene Messwerte** (kein Textkonflikt gemessen, aber der Plan prüft sie fest):
  - `.github/workflows/ci-checks.yml`: 22 Schritte im Job `selftests` (Plan Zeilen 268, 13230) werden mit 12.9 zu 23; die 128 Zeilen nach Task 7 (Plan Zeile 677) wachsen um die neuen Zeilen.
  - Titler-Selbsttest: die erwarteten Zählstände 512 bzw. 538 `ok` (Plan Zeile 259) wachsen um die Fälle aus 12.5.
  - „0.11.0 / Lock 0.11.0“ (Plan Zeile 13233) wird „0.11.1 / Lock 0.11.1“; der Changelog-Anker „vor dem Eintrag 0.11.0 (`:1103`)“ (Plan Zeile 13712) verschiebt sich um den Eintrag 0.11.1.
  - `docs/roadmap.md`: Der Pilot ändert eine Zelle in Lane E (Plan Zeilen 132, 12853), dieses Paket `:280`, Abschnitt 1b und Abschnitt 3; gemessen ohne Überlapp, aber mit verschobenen Zeilen.
- **Weitere Berührungen:** `apps/titler/test/selftest.ts` (dieses Paket ändert `:68-88` und `:1093-1101`; der Pilot fügt einen Block vor `if (failed > 0) {` bei `:1398` ein, Plan Zeile 1773, und ändert die Datei in Task 3 und 4, Plan Zeilen 348, 13691-13692). Nach dem Release-Commit des Piloten (Plan „Nach der Umsetzung“ Punkt 5, Zeilen 13711-13716) zusätzlich `apps/titler/package.json:3`, `package-lock.json:738` und `packages/suite-manifest/changelog.json` im Block `titler`. Keine Berührung in `iveo-show.ts`, `datalink-kern.ts`, `packages/show` (Plan Zeilen 136–141).
- Der Abnahme-Bau 0.12.0 des Piloten wird nach dem Nachzug neu gebaut; seine Abnahme bekommt die Zeile „Organisationen in der Bauchbinde wie Titler 0.11.1“.

---

## 15 · Doku und Folgepunkte

### 15.1 Doku

| Datei | Änderung |
| --- | --- |
| `docs/jm-show.md` Abschnitt 8 (`:171`; Speaker-Absatz `:226-240`) | Organisationen in der Show; Auffrischen etwa alle 5 Minuten in beiden Abgleich-Arten (ersetzt `:232-237`); einmaliges Neuschreiben nach dem Update, wenn die Speaker in iveo Organisationen haben; Statuszeilen T50 und T51 |
| `docs/jm-show.md` neuer Abschnitt 9 „Anhänge und Side-Event-Ordner“ | Liste im Panel und „Stand“; Ordner neben der Show; welche Side Events (OF7) und der Block „Weitere Side Events der Ablage“; `entfernt/`; gesperrte Endungen; Indexdatei nicht löschen; Basisordner beim Umbenennen der Show mit umbenennen; nur am Rechner mit Token und ohne Rolle „Mit Master verbinden“; zwei Rechner mit Token und die Sperrdatei (OF10), nach einem Neustart läuft die Ablage am selben Rechner sofort weiter, Rechner mit gleichem Namen (T73); Speichern im Panel ohne automatisches Öffnen gesperrter Endungen (8.6); Schalter (OF8) |
| `docs/jm-show.md` Abschnitt 3 (`:47`) | ein Satz zur Basis-URL: leer = Standard Production; beim Bearbeiten zeigt das Feld die gespeicherte Adresse der Show |
| `packages/cookbook/content/tool-manuals/tool-jm-titler.md` (`:51`, `:66`, `:77`) | Variablen `{{organisation}}`, `{{organisationen}}`, Spaltenliste der `speakers.tsv`, Hinweis zur Vorlagengestaltung bei leerer Organisation (5.7), im Verbund Titler 0.11.1 auch auf dem gekoppelten Rechner |
| `packages/cookbook/content/tool-manuals/tool-jm-connect.md` (`:11`, `:29`, `:50`, `:51`, `:61`) | macOS ohne Zoom und (OF1) ohne NDI: Gäste erscheinen nicht als NDI-Quelle (`:50`) und sehen und hören das Programm nicht; der Rückkanal mit Mix-Minus (`:51`) gilt nur unter Windows; Installation über den Launcher |
| `packages/cookbook` | `npm run cookbook:build` (= `npm run build -w @jm/cookbook`, Wurzel-`package.json:38`), danach `npm run cookbook:check` (`:39`) |
| `docs/roadmap.md` (`:280`; Abschnitt 1b; Abschnitt 3) | Prod-URL erledigt; iveo-Paket mit Status; Folgepunkte |
| `apps/launcher/ABNAHME-iveo-paket.md` | neu (13) |

### 15.2 Folgepunkte

| # | Aufgabe | Warum nicht jetzt |
| --- | --- | --- |
| FP1 | **NDI für Connect auf dem Mac**: NDI-SDK für Apple in der CI (Lizenz und Download klären), Mac-Zweig in `apps/connect/tools/bundle-ndi.mjs` wie beim Titler (`docs/mac-build-windows-only-apps.md:7-18`) | neue Connect-Version nötig; OF1 (Vorgabe A bestätigt; ein lokaler Mac-Bau mit NDI wie beim Titler, Variante C, ist dem Owner am 17.10.2026 angeboten und offen) |
| FP2 | **Connect zeigt Ausfälle von NDI an**, auf Windows und Mac: einen gestorbenen Gast-Sender (heute nur im Log, kein Zuhörer auf das Ende, `apps/connect/src/main/ndi-guests.ts:38-79`) und einen beendeten Programm-Empfänger (heute wird der Zustand `off`, `apps/connect/src/main/ndi-program.ts:69-74`, und das Abzeichen verschwindet ohne Text, `apps/connect/src/renderer/src/App.tsx:611-620`) | Connect-Code, eigene Version |
| FP3 | PSD-/Grafiktool-Zuordnung von Ebenen „Organisation“ auf `{{organisation}}` (`apps/titler/src/renderer/src/lib/psd-import.ts:25-29`) | Bedienlogik, Nicht-Ziel |
| FP4 | Anhänge auf Verbund-Rechnern (Binärkanal) | 2b-Spec FA2 |
| FP5 | Vorschau der Anhänge | Nicht-Ziel |
| FP6 | Sperre für Cloud-Sync-Ordner: Dort kommt die Sperrdatei (9.2) nur verzögert beim anderen Rechner an; ein Ersatz bräuchte einen gemeinsamen Dienst statt einer Datei | Netzlaufwerke deckt die Sperrdatei ab; Cloud-Sync ist eine Annahme, nicht gemessen |
| FP7 | Rollen der Organisationen (`role_at_organisation`) als Variable | Nicht-Ziel, auf Prod nur 4-mal gesetzt |
| FP8 | Einstellungsfenster: Proxy-, Katalog-URL und GitHub-Token werden beim Speichern geleert, weil die Felder leer starten (7.2) | außerhalb des iveo-Pakets |
| FP9 | Event-Token-Schlüssel aus Basis-URL und Slug (`settings.ts:185-206`) | Kollision Staging/Prod nur theoretisch |
| FP10 | `/speakers?updated_since` (2b-Spec FA5 Variante A), um die Last zu senken | iveo-Verhalten nicht gemessen |
| FP11 | Inhaltssignatur über eine Prüfsumme, die Anhang-Kennung oder `updated_at`, je nach Ergebnis von M4 (M1 ist gemessen, der Hash der Referenz steht schon in der Signatur, 8.3); ebenso der Rückweg zur Signatur ohne Hash, falls sich die Referenz ohne neue Datei häufiger ändert (Risiko 22) | Messung in der Abnahme; iveo-API |
| FP12 | Rosetta erkennen (`sysctl.proc_translated`), damit ein x64-Launcher auf einem Apple-Silicon-Mac arm64-Pakete bekommt; heute zählt `process.arch` (`apps/launcher/src/main/release-source.ts:31-33`) | betrifft nur einen x64-Launcher unter Rosetta; die Texte sagen „Launcher-Architektur“ (T29, T69) |
| FP13 | Side-Event-Liste der Datei im Agenda-Modus ohne Tagesgrenze: Der Show-Editor speichert dort nur `{programId}` (`apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:231-232`), der Zusatzabruf bildet die Liste damit über alle Tage (`apps/launcher/src/main/iveo-abgleich-kern.ts:454`). Abhilfe: Tag mitspeichern oder den Tag des Side Events nehmen | ändert die Liste der Datei und damit den Rundown (`apps/rundown/src/main/index.ts:700`, `:715`); 9.3 grenzt die Ablage unabhängig davon ein |
| FP14 | Herkunftsmarkierung abgelegter Dateien (Zone.Identifier, Quarantäne), falls sich der Bedarf zeigt | OF9: Vorgabe ohne Markierung vom Owner am 17.10.2026 bestätigt |

---

## 16 · Risiken

| # | Risiko | Gegenmittel |
| --- | --- | --- |
| 1 | Das Connect-Mac-Paket hat kein NDI: Gäste erscheinen nicht als NDI-Quelle und sehen und hören das Programm nicht; Ausfälle von Gast-Sender und Programm-Empfänger sind still (Log bzw. Abzeichen ohne Text). | OF1; ehrliche Katalog-Beschreibung und Handbuch (10.6, 15.1); FP1, FP2; Prüfschritt 10.2; Abnahme Schritt 15 |
| 2 | Die erste Runde lädt alle Anhänge der Ablage-Menge (ein Tag, OF7) über das Netz am Veranstaltungsort. | nacheinander, Größengrenze, Rückhaltung, Schalter (OF8), Zeile mit Fortschritt; Abnahme Schritt 11 |
| 3 | Eine ersetzte Datei gleicher Größe und gleichen Typs bleibt unerkannt, wenn iveo ihr keine neue Asset-Referenz gibt (nicht gemessen, M4). | SHA-256 der Referenz in der Signatur (M1 gemessen, 8.3); M4 in der Abnahme (13, Schritt 12); Bediener löscht die Datei → wird neu geladen (9.5); FP11 |
| 4 | Mehr Last bei iveo (6.7), Limit unbekannt; mit Tagesgrenze höchstens 12 Side Events (M5 gemessen), ohne Tagesgrenze bis 67. | nacheinander, aus Takt und Ablage höchstens zwei Abrufe gleichzeitig (E28; Bedienaktionen kommen dazu), Retry-After, 270-s-Raster, Tagesgrenze (OF7), M5 (gemessen: bis 440 Abrufe je Stunde im Agenda-Modus, 6.7), Schalter |
| 5 | iveo liefert vorübergehend eine leere Agenda: alle Dateien wandern nach `entfernt/`. | nichts wird gelöscht; beim nächsten Abruf kommen sie zurück (9.5, ohne Download) |
| 6 | Zwei Launcher mit Token pflegen denselben Ordner (Show auf Netzlaufwerk oder synchronisiertem Ordner). | Sperrdatei (9.2, OF10), eigen nach Rechnername, gelöscht am Ende der Ablage, Prozesskennung in den Zwischennamen, Aufräumen nur eigener Dateien; Restfenster: der erste Takt, in dem beide den Basisordner anlegen, zwei Launcher mit gleichem Rechnernamen bis zur Erkennung (T73), eine beim Beenden liegen gebliebene Sperre (ein anderer Rechner übernimmt nach 15 min, T57 nennt die Zeit), und Cloud-Sync mit Verzögerung (FP6); Handbuch |
| 7 | Windows sperrt geöffnete Dateien; Virenscanner und Cloud-Sync sperren Zwischendateien und den Index. | Warten statt Fehlschlag (9.6), Index-Stand im Speicher (E47), Wiederholung je Runde, Zeile sagt es |
| 8 | Pfade auf Netzlaufwerken oder in tiefen Ordnern überschreiten 260 Zeichen. | Längenregel für jeden erzeugten Pfad (9.12 Regel 10), Fehler „Pfad zu lang“ je Side Event bzw. Datei (S4, T22) |
| 9 | Ein alter Launcher speichert die Show im Editor und verliert die Organisationen; ein neuer schreibt sie wieder. | Release-Notes; alle Launcher aktualisieren |
| 10 | Shows ohne `baseUrl`, gebunden an Staging, fragen nach dem Update die Standardadresse ab. | Statuszeile „Token ungültig oder widerrufen“ (HTTP 401) oder „Event nicht gefunden oder außerhalb des Token-Scopes (404).“ (HTTP 404); welcher Text kommt, ist nicht gemessen (7.3). Release-Notes mit beiden Texten; E16 verhindert das künftig |
| 11 | Ändert iveo die Reihenfolge der Speaker zwischen Abrufen, schreibt jedes Auffrischen. | 2b-Spec 23 M3 (angenommen stabil); T2/Log zeigt es; der Titler hält seinen Eintrag über den Schlüssel |
| 12 | Die Abnahme braucht ein unveröffentlichtes Test-Side-Event mit Anhängen. | sonst „entfällt“ mit Nachweis durch 12.3/12.4 |
| 13 | Der neue Proxy wählt für alle Tools anders: strengere Mac-Architektur, und ein Mac bekommt bei einem Tool, dessen neuestes Release kein DMG hat, ein älteres Release. | Testtabelle 12.7; Trockenlauf mit Vorlage an den Owner vor dem Deploy (10.7); Gegenprobe nach dem Deploy |
| 14 | Konflikte beim Nachzug des Titler-Piloten. | 14.3: Weg des Pilot-Plans (neu aufsetzen, nachmessen), Konfliktdateien und verschobene Messwerte benannt |
| 15 | `.url`-Dateien öffnen sich auf dem Mac nicht wie erwartet. | Annahme, Abnahme Schritt 15 |
| 16 | Das Tag aus `gh release create` löst den Connect-Mac-Workflow nicht aus. | Hand-Start (10.1, M3) |
| 17 | Zwischen der Prüfung des Zielnamens und `rename` bleibt ein Restfenster von Millisekunden; eine genau dann gleichnamig angelegte Datei würde ersetzt. | Prüfung unmittelbar vor jedem Platzieren (9.6), Vergleichsform (9.9); Test 12.4 Nr. 31 |
| 18 | Die Sperrliste benennt legitime Anhänge um (etwa ein `.dmg`- oder `.iso`-Paket als Anhang). | Die Datei wird trotzdem abgelegt; Zusatz T68, Log T70; der Bediener benennt sie um; OF9 |
| 19 | Die Rückhaltung verzögert einen erneuten Download bis zu 10 Minuten, auch beim aktiven Side Event. | neue Inhaltssignatur oder neue Sitzung setzt sie zurück; die Zeile nennt die Zeit des nächsten Versuchs; OF5 |
| 20 | Merker nur im Speicher (`detailVeraltetSeit`, `orgFehlenSeit`, `seListeVeraltetSeit`) gehen bei einem Neustart verloren; bis zur ersten Abfrage zeigt die Statuszeile „in Ordnung“. | die erste Abfrage im ersten Takt setzt sie neu (höchstens 45 s); Speichern der offenen Show behält sie (6.5) |
| 21 | `main` bewegt sich vor dem Plan weiter (heute zwei Doku-Commits, Kopf 0). | Zeilen vor dem Plan nachmessen |
| 22 | Rotiert iveo den Signaturschlüssel der Asset-Referenz oder ändert sich deren 16-Zeichen-Teil periodisch (in 10,5 min nicht beobachtet, M1), gelten alle Datei-Anhänge einmal als geändert; ändert sich die Referenz gar je Abruf, lädt jede Runde neu. | Einmaliges Neuladen je Anhang, die alte Fassung wandert nach `entfernt/` (nichts gelöscht, 9.10), Log T21 (d) macht es sichtbar; bei COP31 sind es 4 Datei-Anhänge (M1); M4 in der Abnahme; bei häufigem Wechsel zurück zur Signatur ohne Hash (FP11) |

---

## 17 · Owner-Fragen

Jede Frage hat eine Vorgabe; eine andere Antwort ändert nur die genannten Abschnitte. **Entschieden am 17.10.2026:** Der Owner hat alle Vorgaben OF1–OF10 mit „passt“ bestätigt (Spalte „Owner-Entscheid“). Zu OF1 ist ein Wechsel auf Variante C angeboten und offen; bis zu einer Antwort gilt A, und der Plan hängt nicht davon ab. OF1, OF5 und OF6 sind nach der Spec-Prüfung geändert, OF7–OF10 neu; die Vorgabe von OF10 ist nach der Nachprüfung genauer gefasst (NP1), die Frage selbst bleibt. OF6 nennt seit den Restbefunden die Herkunft der Asset-Adresse in M1 und die Schwelle 30 für M5 (NR8, NR9).

| # | Frage | Empfehlung (Vorgabe dieser Spec) | Betrifft | Owner-Entscheid (17.10.2026) |
| --- | --- | --- | --- | --- |
| OF1 | **Connect auf dem Mac ohne NDI.** Das Mac-Paket aus der CI hat kein NDI-Addon (4.6 Nr. 7): Gäste kommen in den Raum, Warteraum und Freigabe laufen, Gäste hören einander und die Regie per Talkback (nach dem Code, **Annahme** bis Abnahme Schritt 15). Kein Gast erscheint als NDI-Quelle, und die Gäste sehen und hören das Programm nicht, weil der Rückkanal per NDI-Empfang kommt. Beide Ausfälle sind still: Ein gestorbener Gast-Sender steht nur im Log, das Programm-Abzeichen verschwindet ohne Text (`apps/connect/src/renderer/src/App.tsx:611-620`). I4 sagt „Gäste und Cloud-Raum laufen“. Reicht das für #256, und darf ein Paket ausgeliefert werden, dessen Ausfälle nur im Log bzw. ohne Text sichtbar sind? Alternativen: (B) Connect 0.3.1 mit NDI auf dem Mac (NDI-SDK in der CI, Mac-Zweig im Bundle-Skript, sichtbarer Hinweis, wenn NDI fehlt); (C) lokaler Mac-Bau mit NDI wie beim Titler; (D) erst Connect 0.3.1 mit sichtbarer Anzeige der Ausfälle (FP2), dann das Mac-Paket. | **Nachlauf 0.3.0 ohne NDI und ohne Zoom** (behebt die Installation sofort); Katalog-Beschreibung (10.6) und Handbuch sagen vor dem Installieren, was fehlt; der Prüfschritt sichert es (10.2). FP1 und FP2 als nächster Connect-Schritt. | 0.1, 10, 13, 15, 16 | Vorgabe (A) bestätigt; Wechsel auf C angeboten, offen. Auf die Rückfrage des Owners, ob man für NDI auf einem Mac bauen muss: ja, nur Connect, lokal wie beim Titler (`docs/mac-build-windows-only-apps.md`); die Zoom-Bridge ist Windows-only. Bis zu einer Antwort gilt A; der Plan setzt A um und hängt nicht von C ab. |
| OF2 | **Auffrischen im Agenda-Modus ohne Verknüpfung.** Soll die Show dann die ganze Speakerliste des Events bekommen (wie heute beim Binden und mit Merker), oder bleibt die Liste der Datei (wie heute beim Umschalten), wodurch sie nie aufgefrischt wird? | **Ganze Liste**; die Antwort beim Umschalten sagt es (T4), die Notes auch (14.2). | 6.3, 6.4, 12.2, 14.2 | Vorgabe bestätigt („passt“). |
| OF3 | **Name des Basisordners.** „‹Showname›“: der Dateiname der Show (Vorgabe) oder der Name im Show-Editor? Beim Umbenennen im Editor würde sonst ein neuer Ordner entstehen; zwei Shows gleichen Namens im selben Ordner teilten sich einen. | **Dateiname ohne `.jmshow`**; er entsteht beim ersten Speichern aus dem Showname. | 9.1, 9.11 | Vorgabe bestätigt („passt“). |
| OF4 | **Ordner nur für Side Events mit Anhängen?** I3 sagt „je Side Event ein Ordner“. | **Ja**; ein Side Event ohne Anhang bekommt keinen leeren Ordner. | 9.1, 12.4 Nr. 25 | Vorgabe bestätigt („passt“). |
| OF5 | **Grenzen und Rückhaltung für Downloads:** höchstens 2 GiB je Datei, mit `size_bytes` höchstens die angekündigte Größe; keine Gesamtgrenze; 60 s ohne Daten = Abbruch; 1 GiB Platz bleibt frei; ein wiederholt scheiternder Download derselben Fassung wird zurückgehalten (45 s, dann doppelt so lange je Fehlschlag, höchstens 10 min), auch beim aktiven Side Event. Dessen Agenda wird trotzdem in jedem Takt abgeglichen (Entwurf „im 45-s-Takt“); zurückgehalten wird nur der wiederholte Download. | **So.** Ohne Rückhaltung lüde ein dauerhaft scheiternder Download alle 45 s die ganze Datei neu. | 9.6, E29, 11.2, 12.4 Nr. 20, 37 | Vorgabe bestätigt („passt“). |
| OF6 | **Messaufgaben M1 und M5:** Darf vor dem Plan ein lesendes Prüfskript mit dem Owner-Token (a) zweimal die Agenda eines Side Events mit Datei-Anhang abrufen (Ausgabe nur Form, Herkunft gegenüber der Basis-URL und Gleichheit der Asset-Adresse, M1) und (b) die Side Events je Tag zählen (nur Anzahlen, M5)? M4 läuft in der Abnahme am Test-Side-Event. | **Ja**; ohne M1 gilt die vorsichtige Signatur ohne Asset-Adresse, ohne M5 die Annahme n ≤ 30 je Tag. Misst M5 an einem Tag mehr als 30, kommt die Grenze als Owner-Frage, bevor der Plan beginnt. | 6.7, 8.3, 9.5, 9.6, 12.11 | Vorgabe bestätigt („passt“); M1 und M5 am 17.10.2026 gemessen (12.11): SHA-256 der Asset-Referenz in der Signatur (8.3), n ≤ 12 je Tag (6.7), die Schwelle 30 wird nicht erreicht. |
| OF7 | **Welche Side Events bekommen einen Ordner?** I3 sagt „je Side Event ein Ordner“; der Entwurf nennt keine Menge. Vorgabe dieser Spec: die Side Events der Show-Bindung (Liste in der Datei), begrenzt auf den Tag der Bindung bzw. des aktiven Side Events, dazu das aktive (9.3). Das Panel zeigt dagegen alle Programme eines frei wählbaren Tags aus dem Cache, ohne Typ-, Format- oder Blockerfilter (`apps/launcher/src/main/iveo-sync.ts:568-575`); dort steht bei Side Events außerhalb der Ablage T40 bzw. T60. Ohne Tagesgrenze stünden im Agenda-Modus nach der ersten Programmänderung alle Programme des Events in der Liste (Prod: 67; FP13). Alternativen: (B) die ganze Liste der Bindung ohne Tagesgrenze (bis 67, Last 6.7 bis rund 1 170 Abrufe je Stunde); (C) jedes Programm, das das Panel am gewählten Tag zeigt (ohne Typfilter, also auch Programme, die keine Side Events sind); (D) alle Programme des Events. | **Vorgabe**: Sie hält Last und Ordnerzahl beim Tag der Show; das aktive Side Event bekommt immer einen Ordner. | 0.1 Nr. 9, 2, 6.7, 9.3, 9.13, 11.2, 12.4 Nr. 42 | Vorgabe bestätigt („passt“). |
| OF8 | **Schalter und Kopfzeile.** Der Entwurf kennt weder einen Schalter „Anhänge in Side-Event-Ordnern ablegen“ noch eine Kopfzeile mit „Ordner öffnen“ für den Basisordner; er nennt „Ordner öffnen“ nur je Side Event. Vorgabe: beides (9.13, 9.14), Schalter je Rechner, Standard an; die Kopfzeile sagt Rolle, fehlendes Token, Sperre und den nächsten Abgleich (11.1). Grund: ein Not-Aus für langsame Netze am Veranstaltungsort, ohne das Token zu entfernen. Alternativen: (B) ohne Schalter, Kopfzeile bleibt (es entfallen 9.2 Nr. 4, 9.14, K3 mit T34, T26, `iveo:setzeAnhangOrdner`, der Teil „Schalter aus“ von 12.4 Nr. 27, Abnahme Schritt 16 und „Abschaltbar …“ in den Notes); (C) ohne Schalter und ohne „Ordner öffnen“ in der Kopfzeile. | **Vorgabe** (Schalter und Kopfzeile). | 0.1 Nr. 10, E26, 9.2, 9.13, 9.14, 11.1, 12.4, 13, 14.2 | Vorgabe bestätigt („passt“). |
| OF9 | **Schutz abgelegter Dateien aus fremden Labels.** Vorgabe: Sperrliste ausführbarer Endungen (ihr Punkt wird `_`, die MIME-Endung kommt dazu), Steuer-, Format- und Bidi-Zeichen ersetzt (9.12), **keine** Herkunftsmarkierung. Frage: Sollen abgelegte Dateien zusätzlich als „aus dem Internet“ markiert werden (Windows: Datenstrom `Zone.Identifier` mit `ZoneId=3`, als `HostUrl` nur die Basis-Herkunft, nie die signierte Adresse; macOS: Attribut `com.apple.quarantine`)? Folge: PowerPoint, Word und Excel öffnen sie dann in der geschützten Ansicht und sperren Makros (bekanntes Office-Verhalten, **Annahme**); das bremst den Showbetrieb. Wie Node die Markierung setzt, ist ungeprüft (**Annahme**: unter Windows durch Schreiben nach `‹Datei›:Zone.Identifier`, unter macOS nur über das Programm `xattr`). Alternativen: (B) Markierung für alle abgelegten Dateien; (C) Markierung nur für Makro-Formate (`.pptm`, `.docm`, `.xlsm`). | **Vorgabe** (Sperrliste, keine Markierung); FP14. | 0.1 Nr. 16, E49, 9.12, 12.4 Nr. 1–2 | Vorgabe bestätigt („passt“). |
| OF10 | **Zwei Rechner mit Token, eine Show.** Der Entwurf sagt „Der Launcher mit Token (Master oder Einzelplatz) lädt“. Öffnen zwei Rechner mit Token dieselbe Show (Netzlaufwerk, synchronisierter Ordner), pflegten beide denselben Ordner: doppelte Downloads, ein Index mit zwei Schreibern, und das Aufräumen des einen löschte den laufenden Download des anderen. Vorgabe: Sperrdatei im Basisordner, nur ein Rechner legt ab, der andere zeigt K5 mit T57 (9.2). Eigen ist eine Sperre mit dem eigenen Rechnernamen, auch nach Neustart oder Update; endet die Ablage, löscht der Launcher seine Sperre; zwei Launcher mit gleichem Rechnernamen erkennt der zuerst ablegende in seinem nächsten Takt und hört auf (T73). Alternative: (B) keine Absicherung, nur ein Satz im Handbuch (erste Fassung dieser Spec). | **Vorgabe** (Sperrdatei). | 0.1 Nr. 16, E45, 9.2, 9.6, 11.1, 12.4 Nr. 40, 13 Schritte 11 und 20 | Vorgabe bestätigt („passt“). |

---

## 18 · Nachbesserung nach der Spec-Prüfung

Spec-Prüfung vom 16.10.2026 mit fünf Prüfern (Entscheidungen, Code, Dateisystem und Sicherheit, Wahrheit, Test und Release); 90 bestätigte Befunde, die als „wichtig“ und „kritisch“ gemeldeten mit Gegenprüfung. Jeder Befund ist hier am Code bzw. am Text nachgeprüft (Stand `5e5b234ec3`); die Fundstellen stehen in den genannten Abschnitten. Drei widerlegte Befunde (Wortlaut von OF3/OF4, Bearer an eine fremde Herkunft, Text von K10, in der Spec-Prüfung noch K8) sind nicht umgesetzt. Wo ein Befund vom freigegebenen Entwurf abweichen würde, ist daraus eine Owner-Frage geworden: neu OF7–OF10, geändert OF1, OF5, OF6.

**Ergebnis:** 90 von 90 umgesetzt, davon 11 mit begründet angepasstem oder ausgewähltem Vorschlag (B3, B5, B6, B11, B29, B38, B39, B78, B79, B82, B84); keiner ganz abgelehnt. Dazu drei Eigenbefunde (N1–N3).

| B | Schwere | Ergebnis | Was | Ort |
| --- | --- | --- | --- | --- |
| B1 | wichtig | umgesetzt | Erfundenes Entwurfszitat „die der Show-Bindung“ gestrichen; die Eingrenzung steht als Ergänzung in 0.1 und als Owner-Frage, mit dem Unterschied zum Panel (Tag frei wählbar, kein Typfilter). | 0.1 Nr. 9, E27, 9.3, OF7 |
| B2 | wichtig | umgesetzt | Schalter und Kopfzeile in 0.1 offengelegt, Scheinzitat „Abschalten“ aus E26 entfernt, Owner-Frage mit der Liste, was ohne Schalter entfällt. | 0.1 Nr. 10, E26, 9.14, OF8 |
| B3 | klein | umgesetzt (zweite Variante) | Startzeit-Anker und Kategorie kommen beim Auffrischen aus dem frischen Detail, geschrieben nur bei Abweichung; offengelegt; Test mit verschobener Startzeit und Gegenprobe ohne Änderung. Die erste Variante (alte Werte behalten) ist abgelehnt: Kontext aus zwei Detail-Ständen (`iveo-abgleich-kern.ts:321-322`). | 0.1 Nr. 2, E11, 6.3, T3, 12.2 Nr. 4 |
| B4 | wichtig | umgesetzt | Merker `detailVeraltetSeit` im Speicher wie `seListeVeraltetSeit`, Statuszeile T50, Detail in jedem Takt bis zum Erfolg; Test mit Gegenprobe. | E12, E50, 6.3, 6.5, T50, 12.2 Nr. 7 |
| B5 | klein | umgesetzt, angepasst | Organisationszahl (E8/T1), T9, Kappungen (E4, mit Messwert), Textkosmetik (T20) und CI-Schritt in 0.1; 6.5 und 9.11 sind laut Gegenprüfung keine Abweichung und stehen als Verweis im Vorspann von 0.1. | 0.1 Vorspann, Nr. 4, 11–14 |
| B6 | klein | umgesetzt (offengelegt) | T2 bleibt als Logzeile (Diagnose für Bediener und Abnahme), ist aber als Ergänzung benannt; „gemeldet“ in I2 meint Datei und Tools. | 0.1 Nr. 11, 6.2 |
| B7 | klein | umgesetzt | Doku-Satz und Notes sagen, dass nur Shows mit Organisationen in iveo und nur am Rechner mit Token neu geschrieben werden. | 5.5, 14.2 |
| B8 | klein | umgesetzt | Die vier Dateien in 14.3 aufgenommen, getrennt nach sicheren Konflikten und verschobenen Messwerten. | 14.3 |
| B9 | klein | umgesetzt | Erkennung nur über MIME und Größe in 0.1; neue Messaufgabe M4 (Kennung, Asset-Adresse, Größe, `updated_at` beim Ersetzen). | 0.1 Nr. 15, 12.11 M4, 13 Schritt 12 |
| B10 | klein | umgesetzt | Größengrenze im Verbund in 4.0 berichtigt, Zuwachs für COP31 geschätzt (**Annahme** zur Namenslänge), Test unter der Grenze. | 4.0 Nr. 5, 5.8, 12.1 Nr. 10 |
| B11 | wichtig | umgesetzt, angepasst | Eigener Download-Client ohne Zeitgrenze; keine Wiederholung nur bei Abbruch durch den Aufrufer (`init.signal?.aborted`), die Wiederholung nach der 15-s-Grenze bleibt (`iveo-huelle-hilfen.ts:34-36`); Test „genau ein Aufruf“. | E46, 9.6, 12.1 Nr. 8, 12.4 Nr. 47 |
| B12 | wichtig | umgesetzt | Entschieden: Der Merker „Speaker veraltet“ allein holt wie heute nur die Liste, das Detail nur „fällig“ oder der neue Detail-Merker; beide Bestandstests in 12.8 („bleibt grün“ bzw. „bewusst neu“). | 6.3, 6.7, 12.8 |
| B13 | wichtig | umgesetzt | `loadForEdit` füllt das Feld aus `show.iveo.baseUrl` über den reinen Helfer `editorAdresseAusShow`; Test mit Gegenprobe. | 0.1 Nr. 4, E16, 7.4, 12.6 Nr. 3 |
| B14 | wichtig | umgesetzt | Aufklapp-Zustand in den Store, beim Schließen und Event-Wechsel zugeklappt; jede Anmeldung lässt den Main den Stand neu senden; 11.3 neu gefasst. | E18, 8.1, 8.4 Nr. 3, 11.3 |
| B15 | wichtig | umgesetzt | Ablage-Menge mit Tagesgrenze (OF7), Last mit n bis 67, Block „Weitere Side Events der Ablage“ auch ohne Cache, Zähler gestörter Side Events in der Kopfzeile. | 9.3, 6.7, 9.13, T64, T65, 12.4 Nr. 42 |
| B16 | klein | umgesetzt | E28 und 6.7 auf „innerhalb des Ordner-Teils nacheinander, höchstens zwei Abrufe gleichzeitig“ eingeschränkt. | E28, 6.7, 8.2 |
| B17 | klein | umgesetzt | Rückfall auf den Ordner mit dem erwarteten Namen ohne oder mit ungültigem Index (siehe B34). | 9.1 |
| B18 | klein | umgesetzt | Zeitpunkt vor dem Abruf, Vorrücken nach Schreiben bzw. gleicher Signatur; Test mit 20 s Abrufdauer. | E9, 6.1, 12.2 Nr. 14 |
| B19 | klein | umgesetzt | `compareVersions` zieht nach `release-wahl.ts`. | 10.4, 12.7 Nr. 3 |
| B20 | klein | umgesetzt | Launcher-Update in die Fehlertabelle (F10, F11, T69). | 10.4, 11.5 |
| B21 | klein | umgesetzt | `JmpsApi` in 8.6 und 9.15; Skriptänderung `selftest:iveo` wörtlich. | 8.6, 9.15, 12.9 |
| B22 | klein | umgesetzt | Längenregel für jeden erzeugten Pfad samt Zusätzen; eigene `.tmp` werden nach Muster aufgeräumt. | 9.6, 9.10, 9.12 Regel 10 |
| B23 | klein | umgesetzt | wie B10. | 4.0 Nr. 5, 5.8 |
| B24 | klein | umgesetzt | Aussage über „Show-Datei nicht lesbar“ auf die Fälle eingeschränkt, in denen der Kern liest; die Kopfzeile verlässt sich nicht darauf. | 9.11 |
| B25 | klein | umgesetzt | 4.6 Nr. 8 und 10.3 sagen „baut aus dem Tag, wie das Windows-Paket 0.3.0“. | 4.6 Nr. 8, 10.3 |
| B26 | klein | umgesetzt | `client.ts:72`, `shared/types.ts:56`, Titler-Zeile `:1101`, Zoom-Bridge-Skript `maybe-build.mjs:9-12` berichtigt. | 4.3 Nr. 6, 7.1, 10.1, 11.6, 12.8 |
| B27 | klein | umgesetzt | Unter K0 steht T52 zur Ablage. | 9.11, 11.1, T52 |
| B28 | klein | umgesetzt | Summen für beide Abgleich-Arten getrennt. | 6.7 |
| B29 | wichtig | umgesetzt, angepasst | Sperrliste statt Positivliste (eine Positivliste wäre Funktionsverlust: `.mov`, `.mkv`, Keynote fehlen in `MIME_EXT`, `iveo-sync.ts:602-616`); Endung mit mindestens einem Buchstaben; C1 und Kategorie Cf ersetzt; Herkunftsmarkierung als Owner-Frage. | E49, 9.12 Regeln 2, 9; 12.4 Nr. 1–2; OF9 |
| B30 | wichtig | umgesetzt | `pruefeLink`: Steuerzeichen verwerfen, nur `href` schreiben und speichern; Test mit der gemessenen Eingabe, Gegenprobe Rohtext. | E31, 9.7, 9.8, 12.4 Nr. 19 |
| B31 | wichtig | umgesetzt | wie B11; dazu Abbruchgründe (`leerlauf`, `bedienung`) und eigene Fehlerabbildung. | E46, 9.6, 9.13, T22 |
| B32 | wichtig | umgesetzt | Plan erst beim Ausführen, Zielname unmittelbar vor jedem Platzieren neu geprüft, nie überschreiben, je Side Event ein Eintrag; Attrappe ersetzt beim `rename` wie NTFS; zwei Tests mit Gegenprobe. | E48, 9.4, 9.6, 12.4 Nr. 28, 31 |
| B33 | wichtig | umgesetzt | Index-Stand im Speicher und Nachschreiben, Eintrag `laedt` vor dem Platzieren, Übernahme nach Name und Größe auch bei unbekannter Kennung, Problem „Index nicht schreibbar“; Tests. | E47, 9.5, 9.6, 9.8, 11.2, 12.4 Nr. 32–33 |
| B34 | wichtig | umgesetzt | Wiederfinden mit Rückfall auf den erwarteten Namen, Regel bei doppelter `programId` (T66); Test über das Wiederfinden nach Neustart mit Gegenprobe. | E32, 9.1, T66, 12.4 Nr. 34 |
| B35 | wichtig | umgesetzt | Indexprüfung auf reine Namen und genaues `wartet`-Muster, Wächter für Quelle und Ziel, `lstat` für die Ordner; Tests mit `../x`, `C:\x`, `\\h\s\x`, `entfernt/../../x`. | 9.8, 9.10, 9.12 Regel 11, 12.4 Nr. 35 |
| B36 | wichtig | umgesetzt | Eine Pfadfunktion für alle Namen, Regeln 3–8 nach dem Kürzen erneut, Budget mit Reserve für `entfernt\` und Zusätze, Begründung von Regel 4 berichtigt (gemessen: Node legt „Klima “ wörtlich an). | 9.12 Regeln 4, 10; 12.4 Nr. 4 |
| B37 | wichtig | umgesetzt | Attrappe gibt Namen unverändert zurück (Profile NTFS, APFS, HFS+/SMB), Vergleichsform ausdrücklich; echter Dateisystem-Test im Plan auf Windows und macOS. | 9.9, 12.4 Attrappe, Nr. 36, „Echte Dateisysteme“ |
| B38 | wichtig | umgesetzt, angepasst | Grenze `min(size_bytes, 2 GiB)` während des Ladens, jeder Fehler löscht die Zwischendatei, `statfs`-Fehler geregelt, Rückhaltung mit höchstens 10 statt 30 min (Gegenprüfung: der 45-s-Takt des Entwurfs), Agenda weiter jeden Takt; Owner-Frage. | E29, 9.6, T22, 12.4 Nr. 20, 37, 38, OF5 |
| B39 | klein | umgesetzt, angepasst | „gegen“ statt „spätestens“, Zustand „erste Runde ausstehend“ (K8, T58), wartende Zeile S6 (T62). Ein Download wird für das aktive Side Event weiter nicht unterbrochen (Gegenprüfung: E28, Entwurf „nacheinander“). | 9.4, 11.1, 11.2 |
| B40 | wichtig | umgesetzt | Sperrdatei mit Lebenszeichen, Zwischennamen mit Prozesskennung, Aufräumen nur eigener Dateien, Kopfzeile K5; Test mit zwei Läufen und Gegenprobe; Owner-Frage. | E45, 9.2, 9.6, 11.1, 12.4 Nr. 40, OF10 |
| B41 | wichtig | umgesetzt | Geheimnis-Suche über alle Ausgaben mit drei Gegenproben; `oeffneAsset` gibt keine Weiterleitungsadresse heraus. | E20, 9.6, 12.1 Nr. 8, 12.4 Nr. 41 |
| B42 | wichtig | umgesetzt | `pruefeLink` auch vor `shell.openExternal`; Notice T53; Tests. | 8.6, T53, 12.4 Nr. 19 |
| B43 | klein | umgesetzt | Lauf-Generation nach jedem `await`; Rolle in jedem Takt und vor jedem Schritt gelesen. | 9.2 Nr. 3, 9.4, 12.4 Nr. 23 |
| B44 | klein | umgesetzt | Titelquelle: Liste der Bindung, Cache `meta.programs`, sonst `programId`; Umbenennen, wenn der Titel später bekannt wird. | 9.1 |
| B45 | klein | umgesetzt | Laufzeitprüfung `id`, `kind`, `size_bytes`; doppelte Kennung; Problem in der Zeile. | 8.5, T22, 12.3 Nr. 1, 12.4 Nr. 43 |
| B46 | klein | umgesetzt | Ordner-Teil nur mit `fs/promises`. | 9.8 |
| B47 | klein | umgesetzt | `fh.sync()` vor `rename`; Größe abweichend bei gleicher Änderungszeit → nach `entfernt/… (unvollständig …)`, neu laden. | 9.5, 9.6, 12.4 Nr. 39, 44 |
| B48 | klein | umgesetzt | Alte `.url` wandert nach `entfernt/`. | E31, 9.7 |
| B49 | klein | umgesetzt | Aufräumen nur nach genauem eigenem Muster. | 9.6, 12.4 Nr. 24 |
| B50 | klein | umgesetzt | Regel 7 trimmt vor dem Vergleich; Fälle `CON .pdf`, `nul  .txt`, `CONIN$`. | 9.12 Regel 7, 12.4 Nr. 1 |
| B51 | klein | umgesetzt | `purged_at` als **Annahme** gekennzeichnet; jeder Wert außer `null`, fehlend, `false`, Leerstring gilt als gelöscht; Test mit Zahl und `true`. | E22, 8.5, 12.3 Nr. 1 |
| B52 | klein | umgesetzt | Eigene Zeile S4 (T63) für nicht anlegbaren Ordner und „Pfad zu lang“. | 11.2 |
| B53 | klein | umgesetzt | wie B2. | 0.1 Nr. 10 |
| B54 | klein | umgesetzt | Manueller Download streamt über `oeffneAsset` in eine Zwischendatei. | 8.6 |
| B55 | wichtig | umgesetzt | wie B14; Abnahme Schritt 8 prüft Schließen und Wiederöffnen. | 8.1, 11.3, 12.3 Nr. 9, 13 Schritt 8 |
| B56 | wichtig | umgesetzt | Ereignis nach jeder gelungenen Prüfung mit Zeit (Liste nur bei Änderung); „Stand“ = letzte gelungene Prüfung; Test angepasst. | E21, 8.4, 11.3, 12.3 Nr. 3 |
| B57 | wichtig | umgesetzt | Auslöser „gescheitert → gelungen“; Test mit Vorgeschichte und Gegenprobe. | 8.4, 12.3 Nr. 4 |
| B58 | wichtig | umgesetzt | S1 geteilt: S2 „Nicht mehr in der Ablage dieser Show, Ordner bleibt unverändert“ mit aktivem „Ordner öffnen“. | 11.2, T40, T60 |
| B59 | wichtig | umgesetzt | T32 sagt nur, was dieser Rechner tut (Rolle auch ohne Kopplung). | 11.1, T32 |
| B60 | wichtig | umgesetzt | wie B39; T4 ohne „spätestens“; „überfällig“ bewertet der Renderer selbst. | E13, E51, 11.1, T4, T59 |
| B61 | wichtig | umgesetzt | wie B4. | 6.3, 12.2 Nr. 7 |
| B62 | wichtig | umgesetzt | wie B15 (Block, Zähler, auch ohne Cache). | 9.13, 11.2 |
| B63 | wichtig | umgesetzt | `meldeAgenda` direkt nach dem Agenda-Abruf; Test mit werfender Speakerliste und Gegenprobe. | E19, 8.2, 12.2 Nr. 12 |
| B64 | wichtig | umgesetzt | `ordnerFehlerText`: Bedienabbruch kein Fehler, Leerlauf eigener Grund, 404 je Ressource, 5xx ohne Log-Verweis, Adressen ersetzt, Rohmeldung in T23/T25; Kommentar `:213-214` ergänzt. | 9.13, T22, T23, T25 |
| B65 | wichtig | umgesetzt | T7 nennt die Standardadresse dieses Rechners, T9 „Standard für neue Bindungen …“, 7.5 genauer, Abnahme 3 an Schritt 2 gekoppelt. | 7.2, 7.5, T7, T9, 13 Schritte 2–3 |
| B66 | wichtig | umgesetzt | Katalogtext ganz neu gefasst (Programm-Rückkanal nur Windows; Mac ohne Programm, aber mit Gast-zu-Gast-Ton und Talkback, **Annahme** bis Abnahme); OF1 fragt nach den stillen Ausfällen; FP2 und Risiko 1 nennen den Programm-Empfang; Handbuch `:50-51`. | 0.1 Nr. 1, 4.6 Nr. 7, 10.6, 15.1, 15.2 FP2, 16, OF1 |
| B67 | wichtig | umgesetzt | „Sitzung“ definiert; S7/S8 für die Zeit vor dem ersten Abruf; „Ordner öffnen“ an „existiert“ gebunden; Stand mit Datum, wenn nicht von heute; Problem-Formen ergänzt; Fortschritt höchstens einmal je Sekunde. | 2, 9.6, 11.2, 12.4 Nr. 45–46 |
| B68 | wichtig | umgesetzt | Zustandsachsen je Tabelle; Test über alle Kombinationen (genau eine erste Zeile, Text je Klasse). | E51, 11, 11.1–11.3, 12.3 Nr. 8, 12.4 Nr. 30 |
| B69 | klein | umgesetzt | T35 ohne geratene Ursache, Ablage läuft von selbst weiter; „nicht lesbar“ in K4. | 9.11, 11.1, T35, 13 Schritt 18 |
| B70 | klein | umgesetzt | T1 vollständig mit typografischem Filterlabel und „ ⚠ ‹Warnung›“; reiner Helfer `bindMeldung` mit Test. | 5.9, T1, 12.6 Nr. 4 |
| B71 | klein | umgesetzt | T54–T56 für „Kein Datei-Asset …“ und die Logzeilen. | 8.6, 11.6 |
| B72 | klein | umgesetzt | Schreibweise der Texttabelle, ‹n› in T2 definiert, „rund 13“ statt 12 Zeilen je Stunde. | 6.2, 11.6 |
| B73 | klein | umgesetzt | Notes präzisiert, OF2-Folge genannt. | 14.2 |
| B74 | klein | umgesetzt | Als **Annahme** gekennzeichnet, beide möglichen Texte. | 7.3, 14.2, Risiko 10 |
| B75 | klein | umgesetzt | Texte sagen „Launcher-Architektur“; Rosetta-Erkennung als Folgepunkt. | E41, 10.5, T29, T69, FP12 |
| B76 | klein | umgesetzt | Fehlt das Feld bei allen Speakern, bleiben die Organisationen der Datei, Statuszeile T51, Log T71; Test mit Gegenprobe. | E50, 5.10, 12.2 Nr. 13 |
| B77 | kritisch | umgesetzt | Release-Commit vor dem Merge: Versionen in `package.json` und Lock, Changelog mit JSON-Prüfung; Schritt „Prüfung“ statt Changelog am Ende. | E44, 14.1 Nr. 1, 8 |
| B78 | klein | umgesetzt, angepasst | `:750-751` und `:1101` als „bewusst neu“, `:1294-1297` „bleibt grün“; `:1180` und `:1313-1314` bekommen nur einen Zusatz im Testnamen (Gegenprüfung: sie bleiben grün und verstoßen nicht gegen 12.8); Schlusssatz um die Ausnahme für Texte aus 11.6 ergänzt. | 12.8 |
| B79 | wichtig | umgesetzt, angepasst | Weg des Pilot-Plans (neu aufsetzen, nachmessen), Konfliktdateien, verschobene Messwerte, Berührungen nach dem Release-Commit des Piloten. Teil (d) laut Gegenprüfung widerlegt, die Dateien bleiben für den Fall nach Punkt 5 genannt. | 14.3 |
| B80 | wichtig | umgesetzt | Reiner Renderer-Helfer `anhangListeSchritt` mit Test und Gegenprobe „nur ohne Liste laden“. | 8.1, 12.3 Nr. 9 |
| B81 | wichtig | umgesetzt | Auswertung der Proxy-Antwort, Wahl der GitHub-Quelle und Fehlertexte als reine Helfer; Ausnahme in der Einleitung von 11; Abnahme-Schritt für den Fehlerweg auf dem Mac. | 10.4, 11, 12.7 Nr. 2–3, 13 Schritt 19 |
| B82 | klein | umgesetzt, angepasst | (a) Titler 0.11.1 auf B und Bauchbinde auf B; (c) Schritt 4 mit laufendem Timer und scharfer Rundown-Zeile; (d) K4 durch Umbenennen; (e) L6 nach Wiederöffnen. (b) war laut Gegenprüfung nicht belegt; der Fehlerweg von I4 steht trotzdem als Schritt 19 (B81). | 13 |
| B83 | wichtig | umgesetzt | wie B11; Test mit echtem Server auf 127.0.0.1, Gegenprobe mit dem Hüllen-Client. | 9.6, 12.4 Nr. 47 |
| B84 | klein | umgesetzt, angepasst | `bindungsAdresse` als reiner Helfer mit Test; Nr. 6 im Agenda-Modus mit „Zielname existiert nicht, solange Bytes fließen“; Nr. 27 einzeln mit Gegenprobe; Rolle eingereicht. Kein Test für E7 (bewusste Nicht-Änderung, `packages/iveo/src/mapper.ts:371`); E15 trägt Abnahme Schritt 2, ein Selbsttest scheitert an `settings.ts:1` (Electron). | 7.4, 12.4 Nr. 6, 21, 27, 12.6 Nr. 2 |
| B85 | wichtig | umgesetzt | Trockenlauf alt gegen neu für alle Katalog-Tools auf drei Plattformen, Vorlage an den Owner; Deploy außerhalb laufender Connect-Sitzungen; Gegenprobe mit x64 und einem Windows-Tool. | E43, 10.5, 10.7, Risiko 13 |
| B86 | klein | umgesetzt | Bot-Satz für den Launcher gestrichen; „`main` vor den Tags“ bleibt mit richtiger Begründung. | 14.1 Nr. 3 |
| B87 | klein | umgesetzt | Titler nach dem Runbook: Tag auf dem Merge-Commit, Bau aus dem Tag in eigenem Worktree, `--target` falls `gh` das Tag anlegt, Bump mit „[skip ci]“. | 14.1 Nr. 5 |
| B88 | klein | umgesetzt | Skriptkette wörtlich; `compareVersions` verlegt; eine gemeinsame Tabelle `paketwahl-faelle.json`. | 10.4, 10.5, 12.7, 12.9 |
| B89 | klein | umgesetzt | Prüfung als Node-Skript mit Selbsttest und Gegenproben; `GH_TOKEN` im Upload-Schritt. | 10.1 Nr. 9, 10.2, 12.9 |
| B90 | klein | umgesetzt | Fall ab JSON-Text über `parseShow` und Fall über `masterStand`. | 12.5 Nr. 4 |

**Eigenbefunde beim Nachbessern:**

| # | Befund | Umsetzung | Ort |
| --- | --- | --- | --- |
| N1 | Die neuen Merker im Speicher (`detailVeraltetSeit`, `orgFehlenSeit`) und `speakerAbgerufen` gingen beim Speichern der offenen Show verloren: `offeneShowGespeichert` baut die `AktiveShow` über `setzeAuf` neu (`apps/launcher/src/main/iveo-abgleich-kern.ts:1122`, `:639-651`), und die Statuszeile zeigte bis zur nächsten Abfrage „in Ordnung“ (Lehre „Konstruktoren greppen, nicht Leser“; Owner-Regel Statuszeile). | Beide Konstruktoren reichen die Felder weiter wie `seListeVeraltetSeit`, die Bedingung `:653` prüft alle Merker; Umschalten löscht den Detail-Merker; Test mit Gegenprobe. | 6.5, 12.2 Nr. 10 |
| N2 | 5.10 nannte nicht, an welchen Stellen die Regel „Organisationen der Datei bleiben“ greift. | Drei Stellen mit frischen Speakern benannt (`:547` mit `:742`/`:1041`, `:859`, `:939`), Binden ausdrücklich ausgenommen. | 5.10 |
| N3 | T29 galt laut Tabelle nur für die GitHub-Quelle; auch eine Proxy-Antwort ohne Paket führt zu `null` (`apps/launcher/src/main/release-source.ts:195`). | F8 und T29 auf beide Quellen erweitert. | 11.5, 11.6 |

**Nicht umgesetzt (widerlegt in der Gegenprüfung):** der angebliche Widerspruch von OF3/OF4 zum Wortlaut (offengelegt in 0.1 Nr. 5, Vorgabe gilt erst mit der Freigabe); der Bearer an eine fremde Herkunft (Node-`fetch` entfernt `Authorization` beim Wechsel der Herkunft, gemessen unter Node 24; für Electron 33 **Annahme**; diese Begründung deckt nur die Weiterleitung, den direkten Fall einer `asset.url` auf fremdem Host oder mit `http:`, `packages/iveo/src/client.ts:351`, `:364-366`, regelt seit den Restbefunden E52, NR9); der Text von K10 (in der Spec-Prüfung noch K8; greift wegen der Vorrangkette nur ohne Basisordner; der Text heißt jetzt trotzdem „noch nichts abgelegt“, T39).

**Nachfix nach der Nachprüfung (17.10.2026):** Die Nachprüfung der nachgebesserten Spec (Stand `5e5b234ec3`) fand alle 41 vorgelegten Befunde in der Sache behoben und meldete zwei neue wichtige Fehler, beide aus der Nachbesserung selbst (B40 und B29/B42). Beide sind hier am Code nachgeprüft, bestätigt und behoben; keiner ist abgelehnt, keiner weicht vom freigegebenen Entwurf ab (die Sperrdatei bleibt Vorgabe zu OF10, die Schutzregeln stehen in 0.1 Nr. 16). Die neun kleinen Befunde der Nachprüfung (dort N3–N11) waren nicht Gegenstand dieses Nachfixes und sind offen (inzwischen erledigt, Block „Restbefunde der Nachprüfung“ unten); den Satz zu den Ausnahmen in 9.2, den die Nachprüfung in N7 nennt, ergänzt NP1 nur um das Löschen der eigenen Sperre.

| NP | Schwere | Ergebnis | Befund | Am Code nachgeprüft | Umsetzung | Ort |
| --- | --- | --- | --- | --- | --- | --- |
| NP1 | wichtig | umgesetzt, erweitert | Eine Sperre galt als fremd, sobald ihre `sitzung` abwich; gelöscht wurde sie nur beim Schließen der Show und beim Ausschalten. Nach Absturz, Update oder Beenden mit offener Show hielt die eigene alte Sperre die Ablage bis zu 15 min an, und T57 nannte den eigenen Rechner. E26 und E45 sprachen von „anderer Rechner“, die Regel prüfte die Sitzung; Test Nr. 40 schrieb das fest. Bei Rollenwechsel und Tokenverlust blieb die Sperre liegen. | Bestätigt: Einzelinstanz `apps/launcher/src/main/index.ts:63` mit `packages/electron-kit/src/index.ts:101-109`; `before-quit` stoppt nur den Steuerserver (`index.ts:94`); das Update beendet die App (`installer.ts:395`). Schlimmer als gemeldet: Eine Show wird nie geschlossen, nur durch eine andere ersetzt (`stopIveoPolling`, `iveo-sync.ts:512`, hat keinen Aufrufer), „beim Schließen“ griff also nie; und ohne Token bleibt die Show im Kern aktiv (`iveo-abgleich-kern.ts:685-689`), 9.2 Nr. 2 (`kern().aktiv() !== null`) hätte den Tokenverlust nicht bemerkt. | Vorschlag übernommen: eigen nach Rechnername (`os.hostname()`), Löschen am Ende der Ablage (jedes Öffnen einer Show, Rolle `slave`, Token weg, Schalter aus) und beim Beenden (`before-quit`, angestoßen, ohne das Beenden aufzuhalten; **Annahme**, Abnahme Schritt 20); Token in jedem Takt gelesen (`tokenDa()`). Erweitert: Regel 4 „namensgleich“ mit T73, weil ein reiner Namensvergleich zwei Launcher gleichen Rechnernamens (anderer Benutzer, geklonter Rechner wie im Verbund, `verbund/kern.ts:428-433`) beide ablegen ließe; T57 sagt „liegt bei … letztes Lebenszeichen … übernimmt gegen“, weil eine liegen gebliebene Sperre sonst „Ablage läuft“ behauptete; T75 im Log bei gescheitertem Löschen. Test Nr. 40 (a)–(d) mit vier Gegenproben, darunter „Regel nur nach `sitzung`“. | Begriffe, E26, E45, 4.5 Nr. 8, 9.2, 9.4, 9.6, 9.15, 11.1 (Achse, K5), T57, T73, T75, 12.4 Nr. 40, 13 Schritt 20, 15.1, Risiko 6, OF10 |
| NP2 | wichtig | umgesetzt | 8.6 übernahm `pruefeLink` nur für Links. Für Dateien blieb die alte Namensregel, und `shell.openPath` öffnete die Datei sofort: „Agenda.exe“ hieß im Ordner „Agenda_exe.pdf“, im Panel „Agenda.exe“ und startete ohne Doppelklick, gegen die eigene Begründung in 0.1 Nr. 16. 12.4 Nr. 19 prüfte einen `oeffneExtern`-Aufruf ohne benannten reinen Helfer. Dass mit dem Streaming die Endung aus dem `Content-Type` entfällt, stand nicht da. | Bestätigt: `iveo-sync.ts:618-621` (`extFor`), `:692-694` (Name und Dialog nach dem vollständigen Abruf), `:697` (`void shell.openPath(r.filePath); // zum Testen gleich öffnen`); Electron-Import `:22`. | Reine Helfer `panelAnhangSchritt` (Link, Datei, Fehler) und `panelDateiOeffnen` in `side-event-ordner.ts`; Vorschlagsname über die Namensfunktion des Ordners (9.12 Regeln 1–9 samt Sperrliste, Namensgrenzen aus Regel 10, ohne Pfadbudget); kein automatisches Öffnen, wenn das Label oder der im Dialog gewählte Name eine gesperrte Endung hat (T74); Dialog vor dem Abruf, Wegfall des `Content-Type`-Rückfalls offengelegt (Prod: 4 von 4 Datei-Anhängen mit `asset.mime_type`). 12.4 Nr. 19 prüft jetzt den Helfer, neu Nr. 48 mit zwei Gegenproben; Notes und Abnahme Schritt 20 (c). | 0.1 Nr. 16, 4.4 Nr. 7, E49, 8.6, 9.15, T74, 12.4 Nr. 19 und 48, 13 Schritt 20, 14.2, 15.1 |

**Restbefunde der Nachprüfung (17.10.2026):** Die neun kleinen Befunde der Nachprüfung (dort N3–N11, hier NR1–NR9) sind am Text und am Code nachgeprüft (Code-Stand `5e5b234ec3`; der Worktree-Kopf `c235844bf3` ändert nur diese Spec). Alle neun sind bestätigt und umgesetzt, keiner ist abgelehnt; keiner weicht vom freigegebenen Entwurf ab, die neue Schutzregel E52 steht in 0.1 Nr. 16. Neue Kennungen: E52, T76, T77, 12.1 Nr. 11, 12.4 Nr. 49.

| NR | Nachprüfung | Ergebnis | Was | Ort |
| --- | --- | --- | --- | --- |
| NR1 | N3 | umgesetzt | Die längste Form in Regel 10 ist die mit „unvollständig“ (6 Einheiten länger als die mit „ersetzt“); sie ist jetzt das Maß, und die Reserve von 60 deckt sie auch beim Mindeststamm (52). Test an der Grenze mit Gegenprobe. | 9.12 Regel 10, 12.4 Nr. 4 |
| NR2 | N4 | umgesetzt | Übernahme auch für Links: `.url` mit erwartetem Namen und byteweise dem Inhalt aus 9.7. Ein Datei-Anhang ohne gültiges `size_bytes` wird nie übernommen; die Grenze ist benannt (nach einem Index-Verlust einmal „ (2)“; Prod: 4 von 4 Datei-Anhängen mit Größe). Der Eintrag `laedt` trägt die geschriebene Bytezahl `bytes`, damit auch dieser Fall ohne `size_bytes` entscheidbar ist. Test mit drei Gegenproben. | E47, 9.1, 9.5, 9.6, 9.8, 12.4 Nr. 33 |
| NR3 | N5 | umgesetzt | S6 gilt nur für das aktive Side Event (9.4 maßgeblich); andere wartende zeigen ihre Zeile nach S7–S13; Achse „Download“ angepasst. Test mit Gegenprobe. | 9.4, 11.2, 12.4 Nr. 28 |
| NR4 | N6 | umgesetzt | K7 bekommt eine Uhr-Achse: mehr als 105 s (Leerlauf-Grenze plus ein Takt) ohne Fortschritt → T76 „kein Fortschritt seit ‹hh:mm›“, bewertet vom Renderer; der Stand trägt `letzterFortschritt`. Der Text sagt bewusst nicht „hängt“, weil auch Wiederholungen nach HTTP 429 so lange dauern können. Test mit Gegenprobe. | E51, 9.6, 9.15, 11.1, T76, 12.4 Nr. 30, 49 |
| NR5 | N7 | umgesetzt | Die Ausnahmen in 9.2 gelten nur unter ihrer Bedingung: Prüfung der Show-Datei und Lesen der Sperrdatei nur, wenn Nr. 1–4 gelten; Existenzprüfung des Basisordners für K3 ausdrücklich erlaubt (höchstens eine je Takt); Löschen der eigenen Sperre (aus NP1) nur einmal am Ende der Ablage. 12.4 Nr. 27 zählt danach je Fall, neue Gegenprobe „Ausnahmen ohne Bedingung“. | 9.2, 9.14, 12.4 Nr. 27 |
| NR6 | N8 | umgesetzt | „K8“ in der Zeile „Nicht umgesetzt“ und im Vorspann dieses Abschnitts heißt jetzt K10 (T39), mit Hinweis auf die alte Nummer. | 18 |
| NR7 | N9 | umgesetzt | Ereignis `aktivWechsel(id)` im Helfer, Kennung des aktiven Side Events im Zustand; `iveo-active-changed` ruft es auch bei gleichem Event (`apps/launcher/src/renderer/src/store/tools.ts:264-271`, Feld `activeProgramId`). Fall in 12.3 Nr. 9 mit Gegenprobe. | 8.1, 12.3 Nr. 9 |
| NR8 | N10 | umgesetzt | Eine Schwelle: 30 Side Events je Tag in 6.7, M5 (vorher 40) und OF6. | 6.7, 12.11 M5, OF6 |
| NR9 | N11 | umgesetzt | (a) „höchstens zwei Abrufe gleichzeitig“ gilt für Takt und Ablage; Bedienaktionen kommen dazu (Umschalten, `iveo-abgleich-kern.ts:1096`; Aufklappen, `iveo-sync.ts:629-660`; manueller Download). (b) Die Pakete des Launchers heißen am Release mit Punkten statt Leerzeichen (`release-source.ts:126-127`), ebenso die Connect-DMGs in 10.3. (c) Neu E52: Token nur an die Herkunft der Basis-URL, andere Herkunft nur über `https:` und ohne Token, sonst T77; entschieden im reinen Helfer `assetAnfrage`, für Ordner und Panel; M1 misst die Herkunft; Test 12.1 Nr. 11 mit Gegenprobe; die alte Ablehnung des Bearer-Befunds ist um den direkten Fall ergänzt. | 0.1 Nr. 16, E28, E52, 6.7, 8.2, 8.3, 8.6, 9.6, 9.13, 10.3, T22, T77, 12.1 Nr. 11, 12.11 M1, 14.1 Nr. 8, Risiko 4, OF6, 18 |

**Owner-Entscheide und Messungen (17.10.2026):**
- **Owner-Entscheide:** Der Owner hat am 17.10.2026 alle Vorgaben OF1–OF10 mit „passt“ bestätigt. Zu OF1 fragte er danach, ob man für NDI auf einem Mac bauen muss; Antwort: ja, nur Connect, lokal wie beim Titler (`docs/mac-build-windows-only-apps.md`), die Zoom-Bridge ist Windows-only. Angeboten ist der Wechsel auf Variante C; das ist offen, bis dahin gilt A, und der Plan hängt nicht davon ab. Eingetragen in Kopf (Status, Datum), 0.1 (Vorspann, Nr. 1, Nr. 16), Nicht-Ziele, E49, 9.12 Regel 9, 9.14, 10.2, 13 Schritte 15–16, 14.2, FP1, FP14 und 17 (Vorspann, Spalte „Owner-Entscheid“). Der Status der Spec bleibt „Entwurf“; eine Freigabe der ganzen Spec ist damit nicht vermerkt.
- **M5** (Prod, Event `cop31-gcp`, nur Anzahlen): 67 Programme, Typ-Slugs `program` 62, `invite_only` 4, `open` 1, kein Typ „Side Event“; je Tag höchstens 8, dazu 4 ohne Tag, keine Blocker. Weil Einträge ohne bekannten Tag nach 9.3 an jedem Tag mitzählen, rechnet 6.7 mit n = 12 (bis 440 Abrufe je Stunde im Agenda-Modus); die Schwelle 30 bleibt als Obergrenze und wird nicht erreicht. Eingetragen in 6.7, 12.11 M5, Risiko 4 und OF6.
- **M1** (Prod, nur Formen, Längen, Gleichheit, ohne Asset-Abruf): `asset.url` ist eine nackte signierte Referenz (279 Zeichen, base64url-JSON aus drei Strings, ein Punkt, 32-Byte-Signatur), ohne Zeitangabe, nach 10,5 min bei allen 4 Anhängen gleich; Herkunft = Basis-URL. Folge nach der Regel in 8.3: Material- und Inhaltssignatur nehmen den SHA-256 der Referenz auf, nie die Referenz selbst. Eingetragen in 2 (neuer Begriff „Asset-Referenz“), 0.1 Nr. 15, E20, E52, 8.3 (Helfer `referenzHash`), 9.5, 9.8, 12.1 Nr. 11, 12.3 Nr. 2 (zwei Gegenproben statt der alten Gegenprobe „Signatur mit `asset.url`“), 12.4 Nr. 8 (mit Gegenprobe) und Nr. 41 (Referenz in gemessener Form, Suche auch nach 16-Zeichen-Ausschnitten, Gegenprobe d), 12.11 M1, Risiko 3, neu Risiko 22 (Schlüsselwechsel: einmaliges Neuladen) und FP11. M4 in der Abnahme bleibt.
