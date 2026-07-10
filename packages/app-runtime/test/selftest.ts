// Selbsttest der CSP-Konstruktion — ohne Electron, ohne Fenster:
//   node --experimental-strip-types packages/app-runtime/test/selftest.ts
//
// Warum es diesen Test gibt: die strenge Fassung erlaubt `connect-src 'self'`, der Dev-Modus
// dagegen ws:/wss:/http:/https:. Eine App, deren Renderer selbst mit dem Netz spricht, läuft
// darum in `npm run dev` tadellos und stirbt stumm im gepackten Build. Genau das ist JM Connect
// beim ersten Installer passiert (Raum-WebSocket geblockt). Der Unterschied wird hier festgenagelt.
import { buildCsp } from '../src/csp.ts';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

/** Die Quellen einer Direktive aus dem fertigen Header-Wert herausziehen. */
function directive(csp: string, name: string): string[] {
  const part = csp.split('; ').find((d) => d.startsWith(`${name} `));
  return part ? part.slice(name.length + 1).split(' ') : [];
}

// ── Die Falle selbst ──────────────────────────────────────────────────────────
{
  const dev = buildCsp({}, true);
  const prod = buildCsp({}, false);
  check('Dev lässt wss: durch (Vite/HMR)', directive(dev, 'connect-src').includes('wss:'));
  check(
    '⭐ Prod OHNE connectSrc erlaubt NUR self — hier stirbt eine Renderer-WebSocket',
    directive(prod, 'connect-src').join(' ') === "'self'",
  );
}

// ── Der Ausweg: die App meldet ihren Bedarf an ────────────────────────────────
{
  const prod = buildCsp({ connectSrc: ['https:', 'wss:'] }, false);
  const cs = directive(prod, 'connect-src');
  check('Prod MIT connectSrc erlaubt wss:', cs.includes('wss:'));
  check('Prod MIT connectSrc erlaubt https:', cs.includes('https:'));
  check("'self' bleibt immer enthalten", cs.includes("'self'"));
}

// ── Was die Lockerung NICHT aufweicht ─────────────────────────────────────────
{
  const prod = buildCsp({ connectSrc: ['https:', 'wss:'] }, false);
  check("Prod: script-src bleibt 'self' (kein unsafe-eval)", directive(prod, 'script-src').join(' ') === "'self'");
  check("object-src bleibt 'none'", directive(prod, 'object-src').join(' ') === "'none'");
  check("frame-src bleibt 'none'", directive(prod, 'frame-src').join(' ') === "'none'");
  check('img-src trägt data: (QR-Codes)', directive(prod, 'img-src').includes('data:'));
}

// ── Zusätze landen in der richtigen Direktive ─────────────────────────────────
{
  const csp = buildCsp({ imgSrc: ['jm-media:'], mediaSrc: ['jm-media:'] }, false);
  check('imgSrc-Zusatz landet in img-src', directive(csp, 'img-src').includes('jm-media:'));
  check('mediaSrc-Zusatz landet in media-src', directive(csp, 'media-src').includes('jm-media:'));
  check('… und nicht in connect-src', !directive(csp, 'connect-src').includes('jm-media:'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
