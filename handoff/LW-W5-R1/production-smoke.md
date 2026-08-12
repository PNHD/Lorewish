# LW-W5-R1 — Production Smoke

**Status: PERFORMED. Real backend + real production deploy, real DeepSeek generation.**

Run at: 2026-08-12, against real production Cloudflare Pages deployment and the live
`lorewish-dev` (`sfarcofvqfeobtcizxyv`) Supabase project, per explicit user authorization in the
"LW-W5-R1 — FINAL LIVE CLOSEOUT" instruction.

## 0. Edge Function redeployment (blocker fix)

Dependency graph confirmed only `character-chat` imports the changed shared files
(`supabase-chat-repository.ts` → `chat-memory-promotion.ts`); `submit-turn` and `replay-branch` do
not, and were left untouched.

- Deployed: `npx supabase functions deploy character-chat --project-ref sfarcofvqfeobtcizxyv
  --import-map supabase/functions/deno.json` (the CLI's `deno.json` auto-detection does not fire
  without the explicit flag in this environment — same documented quirk as the prior `submit-turn`
  redeploy in `CURRENT_WORK.md`, unrelated to this fix).
- Result: `character-chat` version **6 → 7**, `status: ACTIVE`, `verify_jwt: true` (unchanged).
  `submit-turn` stayed at version 14, `replay-branch` at version 3 — confirmed via
  `supabase functions list`.
- Verified deployed source, not just deploy success: `supabase functions download character-chat`
  round-tripped byte-identical to the locally committed source (`git diff` against
  `supabase/functions/` after download: empty). Confirmed `attachPromotionState` and
  `source_chat_candidate_index`/`source_chat_message_id` present in the live function body.

## 1. Cloudflare Pages production deploy

- Rebuilt `dist/` fresh from HEAD `9108b02` (`npm run export:web`).
- `npx wrangler pages deploy dist --project-name lorewish --branch main`.
- Verified via `npx wrangler pages deployment list --project-name lorewish` (not inferred from the
  returned URL alone):
  - **Environment: Production**
  - **Branch: main**
  - **Deployment commit: 9108b02** (exact match to the PR/implementation head)
  - **Deployment ID: `acd9a30b-b3cb-4e93-a65a-7d82f00fd133`**
  - **Immutable deployment URL: https://acd9a30b.lorewish.pages.dev**
  - **Stable production URL: https://lorewish.pages.dev** — confirmed serving the new build
    (`GET /` → 200; the "START A STORY" CTA computed `opacity: 1`,
    `backgroundColor: rgb(138, 90, 68)` = `#8A5A44` = `colors.accent`, confirming the Home CTA fix
    is live, not just the deploy).

## 2. Real Remember-in-story live proof (the actual blocker this closeout exists for)

Against the real production frontend + real `character-chat` v7:

1. Created a real guest (lazy — no session existed until Advanced Setup was submitted).
2. Real Advanced Setup story start, Vietnamese content language, address preset `tôi/cậu`
   (Character calls you: `cậu`, calls themselves: `tôi`; You call the character: `cậu`, call
   yourself: `tôi`). Real DeepSeek generation returned a scene where the character (Thảo)
   consistently used `cậu`/`tôi` exactly as configured — **the address-register contract verified
   against real model output, not just UI**, in both the Story and later in Character Chat.
3. One real continuation (Scene 2) — succeeded, register still correct.
4. Opened real Character Chat with Thảo, sent real messages. Two of three real chat sends produced
   memory candidates; the character's reply to "Kể cho tôi nghe một điều cậu chưa từng nói với ai"
   ("Tell me something you've never told anyone") yielded two candidates.
5. Promoted candidate 0 (`thao_thap_sang_hai_dang_moi_dem`) via the real "Remember in story" pill.
   Client immediately showed "Đã lưu vào chính truyện" (Remembered in story).
6. Verified server truth directly (`POST .../character-chat {"action":"open"}`, bypassing any
   client cache): `memory_candidates[0].promoted: true` immediately after promotion.
