# Caption #204 — Fachwörter-Wörterbuch + schnellere Transkription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JM Caption bekommt (a) ein Fachwörter-Wörterbuch, das als whisper-Initial-Prompt die Erkennung von Eigennamen/Fachbegriffen verbessert, und (b) deutlich niedrigere Latenz durch einen persistenten `whisper-server` (Modell bleibt geladen) plus Schnell-Decode-Flags im CLI-Fallback.

**Architecture:** Reine, testbare String-Helfer in `src/shared/` (Prompt-Bau, CLI-Args, Server-Antwort-Parse) + ein impures Lifecycle-Modul `src/main/whisper-server.ts` (spawnt `whisper-server` einmal, spricht ihn per HTTP `/inference` an). `transcriber.ts` wählt anhand `config.engine` zwischen Server (Standard) und CLI, wobei ein kaputter/abwesender Server pro Äußerung still auf die CLI zurückfällt — Untertitel dürfen nie ausfallen. Zwei neue Config-Felder (`dictionary`, `engine`), im Renderer über ein ausklappbares „Erweitert"-Panel bedienbar.

**Tech Stack:** Electron (Main = Node 20 mit globalem `fetch`/`FormData`/`Blob`), React/Zustand-Renderer, whisper.cpp (`whisper-cli.exe` + `whisper-server.exe`, bereits im Windows-Bundle), `node --experimental-strip-types` als Test-Harness.

## Global Constraints

- **Ziel-Release:** `caption-v0.4.0` (package.json heute `0.3.1`).
- **Pure Helfer sind elektron-/node-frei** und liegen in `src/shared/` — sonst bricht `node --experimental-strip-types test/selftest.ts`. Threads/`os.cpus()`/`spawn`/`fetch` gehören ausschließlich in `src/main/`.
- **Zwei Default-Config-Literale müssen synchron bleiben:** `defaultConfig` in `src/main/index.ts:24-38` UND `FALLBACK_CFG` in `src/renderer/src/App.tsx:28-42`. Jedes neue `CaptionConfig`-Feld muss in BEIDEN stehen.
- **Windows-Office-Build:** `whisper-server.exe` wird auf Windows bereits gebündelt (der Bundler kopiert in `tools/bundle-whisper.mjs:137-143` den ganzen `WHISPER_DIR`-Ordner, alle `.exe/.dll`). Nur der macOS-Zweig braucht eine gezielte Ergänzung.
- **whisper-server-Port:** `127.0.0.1:8791` — außerhalb der Suite-Steuerports (8724–8737).
- **Fallback-Pflicht:** Ein abwesender/kaputter `whisper-server` fällt PRO ÄUSSERUNG still auf die CLI zurück (einmalige Log-Warnung, keine Dauerfehler).
- **CRLF:** Quelldateien sind CRLF → EOL-bewusst editieren. `changelog.json` NIE mit ASCII-Anführungszeichen, JSON vor Commit validieren.
- **whisper.cpp-Flags gegenprüfen:** `--prompt`, `-bs`/`-bo`/`-nf` (CLI) und die `whisper-server`-Formfelder (`file`/`response_format`/`language`/`prompt`) sind gegen die gebündelte Binary mit `whisper-cli --help` bzw. `whisper-server --help` auf dem echten Rechner zu bestätigen (Task 8). Sie sind bewusst in EINER Datei je Pfad isoliert (`whisper-args.ts`, `whisper-server.ts`), damit eine Namensänderung nur eine Stelle trifft.

---

## File Structure

- `src/shared/types.ts` — **Modify:** zwei Felder in `CaptionConfig` (`dictionary`, `engine`).
- `src/shared/prompt.ts` — **Create:** `buildPrompt()` (pur).
- `src/shared/whisper-args.ts` — **Create:** `buildCliArgs()` (pur).
- `src/shared/whisper-response.ts` — **Create:** `parseInferenceText()` (pur).
- `src/main/whisper-server.ts` — **Create:** persistenter Server-Lifecycle + HTTP-Inference (impur).
- `src/main/locate.ts` — **Modify:** `whisperServerPath()`.
- `src/main/transcriber.ts` — **Modify:** Prompt + CLI-Speed-Flags + Server-Pfad + Fallback + `stopServer()`.
- `src/main/index.ts` — **Modify:** `defaultConfig` um zwei Felder.
- `src/renderer/src/App.tsx` — **Modify:** `FALLBACK_CFG` + „Erweitert"-Panel.
- `tools/bundle-whisper.mjs` — **Modify:** `whisper-server` im macOS-Zweig mitnehmen.
- `test/selftest.ts` — **Modify:** Prüfungen für die drei pure Helfer.
- `package.json` / `changelog.json` — **Modify:** Version 0.4.0 + Katalog-Notes.

