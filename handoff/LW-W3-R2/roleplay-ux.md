# Roleplay reader UX

- Full visible Scene history replaces current-Scene-only presentation.
- Narrative paragraphs lead the hierarchy; dialogue uses a restrained editorial rule, not bubbles.
- Player action, state changes, choices, checkpoints/endings, and replay remain semantically distinct.
- Story title/premise, active path label, and known-Character entry provide continuity with minimal chrome.
- Readable centered measure on desktop; dense but legible single-column mobile layout.
- Bottom composer remains reachable after long sessions, grows approximately 1-7 lines, wraps without horizontal scrolling, preserves draft state, uses explicit Send, leaves Enter for newline/IME composition, and disables duplicate submission.
- New Scenes scroll into view; Chat separately scrolls to latest durable message.
- Loading, retryable provider error, non-retryable validation error, empty, and reconnect/reload states are explicit.
