// JM Production Suite — Release-Proxy (Cloudflare Worker)
//
// Hält EIN GitHub-Token serverseitig und liefert den Clients (Launcher) pro Tool
// die neueste Version + eine zeitlich begrenzte, signierte Download-URL. Damit
// braucht KEIN Client ein GitHub-Token. Zugriff auf den Proxy selbst wird über
// einen einfachen Proxy-Key geschützt.
//
// Vertrag (entspricht ProxyReleaseSource im Launcher):
//   GET /tools/:id/latest?platform=<mac|win>&arch=<arm64|x64>
//   Header: X-Proxy-Key: <PROXY_KEY>   (oder Authorization: Bearer <PROXY_KEY>)
//   → 200 { version, assets: { <platform>: { url, size, fileName } } }
//
// Secrets (verschlüsselt, via `wrangler secret put` oder Dashboard):
//   GITHUB_TOKEN  fine-grained PAT, read-only Contents auf REPO
//   PROXY_KEY     gemeinsamer Key, den die Clients mitschicken
// Variable (Klartext, in wrangler.toml [vars]):
//   REPO          z. B. "AlexmachtCode/alexzvn"

// Geteilter Rezept-Kern (pur, Worker-tauglich) für den KI-Authoring-Flow.
// wrangler/esbuild bündelt diese ESM-Module beim Deploy mit ein.
import { validateRecipe, renderRecipeMarkdown, CATEGORY_SLUG } from '../../packages/cookbook/src/recipe-core.mjs';
import { buildAuthoringPrompt } from '../../packages/cookbook/src/authoring-prompt.mjs';
// Q&A externe Einreichung (#166) — eigenes Modul, hält worker.js schlank.
import { handleQa } from './qa-relay.js';
// Remote-Zuschaltung / Signalling (Welle 6) — Routing + ConnectRoom Durable Object.
import { handleConnect, ConnectRoom } from './connect-relay.js';

// Durable-Object-Klassen müssen aus dem Worker-Haupt-Modul re-exportiert werden.
export { ConnectRoom };

const USER_AGENT = 'JM-Suite-Release-Proxy';

// Anti-Missbrauch (P3, #61): Body-Größen- und Rate-Limit-Grenzen für die
// SCHREIBENDEN Endpunkte. /feedback legt GitHub-Issues an, /cookbook/draft öffnet
// PRs (und ruft ggf. die teure Anthropic-API) → ohne Limits offen für Spam und
// Kosten-Missbrauch. Werte per [vars] in wrangler.toml überschreibbar.
const LIMITS = {
  feedback: { maxBytes: 16 * 1024, rlMax: 10, rlWindowSec: 600 },
  draft: { maxBytes: 32 * 1024, rlMax: 5, rlWindowSec: 3600 },
};
// Harte Feld-Kappungen (Zeichen) — begrenzen Body und Prompt-Injection-Fläche.
const FIELD = { title: 200, description: 8000, context: 8000, notes: 12000, category: 80 };

class HttpError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}

/** JSON lesen mit harter Größengrenze (Content-Length UND tatsächliche Bytes). */
async function readJsonLimited(request, maxBytes) {
  const cl = request.headers.get('content-length');
  if (cl && Number(cl) > maxBytes) throw new HttpError(413, 'Anfrage zu groß');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new HttpError(413, 'Anfrage zu groß');
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new HttpError(400, 'ungültiges JSON');
  }
}

