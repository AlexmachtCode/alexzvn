// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Side-Event-Ordner: der Ablauf (iveo-Paket, Spec 9.2–9.11, 9.15 Zeile 2) — OHNE Electron, per tsx getestet
// (test/side-event-ordner.test.ts gegen die Attrappe test/ordner-attrappe.ts, test/side-event-ordner-echt.test.ts gegen
// das echte Dateisystem). Dateisystem (Form von fs/promises), Uhr, Zeitgeber, Clients, Rolle, Token und Schalter kommen
// von außen; iveo-sync.ts verdrahtet sie. Nur asynchrone Dateizugriffe (9.8): Ein hängendes Netzlaufwerk hält so
// nie den Main-Prozess an. Gelöscht werden nur eigene Zwischendateien (nach genauem Muster) und die eigene Sperrdatei;
// kein Schritt überschreibt eine Datei (E33, E48).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import { parseShow, type Show, type ShowIveoProgramRef } from '@jm/show';
import type { IveoClient, IveoProgramFilter } from '@jm/iveo';
import type { AnhangOrdnerStand, OrdnerProblem, SideEventOrdnerStand, VerbundRolle } from '@shared/types';
import { pruefeAnhaenge, type AgendaErgebnis, type GueltigerAnhang } from './iveo-anhaenge';
import { auffrischenFaellig, IVEO_ABFRAGE_TAKT_MS, naechsterFaelligerTakt } from './iveo-huelle-hilfen';
import {
  ablageMenge, ablageTag, freierName, megabyte, ohneAdressen, ORDNER_GRUENDE, ordnerFehlerText, ordnerPfad, planeSideEvent, sperreBewerten,
  SPERR_DATEI, vergleichsform, type OrdnerDatei, type PlanSchritt,
} from './side-event-ordner';
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
  /** T23 */
  nichtGeladen: (datei: string, grund: string, roh: string): string => `iveo-Ordner: „${datei}“ nicht geladen: ${grund} (${roh}).`,
  /** T25 */
  agendaNichtAbrufbar: (titel: string, grund: string, roh: string): string => `iveo-Ordner: Agenda von „${titel}“ nicht abrufbar: ${grund} (${roh}).`,
  // ── Ende der Texte ──
} as const;

const GIB = 1024 ** 3;
const GRENZE = 2 * GIB;
const PLATZ_SCHRITT = 64 * 1024 ** 2;

/** Abbruch beim Lesen des Datenstroms mit Grund (9.6). */
export class StromFehler extends Error {
  readonly grund: 'leerlauf' | 'bedienung' | 'zu-gross' | 'platz';
  constructor(grund: 'leerlauf' | 'bedienung' | 'zu-gross' | 'platz') {
    super(grund);
    this.name = 'StromFehler';
    this.grund = grund;
  }
}

/** Fehler mit fertigem Grund aus T22 (Status) und einer kurzen Rohmeldung für das Log (T23). */
class GrundFehler extends Error {
  readonly roh: string;
  constructor(grund: string, roh: string) {
    super(grund);
    this.name = 'GrundFehler';
    this.roh = roh;
  }
}


/**
 * Datenstrom stückweise in eine neue Datei (`wx`), mit eigener Leerlauf-Uhr (60 s ohne Daten, auch vor dem ersten Byte),
 * Grenze, Platzprüfung je 64 MiB und `sync()` vor dem Schließen (9.6). Wirft `StromFehler` mit Grund oder den
 * Dateisystemfehler; die Zwischendatei löscht der Aufrufer (jeder Fehler, 9.6).
 */
export async function ladeStromInDatei(
  fs: OrdnerFs,
  strom: ReadableStream<Uint8Array>,
  ziel: string,
  o: {
    grenze: number; leerlaufMs: number; signal: AbortSignal; jetzt(): number;
    setTimeout(fn: () => void, ms: number): unknown; clearTimeout(h: unknown): void;
    platzReicht?(geschrieben: number): Promise<boolean>; fortschritt?(bytes: number): void;
  },
): Promise<{ bytes: number }> {
  const reader = strom.getReader();
  let fh: Awaited<ReturnType<OrdnerFs['open']>> | null = null;
  const lies = (): Promise<ReadableStreamReadResult<Uint8Array>> =>
    new Promise((ok, nein) => {
      let fertig = false;
      const ende = (): void => {
        fertig = true;
        o.clearTimeout(h);
        o.signal.removeEventListener('abort', ab);
      };
      const ab = (): void => {
        if (fertig) return;
        ende();
        nein(new StromFehler('bedienung'));
      };
      const h = o.setTimeout(() => {
        if (fertig) return;
        ende();
        nein(new StromFehler('leerlauf'));
      }, o.leerlaufMs);
      if (o.signal.aborted) return ab();
      o.signal.addEventListener('abort', ab);
      reader.read().then(
        (r) => { if (!fertig) { ende(); ok(r); } },
        (e: unknown) => { if (!fertig) { ende(); nein(o.signal.aborted ? new StromFehler('bedienung') : e); } },
      );
    });
  try {
    fh = await fs.open(ziel, 'wx');
    let bytes = 0;
    let naechstePruefung = PLATZ_SCHRITT;
    for (;;) {
      const r = await lies();
      if (r.done) break;
      const stueck = r.value;
      if (bytes + stueck.byteLength > o.grenze) throw new StromFehler('zu-gross');
      await fh.write(stueck);
      bytes += stueck.byteLength;
      o.fortschritt?.(bytes);
      if (o.platzReicht && bytes >= naechstePruefung) {
        if (!(await o.platzReicht(bytes))) throw new StromFehler('platz');
        naechstePruefung += PLATZ_SCHRITT;
      }
    }
    await fh.sync();
    return { bytes };
  } catch (e) {
    void reader.cancel().catch(() => undefined);
    throw e;
  } finally {
    if (fh) await fh.close().catch(() => undefined);
  }
}


