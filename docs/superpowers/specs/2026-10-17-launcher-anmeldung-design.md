# Anmeldung im Launcher: Konten, Stufen und Freigaben statt Keys

**Status:** **Vom Owner freigegeben am 17.10.2026** („passt“ auf die ganze Spec samt den Vorgaben zu OF1–OF4). Entstanden im Brainstorming 17.10.2026 (Owner hat die Teile „Wer, Stufen, Verwaltung“, „Admin-Maske, Betrieb“, Bestätigungscode und Anzeige sowie die Antworten auf die Fragen der Bau-Prüfung mit „passt“ bestätigt). Geplant wird, wenn die Anmeldung an der Reihe ist; dann wird diese Spec gegen den aktuellen Stand nachgemessen (iveo-Paket und Connect 0.4.0 ändern Teile, die hier ersetzt werden).
**Datum:** 17.10.2026
**Basis:** `main` @ `a9553defe7` (Launcher 0.15.0, Connect 0.3.0, Q&A wie released, Titler 0.12.0).
**Reihenfolge (Owner 17.10.2026):** iveo-Paket → Connect-Slot-Spec (Connect 0.4.0) → **diese Anmeldung** → UX-Welle 1.
**Bestandsaufnahme:** Was die Tools heute an Keys verlangen, ist am Code erhoben (Abschnitt 3); die Fundstellen sind dort genannt und vor dem Plan nachzumessen.

---

## 1 · Warum

Die Einrichtung ist für die Kollegen zu komplex. Wer Connect mit Cloud-Raum und Zoom nutzen will, muss heute einen Proxy-Key, Client-ID und Client-Secret der Zoom-App, einen SDK-Schlüssel und je Event ein iveo-Token beschaffen und eintragen. Ziel des Owners: **Man meldet sich einmal im Launcher an, und die Tools haben, was sie brauchen.**

Zwei Nebeneffekte, die die Lösung ausdrücklich mitbringen soll:
- **Echter Zugangsschutz.** Alle Cloud-Funktionen hängen heute an einem einzigen gemeinsamen `PROXY_KEY`. Er ist zur Build-Zeit in den Launcher eingebacken und steckt damit in jedem Launcher-Installer (`apps/launcher/src/main/settings.ts:33-38`, `apps/launcher/electron.vite.config.ts:29-33`, `.github/workflows/suite-release.yml:71-74`, `services/release-proxy/worker.js:20-21`). Er schützt deshalb kaum.
- **Zugänge aus der Ferne vergeben und entziehen.** Heute gibt es keine Konten (einzige Ausnahme: lokale Benutzer in Studio Control), also auch nichts zu entziehen.

## 2 · Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Kollegen und freigegebene Externe melden sich im Launcher an; danach trägt niemand mehr einen Proxy-Key, Zoom-Zugangsdaten, einen SDK-Schlüssel, ein GitHub-Token oder ein iveo-Token ein.
- Drei Stufen mit unterschiedlichen Rechten (Abschnitt 5), verwaltet von Admins in einer Admin-Maske im Launcher (Abschnitt 7).
- Der gemeinsame `PROXY_KEY` verschwindet nach einer Übergangszeit (Abschnitt 10).

**Nicht-Ziele**
- Tools ohne Keys (Titler, Timer, Rundown, Presenter, Prompter, Battle, Caption, Recorder, Transcribe, Stage-Display u. a.) bekommen **keine** Anmeldepflicht; sie starten wie heute.
- Unverändert lokal bleiben: Meeting-Nummer und Kenncode (je Meeting, nie gespeichert), die Zoom-SDK-Dateien je Rechner (rund 315 MB), Anzeigename und Bild-Versatz in Connect, Raum-Secrets und Gast-Links von Connect, das Q&A-Schlüsselpaar (Blind-Relay, privater Schlüssel bewusst lokal) und der Presse-Code, OBS-Passwort, RTMP-Streamkey, ATEM-/TriCaster-Adressen, die sichere Steuerebene (`control.json`) mit Companion-Kopplung und die Master-Link-Kopplung.
- Keine Anmeldung in den Tools selbst; angemeldet wird nur im Launcher.

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- **Der Live-Betrieb hängt nie an der Anmeldung.** Eine laufende Sitzung wird nie unterbrochen: nicht durch Ablauf, nicht durch Entzug, nicht durch ausfallendes Internet oder einen ausgefallenen Server.
- Auf den Rechnern liegen keine dauerhaften Geheimnisse wie das Zoom-Client-Secret oder iveo-Tokens. Sonst könnte man einem gelöschten Zugang nicht mehr wegnehmen, was schon auf seinem Rechner liegt.
- Die Einrichtung wird nicht komplizierter als heute, auch nicht für Externe.