/** Feld trimmen + hart auf maxLen kappen (gegen null/Objekte robust). */
function clampField(v, maxLen) {
  return String(v == null ? '' : v).trim().slice(0, maxLen);
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Fixed-Window-Rate-Limit pro Client-IP über Workers-KV (env.RATELIMIT).
 * → {ok:true} oder {ok:false, retryAfter}. Fehlt die KV-Bindung (noch nicht
 * eingerichtet), wird NICHT geblockt, aber pro Aufruf gewarnt — damit der
 * Schutz nicht still wirkungslos bleibt. KV ist eventually-consistent → unter
 * Burst evtl. leicht untergezählt; für Anti-Spam ausreichend.
 */
async function rateLimit(env, bucket, ip, max, windowSec) {
  if (!env.RATELIMIT) {
    console.warn(`rate-limit: KV-Bindung RATELIMIT fehlt — ${bucket} ungedrosselt`);
    return { ok: true };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(nowSec / windowSec);
  const key = `rl:${bucket}:${ip}:${windowId}`;
  const current = Number((await env.RATELIMIT.get(key)) || 0);
  if (current >= max) return { ok: false, retryAfter: windowSec - (nowSec % windowSec) };
  // TTL = 2 Fenster, damit alte Zähler sicher ablaufen.
  await env.RATELIMIT.put(key, String(current + 1), { expirationTtl: windowSec * 2 });
  return { ok: true };
}

/** 429 mit Retry-After. */
function tooMany(retryAfter) {
  return new Response(JSON.stringify({ error: 'zu viele Anfragen' }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Retry-After': String(retryAfter || 60),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health-Check ohne Key (verrät nichts Sensibles).
    if (request.method === 'GET' && url.pathname === '/') {
      return text('JM Production Suite release proxy — ok');
    }

    // Q&A externe Einreichung (#166). Eigene Routing-Ebene: die ÖFFENTLICHEN
    // Einreich-Routen (Seite/submit/press/pubkey/state) müssen VOR dem PROXY_KEY-
    // Gate erreichbar sein (Zuschauer/Presse haben keinen Key); die Admin-Routen
    // (open/pending/ack/delete) prüfen den Key im Modul selbst. `null` = kein
    // Q&A-Pfad → normal weiter.
    const qa = await handleQa(request, env, url);
    if (qa) return qa;

    // Remote-Zuschaltung (Welle 6). Wie Q&A: öffentliche Routen (Gast-Seite/state/ice/ws) sind
    // vor dem PROXY_KEY-Gate erreichbar; die Admin-Routen (open/close) prüft das Modul selbst.
    // `null` = kein Connect-Pfad → normal weiter.
    const conn = await handleConnect(request, env, url);
    if (conn) return conn;

    // Ab hier: Proxy-Key Pflicht.
    const provided =
      request.headers.get('X-Proxy-Key') ||
      (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.PROXY_KEY || provided !== env.PROXY_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }

    // Feedback (Bug/Wunsch) aus dem Launcher → serverseitig ein GitHub-Issue
    // anlegen, damit die Clients tokenlos bleiben. Braucht GITHUB_TOKEN mit
    // Berechtigung issues:write auf REPO.
    if (request.method === 'POST' && url.pathname === '/feedback') {
      try {
        const rl = await rateLimit(
          env, 'feedback', clientIp(request),
          LIMITS.feedback.rlMax, LIMITS.feedback.rlWindowSec,
        );
        if (!rl.ok) return tooMany(rl.retryAfter);

        const payload = await readJsonLimited(request, LIMITS.feedback.maxBytes);
        const title = clampField(payload && payload.title, FIELD.title);
        const description = clampField(payload && payload.description, FIELD.description);
        if (!title || !description) {
          return json({ error: 'title und description erforderlich' }, 400);
        }
        const isBug = payload && payload.type === 'bug';
        const context = clampField(payload && payload.context, FIELD.context);
        const body =
          description +
          '\n\n---\n_Aus dem JM Production Suite Launcher gemeldet_' +
          (context ? `\n\n\`\`\`\n${context}\n\`\`\`` : '');

        const res = await fetch(`https://api.github.com/repos/${env.REPO}/issues`, {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': USER_AGENT,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            title: `[${isBug ? 'Bug' : 'Wunsch'}] ${title}`,
            body,
            labels: [isBug ? 'bug' : 'enhancement', 'from-launcher'],
          }),
        });
        if (!res.ok) {
          // Rohe GitHub-Antwort NICHT an den Client geben (kann Token-Scope-Hinweise
          // tragen) — nur serverseitig loggen, dem Client den Status zurück.
          console.error('feedback issue', res.status, (await res.text().catch(() => '')).slice(0, 500));
          return json({ error: `GitHub ${res.status}` }, 502);
        }
        const issue = await res.json();
        return json({ ok: true, number: issue.number, url: issue.html_url });
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        console.error('feedback', e);
        return json({ error: 'interner Fehler' }, 502);
      }
    }

    // Katalog (suite.json) LIVE aus dem Repo ausliefern — git ist die einzige
    // Quelle der Wahrheit, damit neue Tools ohne Launcher-Release oder Worker-
    // Deploy erscheinen (nur `suite.json` committen). Ref = env.MANIFEST_REF.
    if (request.method === 'GET' && url.pathname === '/suite.json') {
      try {
        const ref = env.MANIFEST_REF || 'main';
        const path = env.MANIFEST_PATH || 'packages/suite-manifest/suite.json';
        const raw = await ghRaw(
          `https://api.github.com/repos/${env.REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`,
          env,
        );
        return new Response(raw, {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            // kurz cachen; Clients holen ohnehin nur beim Start
            'cache-control': 'public, max-age=60',
          },
        });
      } catch (e) {
        return json({ error: String((e && e.message) || e) }, 502);
      }
    }

    // App-Changelogs (changelog.json) LIVE aus dem Repo — wie /suite.json, damit
    // neue App-Patchnotes ohne Launcher-Release erscheinen. Ref = env.MANIFEST_REF.
    if (request.method === 'GET' && url.pathname === '/changelog.json') {
      try {
        const ref = env.MANIFEST_REF || 'main';
        const path = env.CHANGELOG_PATH || 'packages/suite-manifest/changelog.json';
        const raw = await ghRaw(
          `https://api.github.com/repos/${env.REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`,
          env,
        );
        return new Response(raw, {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=60',
          },
        });
      } catch (e) {
        return json({ error: String((e && e.message) || e) }, 502);
      }
    }

    // Kochbuch-Rezepte (cookbook.json) LIVE aus dem Repo — wie /suite.json, damit
    // neue Rezepte ohne Launcher-Release erscheinen. Ref = env.MANIFEST_REF.
    if (request.method === 'GET' && url.pathname === '/cookbook.json') {
      try {
        const ref = env.MANIFEST_REF || 'main';
        const path = env.COOKBOOK_PATH || 'packages/cookbook/cookbook.json';
        const raw = await ghRaw(
          `https://api.github.com/repos/${env.REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`,
          env,
        );
        return new Response(raw, {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=60',
          },
        });
      } catch (e) {
        return json({ error: String((e && e.message) || e) }, 502);
      }
    }

    // KI-/Formular-Authoring: erzeugt aus Roh-Infos (oder einem fertigen Rezept-
    // Objekt) ein validiertes Rezept und öffnet dafür einen PR. Client bleibt
    // tokenlos (wie /feedback). Braucht ANTHROPIC_API_KEY (nur mode "ai") und
    // GITHUB_TOKEN mit Contents:write + Pull requests:write.
    if (request.method === 'POST' && url.pathname === '/cookbook/draft') {
      return handleCookbookDraft(request, env);
    }

    const match = url.pathname.match(/^\/tools\/([^/]+)\/latest\/?$/);
    if (request.method !== 'GET' || !match) {
      return json({ error: 'not found' }, 404);
    }

    const id = decodeURIComponent(match[1]);
    const platform = url.searchParams.get('platform');
    const arch = url.searchParams.get('arch') || 'x64';
    if (platform !== 'mac' && platform !== 'win') {
      return json({ error: 'query "platform" erforderlich (mac|win)' }, 400);
    }

    // Tool-ID → Tag-Präfix: "jm-copy" → "copy-v", "launcher" → "launcher-v".
    const app = id.startsWith('jm-') ? id.slice(3) : id;
    const prefix = `${app}-v`;

    try {
      const releases = await ghJson(
        `https://api.github.com/repos/${env.REPO}/releases?per_page=100`,
        env,
      );
      const picked = releases
        .filter((r) => !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith(prefix))
        .map((r) => ({ release: r, version: r.tag_name.slice(prefix.length) }))
        .sort((a, b) => compareVersions(b.version, a.version))[0];
      if (!picked) return json({ error: `kein Release für ${app}` }, 404);

      const ext = platform === 'mac' ? '.dmg' : '.exe';
      const assets = picked.release.assets || [];
      // Auf macOS zusätzlich nach Architektur filtern (arm64/x64-DMG), sonst nur
      // nach Endung. GitHub ersetzt Leerzeichen in Asset-Namen durch Punkte.
      const asset =
        assets.find(
          (a) => a.name.endsWith(ext) && (platform === 'mac' ? a.name.includes(arch) : true),
        ) || assets.find((a) => a.name.endsWith(ext));
      if (!asset) return json({ error: `kein ${platform}-Asset im Release` }, 404);

      const signedUrl = await resolveSignedUrl(env.REPO, asset.id, env);
      if (!signedUrl) return json({ error: 'Download-URL nicht auflösbar' }, 502);

      return json({
        version: picked.version,
        assets: {
          [platform]: { url: signedUrl, size: asset.size, fileName: asset.name },
        },
      });
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502);
    }
  },
};

