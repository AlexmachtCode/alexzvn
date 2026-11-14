# JM Connect: Ersatzbild „Zoom-Kachel“ für DSM-Slots (#306) — Entwurf

Stand 2026-11-14 · Größe: Projekt · Weg A (Owner-Wahl 14.11. 17:18) · Release als **Connect 0.4.4**, Owner: Vorrang vor dem Limiter, **darf ohne Testmeeting raus** · #305 ist als Duplikat in #306 aufgegangen

## Anlass und Warum

Redner auf der Bühne brauchen am Downstage-Monitor (DSM) ein verlässliches Zeichen, ob ein Remote-Gast da ist. Zwei Fehlfälle heute:
1. Ein Gast wählt sich spät ein, Kamera aus → der DSM-Slot ist transparent/schwarz, der Redner weiß nicht, dass jemand in der Leitung ist.
2. Ein Gast fliegt raus → bei Ersatzbild „eingefroren“ bleibt das letzte Bild stehen; der Redner glaubt, die Person sei noch da.

## Heute (gemessen am Code, Stand origin/main e5fd1c8343)

- Ersatzbild je Slot: `ZoomSlotErsatzbild = 'transparent' | 'eingefroren' | 'schwarz' | 'weiss'` (`apps/connect/src/shared/types.ts:221`), zur Bridge als `SLOT_FALLBACKS = ['transparent','freeze','black','white']` (`packages/zoom-bridge/src/protocol.ts:68`), in C++ `Fallback`/`ersatzArt()` (`packages/zoom-bridge/native/slot_logic.h:570ff`). **Es gilt gleich für jeden Grund** (cameraOff, noFrames, participantLeft, noTarget …).
- Kamera an, aber Bild bleibt aus: 2 s Schonfrist mit gehaltenem Bild, dann Ersatzbild (seit 0.4.1, `fallback/noFrames`).
- Slot kann direkt nach dem Beitritt einer Person zugewiesen werden; Rückkehr derselben Person (persistentId) hängt sich automatisch wieder an.
- Zoom-SDK: `IUserInfo::GetAvatarPath()` liefert einen **lokalen Dateipfad** zum Profilbild; `onInMeetingUserAvatarPathUpdated(userID)` meldet Änderungen (in `packages/zoom-bridge/native/callbacks.h:151` heute leer). Die Bridge nutzt WIC bereits (JPEG-Vorschau).
- Ersatzbilder entstehen in `NdiSender::sendErsatz` (`ndi_sender.cpp:205ff`) — schwarz/weiß/transparent in fester Bildgröße des Slots.

## Ziele

1. **Neues Ersatzbild „Zoom-Kachel“** (UI-Text) in der Ersatzbild-Auswahl der Slots, zusätzlich zu den bisherigen vier.
2. Verhalten eines Slots mit „Zoom-Kachel“:

| Lage | Bild |
|---|---|
| Person im Meeting, Kamera an, Bilder kommen | Livebild (unverändert) |
| Person im Meeting, Kamera aus (`cameraOff`, auch direkt nach Zuweisung) | **Kachel** |
| Kamera laut Zoom an, Bild bleibt länger als die 2-s-Schonfrist aus (`noFrames`) | **Kachel mit Zusatz „Bild unterbrochen“** |
| Person verlässt das Meeting / fliegt raus (`participantLeft`) | **sofort transparent** — kein gehaltenes Bild, keine Kachel |
| Slot ohne Person (`noTarget`), Person nicht im Meeting / im Warteraum | transparent |
| Person kommt zurück | wie heute automatisch wieder im Slot → Kachel bzw. Livebild |

   Wechsel Kachel ↔ Livebild ohne Zwischenbild (nahtlos), Kamera aus → sofort Kachel (nach den heutigen Schwellen für „Kamera aus“).
3. **Die Kachel** — Vorbild ist die normale Zoom-Kachel, gezeichnet in der Auflösung des Slots (360p/720p/1080p, 16:9), **deckend** (kein Alpha):
   ```
   ┌──────────────────────────────────────────┐
   │                                          │   dunkelgrauer Hintergrund (Zoom-ähnlich, ~#232323)
   │               ╭────────╮                 │
   │               │ Profil │                 │   rundes Profilbild, mittig
   │               │  bild  │                 │   ohne Profilbild: Initialen auf farbigem Kreis
   │               ╰────────╯                 │
   │            Bild unterbrochen             │   nur bei noFrames, dezent
   │ Anna Müller                              │   Zoom-Anzeigename unten links, weiß
   └──────────────────────────────────────────┘
   ```
   - Initialen: erster Buchstabe des ersten und des letzten Worts des Anzeigenamens (ein Wort → ein Buchstabe), groß geschrieben; Kreisfarbe fest aus dem Namen abgeleitet (feste Palette), damit dieselbe Person immer dieselbe Farbe hat.
   - Zu lange Namen werden mit „…“ gekürzt; Umlaute und andere Unicode-Zeichen korrekt.
   - Profilbild: lädt Zoom es erst nach dem Beitritt, zeigt die Kachel bis dahin die Initialen und wechselt von selbst, sobald `onInMeetingUserAvatarPathUpdated` kommt. Ändert die Person ihren Namen im Meeting, wird die Kachel neu gezeichnet.

