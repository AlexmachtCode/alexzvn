// Versteckter WebRTC-Peer-Renderer (Chromium-WebRTC). Welle 6.1: zieht die von den Gästen bei
// der SFU veröffentlichten Tracks, dekodiert sie per WebCodecs zu BGRA/FLTP und postet sie je Gast
// auf den vom Main übergebenen Frame-Port → NDI-Gäste-Pool → erscheint automatisch im Switcher.
//
// Welle 6.2 (Rückkanal), beide Richtungen auf DERSELBEN PeerConnection:
//   6.2a  Programm-NDI → `program-video`  (EIN geteilter Track, alle Gäste sehen ihn)
//   6.2b  Mix-Minus    → `return-<G>-audio` je Gast: Programm + alle ANDEREN Gäste, nie er selbst
//         (sonst hörte er sich verzögert selbst → Echo). Gemischt im Web-Audio-Graph hier.
//   6.2c  Talkback     → Regie-Mikro, gated, in den Return-Bus des Ziel-Gasts. Es geht NUR ins Ohr
//         des Gasts, nie ins Programm/NDI und nie in die Mischung der anderen Gäste.
//
// Das App-Secret der SFU bleibt serverseitig: der Peer spricht die SFU NUR über den ConnectRoom-DO.
// WICHTIG (CF Realtime): eine reine EMPFÄNGER-Session hat erst dann einen Transport, wenn ein
// Offer/Answer ausgetauscht wurde. Deshalb etabliert der Peer seine PeerConnection ZUERST über
// einen Data-Channel-Offer an /sessions/new (Answer zurück) und zieht Tracks erst NACH ICE-connected
// (sonst: „Session appears to be disconnected"). Track→Gast läuft über die Transceiver-mid.
import { SignallingClient } from '@jm/rtc/signalling';
import { audioDataToFltp, bgraToVideoFrame, fltpToAudioData, videoFrameToBgra } from '@jm/rtc/frames';
import { ndiPoolKey } from '@jm/rtc/protocol';
import { PEER_CONNECT, PEER_FRAME_PORT, PEER_PROGRAM_PORT } from '@shared/ipc';

type Kind = 'video' | 'audio' | 'screen';

// Schlüssel von `guestPorts`/`pendingTracks`/`pumping` ist der NDI-POOL-Schlüssel, nicht die Gast-ID:
// ein Gast hat zwei Quellen (Kamera + geteilter Bildschirm) und damit zwei NDI-Sender (Welle 6.3).
const guestPorts = new Map<string, MessagePort>(); // Pool-Schlüssel → Frame-Port (Main → NDI-Utility)
const midMap = new Map<string, { guestId: string; kind: Kind }>(); // Transceiver-mid → Gast/Art
const pendingTracks = new Map<string, { video?: MediaStreamTrack; audio?: MediaStreamTrack }>();
const pumping = new Set<string>(); // `${poolKey}:${kind}` — läuft bereits
const wantSubscribe = new Set<string>(); // guestPublished vor Transport-ready → nachholen
const subscribeTries = new Map<string, number>(); // Gast → bisherige Subscribe-Versuche (Retry-Backoff)
const SUBSCRIBE_MAX_TRIES = 6;

// Track-Buchführung je Gast. Der Bildschirm kommt MITTEN im Betrieb dazu — würde der Peer dann
// erneut alle Tracks ziehen, läge das Kamerabild ein zweites Mal in seiner Session.
const publishedNames = new Map<string, Set<string>>(); // Gast → vom DO gemeldete Tracknamen
const subscribedNames = new Map<string, Set<string>>(); // Gast → bereits gezogen
const inflightNames = new Map<string, Set<string>>(); // Gast → gerade angefordert

let ws: SignallingClient | null = null;
let pc: RTCPeerConnection | null = null;
let peerSessionId: string | null = null;
let pcConnected = false;

// ── Rückkanal 6.2a: Programm-NDI → EIN geteilter `program-video`-Track an die SFU ──
const PROGRAM_TRACK = 'program-video';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let programGen: any = null; // MediaStreamTrackGenerator (nicht in lib.dom typisiert)
let programWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;
let programTrack: MediaStreamTrack | null = null;
let programPublished = false;
let programFrames = 0;
let programFramesSkipped = 0;
/** Answer auf den laufenden Publish. Einzel-Slot genügt: Publishes laufen serialisiert (negoChain). */
let publishAnswerResolve: ((a: RTCSessionDescriptionInit | undefined) => void) | null = null;
/** Bestätigung, dass der DO unsere Renegotiation-Answer bei der SFU angewendet hat (siehe unten). */
let renegotiateResolve: (() => void) | null = null;