## 3 · Was heute eingetragen wird und was die Anmeldung ersetzt

| Heute | Wo (Bestand) | Künftig |
| --- | --- | --- |
| Proxy-Key für den Cloud-Raum in Connect | Karte „Cloud-Zugang“, `apps/connect/src/renderer/src/App.tsx:375-380`, `:437-446`; Speicher `proxyKeyEnc` in `apps/connect/src/main/settings.ts:30-44` | entfällt; Connect nutzt die Sitzung des Launchers |
| Zoom Client-ID und Client-Secret | `apps/connect/src/renderer/src/zoom/ZoomCard.tsx:114-135`, `:646-655`; Speicher `zoomZugangEnc`; JWT lokal signiert in `packages/zoom-bridge/src/jwt.ts:23-35`, Laufzeit 12 h `apps/connect/src/main/zoom/fristen.ts:20` | entfällt; **der Server signiert das Zoom-JWT** und Connect bekommt nur das JWT (Abschnitt 6.3) |
| SDK-Schlüssel für „Zoom-SDK laden“ | `ZoomCard.tsx:186-198`, `:598-630`; Header `X-Zoom-Sdk-Key` in `apps/connect/src/main/zoom/sdk-laden.ts:124-149` | entfällt; das Laden prüft die Sitzung und die Zoom-Berechtigung |
| SDK-Ordner wählen | `ZoomCard.tsx:554-563` | bleibt als Weg ohne Netz; „Zoom-SDK laden“ wird der Normalfall |
| Proxy-URL und Proxy-Key in Q&A | `apps/qa/src/renderer/src/components/Settings.tsx:97-142`; `apps/qa/src/main/cloud.ts:30-73` | entfällt; Vorgabe-URL, Sitzung des Launchers |
| GitHub-Token im Launcher | `apps/launcher/src/renderer/src/components/SettingsModal.tsx:46-47` | entfällt |
| Katalog, Installieren, Updates | über den eingebackenen `PROXY_KEY` | nur mit Anmeldung; **Ausnahme:** das Update des Launchers selbst geht immer, auch ohne Anmeldung (Abschnitt 9.1) |
| iveo-Token je Event | Show-Editor, `apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:441-455`; Speicher `iveoTokensEnc` | ein Admin hinterlegt es einmal auf dem Server; der Launcher bekommt es nach der Anmeldung nur in den Speicher |
| Proxy-, Katalog-, iveo-Basis-URL | Launcher-Einstellungen | zentrale Vorgaben; Eintragen nur noch für Entwicklung und Fehlersuche |

Die heutigen Wege über Umgebungsvariablen (`JMPS_PROXY_KEY`, `ZOOM_SDK_CLIENT_ID` usw.) bleiben für Entwicklung und Tests erhalten, solange sie keine Hintertür für den Betrieb sind (Entscheidung des Planers, Abschnitt 12).

## 4 · Wer sich anmeldet (Owner-Entscheid)

