import { AudioPanel } from '@/components/audio/AudioPanel';
import type { OberflaechenStand } from '@/lib/oberflaeche';

/** Reiter Audio mit dem einen Stand der Wurzel-View. */
export function AudioView({ stand }: { stand: OberflaechenStand }) {
  return (
    <div className="flex flex-col gap-6">
      <AudioPanel stand={stand} />
    </div>
  );
}
