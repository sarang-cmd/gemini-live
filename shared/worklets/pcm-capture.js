/**
 * AudioWorklet processor: microphone -> 16 kHz mono PCM16.
 *
 * The Live API wants raw little-endian 16-bit PCM at 16 kHz. Browsers hand us
 * audio at whatever rate the AudioContext was created with, so we resample with
 * linear interpolation and post Int16 chunks (every ~32 ms) to the main thread.
 *
 * The chunk also carries the RMS of the block, which drives the orb.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions || {};
    this.targetRate = opts.targetRate || 16000;
    this.ratio = sampleRate / this.targetRate;
    this.chunkSamples = opts.chunkSamples || 512; // 32 ms @ 16 kHz

    this.buffer = new Float32Array(4096);
    this.bufferLength = 0;
    this.position = 0; // fractional read position inside `buffer`

    this.out = new Int16Array(this.chunkSamples);
    this.outLength = 0;
  }

  _ensureCapacity(extra) {
    if (this.bufferLength + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.bufferLength + extra) size *= 2;
    const next = new Float32Array(size);
    next.set(this.buffer.subarray(0, this.bufferLength));
    this.buffer = next;
  }

  _emit() {
    if (this.outLength === 0) return;
    const chunk = this.out.slice(0, this.outLength);
    this.outLength = 0;

    let sum = 0;
    for (let i = 0; i < chunk.length; i += 1) {
      const v = chunk[i] / 32768;
      sum += v * v;
    }
    const level = Math.sqrt(sum / chunk.length);

    this.port.postMessage({ type: 'audio', pcm: chunk, level }, [chunk.buffer]);
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || channel.length === 0) return true;

    this._ensureCapacity(channel.length);
    this.buffer.set(channel, this.bufferLength);
    this.bufferLength += channel.length;

    // Emit every targetRate-sample output we can interpolate.
    while (this.position + 1 < this.bufferLength) {
      const index = Math.floor(this.position);
      const frac = this.position - index;
      const sample = this.buffer[index] * (1 - frac) + this.buffer[index + 1] * frac;

      const clipped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      this.out[this.outLength] = Math.round(clipped * 32767);
      this.outLength += 1;

      if (this.outLength >= this.chunkSamples) this._emit();
      this.position += this.ratio;
    }

    // Drop the samples we already consumed. The read position can run past the
    // end of the buffer (the resampler always keeps one sample of look-ahead),
    // so never consume more than we actually hold.
    const consumed = Math.min(Math.floor(this.position), Math.max(0, this.bufferLength - 1));
    if (consumed > 0) {
      this.buffer.copyWithin(0, consumed, this.bufferLength);
      this.bufferLength -= consumed;
      this.position -= consumed;
    }

    this._emit();
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
