/**
 * Demo simulator.
 *
 * Implements the same `SessionAdapter` interface as the real transports, so the
 * whole UI (orb, transcript, state machine, playback pipeline) can be exercised
 * without an API key. The "voice" is a synthetic mumble that drives the same
 * playback path the Live API uses.
 */
import { SessionAdapter } from './session.js';
import { int16ToBase64 } from './pcm.js';

const SAMPLE_RATE = 24000;

const USER_LINES = [
  'Tell me something fascinating about the ocean.',
  'What can you do?',
  'Give me a quick fun fact.',
  'How does a voice assistant actually work?',
  'What should I try this weekend?',
];

const REPLY_LINES = [
  'Sure. The ocean covers about seventy one percent of Earth, and its deepest spot is nearly eleven kilometres below sea level.',
  'I can talk with you in real time, look things up, tell the time, and switch between thirty different voices.',
  'Here is one: a group of flamingos gets their colour from the food they eat. That is all.',
  'Voice assistants stream your speech, detect when you stop talking, and answer with generated audio in a couple of hundred milliseconds.',
  'Try a hike, a museum, or simply a long coffee somewhere with a view. I vote for the coffee.',
];

/** A soft, speech-like mumble. Loud enough to move the orb, quiet enough to be pleasant. */
function synthesizeUtterance(text, seconds) {
  const total = Math.floor(SAMPLE_RATE * seconds);
  const out = new Int16Array(total);
  const words = Math.max(3, text.split(/\s+/).length);
  const syllableRate = (words * 1.7) / seconds;

  for (let i = 0; i < total; i += 1) {
    const time = i / SAMPLE_RATE;
    const envelope = Math.max(0, Math.sin(Math.PI * 2 * syllableRate * time)) ** 1.7;
    const pitch = 118 + 16 * Math.sin(Math.PI * 2 * 0.6 * time) + 6 * Math.sin(Math.PI * 2 * 2.3 * time);

    let sample = 0;
    sample += Math.sin(Math.PI * 2 * pitch * time) * 0.34;
    sample += Math.sin(Math.PI * 2 * pitch * 2 * time) * 0.16;
    sample += Math.sin(Math.PI * 2 * pitch * 3 * time) * 0.07;
    sample += (Math.random() * 2 - 1) * 0.04;

    out[i] = Math.round(sample * envelope * 9000);
  }

  return out;
}

export class DemoSession extends SessionAdapter {
  constructor({ onNotice } = {}) {
    super();
    this.onNotice = onNotice || (() => {});
    this.timers = new Set();
    this.stopped = false;
    this.turn = 0;
  }

  _later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.stopped) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  async start() {
    await new Promise((resolve) => this._later(resolve, 350));
    this.emit('setup_complete', {});
    this.emit('notice', { message: 'Demo mode — no API key connected.' });
  }

  /** The app calls this when the user "speaks" in demo mode. */
  simulateUserTurn() {
    if (this.stopped) return;

    const line = USER_LINES[this.turn % USER_LINES.length];
    const reply = REPLY_LINES[this.turn % REPLY_LINES.length];
    this.turn += 1;

    this._later(() => {
      this.emit('input_transcript', { text: line, finished: true });
    }, 850);

    this._later(() => {
      this.emit('output_transcript', { text: reply, finished: true });
      this._speak(reply);
    }, 1700);
  }

  _speak(text) {
    const seconds = Math.max(2.4, text.split(/\s+/).length * 0.42);
    const pcm = synthesizeUtterance(text, seconds);
    const chunkSize = 1024;

    for (let offset = 0; offset < pcm.length; offset += chunkSize) {
      const slice = pcm.subarray(offset, Math.min(offset + chunkSize, pcm.length));
      const copy = new Int16Array(slice);
      this._later(() => {
        this.emit('audio', { data: int16ToBase64(copy), mimeType: 'audio/pcm;rate=24000' });
      }, (offset / chunkSize) * 43);
    }

    this._later(() => this.emit('turn_complete', {}), seconds * 1000 + 250);
  }

  sendAudio() {}
  sendText(text) {
    if (!text) return;
    this.emit('input_transcript', { text, finished: true });
    this._later(() => {
      const reply = 'This is the demo voice talking. Connect a Gemini API key and I will answer with a real voice.';
      this.emit('output_transcript', { text: reply, finished: true });
      this._speak(reply);
    }, 500);
  }
  sendToolResponse() {}
  endAudioStream() {}

  async stop() {
    this.stopped = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }
}
