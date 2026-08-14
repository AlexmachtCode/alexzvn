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

export const VIDEO_RESOLUTIONS = ['90p', '180p', '360p', '720p', '1080p'] as const;
export type VideoResolutionKey = (typeof VIDEO_RESOLUTIONS)[number];

export type VideoState = 'subscribed' | 'live' | 'black' | 'unsubscribed';
// "meetingEnded" ist AUSDRUECKLICH nicht "command": beim Meeting-Ende hat
// niemand etwas befohlen. GEMESSEN am 2026-08-13, als es den Wert noch nicht
// gab: das Abo ueberlebte das Ende seiner Sitzung, und der letzte gemeldete
// Stand war "black"/"cameraOff" - "jemand hat die Kamera aus" fuer ein
// beendetes Meeting. Zwei Ursachen, ein Name.
export type VideoReason =
  | 'command'
  | 'frames'
  | 'cameraOff'
  | 'participantLeft'
  | 'rebound'
  | 'bufferMismatch'
  | 'meetingEnded';

export type Command =
  | { cmd: 'init' }
  | { cmd: 'auth'; jwt: string }
  | { cmd: 'join'; meetingId: string; passcode: string; displayName: string }
  | { cmd: 'leave' }
  | { cmd: 'quit' }
  | { cmd: 'videoSubscribe'; id: number; resolution?: VideoResolutionKey }
  | { cmd: 'videoUnsubscribe'; id: number };

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
  // "rotation" und "limitedRange" FEHLEN, solange kein Bild kam (bei
  // state:"subscribed" also immer). Ein Wert waere dort erfunden - und eine
  // erfundene 0 liesse sich spaeter nicht von einer gemessenen 0
  // unterscheiden.
  | {
      ev: 'video';
      id: number;
      state: VideoState;
      source: string;
      reason: VideoReason;
      rebindable: boolean;
      rotation?: number;
      limitedRange?: boolean;
    }
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
  // bridge.ts' Wachhund fuer eine Verbindungsphase, die NACH einem bereits
  // ruhenden Zustand wieder aufgeht - eine ANDERE Ursache als joinTimeout:
  // der misst den ERSTEN Beitritt (kam je eine Antwort?), dieser hier misst
  // ein WIEDERANKOPPELN (die Antwort war da, die Verbindung ist wieder weg).
  // GEMESSEN in der Owner-Abnahme, und zwar auf dem NORMALWEG mit Warteraum:
  // connecting -> waitingRoom -> reconnecting -> connecting -> inMeeting. Der
  // Warteraum ist ein RUHENDER Zustand (zu Recht: auf die Frage "ist der
  // Beitritt beantwortet?" ist er eine Antwort) und schaltet den
  // Beitritts-Wachhund ab - die zweite Verbindungsphase beim Einlass stand
  // danach voellig unbewacht da. Ein Haenger dort waere still geblieben,
  // genau der 90-Sekunden-Fall aus dem Stage-0-Spike, nur eine Station
  // spaeter.
  reconnectTimeout: 'RECONNECT_TIMEOUT',
  // Der native EOF-Wachhund fuer eine offene Aufnahme-Erlaubnis-Anfrage
  // (main.cpp, sessionPrivilegePending()) - RequestLocalRecordingPrivilege()
  // beantwortet sich ASYNCHRON ueber onLocalRecordingPrivilegeRequestStatus,
  // dieselbe Rennbedingung wie bei auth/join, aber eine ANDERE Ursache als
  // authTimeout/joinTimeout/joinEofTimeout - keiner der drei beschreibt eine
  // Aufnahme-Erlaubnis-Anfrage, darum der EIGENE Name statt eines geliehenen.
  privilegeEofTimeout: 'PRIVILEGE_EOF_TIMEOUT',
  // sessionLeave()s EIGENE 5-s-Pumpobergrenze (session.cpp) - eine ANDERE
  // Ursache als die drei EOF-Wachhunde oben: die messen die ANMELDUNG/den
  // BEITRITT/die AUFNAHME-ERLAUBNIS, diese hier misst das VERLASSEN. Kam in
  // Aufgabe 7 auf die Leitung, hatte aber bis zur Abschluss-Sichtung (Punkt
  // C) keinen Katalogeintrag - fiel darum auf OWN_UNKNOWN(leaveTimeout),
  // kein stiller Fehler, aber eine Luecke im Katalog, die diese Zeile
  // schliesst. Nach einer abgelaufenen Frist (Owner-Entscheidung, Punkt A)
  // ist diese Meldung die LETZTE verwertbare Information vor einem
  // moeglichen TerminateProcess.
  leaveTimeout: 'LEAVE_TIMEOUT',
  badJson: 'BAD_JSON',
  // ACHTUNG (Abschluss-Sichtung, Punkt E): war lange ein Katalogeintrag OHNE
  // Erzeuger - bridge.ts loeste child.on('exit') nur ein Versprechen auf,
  // meldete aber nichts. Stuerzte zoom-bridge.exe ab (Punkt A zeigt, dass
  // das real ist) oder wurde sie abgeschossen, blieb Session.phase fuer
  // immer auf 'inMeeting' stehen - die Bruecke wurde einfach still. Jetzt:
  // bridge.ts meldet dieses Ereignis IMMER, wenn das Kind endet, WAEHREND
  // KEIN stop() in Arbeit ist. Endet es WEGEN eines eigenen stop()-Aufrufs
  // (Quit-Befehl oder erzwungenes kill()), ist das der REGULAERE Abgang und
  // wird NICHT gemeldet - sonst waere der Normalweg ein Dauerfehler.
  exited: 'EXITED_UNEXPECTEDLY',
  // bridge.ts' stop()-Nachbrenner: schlaegt das erzwungene kill() fehl (liefert
  // false zurueck, oder der Kindprozess meldet nachtraeglich ein eigenes
  // 'error'-Ereignis), darf das nicht spurlos verschwinden - vorher landete
  // ein solches 'error' in einem laengst aufgeloesten Promise (stiller
  // Leerlauf). Eine ANDERE Ursache als exited (misst das unerwartete Ende
  // OHNE unser Zutun): killFailed misst das Gegenteil - WIR wollten beenden,
  // und selbst das schlug fehl. Nachbesserung 1 zu Task 10.
  killFailed: 'KILL_FAILED',
  // Ein ASYNCHRONER 'error' auf dem stdin-Strom des Kindprozesses (z. B.
  // ERR_STREAM_WRITE_AFTER_END, wenn zwei gleichzeitige stop()-Aufrufe frueher
  // gegen denselben bereits beendeten Strom schrieben, oder EPIPE, wenn das
  // Kind mitten im Schreiben stirbt). Eine ANDERE Ursache als killFailed:
  // killFailed misst das TERMINIEREN (kill() schlaegt fehl), stdinError misst
  // das SENDEN (ein Schreibversuch schlaegt fehl) - zwei verschiedene
  // Vorgaenge, die sonst denselben Namen bekaemen. Nachbesserung 2 zu Task 10.
  stdinError: 'STDIN_ERROR',
  // Rohvideo haengt an derselben Aufnahme-Erlaubnis, die Stage 1 einholt. Ein
  // Abo ohne sie STILL zuzulassen waere die schlimmere Variante: die Quelle
  // bliebe fuer immer schwarz und saehe aus wie "Gast hat die Kamera aus".
  videoNoPrivilege: 'VIDEO_NO_PRIVILEGE',
  videoUnknownParticipant: 'VIDEO_UNKNOWN_PARTICIPANT',
  videoAlreadySubscribed: 'VIDEO_ALREADY_SUBSCRIBED',
  videoNotSubscribed: 'VIDEO_NOT_SUBSCRIBED',
  // Zoom-Seite: createRenderer/subscribe lieferte einen SDK-Fehler.
  videoRendererFailed: 'VIDEO_RENDERER_FAILED',
  // StartRawRecording() ging nicht durch - der Schalter, der Zooms
  // Rohdaten-Rueckrufe ueberhaupt erst freigibt (der Name luegt, er schreibt
  // KEINE Datei; siehe native/session.h). WIEDER ein eigener Name: hier ist
  // das Meeting oder die Rolle schuld, bei videoRendererFailed das Abo. Die
  // beiden zu verschmelzen hat in Stage 2 GEMESSEN einen halben Tag gekostet -
  // der fehlende Schalter trug den Namen des Renderers.
  videoRawRecordingFailed: 'VIDEO_RAW_RECORDING_FAILED',
  // NDI-Seite: NDIlib_send_create schlug fehl. AUSDRUECKLICH ein anderer Name
  // als videoRendererFailed - die beiden schicken die Suche an
  // verschiedene Orte.
  videoSenderFailed: 'VIDEO_SENDER_FAILED',
  videoBadResolution: 'VIDEO_BAD_RESOLUTION',
  // GetBufferLen() passt nicht zu Breite*Hoehe*3/2. Der Puffer wird geprueft,
  // nicht geglaubt: ein falsch ausgelegter I420-Puffer erzeugt ein Bild, das
  // wie ein Kameradefekt aussieht - man sucht dann am falschen Ende.
  videoBufferMismatch: 'VIDEO_BUFFER_MISMATCH',
  // NDIlib_initialize() schlug fehl - die NDI-Laufzeit fehlt auf diesem
  // Rechner. WIEDER eine eigene Ursache: weder ein Zoom-Fehler noch ein
  // fehlgeschlagener EINZELNER Sender, sondern "auf dieser Maschine geht NDI
  // gar nicht". Wer das mit videoSenderFailed verschmelzen wuerde, schickte
  // die Suche zu einem Abo statt zur Installation.
  ndiInitFailed: 'NDI_INIT_FAILED',
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
    //
    // Die Meldung nennt NIE den Wert selbst (Nachbesserung 1, Befund B): der
    // haeufigste Vertipper ist, den KENNCODE ins Nummernfeld zu schreiben -
    // ein Echo der Roheingabe wuerde ihn dann auf den Schirm bringen. Wer die
    // Nummer eingegeben hat, kann in seine eigene Umgebung/Eingabe sehen; er
    // braucht das Echo nicht.
    throw new Error('Meeting-Nummer enthaelt Zeichen, die keine Ziffern sind. Erwartet: nur Ziffern (Leerzeichen/Bindestriche werden entfernt).');
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
