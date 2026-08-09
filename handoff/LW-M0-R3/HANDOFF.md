# LW-M0-R3 — Handoff

**Task**: LW-M0-R3 — Owner Research Assimilation + Continuous Play Contract
**Date**: 2026-08-10
**Type**: Final M0 correction pass. Documentation only. **No implementation.**
**Verdict**: **M0 PASS**

---

## 1. Task

Assimilate owner-provided research from direct use of the adjacent product "My Adventures", define
a Continuous Play Contract, strengthen scene readability, formalize branch semantics, resolve the
three questions LW-M0-R2 left open, and close M0 with a PASS or REWORK decision.

Explicitly out of scope and **not performed**: Expo scaffolding, package installation, Supabase
connection or project creation, migrations, deployment, ad or payment configuration, AI provider
calls, application screens, commits, pushes. No sub-agents, no `feature-dev`, no agent teams, no
parallel or nested agents, no automatic delegation. No file was deleted.

## 2. Baseline

Read **in full**, not from summaries, before any change was made:

`CURRENT_WORK.md`, `docs/PRODUCT_VISION.md`, `docs/USER_RESEARCH_SYNTHESIS.md`,
`docs/CORE_LOOPS.md`, `docs/MVP_SPEC.md`, `docs/UX_CONTRACT.md`, `docs/MOTION_GUIDELINES.md`,
`docs/DOMAIN_MODEL.md`, `docs/TECHNICAL_ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`,
`docs/REFERENCE_PRODUCT_NOTES.md`, `docs/AGENT_TOOLING.md`, `docs/M0_R2_REVIEW.md`.

