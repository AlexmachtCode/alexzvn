// ─────────────────────────────────────────────────────────────────────────────
// @jm/iveo — Einstiegspunkt. Typen + Client + Mapper.
//
// ⚠️  Der Client ist MAIN-ONLY (Token ist Secret, API ist server-side-only, §1).
//     Renderer importieren höchstens die Typen/Mapper (reine Datenfunktionen).
// ─────────────────────────────────────────────────────────────────────────────

export * from './types';
export * from './mapper';
export {
  IveoClient,
  IveoApiError,
  IVEO_DEFAULT_BASE_URL,
  normalizeIveoBaseUrl,
  type IveoClientOptions,
  type IveoFetchLike,
  type IveoFetchResponse,
} from './client';

import { IveoClient, type IveoClientOptions } from './client';

/** Kurzform für den typischen Fall im Main-Prozess. */
export function createIveoClient(opts: IveoClientOptions): IveoClient {
  return new IveoClient(opts);
}
