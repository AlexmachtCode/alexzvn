// Anmeldung im Launcher (Teil 1) · Z2: Rückkanal beim Bestätigen (src/main/konto/rueckkanal.ts; RFC 8252 7.3/8.3 loopback).
// Fixrunde 1 (OE6): nach „Ja“ schickt ein Knopf im Browser v und e per POST (application/x-www-form-urlencoded) an den Rückkanal.
// Echte Sockets nur auf 127.0.0.1, nach jedem Fall geschlossen (G3). Dazu die ganze Kette mit dem echten Worker (handleKonto aus
// services/release-proxy/konto-relay.js, das worker.fetch für /konto/* ruft, mit den Attrappen aus test/konto-attrappen.mjs, ohne
// Netz; den Default-Export von worker.js liefert tsx nicht als Objekt mit fetch): Launcher-Ablauf, Client, Gerät und Rückkanal
// echt; der Browser ist der Test (Anmelden als DO-Aktion, „Ja“ als Formular-POST an den Worker, dann der Knopf: POST an 127.0.0.1).
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { readFileSync } from 'node:fs';
import { oeffneRueckkanal, RUECK_BODY_MAX, RUECK_PFAD, TEXT_ZURUECK, type Rueckkanal } from '../src/main/konto/rueckkanal';
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
const FORM = 'application/x-www-form-urlencoded';

/** Eine Anfrage an 127.0.0.1:<port> ohne Agent (eigene Verbindung), mit frei wählbarem Host-Kopf, Pfad, Inhaltstyp und Körper. */
function hole(port: number, o: { pfad?: string; methode?: string; host?: string; typ?: string | null; body?: string }): Promise<Antwort> {
  return new Promise((fertig) => {
    const kopf: Record<string, string> = { host: o.host ?? `127.0.0.1:${port}` };
    const typ = o.typ === undefined ? FORM : o.typ;
    if (typ !== null) kopf['content-type'] = typ;
    if (o.body !== undefined) kopf['content-length'] = String(Buffer.byteLength(o.body));
    const req = httpRequest({ host: '127.0.0.1', port, path: o.pfad ?? RUECK_PFAD, method: o.methode ?? 'POST', agent: false, headers: kopf }, (res) => {
      const teile: Buffer[] = [];
      res.on('data', (c: Buffer) => teile.push(c));
      res.on('end', () => fertig({ status: res.statusCode ?? 0, kopf: res.headers, text: Buffer.concat(teile).toString('utf8') }));
    });
    req.on('error', (e: NodeJS.ErrnoException) => fertig({ fehler: e.code ?? e.name }));
    req.setTimeout(3000, () => { req.destroy(); fertig({ fehler: 'zeitlimit' }); });
    req.end(o.body);
  });
}
/** Rohe Bytes über TCP an 127.0.0.1:<port>; liefert, was zurückkam, und ob der Server die Verbindung schloss (Ende oder Fehler). */
function roh(port: number, daten: string, warteMs = 1500): Promise<{ text: string; zu: boolean; ms: number }> {
  return new Promise((fertig) => {
    const t0 = Date.now();
    const s = connect(port, '127.0.0.1');
    const teile: Buffer[] = [];
    let erledigt = false;
    const ende = (zu: boolean): void => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(halt);
      s.destroy();
      fertig({ text: Buffer.concat(teile).toString('latin1'), zu, ms: Date.now() - t0 });
    };
    const halt = setTimeout(() => ende(false), warteMs);
    s.on('data', (c: Buffer) => teile.push(c));
    s.on('end', () => ende(true));
    s.on('close', () => ende(true));
    s.on('error', () => ende(true));
    s.on('connect', () => s.write(daten));
  });
}
const istStatus = (a: Antwort, s: number): boolean => 'status' in a && a.status === s;
const VORGANG = 'Ab1_-'.repeat(4) + 'Ab1_'; // 24 Zeichen wie zufall(18)
const E = 'Cd2_-'.repeat(8) + 'Cd2'; // 43 Zeichen wie zufall(32)
const koerper = (v: string, e: string): string => new URLSearchParams({ v, e }).toString();
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Rückkanal mit Mitschnitt von Log und angenommenen Werten. */
async function lauscher(o: { fristMs?: number; wiederholMs?: number; zeitlimitMs?: number } = {}): Promise<{ rk: Rueckkanal; log: string[]; werte: string[] }> {
  const log: string[] = [];
  const werte: string[] = [];
  const rk = await oeffneRueckkanal({ angenommen: (e) => werte.push(e), log: (z) => log.push(z), ...o });
  return { rk, log, werte };
}

