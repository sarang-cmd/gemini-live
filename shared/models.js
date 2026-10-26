/**
 * Live-capable Gemini models.
 *
 * `gemini-3.8-live` is the current default: lowest latency, native audio, GA.
 * `gemini-3.8-live-extended-thinking` trades latency for deeper reasoning.
 * `gemini-3.1-flash-live-preview` is the older preview, kept for comparison.
 */
export const MODELS = [
  {
    id: 'gemini-3.8-live',
    label: 'Gemini 3.8 Live',
    note: 'Fastest · native audio · recommended',
  },
  {
    id: 'gemini-3.8-live-extended-thinking',
    label: '3.8 Live · Extended Thinking',
    note: 'Background reasoning for hard questions',
  },
  {
    id: 'gemini-3.1-flash-live-preview',
    label: '3.1 Flash Live (preview)',
    note: 'Legacy preview model',
  },
];

export const DEFAULT_MODEL = 'gemini-3.8-live';

export function getModel(id) {
  return MODELS.find((m) => m.id === id) || null;
}
