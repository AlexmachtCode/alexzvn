import { useCallback, useEffect, useRef, useState } from 'react';
import { SignallingClient } from '@jm/rtc/signalling';
import { lobbyCount, onAirGuests, standbyGuest } from '@jm/rtc/state';
import type { Guest, OperatorAction, RoomState } from '@jm/rtc/protocol';
import type { AppStatus, GuestInvite } from '@shared/types';

// Der Operator-Renderer hält die Raum-WebSocket zum ConnectRoom-DO und spiegelt dessen
// autoritativen Zustand. NDI-Effekte aus dem DO gehen per IPC an den Main (ndi-guests-Pool);
// Steuerbefehle (Companion/Rundown) kommen per IPC herein und werden an den DO relayt.

const PHASE_LABEL: Record<Guest['phase'], string> = {
  joining: 'verbindet',
  lobby: 'Warteraum',
  approved: 'freigegeben',
  onair: 'AUF SENDUNG',
  off: 'aus Sendung',
  left: 'verlassen',
  kicked: 'entfernt',
  disconnected: 'getrennt',
};

export function App(): JSX.Element {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [invite, setInvite] = useState<GuestInvite | null>(null);
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SignallingClient | null>(null);
  const openingRef = useRef(false);

  const send = useCallback((action: OperatorAction) => {
    clientRef.current?.send(action);
  }, []);

  // STATE fürs Steuerprotokoll ableiten (Companion/Rundown/Health).
  const pushControlState = useCallback((s: RoomState) => {
    const live = onAirGuests(s);
    const sb = standbyGuest(s);
    window.jmconnect.pushControlState({
      room: s.room,
      guests: s.guests.filter((g) => g.phase !== 'left' && g.phase !== 'kicked').length,
      lobby: lobbyCount(s),
      onair: live.length,
      active_label: live[0]?.name ?? '',
      standby: s.standbyId ?? '',
      standby_label: sb?.name ?? '',
      talkback: s.talkback.mode !== 'off' ? 1 : 0,
    });
  }, []);

  const handleMessage = useCallback(
    (raw: unknown) => {
      const msg = raw as { t?: string; state?: RoomState; action?: string; guestId?: string; label?: string };
      if ((msg.t === 'welcome' || msg.t === 'state') && msg.state) {
        setRoom(msg.state);
        pushControlState(msg.state);
      } else if (msg.t === 'ndi' && msg.guestId) {
        if (msg.action === 'up') window.jmconnect.ndiUp(msg.guestId, msg.label || `JM Connect – ${msg.guestId}`);
        else if (msg.action === 'down') window.jmconnect.ndiDown(msg.guestId);
      }
    },
    [pushControlState],
  );

  const openRoom = useCallback(async () => {
    // Nicht doppelt/gleichzeitig öffnen — sonst schließt ein neuer Raum die bestehende WS
    // sofort wieder (wirkt wie „Raum schließt sich von selbst") und Gäste landen verwaist.
    if (openingRef.current || clientRef.current) return;
    openingRef.current = true;
    setError(null);
    try {
      const session = await window.jmconnect.openRoom();
      const client = new SignallingClient({
        url: session.wsUrl,
        onMessage: handleMessage,
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
      });
      clientRef.current = client;
      client.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      openingRef.current = false;
    }
  }, [handleMessage]);

  const inviteGuest = useCallback(async () => {
    try {
      setInvite(await window.jmconnect.mintGuest(guestName || 'Gast'));
      setGuestName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [guestName]);

  const closeRoom = useCallback(async () => {
    clientRef.current?.close();
    clientRef.current = null;
    setConnected(false);
    setRoom(null);
    setInvite(null);
    await window.jmconnect.closeRoom();
  }, []);

  useEffect(() => {
    void window.jmconnect.getStatus().then(setStatus);
    const offStatus = window.jmconnect.onStatus(setStatus);
    // Steuerbefehle (Companion/Rundown) → Operator-Aktion an den DO relayen.
    const offCmd = window.jmconnect.onControlCommand((cmd) => {
      const guestId = cmd.args[0] ?? '';
      const map: Record<string, OperatorAction | undefined> = {
        go: { t: 'go' },
        next: { t: 'next' },
        standby: { t: 'standby', guestId },
        onair: { t: 'onair', guestId },
        off: { t: 'off', guestId },
        approve: { t: 'approve', guestId },
        kick: { t: 'kick', guestId },
        talkback: { t: 'talkback', mode: 'all' },
      };
      const action = map[cmd.verb];
      if (action) send(action);
    });
    return () => {
      offStatus();
      offCmd();
      clientRef.current?.close();
    };
  }, [send]);

  const guests = (room?.guests ?? []).filter((g) => g.phase !== 'left' && g.phase !== 'kicked');

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">JM Connect</h1>
          <p className="text-sm text-neutral-400">Remote-Zuschaltungen — Green Room</p>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <div>Steuerport {status?.controlPort ?? 8737}</div>
          <div>{connected ? '● Raum verbunden' : '○ nicht verbunden'}</div>
        </div>
      </header>

      {error && <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}

      {!status?.configured && (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-sm text-yellow-200">
          Cloud-Proxy nicht konfiguriert — <code>JMPS_PROXY_URL</code> und <code>JMPS_PROXY_KEY</code> setzen.
        </div>
      )}

      {!connected ? (
        <button
          onClick={openRoom}
          disabled={!status?.configured}
          className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-neutral-900 disabled:opacity-40"
        >
          Raum öffnen
        </button>
      ) : (
        <>
          <div className="mb-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-neutral-400">Gast einladen</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Name des Gasts"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <button onClick={inviteGuest} className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-semibold">
              Link erzeugen
            </button>
            <button onClick={closeRoom} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm">
              Raum schließen
            </button>
          </div>

          {invite && (
            <div className="mb-4 break-all rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm">
              <div className="mb-1 text-neutral-400">Join-Link für {invite.name}:</div>
              <a href={invite.joinUrl} className="text-yellow-300">{invite.joinUrl}</a>
            </div>
          )}

          <div className="mb-2 text-xs text-neutral-400">
            {guests.length} Gäste · {room ? lobbyCount(room) : 0} im Warteraum · {room ? onAirGuests(room).length : 0} auf Sendung
          </div>

          <ul className="space-y-2">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                <span className="flex-1 font-medium">{g.name}</span>
                <PhaseBadge phase={g.phase} />
                <GuestActions guest={g} send={send} />
              </li>
            ))}
            {guests.length === 0 && <li className="text-sm text-neutral-500">Noch keine Gäste — Link erzeugen und teilen.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: Guest['phase'] }): JSX.Element {
  const cls =
    phase === 'onair'
      ? 'bg-red-600 text-white'
      : phase === 'approved' || phase === 'off'
        ? 'bg-neutral-600 text-white'
        : 'bg-neutral-800 text-neutral-300';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{PHASE_LABEL[phase]}</span>;
}

function GuestActions({ guest, send }: { guest: Guest; send: (a: OperatorAction) => void }): JSX.Element {
  const btn = 'rounded px-2 py-1 text-xs font-semibold';
  if (guest.phase === 'lobby') {
    return (
      <div className="flex gap-1">
        <button className={`${btn} bg-green-700 text-white`} onClick={() => send({ t: 'approve', guestId: guest.id })}>Freigeben</button>
        <button className={`${btn} bg-neutral-700`} onClick={() => send({ t: 'deny', guestId: guest.id })}>Ablehnen</button>
      </div>
    );
  }
  if (guest.phase === 'onair') {
    return (
      <div className="flex gap-1">
        <button className={`${btn} bg-neutral-700`} onClick={() => send({ t: 'off', guestId: guest.id })}>Aus Sendung</button>
        <button className={`${btn} bg-red-800 text-white`} onClick={() => send({ t: 'kick', guestId: guest.id })}>Entfernen</button>
      </div>
    );
  }
  if (guest.phase === 'approved' || guest.phase === 'off') {
    return (
      <div className="flex gap-1">
        <button className={`${btn} bg-red-600 text-white`} onClick={() => send({ t: 'onair', guestId: guest.id })}>Auf Sendung</button>
        <button className={`${btn} bg-neutral-700`} onClick={() => send({ t: 'standby', guestId: guest.id })}>Standby</button>
        <button className={`${btn} bg-red-800 text-white`} onClick={() => send({ t: 'kick', guestId: guest.id })}>Entfernen</button>
      </div>
    );
  }
  return <span />;
}
