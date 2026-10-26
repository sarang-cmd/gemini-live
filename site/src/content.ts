/**
 * Every line of copy on the site, in one place.
 *
 * The wording follows the product rather than the marketing: it says what
 * Halo does, what it needs and what it does with your data. No claims that
 * are not implemented, no numbers that are not measured.
 */

export const product = {
  name: 'Halo',
  tagline: 'A voice assistant that shows you what it is doing.',
  repo: 'https://github.com/sarang-cmd/gemini-live',
  geminiKeyUrl: 'https://aistudio.google.com/apikey',
  groqKeyUrl: 'https://console.groq.com/console',
  liveDocs: 'https://ai.google.dev/gemini-api/docs/live-api/capabilities',
  groqDocs: 'https://console.groq.com/docs',
};

export const hero = {
  heading: 'A voice assistant that shows you what it is doing.',
  lead:
    'Halo runs on your own machine. Hold the button, say a question, and the orb collapses into a ball, flies to the centre of the window and turns while the model works. When the answer is ready it condenses to a green dot and opens into a card, and you hear it in the voice you picked.',
  primary: { label: 'Get it running', to: '/download' },
  secondary: { label: 'Watch it answer', href: '#demo' },
  note: 'macOS, Windows and Linux. You bring an API key, there is no account and no telemetry.',
};

export const steps = {
  heading: 'Three steps, and you can see each one',
  items: [
    {
      title: 'Hold the button',
      body:
        'The microphone is captured at 16 kHz and streamed to the provider you chose. Release and the utterance is over.',
    },
    {
      title: 'The orb assembles',
      body:
        'The pill at the bottom of the window folds into a ball, flies up leaving a short trail and becomes a dotted sphere. It keeps turning while the model works, and the label underneath names the stage: thinking, searching, analysing, composing.',
    },
    {
      title: 'The answer unfolds',
      body:
        'The sphere condenses to a green dot and opens into a card. The words appear as they are spoken and the audio plays back at 24 kHz.',
    },
  ],
};

export const providers = {
  heading: 'Two ways to think',
  lead:
    'Both providers run inside the same window. The orb behaves identically; what changes is how the audio reaches the model and how the answer comes back.',
  tabs: [
    {
      id: 'gemini',
      label: 'Gemini',
      model: 'gemini-3.8-live',
      summary:
        'A duplex session over the Live API. You can talk over the answer and Halo stops mid sentence.',
      facts: [
        ['Model', 'gemini-3.8-live, native audio'],
        ['Audio in', '16 kHz mono PCM over one WebSocket'],
        ['Audio out', '24 kHz mono PCM, played by a worklet'],
        ['Voices', '30 prebuilt voices, switched by reconnecting'],
        ['Your key', 'exchanged for a single use token that opens one session'],
        ['Cost', "Google's Live API pricing, billed to your key"],
      ],
    },
    {
      id: 'groq',
      label: 'Groq',
      model: 'whisper-large-v3-turbo + chat + orpheus',
      summary:
        'A turn based pipeline: the clip is transcribed, an OpenAI compatible model answers, and Orpheus speaks it.',
      facts: [
        ['Ears', 'whisper-large-v3-turbo, multipart upload'],
        ['Brain', 'openai/gpt-oss-120b, llama-3.3-70b-versatile or kimi-k2'],
        ['Mouth', 'canopylabs/orpheus-v1-english, WAV out'],
        ['Voices', 'autumn, diana, hannah, austin, daniel, troy'],
        ['Your key', 'used by the main process, never sent to the renderer'],
        ['Cost', "Groq's pricing, billed to your key"],
      ],
    },
  ],
};

export const underTheHood = {
  heading: 'Under the hood',
  lead:
    'A small amount of code, and every part of it is in the repository. The diagram is the audio path in the Gemini provider; Groq replaces the socket with a request and a response.',
  facts: [
    [
      'Capture',
      'An AudioWorklet resamples the microphone to 16 kHz mono PCM and reports the input level so the orb can react to it.',
    ],
    [
      'Transport',
      'One WebSocket carries the session. Frames are JSON with base64 PCM, parsed by a module the browser app, the server and the desktop app all share.',
    ],
    [
      'Playback',
      'A second AudioWorklet plays a gapless ring buffer at 24 kHz. Groq speech arrives as a WAV and is decoded by the same audio context.',
    ],
    [
      'Keys',
      'They live in the Electron user data folder on your machine. The renderer never receives them, and the page you are reading collects nothing.',
    ],
    [
      'Tests',
      '117 of them, including a mock Gemini WebSocket server, a mock Groq API and a DOM mount of the orb.',
    ],
  ],
};

