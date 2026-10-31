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

/**
 * Obergrenze des Bild-Versatzes (Befehl videoDelay), in Millisekunden. Die
 * native Seite prueft dieselbe Zahl (native/ndi_sender.h, kMaxVideoDelayMs) -
 * die beiden muessen gleich bleiben (test/delay-probe.mjs liest DIESE Zahl
 * und prueft sie und die naechsthoehere an der echten .exe). GESCHAETZT - nach
 * Gehoer, nicht gemessen - ist ein Versatz von knapp einer halben Sekunde
 * (Owner, Abnahmepunkt 5, 18.08.2026); gemessen sind nur unsere eigenen 6 ms.
 * 1000 ms laesst Luft ueber der Schaetzung und
 * begrenzt den Speicher: bei 1080p und 30 Bildern je Sekunde haelt jede Quelle
 * rund 3 MB je 33 ms Versatz vor.
 */
export const VIDEO_DELAY_MAX_MS = 1000;

// --- Slots (Connect 0.4.0; Spec 6.2-6.4, Gliederung 3.1) --------------------
// Ein Slot ist ein fester NDI-Sender mit einer Nummer von 1 bis SLOT_NR_MAX. Er zeigt im Modus participant eine
// Person, im Modus speaker den aktiven Sprecher und im Modus share die neueste Bildschirmfreigabe. Auf der
// Rohrleitung stehen die Werte dieser Kataloge woertlich. Die native Seite (native/slot_logic.h) und die Attrappe
// (test/fake-bridge.mjs) fuehren dieselben Namen in derselben Reihenfolge; der Selbsttest gleicht sie ab.

/** Hoechste Slot-Nummer (E2). */
export const SLOT_NR_MAX = 16;
export const SLOT_MODES = ['participant', 'speaker', 'share'] as const;
export type SlotMode = (typeof SLOT_MODES)[number];
/** Fuer Slots waehlbare Stufen (6.11): eine Teilmenge von VIDEO_RESOLUTIONS, ohne 90p und 180p. */
export const SLOT_RESOLUTIONS = ['360p', '720p', '1080p'] as const;
export type SlotResolution = (typeof SLOT_RESOLUTIONS)[number];
/** Feld `audio` von slotOn/slotSet: kein Meeting-Ton, Mischton oder Ton der gezeigten Person (Ton-Abbildung 7.1). */
export const SLOT_AUDIO_SETTINGS = ['off', 'mix', 'person'] as const;
export type SlotAudioSetting = (typeof SLOT_AUDIO_SETTINGS)[number];
/** Ersatzbild, solange kein Bild des Ziels kommt (6.12). */
export const SLOT_FALLBACKS = ['transparent', 'freeze', 'black', 'white'] as const;
export type SlotFallback = (typeof SLOT_FALLBACKS)[number];
export const SLOT_STATES = ['starting', 'live', 'fallback', 'held', 'off'] as const;
export type SlotState = (typeof SLOT_STATES)[number];
/** Was der Sender ZUSAETZLICH zu Zooms Bildern schickt (6.12); 'none' heisst: nur Zooms Bilder. */
export const SLOT_SENT = ['none', 'transparent', 'freeze', 'black', 'white', 'held'] as const;
export type SlotSent = (typeof SLOT_SENT)[number];
/**
 * Warum sich der Zustand eines Slots zuletzt geaendert hat (6.3), genau 20 Werte. Dieselbe Kernregel wie bei
 * VideoReason: eine Ursache, ein Name. 'noFrames' (seit 200 ms kein Bild, Zoom meldet die Kamera aber als an) ist
 * ausdruecklich nicht 'cameraOff'.
 */
