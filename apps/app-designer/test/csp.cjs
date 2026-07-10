// Beweist die zentrale Architekturentscheidung der Sandbox — unter der STRENGEN
// Produktions-CSP, nicht unter der dev-gelockerten.
//
//   npx electron test/csp.cjs <bundle-ordner> none    → erwartet: blockiert
//   npx electron test/csp.cjs <bundle-ordner> jmapp   → erwartet: läuft
//
// Ein Prozess pro Fall: eine Session mit zwei nacheinander umgeschalteten CSPs
// lieferte reproduzierbar ERR_FAILED beim zweiten Laden. Der Aufwand, das zu
// ergründen, zahlt nichts auf die Aussage ein — zwei Prozesse sind sauber.
//
// Der Dev-Modus setzt zusätzlich 'unsafe-inline'/'unsafe-eval'; dort läuft jeder
// Vorschau-Ansatz. Erst im gepackten Build greift `script-src 'self'` — genau dann
// stirbt ein `<iframe srcdoc>` mit inline eingebetteter Runtime, weil Frames auf
// local schemes (about:srcdoc, blob:, data:) die CSP des Parents ERBEN und ein
// <meta>-CSP im Kind sie nur verschärfen, nie lockern kann. Ein eigenes,
// privilegiertes Schema erbt nicht und bringt seine eigene CSP mit.
//
// Geprüft wird beides:
//   1. mit `frame-src 'none'` (der bisherige Default) läuft der Frame NICHT
//      → die Änderung an @jm/app-runtime ist wirklich nötig
//   2. mit `frame-src jmapp:` läuft er, bootet die Runtime und wirft nichts
//      → die Änderung ist auch hinreichend, ohne 'unsafe-inline'/'unsafe-eval'

const { app, BrowserWindow, protocol, session } = require('electron');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const bundleDir = resolve(process.argv[2] || '');
if (!process.argv[2]) {
  console.error('usage: electron test/csp.cjs <bundle-ordner>');
  process.exit(1);
}

const errors = [];
const fail = (m) => {
  console.error(`  FEHLER  ${m}`);
  errors.push(m);
};
const ok = (m) => console.log(`  ok  ${m}`);

app.commandLine.appendSwitch('disable-gpu');

