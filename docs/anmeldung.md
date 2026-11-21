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

**Teil 1 und Teil 2.** Teil 1 umfasst Worker, Launcher, Admin-Maske, Q&A und den Übergang. Teil 2 ist mit Launcher 0.19.0 und
Connect 0.5.0 gebaut (Stand 21.11.2026: noch nicht veröffentlicht, nichts davon ist deployt): Connect holt Cloud-Raum,
Zoom-JWT vom Worker und „Zoom-SDK laden“ über Freigaben des Launchers statt über eigene Schlüssel (Abschnitt 14). Connect 0.4.6
und älter nutzen ihren Proxy-Key weiter, solange der Worker ihn annimmt (Abschnitt 9).

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
   Leerzeichen und `-_.()'` stehen, höchstens 40 Zeichen; bleibt nichts übrig, steht dort „Rechner: (kein Name gemeldet)“, und der
   Worker weist wegen des Namens nie ab; die Admin-Maske zeigt einen solchen Rechner in den Reitern „Geräte“ und „Anfragen“ als
   „(kein Name gemeldet)“, gespeichert bleibt der leere Name) und direkt über „Ja, das ist mein Rechner“ den Warnsatz „Bestätige nur, wenn du selbst
   gerade auf diesem Rechner im Launcher auf „Anmelden“ geklickt hast. Hat dir jemand diesen Link geschickt, klicke auf „Nein,
   abbrechen“.“ Die Seite bestätigt über ein Formular mit Seitentoken; sie hat kein Skript und setzt keine Cookies.
4. Nach „Ja“ zeigt die Seite „Weiter zum Launcher auf diesem Rechner. Öffnet sich nichts, wurde die Anmeldung auf einem anderen
   Rechner gestartet; starte sie dort im Launcher neu.“ und darunter den Knopf „Weiter zum Launcher“. Es gibt keinen automatischen
   Sprung (Owner-Entscheidung OE6). Der Knopf schickt ein Formular per POST an den Rückkanal auf demselben Rechner,
   `http://127.0.0.1:<rueckPort>/anmeldung/zurueck`, mit dem Vorgang `v` und dem Einmalwert `e` als versteckten Feldern (wie die
   Anmeldung von Desktop-Programmen bei Google, RFC 8252 „loopback“). Der Einmalwert geht so unsichtbar an den Launcher: Er steht
   nie in der Adresszeile, im Verlauf oder in einem Kopf der Antwort. `e` entsteht beim Bestätigen (32 Zufallsbytes); der Worker
   speichert nur seinen SHA-256. Ein Doppelklick auf „Ja“ verliert nichts: Jedes weitere „Ja“ mit demselben Seitentoken zeigt die
   Seite mit einem neuen `e` (höchstens drei je Vorgang, alle bleiben gültig), danach kommt „Dieser Anmeldelink ist abgelaufen oder
   ungültig. Starte die Anmeldung im Launcher neu.“ Öffnet jemand die Anmeldeadresse nach „Ja“, aber bevor der Launcher übernommen hat, zeigt die Seite „Die Anmeldung
   ist bestätigt, der Launcher hat sie aber noch nicht übernommen. Wurde sie auf einem anderen Rechner gestartet, starte sie dort
   im Launcher neu.“ (ohne Knopf und ohne `e`); nach dem Übernehmen noch eine Minute lang „Fertig. Dein Launcher ist angemeldet. Du
   kannst dieses Fenster schließen.“, danach wie bei jedem beendeten Vorgang „Dieser Anmeldelink ist abgelaufen oder ungültig.
   Starte die Anmeldung im Launcher neu.“
   Der Rückkanal nimmt nur `POST /anmeldung/zurueck` an (Host-Kopf `127.0.0.1:<Port>`, Formular höchstens 1 KiB, genau die Felder `v`
   und `e`, der eigene Vorgang, `e` mit 43 Zeichen; alles andere bekommt 404 ohne Inhalt), zeigt im Browser „Fertig. Du kannst
   dieses Fenster schließen; der Launcher meldet sich jetzt an.“ und meldet den Wert genau einmal an den Launcher. Ein Doppelklick
   auf den Knopf bekommt noch 10 Sekunden lang dieselbe Seite, danach schließt der Rückkanal. Beim Abbrechen, nach 5 Minuten und
   beim Beenden des Launchers schließt er sofort; ins Log kommt nur, ob ein Aufruf angenommen oder abgewiesen wurde.