---

### Task 1: Config-Felder `dictionary` + `engine`

**Files:**
- Modify: `apps/caption/src/shared/types.ts:10-37`
- Modify: `apps/caption/src/main/index.ts:24-38`
- Modify: `apps/caption/src/renderer/src/App.tsx:28-42`

**Interfaces:**
- Produces: `CaptionConfig.dictionary: string`, `CaptionConfig.engine: 'server' | 'cli'` — von Task 3/5/6 konsumiert.

- [ ] **Step 1: Felder in `CaptionConfig` ergänzen**

In `src/shared/types.ts`, direkt nach `audioInputDeviceId: string;` (Zeile 21) einfügen:

```ts
  /** Fachwörter/Eigennamen, eine je Zeile — als Initial-Prompt an whisper übergeben (#204). */
  dictionary: string;
  /** Transkriptions-Backend: 'server' (persistent, schnell) | 'cli' (pro Äußerung). */
  engine: 'server' | 'cli';
```

- [ ] **Step 2: `defaultConfig` (Main) ergänzen**

In `src/main/index.ts`, im `defaultConfig`-Objekt nach `audioInputDeviceId: '',` einfügen:

```ts
  dictionary: '',
  engine: 'server',
```

- [ ] **Step 3: `FALLBACK_CFG` (Renderer) ergänzen**

In `src/renderer/src/App.tsx`, im `FALLBACK_CFG`-Objekt nach `audioInputDeviceId: '',` einfügen:

```ts
  dictionary: '',
  engine: 'server',
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w @jm/caption`
Expected: PASS (node + web, 0 Fehler).

- [ ] **Step 5: Commit**

```bash
git add apps/caption/src/shared/types.ts apps/caption/src/main/index.ts apps/caption/src/renderer/src/App.tsx
git commit -m "feat(caption): Config-Felder dictionary + engine (#204)"
```

---

### Task 2: Pure Helfer (Prompt, CLI-Args, Server-Antwort) + Selftest

**Files:**
- Create: `apps/caption/src/shared/prompt.ts`
- Create: `apps/caption/src/shared/whisper-args.ts`
- Create: `apps/caption/src/shared/whisper-response.ts`
- Test: `apps/caption/test/selftest.ts` (erweitern)

**Interfaces:**
- Produces:
  - `buildPrompt(dictionary: string, maxChars?: number): string`
  - `buildCliArgs(o: CliArgsOpts): string[]` mit `interface CliArgsOpts { model: string; wav: string; outBase: string; language: string; prompt: string; threads: number; fast: boolean }`
  - `parseInferenceText(body: string): string`

- [ ] **Step 1: Failing test — die drei Helfer in `test/selftest.ts` prüfen**

In `test/selftest.ts` NACH dem `rms`-Block (vor der `console.log(failed === 0 ...)`-Zeile) einfügen:

