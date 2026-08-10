# LW-M1-R1 Handoff — Web-First Bilingual Foundation + Preview Deploy

## A. Baseline

- Path: `E:\AIProjects\Lorewish`.
- Repository had **zero commits** at the start of this task (confirmed via `git rev-parse HEAD`
  failing, matching `CURRENT_WORK.md`'s LW-M0-R3 claim — verified rather than trusted).
- Branch: `main`, no remote configured.
- Filesystem: `docs/` (14 M0 documents, PASS), `CURRENT_WORK.md`, `handoff/LW-M0-R2/`,
  `handoff/LW-M0-R3/`, `agent/skills/`, `.agents/skills/`, `.claude/skills/` (the latter are NTFS
  junctions into `.agents/skills/`), `skills-lock.json`. No `package.json` — a genuinely clean slate
  for the Expo scaffold.
- Node v24.15.0, npm 11.12.1, `expo` CLI resolves to 57.0.13 via `npx`.

## B. Owner Decisions Recorded

**D32** (web is the first shareable test channel), **D33** (English + Vietnamese ship from
foundation), **D34** (native-language-first generation, not translate-first) — all in
`docs/DECISIONS.md`, with superseding (not silently rewritten) edits to `PRODUCT_VISION.md`,
`MVP_SPEC.md`, `TECHNICAL_ARCHITECTURE.md`, `ROADMAP.md`, `DOMAIN_MODEL.md`. M0 was not reopened.

## C. Repository / Commits

| Commit | Branch | Message |
|---|---|---|
| `b2a817e` | `main` | `docs: establish Lorewish product baseline` |
| `7a7cf7c` | `feature/lw-m1-web-foundation` | `feat: LW-M1-R1 web-first bilingual foundation + local preview` |
| `952e8ec` | `feature/lw-m1-web-foundation` (final HEAD) | `docs: record LW-M1-R1 completion in CURRENT_WORK.md` |

`main` was not merged into, and nothing was pushed (no remote exists). `git diff --check
main..feature/lw-m1-web-foundation` is clean.

## D. Expo Foundation

Expo Router (SDK 57) + TypeScript, `src/app` routes-only structure per current Expo
project-structure/router guidance (loaded via the `expo-project-structure` and `expo-router`
skills, not reconstructed from training-data memory). Targets Android/iOS/Web from one codebase.
**Only Web has runtime evidence in this task** — see G below for what that means for D24.

## E. English / Vietnamese Implementation

`expo-localization` + `i18n-js`, device-locale default, AsyncStorage-persisted manual switch,
natively-written (not translated) `en`/`vi` catalogues, `document.documentElement.lang` set on web.
Verified interactively in a running browser, not asserted from source alone.

## F. Narrative Quality Contract

`docs/NARRATIVE_QUALITY_CONTRACT.md` created — design contract for M2+, no AI provider called or
selected. See `CURRENT_WORK.md` for the section-by-section summary.

## G. Web Preview

**Interactive**: `/` and `/preview`, a real client-side state machine (not a hardcoded string of
screens) over a small scene graph, demonstrating the Scene Readability Contract's five channels and
three of the five Continuous Play Contract states (`CONTINUE_READY`, `EXPLICIT_CHECKPOINT`,
`TERMINAL_ENDING`) with a working replay-from-here loop, in both languages, with the same shared
`Composer` component future M2/M3 surfaces will reuse.

**Fixture-only**: no AI, no Supabase, no persistence beyond local UI preference, no account/auth, no
image generation. `GENERATION_FAILED` and `ALLOWANCE_EXHAUSTED` are not demonstrated — there is
nothing to fail and no allowance system yet.

## H. Cloudflare

**Live URL: https://lorewish.pages.dev** — the preferred project name was available, no
`BLOCKED_EXTERNAL_AUTH`. Deployment used a pre-existing `wrangler` OAuth session on this machine
(verified with `wrangler whoami` before acting; not something this task set up), under the project
owner's own account. No domain purchased, no paid plan, no Workers/Functions — a plain static-asset
Pages deployment of `expo export -p web`'s output. Full record: `web-build.txt`.

## I. Validation

See `test-results.txt` for the full, real output of `expo-doctor` (20/20), `tsc --noEmit` (clean),
`expo lint` (clean), the secret scan (clean), the "to be continued" string search (nothing found),
and the interactive browser validation log (both languages, choice + custom-action + replay paths,
long-paste composer behavior, mobile + desktop viewports, direct-URL/refresh navigation, zero
console errors). `npm audit` reports 22 advisories, all in transitive Expo/RN build tooling
(`metro`, `xcode`, `@expo/config-plugins`), not application runtime code — non-blocking, recorded
rather than silently ignored.

**No screenshots**: the Browser pane in this environment could not composite frames for pixel
screenshots. Every validation claim above is backed by real DOM/console/network inspection against
the actual running production build (`dist/`), not by reading source code — but there are no image
files to attach, and none were fabricated to fill the checklist.

## J. Handoff Zip

See the final response for path, byte size, and SHA-256 (computed after this file was written, so it
is not self-referential).

## K. Recommended Next Task

**LW-M1-R2 — Dev Supabase + Auth + Android/iOS Foundation.** Exact prerequisites are listed in
`CURRENT_WORK.md`. Not started by this task.
