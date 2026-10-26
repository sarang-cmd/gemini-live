import test from 'node:test';
import assert from 'node:assert/strict';

import {
  liveSocketUrl,
  buildSetupMessage,
  buildAudioMessage,
  buildTextMessage,
  buildToolResponseMessage,
  buildAudioStreamEndMessage,
  parseServerMessage,
  functionDeclaration,
  AUDIO_IN_MIME,
} from '../shared/protocol.js';

test('liveSocketUrl uses the constrained service for ephemeral tokens', () => {
  const url = liveSocketUrl({ token: 'abc/def+ghi' });
  assert.match(url, /^wss:\/\/generativelanguage\.googleapis\.com\/ws\//);
  assert.match(url, /v1beta\.GenerativeService\.BidiGenerateContentConstrained/);
  assert.match(url, /access_token=abc%2Fdef%2Bghi/);
});

test('liveSocketUrl uses the plain service for API keys', () => {
  const url = liveSocketUrl({ apiKey: 'AIza123' });
  assert.match(url, /BidiGenerateContent\?key=AIza123/);
  assert.doesNotMatch(url, /Constrained/);
});

test('liveSocketUrl refuses to build without credentials', () => {
  assert.throws(() => liveSocketUrl({}), /token or an API key/i);
});

test('buildSetupMessage produces a valid setup frame', () => {
  const { setup } = buildSetupMessage({
    model: 'gemini-3.8-live',
    voice: 'Kore',
    systemInstruction: 'Be brief.',
    tools: [{ functionDeclarations: [functionDeclaration({ name: 'ping' })] }],
    vad: { silenceDurationMs: 700, prefixPaddingMs: 200 },
  });

  assert.equal(setup.model, 'models/gemini-3.8-live');
  assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(
    setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
    'Kore',
  );
  assert.equal(setup.systemInstruction.parts[0].text, 'Be brief.');
  assert.equal(setup.tools[0].functionDeclarations[0].name, 'ping');
  assert.equal(setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs, 700);
  assert.equal(setup.realtimeInputConfig.automaticActivityDetection.prefixPaddingMs, 200);
  assert.deepEqual(setup.inputAudioTranscription, {});
  assert.deepEqual(setup.outputAudioTranscription, {});
});

test('buildSetupMessage keeps models/ prefixes intact', () => {
  const { setup } = buildSetupMessage({ model: 'models/gemini-3.1-flash-live-preview' });
  assert.equal(setup.model, 'models/gemini-3.1-flash-live-preview');
});

test('buildSetupMessage requires a model', () => {
  assert.throws(() => buildSetupMessage({}), /model is required/i);
});

test('audio and text frames use the documented shape', () => {
  assert.deepEqual(buildAudioMessage('AAA='), {
    realtimeInput: { audio: { mimeType: AUDIO_IN_MIME, data: 'AAA=' } },
  });
  assert.deepEqual(buildTextMessage('hello'), { realtimeInput: { text: 'hello' } });
  assert.deepEqual(buildAudioStreamEndMessage(), {
    realtimeInput: { audioStreamEnd: true },
  });
});

test('tool responses carry the function id, name and result', () => {
  const message = buildToolResponseMessage([
    { id: 'call-1', name: 'get_current_datetime', result: { ok: true, time: '12:00' } },
  ]);
  assert.equal(message.toolResponse.functionResponses[0].id, 'call-1');
  assert.equal(message.toolResponse.functionResponses[0].name, 'get_current_datetime');
  assert.deepEqual(message.toolResponse.functionResponses[0].response.result, {
    ok: true,
    time: '12:00',
  });
});

test('parseServerMessage extracts audio, transcriptions and interruptions', () => {
  const events = parseServerMessage({
    serverContent: {
      modelTurn: {
        parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'QUJD' } }],
      },
      inputTranscription: { text: 'hello there' },
      outputTranscription: { text: 'hi', finished: true },
      interrupted: true,
      turnComplete: true,
    },
  });

  const types = events.map((event) => event.type);
  assert.ok(types.includes('audio'));
  assert.ok(types.includes('input_transcript'));
  assert.ok(types.includes('output_transcript'));
  assert.ok(types.includes('interrupted'));
  assert.ok(types.includes('turn_complete'));

  const audio = events.find((event) => event.type === 'audio');
  assert.equal(audio.data, 'QUJD');
  assert.equal(audio.mimeType, 'audio/pcm;rate=24000');
});

test('parseServerMessage handles setup, tools, usage and errors', () => {
  const events = parseServerMessage({
    setupComplete: {},
    toolCall: { functionCalls: [{ id: 'c1', name: 'get_current_datetime', args: {} }] },
    usageMetadata: { totalTokenCount: 42 },
    error: { message: 'boom' },
  });

  const types = events.map((event) => event.type);
  assert.deepEqual(types, ['setup_complete', 'tool_call', 'usage', 'error']);
  assert.equal(events.find((e) => e.type === 'error').message, 'boom');
  assert.equal(events.find((e) => e.type === 'usage').usage.totalTokenCount, 42);
});

test('parseServerMessage ignores empty frames', () => {
  assert.deepEqual(parseServerMessage({}), []);
  assert.deepEqual(parseServerMessage(null), []);
});
