// Anmeldung im Launcher (Teil 1) · Z2: Rückkanal beim Bestätigen (src/main/konto/rueckkanal.ts; RFC 8252 7.3/8.3 loopback redirect).
// Echte Sockets nur auf 127.0.0.1, nach jedem Fall geschlossen (G3). Dazu die ganze Kette mit dem echten Worker (handleKonto aus
// services/release-proxy/konto-relay.js, das worker.fetch für /konto/* ruft, mit den Attrappen aus test/konto-attrappen.mjs, ohne
// Netz; den Default-Export von worker.js liefert tsx nicht als Objekt mit fetch): Launcher-Ablauf, Client, Gerät und Rückkanal
// echt; der Browser ist der Test (Anmelden als DO-Aktion, „Ja“ als Formular-POST, dann folgt er dem 303 von Hand).
import { request as httpRequest } from 'node:http';
import { readFileSync } from 'node:fs';
import { oeffneRueckkanal, RUECK_PFAD, TEXT_ZURUECK, type Rueckkanal } from '../src/main/konto/rueckkanal';
import { erzeugeAnmeldeAblauf, type AnmeldeAblauf } from '../src/main/konto/anmelde-ablauf';
import { erzeugeKontoClient } from '../src/main/konto/worker-client';
import { ladeOderErzeugeGeraet, type GeraetHandle } from '../src/main/konto/geraet';
import type { GespeicherteSitzung } from '../src/main/konto/sitzung-kern';
import type { AnmeldeSchritt } from '../src/shared/konto';
import { handleKonto } from '../../../services/release-proxy/konto-relay.js';
import { RUECK_PFAD as RUECK_PFAD_WORKER } from '../../../services/release-proxy/konto-seiten.js';
import { makeKontoNs, makeKV, makeRLBindungen, makeUhr, makeWaitCtx, rufeDo, testSchluessel } from '../../../services/release-proxy/test/konto-attrappen.mjs';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

type Antwort = { status: number; kopf: Record<string, string | string[] | undefined>; text: string } | { fehler: string };

/** Eine Anfrage an 127.0.0.1:<port> ohne Agent (eigene Verbindung), mit frei wählbarem Host-Kopf und Pfad. */
function hole(port: number, o: { pfad: string; methode?: string; host?: string }): Promise<Antwort> {
  return new Promise((fertig) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: o.pfad, method: o.methode ?? 'GET', agent: false, headers: { host: o.host ?? `127.0.0.1:${port}` } }, (res) => {
      const teile: Buffer[] = [];
      res.on('data', (c: Buffer) => teile.push(c));
      res.on('end', () => fertig({ status: res.statusCode ?? 0, kopf: res.headers, text: Buffer.concat(teile).toString('utf8') }));
    });
    req.on('error', (e: NodeJS.ErrnoException) => fertig({ fehler: e.code ?? e.name }));
    req.setTimeout(3000, () => { req.destroy(); fertig({ fehler: 'zeitlimit' }); });
    req.end();
  });
}
const istStatus = (a: Antwort, s: number): boolean => 'status' in a && a.status === s;
const VORGANG = 'Ab1_-'.repeat(4) + 'Ab1_'; // 24 Zeichen wie zufall(18)
const E = 'Cd2_-'.repeat(8) + 'Cd2'; // 43 Zeichen wie zufall(32)
const pfad = (v: string, e: string): string => `${RUECK_PFAD}?v=${encodeURIComponent(v)}&e=${encodeURIComponent(e)}`;
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Rückkanal mit Mitschnitt von Log und angenommenen Werten. */
async function lauscher(o: { fristMs?: number } = {}): Promise<{ rk: Rueckkanal; log: string[]; werte: string[] }> {
  const log: string[] = [];
  const werte: string[] = [];
  const rk = await oeffneRueckkanal({ angenommen: (e) => werte.push(e), log: (z) => log.push(z), fristMs: o.fristMs });
  return { rk, log, werte };
}

