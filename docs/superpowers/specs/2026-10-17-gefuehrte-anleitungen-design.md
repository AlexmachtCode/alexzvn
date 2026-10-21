# Geführte Anleitungen im Tool, erste Anleitung: Einrichtung im Launcher

**Status:** **Vom Owner freigegeben am 17.10.2026** („spec passt“, samt den Vorgaben zu OF1–OF3 und den Entscheidungen nach der Bau-Prüfung). Entstanden im Brainstorming 17.10.2026 ( Owner hat „Form, erste Anleitung, Stimme, Grundgerüst“ mit „passt“ bestätigt). Nach der Bau-Prüfung ergänzt: 3.1 (Zustände, Bedienleiste), Fortsetzen (4), Kapitel je nach Rolle (5), Verhalten während der Produktion (7), jeweils als Entscheidung des Entwurfs.
**Datum:** 17.10.2026
**Basis:** `main` @ `a9553defe7` (Launcher 0.15.0, UX-Fundament `@jm/ui` aus Welle 0, Titler 0.12.0 als Pilot).
**Reihenfolge (Owner 17.10.2026):** iveo-Paket (Launcher 0.16.0) → **diese Anleitung** → Connect 0.4.0 (Zoom-Slots) → Anmeldung im Launcher → UX-Welle 1. Die Spec entsteht jetzt, umgesetzt wird nach dem iveo-Paket; vor dem Plan wird sie gegen den dann aktuellen Stand nachgemessen.

---

## 1 · Warum und für wen

Die Suite soll ohne Support erlernbar sein. Zwei Leser (Owner):
- **Erstbediener** ohne Vorkenntnisse der Tools und der Suite, ohne Support. Er soll die Suite selbst einrichten und die Bedienung lernen.
- **Techniker**, der nachschlagen will. Er sucht gezielt einen Schritt und will direkt dorthin.

Der Owner fragte zuerst nach Erklärvideos. Gewünscht ist aber eine **geführte Anleitung direkt im Tool, wie ein Spiele-Tutorial**, keine Videos zum Anschauen (Owner 17.10.2026).

## 2 · Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Ein Grundgerüst für geführte Anleitungen, das **jedes Tool** nutzen kann.
- Die **erste Anleitung: Einrichtung im Launcher** (Abschnitt 5).
- Anleitungen erscheinen beim ersten Start von selbst, sind überspringbar und jederzeit wieder aufrufbar; Techniker starten einzelne Kapitel gezielt.

**Nicht-Ziele (in dieser Stufe)**
- Keine Videos. Keine Anleitungen für andere Tools als den Launcher; das Grundgerüst muss sie aber ohne Umbau zulassen.
- Keine Stimme aus der Cloud (Owner: „lokal erstmal“); später möglich, ohne das Grundgerüst zu ändern.
- Keine neue Bedienlogik im Launcher. Die Anleitung bedient nichts selbst; sie zeigt, erklärt und wartet.

**Anti-Ziele**
- Eine Anleitung bringt **nie etwas auf Sendung** und löst keine Aktion aus, die der Bediener nicht selbst ausführt (gilt ab jetzt für alle Tools; im Launcher betrifft es z. B. „Tools aus der Show starten“: das tut der Bediener selbst).
- Eine Anleitung zeigt nie auf etwas, das es nicht gibt, und behauptet nie einen erledigten Schritt, der nicht erledigt ist (Lehre „dauerhafte Statuszeile lügt leichter“).
- Eine Änderung der Oberfläche (UX-Wellen) darf eine Anleitung nicht unbemerkt brechen.

## 3 · Form: geführt wie in einem Spiel (Owner-Entscheid)

