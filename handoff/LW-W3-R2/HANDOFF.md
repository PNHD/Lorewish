# LW-W3-R2 handoff — allowance regression repair

## A. Repository and scope

- Repository: `E:\AIProjects\Lorewish`
- Branch: `feature/lw-w3-roleplay-chat`
- Verified pre-repair local/remote/PR head: `cc215cde00cfbd614643a8655d601535ada721e8`
- Repair implementation head: `855c2ad5cd8b7affd9397be5fb5fb5b013fa100f`
- Draft PR #5: https://github.com/PNHD/Lorewish/pull/5
- PR remains open and draft. It was not merged.
- WEB-M4 was not started.

## B. Root cause and repair

M2 reserves one daily Story allowance unit atomically in `lw_precheck_and_start_turn`, and `lw_fail_turn` releases that reservation on failed generation. The already-applied W3-R2 migration accidentally added another `usage_counters` increment to its extended `lw_commit_turn`, producing a successful path of `N -> N+1 -> N+2`.

Forward migration `20260811085819_lw_w3_r2_allowance_double_debit_repair.sql` replaces the current 17-argument W3-R2 `lw_commit_turn` with the same behavior except for removing the successful commit-time counter write. Runtime Character creation, Character memory, canon facts, provider accounting, result Scene creation, branch behavior, and idempotent committed-turn return are preserved.

## C. Exact allowance behavior

- Successful Story: `N=7 -> precheck=8 -> commit=8`
- Duplicate commit: remains `8`; Scene count remains one
- Failed Story generation: `8 -> precheck=9 -> lw_fail_turn=8`
- Exhausted allowance: remains `30`; no Turn is created
- Character Chat start+commit: remains `8`

Live result: `ALLOWANCE_REGRESSION_ROLLBACK_ONLY_PASS`.

## D. Character Chat idempotency

Repair was required. The old `lw_start_chat_generation` could return a persisted player message for a reused ID while application generation used different newly supplied content. The repaired function accepts identical trimmed content and rejects different content with SQLSTATE `22023` before provider generation.

## E. Migration and live DEV verification

- DEV project only: `sfarcofvqfeobtcizxyv`
- Pre-repair counter state: 0 rows, total `generation_count=0`
- No historical correction was required or performed
- Applied forward migration: `20260811085819`
- Local and remote migration histories match through `20260811085819`
- Rollback-only fixtures removed: post-probe counter rows=0, total=0, probe users=0

See `allowance-regression-repair.md` for the exact contract and probe details.

## F. Security

- `lw_commit_turn`: public=false, anon=false, authenticated=false, service_role=true
- `lw_start_chat_generation`: public=false, anon=false, authenticated=false, service_role=true
- Both remain `SECURITY DEFINER` with `search_path=""`
- Live `lw_commit_turn` definition has no `insert into public.usage_counters` and no `update public.usage_counters`
- RLS remains enabled on `usage_counters`, `character_chat_threads`, and `character_chat_messages`
- Advisor findings remain the pre-existing/intentional warnings documented in `supabase-advisors.txt`; no repaired canonical commit RPC is exposed to authenticated/anon

## G. Validation

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS, 13 files / 125 tests
- `npm run export:web`: PASS, 9 static routes
- `npm run test:e2e`: PASS, 8/8 desktop Chromium + Pixel 7
- Live rollback-only allowance probe: PASS
- GitHub Actions run `31476638310`: PASS on exact head `855c2ad5...`
- Android/iOS: skipped by web-first policy; no native build was run
- No provider call and no large DeepSeek campaign were used for this repair

## H. Evidence package

The regenerated `Lorewish_LW-W3-R2_handoff.zip` contains this handoff directory. Its final byte size and SHA-256 are recorded in the final task report. Packaging is evidence-only and did not move implementation HEAD.

## I. Verdict

`W3_R2_REPAIR_PASS`

Stop here. Do not begin WEB-M4 and do not merge PR #5 without owner authorization.