// --- Z2 1: nur 127.0.0.1, freier Port, vor dem Vorgang nimmt er nichts an ------------------------------------------------------
{
  const { rk, werte } = await lauscher();
  const vorher = await hole(rk.port, { body: koerper(VORGANG, E) });
  ck('Z2 1: der Rückkanal lauscht nur auf 127.0.0.1 mit einem Port vom Betriebssystem (1024–65535)',
    rk.adresse === '127.0.0.1' && Number.isInteger(rk.port) && rk.port >= 1024 && rk.port <= 65535);
  ck('Z2 1: vor dem Anlegen des Vorgangs (setzeVorgang) nimmt er nichts an (404, nichts angenommen, bleibt offen)',
    istStatus(vorher, 404) && werte.length === 0 && rk.offen());
  await rk.schliesse();
}

// --- Z2 1 (OE6): nur genau ein POST /anmeldung/zurueck mit Formular-Körper v und e; alles andere → 404 ohne Inhalt ----------------
{
  const { rk, log, werte } = await lauscher();
  rk.setzeVorgang(VORGANG);
  const p = rk.port;
  const gut = koerper(VORGANG, E);
  const faelle: Array<[string, { pfad?: string; methode?: string; host?: string; typ?: string | null; body?: string }]> = [
    ['GET mit v und e in der Adresse', { methode: 'GET', pfad: `${RUECK_PFAD}?${gut}`, typ: null }],
    ['GET ohne Körper', { methode: 'GET', typ: null }],
    ['HEAD', { methode: 'HEAD', typ: null }],
    ['PUT', { methode: 'PUT', body: gut }],
    ['fremder Host-Kopf (DNS-Rebinding)', { host: `boese:${p}`, body: gut }],
    ['Host localhost', { host: `localhost:${p}`, body: gut }],
    ['Host ohne Port', { host: '127.0.0.1', body: gut }],
    ['Host mit anderem Port', { host: `127.0.0.1:${p === 65535 ? 1024 : p + 1}`, body: gut }],
    ['anderer Pfad', { pfad: '/', body: gut }],
    ['Pfad mit Zusatz', { pfad: `${RUECK_PFAD}/x`, body: gut }],
    ['Pfad mit Query', { pfad: `${RUECK_PFAD}?x=1`, body: gut }],
    ['Pfad groß', { pfad: RUECK_PFAD.toUpperCase(), body: gut }],
    ['absolute Form', { pfad: `http://127.0.0.1:${p}${RUECK_PFAD}`, body: gut }],
    ['ohne Content-Type', { typ: null, body: gut }],
    ['Content-Type JSON', { typ: 'application/json', body: JSON.stringify({ v: VORGANG, e: E }) }],
    ['Content-Type multipart', { typ: 'multipart/form-data; boundary=x', body: gut }],
    ['Content-Type text/plain', { typ: 'text/plain', body: gut }],
    ['fremder Vorgang', { body: koerper('Zz9_-'.repeat(4) + 'Zz9_', E) }],
    ['ohne v', { body: new URLSearchParams({ e: E }).toString() }],
    ['ohne e', { body: new URLSearchParams({ v: VORGANG }).toString() }],
    ['leerer Körper', { body: '' }],
    ['e 42 Zeichen', { body: koerper(VORGANG, E.slice(1)) }],
    ['e 44 Zeichen', { body: koerper(VORGANG, `${E}A`) }],
    ['e mit +', { body: `v=${VORGANG}&e=${E.slice(1)}%2B` }],
    ['e mit =', { body: `v=${VORGANG}&e=${E.slice(1)}%3D` }],
    ['v doppelt', { body: `${gut}&v=${VORGANG}` }],
    ['e doppelt', { body: `${gut}&e=${E}` }],
    ['weiteres Feld', { body: `${gut}&x=1` }],
  ];
  const abw: string[] = [];
  for (const [name, o] of faelle) {
    const a = await hole(p, o);
    const leer = 'status' in a && a.status === 404 && a.text === '' && a.kopf['content-length'] === '0';
    if (!leer) abw.push(`${name}: ${'status' in a ? `${a.status} ${a.text.slice(0, 40)}` : a.fehler}`);
  }
  ck(`Z2 1 (OE6): GET, andere Methode, fremder Host-Kopf, anderer Pfad, kein Formular-Inhaltstyp, fremder Vorgang, falsches e, Felder fehlen oder doppelt → 404 ohne Inhalt, nichts angenommen, bleibt offen (${faelle.length} Fälle)${abw.length ? ` — ${abw.slice(0, 5).join('; ')}` : ''}`,
    abw.length === 0 && werte.length === 0 && rk.offen());
  // Zu großer Körper (mehr als 1 KiB): 404 und die Verbindung geht zu, laut content-length ohne zu lesen und als Strom.
  const grossLaenge = await roh(p, `POST ${RUECK_PFAD} HTTP/1.1\r\nHost: 127.0.0.1:${p}\r\nContent-Type: ${FORM}\r\nContent-Length: ${RUECK_BODY_MAX + 1}\r\n\r\n`);
  const grossStrom = await roh(p, `POST ${RUECK_PFAD} HTTP/1.1\r\nHost: 127.0.0.1:${p}\r\nContent-Type: ${FORM}\r\nTransfer-Encoding: chunked\r\n\r\n${(RUECK_BODY_MAX + 10).toString(16)}\r\n${'v'.repeat(RUECK_BODY_MAX + 10)}\r\n`);
  const genau = await hole(p, { body: `${gut}&${'x'.repeat(Math.max(0, RUECK_BODY_MAX - gut.length - 1))}` });
  ck(`Z2 1 (OE6): Körper über 1 KiB (${RUECK_BODY_MAX} Bytes) → 404 und die Verbindung geht zu (laut content-length und als Strom); nichts angenommen`,
    RUECK_BODY_MAX === 1024 && /^HTTP\/1\.1 404 /.test(grossLaenge.text) && grossLaenge.zu && /^HTTP\/1\.1 404 /.test(grossStrom.text) && grossStrom.zu
      && istStatus(genau, 404) && werte.length === 0 && rk.offen());
  // Genau die gültige Anfrage: Seite K57 ohne Skript mit den Kopfzeilen; der Launcher erfährt e genau einmal.
  const erst = await hole(p, { body: gut });
  const k = 'status' in erst ? erst.kopf : {};
  ck('Z2 1: der gültige POST → 200, kleine Seite ohne Skript mit K57; Kopfzeilen no-store, no-referrer, CSP default-src none',
    istStatus(erst, 200) && 'text' in erst && erst.text.includes(`<p>${TEXT_ZURUECK}</p>`) && !/<script/i.test(erst.text)
      && k['content-type'] === 'text/html; charset=utf-8' && k['cache-control'] === 'no-store' && k['referrer-policy'] === 'no-referrer'
      && k['content-security-policy'] === "default-src 'none'" && k['set-cookie'] === undefined);
  // Doppelklick auf den Knopf: dieselbe Kombination noch einmal → wieder K57, aber keine zweite Benachrichtigung; anderes → 404.
  const nochmal = await hole(p, { body: gut });
  const anderesE = await hole(p, { body: koerper(VORGANG, 'Ef3_-'.repeat(8) + 'Ef3') });
  ck('Z2 1 (OE6): dieselbe Kombination v/e innerhalb des Fensters → noch einmal K57, der Launcher wird nur einmal benachrichtigt; ein anderes e → 404',
    istStatus(nochmal, 200) && 'text' in nochmal && nochmal.text.includes(TEXT_ZURUECK) && istStatus(anderesE, 404)
      && JSON.stringify(werte) === JSON.stringify([E]) && rk.offen());
  const alles = log.join('\n');
  ck('Z2 1, G4: ins Log nur, ob ein Aufruf angenommen oder abgewiesen wurde; nie e oder der Vorgang',
    log.length > 0 && log.every((z) => /^Anmeldung: Rückkanal-Aufruf (angenommen|abgewiesen)/.test(z)) && log.filter((z) => z.includes('angenommen')).length === 1
      && !alles.includes(E) && !alles.includes(VORGANG) && !alles.includes(E.slice(0, 20)));
  await rk.schliesse();
}

