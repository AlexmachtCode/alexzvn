// Einstellungs-Panel von Connect (UX Welle 2b, Connect d1; B8, B20, Connect-Block „Panel“): der gemeinsame Abschnitt
// „Fernsteuerung“ (RemoteControlSection, Steuerserver Port 8737, Props aus fernsteuerungAbschnitt – dieselbe Ableitung wie der
// Statuseintrag) und der tool-eigene Abschnitt „Cloud-Zugang“ (PanelAnker + SettingsSection). Task 24 hängt „Zoom-Einrichtung“
// und „Zoom-Vorgaben“ an und füllt `zoom`. Keine IveoSection (W2-5; die Show-Karte bleibt im Cloud-Raum). Kein window, kein Store,
// kein Effekt: Stand, Adresse und Aktionen kommen aus der Wurzel-View, die über Panel-Wechsel stabil bleibt; das Panel hängt sich
// beim Schließen aus.
import { RemoteControlSection } from '@jm/settings';
import { PanelAnker, SettingsSection } from '@jm/ui';
import type { ProxyInfo } from '@shared/types';
import { ABSCHNITT, CONNECT_TEXTE, fernsteuerungAbschnitt, type OberflaechenStand } from '@/lib/oberflaeche';
import { CloudZugang } from './CloudZugang';

/** Die Aktionen des Panels; die Wurzel-View führt sie aus (setProxy). */
export interface EinstellungenAktionen {
  /** Adresse speichern (`setProxy({ url })`); eine leere Adresse setzt die Vorgabe. Antwortet mit dem neuen Cloud-Zugang. */
  proxySpeichern(url: string): Promise<ProxyInfo>;
  /** Den alten Proxy-Key entfernen (`setProxy({ key: '' })`), ohne Rückfrage wie bisher. */
  keyEntfernen(): Promise<unknown>;
}

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
  /** Adresse aus getProxy (Wurzel-View): undefined = noch keine Antwort, null = Abfrage gescheitert. */
  proxyAdresse: string | null | undefined;
  /** Zoom-Aufrufe für die Zoom-Abschnitte; Task 24 setzt den Typ (ZoomAufrufe) und hängt die Abschnitte an. */
  zoom?: never;
}

export function Einstellungen({ stand, aktionen, proxyAdresse }: EinstellungenProps): JSX.Element {
  return (
    <div className="space-y-5">
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <PanelAnker id={ABSCHNITT.cloud}>
        <SettingsSection title={CONNECT_TEXTE.titel.cloud}>
          <CloudZugang status={stand.status} proxyAdresse={proxyAdresse} aktionen={aktionen} />
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
