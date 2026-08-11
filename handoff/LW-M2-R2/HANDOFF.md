# LW-M2-R2 Handoff — Real Narrative Provider Bakeoff + Production Model Selection Evidence

**Verdict: `PROVIDER_ADAPTER_EXTENDED. LIVE_BAKEOFF_PARTIALLY_COMPLETE. MODEL_SELECTION_REVIEW_REQUIRED.`**

Full narrative record: [CURRENT_WORK.md](../../CURRENT_WORK.md) (LW-M2-R2 section — "No-credential
phase" and "Live bakeoff phase" subsections) and
[docs/NARRATIVE_MODEL_EVALUATION.md](../../docs/NARRATIVE_MODEL_EVALUATION.md) §0/§0a/§7–§11. This
file is the compact index into this handoff package's evidence files.

## This task ran in two phases

1. **No-credential phase**: no provider key existed in this environment. Built a real, doc-verified
   Gemini adapter (never called live), fixed two known M2-R1 defects, fixed a concurrent-allowance
   race — all verified live against `lorewish-dev` where applicable. 54 tests.
2. **Live bakeoff phase**: the owner supplied `GEMINI_API_KEY`/`DEEPSEEK_API_KEY` in a local,
   gitignored `.env.local` and asked for the bakeoff to actually run. It did. Built a real DeepSeek
   adapter, ran the Golden Set against 4 model/tier combinations, found and fixed **three bugs**
   that were corrupting the evidence, produced real EN/VI samples, and ran a 3-turn continuity
   test. 73 tests (was 54).

## Headline results (phase 2)

| Model | Tier | Pass rate | Status |
|---|---|---|---|
| `gemini-3.6-flash` | Quality | EN 6/6 reliable, VI unreliable | **Partial — daily quota (20/day) exhausted mid-campaign** |
| `gemini-3.5-flash-lite` | Cheap | **12/12 (100%)** | Fully clean |
| `deepseek-v4-pro` | Quality | **12/12 (100%)**, post-fix | Fully clean |
| `deepseek-v4-flash` | Cheap | **11/12 (91.7%)**, post-fix | Fully clean, 1 genuine residual schema-shape miss |

No key rotation or quota circumvention was used anywhere in this task.
`SECOND_RUN_PENDING_RATE_LIMIT` for `gemini-3.6-flash`.

## Three bugs found and fixed because they were corrupting this task's own evidence

Each is documented with direct API-response evidence in
`narrative-samples/notable-findings/`, not just asserted:

1. **`language_mixing` false positive on Vietnamese diacritics** (Lorewish's own quality gate,
   `quality-gate.ts`) — flagged entirely correct Vietnamese prose. Fixed, 3 regression tests.
2. **Gemini adapter undercounted output tokens** (`providers.ts`) — ignored `thoughtsTokenCount`
   ("thinking" tokens, billed the same as visible output). Fixed, 1 regression test.
3. **DeepSeek thinking mode left at its default** (`providers.ts`) — could consume the *entire*
   `max_tokens` budget on invisible reasoning, producing empty content; the dominant cause of
   DeepSeek's initial 10/12 and 11/12 pre-fix pass rates. Fixed with `thinking:{type:"disabled"}`
   — also cut cost ~55% and latency ~37% on the same prompts. 1 regression test.

A fourth, related **production** fix (not bakeoff-only): a non-transport provider throw used to
crash `submitTurn` instead of resolving `GENERATION_FAILED` — found live via bug #3 above, fixed in
`turn-pipeline.ts`, 1 regression test.

## What this task does NOT claim

A complete `gemini-3.6-flash` dataset (quota-blocked). A narrative-quality *verdict* — the samples
exist for human/native-speaker review; this task does not itself judge naturalness. A resolved
model-selection decision. The `PRODUCTION_POLICY_CONSTRAINT` (both Gemini's and DeepSeek's terms
restrict to an 18+ audience; Lorewish is 13+) remains unresolved and unactioned.

## Credential handling (verified, see `security-results.txt` for the full addendum)

`GEMINI_API_KEY`/`DEEPSEEK_API_KEY` were loaded only via `node --env-file=.env.local`, never
inherited by this process's ambient environment, never committed (`.env.local` matches
`.gitignore`'s `*.local` pattern), never logged/printed by any script in this session, never
exposed via `EXPO_PUBLIC_*` (the naming convention itself prevents Expo's bundler from inlining
them), never set as a Supabase Edge Function secret. `submit-turn` was not redeployed in this
phase and has no real provider configured — no anonymous or authenticated production traffic was
ever routed to a real provider.

## File index

| File | Contents |
|---|---|
| `provider-models.txt` | Exact model ids, pricing, context limits, structured-output capability |
| `bakeoff-results.json` | Machine-readable real results — which models ran, which didn't, why |
| `model-evaluation-summary.md` | Compact human-readable version of the above |
| `bakeoff-raw/*.json` | Every raw bakeoff report generated in this task, pre- and post-fix, for full traceability |
| `test-results.txt` | `npm test` output — 73/73 passing |
| `cost-summary.txt` / `latency-summary.txt` | Real measured cost/latency per model, with caveats on which figures are trustworthy |
| `security-results.txt` | Advisor output, the 7/7 live-probe verification from phase 1, and the phase-2 credential-handling addendum |
| `git-status.txt` / `git-log.txt` / `git-diff.patch` | Repository state at handoff time, diff since LW-M2-R1's `68469d6` |
| `schema-migration-list.txt` | Confirms the migration is applied to `lorewish-dev` |
| `ci-results.txt` | GitHub Actions run status |
| `narrative-samples/` | Real EN/VI samples per model actually run, continuity transcripts, `notable-findings/`, `COMPARISON.md` |

## Implementation head

`IMPLEMENTATION_HEAD` at the time this file was finalized — see `git-log.txt` for the exact,
authoritative commit list (roughly a dozen commits across both phases: the Gemini adapter and two
polish fixes, docs, the DeepSeek adapter, the four bug fixes found during the live bakeoff, and the
final docs update). Draft PR #2 remains open and **unmerged**. This handoff package is **not**
committed to git (matching the LW-M2-R1/LW-M1-R3 precedent) and its packaging does not move
`IMPLEMENTATION_HEAD`.

## Recommended next task

1. Re-run `gemini-3.6-flash`'s bakeoff once its daily quota resets, for a directly comparable
   quality-tier dataset against `deepseek-v4-pro`.
2. Have a human — ideally a native Vietnamese speaker — review `narrative-samples/`, particularly
   the forms-of-address nuance flagged in the VI continuity transcript.
3. Resolve the `PRODUCTION_POLICY_CONSTRAINT` question independently.
4. Only then make a model-selection decision.