// ── Rückkanal 6.2b: Web-Audio-Mix-Minus ──────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let programAudioGen: any = null; // MediaStreamTrackGenerator({kind:'audio'})
let programAudioWriter: WritableStreamDefaultWriter<AudioData> | null = null;
let programAudioGain: GainNode | null = null;
let programAudioTsUs = 0; // monotone Zeitbasis aus der Samplezahl (nicht performance.now → keine Drift)
let programAudioChunks = 0;
let audioBacklog = 0;
let audioWriteChain: Promise<void> = Promise.resolve();
const guestGain = new Map<string, GainNode>(); // Gast-Audio → sein Beitrag zum Bus
const returnDest = new Map<string, MediaStreamAudioDestinationNode>(); // Gast → sein persönlicher Mix
const returnPublished = new Set<string>(); // `return-<G>-audio` bereits an die SFU publiziert

// ── Rückkanal 6.2c: Talkback (Regie ins Ohr) ─────────────────────────────────────────────────
type TalkbackMode = 'off' | 'selected' | 'all';
let talkbackSource: MediaStreamAudioSourceNode | null = null;
let talkbackMode: TalkbackMode = 'off';
let talkbackTarget: string | null = null;
let talkbackOpening = false;
const talkbackGain = new Map<string, GainNode>(); // Gast → Regie-Mikro in SEINEN Return-Bus

/**
 * Diagnose: in die (versteckte) Peer-Konsole UND ins Main-/Terminal-Log spiegeln. Der Peer hat
 * kein sichtbares Fenster — ohne das müsste man die abgetrennten DevTools aufmachen, um zu sehen,
 * wo die Medienkette hängt.
 */
function plog(...parts: unknown[]): void {
  console.log('[peer]', ...parts);
  try {
    window.jmconnect?.peerLog?.(parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' '));
  } catch {
    /* egal */
  }
}

// Alle Aushandlungen auf der EINEN Peer-PeerConnection serialisieren (Publish vs. Subscribe teilen
// sich den SDP-Zustandsautomaten → sonst Glare: „have-local-offer"-Kollision). Kette rejectet nie.
let negoChain: Promise<void> = Promise.resolve();
function serializeNego(fn: () => Promise<void>): Promise<void> {
  const run = negoChain.then(fn, fn);
  negoChain = run.catch(() => {});
  return run;
}

window.addEventListener('message', (e: MessageEvent) => {
  const d = e.data as { ch?: string; key?: string; wsUrl?: string; iceUrl?: string } | null;
  if (!d) return;
  if (d.ch === PEER_FRAME_PORT && d.key) {
    const port = e.ports[0];
    if (!port) return;
    port.start();
    guestPorts.set(d.key, port);
    tryPump(d.key);
  } else if (d.ch === PEER_PROGRAM_PORT) {
    const port = e.ports[0];
    if (!port) return;
    port.start();
    setupProgramGenerator();
    // Frame-Handler ZUERST registrieren: der Bild-Rückkanal darf NIE daran scheitern, dass der
    // Audio-Teil (AudioContext/Generator) fehlschlägt — sonst käme kein einziges Videoframe an.
    port.onmessage = (ev) => {
      const m = ev.data as { type?: string } | null;
      // Audio läuft ohne Ack (darf keine Lücken haben), Video über die Ack-Backpressure.
      if (m && m.type === 'audio') enqueueProgramAudio(ev.data);
      else void onProgramFrame(port, ev.data);
    };
    try {
      setupProgramAudio();
    } catch (err) {
      plog('FEHLER Programm-Audio-Setup fehlgeschlagen (Bild läuft weiter):', err);
    }
    maybePublishProgram();
  } else if (d.ch === PEER_CONNECT && d.wsUrl && d.iceUrl) {
    void connect(d.wsUrl, d.iceUrl);
  }
});

async function connect(wsUrl: string, iceUrl: string): Promise<void> {
  // Schlägt der Abruf fehl (CSP, Netz, Token), lief der Peer bisher STUMM ohne TURN weiter — im
  // LAN unauffällig, hinter striktem NAT tot. Jetzt sagt er es.
  const ice = await fetch(iceUrl)
    .then((r) => r.json())
    .catch((err) => {
      plog('⚠ ICE-Credentials nicht abrufbar — weiter ohne TURN:', err instanceof Error ? err.message : String(err));
      return { iceServers: [] as RTCIceServer[] };
    });
  pc?.close();
  pcConnected = false;
  peerSessionId = null;
  // Neue PeerConnection → alle eigenen Tracks (Programm + Return-Audio) erneut publishen.
  programPublished = false;
  returnPublished.clear();
  // …und alle FREMDEN Tracks erneut ziehen: sie hingen an der alten Session. Ohne das hielte sich
  // der Peer für versorgt und bliebe nach einem Reconnect ohne Bild.
  subscribedNames.clear();
  inflightNames.clear();
  midMap.clear();
  pc = new RTCPeerConnection({ iceServers: ice.iceServers || [] });
  pc.ontrack = onTrack;
  pc.oniceconnectionstatechange = () => {
    const st = pc?.iceConnectionState;
    plog('ICE:', st);
    if (st === 'connected' || st === 'completed') {
      pcConnected = true;
      flushSubscribe();
      maybePublishProgram();
      flushReturns();
    }
  };
  // Data-Channel erzwingt eine m-Sektion → gültiger Offer, der den Transport (ICE/DTLS) etabliert.
  pc.createDataChannel('jm');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const localOffer = { type: offer.type, sdp: offer.sdp };

  ws?.close();
  ws = new SignallingClient({
    url: wsUrl,
    onOpen: () => {
      plog('WS offen → peerSession (mit Transport-Offer)');
      ws?.send({ t: 'peerSession', offer: localOffer });
    },
    onMessage,
  });
  ws.connect();
}

