# Worst Notable Failure: `deepseek-v4-pro`, `vi-fantasy-01`, Pre-Fix

Per the task brief's instruction to include the worst notable failure separately, not only
representative/typical samples.

**Case**: `vi-fantasy-01`. **Model**: `deepseek-v4-pro`. **When**: before the thinking-mode fix
(see `deepseek-thinking-mode-bug.md`) — included here specifically as the concrete failure that led
to discovering that bug, not as a claim about the model's current (post-fix) reliability, which is
shown separately in `deepseek-quality/representative-vi.md` using the same case, post-fix.

## What happened

Both the initial generation attempt and the one automatic repair attempt failed identically:

```json
{
  "caseId": "vi-fantasy-01",
  "schemaValid": false,
  "qualityGatePassed": false,
  "qualityFailures": ["malformed_choices"],
  "repairRequired": true,
  "finalPass": false,
  "providerErrorNote": "deepseek response content was not valid JSON"
}
```

This pattern reproduced consistently: 2/2 official bakeoff passes before the fix, plus 2 additional
ad-hoc single-shot attempts during this task's diagnostic investigation — 4/4 failures for this
exact case before the root cause (reasoning tokens consuming the entire `max_tokens` budget, see
the linked finding) was identified and fixed.

## Why this is the right failure to show, not a cherry-picked worst case

This was not selected by searching for the single worst output across many candidates — it is the
**first** structural failure this task's DeepSeek bakeoff produced, and it directly caused the
adapter fix documented in `deepseek-thinking-mode-bug.md`. The turn produced **zero** visible
narrative — the pipeline correctly resolved this as `GENERATION_FAILED` after the repair attempt
also failed, never committing corrupted or empty content as canon (per
CONTINUOUS_PLAY_CONTRACT.md's "poor prose is never silently committed" rule, exercised here against
real provider output, not just a test double).

## Resolution

Fixed (`thinking:{type:"disabled"}`, commit `9e76978`). Re-run of the identical case, same model,
post-fix: 12/12 across both passes, this case included, 0 repairs. See
`deepseek-quality/representative-vi.md`.
