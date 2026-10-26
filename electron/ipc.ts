/**
 * IPC surface.
 *
 * The renderer talks to the main process through the narrow `window.halo`
 * bridge exposed by the preload script. Every handler validates its input and
 * returns plain, structured-clone friendly data.
 */
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';

import { getConfig, publicView, setConfig, type HaloConfig } from './config.js';
import { chat, speak, transcribe, type ChatMessage } from './providers/groq.js';
import { createEphemeralToken } from './providers/gemini.js';
import { GROQ_VOICES, GROQ_MODELS } from './catalog.js';

export const CHANNELS = {
  configGet: 'halo:config:get',
  configSet: 'halo:config:set',
  groqTranscribe: 'halo:groq:transcribe',
  groqChat: 'halo:groq:chat',
  groqSpeak: 'halo:groq:speak',
  geminiToken: 'halo:gemini:token',
  catalog: 'halo:catalog',
} as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null,
    )
    .map((entry): ChatMessage => ({
      role:
        entry.role === 'system'
          ? 'system'
          : entry.role === 'assistant'
            ? 'assistant'
            : 'user',
      content: asString(entry.content),
    }))
    .filter((entry) => entry.content.length > 0);
}

/** Register every handler. Safe to call once, at startup. */
export function registerIpc(): void {
  ipcMain.handle(CHANNELS.configGet, () => publicView());

  ipcMain.handle(CHANNELS.configSet, (_event, patch: Partial<HaloConfig>) => {
    const clean: Partial<HaloConfig> = {};
    if (typeof patch?.provider === 'string') clean.provider = patch.provider as HaloConfig['provider'];
    if (typeof patch?.geminiKey === 'string') clean.geminiKey = patch.geminiKey.trim();
    if (typeof patch?.groqKey === 'string') clean.groqKey = patch.groqKey.trim();
    if (typeof patch?.geminiModel === 'string') clean.geminiModel = patch.geminiModel;
    if (typeof patch?.groqChatModel === 'string') clean.groqChatModel = patch.groqChatModel;
    if (typeof patch?.groqSpeechModel === 'string') clean.groqSpeechModel = patch.groqSpeechModel;
    if (typeof patch?.groqVoice === 'string') clean.groqVoice = patch.groqVoice;
    if (typeof patch?.groqTranscribeModel === 'string') {
      clean.groqTranscribeModel = patch.groqTranscribeModel;
    }
    if (typeof patch?.systemPrompt === 'string') clean.systemPrompt = patch.systemPrompt;
    if (typeof patch?.wallpaper === 'string') clean.wallpaper = patch.wallpaper;

    return publicView(setConfig(clean));
  });

  ipcMain.handle(
    CHANNELS.groqTranscribe,
    async (_event, payload: { audio?: ArrayBuffer | Uint8Array; model?: string }) => {
      const config = getConfig();
      const audio = payload?.audio;
      if (!audio) throw new Error('No audio was supplied.');
      const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
      return transcribe(config.groqKey, bytes, {
        model: payload?.model || config.groqTranscribeModel,
      });
    },
  );

  ipcMain.handle(
    CHANNELS.groqChat,
    async (
      event: IpcMainInvokeEvent,
      payload: { messages?: ChatMessage[]; model?: string; systemPrompt?: string; id?: string },
    ) => {
      const config = getConfig();
      const messages = asMessages(payload?.messages);

      const system =
        payload?.systemPrompt?.trim() ||
        config.systemPrompt ||
        'You are Halo, a concise voice assistant.';

      const withSystem: ChatMessage[] = [
        { role: 'system', content: system },
        ...messages.filter((message) => message.role !== 'system'),
      ];

      const sender: WebContents | undefined = event.sender;

      return chat(config.groqKey, withSystem, {
        model: payload?.model || config.groqChatModel,
        onDelta: (delta, full) => {
          if (sender && !sender.isDestroyed()) {
            sender.send('halo:groq:delta', { id: payload?.id ?? '', delta, full });
          }
        },
      });
    },
  );

  ipcMain.handle(
    CHANNELS.groqSpeak,
    async (
      _event,
      payload: { text?: string; voice?: string; model?: string; format?: 'wav' | 'mp3' | 'flac' },
    ) => {
      const config = getConfig();
      const audio = await speak(config.groqKey, asString(payload?.text), {
        model: payload?.model || config.groqSpeechModel,
        voice: payload?.voice || config.groqVoice,
        format: payload?.format || 'wav',
      });
      // Transfer the bytes without copying them into a JSON blob.
      return audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength);
    },
  );

  ipcMain.handle(
    CHANNELS.geminiToken,
    async (_event, payload: { model?: string }) => {
      const config = getConfig();
      const token = await createEphemeralToken({ apiKey: config.geminiKey });
      return { ...token, model: payload?.model || config.geminiModel };
    },
  );

  ipcMain.handle(CHANNELS.catalog, () => ({
    groqVoices: GROQ_VOICES,
    groqModels: GROQ_MODELS,
    defaults: publicView(),
  }));
}
