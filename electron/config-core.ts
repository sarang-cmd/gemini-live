/**
 * The pure part of the configuration.
 *
 * No Electron import, no file system — just the defaults, the merge rules
 * and the projection the renderer is allowed to see.
 */

export type Provider = 'gemini' | 'groq' | 'demo';

export interface HaloConfig {
  /** Which brain answers the questions. */
  provider: Provider;
  /** Gemini API key (only used to mint ephemeral tokens). */
  geminiKey: string;
  /** Groq API key. */
  groqKey: string;
  /** Live model used for the Gemini provider. */
  geminiModel: string;
  /** Groq chat model used for the Groq provider. */
  groqChatModel: string;
  /** Groq speech model used for the Groq provider. */
  groqSpeechModel: string;
  /** Groq speech voice. */
  groqVoice: string;
  /** Groq transcription model. */
  groqTranscribeModel: string;
  /** Extra instructions appended to every request. */
  systemPrompt: string;
  /** The id of the background photo (see src/lib/wallpapers.ts). */
  wallpaper: string;
}

export const DEFAULTS: HaloConfig = {
  provider: 'gemini',
  geminiKey: '',
  groqKey: '',
  geminiModel: 'gemini-3.8-live',
  groqChatModel: 'openai/gpt-oss-120b',
  groqSpeechModel: 'canopylabs/orpheus-v1-english',
  groqVoice: 'autumn',
  groqTranscribeModel: 'whisper-large-v3-turbo',
  systemPrompt:
    'You are Halo, a concise and warm voice assistant. Answer in one or two short sentences unless the user asks for detail.',
  wallpaper: '',
};

export const PROVIDERS: Provider[] = ['gemini', 'groq', 'demo'];

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && PROVIDERS.includes(value as Provider);
}

/** Merge a patch over the defaults, ignoring unknown keys. */
export function mergeConfig(
  base: HaloConfig,
  patch: Partial<HaloConfig> | null | undefined,
): HaloConfig {
  if (!patch) return { ...base };

  const next: HaloConfig = { ...base };

  if (isProvider(patch.provider)) next.provider = patch.provider;
  if (typeof patch.geminiKey === 'string') next.geminiKey = patch.geminiKey.trim();
  if (typeof patch.groqKey === 'string') next.groqKey = patch.groqKey.trim();
  if (typeof patch.geminiModel === 'string' && patch.geminiModel.trim()) {
    next.geminiModel = patch.geminiModel.trim();
  }
  if (typeof patch.groqChatModel === 'string' && patch.groqChatModel.trim()) {
    next.groqChatModel = patch.groqChatModel.trim();
  }
  if (typeof patch.groqSpeechModel === 'string' && patch.groqSpeechModel.trim()) {
    next.groqSpeechModel = patch.groqSpeechModel.trim();
  }
  if (typeof patch.groqVoice === 'string' && patch.groqVoice.trim()) {
    next.groqVoice = patch.groqVoice.trim();
  }
  if (typeof patch.groqTranscribeModel === 'string' && patch.groqTranscribeModel.trim()) {
    next.groqTranscribeModel = patch.groqTranscribeModel.trim();
  }
  if (typeof patch.systemPrompt === 'string') next.systemPrompt = patch.systemPrompt;
  if (typeof patch.wallpaper === 'string') next.wallpaper = patch.wallpaper;

  return next;
}

/** The configuration as the renderer is allowed to see it — no secrets. */
export function publicConfig(config: HaloConfig) {
  return {
    provider: config.provider,
    hasGeminiKey: Boolean(config.geminiKey),
    hasGroqKey: Boolean(config.groqKey),
    geminiModel: config.geminiModel,
    groqChatModel: config.groqChatModel,
    groqSpeechModel: config.groqSpeechModel,
    groqVoice: config.groqVoice,
    groqTranscribeModel: config.groqTranscribeModel,
    systemPrompt: config.systemPrompt,
    wallpaper: config.wallpaper,
  };
}