5. Der Launcher fragt alle 2 Sekunden nach (`POST /konto/vorgang/abholen`, mit Abholgeheimnis und Gerätebeweis, ab dem Knopf mit
   `e`). Nach der Bestätigung gibt der Worker die Sitzung samt Kontostand nur mit einem `e` dieses Vorgangs heraus; ohne oder mit
   falschem `e` antwortet er wie vorher „wartet“. Geht die Antwort mit der Sitzung unterwegs verloren, nimmt der Worker dieselbe
   Anfrage (dasselbe Abholgeheimnis, ein `e` dieses Vorgangs, derselbe Rechner) noch 60 Sekunden lang an und stellt eine neue Sitzung
   desselben Geräts aus. Vorübergehende Netz- oder Serverfehler beenden das Warten erst, wenn seit der letzten Antwort 60 Sekunden
   lang nur Fehler kamen (gemessen auf einer monotonen Uhr, ein Sprung der Rechneruhr ändert daran nichts); eine Drosselung (429)
   zählt nicht als Fehler. Endet die Frist von 5 Minuten, während der Worker drosselt, sagt der Dialog „Zu viele Anmeldeversuche
   von diesem Anschluss. Versuche es in ein paar Minuten erneut.“ statt „abgelaufen“. Lässt sich der Rückkanal nicht öffnen, sagt
   er „Der Launcher konnte die Anmeldung auf diesem Rechner nicht vorbereiten. Starte den Launcher neu und versuche es noch
   einmal.“

Ein Vorgang gehört dem ersten Konto, das sich darauf anmeldet. Der Einmalwert geht per Formular unsichtbar an den Launcher und
steht nicht in der Adresszeile oder im Verlauf. Wer den Link weiterleitet, bekommt auf seinem Rechner keine Sitzung: Startet jemand
die Anmeldung auf seinem Rechner und schickt den Link einem anderen, schickt der Knopf im Browser des anderen den Einmalwert an
dessen eigenen Rechner. Dort führt er ins Leere, denn auf diesem Rechner ist kein Vorgang offen (der Browser meldet, dass
`127.0.0.1` nicht erreichbar ist, oder der Rückkanal des anderen weist den fremden Vorgang ab), und der Rechner, der den Vorgang
gestartet hat, bekommt den Einmalwert nie. Der Preis: Bestätigen geht nur im Browser desselben Rechners, auf dem der Launcher die
Anmeldung gestartet hat (nicht auf dem Handy, nicht auf einem zweiten Rechner).

**Grenze:** Auf einem Rechner, an dem mehrere Benutzer gleichzeitig angemeldet sind (Benutzerwechsel, Terminalserver), teilen sich
alle dieselbe Adresse `127.0.0.1`. Zwischen Benutzern desselben Rechners schützt der Rückkanal nicht: Der Knopf im Browser eines
Benutzers erreicht auch den Launcher eines anderen. Darum gilt der Warnsatz: Bestätigen nur, wenn man selbst gerade im eigenen
Launcher auf „Anmelden“ geklickt hat.

## 4 · Sitzung und Kontostand (Spec 6.1, 6.3)

Die Sitzung ist ein signiertes Token (`jm1.<payload>.<sig>`, HMAC-SHA256 mit dem Worker-Secret `KONTO_SCHLUESSEL`) mit dem
Kontostand: Stufe, Werkzeuge und iveo-Events für Externe, Zoom-Freigabe, JM-Rechner, Plattform. Sie gilt höchstens 30 Tage (ein laufender Launcher prüft ab 24 h vor dem Ende im Hintergrund neu, EP29); „Zugang
bis“ begrenzt nur den Start (ein laufender Launcher behält sie bis zum Neustart, Spec 6.3). Der Launcher speichert sie nur mit
safeStorage verschlüsselt in `settings.json` (ohne Schlüsselspeicher keine Anmeldung), den privaten Geräteschlüssel ebenso.

Bei jedem Start erneuert der Launcher die Sitzung im Hintergrund (`POST /konto/sitzung` mit Gerätebeweis). Der Worker liest dabei
den aktuellen Stand im Durable Object; was ein Admin geändert hat (Stufe, Sperre, Freigaben), wirkt damit beim nächsten Start (Zoom-Freigabe und Cloud-Raum wirken in Connect ab 0.5.0, EP34).
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
| Q&A extern, Connect-Cloud-Raum | ja | ja | nur mit dem Werkzeug |
| iveo (je Event) | jedes hinterlegte Event | jedes hinterlegte Event | nur mit Werkzeug iveo und für freigegebene Events |
| Zoom (nur Windows) | ja | ja | nur mit Zoom-Freigabe und auf einem JM-Rechner |
| Admin-Maske | ja | nein | nein |

