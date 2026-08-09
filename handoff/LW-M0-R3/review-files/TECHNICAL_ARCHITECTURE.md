# Technical Architecture

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2; iOS build path decided and turn resolution added by
LW-M0-R3)

Optimized for: **solo/small-team owner, fast iteration, early revenue, ability to scale later
without a rewrite of the state model.** Explicitly *not* optimized for hypothetical millions of
users on day one.

## 1. Recommended Stack

- **Client**: Expo (React Native) + TypeScript + Expo Router, targeting Android, iOS, Web from one
  codebase.
- **Backend**: Supabase — Postgres (canonical state), Auth, Storage (images/assets), Edge
  Functions (server-side logic, including the AI gateway), Realtime used only where justified
  (see §4).
- **AI**: a provider-agnostic AI gateway layer (thin service, not a product) fronting one or more
  LLM/image providers, called only from server-side Edge Functions — never directly from the
  client.

This confirms the provisional direction in the brief, evaluated below rather than accepted
blindly.

## 2. Why This Stack (Evaluation, Not Assumption)

**Expo/React Native vs. alternatives:**
- *Rejected: separate native codebases (Swift/Kotlin).* Materially higher build cost for a
  solo/small team; P9 requires Android+iOS+Web from the first slice, which is not achievable in
  parallel native codebases at side-project velocity.
- *Rejected: Flutter.* Comparable cross-platform reach, but weaker first-party web output maturity
  for this use case and a smaller overlap with the TypeScript-based AI/backend tooling ecosystem
  the rest of the stack uses — introduces a second language boundary (Dart) for no offsetting
  benefit given the team's stated TypeScript direction.
- *Rejected: web-first (Next.js) + native wrapped later (Capacitor/PWA-to-store).* Violates P9
  directly (native must be an architectural target from the first slice, not a later wrap) and
  historically produces worse native feel (keyboard handling, haptics, safe-area behavior) — which
  is precisely what this product's UX contract is strict about (see [UX_CONTRACT.md](UX_CONTRACT.md)).
- **Accepted: Expo + Expo Router.** Single codebase, single language, mature web output, and Expo's
  managed workflow reduces native build/ops burden for a solo owner — the main real cost (some
  ejects/config-plugins needed for advanced native modules later) is acceptable at this stage.

**Supabase vs. alternatives:**
- *Rejected: custom backend (Node/Express + self-managed Postgres, or a hand-rolled REST/GraphQL
  API).* Adds ops burden (provisioning, migrations, auth from scratch, backups) inappropriate for
  a solo owner chasing fast iteration; no requirement in this brief needs bespoke backend logic
  Supabase can't express via Postgres + Edge Functions.
- *Rejected: Firebase.* The canonical-state model (P3) is fundamentally relational — Character,
  CharacterRelationship, CanonFact, BranchHistory, StoryState are joined, queried, and constrained
  against each other constantly (see [DOMAIN_MODEL.md](DOMAIN_MODEL.md)). Firebase's
  document/NoSQL model fights this instead of helping it, and would force denormalization that
  directly threatens the consistency guarantees P3/P4 exist to provide.
- *Rejected: fully self-hosted Postgres + self-hosted auth (Keycloak/etc.), no Supabase.* Same ops
  burden objection as above, without even Supabase's managed convenience; only justified once
  self-hosting economics matter (post-scale, not MVP).
- **Accepted: Supabase.** Managed Postgres gives the relational model P3/P4 need, Auth/Storage are
  solved problems out of the box, Edge Functions give a server-side boundary for the AI gateway
  without standing up separate infrastructure.

**AI provider approach:**
- *Rejected: self-hosted/open-source models.* Capex and ops burden (GPU hosting, model ops) is
  disproportionate to a side project's stage; also slows iteration on prompt/behavior quality
  compared to calling mature hosted APIs.
