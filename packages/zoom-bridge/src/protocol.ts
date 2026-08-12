// Das Protokoll zwischen zoom-bridge.exe und der TypeScript-Seite.
//
// SCHNITT: auf der Rohrleitung stehen ZAHLEN, keine Namen. Der Namenskatalog liegt
// hier, an genau einer Stelle — sonst waere er nur mit SDK und Compiler pruefbar.
// Die C++-Seite schreibt den Klartextnamen zusaetzlich auf stderr; das ist Diagnose,
// kein Protokoll, und darf sich doppeln.

export type MeetingStatusName =
  | 'idle'
  | 'connecting'
  | 'waitingForHost'
  | 'waitingRoom'
  | 'inMeeting'
  | 'disconnecting'
  | 'reconnecting'
  | 'ended'
  | 'failed'
  | 'other';

export type UserRoleName = 'none' | 'host' | 'coHost' | 'panelist' | 'breakoutModerator' | 'attendee';

export interface Participant {
  /** GetUserID() — gilt NUR innerhalb dieser Sitzung, wechselt bei Wiederverbindung. */
  id: number;
  name: string;
  /** GetPersistentId() — ueber Wiederverbindungen stabil, kann leer sein. */
  persistentId: string;
  self: boolean;
  videoOn: boolean;
  hasCamera: boolean;
  inWaitingRoom: boolean;
  role: UserRoleName;
}

export type Command =
  | { cmd: 'init' }
  | { cmd: 'auth'; jwt: string }
  | { cmd: 'join'; meetingId: string; passcode: string; displayName: string }
  | { cmd: 'leave' }
  | { cmd: 'quit' };

/** Was woertlich auf stdout der Bridge steht. */
export type WireEvent =
  | { ev: 'ready'; sdkVersion: string }
  | { ev: 'auth'; code: number }
  | { ev: 'status'; status: MeetingStatusName; raw: number; code: number }
  | { ev: 'roster'; list: Participant[] }
  | { ev: 'joined'; p: Participant }
  | { ev: 'left'; id: number }
  | { ev: 'renamed'; id: number; name: string }
  // "source" ist PFLICHT, nicht optional: drei verschiedene Ursachen im
  // nativen Teil (callbacks.cpp/session.cpp) koennen dieselbe Kombination aus
  // ev/canRecordRaw melden - ein unaufgeforderter Rundruf des Reglers
  // ("broadcast"), die Antwort auf UNSER eigenes Gesuch ("requestAnswer")
  // oder eine synchrone Sofortpruefung, bevor ueberhaupt gefragt wurde
  // ("check"). Ein Feld, das mal da ist und mal nicht, ist die naechste
  // Falle - deshalb immer vergeben, auch wenn canRecordRaw false ist.
  // "timedOut" unterscheidet die ENDGUELTIGE "es kommt keine Antwort mehr"
  // -Zeile von der VORUEBERGEHENDEN "gerade gefragt, Antwort steht noch aus"
  // -Zeile - beide waren vorher byte-gleich
  // ({"canRecordRaw":false,"requested":true}), obwohl der eine Zustand fuer
  // immer gilt und der andere sich noch aendern kann (Nachbesserung 1,
  // Owner-Entscheidung: Befund A + B).
  | {
      ev: 'privilege';
      canRecordRaw: boolean;
      source: 'broadcast' | 'requestAnswer' | 'check';
      requested?: boolean;
      denied?: boolean;
      timedOut?: boolean;
    }
  | { ev: 'error'; where: string; code: number | string }
  | { ev: 'bye' }
  | { ev: string; [k: string]: unknown };

/** Dasselbe Ereignis, nachdem TypeScript Namen und Klartext dazugesetzt hat. */
export type BridgeEvent = WireEvent & { name?: string; result?: string; explain?: string };

