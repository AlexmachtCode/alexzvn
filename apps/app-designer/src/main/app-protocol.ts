// ─────────────────────────────────────────────────────────────────────────────
// Das `jmapp://`-Schema — Fundament der Sandbox UND des Kiosks.
//
// Warum ein eigenes Schema statt `<iframe srcdoc>` oder `blob:`?
// Frames auf „local schemes" (about:srcdoc, blob:, data:) ERBEN die CSP des
// Parent-Dokuments; ein <meta>-CSP im Kind kann sie nur verschärfen, nie lockern.
// Der Editor-Renderer läuft im gepackten Build mit `script-src 'self'` — ein
// inline eingebettetes Runtime-Script wäre dort blockiert, während es im Dev
// (dort steht zusätzlich 'unsafe-inline') liefe. Genau die Sorte Fehler, die man
// erst im Installer sieht.
//
// Ein registriertes, privilegiertes Schema erbt nichts: der Frame bekommt die
// echte Origin `jmapp://preview` und seine eigene CSP. `'self'` meint dann genau
// dieses Bundle, `<script src="runtime.js">` lädt, und die strenge Editor-CSP
// bleibt unangetastet — sie braucht nur `frame-src jmapp:`.
//
// Ausgeliefert wird exakt die Bundle-Struktur, die auch der Export auf die Platte
// schreibt (index.html · runtime.js · assets/…) — nur aus dem RAM. Die Vorschau
// ist damit nicht *ähnlich* zum Exportergebnis, sondern dasselbe Artefakt.
// ─────────────────────────────────────────────────────────────────────────────

import { protocol } from 'electron';
import { readFileSync } from 'node:fs';
import { buildIndexHtml, PREVIEW_CSP_META, type AppProject } from '@jm/appkit';
import { getLog } from '@jm/app-runtime';
import type { AssetBlob } from '@shared/types';

export const SCHEME = 'jmapp';

/** Die beiden Hosts: Editor-Vorschau (im iframe) und Kiosk (Vollbildfenster). */
export type Host = 'preview' | 'kiosk';

interface Published {
  doc: AppProject | null;
  /** Dateiname → Bytes. */
  assets: Map<string, Uint8Array>;
}

const published: Published = { doc: null, assets: new Map() };

/**
 * Muss VOR app.whenReady() laufen. `standard: true` macht die URL hierarchisch
 * (echte Origin `jmapp://preview`), `secure: true` befreit sie von den
 * Beschränkungen unsicherer Herkünfte.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);
}

/** Dokument + Assets veröffentlichen. Nächster Frame-Load sieht diesen Stand. */
export function publish(doc: AppProject, assets: AssetBlob[]): void {
  published.doc = doc;
  published.assets = new Map(assets.map((a) => [a.fileName, a.bytes]));
}

export function publishedDoc(): AppProject | null {
  return published.doc;
}

export function urlFor(host: Host): string {
  return `${SCHEME}://${host}/index.html`;
}

function mimeFor(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
  };
  return map[ext] ?? 'application/octet-stream';
}

function text(body: string, mime: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': `${mime}; charset=utf-8` } });
}

/** Nach app.whenReady() aufrufen. `runtimePath` zeigt auf die gebaute runtime.js. */
export function registerAppProtocol(runtimePath: string): void {
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    const host = url.hostname as Host;
    // Führenden Slash entfernen; `%20` etc. dekodieren (Asset-Namen).
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';

    if (!published.doc) return new Response('Kein Dokument veröffentlicht', { status: 404 });

    if (path === 'index.html') {
      // Nur die Vorschau bekommt die zusätzliche <meta>-CSP: Der Kiosk ist ein
      // eigenständiges Fenster ohne Editor daneben, und das exportierte Bundle
      // trägt sie ebenfalls nicht — so bleibt der Kiosk exakt das Export-Artefakt.
      const headExtra = host === 'preview' ? PREVIEW_CSP_META : '';
      return text(buildIndexHtml({ doc: published.doc, headExtra }), 'text/html');
    }

    if (path === 'runtime.js') {
      // Bewusst bei jedem Aufruf von der Platte: im Dev wird die Runtime neben dem
      // laufenden Editor neu gebaut, ein Cache läge dann daneben. Die Datei ist
      // klein und der Frame lädt sie einmal pro Vorschau-Start.
      try {
        return text(readFileSync(runtimePath, 'utf8'), 'text/javascript');
      } catch (err) {
        getLog().error(`runtime.js fehlt (${runtimePath}): ${(err as Error).message}`);
        return new Response('runtime.js fehlt — `npm run build -w @jm/appkit`', { status: 500 });
      }
    }

    if (path.startsWith('assets/')) {
      const file = path.slice('assets/'.length);
      const bytes = published.assets.get(file);
      if (!bytes) return new Response('Asset nicht gefunden', { status: 404 });
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: { 'Content-Type': mimeFor(file), 'Content-Length': String(bytes.byteLength) },
      });
    }

    return new Response('Nicht gefunden', { status: 404 });
  });
}
