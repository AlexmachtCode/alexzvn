// Pflicht-Fußzeile des Hauptfensters (UX Welle 2b, Connect d1; B19; 22.5 Ort 4, E35, E55, LP3, LP5; beide Plattformen): der
// Markenhinweis T134 als Fußnote und die Knöpfe aus T142 „Logordner öffnen“ und „Lizenzbedingungen“ (öffnet nur LIZENZ.txt im
// Paket). Sie steht im Inhalt nach beiden Spalten, immer gerendert, und scrollt mit (nicht fixed, nicht sticky). Die Knöpfe gehen
// per IPC an den Main; T143 neben einem Knopf kommt aus OeffnenKnopf (zoom/SlotBereich.tsx), der Knopf bleibt bedienbar.
import { NDI_TEXT } from '@shared/ndi-text';
import { OeffnenKnopf } from '@/zoom/SlotBereich';

/** Aussehen der Öffnen-Knöpfe in Fußzeile und Grundzeilen: die alte Größe, Farben aus Tokens (W2-9). */
export const OEFFNEN_STIL =
  'rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]';

export function Fusszeile(): JSX.Element {
  return (
    <footer
      data-connect="fusszeile"
      className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]"
    >
      <span>{NDI_TEXT.t134}</span>
      <span className="flex flex-wrap items-center gap-2">
        <OeffnenKnopf stelle="logordnerFusszeile" text={NDI_TEXT.t142Logordner} oeffnen={() => window.jmconnect.logordner()} stil={OEFFNEN_STIL} />
        <OeffnenKnopf stelle="lizenz" text={NDI_TEXT.t142Lizenz} oeffnen={() => window.jmconnect.lizenz()} stil={OEFFNEN_STIL} />
      </span>
    </footer>
  );
}
