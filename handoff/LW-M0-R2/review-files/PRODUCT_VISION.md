# Lorewish — Product Vision

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2)

## 1. Product Problem

People who enjoy tabletop-style storytelling — fantasy quests, romance arcs, mystery investigations,
character-driven adventure — routinely cannot get it when they want it:

- No group is available (scheduling a D&D-style session is hard; solo desire is immediate).
- Existing interactive-fiction apps give branching text but little sense of a character who
  *remembers you*, and little control over what world/role you start in.
- Existing AI-roleplay/companion apps give freeform character chat but little narrative structure,
  consequence, or sense of a story progressing toward something.

The gap is the space between "static branching fiction" and "unstructured character chat": a solo
player wants to **enter a world, play a role, make choices that matter, talk to characters who
remember them, and see the story change because of what they did** — without needing other humans,
and without first learning a rules system.

## 2. Product Promise

**"Enter a world that remembers you."**

Lorewish lets a solo player start or pick an interactive story in under a minute, play a character
inside it, make real choices (predefined or free-typed), and have the world — its characters,
relationships, and facts — persist and react across sessions. The application, not the AI chat log,
is the thing that remembers.

## 3. Primary Wedge

**Solo interactive roleplay**, not tabletop simulation:

> "I have a world or story I want to experience, but I don't have a group to play with. I want to
> enter that world immediately, roleplay as a character, interact with AI characters, make
> meaningful choices, and have the story remember what happened."

D&D-adjacent mechanics (dice, stats, inventory, quests) are **optional flavor available inside**
this wedge, not the product's identity. The base product is:

```
AI INTERACTIVE STORY + SOLO ROLEPLAY + CHARACTER INTERACTION
```

## 4. Why This Is Not Simply "AI D&D"

- D&D and D&D-inspired products are built around a **rules engine** (turn order, dice-resolved
  combat, character sheets) that most casual readers of fantasy/romance/adventure fiction never
  asked for and find intimidating.
- Our evidence (see [USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md)) shows the loved
  features are **narrative agency and character memory**, not mechanical depth — dice/rolls are
  liked as *light seasoning* ("novelty of the interaction model"), not as the reason people return.
- Positioning as "AI D&D" would also anchor discovery/marketing to a niche (existing tabletop
  players) that is smaller and more male-skewed than our target genre mix (fantasy **+ romance +
  adventure**, mainstream 13+), and would set the wrong expectation for mystery/sci-fi/comedy/slice
  of life stories where dice have no place at all.