## 6 · Routen des Workers

Reihenfolge in `fetch`: Health-Check, `/qa/*`, `/connect/*`, `/zoom-sdk`, `/zoom/jwt`, `/konto/*`, `/tools/launcher/latest` (ab 0.18.0 ohne Zugang, gebremst; EP32), dann
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
| POST `/konto/freigabe` | Sitzung | Freigabe für ein Tool (Zwecke `qa-relay`, `connect-raum`, `zoom-jwt`, `zoom-sdk`, je 72 h; Abschnitt 7) |
| GET `/konto/iveo` | Sitzung | erlaubte iveo-Tokens (nur in den Speicher des Launchers) |
| POST `/konto/zoom-anfrage` | Sitzung, nur Externe | Zoom anfragen |
| GET `/konto/admin/uebersicht` | Sitzung, Admin (aktueller Stand) | Daten der Admin-Maske |
| POST `/konto/admin/aktion` | Sitzung, Admin (aktueller Stand) | Admin-Aktion |
| POST `/zoom/jwt` | Freigabe `zoom-jwt` (Bearer), gedrosselt | Zoom-JWT für Connect (Abschnitt 14) |
| GET `/konto/anmelden` | öffentlich | Anmeldeseite (HTML) |
| POST `/konto/passwort` | öffentlich, gedrosselt, Bremse je Konto | Anmeldung mit E-Mail und Passwort bzw. Einladungscode |
| GET `/konto/google` | öffentlich | Weiter zu Google (PKCE) |
| GET `/konto/google/zurueck` | öffentlich | Rückkehr von Google |
| POST `/konto/bestaetigen` | Seitentoken | Code bestätigen (dann Seite mit Knopf, Formular an den Rückkanal auf `127.0.0.1`) oder abbrechen |

