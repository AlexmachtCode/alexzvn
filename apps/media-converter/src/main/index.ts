import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { registerIpc } from './ipc';

declare const __dirname: string;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
initAppRuntime({ csp: true, appId: 'jm-media-converter', appName: 'JM Media Converter' });

const preloadPath = join(__dirname, '../preload/index.cjs');

function createWindow(): BrowserWindow {
  return createMainWindow({
    title: 'JM Media Converter',
    preloadPath,
    // P2 (#60): Pilot für die Renderer-Sandbox. Das Preload nutzt nur sandbox-
    // sichere APIs (contextBridge/ipcRenderer/webUtils) → kompatibel mit sandbox:true.
    sandbox: true,
    iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });
}

if (setupSingleInstance(() => createWindow())) {
  app.whenReady().then(() => {
    registerIpc(() => getMainWindow());
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
