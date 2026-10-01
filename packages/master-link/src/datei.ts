import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fingerprintVonPem, istEd25519Oeffentlich, istEd25519Privat, type Schluesselpaar } from './beweis';
import { MASTER_PORT, SUITE_ORDNER } from './fristen';

// master-link.json (Spec 7.1, 7.3): gemeinsam je Rechner, nur der Launcher schreibt.
// Anders als control-config: atomar schreiben, und „defekt“ ist NICHT „leer“.

export interface Kopplung {
  masterId: string;
  masterName: string;
  fingerprint: string;
  zertifikat: string;
  port: number;
  adressen: string[];
  letzteAdresse: string | null;
  festeAdresse: string | null;
  schluessel: Schluesselpaar;
}

export type Rolle = 'aus' | 'master' | 'slave';

export interface MasterLinkDatei {
  version: 1;
  rolle: Rolle;
  rechner: { id: string; name: string };
  netzwerk: { karte: string | null };
  kopplung: Kopplung | null;
}

export function masterLinkPfad(appDataDir: string): string {
  return join(appDataDir, SUITE_ORDNER, 'master-link.json');
}

export type DateiPruefung = { ok: true; datei: MasterLinkDatei } | { ok: false; grund: string };

type Objekt = Record<string, unknown>;
const istObj = (v: unknown): v is Objekt => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function pruefeMasterLinkDatei(raw: unknown): DateiPruefung {
  if (!istObj(raw)) return { ok: false, grund: 'kein Objekt' };
  if (raw.version !== 1) return { ok: false, grund: 'version' };
  const rolle = raw.rolle;
  if (rolle !== 'aus' && rolle !== 'master' && rolle !== 'slave') return { ok: false, grund: 'rolle' };
  if (!istObj(raw.rechner) || !text(raw.rechner.id) || typeof raw.rechner.name !== 'string') return { ok: false, grund: 'rechner' };
  const karteRoh = istObj(raw.netzwerk) ? raw.netzwerk.karte : null;
  if (karteRoh !== null && karteRoh !== undefined && typeof karteRoh !== 'string') return { ok: false, grund: 'netzwerk' };
  const karte = typeof karteRoh === 'string' && karteRoh.length > 0 ? karteRoh : null;

  let kopplung: Kopplung | null = null;
  if (raw.kopplung !== null && raw.kopplung !== undefined) {
    const k = raw.kopplung;
    if (!istObj(k) || !text(k.masterId) || !text(k.fingerprint) || !text(k.zertifikat)
      || !istObj(k.schluessel) || !text(k.schluessel.privat) || !text(k.schluessel.oeffentlich)) {
      return { ok: false, grund: 'kopplung unvollständig' };
    }
    let fp: string;
    try {
      fp = fingerprintVonPem(k.zertifikat);
    } catch {
      return { ok: false, grund: 'zertifikat unlesbar' };
    }
    if (fp !== k.fingerprint) return { ok: false, grund: 'fingerprint passt nicht zum zertifikat' };
    // GEMESSEN: privat 'AAAA' bestand „nicht leer“, signiereAnmeldung warf dann im Handler — jedes Tool stürzte ab.
    if (!istEd25519Privat(k.schluessel.privat) || !istEd25519Oeffentlich(k.schluessel.oeffentlich)) {
      return { ok: false, grund: 'schluessel unbrauchbar' };
    }
    const port = typeof k.port === 'number' && Number.isInteger(k.port) && k.port > 0 && k.port < 65536 ? k.port : MASTER_PORT;
    kopplung = {
      masterId: k.masterId,
      masterName: typeof k.masterName === 'string' ? k.masterName : '',
      fingerprint: k.fingerprint,
      zertifikat: k.zertifikat,
      port,
      adressen: Array.isArray(k.adressen) ? k.adressen.filter((a): a is string => typeof a === 'string') : [],
      letzteAdresse: typeof k.letzteAdresse === 'string' && k.letzteAdresse ? k.letzteAdresse : null,
      festeAdresse: typeof k.festeAdresse === 'string' && k.festeAdresse.trim() ? k.festeAdresse.trim() : null,
      schluessel: { privat: k.schluessel.privat, oeffentlich: k.schluessel.oeffentlich },
    };
  }
  return {
    ok: true,
    datei: { version: 1, rolle, rechner: { id: raw.rechner.id, name: raw.rechner.name }, netzwerk: { karte }, kopplung },
  };
}

export type Lesen<T> = { art: 'fehlt' } | { art: 'ok'; wert: T } | { art: 'defekt'; grund: string } | { art: 'io'; code: string };

export function leseMasterLinkDatei(pfad: string): Lesen<MasterLinkDatei> {
  let inhalt: string;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? 'EIO';
    return code === 'ENOENT' ? { art: 'fehlt' } : { art: 'io', code };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(inhalt);
  } catch {
    // Die JSON.parse-Meldung NICHT weitergeben: sie zitiert bis zu 10 Zeichen der Datei.
    return { art: 'defekt', grund: 'json' };
  }
  const p = pruefeMasterLinkDatei(roh);
  return p.ok ? { art: 'ok', wert: p.datei } : { art: 'defekt', grund: p.grund };
}

const WIEDERHOLBAR = new Set(['EPERM', 'EBUSY', 'EACCES']);

function schlafeSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Temp-Datei im selben Ordner, fsync, rename. Windows: rename bei EPERM/EBUSY/EACCES bis 2 s wiederholen
 * (Virenscanner/Indexer halten die Datei kurz offen). `umbenennen` ist nur für den Test injizierbar.
 */
