import { useEffect, useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';

import type { GroqModel, GroqVoice, PublicConfig } from '@/types/halo';
import { WALLPAPERS } from '@/lib/wallpapers';

interface Props {
  open: boolean;
  config: PublicConfig;
  voices: { name: string; descriptor: string; gender: string }[];
  groqVoices: GroqVoice[];
  groqModels: GroqModel[];
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}

type Provider = 'gemini' | 'groq' | 'demo';

const SPEECH_MODELS = [
  { id: 'canopylabs/orpheus-v1-english', label: 'Orpheus — English' },
  { id: 'canopylabs/orpheus-v1-arabic-saudi', label: 'Orpheus — Arabic (Saudi)' },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-white/30">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[13px] text-white/90 outline-none transition placeholder:text-white/25 focus:border-sky-300/50 focus:ring-2 focus:ring-sky-400/20';

export function HaloSettings({
  open,
  config,
  voices,
  groqVoices,
  groqModels,
  onClose,
  onSave,
}: Props) {
  const [provider, setProvider] = useState<Provider>(config.provider);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [geminiModel, setGeminiModel] = useState(config.geminiModel);
  const [groqChatModel, setGroqChatModel] = useState(config.groqChatModel);
  const [groqSpeechModel, setGroqSpeechModel] = useState(config.groqSpeechModel);
  const [groqVoice, setGroqVoice] = useState(config.groqVoice);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [wallpaper, setWallpaper] = useState(config.wallpaper);

  useEffect(() => {
    if (!open) return;
    setProvider(config.provider);
    setGeminiModel(config.geminiModel);
    setGroqChatModel(config.groqChatModel);
    setGroqSpeechModel(config.groqSpeechModel);
    setGroqVoice(config.groqVoice);
    setSystemPrompt(config.systemPrompt);
    setWallpaper(config.wallpaper);
  }, [config, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  const save = () => {
    const patch: Record<string, unknown> = {
      provider,
      geminiModel,
      groqChatModel,
      groqSpeechModel,
      groqVoice,
      systemPrompt,
      wallpaper,
    };
    if (geminiKey.trim()) patch.geminiKey = geminiKey.trim();
    if (groqKey.trim()) patch.groqKey = groqKey.trim();
    onSave(patch);
    onClose();
  };

  const providerOptions: { id: Provider; label: string; blurb: string }[] = [
    { id: 'gemini', label: 'Gemini', blurb: 'Live API, native voice' },
    { id: 'groq', label: 'Groq', blurb: 'Whisper + LLM + Orpheus' },
    { id: 'demo', label: 'Demo', blurb: 'No keys required' },
  ];

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="halo-panel max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0a0f1d]/95 p-6 shadow-2xl shadow-black/60">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
            <p className="text-[13px] text-white/45">
              Keys are stored on this machine, in the Electron user-data folder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Close settings"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="grid gap-6">
          <Field label="Provider">
            <div className="grid grid-cols-3 gap-2">
              {providerOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setProvider(option.id)}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                    provider === option.id
                      ? 'border-sky-300/45 bg-sky-400/15 text-white'
                      : 'border-white/10 bg-black/20 text-white/60 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {provider === option.id ? <Check size={13} strokeWidth={2.4} /> : null}
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/40">{option.blurb}</span>
                </button>
              ))}
            </div>
          </Field>

          {provider === 'gemini' ? (
            <div className="grid gap-4">
              <Field
                label="Gemini API key"
                hint={
                  config.hasGeminiKey
                    ? 'A key is saved. Type a new one to replace it.'
                    : 'Needed to mint the ephemeral Live token.'
                }
              >
                <div className="relative">
                  <KeyRound
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(event) => setGeminiKey(event.target.value)}
                    placeholder={config.hasGeminiKey ? '••••••••••••' : 'AIza…'}
                    className={`${inputClass} pl-9`}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </Field>

              <Field label="Live model">
                <input
                  value={geminiModel}
                  onChange={(event) => setGeminiModel(event.target.value)}
                  className={inputClass}
                  spellCheck={false}
                />
              </Field>

              <Field label="Prebuilt voice">
                <VoiceNote count={voices.length} />
              </Field>
            </div>
          ) : null}

          {provider === 'groq' ? (
            <div className="grid gap-4">
              <Field
                label="Groq API key"
                hint={
                  config.hasGroqKey
                    ? 'A key is saved. Type a new one to replace it.'
                    : 'Needed for Whisper, the chat model and Orpheus.'
                }
              >
                <div className="relative">
                  <KeyRound
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(event) => setGroqKey(event.target.value)}
                    placeholder={config.hasGroqKey ? '••••••••••••' : 'gsk_…'}
                    className={`${inputClass} pl-9`}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </Field>

              <Field label="Chat model">
                <select
                  value={groqChatModel}
                  onChange={(event) => setGroqChatModel(event.target.value)}
                  className={inputClass}
                >
                  {groqModels.map((model) => (
                    <option key={model.id} value={model.id} className="bg-[#0a1020]">
                      {model.label}
                    </option>
                  ))}
                  {!groqModels.length ? (
                    <option value={groqChatModel} className="bg-[#0a1020]">
                      {groqChatModel}
                    </option>
                  ) : null}
                </select>
              </Field>

              <Field label="Speech model">
                <select
                  value={groqSpeechModel}
                  onChange={(event) => setGroqSpeechModel(event.target.value)}
                  className={inputClass}
                >
                  {SPEECH_MODELS.map((model) => (
                    <option key={model.id} value={model.id} className="bg-[#0a1020]">
                      {model.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Orpheus voice">
                <select
                  value={groqVoice}
                  onChange={(event) => setGroqVoice(event.target.value)}
                  className={inputClass}
                >
                  {groqVoices
                    .filter((item) => item.model === groqSpeechModel)
                    .map((item) => (
                      <option key={item.id} value={item.id} className="bg-[#0a1020]">
                        {item.label} · {item.gender}
                      </option>
                    ))}
                  {!groqVoices.length ? (
                    <option value={groqVoice} className="bg-[#0a1020]">
                      {groqVoice}
                    </option>
                  ) : null}
                </select>
              </Field>
            </div>
          ) : null}

          <Field label="Background">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWallpaper('')}
                className={`h-12 w-16 rounded-xl border text-[11px] transition ${
                  wallpaper === ''
                    ? 'border-sky-300/50 bg-sky-400/15 text-white'
                    : 'border-white/10 bg-black/25 text-white/50 hover:bg-white/5'
                }`}
              >
                Aurora
              </button>
              {WALLPAPERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWallpaper(item.id)}
                  title={item.label}
                  className={`h-12 w-16 overflow-hidden rounded-xl border transition ${
                    wallpaper === item.id
                      ? 'border-sky-300/60 ring-2 ring-sky-400/30'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <img
                    src={`${item.url}&w=200`}
                    alt={item.label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </button>
              ))}
            </div>
          </Field>

          <Field label="System prompt">
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              rows={3}
              className={`${inputClass} resize-none leading-relaxed`}
            />
          </Field>
        </div>

        <div className="mt-7 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] text-white/55 transition hover:bg-white/5 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-sky-400 px-4 py-2 text-[13px] font-semibold text-[#05070f] transition hover:bg-sky-300"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function VoiceNote({ count }: { count: number }) {
  return (
    <p className="text-[12px] text-white/40">
      {count} prebuilt voices are available — pick one in the dock at the bottom right.
    </p>
  );
}