// --- Z2 1: nur 127.0.0.1, freier Port, vor dem Vorgang nimmt er nichts an ------------------------------------------------------
{
  const { rk, werte } = await lauscher();
  const vorher = await hole(rk.port, { pfad: pfad(VORGANG, E) });
  ck('Z2 1: der Rückkanal lauscht nur auf 127.0.0.1 mit einem Port vom Betriebssystem (1024–65535)',
    rk.adresse === '127.0.0.1' && Number.isInteger(rk.port) && rk.port >= 1024 && rk.port <= 65535);
  ck('Z2 1: vor dem Anlegen des Vorgangs (setzeVorgang) nimmt er nichts an (404, nichts angenommen, bleibt offen)',
    istStatus(vorher, 404) && werte.length === 0 && rk.offen());
  await rk.schliesse();
}

// --- Z2 1: alles außer genau einer gültigen Anfrage → 404 ohne Inhalt ---------------------------------------------------------------
{
  const { rk, log, werte } = await lauscher();
  rk.setzeVorgang(VORGANG);
  const p = rk.port;
  const faelle: Array<[string, { pfad: string; methode?: string; host?: string }]> = [
    ['fremder Host-Kopf (DNS-Rebinding)', { pfad: pfad(VORGANG, E), host: `boese.example:${p}` }],
    ['Host localhost', { pfad: pfad(VORGANG, E), host: `localhost:${p}` }],
    ['Host ohne Port', { pfad: pfad(VORGANG, E), host: '127.0.0.1' }],
    ['Host mit anderem Port', { pfad: pfad(VORGANG, E), host: `127.0.0.1:${p === 65535 ? 1024 : p + 1}` }],
    ['POST', { pfad: pfad(VORGANG, E), methode: 'POST' }],
    ['HEAD', { pfad: pfad(VORGANG, E), methode: 'HEAD' }],
    ['anderer Pfad', { pfad: `/?v=${VORGANG}&e=${E}` }],
    ['Pfad mit Zusatz', { pfad: `${RUECK_PFAD}/x?v=${VORGANG}&e=${E}` }],
    ['Pfad groß', { pfad: `${RUECK_PFAD.toUpperCase()}?v=${VORGANG}&e=${E}` }],
    ['absolute Form', { pfad: `http://127.0.0.1:${p}${pfad(VORGANG, E)}` }],
    ['fremder Vorgang', { pfad: pfad('Zz9_-'.repeat(4) + 'Zz9_', E) }],
    ['ohne v', { pfad: `${RUECK_PFAD}?e=${E}` }],
    ['ohne e', { pfad: `${RUECK_PFAD}?v=${VORGANG}` }],
    ['e 42 Zeichen', { pfad: pfad(VORGANG, E.slice(1)) }],
    ['e 44 Zeichen', { pfad: pfad(VORGANG, `${E}A`) }],
    ['e mit +', { pfad: pfad(VORGANG, `${E.slice(1)}+`) }],
    ['e mit =', { pfad: pfad(VORGANG, `${E.slice(1)}=`) }],
    ['v doppelt', { pfad: `${pfad(VORGANG, E)}&v=${VORGANG}` }],
    ['e doppelt', { pfad: `${pfad(VORGANG, E)}&e=${E}` }],
    ['weiterer Parameter', { pfad: `${pfad(VORGANG, E)}&x=1` }],
  ];
  const abw: string[] = [];
  for (const [name, o] of faelle) {
    const a = await hole(p, o);
    const leer = 'status' in a && a.status === 404 && a.text === '' && a.kopf['content-length'] === '0';
    if (!leer) abw.push(`${name}: ${'status' in a ? `${a.status} ${a.text.slice(0, 40)}` : a.fehler}`);
  }
  ck(`Z2 1: fremder Host-Kopf, andere Methode, anderer Pfad, fremder Vorgang, falsches e → 404 ohne Inhalt, nichts angenommen, bleibt offen (${faelle.length} Fälle)${abw.length ? ` — ${abw.slice(0, 5).join('; ')}` : ''}`,
    abw.length === 0 && werte.length === 0 && rk.offen());
  // Genau eine gültige Anfrage: Seite K57 ohne Skript mit den Kopfzeilen; danach ist der Rückkanal zu.
  const gut = await hole(p, { pfad: pfad(VORGANG, E) });
  await warte(50);
  const zweiter = await hole(p, { pfad: pfad(VORGANG, E) });
  const k = 'status' in gut ? gut.kopf : {};
  ck('Z2 1: die gültige Anfrage → 200, kleine Seite ohne Skript mit K57; Kopfzeilen no-store, no-referrer, CSP default-src none',
    istStatus(gut, 200) && 'text' in gut && gut.text.includes(`<p>${TEXT_ZURUECK}</p>`) && !/<script/i.test(gut.text)
      && k['content-type'] === 'text/html; charset=utf-8' && k['cache-control'] === 'no-store' && k['referrer-policy'] === 'no-referrer'
      && k['content-security-policy'] === "default-src 'none'" && k['set-cookie'] === undefined);
  ck('Z2 1: der Wert geht genau einmal an den Ablauf; danach ist der Rückkanal zu (zweiter Aufruf: keine Verbindung)',
    JSON.stringify(werte) === JSON.stringify([E]) && !rk.offen() && 'fehler' in zweiter && zweiter.fehler === 'ECONNREFUSED');
  const alles = log.join('\n');
  ck('Z2 1, G4: ins Log nur, ob ein Aufruf angenommen oder abgewiesen wurde; nie e oder der Vorgang',
    log.length > 0 && log.every((z) => /^Anmeldung: Rückkanal-Aufruf (angenommen|abgewiesen)/.test(z)) && log.some((z) => z.includes('angenommen'))
      && !alles.includes(E) && !alles.includes(VORGANG) && !alles.includes(E.slice(0, 20)));
  await rk.schliesse();
}

