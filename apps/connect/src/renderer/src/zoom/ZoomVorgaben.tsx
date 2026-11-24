// Panel-Abschnitt „Zoom-Vorgaben“ (UX Welle 2b, Connect d2; B20, B8; Spec 7.5 Nr. 8, 7.6, #287): bis Task 24 im Slot-Bereich der
// Zoom-Karte hinter „Vorgaben …“ und „Sprecher-Einstellungen …“ (SlotBereich.tsx:190-293), jetzt offen im Panel: die Vorgaben für
// neue Slots (T77, Auflösung, Ton), der Schalter „Person im NDI-Namen“ samt Tooltip und die Sprecher-Einstellungen (Signal,
// Haltezeit mit T73, ungültig T74). Vorgaben und Schalter werden sofort gesendet wie bisher (sie gelten erst für neue Slots); das
// Sprecher-Signal wirkt sofort auf laufende Sprecher-Slots und wählt darum nur einen Entwurf, erst „Setzen“ sendet ihn (sprecherWahl,
// Wahl ≠ Bewegung, Nachtrag Task 25 zu Befund 11). Die Haltezeit ebenso (Gesamtprüfung UX Welle 2b, I4): Tippen hält einen Entwurf,
// Enter übernimmt nur die Haltezeit, „Setzen“ Signal und Haltezeit in einem Aufruf, Verlassen des Felds nichts. Eine Ablehnung steht hier am Ort „vorgaben“ (vorher im Kopf der Slots). Ohne
// Effekt (B8): Abbild aus stand.zoom, laufende Aufrufe und Antwort als ZoomAufrufe aus der Wurzel-View; lokal nur die Entwürfe von
// Haltezeit und Signal. Texte aus @shared/zoom-text (B-EP4), der Knopf aus PEERS_TEXTE, seine Sperrgründe aus CONNECT_TEXTE.wahl.
import { useState } from 'react';
import { PEERS_TEXTE } from '@jm/settings';
import { Button } from '@jm/ui';
import { SLOT_RESOLUTIONS } from '@jm/zoom-bridge/protocol';
import type { JmConnectApi, ZoomAbbild, ZoomSlotAufloesung, ZoomSlotVorgaben, ZoomSprecherEinstellung, ZoomSprecherSignal } from '@shared/types';
import { BEDIEN_TEXT, HALTEZEIT_UNGUELTIG, PERSON_IM_NDI_NAMEN_TOOLTIP, SLOT_FELD, SPRECHER_TEXT } from '@shared/zoom-text';
import { CONNECT_TEXTE } from '@/lib/oberflaeche';
import { antwortAm, type ZoomAufrufe } from './aufrufe';
import { MitTooltip, STIL } from './SlotEinstellungen';

/** Die Aufrufe der Vorgaben, die ZoomVorgaben braucht. */
export type VorgabenApi = Pick<JmConnectApi, 'zoomSlotVorgaben' | 'zoomPersonImNdiNamen' | 'zoomSprecher'>;

/**
 * Die Aufrufe der Zoom-Vorgaben (rein, ohne window): die Schlüssel des Doppelklick-Schutzes wie bisher (Nr. 103: `vorgaben`,
 * `personImNdiNamen`, `sprecher`), die Antwort am Ort „vorgaben“. `api` liefert erst beim Aufruf das Ziel (window.jmconnect).
 */
export function vorgabenAufrufe(zoom: Pick<ZoomAufrufe, 'fuehreAus'>, api: () => VorgabenApi) {
  return {
    vorgaben: (v: ZoomSlotVorgaben) => zoom.fuehreAus('vorgaben', 'vorgaben', () => api().zoomSlotVorgaben(v)),
    personImNdiNamen: (an: boolean) => zoom.fuehreAus('personImNdiNamen', 'vorgaben', () => api().zoomPersonImNdiNamen({ an })),
    sprecher: (s: ZoomSprecherEinstellung) => zoom.fuehreAus('sprecher', 'vorgaben', () => api().zoomSprecher(s)),
  };
}

/** Entwurf des Sprecher-Signals: der gewählte Wert und das gemeldete Signal, gegen das er gewählt wurde; `gesendet` nach „Setzen“. */
export interface SignalEntwurf {
  wert: ZoomSprecherSignal;
  basis: ZoomSprecherSignal;
  gesendet: boolean;
}

/** Entwurf der Haltezeit (I4): der getippte Text in Sekunden und die gemeldete Haltezeit, gegen die getippt wurde; `gesendet` nach Erfolg. */
export interface HaltezeitEntwurf {
  text: string;
  basis: number;
  gesendet: boolean;
}

