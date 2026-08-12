# LW-W5-R1 — Browser QA

## Automated (Playwright, deterministic/mocked — no real provider calls)

`npx playwright test` — projects: `desktop-chromium` (Desktop Chrome profile), `mobile-chromium`
(Pixel 7 device profile). Full raw output: [ci-results.txt](ci-results.txt).

**10/10 passed**, both projects:

- `story-setup.spec.ts` — Quick Start / Advanced Setup remain public/guest-first/responsive/
  draft-safe; manual EN/VI switch.
- `roleplay-chat.spec.ts` — Story reader stays editorial and duplicate-submit resistant on a
  long-paste custom action; Character directory + branch-bound Chat persist across reload; **new in
  this pass**: "Remember in story" shows a stable "Remembered in story" state after reload
  (LW-W5-R1 P0-3 regression test — promotes a candidate, reloads, asserts the label didn't revert).

All three specs assert `document.documentElement.scrollWidth - clientWidth <= 1` (no horizontal
overflow) and an empty console-error/warning array where applicable.

## Manual walkthrough (interactive Browser pane, before the pane stopped compositing)

Performed against the local dev server (`npx expo start --web`) before an environment issue (see
below) limited further interactive verification to Playwright:

- Home: confirmed single CTA hierarchy, guest-persistence caption, EN/VI switch reflows instantly.
- Quick Start → Advanced Setup: confirmed progressive disclosure, draft resume via localStorage
  (reloaded mid-form, Advanced Setup + entered premise both restored).
- Advanced Setup, VI content language: confirmed the four-row address-term fix live, both before
  (`tôi · cậu · tôi · cậu`, the bug) and after (labeled rows) the fix.
- `/preview` (deterministic offline fixture): walked a full turn — filled the composer, sent a
  custom action, confirmed the player-action banner, narrative, dialogue, and state-change panel all
  rendered in the correct fixed order with no console errors.
- Keyboard navigation: tabbed through `/play`'s Advanced Setup form, confirmed the new
  `colors.focus` outline appears on each control (verified via `getComputedStyle`, see
  accessibility-review.md).

## Environment limitation encountered

Partway through this session the interactive Browser pane stopped compositing frames —
`computer.screenshot` and `computer.left_click` (coordinate- and ref-based) both began failing with
"the Browser pane is not displayed" / "currently hidden," reproduced across a page reload, a fresh
dev-server restart, and a brand-new tab. Read-only tools (`read_page`, `get_page_text`,
`javascript_exec`, `read_console_messages`) continued to work throughout and were used for the
remainder of interactive verification (see responsive-review.md and accessibility-review.md for what
they covered). For pixel-level screenshot evidence, `scripts/capture-w5-screenshots.mjs` drives
Playwright's own headless Chromium directly — a separate mechanism from the interactive pane — and
was unaffected; it produced the screenshot pack in `handoff/LW-W5-R1/screenshots/` and is what
actually caught the Home CTA rendering bug documented in `visual-review.md`.

## Not run in this pass

- Real DeepSeek generation calls for UI-state coverage — intentionally avoided per the task's cost
  guidance ("Real DeepSeek calls are NOT necessary for every UI state... Do not spend provider budget
  merely for screenshots"). The bounded production smoke pass (max 8 real attempts) is the only place
  real provider calls are spent, and only after this branch is deployed — see `production-smoke.md`.
- Native iOS/Android — out of scope for W5 (web-first policy).
