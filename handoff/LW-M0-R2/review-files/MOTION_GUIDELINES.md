# Motion Guidelines

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-09

Principle (P10): motion should improve immersion in small, cheap ways. It must never be the reason
a low-end device feels slow, a battery drains faster, or a Reduce-Motion user is excluded. **No AI
video, in MVP or planned near-term** — every pattern below is a UI/animation-layer effect on
existing static assets or interface elements, never a generated video asset.

## 1. MVP-Approved Motion Patterns

| Pattern | Where | Notes |
|---|---|---|
| Scene fade/slide transition | Moving from one scene to the next | Single transition, ≤300ms, one direction (forward = new content enters from the reading edge) |
| Scene image pan/zoom (Ken Burns) | Static scene image, at rest | Slow, subtle (e.g., 1.0→1.04 scale over 8–12s), loops or holds — never distracts from text |
| Choice selection feedback | Tapping a choice button | Micro (scale/opacity ≤150ms) confirming the tap registered before generation-in-progress state shows |
| Dice-roll animation | Adventure-mode roll trigger | Short (≤1.2s), resolves to a clear outcome-band result; must be skippable/instant on repeat rolls if a user has Reduce Motion or taps through |
| Mobile haptics | Choice confirm, roll result, relationship update | Light impact only; never on every keystroke or scroll |

## 2. Explicitly Deferred Past MVP

Character idle motion, blink, foreground/background parallax, environmental particles,
branch-unlock celebration animation. These are the lowest value-per-cost items in P10's list for
a solo/small-team MVP: they require additional asset production (idle-motion sprites/rigs) or
layered rendering work with no evidence yet that they affect retention. Revisit only if MVP
retention signals justify further investment in polish (see [ROADMAP.md](ROADMAP.md)).

Relationship-update feedback (a visual/haptic cue when a relationship value changes) is **borderline
MVP** — if trivial to implement as a reuse of the choice-selection feedback pattern plus haptic, it
may ship in M3 alongside character identity work; it is not a hard MVP requirement.

## 3. Performance Budget

- All motion runs on the UI/compositor thread (native driver animations on React Native; CSS
  transform/opacity only on web) — never JS-thread-driven animation for anything listed in §1.
- No motion pattern may hold a frame budget above **16ms** on a mid-tier reference device (a
  3–4 year old mid-range Android, not a flagship) during a scene transition.
- Scene image pan/zoom must not re-decode or re-fetch the image; it animates a transform on an
  already-loaded asset.
- No more than one non-trivial animation (transition, pan/zoom, roll) plays concurrently. Choice
  micro-feedback may overlap with a transition since it's negligible cost.
- Motion must not block interaction — a user can act again (e.g., dismiss/skip) before a
  transition finishes; animations are visual polish, not gates.

## 4. Reduce Motion Behavior

When the OS-level Reduce Motion setting is on (iOS/Android accessibility setting, detected via the
platform API, not a custom in-app-only toggle — though the in-app Settings toggle from
[MVP_SPEC.md](MVP_SPEC.md) §3.9 must offer the same control for web, where OS detection is
inconsistent):

- Scene transitions become instant cross-fades ≤100ms or hard cuts — no slide/motion displacement.
- Scene image pan/zoom is disabled entirely (image renders static).
- Dice-roll animation collapses to an instant result reveal with the same haptic (haptics are not
  considered "motion" and remain unless the user has also disabled haptics at the OS level).
- Choice-selection micro-feedback may remain (it's a state-confirmation cue, not decorative motion)
  but should be reduced to an opacity-only change if scale-based.

## 5. When Animation Is Prohibited

- Never on the composer itself (§2 of UX_CONTRACT.md) — no animated resize beyond the natural
  auto-grow reflow, which must feel immediate, not eased/delayed.
- Never as a blocking step between a user action and its result becoming visible beyond the
  explicit budgets above (a "cute" 2-second forced transition is a UX regression, not polish).
- Never on text content itself (no letter-by-letter reveal / typewriter effect for scene text in
  MVP) — it directly conflicts with P1/reading-first and adds latency perception without evidence
  it helps immersion for this audience. Can be revisited later as an optional style, never default.
- Never during an active AI generation wait beyond a simple, low-cost loading indicator — no
  elaborate loading animation that implies more "work" than a spinner/skeleton communicates
  honestly.
- Never if it would run every time a list re-renders (e.g., no animation-in for every item in the
  Home/Discover list on each visit) — motion is reserved for state changes the user caused, not
  ambient list rendering.

## 6. Dice-Roll Feedback (Detail)

- Trigger: player submits a risky custom action or selects a system-flagged choice in Adventure
  mode.
- Sequence: roll animation (≤1.2s, skippable) → outcome band revealed (success/partial/fail,
  distinguished by color + icon + haptic, not color alone — accessibility) → narrative consequence
  streams in immediately after.
- No animation for Narrative-mode stories (randomness is off; nothing to animate).

## 7. Scene Transition (Detail)

- Forward navigation (advancing the story): new scene content slides/fades in from the reading
  edge (bottom on mobile, consistent with vertical reading flow).
- Backward navigation (branch replay to an earlier checkpoint): a distinct, reversed transition
  direction so the user has a spatial cue they've gone backward in the story, not forward.
- Both directions honor the Reduce Motion collapse in §4.

## 8. Image Pan/Zoom (Detail)

- Applies only to the single static scene image, not to thumbnails in Home/Discover lists (list
  thumbnails are static, no motion, to keep list scroll performance cheap).
- Disabled automatically (not just under Reduce Motion) if the device reports low memory/low-end
  GPU tier where the platform exposes that signal, falling back to a static image with no
  performance cost.

## 9. Haptic Guidance

- Use platform-standard light/medium impact haptics only (no custom haptic patterns in MVP).
- Triggers: choice confirmed, roll result revealed, (optional, if shipped) relationship-update
  cue.
- Never on: text input/typing, scrolling, screen navigation/tab switches, ambient list browsing.
- Respect the OS-level haptics-disabled setting; do not add an in-app override that fights it.
