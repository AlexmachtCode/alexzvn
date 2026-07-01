import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Workspace-Pakete als Quelle bündeln (nicht externalisieren), damit ihr TS
// im Main-/Preload-Output landet statt zur Laufzeit `require`d zu werden.
const internalPackages = [
  '@jm/app-runtime',
  '@jm/control-config',
  '@jm/cookbook',
  '@jm/discovery',
  '@jm/electron-kit',
  '@jm/iveo',
  '@jm/show',
  '@jm/suite-control-protocol',
  '@jm/suite-manifest',
  // Transitiv von @jm/discovery — muss mit in den Main-Bundle.
  'bonjour-service',
];

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    // Proxy-Key zur Build-Zeit einbacken (aus dem CI-Secret JMPS_PROXY_KEY);
    // leer in lokalen Dev-Builds → dann greift der Token-Fallback.
    define: {
      __JMPS_PROXY_KEY__: JSON.stringify(process.env.JMPS_PROXY_KEY ?? ''),
    },
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
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        // P2 (#60): Preload als CommonJS — unter sandbox:true lädt Electron keine
        // ESM-Preloads (.mjs). CJS ist auch ohne Sandbox unproblematisch.
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
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
      port: 5170,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
