// Zoom-Slots in der Zoom-Karte (Spec 7.5 Nr. 8, 7.6, 7.7; Task B21): Kopf mit T31, „Slot hinzufügen“, „Vorgaben …“,
// Schalter „Vorschau“, „Sprecher-Einstellungen …“, die Lage der Einstellungsdatei (T90, T92) und die Kacheln, zwei Spalten
// bei breitem, eine bei schmalem Bereich (Container-Query, B-EP9). Dazu die Angabe je Zeile der Teilnehmerliste (7.5 Nr. 9,
// 10.10). Alle Texte aus @shared/zoom-text (B-EP4); hier steht kein Text-Literal.
import { useEffect, useRef, useState } from 'react';
import { SLOT_NR_MAX, SLOT_RESOLUTIONS } from '@jm/zoom-bridge/protocol';
import type { ZoomAbbild, ZoomParticipant, ZoomSlotAufloesung, ZoomSprecherEinstellung, ZoomSprecherSignal } from '@shared/types';
import {
  BEDIEN_TEXT, EINSTELLUNG_TEXT, HALTEZEIT_UNGUELTIG, SLOT_FELD, SLOT_TEXT, SPRECHER_TEXT, TEXT_A4_SCHREIBFEHLER,
  slotKopfZeile, teilnehmerSlotAngabe, teilnehmerSlotEingabe,
} from '@shared/zoom-text';
import { AntwortZeile, SlotKachel, type GemerkteVorschau } from './SlotKachel';
import { MitTooltip, STIL, type SlotAufrufe } from './SlotEinstellungen';

/**
 * Letzte Vorschau je Slot aus dem Push (Spec 7.7). Gemerkt mit Empfangszeit, Modus und Ziel-Namen; verworfen, sobald sich
 * Modus oder Ziel-Name des Slots ändern oder das Abbild keine Größe dieses Ziels mehr kennt (`zuletzt` null: Umhängen, B55).
 * So zeigt die Kachel nur Bilder des aktuellen Ziels (B53). `jetzt` tickt, solange Bilder gemerkt sind (Frische 1,5 s).
 */
function useVorschauBilder(a: ZoomAbbild): { bilder: ReadonlyMap<number, GemerkteVorschau>; jetzt: number } {
  const [bilder, setBilder] = useState<ReadonlyMap<number, GemerkteVorschau>>(() => new Map());
  const [jetzt, setJetzt] = useState(() => Date.now());
  const lagen = useRef(a.slots);
  lagen.current = a.slots;
  useEffect(
    () =>
      window.jmconnect.onZoomVorschauBild((b) => {
        const l = lagen.current.find((x) => x.einstellung.nr === b.nr);
        if (!l) return;
        setBilder((m) => new Map(m).set(b.nr, { ziel: b.ziel, jpeg: b.jpeg, zeit: Date.now(), modus: l.einstellung.modus, zielName: l.zielName }));
      }),
    [],
  );
  useEffect(() => {
    if (bilder.size === 0) return;
    const t = setInterval(() => setJetzt(Date.now()), 500);
    return () => clearInterval(t);
  }, [bilder.size]);
  useEffect(() => {
    setBilder((m) => {
      let neu: Map<number, GemerkteVorschau> | null = null;
      for (const [nr, v] of m) {
        const l = a.slots.find((x) => x.einstellung.nr === nr);
        if (!l || l.einstellung.modus !== v.modus || l.zielName !== v.zielName || l.zuletzt === null) {
          neu ??= new Map(m);
          neu.delete(nr);
        }
      }
      return neu ?? m;
    });
  }, [a.slots]);
  return { bilder, jetzt };
}

/** Angabe je Zeile der Teilnehmerliste (Spec 7.5 Nr. 9, 10.10): Knopf „Als Slot laden“ (T38, im Warteraum T98) oder T39–T39d. */
export function TeilnehmerSlotAngabe({
  t,
  a,
  imMeeting,
  aufrufe,
}: {
  t: ZoomParticipant;
  a: ZoomAbbild;
  imMeeting: boolean;
  aufrufe: SlotAufrufe;
}): JSX.Element {
  const angabe = teilnehmerSlotAngabe(teilnehmerSlotEingabe(t, a.slots));
  if (!angabe.knopf) return <span className="text-xs text-neutral-400">{angabe.text}</span>;
  const schluessel = `alsSlot:${t.id}`;
  return (
    <MitTooltip titel={angabe.tooltip ?? undefined}>
      <button
        disabled={t.imWarteraum || !imMeeting || aufrufe.laeuft.has(schluessel)}
        onClick={() =>
          aufrufe.starte(schluessel, `zeile:${t.id}`, (trotz) => window.jmconnect.zoomSlotAusPerson({ teilnehmerId: t.id, trotz }))
        }
        className={STIL.gelb}
      >
        {angabe.text}
      </button>
    </MitTooltip>
  );
}

