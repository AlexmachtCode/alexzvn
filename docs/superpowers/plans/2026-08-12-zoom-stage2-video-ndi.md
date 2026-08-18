# Zoom Stage 2 — Video je Teilnehmer als NDI-Quelle: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein abonnierter Zoom-Teilnehmer erscheint im Switcher als eigene NDI-Quelle und zeigt sein Video.

**Architecture:** `zoom-bridge.exe` (Stage 1) linkt zusätzlich das NDI-SDK und hält **einen NDI-Sender je Abo**. Das Bild geht ohne Kopie und ohne Farbraumwandlung vom Zoom-Rückruf direkt in `NDIlib_send_send_video_v2` — Zoom liefert mit `GetBuffer()` genau den zusammenhängenden I420-Puffer, den NDI erwartet. Wie in Stage 1 meldet der native Teil nur Tatsachen als JSON-Zeilen; alle Beurteilungen liegen in TypeScript und sind ohne SDK prüfbar.

**Tech Stack:** C++17 (MSVC, CMake), Zoom Meeting SDK for Windows 7.1.5.43953, NDI 6 SDK, Node ≥ 24 mit `--experimental-strip-types`, npm workspaces.

**Spec:** [`docs/superpowers/specs/2026-08-12-zoom-stage2-video-ndi-design.md`](../specs/2026-08-12-zoom-stage2-video-ndi-design.md) — bei jedem Zweifel gilt die Spec.

## Global Constraints

Diese Regeln gelten für **jede** Aufgabe, auch wenn sie dort nicht wiederholt werden.

- **Eine Ursache, ein Name.** Zwei verschiedene Ursachen bekommen nie dieselbe Meldung. Unbekannte Schlüssel werden sichtbar als `OWN_UNKNOWN(...)` bzw. `SDKERR_UNKNOWN(n)` gemeldet, nie stillschweigend zu etwas Bekanntem gerundet.
- **Nichts verschwindet still.** Keine Frist läuft wortlos ab, kein Fehler wird verschluckt, keine unlesbare Zeile reißt die Sitzung ab.
- **stdout ist Maschine, stderr ist Mensch.** Auf stdout steht ausschließlich eine JSON-Zeile je Ereignis. Klartext geht über `emitLog()` auf stderr.
- **Namen entstehen nur in `enrich()`** (`src/protocol.ts`). Auf der Leitung stehen Zahlen und Schlüssel, nie fertige Namen.
- **Zugangsdaten, Meeting-Nummern und Kenncodes gehören nirgends ins Repo** — auch nicht als Kommentarbeispiel. Platzhalter benutzen.
- **`apps/ndi-screen-capture/resources/bin/win/jm_ndi.node` niemals stagen.** Nach jedem `git add` `git status --short` lesen.
- **Kein `git add -A` und kein `git add .`** — immer ausdrückliche Pfade.
- **`packages/ndi` wird nicht angefasst** und der Switcher auch nicht.
- **Umlaute:** in Commit-Nachrichten `ue/oe/ae` schreiben; in `README.md`, Spec, Prüfstands-Ausgaben und Kommentaren echte Umlaute.
- **Jede neue Zusicherung muss als fallfähig belegt werden** (Mutationsprobe: Code brechen, Test muss rot werden, Code zurück).
- Node-Typprüfung: `--experimental-strip-types` entfernt nur Typen. **Keine TS-Konstruktorparameter-Felder** (`constructor(private readonly x)`) — das wirft `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.

## Dateistruktur

| Datei | Verantwortung |
| --- | --- |
| `native/ndi_sender.h/.cpp` *(neu)* | **Ein** NDI-Sender: öffnen, I420 senden, Schwarz senden, schließen. Kennt Zoom nicht. Hält seine eigene Sperre. |
| `native/video.h/.cpp` *(neu)* | Abo-Verwaltung: je Abo Renderer + Delegate + Sender, Namensvergabe, Zustandswechsel, Herzschlag, Umhängen. Kennt NDI-Interna nicht. |
| `native/main.cpp` | Befehle `videoSubscribe`/`videoUnsubscribe`, `videoTick()` in der Schleife, `videoShutdownAll()` vor dem Abbau. |
| `native/callbacks.cpp` | `onUserLeft` meldet zusätzlich `videoParticipantLeft()`, `onUserJoin` meldet `videoParticipantJoined()`. |
| `native/session.h/.cpp` | Neu: `sessionFindParticipant()` — Name und `persistentId` zu einer Kennung. |
| `src/protocol.ts` | Zwei Befehle, ein Ereignis, acht Fehlernamen, Auflösungsschlüssel. |
| `src/state.ts` | Abo-Buchführung im Sitzungsbild. |
| `test/fake-bridge.mjs` | Drehbücher für Video-Ereignisse. |
| `test/selftest.ts` | Zusicherungen ohne SDK. |
| `test/ndi-probe.mjs` *(neu)* | Prüft ohne Zoom, dass die Bridge einen NDI-Sender aufmacht, den man findet. |
| `test/video-limit.mjs` *(neu)* | Messlauf: wie viele gleichzeitige Abos gehen? |
| `test/join.mjs` | Abo-Bedienung im Owner-Prüfstand. |
| `CMakeLists.txt` | NDI-SDK anbinden. |
| `README.md`, `docs/roadmap.md` | Dokumentation. |

---

## Task 1: NDI in die Baukette und die Sender-Hülle

**Files:**
- Create: `packages/zoom-bridge/native/ndi_sender.h`
- Create: `packages/zoom-bridge/native/ndi_sender.cpp`
- Create: `packages/zoom-bridge/test/ndi-probe.mjs`
- Modify: `packages/zoom-bridge/CMakeLists.txt`
- Modify: `packages/zoom-bridge/native/main.cpp` (Sonderweg `--ndi-selftest`)
- Modify: `packages/zoom-bridge/package.json` (Skript `ndi-probe`)

**Interfaces:**
- Consumes: nichts aus früheren Aufgaben.
- Produces: `bool ndiInitialize()`, `void ndiShutdown()`, `class NdiSender` mit `bool open(const std::string&)`, `void sendI420(const uint8_t* buf, int w, int h)`, `void sendBlack(int w, int h)`, `void close()`.

**Hintergrund für die umsetzende Person:** Das NDI-SDK liegt unter `%NDI_SDK_DIR%` (auf diesem Rechner `C:\Program Files\NDI\NDI 6 SDK`), Header in `Include/`, Import-Bibliothek in `Lib/x64/Processing.NDI.Lib.x64.lib`. Dieselbe Konvention benutzt `packages/ndi/binding.gyp` bereits.

- [ ] **Schritt 1: CMake um das NDI-SDK erweitern**

In `CMakeLists.txt` nach dem Zoom-Block einfügen:

```cmake
if(NOT DEFINED ENV{NDI_SDK_DIR})
  message(FATAL_ERROR "NDI_SDK_DIR ist nicht gesetzt.")
endif()
file(TO_CMAKE_PATH "$ENV{NDI_SDK_DIR}" NDI_SDK_DIR)

set(NDI_HEADERS "${NDI_SDK_DIR}/Include")
if(NOT EXISTS "${NDI_HEADERS}/Processing.NDI.Lib.h")
  message(FATAL_ERROR "Processing.NDI.Lib.h nicht gefunden unter ${NDI_HEADERS}")
endif()

set(NDI_IMPLIB "${NDI_SDK_DIR}/Lib/x64/Processing.NDI.Lib.x64.lib")
if(NOT EXISTS "${NDI_IMPLIB}")
  message(FATAL_ERROR "NDI-Importbibliothek fehlt: ${NDI_IMPLIB}")
endif()
```

Dann `native/ndi_sender.cpp` in `add_executable(...)` aufnehmen und die beiden Zeilen unten ergänzen:

```cmake
target_include_directories(zoom-bridge PRIVATE "${ZOOM_HEADERS}" "${NDI_HEADERS}")
target_link_libraries(zoom-bridge PRIVATE "${ZOOM_IMPLIB}" "${NDI_IMPLIB}" user32)
```

**Warum die drei `EXISTS`-Prüfungen:** ohne sie scheitert der Bau erst beim Binden mit einer Meldung über fehlende Symbole — die sieht nach einem Codefehler aus und schickt die Suche an den falschen Ort.

- [ ] **Schritt 2: `native/ndi_sender.h` schreiben**

```cpp
#pragma once
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>
#include <Processing.NDI.Lib.h>

/**
 * Einmal je Prozess, VOR dem ersten NdiSender. Liefert false, wenn die
 * NDI-Laufzeit auf diesem Rechner nicht laeuft (fehlende Runtime-DLL).
 */
bool ndiInitialize();

/** Einmal je Prozess, NACH dem letzten NdiSender. */
void ndiShutdown();

/**
 * EIN NDI-Sender. Kennt Zoom nicht.
 *
 * ACHTUNG, WARUM DIE SPERRE: auf denselben Sender schreiben ZWEI Threads -
 * der Bild-Rueckruf des Zoom-SDK und der Schwarzbild-Herzschlag aus der
 * Hauptschleife. Die Sperre gehoert je Sender, NICHT global: zwei Abos
 * duerfen sich nicht gegenseitig ausbremsen.
 */
