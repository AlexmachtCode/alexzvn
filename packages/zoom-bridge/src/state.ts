// Die Zustandsmaschine: aus Ereignissen wird ein Bild der Sitzung.
// Rein — kein Prozess, keine Uhr, keine Seiteneffekte. Deshalb ohne SDK pruefbar.
import type {
  AudioState, BridgeEvent, MeetingStatusName, Participant, SlotAudioReason, SlotAudioSource, SlotMode,
  SlotReason, SlotSent, SlotState,
} from './protocol.ts';

/**
 * Ein laufender Slot, wie ihn das letzte slot-Ereignis beschreibt (Spec 6.3; Gliederung 3.4). rotation und
 * limitedRange fehlen, bis ein Bild des aktuellen Ziels kam (keine erfundenen Werte).
 */
export interface SlotSub {
  state: SlotState;
  mode: SlotMode;
  target: number;
  share: number;
  reason: SlotReason;
  sent: SlotSent;
  ndi: string;
  rotation?: number;
  limitedRange?: boolean;
}

/**
 * Der Ton eines Slots (slotAudio, 6.3). Bleibt auch bei 'off' stehen: off/personNotInMode ist ein Dauerzustand mit
 * Grund (A-EP6); erst `slot off` loescht ihn. sampleRate/channels fehlen, bis ein Paket sie lieferte.
 */
export interface SlotAudioSub {
  state: AudioState;
  source: SlotAudioSource;
  configured: SlotAudioSource;
  reason: SlotAudioReason;
  sampleRate?: number;
  channels?: number;
}

export interface Session {
  phase: 'start' | 'ready' | 'authed' | 'joining' | 'inMeeting' | 'left' | 'error';
  meeting: MeetingStatusName;
  participants: Map<number, Participant>;
  canRecordRaw: boolean;
  privilegeRequested: boolean;
  /**
   * ENDGUELTIG "es kommt keine Antwort mehr" - im Unterschied zu
   * privilegeRequested, das nur heisst "wir haben je gefragt" und weder
   * "die Antwort steht noch aus" noch "sie kommt nie mehr" unterscheidet.
   * Spiegelt IMMER das ZULETZT verarbeitete privilege-Ereignis (wie
   * canRecordRaw): ein spaeteres, nicht-timedOut Ereignis (Freigabe per
   * broadcast, ein erneutes Gesuch nach Wiederverbindung, ...) setzt es
   * wieder zurueck - die alte Zeitueberschreitung gilt dann nicht mehr als
   * letztes Wort. Ohne dieses Feld war "requested:true" fuer BEIDE Faelle
   * ("Antwort steht aus" und "SDK hat aufgegeben") gleich - wer auf eine
   * Antwort wartet, haette bei einer Zeitueberschreitung fuer immer
   * gewartet (Nachbesserung 1, Owner-Entscheidung: Befund B).
   */
  privilegeTimedOut: boolean;
  /**
   * ENDGUELTIG "der Gastgeber hat abgelehnt" - dieselbe Falle wie
   * privilegeTimedOut oben, nur fuer eine ANDERE Ursache (Abschluss-Sichtung,
   * Punkt D). native/callbacks.cpp sendet bei einer Ablehnung
   * {"ev":"privilege","canRecordRaw":false,"source":"requestAnswer","denied":true} -
   * ohne dieses Feld landete das byte-gleich im Zustand wie "gerade gefragt,
   * Antwort steht noch aus" (canRecordRaw:false, privilegeRequested:true,
   * privilegeTimedOut:false), weil reduce() das denied-Feld schlicht nicht
   * las. Wer auf eine Zustandsaenderung wartet (Stage 4), haette nach einer
   * Ablehnung fuer immer gewartet. Spiegelt IMMER das ZULETZT verarbeitete
   * privilege-Ereignis (wie canRecordRaw/privilegeTimedOut): eine spaetere,
   * nicht-denied Antwort (eine erneute Anfrage nach Wiederverbindung, ein
   * broadcast) setzt es wieder zurueck - die alte Ablehnung gilt dann nicht
   * mehr als letztes Wort.
   */
  privilegeDenied: boolean;
  /**
   * `id` steht NUR dabei, wenn das Ereignis eine trug — sie ist die
   * Zuordnung zu genau einem Abo (heute: `audioBufferMismatch`). Vorher
   * verwarf der Reducer sie, und damit genau das, wofür sie eingeführt
   * wurde: eine Fehlerzeile, die sich keinem Gast zuordnen lässt, ist für
   * einen Leser dieselbe stille Sorte Fehler wie gar keine. Fehlt sie, ist
   * das eine Aussage über die MASCHINE (`audioQueueOverflow`) — dann wird
   * hier auch keine erfunden.
   */
  lastError: { where: string; code: number | string; name: string; id?: number; slot?: number } | null;
  /** Laufende Slots nach Slot-Nummer (1..16). `slot off` loescht den Eintrag samt seinem Ton. */
  slots: Map<number, SlotSub>;
  /** Ton je Slot-Nummer; nur `slot off` loescht ihn (A-EP6). */
  slotAudio: Map<number, SlotAudioSub>;
  /**
   * Der Bild-Versatz, den die Bridge ZULETZT BESTAETIGT hat (Ereignis
   * videoDelay), in Millisekunden. `null` = noch nie bestaetigt. Die Bridge
   * startet zwar mit 0, aber eine hier eingesetzte 0 saehe aus wie eine
   * Bestaetigung - dieselbe Regel wie rotation/limitedRange am Bild.
   */
  videoDelayMs: number | null;
}

