# ✦ Halo

**A Siri-style voice assistant for the browser, powered by the Gemini Live API.**

Talk to it. It talks back — in real time, in any of **30 prebuilt Gemini voices**, while a
living orb reacts to what the assistant is doing.

```
┌──────────────────────────────────────────────────────────────┐
│  ● Halo · Gemini Live            ◉ Listening      Voices  ⚙  │
│                                                               │
│                        ( ◉ ◉ ◉ ◉ )                            │
│                         Listening                             │
│                   Go ahead, I'm listening                    │
│                                                               │
│                         (  🎤  )                              │
│              [ Or type a message…           ➜ ]              │
└──────────────────────────────────────────────────────────────┘
```

---

## What it does

- **Real-time speech in, speech out.** Raw PCM over a WebSocket — no round trips through a
  text model, no waiting for a "final" transcript.
- **True barge-in.** Start talking while Halo is answering and the half-spoken sentence is
  thrown away, exactly like a phone assistant.
- **30 Gemini voices.** Every prebuilt voice with Google's own descriptors, a one-click
  preview, and a live switcher (the voice is chosen when a session opens, so Halo reconnects
  for you).
- **A reactive orb.** Idle indigo → listening cyan → thinking violet → speaking amber. It is
  driven by the real RMS of your microphone and its own speaker.
- **Live transcript.** Your words and Halo's words, streamed as they are spoken.
- **Tools.** Ask for the time and Halo calls a client-side function. Toggle Google Search
  grounding from the settings panel.
- **Works without a key.** A built-in demo simulator drives the exact same pipeline so you
  can see the interface before wiring up an API key.

## Quick start

```bash
git clone https://github.com/sarang-cmd/gemini-live.git
cd gemini-live
cp .env.example .env      # add your GEMINI_API_KEY
npm start                 # → http://localhost:8787
```

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

There is nothing to install — Halo has **zero runtime dependencies**. Node 20+ is enough.

```bash
npm test        # 50 unit + integration tests
npm run dev     # restart on file changes
```

### Connecting without a server key

If you would rather not put a key on the server, open **Settings → Connection → My API key**
and paste it in the browser. It is stored in `localStorage` and sent straight to Google.
The app works in three transports:

| Transport | Key location | When to use it |
|---|---|---|
| **Server token** (default) | server `.env` | production — the browser only ever gets a short-lived token |
| **My API key** | browser `localStorage` | quick experiments, no server key |
| **Server proxy** | server `.env` | networks that block browser → Google WebSockets |
| **Demo mode** | nowhere | preview the UI, no network, no cost |

## How it works

```
 Browser                                   Server                     Gemini
 ┌──────────────────────────┐        ┌─────────────────┐        ┌──────────────────┐
 │ mic → 16 kHz PCM16       │  HTTPS │ /api/token      │        │                  │
 │   ↓                      │ ─────► │ (ephemeral      │        │  gemini-3.8-live │
 │ WebSocket ───────────────┼────────┼─────────────────┼──────► │  native audio    │
 │   ↑                      │        │ /api/proxy/*    │  WS    │  30 voices       │
 │ orb ← RMS levels         │        │ (optional relay)│        │  VAD + barge-in  │
 └──────────────────────────┘        └─────────────────┘        └──────────────────┘
```

**Audio.** The Live API speaks raw 16-bit PCM: 16 kHz in, 24 kHz out. `<audio>` elements
cannot play that, so Halo uses two `AudioWorklet` processors — one resamples the microphone
and reports the input level, the other plays a gapless ring buffer of model audio and
reports the output level. Both survive any context rate (44.1 kHz, 48 kHz, …).

**Protocol.** `public/js/protocol.js` is the single source of truth for the wire format and
is imported by *both* the browser and the Node server, so the two can never drift apart.

**Security.** The long-lived `GEMINI_API_KEY` stays on the server. The browser receives an
*ephemeral token* — one use, 30 minutes — which it hands to Google in place of a key.

**Session lifecycle.** Voice, modality and system instruction are fixed when a session
opens, so changing them reconnects transparently. Sessions are capped at 15 minutes by the
API; Halo asks for session resumption so long conversations can continue.

### Layout

```
server/
  index.js     static files + JSON API + SSE endpoint
  tokens.js    ephemeral token minting
  proxy.js     optional SSE + POST relay for restricted networks
  env.js       tiny .env parser (no dotenv dependency)
public/
  index.html   the shell
  styles.css   glass panels, aurora background, orb stage
  js/
    app.js       controller: settings, DOM, wiring
    session.js   session adapters (direct / proxy / demo)
    protocol.js  Gemini Live wire format (shared with the server)
    audio.js     AudioEngine: capture + playback
    orb.js       canvas orb renderer
    state.js     conversation state machine
    voices.js    the 30 prebuilt voices
    demo.js      no-key simulator
  worklets/
    pcm-capture.js  mic → 16 kHz PCM16 + level
    pcm-player.js   24 kHz PCM16 → speakers + level
tests/         50 tests, including a mock Gemini server
```

## Keyboard & gestures

| Action | How |
|---|---|
| Start / stop | click the mic |
| Push to talk | turn off *Hands-free* and hold the mic — or hold **Space** |
| Send a message | type in the composer and press Enter |
| Switch tab | click **Voices** / **Settings** in the header |

## HTTP API

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | server capabilities, model list, voice list |
| `GET /api/voices` | the 30 prebuilt voices |
| `POST /api/token` | mint an ephemeral token (`{ model }`) |
| `POST /api/proxy/session` | open a relayed session |
| `GET /api/proxy/events?id=` | SSE stream of session events |
| `POST /api/proxy/input` | relay audio / text / tool responses |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | — | server-side key for token minting and the proxy |
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | bind address |
| `GEMINI_LOCK_TOKENS` | `false` | lock minted tokens to one model |

## Limitations

- Audio-only sessions are capped at **15 minutes** by the API.
- Native-audio models return audio only; text comes from the transcription fields.
- Changing the voice, model, personality or tools restarts the session.
- The Live API is WebSocket-only — there is no plain HTTP streaming fallback.

## Roadmap

Persistent memory, camera frames at 1 fps, Live Avatar video output, multi-speaker TTS,
PWA install, and server-side session analytics.

---

Built with the [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api/capabilities) ·
[implementation plan](PLAN.md) · MIT
