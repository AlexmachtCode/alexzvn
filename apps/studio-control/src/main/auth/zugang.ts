// Altfehler SC-S2 (Stufe 1, A7, A8): Bausteine für „nur das eigene App-Fenster ist am Server ohne Anmeldung Admin“. Rein, nur
// node:crypto, damit der Selbsttest sie unter tsx prüfen kann (Middleware, Server und Hauptprozess laufen dort nicht).
import crypto from 'node:crypto';

/** Header, mit dem das eigene Fenster das Geheimnis schickt (X-JMS-Fenster; Node liefert Header klein). */
export const FENSTER_HEADER = 'x-jms-fenster';

/** Ein neues Fenster-Geheimnis: 32 Zufallsbytes als Hex (64 Zeichen). Der Hauptprozess erzeugt es einmal je Start. */
export function neuesFensterGeheimnis(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Ist `angeboten` das Geheimnis? Nur eine nicht leere Zeichenkette gleicher Länge (in Bytes) wird verglichen, dann mit
 * `crypto.timingSafeEqual`; alles andere (leer, Zahl, Array aus doppeltem Header, Objekt) ist false, nie ein Wurf.
 */
export function istFensterGeheimnis(angeboten: unknown, geheimnis: string): boolean {
  if (typeof angeboten !== 'string' || angeboten === '' || geheimnis === '') return false;
  const a = Buffer.from(angeboten, 'utf8');
  const b = Buffer.from(geheimnis, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Gilt der Ursprung einer Anfrage als eigen (A8)? Ohne `Origin` ja (Programme; sie brauchen ein Konto), ebenso `Origin` gleich
 * `http://` + `Host` ohne Groß/Klein (ein Browser vom Server selbst), `null` und `file://` (das App-Fenster; ohne Geheimnis
 * bleibt ihm nur die Anmeldung) und jede Adresse aus `zusaetzlich` (nur ohne Paket: die Vite-Adressen). Mit `Origin`, aber ohne
 * `Host` nein.
 */
export function ursprungErlaubt(origin: string | undefined, host: string | undefined, zusaetzlich: readonly string[]): boolean {
  if (origin === undefined) return true;
  if (origin === 'null' || origin.startsWith('file://')) return true;
  if (zusaetzlich.includes(origin)) return true;
  if (!host) return false;
  return origin.toLowerCase() === `http://${host}`.toLowerCase();
}

/**
 * Ist `url` die eigene Seite des Fensters (A7)? Der gebaute Renderer `file://…/renderer/index.html` (Anker und Suche zählen
 * nicht) oder, mit `devUrl`, jede Seite vom Ursprung der Vite-Adresse.
 */
export function istEigeneSeite(url: string, devUrl: string | undefined): boolean {
  let seite: URL;
  try {
    seite = new URL(url);
  } catch {
    return false;
  }
  if (seite.protocol === 'file:') return seite.pathname.endsWith('/renderer/index.html');
  if (!devUrl) return false;
  try {
    // Zwei Seiten ohne eigenen Ursprung (about:, data:) heißen beide „null“; das ist kein gemeinsamer Ursprung.
    const dev = new URL(devUrl).origin;
    return dev !== 'null' && seite.origin === dev;
  } catch {
    return false;
  }
}
