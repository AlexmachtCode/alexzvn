import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// Workspace-Pakete (reines TS) bündeln statt externalisieren — gepackte Apps
// liefern kein node_modules, also darf nichts zur Laufzeit `require`d werden.
// @jm/discovery + bonjour-service (dessen Transitiv-Dep) mit in den Main-Bundle
// nehmen — die gepackte App liefert kein node_modules.
const internalPackages = [
  '@jm/app-runtime',
  '@jm/show',
  '@jm/discovery',
  '@jm/suite-control-protocol',
  'bonjour-service',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      // Build the main process as CommonJS — Electron 33's ESM main has a
      // known interop bug with CJS deps (socket.io, etc.) that causes
      // "Cannot read properties of undefined (reading 'exports')" on startup.
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
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
      port: 5173,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
