# Zoom Stage 3: Ton je Teilnehmer — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Ton eines abonnierten Zoom-Teilnehmers läuft in derselben NDI-Quelle mit, die bereits sein Bild führt.

**Architecture:** Zooms Ton-Rückruf läuft auf einem SDK-Thread und liefert nur eine `user_id`. Er kopiert das Paket in eine Warteschlange und kehrt sofort zurück; der Hauptthread leert sie im bestehenden 10-ms-Tick, schlägt das Abo nach und sendet. Damit bleibt die Abo-Karte `g_subs` in genau einer Hand, und die Lebensdauerfrage entfällt, statt bewacht zu werden.

**Tech Stack:** C++17 (MSVC, CMake), Zoom Meeting SDK for Windows 7.1.5 (43953), NDI 6 SDK, TypeScript (Node 24, `--experimental-strip-types`).

**Spec:** [`docs/superpowers/specs/2026-08-14-zoom-stage3-audio-ndi-design.md`](../specs/2026-08-14-zoom-stage3-audio-ndi-design.md)

## Global Constraints

- **Branch:** `feat/zoom-stage3-audio`. Niemals `apps/ndi-screen-capture/resources/bin/win/jm_ndi.node` stagen. Kein `git add -A` / `git add .` — nur ausdrückliche Pfade, danach `git status --short` lesen.
- **stdout ist Maschine, stderr ist Mensch.** Ereignisse als eine JSON-Zeile je Ereignis auf stdout (`emitRaw`), Klartext auf stderr (`emitLog`).
- **Namen entstehen nur in TypeScript** (`enrich()` in `src/protocol.ts`). Der native Teil schreibt Zahlen und Schlüssel, nie Klartextnamen.
- **Eine Ursache, ein Name.** Zwei verschiedene Ursachen bekommen nie denselben Schlüssel.
- **Nichts verschwindet still.** Jeder Rücksprung ohne Wirkung wird gemeldet — auf stdout, wenn ein Aufrufer darauf handeln kann, sonst auf stderr.
- **Keine erfundenen Werte.** `sampleRate`/`channels` erscheinen erst, wenn ein Paket sie geliefert hat — wie `rotation`/`limitedRange` beim Bild.
- **Umlaute:** in `packages/zoom-bridge/native/*` und `test/*.mjs` durchgehend `ue/oe/ae`; in `README.md`, Spec und `src/*.ts`-Kommentaren echte Umlaute. Commit-Nachrichten ohne Umlaute.
- **Sperr-Disziplin:** eine Sperre wird **nie** über einen NDI-Sendeaufruf und **nie** über ein `emit*()` gehalten. Der Ton-Rückruf nimmt **keine** `Sub`-Sperre und berührt `g_subs` **nicht**.
- **`bWithInterpreters` ist `false`.** Ein `true` macht laut SDK-Kopfsatz die lokalen Dolmetscher-Funktionen unbrauchbar und beschädigt damit die Dolmetscher-App (#208).
- **Keine Meeting-Nummer, kein Kenncode, keine Zugangsdaten** in Quelltext, Kommentar, Ausgabe oder Commit — auch nicht als Beispiel.
- **Bauen:** `$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"`, dann `npm run rebuild -w @jm/zoom-bridge`.
- **Tore vor jedem Commit:** `npm run selftest -w @jm/zoom-bridge` und `npm run typecheck --workspaces --if-present`.

## Dateien

| Datei | Verantwortung |
| --- | --- |
| `native/audio.h` / `native/audio.cpp` | **neu.** Ton-Lauscher (SDK-Seite), Warteschlange, globales Ton-Abo. Kennt `Sub` und `g_subs` **nicht**. |
| `native/video.cpp` | Verbraucherseite: leert die Warteschlange im Tick, schlägt das Abo nach, sendet, führt den Stille-Herzschlag. Besitzt `Sub`/`g_subs`. |
| `native/ndi_sender.h` / `.cpp` | `sendAudio()` und `sendSilence()`. |
| `native/session.h` / `.cpp` | `boolFromJson()`; das Ton-Abo wird über `audio.h` angestoßen. |
| `native/main.cpp` | `audio`-Feld am Befehl lesen, Abbau-Reihenfolge. |
| `native/callbacks.cpp` | Meeting-Ende setzt das Ton-Abo zurück. |
| `src/protocol.ts` | Befehlsfeld, `audio`-Ereignis, vier Fehlerschlüssel. |
| `src/state.ts` | `AudioSub`-Zustand je Abo. |
| `test/selftest.ts`, `test/fake-bridge.mjs` | Zusicherungen ohne SDK und ohne Meeting. |
| `test/bool-probe.mjs` | **neu.** Belegt ohne Meeting, dass der native Teil `"audio":false` wirklich liest. |
| `test/join.mjs`, `README.md`, `docs/roadmap.md` | Anzeige und Dokumentation. |

---

### Task 1: Wahrheitswerte aus JSON lesen

**Warum zuerst:** `fieldFromJson()` liest nur Zeichenketten, `numberFromJson()` nur Ziffern. Ein `"audio":true` ist für den nativen Teil heute **unsichtbar**. In Stage 2 hat genau dieser Fehler (bei `"id"`) das Merkmal gegen den echten Prozess unbenutzbar gemacht und fiel erst in der Nachbesserung auf. Deshalb steht der Leser zuerst und bekommt einen eigenen Prüfstand.

**Files:**
- Modify: `packages/zoom-bridge/native/session.h` (nach der Deklaration von `numberFromJson`)
- Modify: `packages/zoom-bridge/native/session.cpp` (nach der Definition von `numberFromJson`)
- Create: `packages/zoom-bridge/test/bool-probe.mjs`
- Modify: `packages/zoom-bridge/package.json` (Skript `bool-probe`)

**Interfaces:**
- Produces: `bool boolFromJson(const std::string& line, const char* key, bool* out);` — `true`, wenn der Schlüssel an gültiger Position stand und `true` oder `false` folgte; sonst `false` und `*out` unberührt.

- [ ] **Step 1: Deklaration in `session.h`**

Direkt unter der Deklaration von `numberFromJson`:

```cpp
/**
 * Wahrheitswert-Gegenstueck zu fieldFromJson()/numberFromJson().
 *
 * WARUM ES DAS BRAUCHT: fieldFromJson() liest ausdruecklich nur
 * Zeichenketten, numberFromJson() nur Ziffernfolgen. Ein {"audio":true}
 * faellt durch BEIDE durch - der Schalter waere im nativen Teil unsichtbar,
 * und "audio":false wuerde stillschweigend als "Vorgabe an" gelesen. Genau
 * diese Luecke hat in Stage 2 bei "id" das Merkmal gegen den echten Prozess
 * unbenutzbar gemacht.
 *
 * @param out wird NUR bei Rueckgabe true geschrieben. Der Aufrufer setzt
 *            seine Vorgabe also VOR dem Aufruf und laesst sie stehen, wenn
 *            das Feld fehlt.
 * @returns false, wenn der Schluessel fehlt, nicht an Schluesselposition
 *          steht oder etwas anderes als true/false folgt.
 */
bool boolFromJson(const std::string& line, const char* key, bool* out);
```

- [ ] **Step 2: Definition in `session.cpp`**

Unmittelbar nach `numberFromJson`. Dieselbe Schlüssel-Positions-Prüfung wie dort:

```cpp
bool boolFromJson(const std::string& line, const char* key, bool* out) {
  // DIESELBE Schluessel-Positions-Pruefung wie fieldFromJson/numberFromJson
  // (unmittelbar davor '{' oder ',') - ohne sie truege ein Wert, der zufaellig
  // "audio" enthaelt, denselben Namen wie das Feld.
  const std::string needle = std::string("\"") + key + "\"";
  size_t searchFrom = 0;

  while (true) {
    size_t at = line.find(needle, searchFrom);
    if (at == std::string::npos) return false;

    bool isKeyPosition = false;
    size_t p = at;
    while (p > 0 && isJsonSpace(line[p - 1])) --p;
    if (p > 0 && (line[p - 1] == '{' || line[p - 1] == ',')) isKeyPosition = true;

    if (isKeyPosition) {
      size_t after = at + needle.size();
      while (after < line.size() && isJsonSpace(line[after])) ++after;
      if (after < line.size() && line[after] == ':') {
        ++after;
        while (after < line.size() && isJsonSpace(line[after])) ++after;
        if (line.compare(after, 4, "true") == 0)  { *out = true;  return true; }
        if (line.compare(after, 5, "false") == 0) { *out = false; return true; }
        // Schluessel gefunden, Wert ist weder true noch false: NICHT
        // weitersuchen und NICHT raten - das Feld ist da, aber unlesbar.
        return false;
      }
    }
    searchFrom = at + 1;
  }
}
```

- [ ] **Step 3: Bauen**

```powershell
$env:ZOOM_SDK_DIR = "C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953"
npm run rebuild -w @jm/zoom-bridge
```

Erwartet: `zoom-bridge.exe -> ...` ohne Fehler.

- [ ] **Step 4: Prüfstand schreiben — `test/bool-probe.mjs`**

Der Prüfstand belegt **ohne Meeting**, dass der Schalter ankommt. Er nutzt dieselbe Unterscheidung wie `test/command-probe.mjs`: ohne `init` ist die Rohdaten-Erlaubnis immer verweigert, ein `videoSubscribe` endet also stets mit `videoNoPrivilege` — das beweist, dass die Befehlszeile bis dorthin gelesen wurde. Der Ton-Schalter wird über die **stderr-Zeile** belegt, die Task 5 dort ausgibt.

```js
#!/usr/bin/env node
// Belegt OHNE Meeting, dass der native Befehlsleser "audio":true/false
// wirklich liest. Ohne diesen Beleg saehe ein ignorierter Schalter genauso
// aus wie ein befolgter - er ist bis zum ersten echten Ton unsichtbar.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';

const require = createRequire(import.meta.url);
// Nebenwirkung: haengt die NDI-Laufzeit an process.env.PATH (siehe
// packages/ndi/index.js). Ohne sie startet zoom-bridge.exe gar nicht.
require('@jm/ndi');

const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';
const child = spawn(binPath(), [], {
  windowsHide: true,
  env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
});

let err = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => { err += d; });

child.stdin.write('{"cmd":"videoSubscribe","id":42,"audio":false}\n');
child.stdin.write('{"cmd":"videoSubscribe","id":43,"audio":true}\n');
child.stdin.write('{"cmd":"videoSubscribe","id":44}\n');
child.stdin.end();

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Kindprozess endete mit ${code}.`);
    console.error('Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH oder das Programm existiert nicht.');
    process.exit(1);
  }
  const zeilen = err.split(/\r?\n/);
  const fuer = (id) => zeilen.find((z) => z.includes(`Ton-Schalter fuer ${id}`)) ?? '';
  const faelle = [
    ['audio:false wird gelesen', fuer(42).includes('aus')],
    ['audio:true wird gelesen', fuer(43).includes('an')],
    ['ohne Feld gilt die Vorgabe an', fuer(44).includes('an')],
  ];
  let schlecht = 0;
  for (const [name, ok] of faelle) {
    console.log(`  [${name}] ${ok ? 'OK' : 'FEHLGESCHLAGEN'}`);
    if (!ok) schlecht++;
  }
  if (schlecht > 0) {
    console.error('\nFEHLGESCHLAGEN — der Ton-Schalter kommt nicht an.');
    console.error('Rohausgabe:\n' + err);
    process.exit(2);
  }
  console.log('\nOK — der native Befehlsleser liest den Ton-Schalter.');
});
```

- [ ] **Step 5: Skript eintragen**

In `packages/zoom-bridge/package.json`, in `scripts`, nach `"video-stress"`:

```json
    "bool-probe": "node test/bool-probe.mjs"
