/**
 * Headless tests for the AudioWorklet processors.
 *
 * The worklet files are loaded with a stubbed `AudioWorkletProcessor`,
 * `registerProcessor` and `sampleRate`, then fed synthetic audio so the
 * resampling maths can be verified without a browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadWorklet(file, sampleRate) {
  const code = readFileSync(path.join(ROOT, 'shared/worklets', file), 'utf8');
  const registry = {};

  class BaseProcessor {
    constructor() {
      this.messages = [];
      this.port = {
        postMessage: (message) => this.messages.push(message),
        onmessage: null,
      };
    }
  }

  const factory = new Function(
    'AudioWorkletProcessor',
    'registerProcessor',
    'sampleRate',
    'currentTime',
    `${code}\nreturn null;`,
  );
  factory(BaseProcessor, (name, klass) => {
    registry[name] = klass;
  }, sampleRate, 0);

  return registry;
}

test('capture worklet resamples 48 kHz down to 16 kHz', () => {
  const registry = loadWorklet('pcm-capture.js', 48000);
  const Capture = registry['pcm-capture'];
  assert.ok(Capture, 'pcm-capture was not registered');

  const processor = new Capture({ processorOptions: { targetRate: 16000 } });

  // 100 blocks of 128 frames at 48 kHz == 12800 input samples.
  const block = new Float32Array(128).fill(1);
  let inputSamples = 0;
  for (let i = 0; i < 100; i += 1) {
    processor.process([[block]], [[new Float32Array(128)]]);
    inputSamples += block.length;
  }

  const chunks = processor.messages.filter((message) => message.type === 'audio');
  assert.ok(chunks.length >= 1, 'no audio was produced');

  const produced = chunks.reduce((total, chunk) => total + chunk.pcm.length, 0);
  const expected = inputSamples / 3; // 48000 / 16000
  assert.ok(
    Math.abs(produced - expected) <= 2,
    `expected ~${expected} samples, got ${produced}`,
  );

  // A full-scale DC signal must survive the resampling.
  const first = chunks[0].pcm[0];
  assert.equal(first, 32767);
  assert.ok(chunks[0].level > 0.9, `unexpected level ${chunks[0].level}`);
});

test('capture worklet keeps the 16 kHz rate untouched at 16 kHz', () => {
  const registry = loadWorklet('pcm-capture.js', 16000);
  const processor = new registry['pcm-capture']({
    processorOptions: { targetRate: 16000 },
  });

  const block = new Float32Array(128).fill(0.5);
  for (let i = 0; i < 8; i += 1) {
    processor.process([[block]], [[new Float32Array(128)]]);
  }

  const chunks = processor.messages.filter((message) => message.type === 'audio');
  const produced = chunks.reduce((total, chunk) => total + chunk.pcm.length, 0);
  // A resampler needs one sample of look-ahead, so the very last input sample
  // is still waiting when the stream ends.
  assert.equal(produced, 8 * 128 - 1);
  assert.equal(chunks[0].pcm[0], Math.round(0.5 * 32767));
});

test('player worklet renders queued 24 kHz PCM at the context rate', () => {
  const registry = loadWorklet('pcm-player.js', 24000);
  const Player = registry['pcm-player'];
  assert.ok(Player, 'pcm-player was not registered');

  const processor = new Player({ processorOptions: { sourceRate: 24000 } });

  const pcm = new Int16Array(1200).fill(16384); // 0.5
  processor.onmessage({ data: { type: 'pcm', buffer: pcm.buffer } });

  const output = new Float32Array(128);
  processor.process([[]], [[output]]);

  assert.ok(Math.abs(output[0] - 0.5) < 0.01, `unexpected first sample ${output[0]}`);
  assert.ok(Math.abs(output[127] - 0.5) < 0.01, `unexpected last sample ${output[127]}`);

  // Levels are reported every 8 render quanta.
  for (let i = 0; i < 7; i += 1) {
    processor.process([[]], [[new Float32Array(128)]]);
  }
  const levelMessages = processor.messages.filter((message) => message.type === 'level');
  assert.ok(levelMessages.length >= 1);
  assert.ok(levelMessages[0].level > 0.4, `unexpected level ${levelMessages[0].level}`);
});

test('player worklet flush drops queued audio (barge-in)', () => {
  const registry = loadWorklet('pcm-player.js', 24000);
  const processor = new registry['pcm-player']({ processorOptions: { sourceRate: 24000 } });

  const pcm = new Int16Array(240).fill(16384);
  processor.onmessage({ data: { type: 'pcm', buffer: pcm.buffer } });
  processor.onmessage({ data: { type: 'flush' } });

  const output = new Float32Array(128);
  processor.process([[]], [[output]]);

  assert.equal(output[0], 0, 'flushed audio should not be played');
});

test('player worklet resamples when the context runs faster than 24 kHz', () => {
  const registry = loadWorklet('pcm-player.js', 48000);
  const processor = new registry['pcm-player']({ processorOptions: { sourceRate: 24000 } });

  const pcm = new Int16Array(600).fill(16384);
  processor.onmessage({ data: { type: 'pcm', buffer: pcm.buffer } });

  const output = new Float32Array(256);
  processor.process([[]], [[output]]);

  // 256 output frames at 48 kHz consume 512 source samples — all available.
  assert.ok(Math.abs(output[0] - 0.5) < 0.01);
  assert.ok(Math.abs(output[255] - 0.5) < 0.01);
});

test('player worklet stays silent until audio arrives', () => {
  const registry = loadWorklet('pcm-player.js', 24000);
  const processor = new registry['pcm-player']({ processorOptions: { sourceRate: 24000 } });

  const output = new Float32Array(128);
  processor.process([[]], [[output]]);
  assert.equal(output[0], 0);
  assert.equal(output[127], 0);
});
