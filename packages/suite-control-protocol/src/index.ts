// ─────────────────────────────────────────────────────────────────────────────
// @jm/suite-control-protocol — geteiltes, suite-weites TCP-Zeilenprotokoll für
// die Fernsteuerung ALLER JM-Tools (Switcher, Timer, Player, Titler, Prompter,
// Presenter, Recorder, DAW …) — z. B. durch das Bitfocus-Companion-Modul.
//
// Zeilenbasiert, ASCII, `\n`-terminiert. Jedes Tool öffnet einen TCP-Server
// (SuiteControlServer); Clients (Companion, Stage Display, Rundown) senden
// Befehle und empfangen Status.
//
//   Befehle (Client → Tool):   <NAMESPACE> <VERB> [args…]
//     z. B.  TIMER START · PLAYER CUE 3 · TITLER TAKE 2 · PROMPTER SCROLL ON
//     Status anfordern:  STATE?   (namespace-frei)
//
//   Status (Tool → Client), bei jeder Änderung + auf Verbindung/STATE?:
//     STATE ns=<rolle> <key>=<value> …       (beliebige key=value-Paare)
//
// RÜCKWÄRTSKOMPATIBILITÄT zum ursprünglichen Switcher-Protokoll
// (@jm/companion-protocol): Die alten Switcher-Verben werden weiterhin OHNE
// Namespace akzeptiert (`PREVIEW 2`, `CUT`, `RECORD START`) und implizit als
// `ns=switcher` interpretiert. Die Legacy-Funktionen parseCommand/formatState/
// parseState bleiben byte-kompatibel erhalten (siehe unten).
//
// Diese Datei ist BEWUSST frei von node/electron-Imports — sie wird unverändert
// in das standalone baubare Companion-Modul kopiert (scripts/sync-companion-
// protocol.mjs). Alles Netzwerk-/Plattformnahe lebt in ./server und ./client.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONTROL_PORT = 8723;

// ── Generisches Suite-Protokoll ──────────────────────────────────────────────

/** Ein geparster Steuerbefehl: Namespace (Tool-Rolle), Verb und rohe Argumente. */
export interface SuiteCommand {
  /** Tool-Rolle, kleingeschrieben, z. B. "switcher" | "timer" | "player". */
  ns: string;
  /** Verb, kleingeschrieben, z. B. "preview" | "start" | "cue". */
  verb: string;
  /** Rohe Token nach dem Verb (Strings; tool-seitig interpretiert). */
  args: string[];
}

/** Wert in einem STATE-Push. Booleans werden als 1/0 serialisiert. */
export type StateValue = string | number | boolean;

/** Ein generischer Status-Push: Namespace + beliebige key=value-Paare. */
export interface SuiteState {
  /** Rolle des sendenden Tools, z. B. "switcher". Leer = unbestimmt (Legacy). */
  ns: string;
  /** key=value-Paare; nach dem Parsen sind die Werte Strings. */
  kv: Record<string, StateValue>;
}

// Verben des ursprünglichen Switcher-Protokolls, die ohne Namespace gelten und
// dann `ns=switcher` bedeuten (Rückwärtskompatibilität).
const SWITCHER_VERBS = new Set(['PREVIEW', 'PROGRAM', 'CUT', 'AUTO', 'RECORD', 'STREAM']);

/** Einen `verb` für die Status-Abfrage erkennen (namespace-frei: STATE?/STATE). */
function isQueryHead(head: string): boolean {
  return head === 'STATE?' || head === 'STATE';
}

/**
 * Eine Befehlszeile generisch parsen. Liefert null bei Leer-/Unbekanntzeilen.
 *
 *  - `STATE?` / `STATE`               → { ns:'', verb:'query', args:[] }
 *  - bekanntes Switcher-Verb          → ns='switcher' (ohne Namespace)
 *  - `<NS> <VERB> [args…]`            → namespaced
 */
export function parseSuiteCommand(line: string): SuiteCommand | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const head = parts[0].toUpperCase();

  if (isQueryHead(head)) return { ns: '', verb: 'query', args: [] };
  if (SWITCHER_VERBS.has(head)) {
    return { ns: 'switcher', verb: head.toLowerCase(), args: parts.slice(1) };
  }
  if (parts.length >= 2) {
    return { ns: head.toLowerCase(), verb: parts[1].toLowerCase(), args: parts.slice(2) };
  }
  return null;
}

/** Einen SuiteCommand zur Zeile serialisieren (mit `\n`). */
export function formatSuiteCommand(c: SuiteCommand): string {
  const head = c.ns === 'switcher' ? c.verb.toUpperCase() : `${c.ns.toUpperCase()} ${c.verb.toUpperCase()}`;
  const tail = c.args.length ? ' ' + c.args.join(' ') : '';
  return `${head}${tail}\n`;
}

