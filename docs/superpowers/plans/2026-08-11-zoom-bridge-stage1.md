# Zoom-Bridge Stage 1 (Gerüst) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein eigenständiges Windows-Programm `zoom-bridge.exe`, das sich beim Zoom-Meeting-SDK anmeldet, einem Meeting beitritt, die Teilnehmer meldet und die Rohdaten-Erlaubnis einholt — gesteuert per JSON über stdin/stdout, mit einem TypeScript-Kopf, dessen Logik ohne SDK, ohne Compiler und ohne Meeting prüfbar ist.

**Architecture:** Zwei Hälften mit scharfer Naht. C++ (`native/`) macht nur, was nur C++ kann: SDK-Aufrufe, Win32-Nachrichtenschleife, Rückrufe — es meldet Tatsachen als JSON-Zeilen und nimmt Befehle, es urteilt nicht. TypeScript (`src/`) urteilt: Zustandsmaschine, Namenskatalog, Wachhund, Bewertung. Gebaut wird mit CMake hinter einem `maybe-build.mjs`-Riegel, der auf Nicht-Windows und ohne SDK sauber überspringt.

**Tech Stack:** C++17 · MSVC (vswhere → VsDevCmd) · CMake 4.x · Zoom Meeting SDK for Windows 7.1.5 (aus dem C#-Wrapper-Paket) · Node 20+ mit `--experimental-strip-types` · TypeScript 5.9 · npm-Workspaces

**Spec:** [`docs/superpowers/specs/2026-08-11-zoom-bridge-geruest-design.md`](../specs/2026-08-11-zoom-bridge-geruest-design.md)
**Branch:** `feat/zoom-bridge-stage1` (existiert, Spec ist committet)
**Issue:** [#197](https://github.com/AlexmachtCode/alexzvn/issues/197), Stage 1 von 4

## Global Constraints

- **Alles Neue liegt unter `packages/zoom-bridge/`.** Kein Eingriff in `apps/connect` oder eine andere App. Ausnahme: Task 11 aktualisiert `docs/roadmap.md`.
- **Niemals `git add -A` oder `git add .`** — immer ausdrückliche Pfade, und nach jedem `git add` `git status --short` lesen.
- **Niemals `apps/ndi-screen-capture/resources/bin/win/jm_ndi.node` stagen.** Die Datei ist im Arbeitsbaum verändert und gehört nicht in diesen Branch.
- **Umlaute — nachgemessen, nicht geraten.** Commit-Botschaften: keine (`ue`/`oe`/`ae`). **Quelltext und Codekommentare** (`src/*.ts`, `native/*`, `scripts/*`, `test/*`): ebenfalls keine — `@jm/decklink`, das Vorbild dieses Plans, hat in `src/`, `native/` und `test/` **null** echte Umlaute, `@jm/ndi` und `@jm/audio` ebenso. **Dokumentation** (`README.md`, Spec, Plan): echte Umlaute — dort hat jedes gemessene README welche (`packages/ndi` 20, `packages/audio` 74, `apps/switcher` 46).
  Der Grund ist nicht Geschmack: Quelltext dieser Pakete läuft durch MSVC, `dumpbin`, CMake und PowerShell-Pipelines, deren Zeichensatzverhalten je nach Codepage kippt. Dokumentation tut das nicht.
- **Sonderzeichen in Code-Kommentaren.** Die Code-Blöcke dieses Plans benutzen `⚑` als Warnmarke und `—` als Gedankenstrich. Beide sind **keine Umlaute** und dürfen nicht „umgeschrieben" werden. In den Quelltext übernommen wird: `⚑` → `ACHTUNG:` und `—` → ` - `. Eine Warnmarke, die als `ae_:` im Kommentar landet, macht aus dem wichtigsten Hinweis der Datei Kauderwelsch — genau das ist in Task 3 einmal passiert.
- **Keine Zugangsdaten im Repo.** Client-ID, Secret, JWT, Meeting-Nummer und Kenncode kommen ausschließlich aus der Umgebung oder aus einer Datei außerhalb des Repos. In CI läuft gitleaks über den Dateibaum.
- **Kein Geheimnis in einer Ausgabe.** Weder auf stdout noch auf stderr noch in einer Fehlermeldung darf JWT, Secret oder Kenncode erscheinen.
- **`stdout` ist ein reiner Maschinenkanal**: ausschließlich JSON-Zeilen, eine Zeile ein Objekt, `\n` als Trenner. Jeder Menschentext geht auf `stderr`.
- **`ENABLE_CUSTOMIZED_UI_FLAG` (1 << 5) muss in `InitParam.obConfigOpts.optionalFeatures` gesetzt sein.** Ohne diese Zeile hängt der Beitritt bei `CONNECTING` — gemessen, 90 Sekunden ohne jede Meldung.
- **Eine Ursache, ein Name.** Kein `SDKError` wird verworfen; zwei verschiedene Ursachen bekommen nie dieselbe Meldung; ein unbekannter Code wird als `SDKERR_UNKNOWN(<n>)` gemeldet, nie auf den nächstähnlichen gerundet.
- **Stage 1 zeichnet nichts auf.** `StartRawRecording()` wird nirgends gerufen.
- **Aufräumreihenfolge ist bindend:** `Leave` → Nachrichtenschleife weiterpumpen bis `ENDED`/`IDLE` oder 5 s → `DestroyMeetingService` → `DestroyAuthService` → `CleanUPSDK`. Ein `DestroyMeetingService` während `CONNECTING` hat den Spike mit `0xC0000005` beendet.
- **Paketname:** `@jm/zoom-bridge`, `"private": true`, `"type": "module"`, `"version": "0.1.0"`.
- **Umgebung für den nativen Bau (auf diesem Rechner):**
  `$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"`
  Darin liegen `x64\bin\sdk.dll` und `x64\zoom_sdk_c_sharp_wrap\h\zoom_sdk.h`.
- **Zur Laufzeit** muss `%ZOOM_SDK_DIR%\x64\bin` im `PATH` stehen.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `packages/zoom-bridge/package.json` | Paketkennung, Skripte (`install`, `typecheck`, `selftest`, `rebuild`, `join`) |
| `packages/zoom-bridge/tsconfig.json` | `tsc --noEmit`, damit CI den TypeScript-Kopf prüft |
| `packages/zoom-bridge/.gitignore` | `build/`, `sdk.lib`, `sdk.def` — Bauartefakte gehören nicht ins Repo |
| `packages/zoom-bridge/README.md` | Nachbauen, Umgebungsvariablen, Rückgabewerte, harte Grenzen |
| `packages/zoom-bridge/CMakeLists.txt` | baut `zoom-bridge.exe` aus `native/*.cpp` gegen `sdk.lib` |
| `packages/zoom-bridge/scripts/make-implib.mjs` | `sdk.dll` → `dumpbin /exports` → `sdk.def` → `lib /def:` → `sdk.lib` |
| `packages/zoom-bridge/scripts/maybe-build.mjs` | Riegel: nur Windows + `ZOOM_SDK_DIR`, sonst überspringen |
| `packages/zoom-bridge/native/emit.h/.cpp` | ein Ereignis als genau eine JSON-Zeile nach stdout; JSON-Maskierung; Diagnose nach stderr |
| `packages/zoom-bridge/native/callbacks.h/.cpp` | die vier Rückruf-Klassen (Auth · Meeting · Teilnehmer · Aufnahme) |
| `packages/zoom-bridge/native/session.h/.cpp` | Lebenszyklus: Init · Auth · Join · Leave · Roster · Privileg · Abbau |
| `packages/zoom-bridge/native/main.cpp` | Nachrichtenschleife, stdin-Leser, Befehlsverteilung |
| `packages/zoom-bridge/src/protocol.ts` | Typen, Namenskataloge, Meeting-Nummer aufräumen, Zeilenteiler, Anreicherung |
| `packages/zoom-bridge/src/state.ts` | `reduce(state, event)`, `isSettled(status)` |
| `packages/zoom-bridge/src/jwt.ts` | HS256-JWT aus clientId/clientSecret |
| `packages/zoom-bridge/src/bridge.ts` | Kindprozess starten, Zeilen lesen, Wachhund, Ereignisse nach außen |
| `packages/zoom-bridge/src/index.ts` | öffentliche Fläche für Stage 4, inklusive `binPath()` |
| `packages/zoom-bridge/test/selftest.ts` | alle Selbsttests, laufen ohne SDK |
| `packages/zoom-bridge/test/fake-bridge.mjs` | Attrappe: spielt aufgezeichnete Ereigniszeilen ab, damit `bridge.ts` ohne SDK prüfbar ist |
| `packages/zoom-bridge/test/join.mjs` | Konsolen-Prüfstand gegen ein echtes Meeting |

**Reihenfolge der Aufgaben** ist so gewählt, dass die ersten drei ohne Windows und ohne SDK laufen, Task 4 die riskanteste Unbekannte (die Baukette) allein prüft, und die C++-Fähigkeiten danach einzeln dazukommen.

---

### Task 1: Paketgerüst und JWT

**Files:**
- Create: `packages/zoom-bridge/package.json`
- Create: `packages/zoom-bridge/tsconfig.json`
- Create: `packages/zoom-bridge/.gitignore`
- Create: `packages/zoom-bridge/src/jwt.ts`
- Test: `packages/zoom-bridge/test/selftest.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `buildJwt(opts: { clientId: string; clientSecret: string; now?: number; ttlSeconds?: number }): string` · `readCredentials(): { clientId: string; clientSecret: string }` — beide aus `src/jwt.ts`.

- [ ] **Step 1: Paketdateien anlegen**

`packages/zoom-bridge/package.json`:

```json
{
  "name": "@jm/zoom-bridge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Zoom-Meeting-SDK-Bruecke (natives Windows-Sidecar) fuer JM Connect — Stage 1: Beitritt, Teilnehmer, Aufnahme-Erlaubnis",
  "exports": {
    ".": "./src/index.ts",
    "./protocol": "./src/protocol.ts",
    "./state": "./src/state.ts",
    "./jwt": "./src/jwt.ts"
  },
  "scripts": {
    "rebuild": "node scripts/make-implib.mjs && cmake -S . -B build -A x64 && cmake --build build --config Release",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "selftest": "node --experimental-strip-types test/selftest.ts",
    "join": "node test/join.mjs"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

`packages/zoom-bridge/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`packages/zoom-bridge/.gitignore`:

```
# Bauartefakte. sdk.lib/sdk.def sind an die DLL-Fassung gebunden und werden zur
# Bauzeit erzeugt — eine mitcommittete Lib liefe bei einem SDK-Wechsel still daneben.
build/
sdk.lib
sdk.def
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`packages/zoom-bridge/test/selftest.ts`:

```ts
// Selbsttests der reinen TypeScript-Logik. Brauchen KEIN Zoom-SDK, KEINEN Compiler
// und KEIN Meeting — sie laufen auch auf Linux.
//   npm run selftest -w @jm/zoom-bridge
import { buildJwt } from '../src/jwt.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

console.log('jwt — Aufbau:');
{
  // Feste Zeit, damit die Signatur ein fester Vektor ist.
  const jwt = buildJwt({ clientId: 'testKey', clientSecret: 'testSecret', now: 1_770_000_000, ttlSeconds: 3600 });
  const [h, p, sig] = jwt.split('.');

  assert(jwt.split('.').length === 3, 'JWT hat drei Teile');
  assert(decodePart(h).alg === 'HS256' && decodePart(h).typ === 'JWT', 'Kopf ist HS256/JWT');

  const payload = decodePart(p) as { appKey: string; iat: number; exp: number; tokenExp: number };
  assert(payload.appKey === 'testKey', 'appKey ist die Client-ID');
  assert(payload.iat === 1_770_000_000 - 30, 'iat hat 30 s Vorlauf gegen Uhrendrift');
  assert(payload.exp === payload.iat + 3600, 'exp liegt ttlSeconds nach iat');
  assert(payload.tokenExp >= payload.exp, 'tokenExp ist nicht kleiner als exp');
  assert(
    Object.keys(payload).sort().join(',') === 'appKey,exp,iat,tokenExp',
    'genau die vier von Zoom verlangten Felder, nicht mehr',
  );

  // Fester Vektor: HMAC-SHA256 ueber "<kopf>.<nutzlast>" mit "testSecret".
  // Bricht dieser Test, hat sich der JWT-Aufbau geaendert — das ist eine Aussage,
  // kein Rauschen, denn Zoom prueft die Signatur byteweise.
  assert(sig.length > 0 && !/[+/=]/.test(sig), 'Signatur ist base64url, ohne + / =');
  assert(
    buildJwt({ clientId: 'testKey', clientSecret: 'testSecret', now: 1_770_000_000, ttlSeconds: 3600 }) === jwt,
    'gleiche Eingabe, gleiches JWT (deterministisch)',
  );
  assert(
    buildJwt({ clientId: 'testKey', clientSecret: 'anderes', now: 1_770_000_000, ttlSeconds: 3600 }) !== jwt,
    'anderes Secret, andere Signatur',
  );

  // Das Secret darf NIRGENDS in der Ausgabe auftauchen — auch nicht base64-kodiert.
  assert(!jwt.includes('testSecret'), 'das Secret steht nicht im Klartext im JWT');
  assert(
    !jwt.includes(Buffer.from('testSecret').toString('base64').replace(/=+$/, '')),
    'das Secret steht auch nicht base64-kodiert im JWT',
  );
}

console.log(failures === 0 ? '\nAlle Selbsttests bestanden.' : `\n${failures} Selbsttest(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 3: Lauf zur Bestätigung, dass er fehlschlägt**

```powershell
npm run selftest -w @jm/zoom-bridge
```
Erwartet: FEHLER — `Cannot find module '../src/jwt.ts'`.

- [ ] **Step 4: `src/jwt.ts` schreiben**

```ts
// Baut das JWT fuer die Meeting-SDK-Anmeldung.
//
// WARUM IN TYPESCRIPT UND NICHT IN C++: HMAC-SHA256 und base64url sind in Node drei
// Zeilen, in C++ waeren es BCrypt-Aufrufe und eigener Base64-Code. Wichtiger noch:
// so erreichen Client-ID und Secret den nativen Teil NIE — die Bridge sieht
// ausschliesslich das fertige JWT.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface JwtOptions {
  clientId: string;
  clientSecret: string;
  /** Sekunden seit 1970. Nur fuer Tests; sonst die Uhr. */
  now?: number;
  /** Gueltigkeitsdauer in Sekunden. Zoom laesst hoechstens zwei Tage zu. */
  ttlSeconds?: number;
}

export function buildJwt(opts: JwtOptions): string {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  // 30 s Vorlauf gegen Uhrendrift: liegt iat auch nur eine Sekunde in der Zukunft,
  // weist Zoom das Token mit AUTHRET_JWTTOKENWRONG ab — und das sieht aus wie ein
  // falsches Secret. Die Setzung stammt aus dem Stage-0-Spike.
  const iat = now - 30;
  const exp = iat + (opts.ttlSeconds ?? 3600);

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ appKey: opts.clientId, iat, exp, tokenExp: exp }));
  const sig = b64url(createHmac('sha256', opts.clientSecret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/**
 * Liest Client-ID und Secret aus der Umgebung oder aus einer JSON-Datei, auf die
 * ZOOM_SDK_CREDENTIALS zeigt. Die Datei gehoert AUSSERHALB des Repos — dann kann sie
 * gar nicht erst committet werden, und der gitleaks-Lauf in CI findet nichts.
 */
export function readCredentials(): { clientId: string; clientSecret: string } {
  let clientId = process.env.ZOOM_SDK_CLIENT_ID;
  let clientSecret = process.env.ZOOM_SDK_CLIENT_SECRET;

  const file = process.env.ZOOM_SDK_CREDENTIALS;
  if (file && (!clientId || !clientSecret)) {
    const j = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    clientId ??= j.clientId ?? j.client_id ?? j.appKey ?? j.sdkKey;
    clientSecret ??= j.clientSecret ?? j.client_secret ?? j.appSecret ?? j.sdkSecret;
  }

  if (!clientId || !clientSecret) {
    // Die Meldung nennt die Namen der Variablen, NIE ihre Werte.
    throw new Error(
      'Zugangsdaten fehlen: entweder ZOOM_SDK_CLIENT_ID und ZOOM_SDK_CLIENT_SECRET setzen,\n' +
        'oder ZOOM_SDK_CREDENTIALS auf eine JSON-Datei mit { "clientId": "…", "clientSecret": "…" } richten.',
    );
  }
  return { clientId, clientSecret };
}
```

- [ ] **Step 5: Tests laufen lassen**

```powershell
npm install
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: 12 `ok`-Zeilen, `Alle Selbsttests bestanden.`, Rückgabewert 0; `typecheck` ohne Ausgabe.

- [ ] **Step 6: Prüfen, dass `npm install` nicht bricht**

```powershell
npm install
```
Erwartet: läuft durch.

> **Reihenfolge, absichtlich so:** die `package.json` oben hat **kein** `"install"`-Skript. Es kommt erst in Task 4 hinzu, wenn `scripts/maybe-build.mjs` existiert. Trüge man es jetzt ein, scheiterte **jedes** `npm install` im gesamten Arbeitsbereich an einer fehlenden Datei.

- [ ] **Step 7: Committen**

```bash
git add packages/zoom-bridge/package.json packages/zoom-bridge/tsconfig.json packages/zoom-bridge/.gitignore packages/zoom-bridge/src/jwt.ts packages/zoom-bridge/test/selftest.ts
git status --short
git commit -m "feat(zoom-bridge): Paketgeruest und JWT-Bau

Das JWT entsteht in TypeScript, damit Client-ID und Secret den nativen Teil
nie erreichen. iat mit 30 s Vorlauf gegen Uhrendrift — ohne den weist Zoom
das Token mit AUTHRET_JWTTOKENWRONG ab, was wie ein falsches Secret aussieht."
```

---

### Task 2: Protokoll — Typen, Namenskataloge, Zeilenteiler

**Files:**
- Create: `packages/zoom-bridge/src/protocol.ts`
- Modify: `packages/zoom-bridge/test/selftest.ts` (Abschnitt anhängen)

**Interfaces:**
- Consumes: nichts aus Task 1.
- Produces, alles aus `src/protocol.ts`:
  - `type MeetingStatusName = 'idle'|'connecting'|'waitingForHost'|'waitingRoom'|'inMeeting'|'disconnecting'|'reconnecting'|'ended'|'failed'|'other'`
  - `type UserRoleName = 'none'|'host'|'coHost'|'panelist'|'breakoutModerator'|'attendee'`
  - `interface Participant { id: number; name: string; persistentId: string; self: boolean; videoOn: boolean; hasCamera: boolean; inWaitingRoom: boolean; role: UserRoleName }`
  - `type Command` und `type WireEvent` und `type BridgeEvent` (siehe Step 3)
  - `sdkErrorName(code: number): string`
  - `authResultName(code: number): string`
  - `explainStatus(status: MeetingStatusName, code: number): string`
  - `normalizeMeetingId(raw: string): string` (wirft bei Buchstaben)
  - `class LineSplitter { push(chunk: string): string[]; }`
  - `parseWireEvent(line: string): WireEvent | null`
  - `enrich(ev: WireEvent): BridgeEvent`
  - `serializeCommand(cmd: Command): string`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

An `packages/zoom-bridge/test/selftest.ts` anhängen, **vor** der Schlusszeile mit `process.exit`:

```ts
import {
  LineSplitter,
  authResultName,
  enrich,
  explainStatus,
  normalizeMeetingId,
  parseWireEvent,
  sdkErrorName,
  serializeCommand,
  SDK_ERROR_NAMES,
  AUTH_RESULT_NAMES,
  type BridgeEvent,
  type Participant,
} from '../src/protocol.ts';

console.log('\nprotocol — Meeting-Nummer aufraeumen:');
{
  assert(normalizeMeetingId('111 2222 3333') === '11122223333', 'Leerzeichen fallen weg');
  assert(normalizeMeetingId('111-2222-3333') === '11122223333', 'Bindestriche fallen weg');
  assert(normalizeMeetingId('11122223333') === '11122223333', 'reine Ziffern bleiben');
  let threw = false;
  try {
    normalizeMeetingId('830abc8134');
  } catch {
    threw = true;
  }
  // Buchstaben still zu entfernen waere die gefaehrliche Variante: aus einer falschen
  // Eingabe wuerde klaglos eine falsche Nummer, und der Beitritt scheiterte spaeter
  // aus scheinbar unerklaerlichem Grund.
  assert(threw, 'Buchstaben werden abgewiesen, nicht still entfernt');
}

console.log('\nprotocol — Fehlerkatalog:');
{
  assert(sdkErrorName(0) === 'SDKERR_SUCCESS', 'Code 0 ist SDKERR_SUCCESS');
  // Zwei am echten SDK GEMESSENE Anker: Lauf 1 lieferte 7 fuer den
  // uninitialisierten Zustand, Lauf 4 lieferte 12 fuer die fehlende Erlaubnis.
  assert(sdkErrorName(7) === 'SDKERR_UNINITIALIZE', 'Code 7 ist SDKERR_UNINITIALIZE (gemessen, Lauf 1)');
  assert(sdkErrorName(12) === 'SDKERR_NO_PERMISSION', 'Code 12 ist SDKERR_NO_PERMISSION (gemessen, Lauf 4)');
  assert(sdkErrorName(9999) === 'SDKERR_UNKNOWN(9999)', 'unbekannter Code wird nicht gerundet');

  const names = Object.values(SDK_ERROR_NAMES);
  assert(new Set(names).size === names.length, 'kein Name kommt zweimal vor');
  assert(names.length === 38, 'der Katalog hat 38 Eintraege (zoom_sdk_def.h, Fassung 7.1.5)');

  assert(authResultName(0) === 'AUTHRET_SUCCESS', 'AuthResult 0 ist AUTHRET_SUCCESS');
  assert(authResultName(11) === 'AUTHRET_JWTTOKENWRONG', 'AuthResult 11 ist AUTHRET_JWTTOKENWRONG');
  assert(authResultName(77) === 'AUTHRET_UNKNOWN_CODE(77)', 'unbekannter AuthResult wird nicht gerundet');
  const auths = Object.values(AUTH_RESULT_NAMES);
  assert(new Set(auths).size === auths.length, 'kein AuthResult-Name kommt zweimal vor');
}

console.log('\nprotocol — code bedeutet je nach status etwas anderes:');
{
  // MEETING_FAIL_PASSWORD_ERR = 4 und EndMeetingReason_NoAttendee = 4.
  // Derselbe Zahlenwert, zwei voellig verschiedene Aussagen. Wer den Code ohne
  // den Status ausliest, liest Kaffeesatz.
  const a = explainStatus('failed', 4);
  const b = explainStatus('ended', 4);
  assert(a !== b, 'failed(4) und ended(4) ergeben verschiedene Klartexte');
  assert(a.includes('Kenncode'), 'failed(4) nennt den falschen Kenncode');
  assert(b.includes('niemand'), 'ended(4) nennt, dass niemand mehr da war');
  assert(explainStatus('connecting', 4) !== a, 'bei connecting bedeutet 4 nichts Verwertbares');
}

console.log('\nprotocol — Zeilenteiler:');
{
  const s = new LineSplitter();
  assert(s.push('{"ev":"bye"}\n').length === 1, 'eine ganze Zeile ergibt ein Stueck');

  const s2 = new LineSplitter();
  // DIE Falle: die Puffergrenze faellt mitten ins JSON. Wer je Datenpaket parst,
  // verliert hier ein Ereignis — und merkt es nie, weil nichts abstuerzt.
  assert(s2.push('{"ev":"re').length === 0, 'halbe Zeile ergibt noch nichts');
  const rest = s2.push('ady","sdkVersion":"7.1.5"}\n');
  assert(rest.length === 1 && rest[0] === '{"ev":"ready","sdkVersion":"7.1.5"}', 'die zweite Haelfte vervollstaendigt sie');

  const s3 = new LineSplitter();
  assert(s3.push('{"ev":"bye"}\n{"ev":"bye"}\n').length === 2, 'zwei Zeilen in einem Puffer ergeben zwei Stuecke');

  const s4 = new LineSplitter();
  assert(s4.push('{"ev":"bye"}\r\n').length === 1, 'CRLF wird wie LF behandelt');
  assert(s4.push('{"ev":"bye"}\r\n')[0] === '{"ev":"bye"}', 'das \\r bleibt nicht am Ende haengen');
}

console.log('\nprotocol — Ereignisse lesen:');
{
  assert(parseWireEvent('{"ev":"bye"}')?.ev === 'bye', 'wohlgeformtes Ereignis wird gelesen');
  assert(parseWireEvent('nicht json') === null, 'kaputtes JSON ergibt null, es wirft nicht');
  assert(parseWireEvent('') === null, 'leere Zeile ergibt null');
  assert(parseWireEvent('{"kein":"ev"}') === null, 'Objekt ohne ev ergibt null');
  assert(parseWireEvent('{"ev":"voellig_neu"}')?.ev === 'voellig_neu', 'unbekanntes Ereignis kommt durch, es wird nicht verworfen');
  assert(parseWireEvent('[1,2,3]') === null, 'ein Array ist kein Ereignis');
}

console.log('\nprotocol — Anreicherung:');
{
  const e = enrich({ ev: 'error', where: 'join', code: 12 });
  assert(e.ev === 'error' && (e as { name: string }).name === 'SDKERR_NO_PERMISSION', 'error bekommt seinen Namen dazu');

  const a = enrich({ ev: 'auth', code: 0 });
  assert((a as { result: string }).result === 'AUTHRET_SUCCESS', 'auth bekommt result dazu');

  const t = enrich({ ev: 'error', where: 'join', code: 'joinTimeout' });
  assert((t as { name: string }).name === 'JOIN_TIMEOUT', 'ein selbst erzeugter Fehler behaelt seinen eigenen Namen');
  // `at`, nicht `a`: weiter oben in DIESEM Block ist `a` schon fuer das auth-Ereignis vergeben.
  const at = enrich({ ev: 'error', where: 'auth', code: 'authTimeout' });
  assert((at as { name: string }).name === 'AUTH_TIMEOUT', 'die Anmelde-Zeitueberschreitung hat einen EIGENEN Namen');
  assert((t as { name: string }).name !== (at as { name: string }).name, 'zwei Zeitueberschreitungen, zwei Namen');

  const b = enrich({ ev: 'bye' });
  assert(b.ev === 'bye' && Object.keys(b).length === 1, 'was nichts braucht, wird nicht angereichert');
}

console.log('\nprotocol — Befehle schreiben:');
{
  assert(serializeCommand({ cmd: 'init' }) === '{"cmd":"init"}\n', 'init endet mit genau einem Zeilenumbruch');
  const j = serializeCommand({ cmd: 'join', meetingId: '11122223333', passcode: 'a"b', displayName: 'JM Connect' });
  assert(j.endsWith('\n') && j.split('\n').length === 2, 'auch join ist genau eine Zeile');
  assert(JSON.parse(j).passcode === 'a"b', 'Anfuehrungszeichen im Kenncode werden maskiert');
}
```

- [ ] **Step 2: Lauf zur Bestätigung, dass er fehlschlägt**

```powershell
npm run selftest -w @jm/zoom-bridge
```
Erwartet: FEHLER — `Cannot find module '../src/protocol.ts'`.

- [ ] **Step 3: `src/protocol.ts` schreiben**

```ts
// Das Protokoll zwischen zoom-bridge.exe und der TypeScript-Seite.
//
// SCHNITT: auf der Rohrleitung stehen ZAHLEN, keine Namen. Der Namenskatalog liegt
// hier, an genau einer Stelle — sonst waere er nur mit SDK und Compiler pruefbar.
// Die C++-Seite schreibt den Klartextnamen zusaetzlich auf stderr; das ist Diagnose,
// kein Protokoll, und darf sich doppeln.

export type MeetingStatusName =
  | 'idle'
  | 'connecting'
  | 'waitingForHost'
  | 'waitingRoom'
  | 'inMeeting'
  | 'disconnecting'
  | 'reconnecting'
  | 'ended'
  | 'failed'
  | 'other';

export type UserRoleName = 'none' | 'host' | 'coHost' | 'panelist' | 'breakoutModerator' | 'attendee';

export interface Participant {
  /** GetUserID() — gilt NUR innerhalb dieser Sitzung, wechselt bei Wiederverbindung. */
  id: number;
  name: string;
  /** GetPersistentId() — ueber Wiederverbindungen stabil, kann leer sein. */
  persistentId: string;
  self: boolean;
  videoOn: boolean;
  hasCamera: boolean;
  inWaitingRoom: boolean;
  role: UserRoleName;
}

export type Command =
  | { cmd: 'init' }
  | { cmd: 'auth'; jwt: string }
  | { cmd: 'join'; meetingId: string; passcode: string; displayName: string }
  | { cmd: 'leave' }
  | { cmd: 'quit' };

/** Was woertlich auf stdout der Bridge steht. */
export type WireEvent =
  | { ev: 'ready'; sdkVersion: string }
  | { ev: 'auth'; code: number }
  | { ev: 'status'; status: MeetingStatusName; raw: number; code: number }
  | { ev: 'roster'; list: Participant[] }
  | { ev: 'joined'; p: Participant }
  | { ev: 'left'; id: number }
  | { ev: 'renamed'; id: number; name: string }
  | { ev: 'privilege'; canRecordRaw: boolean; requested?: boolean; denied?: boolean }
  | { ev: 'error'; where: string; code: number | string }
  | { ev: 'bye' }
  | { ev: string; [k: string]: unknown };

/** Dasselbe Ereignis, nachdem TypeScript Namen und Klartext dazugesetzt hat. */
export type BridgeEvent = WireEvent & { name?: string; result?: string; explain?: string };

// --- Fehlerkatalog ----------------------------------------------------------
// Woertlich aus zoom_sdk_def.h, Fassung 7.1.5 (43953). Die Aufzaehlung ist dort
// fortlaufend ab 0. Zwei Eintraege sind am echten SDK GEMESSEN und bestaetigen die
// Reihenfolge: 7 = SDKERR_UNINITIALIZE (Sondierlauf 1), 12 = SDKERR_NO_PERMISSION
// (Sondierlauf 4). Ohne diese Anker waere die Tabelle geraten.
export const SDK_ERROR_NAMES: Record<number, string> = {
  0: 'SDKERR_SUCCESS',
  1: 'SDKERR_NO_IMPL',
  2: 'SDKERR_WRONG_USAGE',
  3: 'SDKERR_INVALID_PARAMETER',
  4: 'SDKERR_MODULE_LOAD_FAILED',
  5: 'SDKERR_MEMORY_FAILED',
  6: 'SDKERR_SERVICE_FAILED',
  7: 'SDKERR_UNINITIALIZE',
  8: 'SDKERR_UNAUTHENTICATION',
  9: 'SDKERR_NORECORDINGINPROCESS',
  10: 'SDKERR_TRANSCODER_NOFOUND',
  11: 'SDKERR_VIDEO_NOTREADY',
  12: 'SDKERR_NO_PERMISSION',
  13: 'SDKERR_UNKNOWN',
  14: 'SDKERR_OTHER_SDK_INSTANCE_RUNNING',
  15: 'SDKERR_INTERNAL_ERROR',
  16: 'SDKERR_NO_AUDIODEVICE_ISFOUND',
  17: 'SDKERR_NO_VIDEODEVICE_ISFOUND',
  18: 'SDKERR_TOO_FREQUENT_CALL',
  19: 'SDKERR_FAIL_ASSIGN_USER_PRIVILEGE',
  20: 'SDKERR_MEETING_DONT_SUPPORT_FEATURE',
  21: 'SDKERR_MEETING_NOT_SHARE_SENDER',
  22: 'SDKERR_MEETING_YOU_HAVE_NO_SHARE',
  23: 'SDKERR_MEETING_VIEWTYPE_PARAMETER_IS_WRONG',
  24: 'SDKERR_MEETING_ANNOTATION_IS_OFF',
  25: 'SDKERR_SETTING_OS_DONT_SUPPORT',
  26: 'SDKERR_EMAIL_LOGIN_IS_DISABLED',
  27: 'SDKERR_HARDWARE_NOT_MEET_FOR_VB',
  28: 'SDKERR_NEED_USER_CONFIRM_RECORD_DISCLAIMER',
  29: 'SDKERR_NO_SHARE_DATA',
  30: 'SDKERR_SHARE_CANNOT_SUBSCRIBE_MYSELF',
  31: 'SDKERR_NOT_IN_MEETING',
  32: 'SDKERR_NOT_JOIN_AUDIO',
  33: 'SDKERR_HARDWARE_DONT_SUPPORT',
  34: 'SDKERR_DOMAIN_DONT_SUPPORT',
  35: 'SDKERR_MEETING_REMOTE_CONTROL_IS_OFF',
  36: 'SDKERR_FILETRANSFER_ERROR',
  37: 'SDKERR_BREAKOUT_ROOM_NOT_CREATED',
};

/** Namen, die WIR vergeben — nicht das SDK. */
export const OWN_ERROR_NAMES: Record<string, string> = {
  timeout: 'JOIN_TIMEOUT',
  badJson: 'BAD_JSON',
  badMeetingId: 'BAD_MEETING_ID',
  spawnFailed: 'SPAWN_FAILED',
  exited: 'EXITED_UNEXPECTEDLY',
};

export function sdkErrorName(code: number): string {
  // NIE auf den naechstaehnlichen runden: eine erfundene Ursache ist schlimmer als
  // gar keine, weil sie die Suche in die falsche Richtung schickt.
  return SDK_ERROR_NAMES[code] ?? `SDKERR_UNKNOWN(${code})`;
}

// Woertlich aus auth_service_interface.h, fortlaufend ab 0.
export const AUTH_RESULT_NAMES: Record<number, string> = {
  0: 'AUTHRET_SUCCESS',
  1: 'AUTHRET_KEYORSECRETEMPTY',
  2: 'AUTHRET_KEYORSECRETWRONG',
  3: 'AUTHRET_ACCOUNTNOTSUPPORT',
  4: 'AUTHRET_ACCOUNTNOTENABLESDK',
  5: 'AUTHRET_UNKNOWN',
  6: 'AUTHRET_SERVICE_BUSY',
  7: 'AUTHRET_NONE',
  8: 'AUTHRET_OVERTIME',
  9: 'AUTHRET_NETWORKISSUE',
  10: 'AUTHRET_CLIENT_INCOMPATIBLE',
  11: 'AUTHRET_JWTTOKENWRONG',
  12: 'AUTHRET_LIMIT_EXCEEDED_EXCEPTION',
};

export function authResultName(code: number): string {
  return AUTH_RESULT_NAMES[code] ?? `AUTHRET_UNKNOWN_CODE(${code})`;
}

// --- Status und sein Code ---------------------------------------------------
// onMeetingStatusChanged liefert in iResult ZWEI verschiedene Aufzaehlungen:
// MeetingFailCode bei FAILED, EndMeetingReason bei ENDED. Sonst nichts Verwertbares.
const FAIL_CODES: Record<number, string> = {
  1: 'Verbindungsfehler',
  2: 'Wiederverbinden fehlgeschlagen',
  3: 'MMR-Fehler',
  4: 'falscher Kenncode',
  5: 'Sitzungsfehler',
  6: 'das Meeting ist vorbei',
  7: 'das Meeting hat noch nicht begonnen',
  8: 'dieses Meeting gibt es nicht',
  9: 'das Meeting ist voll',
  10: 'Client zu alt',
  12: 'das Meeting ist gesperrt',
  13: 'das Meeting ist eingeschraenkt',
  0xffff: 'unbekannter Grund',
};

const END_REASONS: Record<number, string> = {
  0: 'ohne besonderen Grund',
  1: 'vom Gastgeber entfernt',
  2: 'vom Gastgeber beendet',
  3: 'Wartezeit auf den Gastgeber abgelaufen',
  4: 'es war niemand mehr da',
  5: 'der Gastgeber hat ein anderes Meeting gestartet',
  6: 'Zeitgrenze des kostenlosen Meetings',
  7: 'undefiniert',
  8: 'der berechtigte Nutzer hat das Meeting verlassen',
};

export function explainStatus(status: MeetingStatusName, code: number): string {
  if (status === 'failed') return `gescheitert: ${FAIL_CODES[code] ?? `Fehlerschluessel ${code}`}`;
  if (status === 'ended') return `beendet: ${END_REASONS[code] ?? `Grund ${code}`}`;
  // Ausdruecklich KEINE Deutung: ausserhalb von failed/ended traegt iResult nichts.
  return status;
}

// --- Meeting-Nummer ---------------------------------------------------------
export function normalizeMeetingId(raw: string): string {
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(stripped)) {
    // Buchstaben still zu entfernen waere gefaehrlich: aus einer falschen Eingabe
    // wuerde klaglos eine falsche Nummer, und der Beitritt scheiterte spaeter aus
    // scheinbar unerklaerlichem Grund.
    throw new Error(`Meeting-Nummer enthaelt Zeichen, die keine Ziffern sind: "${trimmed}"`);
  }
  return stripped;
}

// --- Zeilen zusammensetzen ---------------------------------------------------
/**
 * Setzt Zeilen aus Datenpaketen zusammen. Ein Kindprozess liefert BELIEBIGE
 * Bruchstuecke — die Puffergrenze faellt regelmaessig mitten ins JSON. Wer je
 * Datenpaket parst, verliert Ereignisse, ohne dass irgendetwas abstuerzt.
 */
export class LineSplitter {
  private rest = '';

  push(chunk: string): string[] {
    this.rest += chunk;
    const parts = this.rest.split('\n');
    this.rest = parts.pop() ?? '';
    return parts.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l)).filter((l) => l.length > 0);
  }
}

export function parseWireEvent(line: string): WireEvent | null {
  if (!line.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    // Eine kaputte Zeile darf die Sitzung NICHT abreissen.
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const ev = (parsed as { ev?: unknown }).ev;
  if (typeof ev !== 'string' || ev.length === 0) return null;
  return parsed as WireEvent;
}

export function enrich(ev: WireEvent): BridgeEvent {
  if (ev.ev === 'error') {
    const code = (ev as { code: number | string }).code;
    const name = typeof code === 'number' ? sdkErrorName(code) : (OWN_ERROR_NAMES[code] ?? `OWN_UNKNOWN(${code})`);
    return { ...ev, name };
  }
  if (ev.ev === 'auth') {
    return { ...ev, result: authResultName((ev as { code: number }).code) };
  }
  if (ev.ev === 'status') {
    const s = ev as { status: MeetingStatusName; code: number };
    return { ...ev, explain: explainStatus(s.status, s.code) };
  }
  return ev;
}

export function serializeCommand(cmd: Command): string {
  return `${JSON.stringify(cmd)}\n`;
}
```

- [ ] **Step 4: Tests laufen lassen**

```powershell
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: alle `ok`, Rückgabewert 0.

- [ ] **Step 5: Committen**

```bash
git add packages/zoom-bridge/src/protocol.ts packages/zoom-bridge/test/selftest.ts
git status --short
git commit -m "feat(zoom-bridge): Protokoll, Namenskataloge, Zeilenteiler

Auf der Rohrleitung stehen Zahlen, die Namen liegen an genau einer Stelle
in TypeScript — sonst waere der Katalog nur mit SDK und Compiler pruefbar.

Zwei Fallen mit eigenem Test: die Puffergrenze faellt mitten ins JSON, und
iResult traegt bei FAILED und ENDED zwei verschiedene Aufzaehlungen (4 heisst
einmal falscher Kenncode, einmal es war niemand mehr da)."
```

---

### Task 3: Zustandsmaschine

**Files:**
- Create: `packages/zoom-bridge/src/state.ts`
- Modify: `packages/zoom-bridge/test/selftest.ts` (Abschnitt anhängen)

**Interfaces:**
- Consumes: `BridgeEvent`, `MeetingStatusName`, `Participant` aus `src/protocol.ts`.
- Produces, aus `src/state.ts`:
  - `interface Session { phase: 'start'|'ready'|'authed'|'joining'|'inMeeting'|'left'|'error'; meeting: MeetingStatusName; participants: Map<number, Participant>; canRecordRaw: boolean; privilegeRequested: boolean; lastError: { where: string; code: number|string; name: string } | null; }`
  - `initialSession(): Session`
  - `reduce(s: Session, ev: BridgeEvent): Session`
  - `isSettled(status: MeetingStatusName): boolean`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

An `test/selftest.ts` anhängen:

```ts
import { initialSession, isSettled, reduce, type Session } from '../src/state.ts';

function person(over: Partial<Participant> = {}): Participant {
  return {
    id: 1,
    name: 'Alex',
    persistentId: 'p-alex',
    self: false,
    videoOn: true,
    hasCamera: true,
    inWaitingRoom: false,
    role: 'host',
    ...over,
  };
}

function run(events: BridgeEvent[]): Session {
  return events.reduce((s, e) => reduce(s, enrich(e)), initialSession());
}

console.log('\nstate — ruhende Zustaende:');
{
  // DER Testfall des Spikes: der Beitritt hing 90 Sekunden bei CONNECTING.
  // Ein Wachhund, der bei "connecting" einschlaeft, haette genau das verschlafen.
  assert(!isSettled('connecting'), 'connecting ist NICHT ruhend — sonst verschlaeft der Wachhund den Haenger');
  assert(!isSettled('reconnecting'), 'reconnecting ist nicht ruhend');
  assert(!isSettled('disconnecting'), 'disconnecting ist nicht ruhend');
  assert(!isSettled('idle'), 'idle ist nicht ruhend');
  assert(!isSettled('other'), 'other ist nicht ruhend');
  assert(isSettled('inMeeting'), 'inMeeting ist ruhend');
  assert(isSettled('waitingRoom'), 'waitingRoom ist ruhend — dort ist Warten die richtige Antwort');
  assert(isSettled('waitingForHost'), 'waitingForHost ist ruhend');
  assert(isSettled('failed'), 'failed ist ruhend');
  assert(isSettled('ended'), 'ended ist ruhend');
}

console.log('\nstate — sauberer Beitritt:');
{
  const s = run([
    { ev: 'ready', sdkVersion: '7.1.5' },
    { ev: 'auth', code: 0 },
    { ev: 'status', status: 'connecting', raw: 1, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person(), person({ id: 2, name: 'Bridge', self: true, role: 'attendee' })] },
  ]);
  assert(s.phase === 'inMeeting', 'Phase ist inMeeting');
  assert(s.meeting === 'inMeeting', 'Meeting-Status ist inMeeting');
  assert(s.participants.size === 2, 'zwei Teilnehmer bekannt');
  assert(s.participants.get(2)?.self === true, 'die Bridge erkennt sich selbst');
  assert(s.lastError === null, 'kein Fehler');
}

console.log('\nstate — Warteraum und verspaeteter Gastgeber:');
{
  const a = run([
    { ev: 'status', status: 'waitingRoom', raw: 10, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
  ]);
  assert(a.meeting === 'inMeeting' && a.phase !== 'error', 'Warteraum ist kein Fehler');

  const b = run([
    { ev: 'status', status: 'waitingForHost', raw: 2, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
  ]);
  assert(b.meeting === 'inMeeting' && b.phase !== 'error', 'auf den Gastgeber warten ist kein Fehler');
}

console.log('\nstate — Erlaubnis kommt verspaetet:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'privilege', canRecordRaw: false, requested: true },
    { ev: 'privilege', canRecordRaw: true },
  ]);
  assert(s.canRecordRaw === true, 'nach der Freigabe darf aufgenommen werden');
  assert(s.privilegeRequested === true, 'dass gefragt wurde, bleibt sichtbar');
  assert(s.phase === 'inMeeting', 'die fehlende Erlaubnis war nie ein Fehler');
}

console.log('\nstate — Teilnehmer kommen, heissen anders, gehen:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person()] },
    { ev: 'joined', p: person({ id: 2, name: 'Bea' }) },
    { ev: 'renamed', id: 2, name: 'Beatrix' },
    { ev: 'left', id: 1 },
  ]);
  assert(s.participants.size === 1, 'einer ist gegangen, einer ist da');
  assert(s.participants.get(2)?.name === 'Beatrix', 'die Umbenennung ist angekommen');

  // Ereignisse koennen sich ueberholen. Keiner dieser Faelle ist ein Fehler.
  const t = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'left', id: 99 },
    { ev: 'renamed', id: 98, name: 'Geist' },
    { ev: 'joined', p: person({ id: 5 }) },
    { ev: 'joined', p: person({ id: 5, name: 'Alex zum Zweiten' }) },
  ]);
  assert(t.phase === 'inMeeting', 'ueberholende Ereignisse sind kein Fehler');
  assert(t.participants.size === 1, 'ein zweites joined verdoppelt nicht, es aktualisiert');
  assert(t.participants.get(5)?.name === 'Alex zum Zweiten', 'das zweite joined hat aktualisiert');
  assert(!t.participants.has(98), 'ein renamed fuer einen Unbekannten legt niemanden an');
}

console.log('\nstate — Wiederverbindung ersetzt die Karte vollstaendig:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'roster', list: [person({ id: 11 }), person({ id: 12, name: 'Bea' })] },
    { ev: 'status', status: 'reconnecting', raw: 5, code: 0 },
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    // Nach der Wiederverbindung sind die IDs ANDERE. Wer nur ergaenzt, behaelt
    // Karteileichen und laesst spaeter NDI-Sender fuer Geister laufen.
    { ev: 'roster', list: [person({ id: 21 }), person({ id: 22, name: 'Bea' })] },
  ]);
  assert(s.participants.size === 2, 'die Karte hat zwei Eintraege, nicht vier');
  assert(s.participants.has(21) && !s.participants.has(11), 'die alten IDs sind weg');
}

console.log('\nstate — Abbruch und Fehler:');
{
  const s = run([
    { ev: 'status', status: 'inMeeting', raw: 3, code: 0 },
    { ev: 'status', status: 'ended', raw: 7, code: 2 },
  ]);
  assert(s.phase !== 'error', 'ein beendetes Meeting ist kein Fehler');
  assert(s.meeting === 'ended', 'der Status ist ended');

  const e = run([{ ev: 'error', where: 'join', code: 12 }]);
  assert(e.phase === 'error', 'nur ein error-Ereignis fuehrt in die Fehlerphase');
  assert(e.lastError?.name === 'SDKERR_NO_PERMISSION', 'der Fehler traegt seinen Namen');
  assert(e.lastError?.where === 'join', 'und die Stelle, an der er auftrat');
}
```

- [ ] **Step 2: Lauf zur Bestätigung, dass er fehlschlägt**

```powershell
npm run selftest -w @jm/zoom-bridge
```
Erwartet: FEHLER — `Cannot find module '../src/state.ts'`.

- [ ] **Step 3: `src/state.ts` schreiben**

```ts
// Die Zustandsmaschine: aus Ereignissen wird ein Bild der Sitzung.
// Rein — kein Prozess, keine Uhr, keine Seiteneffekte. Deshalb ohne SDK pruefbar.
import type { BridgeEvent, MeetingStatusName, Participant } from './protocol.ts';

export interface Session {
  phase: 'start' | 'ready' | 'authed' | 'joining' | 'inMeeting' | 'left' | 'error';
  meeting: MeetingStatusName;
  participants: Map<number, Participant>;
  canRecordRaw: boolean;
  privilegeRequested: boolean;
  lastError: { where: string; code: number | string; name: string } | null;
}

export function initialSession(): Session {
  return {
    phase: 'start',
    meeting: 'idle',
    participants: new Map(),
    canRecordRaw: false,
    privilegeRequested: false,
    lastError: null,
  };
}

/**
 * Ruhend heisst: es ist ein Zustand, in dem das Warten aufhoert und eine Antwort
 * vorliegt — auch wenn die Antwort "Warteraum" lautet.
 *
 * ⚑ `connecting` ist AUSDRUECKLICH nicht ruhend. Genau dort hing der Stage-0-Spike
 * 90 Sekunden lang ohne jede Meldung. Ein Wachhund, der beim ersten Lebenszeichen
 * einschlaeft, haette diesen Fall verschlafen.
 */
export function isSettled(status: MeetingStatusName): boolean {
  return status === 'inMeeting' || status === 'waitingRoom' || status === 'waitingForHost' || status === 'failed' || status === 'ended';
}

export function reduce(s: Session, ev: BridgeEvent): Session {
  switch (ev.ev) {
    case 'ready':
      return { ...s, phase: 'ready' };

    case 'auth':
      return { ...s, phase: (ev as { code: number }).code === 0 ? 'authed' : s.phase };

    case 'status': {
      const e = ev as { status: MeetingStatusName };
      let phase = s.phase;
      if (e.status === 'inMeeting') phase = 'inMeeting';
      else if (e.status === 'connecting') phase = 'joining';
      else if (e.status === 'ended' || e.status === 'failed') phase = 'left';
      // Wer das Meeting verlaesst, laesst niemanden zurueck.
      const participants = e.status === 'ended' || e.status === 'failed' ? new Map<number, Participant>() : s.participants;
      return { ...s, phase, meeting: e.status, participants };
    }

    case 'roster': {
      // ERSETZEN, nicht ergaenzen: nach einer Wiederverbindung sind die IDs andere,
      // und ergaenzen hiesse Karteileichen behalten.
      const list = (ev as { list: Participant[] }).list;
      return { ...s, participants: new Map(list.map((p) => [p.id, p])) };
    }

    case 'joined': {
      const p = (ev as { p: Participant }).p;
      const participants = new Map(s.participants);
      participants.set(p.id, p); // bekannt = aktualisieren, nicht verdoppeln
      return { ...s, participants };
    }

    case 'left': {
      const id = (ev as { id: number }).id;
      if (!s.participants.has(id)) return s; // Ereignisse koennen sich ueberholen
      const participants = new Map(s.participants);
      participants.delete(id);
      return { ...s, participants };
    }

    case 'renamed': {
      const e = ev as { id: number; name: string };
      const known = s.participants.get(e.id);
      if (!known) return s; // fuer einen Unbekannten legen wir niemanden an
      const participants = new Map(s.participants);
      participants.set(e.id, { ...known, name: e.name });
      return { ...s, participants };
    }

    case 'privilege': {
      const e = ev as { canRecordRaw: boolean; requested?: boolean };
      return {
        ...s,
        canRecordRaw: e.canRecordRaw,
        privilegeRequested: s.privilegeRequested || e.requested === true,
      };
    }

    case 'error': {
      const e = ev as { where: string; code: number | string; name?: string };
      return { ...s, phase: 'error', lastError: { where: e.where, code: e.code, name: e.name ?? 'UNBENANNT' } };
    }

    case 'bye':
      return { ...s, phase: s.phase === 'error' ? 'error' : 'left' };

    default:
      // Unbekanntes Ereignis: nicht verschlucken, aber auch nicht deuten.
      return s;
  }
}
```

- [ ] **Step 4: Tests laufen lassen**

```powershell
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: alle `ok`, Rückgabewert 0.

- [ ] **Step 5: Committen**

```bash
git add packages/zoom-bridge/src/state.ts packages/zoom-bridge/test/selftest.ts
git status --short
git commit -m "feat(zoom-bridge): Zustandsmaschine und ruhende Zustaende

isSettled entscheidet, wann der Beitritts-Wachhund schweigen darf. connecting
gehoert ausdruecklich NICHT dazu: genau dort hing der Stage-0-Spike 90 Sekunden.

roster ERSETZT die Teilnehmerkarte. Nach einer Wiederverbindung sind die IDs
andere — wer ergaenzt, behaelt Karteileichen und laesst spaeter NDI-Sender fuer
Geister laufen."
```

---

### Task 4: Die Baukette und ein Programm, das eine Zeile sagt

**Files:**
- Create: `packages/zoom-bridge/scripts/make-implib.mjs`
- Create: `packages/zoom-bridge/scripts/maybe-build.mjs`
- Create: `packages/zoom-bridge/CMakeLists.txt`
- Create: `packages/zoom-bridge/native/emit.h`
- Create: `packages/zoom-bridge/native/emit.cpp`
- Create: `packages/zoom-bridge/native/main.cpp`
- Modify: `packages/zoom-bridge/package.json` (`"install"`-Skript hinzufügen)

**Interfaces:**
- Consumes: nichts.
- Produces, aus `native/emit.h`: `void emitRaw(const std::string& json)` · `void emitLog(const std::wstring& text)` · `std::string jsonEscape(const std::wstring& s)` (UTF-8, maskiert, ohne äußere Anführungszeichen). Dazu die gebaute Datei `packages/zoom-bridge/build/Release/zoom-bridge.exe`.

**Warum diese Aufgabe allein steht:** die Baukette ist die einzige Unbekannte, die nicht aus dem Spike übernommen ist (dort war es ein `cl`-Aufruf, hier CMake). Sie wird geprüft, bevor Verhalten darauf gestapelt wird.

- [ ] **Step 1: `scripts/make-implib.mjs` schreiben**

```js
#!/usr/bin/env node
// Erzeugt sdk.lib aus sdk.dll. Das Zoom-Paket bringt KEINE Import-Bibliothek mit;
// sie ist aber ableitbar, weil sdk.dll unverzierte C-Namen exportiert und keine
// gemangelten C++-Symbole (im Stage-0-Spike gemessen: 23 Exporte).
//
// sdk.lib kommt NICHT ins Repo: sie ist an die DLL-Fassung gebunden, und eine
// mitcommittete Lib liefe bei einem SDK-Wechsel still daneben.
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.error('[@jm/zoom-bridge] ZOOM_SDK_DIR ist nicht gesetzt.');
  process.exit(1);
}
const dll = join(sdk, 'x64', 'bin', 'sdk.dll');
if (!existsSync(dll)) {
  console.error(`[@jm/zoom-bridge] sdk.dll nicht gefunden: ${dll}`);
  process.exit(1);
}

const vswhere = join(
  process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
  'Microsoft Visual Studio',
  'Installer',
  'vswhere.exe',
);
if (!existsSync(vswhere)) {
  console.error('[@jm/zoom-bridge] vswhere.exe nicht gefunden — Visual Studio Build Tools noetig.');
  process.exit(1);
}
const vsRoot = execFileSync(vswhere, [
  '-latest', '-products', '*',
  '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
  '-property', 'installationPath',
]).toString().trim();
const vsDevCmd = join(vsRoot, 'Common7', 'Tools', 'VsDevCmd.bat');

// execSync statt execFileSync('cmd.exe', ['/c', …]): Node maskiert dort die inneren
// Anfuehrungszeichen im MSVC-Stil (\"), den cmd.exe nicht versteht — der Aufruf
// scheitert dann still mit leerem stdout UND leerem stderr.
const run = (line) => {
  try {
    return execSync(`call "${vsDevCmd}" -arch=x64 -host_arch=x64 >nul 2>&1 && ${line}`, {
      cwd: pkg,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (err) {
    // Ohne diese Aufbereitung wirft Node die Ausgabe als rohen Byte-Puffer aus —
    // eine Fehlermeldung als Zahlenkolonne ist keine Fehlermeldung.
    const say = (b) => (b ? b.toString().trim() : '');
    console.error(`\n[@jm/zoom-bridge] Befehl fehlgeschlagen:\n  ${line}\n`);
    const o = say(err.stdout);
    const e = say(err.stderr);
    if (o) console.error(o);
    if (e) console.error(e);
    if (!o && !e) console.error('(keine Ausgabe — meist eine falsch maskierte Befehlszeile)');
    process.exit(1);
  }
};

const exportsText = run(`dumpbin /nologo /exports "${dll}"`);
// Zeilenform: "   ordinal   hint   RVA   Name". [NONAME]-Eintraege haben keinen
// Namen, fallen durch das Muster und sind auch nicht bindbar — genau richtig.
const names = [...exportsText.matchAll(/^\s+\d+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]{8}\s+(\S+)\s*$/gm)].map((m) => m[1]);
if (names.length === 0) {
  console.error('[@jm/zoom-bridge] Keine Exportnamen erkannt — Ausgabeformat von dumpbin geaendert?');
  process.exit(1);
}
writeFileSync(join(pkg, 'sdk.def'), `LIBRARY sdk\r\nEXPORTS\r\n${names.map((n) => `    ${n}`).join('\r\n')}\r\n`);
run('lib /nologo /def:sdk.def /machine:x64 /out:sdk.lib');
console.log(`[@jm/zoom-bridge] ${names.length} Exporte -> sdk.lib`);
```

- [ ] **Step 2: `scripts/maybe-build.mjs` schreiben**

```js
#!/usr/bin/env node
// Riegel: baut das native Sidecar nur auf Windows und nur mit vorhandenem
// Zoom-SDK (ZOOM_SDK_DIR). So bricht `npm install` in CI und im Linux-Codespace
// NICHT. Gleiches Muster wie packages/decklink/scripts/maybe-build.mjs.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (process.platform !== 'win32') {
  console.log('[@jm/zoom-bridge] Nicht-Windows — nativer Build uebersprungen.');
  process.exit(0);
}

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) {
  console.log('[@jm/zoom-bridge] ZOOM_SDK_DIR nicht gesetzt — nativer Build uebersprungen.');
  console.log('[@jm/zoom-bridge] Zoom-Meeting-SDK entpacken, ZOOM_SDK_DIR darauf richten, dann `npm run rebuild -w @jm/zoom-bridge`.');
  process.exit(0);
}

if (!existsSync(join(sdk, 'x64', 'zoom_sdk_c_sharp_wrap', 'h', 'zoom_sdk.h'))) {
  console.warn(`[@jm/zoom-bridge] ZOOM_SDK_DIR="${sdk}" enthaelt kein x64/zoom_sdk_c_sharp_wrap/h/zoom_sdk.h — Build uebersprungen.`);
  process.exit(0);
}

console.log(`[@jm/zoom-bridge] Zoom-SDK gefunden (${sdk}) — baue zoom-bridge.exe …`);
execSync('node scripts/make-implib.mjs', { stdio: 'inherit' });
execSync('cmake -S . -B build -A x64', { stdio: 'inherit' });
execSync('cmake --build build --config Release', { stdio: 'inherit' });
```

- [ ] **Step 3: `CMakeLists.txt` schreiben**

```cmake
# zoom-bridge.exe — eigenstaendiges Windows-Programm, KEIN Node-Addon.
# Deshalb CMake und nicht binding.gyp: node-gyp ist auf .node-Ausgabe und
# Electron-ABI verdrahtet und passt hier nicht.
cmake_minimum_required(VERSION 3.20)
project(zoom_bridge CXX)

if(NOT WIN32)
  message(FATAL_ERROR "zoom-bridge ist Windows-only.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT DEFINED ENV{ZOOM_SDK_DIR})
  message(FATAL_ERROR "ZOOM_SDK_DIR ist nicht gesetzt.")
endif()
file(TO_CMAKE_PATH "$ENV{ZOOM_SDK_DIR}" ZOOM_SDK_DIR)

set(ZOOM_HEADERS "${ZOOM_SDK_DIR}/x64/zoom_sdk_c_sharp_wrap/h")
if(NOT EXISTS "${ZOOM_HEADERS}/zoom_sdk.h")
  message(FATAL_ERROR "zoom_sdk.h nicht gefunden unter ${ZOOM_HEADERS}")
endif()

# Von scripts/make-implib.mjs erzeugt, liegt im Paketwurzelverzeichnis.
set(ZOOM_IMPLIB "${CMAKE_CURRENT_SOURCE_DIR}/sdk.lib")
if(NOT EXISTS "${ZOOM_IMPLIB}")
  message(FATAL_ERROR "sdk.lib fehlt — erst `node scripts/make-implib.mjs` laufen lassen.")
endif()

add_executable(zoom-bridge
  native/main.cpp
  native/emit.cpp
)

target_include_directories(zoom-bridge PRIVATE "${ZOOM_HEADERS}")
# user32: die Bridge pumpt selbst Win32-Nachrichten (PeekMessage/Dispatch) —
# ohne eigene Schleife kommt kein einziger SDK-Rueckruf an.
target_link_libraries(zoom-bridge PRIVATE "${ZOOM_IMPLIB}" user32)
target_compile_definitions(zoom-bridge PRIVATE UNICODE _UNICODE WIN32)
```

- [ ] **Step 4: `native/emit.h` und `native/emit.cpp` schreiben**

`native/emit.h`:

```cpp
// Ausgabe der Bridge. ZWEI Kanaele, streng getrennt:
//   stdout — ausschliesslich JSON-Zeilen, eine Zeile ein Objekt. Maschinenkanal.
//   stderr — Klartext fuer Menschen. Landet spaeter in der Logdatei der App.
// Wer Menschentext nach stdout schreibt, zerstoert das Protokoll.
#pragma once
#include <string>

/** Schreibt genau eine Zeile JSON nach stdout und leert den Puffer sofort. */
void emitRaw(const std::string& json);

/** Klartext nach stderr. Niemals Geheimnisse hier hineingeben. */
void emitLog(const std::wstring& text);

/** UTF-16 nach UTF-8, mit JSON-Maskierung. Ohne Anfuehrungszeichen aussen herum. */
std::string jsonEscape(const std::wstring& s);
```

`native/emit.cpp`:

```cpp
#include "emit.h"
#include <cstdio>
#include <windows.h>

void emitRaw(const std::string& json) {
  // fwrite statt printf: der JSON-Text darf Prozentzeichen enthalten.
  std::fwrite(json.data(), 1, json.size(), stdout);
  std::fputc('\n', stdout);
  // Ohne fflush haengt die Zeile im Puffer, bis er voll ist — die aufrufende
  // Seite saehe minutenlang nichts und hielte die Bridge fuer tot.
  std::fflush(stdout);
}

void emitLog(const std::wstring& text) {
  std::fwprintf(stderr, L"%s\n", text.c_str());
  std::fflush(stderr);
}

std::string jsonEscape(const std::wstring& s) {
  const int need = WideCharToMultiByte(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), nullptr, 0, nullptr, nullptr);
  std::string utf8(static_cast<size_t>(need), '\0');
  if (need > 0) {
    WideCharToMultiByte(CP_UTF8, 0, s.c_str(), static_cast<int>(s.size()), utf8.data(), need, nullptr, nullptr);
  }

  std::string out;
  out.reserve(utf8.size() + 8);
  for (const unsigned char c : utf8) {
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b";  break;
      case '\f': out += "\\f";  break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:
        if (c < 0x20) {
          char buf[7];
          std::snprintf(buf, sizeof(buf), "\\u%04x", c);
          out += buf;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  return out;
}
```

- [ ] **Step 5: `native/main.cpp` schreiben (kleinste Fassung)**

```cpp
// zoom-bridge.exe — Stage 1.
// Diese Fassung beweist nur die Baukette: sie meldet die SDK-Fassung und endet.
// Nachrichtenschleife, stdin-Leser und Befehle kommen in Task 5.
#include <string>
#include <windows.h>
#include "zoom_sdk.h"
#include "emit.h"

USING_ZOOM_SDK_NAMESPACE

int main() {
  const zchar_t* version = GetSDKVersion();
  const std::wstring v = version ? std::wstring(version) : L"(unbekannt)";
  emitRaw(std::string("{\"ev\":\"ready\",\"sdkVersion\":\"") + jsonEscape(v) + "\"}");
  emitRaw("{\"ev\":\"bye\"}");
  return 0;
}
```

- [ ] **Step 6: `"install"`-Skript in `package.json` eintragen**

In `packages/zoom-bridge/package.json`, in `"scripts"` **vor** `"rebuild"` einfügen:

```json
    "install": "node scripts/maybe-build.mjs",
```

- [ ] **Step 7: Bauen und laufen lassen**

```powershell
$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
npm run rebuild -w @jm/zoom-bridge
$env:PATH = "$env:ZOOM_SDK_DIR\x64\bin;$env:PATH"
.\packages\zoom-bridge\build\Release\zoom-bridge.exe
```

Erwartet, wörtlich zwei Zeilen:
```
{"ev":"ready","sdkVersion":"7.1.5 (43953)"}
{"ev":"bye"}
```
Weicht die Fassung ab, ist das kein Fehler — sie kommt aus der DLL.

**Zum Rückgabewert:** hier stand ursprünglich „Rückgabewert 0". Das war falsch gedacht. Dieses
Programm fasst das SDK an, **ohne `InitSDK` zu rufen** — und damit hat es genau die Gestalt von
Lauf 1 des Stage-0-Spikes, der beim Beenden mit `0xC0000409` (= `-1073740791`) abstürzte. Der
Spike hält das fest: *„Das Programm stürzte beim Beenden ab (0xC0000409), was ebenfalls zum
uninitialisierten Zustand paßt; Lauf 2 beendet sauber."*
Für diese Aufgabe zählt deshalb **nur die Ausgabe**, nicht der Rückgabewert. Der Rückgabewert `0`
wird zum harten Abnahmekriterium in **Task 5**, wo `InitSDK` und `CleanUPSDK` dazukommen — stürzt
es dort noch ab, ist das ein echter Befund und kein dokumentiertes SDK-Verhalten mehr.

- [ ] **Step 8: Prüfen, dass der Riegel greift**

```powershell
$saved = $env:ZOOM_SDK_DIR
Remove-Item Env:\ZOOM_SDK_DIR
node packages/zoom-bridge/scripts/maybe-build.mjs
$env:ZOOM_SDK_DIR = $saved
```
Erwartet: `ZOOM_SDK_DIR nicht gesetzt — nativer Build uebersprungen.` und Rückgabewert 0.

- [ ] **Step 9: Prüfen, dass die Bauartefakte nicht im Repo landen**

```powershell
git status --short packages/zoom-bridge
```
Erwartet: **keine** Zeile mit `build/`, `sdk.lib` oder `sdk.def`.

- [ ] **Step 10: Committen**

```bash
git add packages/zoom-bridge/scripts/make-implib.mjs packages/zoom-bridge/scripts/maybe-build.mjs packages/zoom-bridge/CMakeLists.txt packages/zoom-bridge/native/emit.h packages/zoom-bridge/native/emit.cpp packages/zoom-bridge/native/main.cpp packages/zoom-bridge/package.json
git status --short
git commit -m "feat(zoom-bridge): Baukette und ein Programm, das eine Zeile sagt

sdk.lib entsteht zur Bauzeit aus sdk.dll (23 unverzierte C-Exporte) und kommt
nicht ins Repo — sie ist an die DLL-Fassung gebunden.

emit trennt die Kanaele hart: stdout ist Maschine, stderr ist Mensch. Das
fflush ist kein Detail — ohne es haengt die erste Zeile im Puffer und die
aufrufende Seite haelt die Bridge fuer tot."
```

---

### Task 5: Nachrichtenschleife, stdin-Leser, `init` · `quit` · EOF

**Files:**
- Modify: `packages/zoom-bridge/native/main.cpp` (vollständig ersetzen)
- Create: `packages/zoom-bridge/native/session.h`
- Create: `packages/zoom-bridge/native/session.cpp`
- Modify: `packages/zoom-bridge/CMakeLists.txt` (`native/session.cpp` zur Quellenliste)

**Interfaces:**
- Consumes: `emitRaw`, `emitLog`, `jsonEscape` aus `native/emit.h`.
- Produces, aus `native/session.h`:
  - `bool sessionInit();` — `InitSDK` mit `ENABLE_CUSTOMIZED_UI_FLAG`, meldet `ready` oder `error`
  - `void sessionShutdown();` — Aufräumreihenfolge, meldet nichts
  - `void pumpOnce();` — eine Runde `PeekMessage`/`Translate`/`Dispatch`
  - `std::string fieldFromJson(const std::string& line, const char* key);` — schlichter Feldleser
  - `std::string cmdOf(const std::string& line);`

**Warum ein eigener Feldleser statt einer JSON-Bibliothek:** die Bridge liest genau fünf Befehle mit höchstens vier flachen Zeichenkettenfeldern. Eine Abhängigkeit für diese Aufgabe wäre teurer als der Leser selbst — und jede zusätzliche Bibliothek muss in Stage 4 mit ausgeliefert und lizenzgeprüft werden.

- [ ] **Step 1: `native/session.h` schreiben**

```cpp
#pragma once
#include <string>

/**
 * InitSDK mit den Setzungen der Bridge. Meldet {"ev":"ready",…} bei Erfolg und
 * {"ev":"error","where":"init","code":n} sonst.
 */
bool sessionInit();

/**
 * Abbau in der EINZIG zulaessigen Reihenfolge:
 *   Leave -> pumpen bis ENDED/IDLE oder 5 s -> DestroyMeetingService
 *   -> DestroyAuthService -> CleanUPSDK
 * Ein DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
 * 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
 * noch arbeitet.
 */
void sessionShutdown();

/** Eine Runde Win32-Nachrichten abarbeiten. Ohne sie kommt kein Rueckruf an. */
void pumpOnce();

/**
 * Liest ein flaches Zeichenkettenfeld aus einer JSON-Zeile. Reicht fuer die fuenf
 * Befehle der Bridge; eine JSON-Bibliothek waere hier teurer als der Leser und
 * muesste in Stage 4 mit ausgeliefert und lizenzgeprueft werden.
 * Gibt "" zurueck, wenn das Feld fehlt.
 */
std::string fieldFromJson(const std::string& line, const char* key);

/** Der Wert von "cmd", oder "" wenn die Zeile keiner ist. */
std::string cmdOf(const std::string& line);
```

- [ ] **Step 2: `native/session.cpp` schreiben**

```cpp
#include "session.h"
#include <windows.h>
#include "zoom_sdk.h"
#include "emit.h"

USING_ZOOM_SDK_NAMESPACE

namespace {
bool g_sdkUp = false;
}

void pumpOnce() {
  MSG msg;
  while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
}

bool sessionInit() {
  if (g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"init\",\"code\":2}");  // SDKERR_WRONG_USAGE
    return false;
  }

  InitParam p;
  p.strWebDomain = L"https://zoom.us";
  p.strBrandingName = L"JM Connect";
  p.emLanguageID = LANGUAGE_German;
  p.enableGenerateDump = false;
  p.enableLogByDefault = false;
  // Muss stehen, BEVOR Rohdaten fliessen (Stage 2/3). Hier schadet es nicht.
  p.rawdataOpts.enableRawdataIntermediateMode = false;
  p.rawdataOpts.videoRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.audioRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;
  p.rawdataOpts.shareRawdataMemoryMode = ZoomSDKRawDataMemoryModeStack;

  // ⚑ OHNE DIESE ZEILE HAENGT DER BEITRITT BEI CONNECTING.
  // Vorgabe ist der Zoom-UI-Modus: das SDK will ein eigenes Meeting-FENSTER
  // aufmachen. Die Bridge hat keines. Der Beitritt scheitert dann nicht — er
  // haengt, und das sieht aus wie ein Netzwerkproblem. Im Stage-0-Spike gemessen:
  // 90 Sekunden Schweigen bei CONNECTING.
  p.obConfigOpts.optionalFeatures = ENABLE_CUSTOMIZED_UI_FLAG;

  const SDKError err = InitSDK(p);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"init\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
    emitLog(L"InitSDK fehlgeschlagen.");
    return false;
  }
  g_sdkUp = true;

  const zchar_t* v = GetSDKVersion();
  emitRaw(std::string("{\"ev\":\"ready\",\"sdkVersion\":\"") + jsonEscape(v ? v : L"(unbekannt)") + "\"}");
  return true;
}

void sessionShutdown() {
  if (!g_sdkUp) return;
  CleanUPSDK();
  g_sdkUp = false;
}

std::string fieldFromJson(const std::string& line, const char* key) {
  const std::string needle = std::string("\"") + key + "\"";
  size_t at = line.find(needle);
  if (at == std::string::npos) return "";
  at = line.find(':', at + needle.size());
  if (at == std::string::npos) return "";
  at = line.find('"', at);
  if (at == std::string::npos) return "";
  ++at;

  std::string out;
  while (at < line.size()) {
    const char c = line[at];
    if (c == '\\' && at + 1 < line.size()) {
      const char n = line[at + 1];
      switch (n) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        default:  out += n;    break;  // \" \\ \/ und alles andere woertlich
      }
      at += 2;
      continue;
    }
    if (c == '"') break;
    out += c;
    ++at;
  }
  return out;
}

std::string cmdOf(const std::string& line) {
  return fieldFromJson(line, "cmd");
}
```

- [ ] **Step 3: `native/main.cpp` ersetzen**

```cpp
// zoom-bridge.exe — Stage 1.
//
// EIN Thread pumpt die Win32-Nachrichten (ohne sie kommt kein SDK-Rueckruf an),
// EIN Thread liest stdin. Der Leser legt fertige Zeilen in eine Warteschlange,
// der Hauptthread arbeitet sie zwischen zwei Pumprunden ab. Alle SDK-Aufrufe
// passieren damit auf demselben Thread, der auch pumpt.
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <cstdio>
#include <windows.h>
#include "emit.h"
#include "session.h"

namespace {

std::mutex g_mutex;
std::deque<std::string> g_lines;
volatile bool g_stdinClosed = false;
volatile bool g_quit = false;

void readStdin() {
  std::string line;
  int c;
  while ((c = std::fgetc(stdin)) != EOF) {
    if (c == '\n') {
      if (!line.empty() && line.back() == '\r') line.pop_back();
      if (!line.empty()) {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_lines.push_back(line);
      }
      line.clear();
      continue;
    }
    line += static_cast<char>(c);
  }
  // EOF heisst quit. Stirbt die aufrufende Seite, darf keine verwaiste Bridge
  // in einem fremden Meeting sitzen bleiben.
  g_stdinClosed = true;
}

bool nextLine(std::string& out) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_lines.empty()) return false;
  out = g_lines.front();
  g_lines.pop_front();
  return true;
}

