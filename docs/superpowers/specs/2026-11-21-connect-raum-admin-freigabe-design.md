# Admin-Freigabe gebundener Cloud-Räume (Anmeldung Teil 2, Nachtrag)

Stand 21.11.2026. Kurzer Entwurf. Gehört zu Anmeldung Teil 2 (Entwurf `2026-11-20-anmeldung-teil2-design.md`,
Plan `docs/superpowers/plans/2026-11-20-anmeldung-teil2.md`) und kommt vor dem Release in denselben Branch (PR #325).

## Warum

Seit Teil 2 gehört ein Cloud-Raum dem Konto bzw. Rechner, dessen Freigabe ihn zuerst geöffnet hat (E3, Bindung
`connect-inhaber` im Konten-DO, bis 25 h, endet mit „Raum schließen“). Das gilt auch, wenn der Inhaber Connect beendet, ohne
„Raum schließen“ zu drücken, oder wenn sein Laptop ausfällt. In diesem Fall ist der Show-Raum für alle anderen bis zu 25 h
blockiert. Die Meldung CZ8 kann nicht sagen, wem er gehört, und der einzige Ausweg ist eine andere Raum-ID im Show-Editor. Die
Gesamtprüfung hat das als offene Plan-Frage gemeldet. Owner 21.11.: „bitte mit admin freigabe“, Ansatz A.

## Ziele

- Ein Admin sieht im Launcher, welche Cloud-Räume gerade gebunden sind, an wen und bis wann, und kann einen davon freigeben.
- Ein Kollege, der CZ8 bekommt, kann dem Admin sagen, um welchen Raum es geht.

## Nicht-Ziele

- Connect schließt den Raum beim Beenden nicht automatisch. Das Verhalten bleibt, wie es ist.
- Kein Eingriff in den Raum selbst: Die Freigabe löst nur die Bindung. Gäste und ein noch laufender Raum werden nicht getrennt.
- Keine Freigabe durch Nicht-Admins, keine Selbstbedienung.
- Q&A-Bindungen (`qa-inhaber`) bleiben unberührt.

## Anti-Ziele

- Ein Admin gibt aus Versehen einen laufenden Raum frei. Dagegen hilft eine Rückfrage mit klarer Folge.
- Ein Geheimnis (Freigabe, Schlüssel, Token) erscheint in der Liste, im Log oder in einer Antwort.

## Ansätze

- **A (gewählt):** Eine Liste der gebundenen Räume im Admin-Bereich mit Raum-ID, Inhaber und Ablaufzeit sowie dem Knopf
  „Freigeben“. Dafür speichert der Server bei neuen Bindungen die Raum-ID im Klartext mit. Raum-IDs sind Show-Namen und
  keine Geheimnisse. Das hebt die Festlegung „nur Hashes, nie die ID selbst“ (`connect-relay.js`, Kopf von `raumInhaber`) für
  Connect auf.
- B: dieselbe Liste ohne Raum-ID, nur mit Inhaber und Zeit. Verworfen: Hält eine Person zwei Räume, erkennt der Admin den
  verwaisten nicht.
- C: nur ein Feld „Raum-ID“ mit „Freigeben“, ohne Liste. Verworfen: Der Admin muss die genaue aufgefüllte ID kennen
  (etwa `show-1a2b3c`), und die sieht der Kollege nicht.

## Entwurf

**Worker (`services/release-proxy`)**
- `connect-inhaber` speichert bei einer neuen Bindung zusätzlich `raumId` (die ID, wie sie in der Route steht), `kid` (das
  Konto; der DO kennt Konten ohnehin unter ihrer kid) und `seit`. Hash-Schlüssel und Vergleichslogik bleiben unverändert. Der
  alte Schlüssel bindet weiterhin nie.
- `admin-uebersicht` liefert zusätzlich `raeume`: je gültiger Bindung `{ raumHash, raumId, name, stufe, seit, bis }`. Die
  Liste ist nach `bis` sortiert. Abgelaufene Bindungen fehlen. Name und Stufe kommen aus dem Konto zur kid; gibt es kein Konto
  mehr, fehlen beide, und die Anzeige sagt „unbekanntes Konto“.
- Neue Admin-Aktion `raum-freigeben` `{ raumHash }`, nur für Admins wie alle `ADMIN_AKTIONEN`. Sie löscht `connect:<raumHash>`.
  Antwort `{ ok: true, warFrei: boolean }`. Ein ungültiger Hash ergibt 400. Die Aktion steht im Protokoll wie andere
  Admin-Aktionen: wer, wann, Raum-ID, nie ein Geheimnis.
- Drosseln, Routen und Fristen bleiben unverändert.

**Launcher 0.19.0** (noch nicht released, kommt in dieselbe Version)
- Admin › Reiter „Geräte“ bekommt einen neuen Abschnitt „Cloud-Räume (Connect)“ mit einer Zeile je Raum und dem Knopf
  „Freigeben“.
- Ein Klick öffnet eine Rückfrage. Erst die Bestätigung schickt `raum-freigeben`. Danach wird die Übersicht neu geladen.
- Die Typen in `apps/launcher/src/shared/` bekommen `AdminUebersicht.raeume` und die Aktion.

**Connect 0.5.0** (noch nicht released)
- CZ8 nennt die Raum-ID und den Weg über den Admin. `ZUGANG_TEXT.raumVergeben` wird dazu eine Funktion `(raumId)`, und
  `room.ts` übergibt die aufgefüllte ID.

**Doku und Abnahme**
- Die Texttabelle `docs/anmeldung-teil2-texte.md` bekommt einen eigenen Abschnitt „Nachtrag 21.11.“ mit den neuen und
  geänderten Texten. Die übrigen Texte sind seit 21.11. freigegeben.
- Changelog: neue Notiz CL-L4 (Launcher 0.19.0).
- Weitere Stellen:
  - `docs/anmeldung.md` Abschnitt 14
  - README des Workers (Admin-Aktion)
  - Handbuch Launcher (Admin-Bereich)
  - Handbuch Connect (Pannenhilfe CZ8)
- Abnahme Schritt 7 wird so erweitert:
  1. A öffnet den Raum.
  2. A beendet Connect, ohne zu schließen.
  3. B bekommt CZ8 mit Raum-ID.
  4. Der Admin sieht den Raum mit A als Inhaber und gibt ihn frei.
  5. B öffnet den Raum, und es klappt.

## Texte (zur Owner-Freigabe)

| Nr. | Ort | Text |
| --- | --- | --- |
| CZ8 (neu) | Connect, Fehler 403 `raum-vergeben` | Dieser Cloud-Raum („‹Raum-ID›“) gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort, wähle im Show-Editor eine andere Raum-ID oder bitte einen Admin, ihn im Launcher freizugeben (Admin › Geräte › Cloud-Räume). |
| RF1 | Launcher, Überschrift | Cloud-Räume (Connect) |
| RF2 | Launcher, Erklärung | Räume, die gerade einem Konto gehören. Freigeben, wenn jemand Connect beendet hat, ohne „Raum schließen“ zu drücken. |
| RF3 | Launcher, leere Liste | Kein Cloud-Raum ist gerade gebunden. |
| RF4 | Launcher, Zeile | ‹Raum-ID› · ‹Name› · ‹Stufe› · gebunden bis ‹Datum› ‹Zeit› |
| RF5 | Launcher, Zeile ohne Konto | ‹Raum-ID› · unbekanntes Konto · gebunden bis ‹Datum› ‹Zeit› |
| RF6 | Launcher, Knopf | Freigeben |
| RF7 | Launcher, Rückfrage | Raum „‹Raum-ID›“ von ‹Name› freigeben? Läuft der Raum dort noch, verliert ‹Name› ihn, sobald jemand anderes ihn öffnet. |
| RF8 | Launcher, Erfolg | Raum „‹Raum-ID›“ ist frei. |
| RF9 | Launcher, war schon frei | Der Raum war schon frei. |
| CL-L4 | Changelog Launcher 0.19.0 | Admins können im Reiter „Geräte“ einen Cloud-Raum von Connect freigeben, der nach einem Absturz oder Beenden ohne „Raum schließen“ noch einem anderen Konto gehört. |

## Dem Bauenden überlassen

- Wie die Rückfrage aussieht: nach dem Muster bestehender Admin-Rückfragen im Launcher. Die Texte stehen oben fest.
- Wo genau der Abschnitt im Reiter „Geräte“ steht.
- Ob die Übersicht `kid`/`seit` auch für die Anzeige des Rechners nutzt. Nicht verlangt.
- Die Teststruktur, nach den bestehenden Tests in `services/release-proxy/test/` und `apps/launcher/test/`.