- *Rejected: binding directly to a single vendor's stateful conversation/session API as the source
  of truth.* This is the **CRITICAL RULE violation** to avoid — some providers offer
  server-side "threads"/session memory as a convenience; using that as the product's memory system
  would mean the AI vendor owns canonical state, contradicting P3 and making provider-switching or
  auditing effectively impossible. See §6.
- **Accepted: a thin, provider-agnostic gateway** (an Edge Function boundary, not a separate
  service in MVP) that (a) is called only with context assembled fresh from our own Postgres data
  each time (per [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4–5), and (b) is swappable per capability
  (see §5) without client changes.

## 3. Client Boundaries

- The client (Expo app) never calls AI providers directly and never holds provider API keys.
- The client never treats any locally-cached story state as authoritative — it always reconciles
  against Supabase Postgres as the source of truth on scene advance (optimistic UI is allowed for
  responsiveness, but reconciled, not trusted, on conflict).
- Platform-specific code (haptics, safe-area, keyboard avoidance) is isolated behind shared
  components (the composer, scene transition) so the single UX contract in
  [UX_CONTRACT.md](UX_CONTRACT.md) is enforced once, not reimplemented per platform.
- Web build shares the same component tree; no separate "web app" codebase.

## 4. Backend Boundaries

- **Postgres** holds all Authoring, Player Run, and AI Generation/Audit data from
  [DOMAIN_MODEL.md](DOMAIN_MODEL.md). Row-level security (Supabase RLS) enforces that a PlayerRun's
  data is only readable/writable by its owning User (and, for public Stories post-M5, read access
  to Authoring Data only).
- **Edge Functions** own: AI gateway calls, GenerationProposal → canon materialization logic
  (the accept/extract step in [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §5), moderation checks, usage
  counter writes (MVP) and credit ledger writes (M4). This is where "the application owns canonical
  state" is enforced in code, not just in the data model.
- **RLS is not sufficient on its own** *(added by LW-M0-R2)*. Edge Functions that use a
  service-role key bypass row-level security entirely, and the functions that matter most here —
  the AI gateway, the materialization step, the allowance check — are exactly those functions.
  Every such function must independently verify the caller's identity and that the caller owns the
  PlayerRun it is acting on. RLS is the second line of defence, not the only one. A gateway
  function that trusts a client-supplied `player_run_id` without an ownership check is a data-leak
  and a billing-abuse vector at the same time.
- **Realtime** is *not* needed for MVP (single-player, single-device-at-a-time experience per run).
  Justified use is deferred until a concrete need appears (e.g., a future multi-device
  "continue on another device instantly" feature) — do not wire it up speculatively.
- **Storage** holds GeneratedAsset images (and later audio); served via signed URLs, not public
  buckets, since some content may later need moderation-gated access even pre-18+ (e.g., a
  flagged-but-not-yet-reviewed image).

## 5. AI Gateway Boundary

- Exposed as capability-typed server endpoints, not one generic "chat" passthrough:
  `generateStorySceneProposal`, `generateChoiceOptions` (low-latency continuation), `characterChatReply`,
  `moderateContent`, `generateSceneImage`. Each can be bound to a different provider/model tuned
  for that job (e.g., a faster/cheaper model for predefined-choice generation, a stronger model for
  major scene prose, a dedicated moderation endpoint).
- Every call is constructed from canonical Postgres data assembled fresh (§2, §6) — the gateway is
  stateless with respect to provider-side conversation memory.
- Every call is logged to GenerationAuditLog (cost, tokens, latency, provider, model) before
  returning to the caller — this is the seam where credit-gating (M4) and cost-control (§10) attach
  without touching client code.
- Provider swap = a config/binding change in the gateway, not a client release.

### Turn resolution is a gateway responsibility *(added by LW-M0-R3)*

The gateway is where a provider outcome becomes an application state, so the continuous-play
invariant is enforced here rather than in the client:

- **Every gateway call for a play capability returns a resolved turn state**, never a bare provider
  result and never an error the client must interpret narratively. The state vocabulary is
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §2. A client that must decide "was
  that an ending or a failure?" from an HTTP status is exactly the design this contract forbids.
- **Ownership, allowance and input moderation are prechecked before any provider call** (§4's
  service-role warning applies), so a rejection costs nothing and resolves to a defined state.
- **The commit is transactional and idempotent**, keyed by the turn's `turn_id`
  ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §11). A duplicate request returns the committed result rather
  than generating again.
- **At most one transparent automatic retry**, transport-level failures only, under the same key.
  Moderation blocks, validation failures and allowance rejections are never auto-retried.
- **An internal adherence/policy parameter may exist in gateway configuration** if it proves
  technically useful for prompt construction. It is not a user-facing field, is not part of
  `StoryConfiguration`, and is not the removed "AI freedom" control returning by another route
  ([DECISIONS.md](DECISIONS.md) D25).

## 6. State Ownership (Critical Rule, Restated as an Architectural Constraint)

> Canonical application state lives in Postgres. AI providers never own product state.

Concretely: no feature may be built such that losing access to a specific AI provider's account/
session data would lose story progress, character memory, or relationship state. Every piece of
state a player would be upset to lose is a Postgres row before it is ever treated as "true" by any
part of the app. This is directly testable in code review: any code path that reads
provider-side conversation history to determine current story state (rather than to *generate* the
next proposal) is a violation.

## 7. Authentication Assumptions

- Supabase Auth (email/password + at least one OAuth provider, e.g., Google/Apple — Apple Sign-In
  is required for iOS App Store compliance if any other social login is offered).
- Guest/anonymous sessions allowed for trying a sample story (per
  [MVP_SPEC.md](MVP_SPEC.md) onboarding), backed by Supabase anonymous auth, upgradeable to a full
  account without losing the guest PlayerRun.
- No custom auth system; no separate identity provider — avoids a whole ops/security surface
  inappropriate for this stage.

## 8. Platform-Specific Concerns

- **iOS**: Apple Sign-In requirement (above); App Store review implications of AI-generated
  content (moderation must be in place before any public content surface, and per
  [MVP_SPEC.md](MVP_SPEC.md) §1.12 on the generation path from closed alpha onward) and of in-app
  purchase/credit mechanics once M4 lands (must use StoreKit/IAP for any digital-good purchase,
  not external payment links). In-app **account deletion** is required for any app offering
  account creation (MVP_SPEC §1.13).
- **iOS build path — DECIDED** *(LW-M0-R2 raised this as an M1 blocker; LW-M0-R3 resolves it)*. The
  owner's development machine is **Windows**, so iOS cannot be built locally: no Xcode, no local
  simulator, no local signing. **The decision is Expo EAS cloud builds as the default iOS build
  path.** The owner is **not** required to buy or borrow a Mac for M1. See
  [DECISIONS.md](DECISIONS.md) D24.

  This keeps iOS a first-class target rather than weakening it, but it changes *what kind of
  evidence* is available at each stage, and the roadmap must say so honestly rather than let
  "runs on iOS" quietly mean something different per platform:

  | Target | M1 evidence | Later evidence |
  |---|---|---|
  | **Android** | Local/device runtime evidence where a device is available: installs, runs, composer contract verified on-device | unchanged through M2–M3 |
  | **Web** | Browser runtime evidence: runs, composer contract verified in browser | unchanged |
  | **iOS** | **EAS cloud compilation/build evidence** — the iOS target compiles and produces a build artifact through EAS during foundation work | **Physical iOS / TestFlight validation** once signing and distribution prerequisites exist |

  **A successful cloud build is not runtime validation, and this document will not let the two be
  conflated.** No milestone report may claim physical iOS runtime validation unless it actually
  occurred. Where only a build succeeded, the honest statement is "the iOS target builds via EAS";
  where an app ran on a device or TestFlight, that is stated separately and dated.

  **Concrete later prerequisite, recorded now**: a paid **Apple Developer Program membership** and
  the associated signing/distribution setup are required before any on-device install or TestFlight
  distribution. Cloud builds work without one for compilation purposes; physical distribution does
  not. This is a real cost and a real setup step, and it is the gating item for moving iOS from
  build evidence to runtime evidence. It is deliberately **not** an M1 blocker: nothing about it
  changes what M1 builds, and blocking foundation work on a store membership would delay every
  other platform for no engineering reason.

  EAS Build is a **paid, owner-initiated** service. Per [AGENT_TOOLING.md](AGENT_TOOLING.md),
  costed operations are never agent-initiated.
- **Android**: Play Store equivalent IAP requirement for M4; hardware back-button behavior (see
  [UX_CONTRACT.md](UX_CONTRACT.md) §11); accessible data-deletion route required.
- **Web**: no app-store IAP constraint, but payment integration (M4) needs a separate web payment
  path (e.g., Stripe) in addition to mobile IAP — flagged here as a future scope item, not solved
  in MVP since MVP has no payment surface at all.
- **Advertising compliance** *(added by LW-M0-R2, relevant from M4)*: a 13+ product distributed
  globally that serves rewarded ads inherits ad content-rating obligations, regional consent
  requirements covering minors, platform families/ads policy obligations, and iOS app-tracking
  consent. None of this is prohibitive, but it is real integration and policy work that must be
  costed into the ads-vs-credit-pack decision rather than assumed free because the SDK is free.
- **Keyboard/safe-area handling** differs meaningfully across platforms and is the highest-risk
  area given the research's composer pain points — treated as a shared, heavily-tested component
  rather than per-platform code (§3).

## 9. Observability Needs

Kept intentionally minimal for this stage:
- **GenerationAuditLog** (already in the domain model) is the primary observability surface for AI
  cost/latency/failure — queryable directly in Postgres; no separate analytics pipeline needed at
  MVP scale.
- **Supabase's built-in logs/metrics** cover API/DB-level operational visibility.
- **Basic product funnel events** — the full required event set is now specified in
  [MVP_SPEC.md](MVP_SPEC.md) §5 Tier 1 and is a **hard gate for M3**, not a nice-to-have. Simple
  event rows in Postgres are sufficient at MVP scale; a dedicated analytics tool (e.g., PostHog)
  is a reasonable low-cost addition but not a blocking dependency for M2/M3. What *is* blocking is
  that cost-per-active-user and cost-per-retained-user must be derivable by query — an alpha that
  cannot answer "what does a retained user cost us?" cannot inform the M4 revenue decision.
- **Client crash reporting** (e.g., Sentry free tier) recommended but treated as an easy add-on,
  not a architectural dependency to design around now.

## 10. Cost-Control Points

Given AI inference is the dominant marginal cost for this product:

- **Free daily allowance is enforced server-side** (Edge Function checks the UsageCounter — see
  [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §3 — before calling a provider), never client-enforced only.
- **Model tiering by capability**: cheaper/faster models for low-latency choice-option generation,
  a stronger (costlier) model reserved for major scene prose and character chat where quality
  matters most.

### Cost is measured per capability, never assumed by modality *(revised by LW-M0-R2)*

The previous text asserted that **"image generation is the most expensive per-unit action."** That
assertion is removed. It was stated as a standing fact and used to justify a design decision
([DECISIONS.md](DECISIONS.md) D9), but it is a **point-in-time pricing observation, not an
architectural invariant**:

- Provider pricing moves frequently and in both directions; relative cost between modalities is
  not stable across releases or vendors.
- A long-context text call is not one fixed price. As a run accumulates canon, scene-prose cost
  grows with context size ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §7), so text cost per action is a
  *curve*, while image cost is closer to flat. Which modality dominates therefore depends on run
  length, and can invert within a single user's lifetime.
- Character chat is high-frequency by design (P5). A cheap-per-call capability invoked ten times
  per session can outweigh an expensive one invoked once per checkpoint.

The architectural requirement is therefore:

- **Every capability's unit cost is a measured quantity**, recorded per call in
  `GenerationAuditLog` (capability, provider, model, tokens in/out, assembled context size,
  latency, computed cost).
- **Provider unit prices live in configuration, not code** — a price table the gateway reads, so
  re-pricing does not require a deploy and historical cost stays reconstructable.
- **Credit-gating and model-tiering decisions are driven by the measured cost ranking**, not by a
  hard-coded belief about which modality is expensive. "Which capability should we gate first?" is
  a query against real data, answerable at M4 rather than guessed at M0.
- **A per-capability cost alarm** — a capability exceeding its expected cost envelope is a signal
  the owner sees, not something discovered on a monthly invoice. This is the single highest-value
  piece of observability for an owner-funded side project.

MVP still limits images to one per key scene/checkpoint rather than per message — but the
justification is **scope and unproven quality** (the research image complaints have no diagnosis),
not a claim about which modality costs most. See [DECISIONS.md](DECISIONS.md) D9 (revised).

### Remaining cost controls

- **Regeneration reuses cached context assembly** but always counts as a new provider call against
  the allowance/ledger — no free unlimited retries, to prevent a cost-abuse loop. *(Refined by
  LW-M0-R3: the allowance is consumed when a provider call returns a billable result, and **not**
  when a call fails before returning one — a player is never charged for our timeout. The full
  table, including the cap on consecutive moderation-blocked turns that closes the resulting abuse
  loop, is [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §8.)*
- **Rate limiting is server-side** (per-user, per-Edge-Function), not just a client-side disabled
  button, to prevent trivial bypass.
- **Guest sessions are separately capped** and metered by device association, not only by user id.
  Anonymous auth plus a per-user daily allowance is not a cap at all if a new anonymous user is
  free to create — see [MVP_SPEC.md](MVP_SPEC.md) §1.1.
- **Context assembly is budgeted per capability** ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §7), which is
  the main defence against cost growing silently with run length.

## 11. Global Readiness From The Foundation (added by LW-M0-R2)

Lorewish is a global product whose first testers happen to be reachable in one region
([PRODUCT_VISION.md](PRODUCT_VISION.md) §10). The architecture must encode the former, never the
latter. These are M1 requirements because each is cheap to establish at scaffold time and
disproportionately expensive to retrofit across a shipped app:

| Requirement | Milestone | Why it cannot wait |
|---|---|---|
| **String externalization** — no user-facing copy hardcoded in components; one catalogue, English-only at launch | M1 | Retrofitting means touching every screen ever written. Adding a locale later must be a data change, not a refactor. |
| **Locale-independent keys** for genres, tags, story modes, outcome bands | M1 | Display strings used as identifiers become load-bearing in queries, analytics and stored rows; unpicking that later is a migration. |
| **UTF-8 / IME-safe input end to end** | M1 (composer) | The composer is built in M1 and is the product's claimed differentiator (P7). See [UX_CONTRACT.md](UX_CONTRACT.md) §2. |
| **UTC timestamps, presentation-layer localization** | M1 | Mixed-timezone storage corrupts D7-return measurement — the metric the Alpha exists to read. |
| **Story `content_language` on the Story record** | M2 | Prompt construction depends on it from the first generated scene ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8). |
| **No region-coupled infrastructure** — single region chosen for latency/cost, not as a product assumption | M1 | Data residency and multi-region are scale concerns (§12), but *assuming* a home market in schema or routing is the thing to avoid now. |

What is **not** required at M1: translated string catalogues, right-to-left layout support,
currency handling, or region-specific content policy. Those are M7 concerns. The distinction is
**scaffolding versus catalogues** — build the former, defer the latter.

## 12. Explicit Non-Goals (Scale Posture)

- No multi-region database architecture, no read replicas, no dedicated caching layer (Redis etc.)
  at MVP — Postgres + Supabase's managed infra is sufficient at the traffic levels a side-project
  alpha/beta will see.
- No microservices split — the AI gateway is a set of Edge Functions, not a standalone deployed
  service, until load or team size actually demands the separation.
- No custom infrastructure-as-code platform beyond what Supabase + the chosen CI provider offer
  out of the box.
