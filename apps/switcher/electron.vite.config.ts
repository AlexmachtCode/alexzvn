import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// @jm/media + @jm/companion-protocol als Quelle bündeln (kein Laufzeit-require);
// @jm/ndi bleibt EXTERN (natives Addon, zur Laufzeit geladen).
// @jm/discovery + bonjour-service (Transitiv-Dep) ebenfalls bündeln (mDNS).
const internalPackages = [
  '@jm/app-runtime',
  '@jm/media',
  '@jm/companion-protocol',
  '@jm/suite-control-protocol',
  '@jm/discovery',
  'bonjour-service',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Entry des utilityProcess (nativer NDI-Empfänger). Landet als
          // out/main/ndi-recv.cjs und wird per utilityProcess.fork geladen.
          'ndi-recv': resolve(__dirname, 'src/utility/ndi-recv.ts'),
          // Entry des utilityProcess (nativer NDI-Sender, Program/Multiview-
          // Ausgabe) → out/main/ndi-send.cjs.
          'ndi-send': resolve(__dirname, 'src/utility/ndi-send.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        ...sharedAlias,
      },
    },
    server: {
      host: true,
      port: 5181,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
