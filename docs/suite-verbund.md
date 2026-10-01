# Verbund: die Suite auf mehreren Rechnern

Ein Launcher ist **Master**, die anderen Rechner koppeln sich **einmal** mit ihm. Danach verbinden sich Launcher und Tools jedes gekoppelten Rechners bei jedem Start selbst, auch wenn sich die IP-Adressen ändern.

Stand Teil 1: Der Master sieht je Rechner, welche Tools laufen. Show-Daten über das Netz, Fernstart und die Show-Zentrale folgen in den nächsten Teilen.

## Master einschalten

1. Launcher → Kopfanzeige **Verbund** (oder Einstellungen → Verbund öffnen).
2. Rolle **Master** wählen. Die Kopfanzeige zeigt „Master · noch keine Rechner“.
3. Optional den **Namen des Masters** ändern (z. B. „Regie-PC“) und das **Netzwerk der Suite** wählen (siehe unten). Den Namen des Masters zeigen die anderen Rechner in ihrer Kopfanzeige; er beginnt als „Name dieses Rechners“. Eine Umbenennung erreicht die anderen Rechner bei ihrer nächsten Verbindung.

## Rechner koppeln

1. **Am Master:** **Rechner koppeln**. Es erscheint ein Code wie `K7QXM-3PRTH`. Er gilt 2 Minuten und für höchstens 5 Fehlversuche.
2. **Am anderen Rechner:** Rolle **Mit Master verbinden**, den Master in der Liste wählen (oder seine Adresse von Hand eintragen), den Code eintippen, **Koppeln**.
3. Fertig. Alle Tools dieses Rechners, die den Verbund schon kennen (Timer ab 0.12.0, Titler ab 0.9.0; andere Tools nach ihrem Update), verbinden sich jetzt selbst mit dem Master, auch ohne laufenden Launcher.

Groß-/Kleinschreibung, Leerzeichen und der Bindestrich im Code sind egal. Die Zeichen 0, 1, I, L, O kommen nie vor.

Ein Code geht höchstens **einmal** an ein Gegenüber. Scheitert ein Versuch, nachdem der Master (oder ein anderes Gerät) den Code schon bekommen hat, leert das Modal das Codefeld; ein zweiter Versuch mit demselben Code wird abgelehnt: „Dieser Code wurde schon gesendet. Am Master „Neuer Code“ holen.“

## Netzwerk der Suite

- **Automatisch** (Vorgabe) nutzt alle Netzwerkkarten.
- Eine **bestimmte Karte** wählen, wenn der Rechner mehrere Netze hat (Hyper-V, VPN, zweite Karte). Dann bevorzugt der Verbund Adressen in diesem Netz.
- Fehlt die gewählte Karte bei einem späteren Einsatz, arbeitet der Rechner mit Automatisch weiter und zeigt „· Karte fehlt“.

## Über VLAN-Grenzen: feste Master-Adresse

Die automatische Suche (mDNS) endet an der Grenze des eigenen Netzes. Liegen Master und Rechner in verschiedenen VLANs:
- Beim Koppeln die Master-Adresse **von Hand** eintragen. Sie wird dabei zur **festen Master-Adresse**.
- Später lässt sie sich unter **Feste Master-Adresse** ändern oder nachtragen: `10.0.0.110` oder `10.0.0.110:8738`. Ein anderer Port als der der Kopplung wird abgelehnt.

Das ist gefahrlos: Jede Verbindung prüft das Zertifikat des Masters, eine falsche Adresse kann sich nicht als Master ausgeben.

## Was die Kopfanzeige sagt

„Neu koppeln“ heißt bei einem gekoppelten Rechner: **Verbund → Trennen, dann neu koppeln** (mit einem neuen Code vom Master). Ein Fehler bleibt stehen, während der Rechner es weiter versucht, bis er verbunden ist oder sich die Ursache ändert.

