/**
 * AudioWorklet processor: 24 kHz mono PCM16 -> speakers.
 *
 * The Live API streams 24 kHz PCM. We keep a growable buffer of pending source
 * samples and resample (linear interpolation) to whatever rate the AudioContext
 * runs at, so playback never speeds up or slows down.
 *
 * `flush` drops everything currently queued — that is how barge-in works:
 * when the server reports `interrupted`, the half-spoken answer is thrown away.
 */
class PcmPlayerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions || {};
    this.sourceRate = opts.sourceRate || 24000;
    this.ratio = sampleRate / this.sourceRate; // output frames per source sample

    this.stream = new Float32Array(8192);
    this.streamLength = 0;
    this.position = 0; // fractional read position inside `stream`
    this.levelCounter = 0;
    this.levelSum = 0;
    this.levelCount = 0;
  }

  onmessage(event) {
    const message = event.data;
    if (!message) return;

    if (message.type === 'pcm') {
      const int16 = new Int16Array(message.buffer);
      const need = this.streamLength + int16.length;
      if (need > this.stream.length) {
        let size = this.stream.length * 2;
        while (size < need) size *= 2;
        const next = new Float32Array(size);
        next.set(this.stream.subarray(0, this.streamLength));
        this.stream = next;
      }
      for (let i = 0; i < int16.length; i += 1) {
        this.stream[this.streamLength + i] = int16[i] / 32768;
      }
      this.streamLength += int16.length;
    } else if (message.type === 'flush') {
      this.streamLength = 0;
      this.position = 0;
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;

    let sum = 0;

    for (let i = 0; i < output.length; i += 1) {
      const needed = Math.floor(this.position) + 1;

      if (needed >= this.streamLength) {
        // No audio available yet. Emit silence but hold the read position so
        // the next chunk is not skipped over.
        output[i] = 0;
        continue;
      }

      const index = Math.floor(this.position);
      const frac = this.position - index;
      const sample = this.stream[index] * (1 - frac) + this.stream[index + 1] * frac;
      output[i] = sample;
      sum += sample * sample;

      this.position += this.ratio;
    }

    // Release the samples we have already played.
    const consumed = Math.floor(this.position);
    if (consumed > 0) {
      this.stream.copyWithin(0, consumed, this.streamLength);
      this.streamLength -= consumed;
      this.position -= consumed;
    }

    this.levelCounter += 1;
    this.levelSum += sum;
    this.levelCount += output.length;

    // One level update every 8 render quanta (~21 ms at 48 kHz) is plenty for
    // the orb and keeps postMessage traffic low.
    if (this.levelCounter % 8 === 0) {
      const level = this.levelCount ? Math.sqrt(this.levelSum / this.levelCount) : 0;
      this.levelSum = 0;
      this.levelCount = 0;
      this.port.postMessage({ type: 'level', level });
    }

    return true;
  }
}

registerProcessor('pcm-player', PcmPlayerProcessor);
