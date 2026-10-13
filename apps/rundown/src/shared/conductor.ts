// Reine Conductor-Logik (keine node/electron-Imports) — damit per Selftest
// (test/selftest.ts) ohne Electron prüfbar. Baut Protokollzeilen für das suite-
// weite Zeilenprotokoll (@jm/suite-control-protocol) und rechnet die Navigation
// über das Rundown-Dokument aus.
import type { Endpoint, RundownAction, RundownDoc, RundownNav, RundownRow } from './types';
import type { Zeiger } from './ausgangsstand';

/** Endpunkt + woher er stammt. */
export interface DesiredEndpoint extends Endpoint {
  source: 'mdns' | 'manual';
}

/**
 * Gewünschte Steuer-Endpunkte je Rolle aus mDNS-Funden und manuellen Overrides
 * zusammenführen — der manuelle Override gewinnt (Cross-Subnet / mDNS aus).
 */
export function mergeEndpoints(
  discovered: Record<string, Endpoint>,
  overrides: Record<string, Endpoint>,
): Record<string, DesiredEndpoint> {
  const out: Record<string, DesiredEndpoint> = {};
  for (const [role, ep] of Object.entries(discovered)) out[role] = { host: ep.host, port: ep.port, source: 'mdns' };
  for (const [role, ep] of Object.entries(overrides)) out[role] = { host: ep.host, port: ep.port, source: 'manual' };
  return out;
}

// ── Teil 2b R2: Rundown im Verbund (Spec 17.3, 17.4) ─────────────────────────

/** Steuerport des Launchers (suite-control-protocol, Rolle `launcher`). */
const LAUNCHER_PORT = 8736;

/**
 * Was die Launcher-Wahl aus der Kopplung braucht (Spec 17.4). Strukturgleich mit einem Ausschnitt von
 * `VerbundKopplung` aus `@jm/app-runtime`; hier ohne Paket-Import (G7). `null` = keine Kopplungsdatei.
 */
export interface KopplungFuerWahl {
  rolle: 'aus' | 'master' | 'slave';
  masterAdresse: string | null;
  adressen: string[];
  letzteAdresse: string | null;
}

/** Adresse vergleichbar machen: Groß/Klein, Klammern, IPv6-Zone und `::ffff:` vor einer IPv4 fallen weg. */
function normAdresse(a: string): string {
  let s = a.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (s.startsWith('::ffff:') && s.includes('.')) s = s.slice('::ffff:'.length);
  return s;
}

function gleicheAdresse(a: string, b: string): boolean {
  return a.trim() !== '' && normAdresse(a) === normAdresse(b);
}

/**
 * Launcher wählen, an den `LAUNCHER …`-Befehle gehen (Spec 17.4, Z2):
 *  - Rolle Slave, verbunden (`masterAdresse`): der Fund mit dieser Adresse, sonst einer mit einer Adresse
 *    aus `adressen`; ohne passenden Fund direkt `masterAdresse` mit Port 8736.
 *  - Rolle Slave, nicht verbunden: der Fund passend zu `letzteAdresse`, sonst keiner.
 *  - Rolle Master: der Fund auf diesem Rechner (`istHier`, im Main `istHostDieserRechner`).
 *  - Einzelplatz (keine Datei, Rolle aus): wie bisher der letzte Fund.
 * Manuelle Endpunkte haben weiter Vorrang (`mergeEndpoints`, im Aufrufer). Ändert die Eingaben nicht.
 */
export function waehleLauncher(
  funde: readonly Endpoint[],
  kopplung: KopplungFuerWahl | null,
  istHier: (host: string) => boolean,
): Endpoint | null {
  if (!kopplung || kopplung.rolle === 'aus') return funde.length ? funde[funde.length - 1] : null;
  if (kopplung.rolle === 'master') return funde.find((f) => istHier(f.host)) ?? null;
  const { masterAdresse, adressen, letzteAdresse } = kopplung;
  if (masterAdresse) {
    const passend =
      funde.find((f) => gleicheAdresse(f.host, masterAdresse)) ?? funde.find((f) => adressen.some((a) => gleicheAdresse(f.host, a)));
    return passend ?? { host: masterAdresse, port: LAUNCHER_PORT };
  }
  if (letzteAdresse) return funde.find((f) => gleicheAdresse(f.host, letzteAdresse)) ?? null;
  return null;
}

/**
 * Neue oder gleiche Show (Spec 17.3): Der Rundown entscheidet über seinen Zeiger (gemerkte Show =
 * masterId + masterSchluessel), nicht über `neueShow` aus app-runtime. Ohne Zeiger, mit einem Zeiger auf
 * eine eigene Show oder ohne Schlüssel im Stand: `neu`.
 */