function onMessage(raw: unknown): void {
  const m = raw as {
    t?: string;
    sessionId?: string;
    guestId?: string;
    sdp?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    // `guestPublished`/`subscribeFailed` schicken Tracknamen, `subscribeOffer` die Zuordnung mid→Art.
    tracks?: (string | { mid: string; kind: Kind; name?: string })[];
    code?: string;
    state?: { talkback?: { mode?: TalkbackMode; target?: string | null } };
  };
  if (m.t === 'peerSession' && m.sessionId) {
    peerSessionId = m.sessionId;
    plog('SFU-Session', m.sessionId, '· Answer?', !!m.answer);
    void applyTransportAnswer(m.answer);
  } else if (m.t === 'peerPublished') {
    // Answer auf unseren laufenden Publish (program-video oder return-<G>-audio). Löst das im
    // Nego-Lock wartende publishTrack() auf, das die Answer selbst anwendet (Zustand konsistent).
    plog('peerPublished · Answer?', !!m.answer);
    publishAnswerResolve?.(m.answer);
    publishAnswerResolve = null;
  } else if (m.t === 'renegotiated') {
    // Die SFU hat unsere Answer verarbeitet → der Nego-Lock darf weiter.
    renegotiateResolve?.();
    renegotiateResolve = null;
  } else if (m.t === 'guestPublished' && m.guestId) {
    const names = trackNames(m.tracks);
    plog('guestPublished', m.guestId, names.join(',') || '(ohne Namen)');
    notePublished(m.guestId, names);
    maybeSubscribe(m.guestId);
  } else if (m.t === 'subscribeOffer' && m.guestId && m.sdp) {
    plog('subscribeOffer', m.guestId, m.tracks);
    const guestId = m.guestId;
    const sdp = m.sdp;
    const tracks = (m.tracks || []).filter((t): t is { mid: string; kind: Kind; name?: string } => typeof t === 'object');
    subscribeTries.delete(guestId); // geklappt → Zähler zurücksetzen
    settleSubscribe(guestId, tracks.map((t) => t.name).filter((n): n is string => !!n), true);
    void serializeNego(() => onSubscribeOffer(guestId, sdp, tracks));
  } else if (m.t === 'subscribeFailed' && m.guestId) {
    // Der Gast-Transport steht oft erst kurz nach seinem Publish → gestaffelt erneut versuchen.
    settleSubscribe(m.guestId, trackNames(m.tracks), false);
    retrySubscribe(m.guestId);
  } else if (m.t === 'guestUnpublished' && m.guestId) {
    stopGuest(m.guestId);
  } else if (m.t === 'error') {
    plog('WARN DO-Fehler:', m.code);
  } else if (m.t === 'welcome' || m.t === 'state') {
    // Der DO ist autoritativ — auch fürs Talkback (6.2c). Der Peer hört hier mit, statt einen
    // eigenen IPC-Weg zu bekommen: so kann die Regie-Stimme nie von der Freigabe-Logik abweichen.
    applyTalkback(m.state?.talkback);
  } else if (m.t === 'ndi' || m.t === 'you') {
    // Reine Operator-/Gast-UI-Nachrichten — den Peer betreffen sie nicht.
  } else {
    // NIE still verschlucken: ein subscribeOffer ohne sdp fiel vorher wortlos durch alle
    // Bedingungen und der Medienpfad blieb ohne jede Spur stehen.
    plog('WARN unbehandelte DO-Nachricht:', m.t, '· sdp?', !!m.sdp, '· tracks:', (m.tracks || []).length);
  }
}

async function applyTransportAnswer(answer?: RTCSessionDescriptionInit): Promise<void> {
  if (!answer || !pc) return;
  try {
    await pc.setRemoteDescription(answer);
    plog('Transport-Answer gesetzt → warte auf ICE');
  } catch (e) {
    plog('FEHLER setRemoteDescription(answer) fehlgeschlagen', e);
  }
}

/** Nur die Namens-Einträge aus einer gemischten `tracks`-Liste. */
function trackNames(tracks: (string | { name?: string })[] | undefined): string[] {
  return (tracks || []).map((t) => (typeof t === 'string' ? t : t.name)).filter((n): n is string => !!n);
}

function notePublished(guestId: string, names: string[]): void {
  if (!names.length) return;
  const set = publishedNames.get(guestId) ?? new Set<string>();
  for (const n of names) set.add(n);
  publishedNames.set(guestId, set);
}

