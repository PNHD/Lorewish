# LW-M2-R2 — Narrative Provider Bakeoff Comparison (REAL LIVE DATA)

**This supersedes the earlier "LIVE_BAKEOFF_NOT_RUN" version of this file.** The owner supplied
`GEMINI_API_KEY` and `DEEPSEEK_API_KEY` in a local, gitignored `.env.local` for an owner-initiated
local bakeoff. Both keys were loaded explicitly via `node --env-file=.env.local`, never inherited
from the ambient process environment, never committed, never logged, never set as a Supabase Edge
Function secret. All generations below used only the Narrative Golden Set's synthetic fixtures —
no real user/tester content was sent to any provider.

**Do not read the "reported final status" line without reading the caveats above each table.**
This bakeoff found and fixed three real bugs mid-campaign (two in this project's own engine code,
one in the DeepSeek adapter's default request shape) that materially affected earlier numbers —
each is documented in `notable-findings/` and linked below rather than silently corrected away.

## Exact models tested

| Provider | Tier | Model id | Adapter status |
|---|---|---|---|
| Gemini | Quality | `gemini-3.6-flash` | Real, live-tested — **quota-blocked mid-campaign** |
| Gemini | Cheap | `gemini-3.5-flash-lite` | Real, live-tested — fully clean data |
| DeepSeek | Quality | `deepseek-v4-pro` | Real, live-tested — fully clean data (post-fix) |
| DeepSeek | Cheap | `deepseek-v4-flash` | Real, live-tested — fully clean data (post-fix) |

Anthropic (`claude-sonnet-5`, from LW-M2-R1) was **not** re-tested in this task — no
`ANTHROPIC_API_KEY` was supplied.

## Structural pass rate / repair rate / cost / latency

| Model | Cases run | Pass rate | Repairs | Total cost (12 gens) | Median latency | Notes |
|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | 6 (partial — quota exhausted before a 2nd clean pass) | EN 6/6 (reliable); VI 3/6 (**unreliable**, see below) | EN 0; VI up to 5 (contaminated) | not comparable (pre-fix cost undercount) | 9.5s (pre-fix sample) | See caveat 1 |
| `gemini-3.5-flash-lite` | 12 (2 full passes) | **12/12 (100%)** | 0 | **$0.011981** ($0.000998/gen) | **2.24s** | Fully clean |
| `deepseek-v4-pro` | 12 (2 full passes) | **12/12 (100%)** | 0 | **$0.010052** ($0.000838/gen) | **12.42s** | Post thinking-mode fix |
| `deepseek-v4-flash` | 12 (2 full passes) | **11/12 (91.7%)** | 4 | **$0.002426** ($0.000202/gen) | **6.81s** | Post thinking-mode fix; 1 genuine schema-shape miss remains |

### Caveat 1 — `gemini-3.6-flash` data is partial and mixed pre/post-fix

`gemini-3.6-flash`'s free-tier daily quota is **20 requests/day per project per model** (confirmed
directly from the API's own 429 error body — not estimated). This task's testing (debugging plus
two bakeoff passes) exhausted it before a fully clean second pass could run. Consequences:

- The EN 6/6, 0-repair result is trustworthy (the `language_mixing` bug that affected this run
  never touches English verdicts).
- The VI numbers from the same two passes are **not** trustworthy — `language_mixing` false
  positives were confirmed to have caused spurious repairs/failures on Vietnamese content
  specifically (see `notable-findings/gemini-language-mixing-false-positive.md`). One VI sample was
  captured *after* the fix (`gemini-quality/representative-vi.md`) and passed cleanly, but that is
  a single data point, not a full pass.
- Cost/token figures from those same two passes **undercount** true cost — they predate the
  thinking-token accounting fix (`notable-findings/gemini-token-accounting-bug.md`).
- **`SECOND_RUN_PENDING_RATE_LIMIT`**: a full, clean, post-both-fixes bakeoff pass for
  `gemini-3.6-flash` should be run once the daily quota resets. Per the task brief's explicit
  instruction, no key rotation or quota circumvention was attempted to get around this.

### Caveat 2 — the DeepSeek "before" numbers are recorded, not hidden

The **first** DeepSeek bakeoff pass (before the thinking-mode fix,
`notable-findings/deepseek-thinking-mode-bug.md`) showed 10/12 (`deepseek-v4-pro`) and 11/12
(`deepseek-v4-flash`) — both worse than the post-fix numbers above and both explained by a since-
fixed adapter misconfiguration, not narrative-quality issues. The table above reports only the
authoritative, fully clean, post-fix re-run.

### Caveat 3 — `deepseek-v4-flash`'s remaining 1/12 failure is real and different in kind

After the thinking-mode fix, one case (`vi-fantasy-01`, second pass) still failed —
`schemaValid: false`, but this time the response *was* valid JSON that simply didn't match
`StructuredGenerationResultSchema` after two attempts. This is the residual, smaller risk this
task's model-discovery phase predicted in advance: DeepSeek's `response_format: json_object` mode
guarantees valid JSON syntax but not a specific shape. At ~4% (1/24 across both tiers post-fix)
this is a real, quantified reliability gap versus Gemini/Anthropic's schema-enforced structured
output — small, but non-zero, and should factor into eventual model selection (§10 of
`docs/NARRATIVE_MODEL_EVALUATION.md`).

## Continuity (3-turn EN + VI, quality-tier models)

| Model | EN continuity | VI continuity |
|---|---|---|
| `gemini-3.6-flash` | **Blocked — quota exhausted** | **Blocked — quota exhausted** |
| `deepseek-v4-pro` | **PASS** — see `continuity/en-fantasy-01-deepseek-v4-pro.md` | **PASS, 1 nuance flagged for human review** — see `continuity/vi-romance-01-deepseek-v4-pro.md` |

Both continuity tests ran through the **real** `submitTurn` pipeline (not the bakeoff harness's
isolated one-shot context), so scene history and recorded canon facts genuinely carried forward
exactly as they would in production. See also
`notable-findings/character-identity-architecture-gap.md` — a real, documented gap between the
Golden Set's richer fixtures and what the current turn-1 payload can express, affecting every
provider identically (not a provider quality difference).

## Notable strengths

- **DeepSeek `v4-flash`**: lowest cost and fastest latency of any candidate by a wide margin once
  the thinking-mode misconfiguration was fixed, with dialogue quality (see
  `deepseek-cheap/representative-en.md`) that reads as genuinely voiced, not generic.
- **Gemini `3.5-flash-lite`**: 100% structural reliability across 12/12 generations, fastest of the
  two Gemini tiers tested, no schema-shape risk (Gemini's `responseSchema` enforces shape server-
  side, unlike DeepSeek's `json_object` mode).
- **DeepSeek `v4-pro`**: EN sample includes clever, non-generic dialogue that reframes the premise
  rather than restating it (`deepseek-quality/representative-en.md`).

## Notable failures

- **`gemini-3.6-flash`**: free-tier daily quota (20/day) is low enough to block a same-day 2-pass
  bakeeoff entirely if any debugging calls are made first — a real operational constraint for
  future bakeoff sessions, not a model-quality finding.
- **`deepseek-v4-pro`/`vi-fantasy-01` pre-fix**: see `notable-findings/worst-failure-deepseek-pro-vi-fantasy-01.md` —
  the concrete failure that led to discovering the thinking-mode bug.
- **`deepseek-v4-flash`/`vi-fantasy-01` post-fix, second pass**: a genuine, smaller residual
  schema-shape miss (Caveat 3 above).

## What this comparison does NOT do

Does not select a production model. Does not claim Vietnamese or English naturalness superiority
between candidates — that judgment is explicitly reserved for human/native-speaker review of the
samples in this package, per the task brief. Does not include OpenAI (no adapter) or a fresh
Anthropic run (no key). See `docs/NARRATIVE_MODEL_EVALUATION.md` §10 for the recorded, unapplied
model-selection policy. **Verdict remains `MODEL_SELECTION_REVIEW_REQUIRED`.**
