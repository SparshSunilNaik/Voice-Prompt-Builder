# Voice Prompt Builder — continuation context

Snapshot: 2026-10-29 (Asia/Kolkata).

Project folder: `D:\gnani ai\Voice-Prompt-Builder`

## Status update — 2026-11-09 evening (Claude Code): public landing page + USP video

**What changed**
- `site/`: static landing page (hero + 49 s demo video, features, how it works, 4-step install, trust, FAQ) with Open Graph/Twitter tags so links preview with `poster.png`. "Download beta" = GitHub source zip of `main` (start scripts build the extension, so no Release is needed); "Request beta access" = issue form `.github/ISSUE_TEMPLATE/beta-access.yml`.
- `.github/workflows/pages.yml` deploys `site/` to GitHub Pages on pushes touching `site/**`. Target URL: https://sparshsunilnaik.github.io/Voice-Prompt-Builder/ — **requires repo Settings → Pages → Source = "GitHub Actions"** (needs repo admin; one time), then re-run the workflow.
- `marketing/usp-video/`: 1080×1080 animated USP video. `narration.json` + `make-voice.py` (edge-tts neural voices: narrator, app, user) produce `voice/` clips and a timeline; `render.mjs` warps the 30 s animation to fit and muxes AAC (`--silent` for the original cut). Outputs (mp4, voice/) are git-ignored; `POSTS.md` has X/LinkedIn copy pointing at the site URL.
- README links the site.

**Verified 2026-11-09**: page screenshots at 1366 px and 375 px, no console errors, no horizontal overflow; zip and README links return 200. Video sync checked on stills; audio −16 LUFS target. Not verified: the live Pages deployment (needs the setting above) and listening to the voice-over by a human.

**Next action**: enable Pages (Source: GitHub Actions), confirm the URL loads and its link preview on X/LinkedIn, then post.

## Status update — 2026-11-09 later (Claude Code): hands-free voice + feedback-driven regenerate (v0.5.0, uncommitted)

**What changed (on top of 0.4.0 below)**
- Voice mode is hands-free: after a question and its options are read aloud, the mic opens automatically and stops on a pause (`services/silenceDetector.ts`, `hooks/useVoiceAnswer.ts`, `components/ListeningBar.tsx`; recorder `start({ autoStop: true })`). The "Answer by voice" button exists only in text mode; voice mode has "Repeat question & listen". Tapping an option, typing, Skip/Next/Back or Switch stops listening. `speakQuestion` gained an `onEnd` callback with a watchdog.
- Regenerate now opens `components/RegenerateFeedback.tsx`: reason chips + note (spoken in voice mode, which asks aloud and auto-listens; spoken phrases tick reasons). "Wrong prompting technique" lets the user pick zero/one/few-shot and direct/CoT/decompose for the rewrite. The revision request states the rejection; `services/feedbackMemory.ts` stores feedback in chrome.storage.local (90 days, 25 entries) and sends ranked lessons as `learned_feedback` to `/api/analyze` and `/api/generate` (backend fields + prompt rules treat them as penalties). Review screen shows "Learning from N earlier feedback notes" with "Forget feedback".
- Tests 2026-11-09: backend 72 passed + ruff; extension 90 passed, ESLint, build OK. Live: "too long/wrong tone" feedback shortened a prompt 331 → 270 words; stored lessons alone gave 227 words.
- 2026-11-09: user tested 0.5.0 in Chrome with a real microphone and reported that hands-free answers and Regenerate feedback worked well.
- **Next action**: commit the 0.4.0 + 0.5.0 work on main (not yet committed or pushed).

## Status update — 2026-11-09 (Claude Code): adaptive voice interview + prompting techniques (v0.4.0, uncommitted)

