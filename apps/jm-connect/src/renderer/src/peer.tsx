// Versteckter WebRTC-Peer-Renderer (Chromium-WebRTC). Welle 6.1: zieht die von den Gästen bei
// der SFU veröffentlichten Tracks, dekodiert sie per WebCodecs zu BGRA/FLTP und postet sie je Gast
// auf den vom Main übergebenen Frame-Port → NDI-Gäste-Pool → erscheint automatisch im Switcher.
//
// Das App-Secret der SFU bleibt serverseitig: der Peer spricht die SFU NUR über den ConnectRoom-DO.
// WICHTIG (CF Realtime): eine reine EMPFÄNGER-Session hat erst dann einen Transport, wenn ein
// Offer/Answer ausgetauscht wurde. Deshalb etabliert der Peer seine PeerConnection ZUERST über
// einen Data-Channel-Offer an /sessions/new (Answer zurück) und zieht Tracks erst NACH ICE-connected
// (sonst: „Session appears to be disconnected"). Track→Gast läuft über die Transceiver-mid.
import { SignallingClient } from '@jm/rtc/signalling';
import { audioDataToFltp, bgraToVideoFrame, videoFrameToBgra } from '@jm/rtc/frames';
import { PEER_CONNECT, PEER_FRAME_PORT, PEER_PROGRAM_PORT } from '@shared/ipc';

type Kind = 'video' | 'audio';

const guestPorts = new Map<string, MessagePort>(); // Gast → Frame-Port (Main → NDI-Utility)
const midMap = new Map<string, { guestId: string; kind: Kind }>(); // Transceiver-mid → Gast/Art
const pendingTracks = new Map<string, { video?: MediaStreamTrack; audio?: MediaStreamTrack }>();
const pumping = new Set<string>(); // `${guestId}:${kind}` — läuft bereits
const wantSubscribe = new Set<string>(); // guestPublished vor Transport-ready → nachholen

let ws: SignallingClient | null = null;
let pc: RTCPeerConnection | null = null;
let peerSessionId: string | null = null;
let pcConnected = false;

// ── Rückkanal (Welle 6.2a): Programm-NDI → EIN geteilter `program-video`-Track an die SFU ──
const PROGRAM_TRACK = 'program-video';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let programGen: any = null; // MediaStreamTrackGenerator (nicht in lib.dom typisiert)
let programWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;
let programTrack: MediaStreamTrack | null = null;
let programPublished = false;
let programFrames = 0;
let programAnswerResolve: ((a: RTCSessionDescriptionInit | undefined) => void) | null = null;

// Alle Aushandlungen auf der EINEN Peer-PeerConnection serialisieren (Publish vs. Subscribe teilen
// sich den SDP-Zustandsautomaten → sonst Glare: „have-local-offer"-Kollision). Kette rejectet nie.
let negoChain: Promise<void> = Promise.resolve();
function serializeNego(fn: () => Promise<void>): Promise<void> {
  const run = negoChain.then(fn, fn);
  negoChain = run.catch(() => {});
  return run;
}

window.addEventListener('message', (e: MessageEvent) => {
  const d = e.data as { ch?: string; guestId?: string; wsUrl?: string; iceUrl?: string } | null;
  if (!d) return;
  if (d.ch === PEER_FRAME_PORT && d.guestId) {
    const port = e.ports[0];
    if (!port) return;
    port.start();
    guestPorts.set(d.guestId, port);
    tryPump(d.guestId);
  } else if (d.ch === PEER_PROGRAM_PORT) {
    const port = e.ports[0];
    if (!port) return;
    port.start();
    setupProgramGenerator();
    port.onmessage = (ev) => void onProgramFrame(port, ev.data);
    maybePublishProgram();
  } else if (d.ch === PEER_CONNECT && d.wsUrl && d.iceUrl) {
    void connect(d.wsUrl, d.iceUrl);
  }
});