/** Angeforderte Tracks abhaken: erfolgreich → „habe ich", fehlgeschlagen → wieder freigeben. */
function settleSubscribe(guestId: string, names: string[], ok: boolean): void {
  const inflight = inflightNames.get(guestId);
  for (const n of names) inflight?.delete(n);
  if (!ok) return;
  const have = subscribedNames.get(guestId) ?? new Set<string>();
  for (const n of names) have.add(n);
  subscribedNames.set(guestId, have);
}

/** Welche Tracks des Gasts fehlen noch — oder `null`, wenn der DO keine Namen meldet (alter Worker). */
function missingFor(guestId: string): string[] | null {
  const want = publishedNames.get(guestId);
  if (!want) return null; // ohne Namen: der DO zieht alles (abwärtskompatibel)
  const have = subscribedNames.get(guestId) ?? new Set<string>();
  const inflight = inflightNames.get(guestId) ?? new Set<string>();
  return [...want].filter((n) => !have.has(n) && !inflight.has(n));
}

function maybeSubscribe(guestId: string): void {
  if (pcConnected && peerSessionId) subscribe(guestId);
  else wantSubscribe.add(guestId);
}
function flushSubscribe(): void {
  if (!pcConnected || !peerSessionId) return;
  for (const g of wantSubscribe) subscribe(g);
  wantSubscribe.clear();
}
function subscribe(guestId: string): void {
  const only = missingFor(guestId);
  if (only && !only.length) return; // alles schon gezogen
  if (only) {
    const inflight = inflightNames.get(guestId) ?? new Set<string>();
    for (const n of only) inflight.add(n);
    inflightNames.set(guestId, inflight);
  }
  plog('subscribe', guestId, only ? only.join(',') : '(alle)', '(session', peerSessionId, ')');
  ws?.send(only ? { t: 'subscribe', sessionId: peerSessionId, guestId, only } : { t: 'subscribe', sessionId: peerSessionId, guestId });
}

/** Subscribe erneut versuchen (Backoff). Der Gast ist gerade erst am Publishen — seine Tracks
 *  sind an der SFU oft erst wenige hundert ms später ziehbar. */
function retrySubscribe(guestId: string): void {
  const tries = (subscribeTries.get(guestId) ?? 0) + 1;
  subscribeTries.set(guestId, tries);
  if (tries >= SUBSCRIBE_MAX_TRIES) {
    plog('FEHLER subscribe endgültig fehlgeschlagen für', guestId, `(${tries} Versuche)`);
    return;
  }
  const delay = tries * 400;
  plog('WARN subscribe fehlgeschlagen für', guestId, `→ Versuch ${tries + 1} in ${delay}ms`);
  setTimeout(() => {
    if (pcConnected && peerSessionId) subscribe(guestId);
  }, delay);
}

async function onSubscribeOffer(
  guestId: string,
  sdp: RTCSessionDescriptionInit,
  tracks: { mid: string; kind: Kind }[],
): Promise<void> {
  if (!pc) return;
  for (const t of tracks) midMap.set(t.mid, { guestId, kind: t.kind });
  try {
    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    // IM LOCK auf die SFU-Bestätigung warten: bis die Answer dort angewendet ist, erwartet die SFU
    // genau diese Answer und weist jeden Publish/Pull mit 406 `invalid_session_description` ab.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        renegotiateResolve = null;
        plog('WARN renegotiate-Bestätigung ausgeblieben für', guestId);
        resolve();
      }, 8000);
      renegotiateResolve = () => {
        clearTimeout(timer);
        resolve();
      };
      ws?.send({ t: 'renegotiate', sessionId: peerSessionId, sdp: { type: answer.type, sdp: answer.sdp } });
    });
    plog('renegotiate bestätigt für', guestId);
  } catch (e) {
    plog('FEHLER onSubscribeOffer fehlgeschlagen', e);
  }
}

function onTrack(ev: RTCTrackEvent): void {
  const mid = ev.transceiver.mid || '';
  const info = midMap.get(mid);
  plog('ontrack mid=', mid, '→', info, 'kind=', ev.track.kind);
  if (!info) return;
  // Der geteilte Bildschirm ist eine eigene NDI-Quelle → eigener Pool-Schlüssel, eigener Frame-Port.
  const key = ndiPoolKey(info.guestId, info.kind === 'screen' ? 'screen' : 'cam');
  const slotKind = info.kind === 'screen' ? 'video' : info.kind;
  const slot = pendingTracks.get(key) || {};
  slot[slotKind] = ev.track;
  pendingTracks.set(key, slot);
  // Gast-Ton zusätzlich in den Mix-Minus-Graph (6.2b) — der NDI-Pump bekommt das Original.
  // Gekapselt: scheitert der Mixer, muss der NDI-Weg des Gasts trotzdem laufen.
  if (info.kind === 'audio') {
    try {
      attachGuestAudio(info.guestId, ev.track);
    } catch (err) {
      plog('FEHLER Gast-Ton-Mixer fehlgeschlagen (NDI läuft weiter):', err);
    }
  }
  tryPump(key);
}

