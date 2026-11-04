// ─────────────────────────────────────────────────────────────────────────────
// Zugang von JM Q&A zum Q&A-Relay des Workers (Anmeldung im Launcher, Teil 1; Plan P29, Vertrag 10.9, Verhalten 11.3;
// Spec 3, 6.2, 6.3, 10).
//
// Q&A holt beim laufenden Launcher desselben Windows-Kontos eine Freigabe für sein Event (Zweck `qa-relay`, Ziel =
// Event-ID, 72 h; @jm/app-runtime/freigabe) und hält sie in qa.cloud.secret. Der Live-Pfad Q&A → Worker läuft ohne
// Launcher: die Freigabe geht als `Authorization: Bearer` direkt an /qa/:id. Reihenfolge des Zugangs (QR1): gültige
// Freigabe für dieses Event, sonst der alte Proxy-Key (nur im Übergang, gilt am Worker bis ALTKEY_BIS), sonst keiner.
// Die Zeile „Zugang“ sagt in jedem Zustand, was gilt oder worauf Q&A wartet (G7); leer heißt: keine Zeile.
//
// Rein (G9): kein Electron, nur ein Typ aus @jm/app-runtime/freigabe; läuft unter node --experimental-strip-types.
// ─────────────────────────────────────────────────────────────────────────────
import type { FreigabeGrund } from '@jm/app-runtime/freigabe';

/** Adresse des Workers der Suite; gilt, wenn das Feld „Server-Adresse“ leer ist (Spec 3, EP22). */
export const QA_VORGABE_URL = 'https://jm-suite-proxy.jm-production-suite.workers.dev';
/** Erneuern, sobald weniger als 24 h bleiben (EP3: eine Freigabe gilt 72 h). */
export const ERNEUERN_VOR_MS = 24 * 3600_000;
/** Höchstens ein Versuch beim Launcher je 30 s (QR2, QR4). */
export const FREIGABE_ABSTAND_MS = 30_000;

/** Die Freigabe, wie Q&A sie in qa.cloud.secret hält (nie im Log, nie im Renderer). */
export interface QaFreigabe { token: string; bis: number; ziel: string; konto: { name: string; stufe: string } }
export type QaZugang = { art: 'freigabe'; f: QaFreigabe } | { art: 'alter-key'; key: string } | { art: 'keiner' };
export interface QaZugangsLage {
  zugang: QaZugang;
  letzterGrund: FreigabeGrund | null;
  jetzt: number;
  eventDa: boolean;
  extern: boolean;
  altKeyAbgelehnt: boolean;
  /** Abweichung E1: `detail` der letzten Ablehnung durch den Launcher (nur ein Code), für Q3i. */
  detail?: string | null;
  /** Abweichung E1: Die gespeicherte Freigabe für dieses Event ist abgelaufen (Q5). */
  freigabeAbgelaufen?: boolean;
}

/** Texte der Texttabelle 9.10 (Q2–Q12), wörtlich. */
export const QA_TEXT = {
  /** Q2 */
  freigabe: (name: string, stufe: string, datum: string, zeit: string): string =>
    `Freigabe vom Launcher (${name} · ${stufe}), gültig bis ${datum} ${zeit}.`,
  /** Q3i */
  fehlgeschlagen: (detail: string): string => `Freigabe fehlgeschlagen: ${detail}`,
  /** Q4 */
  baldAb: (zeit: string): string => `Die Freigabe gilt noch bis ${zeit}. Für eine neue Freigabe muss der Launcher laufen.`,
  /** Q5 */
  abgelaufen: 'Die Freigabe ist abgelaufen. Starte den Launcher, damit Q&A eine neue bekommt.',
  /** Q6b */
  keyGeloescht: 'Der alte Proxy-Key wurde gelöscht; Q&A nutzt jetzt die Freigabe des Launchers.',
  /** Q6c */
  altKey: 'Zugang über den alten Proxy-Key (Übergang).',
  /** Q6d */
  keyAbgelehnt: 'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an.',
  /** Q8 */
  keinEvent: 'Noch kein Event. Erzeuge zuerst ein Event.',
  /** Q9 */
  keinSchluessel: 'Kein Event-Schlüssel. Erzeuge zuerst ein Event mit „Neues Event“.',
  /** Q10 */
  quittierenFehler: (status: number): string => `Quittieren fehlgeschlagen (HTTP ${status})`,
  /** Q10 */
  loeschenFehler: (status: number): string => `Löschen im Relay fehlgeschlagen (HTTP ${status})`,
  /** Q11 */
  freigabeAbgelehnt: 'Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher.',
  /** Q12; der Punkt am Ende ist der Punkt des Grundes aus Q3 (kein doppelter Punkt). */
  wartet: (grund: string): string => `Extern ist an und wartet auf eine Freigabe: ${grund}`,
  /** Bestandstext (CloudPanel.tsx:97): Extern an, der erste Versuch beim Launcher läuft noch. */
  verbinde: 'Verbinde …',
} as const;

