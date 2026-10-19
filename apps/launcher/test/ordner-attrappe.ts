// Attrappen für den Ordner-Lauf (iveo-Paket, Spec 12.4 Kopf) — Dateisystem im Speicher in der Form von fs/promises,
// Testuhr, Agenda- und Download-Attrappe, Fixtures und ein Lauf-Bauer. Genutzt von test/side-event-ordner.test.ts
// und test/side-event-ordner-echt.test.ts (tsx). Annahmen über APFS und HFS+/SMB stehen am Profil.
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { IveoAgendaItem, IveoAssetStrom, IveoClient, IveoMaterial, IveoProgramFilter } from '@jm/iveo';
import { serializeShow, type Show, type ShowIveoProgramRef } from '@jm/show';
import type { AnhangOrdnerStand, VerbundRolle } from '../src/shared/types';
import type { AgendaErgebnis } from '../src/main/iveo-anhaenge';
import { erzeugeOrdnerLauf, type OrdnerFs, type OrdnerLaufAbh } from '../src/main/side-event-ordner-lauf';

/** Alles, was die Attrappen je geschrieben, geloggt oder gemeldet haben (Geheimnis-Suche, 12.4 Nr. 41). */
export const MITSCHRIFT = {
  attrappen: [] as FsAttrappe[],
  logs: [] as string[][],
  staende: [] as unknown[][],
  ereignisse: [] as unknown[],
  antworten: [] as unknown[],
  referenzen: [] as string[],
};

/** Lässt laufende async-Ketten zu Ende laufen (keine echte I/O in der Attrappe). */
export async function ruhe(n = 20): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
}

// ── Uhr ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export class TestUhr {
  t: number;
  private timer: Array<{ id: number; at: number; fn: () => void }> = [];
  private n = 0;
  constructor(start = Date.UTC(2026, 9, 16, 8, 0, 0)) {
    this.t = start;
  }
  jetzt = (): number => this.t;
  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = ++this.n;
    this.timer.push({ id, at: this.t + ms, fn });
    return id;
  };
  clearTimeout = (h: unknown): void => {
    this.timer = this.timer.filter((x) => x.id !== h);
  };
  /** Uhr um `ms` vorrücken; fällige Zeitgeber feuern in Reihenfolge, nach jedem Schritt ruhen die Ketten. */
  async spule(ms: number, schritt = 1000): Promise<void> {
    const ende = this.t + ms;
    while (this.t < ende) {
      this.t = Math.min(ende, this.t + schritt);
      for (;;) {
        const f = this.timer.filter((x) => x.at <= this.t).sort((a, b) => a.at - b.at)[0];
        if (!f) break;
        this.timer = this.timer.filter((x) => x !== f);
        f.fn();
      }
      await ruhe();
    }
  }
}

// ── Dateisystem ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * NTFS: Groß- und Kleinschreibung egal, NFC und NFD verschieden (gemessen, Spec 9.9). APFS: beides egal (Annahme).
 * HFS+/SMB vom Mac: wie APFS, liefert Namen aber in NFD zurück (Annahme). `rename` auf einen bestehenden Namen ersetzt
 * still, auch bei anderer Schreibweise (gemessen); geöffnete Dateien: EBUSY.
 */
export type Profil = 'NTFS' | 'APFS' | 'HFS+';

type Knoten =
  | { typ: 'datei'; name: string; teile: Uint8Array[]; groesse: number; mtimeMs: number }
  | { typ: 'ordner'; name: string; kinder: Map<string, Knoten>; mtimeMs: number }
  | { typ: 'link'; name: string; ziel: string };

function datenVon(k: { teile: Uint8Array[] }): Buffer {
  return Buffer.concat(k.teile);
}

function fsFehler(code: string, op: string, p: string): Error {
  return Object.assign(new Error(`${code}: ${op} '${p}'`), { code });
}

