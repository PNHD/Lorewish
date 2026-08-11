# Anonymous RLS / advisor audit — LW-W4-R1

## Advisors (`supabase db advisors --linked`, full output in `supabase-advisors.txt`)

20 findings total, all `WARN`, zero `ERROR`, zero performance-category findings:

| Category | Count | Disposition |
|---|---|---|
| `authenticated_security_definer_function_executable` | 6 | Expected — these are the app's intentional RPC entry points (`lw_fail_turn`, `lw_get_or_create_chat_thread`, `lw_get_run_state`, `lw_precheck_and_start_turn`, `lw_promote_chat_memory`, `lw_replay_from_scene`). |
| `auth_allow_anonymous_sign_ins` | 13 | Expected — this is a Guest-first beta; every flagged table has RLS policies deliberately scoped to `owner_user_id = auth.uid()` (which anonymous JWTs satisfy). |
| `auth_leaked_password_protection` | 1 | Real, low-severity gap: HaveIBeenPwned password checking is off. Only affects the permanent email/password sign-in path, not Guests. Not a W4 blocker; worth enabling before wider promotion. |

## SECURITY DEFINER ownership spot-check

Advisors flag `SECURITY DEFINER` functions as callable by `authenticated` without checking *what* they do once called. Read the live SQL for 4 of the 6 flagged functions directly (not assumed from memory):

- `lw_fail_turn` — `v_caller := auth.uid()`; joins `player_runs` on `pr.owner_user_id = v_caller`.
- `lw_get_or_create_chat_thread` — same pattern; raises `42501` if the run isn't owned by the caller.
- `lw_promote_chat_memory` — joins through `character_chat_threads`/`player_runs` on `pr.owner_user_id = v_caller`.
- `lw_precheck_and_start_turn` — `if v_caller is null then raise exception`, then ownership-checked idempotent-turn / allowance logic.

All four use `set search_path = ''` (prevents search-path hijacking) and derive the caller strictly from `auth.uid()`, never from a client-supplied parameter for the ownership check itself. This is the expected, correct pattern for exposing Guest-writable RPCs without over-granting table access.

## Live A/B isolation (independent of the SQL reading above)

`scripts/w4-live-dev-probe.ts` run against DEV twice this session — see `security-results.txt` / `guest-auth-contract.md`. Confirms cross-Guest read/write/child-attach are all blocked in practice, not just in the policy text.

## Grants

Not re-dumped in full this session (unchanged from the SQL read above plus the historical `LW-M1-R3/grants-*.txt` baseline); the two W4-era migrations that touch grants (`20260811095106`, `20260811101330`) were read directly and only adjust `private.provider_attempts` / `provider_daily_budget` service-role grants and one delete-guard fix, not table-level anon/authenticated exposure.
