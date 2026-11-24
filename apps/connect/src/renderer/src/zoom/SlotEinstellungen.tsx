// Einstellungen eines Zoom-Slots (Spec 7.5 Nr. 8 „Einstellungen“, 7.6; Task B21) und die gemeinsamen Bausteine der
// Slot-Komponenten (Stil, Tooltip-Rahmen, Kennzeichen, Aufruf-Typen). Diese Datei importiert keine der anderen
// Slot-Komponenten, darum entsteht kein Kreis-Import (SlotKachel und SlotBereich importieren von hier).
// Alle Nutzertexte kommen aus @shared/zoom-text (B-EP4); hier steht kein Text-Literal. Seit UX Welle 2b (Task 24) Knöpfe aus @jm/ui
// und Farben nur als Tokens (W2-9); die Einstellungen bleiben je Kachel (W2-6).
import { useState } from 'react';
import { Button } from '@jm/ui';
import { SLOT_RESOLUTIONS } from '@jm/zoom-bridge/protocol';
import type {
  ZoomErgebnis, ZoomParticipant, ZoomSlotAufloesung, ZoomSlotBildformat, ZoomSlotEinstellung, ZoomSlotErsatzbild, ZoomSlotLage, ZoomSlotModus,
} from '@shared/types';
import {
  BEDIEN_TEXT, BILDFORMAT_FELD, BILDFORMAT_HINWEIS, BILDFORMAT_NAME, BILDFORMAT_REIHE, bildformatHinweis, ersatzbildAuswahl, ERSATZBILD_FELD, loeschenFrage, MODUS_NAME, SLOT_FELD, SLOT_TEXT,
} from '@shared/zoom-text';

/** Wo eine abgelehnte Antwort erscheint: 'slots' = Kopf des Slot-Bereichs, sonst Kachel bzw. Zeile der Teilnehmerliste (7.5). */
export type SlotOrt = 'slots' | `slot:${number}` | `zeile:${number}`;
/** Nachfrage ab dem 6. eingeschalteten Slot (Spec 7.4): Text T40 vom Kern, „Trotzdem einschalten“ wiederholt mit trotz. */
export interface SlotNachfrage { ort: SlotOrt; text: string; trotzdem: () => void }
/** Was die Zoom-Spalte den Slot-Komponenten gibt: ein Doppelklick-Schutz, ein Antwortort, eine Nachfrage (7.5). */
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

/**
 * Gemeinsame Klassen der Zoom-Spalte und der Zoom-Abschnitte im Panel, nur Tokens (W2-9): Eingabefeld, Kasten, Fehler- und
 * Warnzeile (Statusfarbe nur am Rand, nie am Wort), Hinweis (grau), Nachfrage und Rückfrage. Knöpfe sind Button aus @jm/ui.
 */
export const STIL = {
  inp: 'rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)] select-text disabled:opacity-50',
  kasten: 'rounded-[var(--radius-md)] border border-[var(--border)] p-2',
  fehler: 'border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text',
  warnung: 'border-l-2 border-[var(--status-warn)] pl-2 text-xs text-[var(--foreground)] select-text',
  hinweis: 'text-xs text-[var(--muted-foreground)]',
  nachfrage: 'rounded-[var(--radius-md)] border border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10 p-2 text-xs text-[var(--foreground)]',
  rueckfrage: 'rounded-[var(--radius-md)] border border-[var(--status-error)]/60 bg-[var(--status-error)]/10 p-2 text-[var(--foreground)]',
} as const;

/** Gesperrte Knöpfe bekommen in Chromium keine Mausereignisse; der Tooltip sitzt darum am Rahmen. */
export function MitTooltip({ titel, children }: { titel: string | undefined; children: JSX.Element }): JSX.Element {
  return (
    <span title={titel} className="inline-flex">
      {children}
    </span>
  );
}