export class FsAttrappe implements OrdnerFs {
  readonly profil: Profil;
  private wurzeln = new Map<string, Knoten & { typ: 'ordner' }>();
  /** Jeder Aufruf: Operation, Pfad, zweiter Pfad. */
  protokoll: Array<{ op: string; p: string; p2?: string }> = [];
  /** Inhalt jedes write-Aufrufs als Text (Geheimnis-Suche) und jeder je angelegte Dateiname. */
  geschrieben: string[] = [];
  /** Bytes je Pfad, die write-Aufrufe geschrieben haben (auch für später gelöschte Zwischendateien). */
  geschriebenJe = new Map<string, number>();
  angelegt = new Set<string>();
  geoeffnet = new Set<string>();
  kapazitaet = 100 * 1024 ** 3;
  statfsFehler: string | null = null;
  enospcNach: number | null = null;
  private zaehlerGeschrieben = 0;
  private fehlerRegeln: Array<{ op: string; wann: (p: string) => boolean; code: string; mal: number; ab: number }> = [];
  private haengeRegeln: Array<{ op: string; wann: (p: string) => boolean }> = [];
  private tore: Array<{ op: string; wann: (p: string) => boolean; warte: Promise<void>; erreicht(): void }> = [];
  private vorRegeln: Array<{ op: string; fn: (p: string, p2?: string) => void }> = [];
  haengend = 0;

  constructor(profil: Profil = 'NTFS') {
    this.profil = profil;
    MITSCHRIFT.attrappen.push(this);
  }

  // ── Steuerung für Tests ──
  /** Fehler mit `code` für passende Aufrufe; die ersten `ab` passenden gehen noch durch, danach `mal`-mal der Fehler. */
  fehlerBei(op: string, wann: (p: string) => boolean, code: string, mal = Infinity, ab = 0): void {
    this.fehlerRegeln.push({ op, wann, code, mal, ab });
  }
  haengtBei(op: string, wann: (p: string) => boolean): void {
    this.haengeRegeln.push({ op, wann });
  }
  /** Die nächste passende Operation wartet, bis `weiter()` gerufen wird. */
  torBei(op: string, wann: (p: string) => boolean): { weiter(): void; erreicht(): boolean } {
    let weiter: () => void = () => undefined;
    let erreicht = false;
    const warte = new Promise<void>((ok) => { weiter = ok; });
    this.tore.push({ op, wann, warte, erreicht: () => { erreicht = true; } });
    return { weiter: () => weiter(), erreicht: () => erreicht };
  }
  vor(op: string, fn: (p: string, p2?: string) => void): void {
    this.vorRegeln.push({ op, fn });
  }
  regelnLoeschen(): void {
    this.fehlerRegeln = [];
    this.haengeRegeln = [];
    this.vorRegeln = [];
  }
  oeffne(p: string): void { this.geoeffnet.add(this.schluesselPfad(p)); }
  schliesse(p: string): void { this.geoeffnet.delete(this.schluesselPfad(p)); }
  zaehle(op?: string, wann: (p: string) => boolean = () => true): number {
    return this.protokoll.filter((x) => (!op || x.op === op) && (wann(x.p) || (x.p2 !== undefined && wann(x.p2)))).length;
  }

  lege(p: string, inhalt: string | Uint8Array, mtimeMs = 1_000): void {
    const { eltern, name } = this.elternVon(p, true);
    const daten = typeof inhalt === 'string' ? Buffer.from(inhalt, 'utf8') : inhalt;
    eltern.kinder.set(this.schluessel(name), { typ: 'datei', name: this.gespeichert(name), teile: [new Uint8Array(daten)], groesse: daten.byteLength, mtimeMs });
  }
  ordner(p: string): void {
    this.mkdirSync(p);
  }
  verknuepfung(p: string, ziel: string): void {
    const { eltern, name } = this.elternVon(p, true);
    eltern.kinder.set(this.schluessel(name), { typ: 'link', name: this.gespeichert(name), ziel });
  }
  setzeMtime(p: string, mtimeMs: number): void {
    const k = this.finde(p);
    if (k && k.typ !== 'link') k.mtimeMs = mtimeMs;
  }
  inhalt(p: string): string | null {
    const k = this.finde(p);
    return k?.typ === 'datei' ? datenVon(k).toString('utf8') : null;
  }
  gibt(p: string): boolean {
    return this.finde(p) !== null;
  }
  namen(p: string): string[] {
    const k = this.finde(p);
    return k?.typ === 'ordner' ? [...k.kinder.values()].map((x) => x.name).sort() : [];
  }
  /** Alle Dateien mit vollem Pfad (wie gespeichert) und Inhalt. */
  alleDateien(): Array<{ pfad: string; inhalt: string }> {
    const aus: Array<{ pfad: string; inhalt: string }> = [];
    const geh = (k: Knoten, p: string): void => {
      if (k.typ === 'datei') aus.push({ pfad: p, inhalt: datenVon(k).toString('utf8') });
      if (k.typ === 'ordner') for (const c of k.kinder.values()) geh(c, path.join(p, c.name));
    };
    for (const k of this.wurzeln.values()) geh(k, k.name);
    return aus;
  }
  belegt(): number {
    let n = 0;
    const geh = (k: Knoten): void => {
      if (k.typ === 'datei') n += k.groesse;
      if (k.typ === 'ordner') for (const c of k.kinder.values()) geh(c);
    };
    for (const k of this.wurzeln.values()) geh(k);
    return n;
  }

