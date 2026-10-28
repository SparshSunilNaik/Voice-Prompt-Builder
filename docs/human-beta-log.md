# Human beta log — 28 October 2026

Build: 0.2.0.

- The user selected their preferred Chrome profile and confirmed loading the unpacked extension.
- Native Chrome UI inspection verified Voice Prompt Builder 0.2.0 enabled, with its service worker registered and side panel rendering.
- The local backend access token was saved in extension session storage; the UI displayed the saved-token confirmation. Provider keys were not entered into Chrome.
- Physical voice capture/transcription: user reports it is working. An initial attempt returned a generic Gnani rejection; a later attempt succeeded. Treat this as a successful retry, with first-attempt reliability still under investigation.
- Spoken follow-up playback and spoken-answer capture: the user confirms both work. Native Chrome inspection also showed a recorded answer in the voice-clarification transcript field. Raw user test content is not copied into this log.
- Current-site unsent insertion on ChatGPT, Claude and Gemini: pending.

Installation and pairing do not constitute completed beta acceptance. Remaining cases are tracked in beta-checklist.md.

A post-beta 0.2.1 patch aligns recording duration with the current 30-second Gnani REST limit and improves rejected-audio/credit errors. It is built and tested but has not been reloaded into the active beta session yet.