void handle(const std::string& line) {
  const std::string cmd = cmdOf(line);
  if (cmd.empty()) {
    emitRaw("{\"ev\":\"error\",\"where\":\"parse\",\"code\":\"badJson\"}");
    return;
  }
  if (cmd == "init") {
    sessionInit();
    return;
  }
  if (cmd == "quit") {
    g_quit = true;
    return;
  }
  // auth/join/leave kommen in Task 6 und 7.
  emitRaw("{\"ev\":\"error\",\"where\":\"" + cmd + "\",\"code\":1}");  // SDKERR_NO_IMPL
}

}  // namespace

int main() {
  std::thread reader(readStdin);
  reader.detach();

  std::string line;
  while (!g_quit) {
    pumpOnce();
    while (!g_quit && nextLine(line)) handle(line);
    if (g_stdinClosed) {
      std::lock_guard<std::mutex> lock(g_mutex);
      if (g_lines.empty()) break;
    }
    // 10 ms: kurz genug, dass ein Befehl nicht spuerbar liegen bleibt, lang
    // genug, dass die Bridge im Leerlauf keinen Kern verheizt.
    Sleep(10);
  }

  sessionShutdown();
  emitRaw("{\"ev\":\"bye\"}");
  return 0;
}
```

- [ ] **Step 4: `CMakeLists.txt` ergänzen**

`add_executable(zoom-bridge …)` um `native/session.cpp` erweitern:

```cmake
add_executable(zoom-bridge
  native/main.cpp
  native/emit.cpp
  native/session.cpp
)
```

- [ ] **Step 5: Bauen und die drei Wege prüfen**

```powershell
$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
$env:PATH = "$env:ZOOM_SDK_DIR\x64\bin;$env:PATH"
npm run rebuild -w @jm/zoom-bridge
$exe = ".\packages\zoom-bridge\build\Release\zoom-bridge.exe"