async function connect(wsUrl: string, iceUrl: string): Promise<void> {
  const ice = await fetch(iceUrl)
    .then((r) => r.json())
    .catch(() => ({ iceServers: [] as RTCIceServer[] }));
  pc?.close();
  pcConnected = false;
  peerSessionId = null;
  programPublished = false; // neue PeerConnection → program-video erneut publishen
  pc = new RTCPeerConnection({ iceServers: ice.iceServers || [] });
  pc.ontrack = onTrack;
  pc.oniceconnectionstatechange = () => {
    const st = pc?.iceConnectionState;
    console.log('[peer] ICE:', st);
    if (st === 'connected' || st === 'completed') {
      pcConnected = true;
      flushSubscribe();
      maybePublishProgram();
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
      console.log('[peer] WS offen → peerSession (mit Transport-Offer)');
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
    tracks?: { mid: string; kind: Kind }[];
    code?: string;
  };
  if (m.t === 'peerSession' && m.sessionId) {
    peerSessionId = m.sessionId;
    console.log('[peer] SFU-Session', m.sessionId, '· Answer?', !!m.answer);
    void applyTransportAnswer(m.answer);
  } else if (m.t === 'peerPublished') {
    // Answer auf unseren program-video-Publish (Rückkanal). Löst das im Nego-Lock wartende
    // publishProgram() auf, das die Answer selbst anwendet (Zustandsautomat bleibt konsistent).
    console.log('[peer] peerPublished · Answer?', !!m.answer);
    programAnswerResolve?.(m.answer);
    programAnswerResolve = null;
  } else if (m.t === 'guestPublished' && m.guestId) {
    console.log('[peer] guestPublished', m.guestId);
    maybeSubscribe(m.guestId);
  } else if (m.t === 'subscribeOffer' && m.guestId && m.sdp) {
    console.log('[peer] subscribeOffer', m.guestId, m.tracks);
    const guestId = m.guestId;
    const sdp = m.sdp;
    const tracks = m.tracks || [];
    void serializeNego(() => onSubscribeOffer(guestId, sdp, tracks));
  } else if (m.t === 'guestUnpublished' && m.guestId) {
    stopGuest(m.guestId);
  } else if (m.t === 'error') {
    console.warn('[peer] DO-Fehler:', m.code);
  }
}

async function applyTransportAnswer(answer?: RTCSessionDescriptionInit): Promise<void> {
  if (!answer || !pc) return;
  try {
    await pc.setRemoteDescription(answer);
    console.log('[peer] Transport-Answer gesetzt → warte auf ICE');
  } catch (e) {
    console.error('[peer] setRemoteDescription(answer) fehlgeschlagen', e);
  }
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
  console.log('[peer] subscribe', guestId, '(session', peerSessionId, ')');
  ws?.send({ t: 'subscribe', sessionId: peerSessionId, guestId });
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
    ws?.send({ t: 'renegotiate', sessionId: peerSessionId, sdp: { type: answer.type, sdp: answer.sdp } });
    console.log('[peer] renegotiate gesendet für', guestId);
  } catch (e) {
    console.error('[peer] onSubscribeOffer fehlgeschlagen', e);
  }
}

function onTrack(ev: RTCTrackEvent): void {
  const mid = ev.transceiver.mid || '';
  const info = midMap.get(mid);
  console.log('[peer] ontrack mid=', mid, '→', info, 'kind=', ev.track.kind);
  if (!info) return;
  const slot = pendingTracks.get(info.guestId) || {};
  slot[info.kind] = ev.track;
  pendingTracks.set(info.guestId, slot);
  tryPump(info.guestId);
}

/** Startet die Pumpe, sobald für einen Gast SOWOHL der Frame-Port ALS AUCH ein Track da ist. */
function tryPump(guestId: string): void {
  const port = guestPorts.get(guestId);
  const slot = pendingTracks.get(guestId);
  if (!port || !slot) return;
  if (slot.video && !pumping.has(`${guestId}:video`)) {
    pumping.add(`${guestId}:video`);
    console.log('[peer] starte Video-Pump für', guestId);
    void pumpVideo(guestId, slot.video);
  }
  if (slot.audio && !pumping.has(`${guestId}:audio`)) {
    pumping.add(`${guestId}:audio`);
    void pumpAudio(guestId, slot.audio);
  }
}

function stopGuest(guestId: string): void {
  pendingTracks.delete(guestId);
  pumping.delete(`${guestId}:video`);
  pumping.delete(`${guestId}:audio`);
}

async function pumpVideo(guestId: string, track: MediaStreamTrack, targetFps = 25): Promise<void> {
  const port = guestPorts.get(guestId);
  if (!port) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new (window as any).MediaStreamTrackProcessor({ track });
  const reader: ReadableStreamDefaultReader<VideoFrame> = proc.readable.getReader();
  const minInterval = 1000 / targetFps;
  let last = 0;
  let frames = 0;
  try {
    for (;;) {
      const { value: frame, done } = await reader.read();
      if (done) break;
      if (!frame) continue;
      try {
        const now = performance.now();
        if (now - last >= minInterval - 1) {
          last = now;
          const b = await videoFrameToBgra(frame);
          port.postMessage({ type: 'video', buffer: b.buffer, w: b.width, h: b.height, fpsN: targetFps });
          if (++frames % 50 === 0) console.log('[peer]', guestId, 'Video-Frames:', frames);
        }
      } finally {
        frame.close();
      }
    }
  } finally {
    pumping.delete(`${guestId}:video`);
  }
}

