# ✦ Halo

**A Siri-style voice assistant for the desktop, powered by the Gemini Live API and Groq.**

Talk to it. It thinks out loud — a living orb collapses into a ball, flies to the stage,
assembles into a dotted sphere, and unfolds into the answer. Then it talks back, in
**30 prebuilt Gemini voices** or in **Groq Orpheus**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ✦ Halo · Gemini · gemini-3.8-live                        ⏱  ⚙      │
│                                                                      │
│                                                                      │
│                          ( ·  ◦  ·  )                                │
│                           Thinking                                   │
│                                                                      │
│                                                                      │
│                                          ◯  ← hold to talk          │
│                                    Puck · Upbeat  🔊                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Two apps, one brain

| | **Halo Desktop** (Electron) | **Halo Web** (zero-dependency) |
|---|---|---|
| Start | `npm run dev` | `npm start` |
| Stack | React 19 · Tailwind 4 · TypeScript · electron-vite | plain ES modules, no build |
| Providers | Gemini Live · Groq · Demo | Gemini Live · Demo |
| Keys | stored in the OS user-data folder, never in the renderer | server `.env` or `localStorage` |
| Voice input | hold the mic, or **⌘/Ctrl + Space** | click the mic |

Both share the same wire protocol, the same audio worklets and the same 30-voice catalogue
— they live in `shared/` and are imported by the browser app, the Electron main process and
the React renderer alike.

---

## The desktop app

### Quick start

```bash
npm install
npm run dev          # electron-vite: main + preload + renderer with HMR
```

Open **Settings** (top right) and paste a key:

- **Gemini** → a key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
  The desktop app mints a single-use *ephemeral* token with it; the renderer never sees it.
