# Halo — Siri-style voice assistant on the Gemini Live API

**Implementation plan** · repo `sarang-cmd/gemini-live` · status: **executed** · 75 tests green
· phase 1: the web app (50 tests) · phase 2: the Electron desktop app (25 more tests)

---

## 1. Goal

Build a browser-based, always-there voice assistant in the spirit of Siri:

- You talk to it, it talks back — no push-to-talk round trips, no "waiting for the model".
- A living orb that reflects what the assistant is doing (idle → listening → thinking → speaking).
- Pick any of Google's **30 prebuilt Gemini voices** and hear the difference instantly.
- Runs on the **Gemini Live API** (`gemini-3.8-live`, native audio, 24 kHz PCM out / 16 kHz PCM in).

Non-goals for v1: mobile native apps, account system, long-term memory persistence, TTS cloning.

## 2. Constraints discovered during research

| Constraint | Consequence for the design |
|---|---|
| Live API is **WebSocket-only**, no HTTP streaming | Browser must speak the raw WS protocol (JSON + base64 PCM). |
| Audio is **raw PCM16**, 16 kHz in / 24 kHz out — no WAV headers, no codecs | `AudioWorklet` capture + ring-buffer player are mandatory; `<audio>` elements cannot be used. |
| **Native-audio models only return `AUDIO`** | Text transcript must come from `inputAudioTranscription` / `outputAudioTranscription`. |
| Voice / modality / system instruction are **fixed at setup** | Changing the voice = new session. The UI must say so. |
| **15 min** max session, 128k context | Session resumption (`sessionResumption: {}`) + reconnect logic. |
| Client-to-server auth needs **ephemeral tokens** (`v1beta` only) | Server mints short-lived tokens; the API key never reaches the browser. |
| VAD `silenceDurationMs` < 500 ms fragments utterances | Default to 600 ms silence / 300 ms prefix padding. |

