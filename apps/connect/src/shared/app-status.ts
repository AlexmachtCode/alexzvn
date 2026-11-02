// AppStatus von JM Connect (Plan C, Spec E44, KF10, C-EP15): EIN Konstruktor für den Main (`currentStatus`, main/ipc.ts)
// und EIN Startwert für den Tray (main/tray.ts). Rein (G-C2): kein electron, keine Uhr, damit ein Test jedes Feld prüfen
// kann. Ein neues Feld an AppStatus fängt hier der Typcheck, und KF10 prüft, dass es durchkommt.
import type { AppStatus, NdiProgrammLage, NdiQuelleLage, ProxyKeySource, ZoomKurz } from './types';

/** Alles, was der Main für AppStatus misst; jedes Feld geht unverändert (als Kopie) in den Status. */
export interface AppStatusEingabe {
  configured: boolean;
  proxyBase: string | null;
  proxyKeySource: ProxyKeySource;
  controlPort: number;
  ndiGaeste: NdiQuelleLage[];
  ndiProgramm: NdiProgrammLage;
  presenterLinked: boolean;
  zoom: ZoomKurz | null;
}

/** AppStatus aus den Messwerten des Mains (E44). Die NDI-Lagen sind Kopien: eine spätere Änderung der Eingabe ändert ihn nicht. */
export function baueAppStatus(e: AppStatusEingabe): AppStatus {
  return {
    configured: e.configured,
    proxyBase: e.proxyBase,
    proxyKeySource: e.proxyKeySource,
    controlPort: e.controlPort,
    ndiGaeste: e.ndiGaeste.map((q) => ({ ...q })),
    ndiProgramm: { ...e.ndiProgramm },
    presenterLinked: e.presenterLinked,
    zoom: e.zoom,
  };
}

/**
 * Startwert des Trays, bevor der Main zum ersten Mal meldet (E44): nichts gemessen, also keine Gast-Quelle, Empfang `aus`
 * (wie die Lage startet), kein Zoom, Steuerport 8737 (`CONTROL_PORT` in main/control-server.ts, das electron lädt).
 * index.ts setzt den Tray direkt nach dem Anlegen auf `currentStatus()`.
 */
export const APP_STATUS_START: AppStatus = baueAppStatus({
  configured: false,
  proxyBase: null,
  proxyKeySource: 'none',
  controlPort: 8737,
  ndiGaeste: [],
  ndiProgramm: { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: '', bereit: false },
  presenterLinked: false,
  zoom: null,
});
