# Reference Product Notes — "My Adventures"

Status: PROVISIONAL (created by LW-M0-R2)
Last updated: 2026-08-10 (owner research assimilated by LW-M0-R3)

Adjacent-product research notes. **Lorewish is not a clone of this product**, and nothing in this
document authorizes copying its implementation, its interface, or any of its content.

## How To Read This Document

Every statement carries an evidence tag. The tags are load-bearing — the failure mode this document
exists to prevent is an inferred detail hardening into an assumed requirement two milestones later.

| Tag | Meaning |
|---|---|
| **[VERIFIED PUBLICLY]** | Observable in publicly accessible material without an account. Supplied to this project as publicly-verifiable description; not independently re-verified by the review session, which did no external browsing. |
| **[OWNER-PROVIDED RESEARCH]** | Supplied by the product owner from their own use of the product. **No longer empty as of 2026-08-10** — see §4. Within that section the sub-tags below apply. |
| **[INFERENCE / HYPOTHESIS]** | Reasoning by the review, not observation. **Never a requirement.** Must be confirmed by evidence or by an independent Lorewish product decision before it influences a build. |

Inside §4, every statement additionally carries one of three sub-tags. This separation is the whole
point of the section — an interpretation must never be readable as an observation:

| Sub-tag | Meaning |
|---|---|
| **[DIRECTLY OBSERVED]** | Visible in the owner's recording. A statement about what the screen did, not about why. |
| **[OWNER INTERPRETATION]** | The owner's reading of what they saw, including how it felt to use. Real evidence about the owner's experience; not a claim about the other product's internals. |
| **[LOREWISH PRODUCT DECISION]** | What Lorewish does about it. Owned by this repository, justified here, and binding only through the document it lands in. |

## Copyright And Competitive Boundaries

- No story text, character, world, image or other creative content from the reference product is
  reproduced here or anywhere in this repository, in whole or in part.
- Only **high-level structural and interaction patterns** are recorded — the kind of information a
  category description would contain. Structural patterns of this generality (a scene, a set of
  choices, a branching consequence) are common to interactive fiction generally and are not
  proprietary to any product.
- Interface details, copy, and visual design are **not** to be reproduced.
- Where Lorewish converges on a similar structure, it is because the structure is inherent to the
  category — and where it diverges, the divergence is the product thesis.

---

## 1. High-Level Flow — [VERIFIED PUBLICLY]

```
Create or Discover
  → AI generates scene
  → choose a predefined choice or type a custom action
  → continue a branching story
  → chat with characters
  → publish / share / fork
```

## 2. Published Story Structure — [VERIFIED PUBLICLY]

Publicly published stories expose a structure resembling:

```
story metadata
  → Scene
      → scene image, where applicable
      → multiple available choices
      → consequence / next scene
      → additional choices
```

## 3. What This Evidence Does And Does Not Support

**Supports** — the category's basic shape is settled, and Lorewish's core loop
([CORE_LOOPS.md](CORE_LOOPS.md) §1) matching it is convergence on a proven structure rather than
imitation. Scene → choice → consequence → branch is how the category works.

**Does not support** — anything about the logged-in experience. *(Superseded in part by §4: the
2026-08-10 owner recording covers the logged-in experience directly. The list below is retained
with its status updated, rather than deleted, so the provenance of each item stays visible.)*

| Item | Status |
|---|---|
| creation flow and its field set | **Observed** — §4.4 |
| generation loading and latency presentation | Unknown |
| mobile composer behaviour | Unknown |
| dice/roll presentation, if any | **Observed** — §4.5 |
| character chat interface and its relationship to story state | Affordance observed (§4.1); its relationship to story state unknown |
| branch/fork mechanics as experienced by a user | **Observed** — §4.3 |
| credit or allowance model and its surfacing | Surfacing observed (§4.6); the pricing model itself unknown and not sought |
| settings and account management | Unknown |

Several of these are precisely where Lorewish makes its differentiating bets — the composer (P7),
canonical memory (P3/P4), and standalone character chat (P5). **This is fortunate rather than
limiting**: those decisions were derived from user pain points in
[USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md), not from observing a competitor, and they
should stay that way. A design justified by "the reference product does it" is a weaker design than
one justified by a user problem.

## 4. Owner-Provided Research — [OWNER-PROVIDED RESEARCH]

### 2026-08-10 — mobile app, owner screen recording

**Provenance.** The product owner downloaded the adjacent mobile product, used it directly, and
supplied a screen recording of roughly three minutes together with a written report of what
frustrated them. This is first-hand evidence of a real user's session, and it is the strongest
evidence in this document.

**Scope limits, stated up front.** Three minutes of one person's session on one device. It shows
that certain behaviours *can* occur; it does not establish how often they occur, what triggers
them, or whether they are the product's intended design. Nothing here licenses a claim about the
other product's internal architecture, data model, or business results.

**Handling.** The recording itself is **not stored in this repository** and is not included in any
handoff archive. No competitor story prose, character, world, artwork, interface copy or visual
design is reproduced anywhere in this repository. What follows is a product/interaction record only.

---

#### 4.1 Reading experience and information hierarchy

