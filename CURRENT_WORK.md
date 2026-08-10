# Current Work

**Task**: LW-M1-R3 — Live Privilege Hardening + Repository/CI Closeout
**Status**: **M1 PASS**, with Android runtime evidence explicitly deferred (see below).

## Baseline (verified, not taken from the prior report)

- Baseline commit: **`f97dd28`** (`docs: LW-M1-R2 CURRENT_WORK.md and handoff package`) — confirmed
  by `git rev-parse HEAD`, matching what the R2 handoff claimed.
- Baseline branch: `feature/lw-m1-backend-native-foundation`; working tree clean at start.
- Local `main`: `b2a817e` (M0 baseline only) — confirmed.
- GitHub `PNHD/Lorewish`: private; **only** the feature branch existed remotely, and it was the
  repository's default branch. Both confirmed before being changed.
- Linked Supabase project: `lorewish-dev` / `sfarcofvqfeobtcizxyv` / `ap-southeast-1`, verified twice
  — once at the start and again immediately before applying the migration.
  `doodle-world-studio` (`etmqrpoefkcahyvaimiw`) was never touched.

## The R2 Grant Defect — Claim vs. Live Reality

This is recorded as audit history and deliberately not erased. The R2 migration comment that states
the wrong thing is also left in place, unedited.

- **R2 claim**: "`anon` receives no grant on any of these tables"; new public-schema tables are not
  auto-exposed; only explicit `authenticated` DML exists.
- **Live R2 reality** (`handoff/LW-M1-R3/grants-before.txt`): every one of the five authoring tables
  carried `relacl = {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,`
  `authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — `anon` and `authenticated`
  each held **all seven** table privileges, including **TRUNCATE, TRIGGER and REFERENCES**. The
  cause was `pg_default_acl`: the project's public-schema default granted `ALL` to the Data API
  roles at `create table` time, before the migration's own `grant` statements ran. The explicit
  grants were a subset of what had already been given, so they changed nothing.
- **R2 data-isolation result still stands**: RLS blocked every cross-user and anonymous **row**
  access that was tested, then and now. No data was exposed by this in any observed probe.
- **This is not a confirmed data breach.** It is an object-privilege posture that was weaker than
  reported, on a dev-only project, corrected before M2 adds more tables.
- **Why it mattered anyway**: grants and RLS are separate layers. `TRUNCATE` is a whole-table
  operation that no row policy governs. Correct RLS does not make an unnecessary object privilege
  harmless.

## R3 Fix — Corrective Migration

`supabase/migrations/20260810065727_m1_least_privilege_hardening.sql`, applied to `lorewish-dev`
(`supabase db push --linked`; remote history now lists both migrations). The already-applied
`20260810013158_m1_foundation_schema.sql` was **not** rewritten.

Verified live afterwards (`handoff/LW-M1-R3/grants-after.txt`, machine-checked expected-vs-actual:
**10/10 PASS, 0 FAIL**):

| Table | `anon` | `authenticated` |
|---|---|---|
| `profiles` | *(zero privileges)* | SELECT, INSERT, UPDATE |
| `stories` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `story_configurations` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `worlds` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `characters` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |

No client role holds TRUNCATE, TRIGGER or REFERENCES on any of them. `service_role` was left
untouched by design (redesigning it was out of scope; it is never used from application code).
All 19 RLS policies and all five `relrowsecurity` flags are unchanged.

## Future Default-Privilege Policy — Option A *and* Option B

**Option A was applied** and verified, using Supabase's own documented remedy for an existing
project (changelog 45329), scoped to the `postgres` role's default ACL:

```sql
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
```

`REVOKE ALL` rather than the four DML verbs the changelog names, because the live default handed out
`arwdDxtm`. The `postgres`/`public`/tables default is now
`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — both client roles removed.

This was **not** done with `supabase config push` (`[api] auto_expose_new_tables`): that command
pushes the entire local `config.toml`, which is CLI-scaffold content and would have set
`enable_confirmations = false` and rewritten `site_url` to `127.0.0.1:3000` on the live project.

**Automatic exposure is NOT fully disabled, and this document does not claim it is.** Three gaps
remain: a `supabase_admin`-owned default ACL for `public` that a `postgres` connection cannot alter;
the **function** default ACL, which still auto-grants `EXECUTE` to `anon`/`authenticated` on new
`public` functions; and any table created outside a `postgres`-role migration.

**Therefore Option B is also adopted, as the primary control:** *every Lorewish migration creating
an application table MUST revoke inherited/default client grants and then add exact explicit grants
in the same migration.* Recorded as a non-negotiable rule in
[docs/DEV_ENVIRONMENT.md](docs/DEV_ENVIRONMENT.md),
[docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) §4 and
[docs/AGENT_TOOLING.md](docs/AGENT_TOOLING.md) standing rule 6. The default-privilege change is
defence in depth, not the control.

## Security Regression — 30/30 PASS

`handoff/LW-M1-R3/rls-test-results.txt`. Real HTTPS calls to the live Data API; two ephemeral
accounts created and deleted via the Auth Admin API; cleanup verified by re-query (0 remaining
`@lorewish-test.dev` accounts).

- **A. Anonymous denial is now object-level, not row-level.** R2 accepted `200 []` as proof; this
  run does not. All five tables plus an anonymous INSERT and a bulk DELETE returned **HTTP 401 with
  SQLSTATE 42501, "permission denied for table ..."** — including PostgREST's own hint naming the
  grant that would be required, which is direct confirmation none exists.
- **B/G. Owner CRUD unbroken** by the revoke/re-grant: create, read, update, child insert
  (worlds/characters/story_configurations), child update, child delete all succeed.
