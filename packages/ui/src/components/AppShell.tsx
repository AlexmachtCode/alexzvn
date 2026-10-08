import { useId, type ReactNode } from 'react';
import type { StatusItem } from '../lib/status';
import { AppHeader } from './AppHeader';
import { SettingsPanel } from './SettingsPanel';
import { StatusBar } from './StatusBar';

/** Props wörtlich aus Spec 3.1. */
export interface AppShellProps {
  tool: string;
  headerCenter?: ReactNode;
  onAir?: { live: boolean; label?: string };
  status: StatusItem[];
  toolbar?: ReactNode;
  settings?: ReactNode;
  settingsOpen: boolean;
  settingsSection?: string;
  onSettingsChange(open: boolean, sectionId?: string): void;
  dichte?: 'normal' | 'kompakt';
  children: ReactNode;
}

/** `settings` fehlt = kein ⚙, kein Panel (Spec 3.1). `false` und `null` zählen als fehlend. */
function hatEinstellungen(settings: ReactNode): boolean {
  return settings !== undefined && settings !== null && settings !== false;
}

/**
 * Rückruf der Statusleiste (E14): nur mit `settings` öffnet ein Klick das Panel beim Abschnitt; ohne `settings` gibt es
 * keinen Rückruf, und kein Statuseintrag wird zum Knopf. Nur aus dieser Datei exportiert.
 */
export function statusKlick(
  p: Pick<AppShellProps, 'settings' | 'onSettingsChange'>,
): ((sectionId: string) => void) | undefined {
  if (!hatEinstellungen(p.settings)) return undefined;
  return (sectionId) => p.onSettingsChange(true, sectionId);
}

/** ⚙ schaltet das Panel um, ohne Abschnitt. Nur aus dieser Datei exportiert. */
export function zahnradKlick(p: Pick<AppShellProps, 'settingsOpen' | 'onSettingsChange'>): () => void {
  return () => p.onSettingsChange(!p.settingsOpen);
}

/** Escape und ✕ des Panels schließen es, ohne Abschnitt (Spec 3.1). Nur aus dieser Datei exportiert. */
export function panelSchliessen(p: Pick<AppShellProps, 'onSettingsChange'>): () => void {
  return () => p.onSettingsChange(false);
}

/**
 * Rahmen jedes Tools (Spec 3.1, 3.8): senkrecht Kopfzeile · Werkzeugleiste (nur wenn gesetzt) · Inhalt mit dem
 * Einstellungs-Panel rechts daneben · Statusleiste. Das Panel liegt in der Inhaltszeile und verdeckt Kopf- und
 * Statusleiste deshalb nie; unter 900 px liegt es über dem Inhalt (E7). `dichte` steht als data-dichte an der Wurzel
 * (E6, die Tokens dazu in sizes.css). Funktioniert ohne Sitzung: leere Statusleiste, keine Einstellungen.
 */
export function AppShell(p: AppShellProps): React.JSX.Element {
  const {
    tool,
    headerCenter,
    onAir,
    status,
    toolbar,
    settings,
    settingsOpen,
    settingsSection,
    dichte = 'normal',
    children,
  } = p;
  const panelId = useId();
  const mitEinstellungen = hatEinstellungen(settings);
  const offen = mitEinstellungen && settingsOpen;

  return (
    <div data-dichte={dichte} className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader
        tool={tool}
        center={headerCenter}
        onAir={onAir}
        settingsAvailable={mitEinstellungen}
        settingsOpen={offen}
        onSettingsToggle={zahnradKlick(p)}
        panelId={panelId}
      />
      {toolbar ? (
        <div data-bereich="toolbar" className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-1.5">
          {toolbar}
        </div>
      ) : null}
      <div data-bereich="inhalt" className="relative flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
        <SettingsPanel open={offen} onClose={panelSchliessen(p)} sectionId={settingsSection} id={panelId}>
          {settings}
        </SettingsPanel>
      </div>
      <StatusBar items={status} onOpenSection={statusKlick(p)} />
    </div>
  );
}
