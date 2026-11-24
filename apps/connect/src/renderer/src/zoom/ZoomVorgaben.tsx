// Panel-Abschnitt „Zoom-Vorgaben“ (UX Welle 2b, Connect d2; B20, B8; Spec 7.5 Nr. 8, 7.6, #287): bis Task 24 im Slot-Bereich der
// Zoom-Karte hinter „Vorgaben …“ und „Sprecher-Einstellungen …“ (SlotBereich.tsx:190-293), jetzt offen im Panel: die Vorgaben für
// neue Slots (T77, Auflösung, Ton), der Schalter „Person im NDI-Namen“ samt Tooltip und die Sprecher-Einstellungen (Signal,
// Haltezeit mit T73, ungültig T74). Vorgaben und Schalter werden sofort gesendet wie bisher (sie gelten erst für neue Slots); das
// Sprecher-Signal wirkt sofort auf laufende Sprecher-Slots und wählt darum nur einen Entwurf, erst „Setzen“ sendet ihn (sprecherWahl,
// Wahl ≠ Bewegung, Nachtrag Task 25 zu Befund 11). Eine Ablehnung steht hier am Ort „vorgaben“ (vorher im Kopf der Slots). Ohne
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

/**
 * Sprecher-Signal (Wahl ≠ Bewegung): ein Optionsfeld (auch per Pfeiltaste) wählt nur einen Entwurf, erst „Setzen“ sendet ihn mit der
 * gemeldeten Haltezeit über dieselbe speakerConfig wie bisher. Der Entwurf gilt nur, solange das gemeldete Signal das ist, gegen das
 * er gewählt wurde; nach gelungenem „Setzen“ zeigt die Gruppe den gesendeten Wert bis zur Meldung, eine Ablehnung lässt ihn stehen.
 * Gesperrt ist „Setzen“ ohne Abweichung und solange der Aufruf läuft (`beschaeftigt`). Rein, damit das Panel ohne Effekt bleibt (B8).
 */
export function sprecherWahl(a: {
  gemeldet: ZoomSprecherEinstellung;
  entwurf: SignalEntwurf | null;
  setzeEntwurf(f: (e: SignalEntwurf | null) => SignalEntwurf | null): void;
  beschaeftigt: boolean;
  sende(s: ZoomSprecherEinstellung): Promise<boolean>;
}): { wert: ZoomSprecherSignal; setzenGrund: string | undefined; waehlen(s: ZoomSprecherSignal): void; setzen(): Promise<void> } {
  const T = CONNECT_TEXTE.wahl;
  const gueltig = a.entwurf !== null && a.entwurf.basis === a.gemeldet.signal ? a.entwurf : null;
  const offen = gueltig !== null && !gueltig.gesendet && gueltig.wert !== a.gemeldet.signal ? gueltig : null;
  const setzenGrund = a.beschaeftigt ? T.sendet : offen === null ? T.sprecherUnveraendert : undefined;
  return {
    wert: gueltig?.wert ?? a.gemeldet.signal,
    setzenGrund,
    waehlen: (s) => a.setzeEntwurf(() => (s === a.gemeldet.signal ? null : { wert: s, basis: a.gemeldet.signal, gesendet: false })),
    setzen: async () => {
      if (setzenGrund !== undefined || offen === null) return;
      const ok = await a.sende({ ...a.gemeldet, signal: offen.wert });
      if (ok) a.setzeEntwurf((alt) => (alt !== null && alt.wert === offen.wert ? { ...alt, gesendet: true } : alt));
    },
  };
}

export function ZoomVorgaben({ a, zoom }: { a: ZoomAbbild; zoom: ZoomAufrufe }): JSX.Element {
  /** Eingabe der Haltezeit in Sekunden; null = der gespeicherte Wert. */
  const [haltezeit, setHaltezeit] = useState<string | null>(null);
  const [haltezeitFehler, setHaltezeitFehler] = useState(false);
  const laeuft = zoom.laeuft;
  const auf = vorgabenAufrufe(zoom, () => window.jmconnect);
  const sendeSprecher = (s: ZoomSprecherEinstellung): Promise<boolean> => auf.sprecher(s).then((r) => r.ok);
  const [signalEntwurf, setSignalEntwurf] = useState<SignalEntwurf | null>(null);
  const signal = sprecherWahl({ gemeldet: a.sprecher, entwurf: signalEntwurf, setzeEntwurf: setSignalEntwurf, beschaeftigt: laeuft.has('sprecher'), sende: sendeSprecher });
  // Haltezeit: eine Zahl in Sekunden (Komma oder Punkt). Keine Zahl → T74 hier; Bereich und Schritt prüft der Kern (T74, KF7).
  const uebernimmHaltezeit = (): void => {
    if (haltezeit === null) return;
    const s = Number(haltezeit.trim().replace(',', '.'));
    if (haltezeit.trim() === '' || !Number.isFinite(s)) {
      setHaltezeitFehler(true);
      return;
    }
    setHaltezeitFehler(false);
    void sendeSprecher({ ...a.sprecher, haltezeitMs: Math.round(s * 1000) }).then((ok) => {
      if (ok) setHaltezeit(null);
    });
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
            value={haltezeit ?? String(a.sprecher.haltezeitMs / 1000)}
            onChange={(ev) => {
              setHaltezeit(ev.target.value);
              setHaltezeitFehler(false);
            }}
            onBlur={uebernimmHaltezeit}
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
