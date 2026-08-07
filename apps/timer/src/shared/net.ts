// Adressen des lokalen Timer-Servers — bewusst an EINER Stelle, weil hier zwei
// verschiedene Dinge leicht verwechselt werden:
//
//   BIND_HOST   — worauf der Server LAUSCHT. 0.0.0.0 heisst „alle Schnittstellen"
//                 und ist noetig, damit die Remote-Ansicht (Handy/Tablet) aus dem
//                 LAN drankommt. Als ZIEL einer Verbindung ist 0.0.0.0 untauglich.
//   CLIENT_HOST — wohin die Electron-Fenster VERBINDEN. Loopback, immer.
//
// Die CSP muss CLIENT_HOST erlauben, nicht BIND_HOST. Wird das verwechselt,
// blockt Chromium den Websocket: der Operator sieht dauerhaft „Offline" und jedes
// Kommando verschwindet still in sendCommand. Im Dev faellt das nie auf, weil die
// CSP dort ws:/wss:/http:/https: pauschal durchlaesst — erst der gepackte Build
// stirbt. Genau so lag der Timer von 0.5.0 bis 0.11.0 lahm.

/** Lausch-Adresse des Servers (alle Schnittstellen, damit die Remote-Ansicht geht). */
export const BIND_HOST = '0.0.0.0';

/** Ziel-Adresse der Electron-Renderer (Loopback). */
export const CLIENT_HOST = '127.0.0.1';

export const SERVER_PORT = 7777;

/** Was das Preload dem Renderer als Server-Adresse reicht. */
export const PRELOAD_SERVER_URL = `http://${CLIENT_HOST}:${SERVER_PORT}`;

/**
 * CSP-Zusatzquellen der Renderer (P2, #60): http fuer den Socket.IO-Handshake,
 * ws fuer den Upgrade. Beide auf CLIENT_HOST — siehe oben.
 */
export const RENDERER_CSP = {
  connectSrc: [PRELOAD_SERVER_URL, `ws://${CLIENT_HOST}:${SERVER_PORT}`],
};
