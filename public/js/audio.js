/**
 * AudioEngine — microphone capture and speaker playback for the Live API.
 *
 * Capture : mic -> AudioWorklet -> 16 kHz PCM16 (+ RMS level)
 * Playback: 24 kHz PCM16 -> AudioWorklet ring buffer -> speakers (+ RMS level)
 *
 * Both sides use transferable ArrayBuffers so no audio is ever copied twice.
 */

import { base64ToInt16, int16ToBase64 } from './pcm.js';

const CAPTURE_WORKLET = '/worklets/pcm-capture.js';
const PLAYER_WORKLET = '/worklets/pcm-player.js';

export class AudioEngine {
  constructor({ onAudio, onInputLevel, onOutputLevel, onError } = {}) {
    this.onAudio = onAudio || (() => {});
    this.onInputLevel = onInputLevel || (() => {});
    this.onOutputLevel = onOutputLevel || (() => {});
    this.onError = onError || (() => {});

    this.captureContext = null;
    this.playContext = null;
    this.stream = null;
    this.captureNode = null;
    this.playerNode = null;
    this.captureSource = null;
    this.silentSink = null;
    this.capturing = false;
    this.playing = false;
  }

  static get supported() {
    return (
      typeof AudioWorkletNode !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  /** Create an AudioContext, preferring the requested rate but never failing on it. */
  static _createContext(rate) {
    try {
      return new AudioContext({ sampleRate: rate, latencyHint: 'interactive' });
    } catch {
      return new AudioContext({ latencyHint: 'interactive' });
    }
  }

  async _ensureCaptureContext() {
    if (this.captureContext) return this.captureContext;
    const ctx = AudioEngine._createContext(16000);
    await ctx.audioWorklet.addModule(CAPTURE_WORKLET);
    this.captureContext = ctx;
    return ctx;
  }

  async _ensurePlayContext() {
    if (this.playContext) return this.playContext;
    const ctx = AudioEngine._createContext(24000);
    await ctx.audioWorklet.addModule(PLAYER_WORKLET);
    this.playContext = ctx;
    return ctx;
  }

  /** Browsers only allow playback after a user gesture. */
  async resumePlayback() {
    if (!this.playContext) return;
    if (this.playContext.state === 'suspended') {
      try {
        await this.playContext.resume();
      } catch {
        /* ignore — the next gesture will retry */
      }
    }
  }

  /**
   * Create both audio contexts and resume them.
   *
   * Safari refuses to start an AudioContext that was created outside a user
   * gesture, so the app calls this on the first pointer down.
   */
  async warmup() {
    if (!AudioEngine.supported) return;
    await this._ensureCaptureContext().catch(() => null);
    await this._ensurePlayContext().catch(() => null);
    await this.resumePlayback();
    if (this.captureContext?.state === 'suspended') {
      try {
        await this.captureContext.resume();
      } catch {
        /* ignore */
      }
    }
  }

  /** Open the microphone and start producing 16 kHz PCM chunks. */
  async startCapture() {
    if (this.capturing) return;
    if (!AudioEngine.supported) {
      this.onError('This browser does not support the Web Audio worklets Halo needs.');
      throw new Error('AudioWorklet unsupported');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err) {
      const message =
        err && err.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : 'No microphone is available.';
      this.onError(message);
      throw new Error(message);
    }

    const ctx = await this._ensureCaptureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }

    const source = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, 'pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { targetRate: 16000 },
    });

    node.port.onmessage = (event) => {
      const message = event.data;
      if (!message) return;
      if (message.type === 'audio' && message.pcm) {
        this.onInputLevel(message.level || 0);
        this.onAudio(int16ToBase64(message.pcm));
      }
    };

    // The worklet needs to be pulled by the graph; a muted sink keeps it alive
    // without creating a feedback loop.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);

    this.captureSource = source;
    this.captureNode = node;
    this.silentSink = sink;
    this.capturing = true;
  }

  /** Queue base64 encoded 24 kHz PCM for playback. */
  async enqueueBase64(base64) {
    if (!this.playerNode) {
      const ctx = await this._ensurePlayContext();
      const node = new AudioWorkletNode(ctx, 'pcm-player', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { sourceRate: 24000 },
      });
      node.port.onmessage = (event) => {
        const message = event.data;
        if (message && message.type === 'level') {
          this.onOutputLevel(message.level || 0);
        }
      };
      node.connect(ctx.destination);
      this.playerNode = node;
      this.playing = true;
    }

    await this.resumePlayback();

    const int16 = base64ToInt16(base64);
    const copy = new Int16Array(int16);
    this.playerNode.port.postMessage({ type: 'pcm', buffer: copy.buffer }, [copy.buffer]);
  }

  /** Throw away everything that has not been played yet (barge-in). */
  flush() {
    if (this.playerNode) {
      this.playerNode.port.postMessage({ type: 'flush' });
    }
  }

  /** Stop capturing but keep the session alive. */
  stopCapture() {
    this.capturing = false;
    if (this.captureSource) {
      try {
        this.captureSource.disconnect();
      } catch {
        /* ignore */
      }
      this.captureSource = null;
    }
    if (this.captureNode) {
      try {
        this.captureNode.disconnect();
      } catch {
        /* ignore */
      }
      this.captureNode = null;
    }
    if (this.silentSink) {
      try {
        this.silentSink.disconnect();
      } catch {
        /* ignore */
      }
      this.silentSink = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /** Tear everything down. */
  async stopAll() {
    this.stopCapture();
    this.flush();
    if (this.captureContext) {
      try {
        await this.captureContext.close();
      } catch {
        /* ignore */
      }
      this.captureContext = null;
    }
    if (this.playContext) {
      try {
        await this.playContext.close();
      } catch {
        /* ignore */
      }
      this.playContext = null;
    }
    this.playerNode = null;
    this.playing = false;
  }
}
