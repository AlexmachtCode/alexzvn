import type { KontoAnsicht, KontoZustand, Stufe } from '@shared/konto';
import { kurzName, STUFE_TEXT } from '../../../shared/konto';

// Anmeldung im Launcher (Plan P24; Spec 4.2, 7, 11; OFP5; G7): was Kopf, Zahnrad und Werkzeugkasten über das Konto zeigen —
// als REINE Funktionen, getestet als Kreuzprodukt (test/konto-anzeige.test.ts, npm run selftest:konto).
// Importe: aus Aliasen nur Typen (G9); zur Laufzeit nur src/shared/konto.ts, das selbst nichts importiert (P7).

/** Texte K1–K18 (Texttabelle 9.1, wörtlich). ‹…› sind Einsetzungen. */
export const KOPF_TEXTE = {
  /** K1 */ anmelden: 'Anmelden',
  /** K2 */ angemeldet: (kurz: string, stufe: string): string => `${kurz} · ${stufe}`,
  /** K3 */ offline: (kurz: string): string => `${kurz} · offline`,
  /** K4 */ entzogenLaeuft: (kurz: string): string => `${kurz} · Zugang entzogen`,
  /** K6 */ abgelaufen: 'Anmeldung abgelaufen',
  /** K7 */ entzogen: 'Zugang entzogen',
  /** K8 */ keinSchluesselspeicher: 'Anmelden nicht möglich',
  /** K10 */ titelAngemeldet: (name: string, email: string, stufe: string): string => `Angemeldet als ${name} (${email}) · ${stufe}`,
  /** K11 */ titelPruefe: (name: string, stufe: string): string =>
    `Angemeldet als ${name} · ${stufe}. Die Anmeldung wird gerade mit dem Server abgeglichen.`,
  /** K12 */ titelOffline: (datum: string): string => `Offline. Anmeldung gültig bis ${datum}.`,
  /** K13 */ titelServer: (datum: string): string => `Server nicht erreichbar. Anmeldung gültig bis ${datum}.`,
  /** K13a (EP31) */ titelNichtEingerichtet: (datum: string): string => `Anmeldung auf dem Server nicht eingerichtet. Anmeldung gültig bis ${datum}.`,
  /** K13b (EP30) */ titelUhr: (datum: string): string => `Die Uhr dieses Rechners geht falsch. Anmeldung gültig bis ${datum}.`,
  /** K14 */ titelAbgelaufen: 'Anmeldung abgelaufen. Klicke, um dich neu anzumelden.',
  /** K15 */ titelEntzogen: 'Zugang beim letzten Start entzogen. Klicke für Einzelheiten.',
  /** K16 */ titelEntzogenLaeuft: 'Zugang entzogen. Diese Sitzung läuft bis zum Neustart des Launchers weiter.',
  /** K17 */ titelKeinSchluesselspeicher: 'Auf diesem Rechner ist keine Anmeldung möglich (kein Schlüsselspeicher).',
  /** K18 */ titelNichtAngemeldet: 'Anmelden: Installieren, Updates, iveo und Q&A extern gibt es erst nach der Anmeldung.',
  /** K3/K4 als Wort ohne Namen */ wortOffline: 'offline',
  wortEntzogen: 'Zugang entzogen',
} as const;

/** M3: Name des Zahnrads für Screenreader, mit offenen Zoom-Anfragen. */
export function zahnradName(n: number): string {
  return n > 0 ? `Einstellungen, ${n} offene Zoom-Anfragen` : 'Einstellungen';
}

/** F5 (9.7): Zeile über dem Katalog ohne gültige Anmeldung. */
export const TEXT_WERKZEUGKASTEN_OHNE_ANMELDUNG = 'Nicht angemeldet: Installieren und Updates gehen erst nach der Anmeldung (oben rechts).';

/** OFP5 (Vorgabe): ab dieser Fensterbreite Kreis plus „Name · Stufe“, darunter nur der Kreis. */
export const KOPF_BREIT_AB_PX = 1180;

