// Altfehler SC-S2 (Stufe 1, A7, A8): nur das eigene App-Fenster ist am Server ohne Anmeldung Admin. Geprüft werden die reinen
// Bausteine aus src/main/auth/zugang.ts (nur node:crypto, darum unter tsx lauffähig), der Weg des Renderers (apiFetch,
// handshakeAuth) mit Schein-fetch und Schein-Preload und, als Quelltext-Wächter (Ruling R3), Middleware, Server und der
// IPC-Handler im Hauptprozess, die unter tsx nicht laufen (better-sqlite3, electron). Das Verhalten im echten Fenster belegt die
// Echt-Fenster-Messung des Tasks.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import * as client from '@/sync/client';
import { FENSTER_HEADER, istEigeneSeite, istFensterGeheimnis, neuesFensterGeheimnis, ursprungErlaubt } from '../../src/main/auth/zugang';
import { ohneKommentare } from './testzustand';

// ── SC-S2 istFensterGeheimnis: nur die gleich lange, gleiche Zeichenkette gilt; alles andere ist false, nie ein Wurf ──
{
  const g = neuesFensterGeheimnis();
  const sicher = (angeboten: unknown): boolean | string => {
    try {
      return istFensterGeheimnis(angeboten, g);
    } catch (e) {
      return `Wurf: ${String(e)}`;
    }
  };
  const anders = `${g.slice(0, -1)}${g.endsWith('0') ? '1' : '0'}`;
  gleich(sicher(g), true, 'SC-S2 istFensterGeheimnis: das Geheimnis dieses Starts gilt');
  gleich(sicher(anders), false, 'SC-S2 istFensterGeheimnis: ein Zeichen anders gilt nicht');
  gleich([sicher(g.slice(0, -2)), sicher(`${g}00`), sicher('ä'.repeat(g.length))], [false, false, false], 'SC-S2 istFensterGeheimnis: andere Länge (kürzer, länger, gleich viele Zeichen mit mehr Bytes) gilt nicht, ohne Wurf');
  gleich([sicher(''), sicher(undefined), sicher(null)], [false, false, false], 'SC-S2 istFensterGeheimnis: leer, undefined und null gelten nicht');
  gleich([sicher(123), sicher([g]), sicher({ toString: () => g })], [false, false, false], 'SC-S2 istFensterGeheimnis: Zahl, Array (doppelter Header) und Objekt gelten nicht');
  gleich(istFensterGeheimnis('', ''), false, 'SC-S2 istFensterGeheimnis: ein leeres Geheimnis gilt nie, auch nicht gegen ein leeres Angebot');
}

// ── SC-S2 neuesFensterGeheimnis: 32 Zufallsbytes als Hex, je Aufruf neu ──
{
  const a = neuesFensterGeheimnis();
  const b = neuesFensterGeheimnis();
  ok(/^[0-9a-f]{64}$/.test(a) && /^[0-9a-f]{64}$/.test(b), 'SC-S2 neuesFensterGeheimnis: 64 Hex-Zeichen (32 Bytes)');
  ok(a !== b, 'SC-S2 neuesFensterGeheimnis: zwei Aufrufe ergeben zwei Werte');
  gleich(FENSTER_HEADER, 'x-jms-fenster', 'SC-S2 FENSTER_HEADER: der Header heißt X-JMS-Fenster (klein, wie Node ihn liefert)');
}

// ── SC-S2 ursprungErlaubt (A8): kein Origin, Origin = http:// + Host, null und file://, Vite-Adressen nur als Zusatz ──
{
  const DEV = ['http://localhost:5174', 'http://127.0.0.1:5174'];
  const faelle: Array<[string, string | undefined, string | undefined, readonly string[], boolean]> = [
    ['ohne Origin (Programm)', undefined, '127.0.0.1:7778', [], true],
    ['ohne Origin und ohne Host', undefined, undefined, [], true],
    ['Browser vom Server selbst', 'http://192.168.1.5:7778', '192.168.1.5:7778', [], true],
    ['Origin in Großschreibung', 'HTTP://192.168.1.5:7778', '192.168.1.5:7778', [], true],
    ['Host in Großschreibung', 'http://studio.local:7778', 'STUDIO.LOCAL:7778', [], true],
    ['anderer Port', 'http://192.168.1.5:7779', '192.168.1.5:7778', [], false],
    ['fremde Seite', 'http://evil.example', '192.168.1.5:7778', [], false],
    ['fremde Seite, die mit dem Host beginnt', 'http://192.168.1.5:7778.evil.example', '192.168.1.5:7778', [], false],
    ['https statt http', 'https://192.168.1.5:7778', '192.168.1.5:7778', [], false],
    ['leerer Origin', '', '192.168.1.5:7778', [], false],
    ['null (App-Fenster)', 'null', '127.0.0.1:7778', [], true],
    ['file:// (App-Fenster)', 'file://', '127.0.0.1:7778', [], true],
    ['Vite-Adresse ohne Zusatz', 'http://localhost:5174', '127.0.0.1:7778', [], false],
    ['Vite-Adresse mit Zusatz', 'http://localhost:5174', '127.0.0.1:7778', DEV, true],
    ['Vite-Adresse 127.0.0.1 mit Zusatz', 'http://127.0.0.1:5174', '127.0.0.1:7778', DEV, true],
    ['anderer Vite-Port mit Zusatz', 'http://localhost:5175', '127.0.0.1:7778', DEV, false],
    ['Origin gesetzt, Host fehlt', 'http://127.0.0.1:7778', undefined, [], false],
    ['Origin gesetzt, Host leer', 'http://127.0.0.1:7778', '', [], false],
  ];
  const falsch = faelle.filter(([, origin, host, dazu, soll]) => ursprungErlaubt(origin, host, dazu) !== soll).map(([name]) => name);
  ok(falsch.length === 0, `SC-S2 ursprungErlaubt: ${faelle.length} Fälle nach A8 (falsch: ${falsch.join(', ') || 'keine'})`);
}

