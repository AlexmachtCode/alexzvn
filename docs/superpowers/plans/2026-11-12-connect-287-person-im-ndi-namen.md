# Connect 0.4.2 Nachtrag: Person im NDI-Namen (#287) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Schalter „Person im NDI-Namen“ lässt Teilnehmer-Slots beim Einschalten als „‹NDI-Name› (‹Person›)“ senden, damit die Kollegen vor der Show im Mischer sehen, wer auf welcher Quelle liegt.

**Architecture:** Eine reine Funktion `ndiNameMitPerson` bildet den Namen; `planeSlotAbgleich` setzt ihn beim Start in `slotOnBefehl` ein, wenn der Schalter an ist und der Slot im Modus Teilnehmer läuft. Der Kern merkt sich je Sender den Namen, mit dem er gestartet wurde, und vergleicht Bridge-Meldungen damit statt mit `e.ndiName`. Der Schalter liegt in `connect-settings.json` (Vorgabe aus) und kommt über einen eigenen IPC-Kanal und `ZoomAbbild.personImNdiNamen` in die Zoom-Karte.

**Tech Stack:** Electron 33 + electron-vite, TypeScript, React; Selbsttests per tsx mit `ck()`.

**Spec:** Owner-Freigabe im Chat 12.11.2026 09:33 („das passt so“) auf diese Beschreibung — es gibt kein eigenes Spec-Dokument; maßgeblich ist der Abschnitt „Owner-Beschreibung“ unten. Hintergrund: `docs/superpowers/specs/2026-10-17-connect-zoom-slots-design.md` (E26 NDI-Namen, 7.3 Slot-Abgleich, 0.23 keine Namen im Log).

## Owner-Beschreibung (freigegeben, wörtlich sinngemäß)

- Zweck: Absicherung beim Zuordnen der Quellen im Mischer VOR der Show.
- Nur Teilnehmer-Slots bekommen den Namen: „‹NDI-Name› (‹Person›)“, z. B. „Zoom 1 (Anna Müller)“. Sprecher- und Freigabe-Slots bleiben unverändert.
- Der Name wird beim Einschalten gebildet und bleibt stehen, bis der Slot aus ist. Ein Personenwechsel während der Show (Companion, Handwahl) benennt die Quelle NICHT um — der Mischer verliert nie eine Quelle; der Name kann dann veraltet sein, bis der Slot einmal aus- und eingeschaltet wird.
- Schalter „Person im NDI-Namen“, Vorgabe AUS (sonst zeigen nach dem Update bestehende Mischer-Eingänge ins Leere — mitten in der COP).
- Zu lange Namen auf 60 Zeichen kürzen, „:“ wird Leerzeichen.

## Global Constraints

