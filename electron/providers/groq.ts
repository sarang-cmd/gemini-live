/**
 * Groq provider — speech-to-text, chat and text-to-speech.
 *
 * Groq exposes an OpenAI compatible API:
 *
 *   POST /openai/v1/audio/transcriptions   (multipart, whisper-large-v3-turbo)
 *   POST /openai/v1/chat/completions       (SSE stream)
 *   POST /openai/v1/audio/speech           (orpheus, wav)
 *
 * Everything runs in the main process so the API key never reaches the
 * renderer.
 */

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export class GroqError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'GroqError';
    this.status = status;
  }
}

function headers(apiKey: string): Record<string, string> {
  if (!apiKey) {
    throw new GroqError('No Groq API key is configured. Add one in Settings.', 400);
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function fail(response: Response, what: string): Promise<never> {
  const body = await response.text();
  let message = `${what} failed with status ${response.status}.`;
  try {
    const json = JSON.parse(body) as { error?: { message?: string } };
    if (json?.error?.message) message = json.error.message;
  } catch {
    if (body) message = body.slice(0, 400);
  }
  throw new GroqError(message, response.status);
}

/* ------------------------------------------------------------------- stt */

export interface TranscribeOptions {
  model?: string;
  /** Override the API root — used by the tests. */
  baseUrl?: string;
}

/**
 * Transcribe 16 kHz PCM16 WAV bytes.
 */
export async function transcribe(
  apiKey: string,
  wav: Uint8Array,
  options: TranscribeOptions = {},
): Promise<string> {
  const base = options.baseUrl ?? GROQ_BASE_URL;
  // Copy into a plain ArrayBuffer so the Blob is happy with the type.
  const bytes = new Uint8Array(wav.length);
  bytes.set(wav);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'halo.wav');
  form.append('model', options.model || 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  form.append('temperature', '0');

  let response: Response;
  try {
    response = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    throw new GroqError(
      `Could not reach Groq (${(err as Error).message}). Check this machine's network access.`,
    );
  }

  if (!response.ok) await fail(response, 'The transcription request');

  const body = (await response.json()) as { text?: string };
  return (body.text ?? '').trim();
}

/* ------------------------------------------------------------------ chat */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Override the API root — used by the tests. */
  baseUrl?: string;
  /** Called for every streamed chunk. */
  onDelta?: (delta: string, full: string) => void;
}

/** Split a byte stream into SSE `data:` payloads. */
async function* sseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const payload = raw
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');
        if (payload) yield payload;
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream a chat completion and return the full answer.
 */
export async function chat(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const base = options.baseUrl ?? GROQ_BASE_URL;

  const body: Record<string, unknown> = {
    model: options.model || 'openai/gpt-oss-120b',
    messages,
    stream: true,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new GroqError(
      `Could not reach Groq (${(err as Error).message}). Check this machine's network access.`,
    );
  }

  if (!response.ok) await fail(response, 'The chat request');
  if (!response.body) throw new GroqError('Groq returned an empty stream.');

  let full = '';

  for await (const payload of sseChunks(response.body)) {
    if (payload === '[DONE]') break;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
      };
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        options.onDelta?.(delta, full);
      }
    } catch {
      /* ignore malformed frames */
    }
  }

  return full.trim();
}

/* ------------------------------------------------------------------ tts */

export interface SpeakOptions {
  model?: string;
  voice?: string;
  format?: 'wav' | 'mp3' | 'flac' | 'ogg' | 'mulaw';
  /** Override the API root — used by the tests. */
  baseUrl?: string;
}

/**
 * Synthesise speech. Returns the raw audio bytes (WAV by default).
 */
export async function speak(
  apiKey: string,
  text: string,
  options: SpeakOptions = {},
): Promise<Uint8Array> {
  const base = options.baseUrl ?? GROQ_BASE_URL;
  const trimmed = text.trim();
  if (!trimmed) throw new GroqError('There is nothing to say.', 400);

  let response: Response;
  try {
    response = await fetch(`${base}/audio/speech`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        model: options.model || 'canopylabs/orpheus-v1-english',
        input: trimmed,
        voice: options.voice || 'autumn',
        response_format: options.format || 'wav',
      }),
    });
  } catch (err) {
    throw new GroqError(
      `Could not reach Groq (${(err as Error).message}). Check this machine's network access.`,
    );
  }

  if (!response.ok) await fail(response, 'The speech request');

  return new Uint8Array(await response.arrayBuffer());
}
