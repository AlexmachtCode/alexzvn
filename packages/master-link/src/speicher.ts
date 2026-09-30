import { createPrivateKey, X509Certificate } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { createSecureContext } from 'node:tls';
import { fingerprintVonPem } from './beweis';
import { schreibeAtomar } from './datei';

// Speicher des Masters (Spec 7.2, 7.3): identitaet.json + verbund.json, je mit .bak.
// „Fehlt“ und „beschädigt“ werden unterschieden — eine gestörte Datei entkoppelt nie still.

export interface Identitaet {
  masterId: string;
  name: string;
  /** PEM-Zertifikat. */
  zertifikat: string;
  /** PEM-Privatschlüssel des Zertifikats. */
  schluessel: string;
}

export interface VerbundEintrag {
  rechnerId: string;
  name: string;
  /** Öffentlicher Ed25519-Schlüssel (SPKI-DER base64) — der Master hält kein Geheimnis der Slaves. */
  schluessel: string;
  gekoppeltAm: number;
  zuletztGesehen: number | null;
  letzteAdresse: string | null;
  dieserRechner: boolean;
}

export interface VerbundDaten {
  version: 1;
  rechner: VerbundEintrag[];
}

type Objekt = Record<string, unknown>;
const istObj = (v: unknown): v is Objekt => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function pruefeIdentitaet(raw: unknown): Identitaet | null {
  if (!istObj(raw)) return null;
  const { masterId, name, zertifikat, schluessel } = raw;
  if (!text(masterId) || typeof name !== 'string' || !text(zertifikat) || !text(schluessel)) return null;
  try {
    fingerprintVonPem(zertifikat);
    // GEMESSEN (Spec 7.2): ein unlesbarer oder fremder Schlüssel oder ein kaputter 2. Zertifikatsblock ließ server.starte()
    // scheitern (ewig „lausch-fehler“, .bak nie versucht). Ein Ed25519-Schlüssel zum RSA-Zertifikat besteht
    // createSecureContext: der Master „läuft“, aber jeder Handshake scheitert. Beides heißt hier „beschädigt“.
    if (!new X509Certificate(zertifikat).checkPrivateKey(createPrivateKey(schluessel))) return null;
    createSecureContext({ key: schluessel, cert: zertifikat });
  } catch {
    return null;
  }
  return { masterId, name, zertifikat, schluessel };
}

export function pruefeVerbund(raw: unknown): VerbundDaten | null {
  if (!istObj(raw) || raw.version !== 1 || !Array.isArray(raw.rechner)) return null;
  const rechner: VerbundEintrag[] = [];
  for (const e of raw.rechner) {
    if (!istObj(e) || !text(e.rechnerId) || typeof e.name !== 'string' || !text(e.schluessel) || typeof e.gekoppeltAm !== 'number') {
      return null;
    }
    rechner.push({
      rechnerId: e.rechnerId,
      name: e.name,
      schluessel: e.schluessel,
      gekoppeltAm: e.gekoppeltAm,
      zuletztGesehen: typeof e.zuletztGesehen === 'number' ? e.zuletztGesehen : null,
      letzteAdresse: typeof e.letzteAdresse === 'string' ? e.letzteAdresse : null,
      dieserRechner: e.dieserRechner === true,
    });
  }
  return { version: 1, rechner };
}

export type SpeicherLesen<T> =
  | { art: 'fehlt' }
  | { art: 'ok'; wert: T; ausBak: boolean }
  | { art: 'beschaedigt' }
  | { art: 'io'; code: string };

type Einzeln<T> = { art: 'fehlt' } | { art: 'ok'; wert: T } | { art: 'beschaedigt' } | { art: 'io'; code: string };

function leseEine<T>(pfad: string, pruefe: (raw: unknown) => T | null): Einzeln<T> {
  let inhalt: string;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? 'EIO';
    return code === 'ENOENT' ? { art: 'fehlt' } : { art: 'io', code };
  }
  try {
    const wert = pruefe(JSON.parse(inhalt));
    return wert ? { art: 'ok', wert } : { art: 'beschaedigt' };
  } catch {
    return { art: 'beschaedigt' };
  }
}

export function leseMitBak<T>(pfad: string, pruefe: (raw: unknown) => T | null): SpeicherLesen<T> {
  const haupt = leseEine(pfad, pruefe);
  if (haupt.art === 'ok') return { art: 'ok', wert: haupt.wert, ausBak: false };
  if (haupt.art === 'io') return haupt;
  const bak = leseEine(`${pfad}.bak`, pruefe);
  if (bak.art === 'ok') return { art: 'ok', wert: bak.wert, ausBak: true };
  return haupt.art === 'fehlt' ? { art: 'fehlt' } : { art: 'beschaedigt' };
}

/** Vorhandene GÜLTIGE Fassung wird zuerst zur .bak, dann wird atomar ersetzt. */
export function schreibeMitBak<T>(pfad: string, inhalt: string, pruefe: (raw: unknown) => T | null): void {
  if (leseEine(pfad, pruefe).art === 'ok') schreibeAtomar(`${pfad}.bak`, readFileSync(pfad, 'utf8'));
  schreibeAtomar(pfad, inhalt);
}