- Instead, randomness is one of three selectable **story modes** (Narrative / Adventure / RPG,
  see [P6](#9-product-principles-p1p10)). **MVP ships two modes only — Narrative and Adventure.**
  RPG is a reserved third mode name, not an MVP feature, and RPG-depth mechanics are explicitly
  deferred past MVP (see [MVP_SPEC.md](MVP_SPEC.md) §1.6 and [UX_CONTRACT.md](UX_CONTRACT.md) §5).

## 5. Secondary Users (Not the MVP Focus)

- **Creators**: users who want to design worlds/characters for others to play. Supported only
  minimally in MVP (private authoring for their own play); public publishing is a later milestone
  (see [ROADMAP.md](ROADMAP.md) M5).
- **Character-chat-first users**: users who arrive mainly to talk to a character rather than
  progress a plot. Supported as a first-class surface (P5) but not the primary funnel in MVP.
- **Lurker/discovery users** who browse curated stories without creating: supported via sample
  stories, full discovery (search, ML recommendation) deferred to M6.

## 6. Initial Genre Scope

Primary: **fantasy, romance, adventure**.
Also compatible from day one (same mechanics, no special-casing required): **mystery, science
fiction, comedy, slice of life**.
Content rating: **13+ mainstream**. **18+ content is explicitly out of scope** for the initial
product — not deferred as "later," but excluded from the content policy, moderation design, and
monetization model until a separate, deliberate product decision reopens it.

## 7. Differentiation Hypotheses

These are hypotheses to validate, not proven claims:

1. **Canonical state beats prompt memory.** Competing products that lean on one long LLM
   conversation degrade in consistency (pronouns, relationships, forgotten facts) as stories grow.
   Owning structured canonical state (P3/P4) should measurably reduce these consistency complaints
   versus the adjacent product our research is drawn from.
2. **Two-speed story setup (Quick Start vs Advanced Setup) increases both activation and
   retention.** Users who complete a fast start won't abandon at a blank page; users who want
   control (the single most common pain point in our research) get it without forcing complexity
   on everyone.
3. **Character chat as a first-class, canon-aware surface** is a distinct retention loop from story
   progression — some users will return primarily to talk to a character, not to advance a plot.
4. **Editable story configuration** (fixing an unwanted assigned role/scene after generation)
   removes a top reported abandonment cause at negligible engineering cost relative to its value.
5. **A mobile-first composer built around long-form input** is a durable UX advantage in a category
   where competitors visibly ship one-line composers.

## 8. Non-Goals (Product-Level)

- Not a tabletop rules simulator (no mandatory dice/stat system).
- Not a social network first (no feed/follow/comments graph in MVP).
- Not a creator marketplace or monetized publishing platform in MVP.
- Not a video generation product (no AI video, MVP or near-term).
- Not an 18+ platform.
- Not architected only for web-then-port; Android/iOS are first-class from the first implementation
  milestone (P9).
- Not designed for hypothetical millions of users on day one — see
  [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) for the explicit scale posture.

## 9. Product Principles (P1–P10)

> **Provenance note (added by LW-M0-R2).** The M0 document set referenced `P1`–`P10` more than
> thirty times across nine documents without ever defining them — every such reference resolved to
> nothing. The definitions below are **reconstructed from how each identifier is used** in those
> documents, so that the existing cross-references become resolvable. They are *inferred*, not
> quoted from an original brief. If the product owner holds an original P-list, it supersedes this
> section and any divergence must be reconciled before M1.

| ID | Principle | Primary references |
|---|---|---|
| **P1** | **Reading-first.** Story text is the hero of the experience; navigation and chrome must never compete with it for viewport or attention. | [UX_CONTRACT.md](UX_CONTRACT.md) §1, [MVP_SPEC.md](MVP_SPEC.md) §4, [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) §5 |
| **P2** | *Not referenced anywhere in the M0 document set.* No usage exists from which to reconstruct a meaning. **Owner input required** — either supply the original P2 or accept that the identifier is unused. | — |
| **P3** | **Canonical state is ours.** Story, character, relationship and branch state live in our persistence layer as structured rows. AI providers never own product state. | [DOMAIN_MODEL.md](DOMAIN_MODEL.md), [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §6, [DECISIONS.md](DECISIONS.md) D14 |
| **P4** | **Character identity is structured data, not prose.** Pronouns, canonical name, aliases, forms of address and relationship state are fields the application controls, not paragraphs the model re-infers. | [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4 |
| **P5** | **Character chat is a first-class surface**, addressable independently of story progression. | [CORE_LOOPS.md](CORE_LOOPS.md) §3, [DECISIONS.md](DECISIONS.md) D7 |
| **P6** | **Story modes gate randomness.** Narrative (no randomness) and Adventure (light rolls) ship in MVP; RPG is a reserved name for a post-MVP mode. No mandatory rules system. | §4 above, [DECISIONS.md](DECISIONS.md) D6 |
| **P7** | **Long-form input is a first-class interaction.** The composer is built for multi-line, paste-heavy, keyboard-safe authoring on mobile. | [UX_CONTRACT.md](UX_CONTRACT.md) §2–3 |
| **P8** | **Genre/category taxonomy exists from launch** as stable, locale-independent keys with localized display labels. | [UX_CONTRACT.md](UX_CONTRACT.md) §10, [MVP_SPEC.md](MVP_SPEC.md) §1.10 |
| **P9** | **Android, iOS and Web are first-class targets from the first implementation milestone** — not a web build with native added later. | [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §2, [ROADMAP.md](ROADMAP.md) M1 |
| **P10** | **Lightweight motion only.** Motion improves immersion cheaply, never at the cost of low-end device performance, battery, or Reduce-Motion users. No AI video. | [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) |

**Namespace rule (LW-M0-R2).** `P<n>` identifiers mean *product principles* and nothing else
anywhere in this repository. The requirement-priority tiers in
[USER_RESEARCH_SYNTHESIS.md](USER_RESEARCH_SYNTHESIS.md) §6 were renamed `R0/R1/R2` to remove a
direct collision with `P0/P1/P2`.

## 10. Global Product, Seeded Test Cohort

Lorewish is designed as a **global product from the first implementation milestone**. This is a
product and architecture commitment, and it is deliberately separated from where the first testers
happen to come from:

| Dimension | Commitment |
|---|---|
| **Product positioning** | Global. English-first user interface. No region-specific product identity. |
| **Technical readiness** | i18n scaffolding from M1 (externalized strings, locale-independent taxonomy keys, UTC-normalised timestamps, Unicode/IME-safe input). See [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §12. |
| **Story content language** | A per-story property, independent of UI locale — a player may play in a language the UI does not yet ship. See [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §8. |
| **Initial alpha cohort** | Whoever the owner can actually recruit and interview. Realistically Vietnam/SEA, because that is the owner's reach. This is a **recruiting convenience, not a market strategy**. |
| **What the seed cohort does *not* decide** | UI language, genre taxonomy, monetization design, data residency, or any architectural regionalisation. |

The single genuine tension this creates is recorded honestly rather than papered over: an
English-only UI tested on a cohort that is not natively English-speaking measures *language
friction* alongside product value, and the two are hard to separate. See
[MVP_SPEC.md](MVP_SPEC.md) §5 for how the Alpha handles this. Superseding
[DECISIONS.md](DECISIONS.md) entry: **D2 (revised)**.