- **[DIRECTLY OBSERVED]** The published/reading experience carries, in one surface: large narrative
  text blocks, scene cards, choice cards, a custom free-text action affordance, a character-chat
  affordance, a text-to-speech control, inventory/state affordances, dice/randomness presentation,
  and a branch/fork action.
- **[DIRECTLY OBSERVED]** Narrative content, game-like state information and other metadata occupy
  the same visual field and compete for attention.
- **[OWNER INTERPRETATION]** The volume and hierarchy of information make the story hard to parse.
  The reading task and the state-tracking task interfere with each other.
- **[LOREWISH PRODUCT DECISION]** Lorewish adopts an explicit **Scene Readability Contract** —
  five separated content channels (narrative, dialogue, system/state change, roll result, player
  action), a fixed vertical order, and a hard rule that state notation never appears inside prose.
  See [UX_CONTRACT.md](UX_CONTRACT.md) §1A. This is a strengthening of P1 (story text is the hero),
  not a new principle.

#### 4.2 The continuation problem — the highest-signal finding

- **[DIRECTLY OBSERVED]** After choices, actions and branch continuations, the experience
  repeatedly arrives at a "to be continued"-style card that reads as terminal.
- **[DIRECTLY OBSERVED]** The actions visible at that point emphasise returning to the story or
  viewing the whole story, rather than making the next playable action obvious.
- **[OWNER INTERPRETATION]** The interaction feels as though the story has unexpectedly stopped.
  The owner's report, verbatim: *"phân nhánh xong câu truyện dừng luôn toàn hiện to be continued"* —
  "after branching, the story just stops; it always shows to be continued."
- **[OWNER INTERPRETATION]** This is the single most damaging thing observed, because it breaks the
  loop the whole product exists to deliver. A player who cannot tell whether the story ended or
  broke has no reason to try the next tap.
- **[LOREWISH PRODUCT DECISION]** Lorewish defines a **[Continuous Play
  Contract](CONTINUOUS_PLAY_CONTRACT.md)**: every turn resolves into exactly one of five explicit
  application states, ending language is scoped to `TERMINAL_ENDING` alone, failure states are
  never persisted and therefore can never re-read as endings, and "to be continued" is prohibited
  as user-facing copy in every state. This is the most consequential product change made in
  response to this recording.

#### 4.3 Branch/fork comprehension

- **[DIRECTLY OBSERVED]** The product exposes an explicit story branching/fork action.
- **[DIRECTLY OBSERVED]** Branching can lead into account/onboarding steps and into what presents
  as a separate story copy or continuation context.
- **[OWNER INTERPRETATION]** The resulting mental model is not obvious. It is unclear what was
  created, what is now being played, and what relationship it has to the original.
- **[NOT SUPPORTED BY THIS EVIDENCE]** Anything about the other product's database design, copy
  semantics or ownership model. Do not infer it and do not record a guess.
- **[LOREWISH PRODUCT DECISION]** Player timeline branching must be conceptually simpler. Lorewish
  separates two concepts with non-overlapping vocabulary: **"Replay from here"** (player, MVP, a
  pure state operation that lands directly in the reading view and consumes no allowance) and
  **fork/remix** (creator, M5, an editable derivative of a published story). The player is never
  asked to understand copies, versions or ownership. See
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §6 and [DECISIONS.md](DECISIONS.md)
  D27.

#### 4.4 Story creation surface

- **[DIRECTLY OBSERVED]** The creation surface is comparatively shallow, visibly focused on a small
  number of inputs — a world/background description, a player character, and an
  illustration-generation toggle.
- **[OWNER INTERPRETATION]** This is thinner than what the owner wanted to specify before playing.
- **[LOREWISH PRODUCT DECISION]** This independently corroborates pain point #1 in
  [USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md) §3 — the request for control over role,
  characters, starting situation, world, genre and narrative context. It reinforces existing
  scope; it adds none. The answer remains the two-mode model now named as **P2 — Control Without
  Complexity** ([PRODUCT_VISION.md](PRODUCT_VISION.md) §9): Quick Start for speed, Advanced Setup
  for control. Note the direction of evidence: this observation *confirms* a decision already made
  from user research, which is the only way a competitor observation is allowed to influence this
  product (§7 rule 1).

#### 4.5 Randomness presentation

- **[DIRECTLY OBSERVED]** A dice/fate animation with a numerical result is presented.
- **[OWNER INTERPRETATION]** This interaction is comparatively easy to understand — one of the
  clearer parts of the experience.
- **[LOREWISH PRODUCT DECISION]** No change. Lorewish keeps the optional **Light Roll** direction
  as specified ([DECISIONS.md](DECISIONS.md) D6, [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) §6):
  one check, three outcome bands, Adventure mode only, inline between action and consequence. The
  observation supports the existing decision rather than changing it.

#### 4.6 Credit surfacing next to acts of agency

- **[DIRECTLY OBSERVED]** Credits are visibly associated with high-value actions, including custom
  actions, character interaction and branching.
- **[OWNER INTERPRETATION]** Attaching a visible price to individual acts of agency makes the act
  of playing feel metered.
