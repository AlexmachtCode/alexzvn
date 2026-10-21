import { useState } from 'react';
import { Button, Card, cn, noDragRegion } from '@jm/ui';
import type { CookbookCategory } from '@jm/cookbook';
import { useCookbook } from '@/store/cookbook';

const CATEGORIES: CookbookCategory[] = [
  'Veranstaltungsformate',
  'Technik-Setups',
  'Kunden-/Location-Setups',
  'Tool-Manuals',
];

const PLACEHOLDER =
  'Stichpunkte genügen — die KI macht daraus ein vollständiges Rezept:\n' +
  '• Worum geht es? (Format / Setup / Tool)\n' +
  '• Equipment & Rollen (was, wem gehört es)\n' +
  '• Ablauf: Vorbereitung → während → Nachbereitung\n' +
  '• Stolperfallen & Profi-Tipps';

/**
 * Formular „Neues Rezept" (Pfad B = KI). Operator gibt Titel, Kategorie und
 * Stichpunkte ein; der KI-Agent erzeugt daraus ein schema-treues Rezept und
 * öffnet einen PR. Das feste Format ist strukturell erzwungen — die KI füllt
 * nur Inhalt; ein Mensch reviewt den PR vor dem Merge.
 */
export function RecipeDraftModal() {
  const open = useCookbook((s) => s.draftOpen);
  const close = useCookbook((s) => s.closeDraft);
  const submit = useCookbook((s) => s.submitDraft);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CookbookCategory>('Veranstaltungsformate');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  if (!open) return null;

  const canSend = title.trim().length > 0 && notes.trim().length > 0 && !busy;

  const reset = (): void => {
    setTitle('');
    setCategory('Veranstaltungsformate');
    setNotes('');
    setPrUrl(null);
  };

  const onClose = (): void => {
    reset();
    close();
  };

  const onSend = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await submit({ title, category, notes });
      if (res.ok) setPrUrl(res.url ?? '');
    } finally {
      setBusy(false);
    }
  };

  // Folgepunkt aus der Durchsicht 21.10.2026 (Muster #233, SystemStatusModal): rund 593 px hoch bei rund 601 px Innenhöhe
  // des kleinsten Fensters; bei weniger Innenhöhe rutschten Abbrechen und Rezept erzeugen hinaus. Das Overlay hebt die
  // Zieh-Fläche des Kopfs auf (sie schluckt in Electron Klicks auch darunter).
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6" style={noDragRegion}>
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        {/* Höchstens fensterhoch: eigener flex-col-Container, weil Card ihre Kinder in ein eigenes div packt. Fenster minus
            Außenabstand (p-6) minus Innenabstand der Card (p-6). Kopf und Fuß schrumpfen nicht, nur die Mitte scrollt. */}
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
        <div className="shrink-0">
          <h2 className="text-lg font-extrabold tracking-tight">Neues Rezept</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Stichpunkte rein — die KI baut ein formattreues Rezept und öffnet einen PR. Ein Mensch
            prüft ihn vor der Aufnahme.
          </p>
        </div>

        {/* EIN Scroll-Bereich für beide Zustände; -ml-1 pl-1 pb-1 und -mr-2 pr-2 halten Platz für die Fokusringe der
            Eingabefelder am Rand, die der Scrollbereich sonst abschneidet. */}
        <div className="-mr-2 -ml-1 min-h-0 flex-1 overflow-y-auto pb-1 pl-1 pr-2">
        {prUrl !== null ? (
          // Erfolg: PR geöffnet → klickbarer Link, Modal bleibt offen.
          <div className="mt-6">
            <div
              className="rounded-[var(--radius)] border border-[var(--success)]/40 bg-[var(--success)]/10
                         px-4 py-3 text-sm text-[var(--foreground)]"
            >
              <p className="font-semibold">Entwurf eingereicht 🎉</p>
              <p className="mt-1 text-[var(--muted-foreground)]">
                Die KI hat ein Rezept erzeugt und einen Pull Request geöffnet. Bitte im PR prüfen,
                Lücken füllen und mergen — dann erscheint das Rezept im Kochbuch.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                Titel
              </span>
              <input
                value={title}
                placeholder="z. B. Hybride Townhall im großen Saal"
                onChange={(e) => setTitle(e.target.value)}
                className={cn(
                  'h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
                  'px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
                )}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                Kategorie
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CookbookCategory)}
                className={cn(
                  'h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
                  'px-3 text-sm text-[var(--foreground)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
                )}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
                Notizen / Stichpunkte
              </span>
              <textarea
                value={notes}
                rows={8}
                placeholder={PLACEHOLDER}
                onChange={(e) => setNotes(e.target.value)}
                className={cn(
                  'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] resize-none',
                  'px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
                )}
              />
            </label>

            <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              Hinweis: Sensible Kunden-/Personendaten (z. B. Namen, Zugänge) hier weglassen — sie
              gehören nicht ins Kochbuch und nicht in die KI-Eingabe. Beschreibe das Setup
              allgemein.
            </p>
          </div>
        )}
        </div>

        {prUrl !== null ? (
          <div className="mt-4 flex shrink-0 items-center justify-end gap-3">
            {prUrl && (
              <Button variant="ghost" onClick={() => void window.jmps.openExternal(prUrl)}>
                PR öffnen
              </Button>
            )}
            <Button variant="primary" onClick={reset}>
              Weiteres Rezept
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex shrink-0 items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Abbrechen
            </Button>
            <Button variant="primary" disabled={!canSend} onClick={() => void onSend()}>
              {busy ? 'KI schreibt…' : 'Rezept erzeugen'}
            </Button>
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
