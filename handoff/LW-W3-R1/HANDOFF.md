# LW-W3-R1 Handoff

Status: `W3_R1_PASS`

## Exact baseline and implementation

- Repository: `https://github.com/PNHD/Lorewish`
- Baseline: `origin/main` at `3c73c14203ff39e9ea7ca466b49abaf66a394c1b` (`Merge LW-M2-R3 DeepSeek Flash controlled alpha`)
- Branch: `feature/lw-w3-character-memory`
- Implementation head: `8fd64fef6de4fd02c70e5a899f17cafe7e24635b`
- Commits: `87d98f2`, `81a3a97`, `8fd64fe`
- Draft PR: https://github.com/PNHD/Lorewish/pull/4
- Human owner retains merge and release authority. This task did not merge.

## Web-first policy

- `WEB_FIRST_UNTIL_RELEASE_CANDIDATE`
- `NATIVE_BUILD_VALIDATION_DEFERRED`
- `IOS_RELEASE_DEFERRED`
- `ANDROID_RELEASE_DEFERRED`

Routine push/PR CI runs typecheck, tests, lint, web export, server/database contract tests, and browser E2E. Android and iOS definitions remain in the universal Expo repository but have `if: github.event_name == 'workflow_dispatch'`. No native build, CI dispatch, or native runtime verification was run.

## Architecture decision

Durable character memory extends `public.canon_facts`; no parallel memory table was added. This reuses the existing source Scene/Turn provenance, run/branch isolation, RLS boundary, and replay ancestry contract. Character memories are distinguished by `character_id`, typed `memory_type`, bounded `salience`, and optional `supersedes_fact_id`.

The model provider emits `character_memory_candidates` in the same structured response as the Scene. All candidate character IDs are validated against the Story before the first canonical write. The Scene, generic canon, character memory, Turn result, and allowance-debit marker commit in one database transaction; generation or validation failure cannot persist a Scene or memory.

## Schema changes

Migration: `supabase/migrations/20260811062636_lw_w3_character_memory.sql`

- `story_configurations.player_name text`
- `story_configurations.player_description text`
- `characters.role text`
- `canon_facts.character_id uuid -> characters.id`
- `canon_facts.memory_type text`
- `canon_facts.salience smallint`
- `canon_facts.supersedes_fact_id uuid -> canon_facts.id`
- shape constraint: character memories must be branch-scoped, have a branch, use an allowed type, and have salience 1..5
- indexes for character lookup, supersession lookup, and run/character/key retrieval
- trigger guard allows canonical Setup edits before the first generated Scene and rejects updates/deletes afterward
- `lw_precheck_and_start_turn` persists the full authored setup
- `lw_commit_turn` accepts memory candidates and commits them atomically
- `lw_get_run_state` returns compact Story/starting-character header data

Live DEV migration history contains `20260811062636 lw_w3_character_memory` on project `sfarcofvqfeobtcizxyv` (`lorewish-dev`).

## Memory model and retrieval

Allowed types: `player_fact`, `character_fact`, `relationship_fact`, `shared_event`, `promise`, `discovery`.

Every memory retains Story Character ID, stable ASCII snake-case fact key, text, salience, source Turn/Scene, creation time, owning run/branch, and optional prior fact ID. Current state is derived rather than destructively updated.

Retrieval first resolves the active branch ancestry. An ancestor memory is inherited; a child-only memory does not leak into its parent or sibling. A superseded memory is hidden only when its superseding row is visible in the same active ancestry. Deterministic selection prefers a recently involved character, promises, relationship facts, higher salience, recency, then stable ID. Budgets are 3 recent Scenes, 12 character memories, and 8 generic canon facts.

## Advanced Setup and Quick Start

Advanced Setup persists:

- Story language, genre, premise, world/setting, tone, and narrative point of view
- player role/identity, optional name, and optional short description
- starting character name, identity/role, description, relationship, aliases
- four directional Vietnamese address-term slots

The UI uses progressive disclosure for Story, Player, Starting Character, and Vietnamese address terms. Multiline fields auto-grow and use standard controlled `TextInput` behavior suitable for IME composition. Draft state is tab-scoped in web `sessionStorage`; it survives section navigation, UI-language switches, and reload/sign-in routing. Native keeps the same model with in-memory fallback and no browser-only package dependency.