| Anzeige | Bedeutung | Was tun |
| --- | --- | --- |
| Verbund aus | Rolle „Aus“: Einzelplatz, kein Netzverkehr des Verbunds | — |
| Kopplungsdatei gesperrt: EBUSY | Kopplungsdatei gerade nicht lesbar (Virenscanner, Sicherung); der Launcher ändert nichts daran | kurz warten, der Verbund startet von selbst; bleibt es, Virenscanner prüfen |
| **Am Master** | | |
| Master startet… | der Master-Link startet gerade | kurz warten |
| Master · noch keine Rechner | Master läuft, noch kein anderer Rechner gekoppelt | Rechner koppeln |
| Master · 2/2 Rechner online | alle gekoppelten Rechner verbunden (grün) | — |
| Master · 1/2 Rechner online | ein gekoppelter Rechner fehlt (gelb) | im Modal nachsehen, welcher offline ist |
| Master: Port 8738 belegt | ein anderes Programm (oder ein zweiter Launcher) hält Port 8738; der Master versucht es alle 10 s erneut | anderes Programm beenden; kommt von selbst wieder |
| Master: Verbunddaten beschädigt | Identität bzw. Verbundliste des Masters beschädigt, auch die Sicherung; der Master lauscht nicht und überschreibt nichts | Verbund → **Verbund neu aufsetzen** — danach alle Rechner neu koppeln |
| Master-Fehler: EACCES | der Master kann nicht lauschen (Fehlercode); neuer Versuch alle 10 s | bleibt es: Firewall/Sicherheitssoftware prüfen, Launcher neu starten |
| **Am anderen Rechner** | | |
| Nicht gekoppelt: Master wählen | Rolle „Mit Master verbinden“, noch keine Kopplung | Master wählen, Code eintippen, Koppeln |
| Koppeln mit Regie-PC… | Koppeln läuft (höchstens 10 s) | kurz warten |
| Suche Regie-PC… | Master wird gesucht | kurz warten |
| Verbinde mit Regie-PC… | Master gefunden, Anmeldung läuft | kurz warten |
| Regie-PC ● | verbunden | — |
| Regie-PC sichtbar, Port gesperrt: Firewall? | Master antwortet im Netz, Port 8738 kommt nicht durch | Firewall am Master (siehe unten) |
| Regie-PC nicht erreichbar | Master aus, Launcher/Master-Modus aus, anderes Netz oder Firewall | Master prüfen; gleiches Netz? sonst feste Adresse |
| Regie-PC: Master-Modus aus? | am Master lauscht niemand auf 8738 | am Master Rolle „Master“ wählen |
| Regie-PC: Netz nicht erreichbar | kein Weg ins Netz des Masters | Kabel/WLAN und Netzwerk der Suite prüfen |
| Adresse antwortet nicht als Master | unter der Adresse läuft ein anderer Dienst | feste Adresse prüfen |
| Anderer Master unter dieser Adresse | Master neu aufgesetzt oder falsches Gerät | Verbund → Trennen, dann neu koppeln |
| Uhrzeit prüfen | Uhrzeit dieses Rechners oder des Masters falsch | Uhrzeit stellen |
| Versionen angleichen | Launcher/Tools unterschiedlich alt | alle Rechner aktualisieren |
| Vom Master entfernt: neu koppeln | am Master entfernt | Verbund → Trennen, dann neu koppeln |
| Anmeldung abgelehnt: neu koppeln | der Schlüssel passt nicht mehr zur Kopplung (z. B. ein Klon hat mit derselben Kennung neu gekoppelt) | Rechner geklont? siehe unten „Neue Kennung“; sonst Verbund → Trennen, dann neu koppeln |
| Kennung doppelt: neu koppeln | Kopplungsdatei kopiert oder Rechner geklont: zwei Rechner mit derselben Kennung | auf dem **kopierten** Rechner „Neue Kennung“ (siehe unten) |
| Kopplung beschädigt: neu koppeln | Inhalt der Kopplungsdatei ungültig | neu koppeln |
| Verbindungsfehler ECONNRESET | anderer Netzfehler (Fehlercode) | bleibt es: Netz prüfen, Logs ansehen |

Hängt „· Karte fehlt“ an (z. B. „Regie-PC ● · Karte fehlt“), fehlt die gewählte Netzwerkkarte; der Rechner nutzt Automatisch. In roten Anzeigen steht der Hinweis nur im Modal.

In der Liste „Tools dieses Rechners“ (am Master und an den anderen Rechnern) steht bei älteren Tools „läuft, noch ohne Verbund (Update nötig)“. Diese Tools arbeiten normal weiter und kommen mit ihrem nächsten Update in den Verbund.

## Meldungen im Modal

| Meldung | Bedeutung | Was tun |
| --- | --- | --- |
| Nicht gespeichert (EPERM). Bitte noch einmal versuchen. | eine Änderung (Rolle, Name, Karte, Adresse) konnte nicht gespeichert werden; es gilt der vorige Stand | noch einmal versuchen; bleibt es, Virenscanner/Schreibrechte prüfen |
| Kopplung konnte auf diesem Rechner nicht gespeichert werden (EPERM). | der Master hat bestätigt, aber dieser Rechner konnte die Kopplung nicht speichern; es gilt nichts als gekoppelt | am Master den Eintrag entfernen, Ursache beheben, mit neuem Code neu koppeln |
| Verbund nicht gespeichert (EPERM) — Änderungen gelten nur bis zum Neustart | am Master lässt sich die Verbundliste nicht speichern (Datenträger voll, Schreibschutz); Koppeln und Entfernen wirken, sind nach einem Neustart aber weg | Ursache beheben; die Meldung verschwindet, sobald wieder gespeichert wurde |
| Dieser Code wurde schon gesendet. Am Master „Neuer Code“ holen. | dieser Code ging schon einmal hinaus und wird aus Sicherheitsgründen nie ein zweites Mal gesendet | am Master „Neuer Code“, den neuen Code eintippen |
| Dieser Rechner hat dieselbe Kennung wie der Master (Ordner kopiert?). „Neue Kennung“ wählen, dann koppeln. | dieser Rechner ist eine Kopie des Masters | „Neue Kennung“, dann koppeln |

