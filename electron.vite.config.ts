import { resolve } from 'node:path';

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = import.meta.dirname;

/**
 * Three builds in one:
 *
 *   main    → out/main/index.js    (ESM, the Electron main process)
 *   preload → out/preload/index.cjs (CJS, the context bridge)
 *   renderer→ out/renderer          (React + Tailwind, loaded over file://)
 *
 * The renderer is rooted at the project root so the shadcn layout holds:
 * `src/index.css`, `src/components/ui/…` and the `@/` alias.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve(root, 'electron/index.ts') },
        output: { format: 'es', entryFileNames: '[name].js' },
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: resolve(root, 'electron/preload.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },

  renderer: {
    root,
    publicDir: false,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(root, 'src'),
      },
    },
    build: {
      outDir: 'out/renderer',
      emptyOutDir: true,
      minify: true,
      // The audio worklets must stay real files: a `data:` URL would be
      // blocked by the content security policy.
      assetsInlineLimit: 0,
      rollupOptions: {
        input: { index: resolve(root, 'index.html') },
      },
    },
  },
});