// --- Z2 1 (OE6): das Fenster für den Doppelklick ist 10 s (hier kurz), danach ist der Rückkanal zu ---------------------------------
{
  const { rk, werte } = await lauscher({ wiederholMs: 120 });
  rk.setzeVorgang(VORGANG);
  const erst = await hole(rk.port, { body: koerper(VORGANG, E) });
  const imFenster = await hole(rk.port, { body: koerper(VORGANG, E) });
  await warte(300);
  const danach = await hole(rk.port, { body: koerper(VORGANG, E) });
  ck('Z2 1 (OE6): nach dem Fenster (Vorgabe 10 s, hier 120 ms) schließt der Rückkanal; danach keine Verbindung',
    istStatus(erst, 200) && istStatus(imFenster, 200) && !rk.offen() && 'fehler' in danach && danach.fehler === 'ECONNREFUSED' && werte.length === 1);
  await rk.schliesse();
}

// --- Z2 M4 (la): zwei gleichzeitige gültige Anfragen ergeben genau eine Benachrichtigung ---------------------------------------------
{
  const { rk, werte } = await lauscher();
  rk.setzeVorgang(VORGANG);
  const [a, b] = await Promise.all([hole(rk.port, { body: koerper(VORGANG, E) }), hole(rk.port, { body: koerper(VORGANG, E) })]);
  ck('Z2 M4 (la): zwei gleichzeitige gültige POSTs → beide K57, der Launcher wird genau einmal benachrichtigt',
    istStatus(a, 200) && istStatus(b, 200) && JSON.stringify(werte) === JSON.stringify([E]));
  await rk.schliesse();
}