**What changed**
- Clarification is now an adaptive interview: `POST /api/next-question` returns one multiple-choice question (2–4 options) or `done`, plus an updated `PromptingStrategy`, given all earlier answers. Default cap `MAX_ADAPTIVE_QUESTIONS=5` (config, 0–8). `/api/refine` is kept but unused by the extension.
- One unified question view (`extension/src/components/AdaptiveQuestions.tsx`) replaces `VoiceQuestions.tsx` and `QuestionsView`. Voice mode speaks the question **and numbered options** and shows them as clickable buttons; spoken answers are mapped to an option (`services/interview.ts` `matchSpokenChoice`: "option two", "the second one", option text) or kept as a custom answer. Back + changed answer re-plans later questions (answer fingerprints in `questionBasis`). "Build prompt now" stops early; the summary shows the adapted techniques.
- Strategy model gained `example_source` (none/user_supplied/illustrative), `reasoning: chain_of_thought`, and `techniques` (role_prompting, structured_output, step_back, self_consistency, self_critique, constraint_checklist). Intent/generation/review prompts teach when to use zero/one/few-shot and chain-of-thought; `technique_requirements()` sends the generator a concrete checklist.
- `backend/app/services/interview.py` enforces what gpt-4o-mini ignored in live tests: near-duplicate questions end the interview, filler choices ("Other", "Custom answer") are dropped, explicit example counts in answers override the model strategy, generated demonstrations get the heading "Illustrative examples (generated; …)".
- Rebuilt the broken `.venv` (it pointed at a deleted Codex Python) with Python 3.12; `start.ps1` relies on it.

**Tests (2026-11-09)**: backend 69 passed + ruff clean; extension 75 passed, ESLint clean, `npm run build` OK. Live OpenRouter checks via `backend/tests/live_adaptive_check.py` (output `docs/live-adaptive-check.json`) and a 4/4 explicit-answer override check passed. The dev side panel rendered with no console errors. Not verified: physical mic + speech playback of the new voice interview in Chrome, and insertion after the new flow (the in-app browser could not be connected to the backend token in this session).

**Open issues**: question quality depends on the model (gpt-4o-mini sometimes asks a weak first question or ends early via the repeat guard); consider a stronger `OPENROUTER_MODEL`. Nothing committed or pushed.

**Next action**: run `.\start.ps1`, reload `extension/dist` (0.4.0) in Chrome, try a spoken request through the voice questions, then commit.

## Current checkout at this snapshot

```text
## main...origin/main
```

Remote-tracking references are local and were not refreshed from the network. Any modified files above are existing work to preserve; context.md itself was added after this status check. Historical chat claims about other branches or pushes do not replace this checkout state.

## Purpose and work built

React Chrome MV3 side panel + loopback FastAPI backend. Voice/typed request -> structured strategy analysis -> up to three clarifications -> editable prompt -> explicit approve-and-insert into ChatGPT/Claude/Gemini. Never auto-send. Local recovery and quality/strategy advisory checks.

## Current status, decisions and next steps

Latest chat: v0.3.0 pushed main to SparshSunilNaik/Voice-Prompt-Builder at b747944; 53 backend and 55 frontend tests, lint/build passed historically. Physical capture/transcription and spoken clarification worked; complete unsent insertion/draft protection verification across supported sites. Quality reviewer has false positives, so remain advisory. Start .\start.ps1; requires Python, Node, Chrome and FFmpeg. Load extension/dist, reload after rebuilding; backend http://127.0.0.1:8000, local connection token in ignored .backend-token; provider keys in ignored .env. Read docs/architecture.md, docs/beta-checklist.md and docs/nightwear-prompt-review.md. Never copy secret values into documentation.

## Evidence and limits of this handoff

This snapshot combines inspected local folder structure, manifests/documentation and up to six recent turns from each matched accessible local chat. It is not a complete export of every conversation, cloud workspace or external service. Test counts, pushes, deployments and running services in chat records are historical reports; they were not rerun or independently reverified for this documentation task. Current source and the latest dated evidence take precedence over older messages. No application behavior was changed.

## Local map

