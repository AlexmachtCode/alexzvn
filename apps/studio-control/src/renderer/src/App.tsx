// Wurzel von Studio-Control (UX Welle 2b, Studio-Control d1; B15, N2b 2.10): Hier steht der Socket-Effekt wie bisher. Er läuft in
// jedem Zustand, vor der Anmeldung (im Electron-Fenster ohne Token, der Server nimmt Loopback als Admin) und danach, und hängt nur
// am Token und an den Sitzungsaktionen, nie an Panel oder Reiter. Jeder Lauf des Effekts ist ein eigener Socket mit eigener
// Lauf-Kennung: Nur Meldungen des aktuellen Sockets setzen die Server-Verbindung (naechsterServerStand), eine späte Meldung eines
// alten Sockets ändert nichts (B15). Den Rahmen samt Anmeldung zeichnet die eine Wurzel-View (StudioOberflaeche).
import { useEffect, useRef, useState } from 'react';
import { connect, resolveServerUrl } from '@/sync/client';
import { useSession } from '@/store/session';
import { useApp } from '@/store/app';
import { EVENTS } from '@shared/protocol';
import type {
  AtemStatusEvent,
  AudioStatusEvent,
  AuditEntry,
  ObsStatusEvent,
  PtzStatusEvent,
  TricasterStatusEvent,
} from '@shared/protocol';
import type { Device, DiscoveredDevice } from '@shared/device';
import type { TricasterConfig } from '@shared/tricaster';
import type { PtzCameraConfig } from '@shared/ptz';
import type { LightingConfig } from '@shared/lighting';
import type { AudioConsoleConfig } from '@shared/audio';
import type { AtemConfig } from '@shared/atem';
import type { ObsConfig } from '@shared/obs';
import type { UserRow } from '@/types/admin';
import { naechsterServerStand, type ServerStand } from '@/lib/oberflaeche';
import { StudioOberflaeche } from '@/views/StudioOberflaeche';

export function App() {
  const token = useSession((s) => s.token);
  const clearSession = useSession((s) => s.clearSession);
  const setConnected = useSession((s) => s.setConnected);
  // Server-Verbindung mit Lauf-Kennung (B15): undefined = noch keine Meldung des aktuellen Sockets.
  const lauf = useRef(0);
  const [server, setServer] = useState<ServerStand>({ lauf: 0, verbunden: undefined });

  useEffect(() => {
    const meinLauf = ++lauf.current;
    setServer({ lauf: meinLauf, verbunden: undefined });
    if (!token && !window.jms?.isElectron) {
      // Browser client without session — show login. No socket yet.
      return;
    }

    const sock = connect(resolveServerUrl(), token, {
      onConnectionChange: (verbunden) => {
        setConnected(verbunden);
        setServer((s) => naechsterServerStand(s, { lauf: meinLauf, verbunden }));
      },
      onError: (msg) => {
        if (msg === 'unauthorised') clearSession();
      },
      onState: (event, payload) => {
        const s = useApp.getState();
        switch (event) {
          case EVENTS.INVENTORY_STATE:
            s.setDevices((payload as { devices: Device[] }).devices);
            break;
          case EVENTS.TRICASTER_STATE: {
            const p = payload as {
              tricasters: TricasterConfig[];
              statuses: TricasterStatusEvent[];
            };
            s.setTricasters(p.tricasters, p.statuses);
            break;
          }
          case EVENTS.TRICASTER_STATUS:
            s.setTricasterStatus(payload as TricasterStatusEvent);
            break;
          case EVENTS.PTZ_STATE: {
            const p = payload as {
              cameras: PtzCameraConfig[];
              statuses: PtzStatusEvent[];
            };
            s.setPtzCameras(p.cameras, p.statuses);
            break;
          }
          case EVENTS.PTZ_STATUS:
            s.setPtzStatus(payload as PtzStatusEvent);
            break;
          case EVENTS.LIGHTING_STATE: {
            const p = payload as { config: LightingConfig; blackout: boolean };
            s.setLighting(p.config, p.blackout);
            break;
          }
          case EVENTS.AUDIO_STATE: {
            const p = payload as {
              consoles: AudioConsoleConfig[];
              statuses: AudioStatusEvent[];
            };
            s.setAudio(p.consoles, p.statuses);
            break;
          }
          case EVENTS.AUDIO_STATUS:
            s.setAudioStatus(payload as AudioStatusEvent);
            break;
          case EVENTS.ATEM_STATE: {
            const p = payload as { atem: AtemConfig[]; statuses: AtemStatusEvent[] };
            s.setAtem(p.atem, p.statuses);
            break;
          }
          case EVENTS.OBS_STATE: {
            const p = payload as { obs: ObsConfig[]; statuses: ObsStatusEvent[] };
            s.setObs(p.obs, p.statuses);
            break;
          }
          case EVENTS.DISCOVERY_START:
            s.setDiscoveryRunning(true);
            break;
          case EVENTS.DISCOVERY_RESULT:
            s.appendDiscoveryResults(
              (payload as { results: DiscoveredDevice[] }).results,
            );
            break;
          case EVENTS.DISCOVERY_DONE: {
            const p = payload as { count: number; durationMs: number };
            s.finishDiscovery(p.count, p.durationMs);
            break;
          }
          case EVENTS.AUDIT_APPEND:
            s.appendAudit(payload as AuditEntry);
            break;
          case 'audit:state':
            s.setAudit((payload as { entries: AuditEntry[] }).entries);
            break;
          case EVENTS.USERS_STATE:
            s.setUsers((payload as { users: UserRow[] }).users);
            break;
        }
      },
    });

    return () => {
      sock.disconnect();
    };
  }, [token, setConnected, clearSession]);

  return <StudioOberflaeche server={server.verbunden} />;
}