// --- Z2 M3: eine kaputte Anfrage bekommt 404 ohne Inhalt (kein 400/431-Text von Node), die Verbindung geht zu ----------------------
{
  const { rk, log, werte } = await lauscher();
  rk.setzeVorgang(VORGANG);
  const muell = await roh(rk.port, 'DAS IST KEIN HTTP\r\n\r\n');
  const langerKopf = await roh(rk.port, `POST ${RUECK_PFAD} HTTP/1.1\r\nHost: 127.0.0.1:${rk.port}\r\nX-Lang: ${'a'.repeat(20_000)}\r\n\r\n`);
  const vorher = log.length;
  ck('Z2 M3: kaputte Anfrage und zu langer Kopf → 404 mit content-length 0, Verbindung zu, kein Text von Node (400, 431, Bad Request); im Log als abgewiesen',
    [muell, langerKopf].every((r) => /^HTTP\/1\.1 404 /.test(r.text) && /content-length: 0/i.test(r.text) && !/\b(400|431)\b|Bad Request|Header/i.test(r.text) && r.zu)
      && log.some((z) => z.startsWith('Anmeldung: Rückkanal-Aufruf abgewiesen')) && vorher > 0 && werte.length === 0 && rk.offen());
  await rk.schliesse();
}

// --- Z2 M4 (lb): eine halb offene Verbindung wird nach dem Zeitlimit geschlossen ---------------------------------------------------
{
  const { rk, werte } = await lauscher({ zeitlimitMs: 200 });
  rk.setzeVorgang(VORGANG);
  const halb = await roh(rk.port, `POST ${RUECK_PFAD} HTTP/1.1\r\nHost: 127.0.0.1:${rk.port}\r\n`, 3000);
  ck(`Z2 M4 (lb): eine halb offene Anfrage (Kopf nicht fertig) wird nach dem Zeitlimit (hier 200 ms) geschlossen (${halb.ms} ms), mit 404 statt 408`,
    halb.zu && halb.ms < 2500 && !/\b408\b/.test(halb.text) && (halb.text === '' || /^HTTP\/1\.1 404 /.test(halb.text)) && werte.length === 0);
  await rk.schliesse();
}

