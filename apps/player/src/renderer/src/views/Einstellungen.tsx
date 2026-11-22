// Einstellungs-Panel des Players (UX Welle 2a, Player d1; Spec 3.6, 6; E3, E14, E15): „Ausgabe auf Bildschirm“ (das alte Modal
// „Video-Ausgabe“ der Cue-Show) und die Fernsteuerung aus @jm/settings mit den Props aus lib/oberflaeche.ts – dieselbe
// Ableitung wie die Statusleiste, also eine Wahrheit. Unter der Ausgabe steht der Hinweis des alten Dialogs. Jeder Abschnitt ist
// ein Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Store und kein Effekt (E15):
// Aktionen kommen aus der View, die Bildschirmliste und das Vollbild liest die View.
import { RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { ausgabeAbschnitt, fernsteuerungAbschnitt, PLAYER_TEXTE, type OberflaechenStand, type PlayerAktionen } from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: PlayerAktionen;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  return (
    <div className="space-y-5">
      <ScreenOutputSection {...ausgabeAbschnitt(stand, aktionen)} />
      <p data-player="ausgabe-hinweis" className="px-2 text-[11px] text-[var(--muted-foreground)]">
        {PLAYER_TEXTE.ausgabe.hinweis}
      </p>
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
    </div>
  );
}
