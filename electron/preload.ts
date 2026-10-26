/**
 * The preload bridge.
 *
 * Everything the renderer is allowed to do on the machine is listed here.
 * The API keys never cross this boundary — the renderer asks the main process
 * to mint a Gemini token or to call Groq on its behalf.
 */
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  /** Is this the desktop app, or a plain browser preview? */
  desktop: true,

  config: {
    get: () => ipcRenderer.invoke('halo:config:get'),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke('halo:config:set', patch),
  },

  catalog: () => ipcRenderer.invoke('halo:catalog'),

  groq: {
    /** `audio` is 16 kHz PCM16 wrapped in a WAV header. */
    transcribe: (audio: ArrayBuffer, model?: string) =>
      ipcRenderer.invoke('halo:groq:transcribe', { audio, model }),
    chat: (messages: { role: string; content: string }[], options?: Record<string, unknown>) =>
      ipcRenderer.invoke('halo:groq:chat', { messages, ...(options ?? {}) }),
    speak: (text: string, options?: { voice?: string; model?: string; format?: string }) =>
      ipcRenderer.invoke('halo:groq:speak', { text, ...(options ?? {}) }),
  },

  gemini: {
    token: (model?: string) => ipcRenderer.invoke('halo:gemini:token', { model }),
  },

  /** Subscribe to the streamed Groq answer. Returns an unsubscribe function. */
  onChatDelta: (handler: (payload: { id: string; delta: string; full: string }) => void) => {
    const listener = (_event: unknown, payload: { id: string; delta: string; full: string }) =>
      handler(payload);
    ipcRenderer.on('halo:groq:delta', listener);
    return () => {
      ipcRenderer.removeListener('halo:groq:delta', listener);
    };
  },
};

contextBridge.exposeInMainWorld('halo', api);

export type HaloApi = typeof api;