```

- [ ] **Step 6: Commit**

```bash
git add packages/zoom-bridge/native/session.h packages/zoom-bridge/native/session.cpp packages/zoom-bridge/test/bool-probe.mjs packages/zoom-bridge/package.json
git status --short
git commit -m "feat(zoom-bridge): Wahrheitswerte aus JSON lesen, samt Pruefstand"
```

**Hinweis für den Umsetzer:** Der Prüfstand geht erst durch, wenn Task 5 die stderr-Zeile `Ton-Schalter fuer <id>: an|aus` ausgibt. Bis dahin schlägt er fehl — das ist beabsichtigt und ist der fehlschlagende Test dieses Merkmals. In Task 5 wird er grün.

---

### Task 2: Protokoll und Zustand für den Ton

**Files:**
- Modify: `packages/zoom-bridge/src/protocol.ts`
- Modify: `packages/zoom-bridge/src/state.ts`
- Modify: `packages/zoom-bridge/test/selftest.ts`
- Modify: `packages/zoom-bridge/test/fake-bridge.mjs`

**Interfaces:**
- Consumes: nichts aus Task 1 (reine TypeScript-Seite).
- Produces: `AudioState`, `AudioReason`, `AUDIO_STATES`, das `audio`-Ereignis in `WireEvent`, das Feld `audio?: boolean` am Befehl `videoSubscribe`, die Fehlerschlüssel `audioHelperMissing`, `audioSubscribeFailed`, `audioBufferMismatch`, `audioQueueOverflow`, sowie `Session.audioSubs: Map<number, AudioSub>`.

- [ ] **Step 1: Fehlschlagende Zusicherungen in `test/selftest.ts`**

Ans Ende der Datei, **vor** der Zeile `console.log(failures === 0 ? ...)`:

```ts
// --- Ton: Protokoll und Zustand ----------------------------------------
console.log('\nprotocol — Ton:');
{
  const ev = parseWireEvent('{"ev":"audio","id":7,"state":"live","reason":"packets","sampleRate":32000,"channels":1}');
  assert(ev?.ev === 'audio', 'ein audio-Ereignis wird gelesen');
  assert((ev as { sampleRate?: number }).sampleRate === 32000, 'die Abtastrate kommt durch');

  const ohne = parseWireEvent('{"ev":"audio","id":7,"state":"waiting","reason":"command"}');
  assert((ohne as { sampleRate?: number })?.sampleRate === undefined,
    'ohne gemessenes Paket fehlt die Abtastrate — sie wird NICHT erfunden');

  assert(serializeCommand({ cmd: 'videoSubscribe', id: 7, audio: false }).includes('"audio":false'),
    'der Ton-Schalter steht im Befehl');

  const fehler = enrich({ ev: 'error', where: 'audio', code: 'audioQueueOverflow' } as WireEvent);
  assert((fehler as { name?: string }).name === 'AUDIO_QUEUE_OVERFLOW', 'der Ueberlauf hat einen eigenen Namen');
}