# a) init + quit
"{`"cmd`":`"init`"}`n{`"cmd`":`"quit`"}" | & $exe
Write-Output "Rueckgabewert: $LASTEXITCODE"

# b) EOF ohne quit — die Bridge muss von selbst enden
"{`"cmd`":`"init`"}" | & $exe
Write-Output "Rueckgabewert: $LASTEXITCODE"

# c) kaputte Zeile darf die Sitzung nicht abreissen
"kaputt`n{`"cmd`":`"init`"}`n{`"cmd`":`"quit`"}" | & $exe
Write-Output "Rueckgabewert: $LASTEXITCODE"
```

Erwartet:
- a) `{"ev":"ready",…}` dann `{"ev":"bye"}`, **Rückgabewert 0** — hier ist die 0 ein hartes
  Kriterium, anders als in Task 4: mit `InitSDK` und `CleanUPSDK` endet das Programm sauber.
  Gemessen am 2026-08-11 an einem Vorabbau: dreimal Rückgabewert 0, deterministisch.
- b) dieselben zwei Zeilen — EOF beendet den Prozess ohne `quit`, Rückgabewert 0
- c) `{"ev":"error","where":"parse","code":"badJson"}`, **danach** `ready` und `bye`, Rückgabewert 0

⚑ **Eine fremde Zeile auf stdout ist normal, kein Fehler.** Nach `InitSDK` schreibt das Zoom-SDK
selbst `getServiceHub` auf **stdout** — gemessen mit getrennter Umleitung. Die erwartete Ausgabe
von a) lautet also vollständig:

```
getServiceHub
{"ev":"ready","sdkVersion":"7.1.5 (43953)"}
{"ev":"bye"}
```

Diese Zeile darf **nicht** unterdrückt oder herausgefiltert werden — sie kommt aus der DLL, wir
haben keinen Zugriff darauf, und ein Filter würde nur so lange halten, bis Zoom den Text ändert.
Die richtige Antwort steht schon in Task 2: `parseWireEvent` gibt bei Nicht-JSON `null` zurück, und
Task 10 meldet solche Zeilen als Rauschen auf dem Diagnoseweg. Diese Toleranz ist damit **tragend
und nicht optional**.

- [ ] **Step 6: Committen**

```bash
git add packages/zoom-bridge/native/main.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp packages/zoom-bridge/CMakeLists.txt
git status --short
git commit -m "feat(zoom-bridge): Nachrichtenschleife, stdin-Leser, init und quit