// ── Zustand ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Eintrag { programId: string; agenda: AgendaErgebnis | null; aktiv: boolean }

/** Je Side Event im Speicher dieser Sitzung (neben dem Stand für den Renderer). */
interface SeIntern {
  stand: SideEventOrdnerStand;
  logGrund: Map<string, string>;
  letzterAgendaText: string | null;
}


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
  queue: Eintrag[];
  laeuft: Eintrag | null;
  /** Offener Agenda-Abruf des Ordner-Teils (auch einer alten Generation): ein neuer wartet darauf (9.4: nie zwei zugleich). */
  abrufOffen: Promise<void> | null;
  nachlauf: Map<string, Eintrag>;
  arbeiterGen: number | null;
  download: { programId: string; datei: string } | null;
  rundeStartMs: number | null;
  runde: { offen: Set<string>; n: number; erledigt: number } | null;
  menge: string[];
  liste: ShowIveoProgramRef[];
  basisFehlerBis: number | null;
  /** Laufender Versuch, den Basisordner anzulegen (nur der Takt wiederholt ihn; Einträge warten darauf). */
  basisVersuch: Promise<void> | null;
  /** Zeit des letzten Takts, der versuchen konnte (naechsteSchritte); der nächste kommt einen Takt später (Zeit des nächsten Versuchs, 11.1). */
  taktZuletzt: number | null;
  se: Map<string, SeIntern>;
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
    aktivAgenda: null, queue: [], laeuft: null, abrufOffen: null, nachlauf: new Map(), arbeiterGen: null, download: null,
    rundeStartMs: null, runde: null, menge: [], liste: [], basisFehlerBis: null, basisVersuch: null, taktZuletzt: null,
    se: new Map(), kopf: leererKopf(), letzteMeldung: '',
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
  const s = L.se.get(programId)?.stand;
  return s?.existiert && s.pfad ? s.pfad : null;
}

// ── Generation, Sitzung, Ende der Ablage (9.2, 9.4) ──────────────────────────────────────────────────────────────

/** Neue Lauf-Generation: laufender Download abgebrochen (Grund bedienung), Warteschlange geleert (9.4). */
function neueGeneration(L: Lauf): void {
  L.gen++;
  L.abbruch.abort();
  L.abbruch = new AbortController();
  L.queue = [];
  L.laeuft = null; // der alte Arbeiter hält ihn nicht mehr für diese Generation (sonst landet ein Eintrag der neuen im Nachlauf, der nie abgearbeitet wird)
  L.nachlauf.clear();
  L.runde = null;
  L.kopf.runde = null;
  L.darf = false;
  L.download = null; // der abgebrochene Download zeigt kein S6 mehr
  for (const s of L.se.values()) s.stand.laedt = null;
}

