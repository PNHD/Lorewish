# LW-W5-R1 — UX Audit

Method: local web build (`npx expo start --web`) walked via accessibility-tree reads and rendered
text extraction at desktop (1280×720), 375×812 (Pixel-7-class), and 360×780 viewports, cross-checked
against source for every screen in `src/screens`, `src/features/story-setup`,
`src/components/reading`, and the relevant Supabase edge function / migration for anything that
looked like a client-only workaround. Pixel screenshot capture (`computer.screenshot`) was
unavailable in this session — the Browser pane did not composite frames non-interactively. All
findings below are evidence-backed by rendered DOM/accessibility-tree output or source, not
guesswork; screenshot capture is retried in Part 24 and the visual-review doc notes the outcome.

Baseline audited: `feature/lw-w5-product-ux` at `f608f0d` (origin/main, LW-W4 merge), before any W5
change.

Overall impression: this codebase is materially more mature than a typical "prototype" baseline.
`docs/UX_CONTRACT.md` and `docs/MOTION_GUIDELINES.md` are detailed, behaviorally testable contracts,
and the current implementation already honors most of them precisely (five-channel scene rendering,
fixed vertical order, non-blocking allowance framing, branch-scoped chat, EN/VI copy parity, no
numeric cost badges). W5 work should tighten and finish, not rebuild.

## P0 — usability defects (must fix)

### P0-1. Home foregrounds `/preview` as a second primary CTA
`src/screens/home/index.tsx:75-93` renders "Open the offline preview" as a full-size pill button with
its own caption, visually equal in weight to "START A STORY". The new product direction is explicit
that `/preview` is internal QA/demo infrastructure and must not be foregrounded. A first-time visitor
currently has two equally weighted "start" buttons and no way to tell which one is the product.
**Fix**: keep exactly one primary action (Start a Story); demote preview to a small, clearly
secondary/internal link or remove it from Home's primary path entirely.

### P0-2. Vietnamese address-term summary is unlabeled and ambiguous
`src/features/story-setup/advanced-setup-form.tsx:134-136` renders the resolved preset as
`Object.values(...).join(" · ")`, e.g. for `tôi_cậu`:
```
tôi · cậu · tôi · cậu
```
confirmed live in the running app (Advanced Setup → Tiếng Việt → Cách xưng hô tiếng Việt). This is
four unlabeled tokens where two pairs are identical strings in a different role ("tôi" as
speaker-self vs. "tôi" as target-self). A Vietnamese-fluent player cannot recover which slot means
what without already knowing the underlying `speakerSelfReference` / `speakerAddressesTargetAs` /
`targetSelfReference` / `targetAddressesSpeakerAs` model. This is exactly the confusion the new spec
calls out by name. **Fix**: render the four slots as four labeled rows (e.g. "Character calls you /
Character calls themselves / You call Character / You call yourself" or the closer Vietnamese
framing), reusing the same `ADDRESS_PRESETS` data — no change to the preset model itself.

### P0-3. "Remember in story" re-offers promotion after reload despite idempotent server truth
`src/screens/play/character-chat.tsx:33` tracks promoted memory candidates in
`useState<Set<string>>(new Set())` — pure client state, reset to empty on every mount/reload.
`promoteChatMemory` (`src/lib/character-chat.ts:69-79`) calls the `lw_promote_chat_memory` RPC, which
**is** already idempotent server-side: `supabase/migrations/20260811075526_..._roleplay_chat_runtime_characters.sql:510-512`
short-circuits and returns the existing `canon_facts` row when one already exists for that
`(source_chat_message_id, source_chat_candidate_index)` pair — so calling promote twice is safe, but
nothing tells the client this already happened. `SupabaseCharacterChatRepository.loadThread`
(`supabase/functions/_shared/engine/supabase-chat-repository.ts:55-90`) returns raw
`character_chat_messages` rows including their `memory_candidates` JSON, with no join against
`canon_facts` to report which candidates are already canon. Result: after a reload, a
already-remembered fact shows "Remember in story" again instead of "Remembered in story", even
though clicking it again is harmless (it just re-returns the same row) — the bug is purely a missing
read, not a double-write risk. **Fix scoped in Part K below** (server truth, additive, no schema
change).