  // ── fs/promises-Form ──
  async stat(p: string): Promise<{ size: number; mtimeMs: number; isFile(): boolean; isDirectory(): boolean }> {
    await this.schritt('stat', p);
    let k = this.finde(p);
    if (k?.typ === 'link') k = this.finde(k.ziel);
    if (!k) throw fsFehler('ENOENT', 'stat', p);
    const datei = k.typ === 'datei';
    return { size: k.typ === 'datei' ? k.groesse : 0, mtimeMs: k.mtimeMs, isFile: () => datei, isDirectory: () => !datei };
  }
  async lstat(p: string): Promise<{ isDirectory(): boolean; isSymbolicLink(): boolean }> {
    await this.schritt('lstat', p);
    const k = this.finde(p);
    if (!k) throw fsFehler('ENOENT', 'lstat', p);
    return { isDirectory: () => k.typ === 'ordner', isSymbolicLink: () => k.typ === 'link' };
  }
  async readdir(p: string): Promise<string[]> {
    await this.schritt('readdir', p);
    const k = this.finde(p);
    if (!k) throw fsFehler('ENOENT', 'readdir', p);
    if (k.typ !== 'ordner') throw fsFehler('ENOTDIR', 'readdir', p);
    return [...k.kinder.values()].map((x) => x.name);
  }
  async mkdir(p: string, _o: { recursive: true }): Promise<unknown> {
    await this.schritt('mkdir', p);
    this.mkdirSync(p);
    return undefined;
  }
  async readFile(p: string, _enc: 'utf8'): Promise<string> {
    await this.schritt('readFile', p);
    const k = this.finde(p);
    if (!k) throw fsFehler('ENOENT', 'readFile', p);
    if (k.typ !== 'datei') throw fsFehler('EISDIR', 'readFile', p);
    return datenVon(k).toString('utf8');
  }
  async open(p: string, _flags: 'wx'): Promise<{ write(b: Uint8Array): Promise<unknown>; sync(): Promise<void>; close(): Promise<void> }> {
    await this.schritt('open', p);
    const { eltern, name } = this.elternVon(p, false);
    if (eltern.kinder.has(this.schluessel(name))) throw fsFehler('EEXIST', 'open', p);
    const knoten: Knoten & { typ: 'datei' } = { typ: 'datei', name: this.gespeichert(name), teile: [], groesse: 0, mtimeMs: 1_000 };
    eltern.kinder.set(this.schluessel(name), knoten);
    this.angelegt.add(p);
    return {
      write: async (b: Uint8Array) => {
        await this.schritt('write', p);
        if (this.enospcNach !== null && this.zaehlerGeschrieben + b.byteLength > this.enospcNach) throw fsFehler('ENOSPC', 'write', p);
        this.zaehlerGeschrieben += b.byteLength;
        this.geschriebenJe.set(p, (this.geschriebenJe.get(p) ?? 0) + b.byteLength);
        knoten.teile.push(new Uint8Array(b));
        knoten.groesse += b.byteLength;
        if (b.byteLength <= 65_536) this.geschrieben.push(Buffer.from(b).toString('utf8'));
        return { bytesWritten: b.byteLength };
      },
      sync: async () => { await this.schritt('sync', p); },
      close: async () => { await this.schritt('close', p); },
    };
  }
  async rename(von: string, nach: string): Promise<void> {
    await this.schritt('rename', von, nach);
    const q = this.elternVon(von, false);
    const k = q.eltern.kinder.get(this.schluessel(q.name));
    if (!k) throw fsFehler('ENOENT', 'rename', von);
    if (this.istGeoeffnet(von, k)) throw fsFehler('EBUSY', 'rename', von);
    const z = this.elternVon(nach, false);
    const alt = z.eltern.kinder.get(this.schluessel(z.name));
    if (alt && this.istGeoeffnet(nach, alt)) throw fsFehler('EBUSY', 'rename', nach);
    if (alt?.typ === 'ordner' && k.typ !== 'ordner') throw fsFehler('EISDIR', 'rename', nach);
    q.eltern.kinder.delete(this.schluessel(q.name));
    k.name = this.gespeichert(z.name);
    z.eltern.kinder.set(this.schluessel(z.name), k); // ersetzt still, auch bei anderer Schreibweise
    this.angelegt.add(nach);
  }
  async unlink(p: string): Promise<void> {
    await this.schritt('unlink', p);
    const { eltern, name } = this.elternVon(p, false);
    const k = eltern.kinder.get(this.schluessel(name));
    if (!k) throw fsFehler('ENOENT', 'unlink', p);
    if (k.typ === 'ordner') throw fsFehler('EPERM', 'unlink', p);
    if (this.istGeoeffnet(p, k)) throw fsFehler('EBUSY', 'unlink', p);
    eltern.kinder.delete(this.schluessel(name));
  }
  async statfs(p: string): Promise<{ bavail: number | bigint; bsize: number | bigint }> {
    await this.schritt('statfs', p);
    if (this.statfsFehler) throw fsFehler(this.statfsFehler, 'statfs', p);
    return { bavail: Math.floor((this.kapazitaet - this.belegt()) / 4096), bsize: 4096 };
  }