ENABLE_CUSTOMIZED_UI_FLAG steht in InitParam. Ohne die Zeile will das SDK ein
eigenes Meeting-Fenster und der Beitritt haengt bei CONNECTING — im Spike
90 Sekunden lang gemessen, ohne jede Meldung.

stdin-EOF beendet die Bridge. Stirbt die aufrufende Seite, darf keine
verwaiste Bridge in einem fremden Meeting sitzen bleiben."
```

---

### Task 6: Anmeldung

**Files:**
- Create: `packages/zoom-bridge/native/callbacks.h`
- Create: `packages/zoom-bridge/native/callbacks.cpp`
- Modify: `packages/zoom-bridge/native/session.h/.cpp` (`sessionAuth`)
- Modify: `packages/zoom-bridge/native/main.cpp` (Befehl `auth`)
- Modify: `packages/zoom-bridge/CMakeLists.txt` (`native/callbacks.cpp`)

**Interfaces:**
- Consumes: `emitRaw`, `jsonEscape`, `pumpOnce`, `fieldFromJson`.
- Produces: `void sessionAuth(const std::string& jwtUtf8);` — meldet `{"ev":"auth","code":n}`, wobei `n` der `AuthResult` aus `onAuthenticationReturn` ist.

> **⚑ Wächter-Falle.** `IAuthServiceEvent` und die anderen Rückruf-Schnittstellen haben rein virtuelle Methoden hinter `#if defined(WIN32)` bzw. `#if defined(__linux__)`. Ein `grep virtual` über den Kopfsatz zeigt **alle** und verschluckt die Wächter — im Spike hat das einen `C2061` gekostet. Die vollständige, geprüfte Windows-Liste für `IAuthServiceEvent` steht unten; für die anderen Schnittstellen ist die geprüfte Liste in [`docs/superpowers/spikes/2026-08-10-zoom-sdk-linkbarkeit/04-join-rawrecording.cpp`](../spikes/2026-08-10-zoom-sdk-linkbarkeit/04-join-rawrecording.cpp) nachlesbar (Zeilen 69–114).

