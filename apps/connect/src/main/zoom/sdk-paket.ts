// Das eine Zoom-SDK-Paket, das diese Connect-Fassung nachladen und einrichten darf (Spec SDK nachladen 2 und 4.1).
// Werte am hochgeladenen Asset nachgemessen (06.10.2026). Wird das ZIP je neu hochgeladen, müssen sha256 und
// Größen hier mit, und es braucht einen neuen Connect-Release: Connect richtet nur ein Paket ein, das genau zu
// seinem Code passt. Die Prüfsumme kommt nie vom Proxy. Rein: keine Importe.
export const SDK_PAKET = {
  /** = SDK_FASSUNG aus @jm/zoom-bridge (test/sdk-laden.test.ts gleicht ab). */
  fassung: '7.1.5.43953',
  datei: 'zoom-sdk-win-x64-7.1.5.43953.zip',
  sha256: '596ef61956b5f336570dd3cd14b0ec9822d51e37a2a4fc03ce4f96c1974b3b4e',
  /** Exakte Größe des ZIP. */
  bytes: 150_120_193,
  /** Summe der 153 entpackten Dateien. */
  bytesEntpackt: 329_657_415,
} as const;