/** Getippte Sekunden (Komma oder Punkt) in ms; keine Zahl → undefined (T74 hier, Bereich und Schritt prüft der Kern, KF7). */
function haltezeitMs(text: string): number | undefined {
  const s = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(s) ? undefined : Math.round(s * 1000);
}

/** Was der Sprecher-Block zeigt und auslöst (sprecherWahl). */
export interface SprecherBedienung {
  wert: ZoomSprecherSignal;
  /** Angezeigte Haltezeit in Sekunden: der gültige Entwurf, sonst der gemeldete Wert. */
  haltezeitText: string;
  /** Der Entwurf der Haltezeit ist keine Zahl (T74). */
  haltezeitUngueltig: boolean;
  setzenGrund: string | undefined;
  waehlen(s: ZoomSprecherSignal): void;
  /** Feld Haltezeit: Tippen ändert nur den Entwurf. */
  tippen(text: string): void;
  /** „Setzen“: Signal und Haltezeit in einem Aufruf; mit `nur` (Enter im Feld) nur die Haltezeit. */
  setzen(nur?: 'haltezeit'): Promise<void>;
}

/**
 * Sprecher-Signal und Haltezeit (Wahl ≠ Bewegung): ein Optionsfeld (auch per Pfeiltaste) wählt nur einen Entwurf, die Haltezeit
 * (Gesamtprüfung UX Welle 2b, I4) ebenso; erst „Setzen“ sendet beides über dieselbe speakerConfig wie bisher, Enter im Feld nur die
 * Haltezeit, das Verlassen des Felds nichts. Ein Entwurf gilt nur, solange der gemeldete Wert der ist, gegen den er gewählt bzw.
 * getippt wurde; nach gelungenem Senden zeigt der Block den gesendeten Wert bis zur Meldung, eine Ablehnung lässt ihn stehen.
 * Gesperrt ist „Setzen“ ohne Abweichung, bei einer Haltezeit, die keine Zahl ist (T74), und solange der Aufruf läuft
 * (`beschaeftigt`). Rein, damit das Panel ohne Effekt bleibt (B8).
 */
export function sprecherWahl(a: {
  gemeldet: ZoomSprecherEinstellung;
  entwurf: SignalEntwurf | null;
  setzeEntwurf(f: (e: SignalEntwurf | null) => SignalEntwurf | null): void;
  haltezeit?: HaltezeitEntwurf | null;
  setzeHaltezeit?(f: (h: HaltezeitEntwurf | null) => HaltezeitEntwurf | null): void;
  beschaeftigt: boolean;
  sende(s: ZoomSprecherEinstellung): Promise<boolean>;
}): SprecherBedienung {
  const T = CONNECT_TEXTE.wahl;
  const gueltig = a.entwurf !== null && a.entwurf.basis === a.gemeldet.signal ? a.entwurf : null;
  const offen = gueltig !== null && !gueltig.gesendet && gueltig.wert !== a.gemeldet.signal ? gueltig : null;
  const h = a.haltezeit !== undefined && a.haltezeit !== null && a.haltezeit.basis === a.gemeldet.haltezeitMs ? a.haltezeit : null;
  const hMs = h === null ? undefined : haltezeitMs(h.text);
  const hUngueltig = h !== null && !h.gesendet && hMs === undefined;
  const hOffen = h !== null && !h.gesendet && hMs !== undefined && hMs !== a.gemeldet.haltezeitMs;
  const gemeldetText = String(a.gemeldet.haltezeitMs / 1000);
  const setzenGrund = a.beschaeftigt ? T.sendet : hUngueltig ? HALTEZEIT_UNGUELTIG : offen === null && !hOffen ? T.sprecherUnveraendert : undefined;
  return {
    wert: gueltig?.wert ?? a.gemeldet.signal,
    haltezeitText: h?.text ?? gemeldetText,
    haltezeitUngueltig: hUngueltig,
    setzenGrund,
    waehlen: (s) => a.setzeEntwurf(() => (s === a.gemeldet.signal ? null : { wert: s, basis: a.gemeldet.signal, gesendet: false })),
    tippen: (text) => a.setzeHaltezeit?.(() => (text === gemeldetText ? null : { text, basis: a.gemeldet.haltezeitMs, gesendet: false })),
    setzen: async (nur) => {
      if (setzenGrund !== undefined) return;
      const mitSignal = nur === undefined && offen !== null;
      const mitHaltezeit = hOffen && hMs !== undefined;
      if (!mitSignal && !mitHaltezeit) return;
      const signal = mitSignal && offen !== null ? offen.wert : a.gemeldet.signal;
      const ms = mitHaltezeit && hMs !== undefined ? hMs : a.gemeldet.haltezeitMs;
      const ok = await a.sende({ ...a.gemeldet, signal, haltezeitMs: ms });
      if (!ok) return;
      if (mitSignal) a.setzeEntwurf((alt) => (alt !== null && alt.wert === signal ? { ...alt, gesendet: true } : alt));
      if (mitHaltezeit && h !== null) a.setzeHaltezeit?.((alt) => (alt !== null && alt.text === h.text ? { ...alt, gesendet: true } : alt));
    },
  };
}