```ts
// ── buildPrompt ────────────────────────────────────────────────────────────
import { buildPrompt } from '../src/shared/prompt.ts';
eq(buildPrompt(''), '', 'leeres Wörterbuch → leerer Prompt');
eq(buildPrompt('  \n  \n'), '', 'nur Leerzeilen → leerer Prompt');
eq(buildPrompt('iveo\n Jakobs Medien \n\nNITROVON'), 'iveo, Jakobs Medien, NITROVON', 'Zeilen → getrimmt, komma-verbunden, Leerzeilen weg');
eq(buildPrompt('aaaa\nbbbb\ncccc', 8), 'aaaa', 'maxChars kappt am letzten vollständigen Begriff');

// ── buildCliArgs ───────────────────────────────────────────────────────────
import { buildCliArgs } from '../src/shared/whisper-args.ts';
eq(
  buildCliArgs({ model: 'M', wav: 'W', outBase: 'O', language: 'auto', prompt: '', threads: 0, fast: false }),
  ['-m', 'M', '-f', 'W', '-nt', '-otxt', '-of', 'O'],
  'Basis-Args ohne Sprache/Prompt/Threads/Fast',
);
eq(
  buildCliArgs({ model: 'M', wav: 'W', outBase: 'O', language: 'de', prompt: 'iveo', threads: 4, fast: true }),
  ['-m', 'M', '-f', 'W', '-nt', '-otxt', '-of', 'O', '-l', 'de', '--prompt', 'iveo', '-t', '4', '-bs', '1', '-bo', '1', '-nf'],
  'volle Args: Sprache + Prompt + Threads + Greedy',
);

// ── parseInferenceText ─────────────────────────────────────────────────────
import { parseInferenceText } from '../src/shared/whisper-response.ts';
eq(parseInferenceText('{"text":"  hallo welt "}'), 'hallo welt', 'JSON {text} → getrimmt');
eq(parseInferenceText('roher text\n'), 'roher text', 'kein JSON → Rohtext getrimmt');
eq(parseInferenceText(''), '', 'leer → leer');
eq(parseInferenceText('{kaputt'), '{kaputt', 'malformed JSON → Rohtext');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run selftest -w @jm/caption`
Expected: FAIL — `Cannot find module '../src/shared/prompt.ts'` (Helfer existieren noch nicht).

- [ ] **Step 3: `src/shared/prompt.ts` schreiben**

```ts
// Baut aus dem Fachwörter-Wörterbuch (eine Zeile = ein Begriff/Phrase) den
// Initial-Prompt für whisper.cpp. whisper.cpp kennt KEINE echten "hotwords" —
// der Initial-Prompt (--prompt) ist der einzige Bias-Hebel. Er zählt gegen das
// Text-Kontext-Budget (n_text_ctx/2 ≈ 224 Tokens), daher auf maxChars gekappt.
export function buildPrompt(dictionary: string, maxChars = 800): string {
  const terms = dictionary
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (terms.length === 0) return '';
  let out = terms.join(', ');
  if (out.length > maxChars) {
    // Am letzten vollständigen Begriff kappen (kein halber Term im Prompt).
    out = out.slice(0, maxChars).replace(/,[^,]*$/, '').trim();
  }
  return out;
}
```

- [ ] **Step 4: `src/shared/whisper-args.ts` schreiben**

```ts
// whisper-cli-Argumente (Einzel-Äußerung → -otxt). Isoliert, damit ein
// whisper.cpp-Flag-Namenswechsel nur diese Datei trifft. Speed-Flags (#204):
//   -t Threads · -bs 1 -bo 1 Greedy statt Beam · -nf keine Temperatur-Rückfälle.
export interface CliArgsOpts {
  model: string;
  wav: string;
  outBase: string;
  language: string; // 'auto' | ISO-Code
  prompt: string; // '' = keiner
  threads: number; // >0 → -t
  fast: boolean; // Greedy-Decode
}

export function buildCliArgs(o: CliArgsOpts): string[] {
  const args = ['-m', o.model, '-f', o.wav, '-nt', '-otxt', '-of', o.outBase];
  if (o.language && o.language !== 'auto') args.push('-l', o.language);
  if (o.prompt) args.push('--prompt', o.prompt);
  if (o.threads > 0) args.push('-t', String(o.threads));
  if (o.fast) args.push('-bs', '1', '-bo', '1', '-nf');
  return args;
}
```

- [ ] **Step 5: `src/shared/whisper-response.ts` schreiben**

```ts
// whisper-server /inference liefert bei response_format=json ein { text: "…" }.
// Schlägt das Parsen fehl (anderes Format / Fehlertext), den Rohtext trimmen.
export function parseInferenceText(body: string): string {
  const t = body.trim();
  if (!t) return '';
  try {
    const j = JSON.parse(t) as { text?: unknown };
    if (j && typeof j.text === 'string') return j.text.trim();
  } catch {
    /* kein JSON → Rohtext */
  }
  return t;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run selftest -w @jm/caption`
Expected: PASS — `ALLE TESTS OK` (die bestehenden WAV/RMS-Prüfungen + die 10 neuen).

- [ ] **Step 7: Commit**

