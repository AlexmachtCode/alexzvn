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
  // Der Steuerbefehl-Handler wird EINMAL registriert und darf nicht an `room` hängen (sonst
  // ab-/neu-abonniert er bei jedem Zustands-Broadcast). `talkback toggle` braucht aber den
  // aktuellen Zustand → über einen Ref lesen.
  const roomRef = useRef<RoomState | null>(null);

  const send = useCallback((action: OperatorAction) => {
    clientRef.current?.send(action);
  }, []);

  // Talkback ist „Halten zum Sprechen": Taste unten → Mikro auf, Taste los → zu.
  // `target: null` spricht ALLE Gäste an, sonst nur den einen. Der DO ist autoritativ; der
  // versteckte Peer folgt seinem Broadcast und schaltet den Web-Audio-Gate.
  const talkbackDown = useCallback(
    (target: string | null) => {
      send({ t: 'talkback', mode: target ? 'selected' : 'all', target });
      window.jmconnect.audit('talkback', `an → ${target ?? 'alle Gäste'} (Bedienfeld)`);
    },
    [send],
  );
  const talkbackUp = useCallback(() => {
    send({ t: 'talkback', mode: 'off', target: null });
    window.jmconnect.audit('talkback', 'aus (Bedienfeld)');
  }, [send]);

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
        roomRef.current = msg.state;
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
      // `talkback` trägt als Argument den Modus (on|off|toggle), NICHT eine Gast-ID — und muss den
      // aktuellen Zustand kennen. Bisher schaltete jeder talkback-Befehl (auch `off`) das Mikro AN.
      if (cmd.verb === 'talkback') {
        const arg = (cmd.args[0] ?? 'toggle').toLowerCase();
        const on = arg === 'on' ? true : arg === 'off' ? false : (roomRef.current?.talkback.mode ?? 'off') === 'off';
        send({ t: 'talkback', mode: on ? 'all' : 'off', target: null });
        window.jmconnect.audit('talkback', `${on ? 'an → alle Gäste' : 'aus'} (Steuerprotokoll)`);
        return;
      }
      const guestId = cmd.args[0] ?? '';
      const map: Record<string, OperatorAction | undefined> = {
        go: { t: 'go' },
        next: { t: 'next' },
        standby: { t: 'standby', guestId },
        onair: { t: 'onair', guestId },
        off: { t: 'off', guestId },
        approve: { t: 'approve', guestId },
        kick: { t: 'kick', guestId },
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
  const talkback = room?.talkback ?? { mode: 'off' as const, target: null };

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

          <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
            <span>
              {guests.length} Gäste · {room ? lobbyCount(room) : 0} im Warteraum · {room ? onAirGuests(room).length : 0} auf Sendung
            </span>
            <ProgramBadge status={status} />
          </div>

          <PttButton
            onDown={() => talkbackDown(null)}
            onUp={talkbackUp}
            active={talkback.mode === 'all'}
            className="mb-3 w-full py-3 text-sm"
            label={talkback.mode === 'all' ? '🎙 Regie spricht — alle Gäste' : '🎙 Halten zum Sprechen (alle Gäste)'}
          />

          <ul className="space-y-2">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                <span className="flex-1 font-medium">{g.name}</span>
                {canHearTalkback(g) && (
                  <PttButton
                    onDown={() => talkbackDown(g.id)}
                    onUp={talkbackUp}
                    active={talkback.mode === 'selected' && talkback.target === g.id}
                    className="px-2 py-1 text-xs"
                    label="🎙"
                    title={`Halten: nur ${g.name} hört die Regie`}
                  />
                )}
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

/** Nur wer einen Rückkanal hat, kann die Regie hören (Mix-Minus-Bus entsteht erst ab „freigegeben"). */
function canHearTalkback(g: Guest): boolean {
  return g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off';
}

/**
 * Halten zum Sprechen. Der Zeiger wird eingefangen (`setPointerCapture`), damit das Loslassen
 * auch dann auf dem Knopf ankommt, wenn die Maus dabei längst woanders ist — sonst bliebe das
 * Regie-Mikro offen, ohne dass es jemand merkt.
 */
function PttButton({
  label,
  title,
  active,
  className,
  onDown,
  onUp,
}: {
  label: string;
  title?: string;
  active: boolean;
  className: string;
  onDown: () => void;
  onUp: () => void;
}): JSX.Element {
  return (
    <button
      title={title}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={`select-none rounded-lg font-semibold transition-colors ${
        active ? 'bg-yellow-400 text-neutral-900' : 'bg-neutral-700 text-neutral-100 hover:bg-neutral-600'
      } ${className}`}
    >
      {label}
    </button>
  );
}

function ProgramBadge({ status }: { status: AppStatus | null }): JSX.Element {
  const state = status?.programState ?? 'off';
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: `Programm ● ${status?.programSource ?? ''}`.trim(), cls: 'bg-green-800 text-green-100' },
    searching: { label: 'Programm sucht …', cls: 'bg-yellow-900 text-yellow-200' },
    notfound: { label: 'Programm: keine Quelle', cls: 'bg-neutral-800 text-neutral-400' },
    error: { label: 'Programm: Fehler', cls: 'bg-red-900 text-red-200' },
  };
  const m = map[state];
  if (!m) return <span />;
  return <span className={`max-w-[60%] truncate rounded-full px-2 py-0.5 font-semibold ${m.cls}`}>{m.label}</span>;
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
