import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// Reine Quell-Workspace-Pakete (kein gebautes dist) als Quelle bündeln statt zur
// Laufzeit `require`n. @jm/ndi bleibt extern (natives Addon, zur Laufzeit geladen).
const internalPackages = ['@jm/app-runtime', '@jm/electron-kit', '@jm/rtc', '@jm/suite-control-protocol'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // utilityProcess-Entry (nativer NDI-Sender, EINE Instanz je Gast) →
          // out/main/ndi-guest-sender.cjs, geladen per utilityProcess.fork.
          'ndi-guest-sender': resolve(__dirname, 'src/utility/ndi-guest-sender.ts'),
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
        // Preload als CommonJS — unter sandbox:true lädt Electron keine ESM-Preloads.
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
      port: 5181,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        // Zwei Renderer: Operator-UI (index) + versteckter WebRTC-Peer (peer).
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          peer: resolve(__dirname, 'src/renderer/peer.html'),
        },
      },
    },
  },
});
