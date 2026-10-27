# Voice Prompt Builder

Voice Prompt Builder is a voice-first Chrome side panel that turns a rough request into a deliberate, high-quality prompt. It identifies the goal, recommends a practical methodology, asks up to three useful questions, and lets the user revise and explicitly approve the result before insertion into ChatGPT, Claude, or Gemini. **It never sends a chat message.**

## Features

- Speech capture through the browser microphone and Gnani Prisma v2.5 transcription
- Typed-input path and editable transcript review
- Structured intent, risk, requirement, and methodology analysis through OpenRouter
- User-selectable or custom methodology; no forced “most complex” approach
- Zero to three contextual, skippable follow-up questions
- Editable and regenerable final prompt with assumptions kept separate
- Explicit insertion approval plus a permanent Copy fallback
- Site-specific ChatGPT, Claude, and Gemini composer adapters
- Local-only FastAPI backend; provider keys never enter the extension bundle
- Persisted non-secret workflow state; audio is released and discarded after transcription

## Architecture

```text
Chrome side panel (React) -> MV3 background -> supported-tab content script -> chat composer
            |
            +-- HTTP on 127.0.0.1:8000 -> FastAPI
                                              |-- Gnani STT
                                              +-- OpenRouter chat completions
```

The background worker validates explicit approval, the active tab, and its exact hostname. Content scripts select only known composer elements, dispatch native editor events, verify inserted content, and never click a send button. See [docs/architecture.md](docs/architecture.md).

## Requirements

- Python 3.11+
- Node.js 20+ and npm
- Chrome 116+
- [FFmpeg](https://ffmpeg.org/download.html) on `PATH` (required to convert Chrome WebM/Opus recordings to Gnani-supported WAV)
- A Gnani Prisma v2.5 API key
- An OpenRouter API key with access to the configured model

Gnani's REST API accepts WAV, MP3, OGG, FLAC, AAC, and M4A, but not Chrome's usual WebM recording format. The backend performs an ephemeral 16 kHz mono WAV conversion and deletes temporary files immediately.

## Configure environment

The root `.env` is intentionally ignored by Git. It is created from `.env.example` by the startup scripts only when absent; an existing file is never overwritten.

```bash
cp .env.example .env
```

Replace only these placeholders in `.env`:

```dotenv
GNANI_API_KEY=YOUR_REAL_KEY
OPENROUTER_API_KEY=YOUR_REAL_KEY
```

Keep `HOST=127.0.0.1`. The application rejects public bind addresses. `openai/gpt-4o-mini` is the default OpenRouter model and currently supports structured outputs; change `OPENROUTER_MODEL` if your account uses another structured-output-capable model.

## Windows setup and startup

Install FFmpeg (for example `winget install Gyan.FFmpeg`), reopen PowerShell, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start.ps1
```

The script creates `.venv` and `.env` only when missing, installs dependencies, builds the extension, and starts the API at `http://127.0.0.1:8000`.

## macOS/Linux setup and startup

Install FFmpeg (`brew install ffmpeg` on macOS, or your Linux package manager), then:

```bash
chmod +x start.sh
./start.sh
```

## Manual development commands

Backend:

```bash
python -m venv .venv
# Windows: .venv\Scripts\python -m pip install -r backend\requirements.txt
.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Extension:

```bash
cd extension
npm ci
npm run build
```

## Load the extension into Chrome

1. Build the extension with `cd extension && npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the absolute `extension/dist` directory.
6. Open ChatGPT, Claude, or Gemini and click the extension toolbar icon to open the side panel.
7. After rebuilding, click **Reload** on the extension card and refresh the chat page.

## Usage

1. Type a rough request, or choose **Speak**, grant microphone access, and stop recording.
2. Correct the transcript if needed.
3. Review the recommended methodology, select an alternative, or add custom instructions.
4. Answer or skip the contextual questions.
5. Edit or regenerate the final prompt.
6. Use **Copy**, or choose **Approve & insert** while a supported chat tab is active.
7. Review the inserted text and send it yourself only when ready.

See [docs/demo.md](docs/demo.md) for a hackathon walkthrough.

## Verification

```bash
# Backend
.venv/Scripts/python -m pytest backend       # Windows
.venv/Scripts/python -m ruff check backend

# Frontend
cd extension
npm run lint
npm run typecheck
npm run test
npm run build
```

Tests use deterministic Gnani and OpenRouter mocks. They do not prove live credential, quota, network, microphone, or provider compatibility. See [docs/verification.md](docs/verification.md).

## API troubleshooting

| Symptom | Action |
|---|---|
| `not_configured` | Replace the corresponding placeholder in root `.env`, then restart the API. |
| `ffmpeg_unavailable` | Install FFmpeg, ensure `ffmpeg -version` works in a new terminal, and restart. |
| `provider_auth` | Recheck the provider key and account access. Keys are read only by the backend. |
| `provider_rate_limit` | Wait, check quota, and retry. |
| `backend_unreachable` | Confirm `/health` responds at `http://127.0.0.1:8000/health`. |
| Insertion failure | Refresh the supported chat tab; interface selectors can change. The final prompt remains available for Copy. |
| Microphone denied | Re-enable microphone access in Chrome site/extension settings or use typed input. |

## Known limitations

- Chat products frequently change their DOM; adapters use multiple selectors but may need maintenance.
- The local MVP has no login, database, billing, cloud deployment, or remote backend support.
- WebM voice input requires a local FFmpeg installation.
- Live provider checks require user-supplied credentials and quota.
- Automated real-Chrome end-to-end testing is not included; follow the manual checklist in `docs/verification.md`.
