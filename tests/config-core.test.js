import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULTS,
  mergeConfig,
  publicConfig,
  isProvider,
} from '../electron/config-core.ts';

test('the defaults describe a working setup', () => {
  assert.equal(DEFAULTS.provider, 'gemini');
  assert.equal(DEFAULTS.geminiModel, 'gemini-3.8-live');
  assert.equal(DEFAULTS.groqSpeechModel, 'canopylabs/orpheus-v1-english');
  assert.equal(DEFAULTS.groqTranscribeModel, 'whisper-large-v3-turbo');
  assert.equal(DEFAULTS.groqVoice, 'autumn');
});

test('the retired PlayAI models never come back', () => {
  const serialised = JSON.stringify(DEFAULTS);
  assert.ok(!serialised.includes('playai'), 'the PlayAI models were decommissioned');
  assert.ok(!serialised.includes('PlayAI'), 'the PlayAI voices were decommissioned');
});

test('a patch only overrides the fields it carries', () => {
  const next = mergeConfig(DEFAULTS, { provider: 'groq', groqVoice: 'troy' });
  assert.equal(next.provider, 'groq');
  assert.equal(next.groqVoice, 'troy');
  assert.equal(next.geminiModel, DEFAULTS.geminiModel);
  assert.equal(next.systemPrompt, DEFAULTS.systemPrompt);
});

test('keys are trimmed and unknown providers are ignored', () => {
  const next = mergeConfig(DEFAULTS, {
    groqKey: '  gsk_test  ',
    provider: 'openai',
  });
  assert.equal(next.groqKey, 'gsk_test');
  assert.equal(next.provider, 'gemini');
  assert.equal(isProvider('groq'), true);
  assert.equal(isProvider('openai'), false);
});

test('the renderer never sees a raw key', () => {
  const view = publicConfig({ ...DEFAULTS, geminiKey: 'secret', groqKey: 'gsk_secret' });
  assert.equal(view.hasGeminiKey, true);
  assert.equal(view.hasGroqKey, true);
  assert.equal(JSON.stringify(view).includes('secret'), false);
  assert.equal(JSON.stringify(view).includes('gsk_'), false);
});