  // ── intern ──
  private schluessel(name: string): string {
    return this.profil === 'NTFS' ? name.toLowerCase() : name.normalize('NFC').toLowerCase();
  }
  private gespeichert(name: string): string {
    return this.profil === 'HFS+' ? name.normalize('NFD') : name;
  }
  private teile(p: string): { wurzel: string; segmente: string[] } {
    const r = path.resolve(p);
    const wurzel = path.parse(r).root;
    return { wurzel, segmente: r.slice(wurzel.length).split(path.sep).filter(Boolean) };
  }
  private schluesselPfad(p: string): string {
    const { wurzel, segmente } = this.teile(p);
    return [wurzel.toLowerCase(), ...segmente.map((s) => this.schluessel(s))].join('/');
  }
  private istGeoeffnet(p: string, k: Knoten): boolean {
    const s = this.schluesselPfad(p);
    if (this.geoeffnet.has(s)) return true;
    return k.typ === 'ordner' && [...this.geoeffnet].some((g) => g.startsWith(`${s}/`));
  }
  private wurzel(w: string): Knoten & { typ: 'ordner' } {
    let k = this.wurzeln.get(w.toLowerCase());
    if (!k) {
      k = { typ: 'ordner', name: w, kinder: new Map(), mtimeMs: 1_000 };
      this.wurzeln.set(w.toLowerCase(), k);
    }
    return k;
  }
  private finde(p: string): Knoten | null {
    const { wurzel, segmente } = this.teile(p);
    let k: Knoten = this.wurzel(wurzel);
    for (const s of segmente) {
      if (k.typ !== 'ordner') return null;
      const n = k.kinder.get(this.schluessel(s));
      if (!n) return null;
      k = n;
    }
    return k;
  }
  private elternVon(p: string, anlegen: boolean): { eltern: Knoten & { typ: 'ordner' }; name: string } {
    const r = path.resolve(p);
    const e = path.dirname(r);
    if (anlegen) this.mkdirSync(e);
    const k = this.finde(e);
    if (!k) throw fsFehler('ENOENT', 'eltern', p);
    if (k.typ !== 'ordner') throw fsFehler('ENOTDIR', 'eltern', p);
    return { eltern: k, name: path.basename(r) };
  }
  private mkdirSync(p: string): void {
    const { wurzel, segmente } = this.teile(p);
    let k: Knoten = this.wurzel(wurzel);
    for (const s of segmente) {
      if (k.typ !== 'ordner') throw fsFehler('ENOTDIR', 'mkdir', p);
      let n = k.kinder.get(this.schluessel(s));
      if (!n) {
        n = { typ: 'ordner', name: this.gespeichert(s), kinder: new Map(), mtimeMs: 1_000 };
        k.kinder.set(this.schluessel(s), n);
      }
      if (n.typ === 'datei') throw fsFehler('EEXIST', 'mkdir', p);
      k = n;
    }
  }
  private async schritt(op: string, p: string, p2?: string): Promise<void> {
    this.protokoll.push({ op, p, p2 });
    for (const v of this.vorRegeln) if (v.op === op) v.fn(p, p2);
    const tor = this.tore.find((x) => x.op === op && (x.wann(p) || (p2 !== undefined && x.wann(p2))));
    if (tor) {
      this.tore = this.tore.filter((x) => x !== tor);
      tor.erreicht();
      await tor.warte;
    }
    for (const h of this.haengeRegeln) {
      if (h.op === op && (h.wann(p) || (p2 !== undefined && h.wann(p2)))) {
        this.haengend++;
        await new Promise<never>(() => undefined); // kehrt nie zurück (hängendes Netzlaufwerk)
      }
    }
    for (const f of this.fehlerRegeln) {
      if (f.op === op && f.mal > 0 && (f.wann(p) || (p2 !== undefined && f.wann(p2)))) {
        if (f.ab > 0) { f.ab--; continue; }
        f.mal--;
        throw fsFehler(f.code, op, p);
      }
    }
  }
}

