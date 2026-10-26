import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { chat, speak, transcribe, GroqError } from '../electron/providers/groq.ts';

/**
 * A stand-in for the Groq API.
 *
 * The sandbox cannot reach api.groq.com, so the provider is pointed at this
 * little server instead — the request shape, the SSE framing and the error
 * handling are all exercised for real.
 */
function startMockGroq() {
  const state = { requests: [] };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      state.requests.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body,
      });

      if (req.url.startsWith('/unauthorized')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
        return;
      }

      // The routes may be prefixed with `/unauthorized` to exercise the
      // failure path.
      const route = req.url.replace(/^\/+/, '').replace(/^unauthorized\/?/, '');

      if (route === 'audio/transcriptions') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ text: '  What is the weather like?  ' }));
        return;
      }

      if (route === 'chat/completions') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        });
        res.write('data: {"choices":[{"delta":{"content":"It is "}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":"sunny."}}]}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      if (route === 'audio/speech') {
        res.writeHead(200, { 'Content-Type': 'audio/wav' });
        res.end(Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03]));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Unknown route' } }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        state,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(done);
          }),
      });
    });
  });
}

test('the transcription request posts multipart audio and returns the text', async () => {
  const mock = await startMockGroq();
  try {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    const text = await transcribe('gsk_test', wav, {
      model: 'whisper-large-v3-turbo',
      baseUrl: mock.baseUrl,
    });

    assert.equal(text, 'What is the weather like?');

    const request = mock.state.requests.at(-1);
    assert.equal(request.url, '/audio/transcriptions');
    assert.equal(request.method, 'POST');
    assert.match(request.headers['content-type'], /multipart\/form-data/);
    assert.match(request.headers.authorization, /^Bearer gsk_test$/);

    const body = request.body.toString('latin1');
    assert.match(body, /name="file"/);
    assert.match(body, /name="model"/);
    assert.match(body, /whisper-large-v3-turbo/);
  } finally {
    await mock.close();
  }
});

test('the chat request streams and reports every delta', async () => {
  const mock = await startMockGroq();
  try {
    const deltas = [];
    const answer = await chat(
      'gsk_test',
      [
        { role: 'system', content: 'You are Halo.' },
        { role: 'user', content: 'What is the weather like?' },
      ],
      {
        model: 'openai/gpt-oss-120b',
        baseUrl: mock.baseUrl,
        onDelta: (delta, full) => deltas.push([delta, full]),
      },
    );

    assert.equal(answer, 'It is sunny.');
    assert.deepEqual(deltas, [
      ['It is ', 'It is '],
      ['sunny.', 'It is sunny.'],
    ]);

    const request = mock.state.requests.at(-1);
    const payload = JSON.parse(request.body.toString('utf8'));
    assert.equal(payload.model, 'openai/gpt-oss-120b');
    assert.equal(payload.stream, true);
    assert.equal(payload.messages.length, 2);
  } finally {
    await mock.close();
  }
});

test('the speech request asks Orpheus for a wav and returns the bytes', async () => {
  const mock = await startMockGroq();
  try {
    const audio = await speak('gsk_test', 'Hello there', {
      model: 'canopylabs/orpheus-v1-english',
      voice: 'autumn',
      format: 'wav',
      baseUrl: mock.baseUrl,
    });

    assert.ok(audio instanceof Uint8Array);
    assert.deepEqual([...audio], [0x52, 0x49, 0x46, 0x46, 0x00, 0x01, 0x02, 0x03]);

    const request = mock.state.requests.at(-1);
    const payload = JSON.parse(request.body.toString('utf8'));
    assert.equal(payload.model, 'canopylabs/orpheus-v1-english');
    assert.equal(payload.voice, 'autumn');
    assert.equal(payload.input, 'Hello there');
    assert.equal(payload.response_format, 'wav');
  } finally {
    await mock.close();
  }
});

test('a rejected request surfaces the API message', async () => {
  const mock = await startMockGroq();
  try {
    await assert.rejects(
      () => chat('gsk_bad', [{ role: 'user', content: 'hi' }], {
        baseUrl: `${mock.baseUrl}/unauthorized`,
      }),
      (err) => {
        assert.ok(err instanceof GroqError);
        assert.equal(err.message, 'Invalid API key');
        return true;
      },
    );
  } finally {
    await mock.close();
  }
});

test('a missing API key fails before anything leaves the machine', async () => {
  await assert.rejects(
    () => chat('', [{ role: 'user', content: 'hi' }], { baseUrl: 'http://127.0.0.1:1/' }),
    (err) => {
      assert.ok(err instanceof GroqError);
      assert.match(err.message, /No Groq API key/);
      return true;
    },
  );
});

test('an unreachable API reports the network problem instead of hanging', async () => {
  await assert.rejects(
    () => speak('gsk_test', 'hello', { baseUrl: 'http://127.0.0.1:1/' }),
    (err) => {
      assert.ok(err instanceof GroqError);
      assert.match(err.message, /Could not reach Groq/);
      return true;
    },
  );
});
