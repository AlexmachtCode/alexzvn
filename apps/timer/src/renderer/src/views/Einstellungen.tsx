// Einstellungs-Panel des Timers (UX Welle 1, Aufgabe d; Spec 3.6, 5.1, 6, Anhang A „Timer“; E3, E9, E10): die Fernsteuerung aus
// @jm/settings (nur Status, Einrichten im Launcher) mit den Props aus lib/oberflaeche.ts – dieselbe Ableitung wie die Statusleiste,
// also eine Wahrheit (Spec 6.1) –, dahinter die tool-eigenen Abschnitte „Speaker-Fenster“ (E3), „LAN-Fernbedienung“ (Inhalt der
// alten Ansicht Remote) und „Farben“ (Inhalt der alten Ansicht Farben). Jeder Abschnitt ist ein Sprungziel (PanelAnker, id wie das
// settingsSection des Statuseintrags). Kein window und kein Effekt (G7, G8): Das Öffnen des Speaker-Fensters ist der Rückruf der View;
// die Adressen der LAN-Fernbedienung liest RemoteInfo, solange das Panel offen ist.
import { ABSCHNITT_TEXTE, RemoteControlSection } from '@jm/settings';
import { Button, PanelAnker, SettingsSection } from '@jm/ui';
import { ColorPicker } from '@/components/ColorPicker';
import { RemoteInfo } from '@/components/RemoteInfo';
import { ABSCHNITT, fernsteuerungAbschnitt, TIMER_TEXTE, type OberflaechenStand, type TimerAktionen } from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: TimerAktionen;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = TIMER_TEXTE;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
        {/* Ohne Rückruf zeigt der Abschnitt keinen Knopf (es gibt keinen Deep-Link); der Hinweis steht als Text darunter. */}
        <p data-timer="im-launcher" className="text-[11px] text-[var(--muted-foreground)]">
          {ABSCHNITT_TEXTE.imLauncherEinrichten}
        </p>
      </div>

      <PanelAnker id={ABSCHNITT.speaker}>
        <SettingsSection title={T.titel.speaker} description={T.speaker.hinweis}>
          <Button type="button" variant="outline" size="sm" uppercase={false} onClick={aktionen.toggleSpeaker}>
            {stand.speakerOffen === true ? T.speaker.schliessen : T.speaker.oeffnen}
          </Button>
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.lan}>
        <SettingsSection title={T.titel.lan}>
          <RemoteInfo />
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.farben}>
        <SettingsSection title={T.titel.farben}>
          <ColorPicker />
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
