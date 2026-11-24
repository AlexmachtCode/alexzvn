// Einstellungs-Panel von Studio-Control (UX Welle 2b, Studio-Control d1; B8, B15, Studio-Control-Block „Panel“): nur die
// Fernsteuerung (Companion-Gateway, Port 8735, Modul „JM Studio Control“). Die Props kommen aus fernsteuerungAbschnitt – dieselbe
// Ableitung wie der Statuseintrag. Setup (Inventar, Discovery, Benutzer) bleibt Reiter, die Geräteformulare bleiben in den
// Gerätepanels (S4-A). Kein window, kein Store, kein Effekt: Stand und Abos kommen aus der Wurzel-View, die das Panel nur im
// Electron-Fenster anbietet (im Browser fehlt settings ganz).
import { RemoteControlSection } from '@jm/settings';
import { fernsteuerungAbschnitt, type OberflaechenStand } from '@/lib/oberflaeche';

export function Einstellungen({ stand }: { stand: Pick<OberflaechenStand, 'fernsteuerung'> }): React.JSX.Element {
  return (
    <div className="space-y-5">
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
    </div>
  );
}