Quick Start remains the default, exposes Fantasy/Romance/Adventure starters, applies safe balanced/second-person defaults, and generates the same complete setup contract. Public users may explore both paths; starting paid inference still requires sign-in and alpha authorization.

## EN/VI and address terms

Both UI languages were exercised in browser QA. Story language is independent of UI language. Vietnamese setup exposes exact structured presets for `anh/em`, `chị/em`, `tôi/cậu`, and `ta/ngươi`; tests assert all four directional slots and provider prompt directionality. Address terms remain authored setup and are not emitted as mutable memory.

## Browser QA and screenshots

Automated E2E ran on Desktop Chrome and Pixel 7 emulation: Quick Start, Advanced Setup, draft reload, EN/VI UI switch, address presets, sign-in boundary, and horizontal overflow. Result: 4/4 passed.

Live DevTools QA on `https://lorewish.pages.dev/play/` verified production assets, public Quick/Advanced UI, multiline entry, section disclosure, full draft persistence after reload, EN/VI switching, address-term choices, and zero horizontal overflow. Final console: no warnings/errors/issues. Network: document and JS 200, favicon 304.

Screenshots:

- `screenshots/desktop-quick-en.png`
- `screenshots/mobile-advanced-vi.png`

## Supabase, grants, and advisors

- DEV ref: `sfarcofvqfeobtcizxyv`
- Edge Function: `submit-turn` version 9, `ACTIVE`, JWT verification enabled
- unauthenticated Edge request: HTTP 401
- rollback-only live probe: edit before first Scene allowed; edit after first Scene blocked; retained users/stories/runs/scenes all 0
- migration adds no direct table DML grant; memory writes remain RPC-controlled
- existing authenticated authoring grants on Stories/configuration/Characters remain constrained by RLS and the new setup-lock trigger
- advisor warnings are recorded in `supabase-advisors.txt`; no critical advisory was reported

## Tests and CI

Committed-state local gates:

- `npm run typecheck`: pass
- `npm test`: 10 files, 110 tests passed
- `npm run lint`: pass
- `npm run export:web`: pass, 7 static routes
- `npm run test:e2e`: 4 passed
- `git diff --check`: pass

GitHub Actions PR run `31467635828`: success. Push run `31467598845` attempt 2: success. Both `Web / JS checks` passed; Android and iOS were skipped in both. The push run was rerun after its first concurrency-cancelled attempt so PR #4 has a fully clean check rollup.

## Live web

- Stable URL: https://lorewish.pages.dev
- Exact production deployment: https://2696ef8b.lorewish.pages.dev
- Cloudflare deployment ID: `2696ef8b-043e-4080-90ad-d2a63a3ae78b`
- Attached source commit: `8fd64fe`

## Known limitations and deferred work

- No authenticated real-provider story was generated in this task; the provider call was optional and avoiding it spent no model budget. Provider contracts are covered by deterministic tests, while end-to-end narrative quality still needs an owner-controlled alpha account review.
- Setup is deliberately locked after the first generated Scene. Retcon/edit-after-start needs an explicit future branch/migration design.
- Retrieval is deterministic structured ranking, not semantic/vector search.
- Security advisor warns that authenticated roles can execute intentional `SECURITY DEFINER` RPCs; every relevant RPC performs caller/ownership checks and uses an empty search path. The deny-all alpha allowlist has RLS enabled with no public policy by design.
- Performance advisor reports existing unindexed foreign keys and unused new indexes in an empty DEV database. W3-added character and supersession foreign keys have covering indexes.
- `npm audit --omit=dev` reports 22 upstream Expo/React Native dependency advisories (8 moderate, 14 high, 0 critical); suggested automatic fixes are incompatible framework downgrades and were not applied in this bounded milestone.
- Character Chat, embeddings, auth redesign, payments, creator/discovery, Android, and iOS remain deferred. Do not begin W3-R2 from this handoff without owner authorization.

## Git evidence

Implementation diff: 41 files, 2,192 insertions, 304 deletions. The implementation worktree is clean; only pre-existing M1/M2 handoff artifacts plus this uncommitted W3 handoff directory are present. See `git-status.txt`, `git-log.txt`, and `git-diff.patch`.

Packaging is post-implementation evidence and does not move `IMPLEMENTATION_HEAD`.