- **C.** User B cannot read, update or delete User A's Story, StoryConfiguration or World.
- **D.** Ownership tampering fails both directions (A cannot reassign to B; B cannot forge a Story
  owned by A).
- **E.** B cannot attach a World, Character or StoryConfiguration to A's Story.
- **F.** `profiles` remains usable for exactly its allowed operations — and `DELETE` on `profiles`
  is now correctly refused at the object level, which is the one place the privilege layer rather
  than RLS is the control.
- **`set_updated_at` trigger verified still firing** after `EXECUTE` was revoked from the client
  roles (Postgres checks that privilege at `CREATE TRIGGER` time, not per firing): an authenticated
  UPDATE still bumps `updated_at`.
- **Advisors**: `supabase db advisors --linked` — **0 security findings, 0 performance findings**.

## Repository / CI

- `main` (`b2a817e`, M0 baseline) pushed to the private remote unchanged — **not** moved to the
  feature tip.
- GitHub default branch changed from `feature/lw-m1-backend-native-foundation` to **`main`**.
  Repository remains **private**.
- Neither `feature/lw-m1-web-foundation` nor `feature/lw-m1-backend-native-foundation` was deleted.
- New branch `feature/lw-m1-foundation-closeout`, created from the actual reviewed R2 tip `f97dd28`
  (not from a reported SHA), carries the R3 migration, docs and workflow change. A **draft** PR to
  `main` is open and deliberately **not merged** — the product owner / reviewer sees the R3 handoff
  first.
- **CI cost fix**: `.github/workflows/ci.yml` gains `paths-ignore` (`docs/**`, `handoff/**`,
  `*.md`) on both `push` and `pull_request`. Verified against real history: every one of the 16
  files in `f97dd28` — the docs-only R2 commit that burned ~37 minutes of native runner time —
  matches that list, so it would now be skipped entirely. `src/**`, `package.json`,
  `package-lock.json`, `app.json`, `eas.json`, `assets/**`, `supabase/**` and `.github/**` are
  deliberately absent and always trigger a full run. The workflow change itself is a `.github/**`
  change and therefore does trigger one final full run, which is the intended and accepted cost.

## Native Evidence Status

- **iOS: ACCEPTED.** R2's GitHub Actions Simulator evidence (compile → install → launch → process
  confirmed alive → screenshot of the actual Lorewish UI) is genuine runtime evidence and is
  accepted for the M1 foundation. EAS was **not** re-run; Simulator runtime evidence is stronger
  than compile-only cloud evidence for this goal. No claim of physical-iPhone validation is made.
- **Android: `ANDROID_RUNTIME_EVIDENCE_DEFERRED`.** R2 produced a release-build-type APK that is
  signed with the JS bundle embedded, but the Android runtime was never observed. No local SDK was
  installed for this task by instruction. **This does not block M1** — the owner's current
  validation strategy is web-first. **Required closeout point: Android runtime evidence must be
  obtained before any external native beta or Play Store release testing.** Not claimed as PASS.

## Implementation Head / Handoff Property

Per this task's evidence rule, `IMPLEMENTATION_HEAD` is defined as the last committed
source/schema/docs change required by the task — the single commit this task makes on
`feature/lw-m1-foundation-closeout`. All handoff evidence is generated **from that commit, after it
exists**, and `handoff/LW-M1-R3/` is deliberately **left untracked** so that packaging cannot move
the head the evidence describes. Its exact SHA is recorded in `handoff/LW-M1-R3/HANDOFF.md`,
`git-log.txt` and `git-status.txt` — this file does not guess at it, which is precisely the R2
mistake (`handoff/LW-M1-R2/git-log.txt` stopped at an older HEAD than the report named).

## M1 Verdict

**PASS.** Object privileges are now least-privilege and verified live; RLS is intact and
independently re-proven; the repository is normalized (remote `main`, default branch `main`, draft
closeout PR); CI no longer burns native runner time on documentation. Android runtime evidence
remains explicitly deferred, which does not prevent M1 PASS under the web-first strategy.

**No M2 work was started.** The public schema still contains exactly the five M1 authoring tables —
no `PlayerRun`, `StoryState`, scene, branch, `CanonFact`, memory, gateway, credit, ads, payments,
publishing or social schema or code exists.

## Recommended Next Task

**LW-M2-R1 — Real Interactive Story Engine Vertical Slice.** Not started here.

---

## HEAD Correction (recorded by LW-M1-R2, verified against actual `git` state)

This document's "Final HEAD" (below, `7a7cf7c`) and `handoff/LW-M1-R1/HANDOFF.md`'s commit table
(`952e8ec`, labelled "final HEAD") both undercounted the branch by one commit. Neither was rewritten
— per LW-M1-R2's instructions, history is not edited to make old reports match — this note documents
the discrepancy instead.

- **Reported as final HEAD** (inconsistently, across two LW-M1-R1 artifacts): `7a7cf7c` (this file's
  prose, below) and separately `952e8ec` (the handoff commit table).
- **Actual repository HEAD at the start of LW-M1-R2** (verified via `git rev-parse HEAD` and
  `git log --oneline --decorate --graph --all`, not assumed from either report): **`03c2fc3`** —
  `docs: add LW-M1-R1 handoff artifacts`, one commit past `952e8ec`.
