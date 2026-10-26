/**
 * Proxy transport.
 *
 * Some networks cannot open a WebSocket straight from the browser to Google.
 * This relay keeps the API key on the server and pipes the session through:
 *
 *   browser  --SSE-->  server  --WebSocket-->  Gemini Live API
 *   browser  --POST-->  server
 *
 * Downstream uses Server-Sent Events (one long-lived HTTP response, many
 * frames); upstream audio is batched into POSTs by the client.
 */
import {
  liveSocketUrl,
  buildSetupMessage,
  buildAudioMessage,
  buildTextMessage,
  buildToolResponseMessage,
  buildAudioStreamEndMessage,
  parseServerMessage,
} from '../shared/protocol.js';

const SESSION_TTL_MS = 5 * 60_000;

export function createProxyHub({ getApiKey, resolveUrl = liveSocketUrl }) {
  const sessions = new Map();
  let counter = 0;

  function emit(session, event) {
    if (session.clients.size === 0) {
      session.buffer.push(event);
      if (session.buffer.length > 400) session.buffer.shift();
      return;
    }
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of session.clients) {
      try {
        client.write(payload);
      } catch {
        /* client vanished — the close handler will clean up */
      }
    }
  }

  function destroy(session) {
    if (!session || session.destroyed) return;
    session.destroyed = true;
    clearTimeout(session.timer);
    try {
      if (session.ws && session.ws.readyState <= 1) session.ws.close(1000, 'server closed');
    } catch {
      /* ignore */
    }
    for (const client of session.clients) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
    }
    session.clients.clear();
    sessions.delete(session.id);
  }

  /** Open a Gemini session and resolve once the Live API confirms the setup. */
  function create({ model, voice, systemInstruction, tools, vad, temperature, affectiveDialog, proactiveAudio }) {
    const apiKey = getApiKey();
    if (!apiKey) {
      const error = new Error(
        'No GEMINI_API_KEY on the server — the proxy transport needs one.',
      );
      error.status = 503;
      throw error;
    }

    const id = `s${(counter += 1).toString(36)}_${Date.now().toString(36)}`;
    const session = {
      id,
      clients: new Set(),
      buffer: [],
      ws: null,
      destroyed: false,
      timer: setTimeout(() => destroy(session), SESSION_TTL_MS),
    };
    sessions.set(id, session);

    const setup = buildSetupMessage({
      model,
      voice,
      systemInstruction,
      tools,
      vad,
      temperature,
      affectiveDialog,
      proactiveAudio,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(resolveUrl({ apiKey, model }));
      } catch (err) {
        destroy(session);
        reject(err);
        return;
      }
      session.ws = ws;

      const fail = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(session.timer);
        destroy(session);
        reject(new Error(message));
      };

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify(setup));
        } catch (err) {
          fail(err.message);
        }
      };

      ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        for (const parsed of parseServerMessage(message)) {
          emit(session, parsed);
          if (parsed.type === 'setup_complete' && !settled) {
            settled = true;
            resolve({ id, session });
          }
          if (parsed.type === 'error' && !settled) {
            fail(parsed.message);
          }
        }
      };

      ws.onerror = () => {
        fail('The proxy could not reach the Gemini Live API.');
      };

      ws.onclose = (event) => {
        session.closed = true;
        emit(session, { type: 'closed', reason: event.reason || 'session closed' });
        if (!settled) fail(event.reason || 'The Live session closed before it started.');
        clearTimeout(session.timer);
      };
    });
  }

  /** Attach an HTTP response as an SSE stream for this session. */
  function attach(id, res) {
    const session = sessions.get(id);
    if (!session) return false;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    if (session.buffer.length) {
      const payload = session.buffer
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join('');
      session.buffer = [];
      res.write(payload);
    }

    session.clients.add(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* ignore */
      }
    }, 20_000);

    res.on('close', () => {
      clearInterval(heartbeat);
      session.clients.delete(res);
      if (session.clients.size === 0 && session.closed) destroy(session);
    });

    return true;
  }

  function send(id, payload) {
    const session = sessions.get(id);
    if (!session || !session.ws || session.ws.readyState !== 1) return false;
    try {
      session.ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  return {
    create,
    attach,
    /** @param {string[]} audio base64 encoded 16 kHz PCM chunks */
    input(id, audio) {
      const list = Array.isArray(audio) ? audio : [audio];
      let ok = true;
      for (const chunk of list) {
        if (!chunk) continue;
        ok = send(id, buildAudioMessage(chunk)) && ok;
      }
      return ok;
    },
    text(id, text) {
      return send(id, buildTextMessage(text));
    },
    tool(id, responses) {
      return send(id, buildToolResponseMessage(responses || []));
    },
    end(id) {
      return send(id, buildAudioStreamEndMessage());
    },
    close(id) {
      const session = sessions.get(id);
      if (!session) return false;
      clearTimeout(session.timer);
      destroy(session);
      return true;
    },
    get size() {
      return sessions.size;
    },
  };
}