// --- Z2 1: Schließen beim Abbrechen und nach der Frist ------------------------------------------------------------------------------
{
  const { rk, werte } = await lauscher();
  rk.setzeVorgang(VORGANG);
  await rk.schliesse();
  await rk.schliesse();
  const danach = await hole(rk.port, { pfad: pfad(VORGANG, E) });
  ck('Z2 1: schliesse() (Abbrechen, Beenden) macht den Rückkanal zu, auch zweimal; danach keine Verbindung',
    !rk.offen() && 'fehler' in danach && danach.fehler === 'ECONNREFUSED' && werte.length === 0);
  const kurz = await lauscher({ fristMs: 80 });
  kurz.rk.setzeVorgang(VORGANG);
  await warte(250);
  const spaet = await hole(kurz.rk.port, { pfad: pfad(VORGANG, E) });
  ck('Z2 1: nach der Frist (Vorgang 5 min, hier 80 ms) schließt er sich selbst; danach keine Verbindung',
    !kurz.rk.offen() && 'fehler' in spaet && spaet.fehler === 'ECONNREFUSED' && kurz.werte.length === 0);
  await kurz.rk.schliesse();
}

// --- Z2 1, G9: Quelltext ------------------------------------------------------------------------------------------------------------
{
  const q = readFileSync(new URL('../src/main/konto/rueckkanal.ts', import.meta.url), 'utf8');
  ck('Z2 G9: rueckkanal.ts ohne electron-Import und ohne Konsole; der Pfad ist derselbe wie im Worker (konto-seiten.js)',
    !/from 'electron'|require\('electron'\)/.test(q) && !/console\./.test(q) && RUECK_PFAD === RUECK_PFAD_WORKER);
}

// --- Z2 Kette: echter Launcher-Ablauf gegen den echten Worker ----------------------------------------------------------------------
const uhr = makeUhr(Date.UTC(2026, 10, 5, 9, 0, 0));
function workerUmgebung(): Record<string, unknown> {
  const env: Record<string, unknown> = {
    KONTO_SCHLUESSEL: testSchluessel(), ERSTER_ADMIN: 'chefin@jakobsmedien.com', KONTO_UHR: uhr, RATELIMIT: makeKV(), ...makeRLBindungen(),
  };
  env.KONTO = makeKontoNs(env);
  return env;
}
const env = workerUmgebung();
const ns = env.KONTO as { speicher(): { ctx: { daten: Map<string, unknown> } }; anfragen: unknown[] };
const anWorker = async (url: string, init?: RequestInit): Promise<Response> => {
  const r = new Request(url, init);
  return (await handleKonto(r, env, new URL(r.url), makeWaitCtx())) ?? new Response('{}', { status: 404 });
};
const client = erzeugeKontoClient({ basis: 'https://proxy.test', fetch: ((u: string | URL | Request, init?: RequestInit) => anWorker(String(u), init)) as typeof fetch });
const ablage = (): { lies(): string | undefined; schreib(b: string): void } => {
  let w: string | undefined;
  return { lies: () => w, schreib: (b) => { w = b; } };
};
const klar = { verfuegbar: () => true, verschluesseln: (k: string) => Buffer.from(k).toString('base64'), entschluesseln: (b: string) => Buffer.from(b, 'base64').toString() };
async function neuesGeraet(): Promise<GeraetHandle> {
  const g = await ladeOderErzeugeGeraet(klar, ablage());
  if (g.art === 'kein-schluesselspeicher') throw new Error('kein Gerät');
  return g.geraet;
}