- Die Anleitung **hebt das Bedienelement hervor**, um das es geht (der Rest der Oberfläche wird abgedunkelt, bleibt aber bedienbar, soweit der Schritt es verlangt).
- Eine **Sprechblase** am Element erklärt in einem bis drei kurzen Sätzen, was zu tun ist und warum.
- Eine **Stimme** spricht den Text (Abschnitt 6); der Text steht immer da.
- Die Anleitung **wartet, bis der Schritt erledigt ist, und erkennt das selbst** (z. B. „mindestens ein Tool installiert“, „Rolle gewählt“, „Show gespeichert“). Dann geht es von selbst weiter.
- Bedienung der Anleitung: **„Zurück“, „Überspringen“ (dieser Schritt), „Später weiter“** (Anleitung pausieren). Dazu ein Zähler „Schritt 3 von 6“.
- **Fortschritt wird gemerkt**, auch über einen Neustart (z. B. nach einer Installation oder einem Launcher-Update). „Später weiter“ setzt beim gemerkten Schritt wieder an.
- Mit Tastatur bedienbar (Tab, Enter, Escape = „Später weiter“); für Screenreader beschriftet.

### 3.1 Zustände eines Kapitels und Bedienleiste (Entscheidung des Entwurfs nach der Bau-Prüfung)

- Ein Kapitel ist **erledigt** (Haken), **nicht gebraucht** (eigenes Zeichen, kein Haken, z. B. „–“ mit Text „nicht gebraucht“), **übersprungen** (bleibt offen, ohne Haken) oder **offen**. Nur „erledigt“ bekommt einen Haken (Anti-Ziel).
- **„Erledigt“** kommt aus einem vorhandenen Zustand des Tools (Abschnitt 5) **oder aus einer ausdrücklichen Entscheidung des Bedieners**, die die Anleitung selbst speichert, wo das Tool keinen unterscheidbaren Zustand hat (z. B. Kapitel 3 „Ich arbeite allein an diesem Rechner“, weil „Aus“ bei jeder Installation voreingestellt ist). Eine Voreinstellung zählt nie als Entscheidung.
- **„Nicht gebraucht“** setzt der Bediener mit dem Knopf **„Brauche ich nicht“** je Kapitel (z. B. kein Companion). Er lässt sich in der Kapitelübersicht wieder zurücknehmen.
- Bedienleiste: **„Zurück“, „Weiter“, „Überspringen“, „Später weiter“** und je Kapitel „Brauche ich nicht“. „Weiter“ gibt es nur bei reinen Erklär-Schritten (z. B. „Das ist der Katalog“) und bei Schritten, die schon erledigt sind; Handlungs-Schritte gehen weiterhin von selbst weiter, sobald sie erkannt sind. Das ergänzt die freigegebene Leiste um „Weiter“ und „Brauche ich nicht“.
- **Schon erledigte Kapitel** zeigt die Anleitung beim ersten Durchlauf kurz mit „Schon erledigt“ und „Weiter“, statt sie stumm zu überspringen (z. B. Kapitel 1 in jedem Release-Bau, weil die Release-Quelle dort schon verbunden ist, `apps/launcher/src/main/settings.ts:33-38`). „Zeig mir“ auf einem erledigten Kapitel läuft im Modus „nur zeigen“ mit „Weiter“.
- **„Zurück“** führt auf den vorigen Schritt im Modus „nur zeigen“ und springt nicht von selbst wieder vor.

## 4 · Wann sie erscheint (Owner-Entscheid)

