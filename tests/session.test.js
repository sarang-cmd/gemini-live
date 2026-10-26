/**
 * End-to-end tests for the session transports against a mock Gemini server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { startMockGemini, fakeResponse } from './helpers/mock-gemini.js';
import { DirectSession, ProxySession } from '../public/js/session.js';
import { createProxyHub } from '../server/proxy.js';
import { buildSetupMessage } from '../public/js/protocol.js';

const setup = buildSetupMessage({
  model: 'gemini-3.8-live',
  voice: 'Kore',
  systemInstruction: 'Be brief.',
});

test('DirectSession completes the handshake and sends the setup frame', async () => {
  const mock = await startMockGemini();
  try {
    const session = new DirectSession({ url: mock.url, setup });
    await session.start();

    const [first] = mock.received;
    assert.ok(first.setup, 'the first frame must be the setup frame');
    assert.equal(first.setup.model, 'models/gemini-3.8-live');
    assert.equal(
      first.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
      'Kore',
    );
    assert.deepEqual(first.setup.generationConfig.responseModalities, ['AUDIO']);

    await session.stop();
  } finally {
    await mock.close();
  }
});

test('DirectSession streams audio, transcripts and interruptions', async () => {
  const mock = await startMockGemini();
  try {
    const session = new DirectSession({ url: mock.url, setup });

    const seen = [];
    session.on('audio', (event) => seen.push(['audio', event]));
    session.on('input_transcript', (event) => seen.push(['input', event]));
    session.on('output_transcript', (event) => seen.push(['output', event]));
    session.on('interrupted', () => seen.push(['interrupted']));
    session.on('tool_call', (event) => seen.push(['tool', event]));

    await session.start();

    session.sendAudio('QUJD');
    await mock.waitFor(2);

    const audioFrame = mock.received[1];
    assert.equal(audioFrame.realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
    assert.equal(audioFrame.realtimeInput.audio.data, 'QUJD');

    mock.send({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'REVG' } }] },
        inputTranscription: { text: 'hello' },
        outputTranscription: { text: 'hi', finished: true },
        interrupted: true,
      },
    });
    mock.send({
      toolCall: { functionCalls: [{ id: 'c1', name: 'get_current_datetime', args: {} }] },
    });

    await new Promise((resolve) => setTimeout(resolve, 120));

    const types = seen.map(([type]) => type);
    assert.ok(types.includes('audio'));
    assert.ok(types.includes('input'));
    assert.ok(types.includes('output'));
    assert.ok(types.includes('interrupted'));
    assert.ok(types.includes('tool'));

    assert.equal(seen.find(([type]) => type === 'audio')[1].data, 'REVG');
    assert.equal(seen.find(([type]) => type === 'input')[1].text, 'hello');
    assert.equal(seen.find(([type]) => type === 'tool')[1].calls[0].name, 'get_current_datetime');

    await session.stop();
  } finally {
    await mock.close();
  }
});

test('DirectSession rejects when the connection cannot be established', async () => {
  const session = new DirectSession({ url: 'ws://127.0.0.1:1/ws', setup });
  await assert.rejects(() => session.start(), /Could not reach the Gemini Live API/);
});

test('the proxy hub relays a whole session', async () => {
  const mock = await startMockGemini();
  try {
    const hub = createProxyHub({
      getApiKey: () => 'test-key',
      resolveUrl: () => mock.url,
    });

    const { id } = await hub.create({
      model: 'gemini-3.8-live',
      voice: 'Puck',
      systemInstruction: 'Be brief.',
    });

    const response = fakeResponse();
    assert.equal(hub.attach(id, response), true);

    // The setup frame reached the upstream server.
    await mock.waitFor(1);
    assert.equal(mock.received[0].setup.model, 'models/gemini-3.8-live');

    // Audio flows upstream.
    hub.input(id, ['QUJD', 'REVG']);
    await mock.waitFor(3);
    assert.equal(mock.received[1].realtimeInput.audio.data, 'QUJD');
    assert.equal(mock.received[2].realtimeInput.audio.data, 'REVG');

    // Text flows upstream.
    hub.text(id, 'hello there');
    await mock.waitFor(4);
    assert.equal(mock.received[3].realtimeInput.text, 'hello there');

    // Tool responses flow upstream.
    hub.tool(id, [{ id: 'c1', name: 'get_current_datetime', result: { ok: true } }]);
    await mock.waitFor(5);
    assert.equal(mock.received[4].toolResponse.functionResponses[0].name, 'get_current_datetime');

    // Audio flows downstream to the browser.
    mock.send({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'SEVM' } }] },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    const events = response.events();
    const audio = events.find((event) => event.type === 'audio');
    assert.ok(audio, 'no audio event reached the browser');
    assert.equal(audio.data, 'SEVM');

    hub.close(id);
  } finally {
    await mock.close();
  }
});

test('the proxy hub buffers events that arrive before the browser attaches', async () => {
  const mock = await startMockGemini();
  try {
    const hub = createProxyHub({ getApiKey: () => 'test-key', resolveUrl: () => mock.url });
    const { id } = await hub.create({ model: 'gemini-3.8-live', voice: 'Puck' });

    mock.send({ serverContent: { turnComplete: true } });
    await new Promise((resolve) => setTimeout(resolve, 60));

    const response = fakeResponse();
    hub.attach(id, response);

    const events = response.events();
    assert.ok(
      events.some((event) => event.type === 'turn_complete'),
      'the buffered turn_complete should be replayed',
    );

    hub.close(id);
  } finally {
    await mock.close();
  }
});

test('ProxySession posts audio upstream in batches', async () => {
  const mock = await startMockGemini();
  try {
    const hub = createProxyHub({ getApiKey: () => 'test-key', resolveUrl: () => mock.url });
    const { id } = await hub.create({ model: 'gemini-3.8-live', voice: 'Puck' });

    const posted = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      posted.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({}) };
    };

    try {
      const session = new ProxySession({ sessionId: id, baseUrl: '' });
      session.sendAudio('QUJD');
      session.sendAudio('REVG');
      await new Promise((resolve) => setTimeout(resolve, 90));
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(posted.length, 1, 'audio should be batched into one request');
    assert.equal(posted[0].url, '/api/proxy/input');
    assert.deepEqual(posted[0].body.audio, ['QUJD', 'REVG']);

    hub.close(id);
  } finally {
    await mock.close();
  }
});
