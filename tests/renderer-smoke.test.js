import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Render the React shell without a browser.
 *
 * Vite resolves the `@/` alias and the CSS imports exactly like the real
 * build, so a broken import or a render-time crash fails here instead of in
 * the window.
 */
test('the renderer mounts without throwing', async () => {
  const vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.web.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.tsx');

    const html = renderToString(React.createElement(App));

    assert.match(html, /class="mo-root"/, 'the orb is missing');
    assert.match(html, /class="mo-input"/, 'the orb input is missing');
    assert.match(html, /class="mo-field"/, 'the orb field is missing');
    assert.match(html, /class="mo-orb"/, 'the orb canvas is missing');
    assert.match(html, /Ask Halo/, 'the placeholder is missing');
    assert.match(html, /data-phase="idle"/, 'the orb did not start in the idle phase');
    assert.match(html, /Halo/, 'the app chrome is missing');
  } finally {
    await vite.close();
  }
});