export const SLOT_REASONS = [
  'command', 'frames', 'noTarget', 'participantLeft', 'cameraOff', 'noFrames', 'speakerNone', 'speakerNoVideo',
  'speakerChanged', 'shareNone', 'sharePaused', 'shareStill', 'shareChanged', 'targetChanged', 'modeChanged',
  'resolutionChanged', 'bufferMismatch', 'subscribeFailed', 'meetingEnded', 'privilegeRevoked',
] as const;
export type SlotReason = (typeof SLOT_REASONS)[number];
/** Warum sich der Ton eines Slots zuletzt geaendert hat (6.3), genau 12 Werte. */
export const SLOT_AUDIO_REASONS = [
  'command', 'packets', 'gap', 'audioUnavailable', 'participantLeft', 'personNotInMode', 'noShare', 'rateMismatch',
  'targetChanged', 'modeChanged', 'meetingEnded', 'privilegeRevoked',
] as const;
export type SlotAudioReason = (typeof SLOT_AUDIO_REASONS)[number];
/** slotAudio.source (gemessen) und .configured (eingestellt, Tonweg nach 6.10 Schritt 8): dieselben fuenf Werte. */
export const SLOT_AUDIO_SOURCES = ['mix', 'person', 'share', 'mixShare', 'none'] as const;
export type SlotAudioSource = (typeof SLOT_AUDIO_SOURCES)[number];
/** Die drei Sprecher-Signale des SDK (6.8); speakerConfig waehlt, welches steuert. */
export const SPEAKER_SIGNALS = ['speakerVideo', 'activeVideo', 'activeAudio'] as const;
export type SpeakerSignal = (typeof SPEAKER_SIGNALS)[number];
/** Obergrenze der Sprecher-Haltezeit in speakerConfig.holdMs (6.2). */
export const SPEAKER_HOLD_MAX_MS = 5000;
/**
 * contentType einer Freigabe als Name; Index = Wert von enum ShareType (zoom_sdk_def.h:420-444, SDK 7.1.5; A-EP4).
 * 'unknown' auch, solange der Typ vorlaeufig ist (6.9).
 */
export const SHARE_TYPE_NAMES = [
  'unknown', 'as', 'ds', 'wb', 'airhost', 'camera', 'data', 'videoFile', 'frame', 'document', 'computerAudio',
] as const;
export type ShareTypeName = (typeof SHARE_TYPE_NAMES)[number];
/** SharingStatus als Name; Index = Wert der Aufzaehlung (zoom_sdk_def.h:561-585, SDK 7.1.5; A-EP4). */
export const SHARING_STATUS_NAMES = [
  'selfSendBegin', 'selfSendEnd', 'selfSendPureAudioBegin', 'selfSendPureAudioEnd', 'otherShareBegin', 'otherShareEnd',
  'otherSharePureAudioBegin', 'otherSharePureAudioEnd', 'viewOtherSharing', 'pause', 'resume',
] as const;
export type SharingStatusName = (typeof SHARING_STATUS_NAMES)[number];
/**
 * Eigene Fehlerschluessel der Slots, alle mit where:"slot" (6.4). Dazu slotBadTarget (A-EP2): `id` steht da, ist
 * aber kein Ganzzahl-Literal von 0 bis UINT_MAX. Ein fehlendes `id` oder 0 heisst dagegen "kein Ziel".
 */
export const SLOT_ERROR_KEYS = [
  'slotBadNumber', 'slotBadName', 'slotNameTaken', 'slotBadMode', 'slotBadResolution', 'slotBadAudio', 'slotBadFallback',
  'slotBadFlag', 'slotBadTarget', 'slotAlreadyOn', 'slotNotOn', 'slotNoPrivilege', 'slotReconnecting',
  'slotRawRecordingFailed', 'slotSenderFailed', 'slotRendererFailed', 'slotSubscribeFailed', 'slotBufferMismatch',
  'speakerBadSignal', 'speakerBadHold', 'previewUnavailable',
] as const;
export type SlotFehler = (typeof SLOT_ERROR_KEYS)[number];
/**
 * Die drei Ton-Abo-Fehler (where:"audio", 6.4, 7.1; Text T104). Sie tragen `slot`, wenn ein Slot sie ausloeste.
 * audioQueueOverflow und audioBufferMismatch gehoeren ausdruecklich nicht dazu (Nachfix W6).
 */
export const AUDIO_ABO_FEHLER = ['audioVoipJoinFailed', 'audioHelperMissing', 'audioSubscribeFailed'] as const;
/** Ein Eintrag der Freigabe-Liste der Bridge (Ereignis shares, 6.9). */
export interface ShareEntry { user: number; share: number; status: 'running' | 'paused'; type: ShareTypeName; audioOnly: boolean; pauses: number }
/** Ein roher Freigabe-Rueckruf in shares.recent (die letzten 10, ohne Namen; 6.3). */
export interface ShareCallback { ms: number; cb: 'sharingStatus' | 'shareContent'; status: SharingStatusName; user: number; share: number; type: ShareTypeName }
/**
 * Meetingweiter Empfangswert in bridgeStats.recvVideo/recvShare (A-EP5): w und h aus recvResolution
 * (meeting_service_interface.h:589-590: HIWORD = Hoehe, LOWORD = Breite), fps aus recvFps.
 */
export interface RecvStat { w: number; h: number; fps: number }