- **Why the discrepancy exists**: `952e8ec` (`docs: record LW-M1-R1 completion in CURRENT_WORK.md`)
  updated this file with `7a7cf7c` as "Final HEAD" *before* `952e8ec` itself was committed — a
  same-task self-reference gap common to a "write the summary, then commit it" sequence. The
  `handoff/LW-M1-R1/HANDOFF.md` commit table was then written and committed as `03c2fc3`, correctly
  listing `952e8ec` as of that point, but `03c2fc3` itself is not listed anywhere as the branch's
  actual tip — the same gap one commit later, since the handoff-artifacts commit was never followed
  by a further doc update recording itself.
- **Resolution**: `03c2fc3` is treated as the real, reviewed end state of LW-M1-R1 for all LW-M1-R2
  purposes (starting point, diffs, and the new branch point below).

---

**Task**: LW-M1-R2 — Dev Supabase + Auth + Native Foundation
**Status**: **IMPLEMENTATION_PASS, M1_NATIVE_RUNTIME_EVIDENCE_PARTIAL**. iOS Simulator evidence is
complete (compiled, installed, launched, verified running, and — after fixing a real bug that made
the first attempt's screenshot show a React Native error screen instead of the app — a screenshot
confirming the actual Lorewish UI renders). Android evidence is build/structure evidence only
(APK compiles, is properly signed, and has the JS bundle embedded — verified by direct artifact
inspection) — it was never installed or launched on a device or emulator, since none was available
in this environment. Recorded honestly as `ANDROID_RUNTIME_NOT_YET_OBSERVED`, per this task's own
explicit instruction for exactly this situation, rather than overclaimed.

## Branch / HEAD

- Starting branch: `feature/lw-m1-web-foundation`, checked out from `main` (verified, not assumed).
- Starting HEAD (as reported by prior task artifacts, inconsistently): `7a7cf7c` / `952e8ec`.
- **Actual reviewed R1 HEAD** (verified via `git rev-parse HEAD`): **`03c2fc3`** — see the HEAD
  Correction note above.
- R1 repair commit (on `feature/lw-m1-web-foundation`): `3bb0fcf` — `fix: close LW-M1-R1 review
  findings` (R1-F1, R1-F2, R1-F3, and the HEAD-correction documentation itself).
- New branch: `feature/lw-m1-backend-native-foundation`, created from `3bb0fcf`.
- Commits on the new branch: `28b8541` (`feat: add Lorewish dev Supabase foundation`), `6716f64`
  (`feat: add auth and native build foundation`).
- `main` still points at `b2a817e` only. Not merged into. No commit history rewritten.

## R1 Review Findings — Repaired

- **R1-F1 (custom-action duplicate label)**: `src/screens/preview/index.tsx`'s `handleSend` no
  longer bakes `t("preview.youLabel")` into the stored player-action string — it stores only the
  raw trimmed text. `PlayerActionBanner` already renders `youLabel` and `action` as separate lines;
  the fix was a one-line data-model change, not a string hack. Verified interactively in English and
  Vietnamese, on both the dev server and the live `lorewish.pages.dev` production build.
- **R1-F2 (narrative-repair billing)**: `docs/NARRATIVE_QUALITY_CONTRACT.md` §D now states the rule
  explicitly — one successful user intent resolves to at most one `user_allowance_debit`, regardless
  of whether the one automatic repair attempt ran. `provider_cost`,
  `internal_generation_attempt_count`, and `user_allowance_debit` are named as three separate tracked
  concepts; a turn where both the initial and repair attempts fail (no Scene committed) is pinned to
  `user_allowance_debit = 0`. `docs/CONTINUOUS_PLAY_CONTRACT.md` §8's allowance table gets two new
  rows so the two documents don't drift apart on this point.
- **R1-F3 (placeholder branding)**: `docs/DECISIONS.md` D35 marks the Expo scaffold's default
  icon/splash/favicon assets as **PLACEHOLDER — MUST REPLACE BEFORE EXTERNAL BETA**, explicitly
  listing every affected asset path. No design work was done — that remains explicitly out of scope.

## Supabase — `lorewish-dev`

- Project ref `sfarcofvqfeobtcizxyv`, region `ap-southeast-1`, org `dbodjqmarksspvyknnlv` — verified
  by name/ref/region match against the task brief before linking. Never linked to
  `doodle-world-studio` (a different project, `etmqrpoefkcahyvaimiw`, in the same org) or to any
  other project.
- The Supabase CLI on this machine was initially authenticated to a *different* account with no
  access to `lorewish-dev` (`supabase link` failed with a privileges error) — the project owner ran
  `supabase login` under the correct account before any Supabase work proceeded.
- `supabase/` initialized and linked. One migration:
  `supabase/migrations/20260810013158_m1_foundation_schema.sql` — `profiles`, `stories`,
  `story_configurations`, `worlds`, `characters`. UUID primary keys, `created_at`/`updated_at`
  throughout, no Postgres enum types (check constraints validate shape/allowed-set instead — see the
  migration's own comments for the reasoning per field). Applied via `supabase db push` (no local
  Docker stack — none was running in this environment; the CLI's own `--linked` fallback was used for
  everything, including `db advisors`).
- RLS enabled on every table. `stories` owned via `owner_user_id = auth.uid()`;
  `story_configurations`/`worlds`/`characters` owned via their parent `Story` (no duplicated owner
  column). Every `USING` has a matching `WITH CHECK`. Explicit `GRANT`s to `authenticated` only —
  `anon` receives none, since Supabase's current default no longer auto-exposes new tables.
- A minimal `auth.users` trigger (`handle_new_user`, `SECURITY DEFINER`, empty `search_path`, fully
  schema-qualified, `EXECUTE` revoked from public roles) creates a `profiles` row on signup.
- `supabase gen types typescript --project-id sfarcofvqfeobtcizxyv` → `src/types/database.types.ts`,
  committed, not hand-maintained.
