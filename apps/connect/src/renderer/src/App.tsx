import { useCallback, useEffect, useRef, useState } from 'react';
import { SignallingClient } from '@jm/rtc/signalling';
import { lobbyCount, onAirGuests, standbyGuest } from '@jm/rtc/state';
import { ndiPoolKey } from '@jm/rtc/protocol';
import type { Guest, OperatorAction, RoomState } from '@jm/rtc/protocol';
import type { AppStatus, GuestInvite, NdiArt, NdiProgrammZustand, NdiQuelleLage, ProxyKeySource, ShowInfo } from '@shared/types';
import { bildschirmTooltip, gastAbzeichen, kopfzeileSichtbar, NDI_TEXT, programmAbzeichen, T140_NACH_MS, type Abzeichen } from '@shared/ndi-text';
import { MAC_ZEILE, zoomZeile } from '@shared/zoom-text';
import { toDataUrl } from '@/lib/qr';
import { ZoomCard } from './zoom/ZoomCard';
import { NdiLink, OeffnenKnopf } from './zoom/SlotBereich';

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
  // Der SignallingClient versucht bei Misserfolg still und endlos neu zu verbinden. Ohne diese
  // Frist stünde der Operator vor einem Fenster, das schweigt (so verschluckte die strenge CSP
  // des gepackten Builds die Raum-WebSocket komplett).
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Der Steuerbefehl-Handler wird EINMAL registriert und darf nicht an `room` hängen (sonst
  // ab-/neu-abonniert er bei jedem Zustands-Broadcast). `talkback toggle` braucht aber den
  // aktuellen Zustand → über einen Ref lesen.
  const roomRef = useRef<RoomState | null>(null);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }, []);

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
        onOpen: () => {
          clearWatchdog();
          setError(null);
          setConnected(true);
        },
        onClose: () => setConnected(false),
      });
      clientRef.current = client;
      client.connect();
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        setError(
          `Keine Verbindung zum Raum „${session.room}". Adresse und Proxy-Key prüfen — im Hintergrund wird weiter versucht.`,
        );
      }, 8000);
    } catch (e) {
      // Ohne dieses Zurücksetzen bliebe `clientRef` besetzt und jeder weitere Klick auf
      // „Raum öffnen" liefe stumm ins Leere (der Guard oben greift).
      clientRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      openingRef.current = false;
    }
  }, [clearWatchdog, handleMessage, show?.room]);

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
    clearWatchdog();
    clientRef.current?.close();
    clientRef.current = null;
    setConnected(false);
    setRoom(null);
    // Der Raum wird geschlossen und das Secret rotiert — alle erzeugten Links sind damit tot.
    setInvites([]);
    await window.jmconnect.closeRoom();
  }, [clearWatchdog]);

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
      clearWatchdog();
      clientRef.current?.close();
    };
  }, [clearWatchdog, send]);

  const guests = (room?.guests ?? []).filter((g) => g.phase !== 'left' && g.phase !== 'kicked');
  const talkback = room?.talkback ?? { mode: 'off' as const, target: null };
  // Gast-Abzeichen (Regel G, 22.5 Ort 1): je Gast Kamera und Bildschirm aus der aktuellen Lage des Mains (E53). Ohne Status
  // des Mains weiß das Fenster nichts über die Quellen und zeigt kein Abzeichen (eine Voreinstellung ist kein Messwert).
  const ndiSoll = (g: Guest): [string, NdiArt, boolean][] => [
    [g.id, 'kamera', istEingelassen(g)],
    [ndiPoolKey(g.id, 'screen'), 'bildschirm', g.hasScreen],
  ];
  const offeneQuellen = status
    ? guests.flatMap((g) => ndiSoll(g).filter(([k, , soll]) => soll && !status.ndiGaeste.some((q) => q.schluessel === k)).map(([k]) => k))
    : [];
  const ohneEintragSeit = useOhneEintragSeit(offeneQuellen);
  const gastNdi = (g: Guest): { schluessel: string; lage: NdiQuelleLage | null; abzeichen: Abzeichen | null }[] =>
    status
      ? ndiSoll(g).map(([schluessel, art, soll]) => {
          const lage = status.ndiGaeste.find((q) => q.schluessel === schluessel) ?? null;
          return {
            schluessel,
            lage,
            abzeichen: gastAbzeichen({
              lage,
              eingelassen: soll,
              ohneEintragSeitMs: lage ? null : ohneEintragSeit(schluessel),
              art,
              plattform: plattform(),
              raumverbunden: connected,
            }),
          };
        })
      : [];

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">JM Connect</h1>
          <p className="text-sm text-neutral-400">{NDI_TEXT.t145}</p>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <div>Steuerport {status?.controlPort ?? 8737}</div>
          <div>{connected ? '● Raum verbunden' : '○ Raum nicht verbunden'}</div>
          {status?.zoom && <div>{zoomZeile(status.zoom)}</div>}
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
        </>
      )}

      {/* Kopfzeile der Gästeliste (22.5 Ort 2, E53): Programm-Abzeichen, Link T133 und Grundzeile T128 stehen, sobald der
          Empfang nicht aus ist, auch ohne Raumverbindung. Die Zählung braucht die Raumverbindung. */}
      {status && kopfzeileSichtbar({ programm: status.ndiProgramm.zustand, raumverbunden: connected }) && (
        <Kopfzeile
          status={status}
          zaehlung={
            connected
              ? `${guests.length} Gäste · ${room ? lobbyCount(room) : 0} im Warteraum · ${room ? onAirGuests(room).length : 0} auf Sendung`
              : null
          }
        />
      )}

      {connected && (
        <>
          <PttButton
            onDown={() => talkbackDown(null)}
            onUp={talkbackUp}
            active={talkback.mode === 'all'}
            className="mb-3 w-full py-3 text-sm"
            label={talkback.mode === 'all' ? '🎙 Regie spricht — alle Gäste' : '🎙 Halten zum Sprechen (alle Gäste)'}
          />

          <ul className="space-y-2">
            {guests.map((g) => {
              const ndi = gastNdi(g);
              return (
                <li key={g.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex-1 font-medium">{g.name}</span>
                    {g.hasScreen && (
                      <span title={bildschirmTooltip(g.name)} className="rounded-full bg-sky-900 px-2 py-0.5 text-xs font-semibold text-sky-200">
                        🖥 Bildschirm
                      </span>
                    )}
                    {/* NDI-Abzeichen je Quelle (Regel G, 22.5 Ort 1): das Zustandswort vorn, der volle Text als title. */}
                    {ndi.map(
                      (n) =>
                        n.abzeichen && (
                          <span
                            key={n.schluessel}
                            title={titel(n.abzeichen)}
                            className={`max-w-[40%] truncate rounded-full px-2 py-0.5 text-xs font-semibold ${n.lage ? GAST_FARBE[n.lage.zustand] : 'bg-neutral-800 text-neutral-300'}`}
                          >
                            {n.abzeichen.text}
                          </span>
                        ),
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
                          // Kennung statt Name: Gastnamen gehören nicht ins Log (Spec N4b.2, L11), wie bei „slides“ per Steuerprotokoll.
                          window.jmconnect.audit('slides', `${g.canAdvance ? 'entzogen' : 'erteilt'} für ${g.id}`);
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
                  </div>
                  {/* Grundzeile T111 in gescheitert, mit „NDI neu starten“ (nicht bei keinPeer) und „Logordner öffnen“. */}
                  {ndi.map(
                    (n) =>
                      n.abzeichen?.grundzeile && (
                        <Grundzeile
                          key={n.schluessel}
                          text={n.abzeichen.grundzeile}
                          neustart={
                            n.abzeichen.knopfNeustart
                              ? { text: NDI_TEXT.t111Knopf, aus: () => void window.jmconnect.ndiNeustart({ schluessel: n.schluessel }) }
                              : null
                          }
                          logordner={n.abzeichen.knopfLogordner}
                        />
                      ),
                  )}
                </li>
              );
            })}
            {guests.length === 0 && <li className="text-sm text-neutral-500">Noch keine Gäste — Link erzeugen und teilen.</li>}
          </ul>
        </>
      )}

      {/* Zoom (Stage 4a, Spec 9): außerhalb des Raum-Zweigs, unabhängig vom Cloud-Raum (E4), nur unter Windows. Sonst steht
          an ihrer Stelle die Zeile T95 (Connect 0.4.0, Spec 7.11). */}
      {window.jmconnect.platform === 'win32' ? <ZoomCard /> : <p className="mt-6 text-xs text-neutral-500">{MAC_ZEILE}</p>}

      <Fusszeile />
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

/** Plattform für die Abzeichen (Regel G, P): unter macOS nennen die Tooltips das lokale Netzwerk (E49). */
function plattform(): 'win32' | 'darwin' {
  return window.jmconnect.platform === 'darwin' ? 'darwin' : 'win32';
}

/** `title` eines Abzeichens (Regel G, P): der volle Text, darunter der Tooltip aus 22.9, wenn es einen gibt (C-EB32). */
function titel(a: Abzeichen): string {
  return a.tooltip ? `${a.title}\n${a.tooltip}` : a.title;
}

/** Farbe des Programm-Abzeichens je Zustand (22.4); ein Zustand ohne Farbe scheitert im Typcheck. */
const PROGRAMM_FARBE: Record<NdiProgrammZustand, string> = {
  aus: 'bg-neutral-800 text-neutral-400',
  sucht: 'bg-yellow-900 text-yellow-200',
  keineQuelle: 'bg-neutral-800 text-neutral-400',
  verbunden: 'bg-green-800 text-green-100',
  ohneBild: 'bg-yellow-900 text-yellow-200',
  staut: 'bg-red-900 text-red-200',
  fehler: 'bg-red-900 text-red-200',
  neustart: 'bg-red-900 text-red-200',
  gescheitert: 'bg-red-900 text-red-200',
};

/**
 * Programm-Abzeichen (Regel P, 22.5 Ort 2): ein Text je Zustand aus @shared/ndi-text (T120–T128), der volle Text als
 * `title`, weil das Abzeichen abgeschnitten werden kann. Vor dem ersten Status des Mains steht keins (kein geratener Wert).
 */
function ProgramBadge({ status }: { status: AppStatus | null }): JSX.Element | null {
  if (!status) return null;
  const a = programmAbzeichen({ lage: status.ndiProgramm, plattform: plattform() });
  return (
    <span
      title={titel(a)}
      className={`max-w-[60%] truncate rounded-full px-2 py-0.5 font-semibold ${PROGRAMM_FARBE[status.ndiProgramm.zustand]}`}
    >
      {a.text}
    </span>
  );
}

/** Eingelassen heißt: Der Gast publiziert (freigegeben, auf Sendung oder aus Sendung; wie isLive in @jm/rtc/state, C-EB37). */
function istEingelassen(g: Guest): boolean {
  return g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off';
}

/** Farbe des Gast-Abzeichens je Zustand (22.3); ein Zustand ohne Farbe scheitert im Typcheck. */
const GAST_FARBE: Record<NdiQuelleLage['zustand'], string> = {
  startet: 'bg-yellow-900 text-yellow-200',
  sendet: 'bg-green-800 text-green-100',
  ohneBild: 'bg-yellow-900 text-yellow-200',
  neustart: 'bg-red-900 text-red-200',
  gescheitert: 'bg-red-900 text-red-200',
};

/**
 * Uhr für T140 (Regel G, C-EP16): je Quelle, die einen Eintrag haben müsste (Gast eingelassen bzw. teilt) und keinen hat, die
 * monotone Zeit (performance.now()) ab dem ersten Raum-Zustand ohne Eintrag; nie die Wanduhr (E50, PK55). Ein Zeitgeber rendert
 * neu, sobald für eine Quelle T140_NACH_MS (3 s, dieselbe Frist wie gastAbzeichen) um ist; ohne ihn erschiene T140 erst beim
 * nächsten fremden Push. Gibt je Schlüssel die Dauer ohne Eintrag zurück, sonst null.
 */
function useOhneEintragSeit(offen: readonly string[]): (schluessel: string) => number | null {
  const seit = useRef(new Map<string, number>());
  const [, setTakt] = useState(0);
  const jetzt = performance.now();
  for (const k of [...seit.current.keys()]) if (!offen.includes(k)) seit.current.delete(k);
  for (const k of offen) if (!seit.current.has(k)) seit.current.set(k, jetzt);
  useEffect(() => {
    const rest = [...seit.current.values()].map((t) => T140_NACH_MS - (performance.now() - t)).filter((r) => r > 0);
    if (rest.length === 0) return;
    const t = setTimeout(() => setTakt((n) => n + 1), Math.min(...rest) + 1);
    return () => clearTimeout(t);
  });
  return (schluessel) => {
    const t = seit.current.get(schluessel);
    return t === undefined ? null : performance.now() - t;
  };
}

/**
 * Grundzeile eines Ausfalls (T111, T128; 22.5 Orte 1 und 2): der Grund, „… neu starten“ (nicht bei keinPeer) und „Logordner
 * öffnen“. Beide Knöpfe gehen per IPC an den Main und bleiben auch ohne Raumverbindung bedienbar (Regel V).
 */
function Grundzeile({
  text,
  neustart,
  logordner,
}: {
  text: string;
  neustart: { text: string; aus: () => void } | null;
  logordner: boolean;
}): JSX.Element {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-200">
      <span>{text}</span>
      {neustart && (
        <button onClick={neustart.aus} className="rounded border border-red-800 px-2 py-0.5 text-red-100 hover:bg-red-950">
          {neustart.text}
        </button>
      )}
      {logordner && (
        <OeffnenKnopf stelle="logordnerGrundzeile" text={NDI_TEXT.t142Logordner} oeffnen={() => window.jmconnect.logordner()} />
      )}
    </div>
  );
}

/**
 * Kopfzeile der Gästeliste (22.5 Ort 2, E53): Zählung (nur mit Raumverbindung), Presenter, Programm-Abzeichen (Regel P), der
 * Link T133 und in `gescheitert` die Grundzeile T128 mit „Programm neu starten“ (nicht bei keinPeer) und „Logordner öffnen“.
 */
function Kopfzeile({ status, zaehlung }: { status: AppStatus; zaehlung: string | null }): JSX.Element {
  const a = programmAbzeichen({ lage: status.ndiProgramm, plattform: plattform() });
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
        <span>{zaehlung}</span>
        <div className="flex min-w-0 items-center gap-2">
          {status.presenterLinked && (
            <span className="rounded-full bg-sky-900 px-2 py-0.5 font-semibold text-sky-200">📊 Presenter</span>
          )}
          <ProgramBadge status={status} />
          <NdiLink stelle="linkGaeste" />
        </div>
      </div>
      {a.grundzeile !== null && (
        <Grundzeile
          text={a.grundzeile}
          neustart={a.knopfNeustart ? { text: NDI_TEXT.t128Knopf, aus: () => void window.jmconnect.programmNeustart() } : null}
          logordner={a.knopfLogordner}
        />
      )}
    </div>
  );
}

/**
 * Fußzeile des Hauptfensters (22.5 Ort 4, E35, E55, LP3, LP5; beide Plattformen): der Markenhinweis T134 als Fußnote und die
 * Knöpfe aus T142 „Logordner öffnen“ und „Lizenzbedingungen“ (öffnet nur LIZENZ.txt im Paket).
 */
function Fusszeile(): JSX.Element {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
      <span>{NDI_TEXT.t134}</span>
      <span className="flex flex-wrap items-center gap-2">
        <OeffnenKnopf stelle="logordnerFusszeile" text={NDI_TEXT.t142Logordner} oeffnen={() => window.jmconnect.logordner()} />
        <OeffnenKnopf stelle="lizenz" text={NDI_TEXT.t142Lizenz} oeffnen={() => window.jmconnect.lizenz()} />
      </span>
    </footer>
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
