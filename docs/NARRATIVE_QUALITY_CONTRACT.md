# Narrative Quality Contract

Status: PROVISIONAL (M1 product/engineering contract)
Created: 2026-08-10 by LW-M1-R1
Applies from: **M2** (the first milestone that generates a scene), enforced for the life of the
product.

This document specifies **how generated story prose must behave**, the way
[CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) specifies what state the application is
in and [UX_CONTRACT.md](UX_CONTRACT.md) specifies how surfaces behave. It exists because of a
direct owner instruction, not an observed competitor failure: generated prose must never read as
"AI boilerplate," literal machine translation, "Google Translate," or generic LLM narration — in
either shipped language. It is a contract, not an aspiration, for the same reason
[CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) is: undocumented quality expectations
are the ones that get optimized away under delivery pressure, and this one anchors two decisions
already recorded in [DECISIONS.md](DECISIONS.md) — **D33** (English + Vietnamese ship from
foundation) and **D34** (story generation is native-language-first, not translate-first).

**No AI provider is called by the task that wrote this document.** This is a design contract for
the M2 generation layer to be built against, not a report on any model's actual output.

---

## A. Direct-Language Generation

> **Story prose is generated directly in `content_language`. There is no default translate-first
> pipeline.**

- When a Story's `content_language` is English, scene prose, generated choice options, and
  character chat replies are generated in English.
- When `content_language` is Vietnamese, the same capabilities generate directly in Vietnamese —
  not generated in English and then machine-translated.