class NdiSender {
 public:
  NdiSender() = default;
  ~NdiSender();
  NdiSender(const NdiSender&) = delete;
  NdiSender& operator=(const NdiSender&) = delete;

  /** Legt den Sender an. false = NDIlib_send_create ist fehlgeschlagen. */
  bool open(const std::string& nameUtf8);

  /**
   * Sendet ein I420-Vollbild. `buf` zeigt auf den ZUSAMMENHAENGENDEN Puffer
   * (Y, dann U, dann V) - genau die Anordnung, die NDI erwartet.
   */
  void sendI420(const uint8_t* buf, int width, int height);

  /** Sendet ein schwarzes I420-Vollbild dieser Groesse. */
  void sendBlack(int width, int height);

  void close();

 private:
  NDIlib_send_instance_t send_ = nullptr;
  std::mutex mutex_;
  // Wiederverwendeter Schwarzpuffer - je Herzschlag neu zu belegen waere
  // 10-mal je Sekunde je Abo eine Speicheranforderung fuer immer denselben
  // Inhalt.
  std::vector<uint8_t> black_;
  int blackW_ = 0;
  int blackH_ = 0;
};
```

- [ ] **Schritt 3: `native/ndi_sender.cpp` schreiben**

```cpp
#include "ndi_sender.h"
#include "emit.h"

bool ndiInitialize() { return NDIlib_initialize(); }
void ndiShutdown() { NDIlib_destroy(); }

NdiSender::~NdiSender() { close(); }

bool NdiSender::open(const std::string& nameUtf8) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (send_) return true;
  NDIlib_send_create_t desc;
  desc.p_ndi_name = nameUtf8.c_str();
  desc.p_groups = nullptr;
  desc.clock_video = false;   // Zoom taktet, nicht wir
  desc.clock_audio = false;
  send_ = NDIlib_send_create(&desc);
  return send_ != nullptr;
}

namespace {
// Fuellt einen I420-Puffer mit Schwarz.
//
// WARUM Y=16 UND NICHT Y=0: 16/128/128 ist Schwarz im BEGRENZTEN
// Wertebereich (der Rundfunk-Konvention, die NDI fuer I420 annimmt). Y=0
// waere dort "schwaerzer als schwarz" - ein unzulaessiger Wert, den
// Empfaenger unterschiedlich behandeln. Liefert Zoom wider Erwarten den
// VOLLEN Wertebereich (IsLimitedI420() == false), erscheint 16 als sehr
// dunkles Grau statt als Schwarz - sichtbar, aber harmlos. Der umgekehrte
// Fehler waere schlimmer.
void fillBlackI420(std::vector<uint8_t>& buf, int w, int h) {
  const size_t ySize = static_cast<size_t>(w) * h;
  const size_t cSize = ySize / 4;
  buf.assign(ySize + 2 * cSize, 0);
  std::fill(buf.begin(), buf.begin() + ySize, static_cast<uint8_t>(16));
  std::fill(buf.begin() + ySize, buf.end(), static_cast<uint8_t>(128));
}

void fillFrame(NDIlib_video_frame_v2_t& f, const uint8_t* buf, int w, int h) {
  f.xres = w;
  f.yres = h;
  f.FourCC = NDIlib_FourCC_video_type_I420;
  f.frame_rate_N = 30000;
  f.frame_rate_D = 1001;
  f.picture_aspect_ratio = 0.0f;  // 0 = aus xres/yres ableiten
  f.frame_format_type = NDIlib_frame_format_type_progressive;
  f.timecode = NDIlib_send_timecode_synthesize;
  f.p_data = const_cast<uint8_t*>(buf);
  // Bei I420 ist das der Zeilenabstand der Y-Ebene.
  f.line_stride_in_bytes = w;
  f.p_metadata = nullptr;
}
}  // namespace

void NdiSender::sendI420(const uint8_t* buf, int width, int height) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_ || !buf || width <= 0 || height <= 0) return;
  NDIlib_video_frame_v2_t f;
  fillFrame(f, buf, width, height);
  // Kehrt erst zurueck, wenn der Puffer ausgelesen ist - deshalb duerfen
  // wir Zooms Puffer direkt durchreichen, ohne AddRef().
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::sendBlack(int width, int height) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_ || width <= 0 || height <= 0) return;
  if (blackW_ != width || blackH_ != height) {
    fillBlackI420(black_, width, height);
    blackW_ = width;
    blackH_ = height;
  }
  NDIlib_video_frame_v2_t f;
  fillFrame(f, black_.data(), width, height);
  NDIlib_send_send_video_v2(send_, &f);
}

void NdiSender::close() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!send_) return;
  NDIlib_send_destroy(send_);
  send_ = nullptr;
}
```

- [ ] **Schritt 4: Sonderweg `--ndi-selftest` in `main.cpp`**

Ganz am Anfang von `main()`, **vor** dem stdin-Leser. Signatur von `main()` dafür auf `int main(int argc, char** argv)` ändern.

```cpp
  // Diagnose-Sonderweg: baut NUR einen NDI-Sender auf, schickt zwei Sekunden
  // Schwarz und geht. Ohne Zoom, ohne Meeting, ohne Anmeldung. Beantwortet
  // die Frage "traegt NDI auf diesem Rechner ueberhaupt?" getrennt von allem
  // anderen - ohne diesen Weg waere ein NDI-Problem von einem Zoom-Problem
  // erst nach dem Beitritt zu unterscheiden.
  if (argc > 1 && std::string(argv[1]) == "--ndi-selftest") {
    if (!ndiInitialize()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"ndiInitFailed\"}");
      return 1;
    }
    NdiSender s;
    if (!s.open("JM Connect – Zoom Selbsttest")) {
      emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"videoSenderFailed\"}");
      ndiShutdown();
      return 1;
    }
    emitRaw("{\"ev\":\"ndiSelftest\",\"state\":\"sending\"}");
    for (int i = 0; i < 60; ++i) {
      s.sendBlack(640, 360);
      Sleep(33);
    }
    s.close();
    ndiShutdown();
    emitRaw("{\"ev\":\"ndiSelftest\",\"state\":\"done\"}");
    return 0;
  }
```

`#include "ndi_sender.h"` und `#include <string>` sind in `main.cpp` zu ergänzen.

- [ ] **Schritt 5: Prüfstand `test/ndi-probe.mjs` schreiben**

```js
#!/usr/bin/env node
// Prueft OHNE Zoom, OHNE Meeting und OHNE Anmeldung, dass die Bridge einen
// NDI-Sender aufmacht, den ein anderer Prozess auch FINDET. Sucht mit dem
// bestehenden Addon aus packages/ndi - das ist ein unabhaengiger Zeuge:
// derselbe Code, mit dem der Switcher seine Quellen findet.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';

const require = createRequire(import.meta.url);
const ndi = require('@jm/ndi');

const ERWARTET = 'JM Connect – Zoom Selbsttest';

const child = spawn(binPath(), ['--ndi-selftest'], { windowsHide: true });
child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => process.stdout.write(`  bridge: ${d}`));
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => process.stderr.write(`  [bridge] ${d}`));

// Der Sender sendet zwei Sekunden. Innerhalb dieser Zeit mehrfach suchen:
// NDI-Erkennung im Netz braucht ein paar hundert Millisekunden.
let gefunden = false;
for (let i = 0; i < 8 && !gefunden; i++) {
  for (const s of ndi.findSources(250)) {
    if (String(s).includes(ERWARTET)) gefunden = true;
  }
}

await new Promise((r) => child.on('exit', r));

if (gefunden) {
  console.log(`\nOK — die Quelle "${ERWARTET}" war im Netz auffindbar.`);
  process.exit(0);
}
console.error(`\nFEHLGESCHLAGEN — die Quelle "${ERWARTET}" wurde nicht gefunden.`);
process.exit(1);
```

In `package.json` unter `scripts` ergänzen: `"ndi-probe": "node test/ndi-probe.mjs"`.

- [ ] **Schritt 6: Bauen und den Prüfstand laufen lassen**

```powershell
$env:ZOOM_SDK_DIR = "<Pfad zum entpackten Zoom-Meeting-SDK>"
npm run rebuild -w @jm/zoom-bridge
npm run ndi-probe -w @jm/zoom-bridge
```

Erwartet: `OK — die Quelle "JM Connect – Zoom Selbsttest" war im Netz auffindbar.` und Rückgabewert 0.

- [ ] **Schritt 7: Mutationsprobe**

`desc.p_ndi_name` versuchsweise auf `"Falscher Name"` setzen, neu bauen, `npm run ndi-probe` — muss **fehlschlagen**. Danach zurückändern und erneut prüfen, dass es besteht. Das belegt, dass der Prüfstand den Namen wirklich prüft und nicht bloß den Prozessstart.

- [ ] **Schritt 8: Commit**

```bash
git add packages/zoom-bridge/CMakeLists.txt packages/zoom-bridge/native/ndi_sender.h packages/zoom-bridge/native/ndi_sender.cpp packages/zoom-bridge/native/main.cpp packages/zoom-bridge/test/ndi-probe.mjs packages/zoom-bridge/package.json
git status --short
git commit -m "feat(zoom-bridge): NDI in die Baukette, Sender-Huelle und ein Pruefstand dafuer"
```

---

