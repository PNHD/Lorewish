# Roadmap

> **WEB_FIRST_UNTIL_RELEASE_CANDIDATE** (LW-W3-R1, 2026-08-11). Web is the only
> active delivery target through WEB-RC. Routine CI covers typecheck,
> deterministic tests, lint, production web export, server/database validation,
> and relevant browser E2E. Existing native workflow logic is retained behind
> explicit manual dispatch only.
>
> `NATIVE_BUILD_VALIDATION_DEFERRED`
> `IOS_RELEASE_DEFERRED`
> `ANDROID_RELEASE_DEFERRED`

## Active web-first sequence

1. **WEB-M3 â€” Character Memory + Advanced Setup + Roleplay Depth**
2. **WEB-M4 â€” Guest Access + Safe Public Real-AI Beta**
3. **WEB-M5 â€” Web Product UX Completion**
4. **WEB-M6 â€” Monetization Experiment**
5. **WEB-M7 â€” Creator / Discovery only if validated**
6. **WEB-RC â€” Web Release Candidate / Final QA**
7. **NATIVE â€” iOS + Android adaptation/build/store work**

The detailed historical milestone definitions below remain as product-decision
context. Where their platform sequencing conflicts with this active sequence,
the web-first sequence above is authoritative until WEB-RC.

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2 — monetization resequenced; M1 entry conditions and
per-platform evidence revised by LW-M0-R3; M1 web-first test channel and bilingual UI, M7 locale
count revised by LW-M1-R1 per D32/D33)

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

## M0 — Product Definition — **PASS** *(closed by LW-M0-R3, 2026-08-10)*

- **Goal**: establish a documentation baseline an implementation agent can build from without
  inventing product behavior.
- **Scope**: the docs in this `docs/` directory.
- **Exclusions**: no code, no infrastructure, no external services.
- **Evidence required for PASS**: this document set exists, is internally consistent, and has been
  reviewed by the product owner.
- **Outcome**: PASS. Three review passes — `ADV-M0-R1` (baseline), `LW-M0-R2` (independent review
  and correction), `LW-M0-R3` (owner research assimilation and final correction). Every open
  product and architecture decision is now closed: P2 (D26), the iOS build path (D24), the "AI
  freedom" field (D25), branch semantics (D27), allowance communication (D28), discovery empty
  states (D29), continuous play (D30) and scene readability (D31). What remains before code is
  owner sign-off and the M1 first steps listed under M1 below — setup work, not product definition.
  See `handoff/LW-M0-R3/HANDOFF.md`.

## M1 — Foundation

- **Goal**: a running, empty-ish Expo app on all three platforms, wired to a real (dev) Supabase
  project, with the domain model's core tables in place — no story-playing yet.
- **Scope**: Expo + Expo Router app shell; Supabase project with Auth + initial schema for User,
  Story, StoryConfiguration, Character, World (Authoring Data only); design tokens and the shared
  composer component built to the [UX_CONTRACT.md](UX_CONTRACT.md) spec (testable in isolation,
  e.g., a storybook-style screen); CI that builds all three targets. **English + Vietnamese UI
  catalogues ship from this milestone, not scaffolding-only** (D33). **Web is deployed first as the
  shareable preview channel** (D32) — a local-fixture `/preview` route ships ahead of the AI
  gateway/Supabase-backed reading view that lands later in M1, specifically so the owner has
  something to send a link to before the full backend is wired up. This does not change the
  Android/iOS evidence bar below.
- **Exclusions**: no AI gateway calls yet (or a stubbed/mocked gateway only); no PlayerRun/
  StoryState/character-chat schema yet; no monetization.
- **Evidence for PASS** *(revised by LW-M0-R3 to state the evidence class per platform, since they
  genuinely differ and a single sentence was hiding that)*:
  - **Android** — the app installs and runs on a device; a user can sign up, sign in, and see an
    empty Home screen; the composer passes its UX_CONTRACT checklist on-device.
  - **Web** — the app runs in a browser; same auth and Home evidence; the composer passes its
    checklist in-browser.
  - **iOS** — the iOS target **compiles and produces a build artifact via EAS**. Physical device or
    TestFlight validation follows once signing/distribution prerequisites exist (D24) and is
    recorded separately and dated when it happens. **A successful cloud build must not be reported
    as runtime validation.**
  - The composer checklist in all cases: auto-grow, Enter=newline, keyboard-safe, long-paste-safe,
    **UTF-8/IME-safe with Vietnamese and one CJK input method**.

### M1 Entry Conditions *(revised by LW-M0-R3)*

LW-M0-R2 listed six prerequisites "to resolve before starting M1". Four were product decisions and
two were setup tasks that had been mislabelled as blockers. The distinction matters: a
product-definition milestone should not stay open for work that is simply the first hour of the
next milestone.

**Product decisions — all resolved. None blocks M1.**

