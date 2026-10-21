// Kreuzprodukt-Hilfen der Selbsttests von @jm/ui (geführte Anleitungen P1). Kopie von kreuz, fallText, pruefeFaelle und
// vergleiche aus packages/settings/test/hilfe.ts: eine ok-Zeile je Tabelle, bei Abweichung bis zu fünf Fälle mit ist/soll.
import { ok } from '../harness';

type Achsen = Record<string, readonly unknown[]>;
export type Fall<A extends Achsen> = { [K in keyof A]: A[K][number] };

/** Alle Kombinationen der Achsen (vollständiges Kreuzprodukt), in fester Reihenfolge. */
export function kreuz<A extends Achsen>(achsen: A): Array<Fall<A>> {
  let faelle: Array<Record<string, unknown>> = [{}];
  for (const [name, werte] of Object.entries(achsen)) {
    faelle = faelle.flatMap((f) => werte.map((w) => ({ ...f, [name]: w })));
  }
  return faelle as Array<Fall<A>>;
}

/** Ein Fall als lesbare Zeile, `undefined` bleibt sichtbar (JSON ließe es weg). */
export function fallText(f: Record<string, unknown>): string {
  return Object.entries(f)
    .map(([k, v]) => `${k}=${v === undefined ? 'undefined' : JSON.stringify(v)}`)
    .join(' ');
}

/** Prüft jeden Fall; eine ok-Zeile je Tabelle, bei Abweichung die ersten fünf Fälle mit ist/soll. */
export function pruefeFaelle<F extends Record<string, unknown>>(msg: string, faelle: readonly F[], pruefe: (f: F) => string | null): void {
  const abweichungen: string[] = [];
  for (const f of faelle) {
    const r = pruefe(f);
    if (r !== null) abweichungen.push(`${fallText(f)} → ${r}`);
  }
  ok(abweichungen.length === 0, `${msg} (${faelle.length} Fälle)`);
  for (const z of abweichungen.slice(0, 5)) console.log(`     ${z}`);
  if (abweichungen.length > 5) console.log(`     … und ${abweichungen.length - 5} weitere`);
}

/** Vergleich ist/soll für pruefeFaelle: null bei Gleichheit, sonst „ist: … soll: …“. */
export function vergleiche(ist: string | undefined, soll: string | undefined): string | null {
  return ist === soll ? null : `ist: ${ist ?? 'undefined'} soll: ${soll ?? 'undefined'}`;
}
