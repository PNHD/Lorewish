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

## 5. Known limitation carried forward

Cross-guest access denial (item 9 in §2) returns a generic `500 internal_error` rather than a clean
`401`/`403`. Access is correctly denied either way — no data leak — but the error shape could be
friendlier. Pre-existing (the RPC's exception-message pattern-matching in
`supabase/functions/character-chat/index.ts` predates W5), not introduced by this pass, and out of
scope per "do not redesign" — noted for a future bounded fix.
