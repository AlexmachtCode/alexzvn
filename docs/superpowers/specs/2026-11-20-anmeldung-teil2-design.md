# Anmeldung Teil 2: Connect über die Anmeldung (Cloud-Raum, Zoom-JWT, SDK laden) — Entwurf

Stand 2026-11-20 · Größe: Projekt · Basis: `origin/main` df96395472 (Connect 0.4.6, Launcher 0.18.0, Q&A 0.6.0, Worker mit Teil 1 und `ALTKEY_BIS = 2026-12-20`)

Dieser Entwurf sammelt, was für Teil 2 entschieden ist. Er ersetzt die Haupt-Spec nicht, sondern legt deren Teil-2-Zeilen fest:
**Haupt-Spec:** `docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md` (Zeilen 13, 22, 28, 32–34, 40–43, 50, 85–89, 95–98, 103, 107–110, 130–132, 139–140, 155–156, 166–168, 173–174, 184, 198).
**Bestand:** Bestandsaufnahme vom 05.11. (im Ledger-Archiv `sdd-archiv/2026-11-20-launcher-anmeldung-teil1-superpowers.tar.gz`, Datei `teil2-bestand.md`) und Nachmessung vom 20.11. gegen df96395472. Beide Dateien liegen dem Plan bei, nicht im Repo.

## Anlass und Warum

Owner 17.10.2026: „die einrichtung ist für die kollegen zu komplex“. Teil 1 hat Konten, Sitzung, Geräte und Freigaben im Launcher gebracht (Launcher 0.18.0, Q&A 0.6.0, abgenommen 20.11.). Connect braucht heute noch drei lokale Geheimnisse: den Proxy-Key für den Cloud-Raum, die Zoom-Zugangsdaten (Client-ID und Client-Secret) für das JWT und den SDK-Schlüssel für „Zoom-SDK laden“. Teil 2 ersetzt alle drei durch die Anmeldung.

## Ziele

- Kollegen tragen in Connect keinen Key, keine Zoom-Zugangsdaten und keinen SDK-Schlüssel mehr ein (Spec 13, 22, 40–43).
- Der Worker signiert das Zoom-JWT. Client-ID und Client-Secret liegen nur als Worker-Secret (Spec 107–110, 139–140).
- Cloud-Raum, Zoom-JWT und SDK-Download prüfen Sitzung und Rechte über dieselbe Tür wie Q&A (Spec 103, 155–156).
- Der Übergang verliert keine Funktion: Connect 0.4.6 und älter laufen bis zum Stichtag weiter (Spec 166–168).

## Nicht-Ziele

- Keine Anmeldung für Zoom-Nutzer (kein OAuth, E3 bleibt).
- Kein #317 Stufe B in Connect 0.5.0 (N3).
- Meeting-Nummer und Kenncode gehen nie an den Worker (Stage-4-Tabelle 5.7 „Cloud: nein“).
- Keine Änderung an den Zoom-Slots, an NDI oder an der Bridge außer der JWT-Quelle.

## Anti-Ziele (wäre ein Fehlschlag, selbst wenn es „funktioniert“)

- Der Live-Betrieb hängt an der Anmeldung: Ein laufendes Meeting, ein Wiederbeitritt oder ein Connect-Neustart im Betrieb scheitert, weil der Launcher zu ist (Spec 32, 107).
- Ein dauerhaftes Dienst-Geheimnis bleibt auf dem Rechner (Spec 33, 184).
- Die Einrichtung wird komplizierter (Spec 34).
- Eine Anzeige lügt in irgendeinem Zustand (Spec 174).

## Ansätze (Owner 05.11.: OT1)

- **A:** Der Launcher liefert das Zoom-JWT direkt als „Freigabe“. Verworfen: Ohne Launcher kein Wiederbeitritt; ein JWT ist keine Freigabe im Sinn von Spec 10.3.
- **B (gewählt):** Connect holt eine Freigabe `zoom-jwt` (`jm1`, 72 h) über die Tür, hält sie verschlüsselt und holt das JWT selbst bei `POST /zoom/jwt`. Wie Q&A; Wiederbeitritt und Neustart gelingen ohne Launcher.

## Entscheidungen

**Zwecke und Ziele** (OT1, OT3, OT4, OT7; Bestand 5.5):

