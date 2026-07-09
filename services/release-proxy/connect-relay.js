// JM Production Suite — Remote-Zuschaltung / Signalling (Welle 6 „JM Connect"),
// Cloudflare-Worker-Modul + Durable Object.
//
// Ermöglicht Remote-Gäste (Browser, ohne Installation) für hybride Konferenzen: ein Gast joint
// per event-spezifischem Token/QR, landet im Warteraum, wird vom Operator freigegeben und (später)
// als NDI-Quelle in der Suite ausgespielt. Der Raum-Rechner öffnet KEINEN Inbound-Port — Signalling
// läuft über diesen Worker/DO (dieselbe Philosophie wie das Q&A-Poll-Modell, qa-relay.js).
//
// ARCHITEKTUR:
//   • Der Worker serviert die statische Gast-Seite und gate't die Admin-Routen (PROXY_KEY),
//     dann routet er /connect/:room/* an den ConnectRoom-DO (eine Instanz je Raum).
//   • Der DO ist autoritativ: hält Raum-Metadaten (inkl. symmetrischem Verify-Secret), die
//     Room-State-Machine (aus @jm/rtc — dort unit-getestet) und die WebSockets (Hibernation).
//   • Medien laufen NICHT durch den DO: der DO ruft (wenn konfiguriert) die Cloudflare-Realtime-SFU
//     und relayt nur SDP/ICE. Ohne SFU-Secrets läuft der Raum im „Signalling-only"-Modus
//     (Warteraum/Freigabe/Tally funktionieren, Medien werden mit Hinweis übersprungen).
//
// SICHERHEIT (Roadmap Spur S):
//   • Join-Token = HMAC über {room,guestId,scope,exp} (@jm/rtc/token), im DO gegen das per-event
//     Secret verifiziert. Symmetrisch — laut S5 akzeptabel, da die SFU ohnehin Klartext-Medien sieht.
//   • Warteraum strukturell: ein Gast in 'lobby' erhält kein grantPublish → die SFU-Publish-Route
//     wird verweigert, bis der Operator approve't (in der State-Machine erzwungen).
//   • Consent-Gate: kein onair ohne erteilte Aufnahme-/Broadcast-Einwilligung.
//   • Ephemere TURN-Credentials (kurzes TTL) statt Langzeit-Secrets im Browser.

// Explizite .ts-Endungen: eindeutig für esbuild (wrangler-Deploy) UND Node-Type-Stripping
// (lokaler Test). Die von diesen Modulen intern genutzten Relativ-Importe sind ausschließlich
// `import type` → beim Stripping entfernt, daher dort ohne Endung unkritisch.
import { initialRoomState, reduce, onAirGuests, lobbyCount } from '../../packages/rtc/src/state.ts';
import { verifyJoinToken } from '../../packages/rtc/src/token.ts';
import { generateTurnCredentials } from '../../packages/rtc/src/turn.ts';
import { createCloudflareSfu } from '../../packages/rtc/src/cf-sfu.ts';

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const HEX_SECRET_RE = /^[a-f0-9]{32,128}$/;
// Rückkanal-Tracknamen (Welle 6.2): EIN geteiltes Programmbild + je Gast ein eigener Mix-Minus-Ton.
const PROGRAM_TRACK = 'program-video';
const RETURN_AUDIO_RE = /^return-(.+)-audio$/;
const CONNECT = {
  adminBytes: 16 * 1024,
  retentionMaxSec: 60 * 60 * 24, // 24 h Auto-Verfall eines Raums (DO-Alarm)
  turnTtlSec: 60 * 30, // 30 min ephemere TURN-Creds
  guestCap: 50, // harte Obergrenze gleichzeitiger Gäste je Raum
};

/**
 * Routet alle `/connect/...`-Pfade. Gibt eine Response zurück oder `null`, wenn der Pfad kein
 * Connect-Pfad ist (dann macht worker.js normal weiter). Öffentliche Routen (Gast-Seite, state,
 * ice, ws) sind ABSICHTLICH vor dem globalen PROXY_KEY-Gate erreichbar; die Admin-Routen
 * (open/close) prüft der Worker hier selbst und leitet nur dann an den DO weiter.
 */
export async function handleConnect(request, env, url) {
  const m = url.pathname.match(/^\/connect\/([^/]+)(?:\/([a-z]+))?\/?$/);
  if (!m) return null;

  const id = decodeURIComponent(m[1]);
  const sub = m[2] || '';
  const method = request.method;
  if (!ID_RE.test(id)) return json({ error: 'ungültige Raum-ID' }, 400);

  // Statische Gast-Seite direkt aus dem Worker (kein DO-Spin nötig).
  if (method === 'GET' && sub === '') return html(guestPage(id));

  const isAdmin = (method === 'POST' && sub === '') || (method === 'DELETE' && sub === '');
  if (isAdmin && !keyOk(request, env)) return json({ error: 'unauthorized' }, 401);

  const known =
    isAdmin ||
    (method === 'GET' && (sub === 'state' || sub === 'ice' || sub === 'ws'));
  if (!known) return json({ error: 'not found' }, 404);

  // An den Raum-DO weiterreichen. Raumname + (für Admin) Admin-Marker als interne Header —
  // der DO ist nur über den Worker erreichbar und vertraut diesen Headern.
  if (!env.CONNECT_ROOM) return json({ error: 'CONNECT_ROOM DO-Bindung fehlt' }, 503);
  const stub = env.CONNECT_ROOM.get(env.CONNECT_ROOM.idFromName(id));
  const headers = new Headers(request.headers);
  headers.set('x-connect-room', id);
  if (isAdmin) headers.set('x-connect-admin', '1');
  return stub.fetch(new Request(request, { headers }));
}

