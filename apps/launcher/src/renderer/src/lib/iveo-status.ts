// Statuszeile des iveo-Abgleichs im iveo-Panel (Master-Link Teil 2a, Spec 7.6).
// Rein (zur Laufzeit keine Importe) — läuft im Renderer und im tsx-Test.
import type { IveoAbgleichStatus } from '@shared/types';

/** Uhrzeit „HH:MM“ (Ortszeit) aus einem ISO-Zeitpunkt; null, wenn nicht lesbar. */
function uhrzeit(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** „iveo-Abgleich gestört: <Text> (seit <Uhrzeit>)“ bei ok=false, sonst null. */
export function iveoStatusZeile(s: IveoAbgleichStatus | null | undefined): string | null {
  if (!s || s.ok) return null;
  const zeit = uhrzeit(s.seit);
  return `iveo-Abgleich gestört${s.text ? `: ${s.text}` : ''}${zeit ? ` (seit ${zeit})` : ''}`;
}
