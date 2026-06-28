// Kleine Dauer-Helfer für die Block-Dauer (Issue #85, Timer-Austausch).
// Eingabe im Editor als mm:ss / h:mm:ss / reine Sekunden; Anzeige als mm:ss bzw.
// h:mm:ss. Export-/Timer-Format (HH:MM:SS) liefert formatHms.

/** "h:mm:ss" / "mm:ss" / reine Sekunden → ms. Leer/ungültig → undefined. */
export function parseClock(input: string): number | undefined {
  const s = input.trim();
  if (!s) return undefined;
  const hms = s.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) return ((Number(hms[1]) * 60 + Number(hms[2])) * 60 + Number(hms[3])) * 1000;
  const ms = s.match(/^(\d+):(\d{1,2})$/);
  if (ms) return (Number(ms[1]) * 60 + Number(ms[2])) * 1000;
  const num = Number(s.replace(',', '.'));
  if (Number.isFinite(num) && num >= 0) return Math.round(num * 1000); // reine Zahl = Sekunden
  return undefined;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** ms → "m:ss" (unter 1 h) bzw. "h:mm:ss". 0/undefined → "". */
export function formatClock(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** ms → "HH:MM:SS" (Export-/Timer-Spaltenformat). 0/undefined → "". */
export function formatHms(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
