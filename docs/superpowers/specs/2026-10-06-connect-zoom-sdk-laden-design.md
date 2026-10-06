# JM Connect: Zoom-SDK nachladen (Design)

- **Stand:** 06.10.2026
- **Status:** Entwurf und Spec vom Owner freigegeben (06.10.2026); privates Repo und Upload freigegeben
- **Ziel-Release:** connect-v0.2.2, unabhängig von Stage 4b
- **Baut auf:** `2026-10-02-zoom-stage4-connect-design.md` (Spec 5.3 Laufzeit, 5.6 Zugangsdaten, S1–S10) und dem Nachtrag „Zugangsdaten von Hand“ (0.2.1)

## 1. Ziel und Grenzen

Der Bediener soll das Zoom-Meeting-SDK nicht mehr selbst besorgen und als Ordner wählen müssen. Connect lädt es auf Knopfdruck aus einer privaten Ablage, prüft es und richtet es über die vorhandene Prüf- und Kopierstrecke ein.

**Rechtlicher Rahmen.** Grundlage ist die Zoom API License and Terms of Use, abgerufen am 06.10.2026:

- **§3.7(21):** Das SDK darf nur als Teil der eigenen Anwendung weitergegeben werden.
- **§6.1:** Die Anwendung ist nur für den internen Geschäftsgebrauch bestimmt. Weitergabe an Dritte ist nur nach einer Veröffentlichung im Marketplace oder mit vorheriger schriftlicher Freigabe durch Zoom erlaubt.
- **Owner-Entscheid vom 06.10.:** Das SDK wird **nur auf JM-eigene Rechner** nachgeladen, Kunden bekommen es nicht.

Daraus folgen diese Regeln:

- Zoom-Dateien liegen **nie** in einem öffentlichen Repo, Release oder Installer.
- Der Zugang ist durch einen **eigenen SDK-Schlüssel** geschützt. Er steckt in **keinem** öffentlichen Artefakt: nicht im Code, nicht in CI-Secrets, nicht in Build-Variablen, und es gibt keinen Vorgabewert.
- Der vorhandene Proxy-Schlüssel scheidet aus. Der Launcher backt ihn beim Bauen ein (`apps/launcher/electron.vite.config.ts:31`), und die Launcher-Installer sind öffentlich.

**Nicht im Umfang:**

- macOS;
- andere SDK-Fassungen als 7.1.5.43953;
- automatisches Laden ohne Klick;
- Laden durch den Launcher;
- Verteilen des Schlüssels über den Master-Link;
- Kunden-Rechner.

## 2. Paket und Ablage

| Was | Wert |
|---|---|
| Inhalt | alle Dateien aus `x64\bin` des SDK 7.1.5.43953, am ZIP-Wurzelpfad (153 Dateien, 315 MB entpackt, gemessen 06.10.) |
| Datei | `zoom-sdk-win-x64-7.1.5.43953.zip`, rund 143 MB (gemessen mit `tar.exe -a`) |
| Ablage | privates Repo `AlexmachtCode/jm-zoom-sdk`, Release mit Tag `zoom-sdk-7.1.5.43953`, einziges Asset ist das ZIP |
| Prüfsumme | SHA-256 des hochgeladenen ZIP, **fest im Connect-Code** (Abschnitt 4.1) |

- **Bau:** Das ZIP baue ich einmal lokal aus dem SDK-Ordner, nur lesend. Ausgabe in den Scratchpad, dann Upload. Danach wird die lokale Kopie gelöscht.
- **Pinning:** Der SHA-256 wird **nach** dem Upload am heruntergeladenen Asset nachgemessen und erst dann im Code eingetragen.
- **Schutz vor Zugangsdaten:** Das ZIP enthält keine Zugangsdaten. Gebaut wird nur aus `SDKs\…\x64\bin`, und vor dem Upload werden die Dateinamen gegen die Liste aus dem SDK-Ordner abgeglichen.
- **Bei einem Austausch:** Wird das ZIP je neu hochgeladen, muss der gepinnte SHA im Code mit, und es braucht einen neuen Connect-Release. Das ist gewollt: Connect richtet nur ein Paket ein, das genau zu seinem Code passt.

## 3. Proxy (`services/release-proxy/worker.js`)

### 3.1 Route

`GET /zoom-sdk/:fassung`

