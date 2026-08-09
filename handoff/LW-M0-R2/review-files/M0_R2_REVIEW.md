# LW-M0-R2 — Independent M0 Review

Status: COMPLETE
Task: **LW-M0-R2**
Date: 2026-08-10
Type: Independent review + documentation correction. **No implementation.**

---

## 1. Review Scope

An independent review of the M0 product-definition baseline produced by the previous session
(`ADV-M0-R1`), conducted without presumption that the prior work was correct. All eleven baseline
documents were read in full, not sampled or reviewed from summaries.

**In scope**: contradictions, duplicate concepts, unsupported assumptions, missing state
transitions, premature complexity, scope leakage, vague requirements, platform inconsistencies, cost
risks, security risks, QA gaps, evidence gaps; the seven review issues raised by the owner; and
agent-tooling policy.

**Out of scope, and not performed**: any implementation, scaffolding, dependency installation,
Supabase project creation, migration, Edge Function, paid AI API call, payment or ad configuration,
deployment, store listing, artwork generation, or M1 work. No commit, push or remote was created. No
sub-agents were used. No machine-level tools were installed. No external browsing was performed;
reference-product statements rest solely on what the owner supplied as publicly verifiable.

---

## 2. Baseline Inspected

| Property | Value |
|---|---|
| Path | `E:\AIProjects\Lorewish` |
| Branch | `main` |
| HEAD | **none — repository has zero commits** (`git rev-parse HEAD` does not resolve) |
| Remote | none configured |
| Working tree | 11 baseline documents, all untracked; plus pre-existing agent-skill directories and `skills-lock.json`, none of which any M0 document mentioned |

The owner's stated expectations (branch `main`, no commit) were verified rather than assumed, and
both held. Two things the brief did not mention were found: the triplicated Supabase agent skills,
and the **absence of a `.gitignore`**.

Documents reviewed in full: `PRODUCT_VISION`, `USER_RESEARCH_SYNTHESIS`, `CORE_LOOPS`, `MVP_SPEC`,
`UX_CONTRACT`, `MOTION_GUIDELINES`, `DOMAIN_MODEL`, `TECHNICAL_ARCHITECTURE`, `ROADMAP`,
`DECISIONS`, `CURRENT_WORK`.

**Overall assessment of the baseline.** It is materially better than average for a milestone-zero
document set: the canonical-state principle is genuinely well argued, the stack evaluation
considers and rejects alternatives rather than asserting a preference, the UX contract is specific
enough to build against, and scope discipline is real. The defects below are concentrated in three
places — an undefined cross-reference namespace, numbers presented with more authority than their
evidence supports, and a handful of state transitions that were never followed to their end.

---

## 3. Findings

### BLOCKING

**B1 — The `P1`–`P10` principle namespace is referenced 30+ times and defined nowhere.**
Nine of ten documents justify requirements by citing product principles: "reading-first (P1)", "this
implements P4", "P9 requires Android+iOS+Web", "directly serves P1". No document defines any of
them. `PRODUCT_VISION.md` §4 even linked `[P6](DECISIONS.md)` — a link into a document that uses a
`D`-prefixed scheme and contains no P-numbers at all.

An implementation agent told to satisfy P7 had no way to discover what P7 was. This is blocking not
because the underlying intent is unclear to a careful human reader, but because the documents'
*entire justification structure* rested on identifiers that resolved to nothing.

**B2 — `P0/P1/P2` collide with the principle namespace.**
`USER_RESEARCH_SYNTHESIS.md` §6 used `P0/P1/P2` as requirement-priority tiers. So `P1` meant
"reading-first principle" in `UX_CONTRACT.md` and "priority tier 1" in the research synthesis, with
nothing marking the difference. Compounds B1: a reader resolving `P1` correctly in one document
resolves it incorrectly in another.

### HIGH

