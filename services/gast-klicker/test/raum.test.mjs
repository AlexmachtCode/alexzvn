// Selbsttest der Raumlogik des Gast-Klickers (#317) — ohne Cloudflare: KlickRaum läuft mit einer Attrappe
// des Durable-Object-Kontexts (Speicher als Map, Hibernation-WebSockets als Objekte, Uhr injizierbar).
//   node services/gast-klicker/test/raum.test.mjs
// Node meldet MODULE_TYPELESS_PACKAGE_JSON für raum.js (ESM ohne package.json, wie release-proxy) – harmlos.
import {
  DROSSEL_MS,
  KlickRaum,
  MAX_BILD_BYTES,
  MAX_GAESTE,
  MAX_GAST_BYTES,
  RAUM_RE,
  VERFALL_MS,
  MAX_WARTENDE_PRESENTER,
  WARTE_PRESENTER_MS,
  leseGastNachricht,
  lesePresenterNachricht,
  presenterDarVerbinden,
  raumAusGeheimnis,
  sha256Hex,
} from '../raum.js';

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

// ---------------------------------------------------------------- Attrappen

function neuerCtx() {
  const daten = new Map();
  const sockets = [];
  const ctx = {
    uhr: 1_000_000,
    alarmBei: null,
    jetzt: () => ctx.uhr,
    daten,
    storage: {
      async get(k) {
        return daten.get(k);
      },
      async put(k, v) {
        daten.set(k, v);
      },
      async delete(k) {
        return daten.delete(k);
      },
      async deleteAll() {
        daten.clear();
      },
      async setAlarm(ms) {
        ctx.alarmBei = ms;
      },
    },
    async blockConcurrencyWhile(fn) {
      ctx.gesperrt = (ctx.gesperrt ?? 0) + 1;
      return fn();
    },
    acceptWebSocket(ws, tags = []) {
      ws.offen = true;
      sockets.push({ ws, tags });
    },
    getWebSockets(tag) {
      return sockets.filter((s) => s.ws.offen && (!tag || s.tags.includes(tag))).map((s) => s.ws);
    },
    getTags(ws) {
      return sockets.find((s) => s.ws === ws)?.tags ?? [];
    },
  };
  return ctx;
}

function neuesWs() {
  return {
    offen: false,
    gesendet: [],
    code: null,
    anhang: null,
    send(d) {
      if (!this.offen || this.zu) throw new Error("geschlossen");
      this.gesendet.push(d);
    },
    // Wie in Workers: eine geschlossene Verbindung bleibt in getWebSockets, bis das Schließen abgeschlossen ist;
    // senden geht nicht mehr. Der Raum muss sie selbst (über `weg`) ausblenden.
    close(code) {
      if (this.code === null) this.code = code ?? 1000;
      this.zu = true;
    },
    serializeAttachment(a) {
      this.anhang = structuredClone(a);
    },
    deserializeAttachment() {
      return this.anhang === null ? null : structuredClone(this.anhang); // wie Workers: jedes Lesen eine Kopie
    },
  };
}

const json = (ws) => ws.gesendet.filter((d) => typeof d === 'string').map((d) => JSON.parse(d));
const alle = (ws, t) => json(ws).filter((m) => m.t === t);
const letzte = (ws, t) => alle(ws, t).at(-1);
const binaer = (ws) => ws.gesendet.filter((d) => typeof d !== 'string');

const GEHEIM = 'a'.repeat(64);
const ANDERS = 'b'.repeat(64);
const STAND = (o = {}) => JSON.stringify({ t: 'stand', aktiv: true, index: 0, total: 3, screen: 'live', pausiert: false, ...o });
const CMD = (dir = 'next') => JSON.stringify({ t: 'cmd', dir });

const RAUM_A = '530qlojw1124'; // raumAusGeheimnis('a'×64), unabhängig per node:crypto gerechnet
const RAUM_B = 'vhy6gurjrplw'; // raumAusGeheimnis('b'×64)

