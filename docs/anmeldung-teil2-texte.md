# Anmeldung Teil 2: Texte zur Freigabe

Zweck: zur Freigabe durch den Owner. Hier steht jeder neue oder geänderte sichtbare Text von Launcher 0.19.0, JM Connect 0.5.0 und dem Server, genau so, wie er im Code steht.

Stand: 21.11.2026.

Plan: `docs/superpowers/plans/2026-11-20-anmeldung-teil2.md`. Entwurf: `docs/superpowers/specs/2026-11-20-anmeldung-teil2-design.md`.

So liest man die Tabellen: Spalte „Nr.“ ist die Nummer des Textes, „Ort“ sagt, wo er erscheint oder in welcher Datei er steht, „Text“ ist der Wortlaut. Was in ‹spitzen Klammern› steht, setzt das Programm selbst ein (‹Datum› als TT.MM.JJJJ, ‹Zeit› als HH:MM, ‹Name› der Kurzname aus der Freigabe, ‹Stufe› Admin, Kollege oder Externer, ‹Grund› ein Text aus T3 bzw. ZA8 bis ZA10). Die Spalte „Hinweis“ nennt Abweichungen vom Plan; ein Strich heißt: Der Text im Code ist der Text des Plans.

Die Freigabe der Texte hält keine Aufgabe auf. Sie ist das Tor für die Releases von Launcher 0.19.0 und Connect 0.5.0.

## T1 Worker

Datei: `services/release-proxy/konto-zugang.js`

| Nr. | Ort | Text | Hinweis |
| --- | --- | --- | --- |
| S20 | `FEHLER_TEXT['raum-vergeben']` | dieser Cloud-Raum gehört einem anderen Konto oder Rechner | – |

## T2 Launcher

Dateien: `apps/launcher/src/renderer/src/lib/konto-dialog.ts`, `apps/launcher/src/renderer/src/lib/admin-ansicht.ts`, `packages/cookbook/content/tool-manuals/launcher-anmeldung.md`

| Nr. | Ort | Text (neu) | Hinweis |
| --- | --- | --- | --- |
| Z5 | `konto-dialog.ts` `ZOOM_TEXTE.hinweisJm` | Dieser Rechner ist ein JM-Rechner. Eine Freigabe wirkt hier nach dem nächsten Start des Launchers. | – |
| Z6 | `ZOOM_TEXTE.hinweisKeinJm` | Dieser Rechner ist kein JM-Rechner. Zoom gibt es für Externe nur auf JM-Rechnern; eine Freigabe wirkt hier nicht. | – |
| Z7 | `ZOOM_TEXTE.hinweisMac` | Auf dem Mac gibt es Zoom in Connect nicht. Eine Freigabe wirkt nur auf JM-Rechnern unter Windows. | – |
| Z9b | `ZOOM_TEXTE.freigegeben(d)` | Zoom freigegeben bis ‹Datum›. Gilt ab dem nächsten Start des Launchers. | – |
| Z11 | `ZOOM_TEXTE.connect` | entfällt | – |
| K29d | `konto-dialog.ts` `KONTO_TEXTE.zweck` | Q&A extern / Connect Cloud-Raum / Zoom-Anmeldung / Zoom-SDK laden | – |
| M44a | `admin-ansicht.ts` `REITER_TEXTE` | Alter Schlüssel für Katalog, Updates und Q&A angenommen bis ‹Datum›. / Alter Schlüssel für Katalog, Updates und Q&A ohne Enddatum angenommen. | – |
| M44b | `REITER_TEXTE` | Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) angenommen bis ‹Datum›. / Alter Schlüssel für Connect (Cloud-Raum, Zoom-SDK) ohne Enddatum angenommen. | – |
| M46 | `REITER_TEXTE.gruppe` | Katalog und Updates / Q&A extern / Connect (Cloud-Raum, Zoom-SDK) | – |
| M47 | `REITER_TEXTE.connect` | entfällt (M44b sagt es) | – |
| M48 | `ADMIN_TEXTE.connectTeil1` | entfällt | – |
| R1a | `launcher-anmeldung.md`, Zeile 48 | - **Zoom anfragen (Externe):** im Konto-Dialog „Zoom anfragen“, Zweck oder Event und den Zeitraum eintragen, „Anfrage senden“. Ein Admin gibt frei. Die Freigabe wirkt ab dem nächsten Start des Launchers und nur auf einem JM-Rechner unter Windows. Kollegen brauchen keine Anfrage. | – |
| R1b | `launcher-anmeldung.md`, Zeile 74 (Tabellenzeile Pannenhilfe) | \| Zoom-Freigabe wirkt nicht \| Sie wirkt erst nach dem nächsten Start des Launchers und nur auf JM-Rechnern unter Windows. Der Konto-Dialog sagt, ob der Rechner ein JM-Rechner ist \| | – |

