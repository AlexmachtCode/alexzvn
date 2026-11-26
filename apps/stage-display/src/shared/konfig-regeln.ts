// Regeln der Konfigurationsdatei stage-config.json als reines Modul (Altfehler Stufe 2, SD-1; ohne electron, damit testbar):
// Standardwerte, Lesen aus der Datei und Mischen eines Teil-Updates. main/config.ts nutzt beide und schreibt die Datei wie bisher.
// Die Nachricht auf der Bühne (`message`) überlebt keinen Neustart mehr: Nach dem Start ist sie leer, der Text im Feld bleibt als
// Entwurf (`nachrichtEntwurf`). Eine ältere Datei ohne Entwurf übernimmt ihre Nachricht als Entwurf. Die Hosts stehen auf der
// Vorgabe VORGABE_HOST (shared/mdns.ts), an der die mDNS-Übernahme hängt (SD-3).
import { DEFAULT_CONTROL_PORT } from '@jm/companion-protocol';
import { VORGABE_HOST } from './mdns';
import type { PartialStageConfig, StageConfig } from './types';

const TIMER_DEFAULT_PORT = 7777;
const PRESENTER_DEFAULT_PORT = 7330;

export const DEFAULT_CONFIG: StageConfig = {
  timer: { enabled: false, host: VORGABE_HOST, port: TIMER_DEFAULT_PORT },
  switcher: { enabled: false, host: VORGABE_HOST, port: DEFAULT_CONTROL_PORT },
  presenter: { enabled: false, host: VORGABE_HOST, port: PRESENTER_DEFAULT_PORT, pin: '', mode: 'ref' },
  widgets: { clock: true, timer: true, switcher: true, message: true, presenter: true },
  message: '',
  nachrichtEntwurf: '',
  outputDisplayId: null,
};

/**
 * Konfiguration aus dem Inhalt der Datei: Standardwerte und gespeicherte Werte je Gruppe zusammengeführt (wie bisher); dazu ist die
 * Nachricht auf der Bühne leer und der Entwurf der gespeicherte Entwurf, sonst die gespeicherte Nachricht, sonst leer.
 */
export function konfigAusDatei(data: Partial<StageConfig>): StageConfig {
  return {
    ...DEFAULT_CONFIG,
    ...data,
    timer: { ...DEFAULT_CONFIG.timer, ...data.timer },
    switcher: { ...DEFAULT_CONFIG.switcher, ...data.switcher },
    presenter: { ...DEFAULT_CONFIG.presenter, ...data.presenter },
    widgets: { ...DEFAULT_CONFIG.widgets, ...data.widgets },
    message: '',
    nachrichtEntwurf: data.nachrichtEntwurf ?? data.message ?? '',
  };
}

/** Teil-Update mit verschachteltem Merge (wie bisher); Nachricht und Entwurf werden je für sich übernommen. */
export function konfigMischen(cur: StageConfig, patch: PartialStageConfig): StageConfig {
  return {
    ...cur,
    ...(patch.message !== undefined ? { message: patch.message } : {}),
    ...(patch.nachrichtEntwurf !== undefined ? { nachrichtEntwurf: patch.nachrichtEntwurf } : {}),
    ...(patch.outputDisplayId !== undefined ? { outputDisplayId: patch.outputDisplayId } : {}),
    timer: { ...cur.timer, ...patch.timer },
    switcher: { ...cur.switcher, ...patch.switcher },
    presenter: { ...cur.presenter, ...patch.presenter },
    widgets: { ...cur.widgets, ...patch.widgets },
  };
}