- **Kollegen von Jakobs Medien** melden sich mit ihrem **Google-Firmenkonto** an (Google gibt es firmenweit). Zugelassen sind nur Konten der Domain `jakobsmedien.com` mit bestätigter E-Mail (einzige Domain, Owner 17.10.2026). Jedes solche Konto wird bei seiner **ersten Anmeldung automatisch „Kollege“**; niemand muss Kollegen vorher anlegen. Wer bei Jakobs Medien ausscheidet und sein Google-Konto verliert, kann sich nicht mehr anmelden.
- **Stufe und Anmeldeart sind unabhängig:** Ein Admin kann auch ein Google-Konto auf „Externer“ herabstufen (dann gelten dessen Einschränkungen aus Abschnitt 5) oder zum Admin machen.
- **„Zugang löschen“ bei einem Google-Konto sperrt es dauerhaft** (Zustand „gesperrt“), sonst wäre es bei der nächsten Anmeldung automatisch wieder „Kollege“. Ein Admin kann die Sperre aufheben. Bei Externen löscht „Zugang löschen“ das Konto.
- **Kunden bekommen keinen eigenen Zugang** (Owner 17.10.2026). Auf einem Rechner beim Kunden installiert und aktualisiert ein angemeldeter Kollege oder Externer; Tools ohne Keys laufen dort wie überall ohne Anmeldung.
- **Ausgewählte externe Techniker** melden sich mit **E-Mail und Passwort** an (Owner-Entscheid). Ohne Mailversand (Vorschlag, als Entscheidung des Entwurfs):
  - Ein Admin legt den Externen in der Admin-Maske an und bekommt einen **Einladungscode** angezeigt, den er dem Externen auf eigenem Weg gibt (z. B. Chat).
  - Bei der ersten Anmeldung setzt der Externe damit sein Passwort. Hat er es vergessen, erzeugt ein Admin einen neuen Code; das alte Passwort gilt dann nicht mehr.
  - Der Server speichert nur einen langsamen, gesalzenen Hash. Fehlversuche werden gebremst.
- Angemeldet wird **nur im Launcher**. Die Tools holen ihre Freigaben über den Launcher (Abschnitt 6.2).

### 4.1 Ablauf der Anmeldung mit Bestätigungscode (Owner-Entscheid: Variante A)

1. Im Launcher „Anmelden“. Der Launcher öffnet im **System-Browser** die Anmeldeseite der Suite (beim Worker) und zeigt selbst einen Dialog „Im Browser anmelden“ mit einem **kurzen Code** aus sechs Zeichen, z. B. `K7P-42X` (gut vorzulesen, ohne verwechselbare Zeichen wie 0/O oder 1/I). Der Dialog sagt: „Der Browser zeigt gleich denselben Code. Bestätige dort nur, wenn er übereinstimmt.“ Dazu „Abbrechen“, die Gültigkeit (Vorschlag: 5 Minuten) und „Adresse kopieren“, falls der Browser nicht aufgeht.
2. Auf der Anmeldeseite meldet man sich an: Kollegen mit Google, Externe mit E-Mail und Passwort (beim ersten Mal mit Einladungscode). Beide Anmeldearten laufen über dieselbe Seite.
3. Danach zeigt die Seite: „Angemeldet als ‹E-Mail›“, „Zeigt dein Launcher diesen Code?“, den Code, den **Rechnernamen** und die Knöpfe „Ja, das ist mein Rechner“ und „Nein, abbrechen“.
4. Erst nach „Ja, das ist mein Rechner“ ist der Rechner angemeldet; der Launcher schließt den Dialog von selbst. „Nein, abbrechen“ oder Ablauf der Frist verwirft den Vorgang auf beiden Seiten.

Zweck: Man gibt nie versehentlich einen fremden Rechner frei, etwa wenn jemand einen Anmeldelink weitergeleitet hat.

### 4.2 Anzeige „angemeldet als …“ (Owner-Entscheid)

- Oben rechts im Launcher: ein Kreis mit **Initialen** (kein Foto), Name und Stufe, z. B. „Maria S. · Kollege“. Die **Farbe des Kreises zeigt die Stufe** (Admin, Kollege, Externer; Farben aus den Tokens des UX-Fundaments, mit Text, nicht nur über Farbe). Nicht angemeldet: „Anmelden“ an derselben Stelle.
- Klick darauf: Konto (Name, E-Mail, Anmeldeart), Stufe, „Angemeldet seit …“, dieser Rechner (Name, ob JM-Rechner), „Abmelden“; bei Externen zusätzlich „bis ‹Datum›“ und „Zoom anfragen“ bzw. der Stand der Anfrage.
- Ohne Internet: „offline, Anmeldung gültig bis ‹Datum›“. Ist die Anmeldung abgelaufen oder beim letzten Start entzogen worden, sagt die Anzeige das mit Grund und dem Weg („Neu anmelden“ bzw. „Zugang bei einem Admin anfragen“).