console.log('\nstate — Ton:');
{
  let s = initialSession();
  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'waiting', reason: 'command' } as WireEvent));
  assert(s.audioSubs.get(7)?.state === 'waiting', 'ein Ton-Abo beginnt als waiting');

  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'live', reason: 'packets', sampleRate: 32000, channels: 1 } as WireEvent));
  assert(s.audioSubs.get(7)?.sampleRate === 32000, 'das gemessene Format wird uebernommen');

  // 'off' ist das Ende eines Ton-Abos - wie 'unsubscribed' beim Bild.
  s = reduce(s, enrich({ ev: 'audio', id: 7, state: 'off', reason: 'meetingEnded' } as WireEvent));
  assert(!s.audioSubs.has(7), 'ein beendetes Ton-Abo verschwindet aus der Karte');
}
```

- [ ] **Step 2: Fehlschlag bestätigen**

Run: `npm run selftest -w @jm/zoom-bridge`
Erwartet: FAIL — `audioSubs` gibt es nicht, `audio` ist kein bekanntes Ereignis.

- [ ] **Step 3: `src/protocol.ts` erweitern**

Neben `VIDEO_RESOLUTIONS`:

```ts
export const AUDIO_STATES = ['waiting', 'live', 'silent', 'off'] as const;
export type AudioState = (typeof AUDIO_STATES)[number];

// Kein 'queueOverflow': ein Ueberlauf aendert keinen Zustand des Abos, er ist
// ein Fehler ueber die MASCHINE (eine Warteschlange fuer alle) und geht
// darum als error-Ereignis ohne id raus, nicht als Grund fuer einen Wechsel.
export type AudioReason = 'command' | 'packets' | 'gap' | 'participantLeft' | 'meetingEnded';
```

Am Befehl `videoSubscribe` das Feld ergänzen:

```ts
  | { cmd: 'videoSubscribe'; id: number; resolution?: VideoResolutionKey; audio?: boolean }
```

In `WireEvent`, neben der `video`-Variante:

```ts
  // "sampleRate"/"channels" FEHLEN, solange kein Paket sie geliefert hat (bei
  // state:"waiting" also immer). Dieselbe Regel wie rotation/limitedRange beim
  // Bild: eine erfundene 32000 liesse sich spaeter nicht von einer gemessenen
  // unterscheiden.
  | {
      ev: 'audio';
      id: number;
      state: AudioState;
      reason: AudioReason;
      sampleRate?: number;
      channels?: number;
    }
```

In `OWN_ERROR_NAMES`, hinter den Video-Schlüsseln:

```ts
  // Das SDK gab keinen Ton-Helfer heraus - kein Meeting oder SDK nicht bereit.
  audioHelperMissing: 'AUDIO_HELPER_MISSING',
  // Das EINE globale Ton-Abo ging nicht durch. AUSDRUECKLICH ein anderer Name
  // als audioHelperMissing: dort gab es den Helfer gar nicht, hier hat er
  // abgelehnt - zwei verschiedene Orte zum Suchen.
  audioSubscribeFailed: 'AUDIO_SUBSCRIBE_FAILED',
  // Pufferlaenge passt nicht zu Kanalzahl x 2. Geprueft, nicht geglaubt -
  // dieselbe Sorge wie videoBufferMismatch beim I420.
  audioBufferMismatch: 'AUDIO_BUFFER_MISMATCH',
  // Pakete verworfen, weil das Leeren nicht nachkam. Eine Aussage ueber die
  // MASCHINE, nicht ueber einen Gast - darum ohne id.
  audioQueueOverflow: 'AUDIO_QUEUE_OVERFLOW',
```

- [ ] **Step 4: `src/state.ts` erweitern**

```ts
export interface AudioSub {
  state: AudioState;
  reason: AudioReason;
  sampleRate?: number;
  channels?: number;
}
```

In `Session`: `audioSubs: Map<number, AudioSub>;`, in `initialSession()`: `audioSubs: new Map(),`.

Neuer `case` in `reduce()`, unmittelbar nach dem `video`-Zweig:

```ts
    case 'audio': {
      const e = ev as {
        id: number; state: AudioState; reason: AudioReason;
        sampleRate?: number; channels?: number;
      };
      const audioSubs = new Map(s.audioSubs);
      // 'off' ist das Ende - wie 'unsubscribed' beim Bild. Kein Umhaengen-
      // Sonderfall: der Ton haengt am Bild-Abo, und dessen Umhaengen meldet
      // sich ueber das video-Ereignis. Ein umgehaengtes Abo bekommt hier ein
      // frisches 'waiting' unter der NEUEN Kennung (Task 7).
      if (e.state === 'off') audioSubs.delete(e.id);
      else audioSubs.set(e.id, {
        state: e.state, reason: e.reason,
        sampleRate: e.sampleRate, channels: e.channels,
      });
      return { ...s, audioSubs };
    }
```

- [ ] **Step 5: Attrappe erweitern — `test/fake-bridge.mjs`**

Im `video`-Skript, im `videoSubscribe`-Zweig, nach den beiden `video`-Zeilen:

```js
        say({ ev: 'audio', id: 42, state: 'waiting', reason: 'command' });
        say({ ev: 'audio', id: 42, state: 'live', reason: 'packets', sampleRate: 32000, channels: 1 });
```

und im `videoUnsubscribe`-Zweig, vor der `video`-Zeile:

```js
        say({ ev: 'audio', id: 42, state: 'off', reason: 'command' });