```bash
git add apps/caption/src/shared/prompt.ts apps/caption/src/shared/whisper-args.ts apps/caption/src/shared/whisper-response.ts apps/caption/test/selftest.ts
git commit -m "feat(caption): pure Helfer buildPrompt/buildCliArgs/parseInferenceText + Tests (#204)"
```

---

### Task 3: CLI-Pfad verdrahten (Prompt + Speed-Flags + Threads)

**Files:**
- Modify: `apps/caption/src/main/transcriber.ts:87-142` (die `transcribeOne`-Funktion) + Importe (Zeile 9-15).

**Interfaces:**
- Consumes: `buildPrompt`, `buildCliArgs` (Task 2), `CaptionConfig.dictionary` (Task 1).
- Produces: `transcribeOne` nutzt jetzt `buildCliArgs` statt handgeschriebener Args (Server-Pfad kommt in Task 5).

- [ ] **Step 1: Importe ergänzen**

In `src/main/transcriber.ts`, nach Zeile 14 (`import { floatToWav16 } from '@shared/wav';`) einfügen:

```ts
import { buildPrompt } from '@shared/prompt';
import { buildCliArgs } from '@shared/whisper-args';
import { cpus } from 'node:os';
```

- [ ] **Step 2: Threads-Konstante ergänzen**

In `src/main/transcriber.ts`, nach `let seq = 0;` (Zeile 28) einfügen:

```ts
// Threads für whisper (Auto, aber gekappt gegen Oversubscription auf kleinen Kernen).
const THREADS = Math.max(1, Math.min(8, cpus().length));
```

- [ ] **Step 3: Args-Bau in `transcribeOne` ersetzen**

In `src/main/transcriber.ts` die bestehende Args-Zeile (Zeile 112-113):

```ts
    const args = ['-m', model, '-f', wav, '-nt', '-otxt', '-of', outBase];
    if (cfg.language && cfg.language !== 'auto') args.push('-l', cfg.language);
```

ersetzen durch:

```ts
    const args = buildCliArgs({
      model,
      wav,
      outBase,
      language: cfg.language,
      prompt: buildPrompt(cfg.dictionary),
      threads: THREADS,
      fast: true, // Live-Untertitel: Greedy-Decode, Tempo vor letzter Genauigkeit
    });
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w @jm/caption`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/caption/src/main/transcriber.ts
git commit -m "feat(caption): CLI-Pfad nutzt Prompt + Threads + Greedy-Decode (#204)"
```

---

### Task 4: whisper-server — locate + Lifecycle-Modul

**Files:**
- Modify: `apps/caption/src/main/locate.ts:29-40`
- Create: `apps/caption/src/main/whisper-server.ts`

**Interfaces:**
- Consumes: `parseInferenceText` (Task 2).
- Produces:
  - `whisperServerPath(): string | null` (locate.ts)
  - `ensureServer(bin: string, model: string, threads: number): Promise<void>`
  - `serverInfer(wav: string, opts: { language: string; prompt: string; fast: boolean }): Promise<string>`
  - `stopServer(): void`

- [ ] **Step 1: `whisperServerPath()` in `locate.ts` ergänzen**

In `src/main/locate.ts`, nach der `WHISPER_NAMES`-Konstante (Zeile 30) einfügen:

```ts
const WHISPER_SERVER_NAMES = ['whisper-server'];
```

und nach der `whisperPath()`-Funktion (vor `whisperAvailable`, Zeile 41) einfügen:

```ts
/** Pfad zum persistenten whisper-server (gebündelt) oder null. */
export function whisperServerPath(): string | null {
  for (const name of WHISPER_SERVER_NAMES) {
    const p = path.join(bundledBinDir(), exe(name));
    if (existsSync(p)) return p;
  }
  return null;
}
```

- [ ] **Step 2: `src/main/whisper-server.ts` schreiben**

```ts
// Persistenter whisper.cpp-HTTP-Server (Modell EINMAL geladen) — löst den fixen
// Modell-Neuladen-Aufwand pro Äußerung, der die ~10s-Latenz verursacht (#204).
// Lifecycle: bei Modellwechsel neu starten; Bereitschaft per GET / abwarten.
// Der Server hört nur auf Loopback (127.0.0.1:8791, außerhalb der Suite-Ports).
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseInferenceText } from '@shared/whisper-response';

const HOST = '127.0.0.1';
const PORT = 8791;

