# LW-W5-R1 — Visual Review

Screenshots: [handoff/LW-W5-R1/screenshots/](screenshots/) — captured via
`scripts/capture-w5-screenshots.mjs`, a standalone Playwright driver against the static web export
(`dist/`), reusing the same deterministic route-mocking pattern as `tests/e2e/roleplay-chat.spec.ts`
(no real network/provider calls, no cost). Desktop shots are 1280×800; mobile shots use Playwright's
"Pixel 7" device profile.

**Why Playwright and not the interactive Browser pane**: the Browser pane could not composite frames
in this session — `computer.screenshot` and `computer.left_click` both timed out with "the Browser
pane is not displayed" / "currently hidden," even after restarting the dev server and opening a fresh
tab. Playwright's own headless capture was unaffected by this and is what actually caught the one
real rendering bug found in this pass (below) — the accessibility-tree-based verification used
earlier in the session (`read_page`, `get_page_text`) could not have caught it, since it reads text
content regardless of paint/opacity.

## Home

| | |
|---|---|
| Previous issue | `/preview` ("Open the offline preview") rendered as a second full-size pill button, equal in visual weight to "START A STORY" — two "start" buttons with no way to tell which is the product (ux-audit.md P0-1). |
| Change made | One primary CTA. The preview link is now a small underlined text link below the caption, visually and structurally subordinate. |
| Usability rationale | Story-first per the product's primary design principle — a first-time visitor should have exactly one obvious next action. `/preview` remains reachable for QA without competing for attention. |

**Bug found and fixed during this review**: the CTA was originally wrapped in
`<Link href="/play" asChild><Pressable style={fn}>` — Expo Router's `Link` `asChild` cloning does not
compose correctly with an array-valued style function, and the button painted at near-zero opacity
(background and text both essentially invisible against the page background). This was invisible to
every text-based check performed earlier (the button's accessible name and DOM structure were
correct) and only surfaced once an actual screenshot was taken. Fixed by switching to a plain
`Pressable` + `router.push()`, the same pattern already used everywhere else in the app (verified:
"Talk to character" and the Advanced Setup "Start" button, both screenshotted, render correctly).

Screenshots: `desktop-home.png`, `mobile-home.png`.

## Quick Start / Advanced Setup

| | |
|---|---|
| Previous issue | Vietnamese address-term summary rendered as four unlabeled raw values joined by `·` (e.g. `tôi · cậu · tôi · cậu`) — unrecoverable even for a Vietnamese-fluent reader, since two pairs share the same word in different roles (ux-audit.md P0-2). Selector pills had no hover/focus state and undersized tap targets (~28px). |
| Change made | The resolved preset now renders as four labeled rows ("Character calls you", "Character calls themselves", "You call the character", "You call yourself") reusing the same `ADDRESS_PRESETS` data — no change to the canonical four-direction model. All selector pills (`ChoicePill`, shared by path tabs / language / genre / tone / POV / address preset) now show a hover border, a visible keyboard-focus ring, and a larger hit-slop tap target while keeping the same compact visible size. |
| Usability rationale | A player must be able to tell who is speaking to whom without reverse-engineering the data model. Larger tap targets and visible focus/hover bring this surface in line with Part 19 (accessibility) and Part 17 (desktop intentionality) without changing its restrained, non-form-wizard character. |

Screenshots: `desktop-advanced-setup.png` (English, Advanced Setup expanded, address section
expanded), `mobile-advanced-setup-vi.png` (same surface at Pixel 7 width).

## Story reader

| | |
|---|---|
| Previous issue | Every historical scene in a long story rendered its own full-size bordered "Replay from here" button — a wall of identical buttons stacking up as a story grew longer (ux-audit.md P1-1). Error/quota states (allowance exhausted, beta capacity, safety rejection, offline, generic failure) all rendered in the same default text color, with no visual differentiation between "you can act on this" and "something broke" (P1-3). Screen header (back link + language switcher) spanned full page width while the content below sat in a centered narrow reading column — desktop read as a stretched mobile page (P1-6). |
| Change made | Historical scenes now get a small, right-aligned, text-weight `ReplayLink` instead of a full ActionButton; the *current* scene's own forward action (checkpoint/ending) keeps full button weight, since that one is the primary next action. `warning` color (new token) now marks allowance-exhausted / beta-capacity / offline / safety-rejection; `danger` is reserved for a genuine provider/transport failure. The header bar's content is now centered to the same column width as the body below it. |
| Usability rationale | Replay stays discoverable on every scene (nothing was removed) without competing with the narrative for attention on re-read. Color differentiation lets a player tell at a glance whether a state needs their action versus is a real failure, per Part 14/15. Aligned chrome makes desktop read as one considered layout instead of two mismatched widths. |

Screenshots: `desktop-story.png` (mid-story, both the small per-scene ReplayLink and the full
checkpoint ActionButton are visible in the same shot), `mobile-story.png`,
`mobile-allowance-exhausted.png` (the one quota/error-state screenshot, showing the new `warning`
color live).

## Characters / Character Chat

| | |
|---|---|
| Previous issue | Every character card carried a redundant top border directly under a section heading that already separated it. "Remember in story" state had no server-truth backing — after a reload, an already-promoted fact re-offered promotion (ux-audit.md P0-3), and once promoted, the pill was visually identical (just disabled) to its own pre-promotion state. |
| Change made | First character card's redundant border removed. `openCharacterChat`'s underlying read (`loadThread`) now joins `canon_facts` on the same `(source_chat_message_id, source_chat_candidate_index)` key the promotion RPC already uses for idempotency, and reports `promoted` per candidate — a reload now shows a stable "Remembered in story" pill with a distinct `success`-colored border/text at full opacity (previously washed out by `disabledOpacity`), rather than reverting to "Remember in story". |
| Usability rationale | The player's mental model — "I already told them to remember this" — now matches what actually happened, using server truth rather than client-only state that resets on reload (no duplicate canon facts, no fake persistence). |

Screenshots: `desktop-characters.png`, `desktop-character-chat.png`, `mobile-character-chat.png` — all
three show the post-reload `promoted: true` state (mocked from server truth, not client optimism), so
this evidence directly demonstrates the P0-3 fix, not just the pre-promotion state.

## What was deliberately left alone

- The reading column's max-width cap on desktop is contractually required (`docs/UX_CONTRACT.md`
  §11) and was not touched — "desktop feels sparse" was addressed by aligning the surrounding chrome
  to that column, not by widening it.
- No scene-transition/motion work was added. `docs/MOTION_GUIDELINES.md` specifies a contract for it,
  but nothing animates today, so nothing regresses — see `handoff/LW-W5-R1/HANDOFF.md` Known
  Limitations for the reasoning on why this was left for a future pass rather than implemented under
  audit-driven time pressure.