Sources: [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities),
[ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens),
[TTS voices](https://ai.google.dev/gemini-api/docs/speech-generation),
[official vanilla-JS example](https://github.com/google-gemini/gemini-live-api-examples/tree/main/gemini-live-ephemeral-tokens-websocket).

## 3. Architecture

```
┌──────────────────────── Browser ─────────────────────────┐
│  UI (index.html / styles.css)                             │
│    ├── Orb renderer      canvas, 60 fps, state-reactive   │
│    ├── Transcript panel  live partial + finished turns    │
│    ├── Voice picker      30 voices, descriptor + gender    │
│    └── Composer          type-to-talk fallback             │
│                                                          │
│  AudioEngine                                              │
│    ├── capture worklet  mic → 16 kHz PCM16 (+ RMS level)   │
│    └── player worklet   24 kHz PCM16 ring buffer (+ level) │
│                                                          │
│  SessionAdapter  (one interface, three transports)         │
│    ├── direct-token   WS → Gemini, ephemeral token          │
│    ├── direct-key     WS → Gemini, user-supplied key        │
│    └── proxy          SSE + POST → our server → Gemini     │
└───────────┬────────────────────────────────────────────────┘
            │  wss://generativelanguage.googleapis.com
            │  /ws/google.ai.generativelanguage.v1beta
            │  .GenerativeService.BidiGenerateContent*
            ▼
        Gemini Live API (gemini-3.8-live)
```

### Why the server exists at all
It never touches audio. It (a) serves the static app, (b) mints **ephemeral tokens** so the
long-lived API key never ships to the browser, (c) optionally relays traffic for networks that
block direct browser→Google WebSockets.

### Three transports, one interface
`SessionAdapter` exposes `start / sendAudio / sendText / sendToolResponse / stop` and emits
`audio, input_transcript, output_transcript, interrupted, turn_complete, tool_call, usage, error`.
The UI never knows which transport is active. This also makes the app demoable with **no API key**
(a local simulator drives the exact same adapter interface).

## 4. Component design

### 4.1 Server (`server/`, Node ≥ 20, zero runtime dependencies)
- `index.js` — static file server + JSON API + SSE endpoint. Bind `0.0.0.0`.
- `env.js` — 30-line `.env` parser (no `dotenv` dependency).
- `tokens.js` — mints ephemeral tokens via `POST https://generativelanguage.googleapis.com/v1beta/auth_tokens`
  (`uses: 1`, 30 min expiry, 60 s new-session window, constraints locked to the model + `AUDIO` modality).
- `proxy.js` — optional relay: SSE downstream + `POST` upstream, per-session Gemini WS.
- `public/js/protocol.js` is **imported by both** browser and server so the two dialects can never drift.

### 4.2 Audio (`public/worklets/`, `public/js/audio.js`)
- `pcm-capture.js` — linear-interpolating resampler → 16 kHz → Int16 → transferable chunk every 32 ms,
  plus RMS level for the orb.
- `pcm-player.js` — 24 kHz → context-rate resampler with a growable ring buffer, `flush()` for barge-in,
  plus output RMS for the orb.
- Both worklets survive context-rate changes (48 kHz, 44.1 kHz, 16 kHz) without pitch/speed errors.

### 4.3 Orb (`public/js/orb.js`)
Six additive radial-gradient blobs on `globalCompositeOperation = "lighter"`, Lissajous paths,
radius/alpha driven by the live input & output RMS. Hue is a function of state
(idle indigo → listening cyan → thinking violet → speaking amber-pink).
No `ctx.filter` blur (expensive); softness comes from multi-stop radial gradients.

### 4.4 State machine (`public/js/state.js`)
`idle → connecting → listening ⇄ thinking → speaking → idle`, plus `error`.
Transitions: `setup_complete`→listening, `input_transcription(finished)`→thinking,
first audio chunk→speaking, `turn_complete`→listening, `interrupted`→listening.

### 4.5 Voice picker
All 30 prebuilt voices with Google's own descriptors and genders, sourced from a single shared
module. Selection while connected triggers a graceful reconnect (voice is immutable per session).
**Preview** speaks a sample line through a short-lived session with the candidate voice.

### 4.6 Extras that make it feel like Siri
- Function calling: `get_current_datetime` (client-side tool) answered over the same socket.
- Optional Google Search grounding (`{ "googleSearch": {} }`).
- Hands-free mode (always listening) **or** push-to-talk; `Space` held = temporary push-to-talk.
- Live input/output transcription panel with partial-text updates.

## 5. Security model
| Asset | Where it lives |
|---|---|
| `GEMINI_API_KEY` | server `.env` only, never serialised to the client |
| Ephemeral token | short-lived (1 use / 30 min), handed to the browser for one session |
| User-entered key | browser `localStorage` only, explicit opt-in, masked in the UI |

`/api/token` is the only privileged endpoint; it returns a token bound to the requested model.

## 6. Failure modes & handling
| Failure | Handling |
|---|---|
| No microphone / permission denied | Banner with retry, text composer stays usable |
| Token mint fails (no server key, offline) | Fall back to direct-key mode, show actionable message |
| WS drops mid-session | Auto-reconnect with backoff, replay the transcript as context |
| Model speaks while user talks | `interrupted` event → `player.flush()` (true barge-in) |
| 15-minute session cap | `goAway`/close → transparent reconnect, context re-seeded |
| Voice changed mid-session | Prompt + one-click reconnect |

## 7. Delivery plan (executed in this order)

| # | Phase | Files |
|---|---|---|
| 1 | Protocol + PCM core, unit-tested | `public/js/protocol.js`, `public/js/pcm.js` |
| 2 | Server: static, config, ephemeral tokens | `server/*` |
| 3 | Audio worklets + engine | `public/worklets/*`, `public/js/audio.js` |
| 4 | Session adapters (direct / proxy) | `public/js/session.js` |
| 5 | Orb + state machine | `public/js/orb.js`, `public/js/state.js` |
| 6 | UI: shell, transcript, voices, settings | `public/index.html`, `public/styles.css`, `public/js/app.js` |
| 7 | Demo simulator (no key) | `public/js/demo.js` |
| 8 | Tests + docs | `tests/*`, `README.md` |

## 8. Testing strategy
`node --test` over the pure logic (protocol builder/parser, base64↔PCM round-trip, state
transitions, token payload). Manual verification checklist: mic capture, playback continuity,
barge-in, voice switching, reconnect, demo mode.

### What the suite actually covers (50 tests)
| Area | Coverage |
|---|---|
| `tests/protocol.test.js` | setup frame shape, URL construction, server-frame parsing, tool frames |
| `tests/pcm.test.js` | base64 round trips, clipping, RMS, WAV header |
| `tests/state.test.js` | every transition, illegal transitions, labels |
| `tests/catalog.test.js` | 30 voices, metadata, default model |
| `tests/worklets.test.js` | resampling maths at 48 k→16 k, 16 k→16 k, 24 k→24 k, 24 k→48 k, barge-in flush |
| `tests/dom-contract.test.js` | every element id the app touches exists, every asset resolves |
| `tests/orb.test.js` | renders in every state, reacts to level, changes hue |
| `tests/session.test.js` | full session against a **mock Gemini WebSocket server** (setup, audio, transcripts, interruptions, tool calls) and the same through the proxy hub |

The mock server (`tests/helpers/mock-gemini.js`) implements just enough of RFC 6455 to accept
a connection and push frames, so the client and proxy transports are exercised end to end
without touching the network.

### Bugs the suite caught during the build
1. **Capture resampler off-by-one** — the read position could run past the buffer and drive
   `bufferLength` negative, throwing `RangeError: offset is out of bounds` on the second block.
2. **Proxy session leak** — the 5-minute TTL timer was never cleared when a session was
   destroyed, keeping the Node process alive.
3. **Player level metering** — the RMS was posted every other block and reset per block, so
   the orb saw a flickering level.

## 9. Risks
- **Browser WebSocket to Google may be blocked** on some networks → proxy transport as fallback.
- **Voice preview costs tokens** → preview uses one short utterance, and is opt-in per click.
- **`ctx.filter`/AudioWorklet differences** → capability checks + graceful degradation to ScriptProcessor-free path.

## 10. Future roadmap
Persistent memory, camera frames (Gemini supports 1 FPS video), Live Avatar video output,
multi-speaker TTS, PWA install, server-side session analytics.


---

# Phase 2 — the desktop app

> *"can you buold this as a electron app"* + *"use the folloiwng react component as the ai
> when the asnwers arwe resposnding. clone siri"* + *"can you use groq also"*

## 11. Goal

Turn Halo into a real desktop application and make the pasted `MorphOrb` component the
assistant surface:

- **Electron** shell around the existing brain.
- **React 19 + TypeScript + Tailwind 4 + shadcn** structure, so the project matches what the
  component expects.
- The pasted component lives in `src/components/ui/ai-thinking-orb-and-input.tsx` and drives
  every answer: the orb is the AI while it thinks and while it answers.
- **Groq** as a second provider, next to Gemini.

## 12. What the research changed

| Finding | Consequence |
|---|---|
| Groq **retired PlayAI** on 31 Dec 2025 — TTS is now **Canopy Labs Orpheus** | `canopylabs/orpheus-v1-english` (`autumn`, `diana`, `hannah`, `austin`, `daniel`, `troy`) and `canopylabs/orpheus-v1-arabic-saudi` (`fahad`, `sultan`, `lulwa`, `noura`). Shipping `playai-tts` would 404. |
| Orpheus returns **WAV** | The renderer decodes it with the same `AudioContext` that plays the Live API's PCM. |
| Groq STT is `whisper-large-v3-turbo` over `multipart/form-data` | The renderer records 16 kHz PCM16 → WAV → IPC → main process → `POST /audio/transcriptions`. |
| Groq chat is an **OpenAI-compatible SSE stream** | The main process streams the deltas back over IPC so the transcript fills in live. |
| Vite cannot import from `public/` | The shared modules moved to `shared/` and the server learned the `/shared/*` and `/worklets/*` routes. |

## 13. Architecture

```
 Electron main (electron/)                Renderer (src/, React 19)
┌───────────────────────────┐             ┌──────────────────────────────┐
│ config.json — the keys    │             │ MorphOrb — the assistant     │
│ providers/gemini.ts       │   IPC       │   idle→launch→assemble→think │
│   mint an ephemeral token │ ──────────► │   →resolve→condense→unfold  │
│ providers/groq.ts         │ ◄───────── │ VoiceDock, history, settings │
│   chat / whisper / tts    │             │ lib/assistant.ts — the ask   │
└───────────────────────────┘             └──────────────────────────────┘
```

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`.
- The renderer only sees `window.halo` — a hand-written context bridge. It never sees a key.
- The microphone permission is granted automatically for the app's own content.

### The shared refactor

`protocol.js`, `pcm.js`, `voices.js`, `models.js`, `state.js`, `session.js`, `audio.js` and the
two worklets moved from `public/` to `shared/`. The web app now imports them from
`../shared/…`, the server serves `/shared/*` and `/worklets/*`, and the React renderer imports
the same files — one wire format, four consumers.

### The orb contract

The component publishes every animated value as a CSS custom property, so the stylesheet owns
the look and the component only writes numbers:

| Element | Variables |
|---|---|
| `.mo-actor` | `--w --h --r --oGlow --oHalo --oPill --oBall --oGreen --oCard --oRing --oInput --oAur --gs --cs --hOp --dotS --bloom` |
| `.mo-status` | `--sOp --sTy` |
| `.mo-root` | `--oCenter` |
| `.mo-input` | `--inScale` |

Phases: `idle → launch → assemble → think → resolve → condense → unfold → answered → reset`.
The canvas is 220 px; the comet trail is six `.mo-trail` ghosts; the answer words are
`.mo-w` spans revealed by `--wp`; `Esc` aborts; `?debug` adds a speed slider and a replay.

### Talking to the orb

The voice pipeline must not reach into the component. It dispatches a `halo:ask` event:

```ts
window.dispatchEvent(new CustomEvent('halo:ask', { detail: { text } }));
```

The component listens, fills its field and starts the timeline — the same path a typed
question takes. (A DOM-level trick — native value setter + `requestSubmit()` — was the first
idea; React 19 only reacts to `input` in a real browser and falls back to its selection
polyfill elsewhere, so the event contract is both simpler and testable.)

## 14. The build

| Piece | Choice |
|---|---|
| Bundler | `electron-vite` — main (ESM), preload (CJS), renderer (Vite 8) |
| Renderer root | the project root, so `src/index.css` and `src/components/ui/` match the shadcn layout |
| Styles | Tailwind 4 (`@import "tailwindcss"`), `tw-animate-css`, plus the hand-written `.mo-*` sheet |
| Icons | `lucide-react` |
| Images | Unsplash backgrounds, with a graceful fallback to the generated aurora |
| Config | `components.json` (shadcn) + `tsconfig.json` paths `@/* → ./src/*` |

## 15. What was verified — and what could not be

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `electron-vite build` | main + preload + renderer, worklets emitted as real files (`assetsInlineLimit: 0`, because a `data:` URL would be blocked by the CSP) |
| `npm test` | **75 green** — the 50 from phase 1 plus 25 new ones |
| The renderer mounts | `react-dom/server` renders the whole shell in `tests/renderer-smoke.test.js` |
| The orb in a real DOM | jsdom mounts the component, asks it a question and watches `onSubmit` fire (`tests/orb-interaction.test.js`) |
| The Groq provider | a mock HTTP API covers multipart upload, SSE streaming, the error body and the network failure (`tests/groq-provider.test.js`) |
| The Electron GUI | **not launchable in the sandbox** — `release-assets.githubusercontent.com` is outside the egress allowlist, so the Electron binary cannot be downloaded. The build, the typecheck and the headless tests stand in for it. |

## 16. Scripts

```bash
npm run dev        # Electron with hot reload
npm run web        # the renderer alone, in a browser, in demo mode
npm run build      # production build of all three processes
npm run typecheck  # tsc --noEmit
npm test           # 75 tests
```
