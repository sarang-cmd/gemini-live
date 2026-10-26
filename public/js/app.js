/**
 * Halo — application controller.
 *
 * Owns the DOM, the settings, the conversation state machine and the wiring
 * between the audio engine, the orb and whichever session transport is active.
 */
import { VOICES, DEFAULT_VOICE } from '../shared/voices.js';
import { MODELS, DEFAULT_MODEL } from '../shared/models.js';
import { AudioEngine } from '../shared/audio.js';
import { Orb } from './orb.js';
import { DirectSession, ProxySession } from '../shared/session.js';
import { DemoSession } from './demo.js';
import { createStateMachine, STATES, stateLabel, stateHint } from '../shared/state.js';
import { liveSocketUrl, buildSetupMessage, functionDeclaration } from '../shared/protocol.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'halo.settings.v1';

const STATE_HUES = {
  idle: 232,
  connecting: 200,
  listening: 186,
  thinking: 272,
  speaking: 330,
  error: 6,
};

const PERSONAS = [
  {
    id: 'assistant',
    label: 'Assistant',
    text:
      'You are Halo, a warm and quick voice assistant. Keep answers to one or two short sentences unless the user asks for detail. Speak numbers and symbols as words, never read markdown, bullet lists or raw URLs.',
  },
  {
    id: 'concise',
    label: 'Concise',
    text:
      'You are Halo. Be extremely concise — one sentence answers, no preamble, no pleasantries. If you do not know something, say so in five words or fewer.',
  },
  {
    id: 'storyteller',
    label: 'Storyteller',
    text:
      'You are Halo, a relaxed storyteller. Speak in vivid, flowing sentences with a warm pace. Paint a picture with words rather than listing facts.',
  },
  {
    id: 'butler',
    label: 'Butler',
    text:
      'You are Halo, a discreet butler. Formal, courteous and precise. "Certainly." "Right away." Never use slang.',
  },
  {
    id: 'coach',
    label: 'Coach',
    text:
      'You are Halo, an encouraging coach. Be direct, practical and motivating. Suggest the next concrete step rather than listing options.',
  },
];

const PREVIEW_LINE = 'Hello. This is a quick sample of how I sound. Anything I can help you with?';

const DEFAULT_SETTINGS = {
  transport: 'auto',
  apiKey: '',
  model: DEFAULT_MODEL,
  voice: DEFAULT_VOICE,
  systemInstruction: PERSONAS[0].text,
  handsFree: true,
  googleSearch: false,
  affectiveDialog: false,
  proactiveAudio: false,
  vad: { prefixPaddingMs: 300, silenceDurationMs: 600 },
};

/* ------------------------------------------------------------------ state */

const runtime = {
  session: null,
  previewSession: null,
  micOn: false,
  serverHasKey: false,
  transport: 'demo',
  stopping: false,
  reconnects: 0,
  entries: [],
  partials: { user: null, assistant: null },
};

const settings = loadSettings();

const orb = new Orb($('orb'));
const engine = new AudioEngine({
  onAudio: (base64) => runtime.session?.sendAudio(base64),
  onInputLevel: (level) => orb.setLevels({ input: level }),
  onOutputLevel: (level) => orb.setLevels({ output: level }),
  onError: (message) => showBanner(message, 'warn'),
});

const machine = createStateMachine((next) => {
  orb.setState(next);
  $('status').dataset.state = next;
  $('status-text').textContent = stateLabel(next);
  $('stage-title').textContent = next === STATES.IDLE ? 'Halo' : stateLabel(next);
  $('stage-hint').textContent = stateHint(next, {
    handsFree: settings.handsFree,
    muted: !runtime.micOn && next === STATES.LISTENING,
  });
  document.documentElement.style.setProperty('--accent-h', STATE_HUES[next] ?? 232);
  $('btn-talk').classList.toggle('is-live', next !== STATES.IDLE && next !== STATES.ERROR);
  $('btn-mute').hidden = next === STATES.IDLE || next === STATES.ERROR;
  updateTalkButton();
});

/* -------------------------------------------------------------- settings */

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      vad: { ...DEFAULT_SETTINGS.vad, ...(parsed.vad || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage may be unavailable in private mode */
  }
}

/* ------------------------------------------------------------------- ui  */

function toast(message, ms = 2600) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

function showBanner(message, kind = 'warn') {
  const el = $('banner');
  if (!message) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.dataset.kind = kind;
  el.innerHTML = message;
}

