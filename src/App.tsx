import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MorphOrb } from '@/components/ui/ai-thinking-orb-and-input';
import { HaloHistory } from '@/components/halo-history';
import { HaloSettings } from '@/components/halo-settings';
import { HaloToast } from '@/components/halo-toast';
import { HaloTopBar } from '@/components/halo-top-bar';
import { VoiceDock } from '@/components/voice-dock';
import { ask, transcribe } from '@/lib/assistant';
import { wallpaperById } from '@/lib/wallpapers';
import { Microphone, warmupAudio } from '@/lib/audio';
import { bridge, type GroqModel, type GroqVoice, type PublicConfig } from '@/types/halo';
import { DEFAULT_VOICE, VOICES } from '../shared/voices.js';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  at: number;
}

const FALLBACK_CONFIG: PublicConfig = {
  provider: 'demo',
  hasGeminiKey: false,
  hasGroqKey: false,
  geminiModel: 'gemini-3.8-live',
  groqChatModel: 'openai/gpt-oss-120b',
  groqSpeechModel: 'canopylabs/orpheus-v1-english',
  groqVoice: 'autumn',
  groqTranscribeModel: 'whisper-large-v3-turbo',
  systemPrompt:
    'You are Halo, a concise and warm voice assistant. Answer in one or two short sentences unless the user asks for detail.',
  wallpaper: '',
};

/**
 * Hand a question to the orb.
 *
 * The component listens for a `halo:ask` event, so the voice pipeline never
 * has to reach into the DOM — it just asks, and the orb runs its timeline.
 */
export function askTheOrb(text: string): boolean {
  const question = text.trim();
  if (!question) return false;

  window.dispatchEvent(
    new CustomEvent('halo:ask', { detail: { text: question }, bubbles: true }),
  );

  return true;
}

export default function App() {
  const [config, setConfig] = useState<PublicConfig>(FALLBACK_CONFIG);
  const [groqVoices, setGroqVoices] = useState<GroqVoice[]>([]);
  const [groqModels, setGroqModels] = useState<GroqModel[]>([]);
  const [voice, setVoice] = useState<string>(DEFAULT_VOICE);
  const [muted, setMuted] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [desktop, setDesktop] = useState(false);

  const micRef = useRef<Microphone | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  /* ------------------------------------------------------------ bootstrap */

  useEffect(() => {
    const api = bridge();
    setDesktop(Boolean(api));
    if (!api) {
      showToast('Browser preview — open the Halo desktop app for keys and voice.');
      return;
    }

    api.config
      .get()
      .then((next) => setConfig(next))
      .catch((err: Error) => showToast(err.message));

    api
      .catalog()
      .then((catalog) => {
        setGroqVoices(catalog.groqVoices);
        setGroqModels(catalog.groqModels);
      })
      .catch(() => undefined);
  }, [showToast]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  // The generated background fades out when a stock photo is worn instead.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--bgOpacity',
      config.wallpaper ? '0.42' : '1',
    );
  }, [config.wallpaper]);

  /* --------------------------------------------------------------- asking */

  const push = useCallback((entry: TranscriptEntry) => {
    setEntries((current) => [...current, entry]);
  }, []);

  const handleAsk = useCallback(
    async (question: string): Promise<string> => {
      push({
        id: `${Date.now()}-q`,
        role: 'user',
        text: question,
        at: Date.now(),
      });

      try {
        const answer = await ask({
          question,
          config,
          voice,
          speak: !muted,
          id: `${Date.now()}`,
        });

        push({
          id: `${Date.now()}-a`,
          role: 'assistant',
          text: answer,
          at: Date.now(),
        });

        return answer;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        push({ id: `${Date.now()}-e`, role: 'error', text: message, at: Date.now() });
        showToast(message);
        return 'I could not answer that.';
      }
    },
    [config, muted, push, showToast, voice],
  );

  /* ---------------------------------------------------------------- voice */

  const startRecording = useCallback(async () => {
    if (busy || recording) return;
    await warmupAudio();

    const mic = micRef.current ?? new Microphone();
    mic.onLevel = setLevel;
    micRef.current = mic;

    try {
      await mic.start();
      setRecording(true);
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : 'No microphone is available.';
      showToast(message);
    }
  }, [busy, recording, showToast]);

  const stopRecording = useCallback(async () => {
    if (!recording || !micRef.current) return;
    setRecording(false);
    setLevel(0);

    const result = await micRef.current.stop();

    if (result.duration < 0.4) {
      showToast('That was too short — hold the button while you talk.');
      return;
    }

    setBusy(true);
    try {
      const text = await transcribe(result.samples, result.wav, config);
      if (!text.trim()) {
        showToast('I did not catch that.');
        return;
      }
      askTheOrb(text);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [config, recording, showToast]);

  /* -------------------------------------------------------------- shortcuts */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape' && !settingsOpen) {
        setSettingsOpen(false);
        setHistoryOpen(false);
        return;
      }

      // Ctrl/Cmd + Space toggles the microphone.
      if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
        event.preventDefault();
        if (recording) void stopRecording();
        else void startRecording();
        return;
      }

      if (typing) return;
      if (event.key === 'm' || event.key === 'M') {
        if (recording) void stopRecording();
        else void startRecording();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, settingsOpen, startRecording, stopRecording]);

  /* ----------------------------------------------------------------- view */

  const wallpaper = useMemo(
    () => (config.wallpaper ? wallpaperById(config.wallpaper) : null),
    [config.wallpaper],
  );

  const providerLabel = useMemo(() => {
    if (config.provider === 'gemini') {
      return config.hasGeminiKey ? `Gemini · ${config.geminiModel}` : 'Gemini · no key';
    }
    if (config.provider === 'groq') {
      return config.hasGroqKey ? `Groq · ${config.groqChatModel}` : 'Groq · no key';
    }
    return 'Demo mode';
  }, [config]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {wallpaper ? (
        <img
          src={wallpaper.url}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-45 blur-[1px]"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}

      <MorphOrb onSubmit={handleAsk} minThinkMs={1200} />

      <HaloTopBar
        providerLabel={providerLabel}
        desktop={desktop}
        onHistory={() => setHistoryOpen((open) => !open)}
        onSettings={() => setSettingsOpen(true)}
      />

      <VoiceDock
        voice={voice}
        voices={VOICES as { name: string; descriptor: string; gender: string }[]}
        muted={muted}
        recording={recording}
        busy={busy}
        level={level}
        onVoice={setVoice}
        onMute={() => setMuted((value) => !value)}
        onPress={startRecording}
        onRelease={stopRecording}
      />

      {historyOpen ? (
        <HaloHistory entries={entries} onClose={() => setHistoryOpen(false)} />
      ) : null}

      <HaloSettings
        open={settingsOpen}
        config={config}
        voices={VOICES as { name: string; descriptor: string; gender: string }[]}
        groqVoices={groqVoices}
        groqModels={groqModels}
        onClose={() => setSettingsOpen(false)}
        onSave={(patch) => {
          const api = bridge();
          if (!api) {
            showToast('Settings are only editable in the desktop app.');
            return;
          }
          api.config
            .set(patch)
            .then((next) => {
              setConfig(next);
              showToast('Saved.');
            })
            .catch((err: Error) => showToast(err.message));
        }}
      />

      <HaloToast message={toast} />
    </main>
  );
}
