import { Button, Card, Field, NumberInput, StatusPill, type StatusState } from '@jm/ui';
import type { BattleConfig, BattleState, ClipJob } from '@shared/types';
import { BATTLE_TEXTE, clipQuelleText } from '@/lib/oberflaeche';

function baseName(p: string): string {
  if (!p) return '';
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** Was der Kasten auslöst: die Handler des Stores. Der Clip selbst ist jetzt eine Haupttaste, der Zielordner steht im Panel. */
export interface ClipAktionen {
  pickRecording(): void;
  setConfig(patch: Partial<BattleConfig>): void;
}

const CLIP_ZUSTAND: Record<ClipJob['status'], StatusState> = { done: 'ok', error: 'error', running: 'warn' };

/** Instant-Replay am Clip-Knopf: Quell-Aufnahme wählen, Länge und die Liste der letzten Clips. */
export function ClipPanel({ state, aktionen }: { state: BattleState; aktionen: ClipAktionen }): React.JSX.Element {
  const cfg = state.config;

  return (
    <Card glossy={false} data-ba="replay" className="p-3">
      <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">{BATTLE_TEXTE.titel.replay}</h2>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" uppercase={false} onClick={() => aktionen.pickRecording()}>
            Aufnahme …
          </Button>
          <span className="truncate text-[var(--muted-foreground)]" title={cfg.recordingPath}>
            {clipQuelleText(cfg)}
          </span>
        </div>
        <Field label="Länge">
          {/* Wie das alte Feld ohne Obergrenze: Der Klemmwert wirkt im Handler (unter 3 wird 3). */}
          <NumberInput
            value={cfg.clipSeconds}
            unit="Sekunden (letzte)"
            onChange={(v) => aktionen.setConfig({ clipSeconds: Math.max(3, v) })}
          />
        </Field>
      </div>

      {state.clips.length > 0 && (
        <div className="mt-3 space-y-1">
          {state.clips.map((c) => (
            <StatusPill
              key={c.id}
              kuerzen
              state={CLIP_ZUSTAND[c.status]}
              title={c.error ?? c.outputPath}
              text={c.status === 'error' ? (c.error ?? '') : c.status === 'running' ? `${c.seconds}s …` : baseName(c.outputPath)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
