// Einstellungs-Panel des Prompters (UX Welle 2a, Aufgabe d; Spec 3.6, 6; E3, E11, E15): „Ausgabe auf Bildschirm“ (Talent-Monitor) und
// die Fernsteuerung aus @jm/settings mit den Props aus lib/oberflaeche.ts – dieselbe Ableitung wie die Statusleiste, also eine
// Wahrheit –, dahinter die tool-eigenen Abschnitte Schrift, Lese-Linie, Darstellung und Handy-Fernbedienung (Inhalt des alten
// Steuerpults). Jeder Abschnitt ist ein Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein
// Store und kein Effekt (E15): Aktionen kommen aus der View, die Bildschirmliste liest die View (beim Start, beim Öffnen des Panels,
// bei jeder Änderung des Ausgabezustands und bei jedem Bildschirm-Ereignis). Den gemessenen Ort des Monitors nennt der
// Ausgabe-Abschnitt selbst (Pille und „Steht auf“ aus measuredId, UX Welle 2b).
import { RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { Button, Field, PanelAnker, SettingsSection, Toggle, UNBEKANNT } from '@jm/ui';
import type { PartialPrompterConfig } from '@shared/types';
import { RemoteQr } from '@/components/RemoteQr';
import { Regler } from '@/components/Regler';
import { ABSCHNITT, ausgabeAbschnitt, fernsteuerungAbschnitt, kannVerschieben, PROMPTER_TEXTE, type OberflaechenStand, type PrompterAktionen } from '@/lib/oberflaeche';

/** Die Aktionen des Panels: Ausgabe und Bildschirm aus lib/oberflaeche.ts, dazu Konfiguration und Handy-Fernbedienung. */
export interface EinstellungenAktionen extends PrompterAktionen {
  konfigurieren(patch: PartialPrompterConfig): void;
  handyUmschalten(an: boolean): void;
  /** Den offenen Monitor auf den gewählten Bildschirm ziehen (`openOutput`). */
  ausgabeVerschieben(): void;
}

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = PROMPTER_TEXTE;
  const p = stand.prompter;
  const c = p?.config;
  // Noch kein Zustand aus dem Main: die tool-eigenen Abschnitte zeigen „unbekannt“, nie erfundene Werte.
  const unbekannt = <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>;
  return (
    <div className="space-y-5">
      <ScreenOutputSection {...ausgabeAbschnitt(stand, aktionen)} />
      {kannVerschieben(stand.ausgabe) && (
        <Button type="button" variant="outline" size="sm" uppercase={false} data-prompter="verschieben" onClick={aktionen.ausgabeVerschieben}>
          {T.ausgabe.verschieben}
        </Button>
      )}
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />

      <PanelAnker id={ABSCHNITT.schrift}>
        <SettingsSection title={T.titel.schrift}>
          {c === undefined ? (
            unbekannt
          ) : (
            <div className="space-y-2.5">
              <Regler label="Schriftgröße" value={c.fontScale} min={3} max={16} step={0.5} onChange={(v) => aktionen.konfigurieren({ fontScale: v })} />
              <Regler label="Zeilenabstand" value={c.lineHeight} min={1} max={2.4} step={0.05} onChange={(v) => aktionen.konfigurieren({ lineHeight: v })} />
              <Regler label="Seitenrand" value={c.marginXPct} min={0} max={28} step={1} suffix=" %" onChange={(v) => aktionen.konfigurieren({ marginXPct: v })} />
            </div>
          )}
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.leselinie}>
        <SettingsSection title={T.titel.leselinie}>
          {c === undefined ? (
            unbekannt
          ) : (
            <div className="space-y-2.5">
              <Field label="Lese-Linie anzeigen">
                <Toggle checked={c.readingLine} onChange={(v) => aktionen.konfigurieren({ readingLine: v })} />
              </Field>
              {c.readingLine && (
                <Regler label="Position" value={c.readingLinePct} min={15} max={80} step={1} suffix=" %" onChange={(v) => aktionen.konfigurieren({ readingLinePct: v })} />
              )}
            </div>
          )}
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.darstellung}>
        <SettingsSection title={T.titel.darstellung}>
          {c === undefined ? (
            unbekannt
          ) : (
            <div className="space-y-2.5">
              <Field label="Spiegeln ⇄">
                <Toggle checked={c.mirrorH} onChange={(v) => aktionen.konfigurieren({ mirrorH: v })} />
              </Field>
              <Field label="Spiegeln ⇅">
                <Toggle checked={c.mirrorV} onChange={(v) => aktionen.konfigurieren({ mirrorV: v })} />
              </Field>
              <Field label="Fett">
                <Toggle checked={c.bold} onChange={(v) => aktionen.konfigurieren({ bold: v })} />
              </Field>
            </div>
          )}
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.handy}>
        <SettingsSection title={T.handy.titel}>
          {p === undefined || c === undefined ? (
            unbekannt
          ) : (
            <div className="space-y-2.5">
              <Field label="Fernbedienung aktiv">
                <Toggle checked={c.remoteEnabled} onChange={(v) => aktionen.handyUmschalten(v)} />
              </Field>
              {p.remote.running && p.remote.urls.length > 0 && (
                <div data-prompter="handy-adressen" className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] p-2.5">
                  <div className="text-[11px] text-[var(--muted-foreground)]">Am Handy im selben WLAN scannen oder URL öffnen:</div>
                  <RemoteQr url={p.remote.urls[0] ?? ''} />
                  {p.remote.urls.map((u) => (
                    <div key={u} className="tabular break-all text-sm font-bold text-[var(--primary)]">
                      {u}
                    </div>
                  ))}
                </div>
              )}
              {c.remoteEnabled && p.remote.urls.length === 0 && <p className="text-[11px] text-[var(--muted-foreground)]">{T.handy.keineAdresse}</p>}
            </div>
          )}
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
