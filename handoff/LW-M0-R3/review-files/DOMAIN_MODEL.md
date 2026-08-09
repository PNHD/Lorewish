# Domain Model (Conceptual)

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2; turn lifecycle and scene boundary by LW-M0-R3)

This is a **conceptual** model to inform later schema design — no migrations, no ORM types, no
field-level SQL here. It exists to make the critical rule concrete: **canonical application state
lives in our persistence layer; AI providers never own product state.**

## 0. Three Data Domains

| Domain | Purpose | Mutated by |
|---|---|---|
| **Authoring Data** | The reusable creative definition of a story — what an author (or Quick Start generation) set up | Author actions, Quick Start/Advanced Setup submission |
| **Player Run Data** | One player's specific, evolving playthrough of a story | Player Loop / Roleplay Loop actions, materialized from AI proposals |
| **AI Generation / Audit Data** | Everything about talking to AI providers — proposals, costs, moderation, assets | AI gateway calls; never read directly by narrative rendering except via materialized Player Run Data |

A single Story may have many independent PlayerRuns (including the author's own playtest run).
Editing Authoring Data does not retroactively rewrite an existing PlayerRun's history (see
[UX_CONTRACT.md](UX_CONTRACT.md) §6) — a PlayerRun snapshots the config values relevant to it at
key points, or overrides them going forward, never backward.

## 1. Authoring Data

- **User** — account; has an author role implicitly (no separate "creator account" tier in MVP).
- **Story** — the top-level creative unit. Holds: title, premise, genre, tags, visibility
  (private in MVP; public is M5), story mode (Narrative / Adventure / [future] RPG), owning
  User.
- **StoryConfiguration** — the Advanced Setup field set (world/setting, player role description,
  starting situation, tone, narrative POV, story language) attached to a Story as its default. This
  is the template; a PlayerRun may hold its own override copy (see §2). *(LW-M0-R3: the "AI
  freedom" adherence field is **removed** — it never reaches a schema. Any internal
  adherence/policy parameter the generation layer finds useful lives in gateway configuration, not
  as a user-owned field on this entity. See [DECISIONS.md](DECISIONS.md) D25.)*
- **World** — setting facts an author defines up front (place names, rules of the setting,
  factions) — distinct from Character so world-building and character-building can evolve
  independently and be reused across stories later (reuse is a later-milestone capability; the
  separation is worth modeling now because retrofitting it is expensive).
- **Character** — canonical definition of an NPC: canonical name, aliases, pronouns, default
  speaking style, personality traits, default relationship-to-player starting point. This is
  authoring-time identity — see §4 for why this is split from player-run relationship state.
- **CharacterRelationship (authored default)** — the *starting* relationship/role a Character has
  to the player role (e.g., "mentor," "rival") before any play happens. Distinct from the
  player-run-scoped relationship state that evolves during play (§2).
- **Scene (seed/template)** — for sample/curated stories only: an authored starting scene and any
  pre-written branch points. Quick Start stories may have zero authored scenes (fully
  AI-generated from Story + StoryConfiguration at first play).
- **Choice (authored)** — for sample/curated stories: pre-written choice options attached to a
  seed Scene.

## 2. Player Run Data

- **PlayerRun** — one player's instance of playing a Story. Holds: owning User, Story reference,
  StoryConfiguration override (fields the player edited mid-story per UX_CONTRACT §6), story mode,
  created/last-played timestamps.
