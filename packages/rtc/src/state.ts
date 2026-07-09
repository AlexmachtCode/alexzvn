// @jm/rtc/state — reine Room-State-Machine (Welle 6). Kein I/O, voll unit-testbar.
// EINE Quelle der Wahrheit für den Cloudflare Durable Object (autoritativ) und die App-UI/-Main.
//
// Sicherheitskritisch (Spur S3): der Warteraum ist STRUKTURELL. Ein Gast in 'lobby' erhält keinen
// grantPublish-Effekt (also keine SFU-Publish-Rechte/ICE), und 'onair' ist ohne erteilte
// Einwilligung (consentAt) nicht erreichbar — beides in den Transitionen erzwungen, nicht in der UI.
// Ebenso die Folien-Steuerung (6.3c): ohne ausdrückliche Freigabe entsteht kein slideCue-Effekt.

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
          ? // Rejoin nach disconnect → zurück in den Warteraum. `hasScreen` MUSS zurückgesetzt werden:
            // der Gast publiziert von vorn, und bliebe das Flag stehen, erkennt der Reducer sein
            // erneutes Teilen nicht als Änderung und es entstünde nie wieder eine Bildschirm-Quelle.
            // `canAdvance` ebenso: eine erteilte Folien-Steuerung darf ein Rejoin nicht überdauern.
            { ...existing, phase: 'lobby', name: ev.name, hasScreen: false, canAdvance: false }
          : {
              id: ev.guestId,
              name: ev.name,
              phase: 'lobby',
              tally: 'off',
              consentAt: null,
              muted: false,
              hasVideo: ev.hasVideo ?? true,
              hasScreen: ev.hasScreen ?? false,
              canAdvance: false,
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
      if (g) {
        const hasScreen = ev.hasScreen ?? g.hasScreen;
        replace({ ...g, hasVideo: ev.hasVideo ?? g.hasVideo, hasScreen });
        // Der geteilte Bildschirm ist eine EIGENE NDI-Quelle (Welle 6.3) — sauber getrennt vom
        // Kamerabild, damit der Switcher beides unabhängig schalten kann. Nur solange der Gast
        // publiziert; im Warteraum gibt es keine Quelle (Warteraum-Gate).
        if (isLive(g) && hasScreen !== g.hasScreen) {
          if (hasScreen) effects.push({ t: 'spinUpNdi', guestId: g.id, label: screenLabel(g.name), stream: 'screen' });
          else effects.push({ t: 'tearDownNdi', guestId: g.id, stream: 'screen' });
        }
      }
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
        replace({ ...g, phase: 'kicked', tally: 'off', hasScreen: false, canAdvance: false });
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

    case 'slides': {
      // Der Operator erteilt/entzieht die Folien-Steuerung. Nur ein publizierender Gast kann sie
      // bekommen — im Warteraum hat niemand etwas im Saal zu steuern.
      const g = find(prev, ev.guestId);
      if (g && (!ev.on || isLive(g))) replace({ ...g, canAdvance: ev.on });
      break;
    }

    case 'guestSlide': {
      // DAS Gate: ohne erteilte Freigabe (und ohne Publish) entsteht schlicht kein Effekt.
      const g = find(prev, ev.guestId);
      if (g && g.canAdvance && isLive(g)) effects.push({ t: 'slideCue', guestId: g.id, dir: ev.dir });
      break;
    }

    case 'guestLeave':
    case 'guestDisconnect': {
      const g = find(prev, ev.guestId);
      if (g) {
        const wasLive = isLive(g);
        replace({
          ...g,
          phase: ev.t === 'guestLeave' ? 'left' : 'disconnected',
          tally: 'off',
          hasScreen: false,
          canAdvance: false,
        });
        if (standbyId === g.id) standbyId = null;
        // Ein tearDownNdi ohne `stream` räumt BEIDE Quellen des Gasts ab (Kamera + Bildschirm).
        if (wasLive) effects.push({ t: 'tearDownNdi', guestId: g.id });
      }
      break;
    }
  }

  return { state: { room: prev.room, guests, standbyId, talkback }, effects };
}

/** Publiziert der Gast gerade? Nur dann existieren seine SFU-Tracks und damit NDI-Quellen. */
function isLive(g: Guest): boolean {
  return g.phase === 'approved' || g.phase === 'onair' || g.phase === 'off';
}

/** NDI-Quellenname pro Gast — vom Switcher automatisch entdeckt (Auto-Reconnect per Name). */
function ndiLabel(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'Gast';
  return `JM Connect – ${clean}`;
}

/** Zweite NDI-Quelle desselben Gasts: sein geteilter Bildschirm (Welle 6.3). */
function screenLabel(name: string): string {
  return `${ndiLabel(name)} (Bildschirm)`;
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
  return state.guests.filter(isLive);
}
