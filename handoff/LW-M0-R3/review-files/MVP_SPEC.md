# MVP Specification

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2; continuous play, readability and the "AI freedom"
removal by LW-M0-R3)

This defines the smallest vertical slice that tests the core fantasy: *"I can enter a world
quickly, make choices, see consequences, talk to a character who remembers relevant events, and
want to continue."* It spans roadmap milestones **M1–M3** (Foundation → Vertical Slice → Character
Memory). See [ROADMAP.md](ROADMAP.md) for milestone sequencing; this document defines the target
shape, not the delivery order.

## 1. Included Features

1. **Onboarding**: minimal, no account wall to try a sample story (guest session allowed);
   account creation required only to save progress / create a story.
   **Guest generation must be separately capped** *(added by LW-M0-R2)*. An anonymous session plus
   a free daily AI allowance is an unmetered-inference hole: a user who exhausts the allowance can
   discard the anonymous session and start a new one indefinitely, and per-user rate limiting does
   not help when every abuser is a new user. The MVP rule is a **small, device-associated guest
   quota** — enough to reach several consequences and experience the wedge, after which sign-up is
   the natural continuation prompt. The residual risk (device signals are defeatable) is accepted
   at alpha scale but must be revisited before any open/public distribution. Deliberately *not*
   chosen: blocking guests from custom actions entirely — it would protect cost at the direct
   expense of the activation signal the Alpha exists to measure.
2. **Story entry, two paths**:
   - **Sample stories**: 1–3 curated stories, pre-authored, playable immediately.
   - **Quick Start**: single free-text premise field → AI generates a starting scene, world, and
     player role.
   - **Advanced Setup**: structured form — premise, world/setting, genre, player role, main
     character(s), starting situation, tone, narrative POV, randomness level (story mode:
     Narrative/Adventure), story language. See [UX_CONTRACT.md](UX_CONTRACT.md) for field-level
     behavior. *(LW-M0-R3: the "AI freedom" low/medium/high field is **removed** from MVP — see
     UX_CONTRACT §5 and [DECISIONS.md](DECISIONS.md) D25.)*

   Quick Start and Advanced Setup together are **P2 — Control Without Complexity**
   ([PRODUCT_VISION.md](PRODUCT_VISION.md) §9). Both are first-class; neither is a degraded form of
   the other.
3. **Editable story configuration**: after a story starts, the player can revise world, role,
   character, and tone fields for their own run (see [DOMAIN_MODEL.md](DOMAIN_MODEL.md) for what
   remains safely editable vs. locked once canon facts depend on it).
4. **Story reading view**: scene text, optional single static scene image, minimal persistent
   chrome (P1/P7), built to the **Scene Readability Contract**
   ([UX_CONTRACT.md](UX_CONTRACT.md) §1A) *(added by LW-M0-R3)* — narrative, dialogue,
   system/state-change, roll result and player action are five separated channels in a fixed order,
   and mechanical state notation never appears inside prose.
5. **Choice + custom action**: predefined choices rendered as buttons; a free-text composer is
   always available for custom actions (auto-grow, 1–7 visible lines, Enter = newline, explicit
   Send — see [UX_CONTRACT.md](UX_CONTRACT.md)).
6. **Light roll mechanic** (Adventure mode only, opt-in at story creation): single roll
   abstraction, 3 outcome bands, triggered on player-flagged-risky custom actions or
   system-flagged choices. Narrative mode has zero randomness.
7. **Canonical state persistence**: current scene, flags, relationship state, inventory (if
   relevant to genre), forms of address, canon facts — survives app close/reopen.
8. **Character chat surface**: standalone "Talk to Character" screen, character profile (identity
   fields + speaking style), shared-memories view, reachable from the story and from the
   character's profile.
