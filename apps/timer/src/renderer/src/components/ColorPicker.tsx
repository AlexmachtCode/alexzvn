import { useStore } from '@/store/timer';
import { Button, Field, NumberInput, TextInput } from '@jm/ui';
import { TimerDisplay } from './TimerDisplay';

const DEFAULTS = {
  normal: '#FFE819',
  warning: '#FFB81C',
  overtime: '#F61C56',
  warningAtSec: 60,
};

interface Row {
  key: keyof typeof DEFAULTS;
  label: string;
  description: string;
}

const ROWS: Row[] = [
  { key: 'normal',   label: 'Normal',   description: 'Solange genug Zeit bleibt.' },
  { key: 'warning',  label: 'Warning',  description: 'Wenn unter dem Schwellenwert.' },
  { key: 'overtime', label: 'Overtime', description: 'Wenn der Countdown abgelaufen ist.' },
];

/**
 * Inhalt des Panel-Abschnitts „Farben“ (E9; vorher die Ansicht „Farben“): Vorschau der drei Zustände, drei Farbfelder, Warning-Schwelle
 * und Zurücksetzen. Die Farben sind Daten des Nutzers (ColorConfig), keine Oberflächenfarben.
 */
export function ColorPicker() {
  const colors = useStore((s) => s.colors);
  const setColors = useStore((s) => s.setColors);

  return (
    <div data-timer="farben" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3">
        <Preview ms={5 * 60_000 + 30_000} label="Normal" />
        <Preview ms={30_000} label="Warning" />
        <Preview ms={-12_000} label="Overtime" />
      </div>

      <div className="h-px bg-[var(--border)]/60" />

      <div className="flex flex-col gap-4">
        {ROWS.map((row) => (
          <ColorRow
            key={row.key}
            label={row.label}
            description={row.description}
            value={colors[row.key] as string}
            onChange={(v) => setColors({ [row.key]: v } as Partial<typeof DEFAULTS>)}
          />
        ))}

        <Field label="Warning-Schwelle" hint="Sekunden, ab denen die Farbe auf Warning wechselt.">
          <NumberInput value={colors.warningAtSec} min={0} ganzzahl onChange={(n) => setColors({ warningAtSec: n })} className="w-32" />
        </Field>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" uppercase={false} onClick={() => setColors(DEFAULTS)}>
            Auf JM-Defaults zurücksetzen
          </Button>
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} hint={description}>
      <div className="flex items-center gap-3">
        <label className="relative h-[var(--control-h)] w-14 shrink-0 rounded-[var(--radius-md)] overflow-hidden border border-[var(--field-border)] cursor-pointer">
          <input
            type="color"
            aria-label={label}
            value={normalizeHex(value)}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span aria-hidden className="block h-full w-full" style={{ background: value }} />
        </label>
        <TextInput value={value} onChange={onChange} className="w-32 uppercase" />
      </div>
    </Field>
  );
}

function Preview({ ms, label }: { ms: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--background)]/40 border border-[var(--border)]/40 overflow-hidden min-w-0">
      <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <TimerDisplay ms={ms} reactive size="preview" />
    </div>
  );
}

function normalizeHex(v: string): string {
  // <input type="color"> requires #RRGGBB
  if (/^#([0-9a-f]{6})$/i.test(v)) return v;
  if (/^#([0-9a-f]{3})$/i.test(v)) {
    return (
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    );
  }
  return '#FFE819';
}
