// Einstellungs-Panel des Players (UX Welle 2a, Player d1; Spec 3.6, 6; E3, E14, E15): „Ausgabe auf Bildschirm“ (das alte Modal
// „Video-Ausgabe“ der Cue-Show) und die Fernsteuerung aus @jm/settings mit den Props aus lib/oberflaeche.ts – dieselbe
// Ableitung wie die Statusleiste, also eine Wahrheit. Die Bildschirmauswahl merkt nur; „Auf diesen Bildschirm“ zieht ein
// gemessen offenes Fenster um (wie Prompter). Unter der Ausgabe steht der Hinweis des alten Dialogs. Jeder Abschnitt ist ein
// Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Store und kein Effekt (E15):
// Aktionen kommen aus der View, die Bildschirmliste und das Vollbild liest die View. Unter dem Ausgabe-Abschnitt steht die
// gemessene Lage des Fensters (Gesamtprüfung I3).
import { RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { Button } from '@jm/ui';
import type { EinstellungenAktionen } from '@/lib/aktionen';
import { ausgabeAbschnitt, fernsteuerungAbschnitt, gemesseneLage, kannVerschieben, PLAYER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = PLAYER_TEXTE;
  const lage = gemesseneLage(stand);
  return (
    <div className="space-y-5">
      <ScreenOutputSection {...ausgabeAbschnitt(stand, aktionen)} />
      {lage !== undefined && (
        <p data-player="lage" className="px-2 text-xs font-semibold text-[var(--foreground)]">
          {lage}
        </p>
      )}
      {kannVerschieben(stand.ausgabe) && (
        <Button type="button" variant="outline" size="sm" uppercase={false} data-player="verschieben" onClick={aktionen.ausgabeVerschieben}>
          {T.ausgabe.verschieben}
        </Button>
      )}
      <p data-player="ausgabe-hinweis" className="px-2 text-[11px] text-[var(--muted-foreground)]">
        {T.ausgabe.hinweis}
      </p>
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
    </div>
  );
}