function buildModelOptions() {
  const select = $('set-model');
  select.innerHTML = '';
  for (const model of MODELS) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    select.appendChild(option);
  }
  select.value = settings.model;
  $('model-hint').textContent = MODELS.find((m) => m.id === settings.model)?.note || '';
  select.onchange = () => {
    settings.model = select.value;
    $('model-hint').textContent = MODELS.find((m) => m.id === settings.model)?.note || '';
    saveSettings();
    if (runtime.session) restartSession('Model changed — reconnecting…');
  };
}

function buildVoiceOptions() {
  const select = $('set-voice');
  select.innerHTML = '';
  for (const voice of VOICES) {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} — ${voice.descriptor}`;
    select.appendChild(option);
  }
  select.value = settings.voice;
  select.onchange = () => selectVoice(select.value);
}

function buildVoiceGrid() {
  const grid = $('voice-grid');
  grid.innerHTML = '';
  for (const voice of VOICES) {
    const card = document.createElement('div');
    card.className = `voice-card${voice.name === settings.voice ? ' is-active' : ''}`;
    card.dataset.voice = voice.name;
    card.innerHTML = `
      <div class="voice-name">
        <span class="voice-chip" style="background:hsl(${voice.hue} 85% 62%)"></span>${voice.name}
      </div>
      <div class="voice-meta">${voice.descriptor} · ${voice.gender}</div>
      <button class="voice-preview" type="button">Preview</button>`;

    card.addEventListener('click', (event) => {
      if (event.target.closest('.voice-preview')) return;
      selectVoice(voice.name);
    });
    card.querySelector('.voice-preview').addEventListener('click', (event) => {
      event.stopPropagation();
      previewVoice(voice.name);
    });

    grid.appendChild(card);
  }
}

function buildPersonaChips() {
  const chips = $('persona-chips');
  chips.innerHTML = '';
  for (const persona of PERSONAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = persona.label;
    chip.addEventListener('click', () => {
      settings.systemInstruction = persona.text;
      $('set-instruction').value = persona.text;
      saveSettings();
      toast(`Personality: ${persona.label}`);
      if (runtime.session) restartSession('Personality changed — reconnecting…');
    });
    chips.appendChild(chip);
  }
}

function syncSettingsUi() {
  $('set-transport').value = settings.transport;
  $('set-api-key').value = settings.apiKey;
  $('set-model').value = settings.model;
  $('set-voice').value = settings.voice;
  $('set-instruction').value = settings.systemInstruction;
  $('set-handsfree').checked = settings.handsFree;
  $('set-search').checked = settings.googleSearch;
  $('set-affective').checked = settings.affectiveDialog;
  $('set-proactive').checked = settings.proactiveAudio;
  $('set-silence').value = settings.vad.silenceDurationMs;
  $('set-prefix').value = settings.vad.prefixPaddingMs;
  $('silence-value').textContent = settings.vad.silenceDurationMs;
  $('prefix-value').textContent = settings.vad.prefixPaddingMs;
  updateTransportHint();
}

function updateTransportHint() {
  const hints = {
    auto: runtime.serverHasKey
      ? 'Using the server-side API key to mint an ephemeral token.'
      : 'No server key found — falling back to demo mode until you add one.',
    token: 'The server mints a short-lived token; your API key never reaches the browser.',
    key: 'The key stays in this browser and is sent straight to Google.',
    proxy: 'All traffic is relayed through the server — useful on restricted networks.',
    demo: 'A local simulator. No network, no tokens, no cost.',
  };
  $('transport-hint').textContent = hints[settings.transport] || '';
}

/* ------------------------------------------------------------ transcript */

function mergeText(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  // The API streams incrementally, but guard against cumulative frames too.
  if (incoming.startsWith(existing)) return incoming;
  return existing + incoming;
}

function addTranscript(role, text, finished) {
  if (!text && !finished) return;

  let entry = runtime.partials[role];
  if (!entry) {
    entry = { role, text: '', partial: true };
    runtime.entries.push(entry);
    runtime.partials[role] = entry;
  }

  entry.text = mergeText(entry.text, text);
  if (finished) {
    entry.partial = false;
    runtime.partials[role] = null;
  }

  renderTranscript();
}

function renderTranscript() {
  const container = $('transcript');
  if (!runtime.entries.length) {
    container.innerHTML =
      '<p class="transcript-empty">Nothing yet. Start talking and the transcript shows up here.</p>';
    return;
  }

  container.innerHTML = runtime.entries
    .filter((entry) => entry.text.trim().length)
    .map(
      (entry) => `
        <div class="turn ${entry.role}${entry.partial ? ' partial' : ''}">
          <div class="turn-role">${entry.role === 'user' ? 'You' : 'Halo'}</div>
          <div class="turn-text">${escapeHtml(entry.text)}</div>
        </div>`,
    )
    .join('');

  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/* --------------------------------------------------------------- session */

function resolveTransport() {
  const preference = settings.transport;
  if (preference === 'demo') return 'demo';
  if (preference === 'token' && runtime.serverHasKey) return 'token';
  if (preference === 'proxy' && runtime.serverHasKey) return 'proxy';
  if (preference === 'key' && settings.apiKey) return 'key';

  if (preference === 'token' || preference === 'proxy') return 'demo';
  if (preference === 'key') return 'demo';

  if (runtime.serverHasKey) return 'token';
  if (settings.apiKey) return 'key';
  return 'demo';
}

function buildTools() {
  if (settings.googleSearch) return [{ googleSearch: {} }];
  return [
    {
      functionDeclarations: [
        functionDeclaration({
          name: 'get_current_datetime',
          description:
            'Return the current date and time for the user, including the day of the week and their time zone.',
          parameters: { type: 'object', properties: {} },
        }),
      ],
    },
  ];
}

function buildSetup(voice) {
  return buildSetupMessage({
    model: settings.model,
    voice,
    systemInstruction: settings.systemInstruction,
    tools: buildTools(),
    vad: settings.vad,
    affectiveDialog: settings.affectiveDialog,
    proactiveAudio: settings.proactiveAudio,
  });
}

async function createSession({ voice = settings.voice } = {}) {
  const transport = resolveTransport();
  runtime.transport = transport;

  if (transport === 'demo') {
    const demo = new DemoSession();
    return demo;
  }

  if (transport === 'proxy') {
    const response = await fetch('/api/proxy/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        voice,
        systemInstruction: settings.systemInstruction,
        tools: buildTools(),
        vad: settings.vad,
        affectiveDialog: settings.affectiveDialog,
        proactiveAudio: settings.proactiveAudio,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not open a proxy session.');
    return new ProxySession({ sessionId: data.id });
  }

  let token = null;
  let apiKey = null;

  if (transport === 'token') {
    const response = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: settings.model }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Could not mint an ephemeral token.');
    }
    token = data.token;
  } else {
    apiKey = settings.apiKey;
    if (!apiKey) throw new Error('Add a Gemini API key in Settings first.');
  }

  return new DirectSession({
    url: liveSocketUrl({ token, apiKey }),
    setup: buildSetup(voice),
  });
}

function wireSession(session, { preview = false } = {}) {
  session.on('setup_complete', () => {
    if (!preview) {
      machine.set(STATES.LISTENING);
      if (runtime.transport !== 'demo') toast('Live session ready');
    }
  });

  session.on('audio', ({ data }) => {
    engine.enqueueBase64(data).catch(() => {});
    if (preview) machine.reset(STATES.SPEAKING);
  });

  session.on('input_transcript', ({ text, finished }) => {
    addTranscript('user', text, finished);
  });

  session.on('output_transcript', ({ text, finished }) => {
    addTranscript('assistant', text, finished);
  });

  session.on('interrupted', () => {
    engine.flush();
    if (machine.is(STATES.SPEAKING, STATES.THINKING)) machine.set(STATES.LISTENING);
  });

  session.on('turn_complete', () => {
    if (preview) {
      machine.reset(STATES.IDLE);
      return;
    }
    if (!machine.is(STATES.IDLE, STATES.ERROR)) machine.set(STATES.LISTENING);
  });

  session.on('tool_call', ({ calls }) => handleToolCalls(calls, session));

  session.on('usage', ({ usage }) => {
    const total = usage?.totalTokenCount;
    if (total) $('status-text').title = `${total} tokens used this session`;
  });

  session.on('error', ({ message }) => {
    showBanner(escapeHtml(message));
    if (!preview) machine.set(STATES.ERROR);
  });

  session.on('go_away', () => {
    if (!preview) showBanner('Gemini is wrapping this session up — reconnecting…', 'info');
  });

  session.on('closed', async () => {
    if (preview) return;
    // A session we deliberately stopped is no longer the active one.
    if (runtime.session !== session) return;
    if (!machine.is(STATES.LISTENING, STATES.THINKING, STATES.SPEAKING, STATES.CONNECTING)) {
      return;
    }

    runtime.session = null;
    machine.set(STATES.IDLE);
    runtime.reconnects += 1;

    if (runtime.reconnects > 2) {
      showBanner('The Live session ended. Tap the mic to start another one.');
      return;
    }

    showBanner('The session dropped — reconnecting…', 'info');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    if (!runtime.session && !runtime.stopping) await startSession();
  });

  session.on('notice', ({ message }) => showBanner(escapeHtml(message), 'info'));
}

async function handleToolCalls(calls, session) {
  const responses = [];
  for (const call of calls || []) {
    let result = { ok: false };
    if (call.name === 'get_current_datetime') {
      const now = new Date();
      result = {
        ok: true,
        date: now.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        iso: now.toISOString(),
      };
    }
    responses.push({ id: call.id, name: call.name, result });
  }
  (session || runtime.session)?.sendToolResponse(responses);
}

async function startSession({ simulate = true } = {}) {
  if (runtime.session) return;
  machine.set(STATES.CONNECTING);
  showBanner('');

  try {
    const session = await createSession();
    wireSession(session);
    await session.start();
    runtime.session = session;
    runtime.reconnects = 0;

    if (runtime.transport === 'demo') {
      if (settings.transport !== 'demo') {
        showBanner(
          'That connection needs a Gemini API key, so Halo fell back to the built-in demo. Add one in <strong>Settings</strong>.',
          'warn',
        );
      }
      addTranscript(
        'assistant',
        'Demo mode is on — add a Gemini API key in Settings to talk for real.',
        true,
      );
      if (simulate) session.simulateUserTurn?.();
    } else {
      await startMic();
    }
    machine.set(STATES.LISTENING);
  } catch (err) {
    machine.set(STATES.ERROR);
    showBanner(escapeHtml(err.message || 'Could not start the session.'));
  }
}

async function stopSession() {
  const session = runtime.session;
  runtime.session = null;
  runtime.stopping = true;
  runtime.micOn = false;
  if (session) await session.stop();
  engine.stopCapture();
  engine.flush();
  machine.reset(STATES.IDLE);
  runtime.stopping = false;
}

async function restartSession(message) {
  await stopSession();
  toast(message);
  await startSession();
}

async function startMic() {
  if (runtime.micOn) return;
  try {
    await engine.startCapture();
    runtime.micOn = true;
  } catch {
    runtime.micOn = false;
  }
}

function stopMic() {
  if (!runtime.micOn) return;
  runtime.micOn = false;
  engine.stopCapture();
}

/* ----------------------------------------------------------------- voice */

function selectVoice(name) {
  if (!name || name === settings.voice) return;
  settings.voice = name;
  saveSettings();
  buildVoiceOptions();
  buildVoiceGrid();
  toast(`Voice: ${name}`);
  if (runtime.session) restartSession(`Switched to ${name} — reconnecting…`);
}

async function previewVoice(name) {
  if (runtime.previewSession) {
    toast('A preview is already playing.');
    return;
  }
  if (runtime.session) {
    toast('Stop the conversation to preview voices.');
    return;
  }

  const buttons = document.querySelectorAll('.voice-preview');
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const session = await createSession({ voice: name });
    runtime.previewSession = session;
    wireSession(session, { preview: true });
    await session.start();
    session.sendText(PREVIEW_LINE);
    toast(`Previewing ${name}…`);

    setTimeout(async () => {
      await session.stop();
      runtime.previewSession = null;
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }, 9000);
  } catch (err) {
    runtime.previewSession = null;
    buttons.forEach((button) => {
      button.disabled = false;
    });
    showBanner(escapeHtml(err.message || 'Could not preview that voice.'));
  }
}

/* --------------------------------------------------------------- controls */

function updateTalkButton() {
  const button = $('btn-talk');
  if (!runtime.session) {
    button.setAttribute('aria-label', 'Start a conversation with Halo');
    return;
  }
  button.setAttribute(
    'aria-label',
    settings.handsFree ? 'Stop the conversation' : 'Hold to talk',
  );
}

function wireControls() {
  const talk = $('btn-talk');

  talk.addEventListener('pointerdown', async () => {
    if (!runtime.session) {
      await startSession();
      return;
    }
    if (runtime.transport === 'demo') {
      runtime.session.simulateUserTurn?.();
      return;
    }
    if (settings.handsFree) {
      await stopSession();
      return;
    }
    await startMic();
  });

  const release = async () => {
    if (runtime.session && !settings.handsFree && runtime.micOn) {
      stopMic();
      runtime.session.endAudioStream();
    }
  };
  talk.addEventListener('pointerup', release);
  talk.addEventListener('pointerleave', release);
  talk.addEventListener('pointercancel', release);

  $('btn-mute').addEventListener('click', () => {
    if (runtime.micOn) {
      stopMic();
      $('btn-mute').textContent = 'Unmute';
    } else {
      startMic().then(() => {
        $('btn-mute').textContent = 'Mute';
      });
    }
  });

  $('composer').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('composer-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    if (!runtime.session) {
      addTranscript('user', text, true);
      await startSession({ simulate: false });
    }
    runtime.session?.sendText(text);
  });

  // Space bar = push to talk.
  let spaceHeld = false;
  window.addEventListener('keydown', async (event) => {
    if (event.code !== 'Space' || spaceHeld) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    spaceHeld = true;
    event.preventDefault();
    if (!runtime.session) await startSession();
    else if (!settings.handsFree) await startMic();
  });
  window.addEventListener('keyup', async () => {
    if (!spaceHeld) return;
    spaceHeld = false;
    if (runtime.session && !settings.handsFree && runtime.micOn) {
      stopMic();
      runtime.session.endAudioStream();
    }
  });

  // Tabs
  document.querySelectorAll('.panel-tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.panel-tabs button').forEach((tab) => {
        tab.classList.toggle('is-active', tab === button);
      });
      document.querySelectorAll('[data-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== button.dataset.tab;
      });
    });
  });

  $('btn-voices').addEventListener('click', () => {
    document.querySelector('.panel-tabs button[data-tab="voices"]').click();
  });
  $('btn-settings').addEventListener('click', () => {
    document.querySelector('.panel-tabs button[data-tab="settings"]').click();
  });

  // Settings
  $('set-transport').addEventListener('change', (event) => {
    settings.transport = event.target.value;
    saveSettings();
    updateTransportHint();
  });

  $('set-api-key').addEventListener('change', (event) => {
    settings.apiKey = event.target.value.trim();
    saveSettings();
    updateTransportHint();
    toast(settings.apiKey ? 'API key saved in this browser' : 'API key cleared');
  });

  $('set-handsfree').addEventListener('change', (event) => {
    settings.handsFree = event.target.checked;
    saveSettings();
    updateTalkButton();
  });

  $('set-search').addEventListener('change', (event) => {
    settings.googleSearch = event.target.checked;
    saveSettings();
    if (runtime.session) restartSession('Tools changed — reconnecting…');
  });

  $('set-affective').addEventListener('change', (event) => {
    settings.affectiveDialog = event.target.checked;
    saveSettings();
    if (runtime.session) restartSession('Affective dialogue changed — reconnecting…');
  });

  $('set-proactive').addEventListener('change', (event) => {
    settings.proactiveAudio = event.target.checked;
    saveSettings();
    if (runtime.session) restartSession('Proactive audio changed — reconnecting…');
  });

  $('set-instruction').addEventListener('input', (event) => {
    settings.systemInstruction = event.target.value;
    saveSettings();
  });

  $('set-silence').addEventListener('input', (event) => {
    settings.vad.silenceDurationMs = Number(event.target.value);
    $('silence-value').textContent = event.target.value;
    saveSettings();
  });

  $('set-prefix').addEventListener('input', (event) => {
    settings.vad.prefixPaddingMs = Number(event.target.value);
    $('prefix-value').textContent = event.target.value;
    saveSettings();
  });

  $('btn-reset').addEventListener('click', () => {
    Object.assign(settings, { ...DEFAULT_SETTINGS, vad: { ...DEFAULT_SETTINGS.vad } });
    saveSettings();
    syncSettingsUi();
    buildModelOptions();
    buildVoiceOptions();
    buildVoiceGrid();
    toast('Settings reset');
  });

  window.addEventListener('beforeunload', () => {
    runtime.session?.stop();
  });

  // Safari only lets an AudioContext start inside a user gesture, so warm the
  // contexts up on the very first interaction.
  window.addEventListener(
    'pointerdown',
    () => {
      engine.warmup().catch(() => {});
    },
    { once: true },
  );
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  orb.start();
  buildModelOptions();
  buildVoiceOptions();
  buildVoiceGrid();
  buildPersonaChips();
  syncSettingsUi();
  wireControls();
  updateTalkButton();
  renderTranscript();

  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const config = await response.json();
      runtime.serverHasKey = !!config.hasServerKey;
    }
  } catch {
    /* the app still works in demo mode */
  }

  updateTransportHint();

  if (!runtime.serverHasKey && !settings.apiKey) {
    showBanner(
      'No Gemini API key yet — running the built-in demo. Add a key in <strong>Settings</strong> (or a <code>GEMINI_API_KEY</code> in the server <code>.env</code>) to talk for real.',
      'info',
    );
  }
}

boot();