/** Startet die Pumpe, sobald für eine Quelle SOWOHL der Frame-Port ALS AUCH ein Track da ist. */
function tryPump(key: string): void {
  const port = guestPorts.get(key);
  const slot = pendingTracks.get(key);
  if (!port || !slot) return;
  if (slot.video && !pumping.has(`${key}:video`)) {
    pumping.add(`${key}:video`);
    plog('starte Video-Pump für', key);
    void pumpVideo(key, slot.video);
  }
  if (slot.audio && !pumping.has(`${key}:audio`)) {
    pumping.add(`${key}:audio`);
    void pumpAudio(key, slot.audio);
  }
}

function stopGuest(guestId: string): void {
  const screen = ndiPoolKey(guestId, 'screen');
  for (const key of [guestId, screen]) {
    pendingTracks.delete(key);
    pumping.delete(`${key}:video`);
    pumping.delete(`${key}:audio`);
  }
  subscribeTries.delete(guestId);
  publishedNames.delete(guestId);
  subscribedNames.delete(guestId);
  inflightNames.delete(guestId);
  // Aus dem Mix-Minus-Graph entfernen; die übrigen Gäste werden neu verdrahtet.
  const g = guestGain.get(guestId);
  if (g) {
    try {
      g.disconnect();
    } catch {
      /* egal */
    }
    guestGain.delete(guestId);
  }
  const dest = returnDest.get(guestId);
  if (dest) {
    try {
      dest.disconnect();
    } catch {
      /* egal */
    }
    returnDest.delete(guestId);
  }
  const tb = talkbackGain.get(guestId);
  if (tb) {
    try {
      talkbackSource?.disconnect(tb);
      tb.disconnect();
    } catch {
      /* egal */
    }
    talkbackGain.delete(guestId);
  }
  returnPublished.delete(guestId);
  rebuildMixMinus();
}

async function pumpVideo(key: string, track: MediaStreamTrack, targetFps = 25): Promise<void> {
  const port = guestPorts.get(key);
  if (!port) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new (window as any).MediaStreamTrackProcessor({ track });
  const reader: ReadableStreamDefaultReader<VideoFrame> = proc.readable.getReader();
  const minInterval = 1000 / targetFps;
  let last = 0;
  let frames = 0;

  // Ein REMOTE-Track wird `muted`, sobald keine Medien mehr eintreffen. Zusammen mit
  // `document.hidden` trennt das die beiden Ursachen eines eingefrorenen Bilds sauber: liefert
  // der Gast (bzw. die SFU) nichts mehr — oder drosselt Chromium unseren versteckten Renderer?
  // Ohne diese Unterscheidung bleibt nur Raten; der Peer hat keine sichtbare Konsole.
  track.addEventListener('mute', () => plog(key, '⚠ Video-Track stumm — keine Medien mehr von der SFU.'));
  track.addEventListener('unmute', () => plog(key, 'Video-Track liefert wieder.'));
  let lastRead = Date.now();
  const stall = setInterval(() => {
    const idle = Date.now() - lastRead;
    if (idle < 3000) return;
    plog(
      key,
      `⚠ Video-Pumpe steht seit ${Math.round(idle / 1000)} s — Frames=${frames}, readyState=${track.readyState},`,
      `muted=${track.muted}, enabled=${track.enabled}, seiteVerborgen=${document.hidden}`,
    );
  }, 3000);

  try {
    for (;;) {
      const { value: frame, done } = await reader.read();
      lastRead = Date.now();
      if (done) break;
      if (!frame) continue;
      try {
        const now = performance.now();
        if (now - last >= minInterval - 1) {
          last = now;
          const b = await videoFrameToBgra(frame);
          port.postMessage({ type: 'video', buffer: b.buffer, w: b.width, h: b.height, fpsN: targetFps });
          if (++frames % 50 === 0) plog(key, 'Video-Frames:', frames);
        }
      } finally {
        frame.close();
      }
    }
  } catch (e) {
    // Bisher riss ein Fehler hier die Pumpe lautlos ab (der Aufrufer macht `void pumpVideo(…)`).
    plog(key, 'Video-Pumpe abgebrochen:', e instanceof Error ? e.message : String(e));
  } finally {
    clearInterval(stall);
    pumping.delete(`${key}:video`);
    // Beendeter Track (Gast hat das Teilen gestoppt) darf nicht als „bereit" liegen bleiben —
    // sonst startete tryPump beim nächsten Frame-Port eine Pumpe auf einem toten Track.
    releaseTrack(key, 'video', track);
  }
}

/** Einen beendeten Track aus dem Slot nehmen, falls dort noch genau dieser steht. */
function releaseTrack(key: string, kind: 'video' | 'audio', track: MediaStreamTrack): void {
  const slot = pendingTracks.get(key);
  if (slot && slot[kind] === track) delete slot[kind];
}

