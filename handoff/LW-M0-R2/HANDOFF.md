# HANDOFF — LW-M0-R2

## Task

| Field | Value |
|---|---|
| **Task ID** | `LW-M0-R2` |
| **Task type** | Independent product / architecture / roadmap / agent-tooling review + documentation correction |
| **Task status** | **COMPLETE** |
| **Verdict** | **M0 PASS — conditional** on the M1 prerequisites in §9 |
| **Date** | 2026-08-10 |
| **Implementation performed** | **None.** Documentation only. |

## Repository State

| Field | Value |
|---|---|
| **Baseline path** | `E:\AIProjects\Lorewish` |
| **Baseline branch** | `main` |
| **Baseline HEAD** | **none — repository has zero commits.** `git rev-parse HEAD` does not resolve. |
| **Final branch** | `main` (unchanged) |
| **Final HEAD** | **none — no commit was created by this task** |
| **Remote** | none configured; nothing pushed |
| **Working tree status** | All project files untracked (`??`), because no commit exists. See `git-status.txt`. |

**No `git-diff.patch` is included.** The repository has no commits, so there is no HEAD to diff
against and fabricating one would misrepresent the baseline. Per the task instruction, complete
copies of all review-relevant documents are supplied in `review-files/` for independent inspection
instead.

## Files

### Created (4)

```
docs/M0_R2_REVIEW.md              Full review: findings, changes, decisions, PASS conclusion
docs/AGENT_TOOLING.md             REQUIRED / RECOMMENDED LATER / OPTIONAL / NOT APPROVED policy
docs/REFERENCE_PRODUCT_NOTES.md   Reference-product notes, evidence-tagged
handoff/LW-M0-R2/                 This handoff artifact
```

### Modified (10)

```
CURRENT_WORK.md                   Retitled ADV-M0-R1 → LW-M0-R2; status, findings, prerequisites
docs/PRODUCT_VISION.md            +§9 principles P1–P10, +§10 global/seed separation
docs/USER_RESEARCH_SYNTHESIS.md   P0/P1/P2 → R0/R1/R2; sharpened single-source risk
docs/CORE_LOOPS.md                Player-initiated promotion; branch scoping; creator scope cut
docs/MVP_SPEC.md                  Four-tier alpha evidence model; moderation, deletion, language,
                                  guest quota; monetization rewritten
docs/UX_CONTRACT.md               Unicode/IME safety; branch-scoped chat; story language
docs/DOMAIN_MODEL.md              Memory as projection; ChatThread; UsageCounter; §7–§10 added
docs/TECHNICAL_ARCHITECTURE.md    Capability cost measurement; RLS hardening; iOS constraint;
                                  §11 global readiness
docs/ROADMAP.md                   Monetization M6→M4; M1 prerequisites
docs/DECISIONS.md                 D2/D7/D9/D11 revised; D16–D23 added
```

### Unchanged

```
docs/MOTION_GUIDELINES.md         Reviewed in full — no corrections needed
```

### Deleted

None.

---

## Review Findings

Full detail in `review-files/M0_R2_REVIEW.md` §3. Summary:

### BLOCKING (2) — both fixed

| ID | Finding |
|---|---|
| **B1** | `P1`–`P10` referenced 30+ times across nine documents, **defined nowhere**. `PRODUCT_VISION.md` even linked `[P6](DECISIONS.md)`, a document using a `D`-prefixed scheme with no P-numbers. Every justification citing a principle resolved to nothing. |
| **B2** | `USER_RESEARCH_SYNTHESIS.md` used `P0/P1/P2` as priority tiers, colliding with the principle namespace — `P1` meant two different things in two documents. |

### HIGH (15) — all addressed

| ID | Finding |
|---|---|
| **H1** | Monetization sequenced behind publishing and discovery, neither of which it depends on. |
| **H2** | Alpha percentage thresholds acted as PASS/FAIL gates on zero telemetry, with a cohort whose confidence interval spans both the success and failure thresholds. |
| **H3** | "Image generation is the most expensive per-unit action" asserted as a standing architectural fact and used as load-bearing rationale. |
| **H4** | Context assembly unbounded — cost grows with run length, making the most-retained users the most expensive, invisibly. |
| **H5** | Chat canon promotion specified as automatic ("by the system when detected"), contradicting the guarantee the read-mostly design exists to provide. |
| **H6** | Chat threads scoped `character + run` while canon is scoped `run + branch` — undefined behaviour after a branch fork. |
| **H7** | Anonymous sessions + per-user free allowance = unmetered inference; per-user rate limiting cannot help when every abuser is a new user. |
| **H8** | RLS relied on for tenancy, but service-role Edge Functions bypass it — and those are the functions that matter. |
| **H9** | Owner's machine is Windows; iOS cannot be built locally. M1's "runs on an iOS device" bar was unreachable as written, threatening P9 silently. |
| **H10** | Moderation present in architecture and domain model, absent from MVP feature scope — implementable-by-omission for a 13+ product. |
| **H11** | No account deletion, no data-lifecycle, no guest-run fate, no story/run delete path. Store-compliance obligation. |
| **H12** | D2 fused "where testers come from" with "what the product is", licensing regional assumptions nobody decided to make. |
| **H13** | No Unicode/IME requirements on the composer — the claimed differentiator, facing a likely Vietnamese-speaking first cohort. |
| **H14** | MVP requires server-enforced allowance; the only entity that could count it was deferred to M6. |
| **H15** | No `.gitignore`. First scaffold would stage `node_modules`, build output and `.env` credentials. |