// --- Z2 1: Schließen beim Abbrechen und nach der Frist ------------------------------------------------------------------------------
{
  const { rk, werte } = await lauscher();
  rk.setzeVorgang(VORGANG);
  await rk.schliesse();
  await rk.schliesse();
  const danach = await hole(rk.port, { body: koerper(VORGANG, E) });
  ck('Z2 1: schliesse() (Abbrechen, Beenden) macht den Rückkanal sofort zu, auch zweimal; danach keine Verbindung',
    !rk.offen() && 'fehler' in danach && danach.fehler === 'ECONNREFUSED' && werte.length === 0);
  const kurz = await lauscher({ fristMs: 80 });
  kurz.rk.setzeVorgang(VORGANG);
  await warte(250);
  const spaet = await hole(kurz.rk.port, { body: koerper(VORGANG, E) });
  ck('Z2 1: nach der Frist (Vorgang 5 min, hier 80 ms) schließt er sich selbst; danach keine Verbindung',
    !kurz.rk.offen() && 'fehler' in spaet && spaet.fehler === 'ECONNREFUSED' && kurz.werte.length === 0);
  await kurz.rk.schliesse();
  // schliesseNachFenster: ohne angenommenen Wert sofort zu, mit angenommenem Wert erst nach dem Fenster.
  const ohne = await lauscher();
  ohne.rk.setzeVorgang(VORGANG);
  ohne.rk.schliesseNachFenster();
  await warte(30);
  const mit = await lauscher({ wiederholMs: 150 });
  mit.rk.setzeVorgang(VORGANG);
  await hole(mit.rk.port, { body: koerper(VORGANG, E) });
  mit.rk.schliesseNachFenster();
  const mitImFenster = await hole(mit.rk.port, { body: koerper(VORGANG, E) });
  await warte(300);
  ck('Z2 1 (OE6): schliesseNachFenster (Ablauf fertig) schließt ohne angenommenen Wert sofort, sonst erst nach dem Fenster (dort noch K57)',
    !ohne.rk.offen() && istStatus(mitImFenster, 200) && !mit.rk.offen() && mit.werte.length === 1);
  await ohne.rk.schliesse();
  await mit.rk.schliesse();
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
    client, geraet: async () => geraet, jetzt: () => uhr(), monoton: () => uhr(),
    wecker: (_ms, fn) => { const w = { fn, aktiv: true }; u.wecker.push(w); return () => { w.aktiv = false; }; },
    oeffneBrowser: async (url) => { u.browser.push(url); return true; },
    oeffneRueckkanal: async (o) => {
      const rk = await oeffneRueckkanal({ ...o, log: () => undefined, wiederholMs: 100 });
      u.ports.push(rk.port);
      u.rueck.push(rk);
      return rk;
    },
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
const vorgangAus = (adresse: string | undefined): string => {
  try {
    return new URL(adresse ?? '').searchParams.get('v') ?? '';
  } catch {
    return '';
  }
};
/** Das Formular der Seite nach „Ja“ (Knopf B29): Ziel und versteckte Felder. */
function knopfFormular(html: string): { ziel: string; v: string; e: string } | null {
  const f = html.match(/<form method="post" action="([^"]*)"><input type="hidden" name="v" value="([^"]*)"><input type="hidden" name="e" value="([^"]*)"><button type="submit">/);
  return f ? { ziel: f[1], v: f[2], e: f[3] } : null;
}

