import test from 'node:test';
import assert from 'node:assert/strict';

import { VOICES, DEFAULT_VOICE, getVoice, isValidVoice } from '../public/js/voices.js';
import { MODELS, DEFAULT_MODEL } from '../public/js/models.js';

test('the catalog contains the 30 prebuilt Gemini voices', () => {
  assert.equal(VOICES.length, 30);
});

test('voice names are unique and carry metadata', () => {
  const names = new Set();
  for (const voice of VOICES) {
    assert.ok(!names.has(voice.name), `duplicate voice ${voice.name}`);
    names.add(voice.name);
    assert.ok(voice.descriptor.length > 0);
    assert.ok(['female', 'male'].includes(voice.gender));
    assert.ok(Number.isFinite(voice.hue));
  }
});

test('the well known voices are present', () => {
  for (const name of ['Puck', 'Kore', 'Charon', 'Fenrir', 'Aoede', 'Zephyr']) {
    assert.ok(isValidVoice(name), `${name} missing`);
  }
  assert.equal(getVoice('Kore').descriptor, 'Firm');
  assert.equal(getVoice('Nope'), null);
});

test('the default voice exists', () => {
  assert.ok(isValidVoice(DEFAULT_VOICE));
});

test('the default model is a live model', () => {
  assert.ok(MODELS.some((model) => model.id === DEFAULT_MODEL));
  assert.ok(MODELS.every((model) => model.id.includes('live')));
});
