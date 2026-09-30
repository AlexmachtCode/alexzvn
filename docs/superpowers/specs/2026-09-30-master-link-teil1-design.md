# Master-Link, Teil 1: Rechner koppeln, Master finden, sehen wer da ist

**Anlass:** Die Suite läuft auf einem Rechner, aber nicht über mehrere. Tools auf einem zweiten Rechner lassen sich nicht öffnen und bekommen keine iveo-Live-Daten.
**Vorgänger:** Teil 0 „Sofort-Fixes“ (PR #237, released 30.09.2026: Launcher 0.11.1, Timer 0.11.2, Titler 0.8.2)
**Behebt:** #234 (falsche Adresse bei mehreren Netzwerkkarten). #235 (Rundown-Abgleich) gehört zu Teil 2.
**Gesamtplan:** Ansatz A „Stern zum Master“, Teile 0 → 1 → 2 → 3 → 4. Teil 1 ist das Fundament.
**Ziel in einem Satz:** Ein Launcher kann Master sein. Andere Rechner koppeln sich einmal mit einem Code und finden ihn danach selbst wieder, auch wenn sich das Netz ändert. Der Master sieht pro Rechner, welche Tools laufen.

Teil 1 bringt noch keine Show-Daten (Teil 2), keinen Fernstart (Teil 3) und keine Show-Zentrale (Teil 4). Er baut die Leitung, auf der das später läuft, und weist nach, dass sie im echten Netz trägt.

---

## 0 · Abweichungen von der Besprechung (bitte bewusst prüfen)

Die Abschnitte 1–5 der Besprechung sind freigegeben. Bei der Ausarbeitung und in der anschließenden Prüfung (vier Prüfer, jeder Befund gegengeprüft, Versuche mit echtem TLS, Ed25519 und mDNS) kamen Stellen heraus, an denen die Freigabe technisch nicht haltbar war. Geändert wurde nur dort:

| # | Freigegeben war | Jetzt | Warum |
| --- | --- | --- | --- |
| 1 | Rechner-**Token**, am Master nur der **Hash** gespeichert; Wiederverbinden per HMAC mit dem Token (Abschnitt 2) | **Ed25519-Schlüsselpaar** je Rechner, der Master speichert nur den **öffentlichen** Schlüssel (3.4) | Beide Sätze zusammen gehen nicht: Für ein HMAC bräuchte der Master das Token selbst. Mit dem Schlüsselpaar hält der Master **gar kein** Geheimnis mehr. Das bringt `node:crypto` selbst mit, nachgemessen unter Node 24 und Electron 33. |
| 2 | Zertifikat pinnen „wie bei der Steuerebene“ | Pin wird **im TLS-Handshake** geprüft (6.1) | Die Steuerebene prüft erst danach. Nachgemessen: Ein fremdes Zertifikat bricht den Handshake jetzt ab, **bevor eine einzige Zeile gelesen wird**. |
| 3 | Zeitüberschreitung → „Firewall am Master?“, verweigert → „Master-Modus aus?“ (Abschnitt 3) | „Firewall?“ **nur**, wenn der Master in derselben Suchrunde per mDNS sichtbar war. Sonst lautet die Meldung „nicht erreichbar: aus, Master-Modus aus, anderes Netz oder Firewall“ (9) | Die Windows-Firewall schweigt standardmäßig („Stealth“) auch dann, wenn **niemand lauscht**: Es kommt weder ein Reset noch ein ICMP (Microsoft, KB 2586744). Ein ausgeschalteter Master sähe sonst aus wie eine Firewall. |
| 4 | „Beim ersten Einschalten des Master-Modus fragt Windows ‚Zugriff zulassen?‘“ (Abschnitt 3) | Es kommt **keine** neue Abfrage. Entscheidend sind die vorhandene Programmregel und das **Netzwerkprofil** (4.6) | Der Launcher lauscht schon heute bei jedem Start im Netz (Steuerserver 8736). Die Regel existiert also längst, gilt aber je Profil. Veranstaltungsnetze ohne Gateway stuft Windows als „Öffentlich“ ein. |
| 5 | vier Fehlerursachen (Abschnitt 3) | dreizehn, jede mit Text und Wiederholungsregel (9) | Fehlende Zustände haben bei #208 sechs falsche Anzeigen verursacht. |

---

## 1 · Ausgangslage (nachgemessen, nicht angenommen)

| Tatsache | Fundstelle |
| --- | --- |
| **Presence ist nur lokal.** Der Hub lauscht auf `127.0.0.1:7799` und kennt nur die appId, keinen Rechner. Ein Tool auf einem anderen Rechner gilt nie als laufend. `maybeNotify` meldet nur Start und Stopp (Signatur `appId@version`). Der Typ `PresenceRecord` steht in `shared/types.ts`. | `apps/launcher/src/main/presence.ts:13`, `:67-76`, `:80`; `apps/launcher/src/shared/types.ts:280` |
| **Tools melden sich über `@jm/app-runtime`.** `initAppRuntime()` startet den Heartbeat alle 10 s (hello/beat/bye). Die Nutzlast ist beim Start eingefroren. Der Launcher ruft `initAppRuntime` mit `presence: false`. | `packages/app-runtime/src/index.ts:291`, `:543`; `apps/launcher/src/main/index.ts:24-28` |
| **`initAppRuntime` läuft vor der Einzelinstanz-Sperre.** Das gilt in allen Apps (z. B. Timer `:390` vor `:397`, Titler `:460` vor `:462`). Der Launcher startet ein Tool per `spawn`, auch wenn es schon läuft. Nachgemessen: Eine Zweitinstanz baut in 4–9 ms TLS auf und meldet sich an, bevor sie sich beendet. | `apps/timer/src/main/index.ts:390`, `:397`; `apps/launcher/src/main/launch.ts:24` |
| **Die gemeinsame Datei pro Rechner ist ein bewährtes Muster**, `<appData>/JM Production Suite/control.json`. Das Vorbild schreibt aber **nicht atomar** und behandelt eine defekte Datei **wie eine leere**. Beides übernimmt der Master-Link bewusst nicht (7.3). | `packages/control-config/src/index.ts:57-75` |
| **`mode: 0o600` schützt unter Windows nichts.** Den Schutz liefert dort das Benutzerprofil. Unter macOS wirkt 0600. | Node-Doku `fs.writeFile` |
| **Krypto-Bausteine:** `randomNonce`, `hmacProof`/`verifyProof`, `certFingerprint` (SHA-256, hex, klein, ohne `:`). `selfsigned` nimmt ohne Angaben RSA-1024/SHA-1. Node 24 lehnt das ab (`ERR_SSL_EE_KEY_TOO_SMALL`), Electron 33 nimmt es still an. Der Launcher setzt deshalb schon heute 2048/SHA-256. | `packages/auth-core/src/token.ts`, `cert.ts`; `apps/launcher/src/main/control-provision.ts:43-47` |
| **`@jm/auth-core` importiert ohne Dateiendung.** Unter `node --experimental-strip-types` scheitert das (`ERR_MODULE_NOT_FOUND`). `tsx` funktioniert und liegt schon im Repo. | `packages/auth-core/src/index.ts:3-8`, `packages/auth-core/package.json` |
| **mDNS (`multicast-dns` 7.2.5 unter `bonjour-service` 1.4.0):** | |
| · `interface` steuert, auf welcher Karte die Gruppe beitritt und gesendet wird. | `node_modules/multicast-dns/index.js:134`, `:153` |
| · Ohne `bind` bindet es den Socket an die Karten-IP. Unter macOS kommt dann **kein Multicast** an. Mit `bind: '0.0.0.0'` geht es auf beiden Systemen. | `index.js:65` |
| · Ohne `interface` sendet es nur über **eine** Karte, die das System wählt. Empfangen wird auf allen. | `index.js:133-181` |
| · Der Port wird per `reuseAddr` geteilt. | `index.js:27` |
| **Der Browser von `bonjour-service` fragt nur einmal.** Eine neue Adresse eines bekannten Dienstes übernimmt er nicht. Nachgemessen: Ein alter Browser behält die alte IP, ein neuer findet die neue sofort. | `node_modules/bonjour-service/dist/lib/browser.js:77-130` |
| **Namensprobe:** Veröffentlicht jemand denselben Instanznamen, stoppt `bonjour-service` still. | `node_modules/bonjour-service/dist/lib/registry.js:27-36` |
| **Ursache #234:** `@jm/discovery` nimmt „die erste IPv4 der Annonce“. | `packages/discovery/src/index.ts:118` |
| **mDNS endet an der Subnetzgrenze** (VLANs im Studio). | `docs/Best Practices/Studio Infra optimiert.md:165-168` |
| **Der Launcher lauscht schon heute im Netz:** Steuerserver 8736 ohne `bindHost`, also auf allen Karten. Die Firewall-Programmregel entstand beim ersten Launcher-Start. | `apps/launcher/src/main/index.ts:86`; `packages/suite-control-protocol/src/server.ts:205` |
| **Port 8738 ist in der Suite frei.** Belegt sind 7777–7783, 7799, 8723–8737. | `grep` über das Repo |
| **Die CI führt nur Typprüfung und Secret-Scan aus, mit Node 20.** | `.github/workflows/ci-checks.yml:24-30` |

---

## 2 · Rollen und Aufstellung

- **Gekoppelt wird der Rechner, nicht jedes Tool.** Das geschieht einmal pro Rechner im Launcher. Das Ergebnis steht in `<appData>/JM Production Suite/master-link.json` (7.1).
- **Jedes Tool verbindet sich selbst mit dem Master.** Es liest dafür diese Datei. Das trägt auch, wenn auf dem Rechner kein Launcher läuft (Aufstellung „Launcher ↔ einzelne Tools“).
- **Läuft der Launcher auf einem gekoppelten Rechner, ist er zusätzlich Teilnehmer der Art `launcher`** (Aufstellung „Master ↔ Slave-Launcher“).
  - Teil 1: Er meldet nur sich selbst, denn jedes Tool meldet sich selbst an.
  - Ab Teil 3 nimmt er Startbefehle an.
- **Master** ist ein Launcher, bei dem „Master für andere Rechner“ eingeschaltet ist.
  - Er betreibt den **Master-Link** auf Port **8738**, immer über TLS mit eigenem Zertifikat.
  - Er hat einen Namen (Vorgabe: Rechnername) und eine feste Kennung (`masterId`, UUID). Beides bleibt über Neustarts gleich.
- **Stern:** Alle verbinden sich zum Master, nie ein Slave zum anderen. Ein Rechner ist mit genau einem Master gekoppelt, Umkoppeln geht jederzeit. Ein Master ist nie gleichzeitig Slave.
- **Auch der Master-Rechner selbst ist gekoppelt**, automatisch und ohne Code („Selbstkopplung“).
  - Seine Tools verbinden sich **ausschließlich** über `127.0.0.1:8738` (4.5), also nie über eine LAN-Adresse. Ein gezogenes Kabel am Master trennt sie deshalb nicht.
  - Der Eintrag „dieser Rechner“ lässt sich nicht entfernen und gilt als online, solange der Master-Link läuft.
- **Rolle „aus“ (Vorgabe):** kein Netzverkehr des Master-Links, alles wie heute.
- **Die heutige Steuerebene bleibt unberührt:** `control.json`, sicherer Modus, Health-Pool, Companion, RELOAD, Port 8736.

---

## 3 · Koppeln

### 3.1 Ablauf für den Bediener

1. **Am Master:** Der Bediener klickt „Rechner koppeln“ und sieht einen **10-Zeichen-Code** (`K7QXM-3PRTH`) mit Countdown. Der Code ist **2 Minuten** gültig.
2. **Am Slave-Launcher** unter „Mit Master verbinden“:
   - Er sieht die gefundenen Master mit Name, Adresse und gekürztem Fingerprint aus mDNS. Diese Angaben sind nicht beglaubigt und dienen nur der Auswahl.
   - Wahlweise trägt er eine Adresse von Hand ein.
   - Vorher lässt sich der **Name dieses Rechners** anpassen.
   - Dann tippt er den Code ein. **Die Verbindung zum Master wird erst aufgebaut, wenn der Code vollständig ist und lokal als gültig geprüft wurde** (10 Zeichen aus dem Alphabet). Vorher gibt es keinen Socket.
3. Danach verbindet sich der Rechner bei jedem Start ohne Zutun wieder, ebenso jedes Tool auf ihm.
4. **Am Master** steht die Liste „Gekoppelte Rechner“ (5.3).

### 3.2 Der Code

- **Aufbau:**
  - Alphabet mit 31 Zeichen: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (ohne 0, 1, I, L, O)
  - Länge: 10 Zeichen, also 31¹⁰ ≈ 2⁴⁹·⁵ Möglichkeiten
  - Erzeugung: `crypto.randomInt(31)` pro Zeichen, ohne Modulo-Verzerrung
- **Eingabe verzeihend:** Kleinbuchstaben werden groß, Leerzeichen und Bindestriche fallen weg. Ein fremdes Zeichen meldet der Slave **lokal** („Das Zeichen O kommt im Code nicht vor“). Das zählt nicht als Fehlversuch.
- **Kopplungsfenster am Master:**
  - Es ist offen, solange der Dialog „Rechner koppeln“ offen ist.
  - Darin gilt immer höchstens **ein** Code. „Neuer Code“ ersetzt den alten.
- **Ablehnungen:**
  - Der Code ist abgelaufen (2 min), verbraucht (nach Erfolg) oder hatte 5 Fehlversuche → `code-ungueltig`. Das gilt, bis ein neuer Code erzeugt oder das Fenster geschlossen wird.
  - Das Fenster ist geschlossen → `keine-kopplung-offen`.
  - Ein falscher Beweis → `code-falsch` mit `rest` (verbleibende Versuche, zählt alle Slaves).
- **Der Code erscheint nie im Log.**

**Warum 10 Zeichen, und welche Schranke wirklich schützt:**
- **Offline-Raten:** Beim ersten Kontakt kennt der Slave das Zertifikat des Masters noch nicht. Ein Angreifer, der sich als Master ausgibt, bekommt den Beweis des Slaves und kann den Code offline durchprobieren.
  - Er muss den Code finden, **bevor der Slave aufgibt**. Maßgeblich ist deshalb die **Frist des Slaves: 10 s** (3.3), nicht die 2 Minuten am Master.
  - In 10 s bräuchte er im Mittel ≈ 4·10¹³ Versuche pro Sekunde, das sind über 10 000 Grafikkarten.
- **Online-Raten am echten Master:** Hier greifen die 2 Minuten und 5 Versuche pro Code, also ≈ 5/2⁴⁹·⁵.
- **Verworfen:**
  - PAKE: Es braucht eine zusätzliche Krypto-Bibliothek.
  - „6 Ziffern + Fingerprint mit dem Auge vergleichen“: zu fehleranfällig.

### 3.3 Der Kopplungs-Handshake (beidseitig, an das Zertifikat gebunden)

**Bezeichnungen:**
- `K`: der Code, normalisiert
- `fp`: SHA-256-Fingerprint des Server-Zertifikats, Form wie `certFingerprint()`. **Der Slave nimmt den Fingerprint, den er in dieser TLS-Verbindung tatsächlich sieht. Der Master nimmt seinen eigenen.**
- `Ns`, `Nc`: Nonces von Master und Slave
- `R`: `rechnerId`
- `P`: öffentlicher Schlüssel des Slaves (3.4)
- `M`: `masterId`

```
Slave → Master   koppeln { R, name, Nc, P,
                   beweis = HMAC-SHA256(K, "jm-master-link/1/koppeln/slave"  | fp | Ns | Nc | R | P) }
Master           R == eigene rechnerId des Master-Rechners → abgelehnt { grund: "rechner-id" }
                 Beweis mit SEINEM fp prüfen (konstante Zeit)
                 falsch → Fehlversuch zählen, abgelehnt { grund: "code-falsch", rest }
Master → Slave   gekoppelt { M, name, adressen,
                   beweis = HMAC-SHA256(K, "jm-master-link/1/koppeln/master" | fp | Ns | Nc | R | P | M) }
Slave            Master-Beweis mit dem fp prüfen, den er SIEHT
                 falsch → nichts speichern, Fehler „Master konnte den Code nicht bestätigen“
                 richtig → Zertifikat aus der TLS-Sitzung (getPeerCertificate().raw → PEM) und fp
                           pinnen, Kopplung in master-link.json schreiben (nur der Launcher schreibt)
```

**Frist auf Seiten des Slaves (hart):**
- Nach dem Senden von `koppeln` müssen **binnen 10 s** `gekoppelt` oder `abgelehnt` eintreffen.
- Andere Zeilen verlängern die Frist **nicht**, auch nicht `puls` oder unbekannte Typen.
- Nach Ablauf gilt:
  - Der Slave schließt den Socket.
  - Er verwirft Nc, das Schlüsselpaar und K und speichert nichts.
  - Er meldet „Master hat nicht rechtzeitig bestätigt, nichts gespeichert“.
- Schließen des Dialogs oder ein neuer Kopplungsversuch bricht einen laufenden Versuch genauso ab.
- **Das Ergebnis einer abgebrochenen Verbindung wird nie gespeichert.**

**Was der Slave vor dem geprüften `gekoppelt` verarbeitet:**
- Er verarbeitet nur `hallo` und `abgelehnt`.
- `abgelehnt` gilt in dieser Phase als unbeglaubigt: Es wird nur angezeigt und ändert weder Datei noch Pin.

**Warum Angriffe scheitern:**
- **Mittelsmann mit eigenem Zertifikat:**
  - Der Slave rechnet mit `fp'`, der echte Master mit `fp`. Der Master lehnt deshalb ab, und das zählt als Fehlversuch.
  - Einen Master-Beweis für `fp'` kann der Angreifer nur mit K fälschen, und dafür hat er 10 s (3.2).
  - Die Nachrichtenfolge verhindert auch, dass der echte Master als Orakel dient: Er sendet seinen Beweis erst nach geprüftem Slave-Beweis.
- **`P` steckt in beiden Beweisen.** Den Schlüssel kann niemand unterwegs austauschen.
- **Die Trennzeichen `|` sind eindeutig**, denn kein Feld enthält `|`: hex, base64 oder UUID. Das ist nachgemessen. Der Name ist nicht Teil des Beweises.

**Erneutes Koppeln:**
- Ein `koppeln` mit einer **bereits bekannten** `rechnerId` ersetzt Schlüssel und Namen dieses Eintrags.
- Der Master schließt dabei die bestehenden Verbindungen dieses Rechners. Die Liste bleibt bei genau einem Eintrag.

**Nach `gekoppelt`:**
- Dieselbe Verbindung geht direkt in den angemeldeten Zustand über. Der Slave sendet `teilnehmer`, der Master antwortet mit `angemeldet`.

### 3.4 Zugang je Rechner: Ed25519-Schlüsselpaar (⚠ Abweichung 1 aus Abschnitt 0)

**Erzeugen:** Jeder Rechner erzeugt beim Koppeln ein **neues** Ed25519-Schlüsselpaar mit `generateKeyPairSync('ed25519')`.
- Der öffentliche Schlüssel wird als SPKI-DER exportiert (base64, 60 Zeichen), der private als PKCS8-DER (base64, 64 Zeichen).
- Der Master speichert **nur den öffentlichen** Schlüssel.

**Anmelden:**
1. Der Master sendet eine frische Nonce `Ns` in `hallo`.
2. Der Slave sendet `signatur = sign(null, "jm-master-link/1/anmelden" | fp | Ns | R, privat)`.
3. Der Master prüft mit `verify(null, …, P)`.

**Was die Signatur absichert:**
- `fp` bindet die Signatur an diesen Master.
- `Ns` verhindert das Wiederholen einer alten Anmeldung.
- Der Pin im Handshake (6.1) verhindert, dass ein Mittelsmann eine fremde Nonce signieren lässt.

**„Entfernen“:**
- Der Master löscht den öffentlichen Schlüssel.
- Er **schließt sofort alle offenen Verbindungen** dieser `rechnerId` mit `abgelehnt { grund: "unbekannt" }`.
- Der Client wertet `abgelehnt` in **jedem** Zustand aus.
- Danach wird jede Anmeldung dieses Rechners mit `unbekannt` abgelehnt. Die anderen Rechner verbinden weiter.

**Grenzen:**
- Der private Schlüssel liegt in `master-link.json` des Slaves (7.1) und erscheint nie im Log.
- `@jm/auth-core` liefert weiterhin Nonce, HMAC und Fingerprint.

### 3.5 Identität des Masters

**Speicherort:** `masterId`, Name, Zertifikat und privater Schlüssel liegen in `<userData des Launchers>/master-link/identitaet.json` (7.2), **nicht** in der gemeinsamen Datei.

**Zertifikat:** Es wird **nur erzeugt, wenn die Datei nicht existiert** (7.3), und zwar mit genau diesen Parametern:
```ts
selfsigned.generate([{ name: 'commonName', value: 'jm-master-link' }], {
  days: 3650, keySize: 2048, algorithm: 'sha256',
  notBeforeDate: new Date(Date.now() - 365 * 24 * 3600 * 1000), // gegen falsch gehende Uhren am Slave
});
```
- Dieselben Parameter gelten für die Zertifikate in den Tests.
- **Zurückdatiert** wird, weil eine Slave-Uhr, die hinter der Master-Uhr liegt, sonst `CERT_NOT_YET_VALID` auslöst (nachgemessen). Neu koppeln hilft dagegen nicht.

**„Master-Identität erneuern“** gibt es nur auf ausdrücklichen Befehl. Vorher warnt ein Hinweis: „Alle anderen Rechner müssen danach neu gekoppelt werden.“ Der Ablauf:
1. Der Master stoppt den Server und **schließt alle offenen Sockets aktiv**. `server.close()` allein ließe sie offen.
2. Er erzeugt die neue Identität (atomar, 7.3).
3. Im **selben Schritt** schreibt er die Selbstkopplung neu: neues Schlüsselpaar, neuer Fingerprint und neue `masterId` in `master-link.json` des Master-Rechners, dazu der Eintrag „dieser Rechner“ in `verbund.json`.
4. Er entfernt nur die **fremden** Rechner aus `verbund.json`.
5. Er startet den Server wieder.

Die Tools des Master-Rechners verbinden sich binnen 5 s (Dateiprüfung) ohne Zutun wieder. Alle fremden Rechner melden `zertifikat`.

---

## 4 · Finden und Netzwerkwahl (#234)

### 4.1 Netzwerkwahl pro Rechner

- **Launcher → Verbund → „Netzwerk der Suite“:** Zur Wahl stehen **Automatisch** (Vorgabe) oder eine bestimmte Netzwerkkarte.
- **Eine Karte hat eine Liste von IPv4-Adressen**, jede mit Präfix.
  - Die Anzeige zeigt alle, z. B. `Ethernet 2 · 10.0.0.110/24, 192.168.10.5/24`.
  - Ausgeblendet werden nur `internal`-Karten.
  - Karten, die nur eine 169.254-Adresse haben, erscheinen mit dem Vermerk „Link-Local (kein DHCP)“.
- **Als virtuell markiert** werden Karten mit einem dieser Namensmuster: `vEthernet`, `Hyper-V`, `VirtualBox`, `VMware`, `WSL`, `Tailscale`, `ZeroTier`, `TAP`, `VPN`, `Loopback Pseudo`, `utun`, `bridge`.
  - Das ist eine Heuristik und dient nur der Anzeige und der Rangfolge. Eine Fehleinstufung kostet höchstens einen Fehlversuch.
- **Gespeichert wird der Kartenname**, weil IPs je Einsatz wechseln.
  - Die Wahl steht in `master-link.json` und gilt für Launcher und Tools des Rechners.
- **Fehlt die gewählte Karte**, arbeitet der Rechner mit **Automatisch** weiter und zeigt den Hinweis „Gewählte Karte ‚Ethernet 2‘ nicht vorhanden, nutze Automatisch“ (5.4).
- Alle 10 s prüft er `os.networkInterfaces()` erneut.

### 4.2 mDNS-Instanzen (gilt für Master und Slave)

- **Diensttyp:** Der Master kündigt sich unter dem eigenen Typ `_jmps-master._tcp` an. Die bestehenden Tools, Companion und Stage Display browsen `_jmps._tcp` und sehen davon nichts.
- **Instanzen je nach Netzwahl:**
  - **Gewählte Karte:** eine Instanz `new Bonjour({ interface: <erste IPv4 der Karte>, bind: '0.0.0.0' })`
  - **Automatisch:** **eine Instanz je nicht-interner Karte mit IPv4**, jeweils `{ interface: <erste IPv4>, bind: '0.0.0.0' }`. Eine einzelne `new Bonjour()` würde nur über eine Karte senden.
- **Warum `bind: '0.0.0.0'`:** Nur so empfängt macOS Multicast. Der Port wird per `reuseAddr` geteilt.
- **Annonce (Master):**
  - Instanzname `jm-master-<erste 8 Zeichen der masterId>`, nicht der Anzeigename. Zwei „Regie-PC“ im selben Netz verdrängen sich so nicht.
  - Veröffentlicht wird mit `probe: false` und `disableIPv6: true`.
  - Beim Neu-Annoncieren (Kartenwechsel) wird zuerst `unpublishAll` abgewartet, dann `destroy()`, dann neu veröffentlicht.
- **TXT (unbeglaubigt, nur zur Anzeige und Vorauswahl):**
  - `id` (masterId)
  - `name`
  - `fp` (die ersten 16 Hex-Zeichen)
  - `p` (Protokoll)
- Ändern sich die Karten, wird die ganze Instanzmenge neu angelegt.

### 4.3 Master: lauschen

- **Automatisch:** ein Lauscher auf `0.0.0.0:8738`.
- **Gewählte Karte:**
  - ein Lauscher je IPv4 der Karte, dazu **immer** einer auf `127.0.0.1:8738`
  - Ändern sich die Adressen der Karte, werden nur die betroffenen Lauscher (samt ihrer Sockets) geschlossen bzw. neu geöffnet. Der Loopback-Lauscher bleibt.
- **`adressen`** in `gekoppelt`/`angemeldet` enthält nur Adressen, auf denen der Master **tatsächlich lauscht**:
  - bei gewählter Karte deren IPv4
  - bei Automatisch alle nicht-internen IPv4
  - nie 127.0.0.1

### 4.4 Slave: Adressen ordnen (die eigentliche Behebung von #234)

Eine **reine Funktion** `ordneKandidaten(masterAdressen, eigeneKarten, gewaehlteKarte)` legt die Reihenfolge fest:
1. Entdoppeln: Die erste Fundstelle zählt.
2. IPv6 verwerfen (Teil 1 ist IPv4). Loopback verwerfen, außer der Master ist dieser Rechner (4.5).
3. Rangfolge:
   1. im Subnetz **einer der** IPv4 der gewählten Karte
   2. im Subnetz einer nicht virtuellen eigenen Karte
   3. im Subnetz einer virtuellen eigenen Karte
   4. der Rest in Fund-Reihenfolge
   5. zuletzt 169.254.x. Diese Adressen werden nicht verworfen, damit zwei Rechner ohne DHCP sich trotzdem finden.

### 4.5 Suchrunde und Verbindungsaufbau

**Master-Rechner selbst** (`rolle: "master"`): Einziger Kandidat ist `127.0.0.1`. Es gibt keine mDNS-Suche und keine gespeicherten Adressen.

**Gekoppelter Slave, eine Suchrunde:**
1. Er legt einen **neuen** mDNS-Browser an und sammelt 1,5 s lang Antworten mit passender `id`.
   - Nur die Adressen aus **dieser** Runde zählen. Die Dienstliste eines langlebigen Browsers wird nie verwendet, weil sie neue Adressen nicht übernimmt (Abschnitt 1).
   - Ergebnis der Runde ist neben den Adressen auch **„mDNS gesehen: ja/nein“**. Daran hängt die Fehlerdeutung (9).
2. Er bildet die Kandidatenliste und entdoppelt sie:
   1. mDNS-Adressen dieser Runde, geordnet nach 4.4
   2. `kopplung.letzteAdresse`
   3. `kopplung.adressen`
   4. `kopplung.festeAdresse`
3. Er versucht die Kandidaten der Reihe nach, jeweils mit diesen Fristen:
   - **TCP-Aufbau:** 3 s, sonst `zeit`, `verweigert`, `netz` oder `sonstig`
   - **TLS-Handshake mit Pin und `hallo`:** 5 s
   - **`angemeldet` nach `anmelden`:** 10 s

   Bleibt nach erfolgtem TCP-Aufbau etwas davon aus, lautet der Code `kein-master`.
4. Der erste Kandidat mit erfolgreicher Anmeldung gewinnt. Im Zustand `verbunden` wird nicht gesucht.

**Feste Master-Adresse:** Sie ist der Rückfall für VLANs. Man trägt sie beim Koppeln oder später ein, und auch das Koppeln selbst geht über eine von Hand eingetragene Adresse.

**Warum falsche Adressen harmlos sind:** Jede Verbindung prüft den gepinnten Fingerprint, eine falsche Adresse kann sich also nicht als Master ausgeben.

**Wiederholen:** Das Grundintervall ist 1 s → 2 s → 4 s → 8 s, danach alle 10 s, jeweils mit **±25 % Zufall**, damit nach einem Master-Ausfall nicht alle gleichzeitig kommen. Welche Regel für welchen Code gilt, steht in 9.

### 4.6 Firewall (⚠ Abweichung 4 aus Abschnitt 0)

**Keine neue Abfrage beim Master-Einschalten.**
- Windows fragt „Zugriff zulassen?“ nur, wenn für das Programm noch keine Regel existiert.
- Der Launcher lauscht aber schon heute bei jedem Start auf 8736. Die Regel für „JM Production Suite“ entstand also beim ersten Launcher-Start.
- Beim Einschalten des Master-Modus kommt deshalb in der Regel **keine** Abfrage.

**Die Regel gilt je Profil.** Windows stuft ein Netz ohne Gateway als **„Öffentlich“** ein, und das ist bei Veranstaltungsnetzen häufig. Eine Regel, die nur für „Privat“ erlaubt, sperrt den Master dort still. Dasselbe gilt für eine frühere Ablehnung. Ohne Adminrechte entsteht aus der Abfrage immer eine Blockregel.

**Tools, die heute nicht lauschen**, binden auf gekoppelten Rechnern mit ihrem nächsten Release erstmals UDP 5353 (mDNS) und können dann **eine eigene** Abfrage auslösen.
- Betroffen sind z. B. Copy, Editor und Grafiktool.
- Wer ablehnt, sperrt nur deren mDNS. Bekannte und feste Adressen funktionieren weiter.

**Handbuch (13):**
- in `wf.msc` die eingehenden Regeln für „JM Production Suite“ prüfen (Zulassen/Blocken, Profile **Privat und Öffentlich**, Adminrechte nötig)
- oder das Netz auf „Privat“ stellen (`Set-NetConnectionProfile`)

Teil 1 legt **keine** Regeln automatisch an. Dafür wären Adminrechte nötig.

---

## 5 · Status: wer ist da?

### 5.1 Anmeldung und Lebenszeichen

- **Anmeldung:**
  - Jeder Teilnehmer meldet sich über seine eigene Verbindung an: Rechner, Art (`tool` | `launcher`), appId, Name, Version, pid.
  - Der Master führt ihn unter dem Schlüssel **`rechnerId + appId`**.
  - Meldet sich derselbe Schlüssel erneut an, gewinnt die **neue** Verbindung. Die alte wird mit `abgelehnt { grund: "ersetzt" }` geschlossen.
  - Hatte die alte Verbindung in den letzten 10 s noch einen Puls, schreibt der Master eine Warnung ins Log: „Kennung ⟨R⟩/⟨appId⟩ doppelt aktiv (IP a, IP b)“.
- **Zweitinstanzen:** Der Client startet erst nach der Einzelinstanz-Sperre (8.2). Eine kurz gestartete Zweitinstanz verdrängt das laufende Tool deshalb nicht.
- **Lebenszeichen:**
  - Beide Seiten senden alle 10 s einen `puls`.
  - Bricht die Verbindung ab, ist der Teilnehmer **sofort** „getrennt“.
  - Nach **25 s** ohne jede Zeile gilt er ebenfalls als getrennt. Das deckt Hänger und halboffene TCP-Verbindungen ab, der Client baut dann selbst neu auf.
- **Wann ein Rechner online ist:** Ein fremder Rechner ist online, solange mindestens einer seiner Teilnehmer verbunden ist. „Dieser Rechner“ ist online, solange der Master-Link läuft.
- **„Zuletzt gesehen“** wird in `verbund.json` abgelegt. Geschrieben wird beim Trennen, sonst höchstens alle 60 s.
- **Versionsprüfung:** Stimmt `protokoll` nicht überein, lehnt der Master mit `grund: "protokoll"` ab und gibt seine Suite-Version (`suite`) und sein Protokoll (`master`) mit. Den Text dazu legt allein Abschnitt 9 fest.
- **Fällt der Master aus, laufen die Tools weiter.** In Teil 1 hängt kein Verhalten eines Tools am Master-Link, und die Tools verbinden sich von selbst wieder.

### 5.2 Lokale Anzeige am Slave: welches Tool hängt?

- **Neues Heartbeat-Feld:** Der lokale Heartbeat (`127.0.0.1:7799`) bekommt ein optionales Feld `verbund` mit den Werten `aus` · `sucht` · `verbindet` · `verbunden` · `fehler:<code>` (Codes aus 9).
- **`aus`** gilt für die Rolle „aus“ **und** für „Slave, aber noch nicht gekoppelt“. In beiden Fällen ist der Client untätig.
- **Presence-Hub:** Er übernimmt `verbund` in Eintrag und Momentaufnahme und nimmt es **in die Signatur von `maybeNotify` auf** (`appId@version#verbund`). Jeder Zustandswechsel eines Tools erreicht die Anzeige also sofort.
- **app-runtime** liest `verbund` bei jedem Senden frisch und schickt bei jedem Wechsel **sofort** einen zusätzlichen `beat`.
- **Tools ohne das Feld** (alter Stand) erscheinen, sofern die Rolle nicht „aus“ ist, als **„läuft, noch ohne Verbund (Update nötig)“**.

### 5.3 Oberfläche des Launchers

Alle Netzarbeit läuft im Main-Prozess, der Renderer bekommt nur IPC. Die CSP bleibt unberührt (`memory/csp-lausch-vs-zieladresse.md`).

**Modal „Verbund“:**
- Aufbau wie „Systemzustand“: Kopf und Knöpfe fest, die Mitte scrollt, Escape schließt.
- Erreichbar über die Kopfanzeige und über einen Eintrag in den Einstellungen.

**Rolle wählen:** Aus / Master / Mit Master verbinden.

**Am Master:**
- Name des Masters
- Netzwerk der Suite
- „Rechner koppeln“ (Code mit Countdown, verbleibende Versuche, „Neuer Code“)
- Liste „Gekoppelte Rechner“
  - pro Rechner: online/offline, zuletzt gesehen, Adresse
  - darunter die angemeldeten Tools mit Version und „verbunden seit“
  - „Entfernen“ (nicht bei „dieser Rechner“)
- „Master-Identität erneuern“ (mit Warnung)
- Wurde eine Datei aus `.bak` wiederhergestellt (7.3), steht ein Hinweis dabei.

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
- **„Trennen“ (Slave):**
  - Die Kopplung in `master-link.json` wird gelöscht, die Rolle bleibt „Mit Master verbinden“.
  - Zustand danach: „nicht gekoppelt“.
  - Alle Tools des Rechners trennen sich über die Dateiänderung.
  - Am Master bleibt der Eintrag, bis man ihn entfernt.
- **„Aus“ ← Slave:** wie „Trennen“, zusätzlich wird die Rolle „aus“.
- **„Aus“ ← Master:**
  - Der Master-Link stoppt, alle Sockets werden aktiv geschlossen.
  - Die gekoppelten Rechner bleiben gespeichert.
  - Die Selbstkopplung wird mit der Rolle „aus“ außer Kraft gesetzt.

**Tools:** In Teil 1 bekommen sie keine Anzeige, nur Log-Zeilen bei jedem Zustandswechsel. Die Anzeige kommt mit Teil 2.

### 5.4 Zustände, vollständig

Dauerhaft sichtbare Anzeigen lügen, wenn ein Zustand vergessen wurde (#208: sechs Fälle).

`kopfanzeige(eingang)` ist eine **reine Funktion** über einen Union-Typ mit Prüfung auf Vollständigkeit (`never`). Getestet wird sie gegen **jede Zeile** dieser Tabelle.

**Eingang:**
- `rolle`
- Master-Zustand bzw. Client-Zustand
- Fehlercode
- `karteFehlt`
- `n`, `m` (online / gekoppelt, jeweils ohne „dieser Rechner“)
- Master-Name

| Rolle | Zustand | Kopfanzeige | Farbe |
| --- | --- | --- | --- |
| aus | – | „Verbund aus“ | gedämpft |
| master | startet | „Master startet…“ | gedämpft |
| master | läuft, m = 0 | „Master · noch keine Rechner“ | neutral |
| master | läuft, n = m > 0 | „Master · n/m Rechner online“ | grün |
| master | läuft, n < m | „Master · n/m Rechner online“ | gelb |
| master | Port 8738 belegt | „Master: Port 8738 belegt“ | rot |
| master | Daten beschädigt (7.3) | „Master: Verbunddaten beschädigt“ | rot |
| master | anderer Fehler beim Lauschen | „Master-Fehler: ⟨err.code⟩“ | rot |
| slave | nicht gekoppelt | „Nicht gekoppelt: Master wählen“ | gedämpft |
| slave | koppelt gerade | „Koppeln mit ⟨Name⟩…“ | gelb |
| slave | sucht | „Suche ⟨Name⟩…“ | gelb |
| slave | verbindet | „Verbinde mit ⟨Name⟩…“ | gelb |
| slave | verbunden | „⟨Name⟩ ●“ | grün |
| slave | `zeit` | „⟨Name⟩ sichtbar, Port gesperrt: Firewall?“ | rot |
| slave | `nicht-gefunden` | „⟨Name⟩ nicht erreichbar“ | rot |
| slave | `verweigert` | „⟨Name⟩: Master-Modus aus?“ | rot |
| slave | `netz` | „⟨Name⟩: Netz nicht erreichbar“ | rot |
| slave | `kein-master` | „Adresse antwortet nicht als Master“ | rot |
| slave | `zertifikat` | „Anderer Master unter dieser Adresse“ | rot |
| slave | `uhr` | „Uhrzeit prüfen“ | rot |
| slave | `protokoll` | „Versionen angleichen“ | rot |
| slave | `unbekannt` | „Vom Master entfernt: neu koppeln“ | rot |
| slave | `signatur` | „Anmeldung abgelehnt: neu koppeln“ | rot |
| slave | `ersetzt` | „Kennung doppelt: neu koppeln“ | rot |
| slave | `datei` | „Kopplung beschädigt: neu koppeln“ | rot |
| slave | `sonstig` | „Verbindungsfehler ⟨err.code⟩“ | rot |

**Vorrang für den Hinweis „Karte fehlt“:** In grünen und neutralen Zuständen wird die Farbe gelb und der Kopf zeigt „· Karte fehlt“. In gelben Zuständen wird „· Karte fehlt“ angehängt. In roten bleibt der Kopf unverändert, der Hinweis steht dann nur im Modal.

**Interne Gründe** (`anmeldefrist`, `last`) erscheinen nicht im Kopf. Der Zustand bleibt „sucht“ bzw. „verbindet“.

---

## 6 · Protokoll

### 6.1 Rahmen und Pin (⚠ Abweichung 2 aus Abschnitt 0)

**Übertragung:**
- TLS 1.2 oder neuer (Node-Vorgabe) über TCP.
- Eine Zeile ist ein JSON-Objekt, UTF-8, getrennt durch `\n`.

**Zeilengrenze:**
- vor der Anmeldung **4 KiB**, danach **1 MiB** (Teil 2 hebt das bei Bedarf an)
- Bei Überschreitung und bei kaputtem JSON wird die Verbindung geschlossen.

**Typen:**
- Pflichtfeld ist `t`. Unbekannte Typen werden **ignoriert**, so können die Teile 2–4 neue Nachrichten ergänzen.
- `protokoll` steigt nur bei inkompatiblen Änderungen. Teil 1 hat `1`.

**Pin im Handshake:**
- **Gekoppelt:**
  - Einstellungen: `ca: [<kopplung.zertifikat>]`, `rejectUnauthorized: true` und `checkServerIdentity`, das nur den SHA-256-Fingerprint gegen den Pin vergleicht. Einen Hostnamen-Abgleich gibt es nicht, denn das Zertifikat trägt keine IP.
  - Ein fremdes Zertifikat bricht den Handshake ab, **bevor eine Zeile gelesen wird** (nachgemessen: `DEPTH_ZERO_SELF_SIGNED_CERT`).
- **Koppeln:** Es gibt noch keinen Pin, also `rejectUnauthorized: false`. Hier und nur hier entscheidet der an `fp` gebundene Beweis (3.3).
- Die bestehende Steuerebene prüft erst nach dem Handshake (`packages/suite-control-protocol/src/client.ts:84`, `:113`). Der Master-Link übernimmt das bewusst **nicht**.

**Einordnung der TLS-Fehler** (`fehler.ts`, ausschließlich nach `err.code`):

| Fehler | Code |
| --- | --- |
| `DEPTH_ZERO_SELF_SIGNED_CERT`, `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `CERT_SIGNATURE_FAILURE`, eigener Pin-Fehler aus `checkServerIdentity` | `zertifikat` |
| `CERT_NOT_YET_VALID`, `CERT_HAS_EXPIRED` | `uhr` |
| übrige TLS-Protokollfehler (z. B. `ERR_SSL_WRONG_VERSION_NUMBER`: auf 8738 lauscht etwas anderes) | `kein-master` |

### 6.2 Nachrichten in Teil 1

| Richtung | `t` | Felder |
| --- | --- | --- |
| M → C | `hallo` | `protokoll`, `masterId`, `name`, `nonce` |
| C → M | `koppeln` | `protokoll`, `rechnerId`, `rechnerName`, `nonce`, `schluessel` (SPKI-DER base64), `beweis` |
| M → C | `gekoppelt` | `masterId`, `name`, `beweis`, `adressen` |
| C → M | `anmelden` | `protokoll`, `rechnerId`, `rechnerName`, `signatur`, `teilnehmer: { art, appId, name, version, pid }` |
| C → M | `teilnehmer` | wie `anmelden.teilnehmer`; nach `gekoppelt` oder bei Änderung |
| M → C | `angemeldet` | `adressen` (4.3), `suite` (Launcher-Version des Masters) |
| M → C | `abgelehnt` | `grund`, bei `code-falsch` zusätzlich `rest`, bei `protokoll` zusätzlich `master`, `suite` |
| beide | `puls` | – |

**Werte von `grund`:**
- Koppeln: `code-falsch`, `code-ungueltig`, `keine-kopplung-offen`, `rechner-id`
- Anmelden: `unbekannt`, `signatur`, `protokoll`, `ersetzt`
- intern: `anmeldefrist`, `last`

### 6.3 Grenzen vor der Anmeldung (Master)

- **TLS-Handshake:** Der Server entsteht mit `tls.createServer({ handshakeTimeout: 10_000, … })`. Die Node-Vorgabe wären 120 s.
- **„Unangemeldet“** zählt ab dem TCP-Ereignis `connection`, nicht erst ab `secureConnection`:
  - Anmeldung bzw. Kopplungsanfrage müssen **10 s nach TCP-Annahme** vorliegen, sonst `abgelehnt { grund: "anmeldefrist" }` und Verbindung zu.
  - Höchstens **64** unangemeldete Verbindungen gleichzeitig, die älteste fliegt.
- **Ratenlimit:**
  - Gezählt werden nur **fehlgeschlagene** Signaturprüfungen, je Quell-IP höchstens 20 pro Minute. `127.0.0.1` ist ausgenommen.
  - Bei Überschreitung gilt `abgelehnt { grund: "last" }`. Der Client bleibt auf „sucht“ und wiederholt frühestens nach 5 s.

---

## 7 · Dateien und Speicherorte

### 7.1 `<appData>/JM Production Suite/master-link.json` (gemeinsam, pro Rechner)

Schreiben darf **nur der Launcher**, Tools lesen nur.

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
    "letzteAdresse": "10.0.0.110",
    "festeAdresse": null,
    "schluessel": { "privat": "<PKCS8-DER base64>", "oeffentlich": "<SPKI-DER base64>" }
  }
}
```

**Die Felder:**
- **`netzwerk.karte`:** `null` bedeutet Automatisch, sonst steht hier der Kartenname.
- **`kopplung`:** `null`, solange nicht gekoppelt.
- **`adressen`:** Der Launcher übernimmt `angemeldet.adressen` nur, wenn sie sich ändern.
- **`letzteAdresse`:** Der Launcher schreibt die zuletzt erfolgreiche Adresse nur bei Änderung.
- **`rechner.id`:** entsteht beim ersten Schreiben und bleibt beim Umkoppeln gleich.
  - Die Datei darf nie kopiert oder in ein Rechner-Image übernommen werden. Das Handbuch sagt das ausdrücklich, ein Klon sonst `ersetzt` ergibt.
- **Master-Rechner:**
  - Dort gilt `rolle: "master"`, und `kopplung` ist die Selbstkopplung: eigener Fingerprint, eigenes Zertifikat, eigenes Schlüsselpaar.
  - `adressen`, `letzteAdresse` und `festeAdresse` bleiben leer, denn der Kandidat ist fest `127.0.0.1` (4.5).

**Defekt ist die Datei, wenn eines davon zutrifft:**
- Das JSON ist nicht lesbar.
- Die Rolle ist `master` oder `slave`, aber `kopplung` ist vorhanden **und** unvollständig: Es fehlt einer von `masterId`, `fingerprint`, `zertifikat`, `schluessel.privat`, `schluessel.oeffentlich`.
- `fingerprint ≠ certFingerprint(zertifikat)`.

Unbekannte Zusatzfelder werden verworfen und gelten nicht als Defekt.

**Wann die Tools neu verbinden:**
- Die Tools prüfen die Datei **alle 5 s** anhand der mtime.
- Neu aufgebaut wird die Verbindung **nur**, wenn sich eines dieser Felder geändert hat: `rolle`, `rechner.id`, `kopplung.masterId`, `fingerprint`, `zertifikat`, `schluessel`, `netzwerk.karte` oder `festeAdresse`.
- Geänderte `adressen` und `letzteAdresse` fließen nur in die nächste Kandidatenliste ein, ohne Trennung.

### 7.2 `<userData des Launchers>/master-link/` (nur Master)

- `identitaet.json`: masterId, Name, Zertifikat, privater Schlüssel
- `verbund.json`: gekoppelte Rechner. Je Eintrag stehen dort:
  - `rechnerId`, `name`
  - `schluessel` (öffentlich)
  - `gekoppeltAm`, `zuletztGesehen`, `letzteAdresse`
  - „dieser Rechner“ ist markiert.

### 7.3 Lesen und Schreiben (für alle drei Dateien)

**Schreiben:**
- Ablauf: Temp-Datei im selben Ordner, `fsync`, `rename`, mit `mode: 0o600`.
- Scheitert `rename` unter Windows mit `EPERM`, `EBUSY` oder `EACCES` (Virenscanner, Indexer), wiederholt der Launcher bis zu 2 s lang.
- Bei `identitaet.json` und `verbund.json` wird vor jedem Ersetzen die bisherige gültige Fassung als **`.bak`** abgelegt.

**Lesen:**
- **`ENOENT`** heißt „nicht vorhanden“. **Nur dann** wird die Identität erzeugt bzw. mit leerer Liste begonnen.
- **Parse-Fehler oder Defekt** (7.1) heißt „beschädigt“.
  - Bei `identitaet.json` und `verbund.json` versucht der Launcher zuerst die `.bak`. Klappt das, startet er damit und zeigt einen Hinweis im Log und im Modal.
- **Jeder andere I/O-Fehler** gilt als vorübergehend: Der letzte gültige Stand bleibt, beim nächsten Durchgang wird erneut gelesen. Die mtime wird erst nach erfolgreichem Lesen gemerkt.

**Master mit beschädigten Daten ohne brauchbare `.bak`:**
- Er geht in den Zustand „Master: Verbunddaten beschädigt“ (rot).
- **Er lauscht nicht und überschreibt keine der Dateien.** Er erzeugt **keine** neue Identität und sendet **nie** `unbekannt`.
- Die Slaves sehen einen Verbindungsfehler und versuchen es weiter.
- Das Modal bietet ausdrücklich „Verbund neu aufsetzen“ an. Danach müssen alle Rechner neu gekoppelt werden.

**Tool mit beschädigter `master-link.json`:**
- Es behält den letzten gültigen Stand.
- `fehler:datei` meldet es erst, wenn **zwei aufeinanderfolgende** Lesungen scheitern.
- Es stürzt nie ab.

**Schutz:** Unter Windows liegen alle Dateien im Benutzerprofil, unter macOS wirkt zusätzlich 0600. Das ist derselbe Schutz wie bei `control.json`.

---

## 8 · Aufbau und Einbau

### 8.1 Neues Paket `packages/master-link` (`@jm/master-link`)

Reines Node, **ohne Electron**, testbar wie die Zoom-Bridge. Uhr, `networkInterfaces()`, mDNS (Bonjour-Fabrik) und Dateisystem-Pfade lassen sich überall injizieren. **Importe ohne Dateiendung**, wie im übrigen Repo.

| Datei | Aufgabe |
| --- | --- |
| `code.ts` | Code erzeugen, normalisieren, prüfen; Anzeige `XXXXX-XXXXX` |
| `beweis.ts` | Kopplungsbeweise (HMAC, 3.3), Ed25519 erzeugen/signieren/prüfen (3.4) |
| `rahmen.ts` | Zeilenrahmen mit Grenzen, JSON, Nachrichtentypen, `PROTOKOLL = 1` |
| `adresswahl.ts` | Karten aus `networkInterfaces()` (mehrere IPv4 pro Karte), virtuell/link-local markieren, `ordneKandidaten` (4.4) |
| `fehler.ts` | reine Tabellenfunktion: (`err.code` bzw. Ablehnungsgrund, Phase, „mDNS gesehen“) → Code (9) |
| `datei.ts` | `master-link.json` lesen/prüfen/schreiben (7.1, 7.3), Vergleich „verbindungsrelevante Felder geändert?“ |
| `speicher.ts` | `identitaet.json`/`verbund.json` mit `.bak` (7.2, 7.3) |
| `mdns.ts` | Instanzen je Karte (4.2), Annonce, Suchrunde mit neuem Browser (4.5) |
| `server.ts` | `MasterLinkServer`: Lauscher (4.3), Kopplungsfenster, Anmeldung, Teilnehmerregister, Grenzen (6.3), `entfernen()`, `stoppen()` mit aktivem Schließen aller Sockets |
| `client.ts` | `MasterLinkClient`: Zustandsautomat (aus / sucht / verbindet / verbunden / fehler), Suchrunden, Fristen, Wiederholung (9), Puls |
| `koppeln.ts` | Slave-Seite der Kopplung mit harter Frist (3.3) |
| `index.ts` | öffentliche API |
| `test/selftest.ts` | Selbsttests (11.1), Start per `tsx` |

**Abhängigkeiten:**
- Laufzeit: `@jm/auth-core`, `bonjour-service`
- Entwicklung: `tsx` und `selfsigned` (nur für die Testzertifikate)
- Das Master-Zertifikat erzeugt der Launcher und reicht es als PEM herein.

### 8.2 `@jm/app-runtime`

- **Neue Option `masterLink?: boolean`**, Vorgabe `true`. Der Launcher setzt `false`, weil er seinen eigenen Client führt.
- **Wann der Client startet:** **erst in `app.whenReady()` und nur, wenn `app.hasSingleInstanceLock()` true ist.**
  - Eine kurzlebige Zweitinstanz startet so keinen Client.
  - Bei `before-quit` wird er geschlossen.
  - **Voraussetzung:** Jedes Tool fordert die Sperre an. Timer und Titler tun das (`apps/timer/src/main/index.ts:397`, `apps/titler/src/main/index.ts:462`). Für die übrigen Tools prüft das der Plan vor ihrem nächsten Release.
- **Teilnehmer:** Art `tool`, dazu appId, Name, Version, pid. Grundlage ist `master-link.json`.
- **Ohne Kopplung untätig:** Fehlt die Datei, ist die Rolle „aus“ oder ist die Rolle Slave ohne `kopplung`, öffnet der Client keinen Socket und startet kein mDNS (`verbund: aus`).
- **Zustand melden:** als Feld `verbund` im lokalen Heartbeat (5.2) und als Log-Zeile bei jedem Wechsel.
- **Neue Exportfunktion `getMasterLinkStatus()`** als Basis für Teil 2. In Teil 1 ruft sie niemand.

### 8.3 Launcher

- **`src/main/verbund.ts`** führt die Rolle. Es startet nur im Zweig mit der Einzelinstanz-Sperre.
  - **Master:** Identität laden/erzeugen (7.3), `MasterLinkServer`, Selbstkopplung, `verbund.json`
  - **Slave:** `MasterLinkClient` als `launcher`, Koppeln, Datei schreiben
- **IPC** für das Modal. `emitAppEvent({ type: 'verbund-changed' })` bei jedem Wechsel.
- **`src/main/presence.ts`:** `verbund` in `Beat`, `Entry`, `snapshot()` und in die Signatur von `maybeNotify` (5.2).
- **`src/shared/types.ts`:** `PresenceRecord.verbund?`.
- **Renderer:**
  - `VerbundModal.tsx`
  - `VerbundBadge.tsx` im `Header`
  - `kopfanzeige.ts`: rein, nur `import type`, testbar im Launcher-Selbsttest

### 8.4 Nicht angefasst

- `@jm/discovery`, `@jm/suite-control-protocol`, `@jm/control-config`
- Health-Pool, `iveo-sync`, Show-Start

Die Presence wird nur um das Feld `verbund` erweitert (8.3).

---

## 9 · Fehlerbilder am Slave (⚠ Abweichungen 3 und 5 aus Abschnitt 0)

### 9.1 Verbindungsfehler

**Rangfolge:** Liefert eine Suchrunde mehrere Ursachen, gilt die aussagekräftigste:
`unbekannt` > `signatur` > `zertifikat` > `uhr` > `protokoll` > `kein-master` > `verweigert` > `zeit` > `sonstig` > `netz` > `nicht-gefunden`.

| Code | Erkannt an | Text für den Bediener | Wiederholung |
| --- | --- | --- | --- |
| `zeit` | TCP-Timeout (3 s) **und** der Master wurde in dieser Runde per mDNS gesehen | „Regie-PC ist im Netz sichtbar, aber Port 8738 antwortet nicht. Wahrscheinlich sperrt die Firewall am Master (Regel und Netzprofil prüfen).“ | normal |
| `nicht-gefunden` | kein mDNS-Treffer in dieser Runde **und** jeder Kandidat mit TCP-Timeout, oder gar kein Kandidat. Ohne mDNS-Treffer wird aus einem TCP-Timeout also nie `zeit`. | „Regie-PC nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus, anderes Netz oder Firewall. Gleiches Netz? Sonst feste Adresse eintragen.“ | normal |
| `verweigert` | `ECONNREFUSED`. Kommt bei Windows-Mastern mit aktiver Firewall selten vor (Stealth). | „Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?“ | normal |
| `netz` | `EHOSTUNREACH`, `ENETUNREACH` | „Netz zum Master nicht erreichbar. Richtiges Netz/Kabel? Netzwerkwahl prüfen.“ | normal |
| `kein-master` | TCP steht, aber TLS, `hallo` oder `angemeldet` bleiben aus bzw. es kommt ein TLS-Protokollfehler | „Unter ⟨Adresse⟩ antwortet ein Dienst, aber nicht als Master.“ | normal |
| `zertifikat` | Pin passt nicht (6.1) | „Unter dieser Adresse antwortet ein anderer Master, oder der Master wurde neu aufgesetzt. Neu koppeln.“ | alle 30 s |
| `uhr` | Zertifikat noch nicht bzw. nicht mehr gültig (6.1) | „Die Uhrzeit dieses Rechners oder des Masters stimmt nicht. Uhrzeit prüfen.“ | alle 30 s |
| `protokoll` | `abgelehnt { grund: "protokoll" }` | „Versionen passen nicht: Master hat Launcher ⟨suite⟩ (Protokoll ⟨master⟩), dieses Programm Protokoll ⟨eigenes⟩. Bitte angleichen.“ | alle 60 s |
| `unbekannt` | `abgelehnt { grund: "unbekannt" }`, in jedem Zustand | „Dieser Rechner wurde am Master entfernt. Neu koppeln.“ | keine, bis sich die Datei ändert |
| `signatur` | `abgelehnt { grund: "signatur" }` | „Anmeldung abgelehnt: Der Schlüssel passt nicht zur Kopplung. Neu koppeln.“ | keine, bis sich die Datei ändert |
| `ersetzt` | `abgelehnt { grund: "ersetzt" }` auf einer angemeldeten Verbindung | „Diese Rechnerkennung meldet sich ein zweites Mal beim Master an (Ordner kopiert oder Rechner geklont?). Neu koppeln.“ | alle 60 s |
| `datei` | `master-link.json` beschädigt, zweimal in Folge (7.3) | „Kopplungsdatei beschädigt. Neu koppeln.“ | keine, bis sich die Datei ändert |
| `sonstig` | jeder andere Socket- oder TLS-Fehler (z. B. `ECONNRESET`) | „Verbindungsfehler ⟨err.code⟩.“ | normal |

**Hinweise zur Tabelle:**
- **„Normal“** meint den Rückzug aus 4.5 (1 → 10 s, ±25 %).
- **Interne Gründe, ohne Anzeige:**
  - `anmeldefrist`: normal
  - `last`: frühestens nach 5 s
- **Die feste Adresse:** Über VLAN-Grenzen gibt es kein mDNS, die Meldung ist dann immer `nicht-gefunden`. Deren Text nennt die Firewall deshalb mit.

### 9.2 Beim Koppeln (nur im Modal)

| Fall | Text |
| --- | --- |
| `code-falsch` | „Code stimmt nicht, noch ⟨rest⟩ Versuche.“ |
| `code-ungueltig` | „Code abgelaufen oder verbraucht. Am Master einen neuen Code holen.“ |
| `keine-kopplung-offen` | „Am Master zuerst ‚Rechner koppeln‘ öffnen.“ |
| `rechner-id` | „Dieser Rechner hat dieselbe Kennung wie der Master (Ordner kopiert?). Kopplungsdatei zurücksetzen.“ |
| Master-Beweis falsch | „Der Master konnte den Code nicht bestätigen, möglicherweise ein fremdes Gerät. Nichts gespeichert.“ |
| Frist 10 s abgelaufen | „Der Master hat nicht rechtzeitig bestätigt. Nichts gespeichert.“ |
| Verbindungsfehler | Text aus 9.1 |

---

## 10 · Sicherheit

- **TLS immer.**
  - Gekoppelt ist der Pin im Handshake (6.1).
  - Beim Koppeln schützt der an `fp` gebundene Beweis mit harter Frist am Slave (3.3).
- **Der Master hält keine Slave-Geheimnisse** (Ed25519, 3.4). Die Slaves halten ihren privaten Schlüssel im Benutzerprofil.
- **Kopplung nur im offenen Fenster:**
  - Der Code ist höchstens 2 min alt und hat weniger als 5 Fehlversuche.
  - Ein `koppeln` mit der Kennung des Masters selbst wird abgelehnt.
- **„Entfernen“** wirkt sofort, auch auf laufende Verbindungen.
- **„Erneuern“ und „Aus“** schließen alle Sockets aktiv (3.4, 3.5, 5.3).
- **Grenzen vor der Anmeldung:**
  - 10 s Handshake, 10 s bis zur Anmeldung ab TCP-Annahme
  - 64 Verbindungen, 4 KiB pro Zeile
  - Ratenlimit auf fehlgeschlagene Signaturen (6.3)
- **Nie im Log:** Code, private Schlüssel, Beweise, Signaturen. Fingerprints erscheinen nur gekürzt (16 Zeichen).
- **mDNS-TXT ist unbeglaubigt.** Er dient nur zur Anzeige und Vorauswahl.
- **Beschädigte Daten:** Eine beschädigte Master-Datei entkoppelt nie still. Ein Absturz im Schreibfenster kann höchstens den Master stoppen, nie die Slaves aussperren (7.3).
- **Bekannt, außerhalb von Teil 1:**
  - Der Timer-Socket.IO-Server `:7777` nimmt `tt:replaceItems` ohne Anmeldung an. Das ist Thema von Teil 2, wenn Show-Daten über das Netz kommen.
  - Der sichere Modus der Steuerebene gilt pro Rechner und bleibt unverändert.

---

## 11 · Tests

### 11.1 Selbsttests `@jm/master-link`

Aufruf: `npx tsx test/selftest.ts`. Das läuft ab Node 20.

**Aufbau:**
- Echte TLS-Verbindungen auf `127.0.0.1`.
- Mehrere „Rechner“ werden mit getrennten Temp-Ordnern nachgestellt.
- Uhr, Karten und mDNS sind injiziert. Echtes Multicast läuft nicht in der CI, dafür gibt es das Zusatzskript `selftest:mdns` für den lokalen Lauf.

1. **Code:**
   - Alphabet und Länge
   - Normalisierung
   - fremdes Zeichen → lokaler Fehler ohne Versuch
   - **Verteilung:** 100 000 Zeichen, Chi-Quadrat über 31 Eimer, bestanden bei χ² < 80 (df = 30, p ≈ 10⁻⁶). Gegenprobe: `randomBytes % 31` muss durchfallen.
2. **Kopplungsfenster:**
   - nach 2 min → `code-ungueltig`
   - nach Erfolg → `code-ungueltig`
   - nach 5 Fehlversuchen → `code-ungueltig`
   - `rest` zählt herunter
   - neuer Code ersetzt alten
   - Fenster zu → `keine-kopplung-offen`
3. **Mittelsmann (wichtigster Test):**
   - **Relais:** Ein Proxy mit eigenem Zertifikat leitet an den echten Master weiter. Der Master lehnt ab (Fehlversuch), der Slave speichert nichts.
   - **Falscher Master mit beliebigem Beweis:** Der Slave lehnt ab und pinnt nichts.
   - **Falscher Master kennt K, schickt aber bis 11 s nach `koppeln` nur `puls` und dann einen korrekten Beweis:** Der Slave hat nach 10 s abgebrochen, `master-link.json` ist unverändert.
   - **`abgelehnt` vor `gekoppelt`:** wird angezeigt, Datei und Pin bleiben unverändert.
4. **Schlüsselpaar:**
   - `verbund.json` enthält keinen privaten Schlüssel.
   - Eine alte Signatur mit neuer Nonce wird abgelehnt.
   - **„Entfernen“ während der Verbindung:** Die Verbindung ist binnen 1 s zu, der Client zeigt `unbekannt` und versucht es nicht weiter. Die anderen bleiben verbunden.
   - **Neu koppeln mit bekannter rechnerId:** Genau ein Eintrag bleibt, der neue Schlüssel gilt, der alte wird mit `signatur` abgelehnt.
   - **`koppeln` mit der rechnerId des Masters** → `rechner-id`.
5. **Fehlerbilder**, als Tabellentest für `fehler.ts` und an echten Sockets:
   - `verweigert`
   - `zeit`: mit mDNS gesehen
   - `nicht-gefunden`: ohne mDNS
   - `kein-master`: TCP wird angenommen, dann Schweigen; zusätzlich ein Nicht-TLS-Dienst
   - `zertifikat`: Der Handshake bricht ab, und der Client hat **keine Zeile** gelesen.
   - `uhr`: Zertifikat mit notBefore in der Zukunft
   - `protokoll`
   - `sonstig`
   - Rangfolge bei mehreren Ursachen
   - `ersetzt` auf einer lebenden Verbindung → Fehlerzustand, frühestens nach 60 s neu
6. **Adresswahl und Suche:**
   - **Realistische Karten:**
     - Hyper-V `172.x/20` + LAN `10.0.0.x/24`
     - VPN `100.64.x`
     - zwei echte Karten
     - eine Karte mit zwei IPv4
     - nur 169.254 auf beiden Seiten (findet sich, letzter Rang)
     - gewählte Karte fehlt → Automatisch
   - Entdoppelung und Reihenfolge der Kandidaten
   - **Master-Rechner:** nur `127.0.0.1`
   - **mDNS-Instanzen** aus einer Attrappe mit zwei Karten: je Karte eine Instanz, `bind: '0.0.0.0'`, Instanzname aus masterId, `probe: false`
   - **Neue Adresse:** Ein bekannter Master antwortet mit neuer Adresse, und die **nächste Suchrunde** liefert die neue.
   - `adressen` enthält nur Adressen, auf denen gelauscht wird.
7. **Status:**
   - Anmelden, Puls, Trennen
   - Verbindung weg → sofort getrennt
   - 25 s Stille → getrennt
   - gleicher Schlüssel → alte Verbindung `ersetzt`, Warnung im Log
   - „online“ je Rechner
   - „dieser Rechner“ ist online, solange der Server läuft
8. **Neustart und Erneuern:**
   - **Master-Neustart** mit gleicher Identität: Alle kommen zurück.
   - **Identität erneuert:** Alle **fremden** Clients melden `zertifikat`, die Selbstkopplung ist neu geschrieben, die eigenen Tools verbinden wieder.
   - **`stoppen()`:** Alle Sockets sind binnen 1 s zu.
9. **Rahmen und Grenzen:**
   - 4 KiB / 1 MiB
   - unbekannter Typ wird ignoriert
   - kaputtes JSON → Verbindung zu
   - Handshake ohne Fortschritt → nach 10 s zu
   - keine Anmeldung 10 s nach TCP-Annahme → `anmeldefrist`
   - 65. unangemeldete Verbindung → die älteste fliegt
   - Ratenlimit zählt nur Fehlschläge, Loopback ist ausgenommen, `last`
10. **Dateien:**
    - atomares Schreiben
    - `rename`-Wiederholung
    - `.bak`-Rückfall
    - `ENOENT` → erzeugen, Müll → **nie** erzeugen
    - **Müll in `verbund.json` ohne `.bak`:** Der Master startet nicht, und kein Client bekommt `unbekannt`.
    - Defekt-Regeln von `master-link.json` (7.1)
    - zwei Fehllesungen in Folge → `datei`
    - Adressänderung → keine Trennung, Schlüsseländerung → Neuaufbau
    - Änderung wird binnen 5 s erkannt

### 11.2 Launcher

- **Selbsttest** (`node --experimental-strip-types`, Node ≥ 22.6):
  - `kopfanzeige()` gegen **jede Zeile** der Tabelle 5.4, dazu die Vorrangregel „Karte fehlt“
  - Presence-Hub ohne Electron: Ein Beat mit geändertem `verbund` löst **genau eine** Benachrichtigung aus, ein unveränderter keine.
- **Oberfläche:** Der Launcher wird per CDP ferngesteuert wie bei #233. Jeder Zustand von Kopfanzeige und Modal wird per Screenshot geprüft, auch bei Mindestgröße 980×640.

### 11.3 CI

- **Neuer Job „Selbsttests“** in `ci-checks.yml` mit **Node 22**:
  - `npm ci --ignore-scripts`
  - danach die Selbsttests von `@jm/master-link` (tsx) und `@jm/launcher` (strip-types)
- **Der bestehende Typecheck-Job bleibt bei Node 20.**

---

## 12 · Abnahme (durch den Owner, zwei echte Windows-Rechner)

Checkliste als `packages/master-link/ABNAHME.md`. Jeder Punkt hat die Spalten **Vorbedingung · Schritt · Erwartung · Ergebnis/Datum**.

1. **Vorbedingung:** Die Programmregel für „JM Production Suite“ erlaubt eingehend im **aktuellen Netzprofil** (Anleitung im Handbuch).
   - Master-Modus an A einschalten. A zeigt „Master · noch keine Rechner“.
   - Es wird **keine** Firewall-Abfrage erwartet.
2. **Koppeln:** An B „Mit Master verbinden“, A erscheint in der Liste. Code tippen.
   - B zeigt „Regie-PC ●“, A zeigt „1/1 Rechner online“ (grün).
3. **Tool ohne Launcher:** Launcher auf B beenden, **Timer auf B allein starten**. Er erscheint an A unter B.
4. **Tool am Master:** Timer auf A starten. Er erscheint unter „dieser Rechner“.
5. **Kabel ziehen:**
   - Netzkabel an **B** ziehen: A zeigt B nach höchstens 25 s offline. Kabel wieder rein: B kommt ohne Zutun zurück.
   - Netzkabel an **A** ziehen: Der Timer auf A bleibt verbunden (Loopback).
6. **Master-Neustart:** A neu starten, alle kommen ohne Zutun zurück.
7. **Entfernen:** B an A entfernen, **während B verbunden ist**. B zeigt sofort „Vom Master entfernt: neu koppeln“ und versucht es nicht weiter.
8. **Fehlerdeutung:**
   - Launcher an A läuft, Master-Modus **aus**: B zeigt „Regie-PC nicht erreichbar“ und **nicht** „Firewall?“.
   - Master-Modus an, an A eine eingehende **Blockregel nur für TCP 8738** anlegen (Portregel, mDNS bleibt offen): B zeigt „sichtbar, Port gesperrt: Firewall?“. Eine gesperrte **Programmregel** würde auch mDNS sperren, dann ist „nicht erreichbar“ die richtige Anzeige.
9. **Falscher Code:** Fünfmal falscher Code. Der Code wird ungültig, „noch n Versuche“ zählt herunter.
10. **Netz ohne Gateway** (Profil „Öffentlich“): Koppeln und Verbinden klappen, sobald die Regel für „Öffentlich“ erlaubt. Ohne diese Regel zeigt B den Firewall-Hinweis.
11. **Mehrere Karten** (falls vorhanden): Ein Rechner mit Hyper-V- oder zweiter Karte wählt die richtige Adresse. Die feste Adresse funktioniert über eine VLAN-Grenze.
12. **Einzelplatz:** Master-Modus wieder aus, **ein Rechner allein**. Show-Start, RELOAD und Anzeigen verhalten sich wie vorher.

**macOS:** Die Regel `bind: '0.0.0.0'` stammt aus dem Code von `multicast-dns`. Abgenommen wird in Teil 1 nur unter Windows. Ein Mac-Test folgt, sobald ein Mac im Aufbau steht.

---

## 13 · Release

- **In Teil 1:**
  - **Launcher 0.12.0**
  - **Timer 0.12.0**
  - **Titler 0.9.0**, wie gewohnt lokal gebaut (NDI), plus `bump-manifest`-PR (`docs/release-titler.md`)
  - Einträge in `changelog.json`, Tags einzeln pushen.
- **Alle anderen Tools** bekommen den Client mit ihrem nächsten regulären Release, weil `@jm/app-runtime` dann mitgebaut wird.
  - Vor diesem Release prüft der Plan, dass das Tool die Einzelinstanz-Sperre anfordert (8.2).
  - Bis dahin laufen die Tools unverändert und erscheinen als „noch ohne Verbund (Update nötig)“ (5.2).
  - Ohne Kopplung ist der Client völlig untätig.
- **Handbuch:** neuer Abschnitt „Mehrere Rechner: Verbund“ mit:
  - Koppeln
  - Netzwerkwahl
  - feste Adresse
  - Firewall: Regel **und** Netzprofil, `wf.msc`, `Set-NetConnectionProfile`, eigene Abfragen bisher stiller Tools
  - „`master-link.json` nie kopieren oder in Images übernehmen“
  - Hinweis, dass `control.json` für den Verbund nicht mehr kopiert werden muss

---

## 14 · Nicht in Teil 1

- Show-Daten über das Netz, iveo-Weitergabe, #235 → Teil 2
- Fernstart von Tools → Teil 3
- Show-Zentrale als eigenes Fenster → Teil 4
- Anzeige in den Tools → Teil 2
- IPv6, Verbindungen über das Internet/NAT, mehrere Master mit Ausfallübernahme
- automatische Firewall-Regeln im Installer
- Änderungen an Steuerebene, Companion, `control.json`, sicherem Modus
- Authentifizierung für Timer `:7777` → Teil 2
