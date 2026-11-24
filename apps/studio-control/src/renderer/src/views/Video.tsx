import { TricasterPanel } from '@/components/video/TricasterPanel';
import { AtemPanel } from '@/components/video/AtemPanel';
import { ObsPanel } from '@/components/video/ObsPanel';
import { PtzPanel } from '@/components/video/PtzPanel';
import type { OberflaechenStand } from '@/lib/oberflaeche';

/** Reiter Video: die vier Gerätepanels mit dem einen Stand der Wurzel-View (Sperrgründe, Pillen, Haupttasten). */
export function VideoView({ stand }: { stand: OberflaechenStand }) {
  return (
    <div className="flex flex-col gap-6">
      <TricasterPanel stand={stand} />
      <AtemPanel stand={stand} />
      <ObsPanel stand={stand} />
      <PtzPanel stand={stand} />
    </div>
  );
}