**H1 — Monetization sequenced behind two milestones it does not depend on.**
Monetization sat at M6, after M4 publishing and M5 discovery. No dependency justified this: rewarded
ads, a credit pack, and credit-gated regeneration require the usage/credit substrate and a payment
integration — none of which touch a public library or a search index. For an owner-funded side
project, the ordering deferred the cheapest available answer to the project's largest risk behind
two large non-revenue milestones. *(Review Issue 2.)*

**H2 — Alpha thresholds presented as PASS/FAIL gates on no evidence.**
`MVP_SPEC.md` §5/§6 stated ≥60% activation, ≥20% D7 return, and a <10% D7 auto-fail, against a
planned cohort of "order of tens". With ~30 activated users, 20% D7 is six people; one tester moves
the figure more than three points, and the confidence interval spans the success and failure
thresholds simultaneously — the same data could have been read either way. Distinguishing a true
10% from a true 20% D7 rate needs a cohort on the order of hundreds per arm. No Lorewish telemetry
exists from which any of these numbers was derived. *(Review Issue 4.)*

**H3 — Cost architecture hard-coded an assumption about which modality is most expensive.**
`TECHNICAL_ARCHITECTURE.md` §10 asserted "image generation is the most expensive per-unit action"
as a standing fact, and `DECISIONS.md` D9 used it as load-bearing rationale. Provider pricing moves
in both directions; more importantly, long-context scene prose is a cost *curve* that grows with
run length while image cost is near-flat, so the ranking can invert within a single user's
lifetime. *(Review Issue 5.)*

**H4 — Context assembly was unbounded.**
The domain model requires every call to be assembled fresh from canonical state but never bounds
the assembly. CanonFacts and Scenes accumulate monotonically, so scene *N*'s cost grows with *N*
and per-run cost is superlinear in run length. The most deeply retained users — exactly the ones the
product is optimizing for — become the most expensive, invisibly, until an invoice arrives. Not
mentioned in any document.

**H5 — Character-chat canon promotion was specified as automatic, contradicting its own guarantee.**
`CORE_LOOPS.md` §3 said a message is marked canon-worthy "by the system when the AI/app detects" it.
That is automatic promotion, which is precisely the silent-canon-corruption the read-mostly design
exists to prevent. D7's wording ("can be explicitly promoted") left the actor ambiguous. *(Review
Issue 6.)*

**H6 — Chat threads had no branch scoping — a missing state transition.**
`UX_CONTRACT.md` §8 scoped a chat thread to `character + run`. CanonFacts are scoped to
`run + branch`. When a player replays from a checkpoint and forks a branch, the model did not say
what happens to a chat thread citing canon from the now-abandoned timeline. Undefined behaviour at
the intersection of two MVP features. *(Review Issue 6.)*

**H7 — Guest sessions plus a free daily allowance is an unmetered-inference hole.**
Anonymous auth is offered for trying a sample story, and the free allowance is per-user. A user who
exhausts it can discard the anonymous session and start another indefinitely. The documented
mitigation — server-side per-user rate limiting — does not help when every abuser is a new user.
Directly funds an attacker's inference costs from the owner's budget.

**H8 — RLS treated as sufficient where it is bypassed.**
`TECHNICAL_ARCHITECTURE.md` §4 relies on RLS for run ownership, but Edge Functions using a
service-role key bypass RLS entirely — and the functions that matter (AI gateway, materialization,
allowance check) are exactly those. No document required independent ownership verification inside
those functions. A gateway trusting a client-supplied run id is a data-leak and a billing-abuse
vector simultaneously.

**H9 — iOS cannot be built on the owner's machine; M1's evidence bar is unreachable as written.**
The development environment is Windows. ROADMAP M1 requires the app to install and run on an iOS
device. iOS builds require Xcode (macOS) or a cloud build service, plus a paid Apple Developer
membership for on-device installation. Nothing in any document acknowledged this. The realistic
failure is silent: M1 ships "Android and Web now, iOS later", and P9 — all three platforms
first-class from the first slice — breaks at the first milestone without anyone deciding to break
it.

