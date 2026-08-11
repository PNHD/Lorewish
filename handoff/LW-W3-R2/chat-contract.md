# Character Chat contract

## Identity and branch binding

- One durable thread is keyed by `(player_run_id, run_branch_id, character_id)`.
- The Character must already be canonical and visible to the selected branch.
- Replaying to another branch creates/uses another thread; existing threads never move.

## Non-canonical default

- Player and Character messages are Chat history only.
- Chat generation cannot create a Scene, switch a branch, mutate Story canon, change immutable identity/address terms, or consume Story-turn allowance.
- Character replies can include only `reply` plus at most five structured pending memory candidates.

## Context and bounds

- Reads branch-visible Story Scenes and canonical Character memory.
- Sends at most the newest 3 Scenes and newest 20 Chat messages.
- Story content language controls the reply language.
- Provider prompt forbids AI disclosure, absent knowledge claims, physical Story advancement, and address-register mutation.

## Failure/accounting

- Player message creation and generation status are durable.
- Provider/transport/validation failures do not create a Character response.
- Retry creates a new idempotent player message request; loading disables duplicate send.
- Provider, model, input/output tokens, cost, latency, and status are persisted separately from Story allowance.