- **Beim ersten Start des Launchers von selbst, überspringbar** („Anleitung überspringen“ fragt einmal nach und sagt, wo man sie wieder findet).
- **Jederzeit wieder aufrufbar** im Launcher. Ort (Vorschlag des Entwurfs): der heutige Knopf „Erste Schritte“ in der Kopfzeile (`apps/launcher/src/renderer/src/components/Header.tsx:156-157`) öffnet künftig die **Kapitelübersicht** der Anleitung; dazu ein Eintrag im Kochbuch.
- **Für Techniker:** In der Kapitelübersicht steht jeder Schritt als eigenes Kapitel mit Haken, wenn er erledigt ist; jedes Kapitel lässt sich **einzeln starten** („Zeig mir: Rechner koppeln“).
- **Fortsetzen** (Entscheidung des Entwurfs): Nach „Später weiter“ oder einem Beenden mitten im Ablauf springt die Anleitung beim nächsten Start **nicht** von selbst auf; der Knopf „Erste Schritte“ zeigt dann „Einrichtung fortsetzen · Schritt ‹n› von ‹m›“. Von selbst weiter geht es nur, wenn ein Schritt der Anleitung den Neustart selbst verlangt hat (Installation, Launcher-Update). Die Anleitung gilt als **abgeschlossen** (kein automatischer Start mehr), wenn jedes Kapitel erledigt oder nicht gebraucht ist oder der Bediener „Anleitung beenden“ gewählt hat; übersprungene Kapitel bleiben in der Übersicht offen. „Was ist neu?“ nach einem Update erscheint erst nach der Anleitung, nicht gleichzeitig.

**Bestand:** Heute gibt es die Checkliste „Erste Schritte“ (`apps/launcher/src/renderer/src/components/OnboardingModal.tsx`, Onboarding B1, vier Punkte: Release-Quelle, Werkzeuge, Netzwerk & Steuerebene, erste Show aus Vorlage), die sich mit `jmps:onboardedV1` merkt, dass sie gezeigt wurde (`apps/launcher/src/renderer/src/store/tools.ts:143-156`), und die Szenario-Auswahl „Was willst du produzieren?“ (`apps/launcher/src/renderer/src/lib/scenarios.ts`, B2). Die Checkliste sagt ausdrücklich, sie sei „bewusst KEIN Tutorial zum Durchklicken“ (`OnboardingModal.tsx:6-8`). Vorschlag des Entwurfs: Die Checkliste geht in der Kapitelübersicht auf (gleiche Haken, jetzt mit „Zeig mir“), die Szenario-Auswahl bleibt und wird in Schritt 4 benutzt. Wer `jmps:onboardedV1` schon hat (bestehende Rechner), bekommt die Anleitung nicht automatisch, sondern einmal den Hinweis „Neu: geführte Einrichtung“ am Knopf.

## 5 · Erste Anleitung: Einrichtung im Launcher (Owner-Entscheid, Reihenfolge „passt“)

| # | Kapitel | Erledigt, wenn (Erkennung) |
| --- | --- | --- |
| 1 | **Anmelden** | heute: eine Release-Quelle ist verbunden (wie die heutige Checkliste, `settings.source !== 'none'`); nach der Anmeldung im Launcher: angemeldet |
| 2 | **Tools installieren** | mindestens ein Tool installiert (wie heute); die Anleitung erklärt dabei Katalog und Kategorien |
| 3 | **Rolle im Verbund wählen und koppeln** | je nach Rolle, siehe unten (eine Voreinstellung zählt nie) |
| 4 | **Erste Show anlegen und an ein iveo-Event binden** | Show gespeichert; iveo-Bindung optional (überspringbar, wenn kein iveo-Event gebraucht wird); am Rechner mit „Mit Master verbinden“ siehe unten |
| 5 | **Fernsteuerung für Companion einrichten** | je nach Rolle, siehe unten |
| 6 | **Tools aus der Show starten** | ein Tool aus der Show gestartet (der Bediener klickt selbst) |

