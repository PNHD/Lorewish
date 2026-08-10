# Current Work

**Task**: LW-M2-R2 — Real Narrative Provider Bakeoff + Production Model Selection Evidence
**Status**: **PROVIDER_ADAPTER_EXTENDED. LIVE_BAKEOFF_PARTIALLY_COMPLETE. MODEL_SELECTION_REVIEW_REQUIRED.**
**Updated mid-task**: this section originally recorded `LIVE_BAKEOFF_NOT_RUN` (no provider
credential existed in this environment at the time — see the "No-credential phase" content below,
kept intact). The owner then supplied `GEMINI_API_KEY`/`DEEPSEEK_API_KEY` in a local, gitignored
`.env.local` and asked for the bakeoff to actually run. It did — see "Live bakeoff phase" below,
inserted just above the verdict, for the real results, three bugs found and fixed mid-campaign, and
what remains incomplete (`gemini-3.6-flash`'s daily quota).

## No-credential phase (original record, kept intact)

Continues from LW-M2-R1's `REAL_NARRATIVE_PROVIDER_PENDING` verdict. No provider credential
(`GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`) existed in this
environment at the time — checked as variable names only, values never printed — so no live
bakeoff, no real narrative-quality comparison, and no narrative samples were produced for any
candidate model, exactly as this task's credential-safety rules require. What this task *could* do
without a credential was done and verified: a real Gemini adapter, two live-verified bug fixes, an
allowance race fix, 19 new tests, and full model-discovery documentation. See
[docs/NARRATIVE_MODEL_EVALUATION.md](docs/NARRATIVE_MODEL_EVALUATION.md) §0a/§7–§10 for the
provider-evaluation half of this record; the rest of this section covers the engine-layer work from
that phase.

## Baseline (verified, not trusted from the task brief)

- `origin/main`: unchanged since LW-M2-R1 (this task did not touch `main`).
- Branch: continued on **`feature/lw-m2-story-engine-v1`** (the task brief's own instruction:
  "continue from the current M2 branch"), not a new branch — this task is a direct continuation of
  LW-M2-R1's unfinished provider work, not a new vertical slice.
- Starting HEAD: `68469d6` (`docs: LW-M2-R1 CURRENT_WORK.md record`) — confirmed via `git log`
  before any change, matching the task brief's stated recent-commits list.
- `handoff/LW-M1-R3/` and `handoff/LW-M2-R1/` were already untracked at task start (established
  project pattern — handoff directories are packaging output, not source); left untouched.
- Linked Supabase project reconfirmed unchanged: `lorewish-dev` / `sfarcofvqfeobtcizxyv` /
  `ap-southeast-1`, via `npx supabase projects list` before any migration was pushed.
- Read in full before any change, per the task brief's "do not trust prior summaries" instruction:
  this file (then ending at LW-M2-R1's verdict), `docs/NARRATIVE_MODEL_EVALUATION.md`,
  `docs/NARRATIVE_QUALITY_CONTRACT.md`, `docs/CONTINUOUS_PLAY_CONTRACT.md`, and every file under
  `supabase/functions/_shared/engine/` plus both Edge Function entrypoints.

## Credential check (names only, never printed, never searched for in history)

`GEMINI_API_KEY`: absent. `GOOGLE_AI_API_KEY`: absent. `DEEPSEEK_API_KEY`: absent.
`ANTHROPIC_API_KEY`: absent (also absent in LW-M2-R1; unchanged). `.env.local` contains only the two
`EXPO_PUBLIC_SUPABASE_*` values, as in LW-M2-R1.

Per the task brief: **`GEMINI_API_KEY_REQUIRED`** — Gemini live evaluation stopped before any network
call. **`DEEPSEEK_API_KEY_REQUIRED`** — DeepSeek adapter work did not proceed past model-id
documentation (see NARRATIVE_MODEL_EVALUATION.md §8); Gemini adapter work continued as instructed
for a missing-DeepSeek-only case, and turned out to be blocked by the same missing-Gemini-key rule
in the end, so the net live-bakeoff outcome is "not run for any provider," recorded honestly rather
than as a partial/misleading result.

## Gemini Adapter — Implemented, Never Called Live

`GeminiNarrativeProvider` (`supabase/functions/_shared/engine/providers.ts`) replaces the LW-M2-R1
typed stub with a real adapter against `generateContent`
(`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`), doc-verified
2026-08-10 (full source list and findings: NARRATIVE_MODEL_EVALUATION.md §7):

- Structured output via `generationConfig.responseSchema` / `responseMimeType: "application/json"`,
  reusing the same JSON schema object the Anthropic adapter already uses for its tool definition —
  one schema, two providers, no duplicated business logic in either adapter.
- API key sent via the `x-goog-api-key` **header**, deliberately not the legacy `?key=` query
  parameter, so it never appears in a URL or server access log.
- Bounded 30s timeout via `AbortController`; HTTP 5xx/429 and a genuine timeout both normalize to
  `ProviderTransportError` (triggers the pipeline's existing one-shot transport retry); any other
  non-2xx, or a response with no usable candidate text, or candidate text that isn't valid JSON,
  throws a plain `Error` — never the raw response body concatenated with the API key, since the key
  is never part of any request/response body to begin with.
- Real token usage (`usageMetadata.promptTokenCount` / `candidatesTokenCount`) and cost computed
  from the exact per-model pricing table in NARRATIVE_MODEL_EVALUATION.md §7 — an unrecognized model
  id fails at construction time rather than silently billing against the wrong tier.
- `selectProvider()` now accepts `LOREWISH_NARRATIVE_PROVIDER=gemini` with
  `GEMINI_API_KEY`/`GOOGLE_AI_API_KEY` and `LOREWISH_NARRATIVE_MODEL` (defaults to
  `gemini-3.6-flash`); a `DeepSeekNarrativeProvider` typed stub was added for registry symmetry
  (matches the OpenAI stub's existing shape) but is not wired to any credential-checked path since
  none exists.
- **Never exercised against a live network call** — no `GEMINI_API_KEY` in this environment. 12 new
  unit tests (`providers.test.ts`) mock `fetch` to verify parsing, cost accounting, the
  `x-goog-api-key`-not-query-string behavior, and every error-normalization branch (5xx, 429,
  network failure, timeout, missing candidates, invalid JSON candidate text) — this is a test of the
  adapter's own contract, not a narrative-quality claim.

## Two Known M2-R1 Polish Issues — Fixed and Verified Live

Both issues from LW-M2-R1's "Known Issues" section (cross-user turn submission and an invalid
`selected_choice_id` both returning generic HTTP 500 instead of a clean 4xx) are fixed:

- **Migration**: `supabase/migrations/20260810220000_m2_error_mapping_and_allowance_fix.sql`,
  applied to `lorewish-dev` via `supabase db push --linked` (confirmed via `migration list --linked`:
  local and remote both list `20260810220000`). `lw_precheck_and_start_turn` now raises with an
  explicit SQLSTATE for these two specific, already-existing exception sites — `42501`
  (insufficient_privilege) for "run not found or not owned by caller" and for the idempotent-turn-id
  ownership check, `22023` (invalid_parameter_value) for an invalid `selected_choice_id` and for a
  `turn_id` reused across a different run. No other exception sites were touched — a deliberately
  bounded change, not a general audit of every `raise exception` in the file.
- **TypeScript boundary**: `repository.ts` gains `RepositoryForbiddenError`,
  `RepositoryValidationError`, and a pure `mapRepositoryErrorToHttpStatus()` function — factored out
  of the Deno-only `submit-turn/index.ts` specifically so this fix is unit-testable under
  vitest/Node (4 new tests in `repository.test.ts`). `supabase-repository.ts` inspects
  `PostgrestError.code` (the SQLSTATE PostgREST echoes back) and throws the typed error instead of a
  generic `Error`; every other RPC error still falls through to a generic `Error` unchanged.
  `submit-turn/index.ts`'s catch-all now calls `mapRepositoryErrorToHttpStatus()` instead of always
  answering 500. `InMemoryTurnRepository` (the test double) throws the same typed errors for its
  closest analogous conditions, so `turn-pipeline.test.ts` gained 2 new tests asserting the specific
  error type, not just that *some* error was thrown.
- **Live verification, not just source reading**: `submit-turn` was redeployed to `lorewish-dev`
  (`supabase functions deploy submit-turn --import-map supabase/functions/deno.json` — the CLI's
  auto-detection of `deno.json` did not fire without the explicit flag in this environment, a CLI
  quirk unrelated to the fix itself) and a 7-probe live script — two ephemeral test accounts created
  and deleted via the Auth Admin API, cleanup re-verified by re-query (0 remaining) — confirmed **all
  7/7 pass**: cross-user submission → `403 {"error":"forbidden"}`; invalid choice id →
  `400 {"error":"invalid_request"}`; the owner's own normal turn still succeeds (no regression); and
  the daily `usage_counters` count for the owner ends at exactly 2 (start + the one real turn),
  proving the two rejected attempts consumed no allowance. The probe script and its
  service-role-key-bearing key file lived only in the session scratchpad, outside the repository, and
  were deleted after use — not included in this task's handoff, matching LW-M2-R1's established
  practice for this exact category of artifact.

## Concurrent Allowance Overrun — Fixed (Option A, cheap reservation)

LW-M2-R1's recorded known issue ("usage_counters may allow approximate overrun when the same user
generates concurrently across different runs") is fixed in the same migration, not deferred to
Option B (document-only):

- The daily-cap check and the allowance reservation now happen **atomically in the same transaction**
  as part of `lw_precheck_and_start_turn`: the existing `usage_counters` upsert already takes a row
  lock on the caller's row, held for the rest of that transaction; the reservation increment was
  moved to happen inside that same lock window (previously it happened only at `lw_commit_turn`, a
  separate, later transaction after the network-bound provider call — the actual race window).
  Concurrent precheck calls for the same user across *any* of their runs now serialize on this row,
  closing the check-then-later-increment gap the old design had, not just the same-run case the
  existing "one in-flight turn per run" guard already covered.
- `lw_commit_turn` no longer increments `usage_counters` (already reserved at precheck).
  `lw_fail_turn` releases the reservation (`generation_count - 1`, floored at 0, scoped to the
  current UTC day) since a failed turn must not count against the cap — verified live by the same
  probe run above (2 rejected/failed attempts, final count still exactly 2, not 4).
- **Documented residual risk, not fixed further** (per the task brief's "do not overbuild a credit
  ledger" instruction): if the Edge Function process is killed between the reservation and either
  commit or fail (a platform execution-timeout kill, not a normal transport/quality-gate failure —
  those already resolve via the existing retry/fail paths inside the same call), one allowance unit
  leaks for that user until the next UTC day's reset. Judged acceptable for closed M2 testing; full
  reservation-expiry/GC would start to resemble the M4 credit ledger this task is explicitly not
  scoped to build.

## Tests / CI

- **54 tests, 5 files, all passing** (`npm test`, vitest) — was 35 in LW-M2-R1. New: 12
  `providers.test.ts` (Gemini adapter parsing/cost/error-normalization/timeout/malformed-response),
  4 `repository.test.ts` (the 403/400/500 HTTP-mapping cases), 3 new `turn-pipeline.test.ts` cases
  (the two typed-error assertions above, plus a provider-agnostic proof that schema-valid-but-
  quality-gate-failing output from *any* `NarrativeProvider` implementation — not only the fake
  provider's own test hooks — is never committed as canon).
- `tsc --noEmit`, `expo lint`, `npm run export:web` all re-run clean after this task's changes.
- **CI**: unchanged from LW-M2-R1's shape. No provider keys, no paid/live model calls anywhere in
  `.github/workflows/ci.yml` — the new `providers.test.ts` suite mocks `fetch` throughout, matching
  the existing "deterministic, no network" rule for routine CI. Not yet re-verified on GitHub
  Actions for this task's commits at the time this section was written; see the handoff's
  `ci-results.txt` for whether a push happened before the handoff was finalized.

## Security

No new tables, RLS policies, or grants in this task's migration — only `create or replace` on three
already-existing, already-least-privilege `SECURITY DEFINER` functions (same signatures, same
`revoke ... from public, anon, authenticated` then explicit `grant ... to authenticated` pattern
re-applied for auditability, per this project's standing rule that a function's grant is never
assumed to persist correctly without being explicit in the migration that touches it).
`supabase db advisors --linked`: **5 expected WARN** (unchanged — one per intentionally
client-callable `lw_*` function, same as LW-M2-R1), **0 performance findings**. The live 7-probe
verification above is itself a security regression check for the two functions this migration
changed.

## `PRODUCTION_POLICY_CONSTRAINT`

Recorded in full in NARRATIVE_MODEL_EVALUATION.md §9, not repeated here in full: both Gemini's and
DeepSeek's current API terms restrict the calling service to an 18+ audience, while Lorewish is an
explicitly 13+, not-18+ product. **Lorewish's age policy was not changed** — this is flagged for
owner/legal review before either provider is treated as production-eligible, per the task brief's
explicit instruction not to resolve this automatically.

## Known Issues / Unresolved (LW-M2-R2)

- No real narrative-quality evidence exists for any provider — the entire point of this task's
  brief — because no provider credential exists in this environment. This is not a partial result to
  round up; `MODEL_SELECTION_REVIEW_REQUIRED` stands until an owner supplies a credential and a real
  `npm run bakeoff` run happens.
- The §9 policy constraint is a real, unresolved product/legal question, not a formality — it may
  independently rule out Gemini and/or DeepSeek regardless of narrative quality.
- DeepSeek's `response_format: json_object` does not enforce a response *shape* the way Gemini's
  `responseSchema` or Anthropic's tool-forced schema do (NARRATIVE_MODEL_EVALUATION.md §8) — a real
  capability gap a future DeepSeek adapter would need to design around (embedding the schema into
  the prompt itself), not just a smaller implementation task than the other two adapters.
- The crash-window allowance-leak tradeoff above (one unit, until next UTC day, only on a process
  kill between reservation and commit/fail) is accepted, not eliminated.

## Live bakeoff phase (owner-supplied credentials, mid-task)

The owner created `.env.local` (local, gitignored, containing `GEMINI_API_KEY` and
`DEEPSEEK_API_KEY`) and asked for the bakeoff to actually run, the DeepSeek adapter to be built for
real, and a real comparison package produced. Loaded explicitly via `node --env-file=.env.local`
for `npm run bakeoff` — never inherited by this process's ambient environment, never committed,
never logged, never exposed via `EXPO_PUBLIC_*` (both key names lack that prefix, so Expo's
bundler never inlines them into any client bundle — confirmed, not assumed), never set as a
Supabase Edge Function secret (the deployed `submit-turn` function is untouched by this work and
still has no real provider configured — no anonymous or authenticated production traffic was ever
routed to a real provider).

**Real `DeepSeekNarrativeProvider` implemented** (`supabase/functions/_shared/engine/providers.ts`,
commit `f6a6266`): OpenAI-compatible `/chat/completions`, `Authorization: Bearer`, the target JSON
shape spelled out in the prompt since `response_format:json_object` doesn't enforce one, cache-aware
cost accounting. 13 new unit tests.

**Real bakeoff run**: 6 Golden Set cases × 2 passes, against `gemini-3.6-flash`,
`gemini-3.5-flash-lite`, `deepseek-v4-pro`, `deepseek-v4-flash`. Full results:
[docs/NARRATIVE_MODEL_EVALUATION.md](docs/NARRATIVE_MODEL_EVALUATION.md) §11 and
`handoff/LW-M2-R2/narrative-samples/COMPARISON.md`. Headline numbers: `gemini-3.5-flash-lite`
12/12 (100%, 0 repairs), `deepseek-v4-pro` 12/12 post-fix, `deepseek-v4-flash` 11/12 post-fix;
`gemini-3.6-flash` **partial** — its free-tier daily quota (20 requests/day/project/model,
confirmed from the API's own error body) was exhausted mid-campaign, EN results reliable, VI
results and cost figures from that run are not. No quota circumvention was attempted (no retry
past the limit, no key/account rotation) — `SECOND_RUN_PENDING_RATE_LIMIT`.

**Three real bugs found and fixed because they were corrupting this task's own evidence** (full
detail: `handoff/LW-M2-R2/narrative-samples/notable-findings/`, each with direct API-response
evidence, not inference):

1. **`quality-gate.ts`'s `language_mixing` check false-positived on Vietnamese diacritics**
   (commit `9ab8f25`) — JS's ASCII-only `\b` treated a diacritic letter as a word boundary,
   fragmenting a correct word like "mắt" into a piece ("m") that could chain into a false 4-word
   "English run," flagging entirely correct Vietnamese prose. This is why `gemini-3.6-flash`'s VI
   verdicts from its first two passes are not used as evidence. 3 regression tests added.
2. **`GeminiNarrativeProvider` undercounted output tokens** (commit `82c90e9`) —
   `usageMetadata.thoughtsTokenCount` (Gemini's billed "thinking" tokens) was not summed into cost.
   A trivial prompt showed 9 visible tokens vs. 104 thinking tokens. Fixed; 1 regression test.
3. **`DeepSeekNarrativeProvider` left thinking mode at its default** (commit `9e76978`) — DeepSeek
   V4's reasoning tokens draw from the same `max_tokens` budget as the visible answer; for some
   prompts (Vietnamese narrative generation especially) reasoning alone consumed the entire
   2048-token budget, producing empty, unparseable output — the dominant cause of DeepSeek's
   initial 10/12 and 11/12 pre-fix pass rates. Fixed with `thinking:{type:"disabled"}`, which also
   cut cost ~55% and latency ~37% on the same prompts. 1 regression test.

A fourth, related **production** robustness gap was found and fixed alongside these (commit
`56e6006`): `attemptGeneration()` in `turn-pipeline.ts` only caught `ProviderTransportError` from a
provider's `generateTurn()` call; any other throw (as DeepSeek produced before fix #3) propagated
uncaught, which would have crashed a real `submitTurn` call instead of resolving
`GENERATION_FAILED` — not a bakeoff-only issue. Now treated as the existing `unusable_output`
class, same as a schema-validation failure. `bakeoff.ts`'s `runCase` got the equivalent fix so one
flaky case no longer aborts the whole harness run. 1 regression test.

**Continuity (3-turn EN + VI)**, run through the real `submitTurn`/`InMemoryTurnRepository`
pipeline (not the bakeoff harness's isolated context): only possible for DeepSeek's quality tier
this task (Gemini blocked by quota). EN passed cleanly. VI passed with one nuance flagged for
human/native-speaker review (a brief "em"→"tôi" self-reference shift during an emotional beat —
may be natural register variation, may be drift). A separate architecture finding surfaced here,
affecting every provider identically: the real `StorySetup` payload has no field for pre-authored
character identity, so every model invents its own NPC names/genders rather than matching the
Golden Set's designed characters — not a provider defect, recorded in
`notable-findings/character-identity-architecture-gap.md`.

**73/73 tests pass** (was 54 at the end of the no-credential phase; +19 from the DeepSeek adapter
and the four bug-fix regression tests).

## M2-R2 Verdict

**PROVIDER_ADAPTER_EXTENDED. LIVE_BAKEOFF_PARTIALLY_COMPLETE. MODEL_SELECTION_REVIEW_REQUIRED.**

What is claimed: real, live-tested Gemini and DeepSeek adapters (Gemini's quality tier partially —
see above); two known M2-R1 defects fixed and verified live; the concurrent-allowance race closed;
a real bakeoff ran against 4 of the 5 model/tier combinations with genuine EN/VI samples and a real
comparison package; three evidence-corrupting bugs found and fixed mid-campaign rather than
reported around; 73/73 tests pass; a real product/legal policy conflict recorded, not glossed over.

What is **not** claimed: a complete, clean `gemini-3.6-flash` dataset (quota-blocked, partial);
any narrative-quality *verdict* — the samples exist for human/native-speaker review, but this task
does not itself judge naturalness; a resolved model-selection decision; GitHub Actions CI results
for every commit in this phase (the code-fix commits' own CI runs were not individually awaited
given the volume of commits this live phase produced — see the handoff's `ci-results.txt` for what
was and wasn't verified).

**Recommended next task**: re-run `gemini-3.6-flash`'s bakeoff once its daily quota resets, for a
directly comparable quality-tier dataset against `deepseek-v4-pro`. Have a human — ideally a native
Vietnamese speaker — review `handoff/LW-M2-R2/narrative-samples/`, particularly the forms-of-address
nuance in the VI continuity transcript. Resolve the §9 `PRODUCTION_POLICY_CONSTRAINT` question
independently. Only then make a model-selection decision.

---

**Task**: LW-M2-R1 — Real Interactive Story Engine Vertical Slice
**Status**: **ENGINE_IMPLEMENTATION_PASS. REAL_NARRATIVE_PROVIDER_PENDING.** Every layer of the
vertical slice is implemented, live-deployed to `lorewish-dev`, and verified against real HTTP
calls — turn state machine, atomic commit, idempotency, branch replay, canon isolation, RLS/grant
adversarial probes. No AI provider credential exists in this environment, so no real-model
narrative-quality claim is made; the engine runs against a documented fake deterministic provider.
`REPOSITORY_VISIBILITY_REVIEW_REQUIRED` (M1) is unchanged and still open.

## Baseline (verified, not assumed)

- `origin/main` at task start: `20d27a36e6b849239a6a5d0bdd62b007ea44bdb4` — confirmed via `git fetch`
  + `git rev-parse origin/main`, matching the task brief's (explicitly untrusted) value. The brief's
  instruction to re-verify rather than trust it was followed.
- Branch: **`feature/lw-m2-story-engine-v1`**, created from `origin/main` at that exact SHA (`git
  checkout -b feature/lw-m2-story-engine-v1 origin/main`) — not from the old M1 feature branch.
- **IMPLEMENTATION_HEAD: `f1d446c847115ea5a65466250ff202132b71b469`** — the commit containing the
  full runtime schema, engine code, tests, UI, and CI changes. This CURRENT_WORK.md update is a
  second, docs-only commit on top of it; handoff evidence is generated after both exist, per the
  established M1 property that packaging never moves the head it describes.
- Local Supabase CLI: no `deno`, no running Docker Desktop, `npx supabase` (v2.113.0) used
  throughout — same environment shape as M1's sessions. `npx supabase projects list` confirmed the
  linked project is `lorewish-dev` (`sfarcofvqfeobtcizxyv`, `linked: true`) and
  `doodle-world-studio` (`etmqrpoefkcahyvaimiw`) is not linked, before any migration was pushed.

## Runtime Domain — Schema

`supabase/migrations/20260810190000_m2_story_engine_schema.sql`, applied to `lorewish-dev` via
`supabase db push --linked` and confirmed via `supabase migration list --linked` (remote timestamp
matches local). Tables: `player_runs`, `run_branches`, `scenes`, `turns`, `canon_facts`,
`usage_counters`. No character-chat, credit-ledger, or moderation-audit tables — out of M2 scope.

- **Branch-safe scene ordering**: scenes are ordered `(run_branch_id, seq_in_branch)`, branch-local
  and starting at 0 — not one global sequence. "Replay from here" does not copy scenes; it stores
  `fork_scene_id` (a pointer into the parent branch) and starts its own `seq_in_branch` at 0. The
  full playable history of a branch is resolved by `lw_branch_scene_ids()`, a recursive SQL
  function walking the branch-ancestor chain — reimplemented once more in TypeScript
  (`supabase-repository.ts`, for the Edge Function's service-role reads, since granting the
  internal helper to `service_role` was not verified) and a third time in the in-memory test
  double, kept deliberately close to both so a divergence shows up as a failing test rather than
  silent drift.
- **Canon isolation**: `canon_facts.scope ∈ {run, branch}`. `run`-scope is visible from every branch
  of the `PlayerRun`; `branch`-scope is visible only where the target branch's resolved scene
  history includes the fact's `source_scene_id` — isolation falls out of the same
  branch-ancestor-chain resolution rather than a second, separately-maintained rule. Verified live
  (see Security below): a fact recorded on branch A after a fork point does not appear in branch
  B's context, and a run-scoped fact appears on both.
- **Turns**: `id` IS the client-generated `turn_id` (CONTINUOUS_PLAY_CONTRACT.md §7) — the primary
  key itself is the idempotency guarantee. `generation_attempt_count`, `provider_cost_micros`
  (micro-dollars, no floats), and `user_allowance_debited` are tracked as three separate concepts
  per NARRATIVE_QUALITY_CONTRACT.md §D's billing rule, verified live to diverge correctly on a
  forced failure (attempt_count=2, cost recorded, `user_allowance_debited=false`).
- **No client mutation path exists** for `player_runs`/`run_branches`/`scenes`/`turns`/`canon_facts`:
  `authenticated` holds `SELECT` only on all six new tables (verified live, see Security). Every
  write goes through five `SECURITY DEFINER` functions — `lw_precheck_and_start_turn`,
  `lw_commit_turn`, `lw_fail_turn`, `lw_replay_from_scene`, `lw_get_run_state` — each verifying
  `(select auth.uid())` ownership itself rather than trusting any client-supplied id, and each
  following the LW-M1-R3 rule (`revoke ... from public, anon, authenticated` before any selective
  re-grant, with the authorization contract documented in the function's own header comment). A
  sixth function, `lw_branch_scene_ids`, is a read-only internal helper with **no** grant to any
  client role at all — confirmed live (`proacl` names neither `anon` nor `authenticated`).

## Continuous Play Contract — Implemented as Executable Behavior

`supabase/functions/_shared/engine/turn-pipeline.ts` implements the full
PRECHECK → GENERATING → VALIDATING → COMMITTING → RESOLVED lifecycle:

- Idempotent `turn_id`: a duplicate submission returns the committed result rather than
  regenerating — verified both in unit tests and live (see below).
- One transparent automatic retry for transport failure only; one automatic repair (with the
  failure reason fed back into the prompt) for a quality-gate/moderation failure — never both paths
  on the same failure class, matching NARRATIVE_QUALITY_CONTRACT.md §D and
  CONTINUOUS_PLAY_CONTRACT.md §8.
- `boundary_kind = ending` is set only from the provider's own structured field, never inferred
  from prose shape — the quality gate additionally catches an *abrupt pseudo-ending* (prose that
  reads like "The End." while `boundary_kind` is not `ending`) as a distinct failure class.
- Failure never masquerades as an ending: `GENERATION_FAILED` never commits a Scene, never debits
  allowance, and the run re-derives to `CONTINUE_READY` at the last durable scene — verified live
  (see Security/Live probes below), not only in the in-memory unit tests.
- "Replay from here" (`lw_replay_from_scene`) is a pure state write: no provider call, no
  allowance touch, cannot fail for provider reasons. Verified live: the prior branch is retained,
  not deleted.

## Canonical-State Commit Point

`lw_commit_turn` is the single atomic transaction per CONTINUOUS_PLAY_CONTRACT.md §4: Scene +
CanonFacts + Turn success + allowance debit together, or none of it. Verified live with a forced
quality-gate failure (`__SIMULATE_WRONG_LANGUAGE__`, fails both the initial attempt and the one
repair): scene count stayed at 1 (no partial write), `generation_attempt_count = 2`,
`user_allowance_debited = false`.

## AI Provider Architecture

`NarrativeProvider` (`supabase/functions/_shared/engine/types.ts`) is a one-method interface,
implemented by `FakeNarrativeProvider` (deterministic, no network, used everywhere in this task's
own verification) and `AnthropicNarrativeProvider` (`claude-sonnet-5`, request shape re-verified
2026-08-10 against `https://platform.claude.com/docs/en/api/messages` — endpoint, headers,
`tool_choice`-forced structured output, and the model's rejection of non-default
temperature/top_p/top_k — **never exercised against a live network call**, since no
`ANTHROPIC_API_KEY` exists in this environment). `OpenAiNarrativeProvider`/`GeminiNarrativeProvider`
are typed stubs that throw a clear "not implemented, no credential" error. Provider selection is a
`LOREWISH_NARRATIVE_PROVIDER`/`LOREWISH_NARRATIVE_MODEL` env-var configuration read inside the Edge
Function — no call site in `turn-pipeline.ts`/`quality-gate.ts`/`context-assembler.ts` names a
provider. No provider is called from the client, and no provider key is ever sent to the client
(`supabase/functions/submit-turn/index.ts` is the sole server-side call site).

**`NARRATIVE_PROVIDER_CREDENTIAL_REQUIRED`**: checked directly (variable names only, values never
printed or searched for in history) — neither `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, nor
`GEMINI_API_KEY`/`GOOGLE_AI_API_KEY` is set locally. Full detail, including exactly which env var(s)
the owner needs to set for each provider: [docs/NARRATIVE_MODEL_EVALUATION.md](docs/NARRATIVE_MODEL_EVALUATION.md).

## EN/VI Narrative Quality

`quality-gate.ts` implements every deterministic check in NARRATIVE_QUALITY_CONTRACT.md §D's
minimum set (expected language, language drift, language mixing, empty narrative, unresolved
template tokens, duplicate sentences, excessive repetition, meta-AI phrase leakage, prohibited
"to be continued" copy in every state, abrupt pseudo-ending, malformed/cosmetic-duplicate choices) —
15 unit tests, all passing, each targeting one specific failure class with both a positive and
negative case where meaningful. Vietnamese-language detection uses a word-level diacritic-ratio
heuristic (not a sentence-count threshold, which under-triggered on single-sentence output during
development — caught and fixed by the test suite itself before this was committed).

The Narrative Golden Set (`supabase/functions/_shared/engine/golden-set/cases.ts`) has the required
6 original scenarios (EN × Fantasy/Romance/Adventure, VI × Fantasy/Romance/Adventure), each
specifying premise, player role, starting situation, character identity, an initial decision,
expected invariant facts, and prohibited contradictions — Vietnamese cases additionally specify the
four-slot address model (NARRATIVE_QUALITY_CONTRACT.md §C). The dev-only bakeoff harness (`npm run
bakeoff`) ran once in this task, against the fake provider (no credential): **6/6 passed, 0 repairs
required**. This proves the harness and pipeline wiring, not real narrative quality — no "reads
like natural human narrative" claim is made for any real model. See
[docs/NARRATIVE_MODEL_EVALUATION.md](docs/NARRATIVE_MODEL_EVALUATION.md) §5 for exactly what
running it against a real provider would require.

## Security — Verified Live, Not From Source Reading

All of the following are real HTTP calls against the live `lorewish-dev` project and its two
deployed Edge Functions (`submit-turn`, `replay-branch`), using two ephemeral test accounts created
and deleted via the Auth Admin API (cleanup verified by re-query: 0 remaining test accounts
afterward), plus a `service_role`-keyed read-only tooling client used only for assertions, never for
writes outside the RPC boundary.

- **Grants** (`information_schema.table_privileges`): `authenticated` holds `SELECT` only on all six
  new tables; `anon` appears in zero rows. **Functions** (`pg_proc.proacl`): the five intentionally
  client-callable `lw_*` functions grant `EXECUTE` to `authenticated` only (no `anon`, no bare
  `PUBLIC`); the internal helper grants to neither client role.
- **Advisors**: `security` — **5 expected `WARN`** ("Signed-In Users Can Execute SECURITY DEFINER
  Function"), one per intentionally client-callable `lw_*` function — each does its own
  `auth.uid()` ownership check, documented in its own header comment; this is the intended shape of
  the RPC boundary, not an oversight. `performance` — **0 findings**.
- **A real bug was found and fixed during live verification**: `SupabaseTurnRepository`'s
  constructor originally passed the *user's JWT* as the Supabase client's `apikey`/`key` parameter
  (`createClient(url, userJwt, ...)`), which both `submit-turn` and `replay-branch` call —
  PostgREST/GoTrue correctly rejected this as "Invalid API key" on every call past `PRECHECK`,
  since `apikey` must be the project's own anon/publishable key and the caller's identity belongs
  only in the separate `Authorization: Bearer <jwt>` header. Found via a temporary, explicitly
  time-boxed debug build that echoed the real error message (reverted before this record was
  written — the shipped function never returns internal error detail to a caller), fixed in both
  Edge Functions plus `supabase-repository.ts`, redeployed, and reverified.
- **20/20 live adversarial/contract probes, both scripts run to completion**:
  unauthenticated cannot call `submit-turn` (401); `anon` cannot execute `lw_precheck_and_start_turn`
  over PostgREST (401); a real authenticated start-turn commits a real Scene; duplicate `turn_id`
  submission is idempotent (identical Scene id, exactly 2 Scenes total after start + one retried
  turn, not 3); User B's read of User A's run returns 0 rows (RLS); User B cannot submit a turn on
  User A's run (blocked server-side, not just by RLS); the owning user cannot `INSERT` into `scenes`
  directly (403 — no grant exists, regardless of ownership); `anon` cannot `INSERT` into `scenes` or
  `SELECT` `player_runs` at all (401, object-level); "Replay from here" creates a distinct branch
  and both branches are retained; a nonexistent `selected_choice_id` is rejected before any
  generation call; a forced quality-gate failure resolves `GENERATION_FAILED` with exactly 2
  generation attempts, no new Scene, `user_allowance_debited = false`, and `lw_get_run_state`
  re-derives to `CONTINUE_READY` at the prior durable scene.
- Two rejected-request paths return HTTP 500 rather than a clean 4xx (User B submitting on User A's
  run; a malformed choice id) — both are correctly *rejected* by the SQL layer raising an exception,
  caught by the Edge Function's generic error handler. Recorded as a known polish item (§ below),
  not a security gap: the action is blocked either way.

## EN Direct-Language Path / VI Direct-Language Path

Both exercised end-to-end through the fake provider (not a real model — see above): the Golden Set
covers 3 EN + 3 VI scenarios; `quality-gate.test.ts` has dedicated EN and VI positive/negative cases
for the language-mismatch and drift checks; the live probe's `start` call used an EN premise and
committed a real EN scene through the full pipeline. `content_language` is passed explicitly by the
caller (Quick Start form / test scripts) in every case — never inferred from UI locale, per the
task's explicit prohibition.

## Dev UI — `/play`

`/play` (Quick Start form: premise, genre chips, EN/VI language toggle) and `/play/[runId]`
(reading view: PLAYER ACTION → narrative → dialogue → SYSTEM/state-change → choices/composer, per
the existing Scene Readability Contract components reused unmodified from M1) — both EN+VI via the
existing i18n system, both gated on `useAuth()` (`play.signInRequired` state for signed-out users,
consistent with the task's ABUSE/COST GATE requirement: no anonymous path to a paid generation
endpoint). `/preview` is untouched. Verified: `tsc --noEmit` clean, `expo lint` clean (one legitimate
false-positive from the React Compiler's `set-state-in-effect` rule on a textbook fetch-on-mount
effect, suppressed with the same scoped, justified pattern M1 already established for an analogous
case), both routes render correctly in-browser for the signed-out gate state (no live-authenticated
UI walkthrough was performed in this task — the live verification instead exercised the same
Edge Functions directly over HTTP, which is the boundary the UI itself calls).

## Tests / CI

- **35 unit tests, 3 files, all passing** (`npm test`, vitest): 15 quality-gate cases, 6
  context-assembler cases, 14 turn-pipeline domain cases (valid/invalid transition, idempotent
  retry, atomic-failure-leaves-scene-unchanged, successful-commit-advances-run, explicit-only
  terminal ending, checkpoint behavior, allowance exhaustion, branch replay creates a separate
  branch, branch canon isolation, run-scoped canon visible everywhere, malformed-schema rejection,
  one-repair-then-succeed). The SECURITY test category (cross-user isolation, no client mutation
  path, unauthenticated cannot call the paid path, intended RPC path works, no accidental public
  EXECUTE) is covered live instead of by a unit-test double — see Security above.
- `tsc --noEmit`, `expo lint`, `npm run export:web` all clean, run after every meaningful change,
  not only once at the end.
- **CI**: added a `changes` job (`dorny/paths-filter`) so the two native jobs run only when a
  native-relevant path changed (`src/**`, `app.json`, `eas.json`, `package.json`,
  `package-lock.json`, `assets/**`, `ios/**`, `android/**`, `.github/workflows/ci.yml`) or the
  workflow was manually dispatched — `supabase/**` (all of this task's server/domain code) and its
  tests no longer trigger a native rebuild. Added the vitest suite to the `web` job (fast,
  deterministic-provider-only, no secrets). Raised the iOS job's `timeout-minutes` from 30 to 40
  per the task's explicit instruction, citing the LW-M1-R3 27m54s-against-30m evidence. **Not
  verified on GitHub Actions in this task** — no commit has been pushed to the remote yet at the
  time this section was written; see the handoff's `ci-results.txt` for whether a push happened
  before the handoff was finalized.

## Live Web

**Not deployed.** WEB-FIRST DELIVERY in the task brief is conditioned on "once real generation
works" — it does not, in this task, since no AI provider credential exists. Deploying an
authenticated `/play` route backed only by a fake provider to the public production URL would not
meet that condition and was judged not worth the ambiguity it would create for anyone visiting
`lorewish.pages.dev`. `/preview` remains exactly as M1 left it; nothing was redeployed.

## Known Issues / Unresolved

- Two rejected-request paths (cross-user turn submission; invalid `selected_choice_id`) surface as
  HTTP 500 rather than a clean 4xx from `submit-turn` — the security property holds (verified live),
  but the error taxonomy could be tightened in a follow-up (catch the specific SQL exceptions in
  `turn-pipeline.ts`/`supabase-repository.ts` and map them to 400/403 instead of falling through to
  the generic 500 handler).
  - **This was flagged via `spawn_task` for a follow-up session** (see chip) rather than fixed
    inline, since it is out-of-scope polish, not a defect blocking this task's pass bar.
- `usage_counters`' precheck-then-commit allowance check is a soft/approximate cap under heavy
  concurrent load from the *same* user across *different* runs (the row lock that serializes
  precheck is per-`player_run`, not per-user) — acceptable for MVP's "a counter with a reset
  window, not a ledger" framing (DOMAIN_MODEL.md §3), flagged here rather than silently accepted.
- No character-chat, CreditLedger, or real moderation-provider integration — all explicitly M3/M4
  scope or dependent on a credential this task does not have.
- OpenAI and Gemini provider adapters are typed stubs only, never implemented against a real API —
  no credential existed to build or verify them against.
- The live probe scripts (ephemeral Node scripts using the project's service-role key, read once
  via `supabase projects api-keys` and never printed a second time, never written to any tracked
  file) lived only in the session's scratchpad directory outside the repository and were deleted
  after use; they are not included in the handoff package, per its "no service-role key" exclusion
  list. `handoff/LW-M2-R1/rls-test-results.txt` is a transcript of their console output instead.

## M2-R1 Verdict

**ENGINE_IMPLEMENTATION_PASS. REAL_NARRATIVE_PROVIDER_PENDING.**

Every structural pass-bar item this task can satisfy without a real AI credential is satisfied and
verified live, not merely implemented: schema + grants + RLS live and adversarially probed (20/20),
real persistent PlayerRun end-to-end through the deployed Edge Functions, predefined-choice and
custom-action turns both produce real durable Scenes, reload resolves correctly via
`lw_get_run_state`, replay-from-here creates a distinct retained branch, branch canon isolation
holds, the Continuous Play Contract's failure path never masquerades as an ending and never debits
a failed turn, idempotent retry produces exactly one Scene, EN and VI both exercised through the
same pipeline, the quality gate is implemented and unit-tested, 35 automated tests are green, no
client mutation path exists for authoritative state, no anonymous path reaches the generation
endpoint, no full image generation was added, and Web/JS CI is green locally (not yet re-verified
on GitHub Actions — no push has happened yet as of this section).

**What is not claimed**: real generation quality in either language (no provider credential),
GitHub Actions CI results for this branch (not yet pushed), and a full authenticated
click-through of the `/play` UI in a browser (the same boundary was instead verified directly over
HTTP, which is more precise for a security/contract claim, but is not the same as watching the
screens render live data).

**Recommended next task**: LW-M2-R2 or equivalent — obtain an `ANTHROPIC_API_KEY` (adapter already
implemented and doc-verified) or another provider's key, run `npm run bakeoff` for real, read the
two representative samples, and only then evaluate the EN/VI naturalness bar this task's engine
work was built to be judged against.

## Baseline (verified, not taken from the prior report)

- Baseline commit: **`f97dd28`** (`docs: LW-M1-R2 CURRENT_WORK.md and handoff package`) — confirmed
  by `git rev-parse HEAD`, matching what the R2 handoff claimed.
- Baseline branch: `feature/lw-m1-backend-native-foundation`; working tree clean at start.
- Local `main`: `b2a817e` (M0 baseline only) — confirmed.
- GitHub `PNHD/Lorewish`: private; **only** the feature branch existed remotely, and it was the
  repository's default branch. Both confirmed before being changed.
- Linked Supabase project: `lorewish-dev` / `sfarcofvqfeobtcizxyv` / `ap-southeast-1`, verified twice
  — once at the start and again immediately before applying the migration.
  `doodle-world-studio` (`etmqrpoefkcahyvaimiw`) was never touched.

## The R2 Grant Defect — Claim vs. Live Reality

This is recorded as audit history and deliberately not erased. The R2 migration comment that states
the wrong thing is also left in place, unedited.

- **R2 claim**: "`anon` receives no grant on any of these tables"; new public-schema tables are not
  auto-exposed; only explicit `authenticated` DML exists.
- **Live R2 reality** (`handoff/LW-M1-R3/grants-before.txt`): every one of the five authoring tables
  carried `relacl = {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,`
  `authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — `anon` and `authenticated`
  each held **all seven** table privileges, including **TRUNCATE, TRIGGER and REFERENCES**. The
  cause was `pg_default_acl`: the project's public-schema default granted `ALL` to the Data API
  roles at `create table` time, before the migration's own `grant` statements ran. The explicit
  grants were a subset of what had already been given, so they changed nothing.
- **R2 data-isolation result still stands**: RLS blocked every cross-user and anonymous **row**
  access that was tested, then and now. No data was exposed by this in any observed probe.
- **This is not a confirmed data breach.** It is an object-privilege posture that was weaker than
  reported, on a dev-only project, corrected before M2 adds more tables.
- **Why it mattered anyway**: grants and RLS are separate layers. `TRUNCATE` is a whole-table
  operation that no row policy governs. Correct RLS does not make an unnecessary object privilege
  harmless.

## R3 Fix — Corrective Migration

`supabase/migrations/20260810065727_m1_least_privilege_hardening.sql`, applied to `lorewish-dev`
(`supabase db push --linked`; remote history now lists both migrations). The already-applied
`20260810013158_m1_foundation_schema.sql` was **not** rewritten.

Verified live afterwards (`handoff/LW-M1-R3/grants-after.txt`, machine-checked expected-vs-actual:
**10/10 PASS, 0 FAIL**):

| Table | `anon` | `authenticated` |
|---|---|---|
| `profiles` | *(zero privileges)* | SELECT, INSERT, UPDATE |
| `stories` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `story_configurations` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `worlds` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `characters` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |

No client role holds TRUNCATE, TRIGGER or REFERENCES on any of them. `service_role` was left
untouched by design (redesigning it was out of scope; it is never used from application code).
All 19 RLS policies and all five `relrowsecurity` flags are unchanged.

## Future Default-Privilege Policy — Option A *and* Option B

**Option A was applied** and verified, using Supabase's own documented remedy for an existing
project (changelog 45329), scoped to the `postgres` role's default ACL:

```sql
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
```

`REVOKE ALL` rather than the four DML verbs the changelog names, because the live default handed out
`arwdDxtm`. The `postgres`/`public`/tables default is now
`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — both client roles removed.

This was **not** done with `supabase config push` (`[api] auto_expose_new_tables`): that command
pushes the entire local `config.toml`, which is CLI-scaffold content and would have set
`enable_confirmations = false` and rewritten `site_url` to `127.0.0.1:3000` on the live project.

**Automatic exposure is NOT fully disabled, and this document does not claim it is.** Three gaps
remain: a `supabase_admin`-owned default ACL for `public` that a `postgres` connection cannot alter;
the **function** default ACL, which still auto-grants `EXECUTE` to `anon`/`authenticated` on new
`public` functions; and any table created outside a `postgres`-role migration.

**Therefore Option B is also adopted, as the primary control:** *every Lorewish migration creating
an application table, function or sequence MUST revoke inherited/default client grants and then add
exact explicit grants in the same migration.* Recorded as a non-negotiable rule in
[docs/DEV_ENVIRONMENT.md](docs/DEV_ENVIRONMENT.md),
[docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) §4 and
[docs/AGENT_TOOLING.md](docs/AGENT_TOOLING.md) standing rule 6. The default-privilege change is
defence in depth, not the control.

### Future public function / RPC privilege rule *(added by the R3 closeout correction)*

The first statement of the Option-B rule was too table-centric. Gap 2 above — the still-broad
**function** default ACL — is the one that will bite first, because M2 introduces RPCs and the AI
gateway. Postgres grants `EXECUTE` to the `PUBLIC` pseudo-role on every new function by default, and
this project's function default additionally names `anon` and `authenticated`, so a new `public`
function is anonymously callable over `/rest/v1/rpc/` the moment it is created.

Every future migration creating a `public` function must therefore:

1. `revoke execute on function public.<name>(<argtypes>) from public, anon, authenticated;` —
   **all three**. Revoking only `anon`/`authenticated` leaves the `PUBLIC` grant, which both roles
   still inherit.
2. Re-grant `EXECUTE` **only** when the function is intentionally client-callable, to the narrowest
   role that must call it.
3. Document the **intended caller role and authorization contract** in a comment: which role calls
   it, what it does with `auth.uid()`, and — for `SECURITY DEFINER` — how it verifies ownership
   itself, since definer rights bypass RLS entirely. A `SECURITY DEFINER` function granted to `anon`
   is an anonymous, RLS-free entry point and needs written justification, never a default.
4. **Never assume the function default ACL is safe.**

The same explicit least-privilege principle applies to **sequences** if `serial`/`identity` columns
are ever introduced — M1 uses `gen_random_uuid()` throughout, so none exist today.

**The two existing helper functions were not touched by this correction.** Independent live
inspection confirms `handle_new_user()` and `set_updated_at()` are already correctly restricted to
`{postgres=X/postgres,service_role=X/postgres}`; this is a forward-looking rule, not a further
migration.

## Security Regression — 30/30 PASS

`handoff/LW-M1-R3/rls-test-results.txt`. Real HTTPS calls to the live Data API; two ephemeral
accounts created and deleted via the Auth Admin API; cleanup verified by re-query (0 remaining
`@lorewish-test.dev` accounts).

- **A. Anonymous denial is now object-level, not row-level.** R2 accepted `200 []` as proof; this
  run does not. All five tables plus an anonymous INSERT and a bulk DELETE returned **HTTP 401 with
  SQLSTATE 42501, "permission denied for table ..."** — including PostgREST's own hint naming the
  grant that would be required, which is direct confirmation none exists.
- **B/G. Owner CRUD unbroken** by the revoke/re-grant: create, read, update, child insert
  (worlds/characters/story_configurations), child update, child delete all succeed.
- **C.** User B cannot read, update or delete User A's Story, StoryConfiguration or World.
- **D.** Ownership tampering fails both directions (A cannot reassign to B; B cannot forge a Story
  owned by A).
- **E.** B cannot attach a World, Character or StoryConfiguration to A's Story.
- **F.** `profiles` remains usable for exactly its allowed operations — and `DELETE` on `profiles`
  is now correctly refused at the object level, which is the one place the privilege layer rather
  than RLS is the control.
- **`set_updated_at` trigger verified still firing** after `EXECUTE` was revoked from the client
  roles (Postgres checks that privilege at `CREATE TRIGGER` time, not per firing): an authenticated
  UPDATE still bumps `updated_at`.
- **Advisors**: `supabase db advisors --linked` — **0 security findings, 0 performance findings**.

## Repository / CI

- `main` (`b2a817e`, M0 baseline) pushed to the private remote unchanged — **not** moved to the
  feature tip.
- GitHub default branch changed from `feature/lw-m1-backend-native-foundation` to **`main`**.
  Repository remains **private**.
- Neither `feature/lw-m1-web-foundation` nor `feature/lw-m1-backend-native-foundation` was deleted.
- New branch `feature/lw-m1-foundation-closeout`, created from the actual reviewed R2 tip `f97dd28`
  (not from a reported SHA), carries the R3 migration, docs and workflow change. A **draft** PR to
  `main` is open and deliberately **not merged** — the product owner / reviewer sees the R3 handoff
  first.
- **CI cost fix, part 1 — documentation-only pushes**: `.github/workflows/ci.yml` gains
  `paths-ignore` (`docs/**`, `handoff/**`, `*.md`) on both `push` and `pull_request`. Verified
  against real history: every one of the 16 files in `f97dd28` — the docs-only R2 commit that burned
  ~37 minutes of native runner time — matches that list, so it would now be skipped entirely.
  `src/**`, `package.json`, `package-lock.json`, `app.json`, `eas.json`, `assets/**`, `supabase/**`
  and `.github/**` are deliberately absent and always trigger a full run.
- **CI cost fix, part 2 — duplicate runs of one commit** *(added by the R3 closeout correction)*.
  The first R3 commit `e4749e6` launched **two** full native matrices for the same SHA: run
  `31364937721` (`push`) and run `31364972116` (`pull_request`). The concurrency key was
  `${{ github.workflow }}-${{ github.ref }}`, and `github.ref` differs between the two events
  (`refs/heads/feature/...` vs `refs/pull/1/merge`), so they landed in separate groups and neither
  cancelled the other.

  **This was not merely wasteful — the duplication caused both runs to fail.** The two matrices
  contended for runners and each dragged the other past its own timeout, in *opposite* jobs:

  | Job | `push` run `31364937721` | `pull_request` run `31364972116` | Solo baseline (R2) |
  |---|---|---|---|
  | Web / JS checks | success, 1m51s | success, 1m51s | ~2m |
  | iOS Simulator | **success, 25m21s** | cancelled at 30m45s — hit `timeout-minutes: 30` | ~25m |
  | Android (preview APK) | cancelled at 45m13s — hit `timeout-minutes: 45` | **success, 44m40s** | ~35m (runs `31352831669`, `31354813415`) |

  Both runs therefore report `conclusion=cancelled`. The two Android jobs finished five seconds
  apart (07:57:56Z and 07:58:01Z) after both being pulled from a ~35-minute solo baseline to ~45
  minutes. **Every job in the matrix did pass for `e4749e6`** — iOS in the `push` run, Android in
  the `pull_request` run, Web in both — so the commit itself is sound; the two runs simply sabotaged
  each other. Neither timeout is evidence of a defect in the commit.

  The key is now `${{ github.workflow }}-${{ github.head_ref || github.ref_name }}`: `head_ref` is
  the source branch on `pull_request`, `ref_name` is the branch on `push`, so both events for one
  branch share a group and `cancel-in-progress` leaves exactly one matrix running to completion.
  Both events describe the same commit, so no coverage is lost. The conservative `paths-ignore`
  behaviour is unchanged.

  **Residual risk, recorded not fixed:** with contention removed the solo baselines (~25m iOS,
  ~35m Android) sit inside the existing 30m / 45m caps, but the iOS margin is only ~18%. Raising
  `timeout-minutes` was deliberately **not** bundled into this bounded correction; it is an open
  recommendation for the owner.

### CI verification result — concurrency PROVEN, native matrix GREEN on public runners

**Authoritative R3 CI evidence: the public-repository run on `IMPLEMENTATION_HEAD`.**

| Run | Event | Result |
|---|---|---|
| `31369932367` | `push` | **cancelled** — Web and Android at 08:24:38Z (3s in), iOS at 08:29:36Z |
| `31369936191` | `pull_request` | **success** — Web 52s, Android **19m20s**, iOS Simulator **27m54s** |

All five required properties hold:

1. **Public standard-runner jobs actually start** despite the private quota being exhausted — the
   same workflow that could not begin a single step 24 minutes earlier ran the full matrix.
2. **Duplicate push/PR events do not produce two native matrices.** The `push` run was cancelled by
   the shared concurrency group; exactly one matrix ran to completion. Per the owner's instruction
   this cancellation is **expected PASS behaviour**, not a failure.
3. **Web passes.** 4. **Android build passes.** 5. **iOS Simulator build/install/launch passes.**

Android finishing in **19m20s** here versus **44m40s** under the duplicate-run contention is
independent confirmation of the contention diagnosis below — the same commit's Android job took
2.3× longer when two matrices competed.

**Sharpened timeout warning:** iOS took **27m54s** against `timeout-minutes: 30` — only ~2 minutes
of headroom, tighter than the ~18% estimated before this run. Android has comfortable room (19m20s
against 45m). Raising the iOS cap was deliberately kept out of the bounded corrections; it is now a
**recommended** change rather than a merely optional one.

#### The earlier private-quota runs (recorded, superseded, not blocking)

Observed on the corrected commit `6820de9` before the repository went public:

| | old key (`github.ref`), commit `e4749e6` | new key (`head_ref \|\| ref_name`), commit `6820de9` |
|---|---|---|
| `push` run | `31364937721` created 07:12:42Z, ran **45m13s** | `31368186633` created 08:00:26Z, **`cancelled` 08:00:31Z** |
| `pull_request` run | `31364972116` created 07:13:12Z, ran **44m40s** | `31368191079` created 08:00:30Z, survived |
| outcome | **two** full native matrices ran concurrently | **one** run survived; the duplicate died in 5s |

The push run terminated **one second after** the `pull_request` run for the same SHA was created —
they now share a concurrency group and `cancel-in-progress` fired. Billing does not explain that
result: a billing block produces `failure` (which is exactly what the surviving run's jobs show),
not `cancelled`. **The duplicate-run defect is fixed and demonstrated on real GitHub Actions data.**

**What could NOT be verified, and why.** The surviving run's three jobs all failed within ten
seconds, before any step executed, with the annotation:

> The job was not started because recent account payments have failed or your spending limit needs
> to be increased. Please check the 'Billing & plans' section in your settings

The repository is private, so Actions minutes are metered and macOS is billed at a 10× multiplier.
The limit was reached between 07:58Z and 08:00Z — i.e. **the duplicate-run defect itself consumed
the remaining quota**: the `e4749e6` pair alone burned ~25m + ~31m of macOS (≈560 billed minutes)
plus ~90m of Linux, on top of five earlier native runs the same day.

Consequently `6820de9` never produced a green native matrix on the private repo. That gap is now
closed by the public run on `IMPLEMENTATION_HEAD` recorded above; the `6820de9` runs are kept here
as the evidence trail for *why* the repository went public, not as an outstanding blocker.

### Owner decision — Actions quota exhaustion and temporary PUBLIC visibility

The private-repository Actions quota for the PNHD account is **exhausted: 2,000 / 2,000 minutes**.
Private repos meter Actions minutes and macOS bills at a 10× multiplier, so the day's native runs —
five R2 build-fix runs plus the `e4749e6` duplicate pair — consumed the month's allowance. No
further private-repo job can start until the limit is raised or the quota resets.

**The owner explicitly authorized making `PNHD/Lorewish` PUBLIC, temporarily, so development is not
blocked.** GitHub's standard hosted runners are free for public repositories. The owner's decision
is recorded here with its consequences understood:

- source and full commit history become publicly readable;
- Actions run history and logs become public;
- anyone may clone or fork the repository;
- **making it private again later does not recall clones or existing public forks.**

**Pre-public secret gate — PASSED.** A full-history audit was run before the visibility change (not
a working-tree scan): **223 blobs across 14 commits and 7 refs**, against 19 credential pattern
classes. Full output: `handoff/LW-M1-R3/secret-audit-full-history.txt`. Result: **0 real secrets**.

- One pattern hit, adjudicated benign: `password: "account.errorWeakPassword"` in
  `src/screens/account/index.tsx` — an entry in the Supabase-error-code → i18n-key map. The regex
  fired because the *key* `weak_password` ends in "password"; the *value* is a translation key.
- No `.env` was ever committed; `.env.example` is tracked by design with **empty** values.
- No build output (`dist/`, `.expo/`, `android/`, `ios/`, bundles, source maps) was ever committed,
  so no `EXPO_PUBLIC_` value was ever inlined into a committed artifact.
- The real publishable key in the untracked `.env.local` appears in **no** blob in history. The only
  `sb_publishable_` string ever committed is the non-functional CI literal
  `sb_publishable_ci_placeholder_0000000000000000`.
- No service-role/secret key, Supabase access token, GitHub token, Cloudflare token, Expo token,
  database password, connection string or private key anywhere in history.
- The `@lorewish-test.dev` addresses in handoff evidence are deleted ephemeral accounts on a
  non-existent domain; no password for any of them was ever written to a tracked file.

The Supabase project ref and its `https://<ref>.supabase.co` URL remain visible by design — they are
public identifiers, not secrets. With `anon` holding **zero** table privileges after the R3
hardening and RLS enforcing owner-only rows, they disclose nothing exploitable. That is precisely
the property this task established, and it is what makes public visibility safe.

**A first execution of the audit was discarded**, not trusted: it reported "CLEAN" while scanning
**0** blobs, because the shell had changed directory out of the repository and every `git` command
failed silently. A clean verdict from an empty scan is the exact false negative that must never gate
a visibility change.

### Public-repository CI hardening *(added with the visibility change)*

Going public means any stranger can open a PR, so the workflow was hardened in the same commit:

- Workflow-level `permissions: contents: read` — least-privilege `GITHUB_TOKEN`.
- The two expensive native jobs are gated on
  `github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`.
  A **fork PR** therefore gets the cheap web/JS job only; **owner-authored work is unaffected**,
  since every push to `main`/`feature/**` and every same-repo PR satisfies the condition. This
  withholds cost, never correctness — a maintainer wanting full native coverage for a fork PR pushes
  the branch into this repo, which satisfies the same condition.
- The workflow deliberately uses `pull_request`, **never `pull_request_target`**: fork code runs
  with a read-only token and no access to repository secrets. This is recorded in the workflow
  itself so a future change does not "fix" it the wrong way. The workflow needs no secrets at all —
  the Supabase values are placeholders and native builds prove compilation, not connectivity.

### `REPOSITORY_VISIBILITY_REVIEW_REQUIRED`

The repository stays **public** for active development. It is **not** reverted to private at the end
of this task. Returning it to private is an **owner decision**, and before making it, evaluate:

- whether any public forks exist (forks are not recalled by going private);
- whether ongoing GitHub Actions still depend on public-runner economics;
- whether another CI path (self-hosted runners, a paid plan, or EAS) has replaced the need.

## Native Evidence Status

- **iOS: ACCEPTED.** R2's GitHub Actions Simulator evidence (compile → install → launch → process
  confirmed alive → screenshot of the actual Lorewish UI) is genuine runtime evidence and is
  accepted for the M1 foundation. EAS was **not** re-run; Simulator runtime evidence is stronger
  than compile-only cloud evidence for this goal. No claim of physical-iPhone validation is made.
- **Android: `ANDROID_RUNTIME_EVIDENCE_DEFERRED`.** R2 produced a release-build-type APK that is
  signed with the JS bundle embedded, but the Android runtime was never observed. No local SDK was
  installed for this task by instruction. **This does not block M1** — the owner's current
  validation strategy is web-first. **Required closeout point: Android runtime evidence must be
  obtained before any external native beta or Play Store release testing.** Not claimed as PASS.

## Implementation Head / Handoff Property

`IMPLEMENTATION_HEAD` is the last committed source/schema/docs change required by this task. It
moved three times during the R3 closeout, each move driven by evidence the previous head produced:

| Commit | Content | Why it was superseded |
|---|---|---|
| `e4749e6` | privilege migration, first docs pass, `paths-ignore` CI filter | its own CI run exposed the duplicate-run defect |
| `6820de9` | function/RPC/sequence privilege rule + concurrency key | its run hit the exhausted private Actions quota |
| `3661d0a` | public-repo CI hardening + visibility decision record | superseded only by this file's final results update |
| **final** | **this CURRENT_WORK.md update** — public CI run IDs and results | **current `IMPLEMENTATION_HEAD`** |

Nothing in any superseded commit was reverted; each is a strict addition. The exact final SHA is
recorded in `handoff/LW-M1-R3/HANDOFF.md`, `git-log.txt` and `git-status.txt`, generated after it
existed. This file does not guess at it in prose — precisely the R2 mistake, where
`handoff/LW-M1-R2/git-log.txt` stopped at an older HEAD than the report named.

**The final commits are documentation-only, and the `push` trigger skips them** — the first *live*
demonstration of the part-1 CI fix, which until then had only been verified by replaying historical
commits through the globs. Verified on `e689178`: **no `push` run was created**.

**The `pull_request` trigger still fires, and that is expected GitHub behaviour, not a
misconfiguration.** GitHub evaluates `paths-ignore` for `pull_request` against the **entire PR
diff** (base…head), not against the newest commit. This PR's cumulative diff contains
`.github/workflows/ci.yml` and the migration, so no docs commit can make the PR as a whole look
docs-only. An earlier revision of this section claimed such a commit "triggers no workflow run at
all"; that was wrong and is corrected here rather than quietly dropped.

The practical effect is unchanged where it matters: **a docs-only push to a branch with no open PR —
which is the case Step 10 was about, and the case `f97dd28` fell into — is skipped entirely.** The
per-PR cost is bounded by the concurrency fix, which keeps it to one matrix.

This is what makes the head chain terminate rather than regress: the statement above does not depend
on any run's outcome, so recording it cannot invalidate it.

All handoff evidence was **regenerated in full** from the final head; nothing in the package
describes only a superseded one. `handoff/LW-M1-R3/` is deliberately **left untracked** and
`Lorewish_*_handoff.zip` is gitignored, so packaging cannot move the head its own evidence
describes. **No Supabase mutation was made after the privilege migration.**

## M1 Verdict

**PASS.**

- Object privileges are least-privilege and **verified live**: `anon` holds zero privileges on all
  five authoring tables, `authenticated` matches the intended DML exactly (10/10 machine-checked),
  no client role holds TRUNCATE/TRIGGER/REFERENCES.
- RLS is intact and independently re-proven: **30/30** adversarial probes, with anonymous access now
  denied at the **object** layer (`42501`) rather than by an empty result set.
- Advisors: 0 security, 0 performance findings.
- The forward rule now covers **tables, functions/RPCs and sequences**, so M2's first RPC cannot
  inherit an anonymous `EXECUTE`.
- Repository normalized: remote `main` at the M0 baseline, default branch `main`, draft closeout PR
  open and unmerged.
- CI is **green end-to-end on public runners** — Web, Android and iOS Simulator all pass — no longer
  burns native minutes on documentation, no longer runs a commit twice, and is hardened against
  fork-PR abuse.
- Repository visibility is **PUBLIC** by explicit owner decision, gated by a clean full-history
  secret audit, with `REPOSITORY_VISIBILITY_REVIEW_REQUIRED` recorded for the future decision.

Android **runtime** evidence remains explicitly deferred, which does not prevent M1 PASS under the
web-first strategy.

**Open recommendation (not blocking):** raise the iOS job's `timeout-minutes` above 30 — the green
run finished in 27m54s, leaving only ~2 minutes of headroom.

**No M2 work was started.** The public schema still contains exactly the five M1 authoring tables —
no `PlayerRun`, `StoryState`, scene, branch, `CanonFact`, memory, gateway, credit, ads, payments,
publishing or social schema or code exists.

## Recommended Next Task

**LW-M2-R1 — Real Interactive Story Engine Vertical Slice.** Not started here.

---

## HEAD Correction (recorded by LW-M1-R2, verified against actual `git` state)

This document's "Final HEAD" (below, `7a7cf7c`) and `handoff/LW-M1-R1/HANDOFF.md`'s commit table
(`952e8ec`, labelled "final HEAD") both undercounted the branch by one commit. Neither was rewritten
— per LW-M1-R2's instructions, history is not edited to make old reports match — this note documents
the discrepancy instead.

- **Reported as final HEAD** (inconsistently, across two LW-M1-R1 artifacts): `7a7cf7c` (this file's
  prose, below) and separately `952e8ec` (the handoff commit table).
- **Actual repository HEAD at the start of LW-M1-R2** (verified via `git rev-parse HEAD` and
  `git log --oneline --decorate --graph --all`, not assumed from either report): **`03c2fc3`** —
  `docs: add LW-M1-R1 handoff artifacts`, one commit past `952e8ec`.
- **Why the discrepancy exists**: `952e8ec` (`docs: record LW-M1-R1 completion in CURRENT_WORK.md`)
  updated this file with `7a7cf7c` as "Final HEAD" *before* `952e8ec` itself was committed — a
  same-task self-reference gap common to a "write the summary, then commit it" sequence. The
  `handoff/LW-M1-R1/HANDOFF.md` commit table was then written and committed as `03c2fc3`, correctly
  listing `952e8ec` as of that point, but `03c2fc3` itself is not listed anywhere as the branch's
  actual tip — the same gap one commit later, since the handoff-artifacts commit was never followed
  by a further doc update recording itself.
- **Resolution**: `03c2fc3` is treated as the real, reviewed end state of LW-M1-R1 for all LW-M1-R2
  purposes (starting point, diffs, and the new branch point below).

---

**Task**: LW-M1-R2 — Dev Supabase + Auth + Native Foundation
**Status**: **IMPLEMENTATION_PASS, M1_NATIVE_RUNTIME_EVIDENCE_PARTIAL**. iOS Simulator evidence is
complete (compiled, installed, launched, verified running, and — after fixing a real bug that made
the first attempt's screenshot show a React Native error screen instead of the app — a screenshot
confirming the actual Lorewish UI renders). Android evidence is build/structure evidence only
(APK compiles, is properly signed, and has the JS bundle embedded — verified by direct artifact
inspection) — it was never installed or launched on a device or emulator, since none was available
in this environment. Recorded honestly as `ANDROID_RUNTIME_NOT_YET_OBSERVED`, per this task's own
explicit instruction for exactly this situation, rather than overclaimed.

## Branch / HEAD

- Starting branch: `feature/lw-m1-web-foundation`, checked out from `main` (verified, not assumed).
- Starting HEAD (as reported by prior task artifacts, inconsistently): `7a7cf7c` / `952e8ec`.
- **Actual reviewed R1 HEAD** (verified via `git rev-parse HEAD`): **`03c2fc3`** — see the HEAD
  Correction note above.
- R1 repair commit (on `feature/lw-m1-web-foundation`): `3bb0fcf` — `fix: close LW-M1-R1 review
  findings` (R1-F1, R1-F2, R1-F3, and the HEAD-correction documentation itself).
- New branch: `feature/lw-m1-backend-native-foundation`, created from `3bb0fcf`.
- Commits on the new branch: `28b8541` (`feat: add Lorewish dev Supabase foundation`), `6716f64`
  (`feat: add auth and native build foundation`).
- `main` still points at `b2a817e` only. Not merged into. No commit history rewritten.

## R1 Review Findings — Repaired

- **R1-F1 (custom-action duplicate label)**: `src/screens/preview/index.tsx`'s `handleSend` no
  longer bakes `t("preview.youLabel")` into the stored player-action string — it stores only the
  raw trimmed text. `PlayerActionBanner` already renders `youLabel` and `action` as separate lines;
  the fix was a one-line data-model change, not a string hack. Verified interactively in English and
  Vietnamese, on both the dev server and the live `lorewish.pages.dev` production build.
- **R1-F2 (narrative-repair billing)**: `docs/NARRATIVE_QUALITY_CONTRACT.md` §D now states the rule
  explicitly — one successful user intent resolves to at most one `user_allowance_debit`, regardless
  of whether the one automatic repair attempt ran. `provider_cost`,
  `internal_generation_attempt_count`, and `user_allowance_debit` are named as three separate tracked
  concepts; a turn where both the initial and repair attempts fail (no Scene committed) is pinned to
  `user_allowance_debit = 0`. `docs/CONTINUOUS_PLAY_CONTRACT.md` §8's allowance table gets two new
  rows so the two documents don't drift apart on this point.
- **R1-F3 (placeholder branding)**: `docs/DECISIONS.md` D35 marks the Expo scaffold's default
  icon/splash/favicon assets as **PLACEHOLDER — MUST REPLACE BEFORE EXTERNAL BETA**, explicitly
  listing every affected asset path. No design work was done — that remains explicitly out of scope.

## Supabase — `lorewish-dev`

- Project ref `sfarcofvqfeobtcizxyv`, region `ap-southeast-1`, org `dbodjqmarksspvyknnlv` — verified
  by name/ref/region match against the task brief before linking. Never linked to
  `doodle-world-studio` (a different project, `etmqrpoefkcahyvaimiw`, in the same org) or to any
  other project.
- The Supabase CLI on this machine was initially authenticated to a *different* account with no
  access to `lorewish-dev` (`supabase link` failed with a privileges error) — the project owner ran
  `supabase login` under the correct account before any Supabase work proceeded.
- `supabase/` initialized and linked. One migration:
  `supabase/migrations/20260810013158_m1_foundation_schema.sql` — `profiles`, `stories`,
  `story_configurations`, `worlds`, `characters`. UUID primary keys, `created_at`/`updated_at`
  throughout, no Postgres enum types (check constraints validate shape/allowed-set instead — see the
  migration's own comments for the reasoning per field). Applied via `supabase db push` (no local
  Docker stack — none was running in this environment; the CLI's own `--linked` fallback was used for
  everything, including `db advisors`).
- RLS enabled on every table. `stories` owned via `owner_user_id = auth.uid()`;
  `story_configurations`/`worlds`/`characters` owned via their parent `Story` (no duplicated owner
  column). Every `USING` has a matching `WITH CHECK`. Explicit `GRANT`s to `authenticated` only —
  `anon` receives none, since Supabase's current default no longer auto-exposes new tables.
- A minimal `auth.users` trigger (`handle_new_user`, `SECURITY DEFINER`, empty `search_path`, fully
  schema-qualified, `EXECUTE` revoked from public roles) creates a `profiles` row on signup.
- `supabase gen types typescript --project-id sfarcofvqfeobtcizxyv` → `src/types/database.types.ts`,
  committed, not hand-maintained.
- `supabase db advisors --linked --type all`: **0 findings** (see `handoff/LW-M1-R2/supabase-advisors.txt`).
- 15/15 adversarial RLS probes passed — two ephemeral test accounts against the live REST API,
  covering cross-user read/update/delete, an `owner_user_id` tamper attempt, cross-story child-record
  attachment, and unauthenticated access. Full transcript: `handoff/LW-M1-R2/rls-test-results.txt`.
  All test users/data created for probing were deleted afterward; nothing persists in the dev
  database from this task.
- `docs/DEV_ENVIRONMENT.md` records the Auth Site URL / redirect-URL values as a **manual dashboard
  step** rather than `supabase config push` — pushing the full scaffolded `config.toml` risked
  silently changing unrelated live settings, including turning email confirmation off (the CLI's
  local-dev scaffold default), which would have violated this task's instruction to preserve the
  secure default. Email confirmation was not touched and was independently confirmed still on: a
  real sign-up attempt returned `429 over_email_send_rate_limit`, meaning a confirmation email send
  was genuinely attempted.

## Auth

- Email/password only (Supabase Auth). No OAuth providers, no anonymous sign-ins — neither is called
  or enabled anywhere in this task.
- `src/lib/supabase.ts` — lazily-constructed client (`getSupabaseClient()`), not built at module-eval
  time. Found and fixed a real bug this task introduced: an eager `createClient()` call at module
  scope crashed Expo Router's static-export SSR prerender pass (which doesn't inline
  `EXPO_PUBLIC_*` the way the real browser/native bundle does) for every route, not just `/account`,
  since `AuthProvider` is mounted in the root `_layout`. Deferring construction to first real use
  fixed it — verified by a subsequent clean `expo export -p web`.
- `src/auth/auth-context.tsx` — `AuthProvider`/`useAuth()`, mounted once in `src/app/_layout.tsx`.
  Maps raw Supabase Auth errors to a closed set of product-facing codes (`invalid_credentials`,
  `email_not_confirmed`, `user_already_exists`, `weak_password`, `invalid_email`, `unknown`) — no
  raw Supabase error text is ever shown to a user.
- `src/screens/account` + `src/app/account.tsx` — sign up / sign in / sign out, current session
  state, EN/VI throughout. States implemented: loading, signed-out (sign-in/sign-up form), invalid
  credentials, check-your-email (post-signup), signed-in, sign-out.
- **Deliberately deferred**: OAuth/social providers, anonymous/guest Supabase sessions (the `/preview`
  fixture stays local-only and unauthenticated — no `signInAnonymously()` call exists anywhere in
  this codebase, on page load or otherwise; real anonymous-guest persistence is explicitly M2 scope,
  per this task's brief), profile avatars, preferences dashboard, subscription settings.
- Verified interactively end-to-end, on both the dev server and the live production deployment: sign
  up validation-error path, a real (rate-limited) confirmation-email send, sign-in with a
  pre-confirmed test account, session persistence across a hard reload of `/account`, and sign-out.
  All ephemeral test accounts created for this were deleted afterward via the Auth Admin API (used
  only from local test tooling, never in application code, never committed).

## Live Web

- Redeployed to the same Cloudflare Pages project as R1 (`lorewish`) via
  `wrangler pages deploy dist --branch=main`. Live at **https://lorewish.pages.dev**
  (this deployment: `https://c5198a20.lorewish.pages.dev`).
- `/preview` remains fully playable without any authentication, before and after the Supabase/auth
  work. `/account` loads on a direct route hit (not just client-side navigation), in both languages,
  with zero console errors.
- The Supabase project ref and other technical/debug details are not surfaced anywhere in the normal
  UI.

## Native Foundation

- App identifiers were already correct from R1: `com.lorewish.app` (both iOS `bundleIdentifier` and
  Android `package`), scheme `lorewish`, display name `Lorewish`. No change needed.
- `eas.json` created (`development`, `preview`, `ios-simulator`, `production` profiles) but **EAS is
  not used for this task's native build evidence** — no `eas login`, no build quota consumed. This
  was an explicit owner decision made mid-task: GitHub Actions on standard GitHub-hosted runners
  replaces EAS as the primary remote native-build path for M1, modeled on the owner's existing
  `PNHD/focelle-ios` iOS CI workflow (principles adapted, not the Swift-specific implementation).
- `.github/workflows/ci.yml` — three jobs, standard runners only (`ubuntu-latest`, `macos-latest`),
  `concurrency`/`cancel-in-progress` set:
  - **web**: `npm ci`, typecheck, lint, `expo export -p web`.
  - **android**: `expo prebuild --platform android --no-install`, `gradlew assembleRelease`
    (release build type, debug-keystore-signed per Expo's own default with no `credentials.json`
    present — not a Play Store key), uploads the APK as a workflow artifact.
  - **ios-simulator**: `expo prebuild --platform ios --no-install`, `pod install`, unsigned
    `xcodebuild -configuration Release` for `iphonesimulator` (`CODE_SIGNING_ALLOWED=NO`), boots a
    runner-provided iPhone simulator, installs and launches the app, confirms the process is
    actually running via `simctl spawn launchctl list` (not just that `launch` returned), captures a
    screenshot, and zips the `.app` as `Lorewish-iOS-Simulator.app.zip` (Appetize-upload-shaped) —
    all uploaded as artifacts. Requires no Apple Developer membership, signing certificate, or
    provisioning profile.
- **A GitHub repository did not exist for this project before this task.** Per explicit owner
  instruction: created **private** under `PNHD/Lorewish`, after a full secret scan of everything
  about to be committed (clean — see `handoff/LW-M1-R2/test-results.txt`) and a `.gitignore` review
  (added `.wrangler/` to the ignore list; nothing sensitive was ever staged). Pushed
  `feature/lw-m1-backend-native-foundation`.
- **GitHub Actions run (final, successful)**:
  https://github.com/PNHD/Lorewish/actions/runs/31354813415 — all three jobs passed. It took five
  runs total to get here, across four real bugs found and fixed (not silently retried — see
  `handoff/LW-M1-R2/native-builds.txt` for the full, transparent account of each): a wrong
  Xcode-scheme heuristic, a one-level-too-shallow `find` for the built `.app`, an Android job hitting
  its timeout on a cold Gradle cache, disk-space exhaustion on the Android runner, and — most
  importantly — the first "successful" iOS run's own screenshot revealing that a Debug-configuration
  build shows React Native's "No script URL provided" error instead of the app (Debug+Simulator
  unconditionally skips embedding the JS bundle, expecting a Metro server no CI runner has).
  Switching both native jobs to their Release build type/configuration fixed this for real — verified
  by a screenshot of the actual Lorewish home screen, not asserted from the build succeeding alone.
- **Android**: `app-release.apk` (103.8MB) — inspected directly (not just "the job passed"):
  contains `assets/index.android.bundle` (the embedded JS, 2.9MB), a valid `AndroidManifest.xml`,
  and the build log shows `validateSigningRelease` and `packageRelease` both ran
  (`BUILD SUCCESSFUL in 35m 19s`). **Never installed on a device or emulator — none was available in
  this environment.** Recorded as `ANDROID_RUNTIME_NOT_YET_OBSERVED`, per this task's own explicit
  instruction for this exact situation.
- **iOS**: `Lorewish-iOS-Simulator.app.zip` (28.8MB) — a real Mach-O binary + `Info.plist`, installed
  and launched on a runner-provided iPhone simulator, confirmed running via `simctl spawn launchctl
  list`, and `handoff/LW-M1-R2/screenshots/ios-simulator-home-en.png` shows the actual app (name,
  tagline, subheading, preview CTA, Account link, language switcher) — genuine Simulator runtime
  evidence, not a compile-only claim, and not physical-device evidence (never claimed as such).

## Validation

See `handoff/LW-M1-R2/test-results.txt`, `supabase-migrations.txt`, `supabase-advisors.txt`,
`rls-test-results.txt`, `web-build.txt`, and `native-builds.txt` for full detail. Summary: `npm ci`
clean (22 pre-existing transitive advisories, unchanged from R1, non-blocking); `expo-doctor` 20/20;
`tsc --noEmit` clean; `expo lint` clean; `expo export -p web` succeeded (5 static routes including
`/account`); secret scan clean (verified twice — before and immediately before the GitHub push);
`git diff --check` clean except pre-existing, non-source artifacts already present before this task.

## Known Issues / Remaining M1 Blockers

- **Android runtime is unobserved** (`ANDROID_RUNTIME_NOT_YET_OBSERVED`): the release APK builds,
  is signed, and has the JS bundle embedded (verified by direct artifact inspection), but was never
  installed or launched on a device or emulator — none was available in this environment. Per this
  task's own instruction, M1 may remain open on this specific point for owner-assisted device
  validation rather than being blocked entirely on it.
- App icon/splash/favicon assets remain the unmodified Expo scaffold defaults (D35) — must be
  replaced before any external beta.
- No CI job runs the Supabase RLS probe suite automatically yet (this task's probes were run
  manually from local tooling) — worth automating in a later milestone if the schema starts changing
  more frequently.
- `handoff/LW-M1-R1/git-diff.patch` (a committed historical artifact, not source) still contains the
  pre-existing trailing-whitespace and space-in-filename items `git diff --check` flags — cosmetic,
  not a defect in this task's actual changes.
- The GitHub Actions native build jobs currently build unconditionally on every push to `main` or
  any `feature/**` branch — worth narrowing (e.g., path filters, or only on PRs into `main`) once
  the repository sees more day-to-day churn, to avoid burning private-repo Actions minutes on pushes
  that don't touch native-relevant code.

## Recommended Next Task

**LW-M1-R3** — owner-assisted Android device/emulator validation to close
`ANDROID_RUNTIME_NOT_YET_OBSERVED` (the one remaining M1 native-evidence gap), or **M2** directly if
the owner judges the release-APK build/structure evidence sufficient on its own. Do not begin M2
scope (AI gateway, LLM calls, PlayerRun, credit system, etc.) in this task; none of it was
implemented here, per explicit instruction.

---

**Task**: LW-M1-R1 — Web-First Bilingual Foundation + Preview Deploy
**Status**: **COMPLETE**. Web-first bilingual (EN/VI) Expo foundation built, validated, committed,
and deployed to a live Cloudflare Pages preview URL. M1 is **not** fully complete — this is R1 of
M1; Supabase, Auth, and native Android/iOS validation are explicitly deferred to LW-M1-R2 (§ below).

## Branch / HEAD

- Branch: `feature/lw-m1-web-foundation`, checked out from `main`.
- Baseline HEAD (start of this task): `b2a817e` — `docs: establish Lorewish product baseline`
  (M0 document set, first commit in the repository's history; there was no prior commit).
- Final HEAD: `7a7cf7c` — `feat: LW-M1-R1 web-first bilingual foundation + local preview`.
- `main` still points at `b2a817e` only. `feature/lw-m1-web-foundation` has not been merged into
  `main`, per instruction. Reviewable as `main..feature/lw-m1-web-foundation`.
- No remote configured; nothing pushed.

## Owner Decisions Recorded

Added to `docs/DECISIONS.md` as **D32–D34**, with superseding edits (not silent rewrites) to
`PRODUCT_VISION.md` §10, `MVP_SPEC.md` §2, `TECHNICAL_ARCHITECTURE.md` §11, `ROADMAP.md` M1/M7, and
`DOMAIN_MODEL.md` §8:

- **D32** — Web is the first shareable test channel (architecture stays Android+iOS+Web; Android/iOS
  validation continues inside M1 on schedule).
- **D33** — English and Vietnamese ship from the first implementation milestone (supersedes the M0
  "English-only at launch" language).
- **D34** — Story generation is native-language-first, not translate-first (no engineering action in
  this task; anchors the new `docs/NARRATIVE_QUALITY_CONTRACT.md` for M2+).

M0 was **not** reopened — these are recorded as post-M0 owner decisions layered on top of a PASSed
M0, exactly as LW-M0-R2/R3 recorded their own changes.

## What This Task Did

1. Read all fourteen M0 baseline documents plus the new post-M0 owner brief without trusting prior
   summaries. Verified the actual repository state (`git status`, filesystem, `skills-lock.json`,
   agent skill directories) rather than assuming the M0-R3 "no commits" claim was still true — it
   was.
2. Recorded D32–D34 and updated stale "English-only" text across five docs (§ above).
3. Created `docs/NARRATIVE_QUALITY_CONTRACT.md` — direct-language generation, language profiles,
   the Vietnamese four-slot address model, a deterministic quality gate with a one-repair-attempt
   cap, the naturalness rule (no literal EN↔VI equivalence), and a Narrative Golden Set
   specification. No AI provider called or selected.
4. Wrote `.gitignore` (node_modules, Expo/EAS artifacts, `.env*`, credentials, OS caches, handoff
   zips, and the installed-skill directories per `docs/AGENT_TOOLING.md`'s documented option), ran a
   secret scan (clean), and created the **M0 baseline commit** (`b2a817e`) on `main` — docs,
   `CURRENT_WORK.md`, prior M0-R2/R3 handoff records, `skills-lock.json`, `.gitignore`.
5. Branched to `feature/lw-m1-web-foundation` and scaffolded an Expo Router (SDK 57) + TypeScript
   app (Android/iOS/Web from one codebase, per the official `create-expo-app` default template,
   restructured into `src/app` + `src/screens` + `src/components` per current Expo project-structure
   guidance).
6. Built the bilingual i18n foundation (§ below), a minimal design-token foundation, the shared
   `Composer` component, and the local-fixture `/preview` route (§ below).
7. Validated: `tsc --noEmit` clean, `expo lint` clean (after fixing a real prop-collision bug and
   two React-Compiler-flagged effect patterns — see Known Issues Found And Fixed), `expo-doctor`
   20/20, production web export via `expo export -p web`, and interactive browser validation of the
   exported build (both languages, choice/consequence/replay flow, long Vietnamese paste, mobile
   viewport, direct-URL and refresh navigation) — see Tests below.
8. Committed the implementation (`7a7cf7c`) on the feature branch.
9. Deployed the exported `dist/` to Cloudflare Pages, project `lorewish` (the preferred name was
   available — no fallback needed). Live at **https://lorewish.pages.dev**.
10. This document and the `handoff/LW-M1-R1/` package.

No sub-agents were used (forbidden for this task). No Supabase project, AI provider, or account/auth
system was touched.

## Expo Foundation

- Expo SDK 57, Expo Router (typed routes, React Compiler enabled), TypeScript, React 19.2 /
  React Native 0.86.
- `src/app/` — routes only (`_layout.tsx`, `index.tsx`, `preview.tsx`), per current Expo
  project-structure guidance loaded via the `expo-project-structure` and `expo-router` skills.
- `src/screens/`, `src/components/` (including `src/components/reading/` for the Scene Readability
  Contract channels), `src/theme/`, `src/i18n/`, `src/content/preview/`, `src/hooks/`.
- Targets: Android, iOS, Web from the one codebase (`app.json` — `com.lorewish.app`). **Web is the
  only platform with runtime evidence in this task**, per D32. Android/iOS have **no build or
  runtime evidence yet** — that is explicitly LW-M1-R2 scope, not silently claimed here.

## English / Vietnamese Implementation

- `expo-localization` (device locale detection) + `i18n-js` (catalogue lookup) — the pairing
  documented in Expo's own localization guide.
- `src/i18n/locales/en.json`, `vi.json` — locale-independent dotted keys; the Vietnamese catalogue
  is natively written, not machine-translated from the English one.
- Device locale is the first default (`expo-localization` → normalized to `en`/`vi`, else fallback
  `en`); an explicit, always-visible manual switch (`LanguageSwitcher`) overrides it and persists via
  `@react-native-async-storage/async-storage`.
- `document.documentElement.lang` is set on web on every locale change (verified in-browser: `vi`
  after switching).
- UTF-8 safe end to end; Vietnamese diacritics verified rendering and round-tripping correctly
  through the composer in-browser (see Tests).
- No user-facing product copy is hardcoded in a screen; all UI chrome routes through `useTranslation`.
  Story/scene content (`src/content/preview/{en,vi}.ts`) is intentionally **not** in the UI catalogue
  — it is per-language content data, the same distinction `docs/DOMAIN_MODEL.md` §8 draws for
  `content_language` versus UI locale.

## Narrative Quality Contract

`docs/NARRATIVE_QUALITY_CONTRACT.md` — a design contract for M2+, not implemented code. No AI
provider called. Covers direct-language generation (D34), the language-profile concept model, the
Vietnamese four-slot address model (extends `CharacterRelationship`, does not replace pronoun
modeling for English), a deterministic quality gate with a one-automatic-repair cap resolving to
`GENERATION_FAILED` on a second failure (never silently committing poor prose), the
non-literal-equivalence naturalness rule, and a six-scenario Narrative Golden Set specification
(EN/VI × Fantasy/Romance/Adventure).

## Web Preview

**What is actually interactive** (verified in a running browser against the production export, not
claimed from source reading alone):

- `/` — Home screen, language switcher, link to `/preview`.
- `/preview` — a real, client-side state machine over a small deterministic scene graph
  (`src/content/preview/{en,vi}.ts`): a `start` node with two predefined choices *and* an always-
  available composer (custom actions go through a defined `custom` node — this is real, not
  decorative); three `checkpoint` nodes (market / guard / custom-action outcome) each showing a
  PLAYER ACTION banner, narrative, optional dialogue, a collapsible SYSTEM/state-change panel, and a
  single primary **Continue**; one `ending` node offering **Replay from a checkpoint** (lands back at
  the last checkpoint reached, ready to act, zero generation) and **Start again**. Every state has at
  least one enabled control; no dead end exists; a full-catalogue string search for "to be continued"
  (and a Vietnamese equivalent) found nothing, in both source and the exported `dist/`.
- The Composer is the one shared implementation (native file + a web variant adding the optional
  Ctrl/Cmd+Enter accelerator), not a preview-only stand-in — this is the component future M2/M3
  surfaces (custom actions, character chat, Advanced Setup) will reuse unmodified.

**What remains fixture-only** (by design, per the task's explicit scope):

- No AI generation of any kind — the "AI" in the scene is entirely pre-authored fixture prose.
- No real branch persistence, no Supabase, no credit/allowance system, no account/auth, no image
  generation. Switching language resets the fixture to its start node (no cross-language story state
  to reconcile locally).
- The `Continuous Play Contract` states demonstrated are `CONTINUE_READY` (implicitly, the `start`
  node), `EXPLICIT_CHECKPOINT`, and `TERMINAL_ENDING`. `GENERATION_FAILED` and
  `ALLOWANCE_EXHAUSTED` are **not** demonstrated — there is no generation to fail and no allowance to
  exhaust in a fixture with no backend. That is intentional scope, not an oversight; both remain M2
  responsibilities per `docs/CONTINUOUS_PLAY_CONTRACT.md`.

## Cloudflare

- Project name `lorewish` was **available** — no fallback (`lorewish-app`) needed.
- **Live URL: https://lorewish.pages.dev** (also reachable at the per-deployment URL
  `https://c1d0c3c4.lorewish.pages.dev`).
- No domain purchased. No paid Cloudflare plan. No Workers/Functions configured — this is a plain
  static-asset deployment of the `expo export -p web` output (`web.output: "static"` in `app.json`,
  Expo's default), which is why direct navigation to `/preview` and a hard refresh both work without
  any SPA-fallback routing rule: each route is its own static HTML file (`index.html`,
  `preview.html`).
- Deployment used the Cloudflare MCP-adjacent `wrangler` CLI, already authenticated on this machine
  under the project owner's own Cloudflare account (verified via `wrangler whoami` before acting —
  not something this task configured). The project's production-branch deployment was created with
  `wrangler pages deploy dist --branch=main` to land on the clean root URL; this is a Cloudflare-side
  branch label only and did **not** touch the git repository (no merge into `main`, nothing pushed).
- `BLOCKED_EXTERNAL_AUTH` did **not** occur — auth was already present and valid.

## Known Issues Found And Fixed During This Task

Recorded because they are non-obvious and worth knowing about if this pattern recurs:

1. **`ThemedText`'s `role` prop silently collapsed to a single literal.** `RNTextProps` already
   declares an ARIA `role` field; intersecting it with a same-named custom prop of a different
   literal union reduces to only the literals common to both sets — in practice, only `"heading"`
   survived, so every other value failed to typecheck. Fixed by renaming the design-system prop to
   `variant` across `ThemedText` and all thirteen call sites. Worth knowing for any future component
   that wraps a React Native primitive and wants a same-named prop.
2. **Two `useEffect` + `setState` patterns flagged by the React Compiler ESLint rule** in
   `src/screens/preview/index.tsx` (resetting fixture state on locale change; tracking the last
   checkpoint reached) were refactored to React's documented "adjust state during render" pattern
   instead of an effect — functionally identical, one fewer render pass, and it satisfies
   `react-hooks/set-state-in-effect` without a suppression comment.
3. A ref-mutation-during-render in `composer.web.tsx`'s accelerator handler was moved into a proper
   effect.
4. `src/hooks/use-color-scheme.web.ts` (copied verbatim from Expo's own official template) also
   trips the same effect rule for its hydration-safety pattern; left as Expo's own upstream code
   with a scoped, justified `eslint-disable-next-line` rather than restructuring template-owned code.
5. `package.json` initially pinned `expo-localization` to its own package-version scheme (`~17.x`)
   instead of the SDK-57-aligned range; `expo-doctor` caught it and `npx expo install
   expo-localization` corrected it to `~57.0.1`.

## Tests / Validation

| Check | Result |
|---|---|
| `npm install` | Clean. 22 npm-audit advisories, all in transitive Expo/RN build tooling (`metro`, `xcode`, `@expo/config-plugins` internals) — not application runtime code, not fixable without a major SDK downgrade `audit fix --force` would force. Non-blocking. |
| `npx expo-doctor` | **20/20 checks passed.** |
| `npx tsc --noEmit` | **Clean**, zero errors. |
| `npx expo lint` | **Clean**, zero errors/warnings (after the fixes above). |
| `npx expo export -p web` | **Succeeded.** Static routes: `/`, `/preview`, `/_sitemap`, `/+not-found`. |
| Secret / credential scan | Clean, run twice (before the M0 commit and again over the full new `src/` tree + `app.json`/`package.json`) — no API keys, tokens, or credential patterns found. |
| EN UI in browser | Verified — Home and `/preview` render correctly, no console errors. |
| VI UI in browser | Verified — switch is instant, diacritics render correctly, `document.documentElement.lang` becomes `"vi"`. |
| Locale fallback | Verified in code path (device-locale → normalize → `en` fallback); default browser locale in this environment is `en`, so device-default behavior was exercised directly. |
| Switch persistence | Verified via `AsyncStorage`/web-`localStorage` — a fresh navigation after switching to `vi` reloaded in `vi`. |
| Composer: Vietnamese diacritic input | Verified — typed Vietnamese text round-trips exactly through the `<textarea>`. |
| Composer: long paste (~4,980 chars) | Verified — `textarea.scrollHeight` (1568px) far exceeds `clientHeight` (198px, the 7-line clamp), and the Send button's bounding rect stayed fully inside the viewport. No horizontal scroll (`document.body.scrollWidth === window.innerWidth`) at both desktop (1280px) and mobile (375px) widths. |
| Deterministic choice path | Verified — `start` → choice → `checkpoint` (state-change panel, dialogue, Continue) → `ending`, in English. |
| Alternate/custom-action path | Verified — `start` → composer custom action (long Vietnamese text) → `custom` checkpoint with the player's own text echoed in the PLAYER ACTION channel → `Continue` → `ending`, in Vietnamese. |
| Replay-from-here | Verified — from `TERMINAL_ENDING`, "Replay from a checkpoint" lands back at the `market` checkpoint, `Continue` re-enabled, zero navigation to any intermediate/dead-end screen. |
| No dead end / no "to be continued" | Verified — every reachable node was visited in this session and rendered at least one enabled control; string search of `src/` and exported `dist/` for "to be continued" and a Vietnamese equivalent found nothing. |
| Routing: direct `/preview`, refresh `/preview` | Verified — `wrangler`'s local server and a fresh `navigate()` both resolved `/preview` correctly (static per-route HTML), including after a full page reload at mobile viewport. |
| Responsive: mobile (375×812) / desktop (1280×720) | Verified — no horizontal scroll at either width; layout intact. |
| Console errors | **None observed** at any point in this session (Home, Preview, both languages, both viewports). |

**Screenshots**: the in-session Browser pane could not composite frames for pixel screenshots in
this environment (`the Browser pane is not displayed, so the page is not compositing frames`).
Validation above was performed with real DOM reads (`get_page_text`, `read_page`,
`read_console_messages`, direct `document`/`textarea` inspection via `javascript_tool`) against the
actual running production build — not source-reading alone — but no image files exist to include in
the handoff. This is stated plainly rather than fabricated; see `handoff/LW-M1-R1/HANDOFF.md`.

## Files Changed

See `handoff/LW-M1-R1/files-changed.txt` for the full list. Summary: 49 files, +13,531/-1 across the
feature-branch commit (application source, config, and assets); 6 files touched by doc updates plus
1 new doc on `main`'s baseline commit.

## Known Issues (Product/Scope, Not Bugs)

- Android and iOS have zero build or runtime evidence from this task — LW-M1-R2 scope (D24 still
  governs: EAS cloud build evidence is the expected M1 iOS evidence class, never claimed here).
- No backend: no Supabase project, no Auth, no persistence beyond local UI preference — explicitly
  deferred to LW-M1-R2 per the task brief and D32's stated reasoning (ship a bilingual web foundation
  without mixing frontend scaffold and backend/native validation into one review unit).
- `GENERATION_FAILED` and `ALLOWANCE_EXHAUSTED` play states are unexercised (no generation, no
  allowance system exists yet at this milestone) — M2 responsibility.
- No automated test suite exists yet (no Jest/RTL configured) — not requested by this task's
  validation list, which specified doctor/typecheck/lint/export/secret-scan/localization/preview
  checks only; flagging so it isn't silently assumed to exist.

## M1-R2 Prerequisites (Exact)

1. **Owner creates the dev Supabase project** — credentials held outside the repository, production
   non-existent or provably unreachable from agent tooling (per `docs/AGENT_TOOLING.md`).
2. **Owner sets up the Expo/EAS account** and iOS build configuration (D24) — costed builds remain
   owner-initiated, never agent-initiated.
3. Initial schema for User, Story, StoryConfiguration, Character, World (Authoring Data only, per
   `docs/ROADMAP.md` M1 scope) — no PlayerRun/StoryState/character-chat schema yet.
4. Supabase Auth wiring (email/password + at least one OAuth provider; guest/anonymous sessions).
5. Android runtime evidence (device or emulator) and iOS EAS cloud build evidence — both still owed
   for M1's own evidence bar, per the per-platform table in `docs/TECHNICAL_ARCHITECTURE.md` §8 and
   `docs/ROADMAP.md` M1.
6. CI that builds all three targets (stated M1 scope, not yet done).
7. Do **not** re-litigate D32–D34 or the web-first sequencing — those are settled inputs to R2, not
   open questions for it.

## Recommended Next Task

**LW-M1-R2 — Dev Supabase + Auth + Android/iOS Foundation.** Do not begin it in this task/session.