let child: ChildProcess | null = null;
let currentModel: string | null = null;
let ready = false;

export function stopServer(): void {
  ready = false;
  currentModel = null;
  if (child) {
    try {
      child.kill();
    } catch {
      /* egal */
    }
    child = null;
  }
}

async function waitReady(timeoutMs = 20000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://${HOST}:${PORT}/`, { method: 'GET' });
      if (r.ok) return true;
    } catch {
      /* Server noch nicht oben */
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  return false;
}

/** Server hochfahren bzw. bei Modellwechsel neu starten. Wirft, wenn nicht bereit. */
export async function ensureServer(bin: string, model: string, threads: number): Promise<void> {
  if (child && ready && currentModel === model) return;
  if (child) stopServer();
  const args = ['-m', model, '--host', HOST, '--port', String(PORT)];
  if (threads > 0) args.push('-t', String(threads));
  const c = spawn(bin, args, { windowsHide: true });
  child = c;
  currentModel = model;
  c.on('exit', () => {
    if (child === c) {
      child = null;
      ready = false;
      currentModel = null;
    }
  });
  ready = await waitReady();
  if (!ready) {
    stopServer();
    throw new Error('whisper-server nicht bereit');
  }
}

/** Eine Äußerung (WAV-Datei) über den laufenden Server transkribieren. */
export async function serverInfer(
  wav: string,
  opts: { language: string; prompt: string; fast: boolean },
): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'u.wav');
  form.append('response_format', 'json');
  if (opts.language && opts.language !== 'auto') form.append('language', opts.language);
  if (opts.prompt) form.append('prompt', opts.prompt);
  if (opts.fast) {
    // Per-Request-Speed (falls der Server sie ignoriert, schadet es nicht).
    form.append('beam_size', '1');
    form.append('best_of', '1');
  }
  const r = await fetch(`http://${HOST}:${PORT}/inference`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`inference ${r.status}`);
  return parseInferenceText(await r.text());
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck:node -w @jm/caption`
Expected: PASS.
**Falls** `fetch`/`FormData`/`Blob` als „not defined" gemeldet werden (alte `@types/node`): sie sind Node-20-Globals; kein Code-Fix, sondern in `apps/caption/tsconfig.node.json` sicherstellen, dass `@types/node` ≥ 20 aufgelöst wird (bzw. `"lib": [..., "DOM"]` NICHT nötig — die Typen kommen aus `undici-types` via `@types/node`).

- [ ] **Step 4: Commit**

```bash
git add apps/caption/src/main/locate.ts apps/caption/src/main/whisper-server.ts
git commit -m "feat(caption): whisper-server locate + persistenter Lifecycle (#204)"
```

---

### Task 5: Server-Pfad + Auto-Fallback in `transcriber.ts`

**Files:**
- Modify: `apps/caption/src/main/transcriber.ts` (Importe, `transcribeOne`, `stopTranscriber`).

**Interfaces:**
- Consumes: `whisperServerPath` (Task 4), `ensureServer`/`serverInfer`/`stopServer` (Task 4), `CaptionConfig.engine` (Task 1).
- Produces: `transcribeOne` versucht bei `engine==='server'` den Server und fällt pro Äußerung still auf die CLI zurück; `stopTranscriber` beendet den Server mit.

- [ ] **Step 1: Importe ergänzen**

In `src/main/transcriber.ts`, die Import-Zeile aus Task 3 (`import { bundledModelsDir, whisperPath } from './locate';`, Zeile 13) erweitern zu:

```ts
import { bundledModelsDir, whisperPath, whisperServerPath } from './locate';
import { ensureServer, serverInfer, stopServer } from './whisper-server';
```

- [ ] **Step 2: `stopTranscriber` erweitert den Server-Stopp**

In `src/main/transcriber.ts`, in `stopTranscriber()` (Zeile 52-62) nach `queue = [];` einfügen:

```ts
  stopServer();