| Zweck | Funktion | Ziel | Freigabe | Zusatz |
| --- | --- | --- | --- | --- |
| `connect-raum` | `connect-raum`, Gruppe `connect` | Raum-ID (`ID_RE` 6–64) | 72 h | Raum an die erste Freigabe gebunden (Konto oder Rechner, bis zum Raum-Verfall), DO-Aktion `connect-inhaber` nach dem Muster `qa-inhaber` (OT7) |
| `zoom-jwt` | `zoom` | fest `meeting-sdk` | 72 h | gilt nach OF1 (Kollegen auf jedem Windows-Rechner, Externe nur mit Zoom-Freigabe und JM-Rechner) |
| `zoom-sdk` | `zoom` | fest `win-x64` | 72 h (meine Festlegung, wie die beiden anderen) | **nur auf JM-Rechnern, für alle Stufen** (OT4); geprüft beim Ausstellen auf beiden Seiten (Launcher und Worker), weil die Freigabe-Claims kein `jm` tragen |

**Zoom-JWT** (OT2, OT3; Zoom-Doku „Meeting SDK authorization“):
- HS256, `appKey` = `ZOOM_CLIENT_ID`, signiert mit `ZOOM_CLIENT_SECRET`; `iat` = jetzt − 30 s, `exp` = `tokenExp` = `iat` + 12 h. Kein `mn`, keine `role`. Ausgabe byte-gleich zu `packages/zoom-bridge/src/jwt.ts` (`buildJwt`) bei gleichen Eingaben.
- Connect hält das JWT nur im RAM und erneuert es im Hintergrund, wenn weniger als 2 h Rest bleiben. Das JWT wird **vor** dem Start des Bridge-Prozesses geholt (Bestand R6).
- `POST /zoom/jwt` nimmt nur eine `zoom-jwt`-Freigabe (Bearer). Eigene Drossel als `[[ratelimits]]`-Bindung. Der DO protokolliert nur Konto, Rechner und Zeit. Kein JWT und kein Secret in Antwort-Logs, `main.log` oder Fehlermeldungen.
- Worker-Secrets heißen `ZOOM_CLIENT_ID` und `ZOOM_CLIENT_SECRET`. Kein neuer Name mit `ZOOM_SDK_` (Namensfalle, Bestand 5.1).

**Übergang und Stichtag** (OT5, OT6, OT8, OT10):
- Reihenfolge: Worker-Deploy (abwärtskompatibel) → Launcher 0.19.0 → Connect 0.5.0.
- Bis zum Stichtag gelten am Worker weiter `PROXY_KEY` an `/connect` und `ZOOM_SDK_KEY` an `/zoom-sdk`. Der Vergleich wird zeitkonstant (Bestand R1).
- `ALTKEY_CONNECT_BIS` = Release Connect 0.5.0 + 30 Tage, für beide Keys. Er wird **nach** dem Release in einem eigenen Schritt gesetzt; bis dahin bleibt er leer. Die Alt-Key-Zählung bekommt die Gruppe `connect`, sichtbar im Reiter „Geräte“.
- Am Stichtag wird das Zoom-Client-Secret rotiert, das Worker-Secret getauscht und die Zugangsdaten-Dateien in der Ablage gelöscht. Vorher klären, ob Zoom das Neu-Erzeugen erlaubt.
- Connect 0.5.0 mit Launcher 0.18.0 (`unbekannter-zweck`) oder ohne passenden Launcher zeigt „Launcher aktualisieren“ und nutzt im Übergang den alten Weg, solange ein alter Key oder alte Zugangsdaten da sind.
- Nach dem Übergang kein Rückfall auf lokale Geheimnisse. Die Umgebungsvariablen (`JMPS_PROXY_KEY`, `ZOOM_SDK_CLIENT_*`, `JMPS_ZOOM_SDK_KEY`) bleiben nur für Entwicklung und Test und werden als Diagnose angezeigt.

