import type { SourceKind } from '@shared/types';
import { bytesToBlob } from './bytes';

// Per-window in-memory registry of the raw bytes behind sources and overlay
// images. Kept out of the React/Zustand state so large buffers aren't cloned on
// every update. Both the editor and the presenter/audience windows populate
// this — the editor on import/open, the present windows from the payload.

interface SourceEntry {
  kind: SourceKind;
  bytes: Uint8Array;
}

const sources = new Map<string, SourceEntry>();
const images = new Map<string, Uint8Array>();
const imageUrls = new Map<string, string>();

export function putSource(id: string, kind: SourceKind, bytes: Uint8Array): void {
  sources.set(id, { kind, bytes });
}

export function getSource(id: string): SourceEntry | undefined {
  return sources.get(id);
}

export function putImage(id: string, bytes: Uint8Array): void {
  images.set(id, bytes);
}

export function getImageBytes(id: string): Uint8Array | undefined {
  return images.get(id);
}

/** A cached object URL for an overlay image, for use in <img src>. */
export function imageObjectUrl(id: string): string | undefined {
  const cached = imageUrls.get(id);
  if (cached) return cached;
  const bytes = images.get(id);
  if (!bytes) return undefined;
  const url = URL.createObjectURL(bytesToBlob(bytes));
  imageUrls.set(id, url);
  return url;
}

export function allSourceIds(): string[] {
  return [...sources.keys()];
}

export function allImageIds(): string[] {
  return [...images.keys()];
}

export function removeSource(id: string): void {
  sources.delete(id);
}

/** Alles verwerfen; `behalte` = Quellen, die bleiben (beim Ersetzen die frisch gelesenen). */
export function clearAssets(behalte?: ReadonlySet<string>): void {
  for (const id of [...sources.keys()]) if (!behalte?.has(id)) sources.delete(id);
  images.clear();
  for (const url of imageUrls.values()) URL.revokeObjectURL(url);
  imageUrls.clear();
}
