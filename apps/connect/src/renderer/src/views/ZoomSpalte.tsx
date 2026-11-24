// Rechte Spalte „Zoom“ (UX Welle 2b, Connect d2; B19, B20, W2-5, W2-6): Zoom-Meeting (Titel, Statuszeile, Antwort, Meldung,
// Beitritt bzw. Verlassen, Bild-Versatz; zoom/ZoomCard.tsx), die Zoom-Slots mit Vorschau-Schalter und Kacheln samt Einstellungen
// je Kachel (zoom/SlotBereich.tsx), die Teilnehmerliste mit dem leeren Kennzeichen-Platz je Zeile (#317 Stufe B), Messwerte,
// Hinweise und die Fußzeile der Zoom-Quellen mit „Logordner öffnen“. Nur unter Windows (der Rahmen entscheidet). Das Abbild kommt
// nur aus stand.zoom, die laufenden Aufrufe und die Antwort als ZoomAufrufe aus der Wurzel-View (B20, B8); hier stehen nur die
// Nachfrage T40 ab dem 6. Slot (sie gehört zu Kachel oder Teilnehmerzeile) und die Verdrahtung der Slot-Aufrufe.
// Einrichtung und Vorgaben stehen im Panel (zoom/ZoomEinrichtung.tsx, zoom/ZoomVorgaben.tsx).
import { useState } from 'react';
import { Button } from '@jm/ui';
import type { ZoomErgebnis, ZoomParticipant } from '@shared/types';
import { KANDIDAT_KENNZEICHEN } from '@shared/zoom-text';
import type { OberflaechenStand } from '@/lib/oberflaeche';
import { antwortAm, ohneText, type ZoomAufrufe } from '@/zoom/aufrufe';
import { Messwerte } from '@/zoom/Messwerte';
import { SlotBereich, TeilnehmerSlotAngabe } from '@/zoom/SlotBereich';
import { istNachfrage, Kennzeichen, STIL, type SlotAufrufe, type SlotNachfrage, type SlotOrt } from '@/zoom/SlotEinstellungen';
import { NachfrageZeile } from '@/zoom/SlotKachel';
import { ZOOM_TITEL, ZoomCard } from '@/zoom/ZoomCard';

const FUSSZEILE = 'Zoom-Quellen haben kein Tally, kein Talkback und kein Mix-Minus — das sind Grenzen von Zoom.';

/**
 * Was die Slot-Komponenten bekommen (Spec 7.5 Nr. 8, 9; 7.4): derselbe Doppelklick-Schutz und dieselbe Antwort wie überall
 * (ZoomAufrufe der Wurzel-View) und die Nachfrage der Spalte. starte: eine Antwort mit Nachfrage zeigt T40 am Ort (nicht als
 * Antwort; fuehreAus sieht sie ohne Text), sonst wie fuehreAus am Ort des Aufrufs. Rein, ohne window.
 */
export function slotAufrufeAus(
  zoom: ZoomAufrufe,
  nachfrage: SlotNachfrage | null,
  setNachfrage: (n: SlotNachfrage | null) => void,
): SlotAufrufe {
  const starte = (schluessel: string, ort: SlotOrt, f: (trotz: boolean) => Promise<ZoomErgebnis>, trotz = false): void => {
    setNachfrage(null);
    let roh: ZoomErgebnis | null = null;
    void zoom
      .fuehreAus(schluessel, ort, async () => {
        roh = await f(trotz);
        return istNachfrage(roh) ? { ok: false, text: '' } : roh;
      })
      .then(() => {
        if (roh !== null && istNachfrage(roh)) setNachfrage({ ort, text: roh.text, trotzdem: () => starte(schluessel, ort, f, true) });
      });
  };
  return {
    laeuft: zoom.laeuft,
    fuehreAus: (schluessel, ort, f) => zoom.fuehreAus(schluessel, ort, f),
    starte: (schluessel, ort, f) => starte(schluessel, ort, f),
    antwortText: (ort) => antwortAm(zoom, ort),
    nachfrage,
    nachfrageWeg: () => setNachfrage(null),
  };
}

export interface ZoomSpalteProps {
  /** Das Abbild nur aus dem Stand (stand.zoom): undefined = noch keine Antwort. */
  stand: Pick<OberflaechenStand, 'zoom'>;
  /** Laufende Aufrufe und Antwort der Wurzel-View; ohne sie (nur im Test) wie vor dem ersten Abbild. */
  zoom?: ZoomAufrufe;
  /** Text eines gescheiterten ersten Abrufs (zoomGet), sonst null. */
  ladeFehler: string | null;
}

