# Core Loops

Status: PROVISIONAL (M0 product definition)
Last updated: 2026-08-10 (revised by LW-M0-R2; continuous play and replay semantics by LW-M0-R3)

Each loop is tagged **MVP** or **LATER** (see [ROADMAP.md](ROADMAP.md) for the milestone that
introduces it).

## 1. Player Loop — **MVP**

The top-level session loop, regardless of which story mode is active.

```
Open app
  → discover a story (sample/curated list) OR create a new one (Quick Start / Advanced Setup)
  → enter story (resume last scene if returning)
  → read scene (text + optional static image)
  → act: pick a predefined choice OR type a free-text custom action
  → [if story mode = Adventure/RPG] optional roll on risky/uncertain actions
  → consequence rendered (narrative text; state changes applied to canonical StoryState)
  → story state changes persisted (flags, relationship deltas, inventory, canon facts)
  → turn resolves into an explicit play state (see below)
  → optionally: jump to "Talk to Character" (see Character-Chat Loop) and return
  → continue to next scene
  → reach a checkpoint, or eventually an ending
  → optionally: "Replay from here" at an earlier checkpoint, with a different choice
```

**Exit/entry points**: a session can end at any scene (state is saved after every consequence, not
only at checkpoints); re-opening the app resumes at the last saved scene.

**The loop does not have an implicit stop** *(added by LW-M0-R3)*. Every pass through it resolves
into exactly one of five explicit application states — `CONTINUE_READY`, `EXPLICIT_CHECKPOINT`,
`TERMINAL_ENDING`, `GENERATION_FAILED`, `ALLOWANCE_EXHAUSTED` — and only `TERMINAL_ENDING` exits
the loop. A completed generation, a provider timeout, a submitted custom action and a created
branch all re-enter the loop at "read scene". The full specification, including what each state may
render, is [CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md); it is the loop's contract
and takes precedence over any looser reading of the diagram above.

## 2. Roleplay Loop — **MVP**