```

- [ ] **Step 6: Tore**

```powershell
npm run selftest -w @jm/zoom-bridge
npm run typecheck --workspaces --if-present
```

Erwartet: alle Zusicherungen grün, Typprüfung ohne Fehler.

- [ ] **Step 7: Commit**

```bash
git add packages/zoom-bridge/src/protocol.ts packages/zoom-bridge/src/state.ts packages/zoom-bridge/test/selftest.ts packages/zoom-bridge/test/fake-bridge.mjs
git status --short
git commit -m "feat(zoom-bridge): Protokoll und Zustand fuer den Ton"
```

---

### Task 3: NDI kann Ton

**Files:**
- Modify: `packages/zoom-bridge/native/ndi_sender.h`
- Modify: `packages/zoom-bridge/native/ndi_sender.cpp`

**Interfaces:**
- Produces: `void NdiSender::sendAudio(const int16_t* samples, int sampleCount, int sampleRate, int channels);` und `void NdiSender::sendSilence(int sampleCount, int sampleRate, int channels);` — `sampleCount` ist die Zahl der Abtastwerte **je Kanal**.

- [ ] **Step 1: Deklarationen in `ndi_sender.h`**

Nach `sendBlack`:

```cpp
  /**
   * Sendet interleaved PCM16 - genau die Form, die Zoom liefert, und genau
   * die, die NDI nimmt (NDIlib_audio_frame_interleaved_16s_t). Keine
   * Umrechnung, kein Umpacken.
   *
   * @param sampleCount Abtastwerte JE KANAL, nicht insgesamt.
   */
  void sendAudio(const int16_t* samples, int sampleCount, int sampleRate, int channels);

  /** Sendet Nulldaten desselben Formats - der Stille-Herzschlag. */
  void sendSilence(int sampleCount, int sampleRate, int channels);
```

In den privaten Feldern, neben dem Schwarzpuffer:

```cpp
  // Wiederverwendeter Stillepuffer - aus demselben Grund wie black_: je
  // Herzschlag neu zu belegen waere 100-mal je Sekunde je Abo eine
  // Speicheranforderung fuer immer denselben Inhalt (Nullen).
  std::vector<int16_t> silence_;
```

- [ ] **Step 2: Definitionen in `ndi_sender.cpp`**

```cpp
void NdiSender::sendAudio(const int16_t* samples, int sampleCount, int sampleRate, int channels) {
  if (samples == nullptr || sampleCount <= 0 || channels <= 0) return;
  std::lock_guard<std::mutex> lock(mutex_);
  if (send_ == nullptr) return;
  NDIlib_audio_frame_interleaved_16s_t f;
  f.sample_rate = sampleRate;
  f.no_channels = channels;
  f.no_samples = sampleCount;
  // Die Taktung erzeugt NDI selbst. Eigene Zeitstempel aus Zooms
  // GetTimeStamp() waeren erst dann richtig, wenn gemessen ist, dass die
  // synthetische Taktung Bild und Ton auseinanderlaufen laesst (Spec
  // Abschnitt 8, Abnahmepunkt 5).
  f.timecode = NDIlib_send_timecode_synthesize;
  // +0 dB: der Kopfsatz der NDI-SDK sagt fuer das SENDEN ausdruecklich
  // "specify +0 dB. Most common applications produce audio at reference
  // level." Zoom liefert Ton auf Referenzpegel.
  f.reference_level = 0;
  f.p_data = const_cast<int16_t*>(samples);
  NDIlib_util_send_send_audio_interleaved_16s(send_, &f);
}

void NdiSender::sendSilence(int sampleCount, int sampleRate, int channels) {
  if (sampleCount <= 0 || channels <= 0) return;
  const size_t noetig = static_cast<size_t>(sampleCount) * static_cast<size_t>(channels);
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (send_ == nullptr) return;
    if (silence_.size() < noetig) silence_.assign(noetig, 0);
  }
  // Der Puffer ist reine Null und wird nie beschrieben - ihn ausserhalb der
  // Sperre zu lesen ist ungefaehrlich, und sendAudio() nimmt die Sperre
  // ohnehin selbst.
  sendAudio(silence_.data(), sampleCount, sampleRate, channels);
}
```

- [ ] **Step 3: Bauen**

```powershell
npm run rebuild -w @jm/zoom-bridge
```

Erwartet: übersetzt ohne Fehler.

**Falls `NDIlib_util_send_send_audio_interleaved_16s` nicht gefunden wird:** die NDI-6-SDK führt die Funktion in `Processing.NDI.utilities.h`; dieser Kopfsatz kommt über `Processing.NDI.Lib.h` mit. Prüfen mit
`grep -rn "util_send_send_audio_interleaved_16s" "%NDI_SDK_DIR%\Include"`.

- [ ] **Step 4: `--ndi-selftest` sendet auch Ton**

**Gute Nachricht, geprüft statt vermutet:** `@jm/ndi` **kann** Ton empfangen
(`NdiAudioFrame` mit `type: 'audio'` in `packages/ndi/index.d.ts`). Der Tonweg
ist damit **ohne Meeting belegbar** — die offene Frage aus Spec §9 ist positiv
beantwortet.

In `native/main.cpp`, im `--ndi-selftest`-Zweig, die Sendeschleife ersetzen:

```cpp
    emitRaw("{\"ev\":\"ndiSelftest\",\"state\":\"sending\"}");
    for (int i = 0; i < 60; ++i) {
      s.sendBlack(640, 360);
      // 10 ms Stille je Bild-Durchlauf. Der Selbsttest belegt damit BEIDE
      // Wege derselben Quelle - eine Quelle, die Bild wirbt und beim Ton
      // schweigt, saehe im Netz genauso aus wie eine funktionierende.
      s.sendSilence(480, 48000, 1);
      Sleep(33);
    }
```

- [ ] **Step 5: `ndi-probe` prüft den Ton mit**

In `test/ndi-probe.mjs`, wo die empfangenen Frames ausgewertet werden, zusätzlich
festhalten, ob je ein Frame mit `type === 'audio'` kam, und das im Ergebnis
ausweisen:

```js
let tonGesehen = false;
// ... in der Empfangsschleife, wo bereits Frames geholt werden:
//   const f = ndi.receive(...);
//   if (f && f.type === 'audio') tonGesehen = true;
```

und in der Erfolgsmeldung:

```js
console.log(tonGesehen
  ? 'OK — die Quelle war auffindbar UND hat Ton geliefert.'
  : 'TEILWEISE — die Quelle war auffindbar, aber es kam KEIN Ton an.');
if (!tonGesehen) process.exit(3);
```

Der eigene Rückgabewert `3` ist tragend: „Quelle gefunden, aber stumm" ist eine
**andere** Ursache als „Quelle nicht gefunden" und darf nicht denselben
Rückgabewert bekommen.

- [ ] **Step 6: Bauen und prüfen**

```powershell
npm run rebuild -w @jm/zoom-bridge
npm run ndi-probe -w @jm/zoom-bridge
```

Erwartet: `OK — die Quelle war auffindbar UND hat Ton geliefert.`

- [ ] **Step 7: Commit**

```bash
git add packages/zoom-bridge/native/ndi_sender.h packages/zoom-bridge/native/ndi_sender.cpp packages/zoom-bridge/native/main.cpp packages/zoom-bridge/test/ndi-probe.mjs
git status --short
git commit -m "feat(zoom-bridge): NDI-Sender kann Ton und Stille, Pruefstand belegt es"
```

---

### Task 4: Ton-Lauscher und Warteschlange

**Files:**
- Create: `packages/zoom-bridge/native/audio.h`
- Create: `packages/zoom-bridge/native/audio.cpp`
- Modify: `packages/zoom-bridge/CMakeLists.txt` (Quelldatei eintragen)

**Interfaces:**
- Consumes: `emitRaw`/`emitLog` aus `emit.h`.
- Produces:
  - `struct AudioPacket { unsigned int userId; int sampleRate; int channels; int sampleCount; std::vector<int16_t> samples; };`
  - `bool audioEnsureSubscribed();` — idempotent je Meeting; meldet `audioHelperMissing`/`audioSubscribeFailed` selbst und gibt dann `false` zurück.
  - `void audioClearSubscribed();` — Merkzeichen zurücksetzen (Meeting-Ende).
  - `void audioShutdown();` — `unSubscribe()` beim Prozessende.
  - `bool audioPop(AudioPacket* out);` — ein Paket abholen, `false` wenn leer.
  - `unsigned int audioTakeOverflowCount();` — Zahl der seit dem letzten Abruf verworfenen Pakete, danach auf 0.

- [ ] **Step 1: `native/audio.h`**

```cpp
#pragma once
#include <cstdint>
#include <vector>