9. **Replay from here**: player can rewind to an earlier scene/checkpoint and choose differently,
   creating a new branch of their own run. *(Renamed by LW-M0-R3 — "Replay from here" is the
   user-facing name; fork/remix vocabulary is reserved for the M5 creator concept.)* Replaying is a
   pure state operation that lands directly in the reading view: no generation, no wait, no
   allowance consumption, no dead-end page. See
   [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §6.
10. **Category browse**: flat list of stories filterable by genre category (Fantasy, Romance,
    Adventure, Mystery, Sci-fi, Slice of Life, Comedy) and basic tags (Roleplay, Choices Matter,
    RPG, Cozy, Dark, Short, Long).
11. **Free daily usage allowance**: a capped number of AI generations/day at no cost, **enforced
    server-side** against a usage counter (see [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §3 — the counter
    is an MVP entity even though the user-facing credit ledger is M4).
12. **Output moderation on the generation path** *(added by LW-M0-R2)*: every
    `GenerationProposal` and `GeneratedAsset` passes a moderation check before it is materialized
    or rendered. The architecture already specifies this
    ([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §5, `moderateContent`) but the feature
    list previously omitted it, leaving it implementable-by-omission. For a 13+ product that feeds
    free-text player input into an LLM, this is a launch requirement in **closed alpha**, not
    something deferred to the public-content milestone.
13. **Account deletion and data export** *(added by LW-M0-R2)*: an in-product path to delete the
    account and its runs. Apple requires in-app account deletion for any app offering account
    creation, and Google Play requires an accessible data-deletion route; the MVP creates accounts,
    so it inherits both obligations. Cheap now, a store-review blocker if discovered late.
14. **Story language** *(added by LW-M0-R2)*: each Story carries a content language, defaulting
    from the player's device locale and independent of the UI language. A Vietnamese-speaking alpha
    tester can play a Vietnamese-language story inside an English UI. See
    [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8.
15. **Continuous play** *(added by LW-M0-R3)*: every interactive turn resolves into exactly one
    explicit application state — `CONTINUE_READY`, `EXPLICIT_CHECKPOINT`, `TERMINAL_ENDING`,
    `GENERATION_FAILED` or `ALLOWANCE_EXHAUSTED` — and a normal turn always remains playable. A
    generated segment ending, a provider timeout, a submitted custom action or a created branch is
    **never** presented as a story ending, and "to be continued" is prohibited copy in every state.
    This is a full specification in its own document because it spans client, gateway and
    persistence: [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md). It is listed here
    because a cross-layer invariant absent from the feature list is implementable-by-omission — the
    same reason moderation was added in LW-M0-R2.
16. **Usage allowance communicated as an allowance, not a per-action price** *(added by
    LW-M0-R3)*: no numeric cost is rendered beside any choice, custom-action Send or chat Send
    control during normal play. See [UX_CONTRACT.md](UX_CONTRACT.md) §12. MVP still has no payment
    surface of any kind.

## 2. Excluded Features (Explicitly Out of MVP)

- Publishing a story for other users to discover/play; branch/remix by other users; creator
  analytics (M5).
- Search and personalized/ML-based recommendation (M6).
- Rewarded ads, credit purchases, credit ledger UI, subscription (M4) — free allowance only ships
  in MVP; the paid mechanisms are validated after retention signal, see §8.
- **Any in-product scene or choice editor.** Curated sample stories are authored as seed data by
  the owner, not through an in-product authoring tool (see [CORE_LOOPS.md](CORE_LOOPS.md) §4).
- Deep RPG mechanics: stat sheets, inventory-driven combat resolution, character builds (post-M3,
  evidence-gated).
- Multiplayer / shared sessions.
- Social features: comments, follows, feeds.
- Full AI video generation (never planned as MVP or near-term).
- 18+ content and associated moderation/age-gating (out of scope for the initial product entirely,
  not just MVP).
- **Translated UI** beyond English at launch. Note the distinction sharpened by LW-M0-R2: the
  *i18n scaffolding is in scope from M1* (externalized strings, locale-independent taxonomy keys,
  Unicode/IME-safe input) — only the *translated string catalogues* are deferred. Shipping
  hardcoded UI copy is a violation of this spec, not a deferral of it. See
  [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §12.
- Idle character motion, blink, parallax, particles (see [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md)
  for the MVP-approved motion subset).

## 3. Primary Screens

1. **Home / Discover** — sample + user's own stories, category filter chips, "Create New" CTA.
2. **Quick Start** — single premise input + Start button.
3. **Advanced Setup** — structured multi-field form (see §1.2).
4. **Story Reading View** — scene text, scene image, choice buttons, custom-action composer,
   access points to Character Chat and Story Config.
5. **Story Configuration (editable)** — same fields as Advanced Setup, editable mid-story.
6. **Character Chat** — message thread with one character.
7. **Character Profile** — identity fields, speaking style, relationship to player, shared
   memories list.
8. **Replay Picker** — checkpoint list for the current run, "Replay from here." Selecting an entry
   returns to the Story Reading View ready to act; this screen is a waypoint, never a destination.
9. **Account / Settings** — auth, Reduce Motion toggle, daily allowance status, **account deletion
   (§1.13)**, and a session-end feedback entry point (§5 Tier 1).

## 4. Navigation

- Bottom tab bar (mobile) / left rail (desktop web) with exactly two top-level destinations:
  **Home/Discover** and **Account**. Everything else (Quick Start, Advanced Setup, Story Reading,
  Character Chat, Branch Picker) is reached by pushing into a stack from Home or from within a
  story — not additional top-level tabs. This directly serves P1 (story is the hero; navigation
  chrome must not compete for the viewport).
- Within a story, Character Chat and Story Configuration are reached via a single unobtrusive
  affordance (e.g., a header action or slide-over), not permanent on-screen buttons, to protect
  reading space (P7).
- Back navigation always returns to the exact prior scene without re-fetching/regenerating it.

## 5. Alpha Evidence Model

> **Revised by LW-M0-R2.** The previous §5/§6 stated percentage thresholds (≥60% activation, ≥20%
> D7, <10% D7 = fail) as PASS/FAIL gates. **No Lorewish telemetry exists**, none of those numbers
> was derived from data, and at the planned cohort size — order of tens — they cannot function as
> gates. With ~30 activated users, an observed 20% D7 return is 6 people; a single tester's
> behaviour moves the number by more than 3 points, and the confidence interval comfortably spans
> both the "success" and "failure" thresholds simultaneously. Distinguishing a true 10% from a
> true 20% D7 rate with conventional confidence needs a cohort on the **order of hundreds per
> arm**, not tens. Treating these as gates would manufacture false certainty and risk killing —
> or greenlighting — the product on noise.
>
> Criteria are therefore sorted into four tiers by *what kind of claim they can actually support*.

### Tier 1 — Instrumentation Requirements (HARD GATE, binary)

M3 does not pass unless these exist and are verified correct. This tier is a genuine gate because
it tests engineering completeness, not user behaviour. Without it, every other tier is unmeasurable.

- Events recorded: `signup`, `guest_session_start`, `story_started` (with path: sample / Quick
  Start / Advanced Setup), `first_consequence_reached`, `checkpoint_reached`, `ending_reached`,
  `character_chat_opened`, `custom_action_submitted`, `choice_selected`, `regeneration_requested`,
  `allowance_cap_hit`, `session_start` / `session_end`, `return_visit`.
- *(Added by LW-M0-R3)* `turn_resolved` carrying the resolved play state
  ([CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §2), plus `generation_failed` with
  its failure reason and `branch_created`. Without these, the single failure class this MVP is
  designed against — a turn that stops looking playable — is unmeasurable, and "did any turn fail
  to resolve into a state?" is unanswerable.
- Every event carries: user or guest id, platform (Android / iOS / Web), story id, run id, branch
  id, timestamp (UTC), app version.
- `GenerationAuditLog` records cost, latency, token counts, provider, model **and capability**
  for every AI call (see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §10).
- Cost per active user and cost per retained user are derivable by query without manual work.
- A session-end feedback prompt exists (it is the collection mechanism for Tier 3 and Tier 4 —
  previously assumed by the consistency criterion but never specified as a feature).

### Tier 2 — Hard Failure Criteria (HARD GATE, qualitative/absolute)

These are defensible with a handful of testers because they are correctness failures, not rates.
Any one of these blocks progression regardless of how good the directional numbers look.

- **Canonical state loss is reproducible.** A tester loses story progress, or the app renders
  state contradicting a stored CanonFact, and it reproduces after one bug-fix cycle. This
  invalidates the P3 architecture bet and must be fixed before anything is built on top of it.
- **Any [UX_CONTRACT.md](UX_CONTRACT.md) §2–3 composer contract violation on any of the three
  platforms** — one-line collapse, horizontal scroll, Enter submitting, long paste displacing
  controls, keyboard covering Send. Zero tolerance is appropriate here because it is a *contract
  compliance check*, not a user-behaviour rate, and it is the specific research pain point
  ([USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md) §3.6) the product claims to fix.
- **A platform is effectively unusable** — crash on launch, unrecoverable auth failure, or the
  reading view being unusable on Android, iOS or Web. P9 makes all three first-class.
- **Any [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) violation** *(added by
  LW-M0-R3)* — a turn that resolves with no enabled playable control, a failure or timeout
  rendered as an ending, a "to be continued" string in the shipped copy, a branch replay landing
  anywhere other than a playable reading view, or a failure state surviving a reload. Zero
  tolerance is appropriate for the same reason as the composer contract above: these are
  **contract-compliance checks**, not user-behaviour rates, and each is directly checkable against
  the evidence bar in that document's §10.
- **Moderation escapes** producing content inappropriate for a 13+ product, reaching a tester.
- **A cost-per-active-user figure that makes the product structurally unviable** at any plausible
  revenue per user — see §8. This is a hard gate because no amount of retention fixes it.

### Tier 3 — Directional Signal (NOT a gate; triggers investigation)

Recorded, reviewed, and used to decide *what to investigate next*. **These are hypotheses with
expected ranges, not thresholds.** Missing one prompts a question, never an automatic stop.

| Signal | Expected range (hypothesis, no Lorewish data behind it) | If materially below range |
|---|---|---|
| Activation (start → first consequence) | 50–70% | Investigate the generation wait, the first-scene quality, and the setup step — likely a funnel defect, not a product-value verdict |
| First-session depth (reach checkpoint/ending) | 25–40% | Investigate scene pacing and checkpoint placement |
| Character chat adoption | 20–35% | Investigate discoverability first — a low number more likely means the entry point is hidden than that the feature is unwanted |
| D7 return | 15–30% | The weakest-powered metric of all at this cohort size; treat as a conversation starter with testers, never as a verdict |

The numbers above are the previous document's figures, **re-labelled as ranges and explicitly
demoted from gates**. They remain useful as priors to check intuition against; they carry no
evidentiary weight until Lorewish has its own data.

### Tier 4 — Qualitative Review (HARD GATE on *doing it*, not on its result)

M3 does not pass unless the review happened; its findings are inputs to judgment, not a score.

- At least **8 full sessions** observed directly or reconstructed end-to-end from transcript +
  feedback, spanning all three platforms.
- At least **5 structured exit interviews** covering: did the world feel like it remembered you;
  did any character contradict itself; did you want to come back, and to *what* — the story or a
  character.
- An explicit written check for **language friction** — for any tester who is not a comfortable
  English reader, separate "did not understand the UI" from "did not value the product."
  ([PRODUCT_VISION.md](PRODUCT_VISION.md) §10 records why this confound exists.)
- Every reported pronoun/address/relationship consistency break is logged with the run and branch
  id so it can be traced against stored CanonFacts, since P4 claims this class of bug is
  *architecturally* prevented. A consistency break that traces to correct stored state is a
  prompt-construction bug; one that traces to wrong stored state is a Tier 2 failure.

## 6. Making the M3 Decision

There is no formula. The decision to proceed past M3 is a **product-owner judgment call**, made in
writing, that must record: the Tier 1 verification result, any Tier 2 trigger, the observed Tier 3
values with their cohort size stated alongside them, and the Tier 4 findings. Proceeding despite a
Tier 3 miss is legitimate and expected; proceeding despite a **Tier 2** trigger requires an
explicit written justification of why the failure does not invalidate what M4 would build on.

## 7. Retention Hypotheses (To Be Tested, Not Assumed)

- **H1**: Canonical character memory (vs. prompt-only memory) is the primary driver of D7+ return,
  more than raw content volume.
- **H2**: Users who use Advanced Setup have higher session depth than Quick Start users, because
  they're more invested in a role they chose deliberately.
- **H3**: Users who engage Character Chat at least once in session 1 have higher D7 return than
  those who don't.
- **H4**: The light roll mechanic increases session length in Adventure-mode stories without
  reducing completion rate (i.e., it adds texture, not friction).

## 8. Early Monetization Hypothesis

MVP ships with **no payment surface at all** — a free daily generation allowance only. That part
is unchanged by LW-M0-R2, and deliberately so: nothing may compromise the first session.

What changed is *when the revenue question gets asked*, and *what MVP must measure to make asking
it possible*. The monetization milestone moved from M6 (after publishing and discovery) to **M4**
(immediately after the Alpha retention read) — see [ROADMAP.md](ROADMAP.md) and
[DECISIONS.md](DECISIONS.md) D11 (revised) for the full reasoning. The short version: publishing
and discovery were never prerequisites for charging money, so sequencing revenue behind them was
arbitrary rather than dependency-driven.

### What MVP must measure (free, no payment surface)

These are cost and demand instruments, not monetization features. They cost almost nothing because
the allowance counter and audit log already exist in MVP scope:

- **Cost per active user and per retained user**, by capability — the number that determines
  whether *any* revenue mechanism can work (see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §10).
- **Allowance-cap-hit rate**: how many users reach the free ceiling, how quickly, and what they do
  next (stop, return tomorrow, or churn). A product nobody hits the cap on has no credit demand to
  sell against; a product where most users hit it on day one has a pricing problem, not a
  monetization opportunity.
- **Which capability consumes the allowance** — story prose, chat, regeneration, or images.
  Whichever it actually is becomes the credit sink, measured rather than assumed.

### The bounded M4 experiment

- **One mechanism only.** Rewarded ads *or* a small consumable credit pack — not both, not a
  subscription. Running two at once on a cohort this size measures neither.
- **Mechanism chosen from MVP data, not from research preference.** The rewarded-ad request in
  [USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md) came from one market's userbase and
  predicts *acceptance*, not *revenue*.
- **Honest constraint on what M4 can produce.** Before public store distribution, a closed cohort
  cannot generate real revenue: store IAP in sandbox/internal-testing tracks transacts test money
  only, and serving live ads to a known internal test cohort is contrary to ad-network invalid-traffic
  policy. M4 therefore measures **demand and opt-in intent** against a real, fully-built flow;
  actual revenue is only observable once distribution widens (Beta / Store Release).
- **Compliance is part of the experiment's cost, not an afterthought.** A 13+ audience shipping
  globally with ads pulls in ad content-rating restrictions, regional consent requirements for
  minors, and platform families/ads policy obligations. This is a material reason a credit pack
  may prove *cheaper to test* than ads despite ads being the user-requested mechanism.

### First-session protection (non-negotiable)

- No monetization surface of any kind appears in a user's first session, before first consequence,
  or during an active scene.
- Rewarded ads, if chosen, are opt-in only, from an explicit "watch ad for +N generations" control
  outside the reading flow — never interstitial, never on scene transition (P1, P10).
- Reaching the free cap must degrade gracefully into a clear, non-punitive state, not a hard wall
  mid-scene.
- Subscription remains explicitly out of scope for both MVP and M4's first test.