### MEDIUM (10)

`Memory` as both projection and entity; overstated MVP creator pipeline; implied scene/choice editor
for curated stories; undefined "AI freedom" field; two-vs-three story modes; story content language
never decided; session-end feedback prompt assumed but unspecified; ad compliance for a 13+ global
product unaddressed; three copies of the Supabase agent skills; guest-to-account upgrade has no UX
contract.

### LOW (5)

Player Loop milestone tagging vs its diagram; competitor-composer claim overgeneralized; desktop
button-only send stated as settled rather than hypothesis; broken cross-reference in D7; inconsistent
section-reference notation in `MOTION_GUIDELINES.md`.

---

## Decisions Changed (owner sign-off required)

| Decision | From | To |
|---|---|---|
| **D2** | Users seeded Vietnam/SEA before global expansion | Global product, English-first UI, globally-ready architecture from M1; VN/SEA is the alpha *recruiting cohort* only |
| **D7** | Promotion "by the system when detected" | Always a player action; system may only suggest; facts carry `origin`; threads branch-scoped |
| **D9** | Justified by "images cost most" | Same decision, rationale replaced with scope discipline; cost measured per capability |
| **D11** | Monetization at M6, mechanism pre-selected as rewarded ads | Monetization at M4 after the retention read; mechanism chosen from MVP data; cost instrumentation ships in MVP |
| **Roadmap** | M4 Publishing → M5 Discovery → M6 Monetization | **M4 Monetization → M5 Publishing → M6 Discovery** (M0–M3, M7 unchanged) |
| **Alpha criteria** | Percentage PASS/FAIL gates | Four-tier evidence model; percentages demoted to directional ranges |

**Added**: D16–D23 (principle namespace, alpha evidence model, per-capability cost, bounded context,
guest metering, moderation + deletion, story language, branch-scoped chat).

## Decisions Preserved

Every strong requirement was checked and none contradicted: three first-class platforms;
Expo/RN/TS/Expo Router; Supabase; canonical state in our database; AI providers never own product
state; free-text custom actions core; predefined choices retained; Quick Start + Advanced Setup as
distinct needs; the full composer contract (1–7 lines, Enter = newline, explicit Send, wraps,
long-paste safe, keyboard safe) — preserved verbatim and *extended*, not weakened; structured
character identity and forms of address; light roll optional; no mandatory RPG system; no AI video;
lightweight motion + Reduce Motion; no social network or creator marketplace before retention
evidence; 18+ out of scope; monetization never touching the first session or preceding a retention
read.

---

## Validation

| # | Check | Command / method | Result |
|---|---|---|---|
| 1 | Stale `ADV-` prefix | `Grep "ADV-"` across repository | **PASS** — the stale *active* task ID (`CURRENT_WORK.md` line 3, `**Task**: ADV-M0-R1`) is gone. Three occurrences remain in source documents, all historical and all justified below; further occurrences exist only inside `handoff/` copies of those same documents. |

**Justification for each remaining `ADV-` occurrence** (task requirement: return every occurrence
and justify it, or remove it):

| Location | Text | Justification |
|---|---|---|
| `CURRENT_WORK.md:9` | "The previous session ran as `ADV-M0-R1` under an earlier working name" | Historical fact. Rewriting it to `LW-M0-R1` would assert that a session which never used that identifier did. Retained deliberately, inside the section that establishes the `LW-` convention. |
| `CURRENT_WORK.md:103` | "carried over from `ADV-M0-R1`" | Attributes an open question to the session that actually raised it. |
| `docs/M0_R2_REVIEW.md:13` | "the M0 baseline produced by the previous session (`ADV-M0-R1`)" | Identifies the reviewed baseline by the name it was produced under. |
| `handoff/LW-M0-R2/**` | copies of the above, plus this document's own findings text | Derived artifacts and self-description, not project task naming. |

