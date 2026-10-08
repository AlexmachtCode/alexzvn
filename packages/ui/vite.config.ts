// Galerie von @jm/ui und @jm/settings (Spec 3.10): Vite ohne Electron, nur auf dieser Maschine erreichbar.
//   npm run galerie -w @jm/ui           Dev-Server auf http://127.0.0.1:5199/
//   npm run galerie:bauen -w @jm/ui     Bau nach packages/ui/galerie/dist (per .gitignore „dist“ ignoriert)
//   npm run galerie:pruefen -w @jm/ui   Bau + Klassen-Probe (galerie/pruefe-klassen.ts)
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./galerie', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  preview: { host: '127.0.0.1', port: 5199, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
