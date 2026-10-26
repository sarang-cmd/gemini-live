/**
 * Wire protocol for the Gemini Live API (v1beta WebSocket).
 *
 * Imported by BOTH the browser client and the Node proxy server so the two
 * dialects can never drift apart.
 *
 * Frame shapes are documented at https://ai.google.dev/api/live
 */

export const LIVE_API_ORIGIN = 'generativelanguage.googleapis.com';
export const LIVE_API_VERSION = 'v1beta';

export const AUDIO_IN_MIME = 'audio/pcm;rate=16000';
export const AUDIO_OUT_MIME = 'audio/pcm;rate=24000';

/** Default VAD tuning. 500–800 ms silence keeps utterances in one piece. */
export const DEFAULT_VAD = Object.freeze({
  prefixPaddingMs: 300,
  silenceDurationMs: 600,
});

/**
 * WebSocket endpoint for a Live session.
 *
 * - Ephemeral tokens use the `Constrained` service and an `access_token` query param.
 * - Plain API keys use the regular service and a `key` query param.
 */
export function liveSocketUrl({ token, apiKey } = {}) {
  const base =
    `wss://${LIVE_API_ORIGIN}/ws/google.ai.generativelanguage.${LIVE_API_VERSION}` +
    '.GenerativeService.';

  if (token) {
    return `${base}BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
  }
  if (apiKey) {
    return `${base}BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
  }
  throw new Error('An ephemeral token or an API key is required to open a Live session.');
}

/**
 * Build the `setup` frame that opens a session.
 *
 * Voice, modality and system instruction are immutable for the lifetime of a
 * session — changing any of them requires a new session.
 */
export function buildSetupMessage(options = {}) {
  const {
    model,
    voice = 'Puck',
    systemInstruction = '',
    temperature = 1,
    tools = [],
    inputTranscription = true,
    outputTranscription = true,
    vad = {},
    affectiveDialog = false,
    proactiveAudio = false,
    sessionResumption = true,
    thinkingLevel = null,
  } = options;

  if (!model) throw new Error('A model is required to open a Live session.');

  const setup = {
    model: model.startsWith('models/') ? model : `models/${model}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(tools && tools.length ? { tools } : {}),
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
        prefixPaddingMs: vad.prefixPaddingMs ?? DEFAULT_VAD.prefixPaddingMs,
        silenceDurationMs: vad.silenceDurationMs ?? DEFAULT_VAD.silenceDurationMs,
      },
    },
    ...(inputTranscription ? { inputAudioTranscription: {} } : {}),
    ...(outputTranscription ? { outputAudioTranscription: {} } : {}),
    ...(sessionResumption ? { sessionResumption: {} } : {}),
    ...(affectiveDialog ? { enableAffectiveDialog: true } : {}),
    ...(proactiveAudio ? { proactivity: { proactiveAudio: true } } : {}),
  };

  return { setup };
}

/** Realtime audio frame (raw PCM16, 16 kHz, base64 encoded). */
export function buildAudioMessage(base64) {
  return {
    realtimeInput: {
      audio: { mimeType: AUDIO_IN_MIME, data: base64 },
    },
  };
}

/** Realtime text frame — the model answers in its configured voice. */
export function buildTextMessage(text) {
  return { realtimeInput: { text } };
}

/**
 * Flush the server-side audio buffer so the current turn is finalised now.
 * Used when the user releases the push-to-talk button.
 */
export function buildAudioStreamEndMessage() {
  return { realtimeInput: { audioStreamEnd: true } };
}

/** Answer a tool call the model requested. */
export function buildToolResponseMessage(responses) {
  return {
    toolResponse: {
      functionResponses: responses.map((r) => ({
        id: r.id,
        name: r.name,
        response: { result: r.result },
      })),
    },
  };
}

/** Function declaration for a client-executed tool. */
export function functionDeclaration({ name, description, parameters }) {
  return {
    name,
    description,
    parameters: parameters || { type: 'object', properties: {} },
  };
}

/**
 * Normalise a raw server frame into zero or more UI-level events.
 *
 * A single server frame can carry audio *and* transcriptions at the same time,
 * so every branch is checked independently.
 */
export function parseServerMessage(message) {
  const events = [];
  if (!message || typeof message !== 'object') return events;

  if (message.setupComplete) {
    events.push({ type: 'setup_complete' });
  }

  const serverContent = message.serverContent;
  if (serverContent) {
    if (serverContent.interrupted) {
      events.push({ type: 'interrupted' });
    }
    if (serverContent.turnComplete) {
      events.push({ type: 'turn_complete' });
    }
    if (serverContent.inputTranscription) {
      events.push({
        type: 'input_transcript',
        text: serverContent.inputTranscription.text || '',
        finished: !!serverContent.inputTranscription.finished,
      });
    }
    if (serverContent.outputTranscription) {
      events.push({
        type: 'output_transcript',
        text: serverContent.outputTranscription.text || '',
        finished: !!serverContent.outputTranscription.finished,
      });
    }

    const parts = serverContent.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        events.push({
          type: 'audio',
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || AUDIO_OUT_MIME,
        });
      }
    }

    if (serverContent.interactionStatus) {
      events.push({ type: 'interaction_status', status: serverContent.interactionStatus });
    }
  }

  if (message.toolCall?.functionCalls?.length) {
    events.push({ type: 'tool_call', calls: message.toolCall.functionCalls });
  }
  if (message.toolCallCancellation?.ids?.length) {
    events.push({ type: 'tool_cancelled', ids: message.toolCallCancellation.ids });
  }
  if (message.usageMetadata) {
    events.push({ type: 'usage', usage: message.usageMetadata });
  }
  if (message.sessionResumptionUpdate) {
    events.push({ type: 'resumption', update: message.sessionResumptionUpdate });
  }
  if (message.goAway) {
    events.push({ type: 'go_away', goAway: message.goAway });
  }
  if (message.error) {
    events.push({ type: 'error', message: message.error.message || 'Unknown Live API error' });
  }

  return events;
}