async function presenter(raum, geheimnis = GEHEIM, raumId = RAUM_A) {
  const ws = neuesWs();
  await raum.nimmPresenterAn(ws, raumId);
  await raum.webSocketMessage(ws, JSON.stringify({ t: 'hallo', geheimnis }));
  return ws;
}
async function gast(raum) {
  const ws = neuesWs();
  await raum.nimmGastAn(ws);
  return ws;
}
function neuerRaum() {
  const ctx = neuerCtx();
  return { ctx, raum: new KlickRaum(ctx, {}) };
}

// ---------------------------------------------------------------- Parser

check('Konstanten', DROSSEL_MS === 150 && MAX_GAESTE === 30 && MAX_GAST_BYTES === 256 && MAX_BILD_BYTES === 262144 && VERFALL_MS === 7 * 24 * 3600 * 1000);
check('RAUM_RE', RAUM_RE.test('abcdefghij12') && !RAUM_RE.test('ABCDEFGHIJ12') && !RAUM_RE.test('abc') && !RAUM_RE.test('abcdefghij123'));
check('Gast cmd next', JSON.stringify(leseGastNachricht(CMD('next'))) === '{"dir":"next"}');
check('Gast cmd prev', JSON.stringify(leseGastNachricht(CMD('prev'))) === '{"dir":"prev"}');
check('Gast cmd goto → null', leseGastNachricht(CMD('goto')) === null);
check('Gast kaputt → null', leseGastNachricht('kaputt') === null);
check('Gast 257 Byte → null', leseGastNachricht(JSON.stringify({ t: 'cmd', dir: 'next', x: 'y'.repeat(257) })) === null);
check('Gast binär → null', leseGastNachricht(new ArrayBuffer(4)) === null);
check('Gast falscher Typ → null', leseGastNachricht(JSON.stringify({ t: 'stand', dir: 'next' })) === null);

