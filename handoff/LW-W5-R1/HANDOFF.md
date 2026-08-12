# LW-W5-R1 — Web Product UX Completion + Visual System + Long-Session Polish

Status: **W5_R1_PASS** with one explicit deferral (production deploy + real-provider smoke — held
for the user's separate go-ahead; everything else in the closeout gate is met).

Branch: `feature/lw-w5-product-ux`
Base: `origin/main` @ `f608f0d` (PR #6, WEB-M4 guest-beta, independently reviewed and merged)
Head at handoff time: `8ac2ec6`
Draft PR: https://github.com/PNHD/Lorewish/pull/7 (open, not merged)

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

[production-smoke.md](production-smoke.md) — **not performed**, explicitly deferred pending the
user's separate go-ahead for an actual production deploy. Technical readiness (gh/wrangler auth,
green CI on exact head) documented there.

## T. Tests / CI

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npx vitest run` — **164/164 passing**, 21 files, including new `chat-memory-promotion.test.ts`
- `npm run export:web` — succeeds
- `npx playwright test` — **10/10 passing**, both projects, including new Remember-in-story
  regression test
- Raw output: [test-results.txt](test-results.txt), [ci-results.txt](ci-results.txt)

## U. Implementation head

`8ac2ec6` on `feature/lw-w5-product-ux`, 10 commits over `origin/main` @ `f608f0d`. See
[git-log.txt](git-log.txt) and [git-diff.patch](git-diff.patch).

## V. Draft PR

https://github.com/PNHD/Lorewish/pull/7 — **draft, not merged**, per instruction.

## W. Handoff zip

See the end of this document / the message accompanying this handoff for the exact path, byte size,
entry count, and SHA-256 of `Lorewish_LW-W5-R1_handoff.zip`.

## X. Known limitations

- **No scene-transition motion was implemented.** `docs/MOTION_GUIDELINES.md` specifies a detailed
  contract (scene fade/slide, choice micro-feedback, Reduce Motion fallback), but nothing in the
  current codebase animates beyond a pressed-opacity change. Implementing it correctly (performance
  budget, Reduce Motion collapse, no more than one concurrent animation) is real production work, not
  a tightening pass — deliberately left for a dedicated future task rather than rushed under this
  audit-driven pass. Nothing regresses because nothing animates today; `useReducedMotion` is in place
  ready for when this work happens.
- **Screen-reader-specific manual testing was not performed.** Accessibility verification in this
  pass was accessibility-tree- and computed-style-based (roles, states, focus outlines, contrast
  ratios), not assistive-technology-based (no VoiceOver/TalkBack/NVDA pass). Flagged honestly rather
  than claimed.
- **The interactive Browser pane stopped compositing frames mid-session** (see `browser-e2e.md`).
  Verification continued via read-only DOM/accessibility-tree tools and via Playwright's independent
  headless capture, which is what actually caught the Home CTA bug — but this means the "manual
  walkthrough" portion of QA was cut shorter than originally planned and automated coverage carried
  more of the burden than intended.
- **Production deploy and the bounded real-provider smoke test were not performed**, per the user's
  explicit choice at the draft-PR checkpoint (see `production-smoke.md`). This is the one item in the
  original closeout gate not yet satisfied; everything else (tests, CI, browser QA, no
  console/security regressions, existing engine/memory/branch behavior intact, native untouched) is
  met on the current branch head.

## Y. Verdict

**W5_R1_PASS**, conditional on the user separately authorizing the production deploy step when ready
(the one gate item deliberately left open, not a failure of the work itself).

## Z. Next task

Not started: LW-W5-R2 (if the deferred motion/production-smoke work becomes its own follow-up) or
WEB-M6 (monetization). Per instruction, this session does not begin either.
