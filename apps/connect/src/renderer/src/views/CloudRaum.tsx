// Linke Spalte „Cloud-Raum“ (UX Welle 2b, Connect d1; B19, B21, B6; Regel V, Regel G, Regel P): Fehlerfeld, T141/T144, Show-Karte,
// die Haupttasten Raum und Talkback alle (nach einem Raumabbruch darunter „Raum schließen“, Tastenplatz Task 24), Einladen,
// Einladungen, Kopfzeile und Gästeliste. Was steht und was bedienbar ist, entscheidet nur raumAnsicht (stand.ansicht); Sperren und Beschriftungen der
// Haupttasten und des Halte-Knopfs je Gast kommen aus lib/oberflaeche.ts. Gästeliste, Abzeichen, Grundzeilen und GuestActions
// bleiben in Logik und Reihenfolge je Zeile wie bisher (App.tsx bis Task 22), nur die Farben sind Tokens (W2-9).
// Raum-Client, Abos und Fernbefehle stehen in der Wurzel-View (ConnectOberflaeche); hier stehen nur die Ansicht und die Knöpfe.
// Die Knöpfe der Grund- und Fußzeilen gehen wie bisher direkt per IPC an den Main (Regel V: auch ohne Raumverbindung bedienbar).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, HalteKnopf, TallyButton, TextInput, type HalteKnopfProps, type TallyButtonProps } from '@jm/ui';
import { lobbyCount, onAirGuests } from '@jm/rtc/state';
import { ndiPoolKey } from '@jm/rtc/protocol';
import type { Guest, OperatorAction } from '@jm/rtc/protocol';
import type { AppStatus, GuestInvite, NdiArt, NdiProgrammZustand, NdiQuelleLage, ShowInfo } from '@shared/types';
import { bildschirmTooltip, gastAbzeichen, kopfzeileSichtbar, NDI_TEXT, programmAbzeichen, T140_NACH_MS, type Abzeichen } from '@shared/ndi-text';
import { toDataUrl } from '@/lib/qr';
import { gastHalten, raumTaste, talkbackTaste, type OberflaechenStand } from '@/lib/oberflaeche';
import { NdiLink, OeffnenKnopf } from '@/zoom/SlotBereich';
import { OEFFNEN_STIL } from './Fusszeile';

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

/** Was der Cloud-Raum von der Wurzel-View bekommt: die Aktionen über die Raum-WebSocket und IPC (Logik dort, unverändert). */
export interface CloudRaumAktionen {
  /** „Raum öffnen“ über die Raum-Folge der Wurzel-View. */
  raumOeffnen(): void;
  /** „Raum schließen“ über die Raum-Folge der Wurzel-View; dieselbe Funktion wie im Tray (E58). */
  raumSchliessen(): void;
  /** Talkback an: `null` spricht alle Gäste an, sonst nur den einen. */
  talkbackDown(target: string | null): void;
  talkbackUp(): void;
  folien(g: Guest): void;
  send(action: OperatorAction): void;
  gastName(name: string): void;
  /** „Link erzeugen“. */
  gastEinladen(): void;
  /** „n Sprecher einladen“ (Show). */
  sprecherEinladen(): void;
}

export interface CloudRaumProps {
  stand: Pick<OberflaechenStand, 'status' | 'room' | 'connected' | 'ansicht' | 'plattform'>;
  show: ShowInfo | null;
  error: string | null;
  invites: GuestInvite[];
  guestName: string;
  aktionen: CloudRaumAktionen;
}

/**
 * Die Haupttasten (B21, B6) als Props: Raum öffnen bzw. schließen (eine Taste; öffnet ohne Client, sonst schließt sie) und
 * Talkback alle (Halten über onPress/onRelease). Beschriftung, Zustand und Sperrgrund aus raumTaste und talkbackTaste. Ohne DOM
 * prüfbar.
 */