7. **Reloaded the actual browser page** (full navigation, fresh mount, local `promoted` React state
   reset to empty) — the "Đã lưu vào chính truyện" state **persisted**, sourced purely from server
   truth (`candidate.promoted`), not from any client-side memory. This is the literal fix: before
   W5, this exact scenario re-offered "Remember in story" after reload.
8. **No duplicate canon fact**: called `lw_promote_chat_memory` a second time for the same
   candidate; it returned the same existing fact row (`id: e8aeffb4-99dc-4c33-ab51-2bd79df81933`).
   Queried `canon_facts` directly filtered on that `fact_key` for this run — **exactly one row**.
9. **Cross-guest isolation**: created a second, independent anonymous guest and had it attempt
   `{"action":"open"}` against the first guest's `player_run_id`/`character_id`. Result: request
   denied, no thread/message/fact data returned (`HTTP 500 {"error":"internal_error"}` — the
   underlying Postgres RPC raises on unauthorized ownership, and its exact message text isn't one
   of the two strings the edge function pattern-matches to a friendlier 401/403, so it falls through
   to the generic 500 mapping; a nicer error shape would be a good small polish item for a future
   pass, but functionally **no data crossed the guest boundary**, which is what this check verifies).
10. **Unauthenticated request denied**: `POST .../character-chat` with no `Authorization` header at
    all → `401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER"}`, rejected before reaching function code.

## 3. Full smoke checklist

| # | Check | Result |
|---|---|---|
| 1 | Home loads | ✓ |
| 2 | Primary START A STORY CTA visibly renders | ✓ (opacity 1, correct accent color — confirmed via computed style, not just DOM presence) |
| 3 | No login gate | ✓ |
| 4 | Lazy Guest creation | ✓ (no session until Advanced Setup submitted) |
| 5 | Real Story opening | ✓ |
| 6 | One continuation | ✓ |
| 7 | Character Chat | ✓ |
| 8 | Remember in story | ✓ |
| 9 | Reload keeps Remembered state | ✓ — the core fix, proven live |
| 10 | Replay/current-vs-alternate path | ✓ ("Chơi lại từ đây" — instant, no generation wait, no allowance consumed; label switched "Mạch truyện hiện tại" → "Mạch truyện khác") |
| 11 | One VI address-register check | ✓ — verified against real generated model output in two independent generations (Story + Character Chat), not just UI copy |
| 12 | Console clean | **Partial** — see below |
| 13 | No horizontal overflow on mobile | ✓ (412×915 Pixel-7-class and 360×780, both `scrollWidth === innerWidth`) |
| 14 | Unauthenticated inference remains denied | ✓ (401, rejected before function code runs) |

### Item 12 detail — console finding (investigated, not a W5 regression)

A recurring non-fatal `Minified React error #418` (hydration mismatch) appeared during **client-side
in-app navigation** between routes (Home → Advanced Setup, Story → Characters → Chat, etc.) in the
first test session. Investigated with a fresh, isolated tab before concluding:

- A brand-new tab with **no stored locale preference**, on a full page load of `/`, `/play/`, and a
  real `/play/<runId>` route: **zero console errors** in all three cases.
- Switching that same fresh tab to Vietnamese and doing a **full page reload**: still zero console
  errors (rules out a simple locale-mismatch-on-reload theory).
- The warning only appears during **client-side route transitions** (Expo Router static web export
  re-hydrating per-route on in-app navigation), never on a direct/fresh full-page load of any route
  tested.

This pattern is not something LW-W5-R1 introduced — no i18n, SSR, or routing/hydration config was
touched in this pass (only visual/component-level changes and the additive `character-chat`
promotion read). Every real flow in this smoke pass completed successfully despite the warning
(no functional breakage observed). Flagged as a good candidate for a small dedicated follow-up
investigation, not fixed here per the closeout's explicit scope limits (no redesign, no new
features).

