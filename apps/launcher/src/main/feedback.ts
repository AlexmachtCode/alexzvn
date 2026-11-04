import { app } from 'electron';
import { release } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ActionResult, FeedbackInput } from '@shared/types';
import { resolveProxy, resolveToken } from './settings';
import { workerRecht, zugangsKopfFuer } from './konto/huelle';
import { getLogSources } from './presence';
import { getTools } from './manifest';

const FALLBACK_REPO = 'AlexmachtCode/alexzvn';
const MAX_LINES_PER_LOG = 120;
const MAX_BUNDLE_CHARS = 30_000;
/** F3 (Anmeldung P22, 9.7): weder Worker (Sitzung oder Entwicklungs-Schlüssel) noch GitHub-Zugang. */
const TEXT_FEEDBACK_ANMELDEN = 'Zum Senden von Feedback im Launcher anmelden (oben rechts).';

/** Alle Tools teilen sich dasselbe Repo; sonst Fallback. */
function repo(): string {
  return getTools()[0]?.repo || FALLBACK_REPO;
}

/** Kontextzeile fürs Issue (Version + OS) — hilft beim Reproduzieren. */
function contextLine(): string {
  return `Launcher ${app.getVersion()} · ${process.platform} ${release()}`;
}

function tailLines(text: string, lines: number): string {
  return text.split(/\r?\n/).slice(-lines).join('\n');
}

/** main.log (letzte Zeilen) + last-crash.json eines Log-Verzeichnisses lesen. */
function readLogDir(dir: string): { log?: string; crash?: string } {
  const out: { log?: string; crash?: string } = {};
  try {
    const f = join(dir, 'main.log');
    if (existsSync(f)) out.log = tailLines(readFileSync(f, 'utf8'), MAX_LINES_PER_LOG).trim();
  } catch {
    /* nicht lesbar → überspringen */
  }
  try {
    const c = join(dir, 'last-crash.json');
    if (existsSync(c)) out.crash = readFileSync(c, 'utf8').trim();
  } catch {
    /* nicht lesbar → überspringen */
  }
  return out;
}

/**
 * Sammelt Logs für den Fehlerbericht: zuerst der Launcher selbst, dann jedes
 * Tool, das sich beim Presence-Hub gemeldet hat (logDir aus dem Heartbeat).
 * Pro Quelle die letzten Zeilen der main.log und ggf. die Crash-Marke — auf
 * MAX_BUNDLE_CHARS gekürzt, in einem zusammenklappbaren <details>-Block.
 */
function collectLogBundle(): string {
  const sources: { name: string; dir: string }[] = [
    { name: 'JM Production Suite (Launcher)', dir: join(app.getPath('userData'), 'logs') },
    ...getLogSources().map((s) => ({ name: s.name, dir: s.logDir })),
  ];

  const blocks: string[] = [];
  let used = 0;
  let truncated = false;
  for (const src of sources) {
    const { log, crash } = readLogDir(src.dir);
    if (!log && !crash) continue;
    let block = `### ${src.name}\n`;
    if (crash) block += `\n**last-crash.json**\n\n\`\`\`json\n${crash}\n\`\`\`\n`;
    if (log) block += `\n**main.log (letzte ${MAX_LINES_PER_LOG} Zeilen)**\n\n\`\`\`text\n${log}\n\`\`\`\n`;
    if (used + block.length > MAX_BUNDLE_CHARS) {
      truncated = true;
      break;
    }
    used += block.length;
    blocks.push(block);
  }
  if (blocks.length === 0) return '';
  const note = truncated ? '\n_… weitere Logs aus Platzgründen gekürzt._\n' : '';
  return `\n\n<details>\n<summary>📋 Logs (automatisch angehängt)</summary>\n\n${blocks.join('\n')}${note}\n</details>`;
}

/**
 * Meldet Bug/Wunsch als GitHub-Issue. Primär über den Release-Proxy (Client
 * bleibt tokenlos, serverseitiges Token legt das Issue an); fällt auf ein lokal
 * konfiguriertes GitHub-Token zurück (braucht dann issues:write).
 */
export async function submitFeedback(input: FeedbackInput): Promise<ActionResult> {
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || !description) {
    return { ok: false, message: 'Bitte Titel und Beschreibung ausfüllen.' };
  }

  // Optionaler Log-Anhang (opt-in) — hängt an die Beschreibung, damit er über
  // beide Kanäle (Proxy wie Token) im Issue-Body landet. Fehler beim Sammeln
  // dürfen die Meldung nie verhindern.
  let logBundle = '';
  if (input.includeLogs) {
    try {
      logBundle = collectLogBundle();
    } catch {
      logBundle = '';
    }
  }
  const fullDescription = description + logBundle;

  // 1) Über den Worker (Anmeldung P22, Spec 9.1: Feedback darf jede Stufe; das Recht wird vor dem Abruf geprüft).
  const proxy = resolveProxy();
  if (proxy && (await workerRecht('feedback'))) {
    const ziel = `${proxy.replace(/\/$/, '')}/feedback`;
    try {
      const res = await fetch(ziel, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await zugangsKopfFuer(ziel)) },
        body: JSON.stringify({
          type: input.type,
          title,
          description: fullDescription,
          context: contextLine(),
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { url?: string };
        return { ok: true, message: data.url ? `Danke! Gemeldet: ${data.url}` : 'Danke, gemeldet!' };
      }
      // Proxy erreichbar, aber Fehler → Token-Fallback versuchen.
    } catch {
      // Netzwerkfehler → Token-Fallback versuchen.
    }
  }

  // 2) Direktes GitHub-Token (Fallback; braucht issues:write).
  const token = resolveToken();
  if (token) {
    const isBug = input.type === 'bug';
    const body =
      fullDescription +
      '\n\n---\n_Aus dem JM Production Suite Launcher gemeldet_' +
      `\n\n\`\`\`\n${contextLine()}\n\`\`\``;
    try {
      const res = await fetch(`https://api.github.com/repos/${repo()}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: `[${isBug ? 'Bug' : 'Wunsch'}] ${title}`,
          body,
          labels: [isBug ? 'bug' : 'enhancement', 'from-launcher'],
        }),
      });
      if (res.ok) {
        const issue = (await res.json()) as { html_url?: string };
        return {
          ok: true,
          message: issue.html_url ? `Danke! Gemeldet: ${issue.html_url}` : 'Danke, gemeldet!',
        };
      }
      return { ok: false, message: `GitHub-Fehler ${res.status} (Token braucht issues:write).` };
    } catch (e) {
      return { ok: false, message: `Senden fehlgeschlagen: ${String((e as Error).message || e)}` };
    }
  }

  return { ok: false, message: TEXT_FEEDBACK_ANMELDEN };
}
