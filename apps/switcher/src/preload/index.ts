import { contextBridge, ipcRenderer } from 'electron';
import type {
  ControlStatus,
  DisplayInfo,
  JmswitchApi,
  NdiOutputStatus,
  NdiStatus,
  OutputError,
  OutputStatus,
  ScreenSourceInfo,
} from '@shared/types';
import type { ControlCommand, SwitcherStateMsg } from '@jm/companion-protocol';
import type { OpenSwitcherResult, SaveSwitcherRequest, SaveSwitcherResult } from '@shared/project';

// Den vom Main übertragenen NDI-Frame-MessagePort in den Renderer-Main-World
// durchreichen — contextBridge kann MessagePorts nicht direkt übergeben, daher
// der dokumentierte window.postMessage-Transfer (Empfang: window 'message').
ipcRenderer.on('jmswitch:ndi-port', (e, payload: { recvId?: string } | undefined) => {
  window.postMessage({ kind: 'jmswitch:ndi-port', recvId: payload?.recvId }, '*', e.ports);
});

// Frame-Port der NDI-AUSGABE in den Renderer durchreichen (gleicher Mechanismus).
ipcRenderer.on('jmswitch:ndi-out-port', (e) => {
  window.postMessage({ kind: 'jmswitch:ndi-out-port' }, '*', e.ports);
});

const api: JmswitchApi = {
  platform: process.platform,
  listScreens: () => ipcRenderer.invoke('sources:listScreens') as Promise<ScreenSourceInfo[]>,
  armCapture: (sourceId) => ipcRenderer.invoke('capture:arm', sourceId) as Promise<void>,
  ndi: {
    find: (timeoutMs) => ipcRenderer.invoke('ndi:find', timeoutMs) as Promise<string[]>,
    connect: (recvId, source) => ipcRenderer.invoke('ndi:connect', recvId, source) as Promise<void>,
    disconnect: (recvId) => ipcRenderer.invoke('ndi:disconnect', recvId) as Promise<void>,
    getStatus: () => ipcRenderer.invoke('ndi:status') as Promise<NdiStatus[]>,
    onStatus: (cb) => {
      const listener = (_event: unknown, s: NdiStatus) => cb(s);
      ipcRenderer.on('ndi:status', listener);
      return () => ipcRenderer.off('ndi:status', listener);
    },
  },
  output: {
    recStart: () =>
      ipcRenderer.invoke('output:recStart') as Promise<{ ok: boolean; path?: string; error?: string }>,
    recStartAuto: () =>
      ipcRenderer.invoke('output:recStartAuto') as Promise<{
        ok: boolean;
        path?: string;
        error?: string;
      }>,
    recChunk: (chunk) => ipcRenderer.send('output:recChunk', chunk),
    recStop: () => ipcRenderer.send('output:recStop'),
    streamStart: (url, videoBitrateKbps, hasAudio) =>
      ipcRenderer.invoke('output:streamStart', { url, videoBitrateKbps, hasAudio }) as Promise<{
        ok: boolean;
        error?: string;
      }>,
    streamChunk: (chunk) => ipcRenderer.send('output:streamChunk', chunk),
    streamStop: () => ipcRenderer.send('output:streamStop'),
    onStatus: (cb) => {
      const listener = (_event: unknown, s: OutputStatus) => cb(s);
      ipcRenderer.on('output:status', listener);
      return () => ipcRenderer.off('output:status', listener);
    },
    onError: (cb) => {
      const listener = (_event: unknown, e: OutputError) => cb(e);
      ipcRenderer.on('output:error', listener);
      return () => ipcRenderer.off('output:error', listener);
    },
    ndiStart: (name) =>
      ipcRenderer.invoke('output:ndiStart', name) as Promise<{ ok: boolean; error?: string }>,
    ndiStop: () => ipcRenderer.invoke('output:ndiStop') as Promise<void>,
    ndiStatus: () => ipcRenderer.invoke('output:ndiStatus') as Promise<NdiOutputStatus>,
    onNdiStatus: (cb) => {
      const listener = (_event: unknown, s: NdiOutputStatus) => cb(s);
      ipcRenderer.on('output:ndi-status', listener);
      return () => ipcRenderer.off('output:ndi-status', listener);
    },
  },
  control: {
    start: (port) =>
      ipcRenderer.invoke('control:start', port) as Promise<{
        ok: boolean;
        error?: string;
        port?: number;
      }>,
    stop: () => ipcRenderer.invoke('control:stop') as Promise<void>,
    getStatus: () => ipcRenderer.invoke('control:status') as Promise<ControlStatus>,
    onStatus: (cb) => {
      const listener = (_event: unknown, s: ControlStatus) => cb(s);
      ipcRenderer.on('control:status', listener);
      return () => ipcRenderer.off('control:status', listener);
    },
    onCommand: (cb) => {
      const listener = (_event: unknown, cmd: ControlCommand) => cb(cmd);
      ipcRenderer.on('control:command', listener);
      return () => ipcRenderer.off('control:command', listener);
    },
    pushState: (state: SwitcherStateMsg) => ipcRenderer.send('control:pushState', state),
  },
  project: {
    open: () => ipcRenderer.invoke('project:open') as Promise<OpenSwitcherResult | null>,
    save: (req: SaveSwitcherRequest) =>
      ipcRenderer.invoke('project:save', req) as Promise<SaveSwitcherResult | null>,
    onOpened: (cb) => {
      const listener = (_event: unknown, res: OpenSwitcherResult) => cb(res);
      ipcRenderer.on('project:opened', listener);
      return () => ipcRenderer.off('project:opened', listener);
    },
  },
  screen: {
    listDisplays: () => ipcRenderer.invoke('screen:listDisplays') as Promise<DisplayInfo[]>,
    setSecondScreen: (enabled, displayId) =>
      ipcRenderer.invoke('screen:setSecondScreen', enabled, displayId) as Promise<void>,
    // Komprimiertes Programm-Frame (WebP) an den Main → Ausgabefenster. `send`, kein invoke:
    // Feuer-und-vergiss pro Frame, keine Antwort nötig (Backpressure regelt der Renderer-Timer).
    sendFrame: (data, w, h) => ipcRenderer.send('screen:frame', data, w, h),
    onFrame: (cb) => {
      const listener = (_event: unknown, data: ArrayBuffer, w: number, h: number) => cb(data, w, h);
      ipcRenderer.on('screen:frame', listener);
      return () => ipcRenderer.off('screen:frame', listener);
    },
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jmswitch', api);
} else {
  // @ts-expect-error fallback when context isolation is off
  window.jmswitch = api;
}