## Nicht-Ziele

Browser-/Peer-Gäste (Welle 6) — nur Zoom-Slots; Freigabe-Slots (Bildschirmfreigabe) bekommen die Option nicht; eigenes Layout/Branding der Kachel; Ton; Änderung des Verhaltens der vier bestehenden Ersatzbilder; Limiter (kommt später).

## Anti-Ziele

- Ein Slot, der NICHT auf „Zoom-Kachel“ steht, verhält sich anders als heute (mitten in der COP würden Mischer-Eingänge brechen).
- Nach dem Verlassen bleibt bei „Zoom-Kachel“ irgendein Bild stehen (Kachel, gehaltenes Bild).
- Ein kaputtes, fehlendes oder riesiges Profilbild bringt die Bridge zum Absturz oder hält den Slot an (richtig: Initialen).
- Spürbare Mehrlast: die Kachel wird je Zustandswechsel einmal gezeichnet und zwischengespeichert, nicht je Bild.

## Rahmen

- Release **Connect 0.4.4** (Windows, Zoom gibt es nur dort; Mac-Paket inhaltlich unverändert), im COP-Fenster 18–06 Uhr, Patch-Notes zur Owner-Freigabe, Release-Weg wie 0.4.3 (Windows lokal mit Zoom-Bridge + NDI, Mac per CI). **Kein Testmeeting nötig** (Owner); stattdessen: Logik-Tests, Musterkacheln als Bilddateien zur Sichtprüfung durch den Owner, gepackter Rauchtest.
- Bestehende Fallen beachten: Bridge-Logiktests in `scripts/logik-test.mjs` + CMake + `slot-test` (Selbsttest A4); `ShowAblauf`-/Slot-Felder: neuer Ersatzbild-Wert muss beim Laden alter/fremder Einstellungen und `.jmshow`-Dateien sauber durchlaufen (unbekannter Wert → bisheriges Verhalten, kein Absturz); Kochbuch-Texte (`packages/cookbook/content/tool-manuals/tool-jm-connect.md`, `best-practices/panic-sop.md`) nachziehen, `cookbook.json` aus LF bauen.
- Der Limiter-Branch (`feat/connect-ton-limiter`) bleibt unberührt; die Versionsnummer dort wird beim Wiederaufnehmen neu vergeben.

## Ansätze

- **A — Bridge zeichnet die Kachel selbst (gewählt):** Profilbild per `GetAvatarPath`, Laden und Zeichnen mit Windows-Bordmitteln (GDI+ bzw. WIC), Ausgabe über den bestehenden Ersatzbild-Weg. Alles an einer Stelle, sofort da, unabhängig vom Connect-Fenster; die Kachel-Inhalte (Initialen, Farbe, Kürzung, Zustandswahl) sind als reine Logik ohne Zoom testbar. Preis: mehr nativer Code; Aussehen wird über Musterbilder geprüft.
- **B — Connect zeichnet im Fenster, Bridge lädt PNG:** bequemere Gestaltung, aber mehr Stationen und abhängig vom Connect-Fenster — genau im Live-Moment ein Risiko. Verworfen.
- **C — Zoom-eigene Kachel abgreifen:** die Rohdaten-Schnittstelle liefert keine gerenderten Kacheln. Nicht verfügbar.

## Entwurf (entschieden)