## 5 · Stufen (Owner-Entscheid)

| Stufe | Darf |
| --- | --- |
| **Admin** | alles, dazu die Admin-Maske: Zugänge, Stufen, iveo-Tokens, Anfragen, Geräte |
| **Kollege** | alle Tools mit Anmeldung, auch Zoom; alle iveo-Events, deren Token hinterlegt ist |
| **Externer Techniker** | nur die Tools und iveo-Events, die ein Admin ihm einzeln auswählt; mit Ablaufdatum („Zugang bis“). **Zoom nur zeitweise:** Er fragt im Launcher an, ein Admin gibt für einen Zeitraum frei, danach erlischt die Freigabe von selbst |

Auswählbare Tools für Externe (Stand heute): Connect (Cloud-Raum), Connect (Zoom, nur über Anfrage), Q&A (Cloud-Relay), iveo im Launcher. Katalog, Installieren, Updates, Kochbuch und Feedback hat jeder angemeldete Externe ohne Auswahl (9.1). Kommt ein weiteres Tool mit Server-Teil dazu, erscheint es in dieser Liste.

**Zoom für Externe und die Zoom-Bedingungen.** Das Zoom-SDK ist nach den Zoom-Bedingungen (ToU §6.1) nur für internen Geschäftsgebrauch erlaubt, und der Owner hatte entschieden, dass das SDK nur auf JM-eigene Rechner kommt (`docs/superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md:12-31`). Bis der Owner das rechtlich geklärt hat, gilt: **Ein Externer bekommt Zoom nur auf einem Rechner, den ein Admin als JM-Rechner markiert hat** (Abschnitt 7, Reiter „Geräte“). Kollegen dürfen Zoom auf jedem Rechner, auf dem sie angemeldet sind; ob auch das auf JM-Rechner zu begrenzen ist, ist Owner-Frage OF1.

## 6 · Betrieb

### 6.1 Anmelden, Gültigkeit, Offline (Owner-Entscheid)

- Angemeldet wird **einmal mit Internet**. Die Anmeldung gilt danach bis zum **nächsten Start des Launchers**; erst dann prüft der Server das Konto wieder (Owner 17.10.2026). **Der Stand des Kontos wird beim Start des Launchers festgehalten:** Stufe, Tools, iveo-Events, Zoom-Freigabe und Ablauf gelten so, wie sie beim Start waren, bis der Launcher neu startet.
- **Ein Neustart eines Tools prüft nicht neu.** Startet Connect oder Q&A neu, etwa nach einem Absturz mitten in der Show, übernimmt es den festgehaltenen Stand des laufenden Launchers und arbeitet weiter, auch wenn der Zugang inzwischen entzogen ist.
- **Obergrenze 30 Tage:** Läuft ein Launcher länger als 30 Tage ohne Neustart, prüft er beim nächsten Bedarf einer Freigabe neu; eine schon laufende Verbindung (Raum, Meeting) bricht dabei nicht ab. Bis dahin bekommt auch ein entzogener Nutzer auf diesem Rechner neue Räume, Meetings und iveo-Events (bewusst so, Owner 17.10.2026).
- Startet ein Rechner **ohne Internet**, arbeitet er mit der letzten Anmeldung weiter, wenn sie **höchstens 30 Tage** zurückliegt; bei Externen höchstens bis zu ihrem Ablaufdatum. Was ohnehin den Server braucht (Cloud-Raum, Zoom, iveo, Katalog), geht ohne Internet sowieso nicht; die 30 Tage betreffen den Start und die Anzeige „angemeldet als …“.
- Ein Rechner kann gleichzeitig nur ein angemeldetes Konto haben; Abmelden ist jederzeit möglich (Vorschlag des Entwurfs).

### 6.2 Wie die Tools ihre Freigaben bekommen

Der Launcher ist der einzige Halter der Sitzung (wie heute schon für iveo, `apps/launcher/src/main/settings.ts:168-171`). Connect und Q&A fragen den Launcher nach dem, was sie brauchen (z. B. „Zoom-JWT für dieses Meeting“, „Zugang zum Cloud-Raum“), und bekommen kurzlebige, vom Server ausgestellte Freigaben. Läuft kein Launcher oder ist niemand angemeldet, sagt das Tool genau das und nennt den Weg („Im Launcher anmelden“), statt still zu scheitern. Wie die Tools den Launcher erreichen (bestehende lokale Kanäle, neuer lokaler Dienst), entscheidet der Planer; Bedingung: nur lokal, nur für Tools der Suite, keine Freigabe an fremde Prozesse.

