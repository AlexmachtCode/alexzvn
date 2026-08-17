// Die Zustandsmaschine: aus Ereignissen wird ein Bild der Sitzung.
// Rein — kein Prozess, keine Uhr, keine Seiteneffekte. Deshalb ohne SDK pruefbar.
import type { AudioReason, AudioState, BridgeEvent, MeetingStatusName, Participant, VideoReason, VideoState } from './protocol.ts';

export interface VideoSub {
  state: VideoState;
  source: string;
  reason: VideoReason;
  rebindable: boolean;
  rotation?: number;
  limitedRange?: boolean;
}

export interface AudioSub {
  state: AudioState;
  reason: AudioReason;
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
  lastError: { where: string; code: number | string; name: string } | null;
  videoSubs: Map<number, VideoSub>;
  audioSubs: Map<number, AudioSub>;
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
    videoSubs: new Map(),
    audioSubs: new Map(),
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
      // videoSubs wird hier ABSICHTLICH NICHT mit abgeraeumt (Abschluss-
      // Sichtung, I4): jedes Abo wird beim Abbau EINZELN gemeldet
      // ({"ev":"video","state":"unsubscribed","reason":"command"}, siehe
      // videoShutdownAll() in native/video.cpp), und diese Ereignisse
      // laufen durch den 'video'-Zweig weiter unten. Hier stillschweigend
      // zu loeschen hiesse, dieselbe Buchung an zwei Stellen zu fuehren -
      // und die zweite waere eine ANNAHME ueber den nativen Teil statt
      // seiner Meldung. Kaeme sie je auseinander (ein Abo, das den Abbau
      // ueberlebt), verdeckte das Abraeumen hier genau das.
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
      const e = ev as { where: string; code: number | string; name?: string };
      // EIN VIDEO-FEHLER IST KEINE KAPUTTE SITZUNG (Abschluss-Sichtung, I5).
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
      // AUSGENOMMEN IST NUR where:'video'. where:'ndi' (ndiInitFailed) bleibt
      // absichtlich drin: das heisst "auf diesem Rechner geht NDI gar nicht",
      // eine Aussage ueber den Aufbau, nicht ueber ein einzelnes Abo.
      //
      // lastError wird IN JEDEM FALL gesetzt - der Fehler darf nicht
      // verschwinden, nur die SITZUNG ist nicht kaputt. Wer Video-Fehler
      // sehen will, liest lastError (oder haengt sich an onEvent, wie
      // test/video-limit.mjs es tut).
      const phase = e.where === 'video' ? s.phase : 'error';
      return { ...s, phase, lastError: { where: e.where, code: e.code, name: e.name ?? 'UNBENANNT' } };
    }

    case 'video': {
      const e = ev as {
        id: number; state: VideoState; source: string; reason: VideoReason;
        rebindable: boolean; rotation?: number; limitedRange?: boolean;
      };
      const videoSubs = new Map(s.videoSubs);
      if (e.state === 'unsubscribed') {
        videoSubs.delete(e.id);
      } else {
        // Beim Umhaengen (reason 'rebound') traegt das Ereignis die NEUE
        // Kennung; die alte muss verschwinden, sonst bliebe eine Karteileiche
        // stehen, auf die nie wieder ein Ereignis kommt. Der Quellenname ist
        // der Faden, an dem die alte Kennung haengt - der Sender ist
        // derselbe geblieben.
        // BEIDE Umhaenge-Ursachen, nicht nur die erste. 'reboundByName' kam
        // spaeter dazu (Zooms persistentId ueberlebt einen Wiederbeitritt
        // nicht, gemessen am 14.08.2026) - und weil diese Abfrage nicht
        // mitgezogen wurde, blieb nach JEDEM Umhaengen ueber den Namen die
        // tote alte Kennung in videoSubs stehen. Auf sie kommt nie wieder ein
        // Ereignis: eine Karteileiche, die ein Aufrufer als zweite, ewig
        // schwarze Quelle anzeigen wuerde. Genau der Fall, den der Kommentar
        // unten ("der Sender ist derselbe geblieben") ausschliessen soll.
        if (e.reason === 'rebound' || e.reason === 'reboundByName') {
          for (const [id, sub] of videoSubs) {
            if (sub.source === e.source && id !== e.id) videoSubs.delete(id);
          }
        }
        videoSubs.set(e.id, {
          state: e.state, source: e.source, reason: e.reason,
          rebindable: e.rebindable, rotation: e.rotation, limitedRange: e.limitedRange,
        });
      }
      return { ...s, videoSubs };
    }

    case 'audio': {
      const e = ev as {
        id: number; state: AudioState; reason: AudioReason;
        sampleRate?: number; channels?: number;
      };
      const audioSubs = new Map(s.audioSubs);
      // 'off' ist das Ende - wie 'unsubscribed' beim Bild. Kein Umhaengen-
      // Sonderfall: der Ton haengt am Bild-Abo, und dessen Umhaengen meldet
      // sich ueber das video-Ereignis. Ein umgehaengtes Abo bekommt hier ein
      // frisches 'waiting' unter der NEUEN Kennung (Task 7).
      if (e.state === 'off') audioSubs.delete(e.id);
      else audioSubs.set(e.id, {
        state: e.state, reason: e.reason,
        sampleRate: e.sampleRate, channels: e.channels,
      });
      return { ...s, audioSubs };
    }

    case 'bye':
      return { ...s, phase: s.phase === 'error' ? 'error' : 'left' };

    default:
      // Unbekanntes Ereignis: nicht verschlucken, aber auch nicht deuten.
      return s;
  }
}