- Version bleibt 0.4.2 (gleicher Release wie #290, heute 18:00). Keine neue Abhängigkeit.
- NDI-Namen (E26): 1–60 Code-Punkte (`NDI_NAME_MAX`), kein „:“, keine Steuerzeichen. `ndiNameFormFehler` bleibt der Prüfstein.
- Personennamen nie ins Log, nie in „Messwerte kopieren“, nie in Companion-Variablen (Spec 0.23). Der Name geht nur als NDI-Name an die Bridge.
- Quelltext: keine `\uXXXX`-Escapes schreiben (das Edit-Werkzeug dekodiert sie zu echten Zeichen) — `\u{…}`, `\x..` oder `\p{…}` verwenden.
- UI-Texte deutsch mit typografischen Anführungszeichen („…“), keine ASCII-Anführungszeichen in Texten.
- Selbsttests laufen unter Node 22 UND 24: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/master-link-2b" && npm run selftest -w @jm/connect` und `npm run typecheck -w @jm/connect` (Laufwerksbuchstabe GROSS im cd).

## Review Focus

1. Personenwechsel an einem laufenden Teilnehmer-Slot (Handwahl, `slotPersonWaehlen`, Companion „Person“): nur `slotSet`, kein `slotOff`/`slotOn`, und spätere Bridge-Meldungen mit dem alten Namen gelten weiter als eigener Sender (kein „fremder Sender“).
2. Schalter umlegen, während Slots laufen: kein laufender Sender wird gestoppt oder neu gestartet; erst der nächste Start nimmt den neuen Stand.
3. Kein Personenname in irgendeiner `d.log`-Zeile, auch nicht in Fehlerpfaden (`slotNameTaken`, fremder Sender, Fristablauf).
4. Namensränder: Person leer, Person nur Leerraum/Steuerzeichen, Person mit „:“, Slotname schon 57+ Code-Punkte, Slotname enthält die Person schon (Übergangsnamen „JM Connect – Zoom Anna“), Emoji/Astral-Zeichen beim Kürzen.
5. Neue Bridge / „Erneut beitreten“ / Z11: Slots starten mit dem Namen aus dem jetzigen Stand; eine späte Antwort auf ein slotOn mit anderem Namen bleibt „fremd“ (bestehende I-3-Tests grün).

---

### Task 1: Namensregel, Ablage, Abgleich

**Files:**
- Modify: `apps/connect/src/main/zoom/einstellungen.ts` (neue Funktion neben `uebergangsNdiName`)
- Modify: `apps/connect/src/main/settings.ts` (Feld + Getter/Setter nach dem Muster `zoomSprecher`/`setzeZoomSprecher`)
- Modify: `apps/connect/src/main/zoom/slots.ts` (`slotOnBefehl`, `AbgleichEingabe`, `planeSlotAbgleich`)
- Test: `apps/connect/test/zoom-teile.test.ts` (Namensregel, wie die PK35-Fälle), `apps/connect/test/zoom-settings.test.ts` (Ablage), `apps/connect/test/zoom-slots-abgleich.test.ts` (Abgleich)

**Interfaces:**
- Produces: `export function ndiNameMitPerson(ndiName: string, person: string): string` (einstellungen.ts)
- Produces: `zoomPersonImNdiNamen(): boolean` und `setzeZoomPersonImNdiNamen(an: boolean): boolean` (settings.ts; Rückgabe = Datei geschrieben; schlägt das Schreiben fehl, gilt der Wert nur für die Sitzung wie bei `zoomSprecherSitzung`). Feld in `Stored`: `zoomPersonImNdiNamen?: unknown`; gelesen gilt nur `=== true` als an.
- Produces: `slotOnBefehl(e: ZoomSlotEinstellung, ziel: number, ndi: string)` — `ndi` ersetzt `e.ndiName` im Befehl.
- Produces: `AbgleichEingabe.personImNdiNamen: boolean`; `planeSlotAbgleich` setzt bei `starten` `ndi = personImNdiNamen && e.modus === 'teilnehmer' ? ndiNameMitPerson(e.ndiName, e.person) : e.ndiName`.

- [ ] **Step 1: Failing tests Namensregel** (zoom-teile.test.ts), je ein `ck`:
  - `ndiNameMitPerson('Zoom 1', 'Anna Müller') === 'Zoom 1 (Anna Müller)'`
  - leer/Leerraum/nur Steuerzeichen: `ndiNameMitPerson('Zoom 1', '') === 'Zoom 1'`, `('Zoom 1', '   ') === 'Zoom 1'`, `('Zoom 1', '\x07') === 'Zoom 1'`
  - „:“ → Leerzeichen, Steuerzeichen weg, Rand-Leerraum der Person getrimmt: `('Zoom 1', ' Dr.:Anna\x07 ') === 'Zoom 1 (Dr. Anna)'`
  - Kürzen auf 60 Code-Punkte, Klammer bleibt zu: Slotname `'S'` + Person aus 80 × `'a'` → Ergebnis hat genau 60 Code-Punkte und endet auf `'a)'`
  - Astral-Zeichen werden nicht zerteilt: Person aus 70 × `'😀'` → Ergebnis gültig nach `ndiNameFormFehler`-Regeln (≤ 60 Code-Punkte, endet auf `')'`, keine einzelnen Surrogate)
  - kein Platz: Slotname mit 57 Code-Punkten → unverändert (mindestens ein Zeichen der Person muss in „ (x)“ passen, sonst Slotname allein)
  - Slotname enthält die Person schon (NFC, ohne Groß-/Kleinschreibung): `('JM Connect – Zoom Anna', 'anna') === 'JM Connect – Zoom Anna'`
  - Ergebnis ist nie ungültig: ist der zusammengesetzte Name nach der Formregel ungültig, kommt der Slotname zurück.
- [ ] **Step 2: Run** `npx tsx test/zoom-teile.test.ts` (in `apps/connect`) → FAIL (Funktion fehlt).
- [ ] **Step 3: Implement `ndiNameMitPerson`** — Person: „:“ → „ “, `STEUERZEICHEN_ALLE` weg, trimmen; leer → Slotname; Enthaltensein per NFC + `toLocaleLowerCase('de')` (wie `gleicherNdiName`); Person mit `kuerze` auf `NDI_NAME_MAX - codePunkte(ndiName) - 3` Code-Punkte; Rest < 1 → Slotname.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Failing tests Ablage** (zoom-settings.test.ts): fehlt/`"ja"`/`1` → `false`; nach `setzeZoomPersonImNdiNamen(true)` liest `zoomPersonImNdiNamen()` `true` und die Datei enthält `"zoomPersonImNdiNamen": true`; andere Felder (z. B. `zoomSlots`, `zoomLetzteNummer`) bleiben unverändert; Schreibfehler → Rückgabe `false`, Wert gilt für die Sitzung.
- [ ] **Step 6: Run / Implement / Run** wie oben.
- [ ] **Step 7: Failing tests Abgleich** (zoom-slots-abgleich.test.ts): Teilnehmer-Slot „Zoom 1“, Person „Anna“, `personImNdiNamen: true` → `starten` mit `befehl.ndi === 'Zoom 1 (Anna)'`; gleicher Slot mit `false` → `'Zoom 1'`; Sprecher- und Freigabe-Slot mit `true` → Slotname; laufender Teilnehmer-Slot mit neuer Person → nur `aendern`/`nameMerken`, kein `starten`/`stoppen`. Alle bestehenden Aufrufe von `planeSlotAbgleich` in Tests bekommen `personImNdiNamen: false`.
- [ ] **Step 8: Implement**, `npm run selftest -w @jm/connect` und `npm run typecheck -w @jm/connect` → grün (der Kern übergibt bis Task 2 vorläufig `personImNdiNamen: false`).
- [ ] **Step 9: Commit** `feat(connect): Namensregel und Schalter „Person im NDI-Namen“ – Ablage und Abgleich (#287)`

### Task 2: Kern — Sendername merken, Schalter, IPC

**Files:**
- Modify: `apps/connect/src/main/zoom/kern.ts` (Einstellungs-Abhängigkeiten bei `sprecher()`/`setzeSprecher` ~Z. 200; Slot-Datensatz ~Z. 381; I-3-Prüfung ~Z. 2228; `slotOnOffen.push` ~Z. 2381; Abbild)
- Modify: `apps/connect/src/main/zoom.ts` (Verdrahtung wie `zoomSprecher`), `apps/connect/src/shared/ipc.ts`, `apps/connect/src/preload/index.ts`, `apps/connect/src/shared/types.ts`
- Test: `apps/connect/test/zoom-kern.test.ts`, Attrappen in `apps/connect/test/zoom-slots.test.ts` nachziehen

**Interfaces:**
- Consumes: Task 1 (`zoomPersonImNdiNamen`, `setzeZoomPersonImNdiNamen`, `AbgleichEingabe.personImNdiNamen`, `slotOnBefehl(e, ziel, ndi)`).
- Produces: Kern-Abhängigkeit `personImNdiNamen(): boolean; setzePersonImNdiNamen(an: boolean): boolean`; Kern-Methode `personImNdiNamenSetzen(an: boolean): ZoomErgebnis` (Schreibfehler → Ergebnis mit dem bestehenden Hinweis „gilt nur für diese Sitzung“ wie bei Sprecher/Vorgaben); `ZoomAbbild.personImNdiNamen: boolean`; IPC `IPC.zoomPersonImNdiNamen = 'jmc:zoom-person-im-ndi-namen'`, Preload `zoomPersonImNdiNamen(p: { an: boolean }): Promise<ZoomErgebnis>`.

- [ ] **Step 1: Failing tests** (zoom-kern.test.ts, mit der vorhandenen Bridge-Attrappe):
  - K1: Schalter an, Teilnehmer-Slot „Zoom 1“ mit Person „Anna“ eingeschaltet, Anna im Meeting → gesendetes `slotOn.ndi === 'Zoom 1 (Anna)'`; Bridge meldet `slot starting`/`live` mit diesem Namen → Slot übernimmt den Sender, KEIN `slotOff` (kein fremder Sender).
  - K2: wie K1 laufend, dann Person per Slot-Änderung auf „Ben“ → kein `slotOff`, kein neues `slotOn`; weitere Meldungen mit `'Zoom 1 (Anna)'` bleiben übernommen.
  - K3: wie K1 laufend, dann `personImNdiNamenSetzen(false)` → kein Befehl an die Bridge; nach Stopp/Start des Slots geht `slotOn.ndi === 'Zoom 1'`.
  - K4: Schalter aus (Vorgabe) → `slotOn.ndi === e.ndiName` wie bisher; die bestehenden I-3-Tests (späte Antwort mit altem Namen = fremd) bleiben grün.
  - K5: `abbild().personImNdiNamen` folgt dem Schalter; kein Log-Eintrag enthält „Anna“ (alle `d.log`-Zeilen der Tests K1–K3 prüfen).
- [ ] **Step 2: Run** `npx tsx test/zoom-kern.test.ts` → FAIL.
- [ ] **Step 3: Implement** — der erwartete Name eines Senders ist das `ndi` des `slotOn`, das ihn angelegt hat: beim Senden mit dem Eintrag in `slotOnOffen` ablegen, beim Übernehmen am Sender behalten, und die I-3-Prüfung vergleicht `e.ndi` damit (neuer Sender: mit dem ältesten offenen slotOn; laufender Sender: mit seinem gemerkten Namen). `planeSlotAbgleich` bekommt `personImNdiNamen: d.einstellungen.personImNdiNamen()`. Schalter umlegen ruft den Abgleich nicht zum Neustart laufender Slots auf.
- [ ] **Step 4: Run** → PASS; dann `npm run selftest -w @jm/connect` und `npm run typecheck -w @jm/connect` → grün.
- [ ] **Step 5: Commit** `feat(connect): Kern merkt den gesendeten NDI-Namen, Schalter „Person im NDI-Namen“ (#287)`

### Task 3: Zoom-Karte, Texte, Handbuch

**Files:**
- Modify: `apps/connect/src/shared/zoom-text.ts` (`BEDIEN_TEXT.personImNdiNamen`, Tooltip-Text)
- Modify: `apps/connect/src/renderer/src/zoom/SlotBereich.tsx` (Kontrollkästchen in der Kopfzeile neben „Vorschau“, gleiches Muster `aufrufe.fuehreAus('personImNdiNamen', 'slots', …)`)
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-connect.md` (Abschnitt Zoom-Slots), dann `packages/cookbook/cookbook.json` neu bauen
- Test: `apps/connect/test/zoom-text.test.ts`

**Interfaces:**
- Consumes: `ZoomAbbild.personImNdiNamen`, `window.jmconnect.zoomPersonImNdiNamen({ an })` (Task 2).

- [ ] **Step 1: Failing test** (zoom-text.test.ts): `BEDIEN_TEXT.personImNdiNamen === 'Person im NDI-Namen'`; der Tooltip-Text enthält „Zoom 1 (Anna Müller)“, „bis der Slot aus ist“ und „nicht um“; keine ASCII-Anführungszeichen `"` in beiden.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** Texte, wörtlich:
  - Beschriftung: `Person im NDI-Namen`
  - Tooltip: `Teilnehmer-Slots heißen beim Einschalten „‹NDI-Name› (‹Person›)“, z. B. „Zoom 1 (Anna Müller)“ – so sieht man im Mischer, wer auf welcher Quelle liegt. Der Name gilt, bis der Slot aus ist: Ein Personenwechsel benennt die Quelle nicht um. Gilt für Slots, die danach eingeschaltet werden; Sprecher- und Freigabe-Slots bleiben unverändert.`
  - Kontrollkästchen: `checked={a.personImNdiNamen}`, gesperrt während `aufrufe.laeuft.has('personImNdiNamen')`, Tooltip über das vorhandene `MitTooltip` oder `title`.
- [ ] **Step 4: Run** → PASS; `npm run typecheck -w @jm/connect` grün.
- [ ] **Step 5: Handbuch** — im Zoom-Slots-Abschnitt von `tool-jm-connect.md` ein Absatz mit dem Inhalt des Tooltips (Vorgabe aus; nur Teilnehmer-Slots; Name fest bis zum Ausschalten; bestehende Mischer-Eingänge mit dem bisherigen Namen finden die Quelle nach dem Einschalten des Schalters nicht mehr). Die Arbeitskopien unter `packages/cookbook/content` sind wegen `core.autocrlf` CRLF; ein Bau daraus schreibt `\r` in `cookbook.json` und die CI-Prüfung fällt. Darum in dieser Reihenfolge:
  1. Code, Texte und die .md committen: `feat(connect): Zoom-Karte – Schalter „Person im NDI-Namen“, Handbuch (#287)`.
  2. `git -c core.autocrlf=false checkout -f HEAD -- packages/cookbook/content` (holt die committeten Dateien als LF; erst NACH Schritt 1, sonst geht die Änderung verloren).
  3. `node packages/cookbook/src/build.mjs`, dann `node packages/cookbook/src/build.mjs --check` → grün; `grep -c $'\r' packages/cookbook/cookbook.json` → 0.
  4. Commit `docs(connect): cookbook.json neu gebaut (Handbuch JM Connect, #287)`.