**H10 — Moderation was architecturally present but absent from MVP scope.**
`ModerationState` exists in the domain model and `moderateContent` in the gateway, but
`MVP_SPEC.md` §1 never listed moderation as an MVP feature, and §8 tied it to the public-content
milestone. For a 13+ product feeding free-text player input into an LLM, output moderation is a
closed-alpha requirement. Implementable-by-omission as written.

**H11 — No account deletion or data-lifecycle path anywhere.**
MVP creates accounts. Apple requires in-app account deletion for any app offering account creation,
and Google Play requires an accessible data-deletion route. Neither appeared in any screen list,
feature list or domain entity. Cheap now; a store-review blocker if found late. Guest-run fate and
branch/story deletion were likewise unmodeled.

**H12 — Seed market and product architecture were fused in a single decision.**
D2 targeted users "seeded first in Vietnam/SEA … before global expansion", fusing a recruiting fact
with a product-positioning decision. Because it read as targeting, it licensed regional assumptions
nobody had deliberately made, while the genuinely load-bearing global-readiness items — i18n
scaffolding, locale-independent taxonomy keys, UTF-8/IME-safe input, UTC timestamps — appeared
nowhere or were deferred to M7. *(Review Issue 3.)*

**H13 — No Unicode/IME requirements on the composer.**
The composer is the product's claimed differentiator (P7) and the alpha cohort is expected to
include Vietnamese speakers. Nothing addressed IME composition (Vietnamese Telex, CJK candidate
selection), grapheme-cluster-based counting, or line-height for diacritic stacking. A composer that
mangles Vietnamese input fails its differentiating claim in front of the exact first cohort.

**H14 — MVP requires a server-enforced allowance while deferring the only entity that could count.**
`MVP_SPEC.md` §1.11 and `TECHNICAL_ARCHITECTURE.md` §10 require server-side allowance enforcement in
MVP; `DOMAIN_MODEL.md` §3 marked `CreditLedger` — the sole candidate store — as M6. Something must
count in MVP, and nothing was specified to do it.

**H15 — No `.gitignore` exists.**
The repository has none and no commits. The first `npm install` or Expo scaffold would stage
`node_modules`, build output, and `.env` files carrying Supabase and AI provider keys. A key
committed to git history is compromised even after deletion.

### MEDIUM

**M1 — `Memory` was simultaneously a projection and an entity.**
`DOMAIN_MODEL.md` §2 defined Memory as a curated subset of CanonFacts explicitly to avoid two
systems of record, while `CORE_LOOPS.md` and D8 described Memories being *created* by promotion —
reintroducing the second store the definition was written to prevent.

**M2 — `CORE_LOOPS.md` §4 overstated MVP creator scope.**
It described MVP authoring as `configure → generate draft → edit → playtest`: a four-stage pipeline
with draft, editor and playtest as distinct states. `MVP_SPEC.md` funds none of that. In MVP,
creating and playing are the same act. *(Review Issue 7.)*

**M3 — Authored seed scenes and choices imply an editor nobody scoped.**
`DOMAIN_MODEL.md` §1 includes `Scene (seed)` and `Choice (authored)` for curated stories, but no
document says how curated stories are produced. Left open, this becomes a scene/choice editor —
the largest creator-scope risk in the set, inside a player-focused MVP. *(Review Issue 7.)*

**M4 — "AI freedom" is an undefined field.**
Low/Medium/High adherence, with no document stating what any level changes in prompt construction,
no research pain point requesting it, and an effect close to unobservable to a user. Costs a form
row, a schema column, prompt branching and three variants to test.

**M5 — Story modes: two or three?**
`PRODUCT_VISION.md` §4 described "three selectable story modes (Narrative / Adventure / RPG)";
`MVP_SPEC.md` and `UX_CONTRACT.md` ship two with RPG reserved.

