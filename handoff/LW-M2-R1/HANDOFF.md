# LW-M2-R1 Handoff — Real Interactive Story Engine Vertical Slice

**Task**: LW-M2-R1. **Verdict: ENGINE_IMPLEMENTATION_PASS. REAL_NARRATIVE_PROVIDER_PENDING.**
**IMPLEMENTATION_HEAD**: `68469d6c41febcec742a20319c30548db5149748`
**Baseline**: `origin/main` at `20d27a36e6b849239a6a5d0bdd62b007ea44bdb4` (verified via `git fetch` +
`git rev-parse`, not assumed from the task brief's explicitly-untrusted value).
**Branch**: `feature/lw-m2-story-engine-v1`, pushed. **Draft PR**: https://github.com/PNHD/Lorewish/pull/2
(not merged — owner/reviewer reviews this handoff first, per project convention).

No sub-agents were used anywhere in this task (explicitly forbidden by the brief). No dynamic
workflows, no automatic delegation. Single Claude Desktop session throughout.

## What this task actually proves, in one paragraph

A real signed-in user can start a story, receive a real generated opening scene, make a predefined
choice or type a custom action, receive a real consequence, have it committed atomically and
idempotently, reload and land back exactly where they were, "Replay from here" to a genuinely
distinct retained branch whose canon does not leak into or from its sibling, and have a forced
generation failure resolve to a recoverable state that never masquerades as an ending and never
costs them anything — all verified by real HTTP calls against the live `lorewish-dev` Supabase
project and its two deployed Edge Functions, not only by unit tests. The one thing not proven is
narrative quality from a real AI model, because no provider credential exists in this environment.

## Reading order for a reviewer

1. **This file**, then `CURRENT_WORK.md`'s new LW-M2-R1 section (top of the file) — the fullest
   narrative record, including the live bug found and fixed.
2. `git-diff.patch` / `files-changed.txt` — the actual change.
3. `supabase/migrations/20260810190000_m2_story_engine_schema.sql` (also `schema.txt`) — read the
   file header comment block first; it explains the branch-safe scene ordering and canon isolation
   design before the SQL itself.
4. `grants.txt`, `supabase-advisors.txt`, `rls-test-results.txt` — live security evidence.
5. `engine-tests.txt` / `continuous-play-tests.txt` / `narrative-quality-tests.txt` /
   `context-tests.txt` — the 35 unit tests, by category.
6. `docs/NARRATIVE_MODEL_EVALUATION.md` + `model-evaluation-summary.txt`/`.json` +
   `narrative-samples/` — the provider architecture and what's blocked on a credential.
7. `ci-results.txt` — GitHub Actions outcome for this exact head.

## Files in this package

| File | What it is |
|---|---|
| `HANDOFF.md` | This file |
| `git-status.txt` | `git status` at IMPLEMENTATION_HEAD |
| `git-log.txt` | `git log origin/main..HEAD --stat` |
| `files-changed.txt` | `git diff origin/main..HEAD --stat` |
| `git-diff.patch` | Full diff, `origin/main..HEAD` |
| `test-results.txt` | `npm test` + `npm run typecheck` + `npm run lint`, full output |
| `engine-tests.txt` | `turn-pipeline.test.ts` verbose output (DOMAIN category, 14 tests) |
| `continuous-play-tests.txt` | Same suite, framed against CONTINUOUS_PLAY_CONTRACT.md's state machine |
| `narrative-quality-tests.txt` | `quality-gate.test.ts` verbose output (QUALITY category, 15 tests) |
| `context-tests.txt` | `context-assembler.test.ts` verbose output (CONTEXT category, 6 tests) |
| `schema.txt` | The migration SQL (authoritative schema source) |
| `schema-migration-list.txt` | `supabase migration list --linked` confirming live application |
| `grants.txt` | Live `information_schema`/`pg_proc`/`pg_policies` queries against `lorewish-dev` |
| `supabase-advisors.txt` | `supabase db advisors --linked --type security` (5 expected WARN, explained) + `--type performance` (0 findings) |
| `rls-test-results.txt` | Transcript of both live adversarial probe scripts (20/20 PASS) |
| `model-evaluation-summary.txt` / `.json` | `npm run bakeoff` output against the fake provider (6/6, 0 repairs) |
| `narrative-samples/representative-en.md`, `representative-vi.md` | One EN + one VI sample, clearly marked as fake-provider output |
| `web-build.txt` | `npm run export:web` output |
| `ci-results.txt` | GitHub Actions run outcome for this branch's PR |

**Deliberately excluded** (per this task's own instruction): provider API keys, raw auth tokens,
service-role key, giant model logs, full private story corpus, `node_modules`, build output, raw
native binaries. The two live-probe scripts themselves (which briefly held the project's
service-role key in an ephemeral, out-of-repository scratch file, deleted after use and never
printed a second time) are not included — `rls-test-results.txt` is their console-output
transcript instead.

## Security — the one real bug this task found and fixed

`SupabaseTurnRepository`'s constructor originally called
`createClient(supabaseUrl, userJwt, { global: { headers: { Authorization: \`Bearer ${userJwt}\` } } })`
— passing the **user's JWT** as the Supabase client's `apikey`/`key` parameter, which both
Edge Functions call. This is wrong: `apikey` must be the project's own anon/publishable key
regardless of caller identity; the caller's identity belongs only in the separate `Authorization`
header. Every call past `PRECHECK` failed with "Invalid API key" from PostgREST/GoTrue. Found via a
temporary, explicitly time-boxed debug build that echoed the real error message to the response
body (reverted immediately after diagnosis — the shipped function never returns internal error
detail to a caller), fixed in both Edge Functions plus `supabase-repository.ts`, redeployed, and
reverified with the full probe suite. Recorded here rather than silently fixed, because a config
mistake that fails closed (every call was rejected, nothing was ever exposed) is exactly the kind
of finding a handoff should surface, not bury.

## What is NOT claimed

- Real AI-model narrative quality, in either language — `NARRATIVE_PROVIDER_CREDENTIAL_REQUIRED`.
- A full authenticated click-through of the `/play` UI rendering live data in a browser — the same
  server boundary was instead verified directly over HTTP (more precise for a security/contract
  claim; not the same as watching pixels).
- GitHub Actions CI success on Android/iOS for this exact head, until `ci-results.txt` confirms it.

See `CURRENT_WORK.md`'s LW-M2-R1 section for the full record, including known issues and the
recommended next task.
