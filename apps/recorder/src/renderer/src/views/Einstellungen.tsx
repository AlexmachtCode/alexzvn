// Einstellungs-Panel des Recorders (UX Welle 2a, Recorder d; Spec 3.6, 6; E13, E15; Funktionsliste Nr. 6, 16–20, 27–29, 105):
// Eingang (AudioDeviceSection aus @jm/settings), dahinter die tool-eigenen Abschnitte Format (Kanäle mit „Max“, Samplerate,
// ASIO-Hinweis) und Ziel (Ordner, Dateiname, Spuren einzeln), zuletzt die Fernsteuerung (RemoteControlSection, Modul „JM Audio
// Recorder“). Eingang und Format kommen aus lib/oberflaeche.ts (dieselbe Ableitung wie die Statusleiste) und sind bei
// gemessen offenem Eingang gesperrt mit AUDIO_TEXTE.sperreEingangOffen, wie bisher disabled={open}. Kanäle und Samplerate
// sind NumberInput (E13): Übernahme bei Enter oder Verlassen, keine Pfeile. Jeder Abschnitt ist ein Sprungziel (PanelAnker,
// id wie das settingsSection des Statuseintrags). Kein window, kein Store, keine Hooks (E15): Werte und Aktionen kommen aus
// der View. Die Netzwerkordner-Rückfrage bleibt im Hauptprozess beim Preset-Import (Nr. 52), unverändert.
import { AudioDeviceSection, RemoteControlSection } from '@jm/settings';
import { Button, cn, Field, NumberInput, PanelAnker, SettingsSection, TextInput } from '@jm/ui';
import type { EinstellungenAktionen } from '@/lib/aktionen';
import { ABSCHNITT, eingangAbschnitt, fernsteuerungAbschnitt, formatAbschnitt, RECORDER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';

/** Was der Abschnitt Ziel aus dem Store zeigt (gemerkte Werte, Nr. 127). */
export interface ZielWerte {
  dir: string | null;
  fileName: string;
  separateTracks: boolean;
}

export interface EinstellungenProps {
  stand: OberflaechenStand;
  ziel: ZielWerte;
  aktionen: EinstellungenAktionen;
}

export function Einstellungen({ stand, ziel, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = RECORDER_TEXTE;
  const f = formatAbschnitt(stand);
  const alle = f.alleKanaele;
  // „Spuren einzeln“ ist nur in der Aufnahme gesperrt (wie bisher disabled={recording}), gemessen.
  const spurenGesperrt = stand.zustand?.status === 'recording';
  return (
    <div className="space-y-5">
      <AudioDeviceSection {...eingangAbschnitt(stand, aktionen)} />

      <PanelAnker id={ABSCHNITT.format}>
        <SettingsSection title={T.format.titel}>
          <div className="space-y-2.5">
            <Field label={T.format.kanaele} lockedReason={f.kanaele.lockedReason}>
              <div className="flex items-start gap-2">
                <NumberInput value={f.kanaele.wert} min={f.kanaele.min} max={f.kanaele.max} ganzzahl onChange={aktionen.kanaeleSetzen} className="w-24" />
                {alle && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    uppercase={false}
                    title={T.format.alleKanaele(alle.kanaele)}
                    disabled={alle.lockedReason !== undefined}
                    onClick={() => aktionen.kanaeleSetzen(alle.kanaele)}
                  >
                    {T.format.max}
                  </Button>
                )}
              </div>
            </Field>
            <Field label={T.format.samplerate} lockedReason={f.samplerate.lockedReason}>
              <NumberInput value={f.samplerate.wert} min={f.samplerate.min} ganzzahl onChange={aktionen.samplerateSetzen} className="w-32" />
            </Field>
            {f.asioHinweis && <p className="text-[11px] text-[var(--muted-foreground)]">{T.format.asioHinweis}</p>}
          </div>
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.ziel}>
        <SettingsSection title={T.ziel.titel}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[var(--foreground)]">{T.ziel.ordner}</p>
              <div className="flex min-w-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={aktionen.ordnerWaehlen}>
                  {T.ziel.ordnerWaehlen}
                </Button>
                <span className="min-w-0 truncate text-xs text-[var(--muted-foreground)]" title={ziel.dir || undefined}>
                  {ziel.dir ? ziel.dir : T.ziel.keinOrdner}
                </span>
              </div>
            </div>
            <Field label={T.ziel.dateiname}>
              <TextInput value={ziel.fileName} placeholder={T.ziel.dateinamePlatzhalter} onChange={aktionen.dateinameSetzen} />
            </Field>
            <label className="flex w-fit cursor-pointer select-none items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={ziel.separateTracks}
                disabled={spurenGesperrt}
                onChange={(e) => aktionen.spurenSetzen(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)] disabled:opacity-50"
              />
              <span className="space-y-0.5">
                <span className={cn('block font-semibold', spurenGesperrt && 'opacity-50')}>{T.ziel.spuren}</span>
                <span className="block text-[11px] text-[var(--muted-foreground)]">{T.ziel.spurenHinweis}</span>
              </span>
            </label>
          </div>
        </SettingsSection>
      </PanelAnker>

      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />
    </div>
  );
}
