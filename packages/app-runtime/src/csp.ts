// Die Content-Security-Policy der Renderer (P2, #60) — als REINE Funktion, ohne Electron-Import,
// damit sie prüfbar ist. `index.ts` setzt das Ergebnis nur noch als Response-Header.
//
// Der Grund für diese Datei: die strenge Fassung erlaubt `connect-src 'self'`, im Dev aber
// zusätzlich ws:/wss:/http:/https:, damit Vite und HMR laufen. Eine App, deren Renderer selbst
// mit dem Netz spricht (JM Connect: WebSocket zum Raum + fetch der ICE-Credentials), läuft
// deshalb in der Entwicklung tadellos und stirbt still im gepackten Build. Genau dieser
// Unterschied ist unten als Selbsttest festgenagelt.

export interface CspConfig {
  connectSrc?: string[];
  imgSrc?: string[];
  mediaSrc?: string[];
}

const SELF = "'self'";

/** Baut den CSP-Header-Wert. `isDev` lockert script-src und connect-src für Vite/HMR. */
export function buildCsp(cfg: CspConfig, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': [SELF],
    'script-src': [SELF, ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
    'style-src': [SELF, "'unsafe-inline'"],
    'img-src': [SELF, 'data:', 'blob:', ...(cfg.imgSrc ?? [])],
    'font-src': [SELF, 'data:'],
    'media-src': [SELF, 'blob:', ...(cfg.mediaSrc ?? [])],
    'connect-src': [SELF, ...(isDev ? ['ws:', 'wss:', 'http:', 'https:'] : []), ...(cfg.connectSrc ?? [])],
    'worker-src': [SELF, 'blob:'],
    'object-src': ["'none'"],
    'base-uri': [SELF],
    'frame-src': ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}
