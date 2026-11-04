// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · iveo-Tokens im Speicher und „Abgleich hier“ (Plan 10.6, Verhalten 11.4 IV1, IV5;
// Spec 6.4, 2; EP13, EP14, OFP1, OFP3; Nachmessung N4, N7–N9).
// Nach jeder erfolgreichen Start-Prüfung lädt die Hülle die erlaubten Tokens vom Worker (GET /konto/iveo) hierher; sie
// liegen nur im Speicher, nie auf der Platte, nie in der Show, nie im Renderer (erlaubteEvents gibt kein Token heraus).
// Wie heute gleicht nur der Rechner ab, an dem gebunden wurde: Ohne Markierung „Abgleich hier“ (oder ein lokal
// gespeichertes Token aus der Zeit vor der Anmeldung) gibt tokenFuer kein Token heraus (EP14). Lokale Tokens verschwinden
// nach OFP1 (lokaleLoeschen). Schlüssel eines Events: `<normalisierte Basis>|<slug>`. Meldet der Worker, dass iveo bei
// ihm nicht eingerichtet ist, nennt tokenFuer das als Grund (EP31, I12). Ein Token, das dieser Lauf schon hat, bleibt bis zum
// Abmelden (leere) oder Neustart, auch wenn der Worker es nicht mehr liefert (G5, Spec 6.3, M34). Kein electron-Import (G9).
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeIveoBaseUrl } from '@jm/iveo';
import type { IveoHinweis, IveoZentral } from './worker-client';

/** OFP1: lokal gespeicherte Tokens bleiben höchstens 30 Tage ab der ersten Anmeldung auf diesem Rechner. */
export const LOKAL_FRIST_MS = 30 * 24 * 3600_000;

export type IveoGrund = 'ok' | 'kein-abgleich-hier' | 'nicht-angemeldet' | 'nicht-hinterlegt' | 'noch-nicht-geladen' | 'nicht-eingerichtet';
export interface IveoLage {
  angemeldet: boolean; geladen: boolean; abgleichHier: readonly string[]; lokal: (slug: string) => string | undefined;
  env: string | undefined; standardBasis: string;
}
export interface IveoZentralSpeicher {
  setze(events: IveoZentral[], geladenAm: number, hinweis?: IveoHinweis | null): void; leere(): void; erlaubteEvents(): Array<{ key: string; basis: string; slug: string; name: string }>;
  tokenFuer(slug: string, basis: string | undefined, lage: IveoLage): { token: string | undefined; grund: IveoGrund };
}

/** Schlüssel eines Events: normalisierte Basis-URL (wie settings.ts, @jm/iveo) und Slug. Wirft nie. */
export function iveoSchluessel(basis: string, slug: string): string {
  let b: string;
  try {
    b = normalizeIveoBaseUrl(basis);
  } catch {
    b = basis.trim().replace(/\/+$/, '');
  }
  return `${b}|${slug.trim()}`;
}

const slugVon = (key: string): string => key.slice(key.lastIndexOf('|') + 1);

/**
 * Genau dieser Schlüssel, sonst (nur mit slugRueckfall) der einzige Eintrag mit diesem Slug (mehrdeutig zählt nicht).
 * Review P14: Wo ein Token herauskommt und der Aufrufer eine Basis nennt, ist slugRueckfall aus; sonst bekäme eine fremde
 * Adresse (präparierte .jmshow) das Token eines anderen Hosts.
 */
function finde<T>(liste: readonly T[], key: string, slug: string, schluesselVon: (x: T) => string, slugRueckfall = true): T | undefined {
  const genau = liste.find((x) => schluesselVon(x) === key);
  if (genau !== undefined || !slugRueckfall) return genau;
  const gleicherSlug = liste.filter((x) => slugVon(schluesselVon(x)) === slug);
  return gleicherSlug.length === 1 ? gleicherSlug[0] : undefined;
}

