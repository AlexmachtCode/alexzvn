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
import { audioDataToFltp, videoFrameToBgra } from '@jm/rtc/frames';
import { PEER_CONNECT, PEER_FRAME_PORT } from '@shared/ipc';

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

window.addEventListener('message', (e: MessageEvent) => {
  const d = e.data as { ch?: string; guestId?: string; wsUrl?: string; iceUrl?: string } | null;
  if (!d) return;
  if (d.ch === PEER_FRAME_PORT && d.guestId) {
    const port = e.ports[0];
    if (!port) return;
    port.start();
    guestPorts.set(d.guestId, port);
    tryPump(d.guestId);
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
  pc = new RTCPeerConnection({ iceServers: ice.iceServers || [] });
  pc.ontrack = onTrack;
  pc.oniceconnectionstatechange = () => {
    const st = pc?.iceConnectionState;
    console.log('[peer] ICE:', st);
    if (st === 'connected' || st === 'completed') {
      pcConnected = true;
      flushSubscribe();
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
  } else if (m.t === 'guestPublished' && m.guestId) {
    console.log('[peer] guestPublished', m.guestId);
    maybeSubscribe(m.guestId);
  } else if (m.t === 'subscribeOffer' && m.guestId && m.sdp) {
    console.log('[peer] subscribeOffer', m.guestId, m.tracks);
    void onSubscribeOffer(m.guestId, m.sdp, m.tracks || []);
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

console.log('[peer] JM Connect Peer-Renderer bereit (Welle 6.1).');
