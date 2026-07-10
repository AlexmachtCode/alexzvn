import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Baut die Laufzeit als EINE klassische Script-Datei (IIFE), nicht als ES-Modul.
//
// Grund: Ein exportiertes Bundle soll per Doppelklick von `file://` laufen. Dort
// blockiert CORS jedes `<script type="module">` — ein ESM-Build wäre auf dem
// Messe-Terminal (USB-Stick, Kundenübergabe) tot, während er im Dev-Server läuft.
//
// Die Ausgabe landet in `dist/runtime.js` und wird von apps/app-designer sowohl
// hinter `jmapp://preview/runtime.js` (Sandbox) als auch in jedes Export-Bundle
// gelegt.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/runtime/entry.ts'),
      name: 'JMApp',
      formats: ['iife'],
      fileName: () => 'runtime.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    // Kleine Datei, große Wirkung: das Bundle liegt in jeder exportierten App.
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