export function erzeugeIveoZentral(): IveoZentralSpeicher {
  let liste: Array<{ key: string; basis: string; slug: string; name: string; token: string }> = [];
  /** EP31: der Worker hat beim letzten Laden gemeldet, dass iveo bei ihm nicht eingerichtet ist (ohne IVEO_SCHLUESSEL). */
  let serverOhneIveo = false;
  /**
   * G5, Spec 6.3 (Nachfix 1): Tokens, die dieser Lauf schon hatte und die der Worker nicht mehr liefert (Event entfernt, Stufe
   * herabgesetzt). tokenFuer findet sie bis zum Abmelden (leere) oder Neustart, eine laufende Show verliert ihr Token also nicht
   * im 5-min-Takt der Hülle; unter den erlaubten Events (Show-Editor, Löschlauf) stehen sie nicht mehr.
   */
  let frueher: typeof liste = [];
  return {
    // geladenAm gehört zum Vertrag (10.6); die Hülle merkt sich den Zeitpunkt selbst, hier wird er nicht gebraucht.
    setze(events: IveoZentral[], _geladenAm: number, hinweis?: IveoHinweis | null): void {
      serverOhneIveo = hinweis === 'iveo-nicht-eingerichtet';
      const neu: typeof liste = [];
      for (const e of events) {
        if (!e || typeof e.slug !== 'string' || !e.slug.trim() || typeof e.token !== 'string' || !e.token) continue;
        const basis = typeof e.basis === 'string' ? e.basis : '';
        const key = iveoSchluessel(basis, e.slug);
        if (neu.some((x) => x.key === key)) continue;
        neu.push({ key, basis, slug: e.slug.trim(), name: typeof e.name === 'string' ? e.name : e.slug, token: e.token });
      }
      frueher = [...liste, ...frueher].filter((alt, i, alle) => !neu.some((x) => x.key === alt.key) && alle.findIndex((y) => y.key === alt.key) === i);
      liste = neu;
    },
    leere(): void {
      liste = [];
      frueher = [];
      serverOhneIveo = false;
    },
    erlaubteEvents() {
      return liste.map((e) => ({ key: e.key, basis: e.basis, slug: e.slug, name: e.name }));
    },
    tokenFuer(slug: string, basis: string | undefined, lage: IveoLage): { token: string | undefined; grund: IveoGrund } {
      // IV1: Entwicklung zuerst (JMPS_IVEO_TOKEN gilt wie heute für jedes Event).
      if (lage.env) return { token: lage.env, grund: 'ok' };
      const s = slug.trim();
      const key = iveoSchluessel(basis ?? lage.standardBasis, s);
      const lokal = lage.lokal(s) || undefined;
      const markiert = finde(lage.abgleichHier, key, s, (k) => k) !== undefined;
      if (!markiert && !lokal) return { token: undefined, grund: 'kein-abgleich-hier' };
      const zentral = finde([...liste, ...frueher], key, s, (e) => e.key, basis === undefined);
      if (zentral) return { token: zentral.token, grund: 'ok' };
      if (lokal) return { token: lokal, grund: 'ok' };
      if (!lage.angemeldet) return { token: undefined, grund: 'nicht-angemeldet' };
      if (!lage.geladen) return { token: undefined, grund: 'noch-nicht-geladen' };
      if (serverOhneIveo) return { token: undefined, grund: 'nicht-eingerichtet' };
      return { token: undefined, grund: 'nicht-hinterlegt' };
    },
  };
}

/**
 * IV5, OFP1: welche lokal gespeicherten Tokens jetzt verschwinden. Je lokalem Slug, für den der Worker ein Token liefert,
 * erst markieren („Abgleich hier“), dann löschen; alle übrigen spätestens 30 Tage nach der ersten Anmeldung (auch sie
 * werden vorher zur Markierung); nie, solange eine iveo-Show offen ist (dann beim nächsten Schließen bzw. Start).
 * Basis-Tokens (`base:<URL>`, nur für „Events laden“) haben kein Event: sie werden nach der Frist ohne Markierung gelöscht.
 */
export function lokaleLoeschen(l: {
  lokaleSlugs: readonly string[]; zentral: readonly string[] /* keys */; ersteAnmeldung: number; jetzt: number;
  iveoShowOffen: boolean; standardBasis: string;
}): { loeschen: string[]; markieren: string[]; bleiben: string[]; spaetestens: number } {
  const spaetestens = l.ersteAnmeldung + LOKAL_FRIST_MS;
  if (l.iveoShowOffen) return { loeschen: [], markieren: [], bleiben: [...l.lokaleSlugs], spaetestens };
  const fristUm = l.jetzt >= spaetestens;
  const loeschen: string[] = [];
  const markieren: string[] = [];
  const bleiben: string[] = [];
  for (const slug of l.lokaleSlugs) {
    if (slug.startsWith('base:')) {
      (fristUm ? loeschen : bleiben).push(slug);
      continue;
    }
    const zentral = finde(l.zentral, iveoSchluessel(l.standardBasis, slug), slug.trim(), (k) => k);
    if (zentral !== undefined || fristUm) {
      const marke = zentral ?? iveoSchluessel(l.standardBasis, slug);
      if (!markieren.includes(marke)) markieren.push(marke);
      loeschen.push(slug);
    } else {
      bleiben.push(slug);
    }
  }
  return { loeschen, markieren, bleiben, spaetestens };
}

// ── Ende des Moduls ──
