import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    // Bundle fflate INTO the main bundle instead of externalizing it: the main
    // process reads pptx animations with it, and the packaged app ships only
    // out/** + package.json (no node_modules), so an externalized require could
    // fail at runtime. fflate is pure JS and bundles cleanly. Gleiches gilt für
    // @jm/discovery + bonjour-service (mDNS-Annoncierung der Fernsteuerung).
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@jm/app-runtime',
          '@jm/show',
          '@jm/suite-control-protocol',
          'fflate',
          '@jm/discovery',
          'bonjour-service',
        ],
      }),
    ],
    resolve: { alias: sharedAlias },
    build: {
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
      port: 5179,
      strictPort: true,
    },
    // pdfjs-dist ships its worker as a separate ESM chunk; let Vite emit it.
    worker: {
      format: 'es',
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
