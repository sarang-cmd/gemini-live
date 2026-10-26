/**
 * The Groq catalog.
 *
 * Groq retired the PlayAI speech models on 31 December 2025 — the platform
 * wide text-to-speech model is now Canopy Labs Orpheus.
 */

/** Speech models offered by Groq today. */
export const GROQ_SPEECH_MODELS = [
  {
    id: 'canopylabs/orpheus-v1-english',
    label: 'Orpheus — English',
    language: 'en',
  },
  {
    id: 'canopylabs/orpheus-v1-arabic-saudi',
    label: 'Orpheus — Arabic (Saudi)',
    language: 'ar',
  },
] as const;

/** Voices per speech model. */
export const GROQ_VOICES = [
  { id: 'autumn', label: 'Autumn', gender: 'female', model: 'canopylabs/orpheus-v1-english' },
  { id: 'diana', label: 'Diana', gender: 'female', model: 'canopylabs/orpheus-v1-english' },
  { id: 'hannah', label: 'Hannah', gender: 'female', model: 'canopylabs/orpheus-v1-english' },
  { id: 'austin', label: 'Austin', gender: 'male', model: 'canopylabs/orpheus-v1-english' },
  { id: 'daniel', label: 'Daniel', gender: 'male', model: 'canopylabs/orpheus-v1-english' },
  { id: 'troy', label: 'Troy', gender: 'male', model: 'canopylabs/orpheus-v1-english' },
  { id: 'fahad', label: 'Fahad', gender: 'male', model: 'canopylabs/orpheus-v1-arabic-saudi' },
  { id: 'sultan', label: 'Sultan', gender: 'male', model: 'canopylabs/orpheus-v1-arabic-saudi' },
  { id: 'lulwa', label: 'Lulwa', gender: 'female', model: 'canopylabs/orpheus-v1-arabic-saudi' },
  { id: 'noura', label: 'Noura', gender: 'female', model: 'canopylabs/orpheus-v1-arabic-saudi' },
] as const;

/** Chat models worth offering. */
export const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2' },
  { id: 'qwen/qwen3-32b', label: 'Qwen3 32B' },
] as const;

/** Transcription models. */
export const GROQ_TRANSCRIBE_MODELS = [
  { id: 'whisper-large-v3-turbo', label: 'Whisper Large v3 Turbo' },
  { id: 'whisper-large-v3', label: 'Whisper Large v3' },
] as const;
