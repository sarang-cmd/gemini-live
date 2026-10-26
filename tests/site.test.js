/**
 * The marketing site, checked.
 *
 * These tests cover the parts of the site that can be verified without a
 * browser: the copy rules, the colour contrast, the rendered markup and the
 * interactive parts (dialog, tabs, accordion, copy button, router).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css|html)$/.test(entry)) out.push(full);
  }
  return out;
}

const siteFiles = walk(path.join(SITE, 'src')).concat([path.join(SITE, 'index.html')]);
const siteSource = siteFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const contentSource = readFileSync(path.join(SITE, 'src/content.ts'), 'utf8');

/* ------------------------------------------------------------------ copy */

test('the site copy avoids em dashes and en dashes', () => {
  const offenders = siteFiles.filter((file) => /[\u2014\u2013]/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(
    offenders.map((file) => path.relative(ROOT, file)),
    [],
    'em dashes and en dashes are not allowed in the copy',
  );
});

test('the site does not use the fonts and icons that were ruled out', () => {
  assert.ok(!/Inter\b/.test(siteSource), 'Inter must not appear on the site');
  assert.ok(!/Geist/i.test(siteSource), 'Geist must not appear on the site');
  assert.ok(!/Space Grotesk/i.test(siteSource), 'Space Grotesk must not appear on the site');
  assert.ok(!/lucide/i.test(siteSource), 'lucide icons must not appear on the site');
  assert.ok(!/emoji/i.test(siteSource), 'no emoji');
});

test('no emoji reached the copy', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const offenders = siteFiles.filter((file) => emoji.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders.map((file) => path.relative(ROOT, file)), []);
});

test('the copy does not use the "not X, but Y" shape', () => {
  const offenders = contentSource.split('\n').filter((line) => /,\s*(but|but rather)\b/i.test(line));
  assert.deepEqual(offenders, [], 'the copy must not lean on that construction');
});

test('the download page names the installers that were built', () => {
  assert.match(contentSource, /Halo\.Setup\.2\.0\.1\.exe/);
  assert.match(contentSource, /Halo-2\.0\.1\.AppImage/);
  assert.match(contentSource, /halo_2\.0\.1_amd64\.deb/);
  assert.match(contentSource, /releases\/tag\/v2\.0\.1/);
});

test('the site names both legal pages and marks the open questions', () => {
  assert.match(contentSource, /export const privacy/);
  assert.match(contentSource, /export const terms/);
  assert.match(contentSource, /Draft/);
});

/* -------------------------------------------------------------- contrast */

function readTokens() {
  const css = readFileSync(path.join(SITE, 'src/styles/tokens.css'), 'utf8');
  const tokens = {};
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  const high = Math.max(first, second);
  const low = Math.min(first, second);
  return (high + 0.05) / (low + 0.05);
}

test('every text colour passes the contrast rules', () => {
  const tokens = readTokens();
  const backgrounds = ['paper', 'paper-2', 'paper-3', 'card'];
  const foregrounds = ['ink', 'ink-2', 'ink-3', 'accent'];

  for (const foreground of foregrounds) {
    for (const background of backgrounds) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      assert.ok(
        ratio >= 4.5,
        `${foreground} on ${background} is ${ratio.toFixed(2)} to 1, which is below 4.5`,
      );
    }
  }

  assert.ok(
    contrast(tokens['accent-ink'], tokens['accent-wash']) >= 4.5,
    'the accent wash background needs readable text on top of it',
  );
});

test('the page background is warm, not pure white', () => {
  const tokens = readTokens();
  assert.notEqual(tokens.paper.toLowerCase(), '#ffffff');
  const r = parseInt(tokens.paper.slice(1, 3), 16);
  const g = parseInt(tokens.paper.slice(3, 5), 16);
  const b = parseInt(tokens.paper.slice(5, 7), 16);
  assert.ok(r > b, 'the paper must be warmer than it is cool');
  assert.ok(g >= b, 'the paper must be warmer than it is cool');
});

/* --------------------------------------------------------------- markup */