// Die Namen der Slot-Fehlerschluessel in OWN_ERROR_NAMES (unten). Ein Record ueber SlotFehler: fehlt ein Name,
// scheitert der Typcheck, nicht erst ein Leser von OWN_UNKNOWN(...).
const SLOT_ERROR_NAMES: Record<SlotFehler, string> = {
  slotBadNumber: 'SLOT_BAD_NUMBER',
  slotBadName: 'SLOT_BAD_NAME',
  slotNameTaken: 'SLOT_NAME_TAKEN',
  slotBadMode: 'SLOT_BAD_MODE',
  slotBadResolution: 'SLOT_BAD_RESOLUTION',
  slotBadAudio: 'SLOT_BAD_AUDIO',
  slotBadFallback: 'SLOT_BAD_FALLBACK',
  slotBadFlag: 'SLOT_BAD_FLAG',
  slotBadTarget: 'SLOT_BAD_TARGET',
  slotAlreadyOn: 'SLOT_ALREADY_ON',
  slotNotOn: 'SLOT_NOT_ON',
  slotNoPrivilege: 'SLOT_NO_PRIVILEGE',
  slotReconnecting: 'SLOT_RECONNECTING',
  slotRawRecordingFailed: 'SLOT_RAW_RECORDING_FAILED',
  slotSenderFailed: 'SLOT_SENDER_FAILED',
  slotRendererFailed: 'SLOT_RENDERER_FAILED',
  slotSubscribeFailed: 'SLOT_SUBSCRIBE_FAILED',
  slotBufferMismatch: 'SLOT_BUFFER_MISMATCH',
  speakerBadSignal: 'SPEAKER_BAD_SIGNAL',
  speakerBadHold: 'SPEAKER_BAD_HOLD',
  previewUnavailable: 'PREVIEW_UNAVAILABLE',
};

/** @deprecated Altweg (videoSubscribe); entfaellt mit Plan B, Task B23. Slots melden SlotState. */
export type VideoState = 'subscribed' | 'live' | 'black' | 'unsubscribed';
// "meetingEnded" ist AUSDRUECKLICH nicht "command": beim Meeting-Ende hat
// niemand etwas befohlen. GEMESSEN am 2026-08-13, als es den Wert noch nicht
// gab: das Abo ueberlebte das Ende seiner Sitzung, und der letzte gemeldete
// Stand war "black"/"cameraOff" - "jemand hat die Kamera aus" fuer ein
// beendetes Meeting. Zwei Ursachen, ein Name.
/** @deprecated Altweg (videoSubscribe); entfaellt mit Plan B, Task B23. Slots melden SlotReason. */
export type VideoReason =
  | 'command'
  | 'frames'
  | 'cameraOff'
  | 'participantLeft'
  | 'rebound'
  | 'bufferMismatch'
  | 'meetingEnded'
  // Umgehaengt ueber den ANZEIGENAMEN statt ueber die persistentId, und
  // darum ein eigener Name: der Weg ist schwaecher. GEMESSEN am 14.08.2026,
  // dass Zooms persistentId einen Wiederbeitritt NICHT ueberlebt (derselbe
  // Gast kam mit einem anderen Wert zurueck) - ohne diesen zweiten Weg gaebe
  // es das Umhaengen nur auf dem Papier. Er greift ausschliesslich bei
  // EINDEUTIGEM Namen (je genau ein Teilnehmer und ein Abo); sonst bleibt die
  // Quelle schwarz. Wer im Protokoll "reboundByName" liest, weiss, dass die
  // Zuordnung auf einem Namen beruht und nicht auf einer Kennung.
  | 'reboundByName'
  // Der Host hat die Aufnahme-Erlaubnis entzogen (privilege canRecordRaw:false,
  // source:'broadcast'), und die Bridge baut darum JEDES Abo ab (Stage 4b,
  // N4b.1: "The app must stop accessing content if permission is revoked").
  // Ein EIGENER Name: weder hat der Aufrufer etwas befohlen ('command') noch
  // ist das Meeting zu Ende ('meetingEnded'). Wer 'privilegeRevoked' liest,
  // weiss: das Meeting laeuft weiter, und erteilt der Host die Erlaubnis neu,
  // darf neu abonniert werden. Zwei Ursachen, ein Name - genau das schliesst
  // die Kernregel aus.
  | 'privilegeRevoked';

export const AUDIO_STATES = ['waiting', 'live', 'silent', 'off'] as const;
export type AudioState = (typeof AUDIO_STATES)[number];

