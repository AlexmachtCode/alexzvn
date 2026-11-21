# Admin-Freigabe gebundener Cloud-Räume — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Admin sieht im Launcher die gebundenen Cloud-Räume von Connect und gibt einen davon frei. CZ8 in Connect nennt die Raum-ID und diesen Weg.

**Architecture:** Der Konten-DO speichert bei einer neuen Bindung `connect:<raumHash>` zusätzlich `raumId`, `kid` und `seit`. Diese Werte liefert der Worker aus `raumInhaber`. `admin-uebersicht` liefert `raeume`, die neue Admin-Aktion `raum-freigeben` löscht eine Bindung. Der Launcher zeigt im Reiter „Geräte“ einen Abschnitt mit Rückfrage. Connect setzt die aufgefüllte Raum-ID in CZ8 ein.

**Tech Stack:** Cloudflare Worker + Durable Object (JS, Tests unter Node mit Attrappen), Electron/React/TypeScript (Launcher, Connect; Tests mit tsx, Form `ck`), Kochbuch-Build.

**Spec:** `docs/superpowers/specs/2026-11-21-connect-raum-admin-freigabe-design.md`. Das ist ein Nachtrag zu Anmeldung Teil 2: Plan `docs/superpowers/plans/2026-11-20-anmeldung-teil2.md`, Entwurf `docs/superpowers/specs/2026-11-20-anmeldung-teil2-design.md`.

## Global Constraints

- **Ort:** Worktree `C:\Users\alexk\alexzvn\.claude\worktrees\anmeldung-teil2`, Branch `feat/anmeldung-teil2`, PR #325. Kein Push, kein Merge, kein Deploy, kein Tag. Andere Worktrees und die Hauptkopie werden nicht angefasst.
- **Versionen:** Launcher bleibt 0.19.0, Connect bleibt 0.5.0. Beide sind noch nicht released. Es wird keine Version erhöht.
- **Texte wörtlich** aus der Tabelle unten (Owner-Freigabe 21.11.). Im Code, in Tests und in der Doku stehen nur typografische Anführungszeichen („ “), nie ASCII-`"` in Texten.

  | Nr. | Ort | Text |
  | --- | --- | --- |
  | CZ8 (neu) | Connect, Fehler 403 `raum-vergeben` | Dieser Cloud-Raum („‹Raum-ID›“) gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort, wähle im Show-Editor eine andere Raum-ID oder bitte einen Admin, ihn im Launcher freizugeben (Admin › Geräte › Cloud-Räume). |
  | RF1 | Launcher, Überschrift | Cloud-Räume (Connect) |
  | RF2 | Launcher, Erklärung | Räume, die gerade einem Konto gehören. Freigeben, wenn jemand Connect beendet hat, ohne „Raum schließen“ zu drücken. |
  | RF3 | Launcher, leere Liste | Kein Cloud-Raum ist gerade gebunden. |
  | RF4 | Launcher, Zeile | ‹Raum-ID› · ‹Name› · ‹Stufe› · gebunden bis ‹Datum› ‹Zeit› |
  | RF5 | Launcher, Zeile ohne Konto | ‹Raum-ID› · unbekanntes Konto · gebunden bis ‹Datum› ‹Zeit› |
  | RF6 | Launcher, Knopf | Freigeben |
  | RF7 | Launcher, Rückfrage | Raum „‹Raum-ID›“ von ‹Name› freigeben? Läuft der Raum dort noch, verliert ‹Name› ihn, sobald jemand anderes ihn öffnet. |
  | RF7a | Launcher, Rückfrage ohne Konto (zur Owner-Freigabe) | Raum „‹Raum-ID›“ eines unbekannten Kontos freigeben? Läuft der Raum dort noch, geht er verloren, sobald jemand anderes ihn öffnet. |
  | RF8 | Launcher, Erfolg | Raum „‹Raum-ID›“ ist frei. |
  | RF9 | Launcher, war schon frei | Der Raum war schon frei. |
  | CL-L4 | Changelog Launcher 0.19.0 | Admins können im Reiter „Geräte“ einen Cloud-Raum von Connect freigeben, der nach einem Absturz oder Beenden ohne „Raum schließen“ noch einem anderen Konto gehört. |

- **Platzhalter:**
  - ‹Raum-ID› ist `raumId`. Fehlt sie, gilt `raumHash.slice(0, 12)`; das kommt nur bei Einträgen ohne `raumId` vor, und der Teil-2-Worker ist noch nie deployt worden.
  - ‹Name› ist `name`, ‹Stufe› ist `STUFE_TEXT[stufe]`.
  - ‹Datum› ‹Zeit› ist `` `${datumText(bis)} ${zeitText(bis)}` ``, wie in `geraeteZeilen`.
