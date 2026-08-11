# LW-M2-R3 Handoff

Task: DeepSeek Flash Alpha Soak + Reliability Hardening + Authenticated Live E2E

## Decision

`DEEPSEEK_FLASH_ALPHA_APPROVED` for controlled DEV alpha only. This is not a production-provider decision.

- Baseline: `origin/main` `4eb535037cc72f3cddeca3f931f2ac0a74626e33`
- Branch: `feature/lw-m2-deepseek-alpha`
- Provider/model: DeepSeek `deepseek-v4-flash`; thinking disabled
- Structured output: official JSON object mode plus authoritative Lorewish Zod/moderation/quality validation
- Repair: one Flash repair maximum; no Pro fallback selected
- Alpha constraint: `AI_ALPHA_18_PLUS_ONLY`; `PRODUCTION_POLICY_CONSTRAINT_OPEN`
- Deferred: `GEMINI_3_6_BAKEOFF_DEFERRED`

## Gate evidence

- Final policy soak: 48 initial, 47 initial pass, 1 repair, 1 repair success, 48 final pass, 0 final failure.
- Continuity: 8/8 sequences, 4 EN + 4 VI, 24/24 continuation turns, 0 sequence failure.
- Live DEV migration applied only to `sfarcofvqfeobtcizxyv`.
- `submit-turn` DEV Edge Function ACTIVE v7 with JWT verification enabled.
- DeepSeek key is an Edge secret and was not found in the web bundle.
- Live web deployed to `https://lorewish.pages.dev`; `/preview` remains public and `/play` requires sign-in.
- Authenticated adult-account E2E: pending owner login/confirmation at handoff drafting time; see `browser-e2e.md`.

## Important interpretation

DeepSeek beta strict tool calling was prototyped but still returned malformed tool arguments with Flash and Pro. It was not selected. Provider-side JSON mode is defence in depth only; Lorewish never accepts data that fails its own schema or quality gate.

M2 cannot be marked CLOSED until the remaining authenticated EN/VI live browser checks and VI human-review surface are completed.