// --- Fehlerkatalog ----------------------------------------------------------
// Woertlich aus zoom_sdk_def.h, Fassung 7.1.5 (43953). Die Aufzaehlung ist dort
// fortlaufend ab 0. Zwei Eintraege sind am echten SDK GEMESSEN und bestaetigen die
// Reihenfolge: 7 = SDKERR_UNINITIALIZE (Sondierlauf 1), 12 = SDKERR_NO_PERMISSION
// (Sondierlauf 4). Ohne diese Anker waere die Tabelle geraten.
export const SDK_ERROR_NAMES: Record<number, string> = {
  0: 'SDKERR_SUCCESS',
  1: 'SDKERR_NO_IMPL',
  2: 'SDKERR_WRONG_USAGE',
  3: 'SDKERR_INVALID_PARAMETER',
  4: 'SDKERR_MODULE_LOAD_FAILED',
  5: 'SDKERR_MEMORY_FAILED',
  6: 'SDKERR_SERVICE_FAILED',
  7: 'SDKERR_UNINITIALIZE',
  8: 'SDKERR_UNAUTHENTICATION',
  9: 'SDKERR_NORECORDINGINPROCESS',
  10: 'SDKERR_TRANSCODER_NOFOUND',
  11: 'SDKERR_VIDEO_NOTREADY',
  12: 'SDKERR_NO_PERMISSION',
  13: 'SDKERR_UNKNOWN',
  14: 'SDKERR_OTHER_SDK_INSTANCE_RUNNING',
  15: 'SDKERR_INTERNAL_ERROR',
  16: 'SDKERR_NO_AUDIODEVICE_ISFOUND',
  17: 'SDKERR_NO_VIDEODEVICE_ISFOUND',
  18: 'SDKERR_TOO_FREQUENT_CALL',
  19: 'SDKERR_FAIL_ASSIGN_USER_PRIVILEGE',
  20: 'SDKERR_MEETING_DONT_SUPPORT_FEATURE',
  21: 'SDKERR_MEETING_NOT_SHARE_SENDER',
  22: 'SDKERR_MEETING_YOU_HAVE_NO_SHARE',
  23: 'SDKERR_MEETING_VIEWTYPE_PARAMETER_IS_WRONG',
  24: 'SDKERR_MEETING_ANNOTATION_IS_OFF',
  25: 'SDKERR_SETTING_OS_DONT_SUPPORT',
  26: 'SDKERR_EMAIL_LOGIN_IS_DISABLED',
  27: 'SDKERR_HARDWARE_NOT_MEET_FOR_VB',
  28: 'SDKERR_NEED_USER_CONFIRM_RECORD_DISCLAIMER',
  29: 'SDKERR_NO_SHARE_DATA',
  30: 'SDKERR_SHARE_CANNOT_SUBSCRIBE_MYSELF',
  31: 'SDKERR_NOT_IN_MEETING',
  32: 'SDKERR_NOT_JOIN_AUDIO',
  33: 'SDKERR_HARDWARE_DONT_SUPPORT',
  34: 'SDKERR_DOMAIN_DONT_SUPPORT',
  35: 'SDKERR_MEETING_REMOTE_CONTROL_IS_OFF',
  36: 'SDKERR_FILETRANSFER_ERROR',
  37: 'SDKERR_BREAKOUT_ROOM_NOT_CREATED',
};

/**
 * Namen, die WIR vergeben — nicht das SDK.
 *
 * KEIN nackter Sammelschlüssel `timeout` mehr: zwei verschiedene Ursachen
 * dürfen nie dieselbe Meldung bekommen (Kernregel dieses Vorhabens). Ein
 * namenloser Sammelbegriff würde sich beim nächsten Mal wieder von
 * irgendwoher einen Namen borgen — genau das ist mit `authTimeout` passiert,
 * der hier zuerst als `timeout` → `JOIN_TIMEOUT` gemeldet wurde, obwohl die
 * Ursache die Anmeldung war, nicht der Beitritt. Fällt der Sammelschlüssel
 * weg, bekommt ein unbekannter Code sichtbar `OWN_UNKNOWN(...)` — sichtbar
 * falsch ist besser als unsichtbar falsch.
 */
