import { useEffect, useState } from 'react';

// Den Timer-Zustand (`timer:state`) liest seit UX Welle 2b d2 der eine Stand des Referenten (useStand, TIMER_ZUSTAND_QUELLE).

/** Re-renders each animation frame while `active`; returns the current Date.now(). */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = (): void => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "HH:MM:SS" (signed while in overtime). */
export function formatHMS(ms: number): string {
  const negative = ms < 0;
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const body = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return negative ? `-${body}` : body;
}

/** Wall time "HH:MM" (for "Endet …"). */
export function formatWall(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
