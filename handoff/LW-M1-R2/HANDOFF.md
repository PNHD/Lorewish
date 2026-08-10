# LW-M1-R2 Handoff — Dev Supabase + Auth + Native Foundation

## A. Baseline Truth

- Path: `E:\AIProjects\Lorewish`.
- Starting branch: `feature/lw-m1-web-foundation` (verified via `git branch --show-current`, not
  assumed).
- Prior task artifacts reported the branch's final HEAD inconsistently as `7a7cf7c`
  (`CURRENT_WORK.md` prose) and `952e8ec` (`handoff/LW-M1-R1/HANDOFF.md`'s commit table). Neither
  matched the actual repository tip. **Actual HEAD, verified via `git rev-parse HEAD` and
  `git log --oneline --decorate --graph --all`: `03c2fc3`** — one commit past both reported values
  (the handoff-artifacts commit itself, which was never followed by a doc update recording its own
  hash). No history was rewritten; `CURRENT_WORK.md` now documents the discrepancy and why it
  occurred rather than silently correcting it.

## B. R1 Repairs

Committed as `3bb0fcf` (`fix: close LW-M1-R1 review findings`) on `feature/lw-m1-web-foundation`,
before branching:

- **R1-F1**: `src/screens/preview/index.tsx`'s custom-action handler stored `"You: ..."` /
  `"Ban: ..."` while `PlayerActionBanner` separately rendered the same label — a visible
  duplication. Fixed at the data-model level (store raw text only); verified in EN and VI, on both
  the dev server and the live production build.
- **R1-F2**: `docs/NARRATIVE_QUALITY_CONTRACT.md`'s repair-loop section implied a repair generation
  could double-bill the player. Rewritten to state the rule explicitly (one user intent → at most
  one `user_allowance_debit`) and to separate `provider_cost` /
  `internal_generation_attempt_count` / `user_allowance_debit` as distinct tracked concepts.
  `docs/CONTINUOUS_PLAY_CONTRACT.md`'s allowance table updated to match.
  No AI implementation — this was a contract/doc correction only, as scoped.
- **R1-F3**: `docs/DECISIONS.md` D35 marks the Expo scaffold's default icon/splash/favicon assets as
  `PLACEHOLDER — MUST REPLACE BEFORE EXTERNAL BETA`, naming every affected file.

## C. Supabase Dev Project

- **Project**: `lorewish-dev`, ref `sfarcofvqfeobtcizxyv`, region `ap-southeast-1`, org
  `dbodjqmarksspvyknnlv` — matched exactly against the task brief before linking.
  **Never** connected to `doodle-world-studio` (different project, `etmqrpoefkcahyvaimiw`, same org).
- **Migrations**: one file, `supabase/migrations/20260810013158_m1_foundation_schema.sql` —
  `profiles`, `stories`, `story_configurations`, `worlds`, `characters`. Applied via
  `supabase db push` (no local Docker stack was available in this environment).
- **Tables**: authoring data only, per M1 scope. No `player_runs`, `story_states`, materialized
  scenes, `branch_history`, `canon_facts`, `generation_proposals`, AI audit logs, credit ledger,
  payments, social graph, or analytics tables — none of that was implemented.
- **RLS**: enabled on every table, forced to `authenticated`-only via explicit `GRANT`s (Supabase's
  current default does not auto-expose new tables). `stories` owned via `owner_user_id = auth.uid()`;
  child tables owned via their parent `Story`. Every `USING` paired with a matching `WITH CHECK`.
  `supabase db advisors --linked --type all`: **0 findings**.

## D. Auth

**Implemented**: email/password sign up, sign in, sign out, current-session state, EN/VI throughout,
at `/account`. A minimal `auth.users` trigger creates a `profiles` row on signup. Verified
end-to-end (sign-up validation path, a real rate-limited confirmation-email send, sign-in with a
pre-confirmed account, session persistence across reload, sign-out) on both the dev server and the
live production deployment.

**Deliberately deferred**: OAuth/social providers (Google/Apple/Facebook/Discord), anonymous/guest
Supabase sessions. `/preview` remains a local, unauthenticated fixture by design —
`signInAnonymously()` is not called anywhere in this codebase. Real anonymous-guest persistence is
explicitly M2 scope per this task's own brief (usage limiting/abuse controls don't exist yet to make
it meaningful).