**M6 — Story content language was never decided.**
If a Vietnamese tester types a Vietnamese premise, no document says what language the story
generates in, or whether it stays stable across a run. Load-bearing for the actual first cohort and
expensive to retrofit — it affects the domain model and every prompt.

**M7 — The session-end feedback prompt was assumed but never specified.**
`MVP_SPEC.md` §5 required consistency breaks to be "manually tracked via a feedback prompt at
session end" — a feature absent from the feature list and the screen list.

**M8 — Advertising compliance for a 13+ global product was unaddressed.**
Rewarded ads to a 13+ audience shipping globally carry ad content-rating obligations, regional
consent requirements covering minors, platform families/ads policy obligations and iOS tracking
consent. Material to an ads-versus-credit-pack decision that had already been pre-made in favour of
ads.

**M9 — Three copies of the Supabase agent skills.**
`.claude/skills/`, `.agents/skills/` and `agent/skills/` contain the same two skills; the first two
are byte-identical, the third differs slightly. ~120 files where ~40 are needed. Drift makes "which
guidance is authoritative" tool-dependent.

**M10 — Guest-to-account upgrade has no UX contract.**
`TECHNICAL_ARCHITECTURE.md` §7 asserts a guest run is upgradeable without loss, but no document
specifies the flow, the prompt moment, or what happens to a guest run that is never upgraded.

### LOW

**L1** — `CORE_LOOPS.md` tags the Player Loop as MVP/M2 while its diagram includes rolls and
character chat, which arrive at M3.
**L2** — `PRODUCT_VISION.md` §7 asserts "competitors visibly ship one-line composers" as general
fact; the evidence covers one adjacent product.
**L3** — Desktop web sends by button only, with Enter and Shift+Enter both inserting newlines. A
defensible choice for deliberate long-form actions, but stated as settled rather than as a
hypothesis, and it diverges from near-universal desktop convention.
**L4** — `DECISIONS.md` D7's cross-reference pointed at "REQUIRED PRODUCT DECISIONS §6", a section
that does not exist.
**L5** — `MOTION_GUIDELINES.md` §4 cites `MVP_SPEC.md` "§3.9" using a section-item notation not used
elsewhere.

---

## 4. Exact Changes Made

### Created

| File | Purpose |
|---|---|
| `docs/M0_R2_REVIEW.md` | This document |
| `docs/AGENT_TOOLING.md` | Tooling policy: REQUIRED / RECOMMENDED LATER / OPTIONAL / NOT APPROVED, with phase, install scope, security and owner-action for each |
| `docs/REFERENCE_PRODUCT_NOTES.md` | Reference-product notes with strict VERIFIED / OWNER-PROVIDED / INFERENCE tagging |

### Modified

**`docs/PRODUCT_VISION.md`** — added §9 defining principles P1–P10 (reconstructed from usage, with
an explicit provenance caveat, and P2 flagged as unreconstructable) and the repository-wide
namespace rule *(B1, B2)*; added §10 separating global product commitment from seeded test cohort,
including the language-friction confound *(H12)*; fixed the broken `[P6]` link and stated two MVP
story modes *(M5)*; milestone references M4→M5, M5→M6.

**`docs/USER_RESEARCH_SYNTHESIS.md`** — renamed priority tiers `P0/P1/P2` → `R0/R1/R2` with a
naming note *(B2)*; separated "category pains are real" from "stated preferences generalize" in the
single-source risk, and added a specific caveat that ad-tolerance evidence predicts acceptance far
better than revenue *(H12, H1)*; milestone renumbering.

**`docs/CORE_LOOPS.md`** — canon promotion rewritten as player-initiated with system suggestion
only, plus origin tagging *(H5)*; added branch-scoping rules for chat threads and promoted facts
*(H6)*; corrected MVP creator scope to `configure → play`, removing the draft/edit/playtest pipeline
*(M2)*; stated that curated sample stories are seed data with no in-product editor *(M3)*; added a
loop-versus-milestone tagging note *(L1)*; milestone renumbering.