## Rechner geklont oder Ordner kopiert

Zwei Rechner mit derselben Kennung verdrängen einander am Master: einer zeigt „Kennung doppelt: neu koppeln“ oder „Anmeldung abgelehnt: neu koppeln“.

1. **Auf dem kopierten Rechner** (dem mit „Kennung doppelt“ bzw. „Anmeldung abgelehnt“): Verbund → **Neue Kennung** → bestätigen. Er bekommt eine eigene Kennung, seine Kopplung wird gelöscht.
2. Am Master **Rechner koppeln**, am kopierten Rechner mit dem neuen Code koppeln. Beide Rechner sind danach verbunden und stehen einzeln in der Liste.
3. Steht am Master ein Eintrag, der zu keinem Rechner mehr gehört (dauerhaft offline), dort **Entfernen**.

„Trennen“ und neu koppeln **ohne** „Neue Kennung“ hilft hier nicht: Der Klon übernähme die Kopplung des Originals, und das Original würde ausgesperrt.

**Geklonter Master-PC:** Auf dem Klon die Rolle **Aus** wählen. Soll der Klon selbst ein eigener Master werden, dort danach „Master-Identität erneuern“ (bzw. „Verbund neu aufsetzen“, wenn er „Master: Verbunddaten beschädigt“ zeigt) — seine Rechner koppeln sich dann neu. Den Ordner `%APPDATA%\@jm\launcher\master-link\` (Identität und Verbundliste des Masters) nie in ein Image übernehmen.

## Firewall (Windows)

- **Beim Einschalten des Master-Modus kommt meist keine Abfrage.** Der Launcher hat seine Freigabe schon beim ersten Start bekommen.
- **Entscheidend sind die Regel für „JM Production Suite“ und das Netzwerkprofil.** Windows stuft ein Netz ohne Internet-Gateway, also viele Veranstaltungsnetze, als **Öffentlich** ein. Eine Regel, die nur für „Privat“ gilt, sperrt den Master dort still.

Abhilfe (am Master, mit Adminrechten):
1. `wf.msc` öffnen → **Eingehende Regeln** → nach „JM Production Suite“ filtern.
2. Die Regeln müssen **Zulassen** sein und für die Profile **Privat und Öffentlich** gelten. Gibt es eine **Blockieren**-Regel, diese löschen oder auf Zulassen stellen.
3. Alternativ das Netz auf „Privat“ stellen (PowerShell als Administrator): `Set-NetConnectionProfile -InterfaceAlias "Ethernet 2" -NetworkCategory Private`

Tools, die bisher nichts im Netz angeboten haben, können beim ersten Start mit aktivem Verbund **eine eigene** Abfrage zeigen: zulassen. Wer ablehnt, sperrt nur deren automatische Suche. Die Verbindung über bekannte und feste Adressen bleibt.

## Wichtig

- **`master-link.json` nie kopieren und nicht in Rechner-Images übernehmen.** Die Datei liegt unter `%APPDATA%\JM Production Suite\`. Ein Klon meldet sonst „Kennung doppelt“ (Abhilfe oben).
- **Der Launcher folgt der Datei:** Wird `master-link.json` gelöscht oder von Hand geändert, übernimmt er den Stand binnen weniger Sekunden (gelöscht → „Verbund aus“). Er schreibt eine gelöschte Datei nicht zurück.
- **Beschädigte `master-link.json` am Master-PC:** Der Launcher startet dann als „Mit Master verbinden“ mit „Kopplung beschädigt“. Einfach die Rolle **Master** wieder wählen — Identität und Verbundliste liegen woanders, die anderen Rechner bleiben gekoppelt.
- **Die `control.json` muss für den Verbund nicht mehr zwischen Rechnern kopiert werden.** Die sichere Steuerebene (Companion) bleibt davon unberührt.
- **Master-Identität erneuern** nur bei Verdacht auf Missbrauch oder beim Tausch des Master-Rechners. Danach müssen alle anderen Rechner neu gekoppelt werden.
- **Grenzen:** nur IPv4, kein Betrieb über das Internet, ein Master je Rechnerverbund.
