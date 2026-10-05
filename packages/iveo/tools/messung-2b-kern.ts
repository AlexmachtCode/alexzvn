// ─────────────────────────────────────────────────────────────────────────────
// Messung M1/M3 (Master-Link Teil 2b, Spec 23): reine Auswertung der iveo-Speaker-Kennungen.
// Ohne Netz und ohne Token. Das Lese-Werkzeug messung-2b.ts nutzt sie, der iveo-Selbsttest prüft sie.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

/** Form einer Kennung: UUID, nur Ziffern oder etwas anderes. */
export type KennungsForm = 'uuid' | 'ziffern' | 'andere';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUR_ZIFFERN = /^\d+$/;

export function kennungsForm(id: string): KennungsForm {
  if (UUID.test(id)) return 'uuid';
  if (NUR_ZIFFERN.test(id)) return 'ziffern';
  return 'andere';
}

export interface KennungsBericht {
  anzahl: number;
  formen: Record<KennungsForm, number>;
  /** Kennungen mit Leerraum (`/\s/`). Der Normalisierer in @jm/show würde sie kürzen. */
  mitLeerraum: number;
  /** Anzahl minus Anzahl verschiedener Kennungen. */
  doppelte: number;
  /** Erste 16 Hex-Zeichen von SHA-256 über die sortierten, mit `\n` verbundenen Kennungen: gleiche Menge? */
  mengenHash: string;
  /** Dasselbe in API-Reihenfolge: gleiche Reihenfolge? */
  reihenfolgeHash: string;
}

function hash16(kennungen: string[]): string {
  return createHash('sha256').update(kennungen.join('\n'), 'utf8').digest('hex').slice(0, 16);
}

export function kennungsBericht(ids: string[]): KennungsBericht {
  const formen: Record<KennungsForm, number> = { uuid: 0, ziffern: 0, andere: 0 };
  for (const id of ids) formen[kennungsForm(id)]++;
  return {
    anzahl: ids.length,
    formen,
    mitLeerraum: ids.filter((id) => /\s/.test(id)).length,
    doppelte: ids.length - new Set(ids).size,
    mengenHash: hash16([...ids].sort()),
    reihenfolgeHash: hash16(ids),
  };
}

/**
 * Mengen-Abgleich zweier Kennungslisten: wie viele Kennungen nur in der ersten bzw. nur in der zweiten stehen.
 * Für M1 (a) zeigt das den Unterschied zwischen „Speaker angelegt oder gelöscht“ und „Kennung gewechselt“.
 */
export function vergleicheMengen(erste: string[], zweite: string[]): { nurErste: number; nurZweite: number; gleich: boolean } {
  const inErster = new Set(erste);
  const inZweiter = new Set(zweite);
  const nurErste = [...inErster].filter((id) => !inZweiter.has(id)).length;
  const nurZweite = [...inZweiter].filter((id) => !inErster.has(id)).length;
  return { nurErste, nurZweite, gleich: nurErste === 0 && nurZweite === 0 };
}

/** Mengen-Abgleich API ↔ Launcher-Cache (`speakers[].id`): wie viele Kennungen nur auf einer Seite stehen. */
export function vergleicheMitCache(api: string[], cache: string[]): { nurApi: number; nurCache: number; gleich: boolean } {
  const v = vergleicheMengen(api, cache);
  return { nurApi: v.nurErste, nurCache: v.nurZweite, gleich: v.gleich };
}

/** Eine mit `ids <datei>` abgelegte Kennungsliste lesen: JSON-Liste aus Texten. Alles andere → null. */
export function leseKennungsListe(text: string): string[] | null {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  return Array.isArray(roh) && roh.every((x) => typeof x === 'string') ? roh : null;
}