// ── Worker-Helfer (bewusst modul-lokal, wie in qa-relay.js) ─────────────────────

function keyOk(request, env) {
  const provided =
    request.headers.get('X-Proxy-Key') ||
    (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return !!env.PROXY_KEY && provided === env.PROXY_KEY;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      // Der versteckte Peer-Renderer läuft cross-origin (Dev: localhost, Prod: file://) und holt
      // hierüber seine token-gegateten ICE/TURN-Creds. `*` ist sicher: der HMAC-Join-Token ist der
      // Gate, es werden keine Cookies gesendet (Token in der Query → kein credentials-Modus).
      'access-control-allow-origin': '*',
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ConnectRoom — Durable Object: eine Instanz je Raum. Autoritativer Raumzustand + WebSockets.
// ────────────────────────────────────────────────────────────────────────────────

// Klassischer Durable-Object-Stil (einfache Klasse, kein `cloudflare:workers`-Basis-Import) —
// nötig, damit der Worker-Import-Graph auch unter Node/tsx (lokaler Test) ladbar bleibt. Die
// Hibernation-WebSocket-API (ctx.acceptWebSocket + webSocketMessage/Close/Error) funktioniert
// mit einfachen Klassen identisch; RPC brauchen wir nicht.
export class ConnectRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /** @type {import('../../packages/rtc/src/protocol').RoomState | null} */
    this.state = null;
    this.meta = null;
    /** Veröffentlichte Gäste: guestId → { sessionId, tracks:[{trackName, kind}] } (Medien-Publish). */
    this.pub = new Map();
    /**
     * Rückkanal (6.2): die vom Peer publizierten Tracks auf SEINER Session.
     * `{ sessionId, program: 'program-video'|null, audio: { [guestId]: 'return-<g>-audio' } }`
     */
    this.ret = null;
    /** guestId → Set der bereits abonnierten Rückkanal-Tracknamen (in-memory, gegen Doppel-Abo). */
    this.retSubs = new Map();
    /** Test-Hook: injizierbarer SfuBroker (sonst Cloudflare Realtime aus env). */
    this._sfuOverride = null;
    // Persistierten Zustand VOR dem ersten Request laden (nur Setup — kein externes I/O).
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      this.state = (await ctx.storage.get('state')) || null;
      this.pub = new Map((await ctx.storage.get('pub')) || []);
      // Nur die 6.2b-Form akzeptieren; alte/unvollständige Stände → null (Peer publisht neu).
      const ret = await ctx.storage.get('ret');
      this.ret = ret && ret.audio ? ret : null;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const room = request.headers.get('x-connect-room') || '';
    const isAdmin = request.headers.get('x-connect-admin') === '1';
    const sub = (url.pathname.match(/^\/connect\/[^/]+(?:\/([a-z]+))?/) || [])[1] || '';
    if (!this.state) this.state = initialRoomState(room);

    // ── Admin: Raum öffnen/konfigurieren bzw. schließen ──
    if (isAdmin && request.method === 'POST' && sub === '') return this.open(request, room);
    if (isAdmin && request.method === 'DELETE' && sub === '') return this.close();

    // ── Öffentlich: Raum-Status (ohne Secret) ──
    if (request.method === 'GET' && sub === 'state') {
      return json({
        open: !!this.meta,
        guests: this.state.guests.filter((g) => g.phase !== 'left' && g.phase !== 'kicked').length,
        lobby: lobbyCount(this.state),
        onair: onAirGuests(this.state).length,
      });
    }

    // ── Öffentlich (token-gated): ephemere TURN-Credentials ──
    if (request.method === 'GET' && sub === 'ice') {
      const claims = await this.verify(url.searchParams.get('t'), room);
      if (!claims) return json({ error: 'ungültiges oder abgelaufenes Token' }, 401);
      return this.issueIce();
    }

    // ── Öffentlich (token-gated): WebSocket-Signalling ──
    if (request.method === 'GET' && sub === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'WebSocket erwartet' }, 426);
      // Operator: Admin-Key (vom Worker markiert). Gast: Join-Token in der Query.
      let identity;
      if (isAdmin) {
        identity = { scope: 'operator', guestId: '', name: 'Operator' };
      } else {
        const claims = await this.verify(url.searchParams.get('t'), room);
        if (!claims) return json({ error: 'ungültiges oder abgelaufenes Token' }, 401);
        identity = {
          scope: claims.scope === 'operator' ? 'operator' : 'guest',
          guestId: claims.guestId,
          name: (url.searchParams.get('name') || claims.name || 'Gast').slice(0, 60),
        };
      }
      return this.accept(identity);
    }

    return json({ error: 'not found' }, 404);
  }

  // ── Admin-Operationen ──

  async open(request, room) {
    let body;
    try {
      const buf = await request.arrayBuffer();
      if (buf.byteLength > CONNECT.adminBytes) return json({ error: 'Anfrage zu groß' }, 413);
      body = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      return json({ error: 'ungültiges JSON' }, 400);
    }
    const secretHex = String((body && body.secretHex) || '');
    if (!HEX_SECRET_RE.test(secretHex)) return json({ error: 'secretHex (hex) erforderlich' }, 400);
    const retentionSec = clampInt(body && body.retentionSec, 300, CONNECT.retentionMaxSec, CONNECT.retentionMaxSec);
    this.meta = {
      secretHex,
      consentText: String((body && body.consentText) || '').slice(0, 2000),
      retentionSec,
      createdAt: Date.now(),
    };
    if (!this.state) this.state = initialRoomState(room);
    await this.ctx.storage.put('meta', this.meta);
    await this.ctx.storage.put('state', this.state);
    // Auto-Verfall: Alarm am Retention-Ende (räumt Raum + WebSockets ab).
    await this.ctx.storage.setAlarm(Date.now() + retentionSec * 1000);
    return json({ ok: true, room, consent: !!this.meta.consentText });
  }

  async close() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1001, 'Raum geschlossen');
      } catch {
        /* egal */
      }
    }
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm().catch(() => {});
    this.state = null;
    this.meta = null;
    this.pub = new Map();
    this.ret = null;
    this.retSubs = new Map();
    return json({ ok: true });
  }

  async alarm() {
    // Retention abgelaufen → Raum vollständig abräumen.
    await this.close();
  }

  // ── Token-Verifikation (per-event-Secret aus den Raum-Metadaten) ──

  async verify(token, room) {
    if (!token || !this.meta || !this.meta.secretHex) return null;
    const claims = await verifyJoinToken(this.meta.secretHex, token, Date.now());
    if (!claims || claims.room !== room) return null;
    return claims;
  }

  // ── WebSocket-Lebenszyklus (Hibernation-API) ──

  accept(identity) {
    if (identity.scope === 'guest' && this.state.guests.filter((g) => g.phase === 'lobby' || g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off').length >= CONNECT.guestCap) {
      return json({ error: 'Raum voll' }, 507);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const tags = identity.scope === 'operator' ? ['operator'] : ['guest', identity.guestId];
    this.ctx.acceptWebSocket(server, tags);
    server.serializeAttachment(identity);

    if (identity.scope === 'guest') {
      this.applyEvent({ t: 'guestJoin', guestId: identity.guestId, name: identity.name });
    } else {
      // Operator sieht sofort den vollen Zustand.
      this.send(server, { t: 'welcome', state: this.state });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    const att = safeAttachment(ws);
    let msg;
    try {
      msg = JSON.parse(typeof message === 'string' ? message : '');
    } catch {
      return;
    }
    if (att.scope === 'operator') return this.onOperator(ws, msg);
    return this.onGuest(ws, att, msg);
  }

  webSocketClose(ws) {
    const att = safeAttachment(ws);
    if (att.scope === 'guest' && att.guestId) {
      this.applyEvent({ t: 'guestDisconnect', guestId: att.guestId });
    }
  }

  webSocketError(ws) {
    try {
      ws.close(1011, 'error');
    } catch {
      /* egal */
    }
  }

  // ── Nachrichten-Handler ──

  onOperator(ws, msg) {
    if (!msg) return;
    // Operator-Aktionen sind exakt die OperatorAction-Union aus @jm/rtc/protocol.
    const OPS = ['approve', 'deny', 'onair', 'off', 'standby', 'go', 'next', 'kick', 'mute', 'talkback'];
    if (OPS.includes(msg.t)) {
      this.applyEvent(msg);
      return;
    }
    // Peer-Medien-Signalling (der versteckte Peer zieht Gäste über den DO von der SFU).
    if (msg.t === 'peerSession') return void this.peerNewSession(ws, msg.offer);
    if (msg.t === 'subscribe' && msg.guestId) return void this.peerSubscribe(ws, msg.sessionId, msg.guestId);
    if (msg.t === 'renegotiate') return void this.peerRenegotiate(ws, msg.sessionId, msg.sdp);
    // Rückkanal 6.2a: der Peer publisht den Programm-Track (Switcher-PGM) auf seiner Session.
    if (msg.t === 'peerPublish') return void this.peerPublish(ws, msg.sessionId, msg.offer, Array.isArray(msg.tracks) ? msg.tracks : []);
  }

  onGuest(ws, att, msg) {
    if (!msg || !att.guestId) return;
    switch (msg.t) {
      case 'consent':
        this.applyEvent({ t: 'guestConsent', guestId: att.guestId });
        return;
      case 'bye':
        this.applyEvent({ t: 'guestLeave', guestId: att.guestId });
        return;
      case 'tracks':
        this.applyEvent({ t: 'guestTracks', guestId: att.guestId, hasVideo: !!msg.hasVideo, hasScreen: !!msg.hasScreen });
        return;
      case 'offer':
        // Der Gast bietet erst nach grantPublish an (siehe Gast-Seite). Warteraum-Gate hier hart prüfen.
        return this.publishGuest(ws, att.guestId, msg.sdp, Array.isArray(msg.tracks) ? msg.tracks : []);
      case 'wantReturn':
        // Rückkanal 6.2a: Gast möchte den Programm-Track sehen → in seine Publish-Session ziehen.
        return void this.guestWantReturn(ws, att.guestId);
      case 'returnAnswer':
        // Answer des Gasts auf den Rückkanal-Renegotiation-Offer → an die SFU.
        return void this.guestReturnAnswer(ws, att.guestId, msg.sdp);
      case 'ice':
        // Bei CF-Realtime ICEt jeder Peer direkt mit der SFU; kein Relay nötig. Ignorieren.
        return;
    }
  }

  /**
   * Gast-Offer → SFU-Publish. Der Gast liefert die Transceiver-Metadaten (mid+kind) aus seinem
   * lokalen Offer; wir vergeben stabile, global eindeutige trackNames `${guestId}-${kind}` und
   * merken uns die Publish-Session, damit der Peer sie ziehen kann. Warteraum-Gate hart geprüft.
   */
  async publishGuest(ws, guestId, sdp, guestTracks) {
    const g = this.state.guests.find((x) => x.id === guestId);
    if (!g || (g.phase !== 'approved' && g.phase !== 'onair' && g.phase !== 'off')) {
      this.send(ws, { t: 'error', code: 'not_approved' }); // Warteraum-Gate
      return;
    }
    const sfu = this.sfu();
    if (!sfu) {
      this.send(ws, { t: 'error', code: 'sfu_not_configured' });
      return;
    }
    // mid+kind → benannte lokale Tracks. Fallback (falls der Gast keine Metadaten schickt): v/a.
    const named = (guestTracks.length ? guestTracks : [{ mid: '0', kind: 'video' }, { mid: '1', kind: 'audio' }]).map(
      (t) => ({ location: 'local', mid: String(t.mid), trackName: `${guestId}-${t.kind === 'audio' ? 'audio' : 'video'}` }),
    );
    try {
      const { sessionId } = await sfu.newSession();
      const { answer } = await sfu.publish(sessionId, sdp, named);
      this.pub.set(guestId, { sessionId, tracks: named.map((t) => ({ trackName: t.trackName, kind: t.trackName.endsWith('-audio') ? 'audio' : 'video' })) });
      await this.savePub();
      this.send(ws, { t: 'answer', sdp: answer });
      // Peer(s) informieren, dass dieser Gast ziehbar ist.
      this.toOperators({ t: 'guestPublished', guestId });
    } catch (e) {
      console.error('[connect] publish', e && e.message);
      this.send(ws, { t: 'error', code: 'sfu_error' });
    }
  }

  // ── Peer-Medien-Broker (der versteckte Peer-Renderer spricht die SFU NUR über den DO,
  //    da das App-Secret serverseitig bleibt) ──
  async peerNewSession(ws, offer) {
    const sfu = this.sfu();
    if (!sfu) return this.send(ws, { t: 'error', code: 'sfu_not_configured' });
    try {
      // Offer des Peers (Data-Channel) → Session anlegen UND Transport etablieren; Answer zurück.
      const { sessionId, answer } = await sfu.newSession(offer);
      this.send(ws, { t: 'peerSession', sessionId, answer });
    } catch (e) {
      console.error('[connect] peerSession', e && e.message);
      this.send(ws, { t: 'error', code: 'sfu_error' });
    }
  }

  async peerSubscribe(ws, peerSessionId, guestId) {
    const sfu = this.sfu();
    const p = this.pub.get(guestId);
    if (!sfu || !p) return this.send(ws, { t: 'error', code: 'not_published' });
    try {
      const remote = p.tracks.map((t) => ({ location: 'remote', sessionId: p.sessionId, trackName: t.trackName }));
      const r = await sfu.subscribe(peerSessionId, remote);
      // Zurückgegebene Track-mids (in der Peer-Session) + kind (aus unserem Publish) für die Korrelation.
      const tracks = r.tracks.map((t) => ({ mid: t.mid, kind: t.trackName.endsWith('-audio') ? 'audio' : 'video' }));
      this.send(ws, { t: 'subscribeOffer', guestId, sdp: r.offer, tracks, renegotiate: r.requiresImmediateRenegotiation });
    } catch (e) {
      console.error('[connect] subscribe', e && e.message);
      // Häufigster Fall: der Transport des Gasts steht noch nicht, seine Tracks sind noch nicht
      // ziehbar. Der Peer versucht es kurz darauf erneut — vorher blieb er still ohne Bild/Ton.
      this.send(ws, { t: 'subscribeFailed', guestId });
    }
  }

  /**
   * Answer des Peers auf ein SFU-Offer anwenden — und das BESTÄTIGEN. Ohne Bestätigung gab der Peer
   * seinen Aushandlungs-Lock frei, sobald die Answer abgeschickt war; sein nächster Publish traf die
   * SFU dann noch im Zustand „warte auf remote answer" → HTTP 406 `invalid_session_description`.
   * Die Bestätigung kommt IMMER (auch im Fehlerfall), damit der Peer nie im Lock hängen bleibt.
   */
  async peerRenegotiate(ws, peerSessionId, sdp) {
    const sfu = this.sfu();
    if (!sfu) return this.send(ws, { t: 'renegotiated', ok: false });
    try {
      await sfu.renegotiate(peerSessionId, sdp);
      this.send(ws, { t: 'renegotiated', ok: true });
    } catch (e) {
      console.error('[connect] renegotiate', e && e.message);
      this.send(ws, { t: 'renegotiated', ok: false });
    }
  }

  // ── Rückkanal 6.2: Programm-Bild (geteilt) + Mix-Minus-Ton (je Gast) → Gäste ──
  /**
   * Der Peer publisht eigene Tracks auf SEINER Session: `program-video` (einmal, geteilt) und je
   * Gast `return-<guestId>-audio` (sein Mix-Minus). Wir merken uns die Referenzen, damit Gäste sie
   * ziehen können, und stoßen die Gäste an (returnAvailable → wantReturn).
   */
  async peerPublish(ws, sessionId, offer, tracks) {
    const sfu = this.sfu();
    if (!sfu || !sessionId) return this.send(ws, { t: 'error', code: 'sfu_not_configured' });
    const named = tracks
      .filter((t) => t && t.trackName)
      .map((t) => ({ location: 'local', mid: String(t.mid), trackName: String(t.trackName) }));
    if (!named.length) return;
    try {
      const { answer } = await sfu.publish(sessionId, offer, named);
      // Neue Peer-Session (App-Neustart/Reconnect) → alte Track-Referenzen sind tot: Gäste neu abonnieren.
      if (!this.ret || this.ret.sessionId !== sessionId) {
        this.ret = { sessionId, program: null, audio: {} };
        this.retSubs = new Map();
      }
      for (const t of named) {
        if (t.trackName === PROGRAM_TRACK) this.ret.program = t.trackName;
        const m = RETURN_AUDIO_RE.exec(t.trackName);
        if (m) this.ret.audio[m[1]] = t.trackName;
      }
      await this.ctx.storage.put('ret', this.ret).catch(() => {});
      this.send(ws, { t: 'peerPublished', answer });
      // Alle Gäste anstoßen, die (evtl. neuen) Rückkanal-Tracks zu ziehen.
      for (const g of this.ctx.getWebSockets('guest')) this.send(g, { t: 'returnAvailable' });
    } catch (e) {
      console.error('[connect] peerPublish', e && e.message);
      this.send(ws, { t: 'error', code: 'sfu_error' });
    }
  }

  /**
   * Gast zieht seine Rückkanal-Tracks in die eigene Publish-Session: das geteilte Programmbild und
   * SEINEN Mix-Minus-Ton (`return-<guestId>-audio` — enthält ihn selbst nie). Idempotent: es werden
   * nur noch nicht abonnierte Tracks nachgezogen (der Ton kommt oft erst nach dem Bild dazu).
   */
  async guestWantReturn(ws, guestId) {
    const sfu = this.sfu();
    const p = this.pub.get(guestId);
    if (!sfu || !this.ret || !p) return; // noch nichts publiziert / Gast publisht noch nicht → returnAvailable folgt
    const want = [];
    if (this.ret.program) want.push(this.ret.program);
    if (this.ret.audio[guestId]) want.push(this.ret.audio[guestId]);
    const have = this.retSubs.get(guestId) || new Set();
    const missing = want.filter((t) => !have.has(t));
    if (!missing.length) return;
    try {
      const r = await sfu.subscribe(
        p.sessionId,
        missing.map((trackName) => ({ location: 'remote', sessionId: this.ret.sessionId, trackName })),
      );
      for (const t of missing) have.add(t);
      this.retSubs.set(guestId, have);
      const tracks = r.tracks.map((t) => ({ mid: t.mid, kind: t.trackName && t.trackName.endsWith('-audio') ? 'audio' : 'video' }));
      this.send(ws, { t: 'returnOffer', sdp: r.offer, tracks, renegotiate: r.requiresImmediateRenegotiation });
    } catch (e) {
      console.error('[connect] guestWantReturn', e && e.message);
      // Häufig `not_found_track_error`: der Programm-Track ist angemeldet, sendet aber noch keine
      // Pakete. `have` bleibt unverändert → der Gast darf es gleich nochmal versuchen.
      this.send(ws, { t: 'returnFailed' });
    }
  }

  /** Answer des Gasts auf den Rückkanal-Offer → an die SFU (renegotiate seiner Publish-Session). */
  async guestReturnAnswer(ws, guestId, sdp) {
    const sfu = this.sfu();
    const p = this.pub.get(guestId);
    if (!sfu || !p || !sdp) return;
    try {
      await sfu.renegotiate(p.sessionId, sdp);
    } catch (e) {
      console.error('[connect] guestReturnAnswer', e && e.message);
    }
  }

  savePub() {
    return this.ctx.storage.put('pub', [...this.pub.entries()]).catch(() => {});
  }

  sfu() {
    if (this._sfuOverride) return this._sfuOverride;
    const appId = this.env.RTC_SFU_APP_ID;
    const appToken = this.env.RTC_SFU_APP_TOKEN;
    if (!appId || !appToken) return null;
    return createCloudflareSfu({ appId, appToken });
  }

  async issueIce() {
    const keyId = this.env.RTC_TURN_KEY_ID;
    const apiToken = this.env.RTC_TURN_API_TOKEN;
    if (!keyId || !apiToken) {
      // Dev-Fallback: nur STUN (funktioniert ohne NAT-Relay). Für echte Zuschaltungen TURN setzen.
      return json({
        iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }],
        warning: 'TURN nicht konfiguriert — nur STUN (NAT-Relay fehlt)',
      });
    }
    try {
      const ice = await generateTurnCredentials(keyId, apiToken, CONNECT.turnTtlSec);
      return json(ice);
    } catch (e) {
      console.error('[connect] turn', e && e.message);
      return json({ error: 'TURN-Cred-Ausgabe fehlgeschlagen' }, 502);
    }
  }

  // ── State-Machine-Anwendung + Effekt-Verteilung ──

  applyEvent(ev) {
    const { state, effects } = reduce(this.state, ev, Date.now());
    this.state = state;
    // Persist-first: Zustand VOR den ausgehenden Nachrichten sichern (überlebt Hibernation/Crash).
    this.ctx.storage.put('state', state).catch(() => {});
    for (const eff of effects) this.dispatch(eff);
    this.broadcast();
  }

  dispatch(eff) {
    switch (eff.t) {
      case 'grantPublish':
        this.toGuest(eff.guestId, { t: 'grantPublish' });
        break;
      case 'revokePublish':
        this.toGuest(eff.guestId, { t: 'revoked' });
        break;
      case 'tally':
        this.toGuest(eff.guestId, { t: 'tally', tally: eff.tally });
        break;
      case 'notify':
        this.toGuest(eff.guestId, { t: 'notice', code: eff.code });
        break;
      case 'spinUpNdi':
        // An die Operator-App (jm-connect) — sie verwaltet den NDI-Sender-Pool (Welle 6.1).
        this.toOperators({ t: 'ndi', action: 'up', guestId: eff.guestId, label: eff.label });
        break;
      case 'tearDownNdi':
        this.toOperators({ t: 'ndi', action: 'down', guestId: eff.guestId });
        // Publish-Zustand vergessen + Peer zum Abbau anstoßen.
        if (this.pub.delete(eff.guestId)) void this.savePub();
        // Rückkanal des Gasts vergessen (Rejoin darf neu ziehen; sein Mix-Minus-Track ist tot).
        this.retSubs.delete(eff.guestId);
        if (this.ret && this.ret.audio[eff.guestId]) {
          delete this.ret.audio[eff.guestId];
          void this.ctx.storage.put('ret', this.ret).catch(() => {});
        }
        this.toOperators({ t: 'guestUnpublished', guestId: eff.guestId });
        break;
    }
  }

  broadcast() {
    // Operatoren: voller Zustand. Gäste: nur die eigene Sicht (kein Leak der Gästeliste).
    this.toOperators({ t: 'state', state: this.state });
    for (const ws of this.ctx.getWebSockets('guest')) {
      const att = safeAttachment(ws);
      const g = this.state.guests.find((x) => x.id === att.guestId);
      if (g) this.send(ws, { t: 'you', phase: g.phase, tally: g.tally });
    }
  }

  // ── Sende-Helfer ──

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* Socket evtl. zu — Hibernation/close räumt auf */
    }
  }
  toOperators(obj) {
    for (const ws of this.ctx.getWebSockets('operator')) this.send(ws, obj);
  }
  toGuest(guestId, obj) {
    for (const ws of this.ctx.getWebSockets(guestId)) this.send(ws, obj);
  }
}