- **Format der Raum-ID:** `^[A-Za-z0-9_-]{6,64}$`, wie `ID_RE` in `connect-relay.js`.
- **Keine Geheimnisse:** Freigabe, Sitzung, Schlüssel, Token, `kidHash` und `gidHash` erscheinen nie in der Übersicht, in einer Antwort an den Launcher, im Protokoll oder im Log. `raumId`, `kid`, Name und Stufe sind keine Geheimnisse.
- **Q&A unberührt:** `qa-inhaber` speichert weiterhin nur `{ kidHash, gidHash, bis }`.
- **Commits:**
  - Jeder Commit endet mit genau der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Das gilt auch für Helfer auf einem anderen Modell.
  - Pfade werden einzeln gestaged; danach `git status --short` lesen.
  - Commit-Texte auf Deutsch, Muster `feat(release-proxy): … (Anmeldung Teil 2, Admin-Freigabe)`.
- **Windows-Fallen:**
  - Immer `cd "C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2"` mit großem `C:`.
  - Die Werkzeuge Edit/Write machen aus `\uXXXX` das echte Zeichen. Wo ein Escape im Code stehen soll, `\u{…}` oder `\x..` schreiben.
  - Für einen Backslash in Doku-Text `String.fromCharCode(92)` per Skript verwenden.
- **CI läuft auf Node 22:** Die Worker-Tests laufen mit `node --experimental-strip-types`, nicht über tsx.

## Review Focus

1. **Der Inhaber schließt nach der Freigabe:** A hat den Raum noch offen, der Admin gibt frei, B öffnet und bindet, danach drückt A „Raum schließen“. B muss Inhaber bleiben; A bekommt 403 `raum-vergeben` und nichts wird gelöscht. Abgedeckt durch Task 1, Test „RF A schließt nach Freigabe“.
2. **Konto gelöscht, Bindung lebt:** Die Übersicht liefert `name: null` und `stufe: null`, der Launcher zeigt RF5 und fragt mit RF7a statt „von null“. Abgedeckt durch Task 1, Test „RF Übersicht ohne Konto“, und Task 3, Test „RF Zeilen und Rückfrage ohne Konto“.
3. **Abgelaufene Bindung:** Sie steht nicht in der Liste. `raum-freigeben` darauf antwortet `warFrei: true` und löscht den Eintrag. Abgedeckt durch Task 1, Test „RF abgelaufen“.
4. **Doppelklick oder zwei Admins:** Die zweite Freigabe desselben Raums antwortet `warFrei: true` und schreibt einen eigenen Protokolleintrag. Abgedeckt durch Task 1, Test „RF zweimal“.
5. **Worker ohne `raeume` oder mit kaputtem Feld:**
   - Fehlt `raeume`, zeigt der Launcher den Abschnitt nicht.
   - Ist `raeume` kein Array, lehnt `worker-client` die Übersicht als Serverfehler ab, statt im Renderer abzustürzen.
   - Abgedeckt durch Task 3, Tests „RF Worker ohne raeume“ und „RF raeume kein Array“.

---

### Task 1: Konten-DO — Bindung mit Raum-ID, Übersicht `raeume`, Aktion `raum-freigeben`

**Files:**
- Modify: `services/release-proxy/konto-do.js`. Betroffen sind `connectInhaber` (um :1077), `inhaberSetzen` (um :1093), `adminUebersicht` (um :1144, Rückgabe um :1211), `ADMIN_AKTIONEN` (um :221) und eine neue Methode vor `// ── Ende der Methoden ──`. Dazu kommen der Kopfkommentar von `connectInhaber` und `K.connectInhaber`, die heute „nur Hashes“ sagen.
- Test: `services/release-proxy/test/konto-do.test.mjs`. Neuer Block „RF: Admin-Freigabe gebundener Cloud-Räume“ vor `// ── Ende der Fälle ──`, in der Form der Blöcke T2 und `pruefeFaelle`. Dazu eine Zeile `raum-freigeben` in der Protokolltabelle um :1697.