### 6.3 Laufende Sitzungen werden nie unterbrochen (Owner-Entscheid)

- **Entziehen, Herabstufen und Ablauf wirken erst beim nächsten Start des Launchers** (bzw. nach der Obergrenze aus 6.1). Ein Admin, der während einer Show einen Zugang löscht, beendet damit nichts, was schon läuft.
- Was der Server ausstellt (Zoom-JWT, Zugang zum Cloud-Raum, iveo-Token im Speicher), hält **mindestens so lange, wie eine Sitzung realistisch dauert**, oder wird im Hintergrund erneuert, ohne dass etwas abbricht. Erneuerungen **innerhalb** einer laufenden Sitzung gelingen auch nach einem Entzug; der Entzug greift beim nächsten Start (Folge aus dem Owner-Entscheid, als Entscheidung des Entwurfs).
- Heutige Fristen, die das berühren: Zoom-JWT 12 h, Connect-Operator-Token 8 h, Gast-Token 12 h, Raum verfällt nach 24 h (`apps/connect/src/main/room.ts:15-16`). Der Planer legt fest, wie lang eine Sitzung höchstens laufen darf und wie die Fristen dazu passen.
- **Zoom-Zugangsdaten in der Cloud:** Damit gibt der Owner die frühere Entscheidung E7 auf („Die Daten gehen nie an Worker oder Cloud“, `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md:87`; Owner 17.10.2026 mit „passt“ auf den Teil, der das ausdrücklich nannte). Client-ID und Client-Secret der Zoom-App liegen künftig nur als Secret beim Worker; er signiert das JWT. Das bisherige Nicht-Ziel „keine Nutzer-Anmeldung per OAuth“ (`…stage4-connect-design.md:62`) bezog sich auf Zoom-Nutzerkonten und bleibt: Meetings laufen weiter im eigenen Zoom-Konto der App.

### 6.4 iveo-Tokens zentral (Owner-Entscheid)

Ein Admin hinterlegt das Token eines Events einmal in der Admin-Maske. Der Launcher eines angemeldeten Nutzers, der dieses Event sehen darf (Kollege: alle; Externer: die ausgewählten), bekommt es nach der Anmeldung **nur in den Speicher**, nie auf die Platte. Die iveo-Anbindung braucht ohnehin Internet; ein Offline-Speicher ist nicht nötig. Eine Show bleibt token-frei (wie heute). Bestehende lokal gespeicherte iveo-Tokens (`iveoTokensEnc`) werden nach der Anmeldung nicht mehr gebraucht; wie sie verschwinden (löschen nach erfolgreicher Anmeldung, oder als Rückfall behalten), entscheidet der Planer mit der Bedingung aus Abschnitt 2 (keine dauerhaften Geheimnisse).

## 7 · Admin-Maske im Launcher (Owner-Entscheid: Aufbau A)

Nur für Admins sichtbar. Aufbau **A · Liste links, Details rechts** (Entwurf im Brainstorming, Owner-Wahl). Reiter:

