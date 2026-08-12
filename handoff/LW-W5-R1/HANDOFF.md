# LW-W5-R1 — Web Product UX Completion + Visual System + Long-Session Polish

Status: **W5_R1_PASS** — fully live-verified across two closeout passes (LW-W5-R1 and
LW-W5-R1-R1): `character-chat` Edge Function redeployed twice (v6 → v7 → v8) and confirmed live each
time, actual Cloudflare production deployed and reconfirmed via deployment metadata (not URL
inference), the Remember-in-story fix proven end-to-end against real backend data and a real page
reload, and the second pass's two flagged items resolved — a cross-guest error-shape bug (fixed,
live-verified) and a reported hydration console error (investigated exhaustively, found
not reproducible, regression-guarded). See `production-smoke.md` for the full live-verification
record of both passes.

Branch: `feature/lw-w5-product-ux`
Base: `origin/main` @ `f608f0d` (PR #6, WEB-M4 guest-beta, independently reviewed and merged)

**IMPLEMENTATION_CODE_HEAD**: `5bfcf750ddb5fce3c4cdb804482299da154016cd` — the last commit that
changed source (the cross-guest error-shape fix + hydration regression test). Audited, tested,
deployed to `character-chat` v8, deployed to Cloudflare production, and live-verified.

**FINAL_PR_HEAD**: one evidence-docs-only commit on top of `5bfcf75` — this HANDOFF.md/
production-smoke.md/ci-results.txt/git-status.txt/git-log.txt update itself, committed immediately
after this file is written. A file cannot record its own content-addressed commit SHA in advance
without becoming stale the moment it's written (the exact failure mode this section exists to avoid
repeating) — the exact FINAL_PR_HEAD SHA is reported in the chat message accompanying this handoff
and in `git-log.txt`/`git-status.txt`, generated fresh after the commit exists. No source file
changes between `5bfcf75` and FINAL_PR_HEAD — only `handoff/LW-W5-R1/*`.

Draft PR: https://github.com/PNHD/Lorewish/pull/7 (open, not merged)
Exact-head CI (all SUCCESS):
- `9108b02` (LW-W5-R1 code head): run `31553617939`
- `ebfc2aa`, `478ce6e` (LW-W5-R1 docs-only commits): runs `31555941274`, `31556108528`
- `5bfcf75` (LW-W5-R1-R1 code head, current IMPLEMENTATION_CODE_HEAD): run `31570250910`
- FINAL_PR_HEAD (this evidence commit, on top of `5bfcf75`): CI run reported in the closing chat
  message once it completes
All runs so far: typecheck, lint, unit tests (164 → 168 in this pass), web export, Playwright e2e
(10 → 12 in this pass) all green; native jobs skipped as configured.

## A. Baseline

Verified before any change: `git fetch origin --prune`, then `origin/main` HEAD =
`f608f0df171a1b241c5e77720a46865cb9eb9e8b` — matched the SHA given in the task brief exactly (fetched
and confirmed, not trusted blindly). Pre-existing uncommitted artifacts on the old
`feature/lw-w4-guest-beta` branch (stray handoff docs) were stashed, not discarded — recoverable via
`git stash list` on that branch if ever needed; they're irrelevant to W5 and excluded from this
bundle. New branch created from `origin/main`, not from the W4 branch.

## B. UX audit