**Interfaces:**
- **Consumes:** keine.
- **Produces:**
  - **DO-Aktion `connect-inhaber`** mit dem Body `{ jetzt, raumHash, raumId, kidHash?, gidHash?, kid?, bisMs, loesen? }`.
    - `raumId` ist Pflicht und folgt dem Format der Raum-ID.
    - `kid` (String, 1–128 Zeichen) steht genau dann im Body, wenn `kidHash` drinsteht.
    - Sonst gibt es 400 `ungueltig`.
    - Eine neue Bindung speichert `{ kidHash, gidHash, bis, raumId, kid, seit: jetzt }`. Eine Verlängerung behält `raumId`, `kid` und `seit`.
  - **DO-Aktion `admin-uebersicht`** liefert zusätzlich `raeume: Array<{ raumHash: string, raumId: string | null, name: string | null, stufe: Stufe | null, seit: number | null, bis: number }>`.
    - Enthalten sind nur Einträge mit `bis >= jetzt`, sortiert nach `bis` aufsteigend, bei Gleichstand nach `raumId`.
    - `name` ist `konto.name || konto.email`, `stufe` ist `this.stufeVon(konto)`.
    - Gibt es kein Konto zur `kid`, sind beide `null`.
    - Jeder Eintrag hat genau diese sechs Schlüssel.
  - **Admin-Aktion `{ aktion: 'raum-freigeben', raumHash }`** antwortet `{ ok: true, warFrei: boolean }`.
    - Ein `raumHash`, der nicht `^[a-f0-9]{64}$` ist, ergibt 400 `ungueltig`.
    - Ein Nicht-Admin bekommt 403 `kein-recht`; das prüft bereits `adminAktion`.
    - Protokoll: genau ein Eintrag `{ was: 'raum-freigeben', wen: eintrag?.raumId ?? '', details: { raumHash, raumId: eintrag?.raumId ?? null, kid: eintrag?.kid ?? null, warFrei } }`.

- [ ] **Step 1: Tests schreiben**
  - Der Block nutzt `neuerSpeicher`, `legeExternenAn`, `mitAdmin(...).uebersicht` und `rufeDo` wie Block T2.
  - Eine Bindung entsteht mit `ci({ raumHash: HEX('a'), raumId: 'show-1a2b3c', kidHash: HEX('1'), gidHash: HEX('2'), kid: <kid des angelegten Externen> })`.
  - Die Admin-Aktion läuft über den vorhandenen Helfer für `admin-aktion`.
  - Prüfnamen und Erwartungen:
  - `RF Bindung speichert raumId, kid, seit`: Der gespeicherte Eintrag `connect:<HEX('a')>` hat die Schlüssel `kidHash, gidHash, bis, raumId, kid, seit`, und es gilt `seit === T0`. Verlängert dasselbe Konto mit `jetzt = T0 + 2 h`, bleiben `raumId`, `kid` und `seit` gleich.
  - `RF connect-inhaber prüft raumId und kid` (pruefeFaelle):
    - ohne `raumId` → 400
    - `raumId: 'kurz'` → 400
    - `raumId: 'a/b-123456'` → 400
    - `raumId` mit 65 Zeichen → 400
    - `kidHash` ohne `kid` → 400
    - `kid` ohne `kidHash` → 400
    - alter Schlüssel mit gültiger `raumId` auf freiem Raum → 200, nichts gespeichert
  - `RF qa-inhaber unverändert`: Ein neuer Q&A-Inhaber hat genau die Schlüssel `kidHash, gidHash, bis`.
  - `RF Übersicht listet gültige Bindungen`:
    - Zwei Bindungen, `bis` T0+3 h und T0+1 h, werden nach `bis` sortiert.
    - Einträge: `raumId`, `name` (Name des Kontos), `stufe` `'externer'`, `seit`, `bis`.
    - Die Schlüsselmenge jedes Eintrags ist genau `raumHash, raumId, name, stufe, seit, bis`.
    - `JSON.stringify(raeume)` enthält weder `HEX('1')` noch `HEX('2')`.
  - `RF Übersicht ohne Konto`: Eine Bindung mit `kid: 'k-gibts-nicht'` erscheint mit `name === null` und `stufe === null`.
  - `RF abgelaufen`:
    - Eine Bindung mit `bisMs: T0 + 1000` fehlt in der Übersicht bei `jetzt = T0 + 2000`.
    - `raum-freigeben` darauf antwortet `warFrei === true`.
    - Danach ist der Speicherschlüssel weg.
  - `RF freigeben löst nur die Bindung`:
    - `raum-freigeben` auf eine gültige Bindung antwortet `warFrei === false`, und der Schlüssel ist weg.
    - Eine fremde Freigabe (`kidHash: HEX('8'), gidHash: HEX('9')`) bindet danach neu (`neu === true`), und ihr `seit` ist das neue `jetzt`.
  - `RF A schließt nach Freigabe`:
    - Nach der Neubindung durch B schickt A `loesen: true` mit seinen alten Hashes und bekommt 403 `raum-vergeben`.
    - Der Eintrag gehört weiter B, mit `kidHash === HEX('8')`.
  - `RF zweimal`: Zweimal `raum-freigeben` auf denselben Hash ergibt `warFrei` false, dann true. Dazu gibt es genau zwei Protokolleinträge `raum-freigeben`.
  - `RF Protokoll ohne Geheimnis`:
    - Der Eintrag der ersten Freigabe hat `wen === 'show-1a2b3c'` und `details` genau `{ raumHash, raumId, kid, warFrei }`.
    - `JSON.stringify` des Eintrags enthält weder `HEX('1')` noch `HEX('2')`.
  - `RF ungültiger Hash`: `raumHash: 'xyz'` ergibt 400 `ungueltig`. Ein Kollege oder Externer bekommt 403 `kein-recht`.

