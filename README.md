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
npm run dist         # electron-builder → installers in release/
./scripts/build-desktop.sh   # the same, with a readable error when the runtime is missing
```

`electron-builder` is configured in `package.json`: a DMG + ZIP on macOS, NSIS + portable on
Windows and an AppImage + deb on Linux. The icon is `build/icon.png`.

Packaging needs the Electron runtime for the target platform, and that runtime is not part
of the npm package: it is downloaded from the GitHub releases when `npm install` runs. On a
machine that cannot reach those releases, set `ELECTRON_MIRROR` to a mirror that is
reachable, or unpack a runtime into `node_modules/electron/dist` by hand. The application
build itself (`npm run build`) needs neither.

#### "Error: Electron uninstall"

That message from `electron-vite` means the `electron` package is installed but its runtime
was never downloaded, so there is nothing to start. The runtime comes from the GitHub
releases, and that host is blocked on many networks.

```bash
npm run electron:install      # runs the download again, and explains a failure
```

If the download is what is blocked, point it at a mirror:

```bash
# macOS, Linux
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run electron:install

# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm run electron:install
```

#### Prebuilt installers

The installers are built in the open and published with the repository.
[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on real Windows and
Linux runners, so the NSIS installer and the portable exe are produced with the tools of
that operating system. Push a `v*` tag and the files land in the release for that tag.

**The current build**: <https://github.com/sarang-cmd/gemini-live/releases/tag/v2.0.1>

| File | What it is |
| --- | --- |
| `Halo.Setup.2.0.1.exe` | the Windows installer, 120 MB, installs Halo with a shortcut |
| `Halo.2.0.1.exe` | the portable Windows app, 108 MB, runs without installing |
| `Halo-2.0.1.AppImage` | the Linux app image, 128 MB |
| `halo_2.0.1_amd64.deb` | the Debian package, 100 MB |

The build of 2.0.0 stopped before the window opened, because the main
process declared a name twice in the same module. 2.0.1 is the build that
starts.

The installers are in the repository as well, in `release/`. They are larger than the
100 MB that GitHub takes in a normal commit, so they are kept in Git LFS: a clone that
has Git LFS, which Git for Windows ships with, gives you the files themselves.

The workflow can also be started by hand from the Actions tab, and the artifacts of that
run are downloadable there.

---

## The site

```bash
npm run site:dev      # http://localhost:5174
npm run site:build    # site/dist, with the renderer copied to site/dist/web
npm run site:preview  # serve the built site
```

`site/` is a small Vite + React + Tailwind 4 project. It has four pages: the overview, the
download page, and drafts of the privacy policy and the terms of use.

**Live**: <https://halo-sarang-dev.vercel.app>. It is built on Vercel straight from this
repository: the project runs `npm run site:build`, serves `site/dist` and rewrites the four
client side routes to `index.html`. `vercel.json` holds the build command, the output
directory, that rewrite and the cache headers for the hashed assets.

**The demo on the overview page is the real application.** The page embeds the shipping
renderer in an iframe (`/web/index.html`, built by `npm run web:build`) rather than a
screenshot of it, so what you see is the interface that ships. The answers in that frame are
scripted, because the demo mode needs no API key, and the page says so.

The site is deliberately plain: one warm off-white background, one green accent, Newsreader
for the display type and Instrument Sans for everything else, both self-hosted so no request
leaves the origin. There are no cookies, no analytics and no third party scripts. The
interactions are Radix primitives (a dialog for the mobile menu, tabs for the two providers,
an accordion for the questions) and Motion for the one reveal on the hero.

`npm test` covers the site as well: the copy rules, the contrast of every colour pair, the
rendered markup of all four pages, and the dialog, the tabs, the accordion, the copy button
and the router in a DOM.

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
site/                  the marketing site (Vite + React + Tailwind 4)
  src/content.ts       every line of copy on the site
  src/styles/          the design tokens and the stylesheet
  src/components/      the header, the footer, the demo frame, the tabs, the accordion
  src/pages/           overview, download, privacy, terms
scripts/               build-desktop.sh, the packaging wrapper
tests/                 92 tests, including a mock Gemini server, a mock Groq API and the site
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
npm run site:dev   # the marketing site on :5174
npm run build      # production build of all three processes
npm run site:build # production build of the site, the same command Vercel runs
npm run typecheck  # tsc --noEmit
npm test           # 92 unit + integration tests
```

The tests cover the wire protocol, the PCM helpers, the state machine, the worklets, the
DOM contract of the web app, the Gemini session (against a mock WebSocket server), the Groq
provider (against a mock HTTP API), the configuration rules, the orb's CSS contract, the
orb's behaviour in a real DOM and the marketing site (copy, contrast, markup and the
interactive parts).

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