function safeAttachment(ws) {
  try {
    return ws.deserializeAttachment() || {};
  } catch {
    return {};
  }
}

function clampInt(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// ── Gast-Seite (vom Worker gehostet) ────────────────────────────────────────────
//
// Selbst-enthaltene HTML-Seite (inline CSS + Vanilla-JS, kein Bundling) — dem Muster von
// qa-relay.js submissionPage nachempfunden. Flow: Consent → WS verbinden (Token aus ?t=) →
// Warteraum → auf grantPublish getUserMedia + WebRTC-Offer an die SFU → Tally anzeigen.

function guestPage(id) {
  const base = JSON.stringify('/connect/' + id);
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>Zuschaltung — JM Connect</title>
<style>
  :root{ --bg:#121212; --fg:#fff; --muted:#9a9a9a; --line:#2a2a2a; --yellow:#fbe73b; --dark:#121212; --red:#e5484d; --green:#7bd88f; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body{ margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap{ max-width:560px; margin:0 auto; padding:20px 16px 40px; }
  h1{ font-size:20px; margin:8px 0 2px; }
  .sub{ color:var(--muted); font-size:13px; margin-bottom:18px; }
  label{ display:block; font-size:13px; color:var(--muted); margin:14px 0 6px; }
  input{ width:100%; background:#1c1c1c; border:1px solid var(--line); color:var(--fg); border-radius:10px; padding:13px 12px; font-size:16px; }
  button{ width:100%; margin-top:20px; padding:15px; border:0; border-radius:12px; background:var(--yellow); color:var(--dark); font-size:17px; font-weight:700; }
  button:disabled{ opacity:.5; }
  .consent{ font-size:13px; color:var(--muted); background:#1c1c1c; border:1px solid var(--line); border-radius:10px; padding:12px; margin-top:14px; }
  video{ width:100%; border-radius:12px; background:#000; margin-top:16px; display:none; }
  .proglabel{ margin-top:18px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .status{ margin-top:16px; text-align:center; color:var(--muted); font-size:14px; min-height:20px; }
  .badge{ display:inline-block; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700; }
  .b-live{ background:var(--red); color:#fff; } .b-prev{ background:#333; color:var(--fg); } .b-wait{ background:#333; color:var(--muted); }
  .hide{ display:none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Zuschaltung</h1>
  <div class="sub">Du wirst als Remote-Gast zugeschaltet. Bild und Ton werden erst nach Freigabe durch die Regie übertragen.</div>

  <div id="join">
    <label for="name">Dein Name *</label>
    <input id="name" autocomplete="name" placeholder="Vor- und Nachname" />
    <div class="consent">
      <label style="margin:0 0 8px"><input type="checkbox" id="consent" style="width:auto;margin-right:8px" /> Ich willige ein, dass mein Bild und Ton live übertragen und ggf. aufgezeichnet werden.</label>
    </div>
    <button id="enter">Warteraum betreten</button>
  </div>

  <video id="preview" playsinline autoplay muted></video>
  <div id="programWrap" class="hide">
    <div class="proglabel">Programm (Rückkanal)</div>
    <video id="program" playsinline autoplay muted></video>
  </div>
  <!-- Return-Ton (Mix-Minus: Programm + andere Gäste, nie man selbst) — eigenes, NICHT stummes Element. -->
  <audio id="ret" autoplay playsinline></audio>
  <div class="status" id="st"></div>
</div>
<script>
  var BASE=${base};
  var q=new URLSearchParams(location.search), TOKEN=q.get('t')||'';
  var nameEl=document.getElementById('name'), consentEl=document.getElementById('consent'), enterEl=document.getElementById('enter');
  var joinEl=document.getElementById('join'), stEl=document.getElementById('st'), video=document.getElementById('preview');
  var programWrap=document.getElementById('programWrap'), programVideo=document.getElementById('program');
  var retAudio=document.getElementById('ret');
  var ws=null, pc=null, stream=null, programStream=null, returnStream=null, retTries=0;

  // Rückkanal anfordern (Programmbild + eigener Mix-Minus-Ton). Wird gestaffelt wiederholt, solange
  // die SFU die Tracks noch nicht liefert (z. B. Programm-Track sendet noch keine Pakete).
  function wantReturn(){
    retTries++;
    if(ws && ws.readyState===1) ws.send(JSON.stringify({t:'wantReturn'}));
  }

  function status(t, cls){ stEl.innerHTML = cls ? '<span class="badge '+cls+'">'+t+'</span>' : t; }
  function wsUrl(){ return (location.protocol==='https:'?'wss://':'ws://')+location.host+BASE+'/ws?t='+encodeURIComponent(TOKEN)+'&name='+encodeURIComponent(nameEl.value.trim()); }

  async function enter(){
    if(!nameEl.value.trim()){ status('Bitte einen Namen angeben.'); nameEl.focus(); return; }
    if(!consentEl.checked){ status('Bitte der Übertragung zustimmen.'); return; }
    if(!TOKEN){ status('Ungültiger Zuschalt-Link (Token fehlt).'); return; }
    enterEl.disabled=true; joinEl.classList.add('hide');
    status('Verbinde mit der Regie …','b-wait');
    connect();
  }
  function connect(){
    ws=new WebSocket(wsUrl());
    ws.onopen=function(){ ws.send(JSON.stringify({t:'consent'})); status('Im Warteraum — warte auf Freigabe …','b-wait'); };
    ws.onmessage=function(ev){ var m; try{ m=JSON.parse(ev.data); }catch(e){ return; } onMsg(m); };
    ws.onclose=function(){ status('Verbindung getrennt.'); if(pc){ pc.close(); pc=null; } };
  }
  async function onMsg(m){
    if(m.t==='grantPublish'){ await startPublish(); }
    else if(m.t==='tally'){
      if(m.tally==='program') status('DU BIST AUF SENDUNG','b-live');
      else if(m.tally==='preview') status('Freigegeben — in Vorschau','b-prev');
      else status('Aus Sendung genommen','b-wait');
    }
    else if(m.t==='answer' && pc){ await pc.setRemoteDescription(m.sdp); retTries=0; wantReturn(); }
    else if(m.t==='returnAvailable'){ retTries=0; wantReturn(); }
    else if(m.t==='returnFailed'){
      // Programm-Track meldet noch keine Pakete → gestaffelt erneut versuchen.
      if(retTries<6) setTimeout(wantReturn, 800*retTries);
    }
    else if(m.t==='returnOffer' && pc && m.sdp){ retTries=0; await onReturnOffer(m.sdp); }
    else if(m.t==='notice'){ if(m.code==='kicked'){ status('Von der Regie entfernt.'); if(ws)ws.close(); } if(m.code==='denied'){ status('Zuschaltung abgelehnt.'); if(ws)ws.close(); } }
    else if(m.t==='error'){
      if(m.code==='sfu_not_configured') status('Regie-Medienserver noch nicht eingerichtet.');
      else if(m.code==='not_approved') status('Noch nicht freigegeben.','b-wait');
      else status('Fehler bei der Zuschaltung.');
    }
  }
  async function startPublish(){
    try{
      status('Freigegeben — starte Kamera …','b-prev');
      // Echo-Unterdrückung ausdrücklich an: der Return-Ton kommt aus dem Lautsprecher zurück ins Mikro.
      // (Das „sich selbst hören" verhindert dagegen das Mix-Minus serverseitig.)
      stream=await navigator.mediaDevices.getUserMedia({
        video:{width:1280,height:720},
        audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true }
      });
      video.srcObject=stream; video.style.display='block';
      var ice=await fetch(BASE+'/ice?t='+encodeURIComponent(TOKEN)).then(function(r){return r.json();}).catch(function(){return {iceServers:[]};});
      pc=new RTCPeerConnection({ iceServers: ice.iceServers||[] });
      // Rückkanal: Programm-Bild → <video>, Mix-Minus-Ton → eigenes <audio> (nicht stumm).
      pc.ontrack=function(ev){
        if(ev.track.kind==='audio'){
          if(!returnStream) returnStream=new MediaStream();
          returnStream.addTrack(ev.track);
          retAudio.srcObject=returnStream;
          playReturnAudio();
          return;
        }
        if(!programStream) programStream=new MediaStream();
        programStream.addTrack(ev.track);
        programVideo.srcObject=programStream; programVideo.style.display='block'; programWrap.classList.remove('hide');
      };
      stream.getTracks().forEach(function(tr){ pc.addTrack(tr, stream); });
      ws.send(JSON.stringify({t:'tracks', hasVideo:true}));
      var offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Transceiver-mid + kind mitsenden → der DO vergibt daraus global eindeutige trackNames.
      var tracks=pc.getTransceivers().filter(function(t){return t.sender&&t.sender.track;}).map(function(t){return {mid:t.mid, kind:t.sender.track.kind};});
      ws.send(JSON.stringify({t:'offer', sdp:{ type:offer.type, sdp:offer.sdp }, tracks:tracks}));
    }catch(e){ status('Kamera/Mikrofon nicht verfügbar.'); }
  }
  // Return-Ton starten. Blockiert die Autoplay-Policy trotz vorheriger Geste, beim nächsten
  // Tippen erneut versuchen (statt still stumm zu bleiben).
  function playReturnAudio(){
    retAudio.play().catch(function(){
      status('Zum Aktivieren des Tons kurz tippen.');
      document.addEventListener('click', function once(){
        document.removeEventListener('click', once);
        retAudio.play().catch(function(){});
      });
    });
  }
  // Rückkanal-Renegotiation: SFU-Offer (Programm-/Return-Tracks) beantworten.
  async function onReturnOffer(sdp){
    try{
      await pc.setRemoteDescription(sdp);
      var answer=await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({t:'returnAnswer', sdp:{ type:answer.type, sdp:answer.sdp }}));
    }catch(e){ /* Rückkanal optional — Zuschaltung läuft auch ohne Programm-Bild weiter */ }
  }
  enterEl.addEventListener('click', enter);
</script>
</body>
</html>`;
}