export function SlotBereich({ a, aufrufe }: { a: ZoomAbbild; aufrufe: SlotAufrufe }): JSX.Element {
  const [vorgabenAuf, setVorgabenAuf] = useState(false);
  const [sprecherAuf, setSprecherAuf] = useState(false);
  /** Eingabe der Haltezeit in Sekunden; null = der gespeicherte Wert. */
  const [haltezeit, setHaltezeit] = useState<string | null>(null);
  const [haltezeitFehler, setHaltezeitFehler] = useState(false);
  const { bilder, jetzt } = useVorschauBilder(a);
  const slots = [...a.slots].sort((x, y) => x.einstellung.nr - y.einstellung.nr);
  const voll = a.slots.length >= SLOT_NR_MAX;
  const sendeSprecher = (s: ZoomSprecherEinstellung): Promise<boolean> =>
    aufrufe.fuehreAus('sprecher', 'slots', () => window.jmconnect.zoomSprecher(s)).then((r) => r.ok);
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
  return (
    <section className="mb-3 rounded-lg border border-neutral-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{BEDIEN_TEXT.zoomSlots}</h3>
        <span className="text-xs text-neutral-400">{slotKopfZeile(a.slots.length, a.kurz.slotsAn, a.kurz.slotsLaufen)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <MitTooltip titel={voll ? SLOT_TEXT.hoechstens : undefined}>
          <button
            disabled={voll || aufrufe.laeuft.has('anlegen')}
            onClick={() => void aufrufe.fuehreAus('anlegen', 'slots', () => window.jmconnect.zoomSlotAnlegen())}
            className={STIL.gelb}
          >
            {BEDIEN_TEXT.slotHinzufuegen}
          </button>
        </MitTooltip>
        <button onClick={() => setVorgabenAuf((v) => !v)} className={STIL.rand}>
          {BEDIEN_TEXT.vorgaben}
        </button>
        <label className="flex items-center gap-1 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={a.vorschauAn}
            disabled={aufrufe.laeuft.has('vorschau')}
            onChange={(ev) => {
              const an = ev.target.checked;
              void aufrufe.fuehreAus('vorschau', 'slots', () => window.jmconnect.zoomVorschauSchalten({ an }));
            }}
          />
          {BEDIEN_TEXT.vorschau}
        </label>
        <button onClick={() => setSprecherAuf((v) => !v)} className={STIL.rand}>
          {BEDIEN_TEXT.sprecherEinstellungen}
        </button>
      </div>
      {vorgabenAuf && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-neutral-800 p-2 text-xs text-neutral-300">
          <span>{SLOT_FELD.vorgaben(a.vorgaben.aufloesung, a.vorgaben.tonAn)}</span>
          <label className="flex items-center gap-1">
            {SLOT_FELD.aufloesung}
            <select
              value={a.vorgaben.aufloesung}
              disabled={aufrufe.laeuft.has('vorgaben')}
              onChange={(ev) => {
                const aufloesung = ev.target.value as ZoomSlotAufloesung;
                void aufrufe.fuehreAus('vorgaben', 'slots', () => window.jmconnect.zoomSlotVorgaben({ ...a.vorgaben, aufloesung }));
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
              disabled={aufrufe.laeuft.has('vorgaben')}
              onChange={(ev) => {
                const tonAn = ev.target.checked;
                void aufrufe.fuehreAus('vorgaben', 'slots', () => window.jmconnect.zoomSlotVorgaben({ ...a.vorgaben, tonAn }));
              }}
            />
            {SLOT_FELD.ton}
          </label>
        </div>
      )}
      {sprecherAuf && (
        <div className="mt-2 space-y-1 rounded border border-neutral-800 p-2 text-xs text-neutral-300">
          {(Object.keys(SPRECHER_TEXT.signal) as ZoomSprecherSignal[]).map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input
                type="radio"
                name="zoom-sprecher-signal"
                checked={a.sprecher.signal === s}
                disabled={aufrufe.laeuft.has('sprecher')}
                onChange={() => void sendeSprecher({ ...a.sprecher, signal: s })}
              />
              {SPRECHER_TEXT.signal[s]}
            </label>
          ))}
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
          {haltezeitFehler && <p className="text-red-300">{HALTEZEIT_UNGUELTIG}</p>}
        </div>
      )}
      <AntwortZeile aufrufe={aufrufe} ort="slots" />
      {a.einstellungen.gesichert !== null && <p className="mt-2 text-xs text-yellow-200">{EINSTELLUNG_TEXT.unlesbar(a.einstellungen.gesichert)}</p>}
      {a.einstellungen.nurSitzung && <p className="mt-2 text-xs text-yellow-200">{TEXT_A4_SCHREIBFEHLER}</p>}
      {slots.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-400">{SLOT_TEXT.keineSlots}</p>
      ) : (
        <div className="@container mt-3">
          <div className="grid gap-3 @[34rem]:grid-cols-2">
            {slots.map((l) => (
              <SlotKachel key={l.einstellung.nr} lage={l} a={a} vorschau={bilder.get(l.einstellung.nr)} jetzt={jetzt} aufrufe={aufrufe} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
