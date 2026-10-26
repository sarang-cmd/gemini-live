/**
 * The `window.halo` bridge — the only way into the main process.
 *
 * The renderer also runs in a plain browser (the `npm run web` preview), where
 * the bridge is missing. Every call site therefore goes through `bridge()`,
 * which returns `null` instead of throwing.
 */

export interface PublicConfig {
  provider: 'gemini' | 'groq' | 'demo';
  hasGeminiKey: boolean;
  hasGroqKey: boolean;
  geminiModel: string;
  groqChatModel: string;
  groqSpeechModel: string;
  groqVoice: string;
  groqTranscribeModel: string;
  systemPrompt: string;
  wallpaper: string;
}

export interface GroqVoice {
  id: string;
  label: string;
  gender: string;
  model: string;
}

export interface GroqModel {
  id: string;
  label: string;
}

export interface HaloBridge {
  desktop: true;
  config: {
    get(): Promise<PublicConfig>;
    set(patch: Partial<PublicConfig> & { geminiKey?: string; groqKey?: string }): Promise<PublicConfig>;
  };
  catalog(): Promise<{
    groqVoices: GroqVoice[];
    groqModels: GroqModel[];
    defaults: PublicConfig;
  }>;
  groq: {
    transcribe(audio: ArrayBuffer, model?: string): Promise<string>;
    chat(
      messages: { role: string; content: string }[],
      options?: { id?: string; model?: string; systemPrompt?: string },
    ): Promise<string>;
    speak(
      text: string,
      options?: { voice?: string; model?: string; format?: string },
    ): Promise<ArrayBuffer>;
  };
  gemini: {
    token(model?: string): Promise<{ token: string; expiresAt: string; model: string }>;
  };
  onChatDelta(
    handler: (payload: { id: string; delta: string; full: string }) => void,
  ): () => void;
}

declare global {
  interface Window {
    halo?: HaloBridge;
  }
}

/** The bridge, or `null` when we are running in a plain browser. */
export function bridge(): HaloBridge | null {
  if (typeof window === 'undefined') return null;
  return window.halo ?? null;
}

/** True when the desktop bridge is available. */
export function isDesktop(): boolean {
  return bridge() !== null;
}
