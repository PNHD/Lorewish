# Reference Product Notes — "My Adventures"

Status: PROVISIONAL (created by LW-M0-R2)
Last updated: 2026-08-10

Adjacent-product research notes. **Lorewish is not a clone of this product**, and nothing in this
document authorizes copying its implementation, its interface, or any of its content.

## How To Read This Document

Every statement carries an evidence tag. The tags are load-bearing — the failure mode this document
exists to prevent is an inferred detail hardening into an assumed requirement two milestones later.

| Tag | Meaning |
|---|---|
| **[VERIFIED PUBLICLY]** | Observable in publicly accessible material without an account. Supplied to this project as publicly-verifiable description; not independently re-verified by the review session, which did no external browsing. |
| **[OWNER-PROVIDED RESEARCH]** | Supplied by the product owner from their own observation. Currently **empty** — no screen recording or account-gated observation has been provided. |
| **[INFERENCE / HYPOTHESIS]** | Reasoning by the review, not observation. **Never a requirement.** Must be confirmed by evidence or by an independent Lorewish product decision before it influences a build. |

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

**Does not support** — anything about the logged-in experience. The following are **unknown** and
must not be assumed:

- creation flow and its field set
- generation loading and latency presentation
- mobile composer behaviour
- dice/roll presentation, if any
- character chat interface and its relationship to story state
- branch/fork mechanics as experienced by a user
- credit or allowance model and its surfacing
- settings and account management

Several of these are precisely where Lorewish makes its differentiating bets — the composer (P7),
canonical memory (P3/P4), and standalone character chat (P5). **This is fortunate rather than
limiting**: those decisions were derived from user pain points in
[USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md), not from observing a competitor, and they
should stay that way. A design justified by "the reference product does it" is a weaker design than
one justified by a user problem.

## 4. Owner-Provided Research — [OWNER-PROVIDED RESEARCH]

*(Empty. If the owner supplies a screen recording, observations go here, dated, with a note of what
was directly visible versus interpreted. Until then this section stays empty rather than being
filled with plausible-sounding description.)*

## 5. Open Questions A Recording Could Answer

Listed as questions, deliberately not as guesses:

1. How is generation latency presented, and does it block interaction?
2. Is the composer single-line or multi-line, and how does it behave on long input? — the specific
   pain point Lorewish claims as a differentiator.
3. Is character chat a separate surface or embedded in the story flow, and does it affect story
   state?
4. How is branching surfaced — an explicit history/checkpoint list, or implicit?
5. What is the credit/allowance model and where does it appear in the flow?
6. How is randomness presented, if at all?

## 6. Inferences — [INFERENCE / HYPOTHESIS], Not Requirements

Recorded so they can be checked and discarded, not built on:

- **H-REF-1**: the published-story structure implies scenes are durable, addressable records rather
  than transcript fragments. *Consistent with* Lorewish's materialized-Scene model
  ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §2), but Lorewish's model is justified independently by the
  canonical-state principle (P3) and does not depend on this inference being correct.
- **H-REF-2**: "fork" in the published structure appears to be a creator-side remix rather than a
  player-side replay. Lorewish distinguishes these explicitly — **branch/replay** is a player
  mechanic in MVP, **fork/remix** is a creator mechanic at M5. The distinction is a Lorewish
  decision, not a reading of the reference product.
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
