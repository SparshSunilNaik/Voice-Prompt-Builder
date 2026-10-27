# Verification record

Automated tests use explicit deterministic provider mocks. Live API and real browser checks are separate because they require user credentials, quota, microphone permission, FFmpeg, and an installed Chrome browser.

## Automated suites

Run from the repository root unless noted:

```text
.venv/Scripts/python -m pytest backend
.venv/Scripts/python -m ruff check backend
cd extension && npm run lint
cd extension && npm run typecheck
cd extension && npm run test
cd extension && npm run build
```

Coverage includes environment loading, placeholder credentials, loopback enforcement, health secrecy, origin protection, request validation, audio size/type/WAV duration, Gnani multipart/auth/rate/error handling, OpenRouter structure/retry/auth handling, follow-up bounds and uniqueness, revision context, recording permission/lifecycle, typed flow, answers/skips, final editing/approval, persistence, messaging validation, clipboard behavior, and all three adapters without submission.

## Manual release checklist

- [ ] Install FFmpeg and verify `ffmpeg -version`.
- [ ] Add real provider keys without committing `.env`.
- [ ] Start the backend and check `/health` reports both services configured.
- [ ] Load `extension/dist` in Chrome; inspect the service worker for errors.
- [ ] Complete the typed-input flow.
- [ ] Grant microphone permission and complete a real Gnani transcription under 60 seconds.
- [ ] Complete real OpenRouter analysis, refinement, generation, and revision.
- [ ] Insert multiline output into ChatGPT, Claude, and Gemini.
- [ ] Confirm each composer remains unsent.
- [ ] Break a selector or use an unsupported tab and verify Copy remains available.

## Phase record

| Phase | Verification at completion |
|---|---|
| 1 Foundation | Backend health/config tests; frontend lint/test/build |
| 2 Integrations | Mocked Gnani/OpenRouter clients and all API routes |
| 3 Intelligence | Intent context, methodology, follow-up bounds, skips, synthesis/revision tests |
| 4 UX | Recorder, typed flow, reducer, API service, lint/typecheck/build |
| 5 Sites | Message validation and ChatGPT/Claude/Gemini insertion/no-submit tests |
| 6 QA | Full suites, secret scan, production build, startup smoke check |