async function pumpAudio(key: string, track: MediaStreamTrack): Promise<void> {
  const port = guestPorts.get(key);
  if (!port) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new (window as any).MediaStreamTrackProcessor({ track });
  const reader: ReadableStreamDefaultReader<AudioData> = proc.readable.getReader();

  // Gegenprobe zum Video: ein Handy-Browser hält im Hintergrund die KAMERA an, das Mikrofon läuft
  // weiter. Stumme Kamera bei laufendem Ton heißt also „Gast weggewischt"; sind beide stumm, ist
  // die SFU-Session des Gasts gestorben. Ohne diese Asymmetrie lässt sich das nicht unterscheiden.
  track.addEventListener('mute', () => plog(key, '⚠ Audio-Track stumm — keine Medien mehr von der SFU.'));
  track.addEventListener('unmute', () => plog(key, 'Audio-Track liefert wieder.'));
  let chunks = 0;

  try {
    for (;;) {
      const { value: data, done } = await reader.read();
      if (done) break;
      if (!data) continue;
      try {
        const a = await audioDataToFltp(data);
        port.postMessage({ type: 'audio', buffer: a.buffer, ch: a.ch, n: a.n, sr: a.sr });
        if (++chunks % 500 === 0) plog(key, 'Audio-Pakete:', chunks);
      } finally {
        data.close();
      }
    }
  } catch (e) {
    plog(key, 'Audio-Pumpe abgebrochen:', e instanceof Error ? e.message : String(e));
  } finally {
    pumping.delete(`${key}:audio`);
    releaseTrack(key, 'audio', track);
  }
}

// ── Rückkanal 6.2a: Programm-NDI → program-video an die SFU ──────────────────────────────────
function setupProgramGenerator(): void {
  if (programGen) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Gen = (window as any).MediaStreamTrackGenerator;
  if (!Gen) {
    plog('FEHLER MediaStreamTrackGenerator nicht verfügbar — Return-Video nicht möglich');
    return;
  }
  programGen = new Gen({ kind: 'video' });
  programWriter = programGen.writable.getWriter();
  programTrack = programGen as MediaStreamTrack; // Generator IST ein MediaStreamTrack
  plog('Programm-Generator bereit');
}

/** BGRA-Frame vom Programm-Receiver → VideoFrame → in den Generator schreiben; danach Ack. */
async function onProgramFrame(port: MessagePort, data: unknown): Promise<void> {
  const d = data as { type?: string; buffer?: ArrayBuffer; w?: number; h?: number } | null;
  if (!d || d.type !== 'video' || !d.buffer || !programWriter) {
    // Einmal laut sagen, statt still zu ackn — sonst sieht man nie, dass Frames verworfen werden.
    if (programFramesSkipped++ === 0) {
      plog('WARN Programm-Frame verworfen · type=', d?.type, '· buffer?', !!d?.buffer, '· writer?', !!programWriter);
    }
    port.postMessage({ type: 'ack' });
    return;
  }
  let frame: VideoFrame | null = null;
  try {
    frame = bgraToVideoFrame({ buffer: d.buffer, width: d.w || 0, height: d.h || 0 }, Math.round(performance.now() * 1000));
    if (programFrames === 0) plog('erstes Programm-Frame', `${d.w}x${d.h}`, '→ schreibe in den Generator …');
    // BEWUSST KEIN `await writer.ready`: solange der Generator-Track keinen Konsumenten hat (vor dem
    // Publish), bleibt desiredSize 0 und `ready` löst nie auf → kein Ack → der Receiver schickt nie
    // ein zweites Frame → der Bildweg fror ein. Unsere Ack-Backpressure lässt ohnehin nur EIN Frame
    // gleichzeitig zu, `ready` war also redundant.
    await programWriter.write(frame); // Generator übernimmt & schließt den Frame
    frame = null;
    programFrames++;
    if (programFrames === 1) {
      plog('erstes Programm-Frame geschrieben ✓ → jetzt darf program-video publiziert werden');
      maybePublishProgram();
    }
    if (programFrames % 50 === 0) plog('Programm-Frames:', programFrames);
  } catch (e) {
    if (frame) frame.close();
    plog('FEHLER Programm-Frame', e);
  } finally {
    port.postMessage({ type: 'ack' });
  }
}

function maybePublishProgram(): void {
  if (programPublished || !programTrack || !pc || !pcConnected || !peerSessionId) return;
  // ⭐ NIEMALS einen Track publishen, der noch kein einziges Paket gesendet hat. Genau das ist
  // Cloudflares `empty_track_error`: der Track existiert, liefert aber nichts — und jeder Gast,
  // der ihn über den Rückkanal zieht, holt sich eine tote Spur in seine eigene SFU-Session.
  // Läuft der Switcher (noch) nicht, gibt es kein Programmbild; der Empfänger sucht endlos weiter
  // und ruft uns hier erneut, sobald das erste Bild da ist.
  if (programFrames === 0) {
    plog('program-video noch nicht publiziert — es fließt kein Programmbild (läuft der JM Switcher?).');
    return;
  }
  programPublished = true; // optimistischer Guard gegen Doppel-Publish
  const track = programTrack;
  void serializeNego(() => publishTrack(track, PROGRAM_TRACK, () => (programPublished = false)));
}

