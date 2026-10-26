import { cpSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const root = import.meta.dirname;
const repo = path.resolve(root, '..');
const rendererBuild = path.join(repo, 'out/web');

/**
 * Serve the Electron renderer as a static site under `/web/`.
 *
 * The home page embeds the real application in an iframe, so the page shows
 * the shipping interface instead of a picture of it.
 */
function rendererSite(): Plugin {
  return {
    name: 'halo-renderer-site',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith('/web/')) {
          next();
          return;
        }

        const file = path.join(rendererBuild, url.slice('/web/'.length) || 'index.html');
        const target = existsSync(file) && !file.endsWith(path.sep) ? file : null;
        if (!target || !existsSync(target)) {
          res.statusCode = 404;
          res.end('The renderer build is missing. Run `npm run web:build` first.');
          return;
        }

        res.setHeader(
          'Content-Type',
          target.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream',
        );
        res.end(readFileSync(target));
      });
    },
    closeBundle() {
      if (existsSync(rendererBuild)) {
        cpSync(rendererBuild, path.join(root, 'dist/web'), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root,
  // The router uses real paths, so the assets have to be served from the root.
  base: '/',
  plugins: [react(), tailwindcss(), rendererSite()],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
  },
});