**Altlasten in Connect** (OT9, N1):
- `proxyKeyEnc` fällt nach der ersten gültigen `connect-raum`-Freigabe, `zoomZugangEnc` nach dem ersten erfolgreichen `auth` mit Server-JWT, `zoomSdkKeyEnc` nach dem ersten Link mit Freigabe. Dazu ein Hinweis wie Q&A Q6b.
- **Das gemerkte Meeting bleibt** (N1, Owner 20.11.): `zoomLetzteNummer` und `zoomLetzterKenncodeEnc` (#290, Owner-Entscheid 11.11.) sind Meeting-, keine Dienst-Geheimnisse. Der Nachweis „kein dauerhaftes Geheimnis“ (Spec 184) prüft die drei alten Felder, nicht diese beiden.
- Die Maskierliste der Logs (`geheimnisse()` in `apps/connect/src/main/zoom/kern.ts`) nimmt die Freigaben auf.

**Anzeige auf Nicht-JM-Rechnern** (N2, Owner 20.11.):
- Zoom (JWT) geht auf jedem Rechner, auf dem das Recht gilt (OF1). Nur „Zoom-SDK laden“ sagt auf einem Rechner ohne JM-Markierung mit eigenem Text ab und nennt den Weg „SDK-Ordner wählen“. Der Text geht mit der Texttabelle zur Freigabe. K24 („auf diesem Rechner erlaubt“) bleibt.

**Kurze Raum-IDs** (N4, Owner 20.11.):
- Show-Namen, deren Slug kürzer als 6 Zeichen ist (Beispiele `show`, `cop31`), ergeben heute eine Raum-ID, die der Worker mit 400 ablehnt (`apps/connect/src/main/show-open.ts`, `services/release-proxy/connect-relay.js` `ID_RE`). Connect füllt solche IDs stabil auf (gleiche Show → gleiche ID); IDs mit 6 oder mehr Zeichen bleiben unverändert. Gefunden durch Lesen, nicht ausgeführt.

**Texte** (OT11, OT12):
- Launcher: Z5, Z9b und R1 in der Fassung mit Wirkung; Z11 und M48 entfallen; Z6 bekommt „Zoom gibt es für Externe nur auf JM-Rechnern“ zurück; Z6 und Z7 sagen „wirkt“ statt „gilt“. Namen der neuen Zwecke in K29d; Connect-Gruppe und -Frist im Reiter „Geräte“ (M44, M46).
- Die Zoom-Freigabe eines Externen gilt ab „Freigeben“ bis `zoomBis`, wirksam beim nächsten Start des Launchers (so gebaut).
- Alle neuen oder geänderten Texte (Launcher, Connect, Handbuch, Changelog) gehen als eine Texttabelle zur Owner-Freigabe.

**Versionen:** Launcher 0.19.0, Connect 0.5.0 (nur Teil 2, N3). Der Worker bekommt einen Deploy vor dem Launcher-Release und einen zweiten für den Stichtag.

## Abnahme

1. Selbsttests: Worker (Gegenproben: falscher Zweck oder falsches Ziel, Sitzung statt Freigabe, Externer ohne Werkzeug, Zoom ohne Freigabe, Nicht-JM-Rechner beim SDK, Mac beim Zoom, fremdes Konto an gebundenem Raum, alter Key vor und nach dem Stichtag, unlesbarer Stichtag); JWT-Felder und Byte-Gleichheit; Launcher `selftest:konto`; Connect Kreuzprodukt der Anzeigen (kein Launcher, zu alt, nicht angemeldet, abgelaufen, entzogen-läuft, kein Recht, Server weg, Übergang mit altem Key), Wiederbeitritt mit JWT aus dem RAM, Neustart mit gehaltener Freigabe, Nachweis ohne die drei Alt-Felder.
2. Owner am echten JM-Rechner: Meeting über das Server-JWT; **M4** (JWT mit kurzer Laufzeit, Meeting über deren Ende halten: stört ein abgelaufenes JWT ein laufendes Meeting?); Externer auf Nicht-JM-Rechner lehnt das SDK ab; Mac mit Cloud-Raum; Rechner mit Connect 0.4.6 und altem Key läuft weiter.

## Rahmen

- Releases und Deploys nur mit Owner-OK; Texte zur Owner-Freigabe; Tags einzeln, `main` vor den Tags.
- Kein Secret im Chat, im Repo oder in `[vars]`; Testwerte erfunden, mit gitleaks-Freigabe.
- Zoom-DLLs nie in öffentliche Pakete (ToU §6.1); `/zoom-sdk` liefert nur den Link.

## Dem Bauenden überlassen

Aufbau des Connect-Zugangsmoduls (Muster `apps/qa/src/main/cloud-zugang.ts`), Namen der neuen Zustände in Connect, genaue Drossel-Werte für `/zoom/jwt`, Art des Auffüllens kurzer Raum-IDs (stabil, eindeutig, Zeichen aus `ID_RE`), Reihenfolge der Tests.

## Meine Entscheidungen (zur Prüfung)

- `zoom-sdk`-Freigabe 72 h wie die beiden anderen Zwecke.
- Das Setzen von `ALTKEY_CONNECT_BIS`, das Rotieren des Zoom-Secrets und das Löschen der alten Worker-Secrets gehören nicht in diesen Plan, sondern in einen eigenen Schritt nach dem Release (je mit Owner-OK).
- M4 ist Teil der Owner-Abnahme vor dem Release von Connect 0.5.0, nicht eines Selbsttests.