- Die Route liegt **vor** dem Proxy-Key-Gate (`worker.js:130`) und hat ihre eigene Prüfung.
- Erlaubte Fassung: nur `^\d+\.\d+\.\d+\.\d+$`, sonst 404.
- **Schlüssel:** Header `X-Zoom-Sdk-Key`. Vergleich gegen das Worker-Secret `ZOOM_SDK_KEY`, und zwar **zeitkonstant**: beide Werte mit SHA-256 auf gleiche Länge bringen, dann `crypto.subtle.timingSafeEqual`.
  - Fehlt das Secret oder passt der Header nicht: 401 `{error:'unauthorized'}`.
  - Der Proxy-Schlüssel wird hier **nicht** verlangt.
- **Drosselung:** Die vorhandene `rateLimit`-Funktion (KV `RATELIMIT`) bekommt einen eigenen Bucket `zoomsdk`, mit 20 Anfragen je 10 Minuten je IP. Die Drosselung greift **vor** dem Schlüsselvergleich, auch für gültige Schlüssel. Bei Überschreitung: 429 mit `Retry-After`.
- **Release finden:** Die Variable `ZOOM_SDK_REPO` (in `[vars]`, Vorgabe `AlexmachtCode/jm-zoom-sdk`) bestimmt das Repo. Abgefragt wird `GET /repos/{ZOOM_SDK_REPO}/releases/tags/zoom-sdk-{fassung}` mit `GITHUB_TOKEN`. Das Asset heißt `zoom-sdk-win-x64-{fassung}.zip`.
  - Fehlt Release oder Asset: 404 `{error:'not_found'}`.
  - Andere GitHub-Fehler: 502 `{error:'upstream'}`. Es wird kein GitHub-Fehlertext weitergereicht.
- **Link:** `resolveSignedUrl` bekommt das Repo als Parameter, heute nimmt es fest `env.REPO`. Die bestehenden Aufrufe übergeben weiter `env.REPO`.
- **Antwort 200:** `{ fassung, url, size }`. `url` ist der kurzlebige, signierte Storage-Link von GitHub. Der Client lädt direkt von dort, der Worker streamt nichts.

### 3.2 Was der Proxy nie tut

- Er loggt keinen Schlüssel und keinen signierten Link.
- Er reicht keinen GitHub-Fehlertext durch.
- Er liefert keine Prüfsumme. Die Prüfsumme kommt nur aus dem Connect-Code; ein manipulierter Proxy kann ein falsches Paket also nicht durch eine passende Prüfsumme tarnen.

### 3.3 Einrichtung (einmalig, durch den Owner)

1. Dem `GITHUB_TOKEN` des Proxys Lesezugriff auf `AlexmachtCode/jm-zoom-sdk` geben (Contents: read). Das macht der Owner in GitHub.
2. `wrangler secret put ZOOM_SDK_KEY`: Der Owner tippt einen selbst gewählten Schlüssel ein. Er erscheint nie in einem Chat, Log oder Repo.
3. `wrangler deploy` braucht ein ausdrückliches Owner-Okay.

## 4. Connect

### 4.1 Gepinntes Paket

Neue Datei `apps/connect/src/main/zoom/sdk-paket.ts`:

```ts
export const SDK_PAKET = {
  fassung: '7.1.5.43953',            // = SDK_FASSUNG aus @jm/zoom-bridge, per Test abgeglichen
  datei: 'zoom-sdk-win-x64-7.1.5.43953.zip',
  sha256: '<nach dem Upload nachgemessen>',
  bytes: <exakte ZIP-Größe>,
  bytesEntpackt: <Summe der entpackten Dateien>,
} as const;
```

Ein Test prüft `fassung === SDK_FASSUNG`. Platzhalter dürfen nicht ausgeliefert werden: Ein Test schlägt fehl, solange `sha256` nicht aus 64 Hex-Zeichen besteht.

### 4.2 SDK-Schlüssel

- **Speicher:** Neben dem Proxy-Schlüssel in `settings.ts`, nach demselben Muster:
  - Rangfolge: Umgebung `JMPS_ZOOM_SDK_KEY` vor `zoomSdkKeyEnc` (safeStorage, base64) vor einem Sitzungsspeicher.
  - Ohne Schlüsselbund wird der Schlüssel nur für die Sitzung gehalten, nie im Klartext auf die Platte.
