import { app } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';

declare const __dirname: string;

function platformDir(): string {
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

function exe(name: string): string {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

/** resources/bin/<plat> in der gepackten App bzw. <app>/resources/bin im Dev. */
export function bundledBinDir(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bin', platformDir());
  return path.join(__dirname, '..', '..', 'resources', 'bin', platformDir());
}

/** resources/models in der gepackten App bzw. <app>/resources/models im Dev. */
export function bundledModelsDir(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'models');
  return path.join(__dirname, '..', '..', 'resources', 'models');
}

// whisper.cpp-Releases benennen die CLI je nach Version unterschiedlich.
const WHISPER_NAMES = ['whisper-cli', 'whisper', 'main'];
const WHISPER_SERVER_NAMES = ['whisper-server'];

/** Pfad zur whisper-CLI (gebündelt bevorzugt, sonst PATH) oder null. */
export function whisperPath(): string | null {
  for (const name of WHISPER_NAMES) {
    const p = path.join(bundledBinDir(), exe(name));
    if (existsSync(p)) return p;
  }
  // Dev/Fallback: im PATH (Codespace hat i. d. R. keine Binary → null).
  return null;
}

/** Pfad zum persistenten whisper-server (gebündelt) oder null. */
export function whisperServerPath(): string | null {
  for (const name of WHISPER_SERVER_NAMES) {
    const p = path.join(bundledBinDir(), exe(name));
    if (existsSync(p)) return p;
  }
  return null;
}

export function whisperAvailable(): boolean {
  return whisperPath() != null;
}
