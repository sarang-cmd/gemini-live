/**
 * Halo — the Electron main process.
 *
 * The window is a plain Chromium surface with `contextIsolation` on and
 * `nodeIntegration` off; the renderer reaches the system through the narrow
 * `window.halo` bridge that `preload.ts` installs.
 */
import { app, BrowserWindow, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerIpc } from './ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function rendererUrl(): string {
  const devServer = process.env['ELECTRON_RENDERER_URL'];
  if (devServer) return devServer;
  return `file://${path.join(__dirname, '../renderer/index.html')}`;
}

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';

  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: '#04060d',
    title: 'Halo',
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac
      ? {}
      : {
          titleBarOverlay: {
            color: '#04060dd9',
            symbolColor: '#eef2ff',
            height: 44,
          },
        }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  void window.loadURL(rendererUrl());

  return window;
}

app.whenReady().then(() => {
  // The microphone is the whole point — always allow it for our own content.
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => {
    return permission === 'media';
  });

  registerIpc();
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
