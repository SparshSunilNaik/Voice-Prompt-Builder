# Voice Prompt Builder 0.3.0: human beta acceptance

Automated checks and live synthetic tests have passed as recorded in `test-results.md`. This checklist is **not completed yet**: it requires real microphone/speaker use and the current authenticated chat websites. Use synthetic requests, not private documents or real personal information.

## Install and connect

1. Use Chrome 116+ and a supported Node version: Node 24.15+ in the 24.x line, 22.22.2+ in the 22.x line, or 26+. Install FFmpeg on PATH.
2. Run `start.ps1` from the project root. The backend reads the existing local `.env`. Do not share provider keys or commit `.env`/`.backend-token`.
3. In `chrome://extensions`, enable Developer mode and load unpacked `extension/dist` (or extract the beta ZIP and select the folder containing `manifest.json`). Reload an older installed version and refresh all three chat tabs after an update.
4. Open the side panel. Expand **Backend connection**, paste the local access token printed by the launcher, and choose **Save connection**. The token is stored for the browser session and is separate from provider keys.
5. Use one ordinary Chrome window for the initial acceptance run. Cross-window microphone ownership has automated coverage; repeat the two-window case below afterwards.

## Acceptance cases

| Case | Actions | Required result | Human result |
|---|---|---|---|
| Text-only | Type “Build an offline college workshop registration app. Keep registration free. Do not add accounts or payments.” Choose an approach, answer/skip clarification, build. | Questions stay in text; the final prompt preserves all explicit constraints and actual answers. | Pending |
| Voice end to end | Choose Speak, grant permission in the extension permission tab, speak the same request, then Stop. Correct the transcript if necessary and continue. | Actual transcript appears. Every clarification question is spoken. Record each answer, Stop, review its transcript, then advance. No answer is recorded until Record answer is chosen. | Pending |
| Replay / skip / fallback | Replay a question; record then skip it; switch voice clarification to text. | Replay works, skipped audio is not used as a confirmed answer, and switching preserves the same questions and completed answers. | Pending |
| Cancel and denial | Cancel permission onboarding; deny permission and retry through the recovery page; cancel a recording; cancel transcription/generation. | No late recording or late screen change after cancellation. Typed/saved work remains recoverable. Text input remains usable. | Pending |
| Capture duration | Record briefly, then record to the automatic duration stop. Try a disconnected/unavailable microphone. | Short and capped recordings work; empty/unavailable capture produces an actionable error. Chrome's microphone indicator turns off after Stop/Cancel. | Pending |
| Quality / strategy | Run Check quality & strategy, edit the prompt, then check again. | Review shows actionable issues and separate example/reasoning/execution choices. Editing invalidates the old result. No claim that the target task was actually run. | Pending |
| Review / revision | Edit the final prompt. Ask for concise bullets while preserving requirements. Regenerate. Copy. | The revision respects explicit edits/constraints; Copy yields the reviewed prompt. | Pending |
| Insertion: ChatGPT | Open a chat, keep its composer empty, refresh the displayed destination, approve insertion. | Correct multiline prompt appears and remains unsent. No Enter or Send is triggered. | Pending |
| Insertion: Claude | Repeat in Claude with an empty composer. | Correct multiline prompt appears and remains unsent. | Pending |
| Insertion: Gemini | Repeat in Gemini with an empty composer. | Correct multiline prompt appears and remains unsent. | Pending |
| Draft / destination protection | Put disposable draft text in the composer and try insertion. Change conversation after refreshing the destination and retry. | Existing draft is preserved; changed destination is rejected until reviewed/refreshed again. Copy remains available. | Pending |
| Recovery / repeat use | Reload the extension while analysis is in progress. Reopen it. After a successful insertion choose New prompt. | Interrupted work resumes at a safe checkpoint; a new empty workflow can be started without clearing Chrome's extension data. | Pending |
| Two windows | Open another side panel and try recording while the first window is recording. Use different typed requests in both. | Second capture is refused while the first owns the microphone; saved workflows do not overwrite each other. | Pending |
| Narrow panel / keyboard | Test 320–420px widths, browser zoom and keyboard-only navigation. | Approval labels remain readable, every action is reachable, errors are visible and stages announce useful status. | Pending |

## Feedback to return

For each failure, report: browser/version; site; text or voice mode; exact steps; expected result; actual result; displayed error; whether retry/reload helped. Do not include access tokens or API keys. Mark each row Pass/Fail with notes. At least two users should run the core text/voice/insertion cases before calling this a completed beta.

Release acceptance requires no failed core cases, successful physical voice playback/capture, successful unsent insertion on all three sites, and review of prompt fidelity across several different requests. Successful unit tests alone do not satisfy that gate.