export function ZoomSpalte({ stand, zoom, ladeFehler }: ZoomSpalteProps): JSX.Element {
  /** Nachfrage ab dem 6. Slot (Spec 7.4): T40 am Ort des Aufrufs; „Trotzdem einschalten“ wiederholt ihn mit trotz. */
  const [nachfrage, setNachfrage] = useState<SlotNachfrage | null>(null);
  const a = stand.zoom;
  if (a === undefined || zoom === undefined) {
    return (
      <section data-connect="zoom" className="space-y-3">
        <div data-connect="zoom-kopf">
          <h2 className="text-sm font-semibold">{ZOOM_TITEL}</h2>
        </div>
        {ladeFehler && <p className={STIL.fehler}>{ladeFehler}</p>}
      </section>
    );
  }
  const slotAufrufe = slotAufrufeAus(zoom, nachfrage, setNachfrage);
  /** Im Meeting: „Als Slot laden“ ist nur dann bedienbar (Spec 7.5 Nr. 9). */
  const imMeeting = a.kurz.zustand === 'im_meeting';

  // Teilnehmerzeile ohne Ton-Schalter, ohne die Knöpfe und Zeilen der Quellen (Spec 7.5 Nr. 9, Plan B, Task B11), mit „Als Slot
  // laden“ bzw. den Angaben T39–T39d (Task B21) und dem leeren Kennzeichen-Platz für #317 Stufe B (B19, W2-6).
  const zeile = (t: ZoomParticipant): JSX.Element => {
    const ort: SlotOrt = `zeile:${t.id}`;
    const text = slotAufrufe.antwortText(ort);
    return (
      <li key={t.id} data-connect="teilnehmer" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t.name}</span>
          {t.rolle === 'host' && <Kennzeichen>{KANDIDAT_KENNZEICHEN.host}</Kennzeichen>}
          {t.rolle === 'coHost' && <Kennzeichen>Co-Host</Kennzeichen>}
          {t.kamera === 'aus' && <Kennzeichen>{KANDIDAT_KENNZEICHEN.kameraAus}</Kennzeichen>}
          {t.kamera === 'keine' && <Kennzeichen>keine Kamera</Kennzeichen>}
          {t.imWarteraum && <Kennzeichen>{KANDIDAT_KENNZEICHEN.imWarteraum}</Kennzeichen>}
          {t.doppelname && <Kennzeichen rot>Name doppelt</Kennzeichen>}
          {/* Leerer Platz für Kennzeichen aus #317 Stufe B (B19, W2-6): heute ohne Inhalt und ohne eigene Fläche (display: contents). */}
          <span data-connect="kennzeichen" className="contents" />
          {/* Spec 7.5 Nr. 9, 10.10: „Als Slot laden“ (T38, im Warteraum T98) bzw. die Angaben T39–T39d. */}
          <span className="ml-auto flex items-center gap-2">
            <TeilnehmerSlotAngabe t={t} a={a} imMeeting={imMeeting} aufrufe={slotAufrufe} />
          </span>
        </div>
        {text && <p className={`mt-1 ${STIL.fehler}`}>{text}</p>}
        <NachfrageZeile aufrufe={slotAufrufe} ort={`zeile:${t.id}`} />
      </li>
    );
  };

  return (
    <section data-connect="zoom" className="@container space-y-3">
      {/* 1–7 · Titel, Statuszeile, Antwort, Meldung, Beitritt bzw. Verlassen, Bild-Versatz */}
      <ZoomCard a={a} zoom={zoom} />

      {/* 8 · Zoom-Slots (Spec 7.5 Nr. 8): Kopf, Vorschau-Schalter, Kacheln mit Einstellungen je Kachel */}
      <SlotBereich a={a} aufrufe={slotAufrufe} />

      {/* 8 · Teilnehmerliste (ohne eigene Zeile; Host und Co-Host zuerst, sortiert der Kern) */}
      {a.teilnehmer.length > 0 && (
        <ul data-connect="zoom-teilnehmer" className="space-y-2">
          {a.teilnehmer.map((t) => zeile(t))}
        </ul>
      )}

      {/* 11 · Messwerte (Spec 7.5 Nr. 11, 7.8): aufklappbar, eingeklappt als Vorgabe; Kopie ohne Namen */}
      <Messwerte a={a} />

      {/* 10 · Hinweise (die letzten 5) */}
      {a.hinweise.length > 0 && (
        <div data-connect="zoom-hinweise">
          <div className="mb-1 text-xs font-semibold text-[var(--muted-foreground)]">Hinweise</div>
          <ul className="space-y-0.5 text-xs text-[var(--muted-foreground)] select-text">
            {a.hinweise.map((h, i) => (
              <li key={`${i}:${h}`}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 11 · Fußzeile der Zoom-Quellen */}
      <div data-connect="zoom-fuss" className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted-foreground)]">
        <span>{FUSSZEILE}</span>
        <Button
          size="sm"
          uppercase={false}
          variant="outline"
          className="shrink-0"
          onClick={() => void zoom.fuehreAus('logordner', null, () => ohneText(window.jmconnect.zoomLogordner()))}
        >
          Logordner öffnen
        </Button>
      </div>
    </section>
  );
}
