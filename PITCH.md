# Voice Prompt Builder — Solution Pitch

**Think aloud. Prompt precisely.** A voice-first Chrome extension that interviews you, then writes the prompt.
Built for the **Great Indian AI Internship Challenge** with **Gnani Prisma** speech-to-text.

**One-page PDF:** [PITCH.pdf](PITCH.pdf) · **Live demo and video:** https://sparshsunilnaik.github.io/Voice-Prompt-Builder/ · **Code:** https://github.com/SparshSunilNaik/Voice-Prompt-Builder

## The problem

AI assistants are only as good as the prompts they receive. Most people know *what* they want but not how to say it precisely, so they type a vague one-liner, get a generic answer, and rewrite the prompt again and again. Prompt-engineering techniques (few-shot examples, chain-of-thought, structured output) work, but few users know when to use which. Typing long, careful prompts is also slow, especially for people who think faster than they type or are more comfortable speaking.

## The solution

Voice Prompt Builder sits in Chrome's side panel next to ChatGPT, Claude or Gemini:

1. **Speak the idea.** The user explains the problem out loud; **Gnani Prisma** transcribes it (Indian English by default, language configurable).
2. **Adaptive voice interview.** It reads each multiple-choice question and its options aloud, then listens hands-free. The user says "option two" or answers in their own words. Every question is generated from the answers so far, so it never asks what it already knows (up to 5 questions; stop any time).
3. **Picks the prompting technique.** It chooses zero-, one- or few-shot, direct or chain-of-thought or decompose-and-verify reasoning, plus supporting techniques (role, structured output, self-critique, constraint checklist) for the task and explains why.
4. **Learns from feedback.** On Regenerate it asks what was wrong ("too long", "wrong tone", "wrong technique"), fixes the prompt and remembers the lesson for future prompts.
5. **Inserts, never sends.** After explicit approval it places the prompt in the chat box, protects existing drafts, and leaves sending to the user.

## Why it matters

- **Better answers on the first try:** structured, technique-aware prompts instead of vague one-liners.
- **Voice-first and accessible:** speaking is faster than typing for many users, and Gnani Prisma transcribes Indian English (en-IN) out of the box.
- **Personal over time:** feedback becomes reusable lessons. In a live test, one round of "too long, wrong tone" feedback cut a prompt from **331 to 270 words**.
- **Safe by design:** API keys stay on the user's machine, the backend binds only to localhost, and nothing is ever auto-sent.

## How it is built

Chrome MV3 side panel (React 19, TypeScript) → local FastAPI backend → **Gnani Prisma v2.5** (speech-to-text) and an OpenRouter LLM with strict JSON schemas. Server-side guards catch repeated questions, filler options and unlabelled generated examples. Verified with 72 backend and 90 extension automated tests, live provider checks and real-microphone testing in Chrome.

## Next steps

One-click Chrome Web Store release with a hosted backend, Hindi and code-mixed (Hinglish) voice input via Gnani's multilingual models, and spoken prompt previews.

**Team:** Madhav and Sparsh ([@naik_sparsh](https://x.com/naik_sparsh))
