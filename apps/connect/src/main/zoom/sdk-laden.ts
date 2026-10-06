// Zoom-SDK nachladen (Spec 2026-10-06, Abschnitt 4.3): Link beim Proxy holen, ZIP laden und dabei SHA-256
// rechnen, mit Windows' tar.exe entpacken. Ohne Electron, rein wie laufzeit.ts: node:-Module und relative
// Importe. fetch, Uhr, Schreibziel, Prozessstart und Plattform sind einspeisbar (test/sdk-laden.test.ts).
//
// GEHEIMNISSE: Der SDK-Schlüssel geht nur in den Header X-Zoom-Sdk-Key, und nur über https (an die eigene
// Maschine auch http). Der signierte Link geht nur in fetch. Kein Ergebnis trägt einen von beiden: `grund` ist
// immer ein Code (ENOTFOUND, UND_ERR_SOCKET, „HTTP 503“, „Exit 1“) oder ein fester Text, nie eine
// Fehlermeldung (die könnte den Link zitieren).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { open, statfs } from 'node:fs/promises';
import { dirname, win32 } from 'node:path';
import { KT } from './klartext';
import { freierPlatz } from './laufzeit';

/**
 * Arbeitsordner unter `zoom-laufzeit` (Spec 4.3 Schritt 4). Stört die Laufzeit nicht: pruefeLaufzeit liest nur
 * `<basis>/<SDK_FASSUNG>`, und das Aufräumen in richteEin löscht nur Geschwister mit gültigem Stempel
 * (`jm-zoom-laufzeit.json` in deren Wurzel); in `laden` liegen nur das ZIP und der Unterordner `sdk`.
 */
export const LADE_ORDNER = 'laden';
/** Fortschritt höchstens 4-mal je Sekunde (Spec 4.3). */
export const FORTSCHRITT_TAKT_MS = 250;
/** Fehlt Retry-After oder ist er unbrauchbar: eine Minute. */
const WARTEN_VORGABE_S = 60;

/** Fehlerarten (Spec 4.3); die Texte dazu liefert ladeFehlerText (Spec 5). */
export type LadeFehler =
  | { ok: false; art: 'schluessel' | 'fehlt' | 'pruefsumme' | 'abgebrochen' }
  | { ok: false; art: 'gedrosselt'; sekunden: number }
  | { ok: false; art: 'proxy' | 'unvollstaendig' | 'entpacken'; grund: string };
export type LinkErgebnis = { ok: true; url: string; size: number } | LadeFehler;
export type LadeErgebnis = { ok: true } | LadeFehler;
export type EntpackErgebnis = { ok: true } | LadeFehler;

/** Ein gestarteter Kindprozess, so weit entpacke() ihn braucht. */
export interface KindProzess {
  on(ereignis: 'error', f: (e: Error) => void): unknown;
  on(ereignis: 'close', f: (code: number | null) => void): unknown;
  kill(): boolean;
}

/** Die Datei `<ziel>.teil`, so weit lade() sie braucht (FileHandle erfüllt das). */
export interface Schreibziel {
  /** Darf weniger als `laenge` Bytes schreiben; lade() schiebt den Rest nach. */
  write(daten: Uint8Array, versatz: number, laenge: number): Promise<{ bytesWritten: number }>;
  close(): Promise<void>;
}

/** Einspeisbare Werkzeuge (Tests: Netz, Uhr, Schreibziel, Prozessstart, Plattform). */
export interface LadeWerkzeuge {
  fetch: typeof fetch;
  /** Millisekunden; nur für die Drossel des Fortschritts. */
  jetzt(): number;
  /** Öffnet `<ziel>.teil` zum Schreiben (neu oder geleert). */
  oeffne(pfad: string): Promise<Schreibziel>;
  /** Startet ohne Shell, ohne Fenster, ohne Ein- und Ausgabe. */
  starte(befehl: string, args: readonly string[]): KindProzess;
  plattform: string;
  /** %SystemRoot%, z. B. C:\Windows. */
  systemRoot: string | undefined;
}

function werkzeuge(w?: Partial<LadeWerkzeuge>): LadeWerkzeuge {
  return {
    fetch: (eingabe, init) => fetch(eingabe, init),
    jetzt: () => Date.now(),
    oeffne: (pfad) => open(pfad, 'w'),
    starte: (befehl, args) => spawn(befehl, [...args], { shell: false, windowsHide: true, stdio: 'ignore' }),
    plattform: process.platform,
    systemRoot: process.env.SystemRoot,
    ...w,
  };
}

/** Ohne TLS darf der SDK-Schlüssel nur an die eigene Maschine (Test, wrangler dev). */
const EIGENE_MASCHINE = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Nur ein Code, nie die Meldung (sie könnte einen Link tragen): cause.code > code > name > „unbekannt“. */
export function fehlerCode(e: unknown): string {
  if (typeof e !== 'object' || e === null) return 'unbekannt';
  const x = e as { code?: unknown; name?: unknown; cause?: { code?: unknown } | null };
  if (typeof x.cause === 'object' && x.cause !== null && typeof x.cause.code === 'string') return x.cause.code;
  if (typeof x.code === 'string') return x.code;
  return typeof x.name === 'string' && x.name ? x.name : 'unbekannt';
}