Bei K29d, M44a, M44b und M46 stehen mehrere Texte in einer Zeile; ein Schrägstrich mit Leerzeichen trennt sie.

## T3 Connect: Gründe

Datei: `apps/connect/src/main/zugang/regeln.ts`, Funktion `grundText(zweck, grund, detail)`

| Nr. | Grund (Zweck) | Text | Hinweis |
| --- | --- | --- | --- |
| CG1 | `kein-launcher` | Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an. | – |
| CG2 | `launcher-unecht` | Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu. | – |
| CG3 | `launcher-zu-alt`, `unbekannter-zweck` | Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0). | – |
| CG4 | `niemand-angemeldet` | Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts). | – |
| CG5 | `abgelaufen` | Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an. | – |
| CG6 | `entzogen` | Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin. | – |
| CG7a | `kein-recht` (`connect-raum`) | Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin. | – |
| CG7b | `kein-recht` (`zoom-jwt`) | Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner. | – |
| CG7c | `kein-recht` (`zoom-sdk`, ohne Detail) | Dein Konto darf das Zoom-SDK nicht laden. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“). | – |
| CG8 | `kein-recht` mit `detail: 'kein-jm-rechner'` (`zoom-sdk`) | „Zoom-SDK laden“ gibt es nur auf JM-Rechnern. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“) oder bitte einen Admin, diesen Rechner als JM-Rechner zu markieren. | – |
| CG9 | `server-nicht-erreichbar` | Der Server ist gerade nicht erreichbar. Ich versuche es weiter. | – |
| CG10 | `fehler` | Freigabe fehlgeschlagen: ‹Detail› | – |

## T4 Connect: Cloud-Zugang, Raum, Zoom-Anmeldung, Übergang

Dateien: `apps/connect/src/main/zugang/regeln.ts` (CZ, ZA), `apps/connect/src/main/zoom/klartext.ts` (B9s, B10s, S12b), `apps/connect/src/shared/ndi-text.ts` (T146), `apps/connect/src/shared/zoom-text.ts` (ZU1 bis ZU3), `apps/connect/src/renderer/src/zoom/ZoomCard.tsx` (ZS1)

