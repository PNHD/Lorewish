# LW-W3-R2-R1 allowance regression repair

## Root cause

M2 established reservation accounting: `lw_precheck_and_start_turn` atomically increments `usage_counters.generation_count` before provider generation, while `lw_fail_turn` releases that reservation on generation failure. The already-applied W3-R2 migration replaced `lw_commit_turn` to support runtime Characters but accidentally restored a second `usage_counters` upsert/increment during successful commit.

The broken successful path was therefore:

`N -> precheck N+1 -> commit N+2`

Provider attempts/cost remained separate, but the daily Story allowance was charged twice.

## Forward-only repair

- Applied migration: `20260811085819_lw_w3_r2_allowance_double_debit_repair.sql`
- DEV project: `sfarcofvqfeobtcizxyv`
- The applied W3-R2 migration was not edited.
- The current 17-argument `lw_commit_turn` was replaced with the same W3-R2 signature and canonical behavior, except that successful commit no longer inserts or updates `usage_counters`.
- Runtime Character creation, Character memory, canon facts, provider accounting, result Scene creation, branch behavior, and the committed-turn early return are unchanged.
- `lw_commit_turn` remains `SECURITY DEFINER`, `search_path=''`, and executable only by `service_role`.

## Exact repaired behavior

- Successful Story intent: `N -> precheck N+1 -> commit N+1`.
- Failed generation: `N -> precheck N+1 -> lw_fail_turn N`.
- Duplicate committed-turn call: allowance and Scene count remain unchanged.
- Allowance exhaustion: no additional debit and no Turn/provider-generation state is created.
- Character Chat start/commit: Story `generation_count` remains unchanged.

## Chat idempotency consistency repair

Repair was required. W3-R2 previously accepted an existing player `message_id` even when newly supplied content differed. The database retained the original content, but the repository generated from the new request text.

`lw_start_chat_generation` now compares the persisted trimmed content with the incoming trimmed content. Reusing an ID with identical content remains idempotent; reusing it with different content raises SQLSTATE `22023` before any provider call.

## Deterministic regression coverage

`supabase/tests/lw_w3_r2_allowance_regression.sql` is a rollback-only integration probe. On the live DEV schema it proved:

- `N=7; precheck=8; commit=8; duplicate_commit=8`
- `precheck=9; fail=8`
- `at_cap=30; exhausted=30; no_turn=true`
- `before=8; chat_start_and_commit=8`
- same Chat ID + same content accepted; same Chat ID + different content rejected

Result: `ALLOWANCE_REGRESSION_ROLLBACK_ONLY_PASS`.

The transaction rolled back. Post-probe verification found 0 `usage_counters` rows, total `generation_count=0`, and no synthetic probe user.

## Live security verification

- `lw_commit_turn`: public=false, anon=false, authenticated=false, service_role=true
- `lw_start_chat_generation`: public=false, anon=false, authenticated=false, service_role=true
- Both functions: `SECURITY DEFINER`, `proconfig=[search_path=""]`
- Live function definition: no `insert into public.usage_counters` and no `update public.usage_counters` in `lw_commit_turn`
- RLS remains enabled on `usage_counters`, `character_chat_threads`, and `character_chat_messages` with their existing owner-read policies.

No historical counter correction was required because the pre-repair live check still showed 0 rows and total 0.
