// #317 Gast-Klicker übers Internet: gemeinsame Typen und reine Helfer (Main + Renderer, ohne Node-Module).
// Cloud-Dienst: services/gast-klicker (Worker `jm-gast-klicker`).

export const GAST_KLICKER_BASIS = 'https://jm-gast-klicker.jm-production-suite.workers.dev';

/** Gespeicherte Einstellung (userData/gast-klicker.json). `pausiert` wird bewusst nicht gespeichert. */
export interface GastKlickerConfig {
  an: boolean;
  raum: string | null;
  geheimnis: string | null;
}

export type GastKlickerLage = 'aus' | 'verbindet' | 'verbunden' | 'getrennt' | 'abgelehnt';

export interface GastKlickerStatus {
  an: boolean;
  lage: GastKlickerLage;
  /** Link für die Gäste (`…/k/<raum>`), solange eingeschaltet. */
  link: string | null;
  gaeste: number;
  pausiert: boolean;
}

const RAUM_RE = /^[a-z0-9]{12}$/;
const GEHEIMNIS_RE = /^[a-f0-9]{64}$/;

export function coerceGastKlickerConfig(raw: unknown): GastKlickerConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof GastKlickerConfig, unknown>>;
  return {
    an: o.an === true,
    raum: typeof o.raum === 'string' && RAUM_RE.test(o.raum) ? o.raum : null,
    geheimnis: typeof o.geheimnis === 'string' && GEHEIMNIS_RE.test(o.geheimnis) ? o.geheimnis : null,
  };
}

/** Basis-URL aus `JMPR_GAST_KLICKER_URL` (nur http/https ohne Pfad, für Tests), sonst der echte Dienst. */
export function basisAusUmgebung(wert: string | undefined): string {
  if (!wert) return GAST_KLICKER_BASIS;
  try {
    const u = new URL(wert);
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.pathname === '/' && !u.search && !u.hash) {
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    /* ungültig → Vorgabe */
  }
  return GAST_KLICKER_BASIS;
}

export function gastLink(basis: string, raum: string): string {
  return `${basis}/k/${raum}`;
}

export function presenterWsUrl(basis: string, raum: string): string {
  return `${basis.replace(/^http/, 'ws')}/h/${raum}/ws`;
}

export function chatText(link: string): string {
  return `Advance your slides yourself / Folien selbst weiterschalten: ${link}`;
}

/** Was ein Gast-Kommando bewirken darf: nur vor/zurück, nur bei laufender Präsentation, nicht pausiert. */
export function fuehreAus(lage: { aktiv: boolean; pausiert: boolean }, dir: unknown): 'next' | 'prev' | null {
  if (!lage.aktiv || lage.pausiert) return null;
  return dir === 'next' || dir === 'prev' ? dir : null;
}

/** Text der kleinen Anzeige in der Referentenansicht; `null` = nicht anzeigen (Gast-Klicker aus). */
export function pillenText(s: GastKlickerStatus): string | null {
  if (!s.an) return null;
  if (s.lage !== 'verbunden') return 'Gast-Klick getrennt';
  return s.pausiert ? 'Gast-Klick pausiert' : 'Gast-Klick ●';
}

/** Statuszeile im Fernsteuerungs-Abschnitt. */
export function statusText(s: GastKlickerStatus): string {
  switch (s.lage) {
    case 'verbunden':
      return `verbunden · ${s.gaeste} ${s.gaeste === 1 ? 'Gast' : 'Gäste'}`;
    case 'verbindet':
      return 'verbindet …';
    case 'getrennt':
      return 'getrennt – verbindet neu';
    case 'abgelehnt':
      return 'abgelehnt – Gast-Klicker aus- und wieder einschalten';
    default:
      return 'aus';
  }
}

/** Wartezeit vor dem nächsten Verbindungsversuch: 1 s verdoppelnd, ±20 % gestreut, höchstens 30 s. */
export function wartezeitMs(versuch: number, zufall: number): number {
  const basis = Math.min(30_000, 1000 * 2 ** Math.max(0, versuch));
  return Math.min(30_000, Math.round(basis * (0.8 + 0.4 * zufall)));
}
