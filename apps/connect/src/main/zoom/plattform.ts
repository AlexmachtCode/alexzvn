// Zoom gibt es nur unter Windows (Slot-Spec 7.11, E30; Plan B, Task B17, B-EP10). Die Weiche als reine Funktionen, damit
// PK27 sie ohne Electron prüft: Die Hülle (main/zoom.ts) legt den Kern nur an, wenn zoomAktiv gilt (ohne Kern gibt es keinen
// Slot-Aufruf an eine Bridge), und meldet den Zoom-Teil des STATE nur über zoomStateTeil (unter macOS keiner, 8.2).
import type { ZoomStateKv } from '../../shared/zoom-text';
import type { Kv } from '../control-state';

/** Zoom-Kern und Zoom-Bridge gibt es nur unter Windows (7.11). */
export function zoomAktiv(platform: string): boolean {
  return platform === 'win32';
}

/** Zoom-Teil des STATE (8.2): unter macOS kein Schlüssel (`{}`), sonst die Werte des Kerns; ohne Werte `{}`. */
export function zoomStateTeil(platform: string, kv: ZoomStateKv | null): Kv {
  if (!zoomAktiv(platform) || kv === null) return {};
  return { ...kv };
}
