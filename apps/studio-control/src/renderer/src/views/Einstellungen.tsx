// Einstellungs-Panel von Studio-Control (UX Welle 2b, Studio-Control d1; B8, B15, Studio-Control-Block „Panel“): die Fernsteuerung
// (Companion-Gateway, Port 8735, Modul „JM Studio Control“), darunter seit Altfehler SC-S1 der Abschnitt Browser-Zugang (Ort der
// Datei mit dem Erst-Passwort, nie das Passwort). Die Props kommen aus fernsteuerungAbschnitt und browserZugang – dieselben
// Ableitungen wie der Statuseintrag. Setup (Inventar, Discovery, Benutzer) bleibt Reiter, die Geräteformulare bleiben in den
// Gerätepanels (S4-A). Kein window, kein Store, kein Effekt: Stand und Abos kommen aus der Wurzel-View, die das Panel nur im
// Electron-Fenster anbietet (im Browser fehlt settings ganz).
import { RemoteControlSection, SectionFrame } from '@jm/settings';
import { ABSCHNITT, browserZugang, browserZugangStatus, fernsteuerungAbschnitt, type OberflaechenStand } from '@/lib/oberflaeche';

export function Einstellungen({ stand }: { stand: Pick<OberflaechenStand, 'fernsteuerung' | 'erstPasswort'> }): React.JSX.Element {
  const zugang = browserZugang(stand.erstPasswort);
  return (
    <div className="space-y-5">
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <SectionFrame view={{ id: ABSCHNITT.browserZugang, status: browserZugangStatus(stand.erstPasswort) }} titel={zugang.titel}>
        <p data-studio="browser-zugang" className="text-sm text-[var(--foreground)] select-text break-words">
          {zugang.text}
        </p>
      </SectionFrame>
    </div>
  );
}