- [ ] **Step 2: Rot sehen**

  Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2" && node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs`
  Expected: Die neuen RF-Prüfungen schlagen fehl. Bestehende Prüfungen, die `connect-inhaber` ohne `raumId` rufen (Block T2), schlagen ebenfalls fehl. Sie bekommen in Step 3 eine `raumId`, und bei Bindungen mit `kidHash` zusätzlich eine `kid`.

- [ ] **Step 3: Implementieren**
  - `connectInhaber(b, jetzt)` prüft `raumId` und `kid`. Danach ruft es `inhaberSetzen(key, b, jetzt, 'raum-vergeben', b.loesen === true, { raumId: b.raumId, kid: b.kid ?? null })` auf.
  - `inhaberSetzen(key, b, jetzt, code, loesen = false, zusatz = null)` legt `zusatz` und `seit: jetzt` nur bei einer neuen Bindung dazu.
  - In `adminUebersicht` kommt der `connect:`-Präfix aus `st.list` dazu. Die Übersicht schreibt nichts, auch abgelaufene Einträge nicht: das Löschen macht der Alarm.
  - Neue Methode `raumFreigeben(a, wer, jetzt)` in `ADMIN_AKTIONEN`. Zwischen Lesen und Löschen gibt es kein `await` auf etwas anderes als den Speicher.
  - Die Kommentare, die „nur Hashes, nie die ID selbst“ sagen, werden für Connect berichtigt.
  - Der Block T2 bekommt `raumId` und `kid`, wo Step 2 das verlangt. Seine Prüfnamen bleiben.

- [ ] **Step 4: Grün sehen**

  Run: wie Step 2, danach zur Kontrolle `node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs`
  Expected: `0 fehlgeschlagen` bzw. die übliche Abschlusszeile ohne FAIL, in beiden Dateien.

- [ ] **Step 5: Commit** — `services/release-proxy/konto-do.js`, `services/release-proxy/test/konto-do.test.mjs`.

### Task 2: Worker — `raumInhaber` liefert Raum-ID und Konto, README

**Files:**
- Modify: `services/release-proxy/connect-relay.js`. Betroffen sind `raumInhaber` (um :160) und sein Kopfkommentar (um :155).
- Modify: `services/release-proxy/README.md`. Gemeint sind die Admin-Aktionen und der Abschnitt Connect-Bindung (um :219).
- Test: `services/release-proxy/test/connect-zugang.test.mjs` und `services/release-proxy/test/konto-routen.test.mjs`.

**Interfaces:**
- **Consumes:** die DO-Aktion `connect-inhaber` mit `raumId` und `kid`, die Admin-Aktion `raum-freigeben` und `raeume` aus Task 1.
- **Produces:** `POST /konto/admin/aktion` mit `{ aktion: 'raum-freigeben', raumHash }` antwortet dem Launcher unverändert `{ ok: true, warFrei }`. `GET /konto/admin/uebersicht` enthält `raeume`.

- [ ] **Step 1: Tests schreiben**
  - In `connect-zugang.test.mjs`:
    - `RF Worker: Öffnen mit Freigabe bindet mit raumId und kid`: Raum `show-1a2b3c` öffnen mit einer Testfreigabe Zweck `connect-raum`, Ziel `show-1a2b3c`. Der Eintrag `connect:<sha256Hex('connect-raum|show-1a2b3c')>` im Konten-DO hat `raumId === 'show-1a2b3c'` und `kid` gleich der kid der Freigabe.
    - `RF Worker: alter Schlüssel bindet weiter nie`: Ein freier Raum wird mit dem alten Schlüssel geöffnet. Danach gibt es keinen Eintrag.
    - `RF Worker: Schließen löst weiter`: Nach dem Schließen mit derselben Freigabe gibt es keinen Eintrag.
  - In `konto-routen.test.mjs`, nach dem Muster der Admin-Aktionen um :476:
    - `RF Route: raum-freigeben`: Ein Admin bekommt 200 `{ ok: true, warFrei: true }` für einen freien Hash.
    - Ein Kollege bekommt 403 `kein-recht`.
    - `raumHash: 'xyz'` ergibt 400 `ungueltig`.
    - `GET /konto/admin/uebersicht` hat `Array.isArray(raeume)`.