- **Zugänge:** links alle Personen als Tabelle (Name, Stufe, „bis“), rechts die Einstellungen der gewählten Person: Anmeldeart (Google bzw. E-Mail), Stufe, Tools (bei Externen), iveo-Events (bei Externen), „Zugang bis“, Zoom-Freigabe, „Speichern“, „Zugang löschen“. Abgelaufene Zugänge bleiben sichtbar und lassen sich verlängern. „+ Externen einladen“ legt einen Externen an und zeigt den Einladungscode einmal an; „Neuen Code erzeugen“ setzt das Passwort zurück.
- **iveo-Events:** je Event das Token einmal hinterlegen. Es wird danach nie wieder angezeigt, nur ersetzt oder entfernt.
- **Anfragen:** offene Zoom-Anfragen von Externen mit Name, Zweck/Event, gewünschtem Zeitraum, Rechner; Knöpfe „Freigeben bis …“ und „Ablehnen“. Neue Anfragen zeigt der Launcher bei Admins mit einem Punkt am Zahnrad (Owner: Admin-Maske im Launcher, keine Benachrichtigung auf anderem Weg).
- **Geräte** (Vorschlag des Entwurfs): Rechner, auf denen sich jemand angemeldet hat, mit Rechnername und letztem Kontakt; ein Admin markiert einen Rechner als **JM-Rechner**. Nur dort darf ein Externer Zoom nutzen (Abschnitt 5).
  - **Was ein Rechner ist** (Entscheidung des Entwurfs): Der Launcher erzeugt beim ersten Anmelden einen Geräteschlüssel und legt ihn mit dem Schlüsselspeicher des Betriebssystems ab (safeStorage, unter Windows an Rechner und Windows-Konto gebunden). Der Server erkennt den Rechner daran, dass der Launcher beweist, diesen Schlüssel zu haben. Kopierte Einstellungen funktionieren auf einem anderen Rechner deshalb nicht. Ein zweites Windows-Konto auf derselben Hardware und eine Neuinstallation von Windows oder Launcher ergeben ein neues Gerät, das ein Admin einmal neu markiert. Der Geräteschlüssel ist eine Geräteidentität, kein Geheimnis eines Dienstes; Abschnitt 2 meint die Dienst-Geheimnisse (Zoom-Secret, iveo-Tokens, Proxy-Key).

Wer kein Admin ist, sieht im Launcher nur „angemeldet als …“, seine Stufe, bei Externen das Ablaufdatum und bei Externen ohne Zoom den Knopf „Zoom anfragen“.

## 8 · Zoom-Anfrage eines Externen

1. Der Externe klickt im Launcher „Zoom anfragen“ und nennt Zweck/Event und den gewünschten Zeitraum. Der Launcher sagt, ob dieser Rechner ein JM-Rechner ist; wenn nicht, sagt er, dass die Freigabe hier nicht wirken wird.
2. Admins sehen die Anfrage im Reiter „Anfragen“ und den Punkt am Zahnrad.
3. „Freigeben bis …“ setzt eine Frist. Beim nächsten Start (Abschnitt 6.3) hat der Externe Zoom in Connect; nach der Frist erlischt die Freigabe von selbst, wieder mit Wirkung beim nächsten Start.
4. „Ablehnen“ schließt die Anfrage; der Externe sieht das beim nächsten Kontakt.

## 9 · Server

- Es bleibt **ein** Worker: der bestehende `jm-suite-proxy` auf Cloudflare (`services/release-proxy/wrangler.toml`), Durable Objects mit EU-Jurisdiktion (`CONNECT_JURISDICTION="eu"`). Wie die Kontodaten gespeichert werden (D1, Durable Object, KV), entscheidet der Planer.
- Der Worker kennt: Konten (E-Mail, Name, Anmeldeart, Stufe, Tools, iveo-Events, Ablauf, Passwort-Hash bei Externen), offene und erteilte Zoom-Freigaben, Geräte mit Markierung „JM-Rechner“, hinterlegte iveo-Tokens (verschlüsselt mit einem Worker-Secret), Einladungscodes (nur als Hash, einmal gültig, mit kurzer Frist).
- Als Worker-Secrets kommen dazu: Zoom Client-ID und Client-Secret, die Zugangsdaten der Google-Anmeldung, ein Schlüssel zum Verschlüsseln der iveo-Tokens. `ZOOM_SDK_KEY` und `PROXY_KEY` verschwinden nach dem Übergang (Abschnitt 10).
- Alle heutigen Routen, die `PROXY_KEY` oder `X-Zoom-Sdk-Key` prüfen (`services/release-proxy/worker.js:150-159`, `connect-relay.js:121-126`, `qa-relay.js:265`), prüfen künftig die Sitzung und die Rechte des Kontos. Öffentlich bleibt, was heute öffentlich ist (Gast-Seiten von Connect und Q&A, Join mit Gast-Token, Q&A-Einreichungen).
- **Rechte für die übrigen Server-Funktionen** (Owner 17.10.2026), siehe 9.1.
- **Protokoll:** Der Worker schreibt mit, wer wann wem welchen Zugang oder welche Zoom-Freigabe gegeben oder entzogen hat (Vorschlag des Entwurfs; Anzeige in der Admin-Maske ist kein Muss).
- **Erster Admin:** Bei der Einrichtung trägt der Owner sein Google-Konto als ersten Admin ein (z. B. als Worker-Variable); weitere Admins ernennt ein Admin in der Maske. Es muss immer mindestens einen Admin geben.
- Deploy des Workers nur mit Owner-Freigabe, wie bisher (Trockenlauf, Prüfung offener Proxy-Commits).

