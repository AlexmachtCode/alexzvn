// Lokaler Selbsttest des Release-Proxy-Workers (kein Deploy nötig).
//   node services/release-proxy/test/worker.test.mjs      (Node ≥ 23.6: Type-Stripping default)
//   node --experimental-strip-types …                     (Node 22.6–23.5)
//
// Hinweis: seit Welle 6 zieht worker.js (via connect-relay.js) TS-Module aus
// packages/rtc in den Import-Graphen. Node strippt die Typen (die .ts-Importe tragen
// explizite Endungen). NICHT über `tsx` laufen — das transpiliert das ESM-worker.js
// (kein "type":"module" hier) zu CJS und verschachtelt den Default-Export.
//
// Prüft die P3-Härtung (#61): Auth-Gate, Input-Größenlimits (413), Feld-Kappung,
// Fehler-Redaktion (keine rohen Upstream-Bodies an den Client) und das KV-Rate-
// Limit (429). Stubbt globalThis.fetch und eine Map-basierte KV-Bindung. Die
// Connect-Tests (Welle 6) prüfen die Worker-Routing-Ebene; die DO-internen Pfade
// brauchen die Workers-Runtime (miniflare) und sind hier bewusst nicht abgedeckt.
import worker from '../worker.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

// Konsolen-Rauschen der Warn-/Error-Logs (erwartet) dämpfen.
const realWarn = console.warn;
const realError = console.error;
console.warn = () => {};
console.error = () => {};

const baseEnv = { PROXY_KEY: 'k', GITHUB_TOKEN: 'gh', REPO: 'owner/repo' };

function makeKV() {
  const m = new Map();
  return {
    async get(key) {
      return m.has(key) ? m.get(key) : null;
    },
    async put(key, val) {
      m.set(key, val);
    },
  };
}

function req(path, { method = 'GET', body, headers = {}, key = 'k', ip = '9.9.9.9' } = {}) {
  const h = { 'CF-Connecting-IP': ip, ...headers };
  if (key) h['X-Proxy-Key'] = key;
  const init = { method, headers: h };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://proxy.test' + path, init);
}

let stub = async () => new Response('{}', { status: 200 });
globalThis.fetch = (...a) => stub(...a);

