# UX Contract

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2)

This document specifies **behavioral contracts**, not visual design. Anything stated as "must" is
a testable requirement an implementation agent should be able to build against without further
product input.

## 1. Mobile Reading Hierarchy (P1, P7)

- Story text is the dominant visual element on the Story Reading View at all breakpoints.
- Persistent chrome (top bar, tab bar, safe-area insets) must together occupy **no more than ~15%
  of viewport height** on mobile while in the reading view. Navigation elements not needed for
  reading (tab bar) should collapse/hide on scroll into story text where the platform allows it,
  reappearing on scroll-up or at rest.
- The scene image (when present) sits above the text, sized so at least 3 lines of story text are
  visible below it without scrolling on a standard mobile viewport (~375×812).
- Choice buttons and the custom-action composer sit below the text, always reachable without
  obscuring the text being read (composer is anchored to the bottom, not overlapping mid-text).

## 2. Multiline Composer (P7) — Direct Fix for Research Pain Point

Applies to: custom story actions, character chat messages, Advanced Setup free-text fields.

- **Auto-grow**: textarea height grows with content up to **7 visible lines**; beyond 7 lines it
  becomes internally scrollable (the composer itself does not keep growing and pushing controls
  off-screen).
- **Minimum height**: 1 line collapsed/empty state.
- **Enter key**: inserts a newline. It never submits.
- **Send**: an explicit, always-visible Send button/icon. No gesture-only or keyboard-only submit
  path on mobile.
- **No horizontal scrolling** under any input length — text must wrap.
- **Long paste**: pasting arbitrarily long text must not push Send/other controls off-screen or
  off-viewport. If pasted content exceeds a soft limit (e.g., ~4000 characters), the composer
  scrolls internally; surrounding layout (header, choice buttons, tab bar) stays fixed and
  reachable.
- **Editing**: cursor placement, selection, and standard OS text-editing gestures (double-tap
  select word, etc.) must work normally — no custom text-rendering that breaks native editing.
- **Unicode and IME safety** *(added by LW-M0-R2)*. The composer must behave correctly for
  non-Latin and composed scripts:
  - Input-method composition (Vietnamese Telex/VNI, Chinese/Japanese/Korean candidate selection)
    must never be interrupted or committed early by the composer's own key handling. Because
    Enter = newline rather than Send (§3), Lorewish avoids the worst form of this bug — an IME
    confirmation keystroke firing a submit — but auto-grow, character counting and any key
    interception must still leave composition events untouched until composition ends.
  - Character counts and any soft limits count **grapheme clusters**, not UTF-16 code units, so
    accented Vietnamese characters, CJK text and emoji are not penalised or truncated mid-glyph.
  - Line-height and auto-grow measurement must accommodate taller scripts (diacritic stacking in
    Vietnamese, CJK glyph heights) without clipping — the 7-line ceiling is a line count, not a
    fixed pixel height.
  - Text storage, transport and generation context are UTF-8 end to end; no lossy normalisation of
    player-authored text.

  This is not a localisation feature and is not deferred with the translated UI. The alpha cohort
  is expected to include Vietnamese speakers who will type Vietnamese into an English UI
  ([PRODUCT_VISION.md](PRODUCT_VISION.md) §10), and this is the exact surface the product claims
  as a differentiator (P7).

## 3. Keyboard Behavior

- Opening the composer must not cover the composer itself or the Send control on any tested device
  (the view resizes/pans so the active input and Send button remain above the keyboard).
- Story text does not reflow/jump unexpectedly when the keyboard opens; only the composer area and
  space below it adjust.
- Dismissing the keyboard (tap outside, or explicit dismiss) must not lose unsent composer text.
- On web (desktop and mobile web), Enter = newline and Shift+Enter is also newline (no special
  meaning); Send remains button-only for consistency with native apps — do not introduce a
  keyboard-submit shortcut that behaves differently across platforms.
- **Desktop send accelerator** *(added by LW-M0-R2, optional)*: `Ctrl+Enter` / `Cmd+Enter` MAY
  submit on desktop web. This does not weaken the contract above — Enter and Shift+Enter still
  insert newlines on every platform — and it restores a convention desktop users of every
  comparable text surface expect. It must remain an accelerator for an action that is always
  reachable by button, never the only way to send. Flagged as a **hypothesis worth testing in
  Alpha**, not a settled requirement: a button-only desktop composer is a defensible choice for
  deliberate long-form story actions, but it is a choice made without evidence.

## 4. Story Setup — Quick Start

- Single field: free-text premise (multiline composer per §2, no character-count anxiety UI beyond
  a soft counter).
- One primary action: "Start." No required secondary fields.
- Time-to-first-scene target: under 15 seconds of user effort (typing + one tap), independent of
  AI generation latency (which is a technical, not UX, budget — see
  [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)).
- A generation-in-progress state must be shown (not a blank screen) while the first scene
  generates.

## 5. Story Setup — Advanced Setup

Fields (all optional except premise, so the form degrades gracefully toward Quick Start if a user
abandons fields):

