// IPC-Kanalnamen, von Main, Preload und Renderer gemeinsam genutzt.

export const IPC = {
  /** invoke (Renderer → Main): Raum in der Cloud öffnen → RoomSession. */
  openRoom: 'jmc:open-room',
  /** invoke (Renderer → Main): Join-Token/-Link für einen neuen Gast erzeugen. */
  mintGuest: 'jmc:mint-guest',
  /** invoke (Renderer → Main): Join-Links für mehrere Sprecher (iveo-Provisionierung). */
  mintGuests: 'jmc:mint-guests',
  /** invoke (Renderer → Main): zuletzt per Deep-Link geöffnete Show. */
  getShow: 'jmc:get-show',
  /** push (Main → Renderer): eine Show wurde geöffnet (Sprecher + Raum). */
  showInfo: 'jmc:show-info',
  /** invoke (Renderer → Main): Raum schließen (Worker-Admin + NDI-Pool leeren). */
  closeRoom: 'jmc:close-room',
  /** invoke (Renderer → Main): Cloud-Zugang lesen — Adresse + Herkunft des Keys, nie der Key. */
  getProxy: 'jmc:get-proxy',
  /** invoke (Renderer → Main): Cloud-Zugang setzen (der Key wandert verschlüsselt in den Main). */
  setProxy: 'jmc:set-proxy',
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
  /** send (versteckter Peer → Main): Diagnose-Zeile ins Terminal-Log (Peer hat kein sichtbares Fenster). */
  peerLog: 'jmc:peer-log',
  /** send (Renderer → Main): auditierbarer Vorgang (Talkback an/aus …) ins Laufzeit-Log. */
  audit: 'jmc:audit',
  /** send (Renderer → Main): Folie im JM Presenter blättern (Control-Plane, Welle 6.3c). */
  slideCue: 'jmc:slide-cue',
} as const;

/** Interner Kanal Main → versteckter Peer-Renderer: Frame-Port für einen Gast. */
export const PEER_FRAME_PORT = 'jmc:peer-frame-port';
/** Interner Kanal Main → versteckter Peer-Renderer: Raum-WS + ICE-URL zum Verbinden mit dem DO. */
export const PEER_CONNECT = 'jmc:peer-connect';
/** Interner Kanal Main → versteckter Peer-Renderer: Programm-NDI-Frame-Port (Rückkanal 6.2a). */
export const PEER_PROGRAM_PORT = 'jmc:peer-program-port';