- `supabase db advisors --linked --type all`: **0 findings** (see `handoff/LW-M1-R2/supabase-advisors.txt`).
- 15/15 adversarial RLS probes passed — two ephemeral test accounts against the live REST API,
  covering cross-user read/update/delete, an `owner_user_id` tamper attempt, cross-story child-record
  attachment, and unauthenticated access. Full transcript: `handoff/LW-M1-R2/rls-test-results.txt`.
  All test users/data created for probing were deleted afterward; nothing persists in the dev
  database from this task.
- `docs/DEV_ENVIRONMENT.md` records the Auth Site URL / redirect-URL values as a **manual dashboard
  step** rather than `supabase config push` — pushing the full scaffolded `config.toml` risked
  silently changing unrelated live settings, including turning email confirmation off (the CLI's
  local-dev scaffold default), which would have violated this task's instruction to preserve the
  secure default. Email confirmation was not touched and was independently confirmed still on: a
  real sign-up attempt returned `429 over_email_send_rate_limit`, meaning a confirmation email send
  was genuinely attempted.

## Auth

- Email/password only (Supabase Auth). No OAuth providers, no anonymous sign-ins — neither is called
  or enabled anywhere in this task.
- `src/lib/supabase.ts` — lazily-constructed client (`getSupabaseClient()`), not built at module-eval
  time. Found and fixed a real bug this task introduced: an eager `createClient()` call at module
  scope crashed Expo Router's static-export SSR prerender pass (which doesn't inline
  `EXPO_PUBLIC_*` the way the real browser/native bundle does) for every route, not just `/account`,
  since `AuthProvider` is mounted in the root `_layout`. Deferring construction to first real use
  fixed it — verified by a subsequent clean `expo export -p web`.
- `src/auth/auth-context.tsx` — `AuthProvider`/`useAuth()`, mounted once in `src/app/_layout.tsx`.
  Maps raw Supabase Auth errors to a closed set of product-facing codes (`invalid_credentials`,
  `email_not_confirmed`, `user_already_exists`, `weak_password`, `invalid_email`, `unknown`) — no
  raw Supabase error text is ever shown to a user.
- `src/screens/account` + `src/app/account.tsx` — sign up / sign in / sign out, current session
  state, EN/VI throughout. States implemented: loading, signed-out (sign-in/sign-up form), invalid
  credentials, check-your-email (post-signup), signed-in, sign-out.
- **Deliberately deferred**: OAuth/social providers, anonymous/guest Supabase sessions (the `/preview`
  fixture stays local-only and unauthenticated — no `signInAnonymously()` call exists anywhere in
  this codebase, on page load or otherwise; real anonymous-guest persistence is explicitly M2 scope,
  per this task's brief), profile avatars, preferences dashboard, subscription settings.
- Verified interactively end-to-end, on both the dev server and the live production deployment: sign
  up validation-error path, a real (rate-limited) confirmation-email send, sign-in with a
  pre-confirmed test account, session persistence across a hard reload of `/account`, and sign-out.
  All ephemeral test accounts created for this were deleted afterward via the Auth Admin API (used
  only from local test tooling, never in application code, never committed).

## Live Web

- Redeployed to the same Cloudflare Pages project as R1 (`lorewish`) via
  `wrangler pages deploy dist --branch=main`. Live at **https://lorewish.pages.dev**
  (this deployment: `https://c5198a20.lorewish.pages.dev`).
- `/preview` remains fully playable without any authentication, before and after the Supabase/auth
  work. `/account` loads on a direct route hit (not just client-side navigation), in both languages,
  with zero console errors.
- The Supabase project ref and other technical/debug details are not surfaced anywhere in the normal
  UI.

## Native Foundation

- App identifiers were already correct from R1: `com.lorewish.app` (both iOS `bundleIdentifier` and
  Android `package`), scheme `lorewish`, display name `Lorewish`. No change needed.
- `eas.json` created (`development`, `preview`, `ios-simulator`, `production` profiles) but **EAS is
  not used for this task's native build evidence** — no `eas login`, no build quota consumed. This
  was an explicit owner decision made mid-task: GitHub Actions on standard GitHub-hosted runners
  replaces EAS as the primary remote native-build path for M1, modeled on the owner's existing
  `PNHD/focelle-ios` iOS CI workflow (principles adapted, not the Swift-specific implementation).
- `.github/workflows/ci.yml` — three jobs, standard runners only (`ubuntu-latest`, `macos-latest`),
  `concurrency`/`cancel-in-progress` set:
  - **web**: `npm ci`, typecheck, lint, `expo export -p web`.
  - **android**: `expo prebuild --platform android --no-install`, `gradlew assembleRelease`
    (release build type, debug-keystore-signed per Expo's own default with no `credentials.json`
    present — not a Play Store key), uploads the APK as a workflow artifact.
  - **ios-simulator**: `expo prebuild --platform ios --no-install`, `pod install`, unsigned
    `xcodebuild -configuration Release` for `iphonesimulator` (`CODE_SIGNING_ALLOWED=NO`), boots a
    runner-provided iPhone simulator, installs and launches the app, confirms the process is
    actually running via `simctl spawn launchctl list` (not just that `launch` returned), captures a
    screenshot, and zips the `.app` as `Lorewish-iOS-Simulator.app.zip` (Appetize-upload-shaped) —
    all uploaded as artifacts. Requires no Apple Developer membership, signing certificate, or
    provisioning profile.
- **A GitHub repository did not exist for this project before this task.** Per explicit owner
  instruction: created **private** under `PNHD/Lorewish`, after a full secret scan of everything
  about to be committed (clean — see `handoff/LW-M1-R2/test-results.txt`) and a `.gitignore` review
  (added `.wrangler/` to the ignore list; nothing sensitive was ever staged). Pushed
  `feature/lw-m1-backend-native-foundation`.
- **GitHub Actions run (final, successful)**:
  https://github.com/PNHD/Lorewish/actions/runs/31354813415 — all three jobs passed. It took five
  runs total to get here, across four real bugs found and fixed (not silently retried — see
  `handoff/LW-M1-R2/native-builds.txt` for the full, transparent account of each): a wrong
  Xcode-scheme heuristic, a one-level-too-shallow `find` for the built `.app`, an Android job hitting
  its timeout on a cold Gradle cache, disk-space exhaustion on the Android runner, and — most
  importantly — the first "successful" iOS run's own screenshot revealing that a Debug-configuration
  build shows React Native's "No script URL provided" error instead of the app (Debug+Simulator
  unconditionally skips embedding the JS bundle, expecting a Metro server no CI runner has).
  Switching both native jobs to their Release build type/configuration fixed this for real — verified
  by a screenshot of the actual Lorewish home screen, not asserted from the build succeeding alone.
