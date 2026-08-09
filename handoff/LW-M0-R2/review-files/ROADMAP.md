# Roadmap

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2 — monetization resequenced)

Milestones are scope/evidence gates, not calendar commitments — no dates are assigned in this
document since none were supplied and none should be fabricated. Each milestone must PASS its
evidence bar before the next milestone's scope begins in earnest.

> **Resequencing note (LW-M0-R2).** Monetization moved from M6 to **M4**, ahead of publishing and
> discovery. Publishing and discovery were never technical prerequisites for charging money —
> rewarded ads, a credit pack, and credit-gated regeneration all depend on the usage/credit
> substrate and a payment integration, none of which touch a public library or a search index.
> The old ordering was sequence-by-convention, not dependency-driven, and it deferred the single
> question an owner-funded side project most needs answered.
>
> Milestone numbering changed as follows: **M4 Monetization (new position)**, **M5 Creation +
> Publishing (was M4)**, **M6 Discovery (was M5)**. M0–M3 and M7 are unchanged.

## M0 — Product Definition (this milestone)

- **Goal**: establish a documentation baseline an implementation agent can build from without
  inventing product behavior.
- **Scope**: the docs in this `docs/` directory.
- **Exclusions**: no code, no infrastructure, no external services.
- **Evidence required for PASS**: this document set exists, is internally consistent (see
  Validation section, final response), and has been reviewed by the product owner.

## M1 — Foundation

- **Goal**: a running, empty-ish Expo app on all three platforms, wired to a real (dev) Supabase
  project, with the domain model's core tables in place — no story-playing yet.
- **Scope**: Expo + Expo Router app shell; Supabase project with Auth + initial schema for User,
  Story, StoryConfiguration, Character, World (Authoring Data only); design tokens and the shared
  composer component built to the [UX_CONTRACT.md](UX_CONTRACT.md) spec (testable in isolation,
  e.g., a storybook-style screen); CI that builds all three targets.
- **Exclusions**: no AI gateway calls yet (or a stubbed/mocked gateway only); no PlayerRun/
  StoryState/character-chat schema yet; no monetization.
- **Evidence for PASS**: app installs and runs on an Android device, an iOS device, and a browser;
  a user can sign up, sign in, and see an empty Home screen; the composer component passes its own
  UX_CONTRACT checklist (auto-grow, Enter=newline, keyboard-safe, long-paste-safe, **UTF-8/IME-safe
  with Vietnamese and one CJK input method**) on all three platforms.

### M1 Prerequisites (added by LW-M0-R2) — resolve BEFORE starting M1

These are not M1 scope; they are conditions without which M1 cannot honestly pass its own bar.

