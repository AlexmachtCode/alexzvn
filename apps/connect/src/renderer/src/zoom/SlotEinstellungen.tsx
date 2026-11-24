// Einstellungen eines Zoom-Slots (Spec 7.5 Nr. 8 „Einstellungen“, 7.6; Task B21) und die gemeinsamen Bausteine der
// Slot-Komponenten (Stil, Tooltip-Rahmen, Kennzeichen, Aufruf-Typen). Diese Datei importiert keine der anderen
// Slot-Komponenten, darum entsteht kein Kreis-Import (SlotKachel und SlotBereich importieren von hier).
// Alle Nutzertexte kommen aus @shared/zoom-text (B-EP4); hier steht kein Text-Literal. Seit UX Welle 2b (Task 24) Knöpfe aus @jm/ui
// und Farben nur als Tokens (W2-9); die Einstellungen bleiben je Kachel (W2-6). Nachtrag Task 25 (Befund 11, Wahl ≠ Bewegung): an
// einem laufenden Slot wählen Auflösung, Ersatzbild und Bildformat nur einen Entwurf, erst „Setzen“ sendet (slotWahl); der Knopf heißt
// wie PEERS_TEXTE.setzen, seine Sperrgründe stehen in CONNECT_TEXTE.wahl.
import { useEffect, useState } from 'react';
import { PEERS_TEXTE } from '@jm/settings';
import { Button } from '@jm/ui';
import { SLOT_RESOLUTIONS } from '@jm/zoom-bridge/protocol';
import type {
  ZoomErgebnis, ZoomParticipant, ZoomSlotAufloesung, ZoomSlotBildformat, ZoomSlotEinstellung, ZoomSlotErsatzbild, ZoomSlotLage, ZoomSlotModus,
  ZoomSlotZustand,
} from '@shared/types';
import { CONNECT_TEXTE } from '@/lib/oberflaeche';
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
 * Zustände, in denen eine Änderung von Auflösung, Ersatzbild oder Bildformat sofort aufs Bild geht: ein Sender läuft (zeigt,
 * gehalten, Ersatzbild; der Kern schickt slotSet, kern.ts slotAendern) oder kommt gleich (startet; der Kern zieht die Änderung mit
 * der ersten Antwort nach, kern.ts nachziehen). In allen übrigen ändert sie nur die Einstellung für den nächsten Start.
 */
const LAUFEND: ReadonlySet<ZoomSlotZustand> = new Set<ZoomSlotZustand>(['startet', 'zeigt', 'gehalten', 'ersatz']);

/** Wirkt eine Wahl in diesem Zustand sofort auf das gesendete Bild? Dann gilt Entwurf und „Setzen“ (Wahl ≠ Bewegung). */
export function wirktSofort(zustand: ZoomSlotZustand): boolean {
  return LAUFEND.has(zustand);
}

/** Die drei Auswahlen einer Kachel, die an einem laufenden Slot einen Entwurf halten. */
export type SlotWahlFeld = 'aufloesung' | 'ersatzbild' | 'bildformat';
export type SlotWahl = Partial<Pick<ZoomSlotEinstellung, SlotWahlFeld>>;
const WAHL_FELDER: readonly SlotWahlFeld[] = ['aufloesung', 'ersatzbild', 'bildformat'];

/** Ein gewählter Wert mit dem gemeldeten Wert und Modus, gegen die er gewählt wurde; `gesendet` nach gelungenem „Setzen“. */
interface EntwurfFeld {
  wert: string;
  basis: string;
  modus: ZoomSlotModus;
  gesendet: boolean;
}
/** Entwurf der Auswahlen eines Slots. Eine Wahl gleich dem gemeldeten Wert ist kein Entwurf. */
export type SlotEntwurf = Readonly<Partial<Record<SlotWahlFeld, EntwurfFeld>>>;

/** Was die Auswahlen eines Slots zeigen und auslösen (hooklos prüfbar). */
export interface SlotWahlBedienung {
  /** Die Wahl wirkt sofort aufs Bild (wirktSofort): dann Entwurf und „Setzen“. */
  laeuft: boolean;
  /** „Setzen“ steht nur, wo es gebraucht wird: am laufenden Slot. */
  setzenSichtbar: boolean;
  /** Angezeigter Wert: der gültige Entwurf, sonst der gemeldete. */
  wert(f: SlotWahlFeld): string;
  /** Auswahl (change, auch per Pfeiltaste): am laufenden Slot nur in den Entwurf, sonst sofort wie bisher. */
  waehlen(w: SlotWahl): void;
  /** Warum „Setzen“ gesperrt ist; undefined = frei (ein gültiger, noch nicht gesendeter Entwurf weicht ab). */
  setzenGrund: string | undefined;
  /** „Setzen“: schickt alle abweichenden Felder in einem Aufruf (derselbe zoomSlotAendern wie bisher). */
  setzen(): Promise<void>;
}

/**
 * Auswahlen eines Slots (Wahl ≠ Bewegung): an einem laufenden Slot hält jede Wahl nur einen Entwurf, erst „Setzen“ sendet ihn; an
 * einem gestoppten Slot geht die Wahl wie bisher sofort an `aendere`. Ein Entwurf gilt nur, solange der Slot läuft und der gemeldete
 * Wert und der Modus noch die sind, gegen die er gewählt wurde: so dreht kein veralteter Entwurf eine spätere Änderung still zurück,
 * und nach „Setzen“ zeigt die Auswahl den gesendeten Wert, bis die Meldung ihn bestätigt (kein Zurückspringen). Gesperrt ist
 * „Setzen“ ohne Abweichung und solange der Aufruf des Slots läuft (`beschaeftigt`); eine Ablehnung lässt den Entwurf stehen.
 */
