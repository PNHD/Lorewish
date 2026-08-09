# Current Work

**Task**: LW-M0-R3 — Owner Research Assimilation + Continuous Play Contract
**Status**: M0 closed. Verdict **PASS**. Awaiting product-owner sign-off before M1 begins.

## Task Naming Convention

Task IDs use the **`LW-`** prefix (Lorewish). The first session ran as `ADV-M0-R1` under an earlier
working name; that identifier is retained **only** where it states a historical fact about who
produced the baseline. All active and future task IDs use `LW-`.

## Branch / HEAD

- Branch: `main`.
- HEAD: **no commits exist** — `git rev-parse HEAD` does not resolve. All files are untracked.
- No remote configured; nothing pushed.
- No commit was created by this task. The product owner reviews the handoff first.

## What This Task Did

Read all fourteen baseline documents in full (the thirteen in `docs/` plus `CURRENT_WORK.md`),
without trusting prior summaries. Assimilated
**owner-provided research** — the owner downloaded and used the adjacent product "My Adventures"
directly and supplied a ~3-minute mobile screen recording plus a written report. Turned that
evidence into product decisions, corrected three LW-M0-R2 findings, and closed M0.

**No implementation of any kind** — no scaffolding, dependencies, Supabase project, migrations,
Edge Functions, AI provider calls, screens, payment, ads, deployment or store work. No file was
deleted. No sub-agents were used.

Full handoff: `handoff/LW-M0-R3/HANDOFF.md`.

## Files Changed

**Created (2)**

```
docs/CONTINUOUS_PLAY_CONTRACT.md
handoff/LW-M0-R3/            (handoff artifact)
```

**Modified (11)**

```
CURRENT_WORK.md
docs/REFERENCE_PRODUCT_NOTES.md
docs/PRODUCT_VISION.md
docs/CORE_LOOPS.md
docs/MVP_SPEC.md
docs/UX_CONTRACT.md
docs/DOMAIN_MODEL.md
docs/TECHNICAL_ARCHITECTURE.md
docs/ROADMAP.md
docs/DECISIONS.md
docs/AGENT_TOOLING.md
docs/M0_R2_REVIEW.md          (supersession notice only; findings left intact)
```

**Unchanged**: `docs/MOTION_GUIDELINES.md`, `docs/USER_RESEARCH_SYNTHESIS.md` — both reviewed in
full, neither needed correction.

**Deleted**: none.

## Headline Outcomes

1. **Continuous Play Contract** — the single most important change. Every turn resolves into
   exactly one of five explicit states (`CONTINUE_READY`, `EXPLICIT_CHECKPOINT`, `TERMINAL_ENDING`,
   `GENERATION_FAILED`, `ALLOWANCE_EXHAUSTED`). Play state is *derived* from committed state and
   failure states are *never persisted*, so a timeout or crash structurally cannot leave a residue
   that reads as a story ending. **"To be continued" is prohibited copy in every state.**
   New document: [docs/CONTINUOUS_PLAY_CONTRACT.md](docs/CONTINUOUS_PLAY_CONTRACT.md).
2. **Scene Readability Contract** — five separated content channels in a fixed order; mechanical
   state notation never inside prose; pacing guidance instead of a hard word cap.
   [UX_CONTRACT.md](docs/UX_CONTRACT.md) §1A.
3. **Branch semantics split** — player-facing **"Replay from here"** (MVP, a pure state operation
   landing directly in the reading view) versus creator **fork/remix** (M5). No shared vocabulary.
4. **Allowance, not price tags** — no numeric cost beside any choice, Send or chat control during
   normal play. MVP still has no payment surface at all.
5. **Three LW-M0-R2 findings corrected** — see below.

## R2 Findings Corrected

| R2 finding | Correction |
|---|---|
| **P2 unreconstructable**, owner input required, M1 blocker | **P2 = Control Without Complexity** — Quick Start and Advanced Setup, both first-class. Owner-supplied and therefore authoritative, not reconstructed. D26. |
| **iOS build path open** — "the most urgent question", M1 blocker | **Expo EAS cloud builds** are the default iOS path from the owner's Windows machine. No Mac required for M1. Apple Developer membership is a later prerequisite for device/TestFlight, not an M1 blocker. D24. |
| **"Three copies" of the Supabase skills; delete two** | **Wrong, and the recommendation was dangerous.** `.claude/skills/*` are NTFS **junctions** into `.agents/skills/*` — two physical trees, not three; 80 files, not ~120. The two trees differ only in `SKILL.md` frontmatter *rendering* for different runtime conventions; all 38 other files are byte-identical. Acting on the original advice would have deleted the only real copy and left Claude Code with dangling junctions. Inspection only — nothing was deleted. [AGENT_TOOLING.md](docs/AGENT_TOOLING.md). |

## Decisions Added (D24–D31)

| # | Decision |
|---|---|
| **D24** | iOS is built with Expo EAS cloud builds from Windows; per-platform evidence classes defined; build evidence is never reported as runtime validation |
| **D25** | The user-facing "AI freedom" field is removed from MVP; it never reaches a schema |
| **D26** | P2 is "Control Without Complexity" |
| **D27** | Player timeline branch ("Replay from here") and creator fork/remix are different concepts with different words |
| **D28** | Normal play communicates a usage allowance, not a per-action price |
| **D29** | No empty discovery sections during a small-content launch |
| **D30** | **Continuous Play Contract** — the most consequential decision in this group |
| **D31** | Scene Readability Contract |

No existing decision was reversed. D16's recorded P2 gap was closed.

## Open Questions

Carried forward from LW-M0-R2. **None blocks M1.**

1. **M4 mechanism** — confirm acceptance of a data-driven choice over the pre-committed ads plan.
2. **Alpha cohort language** — English-comfortable testers, accept the confound, or ship a
   Vietnamese catalogue early?
3. **Desktop send accelerator** — `Ctrl/Cmd+Enter`, or button-only? Alpha hypothesis either way.
4. **Advanced Setup field set** — still unvalidated with users. Validated during Alpha, not before.
5. **Which agent runtimes besides Claude Code** were skills installed for? Determines whether
   `agent/skills/` is load-bearing. Do not delete it before this is answered.

## M1 Entry Conditions

**One owner action gates M1**: sign-off on the changed decisions — D2, D7, D9, D11 and the roadmap
resequencing from LW-M0-R2, plus D24–D31 from this task.

Everything else previously listed as an "M1 prerequisite" is **M1's own first steps**, in order:

1. `.gitignore` — the very first act, before any dependency install or scaffold.
2. Secret-handling convention written down.
3. Owner creates the dev Supabase project; credentials outside the repository; production
   unreachable from agent tooling.
4. Owner sets up the Expo/EAS account and iOS build configuration (costed builds stay
   owner-initiated).
5. Install the approved agent skills.
6. Expo + Expo Router scaffold, then the rest of M1 scope.

## Recommended Next Task

**Product-owner review and sign-off of `handoff/LW-M0-R3/`**, specifically D24–D31 and the
continuous-play contract.

Then **LW-M1 — Foundation** per [ROADMAP.md](docs/ROADMAP.md): `.gitignore` first, then the
Expo/Expo Router shell (Android + Web runtime evidence, iOS EAS build evidence), dev Supabase with
the Authoring Data schema, design tokens, i18n scaffolding, and the shared composer built to
[UX_CONTRACT.md](docs/UX_CONTRACT.md) including Unicode/IME safety.

Do not begin the next task until explicitly instructed.