// ── SC-S2 istEigeneSeite (A7): der gebaute Renderer aus file://…/renderer/index.html oder im Dev der Ursprung der Vite-Adresse ──
{
  const faelle: Array<[string, string, string | undefined, boolean]> = [
    ['gepackter Renderer mit Anker', 'file:///C:/x/resources/app.asar/out/renderer/index.html#/video', undefined, true],
    ['gebauter Renderer mit Suche', 'file:///C:/x/out/renderer/index.html?a=1', undefined, true],
    ['fremde Seite mit demselben Pfad', 'https://evil.example/renderer/index.html', undefined, false],
    ['fremde Seite mit demselben Pfad im Dev', 'https://evil.example/renderer/index.html', 'http://localhost:5174', false],
    ['andere lokale Datei', 'file:///C:/x/andere.html', undefined, false],
    ['anderer Ordner, der auf renderer endet', 'file:///C:/x/notrenderer/index.html', undefined, false],
    ['Datei mit angehängter Endung', 'file:///C:/x/renderer/index.html.evil', undefined, false],
    ['Vite-Adresse ohne devUrl', 'http://localhost:5174/', undefined, false],
    ['Vite-Adresse mit devUrl', 'http://localhost:5174/#/video', 'http://localhost:5174', true],
    ['Vite-Adresse mit devUrl samt Pfad', 'http://localhost:5174/', 'http://localhost:5174/index.html', true],
    ['anderer Port als devUrl', 'http://localhost:5175/', 'http://localhost:5174', false],
    ['keine Adresse', 'kaputt', 'http://localhost:5174', false],
    ['devUrl keine Adresse', 'http://localhost:5174/', 'kaputt', false],
    ['Seite und devUrl ohne Ursprung (beide „null“)', 'data:text/html,x', 'about:blank', false],
  ];
  const falsch = faelle.filter(([, url, dev, soll]) => istEigeneSeite(url, dev) !== soll).map(([name]) => name);
  ok(falsch.length === 0, `SC-S2 istEigeneSeite: ${faelle.length} Fälle (falsch: ${falsch.join(', ') || 'keine'})`);
}

