# Anmeldung im Launcher (Konten, Stufen, Freigaben statt Keys)

Entwicklerdoku zu Teil 1 der Anmeldung. Spec: `docs/superpowers/specs/2026-10-17-launcher-anmeldung-design.md`. Plan:
`docs/superpowers/plans/2026-10-21-launcher-anmeldung-teil1.md` (dort Entscheidungen EP1 bis EP35, Texttabelle, Verträge 10.1
bis 10.9). Bedienung für Techniker: Kochbuch-Rezept „JM Launcher — Anmelden“ (`packages/cookbook/content/tool-manuals/launcher-anmeldung.md`).
Abnahme: `apps/launcher/ABNAHME-anmeldung.md`.

## 1 · Überblick

Kollegen melden sich mit ihrem Google-Firmenkonto von `jakobsmedien.com` an und sind damit automatisch Kollegen. Externe
Techniker bekommen von einem Admin einen Einladungscode und melden sich mit E-Mail und Passwort an. Angemeldet ist immer nur
der Launcher; er bestätigt den Rechner einmal mit einem Code im System-Browser und hält die Sitzung. Tools fragen den Launcher
nach einer befristeten Freigabe (heute nur JM Q&A). Admins vergeben Zugänge, hinterlegen iveo-Tokens, geben Zoom frei und
markieren JM-Rechner in der Admin-Maske des Launchers.

Der Live-Betrieb hängt nie an der Anmeldung: Die Prüfung beim Start läuft im Hintergrund, ein Tool ohne Keys startet wie
bisher, und was einmal ausgegeben ist (Freigaben, iveo-Tokens im Speicher), gilt bis zu seinem Ablauf bzw. bis zum Neustart des
Launchers, auch wenn der Zugang inzwischen entzogen ist.

**Teil 1 und Teil 2.** Teil 1 umfasst Worker, Launcher, Admin-Maske, Q&A und den Übergang. Connect (Cloud-Raum, Zoom-JWT vom
Worker, „Zoom-SDK laden“ über die Sitzung) folgt in Teil 2 nach Connect 0.4.0. Bis dahin nutzt Connect seinen Proxy-Key
unverändert; `connect-relay.js` und `/zoom-sdk` sind in Teil 1 nicht angefasst.

## 2 · Bausteine

| Ort | Datei | Aufgabe |
| --- | --- | --- |
| Worker | `services/release-proxy/konto-kern.js` | Stufen, Rechte (`darf`), Kontostand, Fristen, `alterKeyGilt` (rein) |
| Worker | `services/release-proxy/konto-krypto.js` | Sitzungen und Freigaben `jm1.…` (HMAC), PBKDF2, AES-GCM für iveo, Gerätebeweis (ECDSA P-256) |
| Worker | `services/release-proxy/konto-do.js` | Durable Object `KontoSpeicher` (SQLite, EU): Konten, Geräte, Vorgänge, Anfragen, iveo, Protokoll |
| Worker | `services/release-proxy/konto-zugang.js` | Zugangsprüfung für Katalog, Updates, Kochbuch, Feedback, KI-Entwurf und Q&A-Relay |
| Worker | `services/release-proxy/konto-relay.js`, `konto-seiten.js`, `konto-google.js` | Launcher-API `/konto/*`, Anmeldeseite (ohne Skript), Google-Anmeldung |
| Launcher | `apps/launcher/src/shared/konto.ts` | Typen, `darf` (dieselbe Falltabelle wie der Worker), `STUFE_TEXT`, `kurzName` |
| Launcher | `apps/launcher/src/main/konto/*.ts` | Gerät, Worker-Client, Sitzungs-Treiber, Anmelde-Ablauf, Rückkanal beim Bestätigen (Z2), Tür-Dienst, Freigabe-Stelle, iveo im Speicher (rein); `huelle.ts` verdrahtet Electron |
| Launcher | `apps/launcher/src/renderer/src/lib/konto-*.ts`, `admin-ansicht.ts`, `store/konto.ts`, `components/Konto*.tsx`, `Anmelde*.tsx`, `Admin*.tsx` | Kopf, Dialoge, Admin-Maske |
| Tools | `packages/app-runtime/src/freigabe.ts` (Export `@jm/app-runtime/freigabe`) | Client für Freigaben beim Launcher (Tür-Datei, Beweis) |
| Q&A | `apps/qa/src/main/cloud-zugang.ts` | Zugangswahl (Freigabe vor altem Key), Erneuern, Zugangszeile |

