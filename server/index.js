/**
 * Halo server.
 *
 * Responsibilities (and nothing else):
 *   1. serve the static app
 *   2. hand out short-lived ephemeral tokens so the API key stays server side
 *   3. optionally relay Live sessions for networks that block direct WebSockets
 *
 * Zero runtime dependencies — Node 20+ only.
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from './env.js';
import { createEphemeralToken, TokenError } from './tokens.js';
import { createProxyHub } from './proxy.js';
import { VOICES, DEFAULT_VOICE } from '../public/js/voices.js';
import { MODELS, DEFAULT_MODEL } from '../public/js/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const LOCK_TOKENS = process.env.GEMINI_LOCK_TOKENS === 'true';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const proxy = createProxyHub({ getApiKey: () => API_KEY });

/* ------------------------------------------------------------------ utils */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

async function readJsonBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Serve a file from `public/`, refusing anything that escapes the directory. */
async function serveStatic(req, res, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const target = path.resolve(PUBLIC_DIR, relative);

  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  let info;
  try {
    info = await stat(target);
  } catch {
    sendText(res, 404, 'Not found');
    return;
  }

  if (info.isDirectory()) {
    await serveStatic(req, res, path.posix.join(pathname, 'index.html'));
    return;
  }

  const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
    // Worklets need a same-origin script context.
    'Access-Control-Allow-Origin': '*',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(target).pipe(res);
}

/* ----------------------------------------------------------------- routes */

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      hasServerKey: Boolean(API_KEY),
      models: MODELS,
      defaultModel: DEFAULT_MODEL,
      voices: VOICES,
      defaultVoice: DEFAULT_VOICE,
      liveApiVersion: 'v1beta',
      proxyAvailable: Boolean(API_KEY),
    });
    return true;
  }

  if (pathname === '/api/voices' && req.method === 'GET') {
    sendJson(res, 200, { voices: VOICES });
    return true;
  }

  if (pathname === '/api/token' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await createEphemeralToken({
        apiKey: API_KEY,
        model: body.model || DEFAULT_MODEL,
        lock: LOCK_TOKENS,
      });
      sendJson(res, 200, result);
    } catch (err) {
      const status = err instanceof TokenError ? err.status : 500;
      sendJson(res, status, { error: err.message });
    }
    return true;
  }

  /* ----------------------------------------------------------- proxy hub */

  if (pathname === '/api/proxy/session' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body.id) {
        proxy.close(body.id);
        sendJson(res, 200, { closed: true });
        return true;
      }
      const { id } = await proxy.create({
        model: body.model || DEFAULT_MODEL,
        voice: body.voice || DEFAULT_VOICE,
        systemInstruction: body.systemInstruction || '',
        tools: body.tools || [],
        vad: body.vad || {},
        temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
        affectiveDialog: !!body.affectiveDialog,
        proactiveAudio: !!body.proactiveAudio,
      });
      sendJson(res, 200, { id });
    } catch (err) {
      sendJson(res, err.status || 502, { error: err.message });
    }
    return true;
  }

  if (pathname === '/api/proxy/events' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id || !proxy.attach(id, res)) {
      sendText(res, 404, 'Unknown proxy session');
      return true;
    }
    return true;
  }

  if (pathname === '/api/proxy/input' && req.method === 'POST') {
    const body = await readJsonBody(req);
    proxy.input(body.id, body.audio || []);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/proxy/text' && req.method === 'POST') {
    const body = await readJsonBody(req);
    proxy.text(body.id, body.text || '');
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/proxy/tool' && req.method === 'POST') {
    const body = await readJsonBody(req);
    proxy.tool(body.id, body.responses || []);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === '/api/proxy/end' && req.method === 'POST') {
    const body = await readJsonBody(req);
    proxy.end(body.id);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

/* ----------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { error: 'Unknown endpoint' });
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, url.pathname);
      return;
    }

    sendText(res, 405, 'Method not allowed');
  } catch (err) {
    console.error('[halo] request failed', err);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  const banner = [
    '',
    '  \x1b[38;5;111m✦ Halo\x1b[0m — Siri-style voice assistant on the Gemini Live API',
    '',
    `    web        http://localhost:${PORT}`,
    `    network    http://0.0.0.0:${PORT}`,
    `    api key    ${API_KEY ? '\x1b[32mconfigured\x1b[0m (server-side)' : '\x1b[33mmissing\x1b[0m — add GEMINI_API_KEY to .env'}`,
    `    transport  ${API_KEY ? 'ephemeral token + proxy available' : 'browser-supplied API key only'}`,
    '',
  ].join('\n');
  console.log(banner);
});

function shutdown(signal) {
  console.log(`\n[halo] ${signal} received, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
