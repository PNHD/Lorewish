# LW-M2-R3 Handoff

Task: DeepSeek Flash Alpha Soak + Reliability Hardening + revised public UI-shell E2E

## Decision

`DEEPSEEK_FLASH_ALPHA_APPROVED` for controlled DEV alpha only. This is not a production-provider decision.

- Baseline: `origin/main` `4eb535037cc72f3cddeca3f931f2ac0a74626e33`
- Branch: `feature/lw-m2-deepseek-alpha`
- Provider/model: DeepSeek `deepseek-v4-flash`; thinking disabled
- Structured output: official JSON object mode plus authoritative Lorewish Zod/moderation/quality validation
- Repair: one Flash repair maximum; no Pro fallback selected
- Product/provider policy: `GENERAL_AUDIENCE_13_PLUS`; `MINOR_GUARDIAN_CONSENT_REQUIRED`; `PRODUCTION_POLICY_REVIEW_REQUIRED`
- Auth roadmap: `USER_AUTH_UX_DEFERRED`; `SOCIAL_AUTH_DEFERRED`; `PUBLIC_REAL_AI_BROWSER_E2E_DEFERRED`; `DEFERRED_AUTH_INFRASTRUCTURE`
- Deferred: `GEMINI_3_6_BAKEOFF_DEFERRED`

## Gate evidence

- Final policy soak: 48 initial, 47 initial pass, 1 repair, 1 repair success, 48 final pass, 0 final failure.
- Continuity: 8/8 sequences, 4 EN + 4 VI, 24/24 continuation turns, 0 sequence failure.
- Both LW-M2-R3 migrations applied only to DEV `sfarcofvqfeobtcizxyv`; applied history was not rewritten.
- `submit-turn` DEV Edge Function ACTIVE v8 with JWT verification enabled.
- DeepSeek key is an Edge secret and was not found in the web bundle.
- Live web deployed to `https://lorewish.pages.dev` (deployment `https://35d2e67b.lorewish.pages.dev`); `/preview` remains public and deterministic, while `/play` exposes no anonymous inference.
- Revised browser gate: public `/preview` and signed-out `/play` shell verified; real provider correctness is proven independently at the server/engine boundary. See `browser-e2e.md`.

## Important interpretation

DeepSeek beta strict tool calling was prototyped but still returned malformed tool arguments with Flash and Pro. It was not selected. Provider-side JSON mode is defence in depth only; Lorewish never accepts data that fails its own schema or quality gate.

The owner superseded mandatory login and public real-AI browser E2E. With the revised closeout bar, all M2 technical/provider/security gates pass: **M2 = CLOSED**. M3 is recommended next but was not started.