/** R6: Zustände mit nutzbarer Sitzung (mit Stand). Eine Voreinstellung (null) zählt nie (G7). */
const MIT_SITZUNG: readonly KontoZustand[] = ['pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'entzogen-laeuft'];

/** Gültige Sitzung (für Kopf, Hinweise, Kapitel 1): Zustand mit Sitzung UND Stand. */
export function sitzungGueltig(a: KontoAnsicht | null): boolean {
  return a !== null && a.stand !== null && MIT_SITZUNG.includes(a.zustand);
}

/** Datum TT.MM.JJJJ in Ortszeit des Rechners (G2). */
export function datumText(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Initialen aus dem Namen (erstes und letztes Wort), sonst der erste Buchstabe der E-Mail. */
export function initialen(name: string, email: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return (email.trim()[0] ?? '?').toUpperCase();
  if (w.length === 1) return w[0][0].toUpperCase();
  return `${w[0][0]}${w[w.length - 1][0]}`.toUpperCase();
}

/** Farbe des Kreises: die Stufe nur, wenn das Wort der Stufe daneben oder im Titel steht (Farbe nie ohne Wort, Spec 4.2). */
export type KopfFarbe = Stufe | 'neutral' | 'gedaempft' | 'warnung';

/** Klassen je Farbe: Stufenfarben aus den Tokens (--primary Admin, --success Kollege, --accent Externer), Kontrast gemessen. */
export const KOPF_FARBE_KLASSE: Readonly<Record<KopfFarbe, string>> = {
  admin: 'bg-[var(--primary)] text-[var(--primary-foreground)]',
  kollege: 'bg-[var(--success)] text-black',
  externer: 'bg-[var(--accent)] text-black',
  neutral: 'border border-[var(--border)] text-[var(--foreground)]',
  gedaempft: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  warnung: 'border border-[var(--destructive)]/50 text-[var(--destructive)]',
};

export interface KontoKopf {
  /** Sichtbarer Text neben dem Kreis; '' = nur der Kreis (schmal) bzw. nichts. */
  text: string;
  /** Initialen im Kreis; null = kein Kreis (ohne Stand). */
  initialen: string | null;
  stufe: Stufe | null;
  farbe: KopfFarbe;
  /** Tooltip und Name für Screenreader (K10–K18). */
  titel: string;
  /** Zustandswort neben dem Namen („offline“, „Zugang entzogen“), sonst null. */
  zustandWort: string | null;
  /** Klick: Anmelde-Dialog, Konto-Dialog oder (vor der ersten Ansicht) nichts — dann zeigt der Kopf nichts. */
  aktion: 'anmelden' | 'konto' | null;
}

const NICHTS: KontoKopf = { text: '', initialen: null, stufe: null, farbe: 'neutral', titel: '', zustandWort: null, aktion: null };

/**
 * Kopf „angemeldet als …“ (Spec 4.2, G7): stimmt in jedem Zustand. Vor der ersten Ansicht oder ohne Stand in „pruefe“ zeigt er
 * nichts (eine Voreinstellung zählt nie als angemeldet). Die Stufenfarbe gibt es nur mit dem Wort der Stufe (Text oder Titel);
 * offline und entzogen sind gedämpft bzw. Warnung mit Zustandswort. `breit` (OFP5): Text neben dem Kreis, sonst nur der Kreis.
 */
export function kontoKopf(a: KontoAnsicht | null, breit: boolean): KontoKopf {
  if (a === null) return NICHTS;
  switch (a.zustand) {
    case 'nicht-angemeldet':
      return { ...NICHTS, text: KOPF_TEXTE.anmelden, titel: KOPF_TEXTE.titelNichtAngemeldet, aktion: 'anmelden' };
    case 'kein-schluesselspeicher':
      return { ...NICHTS, text: KOPF_TEXTE.keinSchluesselspeicher, farbe: 'warnung', titel: KOPF_TEXTE.titelKeinSchluesselspeicher, aktion: 'konto' };
    case 'abgelaufen':
      return { ...NICHTS, text: KOPF_TEXTE.abgelaufen, farbe: 'warnung', titel: KOPF_TEXTE.titelAbgelaufen, aktion: 'anmelden' };
    case 'entzogen':
      return { ...NICHTS, text: KOPF_TEXTE.entzogen, farbe: 'warnung', titel: KOPF_TEXTE.titelEntzogen, aktion: 'konto' };
    default:
      break;
  }
  const s = a.stand;
  if (s === null) return NICHTS;
  const kurz = kurzName(s.name, s.email);
  const wort = STUFE_TEXT[s.stufe];
  const kreis = { initialen: initialen(s.name, s.email), stufe: s.stufe, aktion: 'konto' as const };
  const datum = datumText(a.gueltigBis ?? s.exp);
  switch (a.zustand) {
    case 'angemeldet':
      return { ...kreis, text: breit ? KOPF_TEXTE.angemeldet(kurz, wort) : '', farbe: s.stufe, titel: KOPF_TEXTE.titelAngemeldet(s.name, s.email, wort), zustandWort: null };
    case 'pruefe':
      return { ...kreis, text: breit ? KOPF_TEXTE.angemeldet(kurz, wort) : '', farbe: s.stufe, titel: KOPF_TEXTE.titelPruefe(s.name, wort), zustandWort: null };
    case 'offline':
      return { ...kreis, text: breit ? KOPF_TEXTE.offline(kurz) : '', farbe: 'gedaempft', titel: KOPF_TEXTE.titelOffline(datum), zustandWort: KOPF_TEXTE.wortOffline };
    case 'server-nicht-erreichbar': {
      // EP30, EP31: der Server antwortet, die Prüfung scheitert an seiner Einrichtung bzw. an der Uhr; der Titel nennt den Grund.
      const titel = a.grund === 'nicht-eingerichtet' ? KOPF_TEXTE.titelNichtEingerichtet(datum)
        : a.grund === 'uhr' ? KOPF_TEXTE.titelUhr(datum) : KOPF_TEXTE.titelServer(datum);
      return { ...kreis, text: breit ? KOPF_TEXTE.offline(kurz) : '', farbe: 'gedaempft', titel, zustandWort: KOPF_TEXTE.wortOffline };
    }
    case 'entzogen-laeuft':
      return { ...kreis, text: breit ? KOPF_TEXTE.entzogenLaeuft(kurz) : '', farbe: 'warnung', titel: KOPF_TEXTE.titelEntzogenLaeuft, zustandWort: KOPF_TEXTE.wortEntzogen };
    default:
      return NICHTS;
  }
}

/** Spec 7: Punkt am Zahnrad = offene Zoom-Anfragen, nur für Admins mit gültiger Sitzung (die Zahl kommt aus /konto/ich). */
export function zahnradPunkt(a: KontoAnsicht | null): number {
  if (a === null || !sitzungGueltig(a) || a.stand?.stufe !== 'admin') return 0;
  return Math.max(0, Math.trunc(a.adminOffen));
}

/**
 * F5 im Werkzeugkasten: nur, wenn ohne gültige Sitzung auch keine andere Quelle Tools liefert (`quelle` aus den
 * Einstellungen: Entwicklungs-Schlüssel oder GitHub-Zugang bis zur ersten Anmeldung). Vor dem ersten Laden nie (G7).
 */
export function werkzeugkastenHinweis(a: KontoAnsicht | null, quelle: 'github' | 'proxy' | 'none' | null): string | null {
  if (a === null || quelle === null || sitzungGueltig(a)) return null;
  if (a.zustand === 'pruefe') return null;
  return quelle === 'none' ? TEXT_WERKZEUGKASTEN_OHNE_ANMELDUNG : null;
}