- **Groq** → a key from [console.groq.com/console](https://console.groq.com/console).

Without a key the app still runs in **Demo** mode, so the interface is never empty.

### The three providers

| Provider | Voice in | Brain | Voice out |
|---|---|---|---|
| **Gemini** | Live API input transcription | `gemini-3.8-live` | Live API native audio |
| **Groq** | `whisper-large-v3-turbo` | `openai/gpt-oss-120b` (or any Groq model) | `canopylabs/orpheus-v1-english` |
| **Demo** | — | a canned reply | — |

> Groq retired the PlayAI speech models on 31 December 2025. The platform-wide text-to-speech
> model is now **Canopy Labs Orpheus** — voices `autumn`, `diana`, `hannah`, `austin`,
> `daniel`, `troy` (English) and `fahad`, `sultan`, `lulwa`, `noura` (Arabic Saudi).

### The orb

`src/components/ui/ai-thinking-orb-and-input.tsx` is the assistant. One element morphs
through the whole timeline:

```
idle → launch → assemble → think → resolve → condense → unfold → answered
```

The pill at the bottom collapses into a ball, flies up leaving a comet trail, assembles into
a dotted orb that spins while the request is in flight, condenses into a green dot and
unfolds into an answer card whose words appear one by one. Every animated value is published
as a CSS custom property, so the component only writes numbers and `src/index.css` owns the
styling.

- `Esc` aborts a pending question.
- `?debug` in the URL adds a speed slider and a replay button.
- The voice pipeline never touches the component: it dispatches a `halo:ask` event and the
  orb runs its timeline.

### Keyboard

| Action | How |
|---|---|
| Talk | hold the mic button, or **⌘/Ctrl + Space** |
| Ask | type in the orb and press **Enter** |
| History | the clock icon, top right |
| Settings | the gear icon, top right |
| Abort | **Esc** |

### Packaging

```bash
npm run build        # out/main, out/preload, out/renderer
npm run dist         # electron-builder → a distributable in dist/
```

`electron-builder` is not installed by default; add it with
`npm i -D electron-builder` and a `build` section to `package.json` when you want installers.

---

## The web app

```bash
cp .env.example .env      # add your GEMINI_API_KEY
npm start                 # → http://localhost:8787
```

The web app has **zero runtime dependencies** — Node 20+ is enough. It serves the static
app, mints ephemeral tokens and (optionally) relays Live sessions for networks that block
browser → Google WebSockets.

| Transport | Key location | When to use it |
|---|---|---|
| **Server token** (default) | server `.env` | production — the browser only gets a short-lived token |
| **My API key** | browser `localStorage` | quick experiments, no server key |
| **Server proxy** | server `.env` | networks that block browser → Google WebSockets |
| **Demo mode** | nowhere | preview the UI, no network, no cost |

### HTTP API

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | server capabilities, model list, voice list |
| `GET /api/voices` | the 30 prebuilt voices |
| `POST /api/token` | mint an ephemeral token (`{ model }`) |
| `POST /api/proxy/session` | open a relayed session |
| `GET /api/proxy/events?id=` | SSE stream of session events |
| `POST /api/proxy/input` | relay audio / text / tool responses |

---

## How it works

```
 Electron main process                        Renderer (React)
┌──────────────────────────────┐        ┌───────────────────────────────┐
│ config.json  (API keys)      │        │ MorphOrb  (the assistant)     │
│   │                          │  IPC   │   │                           │
│   ├─ Gemini: mint token ─────┼───────►│   ├─ Live WebSocket ──────┐   │
│   └─ Groq: chat / whisper /   │◄───────┤   ├─ or Groq chat + TTS   │   │
│      orpheus                 │        │   └─ voice dock, settings │   │
└──────────────────────────────┘        └───────────────────────────────┘
                                                        │
                                            Gemini Live │ Groq
```

**Audio.** The Live API speaks raw 16-bit PCM: 16 kHz in, 24 kHz out. `<audio>` elements
cannot play that, so Halo uses two `AudioWorklet` processors — one resamples the microphone
and reports the input level, the other plays a gapless ring buffer of model audio. Both
survive any context rate (44.1 kHz, 48 kHz, …). Groq speech arrives as a WAV and is decoded
by the same audio context.

**Protocol.** `shared/protocol.js` is the single source of truth for the Live wire format and
is imported by the browser app, the Electron main process, the React renderer and the Node
server, so the four can never drift apart.

**Security.** `contextIsolation` is on, `nodeIntegration` is off, and the renderer only ever
sees the narrow `window.halo` bridge that `electron/preload.ts` installs. API keys stay in the
main process — or, for Gemini, are exchanged for a single-use ephemeral token.

### Layout

```
electron/
  index.ts             the main process: window, permissions, lifecycle
  preload.ts           the context bridge (window.halo)
  config.ts            the persisted configuration (user-data/config.json)
  config-core.ts       the pure configuration rules (no Electron import)
  ipc.ts               every IPC channel
  catalog.ts           the Groq model and voice catalogue
  providers/
    gemini.ts          ephemeral token minting
    groq.ts            whisper + chat + orpheus
src/
  main.tsx             the React entry
  App.tsx              the shell: orb, dock, history, settings
  index.css            Tailwind 4 + the `mo-*` keyframes and component styles
  components/
    ui/ai-thinking-orb-and-input.tsx    the assistant
    halo-top-bar.tsx  halo-mic / voice-dock  halo-history  halo-settings  halo-toast
  lib/
    assistant.ts       the ask pipeline (gemini / groq / demo)
    audio.ts           microphone capture and playback
    live.ts            the Gemini Live client
    wallpapers.ts      the Unsplash backgrounds
    utils.ts           the shadcn `cn` helper
shared/                used by the browser app, the server and the renderer
  protocol.js  pcm.js  voices.js  models.js  state.js  session.js  audio.js
  worklets/pcm-capture.js  worklets/pcm-player.js
public/                the classic browser app (index.html, styles.css, js/)
server/                the static host, the token minter, the SSE relay
tests/                 75 tests, including a mock Gemini server and a mock Groq API
```

### Why `components/ui` matters

shadcn/ui does not install a component library — it *copies* source files into your
project. The `ui/` folder is where those files land, and `components.json` is the map that
tells the CLI where to find them:

```json
{ "aliases": { "components": "@/components", "ui": "@/components/ui", "utils": "@/lib/utils" } }
```

With `ui` pointing at `@/components/ui` (that is, `src/components/ui`), the CLI writes new
blocks next to the orb, the `@/` alias keeps the imports short, and `cn()` keeps the class
names from colliding with Tailwind utilities. That is why the orb lives in
`src/components/ui/ai-thinking-orb-and-input.tsx` and imports `../../index.css` — two
levels up is `src/`, where the Tailwind entry point sits.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | — | server-side key for token minting and the proxy |
| `GROQ_API_KEY` | — | key used by the desktop app when no key is saved in Settings |
| `PORT` | `8787` | HTTP port of the web app |
| `HOST` | `0.0.0.0` | bind address |
| `GEMINI_LOCK_TOKENS` | `false` | lock minted tokens to one model |

---

## Development

```bash
npm run dev        # Electron with hot reload
npm run web        # the renderer alone in a browser (no keys, demo mode)
npm run server     # the classic web app on :8787
npm run build      # production build of all three processes
npm run typecheck  # tsc --noEmit
npm test           # 75 unit + integration tests
```

The tests cover the wire protocol, the PCM helpers, the state machine, the worklets, the
DOM contract of the web app, the Gemini session (against a mock WebSocket server), the Groq
provider (against a mock HTTP API), the configuration rules, the orb's CSS contract and the
orb's behaviour in a real DOM.

## Limitations

- Audio-only Live sessions are capped at **15 minutes** by the API.
- Native-audio models return audio only; text comes from the transcription fields.
- Changing the voice, model or system prompt restarts the session.
- The Live API is WebSocket-only — there is no plain HTTP streaming fallback.
- The Groq provider transcribes with Whisper *after* you let go of the button, so it is a
  turn-based conversation rather than a duplex one. The Gemini provider is duplex.

## Roadmap

Persistent memory, camera frames at 1 fps, Live Avatar video output, multi-speaker TTS, an
installable PWA build and session analytics.

---

Built with the [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api/capabilities)
and [Groq](https://console.groq.com/docs) · [implementation plan](PLAN.md) · MIT
