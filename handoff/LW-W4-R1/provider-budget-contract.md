# Provider budget contract — LW-W4-R1

Source: `supabase/migrations/20260811093214_lw_w4_guest_beta_safety.sql` and `20260811101330_lw_w4_provider_budget_service_role_fix.sql`.

## Global breaker

- `private.provider_daily_budget.total_attempts` is `check (total_attempts between 0 and 250)`.
- `lw_reserve_provider_attempt` atomically increments the day's `total_attempts` only `where private.provider_daily_budget.total_attempts < 250`; if the row is already at 250 the reservation fails and the caller returns `BETA_CAPACITY_REACHED` (see `provider-budget.ts` / `BetaCapacityReachedError`) before any real provider call is made.
- `lw_complete_provider_attempt` records success/failure and cost/latency metadata against the reserved attempt row.

## Shared across Story and Chat

- Both `supabase/functions/submit-turn/index.ts` and `supabase/functions/character-chat/index.ts` construct `SupabaseProviderAttemptBudget` and pass it into their respective provider wrappers, and both ultimately call the same `lw_reserve_provider_attempt` / `lw_complete_provider_attempt` RPCs against the single `private.provider_daily_budget` row. There is one shared counter, not one per feature.
- A repair attempt (the second, corrective call after a validation failure — see `vi-real-samples.md` / `character-chat.ts`) reserves and counts as its own attempt against the same 250 cap, exactly like a first attempt.

## Service-only telemetry

- `private.provider_attempts` (per-attempt cost/latency/model log) and `private.provider_daily_budget` live in the `private` schema, which is not exposed to the Data API, and grants are `service_role` only (`grant select, insert, update on private.provider_attempts to service_role;`).
- Live-verified this session: an anonymous Guest's own client cannot call `lw_provider_daily_summary` (service-only RPC) or read `alpha_generation_access` — both attempts errored as expected (`security-results.txt`).

## Verification performed

- Read the current SQL definitions directly (not relying on memory of what Codex reported) to confirm the 250 cap, the shared-budget wiring, and the service-role-only grants.
- Ran the live isolation probe (`security-results.txt`) confirming the service-only RPC boundary holds for real anonymous JWTs against DEV.
- Did not drive the counter to 250 in this session — that would consume real provider budget for no additional confidence beyond reading the atomic `where total_attempts < 250` guard and its unit tests (`w4-migration-contract.test.ts`: "atomically hard-caps shared real-provider attempts at 250").
