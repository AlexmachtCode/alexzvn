// Rahmen-Seite der Galerie: eine AppShell fensterfüllend, aufgerufen mit
// `?ansicht=shell&modus=dark|light&panel=0|1&dichte=normal|kompakt`. Die Übersicht bettet sie in iframes mit 1200 px
// und 800 px Breite ein; unter 900 px greift die Schmal-Ansicht (E7: Medienabfrage auf die Fensterbreite, im iframe
// also auf dessen Breite).
import { useState } from 'react';
import { AppShell, TallyButton, type StatusItem } from '../src/index';
import {
  abschnittStatusItem,
  dataLinkView,
  DataLinkSection,
  iveoView,
  IveoSection,
  ndiOutputView,
  NdiOutputSection,
  remoteControlView,
  RemoteControlSection,
} from '../../settings/src/index';
import { SHELL_ABSCHNITTE } from './beispiele-settings';

export interface ShellParameter {
  modus: 'dark' | 'light';
  panel: boolean;
  dichte: 'normal' | 'kompakt';
  /** false = Zustand ohne Sitzung (Spec 3.8): leere Statusleiste mit Uhr, keine Einstellungen, kein ⚙. */
  sitzung: boolean;
}

/** Liest die Parameter der Rahmen-Seite; fremde Werte → Dunkel, Panel zu, normal, mit Sitzung. */
export function leseShellParameter(p: URLSearchParams): ShellParameter {
  return {
    modus: p.get('modus') === 'light' ? 'light' : 'dark',
    panel: p.get('panel') === '1',
    dichte: p.get('dichte') === 'kompakt' ? 'kompakt' : 'normal',
    sitzung: p.get('sitzung') !== '0',
  };
}

/** Adresse der Rahmen-Seite (relativ, für das src eines iframes). */
export function shellAdresse(p: ShellParameter): string {
  return `?ansicht=shell&modus=${p.modus}&panel=${p.panel ? '1' : '0'}&dichte=${p.dichte}&sitzung=${p.sitzung ? '1' : '0'}`;
}

export function ShellSeite(p: ShellParameter): React.JSX.Element {
  const [offen, setOffen] = useState(p.panel);
  const [abschnitt, setAbschnitt] = useState<string | undefined>(p.panel ? SHELL_ABSCHNITTE.fernsteuerung.id : undefined);
  const [live, setLive] = useState(false);
  // Die Statusleiste entsteht aus denselben Ableitungen wie die Pillen im Panel (Spec 6.1, abschnittStatusItem).
  // Ohne Sitzung (Spec 3.8) bleibt sie leer, und es gibt keine Einstellungen.
  const status: StatusItem[] = p.sitzung
    ? [
        abschnittStatusItem(dataLinkView(SHELL_ABSCHNITTE.datalink), { group: 'tool', label: 'DataLink' }),
        abschnittStatusItem(ndiOutputView(SHELL_ABSCHNITTE.ndi), { group: 'ausgabe', label: 'NDI' }),
        abschnittStatusItem(iveoView(SHELL_ABSCHNITTE.iveo), { group: 'verbindung', label: 'iveo' }),
        abschnittStatusItem(remoteControlView(SHELL_ABSCHNITTE.fernsteuerung), { group: 'fernsteuerung', label: 'Companion' }),
      ]
    : [];
  // Die Klasse dark/light sitzt auf dem eigenen Wurzel-div, nicht auf <html>: ThemeToggle in der Kopfzeile schaltet
  // <html> um, die Ansicht soll aber fest im verlangten Modus bleiben.
  return (
    <div className={p.modus === 'light' ? 'light bg-[var(--background)] text-[var(--foreground)]' : 'dark bg-[var(--background)] text-[var(--foreground)]'}>
      <AppShell
        tool="Titler"
        headerCenter={<span className="truncate text-xs text-[var(--muted-foreground)]">Show: Fachtagung 2026 · vom Master</span>}
        onAir={{ live }}
        status={status}
        toolbar={<div className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--muted-foreground)]">Vorlage: Bauchbinde zweizeilig</div>}
        settings={
          p.sitzung ? (
            <>
              <NdiOutputSection {...SHELL_ABSCHNITTE.ndi} />
              <RemoteControlSection {...SHELL_ABSCHNITTE.fernsteuerung} />
              <IveoSection {...SHELL_ABSCHNITTE.iveo} />
              <DataLinkSection {...SHELL_ABSCHNITTE.datalink} />
            </>
          ) : undefined
        }
        settingsOpen={offen}
        settingsSection={abschnitt}
        onSettingsChange={(open, id) => {
          setOffen(open);
          setAbschnitt(id);
        }}
        dichte={p.dichte}
      >
        <div className="grid grid-cols-2 gap-3 p-4" style={{ maxWidth: 640 }}>
          <TallyButton state={live ? 'live' : 'bereit'} label="Take" shortcut="Enter" onClick={() => setLive(true)} />
          <TallyButton
            state={live ? 'bereit' : 'gesperrt'}
            label="Clear"
            disabledReason="Nichts auf Sendung"
            onClick={() => setLive(false)}
          />
        </div>
      </AppShell>
    </div>
  );
}
