// utilityProcess-Einstieg des NDI-Ausgangs (#303). EINZIGER Ort, der @jm/ndi lädt – alle anderen Dateien
// importieren es höchstens als Typ (`import type`), damit das Mac-Paket ohne NDI baut und startet.
//
// Geladen wird mit `require` in einem Lade-Rückruf, den der Kern im `try` aufruft: Das Bündel ist CommonJS, und der
// Lader von @jm/ndi wirft schon beim Laden, wenn Addon oder NDI-Laufzeit fehlen. Kein `import('@jm/ndi')`: Rollup
// ließe ein externes `import()` im CJS-Bündel als echtes ESM-`import()` stehen, und das liefert vom Lader
// (`module.exports` = Addon) nur `default`.
import { starteNdiSenderKern } from './ndi-sender-kern';
import type { NdiSendeModul } from './ndi-sender-kern';

starteNdiSenderKern(process.parentPort, async () => require('@jm/ndi') as NdiSendeModul);