- [ ] **Step 1: `native/callbacks.h` schreiben**

```cpp
// Die Rueckruf-Klassen des SDK.
//
// ⚑ Diese Schnittstellen sind REIN VIRTUELL und plattformabhaengig: einzelne
// Methoden stehen hinter `#if defined(WIN32)` oder `#if defined(__linux__)`.
// Ein `grep virtual` ueber den Kopfsatz zeigt alle und verschluckt die Waechter.
// Fehlt eine Methode, bleibt die Klasse abstrakt und uebersetzt nicht — das
// faengt der Compiler. Eine ZUVIEL (die es unter Windows nicht gibt) ergibt
// dagegen einen unverstaendlichen C2061 in einer fremden Zeile.
#pragma once
#include <string>
#include "zoom_sdk.h"
#include "auth_service_interface.h"

USING_ZOOM_SDK_NAMESPACE

class AuthListener : public IAuthServiceEvent {
 public:
  void onAuthenticationReturn(AuthResult ret) override;
  void onLoginReturnWithReason(LOGINSTATUS, IAccountInfo*, LoginFailReason) override {}
  void onLogout() override {}
  void onZoomIdentityExpired() override {}
  void onZoomAuthIdentityExpired() override {}
  void onNotificationServiceStatus(SDKNotificationServiceStatus, SDKNotificationServiceError) override {}
};
```

- [ ] **Step 2: `native/callbacks.cpp` schreiben**

```cpp
#include "callbacks.h"
#include "emit.h"

void AuthListener::onAuthenticationReturn(AuthResult ret) {
  // Nur die Zahl auf die Rohrleitung — den Namen setzt TypeScript dazu.
  emitRaw("{\"ev\":\"auth\",\"code\":" + std::to_string(static_cast<int>(ret)) + "}");
  // Fuer den Menschen, der die Rohausgabe mitliest, zusaetzlich auf stderr.
  emitLog(std::wstring(L"Anmeldung beantwortet, AuthResult=") + std::to_wstring(static_cast<int>(ret)));
}
```

- [ ] **Step 3: `sessionAuth` in `session.h`/`session.cpp` ergänzen**

In `session.h`:

```cpp
/**
 * Meldet sich mit dem fertigen JWT an. Das Ergebnis kommt ASYNCHRON ueber
 * onAuthenticationReturn — ohne laufende Nachrichtenschleife nie. Deshalb
 * meldet diese Funktion selbst nichts ausser einem Fehler beim Absetzen.
 * Das JWT wird NIRGENDS ausgegeben.
 */
void sessionAuth(const std::string& jwtUtf8);
```

In `session.cpp`, oben ergänzen:

```cpp
#include "callbacks.h"

namespace {
IAuthService* g_auth = nullptr;
AuthListener g_authListener;

std::wstring toWide(const std::string& utf8) {
  const int need = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), nullptr, 0);
  std::wstring w(static_cast<size_t>(need), L'\0');
  if (need > 0) {
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), static_cast<int>(utf8.size()), w.data(), need);
  }
  return w;
}
}  // namespace
```

Und die Funktion:

```cpp
void sessionAuth(const std::string& jwtUtf8) {
  if (!g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":7}");  // SDKERR_UNINITIALIZE
    return;
  }
  if (g_auth == nullptr) {
    const SDKError err = CreateAuthService(&g_auth);
    if (err != SDKERR_SUCCESS || g_auth == nullptr) {
      emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
      return;
    }
    g_auth->SetEvent(&g_authListener);
  }

  // Das JWT lebt nur bis zum Ende dieses Aufrufs und wird nie ausgegeben.
  const std::wstring jwt = toWide(jwtUtf8);
  AuthContext ctx;
  ctx.jwt_token = jwt.c_str();
  const SDKError err = g_auth->SDKAuth(ctx);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
  }
  // Bei Erfolg wird hier NICHTS gemeldet: die Antwort kommt asynchron.
}
```

In `sessionShutdown()` **vor** `CleanUPSDK()` einfügen:

```cpp
  if (g_auth != nullptr) {
    g_auth->SetEvent(nullptr);
    DestroyAuthService(g_auth);
    g_auth = nullptr;
  }
```

- [ ] **Step 4: `auth` in `main.cpp` verdrahten**

In `handle()`, vor der Sammelmeldung einfügen:

```cpp
  if (cmd == "auth") {
    const std::string jwt = fieldFromJson(line, "jwt");
    if (jwt.empty()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":3}");  // SDKERR_INVALID_PARAMETER
      return;
    }
    sessionAuth(jwt);
    return;
  }
```

- [ ] **Step 5: `CMakeLists.txt` ergänzen**

```cmake
add_executable(zoom-bridge
  native/main.cpp
  native/emit.cpp
  native/session.cpp
  native/callbacks.cpp
)
```

- [ ] **Step 6: Gegen die echte Anmeldung prüfen**

```powershell
$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
$env:PATH = "$env:ZOOM_SDK_DIR\x64\bin;$env:PATH"
$env:ZOOM_SDK_CREDENTIALS = "<Pfad zur Datei ausserhalb des Repos>"
npm run rebuild -w @jm/zoom-bridge

$jwt = node -e "import('./packages/zoom-bridge/src/jwt.ts').then(m=>process.stdout.write(m.buildJwt(m.readCredentials())))" --experimental-strip-types
"{`"cmd`":`"init`"}`n{`"cmd`":`"auth`",`"jwt`":`"$jwt`"}" | & .\packages\zoom-bridge\build\Release\zoom-bridge.exe
```

Erwartet auf stdout: `{"ev":"ready",…}`, dann `{"ev":"auth","code":0}`, dann `{"ev":"bye"}` (EOF beendet).
`code: 0` ist `AUTHRET_SUCCESS`. Kommt `11`, ist das JWT falsch — meist die Uhrzeit.

**Prüfen, dass kein Geheimnis austritt:**
```powershell
"{`"cmd`":`"init`"}`n{`"cmd`":`"auth`",`"jwt`":`"$jwt`"}" | & .\packages\zoom-bridge\build\Release\zoom-bridge.exe 2>&1 | Select-String -SimpleMatch $jwt
```
Erwartet: **keine Treffer**.

- [ ] **Step 7: Committen**

```bash
git add packages/zoom-bridge/native/callbacks.h packages/zoom-bridge/native/callbacks.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp packages/zoom-bridge/native/main.cpp packages/zoom-bridge/CMakeLists.txt
git status --short
git commit -m "feat(zoom-bridge): Anmeldung per JWT

Das Ergebnis kommt asynchron ueber onAuthenticationReturn — ohne laufende
Nachrichtenschleife nie. sessionAuth meldet deshalb bei Erfolg NICHTS; wer
hier eine Erfolgsmeldung setzt, meldet den Versand, nicht die Antwort.