## 3 · Anmelden (Spec 4.1)

1. Der Launcher öffnet zuerst einen Rückkanal: einen kleinen HTTP-Lauscher nur auf `127.0.0.1` mit einem freien Port, den das
   Betriebssystem wählt (`apps/launcher/src/main/konto/rueckkanal.ts`). Dann legt er beim Worker einen Anmeldevorgang an
   (`POST /konto/vorgang`) und meldet dabei seinen Geräteschlüssel (öffentlicher Teil), Rechnername, Plattform, Version und den
   Port des Rückkanals (`rueckPort`, 1024 bis 65535) an. Er bekommt Vorgang, Abholgeheimnis, einen Code `XXX-XXX` und die Adresse
   der Anmeldeseite; der Vorgang gilt 5 Minuten.
2. Er öffnet die Adresse im System-Browser und zeigt denselben Code im Anmelde-Dialog („Der Browser zeigt gleich denselben
   Code. Bestätige dort nur, wenn er übereinstimmt.“). Geht der Browser nicht auf, kopiert der Techniker die Adresse.
3. Im Browser meldet sich der Techniker an (Google oder E-Mail und Passwort, beim ersten Mal mit Einladungscode). Die Seite zeigt
   den Code, den Rechner nur als „Rechner: ‹Name› (vom Rechner gemeldet)“ (der Worker lässt im Namen nur Buchstaben, Ziffern,
   Leerzeichen und `-_.()'` stehen, höchstens 40 Zeichen) und direkt über „Ja, das ist mein Rechner“ den Warnsatz „Bestätige nur,
   wenn du selbst gerade auf diesem Rechner im Launcher auf „Anmelden“ geklickt hast. Hat dir jemand diesen Link geschickt,
   klicke auf „Nein, abbrechen“.“ Die Seite bestätigt über ein Formular mit Seitentoken; sie hat kein Skript und setzt keine
   Cookies.
4. Nach „Ja“ leitet der Worker den Browser mit 303 an den Rückkanal auf demselben Rechner weiter:
   `http://127.0.0.1:<rueckPort>/anmeldung/zurueck?v=<Vorgang>&e=<Einmalwert>` (wie die Anmeldung von Desktop-Programmen bei Google,
   RFC 8252 „loopback redirect“). Der Einmalwert `e` entsteht beim Bestätigen (32 Zufallsbytes); der Worker speichert nur seinen
   SHA-256. Der Rückkanal nimmt genau diese eine Anfrage an (Host-Kopf `127.0.0.1:<Port>`, der eigene Vorgang, `e` mit 43 Zeichen),
   zeigt im Browser „Fertig. Du kannst dieses Fenster schließen; der Launcher meldet sich jetzt an.“ und schließt sich. Er schließt
   sich auch beim Abbrechen, nach 5 Minuten und beim Beenden des Launchers; ins Log kommt nur, ob ein Aufruf angenommen oder
   abgewiesen wurde. Kommt der Browser nicht an (anderer Rechner), steht auf der Seite „Weiter zum Launcher auf diesem Rechner.
   Öffnet sich nichts, wurde die Anmeldung auf einem anderen Rechner gestartet; starte sie dort im Launcher neu.“
