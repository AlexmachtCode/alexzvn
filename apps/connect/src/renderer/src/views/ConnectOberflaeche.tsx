// JM Connect im Werkzeug-Rahmen (UX Welle 2b, Connect d1; B3, B4, B8, B9, B19, B21; Muster d): AppShell aus @jm/ui mit Kopf
// „JM Connect“, ThemeToggle, ⚙ und ON AIR (nur bei gemessener Sendung), Statusleiste aus lib/oberflaeche.ts und dem Panel. Im
// Inhalt oben T145 (erste Nennung von NDI, mit ®), darunter zwei Spalten per Container-Query (ab 56rem nebeneinander): links der
// Cloud-Raum, rechts bis Task 24 die unveränderte ZoomCard; unter macOS nur eine Spalte mit MAC_ZEILE unter dem Cloud-Raum.
// Darunter über volle Breite die Pflicht-Fußzeile, immer gerendert.
// Die Wurzel-View (ConnectOberflaeche) hält die Raum-WebSocket zum ConnectRoom-DO und spiegelt dessen autoritativen Zustand;
// NDI-Effekte aus dem DO gehen per IPC an den Main (ndi-guests-Pool); Steuerbefehle (Companion/Rundown) kommen per IPC herein und
// werden an den DO relayt. Sie hält dazu alle Abos (Status, Show, Steuerbefehle, Tray, Master-Link, Fernsteuerung), die Adresse
// aus getProxy und den Panelzustand; sie bleibt über Panel-Wechsel stabil (B8), nichts hängt am Panelzustand. Die Logik ist die
// von App.tsx bis Task 22, nur verschoben. Der Rahmen (ConnectRahmen) zeichnet nur, was er bekommt: eine Wahrheit für Kopf,
// Statusleiste, Spalten und Panel.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SignallingClient } from '@jm/rtc/signalling';
import { lobbyCount, onAirGuests, standbyGuest } from '@jm/rtc/state';
import { ndiPoolKey } from '@jm/rtc/protocol';
import type { OperatorAction, Guest, RoomState } from '@jm/rtc/protocol';
import { AppShell, useBrueckenWert } from '@jm/ui';
import type { AppStatus, GuestInvite, ShowInfo } from '@shared/types';
import { NDI_TEXT } from '@shared/ndi-text';
import { MAC_ZEILE } from '@shared/zoom-text';
import { erzeugeRaumFolge, raumAbbruch, raumAnsicht } from '@shared/raum-ansicht';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { kopfOnAir, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { ZoomCard } from '@/zoom/ZoomCard';
import { CloudRaum, type CloudRaumAktionen } from './CloudRaum';
import { Einstellungen, type EinstellungenAktionen } from './Einstellungen';
import { Fusszeile } from './Fusszeile';

/** Alle Aktionen der Wurzel-View: die des Cloud-Raums und die des Panels. */
export type ConnectAktionen = CloudRaumAktionen & EinstellungenAktionen;

export interface ConnectRahmenProps {
  stand: OberflaechenStand;
  show: ShowInfo | null;
  error: string | null;
  invites: GuestInvite[];
  guestName: string;
  aktionen: ConnectAktionen;
  /** Adresse aus getProxy: undefined = noch keine Antwort, null = Abfrage gescheitert. */
  proxyAdresse: string | null | undefined;
  panelOffen: boolean;
  panelAbschnitt?: string;
  onPanel(offen: boolean, abschnitt?: string): void;
}

/**
 * Der Rahmen von Connect: ein Stand für Kopf (ON AIR), Statusleiste, Spalten und Panel. Die Zoom-Spalte gibt es nur unter
 * Windows; sonst steht T95 (MAC_ZEILE) unter dem Cloud-Raum und es gibt nur eine Spalte (W2-5).
 */
export function ConnectRahmen(p: ConnectRahmenProps): JSX.Element {
  const { stand } = p;
  const windows = stand.plattform === 'win32';
  return (
    <AppShell
      tool="Connect"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={p.aktionen} proxyAdresse={p.proxyAdresse} />}
      settingsOpen={p.panelOffen}
      settingsSection={p.panelAbschnitt}
      onSettingsChange={p.onPanel}
    >
      <div data-connect="inhalt" className="@container px-4 pt-3 pb-4">
        <p data-connect="untertitel" className="mb-3 text-sm text-[var(--muted-foreground)]">{NDI_TEXT.t145}</p>
        <div data-connect="spalten" className={windows ? 'grid items-start gap-4 @[56rem]:grid-cols-2' : 'max-w-3xl'}>
          <div data-connect="cloud-raum" className="min-w-0">
            <CloudRaum stand={stand} show={p.show} error={p.error} invites={p.invites} guestName={p.guestName} aktionen={p.aktionen} />
            {windows ? null : <p data-connect="mac-zeile" className="mt-6 text-xs text-[var(--muted-foreground)]">{MAC_ZEILE}</p>}
          </div>
          {windows ? (
            <div data-connect="zoom-spalte" className="min-w-0">
              <ZoomCard />
            </div>
          ) : null}
        </div>
        <Fusszeile />
      </div>
    </AppShell>
  );
}

