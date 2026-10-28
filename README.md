# Voice Prompt Builder

Voice Prompt Builder is a voice-first Chrome side panel that turns a rough request into a deliberate, high-quality prompt. It identifies the goal, recommends a practical methodology, asks up to three useful questions, and lets the user revise and explicitly approve the result before insertion into ChatGPT, Claude, or Gemini. **It never sends a chat message.**

## Features

- Speech capture through the browser microphone and Gnani Prisma v2.5 transcription
- Typed-input path and editable transcript review
- Structured intent, risk, requirement, and methodology analysis through OpenRouter
- User-selectable or custom methodology; no forced “most complex” approach
- Zero to three contextual, skippable follow-up questions: spoken questions and recorded answers in voice mode, text questions and typed answers in text mode
- Editable and regenerable final prompt with assumptions kept separate
- Explicit insertion approval, destination verification, existing-draft protection, and a Copy fallback
- Site-specific ChatGPT, Claude, and Gemini composer adapters
- Local-only FastAPI backend; provider keys never enter the extension bundle
- Per-window local workflow recovery with 24-hour expiry on restore; New prompt clears saved work; captured audio buffers are released after recording

## Architecture

```text
Chrome side panel (React) -> MV3 background -> supported-tab content script -> chat composer
            |
            +-- HTTP on 127.0.0.1:8000 -> FastAPI
                                              |-- Gnani STT
                                              +-- OpenRouter chat completions
```

The background worker validates the side-panel sender, explicit approval, the displayed destination tab/URL, and its exact hostname. Content scripts select only known composer elements, dispatch native editor events, verify inserted content, and never click a send button. See [docs/architecture.md](docs/architecture.md).

## Requirements

- Python 3.11+
- Node.js 24.15+ (24.x), 22.22.2+ (22.x), or 26+ and npm
- Chrome 116+
- [FFmpeg](https://ffmpeg.org/download.html) on `PATH` (required to convert Chrome WebM/Opus recordings to Gnani-supported WAV)
- A Gnani Prisma v2.5 API key
- An OpenRouter API key with access to the configured model

Gnani's REST API accepts WAV, MP3, OGG, FLAC, AAC, and M4A, but not Chrome's usual WebM recording format. The backend validates WAV input and normalizes compressed formats to 16 kHz mono WAV, with bounded decoding and temporary-file cleanup.

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

The script creates `.venv` and `.env` only when missing, installs dependencies, builds the extension, and starts the API at `http://127.0.0.1:8000`. It prints a local access token: paste it into **Backend connection** in the extension and choose **Save connection**. This token is separate from your provider API keys and is stored in trusted extension session storage. The generated `.backend-token` file is ignored by Git.

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
../.venv/bin/python -m app.launch
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
4. Answer or skip the contextual questions. Voice mode reads each question aloud; choose **Record answer**, speak, stop, and review the transcript. Text mode stays in text. You can explicitly switch from voice clarification to text.
5. Edit the final prompt or enter revision instructions before regenerating it.
6. Use **Copy**, or choose **Approve & insert** while a supported chat tab is active.
7. Review the inserted text and send it yourself only when ready. Existing composer drafts are protected; clear them yourself or use Copy. Choose **New prompt** for another task.

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
- Physical microphone/speaker and authenticated ChatGPT/Claude/Gemini acceptance checks require a real Chrome session. See [beta checklist](docs/beta-checklist.md) and [test results](docs/test-results.md). Browser speech output depends on installed/available browser voices; failed playback offers replay and text fallback.

## Beta build and evidence

Run `npm run verify` in `extension` to lint, test, build and validate the packaged content script. Live provider evidence is in [docs/live-provider-check.json](docs/live-provider-check.json) and [docs/live-browser-check.json](docs/live-browser-check.json). These contain only synthetic test requests. See [docs/test-results.md](docs/test-results.md) for the boundary between completed checks and human beta acceptance.

Voice clips are limited to 30 seconds to match the current [Gnani REST API contract](https://docs.gnani.ai/api/STT/speech-to-text). Existing MAX_AUDIO_DURATION_SECONDS=60 settings are capped to 30 by the backend.

## Prompt quality and strategy

Methodology recommendations now distinguish zero/one/few-shot demonstrations, direct versus plan-and-verify reasoning, and single-pass versus bounded tool execution. In final review, choose **Check quality & strategy** for a separate model audit of the edited prompt, requirements and follow-up answers. One review action may use two model stages to check proposed issues, plus bounded format retries. Use its suggestions as revision instructions when useful. Model review is advisory and does not run the destination task. See [nightwear prompt review](docs/nightwear-prompt-review.md) for an evaluated example.

For Backend connection, use the single-line token in `.backend-token`, not a Gnani or OpenRouter API key.