## P1 — product polish

### P1-1. Replay-from-here affordance density on long stories
`src/screens/play/run.tsx:257-265` renders a full-width "Replay from here" secondary button under
**every** historical scene in the reading view (not just the current one). On a story with many
scenes this becomes a repeated, always-visible control competing with narrative on every scroll
screenful — exactly the density problem the spec flags. Discoverability must be kept; visual noise
should drop (hover-revealed on desktop, a subtler affordance on mobile, or folding non-current-scene
replay into a lighter-weight control).

### P1-2. No hover/focus-visible treatment anywhere on web
Every interactive `Pressable` in the app (`choice-list.tsx`, `action-button.tsx`, `composer.web.tsx`,
`characters.tsx`, character-chat bubbles, setup pills) only branches on `pressed`. There is no
`onHoverIn`/`onHoverOut` or `:focus-visible`-equivalent styling anywhere in `src/` (confirmed by
grep — zero matches for hover/focus state beyond the unused `interactiveState.hoverOverlay` token
defined in `src/theme/tokens.ts:114` and never referenced elsewhere). On desktop web this means (a)
no visual affordance that a control is interactive before clicking, and (b) keyboard-only navigation
has no visible focus ring beyond whatever the browser UA default supplies through React Native Web,
which is inconsistent. This is both a desktop-polish gap (Part 17) and an accessibility gap (Part 19).

### P1-3. Color roles incomplete for coherent quota/error differentiation
`src/theme/tokens.ts` `SemanticSurfaces` defines `danger` but no `warning`, `success`, or `focus`
role. Part 14/15 asks for a coherent, differentiated treatment of near-limit / personal-exhausted /
beta-capacity-reached / recoverable-error states — right now every one of those (see
`run.tsx:278-302`, `character-chat.tsx:143-154`) renders with the same neutral label/caption
treatment with no color differentiation at all, and there is no `warning` token to reach for even if
a screen wanted one. Needs additive tokens, not a new palette.

### P1-4. No motion implementation despite a detailed motion contract
`docs/MOTION_GUIDELINES.md` specifies scene transitions, choice micro-feedback, and — critically — a
Reduce Motion fallback path. None of it exists yet: no scene fade/slide on turn resolution, no
`AccessibilityInfo`/`prefers-reduced-motion` detection anywhere in `src/` (confirmed by grep), no
motion tokens in `src/theme/tokens.ts`. Currently the only "motion" in the app is the existing
`pressedOpacity` state change. This is a real gap against the contract, not a regression — nothing
currently violates Reduce Motion because nothing animates yet.

### P1-5. Border/card treatment is heavier than the "no excessive borders/cards" target
Every choice (`choice-list.tsx`), every character-directory entry (`characters.tsx:59`), every chat
bubble (`character-chat.tsx:120`), and every Advanced Setup field is its own 1px-bordered box. None
of this is wrong individually — it's legible — but stacked together (e.g. Character directory: every
entry gets its own top border *and* the "Talk to character" pill gets its own bordered container) it
reads closer to a card-heavy admin list than restrained in-world chrome. Worth thinning selectively
(spacing/typography doing more of the separation work instead of borders), not a rewrite.

### P1-6. Desktop chrome is minimal to the point of feeling like stretched mobile
Confirmed by reading every screen: the only chrome on any screen is a single header row (back link +
language switcher) plus the reading column, centered with wide empty margins on desktop viewports.
The reading-column width cap itself is correct and contractually required
(`docs/UX_CONTRACT.md` §11) — the gap is that nothing in the surrounding chrome signals "this is a
considered desktop layout" versus "a mobile page that happens to be centered on a wide screen".
Addressable with background/frame treatment around the column, not by widening the column.