- **Android**: `app-release.apk` (103.8MB) — inspected directly (not just "the job passed"):
  contains `assets/index.android.bundle` (the embedded JS, 2.9MB), a valid `AndroidManifest.xml`,
  and the build log shows `validateSigningRelease` and `packageRelease` both ran
  (`BUILD SUCCESSFUL in 35m 19s`). **Never installed on a device or emulator — none was available in
  this environment.** Recorded as `ANDROID_RUNTIME_NOT_YET_OBSERVED`, per this task's own explicit
  instruction for this exact situation.
- **iOS**: `Lorewish-iOS-Simulator.app.zip` (28.8MB) — a real Mach-O binary + `Info.plist`, installed
  and launched on a runner-provided iPhone simulator, confirmed running via `simctl spawn launchctl
  list`, and `handoff/LW-M1-R2/screenshots/ios-simulator-home-en.png` shows the actual app (name,
  tagline, subheading, preview CTA, Account link, language switcher) — genuine Simulator runtime
  evidence, not a compile-only claim, and not physical-device evidence (never claimed as such).

## Validation

See `handoff/LW-M1-R2/test-results.txt`, `supabase-migrations.txt`, `supabase-advisors.txt`,
`rls-test-results.txt`, `web-build.txt`, and `native-builds.txt` for full detail. Summary: `npm ci`
clean (22 pre-existing transitive advisories, unchanged from R1, non-blocking); `expo-doctor` 20/20;
`tsc --noEmit` clean; `expo lint` clean; `expo export -p web` succeeded (5 static routes including
`/account`); secret scan clean (verified twice — before and immediately before the GitHub push);
`git diff --check` clean except pre-existing, non-source artifacts already present before this task.

## Known Issues / Remaining M1 Blockers

- **Android runtime is unobserved** (`ANDROID_RUNTIME_NOT_YET_OBSERVED`): the release APK builds,
  is signed, and has the JS bundle embedded (verified by direct artifact inspection), but was never
  installed or launched on a device or emulator — none was available in this environment. Per this
  task's own instruction, M1 may remain open on this specific point for owner-assisted device
  validation rather than being blocked entirely on it.
- App icon/splash/favicon assets remain the unmodified Expo scaffold defaults (D35) — must be
  replaced before any external beta.
- No CI job runs the Supabase RLS probe suite automatically yet (this task's probes were run
  manually from local tooling) — worth automating in a later milestone if the schema starts changing
  more frequently.
- `handoff/LW-M1-R1/git-diff.patch` (a committed historical artifact, not source) still contains the
  pre-existing trailing-whitespace and space-in-filename items `git diff --check` flags — cosmetic,
  not a defect in this task's actual changes.
- The GitHub Actions native build jobs currently build unconditionally on every push to `main` or
  any `feature/**` branch — worth narrowing (e.g., path filters, or only on PRs into `main`) once
  the repository sees more day-to-day churn, to avoid burning private-repo Actions minutes on pushes
  that don't touch native-relevant code.

## Recommended Next Task

**LW-M1-R3** — owner-assisted Android device/emulator validation to close
`ANDROID_RUNTIME_NOT_YET_OBSERVED` (the one remaining M1 native-evidence gap), or **M2** directly if
the owner judges the release-APK build/structure evidence sufficient on its own. Do not begin M2
scope (AI gateway, LLM calls, PlayerRun, credit system, etc.) in this task; none of it was
implemented here, per explicit instruction.

---

**Task**: LW-M1-R1 — Web-First Bilingual Foundation + Preview Deploy
**Status**: **COMPLETE**. Web-first bilingual (EN/VI) Expo foundation built, validated, committed,
and deployed to a live Cloudflare Pages preview URL. M1 is **not** fully complete — this is R1 of
M1; Supabase, Auth, and native Android/iOS validation are explicitly deferred to LW-M1-R2 (§ below).

## Branch / HEAD