/** Ein Launcher: echter Ablauf mit echtem Rückkanal; der Wecker feuert von Hand (die Uhr rückt dabei 2 s vor). */
async function launcher(name: string) {
  const geraet = await neuesGeraet();
  const u = {
    schritte: [] as AnmeldeSchritt[], browser: [] as string[], angemeldet: [] as GespeicherteSitzung[],
    wecker: [] as Array<{ fn: () => void; aktiv: boolean }>, ports: [] as number[], rueck: [] as Rueckkanal[], geraet,
  };
  const ablauf: AnmeldeAblauf = erzeugeAnmeldeAblauf({
    client, geraet: async () => geraet, jetzt: () => uhr(),
    wecker: (_ms, fn) => { const w = { fn, aktiv: true }; u.wecker.push(w); return () => { w.aktiv = false; }; },
    oeffneBrowser: async (url) => { u.browser.push(url); return true; },
    oeffneRueckkanal: async (o) => { const rk = await oeffneRueckkanal({ ...o, log: () => undefined }); u.ports.push(rk.port); u.rueck.push(rk); return rk; },
    rechnerName: name, plattform: 'win', arch: 'x64', version: '0.18.0',
    angemeldet: (s) => { u.angemeldet.push(s); }, melde: (s) => { u.schritte.push(s); },
  });
  const feuere = async (): Promise<boolean> => {
    const w = u.wecker.find((x) => x.aktiv);
    if (!w) return false;
    w.aktiv = false;
    uhr.vor(2000);
    w.fn();
    for (let i = 0; i < 40 && !u.wecker.some((x) => x.aktiv) && LAEUFT(ablauf); i++) await warte(5);
    return true;
  };
  return Object.assign(u, { ablauf, feuere });
}
const LAEUFT = (a: AnmeldeAblauf): boolean => ['startet', 'wartet'].includes(a.schritt().art);
const vorgangAus = (adresse: string): string => new URL(adresse).searchParams.get('v') ?? '';

/** Der Browser: Google-Anmeldung als DO-Aktion (die Seite selbst prüft konto-routen.test.mjs), dann „Ja“ als Formular → 303. */
async function bestaetigeImBrowser(adresse: string, email: string): Promise<{ status: number; ort: string }> {
  const sp = ns.speicher() as unknown as Parameters<typeof rufeDo>[0];
  const vorgang = vorgangAus(adresse);
  const k = await rufeDo(sp, 'konto-aus-google', { email, name: 'Maria Schmidt' });
  const b = await rufeDo(sp, 'vorgang-konto-binden', { vorgang, kid: k.kid });
  const res = await anWorker('https://proxy.test/konto/bestaetigen', {
    method: 'POST', headers: { 'CF-Connecting-IP': '10.20.0.1', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ v: vorgang, t: b.seitenToken, antwort: 'ja' }).toString(),
  });
  await res.text();
  return { status: res.status, ort: res.headers.get('location') ?? '' };
}

