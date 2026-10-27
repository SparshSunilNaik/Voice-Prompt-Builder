# Demo walkthrough

## Preparation

1. Put real Gnani and OpenRouter keys in root `.env`.
2. Confirm `ffmpeg -version` and `http://127.0.0.1:8000/health`.
3. Build and load `extension/dist` as an unpacked extension.
4. Open a new ChatGPT tab and pin Voice Prompt Builder.

## Three-minute flow

1. Open the side panel and say: **“Build an AI assistant to automate customer support.”**
2. Stop recording and point out that Chrome's WebM was converted locally, sent only to Gnani, and then discarded.
3. Correct one word in the transcript to demonstrate user control.
4. Continue to the intent analysis. Compare the recommended hybrid/RAG/workflow method with its simpler alternatives.
5. Select an approach or add: **“Prefer deterministic escalation for refunds.”**
6. Answer an audience or source-of-truth question, choose a suggested answer for another, and skip the third.
7. Generate the prompt. Highlight confirmed requirements versus assumptions and edit one line manually.
8. Click **Approve & insert**. Show the multiline prompt in ChatGPT's composer and emphasize that it was **not sent**.
9. Open Claude or Gemini and repeat insertion, or demonstrate **Copy** as the permanent fallback.

## Failure demo

- Stop the backend and retry analysis to show a recoverable connectivity message.
- Open an unsupported tab and attempt insertion. The extension keeps the prompt and recommends Copy rather than claiming success.