## Task 2: Protokoll und Zustand (ohne SDK prüfbar)

**Files:**
- Modify: `packages/zoom-bridge/src/protocol.ts`
- Modify: `packages/zoom-bridge/src/state.ts`
- Modify: `packages/zoom-bridge/test/fake-bridge.mjs`
- Modify: `packages/zoom-bridge/test/selftest.ts`

**Interfaces:**
- Consumes: nichts aus Task 1 (reine TypeScript-Seite).
- Produces: `Command`-Varianten `{ cmd: 'videoSubscribe'; id: number; resolution?: VideoResolutionKey }` und `{ cmd: 'videoUnsubscribe'; id: number }`; `WireEvent`-Variante `video`; `VideoResolutionKey`; `Session.videoSubs: Map<number, VideoSub>`; acht neue Einträge in `OWN_ERROR_NAMES`.

- [ ] **Schritt 1: Zuerst die fehlschlagenden Zusicherungen schreiben**

An das Ende von `test/selftest.ts` anfügen (die Namen `assert`, `Bridge`, `fake`, `enrich`, `reduce`, `initialSession` sind dort bereits im Gebrauch):

```ts
console.log('\nprotocol — Video: Auflösungsschlüssel:');
{
  assert(VIDEO_RESOLUTIONS.includes('720p'), '720p ist ein gültiger Schlüssel');
  assert(!VIDEO_RESOLUTIONS.includes('480p'), '480p ist KEIN gültiger Schlüssel — Zoom kennt es nicht');
}

console.log('\nprotocol — Video: jede Ursache hat ihren eigenen Namen:');
{
  const namen = [
    'videoNoPrivilege', 'videoUnknownParticipant', 'videoAlreadySubscribed',
    'videoNotSubscribed', 'videoRendererFailed', 'videoSenderFailed',
    'videoBadResolution', 'videoBufferMismatch', 'ndiInitFailed',
  ].map((k) => (enrich({ ev: 'error', where: 'video', code: k } as WireEvent) as { name: string }).name);
  assert(new Set(namen).size === namen.length, 'neun Ursachen, neun verschiedene Namen');
  assert(!namen.some((n) => n.startsWith('OWN_UNKNOWN')), 'keiner faellt auf OWN_UNKNOWN zurueck');
  const fremd = enrich({ ev: 'error', where: 'video', code: 'videoWasAuchImmer' } as WireEvent);
  assert(
    (fremd as { name: string }).name === 'OWN_UNKNOWN(videoWasAuchImmer)',
    'ein unbekannter Schluessel wird SICHTBAR unbekannt, nicht stillschweigend gerundet',
  );
}

console.log('\nstate — Video: Abo-Buchführung:');
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'subscribed', source: 'JM Connect – Zoom Anna', reason: 'command', rebindable: true } as WireEvent));
  assert(s.videoSubs.get(7)?.state === 'subscribed', 'ein Abo wird gebucht');
  assert(s.videoSubs.get(7)?.source === 'JM Connect – Zoom Anna', 'der vergebene Name wird festgehalten');

  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'live', source: 'JM Connect – Zoom Anna', reason: 'frames', rebindable: true, rotation: 0, limitedRange: true } as WireEvent));
  assert(s.videoSubs.get(7)?.state === 'live', 'der Zustand folgt dem Ereignis');
  assert(s.videoSubs.get(7)?.rotation === 0, 'die gemessene Drehung wird festgehalten');

  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'black', source: 'JM Connect – Zoom Anna', reason: 'cameraOff', rebindable: true } as WireEvent));
  assert(s.videoSubs.get(7)?.reason === 'cameraOff', 'die URSACHE wird getrennt vom Zustand gefuehrt');

  s = reduce(s, enrich({ ev: 'video', id: 7, state: 'unsubscribed', source: 'JM Connect – Zoom Anna', reason: 'command', rebindable: true } as WireEvent));
  assert(!s.videoSubs.has(7), 'ein abgebautes Abo verschwindet aus der Buchfuehrung');
}

console.log('\nstate — Video: derselbe Zustand, zwei verschiedene Ursachen:');
{
  // Der eigentliche Prueffall: "black" allein sagt NICHT, ob jemand die
  // Kamera zugedeckt hat oder aus dem Meeting geflogen ist.
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 1, state: 'black', source: 'A', reason: 'cameraOff', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 2, state: 'black', source: 'B', reason: 'participantLeft', rebindable: false } as WireEvent));
  assert(s.videoSubs.get(1)?.state === s.videoSubs.get(2)?.state, 'beide stehen auf demselben Zustand');
  assert(s.videoSubs.get(1)?.reason !== s.videoSubs.get(2)?.reason, 'aber die Ursachen bleiben unterscheidbar');
}

console.log('\nstate — Video: Umhängen behält denselben Sender:');
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'video', id: 10, state: 'live', source: 'JM Connect – Zoom Bo', reason: 'frames', rebindable: true } as WireEvent));
  s = reduce(s, enrich({ ev: 'video', id: 10, state: 'black', source: 'JM Connect – Zoom Bo', reason: 'participantLeft', rebindable: true } as WireEvent));
  // 'subscribed', nicht 'live': beim Umhaengen sind noch keine Bilder da —
  // genau das meldet der native Teil (Task 6).
  s = reduce(s, enrich({ ev: 'video', id: 11, state: 'subscribed', source: 'JM Connect – Zoom Bo', reason: 'rebound', rebindable: true } as WireEvent));
  assert(!s.videoSubs.has(10), 'die alte Kennung ist weg');
  assert(s.videoSubs.get(11)?.source === 'JM Connect – Zoom Bo', 'der Quellenname bleibt derselbe — der Switcher merkt nichts');
}

console.log('\nbridge — Video: ein Abo über die Attrappe:');
{
  const evs: BridgeEvent[] = [];
  const b = new Bridge({
    exePath: process.execPath,
    exeArgs: [fake],
    env: { FAKE_SCRIPT: 'video' },
    onEvent: (e) => { if (e.ev === 'video') evs.push(e); },
  });
  await b.start();
  b.send({ cmd: 'videoSubscribe', id: 42, resolution: '720p' });
  await b.waitFor((s) => s.videoSubs.get(42)?.state === 'live', 4000);
  assert(evs.length >= 2, 'erst subscribed, dann live — beide Schritte sind sichtbar');
  assert(evs[0]?.state === 'subscribed', 'der erste Schritt ist subscribed');
  await b.stop();
}
```

- [ ] **Schritt 2: Laufen lassen und den Fehlschlag sehen**

```powershell
npm run selftest -w @jm/zoom-bridge
```

Erwartet: **Fehlschlag** mit `VIDEO_RESOLUTIONS is not defined` bzw. `videoSubs` undefined.

- [ ] **Schritt 3: `src/protocol.ts` erweitern**

```ts
export const VIDEO_RESOLUTIONS = ['90p', '180p', '360p', '720p', '1080p'] as const;
export type VideoResolutionKey = (typeof VIDEO_RESOLUTIONS)[number];

export type VideoState = 'subscribed' | 'live' | 'black' | 'unsubscribed';
export type VideoReason = 'command' | 'frames' | 'cameraOff' | 'participantLeft' | 'rebound' | 'bufferMismatch';
```

`Command` um zwei Varianten erweitern:

```ts
  | { cmd: 'videoSubscribe'; id: number; resolution?: VideoResolutionKey }
  | { cmd: 'videoUnsubscribe'; id: number }
```

`WireEvent` um eine Variante erweitern:

```ts
  // "rotation" und "limitedRange" FEHLEN, solange kein Bild kam (bei
  // state:"subscribed" also immer). Ein Wert waere dort erfunden - und eine
  // erfundene 0 liesse sich spaeter nicht von einer gemessenen 0
  // unterscheiden.
  | {
      ev: 'video';
      id: number;
      state: VideoState;
      source: string;
      reason: VideoReason;
      rebindable: boolean;
      rotation?: number;
      limitedRange?: boolean;
    }
```

`OWN_ERROR_NAMES` um acht Einträge erweitern — jeder mit einem Kommentar, **warum** er ein eigener Name ist:

```ts
  // Rohvideo haengt an derselben Aufnahme-Erlaubnis, die Stage 1 einholt. Ein
  // Abo ohne sie STILL zuzulassen waere die schlimmere Variante: die Quelle
  // bliebe fuer immer schwarz und saehe aus wie "Gast hat die Kamera aus".
  videoNoPrivilege: 'VIDEO_NO_PRIVILEGE',
  videoUnknownParticipant: 'VIDEO_UNKNOWN_PARTICIPANT',
  videoAlreadySubscribed: 'VIDEO_ALREADY_SUBSCRIBED',
  videoNotSubscribed: 'VIDEO_NOT_SUBSCRIBED',
  // Zoom-Seite: createRenderer/subscribe lieferte einen SDK-Fehler.
  videoRendererFailed: 'VIDEO_RENDERER_FAILED',
  // NDI-Seite: NDIlib_send_create schlug fehl. AUSDRUECKLICH ein anderer Name
  // als videoRendererFailed - die beiden schicken die Suche an
  // verschiedene Orte.
  videoSenderFailed: 'VIDEO_SENDER_FAILED',
  videoBadResolution: 'VIDEO_BAD_RESOLUTION',
  // GetBufferLen() passt nicht zu Breite*Hoehe*3/2. Der Puffer wird geprueft,
  // nicht geglaubt: ein falsch ausgelegter I420-Puffer erzeugt ein Bild, das
  // wie ein Kameradefekt aussieht - man sucht dann am falschen Ende.
  videoBufferMismatch: 'VIDEO_BUFFER_MISMATCH',
  // NDIlib_initialize() schlug fehl - die NDI-Laufzeit fehlt auf diesem
  // Rechner. WIEDER eine eigene Ursache: weder ein Zoom-Fehler noch ein
  // fehlgeschlagener EINZELNER Sender, sondern "auf dieser Maschine geht NDI
  // gar nicht". Wer das mit videoSenderFailed verschmelzen wuerde, schickte
  // die Suche zu einem Abo statt zur Installation.
  ndiInitFailed: 'NDI_INIT_FAILED',
```

