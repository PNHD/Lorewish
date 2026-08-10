# Narrative Model Evaluation

Status: **LW-M2-R2. MODEL_SELECTION_REVIEW_REQUIRED.** Records the model-evaluation architecture
and current findings for the M2 story engine's `NarrativeProvider` boundary
([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §5). This is an evaluation *starting
point*, not a settled model choice — see §5 below for what would need to happen before treating
any ranking here as final. §7–§10 below are new in LW-M2-R2; §1–§6 are LW-M2-R1's original content,
left in place rather than rewritten, per this project's established practice of recording
supersession instead of silently editing history.

## 0. LW-M2-R2 summary (read this first)

**This section was updated mid-task.** The first half of LW-M2-R2 ran with no provider credential
in this environment (the original text below this note is preserved as §0a for the record). The
owner then supplied `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` in a local, gitignored `.env.local` for
an owner-initiated local bakeoff, which **did run for real** — see §11 for the complete results.
This section now summarizes the final state; §0a is kept for how the task started.

- **A real, live bakeoff ran** against `gemini-3.5-flash-lite` (fully clean, 12/12), `deepseek-v4-pro`
  (fully clean post-fix, 12/12), and `deepseek-v4-flash` (fully clean post-fix, 11/12).
  `gemini-3.6-flash` is **partial** — its free-tier daily quota (20 requests/day/project/model,
  confirmed from the API's own error body) was exhausted mid-campaign; EN results are reliable, VI
  results and cost figures from that run are not (see §11). `SECOND_RUN_PENDING_RATE_LIMIT` for
  `gemini-3.6-flash`.
- **`DeepSeekNarrativeProvider` was implemented for real** during this task (it had been a stub —
  see §0a) and live-tested against both tiers.
- **Real EN/VI narrative samples exist** for every model actually run — see
  `handoff/LW-M2-R2/narrative-samples/`. No samples were fabricated for `gemini-3.6-flash`'s
  incomplete portion.
- **Three real bugs were found and fixed mid-bakeoff** because they were corrupting the evidence
  this task exists to produce: a Vietnamese-language false positive in Lorewish's own quality gate,
  a Gemini cost-accounting gap (thinking tokens excluded), and a DeepSeek adapter misconfiguration
  (thinking mode left enabled, which could silently zero out narrative output). Full detail in §11
  and `handoff/LW-M2-R2/narrative-samples/notable-findings/`.
- **The `PRODUCTION_POLICY_CONSTRAINT` finding stands** (§9): both Gemini's and DeepSeek's current
  API terms restrict the calling service to an 18+ audience; Lorewish is 13+. Not acted on
  automatically.
- Two known M2-R1 polish issues (cross-user turn submission, invalid `selected_choice_id` both
  returning generic HTTP 500) were fixed and **verified live** against `lorewish-dev` earlier in
  this task — see CURRENT_WORK.md's LW-M2-R2 section, not this document.
- **Verdict remains `MODEL_SELECTION_REVIEW_REQUIRED`.** No production model is selected by this
  task even with real data in hand — human/native-speaker review of the samples in
  `narrative-samples/` is still required first, per the task brief. See §10 and §11.

## 0a. Original LW-M2-R2 summary (no-credential phase — superseded by §0/§11, kept for the record)

This task's brief called for a real Gemini/DeepSeek provider bakeoff. **No live bakeoff was run
against any real provider in this task** — `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `DEEPSEEK_API_KEY`,
and `ANTHROPIC_API_KEY` are all absent from this environment (checked as variable names only, never
printed). Per the task brief's explicit credential-safety rule ("if the Gemini key is missing, stop
Gemini live evaluation and report `GEMINI_API_KEY_REQUIRED`"), work proceeded exactly as far as it
could without a credential:

- **`GeminiNarrativeProvider` was implemented for real** (`supabase/functions/_shared/engine/providers.ts`)
  against the current official `generateContent` API, model ids re-verified against current docs
  (§7), and covered by 12 unit tests against a mocked `fetch` (parsing, cost accounting, error
  normalization, timeout, malformed-response handling) — but **never called against the live
  network**. `GEMINI_API_KEY_REQUIRED`.
- **`DeepSeekNarrativeProvider` was intentionally left a typed stub.** The task brief's rule for a
  missing DeepSeek key is "continue Gemini work, report `DEEPSEEK_API_KEY_REQUIRED`" — not "build the
  adapter blind with no way to verify it." Current DeepSeek model ids are recorded in §8 for the task
  that has a credential. `DEEPSEEK_API_KEY_REQUIRED`.
- **No narrative samples were produced for any candidate model.** Per the task brief's explicit
  instruction, a model that was not run gets no fabricated sample — `narrative-samples/` in this
  task's handoff documents this rather than inventing content.
- **A material policy finding, not previously recorded**: both Gemini's and DeepSeek's current API
  terms restrict the calling service to users 18+ (§9) — Lorewish is a 13+ mainstream product
  ([PRODUCT_VISION.md](PRODUCT_VISION.md)). This is recorded as `PRODUCTION_POLICY_CONSTRAINT` and
  was **not** used to change Lorewish's age policy or provider eligibility, per the task brief's
  explicit instruction not to make that call automatically.
- Two known M2-R1 polish issues (cross-user turn submission, invalid `selected_choice_id` both
  returning generic HTTP 500) were fixed and **verified live** against `lorewish-dev` — see
  CURRENT_WORK.md's LW-M2-R2 section, not this document, for that work (it is provider-adjacent but
  not a model-evaluation finding).
- **Recommended verdict: `MODEL_SELECTION_REVIEW_REQUIRED`.** No production model is selected by
  this task. See §10.

## 1. Architecture: provider-agnostic by construction

`NarrativeProvider` (`supabase/functions/_shared/engine/types.ts`) is a single-method interface —
`generateTurn(context): Promise<ProviderCallResult>` — implemented by:

- `FakeNarrativeProvider` (`fake-provider.ts`) — deterministic, no network call, used for every
  automated test and for local/dev operation when no real credential is configured.
- `AnthropicNarrativeProvider` (`providers.ts`) — real HTTP adapter, `claude-sonnet-5`.
- `OpenAiNarrativeProvider`, `GeminiNarrativeProvider` (`providers.ts`) — typed stubs that throw a
  clear "not implemented, no credential available" error. They exist so the registry demonstrates
  provider-agnosticism and so a future task with a credential has a slot to fill in, not because
  they were partially built and abandoned.

None of `turn-pipeline.ts`, `quality-gate.ts`, or `context-assembler.ts` reference a provider by
name. Switching providers is a `selectProvider()` configuration change
(`LOREWISH_NARRATIVE_PROVIDER` / `LOREWISH_NARRATIVE_MODEL` env vars on the Edge Function), never a
call-site change.

## 2. `NARRATIVE_PROVIDER_CREDENTIAL_REQUIRED`

**No AI provider credential exists in this environment.** Checked directly (variable *names*
only, values never printed, never searched for in committed history):

```
$ grep -oE '^[A-Z_]+=' .env.local
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

$ env | grep -oE '^[A-Za-z_]+' | grep -iE 'API_KEY|SECRET|TOKEN'
AGENTROUTER_TOKEN   # unrelated agent-runtime infra, not a narrative provider key
```

Neither `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, nor `GEMINI_API_KEY`/`GOOGLE_AI_API_KEY` is set
locally or in `.env.local`. Per the task brief's instruction for exactly this situation:
implementation proceeded through the full provider abstraction, the fake provider, persistence,
the state machine, the test suite and this harness, then **stopped before any paid-provider call**.

**To run this milestone against a real model, the owner needs to set ONE of:**

| Provider | Environment variable(s) | Where |
|---|---|---|
| Anthropic (adapter implemented) | `LOREWISH_NARRATIVE_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<key>` | Supabase Edge Function secrets (`supabase secrets set`) for the deployed function; local `.env` (never committed) for `npm run bakeoff` |
| OpenAI (adapter not yet implemented — stub only) | `OPENAI_API_KEY` | Same, once `OpenAiNarrativeProvider` is filled in |
| Gemini (adapter not yet implemented — stub only) | `GEMINI_API_KEY` | Same, once `GeminiNarrativeProvider` is filled in |

No key was requested from the owner via chat, none was searched for in git history, and none is
stored anywhere in this repository.

## 3. Current public baseline (owner-supplied, re-verified 2026-08-10)

The task brief supplied current public pricing/availability facts as an evaluation starting
point. The Anthropic figures were independently re-verified against
`https://platform.claude.com/docs/en/api/messages` and a web search before `AnthropicNarrativeProvider`
was written (per the task's "verify current official provider docs again" instruction) —
confirmed: `claude-sonnet-5` is the correct model id, the Messages API request shape (endpoint,
`anthropic-version` header, `tool_choice`-forced structured output), and that Sonnet 5 **rejects
non-default `temperature`/`top_p`/`top_k` with HTTP 400** — the adapter deliberately never sets
them.

| Provider / model | Context | Pricing (input / output per 1M tokens) | Notes |
|---|---|---|---|
| OpenAI GPT-5.4 mini | 400k | $0.75 / $4.50 | Not independently re-verified in this task (no OpenAI adapter was written to verify against) |
| Anthropic Claude Sonnet 5 (`claude-sonnet-5`) | — | $2 / $10 through 2026-08-31, then $3 / $15 | Re-verified; adapter implemented |
| Gemini (Flash family) | — | — | Not independently re-verified; task brief recommends a stable versioned model over a moving `latest` alias for production |

**These are cost figures, not quality rankings.** Per D18/TECHNICAL_ARCHITECTURE.md §10, unit cost
is measured per capability from real calls, never assumed from price or coding benchmarks. No
narrative-quality claim is made for any provider by this table.

## 4. Golden Set + Bakeoff Harness

- **Golden Set**: `supabase/functions/_shared/engine/golden-set/cases.ts` — 6 original scenarios
  (EN × Fantasy/Romance/Adventure, VI × Fantasy/Romance/Adventure), per
  [NARRATIVE_QUALITY_CONTRACT.md](NARRATIVE_QUALITY_CONTRACT.md) §F's minimum coverage. Each case
  specifies premise, player role, starting situation, character identity, an initial decision,
  expected invariant facts, and prohibited contradictions — never an exact expected prose string,
  since generation is nondeterministic. Vietnamese cases additionally specify the four-slot address
  model (§C). Stress coverage (dialogue, forms of address, relationship change, branching, custom
  actions, continuity, emotional scenes) is tracked per case in `stressCoverage`.
- **Harness**: `supabase/functions/_shared/engine/golden-set/bakeoff.ts`, run via `npm run bakeoff`.
  **DEV-ONLY, OWNER-INITIATED** — not wired into any CI workflow, not run on push. It runs every
  case through the real `turn-pipeline` building blocks (`selectProvider` → `assembleContext` →
  `provider.generateTurn` → `StructuredGenerationResultSchema` validation → `runQualityGate`, with
  the same one-repair-max rule as production), and records per case: provider, model, input/output
  tokens, latency, estimated cost, schema validity, quality-gate pass/fail with failure codes,
  whether a repair was required, and a truncated narrative sample. No API key or raw secret header
  is ever written to the report — only token counts and structured booleans.
- **Result of the only run performed in this task** (fake provider, since no real credential
  exists): **6/6 cases passed**, 0 repairs required, ~5ms/case (no network). This proves the
  harness, the Golden Set fixtures, and the pipeline wiring work end-to-end. **It is not evidence of
  real narrative quality** — the fake provider's prose is templated, not model-generated. See
  `handoff/LW-M2-R1/model-evaluation-summary.txt` for the full report.

## 5. What "bakeoff PASS" would require before it means anything

Not performed in this task (no credential):

1. Run `npm run bakeoff` with `LOREWISH_NARRATIVE_PROVIDER=anthropic` and a real
   `ANTHROPIC_API_KEY` against all 6 cases.
2. Read the two representative samples (one EN, one VI) the task brief asks for — a compact,
   human-reviewable artifact, not the full corpus.
3. Add an optional model-based narrative critic for the naturalness read
   (NARRATIVE_QUALITY_CONTRACT.md §E) — deterministic checks in `quality-gate.ts` cannot judge
   whether prose *reads well*, only whether it violates a structural/consistency rule. Not built in
   this task; the harness's `CaseResult` shape has room for a `naturalness` field a future task can
   add without restructuring anything.
4. Repeat for OpenAI and/or Gemini once an owner credential and a completed adapter exist, so the
   ranking is comparative rather than single-provider.
5. Only after (1)–(4): a narrative-quality ranking claim would be evidence-backed rather than a
   price comparison mistaken for one.

## 6. Verdict for LW-M2-R1 (superseded by §0/§10 — kept as historical record)

**ENGINE_IMPLEMENTATION_PASS. REAL_NARRATIVE_PROVIDER_PENDING.**

The provider abstraction, one real (unverified-against-network) adapter, two typed stubs, the
Golden Set, and the bakeoff harness are all implemented and exercised end-to-end against the fake
provider. No real generation evidence exists, and none is claimed. See `CURRENT_WORK.md` for how
this composes with the rest of the M2-R1 verdict.

---

## 7. LW-M2-R2 model discovery — Gemini (verified 2026-08-10)

Verified against `https://ai.google.dev/gemini-api/docs/models`, `https://ai.google.dev/gemini-api/docs/pricing`,
`https://ai.google.dev/api/generate-content`, and `https://ai.google.dev/gemini-api/docs/structured-output`
(WebFetch against the live official docs, not training-data recall — the task brief's explicit
instruction). Third-party pricing aggregators were used only to cross-check, never as the primary
source.

| Candidate | Exact API model id | Context window | Pricing (per 1M tokens, input/output) | Structured output |
|---|---|---|---|---|
| Quality tier ("Gemini 3.6 Flash") | `gemini-3.6-flash` | 1,000,000 tokens (documented uniformly across the current Gemini model family) | $1.50 / $7.50 | Yes — `generationConfig.responseSchema` + `responseMimeType: "application/json"` |
| Cheap/high-volume tier ("Gemini 3.5 Flash Lite") | `gemini-3.5-flash-lite` | 1,000,000 tokens | $0.30 / $2.50 | Yes — same mechanism |

Request shape implemented in `GeminiNarrativeProvider` (`supabase/functions/_shared/engine/providers.ts`):
`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, API key via
the `x-goog-api-key` **header** (the current documented alternative to the legacy `?key=` query
parameter — deliberately not used, since a query-string key ends up in URLs and server access logs,
which the task brief's "no secret in logs" requirement rules out). Token usage is read from
`usageMetadata.promptTokenCount` / `usageMetadata.candidatesTokenCount`.

**Not independently re-verified in this task**: exact free/paid-tier RPM/TPM/RPD rate limits — the
official rate-limits page states these are usage-tier-dependent and viewable only in a signed-in AI
Studio console (`https://aistudio.google.com/rate-limit`), which requires the owner's own account
and was not something this task could or should access. The task brief's rate-limit-respecting rule
(no quota circumvention, no account rotation) is honored by not running any live call at all, not by
having verified the exact numeric limits.

**Google's own docs currently describe a newer "Interactions API" as the recommended path for the
latest features**, while `generateContent` is still fully documented, active, and explicitly
supported for structured JSON output. This adapter deliberately targets the better-documented,
longer-established `generateContent` endpoint rather than adopting the newer API sight-unseen for a
capability (structured output) it cannot verify against a live response either way in this task —
recorded here so a future task with a credential can deliberately evaluate migrating, rather than
this choice looking like an oversight.

## 8. LW-M2-R2 model discovery — DeepSeek (verified 2026-08-10, no adapter built)

Verified against `https://api-docs.deepseek.com/quick_start/pricing` and
`https://api-docs.deepseek.com/api/create-chat-completion`, cross-checked against independent web
search. **No `DEEPSEEK_API_KEY` exists in this environment, so no adapter was implemented** — this
section exists only so a future task with a credential does not have to re-derive current model ids
from scratch, per the task brief's "verify current docs before hardcoding any model id" instruction,
which does not gate on having a credential yet.

- **Legacy names retired**: `deepseek-chat` and `deepseek-reasoner` were retired 2026-07-24; both are
  now aliases that must migrate to the current model ids below (thinking mode is a request
  parameter, not a separate model id, under the new naming).
- **Recommended/strongest general-text candidate**: `deepseek-v4-pro` — $0.435/1M input, $0.87/1M
  output (after a documented permanent 75% price cut from its prior rate).
- **Cheapest/fastest candidate**: `deepseek-v4-flash` — $0.14/1M input (cache miss; cache-hit input
  is $0.0028/1M, a 98% discount), $0.28/1M output, 1,000,000 token context window, up to 384K output
  tokens, supports both non-thinking and thinking modes under the same model id.
- **Structured output**: `response_format: { type: "json_object" }` guarantees syntactically valid
  JSON but, unlike Gemini's `responseSchema` or Anthropic's tool-forced schema, does **not** enforce
  a specific shape — the docs explicitly warn the caller must additionally instruct the model to
  produce the desired JSON shape via the system/user message, or generation can run to the token
  limit as whitespace. A future DeepSeek adapter would need to embed
  `StructuredGenerationResultSchema`'s shape into the prompt text itself, not just set
  `response_format`, and would likely see a higher schema-validation-failure rate than Gemini/Anthropic
  as a result — this is a real capability gap, not just a minor implementation detail, and should
  weigh into the eventual owner/reviewer model-selection decision (§10).
- **Token usage** appears in `usage.prompt_tokens` / `usage.completion_tokens` (plus
  `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` for cache-aware cost accounting a future
  adapter should use, given the 98% cache-hit discount).

Neither candidate is a reasoning-only model in the sense the task brief warns against — both are
general chat/completion models with an optional thinking mode, not a model that can only be used in
a reasoning-only configuration.

## 9. `PRODUCTION_POLICY_CONSTRAINT` — provider terms vs. Lorewish's age policy

**Recorded, not acted on.** The task brief is explicit: record a provider terms/age conflict, do not
change Lorewish's content rating or user eligibility automatically. Lorewish is **13+ mainstream**,
explicitly **not an 18+ platform** ([PRODUCT_VISION.md](PRODUCT_VISION.md) — "Not an 18+ platform",
[MVP_SPEC.md](MVP_SPEC.md) — "a 13+ product").

- **Gemini API Additional Terms of Service** (`https://ai.google.dev/gemini-api/terms`, verified via
  web search 2026-08-10): the developer must be 18+, and — materially for Lorewish — the terms state
  the API must not be used "as part of a website, application, or other service that is directed
  towards or is likely to be accessed by individuals under the age of 18." This reads as a
  service-level restriction on the *audience*, not only the API caller's own age.
- **DeepSeek API terms of service**: the API specifically requires the caller/operator to be 18+
  (distinct from DeepSeek's consumer chat product, which has separate minor-with-guardian-consent
  provisions that do not appear to extend to the API).
- **Anthropic**, for comparison (already has an implemented, unverified-live adapter from LW-M2-R1):
  the Commercial API Terms also require an 18+ *account holder*, but Anthropic separately publishes
  "Responsible Use of Anthropic's Models: Guidelines for Organizations Serving Minors," which reads
  as permitting an 18+-operated service to serve a minor end-user audience under additional
  compliance obligations (age verification, monitoring, content moderation, child-privacy-law
  compliance) — a materially different posture from Gemini's blanket "not directed towards / likely
  accessed by under-18s" language.

**This is prose analysis of public terms pages by an engineering task, not a legal opinion.** The
exact wording, current effective date, and applicability to Lorewish's specific product shape need
owner/legal review before any provider decision treats this as settled. It is flagged here precisely
so that review can happen deliberately rather than the constraint being discovered later, after a
provider is already in production.

## 10. Model Selection Policy — recorded, not applied

Per the task brief's decision rule (recorded verbatim so it is legible to a reviewer without
re-reading the task brief): prefer the cheaper model when narrative quality/continuity are materially
indistinguishable; choose the premium model when it is clearly better on Vietnamese naturalness,
character voice, forms of address, or continuity. **This rule cannot be applied yet — it requires the
real, human-reviewed bakeoff outputs this task could not produce (§0).**

What exists today, for a future task to act on directly:
- A real, doc-verified Gemini adapter (quality + cheap tier), never exercised live.
- A real, doc-verified Anthropic adapter (from LW-M2-R1), never exercised live.
- DeepSeek model ids recorded, no adapter (no credential, and a real structured-output capability
  gap noted in §8 that should factor into whether DeepSeek is even a fair contender).
- The §9 policy constraint, which may independently rule out one or more candidates regardless of
  narrative quality, and should be resolved before — not after — a quality-based ranking is trusted.

**Verdict: `MODEL_SELECTION_REVIEW_REQUIRED`.** No production narrative model is selected by this
task. `LOREWISH_NARRATIVE_PROVIDER` remains configurable and defaults to the fake provider in this
environment, unchanged from LW-M2-R1. §11 below updates this with real data — the verdict itself
does not change.

---

## 11. LW-M2-R2 real live bakeoff results (owner-supplied credentials, mid-task)

The owner created a local, gitignored `.env.local` containing `GEMINI_API_KEY` and
`DEEPSEEK_API_KEY` partway through this task and asked for the bakeoff to actually run. Both keys
were loaded explicitly via `node --env-file=.env.local` for the `npm run bakeoff` CLI — never
inherited from this process's ambient environment, never committed, never logged, never set as a
Supabase Edge Function secret. Full results, samples, and raw data:
`handoff/LW-M2-R2/narrative-samples/COMPARISON.md` and `handoff/LW-M2-R2/bakeoff-raw/*.json` — this
section is the condensed version.

### 11.1 Results table

| Model | Tier | Pass rate (12 gens, 2 passes) | Repairs | Total cost | Median latency |
|---|---|---|---|---|---|
| `gemini-3.6-flash` | Quality | **Partial** — EN 6/6 reliable; VI unreliable (bug-contaminated) | n/a | undercounted (bug) | 9.5s (pre-fix) |
| `gemini-3.5-flash-lite` | Cheap | **12/12 (100%)** | 0 | $0.011981 | 2.24s |
| `deepseek-v4-pro` | Quality | **12/12 (100%)**, post-fix | 0 | $0.010052 | 12.42s |
| `deepseek-v4-flash` | Cheap | **11/12 (91.7%)**, post-fix | 4 | $0.002426 | 6.81s |

### 11.2 Three bugs found and fixed because they were corrupting this evidence

1. **`language_mixing` false positive on Vietnamese diacritics** (`quality-gate.ts`) — JS's
   ASCII-only `\b`/`\w` treated a diacritic letter as a word boundary, silently fragmenting a
   correct Vietnamese word (e.g. "mắt" → "m") into pieces that could chain into a false 4-word
   "English run." Flagged entirely correct Vietnamese prose. Fixed to operate on whole
   whitespace-delimited words instead of sub-word regex matches. This is why `gemini-3.6-flash`'s
   VI verdicts from its first two bakeoff passes are not trusted as evidence.
2. **Gemini adapter undercounted output tokens** (`providers.ts`) — `usageMetadata.thoughtsTokenCount`
   (Gemini's "thinking" tokens, billed the same as visible output per the pricing page) was not
   being read. A trivial prompt showed 9 visible tokens vs. 104 thinking tokens. Fixed to sum both.
3. **DeepSeek thinking mode left at its default** (`providers.ts`) — DeepSeek V4's reasoning tokens
   are drawn from the same `max_tokens` budget as the visible answer. For some prompts (Vietnamese
   narrative generation especially), reasoning alone consumed the entire 2048-token budget,
   producing empty, unparseable content — the dominant cause of DeepSeek's initial structural
   failures (10/12, 11/12 before the fix). Fixed by setting `thinking:{type:"disabled"}`, which
   also improved cost (~55% cheaper) and latency (~37% faster) on the same prompts.

A fourth, related **engine** robustness gap was found and fixed: `attemptGeneration()` in
`turn-pipeline.ts` only caught `ProviderTransportError`; any other adapter throw (as DeepSeek
produced before fix #3) propagated uncaught and would have crashed a real `submitTurn` call instead
of resolving `GENERATION_FAILED`. Now treated as the existing `unusable_output` class. This is a
genuine production fix, not a bakeoff-only one — see CURRENT_WORK.md.

### 11.3 `gemini-3.6-flash` — the incomplete result

Confirmed directly from the Gemini API's own 429 error body: the free tier allows **20 requests per
day, per project, per model**. This task's debugging calls plus two bakeoff passes exhausted it
before a clean, both-fixes-applied second pass could run. Per the task brief's explicit instruction,
no retry-past-limit, key rotation, or account rotation was attempted.
**`SECOND_RUN_PENDING_RATE_LIMIT`** — recommended: re-run once the quota resets (next UTC/Pacific
day boundary, per Google's standard free-tier reset).

### 11.4 Continuity (3-turn EN + VI)

Run through the real `submitTurn`/`InMemoryTurnRepository` pipeline (not the bakeoff harness's
isolated one-shot context), so scene history and canon facts genuinely carried forward exactly as
in production. Only possible for DeepSeek's quality tier this task (Gemini blocked by quota):

- **EN (`en-fantasy-01`, `deepseek-v4-pro`): PASS.** The curse mechanic established in turns 1–2
  was referenced accurately in turn 3 without being restated.
- **VI (`vi-romance-01`, `deepseek-v4-pro`): PASS, with one nuance flagged for human review**, not
  resolved automatically — a brief self-reference shift ("em"→"tôi") during an emotional beat that
  may be natural register variation or may be drift; native-speaker judgment needed.
- A separate, real architecture finding surfaced here: the production `StorySetup` payload has no
  field for pre-authored character identity, so every model (not just DeepSeek) invents its own
  character names/genders rather than matching the Golden Set's designed NPCs. Not a provider
  defect — see `handoff/LW-M2-R2/narrative-samples/notable-findings/character-identity-architecture-gap.md`.

### 11.5 What this does not do

Does not select a production model. `gemini-3.6-flash` needs a clean re-run before Gemini's two
tiers can be compared on equal footing. The `PRODUCTION_POLICY_CONSTRAINT` (§9) is unresolved and
may independently exclude a candidate. **Verdict remains `MODEL_SELECTION_REVIEW_REQUIRED`.**
