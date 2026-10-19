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
  ablageMenge, ablageTag, freierName, imOrdner, indexText, inhaltSignatur, INDEX_DATEI, istLinkAnhang,
  leseIndex, megabyte, ohneAdressen, ORDNER_GRUENDE, ordnerFehlerText, ordnerPfad, planeSideEvent, rueckhaltungBis, sperreBewerten, SPERR_DATEI,
  urlDateiInhalt, vergleichsform, type IndexEintrag, type OrdnerDatei, type OrdnerIndex, type PlanSchritt,
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
  /**
   * Offene iveo-Show: Pfad, Event und Filter, sonst null. Die Hülle reicht `ablageShow(kern().aktiv(), …)` ein: ohne Token
   * die gebundene offene Show mit leerem Filter (11.1 K1, K2 statt K0); abgelegt wird nur mit `tokenDa()`.
   */
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
  /**
   * Show, Rolle, Token und Schalter neu lesen und den Stand melden, ohne Arbeit zu beginnen und auch während ein Takt
   * läuft (9.14: der Schalter darf nicht bis zum nächsten Takt einen alten Stand zeigen). Liefert den frischen Stand.
   */
  bedingungenNeu(): AnhangOrdnerStand;
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
  /** T21 (a)–(f) */
  geladen: (datei: string, mbText: string): string => `iveo-Ordner: „${datei}“ geladen (${mbText} MB).`,
  umbenannt: (alt: string, neu: string): string => `iveo-Ordner: „${alt}“ in „${neu}“ umbenannt.`,
  entferntInIveo: (datei: string): string => `iveo-Ordner: „${datei}“ nach „entfernt“ verschoben (in iveo entfernt).`,
  entferntErsetzt: (datei: string): string => `iveo-Ordner: „${datei}“ nach „entfernt“ verschoben (durch neue Fassung ersetzt).`,
  zurueckgeholt: (datei: string): string => `iveo-Ordner: „${datei}“ aus „entfernt“ zurückgeholt.`,
  uebernommen: (datei: string): string => `iveo-Ordner: „${datei}“ übernommen (lag schon im Ordner).`,
  /** T23 */
  nichtGeladen: (datei: string, grund: string, roh: string): string => `iveo-Ordner: „${datei}“ nicht geladen: ${grund} (${roh}).`,
  /** T24 */
  indexKaputt: (ordner: string, n: number): string =>
    `iveo-Ordner: Index von „${ordner}“ beschädigt, beiseitegelegt und neu aufgebaut (${n} Dateien übernommen).`,
  /** T25 */
  agendaNichtAbrufbar: (titel: string, grund: string, roh: string): string => `iveo-Ordner: Agenda von „${titel}“ nicht abrufbar: ${grund} (${roh}).`,
  /** T70 */
  endungGesperrt: (ext: string, label: string, datei: string): string => `iveo-Ordner: Endung „${ext}“ von „${label}“ gesperrt, abgelegt als „${datei}“.`,
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
export class GrundFehler extends Error {
  readonly roh: string;
  constructor(grund: string, roh: string) {
    super(grund);
    this.name = 'GrundFehler';
    this.roh = roh;
  }
}