/** Der Browser: Google-Anmeldung als DO-Aktion (die Seite selbst prüft konto-routen.test.mjs), dann „Ja“ als Formular an den Worker. */
async function bestaetigeImBrowser(adresse: string | undefined, email: string): Promise<{ status: number; ort: string | null; formular: ReturnType<typeof knopfFormular> }> {
  const sp = ns.speicher() as unknown as Parameters<typeof rufeDo>[0];
  const vorgang = vorgangAus(adresse);
  const k = await rufeDo(sp, 'konto-aus-google', { email, name: 'Maria Schmidt' });
  const b = await rufeDo(sp, 'vorgang-konto-binden', { vorgang, kid: k.kid });
  const res = await anWorker('https://proxy.test/konto/bestaetigen', {
    method: 'POST', headers: { 'CF-Connecting-IP': '10.20.0.1', 'content-type': FORM },
    body: new URLSearchParams({ v: vorgang, t: b.seitenToken, antwort: 'ja' }).toString(),
  });
  return { status: res.status, ort: res.headers.get('location'), formular: knopfFormular(await res.text()) };
}
/** Der Knopf im Browser: POST der versteckten Felder an das Ziel des Formulars (nur 127.0.0.1). */
async function druecke(f: { ziel: string; v: string; e: string }, port?: number): Promise<Antwort> {
  const ziel = new URL(f.ziel);
  if (ziel.hostname !== '127.0.0.1') return { fehler: 'nicht 127.0.0.1' };
  return hole(port ?? Number(ziel.port), { pfad: ziel.pathname, body: koerper(f.v, f.e) });
}

{
  const l = await launcher('Regie-PC 7');
  await l.ablauf.starte();
  const w = l.ablauf.schritt();
  const v = vorgangAus(l.browser[0]);
  const gespeichert = ns.speicher().ctx.daten.get(`vorgang:${v}`) as { rueckPort?: number } | undefined;
  ck('Z2 Kette: Anlegen mit dem Port des Rückkanals (der Worker speichert genau ihn), dann wartet der Launcher',
    w.art === 'wartet' && l.ports.length === 1 && gespeichert?.rueckPort === l.ports[0] && l.rueck[0].offen());
  await l.feuere();
  const ja = await bestaetigeImBrowser(l.browser[0], 'maria.schmidt@jakobsmedien.com');
  const f = ja.formular;
  ck('Z2 Kette (OE6): Ja → Seite mit Knopf; das Formular geht an genau http://127.0.0.1:<Port des Rückkanals>/anmeldung/zurueck mit dem Vorgang und e, kein Location',
    ja.status === 200 && ja.ort === null && !!f && f.ziel === `http://127.0.0.1:${l.ports[0]}${RUECK_PFAD}` && f.v === v && /^[A-Za-z0-9_-]{43}$/.test(f.e));
  // Vor dem Knopf fragt der Launcher ohne e: der Worker sagt wartet, es gibt keine Sitzung.
  await l.feuere();
  const ohneE = l.ablauf.schritt().art === 'wartet' && l.angemeldet.length === 0;
  // Der Knopf im Browser desselben Rechners, doppelt geklickt: beide Male K57, der Launcher meldet sich genau einmal an.
  const seite = f ? await druecke(f) : { fehler: 'kein Formular' };
  const zweimal = f ? await druecke(f) : { fehler: 'kein Formular' };
  await l.feuere();
  const fertig = l.ablauf.schritt();
  ck('Z2 Kette: abholen ohne e → wartet; nach dem Knopf (K57 im Browser, auch beim Doppelklick) holt der Launcher mit e die Sitzung ab (fertig, angemeldet genau einmal)',
    ohneE && istStatus(seite, 200) && 'text' in seite && seite.text.includes(TEXT_ZURUECK) && istStatus(zweimal, 200)
      && fertig.art === 'fertig' && l.angemeldet.length === 1 && l.angemeldet[0].stand.gid === l.geraet.gid
      && l.angemeldet[0].stand.email === 'maria.schmidt@jakobsmedien.com');
  await warte(250);
  ck('Z2 Kette: nach dem Fenster für den Doppelklick ist der Rückkanal zu', !l.rueck[0].offen());
}