/**
 * Die SDK-Seite des Tons: EIN globaler Lauscher, EINE Warteschlange.
 *
 * WARUM DIESE DATEI Sub UND g_subs NICHT KENNT: Zooms Ton-Rueckruf laeuft auf
 * einem SDK-Thread und liefert nur eine user_id. Wuerde er die Abo-Karte
 * nachschlagen, griffe er auf eine Struktur zu, die der Hauptthread laufend
 * aendert - und schlimmer: ein videoUnsubscribe baut zwar den Renderer ab und
 * stoppt damit die BILD-Rueckrufe, den TON-Rueckruf stoppt es NICHT (das
 * Ton-Abo ist global). Ein Paket fuer ein soeben abgebautes Abo ist also zu
 * erwarten, nicht die Ausnahme.
 *
 * Deshalb: der Rueckruf kopiert und kehrt zurueck. Nachschlagen und Senden
 * macht der Hauptthread (video.cpp, videoTick). g_subs bleibt damit in genau
 * einer Hand, und die Lebensdauerfrage entfaellt, statt bewacht zu werden.
 */
struct AudioPacket {
  unsigned int userId = 0;
  int sampleRate = 0;
  int channels = 0;
  int sampleCount = 0;          // Abtastwerte JE KANAL
  std::vector<int16_t> samples; // interleaved
};

/**
 * Legt das EINE globale Ton-Abo an, falls es noch nicht steht.
 *
 * Idempotent je Meeting - dasselbe Muster wie sessionStartRawRecording().
 * bWithInterpreters ist FEST false: ein true macht laut SDK-Kopfsatz die
 * lokalen Dolmetscher-Funktionen unbrauchbar und beschaedigt damit die
 * Dolmetscher-App (#208).
 *
 * Meldet audioHelperMissing bzw. audioSubscribeFailed selbst auf stdout.
 *
 * @returns false, wenn kein Ton kommen wird.
 */
bool audioEnsureSubscribed();

/** Setzt das Merkzeichen zurueck - das Ton-Abo gilt je MEETING. */
void audioClearSubscribed();

/** unSubscribe() beim Prozessende. Danach kommen keine Rueckrufe mehr. */
void audioShutdown();

/** Holt ein Paket ab. false = Warteschlange leer. */
bool audioPop(AudioPacket* out);

/**
 * Wie viele Pakete seit dem letzten Abruf verworfen wurden, und setzt den
 * Zaehler zurueck. Ein Ueberlauf ist eine Aussage ueber die MASCHINE, nicht
 * ueber einen Gast - der Rueckruf, der verwirft, weiss gar nicht, zu welchem
 * Abo das Paket gehoert haette.
 */
unsigned int audioTakeOverflowCount();
```

- [ ] **Step 2: `native/audio.cpp`**

```cpp
#include "audio.h"
#include <atomic>
#include <deque>
#include <mutex>
#include "emit.h"
#include "rawdata/zoom_rawdata_api.h"
#include "rawdata/rawdata_audio_helper_interface.h"
#include "zoom_sdk_raw_data_def.h"

USING_ZOOM_SDK_NAMESPACE

namespace {

// 256 Plaetze: bei 5 Teilnehmern, 32 kHz Mono und 10-ms-Paketen sind das rund
// 500 Pakete je Sekunde - der Vorrat reicht also ueber eine halbe Sekunde,
// waehrend geleert wird alle 10 ms. Gross genug fuer einen Hakler, klein
// genug, um bei einem echten Haenger nicht ins Uferlose zu wachsen.
constexpr size_t kMaxPakete = 256;

std::mutex g_queueMutex;
std::deque<AudioPacket> g_queue;
std::atomic<unsigned int> g_verworfen{0};
std::atomic<bool> g_abonniert{false};

class AudioDelegate : public IZoomSDKAudioRawDataDelegate {
 public:
  // NICHT GENUTZT, aber Pflicht: die Schnittstelle ist rein virtuell. Der
  // Mischton, der Bildschirmton und der Dolmetscherton stehen ausdruecklich
  // NICHT im Umfang (Spec Abschnitt 10) - leere Rumpfe sind hier die
  // ehrliche Umsetzung, kein Versehen.
  void onMixedAudioRawDataReceived(AudioRawData* /*data*/) override {}
  void onShareAudioRawDataReceived(AudioRawData* /*data*/, uint32_t /*userId*/) override {}
  void onOneWayInterpreterAudioRawDataReceived(AudioRawData* /*data*/, const zchar_t* /*lang*/) override {}

  void onOneWayAudioRawDataReceived(AudioRawData* data, uint32_t userId) override {
    if (data == nullptr) return;
    const char* buf = data->GetBuffer();
    const unsigned int len = data->GetBufferLen();
    const int rate = static_cast<int>(data->GetSampleRate());
    const int ch = static_cast<int>(data->GetChannelNum());
    if (buf == nullptr || len == 0 || rate <= 0 || ch <= 0) return;

    AudioPacket p;
    p.userId = userId;
    p.sampleRate = rate;
    p.channels = ch;
    // Die Pufferpruefung (Vielfaches von channels*2) macht der HAUPTTHREAD
    // beim Leeren, nicht hier: "einmal je Abo" braucht ein Merkzeichen am
    // Sub, und genau das darf dieser Rueckruf nicht anfassen. Hier wird nur
    // so gerechnet, dass nichts ueberlaeuft.
    p.sampleCount = static_cast<int>(len / (sizeof(int16_t) * static_cast<unsigned int>(ch)));
    p.samples.resize(len / sizeof(int16_t));
    std::memcpy(p.samples.data(), buf, p.samples.size() * sizeof(int16_t));

    std::lock_guard<std::mutex> lock(g_queueMutex);
    // DAS AELTESTE fliegt raus, nicht das neue: verspaeteter Ton ist wertlos.
    while (g_queue.size() >= kMaxPakete) {
      g_queue.pop_front();
      g_verworfen.fetch_add(1);
    }
    g_queue.push_back(std::move(p));
  }
};

// Prozesslang. Damit hat der Lauscher SELBST keine Lebensdauerfrage - nur die
// Abos haben eine, und die loest der Weg ueber die Warteschlange.
AudioDelegate g_delegate;

}  // namespace