test('the Vercel configuration builds the site and rewrites the routes', () => {
  const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

  assert.equal(config.buildCommand, 'npm run site:build');
  assert.equal(config.outputDirectory, 'site/dist');
  assert.equal(config.build.env.ELECTRON_SKIP_BINARY_DOWNLOAD, '1');
  assert.ok(
    config.rewrites.some((rewrite) => rewrite.destination === '/index.html'),
    'the client side routes need a rewrite to the shell',
  );
});

test('the renderer build addresses its assets relatively, so it can live under /web/', () => {
  const built = path.join(ROOT, 'out/web/index.html');
  if (!existsSync(built)) {
    // The build has not been run in this checkout; nothing to check.
    return;
  }

  const html = readFileSync(built, 'utf8');
  assert.match(html, /src="\.\/assets\//, 'the renderer assets must be relative');
  assert.doesNotMatch(html, /src="\/assets\//, 'an absolute path would break the frame');
});

async function withSite(fn) {
  // The DOM has to exist before any site module is imported: Radix and the
  // scroll helpers read `document` when they are first evaluated.
  ensureDom();

  const vite = await createServer({
    root: SITE,
    configFile: path.join(SITE, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    return await fn(vite);
  } finally {
    await vite.close();
  }
}

test('the home page renders the real application and the real sections', async () => {
  await withSite(async (vite) => {
    const { Home } = await vite.ssrLoadModule('/src/pages/Home.tsx');
    const html = renderToString(React.createElement(Home));

    assert.match(html, /A voice assistant that shows you what it is doing/);
    assert.match(html, /<iframe[^>]*src="\/web\/index\.html"/, 'the demo must embed the app');
    assert.match(html, /Three steps, and you can see each one/);
    assert.match(html, /Under the hood/);
    assert.match(html, /The voices you can pick/);
    assert.match(html, /Run it on your machine/);
    assert.match(html, /Questions worth answering/);
    assert.match(html, /gemini-3\.8-live/, 'the real model name must appear');
    assert.match(html, /canopylabs\/orpheus-v1-english/, 'the real speech model must appear');
  });
});

test('the legal pages render their drafts instead of invented commitments', async () => {
  await withSite(async (vite) => {
    const { Privacy } = await vite.ssrLoadModule('/src/pages/Privacy.tsx');
    const { Terms } = await vite.ssrLoadModule('/src/pages/Terms.tsx');

    const privacy = renderToString(React.createElement(Privacy));
    assert.match(privacy, /What happens to your data/);
    assert.match(privacy, /Draft/);

    const terms = renderToString(React.createElement(Terms));
    assert.match(terms, /Terms of use/);
    assert.match(terms, /has not been reviewed by a lawyer/);
    assert.match(terms, /Draft/);
  });
});

test('every internal link points at a page that exists', async () => {
  await withSite(async (vite) => {
    ensureDom();
    const { default: App } = await vite.ssrLoadModule('/src/App.tsx');
    const html = renderToString(React.createElement(App));

    const targets = new Set([...html.matchAll(/href="(\/[^"#]*)"/g)].map((match) => match[1]));
    const known = new Set(['/', '/download', '/privacy', '/terms']);

    for (const target of targets) {
      assert.ok(known.has(target), `${target} is not a page of this site`);
    }
  });
});

/* ---------------------------------------------------------- interaction */

function installDom(url = 'https://halo.test/') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    url,
  });

  const { window } = dom;

  global.window = window;
  global.document = window.document;
  Object.defineProperty(global, 'navigator', {
    value: window.navigator,
    configurable: true,
    writable: true,
  });

  for (const name of [
    'HTMLElement',
    'HTMLInputElement',
    'Element',
    'Node',
    'Event',
    'CustomEvent',
    'MouseEvent',
    'KeyboardEvent',
    'FocusEvent',
    'MutationObserver',
    'NodeFilter',
    'PopStateEvent',
    'Text',
    'DocumentFragment',
    'SVGElement',
    'getComputedStyle',
  ]) {
    global[name] = window[name];
  }

  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  window.requestAnimationFrame = global.requestAnimationFrame;
  window.cancelAnimationFrame = global.cancelAnimationFrame;

  // jsdom does not implement these, and Radix, Motion and the router want them.
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
  global.matchMedia = window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = window.ResizeObserver;
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = () => {};

  const copied = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    value: {
      writeText: async (text) => {
        copied.push(text);
      },
    },
    configurable: true,
  });

  return { dom, window, copied };
}

let sharedDom = null;

/**
 * One jsdom window for the whole file.
 *
 * Radix and the remove scroll helpers reach for `document` when they are
 * first imported, so every test has to share the same window.
 */
function ensureDom(url) {
  if (!sharedDom) sharedDom = installDom(url);
  return sharedDom;
}

async function mountSite(vite, url) {
  const dom = ensureDom(url);
  const { window } = dom;
  const { default: App } = await vite.ssrLoadModule('/src/App.tsx');
  const container = window.document.getElementById('root');
  const root = createRoot(container);

  window.history.pushState({}, '', '/');
  root.render(React.createElement(App));
  await new Promise((resolve) => setTimeout(resolve, 300));

  return { ...dom, container, root, App };
}

test('the mobile menu opens and closes', async () => {
  await withSite(async (vite) => {
    const { window, container, root } = await mountSite(vite);

    const trigger = container.querySelector('.nav-mobile-trigger');
    assert.ok(trigger, 'there is no menu button');

    trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 120));

    const panel = window.document.querySelector('.dialog-panel');
    assert.ok(panel, 'the menu did not open');
    assert.match(panel.textContent, /Overview/);

    const close = panel.querySelector('button');
    close.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 120));

    assert.equal(window.document.querySelector('.dialog-panel'), null, 'the menu did not close');

    root.unmount();
  });
});

