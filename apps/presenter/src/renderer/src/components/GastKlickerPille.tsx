import { pillenText, type GastKlickerStatus } from '@shared/gast-klicker';

// Statusfarben nur als Rand und Fläche, die Schrift bleibt in Vordergrundfarbe (Kontrast, @jm/ui signal-colors).
const FARBE = {
  getrennt: 'ring-[var(--status-error)] bg-[var(--status-error)]/15',
  pausiert: 'ring-[var(--status-warn)] bg-[var(--status-warn)]/15',
  verbunden: 'ring-[var(--tally-ready)] bg-[var(--tally-ready)]/15',
} as const;

/**
 * #317: kleine Anzeige in der Leiste des Referenten, nur wenn der Gast-Klicker an ist. Ein Klick pausiert bzw. setzt
 * Gast-Klicks fort, damit Niki während der Präsentation nicht ins Panel wechseln muss. Status und Aktion kommen aus der
 * Wurzel-View (useStand, UX Welle 2b d2); kein eigenes Abo. Der neue Stand kommt über `gastKlicker:status` zurück.
 */
export function GastKlickerPille({ status: s, onPause }: { status: GastKlickerStatus | undefined; onPause(an: boolean): void }) {
  const text = s ? pillenText(s) : null;
  if (!s || !text) return null;
  const farbe = s.lage !== 'verbunden' ? FARBE.getrennt : s.pausiert ? FARBE.pausiert : FARBE.verbunden;

  return (
    <button
      type="button"
      data-presenter="gast-klick"
      onClick={() => onPause(!s.pausiert)}
      title={
        s.pausiert
          ? 'Gast-Klicks sind pausiert – klicken zum Fortsetzen'
          : `Remote-Gäste können vor/zurück klicken (${s.gaeste} verbunden) – klicken zum Pausieren`
      }
      className={`h-8 px-3 shrink-0 rounded-md text-xs font-semibold ring-1 whitespace-nowrap text-[var(--foreground)] ${farbe}`}
    >
      {text}
    </button>
  );
}
