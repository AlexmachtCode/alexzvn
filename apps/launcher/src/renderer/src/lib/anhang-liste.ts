import type { IveoMaterialRef } from '@shared/types';

// Anhang-Liste des Side-Events-Panels (iveo-Paket Teil D, Spec 8.1, 11.3; E18) als reine Funktionen: Store und Panel rufen
// nur diesen Helfer. Kein Dauer-Cache im Renderer (Ursache von #264): Aufklappen lädt immer, Schließen des Panels und
// Show-Wechsel leeren und klappen zu, die Zahl am 📎 steht nur an beobachteten Listen mit bekanntem Stand.
// Nur `import type`: test/selftest.ts lädt diese Datei per strip-types ohne Alias (G5).

/** Texte der Anhang-Liste (Spec 11.6: T10–T14, T19; „Erneut versuchen“ wie bisher im Panel). */
export const ANHANG_TEXTE = {
  laedt: 'Lade Anhänge…', // T10
  fehler: (text: string): string => (text ? `Anhänge konnten nicht geladen werden: ${text}` : 'Anhänge konnten nicht geladen werden.'), // T11
  leer: (uhr: string): string => `Keine Anhänge an diesem Side Event · Stand ${uhr}`, // T12
  leereListe: 'Keine Anhänge an diesem Side Event', // L3, leere Liste (11.3)
  stand: (uhr: string): string => `Stand ${uhr}`, // T13
  gescheitert: (uhr: string, text: string): string =>
    (text ? `Stand ${uhr} · Aktualisieren gescheitert: ${text}` : `Stand ${uhr} · Aktualisieren gescheitert`), // T14
  tooltip: 'Anhänge (Präsentationen, Dateien, Links) anzeigen', // T19
  erneut: 'Erneut versuchen',
} as const;

/** Zustand im Store: aufgeklappte Liste, aktives Side Event, Listen, Zeit der letzten gelungenen Prüfung, Fehlertexte. */
export interface AnhangListenZustand {
  materialsOffen: string | null;
  aktiv: string | null;
  listen: Record<string, IveoMaterialRef[] | undefined>;
  abgerufen: Record<string, string>;
  fehler: Record<string, string>;
}

export type AnhangListenEreignis =
  | { art: 'aufklappen'; id: string }
  | { art: 'zuklappen' }
  | { art: 'panelZu' }
  | { art: 'eventWechsel' }
  | { art: 'aktivWechsel'; id: string | null }
  | { art: 'ergebnis'; id: string; abgerufen: string; ok: boolean; materials?: IveoMaterialRef[]; error?: string; begann?: string };

export function leererAnhangZustand(aktiv: string | null): AnhangListenZustand {
  return { materialsOffen: null, aktiv, listen: {}, abgerufen: {}, fehler: {} };
}

/** Beobachtet ist eine Liste, wenn sie aufgeklappt oder das aktive Side Event ist (8.1). */
function beobachtet(z: AnhangListenZustand, id: string): boolean {
  return id === z.materialsOffen || id === z.aktiv;
}

/** Liste, Stand und Fehler einer Kennung vergessen. */
function ohne(z: AnhangListenZustand, id: string | null): AnhangListenZustand {
  if (id === null) return z;
  const listen = { ...z.listen };
  const abgerufen = { ...z.abgerufen };
  const fehler = { ...z.fehler };
  delete listen[id];
  delete abgerufen[id];
  delete fehler[id];
  return { ...z, listen, abgerufen, fehler };
}

const zeitVon = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/**
 * Ein Schritt der Anhang-Liste (8.1). `laden` = Kennung, deren Liste der Store jetzt abruft (`loadMaterials`);
 * `beobachte` = Liste für `watchIveoMaterials` (null = keine Meldung an den Main).
 * - aufklappen: lädt **immer** (kein „nur ohne Liste“), meldet `[id]`; die bisher aufgeklappte, nicht aktive Liste wird vergessen.
 * - zuklappen: meldet `[]`; die Liste wird vergessen, wenn sie nicht das aktive Side Event ist.
 * - panelZu, eventWechsel: alle Listen und Fehler leer, zugeklappt, meldet `[]`.
 * - aktivWechsel: neue Kennung (null = Tagesübersicht); die bisher aktive wird vergessen, wenn sie nicht aufgeklappt ist (L7).
 * - ergebnis: nur für beobachtete Listen. Ein Fehler ohne Liste (`ok: false`, ohne `materials`) setzt nur den Fehler (Liste
 *   und Stand bleiben, Diagnose sichtbar) – es sei denn, die Liste ist bekannt und er begann vor der gespeicherten gelungenen
 *   Prüfung: dann ist er überholt (Fix-Runde 4). Sein Beginn ist `begann`, sonst `abgerufen`: beim eigenen Laden der Zeitpunkt
 *   vor dem Abruf (Task 28), beim Wächter die letzte gelungene Prüfung, die der Main kennt, samt eigenem Laden (nie älter als
 *   der Stand hier). Sonst wird ein älteres `abgerufen` als das gespeicherte verworfen (Abruf und Wächter kreuzen sich); ohne
 *   `materials` rückt nur die Zeit einer schon bekannten Liste vor. `ok: true` löscht den Fehler.
 */
