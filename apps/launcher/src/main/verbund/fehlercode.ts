/**
 * Fehlercode eines Wurfs (`err.code` wie EPERM, EADDRINUSE) für Zustand und Log. Nur der Code, nie der Text:
 * Fehlertexte nennen Pfade und können Fremdinhalte zitieren. Ohne Code: 'UNBEKANNT'.
 */
export function fehlerCode(e: unknown): string {
  const code = (e as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code !== '' ? code : 'UNBEKANNT';
}