/** Q3a–Q3h je Grund aus @jm/app-runtime/freigabe (Q3c für zwei Gründe); `fehler` → Q3i mit Detail. */
export const GRUND_TEXT: Readonly<Record<Exclude<FreigabeGrund, 'fehler'>, string>> = {
  'kein-launcher': 'Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.',
  'launcher-unecht': 'Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.',
  'launcher-zu-alt': 'Der Launcher ist zu alt für diese Freigabe. Aktualisiere den Launcher.',
  'unbekannter-zweck': 'Der Launcher ist zu alt für diese Freigabe. Aktualisiere den Launcher.',
  'niemand-angemeldet': 'Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).',
  abgelaufen: 'Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.',
  entzogen: 'Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.',
  'kein-recht': 'Dein Konto darf Q&A extern nicht nutzen. Frag einen Admin.',
  'server-nicht-erreichbar': 'Der Server ist gerade nicht erreichbar. Ich versuche es weiter.',
};

/** Stufen-Namen (K5). */
const STUFE_TEXT: Readonly<Record<string, string>> = { admin: 'Admin', kollege: 'Kollege', externer: 'Externer' };

/** Vorübergehende Gründe (Ton „warn“); alle übrigen brauchen einen Menschen (Ton „fehler“). */
const GRUND_VORUEBERGEHEND: readonly FreigabeGrund[] = ['kein-launcher', 'niemand-angemeldet', 'abgelaufen', 'server-nicht-erreichbar'];

/** Wirksame Server-Adresse: das Feld, wenn es etwas enthält, sonst die Vorgabe. */
export function effektiveProxyUrl(eingetragen: string): string {
  const e = eingetragen.trim();
  return e || QA_VORGABE_URL;
}

/** QR1: gültige Freigabe für genau dieses Event vor altem Key vor keinem. */
export function waehleZugang(s: { freigabe: QaFreigabe | null; proxyKey: string; eventId: string; jetzt: number }): QaZugang {
  const f = s.freigabe;
  if (f && s.eventId && f.ziel === s.eventId && f.token && f.bis > s.jetzt) return { art: 'freigabe', f };
  const key = s.proxyKey.trim();
  if (key) return { art: 'alter-key', key };
  return { art: 'keiner' };
}

/** Kopfzeilen an /qa/:id: Freigabe als Bearer, alter Key als X-Proxy-Key, sonst keine. */
export function zugangsKopf(z: QaZugang): Record<string, string> {
  if (z.art === 'freigabe') return { Authorization: `Bearer ${z.f.token}` };
  if (z.art === 'alter-key') return { 'X-Proxy-Key': z.key };
  return {};
}

/** QR2: fällig ohne Freigabe, bei anderem Ziel oder mit weniger als 24 h Rest; ohne Event nie (kein Ziel). */
export function erneuernFaellig(f: QaFreigabe | null, eventId: string, jetzt: number): boolean {
  if (!eventId) return false;
  if (!f || f.ziel !== eventId) return true;
  return f.bis - jetzt < ERNEUERN_VOR_MS;
}

/** QR2, QR4: höchstens ein Versuch beim Launcher je FREIGABE_ABSTAND_MS. */
export function versuchErlaubt(letzterVersuch: number | null, jetzt: number): boolean {
  return letzterVersuch === null || jetzt - letzterVersuch >= FREIGABE_ABSTAND_MS;
}

/** QR5: Antwort 401/403 des Relays → Freigabe verwerfen (Q11) bzw. alten Key nicht wiederholen (Q6d); sonst nichts. */
export function nachAblehnung(art: QaZugang['art'], status: number): 'freigabe-verwerfen' | 'key-abgelehnt' | null {
  if (status !== 401 && status !== 403) return null;
  if (art === 'freigabe') return 'freigabe-verwerfen';
  if (art === 'alter-key') return 'key-abgelehnt';
  return null;
}

