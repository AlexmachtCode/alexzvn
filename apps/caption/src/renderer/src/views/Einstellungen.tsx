// Einstellungs-Panel der Caption (UX Welle 2a, Caption d; Spec 3.6, 6; E8, E9, E15; Funktionsliste Nr. 5–8, 13–23): NDI-Ausgabe,
// Audiogerät und Fernsteuerung aus @jm/settings mit den Props aus lib/oberflaeche.ts (dieselbe Ableitung wie die Statusleiste),
// dahinter die tool-eigenen Abschnitte Erkennung (vorher Kopfleiste und Klappe „Erweitert“: Modell, Sprache, Engine, Wörterbuch,
// Max. Äußerung) und Darstellung (vorher NDI-Leiste: Schrift, Zeilen, Band). Jedes Feld ruft dieselbe Store-Aktion wie bisher
// und speichert nur (setConfig); keine Wahl startet oder stoppt etwas. Wie bisher wirken Auflösung, Bildrate, Schrift, Zeilen
// und Band sofort auf Vorschau und NDI-Bild, ein Gerätewechsel startet eine laufende Aufnahme mit dem neuen Eingang neu, und ein
// Modellwechsel startet den whisper-Server bei der nächsten Äußerung neu (Nr. 60, 69, 80). Die Zahlenfelder „Schrift“ und
// „Max. Äußerung (s)“ sind seit Altfehler CA-8 NumberInput aus @jm/ui wie im Recorder (E13): Übernahme bei Enter oder Verlassen,
// ein leeres oder ungültiges Feld zeigt den Fehlertext aus @jm/ui und wirkt nicht (zuvor Number(Wert) bei jeder Taste, Nr. 16, 23,
// 101). Die Grenzen kommen aus shared/konfig.ts, dieselben, auf die der Main Datei und IPC zieht (C1). Jeder Abschnitt ist ein
// Sprungziel (PanelAnker, id wie das settingsSection des Statuseintrags). Kein window, kein Store, keine Hooks (E15): Werte und
// Aktionen kommen aus der View.
import { AudioDeviceSection, NdiOutputSection, RemoteControlSection } from '@jm/settings';
import { Field, NumberInput, PanelAnker, Select, SettingsSection, UNBEKANNT } from '@jm/ui';
import { CAPTION_GRENZEN } from '@shared/konfig';
import type { CaptionConfig, WhisperModelId } from '@shared/types';
import type { EinstellungenAktionen } from '@/lib/aktionen';
import {
  ABSCHNITT,
  CAPTION_TEXTE,
  ENGINES,
  fernsteuerungAbschnitt,
  MODELLE,
  mikrofonAbschnitt,
  NDI_ZEILEN,
  ndiAbschnitt,
  SPRACHEN,
  type OberflaechenStand,
} from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: EinstellungenAktionen;
}

/** Natives Feld (Wörterbuch) in der Gestalt der @jm/ui-Eingaben, nur Tokens. */
const FELD =
  'w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] px-2.5 text-[13px] text-[var(--foreground)] ' +
  'placeholder:text-[var(--muted-foreground)] select-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  const T = CAPTION_TEXTE;
  const c: CaptionConfig | undefined = stand.caption?.config;
  // Vor der ersten Antwort des Main: NDI gesperrt wie die Tasten („Lädt …“), die tool-eigenen Abschnitte „unbekannt“.
  const ndi = { ...ndiAbschnitt(stand, aktionen), ...(stand.caption === undefined ? { locked: T.grund.zustandOffen } : {}) };
  const unbekannt = <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>;
  return (
    <div className="space-y-5">
      <NdiOutputSection {...ndi} />
      <AudioDeviceSection {...mikrofonAbschnitt(stand, aktionen)} />
      <RemoteControlSection {...fernsteuerungAbschnitt(stand)} />

      <PanelAnker id={ABSCHNITT.erkennung}>
        <SettingsSection title={T.erkennung.titel}>
          {c === undefined ? (
            unbekannt
          ) : (
            <div className="space-y-2.5">
              <Field label={T.erkennung.modell}>
                <Select
                  options={MODELLE.map((m) => ({ value: m.id, label: m.label }))}
                  value={c.model}
                  onChange={(v) => aktionen.konfigurieren({ model: v as WhisperModelId })}
                />
              </Field>
              <Field label={T.erkennung.sprache}>
                <Select options={SPRACHEN.map((l) => ({ value: l.id, label: l.label }))} value={c.language} onChange={(v) => aktionen.konfigurieren({ language: v })} />
              </Field>
              <Field label={T.erkennung.engine}>
                <Select
                  options={ENGINES.map((e) => ({ value: e.id, label: e.label }))}
                  value={c.engine}
                  onChange={(v) => aktionen.konfigurieren({ engine: v as CaptionConfig['engine'] })}
                />
              </Field>
              <Field label={T.erkennung.woerterbuch} id="ca-woerterbuch">
                <textarea
                  id="ca-woerterbuch"
                  value={c.dictionary}
                  onChange={(e) => aktionen.konfigurieren({ dictionary: e.target.value })}
                  rows={4}
                  placeholder={T.erkennung.woerterbuchPlatzhalter}
                  className={`${FELD} py-1.5`}
                />
              </Field>
              <Field label={T.erkennung.maxAeusserung} id="ca-max-aeusserung">
                <NumberInput
                  id="ca-max-aeusserung"
                  value={c.maxUtteranceSec}
                  min={CAPTION_GRENZEN.maxUtteranceSec.min}
                  max={CAPTION_GRENZEN.maxUtteranceSec.max}
                  onChange={(n) => aktionen.konfigurieren({ maxUtteranceSec: n })}
                  className="w-24"
                />
              </Field>
            </div>
          )}
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.darstellung}>
        <SettingsSection title={T.darstellung.titel}>
          {c === undefined ? (
            unbekannt
          ) : (
            <div className="space-y-2.5">
              <Field label={T.darstellung.schrift} id="ca-schrift">
                <NumberInput
                  id="ca-schrift"
                  value={c.ndiFontSize}
                  min={CAPTION_GRENZEN.ndiFontSize.min}
                  max={CAPTION_GRENZEN.ndiFontSize.max}
                  ganzzahl
                  onChange={(n) => aktionen.konfigurieren({ ndiFontSize: n })}
                  className="w-24"
                />
              </Field>
              <Field label={T.darstellung.zeilen}>
                <Select
                  options={NDI_ZEILEN.map((n) => ({ value: String(n), label: String(n) }))}
                  value={String(c.ndiLines)}
                  onChange={(v) => aktionen.konfigurieren({ ndiLines: Number(v) })}
                  className="w-24"
                />
              </Field>
              <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={c.ndiBand}
                  onChange={(e) => aktionen.konfigurieren({ ndiBand: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                {T.darstellung.band}
              </label>
            </div>
          )}
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
