import { useAutoAdvance } from '@/sync/useAutoAdvance';
import { TimerOberflaeche } from './TimerOberflaeche';

export function OperatorView({ verbindungBekannt }: { verbindungBekannt?: boolean }) {
  // Auto-advance runs only here — Speaker/Remote windows never dispatch
  // commands, so we avoid duplicate `tt:next` fires. Der Hook liegt oberhalb der Modus-Ansicht und überlebt jeden Moduswechsel.
  useAutoAdvance();

  return <TimerOberflaeche verbindungBekannt={verbindungBekannt} />;
}
