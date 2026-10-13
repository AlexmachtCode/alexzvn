import type { KoppelAntwort, VerbundClientStand, VerbundFehlerCode, VerbundShowStand } from '@shared/types';

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
  // Object.hasOwn: „fehler:constructor“ lieferte sonst Object.prototype.constructor (eine Funktion) als Text (C5).
  const text = Object.hasOwn(KURZ, code) ? KURZ[code as VerbundFehlerCode] : `Fehler (${kuerze(code || verbund, MAX_CODE)})`;
  return { text, ton: 'rot' };
}

// Electron-Rahmen einer abgelehnten IPC-Anfrage: „Error invoking remote method 'verbund:rolle': “, danach der Text des
// Fehlers im Main („Error: EPERM: operation not permitted, rename 'C:\…'“). Node-Fehler tragen ihren Code als erstes Wort
// nach der Fehlerklasse, gefolgt von einem Doppelpunkt.
const ELECTRON_RAHMEN = /^Error invoking remote method '[^']*': /;
const CODE_AM_ANFANG = /^(?:[A-Za-z]*Error: )?(E[A-Z0-9_]+)(?::|$)/;

/**
 * Der Code eines abgelehnten Aufrufs: das Feld `code` (Aufruf ohne IPC), sonst das erste Wort der eigentlichen Meldung
 * hinter dem Electron-Rahmen. NIE ein Wort irgendwo im Text: Pfade (C:\Users\EDV) und zitierte Namen sind Fremdtext.
 */
function ablehnungCode(e: unknown): string {
  // Kein `instanceof Error`: ein Fehler, der über die Context-Bridge kommt, stammt aus einem anderen Realm.
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown };
  if (typeof o.code === 'string' && o.code !== '') return kuerze(o.code, MAX_CODE);
  const text = (typeof o.message === 'string' ? o.message : '').replace(ELECTRON_RAHMEN, '');
  return kuerze(CODE_AM_ANFANG.exec(text)?.[1] ?? 'UNBEKANNT', MAX_CODE);
}

/** Was der Aufruf wollte: der Text nennt es, damit er nie etwas Falsches behauptet („Nicht gespeichert“ beim Koppeln). */
export type AblehnungArt = 'speichern' | 'koppeln' | 'anstossen';

/**
 * Kurztext zu einem abgelehnten Verbund-Aufruf (Schreibfehler, gesperrte Datei, Ausfall der Leitung). Electron reicht
 * dem Renderer nur den Text der Ablehnung, nicht das Feld `code`: daraus kommt NUR der Code in die Anzeige, nie der
 * Text (er nennt Pfade und kann Fremdinhalte zitieren).
 */