No occurrence remains where `ADV-` names an **active or future** task. All such IDs use `LW-`.
| 2 | Roadmap matches side-project + retention + early revenue | Manual read of `ROADMAP.md` | **PASS** — M4 monetization sits after the retention read, before publishing/discovery; counter-argument recorded. |
| 3 | No Vietnam-only product model | `Grep "Vietnam\|Vietnamese\|SEA"` | **PASS** — 5 occurrences: 2 describe the research source (factual), 3 describe the alpha cohort or the language-friction confound. No architectural or product regionalism. |
| 4 | Alpha metrics tiered | Manual read of `MVP_SPEC.md` §5–6 | **PASS** — four tiers; percentages explicitly demoted to non-gating ranges. |
| 5 | Cost architecture capability-based | `Grep "most expensive"` + manual read | **PASS** — assertion removed; per-capability measurement, config-based pricing, cost alarms. No AI provider selected. |
| 6 | CanonFact / Memory / Branch coherent | Cross-check `DOMAIN_MODEL` × `CORE_LOOPS` × `UX_CONTRACT` × `DECISIONS` | **PASS** — single store (`CanonFact`), Memory is a projection, ChatThread and promotion branch-scoped, origin recorded. |
| 7 | Creator scope subordinate to player scope | Manual read | **PASS** — draft/edit/playtest pipeline removed; scene/choice editor explicitly excluded; Advanced Setup retained on validated pain points. |
| 8 | Three platforms from M1 | Manual read of `ROADMAP.md` M1 | **PASS**, with H9 surfaced as a hard prerequisite rather than left implicit. |
| 9 | No 18+ feature | `Grep "18+"` + manual read | **PASS** — D15 intact; no 18+ feature anywhere. |
| 10 | No full AI video | `Grep "video"` + manual read | **PASS** — excluded in `PRODUCT_VISION`, `MVP_SPEC`, `MOTION_GUIDELINES`, D12. |
| 11 | Docs do not contradict | Cross-document sweep; milestone-reference grep | **PASS** — all M4/M5/M6 references consistent after renumbering; contradictions found during review are listed as findings and fixed. |

**Verification commands run** (read-only; no build, test or install exists to run at M0):

```
git -C E:\AIProjects\Lorewish status --porcelain=v1 --untracked-files=all
git -C E:\AIProjects\Lorewish branch --show-current
git -C E:\AIProjects\Lorewish rev-parse HEAD          → does not resolve (no commits)
git -C E:\AIProjects\Lorewish log --oneline -20       → empty
git -C E:\AIProjects\Lorewish remote -v               → empty
Grep "ADV-" | "M4|M5|M6" | "Vietnam|Vietnamese|SEA" | "\bP(10|[1-9])\b"
```

---

## Unresolved Issues

Requiring owner input — none blocks this handoff, three block M1:

1. **P2** — no usage anywhere in the document set; cannot be reconstructed. Supply or retire.
2. **"AI freedom" field** — define its concrete generation behaviour or cut it. *Recommendation:
   cut.* Must be settled before it reaches a schema.
3. **iOS build path** — Mac or cloud builds? **Blocks M1.**
4. **M4 mechanism** — confirm acceptance of a data-driven choice over the pre-committed ads plan.
5. **Alpha cohort language** — recruit English-comfortable testers, accept the language-friction
   confound, or ship a Vietnamese catalogue early?
6. **Agent-skill deduplication** — three copies exist (`.claude/`, `.agents/`, `agent/`); which is
   canonical? Not performed here: deleting files exceeded a documentation-only review's scope, and
   the answer depends on which agent runtimes are in use.
7. **Desktop send accelerator** — `Ctrl/Cmd+Enter` or button-only?
8. **Advanced Setup field set** — still unvalidated with users (carried from `ADV-M0-R1`).

---

## Recommendation For Next Task

**Do not start M1 yet.**

1. **Product-owner review of this handoff**, concentrating on the four changed decisions (D2, D7,
   D9, D11) and the roadmap resequencing. These change what gets built and in what order, and
   should be accepted deliberately rather than inherited from a review.
2. **Resolve the three M1 blockers**: iOS build path, `.gitignore` before any scaffolding, dev
   Supabase project with credentials held outside the repository.
3. **Then `LW-M1` — Foundation**: Expo + Expo Router shell on Android/iOS/Web; dev Supabase with
   Authoring Data schema; design tokens; shared composer built to `UX_CONTRACT.md` — with i18n
   scaffolding and Unicode/IME-safe composer behaviour included in the M1 evidence bar.

A reasonable optional step between: a short owner-run qualitative pass on the Advanced Setup field
set (open question 8), which would let M3 lock its form without guessing.

---

## Handoff Contents

```
handoff/LW-M0-R2/
├── HANDOFF.md            this document
├── files-changed.txt     created / modified / deleted
├── git-status.txt        working tree at task completion
├── tree.txt              repository file listing (skills and .git excluded)
└── review-files/         complete copies of all 14 review-relevant documents
```

`review-files/` substitutes for a git diff, which cannot exist against a repository with no commits.
The archive deliberately excludes `.git`, `node_modules`, `.env`, credentials, tokens, API keys,
machine configuration, caches, build artifacts and the vendored agent-skill directories.