export function schreibeAtomar(
  pfad: string,
  inhalt: string,
  umbenennen: (von: string, nach: string) => void = renameSync,
): void {
  mkdirSync(dirname(pfad), { recursive: true });
  const temp = `${pfad}.${process.pid}.${Date.now()}.tmp`;
  const fd = openSync(temp, 'w', 0o600);
  try {
    writeSync(fd, inhalt);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  const bis = Date.now() + 2000;
  for (;;) {
    try {
      umbenennen(temp, pfad);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (!WIEDERHOLBAR.has(code) || Date.now() >= bis) {
        try {
          unlinkSync(temp);
        } catch {
          /* Temp-Datei ist schon weg */
        }
        throw e;
      }
      schlafeSync(50);
    }
  }
}

export function schreibeMasterLinkDatei(pfad: string, d: MasterLinkDatei): void {
  schreibeAtomar(pfad, `${JSON.stringify(d, null, 2)}\n`);
}

function relevanteFelder(d: MasterLinkDatei | null): string {
  if (!d) return 'null';
  const k = d.kopplung;
  return JSON.stringify([
    d.rolle, d.rechner.id, d.netzwerk.karte,
    k ? [k.masterId, k.fingerprint, k.zertifikat, k.schluessel.privat, k.schluessel.oeffentlich, k.festeAdresse, k.port] : null,
  ]);
}

/** Spec 7.1: nur diese Felder bauen die Verbindung neu auf; Adressen/Namen fließen ohne Trennung ein. */
export function verbindungsrelevantGeaendert(a: MasterLinkDatei | null, b: MasterLinkDatei | null): boolean {
  return relevanteFelder(a) !== relevanteFelder(b);
}

export type Beobachtung =
  | { art: 'unveraendert' }
  | { art: 'geaendert'; datei: MasterLinkDatei | null; relevant: boolean }
  | { art: 'defekt' };

/**
 * Prüft die Datei per mtime. Erst ZWEI Fehllesungen in Folge (Parse-Fehler/Defekt) gelten als defekt (Spec 7.3).
 * Jeder andere I/O-Fehler ist vorübergehend: letzter gültiger Stand bleibt, der nächste Takt liest erneut.
 */
export class DateiBeobachter {
  private readonly pfad: string;
  private mtime: number | null = null;
  private stand: MasterLinkDatei | null = null;
  private fehlversuche = 0;
  private erstmals = true;
  private warDefekt = false;
  private readonly log: (text: string) => void;
  /** Zuletzt geloggter I/O-Code; null = seitdem erfolgreich gelesen (der nächste Fehler wird wieder geloggt). */
  private ioGeloggt: string | null = null;

  /** `log`: I/O- und stat-Fehler je Codewechsel einmal melden — sonst zeigt ein Tool mit unlesbarer Datei stumm „aus“ (A9). */
  constructor(pfad: string, log: (text: string) => void = () => {}) {
    this.pfad = pfad;
    this.log = log;
  }

  aktuell(): MasterLinkDatei | null {
    return this.stand;
  }

  /** Nur der Code, nie Inhalt oder Meldung (die kann Pfade/Fremdtext zitieren). */
  private ioFehler(code: string): Beobachtung {
    if (code !== this.ioGeloggt) {
      this.ioGeloggt = code;
      this.log(`master-link.json nicht lesbar (${code.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || 'EIO'}); der letzte gültige Stand bleibt.`);
    }
    return { art: 'unveraendert' };
  }

  pruefe(): Beobachtung {
    let mtime: number | null;
    try {
      mtime = statSync(this.pfad).mtimeMs;
    } catch (e) {
      // EBUSY/EPERM (Virenscanner, Indexer) sind vorübergehend — kein Fehlversuch, nichts gemerkt.
      const code = (e as NodeJS.ErrnoException).code ?? 'EIO';
      if (code !== 'ENOENT') return this.ioFehler(code);
      mtime = null;
    }
    if (!this.erstmals && this.fehlversuche === 0 && mtime === this.mtime) return { art: 'unveraendert' };
    if (mtime === null) return this.uebernimm(null, null);
    const r = leseMasterLinkDatei(this.pfad);
    if (r.art === 'ok') return this.uebernimm(r.wert, mtime);
    if (r.art === 'fehlt') return this.uebernimm(null, null);
    // mtime erst nach erfolgreichem Lesen merken: so liest der nächste Takt erneut, auch beim ersten Lesen.
    if (r.art === 'io') return this.ioFehler(r.code);
    return this.fehlschlag();
  }

  private uebernimm(datei: MasterLinkDatei | null, mtime: number | null): Beobachtung {
    this.ioGeloggt = null;
    const relevant = this.erstmals || this.warDefekt || verbindungsrelevantGeaendert(this.stand, datei);
    const geaendert = relevant || JSON.stringify(this.stand) !== JSON.stringify(datei);
    this.erstmals = false;
    this.warDefekt = false;
    this.fehlversuche = 0;
    this.mtime = mtime;
    this.stand = datei;
    return geaendert ? { art: 'geaendert', datei, relevant } : { art: 'unveraendert' };
  }

  private fehlschlag(): Beobachtung {
    this.fehlversuche++;
    if (this.fehlversuche < 2) return { art: 'unveraendert' };
    this.warDefekt = true;
    return { art: 'defekt' };
  }
}