```

- [ ] **Step 3: Server-Pfad in `transcribeOne` einbauen (mit CLI-Fallback)**

In `src/main/transcriber.ts`, `transcribeOne` so umbauen, dass der WAV geschrieben und dann je nach Engine transkribiert wird. Den Block von der WAV-Schreibzeile bis zum `child.on('close', …)` (Zeile 105-141) ersetzen durch:

```ts
    try {
      writeFileSync(wav, floatToWav16(pcm, sampleRate));
    } catch {
      resolve('');
      return;
    }

    const prompt = buildPrompt(cfg.dictionary);
    const cleanup = (): void => {
      try {
        rmSync(wav, { force: true });
        rmSync(`${outBase}.txt`, { force: true });
      } catch {
        /* egal */
      }
    };

    // ── Server-Pfad (persistent, schnell) mit stillem CLI-Fallback ───────────
    const server = whisperServerPath();
    if (cfg.engine === 'server' && server) {
      void (async () => {
        try {
          await ensureServer(server, model, THREADS);
          const text = await serverInfer(wav, { language: cfg.language, prompt, fast: true });
          hooks!.onError(null);
          cleanup();
          resolve(text);
        } catch (err) {
          // Server kaputt/nicht bereit → diese Äußerung über die CLI, Untertitel laufen weiter.
          hooks!.onError('whisper-server nicht verfügbar — nutze CLI.');
          runCli();
        }
      })();
      return;
    }
    runCli();

    function runCli(): void {
      const args = buildCliArgs({
        model,
        wav,
        outBase,
        language: cfg.language,
        prompt,
        threads: THREADS,
        fast: true,
      });
      const child = spawn(bin, args, { windowsHide: true });
      current = child;
      const done = (text: string): void => {
        current = null;
        cleanup();
        resolve(text);
      };
      child.on('error', () => {
        hooks!.onError('whisper-Start fehlgeschlagen.');
        done('');
      });
      child.on('close', () => {
        let text = '';
        try {
          text = readFileSync(`${outBase}.txt`, 'utf8').trim();
        } catch {
          /* keine Ausgabe */
        }
        hooks!.onError(null);
        done(text);
      });
    }
```

**Hinweis:** Die alten `const args = buildCliArgs({…})` aus Task 3 und der alte `child`/`done`-Block werden durch `runCli()` ersetzt (Task 3 war die Zwischenstufe ohne Server). Es darf danach nur EIN Args-Bau/`spawn` in der Funktion stehen (in `runCli`).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w @jm/caption`
Expected: PASS.

- [ ] **Step 5: Selftest (Regression) — pure Helfer weiterhin grün**

Run: `npm run selftest -w @jm/caption`
Expected: PASS — `ALLE TESTS OK`.

- [ ] **Step 6: Commit**

```bash
git add apps/caption/src/main/transcriber.ts
git commit -m "feat(caption): Server-Pfad mit stillem CLI-Fallback + Server-Stopp (#204)"
```

---

### Task 6: Renderer — „Erweitert"-Panel (Wörterbuch · Engine · Fenster)

**Files:**
- Modify: `apps/caption/src/renderer/src/App.tsx` (State + JSX nach der NDI-Leiste).

**Interfaces:**
- Consumes: `CaptionConfig.dictionary`, `CaptionConfig.engine` (Task 1); `setConfig` (bereits vorhanden).

- [ ] **Step 1: Sichtbarkeits-State ergänzen**

In `src/renderer/src/App.tsx`, nach `const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);` (Zeile 54) einfügen:

```tsx
  const [showAdv, setShowAdv] = useState(false);
```

- [ ] **Step 2: „Erweitert"-Panel nach der NDI-Leiste einfügen**

In `src/renderer/src/App.tsx`, direkt NACH dem schließenden `</div>` der NDI-Leiste (Zeile 275) und VOR dem `{/* Warnungen */}`-Kommentar einfügen:

```tsx
      {/* Erweitert: Wörterbuch · Engine · Fenster (#204) */}
      <div className="border-b border-neutral-800 px-4 py-1.5">
        <button
          onClick={() => setShowAdv((v) => !v)}
          className="text-xs text-neutral-400 hover:text-neutral-200"
        >
          {showAdv ? '▾' : '▸'} Erweitert (Wörterbuch · Engine · Fenster)
        </button>
        {showAdv && (
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Fachwörter-Wörterbuch (eine je Zeile)
              <textarea
                value={c.dictionary}
                onChange={(e) => void setConfig({ dictionary: e.target.value })}
                rows={4}
                placeholder={'z. B.\nJakobs Medien\niveo\nNITROVON'}
                className="w-72 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Engine
              <select
                value={c.engine}
                onChange={(e) => void setConfig({ engine: e.target.value as CaptionConfig['engine'] })}
                className={sel}
              >
                <option value="server">Server (schnell, Modell bleibt geladen)</option>
                <option value="cli">CLI (pro Äußerung)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Max. Äußerung (s)
              <input
                type="number"
                min={2}
                max={15}
                value={c.maxUtteranceSec}
                onChange={(e) => void setConfig({ maxUtteranceSec: Number(e.target.value) })}
                className={`${sel} w-20`}
              />
            </label>
          </div>
        )}
      </div>
```

