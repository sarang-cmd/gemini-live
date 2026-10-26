import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The browser preview.
 *
 * It serves exactly the same renderer as the Electron app, but without the
 * `window.halo` bridge — perfect for working on the UI, and for the live
 * preview in the browser.
 */
export default defineConfig({
  root: import.meta.dirname,
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The live preview is served through a proxy host.
    allowedHosts: true,
  },
  build: {
    outDir: 'out/web',
    emptyOutDir: true,
  },
});