export function loescheMitBak(pfad: string): void {
  rmSync(pfad, { force: true });
  rmSync(`${pfad}.bak`, { force: true });
}

export interface VerbundSpeicher {
  liste(): VerbundEintrag[];
  finde(rechnerId: string): VerbundEintrag | undefined;
  /** Ersetzt den Eintrag gleicher rechnerId oder hängt an. */
  setze(e: VerbundEintrag): void;
  /** Ersetzt den Eintrag „dieser Rechner“ (auch bei neuer rechnerId). */
  setzeDiesenRechner(e: VerbundEintrag): void;
  /** „dieser Rechner“ ist nicht entfernbar (no-op). */
  entferne(rechnerId: string): void;
  entferneFremde(): void;
  gesehen(rechnerId: string, zeit: number, adresse: string | null, sofort: boolean): void;
}

export class SpeicherVerbund implements VerbundSpeicher {
  protected eintraege: VerbundEintrag[];

  constructor(anfangs: VerbundEintrag[] = []) {
    this.eintraege = anfangs.map((e) => ({ ...e }));
  }

  liste(): VerbundEintrag[] {
    return this.eintraege.map((e) => ({ ...e }));
  }

  finde(rechnerId: string): VerbundEintrag | undefined {
    const e = this.eintraege.find((x) => x.rechnerId === rechnerId);
    return e ? { ...e } : undefined;
  }

  setze(e: VerbundEintrag): void {
    const i = this.eintraege.findIndex((x) => x.rechnerId === e.rechnerId);
    if (i >= 0) this.eintraege[i] = { ...e };
    else this.eintraege.push({ ...e });
    this.gespeichert();
  }

  setzeDiesenRechner(e: VerbundEintrag): void {
    this.eintraege = [{ ...e, dieserRechner: true }, ...this.eintraege.filter((x) => !x.dieserRechner && x.rechnerId !== e.rechnerId)];
    this.gespeichert();
  }

  entferne(rechnerId: string): void {
    const vorher = this.eintraege.length;
    this.eintraege = this.eintraege.filter((x) => x.rechnerId !== rechnerId || x.dieserRechner);
    if (this.eintraege.length !== vorher) this.gespeichert();
  }

  entferneFremde(): void {
    this.eintraege = this.eintraege.filter((x) => x.dieserRechner);
    this.gespeichert();
  }

  gesehen(rechnerId: string, zeit: number, adresse: string | null, sofort: boolean): void {
    const e = this.eintraege.find((x) => x.rechnerId === rechnerId);
    if (!e) return;
    e.zuletztGesehen = zeit;
    if (adresse) e.letzteAdresse = adresse;
    this.gesehenGeaendert(sofort);
  }

  protected gespeichert(): void {
    /* im Speicher: nichts zu tun */
  }

  protected gesehenGeaendert(_sofort: boolean): void {
    /* im Speicher: nichts zu tun */
  }
}

export class DateiVerbund extends SpeicherVerbund {
  private readonly pfad: string;
  private readonly jetzt: () => number;
  private readonly intervall: number;
  private readonly onFehler: (e: Error) => void;
  private letzteSchreibung = 0;
  private offen = false;
  private zeitgeber: ReturnType<typeof setTimeout> | null = null;

  constructor(
    pfad: string,
    anfangs: VerbundDaten,
    opts: { jetzt?: () => number; schreibIntervallMs?: number; onFehler?: (e: Error) => void } = {},
  ) {
    super(anfangs.rechner);
    this.pfad = pfad;
    this.jetzt = opts.jetzt ?? Date.now;
    this.intervall = opts.schreibIntervallMs ?? 60_000;
    this.onFehler = opts.onFehler ?? (() => {});
  }

  protected override gespeichert(): void {
    this.schreibe();
  }

  protected override gesehenGeaendert(sofort: boolean): void {
    const seit = this.jetzt() - this.letzteSchreibung;
    if (sofort || seit >= this.intervall) {
      this.schreibe();
      return;
    }
    this.offen = true;
    if (!this.zeitgeber) {
      this.zeitgeber = setTimeout(() => {
        this.zeitgeber = null;
        if (this.offen) this.schreibe();
      }, this.intervall - seit);
      this.zeitgeber.unref?.();
    }
  }

  private schreibe(): void {
    this.offen = false;
    this.letzteSchreibung = this.jetzt();
    try {
      schreibeMitBak(this.pfad, `${JSON.stringify({ version: 1, rechner: this.eintraege }, null, 2)}\n`, pruefeVerbund);
    } catch (e) {
      this.onFehler(e as Error);
    }
  }

  schliesse(): void {
    if (this.zeitgeber) {
      clearTimeout(this.zeitgeber);
      this.zeitgeber = null;
    }
    if (this.offen) this.schreibe();
  }
}