async function run() {
  // 1) Ohne Proxy-Key → 401.
  {
    const r = await worker.fetch(req('/feedback', { method: 'POST', body: { title: 't', description: 'd' }, key: null }), baseEnv);
    check('feedback ohne Key → 401', r.status === 401);
  }

  // 2) Übergroßer Body → 413.
  {
    const big = 'x'.repeat(20 * 1024);
    const r = await worker.fetch(req('/feedback', { method: 'POST', body: JSON.stringify({ title: 't', description: big }) }), baseEnv);
    check('feedback >16KB → 413', r.status === 413);
  }

  // 3) Pflichtfelder fehlen → 400.
  {
    const r = await worker.fetch(req('/feedback', { method: 'POST', body: { title: '' } }), baseEnv);
    check('feedback ohne title → 400', r.status === 400);
  }

  // 4) Happy path + Feld-Kappung (Titel auf 200 Zeichen).
  {
    let captured = null;
    stub = async (_u, init) => {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ number: 7, html_url: 'https://x/7' }), { status: 200 });
    };
    const longTitle = 'A'.repeat(500);
    const r = await worker.fetch(req('/feedback', { method: 'POST', body: { title: longTitle, description: 'd' } }), baseEnv);
    const out = await r.json();
    check('feedback happy → 200 ok', r.status === 200 && out.ok === true && out.number === 7);
    // Ausgehender Titel = "[Wunsch] " + 200 gekappte Zeichen.
    const clamped = captured.title.replace(/^\[Wunsch\] /, '');
    check('feedback Titel auf 200 gekappt', clamped.length === 200);
    stub = async () => new Response('{}', { status: 200 });
  }

  // 5) GitHub-Fehler wird redigiert (kein roher Body / kein detail-Feld).
  {
    stub = async () => new Response('SECRET-TOKEN-SCOPE-LEAK', { status: 403 });
    const r = await worker.fetch(req('/feedback', { method: 'POST', body: { title: 't', description: 'd' } }), baseEnv);
    const bodyText = await r.text();
    check('feedback GitHub-Fehler → 502', r.status === 502);
    check('feedback redigiert (kein Leak, kein detail)', !bodyText.includes('SECRET') && !bodyText.includes('detail'));
    stub = async () => new Response('{}', { status: 200 });
  }

  // 6) Rate-Limit /feedback: 10 erlaubt, der 11. → 429 (Fake-KV, eine IP).
  {
    const env = { ...baseEnv, RATELIMIT: makeKV() };
    stub = async () => new Response(JSON.stringify({ number: 1, html_url: 'https://x/1' }), { status: 200 });
    let ok = 0;
    let limited = 0;
    let retryAfterSeen = false;
    for (let i = 0; i < 11; i++) {
      const r = await worker.fetch(req('/feedback', { method: 'POST', body: { title: 't', description: 'd' }, ip: '1.2.3.4' }), env);
      if (r.status === 200) ok++;
      else if (r.status === 429) {
        limited++;
        if (r.headers.get('Retry-After')) retryAfterSeen = true;
      }
    }
    check('feedback Rate-Limit: 10 ok', ok === 10);
    check('feedback Rate-Limit: 11. → 429', limited === 1);
    check('feedback 429 trägt Retry-After', retryAfterSeen);
    // Andere IP ist unabhängig.
    const r2 = await worker.fetch(req('/feedback', { method: 'POST', body: { title: 't', description: 'd' }, ip: '5.6.7.8' }), env);
    check('feedback Rate-Limit pro IP getrennt', r2.status === 200);
    stub = async () => new Response('{}', { status: 200 });
  }

  // 7) Rate-Limit /cookbook/draft: 5 erlaubt (hier 422 wg. Dummy-Rezept), 6. → 429.
  {
    const env = { ...baseEnv, RATELIMIT: makeKV() };
    let nonLimited = 0;
    let limited = 0;
    for (let i = 0; i < 6; i++) {
      const r = await worker.fetch(req('/cookbook/draft', { method: 'POST', body: { mode: 'form', recipe: {} }, ip: '2.2.2.2' }), env);
      if (r.status === 429) limited++;
      else nonLimited++;
    }
    check('draft Rate-Limit: 5 durchgelassen', nonLimited === 5);
    check('draft Rate-Limit: 6. → 429', limited === 1);
  }

  // 8) /cookbook/draft übergroßer Body → 413.
  {
    const big = JSON.stringify({ mode: 'form', recipe: { notes: 'x'.repeat(40 * 1024) } });
    const r = await worker.fetch(req('/cookbook/draft', { method: 'POST', body: big }), baseEnv);
    check('draft >32KB → 413', r.status === 413);
  }

  // 9) Health-Check bleibt offen.
  {
    const r = await worker.fetch(new Request('https://proxy.test/'), baseEnv);
    check('health-check ohne Key → 200', r.status === 200);
  }

  // ── Welle 6 — Remote-Zuschaltung (Worker-Routing-Ebene) ──

  // 10) Gast-Seite ist öffentlich (vor dem PROXY_KEY-Gate) und liefert HTML.
  {
    const r = await worker.fetch(new Request('https://proxy.test/connect/room-1', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }), baseEnv);
    const body = await r.text();
    check('connect Gast-Seite ohne Key → 200', r.status === 200);
    check('connect Gast-Seite ist HTML', (r.headers.get('content-type') || '').includes('text/html') && body.includes('Zuschaltung'));
  }

  // 11) Ungültige Raum-ID → 400.
  {
    const r = await worker.fetch(new Request('https://proxy.test/connect/ab', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }), baseEnv);
    check('connect ungültige Raum-ID → 400', r.status === 400);
  }

  // 12) Admin-Route (open) ohne Key → 401, VOR dem DO.
  {
    const r = await worker.fetch(req('/connect/room-1', { method: 'POST', body: { secretHex: 'a'.repeat(64) }, key: null }), baseEnv);
    check('connect open ohne Key → 401', r.status === 401);
  }

  // 13) Mit Key, aber ohne DO-Bindung → 503 (graceful, kein Absturz).
  {
    const r = await worker.fetch(req('/connect/room-1', { method: 'POST', body: { secretHex: 'a'.repeat(64) } }), baseEnv);
    check('connect open ohne DO-Bindung → 503', r.status === 503);
  }

  // 14) Öffentliche state-Route ohne DO-Bindung → 503 (nicht 401 — kein Key nötig).
  {
    const r = await worker.fetch(new Request('https://proxy.test/connect/room-1/state', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }), baseEnv);
    check('connect state ohne DO-Bindung → 503 (nicht 401)', r.status === 503);
  }

  // 15) Unbekannte Sub-Route → 404.
  {
    const r = await worker.fetch(new Request('https://proxy.test/connect/room-1/bogus', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }), baseEnv);
    check('connect unbekannte Sub-Route → 404', r.status === 404);
  }

  // 16) Nicht-Connect-Pfad bleibt unberührt (handleConnect gibt null → normale 404).
  {
    const r = await worker.fetch(req('/nope'), baseEnv);
    check('nicht-connect-Pfad unberührt → 404', r.status === 404);
  }
}

run()
  .then(() => {
    console.warn = realWarn;
    console.error = realError;
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  })
  .catch((e) => {
    console.warn = realWarn;
    console.error = realError;
    console.error('Test-Harness-Fehler:', e);
    process.exit(1);
  });
