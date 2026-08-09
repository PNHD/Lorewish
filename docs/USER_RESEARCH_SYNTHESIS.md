# User Research Synthesis

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2)

## Source and Limits

This synthesis is derived from qualitative user feedback observed on an **adjacent Vietnamese
interactive-story product** (not Lorewish itself, no telemetry from Lorewish exists yet). It is
directional evidence about the category, not validated data about Lorewish. No personal
identifiers (names, emails, handles) from the source feedback are reproduced here. No competitor
metrics are cited because none were supplied — do not treat anything below as quantitative.

## 1. Jobs To Be Done

- **JTBD-1**: "When I want a tabletop-style story experience but have no group, help me play it
  solo so I don't have to wait for or coordinate other people."
- **JTBD-2**: "When I have a world/character in my head, help me see and interact with it, so I can
  visualize a story I already imagined."
- **JTBD-3**: "When I'm stuck creatively, help me generate story ideas/directions I wouldn't have
  thought of."
- **JTBD-4**: "When I'm mid-story, let me talk directly to a character as themselves, not just
  advance plot text."
- **JTBD-5**: "When I make a choice, let me see it actually change what happens next, and let the
  world keep remembering it later."
- **JTBD-6**: "When I start a story, let me control what role and situation I'm placed into, rather
  than accepting whatever the AI assigns."
- **JTBD-7**: "When I'm writing a long action or message, give me an editor that behaves like a
  normal mobile text box, not a constrained single-line field."

## 2. Positive Signals (What to Preserve/Amplify)

| Signal | Interpretation |
|---|---|
| Playing DND-like content solo, without a group | Validates the primary wedge directly |
| AI roleplay / talking directly to characters | Validates character chat as first-class (P5) |
| Making decisions with real consequence | Validates choice-driven branching as core loop |
| Chance / dice-roll mechanics | Liked as **optional texture**, not requested as a full rules system |
| AI remembering prior information | Validates canonical state investment (P3) as differentiator |
| Visualizing a story already in the user's head | Validates Advanced Setup / structured world input |
| Using the system to generate fiction ideas | Validates AI-assisted drafting during creation |
| Ability to create and branch/fork stories | Validates lightweight creation + replay, informs later creator loop |
| Novelty of the interaction model | Category is still fresh; UX polish and identity matter for word-of-mouth |
| Polished UI | Users notice and reward production quality, not just AI capability |
| Desire for native Android | Confirms P9 (native from the first slice), not a web-wrapped app |

## 3. Pain Points (Verbatim Themes, Not Verbatim Quotes)

1. **Shallow story creation setup.** Users want control over genre, world, player role,
   characters, starting scene, initial context, and narrative direction — not just a one-line
   premise.
2. **Unwanted AI-assigned role or starting scene**, with no easy way to change it after the fact.
3. **Story settings aren't editable** after a story has started.
4. **AI pronoun/address/relationship inconsistency** — the single most direct evidence for
   investing in structured character identity (P4) rather than longer prompts.
5. **Character chat deserves a standalone surface** — currently bundled into the main story flow
   in the reference product, users want it separated.
6. **Long-text input UX is broken**: one-line composer, horizontal scroll, Enter-sends-instead-of-
   newline, pasted text pushing controls off-screen, hard-to-edit long prompts.
