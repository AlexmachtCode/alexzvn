// JM Production Suite — Q&A externe Einreichung (#166), Cloudflare-Worker-Modul.
//
// Ermöglicht Fragen von AUSSERHALB des Saal-WLANs: Zuschauer per Livestream-QR
// (anonym) und Pressevertreter vorab (per Zugangscode). Der Saal-Rechner öffnet
// KEINEN Inbound-Port — er POLLT hier freigegebene Einreichungen.
//
// SICHERHEITSMODELL — BLIND-RELAY:
//   Der Worker sieht NIE den Klartext einer Einreichung. Jede Einreichung wird
//   bereits im Browser des Einreichers auf den EVENT-PUBLIC-KEY verschlüsselt
//   (Hybrid: AES-256-GCM für den Inhalt, RSA-OAEP-2048 umschließt den AES-Key).
//   Gespeichert wird nur der Chiffretext-Umschlag {v,alg,ek,iv,ct} + minimale
//   Metadaten (Kanal, Zeitstempel, opake ID). Nur die LOKALE Q&A-App hält den
//   Private Key (single-holder) und entschlüsselt. Details: docs/qa/external-submission.md
//
// Bindungen (wrangler.toml):
//   QA_RELAY   KV-Namespace für Event-Metadaten + Chiffretext-Einreichungen (NEU)
//   RATELIMIT  bestehende KV-Bindung fürs Rate-Limit (geteilt mit /feedback, /draft)
//   PROXY_KEY  Secret — schützt die Admin-Routen (open/pending/ack/delete)

const QA = {
  submitBytes: 8 * 1024, // harte Größengrenze eines Einreich-Bodys
  adminBytes: 16 * 1024, // Größengrenze fürs Öffnen (enthält den Public-Key-JWK)
  stream: { rlMax: 8, rlWindowSec: 60 }, // anonymer Stream: aggressiv pro IP
  press: { rlMax: 12, rlWindowSec: 60 }, // Presse: etwas großzügiger (Code-geschützt)
  eventCap: 800, // max. offene Einreichungen je Event (Anti-Flut)
  pendingPage: 200, // max. Einträge pro pending-Antwort
  retentionMaxSec: 60 * 60 * 24 * 2, // 48 h Auto-Verfall (KV-TTL), auch als Default
};

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const HEX64_RE = /^[a-f0-9]{64}$/;
const B64_RE = /^[A-Za-z0-9+/=]+$/;

class QaError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}

/**
 * Routet alle `/qa/...`-Pfade. Gibt eine Response zurück oder `null`, wenn der
 * Pfad kein Q&A-Pfad ist (dann macht worker.js normal weiter). Öffentliche
 * Routen (Einreichseiten, submit, press, pubkey, state) sind ABSICHTLICH VOR dem
 * globalen PROXY_KEY-Gate erreichbar; die Admin-Routen prüfen den Key selbst.
 */