function wartezeit(kopf: string | null): number {
  const s = Number(kopf);
  return Number.isFinite(s) && s >= 1 ? Math.ceil(s) : WARTEN_VORGABE_S;
}

/** Spec 4.3: den kurzlebigen Link beim Proxy holen. Ein Proxy-Schlüssel wird nicht gebraucht. */
export async function holeLink(e: {
  base: string;
  schluessel: string;
  fassung: string;
  signal: AbortSignal;
  werkzeuge?: Partial<LadeWerkzeuge>;
}): Promise<LinkErgebnis> {
  const w = werkzeuge(e.werkzeuge);
  let ziel: URL;
  try {
    ziel = new URL(`${e.base}/zoom-sdk/${encodeURIComponent(e.fassung)}`);
  } catch {
    return { ok: false, art: 'proxy', grund: 'Adresse ungültig' };
  }
  // Der SDK-Schlüssel geht nie im Klartext übers Netz (JMPS_PROXY_URL und die Einstellung erlauben http://).
  if (ziel.protocol !== 'https:' && !(ziel.protocol === 'http:' && EIGENE_MASCHINE.has(ziel.hostname))) {
    return { ok: false, art: 'proxy', grund: 'kein HTTPS' };
  }
  try {
    const res = await w.fetch(ziel, {
      headers: { 'X-Zoom-Sdk-Key': e.schluessel },
      signal: e.signal,
    });
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => undefined);
      if (res.status === 401) return { ok: false, art: 'schluessel' };
      if (res.status === 404) return { ok: false, art: 'fehlt' };
      if (res.status === 429) return { ok: false, art: 'gedrosselt', sekunden: wartezeit(res.headers.get('Retry-After')) };
      return { ok: false, art: 'proxy', grund: `HTTP ${res.status}` };
    }
    // Netzfehler beim Lesen gehen als Code in den catch; kein JSON ist „Antwort ungültig“, kein JS-Fehlername.
    const roh = await res.text();
    let j: { url?: unknown; size?: unknown } | null = null;
    try {
      j = JSON.parse(roh) as { url?: unknown; size?: unknown } | null;
    } catch {
      j = null;
    }
    if (typeof j?.url !== 'string' || !j.url || typeof j.size !== 'number' || !Number.isSafeInteger(j.size)) {
      return { ok: false, art: 'proxy', grund: 'Antwort ungültig' };
    }
    return { ok: true, url: j.url, size: j.size };
  } catch (err) {
    return e.signal.aborted ? { ok: false, art: 'abgebrochen' } : { ok: false, art: 'proxy', grund: fehlerCode(err) };
  }
}

/**
 * Spec 4.3: streamt nach `<ziel>.teil`, rechnet SHA-256 mit und meldet den Fortschritt höchstens alle 250 ms.
 * Erst wenn Länge UND Prüfsumme stimmen, wird umbenannt. Bei Fehler oder Abbruch ist `.teil` weg. Mehr Bytes
 * als gepinnt bricht sofort ab (die Platte läuft nicht voll). `size` (vom Proxy) muss der gepinnten Größe
 * gleichen, sonst liegt dort ein anderes Paket (`fehlt`), und es wird gar nicht erst geladen.
 */
export async function lade(e: {
  url: string;
  size: number;
  ziel: string;
  erwartet: { bytes: number; sha256: string };
  signal: AbortSignal;
  fortschritt: (bytes: number) => void;
  /** Der Strom ist zu Ende, jetzt wird geprüft (Phase „pruefen“). */
  beimPruefen?: () => void;
  werkzeuge?: Partial<LadeWerkzeuge>;
}): Promise<LadeErgebnis> {
  if (e.size !== e.erwartet.bytes) return { ok: false, art: 'fehlt' };
  const w = werkzeuge(e.werkzeuge);
  const teil = `${e.ziel}.teil`;
  const offen: { datei: Schreibziel | null } = { datei: null };
  const strom = async (): Promise<LadeErgebnis> => {
    mkdirSync(dirname(teil), { recursive: true });
    const res = await w.fetch(e.url, { signal: e.signal });
    if (res.status !== 200 || res.body === null) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, art: 'unvollstaendig', grund: `HTTP ${res.status}` };
    }
    offen.datei = await w.oeffne(teil);
    const hash = createHash('sha256');
    const leser = res.body.getReader();
    let bytes = 0;
    let zuletzt = Number.NEGATIVE_INFINITY;
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > e.erwartet.bytes) {
        await leser.cancel().catch(() => undefined);
        return { ok: false, art: 'unvollstaendig', grund: 'zu groß' };
      }
      hash.update(value);
      // Der SHA läuft über den Strom: Die Datei muss darum jedes Byte bekommen, auch bei Teil-Schreibvorgängen.
      for (let versatz = 0; versatz < value.byteLength; ) {
        const { bytesWritten } = await offen.datei.write(value, versatz, value.byteLength - versatz);
        if (bytesWritten <= 0) throw Object.assign(new Error('Schreiben ohne Fortschritt'), { code: 'EIO' });
        versatz += bytesWritten;
      }
      const t = w.jetzt();
      if (t - zuletzt >= FORTSCHRITT_TAKT_MS) {
        zuletzt = t;
        e.fortschritt(bytes);
      }
    }
    await offen.datei.close();
    offen.datei = null;
    e.beimPruefen?.();
    if (bytes !== e.erwartet.bytes) return { ok: false, art: 'unvollstaendig', grund: 'unvollständig' };
    if (hash.digest('hex') !== e.erwartet.sha256) return { ok: false, art: 'pruefsumme' };
    renameSync(teil, e.ziel);
    return { ok: true };
  };
  let erg: LadeErgebnis;
  try {
    erg = await strom();
  } catch (err) {
    erg = e.signal.aborted ? { ok: false, art: 'abgebrochen' } : { ok: false, art: 'unvollstaendig', grund: fehlerCode(err) };
  }
  if (offen.datei !== null) await offen.datei.close().catch(() => undefined);
  if (!erg.ok) {
    try {
      rmSync(teil, { force: true });
    } catch {
      // Bleibt .teil liegen, räumt der Kern den ganzen Arbeitsordner (und loggt, falls auch das scheitert).
    }
  }
  return erg;
}

