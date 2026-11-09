# Architecture

## Components

### Chrome extension

- **Side panel:** React + TypeScript workflow UI. It records only after a user gesture, sends the resulting Blob to the backend, and stores only non-secret workflow JSON in `chrome.storage.local`.
- **Voice capture:** `useVoiceAnswer` wraps the recorder with permission handling, silence-based auto-stop (`services/silenceDetector.ts`, Web Audio RMS levels; stops after ~1.6 s of pause following speech, or reports no speech after 8 s) and transcription. Voice mode speaks a question, waits for the speech end event (with a watchdog for Chrome builds that never fire it), then listens. Recording starts only after the user chose voice mode or pressed a voice control.
- **Feedback learning:** `services/feedbackMemory.ts` stores regeneration feedback (reasons, note, domain, rejected technique) in `chrome.storage.local` for up to 90 days (25 entries) and turns it into at most eight ranked lessons. They are sent as `learned_feedback` with `/api/analyze` and `/api/generate`, where the prompts treat them as penalties that never override the current request.
- **Background worker:** Opens the side panel and brokers approved insertion requests. It queries the active tab and allows only exact ChatGPT, Claude, or Gemini hostnames.
- **Content script:** Receives validated insertion messages and delegates to one site adapter.
- **Adapters:** Maintain isolated selector strategies. Textareas use native value setters; contenteditable composers use native input events and text insertion. Output is verified after insertion. No adapter clicks submit.

### FastAPI backend

- **Configuration:** `backend/app/config.py` resolves the root `.env` from the source location, independent of launch directory. It exposes only boolean provider readiness in health output and permits only loopback binding.
- **Audio:** Validates size/type and WAV duration. WebM is converted in an ephemeral directory to 16 kHz mono WAV with FFmpeg.
- **Gnani:** Sends multipart `audio_file`, `language_code`, and `format` with `X-API-Key-ID`; maps auth, quota, network, and malformed-response errors.
- **OpenRouter:** Uses `/chat/completions`, bearer authentication, low temperature, strict JSON Schema output, Pydantic validation, and one bounded malformed-output retry. Token usage is returned when available.
- **Prompt engine:** Separate instructions build intent analysis, technique selection, the adaptive interview, synthesis, and revision context. `technique_requirements()` turns the selected strategy into a concrete checklist for the generator.
- **Adaptive interview (`/api/next-question`):** Returns one multiple-choice question (or done) plus an updated prompting strategy, given every earlier answer. `services/interview.py` enforces what smaller models do not reliably follow: near-duplicate questions end the interview, filler choices are removed, explicit example counts ("2 examples", "no examples") override the model's strategy, and generated demonstrations are labelled as illustrative. `/api/refine` remains for compatibility but the extension no longer calls it.

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

In `questions`, the extension keeps the asked questions in order with a fingerprint of the answers each was planned from; moving forward reuses a question only if earlier answers are unchanged, otherwise it drops later questions and asks again.

Typed input skips listening/transcribing/transcript. Failures transition to a recoverable error. Back navigation, answers, skips, methodology edits, final edits, and regeneration all update a typed reducer state.