export async function handleQa(request, env, url) {
  const m = url.pathname.match(/^\/qa\/([^/]+)(?:\/([a-z]+))?\/?$/);
  if (!m) return null;

  const id = decodeURIComponent(m[1]);
  const sub = m[2] || '';
  const method = request.method;
  if (!ID_RE.test(id)) return json({ error: 'ungültige Event-ID' }, 400);

  try {
    // ── Öffentliche Routen ───────────────────────────────────────────────────
    // WICHTIG: async-Routen mit `await` zurückgeben, sonst fängt der try/catch
    // unten die Rejection (QaError → sauberer Statuscode) NICHT.
    if (method === 'GET' && sub === '') return html(submissionPage(id, false));
    if (method === 'GET' && sub === 'press') return html(submissionPage(id, true));
    if (method === 'GET' && sub === 'pubkey') return await qaPubkey(env, id);
    if (method === 'GET' && sub === 'state') return await qaState(env, id);
    if (method === 'POST' && sub === 'submit') return await qaSubmit(request, env, id, 'stream');
    if (method === 'POST' && sub === 'press') return await qaSubmit(request, env, id, 'press');

    // ── Admin-Routen (PROXY_KEY) ─────────────────────────────────────────────
    const adminRoute =
      (method === 'POST' && sub === '') ||
      (method === 'DELETE' && sub === '') ||
      (method === 'GET' && sub === 'pending') ||
      (method === 'POST' && sub === 'ack');
    if (adminRoute) {
      if (!keyOk(request, env)) return json({ error: 'unauthorized' }, 401);
      if (!env.QA_RELAY) return json({ error: 'QA_RELAY KV-Bindung fehlt' }, 503);
      if (method === 'POST' && sub === '') return await qaOpen(request, env, id);
      if (method === 'DELETE' && sub === '') return await qaPurge(env, id);
      if (method === 'GET' && sub === 'pending') return await qaPending(env, id);
      if (method === 'POST' && sub === 'ack') return await qaAck(request, env, id);
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    if (e instanceof QaError) return json({ error: e.message }, e.status);
    console.error('qa-relay', e);
    return json({ error: 'interner Fehler' }, 502);
  }
}

// ── Event-Metadaten ───────────────────────────────────────────────────────────

function metaKey(id) {
  return `qa:${id}:meta`;
}
function itemPrefix(id) {
  return `qa:${id}:i:`;
}

async function getMeta(env, id) {
  if (!env.QA_RELAY) return null;
  const raw = await env.QA_RELAY.get(metaKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Event öffnen/konfigurieren (Admin). Lädt den Event-Public-Key (JWK), den Hash
 * des Presse-Zugangscodes, die Offen-Flags und die Retention hoch. Idempotent —
 * erneutes Öffnen aktualisiert die Metadaten (z. B. Kanäle schließen).
 */
async function qaOpen(request, env, id) {
  const body = await readJsonLimited(request, QA.adminBytes);
  const pubJwk = body && body.pubJwk;
  if (!pubJwk || pubJwk.kty !== 'RSA' || typeof pubJwk.n !== 'string' || typeof pubJwk.e !== 'string') {
    throw new QaError(400, 'pubJwk (RSA public JWK) erforderlich');
  }
  const pressCodeHash = String((body && body.pressCodeHash) || '');
  if (pressCodeHash && !HEX64_RE.test(pressCodeHash)) {
    throw new QaError(400, 'pressCodeHash muss SHA-256-hex sein');
  }
  const retentionSec = clampInt(body && body.retentionSec, 60, QA.retentionMaxSec, QA.retentionMaxSec);
  const meta = {
    pubJwk: { kty: 'RSA', n: pubJwk.n, e: pubJwk.e, alg: 'RSA-OAEP-256', ext: true },
    pressCodeHash, // leer = Presse-Kanal deaktiviert
    streamOpen: body ? body.streamOpen !== false : true,
    pressOpen: !!pressCodeHash && (body ? body.pressOpen !== false : true),
    retentionSec,
    createdAt: Date.now(),
  };
  await env.QA_RELAY.put(metaKey(id), JSON.stringify(meta), { expirationTtl: retentionSec });
  return json({ ok: true, streamOpen: meta.streamOpen, pressOpen: meta.pressOpen });
}

async function qaPubkey(env, id) {
  const meta = await getMeta(env, id);
  if (!meta) return json({ error: 'Event nicht gefunden' }, 404);
  return json({ jwk: meta.pubJwk, streamOpen: meta.streamOpen, pressOpen: meta.pressOpen });
}

async function qaState(env, id) {
  const meta = await getMeta(env, id);
  if (!meta) return json({ streamOpen: false, pressOpen: false, waiting: 0 });
  let waiting = 0;
  if (env.QA_RELAY) {
    const list = await env.QA_RELAY.list({ prefix: itemPrefix(id), limit: 1000 });
    waiting = list.keys.length;
  }
  return json({ streamOpen: meta.streamOpen, pressOpen: meta.pressOpen, waiting });
}

// ── Einreichen (öffentlich, verschlüsselt) ─────────────────────────────────────

async function qaSubmit(request, env, id, channel) {
  const lim = channel === 'press' ? QA.press : QA.stream;
  const rl = await rateLimit(env, `qa-${channel}`, clientIp(request), lim.rlMax, lim.rlWindowSec);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const meta = await getMeta(env, id);
  if (!meta) return json({ error: 'Event nicht gefunden' }, 404);
  if (channel === 'stream' && !meta.streamOpen) return json({ error: 'Einreichung geschlossen' }, 403);
  if (channel === 'press' && !meta.pressOpen) return json({ error: 'Presse-Einreichung geschlossen' }, 403);

  const body = await readJsonLimited(request, QA.submitBytes);

  // Presse: Zugangscode gegen den gespeicherten Hash prüfen (Konstantzeit).
  if (channel === 'press') {
    const code = clampField(body && body.code, 200);
    if (!code) throw new QaError(401, 'Zugangscode erforderlich');
    const h = await sha256Hex(code);
    if (!meta.pressCodeHash || !timingSafeEqualHex(h, meta.pressCodeHash)) {
      throw new QaError(401, 'Zugangscode ungültig');
    }
  }

  const envelope = validateEnvelope(channel === 'press' ? body && body.env : body);

  // Anti-Flut: harte Obergrenze offener Einreichungen je Event.
  const list = await env.QA_RELAY.list({ prefix: itemPrefix(id), limit: 1000 });
  if (list.keys.length >= QA.eventCap) return json({ error: 'Warteschlange voll' }, 507);

  const at = Date.now();
  const itemId = `${at}_${crypto.randomUUID().slice(0, 8)}`;
  const item = { id: itemId, channel, at, blob: envelope };
  await env.QA_RELAY.put(itemPrefix(id) + itemId, JSON.stringify(item), {
    expirationTtl: meta.retentionSec,
  });
  return json({ ok: true });
}

/** Chiffretext-Umschlag validieren (Form + Größen), Inhalt bleibt opak. */
function validateEnvelope(e) {
  if (!e || e.v !== 1 || e.alg !== 'RSA-OAEP+A256GCM') {
    throw new QaError(400, 'ungültiger Umschlag');
  }
  const ek = String(e.ek || '');
  const iv = String(e.iv || '');
  const ct = String(e.ct || '');
  if (!B64_RE.test(ek) || !B64_RE.test(iv) || !B64_RE.test(ct)) {
    throw new QaError(400, 'Umschlag muss base64 sein');
  }
  // RSA-2048-OAEP ek ≈ 344 B64-Zeichen, iv (12 B) = 16, ct klein. Großzügig kappen.
  if (ek.length > 1024 || iv.length > 64 || ct.length > 6000) {
    throw new QaError(413, 'Umschlag zu groß');
  }
  return { v: 1, alg: 'RSA-OAEP+A256GCM', ek, iv, ct };
}

// ── Pollen / Aufräumen (Admin) ─────────────────────────────────────────────────

async function qaPending(env, id) {
  const list = await env.QA_RELAY.list({ prefix: itemPrefix(id), limit: 1000 });
  const keys = list.keys.slice(0, QA.pendingPage);
  const items = [];
  for (const k of keys) {
    const raw = await env.QA_RELAY.get(k.name);
    if (!raw) continue;
    try {
      items.push(JSON.parse(raw));
    } catch {
      /* defekten Eintrag überspringen */
    }
  }
  items.sort((a, b) => a.at - b.at);
  return json({ items, truncated: list.keys.length > keys.length });
}

async function qaAck(request, env, id) {
  const body = await readJsonLimited(request, QA.adminBytes);
  const ids = Array.isArray(body && body.ids) ? body.ids : [];
  let deleted = 0;
  for (const raw of ids.slice(0, 1000)) {
    const itemId = String(raw);
    if (!/^[0-9]+_[a-f0-9]{1,12}$/.test(itemId)) continue;
    await env.QA_RELAY.delete(itemPrefix(id) + itemId);
    deleted++;
  }
  return json({ ok: true, deleted });
}

async function qaPurge(env, id) {
  let cursor;
  let removed = 0;
  do {
    const list = await env.QA_RELAY.list({ prefix: itemPrefix(id), cursor, limit: 1000 });
    for (const k of list.keys) {
      await env.QA_RELAY.delete(k.name);
      removed++;
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  await env.QA_RELAY.delete(metaKey(id));
  return json({ ok: true, removed });
}

// ── Helfer ─────────────────────────────────────────────────────────────────────

function keyOk(request, env) {
  const provided =
    request.headers.get('X-Proxy-Key') ||
    (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return !!env.PROXY_KEY && provided === env.PROXY_KEY;
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

async function readJsonLimited(request, maxBytes) {
  const cl = request.headers.get('content-length');
  if (cl && Number(cl) > maxBytes) throw new QaError(413, 'Anfrage zu groß');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new QaError(413, 'Anfrage zu groß');
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new QaError(400, 'ungültiges JSON');
  }
}

function clampField(v, maxLen) {
  return String(v == null ? '' : v).trim().slice(0, maxLen);
}

function clampInt(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Konstantzeit-Vergleich zweier gleich langer Hex-Strings. */
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Fixed-Window-Rate-Limit pro Client-IP über die bestehende RATELIMIT-KV-Bindung.
 * Fehlt sie, wird nicht geblockt, aber gewarnt (wie im Haupt-Worker).
 */
async function rateLimit(env, bucket, ip, max, windowSec) {
  if (!env.RATELIMIT) {
    console.warn(`qa rate-limit: KV-Bindung RATELIMIT fehlt — ${bucket} ungedrosselt`);
    return { ok: true };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(nowSec / windowSec);
  const key = `rl:${bucket}:${ip}:${windowId}`;
  const current = Number((await env.RATELIMIT.get(key)) || 0);
  if (current >= max) return { ok: false, retryAfter: windowSec - (nowSec % windowSec) };
  await env.RATELIMIT.put(key, String(current + 1), { expirationTtl: windowSec * 2 });
  return { ok: true };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function tooMany(retryAfter) {
  return new Response(JSON.stringify({ error: 'zu viele Anfragen' }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'Retry-After': String(retryAfter || 60),
    },
  });
}

// ── Einreichseite (vom Worker gehostet, verschlüsselt im Browser) ───────────────
//
// Selbsterhaltende HTML-Seite (inline CSS + Vanilla-JS, kein Bundling) — dem Muster
// von apps/qa/src/main/remote-page.ts nachempfunden, aber (a) vom Worker gehostet
// (Stream/Presse sind nicht im LAN) und (b) End-to-End verschlüsselt: die Seite holt
// den Event-Public-Key und verschlüsselt Name/Frage im Browser, bevor sie sendet.

function submissionPage(id, press) {
  const base = JSON.stringify('/qa/' + id);
  const heading = press ? 'Presse — Frage einreichen' : 'Wortmeldung';
  const intro = press
    ? 'Für akkreditierte Pressevertreter. Zugangscode erforderlich. Deine Angaben werden Ende-zu-Ende verschlüsselt übertragen.'
    : 'Frage oder Wortmeldung zum Livestream einreichen. Ende-zu-Ende verschlüsselt.';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>${press ? 'Presse' : 'Wortmeldung'} — JM Q&amp;A</title>
<style>
  :root{ --bg:#121212; --fg:#fff; --muted:#9a9a9a; --line:#2a2a2a; --yellow:#fbe73b; --dark:#121212; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body{ margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap{ max-width:560px; margin:0 auto; padding:20px 16px 40px; }
  h1{ font-size:20px; margin:8px 0 2px; }
  .sub{ color:var(--muted); font-size:13px; margin-bottom:18px; }
  label{ display:block; font-size:13px; color:var(--muted); margin:14px 0 6px; }
  input,textarea{ width:100%; background:#1c1c1c; border:1px solid var(--line); color:var(--fg);
    border-radius:10px; padding:13px 12px; font-size:16px; font-family:inherit; }
  textarea{ min-height:96px; resize:vertical; }
  button{ width:100%; margin-top:20px; padding:15px; border:0; border-radius:12px; background:var(--yellow);
    color:var(--dark); font-size:17px; font-weight:700; }
  button:disabled{ opacity:.5; }
  .status{ margin-top:16px; text-align:center; color:var(--muted); font-size:13px; min-height:18px; }
  .ok{ color:#7bd88f; }
  .lock{ color:var(--muted); font-size:11px; margin-top:14px; text-align:center; }
  .closed{ margin-top:24px; padding:16px; border:1px solid var(--line); border-radius:12px; text-align:center; color:var(--muted); }
  .hide{ display:none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${heading}</h1>
  <div class="sub" id="sub">${intro}</div>

  <div id="form">
    ${press ? '<label for="code">Zugangscode *</label>\n    <input id="code" autocomplete="one-time-code" placeholder="Code aus der Einladung" />' : ''}
    <label for="name">Name *</label>
    <input id="name" autocomplete="name" placeholder="Vor- und Nachname" />
    <label for="aff">${press ? 'Medium / Redaktion' : 'Funktion / Medium / Fraktion'}</label>
    <input id="aff" placeholder="${press ? 'z. B. ARD' : 'z. B. ARD, Fraktion XY'}" />
    ${press ? '<label for="contact">Kontakt (optional, für Rückfragen)</label>\n    <input id="contact" autocomplete="email" placeholder="E-Mail oder Telefon" />' : ''}
    <label for="q">Frage${press ? '' : ' (optional)'}</label>
    <textarea id="q" placeholder="Worum geht es?"></textarea>
    <button id="send">Verschlüsselt einreichen</button>
    <div class="status" id="st"></div>
    <div class="lock">🔒 Ende-zu-Ende verschlüsselt — nur die Regie kann die Frage lesen.</div>
  </div>

  <div class="closed hide" id="closed">Die Einreichung ist gerade geschlossen.</div>
</div>
<script>
  var BASE=${base}, IS_PRESS=${press ? 'true' : 'false'};
  var nameEl=document.getElementById('name'), affEl=document.getElementById('aff'), qEl=document.getElementById('q');
  var sendEl=document.getElementById('send'), stEl=document.getElementById('st'), subEl=document.getElementById('sub');
  var formEl=document.getElementById('form'), closedEl=document.getElementById('closed');
  var codeEl=document.getElementById('code'), contactEl=document.getElementById('contact');
  var PUB=null;

  function b64(buf){ var b=new Uint8Array(buf),s=''; for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]); return btoa(s); }
  function open(s){
    if(!s) return;
    var accepting = IS_PRESS ? s.pressOpen : s.streamOpen;
    formEl.classList.toggle('hide', !accepting);
    closedEl.classList.toggle('hide', !!accepting);
  }
  async function loadPub(){
    var r=await fetch(BASE+'/pubkey'); if(!r.ok) throw new Error('nope');
    var j=await r.json(); PUB=await crypto.subtle.importKey('jwk', j.jwk, {name:'RSA-OAEP',hash:'SHA-256'}, false, ['encrypt']);
    open(j);
  }
  async function encEnvelope(obj){
    var aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256}, true, ['encrypt']);
    var iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv}, aes, new TextEncoder().encode(JSON.stringify(obj)));
    var raw=await crypto.subtle.exportKey('raw', aes);
    var ek=await crypto.subtle.encrypt({name:'RSA-OAEP'}, PUB, raw);
    return { v:1, alg:'RSA-OAEP+A256GCM', ek:b64(ek), iv:b64(iv), ct:b64(ct) };
  }
  async function send(){
    var name=(nameEl.value||'').trim();
    if(!name){ stEl.textContent='Bitte einen Namen angeben.'; stEl.className='status'; nameEl.focus(); return; }
    if(IS_PRESS && !(codeEl.value||'').trim()){ stEl.textContent='Bitte den Zugangscode eingeben.'; stEl.className='status'; codeEl.focus(); return; }
    if(!PUB){ stEl.textContent='Verbindung wird aufgebaut — bitte erneut versuchen.'; stEl.className='status'; return; }
    sendEl.disabled=true; stEl.textContent='Verschlüssele und sende …'; stEl.className='status';
    try{
      var content={ name:name, affiliation:(affEl.value||'').trim(), question:(qEl.value||'').trim() };
      if(IS_PRESS && contactEl) content.contact=(contactEl.value||'').trim();
      var envelope=await encEnvelope(content);
      var payload=IS_PRESS ? { code:(codeEl.value||'').trim(), env:envelope } : envelope;
      var path=IS_PRESS ? BASE+'/press' : BASE+'/submit';
      var r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(r.ok){ stEl.textContent='Danke! Deine Frage ist verschlüsselt eingegangen.'; stEl.className='status ok';
        if(affEl)affEl.value=''; qEl.value=''; nameEl.value=''; if(contactEl)contactEl.value=''; }
      else if(r.status===401){ stEl.textContent='Zugangscode ungültig.'; stEl.className='status'; }
      else if(r.status===403){ stEl.textContent='Die Einreichung ist gerade geschlossen.'; stEl.className='status'; }
      else if(r.status===429){ stEl.textContent='Zu viele Anfragen — bitte kurz warten.'; stEl.className='status'; }
      else { stEl.textContent='Senden fehlgeschlagen — bitte erneut versuchen.'; stEl.className='status'; }
    }catch(e){ stEl.textContent='Senden fehlgeschlagen — bitte erneut versuchen.'; stEl.className='status'; }
    finally{ sendEl.disabled=false; }
  }
  sendEl.addEventListener('click', send);
  fetch(BASE+'/state').then(function(r){return r.json();}).then(open).catch(function(){});
  loadPub().catch(function(){ stEl.textContent='Event nicht gefunden oder geschlossen.'; stEl.className='status'; });
</script>
</body>
</html>`;
}
