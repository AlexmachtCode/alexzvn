// Altfehler IN-8 (Stufe 2): „Ducking-Werte zurücksetzen“ (useSettings.reset) setzt nur die fünf Ducking-Werte auf die Vorgaben
// zurück. Die beiden Vorverstärkungen, Bypass und die Geräte bleiben stehen. Gegen den echten Store (zustand mit persist; ohne
// localStorage schreibt persist nichts). Der Zustand wird am Ende zurückgestellt.
import { gleich } from '@jm/ui/testhilfe';
import { DEFAULT_SETTINGS } from '@shared/ducking';
import { useSettings } from '@/store/settings';

const vorher = useSettings.getState();
try {
  useSettings.setState({ floorGainDb: 6, interpreterGainDb: -3, thresholdDb: -30, holdMs: 900, bypass: true, floorId: 'x' });
  useSettings.getState().reset();
  const s = useSettings.getState();
  gleich(
    { floorGainDb: s.floorGainDb, interpreterGainDb: s.interpreterGainDb, thresholdDb: s.thresholdDb, holdMs: s.holdMs, bypass: s.bypass, floorId: s.floorId },
    { floorGainDb: 6, interpreterGainDb: -3, thresholdDb: -42, holdMs: 350, bypass: true, floorId: 'x' },
    'IN-8 Zurücksetzen: Schwelle und Nachlauf auf die Vorgaben, die Vorverstärkungen, Bypass und Floor bleiben',
  );

  useSettings.setState({ duckDb: -6, attackMs: 200, releaseMs: 1500, floorGainDb: -12, interpreterGainDb: 9, interpreterId: 'y', outputId: 'z' });
  useSettings.getState().reset();
  const t = useSettings.getState();
  gleich(
    { duckDb: t.duckDb, attackMs: t.attackMs, releaseMs: t.releaseMs, floorGainDb: t.floorGainDb, interpreterGainDb: t.interpreterGainDb, interpreterId: t.interpreterId, outputId: t.outputId },
    { duckDb: DEFAULT_SETTINGS.duckDb, attackMs: DEFAULT_SETTINGS.attackMs, releaseMs: DEFAULT_SETTINGS.releaseMs, floorGainDb: -12, interpreterGainDb: 9, interpreterId: 'y', outputId: 'z' },
    'IN-8 Zurücksetzen: Absenkung, Attack und Release auf die Vorgaben, die Vorverstärkungen und die Geräte bleiben',
  );
} finally {
  useSettings.setState(vorher, true);
}
