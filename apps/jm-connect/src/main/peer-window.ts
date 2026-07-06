// Versteckter WebRTC-Peer-Renderer: eine unsichtbare BrowserWindow, in der Chromium-
// WebRTC läuft. Sie abonniert (Welle 6.1/6.2) die Gast-Tracks von der SFU, dekodiert
// sie per WebCodecs zu BGRA/FLTP und postet die Frames auf den je Gast vom Main
// übergebenen Frame-Port → NDI-Gäste-Pool. Analog zu apps/ndi-screen-capture, nur mit
// einer Remote-WebRTC-Quelle statt getDisplayMedia.
import { BrowserWindow } from 'electron';
import { join } from 'node:path';

declare const __dirname: string;

let peer: BrowserWindow | null = null;

export function createPeerWindow(preloadPath: string): BrowserWindow {
  if (peer && !peer.isDestroyed()) return peer;
  peer = new BrowserWindow({
    show: false,
    // Kein sichtbares Fenster — reiner Medien-/Rechen-Renderer.
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
    },
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void peer.loadURL(`${devUrl}/peer.html`);
    // In Dev die DevTools des versteckten Peers abtrennen — zeigt den Medien-Pfad
    // (SFU-Session/subscribe/ontrack/Pump). In Prod bleibt der Peer unsichtbar.
    peer.webContents.openDevTools({ mode: 'detach' });
  } else {
    void peer.loadFile(join(__dirname, '../renderer/peer.html'));
  }
  peer.on('closed', () => {
    peer = null;
  });
  return peer;
}

export function getPeerWindow(): BrowserWindow | null {
  return peer && !peer.isDestroyed() ? peer : null;
}

export function destroyPeerWindow(): void {
  if (peer && !peer.isDestroyed()) peer.destroy();
  peer = null;
}