- [ ] **Step 3: Typecheck + Build (Renderer)**

Run: `npm run typecheck:web -w @jm/caption && npm run build -w @jm/caption`
Expected: PASS (build emittiert Main + Renderer ohne Fehler).

- [ ] **Step 4: Commit**

```bash
git add apps/caption/src/renderer/src/App.tsx
git commit -m "feat(caption): Erweitert-Panel für Wörterbuch/Engine/Fenster (#204)"
```

---

### Task 7: Bundler — `whisper-server` auf macOS mitnehmen (Windows unverändert)

**Files:**
- Modify: `apps/caption/tools/bundle-whisper.mjs` (nur der macOS-Zweig, Zeile 88-114).

**Interfaces:** keine (Build-Tooling).

**Kontext:** Der Windows-Zweig (Zeile 137-143) kopiert bereits ALLE `.exe/.dll` aus `WHISPER_DIR` → `whisper-server.exe` ist auf Windows schon gebündelt, **keine Änderung nötig**. Der macOS-Zweig kopiert nur `CLI_PRIORITY` + `*.dylib` → `whisper-server` würde fehlen. `whisper-server` darf NICHT in `CLI_PRIORITY` (sonst hielte `locate.ts` ihn für die CLI) — daher ein eigener, gezielter Kopierschritt.

- [ ] **Step 1: macOS-Kopie für `whisper-server` ergänzen**

In `tools/bundle-whisper.mjs`, im macOS-Zweig NACH der `copiedDylibs`-Bereinigungsschleife (nach Zeile 112, vor `const cliName = …`) einfügen:

```js
  // whisper-server für den persistenten Modus (#204) — NICHT in CLI_PRIORITY,
  // sonst hielte locate.ts ihn für die CLI. Gleiche rpath-Behandlung wie die CLI.
  const srvSrc = join(whisperDir, 'whisper-server');
  if (existsSync(srvSrc) && statSync(srvSrc).isFile()) {
    const dst = join(binDest, 'whisper-server');
    copyFileSync(srvSrc, dst);
    chmodSync(dst, 0o755);
    try {
      execFileSync('install_name_tool', ['-add_rpath', '@loader_path', dst], { stdio: 'pipe' });
    } catch (err) {
      if (!/would duplicate|already/.test(String(err.stderr || err.message || ''))) throw err;
    }
    for (const rp of otherRpaths(dst)) execFileSync('install_name_tool', ['-delete_rpath', rp, dst]);
    console.log(`bundled whisper-server → ${dst}`);
  }
```

- [ ] **Step 2: Syntax-Check (kein Build nötig — reines Node-Skript)**

Run: `node --check apps/caption/tools/bundle-whisper.mjs`
Expected: PASS (kein Output, Exit 0).

- [ ] **Step 3: Commit**

```bash
git add apps/caption/tools/bundle-whisper.mjs
git commit -m "build(caption): whisper-server im macOS-Bundle mitnehmen (#204)"
```

---

### Task 8: Verifikation (echte Maschine) + Version-Bump 0.4.0 + Changelog

**Files:**
- Modify: `apps/caption/package.json` (Version).
- Modify: `changelog.json` (Repo-Wurzel, Katalog-Notes).

**Interfaces:** keine.

