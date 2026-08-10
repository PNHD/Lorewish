# Narrative Model Evaluation

Status: LW-M2-R1. Records the model-evaluation architecture and current findings for the
M2 story engine's `NarrativeProvider` boundary
([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §5). This is an evaluation *starting
point*, not a settled model choice — see §5 below for what would need to happen before treating
any ranking here as final.

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

## 6. Verdict for this task

**ENGINE_IMPLEMENTATION_PASS. REAL_NARRATIVE_PROVIDER_PENDING.**

The provider abstraction, one real (unverified-against-network) adapter, two typed stubs, the
Golden Set, and the bakeoff harness are all implemented and exercised end-to-end against the fake
provider. No real generation evidence exists, and none is claimed. See `CURRENT_WORK.md` for how
this composes with the rest of the M2-R1 verdict.
