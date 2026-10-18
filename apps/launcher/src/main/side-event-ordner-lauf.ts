// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Side-Event-Ordner: der Ablauf (iveo-Paket, Spec 9.2–9.11, 9.15 Zeile 2) — OHNE Electron, per tsx getestet
// (test/side-event-ordner.test.ts gegen die Attrappe test/ordner-attrappe.ts, test/side-event-ordner-echt.test.ts gegen
// das echte Dateisystem). Dateisystem (Form von fs/promises), Uhr, Zeitgeber, Clients, Rolle, Token und Schalter kommen
// von außen; iveo-sync.ts verdrahtet sie. Nur asynchrone Dateizugriffe (9.8): Ein hängendes Netzlaufwerk hält so
// nie den Main-Prozess an. Gelöscht werden nur eigene Zwischendateien (nach genauem Muster) und die eigene Sperrdatei;
// kein Schritt überschreibt eine Datei (E33, E48).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { parseShow, type Show } from '@jm/show';
import type { IveoClient, IveoProgramFilter } from '@jm/iveo';
import type { AnhangOrdnerStand, VerbundRolle } from '@shared/types';
import type { AgendaErgebnis } from './iveo-anhaenge';
import { IVEO_ABFRAGE_TAKT_MS } from './iveo-huelle-hilfen';
import { ohneAdressen, ordnerPfad, sperreBewerten, SPERR_DATEI } from './side-event-ordner';
import { fehlerCode } from './verbund/fehlercode';

/** Dateisystem in der Form von `node:fs/promises` (test/side-event-ordner-echt.test.ts prüft es am echten Dateisystem). */
export interface OrdnerFs {
  stat(p: string): Promise<{ size: number; mtimeMs: number; isFile(): boolean; isDirectory(): boolean }>;
  lstat(p: string): Promise<{ isDirectory(): boolean; isSymbolicLink(): boolean }>;
  readdir(p: string): Promise<string[]>;
  mkdir(p: string, o: { recursive: true }): Promise<unknown>;
  readFile(p: string, enc: 'utf8'): Promise<string>;
  open(p: string, flags: 'wx'): Promise<{ write(b: Uint8Array): Promise<unknown>; sync(): Promise<void>; close(): Promise<void> }>;
  rename(von: string, nach: string): Promise<void>;
  unlink(p: string): Promise<void>;
  statfs(p: string): Promise<{ bavail: number | bigint; bsize: number | bigint }>;
}

