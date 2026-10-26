/**
 * Microphone capture and speaker playback for the renderer.
 *
 * Capture : mic -> AudioWorklet -> 16 kHz PCM16 -> WAV (for Groq Whisper)
 * Playback: 24 kHz PCM16 -> AudioWorklet ring buffer (Gemini native audio)
 *           WAV bytes -> decodeAudioData (Groq Orpheus speech)
 */
import captureUrl from '../../shared/worklets/pcm-capture.js?url';
import playerUrl from '../../shared/worklets/pcm-player.js?url';

import { base64ToInt16, int16ToWav } from '../../shared/pcm.js';

let captureContext: AudioContext | null = null;
let playContext: AudioContext | null = null;
let playerNode: AudioWorkletNode | null = null;

function createContext(rate: number): AudioContext {
  try {
    return new AudioContext({ sampleRate: rate, latencyHint: 'interactive' });
  } catch {
    return new AudioContext({ latencyHint: 'interactive' });
  }
}

async function captureCtx(): Promise<AudioContext> {
  if (!captureContext) {
    captureContext = createContext(16000);
    await captureContext.audioWorklet.addModule(captureUrl);
  }
  if (captureContext.state === 'suspended') {
    try {
      await captureContext.resume();
    } catch {
      /* the next gesture retries */
    }
  }
  return captureContext;
}

async function playCtx(): Promise<AudioContext> {
  if (!playContext) {
    playContext = createContext(24000);
    await playContext.audioWorklet.addModule(playerUrl);
  }
  if (playContext.state === 'suspended') {
    try {
      await playContext.resume();
    } catch {
      /* the next gesture retries */
    }
  }
  return playContext;
}

/** Unlock the audio contexts — browsers require a gesture first. */
export async function warmupAudio(): Promise<void> {
  try {
    await captureCtx();
  } catch {
    /* ignore */
  }
  try {
    await playCtx();
  } catch {
    /* ignore */
  }
}

export interface Recording {
  /** 16 kHz mono PCM16. */
  samples: Int16Array;
  /** The same audio wrapped in a WAV container. */
  wav: ArrayBuffer;
  /** Seconds of audio. */
  duration: number;
}

/**
 * Record from the microphone until `stop()` is called.
 */
export class Microphone {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private chunks: Int16Array[] = [];

  onLevel: (level: number) => void = () => {};

  async start(): Promise<void> {
    if (this.node) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const context = await captureCtx();
    this.context = context;

    const source = context.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(context, 'pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { targetRate: 16000 },
    });

    node.port.onmessage = (event) => {
      const message = event.data;
      if (!message) return;
      if (message.type === 'audio' && message.pcm) {
        this.onLevel(message.level || 0);
        this.chunks.push(new Int16Array(message.pcm));
      }
    };

    const sink = context.createGain();
    sink.gain.value = 0;

    source.connect(node);
    node.connect(sink);
    sink.connect(context.destination);

    this.source = source;
    this.node = node;
    this.sink = sink;
    this.chunks = [];
  }

  /** Stop and return everything that was captured. */
  async stop(): Promise<Recording> {
    const chunks = this.chunks;
    this.chunks = [];

    this.node?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.node = null;
    this.source = null;
    this.sink = null;
    this.stream = null;

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Int16Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const wav = int16ToWav(samples, 16000);

    return { samples, wav, duration: total / 16000 };
  }

  get recording(): boolean {
    return this.node !== null;
  }
}

/** Queue base64 encoded 24 kHz PCM for playback (Gemini native audio). */
export async function playPcm(base64: string): Promise<void> {
  const context = await playCtx();

  if (!playerNode) {
    const node = new AudioWorkletNode(context, 'pcm-player', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { sourceRate: 24000 },
    });
    node.connect(context.destination);
    playerNode = node;
  }

  const int16 = base64ToInt16(base64);
  const copy = new Int16Array(int16);
  playerNode.port.postMessage({ type: 'pcm', buffer: copy.buffer }, [copy.buffer]);
}

/** Drop everything that has not been played yet (barge-in). */
export function flushAudio(): void {
  playerNode?.port.postMessage({ type: 'flush' });
}

/** Play a WAV file (Groq Orpheus speech). Resolves when it finished. */
export async function playWav(bytes: ArrayBuffer): Promise<void> {
  const context = await playCtx();
  const buffer = await context.decodeAudioData(bytes.slice(0));
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  await new Promise<void>((resolve) => {
    source.onended = () => resolve();
    source.start();
  });
}
