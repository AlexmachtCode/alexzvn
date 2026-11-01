// Einstellungen eines Zoom-Slots (Spec 7.5 Nr. 8 „Einstellungen“, 7.6; Task B21) und die gemeinsamen Bausteine der
// Slot-Komponenten (Stil, Tooltip-Rahmen, Kennzeichen, Aufruf-Typen). Diese Datei importiert keine der anderen
// Slot-Komponenten, darum entsteht kein Kreis-Import (SlotKachel und SlotBereich importieren von hier).
// Alle Nutzertexte kommen aus @shared/zoom-text (B-EP4); hier steht kein Text-Literal.
import { useState } from 'react';
import { SLOT_RESOLUTIONS } from '@jm/zoom-bridge/protocol';
import type {
  ZoomErgebnis, ZoomParticipant, ZoomSlotAufloesung, ZoomSlotEinstellung, ZoomSlotErsatzbild, ZoomSlotLage, ZoomSlotModus,
} from '@shared/types';
import { BEDIEN_TEXT, ERSATZBILD_FELD, ERSATZBILD_NAME, loeschenFrage, MODUS_NAME, SLOT_FELD, SLOT_TEXT } from '@shared/zoom-text';

/** Wo eine abgelehnte Antwort erscheint: 'slots' = Kopf des Slot-Bereichs, sonst Kachel bzw. Zeile der Teilnehmerliste (7.5). */
export type SlotOrt = 'slots' | `slot:${number}` | `zeile:${number}`;
/** Nachfrage ab dem 6. eingeschalteten Slot (Spec 7.4): Text T40 vom Kern, „Trotzdem einschalten“ wiederholt mit trotz. */
export interface SlotNachfrage { ort: SlotOrt; text: string; trotzdem: () => void }
/** Was die Zoom-Karte den Slot-Komponenten gibt: ein Doppelklick-Schutz, ein Antwortort, eine Nachfrage (7.5). */
export interface SlotAufrufe {
  laeuft: ReadonlySet<string>;
  fuehreAus: (schluessel: string, ort: SlotOrt, f: () => Promise<ZoomErgebnis>) => Promise<ZoomErgebnis>;
  starte: (schluessel: string, ort: SlotOrt, f: (trotz: boolean) => Promise<ZoomErgebnis>) => void;
  antwortText: (ort: SlotOrt) => string | null;
  nachfrage: SlotNachfrage | null;
  nachfrageWeg: () => void;
}
/** Antwort mit Nachfrage (ZoomStartErgebnis, Spec 7.4): `{ ok: false, nachfrage: true, text }`. */
export function istNachfrage(r: ZoomErgebnis): r is { ok: false; text: string; nachfrage: true } {
  return !r.ok && (r as { nachfrage?: unknown }).nachfrage === true;
}

const KNOPF = 'rounded px-2 py-1 text-xs font-semibold disabled:opacity-40';
/** Klassen wie in ZoomCard.tsx (Rand-, Gelb-, Rot-Knopf, Eingabefeld). */
export const STIL = {
  rand: `${KNOPF} border border-neutral-700 text-neutral-200 hover:bg-neutral-800`,
  gelb: `${KNOPF} bg-yellow-400 text-neutral-900`,
  rot: `${KNOPF} bg-red-700 text-white`,
  inp: 'rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 disabled:opacity-50',
} as const;

/** Gesperrte Knöpfe bekommen in Chromium keine Mausereignisse; der Tooltip sitzt darum am Rahmen (wie ZoomCard.tsx). */
export function MitTooltip({ titel, children }: { titel: string | undefined; children: JSX.Element }): JSX.Element {
  return (
    <span title={titel} className="inline-flex">
      {children}
    </span>
  );
}

export function Kennzeichen({ children }: { children: string }): JSX.Element {
  return <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold text-neutral-300">{children}</span>;
}

/** Die vier Ersatzbild-Einstellungen in der Reihenfolge von T4 (Werte, keine Texte; die Namen liefert ERSATZBILD_NAME). */
const ERSATZBILDER: readonly ZoomSlotErsatzbild[] = ['transparent', 'eingefroren', 'schwarz', 'weiss'];
type Aenderung = Partial<Omit<ZoomSlotEinstellung, 'nr' | 'an'>>;

/**
 * Felder eines Slots (7.5 Nr. 8): NDI-Name (gesperrt, solange der Slot an ist, T35), Modus, Person (nur Teilnehmer, mit
 * Vorschlägen aus der Teilnehmerliste, freie Eingabe), Auflösung, Ersatzbild, Ton an/aus und Tonart (Person nur im Modus
 * Teilnehmer), Computerton (nur Freigabe), „Teilnehmer ohne Kamera zeigen“ (nur Sprecher), „Löschen“ (nur ausgeschaltet,
 * T36, Rückfrage T37). Jede Änderung geht sofort an zoomSlotAendern; der Kern speichert sie und schickt im Meeting slotSet
 * (B-EP21). Den Text einer Ablehnung (T43–T47 …) zeigt die Kachel am Ort `slot:<nr>`.
 */
