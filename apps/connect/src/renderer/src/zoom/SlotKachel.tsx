// Kachel eines Zoom-Slots (Spec 7.5 Nr. 8, 7.7; Task B21): Kopfzeile mit Nummer, NDI-Name, Modus, Kennzeichen T96/T96b und
// Start-Schalter; Vorschau 192 × 108; die fertigen Zeilen aus dem Abbild (Zustand 10.2, Messung 10.7, Ton 10.6, Fehler
// 10.9); Auswahl bei Doppelname oder Zweifel; „Einstellungen“ je Kachel (W2-6). Die Zeilen rechnet der Kern (ZoomSlotLage.text …),
// die Fläche der Vorschau die reine Regel vorschauFlaeche (slot-vorschau.ts). Alle Texte aus @shared/zoom-text bzw. slot-vorschau.ts.
// Seit UX Welle 2b (Task 24) Knöpfe aus @jm/ui und Farben als Tokens (W2-9); feste Farben behalten nur die Flächen der Vorschau
// (SCHACHBRETT, Flaeche), sie zeigen das Bild der Ausgabe (Programmfläche, B5).
import { useEffect, useRef, useState } from 'react';
import { Button } from '@jm/ui';
import type { ZoomAbbild, ZoomSlotLage, ZoomSlotModus } from '@shared/types';
import { BEDIEN_TEXT, MODUS_NAME, SLOT_FELD, SLOT_TEXT, slotKennzeichen } from '@shared/zoom-text';
import { vorschauFlaeche, VORSCHAU_TEXT, type VorschauFlaeche } from './slot-vorschau';
import { Kennzeichen, SlotEinstellungen, STIL, type SlotAufrufe, type SlotOrt } from './SlotEinstellungen';

/** Spec 7.7: Eine Vorschau gilt als frisch, solange sie jünger als 1,5 s ist. */
export const VORSCHAU_FRISCH_MS = 1500;
/** Letzte Vorschau eines Slots aus dem Push jmc:zoom-vorschau-bild, mit Empfangszeit und dem Ziel, für das sie kam. */
export interface GemerkteVorschau { ziel: number; jpeg: string; zeit: number; modus: ZoomSlotModus; zielName: string | null }

/** Text einer abgelehnten Antwort am Ort (7.5 „Antwortort“). */
export function AntwortZeile({ aufrufe, ort }: { aufrufe: SlotAufrufe; ort: SlotOrt }): JSX.Element | null {
  const text = aufrufe.antwortText(ort);
  return text ? <p className={`mt-1 ${STIL.fehler}`}>{text}</p> : null;
}

/** Nachfrage T40 am Ort des Aufrufs mit „Trotzdem einschalten“ (T41) und „Abbrechen“ (T42), Spec 7.4. */
export function NachfrageZeile({ aufrufe, ort }: { aufrufe: SlotAufrufe; ort: SlotOrt }): JSX.Element | null {
  const n = aufrufe.nachfrage;
  if (!n || n.ort !== ort) return null;
  return (
    <div data-connect="nachfrage" className={`mt-2 ${STIL.nachfrage}`}>
      <p className="select-text">{n.text}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" uppercase={false} variant="primary" onClick={n.trotzdem}>
          {SLOT_TEXT.trotzdem}
        </Button>
        <Button size="sm" uppercase={false} variant="outline" onClick={aufrufe.nachfrageWeg}>
          {SLOT_TEXT.abbrechen}
        </Button>
      </div>
    </div>
  );
}

/** Schachbrett für ein transparentes Ersatzbild (7.7 „SZ6, sent = transparent“). */
const SCHACHBRETT = {
  backgroundImage: 'conic-gradient(#3f3f46 25%, #18181b 0 50%, #3f3f46 0 75%, #18181b 0)',
  backgroundSize: '16px 16px',
} as const;

/** Inhalt der Vorschau-Fläche zu einer Fläche aus vorschauFlaeche (ohne Kennzeichen und Text). */
function Flaeche({ art, jpeg }: { art: VorschauFlaeche['art']; jpeg: string | null }): JSX.Element | null {
  if ((art === 'bild' || art === 'letzte') && jpeg !== null) {
    return <img src={`data:image/jpeg;base64,${jpeg}`} alt="" className="h-full w-full object-contain" />;
  }
  if (art === 'schachbrett') return <div className="h-full w-full" style={SCHACHBRETT} />;
  if (art === 'schwarz') return <div className="h-full w-full bg-black" />;
  if (art === 'weiss') return <div className="h-full w-full bg-white" />;
  // #232323 ist der Grund der Zoom-Kachel in der Bridge (kachel::HINTERGRUND in packages/zoom-bridge/native/kachel_logik.h,
  // gemalt in native/kachel.cpp) – ändert sich die eine Farbe, die andere mit.
  if (art === 'kachel') return <div className="h-full w-full bg-[#232323]" />;
  return null;
}