**`docs/MVP_SPEC.md`** — §5/§6 replaced with a four-tier evidence model — instrumentation (hard
gate), hard failure criteria (hard gate), directional signal (explicitly not a gate), qualitative
review (hard gate on performing it) — including the required event set and an explicit statement of
why the old thresholds cannot gate *(H2)*; added moderation, account deletion, story language and
the server-enforced allowance counter to the feature list *(H10, H11, M6, H14)*; added the guest
quota rule with its rejected alternative *(H7)*; rewrote §8 monetization around cost/demand
instrumentation, a single bounded M4 mechanism chosen from data, the closed-cohort revenue
limitation, ad-compliance cost, and non-negotiable first-session protection *(H1, M8)*; clarified
that i18n scaffolding is in scope and only translated catalogues are deferred *(H12)*; excluded any
in-product scene/choice editor *(M3)*; added the session-end feedback prompt to the settings screen
*(M7)*.

**`docs/UX_CONTRACT.md`** — added Unicode/IME safety to the composer contract: composition-event
safety, grapheme-cluster counting, script-aware line height, UTF-8 end to end *(H13)*; added an
optional `Ctrl/Cmd+Enter` desktop accelerator flagged as a hypothesis *(L3)*; scoped chat threads to
character + run + branch and required player-initiated, reversible promotion *(H6, H5)*; added a
story-language field and flagged "AI freedom" as underspecified with a cut recommendation *(M6,
M4)*; required locale-independent taxonomy keys *(H12)*; milestone renumbering.

**`docs/DOMAIN_MODEL.md`** — `Memory` redefined strictly as a projection over `CanonFact`, ending
the dual-entity ambiguity *(M1)*; added `ChatThread` scoped to run + character + branch *(H6)*;
added `origin` to `CanonFact` making chat-versus-story provenance queryable *(H5)*; added
`UsageCounter` as an MVP entity *(H14)*; added §7 bounded context assembly, with identity state
never truncated *(H4)*; added §8 story language *(M6)*; added §9 canon promotion rules *(H5)*; added
§10 data lifecycle and deletion *(H11)*; recorded capability on the audit log *(H3)*.

**`docs/TECHNICAL_ARCHITECTURE.md`** — replaced the image-cost assertion with capability-level
measured cost: per-call capability cost logging, provider prices as configuration, gating driven by
measured ranking, per-capability cost alarms *(H3)*; added guest metering and context budgeting to
cost controls *(H7, H4)*; added the RLS/service-role warning requiring independent ownership checks
*(H8)*; added the Windows/iOS build constraint as an M1 blocker *(H9)*; added advertising
compliance *(M8)*; added §11 global readiness from the foundation as an M1 requirement table
*(H12)*; strengthened observability to make cost-per-retained-user a hard requirement *(H1, H2)*;
milestone renumbering.

**`docs/ROADMAP.md`** — monetization moved to **M4**, publishing to **M5**, discovery to **M6**,
with the reasoning and the counter-argument both recorded *(H1)*; M4 rewritten as a bounded
single-mechanism experiment with an honest statement that a closed cohort cannot transact real
revenue; M3 evidence bar rewritten against the four-tier model *(H2)*; added six M1 prerequisites
covering the iOS build path, `.gitignore`, secret handling, dev-project creation, P2 resolution and
the "AI freedom" ruling *(H9, H15, B1, M4)*; Alpha/Beta scope corrected.