| Nr. | Ort | Text | Hinweis |
| --- | --- | --- | --- |
| CZ1 | Cloud-Zeile, Freigabe | Cloud-Zugang über den Launcher (‹Name› · ‹Stufe›), gültig bis ‹Datum› ‹Zeit›. | – |
| CZ2 | Cloud-Zeile, alter Key | Cloud-Zugang über den alten Proxy-Key (Übergang). | – |
| CZ3 | Cloud-Zeile, alter Key abgelehnt | Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an. | – |
| CZ4 | Cloud-Zeile, noch kein Versuch | Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest. | – |
| CZ5 | Zusatz nach dem Löschen des alten Keys | Der alte Proxy-Key wurde gelöscht; Connect nutzt jetzt die Freigabe des Launchers. | – |
| CZ6 | Zusatz, Umgebung | Entwicklungsmodus: JMPS_PROXY_KEY gesetzt. | – |
| CZ7 | Fehler „Raum öffnen“ ohne Zugang | Raum öffnen nicht möglich: ‹Grund› | – |
| CZ8 | Fehler 403 `raum-vergeben` | Dieser Cloud-Raum gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort oder wähle im Show-Editor eine andere Raum-ID. | – |
| CZ9 | Fehler 401 auf Freigabe | Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher; bitte noch einmal „Raum öffnen“. | – |
| CZ10 | Karte, Übergangszeile | Alter Proxy-Key: hinterlegt, nur noch im Übergang. | – |
| T146 | `ndi-text.ts`, Zeile 77 | Keine Verbindung zum Raum „‹Raum›“. Adresse und Cloud-Zugang prüfen — im Hintergrund wird weiter versucht. | – |
| ZA1 | Zoom-Anmeldung, Server | Zoom-Anmeldung über den Launcher (‹Name› · ‹Stufe›), Freigabe gültig bis ‹Datum› ‹Zeit›. | – |
| ZA2 | Zoom-Anmeldung, lokal | Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang). | – |
| ZA3 | Zoom-Anmeldung, keine | Zoom-Anmeldung: ‹Grund› | – |
| ZA4 | Zoom-Anmeldung, noch kein Versuch | Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt. | – |
| ZA5 | Zusatz nach dem Löschen der alten Zugangsdaten | Die alten Zoom-Zugangsdaten wurden gelöscht; Connect meldet sich jetzt über den Launcher bei Zoom an. | – |
| ZA6 | Hinweis nach dem Löschen des alten SDK-Schlüssels | Der alte SDK-Schlüssel wurde gelöscht; „Zoom-SDK laden“ läuft jetzt über den Launcher. | – |
| ZA7 | Meldung, Start ohne Zoom-Anmeldung | Ohne Zoom-Anmeldung kein Beitritt. ‹Grund› | – |
| ZA8 | Grund `server-abgelehnt` | Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher. | – |
| ZA9 | Grund `nicht-eingerichtet` | Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid. | – |
| ZA10 | Grund `server-fehler` | Der Server hat kein Zoom-Anmelde-Token geliefert (‹Detail›). Ich versuche es beim nächsten Beitritt erneut. | – |
| ZA11 | Zusatz, Entwicklung | Entwicklungsmodus: JMPS_ZOOM_JWT_TTL_S gesetzt, der Server stellt das Zoom-Anmelde-Token mit ‹n› s Laufzeit aus. | – |
| B9s | `klartext.ts` | Zoom hat die Anmeldung abgelehnt: Die Zoom-Zugangsdaten auf dem Server stimmen nicht (‹Result›). Sag einem Admin Bescheid. | – |
| B10s | `klartext.ts` | Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token vom Server passt nicht (AUTHRET_JWTTOKENWRONG). Meist geht die Uhr dieses PCs falsch; sonst stimmen die Zugangsdaten auf dem Server nicht. | – |
| S12b | `klartext.ts`, Ablehnung der Freigabe für „Zoom-SDK laden“ | Der Server hat die Freigabe für „Zoom-SDK laden“ abgelehnt. Bitte noch einmal versuchen; Connect holt eine neue beim Launcher. | – |
| ZU1 | Zoom-Karte, Übergang | Alte Zugangsdaten: hinterlegt (Client-ID endet auf ‹vier Zeichen›), nur noch im Übergang. | – |
| ZU2 | Zoom-Karte, Übergang | Alter SDK-Schlüssel: hinterlegt, nur noch im Übergang. | – |
| ZU3 | Zoom-Karte, unlesbar | Alte Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Sie werden nicht mehr gebraucht; „Entfernen“ räumt sie weg. | – |
| ZS1 | `ZoomCard.tsx`, Zeile 47 (`SPERR_HINWEIS`) | Zoom ist gesperrt, bis das Zoom-SDK eingerichtet ist. | – |

## T5 Changelog-Entwürfe

Eingetragen in `packages/suite-manifest/changelog.json`, je oben bei der App. Das Datum 20.11.2026 ist ein Platzhalter; beim Release setzt der Release-Schritt den Veröffentlichungstag ein.

