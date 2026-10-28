# Verification and beta status — 28 October 2026

Build: Voice Prompt Builder 0.3.0. The active human session started with 0.2.0.

## Completed checks

- Backend: 53 pytest tests pass; Ruff passes. Provider-unit/route checks use explicit mocks. Real local FFmpeg tests convert generated WebM audio to 16 kHz mono WAV, reject malformed compressed input and excessive MP3 duration, and handle small browser-timer overruns safely.
- Frontend: 55 Vitest tests pass across 16 files. ESLint, TypeScript compilation and both production builds pass. Final verification uses the bundled supported Node 24.22.1 runtime.
- Packaged content script: parses and executes as a classic script, registers its listener, rejects unapproved insertion, and has all required manifest entries. A separate IIFE build prevents shared ES-module imports in the content script.
- Text integration: capture, methodology, question/answer semantics, skipped answers, generation, manual edits, clipboard, explicit approval, completion and New prompt.
- Voice integration (automated mocked microphone and speech): initial transcription, spoken questions, answer transcription/review, answer context, skip-after-recording and deliberate text fallback. Recorder lifecycle and permission cancellation are tested independently.
- Recovery/security regressions: interrupted generation recovery, corrupt/expired saves, stage-specific retry, backend token enforcement, raw body limit, nested input bounds, request budget, null/refusal model content, hidden editors, draft protection, controlled-editor rollback, changed destinations, trusted extension senders and cross-window capture ownership.
- Browser integration with deterministic reasoning fixtures: the production UI used real HTTP against FastAPI to complete text analysis, clarification and generation. Clipboard content and reload restoration were verified.
- Live provider integration: Gnani transcribed a short synthetic Windows TTS sample accurately. OpenRouter performed actual analysis, clarification, synthesis and revision. Provider keys were read from local configuration and were not printed, committed or bundled.
- Live browser → FastAPI → OpenRouter: explicit test clarification answers were preserved; revision changed the output to concise bullets while retaining offline operation, local storage, free registration, no tracking and no fixed deadline.
- Responsive browser check: 360px layout had no document-level horizontal overflow. Visual inspection found a truncated approval label; buttons were changed to wrap their labels. Narrow-panel verification is repeated against the final build.

Evidence: `live-provider-check.json`, `live-browser-check.json`, `browser-integration.png` and the repository test sources. The live JSON files contain synthetic test content only. No autonomous sending into a chat was performed.

## Defect discovered through live testing and fixed

The first live skipped-question case prescribed name/email form fields even though the tester skipped that choice. Synthesis now receives the full text of skipped questions and is explicitly prohibited from promoting inferred/default choices into requirements. The rerun left form fields and implementation choices unresolved. This is evidence for that test case, not a guarantee of factual or semantic correctness for all future model outputs.

## Human acceptance still pending

No completed human beta is claimed. The user has now confirmed physical speech capture/transcription, spoken clarification playback, and spoken-answer capture on the installed Chrome extension. An initial transcription attempt failed before a later attempt succeeded. Authenticated insertion into the current ChatGPT, Claude and Gemini interfaces remains pending. Run `beta-checklist.md`; return failures for another iteration. Earlier browser integration used the standalone production web preview; the subsequent human checks used the installed Chrome extension. See human-beta-log.md.

## Important operating limits

- This is a local Chrome extension MVP. Keep the backend on loopback and the default port 8000, matching the manifest/client. Other deployment modes are not covered.
- The backend allows three concurrent requests and thirty authenticated API requests per minute by default. Provider-side billing limits still belong in the provider accounts.
- Audio is sent to Gnani; text is sent through OpenRouter and its selected provider. Browser speech output uses available system/browser voices. Third-party retention is governed by those services, not by local buffer cleanup.
- Local workflow state has a 24-hour restore expiry; expired persisted entries are pruned when a panel opens. Clear saved work removes the current workflow's content. This is not secure disk erasure.
- The frontend now pins direct dependency versions. Python direct requirements are pinned, but the full Python transitive dependency graph is not frozen. No comprehensive Python advisory or Git-history secret audit was performed.
- Live model testing covered an app-building scenario and one revision. Broader multilingual, writing/research, adversarial and accessibility beta testing remains an evaluation task.

## Reproduce

Run `.venv/Scripts/python -m pytest backend` and `.venv/Scripts/python -m ruff check backend` from the root. In `extension`, run `npm ci` and `npm run verify` on a supported Node runtime. For deterministic manual browser integration only, run `tests/browser_server.py` from `backend`, serve the production frontend on localhost:5173, and use its explicitly synthetic integration token. That fixture is never loaded by the production launcher.

## Post-beta duration correction

The [current Gnani REST documentation](https://docs.gnani.ai/api/STT/speech-to-text) specifies a maximum of 30 seconds. Build 0.2.1 caps initial and clarification recordings at 30 seconds, caps legacy backend duration settings accordingly, and maps rejected-audio and credit errors to actionable messages. This mismatch could explain the initial rejection; its exact cause was not established because the old client did not record a safe upstream status diagnostic.

## Prompt quality and strategy review (0.3.0)

Methodology now separates recommended demonstration count, reasoning approach, and execution mode. Shot labels are derived from the demonstration count, so one-shot cannot be mislabelled as one response. A separate user-invoked `/api/review` call audits the current edited candidate against original input and follow-up answers and shows actionable issues and suggested strategy. Results are invalidated in the UI when the prompt changes. The checker does not execute the destination task or certify success.

Live evaluation covered the supplied nightwear business plan, a simple summary, two-example JSON extraction and an unsafe unbounded coding prompt. See `prompt-quality-evaluation.json` and `nightwear-prompt-review.md`. Strict provider schema handling was corrected to preserve legitimate field names such as examples/title/pattern. Backend and component regressions cover that behavior and the new review flow.

The reviewer now cross-checks proposed issues in a bounded second stage, rejects incomplete issue coverage, and displays disagreements as advisory notes. Live review still showed that a small model can misread safeguards already present in a long prompt. The revised nightwear prompt is therefore accompanied by manual assessment and the raw model review in `nightwear-revised-validation.json`; no automated correctness certificate is claimed.
