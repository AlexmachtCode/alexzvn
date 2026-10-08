import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { UI_TEXTE } from '../lib/texte';
import { noDragRegion } from '../lib/titlebar';

/** So lange bleibt der angesprungene Abschnitt hervorgehoben (Spec 3.6 „kurz“). */
export const PANEL_HERVORHEBUNG_MS = 1500;

export interface SettingsPanelProps {
  open: boolean;
  onClose(): void;
  /** Beim Öffnen anzuspringender Abschnitt (id eines PanelAnker). */
  sectionId?: string;
  id?: string;
  children: ReactNode;
}

export interface PanelAnkerProps {
  id: string;
  className?: string;
  children: ReactNode;
}

const PanelKontext = createContext<{ hervorgehoben?: string }>({});

/** Welcher Abschnitt gerade hervorgehoben ist (außerhalb eines Panels: keiner). */
export function useSettingsPanel(): { hervorgehoben?: string } {
  return useContext(PanelKontext);
}

/** Bedienelemente, die Tasten selbst verbrauchen (Leertaste schaltet, Pfeile wählen): dort bleibt die Taste im Panel. */
const BEDIENELEMENTE = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']);

function istBedienelement(ziel: unknown): boolean {
  const el = ziel as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  return !!el && (BEDIENELEMENTE.has(el.tagName ?? '') || el.isContentEditable === true);
}

/**
 * Tasten im Panel (E8, Spec 10 „Tastaturkürzel bleiben gleich“): Escape bleibt im Panel und schließt es, wenn die Taste noch
 * niemandem gehört (nicht defaultPrevented). Jede andere Taste bleibt nur im Panel, wenn sie auf einem Bedienelement liegt
 * (Toggle, Feld, Auswahl, Knopf, Link) – dort würde sie sonst zugleich schalten und ein Tool-Kürzel (Leertaste = GO) auslösen.
 * Liegt der Fokus auf dem Panel oder einem Abschnitt (z. B. nach einem Klick auf ⚙), erreichen die Kürzel das Tool wie bisher.
 * Hängt am Panel selbst. Nur aus dieser Datei exportiert.
 */
export function panelTaste(
  e: {
    key: string;
    defaultPrevented: boolean;
    target?: unknown;
    stopPropagation(): void;
    preventDefault(): void;
  },
  onClose: () => void,
): void {
  if (e.key === 'Escape' || istBedienelement(e.target)) e.stopPropagation();
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  e.preventDefault();
  onClose();
}

/** Ein Tastenereignis, wie panelTaste es braucht (React.KeyboardEvent passt). */
export type PanelTaste = Parameters<typeof panelTaste>[0];

/** Alle Props des <aside> (E7, E8). Nur aus dieser Datei exportiert. */
export interface PanelProps {
  id?: string;
  'aria-label': string;
  tabIndex: -1;
  style: CSSProperties;
  onKeyDown(e: PanelTaste): void;
  className: string;
}

/** Props des Panels als reine Funktion: aria-label „Einstellungen“, Fokusziel, noDragRegion, Escape über panelTaste. */
export function panelProps(p: { id?: string; onClose(): void }): PanelProps {
  return {
    id: p.id,
    'aria-label': UI_TEXTE.einstellungen,
    tabIndex: -1,
    style: noDragRegion,
    onKeyDown: (e) => panelTaste(e, p.onClose),
    className: cn(
      'flex h-full w-[var(--panel-w)] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface-raised)]',
      'text-[var(--foreground)] outline-none',
      'max-[900px]:absolute max-[900px]:inset-y-0 max-[900px]:right-0 max-[900px]:z-20 max-[900px]:shadow-xl',
    ),
  };
}

/** Was panelFokus von einem Element braucht (HTMLElement passt). */
export interface FokusZiel {
  focus(o?: { preventScroll?: boolean }): void;
}
export interface FokusPanel extends FokusZiel {
  contains(ziel: unknown): boolean;
}

/**
 * Körper des Fokus-Effekts (E8): Fokus beim Öffnen auf den angesprungenen Abschnitt (`ziel`), sonst aufs Panel; das Aufräumen gibt ihn dorthin zurück, wo er vorher war
 * (⚙ oder Statuseintrag) – nur, wenn er im Panel lag. Nicht modal. Nur aus dieser Datei exportiert.
 */
export function panelFokus(panel: FokusPanel | null, aktiv: () => FokusZiel | null, ziel?: FokusZiel | null): () => void {
  const vorher = aktiv();
  (ziel ?? panel)?.focus({ preventScroll: true });
  return () => {
    if (panel && panel.contains(aktiv())) vorher?.focus();
  };
}