// Kein 'queueOverflow': ein Ueberlauf aendert keinen Zustand des Abos, er ist
// ein Fehler ueber die MASCHINE (eine Warteschlange fuer alle) und geht
// darum als error-Ereignis ohne id raus, nicht als Grund fuer einen Wechsel.
//
// 'rebound' und 'reboundByName' bekommen HIER keinen eigenen Ton-Mechanismus -
// der Ton haengt am Bild-Abo (siehe den Kommentar bei 'audio' in reduce(),
// state.ts). Wird das videoSubscribe eines Gasts auf eine neue Kennung
// umgehaengt (VideoReason oben), reicht ein spaeterer Task denselben Grund an
// ein audio-Ereignis unter der neuen Kennung durch. Ein AudioReason, der
// diese beiden Werte nicht kennt, waere eine Behauptung ueber die Leitung,
// die die native Seite widerlegt.
//
// 'audioUnavailable' ist ein EIGENER Wert und teilt sich NICHT 'command'
// (Nachbesserung, Review Task 5): 'command' heisst "der Aufrufer hat den Ton
// ausgeschaltet", 'audioUnavailable' heisst "der Aufrufer wollte Ton, aber
// audioEnsureSubscribed() ist gescheitert (kein Helfer oder subscribe()
// schlug fehl)". Vorher liefen beide Faelle auf denselben Wert
// {"state":"off","reason":"command"} hinaus und waren nur ueber ein
// begleitendes error-Ereignis OHNE id zu unterscheiden - fuer einen
// Konsumenten also gar nicht, denn das error-Ereignis laesst sich keinem Abo
// zuordnen. Zwei Ursachen, ein Name: genau das verbietet die Kernregel
// "Eine Ursache, ein Name".
/** @deprecated Altweg (videoSubscribe); entfaellt mit Plan B, Task B23. Slots melden SlotAudioReason. */
export type AudioReason =
  | 'command'
  | 'audioUnavailable'
  | 'packets'
  | 'gap'
  | 'participantLeft'
  | 'meetingEnded'
  | 'rebound'
  | 'reboundByName'
  // Beim Entzug der Aufnahme-Erlaubnis meldet sich der Ton mit DEMSELBEN Grund
  // ab wie das Bild (VideoReason oben) - der Ton haengt am Bild-Abo.
  | 'privilegeRevoked';