export function haupttasten(
  s: Pick<OberflaechenStand, 'status' | 'ansicht' | 'room'>,
  show: ShowInfo | null,
  a: Pick<CloudRaumAktionen, 'raumOeffnen' | 'raumSchliessen' | 'talkbackDown' | 'talkbackUp'>,
): [TallyButtonProps, TallyButtonProps] {
  const raum = raumTaste(s, show);
  const talkback = talkbackTaste(s);
  return [
    { ...raum, onClick: s.ansicht.raumOeffnen ? a.raumOeffnen : a.raumSchliessen },
    { ...talkback, onPress: () => a.talkbackDown(null), onRelease: a.talkbackUp },
  ];
}

/**
 * Halte-Knopf je Gast (B21, W2-V2): „🎙“ mit dem bisherigen Hilfetext; aktiv, solange nur dieser Gast die Regie hört; gesperrt mit
 * Grund ohne Raumverbindung (gastHalten). Das Loslassen kommt je Druck genau einmal, auch wenn die Gastzeile beim Halten verschwindet.
 */
export function gastTalkback(
  s: Pick<OberflaechenStand, 'ansicht' | 'room'>,
  g: Guest,
  a: Pick<CloudRaumAktionen, 'talkbackDown' | 'talkbackUp'>,
): HalteKnopfProps {
  const halten = gastHalten(s, g);
  return {
    label: '🎙',
    title: `Halten: nur ${g.name} hört die Regie`,
    aktiv: halten.aktiv,
    gesperrt: halten.gesperrt,
    onPress: () => a.talkbackDown(g.id),
    onRelease: a.talkbackUp,
  };
}

const HINWEIS = 'rounded-[var(--radius-md)] border px-3 py-2 text-sm text-[var(--foreground)] select-text';
const HINWEIS_FEHLER = 'border-[var(--status-error)]/60 bg-[var(--status-error)]/10';
const HINWEIS_WARNUNG = 'border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10';
const KARTE = 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3';
const ABZEICHEN = 'rounded-full border px-2 py-0.5 text-xs font-semibold text-[var(--foreground)]';
const ABZEICHEN_NEUTRAL = `${ABZEICHEN} border-[var(--border)] bg-[var(--muted)]`;