7. **Excessive top chrome** crowds out reading space; story content should dominate.
8. **Generated images inconsistent quality.**
9. **No category/genre sorting** for discovery.
10. **Requests for optional rewarded ads** in exchange for credits (users self-identifying a
    monetization mechanism they'd accept).
11. **Repeated, unprompted requests for native Android.**
12. **Random roll mechanic is liked** — reinforces #Positive Signals, not a pain point itself.
13. **Reported story bugs** (unspecified) — signal that reliability/consistency needs explicit
    QA attention, not just feature richness.

## 4. Product Opportunities

| Opportunity | Traces to |
|---|---|
| Two-speed story setup: Quick Start + Advanced Setup | Pain #1, #2 |
| Editable story configuration mid-story | Pain #3 |
| Structured character identity fields (pronouns, forms of address, relationship) as data, not prose | Pain #4 |
| Standalone "Talk to Character" surface with profile + shared memories | Pain #5, Positive: character chat |
| Rebuilt composer: auto-grow textarea, Enter = newline, explicit Send, keyboard-safe layout | Pain #6 |
| Minimal top chrome, reading-first layout | Pain #7 |
| Curated or better-constrained image generation, scoped to key scenes (not every message) | Pain #8 |
| Genre/category taxonomy at launch | Pain #9 |
| Optional rewarded ads as an explicit, non-forced monetization lever | Signal #10 |
| Android as a first-class target from the first vertical slice | Pain #11 |
| Light roll mechanic (not a full RPG system) as an optional story-mode toggle | Positive: dice, Pain: avoid over-scoping |

## 5. Risks

- **Scope creep risk**: nearly every pain point plausibly justifies a large feature (full RPG
  system, full creator studio, full recommendation engine). The evidence supports *addressing the
  pain*, not building the maximal version of the fix — see [MVP_SPEC.md](MVP_SPEC.md) for the
  deliberately narrow cut.
- **Single-source risk**: all evidence comes from one adjacent product's userbase (Vietnamese
  market). Genre preference, monetization tolerance (rewarded ads), and taste may not generalize
  globally without validation. **This is the single most load-bearing limitation in this
  document.** Two distinct claims must not be conflated: (a) *the category pains are real* —
  broken composers, inconsistent pronouns and unwanted assigned roles are mechanical failures that
  are very unlikely to be region-specific; (b) *the stated preferences generalize* — rewarded-ad
  tolerance and genre mix are cultural and monetization-market-specific, and should be treated as
  **untested outside the source market**. Lorewish is designed as a global product
  ([PRODUCT_VISION.md](PRODUCT_VISION.md) §10); this evidence base does not license
  region-specific product architecture in either direction.
- **Ad-tolerance evidence is especially narrow.** Pain #10 (users requesting rewarded ads) comes
  from users of a product with a particular pricing model in a particular market. Effective ad
  revenue per user varies by an order of magnitude across geographies, so a self-reported
  preference from this cohort predicts *acceptance* far better than it predicts *revenue*. See
  [DECISIONS.md](DECISIONS.md) D11 (revised).
- **"Story bugs" is underspecified** — without reproduction detail, we can't derive concrete
  requirements from it beyond "invest in QA / state-consistency testing," which is reflected in
  [DOMAIN_MODEL.md](DOMAIN_MODEL.md)'s idempotent-generation design.
- **Image quality complaints** have no diagnosis (model choice? prompt construction? user
  expectation mismatch?) — treated as a reason to scope image generation conservatively in MVP
  rather than a spec for a specific fix.
- **Rewarded-ad request is a stated preference, not a monetization proof** — see
  [MVP_SPEC.md](MVP_SPEC.md) monetization hypothesis; still a hypothesis to test, not a committed
  revenue plan.

## 6. Prioritized Requirements (Feed Into MVP_SPEC.md)

> **Naming note (LW-M0-R2).** These tiers were originally labelled `P0/P1/P2`, which collided with
> the product-principle namespace `P1`–`P10` defined in
> [PRODUCT_VISION.md](PRODUCT_VISION.md) §9 — `P1` meant "reading-first principle" in one document
> and "priority tier 1" in this one. They are now `R0/R1/R2` ("requirement tier").

**R0 (blocking for MVP credibility):**
- Auto-grow multiline composer with explicit Send, Enter = newline, keyboard-safe layout, no
  layout breakage on long paste (P7, [UX_CONTRACT.md](UX_CONTRACT.md)).
- Quick Start creation flow.
- Advanced Setup with at minimum: premise, world/setting, genre, player role, main character(s),
  starting situation.
- Editable story configuration after story start (within technical safety limits — see
  [DOMAIN_MODEL.md](DOMAIN_MODEL.md) canon-safety notes).
- Structured character identity fields (pronouns, forms of address, relationship to player) used
  in generation context.
- Reading-first layout with minimal persistent chrome.

**R1 (MVP, high value):**
- Standalone character chat surface with profile and shared memories.
- Light roll/chance mechanic as an optional, toggleable story mode.
- Genre/category taxonomy for the story list.
- One static scene image per key scene/checkpoint.

**R2 (explicitly deferred past MVP, tracked for later milestones):**
- Rewarded ads and user-facing credit ledger (M4 — moved earlier by LW-M0-R2; see
  [ROADMAP.md](ROADMAP.md)).
- Publishing/branching by other users, creator analytics (M5).
- Full discovery/recommendation (M6).
- Any deeper RPG system beyond light rolls (post-M3, evidence-gated).
