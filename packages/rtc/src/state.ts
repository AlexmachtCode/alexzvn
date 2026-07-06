// @jm/rtc/state — reine Room-State-Machine (Welle 6). Kein I/O, voll unit-testbar.
// EINE Quelle der Wahrheit für den Cloudflare Durable Object (autoritativ) und die App-UI/-Main.
//
// Sicherheitskritisch (Spur S3): der Warteraum ist STRUKTURELL. Ein Gast in 'lobby' erhält keinen
// grantPublish-Effekt (also keine SFU-Publish-Rechte/ICE), und 'onair' ist ohne erteilte
// Einwilligung (consentAt) nicht erreichbar — beides in den Transitionen erzwungen, nicht in der UI.

import type { RoomState, RoomEvent, RoomEffect, Guest } from './protocol';

export interface ReduceResult {
  state: RoomState;
  effects: RoomEffect[];
}

export function initialRoomState(room: string): RoomState {
  return { room, guests: [], standbyId: null, talkback: { mode: 'off', target: null } };
}

function find(state: RoomState, id: string): Guest | undefined {
  return state.guests.find((g) => g.id === id);
}

export function reduce(prev: RoomState, ev: RoomEvent, nowMs: number): ReduceResult {
  const effects: RoomEffect[] = [];
  const guests = prev.guests.slice(); // flache Kopie; Gäste werden bei Änderung ersetzt
  let standbyId = prev.standbyId;
  let talkback = prev.talkback;

  const replace = (g: Guest) => {
    const i = guests.findIndex((x) => x.id === g.id);
    if (i >= 0) guests[i] = g;
    else guests.push(g);
  };

  switch (ev.t) {
    case 'guestJoin': {
      const existing = find(prev, ev.guestId);
      replace(
        existing
          ? { ...existing, phase: 'lobby', name: ev.name } // Rejoin nach disconnect → zurück in den Warteraum
          : {
              id: ev.guestId,
              name: ev.name,
              phase: 'lobby',
              tally: 'off',
              consentAt: null,
              muted: false,
              hasVideo: ev.hasVideo ?? true,
              hasScreen: ev.hasScreen ?? false,
              joinedAt: nowMs,
            },
      );
      break;
    }

    case 'guestConsent': {
      const g = find(prev, ev.guestId);
      if (g && g.consentAt == null) replace({ ...g, consentAt: nowMs });
      break;
    }

    case 'guestTracks': {
      const g = find(prev, ev.guestId);
      if (g) replace({ ...g, hasVideo: ev.hasVideo ?? g.hasVideo, hasScreen: ev.hasScreen ?? g.hasScreen });
      break;
    }

    case 'approve': {
      const g = find(prev, ev.guestId);
      if (g && g.phase === 'lobby') {
        replace({ ...g, phase: 'approved', tally: 'preview' });
        effects.push({ t: 'grantPublish', guestId: g.id });
        effects.push({ t: 'spinUpNdi', guestId: g.id, label: ndiLabel(g.name) });
        effects.push({ t: 'tally', guestId: g.id, tally: 'preview' });
      }
      break;
    }

    case 'deny': {
      const g = find(prev, ev.guestId);
      if (g && (g.phase === 'lobby' || g.phase === 'joining')) {
        replace({ ...g, phase: 'left', tally: 'off' });
        effects.push({ t: 'notify', guestId: g.id, code: 'denied' });
      }
      break;
    }

    case 'onair': {
      const g = find(prev, ev.guestId);
      if (g && (g.phase === 'approved' || g.phase === 'off')) {
        if (g.consentAt == null) {
          effects.push({ t: 'notify', guestId: g.id, code: 'consentRequired' }); // Consent-Gate
          break;
        }
        replace({ ...g, phase: 'onair', tally: 'program' });
        if (standbyId === g.id) standbyId = null;
        effects.push({ t: 'tally', guestId: g.id, tally: 'program' });
      }
      break;
    }

    case 'off': {
      const g = find(prev, ev.guestId);
      if (g && g.phase === 'onair') {
        replace({ ...g, phase: 'off', tally: 'preview' });
        effects.push({ t: 'tally', guestId: g.id, tally: 'preview' });
      }
      break;
    }

    case 'standby': {
      if (find(prev, ev.guestId)) standbyId = ev.guestId;
      break;
    }

    case 'go': {
      // Die eine Rundown-GO-Zeile: Standby → onair (unterliegt demselben Consent-Gate).
      if (standbyId) return reduce({ room: prev.room, guests, standbyId, talkback }, { t: 'onair', guestId: standbyId }, nowMs);
      break;
    }

    case 'next': {
      const cand =
        guests.find((g) => g.phase === 'approved' || g.phase === 'off') ?? guests.find((g) => g.phase === 'lobby');
      standbyId = cand ? cand.id : null;
      break;
    }

    case 'kick': {
      const g = find(prev, ev.guestId);
      if (g && g.phase !== 'kicked' && g.phase !== 'left') {
        replace({ ...g, phase: 'kicked', tally: 'off' });
        if (standbyId === g.id) standbyId = null;
        effects.push({ t: 'revokePublish', guestId: g.id });
        effects.push({ t: 'tearDownNdi', guestId: g.id });
        effects.push({ t: 'notify', guestId: g.id, code: 'kicked' });
      }
      break;
    }

    case 'mute': {
      const g = find(prev, ev.guestId);
      if (g) replace({ ...g, muted: ev.on });
      break;
    }

    case 'talkback': {
      talkback = { mode: ev.mode, target: ev.target ?? null };
      break;
    }

    case 'guestLeave':
    case 'guestDisconnect': {
      const g = find(prev, ev.guestId);
      if (g) {
        const wasLive = g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off';
        replace({ ...g, phase: ev.t === 'guestLeave' ? 'left' : 'disconnected', tally: 'off' });
        if (standbyId === g.id) standbyId = null;
        if (wasLive) effects.push({ t: 'tearDownNdi', guestId: g.id });
      }
      break;
    }
  }

  return { state: { room: prev.room, guests, standbyId, talkback }, effects };
}

/** NDI-Quellenname pro Gast — vom Switcher automatisch entdeckt (Auto-Reconnect per Name). */
function ndiLabel(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'Gast';
  return `JM Connect – ${clean}`;
}

// ── Bequeme Ableitungen für UI/Health-Badges/STATE-Variablen ───────────────
// Mehrere Gäste dürfen gleichzeitig on-air sein (Remote-Panel) — der Switcher komponiert final.
export function onAirGuests(state: RoomState): Guest[] {
  return state.guests.filter((g) => g.phase === 'onair');
}
/** Primärer On-Air-Gast für die einwertige STATE-Variable `onair`/`active_label` (erster). */
export function onAirGuest(state: RoomState): Guest | undefined {
  return state.guests.find((g) => g.phase === 'onair');
}
export function standbyGuest(state: RoomState): Guest | undefined {
  return state.standbyId ? state.guests.find((g) => g.id === state.standbyId) : undefined;
}
export function lobbyCount(state: RoomState): number {
  return state.guests.filter((g) => g.phase === 'lobby').length;
}
export function activeGuests(state: RoomState): Guest[] {
  return state.guests.filter((g) => g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off');
}