**Anmerkung zum Ereignis `ndiSelftest` aus Task 1:** es steht bewusst **nicht** in `WireEvent`. Es entsteht nur auf dem Diagnose-Sonderweg `--ndi-selftest`, den ausschließlich `test/ndi-probe.mjs` liest, und nie im regulären Betrieb. `parseWireEvent()` lässt unbekannte `ev`-Werte durch und `reduce()` ignoriert sie — es verschwindet also nichts still.

- [ ] **Schritt 4: `src/state.ts` erweitern**

```ts
export interface VideoSub {
  state: VideoState;
  source: string;
  reason: VideoReason;
  rebindable: boolean;
  rotation?: number;
  limitedRange?: boolean;
}
```

`Session` um `videoSubs: Map<number, VideoSub>` erweitern, in `initialSession()` mit `new Map()` belegen, und in `reduce()` den Fall ergänzen:

```ts
    case 'video': {
      const e = ev as {
        id: number; state: VideoState; source: string; reason: VideoReason;
        rebindable: boolean; rotation?: number; limitedRange?: boolean;
      };
      const videoSubs = new Map(s.videoSubs);
      if (e.state === 'unsubscribed') {
        videoSubs.delete(e.id);
      } else {
        // Beim Umhaengen (reason 'rebound') traegt das Ereignis die NEUE
        // Kennung; die alte muss verschwinden, sonst bliebe eine Karteileiche
        // stehen, auf die nie wieder ein Ereignis kommt. Der Quellenname ist
        // der Faden, an dem die alte Kennung haengt - der Sender ist
        // derselbe geblieben.
        if (e.reason === 'rebound') {
          for (const [id, sub] of videoSubs) {
            if (sub.source === e.source && id !== e.id) videoSubs.delete(id);
          }
        }
        videoSubs.set(e.id, {
          state: e.state, source: e.source, reason: e.reason,
          rebindable: e.rebindable, rotation: e.rotation, limitedRange: e.limitedRange,
        });
      }
      return { ...s, videoSubs };
    }
```

- [ ] **Schritt 5: Attrappen-Drehbuch `video` in `test/fake-bridge.mjs`**

```js
  // Ein Abo, wie es der native Teil meldet: erst steht der Sender, dann
  // fliessen Bilder. Wartet auf den Befehl, damit die Reihenfolge stimmt.
  video: () => {
    say({ ev: 'ready', sdkVersion: '7.1.5 (attrappe)' });
    say({ ev: 'auth', code: 0 });
    say({ ev: 'status', status: 'inMeeting', raw: 3, code: 0 });
    say({ ev: 'privilege', canRecordRaw: true, source: 'requestAnswer' });
    process.stdin.on('data', (d) => {
      const s = String(d);
      if (s.includes('"videoSubscribe"')) {
        say({ ev: 'video', id: 42, state: 'subscribed', source: 'JM Connect – Zoom Attrappe', reason: 'command', rebindable: true });
        say({ ev: 'video', id: 42, state: 'live', source: 'JM Connect – Zoom Attrappe', reason: 'frames', rebindable: true, rotation: 0, limitedRange: true });
      }
      if (s.includes('"videoUnsubscribe"')) {
        say({ ev: 'video', id: 42, state: 'unsubscribed', source: 'JM Connect – Zoom Attrappe', reason: 'command', rebindable: true });
      }
    });
  },
```

- [ ] **Schritt 6: Prüfen**

```powershell
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
```

Erwartet: alle Zusicherungen bestehen, Typprüfung sauber.

- [ ] **Schritt 7: Mutationsprobe für jede neue Zusicherung**

Mindestens diese drei brechen und den roten Test sehen, danach zurück:
1. In `reduce()` `videoSubs.delete(e.id)` beim Umhängen entfernen → „die alte Kennung ist weg" muss rot werden.
2. In `reduce()` `reason` nicht mitschreiben → „die URSACHE wird getrennt vom Zustand gefuehrt" muss rot werden.
3. `videoSenderFailed` und `videoRendererFailed` auf denselben Namen legen → „acht Ursachen, acht verschiedene Namen" muss rot werden.

- [ ] **Schritt 8: Commit**

```bash
git add packages/zoom-bridge/src/protocol.ts packages/zoom-bridge/src/state.ts packages/zoom-bridge/test/fake-bridge.mjs packages/zoom-bridge/test/selftest.ts
git status --short
git commit -m "feat(zoom-bridge): Protokoll und Zustand fuer Video-Abos"
```

---

## Task 3: Abo-Verwaltung nativ — anlegen und abbauen

**Files:**
- Create: `packages/zoom-bridge/native/video.h`
- Create: `packages/zoom-bridge/native/video.cpp`
- Modify: `packages/zoom-bridge/native/session.h`, `native/session.cpp` (`sessionFindParticipant`)
- Modify: `packages/zoom-bridge/native/main.cpp` (zwei Befehle)
- Modify: `packages/zoom-bridge/CMakeLists.txt` (`native/video.cpp`)

**Interfaces:**
- Consumes: `NdiSender`, `ndiInitialize()` (Task 1); die Ereignis- und Fehlerschlüssel aus Task 2 **wortgleich**.
- Produces: `bool videoParseResolution(const std::string&, ZoomSDKResolution*)`, `void videoSubscribe(unsigned int userId, ZoomSDKResolution res)`, `void videoUnsubscribe(unsigned int userId)`, `void videoShutdownAll()`, `bool sessionFindParticipant(unsigned int userId, std::wstring* name, std::string* persistentId)`.

**In dieser Aufgabe fließen noch KEINE Bilder** — der Delegate empfängt sie, verwirft sie aber. Das ist Absicht: Anlegen und Abbauen sind für sich prüfbar (die Quelle erscheint und verschwindet im Netz), und der Bildweg bekommt in Task 4 seine eigene Prüfung.

- [ ] **Schritt 0: Zwei Helfer, die es noch nicht gibt**

**(a) `emit.h/.cpp`: UTF-8 herauslösen statt danebenlegen.** Heute gibt es nur
`jsonEscape(const std::wstring&)`, und die Wandlung nach UTF-8 steckt in seinem Rumpf. `video.cpp` braucht
beides getrennt: den UTF-8-Namen für `NDIlib_send_create` (dessen `p_ndi_name` ist `const char*`) und die
Maskierung für die JSON-Zeile. Also **herauslösen, nicht verdoppeln**:

```cpp
// emit.h
std::string toUtf8(const std::wstring& s);
std::string jsonEscapeUtf8(const std::string& utf8);
std::string jsonEscape(const std::wstring& s);   // bleibt, ruft jetzt die beiden oben
```

In `emit.cpp` den bestehenden `jsonEscape()`-Rumpf in die zwei neuen Funktionen aufteilen und
`jsonEscape()` zu `return jsonEscapeUtf8(toUtf8(s));` machen. Das Verhalten bleibt Byte für Byte gleich —
die vorhandenen Zusicherungen müssen unverändert bestehen.

**(b) `session.h/.cpp`: den Stand der Erlaubnis merken.** Der native Teil **meldet** die Erlaubnis heute an
vier Stellen (`callbacks.cpp:141`, `:154`, `:158`, `session.cpp:407`), **merkt sie sich aber nicht**. Ohne
gespeicherten Stand kann `videoSubscribe()` die Voraussetzung gar nicht prüfen.

```cpp
// session.h
/** Der ZULETZT gemeldete Stand der Rohdaten-Erlaubnis. */
bool sessionCanRecordRaw();
```

Dazu ein `std::atomic<bool> g_canRecordRaw{false}` in `session.cpp` und eine Setzfunktion, die an **allen
vier** Melde-Stellen mitgeführt wird. **Atomar, nicht `bool`:** gesetzt wird auf dem SDK-Rückruf-Thread,
gelesen beim Abo-Befehl auf dem Hauptthread.

**Achtung, dieselbe Falle wie bei `privilegeTimedOut` in Stage 1:** der Stand spiegelt **immer** die
zuletzt gemeldete Antwort, wird also auch wieder auf `false` gesetzt, wenn der Gastgeber die Erlaubnis
entzieht (`onRecordPrivilegeChanged(false)`). Ein Merkzeichen, das nur in eine Richtung kippt, behauptet
eine Erlaubnis, die es nicht mehr gibt.

- [ ] **Schritt 1: `sessionFindParticipant()` in `session.h/.cpp`**

