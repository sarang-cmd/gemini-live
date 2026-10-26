/**
 * The assistant pipeline.
 *
 * One question goes in, one spoken answer comes out:
 *
 *   gemini → the Live API answers in its own voice (native audio)
 *   groq    → Whisper for the voice, a chat model for the brain, Orpheus for
 *             the mouth
 *   demo    → no keys required, a canned answer keeps the UI alive
 */
import { int16ToBase64 } from '../../shared/pcm.js';

import { bridge, type PublicConfig } from '../types/halo';
import { playPcm, playWav } from './audio';
import { LiveClient } from './live';

export interface AskOptions {
  question: string;
  config: PublicConfig;
  /** The Gemini prebuilt voice to speak with. */
  voice: string;
  /** Speak the answer out loud. */
  speak: boolean;
  /** Identifier used to correlate the streamed Groq answer. */
  id?: string;
}

/** Merge a streamed transcript frame into the text we already have. */
export function mergeText(existing: string, incoming: string): string {
  if (!existing) return incoming;
  if (!incoming) return existing;
  // The API streams incrementally, but guard against cumulative frames too.
  if (incoming.startsWith(existing)) return incoming;
  return existing + incoming;
}

const DEMO_ANSWERS = [
  'I am running in demo mode — add a Gemini or Groq API key in Settings and I will answer for real.',
  'Demo mode again. Point me at a key and this orb becomes the real thing.',
  'Right now I am simulating. Open Settings, paste a Gemini or Groq key, and ask me anything.',
];

/** Ask a question and return the answer text. */
export async function ask(options: AskOptions): Promise<string> {
  const { question, config } = options;

  switch (config.provider) {
    case 'gemini':
      return askGemini(options);
    case 'groq':
      return askGroq(options);
    default:
      return askDemo(options);
  }
}

/* ------------------------------------------------------------------ demo */

async function askDemo(options: AskOptions): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const answer = DEMO_ANSWERS[Math.floor(Math.random() * DEMO_ANSWERS.length)];
  if (options.speak && bridge()) {
    void speakWithGroq(options, answer).catch(() => undefined);
  }
  return answer;
}

/* ------------------------------------------------------------------ groq */

async function askGroq(options: AskOptions): Promise<string> {
  const api = bridge();
  if (!api) {
    throw new Error('The Groq provider only runs inside the Halo desktop app.');
  }

  const answer = await api.groq.chat([{ role: 'user', content: options.question }], {
    id: options.id,
  });

  if (!answer) throw new Error('Groq returned an empty answer.');

  if (options.speak) {
    await speakWithGroq(options, answer);
  }

  return answer;
}

/** Synthesise a line with Groq Orpheus and play it. */
export async function speakWithGroq(options: AskOptions, text: string): Promise<void> {
  const api = bridge();
  if (!api) return;
  const bytes = await api.groq.speak(text, {
    voice: options.config.groqVoice,
    model: options.config.groqSpeechModel,
    format: 'wav',
  });
  await playWav(bytes);
}

/* ---------------------------------------------------------------- gemini */

async function askGemini(options: AskOptions): Promise<string> {
  const api = bridge();
  if (!api) {
    throw new Error('The Gemini provider only runs inside the Halo desktop app.');
  }

  const { token } = await api.gemini.token(options.config.geminiModel);

  const client = new LiveClient({
    token,
    model: options.config.geminiModel,
    voice: options.voice,
    systemPrompt: options.config.systemPrompt,
    inputTranscription: false,
    outputTranscription: true,
  });

  let transcript = '';
  let failure: Error | null = null;

  const off = client.on((event) => {
    if (event.type === 'audio') {
      if (options.speak) void playPcm(event.data);
      return;
    }
    if (event.type === 'output_transcript') {
      transcript = mergeText(transcript, event.text);
      return;
    }
    if (event.type === 'error') {
      failure = new Error(event.message);
    }
  });

  try {
    await client.connect();
    client.sendText(options.question);

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error('The Live session did not answer in time.'));
      }, 60_000);

      const stop = client.on((event) => {
        if (event.type === 'turn_complete') {
          window.clearTimeout(timer);
          stop();
          resolve();
        }
        if (event.type === 'error' && failure) {
          window.clearTimeout(timer);
          stop();
          reject(failure);
        }
      });
    });
  } finally {
    off();
    client.close();
  }

  if (failure) throw failure;
  return transcript.trim() || 'I answered with audio only — try asking again.';
}

/* ------------------------------------------------------------------- stt */

/**
 * Transcribe recorded 16 kHz PCM16 samples.
 *
 * Groq Whisper is used when a Groq key is configured; otherwise the Gemini
 * Live API transcribes the clip.
 */
export async function transcribe(
  samples: Int16Array,
  wav: ArrayBuffer,
  config: PublicConfig,
): Promise<string> {
  const api = bridge();
  if (!api) {
    throw new Error('Voice input needs the Halo desktop app.');
  }

  if (config.hasGroqKey) {
    return api.groq.transcribe(wav, config.groqTranscribeModel);
  }

  if (config.hasGeminiKey) {
    return transcribeWithGemini(samples, config);
  }

  throw new Error('Add a Groq or Gemini API key in Settings to talk to Halo.');
}

/** Let the Live API transcribe a recorded clip. */
async function transcribeWithGemini(
  samples: Int16Array,
  config: PublicConfig,
): Promise<string> {
  const api = bridge();
  if (!api) throw new Error('Voice input needs the Halo desktop app.');

  const { token } = await api.gemini.token(config.geminiModel);
  const client = new LiveClient({
    token,
    model: config.geminiModel,
    inputTranscription: true,
  });

  let text = '';

  const off = client.on((event) => {
    if (event.type === 'input_transcript') {
      text = mergeText(text, event.text);
    }
  });

  try {
    await client.connect();

    const chunk = 4096;
    for (let offset = 0; offset < samples.length; offset += chunk) {
      client.sendAudio(int16ToBase64(samples.subarray(offset, offset + chunk)));
      // Give the socket a moment so the frames are not dropped.
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    client.endAudio();

    const deadline = Date.now() + 20_000;
    while (!text.trim() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  } finally {
    off();
    client.close();
  }

  return text.trim();
}