- [ ] **Step 2: Rot sehen**

  Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2" && node --experimental-strip-types services/release-proxy/test/connect-zugang.test.mjs && node --experimental-strip-types services/release-proxy/test/konto-routen.test.mjs`
  Expected: Die RF-Prüfungen in connect-zugang schlagen fehl. Seit Task 1 verlangt der DO `raumId`, darum scheitert vermutlich auch das Öffnen mit Freigabe (503). Die Routen-Prüfungen können schon grün sein; das ist erlaubt und gehört in den Bericht.

- [ ] **Step 3: Implementieren**
  - `raumInhaber` schickt `raumId: id` immer mit und `kid` zusammen mit `kidHash`.
  - Der Kopfkommentar sagt neu: Der DO speichert Raum-ID und Konto im Klartext für die Admin-Freigabe; Raum-IDs sind Show-Namen und keine Geheimnisse. Die Hash-Schlüssel und die Vergleichsregel bleiben.
  - README: Die Admin-Aktion `raum-freigeben` `{ raumHash }` → `{ ok, warFrei }` kommt dazu, außerdem `raeume` in der Übersicht und die gespeicherten Felder der Bindung.

- [ ] **Step 4: Grün sehen**

  Run: Step 2 und zusätzlich `node --experimental-strip-types services/release-proxy/test/konto-do.test.mjs`, `qa-relay.test.mjs`, `konto-zugang.test.mjs`, `zoom-jwt.test.mjs`, `connect-do.test.mjs` und `worker.test.mjs` (je mit Pfad `services/release-proxy/test/`).
  Expected: In allen sieben Dateien steht kein FAIL, und jede endet mit ihrer Abschlusszeile.

- [ ] **Step 5: Commit** — `services/release-proxy/connect-relay.js`, `services/release-proxy/README.md`, `services/release-proxy/test/connect-zugang.test.mjs`, `services/release-proxy/test/konto-routen.test.mjs`.

### Task 3: Launcher 0.19.0 — Abschnitt „Cloud-Räume (Connect)“ mit Rückfrage

**Files:**
- Modify: `apps/launcher/src/shared/konto.ts`
  - neuer Typ `AdminRaum`;
  - `AdminUebersicht.raeume?: AdminRaum[]`;
  - `AdminAktion` bekommt `| { aktion: 'raum-freigeben'; raumHash: string }`;
  - `AdminAktionErgebnis` bekommt `warFrei?: boolean`.
- Modify: `apps/launcher/src/main/konto/huelle.ts` (um :540): `ADMIN_AKTIONEN` bekommt `'raum-freigeben'`.
- Modify: `apps/launcher/src/main/konto/worker-client.ts` (um :241). `adminUebersicht` nimmt die Antwort nur an, wenn `d.raeume === undefined || Array.isArray(d.raeume)`.
- Modify: `apps/launcher/src/renderer/src/lib/admin-ansicht.ts`: Texte in `REITER_TEXTE` und die reinen Funktionen unten.
- Modify: `apps/launcher/src/renderer/src/components/AdminGeraete.tsx`. Der neue Abschnitt steht zwischen der Rechner-Tabelle und „Alte Launcher“.
- Test: `apps/launcher/test/konto-admin.test.ts`, `apps/launcher/test/konto-client.test.ts`, `apps/launcher/test/konto-huelle.test.ts` (Quelltextprüfung wie um :400), `apps/launcher/test/selftest.ts` (Quelltextprüfung wie um :3521).

**Interfaces:**
- **Consumes:** `raeume` und `raum-freigeben` aus Task 1/2.
- **Produces:**
  - `interface AdminRaum { raumHash: string; raumId: string | null; name: string | null; stufe: Stufe | null; seit: number | null; bis: number }`
  - `raumZeilen(u: AdminUebersicht): Array<{ raumHash: string; anzeige: string; text: string; frage: string }> | null`
    - `null`, wenn `u.raeume` fehlt;
    - sonst sortiert nach `bis` aufsteigend;
    - `anzeige` = ‹Raum-ID› nach Global Constraints;
    - `text` = RF4 bzw. RF5;
    - `frage` = RF7 bzw. RF7a.
  - `raumFreigabeMeldung(anzeige: string, e: AdminAktionErgebnis): string`: RF9, wenn `e.warFrei === true`, sonst RF8.
  - Neue Schlüssel in `REITER_TEXTE`:
    - `raeumeTitel` (RF1), `raeumeErklaerung` (RF2), `keineRaeume` (RF3);
    - `raumZeile(id, name, stufe, datum, zeit)` (RF4), `raumZeileOhneKonto(id, datum, zeit)` (RF5);
    - `raumFreigeben` (RF6), `frageRaum(id, name)` (RF7), `frageRaumOhneKonto(id)` (RF7a);
    - `raumFrei(id)` (RF8), `raumWarFrei` (RF9).
    - Kein neuer Schlüssel heißt `connect`; das ist die Prüfung M47.