export function entscheideMasterStand(zeiger: Zeiger | null, stand: { masterId: string; schluessel: string | null }): 'gleich' | 'neu' {
  if (!zeiger || !('quelle' in zeiger) || stand.schluessel === null) return 'neu';
  return zeiger.masterId === stand.masterId && zeiger.masterSchluessel === stand.schluessel ? 'gleich' : 'neu';
}

/** Stehender Hinweis auf B, wenn die Show am Master eine eigene Rundown-Datei trägt (Spec 17.3, wörtlich). */
export const HINWEIS_RUNDOWN_DATEI_AM_MASTER =
  'Die Rundown-Datei dieser Show liegt am Master und wird hier nicht geladen. Ihre Aktionen fehlen auf diesem Rechner.';

/** Trägt die Show am Master eine eigene Rundown-Datei? (`mitDokument` aus dem Stand, Spec 13.1, 17.3) */
export function mitRundownDokument(mitDokument: readonly string[]): boolean {
  return mitDokument.includes('jm-rundown');
}

/**
 * Stehender Hinweis zur Rundown-Datei am Master (Spec 17.3): einmal je Show zeigen und loggen. `fuer` ist der neue
 * Merker (`masterId|masterSchluessel`; `null` = Hinweis entfernen), `zeigen` nur beim ersten Stand dieser Show.
 * Weggeklickt bleibt er so weg, bis eine andere Show kommt.
 */
export function dokumentHinweis(
  vorher: string | null,
  stand: { masterId: string; mitDokument: readonly string[] },
  masterSchluessel: string,
): { fuer: string | null; zeigen: boolean } {
  if (!mitRundownDokument(stand.mitDokument)) return { fuer: null, zeigen: false };
  const fuer = `${stand.masterId}|${masterSchluessel}`;
  return { fuer, zeigen: fuer !== vorher };
}

/** Ausgangsstand einer neuen Show vom Master (Spec 17.3). */
export type MasterAusgang = 'gedaechtnis' | 'uebergang' | 'leer' | 'bleibt';

/**
 * Ladeweg einer neuen Show vom Master (Spec 17.3, wie `ladeAndereShow` ohne eigene Datei): Gedächtnis mit
 * Master-Schlüssel → Übergang (das aktuelle Dokument, wenn sein Name dem der Show gleicht, E25) → leer. Eine Show
 * ohne Ablauf und ohne Gedächtnis lässt das Dokument stehen (`bleibt`, wie 2a 5.2): Es gehört nicht zu ihr.
 */
export function masterAusgang(o: { mitGedaechtnis: boolean; ablaufLeer: boolean; docName: string; showName: string }): MasterAusgang {
  if (o.mitGedaechtnis) return 'gedaechtnis';
  if (o.ablaufLeer) return 'bleibt';
  return gleicherShowName(o.docName, o.showName) ? 'uebergang' : 'leer';
}

/**
 * Übergang (Spec 17.3, E25): Gilt das aktuelle Dokument als Ausgangsstand einer Master-Show ohne Gedächtnis?
 * Ja, wenn sein Name dem Namen der Show gleicht — nach `trim()`, ohne Rücksicht auf Groß/Klein. Leer nie.
 */
export function gleicherShowName(docName: string, showName: string): boolean {
  const a = docName.trim();
  return a !== '' && a.toLowerCase() === showName.trim().toLowerCase();
}

/**
 * Show-Deep-Link im Rundown (Spec 17.3 „Show-Deep-Link | Daten ignoriert“ und „Eigene Rundown-Datei der Show: wird auf
 * B nicht geladen“; die Rundown-eigene Regel geht 16.1 vor, E24): Im Verbundmodus lädt der Rundown aus dem Link nichts,
 * weder Daten noch Dokument. Ein Show-Link kommt oft ohne bewusste Handlung (Launcher, Doppelklick); er darf einen
 * laufenden Rundown nicht auf die erste Zeile setzen, GO-Folgen abbrechen oder das Gedächtnis der Master-Show
 * überschreiben. Statt der 16.1-Zeile eine eigene, wahre Logzeile; ⟨Name⟩ ist der Dateiname des Links, gesäubert und
 * gekürzt über `kuerze` (im Main `kuerzeName`). Außerhalb des Verbundmodus gilt der Weg aus 2a (`laden`).
 */
