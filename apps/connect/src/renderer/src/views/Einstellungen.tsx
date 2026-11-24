// Einstellungs-Panel von Connect (UX Welle 2b, Connect d1 und d2; B8, B20, B22, Connect-Block „Panel“): der gemeinsame Abschnitt
// „Fernsteuerung“ (RemoteControlSection, Steuerserver Port 8737, Props aus fernsteuerungAbschnitt – dieselbe Ableitung wie der
// Statuseintrag), der tool-eigene Abschnitt „Cloud-Zugang“ und unter Windows „Zoom-Einrichtung“ und „Zoom-Vorgaben“ (je PanelAnker +
// SettingsSection). Keine IveoSection (W2-5; die Show-Karte bleibt im Cloud-Raum). Kein Store, kein Effekt, kein Abo: Stand (mit dem
// Zoom-Abbild in stand.zoom), Adresse, Aktionen und die Zoom-Aufrufe (laufend, Antwort) kommen aus der Wurzel-View, die über
// Panel-Wechsel stabil bleibt; das Panel hängt sich beim Schließen aus.
import { RemoteControlSection } from '@jm/settings';
import { PanelAnker, SettingsSection, UNBEKANNT } from '@jm/ui';
import type { ProxyInfo } from '@shared/types';
import { ABSCHNITT, CONNECT_TEXTE, fernsteuerungAbschnitt, type OberflaechenStand } from '@/lib/oberflaeche';
import type { ZoomAufrufe } from '@/zoom/aufrufe';
import { ZoomEinrichtung } from '@/zoom/ZoomEinrichtung';
import { ZoomVorgaben } from '@/zoom/ZoomVorgaben';
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
  /** Laufende Zoom-Aufrufe und Antwort der Wurzel-View (dasselbe Objekt wie in der Zoom-Spalte); ohne sie wie vor dem ersten Abbild. */
  zoom?: ZoomAufrufe;
}

export function Einstellungen({ stand, aktionen, proxyAdresse, zoom }: EinstellungenProps): JSX.Element {
  // Zoom gibt es nur unter Windows (W2-5): unter macOS fehlen beide Zoom-Abschnitte. Ohne Abbild (oder ohne Aufrufe) steht
  // „unbekannt“ und kein Knopf (nichts geraten).
  const windows = stand.plattform === 'win32';
  const a = stand.zoom;
  const unbekannt = <p className="text-xs text-[var(--muted-foreground)]">{UNBEKANNT}</p>;
  return (
    <div className="space-y-5">
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
      <PanelAnker id={ABSCHNITT.cloud}>
        <SettingsSection title={CONNECT_TEXTE.titel.cloud}>
          <CloudZugang status={stand.status} proxyAdresse={proxyAdresse} aktionen={aktionen} />
        </SettingsSection>
      </PanelAnker>
      {windows ? (
        <PanelAnker id={ABSCHNITT.zoomEinrichtung}>
          <SettingsSection title={CONNECT_TEXTE.titel.zoomEinrichtung}>
            {a !== undefined && zoom !== undefined ? <ZoomEinrichtung a={a} zoom={zoom} /> : unbekannt}
          </SettingsSection>
        </PanelAnker>
      ) : null}
      {windows ? (
        <PanelAnker id={ABSCHNITT.zoomVorgaben}>
          <SettingsSection title={CONNECT_TEXTE.titel.zoomVorgaben}>
            {a !== undefined && zoom !== undefined ? <ZoomVorgaben a={a} zoom={zoom} /> : unbekannt}
          </SettingsSection>
        </PanelAnker>
      ) : null}
    </div>
  );
}