export const OWN_ERROR_NAMES: Record<string, string> = {
  authTimeout: 'AUTH_TIMEOUT',
  joinTimeout: 'JOIN_TIMEOUT',
  // Der native EOF-Wachhund fuer einen offenen Beitritt (main.cpp,
  // sessionJoinPending()) - eine ANDERE Ursache als joinTimeout oben (das
  // misst hier in bridge.ts, ob je ein Endzustand erreicht wird). Aus Task 7
  // zurueckgestellt, hier nachgetragen (Task 8).
  joinEofTimeout: 'JOIN_EOF_TIMEOUT',
  // Der native EOF-Wachhund fuer eine offene Aufnahme-Erlaubnis-Anfrage
  // (main.cpp, sessionPrivilegePending()) - RequestLocalRecordingPrivilege()
  // beantwortet sich ASYNCHRON ueber onLocalRecordingPrivilegeRequestStatus,
  // dieselbe Rennbedingung wie bei auth/join, aber eine ANDERE Ursache als
  // authTimeout/joinTimeout/joinEofTimeout - keiner der drei beschreibt eine
  // Aufnahme-Erlaubnis-Anfrage, darum der EIGENE Name statt eines geliehenen.
  privilegeEofTimeout: 'PRIVILEGE_EOF_TIMEOUT',
  badJson: 'BAD_JSON',
  badMeetingId: 'BAD_MEETING_ID',
  spawnFailed: 'SPAWN_FAILED',
  exited: 'EXITED_UNEXPECTEDLY',
  // bridge.ts' stop()-Nachbrenner: schlaegt das erzwungene kill() fehl (liefert
  // false zurueck, oder der Kindprozess meldet nachtraeglich ein eigenes
  // 'error'-Ereignis), darf das nicht spurlos verschwinden - vorher landete
  // ein solches 'error' in einem laengst aufgeloesten Promise (stiller
  // Leerlauf). Eine ANDERE Ursache als exited (misst den NORMALEN, von der
  // Bridge SELBST gemeldeten Abgang) oder spawnFailed (misst den START):
  // killFailed misst das Gegenteil - der Prozess laesst sich am ENDE nicht
  // mehr beenden. Nachbesserung 1 zu Task 10.
  killFailed: 'KILL_FAILED',
  // Ein ASYNCHRONER 'error' auf dem stdin-Strom des Kindprozesses (z. B.
  // ERR_STREAM_WRITE_AFTER_END, wenn zwei gleichzeitige stop()-Aufrufe frueher
  // gegen denselben bereits beendeten Strom schrieben, oder EPIPE, wenn das
  // Kind mitten im Schreiben stirbt). Eine ANDERE Ursache als killFailed:
  // killFailed misst das TERMINIEREN (kill() schlaegt fehl), stdinError misst
  // das SENDEN (ein Schreibversuch schlaegt fehl) - zwei verschiedene
  // Vorgaenge, die sonst denselben Namen bekaemen. Nachbesserung 2 zu Task 10.
  stdinError: 'STDIN_ERROR',
};

export function sdkErrorName(code: number): string {
  // NIE auf den naechstaehnlichen runden: eine erfundene Ursache ist schlimmer als
  // gar keine, weil sie die Suche in die falsche Richtung schickt.
  return SDK_ERROR_NAMES[code] ?? `SDKERR_UNKNOWN(${code})`;
}

// Woertlich aus auth_service_interface.h, fortlaufend ab 0.
export const AUTH_RESULT_NAMES: Record<number, string> = {
  0: 'AUTHRET_SUCCESS',
  1: 'AUTHRET_KEYORSECRETEMPTY',
  2: 'AUTHRET_KEYORSECRETWRONG',
  3: 'AUTHRET_ACCOUNTNOTSUPPORT',
  4: 'AUTHRET_ACCOUNTNOTENABLESDK',
  5: 'AUTHRET_UNKNOWN',
  6: 'AUTHRET_SERVICE_BUSY',
  7: 'AUTHRET_NONE',
  8: 'AUTHRET_OVERTIME',
  9: 'AUTHRET_NETWORKISSUE',
  10: 'AUTHRET_CLIENT_INCOMPATIBLE',
  11: 'AUTHRET_JWTTOKENWRONG',
  12: 'AUTHRET_LIMIT_EXCEEDED_EXCEPTION',
};

export function authResultName(code: number): string {
  return AUTH_RESULT_NAMES[code] ?? `AUTHRET_UNKNOWN_CODE(${code})`;
}