/** Normalisierer für qa.cloud.secret (G8): nur eine vollständige Freigabe, sonst null; keine fremden Felder. */
export function leseFreigabe(roh: unknown): QaFreigabe | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const r = roh as Record<string, unknown>;
  const k = r.konto as Record<string, unknown> | null | undefined;
  if (typeof r.token !== 'string' || !r.token || typeof r.bis !== 'number' || !Number.isFinite(r.bis)) return null;
  if (typeof r.ziel !== 'string' || !r.ziel || typeof k !== 'object' || k === null || typeof k.name !== 'string') return null;
  if (k.stufe !== 'admin' && k.stufe !== 'kollege' && k.stufe !== 'externer') return null;
  return { token: r.token, bis: r.bis, ziel: r.ziel, konto: { name: k.name, stufe: k.stufe } };
}

function zwei(n: number): string {
  return String(n).padStart(2, '0');
}
/** TT.MM.JJJJ in Ortszeit (G2). */
function datumText(ms: number): string {
  const d = new Date(ms);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
}
/** HH:MM in Ortszeit (G2). */
function zeitText(ms: number): string {
  const d = new Date(ms);
  return `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

/** Text zu einem Grund: Q3a–Q3h, für `fehler` Q3i mit dem Detail (ohne Detail der Code selbst). */
export function grundText(g: FreigabeGrund, detail?: string | null): string {
  return g === 'fehler' ? QA_TEXT.fehlgeschlagen(detail || 'fehler') : GRUND_TEXT[g];
}

/**
 * Zeile „Zugang“ (Texte Q2–Q6, Q12) als Kreuzprodukt aus Zugang × letztem Grund × Event × Extern × alter Key abgelehnt.
 * - gültige Freigabe: Q2 (Ton ok); mit weniger als 24 h Rest und gescheitertem Erneuern Q4 (kein Launcher) bzw. Q2 und
 *   der Grund (Ton warn);
 * - alter Key: Q6c (warn), vom Server abgelehnt Q6d (fehler);
 * - kein Zugang ohne Event: keine Zeile (das CloudPanel zeigt Q7), außer Q6d;
 * - kein Zugang mit Event: mit Grund Q12 und der Grund (Extern an) bzw. der Grund allein (Extern aus), abgelaufene
 *   Freigabe ohne Launcher Q5; ohne Grund Q6d, Q5, „Verbinde …“ (Extern an, erster Versuch läuft) oder keine Zeile.
 */
export function zugangsZeile(l: QaZugangsLage): { text: string; ton: 'ok' | 'warn' | 'fehler' } {
  const z = l.zugang;
  if (z.art === 'freigabe') {
    const f = z.f;
    const voll = QA_TEXT.freigabe(f.konto.name, STUFE_TEXT[f.konto.stufe] ?? f.konto.stufe, datumText(f.bis), zeitText(f.bis));
    if (f.bis - l.jetzt >= ERNEUERN_VOR_MS || l.letzterGrund === null) return { text: voll, ton: 'ok' };
    if (l.letzterGrund === 'kein-launcher') return { text: QA_TEXT.baldAb(zeitText(f.bis)), ton: 'warn' };
    return { text: `${voll} ${grundText(l.letzterGrund, l.detail)}`, ton: 'warn' };
  }
  if (z.art === 'alter-key') {
    return l.altKeyAbgelehnt ? { text: QA_TEXT.keyAbgelehnt, ton: 'fehler' } : { text: QA_TEXT.altKey, ton: 'warn' };
  }
  if (!l.eventDa) return l.altKeyAbgelehnt ? { text: QA_TEXT.keyAbgelehnt, ton: 'fehler' } : { text: '', ton: 'warn' };
  if (l.letzterGrund !== null) {
    if (l.freigabeAbgelaufen && l.letzterGrund === 'kein-launcher') return { text: QA_TEXT.abgelaufen, ton: 'warn' };
    const g = grundText(l.letzterGrund, l.detail);
    const ton = GRUND_VORUEBERGEHEND.includes(l.letzterGrund) ? 'warn' : 'fehler';
    return { text: l.extern ? QA_TEXT.wartet(g) : g, ton };
  }
  if (l.altKeyAbgelehnt) return { text: QA_TEXT.keyAbgelehnt, ton: 'fehler' };
  if (l.freigabeAbgelaufen) return { text: QA_TEXT.abgelaufen, ton: 'warn' };
  if (l.extern) return { text: QA_TEXT.verbinde, ton: 'warn' };
  return { text: '', ton: 'warn' };
}

// ── Ende des Moduls ──
