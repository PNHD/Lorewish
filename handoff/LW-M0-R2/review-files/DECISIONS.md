# Decisions Log

Status: PROVISIONAL (M0 product definition) — individual entries carry their own status
Last updated: 2026-08-10 (D2, D7, D9, D11 revised and D16–D23 added by LW-M0-R2)

Format: Decision / Rationale / Alternatives considered / Status.

---

## D1 — Primary Wedge: Solo Interactive Roleplay, Not "AI D&D"

**Decision**: Position and build the product around solo interactive roleplay (story + character
interaction + meaningful choice), with D&D-like mechanics as an optional, opt-in layer, not the
product's identity.
**Rationale**: Research shows the loved features are agency and character memory, not mechanical
depth; positioning as "AI D&D" narrows the addressable audience away from the stated primary
genres (fantasy, romance, adventure).
**Alternatives considered**: Position as a tabletop RPG companion app (rejected — smaller,
different audience); position as a pure character-chat companion app (rejected — loses the
plot/consequence structure that differentiates from existing AI companion apps).
**Status**: ACCEPTED.

## D2 — Global Product, Seeded Test Cohort *(REVISED by LW-M0-R2)*

**Decision**: Lorewish is a **global product, English-first in UI, globally-ready in
architecture, from M1**. Separately and independently, the **initial alpha test cohort** is
whoever the owner can actually recruit and interview — realistically Vietnam/SEA. The cohort is a
recruiting fact; it is not a market strategy and confers no product or architectural regionalism.

**What changed and why**: the previous D2 fused two different decisions into one sentence
("seeded first in Vietnam/SEA … before global expansion"). Because it was written as a *targeting*
decision rather than a *recruiting* one, it licensed downstream regional assumptions that nobody
had actually decided to make. Product positioning, UI language, taxonomy design, monetization
design and data architecture are all global questions; only "who do I hand a build to first" is a
seed-market question, and that one is answered by the owner's reach, not by evidence.

**What this changes concretely**: i18n scaffolding, locale-independent taxonomy keys, UTF-8/IME-safe
input and UTC timestamps become **M1 requirements**
([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §11), and story content language becomes a
per-story property independent of UI language ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8). Each is
cheap at scaffold time and expensive to retrofit, which is what makes deciding now worthwhile.

**What this does not change**: no translated UI ships at launch; no market research is invented;
the research base remains what it is — one adjacent product, one market, directional only.

**Known tension, recorded not resolved**: an English-only UI tested on a cohort that may not read
English comfortably confounds language friction with product value. [MVP_SPEC.md](MVP_SPEC.md) §5
Tier 4 requires this to be separated explicitly during qualitative review rather than assumed away.

**Alternatives considered**: Vietnamese-first product (rejected — would architecturally commit the
product to a market chosen for tester convenience); global targeting with no acknowledged seed
cohort (rejected — dishonest about where the first evidence will come from, and would leave the
language-friction confound undetected).
**Status**: ACCEPTED (supersedes the original D2). GTM sequencing beyond the alpha cohort remains
an open owner decision and still does not block M1–M3 engineering.

## D3 — First-Time Experience Starts With Discovery, Not Blank Creation

**Decision**: New users land on sample/curated stories first (with Quick Start as a prominent,
equally-reachable alternative), not a blank creation form.
**Rationale**: Reduces empty-state failure risk; lets a user experience the wedge (choice →
consequence → character memory) immediately without first having to imagine a premise.
**Alternatives considered**: Creation-first onboarding (rejected — higher activation risk for
new/undecided users, though better for users who arrive with a specific idea already — Quick Start
remains one tap away for that case).
**Status**: ACCEPTED.

## D4 — Minimum Creator Functionality in MVP