5. Der Launcher fragt alle 2 Sekunden nach (`POST /konto/vorgang/abholen`, mit Abholgeheimnis und Gerätebeweis, ab dem Sprung mit
   `e`). Nach der Bestätigung gibt der Worker die Sitzung samt Kontostand nur mit diesem `e` heraus; ohne oder mit falschem `e`
   antwortet er wie vorher „wartet“. Geht die Antwort mit der Sitzung unterwegs verloren, nimmt der Worker dieselbe Anfrage
   (dasselbe Abholgeheimnis, dasselbe `e`, derselbe Rechner) noch 60 Sekunden lang an und stellt eine neue Sitzung desselben Geräts
   aus. Vorübergehende Netz- oder Serverfehler beenden das Warten erst, wenn seit der letzten Antwort 60 Sekunden lang nur Fehler
   kamen; eine Drosselung (429) zählt nicht als Fehler.

Ein Vorgang gehört dem ersten Konto, das sich darauf anmeldet. Ein weitergeleiteter Link verschafft dem, der ihn weitergeleitet
hat, keine Sitzung: Startet jemand die Anmeldung auf seinem Rechner und schickt den Link einem anderen, springt der Browser des
anderen nach „Ja“ an dessen eigenen Rechner; dort lauscht kein Rückkanal für diesen Vorgang, und der Rechner, der den Vorgang
gestartet hat, bekommt den Einmalwert nie. Der Preis: Bestätigen geht nur im Browser desselben Rechners, auf dem der Launcher die
Anmeldung gestartet hat (nicht auf dem Handy, nicht auf einem zweiten Rechner).

## 4 · Sitzung und Kontostand (Spec 6.1, 6.3)

Die Sitzung ist ein signiertes Token (`jm1.<payload>.<sig>`, HMAC-SHA256 mit dem Worker-Secret `KONTO_SCHLUESSEL`) mit dem
Kontostand: Stufe, Werkzeuge und iveo-Events für Externe, Zoom-Freigabe, JM-Rechner, Plattform. Sie gilt höchstens 30 Tage (ein laufender Launcher prüft ab 24 h vor dem Ende im Hintergrund neu, EP29); „Zugang
bis“ begrenzt nur den Start (ein laufender Launcher behält sie bis zum Neustart, Spec 6.3). Der Launcher speichert sie nur mit
safeStorage verschlüsselt in `settings.json` (ohne Schlüsselspeicher keine Anmeldung), den privaten Geräteschlüssel ebenso.

Bei jedem Start erneuert der Launcher die Sitzung im Hintergrund (`POST /konto/sitzung` mit Gerätebeweis). Der Worker liest dabei
den aktuellen Stand im Durable Object; was ein Admin geändert hat (Stufe, Sperre, Freigaben), wirkt damit beim nächsten Start (Zoom-Freigabe und Cloud-Raum nutzt Connect erst mit Teil 2, EP34).
Zwischen zwei Starts prüft der Worker nur die Signatur. Ausnahme: Admin-Maske und Admin-Aktionen prüfen den aktuellen Stand sofort. Ein Google-Konto erneuert höchstens 90 Tage nach der letzten Anmeldung mit Google an diesem Rechner, danach meldet es sich neu mit Google an (Spec 4: wer ausscheidet und sein Google-Konto verliert, kommt so nicht mehr herein; OFP8); lehnt der Worker die Neuprüfung eines laufenden Launchers deshalb ab, gilt dessen Sitzung bis zu ihrem Ende weiter, und der Konto-Dialog sagt das; wer ausscheidet, wird zusätzlich sofort in der Admin-Maske gesperrt (Zugang löschen sperrt ein Google-Konto).