function serializeValue(v: StateValue): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

/** Generische Status-Zeile bauen: `STATE ns=<ns> k=v …\n`. */
export function formatSuiteState(s: SuiteState): string {
  const parts = ['STATE'];
  if (s.ns) parts.push(`ns=${s.ns}`);
  for (const [k, v] of Object.entries(s.kv)) parts.push(`${k}=${serializeValue(v)}`);
  return parts.join(' ') + '\n';
}

/**
 * Generische Status-Zeile parsen. `ns` wird aus dem `ns=`-Token gelesen (fehlt
 * es — Legacy-Switcher-Zeile —, bleibt ns ''). Alle übrigen key=value landen in
 * `kv` (Werte als Strings).
 */
export function parseSuiteState(line: string): SuiteState | null {
  const t = line.trim();
  if (!/^STATE\b/i.test(t)) return null;
  let ns = '';
  const kv: Record<string, StateValue> = {};
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf('=');
    if (eq <= 0) continue;
    const key = tok.slice(0, eq);
    const val = tok.slice(eq + 1);
    if (key.toLowerCase() === 'ns') ns = val;
    else kv[key] = val;
  }
  return { ns, kv };
}

/**
 * Zeilenpuffer für TCP-Streams: füttert rohe Chunks, ruft `onLine` je
 * vollständiger `\n`-terminierter Zeile. Beide Seiten (Server/Client) nutzen ihn.
 */
export function createLineBuffer(onLine: (line: string) => void): (chunk: string) => void {
  let buf = '';
  return (chunk: string): void => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) onLine(line);
    }
  };
}

// ── Auth-Handshake (P1, #59) ─────────────────────────────────────────────────
//
// Optionaler Challenge-Response-Handshake VOR den Befehlen — nur im `secure`-
// Modus (Auth+TLS). Reine String-Grammatik (node-frei, kopierbar ins Companion-
// Modul); die Krypto (Nonce/HMAC/timing-safe) liegt in @jm/auth-core, das
// Zustands-Handling in ./server bzw. ./client.
//
//   Server → AUTHREQ scs/1 nonce=<hex>      (statt sofortigem STATE)
//   Client → AUTH <proofHex>                (proof = HMAC-SHA256(token, nonce))
//   Server → AUTHOK                          → danach normaler STATE-Greeting
//          | AUTHFAIL                        → Verbindung schließen
//
// Im `open`-Modus (Default, heutiges Verhalten) wird nichts davon gesendet.

/** Protokoll-Tag im AUTHREQ (Version des Handshakes). */
export const AUTH_PROTO = 'scs/1';
/** Server-Antwort bei erfolgreicher Auth. */
export const AUTH_OK = 'AUTHOK';
/** Server-Antwort bei fehlgeschlagener Auth. */
export const AUTH_FAIL = 'AUTHFAIL';

/** Server→Client: Auth-Aufforderung mit frischer Nonce. */
export function formatAuthReq(nonceHex: string): string {
  return `AUTHREQ ${AUTH_PROTO} nonce=${nonceHex}\n`;
}

/** AUTHREQ-Zeile parsen (Client-Seite). Liefert null, wenn keine/ohne nonce. */
export function parseAuthReq(line: string): { proto: string; nonce: string } | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  if (parts[0].toUpperCase() !== 'AUTHREQ') return null;
  let proto = '';
  let nonce = '';
  for (const tok of parts.slice(1)) {
    const eq = tok.indexOf('=');
    if (eq < 0) {
      if (!proto) proto = tok; // erstes nacktes Token = Protokoll-Tag
      continue;
    }
    if (tok.slice(0, eq).toLowerCase() === 'nonce') nonce = tok.slice(eq + 1);
  }
  return nonce ? { proto, nonce } : null;
}

/** Client→Server: Beweiszeile. */
export function formatAuth(proofHex: string): string {
  return `AUTH ${proofHex}\n`;
}

/** AUTH-Zeile parsen (Server-Seite). Liefert null, wenn kein Beweis. */
export function parseAuth(line: string): { proof: string } | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  if (parts[0].toUpperCase() !== 'AUTH' || !parts[1]) return null;
  return { proof: parts[1] };
}

/** Erkennt die `AUTHOK`-Antwort (Client-Seite). */
export function isAuthOk(line: string): boolean {
  return line.trim().toUpperCase() === AUTH_OK;
}

/** Erkennt die `AUTHFAIL`-Antwort (Client-Seite). */
export function isAuthFail(line: string): boolean {
  return line.trim().toUpperCase() === AUTH_FAIL;
}

