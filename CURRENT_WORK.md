# Current Work

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