export type Command =
  | { cmd: 'init' }
  | { cmd: 'auth'; jwt: string }
  | { cmd: 'join'; meetingId: string; passcode: string; displayName: string }
  | { cmd: 'leave' }
  | { cmd: 'quit' }
  /** @deprecated Altweg bis Plan B, Task B23; die native Bridge beantwortet ihn ab Plan A, Task A11 mit where:"cmd", code:1. */
  | { cmd: 'videoSubscribe'; id: number; resolution?: VideoResolutionKey; audio?: boolean }
  /** @deprecated wie videoSubscribe. */
  | { cmd: 'videoUnsubscribe'; id: number }
  // EIN Wert fuer ALLE Zoom-Quellen (Owner, 30.09.2026), jederzeit aenderbar,
  // auch vor dem Beitritt - ausser fuer Freigabe-Slots, die ohne Versatz senden
  // (Spec 6.14). Verzoegert wird das BILD: der Ton kommt bei Zoom
  // spaeter an, und was zu frueh kommt, muss warten. Ganze Zahl 0 bis
  // VIDEO_DELAY_MAX_MS; alles andere beantwortet die Bridge mit videoBadDelay.
  | { cmd: 'videoDelay'; ms: number }
  // Slots (Spec 6.2; Gliederung 3.2). Pruefreihenfolge von slotOn; der erste Fehler gewinnt, angelegt wird nichts:
  //  1. slot unlesbar oder nicht 1..SLOT_NR_MAX -> slotBadNumber (ohne slot)
  //  2. ndi fehlt, unlesbar, leer, mehr als 60 Code-Punkte, mit ":", mit einem Steuerzeichen (auch als JSON-Kurzform
  //     wie \n) oder einer \u-Folge im Rohtext -> slotBadName
  //  3. Name gleich dem eines ANDEREN laufenden Slots (Bytevergleich) -> slotNameTaken (Spec 6.2: direkt nach dem Namen)
  //  4. mode, resolution, audio, fallback fehlend, unlesbar oder unbekannt -> slotBadMode, slotBadResolution,
  //     slotBadAudio, slotBadFallback (in dieser Reihenfolge)
  //  5. shareAudio oder showNoVideo fehlend oder unlesbar -> slotBadFlag
  //  6. id vorhanden, aber kein Ganzzahl-Literal von 0 bis UINT_MAX -> slotBadTarget; fehlt id oder ist es 0: kein Ziel
  //  7. Slot laeuft schon -> slotAlreadyOn
  // Danach die stderr-Zeile "Befehl gelesen: slotOn <n>, Modus <m>, Ton <a>" (ohne NDI-Namen), dann:
  //  8. Renderer-Sperre -> slotReconnecting   9. keine Erlaubnis -> slotNoPrivilege
  //  10. NDI nicht oben -> where:"ndi" ndiInitFailed   11. slotRawRecordingFailed, slotSenderFailed, slotRendererFailed
  // slotSet prueft jedes vorhandene Feld wie oben (Nr. 4, 5, 6), erst alle, dann aendert es; danach slotNotOn.
  // slotOff: slotBadNumber, dann slotNotOn. speakerConfig: speakerBadSignal, speakerBadHold (0..SPEAKER_HOLD_MAX_MS).
  // previewMode: on unlesbar -> slotBadFlag (ohne slot). speakerConfig und previewMode brauchen kein init.
  | {
      cmd: 'slotOn'; slot: number; ndi: string; mode: SlotMode; id?: number; resolution: SlotResolution;
      audio: SlotAudioSetting; shareAudio: boolean; fallback: SlotFallback; showNoVideo: boolean;
    }
  | {
      cmd: 'slotSet'; slot: number; mode?: SlotMode; id?: number; resolution?: SlotResolution; audio?: SlotAudioSetting;
      shareAudio?: boolean; fallback?: SlotFallback; showNoVideo?: boolean;
    }
  | { cmd: 'slotOff'; slot: number }
  | { cmd: 'speakerConfig'; signal: SpeakerSignal; holdMs: number }
  | { cmd: 'previewMode'; on: boolean };

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
  // "id" steht NUR an einem Fehler, der GENAU EIN Abo betrifft — heute
  // `audioBufferMismatch` (das Merkzeichen dafür sitzt am Sub, und ohne die
  // Kennung ließe sich die Zeile keinem Gast zuordnen). AUSDRÜCKLICH ohne id
  // bleibt `audioQueueOverflow`: eine Aussage über die MASCHINE — es gibt
  // eine Warteschlange für alle, und der verwerfende Rückruf weiß gar nicht,
  // zu welchem Abo das Paket gehört hätte. Eine erfundene id wäre dort
  // schlimmer als keine.
  //
  // "dropped" steht NUR an `audioQueueOverflow` und nennt, WIE VIELE Pakete
  // bis zu dieser Meldung verworfen wurden. Gemeldet wird einmal je Meeting
  // (Spec Abschnitt 5) — was danach noch verlorengeht, steht in keiner Zahl,
  // und diese Zeile behauptet auch keine.
  // "detail" NACHGETRAGEN (Owner-Lauf 18.08.2026): bridge.ts schrieb das
  // Feld laengst - mit dem Rueckgabewert bzw. Signal des Kindprozesses, also
  // genau der Zahl, die einen Absturz von einem geordneten Ende trennt - aber
  // hinter einem `as WireEvent`-Cast, wo der Typ es nicht kannte und darum
  // auch kein Anzeiger es je ausgab. Ein Wert, der erzeugt und dann still
  // weggeworfen wird, ist schlimmer als keiner: er sieht im Quelltext nach
  // Diagnose aus und liefert keine. Als das Kind nach einem Meeting-Ende von
  // selbst ging, stand darum nur EXITED_UNEXPECTEDLY da - ohne die Zahl, die
  // gesagt haette, WIE es ging.
  //
  // Slots (Spec 6.4): "slot" steht an jedem where:"slot"-Fehler ausser slotBadNumber, speakerBadSignal,
  // speakerBadHold und previewUnavailable; an audioBufferMismatch statt "id"; an den drei Ton-Abo-Fehlern
  // (AUDIO_ABO_FEHLER), wenn ein Slot sie ausloeste. "sdk" (SDKError-Zahl) und "type" stehen nur an
  // slotSubscribeFailed. previewUnavailable traegt das HRESULT (hex) in "detail".
  | {
      ev: 'error'; where: string; code: number | string; id?: number; slot?: number; sdk?: number;
      type?: 'video' | 'share'; dropped?: number; detail?: string;
    }
  | { ev: 'bye' }
  // "rotation" und "limitedRange" FEHLEN, solange kein Bild kam (bei
  // state:"subscribed" also immer). Ein Wert waere dort erfunden - und eine
  // erfundene 0 liesse sich spaeter nicht von einer gemessenen 0
  // unterscheiden.
  /** @deprecated Altweg bis Plan B, Task B23; ersetzt durch slot. */
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
  // "sampleRate"/"channels" FEHLEN, solange kein Paket sie geliefert hat (bei
  // state:"waiting" also immer). Dieselbe Regel wie rotation/limitedRange beim
  // Bild: eine erfundene 32000 liesse sich spaeter nicht von einer gemessenen
  // unterscheiden.
  /** @deprecated Altweg bis Plan B, Task B23; ersetzt durch slotAudio. */
  | {
      ev: 'audio';
      id: number;
      state: AudioState;
      reason: AudioReason;
      sampleRate?: number;
      channels?: number;
    }
  // Die Bestaetigung auf videoDelay: der Wert, der AB JETZT gilt - gemeldet,
  // nicht geglaubt. Ohne sie wuesste ein Aufrufer nach einem abgewiesenen
  // Befehl nicht, ob der alte oder der neue Versatz laeuft.
  | { ev: 'videoDelay'; ms: number }
  // Slots (Spec 6.3; Gliederung 3.3). Regel "keine erfundenen Werte" je Ziel: Messfelder fehlen, bis ein Bild bzw.
  // Paket des aktuellen Ziels kam, und nach jedem Umhaengen wieder (B55). `sent` sagt, was der Sender gerade
  // zusaetzlich schickt (6.12). Bei Freigabe-Slots ist `target` die teilende Person und `share` die Freigabe.
  | {
      ev: 'slot'; slot: number; state: SlotState; mode: SlotMode; target: number; share: number; reason: SlotReason;
      sent: SlotSent; ndi: string; rotation?: number; limitedRange?: boolean;
    }
  | {
      ev: 'slotAudio'; slot: number; state: AudioState; source: SlotAudioSource; configured: SlotAudioSource;
      reason: SlotAudioReason; sampleRate?: number; channels?: number;
    }
  | {
      ev: 'slotStats'; slot: number; w?: number; h?: number; lastW?: number; lastH?: number; fps?: number;
      fallbackFps: number; heldFrames: number; workUs: number; copyUs: number; previewUs: number; memKb: number;
      resWanted: SlotResolution; resSet?: number; resGot?: number; rawType?: number; userVideoW?: number;
      userVideoH?: number; foreignFrames: number; lateFrames: number; tooFrequent: number; noShareData: number;
      rendererNew: number; rendererLost: number; gapMs?: number; gapUngeprueft?: boolean; audioPps?: number;
      audioRate?: number; audioCh?: number; shareAudioRate?: number; shareAudioCh?: number; mixDrops?: number;
      mixSilenceMs?: number;
    }
  | {
      ev: 'bridgeStats'; cpuPct: number; sysPct: number; memMb: number; audioQueueMax: number; audioDropped: number;
      merkerVerworfen: number; halteliste: number; shareAudioPackets: number; shareAudioUnassigned: number;
      shareAudioLastId?: number; hdVideo?: boolean; originalSize?: boolean; recvVideo?: RecvStat; recvShare?: RecvStat;
      previewOn: boolean;
    }
  | { ev: 'shares'; list: ShareEntry[]; shown: number; seeded?: 'ok' | 'empty' | 'unavailable'; recent: ShareCallback[] }
  | { ev: 'speakerSignal'; signal: SpeakerSignal; ids: number[]; ms: number }
  | { ev: 'videoStatus'; id: number; videoOn: boolean; mutedByHost: boolean }
  | { ev: 'preview'; slot: number; target: number; w: number; h: number; jpeg: string }
  | { ev: 'speakerConfig'; signal: SpeakerSignal; holdMs: number }
  | { ev: 'previewMode'; on: boolean }
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
  // Das Feld `audio` am videoSubscribe-Befehl trug weder `true` noch `false`
  // (z. B. `"audio":"false"` als Zeichenkette oder `"audio":0`). EIN EIGENER
  // Name neben videoBadResolution, obwohl beide "ein Befehlsfeld ist
  // unlesbar" heissen: sie schicken die Suche an verschiedene Stellen — der
  // eine zum Auflösungsschlüssel, der andere zum Ton-Schalter. Wer beide
  // zusammenlegte, bekäme eine Meldung, die nicht sagt, WELCHES Feld der
  // Aufrufer falsch geschrieben hat. FEHLT das Feld, ist das KEIN Fehler
  // (Vorgabe `true`, Spec Abschnitt 7) — gemeldet wird nur, was dasteht und
  // sich nicht lesen lässt.
  videoBadAudioFlag: 'VIDEO_BAD_AUDIO_FLAG',
  // Das Feld `ms` am videoDelay-Befehl fehlt, ist keine ganze Zahl (auch
  // `"480"` als Zeichenkette, `4.5` oder `1e3`) oder liegt ausserhalb von 0 bis
  // VIDEO_DELAY_MAX_MS. Der geltende Versatz bleibt dann UNVERAENDERT - ein
  // halb gelesener Wert waere schlimmer als keiner. Ein EIGENER Name aus
  // demselben Grund wie videoBadAudioFlag: er schickt die Suche an genau
  // dieses eine Feld.
  videoBadDelay: 'VIDEO_BAD_DELAY',
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
  // Wir kamen nicht an den TONKANAL des Meetings (JoinVoip). GEMESSEN am
  // 18.08.2026: ohne diesen Beitritt lehnt Zoom das Roh-Ton-Abo mit
  // SDKERR_NOT_JOIN_AUDIO (32) ab — man ist im Meeting, aber nicht an dessen
  // Ton, und nur wer am Ton hängt, bekommt Rohdaten davon. AUSDRÜCKLICH ein
  // anderer Name als audioSubscribeFailed: hier ist der Meeting-Beitritt schuld,
  // dort das Abo — zwei verschiedene Orte zum Suchen.
  audioVoipJoinFailed: 'AUDIO_VOIP_JOIN_FAILED',
  // Das SDK gab keinen Ton-Helfer heraus - kein Meeting oder SDK nicht bereit.
  audioHelperMissing: 'AUDIO_HELPER_MISSING',
  // Das EINE globale Ton-Abo ging nicht durch. AUSDRUECKLICH ein anderer Name
  // als audioHelperMissing: dort gab es den Helfer gar nicht, hier hat er
  // abgelehnt - zwei verschiedene Orte zum Suchen.
  audioSubscribeFailed: 'AUDIO_SUBSCRIBE_FAILED',
  // Pufferlaenge passt nicht zu Kanalzahl x 2. Geprueft, nicht geglaubt -
  // dieselbe Sorge wie videoBufferMismatch beim I420.
  audioBufferMismatch: 'AUDIO_BUFFER_MISMATCH',
  // Pakete verworfen, weil das Leeren nicht nachkam. Eine Aussage ueber die
  // MASCHINE, nicht ueber einen Gast - darum ohne id.
  audioQueueOverflow: 'AUDIO_QUEUE_OVERFLOW',
  // Die 21 Slot-Schluessel (6.4), je ein eigener Name (SLOT_ERROR_NAMES oben). Die Tabellenpruefung des
  // Selbsttests ueber ALLE Schluessel deckt sie mit ab.
  ...SLOT_ERROR_NAMES,
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

