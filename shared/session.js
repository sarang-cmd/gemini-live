/**
 * Session transports.
 *
 * The UI only ever talks to a `SessionAdapter`, so the same code drives
 *   • direct-token : browser → Gemini (ephemeral token, lowest latency)
 *   • direct-key   : browser → Gemini (user supplied API key)
 *   • proxy        : browser → our server (SSE + POST) → Gemini
 * and the demo simulator.
 */

import {
  buildAudioMessage,
  buildTextMessage,
  buildToolResponseMessage,
  buildAudioStreamEndMessage,
  parseServerMessage,
} from './protocol.js';

class Emitter {
  constructor() {
    this.handlers = new Map();
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this.handlers.get(type)?.delete(handler);
  }

  emit(type, payload = {}) {
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[session] handler for "${type}" failed`, err);
      }
    });
  }
}

export class SessionAdapter extends Emitter {
  async start() {
    throw new Error('Not implemented');
  }
  sendAudio() {}
  sendText() {}
  sendToolResponse() {}
  endAudioStream() {}
  async stop() {}
}

/** Browser → Gemini over a WebSocket. */
export class DirectSession extends SessionAdapter {
  constructor({ url, setup }) {
    super();
    this.url = url;
    this.setup = setup;
    this.ws = null;
    this.closed = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify(this.setup));
      };

      ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (err) {
          this.emit('error', { message: 'Received a malformed frame from the Live API.' });
          return;
        }

        for (const parsed of parseServerMessage(message)) {
          this.emit(parsed.type, parsed);
          if (parsed.type === 'setup_complete' && !settled) {
            settled = true;
            resolve();
          }
          if (parsed.type === 'error' && !settled) {
            settled = true;
            reject(new Error(parsed.message));
          }
        }
      };

      ws.onerror = () => {
        const message =
          'Could not reach the Gemini Live API. Check the API key, your network, or try the proxy transport.';
        this.emit('error', { message });
        if (!settled) {
          settled = true;
          reject(new Error(message));
        }
      };

      ws.onclose = (event) => {
        this.closed = true;
        this.emit('closed', { code: event.code, reason: event.reason });
        if (!settled) {
          settled = true;
          reject(new Error(event.reason || 'The Live session closed before it started.'));
        }
      };
    });
  }

  _send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  sendAudio(base64) {
    this._send(buildAudioMessage(base64));
  }

  sendText(text) {
    this._send(buildTextMessage(text));
  }

  sendToolResponse(responses) {
    this._send(buildToolResponseMessage(responses));
  }

  endAudioStream() {
    this._send(buildAudioStreamEndMessage());
  }

  async stop() {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      try {
        this.ws.close(1000, 'client closed');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
  }
}

/**
 * Browser → our server → Gemini.
 *
 * Downstream is Server-Sent Events (one HTTP response, many frames);
 * upstream audio is batched into small POSTs to keep the request rate sane.
 */
export class ProxySession extends SessionAdapter {
  constructor({ sessionId, baseUrl = '' }) {
    super();
    this.sessionId = sessionId;
    this.baseUrl = baseUrl;
    this.source = null;
    this.pending = [];
    this.flushTimer = null;
    this.closed = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/api/proxy/events?id=${encodeURIComponent(this.sessionId)}`;
      const source = new EventSource(url);
      this.source = source;

      source.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === 'session' || message.type === 'setup_complete') {
          if (message.type === 'setup_complete') resolve();
          return;
        }
        if (message.type === 'error') {
          this.emit('error', message);
          reject(new Error(message.message || 'Proxy session failed.'));
          return;
        }
        this.emit(message.type, message);
      };

      source.onerror = () => {
        if (this.closed) return;
        this.emit('error', { message: 'The proxy connection dropped.' });
        reject(new Error('The proxy connection dropped.'));
      };
    });
  }

  async _post(path, body) {
    try {
      await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.emit('error', { message: `Proxy request failed: ${err.message}` });
    }
  }

  sendAudio(base64) {
    this.pending.push(base64);
    if (this.flushTimer) return;
    // Batch ~2 chunks (≈64 ms) per request instead of one request per chunk.
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const audio = this.pending;
      this.pending = [];
      if (audio.length) this._post('/api/proxy/input', { id: this.sessionId, audio });
    }, 40);
  }

  sendText(text) {
    this._post('/api/proxy/text', { id: this.sessionId, text });
  }

  sendToolResponse(responses) {
    this._post('/api/proxy/tool', { id: this.sessionId, responses });
  }

  endAudioStream() {
    this._post('/api/proxy/end', { id: this.sessionId });
  }

  async stop() {
    this.closed = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    await this._post('/api/proxy/session', { id: this.sessionId }).catch(() => {});
  }
}