bool audioEnsureSubscribed() {
  if (g_abonniert.load()) return true;
  IZoomSDKAudioRawDataHelper* helper = GetAudioRawdataHelper();
  if (helper == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioHelperMissing\"}");
    return false;
  }
  // false: siehe audio.h - schuetzt die Dolmetscher-App (#208).
  const SDKError err = helper->subscribe(&g_delegate, false);
  if (err != SDKERR_SUCCESS) {
    emitLog(std::wstring(L"Zoom-SDK meldet einen Fehler bei subscribe() fuer den Ton: SDKError=") +
            std::to_wstring(static_cast<int>(err)));
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioSubscribeFailed\"}");
    return false;
  }
  g_abonniert = true;
  return true;
}

void audioClearSubscribed() {
  g_abonniert = false;
  std::lock_guard<std::mutex> lock(g_queueMutex);
  // Pakete aus einem beendeten Meeting gehoeren niemandem mehr.
  g_queue.clear();
  g_verworfen = 0;
}

void audioShutdown() {
  if (g_abonniert.load()) {
    IZoomSDKAudioRawDataHelper* helper = GetAudioRawdataHelper();
    if (helper != nullptr) helper->unSubscribe();
  }
  audioClearSubscribed();
}

bool audioPop(AudioPacket* out) {
  if (out == nullptr) return false;
  std::lock_guard<std::mutex> lock(g_queueMutex);
  if (g_queue.empty()) return false;
  *out = std::move(g_queue.front());
  g_queue.pop_front();
  return true;
}

unsigned int audioTakeOverflowCount() {
  return g_verworfen.exchange(0);
}
```

`#include <cstring>` für `std::memcpy` ergänzen.

- [ ] **Step 3: `CMakeLists.txt`**

`native/audio.cpp` in dieselbe Quellenliste eintragen, in der `native/video.cpp` steht.

- [ ] **Step 4: Bauen**

```powershell
npm run rebuild -w @jm/zoom-bridge
```

Erwartet: übersetzt ohne Fehler.

**Falls die Klasse abstrakt bleibt (`C2259`):** `IZoomSDKAudioRawDataDelegate` hat **vier** rein virtuelle Methoden — `onMixedAudioRawDataReceived`, `onOneWayAudioRawDataReceived`, `onShareAudioRawDataReceived`, `onOneWayInterpreterAudioRawDataReceived`. Alle vier müssen da sein. Gegenprüfen mit
`grep -c "virtual void" "%ZOOM_SDK_DIR%\x64\zoom_sdk_c_sharp_wrap\h\rawdata\rawdata_audio_helper_interface.h"`.

- [ ] **Step 5: Commit**

```bash
git add packages/zoom-bridge/native/audio.h packages/zoom-bridge/native/audio.cpp packages/zoom-bridge/CMakeLists.txt
git status --short
git commit -m "feat(zoom-bridge): Ton-Lauscher und Warteschlange"
```

---

### Task 5: Das Abo bekommt Ton

**Files:**
- Modify: `packages/zoom-bridge/native/video.h` (Signatur `videoSubscribe`)
- Modify: `packages/zoom-bridge/native/video.cpp` (`Sub`-Felder, `videoSubscribe`, `emitAudio`, Leeren im Tick)
- Modify: `packages/zoom-bridge/native/main.cpp` (`audio`-Feld lesen)

**Interfaces:**
- Consumes: `boolFromJson` (Task 1), `AudioPacket`/`audioPop`/`audioEnsureSubscribed`/`audioTakeOverflowCount` (Task 4), `NdiSender::sendAudio` (Task 3).
- Produces: `void videoSubscribe(unsigned int userId, ZoomSDKResolution res, bool audioOn);`

- [ ] **Step 1: `Sub` um die Tonfelder erweitern**

In `struct Sub` (`native/video.cpp`), nach `limitedRange`:

```cpp
  // --- Ton ---------------------------------------------------------------
  // Ob der Aufrufer den Ton fuer dieses Abo eingeschaltet hat. Steht beim
  // Abonnieren fest (Spec Abschnitt 10: kein nachtraegliches Umschalten).
  bool audioOn = true;
  // Format des zuletzt gesehenen Pakets. 0 = noch NIE eines gesehen - dann
  // wird auch keine Stille gesendet, weil wir das Format nicht kennen und es
  // nicht erfinden. Dieselbe Regel wie lastFrameMs beim Bild.
  int audioRate = 0;
  int audioChannels = 0;
  ULONGLONG lastAudioMs = 0;
  std::string audioState = "off";     // waiting | live | silent | off
  bool audioMismatchGemeldet = false;
```

Im Aufruf-Kopf von `videoSubscribe` das Feld setzen (siehe Step 3).

- [ ] **Step 2: `emitAudio()` neben `emitVideo()`**

```cpp
// Wie emitVideo(), aber fuer den Ton - und mit derselben Regel: sampleRate und
// channels stehen NUR dabei, wenn ein Paket sie geliefert hat. Eine erfundene
// 32000 liesse sich spaeter nicht von einer gemessenen unterscheiden.
void emitAudio(const Sub& s, const char* state, const char* reason) {
  std::string out = std::string("{\"ev\":\"audio\",\"id\":") + std::to_string(s.userId.load()) +
                    ",\"state\":\"" + state + "\",\"reason\":\"" + reason + "\"";
  if (s.audioRate > 0) {
    out += ",\"sampleRate\":" + std::to_string(s.audioRate) +
           ",\"channels\":" + std::to_string(s.audioChannels);
  }
  out += "}";
  emitRaw(out);
}
```

- [ ] **Step 3: `videoSubscribe` nimmt den Schalter**

Signatur in `video.h` und `video.cpp` auf `videoSubscribe(unsigned int userId, ZoomSDKResolution res, bool audioOn)` ändern. Im Rumpf, nach `sub->res = res;`:

```cpp
  sub->audioOn = audioOn;
```

Und **nach** dem geglückten `subscribe()`, unmittelbar vor `emitVideo(*raw, "subscribed", "command")`:

```cpp
  // Der Ton-Schalter wird IMMER gemeldet, auch wenn er aus ist: ein Abo ohne
  // Ton-Zeile saehe genauso aus wie eines, dessen Ton nur noch nicht
  // angekommen ist. Zwei Zustaende, eine Stille - genau das schliesst die
  // Kernregel aus.
  if (audioOn) {
    if (audioEnsureSubscribed()) {
      raw->audioState = "waiting";
      emitAudio(*raw, "waiting", "command");
    } else {
      // audioEnsureSubscribed() hat die Ursache bereits benannt. Das BILD-Abo
      // bleibt bestehen - ein fehlender Ton ist kein Grund, die Quelle
      // wegzunehmen.
      raw->audioOn = false;
      raw->audioState = "off";
      emitAudio(*raw, "off", "command");
    }
  } else {
    emitAudio(*raw, "off", "command");
  }
```

