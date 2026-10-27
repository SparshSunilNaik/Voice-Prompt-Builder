# Architecture

## Components

### Chrome extension

- **Side panel:** React + TypeScript workflow UI. It records only after a user gesture, sends the resulting Blob to the backend, and stores only non-secret workflow JSON in `chrome.storage.local`.
- **Background worker:** Opens the side panel and brokers approved insertion requests. It queries the active tab and allows only exact ChatGPT, Claude, or Gemini hostnames.
- **Content script:** Receives validated insertion messages and delegates to one site adapter.
- **Adapters:** Maintain isolated selector strategies. Textareas use native value setters; contenteditable composers use native input events and text insertion. Output is verified after insertion. No adapter clicks submit.

### FastAPI backend

- **Configuration:** `backend/app/config.py` resolves the root `.env` from the source location, independent of launch directory. It exposes only boolean provider readiness in health output and permits only loopback binding.
- **Audio:** Validates size/type and WAV duration. WebM is converted in an ephemeral directory to 16 kHz mono WAV with FFmpeg.
- **Gnani:** Sends multipart `audio_file`, `language_code`, and `format` with `X-API-Key-ID`; maps auth, quota, network, and malformed-response errors.
- **OpenRouter:** Uses `/chat/completions`, bearer authentication, low temperature, strict JSON Schema output, Pydantic validation, and one bounded malformed-output retry. Token usage is returned when available.
- **Prompt engine:** Separate instructions build intent analysis, methodology reasoning, focused follow-ups, synthesis, and revision context.

## Trust boundaries

```text
untrusted speech/model text
  -> validated Pydantic/TypeScript contracts
  -> editable side-panel state
  -> explicit user approval
  -> background hostname validation
  -> adapter-specific text insertion (never innerHTML, never submit)
```

Provider secrets stay in root `.env` and backend process memory. They are absent from extension source, storage, API responses, and logs. API routes reject unauthorized browser origins; extension origins must have a valid Chrome extension ID shape and the request marker. Trusted-host checks reduce DNS rebinding risk.

## State transitions

`welcome -> listening -> transcribing -> transcript -> analyzing -> methodology -> questions -> generating -> review -> complete`

Typed input skips listening/transcribing/transcript. Failures transition to a recoverable error. Back navigation, answers, skips, methodology edits, final edits, and regeneration all update a typed reducer state.
