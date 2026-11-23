// Einstellungs-Panel des Presenters (UX Welle 2b, Presenter d1; B8, B11, Presenter-Block „Panel“): eine Komponente für Editor und
// Referent, das Fenster kommt nur aus stand.fenster. Editor: „Ausgabe auf Bildschirm“ (Startbildschirm) mit der Zeile „Keiner – nur
// NDI“ (Windows), NDI-Ausgabe (Windows), Fernsteuerung, Handy-Fernsteuerung, Gast-Klicker, Timer (Gegenstellen) und Import.
// Referent ohne Ausgabe und Import: Die Live-Wahl steht dort in der Leiste (P2-A), eine zweite Bedienstelle wäre eine zweite Wahrheit.
// Die gemeinsamen Abschnitte bekommen ihre Props aus lib/oberflaeche.ts – dieselbe Ableitung wie die Statusleiste. Jeder Abschnitt
// ist ein Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Store und kein Effekt (B8, E15):
// Stand und Aktionen kommen aus der Wurzel-View (useStand, standAktionen). Nur der Import liest und merkt seinen Schalter wie bisher
// über lib/settings.ts (jmpr.expandPptxBuilds).
import { useState } from 'react';
import { NdiOutputSection, PeersSection, RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { Badge, Field, PanelAnker, SettingsSection, Toggle, UNBEKANNT } from '@jm/ui';
import type { RemoteConfig } from '@shared/types';
import { GastKlickerAbschnitt, type GastKlickerAktionen } from '@/components/GastKlickerAbschnitt';
import { HandyAbschnitt } from '@/components/RemotePanel';
import {
  ABSCHNITT,
  ausgabeAbschnitt,
  fernsteuerungAbschnitt,
  ndiAbschnitt,
  nurNdiZeile,
  PRESENTER_TEXTE,
  timerAbschnitt,
  type OberflaechenStand,
  type PresenterAktionen,
  type StartWahl,
} from '@/lib/oberflaeche';
import { getExpandPptxBuilds, setExpandPptxBuilds } from '@/lib/settings';

/** Die Aktionen des Panels: NDI, Timer, Handy und Gast-Klicker in beiden Fenstern; die Startwahl nur im Editor. */
export interface EinstellungenAktionen extends Pick<PresenterAktionen, 'ndiSchalten' | 'timerSchalten' | 'timerSetzen'> {
  /** Handy-Server anwenden und merken (`remote.apply`); der neue Stand kommt über `remote:status`. */
  handyAnwenden(config: RemoteConfig): Promise<unknown>;
  gastKlicker: GastKlickerAktionen;
  /** Nur im Editor (B11): Startbildschirm und „Keiner – nur NDI“ merken, in der Wurzel-View; öffnet und verschiebt nichts. */
  startwahl?: Pick<PresenterAktionen, 'startBildschirmWaehlen'> & { nurNdiWaehlen(an: boolean): void };
}

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
  /** Nur im Editor: dieselbe Startwahl, die die Wurzel-View der Statusleiste gibt. */
  startWahl?: StartWahl;
}

const HINWEIS = 'text-[11px] text-[var(--muted-foreground)]';

export function Einstellungen({ stand, aktionen, startWahl }: EinstellungenProps): React.JSX.Element {
  const T = PRESENTER_TEXTE;
  const editor = stand.fenster === 'editor';
  const zeile = startWahl === undefined ? undefined : nurNdiZeile(stand, startWahl);
  return (
    <div className="space-y-5">
      {editor && startWahl !== undefined ? (
        <>
          <ScreenOutputSection {...ausgabeAbschnitt(stand, startWahl, aktionen.startwahl)} />
          {zeile?.sichtbar ? (
            <div data-presenter="nur-ndi" className="rounded-[var(--radius-lg)] border border-[var(--border)] p-3">
              <Field label={T.publikum.nurNdi} lockedReason={zeile.gesperrt}>
                <Toggle checked={zeile.an} onChange={(an) => aktionen.startwahl?.nurNdiWaehlen(an)} />
              </Field>
            </div>
          ) : null}
        </>
      ) : null}

      {stand.plattform === 'win32' ? (
        <>
          <NdiOutputSection {...ndiAbschnitt(stand, aktionen)} />
          <p data-presenter="ndi-hinweis" className={HINWEIS}>
            {T.ndi.tipp}
          </p>
        </>
      ) : null}

      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />

      <PanelAnker id={ABSCHNITT.handy}>
        <SettingsSection title={T.handy.titel} description={T.handy.erklaerung}>
          {stand.handy === undefined ? (
            <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>
          ) : (
            <HandyAbschnitt status={stand.handy} netzwerkkarten={stand.netzwerkkarten} anwenden={aktionen.handyAnwenden} />
          )}
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.gastKlicker}>
        <SettingsSection title={T.gastKlicker.titel} description={T.gastKlicker.erklaerung}>
          <GastKlickerAbschnitt status={stand.gastKlicker} aktionen={aktionen.gastKlicker} />
        </SettingsSection>
      </PanelAnker>

      <PeersSection {...timerAbschnitt(stand, aktionen)} />
      <p data-presenter="timer-hinweis" className={HINWEIS}>
        {T.timer.erklaerung}
      </p>

      {editor ? <ImportAbschnitt /> : null}
    </div>
  );
}

/** Import (nur Editor): PPTX-Aufbau-Animationen als Einzelschritte, gemerkt wie bisher im localStorage (lib/settings.ts). */
function ImportAbschnitt(): React.JSX.Element {
  const T = PRESENTER_TEXTE.import;
  // Gelesen beim Öffnen des Panels (das Panel hängt sich beim Schließen aus); jede Änderung merkt lib/settings.ts sofort.
  const [an, setAn] = useState(getExpandPptxBuilds);
  return (
    <PanelAnker id={ABSCHNITT.import}>
      <SettingsSection title={T.titel} right={<Badge tone="warning">{T.experimentell}</Badge>}>
        <Field label={T.einzelschritte} hint={T.erklaerung}>
          <Toggle
            checked={an}
            onChange={(neu) => {
              setExpandPptxBuilds(neu);
              setAn(neu);
            }}
          />
        </Field>
      </SettingsSection>
    </PanelAnker>
  );
}