// ── iveo-Attrappen ───────────────────────────────────────────────────────────────────────────────────────────────

/** Misst, wie viele Abrufe und Downloads gleichzeitig laufen (12.4 Nr. 28). */
export class Gleichzeitig {
  jetzt = 0;
  max = 0;
  beginne(): void { this.jetzt++; this.max = Math.max(this.max, this.jetzt); }
  ende(): void { this.jetzt--; }
}

export class AgendaAttrappe implements Pick<IveoClient, 'listAgendaItems'> {
  agenden = new Map<string, IveoAgendaItem[] | Error | (() => Promise<IveoAgendaItem[]>)>();
  aufrufe: string[] = [];
  private g: Gleichzeitig;
  constructor(g: Gleichzeitig) { this.g = g; }
  async listAgendaItems(_event: string, programId: string): Promise<IveoAgendaItem[]> {
    this.aufrufe.push(programId);
    this.g.beginne();
    try {
      const v = this.agenden.get(programId) ?? [];
      if (v instanceof Error) throw v;
      if (typeof v === 'function') return await v();
      return JSON.parse(JSON.stringify(v)) as IveoAgendaItem[];
    } finally {
      this.g.ende();
    }
  }
}

/** Wie ein Download sich verhält (12.4 Kopf „Download-Attrappe“). */
export interface StromArt {
  /** Länge der Daten (Standard 1000 Bytes, alle „a“). */
  bytes?: number;
  /** In so viele Stücke (Standard 1). */
  stuecke?: number;
  /** Die Testuhr rückt je Stück so weit vor (Standard 0). */
  msJeStueck?: number;
  /** Nach so vielen Bytes kommt nichts mehr (Stillstand, bis abgebrochen). */
  stillstandNach?: number;
  /** oeffneAsset wirft diesen Fehler. */
  fehler?: unknown;
  /** Nach jedem Stück (z. B. „fremde Datei taucht auf“). */
  beiStueck?(gesendet: number): void;
  /** oeffneAsset antwortet nicht (keine Kopfzeilen), bis das Signal abbricht. */
  oeffnenHaengt?: boolean;
  /** Jedes Stück kommt erst, wenn die Testuhr so weit vorgerückt ist (Download über mehrere Takte). */
  wartenMs?: number;
}