| Zustand im Launcher | Wann | Kopf |
| --- | --- | --- |
| nicht angemeldet | keine gespeicherte Sitzung | „Anmelden“ |
| Prüfung läuft | Start mit gespeicherter Sitzung, vor der Antwort | Name · Stufe |
| angemeldet | Erneuerung gelungen | Name · Stufe |
| offline / Server nicht erreichbar | Erneuerung ohne Antwort; gilt weiter bis zum Datum der Sitzung, neuer Versuch nach 30 s bis 5 min, längstens bis zu diesem Datum; antwortet der Server, scheitert die Prüfung aber an seiner Einrichtung oder an der Uhr des Rechners, nennt der Titel den Grund (EP30, EP31; beim Start und bei der Neuprüfung im Betrieb) | Name · offline |
| abgelaufen | 30 Tage nicht beim Server erneuert (beim Start oder im Betrieb, wenn die Neuprüfung ab 24 h vor dem Ende nicht gelang), beim Start „Zugang bis“ erreicht oder letzte Anmeldung mit Google 90 Tage her | „Anmeldung abgelaufen“ |
| entzogen | beim Start gesperrt, gelöscht, abgelaufen oder Gerät unbekannt; nach einem Entzug im Betrieb, sobald die Sitzung endet (an ihrem Datum oder früher, wenn der Server sie nicht mehr annimmt, EP36) | „Zugang entzogen“ |
| entzogen, Sitzung läuft | Entzug während des Betriebs bemerkt (auch „Zugang bis“ erreicht); die Sitzung gilt bis zum Neustart, längstens bis zu ihrem Datum, der Konto-Dialog nennt den Grund | Name · Zugang entzogen |
| kein Schlüsselspeicher | safeStorage fehlt | „Anmelden nicht möglich“ |

## 5 · Stufen und Rechte (Spec 5, 9.1)

`darf(stand, funktion, { event, jetzt })` steht zweimal, in `konto-kern.js` (Worker) und `src/shared/konto.ts` (Launcher), und
beide laufen dieselbe Falltabelle `services/release-proxy/test/rechte-faelle.json` durch.

| Funktion | Admin | Kollege | Externer |
| --- | --- | --- | --- |
| Launcher-Selbst-Update (`/tools/launcher/latest`) | ja, auch ohne Anmeldung (ab 0.18.0) | ja, auch ohne Anmeldung (ab 0.18.0) | ja, auch ohne Anmeldung (ab 0.18.0) |
| Katalog, Installieren, Updates, Kochbuch, Feedback | ja | ja | ja |
| KI-Entwurf für das Kochbuch | ja | ja | nein |
| Q&A extern, Connect-Cloud-Raum (Teil 2) | ja | ja | nur mit dem Werkzeug |
| iveo (je Event) | jedes hinterlegte Event | jedes hinterlegte Event | nur mit Werkzeug iveo und für freigegebene Events |
| Zoom (Teil 2, nur Windows) | ja | ja | nur mit Zoom-Freigabe und auf einem JM-Rechner |
| Admin-Maske | ja | nein | nein |

## 6 · Routen des Workers

Reihenfolge in `fetch`: Health-Check, `/qa/*`, `/connect/*`, `/zoom-sdk`, `/konto/*`, `/tools/launcher/latest` (ab 0.18.0 ohne Zugang, gebremst; EP32), dann
die Zugangsprüfung für Feedback, Katalog, Kochbuch, KI-Entwurf und `/tools/:id/latest`. Fehler kommen als
`{ "error": "<Text>", "code": "<Code>" }`; ohne `KONTO_SCHLUESSEL` oder Bindung `KONTO` antwortet `/konto/*` mit 503.