function neueSitzung(L: Lauf): void {
  neueGeneration(L);
  const alt = L.gehalten;
  L.gehalten = null;
  L.abgesetzt = false;
  L.sitzung = L.d.neueSitzungsKennung();
  L.aktivAgenda = null;
  L.rundeStartMs = null;
  L.basisFehlerBis = null;
  L.basisVersuch = null; // ein hängender Versuch der alten Generation hält die neue nicht auf (sein Ergebnis wird verworfen)
  L.se = new Map();
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

/** K4 und K6: Sperre bleibt, die Ablage pausiert; Warteschlange und laufender Eintrag enden (9.2, 9.11), die Runde beginnt danach neu. */
function pausiere(L: Lauf): void {
  if (L.darf || L.laeuft || L.queue.length) neueGeneration(L);
  L.darf = false;
  L.rundeStartMs = null;
}

/** Ende der Ablage: Generation +1 und die eigene Sperre einmal lesen, vergleichen, löschen (9.2). */
async function endeAblage(L: Lauf): Promise<void> {
  if (L.darf || L.laeuft || L.queue.length) neueGeneration(L);
  L.darf = false;
  L.rundeStartMs = null; // 9.14: beginnt die Ablage wieder (Schalter an, Rolle, Token), startet die Runde im nächsten Takt
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
  if (show.art !== 'da') { pausiere(L); return melde(L); } // K4: Sperre bleibt, Ablage pausiert
  if (!(await pruefeSperre(L, b.pfad, gen))) { if (gen === L.gen) pausiere(L); return melde(L); } // K5, K6: keine Arbeit weiter
  if (gen !== L.gen || !bedingungenGelten(L, a.path)) return;
  L.darf = true;
  naechsteSchritte(L, a, show.show);
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
    if (L.darf || L.laeuft || L.queue.length) neueGeneration(L);
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
    // Nur der Fehler beim Anlegen bleibt bis zu seinem Versuch (legeBasisAn, erkennbar an seiner Zeit). Jeder andere (Sperrdatei, lstat) ist mit
    // diesem Durchgang überholt: ohne ihn versucht der Takt es sofort (naechsteSchritte), sonst stünde die Ablage still oder nennte eine alte Zeit.
    const anlegen = L.basisFehlerBis !== null && b.fehler !== null && !b.fehler.sperre && b.fehler.naechsterVersuch === iso(L.basisFehlerBis);
    k.basis = { ...b, existiert: false, fehler: anlegen ? b.fehler : null };
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

// ── Warteschlange, Runde, Generation (9.4) ───────────────────────────────────────────────────────────────────────

/** Ablage-Menge (9.3), aktives Side Event jeden Takt, Runde über die übrigen (9.4). */
function naechsteSchritte(L: Lauf, a: { path: string; event: string; filter: IveoProgramFilter }, show: Show): void {
  L.liste = show.iveo?.sideEvents ?? [];
  L.menge = ablageMenge(L.liste, ablageTag(a.filter, L.d.tagVon), L.d.tagVon, a.filter.programId ?? null);
  const aktivId = a.filter.programId ?? null;
  for (const id of L.menge) seIntern(L, id);
  for (const s of L.se.values()) {
    s.stand.aktiv = s.stand.programId === aktivId;
    s.stand.inMenge = L.menge.includes(s.stand.programId);
    s.stand.titel = titelVon(L, s.stand.programId);
  }
  // Runde über die übrigen Side Events der Ablage-Menge (Regel 6.1); eingereiht wird erst nach dem aktiven.
  const jetzt = L.d.jetzt();
  L.taktZuletzt = jetzt;
  let ids: string[] = [];
  if (!L.runde && (L.rundeStartMs === null || auffrischenFaellig(L.rundeStartMs, jetzt, L.taktMs))) {
    L.rundeStartMs = jetzt;
    L.kopf.ersteRundeGestartet = true;
    L.kopf.naechsteRundeGegen = iso(naechsterFaelligerTakt(jetzt, L.taktMs));
    ids = L.menge.filter((id) => id !== aktivId);
    L.runde = ids.length ? { offen: new Set(ids), n: ids.length, erledigt: 0 } : null;
    L.kopf.runde = L.runde ? { i: 1, n: L.runde.n } : null;
  }
  // Basisordner nicht anlegbar: der Takt wiederholt den Versuch zur genannten Zeit (zu „gegen“, danach in jedem Takt), die Zeile nennt nie eine Zeit ohne Versuch (11.1)
  // Der Takt kommt nach Kern-Abfrage und Wächter und schwankt um die Netz-Latenz: ein Drittel Takt Toleranz (wie der Rundenstart), sonst fiele der Versuch einen Takt später.
  // Ist der Fehler aus der Kopfzeile verschwunden (andere Prüfung, Sperre, K3), gibt es nichts mehr abzuwarten: der Versuch gilt sofort, sonst bliebe die Ablage stehen.
  const bf = L.kopf.basis?.fehler;
  if (L.basisFehlerBis !== null && !bf?.sperre && !L.basisVersuch && (!bf || jetzt + Math.floor(L.taktMs / 3) >= L.basisFehlerBis)) {
    const basis = basisPfad(a);
    const gen = L.gen;
    if (basis) {
      const v = versucheBasis(L, basis, gen);
      const w = v.finally(() => { if (L.basisVersuch === w) L.basisVersuch = null; });
      L.basisVersuch = w;
      void beschaeftigt(L, w);
    }
  }
  // Aktives Side Event: jeden Takt, aus der Agenda des Kerns, kein eigener Abruf (8.2, 9.4); es steht vorn.
  const ag = L.aktivAgenda;
  L.aktivAgenda = null;
  if (aktivId && ag && ag.programId === aktivId) reihe(L, { programId: aktivId, agenda: ag.e, aktiv: true });
  for (const id of ids) reihe(L, { programId: id, agenda: null, aktiv: false });
}

/** Je Side Event höchstens ein Eintrag (E48); läuft er gerade, wird er nach dem Ende genau einmal neu eingereiht. */
function reihe(L: Lauf, e: Eintrag): void {
  if (L.laeuft?.programId === e.programId) {
    L.nachlauf.set(e.programId, e);
    return;
  }
  const i = L.queue.findIndex((x) => x.programId === e.programId);
  if (i >= 0) L.queue.splice(i, 1);
  if (e.aktiv) L.queue.unshift(e);
  else if (i >= 0) L.queue.splice(i, 0, e);
  else L.queue.push(e);
  starteArbeiter(L);
}

function starteArbeiter(L: Lauf): void {
  if (L.arbeiterGen === L.gen) return;
  const gen = L.gen;
  L.arbeiterGen = gen;
  void beschaeftigt(L, arbeite(L, gen)).finally(() => { if (L.arbeiterGen === gen) L.arbeiterGen = null; });
}

async function arbeite(L: Lauf, gen: number): Promise<void> {
  for (;;) {
    if (gen !== L.gen) return;
    const a = L.d.aktiv();
    if (!a || !bedingungenGelten(L, a.path)) { await endeAblage(L); return melde(L); }
    const e = L.queue.shift();
    if (!e) {
      if (L.arbeiterGen === gen) L.arbeiterGen = null; // sofort frei: ein neuer Eintrag startet den Arbeiter neu
      return;
    }
    L.laeuft = e;
    if (L.runde?.offen.has(e.programId)) L.kopf.runde = { i: L.runde.erledigt + 1, n: L.runde.n };
    fortschritt(L);
    melde(L);
    let unterbrochen = false;
    try {
      unterbrochen = await bearbeite(L, e, a, gen);
    } finally {
      if (L.laeuft === e) { L.laeuft = null; L.download = null; } // nicht den Eintrag eines neuen Arbeiters löschen
    }
    if (gen !== L.gen) return;
    if (!unterbrochen && L.runde?.offen.delete(e.programId)) {
      L.runde.erledigt++;
      if (L.runde.offen.size === 0) L.runde = null;
      L.kopf.runde = L.runde ? { i: L.runde.erledigt + 1, n: L.runde.n } : null;
    }
    const n = L.nachlauf.get(e.programId);
    if (n) {
      L.nachlauf.delete(e.programId);
      reihe(L, n);
    }
    fortschritt(L);
    melde(L);
  }
}

// ── Stand und Meldung (9.13, 9.15) ───────────────────────────────────────────────────────────────────────────────

function titelVon(L: Lauf, programId: string): string {
  return L.liste.find((p) => p.id === programId)?.title || L.d.titelVon(programId) || programId;
}

function seIntern(L: Lauf, programId: string): SeIntern {
  let s = L.se.get(programId);
  if (!s) {
    s = {
      stand: {
        programId, titel: titelVon(L, programId), aktiv: false, inMenge: L.menge.includes(programId), ordnerName: null, pfad: null,
        existiert: false, indexFormat: 'fehlt', anlegbar: null, laedt: null, wartetHinter: null, abruf: 'keiner', stand: null,
        standAusFrueherSitzung: false, fehler: null, n: 0, k: 0, probleme: [],
        zusaetze: { indexNeuAufgebaut: false, weitererOrdner: null, bedienerGeaendert: 0, gesperrteEndungen: 0 },
      },
      logGrund: new Map(), letzterAgendaText: null,
    };
    L.se.set(programId, s);
  }
  return s;
}

function standKopie(L: Lauf): AnhangOrdnerStand {
  const wartend = new Set(L.queue.map((e) => e.programId));
  const sideEvents = [...L.se.values()]
    .filter((s) => s.stand.inMenge || s.stand.ordnerName !== null)
    .map((s) => {
      const st = { ...s.stand, probleme: [...s.stand.probleme], zusaetze: { ...s.stand.zusaetze } };
      st.wartetHinter = st.aktiv && wartend.has(st.programId) && L.download && L.download.programId !== st.programId ? L.download.datei : null;
      return st;
    });
  return { ...L.kopf, sideEvents };
}

function fortschritt(L: Lauf): void {
  L.kopf.letzterFortschritt = iso(L.d.jetzt());
}

/** Stand melden, bei jeder Änderung. */
function melde(L: Lauf): void {
  const s = standKopie(L);
  const text = JSON.stringify(s);
  if (text === L.letzteMeldung) return;
  L.letzteMeldung = text;
  L.d.melde(s);
}

// ── Ordner finden und anlegen (9.1) ──────────────────────────────────────────────────────────────────────────────

function basisPfad(a: { path: string }): string | null {
  const b = ordnerPfad({ art: 'basis', showPfad: a.path });
  return b.ok ? b.pfad : null;
}

async function liste(L: Lauf, ordner: string): Promise<OrdnerDatei[]> {
  const aus: OrdnerDatei[] = [];
  for (const name of await L.fs.readdir(ordner)) {
    try {
      const st = await L.fs.stat(path.join(ordner, name));
      if (st.isFile()) aus.push({ name, groesse: st.size, mtimeMs: st.mtimeMs });
    } catch {
      /* in der Zwischenzeit verschwunden */
    }
  }
  return aus;
}

/** Ordner des Side Events: der schon bekannte, sonst (mit Anhängen) neu angelegt; Basisordner und Sperre entstehen mit ihm (9.1, 9.2). */
async function ordnerFuer(L: Lauf, s: SeIntern, a: { path: string }, gen: number, mitAnhaengen: boolean): Promise<{ pfad: string; name: string } | null> {
  const basis = basisPfad(a);
  if (!basis) return null;
  const st = s.stand;
  if (st.ordnerName && st.existiert) return { pfad: path.join(basis, st.ordnerName), name: st.ordnerName };
  if (!mitAnhaengen) return null; // OF4: ein Ordner entsteht erst mit dem ersten Anhang
  const wartete = L.basisVersuch !== null;
  if (L.basisVersuch) await L.basisVersuch; // der Versuch des Takts läuft: dessen Ergebnis gilt für diesen Eintrag
  if (gen !== L.gen) return null;
  if (L.basisFehlerBis !== null) return null; // ein Fehler beim Anlegen wird nur vom Takt zu seiner Zeit wiederholt (naechsteSchritte)
  if (!wartete && !(await legeBasisAn(L, basis, gen))) return null; // sonst hat der Takt den Ordner eben angelegt
  if (!L.gehalten && !(await schreibeSperre(L, basis, false, gen, L.sitzung))) return null; // die Sperre entsteht mit dem Basisordner
  const erwartet = ordnerPfad({ art: 'seitenOrdner', basisPfad: basis, titel: st.titel });
  if (!erwartet.ok) { st.anlegbar = { grund: erwartet.grund }; return null; }
  let name: string;
  try {
    name = freierName(erwartet.name, new Set((await L.fs.readdir(basis)).map(vergleichsform)));
    await L.fs.mkdir(path.join(basis, name), { recursive: true });
  } catch (e) {
    st.anlegbar = { grund: ordnerFehlerText(e, 'datei') ?? fehlerCode(e) };
    return null;
  }
  if (gen !== L.gen) return null;
  Object.assign(st, { ordnerName: name, pfad: path.join(basis, name), existiert: true, anlegbar: null });
  return { pfad: path.join(basis, name), name };
}

/**
 * Basisordner anlegen. Bei einem Fehler steht die Zeit des nächsten Versuchs fest: die Zeit des Takts, der ihn wirklich macht
 * (naechsteSchritte, ein Drittel Takt Toleranz), also „gegen“ (Beginn der nächsten Runde), sonst der nächste Takt nach dem letzten
 * (nicht jetzt + Takt: ein Eintrag scheitert zwischen zwei Takten). Beides frühestens ein Drittel Takt nach jetzt: einen früheren
 * Termin hat dieser Versuch schon verbraucht (der Takt in der Toleranz von „gegen“ WAR sein Versuch), er bekäme keinen mehr (11.1, 9.4).
 */
async function legeBasisAn(L: Lauf, basis: string, gen: number): Promise<boolean> {
  try {
    await L.fs.mkdir(basis, { recursive: true });
  } catch (e) {
    if (gen !== L.gen) return false;
    const jetzt = L.d.jetzt();
    const toleranz = Math.floor(L.taktMs / 3);
    const gegen = Date.parse(L.kopf.naechsteRundeGegen ?? iso(jetzt));
    const takt = L.taktZuletzt ?? jetzt;
    const bis = gegen >= jetzt + toleranz ? gegen : takt + Math.max(1, Math.ceil((jetzt + toleranz - takt) / L.taktMs)) * L.taktMs;
    L.basisFehlerBis = bis;
    L.kopf.basis = { ...(L.kopf.basis as NonNullable<AnhangOrdnerStand['basis']>), existiert: false, fehler: { code: fehlerCode(e), naechsterVersuch: iso(bis) } };
    return false;
  }
  if (gen !== L.gen) return false;
  L.basisFehlerBis = null;
  if (L.kopf.basis) L.kopf.basis = { ...L.kopf.basis, existiert: true, fehler: null };
  return true;
}

/** Wiederholter Versuch des Takts; die Sperre schreibt die nächste Prüfung (pruefeSperre) oder der erste Eintrag mit Anhängen. */
async function versucheBasis(L: Lauf, basis: string, gen: number): Promise<void> {
  await legeBasisAn(L, basis, gen);
  if (gen === L.gen) melde(L);
}

// ── Ein Side Event abgleichen (9.4–9.10) ─────────────────────────────────────────────────────────────────────────

/** true = unterbrochen (das aktive Side Event hat Vorrang, dieser Eintrag ist neu eingereiht). */
async function bearbeite(L: Lauf, e: Eintrag, a: { path: string; event: string }, gen: number): Promise<boolean> {
  const s = seIntern(L, e.programId);
  const st = s.stand;
  let erg = e.agenda;
  if (!erg) {
    const c = L.d.agendaClient();
    if (!c) return false;
    if (L.abrufOffen) { // der Abruf einer alten Generation läuft noch (bis zur 15-s-Grenze): nie zwei zugleich im Ordner-Teil (9.4)
      await L.abrufOffen;
      if (gen !== L.gen) return false;
    }
    const abgerufen = iso(L.d.jetzt());
    const roh = (async () => c.listAgendaItems(a.event, e.programId))();
    const fertig = roh.then(() => undefined, () => undefined);
    L.abrufOffen = fertig;
    void fertig.then(() => { if (L.abrufOffen === fertig) L.abrufOffen = null; });
    try {
      erg = { ok: true, agenda: await roh, abgerufen };
    } catch (fehler) {
      erg = { ok: false, fehler };
    }
    if (gen !== L.gen) return false; // spätes Ergebnis einer alten Generation: verworfen (9.4)
  }
  if (!erg.ok) {
    agendaGescheitert(L, s, erg.fehler);
    return false;
  }
  const { gueltig, ungueltig } = pruefeAnhaenge(erg.agenda);
  const o = await ordnerFuer(L, s, a, gen, gueltig.length > 0);
  if (gen !== L.gen) return false;
  if (!o) {
    // Der Abruf ist gelungen, auch wenn es keinen Ordner gibt (kein Anhang, Basisordner nicht anlegbar, Sperre nicht schreibbar): die Zeile zeigt ihn (G8)
    Object.assign(st, { abruf: 'gelungen', stand: erg.abgerufen, standAusFrueherSitzung: false, fehler: null });
    if (gueltig.length === 0 && !st.existiert && st.indexFormat !== 'neuer') {
      // kein Ordner, weil das Side Event keine Anhänge hat (OF4): gelungen mit n = 0
      Object.assign(st, { n: 0, k: 0, probleme: [] });
    } else if (gueltig.length > 0 && !st.existiert) {
      // Anhänge da, aber der Ordner entstand nicht: ehrlich 0 von n im Ordner (S13), nie „Keine Anhänge“ (S11)
      Object.assign(st, { n: gueltig.length, k: 0, probleme: [] });
    }
    return false;
  }
  const dateien = await liste(L, o.pfad);
  if (gen !== L.gen) return false;
  const plan = planeSideEvent({
    seitenOrdner: o.pfad, index: null, dateien, entfernt: [], urlInhalte: new Map(),
    anhaenge: gueltig, ungueltig, jetzt: new Date(L.d.jetzt()),
    zurueckgehaltenBis: () => null,
  });
  const ctx: Ctx = { L, s, e, o, gen, signal: L.abbruch.signal, zwischenAngelegt: false, probleme: [] };
  for (const schritt of plan) {
    if (gen !== L.gen) return false;
    if (!bedingungenGelten(L, a.path)) { await endeAblage(L); return false; }
    if (!e.aktiv && L.queue[0]?.aktiv) {
      // Vorrang: das aktive Side Event läuft nach dem gerade laufenden Schritt; dieser Eintrag kommt danach wieder.
      L.queue.splice(1, 0, { ...e, agenda: erg });
      await abschluss(ctx, erg.abgerufen, gueltig, false);
      return true;
    }
    fortschritt(L);
    await fuehreAus(ctx, schritt);
    fortschritt(L);
    melde(L);
  }
  if (gen !== L.gen) return false;
  await abschluss(ctx, erg.abgerufen, gueltig, true);
  return false;
}

function agendaGescheitert(L: Lauf, s: SeIntern, fehler: unknown): void {
  const st = s.stand;
  const text = ordnerFehlerText(fehler, 'agenda') ?? 'abgebrochen';
  st.abruf = 'gescheitert';
  st.fehler = { text, seit: st.fehler?.seit ?? iso(L.d.jetzt()) };
  if (s.letzterAgendaText !== text) {
    s.letzterAgendaText = text;
    L.d.log.warn(LAUF_TEXTE.agendaNichtAbrufbar(st.titel, text, rohmeldung(fehler)));
  }
}

function rohmeldung(e: unknown): string {
  if (e instanceof GrundFehler) return e.roh;
  const m = (e as { message?: unknown } | null)?.message;
  const code = (e as { code?: unknown } | null)?.code;
  const roh = typeof m === 'string' && m ? m : typeof code === 'string' ? code : String(e);
  return ohneAdressen(roh).replace(/[\r\n]+/g, ' ');
}

interface Ctx {
  L: Lauf;
  s: SeIntern;
  e: Eintrag;
  o: { pfad: string; name: string };
  gen: number;
  /** Abbruchsignal der Generation, in der `bearbeite` den Kontext anlegte (nicht das der gerade gültigen). */
  signal: AbortSignal;
  /** Die Zwischendatei kann existieren (ab dem Aufruf von `ladeStromInDatei`); vorher gibt es nichts zu löschen. */
  zwischenAngelegt: boolean;
  probleme: OrdnerProblem[];
}

/** Nach dem Plan: Stand mit der Zahl der Anhänge und den Problemen. */
async function abschluss(ctx: Ctx, abgerufen: string, gueltig: GueltigerAnhang[], _ganz: boolean): Promise<void> {
  Object.assign(ctx.s.stand, {
    abruf: 'gelungen', stand: abgerufen, standAusFrueherSitzung: false, fehler: null, n: gueltig.length, k: 0, probleme: ctx.probleme,
  });
  ctx.s.letzterAgendaText = null;
}

async function fuehreAus(ctx: Ctx, s: PlanSchritt): Promise<void> {
  switch (s.art) {
    case 'fehler':
    case 'zurueckgehalten':
      return;
    default:
      return fuehreSchrittAus(ctx, s);
  }
}


function grundText(e: unknown, wo: 'download' | 'datei'): string {
  if (e instanceof GrundFehler) return e.message;
  if (e instanceof StromFehler) return ordnerFehlerText(e, wo, e.grund === 'leerlauf' ? 'leerlauf' : undefined) ?? e.grund;
  return ordnerFehlerText(e, wo) ?? '';
}

type Schritt<A extends PlanSchritt['art']> = Extract<PlanSchritt, { art: A }>;

async function fuehreSchrittAus(ctx: Ctx, s: Exclude<PlanSchritt, { art: 'fehler' | 'zurueckgehalten' }>): Promise<void> {
  if (s.art === 'laden') return lade(ctx, s);
}

async function freierPlatz(L: Lauf, pfad: string): Promise<number> {
  try {
    const s = await L.fs.statfs(pfad);
    return Number(s.bavail) * Number(s.bsize);
  } catch (e) {
    throw new GrundFehler(ORDNER_GRUENDE.platzNichtPruefbar(fehlerCode(e)), `statfs ${fehlerCode(e)}`);
  }
}

/** Laden über die Zwischendatei `.‹Kennung›.‹pid›.jm-laden`; jeder Fehler löscht sie, bevor der nächste Schritt läuft (9.6). */
async function lade(ctx: Ctx, s: Schritt<'laden'>): Promise<void> {
  const { L, o, gen } = ctx;
  const m = s.anhang.m;
  const z = ordnerPfad({ art: 'zwischen', seitenOrdner: o.pfad, kennung: m.id, pid: L.d.pid, endung: 'jm-laden' });
  if (!z.ok) return scheitert(ctx, s, new GrundFehler(z.grund, 'Zwischendatei'));
  let bytes: number;
  try {
    bytes = await ladeDatei(ctx, s, z.pfad);
  } catch (x) {
    ctx.s.stand.laedt = null;
    if (gen === L.gen) L.download = null; // der Download einer neuen Generation bleibt stehen
    if (ctx.zwischenAngelegt) await L.fs.unlink(z.pfad).catch(() => undefined); // 9.4: vorher gibt es keine Datei, also kein Zugriff

    if (gen !== L.gen || (x instanceof StromFehler && x.grund === 'bedienung')) return; // Bedienung: kein Fehler (9.4)
    return scheitert(ctx, s, x);
  }
  ctx.s.stand.laedt = null;
  if (gen === L.gen) L.download = null;
  if (gen !== L.gen) { await L.fs.unlink(z.pfad).catch(() => undefined); return; }
  await platziere(ctx, s, z.pfad, bytes);
}

async function ladeDatei(ctx: Ctx, s: Schritt<'laden'>, ziel: string): Promise<number> {
  const { L, o } = ctx;
  const m = s.anhang.m;
  const groesse = s.anhang.groesse;
  const st = ctx.s.stand;
  if (groesse !== null && groesse > GRENZE) throw new GrundFehler(ORDNER_GRUENDE.zuGross(groesse), `size_bytes ${groesse}`);
  const grenze = groesse !== null ? Math.min(groesse, GRENZE) : GRENZE;
  let frei = await freierPlatz(L, o.pfad);
  if (ctx.gen !== L.gen) throw new StromFehler('bedienung'); // 9.4: nach dem await die Generation prüfen, kein Abruf, kein Dateizugriff
  if (frei < (groesse !== null ? grenze + GIB : GIB)) throw new GrundFehler(ORDNER_GRUENDE.wenigPlatz(frei), `frei ${frei} Bytes`);
  const client = L.d.downloadClient();
  if (!client || !m.asset) throw new StromFehler('bedienung');
  const ac = new AbortController();
  const weiter = (): void => ac.abort();
  ctx.signal.addEventListener('abort', weiter);
  let leer = false;
  let geschrieben = 0;
  st.laedt = { datei: s.wunsch, bytes: 0, groesse };
  L.download = { programId: ctx.e.programId, datei: s.wunsch };
  fortschritt(L);
  melde(L);
  try {
    const h = L.d.setTimeout(() => { leer = true; ac.abort(); }, L.leerlaufMs); // Leerlauf auch vor dem ersten Byte
    let strom: Awaited<ReturnType<Pick<IveoClient, 'oeffneAsset'>['oeffneAsset']>>;
    try {
      strom = await client.oeffneAsset(m.asset.url, { signal: ac.signal });
    } catch (x) {
      if (leer) throw new StromFehler('leerlauf');
      if (ac.signal.aborted) throw new StromFehler('bedienung');
      throw x;
    } finally {
      L.d.clearTimeout(h);
    }
    ctx.zwischenAngelegt = true;
    const r = await ladeStromInDatei(L.fs, strom.body, ziel, {
      grenze, leerlaufMs: L.leerlaufMs, signal: ac.signal, jetzt: L.d.jetzt, setTimeout: L.d.setTimeout, clearTimeout: L.d.clearTimeout,
      platzReicht: groesse === null ? async () => { frei = await freierPlatz(L, o.pfad); return frei >= GIB; } : undefined,
      fortschritt: (b) => {
        geschrieben = b;
        st.laedt = { datei: s.wunsch, bytes: b, groesse };
      },
    });
    if (groesse !== null && r.bytes !== groesse) throw new GrundFehler(ORDNER_GRUENDE.unvollstaendig(r.bytes, groesse), `${r.bytes} Bytes`);
    return r.bytes;
  } catch (x) {
    if (x instanceof StromFehler && x.grund === 'zu-gross') {
      throw new GrundFehler(groesse !== null ? ORDNER_GRUENDE.mehrDaten(groesse) : ORDNER_GRUENDE.zuGross(geschrieben), `mehr als ${grenze} Bytes`);
    }
    if (x instanceof StromFehler && x.grund === 'platz') throw new GrundFehler(ORDNER_GRUENDE.wenigPlatz(frei), `frei ${frei} Bytes`);
    throw x;
  } finally {
    ctx.signal.removeEventListener('abort', weiter);
  }
}

/** Fehlschlag: Zeile und einmal je neuem Grund ins Log (T23). */
function scheitert(ctx: Ctx, s: Schritt<'laden'>, x: unknown): void {
  const { L } = ctx;
  const m = s.anhang.m;
  const grund = grundText(x, 'download');
  ctx.probleme.push({ art: 'grund', datei: s.wunsch, grund });
  if (ctx.s.logGrund.get(m.id) !== grund) {
    ctx.s.logGrund.set(m.id, grund);
    L.d.log.warn(LAUF_TEXTE.nichtGeladen(s.wunsch, grund, rohmeldung(x)));
  }
}

/** Platzieren ohne Überschreiben (9.6): Zielname unmittelbar vorher frisch prüfen, dann umbenennen. */
async function platziere(ctx: Ctx, s: Schritt<'laden'>, zwischen: string, _bytes: number): Promise<void> {
  const { L, o } = ctx;
  try {
    const namen = await L.fs.readdir(o.pfad);
    if (ctx.gen !== L.gen) { await L.fs.unlink(zwischen).catch(() => undefined); return; } // 9.4: kein Umbenennen für eine alte Generation
    const ziel = freierName(s.wunsch, new Set(namen.map(vergleichsform)));
    await L.fs.rename(zwischen, path.join(o.pfad, ziel));
  } catch (x) {
    await L.fs.unlink(zwischen).catch(() => undefined);
    return scheitert(ctx, s, x);
  }
  ctx.s.logGrund.delete(s.anhang.m.id);
}

// ── Ende des Moduls ──