Additionally inspected directly on disk (not from the previous session's description):
`.claude/skills/`, `.agents/skills/`, `agent/skills/`, `skills-lock.json` — see §5.3.

## 3. Repository State

| Property | Value |
|---|---|
| Path | `E:\AIProjects\Lorewish` |
| Branch | `main` |
| **HEAD** | **none — the repository has zero commits.** `git rev-parse HEAD` returns `fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.` |
| Remote | none configured |
| Working tree | everything untracked: `.agents/`, `.claude/`, `agent/`, `docs/`, `handoff/`, `CURRENT_WORK.md`, `skills-lock.json`, `Lorewish_LW-M0-R2_handoff.zip` |
| Commit created by this task | none |
| Files deleted by this task | none |

**Because HEAD does not exist, no `git diff` is included and none was fabricated.** In its place,
`handoff/LW-M0-R3/review-files/` contains the complete current text of every document relevant to
reviewing this task, so the reviewer reads the artifact rather than a description of it.

## 4. Owner Research Assimilated

The product owner downloaded and used the adjacent mobile product directly and supplied a
~3-minute screen recording plus a written report. Recorded in
[`docs/REFERENCE_PRODUCT_NOTES.md`](../../docs/REFERENCE_PRODUCT_NOTES.md) §4, dated
**2026-08-10 — mobile app, owner screen recording**, with every statement tagged **[DIRECTLY
OBSERVED]**, **[OWNER INTERPRETATION]** or **[LOREWISH PRODUCT DECISION]** so an interpretation can
never be read as an observation. Several statements are additionally tagged **[NOT SUPPORTED BY
THIS EVIDENCE]** where a tempting inference is explicitly refused.

| # | Observation area | Lorewish response |
|---|---|---|
| 4.1 | Reading surface carries narrative, scene cards, choice cards, custom action, character chat, TTS, inventory/state, dice and branch/fork; content and metadata compete for attention | **Scene Readability Contract** — UX_CONTRACT §1A, D31 |
| 4.2 | **Continuation failure.** Choices, actions and branch continuations repeatedly reach a terminal-looking "to be continued" card; visible actions point back to the story rather than forward | **Continuous Play Contract** — new document, D30. The highest-signal finding and the largest change in this pass. |
| 4.3 | Branch/fork action leads into account/onboarding and a separate continuation context; the mental model is not obvious | **"Replay from here"** (player, MVP) vs **fork/remix** (creator, M5), non-overlapping vocabulary — D27 |
| 4.4 | Creation surface comparatively shallow (world/background, player character, illustration toggle) | Corroborates existing pain point #1; no new scope. Confirms **P2 — Control Without Complexity** (D26) |
| 4.5 | Dice/fate animation with numeric result; comparatively easy to understand | No change — Light Roll direction preserved (D6) |
| 4.6 | Credits visibly associated with custom action, character interaction and branching | **Allowance, not per-action price** — UX_CONTRACT §12, D28 |
| 4.7 | A discovery/filter surface reaches "no stories" while public content exists elsewhere | **No empty discovery sections at small-content launch** — UX_CONTRACT §10, D29 |
| 4.8 | Static illustrations present throughout; visual richness does not fix comprehension or continuity | Image volume is not a substitute for readable structure; second independent reason for D9's scope |

**Handling constraints honoured**: the recording is **not stored in this repository** and is **not
in the handoff ZIP**. No competitor story text, character, world, artwork, interface copy or visual
design is reproduced anywhere. No claim is made about the other product's internal architecture,
data model, pricing effectiveness, or the state of its catalogue as a whole.

## 5. Decisions Changed

### 5.1 New decisions — D24 to D31

Full text in [`docs/DECISIONS.md`](../../docs/DECISIONS.md).

| # | Decision | Driver |
|---|---|---|
| **D24** | iOS is built with **Expo EAS cloud builds** from the owner's Windows machine. Per-platform evidence classes: Android and Web give runtime evidence, iOS gives EAS build evidence during foundation, physical/TestFlight validation later. **A successful cloud build is never reported as runtime validation.** Apple Developer membership recorded as a later prerequisite for device/TestFlight distribution. | Resolves LW-M0-R2's most urgent open question |
| **D25** | The user-facing **"AI freedom"** Low/Medium/High field is **removed** from MVP and never reaches a schema. The generation layer may keep an internal adherence parameter in gateway configuration. Any future user-facing version must use behaviour-oriented language. | Owner ruling; LW-M0-R2 recommendation |
| **D26** | **P2 — Control Without Complexity**: Quick Start and Advanced Setup, both first-class. Owner-supplied, therefore authoritative rather than reconstructed. | Owner input |
| **D27** | **"Replay from here"** (player, MVP) and **fork/remix** (creator, M5) are different concepts with non-overlapping vocabulary. Branch creation is a pure state operation landing directly in the reading view. | Owner research §4.3 |
| **D28** | Normal play communicates a **usage allowance**, not a per-action price. No numeric cost beside any choice, Send, or chat control. | Owner research §4.6 |
| **D29** | **No empty discovery sections** during a small-content launch. Filter chips derive from content that exists. | Owner research §4.7 |
| **D30** | **Continuous Play Contract** — five explicit play states, ending language scoped to `TERMINAL_ENDING`, "to be continued" prohibited, failure states never persisted. **The most consequential decision in this group.** | Owner research §4.2 |
| **D31** | **Scene Readability Contract** — five separated content channels, fixed order, no state notation in prose, pacing guidance rather than a word cap. | Owner research §4.1, §4.8 |

**No existing decision was reversed.** D16's recorded gap ("P2 cannot be reconstructed") was
closed. D9 gained a second independent supporting reason.

### 5.2 The Continuous Play Contract in brief

New document: [`docs/CONTINUOUS_PLAY_CONTRACT.md`](../../docs/CONTINUOUS_PLAY_CONTRACT.md).

Five states — `CONTINUE_READY`, `EXPLICIT_CHECKPOINT`, `TERMINAL_ENDING`, `GENERATION_FAILED`,
`ALLOWANCE_EXHAUSTED`. The owner specified four; `ALLOWANCE_EXHAUSTED` was added because hitting
the free cap is neither a failure nor a narrative event, yet produces the same risk of a turn with
no next action, and MVP_SPEC §8 already required it to degrade gracefully with nowhere to live.

The mechanism, not merely the intent: play state is **derived** from `Scene.boundary_kind` on the
last committed scene, and failure states are **session-transient — never persisted**. A timeout,
crash or outage therefore leaves the run at its last durable scene, which re-derives to
`CONTINUE_READY`. Failure has nowhere durable to write itself. `boundary_kind = ending` is only ever
set from an explicit validated ending marker or an authored seed ending — never inferred from output
length, a stop reason, a truncated response, or the absence of generated choices.

The document also specifies the turn lifecycle, the single atomic canonical-state commit point,
idempotency via a client-generated `turn_id`, retry rules, what does and does not consume the
allowance (a player is never charged for our timeout), the branch transition, nine UI guarantees,
nine explicit prohibitions, and a seven-item evidence bar attached to M2.

### 5.3 R2 findings corrected

| R2 finding | Status after direct inspection |
|---|---|
| **P2 has no usage anywhere and cannot be reconstructed** — M1 blocker | **Resolved.** The owner held the original: P2 is *Control Without Complexity*. The R2 report was accurate about the document set and wrong about the world. D26. |
| **iOS build path open** — "the most urgent question", M1 blocker | **Resolved.** EAS cloud builds; no Mac required for M1. D24. |
| **"Three copies" of the Supabase agent skills; delete two** | **The finding was wrong and the recommendation was dangerous.** Corrected in full in [`docs/AGENT_TOOLING.md`](../../docs/AGENT_TOOLING.md). |

**Skill-installation inspection, in detail** — the evidence, since this reverses a prior
recommendation:

- `.claude/skills/supabase` and `.claude/skills/supabase-postgres-best-practices` are **NTFS
  junctions**, not directories. `dir /AL` reports `<JUNCTION>`; `Get-Item` reports
  `Attributes: Directory, ReparsePoint`, `LinkType: Junction`, `Target: .agents\skills\<same-name>`.
  They contain **zero bytes of their own**.
- There are therefore **two physical trees** (`.agents/skills/`, `agent/skills/`), 40 files each —
  **80 files, not the ~120 previously reported**.
- Every one of the 38 non-`SKILL.md` files is **byte-identical across both trees**, verified by
  SHA-256 over every file. Only the two `SKILL.md` files differ, and only in **frontmatter
  rendering**: `.agents/` carries a `name:` key with block-style `metadata:`, `agent/` omits `name:`
  and uses flow-style `metadata: {...}`. Rule content is identical. These are two renderings for two
  runtime conventions, not two drifted versions.
- All four paths share the creation timestamp **`2026-08-10 00:01:13`** — a **single installer
  run**, consistent with a multi-agent install (`--all`), not three ad-hoc copies.
- `skills-lock.json` pins the **upstream source** (`supabase/agent-skills`,
  `skillPath: skills/<name>/SKILL.md`). Its `computedHash` values (`c4cbf2d3…`, `128fac78…`) match
  **neither** installed `SKILL.md`, which is consistent with hashing the upstream file. **It does
  not designate a canonical install directory** and cannot be used to choose which tree to keep.
- **Which runtime consumes `agent/skills/` cannot be determined from repository evidence** — no
  config file in the repository references it. That is an owner question, recorded as such.

**Why the original recommendation was dangerous**: it advised keeping `.claude/skills/` and
deleting the other two. `.claude/skills/*` are junctions into `.agents/skills/*`; deleting
`.agents/` would have destroyed the only real copy and left Claude Code with two dangling junctions
and no skills at all.

**Nothing was deleted, moved or modified in any skill directory by this task.** This was inspection
only, as instructed.

## 6. Exact Documents Changed

**Created (1 document + this handoff)**

```
docs/CONTINUOUS_PLAY_CONTRACT.md
handoff/LW-M0-R3/
```

**Modified (12)**

| File | Change |
|---|---|
| `CURRENT_WORK.md` | Retitled to LW-M0-R3; status, outcomes, corrections, open questions, M1 entry conditions, next task |
| `docs/REFERENCE_PRODUCT_NOTES.md` | §4 owner research (8 sub-sections, dated, three-way tagged); tag table updated — the OWNER-PROVIDED class is no longer empty; §3 unknowns table updated with what is now observed; §5 open questions reduced to two; H-REF-2 revised from inference to observation |
| `docs/PRODUCT_VISION.md` | **P2 defined** as Control Without Complexity (authoritative, not reconstructed); provenance note updated; §2 promise extended with the continuous-play half |
| `docs/CORE_LOOPS.md` | Player Loop has no implicit stop — resolves into an explicit play state; roleplay loop commit made atomic and named; creator loop vocabulary separated from the player mechanic |
| `docs/MVP_SPEC.md` | "AI freedom" removed from Advanced Setup; P2 named; readability contract referenced on the reading view; §1.9 renamed "Replay from here"; features 15–16 added (continuous play, allowance-not-price); Replay Picker described as a waypoint; Tier 1 events extended; **continuous-play violation added as a Tier 2 hard failure** |
| `docs/UX_CONTRACT.md` | **New §1A Scene Readability Contract**; P2 framing on setup; "AI freedom" row and note replaced with the removal ruling; §6 editable list updated; §7 continuous-play precedence + previous scene stays readable; §9 rewritten as Replay UX; §10 empty-state rules; **new §12 Usage Allowance UX** |
| `docs/DOMAIN_MODEL.md` | "AI freedom" removed from `StoryConfiguration` and §6; `Scene.boundary_kind` added with strict rules for `ending`; **new §11 Turn Lifecycle and Derived Play State**; old §11 renumbered §12; Replay Picker naming |
| `docs/TECHNICAL_ARCHITECTURE.md` | §8 iOS constraint replaced with the **EAS decision** plus the per-platform evidence table and the build-vs-runtime honesty constraint; §5 **turn resolution is a gateway responsibility** + internal adherence parameter; §10 allowance-consumption refinement |
| `docs/ROADMAP.md` | M0 marked **PASS** and closed; M1 evidence bar restated per platform; **M1 Prerequisites replaced by M1 Entry Conditions** — product decisions resolved, setup work moved inside M1; M2 scope and evidence bar extended with both new contracts; M5 fork/remix vocabulary |
| `docs/DECISIONS.md` | **D24–D31 added**; D16 status updated to close the P2 gap |
| `docs/AGENT_TOOLING.md` | Repository-state section **rewritten** with the corrected inspection, path→consumer map, hashes and a corrected recommendation; Supabase skills entry install-scope and owner-action corrected; Expo/EAS account now required; new standing rule 6 (inspect before concluding, inspect before deleting) |
| `docs/M0_R2_REVIEW.md` | **Supersession notice only.** Findings left intact as a historical record; a table maps the four stale items to their current status |

**Unchanged, reviewed in full**: `docs/MOTION_GUIDELINES.md`, `docs/USER_RESEARCH_SYNTHESIS.md`.

**Deleted**: none.

## 7. Validation Performed

- All fourteen baseline documents read in full, in this session, before any edit.
- Repository state verified directly (`git rev-parse`, `git status --porcelain`, full recursive file
  listing with hidden files) rather than taken from the prior handoff.
- Skill directories inspected by link type (`Get-Item`, `dir /AL`), by per-file SHA-256 across both
  trees, by line diff of the differing files, and by creation timestamp.
- Cross-document consistency swept after editing: `AI freedom`, `P2`, `to be continued`,
  `Branch/Replay`, `fork/branch`, `three copies`, `M1 prerequisite`. Every live occurrence now
  resolves to a current statement; historical occurrences survive only inside
  `docs/M0_R2_REVIEW.md` (covered by its supersession notice) and inside the frozen
  `handoff/LW-M0-R2/` artifact, which is a record of a past session and is deliberately not
  rewritten.
- Every new cross-reference target checked to exist (`CONTINUOUS_PLAY_CONTRACT.md`, UX_CONTRACT
  §1A/§12, DOMAIN_MODEL §11, DECISIONS D24–D31, PRODUCT_VISION §9 P2).
- ZIP integrity verified after creation; entry list and SHA-256 recorded in §11.

**Not validated, and not claimed**: nothing was executed, built, run or measured. No iOS build, no
Android install, no browser run, no telemetry. This was a documentation task.

## 8. Unresolved Product Decisions

**None blocks M1.** Each is either an Alpha-time question or an owner preference with no
engineering dependency.

1. **M4 mechanism** — rewarded ads or a consumable credit pack, chosen from MVP data. The owner
   should confirm they accept a data-driven choice over the originally pre-committed ads plan.
2. **Alpha cohort language** — recruit English-comfortable testers, accept the language-friction
   confound, or ship a Vietnamese catalogue earlier than planned.
3. **Desktop send accelerator** — `Ctrl/Cmd+Enter` or button-only. An Alpha hypothesis either way.
4. **Advanced Setup field set** — unvalidated with users; validated during Alpha, not before it.
5. **Which agent runtimes besides Claude Code** the skills were installed for. Determines whether
   `agent/skills/` is load-bearing. **Do not delete it before this is answered.**

## 9. M0 Verdict

### **PASS**

Not a conditional pass. Every open **product and architecture** decision is closed:

| Previously open | Closed by |
|---|---|
| P2 undefined | D26 |
| iOS build path | D24 |
| "AI freedom" behaviour | D25 |
| What happens when a turn ends | D30 + `CONTINUOUS_PLAY_CONTRACT.md` |
| How a scene is structured for reading | D31 + UX_CONTRACT §1A |
| Branch vs fork semantics | D27 |
| How usage cost is communicated | D28 |
| Discovery at small content volume | D29 |

What remains is owner sign-off and ordinary setup work — `.gitignore`, scaffolding, skill
installation, dev configuration, EAS setup, the dev Supabase project. Each of those is the first
hour of M1, not a product-definition question, and keeping M0 open for them would confuse
"undecided" with "not yet done".

**REWORK was considered and rejected.** The changes in this pass are additive corrections to a
document set that was already sound: one new contract, one new UX section, eight new decisions, one
factual correction to a tooling finding. No document needed rebuilding and no architectural
decision was reversed. The one finding that would have justified REWORK — the continuation failure —
is fixed here in full rather than flagged for another pass.

**The most valuable single change** is the Continuous Play Contract, and specifically its derived
state design. It converts "we intend not to strand the player" into a property that fails loudly in
a test rather than quietly in production.

## 10. Exact Next Task

**LW-M1 — Foundation.** Begin only after the product owner signs off on this handoff.

Entry gate: owner sign-off on D2, D7, D9, D11 and the roadmap resequencing (LW-M0-R2), plus D24–D31
(this task).

Ordered scope:

1. Create `.gitignore` — **the first act, before any dependency install or scaffold** — covering
   `node_modules`, Expo/EAS build output, `.env*`, local tooling caches.
2. Write the secret-handling convention.
3. Owner creates the dev Supabase project; credentials outside the repository; production
   non-existent or provably unreachable from agent tooling.
4. Owner sets up the Expo/EAS account and iOS build configuration. Costed builds stay
   owner-initiated.
5. Install the approved agent skills at their standardized locations.
6. Expo + Expo Router shell; Supabase Auth + Authoring Data schema; design tokens; i18n scaffolding
   (externalized strings, locale-independent keys, UTC timestamps); the shared composer built to
   UX_CONTRACT §2–3 including Unicode/IME safety.

M1 evidence bar, per platform: **Android** — installs and runs on a device, auth works, composer
checklist passes on-device. **Web** — runs in a browser, same evidence. **iOS** — the target
compiles and produces a build artifact via EAS; physical/TestFlight validation is recorded
separately and only when it actually happens.

Do not begin M1 until explicitly instructed.

## 11. Handoff Archive

See the final response for the archive path, byte size, SHA-256 and entry listing. The archive
excludes `.git/`, `.env*`, credentials, tokens, API keys, `node_modules/`, build output, `.expo/`,
machine caches, the owner's recording, any competitor media, and the agent-skill trees.