Das JWT wird nirgends ausgegeben, weder auf stdout noch auf stderr."
```

---

### Task 7: Beitritt, Meeting-Status, Aufräumreihenfolge

**Files:**
- Modify: `packages/zoom-bridge/native/callbacks.h/.cpp` (`MeetingListener`)
- Modify: `packages/zoom-bridge/native/session.h/.cpp` (`sessionJoin`, `sessionLeave`, Abbau)
- Modify: `packages/zoom-bridge/native/main.cpp` (Befehle `join`, `leave`)

**Interfaces:**
- Consumes: `sessionAuth` aus Task 6.
- Produces: `void sessionJoin(const std::string& meetingIdUtf8, const std::string& passcodeUtf8, const std::string& displayNameUtf8);` · `void sessionLeave();` · `const char* statusName(MeetingStatus)` (unsere Namen, nicht die des SDK).

- [ ] **Step 1: `MeetingListener` in `callbacks.h` ergänzen**

```cpp
#include "meeting_service_interface.h"

/** Unsere Statusnamen. `other` ist ausdruecklich kein Verschlucken — der
 *  SDK-Rohwert geht in `raw` mit heraus. */
const char* statusName(MeetingStatus s);

class MeetingListener : public IMeetingServiceEvent {
 public:
  void onMeetingStatusChanged(MeetingStatus status, int iResult = 0) override;
  void onMeetingStatisticsWarningNotification(StatisticsWarningType) override {}
  void onMeetingParameterNotification(const MeetingParameter*) override {}
  void onSuspendParticipantsActivities() override {}
  void onAICompanionActiveChangeNotice(bool) override {}
  void onMeetingTopicChanged(const zchar_t*) override {}
  void onMeetingFullToWatchLiveStream(const zchar_t*) override {}
  void onUserNetworkStatusChanged(MeetingComponentType, ConnectionQuality, unsigned int, bool) override {}
  void onAppSignalPanelUpdated(IMeetingAppSignalHandler*) override {}
};
```

- [ ] **Step 2: `MeetingListener` in `callbacks.cpp` schreiben**

```cpp
const char* statusName(MeetingStatus s) {
  switch (s) {
    case MEETING_STATUS_IDLE:            return "idle";
    case MEETING_STATUS_CONNECTING:      return "connecting";
    // ⚑ ZWEI verschiedene Wartezustaende, die NICHT verschmelzen duerfen:
    //   WAITINGFORHOST  = das Meeting laeuft noch gar nicht -> "Meeting starten"
    //   IN_WAITING_ROOM = es laeuft, wir stehen davor       -> "Bridge einlassen"
    // Zwei verschiedene Handlungsanweisungen an den Operator.
    case MEETING_STATUS_WAITINGFORHOST:  return "waitingForHost";
    case MEETING_STATUS_IN_WAITING_ROOM: return "waitingRoom";
    case MEETING_STATUS_INMEETING:       return "inMeeting";
    case MEETING_STATUS_DISCONNECTING:   return "disconnecting";
    case MEETING_STATUS_RECONNECTING:    return "reconnecting";
    case MEETING_STATUS_FAILED:          return "failed";
    case MEETING_STATUS_ENDED:           return "ended";
    default:                             return "other";
  }
}

void MeetingListener::onMeetingStatusChanged(MeetingStatus status, int iResult) {
  // `raw` traegt den SDK-Wert immer mit — auch bei "other". Ein Status, der
  // stillschweigend verschwindet, ist eine Anzeige, die luegt.
  //
  // `code` ist iResult und bedeutet JE NACH STATUS etwas anderes: bei FAILED ein
  // MeetingFailCode, bei ENDED ein EndMeetingReason, sonst nichts Verwertbares.
  // Deshalb gehen beide Werte hinaus und ausgelegt wird erst in TypeScript.
  emitRaw(std::string("{\"ev\":\"status\",\"status\":\"") + statusName(status) +
          "\",\"raw\":" + std::to_string(static_cast<int>(status)) +
          ",\"code\":" + std::to_string(iResult) + "}");
}
```

- [ ] **Step 3: `sessionJoin`/`sessionLeave` in `session.cpp` schreiben**

Kopf ergänzen und im anonymen Namensraum:

```cpp
#include "meeting_service_interface.h"

namespace {
IMeetingService* g_meeting = nullptr;
MeetingListener g_meetingListener;
}
```

```cpp
void sessionJoin(const std::string& meetingIdUtf8, const std::string& passcodeUtf8, const std::string& displayNameUtf8) {
  if (!g_sdkUp) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":7}");  // SDKERR_UNINITIALIZE
    return;
  }
  if (g_meeting == nullptr) {
    const SDKError err = CreateMeetingService(&g_meeting);
    if (err != SDKERR_SUCCESS || g_meeting == nullptr) {
      emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
      return;
    }
    g_meeting->SetEvent(&g_meetingListener);
  }

  const UINT64 number = _strtoui64(meetingIdUtf8.c_str(), nullptr, 10);
  if (number == 0) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":3}");  // SDKERR_INVALID_PARAMETER
    return;
  }

  const std::wstring name = toWide(displayNameUtf8);
  const std::wstring psw = toWide(passcodeUtf8);

  JoinParam jp;
  jp.userType = SDK_UT_WITHOUT_LOGIN;
  JoinParam4WithoutLogin& w = jp.param.withoutloginuserJoin;
  w.meetingNumber = number;
  w.userName = name.c_str();
  w.psw = psw.empty() ? nullptr : psw.c_str();
  // Die Bridge sendet NICHTS. Sie hoert nur zu.
  w.isVideoOff = true;
  w.isAudioOff = true;

  const SDKError err = g_meeting->Join(jp);
  if (err != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"join\",\"code\":" + std::to_string(static_cast<int>(err)) + "}");
  }
  // Bei Erfolg NICHTS melden: das Ergebnis kommt als Statusfolge.
}

void sessionLeave() {
  if (g_meeting == nullptr) return;
  g_meeting->Leave(LEAVE_MEETING);
  // Erst SAUBER VERLASSEN, dann abbauen — bis zu 5 s pumpen. Ein
  // DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
  // 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
  // noch arbeitet.
  const ULONGLONG deadline = GetTickCount64() + 5000;
  while (GetTickCount64() < deadline) {
    pumpOnce();
    const MeetingStatus s = g_meeting->GetMeetingStatus();
    if (s == MEETING_STATUS_ENDED || s == MEETING_STATUS_IDLE) break;
    Sleep(20);
  }
}
```

In `sessionShutdown()`, **vor** dem Abbau des AuthService:

```cpp
  if (g_meeting != nullptr) {
    sessionLeave();
    g_meeting->SetEvent(nullptr);
    DestroyMeetingService(g_meeting);
    g_meeting = nullptr;
  }
```

- [ ] **Step 4: `join`/`leave` in `main.cpp` verdrahten**

```cpp
  if (cmd == "join") {
    sessionJoin(fieldFromJson(line, "meetingId"), fieldFromJson(line, "passcode"), fieldFromJson(line, "displayName"));
    return;
  }
  if (cmd == "leave") {
    sessionLeave();
    return;
  }
```

- [ ] **Step 5: Gegen ein echtes Meeting prüfen**

```powershell
# Meeting im Zoom-Client starten, dann:
$env:ZOOM_MEETING_ID = "<nur Ziffern>"
$env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
# JWT wie in Task 6 bauen, dann init + auth + join senden und 30 s offen lassen.
```

Erwartet: `{"ev":"status","status":"connecting",…}`, dann `{"ev":"status","status":"inMeeting","raw":…,"code":0}`. Die Bridge erscheint im Zoom-Client als Teilnehmer „JM Connect", **stumm und ohne Bild**.

Zweiter Lauf mit **falscher** Nummer: erwartet `{"ev":"status","status":"failed",…}` mit einem `code` ungleich 0 — kein Hänger.

- [ ] **Step 6: Committen**

```bash
git add packages/zoom-bridge/native/callbacks.h packages/zoom-bridge/native/callbacks.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp packages/zoom-bridge/native/main.cpp
git status --short
git commit -m "feat(zoom-bridge): Beitritt, Meeting-Status, Aufraeumreihenfolge

Zwei Wartezustaende bleiben getrennt: WAITINGFORHOST heisst Meeting starten,
IN_WAITING_ROOM heisst Bridge einlassen. Zwei verschiedene Handlungsanweisungen.

Leave pumpt bis zu 5 s weiter, bevor abgebaut wird. Ein DestroyMeetingService
waehrend CONNECTING hat den Spike mit 0xC0000005 beendet."
```

---

### Task 8: Teilnehmerliste

**Files:**
- Modify: `packages/zoom-bridge/native/callbacks.h/.cpp` (`ParticipantsListener`)
- Modify: `packages/zoom-bridge/native/session.h/.cpp` (`emitRoster`, Anbindung an `inMeeting`)

**Interfaces:**
- Consumes: `MeetingListener` aus Task 7.
- Produces: `void emitRoster();` · `std::string participantJson(IUserInfo*)` · `const char* roleName(UserRole)`.

- [ ] **Step 1: `ParticipantsListener` in `callbacks.h` ergänzen**

```cpp
#include "meeting_service_components/meeting_participants_ctrl_interface.h"

const char* roleName(UserRole r);
std::string participantJson(IUserInfo* u);

// ⚑ REIN VIRTUELL, rund 30 Methoden, drei davon hinter #if defined(WIN32).
// Fehlt eine, bleibt die Klasse abstrakt. Steht eine zu viel drin, gibt es einen
// C2061 in einer fremden Zeile. `grep virtual` zeigt alle und verschluckt die
// Waechter — im Spike hat genau das einen Uebersetzungsfehler gekostet.
class ParticipantsListener : public IMeetingParticipantsCtrlEvent {
 public:
  void onUserJoin(IList<unsigned int>* lstUserID, const zchar_t* strUserList = nullptr) override;
  void onUserLeft(IList<unsigned int>* lstUserID, const zchar_t* strUserList = nullptr) override;
  void onUserNamesChanged(IList<unsigned int>* lstUserID) override;
  void onHostChangeNotification(unsigned int) override {}
  void onLowOrRaiseHandStatusChanged(bool, unsigned int) override {}
  void onCoHostChangeNotification(unsigned int, bool) override {}
  void onInvalidReclaimHostkey() override {}
  void onAllHandsLowered() override {}
  void onLocalRecordingStatusChanged(unsigned int, RecordingStatus) override {}
  void onAllowParticipantsRenameNotification(bool) override {}
  void onAllowParticipantsUnmuteSelfNotification(bool) override {}
  void onAllowParticipantsStartVideoNotification(bool) override {}
  void onAllowParticipantsShareWhiteBoardNotification(bool) override {}
  void onRequestLocalRecordingPrivilegeChanged(LocalRecordingRequestPrivilegeStatus) override {}
  void onAllowParticipantsRequestCloudRecording(bool) override {}
  void onInMeetingUserAvatarPathUpdated(unsigned int) override {}
  void onParticipantProfilePictureStatusChange(bool) override {}
  void onFocusModeStateChanged(bool) override {}
  void onFocusModeShareTypeChanged(FocusModeShareType) override {}
  void onBotAuthorizerRelationChanged(unsigned int) override {}
  void onVirtualNameTagStatusChanged(bool, unsigned int) override {}
  void onVirtualNameTagRosterInfoUpdated(unsigned int) override {}
  void onGrantCoOwnerPrivilegeChanged(bool) override {}
#if defined(WIN32)
  void onCreateCompanionRelation(unsigned int, unsigned int) override {}
  void onRemoveCompanionRelation(unsigned int) override {}
#endif
};
```

> Sollte der Compiler „abstrakte Klasse" melden, fehlt eine Methode: die vollständige Liste steht in `meeting_participants_ctrl_interface.h` ab `class IMeetingParticipantsCtrlEvent` — dort mit den `#if`-Zeilen lesen, nicht mit `grep virtual`.

- [ ] **Step 2: `callbacks.cpp` ergänzen**

```cpp
const char* roleName(UserRole r) {
  switch (r) {
    case USERROLE_HOST:                    return "host";
    case USERROLE_COHOST:                  return "coHost";
    case USERROLE_PANELIST:                return "panelist";
    case USERROLE_BREAKOUTROOM_MODERATOR:  return "breakoutModerator";
    case USERROLE_ATTENDEE:                return "attendee";
    default:                               return "none";
  }
}

std::string participantJson(IUserInfo* u) {
  if (u == nullptr) return "";
  const zchar_t* name = u->GetUserName();
  const zchar_t* pid = u->GetPersistentId();
  std::string out = "{\"id\":" + std::to_string(u->GetUserID());
  out += ",\"name\":\"" + jsonEscape(name ? name : L"") + "\"";
  // GetPersistentId() ist ueber Wiederverbindungen stabil und wird in Stage 2
  // der Schluessel fuer die NDI-Quellennamen. Er darf leer sein.
  out += ",\"persistentId\":\"" + jsonEscape(pid ? pid : L"") + "\"";
  out += std::string(",\"self\":") + (u->IsMySelf() ? "true" : "false");
  out += std::string(",\"videoOn\":") + (u->IsVideoOn() ? "true" : "false");
  out += std::string(",\"hasCamera\":") + (u->HasCamera() ? "true" : "false");
  out += std::string(",\"inWaitingRoom\":") + (u->IsInWaitingRoom() ? "true" : "false");
  out += std::string(",\"role\":\"") + roleName(u->GetUserRole()) + "\"}";
  return out;
}
```

Die drei Rückrufe (`onUserJoin`, `onUserLeft`, `onUserNamesChanged`) rufen jeweils über die IDs und melden `joined` / `left` / `renamed`. `onUserLeft` meldet nur die ID, weil der Nutzer beim Eintreffen des Rückrufs unter Umständen nicht mehr abfragbar ist:

```cpp
void ParticipantsListener::onUserJoin(IList<unsigned int>* ids, const zchar_t*) {
  if (ids == nullptr) return;
  for (int i = 0; i < ids->GetCount(); ++i) {
    IUserInfo* u = participantsCtrl() ? participantsCtrl()->GetUserByUserID(ids->GetItem(i)) : nullptr;
    const std::string p = participantJson(u);
    if (!p.empty()) emitRaw("{\"ev\":\"joined\",\"p\":" + p + "}");
  }
}

void ParticipantsListener::onUserLeft(IList<unsigned int>* ids, const zchar_t*) {
  if (ids == nullptr) return;
  // NUR die ID: beim Eintreffen dieses Rueckrufs ist der Nutzer unter Umstaenden
  // nicht mehr abfragbar. Ein nullptr-Ergebnis waere kein Grund, das Ereignis zu
  // verschlucken — wer geht, muss gemeldet werden.
  for (int i = 0; i < ids->GetCount(); ++i) {
    emitRaw("{\"ev\":\"left\",\"id\":" + std::to_string(ids->GetItem(i)) + "}");
  }
}

void ParticipantsListener::onUserNamesChanged(IList<unsigned int>* ids) {
  if (ids == nullptr) return;
  for (int i = 0; i < ids->GetCount(); ++i) {
    IUserInfo* u = participantsCtrl() ? participantsCtrl()->GetUserByUserID(ids->GetItem(i)) : nullptr;
    if (u == nullptr) continue;
    const zchar_t* n = u->GetUserName();
    emitRaw("{\"ev\":\"renamed\",\"id\":" + std::to_string(ids->GetItem(i)) +
            ",\"name\":\"" + jsonEscape(n ? n : L"") + "\"}");
  }
}
```

`participantsCtrl()` wird in `session.h` erklärt und in `session.cpp` geschrieben (Step 3):

```cpp
// in session.h, nach den anderen Erklaerungen:
#include "meeting_service_components/meeting_participants_ctrl_interface.h"
/** Der Teilnehmer-Controller, oder nullptr wenn kein Meeting laeuft. */
IMeetingParticipantsController* participantsCtrl();
/** Vollbild der Anwesenden als ein roster-Ereignis. */
void emitRoster();
```

Und in `callbacks.h` oben `#include "session.h"` ergänzen, damit die drei Rückrufe `participantsCtrl()` sehen.

- [ ] **Step 3: `emitRoster()` in `session.cpp` schreiben und an `inMeeting` hängen**

```cpp
IMeetingParticipantsController* participantsCtrl() {
  return g_meeting ? g_meeting->GetMeetingParticipantsController() : nullptr;
}

void emitRoster() {
  IMeetingParticipantsController* ctrl = participantsCtrl();
  if (ctrl == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"roster\",\"code\":31}");  // SDKERR_NOT_IN_MEETING
    return;
  }
  IList<unsigned int>* ids = ctrl->GetParticipantsList();
  std::string out = "{\"ev\":\"roster\",\"list\":[";
  bool first = true;
  for (int i = 0; ids != nullptr && i < ids->GetCount(); ++i) {
    const std::string p = participantJson(ctrl->GetUserByUserID(ids->GetItem(i)));
    if (p.empty()) continue;
    if (!first) out += ",";
    out += p;
    first = false;
  }
  out += "]}";
  emitRaw(out);
}
```

`MeetingListener::onMeetingStatusChanged` in `callbacks.cpp` bekommt am Ende diesen Anhang. Er hängt den Teilnehmer-Rückruf ein und schickt das Vollbild — **jedes Mal**, wenn `inMeeting` erreicht wird, also auch nach einer Wiederverbindung, weil sich dabei die IDs ändern:

```cpp
  if (status == MEETING_STATUS_INMEETING) {
    IMeetingParticipantsController* ctrl = participantsCtrl();
    if (ctrl != nullptr) {
      ctrl->SetEvent(&g_participantsListener);
      emitRoster();
    }
  }
```

Dazu in `callbacks.cpp` im anonymen Namensraum:

```cpp
namespace {
ParticipantsListener g_participantsListener;
}
```

- [ ] **Step 4: Gegen ein echtes Meeting prüfen**

Wie in Task 7, aber mit mindestens zwei Personen im Meeting. Erwartet nach `inMeeting` ein `{"ev":"roster","list":[…]}` mit **echten Namen**, danach `joined`/`left`, wenn jemand kommt oder geht, und `renamed` beim Umbenennen im Zoom-Client.

- [ ] **Step 5: Committen**

```bash
git add packages/zoom-bridge/native/callbacks.h packages/zoom-bridge/native/callbacks.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp
git status --short
git commit -m "feat(zoom-bridge): Teilnehmerliste und ihre Aenderungen

roster beim Erreichen von inMeeting, danach joined/left/renamed. Ein zweites
roster nur nach einer Wiederverbindung — dabei aendern sich die IDs.

onUserLeft meldet NUR die ID: beim Eintreffen des Rueckrufs ist der Nutzer
unter Umstaenden nicht mehr abfragbar, und wer geht, muss trotzdem gemeldet
werden."
```

---

### Task 9: Aufnahme-Erlaubnis

**Files:**
- Modify: `packages/zoom-bridge/native/callbacks.h/.cpp` (`RecordingListener`)
- Modify: `packages/zoom-bridge/native/session.h/.cpp` (`checkPrivilege`)

**Interfaces:**
- Consumes: `emitRoster` aus Task 8.
- Produces: `void checkPrivilege();` — meldet `{"ev":"privilege",…}`.

- [ ] **Step 1: `RecordingListener` in `callbacks.h` ergänzen**

```cpp
#include "meeting_service_components/meeting_recording_interface.h"

class RecordingListener : public IMeetingRecordingCtrlEvent {
 public:
  void onRecordPrivilegeChanged(bool bCanRec) override;
  void onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus status) override;
  void onRecordingStatus(RecordingStatus) override {}
  void onCloudRecordingStatus(RecordingStatus) override {}
  void onRequestCloudRecordingResponse(RequestStartCloudRecordingStatus) override {}
  void onLocalRecordingPrivilegeRequested(IRequestLocalRecordingPrivilegeHandler*) override {}
  void onStartCloudRecordingRequested(IRequestStartCloudRecordingHandler*) override {}
  void onCloudRecordingStorageFull(time_t) override {}
  void onEnableAndStartSmartRecordingRequested(IRequestEnableAndStartSmartRecordingHandler*) override {}
  void onSmartRecordingEnableActionCallback(ISmartRecordingEnableActionHandler*) override {}
  // ⚑ onTranscodingStatusChanged gibt es NUR unter __linux__ — samt seinem Enum.
  //    Diese drei gibt es NUR unter WIN32. Im Spike gemessen, nicht vermutet.
#if defined(WIN32)
  void onRecording2MP4Done(bool, int, const zchar_t*) override {}
  void onRecording2MP4Processing(int) override {}
  void onCustomizedLocalRecordingSourceNotification(ICustomizedLocalRecordingLayoutHelper*) override {}
#endif
};
```

- [ ] **Step 2: `callbacks.cpp` ergänzen**

```cpp
void RecordingListener::onRecordPrivilegeChanged(bool bCanRec) {
  emitRaw(std::string("{\"ev\":\"privilege\",\"canRecordRaw\":") + (bCanRec ? "true" : "false") + "}");
}

void RecordingListener::onLocalRecordingPrivilegeRequestStatus(RequestLocalRecordingStatus status) {
  if (status == RequestLocalRecording_Granted) {
    emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":true}");
    return;
  }
  if (status == RequestLocalRecording_Denied) {
    emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":false,\"denied\":true}");
    return;
  }
  // Timeout ist KEIN Beweis fuer eine Ablehnung — es kam nur keine Antwort.
  // Deshalb ausdruecklich nicht als `denied` melden.
  emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":false,\"requested\":true}");
  emitLog(L"Keine Antwort auf die Anfrage nach lokaler Aufnahme (Zeitueberschreitung).");
}
```

- [ ] **Step 3: `checkPrivilege()` in `session.cpp` schreiben**

```cpp
void checkPrivilege() {
  if (g_meeting == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":31}");  // SDKERR_NOT_IN_MEETING
    return;
  }
  IMeetingRecordingController* rec = g_meeting->GetMeetingRecordingController();
  if (rec == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":6}");  // SDKERR_SERVICE_FAILED
    return;
  }
  rec->SetEvent(&g_recordingListener);

  const SDKError can = rec->CanStartRawRecording();
  if (can == SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":true}");
    return;
  }

  const SDKError sup = rec->IsSupportRequestLocalRecordingPrivilege();
  if (sup != SDKERR_SUCCESS) {
    // Meist: im Zoom-Portal ist die lokale Aufzeichnung nicht freigegeben.
    // Das ist ein anderer Fall als "abgelehnt" und bekommt deshalb seinen
    // eigenen Fehler statt eines privilege-Ereignisses.
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":" + std::to_string(static_cast<int>(sup)) + "}");
    return;
  }

  const SDKError req = rec->RequestLocalRecordingPrivilege();
  if (req != SDKERR_SUCCESS) {
    emitRaw("{\"ev\":\"error\",\"where\":\"privilege\",\"code\":" + std::to_string(static_cast<int>(req)) + "}");
    return;
  }
  // Steht beim Gastgeber IsAutoAllowLocalRecordingRequest() auf an, kommt die
  // Freigabe in Millisekunden zurueck — ohne dass jemand klicken muss.
  emitRaw("{\"ev\":\"privilege\",\"canRecordRaw\":false,\"requested\":true}");
}
```

In `session.h` erklären: `/** Fragt die Rohdaten-Erlaubnis ab und, wenn noetig, beim Gastgeber an. */ void checkPrivilege();`
Im anonymen Namensraum von `session.cpp`: `RecordingListener g_recordingListener;`

Und der Anhang aus Task 8 in `MeetingListener::onMeetingStatusChanged` wird um die eine Zeile erweitert:

```cpp
  if (status == MEETING_STATUS_INMEETING) {
    IMeetingParticipantsController* ctrl = participantsCtrl();
    if (ctrl != nullptr) {
      ctrl->SetEvent(&g_participantsListener);
      emitRoster();
    }
    checkPrivilege();   // <- neu in dieser Aufgabe
  }
```

**Stage 1 zeichnet nichts auf: `StartRawRecording()` steht nirgends im Quelltext.**

- [ ] **Step 4: Gegen ein echtes Meeting prüfen — beide Wege**

```powershell
# a) OHNE Freigabe im Zoom-Client
```
Erwartet: `{"ev":"privilege","canRecordRaw":false,"requested":true}`, und im Zoom-Client erscheint die Anfrage.

```powershell
# b) Anfrage im Zoom-Client bestaetigen
```
Erwartet: `{"ev":"privilege","canRecordRaw":true}`.

**Und die Gegenprobe, dass wirklich nichts aufgezeichnet wird:**
```bash
grep -rnw StartRawRecording packages/zoom-bridge/native/
```
Erwartet: **kein Aufruf** — höchstens der verneinende Kommentar in `session.h`.

> ⚑ **BERICHTIGT, GEMESSEN:** hier stand `Select-String … -SimpleMatch "StartRawRecording"`.
> Das ist eine Teilzeichenketten-Suche und schlägt deshalb auf `CanStartRawRecording()` an —
> der **Abfrage**, ob aufgezeichnet werden dürfte, die `checkPrivilege()` zu Recht benutzt.
> Zwei Umsetzer sind unabhängig voneinander darüber gestolpert und mussten den Fehlalarm
> von Hand entkräften. Ein Abnahmekriterium, das bei korrektem Code anschlägt, wird beim
> dritten Mal weggeklickt — die Wortgrenze (`-w`) trennt Abfrage von Aufnahme.

- [ ] **Step 5: Committen**

```bash
git add packages/zoom-bridge/native/callbacks.h packages/zoom-bridge/native/callbacks.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp
git status --short
git commit -m "feat(zoom-bridge): Aufnahme-Erlaubnis anfragen und melden

Fehlt die Erlaubnis und laesst sich anfragen, fragt die Bridge von selbst.
Steht beim Gastgeber IsAutoAllowLocalRecordingRequest an, kommt die Freigabe
ohne Klick zurueck.

Eine Zeitueberschreitung wird NICHT als Ablehnung gemeldet — es kam nur keine
Antwort, und das sind zwei verschiedene Aussagen.

StartRawRecording wird nirgends gerufen: Stage 1 zeichnet nichts auf."
```

---

### Task 10: `bridge.ts` — Kindprozess, Wachhund, Attrappe

**Files:**
- Create: `packages/zoom-bridge/src/bridge.ts`
- Create: `packages/zoom-bridge/src/index.ts`
- Create: `packages/zoom-bridge/test/fake-bridge.mjs`
- Modify: `packages/zoom-bridge/test/selftest.ts`

**Interfaces:**
- Consumes: alles aus `protocol.ts` und `state.ts`.
- Produces, aus `src/bridge.ts`:
  - `interface BridgeOptions { exePath?: string; exeArgs?: string[]; env?: Record<string, string>; joinTimeoutMs?: number; onEvent?: (ev: BridgeEvent, s: Session) => void; onLog?: (line: string) => void; }`
  - `class Bridge { constructor(o?: BridgeOptions); start(): Promise<void>; send(c: Command): void; get session(): Session; waitFor(pred: (s: Session) => boolean, ms: number): Promise<void>; stop(): Promise<number>; }`
  - `function binPath(): string`
- Produces, aus `src/index.ts`: `binPath(): string` · Re-Exporte von `Bridge`, `buildJwt`, `readCredentials`, `initialSession`, `reduce`, `isSettled` und den Typen.

**Der Kniff:** `exePath` ist einstellbar. Deshalb lässt sich `bridge.ts` gegen `test/fake-bridge.mjs` prüfen — eine Attrappe, die aufgezeichnete Ereigniszeilen abspielt. **Damit ist auch die Prozess-Schicht ohne SDK, ohne Compiler und ohne Meeting getestet.**

- [ ] **Step 1: `test/fake-bridge.mjs` schreiben**

```js
#!/usr/bin/env node
// Attrappe der Bridge fuer die Selbsttests. Spielt eine aufgezeichnete
// Ereignisfolge ab, damit src/bridge.ts ohne SDK, ohne Compiler und ohne
// Meeting pruefbar ist. Die Folge waehlt FAKE_SCRIPT.
const script = process.env.FAKE_SCRIPT ?? 'join';

const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

const scripts = {
  // Sauberer Ablauf.
  join: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
    say({ ev: 'roster', list: [{ id: 1, name: 'Alex', persistentId: 'p1', self: false, videoOn: true, hasCamera: true, inWaitingRoom: false, role: 'host' }] });
    say({ ev: 'privilege', canRecordRaw: true });
  },
  // DER Spike-Fall: connecting kommt sofort und dann NICHTS mehr.
  hang: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'connecting', raw: 1, code: 0 });
    // und dann Schweigen.
  },
  // Halbe Zeilen und Muell dazwischen.
  messy: () => {
    process.stdout.write('{"ev":"re');
    process.stdout.write('ady","sdkVersion":"7.1.5"}\n');
    process.stdout.write('das hier ist kein json\n');
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
  },
};

(scripts[script] ?? scripts.join)();

// Auf quit und auf EOF wie das Original reagieren.
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  if (d.includes('"quit"')) {
    say({ ev: 'bye' });
    process.exit(0);
  }
});
process.stdin.on('end', () => {
  say({ ev: 'bye' });
  process.exit(0);
});
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

An `test/selftest.ts` anhängen:

```ts
import { Bridge } from '../src/bridge.ts';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const fake = join(testDir, 'fake-bridge.mjs');

console.log('\nbridge — gegen die Attrappe:');
{
  const seen: string[] = [];
  const b = new Bridge({ exePath: process.execPath, exeArgs: [fake], env: { FAKE_SCRIPT: 'join' }, onEvent: (e) => seen.push(e.ev) });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  assert(b.session.phase === 'inMeeting', 'die Sitzung erreicht inMeeting');
  assert(b.session.participants.size === 1, 'die Teilnehmerliste ist angekommen');
  assert(b.session.canRecordRaw === true, 'die Erlaubnis ist angekommen');
  assert(seen.includes('ready') && seen.includes('roster'), 'jedes Ereignis wurde durchgereicht');
  const code = await b.stop();
  assert(code === 0, 'die Attrappe endet mit 0');
}

console.log('\nbridge — der Wachhund faengt den Haenger:');
{
  // Ohne Wachhund saehe dieser Lauf aus wie ein Netzwerkproblem — genau der
  // 90-Sekunden-Haenger aus dem Stage-0-Spike.
  const errors: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'hang' },
    joinTimeoutMs: 400,
    onEvent: (e) => {
      if (e.ev === 'error') errors.push(e);
    },
  });
  await b.start();
  b.send({ cmd: 'join', meetingId: '1', passcode: '', displayName: 'JM Connect' });
  await b.waitFor((s) => s.phase === 'error', 4000);
  assert(errors.length === 1, 'genau ein Fehler');
  assert(errors[0]?.name === 'JOIN_TIMEOUT', 'und zwar JOIN_TIMEOUT');
  assert((errors[0] as { lastStatus?: string }).lastStatus === 'connecting', 'der Fehler nennt den zuletzt gesehenen Status');
  await b.stop();
}

console.log('\nbridge — kaputte Zeilen reissen nichts ab:');
{
  const b = new Bridge({ exePath: process.execPath, exeArgs: [fake], env: { FAKE_SCRIPT: 'messy' } });
  await b.start();
  await b.waitFor((s) => s.phase === 'inMeeting', 4000);
  assert(b.session.phase === 'inMeeting', 'trotz halber Zeile und Muell wird inMeeting erreicht');
  await b.stop();
}
```

- [ ] **Step 3: Lauf zur Bestätigung, dass er fehlschlägt**

```powershell
npm run selftest -w @jm/zoom-bridge
```
Erwartet: FEHLER — `Cannot find module '../src/bridge.ts'`.

- [ ] **Step 4: `src/bridge.ts` schreiben**

```ts
// Startet zoom-bridge.exe, liest ihre Ereignisse, fuehrt die Zustandsmaschine
// und wacht ueber den Beitritt.
//
// `exePath` ist einstellbar. Genau deshalb ist diese Schicht ohne SDK pruefbar:
// die Selbsttests lassen sie gegen test/fake-bridge.mjs laufen.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LineSplitter,
  enrich,
  parseWireEvent,
  serializeCommand,
  type BridgeEvent,
  type Command,
} from './protocol.ts';
import { initialSession, isSettled, reduce, type Session } from './state.ts';

export interface BridgeOptions {
  exePath?: string;
  /** Zusaetzliche Argumente — die Selbsttests reichen hier den Pfad der Attrappe durch. */
  exeArgs?: string[];
  env?: Record<string, string>;
  /** Wie lange nach `join` auf einen ruhenden Zustand gewartet wird. */
  joinTimeoutMs?: number;
  onEvent?: (ev: BridgeEvent, s: Session) => void;
  /** Klartext der Bridge (stderr). Vorgabe: nach console.error. */
  onLog?: (line: string) => void;
}

const here = dirname(fileURLToPath(import.meta.url));

/** Wo zoom-bridge.exe nach einem Bau liegt. */
export function binPath(): string {
  return join(here, '..', 'build', 'Release', 'zoom-bridge.exe');
}

