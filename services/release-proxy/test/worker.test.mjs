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
  // 0) /tools/:id/latest muss ALLE Seiten der Release-Liste lesen.
  // GEMESSEN am 01.10.2026: 187 Releases im Monorepo, gelesen wurde nur
  // per_page=100 (Seite 1). Die neuesten Releases von copy, grafiktool und
  // media-converter lagen auf Seite 2 → "kein Release" (404), die Tools waren
  // weder installier- noch aktualisierbar. Jeder neue Tag schob weitere hinaus.
  {
    const listenAufrufe = [];
    const seite = (n, eintraege) => ({ n, eintraege });
    let seiten = [];
    stub = async (u) => {
      const url = String(u);
      if (url.includes('/releases/assets/')) {
        const id = url.split('/').pop();
        return new Response(null, { status: 302, headers: { Location: `https://signed.test/${id}` } });
      }
      if (url.includes('/releases?')) {
        listenAufrufe.push(url);
        const n = Number(new URL(url).searchParams.get('page') ?? '1');
        const s = seiten.find((x) => x.n === n);
        if (s === 'fehler' || (s && s.eintraege === 'fehler')) return new Response('kaputt', { status: 500 });
        return new Response(JSON.stringify(s ? s.eintraege : []), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
    const fuell = (anzahl, praefix = 'sync-v0.') =>
      Array.from({ length: anzahl }, (_, i) => ({ tag_name: `${praefix}${i}.0`, draft: false, assets: [] }));
    const copy = (v, id) => ({ tag_name: `copy-v${v}`, draft: false, assets: [{ id, name: `JM.Copy.Setup.${v}.exe`, size: 5 }] });

    // a) Tool nur auf Seite 2 → wird gefunden.
    seiten = [seite(1, fuell(100)), seite(2, [copy('0.3.0', 77)])];
    listenAufrufe.length = 0;
    let r = await worker.fetch(req('/tools/jm-copy/latest?platform=win'), baseEnv);
    let out = await r.json();
    check('tools: Release nur auf Seite 2 wird gefunden (200, 0.3.0)', r.status === 200 && out.version === '0.3.0');
    check('tools: signierte URL des Seite-2-Assets', out.assets?.win?.url === 'https://signed.test/77');
    check('tools: nach einer kurzen Seite wird nicht weitergeblättert (2 Listenabrufe)', listenAufrufe.length === 2);
    check('tools: Seiten werden mit per_page=100 und page=N geholt',
      listenAufrufe.every((u, i) => /[?&]per_page=100(&|$)/.test(u) && new URL(u).searchParams.get('page') === String(i + 1)));

    // b) Höchste Version über ALLE Seiten, nicht die erste gefundene.
    seiten = [seite(1, [...fuell(99), copy('0.2.0', 20)]), seite(2, [copy('0.10.0', 100)])];
    r = await worker.fetch(req('/tools/jm-copy/latest?platform=win'), baseEnv);
    out = await r.json();
    check('tools: höchste Version über alle Seiten (0.10.0 vor 0.2.0)', r.status === 200 && out.version === '0.10.0');

    // c) Lauter volle Seiten → Obergrenze greift, keine Endlosschleife, Antwort kommt.
    seiten = Array.from({ length: 200 }, (_, i) => seite(i + 1, fuell(100)));
    listenAufrufe.length = 0;
    r = await worker.fetch(req('/tools/jm-copy/latest?platform=win'), baseEnv);
    check('tools: Obergrenze bei lauter vollen Seiten (30 Abrufe, dann 404)', listenAufrufe.length === 30 && r.status === 404);

    // d) Fehler auf Seite 2 → 502, KEIN stilles Ergebnis aus Seite 1.
    seiten = [seite(1, [...fuell(99), copy('0.2.0', 20)]), seite(2, 'fehler')];
    r = await worker.fetch(req('/tools/jm-copy/latest?platform=win'), baseEnv);
    check('tools: Fehler auf einer Folgeseite → 502 statt halber Liste', r.status === 502);

    stub = async () => new Response('{}', { status: 200 });
  }

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

  // 17–19) EU-Datenresidenz (Welle 6.6): der Raum-DO wird über die Jurisdiction adressiert.
  {
    const calls = [];
    const ns = {
      jurisdiction(j) {
        calls.push(`jurisdiction:${j}`);
        return ns;
      },
      idFromName(n) {
        calls.push(`idFromName:${n}`);
        return { n };
      },
      get() {
        return { fetch: async () => new Response('{}', { status: 200 }) };
      },
    };
    const url = 'https://proxy.test/connect/room-1/state';
    const hdr = { headers: { 'CF-Connecting-IP': '9.9.9.9' } };

    calls.length = 0;
    await worker.fetch(new Request(url, hdr), { ...baseEnv, CONNECT_ROOM: ns });
    check('Default: Raum-DO wird in der EU-Jurisdiction adressiert', calls[0] === 'jurisdiction:eu');

    // Abschalten nur für lokale Läufe — dann darf sie NICHT still angefordert werden.
    calls.length = 0;
    await worker.fetch(new Request(url, hdr), { ...baseEnv, CONNECT_ROOM: ns, CONNECT_JURISDICTION: '' });
    check('CONNECT_JURISDICTION="" → keine Jurisdiction angefordert', !calls.some((c) => c.startsWith('jurisdiction')));

    // Verlangte Jurisdiction, die die Bindung nicht kann → LAUT scheitern, nicht still global laufen.
    const plain = { idFromName: () => ({}), get: () => ({ fetch: async () => new Response('{}') }) };
    const r = await worker.fetch(new Request(url, hdr), { ...baseEnv, CONNECT_ROOM: plain });
    check('Jurisdiction verlangt, aber nicht unterstützt → 503 statt stiller Rückfall', r.status === 503);
  }

  // ── Zoom-SDK nachladen (JM Connect 0.2.2): GET /zoom-sdk/:fassung ──

  // 20) Eigener Schlüssel, Antwort, Fehlerfälle, Drosselung, kein Proxy-Key, nichts Geheimes in der Konsole.
  {
    const FASSUNG = '7.1.5.43953';
    const ZIP = `zoom-sdk-win-x64-${FASSUNG}.zip`;
    const zEnv = { ...baseEnv, ZOOM_SDK_KEY: 'sdk-geheim-test', ZOOM_SDK_REPO: 'owner/jm-zoom-sdk' };
    const zReq = (fassung, schluessel, opts = {}) =>
      req(`/zoom-sdk/${fassung}`, {
        key: null,
        ...opts,
        headers: schluessel === null ? {} : { 'X-Zoom-Sdk-Key': schluessel },
      });
    const aufrufe = [];
    let release = { assets: [{ id: 77, name: ZIP, size: 150120193 }] };
    let tagStatus = 200;
    let assetOhneLink = false;
    /** Rohtext statt Release-JSON (unlesbare Antwort) bzw. ein Fehler, den fetch wirft (Netz). */
    let tagRoh = null;
    let tagWirft = null;
    stub = async (u) => {
      const url = String(u);
      aufrufe.push(url);
      if (url.includes('/releases/assets/')) {
        if (assetOhneLink) return new Response('{}', { status: 200 });
        const id = url.split('/').pop();
        return new Response(null, { status: 302, headers: { Location: `https://signed.test/zoom-${id}?sig=geheim-link` } });
      }
      if (url.includes('/releases/tags/')) {
        if (tagWirft) throw tagWirft;
        if (tagRoh !== null) return new Response(tagRoh, { status: 200 });
        if (tagStatus !== 200) return new Response('GITHUB-FEHLTEXT-LEAK', { status: tagStatus });
        return new Response(JSON.stringify(release), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
    // Konsole mitschneiden: weder Schlüssel noch signierter Link dürfen dort landen (Spec 3.2).
    const mitschnitt = [];
    const merke = (...a) => mitschnitt.push(a.map(String).join(' '));
    const infoVorher = console.info;
    console.warn = merke;
    console.error = merke;
    console.info = merke;

    let r = await worker.fetch(zReq(FASSUNG, null), zEnv);
    check('zoom-sdk ohne Header → 401 unauthorized', r.status === 401 && (await r.json()).error === 'unauthorized');
    r = await worker.fetch(zReq(FASSUNG, 'falsch'), zEnv);
    check('zoom-sdk falscher Schlüssel → 401', r.status === 401);
    check('… mit Secret: kein Hinweis auf ein fehlendes Secret im Worker-Log', !mitschnitt.some((z) => z.includes('ZOOM_SDK_KEY fehlt')));
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), { ...zEnv, ZOOM_SDK_KEY: undefined });
    check('zoom-sdk ohne Secret ZOOM_SDK_KEY → 401, auch mit Header', r.status === 401);
    check('… Fehleinrichtung steht im Worker-Log (ohne Wert): Secret ZOOM_SDK_KEY fehlt',
      mitschnitt.some((z) => z.startsWith('zoom-sdk: Secret ZOOM_SDK_KEY fehlt')));
    let seit = mitschnitt.length;
    r = await worker.fetch(zReq(FASSUNG, ''), { ...zEnv, ZOOM_SDK_KEY: '' });
    check('zoom-sdk leeres Secret und leerer Header → 401', r.status === 401);
    check('… leeres Secret gilt im Worker-Log als fehlend', mitschnitt.slice(seit).some((z) => z.startsWith('zoom-sdk: Secret ZOOM_SDK_KEY fehlt')));
    check('… ohne gültigen Schlüssel fragt der Proxy GitHub nicht', aufrufe.length === 0);

    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    const out = await r.json();
    check('zoom-sdk richtiger Schlüssel → 200 { fassung, url, size }',
      r.status === 200 && out.fassung === FASSUNG && out.url === 'https://signed.test/zoom-77?sig=geheim-link'
        && out.size === 150120193 && JSON.stringify(Object.keys(out).sort()) === '["fassung","size","url"]');
    check('… Antwort mit Cache-Control no-store', r.headers.get('cache-control') === 'no-store');
    check('… Release über ZOOM_SDK_REPO und Tag zoom-sdk-<fassung>',
      aufrufe.includes(`https://api.github.com/repos/owner/jm-zoom-sdk/releases/tags/zoom-sdk-${FASSUNG}`));
    check('… signierter Link aus demselben Repo', aufrufe.includes('https://api.github.com/repos/owner/jm-zoom-sdk/releases/assets/77'));
    check('… nie das Monorepo REPO', !aufrufe.some((u) => u.includes('/repos/owner/repo/')));

    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { key: 'falsch' }), zEnv);
    check('zoom-sdk verlangt keinen Proxy-Schlüssel (ein falscher X-Proxy-Key stört nicht)', r.status === 200);
    r = await worker.fetch(zReq(FASSUNG, null, { key: 'k' }), zEnv);
    check('… und der richtige Proxy-Schlüssel ersetzt den SDK-Schlüssel nicht', r.status === 401);

    aufrufe.length = 0;
    for (const f of ['7.1.5', 'abc', '7.1.5.43953x', '7.1.5.43953.1', '..%2F..', '']) {
      r = await worker.fetch(zReq(f, 'sdk-geheim-test'), zEnv);
      check(`zoom-sdk ungültige Fassung „${f}“ → 404`, r.status === 404);
    }
    check('… ohne GitHub-Abfrage', aufrufe.length === 0);

    tagStatus = 404;
    seit = mitschnitt.length;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk Release fehlt → 404 not_found', r.status === 404 && (await r.json()).error === 'not_found');
    check('… Worker-Log nennt GitHub-Status, Release und Repo (Token ohne Zugriff sieht genauso aus)',
      mitschnitt.slice(seit).some((z) => z.startsWith('zoom-sdk: GitHub 404') && z.includes(`zoom-sdk-${FASSUNG}`) && z.includes('owner/jm-zoom-sdk')));
    tagStatus = 200;
    release = { assets: [{ id: 5, name: 'etwas-anderes.zip', size: 1 }] };
    seit = mitschnitt.length;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk Asset fehlt → 404 not_found', r.status === 404 && (await r.json()).error === 'not_found');
    check('… Worker-Log nennt den gesuchten Asset-Namen', mitschnitt.slice(seit).some((z) => z.startsWith('zoom-sdk: Asset') && z.includes(ZIP)));
    release = { assets: [{ id: 77, name: ZIP, size: 150120193 }] };
    tagStatus = 500;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    const t500 = await r.text();
    check('zoom-sdk GitHub 500 → 502 upstream ohne GitHub-Fehlertext',
      r.status === 502 && JSON.parse(t500).error === 'upstream' && !t500.includes('LEAK'));
    tagStatus = 200;
    assetOhneLink = true;
    seit = mitschnitt.length;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk signierter Link nicht auflösbar → 502 upstream', r.status === 502 && (await r.json()).error === 'upstream');
    check('… Worker-Log nennt das Asset', mitschnitt.slice(seit).some((z) => z.startsWith('zoom-sdk: signierter Link') && z.includes(ZIP)));
    assetOhneLink = false;
    tagRoh = 'kein json';
    seit = mitschnitt.length;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk Release-Antwort unlesbar → 502 upstream', r.status === 502 && (await r.json()).error === 'upstream');
    check('… Worker-Log nennt den Fehlernamen (SyntaxError), nicht die Meldung',
      mitschnitt.slice(seit).some((z) => z.startsWith('zoom-sdk: GitHub nicht erreichbar oder Antwort unlesbar') && z.includes('SyntaxError')));
    tagRoh = null;
    tagWirft = new TypeError('Netz weg zu https://signed.test/geheim-link');
    seit = mitschnitt.length;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), zEnv);
    check('zoom-sdk GitHub nicht erreichbar → 502 upstream', r.status === 502 && (await r.json()).error === 'upstream');
    check('… Worker-Log nennt den Fehlernamen (TypeError)', mitschnitt.slice(seit).some((z) => z.includes('TypeError')));
    tagWirft = null;

    // A10: andere Methoden als GET → 404, auch mit gültigem Schlüssel, ohne GitHub.
    aufrufe.length = 0;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { method: 'POST' }), zEnv);
    check('zoom-sdk POST mit gültigem Schlüssel → 404 (A10), ohne GitHub-Abfrage', r.status === 404 && aufrufe.length === 0);
    // Ohne Variable ZOOM_SDK_REPO gilt die Vorgabe (fetch ist hier die Attrappe, es geht nichts ins Netz).
    aufrufe.length = 0;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), { ...zEnv, ZOOM_SDK_REPO: undefined });
    check('zoom-sdk ohne ZOOM_SDK_REPO → Vorgabe AlexmachtCode/jm-zoom-sdk',
      r.status === 200 && aufrufe.includes(`https://api.github.com/repos/AlexmachtCode/jm-zoom-sdk/releases/tags/zoom-sdk-${FASSUNG}`));
    // KV wirft (Ausfall oder Schreibgrenze): vertragsgemäß 502 upstream als JSON, nicht als ungefangene Ausnahme.
    const kaputtesKV = {
      async get() {
        throw new TypeError('KV nicht erreichbar');
      },
      async put() {},
    };
    seit = mitschnitt.length;
    let rk = null;
    try {
      rk = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test'), { ...zEnv, RATELIMIT: kaputtesKV });
    } catch {
      rk = null;
    }
    check('zoom-sdk KV wirft bei der Drosselung → 502 upstream (JSON), keine ungefangene Ausnahme',
      rk !== null && rk.status === 502 && (await rk.json()).error === 'upstream');
    check('… Worker-Log nennt Drosselung und Fehlernamen, nicht die Meldung',
      mitschnitt.slice(seit).some((z) => z.startsWith('zoom-sdk: Drosselung') && z.includes('TypeError'))
        && !mitschnitt.some((z) => z.includes('KV nicht erreichbar')));

    // Drosselung VOR dem Schlüsselvergleich: 20 Anfragen je IP und 10 Minuten, die 21. → 429, auch mit gültigem Schlüssel.
    const rlEnv = { ...zEnv, RATELIMIT: makeKV() };
    const vorab = [];
    for (let i = 0; i < 20; i++) vorab.push((await worker.fetch(zReq(FASSUNG, 'falsch', { ip: '3.3.3.3' }), rlEnv)).status);
    check('zoom-sdk Drosselung: die 20 Anfragen davor kommen durch (401 wegen falschem Schlüssel, kein 429)',
      vorab.length === 20 && vorab.every((s) => s === 401));
    aufrufe.length = 0;
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { ip: '3.3.3.3' }), rlEnv);
    check('zoom-sdk Drosselung: 21. Anfrage je IP → 429, auch mit gültigem Schlüssel', r.status === 429);
    check('… mit Retry-After', Number(r.headers.get('Retry-After')) > 0);
    check('… ohne GitHub-Abfrage', aufrufe.length === 0);
    r = await worker.fetch(zReq(FASSUNG, 'sdk-geheim-test', { ip: '4.4.4.4' }), rlEnv);
    check('… andere IP unabhängig', r.status === 200);

    const alles = mitschnitt.join('\n');
    check('zoom-sdk: weder Schlüssel noch signierter Link in der Konsole',
      !alles.includes('sdk-geheim-test') && !alles.includes('signed.test') && !alles.includes('geheim-link'));
    console.warn = () => {};
    console.error = () => {};
    console.info = infoVorher;
    stub = async () => new Response('{}', { status: 200 });
  }

  // 21) Regression: /tools/… löst den signierten Link weiter im Monorepo REPO auf, auch mit ZOOM_SDK_REPO.
  {
    const aufrufe = [];
    stub = async (u) => {
      const url = String(u);
      aufrufe.push(url);
      if (url.includes('/releases/assets/')) return new Response(null, { status: 302, headers: { Location: 'https://signed.test/9' } });
      if (url.includes('/releases?')) {
        return new Response(JSON.stringify([{ tag_name: 'copy-v1.0.0', draft: false, assets: [{ id: 9, name: 'JM.Copy.Setup.1.0.0.exe', size: 5 }] }]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
    const r = await worker.fetch(req('/tools/jm-copy/latest?platform=win'), { ...baseEnv, ZOOM_SDK_REPO: 'owner/jm-zoom-sdk' });
    check('tools: signierter Link weiter aus REPO, nicht aus ZOOM_SDK_REPO',
      r.status === 200 && aufrufe.includes('https://api.github.com/repos/owner/repo/releases/assets/9')
        && !aufrufe.some((u) => u.includes('jm-zoom-sdk')));
    stub = async () => new Response('{}', { status: 200 });
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