/**
 * Einen eigenen Track auf der Peer-Session publishen (Renegotiation).
 * Der Peer bleibt zwischen createOffer und setRemoteDescription(answer) in „have-local-offer" —
 * kein Subscribe darf dazwischen. Deshalb läuft das GANZE (inkl. Warten auf die Answer) im
 * negoChain-Lock. Timeout gibt den Lock frei, falls die Answer ausbleibt.
 */
async function publishTrack(track: MediaStreamTrack, trackName: string, onFail: () => void): Promise<void> {
  if (!pc) {
    onFail();
    return;
  }
  try {
    const tx = pc.addTransceiver(track, { direction: 'sendonly' });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    plog(trackName, 'publish → mid', tx.mid);
    const answer = await new Promise<RTCSessionDescriptionInit | undefined>((resolve) => {
      const timer = setTimeout(() => {
        publishAnswerResolve = null;
        resolve(undefined);
      }, 8000);
      publishAnswerResolve = (a) => {
        clearTimeout(timer);
        resolve(a);
      };
      ws?.send({
        t: 'peerPublish',
        sessionId: peerSessionId,
        offer: { type: offer.type, sdp: offer.sdp },
        tracks: [{ mid: tx.mid, trackName }],
      });
    });
    if (answer) {
      await pc.setRemoteDescription(answer);
      plog(trackName, 'published (Answer gesetzt)');
    } else {
      onFail();
      plog('WARN', trackName, 'publish ohne Answer');
    }
  } catch (e) {
    onFail();
    plog('FEHLER publishTrack', trackName, e);
  }
}

// ── Rückkanal 6.2b: Mix-Minus-Audio ──────────────────────────────────────────────────────────

function ensureAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    // Ohne Nutzergeste startet der Context sonst 'suspended' (peer-window setzt autoplayPolicy).
    const ctx = audioCtx;
    void ctx.resume().then(
      () => plog('AudioContext', ctx.state, ctx.sampleRate, 'Hz'),
      (e) => plog('FEHLER AudioContext.resume fehlgeschlagen', e),
    );
  }
  return audioCtx;
}

/**
 * Programm-Ton (NDI) → Audio-Generator → Web-Audio-Quelle, die in JEDEN Gast-Mix fließt.
 * Scheitert etwas, bleibt `programAudioWriter` null → enqueueProgramAudio wird zum No-Op und
 * der Rest (Bild + Gast-zu-Gast-Ton) läuft unbeeinträchtigt weiter.
 */
function setupProgramAudio(): void {
  if (programAudioGen) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Gen = (window as any).MediaStreamTrackGenerator;
  if (!Gen) {
    plog('FEHLER MediaStreamTrackGenerator (audio) nicht verfügbar — kein Programm-Ton');
    return;
  }
  try {
    const gen = new Gen({ kind: 'audio' });
    const ctx = ensureAudioCtx();
    const src = ctx.createMediaStreamSource(new MediaStream([gen as MediaStreamTrack]));
    programAudioGain = ctx.createGain();
    src.connect(programAudioGain);
    programAudioGen = gen;
    programAudioWriter = gen.writable.getWriter();
    plog('Programm-Audio-Generator bereit');
  } catch (e) {
    programAudioGen = null;
    programAudioWriter = null;
    programAudioGain = null;
    plog('FEHLER Programm-Audio-Generator fehlgeschlagen — Gäste hören einander trotzdem', e);
  }
  rebuildMixMinus();
}

/** Audio-Schreibvorgänge serialisieren (Reihenfolge!) und bei Rückstau verwerfen statt zu wachsen. */
function enqueueProgramAudio(data: unknown): void {
  if (!programAudioWriter) return;
  if (audioBacklog > 20) return; // Writer kommt nicht nach → Frame fallen lassen
  audioBacklog++;
  audioWriteChain = audioWriteChain
    .then(() => writeProgramAudio(data))
    .catch(() => {})
    .finally(() => {
      audioBacklog--;
    });
}

async function writeProgramAudio(data: unknown): Promise<void> {
  const d = data as { buffer?: ArrayBuffer; ch?: number; n?: number; sr?: number } | null;
  if (!d || !d.buffer || !d.ch || !d.n || !d.sr || !programAudioWriter) return;
  let audio: AudioData | null = null;
  try {
    // Zeitstempel aus der Samplezahl ableiten → lückenlos monoton (performance.now() driftet).
    audio = fltpToAudioData({ buffer: d.buffer, ch: d.ch, n: d.n, sr: d.sr }, programAudioTsUs);
    programAudioTsUs += Math.round((d.n / d.sr) * 1e6);
    // Kein `await writer.ready` (siehe onProgramFrame) — gegen Rückstau schützt audioBacklog.
    await programAudioWriter.write(audio); // Generator übernimmt & schließt
    audio = null;
    if (++programAudioChunks === 1) plog('erster Programm-Ton-Chunk geschrieben ✓', `${d.ch}ch ${d.sr}Hz`);
  } catch (e) {
    if (audio) audio.close();
    plog('FEHLER Programm-Audio', e);
  }
}

