/**
 * The main process, checked.
 *
 * The main is built as an ES module, and electron-vite puts a CommonJS shim
 * for the directory of the file in that bundle when the code needs one. A
 * second declaration of the same name in the same module stops the app
 * before the window opens, with "Identifier '__dirname' has already been
 * declared", so the main process must not declare it itself.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = readFileSync(path.join(ROOT, 'electron/index.ts'), 'utf8');
const builtMain = path.join(ROOT, 'out/main/index.js');

test('the main process does not declare the directory of the file itself', () => {
  assert.doesNotMatch(main, /^\s*(const|let|var)\s+__dirname\b/m);
  assert.doesNotMatch(main, /^\s*(const|let|var)\s+__filename\b/m);
});

test('the main process keeps the paths of the renderer and of the preload', () => {
  assert.match(main, /'\.\.\/renderer\/index\.html'/);
  assert.match(main, /'\.\.\/preload\/index\.cjs'/);
});

test('the built main declares the directory of the file once', { skip: !existsSync(builtMain) }, () => {
  const built = readFileSync(builtMain, 'utf8');
  const declarations = built.match(/^\s*(const|let|var)\s+__dirname\b/gm) ?? [];
  assert.ok(
    declarations.length <= 1,
    `the built main declares __dirname ${declarations.length} times`,
  );
});

test('the built main and the built preload parse', { skip: !existsSync(builtMain) }, () => {
  for (const file of [builtMain, path.join(ROOT, 'out/preload/index.cjs')]) {
    if (!existsSync(file)) continue;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file} does not parse:\n${result.stderr}`);
  }
});