## 4. Real provider spend

5 confirmed real DeepSeek-generating calls: story start, one continuation, and three Character Chat
sends (one hit a validation rejection on the character's reply — real tokens consumed, correctly
surfaced as `warning`-colored "that reply could not be safely used" in the UI; the other two
succeeded). A few additional in-UI "Retry" clicks against an already-failed message did not appear
to re-trigger generation (unchanged token/cost stats on re-inspection) and are not counted as
additional real attempts. Well within the 8-attempt budget.

## 5. Known limitation carried forward (RESOLVED in LW-W5-R1-R1, see §6)

Cross-guest access denial (item 9 in §2) returns a generic `500 internal_error` rather than a clean
`401`/`403`. Access is correctly denied either way — no data leak — but the error shape could be
friendlier. Pre-existing (the RPC's exception-message pattern-matching in
`supabase/functions/character-chat/index.ts` predates W5), not introduced by this pass, and out of
scope per "do not redesign" — noted for a future bounded fix.

---

# LW-W5-R1-R1 — Hydration Cleanup + Cross-Guest Error Shape

Second live-closeout pass, addressing the two items flagged by independent review of the LW-W5-R1
handoff: a reported React hydration console error, and the cross-guest `500` noted above.

## 6. Blocker 1 — React hydration warning: investigated, not reproducible, regression-guarded

**Finding: could not reproduce under any controlled condition.** Five independent reproduction
attempts, covering every transition explicitly listed (Home → Story Setup, Story → Characters,
Characters → Character Chat, browser back/forward, EN → VI / VI persistence):

1. **Local Metro dev server** (unminified, "Development-level warnings: ON"), deterministic mocked
   Character Chat data, full Story → Characters → Chat → browser back → browser forward → in-app
   back-to-story sequence — clean.
2. **Local dev server, exact new-story submit flow** (`router.replace({pathname: "/play/[runId]",
   params})`, the specific navigation call in flight when the error was first observed) — clean.
3. **Real production, clean Playwright automation**, Home → Quick Start → real submission →
   Characters → Chat → back navigation → reload — clean.
4. **Real production, the one untried variable**: switching the UI language to Vietnamese
   *mid-session* (client re-render, no navigation) immediately before a real story submission —
   matching the exact sequence of the original observation — clean.
5. **Real production, the same interactive-Browser-pane tool** that originally reported the
   error, repeating steps 1–2 of the original sequence — clean.
6. **Comprehensive final pass**: real submission, Characters, Chat, in-app back link, real browser
   back, real browser forward, EN→VI→EN switching, reload, and a brand-new tab confirming persisted
   locale with zero errors — clean.

**Root-cause assessment**: the original single observation is most likely one of (a) a transient
artifact of the interactive Browser pane tool, which was independently observed to be unstable in
that same session (frame compositing failures — "the Browser pane is not displayed" — and click
timeouts, documented in the original `browser-e2e.md`), or (b) a stale/buffered console-message
re-report (the console-reading tool can return a message from earlier in a tab's lifetime on every
subsequent check, which would make a single one-time occurrence look like a "recurring on every
navigation" pattern under repeated polling — this exact buffering behavior was independently
confirmed earlier in the same original session for a *different*, unrelated console entry). Neither
of these is a defect in the shipped React application.

**No code fix applied** — there is no reproducible mismatch to fix, and per instruction
("do not suppress console.error", "do not monkeypatch React warnings", "do not disable hydration",
"fix the underlying mismatch") fabricating a change against a defect that cannot be located would be
irresponsible, not corrective.

**Regression guard added instead**: `tests/e2e/story-setup.spec.ts` — "Home -> Setup client-side
navigation, EN/VI persistence, and browser back/forward stay console-clean (LW-W5-R1-R1)" —
asserts zero console errors/warnings/page-errors across exactly this transition set. It passes
(both desktop-chromium and mobile-chromium) and will catch a *real* future hydration regression
even though it doesn't correspond to a bug found in this pass.