/** Plattform aus der Preload-Brücke; ohne window (Render-Test) leer, dann gibt es keine Zoom-Spalte. */
function plattformLesen(): string {
  return typeof window === 'undefined' ? '' : (window.jmconnect?.platform ?? '');
}

export function ConnectOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
} = {}): JSX.Element {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [invites, setInvites] = useState<GuestInvite[]>([]);
  const [guestName, setGuestName] = useState('');
  const [show, setShow] = useState<ShowInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Regel V (22.5): „Client besteht“ ist ein React-Zustand, gesetzt in openRoom mit dem neuen Client, zurückgesetzt in
  // closeRoom, im Fehlerzweig von openRoom und beim Raumabbruch; nie aus clientRef gelesen (eine Ref rendert nicht neu, SR3).
  const [clientBesteht, setClientBesteht] = useState(false);
  // „Raumabbruch“ (E57): gesetzt beim Raumabbruch, zurückgesetzt, wenn openRoom einen neuen Client anlegt, und in closeRoom.
  const [raumabbruch, setRaumabbruch] = useState(false);
  const clientRef = useRef<SignallingClient | null>(null);
  // Raumverbindung für die Handler (Regel V, LR5): onOpen und onClose führen sie nach; nicht roomRef, der den Raum-Zustand
  // hält und bei einer Trennung gewollt stehen bleibt (E53).
  const verbundenRef = useRef(false);
  const openingRef = useRef(false);
  // OE3 (C-EP3): „Raum schließen“ wartet auf ein laufendes „Raum öffnen“ und überholt es nie.
  const [raumFolge] = useState(erzeugeRaumFolge);
  // Der SignallingClient versucht bei Misserfolg still und endlos neu zu verbinden. Ohne diese
  // Frist stünde der Operator vor einem Fenster, das schweigt (so verschluckte die strenge CSP
  // des gepackten Builds die Raum-WebSocket komplett).
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Die Meldung des Wachhunds (T146), solange sie im Fehlerfeld steht; closeRoom und der Raumabbruch löschen genau sie (E57).
  const wachhundTextRef = useRef<string | null>(null);
  // Der Steuerbefehl-Handler wird EINMAL registriert und darf nicht an `room` hängen (sonst
  // ab-/neu-abonniert er bei jedem Zustands-Broadcast). `talkback toggle` braucht aber den
  // aktuellen Zustand → über einen Ref lesen.
  const roomRef = useRef<RoomState | null>(null);
  // Adresse des Suite-Proxys für den Panel-Abschnitt Cloud-Zugang (B8: gelesen hier, nicht im Panel).
  const [proxyAdresse, setProxyAdresse] = useState<string | null | undefined>(undefined);
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);
  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort da ist; ohne Preload null. Auch bei geschlossenem Panel.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }, []);

  /** Wachhund samt seiner Meldung T146 weg (closeRoom, Raumabbruch; E57). Andere Fehlermeldungen bleiben stehen. */
  const wachhundWeg = useCallback(() => {
    clearWatchdog();
    const t = wachhundTextRef.current;
    wachhundTextRef.current = null;
    if (t !== null) setError((f) => (f === t ? null : f));
  }, [clearWatchdog]);

  const send = useCallback((action: OperatorAction) => {
    clientRef.current?.send(action);
  }, []);

  // Talkback ist „Halten zum Sprechen": Taste unten → Mikro auf, Taste los → zu.
  // `target: null` spricht ALLE Gäste an, sonst nur den einen. Der DO ist autoritativ; der
  // versteckte Peer folgt seinem Broadcast und schaltet den Web-Audio-Gate.
  // Regel V (22.5): ohne Raumverbindung tun Talkback und Folien nichts, kein send und keine Audit-Zeile. Die Handler prüfen
  // selbst über verbundenRef; die Knöpfe (TallyButton, HalteKnopf) sperren zusätzlich mit Grund (gastHalten, talkbackTaste).
  const talkbackDown = useCallback(
    (target: string | null) => {
      if (!verbundenRef.current) return;
      send({ t: 'talkback', mode: target ? 'selected' : 'all', target });
      window.jmconnect.audit('talkback', `an → ${target ?? 'alle Gäste'} (Bedienfeld)`);
    },
    [send],
  );
  const talkbackUp = useCallback(() => {
    if (!verbundenRef.current) return;
    send({ t: 'talkback', mode: 'off', target: null });
    window.jmconnect.audit('talkback', 'aus (Bedienfeld)');
  }, [send]);
  // Folien-Steuerung eines Gasts (Welle 6.3c), gesperrt wie Talkback (Regel V).
  const folien = useCallback(
    (g: Guest) => {
      if (!verbundenRef.current) return;
      send({ t: 'slides', guestId: g.id, on: !g.canAdvance });
      // Kennung statt Name: Gastnamen gehören nicht ins Log (Spec N4b.2, L11), wie bei „slides“ per Steuerprotokoll.
      window.jmconnect.audit('slides', `${g.canAdvance ? 'entzogen' : 'erteilt'} für ${g.id}`);
    },
    [send],
  );

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

  const openRoom = useCallback(
    () =>
      // OE3 (C-EP3): über die Raum-Folge, damit „Raum schließen“ (Knopf und Tray) auf das Ende dieses Öffnens wartet.
      raumFolge.oeffnen(async () => {
        // Nicht doppelt/gleichzeitig öffnen — sonst schließt ein neuer Raum die bestehende WS
        // sofort wieder (wirkt wie „Raum schließt sich von selbst") und Gäste landen verwaist.
        if (openingRef.current || clientRef.current) return;
        openingRef.current = true;
        setError(null);
        try {
          // Eine geöffnete Show gibt den Raum vor (deterministisch) → vorab verteilte Join-Links
          // bleiben gültig, weil das Secret zu dieser Raum-ID gespeichert ist.
          const session = await window.jmconnect.openRoom(show?.room);
          const client: SignallingClient = new SignallingClient({
            url: session.wsUrl,
            onMessage: handleMessage,
            onOpen: () => {
              clearWatchdog();
              wachhundTextRef.current = null;
              setError(null);
              verbundenRef.current = true;
              setConnected(true);
            },
            onClose: () => {
              // Nur der Client, auf den clientRef noch zeigt (Nachtrag C, M-C13-3): Ein spätes Schließen eines ersetzten
              // Clients sperrt Rückkanal und Folien am lebenden nicht und löst keinen Raumabbruch aus.
              if (clientRef.current !== client) return;
              verbundenRef.current = false;
              setConnected(false);
              // Raumabbruch (E57): erst, wenn die Anmeldung abgelaufen ist (bewusst die Wanduhr: operatorBis ist exp des
              // Operator-Tokens). Dann kein weiterer Versuch.
              if (raumAbbruch({ verbunden: false, jetzt: Date.now(), operatorBis: session.operatorBis }) === null) return;
              client.close();
              clientRef.current = null;
              setClientBesteht(false);
              setRaumabbruch(true);
              wachhundWeg();
              window.jmconnect.audit('raumabbruch', 'Anmeldung am Raum abgelaufen, keine weiteren Versuche (E57)');
            },
          });
          clientRef.current = client;
          verbundenRef.current = false;
          setClientBesteht(true);
          // „Raumabbruch“ endet erst mit dem neuen Client, nicht mit dem Klick (ein gescheitertes Öffnen lässt T144 stehen).
          setRaumabbruch(false);
          client.connect();
          clearWatchdog();
          watchdogRef.current = setTimeout(() => {
            const t = NDI_TEXT.t146(session.room);
            wachhundTextRef.current = t;
            setError(t);
          }, 8000);
        } catch (e) {
          // Ohne dieses Zurücksetzen bliebe `clientRef` besetzt und jeder weitere Klick auf
          // „Raum öffnen" liefe stumm ins Leere (der Guard oben greift).
          clientRef.current = null;
          setClientBesteht(false);
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          openingRef.current = false;
        }
      }),
    [clearWatchdog, handleMessage, raumFolge, show?.room, wachhundWeg],
  );

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

  const closeRoom = useCallback(
    () =>
      // OE3 (C-EP3): wartet auf ein laufendes „Raum öffnen“ und schließt danach, so setzt eine späte Antwort kein verworfenes
      // Secret wieder (E57). Knopf und Tray rufen dieselbe Funktion (E58).
      raumFolge.schliessen(async () => {
        wachhundWeg();
        clientRef.current?.close();
        clientRef.current = null;
        verbundenRef.current = false;
        setClientBesteht(false);
        setRaumabbruch(false);
        setConnected(false);
        setRoom(null);
        // Der Raum wird geschlossen und das Secret rotiert — alle erzeugten Links sind damit tot.
        setInvites([]);
        // Lehnt der Main ab, steht der Fehler im Fehlerfeld wie bei openRoom (Nachtrag C, M-C13-1), statt als unbehandelte
        // Ablehnung an Knopf und Tray zu gehen.
        try {
          await window.jmconnect.closeRoom();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }),
    [raumFolge, wachhundWeg],
  );

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
    // Tray „Raum schließen“ (E58): dieselbe Funktion wie der Knopf; jede andere Art (show) ändert hier nichts.
    const offTray = window.jmconnect.onTrayCommand((cmd) => {
      if (cmd.kind === 'closeRoom') void closeRoom();
    });
    return () => {
      offStatus();
      offShow();
      offCmd();
      offTray();
      clearWatchdog();
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [clearWatchdog, closeRoom, send]);

  // Cloud-Zugang (Anmeldung Teil 2): die Adresse einmal beim Start lesen, wie bisher die Karte; das Panel liest sie nicht selbst.
  useEffect(() => {
    void window.jmconnect.getProxy().then(
      (p) => setProxyAdresse(p.url),
      () => setProxyAdresse(null),
    );
  }, []);

  const proxySpeichern = useCallback(async (url: string) => {
    const p = await window.jmconnect.setProxy({ url });
    setProxyAdresse(p.url);
    return p;
  }, []);
  const keyEntfernen = useCallback(() => window.jmconnect.setProxy({ key: '' }), []);

  // Regel V (22.5): der Raum-Bereich aus „Client besteht“, Raumverbindung, Raum-Zustand und Raumabbruch (E53, E57).
  const ansicht = raumAnsicht({ client: clientBesteht, verbunden: connected, raumBekannt: room !== null, raumabbruch });

  // Der eine Stand (lib/oberflaeche.ts) für Statusleiste, ON AIR, Haupttasten und Panel. Nur Gemessenes: vor dem ersten Status des
  // Mains ist auch der Raum „unbekannt“ (room undefined, Eintrag „raum“ unbekannt); danach null oder der bekannte Raum-Zustand,
  // auch nach einem Raumabbruch (dann „abgebrochen“). Das Zoom-Abbild hält bis Task 24 die ZoomCard selbst (B20).
  const stand: OberflaechenStand = {
    status: status ?? undefined,
    room: status === null ? undefined : room,
    connected,
    ansicht,
    zoom: undefined,
    plattform: plattformLesen(),
    masterLink,
    fernsteuerung,
  };

  const aktionen: ConnectAktionen = {
    raumOeffnen: () => void openRoom(),
    raumSchliessen: () => void closeRoom(),
    talkbackDown,
    talkbackUp,
    folien,
    send,
    gastName: setGuestName,
    gastEinladen: () => void inviteGuest(),
    sprecherEinladen: () => void inviteSpeakers(),
    proxySpeichern,
    keyEntfernen,
  };

  return (
    <ConnectRahmen
      stand={stand}
      show={show}
      error={error}
      invites={invites}
      guestName={guestName}
      aktionen={aktionen}
      proxyAdresse={proxyAdresse}
      panelOffen={panelOffen}
      panelAbschnitt={panelAbschnitt}
      onPanel={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    />
  );
}