- [ ] **Step 1: Tests schreiben**
  - In `konto-admin.test.ts`, mit `uebersicht([])` erweitert um `raeume`:
    - `RF Texte wörtlich`: Jeder neue Text wird mit Beispielwerten gegen die Tabelle der Global Constraints verglichen, etwa `REITER_TEXTE.frageRaum('show-1a2b3c', 'Tom')`. Dazu kommt die Prüfung, dass kein Text ein ASCII-`"` enthält.
    - `RF Zeilen` (kreuz):
      - Zwei Räume in falscher Reihenfolge werden nach `bis` sortiert.
      - `text` ist `show-1a2b3c · Tom · Externer · gebunden bis ${datumText(b)} ${zeitText(b)}`.
      - `frage` ist RF7 mit Tom.
    - `RF Zeilen und Rückfrage ohne Konto`: Mit `name: null, stufe: null` ist `text` RF5 und `frage` RF7a. Weder in `text` noch in `frage` steht `null`.
    - `RF Raum ohne raumId`: `anzeige === raumHash.slice(0, 12)`.
    - `RF Worker ohne raeume`: `raumZeilen(uebersicht ohne raeume) === null`. `raumZeilen` mit `raeume: []` ergibt `[]`.
    - `RF Meldung`: `raumFreigabeMeldung('show-1a2b3c', { ok: true, warFrei: false })` ist RF8, `{ ok: true, warFrei: true }` ergibt RF9.
    - `RF Fehlertext`: `fehlerText('ungueltig', 'raum-freigeben') === ADMIN_TEXTE.ungueltig`.
  - In `konto-client.test.ts`:
    - `RF raeume kein Array`: Eine Übersicht mit `raeume: {}` wirft den Fehler, den `form` für unbrauchbare Antworten wirft, wie in den bestehenden Fällen um :289.
    - Eine Übersicht ohne `raeume` wird angenommen.
  - In `konto-huelle.test.ts`: `RF huelle: raum-freigeben in ADMIN_AKTIONEN` (Quelltext enthält `'raum-freigeben'` in der Liste).
  - In `selftest.ts`, Quelltext von `AdminGeraete.tsx`:
    - `raumZeilen(daten)` wird genutzt.
    - `aktion: 'raum-freigeben'` kommt genau einmal vor, und zwar im Bestätigen-Knopf der Rückfrage.
    - Der Knopf RF6 einer Zeile setzt nur den Zustand der Rückfrage.

- [ ] **Step 2: Rot sehen**

  Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2" && npm run selftest:konto -w apps/launcher`
  Expected: FAIL, weil die RF-Prüfungen und die Importe `raumZeilen` und `raumFreigabeMeldung` fehlen.

- [ ] **Step 3: Implementieren**
  - Typen, Liste, Prüfung im Client und reine Funktionen wie unter Interfaces.
  - `AdminGeraete.tsx` bekommt den Abschnitt:
    - Überschrift RF1 im Stil von „Alte Launcher“, dann RF2.
    - Je Zeile `text` und ein Knopf RF6 (`size="sm" variant="outline"`), mit RF3 bei leerer Liste. Ist `raumZeilen` null, fehlt der ganze Abschnitt.
  - Rückfrage: Ein Klick zeigt die Rückfrage im Muster von `AdminZugaenge.tsx` um :235.
    - Sie zeigt den Text `frage` und die Knöpfe `ADMIN_TEXTE.abbrechen` und RF6 (`variant="destructive"`, gesperrt während `busy`).
    - Erst der Bestätigen-Knopf ruft `aktion({ aktion: 'raum-freigeben', raumHash })`.
    - Bei Erfolg erscheint `raumFreigabeMeldung(anzeige, r.ergebnis)` mit `role="status"`.
    - Bei Fehler erscheint `fehlerText(r.code, 'raum-freigeben')` in der vorhandenen Meldung mit `role="alert"`.
    - Die neue Übersicht übernimmt der Store wie bei jeder Aktion (EP15).

