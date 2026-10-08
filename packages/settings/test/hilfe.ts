// Testhilfen nur für @jm/settings: Kreuzprodukt, Statusvergleich, Bedienelemente im HTML.
import { ok } from '@jm/ui/testhilfe';
import type { SectionStatus } from '../src/index';

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

/** Status als „state text“, damit ein Vergleich ein einziger String-Vergleich ist. */
export function statusText(s: SectionStatus): string {
  return `${s.state} ${s.text}`;
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

/** Öffnende Tags aller Bedienelemente (button, input, select, textarea) im HTML. */
export function bedienelemente(html: string): string[] {
  return [...html.matchAll(/<(button|input|select|textarea)\b[^>]*>/g)].map((m) => m[0]);
}

/** Wie viele Bedienelemente es gibt und wie viele davon das Attribut disabled tragen. */
export function sperrZaehlung(html: string): { alle: number; gesperrt: number } {
  const liste = bedienelemente(html);
  return { alle: liste.length, gesperrt: liste.filter((t) => /\sdisabled=""/.test(t)).length };
}

/** Steht `a` im HTML vor `b` (beide vorhanden)? */
export function vor(html: string, a: string, b: string): boolean {
  const i = html.indexOf(a);
  const j = html.indexOf(b);
  return i > -1 && j > -1 && i < j;
}

/** Steht `a` im HTML nach dem letzten `b` (beide vorhanden)? */
export function nachLetztem(html: string, a: string, b: string): boolean {
  const i = html.indexOf(a);
  const j = html.lastIndexOf(b);
  return i > -1 && j > -1 && i > j;
}

/**
 * Übergänge, die `prefers-reduced-motion` nicht abschaltet (Plan G8, Spec 4.3): je Element die `transition…`-Klassen
 * ohne `motion-safe:`, wenn das Element nicht zugleich `motion-reduce:transition-none` trägt (Bestands-`Button`).
 */
export function bewegungsVerstoesse(html: string): string[] {
  const aus: string[] = [];
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    const klassen = m[1].split(/\s+/);
    const offen = klassen.filter((k) => /^transition(-|$)/.test(k));
    if (offen.length > 0 && !klassen.includes('motion-reduce:transition-none')) aus.push(offen.join(' '));
  }
  return aus;
}