Die Seiten tragen `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*;
base-uri 'none'; frame-ancestors 'none'`, dazu `no-store`, `no-referrer` und `nosniff`, kein Cookie. `form-action` erlaubt
`http://127.0.0.1:*`, weil das Formular des Knopfs „Weiter zum Launcher“ dorthin geht. Das Absenden ist eine Navigation der ganzen
Seite an eine Loopback-Adresse: Chrome und Edge warnen davor nicht (die Warnung vor unsicheren Formularen gilt nur für Ziele, die
nicht „potentially trustworthy“ sind, `127.0.0.1` ist es), Firefox ebenso nicht (Ausnahme für Loopback), und die Prüfung „Local
Network Access“ gilt in Chrome heute nur für Abrufe und eingebettete Rahmen, in Firefox lässt sie Navigationen der ganzen Seite
durch. Für Safari gibt es dazu keinen Beleg; die Abnahme prüft es auf dem Mac. Ebenso unbelegt ist die optionale Safari-Einstellung
„Vor dem Verbinden mit einer Website über HTTP warnen“ (seit Safari 18.2; in den Safari-Einstellungen im Reiter „Sicherheit“,
englisch „Warn before connecting to a website over HTTP“). Mit ihr brach bei LocalWP eine Anmeldung über `http://localhost`
(https://community.localwp.com/t/problem-connecting-to-local-hub-when-using-safari-8-2/45678), und WebKit-Bug 284559
(https://bugs.webkit.org/show_bug.cgi?id=284559) beschreibt für `http://localhost` eine Sperre ohne Weiter-Knopf (seit 04.06.2026
als behoben markiert; was sich geändert hat, steht dort nicht). Ob sie auch bei `127.0.0.1` und bei einem Formular-POST warnt
oder blockiert, ist nicht belegt; die Abnahme prüft Schritt 2 auf dem Mac einmal mit eingeschalteter Option.

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
| `KONTO_RL_QAALT` | `7307` | 60 | Q&A-Admin-Routen mit dem alten Schlüssel, vor dem Aufruf des Konten-DO (Z3) |
| `KONTO_RL_CONNECTALT` | `7308` | 20 | `/connect/:raum` (Öffnen, Schließen) mit dem alten Schlüssel, vor der Inhaber-Prüfung im Konten-DO (Teil 2) |
| `KONTO_RL_ZOOMJWT` | `7309` | 30 | POST `/zoom/jwt` (Teil 2) |

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
unterscheiden. Darum sind Freigaben eng (Zweck, Ziel, 72 h) und protokolliert (Owner-Frage OFP9). Teil 2 ergänzt nur Zwecke, je 72 h
(`FREIGABE_MS`), App-ID `jm-connect`:

| Zweck | Funktion | Ziel | JM-Prüfung |
| --- | --- | --- | --- |
| `connect-raum` | `connect-raum` (Gruppe `connect`) | die Raum-ID (`^[A-Za-z0-9_-]{6,64}$`) | nein |
| `zoom-jwt` | `zoom` | fest `meeting-sdk` | nein (Externe brauchen Zoom-Freigabe und JM-Rechner, Abschnitt 5) |
| `zoom-sdk` | `zoom` | fest `win-x64` | ja, für alle Stufen: nur auf JM-Rechnern |

Die JM-Prüfung für `zoom-sdk` läuft beim Ausstellen auf beiden Seiten (`zweckDarf` im Launcher in `freigaben.ts`, am Worker in
`/konto/freigabe`), weil die Freigabe-Claims `{v, typ, zweck, ziel, kid, gid, iat, exp}` kein `jm` tragen. Auf einem Rechner ohne
JM-Markierung antwortet der Launcher mit `{ grund: 'kein-recht', detail: 'kein-jm-rechner' }`; daran erkennt Connect den Fall.

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
  Q&A bis `ALTKEY_BIS` (Worker-Variable, ISO-Datum). Fehlt sie oder ist sie unlesbar, gilt er unbefristet, und der Reiter „Geräte“ zeigt das.
  An den Q&A-Admin-Routen gilt er nur für Events ohne Inhaber und je IP höchstens 60-mal je Minute (`KONTO_RL_QAALT`), bevor er
  den Konten-DO erreicht; hat ein Event einen Inhaber, weist der Worker ihn mit 403 ab (EP33). Inhaber ist die erste Freigabe, die
  das Event nutzt: Konto und Rechner, nur als Hash, im Konten-DO in der EU, gesetzt per Compare-and-set (Z3). Er gilt mindestens bis
  zum Ende der Aufbewahrung des Events, höchstens 30 Tage; Einreichungen leben höchstens 60 Sekunden länger als das Event
  (Mindestdauer von KV). Für Connect
  (`PROXY_KEY` an `/connect`, `ZOOM_SDK_KEY` an `/zoom-sdk`) gilt er bis `ALTKEY_CONNECT_BIS`; `connect-relay.js` prüft wie die
  übrigen Routen über `zugangPruefen` (Vergleich in konstanter Zeit). `ALTKEY_CONNECT_BIS` ist noch nicht gesetzt (leer heißt
  unbefristet); er wird erst nach dem Release von Connect 0.5.0 in einem eigenen Schritt mit Owner-OK gesetzt. Der Reiter
  „Geräte“ zählt Anfragen mit dem alten Schlüssel je Tag, Gruppe und Plattform (ohne IP-Adressen). Seit Z1 zählt die Anzeige
  höchstens einen Aufruf je IP-Hash, Tag und Gruppe (der Worker merkt sich den Schlüssel `Tag|Gruppe|IP-Hash` im Isolat, bis zu
  1000 Stück); die Zahl ist also eine Näherung für die Zahl der Anschlüsse, nicht der Anfragen. Fehlt `PROXY_KEY` am Worker oder
  ist er leer, antwortet der Worker auf einen mitgeschickten alten Schlüssel mit 503 (Text S5, Code `nicht-eingerichtet`) statt
  mit 401 (Z2, AR85): Q&A löscht seinen Key nur bei 401 `nicht-angemeldet` und behält ihn so bei einem Deploy ohne das Secret.
- **Selbst-Update.** `/tools/launcher/latest` liefert ein Release ab 0.18.0 auch ohne Zugang (60 s Zwischenspeicher, Drossel je IP; EP32), ältere Releases nur mit Sitzung oder altem Schlüssel; alte Launcher aktualisieren sich darum auch nach `ALTKEY_BIS` selbst auf 0.18.0 oder neuer.
- **Bau ohne Schlüssel.** Seit Launcher 0.18.0 backt der Bau keinen Schlüssel mehr ein (kein `define`, kein `JMPS_PROXY_KEY` in
  `suite-release.yml` und `suite-build.yml`). Connect 0.5.0 hält keinen Dienst-Schlüssel mehr, nur im Übergang einen alten, den
  es anzeigt und entfernt (Abschnitt 14).
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
`wrangler.toml`. Secrets: `KONTO_SCHLUESSEL`, `IVEO_SCHLUESSEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` (Teil 2, Abschnitt 14), `ERSTER_ADMIN` (E-Mail
des ersten Admins, ein Google-Konto von `jakobsmedien.com`; er lässt sich in der Maske weder herabstufen noch sperren und zählt ab seiner ersten Anmeldung, eine andere Adresse wirkt nicht). Den Google-Client legt der Owner im Workspace
`jakobsmedien.com` als intern an (Redirect `/konto/google/zurueck`). Ablauf, Trockenlauf und Reihenfolge (Worker vor dem
Launcher-Release) stehen im Plan unter „Nach der Umsetzung“ und in `services/release-proxy/README.md`.

**Rate-Limit-Bindungen.** Die neun `[[ratelimits]]`-Einträge (Abschnitt 6) verlangen wrangler ab 4.36.0. Ihre `namespace_id` 7301
bis 7309 müssen im Cloudflare-Konto eindeutig sein: Eine Zahl, die dort schon für eine andere Rate-Limit-Bindung vergeben ist, würde
deren Zähler teilen. Die Bauprobe (`tools/bauprobe.mjs`) und der Wächter in `konto-zugang.test.mjs` kennen genau diese neun Einträge.

## 12 · Datenschutz und Protokoll (Spec 9, 11)

Konten, Geräte, Anfragen und iveo-Tokens liegen im Durable Object in der EU. Das Protokoll hält je Admin-Aktion und je
automatisch angelegtem Konto Zeit, Wer, Was und Wen fest, ohne Passwort, Hash, Code oder Token, 12 Monate lang, auch für
gelöschte Zugänge. Gelöschte Zugänge von Externen sind weg; Google-Konten werden gesperrt (aufhebbar).

## 13 · Tests

| Lauf | Befehl |
| --- | --- |
| Worker | `node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs` (ebenso `konto-krypto`, `konto-do`, `konto-zugang`, `konto-routen`, `qa-relay`, `connect-zugang`, `connect-do`, `zoom-jwt`, `worker`) |
| Worker-Bauprobe | `node services/release-proxy/tools/bauprobe.mjs` |
| Launcher (rein) | `npm run selftest:konto -w @jm/launcher` |
| Launcher (Wächter) | `npm run selftest -w @jm/launcher` |
| App-Laufzeit (Freigabe-Client) | `npm run selftest -w @jm/app-runtime` |
| Q&A | `npm run selftest -w @jm/qa` |
| Connect (Teil 2) | `npm run selftest -w @jm/connect` (rund 170 s); einzeln `cd apps/connect && npx tsx test/<datei>.test.ts` |

Alle Tests laufen ohne Netz und ohne Cloudflare: Der Durable Object ist eine Klasse mit einer Attrappe von `ctx.storage`, Google,
GitHub und Anthropic kommen über eine `fetch`-Attrappe, echte Sockets nur auf `127.0.0.1`.

## 14 · Teil 2: Connect über die Anmeldung

Entwurf: `docs/superpowers/specs/2026-11-20-anmeldung-teil2-design.md`. Plan: `docs/superpowers/plans/2026-11-20-anmeldung-teil2.md`
(dort die Entscheidungen E1 bis E10 und die Preflight-Rulings P1 bis P10). Versionen: Launcher 0.19.0, Connect 0.5.0; der Worker
hat keine Version. Stand 21.11.2026: gebaut auf `feat/anmeldung-teil2`; der Worker ist am 21.11. aus diesem Branch deployt (Version afef3999), Launcher 0.19.0 und Connect 0.5.0 sind nicht veröffentlicht. Reihenfolge der
Veröffentlichung, je mit Owner-OK: Worker-Deploy (abwärtskompatibel), dann Launcher 0.19.0, dann Connect 0.5.0.

**Zwecke und Ziele.** Die Tabelle steht in Abschnitt 7. Connect holt je Zweck eine Freigabe beim Launcher (`connect-raum` je
Raum-ID, `zoom-jwt` mit dem Ziel `meeting-sdk`, `zoom-sdk` mit dem Ziel `win-x64`) und schickt sie als `Authorization: Bearer` an
den Worker. Reihenfolge des Zugangs: gültige Freigabe für genau dieses Ziel, sonst der alte Key (nur im Übergang), sonst keiner.
`zweckDarf(stand, zweck, { jetzt })` gibt `ja`, `kein-recht` oder `kein-jm-rechner` zurück, zweimal gebaut (Worker in
`konto-kern.js`, Launcher in `src/shared/konto.ts`) und an der gemeinsamen Falltabelle `services/release-proxy/test/zweck-faelle.json`
geprüft (E1). `FUNKTIONEN` und `darf` sind unverändert.

**Raum-Bindung (E3).** Die Raum-ID ist öffentlich; darum gehört der Cloud-Raum der Freigabe (Konto und Rechner, nur als Hash mit
eigenem Präfix), die ihn zuerst öffnet. Der Konten-DO hält das mit der Aktion `connect-inhaber` (Compare-and-set, Muster
`qa-inhaber`). Die Bindung gilt 25 Stunden ab der letzten Nutzung (Raum-Verfall 24 Stunden plus 1 Stunde Puffer, höchstens 30
Tage) und endet mit „Raum schließen“ des Inhabers. Ein anderes Konto bekommt 403 mit dem Code `raum-vergeben` (E2). Der alte
Schlüssel öffnet nur einen freien Raum und bindet nie; einen gebundenen Raum öffnet er nicht. Fällt die Prüfung im Konten-DO aus,
antwortet der Worker mit 503 `nicht-eingerichtet`, nie mit einem offenen Raum.

**`POST /zoom/jwt` (E4, E5, E9).** Nur eine Freigabe mit Zweck `zoom-jwt` und Ziel `meeting-sdk` (weder Sitzung noch `zoom-sdk`),
eigene Drossel `KONTO_RL_ZOOMJWT` (30 je 60 s und IP, E6). Der Worker signiert HS256 mit `ZOOM_CLIENT_ID` und
`ZOOM_CLIENT_SECRET`: Kopf `{"alg":"HS256","typ":"JWT"}`, Nutzlast `{"appKey","iat","exp","tokenExp"}` in dieser Reihenfolge,
`iat` = ⌊jetzt s⌋ − 30, `exp` = `tokenExp` = `iat` + 43 200 (12 h), kein `mn`, keine `role`; die Ausgabe ist byte-gleich zu
`buildJwt` in `packages/zoom-bridge/src/jwt.ts` (Test `zoom-jwt.test.mjs`). Antwort: `200 { jwt, exp, gueltigS }` mit `exp` in
Unix-Sekunden und `gueltigS` = `exp` − ⌊jetzt s⌋, dazu `cache-control: no-store`. Optional nimmt die Route den JSON-Rumpf
`{ "ttlS": n }` mit ganzer Zahl `n` von 1800 bis 43 200 und stellt das JWT dann mit kürzerer Laufzeit aus (so wird der Owner-Test
M4 „stört ein abgelaufenes JWT ein laufendes Meeting?“ ausführbar, ohne ein Secret auf dem PC); ohne Rumpf oder ohne `ttlS` gelten
43 200. Jeder andere Wert (keine ganze Zahl, außerhalb 1800 bis 43 200) und jeder Rumpf, der kein JSON-Objekt ist, ergibt 400 mit dem Code `ungueltige-laufzeit`. Eine
kürzere Laufzeit gibt einem Freigabe-Inhaber nichts zusätzlich. Fehlen die Secrets oder haben sie Leerraum, antwortet die Route mit
503 `nicht-eingerichtet`. Das Protokoll läuft über die DO-Aktion `zoom-jwt-protokoll` per `ctx.waitUntil`, best effort: es hält nur
Konto und Rechner (`kid`, `gid`) und die Zeit fest, nie das JWT; fällt der Konten-DO aus, gibt es das JWT trotzdem, mit einer
Warnung im Log.

**Worker-Secrets und Stichtag.** Neu sind `ZOOM_CLIENT_ID` und `ZOOM_CLIENT_SECRET` (nur als Secret, nie in `[vars]`; kein neuer
Name mit `ZOOM_SDK_`). `PROXY_KEY` und `ZOOM_SDK_KEY` bleiben bis zum Stichtag. Die neue Drossel `KONTO_RL_CONNECTALT` (20 je 60 s)
gilt nur für den alten Schlüssel an `/connect`. Die Alt-Key-Zählung im Reiter „Geräte“ kennt die Gruppe `connect`.

**Module in Connect (`apps/connect/src/main`).**

| Datei | Aufgabe |
| --- | --- |
| `zugang/regeln.ts` | rein (nur Typ-Importe): Zwecke, Konstanten (`ERNEUERN_VOR_MS` 24 h, `FREIGABE_ABSTAND_MS` 30 s), Wahl des Zugangs, Anzeigelage und alle Texte der Zeilen „Cloud-Zugang“ und „Zoom-Anmeldung“ |
| `zugang/halter.ts` | holt je Zweck eine Freigabe beim Launcher, hält und erneuert sie, löscht die Altlasten genau einmal; zur Laufzeit nur Importe aus `./regeln`; keine Logzeile nennt eine Freigabe |
| `zugang/huelle.ts` | Electron-Hülle des Halters: verschlüsselte Datei `connect-zugang.bin` über safeStorage, Anbindung an die Einstellungen |
| `zoom/jwt-quelle.ts` | Quelle des Zoom-JWT: nur im RAM, vor dem Start der Bridge geholt, erneuert bei weniger als 2 h Rest (`7_200_000` ms, gemessen an `gueltigS` der Worker-Antwort, nicht an `exp` gegen die lokale Uhr); die alten lokalen Zugangsdaten nur als Rückfall im Übergang |
| `raum-id.ts` | bereinigt die Raum-ID und füllt kurze auf (N4, E8): 1 bis 5 Zeichen werden `‹id›-‹die ersten 6 Hex-Zeichen von SHA-256(id)›`, leer bleibt leer, ab 6 Zeichen unverändert |

Der Live-Betrieb hängt nie am Launcher: gehaltene Freigaben gelten weiter, ein Wiederbeitritt nutzt das JWT aus dem RAM, und ein
Neustart von Connect nutzt die gehaltene Freigabe.

**Übergang und OT9 (E7, E10).** Alte Werte (Proxy-Key, Zoom-Zugangsdaten, SDK-Schlüssel) trägt Connect 0.5.0 nirgends mehr ein; die
Zeilen dafür erscheinen nur, solange ein alter Wert da ist, und bieten nur Entfernen. Die Altlasten fallen einmal, je mit einem
Hinweis: `proxyKeyEnc` nach der ersten gültigen `connect-raum`-Freigabe, `zoomSdkKeyEnc` nach dem ersten Link mit Freigabe,
`zoomZugangEnc` nach dem ersten `auth` mit Code 0 und Server-JWT. Lehnt der Worker einen alten Schlüssel mit 401 `nicht-angemeldet`
oder `alter-key-abgelaufen` ab, löscht Connect ihn ebenfalls (nach dem Stichtag kein Rückfall). **Das gemerkte Meeting bleibt (N1):**
`zoomLetzteNummer` und `zoomLetzterKenncodeEnc` (Connect 0.4.2, #290) sind Meeting-, keine Dienst-Geheimnisse und werden nie
gelöscht; der Nachweis „kein dauerhaftes Geheimnis“ prüft `proxyKeyEnc`, `zoomZugangEnc` und `zoomSdkKeyEnc`. Connect 0.5.0 mit
Launcher 0.18.0 (`unbekannter-zweck`) oder ohne passenden Launcher zeigt „Launcher aktualisieren“ und nutzt im Übergang den alten
Weg, solange ein alter Key oder alte Zugangsdaten da sind. Auf einem Rechner ohne JM-Markierung sagt nur „Zoom-SDK laden“ ab und
nennt den Weg „SDK-Ordner wählen“ (N2); Zoom selbst geht dort, wo das Recht gilt.

**Entwicklungsvariablen in Connect.** Sie bleiben für Entwicklung und Test und erscheinen als Diagnose („Entwicklungsmodus: …“);
nach dem Übergang gibt es keinen Rückfall auf lokale Geheimnisse.

| Variable | Wirkung |
| --- | --- |
| `JMPS_PROXY_KEY` | alter Proxy-Key für den Cloud-Raum (hat Vorrang vor dem gespeicherten, Herkunft `env`) |
| `ZOOM_SDK_CLIENT_ID`, `ZOOM_SDK_CLIENT_SECRET` (oder `ZOOM_SDK_CREDENTIALS`) | alte lokale Zoom-Zugangsdaten, nur als Rückfall für ein lokal signiertes JWT |
| `JMPS_ZOOM_SDK_KEY` | alter Schlüssel für „Zoom-SDK laden“ |
| `JMPS_ZOOM_JWT_TTL_S` | ganze Zahl 1800 bis 43 200: Connect schickt sie als `ttlS` an `POST /zoom/jwt`; dann liegt kein JWT im RAM und es gibt keinen Erneuerungs-Zeitgeber, jeder Bedarf holt neu. Connect signiert damit nie lokal. |

Die Namen der ersten drei Zeilen stehen in der Liste `GEHEIM` in `zoom/kern.ts`; sie werden aus der Umgebung des Bridge-Prozesses entfernt.

**Tests je Datei.** Worker: `services/release-proxy/test/connect-zugang.test.mjs` (Cloud-Raum, Raum-Bindung, alter Schlüssel),
`zoom-jwt.test.mjs` (Signatur byte-gleich, `/zoom/jwt`, `ttlS`), `zweck-faelle.json` (Falltabelle von `zweckDarf`, gelesen von
`konto-kern.test.mjs` und `konto-rechte.test.ts` im Launcher), `worker.test.mjs`, `connect-do.test.mjs`.
Launcher: `apps/launcher/test/konto-rechte.test.ts` (`zweckDarf`) über `npm run selftest:konto -w @jm/launcher`. Connect
(`npm run selftest -w @jm/connect`): `zugang-regeln.test.ts`, `zugang-halter.test.ts`, `raum-zugang.test.ts` (Raum-ID und Cloud-Raum
mit Freigabe), `jwt-quelle.test.ts`, `zoom-laufzeit.test.ts`, `zoom-teile.test.ts`, `zoom-kern.test.ts`, `zoom-settings.test.ts`,
`sdk-laden.test.ts` und die übrigen Dateien der Liste in `apps/connect/package.json`.

### Admin-Freigabe gebundener Cloud-Räume (Nachtrag 21.11.)

Stand wie oben: Worker deployt, Launcher und Connect nicht veröffentlicht. Der Nachtrag klärt, was geschieht, wenn jemand Connect ohne „Raum schließen“ beendet: Die Bindung hielte den Raum sonst bis zu 25 Stunden fest.

**Bindung.** Sie speichert jetzt `{ kidHash, gidHash, bis, raumId, kid, seit }`. `raumId` und `kid` stehen im Klartext, `seit` ist der Zeitpunkt der ersten Bindung. Eine Verlängerung behält `raumId` und `seit`; `kid` nennt das Konto, das zuletzt geöffnet hat. Damit ist die frühere Festlegung „nur Hashes, nie die ID selbst“ für Connect aufgehoben, denn ohne Raum-ID kann der Admin den Raum nicht erkennen. Raum-ID und `kid` sind keine Geheimnisse; Freigabe, Sitzung, Schlüssel und die Hashes `kidHash` und `gidHash` bleiben draußen. Q&A (`qa-inhaber`) speichert weiter nur `{ kidHash, gidHash, bis }`.

**`admin-uebersicht`** liefert zusätzlich `raeume`: nur gültige Bindungen, je `{ raumHash, raumId, name, stufe, seit, bis }`, nie die Hashes der Freigabe. Ist das Konto gelöscht, sind `name` und `stufe` `null`.

**`raum-freigeben { raumHash }`** (Admin) löscht die Bindung und antwortet `{ ok: true, warFrei }`; `warFrei` ist `true`, wenn es keine gültige Bindung mehr gab (abgelaufen, schon freigegeben, zweiter Admin). Ein ungültiger `raumHash` ergibt 400 `ungueltig`, fehlendes Recht 403 `kein-recht`. Jede Freigabe schreibt einen Protokolleintrag `{ was: 'raum-freigeben', wen: raumId, details: { raumHash, raumId, kid, warFrei } }`, auch die zweite desselben Raums. Hat nach der Freigabe ein anderer den Raum geöffnet und drückt der alte Inhaber danach „Raum schließen“, bekommt er 403 `raum-vergeben`, und der neue Inhaber behält den Raum. Die Freigabe löst nur die Bindung; sie trennt keine Gäste und schließt keinen laufenden Raum.

**Launcher (0.19.0).** Der Reiter „Geräte“ der Admin-Maske hat den Abschnitt „Cloud-Räume (Connect)“ (RF1 bis RF9). Jede Zeile zeigt Raum-ID, Name, Stufe und Ende der Bindung (RF4, ohne Konto RF5) und den Knopf „Freigeben“. Davor fragt der Launcher zurück (RF7, ohne Konto RF7a). Fehlt `raeume` in der Antwort, zeigt der Launcher den Abschnitt nicht; ist `raeume` kein Array, lehnt `worker-client` die Übersicht als Serverfehler ab.

**Connect (0.5.0).** CZ8 nennt die Raum-ID und den Admin-Weg (`ZUGANG_TEXT.raumVergeben(raumId)` in `regeln.ts`). Die Texte stehen in `docs/anmeldung-teil2-texte.md`, Abschnitt „Nachtrag 21.11. Admin-Freigabe“; die Abnahme in `apps/connect/ABNAHME-0.5.0.md`, Zeilen 7 und 7b.