### 9.1 Wer was am Server darf (Owner 17.10.2026)

| Funktion (heutige Route) | ohne Anmeldung | Externer | Kollege | Admin |
| --- | --- | --- | --- | --- |
| Update des Launchers selbst (`/tools/:id/latest` für den Launcher, `apps/launcher/src/main/updates.ts:61-94`) | ja | ja | ja | ja |
| Katalog, Installieren und Updates der Tools (`/tools/:id/latest`, `/suite.json`, `/changelog.json`) | nein | ja | ja | ja |
| Kochbuch lesen (`/cookbook.json`) | nein | ja | ja | ja |
| Feedback senden (`POST /feedback`) | nein | ja | ja | ja |
| KI-Entwurf fürs Kochbuch (`POST /cookbook/draft`, kostenpflichtige API) | nein | nein | ja | ja |
| Connect Cloud-Raum (Admin-Routen von `/connect/:room`) | nein | wenn ausgewählt | ja | ja |
| Zoom: SDK laden, JWT | nein | nur mit Freigabe und nur auf JM-Rechner | ja | ja |
| Q&A Cloud-Relay (Admin-Routen von `/qa/:id`) | nein | wenn ausgewählt | ja | ja |
| iveo-Token eines Events | nein | nur ausgewählte Events | alle hinterlegten | alle hinterlegten |
| Admin-Maske | nein | nein | nein | ja |

Öffentlich bleibt, was heute öffentlich ist (Gast-Seiten, Join mit Gast-Token, Q&A-Einreichungen). Das Update des Launchers ohne Anmeldung sorgt dafür, dass ein Launcher mit kaputter oder abgelaufener Anmeldung immer an die reparierende Version kommt.

## 10 · Übergang

- Die heutigen Launcher (bis einschließlich der Version vor dieser Anmeldung) haben den alten `PROXY_KEY` fest eingebaut. Der Worker nimmt ihn **eine Übergangszeit lang** weiter an, damit diese Launcher sich noch auf die neue Version aktualisieren können. Danach wird er gesperrt; ein Launcher, der dann noch alt ist, muss einmal von Hand neu installiert werden. Wie lang die Übergangszeit ist und woran der Owner erkennt, dass alle Rechner umgestellt sind, ist Owner-Frage OF2.
- Connect und Q&A behalten ihre bisherigen Felder für Proxy-Key und Zoom-Zugangsdaten nur, solange der Übergang läuft; danach entfallen sie aus der Oberfläche (Entscheidung des Planers, mit der Bedingung: kein Funktionsverlust für angemeldete Nutzer).
- Lokal gespeicherte Geheimnisse (`proxyKeyEnc`, `zoomZugangEnc`, `zoomSdkKeyEnc`, `githubTokenEnc`, `iveoTokensEnc`, Q&A-Proxy-Key) werden nach erfolgreicher Anmeldung nicht mehr benutzt und gelöscht (Vorschlag des Entwurfs).
- Betroffene Versionen: Launcher, Connect und Q&A je mit Minor-Sprung; Worker-Deploy mit Owner-Freigabe. Der Connect-Teil setzt auf Connect 0.4.0 (Slot-Modell) auf, das vorher kommt; die Karten „Cloud-Zugang“ und „Zoom-Meeting“ ändern sich dort ohnehin.

## 11 · Randbedingungen

