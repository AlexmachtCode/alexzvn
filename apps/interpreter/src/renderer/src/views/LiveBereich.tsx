// Live-Bereich des Interpreters (UX Welle 2a, Interpreter d; Spec 3.4, 5.1; E4, E10; Funktionsliste Nr. 5–7, 12–27): die alte
// zentrierte Spalte (max-w-4xl). Oben eine Zeile, die nie umbricht: links die Karte „Pegel“ (Meter Floor und Dolmetscher mit
// Schwellenmarke, Ducking-Pille, „Überbrückt“ bei Bypass), rechts die Haupttaste Starten/Stoppen mit fester Breite, auf ihrem
// alten Platz oben rechts (App.tsx:88-103). Darunter das Fehlerband und die Kabel-Hinweiskarten mit Lizenzsatz und Download-Knopf
// (App.tsx:283-449, Wortlaut und Bedingungen wie bisher; nur „… Der Mix geht auf den Systemstandard …“ bei fehlendem Gerät wird
// nach E10 der Text INTERPRETER_TEXTE.ausgabeNichtVerfuegbar). Alles steht im Fluss, nichts liegt über Metern, Pille oder Taste.
// Unter 900 px liegt das Panel über dem Inhalt; nur dann (Panel offen) hält eine Regel in globals.css den Live-Bereich links
// daneben, ohne Panelzustand in dieser Ansicht. Rein darstellend und ohne Hooks: Stand, Schwelle und Aktionen kommen aus der
// Wurzel-View (InterpreterOberflaeche); kein window, kein Store, keine Engine.
import type { ReactNode } from 'react';
import { Button, cn, StatusPill, TallyButton, type TallyButtonProps, UNBEKANNT } from '@jm/ui';
import { counterpartPresent, detectCable, zoomInputDisplayName } from '@shared/virtual-cable';
import type { LiveAktionen } from '@/lib/aktionen';
import { hauptTaste, INTERPRETER_TEXTE, type GeraetEintrag, type OberflaechenStand } from '@/lib/oberflaeche';

const T = INTERPRETER_TEXTE;

/** Die Haupttaste: genau hauptTaste plus Klick (Wirkung wie der alte toggle, lib/aktionen.ts). Ohne DOM prüfbar. */
export function liveTaste(s: OberflaechenStand, a: LiveAktionen): TallyButtonProps {
  return { ...hauptTaste(s), onClick: a.umschalten };
}

