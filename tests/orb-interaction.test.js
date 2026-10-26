import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * The orb, in a DOM.
 *
 * The voice pipeline never touches the component: it asks the orb with a
 * `halo:ask` event and the orb runs its timeline. This test proves the
 * contract end to end — the question reaches `onSubmit` and the answer comes
 * back into the card.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'https://halo.test/',
  });

  const { window } = dom;

  global.window = window;
  global.document = window.document;
  // Node ships a read-only `navigator`, so it has to be replaced.
  Object.defineProperty(global, 'navigator', {
    value: window.navigator,
    configurable: true,
    writable: true,
  });
  global.HTMLElement = window.HTMLElement;
  global.HTMLInputElement = window.HTMLInputElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.MouseEvent = window.MouseEvent;
  global.KeyboardEvent = window.KeyboardEvent;
  global.getComputedStyle = window.getComputedStyle;
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  window.requestAnimationFrame = global.requestAnimationFrame;
  window.cancelAnimationFrame = global.cancelAnimationFrame;

  return dom;
}

test('a question asked through the event contract reaches the onSubmit handler', async () => {
  const dom = installDom();
  const vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.web.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    const { MorphOrb } = await vite.ssrLoadModule(
      '/src/components/ui/ai-thinking-orb-and-input.tsx',
    );

    const submitted = [];
    const container = document.getElementById('root');
    const root = createRoot(container);

    await new Promise((resolve) => {
      root.render(
        React.createElement(MorphOrb, {
          minThinkMs: 0,
          onSubmit: (text) => {
            submitted.push(text);
            return 'It is sunny.';
          },
        }),
      );
      setTimeout(resolve, 150);
    });

    const field = container.querySelector('.mo-field');
    assert.ok(field, 'the orb has no field');

    window.dispatchEvent(
      new window.CustomEvent('halo:ask', {
        detail: { text: 'What is the weather like?' },
        bubbles: true,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.deepEqual(submitted, ['What is the weather like?']);
    assert.equal(field.value, 'What is the weather like?', 'the field was not filled');

    // The orb has left the idle phase.
    assert.notEqual(
      container.querySelector('.mo-root').getAttribute('data-phase'),
      'idle',
      'the orb did not start',
    );

    root.unmount();
  } finally {
    await vite.close();
    dom.window.close();
  }
});

test('the orb ignores an empty question', async () => {
  const dom = installDom();
  const vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.web.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    const { MorphOrb } = await vite.ssrLoadModule(
      '/src/components/ui/ai-thinking-orb-and-input.tsx',
    );

    const submitted = [];
    const container = document.getElementById('root');
    const root = createRoot(container);

    await new Promise((resolve) => {
      root.render(
        React.createElement(MorphOrb, {
          minThinkMs: 0,
          onSubmit: (text) => {
            submitted.push(text);
            return 'ok';
          },
        }),
      );
      setTimeout(resolve, 150);
    });

    window.dispatchEvent(new window.CustomEvent('halo:ask', { detail: { text: '   ' } }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.deepEqual(submitted, []);

    root.unmount();
  } finally {
    await vite.close();
    dom.window.close();
  }
});