- [ ] **Step 4: `main.cpp` liest den Schalter**

Im `videoSubscribe`-Zweig, nach der Auflösungsprüfung:

```cpp
    bool audioOn = true;   // Vorgabe laut Spec Abschnitt 7
    boolFromJson(line, "audio", &audioOn);
    // Fuer den Menschen, der die Rohausgabe mitliest - und der Beleg, den
    // test/bool-probe.mjs auswertet: ohne diese Zeile saehe ein ignorierter
    // Schalter genauso aus wie ein befolgter.
    emitLog(std::wstring(L"Ton-Schalter fuer ") + std::to_wstring(userId) +
            L": " + (audioOn ? L"an" : L"aus"));
    videoSubscribe(userId, res, audioOn);
```

`#include "audio.h"` in `main.cpp` und `video.cpp` ergänzen.

- [ ] **Step 5: Leeren im Tick**

Ganz am Anfang von `videoTick()`, **vor** der Schleife über `g_subs`:

```cpp
  // ERST den Ueberlauf melden, dann leeren. Ein Ueberlauf ist eine Aussage
  // ueber die Maschine (eine Warteschlange fuer alle), nicht ueber einen Gast
  // - darum ohne id und nur EINMAL je Schwall.
  if (audioTakeOverflowCount() > 0) {
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioQueueOverflow\"}");
  }

  AudioPacket p;
  while (audioPop(&p)) {
    auto it = g_subs.find(p.userId);
    // Kein Abo, Ton aus, oder im Abbau: VERWERFEN. Genau dafuer gibt es den
    // Weg ueber die Warteschlange - hier ist das die richtige Antwort und
    // kein Absturz.
    if (it == g_subs.end()) continue;
    Sub* s = it->second.get();
    if (!s->audioOn || s->imAbbau.load()) continue;

    // GEPRUEFT, NICHT GEGLAUBT - dieselbe Sorge wie bei GetBufferLen() im
    // Bild-Rueckruf: eine Pufferlaenge, die nicht zur Kanalzahl passt, ergibt
    // Rauschen, das wie ein Mikrofondefekt klingt, nicht wie ein
    // Softwarefehler. Man sucht dann am falschen Ende.
    if (p.sampleCount <= 0 ||
        p.samples.size() != static_cast<size_t>(p.sampleCount) * static_cast<size_t>(p.channels)) {
      bool melden = false;
      {
        std::lock_guard<std::mutex> lock(s->fieldMutex);
        if (!s->audioMismatchGemeldet) { s->audioMismatchGemeldet = true; melden = true; }
      }
      if (melden) emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioBufferMismatch\"}");
      continue;
    }

    // Senden OHNE Sperre - sendAudio() nimmt NdiSenders eigene Sperre.
    s->sender.sendAudio(p.samples.data(), p.sampleCount, p.sampleRate, p.channels);

    bool wurdeLive = false;
    {
      std::lock_guard<std::mutex> lock(s->fieldMutex);
      s->audioRate = p.sampleRate;
      s->audioChannels = p.channels;
      s->lastAudioMs = GetTickCount64();
      if (s->audioState != "live") { s->audioState = "live"; wurdeLive = true; }
    }
    if (wurdeLive) emitAudio(*s, "live", "packets");
  }
```

- [ ] **Step 6: Bauen und Prüfstand**

```powershell
npm run rebuild -w @jm/zoom-bridge
npm run bool-probe -w @jm/zoom-bridge
```

Erwartet: `OK — der native Befehlsleser liest den Ton-Schalter.` — der Prüfstand aus Task 1 wird hier grün.

- [ ] **Step 7: Commit**

```bash
git add packages/zoom-bridge/native/video.h packages/zoom-bridge/native/video.cpp packages/zoom-bridge/native/main.cpp
git status --short
git commit -m "feat(zoom-bridge): Ton fliesst vom Rueckruf ueber die Warteschlange in die Quelle"
```

---

### Task 6: Der Stille-Herzschlag

**Files:**
- Modify: `packages/zoom-bridge/native/video.cpp` (in der Tick-Schleife über `g_subs`)

**Interfaces:**
- Consumes: `Sub::audioRate`/`audioChannels`/`lastAudioMs`/`audioState` (Task 5), `NdiSender::sendSilence` (Task 3).

- [ ] **Step 1: Stille in der Tick-Schleife**

In `videoTick()`, **innerhalb** der Schleife `for (auto& [id, s] : g_subs)`, unmittelbar **vor** der Schwarzbild-Entscheidung (also vor `if (lastFrameMs != 0 && jetzt - lastFrameMs < 200) continue;` — die Stille darf nicht an einem `continue` des Bildpfads hängenbleiben):

```cpp
    // --- Stille-Herzschlag ------------------------------------------------
    // ERST NACH DEM ERSTEN ECHTEN PAKET. Vorher sind Abtastrate und
    // Kanalzahl unbekannt, und ein erfundenes Format liesse sich spaeter
    // nicht von einem gemessenen unterscheiden - dieselbe Regel, nach der
    // ein Abo ohne je gesehenes Bild auf "subscribed" steht und nicht auf
    // "cameraOff".
    {
      int aRate, aCh;
      ULONGLONG aLast;
      std::string aState;
      bool aOn;
      {
        std::lock_guard<std::mutex> lock(s->fieldMutex);
        aRate = s->audioRate; aCh = s->audioChannels;
        aLast = s->lastAudioMs; aState = s->audioState; aOn = s->audioOn;
      }
      // 40 ms Nachlauf: Zoom liefert etwa alle 10-20 ms. Der Wert ist ein
      // ANFANGSWERT, kein Messergebnis (Spec Abschnitt 6) - Abnahmepunkt 2
      // prueft mit dem Ohr, ob der Uebergang knackt.
      if (aOn && aRate > 0 && aCh > 0 && jetzt - aLast >= 40) {
        // Blockgroesse = Tick-Frist (10 ms), damit Stille und echter Ton
        // nahtlos ineinander uebergehen.
        const int bloecke = static_cast<int>(aRate / 100);
        s->sender.sendSilence(bloecke, aRate, aCh);
        bool wurdeStill = false;
        {
          std::lock_guard<std::mutex> lock(s->fieldMutex);
          // Momentaufnahme gegenpruefen: sendSilence() kann blockieren, in
          // dieser Spanne kann laengst wieder echter Ton eingetroffen sein.
          // Dieselbe Sorge wie beim Schwarzbild (Befund 2 aus Stage 2).
          if (s->lastAudioMs == aLast && s->audioState != "silent") {
            s->audioState = "silent";
            wurdeStill = true;
          }
        }
        if (wurdeStill) emitAudio(*s, "silent", "gap");
      }
    }
```

- [ ] **Step 2: Bauen**

```powershell
npm run rebuild -w @jm/zoom-bridge
```

