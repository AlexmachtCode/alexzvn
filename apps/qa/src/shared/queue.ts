// Reine Queue-Logik (keine node/electron-Imports) — per Selftest (test/selftest.ts)
// ohne Electron prüfbar. Operiert immutabel auf QaEntry[]; IDs/Zeitstempel reicht
// der Main herein, damit die Funktionen deterministisch testbar bleiben.
import type { QaChannel, QaEntry, QaStatus, QaSubmission } from './types';

let _seq = 0;
/** Kurze, eindeutige ID für Einträge. */
export function newEntryId(prefix = 'q'): string {
  return `${prefix}_${Date.now().toString(36)}${(_seq++).toString(36)}`;
}

const clampStr = (s: string | undefined, max: number): string => (s ?? '').trim().slice(0, max);

/** Neue Wortmeldung bauen (Eingabe säubern + begrenzen). */
export function makeEntry(
  sub: QaSubmission,
  source: QaEntry['source'],
  approved: boolean,
  id: string,
  at: number,
  channel: QaChannel = source === 'operator' ? 'operator' : 'lan',
): QaEntry {
  const contact = clampStr(sub.contact, 200);
  return {
    id,
    name: clampStr(sub.name, 80) || 'Unbenannt',
    affiliation: clampStr(sub.affiliation, 80),
    question: clampStr(sub.question, 500),
    status: 'waiting',
    source,
    channel,
    ...(contact ? { contact } : {}),
    approved,
    at,
  };
}

export function updateEntry(entries: QaEntry[], id: string, patch: QaSubmission): QaEntry[] {
  return entries.map((e) =>
    e.id === id
      ? {
          ...e,
          name: patch.name !== undefined ? clampStr(patch.name, 80) || e.name : e.name,
          affiliation: patch.affiliation !== undefined ? clampStr(patch.affiliation, 80) : e.affiliation,
          question: patch.question !== undefined ? clampStr(patch.question, 500) : e.question,
        }
      : e,
  );
}

export function setStatus(entries: QaEntry[], id: string, status: QaStatus): QaEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, status } : e));
}

export function setApproved(entries: QaEntry[], id: string, approved: boolean): QaEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, approved } : e));
}

export function remove(entries: QaEntry[], id: string): QaEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Eintrag um eine Position verschieben (Reihenfolge = Warteschlange). */
export function move(entries: QaEntry[], id: string, dir: -1 | 1): QaEntry[] {
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return entries;
  const j = i + dir;
  if (j < 0 || j >= entries.length) return entries;
  const next = entries.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Eintrag scharf schalten: er wird 'active' (+ implizit freigegeben); ein bisher
 * aktiver Sprecher wird auf 'done' gesetzt (immer nur einer aktiv).
 */
export function activate(entries: QaEntry[], id: string): QaEntry[] {
  if (!entries.some((e) => e.id === id)) return entries;
  return entries.map((e) => {
    if (e.id === id) return { ...e, status: 'active', approved: true };
    if (e.status === 'active') return { ...e, status: 'done' };
    return e;
  });
}

/** Aktiven Sprecher beenden (active → done). */
export function endActive(entries: QaEntry[]): QaEntry[] {
  return entries.map((e) => (e.status === 'active' ? { ...e, status: 'done' } : e));
}

export function activeEntry(entries: QaEntry[]): QaEntry | null {
  return entries.find((e) => e.status === 'active') ?? null;
}

/**
 * Ist ein Eintrag aufrufbereit? Externe Einreichungen (Stream/Presse, #166) sind
 * IMMER freigabepflichtig — unabhängig vom Moderations-Schalter. Für Pult/Saal gilt
 * der Schalter: ohne Moderation sofort bereit, mit Moderation erst nach Freigabe.
 */
function isReady(e: QaEntry, moderation: boolean): boolean {
  if (e.channel === 'stream' || e.channel === 'press') return e.approved;
  return !moderation || e.approved;
}

/** Erster wartender (freigabebereiter) Eintrag in Listenreihenfolge. */
export function nextWaiting(entries: QaEntry[], moderation: boolean): QaEntry | null {
  return entries.find((e) => e.status === 'waiting' && isReady(e, moderation)) ?? null;
}

export function clearDone(entries: QaEntry[]): QaEntry[] {
  return entries.filter((e) => e.status !== 'done');
}

/** Anzahl wartender (queuebarer) Einträge — für STATE/Companion. */
export function waitingCount(entries: QaEntry[], moderation: boolean): number {
  return entries.filter((e) => e.status === 'waiting' && isReady(e, moderation)).length;
}

/**
 * Text fürs whitespace-getrennte Suite-Protokoll kodieren: Spaces → '_',
 * Leerstring → '-'. Der Titler dekodiert '_' wieder zu Spaces.
 */
export function encodeToken(s: string): string {
  const t = (s ?? '').trim().replace(/\s+/g, '_');
  return t.length ? t : '-';
}
