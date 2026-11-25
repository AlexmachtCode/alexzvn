import { LichtPanel } from '@/components/lighting/LichtPanel';
import type { OberflaechenStand } from '@/lib/oberflaeche';

/** Reiter Licht mit dem einen Stand der Wurzel-View. */
export function LichtView({ stand }: { stand: OberflaechenStand }) {
  return (
    <div className="flex flex-col gap-6">
      <LichtPanel stand={stand} />
    </div>
  );
}
