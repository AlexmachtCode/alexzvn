// Raum-Geheimnisse verschlüsselt at rest (Electron `safeStorage`, wie die Token-at-rest-Härtung
// der übrigen Suite). Grund: Join-Links werden VORAB verteilt (iveo-Provisionierung, Welle 6.3b).
// Ohne Persistenz bekäme derselbe Raum nach einem App-Neustart ein frisches Secret — jeder bereits
// verschickte QR-Code wäre damit still ungültig. `Raum schließen` löscht den Eintrag und rotiert
// damit bewusst alle Links.
//
// Der Cloudflare-DO hält seinerseits eine Kopie des Secrets (Raum-Metadaten mit Retention-Alarm);
// diese Datei ist die lokale Entsprechung, nicht eine zweite Quelle der Wahrheit.
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Store = Record<string, string>; // Raum-ID → secretHex

let warned = false;

function storePath(): string {
  return join(app.getPath('userData'), 'connect-rooms.bin');
}

/** Ohne OS-Schlüsselbund NICHT im Klartext ablegen — lieber pro Sitzung neue Links. */
function usable(): boolean {
  if (safeStorage.isEncryptionAvailable()) return true;
  if (!warned) {
    warned = true;
    console.warn('[connect] safeStorage nicht verfügbar — Raum-Secrets werden nicht gespeichert; vorab verteilte Join-Links überleben keinen Neustart.');
  }
  return false;
}

function read(): Store {
  if (!usable()) return {};
  try {
    const p = storePath();
    if (!existsSync(p)) return {};
    return JSON.parse(safeStorage.decryptString(readFileSync(p))) as Store;
  } catch {
    return {}; // beschädigt/fremder Schlüssel → wie „kein Eintrag"
  }
}

function write(store: Store): void {
  if (!usable()) return;
  try {
    const p = storePath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, safeStorage.encryptString(JSON.stringify(store)), { mode: 0o600 });
  } catch (e) {
    console.error('[connect] Raum-Secret konnte nicht gespeichert werden:', e instanceof Error ? e.message : e);
  }
}

export function loadRoomSecret(room: string): string | null {
  return read()[room] ?? null;
}

export function saveRoomSecret(room: string, secretHex: string): void {
  const store = read();
  if (store[room] === secretHex) return;
  store[room] = secretHex;
  write(store);
}

export function dropRoomSecret(room: string): void {
  const store = read();
  if (!(room in store)) return;
  delete store[room];
  write(store);
}