export interface OrdnerLaufAbh {
  fs: OrdnerFs;
  jetzt(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  /** = kern().aktiv(): Pfad, Event und Filter der offenen Show, sonst null. */
  aktiv(): { path: string; event: string; filter: IveoProgramFilter } | null;
  rolle(): VerbundRolle;
  tokenDa(): boolean;
  schalterAn(): boolean;
  /** Tag und Titel eines Side Events aus dem iveo-Cache (9.3, 9.1). */
  tagVon(programId: string): string | null;
  titelVon(programId: string): string | null;
  /** Client mit 15-s-Zeitgrenze (Hülle). */
  agendaClient(): Pick<IveoClient, 'listAgendaItems'> | null;
  /** Client ohne Zeitgrenze (`iveoDownloadClient`, E46). */
  downloadClient(): Pick<IveoClient, 'oeffneAsset'> | null;
  /** `os.hostname()`, `process.pid`, Zufallskennung je Sitzung (9.2). */
  rechner: string;
  pid: number;
  neueSitzungsKennung(): string;
  log: { info(m: string): void; warn(m: string): void };
  /** Stand an den Renderer; bei Fortschritt höchstens einmal je Sekunde (9.6). */
  melde(stand: AnhangOrdnerStand): void;
  taktMs?: number;
  leerlaufMs?: number;
}

export interface OrdnerLauf {
  /** Show geöffnet, gewechselt oder neu gebunden: Generation +1, alte Sperre löschen (9.2 „Ende der Ablage“). */
  sitzung(): void;
  /** Stößt an und kehrt sofort zurück: Bedingungen, Lebenszeichen, aktives Side Event, Runde (9.4). */
  takt(): void;
  /** Agenda des aktiven Side Events, wie der Kern sie gemeldet hat (8.2); gilt im nächsten `takt()`. */
  agendaAktiv(programId: string, e: AgendaErgebnis): void;
  stand(): AnhangOrdnerStand;
  /** „Ordner öffnen“: nur aus der programId (E35); ohne Kennung der Basisordner; null = Ordner gibt es nicht. */
  ordnerPfadFuer(programId?: string): string | null;
  /** Ende der Ablage beim Beenden: Löschen der eigenen Sperre anstoßen, nicht abwarten (9.2). */
  beenden(): void;
  /** Nur für Tests: wartet, bis Takt, Warteschlange und Ende der Ablage fertig sind. */
  ruhig(): Promise<void>;
}

/** Texte des Laufs, wörtlich aus Spec 11.6. */
export const LAUF_TEXTE = {
  /** T75 */
  sperreNichtGeloescht: (ordner: string, code: string): string =>
    `iveo-Ordner: Sperrdatei in „${ordner}“ nicht gelöscht (${code}); ein anderer Rechner übernimmt die Ablage erst nach 15 Minuten.`,
  // ── Ende der Texte ──
} as const;

// ── Zustand ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Lauf {
  d: OrdnerLaufAbh;
  fs: OrdnerFs;
  taktMs: number;
  leerlaufMs: number;
  gen: number;
  abbruch: AbortController;
  sitzung: string;
  /** Basisordner, in dem diese Sitzung die Sperre hält, mit der Sitzung, die darin steht. */
  gehalten: { basis: string; sitzung: string } | null;
  /** Ablage erlaubt (Bedingungen 1–6 im letzten Takt). */
  darf: boolean;
  /** Namensgleiche Sperre (Regel 4): bis zur nächsten Sitzung nichts mehr. */
  abgesetzt: boolean;
  beendet: boolean;
  beschaeftigt: number;
  warter: Array<() => void>;
  taktLaeuft: boolean;
  statLaeuft: boolean;
  /** Angestoßenes Löschen der Sperre einer vorigen Sitzung (9.2); die nächste Prüfung der Sperre wartet darauf. */
  sperreLoeschen: Promise<void> | null;
  aktivAgenda: { programId: string; e: AgendaErgebnis } | null;
  kopf: Omit<AnhangOrdnerStand, 'sideEvents'>;
  letzteMeldung: string;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function leererKopf(): Omit<AnhangOrdnerStand, 'sideEvents'> {
  return {
    showOffen: false, rolle: 'aus', tokenDa: false, schalterAn: true, showDatei: 'da', sperre: null, basis: null,
    runde: null, ersteRundeGestartet: false, naechsteRundeGegen: null, letzterFortschritt: null,
  };
}

export function erzeugeOrdnerLauf(d: OrdnerLaufAbh): OrdnerLauf {
  const L: Lauf = {
    d, fs: d.fs, taktMs: d.taktMs ?? IVEO_ABFRAGE_TAKT_MS, leerlaufMs: d.leerlaufMs ?? 60_000,
    gen: 0, abbruch: new AbortController(), sitzung: d.neueSitzungsKennung(), gehalten: null, darf: false,
    abgesetzt: false, beendet: false, beschaeftigt: 0, warter: [], taktLaeuft: false, statLaeuft: false, sperreLoeschen: null,
    aktivAgenda: null, kopf: leererKopf(), letzteMeldung: '',
  };
  return {
    sitzung: () => neueSitzung(L),
    takt: () => {
      if (L.taktLaeuft || L.beendet) return;
      L.taktLaeuft = true;
      void beschaeftigt(L, taktAsync(L)).finally(() => { L.taktLaeuft = false; });
    },
    agendaAktiv: (programId, e) => { L.aktivAgenda = { programId, e }; },
    stand: () => standKopie(L),
    ordnerPfadFuer: (programId) => ordnerPfadFuer(L, programId),
    beenden: () => {
      L.beendet = true;
      void beschaeftigt(L, endeAblage(L));
    },
    ruhig: () => ruhig(L),
  };
}

async function beschaeftigt<T>(L: Lauf, p: Promise<T>): Promise<T | undefined> {
  L.beschaeftigt++;
  try {
    return await p;
  } catch (e) {
    L.d.log.warn(`iveo-Ordner: unerwarteter Fehler (${ohneAdressen(String((e as Error)?.message ?? e))}).`);
    return undefined;
  } finally {
    L.beschaeftigt--;
    if (L.beschaeftigt === 0) for (const w of L.warter.splice(0)) w();
  }
}

function ruhig(L: Lauf): Promise<void> {
  return new Promise((ok) => {
    const pruefe = (): void => {
      if (L.beschaeftigt === 0) ok();
      else L.warter.push(pruefe);
    };
    setImmediate(pruefe);
  });
}

function ordnerPfadFuer(L: Lauf, programId?: string): string | null {
  if (programId === undefined) return L.kopf.basis?.existiert ? L.kopf.basis.pfad : null;
  return null;
}

// ── Generation, Sitzung, Ende der Ablage (9.2, 9.4) ──────────────────────────────────────────────────────────────

/** Neue Lauf-Generation: was noch läuft, bricht ab (Grund bedienung, 9.4). */
function neueGeneration(L: Lauf): void {
  L.gen++;
  L.abbruch.abort();
  L.abbruch = new AbortController();
  L.darf = false;
}

function neueSitzung(L: Lauf): void {
  neueGeneration(L);
  const alt = L.gehalten;
  L.gehalten = null;
  L.abgesetzt = false;
  L.sitzung = L.d.neueSitzungsKennung();
  L.aktivAgenda = null;
  L.kopf = leererKopf();
  liesBedingungen(L);
  melde(L); // sofort: die Zeile der alten Sitzung darf nicht stehen bleiben, auch wenn der nächste Takt an einem Zugriff hängt
  if (alt) {
    // Anstoßen, nicht abwarten; die nächste Prüfung der Sperre wartet darauf, sonst löschte es die neue Sperre (12.4 Nr. 40 b).
    const p = loescheEigeneSperre(L, alt);
    L.sperreLoeschen = p;
    void beschaeftigt(L, p).finally(() => { if (L.sperreLoeschen === p) L.sperreLoeschen = null; });
  }
}

/** Ende der Ablage: Generation +1 und die eigene Sperre einmal lesen, vergleichen, löschen (9.2). */
async function endeAblage(L: Lauf): Promise<void> {
  if (L.darf) neueGeneration(L);
  L.darf = false;
  const alt = L.gehalten;
  L.gehalten = null;
  if (alt) await loescheEigeneSperre(L, alt);
}

async function loescheEigeneSperre(L: Lauf, g: { basis: string; sitzung: string }): Promise<void> {
  const p = path.join(g.basis, SPERR_DATEI);
  try {
    const gelesen = JSON.parse(await L.fs.readFile(p, 'utf8')) as { sitzung?: unknown } | null;
    if (gelesen?.sitzung !== g.sitzung) return; // inzwischen eine andere Sitzung: bleibt
    await L.fs.unlink(p);
  } catch (e) {
    const code = fehlerCode(e);
    if (code === 'ENOENT') return;
    L.d.log.warn(LAUF_TEXTE.sperreNichtGeloescht(path.basename(g.basis), code));
  }
}

// ── Takt: Bedingungen 9.2, Sperre, aktives Side Event, Runde ─────────────────────────────────────────────────────

/** Show, Rolle, Token und Schalter in den Kopf lesen (keine Dateizugriffe). */
function liesBedingungen(L: Lauf): { path: string; event: string; filter: IveoProgramFilter } | null {
  const d = L.d;
  const a = d.aktiv();
  const k = L.kopf;
  k.showOffen = a !== null;
  k.rolle = d.rolle();
  k.tokenDa = d.tokenDa();
  k.schalterAn = d.schalterAn();
  return a;
}

async function taktAsync(L: Lauf): Promise<void> {
  const a = liesBedingungen(L);
  const k = L.kopf;
  melde(L); // vor jedem Dateizugriff: ein hängender Zugriff hält den Stand nicht zurück (K0–K2, K6 „überfällig“)
  if (!a) { await endeAblage(L); return melde(L); } // K0
  const b = ordnerPfad({ art: 'basis', showPfad: a.path });
  if (b.ok && k.basis?.pfad !== b.pfad) k.basis = { name: b.name, pfad: b.pfad, existiert: false, fehler: null };
  if (k.rolle === 'slave' || !k.tokenDa) { await endeAblage(L); return melde(L); } // K1, K2: kein Zugriff
  if (L.abgesetzt) return melde(L); // K5 namensgleich bis zur nächsten Sitzung
  if (!k.schalterAn) { // K3: nur die Existenzprüfung des Basisordners, höchstens eine je Takt
    await endeAblage(L);
    melde(L);
    if (b.ok && !L.statLaeuft) { // abgelöst, nicht abwarten: eine hängende stat hält sonst jeden weiteren Takt fern
      L.statLaeuft = true;
      void beschaeftigt(L, pruefeBasisOrdner(L, k, b, L.gen));
    }
    return;
  }
  if (!b.ok) { k.basis = { name: path.basename(a.path), pfad: a.path, existiert: false, fehler: { code: b.grund, naechsterVersuch: naechsterTakt(L) } }; return melde(L); }
  const gen = L.gen;
  const show = await leseShowDatei(L, a.path);
  if (gen !== L.gen) return;
  k.showDatei = show.art;
  if (show.art !== 'da') return melde(L); // K4: Sperre bleibt, Ablage pausiert
  if (!(await pruefeSperre(L, b.pfad, gen))) return melde(L);
  if (gen !== L.gen || !bedingungenGelten(L, a.path)) return;
  L.darf = true;
  melde(L);
}

/** K3: Existenz des Basisordners per `stat`, höchstens eine zugleich (`statLaeuft`); das Ergebnis gilt nur noch bei gleicher Generation und Schalter aus. */
async function pruefeBasisOrdner(L: Lauf, k: Lauf['kopf'], b: { name: string; pfad: string }, gen: number): Promise<void> {
  let existiert = false;
  try {
    existiert = (await L.fs.stat(b.pfad)).isDirectory();
  } catch {
    existiert = false;
  } finally {
    L.statLaeuft = false;
  }
  if (gen !== L.gen || L.kopf !== k || L.d.schalterAn()) return;
  k.basis = { name: b.name, pfad: b.pfad, existiert, fehler: null };
  melde(L);
}

/** Bedingungen 1–4 (9.2), gelesen vor jedem Schritt der Warteschlange: ein Wechsel bricht ab (9.4). */
function bedingungenGelten(L: Lauf, showPfad: string): boolean {
  const a = L.d.aktiv();
  return !L.beendet && !L.abgesetzt && a !== null && a.path === showPfad && L.d.rolle() !== 'slave' && L.d.tokenDa() && L.d.schalterAn();
}

async function leseShowDatei(L: Lauf, pfad: string): Promise<{ art: 'da'; show: Show } | { art: 'fehlt' | 'nicht-lesbar' }> {
  let text: string;
  try {
    text = await L.fs.readFile(pfad, 'utf8');
  } catch (e) {
    return { art: fehlerCode(e) === 'ENOENT' ? 'fehlt' : 'nicht-lesbar' };
  }
  try {
    return { art: 'da', show: parseShow(text) };
  } catch {
    return { art: 'nicht-lesbar' };
  }
}

/** Sperrdatei lesen und bewerten (9.2 Regeln 1–6); bei frei, eigen oder abgelaufen schreiben. true = ablegen. */
async function pruefeSperre(L: Lauf, basis: string, gen: number): Promise<boolean> {
  const k = L.kopf;
  const p = path.join(basis, SPERR_DATEI);
  if (L.sperreLoeschen) {
    await L.sperreLoeschen; // erst das angestoßene Löschen der Sperre einer vorigen Sitzung (sonst träfe es die neue)
    if (gen !== L.gen) return false;
  }
  let gelesen: unknown = null;
  try {
    const text = await L.fs.readFile(p, 'utf8');
    k.basis = { ...(k.basis as NonNullable<typeof k.basis>), existiert: true }; // gelesen: der Basisordner ist da (9.13, K5)
    try {
      gelesen = JSON.parse(text);
    } catch {
      gelesen = {};
    }
  } catch (e) {
    const code = fehlerCode(e);
    if (code !== 'ENOENT') { // K6 mit eigenem Text (OFP6); der nächste Takt liest erneut
      // Jeder andere Lesefehler außer ENOTDIR zeigt, dass der Basisordner da ist (Rechte, Virenscanner, Cloud-Sync): „Ordner
      // öffnen“ bleibt, damit der Bediener die Ursache beheben kann (9.13, OFP6). ENOTDIR: an dieser Stelle ist kein Ordner.
      k.basis = { ...(k.basis as NonNullable<typeof k.basis>), existiert: code !== 'ENOTDIR', fehler: { code, naechsterVersuch: naechsterTakt(L), sperre: 'lesen' } };
      return false;
    }
  }
  if (gen !== L.gen) return false;
  const bew = sperreBewerten(gelesen, { rechner: L.d.rechner, sitzung: L.sitzung }, L.gehalten?.basis === basis, L.d.jetzt());
  if (bew === 'fremd' || bew === 'namensgleich') {
    const g = gelesen as { rechner: string; lebenszeichen?: string };
    k.sperre = { art: bew, rechner: String(g.rechner), lebenszeichen: String(g.lebenszeichen ?? '') };
    if (L.darf) neueGeneration(L);
    L.gehalten = null;
    if (bew === 'namensgleich') L.abgesetzt = true;
    return false;
  }
  k.sperre = null;
  return schreibeSperre(L, basis, bew === 'frei', gen, L.sitzung); // Generation und Sitzung hier festhalten, vor lstat und Schreiben
}

/** Sperrdatei atomar schreiben (Zwischendatei, sync, umbenennen). Fehlt der Basisordner bei „frei“: später (9.2). */
async function schreibeSperre(L: Lauf, basis: string, frei: boolean, gen: number, sitzung: string): Promise<boolean> {
  const k = L.kopf;
  // gen und sitzung kommen von der Prüfung: sitzung() kann schon während lstat, Zwischendatei, sync oder Umbenennen eine neue vergeben
  const art = await basisArt(L, basis); // 9.12 Regel 11: nie durch eine Verknüpfung schreiben
  if (art === null) return false;
  const inhalt = `${JSON.stringify({ format: 1, rechner: L.d.rechner, pid: L.d.pid, sitzung, lebenszeichen: iso(L.d.jetzt()) }, null, 2)}\n`;
  const fehler = await schreibeAtomar(L, path.join(basis, SPERR_DATEI), inhalt);
  if (fehler === null) {
    if (gen !== L.gen || L.beendet) { // Show gewechselt oder Ende der Ablage, während geschrieben wurde: die eben geschriebene Sperre wieder lesen, vergleichen, löschen
      await loescheEigeneSperre(L, { basis, sitzung });
      return false;
    }
    L.gehalten = { basis, sitzung };
    k.basis = { ...(k.basis as NonNullable<typeof k.basis>), existiert: true, fehler: null };
    return true;
  }
  if (frei && fehler === 'ENOENT') { // Basisordner gibt es noch nicht: die Sperre entsteht mit ihm (9.2)
    const b = k.basis as NonNullable<typeof k.basis>;
    k.basis = { ...b, existiert: false, fehler: null }; // ein Fehler an der Sperrdatei ist mit dem Ordner weg
    return true;
  }
  // K6 mit eigenem Text (OFP6): der Ordner ist da (lstat), nur die Sperrdatei nicht schreibbar; der nächste Takt versucht es neu
  k.basis = { ...(k.basis as NonNullable<typeof k.basis>), existiert: art === 'da', fehler: { code: fehler, naechsterVersuch: naechsterTakt(L), sperre: 'schreiben' } };
  return false;
}

/**
 * Basisordner per `lstat` (9.12 Regel 11): 'da' = echter Ordner, 'fehlt' = noch nicht angelegt (kein Fehler), null =
 * Verknüpfung, kein Ordner oder nicht prüfbar; dann steht K6 im Stand und es gibt keinen Zugriff darunter.
 */
async function basisArt(L: Lauf, basis: string): Promise<'da' | 'fehlt' | null> {
  const setze = (code: string): null => {
    L.kopf.basis = { ...(L.kopf.basis as NonNullable<typeof L.kopf.basis>), existiert: false, fehler: { code, naechsterVersuch: naechsterTakt(L) } };
    return null;
  };
  let st: { isDirectory(): boolean; isSymbolicLink(): boolean };
  try {
    st = await L.fs.lstat(basis);
  } catch (e) {
    return fehlerCode(e) === 'ENOENT' ? 'fehlt' : setze(fehlerCode(e));
  }
  if (st.isSymbolicLink()) return setze('Verknüpfung');
  return st.isDirectory() ? 'da' : setze('kein Ordner');
}

/** Zeit des nächsten Versuchs bei einem Fehler außerhalb der Runde: der nächste Takt (K6, 11.1). */
function naechsterTakt(L: Lauf): string {
  return iso(L.d.jetzt() + L.taktMs);
}

/**
 * Atomar schreiben wie `show-schreiben.ts`, aber asynchron (9.8): Zwischendatei `‹Ziel›.‹pid›.tmp`, `sync`, Umbenennen
 * mit bis zu 5 Versuchen im Abstand von 50 ms bei EPERM, EBUSY, EACCES. null = geschrieben, sonst der Fehlercode.
 */
async function schreibeAtomar(L: Lauf, ziel: string, inhalt: string): Promise<string | null> {
  const zwischen = `${ziel}.${L.d.pid}.tmp`;
  try {
    const fh = await L.fs.open(zwischen, 'wx');
    try {
      await fh.write(Buffer.from(inhalt, 'utf8'));
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch (e) {
    const code = fehlerCode(e);
    if (code !== 'ENOENT') await L.fs.unlink(zwischen).catch(() => undefined);
    return code;
  }
  for (let versuch = 1; ; versuch++) {
    try {
      await L.fs.rename(zwischen, ziel);
      return null;
    } catch (e) {
      const code = fehlerCode(e);
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(code) || versuch >= 5) {
        await L.fs.unlink(zwischen).catch(() => undefined);
        return code;
      }
      await new Promise<void>((ok) => L.d.setTimeout(ok, 50));
    }
  }
}

// ── Stand und Meldung (9.13, 9.15) ───────────────────────────────────────────────────────────────────────────────

function standKopie(L: Lauf): AnhangOrdnerStand {
  return { ...L.kopf, sideEvents: [] };
}

/** Stand melden, bei jeder Änderung. */
function melde(L: Lauf): void {
  const s = standKopie(L);
  const text = JSON.stringify(s);
  if (text === L.letzteMeldung) return;
  L.letzteMeldung = text;
  L.d.melde(s);
}

// ── Ende des Moduls ──