| Field | Type | Notes |
|---|---|---|
| Premise | multiline text | required |
| World / setting | multiline text | |
| Genre | single-select | Fantasy / Romance / Adventure / Mystery / Sci-fi / Comedy / Slice of Life |
| Player role | short text | e.g. "a wandering healer" |
| Main character(s) | repeatable structured entries | name, short description; maps to Character records at creation (see [DOMAIN_MODEL.md](DOMAIN_MODEL.md)) |
| Starting situation | multiline text | |
| Tone | single-select | e.g. Light / Balanced / Dark |
| Narrative POV | single-select | Second person ("you") default; first/third available |
| Randomness level | single-select | Narrative (none) / Adventure (light rolls) — RPG mode reserved for post-MVP |
| AI freedom | single-select (Low/Medium/High) | **UNDERSPECIFIED — see note below.** Intended meaning: how strictly generation must adhere to the structured fields vs. improvise |
| Story language | single-select | *(added by LW-M0-R2)* Language the story is generated in; defaults from device locale, independent of UI language. See [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8 |

> **On "AI freedom" (LW-M0-R2).** This is the weakest field in the set. It has no defined
> behaviour — nothing in any document states what Low, Medium or High actually change in prompt
> construction, no research pain point asked for it, and its effect is close to unobservable to a
> user comparing two runs. It is a plausible-sounding control that costs a form row, a schema
> column, prompt-construction branching, and three variants to test.
>
> **Recommendation: cut it from MVP** unless the owner can state its concrete generation
> behaviour. If retained, it must ship with a written definition of what each level does. It is
> retained in this table pending that owner decision rather than deleted unilaterally, because it
> came from the original brief. Tracked as a deferred question in
> [M0_R2_REVIEW.md](M0_R2_REVIEW.md).

- Form must be resumable (draft autosaved) — abandoning mid-form and returning later restores
  entered values.
- Submitting generates a first scene using the structured fields as generation context, not as a
  single concatenated free-text blob (fields remain structured in the prompt-construction layer so
  they can also populate canonical Character/World records directly).

## 6. Editable Story Configuration (Mid-Story)

- Same field set as Advanced Setup, reachable from the Story Reading View via a single
  non-obtrusive control (not a permanently visible button).
- **Editable at any time**: tone, AI freedom, randomness level, world/setting flavor text,
  player-facing display fields (e.g., how a character's name is *shown*).
- **Editable with a warning if canon facts already depend on it**: player role, main character
  identity/relationship fields, premise — editing after canon facts reference the old value shows
  an inline warning ("this may create inconsistencies with events already in your story") but does
  not block the edit. See [DOMAIN_MODEL.md](DOMAIN_MODEL.md) for the canon-safety mechanism this
  warning is based on.
- **Not editable retroactively**: past scene text and already-recorded canon facts/branch history
  are never silently rewritten by a config edit; edits apply forward from the current scene only.

## 7. Story Reading / Choice Interaction

- Predefined choices render as tappable buttons above or adjacent to the composer.
- The custom-action composer is **always available**, never hidden behind a "more options" affordance,
  even when predefined choices are present (per research: free-text interaction is core to the
  wedge, not a secondary path).
- Selecting a choice or submitting a custom action immediately shows a generation-in-progress state
  (never a frozen/unresponsive screen).
- Roll feedback (Adventure mode) appears inline between the action and its narrative consequence,
  not as a separate screen (see [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md)).

## 8. Character Chat Surface

- Reached from the story (contextual entry point) or from a character's profile (standalone
  entry point) — both must land on the same chat thread/state for that **character + run +
  active branch**. *(Corrected by LW-M0-R2: the previous "character+run" scoping left undefined
  what happens to a chat thread after the player forks a new branch from a checkpoint. Threads are
  branch-scoped; see [CORE_LOOPS.md](CORE_LOOPS.md) §3.)*
- Promotion of a chat message into canon is **always an explicit player action**. The app may
  surface a non-blocking "Remember this?" affordance; it must never promote silently. A promoted
  memory must be visible in Shared Memories immediately, and reversible.
- Composer rules identical to §2 (shared component, not a re-implementation).
- Character profile is reachable from the chat header at all times.
- Shared Memories is a distinct, visible section on the profile (not buried in settings) listing
  canon facts/memories relevant to this character for the player's current run.

## 9. Branch / Replay UX

- From any checkpoint (auto-created at meaningful consequence points, not every single message),
  the player can view a checkpoint list and select "replay from here."
- Replaying creates a **new branch** of the run; the prior branch remains accessible (not deleted)
  so players can compare/return.
- The UI must make clear which branch is currently active (e.g., a persistent, unobtrusive branch
  label), since P3 explicitly tracks branch history as canonical state.

## 10. Category / Tag Discovery (MVP Scope)

- Home/Discover shows a flat, filterable list. Filter chips for the 7 launch categories (P8) plus
  key tags (Roleplay, Choices Matter, RPG, Cozy, Dark, Short, Long).
- No search bar in MVP (explicitly deferred to M6) — filter chips only, to avoid building
  search-relevance logic before there's enough content to search.
- Category and tag values are **stable locale-independent keys** with separately localizable
  display labels (P8) — never stored or queried by their English display string.
- Filtering is client-applied over a small fetched set in MVP (dataset size does not yet justify
  server-side search infrastructure).

## 11. Responsive Expectations

| Surface | Requirement |
|---|---|
| Android phone | Full native behavior per this contract; hardware back button navigates the app stack (not exit-app) except at Home. |
| iPhone | Full native behavior per this contract; respects safe-area insets (notch/home indicator) for composer and bottom nav. |
| Desktop web | Reading view uses a constrained max-width reading column (not full bleed) to keep line length readable; Enter/Shift+Enter both = newline (§3); no hover-only affordances for actions available on touch platforms. |
| Mobile web | Same contract as native mobile (§1–§9) via responsive layout, not a separate cut-down experience; keyboard-safe layout is especially load-bearing here since mobile browser viewport resize behavior is less predictable than native. |

All four surfaces share one design system and one composer implementation — no platform-specific
UX regressions (e.g., mobile web must not silently fall back to a single-line input).
