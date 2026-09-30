# Master-Link, Teil 1: Rechner koppeln, Master finden, sehen wer da ist

**Anlass:** Die Suite läuft auf einem Rechner, aber nicht über mehrere. Tools auf einem zweiten Rechner lassen sich nicht öffnen und bekommen keine iveo-Live-Daten.
**Vorgänger:** Teil 0 „Sofort-Fixes“ (PR #237, released 30.09.2026: Launcher 0.11.1, Timer 0.11.2, Titler 0.8.2)
**Behebt:** #234 (falsche Adresse bei mehreren Netzwerkkarten). #235 (Rundown-Abgleich) gehört zu Teil 2.
**Gesamtplan:** Ansatz A „Stern zum Master“, Teile 0 → 1 → 2 → 3 → 4. Teil 1 ist das Fundament.
**Ziel in einem Satz:** Ein Launcher kann Master sein. Andere Rechner koppeln sich einmal mit einem Code und finden ihn danach selbst wieder, auch wenn sich das Netz ändert. Der Master sieht pro Rechner, welche Tools laufen.

In Teil 1 fließen **noch keine Show-Daten** (das macht Teil 2), es gibt **keinen Fernstart** (Teil 3) und **keine Show-Zentrale** (Teil 4). Teil 1 liefert die Leitung, auf der das alles später läuft, und beweist sie im echten Netz.

---

## 1 · Ausgangslage (nachgemessen, nicht angenommen)

| Tatsache | Fundstelle |
| --- | --- |
| **Presence ist nur lokal.** Der Hub lauscht auf `127.0.0.1:7799` und kennt nur die appId, keinen Rechner. Ein Tool auf einem anderen Rechner gilt nie als laufend. | `apps/launcher/src/main/presence.ts:13`, `:80` |
| **Tools melden sich über `@jm/app-runtime`.** `initAppRuntime()` startet den Heartbeat alle 10 s (hello/beat/bye). Der Launcher selbst ruft `initAppRuntime` mit `presence: false`. | `packages/app-runtime/src/index.ts:291`, `:543`; `apps/launcher/src/main/index.ts:24-28` |
| **Die gemeinsame Datei pro Rechner ist ein bewährtes Muster.** `<appData>/JM Production Suite/control.json`, gelesen von allen Tools, geschrieben vom Launcher, mit Bereinigung beim Lesen. | `packages/control-config/src/index.ts:33-75` |
| **`mode: 0o600` schützt unter Windows nichts.** Den Schutz liefert dort das Benutzerprofil (`%APPDATA%` ist nur für den Benutzer lesbar). Unter macOS wirkt 0600. | Node-Doku `fs.writeFile` mode; `control-config` `:66-70` |
| **Krypto-Bausteine sind da.** `randomNonce`, `hmacProof`/`verifyProof` (HMAC-SHA256, Vergleich in konstanter Zeit), `certFingerprint` (SHA-256 aus dem Zertifikat). Selbstsignierte Zertifikate erzeugt der Launcher mit `selfsigned`. | `packages/auth-core/src/token.ts`, `cert.ts`; `apps/launcher/src/main/control-provision.ts:43` |
| **mDNS kann auf eine Netzwerkkarte beschränkt werden.** `new Bonjour(opts)` reicht `opts` an `multicast-dns` weiter, und dieses nutzt `opts.interface` für Bindung und Multicast. | `node_modules/bonjour-service/dist/lib/mdns-server.js:11-13`; `node_modules/multicast-dns/index.js:65`, `:134`, `:153` |
| **Ursache #234:** `@jm/discovery` nimmt „die erste IPv4 der Annonce“. Bei Hyper-V-, VPN- oder Zweitkarten ist das oft die falsche. | `packages/discovery/src/index.ts:118` |
| **mDNS endet an der Subnetzgrenze** (VLANs im Studio). | `docs/Best Practices/Studio Infra optimiert.md:165-168` |
| **Port 8738 ist in der Suite frei.** Belegt sind 7777–7783, 7799, 8723–8737. | `grep` über das Repo |
| **Die CI führt nur Typprüfung und Secret-Scan aus, mit Node 20.** Die Selbsttests (`node --experimental-strip-types`) brauchen Node ≥ 22.6. | `.github/workflows/ci-checks.yml:24-30` |

---

## 2 · Rollen und Aufstellung

- **Gekoppelt wird der Rechner, nicht jedes Tool.** Gekoppelt wird einmal pro Rechner im Launcher. Das Ergebnis steht in der gemeinsamen Datei `<appData>/JM Production Suite/master-link.json` (Abschnitt 7).
- **Jedes Tool verbindet sich selbst mit dem Master.** Es liest dafür diese Datei. Das Tool hängt also direkt am Master, auch wenn der Launcher auf diesem Rechner nicht läuft (Aufstellung „Launcher ↔ einzelne Tools“).
- **Läuft der Launcher auf einem gekoppelten Rechner, ist er zusätzlich Teilnehmer der Art `launcher`** (Aufstellung „Master ↔ Slave-Launcher“). In Teil 1 meldet er nur sich selbst. Ab Teil 3 nimmt er Startbefehle an.
- **Master** ist ein Launcher mit eingeschaltetem „Master für andere Rechner“. Er betreibt den **Master-Link** auf Port **8738**, immer TLS, mit eigenem Zertifikat. Er hat einen Namen (vom Bediener, Vorgabe: Rechnername) und eine feste Kennung (`masterId`, UUID). Beides bleibt über Neustarts gleich.
- **Stern:** Alle verbinden sich zum Master, nie ein Slave zum anderen.
- **Genau ein Master pro Rechner.** Ein Rechner ist mit genau einem Master gekoppelt. Umkoppeln geht jederzeit. Ein Master ist nie gleichzeitig Slave.
- **Auch der Master-Rechner selbst ist gekoppelt**, automatisch und ohne Code. Seine Tools verbinden sich über `127.0.0.1:8738` wie alle anderen. So gibt es einen einzigen Weg, auf dem Teil 2 Daten verteilt, und die Liste am Master ist vollständig. Der Eintrag „dieser Rechner“ lässt sich nicht entfernen.
- **Rolle „aus“ (Vorgabe):** keine Datei-Kopplung, kein Netzverkehr des Master-Links, alles wie heute.
- **Die heutige Steuerebene bleibt unberührt:** `control.json`, der sichere Modus, Health-Pool, Companion, RELOAD, Port 8736. Alles *zwischen Rechnern* kommt künftig über den Master-Link. `control.json` muss niemand mehr kopieren.

---

## 3 · Koppeln

### 3.1 Ablauf für den Bediener

1. **Am Master:** Der Bediener klickt „Rechner koppeln“ und bekommt einen **10-Zeichen-Code**, angezeigt als `K7QXM-3PRTH`. Er ist **2 Minuten** gültig, und ein Countdown ist sichtbar.
2. **Am Slave-Launcher:** „Mit Master verbinden“ listet die gefundenen Master (Name, Adresse, gekürzter Fingerprint). Wahlweise trägt man eine Adresse von Hand ein. Dann Master wählen, Code tippen, fertig. Vorher lässt sich der **Name dieses Rechners** anpassen (Vorgabe: Rechnername).
3. Danach verbindet sich der Rechner bei jedem Start ohne Zutun wieder, ebenso jedes Tool auf ihm.
4. **Am Master:** Die Liste „Gekoppelte Rechner“ zeigt Name, online/offline, zuletzt gesehen und Adresse. Jeder Eintrag hat „Entfernen“.

### 3.2 Der Code

- **Alphabet:** 31 Zeichen ohne Verwechsler, `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (ohne 0, 1, I, L, O).
- **Länge:** 10 Zeichen, also 31¹⁰ ≈ 2⁴⁹·⁵ Möglichkeiten.
- **Erzeugung:** `crypto.randomInt` pro Zeichen, ohne Modulo-Verzerrung.
- **Eingabe verzeihend:**
  - Kleinbuchstaben werden groß.
  - Leerzeichen und Bindestriche fallen weg.
  - Ein Zeichen außerhalb des Alphabets meldet der Slave **lokal** („Das Zeichen O kommt im Code nicht vor“). Das zählt nicht als Fehlversuch.
- **Einmal-Code:**
  - Nach Erfolg ist er verbraucht.
  - Nach **5 Fehlversuchen** ist er ungültig, und der Master bietet einen neuen an.
  - Nach 2 Minuten ist er abgelaufen.
- **Nur ein Code gleichzeitig.** Ein neuer Code ersetzt den alten.
- **Ohne offenen Code** lehnt der Master jede Kopplungsanfrage ab: `grund: "keine-kopplung-offen"`.
- **Der Code erscheint nie im Log.**

**Warum 10 Zeichen:** Beim ersten Kontakt kennt der Slave das Zertifikat des Masters noch nicht.
- Ein Angreifer, der sich als Master ausgibt, bekommt den Beweis des Slaves und kann den Code **offline** durchprobieren.
- Bei 6 Ziffern dauert das Millisekunden, bei ≈ 2⁵⁰ mit Spezialhardware Tage. Der Code lebt aber nur 2 Minuten.
- Online-Raten gegen den echten Master: 5 Versuche pro Code, also ≈ 5 / 2⁴⁹·⁵.
- PAKE (kurze Codes, stärker) scheidet aus, weil es eine zusätzliche Krypto-Bibliothek und viel Komplexität bräuchte. Der Abgleich „6 Ziffern + Fingerprint mit dem Auge“ scheidet aus, weil er fehleranfällig ist.

### 3.3 Der Kopplungs-Handshake (beidseitig, an das Zertifikat gebunden)

Bezeichnungen:
- `K`: Code, normalisiert
- `fp`: SHA-256-Fingerprint des Server-Zertifikats. **Der Slave nimmt den, den er in dieser TLS-Verbindung tatsächlich sieht. Der Master nimmt seinen eigenen.**
- `Ns`: Nonce des Masters
- `Nc`: Nonce des Slaves
- `R`: `rechnerId` des Slaves
- `P`: öffentlicher Schlüssel des Slaves (Abschnitt 3.4)
- `M`: `masterId`

```
Slave → Master   koppeln { R, name, Nc, P,
                   beweis = HMAC-SHA256(K, "jm-master-link/1/koppeln/slave"  | fp | Ns | Nc | R | P) }
Master           prüft den Beweis mit SEINEM fp (Vergleich in konstanter Zeit)
                 falsch → Fehlversuch zählen, abgelehnt { grund: "code-falsch" }
Master → Slave   gekoppelt { M, name,
                   beweis = HMAC-SHA256(K, "jm-master-link/1/koppeln/master" | fp | Ns | Nc | R | P | M) }
Slave            prüft den Beweis des Masters mit dem fp, den er SIEHT
                 falsch → nichts speichern, Fehler „Master konnte den Code nicht bestätigen“
                 richtig → Zertifikat aus der TLS-Sitzung (getPeerCertificate().raw) als PEM
                           plus fp pinnen, Kopplung in master-link.json schreiben
```

- **Mittelsmann mit eigenem Zertifikat:** Der Slave sieht `fp'` und rechnet mit `fp'`. Der echte Master rechnet mit `fp` und lehnt ab. Das zählt als Fehlversuch. Einen Beweis des Masters für `fp'` kann der Angreifer ohne Code nicht fälschen. Der Slave pinnt deshalb nie ein falsches Zertifikat.
- **`P` steckt in beiden Beweisen.** Niemand kann den Schlüssel des Slaves unterwegs austauschen.
- **Die Trennzeichen `|` sind eindeutig.** Alle Felder sind Hex- oder Base64-Werte bzw. UUIDs ohne `|`. Der Name ist bewusst nicht Teil des Beweises.
- **Nach `gekoppelt`** geht dieselbe Verbindung direkt in den angemeldeten Zustand über (Abschnitt 6.3). Es gibt keinen zweiten Verbindungsaufbau.

### 3.4 Zugang je Rechner: Schlüsselpaar statt Token (⚠ Präzisierung von Abschnitt 2 der Besprechung)

In der Besprechung standen zwei Sätze, die technisch nicht zusammenpassen:
- „Der Master speichert vom Rechner-Token nur einen Hash.“
- „Wiederverbinden per Challenge/HMAC mit dem Rechner-Token.“

Für ein HMAC braucht der Master das Token selbst. Ein gespeicherter Hash wäre dann selbst der Schlüssel.

**Lösung, die beides einlöst:** Jeder Rechner erzeugt beim Koppeln ein **Ed25519-Schlüsselpaar**. Das geht mit `node:crypto` (`generateKeyPairSync('ed25519')`) ohne neue Bibliothek.
- Der Master speichert nur den **öffentlichen** Schlüssel. Er hält damit **gar kein** Geheimnis über seine Slaves, was mehr ist als ein Hash.
- **Wiederverbinden:**
  1. Der Master schickt eine frische Nonce.
  2. Der Slave antwortet mit der Signatur über `"jm-master-link/1/anmelden" | fp | Ns | R`.
  3. Der Master prüft sie gegen den gespeicherten öffentlichen Schlüssel.

  Es geht kein Geheimnis über die Leitung, und eine Wiederholung ist wegen der Nonce nutzlos.
- **„Entfernen“** löscht den öffentlichen Schlüssel. Danach wird jede Anmeldung dieses Rechners mit `grund: "unbekannt"` abgelehnt, und alle anderen verbinden weiter.
- Der private Schlüssel liegt in `master-link.json` des Slaves (Abschnitt 7) und erscheint nie im Log.
- `@jm/auth-core` liefert weiterhin Nonce, HMAC und Fingerprint.

### 3.5 Identität des Masters

- `masterId`, Name, Zertifikat und privater Schlüssel liegen in `<userData des Launchers>/master-link/identitaet.json`, **nicht** in der gemeinsamen Datei.
- Erzeugt werden sie beim ersten Einschalten des Master-Modus: `selfsigned`, CN `jm-master-link`, Laufzeit 10 Jahre.
- **Neu aufsetzen** nur auf ausdrücklichen Befehl („Master-Identität erneuern“). Die Oberfläche sagt vorher: „Alle gekoppelten Rechner müssen danach neu gekoppelt werden.“ Die Liste der gekoppelten Rechner wird dabei geleert.

---

## 4 · Finden und Netzwerkwahl (#234)

### 4.1 Netzwerkwahl pro Rechner

- **Launcher → Verbund → „Netzwerk der Suite“:** **Automatisch** (Vorgabe) oder eine bestimmte Netzwerkkarte.
- **Die Liste zeigt** Name, IPv4-Adresse und Präfix, z. B. `Ethernet 2 · 10.0.0.110/24`.
  - Ausgeblendet sind `internal` und 169.254.0.0/16.
  - **Als virtuell markiert** werden Karten, deren Name einem Muster entspricht: `vEthernet`, `Hyper-V`, `VirtualBox`, `VMware`, `WSL`, `Tailscale`, `ZeroTier`, `TAP`, `VPN`, `Loopback Pseudo`. Das ist eine Heuristik und dient nur zur Anzeige und Rangfolge.
- **Gespeichert wird der Kartenname, nicht die IP.** IPs wechseln je Einsatz, Kartennamen bleiben am Rechner gleich.
- **Die Wahl steht in `master-link.json`** und gilt für Launcher und Tools dieses Rechners.
- **Fehlt die gewählte Karte** (anderer Einsatz, Kabel ab), arbeitet der Rechner mit **Automatisch** weiter und zeigt den Hinweis „Gewählte Netzwerkkarte ‚Ethernet 2‘ nicht vorhanden, nutze Automatisch“. Er bleibt also nicht stehen.
- Der Rechner prüft die Karten alle 10 s (`os.networkInterfaces()`). Ändert sich etwas, bindet und annonciert der Master neu.

### 4.2 Master: lauschen und annoncieren

- **Automatisch:**
  - lauscht auf `0.0.0.0:8738`
  - mDNS auf allen Karten
- **Gewählte Karte:**
  - lauscht auf `<Karten-IP>:8738` **und** `127.0.0.1:8738` (für die eigenen Tools)
  - mDNS nur auf dieser Karte (`new Bonjour({ interface: ip })`)
- **Eigener Diensttyp `_jmps-master._tcp`.** Die bestehenden Tools, Companion und Stage Display browsen `_jmps._tcp` und sehen davon nichts.
  - **TXT:** `id` (masterId), `name`, `fp` (die ersten 16 Hex-Zeichen des Fingerprints, nur zur Anzeige), `p` (Protokollversion)
  - **Die TXT-Werte sind unbeglaubigt.** Vertrauen entsteht ausschließlich über das gepinnte Zertifikat (Kopplung) bzw. den Kopplungsbeweis.

### 4.3 Slave: Adresse wählen (die eigentliche Behebung von #234)

Eine **reine Funktion** `ordneKandidaten(masterAdressen, eigeneKarten, gewaehlteKarte)` liefert die Reihenfolge der Adressen:

1. Verworfen werden 169.254.x, IPv6 (Teil 1 ist IPv4) sowie Loopback. Loopback bleibt nur, wenn der Master dieser Rechner selbst ist.
2. Rangfolge:
   1. im Subnetz der gewählten Karte
   2. im Subnetz einer nicht virtuellen eigenen Karte
   3. im Subnetz einer virtuellen eigenen Karte
   4. der Rest in Annonce-Reihenfolge

### 4.4 Master wiederfinden (gekoppelt)

**Reihenfolge der Kandidaten:**
1. per mDNS gefundene Adressen **mit passender `id`**, geordnet nach 4.3
2. zuletzt erfolgreiche Adresse (im Speicher des Prozesses; beim Launcher zusätzlich in der Datei)
3. die beim Koppeln bekannten Adressen aus der Datei
4. die **feste Master-Adresse**, falls eingetragen

**Verbindungsaufbau:**
- Die Kandidaten werden nacheinander versucht, je **3 s** Timeout für den TCP-Aufbau und TLS.
- Der erste Kandidat mit passendem Zertifikat und erfolgreicher Anmeldung gewinnt.

**Warum das gefahrlos ist:**
- Jede Verbindung prüft den gepinnten Fingerprint.
- Eine falsche Adresse kann sich nicht als Master ausgeben.

**Feste Master-Adresse** (Rückfall für VLANs, weil mDNS nicht über Subnetze reicht):
- Sie ist beim Koppeln und später einstellbar.
- Auch das Koppeln selbst geht über eine von Hand eingetragene Adresse.

**Wiederholen:**
- Das Intervall steigt 1 s → 2 s → 4 s → 8 s, danach alle 10 s.
- **Ausnahmen:**
  - `unbekannt` (entfernt): keine Wiederholung, bis neu gekoppelt wird
  - Zertifikat passt nicht: Wiederholung nur alle 30 s (falls es eine vorübergehend falsche IP ist)
  - Protokoll passt nicht: Wiederholung nur alle 60 s (falls der Master aktualisiert wird)

### 4.5 Firewall

- Kein Installer legt heute Firewall-Regeln an, und Teil 1 ändert das nicht (Adminrechte nötig).
- **Was beim ersten Lauschen passiert:** Beim ersten Lauschen auf einer Nicht-Loopback-Adresse fragt Windows „Zugriff zulassen?“.
  - Wer „Abbrechen“ klickt, erzeugt eine **Blockregel**, und der Master ist von außen unsichtbar.
  - Das Handbuch (`docs/`) beschreibt die Abhilfe in der Windows-Firewall.
  - mDNS (UDP 5353) ist durch die bestehende Suite-Discovery normalerweise schon freigegeben.
- **Der Slave unterscheidet die Ursachen** (Abschnitt 9) statt nur „nicht verbunden“ zu melden.

---

## 5 · Status: wer ist da?

### 5.1 Anmeldung und Lebenszeichen

- **Jeder Teilnehmer meldet sich über seine Verbindung an.**
  - Teilnehmer sind Tools und Slave-Launcher.
  - Die Anmeldung enthält Rechner, Art (`tool` | `launcher`), appId, Name, Version und pid.
- **Schlüssel am Master:** `rechnerId + appId`.
  - Meldet sich derselbe Schlüssel erneut an, gewinnt die **neue** Verbindung.
  - Die alte wird mit `ersetzt` geschlossen. Das deckt Neustarts und Netzwackler ab.
- **Lebenszeichen in beide Richtungen** alle 10 s (`puls`):
  - Bricht die Verbindung ab, ist der Teilnehmer **sofort** „getrennt“.
  - Kommt 25 s lang nichts, ist er ebenfalls „getrennt“. Das deckt Hänger und halboffene TCP-Verbindungen ab.
  - **Der Client** baut nach 25 s Stille selbst neu auf.
- **Ein Rechner ist online**, solange mindestens einer seiner Teilnehmer verbunden ist.
  - „Zuletzt gesehen“ wird im Verbundspeicher des Masters abgelegt.
  - Geschrieben wird beim Trennen, sonst höchstens alle 60 s.
- **Versionsprüfung:** Die Anmeldung trägt `protokoll`. Bei Abweichung lehnt der Master mit `grund: "protokoll"` ab und nennt seine Suite-Version. Der Slave zeigt dann: „Master hat Launcher 0.12.0 (Protokoll 1), dieses Tool Protokoll 2: bitte angleichen“.
- **Fällt der Master aus, laufen die Tools weiter.** In Teil 1 hängt kein Verhalten der Tools am Master-Link. Die Tools verbinden sich von selbst wieder.

### 5.2 Lokale Anzeige am Slave: welches Tool hängt?

- Der lokale Heartbeat (`127.0.0.1:7799`) bekommt ein optionales Feld `verbund`. Das ist der Zustand des Master-Links in diesem Tool, siehe 5.4.
- **Der Launcher auf diesem Rechner** zeigt damit jedes lokale Tool mit seinem Verbindungszustand.
- **Tools ohne das Feld** (alter Stand) erscheinen, sofern die Rolle nicht „aus“ ist, als **„läuft, noch ohne Verbund (Update nötig)“**.

### 5.3 Oberfläche des Launchers

Alle Netzarbeit läuft im Main-Prozess, der Renderer bekommt nur IPC. Damit berührt Teil 1 die CSP nicht (siehe `memory/csp-lausch-vs-zieladresse.md`).

**Modal „Verbund“:**
- Aufbau wie „Systemzustand“: Kopf und Knöpfe fest, die Mitte scrollt, Escape schließt.
- Erreichbar über die Kopfanzeige und über einen Eintrag in den Einstellungen.

**Rolle wählen:** Aus / Master / Mit Master verbinden.

**Am Master:**
- Name des Masters
- Netzwerk der Suite
- „Rechner koppeln“ (Code mit Countdown, ungültig nach 5 Fehlversuchen, „Neuer Code“)
- Liste „Gekoppelte Rechner“
  - pro Rechner: online/offline, zuletzt gesehen, Adresse
  - darunter die angemeldeten Tools mit Version und „verbunden seit“
  - „Entfernen“ (nicht bei „dieser Rechner“)
- „Master-Identität erneuern“ (mit Warnung)

**Am Slave:**
- Name dieses Rechners
- Netzwerk der Suite
- Vor der Kopplung:
  - gefundene Master
  - Eingabe einer Adresse von Hand
  - Codefeld
- Nach der Kopplung:
  - Zustand, z. B. „Verbunden mit Regie-PC · 10.0.0.110 · seit 12:03“, oder die genaue Ursache
  - feste Master-Adresse
  - „Trennen“
  - die Tools dieses Rechners mit ihrem Zustand (5.2)

**Rolle wechseln:**
- „Aus“ ← Master: Der Master-Link stoppt. Die gekoppelten Rechner bleiben gespeichert und sind beim Wiedereinschalten wieder da.
- „Aus“ ← Slave: Die Kopplung wird gelöscht. Am Master bleibt der Eintrag, bis man ihn entfernt.

**Tools:** In Teil 1 bekommen sie keine Anzeige, nur Log-Zeilen bei jedem Zustandswechsel. Die Anzeige kommt mit Teil 2.

### 5.4 Zustände, vollständig

Dauerhaft sichtbare Anzeigen lügen leicht, wenn ein Zustand vergessen wurde (#208: sechs Fälle). Deshalb steht hier jede Kombination aus Rolle und Zustand. Die Umsetzung als **reine Funktion** `kopfanzeige(zustand)` wird gegen genau diese Tabelle getestet.

| Rolle | Zustand | Kopfanzeige | Farbe |
| --- | --- | --- | --- |
| aus | – | „Verbund aus“ | gedämpft |
| master | startet | „Master startet…“ | gedämpft |
| master | läuft, 0 fremde Rechner gekoppelt | „Master · noch keine Rechner“ | neutral |
| master | läuft | „Master · n/m Rechner online“ (m = gekoppelte fremde Rechner) | grün, wenn n = m, sonst gelb |
| master | Port 8738 belegt | „Master: Port 8738 belegt“ | rot |
| master | gewählte Karte fehlt | wie „läuft“ + Hinweis „Automatisch“ | gelb |
| master | anderer Fehler beim Lauschen | „Master-Fehler: ⟨Text⟩“ | rot |
| slave | sucht | „Suche Regie-PC…“ | gelb |
| slave | verbunden | „Regie-PC ●“ | grün |
| slave | Zeitüberschreitung | „Regie-PC nicht erreichbar: Firewall?“ | rot |
| slave | verweigert | „Regie-PC: Master-Modus aus?“ | rot |
| slave | Netz unerreichbar | „Regie-PC: Netz nicht erreichbar“ | rot |
| slave | Zertifikat passt nicht | „Anderer Master unter dieser Adresse“ | rot |
| slave | Protokoll passt nicht | „Versionen angleichen“ | rot |
| slave | entfernt | „Vom Master entfernt: neu koppeln“ | rot |
| slave | Datei defekt | „Kopplung beschädigt: neu koppeln“ | rot |

Werte im Heartbeat-Feld `verbund` (Tools): `aus` · `sucht` · `verbunden` · `fehler:<code>` mit `<code>` aus Abschnitt 9.

---

## 6 · Protokoll

### 6.1 Rahmen

- **TLS 1.2 oder neuer über TCP.** Pro Zeile ein JSON-Objekt, UTF-8, getrennt durch `\n`.
- **Zeilengrenze:**
  - **4 KiB vor der Anmeldung**
  - **1 MiB danach** (Teil 2 hebt das bei Bedarf an)
  - Bei Überschreitung wird die Verbindung geschlossen.
- **Pflichtfeld `t`** (Typ).
  - Unbekannte Typen werden **ignoriert**, damit Teil 2–4 neue Nachrichten ohne Protokollwechsel ergänzen können.
  - `protokoll` wird nur bei **inkompatiblen** Änderungen erhöht. Teil 1 = `1`.
- **Der Client pinnt das Zertifikat, und zwar im Handshake, nicht danach:**
  - **Gekoppelt:** `ca: [<gespeichertes Master-Zertifikat>]`, `rejectUnauthorized: true` und `checkServerIdentity`, das nur den SHA-256-Fingerprint gegen den Pin vergleicht. Ein Hostnamen-Abgleich entfällt, denn das Zertifikat trägt keine IP. Ein fremdes Zertifikat bricht den Handshake ab, bevor eine einzige Zeile gelesen wird. Den TLS-Fehler (z. B. `DEPTH_ZERO_SELF_SIGNED_CERT` oder der Fehler aus `checkServerIdentity`) ordnet `fehler.ts` als `zertifikat` ein.
  - **Koppeln:** Einen Pin gibt es noch nicht, also `rejectUnauthorized: false`. Hier und nur hier entscheidet der an `fp` gebundene Beweis (3.3). Der Client verarbeitet vor dem geprüften `gekoppelt` nichts außer `hallo`.
  - Die bestehende Steuerebene prüft erst nach dem Handshake (`packages/suite-control-protocol/src/client.ts:84`, `:113`). Der Master-Link übernimmt das bewusst **nicht**.

### 6.2 Nachrichten in Teil 1

| Richtung | `t` | Felder |
| --- | --- | --- |
| M → C | `hallo` | `protokoll`, `masterId`, `name`, `nonce` |
| C → M | `koppeln` | `protokoll`, `rechnerId`, `rechnerName`, `nonce`, `schluessel` (öffentlich, SPKI-DER base64), `beweis` |
| M → C | `gekoppelt` | `masterId`, `name`, `beweis`, `adressen` |
| C → M | `anmelden` | `protokoll`, `rechnerId`, `rechnerName`, `signatur`, `teilnehmer: { art, appId, name, version, pid }` |
| M → C | `angemeldet` | `adressen` (aktuelle IPv4 des Masters), `suite` (Launcher-Version) |
| M → C | `abgelehnt` | `grund`: `code-falsch` · `code-ungueltig` · `keine-kopplung-offen` · `unbekannt` · `signatur` · `protokoll` · `ersetzt` · `zeit`; bei `protokoll` zusätzlich `master` (Protokoll), `suite` |
| C → M | `teilnehmer` | wie `anmelden.teilnehmer`, nach dem Koppeln oder bei Änderung |
| beide | `puls` | – |

**Zusatz beim Koppeln:** Nach `gekoppelt` sendet der Client `teilnehmer`. Ab dann gilt die Verbindung als angemeldet.

### 6.3 Zeitlimits vor der Anmeldung

- Die Anmeldung (bzw. die Kopplungsanfrage) muss **10 s** nach `hallo` eingegangen sein, sonst `abgelehnt { grund: "zeit" }`.
- Höchstens **32** unangemeldete Verbindungen gleichzeitig. Die älteste fliegt.
- Signaturprüfungen: höchstens **20 pro Minute und Quell-IP**. Das ist Schutz gegen CPU-Last, nicht gegen Raten (Ed25519 lässt sich nicht erraten).

---

## 7 · Dateien und Speicherorte

**`<appData>/JM Production Suite/master-link.json`** (gemeinsam, pro Rechner):
- Schreiben darf **nur der Launcher**, Tools lesen nur.
- Geschrieben wird atomar (Temp-Datei + `rename`) mit `mode: 0o600`.
- Beim Lesen wird bereinigt wie in `control-config`. **Defekt oder unlesbar:** Das Tool arbeitet ohne Verbund weiter (`fehler:datei`) und schreibt eine Warnung ins Log, stürzt aber nie ab.
- Tools prüfen die Datei alle **5 s** (mtime). Eine Kopplung, Trennung oder Kartenwahl greift also ohne Tool-Neustart.

```json
{
  "version": 1,
  "rolle": "aus | master | slave",
  "rechner": { "id": "<uuid>", "name": "Regie-Laptop 2" },
  "netzwerk": { "karte": null },
  "kopplung": {
    "masterId": "<uuid>",
    "masterName": "Regie-PC",
    "fingerprint": "<sha256 hex>",
    "zertifikat": "<PEM des Master-Zertifikats, öffentlich>",
    "port": 8738,
    "adressen": ["10.0.0.110"],
    "festeAdresse": null,
    "schluessel": { "privat": "<PKCS8-DER base64>", "oeffentlich": "<SPKI-DER base64>" }
  }
}
```

**Erläuterungen zum Schema:**
- `netzwerk.karte`: `null` = Automatisch, sonst der Kartenname.
- `kopplung`: `null`, solange nicht gekoppelt.
- Auf dem **Master-Rechner** gilt `rolle: "master"`. `kopplung` zeigt dann auf ihn selbst (`adressen: ["127.0.0.1"]`, eigener Fingerprint, eigenes Schlüsselpaar, das der Master bei sich als „dieser Rechner“ einträgt).
- `rechner.id` entsteht beim ersten Schreiben und bleibt, auch wenn umgekoppelt wird.

**`<userData des Launchers>/master-link/`** (nur Master):
- `identitaet.json`: masterId, Name, Zertifikat, privater Schlüssel (0600)
- `verbund.json`: gekoppelte Rechner, je Eintrag `rechnerId`, `name`, `schluessel` (öffentlich), `gekoppeltAm`, `zuletztGesehen`, `letzteAdresse`

**Schutz:**
- Unter Windows liegen beide Orte im Benutzerprofil, das nur der Benutzer lesen kann. Unter macOS wirkt zusätzlich 0600.
- Das ist derselbe Schutz wie bei `control.json`, nicht mehr.

---

## 8 · Aufbau und Einbau

### 8.1 Neues Paket `packages/master-link` (`@jm/master-link`)

Reines Node, **ohne Electron**, testbar wie die Zoom-Bridge. Die Uhr ist überall injizierbar.

| Datei | Aufgabe |
| --- | --- |
| `code.ts` | Code erzeugen, normalisieren, prüfen; Anzeigeform `XXXXX-XXXXX` |
| `beweis.ts` | Kopplungsbeweise (HMAC, 3.3), Ed25519-Schlüssel erzeugen/signieren/prüfen (3.4) |
| `rahmen.ts` | Zeilenrahmen mit Grenzen, JSON-Parsen, Nachrichtentypen, `PROTOKOLL = 1` |
| `adresswahl.ts` | Karten auflisten (aus injiziertem `networkInterfaces()`), virtuell markieren, `ordneKandidaten` (4.3) |
| `fehler.ts` | Fehlercode aus Socket-/TLS-/Protokollfehler ableiten, deutscher Text (Abschnitt 9) |
| `datei.ts` | `master-link.json` lesen/bereinigen/schreiben (atomar), Pfad-Helfer |
| `mdns.ts` | `_jmps-master._tcp` annoncieren und browsen, mit `interface`-Option |
| `server.ts` | `MasterLinkServer`: Lauscher, Kopplungsfenster, Anmeldung, Teilnehmerregister, Ereignisse |
| `client.ts` | `MasterLinkClient`: Zustandsautomat (aus/sucht/verbindet/verbunden/fehler), Kandidaten, Wiederholung, Puls, Ereignisse |
| `index.ts` | öffentliche API |
| `test/selftest.ts` | Selbsttests (Abschnitt 11) |

**Abhängigkeiten:**
- `@jm/auth-core`
- `bonjour-service`, wie bei `@jm/discovery`
- **Nicht `selfsigned`:** Das Master-Zertifikat erzeugt der Launcher und reicht es dem Server als PEM.
- **Testzertifikate** erzeugt der Test mit `selfsigned` aus den devDependencies.

### 8.2 `@jm/app-runtime`

- **Neue Option `masterLink?: boolean`**
  - Vorgabe `true`. Der Launcher setzt `false`, weil er seinen eigenen Client führt.
- **Wenn aktiv**, startet `initAppRuntime` einen `MasterLinkClient`:
  - Teilnehmerart `tool`
  - Anmeldung mit appId, Name, Version, pid
  - Grundlage ist `master-link.json`
- **Fehlt die Datei oder ist die Rolle „aus“**, macht der Client nichts: kein Socket, kein mDNS.
- **Der Zustand** geht als Feld `verbund` in den bestehenden lokalen Heartbeat (5.2) und als Log-Zeile bei jedem Wechsel.
- **Neue Exportfunktion `getMasterLinkStatus()`** als Basis für Teil 2. In Teil 1 ruft sie noch niemand.

### 8.3 Launcher

- **`src/main/verbund.ts`** führt die Rolle:
  - **Master:** Identität laden/erzeugen, `MasterLinkServer` starten, Selbstkopplung, `verbund.json` pflegen
  - **Slave:** `MasterLinkClient` als `launcher`, Koppeln, Datei schreiben
- **IPC** für das Modal. `emitAppEvent({ type: 'verbund-changed' })` bei Zustandswechsel, nach dem Muster von `presence-changed`.
- **`src/main/presence.ts`:** `Beat`/`PresenceRecord` bekommen das optionale `verbund`.
- **Renderer:**
  - `VerbundModal.tsx`
  - `VerbundBadge.tsx` im `Header`
  - die reine Funktion `kopfanzeige()` in einer eigenen Datei, testbar im Launcher-Selbsttest

### 8.4 Nicht angefasst

`@jm/discovery`, `@jm/suite-control-protocol`, `@jm/control-config`, Health-Pool, Presence-Logik (außer dem Zusatzfeld), `iveo-sync`, Show-Start.

---

## 9 · Fehlerbilder am Slave

| Code | Erkannt an | Text für den Bediener |
| --- | --- | --- |
| `zeit` | TCP-Aufbau läuft in den 3-s-Timeout (`ETIMEDOUT` oder eigener Timer) | „Master nicht erreichbar. Wahrscheinlich blockiert die Firewall am Master Port 8738.“ |
| `verweigert` | `ECONNREFUSED` | „Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?“ |
| `netz` | `EHOSTUNREACH`, `ENETUNREACH` | „Netz zum Master nicht erreichbar. Richtiges Netz/Kabel? Netzwerkwahl prüfen.“ |
| `zertifikat` | Fingerprint ≠ Pin | „Unter dieser Adresse antwortet ein anderer Master (oder der Master wurde neu aufgesetzt). Neu koppeln.“ |
| `unbekannt` | `abgelehnt { grund: "unbekannt" }` | „Dieser Rechner wurde am Master entfernt. Neu koppeln.“ |
| `protokoll` | `abgelehnt { grund: "protokoll" }` | „Versionen passen nicht: Master Launcher ⟨suite⟩. Bitte angleichen.“ |
| `nicht-gefunden` | kein Kandidat (weder mDNS noch Adressen) | „Master ‚Regie-PC‘ nicht gefunden. Gleiches Netz? Sonst feste Adresse eintragen.“ |
| `datei` | `master-link.json` defekt | „Kopplungsdatei beschädigt. Neu koppeln.“ |

- `netz` und `nicht-gefunden` ergänzen die vier Ursachen aus der Besprechung.
- **Bei mehreren Kandidaten gilt die aussagekräftigste Ursache**, in dieser Reihenfolge: `unbekannt` > `zertifikat` > `protokoll` > `verweigert` > `zeit` > `netz` > `nicht-gefunden`.
- **Beim Koppeln** zusätzlich:
  - `code-falsch` („Code stimmt nicht, noch n Versuche“)
  - `code-ungueltig` („Code abgelaufen oder verbraucht, am Master neuen Code holen“)
  - `keine-kopplung-offen` („Am Master zuerst ‚Rechner koppeln‘ drücken“)
  - Master-Beweis falsch („Master konnte den Code nicht bestätigen, möglicherweise ein fremdes Gerät. Nichts gespeichert.“)

---

## 10 · Sicherheit

- **Immer TLS.** Nach der Kopplung ist das Zertifikat gepinnt. Vor der Kopplung schützt der an den Fingerprint gebundene Beweis (3.3).
- **Master hält keine Slave-Geheimnisse** (Ed25519, 3.4). Slaves halten ihren privaten Schlüssel im Benutzerprofil.
- **Kopplung nur im offenen Fenster:**
  - Der Bediener hat „Rechner koppeln“ gedrückt, der Code ist höchstens 2 Minuten alt und hat weniger als 5 Fehlversuche.
  - Ein neuer Code ersetzt den alten.
- **Grenzen vor der Anmeldung:** 4 KiB pro Zeile, 10 s, 32 Verbindungen, Signatur-Ratenlimit (6.3).
- **Nie im Log:** Code, private Schlüssel, Beweise. Fingerprints nur gekürzt (16 Zeichen).
- **mDNS-TXT ist unbeglaubigt** und wird nur zur Anzeige und Vorauswahl genutzt.
- **Bekannt, außerhalb von Teil 1:**
  - Der Timer-Socket.IO-Server `:7777` nimmt `tt:replaceItems` ohne Anmeldung an. Das ist Thema von Teil 2, wenn Show-Daten über das Netz kommen.
  - Der sichere Modus der Steuerebene gilt pro Rechner und bleibt unverändert.

---

## 11 · Tests

### 11.1 Selbsttests `@jm/master-link`

`node --experimental-strip-types test/selftest.ts`. Echte TLS-Verbindungen auf `127.0.0.1`. Mehrere „Rechner“ werden mit getrennten Temp-Ordnern nachgestellt. Die Uhr ist injiziert.

1. **Code:**
   - Alphabet und Länge
   - keine Modulo-Verzerrung (Verteilung über 31 Zeichen bei 100 000 Ziehungen innerhalb der Toleranz)
   - Normalisierung (klein, Leerzeichen, Bindestrich)
   - fremdes Zeichen → lokaler Fehler ohne Versuch
2. **Kopplungsfenster:**
   - nach 2 min abgelaufen
   - nach Erfolg verbraucht
   - nach 5 Fehlversuchen ungültig
   - neuer Code ersetzt alten
   - ohne Fenster → `keine-kopplung-offen`
3. **Mittelsmann (wichtigster Test):**
   - **Relais-Fall:** Ein Proxy mit eigenem Zertifikat terminiert TLS und leitet die Zeilen zum echten Master weiter. Der Master lehnt ab (Fehlversuch gezählt), der Slave speichert nichts.
   - **Falscher Master:** Er antwortet mit beliebigem Beweis. Der Slave lehnt ab und pinnt nichts, die Datei bleibt unverändert.
4. **Schlüsselpaar:**
   - Der Master speichert nur den öffentlichen Schlüssel (`verbund.json` enthält keinen privaten).
   - Eine alte Signatur mit neuer Nonce → abgelehnt (keine Wiederholung).
   - „Entfernen“ → `unbekannt`, der entfernte Client versucht es nicht erneut.
   - Die übrigen Rechner bleiben verbunden.
5. **Fehlerbilder an echten Sockets:**
   - `verweigert`: Port geschlossen
   - `zertifikat`: anderer Server mit fremdem Zertifikat. Der Handshake bricht ab, und der Client hat **keine einzige Zeile** gelesen (Pin im Handshake, 6.1).
   - `zeit`: Server nimmt TCP an, schweigt, eigener Timer
   - `protokoll`
   - `unbekannt`
   - `datei`: Müll in der Datei
   - Zusätzlich die Rangfolge bei mehreren Kandidaten.
6. **Adresswahl:**
   - Tabelle realistischer Fälle: Hyper-V `172.x/20` + LAN `10.0.0.x/24`, 169.254 neben LAN, VPN `100.64.x`, zwei echte Karten, gewählte Karte fehlt → Automatisch
   - Reihenfolge mDNS → zuletzt → Datei → feste Adresse
7. **Status:**
   - Anmelden/Puls/Trennen
   - Verbindung weg → sofort getrennt
   - 25 s Stille (Uhr) → getrennt
   - gleicher Schlüssel → alte Verbindung `ersetzt`
   - „online“ je Rechner
8. **Neustart:**
   - Master neu gestartet (gleiche Identität) → alle Clients kommen ohne Zutun zurück
   - Identität erneuert → alle melden `zertifikat`
9. **Rahmen:**
   - 4-KiB-Grenze vor der Anmeldung
   - 1 MiB danach
   - unbekannter Typ wird ignoriert
   - kaputtes JSON → Verbindung zu
10. **Datei:**
    - atomares Schreiben
    - Bereinigung
    - Änderung wird innerhalb von 5 s erkannt

### 11.2 Launcher

- **Selbsttest:** `kopfanzeige()` gegen **jede Zeile** der Tabelle 5.4.
- **Oberfläche:** Launcher per CDP ferngesteuert wie bei #233. Jeder Zustand von Kopfanzeige und Modal per Screenshot, auch bei Mindestgröße 980×640.

### 11.3 CI

- **Neuer Job in `ci-checks.yml`** mit **Node 22**, der die Selbsttests von `@jm/master-link` und `@jm/launcher` ausführt.
- **Der bestehende Typecheck-Job bleibt bei Node 20.**
- **Warum:** Sicherheitscode braucht mehr als eine Typprüfung.

---

## 12 · Abnahme (durch den Owner, zwei echte Rechner)

Checkliste als `packages/master-link/ABNAHME.md`, Aufbau wie `packages/zoom-bridge/ABNAHME-STAGE3.md`:

1. Master-Modus an Rechner A einschalten. Die Windows-Firewall fragt, der Zugriff wird erlaubt. A zeigt „Master · noch keine Rechner“.
2. An Rechner B „Mit Master verbinden“: A erscheint in der Liste. Code tippen, B zeigt „Regie-PC ●“, A zeigt „1/1 Rechner online“.
3. Launcher auf B beenden, **Timer auf B allein starten**. Er erscheint an A unter B.
4. Timer auf A starten. Er erscheint an A unter „dieser Rechner“.
5. Netzkabel an B ziehen: A zeigt B nach höchstens 25 s offline. Kabel wieder rein: B kommt ohne Zutun zurück.
6. Master A neu starten: alle kommen ohne Zutun zurück.
7. B an A entfernen: B zeigt „Vom Master entfernt: neu koppeln“ und versucht es nicht weiter.
8. Firewall an A für den Launcher sperren: B zeigt „nicht erreichbar: Firewall?“, nicht nur „geht nicht“.
9. Fünfmal falscher Code: Der Code wird ungültig, ein neuer wird angeboten.
10. (falls vorhanden) Rechner mit Hyper-V- oder zweiter Karte: Die richtige Adresse wird gewählt. Feste Adresse über VLAN-Grenze.
11. Master-Modus wieder aus, **ein Rechner allein**: Show-Start, RELOAD und Anzeigen sind wie vorher.

---

## 13 · Release

- **In Teil 1:**
  - **Launcher 0.12.0**
  - **Timer 0.12.0**
  - **Titler 0.9.0**, wie gewohnt lokal gebaut (NDI), plus `bump-manifest`-PR (`docs/release-titler.md`)
  - Einträge in `changelog.json`, Tags einzeln pushen.
- **Alle anderen Tools** bekommen den Client automatisch mit ihrem nächsten regulären Release, weil `@jm/app-runtime` dann mitgebaut wird.
  - Bis dahin laufen sie unverändert.
  - Der Launcher zeigt sie als „noch ohne Verbund (Update nötig)“ (5.2).
  - Der Client ist ohne Kopplung völlig untätig, das Mitbauen ist also gefahrlos.
- **Handbuch:**
  - neuer Abschnitt „Mehrere Rechner: Verbund“ mit Koppeln, Netzwerkwahl, fester Adresse und Firewall-Abhilfe
  - Hinweis, dass `control.json` für den Verbund nicht mehr kopiert werden muss

---

## 14 · Nicht in Teil 1

- **Show-Daten über das Netz**, iveo-Weitergabe, #235 → Teil 2
- **Fernstart** von Tools → Teil 3
- **Show-Zentrale** als eigenes Fenster → Teil 4
- **Anzeige in den Tools** → Teil 2
- IPv6, Verbindungen über das Internet/NAT, mehrere Master mit Ausfallübernahme
- automatische Firewall-Regeln im Installer
- Änderungen an Steuerebene, Companion, `control.json`, sicherem Modus
- Authentifizierung für Timer `:7777` → Teil 2