/** Was panelSprung von der Uhr braucht (setTimeout/clearTimeout passen). */
export interface ZeitGeber {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTE_ZEIT: ZeitGeber = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Körper des Sprung-Effekts (Spec 3.6): Abschnitt hervorheben, seinen Anker in Sicht holen und die Hervorhebung nach
 * PANEL_HERVORHEBUNG_MS beenden. Liefert das Aufräumen; ein neuer Sprung beginnt von vorn. Nur aus dieser Datei exportiert.
 */
export function panelSprung(
  sectionId: string | undefined,
  anker: (id: string) => { scrollIntoView(o: { block: 'nearest' }): void } | undefined,
  setze: (id: string | undefined) => void,
  zeit: ZeitGeber = ECHTE_ZEIT,
): (() => void) | undefined {
  setze(sectionId);
  if (!sectionId) return undefined;
  anker(sectionId)?.scrollIntoView({ block: 'nearest' });
  const ende = zeit.setTimeout(() => setze(undefined), PANEL_HERVORHEBUNG_MS);
  return () => zeit.clearTimeout(ende);
}

/** Das Element mit dem Fokus (nur aus Effekten gerufen, also nur im Browser). */
function aktivesElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/** Anker im eigenen Panel über data-section-id (dieselbe globale id kann es in der Galerie zweimal geben). */
function ankerIn(panel: HTMLElement | null, ziel: string): HTMLElement | undefined {
  return Array.from(panel?.querySelectorAll<HTMLElement>('[data-section-id]') ?? []).find((el) => el.dataset.sectionId === ziel);
}

// Fokus-Rückgabe muss laufen, bevor React das Panel aus dem DOM nimmt (sonst liegt der Fokus schon auf <body>);
// auf dem Server gibt es keinen Layout-Effekt, deshalb dort der gewöhnliche Effekt (der dort ebenfalls nicht läuft).
const useLayoutEffektImBrowser = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Seitenpanel „Einstellungen“ (Spec 3.1, 3.6): rechts neben dem Inhalt, 360 px (--panel-w), unter 900 px Fensterbreite
 * über dem Inhalt (E7). Springt beim Öffnen zu `sectionId` und hebt ihn PANEL_HERVORHEBUNG_MS lang hervor. Nicht modal:
 * keine Fokusfalle; der Fokus kommt beim Öffnen aufs Panel und geht beim Schließen dorthin zurück, wo er vorher war
 * (⚙ oder Statuseintrag) – aber nur, wenn er im Panel lag. Zu: nichts gerendert.
 */
export function SettingsPanel(p: SettingsPanelProps): React.JSX.Element | null {
  if (!p.open) return null;
  return <OffenesPanel {...p} />;
}

function OffenesPanel({ onClose, sectionId, id, children }: SettingsPanelProps): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null);
  const [hervorgehoben, setHervorgehoben] = useState<string | undefined>(sectionId);
  useLayoutEffektImBrowser(() => panelFokus(panelRef.current, aktivesElement, sectionId ? ankerIn(panelRef.current, sectionId) : null), []);
  useEffect(() => panelSprung(sectionId, (ziel) => ankerIn(panelRef.current, ziel), setHervorgehoben), [sectionId]);

  return (
    <aside ref={panelRef} {...panelProps({ id, onClose })}>
      <div className="flex h-[var(--header-h)] shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
        <h2 className="text-sm font-extrabold">{UI_TEXTE.einstellungen}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={UI_TEXTE.einstellungenSchliessen}
          title={UI_TEXTE.einstellungenSchliessen}
          className={cn(
            'ml-auto inline-flex h-[var(--control-h)] w-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)]',
            'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
            'motion-safe:transition-colors motion-safe:duration-150',
          )}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <PanelKontext.Provider value={{ hervorgehoben }}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      </PanelKontext.Provider>
    </aside>
  );
}

/**
 * Sprungziel eines Abschnitts im Panel (id `einstellung-<id>`). Ist er der angesprungene, trägt er kurz einen Rand in
 * --tally-selected („ausgewählt“) und data-hervorgehoben="true" – ohne Fläche, damit gedämpfte Schrift lesbar bleibt (E23).
 */
export function PanelAnker({ id, className, children }: PanelAnkerProps): React.JSX.Element {
  const { hervorgehoben } = useSettingsPanel();
  const an = hervorgehoben !== undefined && hervorgehoben === id;
  return (
    <div
      id={`einstellung-${id}`}
      data-section-id={id}
      tabIndex={-1}
      data-hervorgehoben={an ? 'true' : 'false'}
      className={cn(
        'scroll-mt-2 rounded-[var(--radius-lg)] border-2 p-2 motion-safe:transition-colors motion-safe:duration-150',
        an ? 'border-[var(--tally-selected)]' : 'border-transparent',
        className,
      )}
    >
      {children}
    </div>
  );
}
