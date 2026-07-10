// Show-Integration (Welle 6.3b): wird JM Connect über einen Show-Deep-Link gestartet
// (jmps://open?show=<pfad>), liest es die Sprecher-Liste der Veranstaltung aus der `.jmshow`.
// Daraus erzeugt der Operator mit einem Klick Join-Links + QR-Codes für die Remote-Zuschaltung.
//
// SICHERHEITSGRENZE (unverändert): der Launcher ist alleiniger iveo-Token-Halter und schreibt nur
// TOKEN-FREIE Sprecherdaten (`show.iveo.speakers` = Name + Funktion) in die Show. Die Join-Token
// entstehen ausschließlich hier im Main aus dem Raum-Secret (siehe room.ts) — es steht nie in der
// Show-Datei, die geteilt und versioniert wird.
//
// Muster gespiegelt von apps/grafiktool/src/main/show-open.ts.
import { readFile } from 'node:fs/promises';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import type { ShowInfo } from '@shared/types';

let current: ShowInfo | null = null;
let onChange: (show: ShowInfo | null) => void = () => {};

export function initShow(cb: (show: ShowInfo | null) => void): void {
  onChange = cb;
}

/** Zuletzt geöffnete Show (auch für den Kaltstart, bevor der Renderer da ist). */
export function showInfo(): ShowInfo | null {
  return current;
}

/**
 * Raum-ID der Show. Bevorzugt der explizit gepflegte Wert aus dem Show-Editor; sonst aus dem
 * Show-Namen abgeleitet. Das MUSS deterministisch sein: derselbe Raum + das gespeicherte Secret
 * halten vorab verteilte Join-Links über App-Neustarts hinweg gültig.
 */
function roomFor(show: { name: string; tools: { appId: string; settings?: Record<string, unknown> }[] }): string {
  const ref = show.tools.find((t) => t.appId === 'jm-connect');
  const explicit = sanitizeRoom(String(ref?.settings?.['room'] ?? ''));
  if (explicit) return explicit;
  const slug = show.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'show';
}

function sanitizeRoom(room: string): string {
  return room.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

/** Show-Deep-Link verarbeiten: Sprecher + Raum übernehmen und den Renderer benachrichtigen. */
export async function handleShowDeepLink(url: string): Promise<void> {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(await readFile(showPath, 'utf8'));
    current = {
      name: show.name,
      room: roomFor(show),
      eventName: show.iveo?.name ?? null,
      speakers: (show.iveo?.speakers ?? []).map((s) => ({ name: s.name, title: s.title ?? null })),
    };
    onChange(current);
  } catch (e) {
    getLog().error(`Show konnte nicht gelesen werden: ${(e as Error).message}`);
  }
}
