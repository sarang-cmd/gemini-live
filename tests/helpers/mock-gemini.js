/**
 * A minimal WebSocket server that speaks the Gemini Live wire protocol.
 *
 * Node has a WebSocket *client* built in but no server, so this implements
 * just enough of RFC 6455 to accept a connection, decode client frames and
 * push server frames back. It lets the session and proxy transports be tested
 * end to end without touching the network.
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function parseFrame(buffer) {
  if (buffer.length < 2) return null;

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + length) return null;

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }

  return { opcode, payload, consumed: offset + length };
}

function encodeFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  let header;

  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  header[0] = 0x81; // FIN + text
  return Buffer.concat([header, payload]);
}

export async function startMockGemini({ onSetup } = {}) {
  const sockets = new Set();
  const received = [];
  const server = createServer();

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    const accept = createHash('sha1').update(key + GUID).digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const frame = parseFrame(buffer);
        if (!frame) break;
        buffer = buffer.subarray(frame.consumed);
        if (frame.opcode === 0x8) {
          socket.end();
          break;
        }
        if (frame.opcode !== 0x1) continue;

        let message;
        try {
          message = JSON.parse(frame.payload.toString('utf8'));
        } catch {
          continue;
        }
        received.push(message);

        if (message.setup) {
          // Mirror the real API: acknowledge the setup.
          socket.write(encodeFrame(JSON.stringify({ setupComplete: {} })));
          onSetup?.(message, socket);
        }
      }
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `ws://127.0.0.1:${port}/ws`,
    received,
    /** Push a server frame to every connected client. */
    send(message) {
      const payload = encodeFrame(JSON.stringify(message));
      for (const socket of sockets) socket.write(payload);
    },
    /** Wait until at least `count` frames have arrived. */
    async waitFor(count, timeout = 2000) {
      const deadline = Date.now() + timeout;
      while (received.length < count) {
        if (Date.now() > deadline) {
          throw new Error(`timed out waiting for ${count} frames (got ${received.length})`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return received;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      await new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    },
  };
}

/** A stand-in for an HTTP response, good enough for the SSE writer. */
export function fakeResponse() {
  const chunks = [];
  return {
    chunks,
    headers: {},
    writeHead(status, headers) {
      this.headers = { status, ...headers };
    },
    write(chunk) {
      chunks.push(String(chunk));
      return true;
    },
    end() {
      this.ended = true;
    },
    on() {},
    /** Every SSE data payload seen so far, parsed. */
    events() {
      return chunks
        .join('')
        .split('\n\n')
        .filter((block) => block.startsWith('data: '))
        .map((block) => JSON.parse(block.slice(6)));
    },
  };
}
