import { useCallback, useEffect, useRef, useState } from 'react';
import { SignallingClient } from '@jm/rtc/signalling';
import { lobbyCount, onAirGuests, standbyGuest } from '@jm/rtc/state';
import { ndiPoolKey } from '@jm/rtc/protocol';
import type { Guest, OperatorAction, RoomState } from '@jm/rtc/protocol';
import type { AppStatus, GuestInvite, ProxyKeySource, ShowInfo } from '@shared/types';
import { toDataUrl } from '@/lib/qr';

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
  const [invites, setInvites] = useState<GuestInvite[]>([]);
  const [guestName, setGuestName] = useState('');
  const [show, setShow] = useState<ShowInfo | null>(null);
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
      const msg = raw as {
        t?: string;
        state?: RoomState;
        action?: string;
        guestId?: string;
        label?: string;
        stream?: string;
        kind?: string;
        dir?: 'next' | 'prev';
      };
      if ((msg.t === 'welcome' || msg.t === 'state') && msg.state) {
        setRoom(msg.state);
        roomRef.current = msg.state;
        pushControlState(msg.state);
      } else if (msg.t === 'cue' && msg.kind === 'slide' && msg.dir) {
        // Der DO hat die Freigabe des Gasts geprüft; hier nur noch an den Presenter im LAN weiter.
        window.jmconnect.slideCue(msg.dir, msg.guestId ?? '');
      } else if (msg.t === 'ndi' && msg.guestId) {
        // Kamera und geteilter Bildschirm sind zwei getrennte NDI-Quellen desselben Gasts (6.3).
        const key = ndiPoolKey(msg.guestId, msg.stream === 'screen' ? 'screen' : 'cam');
        if (msg.action === 'up') window.jmconnect.ndiUp(key, msg.label || `JM Connect – ${msg.guestId}`);
        else if (msg.action === 'down') window.jmconnect.ndiDown(key);
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
      // Eine geöffnete Show gibt den Raum vor (deterministisch) → vorab verteilte Join-Links
      // bleiben gültig, weil das Secret zu dieser Raum-ID gespeichert ist.
      const session = await window.jmconnect.openRoom(show?.room);
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
  }, [handleMessage, show?.room]);

  const inviteGuest = useCallback(async () => {
    try {
      const invite = await window.jmconnect.mintGuest(guestName || 'Gast');
      setInvites((prev) => [...prev, invite]);
      setGuestName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [guestName]);

  /** iveo-Provisionierung: je Sprecher der Veranstaltung ein Join-Link. Bereits eingeladene übergehen. */
  const inviteSpeakers = useCallback(async () => {
    if (!show) return;
    const already = new Set(invites.map((i) => i.name));
    const names = show.speakers.map((s) => s.name).filter((n) => !already.has(n));
    if (!names.length) return;
    try {
      const fresh = await window.jmconnect.mintGuests(names);
      setInvites((prev) => [...prev, ...fresh]);
      window.jmconnect.audit('provision', `${fresh.length} Join-Links aus „${show.name}" erzeugt`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [show, invites]);

  const closeRoom = useCallback(async () => {
    clientRef.current?.close();
    clientRef.current = null;
    setConnected(false);
    setRoom(null);
    // Der Raum wird geschlossen und das Secret rotiert — alle erzeugten Links sind damit tot.
    setInvites([]);
    await window.jmconnect.closeRoom();
  }, []);

  useEffect(() => {
    void window.jmconnect.getStatus().then(setStatus);
    // Der Show-Deep-Link kann vor dem Fenster eingetroffen sein → einmal abrufen UND abonnieren.
    void window.jmconnect.getShow().then(setShow);
    const offShow = window.jmconnect.onShow(setShow);
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
      // `CONNECT SLIDES <gast> [on|off|toggle]` — der Modus ist das ZWEITE Argument (Default toggle).
      if (cmd.verb === 'slides') {
        const arg = (cmd.args[1] ?? 'toggle').toLowerCase();
        const cur = roomRef.current?.guests.find((g) => g.id === guestId)?.canAdvance ?? false;
        const on = arg === 'on' ? true : arg === 'off' ? false : !cur;
        send({ t: 'slides', guestId, on });
        window.jmconnect.audit('slides', `${on ? 'erteilt' : 'entzogen'} für ${guestId} (Steuerprotokoll)`);
        return;
      }
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
      offShow();
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

      <ProxyCard configured={!!status?.configured} keySource={status?.proxyKeySource ?? 'none'} />

      {show && <ShowCard show={show} connected={connected} invited={invites.length} onInvite={inviteSpeakers} />}

      {!connected ? (
        <button
          onClick={openRoom}
          disabled={!status?.configured}
          className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-neutral-900 disabled:opacity-40"
        >
          {show ? `Raum „${show.room}" öffnen` : 'Raum öffnen'}
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

          {invites.length > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {invites.map((i) => (
                <InviteCard key={i.guestId} invite={i} />
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
            <span>
              {guests.length} Gäste · {room ? lobbyCount(room) : 0} im Warteraum · {room ? onAirGuests(room).length : 0} auf Sendung
            </span>
            <div className="flex items-center gap-2">
              {status?.presenterLinked && (
                <span className="rounded-full bg-sky-900 px-2 py-0.5 font-semibold text-sky-200">📊 Presenter</span>
              )}
              <ProgramBadge status={status} />
            </div>
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
                {g.hasScreen && (
                  <span
                    title={`Teilt seinen Bildschirm — eigene NDI-Quelle „JM Connect – ${g.name} (Bildschirm)"`}
                    className="rounded-full bg-sky-900 px-2 py-0.5 text-xs font-semibold text-sky-200"
                  >
                    🖥 Bildschirm
                  </span>
                )}
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
                {canHearTalkback(g) && (
                  <button
                    onClick={() => {
                      send({ t: 'slides', guestId: g.id, on: !g.canAdvance });
                      window.jmconnect.audit('slides', `${g.canAdvance ? 'entzogen' : 'erteilt'} für ${g.name}`);
                    }}
                    title={
                      status?.presenterLinked
                        ? 'Der Gast darf die Folien im JM Presenter selbst weiterblättern'
                        : 'Kein JM Presenter im Netz gefunden — der Cue liefe ins Leere'
                    }
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      g.canAdvance ? 'bg-sky-600 text-white' : 'bg-neutral-700 text-neutral-200'
                    }`}
                  >
                    📊
                  </button>
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

/**
 * Die aus dem Launcher geöffnete Veranstaltung. Die Sprecher stammen token-frei aus iveo; die
 * Join-Token entstehen erst hier im Main aus dem Raum-Secret — nie in der Show-Datei.
 */
const KEY_HINT: Record<ProxyKeySource, string> = {
  none: 'Ohne Key lässt sich kein Raum öffnen.',
  stored: 'Hinterlegt — verschlüsselt gespeichert.',
  session: 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.',
  env: 'Kommt aus der Umgebungsvariablen JMPS_PROXY_KEY und hat Vorrang.',
};

const INP = 'w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100';

/**
 * Adresse des Suite-Proxys + sein Zugriffs-Key. Der Key geht in den Main und kommt nie zurück —
 * die Oberfläche kennt nur seine Herkunft. Muster: apps/qa Settings.tsx.
 */
function ProxyCard({ configured, keySource }: { configured: boolean; keySource: ProxyKeySource }): JSX.Element {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [open, setOpen] = useState(!configured);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.jmconnect.getProxy().then((p) => setUrl(p.url));
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      // Den Key NUR mitschicken, wenn wirklich einer getippt wurde — sonst löschte ein
      // reiner Adress-Wechsel den hinterlegten Key (das Feld ist nach dem Speichern leer).
      const p = await window.jmconnect.setProxy(key.trim() ? { url, key } : { url });
      setUrl(p.url);
      setKey('');
      if (p.configured) setOpen(false);
    } finally {
      setBusy(false);
    }
  }, [url, key]);

  const dropKey = useCallback(async () => {
    await window.jmconnect.setProxy({ key: '' });
    setKey('');
  }, []);

  if (!open) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
        <span className="truncate">
          Cloud-Zugang: <code className="text-neutral-300">{url}</code> · {KEY_HINT[keySource]}
        </span>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-800"
        >
          ändern
        </button>
      </div>
    );
  }

  return (
    <div
      className={`mb-4 rounded-lg border p-3 ${configured ? 'border-neutral-700 bg-neutral-900' : 'border-yellow-800 bg-yellow-950/30'}`}
    >
      <div className="mb-1 text-sm font-semibold text-neutral-100">Cloud-Zugang</div>
      <p className="mb-3 text-xs text-neutral-400">
        Adresse des Suite-Proxys und sein Zugriffs-Key. Beides bleibt auf diesem Rechner; der Key wird
        verschlüsselt abgelegt und nie an die Oberfläche zurückgegeben.
      </p>

      <label className="mb-1 block text-xs text-neutral-400">Adresse</label>
      <input className={`${INP} mb-3`} placeholder="https://…workers.dev" value={url} onChange={(e) => setUrl(e.target.value)} />

      <label className="mb-1 block text-xs text-neutral-400">Proxy-Key</label>
      <input
        className={`${INP} mb-1`}
        type="password"
        autoComplete="off"
        disabled={keySource === 'env'}
        placeholder={keySource === 'none' ? 'Key' : '•••••• (ändern)'}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy) void save();
        }}
      />
      <div className="mb-3 text-[11px] text-neutral-500">{KEY_HINT[keySource]}</div>

      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={busy || (!key.trim() && keySource === 'none')}
          className="rounded bg-yellow-400 px-3 py-1 text-sm font-semibold text-neutral-900 disabled:opacity-40"
        >
          Speichern
        </button>
        {(keySource === 'stored' || keySource === 'session') && (
          <button
            onClick={() => void dropKey()}
            className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Key entfernen
          </button>
        )}
        {configured && (
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Schließen
          </button>
        )}
      </div>
    </div>
  );
}

function ShowCard({
  show,
  connected,
  invited,
  onInvite,
}: {
  show: ShowInfo;
  connected: boolean;
  invited: number;
  onInvite: () => void;
}): JSX.Element {
  const open = show.speakers.length - invited;
  return (
    <div className="mb-4 rounded-lg border border-neutral-700 bg-neutral-900 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{show.eventName ?? show.name}</div>
          <div className="text-xs text-neutral-400">
            {show.speakers.length} Sprecher aus iveo · Raum <code className="text-neutral-300">{show.room}</code>
          </div>
        </div>
        <button
          onClick={onInvite}
          disabled={!connected || show.speakers.length === 0 || open <= 0}
          title={!connected ? 'Erst den Raum öffnen' : undefined}
          className="shrink-0 rounded-lg bg-neutral-700 px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          {open > 0 ? `${open} Sprecher einladen` : 'Alle eingeladen'}
        </button>
      </div>
      {show.speakers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {show.speakers.map((s) => (
            <span key={s.name} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
              {s.name}
              {s.title && <span className="text-neutral-500"> · {s.title}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ein fertiger Join-Link: als QR zum Abfotografieren und als Text zum Verschicken. */
function InviteCard({ invite }: { invite: GuestInvite }): JSX.Element {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void toDataUrl(invite.joinUrl).then((d) => alive && setQr(d));
    return () => {
      alive = false;
    };
  }, [invite.joinUrl]);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(invite.joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [invite.joinUrl]);

  return (
    <div className="flex gap-3 rounded-lg border border-neutral-700 bg-neutral-900 p-3">
      {qr && <img src={qr} alt="" width={96} height={96} className="h-24 w-24 shrink-0 rounded bg-white p-1" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{invite.name}</div>
        <div className="mt-1 break-all text-xs text-neutral-500">{invite.joinUrl}</div>
        <button onClick={copy} className="mt-2 rounded bg-neutral-700 px-2 py-1 text-xs font-semibold">
          {copied ? 'Kopiert ✓' : 'Link kopieren'}
        </button>
      </div>
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