export class DownloadAttrappe implements Pick<IveoClient, 'oeffneAsset'> {
  arten = new Map<string, StromArt>();
  aufrufe: string[] = [];
  private g: Gleichzeitig;
  private uhr: TestUhr;
  constructor(g: Gleichzeitig, uhr: TestUhr) {
    this.g = g;
    this.uhr = uhr;
  }
  async oeffneAsset(ref: string, opts: { signal?: AbortSignal } = {}): Promise<IveoAssetStrom> {
    this.aufrufe.push(ref);
    const v = this.arten.get(ref) ?? {};
    this.g.beginne();
    let offen = true;
    const fertig = (): void => {
      if (offen) { offen = false; this.g.ende(); }
    };
    if (v.fehler !== undefined) { fertig(); throw v.fehler; }
    if (v.oeffnenHaengt) {
      await new Promise<never>((_ok, nein) => opts.signal?.addEventListener('abort', () => { fertig(); nein(Object.assign(new Error('aborted'), { name: 'AbortError' })); }));
    }
    const gesamt = v.bytes ?? 1000;
    const groesse = Math.max(1, Math.ceil(gesamt / (v.stuecke ?? 1)));
    let gesendet = 0;
    const uhr = this.uhr;
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        if (v.stillstandNach !== undefined && gesendet >= v.stillstandNach) return new Promise<void>(() => undefined);
        if (gesendet >= gesamt) { fertig(); c.close(); return; }
        if (v.wartenMs) await new Promise<void>((ok) => uhr.setTimeout(ok, v.wartenMs as number));
        if (!offen) return;
        const n = Math.min(groesse, gesamt - gesendet);
        if (v.msJeStueck) uhr.t += v.msJeStueck;
        c.enqueue(new Uint8Array(n).fill(0x61));
        gesendet += n;
        v.beiStueck?.(gesendet);
      },
      cancel() { fertig(); },
    }, { highWaterMark: 0 });
    const antwort = { body, contentType: 'application/octet-stream', contentLength: gesamt };
    MITSCHRIFT.antworten.push({ contentType: antwort.contentType, contentLength: antwort.contentLength });
    return antwort;
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const ROOT = path.resolve('/attrappe');
export const SHOW_PFAD = path.join(ROOT, 'Shows', 'COP31 Tag 1.jmshow');
export const BASIS = path.join(ROOT, 'Shows', 'COP31 Tag 1 – Side Events');
export const TOKEN = 'iveo_live_GEHEIM';
export const SIGNIERT = 'https://signed.example/x?X-Amz-Signature=GEHEIM-SIG';
export const MARKER = 'GEHEIM-ASSET';

/** Asset-Referenz in der gemessenen Form (M1): 279 Zeichen, genau ein Punkt, base64url; Marker an drei Stellen oder nur am Ende. */
export function referenz(seed: string, marker: 'ueberall' | 'ende' = 'ueberall'): string {
  let vorrat = '';
  for (let i = 0; vorrat.length < 400; i++) vorrat += createHash('sha256').update(`${seed}:${i}`).digest('base64url');
  const f = (von: number, n: number): string => vorrat.slice(von, von + n);
  const vor = marker === 'ueberall' ? `${MARKER}${f(0, 111)}${MARKER}${f(111, 100)}` : f(0, 235);
  const r = `${vor}.${f(235, 31)}${MARKER}`;
  MITSCHRIFT.referenzen.push(r);
  return r;
}

export function datei(id: string, label: string, o: { mime?: string | null; size?: unknown; ref?: string; purged?: unknown } = {}): IveoMaterial {
  return {
    id, kind: 'file', label,
    asset: { url: o.ref ?? referenz(id), mime_type: o.mime === undefined ? 'application/pdf' : o.mime, size_bytes: (o.size === undefined ? 1000 : o.size) as number },
    ...(o.purged !== undefined ? { purged_at: o.purged } : {}),
  };
}
export function link(id: string, label: string, url: unknown): IveoMaterial {
  return { id, kind: 'link', label, external_url: url as string };
}
export function punkt(programId: string, materials: IveoMaterial[], id = `${programId}-p1`): IveoAgendaItem {
  return { id, program_id: programId, title: 'Punkt', materials };
}
export function showText(sideEvents: ShowIveoProgramRef[], filter: IveoProgramFilter): string {
  const show: Show = {
    schemaVersion: 1, protocol: 'jmps', name: 'COP31 Tag 1', createdAt: '2026-10-16T06:00:00.000Z', updatedAt: '2026-10-16T06:00:00.000Z',
    tools: [], ablauf: [], iveo: { event: 'cop31', baseUrl: 'https://app.my-iveo.de/api/v1', sideEvents, filter },
  } as unknown as Show;
  return serializeShow(show);
}