| Nr. | App, Version | Text |
| --- | --- | --- |
| CL-L1 | launcher 0.19.0 | JM Connect holt Cloud-Raum, Zoom-Anmeldung und „Zoom-SDK laden“ ab Connect 0.5.0 über die Anmeldung im Launcher. Dafür braucht es diese Launcher-Version. |
| CL-L2 | launcher 0.19.0 | Zoom-Freigaben für Externe wirken jetzt in Connect: ab dem nächsten Start des Launchers und nur auf JM-Rechnern unter Windows. |
| CL-L3 | launcher 0.19.0 | Der Konto-Dialog nennt unter „An Tools ausgegeben“ auch die Freigaben für Connect. Der Reiter „Geräte“ der Admin-Maske zeigt in einer eigenen Zeile, bis wann ältere Connect-Versionen ihren alten Schlüssel noch nutzen dürfen. |
| CL-C1 | connect 0.5.0 | Cloud-Raum, Zoom und „Zoom-SDK laden“ laufen jetzt über die Anmeldung im Launcher (ab Launcher 0.19.0). Proxy-Key, Zoom-Zugangsdaten und SDK-Schlüssel muss niemand mehr eintragen. |
| CL-C2 | connect 0.5.0 | Connect hält seine Freigaben 72 Stunden, auch über einen Neustart und bei geschlossenem Launcher. Ein laufendes Meeting und ein Wiederbeitritt hängen nicht am Launcher. |
| CL-C3 | connect 0.5.0 | Alte Schlüssel und Zugangsdaten gelten im Übergang weiter und werden gelöscht, sobald die Anmeldung einmal geklappt hat. Das gemerkte Meeting bleibt. |
| CL-C4 | connect 0.5.0 | „Zoom-SDK laden“ gibt es nur auf JM-Rechnern; auf anderen Rechnern wählt man den SDK-Ordner von Hand. |
| CL-C5 | connect 0.5.0 | Shows mit sehr kurzem Namen (unter 6 Zeichen) bekommen jetzt einen Cloud-Raum, den der Server annimmt. |

## Handbuch

Geändert in `packages/cookbook/content/tool-manuals/tool-jm-connect.md` (Handbuch JM Connect). Mit „-“ beginnt die alte Zeile, mit „+“ die neue. Die Stelle steht jeweils darüber.

### Stelle: Kopf des Handbuchs (Voraussetzungen, Stand)

Voraussetzungen und Stand: Connect braucht jetzt Version 0.5.0 und den Launcher ab 0.19.0 mit Anmeldung; Zugangsdaten gehören nicht mehr dazu. Das Datum „lastReviewed“ rückt auf den Stand dieser Änderung.

```
-   - JM Connect ab 0.4.0, installiert über den Launcher
-   - Zoom-SDK 7.1.5.43953 (per „Zoom-SDK laden“ oder als SDK-Ordner aus der JM-Ablage)
-   - Zugangsdaten der Meeting-SDK-App (Datei oder Client-ID und Client-Secret)
+   - JM Connect ab 0.5.0, installiert über den Launcher, und der Launcher ab 0.19.0, im Launcher angemeldet
+   - Zoom-SDK 7.1.5.43953 (auf JM-Rechnern per „Zoom-SDK laden“, sonst als SDK-Ordner aus der JM-Ablage)
```

```
- lastReviewed: 2026-11-14
+ lastReviewed: 2026-11-21
```

### Stelle: Voraussetzungen

Voraussetzungen im Text: Der Abschnitt nennt dieselben Neuerungen ausführlicher. Der SDK-Schlüssel und die Zoom-Zugangsdaten entfallen, weil Connect die Freigaben beim Launcher holt und der Server das Zoom-Anmelde-Token ausstellt.

```
- - JM Connect ab Version 0.4.0, installiert über den Launcher.
- - Zoom-SDK 7.1.5.43953: auf JM-eigenen Rechnern per Knopf „Zoom-SDK laden“ (braucht den SDK-Schlüssel), sonst als SDK-Ordner aus der JM-Ablage. Connect kopiert es einmal je PC nach %LOCALAPPDATA%\JM Connect\zoom-laufzeit (rund 315 MB).
- - Zugangsdaten der Meeting-SDK-App: die Zugangsdaten-Datei (clientId, clientSecret) oder Client-ID und Client-Secret von Hand. Connect speichert sie verschlüsselt unter diesem Windows-Konto und schickt sie nie in die Cloud.
+ - JM Connect ab Version 0.5.0, installiert über den Launcher, und der Launcher ab 0.19.0, im Launcher angemeldet. Connect hält selbst keine Schlüssel und Zugangsdaten mehr; es holt kurzlebige Freigaben beim Launcher (siehe „Anmeldung (ab 0.5.0)“).
+ - Zoom-SDK 7.1.5.43953: auf JM-Rechnern per Knopf „Zoom-SDK laden“ (läuft über die Anmeldung im Launcher), sonst als SDK-Ordner aus der JM-Ablage („SDK-Ordner wählen …“). Connect kopiert es einmal je PC nach %LOCALAPPDATA%\JM Connect\zoom-laufzeit (rund 315 MB).
+ - Zoom-Anmeldung: Connect braucht keine Zugangsdaten der Meeting-SDK-App mehr. Das Zoom-Anmelde-Token stellt der Server aus, Connect holt es über den Launcher und hält es nur im Arbeitsspeicher.
```