test('the provider tabs swap the content', async () => {
  await withSite(async (vite) => {
    const { window, container, root } = await mountSite(vite);

    const triggers = [...container.querySelectorAll('.tabs-trigger')];
    assert.equal(triggers.length, 2, 'there should be two providers');

    const groq = triggers.find((trigger) => trigger.textContent.trim() === 'Groq');
    groq.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
    groq.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const panel = container.querySelector('.tabs-panel[data-state="active"]');
    assert.ok(panel, 'no panel is active');
    assert.match(panel.textContent, /whisper-large-v3-turbo/);

    root.unmount();
  });
});

test('the FAQ opens an answer', async () => {
  await withSite(async (vite) => {
    const { window, container, root } = await mountSite(vite);

    const trigger = container.querySelector('.accordion-trigger');
    assert.ok(trigger, 'there is no FAQ question');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');

    trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(trigger.getAttribute('aria-expanded'), 'true', 'the answer did not open');
    const body = container.querySelector('.accordion-body');
    assert.match(body.textContent, /demo mode/);

    root.unmount();
  });
});

test('the command can be copied in one click', async () => {
  await withSite(async (vite) => {
    const { window, container, root, copied } = await mountSite(vite);

    const button = container.querySelector('.command button');
    assert.ok(button, 'there is no copy button');

    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(copied.length, 1, 'nothing was copied');
    assert.match(copied[0], /^git clone https:\/\/github\.com\/sarang-cmd\/gemini-live\.git/);
    assert.equal(button.textContent.trim(), 'Copied');

    root.unmount();
  });
});

test('the router moves between the pages', async () => {
  await withSite(async (vite) => {
    const { window, container, root } = await mountSite(vite);

    const link = [...container.querySelectorAll('a')].find(
      (anchor) => anchor.textContent.trim() === 'Privacy',
    );
    assert.ok(link, 'there is no link to the privacy page');

    link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(window.location.pathname, '/privacy');
    assert.match(container.textContent, /What happens to your data/);
    assert.match(container.textContent, /Contact address/);

    root.unmount();
  });
});

test('the demo frame points at the built renderer', async () => {
  await withSite(async (vite) => {
    const { window, container, root } = await mountSite(vite);

    const frame = container.querySelector('iframe');
    assert.ok(frame, 'there is no demo frame');
    assert.equal(frame.getAttribute('src'), '/web/index.html');
    assert.ok(frame.getAttribute('title'), 'the frame needs a title');

    root.unmount();
  });
});
