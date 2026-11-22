import { useStore } from '@/store/timer';
import { Collapsible, Field, NumberInput, StatusPill, Toggle } from '@jm/ui';

export function AutoAdvanceSettings() {
  const autoAdvance = useStore((s) => s.timetable.autoAdvance);
  const grace = useStore((s) => s.timetable.autoAdvanceGraceSec);
  const setAutoAdvance = useStore((s) => s.ttSetAutoAdvance);
  const setGrace = useStore((s) => s.ttSetAutoAdvanceGrace);

  return (
    <Collapsible
      title="Auto-Advance"
      persistId="timer.autoAdvance"
      className="w-full"
      description="Springt automatisch zum nächsten Programmpunkt, wenn der aktuelle seine Zeit überschritten hat. Grace-Period sind Sekunden Overtime, die toleriert werden bevor der Sprung passiert."
      right={<StatusPill state={autoAdvance ? 'ok' : 'off'} text={autoAdvance ? 'Auto-Advance an' : 'Auto-Advance aus'} />}
    >
      <div className="flex items-end gap-6 flex-wrap">
        <Field label="Auto-Advance">
          <Toggle checked={autoAdvance} onChange={setAutoAdvance} />
        </Field>
        <Field label="Grace · Sekunden">
          <NumberInput value={grace} min={0} ganzzahl onChange={setGrace} disabled={!autoAdvance} className="w-28" />
        </Field>
      </div>
    </Collapsible>
  );
}
