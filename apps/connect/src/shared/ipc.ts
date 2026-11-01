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

  // ── Zoom (Stage 4, Spec 5.5). Der Kenncode geht nur mit zoomBeitreten in den Main und kommt nie
  // zurück.
  /** invoke (Renderer → Main): aktuelles Zoom-Abbild → ZoomAbbild. */
  zoomGet: 'jmc:zoom-get',
  /** push (Main → Renderer): Zoom-Abbild (höchstens alle 100 ms). */
  zoom: 'jmc:zoom',
  /** invoke: Ordner-Dialog, dann SDK prüfen und kopieren → ZoomErgebnis. */
  zoomSdkWaehlen: 'jmc:zoom-sdk-waehlen',
  /** invoke: „Zoom-SDK laden“ (Link vom Proxy, Download, Prüfung, Entpacken, Kopie) → ZoomErgebnis. */
  zoomSdkLaden: 'jmc:zoom-sdk-laden',
  /** invoke: laufendes Laden abbrechen (bis zum Entpacken, nicht mehr während der Kopie) → void. */
  zoomSdkLadenAbbrechen: 'jmc:zoom-sdk-laden-abbrechen',
  /** invoke: Datei-Dialog für die Zugangsdaten → ZoomErgebnis. */
  zoomZugangWaehlen: 'jmc:zoom-zugang-waehlen',
  /** invoke: { clientId, clientSecret } von Hand → ZoomErgebnis (gesperrt wie die Wahl, S10). Die Werte gehen nie zurück. */
  zoomZugangEintragen: 'jmc:zoom-zugang-eintragen',
  /** invoke: hinterlegte Zugangsdaten entfernen → ZoomErgebnis (gesperrt wie die Wahl, S10). */
  zoomZugangLoeschen: 'jmc:zoom-zugang-loeschen',
  /** invoke: { schluessel } → ZoomErgebnis (gesperrt wie die Wahl, S10). Der Wert geht nie zurück. */
  zoomSdkSchluesselEintragen: 'jmc:zoom-sdk-schluessel-eintragen',
  /** invoke: hinterlegten SDK-Schlüssel entfernen → ZoomErgebnis (gesperrt wie die Wahl, S10). */
  zoomSdkSchluesselLoeschen: 'jmc:zoom-sdk-schluessel-loeschen',
  /** invoke: „Einrichtung prüfen“ (anmelden ohne Meeting) → ZoomErgebnis; das Ergebnis steht auch als Meldung im Abbild. */
  zoomPruefen: 'jmc:zoom-pruefen',
  /** invoke: { nummer, kenncode, anzeigename } → ZoomErgebnis. */
  zoomBeitreten: 'jmc:zoom-beitreten',
  /** invoke: Meeting verlassen (auch Tray „Zoom-Meeting verlassen“) → void. */
  zoomVerlassen: 'jmc:zoom-verlassen',
  /** invoke: Wiederbeitritt abbrechen (nur Z11; sonst wirkungslos) → void (Spec 5.5, 6.8). */
  zoomAbbrechen: 'jmc:zoom-abbrechen',
  /** invoke: { ms } → ZoomErgebnis (Bild-Versatz). */
  zoomVersatz: 'jmc:zoom-versatz',
  /** invoke: Beitritt mit den Daten im Arbeitsspeicher → ZoomErgebnis. */
  zoomErneut: 'jmc:zoom-erneut',
  /** invoke: Meldung weg, Nummer, Kenncode und gemerkte Quellen leeren → void. */
  zoomSchliessen: 'jmc:zoom-schliessen',
  /** invoke: Meldung quittieren → void. */
  zoomMeldungWeg: 'jmc:zoom-meldung-weg',
  // ── Zoom-Slots (Connect 0.4.0, Spec 7.9). Die Hülle prüft jede Nutzlast mit pruefeSlotEingabe (main/zoom/slot-eingabe.ts);
  // die Preload reicht sie als Ganzes weiter (11.11 KF5).
  /** invoke: {} → ZoomErgebnis & { nr? } (T32 bei 16 Slots). */
  zoomSlotAnlegen: 'jmc:zoom-slot-anlegen',
  /** invoke: { nr, aenderung } (Felder von ZoomSlotEinstellung ohne nr und an) → ZoomErgebnis. */
  zoomSlotAendern: 'jmc:zoom-slot-aendern',
  /** invoke: { nr } → ZoomErgebnis (T36, wenn der Slot an ist). */
  zoomSlotLoeschen: 'jmc:zoom-slot-loeschen',
  /** invoke: { nr, an, trotz? } → ZoomErgebnis oder { ok: false, nachfrage: true, text } (T40, Spec 7.4). */
  zoomSlotStart: 'jmc:zoom-slot-start',
  /** invoke: { teilnehmerId, trotz? } → wie zoomSlotStart („Als Slot laden“). */
  zoomSlotAusPerson: 'jmc:zoom-slot-aus-person',
  /** invoke: { nr, teilnehmerId } → ZoomErgebnis (Auswahl bei Doppelname oder Zweifel). */
  zoomSlotPerson: 'jmc:zoom-slot-person',
  /** invoke: { aufloesung, tonAn } → ZoomErgebnis (Vorgaben für neue Slots, 7.6). */
  zoomSlotVorgaben: 'jmc:zoom-slot-vorgaben',
  /** invoke: { signal, haltezeitMs } → ZoomErgebnis (T74 bei ungültiger Haltezeit). */
  zoomSprecher: 'jmc:zoom-sprecher',
  /** invoke: { an } → ZoomErgebnis (Schalter „Vorschau“). */
  zoomVorschauSchalten: 'jmc:zoom-vorschau-schalten',
  /** invoke: {} → string (Messwerte ohne Teilnehmer- und NDI-Namen, 7.8). */
  zoomMesswerteText: 'jmc:zoom-messwerte-text',
  /** invoke: { nr } → ZoomErgebnis („Behalten“, 7.2). */
  zoomSlotBehalten: 'jmc:zoom-slot-behalten',
  /** push (Main → Renderer): { nr, ziel, w, h, jpeg } (Vorschau, nie im Abbild, nie im Log, 7.7). */
  zoomVorschauBild: 'jmc:zoom-vorschau-bild',
  /** invoke: Connect-Logordner im Explorer öffnen → void. */
  zoomLogordner: 'jmc:zoom-logordner',
} as const;

/** Interner Kanal Main → versteckter Peer-Renderer: Frame-Port für einen Gast. */
export const PEER_FRAME_PORT = 'jmc:peer-frame-port';
/** Interner Kanal Main → versteckter Peer-Renderer: Raum-WS + ICE-URL zum Verbinden mit dem DO. */
export const PEER_CONNECT = 'jmc:peer-connect';
/** Interner Kanal Main → versteckter Peer-Renderer: Programm-NDI-Frame-Port (Rückkanal 6.2a). */
export const PEER_PROGRAM_PORT = 'jmc:peer-program-port';
