# Verbund: die Suite auf mehreren Rechnern

Ein Launcher ist **Master**, die anderen Rechner koppeln sich **einmal** mit ihm. Danach verbinden sich Launcher und Tools jedes gekoppelten Rechners bei jedem Start selbst, auch wenn sich die IP-Adressen ändern.

Stand Teil 1: Der Master sieht je Rechner, welche Tools laufen. Show-Daten über das Netz, Fernstart und die Show-Zentrale folgen in den nächsten Teilen.

## Master einschalten

1. Launcher → Kopfanzeige **Verbund** (oder Einstellungen → Verbund öffnen).
2. Rolle **Master** wählen. Die Kopfanzeige zeigt „Master · noch keine Rechner“.
3. Optional einen Namen vergeben (z. B. „Regie-PC“) und das **Netzwerk der Suite** wählen (siehe unten).

## Rechner koppeln

1. **Am Master:** **Rechner koppeln**. Es erscheint ein Code wie `K7QXM-3PRTH`. Er gilt 2 Minuten und für höchstens 5 Fehlversuche.
2. **Am anderen Rechner:** Rolle **Mit Master verbinden**, den Master in der Liste wählen (oder seine Adresse von Hand eintragen), den Code eintippen, **Koppeln**.
3. Fertig. Alle Tools dieses Rechners verbinden sich jetzt selbst mit dem Master, auch ohne laufenden Launcher.

Groß-/Kleinschreibung, Leerzeichen und der Bindestrich im Code sind egal. Die Zeichen 0, 1, I, L, O kommen nie vor.

## Netzwerk der Suite

- **Automatisch** (Vorgabe) nutzt alle Netzwerkkarten.
- Eine **bestimmte Karte** wählen, wenn der Rechner mehrere Netze hat (Hyper-V, VPN, zweite Karte). Dann bevorzugt der Verbund Adressen in diesem Netz.
- Fehlt die gewählte Karte bei einem späteren Einsatz, arbeitet der Rechner mit Automatisch weiter und zeigt „Karte fehlt“.

## Über VLAN-Grenzen: feste Master-Adresse

Die automatische Suche (mDNS) endet an der Grenze des eigenen Netzes. Liegen Master und Rechner in verschiedenen VLANs:
- Beim Koppeln die Master-Adresse **von Hand** eintragen. Sie wird dabei zur **festen Master-Adresse**.
- Später lässt sie sich unter **Feste Master-Adresse** ändern oder nachtragen.

Das ist gefahrlos: Jede Verbindung prüft das Zertifikat des Masters, eine falsche Adresse kann sich nicht als Master ausgeben.

## Was die Kopfanzeige sagt

| Anzeige | Bedeutung | Was tun |
| --- | --- | --- |
| Regie-PC ● | verbunden | — |
| Suche Regie-PC… | Master wird gesucht | kurz warten |
| Regie-PC nicht erreichbar | Master aus, Launcher/Master-Modus aus, anderes Netz oder Firewall | Master prüfen; gleiches Netz? sonst feste Adresse |
| Regie-PC sichtbar, Port gesperrt: Firewall? | Master antwortet im Netz, Port 8738 kommt nicht durch | Firewall am Master (siehe unten) |
| Anderer Master unter dieser Adresse | Master neu aufgesetzt oder falsches Gerät | neu koppeln |
| Uhrzeit prüfen | Uhrzeit dieses Rechners oder des Masters falsch | Uhrzeit stellen |
| Versionen angleichen | Launcher/Tools unterschiedlich alt | alle Rechner aktualisieren |
| Vom Master entfernt: neu koppeln | am Master entfernt | neu koppeln |
| Kennung doppelt: neu koppeln | Kopplungsdatei kopiert oder Rechner geklont | auf diesem Rechner Trennen, neu koppeln |
| Kopplung beschädigt: neu koppeln | Inhalt der Kopplungsdatei ungültig | neu koppeln |
| Kopplungsdatei gesperrt: EBUSY | Kopplungsdatei gerade nicht lesbar (Virenscanner, Sicherung); der Launcher ändert nichts daran | kurz warten, der Verbund startet von selbst; bleibt es, Virenscanner prüfen |

In der Liste „Tools dieses Rechners“ steht bei älteren Tools „läuft, noch ohne Verbund (Update nötig)“. Diese Tools arbeiten normal weiter und kommen mit ihrem nächsten Update in den Verbund.

## Firewall (Windows)

- **Beim Einschalten des Master-Modus kommt meist keine Abfrage.** Der Launcher hat seine Freigabe schon beim ersten Start bekommen.
- **Entscheidend sind die Regel für „JM Production Suite“ und das Netzwerkprofil.** Windows stuft ein Netz ohne Internet-Gateway, also viele Veranstaltungsnetze, als **Öffentlich** ein. Eine Regel, die nur für „Privat“ gilt, sperrt den Master dort still.

Abhilfe (am Master, mit Adminrechten):
1. `wf.msc` öffnen → **Eingehende Regeln** → nach „JM Production Suite“ filtern.
2. Die Regeln müssen **Zulassen** sein und für die Profile **Privat und Öffentlich** gelten. Gibt es eine **Blockieren**-Regel, diese löschen oder auf Zulassen stellen.
3. Alternativ das Netz auf „Privat“ stellen (PowerShell als Administrator): `Set-NetConnectionProfile -InterfaceAlias "Ethernet 2" -NetworkCategory Private`

Tools, die bisher nichts im Netz angeboten haben, können beim ersten Start mit aktivem Verbund **eine eigene** Abfrage zeigen: zulassen. Wer ablehnt, sperrt nur deren automatische Suche. Die Verbindung über bekannte und feste Adressen bleibt.

## Wichtig

- **`master-link.json` nie kopieren und nicht in Rechner-Images übernehmen.** Die Datei liegt unter `%APPDATA%\JM Production Suite\`. Ein Klon meldet sonst „Kennung doppelt“.
- **Die `control.json` muss für den Verbund nicht mehr zwischen Rechnern kopiert werden.** Die sichere Steuerebene (Companion) bleibt davon unberührt.
- **Master-Identität erneuern** nur bei Verdacht auf Missbrauch oder beim Tausch des Master-Rechners. Danach müssen alle anderen Rechner neu gekoppelt werden.
- **Grenzen:** nur IPv4, kein Betrieb über das Internet, ein Master je Rechnerverbund.
