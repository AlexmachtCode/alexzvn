import http from 'node:http';
import type { PresenceRecord } from '@shared/types';
import { PresenceStore, type Beat } from './presence-store';

// ─────────────────────────────────────────────────────────────────────────────
// Presence-Hub — der Launcher ist der zentrale Empfänger der Tool-Heartbeats.
//
// Jedes Tool meldet über @jm/app-runtime per POST /presence (hello/beat/bye).
// Die Logik (inkl. Master-Link-Feld `verbund`) steckt in presence-store.ts; hier
// nur der HTTP-Hub auf Loopback. Gepusht wird, wenn sich laufende Tools, ihre
// Version oder ihr Verbund-Zustand ändern — „vor X s“ tickt die UI aus `lastSeen`.
// ─────────────────────────────────────────────────────────────────────────────

const HUB_HOST = '127.0.0.1';
const HUB_PORT = 7799;
const SWEEP_MS = 5_000; // wie oft auf stale gewordene Tools geprüft wird
const MAX_BODY = 64 * 1024;

let server: http.Server | null = null;
let notify: (() => void) | null = null;
const store = new PresenceStore(() => notify?.());

/**
 * Startet den lokalen Presence-Hub. `onChange` wird gerufen, sobald sich laufende
 * Tools oder ihr Verbund-Zustand ändern (Empfehlung: emitAppEvent presence-changed).
 */
export function startPresenceHub(onChange: () => void): void {
  if (server) return;
  notify = onChange;

  server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/presence') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY) req.destroy();
      });
      req.on('end', () => {
        try {
          store.verarbeite(JSON.parse(body) as Beat);
        } catch {
          /* fehlerhafte Beats ignorieren */
        }
        res.writeHead(204);
        res.end();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  // Port belegt o. Ä. → Hub bleibt einfach aus, der Launcher läuft normal weiter.
  server.on('error', () => {
    server = null;
  });
  server.listen(HUB_PORT, HUB_HOST);

  // Stale gewordene Tools erkennen (Crash ohne "bye" sendet kein Lebenszeichen).
  const sweep = setInterval(() => store.pruefe(), SWEEP_MS);
  sweep.unref?.();
}

/** Aktueller Laufzeit-Zustand aller bekannten Tools (für die UI). */
export function getPresence(): PresenceRecord[] {
  return store.snapshot();
}

/**
 * Log-Verzeichnisse aller Tools, die sich in dieser Sitzung gemeldet haben —
 * Grundlage für den Log-Anhang im Feedback (Fehlerberichte).
 */
export function getLogSources(): { appId: string; name: string; logDir: string }[] {
  return store.logQuellen();
}