Deklaration in `session.h`:

```cpp
/**
 * Name und persistentId zu einer Teilnehmerkennung. false = die Kennung
 * steht nicht (mehr) in der Teilnehmerliste.
 *
 * `persistentId` KANN LEER SEIN - Zoom liefert sie fuer nicht angemeldete
 * Gaeste nicht immer. Wer darauf ein Versprechen baut (Umhaengen nach einem
 * Wiederbeitritt), muss den leeren Fall ausdruecklich behandeln.
 */
bool sessionFindParticipant(unsigned int userId, std::wstring* nameOut, std::string* persistentIdOut);
```

In `session.cpp` über den bereits vorhandenen Teilnehmer-Regler (`IMeetingParticipantsController`) umsetzen — dieselbe Quelle, aus der die Teilnehmerliste gebaut wird. Bei `nullptr`-Regler oder unbekannter Kennung `false` liefern, **nicht** einen leeren Namen als Erfolg.

- [ ] **Schritt 2: `native/video.h` schreiben**

```cpp
#pragma once
#include <string>
#include "zoom_sdk.h"
#include "rawdata/rawdata_renderer_interface.h"

USING_ZOOM_SDK_NAMESPACE

/** Wandelt "720p" in ZoomSDKResolution_720P. false = unbekannter Schluessel. */
bool videoParseResolution(const std::string& key, ZoomSDKResolution* out);

/**
 * Abonniert das Video eines Teilnehmers und legt dafuer einen NDI-Sender an.
 * Meldet Erfolg und jeden Fehlschlag SELBST auf stdout - der Aufrufer
 * bekommt keinen Rueckgabewert, den er vergessen koennte.
 */
void videoSubscribe(unsigned int userId, ZoomSDKResolution res);

/** Baut ein Abo ab. Meldet ebenfalls selbst. */
void videoUnsubscribe(unsigned int userId);

/**
 * Baut ALLE Abos ab. MUSS vor sessionLeave() laufen - ein laufender
 * Renderer haelt eine Referenz auf den Meeting-Dienst.
 */
void videoShutdownAll();
```

- [ ] **Schritt 3: `native/video.cpp` — Abo-Bündel und Namensvergabe**

Kernstück; der Delegate bleibt in dieser Aufgabe absichtlich stumm:

```cpp
#include "video.h"
#include <map>
#include <memory>
#include "emit.h"
#include "ndi_sender.h"
#include "rawdata/zoom_rawdata_api.h"
#include "session.h"

namespace {

struct Sub;
std::map<unsigned int, std::unique_ptr<Sub>> g_subs;

class Delegate : public IZoomSDKRendererDelegate {
 public:
  explicit Delegate(Sub* owner) : owner_(owner) {}
  void onRendererBeDestroyed() override {}
  void onRawDataFrameReceived(YUVRawDataI420* data) override;   // Task 4
  void onRawDataStatusChanged(RawDataStatus status) override;   // Task 4
 private:
  Sub* owner_;
};

struct Sub {
  unsigned int userId = 0;
  std::string persistentId;
  std::string source;          // der TATSAECHLICH vergebene NDI-Name
  ZoomSDKResolution res = ZoomSDKResolution_720P;
  IZoomSDKRenderer* renderer = nullptr;
  std::unique_ptr<Delegate> delegate;
  NdiSender sender;
};

// Der Name steht bei subscribe FEST und folgt keiner Umbenennung: einen
// NDI-Sender umzubenennen hiesse, ihn abzubauen und neu aufzubauen - die
// Quelle waere mitten in der Sendung weg.
//
// KEIN DOPPELPUNKT nach "Zoom" - gemessen am 13.08.2026 gegen die echte
// NDI-Laufzeit: sie ersetzt ':' durch ein Leerzeichen, "Zoom:" haette also
// ein DOPPELTES Leerzeichen hinterlassen. Aus derselben Messung: NDI stellt
// jedem Namen den RECHNERNAMEN in Klammern voran - was im Switcher steht,
// ist "RECHNERNAME (JM Connect – Zoom Anna)". Wer auf den Namen prueft,
// prueft darum auf Teilzeichenketten, nie auf Gleichheit.
std::string uniqueSourceName(const std::wstring& displayName) {
  const std::string base = "JM Connect – Zoom " + toUtf8(displayName);
  std::string name = base;
  int n = 2;
  bool belegt = true;
  while (belegt) {
    belegt = false;
    for (const auto& [id, sub] : g_subs) {
      if (sub->source == name) { belegt = true; break; }
    }
    if (belegt) name = base + " (" + std::to_string(n++) + ")";
  }
  return name;
}

void emitVideo(const Sub& s, const char* state, const char* reason) {
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") + "}");
}

void emitVideoError(const char* code) {
  emitRaw(std::string("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"") + code + "\"}");
}

}  // namespace

bool videoParseResolution(const std::string& key, ZoomSDKResolution* out) {
  if (key == "90p")   { *out = ZoomSDKResolution_90P;   return true; }
  if (key == "180p")  { *out = ZoomSDKResolution_180P;  return true; }
  if (key == "360p")  { *out = ZoomSDKResolution_360P;  return true; }
  if (key == "720p")  { *out = ZoomSDKResolution_720P;  return true; }
  if (key == "1080p") { *out = ZoomSDKResolution_1080P; return true; }
  return false;
}

void videoSubscribe(unsigned int userId, ZoomSDKResolution res) {
  if (g_subs.count(userId)) { emitVideoError("videoAlreadySubscribed"); return; }
  // Die Erlaubnis ist Voraussetzung, kein Wunsch (siehe Spec Abschnitt 5).
  if (!sessionCanRecordRaw()) { emitVideoError("videoNoPrivilege"); return; }

  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) {
    emitVideoError("videoUnknownParticipant");
    return;
  }

  auto sub = std::make_unique<Sub>();
  sub->userId = userId;
  sub->persistentId = persistentId;
  sub->res = res;
  sub->source = uniqueSourceName(name);
  sub->delegate = std::make_unique<Delegate>(sub.get());

  if (!sub->sender.open(sub->source)) { emitVideoError("videoSenderFailed"); return; }

  SDKError err = createRenderer(&sub->renderer, sub->delegate.get());
  if (err != SDKERR_SUCCESS || sub->renderer == nullptr) {
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }
  sub->renderer->setRawDataResolution(res);
  err = sub->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  if (err != SDKERR_SUCCESS) {
    destroyRenderer(sub->renderer);
    sub->sender.close();
    emitVideoError("videoRendererFailed");
    return;
  }

  Sub* raw = sub.get();
  g_subs[userId] = std::move(sub);
  emitVideo(*raw, "subscribed", "command");
}

void videoUnsubscribe(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) { emitVideoError("videoNotSubscribed"); return; }
  Sub* s = it->second.get();
  emitVideo(*s, "unsubscribed", "command");
  // REIHENFOLGE IST TRAGEND: erst den Renderer abmelden und abbauen, DANN
  // den Sender schliessen. Andersherum koennte ein Bild-Rueckruf, der schon
  // unterwegs ist, auf einen bereits abgebauten Sender schreiben.
  if (s->renderer) { s->renderer->unSubscribe(); destroyRenderer(s->renderer); }
  s->sender.close();
  g_subs.erase(it);
}

void videoShutdownAll() {
  for (auto& [id, s] : g_subs) {
    if (s->renderer) { s->renderer->unSubscribe(); destroyRenderer(s->renderer); }
    s->sender.close();
  }
  g_subs.clear();
}
```

`toUtf8()`, `jsonEscapeUtf8()` und `sessionCanRecordRaw()` stammen aus Schritt 0 dieser Aufgabe. `source` wird bewusst als **UTF-8-`std::string`** geführt: `NDIlib_send_create` verlangt ohnehin `const char*`, und zwei Darstellungen desselben Namens nebeneinander wären eine Fehlerquelle ohne Gegenwert.

- [ ] **Schritt 4: Befehle in `main.cpp` verdrahten**

In `handle()`, vor der Abweisung unbekannter Befehle:

```cpp
  if (cmd == "videoSubscribe") {
    const std::string idText = fieldFromJson(line, "id");
    const std::string resKey = fieldFromJson(line, "resolution");
    ZoomSDKResolution res = ZoomSDKResolution_720P;   // Vorgabe laut Spec
    if (!resKey.empty() && !videoParseResolution(resKey, &res)) {
      emitRaw("{\"ev\":\"error\",\"where\":\"video\",\"code\":\"videoBadResolution\"}");
      return;
    }
    videoSubscribe(static_cast<unsigned int>(std::stoul(idText)), res);
    return;
  }
  if (cmd == "videoUnsubscribe") {
    videoUnsubscribe(static_cast<unsigned int>(std::stoul(fieldFromJson(line, "id"))));
    return;
  }
```

**Achtung:** `std::stoul` wirft bei leerer oder nicht-numerischer Eingabe. Die Eingabe kommt von außen — vor dem Aufruf prüfen, ob `idText` nicht leer ist und nur aus Ziffern besteht, sonst `videoUnknownParticipant` melden. Eine geworfene Ausnahme beendete den Prozess und wäre genau das stille Verschwinden, das dieses Vorhaben ausschließt.

