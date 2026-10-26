/**
 * A small Gemini Live client for the renderer.
 *
 * The window is opened with a single-use ephemeral token that the main
 * process minted — the long-lived API key never reaches the renderer.
 */
import {
  buildAudioMessage,
  buildAudioStreamEndMessage,
  buildSetupMessage,
  buildTextMessage,
  liveSocketUrl,
  parseServerMessage,
} from '../../shared/protocol.js';

export type LiveEvent =
  | { type: 'setup_complete' }
  | { type: 'output_transcript'; text: string; finished: boolean }
  | { type: 'input_transcript'; text: string; finished: boolean }
  | { type: 'audio'; data: string }
  | { type: 'turn_complete' }
  | { type: 'interrupted' }
  | { type: 'error'; message: string }
  | { type: 'closed'; code: number; reason: string };

type Handler = (event: LiveEvent) => void;

export interface LiveOptions {
  token: string;
  model: string;
  voice?: string;
  systemPrompt?: string;
  inputTranscription?: boolean;
  outputTranscription?: boolean;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private closed = false;

  constructor(private readonly options: LiveOptions) {}

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: LiveEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[live] handler failed', err);
      }
    }
  }

  /** Open the socket and wait for the setup to complete. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const url = liveSocketUrl({ token: this.options.token });
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify(
            buildSetupMessage({
              model: this.options.model,
              voice: this.options.voice || 'Puck',
              systemInstruction: this.options.systemPrompt || '',
              inputTranscription: this.options.inputTranscription ?? false,
              outputTranscription: true,
            }),
          ),
        );
      };

      ws.onmessage = (message) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(message.data));
        } catch {
          return;
        }

        for (const event of parseServerMessage(parsed) as LiveEvent[]) {
          this.emit(event);
          if (event.type === 'setup_complete' && !settled) {
            settled = true;
            resolve();
          }
          if (event.type === 'error' && !settled) {
            settled = true;
            reject(new Error(event.message));
          }
        }
      };

      ws.onerror = () => {
        const message = 'Could not reach the Gemini Live API. Check your connection.';
        this.emit({ type: 'error', message });
        if (!settled) {
          settled = true;
          reject(new Error(message));
        }
      };

      ws.onclose = (event) => {
        this.closed = true;
        this.emit({ type: 'closed', code: event.code, reason: event.reason });
        if (!settled) {
          settled = true;
          reject(new Error(event.reason || 'The Live session closed before it started.'));
        }
      };
    });
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /** Ask a question in text — the model answers in its voice. */
  sendText(text: string): void {
    this.send(buildTextMessage(text));
  }

  /** Stream 16 kHz PCM16 (base64) into the session. */
  sendAudio(base64: string): void {
    this.send(buildAudioMessage(base64));
  }

  /** Tell the server that the audio stream is over. */
  endAudio(): void {
    this.send(buildAudioStreamEndMessage());
  }

  close(): void {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      try {
        this.ws.close(1000, 'client closed');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.closed = true;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