/** GitHub-JSON mit Server-Token holen. */
async function ghJson(apiUrl, env) {
  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
  return res.json();
}

/** Rohinhalt einer Datei aus dem Repo holen (Contents-API, raw). */
async function ghRaw(apiUrl, env) {
  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github.raw',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`GitHub contents ${res.status} ${res.statusText}`);
  return res.text();
}

/**
 * Löst die signierte Storage-URL eines Assets auf: Der Asset-Endpoint mit
 * `Accept: octet-stream` antwortet mit 302 auf eine signierte, auth-freie URL.
 * `redirect: 'manual'` lässt den Worker die `Location` lesen, statt zu folgen.
 */
async function resolveSignedUrl(repo, assetId, env) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${assetId}`, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': USER_AGENT,
    },
    redirect: 'manual',
  });
  const location = res.headers.get('Location');
  if (location) return location;
  // Falls die Laufzeit doch gefolgt ist: finale URL nehmen.
  if (res.ok && res.url) return res.url;
  return null;
}

/** Dotted-Versionsvergleich; >0 wenn a neuer als b. */
function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

// --- Kochbuch-Authoring (Pfad B/A) -----------------------------------------

/**
 * mode "ai":   { input: { title?, category?, notes } } → Claude erzeugt das Rezept
 * mode "form": { recipe: {...} }                        → fertiges Rezept-Objekt
 * Beide: validieren → zu .md rendern → PR öffnen.
 */
async function handleCookbookDraft(request, env) {
  let payload;
  try {
    const rl = await rateLimit(
      env, 'draft', clientIp(request),
      LIMITS.draft.rlMax, LIMITS.draft.rlWindowSec,
    );
    if (!rl.ok) return tooMany(rl.retryAfter);
    payload = await readJsonLimited(request, LIMITS.draft.maxBytes);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('draft read', e);
    return json({ error: 'interner Fehler' }, 502);
  }

  let recipe;
  try {
    if (payload && payload.mode === 'form') {
      recipe = payload.recipe;
    } else if (payload && payload.mode === 'ai') {
      recipe = await draftRecipeWithClaude(payload.input || {}, env);
    } else {
      return json({ error: 'mode muss "ai" oder "form" sein' }, 400);
    }
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }

  const { ok, errors } = validateRecipe(recipe);
  if (!ok) return json({ error: 'Rezept ungültig', details: errors }, 422);

  const slug = CATEGORY_SLUG[recipe.category];
  const path = `packages/cookbook/content/${slug}/${recipe.id}.md`;
  const md = renderRecipeMarkdown(recipe);

  try {
    const pr = await openRecipePR(env, { path, md, recipe });
    return json({ ok: true, ...pr });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

/** Claude (Messages-API) aus Roh-Notizen → Rezept-Objekt. */
async function draftRecipeWithClaude(input, env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY nicht gesetzt');
  const system = buildAuthoringPrompt({ toolIds: await loadToolIds(env) });
  // Eingaben hart kappen — begrenzt Anthropic-Kosten und die Prompt-Injection-Fläche.
  const userText = [
    input.title ? `Titel: ${clampField(input.title, FIELD.title)}` : '',
    input.category ? `Kategorie: ${clampField(input.category, FIELD.category)}` : '',
    'Roh-Notizen:',
    clampField(input.notes, FIELD.notes),
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      // Standard Opus 4.8; per ENV (z. B. claude-sonnet-4-6) für günstiger überschreibbar.
      model: env.COOKBOOK_MODEL || 'claude-opus-4-8',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) {
    // Anthropic-Antwortkörper nur serverseitig loggen, nicht an den Client geben.
    console.error('anthropic', res.status, (await res.text().catch(() => '')).slice(0, 500));
    throw new Error(`Anthropic ${res.status}`);
  }
  const data = await res.json();
  const out = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseRecipeJson(out);
}

/** Tolerantes JSON-Parsing der Modellantwort (Code-Fences/Vorwort abfangen). */
function parseRecipeJson(textOut) {
  let t = String(textOut).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (!t.startsWith('{')) {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
  }
  return JSON.parse(t);
}

/** Bekannte Tool-IDs aus suite.json (für die relatedTools-Vorgabe an die KI). */
async function loadToolIds(env) {
  try {
    const ref = env.MANIFEST_REF || 'main';
    const path = env.MANIFEST_PATH || 'packages/suite-manifest/suite.json';
    const raw = await ghRaw(
      `https://api.github.com/repos/${env.REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`,
      env,
    );
    return (JSON.parse(raw).tools || []).map((t) => t.id);
  } catch {
    return [];
  }
}