export function ZoomVorgaben({ a, zoom }: { a: ZoomAbbild; zoom: ZoomAufrufe }): JSX.Element {
  /** Entwurf der Haltezeit (I4); null = der gemeldete Wert. */
  const [haltezeit, setHaltezeit] = useState<HaltezeitEntwurf | null>(null);
  const [haltezeitFehler, setHaltezeitFehler] = useState(false);
  const laeuft = zoom.laeuft;
  const auf = vorgabenAufrufe(zoom, () => window.jmconnect);
  const sendeSprecher = (s: ZoomSprecherEinstellung): Promise<boolean> => auf.sprecher(s).then((r) => r.ok);
  const [signalEntwurf, setSignalEntwurf] = useState<SignalEntwurf | null>(null);
  const signal = sprecherWahl({
    gemeldet: a.sprecher,
    entwurf: signalEntwurf,
    setzeEntwurf: setSignalEntwurf,
    haltezeit,
    setzeHaltezeit: setHaltezeit,
    beschaeftigt: laeuft.has('sprecher'),
    sende: sendeSprecher,
  });
  // Enter im Feld Haltezeit: nur die Haltezeit setzen. Keine Zahl → T74 hier; Bereich und Schritt prüft der Kern (T74, KF7).
  const uebernimmHaltezeit = (): void => {
    if (signal.haltezeitUngueltig) {
      setHaltezeitFehler(true);
      return;
    }
    setHaltezeitFehler(false);
    void signal.setzen('haltezeit');
  };
  const antwort = antwortAm(zoom, 'vorgaben');
  return (
    <div data-connect="zoom-vorgaben" className="space-y-3 text-xs text-[var(--foreground)]">
      <div className="flex flex-wrap items-center gap-3">
        <span>{SLOT_FELD.vorgaben(a.vorgaben.aufloesung, a.vorgaben.tonAn)}</span>
        <label className="flex items-center gap-1">
          {SLOT_FELD.aufloesung}
          <select
            value={a.vorgaben.aufloesung}
            disabled={laeuft.has('vorgaben')}
            onChange={(ev) => {
              const aufloesung = ev.target.value as ZoomSlotAufloesung;
              void auf.vorgaben({ ...a.vorgaben, aufloesung });
            }}
            className={STIL.inp}
          >
            {SLOT_RESOLUTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={a.vorgaben.tonAn}
            disabled={laeuft.has('vorgaben')}
            onChange={(ev) => {
              const tonAn = ev.target.checked;
              void auf.vorgaben({ ...a.vorgaben, tonAn });
            }}
          />
          {SLOT_FELD.ton}
        </label>
      </div>
      <MitTooltip titel={PERSON_IM_NDI_NAMEN_TOOLTIP}>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={a.personImNdiNamen}
            disabled={laeuft.has('personImNdiNamen')}
            onChange={(ev) => {
              const an = ev.target.checked;
              void auf.personImNdiNamen(an);
            }}
          />
          {BEDIEN_TEXT.personImNdiNamen}
        </label>
      </MitTooltip>
      <div className={`space-y-1 ${STIL.kasten}`}>
        {(Object.keys(SPRECHER_TEXT.signal) as ZoomSprecherSignal[]).map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input
              type="radio"
              name="zoom-sprecher-signal"
              checked={signal.wert === s}
              disabled={laeuft.has('sprecher')}
              onChange={() => signal.waehlen(s)}
            />
            {SPRECHER_TEXT.signal[s]}
          </label>
        ))}
        <div data-connect="sprecher-setzen" className="flex justify-end">
          <MitTooltip titel={signal.setzenGrund}>
            <Button size="sm" uppercase={false} variant="outline" disabled={signal.setzenGrund !== undefined} onClick={() => void signal.setzen()}>
              {PEERS_TEXTE.setzen}
            </Button>
          </MitTooltip>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={signal.haltezeitText}
            onChange={(ev) => {
              signal.tippen(ev.target.value);
              setHaltezeitFehler(false);
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') uebernimmHaltezeit();
            }}
            className={`${STIL.inp} w-20`}
          />
          <span>{SPRECHER_TEXT.T73(a.sprecher.haltezeitMs)}</span>
        </label>
        {haltezeitFehler && <p className={STIL.fehler}>{HALTEZEIT_UNGUELTIG}</p>}
      </div>
      {antwort && <p className={STIL.fehler}>{antwort}</p>}
    </div>
  );
}