export function slotWahl(a: {
  e: ZoomSlotEinstellung;
  zustand: ZoomSlotZustand;
  entwurf: SlotEntwurf;
  setzeEntwurf(f: (e: SlotEntwurf) => SlotEntwurf): void;
  beschaeftigt: boolean;
  aendere(aenderung: SlotWahl): Promise<ZoomErgebnis>;
}): SlotWahlBedienung {
  const laeuft = wirktSofort(a.zustand);
  const T = CONNECT_TEXTE.wahl;
  const gueltig = (f: SlotWahlFeld): EntwurfFeld | undefined => {
    const x = a.entwurf[f];
    return laeuft && x !== undefined && x.basis === a.e[f] && x.modus === a.e.modus ? x : undefined;
  };
  const offen = WAHL_FELDER.filter((f) => {
    const x = gueltig(f);
    return x !== undefined && !x.gesendet && x.wert !== a.e[f];
  });
  const setzenGrund = a.beschaeftigt ? T.sendet : offen.length === 0 ? T.slotUnveraendert : undefined;
  return {
    laeuft,
    setzenSichtbar: laeuft,
    wert: (f) => gueltig(f)?.wert ?? a.e[f],
    waehlen: (w) => {
      if (!laeuft) {
        void a.aendere(w);
        return;
      }
      a.setzeEntwurf((alt) => {
        const neu: Partial<Record<SlotWahlFeld, EntwurfFeld>> = { ...alt };
        for (const f of WAHL_FELDER) {
          const v = w[f];
          if (v === undefined) continue;
          if (v === a.e[f]) delete neu[f];
          else neu[f] = { wert: v, basis: a.e[f], modus: a.e.modus, gesendet: false };
        }
        return neu;
      });
    },
    setzenGrund,
    setzen: async () => {
      if (setzenGrund !== undefined) return;
      const aenderung: Partial<Record<SlotWahlFeld, string>> = {};
      for (const f of offen) aenderung[f] = gueltig(f)?.wert;
      const r = await a.aendere(aenderung as SlotWahl);
      if (!r.ok) return;
      a.setzeEntwurf((alt) => {
        const neu: Partial<Record<SlotWahlFeld, EntwurfFeld>> = { ...alt };
        for (const f of offen) {
          const x = neu[f];
          if (x !== undefined && x.wert === aenderung[f]) neu[f] = { ...x, gesendet: true };
        }
        return neu;
      });
    },
  };
}

/**
 * Felder eines Slots (7.5 Nr. 8): NDI-Name (gesperrt, solange der Slot an ist, T35), Modus, Person (nur Teilnehmer, mit
 * Vorschlägen aus der Teilnehmerliste, freie Eingabe), Auflösung, Ersatzbild, Ton an/aus und Tonart (Person nur im Modus
 * Teilnehmer), Computerton (nur Freigabe), „Teilnehmer ohne Kamera zeigen“ (nur Sprecher), „Löschen“ (nur ausgeschaltet,
 * T36, Rückfrage T37). Eine Änderung geht an zoomSlotAendern; der Kern speichert sie und schickt im Meeting slotSet (B-EP21).
 * An einem laufenden Slot halten Auflösung, Ersatzbild und Bildformat nur einen Entwurf, den erst „Setzen“ schickt (slotWahl,
 * Wahl ≠ Bewegung); beim Stoppen fällt der Entwurf weg. Den Text einer Ablehnung (T43–T47 …) zeigt die Kachel am Ort `slot:<nr>`.
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
  const [entwurf, setEntwurf] = useState<SlotEntwurf>({});
  const laeuft = wirktSofort(lage.zustand);
  // Stoppt der Slot, fällt der Entwurf weg (er gilt ohnehin nur, solange der Slot läuft; slotWahl).
  useEffect(() => {
    if (!laeuft) setEntwurf({});
  }, [laeuft]);
  const wahl = slotWahl({ e, zustand: lage.zustand, entwurf, setzeEntwurf: setEntwurf, beschaeftigt, aendere });
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
            value={wahl.wert('aufloesung')}
            disabled={beschaeftigt}
            onChange={(ev) => wahl.waehlen({ aufloesung: ev.target.value as ZoomSlotAufloesung })}
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
            value={wahl.wert('ersatzbild')}
            disabled={beschaeftigt}
            onChange={(ev) => wahl.waehlen({ ersatzbild: ev.target.value as ZoomSlotErsatzbild })}
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
            value={wahl.wert('bildformat')}
            disabled={beschaeftigt || e.modus === 'freigabe'}
            onChange={(ev) => wahl.waehlen({ bildformat: ev.target.value as ZoomSlotBildformat })}
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
        {wahl.setzenSichtbar && (
          <span data-connect="slot-setzen" className="ml-auto">
            <MitTooltip titel={wahl.setzenGrund}>
              <Button
                size="sm"
                uppercase={false}
                variant="outline"
                aria-label={PEERS_TEXTE.setzenFuer(e.ndiName)}
                disabled={wahl.setzenGrund !== undefined}
                onClick={() => void wahl.setzen()}
              >
                {PEERS_TEXTE.setzen}
              </Button>
            </MitTooltip>
          </span>
        )}
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