**`docs/DECISIONS.md`** — **D2 revised** (global product, seeded cohort) *(H12)*; **D7 revised**
(player-initiated promotion, origin tagging, branch scoping) *(H5, H6)*; **D9 rationale revised**
(decision stands, cost-ranking justification removed) *(H3)*; **D11 revised** (M6→M4 sequencing,
mechanism no longer pre-committed, instrumentation in MVP) *(H1)*; D4 and D12 milestone references
updated; **D16–D23 added** covering the principle namespace, the alpha evidence model, per-capability
cost measurement, bounded context assembly, guest metering, moderation and account deletion, story
language, and branch-scoped chat.

**`CURRENT_WORK.md`** — retitled to task **LW-M0-R2** *(Review Issue 1)* with accurate status,
findings summary, open questions and next-task recommendation.

### Deleted

None. No file was deleted by this review.

---

## 5. Decisions Preserved

Every strong requirement the brief asked to preserve was checked against the review's findings and
**none was contradicted**:

- Android / iOS / Web first-class from M1 — preserved, and **strengthened** by naming the Windows
  iOS-build constraint that threatened it silently (H9).
- Expo / React Native / TypeScript / Expo Router — preserved (D13). The stack evaluation is sound.
- Supabase backend — preserved (D13), with RLS hardening added (H8).
- Canonical state in our database; AI providers never own product state — preserved (D14),
  reinforced by chat-thread branch scoping and the explicit rule that transcripts are never
  authoritative.
- Free-text custom actions core; predefined choices retained — preserved (D5).
- Quick Start + Advanced Setup as distinct needs — preserved (D3), with one field questioned (M4),
  not the mechanism.
- Multiline composer: 1–7 lines, Enter = newline, explicit Send, wraps, long-paste safe, keyboard
  safe — preserved verbatim and **extended** with Unicode/IME requirements (H13).
- Structured character identity and forms of address — preserved (P4/D8), and protected from
  truncation under context budget pressure (H4).
- Light roll optional; no mandatory RPG system — preserved (D6).
- No full AI video — preserved (D12, MOTION_GUIDELINES).
- Lightweight motion only; Reduce Motion required — preserved. `MOTION_GUIDELINES.md` was reviewed
  in full and **needed no changes** — the strongest document in the set.
- No social network, no large creator marketplace before retention evidence — preserved (D12), and
  reinforced by removing the implicit authoring pipeline (M2, M3).
- 18+ out of scope — preserved (D15). No 18+ feature entered scope.
- Monetization never contaminates the first session or precedes a retention read — preserved
  exactly, despite the resequencing.

---

## 6. Decisions Changed

| Decision | From | To | Driver |
|---|---|---|---|
| **D2** | Target users seeded in Vietnam/SEA before global expansion | Global product, English-first UI, globally-ready architecture from M1; VN/SEA is the alpha *recruiting* cohort only | H12 / Issue 3 |
| **D7** | Chat "can be explicitly promoted … by the system when detected" | Promotion is always a player action; system may only suggest; facts carry `origin`; threads are branch-scoped | H5, H6 / Issue 6 |
| **D9** | Decision justified by "images are the costliest per-unit action" | Same decision; rationale replaced with scope discipline and unproven quality. Cost ranking is measured, not assumed | H3 / Issue 5 |
| **D11** | Monetization at M6, mechanism pre-selected as rewarded ads | Monetization at M4 after the retention read; mechanism chosen from MVP cost/demand data; cost instrumentation ships in MVP | H1 / Issue 2 |
| **Roadmap order** | M4 Publishing → M5 Discovery → M6 Monetization | M4 Monetization → M5 Publishing → M6 Discovery | H1 / Issue 2 |
| **Alpha criteria** | Percentage PASS/FAIL gates | Four-tier evidence model; percentages demoted to directional ranges | H2 / Issue 4 |

---

## 7. Deferred Questions (Owner Input Required)

1. **P2.** Nine of ten principles were reconstructed from usage. `P2` has no usage anywhere. Supply
   the original, or retire the identifier. *(Blocks nothing technically, but leaves a hole in the
   justification structure.)*