- [ ] **Step 4: Grün sehen**

  Run: `npm run selftest:konto -w apps/launcher && npm run selftest -w apps/launcher && npm run typecheck -w apps/launcher`
  Expected: Kein FAIL und 0 Typfehler.

- [ ] **Step 5: Commit** — die neun Dateien oben (fünf Quelldateien, vier Testdateien).

### Task 4: Connect 0.5.0 — CZ8 mit Raum-ID, Handbuch Pannenhilfe

**Files:**
- Modify: `apps/connect/src/main/zugang/regeln.ts` (um :204): `raumVergeben` wird `(raumId: string): string`.
- Modify: `apps/connect/src/main/room.ts` (um :82): `ZUGANG_TEXT.raumVergeben(id)` mit der aufgefüllten `id` aus :66.
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-connect.md`.
  - **Zeile um :284 (Pannenhilfe):** Die linke Zelle bekommt CZ8 (neu) mit dem Platzhalter „‹Raum-ID›“. Die rechte Zelle wird: `Die Raum-ID ist schon an ein anderes Konto oder einen anderen Rechner vergeben, etwa weil dort Connect ohne „Raum schließen“ beendet wurde. Den Raum dort schließen, im Show-Editor eine andere Raum-ID wählen oder einen Admin bitten, ihn im Launcher unter Admin › Geräte › Cloud-Räume freizugeben.`
  - **Satz um :219:** Hinter „bis „Raum schließen““ kommt „oder bis ein Admin ihn im Launcher freigibt“.
- Regenerate: `packages/cookbook/cookbook.json` per `npm run cookbook:build`.
- Test: `apps/connect/test/zugang-regeln.test.ts` (um :223 und :244) und `apps/connect/test/raum-zugang.test.ts` (um :148).

**Interfaces:**
- **Consumes:** keine. `raumId(roh)` aus `apps/connect/src/main/raum-id.ts` gibt es schon.
- **Produces:** `ZUGANG_TEXT.raumVergeben(raumId: string): string`.

- [ ] **Step 1: Tests ändern**
  - `zugang-regeln.test.ts` :244: Die Prüfung vergleicht `ZUGANG_TEXT.raumVergeben('show-1a2b3c') === 'Dieser Cloud-Raum („show-1a2b3c“) gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort, wähle im Show-Editor eine andere Raum-ID oder bitte einen Admin, ihn im Launcher freizugeben (Admin › Geräte › Cloud-Räume).'`. Der Prüfname bleibt.
  - `zugang-regeln.test.ts` :223: In `alleTexte` wird `t.raumVergeben('show-1a2b3c')` aufgerufen.
  - `raum-zugang.test.ts` :148: Erwartet wird `vergeben === ZUGANG_TEXT.raumVergeben(raumId('show'))`, und `vergeben` enthält `raumId('show')`. Der Prüfname bleibt, mit dem Zusatz „mit aufgefüllter Raum-ID“.

- [ ] **Step 2: Rot sehen**

  Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2/apps/connect" && npx tsx test/zugang-regeln.test.ts; npx tsx test/raum-zugang.test.ts`
  Expected: FAIL, weil `raumVergeben` noch ein String ist.

- [ ] **Step 3: Implementieren** (regeln.ts, room.ts, Handbuch), danach `npm run cookbook:build`.

- [ ] **Step 4: Grün sehen**

  Run: `npm run selftest -w apps/connect && npm run typecheck -w apps/connect && npm run cookbook:check`. Danach prüfen, dass `packages/cookbook/cookbook.json` kein `\r` enthält: `node -e "process.exit(require('fs').readFileSync('packages/cookbook/cookbook.json','utf8').includes('\r')?1:0)"`.
  Expected: 0 fehlgeschlagen, 0 Typfehler, das Kochbuch ist aktuell, Exit 0.

- [ ] **Step 5: Commit** — `regeln.ts`, `room.ts`, die zwei Tests, `tool-jm-connect.md`, `cookbook.json`.

### Task 5: Doku, Texttabelle, Changelog, Abnahme

