// Die Zustandsmaschine: aus Ereignissen wird ein Bild der Sitzung.
// Rein — kein Prozess, keine Uhr, keine Seiteneffekte. Deshalb ohne SDK pruefbar.
import type { BridgeEvent, MeetingStatusName, Participant } from './protocol.ts';

export interface Session {
  phase: 'start' | 'ready' | 'authed' | 'joining' | 'inMeeting' | 'left' | 'error';
  meeting: MeetingStatusName;
  participants: Map<number, Participant>;
  canRecordRaw: boolean;
  privilegeRequested: boolean;
  lastError: { where: string; code: number | string; name: string } | null;
}

export function initialSession(): Session {
  return {
    phase: 'start',
    meeting: 'idle',
    participants: new Map(),
    canRecordRaw: false,
    privilegeRequested: false,
    lastError: null,
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
      const e = ev as { canRecordRaw: boolean; requested?: boolean };
      return {
        ...s,
        canRecordRaw: e.canRecordRaw,
        privilegeRequested: s.privilegeRequested || e.requested === true,
      };
    }

    case 'error': {
      const e = ev as { where: string; code: number | string; name?: string };
      return { ...s, phase: 'error', lastError: { where: e.where, code: e.code, name: e.name ?? 'UNBENANNT' } };
    }

    case 'bye':
      return { ...s, phase: s.phase === 'error' ? 'error' : 'left' };

    default:
      // Unbekanntes Ereignis: nicht verschlucken, aber auch nicht deuten.
      return s;
  }
}
