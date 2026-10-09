// --- @jm/settings: Rahmen eines Einstellungs-Abschnitts (Spec 6.1) ---
//
// Kopf mit Titel und Statuspille, Sperrgrund VOR den Feldern, Felder, Fehlertext immer NACH den
// Feldern. Der Anker (`einstellung-<id>`) ist das Sprungziel aus der Statusleiste (Spec 3.6).
// Statusfarben färben nur Ränder und Symbole, nie Wörter (Plan G7).
import { PanelAnker, SettingsSection, StatusPill } from '@jm/ui';
import type { ReactNode } from 'react';
import { ABSCHNITT_TEXTE, hatFehler, istGesperrt, type SectionBase } from './vertrag';

export interface SectionFrameProps { view: SectionBase; titel: string; children: ReactNode }

export function SectionFrame({ view, titel, children }: SectionFrameProps): React.JSX.Element {
  return (
    <PanelAnker id={view.id}>
      <SettingsSection title={titel} right={<StatusPill state={view.status.state} text={view.status.text} />}>
        {istGesperrt(view) ? (
          <p data-gesperrt="true" className="border-l-2 border-[var(--border)] pl-2 text-xs text-[var(--muted-foreground)]">
            {ABSCHNITT_TEXTE.gesperrt(view.locked ?? '')}
          </p>
        ) : null}
        <div className="space-y-3">{children}</div>
        {hatFehler(view) ? (
          <p data-fehler="true" className="border-l-2 border-[var(--status-error)] pl-2 text-xs text-[var(--foreground)] select-text">
            <span aria-hidden="true">⚠</span>
            {` ${view.error}`}
          </p>
        ) : null}
      </SettingsSection>
    </PanelAnker>
  );
}

/** Nur-Lese-Zeile eines Abschnitts (Wert, den das Tool meldet): Beschriftung, Wert, optional Hinweis. */
export interface AnzeigeProps { label: string; children: ReactNode; hinweis?: string }

export function Anzeige({ label, children, hinweis }: AnzeigeProps): React.JSX.Element {
  return (
    <div data-anzeige={label} className="space-y-1">
      <p className="text-xs font-semibold text-[var(--foreground)]">{label}</p>
      <div className="text-sm text-[var(--foreground)] select-text break-all">{children}</div>
      {hinweis ? <p className="text-[11px] text-[var(--muted-foreground)]">{hinweis}</p> : null}
    </div>
  );
}
