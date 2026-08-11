# Notable Finding: Gemini Adapter Undercounted Output Tokens (Thinking Tokens Ignored)

**Severity**: Medium (cost accounting only — never affected narrative content or pass/fail
verdicts). **Status**: Fixed during this task (commit `82c90e9`).

## What happened

`gemini-3.6-flash` returns `usageMetadata.thoughtsTokenCount` separately from
`usageMetadata.candidatesTokenCount`. The Gemini pricing page bills output "per 1M output tokens,
**including thinking tokens**" — but the adapter's original cost formula only read
`candidatesTokenCount`, silently excluding thinking tokens from every cost calculation.

## Direct evidence (raw API probe)

A trivial prompt ("say hi") returned:

```json
"usageMetadata": {
  "promptTokenCount": 3,
  "candidatesTokenCount": 9,
  "thoughtsTokenCount": 104,
  "totalTokenCount": 116
}
```

9 visible tokens, but 104 thinking tokens — over 10x the visible output, entirely excluded from the
original cost formula.

## The fix

`outputTokens = candidatesTokenCount + thoughtsTokenCount`. One new unit test asserts this
directly. All Gemini cost figures reported in this task's `gemini-3.5-flash-lite` samples and
COMPARISON.md use the corrected accounting; the `gemini-3.6-flash` bakeoff data predates this fix
and is flagged as an undercount wherever it is cited (see `gemini-quality/` sample notes).
