/**
 * PCM helpers shared by the browser and the Node test-suite.
 *
 * The Live API speaks raw little-endian 16-bit PCM, base64 encoded inside JSON.
 * These helpers are deliberately dependency free so they can be unit tested
 * with `node --test` (Node exposes `atob`/`btoa` as globals).
 */

/** Int16Array -> base64 (chunked so we never blow the argument limit). */
export function int16ToBase64(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** base64 -> Int16Array. */
export function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/** Float32 (-1..1) -> Int16 with clipping. */
export function floatToInt16(sample) {
  const s = sample < -1 ? -1 : sample > 1 ? 1 : sample;
  return Math.round(s * 32767);
}

/** Int16 -> Float32 (-1..1). */
export function int16ToFloat(value) {
  return value / 32768;
}

/** Root mean square of an Int16Array — the orb's "energy" input. */
export function rmsInt16(int16) {
  if (!int16 || !int16.length) return 0;
  let sum = 0;
  for (let i = 0; i < int16.length; i += 1) {
    const v = int16[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / int16.length);
}

/** Encode an Int16Array as a 44-byte WAV container (debugging / downloads). */
export function int16ToWav(int16, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + int16.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + int16.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, int16.length * 2, true);
  new Int16Array(buffer, 44).set(int16);
  return buffer;
}