Im `init`-Zweig von `handle()`, **nach** `sessionInit()`:

```cpp
    // NDI erst nach geglueckter SDK-Initialisierung: schlaegt schon Zoom
    // fehl, ist eine NDI-Meldung nur Rauschen ueber dem eigentlichen Fehler.
    if (g_sdkInitialized && !ndiInitialize()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"ndi\",\"code\":\"ndiInitFailed\"}");
      emitLog(L"NDIlib_initialize() fehlgeschlagen - laeuft die NDI-Laufzeit auf diesem Rechner?");
    }
```

`ndiShutdown()` ganz am Ende von `main()`, **nach** `sessionShutdown()` und **vor** dem `return`. Auf dem `TerminateProcess`-Zweig (nicht beruhigter Abbau) **entfällt** es — dort wird der Prozess ohnehin hart beendet, und ein weiterer Aufruf auf halb abgeräumtem Zustand wäre genau das Risiko, das dieser Zweig vermeidet.

- [ ] **Schritt 5: `native/video.cpp` in `CMakeLists.txt` aufnehmen, bauen**

```powershell
npm run rebuild -w @jm/zoom-bridge
```

- [ ] **Schritt 6: Gegen ein echtes Meeting prüfen**

Mit `test/join.mjs` beitreten (Anleitung in `README.md` Abschnitt 4), dann von Hand eine Abo-Zeile schicken. Erwartet: `{"ev":"video",…,"state":"subscribed",…}` und die Quelle taucht in `ndi.findSources()` auf. Nach `videoUnsubscribe` verschwindet sie wieder.

- [ ] **Schritt 7: Commit**

```bash
git add packages/zoom-bridge/native/video.h packages/zoom-bridge/native/video.cpp packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp packages/zoom-bridge/native/main.cpp packages/zoom-bridge/CMakeLists.txt
git status --short
git commit -m "feat(zoom-bridge): Video-Abos anlegen und abbauen, je Abo ein NDI-Sender"
```

---

## Task 4: Der Bildweg

**Files:**
- Modify: `packages/zoom-bridge/native/video.cpp` (Delegate)

**Interfaces:**
- Consumes: `Sub`, `emitVideo()`, `NdiSender::sendI420()`.
- Produces: fließende Bilder; `video`-Ereignisse mit `rotation` und `limitedRange`.

- [ ] **Schritt 1: `onRawDataFrameReceived` umsetzen**

```cpp
void Delegate::onRawDataFrameReceived(YUVRawDataI420* data) {
  if (!data || !owner_) return;
  const int w = static_cast<int>(data->GetStreamWidth());
  const int h = static_cast<int>(data->GetStreamHeight());
  const uint8_t* buf = reinterpret_cast<const uint8_t*>(data->GetBuffer());

  // DER PUFFER WIRD GEPRUEFT, NICHT GEGLAUBT. NDI erwartet die drei Ebenen
  // ZUSAMMENHAENGEND (Y, dann U, dann V) in EINEM Puffer - GetBuffer()
  // verspricht genau das, aber ein Zeilenabstand mit Auffuellung oder eine
  // andere Anordnung wuerde ein Bild erzeugen, das wie ein Kameradefekt
  // aussieht. Man suchte dann am falschen Ende.
  const size_t erwartet = static_cast<size_t>(w) * h * 3 / 2;
  if (!buf || w <= 0 || h <= 0 || data->GetBufferLen() != erwartet) {
    if (!owner_->mismatchGemeldet) {
      // EINMAL je Abo, nicht je Bild: 30 Meldungen je Sekunde ertraenkten
      // jede andere Ausgabe.
      owner_->mismatchGemeldet = true;
      emitVideoError("videoBufferMismatch");
      owner_->reason = "bufferMismatch";
    }
    return;   // das Abo bleibt bestehen und faellt ueber den Herzschlag auf Schwarz
  }

  owner_->lastFrameMs = GetTickCount64();
  owner_->lastW = w;
  owner_->lastH = h;
  owner_->sender.sendI420(buf, w, h);

  // Erst beim ERSTEN brauchbaren Bild sind rotation und limitedRange
  // gemessen - vorher waeren sie erfunden.
  const unsigned int rot = data->GetRotation();
  const bool limited = data->IsLimitedI420();
  if (owner_->state != "live" || owner_->rotation != rot || owner_->limitedRange != limited) {
    owner_->rotation = rot;
    owner_->limitedRange = limited;
    owner_->state = "live";
    emitVideoMeasured(*owner_, "live", "frames", rot, limited);
  }
}
```

`Sub` um diese Felder erweitern:

```cpp
  bool mismatchGemeldet = false;
  ULONGLONG lastFrameMs = 0;     // 0 = noch nie ein Bild gesehen
  ULONGLONG lastBlackMs = 0;     // wird in Task 5 gebraucht
  int lastW = 0;
  int lastH = 0;
  std::string state = "subscribed";
  std::string reason = "command";
  unsigned int rotation = 0;
  bool limitedRange = true;
  bool gemessen = false;         // ob rotation/limitedRange je ein Bild gesehen haben
```

Und `emitVideoMeasured()` neben `emitVideo()` in denselben anonymen Namensraum:

```cpp
// Wie emitVideo(), aber MIT den beiden gemessenen Feldern. Zwei getrennte
// Funktionen statt einer mit Schaltern: rotation und limitedRange duerfen
// erst auftauchen, wenn ein Bild sie geliefert hat (Spec Abschnitt 5). Eine
// erfundene 0 liesse sich spaeter nicht von einer gemessenen 0 unterscheiden.
void emitVideoMeasured(const Sub& s, const char* state, const char* reason,
                       unsigned int rotation, bool limitedRange) {
  emitRaw(std::string("{\"ev\":\"video\",\"id\":") + std::to_string(s.userId) +
          ",\"state\":\"" + state + "\",\"source\":\"" + jsonEscapeUtf8(s.source) +
          "\",\"reason\":\"" + reason +
          "\",\"rebindable\":" + (s.persistentId.empty() ? "false" : "true") +
          ",\"rotation\":" + std::to_string(rotation) +
          ",\"limitedRange\":" + (limitedRange ? "true" : "false") + "}");
}
```

Im Rumpf oben wird `owner_->gemessen` beim ersten brauchbaren Bild auf `true` gesetzt; die Bedingung für das Ereignis lautet damit `!owner_->gemessen || owner_->state != "live" || owner_->rotation != rot || owner_->limitedRange != limited`.

**Warum nicht bei jedem Bild ein Ereignis:** 30 Ereignisse je Sekunde je Abo wären kein Protokoll mehr, sondern Rauschen. Gemeldet wird nur der **Wechsel**.

- [ ] **Schritt 2: `onRawDataStatusChanged` umsetzen**

```cpp
void Delegate::onRawDataStatusChanged(RawDataStatus status) {
  if (!owner_) return;
  if (status == RawData_Off) {
    owner_->state = "black";
    owner_->reason = "cameraOff";
    emitVideo(*owner_, "black", "cameraOff");
  }
  // RawData_On erzeugt hier ABSICHTLICH kein Ereignis: dass das SDK Video
  // ankuendigt, heisst noch nicht, dass Bilder ankommen. "live" wird beim
  // ersten wirklich empfangenen Bild gemeldet - eine Ankuendigung ist keine
  // Messung.
}
```

- [ ] **Schritt 3: Bauen und gegen ein echtes Meeting prüfen**

Erwartet: Quelle zeigt den Gast im Switcher. Kamera aus → `state: black, reason: cameraOff`. Kamera an → `state: live, reason: frames`.

**Festhalten** (die Spec verlangt es): welchen Wert `limitedRange` liefert und ob `rotation` je von 0 abweicht.

- [ ] **Schritt 4: Commit**

```bash
git add packages/zoom-bridge/native/video.cpp
git status --short
git commit -m "feat(zoom-bridge): Bildweg ohne Kopie von Zoom nach NDI"
```

---

## Task 5: Der Schwarzbild-Herzschlag

**Files:**
- Modify: `packages/zoom-bridge/native/video.h`, `native/video.cpp` (`videoTick`)
- Modify: `packages/zoom-bridge/native/main.cpp` (Aufruf in der Schleife)

**Interfaces:**
- Produces: `void videoTick();`

- [ ] **Schritt 0: Die Sperre von `Sub` benutzen**

**Konstruktionsmangel des Plans, in Aufgabe 4 gemeldet und dort behoben.** Der Bild-Rückruf läuft auf
einem SDK-Thread und schreibt `lastFrameMs`, `lastW`, `lastH`, `state`, `reason`, `rotation`,
`limitedRange`, `gemessen`, `mismatchGemeldet`. `videoTick()` läuft auf dem **Hauptthread** und liest
und schreibt dieselben Felder. Der ursprüngliche Plan sah nur die Sperre für den NDI-Sender vor und
vergaß die Buchführung — bei den `std::string`-Feldern wäre das nicht bloß ein logischer Wettlauf,
sondern möglicherweise ein Absturz.

Aufgabe 4 hat deshalb jedem `Sub` eine **eigene** `std::mutex` gegeben. `videoTick()` hält sich an
dieselbe Disziplin:

