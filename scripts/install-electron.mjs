/**
 * Fetch the Electron runtime.
 *
 * The `electron` package downloads its runtime in a postinstall script. When
 * that download is blocked, or when npm was told to skip install scripts,
 * the package is there but the binary is not, and electron-vite stops with
 * "Electron uninstall".
 *
 * This script runs the same installer by hand and explains what to do when
 * the download itself is the problem.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = path.join(root, 'node_modules', 'electron');
const installer = path.join(electron, 'install.js');
const runtime = path.join(electron, 'dist');

if (!existsSync(electron)) {
  console.error('The electron package is not installed. Run `npm install` first.');
  process.exit(1);
}

if (existsSync(runtime)) {
  console.log('The Electron runtime is already in node_modules/electron/dist.');
  process.exit(0);
}

if (!existsSync(installer)) {
  console.error('node_modules/electron/install.js is missing, so the package is broken.');
  console.error('Delete node_modules/electron and run `npm install` again.');
  process.exit(1);
}

console.log('Downloading the Electron runtime...');

const child = spawn(process.execPath, [installer], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  if (code === 0 && existsSync(runtime)) {
    console.log('The Electron runtime is ready.');
    process.exit(0);
  }

  console.error('');
  console.error('The download did not finish.');
  console.error('The runtime is hosted on the GitHub releases, and that host is often');
  console.error('blocked on corporate networks. Point the downloader at a mirror and');
  console.error('try again:');
  console.error('');
  console.error('  set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/');
  console.error('  npm run electron:install');
  console.error('');
  console.error('On Windows the same works from PowerShell:');
  console.error('');
  console.error('  $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"');
  console.error('  npm run electron:install');
  process.exit(code ?? 1);
});