export function ablehnungText(e: unknown, art: AblehnungArt = 'speichern'): string {
  const code = ablehnungCode(e);
  switch (art) {
    case 'speichern': return `Nicht gespeichert (${code}). Bitte noch einmal versuchen.`;
    case 'koppeln': return `Koppeln fehlgeschlagen (${code}). Bitte noch einmal versuchen.`;
    case 'anstossen': return `Aktion fehlgeschlagen (${code}). Bitte noch einmal versuchen.`;
  }
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

// ── Regeln des Verbund-Modals (Endprüfung C1–C4), als reine Funktionen testbar ──

/**
 * C1: „Neue Kennung“ nur anbieten, wo sie hilft — bei Kennung doppelt (ersetzt), abgelehnter Anmeldung (signatur) oder
 * nach der Koppel-Ablehnung 'rechner-id' (geklonter Rechner bzw. kopierter Ordner). Normales Umkoppeln behält die Kennung.
 */
export function neueKennungAnbieten(client: VerbundClientStand | null | undefined, letzteAblehnung: string | null): boolean {
  const klonFehler = client?.art === 'fehler' && (client.code === 'ersetzt' || client.code === 'signatur');
  return klonFehler || letzteAblehnung === 'rechner-id';
}

/** C2: Koppeln nur, wenn nichts läuft und Adresse und Code da sind — für Knopf UND Enter (sonst umging Enter die Sperre). */
export function koppelnMoeglich(beschaeftigt: boolean, adresse: string, code: string): boolean {
  return !beschaeftigt && adresse.trim() !== '' && code.trim() !== '';
}

/** C2: Nach jedem Versuch, der das Gegenüber erreicht hat, ist der Code verbraucht (Spec 3.3) — Feld leeren. */
export function codeFeldLeeren(r: KoppelAntwort): boolean {
  return r.ok || r.codeVerbraucht === true;
}

export interface ToolZeile {
  appId: string;
  name: string;
  text: string;
  ton: Ton;
}

/** C3 (Spec 5.2): „Tools dieses Rechners“ — laufende Tools mit ihrem Verbund-Zustand; Rolle „aus“ → keine Zeilen. */
export function toolZeilen(
  presence: ReadonlyArray<{ appId: string; name: string; running: boolean; verbund?: string }>,
  rolleAus: boolean,
): ToolZeile[] {
  const zeilen: ToolZeile[] = [];
  for (const p of presence) {
    if (!p.running) continue;
    const t = toolVerbundText(p.verbund, rolleAus);
    if (t) zeilen.push({ appId: p.appId, name: p.name, text: t.text, ton: t.ton });
  }
  return zeilen;
}

/** C4: dauerhafter Schreibfehler von verbund.json am Master (speicherFehler, Endprüfung B6). */
export function speicherFehlerText(code: string): string {
  return `Verbund nicht gespeichert (${kuerze(code, MAX_CODE)}) — Änderungen gelten nur bis zum Neustart`;
}

// ── Teil 2b R2, Spec 15.5: Show-Daten im Verbund-Modal am Master (wörtlich) ──

/**
 * Zeile unter „Gekoppelte Rechner“ je nach `grund` des zuletzt verteilten Stands; `rot` bei zu-gross und nicht-lesbar.
 * Bei genau einem Bezieher „1 Tool bezieht sie“ (Owner 08.10.2026), sonst wörtlich 15.5 „⟨n⟩ Tools beziehen sie“.
 */
export function verbundShowZeile(s: VerbundShowStand, uhrzeit: (ms: number) => string): { text: string; rot: boolean } {
  switch (s.grund) {
    case 'keine-show':
      return { text: 'Show im Verbund: keine Show offen', rot: false };
    case 'zu-gross':
      return { text: `Show „${s.showName ?? ''}“ nicht verteilt: zu groß für den Verbund (${s.groesseKiB ?? 0} KiB)`, rot: true };
    case 'nicht-lesbar':
      return { text: `Show „${s.dateiName ?? ''}“ nicht verteilt: nicht lesbar`, rot: true };
    default:
      return {
        text: `Show im Verbund: „${s.showName ?? ''}“ · Stand ${s.verteiltAm === null ? '–' : uhrzeit(s.verteiltAm)} · ${s.bezieher === 1 ? '1 Tool bezieht sie' : `${s.bezieher} Tools beziehen sie`}`,
        rot: false,
      };
  }
}

/** Die drei Tools, die in 2b Show-Daten anwenden (Spec 15.5); andere zeigen nichts dazu. */
const DATEN_TOOLS: ReadonlySet<string> = new Set(['jm-timer', 'jm-titler', 'jm-rundown']);
/** Spec 15.5: so lange nach der Anmeldung gilt ein fehlendes Abo noch nicht als „Update nötig“. */
export const OHNE_DATEN_NACH_MS = 10_000;

/**
 * Je Tool in der Liste der gekoppelten Rechner (Spec 15.5): mit Abo „bezieht Show-Daten“; ohne Abo 10 s nach der
 * Anmeldung „ohne Show-Daten (Update nötig)“, davor nichts. Andere Tools: null.
 */
export function toolDatenText(appId: string, verbundenSeit: number, bezieht: boolean, jetzt: number): string | null {
  if (!DATEN_TOOLS.has(appId)) return null;
  if (bezieht) return 'bezieht Show-Daten';
  return jetzt - verbundenSeit >= OHNE_DATEN_NACH_MS ? 'ohne Show-Daten (Update nötig)' : null;
}