/** Neuen Branch + Datei committen + PR öffnen. Braucht GITHUB_TOKEN mit Schreibrechten. */
async function openRecipePR(env, { path, md, recipe }) {
  const repo = env.REPO;
  const base = env.MANIFEST_REF || 'main';
  const ref = await ghApi(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`, env);
  const baseSha = ref.object.sha;

  const branch = `cookbook/${recipe.id}-${crypto.randomUUID().slice(0, 8)}`;
  await ghApi(`https://api.github.com/repos/${repo}/git/refs`, env, 'POST', {
    ref: `refs/heads/${branch}`,
    sha: baseSha,
  });

  await ghApi(`https://api.github.com/repos/${repo}/contents/${path}`, env, 'PUT', {
    message: `feat(cookbook): Rezept "${recipe.title}" (Entwurf)`,
    content: toBase64Utf8(md),
    branch,
  });

  const pr = await ghApi(`https://api.github.com/repos/${repo}/pulls`, env, 'POST', {
    title: `Kochbuch: ${recipe.title}`,
    head: branch,
    base,
    body: `Entwurf eines neuen Rezepts (${recipe.category}).\n\nVor dem Merge bitte prüfen — besonders mit „(bitte ergänzen: …)" markierte Lücken. cookbook.json wird nach dem Merge per \`npm run cookbook:build\` regeneriert.`,
  });
  return { prUrl: pr.html_url, number: pr.number, branch };
}

/** GitHub-JSON-Call (GET/POST/PUT) mit Server-Token. */
async function ghApi(apiUrl, env, method = 'GET', body) {
  const res = await fetch(apiUrl, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    // Rohe GitHub-Antwort serverseitig loggen, dem Client nur Status/Methode.
    console.error('ghApi', method, res.status, (await res.text().catch(() => '')).slice(0, 500));
    throw new Error(`GitHub ${res.status} (${method})`);
  }
  return res.json();
}

/** UTF-8-String → base64 (für die GitHub Contents-API). */
function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