- [ ] **Step 3: Commit**

```bash
git add packages/zoom-bridge/native/video.cpp
git status --short
git commit -m "feat(zoom-bridge): Stille-Herzschlag haelt den Tonstrom am Leben"
```

---

### Task 7: Abbau, Umhängen, Anzeige, Dokumentation

**Files:**
- Modify: `packages/zoom-bridge/native/video.cpp` (Abbau, Weggang, Umhängen)
- Modify: `packages/zoom-bridge/native/main.cpp` (`audioShutdown()` in der Abbau-Reihenfolge)
- Modify: `packages/zoom-bridge/native/callbacks.cpp` (`audioClearSubscribed()` beim Meeting-Ende)
- Modify: `packages/zoom-bridge/test/join.mjs`
- Modify: `packages/zoom-bridge/README.md`, `docs/roadmap.md`

- [ ] **Step 1: Abbau meldet den Ton mit**

In `videoAbbauAlle(const char* reason)`, unmittelbar vor `emitVideo(*s, "unsubscribed", reason)`:

```cpp
    // Der Ton endet mit dem Abo und meldet sich EIGENS: ein Aufrufer, der
    // audioSubs fuehrt (src/state.ts), behielte sonst einen Eintrag, auf den
    // nie wieder ein Ereignis kommt - dieselbe Karteileiche, die beim Bild
    // schon einmal aufgetreten ist.
    if (s->audioOn) emitAudio(*s, "off", reason);
```

Dasselbe in `videoUnsubscribe()`, vor `emitVideo(*s, "unsubscribed", "command")`:

```cpp
  if (s->audioOn) emitAudio(*s, "off", "command");
```

- [ ] **Step 2: Weggang und Umhängen**

In `videoParticipantLeft()`, nach dem Setzen von `teilnehmerWeg`:

```cpp
  // Der Ton endet mit dem Weggang - anders als das Bild, das als Schwarz
  // stehen bleibt: Stille fuer jemanden, der nicht da ist, waere eine
  // Aussage ueber eine Person, die es im Meeting nicht mehr gibt.
  bool tonWar = false;
  {
    std::lock_guard<std::mutex> lock(s->fieldMutex);
    if (s->audioOn && s->audioState != "off") { s->audioState = "off"; tonWar = true; }
  }
  if (tonWar) emitAudio(*s, "off", "participantLeft");
```

In `videoParticipantJoined()`, im Block, der `state`/`reason` zurücksetzt (nach `s->teilnehmerWeg = false;`):

```cpp
    // Das Ton-Format gilt je Sitzung des Gastes: nach einem Wiederbeitritt
    // kann Zoom ein anderes liefern. Zuruecksetzen heisst, es beim ersten
    // Paket neu zu MESSEN statt das alte fortzuschreiben.
    s->audioRate = 0;
    s->audioChannels = 0;
    s->lastAudioMs = 0;
    s->audioMismatchGemeldet = false;
    s->audioState = s->audioOn ? "waiting" : "off";
```

und nach dem `emitVideo(*s, "subscribed", grund)` am Ende:

```cpp
  if (s->audioOn) emitAudio(*s, "waiting", grund);
```

- [ ] **Step 3: Meeting-Ende und Prozessende**

In `native/callbacks.cpp`, im `ENDED`/`FAILED`-Zweig, nach `videoMeetingEnded()`:

```cpp
    // Das Ton-Abo gilt je Meeting - dieselbe Begruendung wie beim
    // Rohdaten-Schalter darueber.
    audioClearSubscribed();
```

`#include "audio.h"` ergänzen.

In `native/main.cpp`, im Abbau: `audioShutdown()` **vor** `videoShutdownAll()` — der Lauscher muss weg sein, bevor die Abos verschwinden, sonst füllt er eine Warteschlange, die niemand mehr leert.

- [ ] **Step 4: Anzeige im Prüfstand**

In `test/join.mjs`, im `onEvent`-Block, nach dem `video`-Zweig:

```js
    else if (ev.ev === 'audio') {
      let zeile = `  audio ${ev.id}: ${ev.state} (${ev.reason})`;
      // Format NUR anzeigen, wenn es gemessen wurde - sonst waere die Zeile
      // eine Behauptung ueber etwas, das noch nie ankam.
      if (ev.sampleRate !== undefined) zeile += `  ${ev.sampleRate} Hz, ${ev.channels} Kanal/Kanaele`;
      console.log(zeile);
    }
```

- [ ] **Step 5: Dokumentation**

`README.md`: Abschnitt 7 um einen Unterabschnitt „Ton" erweitern — der Schalter am Befehl, das `audio`-Ereignis mit seinen vier Zuständen, die vier Fehlerschlüssel, der Stille-Herzschlag mit den 40 ms **als Anfangswert benannt**, und der Weg über die Warteschlange samt Begründung (ein `videoUnsubscribe` stoppt den Ton-Rückruf nicht). Abschnitt 9 („Was diese Bridge noch nicht tut") um Mischton, Bildschirmton, Dolmetscherton und Ton-Richtung-Zoom ergänzen und den bisherigen „Kein Ton"-Punkt entfernen.

`docs/roadmap.md`: Stage-3-Zeile auf `🟡 Code fertig, Owner-Abnahme offen` und die acht Abnahmepunkte aus Spec §9 benennen.

- [ ] **Step 6: Tore**

```powershell
npm run rebuild -w @jm/zoom-bridge
npm run selftest -w @jm/zoom-bridge
npm run typecheck --workspaces --if-present
npm run bool-probe -w @jm/zoom-bridge
npm run ndi-probe -w @jm/zoom-bridge
npm run command-probe -w @jm/zoom-bridge
```

- [ ] **Step 7: Commit**

```bash
git add packages/zoom-bridge/native/video.cpp packages/zoom-bridge/native/main.cpp packages/zoom-bridge/native/callbacks.cpp packages/zoom-bridge/test/join.mjs packages/zoom-bridge/README.md docs/roadmap.md
git status --short
git commit -m "feat(zoom-bridge): Ton-Abbau, Umhaengen, Anzeige und Dokumentation"
```

---

## Nach dem letzten Task

Alle acht Abnahmepunkte aus Spec §9 brauchen ein **echtes Meeting** und sind Owner-Schritte. Besonders mitzuschreiben:

1. **Welche Abtastrate und Kanalzahl Zoom wirklich liefert** — steht in keinem Header.
2. **Ob der Übergang von Stille auf Ton knackt** — davon hängt ab, ob die 40 ms bleiben.
3. **Lippensynchronität** — das größte verbleibende Risiko dieser Stufe.

Die offene Frage aus Spec §9 ist beim Planschreiben **beantwortet**: `@jm/ndi`
kann Ton empfangen (`NdiAudioFrame`, `packages/ndi/index.d.ts`). Der Tonweg ist
darum schon ohne Meeting belegt — durch `npm run ndi-probe` (Task 3). Was das
Meeting braucht, ist alles, was **Zoom** liefert: Format, Knacken, Synchronität.