export function showLinkWeg(
  imVerbund: boolean,
  pfad: string,
  kuerze: (name: string) => string,
): { weg: 'laden' } | { weg: 'ignorieren'; log: string } {
  if (!imVerbund) return { weg: 'laden' };
  const name = pfad.split(/[\\/]/).filter((t) => t !== '').pop() ?? pfad;
  return { weg: 'ignorieren', log: `Verbund: Show-Link „${kuerze(name)}“ – der Rundown folgt der Show vom Master und lädt daraus nichts.` };
}

/**
 * Protokollzeile für eine Aktion bauen. Switcher-Verben haben KEINEN Namespace
 * (Rückwärtskompat), alle anderen Rollen `<ROLLE> <VERB> [args]`.
 *   buildActionLine('timer','start',[])      → 'TIMER START'
 *   buildActionLine('presenter','goto',[3])  → 'PRESENTER GOTO 3'
 *   buildActionLine('switcher','program',[2])→ 'PROGRAM 2'
 */
export function buildActionLine(role: string, verb: string, args: (string | number)[] = []): string {
  const v = verb.toUpperCase();
  const tail = args.length ? ' ' + args.map((a) => String(a)).join(' ') : '';
  return role === 'switcher' ? `${v}${tail}` : `${role.toUpperCase()} ${v}${tail}`;
}

let _idCounter = 0;
/** Kurze, eindeutige ID für Zeilen/Aktionen (Editor + Default-Dokument). */
export function newId(prefix = 'x'): string {
  return `${prefix}_${Date.now().toString(36)}${(_idCounter++).toString(36)}`;
}

/** Index in [0, len-1] klemmen (leeres Dokument → 0). */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(i), len - 1));
}

/** Nicht entfallene Zeile: feuert und kann scharf werden (Teil 2a, Spec 4.3). */
function lebt(row: RundownRow | undefined): boolean {
  return row !== undefined && row.entfallen !== true;
}

/** Ab `i` in Richtung `schritt` die erste nicht entfallene Zeile, sonst -1. */
function sucheLebende(rows: RundownRow[], i: number, schritt: 1 | -1): number {
  for (let j = i; j >= 0 && j < rows.length; j += schritt) if (lebt(rows[j])) return j;
  return -1;
}

/**
 * Auf eine nicht entfallene Zeile stellen: `i` selbst, sonst die nächste dahinter,
 * sonst die vorige. Gibt es keine (leer oder alles entfallen), bleibt es bei `i`.
 */
function aufLebende(rows: RundownRow[], i: number): number {
  if (lebt(rows[i])) return i;
  const naechste = sucheLebende(rows, i + 1, 1);
  if (naechste >= 0) return naechste;
  const vorige = sucheLebende(rows, i - 1, -1);
  return vorige >= 0 ? vorige : i;
}

/**
 * Navigation auf dem Dokument auswerten. Liefert den neuen Index der scharfen
 * Zeile und — nur bei GO — die zu feuernden (aktivierten) Aktionen. GO rückt die
 * Markierung um eins weiter (Cue-Stack), NEXT/PREV/GOTO verschieben ohne Feuern.
 *
 * Entfallene Zeilen (Teil 2a, Spec 4.3) feuern nie: GO, NEXT und PREV springen
 * über sie hinweg; steht `index` auf einer entfallenen, gilt die nächste nicht
 * entfallene als scharf. GOTO n zählt alle sichtbaren Zeilen; landet es auf
 * einer entfallenen, wird die nächste nicht entfallene scharf, sonst die vorige.
 * `fire` enthält dieselben Aktionsobjekte wie die Zeile — keine festgeschriebenen
 * Kopien, denn ein `timer goto` wird erst beim Senden aufgelöst (5.4, 6.2).
 */
export function navigate(
  doc: RundownDoc,
  index: number,
  cmd: RundownNav,
): { index: number; fire: RundownAction[] } {
  const rows = doc.rows;
  const cur = aufLebende(rows, clampIndex(index, rows.length));
  const weiter = (schritt: 1 | -1): number => {
    const j = sucheLebende(rows, cur + schritt, schritt);
    return j >= 0 ? j : cur;
  };
  switch (cmd.t) {
    case 'go': {
      const row = rows[cur];
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled) : [];
      return { index: weiter(1), fire };
    }
    case 'next':
      return { index: weiter(1), fire: [] };
    case 'prev':
      return { index: weiter(-1), fire: [] };
    case 'goto':
      return { index: aufLebende(rows, clampIndex(cmd.n - 1, rows.length)), fire: [] };
    default:
      return { index: cur, fire: [] };
  }
}
