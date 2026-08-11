# Guest allowance contract — LW-W4-R1

Source: `supabase/migrations/20260811093214_lw_w4_guest_beta_safety.sql`

## Story (20/day for anonymous Guests)

- `lw_precheck_and_start_turn` is renamed to `lw_internal_precheck_and_start_turn` (permanent-user cap 30, unchanged) and wrapped by a new `lw_precheck_and_start_turn` that:
  - Returns the idempotent existing-turn path unchanged for any `turn_id` already owned by the caller (so committed/failed replies stay observable after the cap is hit).
  - For anonymous callers (`auth.jwt() ->> 'is_anonymous' = true`), reads/creates today's `usage_counters` row and returns `ALLOWANCE_EXHAUSTED` once `generation_count >= 20`, before calling into the internal (provider-calling) primitive.
  - Permanent (non-anonymous) callers are unaffected and keep the pre-existing 30/day cap.
- `usage_counters.generation_count` (Story) and the new `chat_generation_count` (Chat) are independent columns, reset together on UTC-day rollover by `lw_reset_usage_counters_for_new_utc_day`.

## Character Chat (30/day for anonymous Guests)

- `lw_start_chat_generation` (in `20260811075526_lw_w3_r2_roleplay_chat_runtime_characters.sql`, extended by W4) checks `chat_generation_count` and returns `CHAT_ALLOWANCE_EXHAUSTED` at `>= 30` for anonymous callers before reserving a provider attempt.

## Failure refund / no double debit

- Both Story and Chat reserve their allowance unit before the provider call and release it via `lw_fail_turn` / `lw_fail_chat_generation` on failure, so a failed generation never consumes the daily allowance.
- The double-debit regression fixed in LW-W3-R2 (`lw_commit_turn` incorrectly incrementing `generation_count` a second time on commit) remains fixed; W4 did not reintroduce a second counter write on the commit path (verified by reading the current `lw_commit_turn`/`lw_commit_chat_generation` definitions — no `usage_counters` write outside `lw_precheck_and_start_turn`/`lw_start_chat_generation`/`lw_fail_*`).

## Idempotency

- Re-submitting the same `turn_id` / chat `message_id` returns the existing persisted result rather than re-invoking the provider or re-debiting the counter (verified live: the roleplay-chat E2E test's duplicate-submit-resistant scenario asserts exactly one `submit-turn` network call for a double-click).

## Live numbers observed this session

No Guest in this session hit either cap (each test run used 2-4 Story turns and 1-2 Chat messages per Guest), so exhaustion behavior was verified by migration-code reading rather than by driving 20/30 real generations (to avoid unnecessary provider spend, per the closeout brief).