export function anhangListeSchritt(
  z: AnhangListenZustand,
  e: AnhangListenEreignis,
): { zustand: AnhangListenZustand; laden: string | null; beobachte: string[] | null } {
  switch (e.art) {
    case 'aufklappen': {
      const alt = z.materialsOffen !== null && z.materialsOffen !== e.id && z.materialsOffen !== z.aktiv ? z.materialsOffen : null;
      const zustand = { ...ohne(ohne(z, alt), e.id), materialsOffen: e.id };
      return { zustand, laden: e.id, beobachte: [e.id] };
    }
    case 'zuklappen': {
      const alt = z.materialsOffen !== null && z.materialsOffen !== z.aktiv ? z.materialsOffen : null;
      return { zustand: { ...ohne(z, alt), materialsOffen: null }, laden: null, beobachte: [] };
    }
    case 'panelZu':
    case 'eventWechsel':
      return { zustand: leererAnhangZustand(z.aktiv), laden: null, beobachte: [] };
    case 'aktivWechsel': {
      const alt = z.aktiv !== null && z.aktiv !== e.id && z.aktiv !== z.materialsOffen ? z.aktiv : null;
      return { zustand: { ...ohne(z, alt), aktiv: e.id }, laden: null, beobachte: null };
    }
    case 'ergebnis': {
      const unveraendert = { zustand: z, laden: null, beobachte: null };
      if (!beobachtet(z, e.id)) return unveraendert;
      if (!e.ok && e.materials === undefined) {
        // Ein Fehlschlag, der vor der gespeicherten gelungenen Prüfung begann, ist überholt (überholtes Laden, Wächter-Takt).
        if (z.listen[e.id] !== undefined && zeitVon(e.begann ?? e.abgerufen) < zeitVon(z.abgerufen[e.id])) return unveraendert;
        return { zustand: { ...z, fehler: { ...z.fehler, [e.id]: e.error ?? '' } }, laden: null, beobachte: null };
      }
      const bekannt = z.listen[e.id] !== undefined;
      if (bekannt && zeitVon(e.abgerufen) < zeitVon(z.abgerufen[e.id])) return unveraendert;
      // Nur eine neue Zeit, aber noch keine Liste: nichts übernehmen, der eigene Abruf kann noch kommen.
      if (e.materials === undefined && !bekannt) return unveraendert;
      const listen = e.materials !== undefined ? { ...z.listen, [e.id]: e.materials } : z.listen;
      const abgerufen = e.abgerufen ? { ...z.abgerufen, [e.id]: e.abgerufen } : z.abgerufen;
      const fehler = { ...z.fehler };
      if (e.ok) delete fehler[e.id];
      else fehler[e.id] = e.error ?? '';
      return { zustand: { ...z, listen, abgerufen, fehler }, laden: null, beobachte: null };
    }
  }
}

/** Uhrzeit „hh:mm“ (Ortszeit) eines ISO-Zeitpunkts; „--:--“, wenn nicht lesbar. */
function uhrzeit(iso: string | undefined): string {
  const t = zeitVon(iso);
  if (!Number.isFinite(t)) return '--:--';
  return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Anzeige einer Liste (11.3), erste zutreffende Zeile: L0 kein Token (kein 📎) · L1 aufgeklappt, erster Abruf läuft (T10) ·
 * L2 aufgeklappt, erster Abruf gescheitert, kein Stand (T11 + „Erneut versuchen“) · L3 aufgeklappt, Stand da, letzte
 * Prüfung gescheitert (Liste + T14) · L4 aufgeklappt, leer (T12) · L5 aufgeklappt, Liste (T13) · L6 zugeklappt, aktives Side
 * Event, Stand bekannt („📎 ‹n›“) · L7 sonst (📎 ohne Zahl). `zahl` steht nur an beobachteten Listen mit bekanntem Stand.
 * `_jetztMs` hält den Vertrag (Gliederung 12.1); T12–T14 nennen nur die Uhrzeit.
 */
export function anhangAnzeige(
  z: AnhangListenZustand,
  programId: string,
  tokenDa: boolean,
  _jetztMs: number,
): { fall: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7'; zahl: number | null; zeile: string | null; erneut: boolean } {
  if (!tokenDa) return { fall: 'L0', zahl: null, zeile: null, erneut: false };
  const liste = z.listen[programId];
  const fehler = z.fehler[programId];
  if (z.materialsOffen === programId) {
    if (liste === undefined) {
      return fehler === undefined
        ? { fall: 'L1', zahl: null, zeile: ANHANG_TEXTE.laedt, erneut: false }
        : { fall: 'L2', zahl: null, zeile: ANHANG_TEXTE.fehler(fehler), erneut: true };
    }
    const uhr = uhrzeit(z.abgerufen[programId]);
    if (fehler !== undefined) return { fall: 'L3', zahl: liste.length, zeile: ANHANG_TEXTE.gescheitert(uhr, fehler), erneut: false };
    if (liste.length === 0) return { fall: 'L4', zahl: 0, zeile: ANHANG_TEXTE.leer(uhr), erneut: false };
    return { fall: 'L5', zahl: liste.length, zeile: ANHANG_TEXTE.stand(uhr), erneut: false };
  }
  if (programId === z.aktiv && liste !== undefined) return { fall: 'L6', zahl: liste.length, zeile: null, erneut: false };
  return { fall: 'L7', zahl: null, zeile: null, erneut: false };
}

// ── Ende des Moduls ──
