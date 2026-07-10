import { contextBridge } from 'electron';

// Der Interpreter braucht (noch) nichts vom Main: die Audio-Kette lebt vollständig im Renderer.
// Die Brücke existiert trotzdem, damit `sandbox: true` + `contextIsolation` das Muster der Suite
// beibehalten und spätere Ergänzungen (Steuerserver, Presets) hier andocken.
const api = { platform: process.platform };

export type JmInterpreterApi = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jminterpreter', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jminterpreter = api;
}