| Methode · Pfad | Zugang | Zweck |
| --- | --- | --- |
| POST `/konto/vorgang` | öffentlich, gedrosselt | Anmeldevorgang anlegen (mit dem Port des Rückkanals, Z2) |
| POST `/konto/vorgang/abholen` | Abholgeheimnis und Gerätebeweis, nach der Bestätigung dazu der Einmalwert `e` | Stand des Vorgangs, nach der Bestätigung die Sitzung |
| POST `/konto/vorgang/abbrechen` | Abholgeheimnis | Vorgang abbrechen |
| POST `/konto/sitzung` | Sitzung und Gerätebeweis | Sitzung erneuern (Start-Prüfung) |
| POST `/konto/abmelden` | Sitzung | Abmelden |
| GET `/konto/ich` | Sitzung | Lage: Konto aktiv, Zoom-Anfrage, offene Anfragen für Admins |
| POST `/konto/freigabe` | Sitzung | Freigabe für ein Tool (Zweck `qa-relay`, 72 h) |
| GET `/konto/iveo` | Sitzung | erlaubte iveo-Tokens (nur in den Speicher des Launchers) |
| POST `/konto/zoom-anfrage` | Sitzung, nur Externe | Zoom anfragen |
| GET `/konto/admin/uebersicht` | Sitzung, Admin (aktueller Stand) | Daten der Admin-Maske |
| POST `/konto/admin/aktion` | Sitzung, Admin (aktueller Stand) | Admin-Aktion |
| GET `/konto/anmelden` | öffentlich | Anmeldeseite (HTML) |
| POST `/konto/passwort` | öffentlich, gedrosselt, Bremse je Konto | Anmeldung mit E-Mail und Passwort bzw. Einladungscode |
| GET `/konto/google` | öffentlich | Weiter zu Google (PKCE) |
| GET `/konto/google/zurueck` | öffentlich | Rückkehr von Google |
| POST `/konto/bestaetigen` | Seitentoken | Code bestätigen (dann 303 an den Rückkanal auf `127.0.0.1`) oder abbrechen |

Die Seiten tragen `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*;
base-uri 'none'; frame-ancestors 'none'`, dazu `no-store`, `no-referrer` und `nosniff`, kein Cookie. `form-action` erlaubt
`http://127.0.0.1:*`, weil Chrome, Edge und Safari `form-action` auch auf die Weiterleitung nach dem Formular „Ja“ anwenden
(Firefox prüft nur das erste Ziel); der Sprung ist eine Navigation der ganzen Seite, die weder Mixed Content noch die Prüfung
„Local Network Access“ von Chrome trifft (die gilt dort nur für Abrufe und eingebettete Rahmen).

**Drosseln (Z1, AR70).** Die Drosseln der Anmeldung zählen nicht in Workers KV (KV erlaubt ein Schreiben je Schlüssel und Sekunde;
hinter einer gemeinsamen Büro-IP und beim Abholen im 2-Sekunden-Takt gäbe das Fehlschläge), sondern in Rate-Limit-Bindungen der
Workers (`[[ratelimits]]` in `wrangler.toml`). Eine Bindung je Grenze, gezählt je IP-Hash (nie die IP selbst) und je Cloudflare-Standort,
also ungefähr:

| Bindung | `namespace_id` | Grenze je 60 s | gilt für |
| --- | --- | --- | --- |
| `KONTO_RL_VORGANG` | `7301` | 20 | POST `/konto/vorgang` |
| `KONTO_RL_ABHOLEN` | `7302` | 600 | POST `/konto/vorgang/abholen` |
| `KONTO_RL_ABBRECHEN` | `7303` | 60 | POST `/konto/vorgang/abbrechen` |
| `KONTO_RL_GOOGLE` | `7304` | 60 | GET `/konto/google` und `/konto/google/zurueck` |
| `KONTO_RL_PASSWORT` | `7305` | 10 | POST `/konto/passwort` (die Bremse je Konto im Durable Object bleibt) |
| `KONTO_RL_SELBSTUPDATE` | `7306` | 20 | `/tools/launcher/latest` ohne Zugang |

Bei Überschreitung antwortet die Route wie bisher mit 429 und `Retry-After: 60`. Fehlt eine Bindung oder wirft ihr `limit()`,
warnt der Worker im Log (mit dem Fehlernamen) und lässt die Route offen; eine Drossel erzeugt nie einen 5xx. Die alten Routen
(Feedback, Kochbuch-Entwurf, Zoom-SDK, Q&A) zählen weiter in KV `RATELIMIT`. Vor dem Durable Object prüfen die Routen zum Abholen
und Abbrechen außerdem die Länge von Vorgangs-ID (24 Zeichen) und Abholgeheimnis (43 Zeichen); sonst antworten sie mit 400, ohne den
Durable Object zu fragen.

## 7 · Freigaben an Tools (Spec 6.2)