.gitignore, .ruff_cache/, backend/, docs/, extension/, README.md, release/, start.ps1, start.sh

### Documentation to consult

- `docs\architecture.md`
- `docs\audit-2026-10-28.md`
- `docs\beta-checklist.md`
- `docs\demo.md`
- `docs\human-beta-log.md`
- `docs\nightwear-prompt-review.md`
- `docs\test-results.md`
- `docs\verification.md`
- `README.md`

### extension/package.json

```json
{
  "name": "voice-prompt-builder-extension",
  "engines": {
    "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && vite build --config vite.content.config.ts && node scripts/check-extension.mjs",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest run",
    "verify": "npm run lint && npm run test && npm run build"
  },
  "dependencies": {
    "@tailwindcss/vite": "4.3.3",
    "@vitejs/plugin-react": "6.1.2",
    "lucide-react": "1.62.0",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "vite": "8.3.5"
  }
}
```

- Dependency/build manifest: `backend/pyproject.toml`. Read it before changing runtime/dependencies.

### Source and deliverable inventory (bounded)

- `.gitignore`
- `.ruff_cache\.gitignore`
- `.ruff_cache\CACHEDIR.TAG`
- `backend\.ruff_cache\.gitignore`
- `backend\.ruff_cache\CACHEDIR.TAG`
- `backend\app\config.py`
- `backend\app\launch.py`
- `backend\app\main.py`
- `backend\app\__init__.py`
- `backend\pyproject.toml`
- `backend\requirements.txt`
- `backend\tests\browser_server.py`
- `backend\tests\conftest.py`
- `backend\tests\test_api.py`
- `backend\tests\test_foundation.py`
- `backend\tests\test_gnani.py`
- `backend\tests\test_openrouter.py`
- `backend\tests\test_prompt_engine.py`
- `backend\tests\test_quality_review.py`
- `backend\tests\test_regressions.py`
- `docs\architecture.md`
- `docs\audit-2026-10-28.md`
- `docs\beta-checklist.md`
- `docs\browser-integration.png`
- `docs\demo.md`
- `docs\human-beta-log.md`
- `docs\live-browser-check.json`
- `docs\live-provider-check.json`
- `docs\nightwear-prompt-review.md`
- `docs\nightwear-revised-validation.json`
- `docs\prompt-quality-evaluation.json`
- `docs\quality-review-ui.png`
- `docs\test-results.md`
- `docs\verification.md`
- `extension\dist\background.js`
- `extension\dist\content.js`
- `extension\dist\index.html`
- `extension\dist\main.js`
- `extension\dist\manifest.json`
- `extension\dist\microphone-permission.html`
- `extension\dist\microphonePermission.js`
- `extension\eslint.config.js`
- `extension\index.html`
- `extension\microphone-permission.html`
- `extension\package-lock.json`
- `extension\package.json`
- `extension\public\manifest.json`
- `extension\scripts\check-extension.mjs`
- `extension\src\App.integration.test.tsx`
- `extension\src\App.test.tsx`
- `extension\src\App.tsx`
- `extension\src\contracts.ts`
- `extension\src\main.tsx`
- `extension\src\styles.css`
- `extension\src\vite-env.d.ts`
- `extension\tsconfig.app.json`
- `extension\tsconfig.app.tsbuildinfo`
- `extension\tsconfig.json`
- `extension\tsconfig.node.json`
- `extension\tsconfig.node.tsbuildinfo`
- `extension\vite.config.ts`
- `extension\vite.content.config.ts`
- `README.md`
- `release\build-info.json`
- `release\voice-prompt-builder-0.2.0-beta.zip`
- `release\voice-prompt-builder-0.2.1-beta.zip`
- `release\voice-prompt-builder-0.3.0-beta.zip`
- `start.ps1`
- `start.sh`

This inventory excludes dependencies, caches, secrets, logs and database contents. It is a navigation aid, not a complete backup of the project.

## Recent chat handoff record