export function CloudRaum({ stand, show, error, invites, guestName, aktionen }: CloudRaumProps): JSX.Element {
  const { status, connected, ansicht } = stand;
  const room = stand.room ?? null;
  const plattform: 'win32' | 'darwin' = stand.plattform === 'darwin' ? 'darwin' : 'win32';
  const guests = (room?.guests ?? []).filter((g) => g.phase !== 'left' && g.phase !== 'kicked');
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
              plattform,
              raumverbunden: connected,
            }),
          };
        })
      : [];
  const [raumKnopf, talkbackKnopf] = haupttasten(stand, show, aktionen);

  return (
    <div data-connect="cloud" className="@container space-y-3">
      {error && (
        <div data-connect="fehler" className={`${HINWEIS} ${HINWEIS_FEHLER}`}>
          {error}
        </div>
      )}

      {/* Raum-Bereich nach Regel V (22.5, E53, E57): was steht und was bedienbar ist, entscheidet nur raumAnsicht. */}
      {ansicht.t144 && (
        <div data-connect="t144" className={`${HINWEIS} ${HINWEIS_WARNUNG}`}>
          {NDI_TEXT.t144}
          {ansicht.t144Zusatz ? NDI_TEXT.t144Zusatz : ''}
        </div>
      )}
      {/* T141 (E53, Regel V): Client besteht, keine Raumverbindung, Raum-Zustand bekannt. */}
      {ansicht.t141 && (
        <div data-connect="t141" className={`${HINWEIS} ${HINWEIS_WARNUNG} text-xs`}>
          {NDI_TEXT.t141}
        </div>
      )}

      {show && <ShowCard show={show} connected={connected} invited={invites.length} onInvite={aktionen.sprecherEinladen} />}

      <div data-connect="haupttasten" className="grid grid-cols-2 gap-3">
        <TallyButton {...raumKnopf} />
        <TallyButton {...talkbackKnopf} />
      </div>

      {/* Nach einem Raumabbruch: „Raum schließen“ als normaler Knopf unter den Haupttasten, links (die Haupttaste öffnet dann neu).
          Tastenplatz (Task 24): über den Haupttasten schob er „Talkback alle“ auf das alte „Raum schließen“ bzw. das breite „Raum
          „…“ öffnen“ der Raum-Zeile; links liegt er selbst außerhalb jedes alten Platzes (der alte Block begann bei x 266 bzw. 116). */}
      {!ansicht.gastEinladen && ansicht.raumSchliessen && (
        <div data-connect="raum-schliessen" className="flex">
          <Button variant="outline" size="sm" uppercase={false} onClick={() => aktionen.raumSchliessen()}>
            Raum schließen
          </Button>
        </div>
      )}

      {ansicht.gastEinladen && (
        <>
          <div data-connect="einladen" className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Gast einladen">
                <TextInput value={guestName} onChange={aktionen.gastName} placeholder="Name des Gasts" />
              </Field>
            </div>
            <Button
              size="sm"
              variant="outline"
              uppercase={false}
              onClick={() => aktionen.gastEinladen()}
              disabled={!ansicht.linkErzeugenBedienbar}
            >
              Link erzeugen
            </Button>
          </div>

          {invites.length > 0 && (
            <div data-connect="einladungen" className="grid gap-3 @[34rem]:grid-cols-2">
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
          plattform={plattform}
          zaehlung={
            ansicht.gaesteliste && room
              ? `${guests.length} Gäste · ${lobbyCount(room)} im Warteraum · ${onAirGuests(room).length} auf Sendung`
              : null
          }
        />
      )}

      {ansicht.gaesteliste && (
        <ul data-connect="gaesteliste" className="space-y-2">
          {guests.map((g) => {
            const ndi = gastNdi(g);
            return (
              <li key={g.id} data-connect="gast" className={KARTE}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 font-medium">{g.name}</span>
                  {g.hasScreen && (
                    <span title={bildschirmTooltip(g.name)} className={ABZEICHEN_NEUTRAL}>
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
                          className={`max-w-[40%] truncate ${ABZEICHEN} ${n.lage ? GAST_RAND[n.lage.zustand] : 'border-[var(--border)] bg-[var(--muted)]'}`}
                        >
                          {n.abzeichen.text}
                        </span>
                      ),
                  )}
                  {canHearTalkback(g) && <HalteKnopf {...gastTalkback(stand, g, aktionen)} />}
                  {canHearTalkback(g) && (
                    <button
                      onClick={() => aktionen.folien(g)}
                      disabled={!ansicht.wsKnoepfeBedienbar}
                      title={
                        status?.presenterLinked
                          ? 'Der Gast darf die Folien im JM Presenter selbst weiterblättern'
                          : 'Kein JM Presenter im Netz gefunden — der Cue liefe ins Leere'
                      }
                      className={`min-h-[var(--control-h)] rounded-[var(--radius-md)] border-2 px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                        g.canAdvance ? 'border-[var(--tally-selected)] bg-[var(--highlight)] text-[var(--foreground)]' : 'border-[var(--field-border)] bg-[var(--card)] text-[var(--foreground)]'
                      }`}
                    >
                      📊
                    </button>
                  )}
                  <PhaseBadge phase={g.phase} />
                  <GuestActions guest={g} send={aktionen.send} gesperrt={!ansicht.wsKnoepfeBedienbar} />
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
          {guests.length === 0 && <li className="text-sm text-[var(--muted-foreground)]">Noch keine Gäste — Link erzeugen und teilen.</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * Die aus dem Launcher geöffnete Veranstaltung. Die Sprecher stammen token-frei aus iveo; die Join-Token entstehen erst im Main
 * aus dem Raum-Secret — nie in der Show-Datei.
 */
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
    <div data-connect="show" className={KARTE}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{show.eventName ?? show.name}</div>
          <div className="text-xs text-[var(--muted-foreground)]">
            {show.speakers.length} Sprecher aus iveo · Raum <code className="text-[var(--foreground)]">{show.room}</code>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          uppercase={false}
          className="shrink-0"
          onClick={onInvite}
          disabled={!connected || show.speakers.length === 0 || open <= 0}
          title={!connected ? 'Erst den Raum öffnen' : undefined}
        >
          {open > 0 ? `${open} Sprecher einladen` : 'Alle eingeladen'}
        </Button>
      </div>
      {show.speakers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {show.speakers.map((s) => (
            <span key={s.name} className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--foreground)]">
              {s.name}
              {s.title && <span className="text-[var(--muted-foreground)]"> · {s.title}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Das QR-Bild einer Einladung: dunkel auf weiß zum Abfotografieren (Programmfläche, B5; lib/qr.ts). */
function QrBild({ src }: { src: string }): JSX.Element {
  return <img src={src} alt="" width={96} height={96} className="h-24 w-24 shrink-0 rounded bg-white p-1" />;
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
    <div className={`flex gap-3 ${KARTE}`}>
      {qr && <QrBild src={qr} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{invite.name}</div>
        <div className="mt-1 break-all text-xs text-[var(--muted-foreground)] select-text">{invite.joinUrl}</div>
        <Button variant="outline" size="sm" uppercase={false} className="mt-2" onClick={copy}>
          {copied ? 'Kopiert ✓' : 'Link kopieren'}
        </Button>
      </div>
    </div>
  );
}

/** Nur wer einen Rückkanal hat, kann die Regie hören (Mix-Minus-Bus entsteht erst ab „freigegeben"). */
function canHearTalkback(g: Guest): boolean {
  return g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off';
}

/** `title` eines Abzeichens (Regel G, P): der volle Text, darunter der Tooltip aus 22.9, wenn es einen gibt (C-EB32). */
function titel(a: Abzeichen): string {
  return a.tooltip ? `${a.title}\n${a.tooltip}` : a.title;
}

/** Rand des Programm-Abzeichens je Zustand (22.4; Farbe nur am Rand, W2-9); ein Zustand ohne Rand scheitert im Typcheck. */
const PROGRAMM_RAND: Record<NdiProgrammZustand, string> = {
  aus: 'border-[var(--border)] bg-[var(--muted)]',
  sucht: 'border-[var(--status-warn)]',
  keineQuelle: 'border-[var(--border)] bg-[var(--muted)]',
  verbunden: 'border-[var(--tally-ready)]',
  ohneBild: 'border-[var(--status-warn)]',
  staut: 'border-[var(--status-error)]',
  fehler: 'border-[var(--status-error)]',
  neustart: 'border-[var(--status-error)]',
  gescheitert: 'border-[var(--status-error)]',
};

/**
 * Programm-Abzeichen (Regel P, 22.5 Ort 2): ein Text je Zustand aus @shared/ndi-text (T120–T128), der volle Text als
 * `title`, weil das Abzeichen abgeschnitten werden kann. Vor dem ersten Status des Mains steht keins (kein geratener Wert).
 */
function ProgramBadge({ status, plattform }: { status: AppStatus | undefined; plattform: 'win32' | 'darwin' }): JSX.Element | null {
  if (!status) return null;
  const a = programmAbzeichen({ lage: status.ndiProgramm, plattform });
  return (
    <span title={titel(a)} className={`max-w-[60%] truncate ${ABZEICHEN} ${PROGRAMM_RAND[status.ndiProgramm.zustand]}`}>
      {a.text}
    </span>
  );
}

/** Eingelassen heißt: Der Gast publiziert (freigegeben, auf Sendung oder aus Sendung; wie isLive in @jm/rtc/state, C-EB37). */
function istEingelassen(g: Guest): boolean {
  return g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off';
}

/** Rand des Gast-Abzeichens je Zustand (22.3; Farbe nur am Rand, W2-9); ein Zustand ohne Rand scheitert im Typcheck. */
const GAST_RAND: Record<NdiQuelleLage['zustand'], string> = {
  startet: 'border-[var(--status-warn)]',
  sendet: 'border-[var(--tally-ready)]',
  ohneBild: 'border-[var(--status-warn)]',
  neustart: 'border-[var(--status-error)]',
  gescheitert: 'border-[var(--status-error)]',
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
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--foreground)]">
      <span>
        <span aria-hidden="true" className="text-[var(--status-error)]">
          ⚠
        </span>{' '}
        {text}
      </span>
      {neustart && (
        <button onClick={neustart.aus} className={OEFFNEN_STIL}>
          {neustart.text}
        </button>
      )}
      {logordner && (
        <OeffnenKnopf stelle="logordnerGrundzeile" text={NDI_TEXT.t142Logordner} oeffnen={() => window.jmconnect.logordner()} stil={OEFFNEN_STIL} />
      )}
    </div>
  );
}

/**
 * Kopfzeile der Gästeliste (22.5 Ort 2, E53): Zählung (nur mit Raumverbindung), Presenter, Programm-Abzeichen (Regel P), der
 * Link T133 und in `gescheitert` die Grundzeile T128 mit „Programm neu starten“ (nicht bei keinPeer) und „Logordner öffnen“.
 */
function Kopfzeile({ status, plattform, zaehlung }: { status: AppStatus; plattform: 'win32' | 'darwin'; zaehlung: string | null }): JSX.Element {
  const a = programmAbzeichen({ lage: status.ndiProgramm, plattform });
  return (
    <div data-connect="kopfzeile">
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <span>{zaehlung}</span>
        <div className="flex min-w-0 items-center gap-2">
          {status.presenterLinked && <span className={ABZEICHEN_NEUTRAL}>📊 Presenter</span>}
          <ProgramBadge status={status} plattform={plattform} />
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

const PHASE_KLASSE: Record<'live' | 'eingelassen' | 'sonst', string> = {
  // Wie ein live-Eintrag der Statusleiste: rot gefüllt, Schrift in Hintergrundfarbe (Kontrast für kleine Schrift, E14).
  live: 'border-[var(--tally-live)] bg-[var(--tally-live)] text-[var(--background)]',
  eingelassen: 'border-[var(--field-border)] text-[var(--foreground)]',
  sonst: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
};

function PhaseBadge({ phase }: { phase: Guest['phase'] }): JSX.Element {
  const art = phase === 'onair' ? 'live' : phase === 'approved' || phase === 'off' ? 'eingelassen' : 'sonst';
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${PHASE_KLASSE[art]}`}>{PHASE_LABEL[phase]}</span>;
}

/** Gast-Aktionen über die Raum-WebSocket; ohne Raumverbindung gesperrt (Regel V, `gesperrt` aus raumAnsicht). */
function GuestActions({ guest, send, gesperrt }: { guest: Guest; send: (a: OperatorAction) => void; gesperrt: boolean }): JSX.Element {
  // „Auf Sendung“ mit rotem Rand (wie die Kante einer LIVE-Taste); ghost, damit kein zweiter Rand der Variante konkurriert.
  const live = 'border border-[var(--tally-live)]';
  if (guest.phase === 'lobby') {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="primary" uppercase={false} disabled={gesperrt} onClick={() => send({ t: 'approve', guestId: guest.id })}>Freigeben</Button>
        <Button size="sm" variant="outline" uppercase={false} disabled={gesperrt} onClick={() => send({ t: 'deny', guestId: guest.id })}>Ablehnen</Button>
      </div>
    );
  }
  if (guest.phase === 'onair') {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" uppercase={false} disabled={gesperrt} onClick={() => send({ t: 'off', guestId: guest.id })}>Aus Sendung</Button>
        <Button size="sm" variant="destructive" uppercase={false} disabled={gesperrt} onClick={() => send({ t: 'kick', guestId: guest.id })}>Entfernen</Button>
      </div>
    );
  }
  if (guest.phase === 'approved' || guest.phase === 'off') {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" uppercase={false} className={live} disabled={gesperrt} onClick={() => send({ t: 'onair', guestId: guest.id })}>Auf Sendung</Button>
        <Button size="sm" variant="outline" uppercase={false} disabled={gesperrt} onClick={() => send({ t: 'standby', guestId: guest.id })}>Standby</Button>
        <Button size="sm" variant="destructive" uppercase={false} disabled={gesperrt} onClick={() => send({ t: 'kick', guestId: guest.id })}>Entfernen</Button>
      </div>
    );
  }
  return <span />;
}