const hallo = lesePresenterNachricht(JSON.stringify({ t: 'hallo', geheimnis: GEHEIM }));
check('Presenter hallo', hallo?.t === 'hallo' && hallo.geheimnis === GEHEIM);
check('Presenter hallo kurzes Geheimnis → null', lesePresenterNachricht(JSON.stringify({ t: 'hallo', geheimnis: 'abc' })) === null);
check('Presenter hallo Großbuchstaben → null', lesePresenterNachricht(JSON.stringify({ t: 'hallo', geheimnis: 'A'.repeat(64) })) === null);
const st = lesePresenterNachricht(STAND({ index: 2, screen: 'black', pausiert: true }));
check('Presenter stand', st?.t === 'stand' && st.index === 2 && st.total === 3 && st.screen === 'black' && st.pausiert === true && st.aktiv === true);
check('Presenter stand index -1 → null', lesePresenterNachricht(STAND({ index: -1 })) === null);
check('Presenter stand index 1.5 → null', lesePresenterNachricht(STAND({ index: 1.5 })) === null);
check('Presenter stand screen grau → null', lesePresenterNachricht(STAND({ screen: 'grau' })) === null);
check('Presenter stand ohne pausiert → null', lesePresenterNachricht(JSON.stringify({ t: 'stand', aktiv: true, index: 0, total: 1, screen: 'live' })) === null);
check('Presenter schliessen', lesePresenterNachricht(JSON.stringify({ t: 'schliessen' }))?.t === 'schliessen');
const b = lesePresenterNachricht(new ArrayBuffer(MAX_BILD_BYTES));
check('Presenter Bild 262144 Byte', b?.t === 'bild' && b.daten.byteLength === MAX_BILD_BYTES);
check('Presenter Bild 262145 Byte → null', lesePresenterNachricht(new ArrayBuffer(MAX_BILD_BYTES + 1)) === null);
check('Presenter Bild leer → null', lesePresenterNachricht(new ArrayBuffer(0)) === null);
check('Presenter Bild als Uint8Array', lesePresenterNachricht(new Uint8Array([0xff, 0xd8, 1]))?.t === 'bild');
check('Presenter unbekannt → null', lesePresenterNachricht(JSON.stringify({ t: 'goto', index: 3 })) === null);
check('raumAusGeheimnis Vektor a', (await raumAusGeheimnis(GEHEIM)) === RAUM_A);
check('raumAusGeheimnis Vektor b', (await raumAusGeheimnis(ANDERS)) === RAUM_B);
check('raumAusGeheimnis passt zu RAUM_RE', RAUM_RE.test(RAUM_A) && RAUM_RE.test(RAUM_B));
check('presenterDarVerbinden: passendes Geheimnis', (await presenterDarVerbinden(RAUM_A, GEHEIM)) === true);
check('presenterDarVerbinden: fremdes Geheimnis', (await presenterDarVerbinden(RAUM_A, ANDERS)) === false);
check('presenterDarVerbinden: ohne Geheimnis', (await presenterDarVerbinden(RAUM_A, null)) === false && (await presenterDarVerbinden(RAUM_A, undefined)) === false);
check('presenterDarVerbinden: kaputtes Geheimnis', (await presenterDarVerbinden(RAUM_A, 'A'.repeat(64))) === false);
check('presenterDarVerbinden: kaputter Raum', (await presenterDarVerbinden('x', GEHEIM)) === false && (await presenterDarVerbinden(null, GEHEIM)) === false);
check('Konstanten wartende Presenter', MAX_WARTENDE_PRESENTER === 20 && WARTE_PRESENTER_MS === 10_000);
check('sha256Hex', (await sha256Hex('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

// ---------------------------------------------------------------- Raum

{
  const { raum } = neuerRaum();
  const g = await gast(raum);
  check('Gast ohne Presenter-Raum bekommt nichtAktiv', letzte(g, 'nichtAktiv') !== undefined && g.code === 4404);
}

{
  const { ctx, raum } = neuerRaum();
  const p = await presenter(raum);
  check('erster Presenter beansprucht Raum', ctx.daten.get('hash') === (await sha256Hex(GEHEIM)) && letzte(p, 'ok') !== undefined && p.code === null);
  check('Alarm auf Verfall gesetzt', ctx.alarmBei === ctx.uhr + VERFALL_MS && ctx.daten.get('letzterPresenterMs') === ctx.uhr);
  check('Geheimnis selbst nicht gespeichert', ![...ctx.daten.values()].includes(GEHEIM));

  const falsch = await presenter(raum, ANDERS, RAUM_A);
  check('falsches Geheimnis abgelehnt', letzte(falsch, 'abgelehnt') !== undefined && falsch.code === 4403 && letzte(falsch, 'ok') === undefined);
  check('alter Presenter bleibt nach Fehlversuch', p.code === null);

  const vorHallo = neuesWs();
  await raum.nimmPresenterAn(vorHallo, RAUM_A);
  await raum.webSocketMessage(vorHallo, STAND({ index: 2 }));
  const g0 = await gast(raum);
  check('Presenter-Nachrichten vor hallo verworfen', letzte(g0, 'stand')?.index === 0);

  const neu = await presenter(raum);
  check('Presenter ersetzt alten Presenter', p.code === 4409 && neu.code === null && letzte(neu, 'ok') !== undefined);
  await raum.webSocketClose(p, 4409, 'ersetzt', true);
  await raum.webSocketMessage(g0, CMD('next'));
  check('cmd geht nur an den neuen Presenter', letzte(neu, 'cmd')?.dir === 'next' && letzte(p, 'cmd') === undefined);
  check('Gast sieht nach Ersatz weiter presenter:true', letzte(g0, 'stand')?.presenter !== false);
}

{
  const { ctx, raum } = neuerRaum();
  const p = await presenter(raum);
  await raum.webSocketMessage(p, STAND());
  const g = await gast(raum);
  check('neuer Gast bekommt Stand', letzte(g, 'stand')?.total === 3 && letzte(g, 'stand')?.presenter === true);
  check('neuer Gast ohne Bild → bildBitte an Presenter', alle(p, 'bildBitte').length === 1);
  check('gaeste 1 an Presenter', letzte(p, 'gaeste')?.n === 1);

  await raum.webSocketMessage(g, CMD('next'));
  check('Gast-cmd wird weitergereicht', alle(p, 'cmd').length === 1 && letzte(p, 'cmd').dir === 'next');
  ctx.uhr += DROSSEL_MS - 1;
  await raum.webSocketMessage(g, CMD('next'));
  check('zweites cmd innerhalb 150 ms verworfen', alle(p, 'cmd').length === 1);
  ctx.uhr += 1;
  await raum.webSocketMessage(g, CMD('prev'));
  check('cmd nach 150 ms weitergereicht', alle(p, 'cmd').length === 2 && letzte(p, 'cmd').dir === 'prev');

  await raum.webSocketMessage(g, 'Müll');
  await raum.webSocketMessage(g, new ArrayBuffer(10));
  check('Müll vom Gast verworfen', alle(p, 'cmd').length === 2);

  await raum.webSocketMessage(p, STAND({ index: 1, pausiert: true }));
  check('stand geht an Gast mit presenter:true', letzte(g, 'stand')?.index === 1 && letzte(g, 'stand')?.pausiert === true && letzte(g, 'stand')?.presenter === true);
  ctx.uhr += 1000;
  await raum.webSocketMessage(g, CMD('next'));
  check('pausiert → cmd verworfen', alle(p, 'cmd').length === 2);
  await raum.webSocketMessage(p, STAND({ index: 1, pausiert: false }));

  const bild = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
  await raum.webSocketMessage(p, bild);
  check('Bild geht binär an Gast', binaer(g).length === 1 && binaer(g)[0].byteLength === 4);
  const g2 = await gast(raum);
  check('neuer Gast bekommt gemerktes Bild', binaer(g2).length === 1 && alle(p, 'bildBitte').length === 1);
  check('gaeste 2 an Presenter', letzte(p, 'gaeste')?.n === 2);
  await raum.webSocketMessage(g, 'x'.repeat(10));
  check('Gast schickt kein Bild an andere', binaer(g2).length === 1);

  await raum.webSocketClose(g2, 1001, 'weg', true);
  check('gaeste 1 nach Austritt', letzte(p, 'gaeste')?.n === 1);

  await raum.webSocketClose(p, 1006, 'weg', false);
  check('Presenter weg → Gast presenter:false', letzte(g, 'stand')?.presenter === false);
  ctx.uhr += 1000;
  await raum.webSocketMessage(g, CMD('next'));
  check('ohne Presenter → cmd verworfen (kein Fehler)', alle(p, 'cmd').length === 2);
}

{
  const { raum } = neuerRaum();
  const p = await presenter(raum);
  const gaeste = [];
  for (let i = 0; i < MAX_GAESTE; i++) gaeste.push(await gast(raum));
  check('30 Gäste angenommen', gaeste.every((g) => g.code === null) && letzte(p, 'gaeste')?.n === 30);
  const zuViel = await gast(raum);
  check('Gast 31 abgewiesen', zuViel.code === 4429 && letzte(p, 'gaeste')?.n === 30);
}

{
  const { ctx, raum } = neuerRaum();
  const p = await presenter(raum);
  await raum.webSocketMessage(p, STAND());
  const g = await gast(raum);
  await raum.webSocketMessage(p, JSON.stringify({ t: 'schliessen' }));
  check('schliessen → Gast nichtAktiv', letzte(g, 'nichtAktiv') !== undefined && g.code === 4404);
  const spaet = await gast(raum);
  check('schliessen → neuer Gast nichtAktiv', letzte(spaet, 'nichtAktiv') !== undefined && spaet.code === 4404);
  check('schliessen gespeichert', ctx.daten.get('geschlossen') === true);
  const wieder = await presenter(raum);
  check('hallo mit gleichem Geheimnis öffnet geschlossenen Raum wieder', letzte(wieder, 'ok') !== undefined && !ctx.daten.get('geschlossen'));
  const g3 = await gast(raum);
  check('nach Wiederöffnen Gast angenommen', g3.code === null);
}

{
  const { ctx, raum } = neuerRaum();
  const fremd = await presenter(raum, ANDERS, RAUM_A);
  check('Geheimnis passt nicht zur Raum-Kennung → abgelehnt, Raum bleibt frei', letzte(fremd, 'abgelehnt') !== undefined && fremd.code === 4403 && !ctx.daten.has('hash'));
  const echt = await presenter(raum, GEHEIM, RAUM_A);
  check('danach beansprucht der richtige Presenter', letzte(echt, 'ok') !== undefined);
  check('Beanspruchen läuft gesperrt (blockConcurrencyWhile)', (ctx.gesperrt ?? 0) >= 1);
  const ohneRaum = neuesWs();
  await raum.nimmPresenterAn(ohneRaum, undefined);
  await raum.webSocketMessage(ohneRaum, JSON.stringify({ t: 'hallo', geheimnis: GEHEIM }));
  check('Presenter ohne Raum-Kennung abgelehnt', letzte(ohneRaum, 'ok') === undefined && ohneRaum.code === 4403);
}

{
  const { raum } = neuerRaum();
  const ws = neuesWs();
  await raum.nimmPresenterAn(ws, RAUM_A);
  const laeuft = raum.webSocketMessage(ws, JSON.stringify({ t: 'hallo', geheimnis: GEHEIM }));
  await raum.webSocketClose(ws, 1006, 'weg', false);
  await laeuft;
  check('Verbindung weg während hallo → nicht angemeldet', raum.presenter() === undefined && letzte(ws, 'ok') === undefined);
}

{
  const { ctx, raum } = neuerRaum();
  const wartend = [];
  for (let i = 0; i < MAX_WARTENDE_PRESENTER; i++) {
    const ws = neuesWs();
    await raum.nimmPresenterAn(ws, RAUM_A);
    wartend.push(ws);
  }
  check('20 unangemeldete Presenter-Verbindungen angenommen', wartend.every((w) => w.code === null));
  ctx.uhr += 1;
  const echt = neuesWs();
  await raum.nimmPresenterAn(echt, RAUM_A);
  check('Grenze erreicht: neue Verbindung bleibt, älteste wartende fliegt', echt.code === null && wartend[0].code === 4429 && wartend.slice(1).every((w) => w.code === null));
  await raum.webSocketMessage(echt, JSON.stringify({ t: 'hallo', geheimnis: GEHEIM }));
  check('volle Warteliste sperrt den echten Presenter nicht aus', letzte(echt, 'ok') !== undefined);
  ctx.uhr += WARTE_PRESENTER_MS + 1;
  const spaet = neuesWs();
  await raum.nimmPresenterAn(spaet, RAUM_A);
  check('nach 10 s ohne hallo: alte wartende geschlossen', wartend.slice(1).every((w) => w.code === 4408) && spaet.code === null);
  check('angemeldeter Presenter bleibt beim Aufräumen', echt.code === null);
  await raum.webSocketMessage(spaet, JSON.stringify({ t: 'hallo', geheimnis: GEHEIM }));
  check('neue Verbindung meldet sich danach an', letzte(spaet, 'ok') !== undefined);
}

{
  const { ctx, raum } = neuerRaum();
  const p = await presenter(raum);
  await raum.webSocketClose(p, 1000, 'aus', true);
  await raum.alarm();
  check('alarm löscht Raum', ctx.daten.size === 0);
  const g = await gast(raum);
  check('nach alarm: Gast nichtAktiv', letzte(g, 'nichtAktiv') !== undefined && g.code === 4404);
}

{
  const { ctx, raum } = neuerRaum();
  await presenter(raum);
  ctx.alarmBei = null;
  await raum.alarm();
  check('alarm bei verbundenem Presenter verschiebt nur', ctx.daten.has('hash') && ctx.alarmBei === ctx.uhr + VERFALL_MS);
}

console.log(`raum: ${passed} ok, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
