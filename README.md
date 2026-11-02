# JARVIS — Personal AI Assistant

A futuristic, local-first AI assistant that runs with **zero third-party package dependencies**. It has a responsive dashboard, streamed AI chat, speech recognition and speech synthesis (when supported by the browser), editable memory, notes, tasks, and locally stored conversation history. No API key is required to explore demo mode.

## Quick start — Windows / macOS / Linux

1. Install **Node.js 20 or later** from https://nodejs.org/ (if not already installed).
2. Download or clone this repository and open a terminal in the `jarvis` folder.
3. Run:

   ```sh
   npm start
   ```

4. Open **http://127.0.0.1:3000** in Chrome or Edge.

**Windows shortcut:** after installing Node.js, you can simply double-click `start-jarvis.bat` to open the server and browser.

**No `npm install` required.** All functions apart from live AI replies work in clearly labeled demo mode. Chat, memory, notes and tasks are saved in your browser's local storage (not synchronized across devices).

## Enable the live AI model (optional)

1. Copy `.env.example` to `.env` in the project root.
2. Set `AI_API_KEY` to your secret API key and set `AI_MODEL` and `AI_BASE_URL` for your OpenAI-compatible provider. Example:

   ```ini
   AI_API_KEY=your_secret_key_here
   AI_MODEL=gpt-4o-mini
   AI_BASE_URL=https://api.openai.com/v1
   PORT=3000
   HOST=127.0.0.1
   ```

3. Restart `npm start`. The top-right status should say **AI LIVE**.

**Security:** Never paste an API key into the browser, a screenshot, an issue, GitHub, or chat. `.env` is gitignored and the server never exposes the key to the client. This local app binds to `127.0.0.1` by default. **Do not expose it to the public internet without authentication, stronger rate limiting and hardening.** Use only trusted provider URLs.

## Features

- **Dashboard:** futuristic animated JARVIS core, live system status, keyboard and quick actions.
- **AI chat:** streamed text from an OpenAI-compatible `/chat/completions` API; offline demo mode without an API key.
- **Voice:** browser speech recognition for dictation in supported browsers, native speech synthesis for replies, optional auto-speak.
- **Local commands:** `open tasks`, `open notes`, `remember I prefer short answers`, `create task review dashboard`, `new chat`.
- **Conversation history:** create, switch and delete sessions. Stored only in the current browser.
- **Notes / tasks / memory:** edit and manage independently. Memory items can be included as context for your model.
- **Interface replacement:** `public/index.html`, `public/styles.css`, `public/app.js` can be customized without changing API credentials or backend.

## Local commands

| Command | Result |
| --- | --- |
| `open tasks` / `open notes` | Navigate to the relevant view |
| `create task Prepare presentation` | Add a task |
| `remember I use Moroccan Darija` | Save a personal preference |
| `new chat` | Create a conversation |

Dictation needs microphone permission and a browser supporting `SpeechRecognition` or `webkitSpeechRecognition`. Availability and privacy behavior depend on your browser; speech recognition may use its vendor's online service. AI streaming requires a compatible provider API. AI output can be incorrect.

## Developer checks

```sh
npm run check
npm test
```

No build step. `npm run dev` restarts the server automatically when backend files change (Node 20+).

## Project map

```text
jarvis/
├── server.mjs           # secure local HTTP server + AI streaming proxy
├── utils.mjs            # validation, demo mode, provider event parser
├── public/
│   ├── index.html       # app shell and panels
│   ├── styles.css       # all responsive dashboard styles
│   └── app.js           # chat/voice/tasks/notes/memory UI logic
├── tests/
│   └── server.test.mjs
├── .env.example
├── .gitignore
├── start-jarvis.bat     # Windows one-click launcher
└── package.json
```

Designed for a local, single-user session. For deployment to other users, add user authentication, a database, CSRF and security review before using real keys.