[ux-audit.md](ux-audit.md) — evidence-based walk of every screen (source review + live
accessibility-tree/DOM checks at desktop/375/360px) against `docs/UX_CONTRACT.md` and the W5 spec.
Found the codebase materially more contract-compliant than a typical starting point (five-channel
scene rendering, fixed vertical order, non-blocking allowance framing, EN/VI copy parity, "Replay from
here" language already correct) — W5 tightened and finished rather than rebuilding. Three P0s, six
P1s, two P2s identified and classified before any code change.

## C. Visual foundation

`src/theme/tokens.ts`: added `warning`/`success`/`focus` color roles (light + dark, all ≥4.5:1
contrast against their surfaces — see `accessibility-review.md`) and motion duration tokens.
`src/theme/interactive.ts`: shared hover/focus-visible/press style helpers, applied across every
interactive control touched in this pass. `src/hooks/use-reduced-motion.ts`: cross-platform Reduce
Motion hook (react-native-web's `AccessibilityInfo` is already `matchMedia`-backed, confirmed by
reading its source — one hook covers native and web). No second design system introduced; existing
tokens/components extended.

## D. Home

Single primary CTA ("Start a Story"); `/preview` demoted from an equal second button to a small
internal QA text link (P0-1). Found and fixed a real rendering bug in the same surface: the CTA was
invisible (near-zero opacity) due to `<Link asChild>` not composing with an array-valued style
function — caught only by actual screenshot capture, fixed by switching to the same
`Pressable` + `router.push()` pattern used everywhere else. See `visual-review.md`.

## E. Quick Start

Reviewed — already fast and non-wizard-like; genre/tone/POV pills gained hover/focus/larger tap
targets as part of the shared `ChoicePill` consolidation. No structural changes needed.

## F. Advanced Setup

Vietnamese address-term summary rewritten from an unlabeled `tôi · cậu · tôi · cậu` join to four
labeled rows ("Character calls you / calls themselves", "You call the character / call yourself")
over the same `ADDRESS_PRESETS` data — canonical four-direction model unchanged (P0-2). Progressive
disclosure, field hierarchy, and validation placement were already correct and left alone.

## G. Story reader

Per-scene "Replay from here" affordance thinned for historical scenes (small text-weight
`ReplayLink`) while the current scene's own forward action keeps full button weight (P1-1, "replay
affordance density"). Error/quota states now color-differentiated (`warning` vs. `danger`, P1-3).
Long-session scroll behavior reasoned via code (unbounded history in one `ScrollView`, composer
anchored outside it — never clipped mid-scroll) and confirmed via the existing Playwright long-paste/
duplicate-submit e2e test; virtualization was not added (no evidence it's needed, and the spec asks
not to add it without evidence).

## H. Composer / Choices

Behavioral contract preserved unmodified (auto-grow 1–7 lines, Enter=newline, explicit Send, VI IME
safety, no dup submit, draft persistence — none of this was touched). Visual layer: hover/focus added
to the Send button and every choice; `ChoiceList` and `Composer` remain visually distinct but coherent
with the rest of the reading view.

## I. Characters

Redundant top border removed from the first character card (a section heading already separates it).
"Talk to character" gained hover/focus.

## J. Character Chat

Header/identity, relationship context, and the `CHAT_NON_CANONICAL` notice were already correct and
left alone. Promoted-fact pill now renders in the `success` color at full opacity (previously washed
out by `disabledOpacity`, which is wrong for a confirmed state vs. a genuinely disabled one).

## K. Remember-in-story fix

**Fixed, not deferred.** Root cause: `character-chat.tsx` tracked promoted candidates in
client-only `useState`, reset on every reload, despite the promotion RPC
(`lw_promote_chat_memory`) already being idempotent server-side on
`(source_chat_message_id, source_chat_candidate_index)`. Fix: `loadThread`
(`supabase/functions/_shared/engine/supabase-chat-repository.ts`) now reads that same key from
`canon_facts` and reports `promoted` per candidate in the response; the client ORs server truth with
its own optimistic set (for the instant post-click reflect before the next reload). **No schema
change** — additive read only. Pure mapping logic extracted to
`supabase/functions/_shared/engine/chat-memory-promotion.ts` with unit tests (5 cases, since the
repository file itself is Deno-only and excluded from vitest); a full end-to-end regression test was
also added to `tests/e2e/roleplay-chat.spec.ts` (promote → reload → still "Remembered in story").

**Addendum from live closeout**: an independent review correctly caught that this fix, while merged
into the branch and covered by tests, was not yet live on the actual `sfarcofvqfeobtcizxyv` Supabase
project (the deployed `character-chat` was still v6, pre-W5). Redeployed to v7 and proven live
end-to-end against real backend data — see §S and `production-smoke.md`.

## K2. LW-W5-R1-R1 — hydration + cross-guest error-shape cleanup

Second live-closeout pass, triggered by independent review of the LW-W5-R1 handoff flagging two
items. Full detail in `production-smoke.md` §6–10.

- **Hydration console error**: reported as recurring during client-side navigation. Investigated via
  five independent reproduction methods (local dev server with mocks, local dev server matching the
  exact new-story `router.replace` transition, real production via clean Playwright automation
  including the one untried variable — switching UI language mid-session before a real submission —
  and the same interactive-Browser-pane tool that originally reported it). **Not reproducible under
  any of them.** Root-cause assessment: most likely a one-time artifact of the interactive Browser
  pane (independently documented as unstable in the same original session — frame-compositing
  failures, click timeouts) or a stale/buffered console-message re-report, not a defect in the
  shipped app. No code changed — there was nothing reproducible to fix, and per instruction,
  suppressing or monkeypatching around an unlocated issue would have been the wrong move. Added a
  permanent regression test instead (`tests/e2e/story-setup.spec.ts`, new test asserting zero
  console errors across Home↔Setup, EN/VI switch+persistence, and real browser back/forward), which
  will catch a genuine future regression even though it wasn't guarding an actual bug this time.
- **Cross-guest error shape**: `character-chat`'s `open()`/`send()` threw raw Postgres exception text
  on an ownership failure, matching neither the `"unauthenticated"` nor `"forbidden"` strings the
  edge function checks for, landing on a generic `500` instead of `403` (access was already correctly
  denied either way — this was a response-shape bug, not a security bug).
  **Fixed**: new `supabase/functions/_shared/engine/ownership-error.ts` maps Postgres SQLSTATE
  `42501` (the code every cross-owner RPC guard in the character-chat migrations already raises) to
  the literal `"forbidden"` string, reused at both call sites. No schema change, no ownership check
  weakened. Unit tested (4 cases). Live-verified after redeploy: a fresh guest attempting cross-owner
  access now gets `403 {"error":"forbidden"}`, confirmed via direct API call against the redeployed
  function.
- Both `character-chat` (v7 → v8) and Cloudflare production were redeployed from this pass's code
  head (`5bfcf75`) and reverified via deployment metadata / byte-identical source comparison.

## L. Replay / branch UX

Language was already correct ("Replay from here", "Current path"/"Alternate path", no `fork`/
`branch_id`/ancestry exposed) — verified by reading every player-facing copy string. Affordance
density addressed per §G above.

## M. Guest / quota / errors

Guest persistence messaging already existed and was appropriately low-key — unchanged. Quota/error
color differentiation per §G. Copy itself (EN/VI, all states) was already non-jargon and correct;
no wording changes were needed.

## N. Responsive

[responsive-review.md](responsive-review.md). Desktop chrome now aligns to the reading column
(header content centered to the same 640px column as the body, verified at `x: 320` on a 1280px
viewport) instead of spanning full-bleed while the body sat centered — six near-duplicate header
blocks consolidated into `src/components/screen-header-bar.tsx` in the process. No horizontal
overflow at 1280/412(Pixel 7)/375/360px, verified live and via the Playwright e2e suite (which runs
every spec on both a desktop and a Pixel 7 project).

## O. Accessibility

[accessibility-review.md](accessibility-review.md). Missing `accessibilityRole="header"` added to 3
of 6 main screens. Keyboard focus ring added across every interactive control touched (verified live
via `getComputedStyle`, not just code review). Tap targets grown via `hitSlop` without changing visual
size. New color tokens contrast-checked (all ≥4.5:1 AA). Reduce Motion hook added ahead of future
motion work (nothing animates yet, so nothing to regress).

## P. EN / VI copy

Reviewed both locale files end-to-end — already complete, parallel, and non-developer-facing. New
copy added for the four address-term row labels (EN + VI) and nothing else needed changing.

## Q. Performance

No new dependencies added. No new animation/motion framework. Screenshot pack and e2e all ran without
console errors or warnings (asserted explicitly in the e2e specs).

## R. Browser QA

[browser-e2e.md](browser-e2e.md). 10/10 Playwright e2e passing on desktop-chromium + mobile-chromium
(Pixel 7), zero real provider calls. Manual interactive walkthrough performed earlier in the session;
documents an environment limitation (interactive Browser pane stopped compositing frames mid-session)
and how verification continued through it.

## S. Production smoke

[production-smoke.md](production-smoke.md) — **performed twice** (LW-W5-R1 §1–5, LW-W5-R1-R1 §6–10),
against the real production Cloudflare deployment and the live `character-chat` Edge Function.
Current state (after LW-W5-R1-R1):

- `character-chat` redeployed twice this handoff (v6 → v7 → v8), verified `ACTIVE`,
  `verify_jwt: true` unchanged both times, downloaded deployed source byte-identical to committed
  source both times.
- Cloudflare Pages production reconfirmed via `wrangler pages deployment list` (not URL inference):
  **Environment: Production, Branch: main, commit `5bfcf75`**, deployment ID
  `53c0b39a-c06f-444a-9ccd-25b819490975`, immutable URL `https://53c0b39a.lorewish.pages.dev`, stable
  URL `https://lorewish.pages.dev` confirmed serving it.
- **Remember-in-story**: proven live end-to-end in the first pass (real guest, real Advanced Setup
  VI, real generation honoring the configured register, real promotion, server truth via direct API
  call, survives an actual browser reload, no duplicate `canon_facts` row). That mechanism
  (`attachPromotionState`/`loadThread`) was not touched by the second pass — confirmed unchanged via
  the byte-identical source check — so the proof carries forward rather than being re-spent.
- **Cross-guest access**: was `500 internal_error` (correctly denied, wrong shape) in the first pass;
  now **`403 {"error":"forbidden"}`**, live-verified against the v8 deployment.
- **Console-clean on client-side navigation**: not fully clean at the end of the first pass (one
  reported hydration warning); exhaustively investigated in the second pass, found not reproducible
  under any controlled condition, and reconfirmed **zero console errors** on a fresh re-run against
  the current deployment covering every required transition.
- Real provider spend across both passes: 5 (first pass) + ~3–4 (second pass, establishing fresh runs
  for the navigation/console checks) — no real-provider "campaign" in either pass.

## T. Tests / CI

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npx vitest run` — **168/168 passing**, 22 files (added `ownership-error.test.ts`, 4 cases, on top
  of LW-W5-R1's 164)
- `npm run export:web` — succeeds
- `npx playwright test` — **12/12 passing**, both projects (added the hydration regression test on
  top of LW-W5-R1's 10)
- `git diff --check` — clean (no whitespace errors)
- Exact-head CI (GitHub Actions, PR #7), all **SUCCESS**:
  - `31553617939` on `9108b02` (LW-W5-R1 code head)
  - `31555941274`, `31556108528` on `ebfc2aa`/`478ce6e` (LW-W5-R1 docs-only)
  - `31570250910` on `5bfcf75` (LW-W5-R1-R1 code head — current FINAL_PR_HEAD)
- Raw output: [test-results.txt](test-results.txt), [ci-results.txt](ci-results.txt)

## U. Implementation head

**IMPLEMENTATION_CODE_HEAD = `5bfcf750ddb5fce3c4cdb804482299da154016cd`** — the last commit that
changed source in either closeout pass (the LW-W5-R1-R1 cross-guest fix + hydration regression
test). Audited, tested, deployed to `character-chat` v8, deployed to Cloudflare production, and
live-verified. 11 commits over `origin/main` @ `f608f0d` (10 from LW-W5-R1, 1 from LW-W5-R1-R1; the
LW-W5-R1 evidence-docs commits `ebfc2aa`/`478ce6e` sit between them and changed no source).

**FINAL_PR_HEAD**: one further evidence-docs-only commit on top of `5bfcf75` (this update). Exact
SHA reported in the closing chat message and in [git-log.txt](git-log.txt)/
[git-status.txt](git-status.txt), both regenerated after that commit exists — not predicted here.

See [git-diff.patch](git-diff.patch) (generated against the code head, `5bfcf75`, since that's the
diff that matters for review).

## V. Draft PR

https://github.com/PNHD/Lorewish/pull/7 — **draft, not merged**, per instruction.

## W. Handoff zip

See the end of this document / the message accompanying this handoff for the exact path, byte size,
entry count, and SHA-256 of `Lorewish_LW-W5-R1_handoff.zip`.

## X. Known limitations

Resolved in LW-W5-R1-R1 (kept here for the audit trail, not open items):

- ~~Cross-guest access denial returns a generic `500 internal_error`~~ — **fixed**. Now returns
  `403 forbidden`, live-verified against the redeployed function (see §K2).
- ~~A React hydration console warning appears during client-side navigation~~ — **investigated
  exhaustively and found not reproducible** under five independent methods, including the exact
  original sequence run against real production. Most likely a one-time tooling artifact, not an
  application defect (see §K2 and `production-smoke.md` §6). A permanent regression test now guards
  against a genuine future occurrence.

Still open, carried forward unchanged from LW-W5-R1:

- **No scene-transition motion was implemented.** `docs/MOTION_GUIDELINES.md` specifies a detailed
  contract (scene fade/slide, choice micro-feedback, Reduce Motion fallback), but nothing in the
  current codebase animates beyond a pressed-opacity change. Implementing it correctly (performance
  budget, Reduce Motion collapse, no more than one concurrent animation) is real production work, not
  a tightening pass — deliberately left for a dedicated future task. Nothing regresses because
  nothing animates today; `useReducedMotion` is in place ready for when this work happens.
- **Screen-reader-specific manual testing was not performed.** Accessibility verification in this
  pass was accessibility-tree- and computed-style-based (roles, states, focus outlines, contrast
  ratios), not assistive-technology-based (no VoiceOver/TalkBack/NVDA pass). Flagged honestly rather
  than claimed.
- **The interactive Browser pane stopped compositing frames during the LW-W5-R1 session** (see
  `browser-e2e.md`). Verification continued via read-only DOM/accessibility-tree tools and via
  Playwright's independent headless capture. Not encountered as a blocker in LW-W5-R1-R1 (the pane
  worked normally when used again in this pass), so likely was session-specific rather than a
  persistent environment issue — noted for awareness, not further action.

## Y. Verdict

**W5_R1_PASS.** Every item in the original closeout gate, plus both items raised in the
LW-W5-R1-R1 independent review, are now live-verified: local CI green on the exact head (both
passes), browser QA green, the `character-chat` Edge Function redeployed twice and confirmed live
each time, the Remember-in-story fix proven end-to-end against real backend data and a real page
reload, the cross-guest error shape fixed and live-verified (`403`, not `500`), production
client-side navigation reconfirmed console-clean after exhaustive investigation of the reported
hydration warning, actual Cloudflare production deployed and reconfirmed via deployment metadata, no
horizontal overflow, no auth/guest-isolation regression, and existing engine/memory/branch behavior
intact (168/168 unit tests, 12/12 e2e). The two remaining items in §X (motion, screen-reader manual
testing) are pre-existing, non-blocking, and explicitly deferred to a future bounded pass — neither
was introduced by this work and neither affects W5_R1_PASS.

## Z. Next task

Not started: LW-W5-R2 (if the deferred motion/production-smoke work becomes its own follow-up) or
WEB-M6 (monetization). Per instruction, this session does not begin either.