let SITZUNGEN = 0;

// ── Lauf-Bauer ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface LaufOpt {
  fs?: FsAttrappe; uhr?: TestUhr; g?: Gleichzeitig; rechner?: string; pid?: number;
  sideEvents?: ShowIveoProgramRef[]; filter?: IveoProgramFilter; tage?: Record<string, string>; titel?: Record<string, string>;
  leerlaufMs?: number; downloadClient?: Pick<IveoClient, 'oeffneAsset'>; ohneShowDatei?: boolean;
  /** Echte Uhr und echte Zeitgeber (Download über echtes fetch, 12.4 Nr. 47). */
  echteZeit?: boolean;
}

export function baueLauf(o: LaufOpt = {}) {
  const uhr = o.uhr ?? new TestUhr();
  const fs = o.fs ?? new FsAttrappe('NTFS');
  const g = o.g ?? new Gleichzeitig();
  if (!o.ohneShowDatei && !fs.gibt(SHOW_PFAD)) fs.lege(SHOW_PFAD, showText(o.sideEvents ?? [{ id: 'se-1', title: 'Klima' }], o.filter ?? { programId: 'se-1' }));
  const z = {
    aktiv: { path: SHOW_PFAD, event: 'cop31', filter: o.filter ?? ({ programId: 'se-1' } as IveoProgramFilter) } as { path: string; event: string; filter: IveoProgramFilter } | null,
    rolle: 'aus' as VerbundRolle, token: true, schalter: true,
  };
  const agenda = new AgendaAttrappe(g);
  const download = new DownloadAttrappe(g, uhr);
  const logs: string[] = [];
  const staende: AnhangOrdnerStand[] = [];
  const rechner = o.rechner ?? 'REGIE-1';
  const d: OrdnerLaufAbh = {
    fs,
    jetzt: o.echteZeit ? () => Date.now() : uhr.jetzt,
    setTimeout: o.echteZeit ? (fn, ms) => setTimeout(fn, ms) : uhr.setTimeout,
    clearTimeout: o.echteZeit ? (h) => clearTimeout(h as ReturnType<typeof setTimeout>) : uhr.clearTimeout,
    aktiv: () => z.aktiv, rolle: () => z.rolle, tokenDa: () => z.token, schalterAn: () => z.schalter,
    tagVon: (id) => o.tage?.[id] ?? null, titelVon: (id) => o.titel?.[id] ?? null,
    agendaClient: () => agenda, downloadClient: () => o.downloadClient ?? download,
    rechner, pid: o.pid ?? 4711, neueSitzungsKennung: () => `sitzung-${++SITZUNGEN}`,
    log: { info: (m) => logs.push(`info ${m}`), warn: (m) => logs.push(`warn ${m}`) },
    melde: (s) => staende.push(JSON.parse(JSON.stringify(s)) as AnhangOrdnerStand),
    taktMs: 45_000, leerlaufMs: o.leerlaufMs ?? 60_000,
  };
  const lauf = erzeugeOrdnerLauf(d);
  MITSCHRIFT.logs.push(logs);
  MITSCHRIFT.staende.push(staende);
  return {
    lauf, d, fs, uhr, g, z, agenda, download, logs, staende,
    /** Ein Takt wie die Hülle: Agenda des aktiven Side Events melden (8.2), dann takt(), dann warten, bis alles ruht. */
    async takt(aktivAgenda?: IveoAgendaItem[] | Error): Promise<void> {
      const id = z.aktiv?.filter.programId;
      if (aktivAgenda !== undefined && id) {
        const e: AgendaErgebnis = aktivAgenda instanceof Error ? { ok: false, fehler: aktivAgenda } : { ok: true, agenda: aktivAgenda, abgerufen: new Date(d.jetzt()).toISOString() };
        lauf.agendaAktiv(id, e);
      }
      lauf.takt();
      await lauf.ruhig();
    },
    se(id: string) {
      return lauf.stand().sideEvents.find((s) => s.programId === id);
    },
  };
}

// ── Ende der Attrappe ──