2. **"AI freedom" field.** Define what Low/Medium/High concretely change in prompt construction, or
   cut it. Recommendation: **cut**, until a concrete behaviour exists. Must be settled before it
   reaches a schema.
3. **iOS build path.** Mac, or cloud builds? Both cost money and setup time, and M1 cannot pass its
   own evidence bar without one. **The most urgent of these questions.**
4. **M4 mechanism.** Deliberately left open — decided from MVP data. The owner should confirm they
   accept a data-driven choice rather than the pre-committed rewarded-ads plan.
5. **Alpha cohort language.** Recruit English-comfortable testers, accept the language-friction
   confound, or ship a Vietnamese string catalogue earlier than planned? Affects how Tier 4 findings
   can be read.
6. **Agent-skill deduplication.** Which of the three skill directories is canonical? Depends on
   which agent runtimes the owner uses.
7. **Desktop send accelerator.** Ship `Ctrl/Cmd+Enter`, or keep button-only? Low-risk either way;
   worth a decision rather than a default.
8. **Advanced Setup field validation.** Carried over from the previous session's open questions and
   still unresolved: the ten-field set has not been tested with users.

---

## 8. M0 Conclusion

### **PASS, conditional on the M1 prerequisites in §9.**

The baseline is sound in its fundamentals — the canonical-state architecture, the stack evaluation,
the UX contract and the scope discipline are all genuinely good work, and the review found no reason
to reverse any major architectural decision. That is the substance of a milestone-zero document set,
and it holds.

**REWORK was considered and rejected.** B1 and B2 are severe, but they are defects in the
*referencing apparatus* rather than in the thinking — the principles were being applied
consistently, they simply were never written down. Every finding proved correctable by targeted
amendment; none required rebuilding a document or reversing a decision. Issuing REWORK would have
meant discarding sound work over a broken index.

**The finding that most nearly forced REWORK** was H2 (alpha thresholds as gates), because it could
have caused a wrong product decision rather than merely a confusing read — a promising product
killed on a six-user D7 figure, or a failing one greenlit. It is fixed rather than flagged.

The four highest-value corrections, in order:

1. **B1/B2** — the document set now references a namespace that exists.
2. **H2** — the alpha can no longer produce a false verdict from noise.
3. **H1** — the largest commercial risk gets its cheapest answer before two large milestones are
   built on top of it.
4. **H4 + H3** — cost is bounded and measured, rather than growing invisibly with the engagement the
   product is designed to produce.

---

## 9. Exact Prerequisite For M1

M1 may begin when all of the following are true. Items 1–3 are hard blockers.

1. **iOS build path secured** — Mac access or a cloud build service, plus an Apple Developer
   Program membership for on-device installation. *Without this, M1's evidence bar cannot be met
   and P9 breaks at the first milestone.* (H9)
2. **`.gitignore` created before any dependency is installed or scaffold generated** — covering
   `node_modules`, Expo/EAS build output, `.env*`, and local tooling caches. (H15)
3. **Dev Supabase project created by the owner**, with credentials held outside the repository and
   a written secret-handling convention. Production must not exist or must be provably unreachable
   from any agent tooling. (`AGENT_TOOLING.md`)
4. **Owner sign-off on the four changed decisions** (D2, D7, D9, D11) and the roadmap resequencing.
   These change what gets built and in what order; they should not be inherited silently from a
   review.
5. **Deferred questions 1–3 answered** (P2, "AI freedom", iOS path).
6. **Agent-skill directories deduplicated** to a single canonical location. (M9)

**M1 scope itself is unchanged** from `ROADMAP.md` — Expo + Expo Router shell on three platforms,
dev Supabase with Authoring Data schema, design tokens, and the shared composer built to
`UX_CONTRACT.md` — with two additions this review makes explicit: **i18n scaffolding**
(externalized strings, locale-independent keys, UTC timestamps) and **Unicode/IME-safe composer
behaviour**, both verified as part of M1's evidence bar rather than deferred.
