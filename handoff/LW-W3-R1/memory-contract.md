# Character Memory Contract

## Storage

Character memory is a typed extension of `canon_facts`, not a second source of truth. A memory row has `character_id`, `memory_type`, `fact_key`, `fact_text`, `salience`, source Turn/Scene, branch/run scope, and optional `supersedes_fact_id`.

## Invariants

1. Character memory is always branch-scoped and belongs to the active run branch.
2. `character_id` must belong to the Story played by the run.
3. `fact_key` is stable ASCII snake-case and unique per character within one generation response.
4. `memory_type` is one of six allowed durable categories; salience is 1..5.
5. All character references are validated before the Scene insert.
6. Scene, generic canon, memory, Turn commit, and debit marker share one transaction.
7. Failure before commit persists neither Scene nor memory.
8. Source/provenance and superseded rows remain auditable.

## Branch visibility

Visibility follows `lw_branch_scene_ids(active_branch_id)`. Parent history is inherited. Child-only facts cannot leak upward or sideways. A row is current only if no visible descendant row points to it through `supersedes_fact_id`.

## Bounded context

- recent Scenes: 3
- relevant character memories: 12
- generic canon facts: 8

Memory ranking is deterministic: involved character, promise, relationship fact, salience, recency, stable ID.

## Prompt contract

Provider input separates `STORY CONFIG`, `PLAYER IDENTITY`, `CHARACTER IDENTITY`, `ADDRESS TERMS`, `RECENT SCENES`, `RELEVANT CHARACTER MEMORY`, `CANON FACTS`, and `PLAYER ACTION`. The provider emits memory candidates in the same response as narrative output and must copy canonical character IDs exactly.