The moment-to-moment mechanic inside "read scene → act → consequence." This is the loop that
actually delivers the wedge ("roleplay as a character, interact with AI characters, make
meaningful choices").

```
Scene rendered from canonical StoryState (current scene pointer + relevant canon facts/memories)
  → player chooses: predefined Choice OR free-text custom action
  → [optional] roll triggered (Adventure/RPG mode only) → outcome band (success / partial / fail)
  → AI generates a narrative proposal (GenerationProposal) using canonical context, not raw chat history
  → proposal is moderated and validated, then committed in one transaction: StoryState updated,
    new CanonFacts written if flagged, BranchHistory appended
  → scene re-rendered with the consequence, and the turn resolves into a play state
```

The commit in step four is the **canonical-state commit point** — one atomic transaction, nothing
partial ([CONTINUOUS_PLAY_CONTRACT.md](CONTINUOUS_PLAY_CONTRACT.md) §4). If any step from
generation through commit fails, the run stays at its last durable scene, which is itself a
playable position; the loop is never left without a next move.

Key constraint (see [DOMAIN_MODEL.md](DOMAIN_MODEL.md)): the AI never becomes the source of truth —
its output is a proposal materialized into canonical rows by the application, which is what makes
regeneration and consistency possible.

## 3. Character-Chat Loop — **MVP**

A parallel, addressable loop distinct from story progression (P5).

```
From a story (or character profile): tap "Talk to Character"
  → character chat surface opens (standalone screen, not the story reading view)
  → chat is seeded with: character identity fields (pronouns, forms of address, speaking style,
    personality) + relevant canon facts/memories from the player's current run
  → player sends message (predefined prompts optional, free text always available)
  → character responds in character, may reference canon facts/memories
  → [MVP] chat does NOT write new canon by default; it's a read-mostly side-channel
  → [MVP] the app MAY surface a non-blocking "Remember this?" suggestion on a canon-worthy
    statement; promotion happens ONLY when the PLAYER taps to confirm it
  → confirmed promotion writes a CanonFact with origin = character_chat, scoped to the ACTIVE
    branch, and linked to this Character
  → player returns to story; story reading view is unaffected unless the player promoted something
```

**Promotion is player-initiated (revised by LW-M0-R2).** The previous wording — "marked by the
system when the AI/app detects a canon-worthy statement" — described *automatic* promotion, which
directly contradicts the property this loop exists to guarantee: that casual chat cannot silently
alter the story's canon. Automatic detection may **suggest**; only an explicit player action
**promotes**. See [DECISIONS.md](DECISIONS.md) D7 (revised).

**Branch scoping (added by LW-M0-R2).** A chat thread belongs to `(PlayerRun, Character, Branch)`,
not to `(PlayerRun, Character)`. This closes a previously undefined state transition: when a player
replays from a checkpoint and forks a new branch, the chat context must follow the new branch's
canon, not the abandoned branch's. The MVP rule is:

- Chat *context* is always assembled from the **active branch's** CanonFacts.
- Chat *transcripts* are retained per branch; forking a branch starts a fresh thread rather than
  attempting to rewrite or merge prior conversation.
- CanonFacts promoted from chat inherit the branch they were promoted on, and do not leak across
  sibling branches.

This loop is intentionally decoupled from branch-affecting consequence in MVP — see
[DECISIONS.md](DECISIONS.md) D7 for the rationale.

## 4. Creator Loop — **LATER (M5)**, minimal authoring exists in MVP

Full loop (post-MVP):

```
Create
  → configure world / characters (Advanced Setup, extended for authoring)
  → generate draft (AI-assisted scaffolding)
  → edit
  → playtest (author plays their own draft using the Player Loop)
  → publish (make discoverable to other users)
  → other users play
  → remix (fork the story into their own editable, creator-owned copy)
  → creator sees engagement (views, completions, replay count)
```

**Terminology is deliberately non-overlapping** *(LW-M0-R3)*. This loop's `remix / fork` is a
**creator** concept at M5: copying a published story into an editable derivative, creating new
Authoring Data. The player mechanic in §1 is **"Replay from here"**: a new timeline within one
player's own run, creating new Player Run Data. They share no vocabulary, no screen and no control,
because owner-observed evidence shows that conflating them leaves users unable to say what was
created or what they are now playing ([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md)
§4.3, [DECISIONS.md](DECISIONS.md) D27).

**MVP scope of this loop (corrected by LW-M0-R2)**: only `configure → play` exists. The previous
wording (`configure → generate draft → edit → playtest`) described a four-stage authoring pipeline
with a draft/edit/playtest separation, which is creator-studio framing that
[MVP_SPEC.md](MVP_SPEC.md) does not fund and the primary wedge does not need.

In MVP there is **no draft state, no editor, and no separate playtest mode**. A player fills in
Quick Start or Advanced Setup and the story begins; "editing" is
[UX_CONTRACT.md](UX_CONTRACT.md) §6 mid-story configuration, applied forward from the current
scene, on a story that is already being played. Creating and playing are the same act.

`publish → other users play → branch/remix → creator sees engagement` are explicitly M5, gated on
retention evidence from M2/M3 — see [MVP_SPEC.md](MVP_SPEC.md) and [ROADMAP.md](ROADMAP.md).

**Curated sample stories are seed data, not an authoring feature.** The authored `Scene (seed)` and
`Choice (authored)` entities in [DOMAIN_MODEL.md](DOMAIN_MODEL.md) §1 exist so the owner can supply
1–3 hand-written stories as fixed content. No in-product editor for them ships in MVP; they are
authored directly as data. This keeps a scene/choice editor — the single largest creator-scope
risk in the document set — out of the player-focused MVP.

## 5. Discovery Loop — **LATER (M6)**, minimal browse exists in MVP

Full loop (post-MVP):

```
Open discovery surface
  → browse by category/genre/tag
  → search by keyword
  → see curated collections / recommendations
  → preview a story (synopsis, tags, sample)
  → start playing
  → (signal loop) completion/engagement feeds future recommendation
```

**MVP scope of this loop**: a flat, category-filterable list of sample/curated stories (P8
taxonomy) with no search, no personalized recommendation, no ML ranking — see
[MVP_SPEC.md](MVP_SPEC.md).

## Loop Summary Table

| Loop | MVP? | Milestone introduced | Depends on |
|---|---|---|---|
| Player Loop | Yes | M2 | Domain model, canonical state |
| Roleplay Loop | Yes | M2 | AI gateway, canonical state |
| Character-Chat Loop | Yes | M3 | Character identity fields, memory model |
| Creator Loop (configure-and-play only) | Partial | M2 (Quick Start), M3 (Advanced Setup) | Story configuration |
| Creator Loop (publish/remix/analytics) | No | M5 | Moderation, discovery |
| Discovery Loop (browse only) | Partial | M2 (flat list) | Taxonomy (P8) |
| Discovery Loop (search/recommend) | No | M6 | Usage data volume |

**Note on loop-vs-milestone tagging.** A loop tagged **MVP** is fully present only once its
introducing milestone completes. The Player Loop is tagged MVP and introduced at M2, but two
elements of the diagram in §1 — the optional roll and the "Talk to Character" jump — only exist
from M3. M2 exercises the loop without them.