**Files:**
- Modify: `docs/anmeldung-teil2-texte.md`
  - **T4, Zeile CZ8:** Der Text wird CZ8 (neu), der Hinweis „geändert 21.11., siehe Nachtrag“.
  - **„## Handbuch“:** In der Stelle Pannenhilfe ersetzt die neue Fassung die „+“-Zeile der CZ8-Zeile. Bei der Stelle mit dem Satz um :219 kommt die neue Fassung dazu, falls er dort steht. Davor steht je ein Klartext-Satz „Nachtrag 21.11.: …“.
  - **Neuer Abschnitt** `## Nachtrag 21.11. Admin-Freigabe` vor `## Entfällt`: Dateien-Zeile, dann eine Tabelle `| Nr. | Ort | Text |` mit CZ8 (neu), RF1–RF9, RF7a und CL-L4 aus den Global Constraints.
  - **Freigabezeile am Ende:** `Freigabe: ☒ alle Texte wie hier (Owner 21.11.2026: T1–T5 und Handbuch „texte passen“, Nachtrag „passt“)`. RF7a wird erst angekreuzt, wenn der Owner es freigegeben hat; bis dahin trägt RF7a in seiner Ort-Spalte „zur Owner-Freigabe“.
- Modify: `packages/suite-manifest/changelog.json`: Bei `launcher` `0.19.0` kommt CL-L4 als vierte Notiz ans Ende von `notes`. Das Datum bleibt der Platzhalter.
- Modify: `docs/anmeldung.md`, Abschnitt 14. Neuer Unterabschnitt „Admin-Freigabe gebundener Cloud-Räume (Nachtrag 21.11.)“ mit:
  - den gespeicherten Feldern der Bindung;
  - der aufgehobenen Festlegung „nur Hashes“;
  - `raeume`, `raum-freigeben` mit Antwort und Protokoll;
  - Launcher-Abschnitt, Rückfrage, CZ8.
  - Der Satz „nichts deployt“ bleibt stehen.
- Modify: `packages/cookbook/content/tool-manuals/launcher-anmeldung.md` (um :49). Nach dem Admin-Satz: `Im Reiter „Geräte“ stehen unter „Cloud-Räume (Connect)“ die Cloud-Räume, die gerade einem Konto gehören. Hat jemand Connect beendet, ohne „Raum schließen“ zu drücken, gibt ein Admin den Raum dort mit „Freigeben“ frei; danach kann ihn ein anderes Konto öffnen.` Danach `npm run cookbook:build`.
- Modify: `apps/connect/ABNAHME-0.5.0.md`, Zeile 7. Die Erwartung zu B wird CZ8 (neu) mit der Raum-ID des Schritts. Dazu kommen fünf Schritte als eigene Zeile „7b“:
  1. A öffnet den Raum.
  2. A beendet Connect, ohne „Raum schließen“ zu drücken.
  3. B bekommt CZ8 mit der Raum-ID.
  4. Ein Admin sieht unter Admin › Geräte › Cloud-Räume die Zeile RF4 mit A und gibt den Raum über RF7 und RF8 frei.
  5. B öffnet den Raum, und es klappt.
- Test: Die Textprüfung `.superpowers/sdd/2026-11-21-connect-raum-admin-freigabe/pruefe-texte.mjs`.
  - Der Controller legt sie vor dem Task an. Es ist die Prüfung aus Teil 2, erweitert um den Abschnitt „Nachtrag“: CZ → `regeln.ts`, RF → `admin-ansicht.ts`, CL-L4 → Changelog, Launcher 0.19.0 mit vier Notizen und die neue Freigabezeile.
  - Dazu kommen `npm run cookbook:check` und die JSON-Prüfung des Changelogs.

**Interfaces:**
- **Consumes:** die Texte und Namen aus Task 1–4.
- **Produces:** keine.

- [ ] **Step 1: Textprüfung laufen lassen und Rot sehen**

  Run: `cd "C:/Users/alexk/alexzvn/.claude/worktrees/anmeldung-teil2" && node .superpowers/sdd/2026-11-21-connect-raum-admin-freigabe/pruefe-texte.mjs`
  Expected: Fehler für den fehlenden Abschnitt Nachtrag, für CZ8 (der alte Text in T4 fehlt im Code), für CL-L4 und für die Freigabezeile.

- [ ] **Step 2: Doku, Tabelle, Changelog, Handbuch und Abnahme schreiben.** Danach `npm run cookbook:build`.

- [ ] **Step 3: Grün sehen**

  Run: die Textprüfung aus Step 1, dann `npm run cookbook:check` und `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`. Danach die `\r`-Prüfung von `cookbook.json` wie in Task 4.
  Expected: `ok`; das Kochbuch ist aktuell; die JSON-Prüfung endet mit Exit 0, und es gibt kein `\r`.

- [ ] **Step 4: Commit** — `docs/anmeldung-teil2-texte.md`, `packages/suite-manifest/changelog.json`, `docs/anmeldung.md`, `launcher-anmeldung.md`, `cookbook.json`, `apps/connect/ABNAHME-0.5.0.md`.