- Die Sperre schützt **nur den Feldzugriff**, nie den Sendeaufruf.
- Sie wird **niemals über `sender.sendBlack(...)` gehalten** — `NdiSender` hat seine eigene Sperre, und
  zwei ineinander gehaltene Sperren sind eine Verschränkung, die man später schwer wieder auflöst. Also:
  unter der Sperre entscheiden und die Werte lokal herausziehen, Sperre freigeben, **dann** senden.
- Eine Sperre je Abo, keine globale: zwei Abos dürfen sich nicht gegenseitig ausbremsen.

- [ ] **Schritt 1: `videoTick()` umsetzen**

```cpp
void videoTick() {
  const ULONGLONG jetzt = GetTickCount64();
  for (auto& [id, s] : g_subs) {
    // 200 ms Nachlauf: bei kurzen Aussetzern soll NICHT zwischen Bild und
    // Schwarz geflackert werden. Erst danach gilt der Strom als still.
    if (s->lastFrameMs != 0 && jetzt - s->lastFrameMs < 200) continue;
    // Hoechstens alle 100 ms, also 10 Bilder je Sekunde. Das haelt die
    // Quelle fuer jeden Empfaenger gueltig und kostet fast nichts.
    if (jetzt - s->lastBlackMs < 100) continue;
    s->lastBlackMs = jetzt;
    // Vor dem ersten Bild ist die Bildgroesse unbekannt - dann die
    // NENNGROESSE des Abos nehmen, damit die Quelle von Anfang an gueltig
    // ist statt erst nach dem ersten Bild.
    const int w = s->lastW > 0 ? s->lastW : nominalWidth(s->res);
    const int h = s->lastH > 0 ? s->lastH : nominalHeight(s->res);
    s->sender.sendBlack(w, h);
    if (s->state != "black") {
      s->state = "black";
      if (s->reason != "bufferMismatch") s->reason = "cameraOff";
      emitVideo(*s, "black", s->reason.c_str());
    }
  }
}
```

`nominalWidth`/`nominalHeight` als kleine Umsetzung der fünf Auflösungen ergänzen (90P = 160×90, 180P = 320×180, 360P = 640×360, 720P = 1280×720, 1080P = 1920×1080). `Sub` um `ULONGLONG lastBlackMs = 0;` erweitern.

- [ ] **Schritt 2: In die Hauptschleife hängen**

In `main.cpp` direkt nach `pumpOnce()`:

```cpp
    videoTick();
```

**Warum hier und nicht in einem eigenen Thread:** die Schleife tickt bereits alle 10 ms. Ein eigener Thread wäre ein zweiter Schreiber mehr, ein weiteres Abbau-Problem und kein einziger gewonnener Vorteil.

- [ ] **Schritt 3: Bauen, gegen ein echtes Meeting prüfen**

Kamera aus → die Quelle bleibt im Switcher und wird schwarz statt einzufrieren. Umschalten auf die Quelle ergibt sauberes Schwarz.

- [ ] **Schritt 4: Commit**

```bash
git add packages/zoom-bridge/native/video.h packages/zoom-bridge/native/video.cpp packages/zoom-bridge/native/main.cpp
git status --short
git commit -m "feat(zoom-bridge): Schwarzbild-Herzschlag haelt die Quelle am Leben"
```

---

## Task 6: Wiederbeitritt und Weggehen

**Files:**
- Modify: `packages/zoom-bridge/native/video.h`, `native/video.cpp`
- Modify: `packages/zoom-bridge/native/callbacks.cpp`

**Interfaces:**
- Produces: `void videoParticipantLeft(unsigned int userId);`, `void videoParticipantJoined(unsigned int userId);`
- Consumes: `sessionFindParticipant()` aus Task 3 — `onUserJoin` liefert **nur** Kennungen (`IList<unsigned int>*`), die `persistentId` muss nachgeschlagen werden.

- [ ] **Schritt 1: Beide Funktionen umsetzen**

```cpp
void videoParticipantLeft(unsigned int userId) {
  auto it = g_subs.find(userId);
  if (it == g_subs.end()) return;
  Sub* s = it->second.get();
  // Das Abo bleibt bestehen - die Quelle darf im Livebetrieb nicht
  // wegbrechen (Spec Abschnitt 3). Der Herzschlag haelt sie schwarz.
  if (s->renderer) { s->renderer->unSubscribe(); }
  s->state = "black";
  s->reason = "participantLeft";
  emitVideo(*s, "black", "participantLeft");
}

// onUserJoin liefert NUR Kennungen, keine persistentId - die muss aus der
// Teilnehmerliste kommen.
void videoParticipantJoined(unsigned int userId) {
  std::wstring name;
  std::string persistentId;
  if (!sessionFindParticipant(userId, &name, &persistentId)) return;

  // Eine LEERE persistentId kann NIEMANDEN wiedererkennen: zwei verschiedene
  // Gaeste haetten beide "" und wuerden aufeinander umgehaengt - aus einem
  // Wiederbeitritt wuerde eine Personenverwechslung auf Sendung. Genau
  // deshalb meldet das Ereignis in diesem Fall rebindable:false, statt eine
  // Zusicherung vorzutaeuschen, die nicht traegt.
  if (persistentId.empty()) return;

  // ERST SUCHEN, DANN UMHAENGEN - in zwei getrennten Schritten. extract()
  // mitten in der Schleife macht den Laufzeiger ungueltig; der Fehler faellt
  // beim Ausprobieren nicht auf und schlaegt spaeter zufaellig zu.
  unsigned int alteId = 0;
  bool gefunden = false;
  for (const auto& [id, s] : g_subs) {
    if (id != userId && s->persistentId == persistentId) { alteId = id; gefunden = true; break; }
  }
  if (!gefunden) return;

  auto knoten = g_subs.extract(alteId);
  Sub* s = knoten.mapped().get();
  // DERSELBE Sender bleibt bestehen - fuer den Switcher ist nichts passiert,
  // was er merken muesste. Genau das ist der Zweck des Umhaengens.
  s->userId = userId;
  s->state = "subscribed";
  s->reason = "rebound";
  s->lastFrameMs = 0;
  s->gemessen = false;
  s->mismatchGemeldet = false;
  if (s->renderer) {
    // ERST abmelden: das alte Abo haengt noch an der TOTEN Kennung. Ein
    // subscribe() auf einen bereits abonnierten Renderer liefert einen
    // SDK-Fehler statt umzuschalten.
    s->renderer->unSubscribe();
    s->renderer->subscribe(userId, RAW_DATA_TYPE_VIDEO);
  }
  knoten.key() = userId;
  g_subs.insert(std::move(knoten));
  emitVideo(*s, "subscribed", "rebound");
}
```

- [ ] **Schritt 2: In `callbacks.cpp` aufrufen**

In `onUserLeft` (`callbacks.cpp:112`) zusätzlich `videoParticipantLeft(id)` je weggegangener Kennung, in `onUserJoin` (`:103`) zusätzlich `videoParticipantJoined(id)`. Die bestehenden `left`/`joined`-Ereignisse bleiben **unverändert** — die Teilnehmerliste ist eine andere Frage als das Abo und darf nicht mit ihm verschmelzen.

**Reihenfolge in `onUserJoin`:** erst das bestehende `joined`-Ereignis senden, **dann** `videoParticipantJoined()`. Sonst stünde ein `video`-Ereignis mit `reason: "rebound"` für eine Kennung auf der Leitung, die der Leser noch gar nicht kennt.

- [ ] **Schritt 3: Bauen und prüfen**

Gast verlässt das Meeting → Quelle bleibt, wird schwarz, `reason: participantLeft`. Gast kommt zurück → `reason: rebound`, dieselbe Quelle wird wieder lebendig. **Oder** es wird gemessen, dass die `persistentId` das nicht trägt — dann diese Messung festhalten, statt sie zu beschönigen.

- [ ] **Schritt 4: Commit**

```bash
git add packages/zoom-bridge/native/video.h packages/zoom-bridge/native/video.cpp packages/zoom-bridge/native/callbacks.cpp
git status --short
git commit -m "feat(zoom-bridge): Abo ueberlebt einen Wiederbeitritt, Weggehen laesst die Quelle stehen"
```

---

## Task 7: Abbau-Reihenfolge

**Files:**
- Modify: `packages/zoom-bridge/native/main.cpp`
- Modify: `packages/zoom-bridge/native/session.cpp` (nur Kommentar, falls die Reihenfolge dort dokumentiert ist)

- [ ] **Schritt 0: `videoShutdownAll()` auch im `leave`-Befehl**

**Planlücke, beim Umsetzen von Aufgabe 3 gemeldet und nachgemessen.** `video.h`s eigener Doc-Kommentar
verlangt „MUSS vor `sessionLeave()` laufen" — aber der `leave`-**Befehl** in `handle()` ruft
`sessionLeave()` direkt auf, ohne die Abos abzuräumen. Wer `videoSubscribe` schickt und dann `leave`,
lässt lebende Renderer eine Referenz auf den Meeting-Dienst halten, während das Meeting endet. Das ist
dieselbe Fehlerklasse, die in Stage 1 als `0xC0000005` gemessen wurde. Der Prozessende-Weg unten deckt
das **nicht** ab: er läuft nur bei `quit`/EOF.

