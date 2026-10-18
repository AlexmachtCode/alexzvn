// Anhänge der Side Events (iveo-Paket Teil D, Spec 8.2–8.5): Abbildung, Löschregel, Laufzeitprüfung, Materialsignatur mit
// Referenz-Hash und Anhang-Wächter. Ohne Electron, per tsx getestet (test/iveo-anhaenge.test.ts); iveo-sync.ts verdrahtet.
//
// SICHERHEIT (E20): `asset.url` ist eine signierte Referenz. Sie steht in keiner Signatur, keinem Ereignis und keinem Log;
// die Signaturen tragen nur ihren SHA-256 (referenzHash, Messung M1 vom 17.10.2026).
import { createHash } from 'node:crypto';
import type { IveoAgendaItem, IveoMaterial } from '@jm/iveo';
import type { IveoMaterialRef } from '@shared/types';

/**
 * Agenda eines Side Events: aus der Abfrage des Kerns (meldeAgenda, 8.2) oder aus einem eigenen Abruf. `abgerufen` = Zeitpunkt
 * vor dem Abruf; ein Fehlschlag trägt ihn, wenn er bekannt ist (der Anhang-Wächter ordnet ihn damit der Anmeldung zu, EP20).
 */
export type AgendaErgebnis = { ok: true; agenda: IveoAgendaItem[]; abgerufen: string } | { ok: false; fehler: unknown; abgerufen?: string };

/** Anhang nach der Laufzeitprüfung (8.5). `groesse` = `size_bytes`, wenn es eine endliche Zahl ≥ 0 ist, sonst null. */
export interface GueltigerAnhang {
  item: IveoAgendaItem;
  m: IveoMaterial;
  groesse: number | null;
}

/** Anhang mit leerer Kennung oder unbekanntem `kind`: nicht in der Liste, im Ordner Problem T22 (i). */
export interface UngueltigerAnhang {
  item: IveoAgendaItem;
  id: string | null;
  feld: 'id' | 'kind';
}

/**
 * Gelöscht (8.5, E22, **Annahme**): jeder Wert von `purged_at` außer `null`, fehlend, `false` und Leerstring, also auch
 * eine Zahl, `true` oder ein Datum. Auf Prod war das Feld da, aber nie gesetzt; der Typ eines gesetzten Werts ist unbekannt.
 */
export function istGeloescht(m: { purged_at?: unknown }): boolean {
  const v = m.purged_at;
  return !(v === undefined || v === null || v === false || v === '');
}

/**
 * Laufzeitprüfung der Anhang-Felder (8.5) in iveo-Reihenfolge: gelöschte fallen weg; gültig ist ein Anhang mit nicht
 * leerer `id` und `kind` `file` oder `link`. Dieselbe Kennung an zwei Agenda-Punkten: Es gilt das erste Vorkommen, die
 * weiteren entfallen ohne Fehler.
 */
export function pruefeAnhaenge(agenda: IveoAgendaItem[]): { gueltig: GueltigerAnhang[]; ungueltig: UngueltigerAnhang[] } {
  const gueltig: GueltigerAnhang[] = [];
  const ungueltig: UngueltigerAnhang[] = [];
  const gesehen = new Set<string>();
  for (const item of agenda) {
    const liste: unknown = (item as { materials?: unknown } | null)?.materials;
    if (!Array.isArray(liste)) continue;
    for (const roh of liste as unknown[]) {
      if (roh === null || typeof roh !== 'object') {
        ungueltig.push({ item, id: null, feld: 'id' });
        continue;
      }
      const m = roh as IveoMaterial;
      if (istGeloescht(m)) continue;
      const id = typeof m.id === 'string' && m.id !== '' ? m.id : null;
      if (id === null) {
        ungueltig.push({ item, id: null, feld: 'id' });
        continue;
      }
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      if (m.kind !== 'file' && m.kind !== 'link') {
        ungueltig.push({ item, id, feld: 'kind' });
        continue;
      }
      const s: unknown = m.asset?.size_bytes;
      gueltig.push({ item, m, groesse: typeof s === 'number' && Number.isFinite(s) && s >= 0 ? s : null });
    }
  }
  return { gueltig, ungueltig };
}

/** SHA-256 (hex) der Asset-Referenz `asset.url`, wenn sie ein nicht leerer String ist, sonst null (8.3, M1). */
export function referenzHash(m: IveoMaterial): string | null {
  const u: unknown = m.asset?.url;
  return typeof u === 'string' && u !== '' ? createHash('sha256').update(u, 'utf8').digest('hex') : null;
}

/**
 * Anhang-Liste eines Side Events für Panel und Ereignis (8.2; die Abbildung aus `iveo-sync.ts:639-653`, die dort Task 28
 * umstellt): flach über alle Agenda-Punkte, ohne gelöschte und ungültige, Label-Rückfall „(ohne Titel)“.
 */
export function materialienAusAgenda(agenda: IveoAgendaItem[]): IveoMaterialRef[] {
  return pruefeAnhaenge(agenda).gueltig.map(({ item, m, groesse }) => ({
    id: m.id,
    label: typeof m.label === 'string' && m.label !== '' ? m.label : '(ohne Titel)',
    kind: m.kind,
    agendaTitle: item.title,
    mimeType: m.asset?.mime_type ?? null,
    sizeBytes: groesse,
    externalUrl: m.external_url ?? null,
    hasAsset: referenzHash(m) !== null,
  }));
}

/**
 * Materialsignatur eines Side Events (8.3): JSON aus der Agenda ohne gelöschte Anhänge, iveo-Reihenfolge. Je Anhang
 * `[item.id, m.id, m.kind, m.label, m.sort_order ?? null, m.asset?.mime_type ?? null, m.asset?.size_bytes ?? null,
 * m.external_url ?? null, refHash]`; die Referenz selbst steht nie darin (E20). Eine neue Reihenfolge zählt als Änderung.
 */
export function materialSignatur(agenda: IveoAgendaItem[]): string {
  return JSON.stringify(
    pruefeAnhaenge(agenda).gueltig.map(({ item, m }) => [
      item.id,
      m.id,
      m.kind,
      m.label,
      m.sort_order ?? null,
      m.asset?.mime_type ?? null,
      m.asset?.size_bytes ?? null,
      m.external_url ?? null,
      referenzHash(m),
    ]),
  );
}

// ── Ende des Moduls ──