1. **iOS build path decided and available.** The owner's machine is Windows; iOS cannot be built
   locally. Either Mac access or a cloud build service, plus a paid Apple Developer Program
   membership for on-device installation. Without this, "runs on an iOS device" is unachievable and
   P9 breaks silently at the first milestone. See
   [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §8.
2. **A `.gitignore` exists** before any application scaffolding lands. The repository currently has
   none. The first `npm install` or Expo scaffold would otherwise stage `node_modules`, build
   output, and — the real risk — `.env` files holding Supabase and AI provider keys.
3. **Secret-handling convention written down**: where dev keys live, how Edge Function secrets are
   set, and the standing rule that no credential enters the repository. See
   [AGENT_TOOLING.md](AGENT_TOOLING.md).
4. **Dev Supabase project created by the owner** (not by an agent), with the production project
   either non-existent or provably disconnected from all tooling.
5. **P2 resolved or retired** — [PRODUCT_VISION.md](PRODUCT_VISION.md) §9 documents nine of ten
   principles reconstructed from usage; `P2` has no usage anywhere and cannot be reconstructed.
6. **Owner ruling on "AI freedom"** ([UX_CONTRACT.md](UX_CONTRACT.md) §5) — define its behaviour or
   cut it, before it reaches a schema.

## M2 — Core Interactive Vertical Slice

- **Goal**: the bounded vertical slice from [MVP_SPEC.md](MVP_SPEC.md) is playable end-to-end for
  at least one story, without character chat or rolls yet.
- **Scope**: PlayerRun/StoryState/Scene/Branch/CanonFact schema; AI gateway wired for
  `generateStorySceneProposal`; Quick Start flow; one curated sample story (authored seed scenes);
  reading view with choice buttons + custom-action composer; one static image per scene; scene
  fade transition + image pan/zoom motion (per [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md));
  basic branch/replay.
- **Exclusions**: Advanced Setup (Quick Start only), character chat, rolls, editable
  configuration, category browse beyond a flat list, any monetization.
- **Evidence for PASS**: an internal tester can complete the bounded slice described in the brief
  (Quick Start or sample story → 3–5 scenes → one ending/checkpoint → replay an alternate branch)
  on all three platforms without a canonical-state bug (state lost, contradictory facts) in
  ≥9 of 10 runs.

## M3 — Character Memory + Roleplay

- **Goal**: full MVP scope reached — [MVP_SPEC.md](MVP_SPEC.md) is completely implemented.
- **Scope**: Advanced Setup; editable story configuration; character identity fields (pronouns,
  aliases, forms of address); CharacterRelationship (run-scoped); Character Chat surface +
  profile + shared memories; light roll mechanic (Adventure mode); category/tag taxonomy filter
  chips (P8).
- **Exclusions**: publishing, discovery beyond filter chips, any monetization *mechanism* (the
  cost and demand *instrumentation* in MVP_SPEC §8 is in scope — it is measurement, not
  monetization), deeper RPG mechanics.
- **Evidence for PASS**: per [MVP_SPEC.md](MVP_SPEC.md) §5's four-tier evidence model —
  Tier 1 (instrumentation) verified, no Tier 2 (hard failure) trigger, Tier 4 (qualitative review)
  completed. Tier 3 directional signals are recorded and discussed but **do not gate**. The
  proceed/stop call is a written product-owner judgment per MVP_SPEC §6.

## M4 — Bounded Revenue Experiment *(moved earlier by LW-M0-R2)*

- **Goal**: answer, with the smallest possible build, whether Lorewish can plausibly pay for its
  own inference — before investing in publishing and discovery, which are large scope items that
  do not themselves generate revenue.
- **Precondition**: M3 passed, meaning instrumentation exists, no hard failure triggered, and the
  qualitative review says people want to come back. **Monetization never precedes a retention
  read** — that principle from the original roadmap is preserved exactly; only its position
  relative to publishing/discovery changed.
- **Scope — deliberately one mechanism, not a monetization system**:
  - Read the MVP cost and demand instruments (MVP_SPEC §8): cost per retained user by capability,
    allowance-cap-hit rate, which capability actually consumes the allowance.
  - Choose **one** mechanism from that data: optional rewarded ads **or** a small consumable
    credit pack. Not both. Not a subscription.
  - CreditLedger becomes user-facing (superseding the MVP UsageCounter); credit-gating applied to
    whichever capability the data — not the assumption — identifies as the right sink.
  - The single chosen payment or ad integration, on all three platforms: StoreKit / Play Billing
    for mobile, a web payment path for web; or the ad SDK plus its consent and rating obligations.
- **Exclusions**: subscription tier; revenue sharing; multiple simultaneous mechanisms; any
  monetization surface in a first session, before first consequence, or during an active scene.
- **Honest limitation on this milestone**: a closed cohort cannot produce real revenue. Store IAP
  in sandbox/internal-testing transacts test money only, and serving live ads to a known internal
  test cohort conflicts with ad-network invalid-traffic policy. **M4 measures demand and opt-in
  intent against a real, fully-built flow.** Actual revenue is only observable once distribution
  widens (Beta / Store Release), which is why the mechanism must be *built* here and *earned from*
  there.
- **Evidence for PASS**:
  - Cost per retained user is known and is not structurally larger than any plausible revenue per
    user. **This is the hard gate** — a negative answer here is more valuable than a positive one,
    because it arrives before publishing and discovery have been built on top of it.
  - The chosen mechanism's flow works end to end on all three platforms without degrading the
    first-session experience (verified against the Tier 2 bar in MVP_SPEC §5).
  - Opt-in / intent rate is measurable and recorded with its cohort size stated. No threshold is
    fabricated here.
  - No retention regression versus the M3 baseline.

## M5 — Creation + Publishing *(was M4)*

- **Goal**: the Creator Loop's publish/remix half becomes real, gated on M3 retention evidence and
  M4's unit-economics answer.
- **Scope**: publish a Story to a limited/public library; other users can play and fork/branch it
  into their own editable copy; basic moderation on published content (pre-publish check using the
  existing ModerationState mechanism); minimal creator engagement view (plays, completions,
  branch count).
- **Exclusions**: revenue sharing, a full creator studio/analytics suite, follower graph, comments.
- **Evidence for PASS**: M3 retention hypotheses (H1–H4) show at least directionally positive
  signal; a small cohort of testers successfully publishes and another cohort successfully plays/
  forks a published Story without moderation or data-integrity incidents.

## M6 — Discovery *(was M5)*

- **Goal**: browsing/finding stories scales past a flat filtered list.
- **Scope**: search; curated collections; simple non-ML recommendation heuristics (e.g.,
  "popular this week," "similar genre/tags") — sophisticated ML recommendation is explicitly out
  of scope per the brief.
- **Exclusions**: any ML-based personalization system.
- **Evidence for PASS**: enough published content exists (from M5) that a flat list is
  demonstrably insufficient (a product judgment call, not a fixed number, made with real usage
  data at the time).

## M7 — Safety + Globalization

- **Goal**: harden the product for a public store release beyond a closed cohort.
- **Scope**: moderation hardening (proactive + reactive, appeals path); content policy enforcement
  aligned with 13+/no-18+ scope; localization/i18n architecture populated for at least one
  additional locale beyond English; age-gate/compliance review for target launch regions.
- **Exclusions**: 18+ content enablement (remains out of scope for this product entirely, not
  deferred to a future milestone by default — reopening it would be a separate, deliberate product
  decision, not an M7 deliverable).
- **Evidence for PASS**: moderation false-negative/false-positive rates reviewed and acceptable;
  store review guidelines (Apple/Google) checklist passes for AI-generated content and any IAP.

## Alpha

- **Scope**: closed cohort (order of tens of testers), M2+M3 slice, used to evaluate
  [MVP_SPEC.md](MVP_SPEC.md) §5–7.
- **Evidence for PASS**: see MVP_SPEC.md §5's four tiers and §6's decision procedure directly.
- **Explicit limitation**: this cohort size supports instrumentation verification, hard-failure
  detection and qualitative learning. It does **not** support statistical conclusions about
  activation or D7 return — see MVP_SPEC §5.

## Beta

- **Scope**: wider opt-in cohort; includes the M4 mechanism and, as they complete, M5–M6.
- **This is the first point at which real revenue is observable** — a closed alpha cannot transact
  real money (see M4). The M4 mechanism is *built* pre-Beta and *earns* here.
- **Evidence for PASS**: retention signals from Alpha hold or improve at a cohort size that
  actually supports the claim; monetization signals become real rather than intent-based; no
  critical moderation or data-integrity incidents.

## Store Release

- **Scope**: public App Store / Play Store / web launch.
- **Evidence for PASS**: M7 safety/compliance bar met; Beta signals support a public launch
  decision by the product owner (a judgment call, not an automatic trigger).

## Note on Milestone Boundaries

The M2/M3 split (separating "vertical slice" from "character memory" so the smallest possible thing
ships and gets tested first) is retained from the original framing.

**Changed by LW-M0-R2**: monetization moved from M6 to M4. The reasoning, stated plainly so it can
be argued with:

1. **No dependency existed.** Nothing in a rewarded-ad flow, a credit pack, or credit-gated
   regeneration requires a public story library or a search index. Sequencing revenue behind them
   was convention.
2. **The question is unit economics, not revenue.** For an owner-funded side project the binding
   risk is not "when do we start earning" but "does a retained user cost more than they could ever
   be worth." That is answerable from MVP instrumentation, and if the answer is bad, every
   milestone built on top of it was wasted effort. Asking early is cheap; asking late is expensive.
3. **Retention still comes first.** M4 sits *after* the Alpha retention read, not before it. The
   original roadmap's core principle — never let monetization contaminate the retention
   measurement, never let it touch the first session — is preserved without modification.
4. **What did not change**: no subscription, one mechanism at a time, opt-in only, nothing during
   an active scene, nothing in a first session.

The counter-argument, recorded rather than dismissed: building a payment or ad integration is real
work that produces no user value and, in a closed cohort, no real money. If the owner would rather
spend that effort on making the product better and defer all monetization until Beta distribution
exists, that is a coherent position — but the **cost instrumentation in MVP_SPEC §8 should ship
regardless**, because it is nearly free and it is what makes the decision informed whenever it is
taken.