export function SlotKachel({
  lage,
  a,
  vorschau,
  jetzt,
  aufrufe,
}: {
  lage: ZoomSlotLage;
  a: ZoomAbbild;
  /** Letzte Vorschau dieses Ziels (SlotBereich verwirft sie beim Umhängen); undefined = keine. */
  vorschau: GemerkteVorschau | undefined;
  jetzt: number;
  aufrufe: SlotAufrufe;
}): JSX.Element {
  const e = lage.einstellung;
  const nr = e.nr;
  const ort: SlotOrt = `slot:${nr}`;
  const [einstellungenAuf, setEinstellungenAuf] = useState(false);
  const kennzeichen = slotKennzeichen(lage);
  // Spec 7.7: Malerei je Lage. `detail` ist das HRESULT des letzten previewUnavailable (T57, 6.4; im Abbild seit Plan B,
  // Task B16); T57 steht zusätzlich einmal unter „Hinweise“.
  const flaeche = vorschauFlaeche({
    zustand: lage.zustand,
    gesendet: lage.gesendet,
    schalterAn: a.vorschauAn,
    verfuegbar: a.vorschauVerfuegbar,
    detail: a.vorschauDetail,
    frisch: vorschau !== undefined && jetzt - vorschau.zeit < VORSCHAU_FRISCH_MS,
    letzteDiesesZiels: vorschau !== undefined,
  });
  // SZ9 („stoppt“): die letzte Fläche abgeblendet (7.7). Gemerkt wird jede Fläche außer der abgeblendeten.
  const letzte = useRef<{ art: VorschauFlaeche['art']; jpeg: string | null }>({ art: 'leer', jpeg: null });
  useEffect(() => {
    if (flaeche.art !== 'abgeblendet') letzte.current = { art: flaeche.art, jpeg: vorschau?.jpeg ?? null };
  });
  const gezeigt = flaeche.art === 'abgeblendet' ? letzte.current : { art: flaeche.art, jpeg: vorschau?.jpeg ?? null };
  const startSchluessel = `start:${nr}`;
  return (
    <div data-connect="kachel" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {nr} · {e.ndiName}
        </span>
        <Kennzeichen>{MODUS_NAME[e.modus]}</Kennzeichen>
        {kennzeichen && (
          <span title={kennzeichen.tooltip} className="inline-flex">
            <Kennzeichen>{kennzeichen.text}</Kennzeichen>
          </span>
        )}
        {kennzeichen && (
          <Button
            size="sm"
            uppercase={false}
            variant="outline"
            disabled={aufrufe.laeuft.has(`behalten:${nr}`)}
            onClick={() => void aufrufe.fuehreAus(`behalten:${nr}`, ort, () => window.jmconnect.zoomSlotBehalten({ nr }))}
          >
            {BEDIEN_TEXT.behalten}
          </Button>
        )}
        <Button
          size="sm"
          uppercase={false}
          variant={e.an ? 'outline' : 'primary'}
          className="ml-auto"
          disabled={aufrufe.laeuft.has(startSchluessel)}
          onClick={() =>
            aufrufe.starte(startSchluessel, ort, (trotz) => window.jmconnect.zoomSlotStart({ nr, an: !e.an, trotz }))
          }
        >
          {e.an ? SLOT_TEXT.stopp : SLOT_TEXT.start}
        </Button>
      </div>
      <div
        title={VORSCHAU_TEXT.T52}
        className={`relative mt-2 h-[108px] w-[192px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--muted)] ${flaeche.art === 'abgeblendet' ? 'opacity-40' : ''}`}
      >
        <Flaeche art={gezeigt.art} jpeg={gezeigt.jpeg} />
        {flaeche.kennzeichen && (
          <span className="absolute left-1 top-1 rounded-[var(--radius-sm)] bg-[var(--background)]/80 px-1 text-[10px] text-[var(--foreground)]">{flaeche.kennzeichen}</span>
        )}
        {flaeche.text && (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] text-[var(--muted-foreground)]">
            {flaeche.text}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--foreground)] select-text">{lage.text}</p>
      {lage.messText !== null && <p className={STIL.hinweis}>{lage.messText}</p>}
      {lage.tonText !== null && <p className={STIL.hinweis}>{lage.tonText}</p>}
      {lage.fehler !== null && <p className={STIL.fehler}>{lage.fehler}</p>}
      {lage.ndiWarnung !== null && <p className={STIL.warnung}>{lage.ndiWarnung}</p>}
      {lage.wahl !== null && lage.wahl.length > 0 && (
        <div className="mt-2 text-xs">
          <p className="text-[var(--foreground)]">{SLOT_FELD.welchePerson}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {lage.wahl.map((w) => (
              <Button
                key={w.id}
                size="sm"
                uppercase={false}
                variant="outline"
                disabled={aufrufe.laeuft.has(`person:${nr}`)}
                onClick={() => void aufrufe.fuehreAus(`person:${nr}`, ort, () => window.jmconnect.zoomSlotPerson({ nr, teilnehmerId: w.id }))}
              >
                {w.name}
                {w.hinweis && <span className="ml-1 text-[var(--muted-foreground)]">{w.hinweis}</span>}
              </Button>
            ))}
          </div>
        </div>
      )}
      <AntwortZeile aufrufe={aufrufe} ort={ort} />
      <NachfrageZeile aufrufe={aufrufe} ort={ort} />
      <Button size="sm" uppercase={false} variant="outline" className="mt-2" onClick={() => setEinstellungenAuf((v) => !v)}>
        {SLOT_FELD.einstellungen}
      </Button>
      {einstellungenAuf && <SlotEinstellungen lage={lage} teilnehmer={a.teilnehmer} aufrufe={aufrufe} />}
    </div>
  );
}