- **Eingabe:**
  - Neuer Kanal `jmc:zoom-sdk-schluessel-eintragen` mit der Nutzlast `{ schluessel: string }`, höchstens 512 Zeichen. Die Nutzlast-Prüfung ist eine reine Funktion, wie `zugang-eingabe.ts`.
  - Der Wert wird getrimmt. Leer oder mit Leerraum in der Mitte ergibt S18.
  - Zum Löschen dient `jmc:zoom-sdk-schluessel-loeschen`.
  - Es gibt keinen Rückweg ins Fenster. Das Abbild trägt nur `einrichtung.sdkSchluessel: { herkunft: ProxyKeySource }`.
- **Sperre:** Wie bei den Zugangsdaten gilt S10. Im Zustand `fehler` wird zuerst geschlossen.
- **Log:** `[zoom] SDK-Schlüssel hinterlegt (verschlüsselt | nur für diese Sitzung)` bzw. `… entfernt`. Nie der Wert.

### 4.3 Laden: `sdkLaden()` im Kern

**Neues Modul `apps/connect/src/main/zoom/sdk-laden.ts`.** Die Abhängigkeiten werden eingespeist (`fetch`, Dateisystem, `spawn`, Uhr), damit es testbar ist. Die Funktionen:

- `holeLink({ base, schluessel, fassung, signal })` → `{ url, size }` oder einen Fehler mit Art `schluessel` (401), `gedrosselt` (429, mit Sekunden), `fehlt` (404), `proxy` (sonstiges oder Netz).
- `lade({ url, ziel, erwartet: SDK_PAKET, signal, fortschritt })`:
  - Streamt nach `<ziel>.teil` und rechnet dabei SHA-256 mit.
  - Fortschritt kommt höchstens 4-mal je Sekunde.
  - Am Ende prüft es: Bytes = `erwartet.bytes` (sonst `unvollstaendig`), SHA = `erwartet.sha256` (sonst `pruefsumme`). Erst danach wird umbenannt.
  - Bei Fehler oder Abbruch löscht es `.teil`.
  - Die von `holeLink` gemeldete `size` muss gleich `erwartet.bytes` sein, sonst Fehler `fehlt`. Dann liegt auf dem Proxy ein anderes Paket.
- `entpacke({ zip, ordner, signal })`:
  - Ruft `%SystemRoot%\System32\tar.exe -xf <zip> -C <ordner>` mit absolutem Pfad auf, ohne Shell.
  - Ein Exit-Code ungleich 0, eine fehlende `tar.exe` oder ein Abbruch ergeben den Fehler `entpacken`.
  - bsdtar lehnt absolute Pfade und `..` ab. Zusätzlich ist das ZIP zu diesem Zeitpunkt schon gegen den gepinnten SHA geprüft.

**Ablauf von `sdkLaden()`:**

