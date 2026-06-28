import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// Source-Workspace-Pakete inline bündeln. @jm/media (ffmpeg-Locate/Spawn) +
// @jm/remote (Voting per Handy) + @jm/discovery/bonjour (Titler-Kopplung).
const internalPackages = [
  '@jm/app-runtime',
  '@jm/control-config',
  '@jm/suite-control-protocol',
  '@jm/discovery',
  '@jm/remote',
  '@jm/media',
  '@jm/show',
  'bonjour-service',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
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
    server: { host: true, port: 5194, strictPort: true },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