// --- Z2 I1 Kette: Doppelklick auf „Ja“ — der Browser zeigt die Seite des zweiten Ja; mit deren Knopf meldet sich der Launcher an -----
{
  const l = await launcher('Regie-PC 9');
  await l.ablauf.starte();
  const sp = ns.speicher() as unknown as Parameters<typeof rufeDo>[0];
  const v = vorgangAus(l.browser[0]);
  const k = await rufeDo(sp, 'konto-aus-google', { email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt' });
  const b = await rufeDo(sp, 'vorgang-konto-binden', { vorgang: v, kid: k.kid });
  const jaEinmal = (): Promise<Response> => anWorker('https://proxy.test/konto/bestaetigen', {
    method: 'POST', headers: { 'CF-Connecting-IP': '10.20.0.2', 'content-type': FORM },
    body: new URLSearchParams({ v, t: b.seitenToken, antwort: 'ja' }).toString(),
  });
  const [r1, r2] = await Promise.all([jaEinmal(), jaEinmal()]);
  const [h1, h2] = await Promise.all([r1.text(), r2.text()]);
  const f2 = knopfFormular(h2);
  const seite = f2 ? await druecke(f2) : { fehler: 'kein Formular' };
  await l.feuere();
  ck('Z2 I1 Kette: Doppelklick auf Ja (zwei gleichzeitige POSTs) → zwei Seiten mit je eigenem e; der Knopf der zuletzt gezeigten Seite meldet den Launcher an',
    r1.status === 200 && r2.status === 200 && !!knopfFormular(h1) && !!f2 && knopfFormular(h1)?.e !== f2.e && istStatus(seite, 200)
      && l.ablauf.schritt().art === 'fertig' && l.angemeldet.length === 1);
}

// --- Z2 Phishing: der Angreifer startet den Vorgang und schickt dem Opfer den Link -------------------------------------------------
{
  const angreifer = await launcher('Regie-PC 1');
  const opfer = await launcher('Büro Opfer');
  await angreifer.ablauf.starte();
  await opfer.ablauf.starte();
  // Das Opfer öffnet den Link des Angreifers in seinem Browser, meldet sich an und klickt Ja, dann auf den Knopf.
  const ja = await bestaetigeImBrowser(angreifer.browser[0], 'chefin@jakobsmedien.com');
  // Der Knopf schickt an 127.0.0.1:<Port> auf dem Rechner des Opfers. Dort lauscht im ungünstigsten Fall der eigene Launcher des
  // Opfers auf genau diesem Port: er nimmt den fremden Vorgang nicht an.
  const beimOpfer = ja.formular ? await druecke(ja.formular, opfer.ports[0]) : { fehler: 'kein Formular' };
  // Der Rechner des Angreifers bekommt e nie; er fragt bis zum Ablauf seiner Frist (5 min) nach.
  let n = 0;
  while (LAEUFT(angreifer.ablauf) && n < 200 && (await angreifer.feuere())) n++;
  const ende = angreifer.ablauf.schritt();
  ck('Z2 Phishing: der Rückkanal des Opfers nimmt den fremden Vorgang nicht an (404, er bleibt offen, das Opfer wartet weiter)',
    ja.status === 200 && !!ja.formular && istStatus(beimOpfer, 404) && opfer.rueck[0].offen() && opfer.ablauf.schritt().art === 'wartet' && opfer.angemeldet.length === 0);
  ck(`Z2 Phishing: der Rechner des Angreifers bekommt nie eine Sitzung; er wartet bis zur Frist und endet abgelaufen (${n} Abfragen), sein Rückkanal ist zu`,
    angreifer.angemeldet.length === 0 && ende.art === 'abgelaufen' && n >= 140 && !angreifer.rueck[0].offen());
  await opfer.ablauf.abbrechen();
  ck('Z2 1: Abbrechen schließt den Rückkanal sofort', !opfer.rueck[0].offen() && opfer.ablauf.schritt().art === 'abgebrochen');
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
