import type { VerbundFehlerCode } from '@shared/types';

// Anzeigetexte des Verbund-Modals (reine Funktionen, nur `import type` → strip-types-testbar).

const KURZ: Record<VerbundFehlerCode, string> = {
  zeit: 'Master sichtbar, Port gesperrt',
  'nicht-gefunden': 'Master nicht erreichbar',
  verweigert: 'Master-Modus aus?',
  netz: 'Netz nicht erreichbar',
  'kein-master': 'Adresse ist kein Master',
  zertifikat: 'anderer Master',
  uhr: 'Uhrzeit prüfen',
  protokoll: 'Versionen angleichen',
  unbekannt: 'vom Master entfernt',
  signatur: 'Anmeldung abgelehnt',
  ersetzt: 'Kennung doppelt',
  datei: 'Kopplung beschädigt',
  sonstig: 'Verbindungsfehler',
};

export type Ton = 'gruen' | 'gelb' | 'rot' | 'gedaempft';

// Ein unbekannter Fremdwert kommt nie ungekürzt in die Anzeige: höchstens 32 ganze Zeichen (Codepoints).
// Bewusst lokal statt aus kopfanzeige.ts importiert: diese Datei hat keinen Laufzeit-Import (strip-types-Selbsttest).
const MAX_CODE = 32;
const kuerze = (text: string, max: number): string => {
  const zeichen = Array.from(text);
  return zeichen.length <= max ? text : zeichen.slice(0, max).join('');
};

/** Heartbeat-Feld `verbund` eines Tools auf diesem Rechner (Spec 5.2). Rolle „aus“ → keine Zeile. */
export function toolVerbundText(verbund: string | undefined, rolleAus: boolean): { text: string; ton: Ton } | null {
  if (rolleAus) return null;
  if (verbund === undefined) return { text: 'läuft, noch ohne Verbund (Update nötig)', ton: 'gedaempft' };
  if (verbund === 'verbunden') return { text: 'mit Master verbunden', ton: 'gruen' };
  if (verbund === 'sucht' || verbund === 'verbindet') return { text: 'sucht den Master…', ton: 'gelb' };
  if (verbund === 'aus') return { text: 'Verbund aus', ton: 'gedaempft' };
  const code = verbund.startsWith('fehler:') ? verbund.slice('fehler:'.length) : '';
  const text = (KURZ as Record<string, string | undefined>)[code] ?? `Fehler (${kuerze(code || verbund, MAX_CODE)})`;
  return { text, ton: 'rot' };
}

/**
 * Kurztext zu einem abgelehnten Verbund-Aufruf (Schreibfehler, gesperrte Datei). Electron reicht dem Renderer nur den
 * Text der Ablehnung („Error invoking remote method …: Error: EPERM: …“), nicht das Feld `code`: daraus kommt NUR der
 * Code in die Anzeige, nie der Text (er nennt Pfade und kann Fremdinhalte zitieren).
 */
export function ablehnungText(e: unknown): string {
  // Kein `instanceof Error`: ein Fehler, der über die Context-Bridge kommt, stammt aus einem anderen Realm.
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown };
  const text = typeof o.message === 'string' ? o.message : '';
  const code = typeof o.code === 'string' && o.code !== '' ? o.code : /\bE[A-Z0-9_]{2,}\b/.exec(text)?.[0] ?? 'UNBEKANNT';
  return `Nicht gespeichert (${kuerze(code, MAX_CODE)}). Bitte noch einmal versuchen.`;
}

export function zeigeCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function relativ(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `vor ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} min`;
  return `vor ${Math.round(m / 60)} h`;
}

export function uhrzeit(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
