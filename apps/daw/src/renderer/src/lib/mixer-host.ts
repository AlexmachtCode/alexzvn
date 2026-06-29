import { useEffect, useState } from 'react';
import type { MixerCommand, MixerSnapshot } from '@shared/ipc-types';
import { useProject } from '@/store/project';
import { engine } from '@/audio/engine';

// Host-Seite des Mixer-Popouts (#95): baut periodisch eine Momentaufnahme aus
// Store + Live-Metern und schickt sie ans Popout; eingehende Steuerbefehle
// werden auf den Store angewandt. Nur aktiv, solange das Popout offen ist.

function buildSnapshot(): MixerSnapshot {
  const st = useProject.getState();
  const meters = engine.meters();
  return {
    strips: st.present.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      gain: t.gain,
      pan: t.pan,
      muted: t.muted,
      solo: t.solo,
      fx: t.effects?.length ?? 0,
      meter: meters.tracks[t.id] ?? 0,
    })),
    master: { gain: st.present.master.gain, meter: meters.master },
    activeTrackId: st.activeTrackId,
  };
}

function applyCommand(cmd: MixerCommand): void {
  const st = useProject.getState();
  switch (cmd.kind) {
    case 'gain':
      if (cmd.phase === 'start') st.beginDrag();
      else if (cmd.phase === 'end') st.endDrag();
      else
        st.dragUpdate((d) => {
          if (cmd.id === 'master') d.master.gain = cmd.value;
          else {
            const t = d.tracks.find((x) => x.id === cmd.id);
            if (t) t.gain = cmd.value;
          }
        });
      break;
    case 'pan':
      if (cmd.phase === 'start') st.beginDrag();
      else if (cmd.phase === 'end') st.endDrag();
      else
        st.dragUpdate((d) => {
          const t = d.tracks.find((x) => x.id === cmd.id);
          if (t) t.pan = cmd.value;
        });
      break;
    case 'mute':
      st.toggleMute(cmd.id);
      break;
    case 'solo':
      st.toggleSolo(cmd.id);
      break;
    case 'select':
      st.setActiveTrack(cmd.id);
      break;
    case 'addBus':
      st.addBus();
      break;
    case 'removeBus':
      st.removeBus(cmd.id);
      break;
  }
}

/** Im Hauptfenster mounten: koppelt das Mixer-Popout an Store + Engine. */
export function useMixerWindowHost(): void {
  const [open, setOpen] = useState(false);

  useEffect(() => window.jmdaw.mixerWin.onPopoutState(setOpen), []);
  useEffect(() => window.jmdaw.mixerWin.onCommand(applyCommand), []);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 33) {
        window.jmdaw.mixerWin.pushSnapshot(buildSnapshot());
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);
}
