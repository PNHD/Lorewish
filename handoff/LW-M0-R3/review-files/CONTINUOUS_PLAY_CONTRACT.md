# Continuous Play Contract

Status: PROVISIONAL (M0 product definition)
Created: 2026-08-10 by LW-M0-R3
Applies from: **M2** (the first milestone that generates a scene), enforced for the life of the
product.

This document exists because of one specific, observed failure class in an adjacent product: a
story turn completing and the application then presenting something that *looks like the story
ended*, when nothing ended. See [REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4 for the
evidence.

It is separated from [UX_CONTRACT.md](UX_CONTRACT.md) deliberately. The UX contract specifies how
surfaces behave; this specifies **what state the application is in and what it is permitted to
render in that state**. It spans the client, the AI gateway and the persistence layer, so embedding
it in a UI document would put a cross-layer invariant somewhere only the UI implementer reads.

---

## 1. The Governing Rule

> **A generated text segment ending is not a story ending.**

The model finishing its output, a provider timing out, a branch being created, or a custom action
being submitted are all **mechanical events**. None of them is a narrative event. The application —
never the model, never a transport failure — decides whether a story has ended, and it decides so
from stored state.

**"To be continued" is prohibited as user-facing copy in every state, in every surface, in MVP.**
It is not a state name, not a fallback, not a placeholder, and not an empty-state string. This is a
testable prohibition: a string search of the shipped catalogue must find no such copy. If a future
milestone wants serialized-release framing, that is a deliberate product decision made against real
content, not a default the runtime falls into when something goes wrong.

---

## 2. Play States

Every turn resolves into **exactly one** of five states. There is no sixth state and there is no
"unresolved" state — a turn that cannot be resolved falls back to §6, which is itself one of these
five.

| State | Meaning | May the story be described as over? |
|---|---|---|
| **`CONTINUE_READY`** | Consequence materialized, canonical state committed, at least one valid next interaction available. **The default outcome of a normal turn.** | No |
| **`EXPLICIT_CHECKPOINT`** | A chapter/checkpoint boundary was deliberately reached. Progress is saved and the player is offered an explicit, primary **Continue**. | No |
| **`TERMINAL_ENDING`** | An actual story ending was reached intentionally. Replay / alternate branch / new story actions are appropriate here and **only** here. | Yes |
| **`GENERATION_FAILED`** | Generation or materialization did not produce a usable, committed consequence. **Never presented as a narrative ending.** The player can retry, revise their action, choose differently, or return to the last durable scene. | No |
| **`ALLOWANCE_EXHAUSTED`** | The free daily allowance is spent, so no further generation may be attempted right now. Not a failure, not an ending — a resource state. | No |

### Why five and not four

`ALLOWANCE_EXHAUSTED` is added to the owner's four. Hitting the free cap is neither a generation
failure (nothing failed, and nothing was even attempted) nor a narrative event, but it produces the
same user-visible risk: a turn that stops without a next action. [MVP_SPEC.md](MVP_SPEC.md) §8
already requires the cap to "degrade gracefully into a clear, non-punitive state, not a hard wall
mid-scene" — that requirement has no home unless the state exists. Folding it into
`GENERATION_FAILED` would tell the player something broke when nothing did, and would offer a
Retry that is guaranteed to fail.

### State derivation, and why failures cannot become endings

Two of these states are **derived from committed state**; three are **transient outcomes of a turn
in flight** and are never persisted as story state.

- `Scene.boundary_kind ∈ {none, checkpoint, ending}` is a stored column on a materialized Scene,
  set at commit time (§4).
- On opening or resuming a run, the play state is **recomputed** from the last committed Scene on
  the active branch:
  - `boundary_kind = ending` → `TERMINAL_ENDING`
  - `boundary_kind = checkpoint` → `EXPLICIT_CHECKPOINT`
  - otherwise → `CONTINUE_READY`
- `GENERATION_FAILED` and `ALLOWANCE_EXHAUSTED` are **session-transient**. They are never written
  to `StoryState` and never survive a reload.

This derivation is the structural reason the observed failure class cannot occur in Lorewish: a
timeout, a crash mid-turn, or a provider outage leaves the run at its last durable Scene, and that
Scene re-derives to `CONTINUE_READY`. A failed turn cannot leave a residue that later reads as an
ending, because failure has nowhere durable to write itself.

`boundary_kind = ending` is only ever set from an explicit ending marker in a **validated,
structured** generation result, or from an authored seed scene marked as an ending. It is never
inferred from output length, from the model producing no further choices, from a stop reason, or
from a truncated response. A generation that yields no continuation is a `GENERATION_FAILED` turn,
not an ending.

---

## 3. Turn Lifecycle

A **turn** is the unit of play: one player action to one committed consequence.

```
1. INTENT_ACCEPTED
     player selects a Choice or submits a custom action
     a Turn record is created client-side with a client-generated turn_id
     the player's text is retained until the turn commits (never cleared optimistically)

2. PRECHECK                        (server, before any provider call)
     caller identity verified; caller owns this PlayerRun  (TECHNICAL_ARCHITECTURE §4)
     allowance / guest quota checked                       → fail: ALLOWANCE_EXHAUSTED
     player input moderated                                → fail: GENERATION_FAILED (input_rejected)

3. GENERATING
     AI gateway call, scoped by the idempotency key (§7)
     previous scene remains rendered and readable throughout

4. VALIDATING
     output moderation                                     → fail: GENERATION_FAILED (output_blocked)
     structured extraction validated against the schema    → fail: GENERATION_FAILED (unusable_output)

5. COMMITTING                      (the canonical-state commit point, §4)
     one transaction; all-or-nothing

6. RESOLVED
     play state derived from the committed Scene, or set to a transient failure state
     UI guarantees (§5) apply
```

Phases 2–5 are server-side. The client never decides that a turn succeeded.

---

## 4. Canonical-State Commit Point

There is exactly one commit point per turn, and it is atomic.

**Before commit**, nothing in Player Run Data has changed. This is already the domain model's rule
([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §5): a `GenerationProposal` is a draft.

**At commit**, in a single transaction:

- the materialized `Scene` is written, with `boundary_kind` set;
- `StoryState` advances its current-scene pointer and applies flag/inventory changes;
- `CanonFact` rows extracted from the validated result are written (`origin = story_scene`);
- `CharacterRelationship` (run-scoped) deltas are applied;
- `RollResult` is written, if the turn included a roll;
- `BranchHistory` is appended;
- the `GenerationProposal` status moves to `accepted`;
- the allowance counter is decremented (§8).

**After commit**, the turn is durable. Re-deriving play state from committed rows must return the
same state on any device, at any later time.

Partial commits are prohibited. A transaction that cannot complete rolls back entirely and the turn
resolves as `GENERATION_FAILED` — leaving the run at its previous durable Scene, which is a valid,
playable position. A half-applied turn (scene written, relationship not) is a Tier 2 canonical-state
failure under [MVP_SPEC.md](MVP_SPEC.md) §5.

---

## 5. UI Guarantees

Each is written to be checkable by an implementer or a test, not interpreted.

**G1 — Every resolved turn renders at least one enabled, playable control.** A screen with no
enabled forward action is a defect in every state, including failure states.

**G2 — The custom-action composer is present and enabled in `CONTINUE_READY` and
`EXPLICIT_CHECKPOINT`.** It is the always-available path ([UX_CONTRACT.md](UX_CONTRACT.md) §7), so
"no predefined choices were generated" can never produce a dead end.

**G3 — Ending language appears only in `TERMINAL_ENDING`.** Copy that asserts or implies the story
is over — "The End", "Story complete", and any equivalent — is scoped to that state alone. "To be
continued" is prohibited in all five states (§1).

**G4 — `GENERATION_FAILED` renders recovery, not resolution.** It must offer, at minimum: retry the
same action; edit and resubmit the action; pick a different choice. The player's typed text is
preserved verbatim. The last durable scene remains visible and readable behind or above the failure
affordance — the player is never navigated away from their story to a generic error screen.

**G5 — `ALLOWANCE_EXHAUSTED` keeps the story readable and states when play resumes.** It shows when
the allowance resets, keeps all already-materialized scenes readable and scrollable, and offers no
punitive framing. In MVP it offers no purchase path, because MVP has no payment surface at all
([MVP_SPEC.md](MVP_SPEC.md) §8).

**G6 — The generation-in-progress state never replaces the previous scene.** The scene the player
is currently reading stays on screen and readable while the next one generates
([UX_CONTRACT.md](UX_CONTRACT.md) §7).

**G7 — No state renders "back to the story" or "view the whole story" as its only primary action.**
Navigating a player away from the playable position is never the primary resolution of a turn. This
guarantee is written directly against the observed adjacent-product failure
([REFERENCE_PRODUCT_NOTES.md](REFERENCE_PRODUCT_NOTES.md) §4).

**G8 — `EXPLICIT_CHECKPOINT` has one unambiguous primary action: Continue.** Checkpoint-adjacent
actions (replay from here, view branches) are secondary and visually subordinate. A checkpoint is a
breath, not a terminus, and must not be styled like one.

**G9 — Branch creation lands in the reading view.** See §6.

---

## 6. Branch Transition

Two distinct concepts, deliberately given non-overlapping vocabulary. See
[DECISIONS.md](DECISIONS.md) D27.

### A. Player timeline branch — **MVP**

User-facing name: **"Replay from here."** The words *fork*, *remix*, *copy* and *version* do not
appear on this surface.

```
a committed Scene or checkpoint on the active branch
  → player taps "Replay from here"
  → a new Branch is created, forking at that Scene       (pure state write)
  → StoryState.active_branch := the new Branch
  → the forked-from Scene is re-presented as current      (already durable; nothing is generated)
  → play state derives to CONTINUE_READY
```

Guarantees:

- **No generation and no allowance consumption.** Creating a branch is a state operation. It cannot
  fail for provider reasons, cannot time out, and cannot cost the player anything.
- **It lands the player in the reading view, ready to act** — never on a branch-management page, a
  confirmation page, an account wall, or any screen whose primary action is "back to the story".
  This is guarantee G9 and it is the specific dead-end observed in the adjacent product.
- **The prior branch is retained**, per [UX_CONTRACT.md](UX_CONTRACT.md) §9.
- **The player is not asked to understand copies or ownership.** No language about duplicating a
  story, creating a version, or owning a derivative appears anywhere in this flow.
- **Chat threads follow the new branch** — a fresh thread for `(PlayerRun, Character, new Branch)`,
  per [CORE_LOOPS.md](CORE_LOOPS.md) §3. Prior threads are retained on their own branches.
- **A guest run stays playable across a branch.** Any account prompt is non-blocking and never
  interposed between the tap and the playable scene.

### B. Creator fork / remix — **M5, later**

A separate authoring concept: copying another user's published story into an **editable
creator-owned derivative**, where policy permits. It creates new Authoring Data; the player branch
creates new Player Run Data. They share no vocabulary, no screen and no control.

---

## 7. Idempotency Expectations

The domain model's existing key is `(PlayerRun, Branch, scene_index, attempt_id)`
([DOMAIN_MODEL.md](DOMAIN_MODEL.md) §5). This contract adds the client-side half.

- Every turn carries a **client-generated `turn_id`**, created once at `INTENT_ACCEPTED` and reused
  across every retry of that same intent — including retries after app restart.
- A request arriving with a `turn_id` already committed **returns the committed result** and does
  not generate, does not commit again, and does not decrement the allowance again.
- A request arriving with a `turn_id` currently in flight returns the in-flight status rather than
  starting a second provider call.
- A **user-initiated regeneration** is a new `attempt_id` under the same `scene_index` — a
  deliberately new call that does consume allowance (§8). It is not a retry.
- Commit is idempotent at the transaction boundary: a duplicate commit for the same key is a no-op
  returning the existing Scene, not a second Scene.

Consequences that matter in practice: a double-tap cannot produce two scenes; a network retry
cannot double-charge; a client that reconnects mid-generation reattaches instead of paying twice.

---

## 8. Retry, Failure Recovery, and What Consumes Allowance

### Automatic retry

- At most **one** transparent automatic retry, and only for transport-level failure (connection
  reset, gateway 5xx, timeout with no result). Same `turn_id`, so it cannot double-charge.
- Not retried automatically: moderation blocks, validation failures, and allowance rejections.
  Retrying these produces the same answer and only spends money.
- After the automatic retry, the turn resolves as `GENERATION_FAILED` and the player chooses what
  happens next.

### What consumes the free daily allowance

| Event | Consumes allowance? | Why |
|---|---|---|
| Provider call returned a billable result and the turn committed | **Yes** | The normal case |
| Provider call returned a billable result, output blocked by moderation | **Yes** | Real cost was incurred; the player is not billed twice for the retry attempt |
| Provider call failed before returning a result (timeout, transport, provider error) | **No** | The player got nothing; charging for it is indefensible and would punish players for our outage |
| Precheck rejected the turn (allowance, ownership, input moderation) | **No** | No provider call was made |
| User-initiated regeneration of a delivered scene | **Yes** | Per [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) §10 — no free unlimited retries |
| "Replay from here" branch creation | **No** | No generation occurs (§6) |

**Cost-abuse guard**: consecutive `output_blocked` turns on the same `scene_index` are capped
(configuration, not a code constant). Beyond the cap the turn still resolves as
`GENERATION_FAILED`, but with "choose a different action" as the primary recovery rather than
"retry" — a player cannot loop a moderation-blocked prompt into unbounded provider spend.

### Recovery affordances by state

| State | Primary action | Secondary actions |
|---|---|---|
| `CONTINUE_READY` | A choice, or the composer | Talk to character, story config, checkpoints |
| `EXPLICIT_CHECKPOINT` | **Continue** | Replay from here, view branches |
| `TERMINAL_ENDING` | Replay from a checkpoint | Try an alternate branch, start a new story |
| `GENERATION_FAILED` | **Try again** (or *Choose a different action* past the block cap) | Edit my action, pick a different choice |
| `ALLOWANCE_EXHAUSTED` | Keep reading (story stays open) | Return when the allowance resets; view allowance status |

---

## 9. Explicitly Prohibited Behaviours

Each of these is a defect, not a design option. They are listed as prohibitions because each is a
plausible implementation shortcut.

1. Rendering any terminal or ending-flavoured card as the consequence of a **successful** turn that
   is not `TERMINAL_ENDING`.
2. Rendering an ending or "to be continued" card on a **provider timeout or error**.
3. Rendering an ending card because the model returned **no further choices** — that is
   `CONTINUE_READY` with the composer as the path forward (G2).
4. Treating **branch creation** as a terminal event of any kind.
5. Treating **submitting a custom action** as a terminal event of any kind.
6. Persisting a failure state into `StoryState`, in any form.
7. Clearing the player's composer text before the turn commits.
8. Navigating away from the reading view as the resolution of a turn (G7).
9. Inferring `boundary_kind = ending` from anything other than an explicit validated ending marker
   or an authored seed ending.

---

## 10. Evidence Bar

These are the checks that make this contract real rather than aspirational. They attach to
[ROADMAP.md](ROADMAP.md) M2 and are re-verified at M3.

1. A turn forced to time out (provider stubbed to fail) resolves as `GENERATION_FAILED`, the last
   durable scene is still readable, and the composer still contains the player's text.
2. Killing the app mid-generation and reopening it resumes at the last durable scene in
   `CONTINUE_READY` — no ending, no error state, no lost progress.
3. Submitting the same turn twice (double-tap, and a forced network retry) produces exactly one
   Scene and exactly one allowance decrement.
4. "Replay from here" lands in the reading view with an enabled action, in under one navigation
   step, with no generation call issued.
5. A string search of the shipped copy catalogue finds no "to be continued" variant.
6. Every state in §2 has been reached in a test run, and each rendered at least one enabled
   playable control.
7. Exhausting the allowance mid-story leaves prior scenes readable and states the reset time.