export const voices = {
  heading: 'The voices you can pick',
  lead:
    'Thirty prebuilt Gemini voices, each with a short description of how it sounds. Orpheus adds six English voices and four Arabic ones on the Groq side.',
  note:
    'The voice is chosen when a session opens, so switching reconnects the session and the orb runs its launch animation again.',
};

export const runIt = {
  heading: 'Run it on your machine',
  lead:
    'Halo is a desktop app that you build and run yourself. There is no hosted version, no sign up and nothing to download that we would have to keep up to date.',
  command:
    'git clone https://github.com/sarang-cmd/gemini-live.git && cd gemini-live && npm install && npm run dev',
  requirements: [
    ['Node', '20 or newer'],
    ['A key', 'from Google for Gemini, or from Groq for the Groq provider'],
    ['macOS', '12 or newer'],
    ['Windows', '10 or newer'],
    ['Linux', 'any distribution with a working audio stack'],
  ],
  note:
    'The repository also contains a browser version with no dependencies at all. Run npm start and it serves the same assistant on port 8787.',
};

export const faq = {
  heading: 'Questions worth answering',
  items: [
    {
      question: 'Does it work without an API key?',
      answer:
        'Yes. The app starts in demo mode, the orb runs its full timeline and the answer is scripted. Add a key in Settings and the same interface talks to a real model.',
    },
    {
      question: 'Where are my keys stored?',
      answer:
        'In config.json inside the Electron user data folder on your machine. The renderer process never receives them: it asks the main process to mint a Gemini token or to make a Groq call on its behalf.',
    },
    {
      question: 'What happens to my voice?',
      answer:
        'The clip is sent over TLS to the provider you chose, and nowhere else. Google receives it if you use Gemini, Groq receives it if you use Groq. Switching provider changes the destination.',
    },
    {
      question: 'Which is better, Gemini or Groq?',
      answer:
        'Gemini is duplex, so you can interrupt it mid sentence and it hears the interruption. Groq is turn based and gives you a choice of chat models, and its Orpheus voices are separate from the Gemini catalogue.',
    },
    {
      question: 'Can I change the model at runtime?',
      answer:
        'Yes. The model, the voice and the system prompt are all in Settings and are applied the next time a session opens.',
    },
    {
      question: 'What does it cost?',
      answer:
        'Nothing to us. You pay Google or Groq directly for what you use, on your own key. The repository and the app are free.',
    },
    {
      question: 'Does this site track me?',
      answer:
        'No. There are no cookies, no analytics and no third party scripts. The fonts are served from this origin, not from a font CDN.',
    },
  ],
};

export const download = {
  heading: 'Get Halo running',
  lead:
    'Halo is a desktop app. Download the installer for Windows or Linux and it runs on your own machine. You can also clone the repository and start it from the source.',
  command:
    'git clone https://github.com/sarang-cmd/gemini-live.git && cd gemini-live && npm install && npm run dev',
  installersTitle: 'The installers',
  installersLead:
    'Every tagged release carries the installers. They are built on the GitHub runners and published with the release. The current build is 2.0.1.',
  installers: [
    [
      'Halo.Setup.2.0.1.exe',
      'The Windows installer, 120 MB. It installs Halo and puts it in your start menu.',
    ],
    [
      'Halo.2.0.1.exe',
      'The portable Windows app, 108 MB. It runs from the folder you keep it in, with nothing installed.',
    ],
    ['Halo-2.0.1.AppImage', 'The Linux app image, 128 MB.'],
    ['halo_2.0.1_amd64.deb', 'The Debian package, 100 MB.'],
  ],
  installersNote:
    'The same files sit in the repository, under release. They are larger than GitHub takes in a normal commit, so they are kept in Git LFS, which Git for Windows ships with.',
  releaseLabel: 'Open the release',
  releaseUrl: 'https://github.com/sarang-cmd/gemini-live/releases/tag/v2.0.1',
  stepsTitle: 'What happens when you run it',
  steps: [
    ['npm install', 'Installs the renderer, the Electron shell and the test tooling.'],
    [
      'npm run dev',
      'Starts the main process, the preload bridge and the React renderer with hot reload.',
    ],
    [
      'Add a key',
      'Open Settings in the top right corner. Gemini and Groq keys are stored in your user data folder, never in the page.',
    ],
  ],
  requirementsTitle: 'What you need',
  requirements: [
    ['Node', '20 or newer'],
    ['A key', 'from Google for Gemini, or from Groq for the Groq provider'],
    ['macOS', '12 or newer'],
    ['Windows', '10 or newer'],
    ['Linux', 'any distribution with a working audio stack'],
  ],
  packagingTitle: 'Packaging it yourself',
  packaging:
    'npm run dist builds a DMG, an NSIS installer and an AppImage from the same source tree. Nothing is uploaded anywhere; the artefacts land in the release folder on your machine.',
  otherTitle: 'The browser version',
  other:
    'The same repository contains a web app with no dependencies. npm start serves it on port 8787, complete with a token server and an optional relay for networks that block direct WebSockets.',
};