**Live re-verification after this pass's deploy**: production client-side navigation (Home ↔ Setup,
EN/VI switching, real Quick Start submission, Story → Characters → Chat, browser back/forward,
reload, fresh-tab locale persistence) was re-run against the newly deployed build —
**zero console errors** in every pass.

## 7. Blocker 2 — Cross-guest error shape: fixed

Root cause: `character-chat`'s `open()` and `send()` threw the raw Postgres exception text on an
ownership-check failure (e.g. `"chat thread: run not owned"`), which matched neither the
`"unauthenticated"` nor `"forbidden"` literal strings the edge function's catch block pattern-matches
on, so it fell through to a generic `500 internal_error`. `loadThread()`'s own separate ownership
check already used the literal `"forbidden"` string correctly — only the two RPC-based checks had
the gap.

Fix: `supabase/functions/_shared/engine/ownership-error.ts` (new, Deno-import-free, unit tested)
maps any Postgres error with `code === "42501"` (`insufficient_privilege` — every cross-owner RPC
guard across the character-chat migrations already raises this exact SQLSTATE) to the literal
`"forbidden"` message, reused at both `open()`'s and `send()`'s RPC call sites. Matching on the
SQLSTATE rather than exception wording means this mapping won't silently break if a future migration
rewords an exception message. No schema change. No ownership check weakened — access was already
correctly denied before this fix; only the HTTP status/error code returned was wrong.

**Live-verified after redeploy** (`character-chat` v7 → v8): a fresh, independent anonymous guest
attempting `{"action":"open"}` against a different guest's `player_run_id`/`character_id` now
receives `403 {"error":"forbidden"}` (previously `500 {"error":"internal_error"}`). No data returned
either way — this fix only corrects the response shape.

## 8. Deployment record (this pass)

- `character-chat`: v7 → **v8**, `ACTIVE`, `verify_jwt: true` unchanged. Downloaded deployed source
  confirmed byte-identical to committed source (`git diff` against `supabase/functions/`: empty).
- Cloudflare Pages production: new deployment **`53c0b39a-c06f-444a-9ccd-25b819490975`**,
  **Environment: Production**, **Branch: main**, commit **`5bfcf75`** (verified via
  `wrangler pages deployment list`, not inferred from URL). Immutable URL
  `https://53c0b39a.lorewish.pages.dev`; stable URL `https://lorewish.pages.dev` confirmed serving
  it (`0 files uploaded, 15 already uploaded` — build output byte-identical to the prior deployment,
  as expected since no frontend `src/` file changed in this pass, only backend/test files).

## 9. Small smoke (this pass) — no provider campaign

Per instruction, real DeepSeek calls were spent only to establish new runs where needed for the
navigation/console checks above (~3–4 real calls: two Quick Start submissions — the first completed
successfully with a real reply respecting the configured address register, the second's timing
didn't converge before the check window and was not retried further — and at least one real
Character Chat send). The **Remember-in-story survives reload** check itself was **not re-run with a
new real promotion** in this pass: `attachPromotionState`/`loadThread` (the code that check
exercises) were not modified by this cleanup — only the ownership-error mapping and the new
regression test were — and the deployed v8 source was confirmed byte-identical to committed source
for those unchanged functions. §2 of this document already contains a complete, real, live proof of
that exact mechanism (promote → server truth → real browser reload → still "Remembered", no
duplicate fact) against the immediately prior deployment running the same unchanged code path;
carried forward per "reuse existing W5 real-provider evidence where possible" rather than re-spending
budget to re-demonstrate an unchanged code path.

## 10. Final verdict inputs

- Console-clean on production client-side navigation: **confirmed**, multiple fresh passes, zero
  errors.
- Cross-guest error shape: **fixed and live-verified** (`403`, not `500`).
- No functional regression: unit tests 168/168, e2e 12/12 (both projects), typecheck/lint clean, all
  re-verified after this pass's changes.