### Stelle: Browser-Gäste (kurz)

Browser-Gäste: Der Cloud-Raum braucht jetzt die Anmeldung im Launcher statt eines Cloud-Zugangs mit Schlüssel.

```
- - Raum öffnen (braucht den Cloud-Zugang), für jeden Gast einen Link erzeugen und verschicken.
+ - Raum öffnen (braucht die Anmeldung im Launcher), für jeden Gast einen Link erzeugen und verschicken.
```

### Stelle: Anmeldung (ab 0.5.0)

Neuer Abschnitt „Anmeldung (ab 0.5.0)“: Er erklärt, wie Connect die Freigaben beim Launcher holt, wie lange sie gelten, was die beiden Zeilen „Cloud-Zugang“ und „Zoom-Anmeldung“ zeigen und was im Übergang mit alten Werten passiert. Der dritte Punkt sagt jetzt genau, wann der Launcher gebraucht wird: nur bei einer neuen oder abgelaufenen Freigabe, nicht bei jedem neuen Beitritt.

```
+ ### Anmeldung (ab 0.5.0)
+ - Connect hält keine Dienst-Schlüssel mehr. Es holt beim Launcher (ab 0.19.0, angemeldet) kurzlebige Freigaben, jede 72 Stunden gültig: für den Cloud-Raum, für die Zoom-Anmeldung und für „Zoom-SDK laden“ (nur auf JM-Rechnern). Der Server prüft Konto und Recht.
+ - Zwei Zeilen zeigen den Stand: „Cloud-Zugang“ („Cloud-Zugang über den Launcher (‹Name› · ‹Stufe›), gültig bis ‹Datum› ‹Zeit›.“) und in der Zoom-Karte „Zoom-Anmeldung“ („Zoom-Anmeldung über den Launcher (‹Name› · ‹Stufe›), Freigabe gültig bis ‹Datum› ‹Zeit›.“). Vor dem ersten Versuch steht dort „Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest.“ bzw. „Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.“
+ - Connect hält seine Freigaben selbst und erneuert sie rechtzeitig: Jede Freigabe gilt 72 Stunden je Zweck und Ziel (der Cloud-Raum je Raum-ID), und Connect versucht das Erneuern ab 24 Stunden vor dem Ablauf. Ein laufendes Meeting und ein offener Raum hängen nicht am Launcher: Wird der Launcher beendet oder meldet sich dort jemand ab, läuft beides weiter. Auch ein neuer Zoom-Beitritt mit einer gehaltenen Freigabe braucht den Launcher nicht. Erst ein Raum mit anderer Raum-ID oder eine abgelaufene Freigabe braucht eine neue Freigabe, und die holt Connect beim Launcher.
+ - Übergang: Liegt auf dem Rechner noch ein alter Wert, nutzt Connect ihn weiter, damit nichts mitten im Betrieb ausfällt. Die Zeilen sagen es: „Cloud-Zugang über den alten Proxy-Key (Übergang).“ und „Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang).“ Auf der Karte steht „Alter Proxy-Key: hinterlegt, nur noch im Übergang.“. Alte Werte lassen sich nur noch entfernen, nicht mehr eintragen; mit „Entfernen“ räumt man sie weg. Sobald die Freigabe des Launchers da ist, nutzt Connect sie.
+ - Das gemerkte Meeting bleibt: Meeting-Nummer und Kenncode des letzten Beitritts merkt Connect weiter und bietet sie nach „Schließen“ und nach einem Neustart wieder an (siehe „Logs und Datenschutz“). „Entfernen“ der alten Werte berührt sie nicht.
+ 
```