// ── SC-S2 apiFetch schickt Geheimnis und Token / handshakeAuth: Schein-fetch, Schein-Preload; im Browser ohne Preload null ──
// bruecken.test wartet auf oberster Ebene mit einem eigenen window; Module laufen dabei verzahnt. Darum erst ein Makrotask (die
// Wartestellen dort sind reine Mikrotasks), und window und fetch gelten hier nur für den synchronen Teil eines Aufrufs: dort liest
// ladeFensterGeheimnis den Preload und ruft apiFetch fetch auf.
await new Promise<void>((r) => setImmediate(r));
{
  type Auth = { token?: string; fenster?: string };
  const c = client as unknown as Record<string, unknown>;
  const lade = c.ladeFensterGeheimnis as (() => Promise<void>) | undefined;
  const hs = c.handshakeAuth as ((token: string | null) => Auth) | undefined;
  ok(typeof lade === 'function' && typeof hs === 'function', 'SC-S2 apiFetch schickt Geheimnis und Token: ladeFensterGeheimnis und handshakeAuth gibt es');
  const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
  const gesendet: Array<{ url: string; headers: Record<string, string> }> = [];
  const schein = (async (url: string | URL | Request, init?: RequestInit) => {
    gesendet.push({ url: String(url), headers: { ...((init?.headers ?? {}) as Record<string, string>) } });
    return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const mit = <T>(fenster: unknown, f: () => Promise<T> | undefined): Promise<T | undefined> => {
    const echt = g.fetch;
    if (fenster !== undefined) g.window = fenster;
    g.fetch = schein;
    try {
      return Promise.resolve(f());
    } finally {
      delete g.window;
      g.fetch = echt;
    }
  };
  const GEHEIM = 'ab'.repeat(32);
  const kopf = (i: number): Record<string, string> => gesendet[i]?.headers ?? {};
  let fragen = 0;
  const fenster = { jms: { isElectron: true, serverUrl: 'http://127.0.0.1:7778', fensterGeheimnis: async () => (fragen++, GEHEIM) } };
  await mit(fenster, () => lade?.());
  await mit(fenster, () => client.apiFetch('/api/atem', { method: 'POST', token: 'tok-1', body: '{}' }));
  await mit(fenster, () => client.apiFetch('/api/login', { method: 'POST', body: '{}' }));
  gleich(
    [gesendet[0]?.url, kopf(0)['X-JMS-Fenster'], kopf(0).Authorization, kopf(0)['Content-Type'], fragen],
    ['http://127.0.0.1:7778/api/atem', GEHEIM, 'Bearer tok-1', 'application/json', 1],
    'SC-S2 apiFetch schickt Geheimnis und Token: im Fenster X-JMS-Fenster und Authorization wie heute (einmal gefragt)',
  );
  gleich([kopf(1)['X-JMS-Fenster'], 'Authorization' in kopf(1)], [GEHEIM, false], 'SC-S2 apiFetch schickt Geheimnis und Token: ohne Token (Anmeldung) nur das Geheimnis');
  ok(Object.keys(kopf(0)).filter((k) => k.toLowerCase() === FENSTER_HEADER).length === 1, 'SC-S2 apiFetch schickt Geheimnis und Token: der Header des Renderers ist FENSTER_HEADER des Servers');
  gleich([hs?.('tok-1'), hs?.(null)], [{ token: 'tok-1', fenster: GEHEIM }, { fenster: GEHEIM }], 'SC-S2 handshakeAuth: im Fenster Token und Geheimnis (auth.fenster), ohne Token nur das Geheimnis');
  // Abgelehnt (null), älterer Preload ohne Funktion, Fehler der Brücke, leere Antwort: kein Geheimnis, kein Wurf.
  const ohne: Array<[string, unknown]> = [
    ['abgelehnt', { jms: { isElectron: true, fensterGeheimnis: async () => null } }],
    ['älterer Preload', { jms: { isElectron: true } }],
    ['Brücke wirft', { jms: { isElectron: true, fensterGeheimnis: async () => { throw new Error('weg'); } } }],
    ['leere Antwort', { jms: { isElectron: true, fensterGeheimnis: async () => '' } }],
  ];
  const falsch: string[] = [];
  for (const [name, w] of ohne) {
    await mit(fenster, () => lade?.());
    try {
      await mit(w, () => lade?.());
      if (JSON.stringify(hs?.('t')) !== JSON.stringify({ token: 't' })) falsch.push(name);
    } catch (e) {
      falsch.push(`${name} (Wurf ${String(e)})`);
    }
  }
  ok(falsch.length === 0, `SC-S2 handshakeAuth: abgelehnt, älterer Preload, Fehler und leere Antwort ergeben kein Geheimnis (auch nach einem früheren) und keinen Wurf (falsch: ${falsch.join(', ') || 'keine'})`);
  // Browser: kein window, kein Preload → das Geheimnis ist null (auch nach einem früheren Fenster-Lauf).
  await mit(fenster, () => lade?.());
  await mit(undefined, () => lade?.());
  gesendet.length = 0;
  await mit(undefined, () => client.apiFetch('/api/me', { token: 'tok-2' }));
  gleich(
    [Object.keys(kopf(0)).sort(), kopf(0).Authorization],
    [['Authorization', 'Content-Type'], 'Bearer tok-2'],
    'SC-S2 apiFetch schickt Geheimnis und Token: im Browser (ohne Preload) nur Authorization, kein X-JMS-Fenster',
  );
  gleich([hs?.('tok-2'), hs?.(null)], [{ token: 'tok-2' }, {}], 'SC-S2 handshakeAuth: im Browser nur das Token, ohne Token leer');
  const quelle = ohneKommentare(leseText('src/renderer/src/sync/client.ts'));
  ok(
    quelle.includes('auth: handshakeAuth(token),') && !quelle.includes('auth: token ? { token } : undefined'),
    'SC-S2 handshakeAuth: connect schickt handshakeAuth(token) als auth',
  );
  const haupt = ohneKommentare(leseText('src/renderer/src/main.tsx'));
  const warten = haupt.indexOf('await ladeFensterGeheimnis();');
  ok(warten >= 0 && warten < haupt.indexOf('createRoot(root).render('), 'SC-S2 main.tsx wartet auf ladeFensterGeheimnis() vor dem ersten Render');
}

// ── SC-S2 Wächter Middleware, Server, IPC (Ruling R3): keine Loopback-Regel, nur eigene Ursprünge, Geheimnis nur ans Hauptfenster ──
{
  const mw = ohneKommentare(leseText('src/main/auth/middleware.ts'));
  ok(
    !mw.includes('remoteAddress') && !mw.includes('handshake.address') && !mw.includes('isLoopback'),
    'SC-S2 Wächter Middleware: keine Regel nach der Absender-Adresse (remoteAddress, handshake.address, isLoopback)',
  );
  const http = mw.indexOf('istFensterGeheimnis(req.headers[FENSTER_HEADER], FENSTER_GEHEIMNIS)');
  const sock = mw.indexOf('istFensterGeheimnis(socket.handshake.auth?.fenster, FENSTER_GEHEIMNIS)');
  ok(
    http >= 0 && http < mw.indexOf('req.user = LOOPBACK_ADMIN;') && sock >= 0 && sock < mw.indexOf('socket.data.user = LOOPBACK_ADMIN;') && (mw.match(/= LOOPBACK_ADMIN;/g) ?? []).length === 2,
    'SC-S2 Wächter Middleware: „local“ (Admin) nur mit gültigem X-JMS-Fenster bzw. auth.fenster, sonst gilt das Token wie heute',
  );
  ok(
    /^const FENSTER_GEHEIMNIS = neuesFensterGeheimnis\(\);$/m.test(mw) && (mw.match(/neuesFensterGeheimnis\(/g) ?? []).length === 1 && mw.includes('export function fensterGeheimnis(): string {'),
    'SC-S2 Wächter Middleware: das Geheimnis entsteht einmal je Prozess (beim Laden des Moduls), fensterGeheimnis() gibt es zurück',
  );
  const srv = ohneKommentare(leseText('src/main/server.ts'));
  const pruefung = srv.indexOf('if (!ursprungErlaubt(req.headers.origin, req.headers.host, devUrspruenge)) {');
  ok(
    pruefung >= 0 &&
      pruefung < srv.indexOf('handleApi(req, res, pathname, method)') &&
      pruefung < srv.indexOf("res.setHeader('Access-Control-Allow-Origin', origin);") &&
      srv.slice(pruefung).replace(/\s+/g, ' ').startsWith("if (!ursprungErlaubt(req.headers.origin, req.headers.host, devUrspruenge)) { sendJson(res, 403, { error: 'origin' }); return; }"),
    'SC-S2 Wächter Server: HTTP prüft den Ursprung vor CORS und vor handleApi, sonst 403 {error: origin}',
  );
  ok(
    !srv.includes("origin: '*'") &&
      !srv.includes('cors:') &&
      srv.includes('allowRequest: (req, cb) => cb(null, ursprungErlaubt(req.headers.origin, req.headers.host, devUrspruenge)),') &&
      srv.includes("res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-JMS-Fenster');"),
    'SC-S2 Wächter Server: Socket.IO ohne cors-Freigabe, fremde Ursprünge lehnt allowRequest ab; Dev-CORS erlaubt X-JMS-Fenster',
  );
  ok(
    /const devUrspruenge: string\[\] = app\.isPackaged\s*\?\s*\[\]\s*:/.test(srv),
    'SC-S2 Wächter Server: die Vite-Adressen kommen nur ohne Paket dazu (devUrspruenge leer, wenn app.isPackaged)',
  );
  const main = ohneKommentare(leseText('src/main/index.ts')).replace(/\s+/g, ' ');
  const von = main.indexOf("ipcMain.handle('studio:fensterGeheimnis', (e) =>");
  const handler = von >= 0 ? main.slice(von, main.indexOf('fensterGeheimnis() : null', von)) : '';
  ok(
    handler.includes('e.sender === mainWindow?.webContents &&') &&
      handler.includes('e.senderFrame === e.sender.mainFrame &&') &&
      handler.includes('istEigeneSeite(e.senderFrame.url, process.env.ELECTRON_RENDERER_URL) ?') &&
      (main.match(/studio:fensterGeheimnis/g) ?? []).length === 1,
    'SC-S2 Wächter IPC: studio:fensterGeheimnis antwortet nur dem Hauptfenster, im Hauptrahmen, auf der eigenen Seite (sonst null), nie per send',
  );
}
