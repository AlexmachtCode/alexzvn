// Protokoll (Spec 6): eine Zeile = ein JSON-Objekt mit Pflichtfeld t.
// Unbekannte t werden ignoriert (Teil 2–4 ergänzen Nachrichten ohne Protokollwechsel);
// bekannte t mit falschen Feldern gelten als kaputt → Verbindung zu.

export const PROTOKOLL = 1;

export type Grund =
  | 'code-falsch' | 'code-ungueltig' | 'keine-kopplung-offen' | 'rechner-id'
  | 'unbekannt' | 'signatur' | 'protokoll' | 'ersetzt' | 'anmeldefrist' | 'last';

export interface TeilnehmerInfo {
  art: 'tool' | 'launcher';
  appId: string;
  name: string;
  version: string;
  pid: number;
}

export type Nachricht =
  | { t: 'hallo'; protokoll: number; masterId: string; name: string; nonce: string }
  | { t: 'koppeln'; protokoll: number; rechnerId: string; rechnerName: string; nonce: string; schluessel: string; beweis: string }
  | { t: 'gekoppelt'; masterId: string; name: string; beweis: string; adressen: string[] }
  | { t: 'anmelden'; protokoll: number; rechnerId: string; rechnerName: string; signatur: string; teilnehmer: TeilnehmerInfo }
  | { t: 'teilnehmer'; teilnehmer: TeilnehmerInfo }
  | { t: 'angemeldet'; adressen: string[]; suite: string }
  | { t: 'abgelehnt'; grund: Grund; rest?: number; master?: number; suite?: string }
  | { t: 'puls' };

export type Dekodiert = { art: 'nachricht'; n: Nachricht } | { art: 'unbekannt'; t: string } | { art: 'kaputt' };

export function kodiere(n: Nachricht): string {
  return `${JSON.stringify(n)}\n`;
}

const GRUENDE: ReadonlySet<string> = new Set<Grund>([
  'code-falsch', 'code-ungueltig', 'keine-kopplung-offen', 'rechner-id',
  'unbekannt', 'signatur', 'protokoll', 'ersetzt', 'anmeldefrist', 'last',
]);

type Objekt = Record<string, unknown>;
const istText = (v: unknown): v is string => typeof v === 'string';
const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const istTextListe = (v: unknown): v is string[] => Array.isArray(v) && v.every(istText);
const optional = (v: unknown, p: (x: unknown) => boolean): boolean => v === undefined || p(v);

function istTeilnehmer(v: unknown): v is TeilnehmerInfo {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Objekt;
  return (o.art === 'tool' || o.art === 'launcher') && istText(o.appId) && o.appId.length > 0
    && istText(o.name) && istText(o.version) && istZahl(o.pid);
}

// Map statt Objekt-Literal: t = "constructor"/"__proto__" darf keinen Prüfer finden.
const PRUEFER = new Map<string, (o: Objekt) => boolean>([
  ['hallo', (o) => istZahl(o.protokoll) && istText(o.masterId) && istText(o.name) && istText(o.nonce)],
  ['koppeln', (o) => istZahl(o.protokoll) && istText(o.rechnerId) && istText(o.rechnerName)
    && istText(o.nonce) && istText(o.schluessel) && istText(o.beweis)],
  ['gekoppelt', (o) => istText(o.masterId) && istText(o.name) && istText(o.beweis) && istTextListe(o.adressen)],
  ['anmelden', (o) => istZahl(o.protokoll) && istText(o.rechnerId) && istText(o.rechnerName)
    && istText(o.signatur) && istTeilnehmer(o.teilnehmer)],
  ['teilnehmer', (o) => istTeilnehmer(o.teilnehmer)],
  ['angemeldet', (o) => istTextListe(o.adressen) && istText(o.suite)],
  ['abgelehnt', (o) => istText(o.grund) && GRUENDE.has(o.grund)
    && optional(o.rest, istZahl) && optional(o.master, istZahl) && optional(o.suite, istText)],
  ['puls', () => true],
]);

export function dekodiere(zeile: string): Dekodiert {
  let roh: unknown;
  try {
    roh = JSON.parse(zeile);
  } catch {
    return { art: 'kaputt' };
  }
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) return { art: 'kaputt' };
  const o = roh as Objekt;
  if (!istText(o.t)) return { art: 'kaputt' };
  const pruefer = PRUEFER.get(o.t);
  if (!pruefer) return { art: 'unbekannt', t: o.t };
  return pruefer(o) ? { art: 'nachricht', n: o as unknown as Nachricht } : { art: 'kaputt' };
}

export class ZeileZuLang extends Error {
  constructor() {
    super('Zeile zu lang');
  }
}

/** Zerlegt einen Bytestrom in Zeilen; eine Zeile (auch eine unvollständige) über `grenze` Bytes wirft. */
export class ZeilenLeser {
  private grenze: number;
  private puffer: Buffer = Buffer.alloc(0);

  constructor(grenze: number) {
    this.grenze = grenze;
  }

  setzeGrenze(grenze: number): void {
    this.grenze = grenze;
  }

  fuettere(stueck: Buffer): string[] {
    this.puffer = this.puffer.length > 0 ? Buffer.concat([this.puffer, stueck]) : stueck;
    const zeilen: string[] = [];
    let start = 0;
    for (;;) {
      const nl = this.puffer.indexOf(0x0a, start);
      if (nl === -1) break;
      if (nl - start > this.grenze) throw new ZeileZuLang();
      zeilen.push(this.puffer.subarray(start, nl).toString('utf8'));
      start = nl + 1;
    }
    this.puffer = Buffer.from(this.puffer.subarray(start));
    if (this.puffer.length > this.grenze) throw new ZeileZuLang();
    return zeilen;
  }
}
