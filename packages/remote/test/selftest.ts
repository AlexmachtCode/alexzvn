// Mini-Integrationstest für @jm/remote (kein Framework):
//   node --experimental-transform-types test/selftest.ts
// Startet echte HTTP-Server auf 127.0.0.1 und prüft Token-Schutz + Rate-Limit.
import { RemoteServer } from '../src/index.ts';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

async function main(): Promise<void> {
  // ── Mit Token + Rate-Limit ──────────────────────────────────────────────────
  {
    let lastCmd: unknown = null;
    const srv = new RemoteServer({
      page: '<!doctype html><title>remote</title>',
      token: 'SECRET',
      rateLimit: { max: 3, windowMs: 10_000 },
      getState: () => ({ ok: true }),
      onCommand: (c) => (lastCmd = c),
    });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;

    const page = await fetch(`${base}/`);
    ok(page.status === 200, 'Seite / ohne Token erreichbar (200)');

    const noTok = await fetch(`${base}/state`);
    ok(noTok.status === 401, '/state ohne Token → 401');

    const badTok = await fetch(`${base}/state?t=NOPE`);
    ok(badTok.status === 401, '/state mit falschem Token → 401');

    const goodState = await fetch(`${base}/state?t=SECRET`);
    ok(goodState.status === 200, '/state mit Token → 200');

    const cmd = await fetch(`${base}/cmd?t=SECRET`, { method: 'POST', body: JSON.stringify({ verb: 'next' }) });
    ok(cmd.status === 204, '/cmd mit Token → 204');
    ok(lastCmd != null && (lastCmd as { verb?: string }).verb === 'next', '/cmd liefert geparsten Befehl an onCommand');

    const cmdNoTok = await fetch(`${base}/cmd`, { method: 'POST', body: '{}' });
    ok(cmdNoTok.status === 401, '/cmd ohne Token → 401');

    // Rate-Limit: max 3 in 10 s. Eine /cmd ging oben schon durch → noch 2 frei.
    const r2 = await fetch(`${base}/cmd?t=SECRET`, { method: 'POST', body: '{}' });
    const r3 = await fetch(`${base}/cmd?t=SECRET`, { method: 'POST', body: '{}' });
    const r4 = await fetch(`${base}/cmd?t=SECRET`, { method: 'POST', body: '{}' });
    ok(r2.status === 204 && r3.status === 204, 'Rate-Limit: Anfragen 2+3 noch erlaubt (204)');
    ok(r4.status === 429, 'Rate-Limit: 4. Anfrage im Fenster → 429');

    await srv.stop();
  }

  // ── Ohne Token: Verhalten wie bisher (Rückwärtskompat) ──────────────────────
  {
    let lastCmd: unknown = null;
    const srv = new RemoteServer({
      page: '<html></html>',
      onCommand: (c) => (lastCmd = c),
    });
    const { port } = await srv.start();
    const base = `http://127.0.0.1:${port}`;
    const cmd = await fetch(`${base}/cmd`, { method: 'POST', body: JSON.stringify({ x: 1 }) });
    ok(cmd.status === 204, 'ohne Token: /cmd direkt → 204 (unverändert)');
    ok((lastCmd as { x?: number })?.x === 1, 'ohne Token: Befehl kommt an');
    await srv.stop();
  }

  console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Test abgebrochen:', e);
  process.exit(1);
});