- **Datenschutz:** Namen und E-Mail-Adressen der Externen liegen auf dem Worker. Gespeichert wird nur, was für Anmeldung und Rechte nötig ist; Ablage in der EU, soweit Cloudflare das für die gewählte Speicherart erlaubt. Wer gelöscht wird, wird wirklich gelöscht (bis auf das Protokoll, falls der Owner es will; OF3).
- **Lizenzen:** Zoom ToU §6.1 (Abschnitt 5); die Zoom-DLLs werden weiterhin nie in öffentliche Pakete gepackt, „Zoom-SDK laden“ bleibt der Weg.
- **Bestehende Lehren der Suite:** jede Anzeige stimmt in jedem Zustand (angemeldet, abgelaufen, offline, Server nicht erreichbar, Zugang entzogen, aber Sitzung läuft); jede Diagnose wird angezeigt; Texte ohne ASCII-Anführungszeichen; CSP der Tools bleibt eng.
- **Bedienung:** Anmelden hat nicht mehr Schritte als „Mit Google anmelden“ bzw. E-Mail und Passwort und danach die Bestätigung des Codes (4.1); alles läuft im System-Browser.

## 12 · Was der Planer entscheidet

- Speicherart im Worker, Format und Lebensdauer von Sitzung und Freigaben (innerhalb der Regeln aus 6.1 und 6.3), Verfahren für den Passwort-Hash und die Bremse bei Fehlversuchen.
- Technik hinter dem Ablauf aus 4.1: wie der Launcher erfährt, dass im Browser bestätigt wurde (Abfrage beim Worker, Rückkehr per lokaler Adresse oder `jmps://`), Bildung des Codes, Einrichtung des Google-Clients.
- Wie Connect und Q&A die Freigaben beim Launcher abholen (6.2).
- Oberflächendetails der Admin-Maske über Aufbau A hinaus, im Stil des UX-Fundaments (`@jm/ui`).
- Ob und wie die Umgebungsvariablen für Entwicklung erhalten bleiben (Abschnitt 3).
- Tests: Kreuzprodukt der Zustände für jede Anzeige, Gegenproben für jede Rechte-Prüfung im Worker (falsche Stufe, abgelaufen, falsches Event, Zoom ohne Freigabe, Zoom auf Nicht-JM-Rechner), Nachweis, dass kein dauerhaftes Geheimnis auf dem Rechner landet.

## 13 · Owner-Fragen (jede mit Vorgabe)

| # | Frage | Vorgabe (Owner 17.10.2026: bestätigt) |
| --- | --- | --- |
| OF1 | Dürfen Kollegen Zoom auf jedem Rechner nutzen, auf dem sie angemeldet sind, oder nur auf JM-Rechnern? | jeder Rechner, auf dem ein Kollege angemeldet ist |
| OF2 | Wie lange nimmt der Worker den alten `PROXY_KEY` nach dem Release noch an? | 30 Tage; der Reiter „Geräte“ zeigt, welche Rechner noch einen alten Launcher melden |
| OF3 | Soll das Protokoll der Freigaben auch Einträge gelöschter Zugänge behalten? | ja, 12 Monate, ohne Passwort-Daten |
| OF4 | Rechtliche Klärung Zoom für Externe (ToU §6.1): Gilt ein Externer, der für Jakobs Medien an einem JM-Rechner arbeitet, als interner Gebrauch? | bis zur Klärung nur auf JM-Rechnern (Abschnitt 5) |

## 14 · Risiken

- **Server nicht erreichbar:** Neue Anmeldungen und alles mit Server-Teil gehen nicht; laufende Sitzungen und Starts mit gültiger Anmeldung (30 Tage) gehen weiter. Heute hängt der Cloud-Teil ebenso am Worker.
- **Zentrales Zoom-Secret:** Liegt künftig nur beim Worker statt auf vielen Rechnern; ein Leck des Workers trifft aber alle. Worker-Secrets, kurze Fristen der JWTs.
- **Admin ohne Zugang:** Fällt das einzige Admin-Konto weg, hilft nur der Eintrag beim Worker (Abschnitt 9).
- **Alte Launcher nach dem Übergang:** müssen von Hand neu installiert werden (Abschnitt 10).
- **Zusammenspiel mit Connect 0.4.0:** Die Slot-Arbeit ändert Connect vorher; diese Spec setzt darauf auf und wird vor dem Plan gegen den dann aktuellen Stand nachgemessen.