- **Kapitel je nach Rolle** (Entscheidung des Entwurfs nach der Bau-Prüfung; das Format braucht dafür Bedingungen „gilt nur, wenn“):
  - **Kapitel 3** ist erledigt bei „Master“ (Kopplung erklärt), bei „Mit Master verbinden“ (gekoppelt und verbunden) oder bei der ausdrücklichen Entscheidung „Ich arbeite allein an diesem Rechner“ (3.1).
  - **Kapitel 4** am Rechner mit „Mit Master verbinden“: Die Tools folgen dort der Show des Masters, iveo-Adresse und Tokens bleiben am Master (`docs/suite-verbund.md:108`, `:132`). Das Kapitel erklärt das („Die Show kommt vom Master“) und ist erledigt, sobald die Show vom Master angekommen ist; eine eigene Show mit iveo-Bindung bringt es dort nicht bei.
  - **Kapitel 5** empfiehlt die sichere Steuerebene **nur am Einzelplatz**. Im Verbund trägt der sichere Modus über mehrere Rechner noch nicht (`apps/launcher/src/renderer/src/components/SystemStatusModal.tsx:373-380`, Folgeaufgabe FA7); dort erklärt das Kapitel Companion im offenen Modus und richtet nichts um. Companion im offenen Modus gilt als erledigt, sobald der Bediener es bestätigt („Companion ist verbunden“) oder „Brauche ich nicht“ wählt.
  - **Kapitel 6** gilt an allen Rollen; am Master sagt es vorher, dass das Öffnen einer Show sie an den Verbund verteilt.
- **Abhängigkeiten:** Kapitel 1 ändert sich mit der Anmeldung im Launcher (Spec `docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md`, kommt später); die Anleitung wird dann angepasst, das Grundgerüst nicht. Der Launcher bekommt in **UX-Welle 3** eine neue Oberfläche; die Anleitung muss das überstehen (Abschnitt 7).
- Schritte, die ohne Internet, ohne zweiten Rechner oder ohne iveo nicht gehen, sagen das und bieten „Überspringen“ mit dem Hinweis, wo man es später findet.
- Die Texte jedes Kapitels sind Teil der Spec-Umsetzung (Texttabelle), kurz, in Bedienersprache, ohne ASCII-Anführungszeichen; sie gehen vor dem Release zur Owner-Freigabe.

## 6 · Stimme (Owner-Entscheid: lokal)

- **Lokal, ohne Internet.** Vorschlag des Entwurfs: Die Texte werden **beim Bau** einmal mit einer lokalen Sprachausgabe in kurze Audiodateien umgewandelt und mitgeliefert (Kandidat: die deutsche Stimme „Thorsten“ für die Sprachausgabe Piper). Zur Laufzeit braucht es dann weder eine Sprachausgabe noch Internet, und jede Zeile klingt immer gleich.
- **Abschaltbar** (gemerkt je Rechner), Lautstärke folgt dem System. Der Text steht immer da; ohne Ton funktioniert alles.
- Ändert sich ein Text, entsteht seine Audiodatei beim nächsten Bau neu; ein Test prüft, dass zu jedem Text eine passende Audiodatei gehört (z. B. über eine Prüfsumme des Textes).
- **Lizenz** der Stimme und der Sprachausgabe für die gewerbliche Nutzung und Mitlieferung ist vor dem Plan zu prüfen und im Repo zu vermerken.
- Eine Cloud-Stimme (später) tauscht nur die Erzeugung der Audiodateien, nicht das Grundgerüst.

## 7 · Grundgerüst für alle Tools (Owner: „passt“)