// Muss vor whenReady laufen — macht jmapp:// zu einer echten, sicheren Origin.
// `jmedit` steht hier nur für den Editor-Renderer: unter file:// wäre dessen
// Origin opaque und `script-src 'self'` träfe nichts.
protocol.registerSchemesAsPrivileged([
  { scheme: 'jmapp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'jmedit', privileges: { standard: true, secure: true } },
]);

/** Exakt die Direktiven aus packages/app-runtime/src/index.ts, isDev=false. */
function prodCsp(frameSrc) {
  const SELF = "'self'";
  const d = {
    'default-src': [SELF],
    'script-src': [SELF],
    'style-src': [SELF, "'unsafe-inline'"],
    'img-src': [SELF, 'data:', 'blob:'],
    'font-src': [SELF, 'data:'],
    'media-src': [SELF, 'blob:'],
    'connect-src': [SELF],
    'worker-src': [SELF, 'blob:'],
    'object-src': ["'none'"],
    'base-uri': [SELF],
    'frame-src': frameSrc,
  };
  return Object.entries(d)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

const PARENT_HTML = `<!doctype html><meta charset="utf-8">
<title>Editor</title>
<body><iframe id="f" src="jmapp://preview/index.html" style="width:800px;height:600px"></iframe>
<script src="parent.js"></script></body>`;

// Externes Script, kein inline: unter `script-src 'self'` wäre ein <script>-Block
// im Parent blockiert — genau wie im echten Editor.
//
// Spielt die Editor-Seite der Bridge nach: Handschlag, Variablen-Inspektor,
// Szenenwechsel. Der Frame ist cross-origin, also geht alles über postMessage.
const PARENT_JS = `
const nonce = 'testnonce';
const f = document.getElementById('f');
window.__bridge = { ready: false, vars: null, scenes: [] };
window.addEventListener('message', (e) => {
  if (e.source !== f.contentWindow) return;
  const m = e.data;
  if (!m || typeof m !== 'object' || m.nonce !== nonce) return;
  if (m.t === 'ready') window.__bridge.ready = true;
  if (m.t === 'vars') window.__bridge.vars = m.vars;
  if (m.t === 'scene') window.__bridge.scenes.push(m.sceneId);
});
f.addEventListener('load', () => {
  f.contentWindow.postMessage({ t: 'hello', nonce }, 'jmapp://preview');
});
window.__goto = (sceneId) => f.contentWindow.postMessage({ t: 'goto', nonce, sceneId }, 'jmapp://preview');
`;

/** Wird pro Fall umgeschaltet — eine Session, eine CSP, wie in der echten App. */
let currentCsp = '';

function html(body) {
  // no-store: sonst liefert der zweite Fall die Seite samt CSP-Header aus dem Cache.
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function setupProtocols() {
  protocol.handle('jmedit', (req) => {
    if (new URL(req.url).pathname.endsWith('parent.js')) {
      return new Response(PARENT_JS, {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return html(PARENT_HTML);
  });
  protocol.handle('jmapp', (req) => {
    const path = new URL(req.url).pathname.replace(/^\/+/, '') || 'index.html';
    if (path === 'index.html') return html(readFileSync(join(bundleDir, 'index.html'), 'utf8'));
    if (path === 'runtime.js') {
      return new Response(readFileSync(join(bundleDir, 'runtime.js'), 'utf8'), {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
      });
    }
    return new Response('nicht gefunden', { status: 404 });
  });

  // Die App-CSP gilt für alle Responses der Session — auch für den Frame.
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [currentCsp] } });
  });
}

let caseNo = 0;

async function runCase(label, frameSrc, expectRun) {
  caseNo++;
  currentCsp = prodCsp(frameSrc);

  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const violations = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) violations.push(message);
  });

  try {
    // Cache-Buster: jeder Fall braucht seine eigene, frisch ausgelieferte CSP.
    await win.loadURL(`jmedit://editor/index.html?case=${caseNo}`);
  } catch (err) {
    fail(`[${label}] Editor-Seite lud nicht: ${err.message}`);
    win.destroy();
    return;
  }
  await new Promise((r) => setTimeout(r, 1500));

  // Cross-origin: der Parent kann nicht ins Frame-DOM schauen. Über die
  // WebContents-Frame-API des Main-Prozesses geht es — wie ein Debugger.
  //
  // Einziger Maßstab: LÄUFT die Runtime im Frame? Ein blockierter Frame bleibt als
  // leeres Element im DOM stehen; seine bloße Existenz beweist nichts.
  const frame = win.webContents.mainFrame.frames.find((f) => f.url.startsWith('jmapp://'));
  let booted = false;
  if (frame) {
    try {
      booted = await frame.executeJavaScript(`!!(window.JMApp && window.JMApp.handle)`);
    } catch {
      booted = false;
    }
  }

  console.log(`\n[${label}]  frame-src ${frameSrc.join(' ')}`);
  if (expectRun) {
    booted
      ? ok("Runtime im Frame gebootet — script-src 'self' greift auf jmapp://preview")
      : fail('Runtime bootete nicht — der Frame lief nicht an');

    // Die postMessage-Bridge: Handschlag, Variablen, Szenenwechsel.
    const parent = (code) => win.webContents.executeJavaScript(code, true);
    const bridge = JSON.parse(await parent(`JSON.stringify(window.__bridge)`));
    bridge.ready
      ? ok('Bridge: Handschlag (hello → ready) über Origin-Grenze')
      : fail('Bridge: kein ready — der Frame antwortet nicht');
    bridge.vars && bridge.vars.drehungen === 0
      ? ok('Bridge: Variablen im Inspektor angekommen (drehungen=0)')
      : fail(`Bridge: keine Variablen empfangen (${JSON.stringify(bridge.vars)})`);

    await parent(`window.__goto('sc_tpl_win'); true`);
    await new Promise((r) => setTimeout(r, 400));
    const after = JSON.parse(await parent(`JSON.stringify(window.__bridge.scenes)`));
    after.includes('sc_tpl_win')
      ? ok('Bridge: goto vom Editor schaltet die Szene im Frame')
      : fail(`Bridge: goto wirkungslos (Szenen: ${JSON.stringify(after)})`);

    const cspViolations = violations.filter((v) => /Content Security Policy|Refused to/i.test(v));
    cspViolations.length === 0
      ? ok('keine CSP-Verstöße in der Konsole')
      : cspViolations.forEach((v) => fail(`CSP-Verstoß: ${v}`));
  } else {
    !booted
      ? ok("Frame wie erwartet blockiert — frame-src 'none' verbietet jmapp://")
      : fail("Frame lief trotz frame-src 'none' — die Direktive greift nicht");
  }

  win.destroy();
}

const mode = process.argv[3] === 'jmapp' ? 'jmapp' : 'none';

app.whenReady().then(async () => {
  setupProtocols();
  if (mode === 'none') {
    // Der bisherige Default in @jm/app-runtime.
    await runCase('vorher', ["'none'"], false);
  } else {
    // Nach der Änderung (csp: { frameSrc: ['jmapp:'] }).
    await runCase('nachher', ['jmapp:'], true);
  }
  console.log(errors.length === 0 ? 'CSP-Fall bestanden.\n' : `${errors.length} Fehler.\n`);
  app.exit(errors.length === 0 ? 0 : 1);
});