## P2 — optional polish

### P2-1. Account/auth surface is functionally fine, cosmetically plain
`src/screens/account/index.tsx` is a standard email/password form; no defects found, no changes
required by the closeout gate. Left alone except for any shared token/hover-state normalization that
naturally flows through.

### P2-2. Accessible names rely on implicit text-content fallback
`OptionRow`/`ChoicePill` radios (`new-story.tsx`, `advanced-setup-form.tsx`) don't set an explicit
`accessibilityLabel`; the accessibility tree read during this audit did resolve their visible text
correctly as the accessible name in every case tested, so this is not a confirmed defect — noted only
because it's a common place for regressions to hide. No action required unless the accessibility pass
(Part 19) turns up an actual failure.

## What's already solid (do not redesign)

- Five-content-channel scene rendering (`story-scene-section.tsx` + friends) matches
  `UX_CONTRACT.md` §1A exactly: fixed vertical order, dialogue distinguished by weight/indentation
  (not chat bubbles), state changes in a separate collapsible chip, no bracketed notation in prose.
- Composer (`composer.web.tsx`, `composer-shared.ts`) already implements auto-grow, Enter=newline,
  explicit Send, the Ctrl/Cmd+Enter desktop accelerator guarded against IME composition, and shared
  behavior between Story and Character Chat. No behavioral changes needed — visual polish only.
  `useAutoGrowHeight` hook shared across both call sites, not reimplemented per surface.
  Verified: no code path clears composer draft text on a non-committed turn (see `run.tsx:117`
  comment; `ALLOWANCE_EXHAUSTED` preserves `composerText`).
  Verified: `ALLOWANCE_EXHAUSTED` / `BETA_CAPACITY_REACHED` are distinct error states end-to-end
  (client + i18n), not collapsed into one generic failure — the copy differentiation Part 14 asks for
  already exists, it just isn't colored/visually differentiated yet (see P1-3).
- EN/VI copy (`src/i18n/locales/en.json`, `vi.json`) is complete, parallel, and already
  non-jargon/non-developer-facing in both languages — verified by reading both catalogs end to end.
  No Supabase/DeepSeek/RLS/provider language leaks into any user-facing string.
- Replay language already uses "Replay from here" / "Current path" / "Alternate path" exclusively —
  no "fork"/"branch"/"version" leakage found in any player-facing copy string.
  `run_branch_id`/`parent_branch_id`/ancestry are never rendered.
- Guest persistence messaging already exists and is appropriately low-key (`setup.guestPersistenceNote`,
  `account.guestPersistence`) — present without alarm framing.
- No horizontal overflow found at 1280px, 375px, or 360px on Home, Quick Start / Advanced Setup
  (EN+VI), or the `/preview` reading screen (`document.documentElement.scrollWidth === innerWidth` in
  all three cases, verified live).
- No console errors observed during the audit walk.
- `CHAT_NON_CANONICAL` separation is intact and stated up front in the Chat header
  (`chat.nonCanonicalNotice`).

## Not audited live (no safe/deterministic way to reach in this pass)

- Real-provider generation failure / safety-rejection screens, and the beta-capacity-reached screen,
  require either a live DeepSeek call or seeded backend state; the audit instead verified these states
  purely through code paths (`run.tsx` `state.kind === "failed" | "allowance_exhausted" |
  "beta_capacity"` branches) and confirmed each renders distinct, correctly-scoped copy. Will be
  smoke-tested for real only in the bounded production smoke pass (max 8 real attempts), not spent
  here.
- Long-story scroll stability with many real scenes: the deterministic `/preview` fixture only has 5
  nodes, insufficient to exercise long-session scroll. `run.tsx`'s scene list renders unbounded
  history in one `ScrollView` with the composer anchored outside it as a sibling (never clipped
  mid-scroll) — reasoned about via code, will be additionally checked against a longer locally-seeded
  run during the Story Reader work in Part G/N.
