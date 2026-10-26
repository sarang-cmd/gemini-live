import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

function scriptFiles() {
  return readdirSync(path.join(ROOT, 'public/js')).filter((file) => file.endsWith('.js'));
}

test('every element id referenced by the app exists in the markup', () => {
  const missing = [];

  for (const file of scriptFiles()) {
    const source = readFileSync(path.join(ROOT, 'public/js', file), 'utf8');
    for (const match of source.matchAll(/\$\('([^']+)'\)/g)) {
      if (!htmlIds.has(match[1])) missing.push(`${file} → #${match[1]}`);
    }
    for (const match of source.matchAll(/getElementById\('([^']+)'\)/g)) {
      if (!htmlIds.has(match[1])) missing.push(`${file} → #${match[1]}`);
    }
  }

  assert.deepEqual(missing, [], `missing element ids:\n${missing.join('\n')}`);
});

test('querySelector hooks in the markup resolve to real elements', () => {
  const app = readFileSync(path.join(ROOT, 'public/js/app.js'), 'utf8');

  // The app wires the tab strip generically and jumps to the voices/settings
  // tabs by selector, so both shapes have to exist in the markup.
  assert.ok(app.includes(".panel-tabs button"), 'app.js does not query the tab strip');
  assert.ok(app.includes('data-panel'), 'app.js does not toggle the panels');

  for (const tab of ['transcript', 'voices', 'settings']) {
    assert.match(html, new RegExp(`data-tab="${tab}"`), `markup is missing the ${tab} tab`);
    assert.match(html, new RegExp(`data-panel="${tab}"`), `markup is missing the ${tab} panel`);
  }

  assert.match(html, /id="voice-grid"/);
  assert.match(html, /id="transcript"/);
  assert.match(html, /id="orb"/);
});

test('the stylesheet ships rules for the classes the app toggles', () => {
  const css = readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
  for (const className of [
    'voice-card',
    'voice-preview',
    'talk-btn',
    'turn',
    'transcript-empty',
    'status-dot',
    'banner',
    'toast',
  ]) {
    assert.ok(css.includes(`.${className}`), `stylesheet has no .${className} rule`);
  }
});

test('the app boots the modules it needs', () => {
  const app = readFileSync(path.join(ROOT, 'public/js/app.js'), 'utf8');
  for (const module of [
    './voices.js',
    './models.js',
    './audio.js',
    './orb.js',
    './session.js',
    './demo.js',
    './state.js',
    './protocol.js',
  ]) {
    assert.ok(app.includes(`'${module}'`), `app.js does not import ${module}`);
  }
});

test('the worklets are reachable at the paths the engine loads', () => {
  const audio = readFileSync(path.join(ROOT, 'public/js/audio.js'), 'utf8');
  assert.match(audio, /'\/worklets\/pcm-capture\.js'/);
  assert.match(audio, /'\/worklets\/pcm-player\.js'/);
  for (const file of ['pcm-capture.js', 'pcm-player.js']) {
    assert.ok(
      readFileSync(path.join(ROOT, 'public/worklets', file), 'utf8').includes(
        'registerProcessor',
      ),
    );
  }
});

test('every asset the page references exists on disk', () => {
  const assets = new Set();

  for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    assets.add(match[1]);
  }
  for (const file of scriptFiles()) {
    const source = readFileSync(path.join(ROOT, 'public/js', file), 'utf8');
    for (const match of source.matchAll(/from '\.\/([^']+)'/g)) {
      assets.add(`/js/${match[1]}`);
    }
    for (const match of source.matchAll(/'(\/worklets\/[^']+)'/g)) {
      assets.add(match[1]);
    }
  }

  assert.ok(assets.size >= 8, `only found ${assets.size} assets`);
  for (const asset of assets) {
    const file = path.join(ROOT, 'public', asset.replace(/^\//, ''));
    assert.ok(existsSync(file), `missing asset ${asset}`);
  }
});