/** Gast-Ton in den Mixer hängen. Eigener Klon: den Originaltrack konsumiert der NDI-Pump exklusiv. */
function attachGuestAudio(guestId: string, track: MediaStreamTrack): void {
  if (guestGain.has(guestId)) return;
  const ctx = ensureAudioCtx();
  const src = ctx.createMediaStreamSource(new MediaStream([track.clone()]));
  const gain = ctx.createGain();
  src.connect(gain);
  guestGain.set(guestId, gain);
  plog('Gast-Ton im Mix-Minus:', guestId);
  rebuildMixMinus();
}

/**
 * Kern des Rückkanals: `return_G = Programm + Σ(alle Gäste außer G)`.
 * Jeder Gast bekommt ein eigenes Ziel; er selbst wird NIE hineingemischt (kein Echo).
 * Bei jeder Änderung der Gästemenge komplett neu verdrahten (disconnect → nach Regel verbinden).
 */
function rebuildMixMinus(): void {
  if (!audioCtx) return;
  for (const id of guestGain.keys()) {
    if (!returnDest.has(id)) returnDest.set(id, audioCtx.createMediaStreamDestination());
    // Talkback-Gate des Gasts: hängt dauerhaft an SEINEM Ziel und wird nur über den Pegel geöffnet
    // (6.2c). Es bleibt beim Neuverdrahten unangetastet — es hängt an keiner Gästemenge.
    if (!talkbackGain.has(id)) {
      const tb = audioCtx.createGain();
      tb.gain.value = 0;
      tb.connect(returnDest.get(id)!);
      talkbackSource?.connect(tb);
      talkbackGain.set(id, tb);
    }
  }
  // Nur die Ausgänge lösen (die Quellen → Gain-Verbindungen bleiben bestehen).
  programAudioGain?.disconnect();
  for (const g of guestGain.values()) g.disconnect();

  for (const [id, dest] of returnDest) {
    programAudioGain?.connect(dest);
    for (const [otherId, gain] of guestGain) {
      if (otherId !== id) gain.connect(dest);
    }
  }
  applyTalkbackGains();
  flushReturns();
}

/**
 * Regie-Mikro erst beim ERSTEN Talkback öffnen — solange niemand spricht, ist kein Mikro offen.
 * Danach bleibt es offen: `getUserMedia` braucht 100–300 ms, und die würden jedem Tastendruck den
 * Wortanfang abschneiden. Stumm wird über die Gains geschaltet, nicht über den Track.
 */
async function ensureTalkbackMic(): Promise<boolean> {
  if (talkbackSource) return true;
  if (talkbackOpening) return false;
  talkbackOpening = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = ensureAudioCtx();
    talkbackSource = ctx.createMediaStreamSource(stream);
    for (const tb of talkbackGain.values()) talkbackSource.connect(tb);
    plog('AUDIT Talkback-Mikro geöffnet');
    return true;
  } catch (e) {
    plog('FEHLER Talkback-Mikro nicht verfügbar', e);
    return false;
  } finally {
    talkbackOpening = false;
  }
}

/** Autoritativer Talkback-Zustand des DO → Web-Audio-Gates. */
function applyTalkback(tb: { mode?: TalkbackMode; target?: string | null } | undefined): void {
  const mode = tb?.mode ?? 'off';
  const target = tb?.target ?? null;
  if (mode === talkbackMode && target === talkbackTarget) return;
  talkbackMode = mode;
  talkbackTarget = target;
  plog('AUDIT Talkback', mode, target ?? '');
  // Beim Einschalten kann das Mikro noch fehlen → nach dem Öffnen die Gates erneut setzen.
  if (mode !== 'off' && !talkbackSource) {
    void ensureTalkbackMic().then((ok) => {
      if (ok) applyTalkbackGains();
    });
  }
  applyTalkbackGains();
}

function talkbackLevel(guestId: string): number {
  if (!talkbackSource || talkbackMode === 'off') return 0;
  if (talkbackMode === 'all') return 1;
  return guestId === talkbackTarget ? 1 : 0;
}

function applyTalkbackGains(): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  // Rampe statt Sprung: ein harter Gain-Wechsel knackt hörbar im Ohr des Gasts.
  for (const [id, gain] of talkbackGain) gain.gain.setTargetAtTime(talkbackLevel(id), now, 0.015);
}

function flushReturns(): void {
  for (const id of returnDest.keys()) maybePublishReturn(id);
}

function maybePublishReturn(guestId: string): void {
  if (returnPublished.has(guestId) || !pc || !pcConnected || !peerSessionId) return;
  const track = returnDest.get(guestId)?.stream.getAudioTracks()[0];
  if (!track) return;
  returnPublished.add(guestId);
  void serializeNego(() => publishTrack(track, `return-${guestId}-audio`, () => returnPublished.delete(guestId)));
}

plog('JM Connect Peer-Renderer bereit (Welle 6.1/6.2a/6.2b/6.2c).');
