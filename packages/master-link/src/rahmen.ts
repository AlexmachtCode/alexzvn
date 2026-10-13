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

/**
 * Felder, die in Beweise und Signaturen eingehen (hallo.nonce, koppeln.nonce, koppeln.rechnerId, anmelden.rechnerId):
 * nicht leer, höchstens 128 Zeichen, kein „|“ (Trennzeichen in beweis.ts) und keine Steuerzeichen.
 * Bewusst KEINE engere Zeichenklasse: rechnerIds dürfen z. B. Leerzeichen enthalten.
 * Eine leere Nonce darf nie als „hallo gesehen“ durchgehen (Spec 3.3: die harte Frist beim Koppeln).
 */
const KENNUNG_UNZULAESSIG = /[|\u0000-\u001f\u007f]/;
const istKennung = (v: unknown): v is string =>
  istText(v) && v.length > 0 && v.length <= 128 && !KENNUNG_UNZULAESSIG.test(v);

function istTeilnehmer(v: unknown): v is TeilnehmerInfo {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Objekt;
  return (o.art === 'tool' || o.art === 'launcher') && istText(o.appId) && o.appId.length > 0
    && istText(o.name) && istText(o.version) && istZahl(o.pid);
}

// Map statt Objekt-Literal: t = "constructor"/"__proto__" darf keinen Prüfer finden.
const PRUEFER = new Map<string, (o: Objekt) => boolean>([
  ['hallo', (o) => istZahl(o.protokoll) && istText(o.masterId) && istText(o.name) && istKennung(o.nonce)],
  ['koppeln', (o) => istZahl(o.protokoll) && istKennung(o.rechnerId) && istText(o.rechnerName)
    && istKennung(o.nonce) && istText(o.schluessel) && istText(o.beweis)],
  ['gekoppelt', (o) => istText(o.masterId) && istText(o.name) && istText(o.beweis) && istTextListe(o.adressen)],
  ['anmelden', (o) => istZahl(o.protokoll) && istKennung(o.rechnerId) && istText(o.rechnerName)
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

/**
 * Zerlegt einen Bytestrom in Zeilen (Teil 2b, Spec 13.5). `fuettere` hängt ein Stück an und merkt sich seine
 * Zeilenenden — gesucht wird nur im neuen Stück. `naechste` gibt EINE Zeile heraus; die Grenze gilt beim Entnehmen.
 * So wirkt ein setzeGrenze() im Zuhörer einer Zeile (etwa 'angemeldet') schon für die nächste Zeile desselben Stücks.
 * Der Puffer ist eine Liste von Stücken: zusammengefügt (kopiert) wird nur eine fertige Zeile, die über mehrere
 * Stücke reicht. `messung` zählt diese Bytes (nur im Test gesetzt, Spec 19.1).
 */
export class ZeilenLeser {
  private grenze: number;
  private readonly messung: { kopiert: number } | undefined;
  /** Noch nicht entnommene Stücke; im ersten beginnt der Rest bei `kopf`. */
  private stuecke: Buffer[] = [];
  private kopf = 0;
  /** Stromposition des ersten nicht entnommenen Bytes bzw. hinter dem letzten gefütterten Byte. */
  private gelesen = 0;
  private gesamt = 0;
  /** Stromposition jedes noch nicht entnommenen '\n', in Reihenfolge; `naechstesEnde` zeigt auf das nächste. */
  private enden: number[] = [];
  private naechstesEnde = 0;

  constructor(grenze: number, messung?: { kopiert: number }) {
    this.grenze = grenze;
    this.messung = messung;
  }

  setzeGrenze(grenze: number): void {
    this.grenze = grenze;
  }

  /** Hängt das Stück an; sucht '\n' nur im neuen Stück. Wirft nie. */
  fuettere(stueck: Buffer): void {
    if (stueck.length === 0) return;
    for (let i = stueck.indexOf(0x0a); i !== -1; i = stueck.indexOf(0x0a, i + 1)) this.enden.push(this.gesamt + i);
    this.stuecke.push(stueck);
    this.gesamt += stueck.length;
  }

  /**
   * Nächste vollständige Zeile (UTF-8, ohne '\n') oder null. Wirft ZeileZuLang, wenn sie länger als die AKTUELLE
   * Grenze ist, oder – ohne vollständige Zeile – wenn der Rest (eine angefangene Zeile) die Grenze übersteigt.
   */
  naechste(): string | null {
    if (this.naechstesEnde >= this.enden.length) {
      if (this.gesamt - this.gelesen > this.grenze) throw new ZeileZuLang();
      return null;
    }
    const laenge = this.enden[this.naechstesEnde] - this.gelesen;
    if (laenge > this.grenze) throw new ZeileZuLang();
    this.naechstesEnde++;
    if (this.naechstesEnde === this.enden.length) {
      this.enden = [];
      this.naechstesEnde = 0;
    }
    const zeile = this.entnimm(laenge);
    this.vor(1); // das '\n'
    return zeile;
  }

  /** Die nächsten `n` Bytes als Text; über mehrere Stücke wird nur diese Zeile zusammengefügt. */
  private entnimm(n: number): string {
    const erstes = this.stuecke[0];
    if (this.kopf + n <= erstes.length) {
      const text = erstes.toString('utf8', this.kopf, this.kopf + n);
      this.vor(n);
      return text;
    }
    const teile: Buffer[] = [];
    let rest = n;
    let ab = this.kopf;
    for (let i = 0; rest > 0; i++) {
      const stueck = this.stuecke[i];
      const nimm = Math.min(rest, stueck.length - ab);
      teile.push(stueck.subarray(ab, ab + nimm));
      rest -= nimm;
      ab = 0;
    }
    if (this.messung) this.messung.kopiert += n;
    const text = Buffer.concat(teile, n).toString('utf8');
    this.vor(n);
    return text;
  }

  /** Rückt den Anfang des Rests um `n` Bytes vor und gibt ganz entnommene Stücke frei. */
  private vor(n: number): void {
    this.gelesen += n;
    let rest = n;
    while (rest > 0) {
      const uebrig = this.stuecke[0].length - this.kopf;
      if (rest < uebrig) {
        this.kopf += rest;
        return;
      }
      rest -= uebrig;
      this.stuecke.shift();
      this.kopf = 0;
    }
  }
}