Der Launcher lauscht auf `127.0.0.1` an einem freien Port und legt bei jedem Start die Tür-Datei
`<appData>/JM Production Suite/launcher-tuer.json` mit Port und Zufallsschlüssel ab (beim Beenden gelöscht). Ein Tool schickt
`POST /v1/freigabe` mit Zeitstempel, Nonce und HMAC-Beweis; der Launcher antwortet ebenfalls mit Beweis, sonst verwirft das Tool
die Antwort. Die Freigabe ist an Zweck und Ziel gebunden (heute `qa-relay` mit der Q&A-Event-ID) und gilt 72 Stunden; sie ist nie
die Sitzung selbst. Jede Ausgabe steht im Konto-Dialog unter „An Tools ausgegeben“ und in `main.log` (ohne Token).

**Grenze:** Ein anderes Programm desselben Windows-Kontos kann die Tür-Datei lesen und ist lokal nicht von einem Tool der Suite zu
unterscheiden. Darum sind Freigaben eng (Zweck, Ziel, 72 h) und protokolliert (Owner-Frage OFP9). Teil 2 ergänzt nur Zwecke (`connect-raum`,
`zoom-jwt`, `zoom-sdk`).

Q&A holt die Freigabe für sein Event selbst, hält sie in `qa.cloud.secret` (über einen eigenen Neustart, auch bei geschlossenem
Launcher) und erneuert sie über den Launcher, sobald weniger als 24 Stunden bleiben. Der Live-Pfad Q&A → Worker braucht den
Launcher nicht.

## 8 · iveo zentral (Spec 6.4)

Admins hinterlegen das iveo-Token je Event in der Admin-Maske (Reiter „iveo-Events“); der Worker speichert es AES-GCM-verschlüsselt
mit `IVEO_SCHLUESSEL`. Nach jeder Start-Prüfung lädt der Launcher die erlaubten Tokens nur in den Speicher. Die Show-Datei bleibt
token-frei. Wie bisher gleicht nur der Rechner ab, an dem die Show gebunden wurde („Abgleich hier“, ohne Geheimnis in
`settings.json`); ein zweiter Rechner übernimmt im Side-Events-Panel mit „Abgleich hier übernehmen“. Ein Token, das der Launcher einmal hat, behält er bis zum Abmelden oder Neustart, auch wenn ein Admin das Event inzwischen entfernt oder das Konto herabstuft (eine laufende Show bricht nicht ab); die Auswahl im Show-Editor folgt dagegen dem Server.

**Feste iveo-Liste (Z1, OE2).** Ein zentrales Token gehört nur an einen von zwei iveo-Servern: Production
(`https://app.my-iveo.de/api/v1`) und Staging (`https://staging-dev.my-iveo.de/api/v1`). Der Worker lehnt das Hinterlegen mit jeder
anderen Basis mit 400 und dem Code `iveo-basis-unbekannt` ab (Worker-Text S19, derselbe Wortlaut wie M49 in der Admin-Maske); der
Launcher weist es vor dem Senden ab und gibt ein zentrales Token nur an eine Basis der Liste weiter (sonst „nicht hinterlegt“).
Lokale Tokens im Übergang und `JMPS_IVEO_BASE_URL` (Entwicklung) bleiben frei, bekommen aber keine zentralen Tokens außerhalb der
Liste. Verglichen wird nach der Normalisierung: Schema und Host klein, Port 443 bei https weg, Schrägstriche am Ende weg; ohne
Zugangsdaten, Query und Fragment. Die Liste und die Normalisierung gibt es zweimal, im Worker (`IVEO_ERLAUBTE_BASEN`,
`normalisiereBasis` in `konto-kern.js`) und im Launcher (`IVEO_ERLAUBTE_BASEN`, `kanonischeIveoBasis` in `packages/iveo/src/client.ts`);
der Test `apps/launcher/test/iveo-gleichstand.test.ts` vergleicht beide über eine Fall-Tabelle. Ist `IVEO_SCHLUESSEL` gesetzt, aber
unbrauchbar (nicht 32 Byte Base64), antworten `GET /konto/iveo` und das Hinterlegen mit 503 (Text S5); fehlt er ganz, kommt der Hinweis `iveo-nicht-eingerichtet`.