- **[NOT SUPPORTED BY THIS EVIDENCE]** Anything about whether that pricing works commercially. A
  three-minute session says nothing about conversion, and this product's pricing is not being
  copied in any case.
- **[LOREWISH PRODUCT DECISION]** During normal play, Lorewish communicates a **usage allowance**,
  not a per-action price. No numeric cost is rendered beside a predefined choice, a custom-action
  Send control, or a character-chat send control. Cost becomes explicit only when the allowance is
  low or exhausted, in a surface outside the action controls. MVP remains a free daily allowance
  with no payment surface at all; nothing here is implemented now. See [UX_CONTRACT.md](UX_CONTRACT.md)
  §12 and [DECISIONS.md](DECISIONS.md) D28.

#### 4.7 Discovery empty state

- **[DIRECTLY OBSERVED]** At least one discovery/filter surface reaches a "no stories" empty state
  while public content plainly exists elsewhere in the product.
- **[NOT SUPPORTED BY THIS EVIDENCE]** Any claim that the catalogue as a whole is empty. It is not,
  and this document does not say so.
- **[LOREWISH PRODUCT DECISION]** During a small-content launch, Lorewish does not expose discovery
  sections or filter chips that resolve to zero results. Filter chips are derived from content
  actually present. Where an empty state is genuinely unavoidable, it must carry a useful action
  (start a sample story, Quick Start) rather than a bare "nothing here". See
  [UX_CONTRACT.md](UX_CONTRACT.md) §10 and [DECISIONS.md](DECISIONS.md) D29.

#### 4.8 Visual content

- **[DIRECTLY OBSERVED]** Static illustrations are present throughout.
- **[OWNER INTERPRETATION]** Visual richness does not solve the comprehension and continuity
  problems. The story was still hard to follow and still appeared to stop.
- **[LOREWISH PRODUCT DECISION]** Image volume is not a substitute for readable narrative
  structure. [DECISIONS.md](DECISIONS.md) D9 (one image per key scene/checkpoint) is unchanged, and
  this observation adds a second, independent reason for it beyond scope discipline: more images
  would not have fixed what was actually wrong.

---

**What this recording did *not* show**, and therefore what remains unknown: composer behaviour on
long input, generation latency presentation and whether it blocks interaction, the internal
relationship between character chat and story state, and the full account/onboarding flow. These
stay in §5.

## 5. Open Questions — Remaining After The 2026-08-10 Recording

Four of the original six questions are now answered by §4 and are struck through below with the
section that answers them. Listed as questions, deliberately not as guesses:

1. ~~How is randomness presented, if at all?~~ — answered, §4.5.
2. ~~How is branching surfaced?~~ — partially answered, §4.3: an explicit action exists, but its
   resulting model was not comprehensible to the owner, which is the finding.
3. ~~What is the credit/allowance model and where does it appear in the flow?~~ — the *surfacing*
   is answered, §4.6. The pricing model itself is neither known nor wanted.
4. ~~Is character chat a separate surface or embedded in the story flow?~~ — an affordance was
   observed, §4.1; whether it writes story state was not observable.
5. **Still open**: is the composer single-line or multi-line, and how does it behave on long input?
   This is the specific pain point Lorewish claims as a differentiator (P7), and the recording did
   not exercise it.
6. **Still open**: how is generation latency presented, and does it block interaction?

Neither remaining question blocks anything. Lorewish's answers to both are derived from
[USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md) and its own UX contract, which is where
they should come from (§7 rule 1).

## 6. Inferences — [INFERENCE / HYPOTHESIS], Not Requirements

Recorded so they can be checked and discarded, not built on:

- **H-REF-1**: the published-story structure implies scenes are durable, addressable records rather
  than transcript fragments. *Consistent with* Lorewish's materialized-Scene model
  ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §2), but Lorewish's model is justified independently by the
  canonical-state principle (P3) and does not depend on this inference being correct.
- **H-REF-2** *(revised by LW-M0-R3)*: previously an inference that "fork" was creator-side remix
  rather than player-side replay. §4.3 supersedes it with observation: a branching/fork action
  exists, it can lead into account/onboarding and a separate continuation context, and its mental
  model was not comprehensible to the owner. What the two concepts are *in that product* remains
  unknown and is not worth determining. The Lorewish distinction — **"Replay from here"** as a
  player mechanic in MVP, **fork/remix** as a creator mechanic at M5 — stands as a Lorewish
  decision (D27), now with independent evidence that conflating them confuses real users.
- **H-REF-3**: "scene image where applicable" suggests images are not present on every scene.
  Lorewish independently scopes to one image per key scene/checkpoint
  ([DECISIONS.md](DECISIONS.md) D9) for scope and quality reasons, not because of this observation.

## 7. Rules For Using This Document

1. **No requirement may cite this document as its sole justification.** A Lorewish feature needs a
   user problem, a product decision, or an architectural constraint behind it.
2. **[INFERENCE / HYPOTHESIS] items never become specifications** without independent evidence.
3. **Do not add speculative detail.** An empty section is more useful than a plausible invention —
   the latter is indistinguishable from evidence three months later.
4. **No competitor creative content enters this repository**, in any form, at any time.