- **Datenweg:** Connect-Wert `'kachel'` (UI „Zoom-Kachel“) → Bridge-Fallback `'tile'` (neu in `SLOT_FALLBACKS`, `FALLBACK_NAMEN`, Protokoll-Typen) → neuer gesendeter Zustand `'tile'` in `SLOT_SENT`/`SENT_NAMEN`, damit Statuszeile und Log ehrlich zeigen, was rausgeht. Kurzer Zusatz im Status, ob mit Hinweis „Bild unterbrochen“.
- **Nach Bauenden-Prüfung entschieden (Controller):**
  - *Gründe, die die Tabelle nicht nennt:* Regel „**Person zugeordnet (Ziel ≠ 0) und kein Livebild → Kachel; mit Hinweis ‚Bild unterbrochen‘, wenn die Kamera laut Zoom an ist; sonst transparent**“. Damit: `starting` mit Ziel ≠ 0 vor dem ersten Bild → Kachel (ohne Hinweis, solange Zoom die Kamera nicht als an meldet) — kein Aufblitzen transparent→Kachel bei der Zuweisung, bei Kamera an wechselt es nach dem ersten Bild aufs Livebild; `bufferMismatch` und `subscribeFailed` → Kachel mit Hinweis (Person ist da, Bild kaputt); `speakerNone` → transparent; `shareNone` kommt nicht vor (Freigabe hat die Option nicht); Slot `Off` → wie heute nichts.
  - *Bild-Versatz (Lippensync-Verzögerung):* Die Kachel läuft wie die anderen Ersatzbilder durch die Verzögerungsleitung — neue `Bildart` Kachel mit Verweis auf den unveränderlichen, zwischengespeicherten Kachel-Puffer des Slots (keine Kopie je Bild). So bleiben Kachel und Livebild in der richtigen Reihenfolge; die bestehenden Bildarten ändern sich nicht.
  - *Größe:* dieselbe Größenregel wie die bisherigen Ersatzbilder (Größe des letzten Livebilds, sonst Nennauflösung des Slots) — kein Größenwechsel im Mischer; das Kachel-Layout passt sich dem Seitenverhältnis an; die Größe gehört zum Zwischenspeicher-Schlüssel.
  - *Pixelformat:* deckend wie das Livebild als **I420** (einmal je Zeichnen aus BGRA umgerechnet und zwischengespeichert) — kein I420↔UYVA-Wechsel zwischen Kachel und Livebild.
  - *„Bild unterbrochen“ in Connect:* aus dem schon gemeldeten Grund abgeleitet; im Protokoll nur EIN neuer gesendeter Zustand `'tile'`, kein zweiter Wert.
- **Regel in `slot_logic.h`:** `ersatzArt` bekommt den **Grund** dazu (heute nur Fallback + Kopie): bei `tile` → `participantLeft`/`noTarget`/nicht im Meeting = transparent; `cameraOff`/`speakerNoVideo` = Kachel; `noFrames` = Kachel mit Hinweis. Für die vier bestehenden Fallbacks bleibt das Ergebnis für jeden Grund **bitgleich** wie heute (Test sichert das für alle Kombinationen ab).
- **Modi:** Teilnehmer-Slot und Sprecher-Slot (Kachel der Person, die der Slot gerade zeigen würde). Freigabe-Slot: Option nicht wählbar; kommt der Wert trotzdem an, verhält er sich wie transparent.
- **Kachel-Zeichner** (neue Datei in `packages/zoom-bridge/native/`): rein Eingabe → Bild (Name, Profilbild-Pfad oder leer, Hinweis ja/nein, Breite/Höhe) → BGRA/UYVA-Puffer; Zwischenspeicher je (Person, Name, Profilbild, Hinweis, Auflösung). Die reinen Teile (Initialen, Farbwahl, Kürzung, Layoutmaße) als Kopfdatei mit Logiktest im bestehenden `logik-test`-Muster. Fehler beim Laden des Profilbilds → Initialen, eine Logzeile.
- **SDK-Anbindung:** Profilbild-Pfad und Anzeigename beim Zuweisen/Wechsel der Person lesen; `onInMeetingUserAvatarPathUpdated` und die Namensänderung im Meeting lösen Neuzeichnen aus.
- **Connect:** Auswahl in `SlotEinstellungen.tsx` (nicht bei Freigabe), Texte in `zoom-text.ts` (Statuszeile „Kachel“ / „Kachel (Bild unterbrochen)“), Abbildung in `slots.ts`, Vorschau-Text in `slot-vorschau.ts`, Laden/Prüfen in `einstellungen.ts`.

## Abnahme

1. Logik-Tests: Zustandstabelle oben vollständig (alle Gründe × alle fünf Fallbacks; bestehende vier unverändert), Initialen/Farbe/Kürzung, Laden eines kaputten Profilbilds → Initialen.
2. **Musterkacheln** als Dateien (je 360p/720p/1080p): mit Profilbild, ohne (Initialen), langer Name mit Umlauten, mit „Bild unterbrochen“ → Owner sieht sie vor dem Release an.
3. Connect-Selbsttest und Typprüfung grün (Node 22 + 24), Bridge-Logiktests grün, gepackter Installer startet (Rauchtest), Bridge lädt.
4. Alte Einstellungen/`.jmshow` mit den vier bisherigen Werten laden unverändert.

## Dem Bauenden überlassen

Genaue Maße/Schriftgrößen im Zoom-Stil, Palette, GDI+ oder Direct2D/DirectWrite, Pixelformat des Kachel-Puffers (passend zum Ersatzbild-Weg), Zwischenspeicher-Größe, Form der Musterkachel-Erzeugung (Testprogramm oder Bridge-Befehl).

## Meine Entscheidungen (zur Prüfung)

- Hinweis „Bild unterbrochen“ bei `noFrames` (Owner hat den Vorschlag bestätigt).
- Sprecher-Slot bekommt die Option ebenfalls; Freigabe-Slot nicht.
- Kreisfarbe fest aus dem Namen.
- Abnahme ohne Testmeeting über Musterkacheln + Rauchtest.