// Woertlich aus meeting_service_interface.h (enum MeetingFailCode, SDK 7.1.5.43953,
// x64\zoom_sdk_c_sharp_wrap\h, Zeilen 57-150): ALLE 46 Werte, auch die hinter den
// Luecken der Zaehlung. JM Connect nennt den Namen in meldung.detail, etwa
// "MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING (63)" - nie im grossen Text.
export const FAIL_CODE_NAMES: Record<number, string> = {
  0: 'MEETING_SUCCESS',
  1: 'MEETING_FAIL_CONNECTION_ERR',
  2: 'MEETING_FAIL_RECONNECT_ERR',
  3: 'MEETING_FAIL_MMR_ERR',
  4: 'MEETING_FAIL_PASSWORD_ERR',
  5: 'MEETING_FAIL_SESSION_ERR',
  6: 'MEETING_FAIL_MEETING_OVER',
  7: 'MEETING_FAIL_MEETING_NOT_START',
  8: 'MEETING_FAIL_MEETING_NOT_EXIST',
  9: 'MEETING_FAIL_MEETING_USER_FULL',
  10: 'MEETING_FAIL_CLIENT_INCOMPATIBLE',
  11: 'MEETING_FAIL_NO_MMR',
  12: 'MEETING_FAIL_CONFLOCKED',
  13: 'MEETING_FAIL_MEETING_RESTRICTED',
  14: 'MEETING_FAIL_MEETING_RESTRICTED_JBH',
  15: 'MEETING_FAIL_CANNOT_EMIT_WEBREQUEST',
  16: 'MEETING_FAIL_CANNOT_START_TOKENEXPIRE',
  17: 'SESSION_VIDEO_ERR',
  18: 'SESSION_AUDIO_AUTOSTARTERR',
  19: 'MEETING_FAIL_REGISTERWEBINAR_FULL',
  20: 'MEETING_FAIL_REGISTERWEBINAR_HOSTREGISTER',
  21: 'MEETING_FAIL_REGISTERWEBINAR_PANELISTREGISTER',
  22: 'MEETING_FAIL_REGISTERWEBINAR_DENIED_EMAIL',
  23: 'MEETING_FAIL_ENFORCE_LOGIN',
  24: 'CONF_FAIL_ZC_CERTIFICATE_CHANGED',
  27: 'CONF_FAIL_VANITY_NOT_EXIST',
  28: 'CONF_FAIL_JOIN_WEBINAR_WITHSAMEEMAIL',
  29: 'CONF_FAIL_DISALLOW_HOST_MEETING',
  50: 'MEETING_FAIL_WRITE_CONFIG_FILE',
  60: 'MEETING_FAIL_FORBID_TO_JOIN_INTERNAL_MEETING',
  61: 'CONF_FAIL_REMOVED_BY_HOST',
  62: 'MEETING_FAIL_HOST_DISALLOW_OUTSIDE_USER_JOIN',
  63: 'MEETING_FAIL_UNABLE_TO_JOIN_EXTERNAL_MEETING',
  64: 'MEETING_FAIL_BLOCKED_BY_ACCOUNT_ADMIN',
  82: 'MEETING_FAIL_NEED_SIGN_IN_FOR_PRIVATE_MEETING',
  88: 'MEETING_FAIL_NEED_CONFIRM_PLINK',
  89: 'MEETING_FAIL_NEED_INPUT_PLINK',
  500: 'MEETING_FAIL_APP_PRIVILEGE_TOKEN_ERROR',
  501: 'MEETING_FAIL_AUTHORIZED_USER_NOT_INMEETING',
  502: 'MEETING_FAIL_ON_BEHALF_TOKEN_CONFLICT_LOGIN_ERROR',
  503: 'MEETING_FAIL_USER_LEVEL_TOKEN_NOT_HAVE_HOST_ZAK_OBF',
  504: 'MEETING_FAIL_APP_CAN_NOT_ANONYMOUS_JOIN_MEETING',
  505: 'MEETING_FAIL_ON_BEHALF_TOKEN_INVALID',
  506: 'MEETING_FAIL_ON_BEHALF_TOKEN_NOT_MATCH_MEETING',
  1143: 'MEETING_FAIL_JMAK_USER_EMAIL_NOT_MATCH',
  0xffff: 'MEETING_FAIL_UNKNOWN',
};

