// Laufzeit-Ordner der Zoom-Bridge (Spec 5.3, 6.1): SDK-Ordner prüfen, Datei für Datei nach
// `<ziel>.teil` kopieren, nachprüfen, eigene Dateien und Stempel dazu, dann tauschen.
// Ohne Electron (G8): nur node:-Module, @jm/zoom-bridge und relative Importe.
//
//   %LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953\
//     sdk.dll, … (x64\bin des SDK, mit language\ und ringtone\)
//     zoom-bridge.exe, VC-Laufzeit   eigene Dateien aus <resources>\zoom-bridge\
//     Processing.NDI.Lib.x64.dll     eigene Datei aus <resources>\bin\win\
//     jm-zoom-laufzeit.json          Stempel
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { copyFile as fsCopyFile, statfs as fsStatfs } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { findeSdkBin, peInfo, SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import { KT } from './klartext';

export const STEMPEL_DATEI = 'jm-zoom-laufzeit.json';
export const BRIDGE_EXE = 'zoom-bridge.exe';
export const NDI_DLL = 'Processing.NDI.Lib.x64.dll';
/** Platzreserve über der Größe der Quelle (Spec 6.1 Schritt 6). */
export const PLATZ_RESERVE_BYTES = 100 * 1024 * 1024;
/** Namen, die Connect selbst mitbringt. Liegt eine solche Datei im SDK-Ordner, ist es kein unverändertes SDK (S4). */
export const EIGENE_NAMEN_FEST: readonly string[] = [
  BRIDGE_EXE,
  NDI_DLL,
  'msvcp140.dll',
  'msvcp140_codecvt_ids.dll',
  'vcruntime140.dll',
  'vcruntime140_1.dll',
];

const MIB = 1024 * 1024;

/** `basis` = …\JM Connect\zoom-laufzeit, `ressourcen` = process.resourcesPath bzw. apps/connect/resources. */
export interface LaufzeitPfade {
  basis: string;
  ressourcen: string;
}

/** Inhalt von jm-zoom-laufzeit.json (Spec 5.3). Pfade mit „/“, relativ zum Laufzeit-Ordner. */
export interface Stempel {
  format: 1;
  sdkFassung: string;
  eingerichtetAm: string;
  sdkDateien: { pfad: string; bytes: number }[];
  eigeneDateien: { pfad: string; sha256: string }[];
}

/** Fortschritt der Kopie, nach jeder Datei (Spec 6.1 Schritt 7). */
export interface KopieStand {
  dateien: number;
  dateienGesamt: number;
  bytes: number;
  bytesGesamt: number;
}

/** Ergebnis der Ordnerwahl (Spec 6.1 Schritte 3–5). `bin` = der Ordner, in dem sdk.dll liegt. */
export type SdkWahl =
  | { ok: true; bin: string; fassung: string; dateien: { pfad: string; bytes: number }[]; bytesGesamt: number }
  | { ok: false; text: string };

/** Einspeisbare Werkzeuge (Tests: Kopierfehler, Platz, Uhr). */
export interface LaufzeitWerkzeuge {
  copyFile(von: string, nach: string): Promise<void>;
  statfs(pfad: string): Promise<{ bavail: number; bsize: number }>;
  jetzt(): Date;
  /** Löscht Ordner/Datei samt Inhalt; Fehler werfen (Aufräumen nach dem Tausch fängt sie einzeln). */
  loesche(pfad: string): void;
}

/**
 * `aufraeumFehler`: Code (oder Meldung) des ersten Fehlers beim Aufräumen nach dem Tausch, sonst null.
 * Die Einrichtung gilt trotzdem; der Aufrufer schreibt `[zoom] Aufräumen nach der Einrichtung unvollständig (<code>)` ins Log.
 */
export type EinrichtungsErgebnis =
  | { ok: true; ordner: string; stempel: Stempel; aufraeumFehler: string | null }
  | { ok: false; text: string };

/** Der Laufzeit-Ordner dieser SDK-Fassung. */
export function laufzeitOrdner(p: LaufzeitPfade): string {
  return join(p.basis, SDK_FASSUNG);
}

/** Eigene Dateien: alles aus <ressourcen>/zoom-bridge/ (flach) und die NDI-DLL, sofern vorhanden. Sortiert. */
export function eigeneQuellen(ressourcen: string): { pfad: string; quelle: string }[] {
  const liste: { pfad: string; quelle: string }[] = [];
  const bridgeOrdner = join(ressourcen, 'zoom-bridge');
  if (existsSync(bridgeOrdner)) {
    for (const e of readdirSync(bridgeOrdner, { withFileTypes: true })) {
      if (e.isFile()) liste.push({ pfad: e.name, quelle: join(bridgeOrdner, e.name) });
    }
  }
  const ndi = join(ressourcen, 'bin', 'win', NDI_DLL);
  if (existsSync(ndi)) liste.push({ pfad: NDI_DLL, quelle: ndi });
  return liste.sort((a, b) => (a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0));
}

/** Alle Dateien unter `wurzel`, rekursiv, Pfade mit „/“, sortiert. */
function dateiListe(wurzel: string, unter = ''): { pfad: string; bytes: number }[] {
  const aus: { pfad: string; bytes: number }[] = [];
  for (const e of readdirSync(join(wurzel, unter), { withFileTypes: true })) {
    const rel = unter ? `${unter}/${e.name}` : e.name;
    if (e.isDirectory()) aus.push(...dateiListe(wurzel, rel));
    else if (e.isFile()) aus.push({ pfad: rel, bytes: statSync(join(wurzel, rel)).size });
  }
  return aus.sort((a, b) => (a.pfad < b.pfad ? -1 : a.pfad > b.pfad ? 1 : 0));
}

/** Pfad mit „/“ → Pfad dieses Systems unter `wurzel`. */
function unter(wurzel: string, pfad: string): string {
  return join(wurzel, ...pfad.split('/'));
}

/** Größe einer Datei oder null, wenn sie fehlt. */
function groesse(datei: string): number | null {
  try {
    const s = statSync(datei);
    return s.isFile() ? s.size : null;
  } catch {
    return null;
  }
}

function sha256(datei: string): string {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

/** Stempel lesen; null, wenn er fehlt, kein JSON ist oder nicht `format: 1` hat (Fassung prüft der Aufrufer). */
function leseStempel(ordner: string): Stempel | null {
  try {
    const s = JSON.parse(readFileSync(join(ordner, STEMPEL_DATEI), 'utf8')) as Partial<Stempel> | null;
    if (!s || s.format !== 1 || typeof s.sdkFassung !== 'string') return null;
    if (!Array.isArray(s.sdkDateien) || !Array.isArray(s.eigeneDateien)) return null;
    return s as Stempel;
  } catch {
    return null;
  }
}

function schreibeStempel(ordner: string, s: Stempel): void {
  writeFileSync(join(ordner, STEMPEL_DATEI), `${JSON.stringify(s, null, 2)}\n`);
}

/** Spec 6.1 Schritte 3–5: SDK-Ordner finden und hart prüfen, Dateiliste für Kopie und Stempel. */
export function pruefeSdkOrdner(gewaehlt: string, ressourcen: string): SdkWahl {
  const bin = findeSdkBin(gewaehlt, existsSync);
  if (bin === null) return { ok: false, text: KT.S1 };
  let info: ReturnType<typeof peInfo>;
  try {
    info = peInfo(readFileSync(join(bin, 'sdk.dll')));
  } catch {
    return { ok: false, text: KT.S3b };
  }
  if (info.maschine === 'x86') return { ok: false, text: KT.S2 };
  if (info.fassung === null) return { ok: false, text: KT.S3b };
  if (info.fassung !== SDK_FASSUNG) return { ok: false, text: KT.S3(info.fassung) };
  const dateien = dateiListe(bin);
  const eigene = new Set([...EIGENE_NAMEN_FEST, ...eigeneQuellen(ressourcen).map((q) => q.pfad)].map((n) => n.toLowerCase()));
  for (const d of dateien) {
    const name = d.pfad.split('/').pop() ?? d.pfad;
    if (eigene.has(name.toLowerCase())) return { ok: false, text: KT.S4(name) };
  }
  const bytesGesamt = dateien.reduce((summe, d) => summe + d.bytes, 0);
  return { ok: true, bin, fassung: info.fassung, dateien, bytesGesamt };
}

/** peInfo der Kopie wie bei der Wahl (Spec 6.1 Schritt 8): lesbar, nicht 32 Bit, dieselbe Fassung. */
function sdkDllPasst(datei: string, fassung: string): boolean {
  try {
    const i = peInfo(readFileSync(datei));
    return i.maschine !== 'x86' && i.fassung === fassung;
  } catch {
    return false;
  }
}

/** Freier Platz am nächsten existierenden Vorfahren von `pfad` (basis gibt es vor der ersten Einrichtung nicht). */
async function freierPlatz(pfad: string, w: LaufzeitWerkzeuge): Promise<number> {
  let d = pfad;
  while (!existsSync(d)) {
    const oben = dirname(d);
    if (oben === d) break;
    d = oben;
  }
  const s = await w.statfs(d);
  return s.bavail * s.bsize;
}

/**
 * Spec 6.1 Schritte 6–10. Ein Fehler in 7–10 lässt die bisherige Einrichtung unverändert (S6),
 * `.teil` wird gelöscht. `signal` bricht vor der nächsten Datei ab (Connect wird beendet).
 */
export async function richteEin(e: {
  wahl: Extract<SdkWahl, { ok: true }>;
  pfade: LaufzeitPfade;
  fortschritt: (k: KopieStand) => void;
  signal?: AbortSignal;
  werkzeuge?: Partial<LaufzeitWerkzeuge>;
}): Promise<EinrichtungsErgebnis> {
  const w: LaufzeitWerkzeuge = {
    copyFile: (von, nach) => fsCopyFile(von, nach),
    statfs: (pfad) => fsStatfs(pfad),
    jetzt: () => new Date(),
    loesche: (pfad) => rmSync(pfad, { recursive: true, force: true }),
    ...e.werkzeuge,
  };
  const { wahl, pfade } = e;
  const ziel = laufzeitOrdner(pfade);
  const teil = `${ziel}.teil`;
  const alt = `${ziel}.alt`;
  try {
    // (6) Platz: Quelle + 100 MB, sonst S5 — dann ist noch nichts angelegt.
    const frei = await freierPlatz(pfade.basis, w);
    const bedarf = wahl.bytesGesamt + PLATZ_RESERVE_BYTES;
    if (frei < bedarf) return { ok: false, text: KT.S5(Math.ceil(bedarf / MIB), Math.floor(frei / MIB)) };

    // (7) Kopie nach <ziel>.teil, Datei für Datei, Fortschritt nach jeder Datei.
    rmSync(teil, { recursive: true, force: true });
    mkdirSync(teil, { recursive: true });
    const abgebrochen = (): EinrichtungsErgebnis => {
      rmSync(teil, { recursive: true, force: true });
      return { ok: false, text: KT.S6('abgebrochen') };
    };
    let bytes = 0;
    for (const [i, d] of wahl.dateien.entries()) {
      if (e.signal?.aborted) return abgebrochen();
      const nach = unter(teil, d.pfad);
      mkdirSync(dirname(nach), { recursive: true });
      await w.copyFile(unter(wahl.bin, d.pfad), nach);
      bytes += d.bytes;
      e.fortschritt({ dateien: i + 1, dateienGesamt: wahl.dateien.length, bytes, bytesGesamt: wahl.bytesGesamt });
    }
    if (e.signal?.aborted) return abgebrochen();

    // (8) Nachprüfen: gleiche Zahl, gleiche Größen, peInfo der Kopie (wie bei der Wahl).
    const y = wahl.dateien.length;
    const x = wahl.dateien.filter(
      (d) => groesse(unter(teil, d.pfad)) === d.bytes && (d.pfad !== 'sdk.dll' || sdkDllPasst(join(teil, 'sdk.dll'), wahl.fassung)),
    ).length;
    if (x !== y || dateiListe(teil).length !== y) {
      rmSync(teil, { recursive: true, force: true });
      return { ok: false, text: KT.S7(x, y) };
    }

    // (9) Eigene Dateien dazu, Stempel schreiben.
    const eigeneDateien: Stempel['eigeneDateien'] = [];
    for (const q of eigeneQuellen(pfade.ressourcen)) {
      await w.copyFile(q.quelle, join(teil, q.pfad));
      eigeneDateien.push({ pfad: q.pfad, sha256: sha256(join(teil, q.pfad)) });
    }
    const stempel: Stempel = {
      format: 1,
      sdkFassung: wahl.fassung,
      eingerichtetAm: w.jetzt().toISOString(),
      sdkDateien: wahl.dateien,
      eigeneDateien,
    };
    schreibeStempel(teil, stempel);

    // (10) Tauschen: alt → .alt, .teil → Ziel. Scheitert der zweite Schritt, kommt alt zurück.
    rmSync(alt, { recursive: true, force: true });
    if (existsSync(ziel)) renameSync(ziel, alt);
    try {
      renameSync(teil, ziel);
    } catch (err) {
      if (existsSync(alt) && !existsSync(ziel)) renameSync(alt, ziel);
      throw err;
    }
    // Ab hier ist die neue Einrichtung in Kraft; Aufräumen darf sie nicht mehr kippen.
    let aufraeumFehler: string | null = null;
    const raeume = (tu: () => void): void => {
      try {
        tu();
      } catch (err) {
        // Reste stören nicht (pruefeLaufzeit liest nur den Ordner dieser Fassung), aber der Fehler wird gemeldet.
        if (aufraeumFehler === null) {
          const x = err as { code?: unknown; message?: unknown };
          aufraeumFehler = typeof x.code === 'string' ? x.code : String(x.message ?? err);
        }
      }
    };
    raeume(() => w.loesche(alt));
    raeume(() => {
      for (const g of readdirSync(pfade.basis, { withFileTypes: true })) {
        if (!g.isDirectory() || g.name === SDK_FASSUNG) continue;
        // Nur Ordner anderer Fassungen mit GÜLTIGEM Stempel: alles andere hat Connect nicht angelegt.
        // Jedes Geschwister für sich: ein Fehler überspringt die übrigen nicht.
        raeume(() => {
          if (leseStempel(join(pfade.basis, g.name)) !== null) w.loesche(join(pfade.basis, g.name));
        });
      }
    });
    return { ok: true, ordner: ziel, stempel, aufraeumFehler };
  } catch (err) {
    rmSync(teil, { recursive: true, force: true });
    const x = err as { code?: unknown; message?: unknown };
    return { ok: false, text: KT.S6(typeof x.code === 'string' ? x.code : String(x.message ?? err)) };
  }
}

/** Ergebnis von pruefeLaufzeit (Spec 5.3). `ersetzt` = eigene Dateien, die gerade neu kopiert wurden. */
export type LaufzeitPruefung =
  | { ok: true; ordner: string; ersetzt: string[] }
  | { ok: false; mangel: 'sdk_fehlt' }
  | { ok: false; mangel: 'sdk_defekt'; datei: string; detail?: string }
  | { ok: false; mangel: 'bridge_fehlt' };

/**
 * Prüfung beim Programmstart, nach jeder Einrichtung und vor jedem Bridge-Start (Spec 5.3).
 * Synchron, wirft nie. Kein Ordner → sdk_fehlt. Schritt 1–3 → sdk_defekt (S9 mit `datei`).
 * Scheitert das Ersetzen einer eigenen Datei, steht der Grund (Fehlercode oder Meldung) in `detail`;
 * der Aufrufer schreibt ihn als `[zoom] …` ins Log.
 * Schritt 4: ohne <ressourcen>/zoom-bridge/zoom-bridge.exe → bridge_fehlt (S8); sonst jede eigene
 * Datei kopieren, die fehlt oder deren SHA-256 abweicht, und den Stempel nachziehen. So bringt ein
 * Connect-Update eine neue zoom-bridge.exe mit, ohne dass das SDK neu kopiert wird.
 */
export function pruefeLaufzeit(p: LaufzeitPfade): LaufzeitPruefung {
  const ordner = laufzeitOrdner(p);
  if (!existsSync(ordner)) return { ok: false, mangel: 'sdk_fehlt' };

  // (1) Stempel lesbar, format 1, genau diese SDK-Fassung.
  const stempel = leseStempel(ordner);
  if (stempel === null || stempel.sdkFassung !== SDK_FASSUNG) return { ok: false, mangel: 'sdk_defekt', datei: STEMPEL_DATEI };

  // (2) Jede SDK-Datei mit gleicher Größe. Zusätzliche Dateien stören nicht (schreibt das SDK selbst? ungemessen).
  for (const d of stempel.sdkDateien) {
    if (groesse(unter(ordner, d.pfad)) !== d.bytes) return { ok: false, mangel: 'sdk_defekt', datei: d.pfad };
  }

  // (3) sdk.dll: x64 und genau 7.1.5.43953.
  if (!sdkDllIstX64(join(ordner, 'sdk.dll'))) return { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' };

  // (4) Eigene Dateien abgleichen.
  if (!existsSync(join(p.ressourcen, 'zoom-bridge', BRIDGE_EXE))) return { ok: false, mangel: 'bridge_fehlt' };
  const ersetzt: string[] = [];
  let datei = STEMPEL_DATEI;
  try {
    const eigeneDateien: Stempel['eigeneDateien'] = [];
    for (const q of eigeneQuellen(p.ressourcen)) {
      datei = q.pfad;
      const soll = sha256(q.quelle);
      const ziel = join(ordner, q.pfad);
      if (!existsSync(ziel) || sha256(ziel) !== soll) {
        copyFileSync(q.quelle, ziel);
        ersetzt.push(q.pfad);
      }
      eigeneDateien.push({ pfad: q.pfad, sha256: soll });
    }
    datei = STEMPEL_DATEI;
    if (JSON.stringify(eigeneDateien) !== JSON.stringify(stempel.eigeneDateien)) schreibeStempel(ordner, { ...stempel, eigeneDateien });
  } catch (err) {
    // Eine eigene Datei ließ sich nicht ersetzen (etwa gesperrt): die Laufzeit ist unvollständig, S9 nennt die Datei.
    const x = err as { code?: unknown; message?: unknown };
    return { ok: false, mangel: 'sdk_defekt', datei, detail: typeof x.code === 'string' ? x.code : String(x.message ?? err) };
  }
  return { ok: true, ordner, ersetzt };
}

/** Spec 5.3 Schritt 3: sdk.dll ist eine x64-PE-Datei mit genau SDK_FASSUNG. */
function sdkDllIstX64(datei: string): boolean {
  try {
    const i = peInfo(readFileSync(datei));
    return i.maschine === 'x64' && i.fassung === SDK_FASSUNG;
  } catch {
    return false;
  }
}

/**
 * PATH für den Kindprozess (Spec 5.2): Laufzeit-Ordner VOR dem vollständigen geerbten Wert.
 * Windows erbt den Schlüssel oft als „Path“, bridge.ts liest aber nur env.PATH (Falle 3.2-4).
 * Darum jede Schreibweise suchen, „PATH“ zuerst. Trenner fest „;“ (die Bridge gibt es nur unter Windows).
 */
export function kindPfad(env: Record<string, string | undefined>, ordner: string): string {
  const schluessel = Object.keys(env).filter((k) => k.toLowerCase() === 'path');
  const k = schluessel.includes('PATH') ? 'PATH' : schluessel[0];
  const wert = k === undefined ? undefined : env[k];
  return wert ? `${ordner};${wert}` : ordner;
}

/** Alle Schreibweisen von PATH außer „PATH“ selbst, für envRemove (Spec 5.2), in Einfügereihenfolge. */
export function pfadVarianten(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter((k) => k !== 'PATH' && k.toLowerCase() === 'path');
}