- Liegt im **UX-Fundament** (`@jm/ui`), damit jedes Tool es nutzen kann (Vorschlag des Entwurfs: eine Komponente für Hervorhebung, Sprechblase und Steuerung sowie ein reiner Ablaufkern ohne DOM, der Schritte, Erkennung und Fortschritt verwaltet; Name und Schnitt entscheidet der Planer).
- **Jede Anleitung ist eine Datei** mit Kapiteln, Schritten, Texten, Ziel-Kennungen und Bedingungen „erledigt, wenn“. Die Bedingungen lesen nur vorhandene Zustände des Tools; sie lösen nichts aus.
- **Ziele über feste Kennungen**, nicht über Position oder Beschriftung: Bedienelemente, auf die eine Anleitung zeigt, tragen eine feste Kennung (z. B. ein eigenes Attribut). Heute gibt es im Launcher keine solchen Kennungen (`data-testid` o. ä.: 0 Treffer); sie kommen mit dieser Stufe dazu.
- **Test gegen stillen Bruch:** Ein Selbsttest prüft für jede Anleitung, dass es jede Ziel-Kennung im Tool gibt und jede Bedingung auf einen vorhandenen Zustand zeigt; mit Gegenprobe (Kennung entfernt → rot). Damit fällt eine UX-Welle, die ein Ziel wegnimmt, im Test auf, nicht beim Bediener.
- **Fehlt ein Ziel zur Laufzeit** (z. B. Fenster zu klein, Bereich eingeklappt), sagt die Sprechblase ehrlich, was zu tun ist (z. B. „Öffne zuerst die Einstellungen“), statt ins Leere zu zeigen.
- Hell und Dunkel, Fokus und Tastatur nach den Regeln des UX-Fundaments.
- **Während der Produktion** (Entscheidung des Entwurfs nach der Bau-Prüfung): Ist eine Show offen oder läuft ein Tool, ist die **Stimme von selbst aus** (der Ton eines Produktionsrechners hängt oft am Pult oder an der Beschallung) und die Sprechblase sagt das; der Bediener kann sie bewusst einschalten. Schritte, die in die laufende Produktion eingreifen würden (z. B. eine andere Show öffnen, am Master verteilt das sie an den Verbund und setzt am Timer von B den Countdown zurück, `docs/suite-verbund.md:132`), warnen vorher und lassen sich nur „zeigen“, nicht auffordern.
- **Live-Tools (später):** Eine Anleitung bringt nie etwas auf Sendung; Schritte, die sonst eine Sendung auslösen würden, laufen dort nur mit einem Übungsweg (z. B. Ausgabe aus) oder werden nur erklärt. Die Regel steht im Grundgerüst; ausgearbeitet wird sie mit der ersten Anleitung eines Live-Tools.

## 8 · Was der Planer entscheidet

- Schnitt und Namen der Bausteine im UX-Fundament, Format der Anleitungs-Datei, Speicherort des Fortschritts (Bedingung: robust gegen fehlendes `localStorage`, Lehre der Suite).
- Werkzeug und Ablauf für die Audiodateien beim Bau (lokal oder CI unter Linux), Format und Größe.
- Wie die Bedingungen „erledigt, wenn“ an die Zustände des Launchers kommen (Store, IPC), ohne neue Seiteneffekte.
- Feinheiten der Darstellung (Abdunkeln, Platz der Sprechblase, Animation) im Stil des UX-Fundaments.
- Tests: Ablaufkern als Kreuzprodukt (Schritt × erledigt/nicht × übersprungen × pausiert × Neustart), Ziel-Kennungen vorhanden, Audiodatei je Text, Gegenproben.

## 9 · Owner-Fragen (jede mit Vorgabe)

| # | Frage | Vorgabe (Owner 17.10.2026: bestätigt) |
| --- | --- | --- |
| OF1 | Soll die heutige Checkliste „Erste Schritte“ in der Kapitelübersicht aufgehen? | ja (Abschnitt 4) |
| OF2 | Bekommen bestehende Rechner die Anleitung automatisch? | nein, nur einmal den Hinweis „Neu: geführte Einrichtung“ |
| OF3 | Version | Launcher-Minor mit dem nächsten Launcher-Release nach dem iveo-Paket; `@jm/ui` wird mitgebündelt |

## 10 · Risiken

- **UX-Welle 3** baut den Launcher um; Ziel-Kennungen und der Test aus Abschnitt 7 halten den Umbau sichtbar, die Texte einzelner Kapitel müssen dann trotzdem angepasst werden.
- **Anmeldung:** Kapitel 1 wird mit der Anmeldung neu geschrieben.
- **Stimme:** Eine lokale Stimme klingt etwas technisch; die Owner-Entscheidung für lokal gilt „erstmal“.
- **Kapitel 3 und 5** brauchen einen zweiten Rechner bzw. Companion; ohne sie werden sie übersprungen und bleiben in der Übersicht offen, mit ehrlichem Text.
