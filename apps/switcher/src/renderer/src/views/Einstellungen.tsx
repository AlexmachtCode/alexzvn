// Einstellungs-Panel des Switchers (UX Welle 1, d1; Spec 3.6, 5.1, 6, Anhang A „Switcher“ › Einstellungen; E4, E5): die vier
// gemeinsamen Abschnitte aus @jm/settings (NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, Programm-Audio) mit den Props aus
// lib/oberflaeche.ts – dieselben Ableitungen wie die Statusleiste, also eine Wahrheit –, dahinter die tool-eigenen Abschnitte
// „Streaming“, „Aufnahme“ und „Programm-Format“. Jeder Abschnitt ist ein Sprungziel (PanelAnker, id wie das settingsSection des
// Statuseintrags). Kein window und kein Effekt (G7, G8): Das Panel ist nur offen gemountet; Fernsteuerungsabo, Monitor- und
// Geräteliste und Steuerserver-Start bleiben in SwitcherOberflaeche und SwitcherView.
import { AudioDeviceSection, NdiOutputSection, RemoteControlSection, ScreenOutputSection } from '@jm/settings';
import { Button, Field, NumberInput, PanelAnker, Select, SettingsSection, TextInput } from '@jm/ui';
import { RESOLUTIONS, type ProgramResolution } from '@shared/output-quality';
import {
  ABSCHNITT,
  aufloesungName,
  audioAbschnitt,
  bildschirmAbschnitt,
  bitrateEmpfehlung,
  fernsteuerungAbschnitt,
  ndiAbschnitt,
  streamHinweis,
  SWITCHER_TEXTE,
  type OberflaechenStand,
  type SwitcherAktionen,
} from '@/lib/oberflaeche';

export interface EinstellungenProps {
  stand: OberflaechenStand;
  aktionen: SwitcherAktionen;
}

/** Bildraten der Ausgabe (wie `OUTPUT_FPS_OPTIONS` im Store; hier ohne den Store, damit das Panel ohne zustand rendert). */
const BILDRATEN = [25, 30, 50, 60] as const;

/** Gedämpfter Erklärtext der alten Einstellungs-Karten (R8): die gemeinsamen Abschnitte haben dafür keinen eigenen Platz. */
function Erklaerung({ children }: { children: string }): React.JSX.Element {
  return <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{children}</p>;
}

export function Einstellungen({ stand, aktionen }: EinstellungenProps): React.JSX.Element {
  const st = stand.settings;
  const T = SWITCHER_TEXTE;
  const F = T.feld;
  const aufloesungen = Object.keys(RESOLUTIONS) as ProgramResolution[];

  return (
    <div className="space-y-5">
      <Erklaerung>{T.panelText.einleitung}</Erklaerung>
      <NdiOutputSection {...ndiAbschnitt(stand, aktionen)} />
      <Erklaerung>{T.panelText.ndi}</Erklaerung>
      <ScreenOutputSection {...bildschirmAbschnitt(stand, aktionen)} />
      {/* R8: „Monitore aktualisieren“ und der Erklärtext der alten Karte; ScreenOutputSection hat keinen eigenen Platz dafür */}
      <Button variant="outline" size="sm" uppercase={false} onClick={aktionen.scanDisplays}>
        {T.panelText.monitoreAktualisieren}
      </Button>
      <Erklaerung>{T.panelText.bildschirm}</Erklaerung>
      <RemoteControlSection {...fernsteuerungAbschnitt(stand, aktionen)} />
      <Erklaerung>{T.panelText.fernsteuerung}</Erklaerung>
      <AudioDeviceSection {...audioAbschnitt(stand, aktionen)} />
      <Erklaerung>{T.panelText.audio}</Erklaerung>

      <PanelAnker id={ABSCHNITT.streaming}>
        <SettingsSection title={T.titel.streaming} description={streamHinweis(st.programResolution, st.outputFps, st.audioInputId)}>
          <Field label={F.rtmpZiel} hint={F.rtmpHinweis}>
            <TextInput value={st.rtmpUrl} onChange={aktionen.setRtmpUrl} placeholder={F.rtmpPlatzhalter} />
          </Field>
          <Field label={F.streamBitrate} hint={`${F.streamBitrateHinweis} ${bitrateEmpfehlung(st.programResolution, 'stream')}`}>
            <NumberInput value={st.streamBitrateKbps} ganzzahl min={500} max={20000} unit={F.einheitKbit} onChange={aktionen.setStreamBitrateKbps} />
          </Field>
        </SettingsSection>
      </PanelAnker>

      <PanelAnker id={ABSCHNITT.aufnahme}>
        <SettingsSection title={T.titel.aufnahme} description={F.aufnahmeHinweis}>
          <Field label={F.aufnahmeBitrate} hint={`${F.aufnahmeBitrateHinweis} ${bitrateEmpfehlung(st.programResolution, 'record')}`}>
            <NumberInput value={st.recordBitrateKbps} ganzzahl min={1000} max={60000} unit={F.einheitKbit} onChange={aktionen.setRecordBitrateKbps} />
          </Field>
        </SettingsSection>
      </PanelAnker>

      {/* Programm-Format (E5): Quelle der NDI-Ausgabe, Auflösung und Bildrate gelten für alle Ausgaben */}
      <PanelAnker id={ABSCHNITT.format}>
        <SettingsSection title={T.titel.format} description={F.formatHinweis}>
          <Field label={F.ndiQuelle} hint={F.ndiQuelleHinweis}>
            <Select
              value={st.ndiOutputSource}
              options={[
                { value: 'program', label: F.quelleProgram },
                { value: 'multiview', label: F.quelleMultiview },
              ]}
              onChange={(v) => aktionen.setNdiOutputSource(v === 'multiview' ? 'multiview' : 'program')}
            />
          </Field>
          <Field label={F.aufloesung}>
            <Select
              value={st.programResolution}
              options={aufloesungen.map((r) => ({ value: r, label: `${aufloesungName(r)} (${RESOLUTIONS[r].w}×${RESOLUTIONS[r].h})` }))}
              onChange={(v) => aktionen.setProgramResolution(v === '720p' ? '720p' : '1080p')}
            />
          </Field>
          <Field label={F.bildrate} hint={F.bildrateHinweis}>
            <Select
              value={String(st.outputFps)}
              options={BILDRATEN.map((f) => ({ value: String(f), label: `${f} fps` }))}
              onChange={(v) => aktionen.setOutputFps(Number(v))}
            />
          </Field>
        </SettingsSection>
      </PanelAnker>
    </div>
  );
}