### Stelle: Einrichtung

Einrichtung: Zugangsdaten und SDK-Schlüssel werden nicht mehr eingetragen. Man meldet sich im Launcher an, „Zoom-SDK laden“ läuft darüber, und „Einrichtung prüfen“ benutzt das Token vom Server.

```
- - Zoom-Karte, Knopf „Einrichtung“ aufklappen. Zoom bleibt gesperrt, bis Zoom-SDK und Zugangsdaten eingerichtet sind.
- - Zoom-SDK auf JM-eigenen Rechnern: unter „SDK-Schlüssel“ auf „Eintragen …“, den Schlüssel einfügen und speichern, dann „Zoom-SDK laden“ (rund 143 MB, mit Fortschritt und „Abbrechen“).
- - Zoom-SDK ohne Schlüssel: „SDK-Ordner wählen …“ und den SDK-Ordner aus der JM-Ablage wählen (den Ordner mit dem Unterordner x64\bin). Danach steht dort „Zoom-SDK 7.1.5.43953 eingerichtet“.
- - Zugangsdaten: „Datei wählen …“ oder „Eintragen …“ (Client-ID und Client-Secret). Danach steht dort „hinterlegt (Client-ID endet auf …)“.
- - „Einrichtung prüfen“ meldet sich ohne Meeting bei Zoom an. Erwartet: „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“
+ - Vorher im Launcher (ab 0.19.0) anmelden und ihn laufen lassen. Connect holt die Freigaben dort.
+ - Zoom-Karte, Knopf „Einrichtung“ aufklappen. Zoom bleibt gesperrt, bis das Zoom-SDK eingerichtet ist; Zugangsdaten gibt es nicht mehr einzutragen.
+ - Zoom-SDK auf JM-Rechnern: „Zoom-SDK laden“ (rund 143 MB, mit Fortschritt und „Abbrechen“). Es läuft über die Anmeldung im Launcher; einen SDK-Schlüssel trägt niemand mehr ein.
+ - Zoom-SDK auf allen anderen Rechnern: „SDK-Ordner wählen …“ und den SDK-Ordner aus der JM-Ablage wählen (den Ordner mit dem Unterordner x64\bin). Danach steht dort „Zoom-SDK 7.1.5.43953 eingerichtet“.
+ - Alte Werte (Proxy-Key, Zoom-Zugangsdaten, SDK-Schlüssel) lassen sich nicht mehr eintragen. Liegt noch einer auf diesem Rechner, zeigt die Zoom-Karte eine Zeile dazu und den Knopf „Entfernen“ (siehe „Anmeldung (ab 0.5.0)“).
+ - „Einrichtung prüfen“ meldet sich ohne Meeting bei Zoom an, mit dem Zoom-Anmelde-Token vom Server. Erwartet: „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“
```

### Stelle: Pannenhilfe

Pannenhilfe: Die alten Meldungen zu SDK-Schlüssel, Zugangsdaten und Verbindung entfallen oder gelten nur noch im Übergang; die neuen Meldungen sagen, was der Techniker jetzt tun muss.

```
- | „Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel …“ | Unter „SDK-Schlüssel“ den Schlüssel eintragen. Ihn gibt es nur für JM-eigene Rechner; sonst den SDK-Ordner wählen. |
- | „Der Proxy hat den SDK-Schlüssel abgelehnt …“ | Der Schlüssel ist falsch. Entfernen und neu eintragen. |
+ | „„Zoom-SDK laden“ gibt es nur auf JM-Rechnern. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“) oder bitte einen Admin, diesen Rechner als JM-Rechner zu markieren.“ | Dieser Rechner gilt nicht als JM-Rechner, deshalb gibt es „Zoom-SDK laden“ hier nicht. „SDK-Ordner wählen …“ und den SDK-Ordner aus der JM-Ablage wählen, oder einen Admin bitten, den Rechner als JM-Rechner zu markieren. |
+ | „Dein Konto darf das Zoom-SDK nicht laden. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“).“ | Das Konto hat kein Recht für „Zoom-SDK laden“. Den SDK-Ordner aus der JM-Ablage von Hand wählen. |
+ | „Der Server hat die Freigabe für „Zoom-SDK laden“ abgelehnt. Bitte noch einmal versuchen; Connect holt eine neue beim Launcher.“ | Die Freigabe war nicht (mehr) gültig. Noch einmal „Zoom-SDK laden“; Connect holt dann eine neue beim Launcher. |
+ | Mit alten Zugangsdaten: „Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen.“ | Nur im Übergang, solange noch ein alter SDK-Schlüssel gespeichert ist. Den alten Schlüssel „Entfernen“; „Zoom-SDK laden“ läuft danach über den Launcher. |
```

