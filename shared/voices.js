/**
 * The 30 prebuilt Gemini voices (Gemini 3.8 TTS / Live catalog).
 *
 * Single source of truth: the browser imports it directly and the Node server
 * imports the very same file for `GET /api/voices`.
 *
 * `hue` is only used for the little colour chip in the voice picker UI.
 */
export const VOICES = [
  { name: 'Zephyr', descriptor: 'Bright', gender: 'female', hue: 44 },
  { name: 'Puck', descriptor: 'Upbeat', gender: 'male', hue: 188 },
  { name: 'Charon', descriptor: 'Informative', gender: 'male', hue: 222 },
  { name: 'Kore', descriptor: 'Firm', gender: 'female', hue: 268 },
  { name: 'Fenrir', descriptor: 'Excitable', gender: 'male', hue: 12 },
  { name: 'Leda', descriptor: 'Youthful', gender: 'female', hue: 320 },
  { name: 'Orus', descriptor: 'Firm', gender: 'male', hue: 250 },
  { name: 'Aoede', descriptor: 'Breezy', gender: 'female', hue: 172 },
  { name: 'Callirrhoe', descriptor: 'Easy-going', gender: 'female', hue: 96 },
  { name: 'Autonoe', descriptor: 'Bright', gender: 'female', hue: 52 },
  { name: 'Enceladus', descriptor: 'Breathy', gender: 'male', hue: 208 },
  { name: 'Iapetus', descriptor: 'Clear', gender: 'male', hue: 28 },
  { name: 'Umbriel', descriptor: 'Easy-going', gender: 'male', hue: 146 },
  { name: 'Algieba', descriptor: 'Smooth', gender: 'male', hue: 292 },
  { name: 'Despina', descriptor: 'Smooth', gender: 'female', hue: 330 },
  { name: 'Erinome', descriptor: 'Clear', gender: 'female', hue: 16 },
  { name: 'Algenib', descriptor: 'Gravelly', gender: 'male', hue: 6 },
  { name: 'Rasalgethi', descriptor: 'Informative', gender: 'female', hue: 202 },
  { name: 'Laomedeia', descriptor: 'Upbeat', gender: 'female', hue: 60 },
  { name: 'Achernar', descriptor: 'Soft', gender: 'female', hue: 200 },
  { name: 'Alnilam', descriptor: 'Firm', gender: 'male', hue: 232 },
  { name: 'Schedar', descriptor: 'Even', gender: 'male', hue: 262 },
  { name: 'Gacrux', descriptor: 'Mature', gender: 'male', hue: 24 },
  { name: 'Pulcherrima', descriptor: 'Forward', gender: 'female', hue: 354 },
  { name: 'Achird', descriptor: 'Friendly', gender: 'male', hue: 160 },
  { name: 'Zubenelgenubi', descriptor: 'Casual', gender: 'male', hue: 130 },
  { name: 'Vindemiatrix', descriptor: 'Gentle', gender: 'female', hue: 186 },
  { name: 'Sadachbia', descriptor: 'Lively', gender: 'male', hue: 8 },
  { name: 'Sadaltager', descriptor: 'Knowledgeable', gender: 'male', hue: 214 },
  { name: 'Sulafat', descriptor: 'Warm', gender: 'female', hue: 34 },
];

export const DEFAULT_VOICE = 'Puck';

export function getVoice(name) {
  return VOICES.find((v) => v.name === name) || null;
}

export function isValidVoice(name) {
  return VOICES.some((v) => v.name === name);
}
