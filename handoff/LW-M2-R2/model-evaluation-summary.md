# LW-M2-R2 — Model Evaluation Summary (REAL LIVE DATA)

Full detail: [docs/NARRATIVE_MODEL_EVALUATION.md](../../docs/NARRATIVE_MODEL_EVALUATION.md) §0/§7–§11,
[narrative-samples/COMPARISON.md](narrative-samples/COMPARISON.md).

## Status: `MODEL_SELECTION_REVIEW_REQUIRED` (unchanged)

A real, live bakeoff was run — this is not a re-statement of the earlier "no credential" result.
No production model is selected, per the task brief's explicit instruction that model selection
requires human review of the results below first.

## What was run

| Model | Tier | Pass rate | Repairs | Total cost (12 gens) | Median latency |
|---|---|---|---|---|---|
| `gemini-3.6-flash` | Quality | Partial — EN 6/6 reliable, VI unreliable (bug-contaminated) | n/a | undercounted (bug) | 9.5s (pre-fix) |
| `gemini-3.5-flash-lite` | Cheap | **12/12 (100%)** | 0 | **$0.011981** | **2.24s** |
| `deepseek-v4-pro` | Quality | **12/12 (100%)**, post-fix | 0 | **$0.010052** | **12.42s** |
| `deepseek-v4-flash` | Cheap | **11/12 (91.7%)**, post-fix | 4 | **$0.002426** | **6.81s** |

## Three bugs found and fixed during this bakeoff (details in narrative-samples/notable-findings/)

1. **`language_mixing` false positive on Vietnamese diacritics** (Lorewish's own quality gate) —
   was flagging entirely correct Vietnamese prose as mixed-language, corrupting VI structural
   evidence until fixed.
2. **Gemini adapter undercounted output tokens** (ignored `thoughtsTokenCount`) — cost-accounting
   only, never affected pass/fail verdicts.
3. **DeepSeek thinking mode left at its default** — could silently consume the entire `max_tokens`
   budget on invisible reasoning, producing empty, unparseable output. This was the dominant cause
   of DeepSeek's initial structural failures; fixing it (`thinking:{type:"disabled"}`) improved
   pass rate, cost, AND latency simultaneously.

A fourth, related engine bug was also found and fixed: a non-transport provider throw (as DeepSeek
produced before fix #3) crashed `submitTurn`/the bakeoff harness instead of resolving
`GENERATION_FAILED` — a real production robustness gap, not bakeoff-only.

## `gemini-3.6-flash` is the one incomplete result

Its free-tier daily quota is **20 requests/day/project/model** (confirmed from the API's own error
body). This task's debugging plus two bakeoff passes exhausted it before a fully clean second pass
could run. Per the task brief, no quota circumvention (retries past the limit, key/account
rotation) was attempted. **`SECOND_RUN_PENDING_RATE_LIMIT`** — a clean re-run is recommended once
the daily quota resets.

## Continuity (3-turn EN + VI)

Only possible for DeepSeek's quality tier today (Gemini blocked by quota). Both EN and VI passed;
one nuanced forms-of-address observation is flagged for human/native-speaker judgment rather than
resolved automatically. See `narrative-samples/continuity/`.

## `PRODUCTION_POLICY_CONSTRAINT` (unchanged from the prior version of this file)

Both Gemini's and DeepSeek's current API terms restrict the calling service to an 18+ audience.
Lorewish is a 13+ mainstream product. Still unresolved, still not acted on automatically.

## Recommended next task

1. Re-run `gemini-3.6-flash`'s bakeoff once its daily quota resets, for a fully clean, directly
   comparable quality-tier dataset across both providers.
2. Have a human (ideally a native Vietnamese speaker) review `narrative-samples/` — particularly
   the forms-of-address nuance flagged in the VI continuity transcript.
3. Resolve the `PRODUCTION_POLICY_CONSTRAINT` question independently of (1)/(2).
4. Only then make a model-selection decision, per the recorded (but not yet applicable) policy in
   `docs/NARRATIVE_MODEL_EVALUATION.md` §10.
