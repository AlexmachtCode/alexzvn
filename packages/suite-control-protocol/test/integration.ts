// Socket-Integrationstest für den P1-Handshake (kein Framework):
//   node --experimental-strip-types test/integration.ts
// Bindet echte SuiteControlServer auf 127.0.0.1 (advertiseService:false → kein
// mDNS) und prüft open- vs. secure-Modus über echte TCP-Verbindungen.
import net from 'node:net';
import { hmacProof } from '@jm/auth-core';
import { SuiteControlServer } from '../src/server.ts';
import { SuiteControlClient } from '../src/client.ts';
import { parseAuthReq, type SuiteState } from '../src/index.ts';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const STATE: SuiteState = { ns: 'timer', kv: { running: 1, label: 'A' } };

async function startServer(
  port: number,
  extra: Record<string, unknown> = {},
): Promise<{ srv: SuiteControlServer; received: Array<{ ns: string; verb: string }> }> {
  const received: Array<{ ns: string; verb: string }> = [];
  const srv = new SuiteControlServer({
    role: 'timer',
    appId: 'jm-timer',
    advertiseService: false,
    getState: () => STATE,
    onCommand: (cmd) => received.push({ ns: cmd.ns, verb: cmd.verb }),
    ...extra,
  });
  const r = await srv.start(port);
  if (!r.ok) throw new Error(`listen ${port} fehlgeschlagen: ${r.error}`);
  return { srv, received };
}

/** Roh-Client: sammelt empfangene Zeilen; antwortet auf AUTHREQ nur, wenn `token` gesetzt. */
function rawCollect(port: number, opts: { token?: string; windowMs?: number } = {}): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const sock = net.connect({ host: '127.0.0.1', port });
    sock.setEncoding('utf8');
    let buf = '';
    sock.on('data', (d: string) => {
      buf += d;
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        lines.push(line);
        const req = parseAuthReq(line);
        if (req && opts.token) sock.write(`AUTH ${hmacProof(opts.token, req.nonce)}\n`);
      }
    });
    sock.on('error', () => {});
    setTimeout(() => {
      try {
        sock.destroy();
      } catch {
        /* egal */
      }
      resolve(lines);
    }, opts.windowMs ?? 250);
  });
}

const hasState = (lines: string[]): boolean => lines.some((l) => /^STATE\b/.test(l.trim()));

async function main(): Promise<void> {
  // ── 1) OPEN-Modus: unverändertes Verhalten (Rückwärtskompat) ────────────────
  {
    const { srv, received } = await startServer(19087); // mode default = open
    let gotState: SuiteState | null = null;
    const cli = new SuiteControlClient({ onState: (s) => (gotState = s) });
    cli.connect('127.0.0.1', 19087);
    await delay(150);
    ok(gotState != null && gotState.kv.label === 'A', 'open: Client erhält sofort den Greeting-State');
    cli.send('TIMER START');
    await delay(100);
    ok(received.some((c) => c.ns === 'timer' && c.verb === 'start'), 'open: Befehl erreicht den Server');
    cli.disconnect();
    srv.stop();
  }

  // ── 2) SECURE + richtiges Token via echtem SuiteControlClient ────────────────
  {
    const { srv } = await startServer(19088, { mode: 'secure', auth: { token: 'GOOD' } });
    let gotState: SuiteState | null = null;
    let authOk: boolean | null = null;
    const cli = new SuiteControlClient({
      auth: 'GOOD',
      onState: (s) => (gotState = s),
      onAuthChange: (o) => (authOk = o),
    });
    cli.connect('127.0.0.1', 19088);
    await delay(200);
    ok(authOk === true, 'secure+richtiges Token: onAuthChange(true)');
    ok(gotState != null && gotState.kv.label === 'A', 'secure+richtiges Token: State erst nach AUTHOK empfangen');
    cli.disconnect();
    srv.stop();
  }

  // ── 3) SECURE: kein State-Leak vor AUTHOK (Reihenfolge am Draht) ─────────────
  {
    const { srv } = await startServer(19089, { mode: 'secure', auth: { token: 'GOOD' } });
    const lines = await rawCollect(19089, { token: 'GOOD' });
    ok(lines[0]?.startsWith('AUTHREQ'), 'secure: erste Zeile ist AUTHREQ (nicht STATE)');
    const okIdx = lines.findIndex((l) => l.trim() === 'AUTHOK');
    const stateIdx = lines.findIndex((l) => /^STATE\b/.test(l.trim()));
    ok(okIdx >= 0 && stateIdx > okIdx, 'secure: STATE kommt erst NACH AUTHOK');
    srv.stop();
  }

  // ── 4) SECURE + falsches Token → AUTHFAIL, kein State ───────────────────────
  {
    const { srv } = await startServer(19090, { mode: 'secure', auth: { token: 'GOOD' } });
    const lines = await rawCollect(19090, { token: 'WRONG' });
    ok(lines.some((l) => l.trim() === 'AUTHFAIL'), 'secure+falsches Token: AUTHFAIL');
    ok(!hasState(lines), 'secure+falsches Token: KEIN State geleakt');
    srv.stop();
  }

  // ── 5) SECURE + kein Token → nur AUTHREQ, kein State ────────────────────────
  {
    const { srv } = await startServer(19091, { mode: 'secure', auth: { token: 'GOOD' } });
    const lines = await rawCollect(19091); // ignoriert AUTHREQ (kein Token)
    ok(lines[0]?.startsWith('AUTHREQ') && !hasState(lines), 'secure+kein Token: nur AUTHREQ, kein State');
    srv.stop();
  }

  // ── 6) SECURE: Brute-Force-Sperre nach N Fehlversuchen ──────────────────────
  {
    const { srv } = await startServer(19092, {
      mode: 'secure',
      auth: { token: 'GOOD' },
      authMaxFailures: 2,
      authLockoutMs: 5000,
    });
    await rawCollect(19092, { token: 'WRONG' }); // Fehlversuch 1
    await rawCollect(19092, { token: 'WRONG' }); // Fehlversuch 2 → Sperre
    const locked = await rawCollect(19092, { token: 'WRONG' }); // gesperrt
    ok(locked.length === 0, 'secure: nach 2 Fehlversuchen ist die IP gesperrt (kein AUTHREQ mehr)');
    srv.stop();
  }

  await delay(50);
  console.log(failed === 0 ? '\nALLE INTEGRATIONSTESTS OK' : `\n${failed} FEHLER`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Integrationstest abgebrochen:', e);
  process.exit(1);
});