{
  const l = await launcher('Regie-PC 7');
  await l.ablauf.starte();
  const w = l.ablauf.schritt();
  const v = vorgangAus(l.browser[0] ?? 'https://x.invalid/');
  const gespeichert = ns.speicher().ctx.daten.get(`vorgang:${v}`) as { rueckPort?: number } | undefined;
  ck('Z2 Kette: Anlegen mit dem Port des Rückkanals (der Worker speichert genau ihn), dann wartet der Launcher',
    w.art === 'wartet' && l.ports.length === 1 && gespeichert?.rueckPort === l.ports[0] && l.rueck[0].offen());
  await l.feuere();
  const sprung = await bestaetigeImBrowser(l.browser[0], 'maria.schmidt@jakobsmedien.com');
  const ziel = new URL(sprung.ort || 'http://ohne-sprung.invalid/');
  ck('Z2 Kette: Ja → 303; das Ziel enthält genau 127.0.0.1:<Port des Rückkanals>, den Vorgang und e',
    sprung.status === 303 && ziel.protocol === 'http:' && ziel.host === `127.0.0.1:${l.ports[0]}` && ziel.pathname === RUECK_PFAD
      && ziel.searchParams.get('v') === v && /^[A-Za-z0-9_-]{43}$/.test(ziel.searchParams.get('e') ?? ''));
  // Vor dem Sprung fragt der Launcher ohne e: der Worker sagt wartet, es gibt keine Sitzung.
  await l.feuere();
  const ohneE = l.ablauf.schritt().art === 'wartet' && l.angemeldet.length === 0;
  // Der Browser folgt dem 303 auf demselben Rechner: der Rückkanal nimmt e an und schließt sich.
  const seite = await hole(Number(ziel.port), { pfad: ziel.pathname + ziel.search });
  await l.feuere();
  const fertig = l.ablauf.schritt();
  ck('Z2 Kette: abholen ohne e → wartet; nach dem Sprung (K57 im Browser) holt der Launcher mit e die Sitzung ab (fertig, angemeldet genau einmal)',
    ohneE && istStatus(seite, 200) && 'text' in seite && seite.text.includes(TEXT_ZURUECK) && !l.rueck[0].offen()
      && fertig.art === 'fertig' && l.angemeldet.length === 1 && l.angemeldet[0].stand.gid === l.geraet.gid
      && l.angemeldet[0].stand.email === 'maria.schmidt@jakobsmedien.com');
}

// --- Z2 Phishing: der Angreifer startet den Vorgang und schickt dem Opfer den Link -------------------------------------------------
{
  const angreifer = await launcher('Regie-PC 1');
  const opfer = await launcher('Büro Opfer');
  await angreifer.ablauf.starte();
  await opfer.ablauf.starte();
  // Das Opfer öffnet den Link des Angreifers in seinem Browser, meldet sich an und klickt Ja.
  const sprung = await bestaetigeImBrowser(angreifer.browser[0], 'chefin@jakobsmedien.com');
  const ziel = new URL(sprung.ort || 'http://ohne-sprung.invalid/');
  // Der Browser des Opfers springt an 127.0.0.1:<Port> auf dem Rechner des Opfers. Dort lauscht im ungünstigsten Fall der eigene
  // Launcher des Opfers auf genau diesem Port: er nimmt den fremden Vorgang nicht an.
  const beimOpfer = await hole(opfer.ports[0], { pfad: ziel.pathname + ziel.search });
  // Der Rechner des Angreifers bekommt e nie; er fragt bis zum Ablauf seiner Frist (5 min) nach.
  let n = 0;
  while (LAEUFT(angreifer.ablauf) && n < 200 && (await angreifer.feuere())) n++;
  const ende = angreifer.ablauf.schritt();
  ck('Z2 Phishing: der Rückkanal des Opfers nimmt den fremden Vorgang nicht an (404, er bleibt offen, das Opfer wartet weiter)',
    sprung.status === 303 && istStatus(beimOpfer, 404) && opfer.rueck[0].offen() && opfer.ablauf.schritt().art === 'wartet' && opfer.angemeldet.length === 0);
  ck(`Z2 Phishing: der Rechner des Angreifers bekommt nie eine Sitzung; er wartet bis zur Frist und endet abgelaufen (${n} Abfragen), sein Rückkanal ist zu`,
    angreifer.angemeldet.length === 0 && ende.art === 'abgelaufen' && n >= 140 && !angreifer.rueck[0].offen());
  await opfer.ablauf.abbrechen();
  ck('Z2 1: Abbrechen schließt den Rückkanal', !opfer.rueck[0].offen() && opfer.ablauf.schritt().art === 'abgebrochen');
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
