import test from 'node:test';
import assert from 'node:assert/strict';

import {
  int16ToBase64,
  base64ToInt16,
  floatToInt16,
  int16ToFloat,
  rmsInt16,
  int16ToWav,
} from '../public/js/pcm.js';

test('base64 round trip preserves the samples', () => {
  const source = new Int16Array([-32768, -1, 0, 1, 12345, 32767]);
  const restored = base64ToInt16(int16ToBase64(source));

  assert.equal(restored.length, source.length);
  for (let i = 0; i < source.length; i += 1) {
    assert.equal(restored[i], source[i]);
  }
});

test('base64 encoding handles large chunks', () => {
  const source = new Int16Array(32_768);
  for (let i = 0; i < source.length; i += 1) source[i] = (i * 7) % 30000 - 15000;

  const encoded = int16ToBase64(source);
  assert.ok(encoded.length > 40_000);
  const restored = base64ToInt16(encoded);
  assert.deepEqual(Array.from(restored), Array.from(source));
});

test('float conversion clips out of range samples', () => {
  assert.equal(floatToInt16(2), 32767);
  assert.equal(floatToInt16(-2), -32767);
  assert.equal(floatToInt16(0), 0);
  assert.equal(int16ToFloat(16384), 0.5);
});

test('rms reports silence and signal', () => {
  assert.equal(rmsInt16(new Int16Array(64)), 0);
  assert.ok(Math.abs(rmsInt16(Int16Array.from({ length: 64 }, () => 16384)) - 0.5) < 0.001);
});

test('wav export writes a valid RIFF header', () => {
  const pcm = new Int16Array([1, 2, 3, 4]);
  const buffer = int16ToWav(pcm, 24000);
  const view = new DataView(buffer);

  assert.equal(buffer.byteLength, 44 + pcm.length * 2);
  assert.equal(String.fromCharCode(...new Uint8Array(buffer, 0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...new Uint8Array(buffer, 8, 4)), 'WAVE');
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint16(34, true), 16);
});