export const privacy = {
  heading: 'What happens to your data',
  lead:
    'Halo is a desktop app you run yourself. This page is a static file with no analytics, no cookies and no third party scripts. What follows describes the software, because that is where data actually moves.',
  sections: [
    {
      title: 'The keys you add',
      body: [
        'A Gemini or Groq key is written to config.json in the Electron user data folder, which is a directory inside your operating system profile. It is read by the main process and never by the renderer.',
        'For Gemini the key is used once, to exchange for a single use token. That token opens one Live session and expires. The key itself is never sent to the renderer and never reaches this website.',
      ],
    },
    {
      title: 'Your voice and your text',
      body: [
        'While you hold the button, audio is captured at 16 kHz and sent over TLS to the provider you selected: Google for Gemini, Groq for the Groq provider. Releasing the button ends the turn.',
        'Text you type is sent the same way. The answer comes back from the same provider and is written to the transcript, which is kept in memory for the session and is not written to disk.',
        'Switching provider in Settings changes where the audio is sent.',
      ],
    },
    {
      title: 'What this website does',
      body: [
        'It is a static build. The fonts are served from this origin rather than a font CDN, there is no analytics script, there are no cookies and nothing is submitted to a server.',
        'The live demo on the home page answers from a list of scripted replies that ship with the page. Nothing you type there is transmitted anywhere.',
      ],
    },
    {
      title: 'What is not covered',
      body: [
        'Google and Groq each publish their own terms and privacy policies for the data you send them. Read those before you send anything you care about.',
      ],
    },
  ],
  drafts: [
    [
      'Contact address',
      'Draft. A monitored address for privacy questions has not been chosen yet.',
    ],
    [
      'Retention',
      'Draft. Halo has no server, so it keeps no server side data. The retention policy of the providers still applies to the audio they receive.',
    ],
  ],
};

export const terms = {
  heading: 'Terms of use',
  lead:
    'This page is a draft for review. It describes how the software is meant to be used, and it is deliberately short. It has not been reviewed by a lawyer, so do not rely on it as a final agreement.',
  drafts: [
    [
      'Legal entity',
      'Draft. The entity that publishes Halo has not been decided, so there is no party named here.',
    ],
    ['Governing law', 'Draft. No jurisdiction has been chosen.'],
    ['Contact address', 'Draft. A monitored address for notices has not been chosen yet.'],
  ],
  sections: [
    {
      title: 'The licence',
      body: [
        'Halo is open source software published under the MIT licence. The licence text in the repository is the licence; this page only points at it.',
      ],
    },
    {
      title: 'Your keys and your costs',
      body: [
        'You supply your own API keys. Every request you make is billed by Google or Groq to your account, and those providers set their own prices and acceptable use rules.',
        'You are responsible for keeping your keys safe. Anyone who has your key can spend your credit.',
      ],
    },
    {
      title: 'No warranty',
      body: [
        'The software is provided as is, without warranty of any kind, as the MIT licence states. It talks to services that change their models and their behaviour, so a release can stop working when a provider changes something.',
      ],
    },
    {
      title: 'Acceptable use',
      body: [
        'Do not use Halo to break a provider’s terms, to build something unlawful, or to send audio of people who have not agreed to it. The providers publish their own acceptable use policies and those apply to you as well.',
      ],
    },
  ],
};
