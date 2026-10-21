// Ansagen der geführten Anleitungen im Renderer (Plan Geführte Anleitungen P11; Spec 6; EP14, EP15, EP21).
//
// Die .ogg kommen als eigene Dateien in den Bau und werden von dort abgespielt (media-src 'self'), NIE als data:-URL:
// Die CSP des Launchers erlaubt für Medien nur 'self' blob: (packages/app-runtime/src/csp.ts). Vite legt Dateien unter
// 4 KB sonst als data: ins JS, und kurze Ansagen wären nur im Installer stumm. Das verhindert die assetsInlineLimit-Regel in
// electron.vite.config.ts (gemessen), npm run stimme:bau-pruefen prüft den Bau. Erzeugt werden die Dateien nur am Rechner
// des Controllers (scripts/anleitung-stimme.mjs); ohne Stimme ist das Manifest leer, und alles hier liefert null/false.
import manifestRoh from './stimme/manifest.json';

interface StimmenManifest {
  format: 1;
  stimme: { name: string; onnxSha256: string; lizenz: string; namensnennung: string; sprecher: number | null } | null;
  eintraege: ReadonlyArray<{ id: string; datei: string }>;
}

const manifest = manifestRoh as unknown as StimmenManifest;
const dateien = import.meta.glob<string>('./stimme/*.ogg', { eager: true, query: '?url', import: 'default' });
const urlJeId = new Map<string, string>();
for (const e of manifest.eintraege) {
  const url = dateien[`./stimme/${e.datei}`];
  if (url) urlJeId.set(e.id, url);
}

/** URL der Ansage zu einer Text-ID, oder null (keine Stimme, kein Eintrag, Datei fehlt): dann zeigt die Blase U23. */
export function ansageUrl(id: string): string | null {
  return urlJeId.get(id) ?? null;
}

/** Gibt es in dieser Fassung eine Stimme? Ohne Stimme zeigt die Kapitelübersicht U36 statt des Schalters (EP14). */
export const STIMME_VORHANDEN: boolean = manifest.stimme !== null;

/** Namensnennung der Stimme (EP21): steht klein unter dem Stimmen-Schalter der Kapitelübersicht. */
export const NAMENSNENNUNG: string | null = manifest.stimme?.namensnennung ?? null;
