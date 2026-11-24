// Zoom-Slots in der Zoom-Spalte (Spec 7.5 Nr. 8, 7.6, 7.7; Task B21): Kopf mit T31, „Slot hinzufügen“, Schalter „Vorschau“, die
// Lage der Einstellungsdatei (T90, T92) und die Kacheln, zwei Spalten bei breitem, eine bei schmalem Bereich (Container-Query,
// B-EP9). Dazu die Angabe je Zeile der Teilnehmerliste (7.5 Nr. 9, 10.10). Seit UX Welle 2b (Task 24, B20) stehen die
// Slot-Vorgaben, die Sprecher-Einstellungen und „Person im NDI-Namen“ im Panel-Abschnitt „Zoom-Vorgaben“ (ZoomVorgaben.tsx); hier
// bleiben die Live-Teile (W2-5). Alle Texte aus @shared/zoom-text (B-EP4), die NDI-Texte (Link T133 samt Tooltip, Meldung T143 des
// Öffnen-Knopfs) aus @shared/ndi-text (Plan C); hier steht kein Text-Literal. Knöpfe aus @jm/ui, Farben als Tokens (W2-9).
import { useEffect, useRef, useState } from 'react';
import { Button } from '@jm/ui';
import { SLOT_NR_MAX } from '@jm/zoom-bridge/protocol';
import type { ZoomAbbild, ZoomParticipant } from '@shared/types';
import { BEDIEN_TEXT, EINSTELLUNG_TEXT, SLOT_TEXT, TEXT_A4_SCHREIBFEHLER, slotKopfZeile, teilnehmerSlotAngabe, teilnehmerSlotEingabe } from '@shared/zoom-text';
import { AntwortZeile, SlotKachel, type GemerkteVorschau } from './SlotKachel';
import { MitTooltip, STIL, type SlotAufrufe } from './SlotEinstellungen';
import { NDI_TEXT, oeffnenMeldung, type OeffnenStelle } from '@shared/ndi-text';
import type { OeffnenErgebnis } from '@shared/types';

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
  if (!angabe.knopf) return <span className={STIL.hinweis}>{angabe.text}</span>;
  const schluessel = `alsSlot:${t.id}`;
  return (
    <MitTooltip titel={angabe.tooltip ?? undefined}>
      <Button
        size="sm"
        uppercase={false}
        variant="primary"
        disabled={t.imWarteraum || !imMeeting || aufrufe.laeuft.has(schluessel)}
        onClick={() =>
          aufrufe.starte(schluessel, `zeile:${t.id}`, (trotz) => window.jmconnect.zoomSlotAusPerson({ teilnehmerId: t.id, trotz }))
        }
      >
        {angabe.text}
      </Button>
    </MitTooltip>
  );
}

/** Aussehen eines Öffnen-Knopfs ohne eigenen Stil: klein, Rand und Schrift aus Tokens (W2-9). */
const OEFFNEN_VORGABE = 'rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]';

/**
 * Knopf, der etwas öffnet (Logordner, Lizenzbedingungen, ndi.video; Plan C, E35): scheitert das Öffnen, steht T143 daneben,
 * bis es an dieser Stelle gelingt oder die Stelle verschwindet (der Zustand lebt in der Komponente); der Knopf bleibt
 * bedienbar. Auch Fußzeile und Cloud-Raum nutzen ihn: Er steht hier, weil Plan C keine neue Renderer-Datei vorsah und die
 * Fenster-Dateien diese Datei ohne Kreis-Import laden können (C-EB38).
 */
export function OeffnenKnopf({
  stelle,
  text,
  titel,
  oeffnen,
  stil,
}: {
  stelle: OeffnenStelle;
  text: string;
  titel?: string;
  oeffnen: () => Promise<OeffnenErgebnis>;
  stil?: string;
}): JSX.Element {
  const [letztes, setLetztes] = useState<'keines' | 'gescheitert' | 'gelungen'>('keines');
  const [pfad, setPfad] = useState('');
  const meldung = oeffnenMeldung(stelle, letztes, pfad);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        title={titel}
        onClick={() =>
          void oeffnen().then((r) => {
            if (r.ok) {
              setLetztes('gelungen');
            } else {
              setPfad(r.pfad);
              setLetztes('gescheitert');
            }
          })
        }
        className={stil ?? OEFFNEN_VORGABE}
      >
        {text}
      </button>
      {meldung !== null && <span className={STIL.fehler}>{meldung}</span>}
    </span>
  );
}

/** Link T133 (LP1; 22.5 Orte 2 und 5): öffnet nur https://ndi.video/ über jmc:ndi-seite; scheitert es, steht T143 daneben. */
export function NdiLink({ stelle }: { stelle: 'linkGaeste' | 'linkSlots' }): JSX.Element {
  return (
    <OeffnenKnopf
      stelle={stelle}
      text={NDI_TEXT.t133}
      titel={NDI_TEXT.t133Tooltip}
      oeffnen={() => window.jmconnect.ndiSeite()}
      stil="text-xs text-[var(--foreground)] underline underline-offset-2 hover:text-[var(--primary)]"
    />
  );
}

export function SlotBereich({ a, aufrufe }: { a: ZoomAbbild; aufrufe: SlotAufrufe }): JSX.Element {
  const { bilder, jetzt } = useVorschauBilder(a);
  const slots = [...a.slots].sort((x, y) => x.einstellung.nr - y.einstellung.nr);
  const voll = a.slots.length >= SLOT_NR_MAX;
  return (
    <section data-connect="zoom-slots" className="rounded-[var(--radius-lg)] border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{BEDIEN_TEXT.zoomSlots}</h3>
          {/* Link T133 (22.5 Ort 5, LP1): im Kopf der Slots, weil hier NDI-Namen vergeben werden. */}
          <NdiLink stelle="linkSlots" />
        </span>
        <span className={STIL.hinweis}>{slotKopfZeile(a.slots.length, a.kurz.slotsAn, a.kurz.slotsLaufen)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <MitTooltip titel={voll ? SLOT_TEXT.hoechstens : undefined}>
          <Button
            size="sm"
            uppercase={false}
            variant="primary"
            disabled={voll || aufrufe.laeuft.has('anlegen')}
            onClick={() => void aufrufe.fuehreAus('anlegen', 'slots', () => window.jmconnect.zoomSlotAnlegen())}
          >
            {BEDIEN_TEXT.slotHinzufuegen}
          </Button>
        </MitTooltip>
        <label className="flex items-center gap-1 text-xs text-[var(--foreground)]">
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
      </div>
      <AntwortZeile aufrufe={aufrufe} ort="slots" />
      {a.einstellungen.gesichert !== null && <p className={`mt-2 ${STIL.warnung}`}>{EINSTELLUNG_TEXT.unlesbar(a.einstellungen.gesichert)}</p>}
      {a.einstellungen.nurSitzung && <p className={`mt-2 ${STIL.warnung}`}>{TEXT_A4_SCHREIBFEHLER}</p>}
      {slots.length === 0 ? (
        <p className={`mt-3 ${STIL.hinweis}`}>{SLOT_TEXT.keineSlots}</p>
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