## E. Live Web

- **URL**: https://lorewish.pages.dev (redeployed to the same Cloudflare Pages project as R1).
- **Account state**: `/account` loads on a direct route hit, in both languages, with no console
  errors; full sign-in/sign-out flow verified live.
- **Preview state**: `/preview` remains fully playable with zero authentication, before and after
  all Supabase/auth work.

## F. Android

GitHub Actions (`.github/workflows/ci.yml`, `android` job, `ubuntu-latest`) instead of EAS, per
explicit owner decision made mid-task. Final run: `gradlew assembleRelease` (release build type,
signed with Expo's auto-generated debug keystore — no `credentials.json` in this project, not a
Play Store key) — chosen over `assembleDebug` specifically because the debug build type skips
embedding the JS bundle. `app-release.apk` (103.8MB) inspected directly: contains
`assets/index.android.bundle`, a valid manifest, and the build log shows
`validateSigningRelease`/`packageRelease` both ran (`BUILD SUCCESSFUL in 35m 19s`). **Never
installed on a device or emulator** — none was available in this environment. Recorded as
`ANDROID_RUNTIME_NOT_YET_OBSERVED`, exactly per this task's own instruction for this situation. See
`native-builds.txt` for the full run history (five runs total, four distinct real bugs found and
fixed along the way — nothing silently retried).

## G. iOS

Same workflow, `ios-simulator` job on `macos-latest`: Expo prebuild + CocoaPods, unsigned
`xcodebuild -configuration Release` for `iphonesimulator`, boot/install/launch on a runner-provided
simulator, a liveness check via `simctl spawn launchctl list` (not just that `launch` returned), a
screenshot, and the `.app` zipped as `Lorewish-iOS-Simulator.app.zip` for Appetize. No Apple
Developer membership, signing certificate, or provisioning profile. **Release, not Debug**: an
earlier successful-looking run's own screenshot revealed React Native's "No script URL provided"
error instead of the app — Debug+Simulator builds unconditionally skip embedding the JS bundle.
`screenshots/ios-simulator-home-en.png` in this handoff shows the actual Lorewish home screen after
the fix — genuine Simulator runtime evidence, not a compile-only or false-positive claim. Final run:
https://github.com/PNHD/Lorewish/actions/runs/31354813415

## H. Security

- Adversarial RLS probes: 15/15 passed (`rls-test-results.txt`) — cross-user read/write/delete all
  blocked, owner-tamper blocked, cross-story child-record attach blocked, unauthenticated access
  blocked, all control (own-data) operations succeeded.
- `supabase db advisors`: 0 findings (`supabase-advisors.txt`).
- Secret scan: clean across every tracked file, run twice (before and immediately before the GitHub
  push) — no service-role/secret keys, JWT-shaped strings, or credential patterns in anything
  committed. `.env.local` (real project URL + publishable key) is git-ignored, never staged.

## I. Validation

`npm ci` clean (22 pre-existing transitive advisories, unchanged from R1); `expo-doctor` 20/20;
`tsc --noEmit` clean; `expo lint` clean; `expo export -p web` succeeded (5 static routes including
`/account`, after fixing a real SSR-prerender crash caused by eager Supabase client construction —
see `test-results.txt`); `git diff --check` clean except pre-existing non-source artifacts already
present before this task.

## J. Git

- Actual R1 HEAD: `03c2fc3` (see § A).
- Branch: `feature/lw-m1-backend-native-foundation`, created from `3bb0fcf`.
- Final HEAD: see the final response / `CURRENT_WORK.md` (filled in after the handoff-artifacts
  commit itself).
- A GitHub repository did not exist before this task. Created **private** under `PNHD/Lorewish` per
  explicit owner instruction, after a full secret scan and a `.gitignore` review (added `.wrangler/`).
  Pushed `feature/lw-m1-backend-native-foundation`.

## K. Handoff Zip

See the final response for path, byte size, and SHA-256 (computed after this file was written).

## L. Recommended Next Task

**LW-M1-R3** — owner-assisted Android device/emulator validation to close the one remaining M1
native-evidence gap (`ANDROID_RUNTIME_NOT_YET_OBSERVED`), or **M2** directly if the owner judges the
release-APK build/structure evidence sufficient on its own. M2 scope (AI gateway, generation,
PlayerRun, credits, etc.) was not started here.
