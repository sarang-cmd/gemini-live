/**
 * The release workflow, checked.
 *
 * The installers are built on the GitHub runners, because a build machine
 * that cannot reach the GitHub releases cannot download the Electron runtime
 * at all. These tests keep the two failure modes that cost a release from
 * coming back: the publish step needs the repository, because the release
 * job has no checkout, and the deb package needs a maintainer with an email
 * address.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(path.join(ROOT, '.github/workflows/release.yml'), 'utf8');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('the workflow builds the installers on both systems', () => {
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /electron-builder --win --publish never/);
  assert.match(workflow, /electron-builder --linux --publish never/);
});

test('the publish step names the repository, because the job has no checkout', () => {
  const publish = workflow.slice(workflow.indexOf('- name: Publish'));
  assert.match(publish, /--repo "\$REPO"/);
  assert.match(publish, /REPO: \$\{\{ github\.repository \}\}/);
  assert.match(publish, /gh release upload .*--clobber/);
});

test('a failure on Linux does not keep the Windows installers from being released', () => {
  const linux = workflow.slice(workflow.indexOf('  linux:'), workflow.indexOf('  release:'));
  assert.match(linux, /continue-on-error: true/);
});

test('the AppImage is built without FUSE, which the runner does not have', () => {
  assert.match(workflow, /ELECTRON_BUILDER_APPIMAGE_EXTRACT_AND_RUN/);
});

test('the installers are committed to the repository as well', () => {
  const repository = workflow.slice(workflow.indexOf('  repository:'));
  assert.match(repository, /git add -f release/);
  assert.match(repository, /git push origin HEAD:main/);
});

test('the package has an author with an email address, which the deb needs', () => {
  assert.match(pkg.author, /<[^>]+@[^>]+>/);
});

test('the package names the two Windows targets and the two Linux ones', () => {
  assert.deepEqual(pkg.build.win.target, ['nsis', 'portable']);
  assert.deepEqual(pkg.build.linux.target, ['AppImage', 'deb']);
  assert.equal(pkg.build.directories.output, 'release');
});
