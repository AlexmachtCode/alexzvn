import { useEffect, useState } from 'react';
import { Button, Card, noDragRegion } from '@jm/ui';
import { ANMELDE_TEXTE, KONTO_TEXTE, anmeldeAnzeige } from '@/lib/konto-dialog';
import { useKonto } from '@/store/konto';

/**
 * Anmeldung (Plan P25, Spec 4.1): Anmelde-Dialog mit dem Code, den der Browser gleich zeigt (K41), Frist (K43), „Adresse
 * kopieren“ (K44), Hinweis (K45/K52) und Abbrechen. Was er zeigt, entscheidet allein anmeldeAnzeige (lib/konto-dialog.ts);
 * der Code kommt nur im Schritt „wartet“ (AA6). Muster wie SystemStatusModal (G11): höchstens fensterhoch, ein Scrollbereich,
 * Escape und Klick daneben schließen (beim Warten mit Abbruch im Main, AA5).
 */
export function AnmeldeModal(): React.JSX.Element | null {
  const offen = useKonto((s) => s.anmeldungOffen);
  const schritt = useKonto((s) => s.anmeldeSchritt);
  const abbrechen = useKonto((s) => s.anmeldenAbbrechen);
  const schliessen = useKonto((s) => s.schliesseAnmeldung);
  const neuStarten = useKonto((s) => s.anmelden);
  const kopieren = useKonto((s) => s.adresseKopieren);
  const [kopiert, setKopiert] = useState(false);
  const [jetzt, setJetzt] = useState(() => Date.now());

  // K43: die Frist zählt sekündlich herunter, solange der Dialog offen ist.
  useEffect(() => {
    if (!offen) return;
    setJetzt(Date.now());
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [offen]);
  // Nach „fertig“ (K33 kommt als Meldung des Mains) und „abgebrochen“ geht der Dialog zu.
  useEffect(() => {
    if (offen && (schritt.art === 'fertig' || schritt.art === 'abgebrochen')) schliessen();
  }, [offen, schritt, schliessen]);
  useEffect(() => {
    if (schritt.art !== 'wartet') setKopiert(false);
  }, [schritt]);

  const z = anmeldeAnzeige(schritt, jetzt);
  // Escape und Klick daneben: beim Warten abbrechen (der Main stoppt die Abfrage), sonst nur schließen.
  const zu = (): void => {
    if (z.knoepfe.includes('abbrechen')) void abbrechen();
    else schliessen();
  };
  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') zu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
      style={noDragRegion}
      onClick={(e) => {
        if (e.target === e.currentTarget) zu();
      }}
    >
      <Card className="w-full max-w-md p-6 jm-fade-in">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          <div className="shrink-0">
            <h2 className="text-lg font-extrabold tracking-tight">{ANMELDE_TEXTE.titel}</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{ANMELDE_TEXTE.vergleichen}</p>
          </div>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {z.code !== null && (
              <div className="mt-5 flex flex-col items-center gap-1">
                <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                  {ANMELDE_TEXTE.code}
                </span>
                <span data-anleitung="anmeldung.code" className="font-mono text-3xl font-extrabold tracking-[0.2em] tabular-nums">
                  {z.code}
                </span>
                {z.frist && <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{z.frist}</span>}
              </div>
            )}
            {z.text && (
              <p role="status" className="mt-4 text-sm">
                {z.text}
              </p>
            )}
            {z.hinweis && <p className="mt-3 text-xs text-[var(--muted-foreground)]">{z.hinweis}</p>}
          </div>
          <div className="mt-6 flex shrink-0 flex-wrap items-center justify-end gap-3">
            {z.knoepfe.includes('kopieren') && (
              <Button variant="outline" onClick={() => void kopieren().then(setKopiert)}>
                {kopiert ? ANMELDE_TEXTE.kopiert : ANMELDE_TEXTE.kopieren}
              </Button>
            )}
            {z.knoepfe.includes('neu-starten') && (
              <Button variant="primary" onClick={neuStarten}>
                {ANMELDE_TEXTE.neuStarten}
              </Button>
            )}
            {z.knoepfe.includes('erneut') && (
              <Button variant="primary" onClick={neuStarten}>
                {ANMELDE_TEXTE.erneut}
              </Button>
            )}
            {z.knoepfe.includes('abbrechen') && (
              <Button variant="ghost" onClick={() => void abbrechen()}>
                {ANMELDE_TEXTE.abbrechen}
              </Button>
            )}
            {z.knoepfe.includes('schliessen') && (
              <Button variant="ghost" onClick={schliessen}>
                {KONTO_TEXTE.schliessen}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