Newest turns appear first within each chat. Earlier completed steps may already have been superseded. Parent-workspace chats may describe a sibling version; use the project-specific status above to avoid confusing versions.

### Review shared ChatGPT context

Chat ID: `01a18208-ea6e-7fa1-9d52-5ea36a82f03f`; source workspace: `D:\gnani ai\Voice-Prompt-Builder`.

#### Recent turn 1 (completed)

Pushed successfully to [main](https://github.com/SparshSunilNaik/Voice-Prompt-Builder).

Commit: [`b747944`](https://github.com/SparshSunilNaik/Voice-Prompt-Builder/commit/b747944671ab08ef0275eb550798114a37285045)

- 53 backend and 55 frontend tests passed.
- API keys and local tokens excluded.
- GitHub verified; working tree clean.

#### Recent turn 2 (completed)

Please paste the exact generated prompt you want reviewed. Chrome is currently closed, so I can’t read the latest draft. I’m checking the saved test outputs and strategy-selection logic meanwhile.

For **Backend connection**, paste the single line from [`.backend-token`](</D:/gnani ai/Voice-Prompt-Builder/.backend-token>), then click **Save connection**. Your Gnani/OpenRouter keys stay in `.env`.

For your nightwear prompt, I recommend **zero-shot + structured decomposition + a final consistency check**.

| Approach | Fit for this prompt |
|---|---|
| Zero-shot | Recommended: clear instructions without demonstrations. |
| One-shot | Useful if you supply one approved example of the desired style or format. |
| Few-shot | Useful for consistent product-copy patterns; unnecessary for this planning brief. |
| Stepwise reasoning | Useful for coordinating website, branding, marketing and risks. Request concise rationale and checks, not internal reasoning traces. |
| Looping | Reserve for actual implementation with tools, test criteria and stopping limits. |

“One-shot” technically means one demonstration, rather than one response. Example count and execution workflow are separate choices. [Google prompting guidance](https://ai.google.dev/gemini-api/docs/prompting-strategies), [Anthropic workflow guidance](https://www.anthropic.com/research/building-effective-agents).

Your prompt is a useful brief, but needs clearer **market/currency, budget, MVP priorities, deliverables and acceptance checks**. It currently requests a **plan**, rather than implementation of the store.

I saved the [detailed assessment and copy-ready revision](</D:/gnani ai/Voice-Prompt-Builder/docs/nightwear-prompt-review.md>).

The extension now includes **Check quality & strategy**. It remains advisory—live testing exposed reviewer false positives. **53 backend tests and 55 frontend tests pass**, along with lint and build checks. Reload the extension to use version **0.3.0**.

![Quality-check control tested on a sample workflow](</D:/gnani ai/Voice-Prompt-Builder/docs/quality-review-ui.png>)

#### Recent turn 3 (completed)

Take your time. In ChatGPT, leave the composer empty, then click **Refresh destination → Approve & insert** in the side panel.

Check that the full prompt appears with its formatting intact and **nothing is sent automatically**. Tell me the result or exact error message.

#### Recent turn 4 (completed)

After Analyze → Use approach, does the extension speak the clarification question aloud, and can you record and review a spoken answer?
- Yes, spoken questions and answers work
- Questions are silent or answers fail

After reviewing the prompt, open ChatGPT in the same Chrome window, refresh the insertion destination, and choose Approve & insert. Does the prompt appear correctly and remain unsent?
- Inserted correctly and stayed unsent
- Insertion failed or changed the text
- I need help opening ChatGPT

Voice capture, transcription, spoken questions, and spoken answers are now confirmed working in your beta session.

Next, test insertion:

1. Build and review the final prompt.
2. Open ChatGPT in the same Chrome window with an empty composer.
3. Click **Refresh destination**, then **Approve & insert**.

Confirm that the prompt appears correctly and **stays unsent**. I’ve also prepared the 30-second recording-limit fix; I’ll leave your current session uninterrupted until this check finishes.

#### Recent turn 5 (completed)

In the side panel, click Speak, allow the microphone in the permission tab, say the short test request, and click Stop. Does the transcript appear correctly?
- Yes, the transcript is correct
- Microphone or transcription failed

**Voice Prompt Builder 0.2.0 is loaded**, its side panel is open, and the backend token is saved.

Now test your microphone:

1. Click **Speak**.
2. Allow microphone access in the permission tab.
3. Say: “Build an offline college event app. Keep registrations free. No payments or accounts.”
4. Click **Stop**.

Tell me whether the transcript appears correctly. Then we’ll verify spoken follow-up questions.

![Extension ready for testing](/C:/Users/madha/.codex/visualizations/2026/10/28/01a18208-ea6e-7fa1-9d52-5ea36a82f03f/extension-ready.png)

#### Recent turn 6 (completed)

For the live API and beta stage, can you configure Gnani and OpenRouter keys in the project’s local .env file and have you or your teammate available to test microphone capture? Please don’t paste API keys into this chat.
- I’ll configure .env and test with my teammate
- Proceed with automated tests; live testing later

The 0.2.0 beta build and checklist are ready. Can you or your teammate now load D:\gnani ai\Voice-Prompt-Builder\extension\dist in Chrome and run the physical voice + unsent insertion checks in docs\beta-checklist.md? Automated and live API tests have passed; these final checks need a real user.
- Yes, I can run the beta checks now
- Help me load the extension first

Chrome opened its profile picker. Which profile should we use for the beta extension? “Your Chrome” is an unambiguous separate profile; two profiles are both named “Madhav.”
- Use Your Chrome
- I’ll select my preferred profile myself

Please turn on Developer mode at the top right of Chrome’s Extensions page. Is it enabled?
- Developer mode is on
- I’ll load the extension myself

Click Select Folder in Chrome’s open dialog. Does Voice Prompt Builder 0.2.0 appear in the extension list?
- Yes, it is loaded
- Chrome shows an error

Chrome is ready. Click **Select Folder** in the open dialog—the correct extension path is already filled in.

You should then see **Voice Prompt Builder 0.2.0**. Reply **“loaded”**, and we’ll connect the side panel and test your microphone. The backend is already running.

![Prepared extension folder picker](/C:/Users/madha/.codex/visualizations/2026/10/28/01a18208-ea6e-7fa1-9d52-5ea36a82f03f/load-extension.png)

The [Computer Use rules](C:/Users/madha/.codex/plugins/cache/openai-bundled/computer-use/26.1021.31345/docs/confirmations.md) require confirmation for “install browser extensions,” so I left the final installation click to you.

## Continue in a fresh chat

Read this context.md, applicable AGENTS.md/CLAUDE.md and the listed source documents first. Inspect current Git branch/diff and existing local state before making changes. Restate the actual unfinished item, preserve completed behavior, and validate only relevant changes. Keep provider secrets in ignored configuration; never paste their values here. Preserve databases, user files, worktrees and evidence. Treat this file as project context, not permission to send messages, submit applications, reset data or deploy.

## Keep this file useful

After meaningful work, update: what changed; decisions and reasons; actual files/branch/commit; tests run with outcomes and limitations; unresolved issues; exact next action. Keep previous evidence when still useful and date any status changes. Maintaining this note is a manual continuation practice; no background updater was installed.

## Git state inspected during handoff creation

This is a read-only local snapshot before installing context.md. No fetch, push, branch checkout, staging or commit was performed.

```text

$ git status --short --branch
## main...origin/main

$ git log -5 --format=%h %s
b747944 feat: add voice clarification and prompt strategy review
2a988dd style(ui): polish compact workflow and prompt review
719fd12 style(ui): introduce quiet intelligence design tokens
e40e00b test(voice): cover microphone permission recovery
4ab6201 fix(voice): add microphone permission onboarding

$ git worktree list
D:/gnani ai/Voice-Prompt-Builder b747944 [main]

```