**Decision**: MVP creator functionality is limited to private authoring for one's own play
(Quick Start + Advanced Setup + edit + playtest). No publishing, no discovery-by-others, no
remix-by-others, no creator analytics until M5. **No in-product scene or choice editor at all** —
curated sample stories are authored by the owner as seed data
([CORE_LOOPS.md](CORE_LOOPS.md) §4).
**Rationale**: Publishing/discovery/social mechanics compound scope quickly (moderation at scale,
abuse handling, engagement analytics) and the brief explicitly gates them on retention evidence.
**Alternatives considered**: Ship a lightweight "share a link to my story" mechanic in MVP
(rejected — even a minimal sharing surface drags in moderation-before-others-see-it requirements
that are disproportionate before retention is proven).
**Status**: ACCEPTED.

## D5 — Custom Free-Text Actions Ship in MVP

**Decision**: Free-text custom actions are available alongside predefined choices from the first
vertical slice (M2), not deferred.
**Rationale**: Explicitly validated by research ("talking directly to story characters," "making
decisions") as core to the wedge; a choices-only product is materially closer to existing
branching-fiction competitors and loses the differentiation hypothesis in
[PRODUCT_VISION.md](PRODUCT_VISION.md) §7.
**Alternatives considered**: Predefined choices only for M2, add free text in M3 (rejected — the
composer rebuild that free text requires is also needed for character chat in M3 anyway, so
sequencing it later saves no real engineering time and weakens the M2 slice's ability to test the
core fantasy).
**Status**: ACCEPTED.

## D6 — Light Roll Mechanic Design

**Decision**: A single roll abstraction (one check, three outcome bands: success/partial/fail),
opt-in via "Adventure" story mode, triggered on player-flagged-risky custom actions or
system-flagged choices. No stat sheets, no combat resolution math, no character builds in MVP.
**Rationale**: Preserves the "novelty"/"liked randomness" signal from research without building a
full RPG system the brief explicitly says not to force into every story.
**Alternatives considered**: No randomness at all in MVP (rejected — discards a clearly liked
signal); a fuller stat-driven system now (rejected — directly against brief's minimum-useful-
mechanic instruction and the "not simply AI D&D" positioning).
**Status**: ACCEPTED.

## D7 — Character Chat Is Read-Mostly Against Canon

**Decision**: Character chat reads canonical state (identity, relationship, recent CanonFacts/
Memories) as context but does not, by default, write new canon that affects the main story branch.
A message becomes canon **only through an explicit player action** — the app may suggest, the
player promotes.

**Clarified by LW-M0-R2 (three points that were ambiguous enough to be implementable wrongly):**

1. **Who promotes.** [CORE_LOOPS.md](CORE_LOOPS.md) §3 previously said a message is "explicitly
   marked … *by the system* when the AI/app detects a canon-worthy statement." That is automatic
   promotion, and it contradicts the exact property this decision exists to provide — that casual
   chat cannot silently alter the story timeline. Detection may raise a non-blocking suggestion;
   only a player tap writes.
2. **Where it lands.** Promotion creates a `CanonFact` with `origin = character_chat`, scoped to
   the active `(PlayerRun, Branch)`. Because origin is stored, "has chat altered this timeline?"
   is answerable by query — the decision becomes auditable rather than merely intended.
3. **Branch scoping.** Chat threads are scoped to `(PlayerRun, Character, Branch)`. The prior
   `character + run` scoping left undefined what a chat thread refers to after the player forks a
   branch — the thread would have kept citing canon from an abandoned timeline.

"Memory" is a projection over CanonFacts, not a second store ([DOMAIN_MODEL.md](DOMAIN_MODEL.md)
§2). There is exactly one record of what happened.
**Rationale**: Keeps a single source of truth for "what happened in the story" while still letting
chat feel aware and consistent; avoids a second uncontrolled channel that can silently desync from
the main branch's CanonFacts.
**Alternatives considered**: Full bidirectional sync (chat can freely alter story state)
(rejected for MVP — meaningfully harder to keep consistent and not requested by research, which
asked for character chat to *exist* clearly, not to drive plot); fully isolated chat with zero
shared context (rejected — defeats P5's intent and the "AI remembering" signal).
**Status**: ACCEPTED for MVP; revisit bidirectional sync post-M3 if user feedback wants chat
decisions to matter to the main plot.

## D8 — Persistent vs. Ephemeral Memory

**Decision**: Persistent: CanonFacts, CharacterRelationship state, forms of address, StoryState
flags/inventory, BranchHistory, current scene pointer, promoted Memories. Ephemeral: discarded
GenerationProposals, raw provider intermediate output, unconfirmed AI proposals, minor flavor text
not tied to any flag/fact.
**Rationale**: Matches [DOMAIN_MODEL.md](DOMAIN_MODEL.md)'s materialization design — only
application-accepted, structured facts become durable; everything else is retained only for
audit/debugging, not treated as canon.
**Alternatives considered**: Persist full raw AI conversation logs as the memory source (rejected
— this is exactly the "prompt memory as source of truth" pattern P3 exists to avoid).
**Status**: ACCEPTED.

## D9 — Minimum Image Generation in MVP

**Decision**: One static image per key scene/checkpoint (not per message); no guaranteed
character-consistent portraits in MVP; no video.
**Rationale (REVISED by LW-M0-R2)**: the decision stands; **its stated rationale does not**. The
original justification — "image generation is the costliest per-unit AI action" — was a
point-in-time pricing observation asserted as a standing architectural fact. Provider prices move
in both directions, and long-context scene prose is a cost *curve* that grows with run length
rather than a flat per-call price, so the ranking between modalities can invert within a single
user's lifetime ([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §10).

The surviving rationale is **scope discipline and unproven quality**: the research's image
complaints have no root-cause diagnosis, so the conservative scope avoids over-investing in an
unproven fix. Cost ranking is now a measured, per-capability quantity, and *which* capability gets
credit-gated first at M4 is decided from that data rather than from an assumption fixed at M0.
**Alternatives considered**: Image per message (rejected — cost and the unresolved quality
complaint make this premature); no images at all in MVP (rejected — static scene imagery
materially supports P10/immersion and was a liked-but-imperfect feature, worth keeping at reduced
scope rather than cutting).
**Status**: ACCEPTED.

## D10 — Highest-Value MVP Animations

**Decision**: Scene fade/slide transition, image pan/zoom, choice-selection feedback, dice-roll
animation, mobile haptics. Idle motion/blink/parallax/particles deferred.
**Rationale**: See [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) §1–2 — best value-per-engineering-
cost subset; deferred items require additional asset production with no retention evidence yet.
**Alternatives considered**: Full P10 list in MVP (rejected — disproportionate production cost for
a side project pre-retention-evidence).
**Status**: ACCEPTED.

## D11 — Monetization Sequencing and First Mechanism *(REVISED by LW-M0-R2)*

**Decision**:
1. MVP ships **no payment surface** — free daily allowance only. *(unchanged)*
2. MVP **does** ship cost and demand instrumentation: cost per retained user by capability,
   allowance-cap-hit rate, and which capability consumes the allowance. *(new)*
3. The bounded revenue experiment moves from **M6 to M4** — after the Alpha retention read, but
   **before** publishing (now M5) and discovery (now M6). *(changed)*
4. The mechanism is **one of** rewarded ads or a small consumable credit pack, **chosen from MVP
   data rather than pre-committed**. Subscription remains excluded. *(changed — the original
   pre-selected rewarded ads)*

**Rationale**: publishing and discovery were never prerequisites for charging money; the old
ordering was convention, not dependency. For an owner-funded side project the binding question is
unit economics — whether a retained user can ever be worth more than they cost — and that question
is answerable from MVP instrumentation. A bad answer discovered at M4 saves building M5 and M6 on
top of a product that cannot pay for itself; the same answer discovered at M6 arrives after that
work is already spent.

On mechanism pre-selection: the rewarded-ad request came from one market's userbase and is strong
evidence of *acceptance*, weak evidence of *revenue* — effective ad revenue per user varies by an
order of magnitude across geographies, and a 13+ global product serving ads inherits content-rating,
minor-consent and platform-policy obligations that a credit pack does not. Committing to ads at M0
on that evidence would be exactly the kind of premature decision this review exists to catch.

**What is preserved without modification**: monetization never precedes a retention read; nothing
monetizing appears in a first session, before first consequence, or during an active scene; opt-in
only; no subscription.

**Honest limitation**: a closed alpha cannot produce real revenue — sandbox IAP transacts test
money, and live ads to a known internal cohort conflict with invalid-traffic policy. M4 measures
demand and intent against a real built flow; revenue becomes observable at Beta.

**Alternatives considered**: keep monetization at M6 (rejected — defers the cheapest available
answer to the project's largest risk behind two large non-revenue milestones; the counter-argument
is recorded in [ROADMAP.md](ROADMAP.md)); monetize during MVP (rejected — contaminates the
retention measurement the Alpha exists to produce); subscription first (rejected — unchanged from
the original decision).
**Status**: ACCEPTED for sequencing; the M4 **mechanism choice is deliberately left open** and is
made from MVP data at M4, not here.

## D12 — What Not to Build Before Retention Is Proven

**Decision**: Do not build, before M3 retention evidence: publishing/marketplace, social feed/
follow/comments, revenue sharing, deep RPG/combat stats, multiplayer, full video generation,
ML-based recommendation, a large creator studio, subscription tier, 18+ content, or a broad
taxonomy beyond the MVP category/tag set.
**Rationale**: Directly stated in the brief's out-of-scope list; each item independently justified
by scope-creep risk noted in [USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md) §5.
**Status**: ACCEPTED.

## D13 — Technical Stack

**Decision**: Expo/React Native/TypeScript/Expo Router client; Supabase (Postgres/Auth/Storage/
Edge Functions) backend; provider-agnostic AI gateway as a set of Edge Functions.
**Rationale / Alternatives**: See [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §2 for
the full evaluation against Flutter, separate native codebases, web-first+wrap, Firebase,
self-hosted backend, and self-hosted models.
**Status**: ACCEPTED for M1 start; revisit only if a concrete, evidenced limitation appears (not
speculatively).

## D14 — Canonical State Over Provider Session Memory

**Decision**: No AI provider's stateful conversation/session/thread feature is ever the source of
truth for story or character state; all generation calls are constructed fresh from our own
Postgres-held structured state.
**Rationale**: This is the brief's CRITICAL RULE; also the direct architectural fix for the
research's #1 quality complaint (identity/pronoun/relationship inconsistency) — see
[DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4–5.
**Status**: ACCEPTED — treated as a non-negotiable constraint, not a tradeoff to revisit.

## D15 — 18+ Content Is Out of Scope for This Product, Not Just This MVP

**Decision**: 18+ content is excluded from the product's content policy entirely at this stage,
not merely deferred as a future milestone item.
**Rationale**: Explicit brief instruction; also materially changes moderation, age-verification,
and store-compliance requirements in ways that would restructure M7 if left ambiguous.
**Alternatives considered**: Treat as "deferred to a later milestone" like other excluded features
(rejected — the brief's phrasing and the compliance implications warrant a harder line than a
normal scope-deferral).
**Status**: ACCEPTED. Reopening this would require a distinct, deliberate future product decision,
not an automatic roadmap progression.

---

# Decisions Added by LW-M0-R2

## D16 — Product Principles P1–P10 Are Defined In PRODUCT_VISION §9

**Decision**: The `P<n>` identifiers referenced throughout the document set are defined once, in
[PRODUCT_VISION.md](PRODUCT_VISION.md) §9, reconstructed from their usage. `P<n>` means *product
principle* and nothing else repository-wide; the requirement tiers in USER_RESEARCH_SYNTHESIS §6
were renamed `R0/R1/R2` to end a direct namespace collision with `P0/P1/P2`.
**Rationale**: the M0 set cited P1–P10 more than thirty times across nine documents and never
defined them. Every such citation resolved to nothing, and an implementation agent asked to
"satisfy P7" had no way to discover what P7 was. This was the single most consequential defect
found in the review.
**Status**: ACCEPTED, with one gap: **P2 has no usage anywhere and cannot be reconstructed** —
owner input required, or the identifier is retired.

## D17 — Alpha Numbers Are Directional Hypotheses, Not Gates

**Decision**: Alpha criteria are sorted into four tiers ([MVP_SPEC.md](MVP_SPEC.md) §5):
instrumentation (hard gate), hard failure criteria (hard gate, qualitative/absolute), directional
signal (not a gate), qualitative review (hard gate on *doing it*, not on its result).
**Rationale**: with a cohort of tens, a D7 figure's confidence interval spans both the old success
and failure thresholds at once — the same data could have been read as either. Percentage gates
computed from no telemetry manufacture certainty that does not exist and could kill or greenlight
the product on noise. What *can* be judged reliably at this cohort size is whether measurement
works, whether something is outright broken, and what testers actually say.
**Status**: ACCEPTED.

## D18 — AI Cost Is Measured Per Capability, Never Assumed Per Modality

**Decision**: no document asserts a standing cost ranking between modalities. Unit cost is recorded
per capability per call in `GenerationAuditLog`; provider prices live in configuration, not code;
credit-gating and model-tiering follow the measured ranking.
**Rationale**: provider pricing moves; long-context prose cost grows with run length while image
cost is near-flat, so the ranking can invert within one user's lifetime. See D9 (revised).
**Status**: ACCEPTED. **No AI provider is selected by this decision** — provider choice remains
open.

## D19 — Context Assembly Is Bounded

**Decision**: every generation call assembles context within an explicit per-capability budget:
relevance-ranked and truncated CanonFacts, summarized older branch history, and structured identity
state always included and never truncated.
**Rationale**: "assembled fresh from canonical state" without a ceiling means cost grows with run
length, making the most-retained users the most expensive — invisibly, until an invoice arrives.
Excluding identity from truncation preserves the P4 consistency guarantee under budget pressure.
**Status**: ACCEPTED.

## D20 — Guest Sessions Are Separately Metered

**Decision**: anonymous sessions receive a small device-associated generation quota, distinct from
the per-account daily allowance.
**Rationale**: anonymous auth plus a per-user daily allowance is not a cap — a user who exhausts it
can discard the session and start another indefinitely, and per-user rate limiting cannot help when
every abuser is a new user. Deliberately rejected: barring guests from custom actions, which would
protect cost at the direct expense of the activation signal the Alpha exists to measure.
**Status**: ACCEPTED for alpha scale; the residual risk (device signals are defeatable) must be
revisited before open distribution.

## D21 — Moderation And Account Deletion Are MVP Scope

**Decision**: output moderation on the generation path, and an in-product account-deletion path,
are MVP features rather than deferred to the public-content or globalization milestones.
**Rationale**: moderation was present in the architecture and the domain model but absent from the
MVP feature list — implementable-by-omission for a 13+ product that feeds free-text player input to
an LLM. Account deletion is a platform obligation inherited the moment an app offers account
creation; it is cheap now and a store-review blocker if found late.
**Status**: ACCEPTED.

## D22 — Story Content Language Is Independent Of UI Language

**Decision**: `content_language` is a per-Story property defaulting from device locale. A player may
run a story in a language the UI does not ship.
**Rationale**: decouples the global-product commitment (D2) from the alpha cohort's actual
languages, and prevents mid-run language drift. Forms of address and speaking style are
language-sensitive by nature — many languages encode formality and relationship directly in address
terms, which is precisely what P4 exists to keep consistent.
**Status**: ACCEPTED.

## D23 — Chat Threads And Promoted Canon Are Branch-Scoped

**Decision**: `ChatThread` is scoped to `(PlayerRun, Character, Branch)`; CanonFacts promoted from
chat inherit the branch they were promoted on and do not leak across sibling branches.
**Rationale**: closes an undefined state transition — the prior model did not say what a chat
thread refers to after a player forks a branch from a checkpoint, leaving a thread citing canon
from an abandoned timeline. See D7 (revised).
**Status**: ACCEPTED.