- Branch: `feature/lw-m1-web-foundation`, checked out from `main`.
- Baseline HEAD (start of this task): `b2a817e` — `docs: establish Lorewish product baseline`
  (M0 document set, first commit in the repository's history; there was no prior commit).
- Final HEAD: `7a7cf7c` — `feat: LW-M1-R1 web-first bilingual foundation + local preview`.
- `main` still points at `b2a817e` only. `feature/lw-m1-web-foundation` has not been merged into
  `main`, per instruction. Reviewable as `main..feature/lw-m1-web-foundation`.
- No remote configured; nothing pushed.

## Owner Decisions Recorded

Added to `docs/DECISIONS.md` as **D32–D34**, with superseding edits (not silent rewrites) to
`PRODUCT_VISION.md` §10, `MVP_SPEC.md` §2, `TECHNICAL_ARCHITECTURE.md` §11, `ROADMAP.md` M1/M7, and
`DOMAIN_MODEL.md` §8:

- **D32** — Web is the first shareable test channel (architecture stays Android+iOS+Web; Android/iOS
  validation continues inside M1 on schedule).
- **D33** — English and Vietnamese ship from the first implementation milestone (supersedes the M0
  "English-only at launch" language).
- **D34** — Story generation is native-language-first, not translate-first (no engineering action in
  this task; anchors the new `docs/NARRATIVE_QUALITY_CONTRACT.md` for M2+).

M0 was **not** reopened — these are recorded as post-M0 owner decisions layered on top of a PASSed
M0, exactly as LW-M0-R2/R3 recorded their own changes.

## What This Task Did

1. Read all fourteen M0 baseline documents plus the new post-M0 owner brief without trusting prior
   summaries. Verified the actual repository state (`git status`, filesystem, `skills-lock.json`,
   agent skill directories) rather than assuming the M0-R3 "no commits" claim was still true — it
   was.
2. Recorded D32–D34 and updated stale "English-only" text across five docs (§ above).
3. Created `docs/NARRATIVE_QUALITY_CONTRACT.md` — direct-language generation, language profiles,
   the Vietnamese four-slot address model, a deterministic quality gate with a one-repair-attempt
   cap, the naturalness rule (no literal EN↔VI equivalence), and a Narrative Golden Set
   specification. No AI provider called or selected.
4. Wrote `.gitignore` (node_modules, Expo/EAS artifacts, `.env*`, credentials, OS caches, handoff
   zips, and the installed-skill directories per `docs/AGENT_TOOLING.md`'s documented option), ran a
   secret scan (clean), and created the **M0 baseline commit** (`b2a817e`) on `main` — docs,
   `CURRENT_WORK.md`, prior M0-R2/R3 handoff records, `skills-lock.json`, `.gitignore`.
5. Branched to `feature/lw-m1-web-foundation` and scaffolded an Expo Router (SDK 57) + TypeScript
   app (Android/iOS/Web from one codebase, per the official `create-expo-app` default template,
   restructured into `src/app` + `src/screens` + `src/components` per current Expo project-structure
   guidance).
6. Built the bilingual i18n foundation (§ below), a minimal design-token foundation, the shared
   `Composer` component, and the local-fixture `/preview` route (§ below).
7. Validated: `tsc --noEmit` clean, `expo lint` clean (after fixing a real prop-collision bug and
   two React-Compiler-flagged effect patterns — see Known Issues Found And Fixed), `expo-doctor`
   20/20, production web export via `expo export -p web`, and interactive browser validation of the
   exported build (both languages, choice/consequence/replay flow, long Vietnamese paste, mobile
   viewport, direct-URL and refresh navigation) — see Tests below.
8. Committed the implementation (`7a7cf7c`) on the feature branch.
9. Deployed the exported `dist/` to Cloudflare Pages, project `lorewish` (the preferred name was
   available — no fallback needed). Live at **https://lorewish.pages.dev**.
10. This document and the `handoff/LW-M1-R1/` package.

No sub-agents were used (forbidden for this task). No Supabase project, AI provider, or account/auth
system was touched.

## Expo Foundation

- Expo SDK 57, Expo Router (typed routes, React Compiler enabled), TypeScript, React 19.2 /
  React Native 0.86.
- `src/app/` — routes only (`_layout.tsx`, `index.tsx`, `preview.tsx`), per current Expo
  project-structure guidance loaded via the `expo-project-structure` and `expo-router` skills.
- `src/screens/`, `src/components/` (including `src/components/reading/` for the Scene Readability
  Contract channels), `src/theme/`, `src/i18n/`, `src/content/preview/`, `src/hooks/`.
- Targets: Android, iOS, Web from the one codebase (`app.json` — `com.lorewish.app`). **Web is the
  only platform with runtime evidence in this task**, per D32. Android/iOS have **no build or
  runtime evidence yet** — that is explicitly LW-M1-R2 scope, not silently claimed here.

## English / Vietnamese Implementation

- `expo-localization` (device locale detection) + `i18n-js` (catalogue lookup) — the pairing
  documented in Expo's own localization guide.
- `src/i18n/locales/en.json`, `vi.json` — locale-independent dotted keys; the Vietnamese catalogue
  is natively written, not machine-translated from the English one.
- Device locale is the first default (`expo-localization` → normalized to `en`/`vi`, else fallback
  `en`); an explicit, always-visible manual switch (`LanguageSwitcher`) overrides it and persists via
  `@react-native-async-storage/async-storage`.
- `document.documentElement.lang` is set on web on every locale change (verified in-browser: `vi`
  after switching).
- UTF-8 safe end to end; Vietnamese diacritics verified rendering and round-tripping correctly
  through the composer in-browser (see Tests).
- No user-facing product copy is hardcoded in a screen; all UI chrome routes through `useTranslation`.
  Story/scene content (`src/content/preview/{en,vi}.ts`) is intentionally **not** in the UI catalogue
  — it is per-language content data, the same distinction `docs/DOMAIN_MODEL.md` §8 draws for
  `content_language` versus UI locale.

## Narrative Quality Contract

`docs/NARRATIVE_QUALITY_CONTRACT.md` — a design contract for M2+, not implemented code. No AI
provider called. Covers direct-language generation (D34), the language-profile concept model, the
Vietnamese four-slot address model (extends `CharacterRelationship`, does not replace pronoun
modeling for English), a deterministic quality gate with a one-automatic-repair cap resolving to
`GENERATION_FAILED` on a second failure (never silently committing poor prose), the
non-literal-equivalence naturalness rule, and a six-scenario Narrative Golden Set specification
(EN/VI × Fantasy/Romance/Adventure).

## Web Preview

**What is actually interactive** (verified in a running browser against the production export, not
claimed from source reading alone):

- `/` — Home screen, language switcher, link to `/preview`.
- `/preview` — a real, client-side state machine over a small deterministic scene graph
  (`src/content/preview/{en,vi}.ts`): a `start` node with two predefined choices *and* an always-
  available composer (custom actions go through a defined `custom` node — this is real, not
  decorative); three `checkpoint` nodes (market / guard / custom-action outcome) each showing a
  PLAYER ACTION banner, narrative, optional dialogue, a collapsible SYSTEM/state-change panel, and a
  single primary **Continue**; one `ending` node offering **Replay from a checkpoint** (lands back at
  the last checkpoint reached, ready to act, zero generation) and **Start again**. Every state has at
  least one enabled control; no dead end exists; a full-catalogue string search for "to be continued"
  (and a Vietnamese equivalent) found nothing, in both source and the exported `dist/`.
- The Composer is the one shared implementation (native file + a web variant adding the optional
  Ctrl/Cmd+Enter accelerator), not a preview-only stand-in — this is the component future M2/M3
  surfaces (custom actions, character chat, Advanced Setup) will reuse unmodified.

**What remains fixture-only** (by design, per the task's explicit scope):

- No AI generation of any kind — the "AI" in the scene is entirely pre-authored fixture prose.
- No real branch persistence, no Supabase, no credit/allowance system, no account/auth, no image
  generation. Switching language resets the fixture to its start node (no cross-language story state
  to reconcile locally).
- The `Continuous Play Contract` states demonstrated are `CONTINUE_READY` (implicitly, the `start`
  node), `EXPLICIT_CHECKPOINT`, and `TERMINAL_ENDING`. `GENERATION_FAILED` and
  `ALLOWANCE_EXHAUSTED` are **not** demonstrated — there is no generation to fail and no allowance to
  exhaust in a fixture with no backend. That is intentional scope, not an oversight; both remain M2
  responsibilities per `docs/CONTINUOUS_PLAY_CONTRACT.md`.

## Cloudflare

- Project name `lorewish` was **available** — no fallback (`lorewish-app`) needed.
- **Live URL: https://lorewish.pages.dev** (also reachable at the per-deployment URL
  `https://c1d0c3c4.lorewish.pages.dev`).
- No domain purchased. No paid Cloudflare plan. No Workers/Functions configured — this is a plain
  static-asset deployment of the `expo export -p web` output (`web.output: "static"` in `app.json`,
  Expo's default), which is why direct navigation to `/preview` and a hard refresh both work without
  any SPA-fallback routing rule: each route is its own static HTML file (`index.html`,
  `preview.html`).
- Deployment used the Cloudflare MCP-adjacent `wrangler` CLI, already authenticated on this machine
  under the project owner's own Cloudflare account (verified via `wrangler whoami` before acting —
  not something this task configured). The project's production-branch deployment was created with
  `wrangler pages deploy dist --branch=main` to land on the clean root URL; this is a Cloudflare-side
  branch label only and did **not** touch the git repository (no merge into `main`, nothing pushed).
- `BLOCKED_EXTERNAL_AUTH` did **not** occur — auth was already present and valid.

## Known Issues Found And Fixed During This Task

Recorded because they are non-obvious and worth knowing about if this pattern recurs:

1. **`ThemedText`'s `role` prop silently collapsed to a single literal.** `RNTextProps` already
   declares an ARIA `role` field; intersecting it with a same-named custom prop of a different
   literal union reduces to only the literals common to both sets — in practice, only `"heading"`
   survived, so every other value failed to typecheck. Fixed by renaming the design-system prop to
   `variant` across `ThemedText` and all thirteen call sites. Worth knowing for any future component
   that wraps a React Native primitive and wants a same-named prop.
2. **Two `useEffect` + `setState` patterns flagged by the React Compiler ESLint rule** in
   `src/screens/preview/index.tsx` (resetting fixture state on locale change; tracking the last
   checkpoint reached) were refactored to React's documented "adjust state during render" pattern
   instead of an effect — functionally identical, one fewer render pass, and it satisfies
   `react-hooks/set-state-in-effect` without a suppression comment.
3. A ref-mutation-during-render in `composer.web.tsx`'s accelerator handler was moved into a proper
   effect.
4. `src/hooks/use-color-scheme.web.ts` (copied verbatim from Expo's own official template) also
   trips the same effect rule for its hydration-safety pattern; left as Expo's own upstream code
   with a scoped, justified `eslint-disable-next-line` rather than restructuring template-owned code.
5. `package.json` initially pinned `expo-localization` to its own package-version scheme (`~17.x`)
   instead of the SDK-57-aligned range; `expo-doctor` caught it and `npx expo install
   expo-localization` corrected it to `~57.0.1`.

## Tests / Validation

| Check | Result |
|---|---|
| `npm install` | Clean. 22 npm-audit advisories, all in transitive Expo/RN build tooling (`metro`, `xcode`, `@expo/config-plugins` internals) — not application runtime code, not fixable without a major SDK downgrade `audit fix --force` would force. Non-blocking. |
| `npx expo-doctor` | **20/20 checks passed.** |
| `npx tsc --noEmit` | **Clean**, zero errors. |
| `npx expo lint` | **Clean**, zero errors/warnings (after the fixes above). |
| `npx expo export -p web` | **Succeeded.** Static routes: `/`, `/preview`, `/_sitemap`, `/+not-found`. |
| Secret / credential scan | Clean, run twice (before the M0 commit and again over the full new `src/` tree + `app.json`/`package.json`) — no API keys, tokens, or credential patterns found. |
| EN UI in browser | Verified — Home and `/preview` render correctly, no console errors. |
| VI UI in browser | Verified — switch is instant, diacritics render correctly, `document.documentElement.lang` becomes `"vi"`. |
| Locale fallback | Verified in code path (device-locale → normalize → `en` fallback); default browser locale in this environment is `en`, so device-default behavior was exercised directly. |
| Switch persistence | Verified via `AsyncStorage`/web-`localStorage` — a fresh navigation after switching to `vi` reloaded in `vi`. |
| Composer: Vietnamese diacritic input | Verified — typed Vietnamese text round-trips exactly through the `<textarea>`. |
| Composer: long paste (~4,980 chars) | Verified — `textarea.scrollHeight` (1568px) far exceeds `clientHeight` (198px, the 7-line clamp), and the Send button's bounding rect stayed fully inside the viewport. No horizontal scroll (`document.body.scrollWidth === window.innerWidth`) at both desktop (1280px) and mobile (375px) widths. |
| Deterministic choice path | Verified — `start` → choice → `checkpoint` (state-change panel, dialogue, Continue) → `ending`, in English. |
| Alternate/custom-action path | Verified — `start` → composer custom action (long Vietnamese text) → `custom` checkpoint with the player's own text echoed in the PLAYER ACTION channel → `Continue` → `ending`, in Vietnamese. |
| Replay-from-here | Verified — from `TERMINAL_ENDING`, "Replay from a checkpoint" lands back at the `market` checkpoint, `Continue` re-enabled, zero navigation to any intermediate/dead-end screen. |
| No dead end / no "to be continued" | Verified — every reachable node was visited in this session and rendered at least one enabled control; string search of `src/` and exported `dist/` for "to be continued" and a Vietnamese equivalent found nothing. |
| Routing: direct `/preview`, refresh `/preview` | Verified — `wrangler`'s local server and a fresh `navigate()` both resolved `/preview` correctly (static per-route HTML), including after a full page reload at mobile viewport. |
| Responsive: mobile (375×812) / desktop (1280×720) | Verified — no horizontal scroll at either width; layout intact. |
| Console errors | **None observed** at any point in this session (Home, Preview, both languages, both viewports). |

**Screenshots**: the in-session Browser pane could not composite frames for pixel screenshots in
this environment (`the Browser pane is not displayed, so the page is not compositing frames`).
Validation above was performed with real DOM reads (`get_page_text`, `read_page`,
`read_console_messages`, direct `document`/`textarea` inspection via `javascript_tool`) against the
actual running production build — not source-reading alone — but no image files exist to include in
the handoff. This is stated plainly rather than fabricated; see `handoff/LW-M1-R1/HANDOFF.md`.

## Files Changed

See `handoff/LW-M1-R1/files-changed.txt` for the full list. Summary: 49 files, +13,531/-1 across the
feature-branch commit (application source, config, and assets); 6 files touched by doc updates plus
1 new doc on `main`'s baseline commit.

## Known Issues (Product/Scope, Not Bugs)

- Android and iOS have zero build or runtime evidence from this task — LW-M1-R2 scope (D24 still
  governs: EAS cloud build evidence is the expected M1 iOS evidence class, never claimed here).
- No backend: no Supabase project, no Auth, no persistence beyond local UI preference — explicitly
  deferred to LW-M1-R2 per the task brief and D32's stated reasoning (ship a bilingual web foundation
  without mixing frontend scaffold and backend/native validation into one review unit).
- `GENERATION_FAILED` and `ALLOWANCE_EXHAUSTED` play states are unexercised (no generation, no
  allowance system exists yet at this milestone) — M2 responsibility.
- No automated test suite exists yet (no Jest/RTL configured) — not requested by this task's
  validation list, which specified doctor/typecheck/lint/export/secret-scan/localization/preview
  checks only; flagging so it isn't silently assumed to exist.

## M1-R2 Prerequisites (Exact)

1. **Owner creates the dev Supabase project** — credentials held outside the repository, production
   non-existent or provably unreachable from agent tooling (per `docs/AGENT_TOOLING.md`).
2. **Owner sets up the Expo/EAS account** and iOS build configuration (D24) — costed builds remain
   owner-initiated, never agent-initiated.
3. Initial schema for User, Story, StoryConfiguration, Character, World (Authoring Data only, per
   `docs/ROADMAP.md` M1 scope) — no PlayerRun/StoryState/character-chat schema yet.
4. Supabase Auth wiring (email/password + at least one OAuth provider; guest/anonymous sessions).
5. Android runtime evidence (device or emulator) and iOS EAS cloud build evidence — both still owed
   for M1's own evidence bar, per the per-platform table in `docs/TECHNICAL_ARCHITECTURE.md` §8 and
   `docs/ROADMAP.md` M1.
6. CI that builds all three targets (stated M1 scope, not yet done).
7. Do **not** re-litigate D32–D34 or the web-first sequencing — those are settled inputs to R2, not
   open questions for it.

## Recommended Next Task

**LW-M1-R2 — Dev Supabase + Auth + Android/iOS Foundation.** Do not begin it in this task/session.
