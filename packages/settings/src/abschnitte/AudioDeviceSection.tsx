// --- @jm/settings: AudioDeviceSection (Spec 6.2), mehrere benannte Wahlen ---
import { Button, Field, Select } from '@jm/ui';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { AUDIO_TEXTE, audioDeviceView, type AudioDeviceSectionProps } from './audio-device';

export function AudioDeviceSection(p: AudioDeviceSectionProps): React.JSX.Element {
  const view = audioDeviceView(p);
  const gesperrt = istGesperrt(view);
  const sperre = gesperrt ? true : undefined;
  return (
    <SectionFrame view={view} titel={AUDIO_TEXTE.titel}>
      {view.wahlen.map((w, i) => {
        const c = p.choices[i];
        return (
          <div key={w.key} data-wahl={w.key} className="space-y-1">
            {w.listeBekannt ? (
              <Field label={w.label} hint={w.hinweis} lockedReason={c.lockedReason || undefined}>
                <Select
                  options={w.optionen}
                  value={c.value}
                  placeholder={w.platzhalter}
                  fehlendLabel={c.lastLabel || undefined}
                  onChange={(v) => c.onChange?.(v)}
                  disabled={sperre}
                />
              </Field>
            ) : (
              <Anzeige label={w.label} hinweis={w.hinweis}>
                {AUDIO_TEXTE.unbekannt}
              </Anzeige>
            )}
            {w.pegel ? (
              <div className="space-y-1">
                <p className="text-[11px] text-[var(--muted-foreground)] tabular">{w.pegel.text}</p>
                <div aria-hidden="true" className="h-1.5 rounded-[var(--radius-md)] bg-[var(--secondary)]">
                  <div className="h-full rounded-[var(--radius-md)] bg-[var(--tally-ready)]" style={{ width: `${w.pegel.prozent}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {view.sichtbar.aktualisieren ? (
        <Button type="button" variant="outline" size="sm" uppercase={false} className="motion-reduce:transition-none" onClick={() => p.onRefresh?.()} disabled={gesperrt}>
          {AUDIO_TEXTE.aktualisieren}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