/**
 * Spec 4.3: `%SystemRoot%\System32\tar.exe -xf <zip> -C <ordner>` mit absolutem Pfad, ohne Shell. Exit-Code
 * ungleich 0, fehlende tar.exe oder Abbruch → `entpacken`. bsdtar lehnt absolute Pfade und `..` ab; das ZIP ist
 * hier schon gegen den gepinnten SHA geprüft. Zoom gibt es nur unter Windows: anderswo sofort `entpacken`.
 */
export function entpacke(e: {
  zip: string;
  ordner: string;
  signal: AbortSignal;
  werkzeuge?: Partial<LadeWerkzeuge>;
}): Promise<EntpackErgebnis> {
  const w = werkzeuge(e.werkzeuge);
  const fehler = (grund: string): EntpackErgebnis => ({ ok: false, art: 'entpacken', grund });
  if (w.plattform !== 'win32') return Promise.resolve(fehler('nur Windows'));
  if (!w.systemRoot) return Promise.resolve(fehler('SystemRoot fehlt'));
  if (e.signal.aborted) return Promise.resolve(fehler('abgebrochen'));
  const tar = win32.join(w.systemRoot, 'System32', 'tar.exe');
  return new Promise<EntpackErgebnis>((resolve) => {
    let kind: KindProzess | null = null;
    let fertig = false;
    let abgebrochen = false;
    const abbrechen = (): void => {
      abgebrochen = true;
      kind?.kill();
    };
    const ende = (r: EntpackErgebnis): void => {
      if (fertig) return;
      fertig = true;
      e.signal.removeEventListener('abort', abbrechen);
      resolve(r);
    };
    try {
      mkdirSync(e.ordner, { recursive: true });
      kind = w.starte(tar, ['-xf', e.zip, '-C', e.ordner]);
    } catch (err) {
      ende(fehler(fehlerCode(err)));
      return;
    }
    e.signal.addEventListener('abort', abbrechen, { once: true });
    kind.on('error', (err) => ende(fehler(abgebrochen ? 'abgebrochen' : fehlerCode(err))));
    kind.on('close', (code) => ende(abgebrochen ? fehler('abgebrochen') : code === 0 ? { ok: true } : fehler(`Exit ${code}`)));
  });
}

/** Spec 5: Zuordnung der Fehlerarten zu den Texten. */
export function ladeFehlerText(f: LadeFehler): string {
  switch (f.art) {
    case 'schluessel':
      return KT.S12;
    case 'gedrosselt':
      return KT.S13(f.sekunden);
    case 'proxy':
      return KT.S14(f.grund);
    case 'fehlt':
      return KT.S15;
    case 'unvollstaendig':
      return KT.S16(f.grund);
    case 'pruefsumme':
      return KT.S16b;
    case 'entpacken':
      return KT.S16c(f.grund);
    case 'abgebrochen':
      return KT.S17;
  }
}

/** Was der Kern zum Laden braucht; in Tests einzeln ersetzbar (ZoomKernAbhaengigkeiten.sdkLaden). */
export interface SdkLadenDienste {
  holeLink: typeof holeLink;
  lade: typeof lade;
  entpacke: typeof entpacke;
  /** Freier Platz in Bytes am nächsten existierenden Vorfahren von `pfad`. */
  freierPlatz(pfad: string): Promise<number>;
  /** Ordner oder Datei samt Inhalt löschen; ein fehlender Pfad ist kein Fehler, alles andere wirft. */
  loesche(pfad: string): void;
}

export const SDK_LADEN_DIENSTE: SdkLadenDienste = {
  holeLink,
  lade,
  entpacke,
  freierPlatz: (pfad) => freierPlatz(pfad, { statfs: (p) => statfs(p) }),
  loesche: (pfad) => rmSync(pfad, { recursive: true, force: true }),
};
