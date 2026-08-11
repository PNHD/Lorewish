# Notable Finding: DeepSeek "Thinking" Mode Silently Zeroing Narrative Output

**Severity**: High (was the dominant cause of DeepSeek structural failures in this bakeoff before
being fixed). **Status**: Fixed during this task (commit `9e76978`), re-verified live.

## What happened

DeepSeek's V4 models default to a "thinking"/reasoning mode. `reasoning_tokens` are drawn from the
**same** `max_tokens` budget as the visible answer. For several Vietnamese narrative-generation
calls in this task's first DeepSeek bakeoff pass, reasoning alone consumed the entire 2048-token
budget, leaving **zero** tokens for the actual JSON response — the adapter then correctly reported
"response content was not valid JSON" (empty string is not valid JSON), which the pipeline
correctly resolved as a structural failure rather than corrupting canon.

## Direct evidence (raw API probe, not adapter-mediated)

Request: `deepseek-v4-flash`, a Vietnamese fantasy narrative prompt, `max_tokens: 2048`, thinking
left at its default.

```json
"usage": {
  "completion_tokens": 2048,
  "completion_tokens_details": { "reasoning_tokens": 2048 }
}
```

`finish_reason: "length"`. `message.content` was an empty string. `message.reasoning_content` was
6,564 characters of internal reasoning the player would never see, that consumed the entire
response budget.

## The fix

Adding `"thinking": {"type": "disabled"}` to the request body eliminates the failure mode entirely
and is materially cheaper — the identical prompt then completed in 957 total tokens with valid,
non-empty content. `GeminiNarrativeProvider`'s live testing did not show this specific failure mode
in this task's smaller sample, though Gemini also has its own separate `thoughtsTokenCount`
accounting (see the `gemini-token-accounting-bug.md` note) — the two are related but distinct
findings.

## Impact on this task's DeepSeek numbers

The **first** DeepSeek bakeoff pass (before this fix) showed 10/12 (`deepseek-v4-pro`) and 11/12
(`deepseek-v4-flash`) structural pass rates, with the failures concentrated on Vietnamese cases.
After the fix, a **fresh, full re-run** showed 12/12 and 11/12 respectively — see COMPARISON.md.
The pre-fix numbers should not be read as DeepSeek's narrative-quality ceiling; they were largely
an artifact of this adapter misconfiguration, now corrected.