export function SlotEinstellungen({
  lage,
  teilnehmer,
  aufrufe,
}: {
  lage: ZoomSlotLage;
  teilnehmer: readonly ZoomParticipant[];
  aufrufe: SlotAufrufe;
}): JSX.Element {
  const e = lage.einstellung;
  const nr = e.nr;
  const ort: SlotOrt = `slot:${nr}`;
  /** null = unverändert, dann gilt der gespeicherte Wert. */
  const [ndiName, setNdiName] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const schluessel = `aendern:${nr}`;
  const beschaeftigt = aufrufe.laeuft.has(schluessel);
  const aendere = (aenderung: Aenderung): Promise<ZoomErgebnis> =>
    aufrufe.fuehreAus(schluessel, ort, () => window.jmconnect.zoomSlotAendern({ nr, aenderung }));
  const uebernimmName = (): void => {
    if (ndiName === null || ndiName === e.ndiName) {
      setNdiName(null);
      return;
    }
    void aendere({ ndiName }).then((r) => {
      if (r.ok) setNdiName(null);
    });
  };
  const uebernimmPerson = (): void => {
    if (person === null || person === e.person) {
      setPerson(null);
      return;
    }
    void aendere({ person }).then((r) => {
      if (r.ok) setPerson(null);
    });
  };
  const listeId = `zoom-slot-${nr}-personen`;
  return (
    <div className="mt-2 space-y-2 rounded border border-neutral-800 p-2 text-xs text-neutral-300">
      <label className="block text-neutral-400">
        {SLOT_FELD.ndiName}
        <MitTooltip titel={e.an ? SLOT_TEXT.nameGesperrt : undefined}>
          <input
            value={ndiName ?? e.ndiName}
            disabled={e.an || beschaeftigt}
            onChange={(ev) => setNdiName(ev.target.value)}
            onBlur={uebernimmName}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') uebernimmName();
            }}
            autoComplete="off"
            spellCheck={false}
            className={`${STIL.inp} mt-1 w-64`}
          />
        </MitTooltip>
      </label>
      <div>
        <div className="text-neutral-400">{SLOT_FELD.modus}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(Object.keys(MODUS_NAME) as ZoomSlotModus[]).map((m) => (
            <button key={m} disabled={beschaeftigt} onClick={() => void aendere({ modus: m })} className={m === e.modus ? STIL.gelb : STIL.rand}>
              {MODUS_NAME[m]}
            </button>
          ))}
        </div>
      </div>
      {e.modus === 'teilnehmer' && (
        <label className="block text-neutral-400">
          {SLOT_FELD.person}
          <input
            list={listeId}
            value={person ?? e.person}
            placeholder={SLOT_FELD.personPlatzhalter}
            disabled={beschaeftigt}
            onChange={(ev) => setPerson(ev.target.value)}
            onBlur={uebernimmPerson}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') uebernimmPerson();
            }}
            autoComplete="off"
            className={`${STIL.inp} mt-1 block w-64`}
          />
          <datalist id={listeId}>
            {teilnehmer.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1">
          {SLOT_FELD.aufloesung}
          <select
            value={e.aufloesung}
            disabled={beschaeftigt}
            onChange={(ev) => void aendere({ aufloesung: ev.target.value as ZoomSlotAufloesung })}
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
          {ERSATZBILD_FELD}
          <select
            value={e.ersatzbild}
            disabled={beschaeftigt}
            onChange={(ev) => void aendere({ ersatzbild: ev.target.value as ZoomSlotErsatzbild })}
            className={STIL.inp}
          >
            {ERSATZBILDER.map((b) => (
              <option key={b} value={b}>
                {ERSATZBILD_NAME[b]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={e.tonAn} disabled={beschaeftigt} onChange={(ev) => void aendere({ tonAn: ev.target.checked })} />
          {SLOT_FELD.ton}
        </label>
        <button disabled={beschaeftigt} onClick={() => void aendere({ tonArt: 'mischton' })} className={e.tonArt === 'mischton' ? STIL.gelb : STIL.rand}>
          {SLOT_FELD.tonArt.mischton}
        </button>
        <button
          disabled={beschaeftigt || e.modus !== 'teilnehmer'}
          onClick={() => void aendere({ tonArt: 'person' })}
          className={e.tonArt === 'person' ? STIL.gelb : STIL.rand}
        >
          {SLOT_FELD.tonArt.person}
        </button>
      </div>
      {e.modus === 'freigabe' && (
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={e.computerton} disabled={beschaeftigt} onChange={(ev) => void aendere({ computerton: ev.target.checked })} />
          {SLOT_FELD.computerton}
        </label>
      )}
      {e.modus === 'sprecher' && (
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={e.ohneKamera} disabled={beschaeftigt} onChange={(ev) => void aendere({ ohneKamera: ev.target.checked })} />
          {SLOT_FELD.ohneKamera}
        </label>
      )}
      <MitTooltip titel={e.an ? SLOT_TEXT.loeschenGesperrt : undefined}>
        <button disabled={e.an || aufrufe.laeuft.has(`loeschen:${nr}`)} onClick={() => setLoeschFrage(true)} className={STIL.rot}>
          {BEDIEN_TEXT.loeschen}
        </button>
      </MitTooltip>
      {loeschFrage && !e.an && (
        <div className="rounded border border-red-800 bg-red-950/40 p-2 text-red-100">
          <p>{loeschenFrage(nr, e.ndiName)}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                setLoeschFrage(false);
                void aufrufe.fuehreAus(`loeschen:${nr}`, ort, () => window.jmconnect.zoomSlotLoeschen({ nr }));
              }}
              className={STIL.rot}
            >
              {BEDIEN_TEXT.loeschen}
            </button>
            <button onClick={() => setLoeschFrage(false)} className={STIL.rand}>
              {SLOT_TEXT.abbrechen}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