/** Quelle oder Ziel liegt außerhalb des Side-Event-Ordners (9.12 Regel 11). */
export class AusserhalbFehler extends Error {
  constructor() {
    super('Pfad außerhalb des Side-Event-Ordners');
    this.name = 'AusserhalbFehler';
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

/**
 * Umbenennen oder Verschieben nur innerhalb des Side-Event-Ordners (9.12 Regel 11): Quelle und Ziel werden mit
 * `path.relative` geprüft, bevor das Dateisystem etwas sieht. Wirft `AusserhalbFehler`, sonst wie `rename`.
 */
export async function umbenennenImOrdner(fs: OrdnerFs, seitenOrdner: string, von: string, nach: string): Promise<void> {
  if (!imOrdner(seitenOrdner, von) || !imOrdner(seitenOrdner, nach)) throw new AusserhalbFehler();
  await fs.rename(von, nach);
}

// ── Zustand ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Eintrag { programId: string; agenda: AgendaErgebnis | null; aktiv: boolean }

/** Je Side Event im Speicher dieser Sitzung (neben dem Stand für den Renderer). */
interface SeIntern {
  stand: SideEventOrdnerStand;
  index: OrdnerIndex | null;
  indexOffen: boolean;
  zuletztGeschriebenMs: number | null;
  aufgeraeumt: boolean;
  /** Problem, das den Ordner dieses Side Events in `ordnerFuer` verhindert (Index nicht lesbar, Auflisten gescheitert, Beiseitelegen gescheitert). */
  ordnerProblem: OrdnerProblem[] | null;
  logGrund: Map<string, string>;
  letzterAgendaText: string | null;
}


interface Fund { name: string; art: 'ok' | 'neuer' | 'kaputt' | 'fehlt'; programId: string | null; ordnerName: string | null; stand: string | null }

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
  funde: Fund[] | null;
  /** Fehlercode, wenn die letzte Durchsicht etwas nicht lesen konnte (nicht ENOENT): in dieser Runde wird kein Ordner angelegt (G8). */
  scanFehler: string | null;
  /** Name des ersten Eintrags, den die Durchsicht nicht lesen konnte (Basisordner oder Unterordner): die Zeile nennt ihn (G8). */
  scanOrt: string | null;
  /** Die Sperr-Zwischendateien im Basisordner sind in dieser Sitzung schon aufgeräumt (9.6: beim ersten Zugriff). */
  tmpAufgeraeumt: boolean;
  scanFaellig: boolean;
  basisFehlerBis: number | null;
  /** Laufender Versuch, den Basisordner anzulegen (nur der Takt wiederholt ihn; Einträge warten darauf). */
  basisVersuch: Promise<void> | null;
  /** Zeit des letzten Takts, der versuchen konnte (naechsteSchritte); der nächste kommt einen Takt später (Zeit des nächsten Versuchs, 11.1). */
  taktZuletzt: number | null;
  se: Map<string, SeIntern>;
  fehlschlaege: Map<string, { f: number; bis: number; grund: string; datei: string }>;
  kopf: Omit<AnhangOrdnerStand, 'sideEvents' | 'durchsichtFertig'>;
  letzteMeldung: string;
  letzteMeldungMs: number;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function leererKopf(): Omit<AnhangOrdnerStand, 'sideEvents' | 'durchsichtFertig'> {
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
    rundeStartMs: null, runde: null, menge: [], liste: [], funde: null, scanFehler: null, scanOrt: null, tmpAufgeraeumt: false, scanFaellig: false, basisFehlerBis: null, basisVersuch: null, taktZuletzt: null,
    se: new Map(), fehlschlaege: new Map(), kopf: leererKopf(), letzteMeldung: '', letzteMeldungMs: -Infinity,
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
    bedingungenNeu: () => { liesBedingungen(L); melde(L); return standKopie(L); },
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
  L.funde = null;
  L.scanFehler = null;
  L.scanOrt = null;
  L.tmpAufgeraeumt = false;
  L.basisFehlerBis = null;
  L.basisVersuch = null; // ein hängender Versuch der alten Generation hält die neue nicht auf (sein Ergebnis wird verworfen)
  L.se = new Map();
  L.fehlschlaege = new Map();
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
  L.kopf.ersteRundeGestartet = false; // und bis dahin steht die erste Runde aus (K8), nicht ein „überfällig“ gegen die Zeit vor dem Ende
  L.kopf.naechsteRundeGegen = null;
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
    L.scanFaellig = true;
    for (const s of L.se.values()) s.stand.zusaetze.indexNeuAufgebaut = false;
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
  if (L.scanFaellig) starteArbeiter(L); // Durchsicht des Basisordners auch ohne Eintrag (S2, S8)
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
    if (L.scanFaellig) {
      L.scanFaellig = false;
      fortschritt(L); // Beginn eines Schritts (9.6): auch in der ersten Runde trägt der Stand eine Zeit (K7, T76)
      await scanneBasis(L, a, gen);
      if (gen !== L.gen) return;
      melde(L);
    }
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
      index: null, indexOffen: false, zuletztGeschriebenMs: null, aufgeraeumt: false, ordnerProblem: null, logGrund: new Map(), letzterAgendaText: null,
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
  return { ...L.kopf, durchsichtFertig: L.funde !== null, sideEvents };
}

function fortschritt(L: Lauf): void {
  L.kopf.letzterFortschritt = iso(L.d.jetzt());
}

/** Stand melden: bei jeder Änderung, Fortschritt (nurFortschritt) höchstens einmal je Sekunde (9.6). */
function melde(L: Lauf, nurFortschritt = false): void {
  const jetzt = L.d.jetzt();
  if (nurFortschritt && jetzt - L.letzteMeldungMs < 1000) return;
  const s = standKopie(L);
  const text = JSON.stringify(s);
  if (text === L.letzteMeldung) return;
  L.letzteMeldung = text;
  L.letzteMeldungMs = jetzt;
  L.d.melde(s);
}

// ── Ordner finden und anlegen, Index lesen (9.1, 9.8) ────────────────────────────────────────────────────────────

function basisPfad(a: { path: string }): string | null {
  const b = ordnerPfad({ art: 'basis', showPfad: a.path });
  return b.ok ? b.pfad : null;
}

/** Wiederfinden (9.1): Unterordner des Basisordners mit ihrem Index. Räumt eigene Sperr-Zwischendateien auf. */
async function scanneBasis(L: Lauf, a: { path: string }, gen: number): Promise<void> {
  const basis = basisPfad(a);
  if (!basis) return;
  if ((await basisArt(L, basis)) === null) { if (gen === L.gen) L.funde = []; return; } // 9.12 Regel 11: nichts darunter lesen
  if (gen !== L.gen) return;
  L.scanFehler = null;
  L.scanOrt = null;
  let namen: string[];
  try {
    namen = await L.fs.readdir(basis);
  } catch (e) {
    if (gen !== L.gen) return;
    L.funde = [];
    if (fehlerCode(e) === 'ENOENT') { if (L.kopf.basis) L.kopf.basis.existiert = false; } // nur „fehlt“ gilt als nicht da; jeder andere Fehler sperrt das Anlegen (W2)
    else { L.scanFehler = fehlerCode(e); L.scanOrt = path.basename(basis); }
    return;
  }
  if (gen !== L.gen) return;
  if (L.kopf.basis) L.kopf.basis.existiert = true;
  const funde: Fund[] = [];
  let fehler: string | null = null;
  let fehlerOrt: string | null = null;
  // 9.6: die Sperr-Zwischendateien räumt nur der erste Zugriff dieser Sitzung auf (und nur mit eigener Sperre).
  const tmpWeg = L.gehalten !== null && !L.tmpAufgeraeumt;
  for (const name of namen) {
    const p = path.join(basis, name);
    if (tmpWeg && /^\.jm-ablage-sperre\.json\.\d+\.tmp$/.test(name)) {
      await L.fs.unlink(p).catch(() => undefined);
      if (gen !== L.gen) return;
      continue;
    }
    let st: { isDirectory(): boolean; isSymbolicLink(): boolean };
    try {
      st = await L.fs.lstat(p);
    } catch (e) {
      if (gen !== L.gen) return;
      if (fehlerCode(e) !== 'ENOENT' && fehler === null) { fehler = fehlerCode(e); fehlerOrt = name; }
      continue;
    }
    if (gen !== L.gen) return;
    if (!st.isDirectory() || st.isSymbolicLink()) continue;
    let text: string;
    try {
      text = await L.fs.readFile(path.join(p, INDEX_DATEI), 'utf8');
    } catch (e) {
      if (gen !== L.gen) return;
      if (fehlerCode(e) !== 'ENOENT' && fehler === null) { fehler = fehlerCode(e); fehlerOrt = name; } // unlesbar: gilt hier als „ohne Index“, sperrt aber das Anlegen eines weiteren Ordners
      funde.push({ name, art: 'fehlt', programId: null, ordnerName: null, stand: null });
      continue;
    }
    if (gen !== L.gen) return;
    const r = leseIndex(text);
    if (r.art === 'ok') funde.push({ name, art: 'ok', programId: r.index.programId, ordnerName: r.index.ordnerName, stand: r.index.stand || null });
    else if (r.art === 'neuer') funde.push({ name, art: 'neuer', programId: losesProgramId(text), ordnerName: null, stand: null });
    else funde.push({ name, art: 'kaputt', programId: null, ordnerName: null, stand: null });
  }
  if (gen !== L.gen) return;
  if (tmpWeg) L.tmpAufgeraeumt = true;
  L.funde = funde;
  L.scanFehler = fehler;
  L.scanOrt = fehlerOrt;
  // Stand für Side Events mit gefundenem Ordner (S2, S8), solange sie in dieser Sitzung noch nicht bearbeitet sind.
  for (const f of funde) {
    if (!f.programId) continue;
    const s = seIntern(L, f.programId);
    if (s.stand.abruf !== 'keiner') continue;
    const wahl = waehleOrdner(L, f.programId, s.stand.titel, basis);
    if (!wahl || wahl.name !== f.name) continue;
    s.stand.ordnerName = f.name;
    s.stand.pfad = path.join(basis, f.name);
    s.stand.existiert = true;
    s.stand.indexFormat = f.art === 'ok' ? 'eins' : 'neuer';
    s.stand.zusaetze.weitererOrdner = wahl.weiterer;
    if (f.stand) { s.stand.stand = f.stand; s.stand.standAusFrueherSitzung = true; }
  }
}

function losesProgramId(text: string): string | null {
  try {
    const j = JSON.parse(text) as { programId?: unknown };
    return typeof j.programId === 'string' ? j.programId : null;
  } catch {
    return null;
  }
}

/** Regeln 1–3 aus 9.1 über die Funde der letzten Durchsicht. */
function waehleOrdner(L: Lauf, programId: string, titel: string, basis: string): { name: string; art: Fund['art']; weiterer: string | null } | null {
  const funde = L.funde ?? [];
  const vf = vergleichsform;
  const mit = funde.filter((f) => f.programId === programId && (f.art === 'ok' || f.art === 'neuer'));
  if (mit.length) {
    const sortiert = [...mit].sort((x, y) => (vf(x.name) < vf(y.name) ? -1 : vf(x.name) > vf(y.name) ? 1 : 0));
    const gewaehlt = sortiert.find((f) => f.ordnerName !== null && vf(f.ordnerName) === vf(f.name)) ?? sortiert[0];
    const weiterer = sortiert.find((f) => f !== gewaehlt)?.name ?? null;
    return { name: gewaehlt.name, art: gewaehlt.art, weiterer };
  }
  const erwartet = ordnerPfad({ art: 'seitenOrdner', basisPfad: basis, titel });
  if (!erwartet.ok) return null;
  const f = funde.find((x) => vf(x.name) === vf(erwartet.name) && (x.art === 'kaputt' || x.art === 'fehlt'));
  return f ? { name: f.name, art: f.art, weiterer: null } : null;
}

interface Ordner {
  pfad: string;
  name: string;
  index: OrdnerIndex;
  neuAufgebaut: boolean;
  dateien: OrdnerDatei[];
  entfernt: OrdnerDatei[] | null; // null = „entfernt“ ist kein echter Ordner
  urlInhalte: Map<string, string>;
  probleme: OrdnerProblem[];
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

/** Ordner des Side Events finden oder (mit Anhängen) anlegen, Index lesen oder neu aufbauen, Liste lesen. */
async function ordnerFuer(L: Lauf, s: SeIntern, a: { path: string }, gen: number, mitAnhaengen: boolean): Promise<Ordner | null> {
  const basis = basisPfad(a);
  if (!basis) return null;
  const st = s.stand;
  s.ordnerProblem = null;
  if (L.funde === null || L.scanFehler !== null) await scanneBasis(L, a, gen); // nach einem Lesefehler bei jedem Zugriff neu (W2)
  if (gen !== L.gen) return null;
  const wahl = waehleOrdner(L, st.programId, st.titel, basis);
  let name: string;
  if (!wahl) {
    st.ordnerName = null;
    st.pfad = null;
    st.existiert = false;
    if (!mitAnhaengen) return null; // OF4: ein Ordner entsteht erst mit dem ersten Anhang
    if (L.scanFehler !== null) { // die Durchsicht konnte etwas nicht lesen: nicht anlegen (sonst entsteht ein Duplikat), die Zeile nennt es (G8)
      s.ordnerProblem = [{ art: 'grund', datei: L.scanOrt ?? path.basename(basis), grund: `Lesefehler (${L.scanFehler})` }];
      return null;
    }
    const wartete = L.basisVersuch !== null;
    if (L.basisVersuch) await L.basisVersuch; // der Versuch des Takts läuft: dessen Ergebnis gilt für diesen Eintrag
    if (gen !== L.gen) return null;
    if (L.basisFehlerBis !== null) return null; // ein Fehler beim Anlegen wird nur vom Takt zu seiner Zeit wiederholt (naechsteSchritte)
    const art = await basisArt(L, basis); // 9.12 Regel 11: mkdir ginge durch eine Verknüpfung still durch
    if (art === null || gen !== L.gen) return null;
    // sonst hat der Takt den Ordner eben angelegt; die Durchsicht davor kann ihn überholt haben: ist der Basisordner da (frisch gelesen), kein zweites mkdir
    if (!wartete && art !== 'da' && !(await legeBasisAn(L, basis, gen))) return null;
    if (!L.gehalten && !(await schreibeSperre(L, basis, false, gen, L.sitzung))) return null; // die Sperre entsteht mit dem Basisordner
    const erwartet = ordnerPfad({ art: 'seitenOrdner', basisPfad: basis, titel: st.titel });
    if (!erwartet.ok) { st.anlegbar = { grund: erwartet.grund }; return null; }
    let belegt: Set<string>;
    try {
      belegt = new Set((await L.fs.readdir(basis)).map(vergleichsform));
      name = freierName(erwartet.name, belegt);
      await L.fs.mkdir(path.join(basis, name), { recursive: true });
    } catch (e) {
      st.anlegbar = { grund: ordnerFehlerText(e, 'datei') ?? fehlerCode(e) };
      return null;
    }
    if (gen !== L.gen) return null;
    L.funde = [...(L.funde ?? []), { name, art: 'ok', programId: st.programId, ordnerName: name, stand: null }];
  } else {
    name = wahl.name;
    st.zusaetze.weitererOrdner = wahl.weiterer;
    if (wahl.art === 'neuer') {
      Object.assign(st, { ordnerName: name, pfad: path.join(basis, name), existiert: true, indexFormat: 'neuer' as const });
      return null; // S3: nicht anfassen
    }
  }
  st.anlegbar = null;
  let pfad = path.join(basis, name);
  let lstFehler: unknown = null;
  const lst = await L.fs.lstat(pfad).catch((e: unknown) => { lstFehler = e; return null; });
  if (gen !== L.gen) return null;
  if (!lst && lstFehler !== null && fehlerCode(lstFehler) !== 'ENOENT') { // nicht lesbar ist nicht „weg“: nichts neu anlegen, die Zeile nennt es (W2)
    s.ordnerProblem = [{ art: 'grund', datei: name, grund: `Lesefehler (${fehlerCode(lstFehler)})` }];
    return null;
  }
  if (!lst || !lst.isDirectory() || lst.isSymbolicLink()) { // weg oder Verknüpfung: beim nächsten Mal neu suchen, ein alter Index im Speicher gilt für einen neuen Ordner nicht
    L.funde = null;
    s.index = null;
    s.indexOffen = false;
    Object.assign(st, { ordnerName: null, pfad: null, existiert: false });
    return null;
  }
  const probleme: OrdnerProblem[] = [];
  // Index: der im Speicher (diese Sitzung), sonst die Datei; kaputt → beiseite, neu aufbauen (9.8).
  let index: OrdnerIndex | null = s.index;
  let neuAufgebaut = false;
  let gelesen: ReturnType<typeof leseIndex> | 'fehlt';
  try {
    gelesen = leseIndex(await L.fs.readFile(path.join(pfad, INDEX_DATEI), 'utf8'));
  } catch (e) {
    if (fehlerCode(e) !== 'ENOENT') { // nicht lesbar: kein Plan; die Zeile zeigt Ordner und Problem (W3)
      Object.assign(st, { ordnerName: name, pfad, existiert: true, indexFormat: 'eins' as const });
      s.ordnerProblem = [{ art: 'grund', datei: INDEX_DATEI, grund: `Schreibfehler (${fehlerCode(e)})` }];
      return null;
    }
    gelesen = 'fehlt';
  }
  if (gen !== L.gen) return null;
  if (gelesen !== 'fehlt' && gelesen.art === 'neuer') {
    Object.assign(st, { ordnerName: name, pfad, existiert: true, indexFormat: 'neuer' as const });
    return null;
  }
  if (gelesen !== 'fehlt' && gelesen.art === 'kaputt') {
    // Beiseitelegen (9.8): scheitert es, bleibt der kaputte Index unangetastet, die Zeile nennt es, die nächste Runde versucht es erneut (W4)
    const z = ordnerPfad({ art: 'kaputt', seitenOrdner: pfad, zeit: new Date(L.d.jetzt()) });
    let beiseite: string | null = z.ok ? null : 'Name';
    if (z.ok) {
      try {
        await umbenennenImOrdner(L.fs, pfad, path.join(pfad, INDEX_DATEI), z.pfad);
      } catch (e) {
        beiseite = fehlerCode(e);
      }
    }
    if (gen !== L.gen) return null;
    if (beiseite !== null) {
      Object.assign(st, { ordnerName: name, pfad, existiert: true, indexFormat: 'eins' as const });
      s.ordnerProblem = [{ art: 'grund', datei: INDEX_DATEI, grund: `Schreibfehler (${beiseite})` }];
      return null;
    }
    neuAufgebaut = true;
    s.indexOffen = true;
  } else if (gelesen !== 'fehlt' && gelesen.art === 'ok' && gelesen.index.programId !== st.programId) {
    L.funde = null; // inzwischen ein Ordner eines anderen Side Events: neu suchen
    Object.assign(st, { ordnerName: null, pfad: null, existiert: false });
    return null;
  } else if (gelesen !== 'fehlt' && gelesen.art === 'ok' && (!index || (!s.indexOffen && gelesen.index.stand > index.stand))) {
    index = gelesen.index; // die Datei ist neuer (ein anderer Rechner hat sie fortgeschrieben) oder es gibt keinen Stand im Speicher
  }
  // Titel geändert (9.1): umbenennen, wenn der Ordner noch den Namen trägt, den der Launcher ihm gab.
  const erwartet = ordnerPfad({ art: 'seitenOrdner', basisPfad: basis, titel: st.titel });
  if (index && erwartet.ok && vergleichsform(index.ordnerName) === vergleichsform(name) && vergleichsform(erwartet.name) !== vergleichsform(name)) {
    // nur, wenn der neue Name frei ist (9.1); die Dateiliste des Zielordners frisch gelesen, auch eine fremde Datei zählt (9.6, 9.9)
    let belegt: Set<string> | null = null;
    try {
      belegt = new Set((await L.fs.readdir(basis)).map(vergleichsform));
    } catch (x) {
      probleme.push({ art: 'grund', datei: name, grund: `Lesefehler (${fehlerCode(x)})` });
    }
    if (gen !== L.gen) return null;
    const neu = erwartet.name;
    if (belegt && !belegt.has(vergleichsform(neu))) {
      try {
        await L.fs.rename(pfad, path.join(basis, neu));
        L.d.log.info(LAUF_TEXTE.umbenannt(name, neu));
        L.funde = (L.funde ?? []).map((f) => (f.name === name ? { ...f, name: neu, ordnerName: neu } : f));
        name = neu;
        pfad = path.join(basis, neu);
        index = { ...index, ordnerName: neu, titel: st.titel };
        s.indexOffen = true;
      } catch (x) {
        probleme.push(istOffen(x) ? { art: 'ordner-umbenennen-wartet' } : { art: 'grund', datei: name, grund: grundText(x, 'datei') });
      }
      if (gen !== L.gen) return null;
    }
  }
  const dateien = await liste(L, pfad);
  if (gen !== L.gen) return null;
  if (!index) {
    const eigene = dateien.filter((f) => !/^\.(.+)\.(\d+)\.(jm-laden|jm-neu)$/.test(f.name) && !/\.\d+\.tmp$/.test(f.name));
    if (gelesen === 'fehlt' && eigene.length) neuAufgebaut = true; // Index fehlt, Ordner hat Dateien: wie kaputt
    index = { format: 1, programId: st.programId, titel: st.titel, ordnerName: name, stand: '', eintraege: [] };
    s.indexOffen = true;
  }
  Object.assign(st, { ordnerName: name, pfad, existiert: true, indexFormat: 'eins' as const });
  // Aufräumen (9.6): beim ersten Zugriff in dieser Sitzung, nur mit eigener Sperre, nur nach genauem Muster.
  if (!s.aufgeraeumt && L.gehalten) {
    s.aufgeraeumt = true;
    const genannt = new Set(index.eintraege.map((x) => x.wartet).filter((x): x is string => !!x));
    const urls = new Set(index.eintraege.filter((x) => x.art === 'link').map((x) => x.datei));
    for (const f of [...dateien]) {
      const zw = /^\.(.+)\.(\d+)\.(jm-laden|jm-neu)$/.exec(f.name);
      const tmp = /^(.+)\.(\d+)\.tmp$/.exec(f.name);
      const weg = (zw && !(zw[3] === 'jm-neu' && genannt.has(f.name))) || (tmp && (tmp[1] === INDEX_DATEI || urls.has(tmp[1])));
      if (!weg) continue;
      await L.fs.unlink(path.join(pfad, f.name)).catch(() => undefined);
      dateien.splice(dateien.indexOf(f), 1);
    }
    if (gen !== L.gen) return null;
  }
  // entfernt/ muss ein echter Ordner sein (9.10).
  let entfernt: OrdnerDatei[] | null = [];
  const el = await L.fs.lstat(path.join(pfad, 'entfernt')).catch(() => null);
  if (el && (!el.isDirectory() || el.isSymbolicLink())) entfernt = null;
  else if (el) entfernt = await liste(L, path.join(pfad, 'entfernt'));
  // .url-Dateien, die der Index nicht nennt (Übernahme, 9.5 Zeile 1).
  const urlInhalte = new Map<string, string>();
  const genannteDateien = new Set(index.eintraege.map((x) => vergleichsform(x.datei)));
  for (const f of dateien) {
    if (!/\.url$/i.test(f.name) || genannteDateien.has(vergleichsform(f.name)) || f.groesse > 2100) continue;
    try {
      urlInhalte.set(vergleichsform(f.name), await L.fs.readFile(path.join(pfad, f.name), 'utf8'));
    } catch {
      /* nicht lesbar: keine Übernahme */
    }
  }
  if (gen !== L.gen) return null;
  return { pfad, name, index, neuAufgebaut, dateien, entfernt, urlInhalte, probleme };
}

/** Index atomar schreiben (9.8); scheitert es, bleibt er im Speicher offen und die Zeile nennt das Problem. */
async function schreibeIndex(L: Lauf, s: SeIntern, o: { pfad: string; index: OrdnerIndex }): Promise<boolean> {
  s.index = o.index;
  const code = await schreibeAtomar(L, path.join(o.pfad, INDEX_DATEI), indexText(o.index));
  s.indexOffen = code !== null;
  if (code === null) s.zuletztGeschriebenMs = L.d.jetzt();
  s.stand.probleme = s.stand.probleme.filter((p) => p.art !== 'index-nicht-schreibbar');
  if (code !== null) s.stand.probleme.push({ art: 'index-nicht-schreibbar', code });
  return code === null;
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
    if (s.ordnerProblem) {
      // Der Ordner ist da oder darf nicht entstehen, aber etwas war nicht lesbar oder nicht schreibbar: die Zeile nennt es ehrlich (G8)
      Object.assign(st, { n: gueltig.length, k: 0, probleme: s.ordnerProblem });
    } else if (gueltig.length === 0 && !st.existiert && st.indexFormat !== 'neuer') {
      // kein Ordner, weil das Side Event keine Anhänge hat (OF4): gelungen mit n = 0
      Object.assign(st, { n: 0, k: 0, probleme: [] });
    } else if (gueltig.length > 0 && !st.existiert) {
      // Anhänge da, aber der Ordner entstand nicht: ehrlich 0 von n im Ordner (S13), nie „Keine Anhänge“ (S11)
      Object.assign(st, { n: gueltig.length, k: 0, probleme: [] });
    }
    return false;
  }
  if (o.neuAufgebaut) st.zusaetze.indexNeuAufgebaut = true;
  const index = o.index;
  const plan = planeSideEvent({
    seitenOrdner: o.pfad, index, dateien: o.dateien, entfernt: o.entfernt ?? [], urlInhalte: o.urlInhalte,
    anhaenge: gueltig, ungueltig, jetzt: new Date(L.d.jetzt()),
    zurueckgehaltenBis: (id, inhalt) => L.fehlschlaege.get(`${e.programId}\n${id}\n${inhalt}`)?.bis ?? null,
  });
  const ctx: Ctx = {
    L, s, e, o, gen, signal: L.abbruch.signal, zwischenAngelegt: false, probleme: [...o.probleme], geaendert: s.indexOffen, platziert: new Set(), weg: new Set(), uebernommen: 0,
  };
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
  if (o.neuAufgebaut) L.d.log.warn(LAUF_TEXTE.indexKaputt(o.name, ctx.uebernommen));
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
  o: Ordner;
  gen: number;
  /** Abbruchsignal der Generation, in der `bearbeite` den Kontext anlegte (nicht das der gerade gültigen). */
  signal: AbortSignal;
  /** Die Zwischendatei kann existieren (ab dem Aufruf von `ladeStromInDatei`); vorher gibt es nichts zu löschen. */
  zwischenAngelegt: boolean;
  probleme: OrdnerProblem[];
  geaendert: boolean;
  platziert: Set<string>;
  weg: Set<string>;
  uebernommen: number;
}

/** Nach dem Plan: Zahlen, Probleme, Index nachschreiben (bei Änderung, offen oder einmal je Runde), Stand. */
async function abschluss(ctx: Ctx, abgerufen: string, gueltig: GueltigerAnhang[], ganz: boolean): Promise<void> {
  const { L, s, o } = ctx;
  const st = s.stand;
  const vf = vergleichsform;
  const da = new Set(o.dateien.map((f) => vf(f.name)));
  for (const n of ctx.platziert) da.add(n);
  for (const n of ctx.weg) da.delete(n);
  let k = 0;
  let bediener = 0;
  let gesperrt = 0;
  for (const a of gueltig) {
    const x = o.index.eintraege.find((y) => y.id === a.m.id);
    if (!x || x.zustand !== 'aktiv' || x.inhalt !== inhaltSignatur(a) || !da.has(vf(x.datei))) continue;
    k++;
    const f = o.dateien.find((y) => vf(y.name) === vf(x.datei));
    if (f && !ctx.platziert.has(vf(x.datei)) && x.mtimeMs !== undefined && f.mtimeMs !== x.mtimeMs) bediener++;
    if (!istLinkAnhang(a.m)) {
      const r = ordnerPfad({ art: 'datei', seitenOrdner: null, label: a.m.label, kind: 'file', mime: a.m.asset?.mime_type ?? null });
      if (r.ok && r.gesperrt) gesperrt++;
    }
  }
  if (ganz) o.index.stand = abgerufen;
  const faellig = s.zuletztGeschriebenMs === null || auffrischenFaellig(s.zuletztGeschriebenMs, L.d.jetzt(), L.taktMs);
  if (ctx.geaendert || s.indexOffen || (ganz && faellig)) await schreibeIndex(L, s, o);
  if (ctx.gen !== L.gen) return;
  const indexProblem = st.probleme.filter((p) => p.art === 'index-nicht-schreibbar');
  Object.assign(st, {
    abruf: 'gelungen', stand: abgerufen, standAusFrueherSitzung: false, fehler: null, n: gueltig.length, k,
    probleme: [...ctx.probleme, ...indexProblem],
  });
  st.zusaetze.bedienerGeaendert = bediener;
  st.zusaetze.gesperrteEndungen = gesperrt;
  s.letzterAgendaText = null;
}

function eintragSetzen(ctx: Ctx, x: IndexEintrag): void {
  const liste = ctx.o.index.eintraege;
  const i = liste.findIndex((y) => y.id === x.id);
  if (i >= 0) liste[i] = x;
  else liste.push(x);
  ctx.geaendert = true;
}

/** Namen, die ein neuer Name nicht nehmen darf (9.9), aus einer frisch gelesenen Liste des Ordners. */
async function belegteNamen(ctx: Ctx, ausserId: string, ausserDatei: string | null = null): Promise<Set<string>> {
  const vf = vergleichsform;
  const belegt = new Set((await ctx.L.fs.readdir(ctx.o.pfad)).map(vf));
  for (const x of ctx.o.index.eintraege) {
    if (x.id === ausserId) continue;
    if (x.zustand !== 'entfernt') belegt.add(vf(x.datei));
    if (x.wartet) belegt.add(vf(x.wartet));
  }
  for (const n of [INDEX_DATEI, SPERR_DATEI, 'entfernt']) belegt.add(vf(n));
  if (ausserDatei !== null) belegt.delete(vf(ausserDatei));
  return belegt;
}

async function fuehreAus(ctx: Ctx, s: PlanSchritt): Promise<void> {
  switch (s.art) {
    case 'fehler':
      ctx.probleme.push({ art: 'grund', datei: s.datei, grund: s.grund });
      return;
    case 'zurueckgehalten': {
      const f = ctx.L.fehlschlaege.get(`${ctx.e.programId}\n${s.id}\n${s.inhalt}`);
      ctx.probleme.push({ art: 'grund', datei: s.datei, grund: f?.grund ?? '', naechsterVersuch: iso(versuchsZeit(ctx, s.bis)) });
      return;
    }
    default:
      return fuehreSchrittAus(ctx, s);
  }
}

/** Der Name liegt in dieser Runde nicht mehr im Ordner; eine frühere Meldung „platziert“ unter gleichem Namen gilt nicht mehr. */
function markiereWeg(ctx: Ctx, name: string): void {
  const n = vergleichsform(name);
  ctx.platziert.delete(n);
  ctx.weg.add(n);
}

/** Der Name liegt jetzt im Ordner; eine frühere Meldung „weg“ unter gleichem Namen (alte Fassung nach entfernt/) gilt nicht mehr. */
function markierePlatziert(ctx: Ctx, name: string): void {
  const n = vergleichsform(name);
  ctx.weg.delete(n);
  ctx.platziert.add(n);
}

function eintrag(ctx: Ctx, id: string): IndexEintrag | undefined {
  return ctx.o.index.eintraege.find((x) => x.id === id);
}

function istOffen(e: unknown): boolean {
  return ['EBUSY', 'EPERM', 'EACCES'].includes(fehlerCode(e));
}

/** Grund für Zeile und Meldung (T22/T23); auch für den manuellen Download im Panel. */
export function grundText(e: unknown, wo: 'download' | 'datei'): string {
  if (e instanceof GrundFehler) return e.message;
  if (e instanceof StromFehler) return ordnerFehlerText(e, wo, e.grund === 'leerlauf' ? 'leerlauf' : undefined) ?? e.grund;
  return ordnerFehlerText(e, wo) ?? '';
}

type Schritt<A extends PlanSchritt['art']> = Extract<PlanSchritt, { art: A }>;

async function fuehreSchrittAus(ctx: Ctx, s: Exclude<PlanSchritt, { art: 'fehler' | 'zurueckgehalten' }>): Promise<void> {
  const { L, o } = ctx;
  const vf = vergleichsform;
  if (s.art === 'uebernehmen') {
    const m = s.anhang.m;
    eintragSetzen(ctx, { id: m.id, art: istLinkAnhang(m) ? 'link' : 'datei', zustand: 'aktiv', datei: s.datei, label: m.label, inhalt: s.inhalt, bytes: s.bytes, mtimeMs: s.mtimeMs });
    if (s.neu) {
      ctx.uebernommen++;
      L.d.log.info(LAUF_TEXTE.uebernommen(s.datei));
    }
    return;
  }
  if (s.art === 'umbenennen') {
    const x = eintrag(ctx, s.anhang.m.id);
    if (!x) return;
    try {
      const neu = freierName(s.wunsch, await belegteNamen(ctx, s.anhang.m.id, s.von));
      if (ctx.gen !== L.gen) return; // 9.4: nach dem await die Generation prüfen, kein Umbenennen
      await umbenennenImOrdner(L.fs, o.pfad, path.join(o.pfad, s.von), path.join(o.pfad, neu));
      markiereWeg(ctx, s.von);
      markierePlatziert(ctx, neu);
      eintragSetzen(ctx, { ...x, datei: neu, label: s.anhang.m.label });
      L.d.log.info(LAUF_TEXTE.umbenannt(s.von, neu));
    } catch (e) {
      ctx.probleme.push(istOffen(e) ? { art: 'umbenennen-wartet', datei: s.von } : { art: 'grund', datei: s.von, grund: grundText(e, 'datei') });
    }
    return;
  }
  if (s.art === 'nach-entfernt') {
    const x = eintrag(ctx, s.id);
    const r = await nachEntfernt(ctx, s.datei, s.zusatz);
    if (!r.ok) { if (ctx.gen === L.gen) ctx.probleme.push({ art: 'grund', datei: s.datei, grund: r.grund }); return; }
    if (s.zusatz === 'unvollstaendig') {
      // die unvollständige Datei gehört keinem Anhang mehr; das folgende Laden legt den Eintrag neu an
      ctx.o.index.eintraege = ctx.o.index.eintraege.filter((y) => y.id !== s.id);
      ctx.geaendert = true;
      return;
    }
    if (x) eintragSetzen(ctx, { ...x, zustand: 'entfernt', datei: `entfernt/${r.name}`, seit: iso(L.d.jetzt()), wartet: undefined, inhaltNeu: undefined });
    L.d.log.info(LAUF_TEXTE.entferntInIveo(s.datei));
    return;
  }
  if (s.art === 'zurueckholen') {
    const x = eintrag(ctx, s.anhang.m.id);
    if (!x) return;
    try {
      const neu = freierName(s.wunsch, await belegteNamen(ctx, s.anhang.m.id));
      if (ctx.gen !== L.gen) return; // 9.4: nach dem await die Generation prüfen, kein Umbenennen
      await umbenennenImOrdner(L.fs, o.pfad, path.join(o.pfad, 'entfernt', s.aus), path.join(o.pfad, neu));
      const st = await L.fs.stat(path.join(o.pfad, neu));
      markierePlatziert(ctx, neu);
      eintragSetzen(ctx, { ...x, zustand: 'aktiv', datei: neu, label: s.anhang.m.label, bytes: st.size, mtimeMs: st.mtimeMs, seit: undefined });
      L.d.log.info(LAUF_TEXTE.zurueckgeholt(neu));
    } catch (e) {
      ctx.probleme.push({ art: 'grund', datei: s.aus, grund: grundText(e, 'datei') });
    }
    return;
  }
  if (s.art === 'tauschen') return tausche(ctx, s);
  return lade(ctx, s);
}

/** Datei nach `entfernt/` (9.10): echter Ordner, Name nach 9.12, Kollision dort mit Zusatz, Wächter auf Quelle und Ziel. */
async function nachEntfernt(ctx: Ctx, datei: string, zusatz: null | 'ersetzt' | 'unvollstaendig'): Promise<{ ok: true; name: string } | { ok: false; grund: string; offen: boolean }> {
  const { L, o } = ctx;
  const ent = path.join(o.pfad, 'entfernt');
  try {
    const el = await L.fs.lstat(ent).catch((e: unknown) => {
      if (fehlerCode(e) === 'ENOENT') return null;
      throw e;
    });
    if (el && (!el.isDirectory() || el.isSymbolicLink())) return { ok: false, grund: ORDNER_GRUENDE.entferntKeinOrdner, offen: false };
    if (!el) await L.fs.mkdir(ent, { recursive: true });
    const r = ordnerPfad({ art: 'entfernt', seitenOrdner: o.pfad, datei, zusatz: zusatz ? { art: zusatz, zeit: new Date(L.d.jetzt()) } : null });
    if (!r.ok) return { ok: false, grund: r.grund, offen: false };
    const name = freierName(r.name, new Set((await L.fs.readdir(ent)).map(vergleichsform)));
    if (ctx.gen !== L.gen) return { ok: false, grund: '', offen: false }; // 9.4: kein Umbenennen für eine alte Generation
    await umbenennenImOrdner(L.fs, o.pfad, path.join(o.pfad, datei), path.join(ent, name));
    markiereWeg(ctx, datei);
    return { ok: true, name };
  } catch (e) {
    return { ok: false, grund: grundText(e, 'datei'), offen: istOffen(e) };
  }
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
async function lade(ctx: Ctx, s: Schritt<'laden'> | Schritt<'url-schreiben'>): Promise<void> {
  const { L, o, gen } = ctx;
  const m = s.anhang.m;
  const z = ordnerPfad({ art: 'zwischen', seitenOrdner: o.pfad, kennung: m.id, pid: L.d.pid, endung: 'jm-laden' });
  if (!z.ok) return scheitert(ctx, s, new GrundFehler(z.grund, 'Zwischendatei'));
  ctx.zwischenAngelegt = false; // je Schritt: der Kontext lebt über alle Anhänge, das Flag darf nicht vom vorigen stammen
  let bytes: number;
  try {
    if (s.art === 'url-schreiben') {
      const inhalt = Buffer.from(urlDateiInhalt(s.inhalt), 'utf8');
      const fh = await L.fs.open(z.pfad, 'wx');
      ctx.zwischenAngelegt = true; // ab hier gibt es die Datei: jeder Fehler (write, sync, close) räumt sie im catch weg (9.6)
      try {
        await fh.write(inhalt);
        await fh.sync();
      } finally {
        await fh.close();
      }
      bytes = inhalt.byteLength;
    } else {
      bytes = await ladeDatei(ctx, s, z.pfad);
    }
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

/** Grenze je Datei (Spec 9.6, E29): size_bytes, ohne gültiges size_bytes 2 GiB; ein size_bytes darüber wird nicht geladen. */
export function pruefeAssetGroesse(groesse: number | null): void {
  if (groesse !== null && groesse > GRENZE) throw new GrundFehler(ORDNER_GRUENDE.zuGross(groesse), `size_bytes ${groesse}`);
}

/**
 * Ein Asset in eine neue Datei laden (Spec 9.6, 8.6): EIN Baustein für die Ablage und den manuellen Download im Panel.
 * Der Leerlauf-Zeitgeber läuft auch vor dem ersten Byte (um oeffneAsset), danach misst ladeStromInDatei je Stück selbst.
 * Wirft `StromFehler` (leerlauf, bedienung bei Abbruch durch `signal`, platz), `GrundFehler` (zu groß, mehr Daten als
 * size_bytes, unvollständig) oder den Fehler von oeffneAsset bzw. des Dateisystems. Die Zwischendatei löscht der Aufrufer.
 */
export async function ladeAsset(p: {
  fs: OrdnerFs; client: Pick<IveoClient, 'oeffneAsset'>; ref: string; ziel: string; groesse: number | null; leerlaufMs: number;
  signal?: AbortSignal; jetzt(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(h: unknown): void;
  platzReicht?(geschrieben: number): Promise<boolean>; fortschritt?(bytes: number): void;
  /** Nach dem Öffnen des Assets, vor dem ersten Schreiben: ab hier kann es die Zwischendatei geben. */
  nachOeffnen?(): void;
}): Promise<number> {
  pruefeAssetGroesse(p.groesse);
  const grenze = p.groesse !== null ? Math.min(p.groesse, GRENZE) : GRENZE;
  const ac = new AbortController();
  const weiter = (): void => ac.abort();
  if (p.signal?.aborted) ac.abort();
  p.signal?.addEventListener('abort', weiter);
  let leer = false;
  let geschrieben = 0;
  try {
    const h = p.setTimeout(() => { leer = true; ac.abort(); }, p.leerlaufMs); // Leerlauf auch vor dem ersten Byte
    let strom: Awaited<ReturnType<Pick<IveoClient, 'oeffneAsset'>['oeffneAsset']>>;
    try {
      strom = await p.client.oeffneAsset(p.ref, { signal: ac.signal });
    } catch (x) {
      if (leer) throw new StromFehler('leerlauf');
      if (ac.signal.aborted) throw new StromFehler('bedienung');
      throw x;
    } finally {
      p.clearTimeout(h);
    }
    p.nachOeffnen?.();
    const r = await ladeStromInDatei(p.fs, strom.body, p.ziel, {
      grenze, leerlaufMs: p.leerlaufMs, signal: ac.signal, jetzt: p.jetzt, setTimeout: p.setTimeout, clearTimeout: p.clearTimeout,
      platzReicht: p.platzReicht,
      fortschritt: (b) => { geschrieben = b; p.fortschritt?.(b); },
    });
    if (p.groesse !== null && r.bytes !== p.groesse) throw new GrundFehler(ORDNER_GRUENDE.unvollstaendig(r.bytes, p.groesse), `${r.bytes} Bytes`);
    return r.bytes;
  } catch (x) {
    if (x instanceof StromFehler && x.grund === 'zu-gross') {
      throw new GrundFehler(p.groesse !== null ? ORDNER_GRUENDE.mehrDaten(p.groesse) : ORDNER_GRUENDE.zuGross(geschrieben), `mehr als ${grenze} Bytes`);
    }
    throw x;
  } finally {
    p.signal?.removeEventListener('abort', weiter);
  }
}

async function ladeDatei(ctx: Ctx, s: Schritt<'laden'>, ziel: string): Promise<number> {
  const { L, o } = ctx;
  const m = s.anhang.m;
  const groesse = s.anhang.groesse;
  const st = ctx.s.stand;
  pruefeAssetGroesse(groesse);
  let frei = await freierPlatz(L, o.pfad);
  if (ctx.gen !== L.gen) throw new StromFehler('bedienung'); // 9.4: nach dem await die Generation prüfen, kein Abruf, kein Dateizugriff
  const grenze = groesse !== null ? Math.min(groesse, GRENZE) : GRENZE;
  if (frei < (groesse !== null ? grenze + GIB : GIB)) throw new GrundFehler(ORDNER_GRUENDE.wenigPlatz(frei), `frei ${frei} Bytes`);
  const client = L.d.downloadClient();
  if (!client || !m.asset) throw new StromFehler('bedienung');
  st.laedt = { datei: s.wunsch, bytes: 0, groesse };
  L.download = { programId: ctx.e.programId, datei: s.wunsch };
  fortschritt(L);
  melde(L);
  try {
    return await ladeAsset({
      fs: L.fs, client, ref: m.asset.url, ziel, groesse, leerlaufMs: L.leerlaufMs, signal: ctx.signal,
      jetzt: L.d.jetzt, setTimeout: L.d.setTimeout, clearTimeout: L.d.clearTimeout,
      nachOeffnen: () => { ctx.zwischenAngelegt = true; },
      platzReicht: groesse === null ? async () => { frei = await freierPlatz(L, o.pfad); return frei >= GIB; } : undefined,
      fortschritt: (b) => {
        st.laedt = { datei: s.wunsch, bytes: b, groesse };
        if (L.d.jetzt() - Date.parse(L.kopf.letzterFortschritt ?? '') >= 1000) fortschritt(L);
        melde(L, true);
      },
    });
  } catch (x) {
    if (x instanceof StromFehler && x.grund === 'platz') throw new GrundFehler(ORDNER_GRUENDE.wenigPlatz(frei), `frei ${frei} Bytes`);
    throw x;
  }
}

/**
 * Zeit, zu der nach einer Rückhaltung bis `bis` wirklich ein Versuch kommt (11.1, G8): beim aktiven Side Event der erste Takt ab `bis`
 * (Takt-Raster), sonst der Beginn der ersten Runde ab `bis` („gegen“ wie bei der Zeit des Basisordners): nicht `bis` selbst, denn
 * dazwischen gibt es keinen Versuch, die Zeile nennte eine Zeit, die schon vorbei ist.
 */
function versuchsZeit(ctx: Ctx, bis: number): number {
  const { L, e } = ctx;
  if (e.aktiv || !(L.taktMs > 0)) {
    const takt = L.taktZuletzt ?? L.d.jetzt();
    return takt + Math.max(1, Math.ceil((bis - takt) / L.taktMs)) * L.taktMs;
  }
  let runde = Date.parse(L.kopf.naechsteRundeGegen ?? '');
  if (!Number.isFinite(runde)) return bis;
  const abstand = naechsterFaelligerTakt(0, L.taktMs);
  while (runde < bis) runde += abstand;
  return runde;
}

/** Fehlschlag merken (Rückhaltung, 9.6), Zeile und einmal je neuem Grund ins Log (T23). */
function scheitert(ctx: Ctx, s: Schritt<'laden'> | Schritt<'url-schreiben'>, x: unknown): void {
  const { L } = ctx;
  const m = s.anhang.m;
  const grund = grundText(x, s.art === 'laden' ? 'download' : 'datei');
  const schluessel = `${ctx.e.programId}\n${m.id}\n${s.inhalt}`;
  const f = (L.fehlschlaege.get(schluessel)?.f ?? 0) + 1;
  const bis = rueckhaltungBis(f, L.d.jetzt());
  L.fehlschlaege.set(schluessel, { f, bis, grund, datei: s.wunsch });
  ctx.probleme.push({ art: 'grund', datei: s.wunsch, grund, naechsterVersuch: iso(versuchsZeit(ctx, bis)) });
  if (ctx.s.logGrund.get(m.id) !== grund) {
    ctx.s.logGrund.set(m.id, grund);
    L.d.log.warn(LAUF_TEXTE.nichtGeladen(s.wunsch, grund, rohmeldung(x)));
  }
}

/**
 * Platzieren ohne Überschreiben (9.6): (1) Index-Eintrag „laedt“ mit Zielname und Bytezahl, (2) alte Fassung nach
 * entfernt/ (geöffnet → die neue wartet als `.jm-neu`), (3) Zielname frisch prüfen und umbenennen, (4) „aktiv“.
 */
async function platziere(ctx: Ctx, s: Schritt<'laden'> | Schritt<'url-schreiben'>, zwischen: string, bytes: number): Promise<void> {
  const { L, o, gen } = ctx;
  const m = s.anhang.m;
  const art = s.art === 'url-schreiben' ? 'link' : 'datei';
  const vorher = eintrag(ctx, m.id);
  // (1) „laedt“ trägt schon den freien Namen, unter dem die Datei gleich liegt (die alte Fassung zählt nicht, sie geht in (2)
  // nach entfernt/): Stürzt der Launcher zwischen (3) und (4) ab, prüft die Wiederaufnahme genau diese Datei (9.5 Zeile 7),
  // nie eine fremde gleicher Bytezahl unter dem Wunschnamen (E33).
  // Beim Ersetzen trägt „laedt“ die Änderungszeit der alten Fassung (mtimeMs): Liegt nach einem Abbruch unter dem Namen noch
  // eine Datei mit dieser Zeit, ist es die alte Fassung, nicht die neue (9.5 Zeile 7), auch bei gleicher Bytezahl.
  const altMtime = s.alt ? o.dateien.find((f) => vergleichsform(f.name) === vergleichsform(s.alt!))?.mtimeMs : undefined;
  let ziel: string;
  try {
    ziel = freierName(s.wunsch, await belegteNamen(ctx, m.id, s.alt));
  } catch (x) {
    await L.fs.unlink(zwischen).catch(() => undefined);
    return scheitert(ctx, s, x);
  }
  if (gen !== L.gen) { await L.fs.unlink(zwischen).catch(() => undefined); return; } // 9.4: nach dem await, vor dem Index
  eintragSetzen(ctx, { id: m.id, art, zustand: 'laedt', datei: ziel, label: m.label, inhalt: s.inhalt, bytes, mtimeMs: altMtime });
  await schreibeIndex(L, ctx.s, o);
  if (gen !== L.gen) { await L.fs.unlink(zwischen).catch(() => undefined); return; }
  if (s.alt) {
    const r = await nachEntfernt(ctx, s.alt, 'ersetzt');
    if (gen !== L.gen) { await L.fs.unlink(zwischen).catch(() => undefined); return; } // 9.4: weder .jm-neu noch Index für eine alte Generation
    if (!r.ok && r.offen && vorher) {
      const neu = ordnerPfad({ art: 'zwischen', seitenOrdner: o.pfad, kennung: m.id, pid: L.d.pid, endung: 'jm-neu' });
      try {
        if (!neu.ok) throw new GrundFehler(neu.grund, 'Zwischendatei');
        await umbenennenImOrdner(L.fs, o.pfad, zwischen, neu.pfad);
      } catch (x) {
        await L.fs.unlink(zwischen).catch(() => undefined);
        eintragSetzen(ctx, vorher);
        return scheitert(ctx, s, x);
      }
      eintragSetzen(ctx, { ...vorher, wartet: neu.name, inhaltNeu: s.inhalt });
      await schreibeIndex(L, ctx.s, o);
      ctx.probleme.push({ art: 'neue-fassung-wartet', datei: s.alt });
      return;
    }
    if (!r.ok) {
      await L.fs.unlink(zwischen).catch(() => undefined);
      if (vorher) eintragSetzen(ctx, vorher);
      // Schritt (2) scheitert aus einem anderen Grund als „geöffnet“ (z. B. „entfernt“ ist eine Datei, 9.10): wie jedes gescheiterte
      // Laden mit Rückhaltung, Zeit des nächsten Versuchs und einmal je neuem Grund im Log (9.6, T23), nie ein Download je Takt.
      return scheitert(ctx, s, new GrundFehler(r.grund, r.grund));
    }
    L.d.log.info(LAUF_TEXTE.entferntErsetzt(s.alt));
  }
  try {
    // (3) unmittelbar vorher neu prüfen (E48); weicht der Name ab, zuerst „laedt“ nachführen, dann umbenennen
    const frisch = freierName(s.wunsch, await belegteNamen(ctx, m.id));
    if (gen !== L.gen) { await L.fs.unlink(zwischen).catch(() => undefined); return; } // 9.4: kein Umbenennen für eine alte Generation
    if (frisch !== ziel) {
      ziel = frisch;
      eintragSetzen(ctx, { id: m.id, art, zustand: 'laedt', datei: ziel, label: m.label, inhalt: s.inhalt, bytes, mtimeMs: altMtime });
      await schreibeIndex(L, ctx.s, o);
      if (gen !== L.gen) { await L.fs.unlink(zwischen).catch(() => undefined); return; }
    }
    await umbenennenImOrdner(L.fs, o.pfad, zwischen, path.join(o.pfad, ziel));
  } catch (x) {
    await L.fs.unlink(zwischen).catch(() => undefined);
    return scheitert(ctx, s, x);
  }
  const st = await L.fs.stat(path.join(o.pfad, ziel)).catch(() => null);
  markierePlatziert(ctx, ziel);
  eintragSetzen(ctx, { id: m.id, art, zustand: 'aktiv', datei: ziel, label: m.label, inhalt: s.inhalt, bytes, mtimeMs: st?.mtimeMs });
  await schreibeIndex(L, ctx.s, o);
  L.fehlschlaege.delete(`${ctx.e.programId}\n${m.id}\n${s.inhalt}`);
  ctx.s.logGrund.delete(m.id);
  L.d.log.info(LAUF_TEXTE.geladen(ziel, megabyte(bytes)));
  if (s.art === 'laden' && s.gesperrt) L.d.log.info(LAUF_TEXTE.endungGesperrt(s.gesperrt, m.label, ziel));
}

/** Wartende Fassung tauschen (9.6): alte nach entfernt/, dann `.jm-neu` unter den Namen, ohne neuen Download. */
async function tausche(ctx: Ctx, s: Schritt<'tauschen'>): Promise<void> {
  const { L, o } = ctx;
  const m = s.anhang.m;
  const x = eintrag(ctx, m.id);
  if (!x) return;
  if (s.alt) {
    const r = await nachEntfernt(ctx, s.alt, 'ersetzt');
    if (ctx.gen !== L.gen) return; // 9.4: nach jedem await prüfen, 9.14: aus = nichts mehr schreiben
    if (!r.ok) {
      ctx.probleme.push(r.offen ? { art: 'neue-fassung-wartet', datei: s.alt } : { art: 'grund', datei: s.alt, grund: r.grund });
      return;
    }
    L.d.log.info(LAUF_TEXTE.entferntErsetzt(s.alt));
  }
  try {
    const ziel = freierName(s.wunsch, await belegteNamen(ctx, m.id));
    if (ctx.gen !== L.gen) return; // 9.4: kein Umbenennen für eine alte Generation
    await umbenennenImOrdner(L.fs, o.pfad, path.join(o.pfad, s.wartet), path.join(o.pfad, ziel));
    const st = await L.fs.stat(path.join(o.pfad, ziel));
    markierePlatziert(ctx, ziel);
    eintragSetzen(ctx, { id: m.id, art: x.art, zustand: 'aktiv', datei: ziel, label: m.label, inhalt: s.inhalt, bytes: st.size, mtimeMs: st.mtimeMs });
    L.d.log.info(LAUF_TEXTE.geladen(ziel, megabyte(st.size)));
  } catch (e) {
    ctx.probleme.push({ art: 'grund', datei: s.wunsch, grund: grundText(e, 'datei') });
  }
}

// ── Ende des Moduls ──