**Hinweis:** Der eigentliche Release (nativer Windows-Build + Tag + Upload) ist ein manueller Owner-Schritt (Caption = „Office-Build" mit whisper-Binaries + Modell, CI überspringt `caption-v`). Diese Aufgabe bereitet ihn vor und verifiziert die Funktion.

- [ ] **Step 1: Manuelle Verifikation auf dem Windows-Rechner mit gebündelter whisper-Binary**

Voraussetzung: `npm run dist:win -w @jm/caption` gebaut (oder `resources/bin/win` enthält `whisper-cli.exe` + `whisper-server.exe` + `ggml-*.dll` + `resources/models/ggml-base.bin`). Dann im installierten Build prüfen:

- [ ] **Latenz-Basislinie messen:** „Erweitert" → Engine **CLI**, sprechen, Zeit von Sprechende bis Untertitel notieren.
- [ ] **Server-Gewinn messen:** Engine **Server**, gleiche Sätze — die erste Äußerung nach Umschalten ist langsamer (Server lädt Modell einmal), danach deutlich schneller. Differenz notieren (Erwartung: der konstante Reload-Anteil fällt weg).
- [ ] **Wörterbuch-Bias:** Fachbegriff (z. B. Eigenname) ins Wörterbuch, denselben Satz sprechen — der Begriff wird jetzt korrekt geschrieben.
- [ ] **Fallback-Beweis:** `whisper-server.exe` in `resources/bin/win` temporär umbenennen, Engine=Server, sprechen → Untertitel kommen weiter (CLI-Fallback), Fehlerband „nutze CLI" erscheint einmal. Danach zurückbenennen.

Beobachtungen unten in diesem Task als Kommentar festhalten (dient dem Release-Text).

- [ ] **Step 2: Version bump auf 0.4.0**

Run: `npm version 0.4.0 --no-git-tag-version -w @jm/caption`
Expected: `apps/caption/package.json` steht auf `"version": "0.4.0"`.

- [ ] **Step 3: Changelog-Eintrag ergänzen (textuell, quote-frei)**

In `changelog.json` (Repo-Wurzel) beim Tool `jm-caption` einen Eintrag für `0.4.0` VORNE ergänzen (neueste zuerst), Muster exakt wie die Nachbar-Einträge. Notes (keine ASCII-Anführungszeichen, deutsche „…" oder gar keine):

```
Fachwörter-Woerterbuch: Eigennamen und Fachbegriffe werden zuverlaessiger erkannt.
Schnellere Transkription: persistenter whisper-Server haelt das Modell geladen; CLI-Fallback bleibt.
```

- [ ] **Step 4: JSON validieren**

Run: `node -e "JSON.parse(require('fs').readFileSync('changelog.json','utf8')); console.log('changelog.json ok')"`
Expected: `changelog.json ok`.

- [ ] **Step 5: Repo-weiter Typecheck (Sicherheitsnetz)**

Run: `npm run typecheck -w @jm/caption`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/caption/package.json changelog.json
git commit -m "release(caption): 0.4.0 — Woerterbuch + schnellere Transkription (#204)"
```

- [ ] **Step 7: Release-Übergabe an den Owner (kein Agent-Schritt)**

Nativer Build + Tag + Upload nach dem Caption-Office-Build-Runbook:
`npm run dist:win -w @jm/caption` (setzt `WHISPER_DIR` + `WHISPER_MODEL_BASE`; bei nur-JS-Änderung ggf. Binaries aus dem 0.3.1-Build wiederverwenden) → `gh release create caption-v0.4.0 --prerelease …` + `gh release upload` + Katalog-Bump `node scripts/bump-manifest.mjs caption 0.4.0`. Erst releasen, dann mergen.

---

## Self-Review

- **Spec-Abdeckung:** (a) Wörterbuch → Task 2 (`buildPrompt`) + Task 3/5 (`--prompt`) + Task 6 (UI). (b) Latenz → Task 3 (Speed-Flags) + Task 4/5 (whisper-server) + Task 6 (Fenster-Knopf). Beides gestaffelt in einem Release → Task 8. ✔
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typkonsistenz:** `CliArgsOpts`-Felder identisch in Task 2 (Definition), Task 3 und Task 5 (Nutzung: `model/wav/outBase/language/prompt/threads/fast`). `CaptionConfig.dictionary`/`engine` in Task 1 definiert, in Task 3/5/6 genutzt. `buildPrompt(string)`, `parseInferenceText(string)`, `ensureServer(bin, model, threads)`, `serverInfer(wav, {language, prompt, fast})` durchgängig gleich.
- **Fallback-Invariante** (Global Constraint) durch Task 5 erfüllt: kein Server / Server-Fehler → CLI pro Äußerung.