// --- Status und sein Code ---------------------------------------------------
// onMeetingStatusChanged liefert in iResult ZWEI verschiedene Aufzaehlungen:
// MeetingFailCode bei FAILED, EndMeetingReason bei ENDED. Sonst nichts Verwertbares.
const FAIL_CODES: Record<number, string> = {
  1: 'Verbindungsfehler',
  2: 'Wiederverbinden fehlgeschlagen',
  3: 'MMR-Fehler',
  4: 'falscher Kenncode',
  5: 'Sitzungsfehler',
  6: 'das Meeting ist vorbei',
  7: 'das Meeting hat noch nicht begonnen',
  8: 'dieses Meeting gibt es nicht',
  9: 'das Meeting ist voll',
  10: 'Client zu alt',
  12: 'das Meeting ist gesperrt',
  13: 'das Meeting ist eingeschraenkt',
  0xffff: 'unbekannter Grund',
};

const END_REASONS: Record<number, string> = {
  0: 'ohne besonderen Grund',
  1: 'vom Gastgeber entfernt',
  2: 'vom Gastgeber beendet',
  3: 'Wartezeit auf den Gastgeber abgelaufen',
  4: 'es war niemand mehr da',
  5: 'der Gastgeber hat ein anderes Meeting gestartet',
  6: 'Zeitgrenze des kostenlosen Meetings',
  7: 'undefiniert',
  8: 'der berechtigte Nutzer hat das Meeting verlassen',
};

export function explainStatus(status: MeetingStatusName, code: number): string {
  if (status === 'failed') return `gescheitert: ${FAIL_CODES[code] ?? `Fehlerschluessel ${code}`}`;
  if (status === 'ended') return `beendet: ${END_REASONS[code] ?? `Grund ${code}`}`;
  // Ausdruecklich KEINE Deutung: ausserhalb von failed/ended traegt iResult nichts.
  return status;
}

// --- Meeting-Nummer ---------------------------------------------------------
export function normalizeMeetingId(raw: string): string {
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(stripped)) {
    // Buchstaben still zu entfernen waere gefaehrlich: aus einer falschen Eingabe
    // wuerde klaglos eine falsche Nummer, und der Beitritt scheiterte spaeter aus
    // scheinbar unerklaerlichem Grund.
    throw new Error(`Meeting-Nummer enthaelt Zeichen, die keine Ziffern sind: "${trimmed}"`);
  }
  return stripped;
}

// --- Zeilen zusammensetzen ---------------------------------------------------
/**
 * Setzt Zeilen aus Datenpaketen zusammen. Ein Kindprozess liefert BELIEBIGE
 * Bruchstuecke — die Puffergrenze faellt regelmaessig mitten ins JSON. Wer je
 * Datenpaket parst, verliert Ereignisse, ohne dass irgendetwas abstuerzt.
 */
export class LineSplitter {
  private rest = '';

  push(chunk: string): string[] {
    this.rest += chunk;
    const parts = this.rest.split('\n');
    this.rest = parts.pop() ?? '';
    return parts.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l)).filter((l) => l.length > 0);
  }
}

export function parseWireEvent(line: string): WireEvent | null {
  if (!line.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    // Eine kaputte Zeile darf die Sitzung NICHT abreissen.
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const ev = (parsed as { ev?: unknown }).ev;
  if (typeof ev !== 'string' || ev.length === 0) return null;
  return parsed as WireEvent;
}

export function enrich(ev: WireEvent): BridgeEvent {
  if (ev.ev === 'error') {
    const code = (ev as { code: number | string }).code;
    const name = typeof code === 'number' ? sdkErrorName(code) : (OWN_ERROR_NAMES[code] ?? `OWN_UNKNOWN(${code})`);
    return { ...ev, name };
  }
  if (ev.ev === 'auth') {
    return { ...ev, result: authResultName((ev as { code: number }).code) };
  }
  if (ev.ev === 'status') {
    const s = ev as { status: MeetingStatusName; code: number };
    return { ...ev, explain: explainStatus(s.status, s.code) };
  }
  return ev;
}

export function serializeCommand(cmd: Command): string {
  return `${JSON.stringify(cmd)}\n`;
}