async function pumpAudio(guestId: string, track: MediaStreamTrack): Promise<void> {
  const port = guestPorts.get(guestId);
  if (!port) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new (window as any).MediaStreamTrackProcessor({ track });
  const reader: ReadableStreamDefaultReader<AudioData> = proc.readable.getReader();
  try {
    for (;;) {
      const { value: data, done } = await reader.read();
      if (done) break;
      if (!data) continue;
      try {
        const a = await audioDataToFltp(data);
        port.postMessage({ type: 'audio', buffer: a.buffer, ch: a.ch, n: a.n, sr: a.sr });
      } finally {
        data.close();
      }
    }
  } finally {
    pumping.delete(`${guestId}:audio`);
  }
}

// ── Rückkanal 6.2a: Programm-NDI → program-video an die SFU ──────────────────────────────────
function setupProgramGenerator(): void {
  if (programGen) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Gen = (window as any).MediaStreamTrackGenerator;
  if (!Gen) {
    console.error('[peer] MediaStreamTrackGenerator nicht verfügbar — Return-Video nicht möglich');
    return;
  }
  programGen = new Gen({ kind: 'video' });
  programWriter = programGen.writable.getWriter();
  programTrack = programGen as MediaStreamTrack; // Generator IST ein MediaStreamTrack
  console.log('[peer] Programm-Generator bereit');
}

/** BGRA-Frame vom Programm-Receiver → VideoFrame → in den Generator schreiben; danach Ack. */
async function onProgramFrame(port: MessagePort, data: unknown): Promise<void> {
  const d = data as { type?: string; buffer?: ArrayBuffer; w?: number; h?: number } | null;
  if (!d || d.type !== 'video' || !d.buffer || !programWriter) {
    port.postMessage({ type: 'ack' });
    return;
  }
  let frame: VideoFrame | null = null;
  try {
    frame = bgraToVideoFrame({ buffer: d.buffer, width: d.w || 0, height: d.h || 0 }, Math.round(performance.now() * 1000));
    await programWriter.ready; // Backpressure (vor Publish blockiert es → Receiver verwirft Frames)
    await programWriter.write(frame); // Generator übernimmt & schließt den Frame
    frame = null;
    if (++programFrames % 50 === 0) console.log('[peer] Programm-Frames:', programFrames);
  } catch (e) {
    if (frame) frame.close();
    console.error('[peer] Programm-Frame', e);
  } finally {
    port.postMessage({ type: 'ack' });
  }
}

function maybePublishProgram(): void {
  if (programPublished || !programTrack || !pc || !pcConnected || !peerSessionId) return;
  programPublished = true; // optimistischer Guard gegen Doppel-Publish
  void serializeNego(() => publishProgram());
}

async function publishProgram(): Promise<void> {
  if (!pc || !programTrack) {
    programPublished = false;
    return;
  }
  try {
    const tx = pc.addTransceiver(programTrack, { direction: 'sendonly' });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('[peer] program-video publish → mid', tx.mid);
    // Offer senden UND im Lock auf die Answer warten (der Peer bleibt bis dahin in
    // „have-local-offer" — kein Subscribe darf dazwischen; deshalb hier serialisiert).
    const answer = await new Promise<RTCSessionDescriptionInit | undefined>((resolve) => {
      const timer = setTimeout(() => {
        programAnswerResolve = null;
        resolve(undefined); // Timeout → Lock freigeben, damit Subscribes nicht blockieren
      }, 8000);
      programAnswerResolve = (a) => {
        clearTimeout(timer);
        resolve(a);
      };
      ws?.send({
        t: 'peerPublish',
        sessionId: peerSessionId,
        offer: { type: offer.type, sdp: offer.sdp },
        tracks: [{ mid: tx.mid, trackName: PROGRAM_TRACK }],
      });
    });
    if (answer) {
      await pc.setRemoteDescription(answer);
      console.log('[peer] program-video published (Answer gesetzt)');
    } else {
      programPublished = false;
      console.warn('[peer] program-video publish ohne Answer');
    }
  } catch (e) {
    programPublished = false;
    console.error('[peer] publishProgram', e);
  }
}

console.log('[peer] JM Connect Peer-Renderer bereit (Welle 6.1/6.2a).');
