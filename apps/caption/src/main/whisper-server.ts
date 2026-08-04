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