/** dBFS auf 0…1 abbilden. Unter -60 dB ist für Sprache nichts mehr zu sehen (wie bisher, App.tsx:215-219). */
export function meterBreite(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

/**
 * Flächen der Hinweiskarten je Ton (vorher Notice: emerald → ok, yellow → warn). Die Statusfarbe färbt Rand und Fläche, nie die
 * Schrift (die bleibt --foreground). Grün bleibt die eine Karte „Kabel erkannt“, alles andere warnt wie bisher.
 */
export const HINWEIS_TON = {
  ok: 'border-[var(--tally-ready)]/60 bg-[var(--tally-ready)]/10',
  warn: 'border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10',
} as const;

type Ton = keyof typeof HINWEIS_TON;

/** Einheitlicher Rahmen der Statuszeilen zur Ausgabe (vorher Notice). */
function hinweis(ton: Ton, inhalt: ReactNode): React.JSX.Element {
  return (
    <div data-ton={ton} className={cn('rounded-[var(--radius-lg)] border p-3 text-sm text-[var(--foreground)]', HINWEIS_TON[ton])}>
      {inhalt}
    </div>
  );
}

/** Gemeinsamer Fuß der großen Erklärkarten: Lizenzsatz und Download-Knopf (vorher CableDownloadFooter). */
function downloadFuss(onDownload: () => void): React.JSX.Element {
  return (
    <>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig.
      </p>
      <Button type="button" variant="outline" size="sm" uppercase={false} className="mt-3" onClick={() => onDownload()}>
        VB-CABLE herunterladen
      </Button>
    </>
  );
}

/**
 * Meldet den Zustand des gerade wirksamen Ausgabegeräts — Kabel erkannt, Gegenseite fehlt, unbekanntes Gerät, oder gar keins
 * gewählt (vorher deviceCableNotice). Getrennt von kabelKarten, weil das während des Betriebs nicht unbedingt der aktuelle Wert
 * der Wahl ist (siehe dort).
 */
function geraetKarte(outputId: string, outputs: readonly GeraetEintrag[], inputs: readonly GeraetEintrag[], onDownload: () => void): React.JSX.Element {
  const selected = outputs.find((d) => d.deviceId === outputId);

  if (outputId && !selected) {
    // E10: Der Start mit einer unbekannten ID scheitert (setSinkId lehnt ab, start() stoppt mit Fehler); auf den Systemstandard
    // geht der Mix dabei nie. Der alte zweite Satz behauptete das (Task 30, R9).
    return hinweis('warn', T.ausgabeNichtVerfuegbar);
  }

  const kind = selected ? detectCable(selected.label) : null;
  const inputLabels = inputs.map((d) => d.label);

  if (kind) {
    if (!counterpartPresent(kind, inputLabels)) {
      return hinweis(
        'warn',
        <>
          {kind.name} erkannt, aber unter dem Namen <strong>{kind.zoomInputLabel}</strong> wurde keine
          Aufnahmeseite gefunden. Mögliche Ursachen: der Treiber ist unvollständig installiert, das Gerät ist
          in den Windows-Sound-Einstellungen deaktiviert — oder es wurde dort umbenannt.
        </>,
      );
    }

    // Der TATSÄCHLICH gefundene Gerätename, nicht die feste Konstante: die Muster akzeptieren bewusst Namensvarianten, die es auf
    // diesem Rechner so gar nicht gibt (#208).
    const zoomName = zoomInputDisplayName(kind, inputLabels);

    if (kind.needsRouting) {
      // VoiceMeeter (wie Dante) verbindet Ein- und Ausgang nicht von allein — Warnton statt Erfolgston, plus der Zusatzhinweis,
      // was im VoiceMeeter noch zu tun ist.
      return hinweis(
        'warn',
        <>
          {kind.name} erkannt. In Zoom als <em>Mikrofon</em> wählen: <strong>{zoomName}</strong>. {kind.routingHint}
        </>,
      );
    }

    return hinweis(
      'ok',
      <>
        {kind.name} erkannt. In Zoom als <em>Mikrofon</em> wählen: <strong>{zoomName}</strong>
      </>,
    );
  }

  if (!outputId) {
    return (
      <div data-ton="warn" className={cn('rounded-[var(--radius-lg)] border p-4 text-sm text-[var(--foreground)]', HINWEIS_TON.warn)}>
        <p className="font-bold">Kein virtuelles Kabel gewählt</p>
        <p className="mt-1">
          Zoom und Webex können nur ein <em>Mikrofon</em> abgreifen. Der Interpreter spielt seinen Mix deshalb
          in ein virtuelles Kabel hinein; in Zoom wird dann das andere Ende desselben Kabels als Mikrofon
          gewählt. Ohne Kabel geht der Mix auf den Systemstandard und erreicht die Konferenz nicht.
        </p>
        {downloadFuss(onDownload)}
      </div>
    );
  }

  // Ein Gerät ist bewusst gewählt, aber keins der bekannten Kabel (z. B. Dante, Realtek): der Mix geht sehr wohl dorthin — anders
  // als im „nichts gewählt“-Fall oben darf das hier nicht behauptet werden (#208).
  return (
    <div data-ton="warn" className={cn('rounded-[var(--radius-lg)] border p-4 text-sm text-[var(--foreground)]', HINWEIS_TON.warn)}>
      <p className="font-bold">{selected!.label}: kein bekanntes virtuelles Kabel</p>
      <p className="mt-1">
        Der Mix geht auf dieses Gerät. Es ist aber kein virtuelles Kabel, das der Interpreter kennt, und für
        Zoom/Webex wird eines gebraucht, damit die Konferenz den Ton als Mikrofon abgreifen kann. Sonderwege
        (z. B. eigenes Routing) bleiben davon unbenommen möglich.
      </p>
      {downloadFuss(onDownload)}
    </div>
  );
}

/**
 * Sagt dauerhaft, was in Zoom zu wählen ist (#208; vorher CableStatus). Vor der ersten Geräteliste nichts (devicesLoaded: sonst
 * meldete eine gemerkte Ausgabe-ID fälschlich „nicht verfügbar“, #208).
 */
function kabelKarten(s: OberflaechenStand, onDownload: () => void): ReactNode {
  const g = s.geraete;
  if (g === undefined) return null;

  if (!g.labelsAvailable) {
    return hinweis(
      'warn',
      <>
        Gerätenamen nicht lesbar — bitte die Mikrofonfreigabe erteilen. Ohne sie kann der Interpreter das
        virtuelle Kabel nicht erkennen.
      </>,
    );
  }

  // `engine.route()` läuft nur in `start()` — stellt der Operator die Ausgabe während des Betriebs um, sendet der Mix unverändert
  // auf das beim Start gewählte Gerät weiter. Die Anzeige richtet sich deshalb nach dem GESTARTETEN Gerät, nicht nach dem
  // aktuellen Wert der Wahl, und bekommt zusätzlich einen eigenen Hinweis, dass die Umstellung noch nicht wirkt.
  const outputId = s.einstellungen?.outputId ?? '';
  const running = s.engine?.running ?? false;
  const startedOutputId = s.engine?.startedOutputId ?? null;
  const pendingChange = running && startedOutputId !== null && outputId !== startedOutputId;
  const effectiveOutputId = running && startedOutputId !== null ? startedOutputId : outputId;

  return (
    <>
      {pendingChange &&
        hinweis(
          'warn',
          <>
            Das Ausgabegerät wurde geändert, der Interpreter sendet aber noch auf das beim Start gewählte Gerät.
            Die Änderung wirkt erst, wenn er <strong>gestoppt und erneut gestartet</strong> wird.
          </>,
        )}
      {geraetKarte(effectiveOutputId, g.ausgaenge, g.eingaenge, onDownload)}
    </>
  );
}

/** Ein Meter: Beschriftung, Pegel („-23.4 dB“ bzw. „—“), Balken auf der dunklen Spur, optional die Schwellenmarke. */
function meter(id: string, label: string, db: number, schwelleDb?: number): React.JSX.Element {
  return (
    <div data-interpreter={id} className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]">
        <span>{label}</span>
        <span data-interpreter="wert" className="tabular-nums">
          {Number.isFinite(db) ? T.live.pegelWert(db) : T.live.keinPegel}
        </span>
      </div>
      {/* Die Spur ist eine dunkle Insel (Klasse dark: die Tokens darin lösen in Hell und Dunkel dunkel auf, wie eine Pegelbrücke):
          --muted wie die alte Spur bg-neutral-800, die Schwelle in --destructive des dunklen Satzes (in Hell sonst unter 3 : 1 auf
          der Spur), der Balken in Markengelb wie bisher. */}
      <div data-interpreter="spur" className="dark relative h-3 overflow-hidden rounded bg-[var(--muted)]">
        <div data-interpreter="balken" className="h-full bg-[var(--brand-yellow)] transition-[width] duration-75" style={{ width: `${meterBreite(db) * 100}%` }} />
        {schwelleDb !== undefined && (
          <div
            data-interpreter="schwelle"
            title={T.live.schwelle(schwelleDb)}
            className="absolute inset-y-0 w-0.5 bg-[var(--destructive)]"
            style={{ left: `${meterBreite(schwelleDb) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function LiveBereich({
  stand,
  schwelleDb,
  aktionen,
}: {
  stand: OberflaechenStand;
  /** Eingestellte Schwelle (Marke im Dolmetscher-Meter). */
  schwelleDb: number;
  aktionen: LiveAktionen;
}): React.JSX.Element {
  const e = stand.engine;
  const ducking = e?.ducking === true;
  return (
    <section data-interpreter="live" className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-4">
      <div data-interpreter="kopfzeile" className="flex items-start gap-3">
        <div data-interpreter="pegel" className="min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{T.live.pegel}</span>
            <span className="flex flex-wrap items-center gap-2">
              <span
                data-interpreter="pille"
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold',
                  ducking
                    ? 'border-[var(--tally-selected)] bg-[var(--brand-yellow)] text-[var(--brand-dark)]'
                    : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
                )}
              >
                {e === undefined ? UNBEKANNT : ducking ? T.live.abgesenkt : T.live.offen}
              </span>
              {stand.einstellungen?.bypass ? (
                <span data-interpreter="ueberbrueckt" className="inline-flex">
                  <StatusPill state="warn" text={T.live.ueberbrueckt} />
                </span>
              ) : null}
            </span>
          </div>
          {meter('meter-floor', T.geraete.floorKurz, e?.floorDb ?? -Infinity)}
          {meter('meter-dolmetscher', T.geraete.dolmetscher, e?.interpreterDb ?? -Infinity, schwelleDb)}
        </div>
        <div data-interpreter="taste" className="w-56 shrink-0">
          <TallyButton {...liveTaste(stand, aktionen)} />
        </div>
      </div>

      {e?.error ? (
        <div data-interpreter="fehler" className="rounded-[var(--radius-lg)] border border-[var(--status-error)]/60 bg-[var(--status-error)]/10 p-3 text-sm text-[var(--foreground)] select-text">
          {e.error}
        </div>
      ) : null}

      <div data-interpreter="kabel" className="flex flex-col gap-3">
        {kabelKarten(stand, aktionen.kabelHerunterladen)}
      </div>
    </section>
  );
}
