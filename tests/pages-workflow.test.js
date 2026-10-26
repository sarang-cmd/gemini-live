/**
 * The Pages workflow, checked.
 *
 * GitHub Pages publishes this repository from the `gh-pages` branch, and the
 * token in use cannot create a Pages site through the API, so that branch is
 * what turned Pages on. These tests keep the publishing path intact: the site
 * has to be built for the path it is served from, written to that branch, and
 * the run has to ask for the build, because a push with the workflow token
 * does not start one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const plan = readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');

test('the site is built for the path Pages serves it from', () => {
  assert.match(workflow, /SITE_BASE: \/gemini-live\//);
});

test('the build is written to the branch that Pages publishes', () => {
  assert.match(workflow, /git init -q -b gh-pages/);
  assert.match(workflow, /git push --force/);
  assert.match(workflow, /git push --force[\s\S]*gh-pages/);
});

test('the branch is published as it is, Jekyll would drop the assets', () => {
  assert.match(workflow, /touch "\$publish\/\.nojekyll"/);
});

test('the run asks for the build, a push with the workflow token does not start one', () => {
  assert.match(workflow, /pages\/builds/);
  assert.match(workflow, /pages: write/);
});

test('the run checks that the public address serves the build it made', () => {
  assert.match(workflow, /sarang-cmd\.github\.io\/gemini-live/);
  assert.match(workflow, /grep -q "\$ASSET"/);
  assert.match(workflow, /steps\.build\.outputs\.asset/);
});

test('the routes that are not files still get a page', () => {
  assert.match(workflow, /cp site\/dist\/index\.html site\/dist\/404\.html/);
});

test('the readme names the public address', () => {
  assert.match(readme, /https:\/\/sarang-cmd\.github\.io\/gemini-live\//);
});

test('the plan tells how Pages was turned on', () => {
  assert.match(plan, /gh-pages/);
  assert.match(plan, /Resource not accessible by integration/);
});
