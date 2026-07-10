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
      // Der Mix-Minus-AudioContext (6.2b) läuft hier ohne jede Nutzergeste — ohne diese Policy
      // startete er 'suspended' und die Return-Audio-Tracks blieben stumm.
      autoplayPolicy: 'no-user-gesture-required',
      // ⭐ Dieses Fenster ist DAUERHAFT unsichtbar. Chromium drosselt verborgene Seiten und friert
      // damit den Medienpfad ein — der Gast erschien im Switcher als Standbild. In der Entwicklung
      // fällt das nie auf, weil offene DevTools (unten) die Drosselung abschalten. Dieselbe Falle
      // wie beim NDI-Ausgang des Switchers und beim Ducking des Interpreters.
      backgroundThrottling: false,
    },
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void peer.loadURL(`${devUrl}/peer.html`);
    // DevTools NICHT mehr automatisch öffnen: offene DevTools schalten Chromiums Drosselung ab
    // und ließen den Dev-Lauf sich anders verhalten als der Installer — genau daran ging das
    // Standbild des Gasts monatelang unbemerkt vorbei. Bei Bedarf JMPS_PEER_DEVTOOLS=1 setzen.
    // (Die Peer-Logs spiegelt `plog()` ohnehin ins Main-/Terminal-Log.)
    if (process.env['JMPS_PEER_DEVTOOLS']) peer.webContents.openDevTools({ mode: 'detach' });
    else console.log('[peer] DevTools aus (JMPS_PEER_DEVTOOLS=1 öffnet sie — verfälscht aber die Drosselung).');
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