Anmelde-Ablehnung durch Zoom: Ursache liegt jetzt meist beim Server oder an der Uhr, nicht mehr an Zugangsdaten auf dem Rechner.

```
- | „Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht …“ | Falsche Zugangsdaten. Datei oder Eingabe prüfen und neu hinterlegen. |
- | „Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht …“ | Meist falsche Zugangsdaten, sonst geht die Uhr dieses PCs falsch. Zugangsdaten prüfen, Uhrzeit synchronisieren. |
+ | „Zoom hat die Anmeldung abgelehnt: Die Zoom-Zugangsdaten auf dem Server stimmen nicht (‹Result›). Sag einem Admin Bescheid.“ | Die Zoom-Zugangsdaten auf dem Server sind falsch; auf diesem Rechner lässt sich nichts ändern. Einen Admin informieren. |
+ | Mit alten Zugangsdaten: „Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht (…). Bitte die Zugangsdaten prüfen.“ | Nur im Übergang, solange noch alte Zugangsdaten auf diesem Rechner liegen. Sie „Entfernen“; Connect meldet sich danach über den Launcher an. |
+ | „Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token vom Server passt nicht (AUTHRET_JWTTOKENWRONG). Meist geht die Uhr dieses PCs falsch; sonst stimmen die Zugangsdaten auf dem Server nicht.“ | Zuerst die Uhrzeit dieses PCs synchronisieren, dann erneut beitreten. Hilft das nicht, einen Admin informieren (Zugangsdaten auf dem Server). |
+ | Mit alten Zugangsdaten: „Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.“ | Nur im Übergang. Uhrzeit synchronisieren; sonst die alten Zugangsdaten „Entfernen“. |
```

Fehlende Zugangsdaten: Diese Meldung gibt es nicht mehr, weil keine Zugangsdaten mehr einzutragen sind.

```
- | „Zugangsdaten fehlen — bitte eintragen oder die Datei wählen.“ | Noch keine Zugangsdaten hinterlegt. Unter „Zugangsdaten“ eintragen oder die Datei wählen. |
- | „Das Zoom-SDK hat die Anmeldung sofort abgewiesen …“ | Das SDK selbst lehnt ab, nicht das Netz. Details im Log; die Zugangsdaten neu hinterlegen. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.“ | Der Launcher läuft nicht oder ist nicht erreichbar. Launcher starten, dort anmelden, erneut beitreten. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.“ | Connect traut dem gefundenen Programm nicht. Launcher neu starten. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).“ | Der Launcher kennt die Freigaben für Connect noch nicht. Launcher auf 0.19.0 oder neuer aktualisieren. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).“ | Im Launcher anmelden, dann erneut beitreten. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.“ | Im Launcher neu anmelden, dann erneut beitreten. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.“ | Der Zugang des Kontos ist nicht bestätigt. Einen Admin fragen. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner.“ | Das Konto hat kein Recht für Zoom auf diesem Rechner. Einen Admin fragen; Externe brauchen eine Zoom-Freigabe und einen JM-Rechner. |
+ | „Ohne Zoom-Anmeldung kein Beitritt. Der Server ist gerade nicht erreichbar. Ich versuche es weiter.“ | Netz oder Server gestört. Netz prüfen; Connect versucht es weiter, danach erneut beitreten. |
+ | „Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher.“ | Die Freigabe war nicht (mehr) gültig. Erneut beitreten; Connect holt eine neue. |
+ | „Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid.“ | Auf dem Server fehlen die Zoom-Zugangsdaten. Einen Admin informieren. |
+ | „Der Server hat kein Zoom-Anmelde-Token geliefert (…). Ich versuche es beim nächsten Beitritt erneut.“ | Der Server hat kein Token geliefert. Beim nächsten Beitritt versucht Connect es erneut; bleibt es, einen Admin informieren. |
+ | „Das Zoom-SDK hat die Anmeldung sofort abgewiesen …“ | Das SDK selbst lehnt ab, nicht das Netz. Details im Log; erneut beitreten, sonst das Log sichern und einen Admin informieren. |
```

