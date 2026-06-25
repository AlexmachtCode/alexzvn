// Socket-Integrationstest für den P1-Handshake (kein Framework):
//   npm run test:integration   (esbuild-Bundle → node; bonjour-service lädt nur gebündelt)
// Bindet echte SuiteControlServer auf 127.0.0.1 (advertiseService:false → kein
// mDNS) und prüft open/secure/TLS über echte TCP-/TLS-Verbindungen.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { certFingerprint, hmacProof } from '@jm/auth-core';
import { writeControlConfig } from '@jm/control-config';
import { SuiteControlServer } from '../src/server.ts';
import { SuiteControlClient } from '../src/client.ts';
import { parseAuthReq, type SuiteState } from '../src/index.ts';

// Throwaway-Testzertifikat (selbstsigniert, EC P-256) — KEIN Secret, nur für
// diesen TLS-Integrationstest erzeugt.
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIBhTCCASugAwIBAgIUZLJSpXBBLzdFiJ5UTC3cbMRNE/kwCgYIKoZIzj0EAwIw
GDEWMBQGA1UEAwwNam0tc3VpdGUtdGVzdDAeFw0yNjA2MjUxMTUxMTNaFw0zNjA2
MjIxMTUxMTNaMBgxFjAUBgNVBAMMDWptLXN1aXRlLXRlc3QwWTATBgcqhkjOPQIB
BggqhkjOPQMBBwNCAASZ7WcDFrl9KKTv7ydif+LzX4KYDwPErBYpWiBZi1HmTxzH
ecORNwa1nSIVJPKvrMLy0WoM5ZNcKYaZTPDTorN4o1MwUTAdBgNVHQ4EFgQUqGQ3
4yn1tK5lTD5/+bFXBX3+rw8wHwYDVR0jBBgwFoAUqGQ34yn1tK5lTD5/+bFXBX3+
rw8wDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiEAiC4dDZ3a4uhj
ksAGWLma4tGILo8EoFtRJKtJnDEB31ICIDvShBjtwkEf58/8PLBYwfPbmxt/2OJC
AovVbb6Rel2Y
-----END CERTIFICATE-----
`;
const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgJeFfEqwdHNMtR99K
vFOgONw/g0B912ckyFwPwMyGFUWhRANCAASZ7WcDFrl9KKTv7ydif+LzX4KYDwPE
rBYpWiBZi1HmTxzHecORNwa1nSIVJPKvrMLy0WoM5ZNcKYaZTPDTorN4
-----END PRIVATE KEY-----
`;

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

  // ── 7) SECURE + TLS + richtiger Token + richtiger Fingerprint ───────────────
  const GOOD_FP = certFingerprint(TEST_CERT);
  {
    const { srv } = await startServer(19093, {
      mode: 'secure',
      auth: { token: 'GOOD' },
      tls: { key: TEST_KEY, cert: TEST_CERT },
    });
    let gotState: SuiteState | null = null;
    let authOk: boolean | null = null;
    const cli = new SuiteControlClient({
      auth: 'GOOD',
      tls: { fingerprint: GOOD_FP },
      onState: (s) => (gotState = s),
      onAuthChange: (o) => (authOk = o),
    });
    cli.connect('127.0.0.1', 19093);
    await delay(350);
    ok(authOk === true, 'TLS+richtiger Pin+Token: onAuthChange(true)');
    ok(gotState != null && gotState.kv.label === 'A', 'TLS: State nach AUTHOK über verschlüsselten Kanal');
    cli.disconnect();
    srv.stop();
  }

  // ── 8) SECURE + TLS + FALSCHER Fingerprint → verworfen (MITM-Schutz) ────────
  {
    const { srv } = await startServer(19094, {
      mode: 'secure',
      auth: { token: 'GOOD' },
      tls: { key: TEST_KEY, cert: TEST_CERT },
    });
    let gotState: SuiteState | null = null;
    let authOk: boolean | null = null;
    const cli = new SuiteControlClient({
      auth: 'GOOD',
      tls: { fingerprint: '00'.repeat(32) }, // falscher Pin
      onState: (s) => (gotState = s),
      onAuthChange: (o) => (authOk = o),
    });
    cli.connect('127.0.0.1', 19094);
    await delay(350);
    ok(gotState === null, 'TLS+falscher Pin: KEIN State (Verbindung verworfen)');
    ok(authOk === false, 'TLS+falscher Pin: onAuthChange(false)');
    cli.disconnect();
    srv.stop();
  }

  // ── 9) Auto-secure: Nicht-Loopback-Bind erzwingt secure (ohne mode) ─────────
  {
    // bindHost 0.0.0.0 (alle Interfaces) + auth, KEIN mode → automatisch secure.
    const { srv } = await startServer(19095, { bindHost: '0.0.0.0', auth: { token: 'GOOD' } });
    const lines = await rawCollect(19095, { token: 'GOOD' });
    ok(lines[0]?.startsWith('AUTHREQ'), 'auto-secure: Nicht-Loopback-Bind → AUTHREQ zuerst (kein offener Greeting)');
    const okIdx = lines.findIndex((l) => l.trim() === 'AUTHOK');
    const stateIdx = lines.findIndex((l) => /^STATE\b/.test(l.trim()));
    ok(okIdx >= 0 && stateIdx > okIdx, 'auto-secure: korrektes Token → AUTHOK, dann STATE');
    srv.stop();
  }

  // ── 10) Auto-secure fail-closed: Nicht-Loopback ohne auth → niemand rein ────
  {
    const { srv } = await startServer(19096, { bindHost: '0.0.0.0' }); // kein mode, kein auth
    const lines = await rawCollect(19096, { token: 'GOOD' });
    ok(lines.some((l) => l.trim() === 'AUTHFAIL'), 'auto-secure fail-closed: ohne auth-Config → AUTHFAIL');
    ok(!hasState(lines), 'auto-secure fail-closed: KEIN State geleakt');
    srv.stop();
  }

  // ── 11) Config-driven: geteilte control.json{secure,token} → Server secure ──
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jmcc-it-'));
    writeControlConfig(tmp, { mode: 'secure', token: 'CFGTOKEN' });
    // KEINE expliziten secure-Opts — nur appDataDir auf die Konfig zeigen.
    const { srv } = await startServer(19097, { appDataDir: tmp });
    const lines = await rawCollect(19097, { token: 'CFGTOKEN' });
    ok(lines[0]?.startsWith('AUTHREQ'), 'config-driven: control.json{secure} → AUTHREQ (secure aus Konfig)');
    const okIdx = lines.findIndex((l) => l.trim() === 'AUTHOK');
    const stateIdx = lines.findIndex((l) => /^STATE\b/.test(l.trim()));
    ok(okIdx >= 0 && stateIdx > okIdx, 'config-driven: Token aus Konfig akzeptiert → AUTHOK, dann STATE');
    fs.rmSync(tmp, { recursive: true, force: true });
    srv.stop();
  }

  // ── 12) Explizite Option gewinnt über Konfig (open schlägt config-secure) ───
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jmcc-it-'));
    writeControlConfig(tmp, { mode: 'secure', token: 'X' });
    const { srv } = await startServer(19098, { appDataDir: tmp, mode: 'open' });
    const lines = await rawCollect(19098, {});
    ok(
      lines.some((l) => /^STATE\b/.test(l.trim())) && !lines.some((l) => l.startsWith('AUTHREQ')),
      'explizite Option open gewinnt über Konfig secure (sofortiger Greeting, kein AUTHREQ)',
    );
    fs.rmSync(tmp, { recursive: true, force: true });
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
