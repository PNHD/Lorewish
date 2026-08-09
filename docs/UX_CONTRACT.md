# UX Contract

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2; readability, branch language, allowance UX and the
"AI freedom" removal by LW-M0-R3)

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

## 1A. Scene Readability Contract (P1) — *added by LW-M0-R3*

§1 governs how much of the viewport story text gets. This section governs **what is allowed inside
it**. The driver is owner-observed evidence that narrative content and game-state information
competing in one visual field makes a story hard to parse
([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4.1).

### The five content channels

A story turn renders as up to five distinct, visually separated channels. They are different kinds
of information and must never be blended into one block of text.

| Channel | Contains | Presentation rule |
|---|---|---|
| **NARRATIVE** | Scene prose | The hero. Reading typeface, full reading column, highest visual weight on the screen. |
| **DIALOGUE** | Character speech | Inside the narrative flow with clear speaker attribution. Visually distinguished from surrounding prose (e.g. weight or indentation), but **not** rendered as a chat-bubble transcript — this is a story, not a messaging app. |
| **SYSTEM / STATE CHANGE** | Flag changes, relationship movement, inventory changes, "this was remembered" | A **separate, compact component** below the narrative. Never prose, never inline. |
| **ROLL RESULT** | Outcome band from a light roll | Its own inline component between the action and its consequence ([MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) §6). |
| **PLAYER ACTION** | The choice taken, or the custom action typed | Visually attributable to the player and distinct from AI narrative. A player must always be able to tell their own words from the story's. |

### Hard rules

- **State notation never appears inside prose.** No `[Relationship +1]`, no `(You gained: a rusty
  key)`, no stat brackets, no inline flag names. If a state change happened, it renders in the
  SYSTEM channel. This is testable: scene prose contains no bracketed mechanical notation.
- **Fixed vertical order**, so the layout is learnable rather than re-read each turn:
  `player action → roll result (if any) → narrative → state change (if any) → choices → composer`.
- **Narrative is never below a system component.** When a turn resolves, the newly generated prose
  is the first thing the eye lands on.
- **One narrative block per turn.** Not a stream of fragments, not a feed.

### Chunking and pacing

These are **presentation and pacing expectations, not truncation rules**. No hard word ceiling is
imposed, because a cap that fights the story is a worse defect than a long scene.

- Prose is delivered in paragraphs of roughly 40–90 words — readable chunks on a ~375pt-wide
  viewport, not a single undifferentiated wall.
- A typical scene turn lands around 2–5 paragraphs. Longer is permitted when the story needs it;
  what is *not* permitted is a wall of text with no paragraph structure.
- Line length on desktop web is constrained by the reading column (§11), not full bleed.
- Generation prompts express these as pacing guidance. Nothing truncates model output mid-sentence
  to satisfy a number.

### Progressive disclosure

Used where it reduces competing information, never where it hides the story:

- The SYSTEM/state-change component is **summarised and collapsed** past a small number of items
  ("3 things changed" → tap to expand). The story does not stop to enumerate bookkeeping.
- Shared Memories, inventory detail and branch metadata live on their own surfaces, reachable from
  the reading view, not rendered inline in it.
- **Scene prose itself is never paginated or gated behind a "continue reading" control.** Long
  scenes scroll. A mid-scene control that interrupts prose is exactly the pattern that reads as the
  story stopping ([CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §9).

### When state information becomes its own UI component

Game-state information is promoted out of the reading view entirely — to the story header, a
slide-over, or a dedicated surface — as soon as it is (a) persistent rather than a change, (b)
consulted rather than read, or (c) longer than a few lines. Current inventory, full relationship
values and branch history are all persistent state and none of them belong in the scene body. What
appears inline in the reading view is only the **delta** the turn just produced.

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

Quick Start (§4) and Advanced Setup are the two halves of **P2 — Control Without Complexity**
([PRODUCT_VISION.md](PRODUCT_VISION.md) §9). Neither is the degraded version of the other: Quick
Start is for a user who wants to begin now, Advanced Setup is for a user who arrived with a world
in their head. Advanced Setup is never forced on the first path, and Quick Start never becomes the
only path.

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
| Story language | single-select | *(added by LW-M0-R2)* Language the story is generated in; defaults from device locale, independent of UI language. See [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8 |

> **"AI freedom" was removed from this table (LW-M0-R3).** The Low/Medium/High adherence control is
> **not part of MVP Advanced Setup**. LW-M0-R2 flagged it as underspecified and recommended cutting
> it; the owner has now ruled, and it is cut. The reasoning stands on its own: it is implementation
> jargon, a user cannot predict what Low versus High will concretely do to their story, and no
> research pain point asked for it. A control whose effect the user cannot anticipate is not
> control — it directly contradicts **P2, control without complexity**.
>
> The generation layer **may** retain an internal adherence/policy parameter if it proves
> technically useful ([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §5). That parameter is
> internal, is not a `StoryConfiguration` user field, and is not exposed in any surface. If a
> user-facing version is ever reintroduced, it must be described in **behavioural** language the
> player can predict ("stick closely to my setup" versus "surprise me") and be justified by a
> concrete user model, never by the phrase "AI freedom". See [DECISIONS.md](DECISIONS.md) D25.

- Form must be resumable (draft autosaved) — abandoning mid-form and returning later restores
  entered values.
- Submitting generates a first scene using the structured fields as generation context, not as a
  single concatenated free-text blob (fields remain structured in the prompt-construction layer so
  they can also populate canonical Character/World records directly).

## 6. Editable Story Configuration (Mid-Story)

- Same field set as Advanced Setup, reachable from the Story Reading View via a single
  non-obtrusive control (not a permanently visible button).
- **Editable at any time**: tone, randomness level, world/setting flavor text, player-facing display
  fields (e.g., how a character's name is *shown*). *(LW-M0-R3: "AI freedom" removed from this list
  along with the field itself — see §5.)*
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
  (never a frozen/unresponsive screen). The **previous scene stays rendered and readable** while
  the next one generates — the in-progress state adds to the view, it does not replace it.
- Roll feedback (Adventure mode) appears inline between the action and its narrative consequence,
  not as a separate screen (see [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md)).
- **Every turn resolves into an explicit play state** *(added by LW-M0-R3)*, and what this screen
  is permitted to render is determined by that state — including which state may use ending
  language and which must render recovery actions.
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §2 and §5 are authoritative for the
  reading view and take precedence over any visual-design preference. In particular: a resolved
  turn always renders at least one enabled playable control, the composer is always enabled in
  normal play, and **"to be continued" is prohibited copy in every state**.

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

## 9. Replay UX (Player Timeline Branch)

**User-facing vocabulary is "Replay from here."** *(LW-M0-R3.)* The words *fork*, *remix*, *copy*
and *version* must not appear on any player surface. They belong to the separate creator concept at
M5 ([CORE_LOOPS.md](CORE_LOOPS.md) §4, [DECISIONS.md](DECISIONS.md) D27). "Branch" may appear as a
neutral label for *which timeline you are on*; it is never the name of the action.

- From any checkpoint (auto-created at meaningful consequence points, not every single message),
  the player can view a checkpoint list and select "Replay from here."
- Replaying creates a **new branch** of the run; the prior branch remains accessible (not deleted)
  so players can compare/return.
- The UI must make clear which branch is currently active (e.g., a persistent, unobtrusive branch
  label), since P3 explicitly tracks branch history as canonical state.
- **Replaying lands the player directly in the reading view with an enabled action** *(added by
  LW-M0-R3)*, in one step. It must not terminate on a branch-management screen, a confirmation
  screen, an account wall, or any screen whose primary action is "back to the story". Creating a
  branch is a pure state operation: no generation, no wait, no allowance consumption, no failure
  mode. See [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §6.
- **The player is never asked to understand copies or ownership.** No copy in this flow describes
  duplicating a story, creating a version, or owning a derivative. The mental model the player
  needs is "go back and try something else", and nothing larger.
- A guest run stays playable across a replay; any account prompt is non-blocking and never
  interposed between the tap and the playable scene.

## 10. Category / Tag Discovery (MVP Scope)

- Home/Discover shows a flat, filterable list. Filter chips for the 7 launch categories (P8) plus
  key tags (Roleplay, Choices Matter, RPG, Cozy, Dark, Short, Long).
- No search bar in MVP (explicitly deferred to M6) — filter chips only, to avoid building
  search-relevance logic before there's enough content to search.
- Category and tag values are **stable locale-independent keys** with separately localizable
  display labels (P8) — never stored or queried by their English display string.
- Filtering is client-applied over a small fetched set in MVP (dataset size does not yet justify
  server-side search infrastructure).

### Empty states during a small-content launch *(added by LW-M0-R3)*

Driven by owner-observed evidence that a filter surface can present "no stories" while content
plainly exists elsewhere in the product
([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4.7). At launch Lorewish will have 1–3
sample stories, so this risk is *higher* here than in the product where it was observed.

- **Filter chips are derived from content that actually exists.** A category chip renders only if
  at least one visible story carries that category. The seven-category taxonomy (P8) remains the
  stable key set in the data model regardless of which chips are visible — this is a rendering
  rule, not a taxonomy change.
- **No section, shelf or category is rendered in an empty state** unless the empty state itself
  does useful work.
- Where an empty state is genuinely unavoidable (e.g. "your stories" before the user has created
  one), it must carry a **useful primary action** — start a sample story, or Quick Start — and
  never a bare "nothing here".
- An empty result must never be phrased so it reads as the product being broken or finished.

## 11. Responsive Expectations

| Surface | Requirement |
|---|---|
| Android phone | Full native behavior per this contract; hardware back button navigates the app stack (not exit-app) except at Home. |
| iPhone | Full native behavior per this contract; respects safe-area insets (notch/home indicator) for composer and bottom nav. |
| Desktop web | Reading view uses a constrained max-width reading column (not full bleed) to keep line length readable; Enter/Shift+Enter both = newline (§3); no hover-only affordances for actions available on touch platforms. |
| Mobile web | Same contract as native mobile (§1–§9) via responsive layout, not a separate cut-down experience; keyboard-safe layout is especially load-bearing here since mobile browser viewport resize behavior is less predictable than native. |

All four surfaces share one design system and one composer implementation — no platform-specific
UX regressions (e.g., mobile web must not silently fall back to a single-line input).

## 12. Usage Allowance UX — *added by LW-M0-R3*

MVP has **no payment surface at all** and ships a free daily allowance only
([MVP_SPEC.md](MVP_SPEC.md) §8). This section governs how that allowance is *communicated*, which
is a UX decision independent of whether money is involved. Nothing here is implemented now; it is
recorded so the first implementation does not default into the pattern below.

Driven by owner-observed evidence that a product can visibly attach credit costs to individual acts
of agency — custom actions, character interaction, branching
([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4.6). The competitor's *pricing* is not
being copied or evaluated; only the surfacing pattern is being rejected.

- **The app communicates a usage allowance, not a per-action price.** During normal play the frame
  is "what you have left today", never "what this button costs".
- **No numeric cost is rendered beside** a predefined choice, the custom-action Send control, or a
  character-chat send control. Not as a badge, not as a subscript, not as a tooltip.
- **Rationale, stated so it can be argued with**: a visible price on every act of agency turns each
  choice into a small purchasing decision. That is a direct tax on the two behaviours this product
  most needs — free-text custom actions (D5) and character chat (P5) — and it prices the very
  interactions the wedge depends on. It also frames the player as a meter rather than a
  protagonist, which is the opposite of "enter a world that remembers you".
- **Allowance is discoverable, not ambient**: always visible in Account/Settings; otherwise absent
  from the reading view.
- **A single non-blocking low-allowance indicator** may appear when the remaining allowance is low
  (threshold is configuration, not a constant). It sits **outside the action controls** — never
  attached to a choice or a Send button — and never blocks or delays an action.
- **Exhaustion is a defined play state**, not a wall: `ALLOWANCE_EXHAUSTED` per
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §2. Already-materialized scenes stay
  readable, the reset time is stated, and the framing is non-punitive. This is the one place where
  cost becomes explicit.
- **Branch replay shows no cost of any kind**, because it consumes none (§9).
- Any future per-action pricing display is an **M4 monetization experiment requiring its own
  decision and its own evidence** — never a default, and never introduced because it was easy to
  render. See [DECISIONS.md](DECISIONS.md) D28.