1. **Sperre:** `einrichtungSperre()` (S10). Es läuft weder `laden` noch `kopie`. Im Zustand `fehler` wird zuerst geschlossen.
2. **Schlüssel:** Fehlt der SDK-Schlüssel, kommt S11.
3. **Platz** auf dem Laufwerk von `zoom-laufzeit`: `bytes + 2 × bytesEntpackt + 100 MiB`. Reicht er nicht, kommt S5 (bestehender Text).
4. **Arbeitsordner** `…\zoom-laufzeit\laden\`. Reste eines früheren Laufs werden vorher gelöscht.
5. **Phasen:** `link` → `download` → `pruefen` → `entpacken` mit `laden = { phase, bytes, bytesGesamt }` im Abbild. Ein neuer `AbortController` (`ladeAbbruch`) steuert den Abbruch.
6. **Einrichten:** Der entpackte Ordner geht durch **dieselbe** Strecke wie `sdkWaehlen`. Dafür wird `sdkWaehlen` in `pruefeUndRichteEin(ordner, herkunft)` geteilt, ohne Verhaltensänderung, mit Regressionstest. Die Strecke ist `lz.pruefeOrdner` → `lz.richteEin` mit dem bestehenden `kopie`-Fortschritt.
7. **Aufräumen:** `finally` löscht ZIP und Entpackordner immer. Ein Aufräumfehler wird nur geloggt.
8. **Fehler:** `sdkFehler` = passender Text (Abschnitt 5). Die bisherige Einrichtung bleibt unverändert, denn `richteEin` tauscht erst am Ende.

**Abbrechen:**

- Neuer Kanal `jmc:zoom-sdk-laden-abbrechen`. Er bricht in den Phasen `link`, `download` und `entpacken` ab, danach greift er nicht mehr.
- Die Kopie hat heute keinen Abbrechen-Knopf, und das bleibt so.
- Ergebnis eines Abbruchs: S17, als Hinweis und nicht rot.

**Beenden:** `kern.beenden` bricht ein laufendes Laden ab, wie heute `kopieAbbruch`, und wartet darauf (L24-Muster).

**Log**, ohne Schlüssel und ohne Link:

- `[zoom] Zoom-SDK wird geladen (143 MB)`
- `[zoom] Zoom-SDK geladen und geprüft`
- `[zoom] Laden des Zoom-SDK gescheitert: <Text>`
- `[zoom] Laden des Zoom-SDK abgebrochen`

Vom Proxy wird nur der Host geloggt.

**Proxy-Adresse:** `proxyUrl()` aus `settings.ts`, also Umgebung, Einstellung oder `DEFAULT_PROXY_URL`. Ein Proxy-Schlüssel wird nicht gebraucht.

### 4.4 Abbild und Sperre

- `einrichtung.sdk` bekommt das Feld `laden: { phase: 'link'|'download'|'pruefen'|'entpacken'; bytes: number; bytesGesamt: number } | null`.
- `einrichtung` bekommt das Feld `sdkSchluessel: { herkunft: ProxyKeySource }`.
- `einrichtungSperre()` ist zusätzlich nur frei, wenn `laden === null`.
- Kopfzeile und Tray zeigen während des Ladens dieselbe Einrichtungszeile wie während der Kopie. Es gibt dafür keinen neuen Text, nur die Karte zeigt die Phase.

### 4.5 Karte

In der Einrichtung gibt es zwei Zeilen.

**Zeile „Zoom-SDK“:**

- Knopf **„Zoom-SDK laden“** neben „SDK-Ordner wählen …“. Er erscheint unter derselben Bedingung wie „SDK-Ordner wählen …“.
- Er ist gesperrt, wenn kein SDK-Schlüssel da ist. Der Tooltip zeigt dann S11. Bei S10 hat er dieselbe Sperre wie die Ordnerwahl.
- Während des Ladens steht dort `Zoom-SDK wird geladen … 63 von 143 MB` bzw. `wird geprüft …` oder `wird entpackt …`, dazu der Knopf **„Abbrechen“**. Danach folgt die bestehende Kopieranzeige.

**Neue Zeile „SDK-Schlüssel“:**

- Stand: `hinterlegt`, `hinterlegt (nur für diese Sitzung)`, `aus der Umgebung` oder `fehlt`.
- Knöpfe „Eintragen …“ und „Entfernen“. „Entfernen“ fehlt bei `aus der Umgebung`.
- Das Formular ist ein Feld „SDK-Schlüssel“, verdeckt, mit dem Schalter „anzeigen“/„verbergen“, dazu „Speichern“ und „Abbrechen“.
- Muster und Lebensdauer wie bei `ZugangEingabe`: Die Werte leben nur in der Komponente, und das Formular schließt mit der Einrichtung.

## 5. Texte (zur Freigabe)

| ID | Text |
|---|---|
| S11 | Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel. Bitte unter „SDK-Schlüssel“ eintragen. |
| S12 | Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen. |
| S13(s) | Zu viele Versuche. Bitte in {⌈s/60⌉} Minuten erneut versuchen. |
| S14(grund) | Der Proxy ist nicht erreichbar ({grund}). Bitte die Netzverbindung prüfen oder den SDK-Ordner von Hand wählen. |
| S15 | Auf dem Proxy liegt kein passendes Zoom-SDK 7.1.5.43953. Bitte den SDK-Ordner von Hand wählen. |
| S16(grund) | Das Zoom-SDK ließ sich nicht laden ({grund}). Die bisherige Einrichtung bleibt unverändert. |
| S16b | Das geladene Zoom-SDK hat nicht die erwartete Prüfsumme und wurde verworfen. Die bisherige Einrichtung bleibt unverändert. |
| S16c(grund) | Das geladene Zoom-SDK ließ sich nicht entpacken ({grund}). Die bisherige Einrichtung bleibt unverändert. |
| S17 | Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert. |
| S18 | Bitte den SDK-Schlüssel eintragen, ohne Leerzeichen. |

- **Zuordnung der Fehlerarten zu Texten:**

| Fehlerart | Text |
|---|---|
| `schluessel` | S12 |
| `gedrosselt` | S13 |
| `proxy` | S14 |
| `fehlt` | S15 |
| `unvollstaendig` | S16 |
| `pruefsumme` | S16b |
| `entpacken` | S16c |
| Abbruch | S17 |

- Bei `{grund}` stehen nur Netz-Codes (`ENOTFOUND`, `ETIMEDOUT`, HTTP-Status), nie ein Link.
- S16 deckt einen abgerissenen oder unvollständigen Download ab.
- Platzmangel nutzt das bestehende S5.

## 6. Tests

**Proxy** (`services/release-proxy/test/worker.test.mjs`, GitHub-Attrappe wie bestehend):

- ohne Header, falscher Schlüssel, Secret fehlt → 401;
- richtiger Schlüssel → 200 `{fassung,url,size}`;
- Release fehlt bzw. Asset fehlt → 404;
- GitHub 500 → 502 ohne Fehltext;
- ungültige Fassung → 404;
- Drosselung → 429 mit `Retry-After`;
- die Route verlangt keinen Proxy-Schlüssel;
- die bestehenden `/tools/…`-Routen nutzen weiter `env.REPO` (Regression zu `resolveSignedUrl`).

**Connect `sdk-laden`**, mit lokalem HTTP-Testserver und erfundenem Mini-Paket mit eigenem SHA:

- **Link:** 401, 429 und 404 werden auf die Fehlerarten abgebildet; Netzfehler ergibt `proxy`.
- **Download:**
  - Erfolg mit Fortschritt;
  - Abriss mitten im Strom ergibt `unvollstaendig`, und `.teil` ist weg;
  - falsche Länge;
  - falscher SHA ergibt `pruefsumme`, und `.teil` ist weg;
  - Abbruch;
  - `size` vom Proxy ≠ gepinnt ergibt `fehlt`.
- **Entpacken:** Mit echtem `tar.exe` unter Windows, unter Linux mit dem System-`tar`. Erfolg; kaputtes ZIP ergibt `entpacken`; fehlendes `tar` ergibt `entpacken`.
- **Log:** Kein Test-Schlüssel und kein Link erscheinen in einer Logzeile.

**Kern:**

- `sdkLaden`:
  - Erfolg führt durch die Kopierstrecke in den Zustand `bereit`, ZIP und Ordner sind danach weg.
  - S10 im Meeting.
  - S10, solange `laden` oder `kopie` läuft.
  - Ohne Schlüssel kommt S11.
  - Platzmangel ergibt S5.
  - Jeder Fehler lässt die bisherige Einrichtung unverändert.
  - Abbruch ergibt S17.
  - `beenden` während des Ladens wartet.
- `sdkWaehlen` unverändert (Regressionstest nach der Teilung).
- **SDK-Schlüssel:** Eintragen, Trimmen, S18, Sitzung, Entfernen, kein Wert im Log oder Abbild.

**Paket:** `SDK_PAKET.fassung === SDK_FASSUNG`; `sha256` ist echtes Hex (gegen Platzhalter).

⚑ **Harness-Falle:** Wer nach einem Kern-Aufruf `p.befehle()` liest, wartet vorher mit `await bis(...)` (siehe CI-Fix #242).

## 7. Abnahme (neu in 0.2.2, `apps/connect/ABNAHME-0.2.2.md`)

1. SDK-Schlüssel eintragen. Die Zeile zeigt „hinterlegt“, im Log steht kein Wert.
2. Vorhandene Laufzeit entfernen, also Ordner `zoom-laufzeit\7.1.5.43953` löschen und Connect neu starten. „Zoom-SDK laden“ zeigt dann den Fortschritt, danach die Kopie, danach „bereit“.
3. „Einrichtung prüfen“ meldet PRUEFUNG_OK.
4. Mit falschem Schlüssel kommt S12.
5. „Abbrechen“ während des Downloads ergibt S17; der Ordner `laden\` ist leer und die alte Einrichtung unverändert.
6. Ohne Netz kommt S14.

## 8. Ablauf bis zum Release

1. Diese Spec freigeben, dann folgt der Umsetzungsplan.
2. Owner-Okay für privates Repo und Upload. Danach baue ich das ZIP, lade es hoch, messe nach und pinne SHA und Größen.
3. Owner: Token-Zugriff einstellen und `ZOOM_SDK_KEY` setzen. Ich deploye den Proxy mit Owner-Okay und prüfe die Route einmal mit einem falschen Schlüssel (erwartet 401). Den Test mit dem richtigen Schlüssel macht der Owner in Connect selbst.
4. Umsetzung (Proxy und Connect), Prüfung, Release-Notes zur Freigabe, Release connect-v0.2.2 wie gehabt.
