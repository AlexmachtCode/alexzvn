// IPC-Kanalnamen, von Main und Preload gemeinsam genutzt.

export const IPC = {
  /** invoke: Aufnahmequellen (Monitore/Fenster) auflisten. */
  listSources: 'jmndi:list-sources',
  /** invoke: NDI-Versand mit JmNdiStartOptions starten. */
  start: 'jmndi:start',
  /** invoke: NDI-Versand stoppen. */
  stop: 'jmndi:stop',
  /** invoke: aktuellen JmNdiStatus abfragen. */
  getStatus: 'jmndi:get-status',
  /** push (Main → Renderer): JmNdiStatus-Aktualisierung. */
  status: 'jmndi:status',
  /** push (Renderer → Main): aktuelle Einstellungen fürs Tray-Menü (#104). */
  traySync: 'jmndi:tray-sync',
  /** push (Main → Renderer): Tray-Befehl (Start/Stop/Fps/Audio) (#104). */
  trayCommand: 'jmndi:tray-command',
} as const;