- **StoryState** — the current canonical run-time state for a PlayerRun: current scene pointer,
  flags (arbitrary key/value story-progress markers), inventory (if genre-relevant), and a pointer
  to the active Branch. Exactly one live StoryState per PlayerRun (it's the "current save").
- **CharacterRelationship (run-scoped)** — the *evolving* relationship between the player and a
  given Character **within this PlayerRun**: relationship value/descriptor, how the character
  currently addresses the player, how the player currently addresses the character (see §4 on why
  this must be structured, not inferred from prose each time).
- **Scene (materialized)** — an actual scene the player has seen in this run, with its rendered
  text and reference to the scene image asset (if any) and to the GenerationProposal it was
  materialized from (AI Generation domain, §3) or to the authored seed Scene it came from.
  Carries **`boundary_kind ∈ {none, checkpoint, ending}`** *(added by LW-M0-R3)*, set at commit
  time. This single column is what makes the play state derivable rather than remembered — see §12.
  `ending` is set **only** from an explicit, validated ending marker in a structured generation
  result, or from an authored seed scene marked as an ending. It is never inferred from output
  length, a stop reason, a truncated response, or the absence of generated choices.
- **Branch** — a sequence of materialized Scenes representing one path through the story for this
  PlayerRun. A "replay from checkpoint" (UX_CONTRACT §9) creates a new Branch forking from a prior
  Scene; the old Branch is retained, not deleted.
- **BranchHistory** — the record of which Branches exist for a PlayerRun and their fork points;
  drives the Replay Picker screen ([MVP_SPEC.md](MVP_SPEC.md) §3.8).
- **CanonFact** — a durable, structured fact established during play (e.g., "player told
  Character X their real name," "player chose the diplomatic path in the siege"), scoped to a
  PlayerRun + Branch, used as generation context for both story continuation and character chat.
  Carries an **`origin`** discriminator *(added by LW-M0-R2)*: `story_scene` (materialized from an
  accepted scene proposal) or `character_chat` (explicitly promoted by the player, see §9). Origin
  is what makes "chat cannot silently corrupt the story timeline" auditable rather than merely
  intended.
- **Memory** — **a projection, not a second entity** *(clarified by LW-M0-R2)*. "Memory" is the
  name for a CanonFact as surfaced in Character Chat's "Shared Memories" view, via a
  CanonFact↔Character relevance link. The prior text called it both "a CanonFact (or set of
  facts)" and, elsewhere in the document set, something that gets *created* by promotion — which
  reads as a distinct entity and reintroduces exactly the two-systems-of-record problem it was
  written to avoid. The single rule: **there is one durable store of what happened, `CanonFact`.**
  "Promoting a chat message to a memory" means *creating a CanonFact with `origin =
  character_chat`*, not creating a Memory row.
- **ChatThread** *(added by LW-M0-R2)* — the message transcript for a
  `(PlayerRun, Character, Branch)` triple. Branch-scoped because forking a run from a checkpoint
  must not leave a conversation referencing canon from an abandoned branch. Transcript messages
  are **not** canon and are never read as authoritative state; they are display history plus
  audit. Generation context for a chat reply is always assembled from the active branch's
  CanonFacts and CharacterRelationship, never by replaying the transcript as memory (§5, D14).
- **RollResult** — record of a light-roll outcome (input action, outcome band, timestamp), scoped
  to a PlayerRun + Branch, referenced by the Scene it affected.

## 3. AI Generation / Audit Data

- **GenerationProposal** — the AI's proposed narrative continuation *before* it is accepted into
  canon. Holds: PlayerRun reference, Branch reference, the prompt/context snapshot used (built
  from StoryState + CharacterRelationship + CanonFacts, never from raw provider chat history — see
  §5), provider response, an **idempotency key** (PlayerRun + Branch + scene-index + attempt
  number), status (proposed / accepted / discarded).
- **GeneratedAsset** — an image (or later, audio) produced by AI generation, linked to the Scene
  it illustrates and to the GenerationProposal/request that produced it; includes provider,
  prompt used, and moderation status.
- **ModerationState** — the moderation result (pass/flagged/blocked, category if flagged) attached
  to a GenerationProposal or GeneratedAsset before it's allowed to materialize into Player Run Data
  or render to the user.
- **UsageCounter** — **MVP entity** *(added by LW-M0-R2)*. Per-user (and per-guest-device)
  consumption of the free daily allowance, checked server-side before any provider call. This
  resolves a contradiction in the previous document set: MVP_SPEC §1.11 requires a server-enforced
  free daily allowance and TECHNICAL_ARCHITECTURE §10 requires the check, while CreditLedger — the
  only entity that could hold the count — was marked M6. Something must count in MVP; this is it.
  Deliberately minimal: a counter with a reset window, not a ledger.
- **CreditLedger** — (M4, modeled now for forward-compatibility only) per-user running balance of
  free-allowance and paid credits, with entries for consumption (which action, which
  GenerationProposal) and grants (daily reset, rewarded ad, purchase). Supersedes UsageCounter
  when it ships; UsageCounter is the MVP subset, not a parallel system.
- **GenerationAuditLog** — cost/latency/token/provider metadata per call, for
  [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)'s cost-control and observability needs;
  not shown to end users. Records the **capability** invoked (§5 of that document) so per-capability
  unit cost is a query result rather than an assumption.

## 4. Character Identity Consistency — Explicit Treatment

This is the direct architectural answer to the research's #1 reported quality complaint
(pronoun/address/relationship inconsistency):

- Pronouns, canonical name, aliases, and default speaking style are **structured fields on
  Character** (authoring data), not paragraphs of backstory prose the AI has to re-infer from
  every time.
- How a *specific* character currently addresses *this specific player* (and vice versa) is
  **structured, run-scoped state** on CharacterRelationship (run-scoped) — e.g., a character who
  learns the player's title mid-story updates a structured `addresses_player_as` field, not just a
  buried line in past scene text.
- Every generation call (story continuation or character chat) is constructed by the AI gateway
  from these structured fields **plus** relevant CanonFacts — never from "replay the whole chat
  history and hope the model stays consistent." This is what makes identity consistency an
  application-owned guarantee rather than a prompt-engineering hope, directly implementing P4.
- Regeneration (retrying a proposal) reuses the same structured context, so retries can't silently
  drift identity either.

## 5. Idempotent AI Generation & Safe Regeneration

- Every AI generation call is scoped by an idempotency key: `(PlayerRun, Branch, scene_index,
  attempt_id)`. A retried network call with the same key does not create duplicate
  GenerationProposals or double-consume credits.
- A GenerationProposal is a draft. **Nothing in Player Run Data is written until the proposal is
  accepted** (accepted = passed moderation + presented to the user as the new scene, or explicitly
  confirmed depending on flow). This means:
  - Regenerating a scene (user taps "try again") creates a new GenerationProposal for the same
    scene_index without touching already-materialized prior Scenes, CanonFacts, or
    CharacterRelationship state.
  - Only when a proposal is accepted does the application (not the AI) decide which structured
    side-effects to write (new CanonFacts, updated CharacterRelationship, new StoryState flags) —
    this decision can be a deterministic extraction step (structured output from the model,
    validated by the app) rather than free-form trust in prose.
- Discarded GenerationProposals (regenerated-away drafts) are retained in AI Generation/Audit data
  for debugging "story bugs" (research pain point) but are never surfaced as canon.

## 6. Canon-Safety for Editable Story Configuration

Directly supports [UX_CONTRACT.md](UX_CONTRACT.md) §6: editing StoryConfiguration on an in-progress
PlayerRun is safe because:

- StoryConfiguration override lives on the PlayerRun, not by mutating the Story's original
  StoryConfiguration — the author's template is untouched.
- Fields that **only affect future generation context** (tone, randomness level, world/setting
  flavor) can be changed freely; they're read fresh on the next GenerationProposal. *(LW-M0-R3: "AI
  freedom" removed from this list along with the field itself — §1.)*
- Fields that **CanonFacts or materialized Scenes may already reference** (player role identity,
  a Character's established relationship) trigger the UX warning because changing them doesn't
  retroactively edit past Scene text — the app does not attempt automatic historical rewriting in
  MVP. This is a deliberate simplicity choice: rewriting history correctly is a much harder problem
  than the MVP needs to solve.

## 7. Bounded Context Assembly (added by LW-M0-R2)

The model states that every generation call is assembled fresh from canonical data (§4–5). It did
not state that the assembly is **bounded** — and unbounded assembly is a real cost and quality
defect, not a theoretical one.

CanonFacts and Scenes accumulate monotonically over a run. "Assemble the relevant canon" without a
ceiling means the context, and therefore the cost, of generating scene *N* grows with *N*. A long
run's later scenes could cost several times what its early scenes cost, and the per-run cost curve
is superlinear in run length — precisely the users the product most wants (deeply retained ones)
become the most expensive, and the growth is invisible until it shows up on an invoice.

The MVP requirement:

- Context assembly has an explicit **token or item budget per capability**, and the budget is
  configuration, not a constant in code.
- CanonFact selection is **relevance-ranked and truncated** to the budget (recency plus
  character/scene relevance is sufficient for MVP — no embedding infrastructure required), never
  "all facts for this run."
- Structured identity state (Character fields, CharacterRelationship, forms of address) is
  **always included and never truncated** — it is small, and it is the entire basis of the P4
  consistency guarantee. Budget pressure is absorbed by dropping older narrative facts, never
  identity.
- Older branch history is summarized rather than replayed once it exceeds the budget. The summary
  is itself a stored artifact, not regenerated per call.
- `GenerationAuditLog` records the assembled context size, so context growth is observable per
  capability rather than discovered later.

## 8. Story Language (added by LW-M0-R2)

- **Story** carries a `content_language`. It defaults from the player's device locale at creation
  and is independent of UI language — a player may run a Vietnamese-language story inside an
  English UI.
- Language is part of generation context for every capability, so scene prose, generated choices
  and character chat stay in one language for the life of the run rather than drifting to the
  model's default.
- Character `speaking style` and `forms of address` are language-sensitive by nature (many
  languages encode formality and relationship directly in address terms — the very thing P4
  exists to keep consistent). These fields are stored per story language, not assumed English.
- Genre/category and tag values are **stable locale-independent keys** with separately localizable
  display labels (P8). Display strings are never primary keys.
- Timestamps are stored UTC; presentation localizes.

## 9. Canon Promotion From Character Chat (added by LW-M0-R2)

Making the D7 guarantee concrete and auditable:

- A chat message becomes canon **only** via an explicit player confirmation. Automatic detection
  may surface a suggestion; it may not write.
- Promotion creates a `CanonFact` with `origin = character_chat`, scoped to the active
  `(PlayerRun, Branch)` and linked to the Character.
- Promoted facts are **visible** (Shared Memories) and **reversible** — a player can un-promote,
  which soft-deletes the CanonFact rather than rewriting scene history.
- Chat transcripts are never themselves canon. Deleting a ChatThread must not delete CanonFacts
  promoted from it.
- Because origin is recorded, "did chat alter the story timeline?" is answerable by query — which
  is what turns D7 from an intention into a testable property.

## 10. Data Lifecycle and Deletion (added by LW-M0-R2)

Previously unmodeled, and a store-compliance requirement rather than a nicety (MVP_SPEC §1.13):

- **Account deletion** removes or irreversibly anonymizes the User and all owned Player Run Data.
  Retention of AI Generation/Audit rows for cost accounting is acceptable only in a form no longer
  linked to an identifiable user.
- **Guest sessions** need a defined fate: a guest PlayerRun either upgrades with the account (the
  intended path, [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §7) or expires after a
  defined retention window. Orphaned guest runs accumulating forever is not a valid third option.
- **Branch retention**: branches are retained, not deleted, on replay (UX_CONTRACT §9). This is
  unbounded by design and acceptable at alpha scale, but the player needs *some* delete path for
  a run or story; there is currently none anywhere in the document set.
- **Discarded GenerationProposals** are audit data with a finite retention window, not permanent
  storage.

## 11. Turn Lifecycle and Derived Play State (added by LW-M0-R3)

The model above says how a proposal becomes canon. It did not say what the application *is* between
turns, which is where the failure class in
[REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4.2 lives. The full contract is
[CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md); this section records only its data
consequences.

- **Turn** — the unit of play: one player action to one committed consequence. Carries a
  client-generated `turn_id` created once at intent and reused across every retry of that intent,
  including retries after an app restart. The existing idempotency key
  `(PlayerRun, Branch, scene_index, attempt_id)` (§5) is scoped *within* a turn; `turn_id` is what
  makes a retried request recognisable as the same intent rather than a new one. A request carrying
  an already-committed `turn_id` returns the committed result and neither generates nor decrements
  the allowance a second time.
- **One atomic commit per turn.** The writes listed in
  [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §4 — Scene, StoryState, CanonFacts,
  CharacterRelationship deltas, RollResult, BranchHistory, proposal status, allowance decrement —
  succeed together or not at all. A partially applied turn is a canonical-state failure, which is a
  Tier 2 hard failure under [MVP_SPEC.md](MVP_SPEC.md) §5.
- **Play state is derived, never stored as story state.** It is computed from the last committed
  Scene on the active branch: `boundary_kind = ending → TERMINAL_ENDING`,
  `checkpoint → EXPLICIT_CHECKPOINT`, otherwise `CONTINUE_READY`.
- **Failure states are session-transient.** `GENERATION_FAILED` and `ALLOWANCE_EXHAUSTED` are never
  written to `StoryState` and never survive a reload. This is the structural property that makes it
  *impossible* for a timeout, a crash or an outage to leave a residue that later reads as a story
  ending: failure has nowhere durable to write itself, so a resumed run always re-derives to its
  last durable, playable scene.
- **A new Branch created by "Replay from here" involves no generation** and therefore no proposal,
  no provider call and no allowance write — it is a `Branch` + `BranchHistory` write plus an
  `active_branch` pointer update. It cannot fail for provider reasons.

## 12. Explicitly Not Modeled in MVP

- Cross-story World/Character reuse (World and Character are modeled per-Story in MVP, even though
  the schema *shape* would allow future reuse — no reuse UI/logic ships in MVP).
- Public visibility, forks-of-other-users'-Stories, or engagement analytics entities (M5).
- Any RPG stat/build entities beyond RollResult (post-M3, evidence-gated).
- Embedding/vector retrieval for canon relevance — §7's ranking is deliberately heuristic in MVP.
