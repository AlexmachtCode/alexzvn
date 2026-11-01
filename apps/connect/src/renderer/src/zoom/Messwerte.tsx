// Messwerte in der Zoom-Karte (Spec 7.5 Nr. 11, 7.8; Task B22): aufklappbar, eingeklappt als Vorgabe (Muster Einrichtung).
// Angezeigt wird der Text des Kerns (zoomMesswerteText, B16: T61–T69 ohne Teilnehmer- und NDI-Namen, 0.23), neu geholt bei
// jeder Meldung im Abbild. „Messwerte kopieren“ legt genau diesen Text in die Zwischenablage; Rückmeldung T68. Alle Texte
// aus @shared/zoom-text (B-EP4).
import { useEffect, useState } from 'react';
import type { ZoomAbbild } from '@shared/types';
import { BEDIEN_TEXT, MESS_TEXT } from '@shared/zoom-text';
import { STIL } from './SlotEinstellungen';

/** So lange steht T68 nach dem Kopieren (wie die Rückmeldung beim Kopieren eines Einladungslinks, App.tsx:548-551). */
const KOPIERT_MS = 1500;

export function Messwerte({ a }: { a: ZoomAbbild }): JSX.Element {
  const [auf, setAuf] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    if (!kopiert) return;
    const t = setTimeout(() => setKopiert(false), KOPIERT_MS);
    return () => clearTimeout(t);
  }, [kopiert]);
  const kopieren = (): void => {
    setFehler(null);
    void window.jmconnect
      .zoomMesswerteText()
      .then((text) => navigator.clipboard.writeText(text))
      .then(() => setKopiert(true))
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
  };
  // Die Anzeige ist der Text des Kerns (T61–T69, Slots als „Slot {nr} ({Modus})“, Personen als Kennung, 0.23). Er wird beim
  // Aufklappen und bei jeder neuen Meldung im Abbild neu geholt; zugeklappt fragt die Karte nichts ab.
  const m = a.messwerte;
  useEffect(() => {
    if (!auf) return;
    let gilt = true;
    void window.jmconnect
      .zoomMesswerteText()
      .then((t) => {
        if (gilt) setText(t);
      })
      .catch((e: unknown) => {
        if (gilt) setFehler(e instanceof Error ? e.message : String(e));
      });
    return () => {
      gilt = false;
    };
  }, [auf, m]);
  return (
    <div className="mb-3">
      <button onClick={() => setAuf((v) => !v)} className={STIL.rand}>
        {BEDIEN_TEXT.messwerte}
      </button>
      {auf && (
        <div className="mt-2 space-y-1 rounded border border-neutral-800 p-2 text-[11px] text-neutral-300">
          {(text ?? '')
            .split('\n')
            .filter((z) => z !== '')
            .map((z, i) => (
              <p key={`${i}:${z}`} className="font-mono">
                {z}
              </p>
            ))}
          <div className="flex items-center gap-2">
            <button onClick={kopieren} className={STIL.rand}>
              {BEDIEN_TEXT.messwerteKopieren}
            </button>
            {kopiert && <span className="text-neutral-400">{MESS_TEXT.T68}</span>}
            {fehler && <span className="text-red-300">{fehler}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
