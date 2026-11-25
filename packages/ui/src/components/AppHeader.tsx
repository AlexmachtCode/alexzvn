import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { LIVE_FLAECHE_KLASSE, STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';
import { dragRegion, isElectronMac, noDragRegion } from '../lib/titlebar';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export interface AppHeaderProps {
  /** Anzeigename ohne „JM “; angezeigt wird „JM {tool}“ (E22). */
  tool: string;
  center?: ReactNode;
  onAir?: { live: boolean; label?: string };
  /** zeigt ⚙ */
  settingsAvailable?: boolean;
  settingsOpen?: boolean;
  onSettingsToggle?(): void;
  /** id des Panels für aria-controls des ⚙ (nur gesetzt, solange das Panel offen ist). */
  panelId?: string;
  /** Platz für die Ampel auf macOS; Vorgabe isElectronMac (im Browser und unter Node false). */
  mac?: boolean;
  /** `dunkel` = festes Dunkel: kein ThemeToggle im Kopf (die Wurzel des Rahmens trägt `dark`). Vorgabe `wechselbar`. */
  thema?: 'wechselbar' | 'dunkel';
  /** Eine Aktion ganz rechts im Kopf, nach ⚙, in einem Element mit `data-bereich="kopf-aktion"` und noDragRegion. */
  kopfAktion?: ReactNode;
}

/**
 * Kopfzeile (Spec 3.2, 3.8): links Logo und „JM {tool}“, Mitte `center`, rechts On-Air-Anzeige, ThemeToggle (nur bei `thema` wechselbar), ⚙ und `kopfAktion`.
 * Die ganze Zeile ist Fenster-Ziehfläche (dragRegion); jedes Bedienelement und die Mitte tragen selbst noDragRegion,
 * sonst wären sie im Electron-Fenster nicht klickbar. Auf macOS (hiddenInset) 80 px Platz für die Ampel.
 */
export function AppHeader({
  tool,
  center,
  onAir,
  settingsAvailable = false,
  settingsOpen = false,
  onSettingsToggle,
  panelId,
  mac = isElectronMac,
  thema = 'wechselbar',
  kopfAktion,
}: AppHeaderProps): React.JSX.Element {
  const zahnradText = settingsOpen ? UI_TEXTE.einstellungenSchliessen : UI_TEXTE.einstellungenOeffnen;
  return (
    <header
      style={dragRegion}
      className={cn(
        'flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] pr-3',
        mac ? 'pl-20' : 'pl-4',
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <Logo size={22} />
        <span className="whitespace-nowrap text-sm font-extrabold tracking-[0.06em] text-[var(--foreground)]">JM {tool}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {center ? (
          <div data-bereich="mitte" style={noDragRegion} className="min-w-0 truncate text-xs text-[var(--foreground)]">
            {center}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onAir ? <OnAirAnzeige live={onAir.live} label={onAir.label} /> : null}
        {thema === 'wechselbar' ? <ThemeToggle /> : null}
        {settingsAvailable ? (
          <button
            type="button"
            data-zahnrad=""
            style={noDragRegion}
            onClick={onSettingsToggle}
            aria-expanded={settingsOpen}
            aria-controls={settingsOpen ? panelId : undefined}
            aria-label={zahnradText}
            title={zahnradText}
            className={cn(
              'inline-flex h-[var(--control-h)] w-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border',
              'text-base text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
              'motion-safe:transition-colors motion-safe:duration-150',
              settingsOpen ? 'border-[var(--tally-selected)] bg-[var(--muted)]' : 'border-[var(--border)] hover:bg-[var(--muted)]',
            )}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        ) : null}
        {kopfAktion ? (
          <div data-bereich="kopf-aktion" style={noDragRegion} className="flex shrink-0 items-center">
            {kopfAktion}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * On-Air-Anzeige (Spec 3.2, 4.2; E3): live = rote Fläche mit ■ und „ON AIR“ bzw. label in großer, extrafetter Schrift
 * (LIVE_FLAECHE_KLASSE); sonst „bereit“ mit grünem ● und Text in Vordergrundfarbe. Nie nur Farbe.
 */
function OnAirAnzeige({ live, label }: { live: boolean; label?: string }): React.JSX.Element {
  // Stabile Region außen: Sie bleibt beim Wechsel live ↔ bereit erhalten, damit der Screenreader den Wechsel ansagt.
  // inline-flex + items-center: Das Badge sitzt mittig im Flex-Kopf statt auf der Grundlinie der Region.
  return (
    <span role="status" data-bereich="onair" className="inline-flex items-center">
      <OnAirInhalt live={live} label={label} />
    </span>
  );
}

function OnAirInhalt({ live, label }: { live: boolean; label?: string }): React.JSX.Element {
  if (live) {
    return (
      <span
        data-onair="live"
        className={cn('inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1 tracking-[0.06em]', LIVE_FLAECHE_KLASSE)}
      >
        <span aria-hidden="true">{STATUS_SYMBOL.live}</span>
        {label ?? UI_TEXTE.onAir}
      </span>
    );
  }
  return (
    <span
      data-onair="bereit"
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--tally-ready)] px-2 py-0.5 text-xs font-semibold text-[var(--foreground)]"
    >
      <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.ok}>
        {STATUS_SYMBOL.ok}
      </span>
      {UI_TEXTE.bereit}
    </span>
  );
}
