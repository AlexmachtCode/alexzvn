# Funktionsliste JM Titler (Suite-UX-Update, Welle 0 · Titler-Pilot)

Zweck (Spec `docs/superpowers/specs/2026-10-08-suite-ux-update-design.md`, Abschnitt 10 „Kein Funktionsverlust“, und
Anhang A „Titler“): jedes Bedienelement mit Handler, jedes Tastaturkürzel, jeder Dialog und jede Einstellung des Titlers,
erhoben **vor dem Umbau** aus dem Code. Nach dem Umbau bekommt jede Zeile in der Spalte „künftig wo“ einen Haken mit dem
Ort im neuen Aufbau; ein Punkt ohne Haken blockiert die Welle.

- **Stand:** erhoben aus dem Code am 2026-10-13, `main` `5e5b234ec3` (mit PR #250, #251, #253, #254), Titler 0.11.0.
  Nichts ausgeführt, kein Fenster geöffnet. Was nur aus dem Code abgeleitet ist, steht als „abgeleitet“, Unklares als
  „unklar“ bzw. „nicht gemessen“.
- **Gelesen, vollständig:** `apps/titler/src/renderer/**` (`index.html`, `main.tsx`, `App.tsx`, `globals.css`,
  `jmtitler.d.ts`, `vite-env.d.ts`, `store/titler.ts`, `lib/*.ts`, `views/*.tsx`), `preload/index.ts`, `shared/types.ts`,
  `shared/datenquelle.ts`, `shared/vars.ts`, `main/index.ts`, `main/control-server.ts`, `main/library.ts`,
  `main/config.ts`, `main/ndi/sender-process.ts`, `utility/ndi-sender.ts`. Ausschnitte: `shared/datalink-kern.ts`
  (Hinweise, Vorrang), `main/datalink.ts` (Fehler, Log), `shared/text-kodierung.ts` (Kopf), aus `@jm/ui` `Collapsible`,
  `Tabs`, `SettingsSection`, `SettingsPanel` (Tastenregel) und `Button`, aus `@jm/app-runtime` `verbund-ipc.ts`,
  `verbund-anzeige.ts`, `verbund.ts` und `index.ts` (Master-Link-Start).
- **künftig wo** bleibt leer. Die Spalte wird nach dem Umbau gefüllt und abgehakt.
- **Pfade:** ohne Präfix relativ zu `apps/titler/src/renderer/src/`; `main/…`, `preload/…`, `shared/…`, `utility/…` und
  `renderer/…` relativ zu `apps/titler/src/`; `app-runtime/…` = `packages/app-runtime/src/…`, `ui/…` =
  `packages/ui/src/components/…`; alles andere relativ zur Repo-Wurzel. Zeilennummern gelten für `5e5b234ec3`.
- **R2-Kennzeichnung:** „(R2)“ bzw. „R2:“ = mit Master-Link 2b R2 (Commit `1f0bcf9085`, der einzige Renderer-Commit seit
  `adda584693`) neu oder geändert. Ohne Kennzeichnung: älter.
- **Zustands-Kürzel** (Spalte „Zustand (sichtbar/aktiv)“): **imm.** = immer sichtbar, sobald `state` geladen ist ·
  **S** = nur im Reiter „Steuerung“ · **E** = nur im Reiter „Einstellungen“ · **auf** = nur bei aufgeklapptem Abschnitt.
- **Nummerierung:** fortlaufend 1–103 in den Abschnitten 1–7. Die Abschnitte 8 (IPC-Übersicht), 9 (Zuordnung zu Spec 6)
  und 10 (Befunde) haben keine nummerierten Punkte und werden nicht abgehakt.

---

## 1 · Hauptfenster (Operator, ohne `?view=`)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 1 | Fenster | Lade-Anzeige „Lädt…“ (ersetzt die ganze Ansicht) | – ; `load()` ohne `catch` (`store/titler.ts:47-48`): scheitert `getState`, bleibt „Lädt…“ stehen (abgeleitet) | solange `state` null ist | `views/OperatorView.tsx:235-237` | |
| 2 | Kopfzeile | Logo, „JM TITLER“, „Live-CG → NDI“ | – (Anzeige) | imm. | `views/OperatorView.tsx:251-256` | |
| 3 | Kopfzeile | Verbund-Abzeichen (V-Zeile V2–V15, Rahmen- und Textfarbe grün/gelb/rot/gedämpft, `max-w-[24rem]`, gekürzt, voller Text als Tooltip) (R2) | `window.jmtitler.verbundAnzeige()` beim Einhängen, `onVerbundAnzeige(setAnzeige)`; IPC `jmps:verbund-anzeige` (invoke + Push an alle Fenster, `app-runtime/verbund-ipc.ts:12-33`); Texte `app-runtime/verbund-anzeige.ts:24-77` | nur wenn eine Zeile kommt; `null` am Einzelplatz (`app-runtime/verbund-anzeige.ts:25`) und wenn das invoke scheitert (`preload/index.ts:89` fängt ab) → dann leerer Abstandshalter mit `ml-auto` | `views/OperatorView.tsx:257`, Komponente `:893-908`, Farben `:881-886` | |
| 4 | Kopfzeile | Pill „Suite · ⟨n⟩ verbunden“ / „Suite getrennt“, Punkt primär/gedämpft, Tooltip „Verbundene Suite-Steuerclients (Companion, Q&A, Battle, System-Zustand)“ (R2: `ml-auto` wanderte ans Abzeichen) | – (Anzeige `status.suiteClients`; gesetzt in `main/index.ts:779-782` aus `onStatus` des Steuerservers, `main/control-server.ts:131`; Port 8726 fest, `main/control-server.ts:27`) | imm.; „getrennt“ bei 0 Clients und ebenso, wenn der Steuerserver nicht startet (nur Log, `main/index.ts:806-810`) | `views/OperatorView.tsx:258-272` | |
| 5 | Kopfzeile | Pill „NDI · ⟨n⟩ Empfänger“ / „NDI aus“ | – (Anzeige `status.ndiActive`, `status.connections`) | imm. | `views/OperatorView.tsx:273-286` | |
| 6 | Live-Bereich | CG-Vorschau (Canvas 960×540 auf Schachbrett `.cg-checker`) | `useTitlerEngine(resolved, ndiActive, previewRef, { graphic })` (`:65`), Takt `setInterval` ≈ 60 Hz (`lib/engine.ts:184`) | imm. | `views/OperatorView.tsx:292-294` | |
| 7 | Live-Bereich | Knopf „● Take (On Air)“, Ring solange `live` | `take()` → `animateTo(1)`; `live` wird sofort true, nicht erst nach der Einblendung (450 ms) (`lib/engine.ts:15`, `:54-58`); Folge: Nr. 80 | imm., nie gesperrt | `views/OperatorView.tsx:296-303` | |
| 8 | Live-Bereich | Knopf „Clear“ | `clear()` → `animateTo(0)` (`lib/engine.ts:59`) | imm., nie gesperrt | `views/OperatorView.tsx:304-306` | |
| 9 | Live-Bereich | Hinweiszeile unter Take/Clear: „NDI-Quelle aktiv — in TriCaster/vMix/OBS …“ bzw. „NDI rechts starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.“ | – (Anzeige aus `ndiActive`) | imm. | `views/OperatorView.tsx:308-312` | |
| 10 | Steuerpult | Reiter „Steuerung“ / „Einstellungen“ (`role="tab"`) | `Tabs` → `setTab`; gemerkt in `localStorage` `titler.operator.tab` (Nr. 98) | imm. | `views/OperatorView.tsx:320`, Zustand `:222-233`, `ui/Tabs.tsx:25-65` | |
| 11 | Steuerung › Vorlage | 4 Knöpfe „Bauchbinde“, „Banner“, „Ticker“, „Grafik“ (aktiver gefüllt) | `setConfig({ template })` → IPC `titler:setConfig` | S | `views/OperatorView.tsx:325-342` (Handler `:330`) | |
| 12 | Steuerung › Inhalt | Feld „Name“ | `setConfig({ name })` je Tastendruck | S, Vorlage Bauchbinde | `views/OperatorView.tsx:348` | |
| 13 | Steuerung › Inhalt | Feld „Untertitel“ | `setConfig({ subtitle })` je Tastendruck | S, Vorlage Bauchbinde | `views/OperatorView.tsx:349` | |
| 14 | Steuerung › Inhalt | Feld „Banner-Text“ | `setConfig({ bannerText })` | S, Vorlage Banner | `views/OperatorView.tsx:353` | |
| 15 | Steuerung › Inhalt | Feld „Ticker-Text“ | `setConfig({ tickerText })` | S, Vorlage Ticker | `views/OperatorView.tsx:357` | |
| 16 | Steuerung › Inhalt | Schieber „Ticker-Tempo“ (0,02–0,30, Schritt 0,01, Wert mit 2 Stellen) | `setConfig({ tickerSpeed })` | S, Vorlage Ticker | `views/OperatorView.tsx:358-365` | |
| 17 | Steuerung › Inhalt | Je Slot der aktiven Grafik-Vorlage ein Feld (Label = Ebenenname; Wert `slotText[key]` oder `defaultText`) | `setConfig({ slotText: { …c.slotText, [key]: v } })` | S, Vorlage Grafik, Vorlage gefunden, ≥ 1 Slot | `views/OperatorView.tsx:375-382` | |
| 18 | Steuerung › Inhalt | Text „Diese Vorlage hat keine Textfelder (reines Standbild).“ | – | S, Vorlage Grafik, Vorlage ohne Slots | `views/OperatorView.tsx:370-373` | |
| 19 | Steuerung › Inhalt | Text „Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ importieren oder auswählen.“ | – | S, Vorlage Grafik, `activeGraphicId` leer oder nicht in der Library | `views/OperatorView.tsx:384-387` | |
| 20 | Steuerung › Grafik-Vorlagen | Abschnittskopf (auf/zu, `aria-expanded`) und Beschreibung „Bauchbinden aus dem jm Grafiktool oder als .psd importieren. Textebenen werden zu füllbaren Feldern — Variablen bleiben nutzbar.“ | `Collapsible` → `localStorage` `jm.collapsible.titler.graphics` (Nr. 99) | S; Start zu (`defaultOpen={false}`); Beschreibung nur auf | `views/OperatorView.tsx:392-402`, `ui/Collapsible.tsx:26-34,57-70` | |
| 21 | Steuerung › Grafik-Vorlagen | Ablagefläche „oder .psd / .jmtitler hierher ziehen“ (Drag & Drop) | `onDragOver` preventDefault; `onDrop` → `onDropImport` (`:85-93`): erste Datei, `pathForFile(file)` (webUtils) → `readFile(p)` (IPC `titler:readFile`, `main/index.ts:703-709`, Fehler → null → **still nichts**) → `runImport` → `importFileToTemplate` (`lib/psd-import.ts:181-190`) → Import-Dialog (Nr. 61) | S, auf | `views/OperatorView.tsx:403-414` | |
| 22 | Steuerung › Grafik-Vorlagen | Knopf „Datei importieren…“ | `pickImport` (`:79-82`) → `pickImportFile()` (IPC `titler:pickImportFile`, nativer Dialog Nr. 70; Lesefehler im Main ohne `try`, `main/index.ts:700-701`, Renderer ohne `catch` → keine Anzeige, abgeleitet) → `runImport` → Import-Dialog | S, auf | `views/OperatorView.tsx:408-410` | |
| 23 | Steuerung › Grafik-Vorlagen | Kachel je Vorlage (Vorschaubild oder Schachbrett, Name, Tooltip Name; aktive umrandet) | Klick → `selectTemplate` (`:83-84`) = `setConfig({ template: 'graphic', activeGraphicId, slotText: {} })`. Kachel ist ein `div` mit `onClick`, ohne `tabIndex`/`role` → per Tastatur nicht erreichbar | S, auf, ≥ 1 Vorlage | `views/OperatorView.tsx:415-449` (Handler `:420`) | |
| 24 | Steuerung › Grafik-Vorlagen | „✕“ je Kachel (Tooltip „Vorlage löschen“) | `stopPropagation`, `deleteTemplate` (`:94-97`): `tpl.remove(id)` (IPC `titler:tpl-remove`), bei aktiver Vorlage `setConfig({ activeGraphicId: '' })`; **ohne Rückfrage** | S, auf; nur bei Mauszeiger über der Kachel sichtbar (`opacity-0 group-hover:opacity-100`), per Tab erreichbar, aber unsichtbar | `views/OperatorView.tsx:436-445` | |
| 25 | Steuerung › Grafik-Vorlagen | Text „Noch keine Vorlagen importiert.“ | – | S, auf, 0 Vorlagen | `views/OperatorView.tsx:451` | |
| 26 | Steuerung › Daten / Recall | Abschnittskopf (auf/zu) | `Collapsible` → `localStorage` `jm.collapsible.titler.recall` (Nr. 100) | S; Start offen | `views/OperatorView.tsx:457` | |
| 27 | Steuerung › Daten / Recall | Quellzeile Q1–Q4 (gekürzt, Tooltip voll): „Quelle: Show „…“ · ⟨n⟩ Speaker“, „Quelle: Show vom Master „…““ (R2), „Quelle: Speaker aus einer früheren Show“, „Quelle: eigener Ordner ⟨Pfad⟩“ | – (Anzeige `status.datenQuelle.zeile`, `shared/datenquelle.ts:301-307`, gesetzt `main/index.ts:183-189`) | S, auf, Zeile nicht leer (leer bei Ordner ohne eigenen Ordner und bei früher ohne Einträge) | `views/OperatorView.tsx:459-463` | |
| 28 | Steuerung › Daten / Recall | Stehender Hinweis H1–H7 (Warnfarbe, `role="status"`), Texte wörtlich `shared/datalink-kern.ts:152-169` (R2: H3/H4/H7 auch bei Quelle master, `shared/datenquelle.ts:176`, `:203-206`) | – (Anzeige `status.hinweis.text`; ein Hinweis nach Vorrang H1/H6 > H2/H5 > H4 > H7 > H3, `shared/datalink-kern.ts:178-186`, gewählt `main/index.ts:179-180`) | S, auf, Hinweis gesetzt | `views/OperatorView.tsx:464-471` | |
| 29 | Steuerung › Daten / Recall | Text „Kein Datenordner aktiv. Im Reiter **Einstellungen › DataLink** einen Ordner wählen — oder den Titler über eine **JM Show** mit iveo-Daten öffnen. …“ | – | S, auf, `datenQuelle.ohneOrdner` (Quelle ordner ohne eigenen Ordner, `main/index.ts:187`) | `views/OperatorView.tsx:472-476` | |
| 30 | Steuerung › Daten / Recall | Fehlerzeile „DataLink: ⟨Fehler⟩“ (z. B. „Ordner nicht gefunden“, `main/datalink.ts:137`, sonst Ausnahmetext `:142`) | – (Anzeige `status.dataError`) | S, auf, nicht `ohneOrdner`, Fehler gesetzt | `views/OperatorView.tsx:477-478` | |
| 31 | Steuerung › Daten / Recall | Zähler „Einträge · ⟨k⟩/⟨n⟩“ bzw. „Einträge · ⟨n⟩“ | – (`zaehlerText`, `lib/datalink-anzeige.ts:10-12`) | S, auf, kein `ohneOrdner`, kein Fehler, ≥ 1 Eintrag | `views/OperatorView.tsx:485-487` | |
| 32 | Steuerung › Daten / Recall | Knopf „⧉ Board“ (Tooltip „Recall-Button-Board in eigenem Fenster öffnen (#152)“) | `openRecall()` (IPC `titler:openRecall`, `main/index.ts:685` → `createRecallWindow` `:518-553`; vorhandenes Fenster wird nur fokussiert) | wie Nr. 31 | `views/OperatorView.tsx:489-497` | |
| 33 | Steuerung › Daten / Recall | Knopf „‹“ (Tooltip „Vorheriger Eintrag“) | `stepEntry(-1)` (IPC `titler:stepEntry`, `main/index.ts:680`) | wie Nr. 31; gesperrt bei aktivem erstem Eintrag (`navGesperrt`, `lib/datalink-anzeige.ts:18-22`); ohne aktiven Eintrag frei | `views/OperatorView.tsx:498-507` | |
| 34 | Steuerung › Daten / Recall | Knopf „›“ (Tooltip „Nächster Eintrag“) | `stepEntry(1)` | wie Nr. 31; gesperrt bei aktivem letztem Eintrag | `views/OperatorView.tsx:508-517` | |
| 35 | Steuerung › Daten / Recall | Eintragsliste (Nr. + Label oder „—“, aktiver hervorgehoben, `max-h-40` mit Bildlauf) | Klick → `recallSchluessel(e.key)` (IPC `titler:recallSchluessel`, `main/index.ts:677-679`, nur String) | wie Nr. 31 | `views/OperatorView.tsx:520-536` (Handler `:524`) | |
| 36 | Steuerung › Daten / Recall | Variablen des aktiven Eintrags `{{k}}` = Wert (oder „—“) bzw. Hilfetext „Keine Variablen gefunden. Lege im Ordner z. B. eine gaeste.csv …“; Zeile „Quelle: ⟨Dateien⟩“ | – (Anzeige `status.variables`, `status.dataSources`) | S, auf, nicht `ohneOrdner`, kein Fehler (auch bei 0 Einträgen) | `views/OperatorView.tsx:541-560` | |
| 37 | Steuerung › Daten / Recall | „Im Text verwendet:“ mit `{{k}}`, grün = vorhanden, rot = fehlt (Tooltip „Variable vorhanden“ / „Variable nicht gefunden“) | – (berechnet aus `name`, `subtitle`, `bannerText`, `tickerText`, **nicht** aus `slotText`, `:133-139`; Vergleich nur `toLowerCase`, ohne NFC, `:128-132`, `:570-572`) | S, auf, ≥ 1 Platzhalter in diesen vier Feldern (auch bei `ohneOrdner`/Fehler) | `views/OperatorView.tsx:563-578` | |
| 38 | Steuerung › Stil | Abschnittskopf (auf/zu) | `Collapsible` → `localStorage` `jm.collapsible.titler.style` (Nr. 101) | S; Start zu | `views/OperatorView.tsx:582` | |
| 39 | Steuerung › Stil | Knöpfe „Unten“ / „Oben“ | `setConfig({ position })` | S, auf | `views/OperatorView.tsx:583-598` (Handler `:587`) | |
| 40 | Steuerung › Stil | Schieber „Größe“ (0,6–1,6, Schritt 0,05, Wert mit 2 Stellen) | `setConfig({ scale })` | S, auf | `views/OperatorView.tsx:599` | |
| 41 | Steuerung › Stil | Farbwähler „Balken“, „Text“, „Akzent“ (mit Hex-Anzeige) | `setConfig({ colors: { bar } })` bzw. `{ text }`, `{ accent }`; Main merged tief (`main/config.ts:55`) | S, auf | `views/OperatorView.tsx:600-604`, `ColorField` `:822-845` | |
| 42 | Einstellungen › DataLink | Abschnitt mit Beschreibung „Platzhalter {{name}} in den Textfeldern werden aus den Dateien im Ordner gefüllt. … im Reiter **Steuerung** abrufbar …“ | – | E | `views/OperatorView.tsx:610-619` | |
| 43 | Einstellungen › DataLink | Textfeld Ordnerpfad (Platzhalter „Kein Ordner gewählt“) (R2: `disabled` bei `ordnerGesperrt`) | `setConfig({ dataFolder })` **je Tastendruck**; im Main zählt jede Änderung als Ordnerwahl (`main/index.ts:659` → `eigenerOrdnerGilt('ordnerGewaehlt')`, löscht die gemerkte Show, `shared/datenquelle.ts:179-188`); R2/E22: Main verwirft einen geänderten `dataFolder` bei Quelle master (`main/index.ts:650-656`, Warnung nur im Log `:361-365`) | E; gesperrt bei Quelle master | `views/OperatorView.tsx:621-628` | |
| 44 | Einstellungen › DataLink | Knopf „Durchsuchen…“ (R2: `disabled` bei `ordnerGesperrt`) | `pickFolder` (`:207-210`) → `pickDataFolder()` (IPC `titler:pickDataFolder`, nativer Dialog Nr. 69) → `setConfig({ dataFolder })`; R2: Main antwortet bei Sperre `''` wie „abgebrochen“ (`main/index.ts:666`) | E; gesperrt bei Quelle master | `views/OperatorView.tsx:629-631` | |
| 45 | Einstellungen › DataLink | Knopf „✕“ (Tooltip „Watchfolder entfernen“) (R2: ausgeblendet bei `ordnerGesperrt`) | `setConfig({ dataFolder: '' })` | E, Ordner eingetragen, nicht Quelle master | `views/OperatorView.tsx:632-636` | |
| 46 | Einstellungen › DataLink | Text „Im Verbund kommen die Speaker vom Master „⟨Name⟩“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.“ (R2) | – (Anzeige `datenQuelle.ordnerGesperrt`, Text `shared/datenquelle.ts:323-326`) | E, Quelle master | `views/OperatorView.tsx:638-640` | |
| 47 | Einstellungen › DataLink | Knopf K1 „Zurück zum eigenen Ordner (⟨Ordnername⟩)“ | `zurueckZumEigenenOrdner()` (IPC `titler:zurueckZumOrdner`; R2/E22: Main lehnt bei Sperre ab, `main/index.ts:682-684`) | E, nur Quelle show und eigener Ordner (`shared/datenquelle.ts:313-317`) | `views/OperatorView.tsx:642-652` | |
| 48 | Einstellungen › DataLink | Fehlerzeile „DataLink: ⟨Fehler⟩“ | – (Anzeige `status.dataError`) | E, Fehler gesetzt | `views/OperatorView.tsx:653-655` | |
| 49 | Einstellungen › iveo | Kasten „iveo aktiv“ + „⟨n⟩ Speaker aus der geöffneten JM Show im DataLink. Aktualisiert sich live nach iveo-Änderungen (verwaltet vom Launcher). Abruf im Reiter **Steuerung › Daten / Recall**.“ bzw. Erklärtext „Kein iveo-Event aktiv. …“ (R2: „aktiv“ auch bei Quelle master) | – (Anzeige; `iveoActive = art show oder master`, `:243`; ⟨n⟩ = `entries.length`) | E | `views/OperatorView.tsx:659-680` | |
| 50 | Einstellungen › Ausgabe (NDI) | Feld „Quellname“ | `setConfig({ ndiName })` je Tastendruck (wirkt beim nächsten NDI-Start) | E | `views/OperatorView.tsx:684` | |
| 51 | Einstellungen › Ausgabe (NDI) | Auswahl „Auflösung“ (1920×1080, 1280×720) | `setConfig({ width, height })` | E | `views/OperatorView.tsx:686-701` | |
| 52 | Einstellungen › Ausgabe (NDI) | Auswahl „fps“ (25, 30, 50, 60) | `setConfig({ fps })` | E | `views/OperatorView.tsx:702-714` | |
| 53 | Einstellungen › Ausgabe (NDI) | Knopf „NDI starten“ / „NDI stoppen“ | Store `startNdi(c.ndiName)` → IPC `titler:ndi-start` (`main/index.ts:710` → `:629-638`), danach lokal `ndiActive: true` (`store/titler.ts:54-58`); `stopNdi` → IPC `titler:ndi-stop` (`main/index.ts:711` → `:640-645`), lokal `ndiActive: false, connections: 0` (`store/titler.ts:59-63`) | E; „starten“ bei NDI aus, „stoppen“ bei NDI an | `views/OperatorView.tsx:716-724` | |
| 54 | Einstellungen › Ausgabe (NDI) | Warnung „Auflösung sollte gerade sein.“ | – | E, Breite oder Höhe ungerade (mit den zwei Auswahlwerten nicht erreichbar; nur über eine von Hand geänderte Config denkbar, nicht gemessen) | `views/OperatorView.tsx:725-727` | |
| 55 | Einstellungen › Ausgabe (2. Bildschirm) | Abschnitt mit Beschreibung „Zeigt die Bauchbinde als Vollbild auf einem zweiten Monitor mit Chroma-Green-Hintergrund — für externe Keyer (vMix/ATEM/TriCaster) ohne NDI.“ | – | E | `views/OperatorView.tsx:731-734` | |
| 56 | Einstellungen › Ausgabe (2. Bildschirm) | Auswahl „Monitor“ („Primär (automatisch)“ + je Monitor „⟨B×H⟩ · intern · primär“) | `setConfig({ secondScreenDisplay })`; Liste aus `listDisplays()` (IPC `titler:listDisplays`, `main/index.ts:686`, Label `:126-142`), neu bei `onDisplaysChanged` (Nr. 81) | E | `views/OperatorView.tsx:735-748` | |
| 57 | Einstellungen › Ausgabe (2. Bildschirm) | Farbwähler „Chroma“ (mit Hex-Anzeige) | `setConfig({ chromaColor })` | E | `views/OperatorView.tsx:750` | |
| 58 | Einstellungen › Ausgabe (2. Bildschirm) | Knopf „Reset“ (Tooltip „Standard-Green (#00B140) zurücksetzen“) | `setConfig({ chromaColor: '#00B140' })` | E | `views/OperatorView.tsx:751-757` | |
| 59 | Einstellungen › Ausgabe (2. Bildschirm) | Knopf „2. Bildschirm einschalten“ / „2. Bildschirm ausschalten“ | `setConfig({ secondScreenEnabled })` → Main öffnet/schließt/versetzt das Ausgabefenster (`reconcileOutputWindow`, `main/index.ts:611-627`, aufgerufen `:662`) | E | `views/OperatorView.tsx:759-767` | |
| 60 | Einstellungen › Ausgabe (2. Bildschirm) | Text „Tipp: Zweitmonitor wählen, damit die Ausgabe nicht die Operator-Oberfläche verdeckt.“ | – | E | `views/OperatorView.tsx:768-770` | |

## 2 · Dialoge und Meldungen

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 61 | Import-Dialog (Modal, `z-50`) | Dialog „Bauchbinde importieren“; Kopf „⟨B⟩×⟨H⟩ · ⟨n⟩ Textfeld(er)“ | geöffnet, wenn `importParsed` gesetzt ist (Nr. 21, 22) | nach erfolgreichem Parsen einer .psd/.jmtitler | `views/OperatorView.tsx:778-787`, `views/ImportDialog.tsx:68-153`, Kopf `:74-78` | |
| 62 | Import-Dialog | Klick auf den abgedunkelten Hintergrund | `onCancel` → `setImportParsed(null)`; Klick im Dialog: `stopPropagation` (`:72`). **Auch während des Speicherns aktiv**; das Speichern läuft dann weiter und wählt die Vorlage danach (`onSaved`, abgeleitet) | Dialog offen | `views/ImportDialog.tsx:69` | |
| 63 | Import-Dialog | Knopf „✕“ (Tooltip „Abbrechen“) | `onCancel`; während des Speicherns **nicht** gesperrt | Dialog offen | `views/ImportDialog.tsx:79-85` | |
| 64 | Import-Dialog | Live-Vorschau (Canvas in Vorlagengröße, Platzhalter wörtlich) | `drawCg` im Effekt bei Änderung von Name/Slot-Texten | Dialog offen | `views/ImportDialog.tsx:89-96`, Effekt `:37-44` | |
| 65 | Import-Dialog | Feld „Name der Vorlage“ | `setName` (lokal) | Dialog offen | `views/ImportDialog.tsx:98-105` | |
| 66 | Import-Dialog | Überschrift „Textfelder → Variablen“, Erklärtext „Platzhalter wie {{name}} werden später aus DataLink gefüllt. Feste Texte bleiben stehen.“, je Slot ein Feld (Label + Schlüssel), vorbelegt aus Auto-Mapping (`{{name}}`, `{{subtitle}}`, `{{location}}`, `lib/psd-import.ts:25-36`); bzw. Text „Keine Textebenen gefunden — die Vorlage wird als reines Standbild importiert.“ | `setOverrides` (lokal) | Dialog offen; Text bei 0 Slots | `views/ImportDialog.tsx:107-135` | |
| 67 | Import-Dialog | Knopf „Abbrechen“ | `onCancel` | Dialog offen; gesperrt während des Speicherns | `views/ImportDialog.tsx:139-141` | |
| 68 | Import-Dialog | Knopf „In Library speichern“ / „Speichere…“ | `save` (`:46-66`): PNG + Vorschaubild kodieren, `tpl.add` (IPC `titler:tpl-add`, `main/library.ts:73-91`), dann `onSaved` → Dialog zu + `selectTemplate` (Nr. 23). `try/finally` **ohne catch**: Fehler werden nicht angezeigt, der Dialog bleibt offen | Dialog offen; gesperrt während des Speicherns | `views/ImportDialog.tsx:142-149` | |
| 69 | Nativer Dialog (Main) | „DataLink-Ordner wählen“ (Ordner, Startpfad = eingetragener Ordner) | ausgelöst von Nr. 44 über `titler:pickDataFolder` | kommt bei Quelle master nicht (R2) | `main/index.ts:665-673` | |
| 70 | Nativer Dialog (Main) | „Bauchbinde importieren“ (Datei; Filter „Titler-Import“ psd/jmtitler, „Photoshop“, „JM Titler-Vorlage“, „Alle Dateien“) | ausgelöst von Nr. 22 über `titler:pickImportFile` | immer | `main/index.ts:689-702` | |
| 71 | Meldung `window.alert` | „Import fehlgeschlagen: ⟨Fehler⟩“ (z. B. „Nicht unterstütztes Format — bitte .psd oder .jmtitler wählen.“, `lib/psd-import.ts:189`; „Ungültiges .jmtitler-Bündel …“, `:160`) | `runImport`-catch | nach Nr. 21/22 bei Parse-Fehler | `views/OperatorView.tsx:71-78` | |
| 72 | Meldung `window.alert` | „Show-Vorlage konnte nicht importiert werden: ⟨Fehler⟩“ | catch im Show-Vorlagen-Import (Nr. 79) | nach Show-Deep-Link mit Vorlage | `views/OperatorView.tsx:119-122` | |

Nicht vorhanden (grep über `apps/titler/src`): kein `confirm(`, kein `prompt(`, kein Kontextmenü
(`contextmenu`/`onContextMenu`), kein Doppelklick-Handler, außer Nr. 21 kein Drag-Handler.

## 3 · Abläufe ohne eigenes Bedienelement (im Renderer)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 73 | Fernsteuerung (Companion, Port 8726) | Befehle `take`, `clear`, `toggle` | `remote.onCommand` (IPC `titler:remote-cmd`, gesendet `main/control-server.ts:127-128`) → `take()` / `clear()` / je nach `liveRef` | Hauptfenster geladen | `views/OperatorView.tsx:146-158` | |
| 74 | Fernsteuerung | Befehl `template ⟨kind⟩` | `setConfig({ template })` | wie Nr. 73 | `views/OperatorView.tsx:159-161` | |
| 75 | Fernsteuerung | Befehl `text ⟨name⟩ ⟨untertitel⟩` (`_` = Leerzeichen, `-` = leer, `main/control-server.ts:36-39`) | bei Vorlage Grafik mit gefundener Vorlage auf Slot 1/2, sonst `name`/`subtitle` | wie Nr. 73 | `views/OperatorView.tsx:162-179` | |
| 76 | Fernsteuerung | Befehl `graphic ⟨id/nr/name⟩` | Suche ID → Nr. → Name → Teilname, dann wie Nr. 23; ohne Treffer nichts | wie Nr. 73 | `views/OperatorView.tsx:180-191` | |
| 77 | Fernsteuerung | Befehl `slot ⟨key⟩ ⟨text⟩` | `slotText[key] = text` | wie Nr. 73 | `views/OperatorView.tsx:192-197` | |
| 78 | Fernsteuerung (im Main, zur Abgrenzung) | Befehle `recall ⟨ref⟩`, `next`, `prev`, `reload` | im Main erledigt, kein Renderer-Push (`main/index.ts:786-804`); R2: `reload` im Verbundmodus ignoriert (`main/index.ts:329-334`); ohne verbundene Show nur Log-Warnung (`:335-343`) | Steuerserver läuft | `main/control-server.ts:92-101` | |
| 79 | Show-Integration (C3) | Bauchbinden-Vorlage aus einer .jmshow automatisch importieren und als aktive Grafik vorbereiten (nicht on air) | `onFileOpened` (IPC `titler:file-opened`, `main/index.ts:445-453`) → `importFileToTemplate` → `tpl.add` → `setConfig({ template: 'graphic', activeGraphicId, slotText: {} })`; R2: im Verbundmodus liefert ein Show-Deep-Link nur noch diese Vorlage (`main/index.ts:317-322`); Lesefehler der Show nur im Log (`:429`, `:441`) | nach Show-Deep-Link | `views/OperatorView.tsx:99-124` | |
| 80 | Tally / On-Air | Live-Zustand an Main melden | Effekt → `remote.reportState({ onAir, template, ndiActive, connections })` (IPC `titler:report-state`; Main: Companion-STATE `on_air`, `setzeAufSendung`, On-Air an Ausgabefenster, `main/index.ts:719-725`) | bei jeder Änderung | `views/OperatorView.tsx:202-205` | |
| 81 | Monitore | Monitorliste laden und bei Hot-Plug neu laden | `listDisplays()`, `onDisplaysChanged` (IPC `titler:displays-changed`, `main/index.ts:764-772`) | Hauptfenster | `views/OperatorView.tsx:212-218` | |
| 82 | Store (alle Fenster) | Erstladen und Abos | `load` (`store/titler.ts:29-49`): `onStatus` (`titler:status`), `onConfig` (`titler:config`), `onOnAir` (`titler:onair`), `onTplChanged` → `tpl.list` (`titler:tpl-changed`, `titler:tpl-list`), dann `getState` + `tpl.list`; aufgerufen in `App.tsx:8-11` | jedes Fenster | `store/titler.ts:29-49` | |
| 83 | Engine | Frame-Port für NDI empfangen; Vorlagen-Hintergrund nachladen; Cache bei Library-Änderung verwerfen; NDI-Frames auf `fps` gedrosselt senden; Fehler eines Takts werden verschluckt | `window` `message` `jmtitler:frame-port` (`lib/engine.ts:62-71`, Preload `preload/index.ts:20-22`); `tpl.readBg` (IPC `titler:tpl-read-bg`, `:115-141`); `onTplChanged` (`:74-80`); `port.postMessage` (`:155-171`); `try/catch` je Takt (`:176-182`) | Hauptfenster (NDI nur mit Port) und Ausgabefenster (ohne NDI) | `lib/engine.ts:25-189` | |
| 84 | Ansichtswahl | `?view=recall` → Recall-Board, `?view=output` → Ausgabe, sonst Operator | URL-Parameter | Fensterstart | `App.tsx:15-18` | |

## 4 · Recall-Board (`?view=recall`, eigenes Fenster „JM Titler · Recall-Board“, bleibt ohne AppShell)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 85 | Board › Kopf | Logo, „RECALL-BOARD“, „⟨n⟩ Einträge“ | – | immer (auch vor dem Laden, dann „0 Einträge“) | `views/RecallBoard.tsx:31-36` | |
| 86 | Board › Kopf | Suchfeld „Suchen…“ (filtert nach Label, nur im Fenster, nicht gemerkt, kein Löschknopf) | `setQ` (lokal) | immer | `views/RecallBoard.tsx:37-43` | |
| 87 | Board | Hinweisband (nur H1, H5, H6, `role="status"`) | – (`boardHinweis`, `lib/datalink-anzeige.ts:25-28`) | Hinweis H1/H5/H6 gesetzt | `views/RecallBoard.tsx:46-53` | |
| 88 | Board | Karte B1 „Auf Sendung, nicht in der Liste: ⟨Label⟩“ | – (`b1Text`, `lib/datalink-anzeige.ts:31-33`, aus `status.gehalten`) | gehaltener Eintrag | `views/RecallBoard.tsx:55-61` | |
| 89 | Board | Text „Keine Einträge. Wähle im Operator-Fenster einen DataLink-Ordner (oder öffne eine iveo-Show mit Speakern).“ | – | 0 Einträge; auch solange `state` noch nicht geladen ist (kein Ladezustand) | `views/RecallBoard.tsx:63-66` | |
| 90 | Board | Knopf je Eintrag (Raster, aktiver gefüllt, Tooltip Label) | `recallSchluessel(key)` (IPC `titler:recallSchluessel`) | ≥ 1 Eintrag (gefiltert) | `views/RecallBoard.tsx:70-85` | |
| 91 | Board | Text „Kein Eintrag passt zu „⟨q⟩“.“ | – | Suche ohne Treffer | `views/RecallBoard.tsx:87-91` | |

## 5 · Ausgabefenster (`?view=output`, „JM Titler · Ausgabe“, nur Abgrenzung, bleibt unverändert, Spec 5.3)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 92 | Ausgabe | Vollbild-Canvas in Programmauflösung auf Chroma-Farbe, Mauszeiger aus; keine Bedienelemente | `useTitlerEngine(resolved, false, canvasRef, { bg: chromaColor, graphic })`; On-Air-Push `onAir` → `take()`/`clear()` | `secondScreenEnabled`; Fenster rahmenlos, Vollbild (`main/index.ts:561-605`) | `views/OutputView.tsx:19-57` | |

## 6 · Tastatur (Pflichtpunkt Spec 10)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 93 | Tastenkürzel | **Keine eigenen.** Kein `keydown`/`keyup`/`keypress`/`onKey…`/`KeyboardEvent`/`accelerator` in `apps/titler/src` (grep); keine in den genutzten `@jm/ui`-Bausteinen (`Button`, `Tabs`, `Collapsible`, `SettingsSection`, `Logo`, grep). **Aktiv ist aber das Electron-Standardmenü** (Nr. 97; Kürzel abgeleitet aus den Menü-Rollen von Electron, nicht gemessen): Strg+R und Strg+Umschalt+R (neu laden), Strg+Umschalt+I (Entwicklerwerkzeuge), Strg+0, Strg+Plus und Strg+Minus (Zoom), F11 (Vollbild), Strg+M (minimieren), Strg+W (Fenster schließen), Alt (Menüleiste); dazu die Bearbeiten-Kürzel Strg+Z, Strg+Y, Strg+X, Strg+C, Strg+V und Strg+A | Rollen des Electron-Standardmenüs | alle drei Fenster | – | |
| 94 | Tastatur nativ | Tab-Fokus; Leertaste/Enter lösen den fokussierten Knopf aus (Browser-Standard); Pfeiltasten in Auswahl und Schieber. Reiter ohne Pfeiltasten-Wechsel (`ui/Tabs.tsx` ohne Tastenhandler). Vorlagen-Kacheln (Nr. 23) nicht erreichbar, „✕“ (Nr. 24) erreichbar, aber unsichtbar | Browser | überall | – | |
| 95 | Tastatur im Import-Dialog | **Escape schließt den Import-Dialog nicht** (kein Handler); kein Fokusfang | – | Dialog offen | `views/ImportDialog.tsx` (kein Handler) | |
| 96 | Pflichtpunkt Panel | Leertaste/Escape mit Fokus im Panel. **Heute:** kein Panel (Einstellungen sind ein Reiter); ein Feld behält die Taste (Browser); auf Knopf/Schalter wirkt die Taste nativ; Escape hat keine Wirkung (kein Handler im Titler). **Mit `SettingsPanel` (abgeleitet aus `ui/SettingsPanel.tsx:31-62`, nicht gemessen):** Feld (Text, Zahl, Bereich, Auswahl) behält jede Taste; auf Knopf/Schalter geht die Leertaste weiter ans Tool, der Titler hat keinen Tastenhandler, also löst der Knopf/Schalter nativ aus; Escape schließt das Panel (nur wenn nicht `defaultPrevented`) und erreicht den Titler nicht | – | – | Reiter „Einstellungen“ (`views/OperatorView.tsx:607-773`) | |
| 97 | Menü / globale Kürzel | Kein `Menu`/`setApplicationMenu`/`globalShortcut`/`before-input-event` in `apps/titler/src`, `packages/app-runtime/src`, `packages/ui/src` (grep); alle drei Fenster mit `autoHideMenuBar: true` (die Leiste erscheint erst nach Alt). Setzt eine App kein Menü, legt Electron das Standardmenü an (`node_modules/electron/electron.d.ts:8673`, Electron 33.4.11: „The default menu will be created automatically if the app does not set one“); seine Kürzel stehen unter Nr. 93. Wirkung im Titler **aus dem Code abgeleitet, gemessen wird sie in Abnahme 5c** (auf einer Testquelle ohne echte Sendung): Strg+R im Bedienfenster lädt den Renderer neu, `live` beginnt wieder mit `false`, `reportState` meldet „nicht auf Sendung“, das Ausgabefenster blendet aus und das Halten im DataLink endet (`main/index.ts:719-724`) | – | – | `main/index.ts:484`, `:533`, `:577` | |

## 7 · Gemerkte Zustände (localStorage, sonstige Ablage)

| Nr. | Bereich | Element | Handler/IPC | Zustand (sichtbar/aktiv) | heute wo | künftig wo |
|---|---|---|---|---|---|---|
| 98 | localStorage | `titler.operator.tab` (`steuerung`/`einstellungen`): lesen beim Start **ohne try/catch** (`:224`), schreiben bei Wechsel mit try/catch (`:228-232`) | `useState`-Initialisierer + Effekt | Hauptfenster | `views/OperatorView.tsx:222-233` | |
| 99 | localStorage | `jm.collapsible.titler.graphics` (`1`/`0`) | `Collapsible persistId="titler.graphics"` (lesen/schreiben mit try/catch) | Hauptfenster | `views/OperatorView.tsx:394`, `ui/Collapsible.tsx:26-34,57-64` | |
| 100 | localStorage | `jm.collapsible.titler.recall` | `persistId="titler.recall"` | Hauptfenster | `views/OperatorView.tsx:457` | |
| 101 | localStorage | `jm.collapsible.titler.style` | `persistId="titler.style"` | Hauptfenster | `views/OperatorView.tsx:582` | |
| 102 | sonst | Kein `sessionStorage`, kein IndexedDB im Renderer (grep). Recall-Board-Suche nicht gemerkt. Hell/Dunkel: **fest dunkel** (`<html class="dark">`), kein Umschalter, nichts gemerkt | – | – | `renderer/index.html:2` | |
| 103 | Main-Ablage (zur Einordnung) | `<userData>/titler-config.json` (alle `setConfig`-Felder, Nr. 11–17, 39–59); Vorlagen-Library `<userData>/templates` (`index.json`, `<id>.png`, `<id>.thumb.png`); gemerkte Show `<userData>/show-zuletzt.json`; Speaker `<userData>/iveo-data/speakers.tsv`; R2: `<userData>/verbund/master-stand.json` (app-runtime) | – | – | `main/config.ts:7-9`, `main/library.ts:21-32`, `main/show-quelle.ts:21`, `main/iveo-show.ts:23-25`, `app-runtime/verbund-speicher.ts:26-29` | |

## 8 · IPC-Übersicht `window.jmtitler` (Preload `preload/index.ts`)

| Methode | Kanal | Aufrufer im Renderer | R2 |
|---|---|---|---|
| `getState` | `titler:getState` | `store/titler.ts:47` | |
| `setConfig` | `titler:setConfig` | `store/titler.ts:51` (alle `setConfig`-Aufrufe der Ansichten) | Main-Seite geändert (E22, `main/index.ts:649-664`) |
| `pickDataFolder` | `titler:pickDataFolder` | `views/OperatorView.tsx:208` | Main-Seite geändert (E22, `main/index.ts:666`) |
| `recallEntry` | `titler:recall` | **im Renderer ungenutzt** | |
| `recallSchluessel` | `titler:recallSchluessel` | `views/OperatorView.tsx:524`, `views/RecallBoard.tsx:73` | |
| `stepEntry` | `titler:stepEntry` | `views/OperatorView.tsx:503`, `:513` | |
| `zurueckZumEigenenOrdner` | `titler:zurueckZumOrdner` | `views/OperatorView.tsx:648` | Main-Seite geändert (E22, `main/index.ts:682-684`) |
| `openRecall` | `titler:openRecall` | `views/OperatorView.tsx:493` | |
| `listDisplays` / `onDisplaysChanged` | `titler:listDisplays` / `titler:displays-changed` | `views/OperatorView.tsx:215`, `:217` | |
| `onStatus` / `onConfig` / `onOnAir` | `titler:status` / `titler:config` / `titler:onair` | `store/titler.ts:32`, `:38`, `:43` | |
| `ndi.start` / `ndi.stop` | `titler:ndi-start` / `titler:ndi-stop` | `store/titler.ts:55`, `:60` | |
| `ndi.status` | `titler:ndi-status` | **im Renderer ungenutzt** | |
| `remote.onCommand` / `remote.reportState` | `titler:remote-cmd` / `titler:report-state` | `views/OperatorView.tsx:147`, `:204` | |
| `tpl.list` / `tpl.add` / `tpl.remove` / `tpl.readBg` | `titler:tpl-list` / `-add` / `-remove` / `-read-bg` | `store/titler.ts:45`, `:47`; `views/ImportDialog.tsx:54`, `views/OperatorView.tsx:110`; `views/OperatorView.tsx:95`; `lib/engine.ts:123-124` | |
| `onTplChanged` | `titler:tpl-changed` | `store/titler.ts:45`, `lib/engine.ts:75` | |
| `onFileOpened` | `titler:file-opened` | `views/OperatorView.tsx:103` | |
| `pickImportFile` / `readFile` / `pathForFile` | `titler:pickImportFile` / `titler:readFile` / `webUtils.getPathForFile` | `views/OperatorView.tsx:80`, `:90`, `:89` | |
| `verbundAnzeige` / `onVerbundAnzeige` | `jmps:verbund-anzeige` (invoke + Ereignis, Handler in `@jm/app-runtime`) | `views/OperatorView.tsx:896`, `:897` | **R2 neu** |
| `platform` | – | **im Renderer ungenutzt** | |
| (Frame-Port) | `jmtitler:frame-port` per `window.postMessage` | `lib/engine.ts:62-71` | |

## 9 · Einstellungen nach Spec 6 / Anhang A (Zuordnung der Ist-Elemente)

| Abschnitt (Anhang A) | Ist-Elemente | Bemerkung (belegt) |
|---|---|---|
| NDI-Ausgabe | Nr. 50 Quellname, 51 Auflösung, 52 fps, 53 Start/Stopp, 54 Warnung | Start/Stopp liegt heute im Reiter „Einstellungen“; Hinweiszeile Nr. 9 verweist mit „NDI rechts starten“ dorthin |
| Ausgabe auf Bildschirm | Nr. 55 Beschreibung, 56 Monitor, 57 Chroma, 58 Reset, 59 an/aus, 60 Tipp | |
| Fernsteuerung | heute **keine UI**; nur Pill Nr. 4 | Port 8726 fest (`main/control-server.ts:27`); Port steht nicht in `TitlerStatus` (`shared/types.ts:154-180`); Startfehler und mDNS-Fehler nur im Log (`main/index.ts:806-810`, `main/control-server.ts:132-133`) |
| iveo | Nr. 49 | R2: „aktiv“ auch bei Quelle master; Text bleibt „aus der geöffneten JM Show … (verwaltet vom Launcher)“ |
| DataLink | Nr. 42–48; Anzeige Nr. 27–37 liegt in „Daten / Recall“ (Bedienung) | R2: Sperre bei Quelle master (Nr. 43–46) |
| Tool-eigen: Stil | Nr. 38–41 | |
| Tool-eigen: Grafik-Vorlagen-Import | Nr. 20–25, Dialog Nr. 61–68, 70, 71 | Nr. 79 (Show-Vorlage) importiert ohne Dialog |
| Bedienung (keine Einstellung) | Vorlage Nr. 11, Inhalt Nr. 12–19, Recall Nr. 31–35 | Ticker-Tempo (Nr. 16) liegt heute unter „Inhalt“ |

## 10 · Befunde für den Umbau (belegt, ohne Wertung als Fehler)

1. **Recall-Board und Operator zeigen nicht dieselben Hinweise:** Operator zeigt H1–H7 (Nr. 28), aber keine Karte B1;
   das Board zeigt nur H1/H5/H6 (Nr. 87) und B1 (Nr. 88). Anhang A sagt „Das Recall-Board zeigt dieselben Hinweise“.
2. **NDI-Pill nicht gemessen (Spec 7 „nur Gemessenes“):** `status.ndiActive` wird direkt nach dem Fork gesetzt
   (`main/index.ts:635`), ohne Rückmeldung des Senders; scheitert `ndi.init`/`createSender`, steht nur `console.error` im
   Utility-Prozess (`utility/ndi-sender.ts:28-31`), die Pill zeigt dann „NDI · 0 Empfänger“. Die Empfängerzahl kommt nur
   alle 30 gesendeten Frames (`:41-44`). Ein Ende des Utility-Prozesses meldet niemand: `sender-process.ts` hört nur auf
   `message` (`main/ndi/sender-process.ts:26-31`). `ndi.status` (`senderActive`) nutzt der Renderer nicht.
3. **Suite-Pill:** „Suite getrennt“ steht bei 0 Clients und ebenso, wenn der Steuerserver nicht startet (nur Log,
   `main/index.ts:806-810`); unbekannt und getrennt sind nicht unterscheidbar (Spec 7: unbekannt ≠ ok).
4. **Take/Clear haben keinen gesperrten Zustand** und `live` springt beim Klick sofort um (`lib/engine.ts:56`), nicht
   erst nach der Einblendung (450 ms, `:15`).
5. **DataLink-Textfeld schreibt je Tastendruck**; jeder Tastendruck ist im Main eine Ordnerwahl (`main/index.ts:659`,
   löscht die gemerkte Show, `shared/datenquelle.ts:179-188`).
6. **Vorlage löschen ohne Rückfrage**, „✕“ nur bei Mauszeiger sichtbar (Nr. 24); Kacheln selbst per Tastatur nicht
   wählbar (Nr. 23, `div` mit `onClick`).
7. **Import-Dialog:** kein Escape (Nr. 95); Speicherfehler ohne Anzeige (Nr. 68); Hintergrund und „✕“ während des
   Speicherns aktiv (Nr. 62, 63); Lesefehler bei „Datei importieren…“ und beim Ablegen ohne Anzeige (Nr. 21, 22).
8. **„Im Text verwendet“** wertet `slotText` nicht aus und vergleicht ohne NFC (`views/OperatorView.tsx:128-132`,
   `:570-572`), die Auflösung dagegen mit NFC (`shared/vars.ts:14-16`, Titler 0.10.1). Ein zerlegt geschriebener
   Umlaut im Platzhalter würde rot angezeigt, aber aufgelöst (abgeleitet, nicht gemessen).
9. **ASCII-Anführungszeichen in Nutzertexten:** `views/OperatorView.tsx:386` (nach „Grafik-Vorlagen) und
   `views/RecallBoard.tsx:89` (nach „{q}) schließen mit einem ASCII-Zeichen. In dieser Liste sind sie als „ “
   wiedergegeben.
10. **Hell/Dunkel:** fest dunkel (`renderer/index.html:2`), kein Umschalter (Spec 8 bringt das neu). `globals.css`
    wiederholt den Inhalt von `@jm/ui/base.css` und hat rohe Farben nur im Schachbrett `.cg-checker`
    (`globals.css:53-62`); `ImportDialog` nutzt `bg-black/60` (`:69`).
11. **Ungenutzte Preload-Methoden:** `recallEntry`, `ndi.status`, `platform`.
12. **Kein Ablageschutz außerhalb der Ablagefläche:** Drop-Handler nur auf der Fläche (Nr. 21), kein `will-navigate`
    im Titler-Main und in app-runtime (grep). Was ein Drop anderswo bewirkt, ist **nicht gemessen**.
13. **Brücke aus Spec 3.9 (nur Ist):** `jmps:verbund-anzeige` liefert Abfrage + Ereignis an alle Fenster
    (`app-runtime/verbund-ipc.ts:12-33`). Registriert wird sie in jedem Tool mit Master-Link-Client (Standard an,
    `app-runtime/index.ts:627`, `:643-650`), nach `whenReady` und nur mit Single-Instance-Lock
    (`app-runtime/index.ts:387-409` → `verbund.ts:25-44`, `:36`). Geliefert wird die fertige V-Zeile `{ text, farbe }`
    oder `null` am Einzelplatz (`verbund-anzeige.ts:25`). Den rohen Client-Zustand (`aus/sucht/verbindet/verbunden/
    fehler`) gibt es nur im Main (`getMasterLinkStatus()`, `app-runtime/index.ts:414-416`); im Verbund steckt er in
    V9–V11 (`verbund-anzeige.ts:65-67`). Den Kanal nutzen schon drei Preloads: titler, timer, rundown (grep). Für die
    Fernsteuerungs-Meldung hat der Titler `status.suiteClients` (`shared/types.ts:159-160`), aber weder Port noch
    Startergebnis im Status.
14. **Anhang A nennt** `status.datenQuelle.art === 'show'` für iveo; seit R2 gilt „show oder master“ (`:243`).
15. **iveo-Kasten (Nr. 49) bei Quelle master und früher:** bei master steht „aus der geöffneten JM Show … (verwaltet
    vom Launcher)“, die Speaker kommen aber vom Master; bei Quelle früher steht „Kein iveo-Event aktiv“, obwohl die Liste
    Speaker aus einer früheren Show trägt (Q3, Nr. 27). Bei H4/H7 steht „Aktualisiert sich live“. Für eine immer
    sichtbare Statuszeile wäre das je Zustand zu prüfen (Kreuzprodukt).
16. **Texte mit Ortsangaben**, die nach dem Umbau nicht mehr stimmen könnten: Nr. 9 („NDI rechts starten“), Nr. 19
    („unter „Grafik-Vorlagen““), Nr. 29 („Im Reiter Einstellungen › DataLink“), Nr. 42 („im Reiter Steuerung
    abrufbar“), Nr. 49 („Abruf im Reiter Steuerung › Daten / Recall“), Nr. 89 („Wähle im Operator-Fenster …“).
17. **Diagnosen nur im Log** (Spec 7, „jede Diagnose wird angezeigt“): nicht lesbare Datendatei und Nicht-UTF-8-Kodierung
    (`main/datalink.ts:200-212`), Steuerserver-Start (`main/index.ts:806-810`), mDNS (`main/control-server.ts:132-133`),
    NDI-Init (`utility/ndi-sender.ts:28-31`), Show-Vorlage nicht lesbar (`main/index.ts:429`, `:441`), RELOAD ohne Show
    (`:341`), RELOAD/Deep-Link im Verbund ignoriert (`:319`, `:332`), Ordnerwahl abgelehnt (`:363`).
18. **Ladezustände:** Operator bleibt bei scheiterndem `getState` auf „Lädt…“ (Nr. 1, kein `catch`); das Recall-Board
    hat keinen Ladezustand und zeigt vor dem Laden „0 Einträge“ und „Keine Einträge …“ (Nr. 85, 89).
19. **Maße und Fenster:** Hauptfenster 1180×820, mindestens 960×660 (`main/index.ts:475-478`); Steuerpult fest 400 px
    (`views/OperatorView.tsx:318`). Auf macOS `titleBarStyle: 'hiddenInset'` (`main/index.ts:483`), die Kopfzeile hat
    keine Ziehfläche (kein `dragRegion`/`app-region` in `apps/titler/src`, grep). `body` hat `user-select: none`
    (`globals.css:31`): Hinweistexte sind nicht markierbar.