- This applies to every generation capability defined in
  [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §5: `generateStorySceneProposal`,
  `generateChoiceOptions`, `characterChatReply`. `moderateContent` and `generateSceneImage` are
  exempt (moderation and image prompts are not narrative prose).
- **A translation pass over generated prose is never the default architecture for any shipped
  language.** See D34 for the narrow, explicitly-documented exception this leaves open for a
  future language that genuinely lacks generation quality — it does not apply to English or
  Vietnamese at launch.
- `content_language` is a required input to every prompt template from the first version built,
  not a parameter added after an English-only template already exists. Retrofitting a second
  language into a language-blind template is exactly the trap this section exists to prevent.

---

## B. Language Profiles

A **narrative generation profile** is the bundle of generation-time controls that shapes how a
capability's output reads for a given story and language. This section defines the *concepts* the
profile must eventually carry; it is a generation-controls model, not a user-facing form.

**Do not expose these as a giant settings form.** Most fields here are either derived from existing
`StoryConfiguration` fields (genre, POV, tone → narrative register), fixed per `content_language`
(dialogue register defaults, forms-of-address defaults), or internal generation policy the player
never sees (forbidden meta phrases, continuity requirements). The player-facing surface remains
exactly what [UX_CONTRACT.md](UX_CONTRACT.md) §5 already specifies for Advanced Setup — this
section does not add new fields to that table.

| Concept | Source | Notes |
|---|---|---|
| `content_language` | `StoryConfiguration` / `Story` (D22) | `en` \| `vi` at launch. |
| `genre` | `StoryConfiguration` | Fantasy / Romance / Adventure / Mystery / Sci-fi / Comedy / Slice of Life ([UX_CONTRACT.md](UX_CONTRACT.md) §5). |
| `pov` | `StoryConfiguration` (Narrative POV field) | Second/first/third person. |
| `tense` | Derived, or a fixed per-profile default | Not a user field; a generation-consistency control so a run does not drift between past and present tense mid-story. |
| `narrative register` | Derived from `tone` (Light/Balanced/Dark) + genre | How formal/literary vs. plain the narration reads. |
| `dialogue register` | Derived from `content_language` + character formality state (§C) | Distinct from narrative register — a character's speech can be more casual or more formal than the surrounding prose. |
| `pacing` | Fixed generation policy, informed by [UX_CONTRACT.md](UX_CONTRACT.md) §1A chunking guidance | Paragraphs of roughly 40–90 words, a typical turn landing around 2–5 paragraphs — pacing guidance, not a truncation rule, per the existing Scene Readability Contract. |
| `sentence rhythm` | Fixed per `content_language`, not per English template translated | Native sentence-length and clause-structure conventions differ by language; this is the concept D34 exists to protect. |
| `character speech traits` | `Character` fields (canonical name, aliases, default speaking style — [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §1, P4) | Structured, not re-inferred per call. |
| `formality` | `CharacterRelationship` (run-scoped) state | How formal the *current* relationship is, distinct from the character's static default. |
| `forms of address` | `CharacterRelationship` (run-scoped) — `addresses_player_as` and the player-facing equivalent | See §C; this is the field the Vietnamese address model is built on. |
| `forbidden meta phrases` | Fixed generation policy (§D) | e.g. "as an AI," "I cannot," narrator-breaking commentary. |
| `continuity requirements` | Assembled from `CanonFact` + `CharacterRelationship` per turn ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4–5, §7) | Not new state — this is the existing bounded-context-assembly mechanism, named here because the quality gate (§D) checks against it. |

**Internal adherence/policy parameters** (per [DECISIONS.md](DECISIONS.md) D25) may live in gateway
configuration alongside this profile if useful for prompt construction. They are not part of this
profile's user-facing surface and are not a route for the removed "AI freedom" control to reappear.

---

## C. Vietnamese Address Model

English relationship state can be adequately represented as pronouns plus a relationship label.
Vietnamese cannot: address terms in Vietnamese *are* the relationship — they encode relative age,
social role, formality, and affection simultaneously, and they are frequently asymmetric (the two
people in a conversation do not use the same word for themselves or for each other). Modeling
Vietnamese character relationships as English-style pronouns would silently discard the exact
information P4 ([PRODUCT_VISION.md](PRODUCT_VISION.md) §9) exists to keep consistent, and it would
make Vietnamese output read as translated-from-English even when it wasn't — the "Google Translate"
failure mode the owner explicitly rejected.

### The four-slot model

For any two parties in a conversation (player ↔ character, or character ↔ character), the domain
model must be able to represent **four independent slots**, because Vietnamese address is not
generally symmetric:

| Slot | Meaning |
|---|---|
| **Speaker → self-reference** | The word the speaker uses for themself when addressing this specific listener |
| **Speaker → address-target-as** | The word the speaker uses for the listener |
| **Target → self-reference** | The word the *listener* uses for themself when they reply |
| **Target → address-target-as** | The word the *listener* uses for the speaker |

This is a same-shaped extension of the existing `CharacterRelationship` (run-scoped) entity
([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §2, §4) — `addresses_player_as` already exists as a structured
field for exactly this purpose; the address model formalizes it into the full four-slot pair rather
than a single implied direction, and generalizes it to character↔character pairs for future scenes
with multiple NPCs present.

### Worked example (illustrative only — not a global default)

> Character → Player: self-reference "mình", address-player-as "cậu".
> Player → Character: self-reference "tôi", address-character-as "chị".

This illustrates the shape, not a value to hard-code. **Do not globally default every
character/player pair to this example.** The correct default is genre- and relationship-appropriate
and must be settable per `CharacterRelationship`, changeable as the relationship evolves during
play (the same way `addresses_player_as` already updates mid-story per
[DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4), and must never regress silently — a change in address terms
is exactly the kind of state change the Scene Readability Contract's SYSTEM channel
([UX_CONTRACT.md](UX_CONTRACT.md) §1A) is for.

### Requirements this places on M2+ implementation

- Address-term fields are **structured data**, read by the AI gateway as generation context, never
  re-inferred by the model from prose history each call (same architectural guarantee as P4
  generally — [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4).
- Address terms are **stored per relationship, not per character** — the same character may be
  addressed differently by different players' runs, and by different characters within the same
  run.
- Changing an address term is a **run-scoped, forward-only** state change, consistent with
  [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §6's canon-safety rules for editable configuration — it does
  not retroactively rewrite already-generated scene text.
- English-language stories do not populate this model with placeholder Vietnamese-shaped data —
  the four-slot model is *available* generation context, used only when `content_language` (or a
  bilingual scene, for future consideration) calls for it.
- This model is **conceptual**, per this document's status — no migration or field-level SQL is
  specified here, matching [DOMAIN_MODEL.md](DOMAIN_MODEL.md)'s own scope statement.

---

## D. Quality Gate

Automated, deterministic checks a generated scene must pass before it is materialized into canon
(the accept step, [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §5) — a narrative-quality counterpart to the
existing `moderateContent` step in the same pipeline
([TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §5).

### Checks (minimum set)

| Check | Kind | What it catches |
|---|---|---|
| Expected language | Deterministic | Output is not in `content_language` at all (wrong-language generation). |
| Language drift | Deterministic | Output starts in `content_language` and drifts to another language partway through. |
| Unwanted language mixing | Deterministic | Untranslated English fragments inside Vietnamese prose (or vice versa) outside of intentional loanwords/proper nouns. |
| Character naming consistency | Deterministic | A `Character`'s canonical name/alias is rendered inconsistently against its structured fields ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §4). |
| Forms-of-address consistency | Deterministic | Output contradicts the stored address-term state (§C) for a relationship already established. |
| POV consistency | Deterministic | Output switches narrative person mid-scene against the profile's `pov` (§B). |
| Tense consistency | Deterministic | Output switches tense mid-scene against the profile's `tense` (§B). |
| Excessive repetition | Deterministic | A phrase, sentence, or structural pattern repeats well past natural rhetorical repetition within one scene. |
| Duplicate sentences | Deterministic | Near-identical sentences appear more than once in one generated scene. |
| Unresolved template tokens | Deterministic | A prompt-construction placeholder (e.g. `{{player_name}}`) leaks into rendered output. |
| Meta-AI language | Deterministic (phrase-list) + model-based fallback | "As an AI," "I cannot generate," narrator-breaking commentary, and the profile's `forbidden meta phrases` (§B) list. |
| Generic "as an AI" style text | Deterministic (phrase-list) | Subset of the above, called out because it is the single most recognizable failure the owner named. |
| Continuity contradiction signals | Deterministic where checkable against `CanonFact`, model-based critique otherwise | Output contradicts a fact already established for this `(PlayerRun, Branch)` — see [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §7 for what's in the assembled context to check against. |
| Abrupt pseudo-ending | Deterministic (pattern/marker check) | Output reads as if the story stopped without an explicit, validated ending marker — this is the prose-level counterpart to [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §2's rule that `boundary_kind = ending` is never inferred from output shape. |
| Continuous Play Contract compliance | Deterministic | No "to be continued" or equivalent string ([CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §1); no ending-flavoured language outside a validated `TERMINAL_ENDING`. |

**Deterministic checks are preferred wherever a check can be made deterministic** — pattern
matching, phrase-list matching, language detection, structural validation against the schema the
model was asked to return. **Model-based critique is used only where a deterministic check cannot
judge prose quality** (primarily continuity-contradiction nuance and borderline meta-language). A
model-based critique step is itself logged like any other generation call
(`GenerationAuditLog` — [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §3) and is subject to the same repair-loop
cap below.

### Repair loop

- On a quality-gate failure, **at most one automatic repair generation** is attempted per failed
  story turn — a single re-generation attempt with the failure reason fed back into the prompt.
- If the repair attempt also fails the gate, the turn does **not** commit. It resolves as
  `GENERATION_FAILED` per [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §2 — a
  controlled retry/error state the player can act on (retry, edit, choose differently — §8 of that
  document), never a silent pass-through.
- **Poor prose is never silently committed as canon.** This mirrors
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §4's "partial commits are prohibited"
  rule — a quality-gate failure is a reason not to commit, exactly like a moderation block or a
  validation failure.
- The repair cap prevents an unbounded, cost-accumulating repair loop, consistent with
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §8's existing cost-abuse guard for
  consecutive moderation-blocked turns — this is the same shape of guard applied to a different
  failure class.

### Billing rule: one user intent, at most one user allowance debit

The repair loop is an **internal reliability mechanism**, not a second user-facing generation. It
must never be billed as if the player asked for two turns. Three distinct concepts are tracked
separately and must not be conflated in code, logs, or product copy:

| Concept | What it counts | Who/what sees it |
|---|---|---|
| `provider_cost` | Real spend incurred on the AI provider's bill, once per provider call that returns a result (initial attempt and, if triggered, the repair attempt) | Internal cost accounting / `GenerationAuditLog` only — never shown to the player as a per-attempt charge |
| `internal_generation_attempt_count` | How many generation attempts (initial + at most one repair) ran for this turn | Internal observability / audit log only |
| `user_allowance_debit` | Whether **this turn** consumed one unit of the player's free daily allowance | Player-facing; this is the only one of the three the player's allowance counter reflects |

**Required rule:** for one successful user intent (the player submits one action or choice), the
turn resolves in **at most one `user_allowance_debit`**, regardless of whether the quality gate
passed on the first attempt or required the one automatic repair. Concretely:

- Player submits one action → initial generation produces prose that fails the quality gate →
  automatic repair runs once → the repaired scene passes the gate and commits → the player is
  charged **one** turn (`user_allowance_debit = 1`), not two, even though
  `internal_generation_attempt_count = 2` and `provider_cost` was incurred twice.
- If the initial generation *passes* the gate outright (no repair needed), the same
  `user_allowance_debit = 1` applies — the billing outcome for the player is identical whether or
  not a repair happened. The repair mechanism is invisible to the player's allowance.
- If the initial generation **and** the repair attempt both fail the gate, so the turn resolves as
  `GENERATION_FAILED` and **no canonical Scene is committed**: `user_allowance_debit = 0`. The
  platform absorbs the `provider_cost` of the failed attempt(s); the player is never charged for a
  turn that produced nothing they can read. This extends the same logic
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §8's allowance table already applies to
  a provider call that fails before returning a result — a quality-gate failure with no commit is
  the narrative-quality-side reason a turn can end with zero provider cost credited against the
  player, alongside the existing transport-failure and precheck-rejection reasons.
- This billing rule composes with, and does not replace,
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §7's idempotency guarantee (the same
  `turn_id` cannot double-charge across client retries) and §8's allowance table (which governs the
  transport-retry case). The quality-gate repair loop is a second, narrower case governed by this
  section: it is bounded to at most one repair attempt per turn (above), and that one repair never
  produces a second debit.

---

## E. Naturalness

**Do not require literal sentence-by-sentence equivalence between an English and a Vietnamese
instance of "the same" content.** This is the quality-side complement to D34's architecture rule:
D34 forbids translate-first generation; this section states what generation is allowed to produce
instead.

- Where the same sample content exists in both languages (e.g. this milestone's `/preview` fixture,
  and later the Narrative Golden Set in §F), each language's version must independently preserve:
  **intent, character, story facts, and tone.**
- Each version is otherwise free to use **native phrasing, idiom, and sentence structure** —
  different paragraph breaks, different sentence counts, different rhetorical devices, whatever
  reads naturally in that language.
- **Naturalness is evaluated per language, not by back-translation comparison.** A Vietnamese scene
  is judged on whether it reads as native Vietnamese prose, not on how closely it maps back onto the
  English sentence structure. Grading Vietnamese output by structural similarity to English would
  quietly reintroduce the translate-first quality bar D34 exists to reject, even while the
  generation architecture itself stayed native-language-first.
- Concretely for M1-R1's `/preview` fixture (§8 of the M1-R1 task): the English and Vietnamese
  fixture scenes express the same scene intent and the same player choices' consequences, but are
  independently authored prose in each language — not one translated from the other line by line.

---

## F. Regression Corpus — Narrative Golden Set (Specification for a Future Deliverable)

**Not built by this task.** This section specifies what the corpus must eventually contain so a
future M2+ task can build it without re-deriving requirements, the same way this whole document is
a forward-looking contract rather than a report on generated output.

### Minimum coverage

| Language | Genres |
|---|---|
| English | Fantasy, Romance, Adventure |
| Vietnamese | Fantasy, Romance, Adventure |

Six golden scenarios minimum (one per language × genre cell). Each genre choice matches the primary
genre scope in [PRODUCT_VISION.md](PRODUCT_VISION.md) §6.

### Scenario stress coverage

Each golden scenario should exercise, at minimum:

- **Dialogue** — multi-character speech, correctly attributed, per the DIALOGUE channel rules in
  [UX_CONTRACT.md](UX_CONTRACT.md) §1A.
- **Forms of address** — for Vietnamese scenarios, exercising the four-slot model in §C directly;
  for English scenarios, exercising pronoun/name consistency (P4).
- **Relationship changes** — a `CharacterRelationship` state change mid-scenario, checked against
  the quality gate's forms-of-address-consistency and continuity checks (§D).
- **Branching** — at least one "Replay from here" ([UX_CONTRACT.md](UX_CONTRACT.md) §9) exercised
  against the same golden scenario, to catch continuity regressions introduced across branches.
- **Custom actions** — at least one free-text custom action (D5), not only predefined-choice paths,
  since custom actions are an unconstrained input surface and a likelier source of drift.
- **Continuity** — a fact established early in the scenario must still hold by its later turns,
  checked against stored `CanonFact` rows.
- **Emotional scenes** — at least one scenario stresses tone/register under emotional content (e.g.
  a Romance scenario's relationship-turning-point scene), since register drift is more visible under
  emotional writing than under procedural/action writing.

### When this corpus runs

The corpus becomes a **regression test** — re-run and diffed against its prior baseline — whenever
any of the following change, mirroring the trigger list a change-sensitive quality bar needs:

- The AI provider or model changes.
- The prompt template changes.
- Context assembly changes ([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §7's bounded-assembly logic).
- The memory/canon-selection strategy changes (which `CanonFact`s get included, how they're
  ranked/truncated).

A regression run's findings are read the same way [MVP_SPEC.md](MVP_SPEC.md) §5 reads Alpha
evidence: quality-gate pass/fail per §D is a hard, binary check; naturalness (§E) is a qualitative
read against the "does this read as native prose" bar, not a numeric score with a fabricated
threshold.

---

## Relationship to Other Contracts

This document does not restate or modify:

- [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) — which play state a turn resolves to.
  This document's quality gate is a **precondition to commit**, evaluated during the `VALIDATING`
  phase of that contract's turn lifecycle (§3), alongside output moderation. A quality-gate failure
  after the repair cap resolves to `GENERATION_FAILED`, exactly like a moderation or extraction
  failure — it does not introduce a sixth play state.
- [UX_CONTRACT.md](UX_CONTRACT.md) §1A (Scene Readability Contract) — how the five content channels
  are presented. This document's checks (e.g. the abrupt-pseudo-ending check) enforce that
  *generated content* respects those channel boundaries; the presentation rules themselves are
  unchanged.
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md) — canonical state ownership and structure. §B and §C above
  extend, rather than replace, the existing `Character` / `CharacterRelationship` / `CanonFact`
  model.

No AI provider, model, or vendor is selected by this document.
