// IPC-Kanalnamen, von Main, Preload und Renderer gemeinsam genutzt.

export const IPC = {
  /** invoke (Renderer → Main): Raum in der Cloud öffnen → RoomSession. */
  openRoom: 'jmc:open-room',
  /** invoke (Renderer → Main): Join-Token/-Link für einen neuen Gast erzeugen. */
  mintGuest: 'jmc:mint-guest',
  /** invoke (Renderer → Main): Raum schließen (Worker-Admin + NDI-Pool leeren). */
  closeRoom: 'jmc:close-room',
  /** send (Renderer → Main): NDI-Sender für einen freigegebenen Gast starten. */
  ndiUp: 'jmc:ndi-up',
  /** send (Renderer → Main): NDI-Sender eines Gasts stoppen. */
  ndiDown: 'jmc:ndi-down',
  /** send (Renderer → Main): abgeleiteter STATE fürs Steuerprotokoll (Companion/Rundown/Health). */
  pushControlState: 'jmc:control-state',
  /** push (Main → Renderer): App-Status (Konfiguration/NDI). */
  status: 'jmc:status',
  /** push (Main → Renderer): Tray-Befehl. */
  trayCommand: 'jmc:tray-command',
  /** push (Main → Renderer): Steuerbefehl vom TCP-Protokoll (Companion/Rundown) → an den DO relayen. */
  controlCommand: 'jmc:control-command',
  /** push (Main → Operator-Renderer): Status des Programm-Rückkanal-Empfangs (Welle 6.2). */
  programStatus: 'jmc:program-status',
} as const;

/** Interner Kanal Main → versteckter Peer-Renderer: Frame-Port für einen Gast. */
export const PEER_FRAME_PORT = 'jmc:peer-frame-port';
/** Interner Kanal Main → versteckter Peer-Renderer: Raum-WS + ICE-URL zum Verbinden mit dem DO. */
export const PEER_CONNECT = 'jmc:peer-connect';
/** Interner Kanal Main → versteckter Peer-Renderer: Programm-NDI-Frame-Port (Rückkanal 6.2a). */
export const PEER_PROGRAM_PORT = 'jmc:peer-program-port';