/** Kennzeichen (Kachel, Teilnehmerzeile); `rot` (Name doppelt) trägt die Fehlerfarbe nur am Rand. */
export function Kennzeichen({ children, rot = false }: { children: string; rot?: boolean }): JSX.Element {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)] ${rot ? 'border-[var(--status-error)]' : 'border-[var(--border)] bg-[var(--muted)]'}`}
    >
      {children}
    </span>
  );
}

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
  // M4 (Nachtrag B): NDI-Name und „Löschen“ sind auch gesperrt, solange der ausgeschaltete Slot noch stoppt (SZ9): Der Kern lehnt
  // beides ab, solange ein Sender besteht. Der Tooltip T35/T36 („erst ausschalten“) gilt nur dem eingeschalteten Slot.
  const stoppt = lage.zustand === 'stoppt';
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
    <div data-connect="slot-einstellungen" className={`mt-2 space-y-2 ${STIL.kasten} text-xs text-[var(--foreground)]`}>
      <label className="block text-[var(--muted-foreground)]">
        {SLOT_FELD.ndiName}
        <MitTooltip titel={e.an ? SLOT_TEXT.nameGesperrt : undefined}>
          <input
            value={ndiName ?? e.ndiName}
            disabled={e.an || stoppt || beschaeftigt}
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
        <div className="text-[var(--muted-foreground)]">{SLOT_FELD.modus}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(Object.keys(MODUS_NAME) as ZoomSlotModus[]).map((m) => (
            <Button key={m} size="sm" uppercase={false} variant={m === e.modus ? 'primary' : 'outline'} disabled={beschaeftigt} onClick={() => void aendere({ modus: m })}>
              {MODUS_NAME[m]}
            </Button>
          ))}
        </div>
      </div>
      {e.modus === 'teilnehmer' && (
        <label className="block text-[var(--muted-foreground)]">
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
            {ersatzbildAuswahl(e.modus, e.ersatzbild).map((o) => (
              <option key={o.wert} value={o.wert} disabled={!o.waehlbar}>
                {o.text}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1" title={bildformatHinweis(e.modus)}>
          {BILDFORMAT_FELD}
          <select
            value={e.bildformat}
            disabled={beschaeftigt || e.modus === 'freigabe'}
            onChange={(ev) => void aendere({ bildformat: ev.target.value as ZoomSlotBildformat })}
            className={STIL.inp}
          >
            {BILDFORMAT_REIHE.map((b) => (
              <option key={b} value={b}>
                {BILDFORMAT_NAME[b]}
              </option>
            ))}
          </select>
          {e.modus === 'freigabe' && <span className="text-xs opacity-70">{BILDFORMAT_HINWEIS.freigabe}</span>}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={e.tonAn} disabled={beschaeftigt} onChange={(ev) => void aendere({ tonAn: ev.target.checked })} />
          {SLOT_FELD.ton}
        </label>
        <Button size="sm" uppercase={false} variant={e.tonArt === 'mischton' ? 'primary' : 'outline'} disabled={beschaeftigt} onClick={() => void aendere({ tonArt: 'mischton' })}>
          {SLOT_FELD.tonArt.mischton}
        </Button>
        <Button
          size="sm"
          uppercase={false}
          variant={e.tonArt === 'person' ? 'primary' : 'outline'}
          disabled={beschaeftigt || e.modus !== 'teilnehmer'}
          onClick={() => void aendere({ tonArt: 'person' })}
        >
          {SLOT_FELD.tonArt.person}
        </Button>
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
        <Button size="sm" uppercase={false} variant="destructive" disabled={e.an || stoppt || aufrufe.laeuft.has(`loeschen:${nr}`)} onClick={() => setLoeschFrage(true)}>
          {BEDIEN_TEXT.loeschen}
        </Button>
      </MitTooltip>
      {loeschFrage && !e.an && !stoppt && (
        <div className={STIL.rueckfrage}>
          <p className="select-text">{loeschenFrage(nr, e.ndiName)}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              uppercase={false}
              variant="destructive"
              onClick={() => {
                setLoeschFrage(false);
                void aufrufe.fuehreAus(`loeschen:${nr}`, ort, () => window.jmconnect.zoomSlotLoeschen({ nr }));
              }}
            >
              {BEDIEN_TEXT.loeschen}
            </Button>
            <Button size="sm" uppercase={false} variant="outline" onClick={() => setLoeschFrage(false)}>
              {SLOT_TEXT.abbrechen}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
