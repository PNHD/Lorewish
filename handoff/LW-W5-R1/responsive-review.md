# LW-W5-R1 — Responsive Review

## Desktop (no longer stretched mobile)

Every screen's chrome bar (back link + language switcher) previously spanned the full page width
edge-to-edge while the body content below it sat in a centered `readingWidth.maxContentWidth` (640px)
column — on a wide viewport this produced two different widths on the same screen, the classic
"mobile page stretched wide" tell (ux-audit.md P1-6).

Fix: `src/components/screen-header-bar.tsx` (`ScreenHeaderBar`) keeps the bar's border/background
full-bleed (a normal desktop convention) but centers its *content* to the same column width as the
body. Verified live at 1280×800: the back link's bounding rect reported `x: 320`, exactly
`(1280 - 640) / 2` — matching the content column's left edge below it — where before the fix it sat
flush at the page's 16px padding regardless of viewport width.

The reading-column width cap itself was not changed — it's contractually required
(`docs/UX_CONTRACT.md` §11, "Desktop web... uses a constrained max-width reading column... not full
bleed") — the fix was to bring the chrome into alignment with it, not to widen the column.

Consolidated six near-identical header blocks (`run.tsx`, `new-story.tsx`, `characters.tsx`,
`character-chat.tsx`, `account/index.tsx`, `preview/index.tsx`) into the one shared component in the
same change.

## Mobile — Pixel 7 class (~412×915) and ~360px narrow

Checked live (`document.documentElement.scrollWidth` vs `window.innerWidth`, must be equal — any gap
means horizontal overflow) at:

| Surface | 375×812 | 360×780 | Notes |
|---|---|---|---|
| Home | ✓ no overflow | ✓ no overflow | Demoted preview link doesn't wrap awkwardly at either width. |
| Quick Start (collapsed) | ✓ | ✓ | |
| Advanced Setup, expanded, EN | — | ✓ | All disclosure sections open simultaneously; no overflow. |
| Advanced Setup, address section expanded, EN copy | — | ✓ (see below) | Four labeled rows fit without wrapping the label/value pair awkwardly at 360px. |
| `/preview` (Story reader proxy) | ✓ | ✓ | Choice buttons, composer, dialogue indentation all fit. |

The address-term expansion at 360px was specifically re-verified after the P0-2 fix (the four-row
layout is new in this pass) — confirmed via
`document.documentElement.scrollWidth === window.innerWidth` immediately after expanding the section,
both before and after switching content language to Vietnamese.

Additionally verified via the existing Playwright e2e suite (`tests/e2e/*.spec.ts`), which runs every
test on both a `desktop-chromium` and a `mobile-chromium` (Pixel 7 device profile) project and
explicitly asserts
`document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1` on the Story
reader, Character Chat, and Quick Start/Advanced Setup screens — this assertion passed on both
projects for every test in the suite (10/10).

## Known tooling limitation encountered during this pass

The interactive Browser pane in this session could not composite frames (`computer.screenshot` and
`computer.left_click` both errored/timed out with "Browser pane is not displayed/hidden," even after
restarting the dev server and opening a fresh tab). Layout verification for this review therefore
relied on: (a) `document.documentElement.scrollWidth`/`clientWidth` comparisons via
`javascript_exec`, (b) the accessibility tree (`read_page`) for structural/positional checks (e.g.
the header alignment `x: 320` measurement above), and (c) Playwright's own headless screenshot
capture (`scripts/capture-w5-screenshots.mjs`), which was unaffected by the pane issue and produced
the actual pixel evidence in `handoff/LW-W5-R1/screenshots/` — see `visual-review.md`.

## Not re-tested in this pass (unchanged by it)

- Native iOS/Android safe-area behavior — `native remains untouched` per the W5 scope; no native
  build was run.
- Real mobile-browser on-screen-keyboard resize behavior — the composer's keyboard-safety contract
  (`KeyboardAvoidingView`, draft persistence) was not modified in this pass, only its visual chrome
  and hover/focus states were, so it was not re-verified beyond the existing e2e coverage.