Verbindung zum Cloud-Raum: Die Meldung nennt jetzt die Anmeldung im Launcher statt des Proxy-Keys.

```
- | „Keine Verbindung zum Raum „…“. Adresse und Proxy-Key prüfen — im Hintergrund wird weiter versucht.“ | Connect hat den Raum 8 s nach „Raum öffnen“ noch nicht erreicht. Cloud-Zugang (Adresse, Proxy-Key) und Netz prüfen. |
+ | „Keine Verbindung zum Raum „…“. Adresse und Cloud-Zugang prüfen — im Hintergrund wird weiter versucht.“ | Connect hat den Raum 8 s nach „Raum öffnen“ noch nicht erreicht. Cloud-Zugang (Zeile „Cloud-Zugang“ in der Karte) und Netz prüfen. |
+ | „Dieser Cloud-Raum gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort oder wähle im Show-Editor eine andere Raum-ID.“ | Die Raum-ID ist schon an ein anderes Konto oder einen anderen Rechner vergeben. Den Raum dort schließen oder im Show-Editor eine andere Raum-ID wählen. |
+ | „Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher; bitte noch einmal „Raum öffnen“.“ | Die Freigabe für den Cloud-Raum war nicht (mehr) gültig. Noch einmal „Raum öffnen“. |
+ | „Raum öffnen nicht möglich: ‹Grund›“ | Der Grund nennt, was fehlt: Launcher nicht gestartet oder zu alt (Launcher aktualisieren, ab 0.19.0), niemand angemeldet, Anmeldung abgelaufen, kein Recht oder Server nicht erreichbar. Launcher prüfen, dort anmelden, noch einmal „Raum öffnen“. |
```

### Stelle: Einrichtung (einmal je PC)

Checkliste „Einrichtung (einmal je PC)“: Die Prüfung auf hinterlegte Zugangsdaten entfällt. Neu steht dort die Anmeldung im Launcher, und die Zeile „Zoom-Anmeldung“ ist nur dann zu bemängeln, wenn sie rot ist (grau ist der Normalfall, gelb ein vorübergehender Grund).

```
- - [ ] Zugangsdaten hinterlegt (Client-ID endet auf …)
+ - [ ] Im Launcher (ab 0.19.0) angemeldet; die Zeile „Zoom-Anmeldung“ in der Zoom-Karte nennt den Launcher und ist nicht rot (vor dem ersten Beitritt „Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.“, danach „Zoom-Anmeldung über den Launcher (‹Name› · ‹Stufe›), Freigabe gültig bis ‹Datum› ‹Zeit›.“)
```


## Entfällt

Diese Texte gibt es in Connect 0.5.0 nicht mehr (Texte A4, A6, B9, B10 und S12 bleiben für den Übergang). Z11, M47 und M48 stehen oben in T2.

| Nr. | Ort | Hinweis |
| --- | --- | --- |
| S11 | `klartext.ts` | entfällt |
| S18 | `klartext.ts` | entfällt |
| A1 | `klartext.ts` | entfällt |
| A2 | `klartext.ts` | entfällt |
| A3 | `klartext.ts` | entfällt |
| A5 | `klartext.ts` | entfällt |
| A7 | `klartext.ts` | entfällt |
| B17 | `klartext.ts` | entfällt |
| zugang_fehlt | `zoom-text.ts`, `MANGEL_GRUND.zugang_fehlt` | entfällt |
| zugang_unlesbar | `zoom-text.ts`, `MANGEL_GRUND.zugang_unlesbar` | entfällt |

---

Freigabe: ☐ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren)