export class Bridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private splitter = new LineSplitter();
  private errSplitter = new LineSplitter();
  private state: Session = initialSession();
  private joinTimer: NodeJS.Timeout | null = null;
  private exitCode: Promise<number> | null = null;

  // ⚑ BERICHTIGT, GEMESSEN in Task 10: hier stand `constructor(private readonly
  // opts: BridgeOptions = {}) {}`. Ein TS-Konstruktorparameter-Feld braucht
  // generierten Code (`this.opts = opts;`), und `node --experimental-strip-types`
  // — die Laufzeit, mit der `npm run selftest` tatsächlich läuft — entfernt nur
  // Typen und schreibt nichts um. Ergebnis: `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`,
  // der Selbsttest startet gar nicht erst. Feld und Zuweisung darum von Hand.
  private readonly opts: BridgeOptions;

  constructor(opts: BridgeOptions = {}) {
    this.opts = opts;
  }

  get session(): Session {
    return this.state;
  }

  async start(): Promise<void> {
    const exe = this.opts.exePath ?? binPath();
    const args = this.opts.exeArgs ?? [];
    const child = spawn(exe, args, {
      env: { ...process.env, ...this.opts.env },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      for (const line of this.splitter.push(chunk)) this.handleLine(line);
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      // stderr ist Klartext fuer Menschen und geht NICHT durch den Ereignisweg.
      for (const line of this.errSplitter.push(chunk)) {
        (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(line);
      }
    });

    this.exitCode = new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? 0));
    });

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => resolve());
      child.once('error', (e) => reject(e));
    });
  }

  send(cmd: Command): void {
    if (!this.child) throw new Error('Bridge laeuft nicht.');
    if (cmd.cmd === 'join') this.armWatchdog();
    this.child.stdin.write(serializeCommand(cmd));
  }

  /**
   * ⚑ Der Wachhund laeuft NICHT gegen "irgendeine Statusaenderung": `connecting`
   * kommt sofort, und genau dort hing der Stage-0-Spike 90 Sekunden. Er laeuft
   * gegen das Erreichen eines RUHENDEN Zustands (isSettled).
   */
  private armWatchdog(): void {
    this.clearWatchdog();
    const ms = this.opts.joinTimeoutMs ?? 30_000;
    this.joinTimer = setTimeout(() => {
      this.joinTimer = null;
      if (isSettled(this.state.meeting)) return;
      // `joinTimeout`, nicht `timeout`: die Bridge kennt eine zweite Zeitueberschreitung
      // (die Anmeldung), und zwei verschiedene Ursachen duerfen nie denselben Namen
      // bekommen. Siehe OWN_ERROR_NAMES in protocol.ts.
      // ⚑ BERICHTIGT, GEMESSEN in Task 10: hier stand ein nacktes `dispatch({...}
      // as BridgeEvent)`. Das ist eine Lüge des Typsystems — `as` behauptet nur,
      // die Anreicherung habe stattgefunden. `dispatch()` erwartet ein bereits
      // ANGEREICHERTES Ereignis; jeder andere Aufrufer hält sich daran
      // (`dispatch(enrich(wire))`). Ohne `enrich()` bleibt `name` undefiniert,
      // und die Zusicherung auf `JOIN_TIMEOUT` wäre selbst bei wörtlicher
      // Übernahme rot — nachgewiesen durch Zurücknehmen und Messen.
      this.dispatch(enrich({ ev: 'error', where: 'join', code: 'joinTimeout', lastStatus: this.state.meeting } as WireEvent));
    }, ms);
    this.joinTimer.unref?.();
  }

  private clearWatchdog(): void {
    if (this.joinTimer) clearTimeout(this.joinTimer);
    this.joinTimer = null;
  }

  private handleLine(line: string): void {
    const wire = parseWireEvent(line);
    if (wire === null) {
      // Eine kaputte Zeile ist Rauschen, kein Abbruch. Sie wird gemeldet, damit
      // sie nicht unbemerkt bleibt, und dann uebersprungen.
      (this.opts.onLog ?? ((l: string) => console.error(`[zoom-bridge] ${l}`)))(`unlesbare Zeile: ${line}`);
      return;
    }
    this.dispatch(enrich(wire));
  }

  private dispatch(ev: BridgeEvent): void {
    if (ev.ev === 'status' && isSettled((ev as { status: Session['meeting'] }).status)) this.clearWatchdog();
    this.state = reduce(this.state, ev);
    this.opts.onEvent?.(ev, this.state);
  }

  /** Wartet, bis `pred` zutrifft. Wirft bei Zeitueberschreitung. */
  async waitFor(pred: (s: Session) => boolean, ms: number): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred(this.state)) {
      if (Date.now() > deadline) throw new Error('Zeitueberschreitung beim Warten auf einen Zustand.');
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async stop(): Promise<number> {
    this.clearWatchdog();
    if (!this.child) return 0;
    try {
      this.child.stdin.write(serializeCommand({ cmd: 'quit' }));
      this.child.stdin.end();
    } catch {
      /* der Prozess ist schon weg */
    }
    const code = await Promise.race([
      this.exitCode ?? Promise.resolve(0),
      // Endet die Bridge nicht von selbst, wird sie beendet — eine Bridge, die
      // in einem fremden Meeting sitzen bleibt, ist schlimmer als ein harter Abbruch.
      new Promise<number>((r) => setTimeout(() => { this.child?.kill(); r(-1); }, 8000)),
    ]);
    this.child = null;
    return code;
  }
}
```

- [ ] **Step 5: `src/index.ts` schreiben**

```ts
// Die oeffentliche Flaeche des Pakets. Was Stage 4 (Anbindung an apps/connect)
// benutzt, steht hier — und nur das.
export { Bridge, binPath, type BridgeOptions } from './bridge.ts';
export { buildJwt, readCredentials, type JwtOptions } from './jwt.ts';
export { initialSession, isSettled, reduce, type Session } from './state.ts';
export {
  normalizeMeetingId,
  sdkErrorName,
  authResultName,
  explainStatus,
  type BridgeEvent,
  type Command,
  type MeetingStatusName,
  type Participant,
  type UserRoleName,
  type WireEvent,
} from './protocol.ts';
```

- [ ] **Step 6: Tests laufen lassen**

```powershell
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```
Erwartet: alle `ok`, Rückgabewert 0 — **auf einem Rechner ohne gesetztes `ZOOM_SDK_DIR`**.

- [ ] **Step 7: Committen**

```bash
git add packages/zoom-bridge/src/bridge.ts packages/zoom-bridge/src/index.ts packages/zoom-bridge/test/fake-bridge.mjs packages/zoom-bridge/test/selftest.ts
git status --short
git commit -m "feat(zoom-bridge): Kindprozess, Wachhund und eine Attrappe zum Pruefen

exePath ist einstellbar, deshalb laeuft auch die Prozess-Schicht im Selbsttest
gegen test/fake-bridge.mjs — ohne SDK, ohne Compiler, ohne Meeting.

Der Wachhund prueft auf einen RUHENDEN Zustand, nicht auf irgendeine
Statusaenderung. Die Attrappe hat dafuer ein eigenes Drehbuch: connecting
kommt sofort und danach Schweigen — der Spike-Haenger als Testfall."
```

---

### Task 11: Prüfstand, README, Roadmap

**Files:**
- Create: `packages/zoom-bridge/test/join.mjs`
- Create: `packages/zoom-bridge/README.md`
- Modify: `docs/roadmap.md` (Stage-Tabelle, Zeile „1 · Bridge-Gerüst")

**Interfaces:**
- Consumes: `Bridge`, `buildJwt`, `readCredentials`, `normalizeMeetingId` aus `src/index.ts`.
- Produces: nichts für spätere Aufgaben.

- [ ] **Step 1: `test/join.mjs` schreiben**

```js
#!/usr/bin/env node
// Konsolen-Pruefstand: tritt einem echten Meeting bei, druckt jedes Ereignis in
// Klartext und geht wieder.
//
// ZUGANGSDATEN: kommen aus der Umgebung oder aus einer Datei AUSSERHALB des
// Repos. Meeting-Nummer und Kenncode gehoeren nirgends ins Repo, auch nicht als
// Beispiel. Der Kenncode wird nie gedruckt.
//
//   $env:ZOOM_SDK_DIR          = "…\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
//   $env:ZOOM_SDK_CREDENTIALS  = "…\zoom-credentials.json"
//   $env:ZOOM_MEETING_ID       = "830…"
//   $env:ZOOM_MEETING_PASSCODE = "…"
//   npm run join -w @jm/zoom-bridge
import { join } from 'node:path';
import { Bridge, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';

const seconds = Number(process.env.ZOOM_JOIN_SECONDS ?? '60');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) fail('ZOOM_SDK_DIR ist nicht gesetzt.');
if (!process.env.ZOOM_MEETING_ID) fail('ZOOM_MEETING_ID ist nicht gesetzt.');

let meetingId;
try {
  meetingId = normalizeMeetingId(process.env.ZOOM_MEETING_ID);
} catch (e) {
  fail(String(e.message));
}

let jwt;
try {
  jwt = buildJwt(readCredentials());
} catch (e) {
  fail(String(e.message));
}

// Die Zugangsdaten aus der Umgebung des Kindprozesses NEHMEN: die Bridge sieht
// ausschliesslich das fertige JWT. Gleiche Setzung wie im Stage-0-Spike.
const childEnv = { ...process.env, PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` };
delete childEnv.ZOOM_SDK_CLIENT_ID;
delete childEnv.ZOOM_SDK_CLIENT_SECRET;
delete childEnv.ZOOM_SDK_CREDENTIALS;

const bridge = new Bridge({
  env: childEnv,
  onEvent: (ev, s) => {
    if (ev.ev === 'status') console.log(`  Status: ${ev.status}  (${ev.explain})`);
    else if (ev.ev === 'auth') console.log(`  Anmeldung: ${ev.result}`);
    else if (ev.ev === 'ready') console.log(`  SDK: ${ev.sdkVersion}`);
    else if (ev.ev === 'roster') {
      console.log(`  Teilnehmer (${ev.list.length}):`);
      for (const p of ev.list) console.log(`    ${p.id}  ${p.name}${p.self ? '  (das sind wir)' : ''}  Rolle ${p.role}`);
    } else if (ev.ev === 'joined') console.log(`  + ${ev.p.name} (${ev.p.id})`);
    else if (ev.ev === 'left') console.log(`  - ${ev.id}`);
    else if (ev.ev === 'renamed') console.log(`  ~ ${ev.id} heisst jetzt ${ev.name}`);
    else if (ev.ev === 'privilege') {
      if (ev.canRecordRaw) console.log('  Rohdaten-Erlaubnis: JA');
      else if (ev.denied) console.log('  Rohdaten-Erlaubnis: ABGELEHNT');
      else console.log('  Rohdaten-Erlaubnis: fehlt — angefragt, bitte im Zoom-Client bestaetigen');
    } else if (ev.ev === 'error') console.log(`  FEHLER bei ${ev.where}: ${ev.name} (${ev.code})`);
  },
});

let stopping = false;
async function finish(code) {
  if (stopping) return;
  stopping = true;
  await bridge.stop();
  process.exit(code);
}

// VOR dem Start registrieren: bricht der Start ab, muss Strg+C trotzdem greifen.
process.on('SIGINT', () => {
  console.log('\nAbbruch — verlasse das Meeting …');
  void finish(bridge.session.canRecordRaw ? 0 : 3);
});

await bridge.start();
bridge.send({ cmd: 'init' });
bridge.send({ cmd: 'auth', jwt });
bridge.send({
  cmd: 'join',
  meetingId,
  passcode: process.env.ZOOM_MEETING_PASSCODE ?? '',
  displayName: process.env.ZOOM_DISPLAY_NAME ?? 'JM Connect',
});

try {
  await bridge.waitFor((s) => s.meeting === 'inMeeting' || s.phase === 'error', 45_000);
} catch {
  console.log('\nNicht ins Meeting gekommen — keine Aussage ueber die Rohdaten-Frage, sie wurde nie gestellt.');
  await finish(4);
}

if (bridge.session.phase === 'error' || bridge.session.meeting !== 'inMeeting') {
  console.log('\nNicht ins Meeting gekommen — die Rohdaten-Frage wurde nie gestellt.');
  await finish(4);
}

console.log(`\nIm Meeting. Bleibe ${seconds} s (Strg+C beendet frueher).`);
await new Promise((r) => setTimeout(r, seconds * 1000));

// Der Rueckgabewert beantwortet DIE FRAGE DIESES LAUFS, nicht die Teilfrage
// "hat der Beitritt geklappt". Ein geglueckter Beitritt ohne Erlaubnis mit 0
// zu quittieren waere genau die Sorte Luege, die dieses Werkzeug aufdecken soll.
await finish(bridge.session.canRecordRaw ? 0 : 3);
```

- [ ] **Step 2: `README.md` schreiben**

Inhalt, wörtlich diese Abschnitte:

1. **Was das ist** — natives Windows-Sidecar für JM Connect, Stage 1 von 4. **Es zeichnet nichts auf**; `StartRawRecording()` steht nirgends im Quelltext.
2. **Bauen** — `ZOOM_SDK_DIR` setzen, `npm run rebuild -w @jm/zoom-bridge`. Ohne die Variable und auf Nicht-Windows überspringt der Riegel, `npm install` bricht nicht.
3. **Prüfen ohne SDK** — `npm run selftest -w @jm/zoom-bridge` und `npm run typecheck -w @jm/zoom-bridge` laufen überall, auch auf Linux.
4. **Prüfen gegen ein echtes Meeting** — die vier Umgebungsvariablen, `npm run join -w @jm/zoom-bridge`, plus die Rückgabewert-Tabelle (`0`/`3`/`4`/`1`).
5. **Zugangsdaten** — Datei außerhalb des Repos, warum (gitleaks in CI), und dass `join.mjs` die Zugangsdaten aus der Umgebung des Kindprozesses nimmt.
6. **Das Protokoll** — Befehle und Ereignisse als Tabelle, mit dem Hinweis, dass `stdout` Maschine und `stderr` Mensch ist.
7. **Zwei Fallen, die Zeit kosten** — `ENABLE_CUSTOMIZED_UI_FLAG` (ohne sie hängt der Beitritt bei `CONNECTING`) und die `#if defined(WIN32)`-Wächter in den Rückruf-Schnittstellen (`grep virtual` verschluckt sie).
8. **Was Stage 1 nicht tut** — kein NDI, keine Rohbilder, kein Ton, keine Anbindung an `apps/connect`, kein Wiederbeitritt, kein Bündeln der DLLs.

- [ ] **Step 3: `docs/roadmap.md` aktualisieren**

Die Zeile, die mit `| **1 · Bridge-Gerüst** |` beginnt, wörtlich ersetzen durch:

```markdown
| **1 · Bridge-Gerüst** | ✅ [`packages/zoom-bridge/`](../packages/zoom-bridge/README.md) — CMake + `maybe-build.mjs`-Riegel · eigene Win32-Nachrichtenschleife · `InitSDK` mit `ENABLE_CUSTOMIZED_UI_FLAG` · Anmeldung, Meeting-Beitritt, Teilnehmerliste und Rohdaten-Erlaubnis per JSON über stdin/stdout. Zeichnet **nichts** auf. Selbsttests laufen ohne SDK, ohne Compiler, ohne Meeting. [Spec](superpowers/specs/2026-08-11-zoom-bridge-geruest-design.md) · [Plan](superpowers/plans/2026-08-11-zoom-bridge-stage1.md) | ✅ **durch** |
```

Und in der Zeile für Stage 2 den Status `| 🔵 |` durch `| 🟢 **jetzt** |` ersetzen.

- [ ] **Step 4: Den vollständigen Prüfstand laufen lassen**

```powershell
$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
$env:ZOOM_SDK_CREDENTIALS = "<Pfad ausserhalb des Repos>"
$env:ZOOM_MEETING_ID = "<nur Ziffern>"
$env:ZOOM_MEETING_PASSCODE = "<Kenncode>"
npm run join -w @jm/zoom-bridge
```

Erwartet: SDK-Fassung, `AUTHRET_SUCCESS`, Statusfolge, Teilnehmerliste **mit echten Namen**, Erlaubnis-Anfrage, nach der Freigabe `Rohdaten-Erlaubnis: JA`, Rückgabewert `0`.

Zweiter Lauf **ohne** Freigabe: Rückgabewert `3`.
Dritter Lauf mit falscher Nummer: Rückgabewert `4`, benannte Ursache, kein Hänger.
Vierter Lauf, mit Strg+C abgebrochen: die Bridge verschwindet aus dem Meeting, `Get-Process zoom-bridge` findet nichts.

- [ ] **Step 5: Committen**

```bash
git add packages/zoom-bridge/test/join.mjs packages/zoom-bridge/README.md docs/roadmap.md
git status --short
git commit -m "feat(zoom-bridge): Konsolen-Pruefstand, README, Roadmap

Die Rueckgabewerte sind bewusst dieselben wie im Stage-0-Spike (0/3/4/1),
damit Laeufe vergleichbar bleiben. Ein geglueckter Beitritt ohne Erlaubnis
wird NICHT mit 0 quittiert.

Der SIGINT-Behandler wird VOR dem Start registriert: bricht der Start ab,
muss Strg+C trotzdem greifen."
```

---

## Abnahme des gesamten Branches

1. `npm install` läuft auf Linux und auf Windows **ohne** `ZOOM_SDK_DIR` durch.
2. `npm run typecheck -w @jm/zoom-bridge` und `npm run selftest -w @jm/zoom-bridge` sind grün auf einem Rechner **ohne** SDK.
3. `npm run rebuild -w @jm/zoom-bridge` baut `zoom-bridge.exe` auf Windows mit gesetztem `ZOOM_SDK_DIR`.
4. `npm run join -w @jm/zoom-bridge` gegen ein echtes Meeting: Beitritt, Teilnehmerliste mit echten Namen, Erlaubnis nach Freigabe, Rückgabewert `0`.
5. Derselbe Lauf ohne Freigabe endet mit `3`, nicht mit `0` und nicht mit einem Absturz.
6. Ein Lauf gegen eine falsche Meeting-Nummer endet mit `4` und einer benannten Ursache.
7. Strg+C: die Bridge verschwindet aus dem Meeting und hinterlässt keinen Prozess.
8. `grep -rnw StartRawRecording packages/zoom-bridge/native/` findet **keinen Aufruf** (höchstens den verneinenden Kommentar in `session.h`). ⚑ Die Wortgrenze `-w` ist nicht kosmetisch: eine Teilzeichenketten-Suche schlägt auf `CanStartRawRecording()` an — die erlaubte **Abfrage** — und meldet damit bei völlig korrektem Code einen Fehlalarm.
9. `git status --short` zeigt keine Bauartefakte (`build/`, `sdk.lib`, `sdk.def`) und **nicht** `apps/ndi-screen-capture/resources/bin/win/jm_ndi.node`.

Punkte 4–7 sind **Owner-Schritte**: sie brauchen ein echtes Meeting und eine Freigabe von Hand.