| Former prerequisite | Resolution |
|---|---|
| iOS build path decided and available | **Resolved — D24.** Expo EAS cloud builds are the default iOS path from Windows. Apple Developer membership is a later prerequisite for device/TestFlight distribution, not an M1 blocker. |
| P2 resolved or retired | **Resolved — D26.** P2 is *Control Without Complexity*, supplied by the owner. |
| Owner ruling on "AI freedom" | **Resolved — D25.** Cut from MVP. It never reaches a schema. |
| Owner sign-off on D2, D7, D9, D11 and the resequencing | Still an owner action, and it is the one genuine gate: these change what gets built and in what order. Not an engineering blocker. |

**M1 first steps — inside M1, not before it.** These are ordinary setup work, sequenced as the
opening tasks of the milestone rather than held as gates on a documentation milestone:

1. **Create `.gitignore` as the very first act**, before any dependency install or scaffold —
   covering `node_modules`, Expo/EAS build output, `.env*` and local tooling caches. The ordering
   is non-negotiable even though the task is trivial: the first `npm install` is when it starts
   mattering, and a key committed to git history is compromised even after deletion.
2. **Write down the secret-handling convention** — where dev keys live, how Edge Function secrets
   are set, and the standing rule that no credential enters the repository. See
   [AGENT_TOOLING.md](AGENT_TOOLING.md).
3. **Owner creates the dev Supabase project** (not an agent), credentials held outside the
   repository, production non-existent or provably unreachable from all tooling.
4. **Owner sets up the Expo/EAS account** and the iOS build configuration (D24). Costed builds
   remain owner-initiated.
5. **Install the approved agent skills** at their standardized locations
   ([AGENT_TOOLING.md](AGENT_TOOLING.md)).
6. **Expo + Expo Router scaffold**, then the rest of M1 scope above.

Item 1 must precede items 5 and 6. Nothing else here has a hard ordering constraint.

## M2 — Core Interactive Vertical Slice

- **Goal**: the bounded vertical slice from [MVP_SPEC.md](MVP_SPEC.md) is playable end-to-end for
  at least one story, without character chat or rolls yet.
- **Scope**: PlayerRun/StoryState/Scene/Branch/CanonFact schema; AI gateway wired for
  `generateStorySceneProposal`; Quick Start flow; one curated sample story (authored seed scenes);
  reading view with choice buttons + custom-action composer; one static image per scene; scene
  fade transition + image pan/zoom motion (per [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md));
  basic "Replay from here"; the **Scene Readability Contract** ([UX_CONTRACT.md](UX_CONTRACT.md)
  §1A) and the **[Continuous Play Contract](CONTINUOUS_PLAY_CONTRACT.md)**, both of which apply
  from this milestone because it is the first that generates a scene.
- **Exclusions**: Advanced Setup (Quick Start only), character chat, rolls, editable
  configuration, category browse beyond a flat list, any monetization.
- **Evidence for PASS**: an internal tester can complete the bounded slice described in the brief
  (Quick Start or sample story → 3–5 scenes → one ending/checkpoint → replay an alternate branch)
  on all three platforms without a canonical-state bug (state lost, contradictory facts) in
  ≥9 of 10 runs. **Plus the continuous-play evidence bar**
  ([CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §10) in full: forced-timeout recovery,
  kill-and-resume, double-submit idempotency, replay landing playable in one step, no "to be
  continued" string in the copy catalogue, every play state reached with an enabled control, and
  graceful allowance exhaustion. These are contract-compliance checks, not rates — each either
  passes or does not. *(Added by LW-M0-R3.)*

## Future subtask — AUTH / GUEST ACCESS *(deferred from LW-M2-R3)*

- **Goal**: preserve guest-first onboarding while deliberately designing the abuse, cost, consent,
  and account-linking boundary before any public real-AI inference is enabled.
- **Scope**: decide a limited guest AI allowance; guest-to-account upgrade/linking; cross-device
  persistence; Google and Apple sign-in; email/magic-link fallback; Facebook only if product
  evidence justifies it; guest abuse/rate-limit strategy; account recovery; privacy/consent UX.
- **Current state**: `USER_AUTH_UX_DEFERRED`, `SOCIAL_AUTH_DEFERRED`, and
  `PUBLIC_REAL_AI_BROWSER_E2E_DEFERRED`. The existing `alpha_generation_access` table is retained as
  `DEFERRED_AUTH_INFRASTRUCTURE`, not as a public access mechanism or age-verification table.
- **Exclusions**: no part of this subtask is implemented by LW-M2-R3. In particular, no shared
  browser password, client secret, bypass token, public anonymous DeepSeek route, or social login.

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
- **Scope**: publish a Story to a limited/public library; other users can play it, and **remix
  (fork)** it into their own editable, creator-owned copy; basic moderation on published content
  (pre-publish check using the existing ModerationState mechanism); minimal creator engagement view
  (plays, completions, remix count). *(LW-M0-R3: this milestone owns the fork/remix vocabulary. The
  player mechanic is "Replay from here" and the two must not share words on any surface — D27.)*
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
  additional locale **beyond the English + Vietnamese catalogues already shipped at M1** (D33); age-
  gate/compliance review for target launch regions.
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