## 9 · Übergang (Spec 10)

- **Alter Schlüssel am Worker.** `PROXY_KEY` gilt für Katalog, Updates, Kochbuch, Feedback, KI-Entwurf und die Admin-Routen von
  Q&A bis `ALTKEY_BIS` (Worker-Variable, ISO-Datum). Fehlt sie oder ist sie unlesbar, gilt er unbefristet, und der Reiter „Geräte“ zeigt das. Für Connect
  gilt er bis `ALTKEY_CONNECT_BIS`, die erst mit Teil 2 gesetzt wird; `connect-relay.js` prüft bis dahin selbst. Der Reiter
  „Geräte“ zählt Anfragen mit dem alten Schlüssel je Tag, Gruppe und Plattform (ohne IP-Adressen). Seit Z1 zählt die Anzeige
  höchstens einen Aufruf je IP-Hash, Tag und Gruppe (der Worker merkt sich den Schlüssel `Tag|Gruppe|IP-Hash` im Isolat, bis zu
  1000 Stück); die Zahl ist also eine Näherung für die Zahl der Anschlüsse, nicht der Anfragen. Fehlt `PROXY_KEY` am Worker oder
  ist er leer, antwortet der Worker auf einen mitgeschickten alten Schlüssel mit 503 (Text S5, Code `nicht-eingerichtet`) statt
  mit 401 (Z2, AR85): Q&A löscht seinen Key nur bei 401 `nicht-angemeldet` und behält ihn so bei einem Deploy ohne das Secret.
- **Selbst-Update.** `/tools/launcher/latest` liefert ein Release ab 0.18.0 auch ohne Zugang (60 s Zwischenspeicher, Drossel je IP; EP32), ältere Releases nur mit Sitzung oder altem Schlüssel; alte Launcher aktualisieren sich darum auch nach `ALTKEY_BIS` selbst auf 0.18.0 oder neuer.
- **Bau ohne Schlüssel.** Seit Launcher 0.18.0 backt der Bau keinen Schlüssel mehr ein (kein `define`, kein `JMPS_PROXY_KEY` in
  `suite-release.yml` und `suite-build.yml`). Connect liest seinen Key zur Laufzeit und ist nicht betroffen.
- **Nach der ersten Anmeldung** löscht der Launcher den gespeicherten GitHub-Token (Meldung „Der gespeicherte GitHub-Zugang wurde
  gelöscht; Downloads laufen jetzt über deine Anmeldung.“). Lokal gespeicherte iveo-Tokens löscht er je Event, sobald der Worker
  für dieses Event auf der Standardbasis ein Token liefert, spätestens 30 Tage nach der ersten Anmeldung, nie, solange eine iveo-Show offen ist; vorher
  setzt er „Abgleich hier“. Bis dahin nennt eine Meldung die Events, die nur noch lokal ein Token haben.
- **Abmelden beendet die Erneuerung.** `POST /konto/abmelden` löst das Gerät vom Konto (letztes Konto und Anmeldezeit werden
  gelöscht), und zwar nur, wenn die Sitzung die aktuelle Anmeldung dieses Geräts ist. Eine Erneuerung mit einer Sitzung dieses
  Geräts scheitert danach mit `geraet-unbekannt`; eine schon ausgegebene Sitzung gilt bis zu ihrem Ende weiter, wird aber nicht
  mehr erneuert. Im Launcher stoppt das Abmelden zugleich den iveo-Abgleich der offenen Show; laufende Tools arbeiten weiter.
- **Q&A** leert seinen alten Proxy-Key nach der ersten gültigen Freigabe; das Feld „Alter Proxy-Key (Übergang)“ steht nur noch
  da, solange ein Key gespeichert ist oder keine Freigabe vorliegt.

## 10 · Umgebungsvariablen für die Entwicklung

