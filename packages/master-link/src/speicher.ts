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

/**
 * Spec 7.3: nur ENOENT heißt „nicht vorhanden“, jeder andere I/O-Fehler ist vorübergehend (`io`, auch der der .bak —
 * sonst gälte die Installation als frisch und der Master erzeugte still neu). `fehlt` gibt es NUR, wenn weder die
 * Hauptdatei noch die .bak existieren; ist eine von beiden da, aber keine brauchbar, heißt es `beschaedigt`.
 */
export function leseMitBak<T>(pfad: string, pruefe: (raw: unknown) => T | null): SpeicherLesen<T> {
  const haupt = leseEine(pfad, pruefe);
  if (haupt.art === 'ok') return { art: 'ok', wert: haupt.wert, ausBak: false };
  if (haupt.art === 'io') return haupt;
  const bak = leseEine(`${pfad}.bak`, pruefe);
  if (bak.art === 'ok') return { art: 'ok', wert: bak.wert, ausBak: true };
  if (bak.art === 'io') return bak;
  return haupt.art === 'fehlt' && bak.art === 'fehlt' ? { art: 'fehlt' } : { art: 'beschaedigt' };
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
  /** Nach jeder erfolgreichen Schreibung: der Master löscht damit einen geführten Schreibfehler (A8). */
  private readonly onGespeichert: () => void;
  private letzteSchreibung = 0;
  private offen = false;
  private geschlossen = false;
  private zeitgeber: ReturnType<typeof setTimeout> | null = null;

  constructor(
    pfad: string,
    anfangs: VerbundDaten,
    opts: { jetzt?: () => number; schreibIntervallMs?: number; onFehler?: (e: Error) => void; onGespeichert?: () => void } = {},
  ) {
    super(anfangs.rechner);
    this.pfad = pfad;
    this.jetzt = opts.jetzt ?? Date.now;
    this.intervall = opts.schreibIntervallMs ?? 60_000;
    // Die Produktion (MasterRolle) übergibt onFehler mit ihrem Log. Ohne: nie spurlos — nur der Fehlercode, nie der Inhalt.
    this.onFehler = opts.onFehler ?? ((e) => {
      console.warn(`[master-link] Verbund nicht gespeichert: ${(e as NodeJS.ErrnoException).code ?? 'EIO'}`);
    });
    this.onGespeichert = opts.onGespeichert ?? (() => {});
  }

  // Nach schliesse() endgültig still: späte Ereignisse einer gestoppten MasterRolle schreiben nichts mehr (A7).
  protected override gespeichert(): void {
    if (this.geschlossen) return;
    this.schreibe();
  }

  protected override gesehenGeaendert(sofort: boolean): void {
    if (this.geschlossen) return;
    const seit = this.jetzt() - this.letzteSchreibung;
    if (sofort || seit >= this.intervall) {
      this.schreibe();
      return;
    }
    this.offen = true;
    this.armiere(this.intervall - seit);
  }

  private armiere(ms: number): void {
    if (this.zeitgeber) return;
    this.zeitgeber = setTimeout(() => {
      this.zeitgeber = null;
      if (this.offen) this.schreibe();
    }, ms);
    this.zeitgeber.unref?.();
  }

  private schreibe(): void {
    try {
      schreibeMitBak(this.pfad, `${JSON.stringify({ version: 1, rechner: this.eintraege }, null, 2)}\n`, pruefeVerbund);
    } catch (e) {
      // Nichts ging verloren, solange `offen` bleibt: der Zeitgeber versucht es nach dem Intervall erneut — auch eine
      // fehlgeschlagene Kopplung (setze) oder ein „zuletzt gesehen“, an dem sich sonst nichts mehr ändert.
      // Auch ein Fehlversuch zählt für die Drosselung: sonst löste bei Dauerfehler jedes gesehen(…, false) (jeder Heartbeat)
      // sofort einen Versuch samt onFehler aus — Log-Flut, und bei EPERM/EBUSY blockiert schreibeAtomar je Versuch bis zu 2 s.
      this.offen = true;
      this.letzteSchreibung = this.jetzt();
      if (!this.geschlossen) this.armiere(this.intervall);
      this.onFehler(e as Error);
      return;
    }
    this.offen = false;
    this.letzteSchreibung = this.jetzt();
    this.onGespeichert();
  }

  schliesse(): void {
    this.geschlossen = true;
    if (this.zeitgeber) {
      clearTimeout(this.zeitgeber);
      this.zeitgeber = null;
    }
    if (this.offen) this.schreibe();
  }
}