// ── Legacy-Switcher-Schicht (byte-kompatibel mit @jm/companion-protocol) ──────
//
// Unverändert übernommen, damit der bestehende Switcher-Server, das alte
// Companion-Modul (packages/companion-jm-switcher) und der bisherige Stage-
// Display-Client ohne jede Änderung weiterlaufen.

export type ControlCommand =
  | { type: 'preview'; scene: number }
  | { type: 'program'; scene: number }
  | { type: 'cut' }
  | { type: 'auto'; ms?: number }
  | { type: 'record'; on: boolean }
  | { type: 'stream'; on: boolean }
  | { type: 'queryState' };

export interface SwitcherStateMsg {
  /** 1-basierter Index der Program-Szene (0 = keine). */
  program: number;
  /** 1-basierter Index der Preview-Szene (0 = keine). */
  preview: number;
  recording: boolean;
  streaming: boolean;
  /** Anzahl Szenen (für Companion-Range/Dropdowns). */
  scenes: number;
}

/** Eine Switcher-Befehlszeile parsen (Legacy). Liefert null bei Unbekanntem. */
export function parseCommand(line: string): ControlCommand | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const verb = parts[0].toUpperCase();
  switch (verb) {
    case 'PREVIEW': {
      const n = Number(parts[1]);
      return Number.isFinite(n) ? { type: 'preview', scene: Math.trunc(n) } : null;
    }
    case 'PROGRAM': {
      const n = Number(parts[1]);
      return Number.isFinite(n) ? { type: 'program', scene: Math.trunc(n) } : null;
    }
    case 'CUT':
      return { type: 'cut' };
    case 'AUTO': {
      if (parts[1] == null) return { type: 'auto' };
      const ms = Number(parts[1]);
      return Number.isFinite(ms) ? { type: 'auto', ms: Math.max(0, Math.trunc(ms)) } : { type: 'auto' };
    }
    case 'RECORD': {
      const on = onOff(parts[1]);
      return on == null ? null : { type: 'record', on };
    }
    case 'STREAM': {
      const on = onOff(parts[1]);
      return on == null ? null : { type: 'stream', on };
    }
    case 'STATE?':
    case 'STATE':
      return { type: 'queryState' };
    default:
      return null;
  }
}

function onOff(s: string | undefined): boolean | null {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u === 'START' || u === 'ON' || u === '1' || u === 'TRUE') return true;
  if (u === 'STOP' || u === 'OFF' || u === '0' || u === 'FALSE') return false;
  return null;
}

/** Switcher-Status-Zeile bauen (Legacy, OHNE ns=). */
export function formatState(s: SwitcherStateMsg): string {
  return (
    `STATE program=${s.program} preview=${s.preview} ` +
    `recording=${s.recording ? 1 : 0} streaming=${s.streaming ? 1 : 0} scenes=${s.scenes}\n`
  );
}

/**
 * Switcher-Status-Zeile parsen (Legacy, Client-Seite). Liest die Felder per
 * Schlüssel — ein zusätzliches `ns=switcher`-Token wird ignoriert, sodass auch
 * das neue Format gelesen werden kann. Liefert null, wenn keine STATE-Zeile.
 */
export function parseState(line: string): SwitcherStateMsg | null {
  const t = line.trim();
  if (!/^STATE\s/i.test(t)) return null;
  const kv = new Map<string, string>();
  for (const tok of t.split(/\s+/).slice(1)) {
    const eq = tok.indexOf('=');
    if (eq > 0) kv.set(tok.slice(0, eq).toLowerCase(), tok.slice(eq + 1));
  }
  const num = (k: string): number => {
    const n = Number(kv.get(k));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    program: num('program'),
    preview: num('preview'),
    recording: kv.get('recording') === '1',
    streaming: kv.get('streaming') === '1',
    scenes: num('scenes'),
  };
}

/** SuiteState → SwitcherStateMsg (Hilfe für Switcher-Konsumenten). */
export function switcherStateFromSuite(s: SuiteState): SwitcherStateMsg {
  const num = (k: string): number => {
    const n = Number(s.kv[k]);
    return Number.isFinite(n) ? n : 0;
  };
  const bool = (k: string): boolean => s.kv[k] === '1' || s.kv[k] === true || s.kv[k] === 'true';
  return {
    program: num('program'),
    preview: num('preview'),
    recording: bool('recording'),
    streaming: bool('streaming'),
    scenes: num('scenes'),
  };
}

/** SwitcherStateMsg → SuiteState mit ns='switcher'. */
export function switcherStateToSuite(s: SwitcherStateMsg): SuiteState {
  return {
    ns: 'switcher',
    kv: {
      program: s.program,
      preview: s.preview,
      recording: s.recording,
      streaming: s.streaming,
      scenes: s.scenes,
    },
  };
}