export function failCodeName(code: number): string {
  // Wie sdkErrorName: NIE auf den naechstaehnlichen runden.
  return FAIL_CODE_NAMES[code] ?? `MEETING_FAIL_CODE_${code}`;
}

// Deutsche Gruende, ohne Vorsatz. 11 fehlte bis Stage 4 ("Fehlerschluessel 11"),
// 14-16, 23, 60-64, 82, 88, 89 und 500-506 kamen mit Stage 4 dazu (Spec 5.1).
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
  11: 'kein Medienserver gefunden',
  12: 'das Meeting ist gesperrt',
  13: 'das Meeting ist eingeschraenkt',
  14: 'das Meeting ist eingeschraenkt (Beitritt vor dem Gastgeber)',
  15: 'Web-Anfrage nicht gesendet',
  16: 'Anmelde-Token abgelaufen',
  23: 'Anmeldung mit Zoom-Konto verlangt',
  60: 'internes Meeting, Beitritt nicht erlaubt',
  61: 'vom Gastgeber entfernt',
  62: 'Gastgeber laesst niemanden von ausserhalb zu',
  63: 'Meeting eines fremden Zoom-Kontos',
  64: 'vom Administrator des Gastgeber-Kontos gesperrt',
  82: 'Anmeldung mit dem Konto des Veranstalters verlangt',
  88: 'Meeting-Link nicht eindeutig',
  89: 'Meeting-Link im Konto nicht vorhanden',
  500: 'Fehler im Beitritts-Token der App',
  501: 'berechtigter Nutzer nicht im Meeting',
  502: 'OBF-Token widerspricht der Anmeldung',
  503: 'Nutzer-Token ohne ZAK/OBF des Gastgebers',
  504: 'App darf nicht anonym beitreten',
  505: 'OBF-Token ungueltig',
  506: 'OBF-Token passt nicht zum Meeting',
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

/**
 * Der deutsche Grund zu einem MeetingFailCode, OHNE Vorsatz - fuer Klartexte, die
 * ihren eigenen Vorsatz tragen ("Beitritt gescheitert: ", Spec 8.3). explainStatus()
 * setzt "gescheitert: " davor und taugt dafuer nicht.
 */
export function failReason(code: number): string {
  return FAIL_CODES[code] ?? 'unbekannter Grund';
}

/** Der deutsche Grund zu einem EndMeetingReason, OHNE Vorsatz (Gegenstueck zu failReason). */
export function endReason(code: number): string {
  return END_REASONS[code] ?? `Grund ${code}`;
}

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