```cpp
  if (cmd == "leave") {
    // TRAGENDE REIHENFOLGE, dieselbe wie unten beim Prozessende: erst alle
    // Abos, DANN das Meeting verlassen. Ein laufender Renderer haelt eine
    // Referenz auf den Meeting-Dienst.
    videoShutdownAll();
    sessionLeave();
    return;
  }
```

**Warum abbauen und nicht bloss stehen lassen:** nach einem `leave` gibt es die Teilnehmer nicht mehr,
auf die die Renderer abonniert sind. Ein Abo, das ein Meeting überlebt, hätte niemanden mehr, dessen Bild
es tragen könnte — und der Bediener abonniert nach einem erneuten Beitritt ohnehin neu.

- [ ] **Schritt 1: `videoShutdownAll()` vor `sessionShutdown()` einhängen**

In `main.cpp`, unmittelbar vor `const bool shutdownComplete = sessionShutdown();`:

```cpp
  // TRAGENDE REIHENFOLGE: erst alle Abos, DANN der Sitzungsabbau. Ein
  // laufender Renderer haelt eine Referenz auf den Meeting-Dienst - ihn nach
  // DestroyMeetingService abzubauen hiesse, auf abgeraeumten Zustand
  // zuzugreifen. Das ist dieselbe Fehlerklasse, die in Aufgabe 7 von Stage 1
  // als 0xC0000005 gemessen wurde.
  videoShutdownAll();
```

`ndiShutdown()` kommt **nach** `sessionShutdown()`, unmittelbar vor dem `return`.

- [ ] **Schritt 2: Prüfen, dass keine Quelle zurückbleibt**

Mit zwei Abos beitreten, Strg+C, danach:

```powershell
node -e "const n=require('@jm/ndi');console.log(n.findSources(1500).filter(s=>String(s).includes('JM Connect')))"
Get-Process zoom-bridge -ErrorAction SilentlyContinue
```

Erwartet: **leere** Liste und **kein** Prozess. Beides ist Abnahmekriterium, kein Wunsch.

- [ ] **Schritt 3: Commit**

```bash
git add packages/zoom-bridge/native/main.cpp
git status --short
git commit -m "fix(zoom-bridge): Abos vor dem Sitzungsabbau schliessen"
```

---

## Task 8: Prüfstände, Messlauf und Dokumentation

**Files:**
- Create: `packages/zoom-bridge/test/video-limit.mjs`
- Modify: `packages/zoom-bridge/test/join.mjs`
- Modify: `packages/zoom-bridge/package.json`
- Modify: `packages/zoom-bridge/README.md`
- Modify: `docs/roadmap.md`

- [ ] **Schritt 1: `test/join.mjs` um die Abo-Bedienung erweitern**

`video`-Ereignisse ausgeben (Zustand, Ursache, vergebener Name, und — sobald vorhanden — `rotation`/`limitedRange`). Über `ZOOM_VIDEO_SUBSCRIBE` (kommagetrennte Kennungen) nach dem Beitritt abonnieren; ohne die Variable verhält sich der Prüfstand genau wie bisher.

- [ ] **Schritt 2: `test/video-limit.mjs` schreiben — der Messlauf**

```js
#!/usr/bin/env node
// Messlauf: wie viele gleichzeitige Video-Abos laesst das Zoom-SDK zu?
// Diese Zahl steht in KEINEM Header. Sie zu schaetzen waere eine Behauptung.
//
// Umgebung wie test/join.mjs. Zusaetzlich noetig: ein Meeting mit MEHREREN
// Teilnehmern, deren Kameras an sind - die Grenze laesst sich nur mit echten
// Teilnehmern messen, denn ein Teilnehmer laesst sich nicht zweimal
// abonnieren (das waere videoAlreadySubscribed und wuerde nichts messen).
import { join } from 'node:path';
import { Bridge, buildJwt, normalizeMeetingId, readCredentials } from '../src/index.ts';

const sdk = process.env.ZOOM_SDK_DIR;
if (!sdk) { console.error('ZOOM_SDK_DIR ist nicht gesetzt.'); process.exit(1); }

const fehler = [];
const bridge = new Bridge({
  env: { PATH: `${join(sdk, 'x64', 'bin')};${process.env.PATH}` },
  envRemove: ['ZOOM_SDK_CLIENT_ID', 'ZOOM_SDK_CLIENT_SECRET', 'ZOOM_SDK_CREDENTIALS'],
  onEvent: (ev) => {
    if (ev.ev === 'error' && ev.where === 'video') fehler.push(ev);
    if (ev.ev === 'video') console.log(`  ${ev.id}: ${ev.state} (${ev.reason})`);
  },
});

await bridge.start();
bridge.send({ cmd: 'init' });
bridge.send({ cmd: 'auth', jwt: buildJwt(readCredentials()) });
await bridge.waitFor((s) => s.phase === 'authed' || s.phase === 'error', 30_000);
bridge.send({
  cmd: 'join',
  meetingId: normalizeMeetingId(process.env.ZOOM_MEETING_ID ?? ''),
  passcode: process.env.ZOOM_MEETING_PASSCODE ?? '',
  displayName: process.env.ZOOM_DISPLAY_NAME ?? 'JM Connect',
});
await bridge.waitFor((s) => s.meeting === 'inMeeting', 45_000);
await bridge.waitFor((s) => s.canRecordRaw, 60_000);

// Nur FREMDE Teilnehmer: uns selbst zu abonnieren misst nichts ueber die
// Grenze und liefert je nach SDK-Fassung ohnehin kein Bild.
const andere = [...bridge.session.participants.values()].filter((p) => !p.self);
console.log(`\n${andere.length} fremde Teilnehmer im Meeting.\n`);

let gelungen = 0;
let abbruchGrund = null;
for (const p of andere) {
  const vorher = fehler.length;
  bridge.send({ cmd: 'videoSubscribe', id: p.id, resolution: '720p' });
  try {
    await bridge.waitFor(
      (s) => s.videoSubs.get(p.id)?.state === 'live' || fehler.length > vorher,
      5000,
    );
  } catch {
    abbruchGrund = `keine Bilder innerhalb von 5 s (Abo ${gelungen + 1})`;
    break;
  }
  if (fehler.length > vorher) {
    const f = fehler[fehler.length - 1];
    abbruchGrund = `${f.name}${f.detail ? ` (${f.detail})` : ''}`;
    break;
  }
  gelungen++;
}

console.log(
  abbruchGrund
    ? `\nGemessen: ${gelungen} gleichzeitige Abos erfolgreich, das ${gelungen + 1}. scheiterte an ${abbruchGrund}.`
    : `\nGemessen: ${gelungen} gleichzeitige Abos erfolgreich — die Grenze wurde NICHT erreicht (` +
      `es waren nur ${andere.length} Teilnehmer da). Fuer eine echte Obergrenze braucht es mehr Teilnehmer.`,
);

await bridge.stop();
process.exit(0);
```

**Der letzte Satz ist der wichtige.** Reichen die Teilnehmer nicht aus, um die Grenze zu finden, sagt der Lauf das **ausdrücklich**, statt die erreichte Zahl als Obergrenze auszugeben. Eine Untergrenze als Obergrenze zu melden wäre genau die Sorte Messfehler, die dieses Vorhaben schon einmal Zeit gekostet hat.

In `package.json` ergänzen: `"video-limit": "node test/video-limit.mjs"`.

- [ ] **Schritt 3: `README.md` erweitern**

Neuer Abschnitt zwischen dem Protokoll und den Fallen: die zwei Befehle, das `video`-Ereignis mit allen Feldern, die acht Fehlernamen, der Herzschlag samt seinen zwei Zahlen (200 ms Nachlauf, höchstens alle 100 ms), die Namensvergabe samt Kollisionszusatz, die Abbau-Reihenfolge. In den Fallen-Abschnitt aufnehmen: `GetBufferLen()` wird geprüft, nicht geglaubt — und warum.

- [ ] **Schritt 4: `docs/roadmap.md`**

Zeile „2 · Video → NDI" auf `🟡 Code fertig, Owner-Abnahme offen` setzen (die Legende führt diesen Zustand seit Stage 1).

- [ ] **Schritt 5: Alle Tore laufen lassen**

```powershell
npm run selftest -w @jm/zoom-bridge
npm run typecheck -w @jm/zoom-bridge
npm run rebuild -w @jm/zoom-bridge
npm run ndi-probe -w @jm/zoom-bridge
```

- [ ] **Schritt 6: Commit**

```bash
git add packages/zoom-bridge/test/video-limit.mjs packages/zoom-bridge/test/join.mjs packages/zoom-bridge/package.json packages/zoom-bridge/README.md docs/roadmap.md
git status --short
git commit -m "feat(zoom-bridge): Pruefstaende, Messlauf und Dokumentation fuer Stage 2"
```

---

## Owner-Abnahme (nach Task 8, gegen ein echtes Meeting)

Die acht Läufe aus Abschnitt 10 der Spec. Zwei Werte sind dabei **festzuhalten**, weil sie heute niemand kennt: was `IsLimitedI420()` liefert und ob `GetRotation()` je von 0 abweicht. Ergibt der Messlauf eine niedrige Grenze für gleichzeitige Abos, gehört sie in `README.md` und in die Roadmap — eine gemessene Grenze ist eine Tatsache, die Stage 4 kennen muss.