export function initialSession(): Session {
  return {
    phase: 'start',
    meeting: 'idle',
    participants: new Map(),
    canRecordRaw: false,
    privilegeRequested: false,
    privilegeTimedOut: false,
    privilegeDenied: false,
    lastError: null,
    slots: new Map(),
    slotAudio: new Map(),
    videoDelayMs: null,
  };
}

/**
 * Ruhend heisst: es ist ein Zustand, in dem das Warten aufhoert und eine Antwort
 * vorliegt — auch wenn die Antwort "Warteraum" lautet.
 *
 * ACHTUNG: `connecting` ist AUSDRUECKLICH nicht ruhend. Genau dort hing der Stage-0-Spike
 * 90 Sekunden lang ohne jede Meldung. Ein Wachhund, der beim ersten Lebenszeichen
 * einschlaeft, haette diesen Fall verschlafen.
 */
export function isSettled(status: MeetingStatusName): boolean {
  return status === 'inMeeting' || status === 'waitingRoom' || status === 'waitingForHost' || status === 'failed' || status === 'ended';
}

export function reduce(s: Session, ev: BridgeEvent): Session {
  switch (ev.ev) {
    case 'ready':
      return { ...s, phase: 'ready' };

    case 'auth':
      return { ...s, phase: (ev as { code: number }).code === 0 ? 'authed' : s.phase };

    case 'status': {
      const e = ev as { status: MeetingStatusName };
      let phase = s.phase;
      if (e.status === 'inMeeting') phase = 'inMeeting';
      else if (e.status === 'connecting') phase = 'joining';
      else if (e.status === 'ended' || e.status === 'failed') phase = 'left';
      // Wer das Meeting verlaesst, laesst niemanden zurueck.
      const participants = e.status === 'ended' || e.status === 'failed' ? new Map<number, Participant>() : s.participants;
      // slots wird hier ABSICHTLICH NICHT mit abgeraeumt (Abschluss-Sichtung, I4;
      // mit den Slots uebernommen): jeder Slot wird beim Abbau EINZELN gemeldet
      // ({"ev":"slot","state":"off","reason":"meetingEnded"}, Abbau-Ketten
      // Spec 6.15), und diese Ereignisse laufen durch den 'slot'-Zweig weiter
      // unten. Hier stillschweigend zu loeschen hiesse, dieselbe Buchung an zwei
      // Stellen zu fuehren - und die zweite waere eine ANNAHME ueber den nativen
      // Teil statt seiner Meldung. Kaeme sie je auseinander (ein Slot, der den
      // Abbau ueberlebt), verdeckte das Abraeumen hier genau das.
      return { ...s, phase, meeting: e.status, participants };
    }

    case 'roster': {
      // ERSETZEN, nicht ergaenzen: nach einer Wiederverbindung sind die IDs andere,
      // und ergaenzen hiesse Karteileichen behalten.
      const list = (ev as { list: Participant[] }).list;
      return { ...s, participants: new Map(list.map((p) => [p.id, p])) };
    }

    case 'joined': {
      const p = (ev as { p: Participant }).p;
      const participants = new Map(s.participants);
      participants.set(p.id, p); // bekannt = aktualisieren, nicht verdoppeln
      return { ...s, participants };
    }

    case 'left': {
      const id = (ev as { id: number }).id;
      if (!s.participants.has(id)) return s; // Ereignisse koennen sich ueberholen
      const participants = new Map(s.participants);
      participants.delete(id);
      return { ...s, participants };
    }

    case 'renamed': {
      const e = ev as { id: number; name: string };
      const known = s.participants.get(e.id);
      if (!known) return s; // fuer einen Unbekannten legen wir niemanden an
      const participants = new Map(s.participants);
      participants.set(e.id, { ...known, name: e.name });
      return { ...s, participants };
    }

    case 'privilege': {
      const e = ev as { canRecordRaw: boolean; requested?: boolean; timedOut?: boolean; denied?: boolean };
      return {
        ...s,
        canRecordRaw: e.canRecordRaw,
        privilegeRequested: s.privilegeRequested || e.requested === true,
        // IMMER auf den ZULETZT verarbeiteten Wert setzen (wie canRecordRaw),
        // nicht mit ODER verknuepfen (wie privilegeRequested): eine spaetere,
        // nicht-timedOut Antwort hebt eine fruehere Zeitueberschreitung auf.
        privilegeTimedOut: e.timedOut === true,
        // Dasselbe Muster, dieselbe Begruendung, eine ANDERE Ursache
        // (Abschluss-Sichtung Punkt D): IMMER auf den ZULETZT verarbeiteten
        // Wert setzen, nicht mit ODER verknuepfen - eine spaetere Freigabe
        // hebt eine fruehere Ablehnung auf.
        privilegeDenied: e.denied === true,
      };
    }

    case 'error': {
      const e = ev as { where: string; code: number | string; name?: string; id?: number; slot?: number };
      // EIN VIDEO- ODER TON-FEHLER IST KEINE KAPUTTE SITZUNG (Abschluss-Sichtung, I5;
      // Ton nachgezogen in der Schlussprüfung zu Stage 3, Critical 1).
      // Stage 2 bringt Fehlerschluessel, die im NORMALBETRIEB auftreten:
      // videoAlreadySubscribed (jemand hat zweimal geklickt),
      // videoNotSubscribed, videoBadResolution, videoBufferMismatch (mitten
      // in einer laufenden Sendung). Vorher setzte JEDER davon phase:'error'
      // - und zwar ENDGUELTIG: keine andere Verzweigung hier holt eine
      // Sitzung aus 'error' zurueck, und 'bye' schreibt sie ausdruecklich
      // fort. Eine Sitzung, die laeuft, stuende danach fuer immer als kaputt
      // da. Schlimmer noch: test/join.mjs und test/video-limit.mjs benutzen
      // phase === 'error' als Abbruchmerkmal - der Messlauf haette sich an
      // einem einzigen videoAlreadySubscribed selbst ausgehebelt.
      //
      // AUSGENOMMEN SIND where:'video' UND where:'audio'. Stage 3 hat vier
      // Ton-Schluessel dazugelegt, und sie gehoeren aus DEMSELBEN Grund in
      // dieselbe Klasse: sie treten im NORMALBETRIEB auf und sagen nichts
      // ueber den Aufbau der Sitzung aus.
      //   - audioQueueOverflow: die Hauptschleife ist einmal laenger als
      //     eine halbe Sekunde nicht zum Leeren gekommen. Eine Aussage ueber
      //     die MASCHINE unter Last - Bild und Ton laufen danach weiter.
      //   - audioBufferMismatch: ein einzelnes verworfenes Paket mitten in
      //     einem laufenden Abo, gemeldet einmal je Abo.
      //   - audioHelperMissing / audioSubscribeFailed: der Ton kam fuer
      //     dieses Abo nicht zustande (gemeldet als off/audioUnavailable) -
      //     das BILD dieses und aller anderen Abos laeuft weiter.
      // Ohne diese Ausnahme kippte jeder Hakler die Sitzung endgueltig auf
      // 'error', obwohl Bild und Ton einwandfrei weiterlaufen (Schluss-
      // pruefung Stage 3, Critical 1).
      //
      // where:'ndi' (ndiInitFailed) bleibt dagegen absichtlich drin: das
      // heisst "auf diesem Rechner geht NDI gar nicht", eine Aussage ueber
      // den AUFBAU, nicht ueber ein einzelnes Abo. Genau daran haengt die
      // Grenze - nicht daran, ob ein Schluessel neu ist.
      //
      // lastError wird IN JEDEM FALL gesetzt - der Fehler darf nicht
      // verschwinden, nur die SITZUNG ist nicht kaputt. Wer Bild-/Ton-Fehler
      // sehen will, liest lastError (oder haengt sich an onEvent, wie
      // test/video-limit.mjs es tut).
      // where:'slot' (Connect 0.4.0, Spec 6.4) gehoert aus demselben Grund in dieselbe Klasse: ein Slot-Fehler
      // (slotNotOn im Wettlauf, slotSubscribeFailed, ein Tippfehler im Befehl) betrifft einen Slot, nie den
      // Aufbau der Sitzung. Gegenprobe: where:'auth' kippt weiter.
      const phase = e.where === 'video' || e.where === 'audio' || e.where === 'slot' ? s.phase : 'error';
      const lastError: NonNullable<Session['lastError']> = {
        where: e.where,
        code: e.code,
        name: e.name ?? 'UNBENANNT',
      };
      // Die id NUR uebernehmen, wenn das Ereignis eine trug (Keine
      // erfundenen Werte). Sie ist die Zuordnung zu genau einem Abo, und der
      // Reducer verwarf sie bisher - der Leser von lastError bekam also
      // ausgerechnet die Angabe nicht, fuer die sie in audioBufferMismatch
      // eingefuehrt wurde.
      if (typeof e.id === 'number') lastError.id = e.id;
      // Dieselbe Regel fuer die Slot-Nummer: nur, wenn das Ereignis eine trug (slotBadNumber traegt keine).
      if (typeof e.slot === 'number') lastError.slot = e.slot;
      return { ...s, phase, lastError };
    }

    // Die Zweige 'video' und 'audio' (Abo je Teilnehmer-Kennung) entfallen mit den Slots (Spec 6.18, Plan A,
    // Task A3): Solche Ereignisse sind jetzt unbekannt und aendern nichts (default unten).

    case 'slot': {
      const e = ev as {
        slot: number; state: SlotState; mode: SlotMode; target: number; share: number; reason: SlotReason;
        sent: SlotSent; ndi: string; rotation?: number; limitedRange?: boolean;
      };
      const slots = new Map(s.slots);
      if (e.state === 'off') {
        // Das Ende eines Slots ist auch das Ende seines Tons (Gliederung 3.4): die Bridge meldet slotAudio off
        // vor slot off, aber erst slot off sagt, dass es den Slot nicht mehr gibt.
        slots.delete(e.slot);
        const slotAudio = new Map(s.slotAudio);
        slotAudio.delete(e.slot);
        return { ...s, slots, slotAudio };
      }
      const sub: SlotSub = {
        state: e.state, mode: e.mode, target: e.target, share: e.share, reason: e.reason, sent: e.sent, ndi: e.ndi,
      };
      // Nur uebernehmen, was gemessen wurde (keine erfundenen Werte, 6.3).
      if (e.rotation !== undefined) sub.rotation = e.rotation;
      if (e.limitedRange !== undefined) sub.limitedRange = e.limitedRange;
      slots.set(e.slot, sub);
      return { ...s, slots };
    }

    case 'slotAudio': {
      const e = ev as {
        slot: number; state: AudioState; source: SlotAudioSource; configured: SlotAudioSource; reason: SlotAudioReason;
        sampleRate?: number; channels?: number;
      };
      const slotAudio = new Map(s.slotAudio);
      // KEIN Loeschen bei 'off' (A-EP6): off/personNotInMode oder off/noShare ist ein Zustand mit Grund, den die
      // Kachel anzeigt. Erst slot off raeumt den Ton ab.
      const ton: SlotAudioSub = { state: e.state, source: e.source, configured: e.configured, reason: e.reason };
      if (e.sampleRate !== undefined) ton.sampleRate = e.sampleRate;
      if (e.channels !== undefined) ton.channels = e.channels;
      slotAudio.set(e.slot, ton);
      return { ...s, slotAudio };
    }

    case 'videoStatus': {
      // Zoom meldet die Kamera eines Teilnehmers (Spec 0.18, onUserVideoStatusChange). Fuer einen Unbekannten
      // legen wir niemanden an (wie renamed).
      const e = ev as { id: number; videoOn: boolean };
      const known = s.participants.get(e.id);
      if (!known) return s;
      const participants = new Map(s.participants);
      participants.set(e.id, { ...known, videoOn: e.videoOn });
      return { ...s, participants };
    }

    case 'videoDelay': {
      // Nur eine ZAHL wird uebernommen. Alles andere waere eine Deutung einer
      // Zeile, die die native Seite so nie schreibt - dann lieber den
      // bisherigen Stand behalten als einen erfundenen.
      const ms = (ev as { ms?: unknown }).ms;
      if (typeof ms !== 'number' || !Number.isInteger(ms)) return s;
      return { ...s, videoDelayMs: ms };
    }

    case 'bye':
      return { ...s, phase: s.phase === 'error' ? 'error' : 'left' };

    default:
      // Unbekanntes Ereignis: nicht verschlucken, aber auch nicht deuten.
      return s;
  }
}
