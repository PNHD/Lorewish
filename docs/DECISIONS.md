# Decisions Log

Status: PROVISIONAL (M0 product definition) — individual entries carry their own status
Last updated: 2026-08-10 (D2, D7, D9, D11 revised and D16–D23 added by LW-M0-R2; D24–D31 added by
LW-M0-R3; D2 revised again and D32–D34 added by LW-M1-R1, post-M0 owner decisions)

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

**What this does not change**: no market research is invented; the research base remains what it
is — one adjacent product, one market, directional only.

> **Superseded in part by D33 (LW-M1-R1).** This entry originally continued: "no translated UI
> ships at launch." That line is no longer accurate and is struck rather than silently edited. The
> product owner decided, after M0 closed, that Lorewish ships **English and Vietnamese UI
> catalogues from the first implementation milestone** — see D33. Everything else in this entry
> (global positioning, i18n *scaffolding* as an M1 requirement, the seed-cohort framing, the
> language-friction tension below) is unchanged and still governs.

**Known tension, recorded not resolved**: an English-only UI tested on a cohort that may not read
English comfortably confounds language friction with product value. [MVP_SPEC.md](MVP_SPEC.md) §5
Tier 4 requires this to be separated explicitly during qualitative review rather than assumed away.
*(Materially reduced, not eliminated, by D33 — a Vietnamese-speaking tester now has a native-UI
option. Tier 4 review must still separate "did not understand the UI" from "did not value the
product" for anyone who used the English UI by choice or default.)*

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
**Status**: ACCEPTED. *(Updated by LW-M0-R3: the one gap this entry recorded — "P2 has no usage
anywhere and cannot be reconstructed" — is closed. The owner supplied P2 directly; it is
**Control Without Complexity** and is the only authoritative rather than reconstructed entry in the
P-list. See D26.)*

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

---

# Decisions Added by LW-M0-R3

Six of these eight follow from owner-provided research: the owner used the adjacent product
directly and supplied a screen recording
([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4). Two (D24, D26) resolve questions
LW-M0-R2 left open.

Numbering is chronological, not by importance. **D30 is the most consequential decision in this
group**, followed by D31 and D27.

## D24 — iOS Is Built With Expo EAS Cloud Builds From a Windows Machine

**Decision**: **Expo EAS cloud builds are the default iOS build path.** The owner is not required
to buy or borrow a Mac for M1. iOS remains a first-class target (P9); what changes is the *class of
evidence* available at each stage:

- **Android** — local/device runtime evidence where a device is available.
- **Web** — browser runtime evidence.
- **iOS** — **EAS cloud compilation/build evidence** during foundation; **physical
  iOS/TestFlight validation** once signing and distribution prerequisites exist.

A paid **Apple Developer Program membership** plus signing/distribution setup is recorded as a
concrete later prerequisite for on-device install and TestFlight — deliberately *not* an M1
blocker, since nothing about it changes what M1 builds.

**Rationale**: LW-M0-R2 correctly identified that the M1 evidence bar ("app installs and runs on an
iOS device") was unreachable from a Windows machine, and named it the most urgent open question.
The realistic failure it warned about was silent slippage to "Android and Web now, iOS later",
breaking P9 at the first milestone. Cloud builds remove the hardware blocker at a cost the project
can absorb, keep the iOS target compiling continuously from day one — which is what actually
prevents iOS-specific rot — and defer only the part that genuinely requires a store account.

**The honesty constraint is part of this decision.** A successful cloud build is *not* runtime
validation. No milestone report may claim physical iOS runtime validation unless it occurred; where
only a build succeeded, the claim is "the iOS target builds via EAS". Blurring these would recreate
the exact silent-P9-break this decision exists to prevent, just with better-looking paperwork.

**Alternatives considered**: buy or borrow a Mac (rejected for M1 — real cost and procurement delay
for a solo owner, with no engineering benefit over cloud builds at foundation stage; remains a
sensible later purchase if iOS iteration volume justifies it); ship Android and Web first and add
iOS later (rejected — this is precisely the P9 violation LW-M0-R2 flagged, and retrofitting iOS
after two milestones of Android/Web-shaped decisions is how "first-class" quietly becomes "ported").
EAS Build is a **paid, owner-initiated** service; agents never initiate a costed build.
**Status**: ACCEPTED. Supersedes the open question in LW-M0-R2 §7.3 and removes M1 prerequisite 1.

## D25 — The User-Facing "AI Freedom" Field Is Removed From MVP

**Decision**: the Low/Medium/High "AI freedom" adherence control is **removed** from Advanced
Setup, from editable story configuration, and from `StoryConfiguration`. It never reaches a schema.
The generation layer **may** retain an internal adherence/policy parameter in gateway configuration
if it proves technically useful; that parameter is internal, unexposed, and not this control
returning by another route.

**Rationale**: it is implementation jargon. A user cannot predict what Low versus High will
concretely do to their story, which means it is not control — it is a dial with an unknowable
effect, and it contradicts **P2, control without complexity** more directly than almost anything
else in the form. No research pain point asked for it. It would cost a form row, a schema column,
prompt-construction branching and three variants to test, in exchange for an effect close to
unobservable to a user comparing two runs. LW-M0-R2 recommended cutting it and retained it pending
an owner ruling; the owner has now ruled.

**Condition on any future reintroduction**: it must use behaviour-oriented language the player can
anticipate ("stick closely to my setup" versus "surprise me"), be justified by a concrete user
model, and never use the phrase "AI freedom".
**Alternatives considered**: keep it with a written definition of each level (rejected — a
definition would make it *implementable*, not *predictable*; the user-facing problem is that the
player still cannot forecast the outcome before committing to a run); keep it hidden as a
power-user setting (rejected — same objection, plus it adds a surface nobody asked for).
**Status**: ACCEPTED. Removes M1 prerequisite 6 and closes LW-M0-R2 open question 2.

## D26 — P2 Is "Control Without Complexity"

**Decision**: **P2 — Control Without Complexity.** Two creation modes, both first-class: **Quick
Start** for users who want to begin immediately with minimal setup, and **Advanced Setup** for
users who want explicit control over world, role, characters and starting context. Neither is a
degraded version of the other, and control is never imposed on a user who did not ask for it.

**Rationale**: LW-M0-R2 reconstructed nine of ten product principles from usage and reported P2 as
having no usage anywhere and therefore being unreconstructable, flagging it as an M1 blocker. That
report was accurate about the document set and wrong about the world: the owner held the original
principle. It is supplied here verbatim and is **authoritative rather than reconstructed** — the
only P-entry in [PRODUCT_VISION.md](PRODUCT_VISION.md) §9 that is not an inference.

It also turns out to have been the most load-bearing missing principle: the two-mode creation model
appears throughout the document set (MVP_SPEC §1.2, UX_CONTRACT §4–5, PRODUCT_VISION §7
hypothesis 2, D3) with no principle behind it, and D25 above is decided directly against it.
**Status**: ACCEPTED. Removes M1 prerequisite 5 and closes LW-M0-R2 open question 1.

## D27 — Player Timeline Branch and Creator Fork Are Different Concepts With Different Words

**Decision**: two concepts, non-overlapping vocabulary, never on the same surface.

- **Player timeline branch — MVP.** User-facing name: **"Replay from here."** From a scene or
  checkpoint, a new branch is created internally, the active branch switches, and the player enters
  a playable continuation immediately. It is a **pure state operation**: no generation, no wait, no
  allowance consumption, no provider failure mode. It must land in the reading view with an enabled
  action — never on a branch-management page, a confirmation page, or an account wall. The words
  *fork*, *remix*, *copy* and *version* do not appear on this surface, and the player is never
  asked to understand copies, database forks or story ownership.
- **Creator fork / remix — M5, later.** Copying another user's published story into an editable,
  creator-owned derivative where policy permits. Creates Authoring Data, not Player Run Data.

**Rationale**: owner-observed evidence ([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md)
§4.3) shows an adjacent product exposing an explicit branch/fork action that leads into
account/onboarding and a separate continuation context, leaving the owner unable to say what had
been created or what they were now playing. Two different operations sharing one word is enough on
its own to produce that confusion. LW-M0-R2 had already drawn this distinction as an inference
(H-REF-2); it is now an evidence-backed product rule with a named user-facing verb.

**What this evidence does not license**: any inference about the other product's database design or
copy semantics. That is unknown and is not recorded anywhere.
**Alternatives considered**: use "branch" as the player-facing verb (rejected — it is our internal
data concept, and asking a player to think in timelines is exactly the complexity P2 rejects);
allow "fork" on both surfaces with different qualifiers (rejected — the qualifier is the first
thing a user stops reading).
**Status**: ACCEPTED.

## D28 — Normal Play Communicates a Usage Allowance, Not a Per-Action Price

**Decision**: during normal play, no numeric cost is rendered beside a predefined choice, the
custom-action Send control, or a character-chat send control. The app communicates **what you have
left today**, not **what this button costs**. Allowance is always visible in Account/Settings; a
single non-blocking low-allowance indicator may appear outside the action controls; cost becomes
explicit only in the `ALLOWANCE_EXHAUSTED` state. Branch replay shows no cost, because it consumes
none. Any per-action pricing display is an M4 experiment requiring its own decision and evidence.

**Rationale**: owner-observed evidence ([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md)
§4.6) shows credits visibly attached to custom actions, character interaction and branching. A
visible price on every act of agency turns each choice into a small purchasing decision — a direct
tax on the two behaviours this product most needs, free-text custom actions (D5) and character chat
(P5). It also frames the player as a meter rather than a protagonist, which is the opposite of
"enter a world that remembers you".

**Scope discipline**: MVP has **no payment surface at all** and this changes nothing about that
(D11 unchanged). This is a decision about *communication*, recorded now so the first implementation
does not default into per-action price tags simply because the allowance counter makes them easy to
render.
**What is not claimed**: nothing here evaluates whether the adjacent product's pricing works
commercially. A three-minute session says nothing about conversion, and its pricing is not being
copied in either direction.
**Alternatives considered**: show remaining allowance persistently in the reading view (rejected —
ambient cost pressure during reading violates P1 and the first-session protections in MVP_SPEC §8);
show per-action cost only for "expensive" actions (rejected — it is the same pattern applied
selectively, and it teaches the player that some acts of agency are the costly ones).
**Status**: ACCEPTED for MVP. Revisitable as a deliberate M4 monetization experiment, never as a
default.

## D29 — No Empty Discovery Sections During a Small-Content Launch

**Decision**: filter chips and discovery sections are derived from content that actually exists. A
category chip renders only if at least one visible story carries that category. No section or shelf
is rendered in an empty state unless the empty state does useful work; where one is unavoidable, it
carries a useful primary action (start a sample story, Quick Start), never a bare "nothing here".
The seven-category taxonomy (P8) remains the stable key set in the data model regardless of which
chips are visible — this is a rendering rule, not a taxonomy change.

**Rationale**: owner-observed evidence ([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md)
§4.7) shows a filter surface reaching "no stories" while public content plainly existed elsewhere.
Lorewish launches with 1–3 sample stories against a seven-category taxonomy, so most chips would
resolve to zero — the risk is *higher* here than where it was observed. An empty category reads as
a broken or abandoned product, which is an expensive first impression to pay for a filter nobody
could have used.
**Explicitly not claimed**: that the observed product's catalogue is empty. It is not.
**Alternatives considered**: render all seven chips and show a friendly empty state (rejected — the
friendliest empty state is still a dead end the user chose to walk into); hide the filter row
entirely at launch (rejected — it hides P8's existence and makes the taxonomy undiscoverable even
once content exists).
**Status**: ACCEPTED.

## D30 — Continuous Play Contract *(the most consequential decision in this group)*

**Decision**: every interactive turn resolves into **exactly one** of five explicit application
states — `CONTINUE_READY`, `EXPLICIT_CHECKPOINT`, `TERMINAL_ENDING`, `GENERATION_FAILED`,
`ALLOWANCE_EXHAUSTED` — and a normal turn remains playable. Ending language is scoped to
`TERMINAL_ENDING` alone. **"To be continued" is prohibited as user-facing copy in every state.**
None of the following may produce a terminal-looking state: completing one AI generation, choosing
a branch, submitting a custom action, a provider timeout, exhausting a generated segment, or a
temporary inability to generate the next scene. Full specification, including turn lifecycle,
canonical-state commit point, idempotency, retry rules and the UI guarantees:
[CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md).

**Rationale**: this is the direct response to the highest-signal owner observation
([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4.2) — an adjacent product repeatedly
reaching a terminal-looking card after choices, actions and branch continuations, with visible
actions pointing back to the story rather than forward into it. The owner's report: *"after
branching, the story just stops; it always shows to be continued."* This breaks the loop the entire
product exists to deliver. A player who cannot tell whether the story ended or the app broke has no
reason to attempt the next tap, and no amount of memory, prose quality or artwork compensates.

It also sharpens Lorewish's own promise. "Enter a world that remembers you" fails just as badly if
the world stops without warning as if it forgets — a world that halts unexpectedly reads as broken,
not as one that remembers.

**The structural mechanism, not just the intent**: play state is **derived from committed state**
(`Scene.boundary_kind`), and failure states are **session-transient** — never persisted, never
surviving a reload. A timeout, crash or outage therefore leaves the run at its last durable scene,
which re-derives to `CONTINUE_READY`. Failure has nowhere durable to write itself. This is what
makes the guarantee testable rather than a promise to be careful.

**A fifth state was added** to the owner's four: `ALLOWANCE_EXHAUSTED`. Hitting the free cap is
neither a generation failure nor a narrative event, but produces the same risk of a turn with no
next action, and MVP_SPEC §8 already required it to degrade gracefully with nowhere to live. Folding
it into `GENERATION_FAILED` would tell the player something broke when nothing did, and offer a
Retry guaranteed to fail.
**Alternatives considered**: specify this inside UX_CONTRACT (rejected — it spans client, gateway
and persistence, so embedding it in a UI document puts a cross-layer invariant where only the UI
implementer reads it); treat it as an implementation-quality concern rather than a product decision
(rejected — it is the observed failure that most damages the core loop, and undocumented invariants
are the ones that get optimised away under delivery pressure).
**Status**: ACCEPTED. Applies from **M2**, the first milestone that generates a scene, and is a
Tier 2 hard-failure criterion in [MVP_SPEC.md](MVP_SPEC.md) §5.

## D31 — Scene Readability Contract

**Decision**: the reading view separates five content channels — **narrative, dialogue,
system/state change, roll result, player action** — in a fixed vertical order, with narrative as
the hero and never below a system component. **Mechanical state notation never appears inside
prose** (no `[Relationship +1]`, no inline flag names). Persistent state (inventory, full
relationship values, branch history) moves out of the reading view entirely; only the *delta* a
turn produced appears inline, summarised and collapsed past a few items. Chunking guidance —
paragraphs of roughly 40–90 words, a typical turn landing around 2–5 paragraphs — is a **pacing
expectation, not a truncation rule**; no hard word cap is imposed, because a cap that fights the
story is worse than a long scene. Scene prose is never paginated or gated behind a "continue
reading" control. Full text: [UX_CONTRACT.md](UX_CONTRACT.md) §1A.

**Rationale**: owner-observed evidence ([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md)
§4.1) shows narrative content, game-like state information and metadata competing in one visual
field, making the story hard to parse. §4.8 adds the corollary that visual richness did not fix it —
static illustrations were present throughout and the experience was still hard to follow. Image
volume is therefore not a substitute for readable narrative structure, which is an independent
second reason for D9's conservative image scope beyond its original scope-discipline argument.

This strengthens P1 (story text is the hero) rather than introducing a new principle: P1 previously
constrained only *chrome*, leaving the story body free to fill with mechanical notation and satisfy
P1 on a technicality.
**Alternatives considered**: impose a hard per-scene word limit (rejected explicitly — it trades a
readability problem for a story-quality problem, and the failure mode is worse because it is
invisible to the reader); render state changes inline in prose as the model naturally produces them
(rejected — this is the observed failure, and it also makes state changes unstyleable, unfilterable
and untranslatable).
**Status**: ACCEPTED. Applies from **M2**.

---

# Decisions Added by LW-M1-R1

Three post-M0 owner decisions, made after M0 closed and PASSed, that change *how M1 is built*
without reopening the product definition M0 established. They are recorded here rather than
folded silently into the M0 entries above, following the same discipline LW-M0-R2/R3 used: a
changed decision is superseded in writing, not rewritten as if it always read this way.

## D32 — Web Is The First Shareable Test Channel

**Decision**: Lorewish remains architecturally Android + iOS + Web (P9, D13 unchanged). Within
that, **Web is surfaced first as the shareable test/distribution channel** because the owner can
send a URL to a friend far more easily than a signed build. This is a *distribution sequencing*
decision, not an architecture change: it does not mean a web-only architecture, a PWA wrapper
standing in for native, or Android/iOS deferred indefinitely. Android/iOS validation continues
inside M1 on the same schedule D24 already set (EAS cloud build evidence at foundation stage);
only *which platform gets a shareable link first* changed.

**Concretely for M1-R1**: a static web export is deployed to Cloudflare Pages (preferred project
name `lorewish`, i.e. `lorewish.pages.dev`; `lorewish-app` or a similarly clean alternative if the
name is taken). No domain is purchased. No paid Cloudflare tier. This is a temporary preview host
for the foundation milestone, not a decision about where Lorewish is hosted at Store Release.

**Rationale**: the owner's actual bottleneck for early feedback is *how many friends can open the
build in one tap*, not which platform's evidence class is technically "first." A URL clears that
bar; an Android APK or a TestFlight invite does not, especially pre-Apple-Developer-membership
(D24).

**Alternatives considered**: hold all sharing until an Android APK is sideloadable and an iOS
TestFlight link exists (rejected — delays the first real feedback behind two platform-specific
distribution mechanisms neither of which is faster to stand up than a web export); build a
separate marketing-site-style web experience distinct from the Expo app (rejected — directly
violates D13/§3 of TECHNICAL_ARCHITECTURE: one codebase, one component tree, no separate "web app").
**Status**: ACCEPTED. Governs LW-M1-R1 and the sequencing of shareable evidence within M1; does not
change P9, D13, or the M1/M2/M3 evidence bars in [ROADMAP.md](ROADMAP.md).

## D33 — English And Vietnamese Ship From Foundation

**Decision**: Lorewish's UI supports **English and Vietnamese from the first implementation
milestone (M1)**, not English-only-at-launch-with-catalogues-deferred. This applies to UI copy,
language selection, preview/fixture content, and the localization architecture generally. It
**supersedes** the M0 statement that "translated UI beyond English" is excluded from MVP
([MVP_SPEC.md](MVP_SPEC.md) §2) and the "English-only at launch" catalogue framing in
[TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §11, and partially supersedes D2 (see the
note on D2 above).

**What this does not change**: Lorewish is still a **global product**, not a Vietnamese-market
product — Vietnamese support is additive globalization infrastructure, not regional hard-coding,
and no product surface, taxonomy key, or architectural decision is allowed to special-case Vietnam
because of it. The distinction that now governs the document set:

| Layer | Scope |
|---|---|
| **Product** | Global. Same product, same principles (P1–P10), everywhere. |
| **UI language** | English + Vietnamese, both first-class, from M1. A device-locale default with an explicit, persisted manual switch (see [UX_CONTRACT.md](UX_CONTRACT.md); no contract text there required changes — the composer and reading-hierarchy rules are already language-agnostic). |
| **Story content language** | A per-story property, independent of UI locale — unchanged from D22/[DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8. A Vietnamese-UI player may still play an English-language story and vice versa. |
| **First test channel** | Web (D32). |
| **First test cohort** | Whoever the owner can conveniently recruit — unchanged from D2's recruiting-not-strategy framing. |

**Rationale**: the owner judged that shipping a second first-class UI language at foundation time is
materially cheaper than retrofitting it later (the same "scaffolding vs. catalogues, decide the
scaffolding early" logic D2/D22 already used for story-language independence, now extended to the
UI catalogue itself), and that it removes rather than adds a confound for the alpha cohort, who are
realistically reachable in Vietnam/SEA (D2). A Vietnamese-comfortable tester using a native UI
separates "I don't like this product" from "I can't read this button" more cleanly than the
English-only plan did.

**Alternatives considered**: keep English-only UI through MVP as M0 specified (rejected — the owner
overruled this after M0 closed; the language-friction tension D2 recorded as "not resolved" is
exactly what a second catalogue reduces); ship Vietnamese as the *only* launch UI language
(rejected — would contradict the global-product commitment and is not what the owner asked for);
machine-translate the English catalogue into Vietnamese at build time (rejected — see D34; this
project's Vietnamese must read as native-authored copy, not translated copy, per the owner's
explicit rejection of "Google Translate"-quality text).
**Status**: ACCEPTED. Governs LW-M1-R1 §6 (bilingual i18n foundation) and every UI-copy decision
from this point forward.

## D34 — Story Generation Is Native-Language-First, Not Translate-First

**Decision**: when Lorewish generates story prose (M2+), it generates **directly in the story's
`content_language`** (D22). English stories are generated in English; Vietnamese stories are
generated in Vietnamese. There is no default pipeline that generates in English and machine-
translates into Vietnamese (or any other language). This is a generation-architecture decision,
recorded now — before any AI provider is called — so the M2 prompt-construction layer does not
default into the cheaper-looking translate-first shape.

**Rationale**: the owner has directly used and rejected the quality of translate-first / literal-
translation output — it reads as AI boilerplate, as machine translation, and specifically as
"Google Translate," none of which the product can ship as its Vietnamese voice. Natural narrative
language is a stated product requirement, not a nice-to-have: prose must read as native-authored
in whichever language the story is running in, with native idiom, sentence rhythm, and — critically
for Vietnamese — a correctly modeled system of address (see
[NARRATIVE_QUALITY_CONTRACT.md](NARRATIVE_QUALITY_CONTRACT.md) §C), which a translation pass over
English pronouns cannot reconstruct because English does not encode the relationship information
Vietnamese address terms carry.

**What this does not require**: identical sentence-by-sentence content between an English and a
Vietnamese instance of "the same" sample scene. Intent, character, story facts and tone are
preserved; phrasing, idiom and structure are native to each language (see
[NARRATIVE_QUALITY_CONTRACT.md](NARRATIVE_QUALITY_CONTRACT.md) §E). This decision governs generation
architecture, not a translation-parity QA bar.

**No AI provider is selected or called by this decision** — it constrains the shape of the M2
prompt-construction and generation-gateway design ([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
§5) so that `content_language` is a generation input from the first prompt template, not a
post-processing translation step bolted on later.

**Alternatives considered**: generate in English and translate into other content languages on
demand (rejected — this is exactly the pattern the owner rejected firsthand; it is also cheaper to
build, which is precisely why it needed to be explicitly foreclosed before M2 prompt work begins,
not left to default); generate natively only for English and Vietnamese, translate-first for any
future language (rejected as a standing rule — acceptable only as a documented, temporary,
per-language exception if a future language genuinely lacks generation quality, never as the
default architecture).
**Status**: ACCEPTED. No engineering action in LW-M1-R1 (no AI provider is called); governs M2 AI
gateway and prompt-construction design. See
[NARRATIVE_QUALITY_CONTRACT.md](NARRATIVE_QUALITY_CONTRACT.md) for the full product/engineering
contract this decision anchors.

---

## D35 — App Icon And Splash Assets Are PLACEHOLDER, Not Final Identity

**Decision**: the app icon, adaptive-icon layers, splash image, and favicon shipped in
`assets/images/` and `assets/expo.icon/` since LW-M1-R1 are the **Expo scaffold's default
template assets** (`npx create-expo-app`'s stock icon/splash artwork, not a designed Lorewish
mark). They are acceptable to keep as temporary M1 placeholders — no design task was spent on a
final logo in LW-M1-R1 or LW-M1-R2 — but they are explicitly marked here as
**PLACEHOLDER — MUST REPLACE BEFORE EXTERNAL BETA**, so no later reader of `app.json`,
a build artifact, or a screenshot mistakes them for an intentional final Lorewish visual identity.

**Rationale**: `app.json`, the EAS build outputs, and the Android/iOS build evidence in
`handoff/LW-M1-R2/` all reference or display these assets as a side effect of getting the native
foundation to compile and run — not because a branding decision was made. Leaving that ambiguous in
documentation risks a future task (or an external tester) treating the stock template icon as the
shipped brand.

**What this does not do**: it does not schedule, staff, or scope the actual logo/identity design
work — that remains an explicitly separate future task, not implied to be small or already
underway.

**Status**: ACCEPTED. No design action taken. Tracked as a standing M1→beta blocker: the assets at
`./assets/images/icon.png`, `./assets/images/android-icon-*.png`, `./assets/images/favicon.png`,
`./assets/images/splash-icon.png`, and `./assets/expo.icon/` must be replaced with a designed
Lorewish identity before any external beta distribution (TestFlight external group, Play Store
open/closed testing beyond internal, or any public build link).