`JMPS_PROXY_KEY` (alter Weg, gilt am Worker bis `ALTKEY_BIS`), `JMPS_GITHUB_TOKEN`, `JMPS_RELEASE_PROXY` (Adresse des Workers, auch
für die Anmeldung), `JMPS_IVEO_TOKEN` (global), `JMPS_MANIFEST_URL`, `JMPS_CHANGELOG_URL`, `JMPS_COOKBOOK_URL`,
`JMPS_IVEO_BASE_URL`, `JMPS_IVEO_POLL_MS` (Abfragetakt des iveo-Abgleichs in Millisekunden, nur für Tests: eine Zahl von 500 bis
45000 verkürzt den Takt, alles andere lässt ihn bei 45 s), `JMPS_POLARIS_URL`, `JMPS_POLARIS_KEY`. Ist eine der ersten vier gesetzt, nennt der Konto-Dialog ihren Namen
(„Entwicklungsmodus: ‹Variablen› gesetzt.“). Der Worker nimmt nichts Neues aus der Umgebung eines Rechners an.

## 11 · Einrichtung des Workers (Controller, mit Owner-Freigabe)

Die Bindung `KONTO` (Klasse `KontoSpeicher`) legt die Migration `v2` beim Deploy an; `KONTO_JURISDICTION = "eu"` steht in
`wrangler.toml`. Secrets: `KONTO_SCHLUESSEL`, `IVEO_SCHLUESSEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ERSTER_ADMIN` (E-Mail
des ersten Admins, ein Google-Konto von `jakobsmedien.com`; er lässt sich in der Maske weder herabstufen noch sperren und zählt ab seiner ersten Anmeldung, eine andere Adresse wirkt nicht). Den Google-Client legt der Owner im Workspace
`jakobsmedien.com` als intern an (Redirect `/konto/google/zurueck`). Ablauf, Trockenlauf und Reihenfolge (Worker vor dem
Launcher-Release) stehen im Plan unter „Nach der Umsetzung“ und in `services/release-proxy/README.md`.

**Rate-Limit-Bindungen.** Die sechs `[[ratelimits]]`-Einträge (Abschnitt 6) verlangen wrangler ab 4.36.0. Ihre `namespace_id` 7301
bis 7306 müssen im Cloudflare-Konto eindeutig sein: Eine Zahl, die dort schon für eine andere Rate-Limit-Bindung vergeben ist, würde
deren Zähler teilen. Die Bauprobe (`tools/bauprobe.mjs`) und der Wächter in `konto-zugang.test.mjs` kennen genau diese sechs Einträge.

## 12 · Datenschutz und Protokoll (Spec 9, 11)

Konten, Geräte, Anfragen und iveo-Tokens liegen im Durable Object in der EU. Das Protokoll hält je Admin-Aktion und je
automatisch angelegtem Konto Zeit, Wer, Was und Wen fest, ohne Passwort, Hash, Code oder Token, 12 Monate lang, auch für
gelöschte Zugänge. Gelöschte Zugänge von Externen sind weg; Google-Konten werden gesperrt (aufhebbar).

## 13 · Tests

| Lauf | Befehl |
| --- | --- |
| Worker | `node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs` (ebenso `konto-krypto`, `konto-do`, `konto-zugang`, `konto-routen`, `qa-relay`) |
| Worker-Bauprobe | `node services/release-proxy/tools/bauprobe.mjs` |
| Launcher (rein) | `npm run selftest:konto -w @jm/launcher` |
| Launcher (Wächter) | `npm run selftest -w @jm/launcher` |
| App-Laufzeit (Freigabe-Client) | `npm run selftest -w @jm/app-runtime` |
| Q&A | `npm run selftest -w @jm/qa` |

Alle Tests laufen ohne Netz und ohne Cloudflare: Der Durable Object ist eine Klasse mit einer Attrappe von `ctx.storage`, Google,
GitHub und Anthropic kommen über eine `fetch`-Attrappe, echte Sockets nur auf `127.0.0.1`.
