# Current Work

**Task**: LW-M0-R2
**Status**: Independent M0 review complete. Verdict **PASS, conditional** on the M1 prerequisites
below. Awaiting product-owner sign-off on four changed decisions before M1 begins.

## Task Naming Convention

Task IDs use the **`LW-`** prefix (Lorewish). The previous session ran as `ADV-M0-R1` under an
earlier working name; that identifier is retained **only** where it states a historical fact about
who produced the baseline, since renaming it there would make a true statement false. All active
and future task IDs use `LW-`.

## Branch / HEAD

- Branch: `main`.
- HEAD: **no commits exist** — `git rev-parse HEAD` does not resolve. All files are untracked.
- No remote configured; nothing pushed.
- No commit was created by this task. The product owner reviews the handoff first.

## What This Task Did

Read all eleven M0 baseline documents in full and reviewed them independently, without presuming the
previous session's work correct. Corrected the defects found, and added three documents. **No
implementation of any kind** — no scaffolding, dependencies, Supabase project, migrations, Edge
Functions, paid AI calls, screens, payment, ads, deployment or store work.

Full findings: [docs/M0_R2_REVIEW.md](docs/M0_R2_REVIEW.md).
Handoff artifact: `handoff/LW-M0-R2/`.

## Files Changed

**Created (4)**

```
docs/M0_R2_REVIEW.md
docs/AGENT_TOOLING.md
docs/REFERENCE_PRODUCT_NOTES.md
handoff/LW-M0-R2/            (review handoff artifact)
```

**Modified (10)**

```
CURRENT_WORK.md
docs/PRODUCT_VISION.md
docs/USER_RESEARCH_SYNTHESIS.md
docs/CORE_LOOPS.md
docs/MVP_SPEC.md
docs/UX_CONTRACT.md
docs/DOMAIN_MODEL.md
docs/TECHNICAL_ARCHITECTURE.md
docs/ROADMAP.md
docs/DECISIONS.md
```

**Unchanged**: `docs/MOTION_GUIDELINES.md` — reviewed in full, no corrections needed.

**Deleted**: none.

## Headline Findings

**Blocking (both fixed)**

1. `P1`–`P10` were referenced 30+ times across nine documents and **defined nowhere**. Now defined
   in [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) §9, reconstructed from usage.
2. `P0/P1/P2` in the research synthesis collided with that namespace. Renamed `R0/R1/R2`.

**High (15 found — see the review document)**, most consequential:

- Alpha percentage thresholds acted as PASS/FAIL gates on zero telemetry and a cohort too small to
  support them. Replaced with a four-tier evidence model.
- Monetization sat behind two milestones it had no dependency on. Moved to M4.
- Cost architecture hard-coded "images are most expensive"; context assembly was unbounded.
- Chat canon promotion was specified as automatic, contradicting its own guarantee; chat threads
  had no branch scoping.
- Guest sessions plus a per-user allowance is an unmetered-inference hole.
- iOS cannot be built on the owner's Windows machine — M1's evidence bar was unreachable as written.
- No `.gitignore`, no moderation in MVP scope, no account-deletion path.

## Decisions Changed (owner sign-off required)

| # | Change |
|---|---|
| **D2** | Global product with a *seeded test cohort*, replacing "Vietnam/SEA first, global later". i18n scaffolding becomes an M1 requirement. |
| **D7** | Canon promotion from chat is **always** a player action; facts carry an origin; chat threads are branch-scoped. |
| **D9** | Decision unchanged; the "images cost most" rationale removed. Cost is measured per capability. |
| **D11** | Monetization moves M6 → **M4**, after the retention read but before publishing/discovery. Mechanism no longer pre-committed to rewarded ads. |
| **Roadmap** | M4 Monetization → M5 Publishing → M6 Discovery. M0–M3 and M7 unchanged. |

D16–D23 were added; no existing decision was reversed beyond the four above.

## Open Questions

1. **P2** — no usage anywhere; cannot be reconstructed. Supply it or retire it.
2. **"AI freedom" field** — define its concrete behaviour or cut it. Recommendation: cut.
3. **iOS build path** — Mac or cloud builds? **Most urgent**; blocks M1.
4. **M4 mechanism** — confirm acceptance of a data-driven choice over the pre-committed ads plan.
5. **Alpha cohort language** — English-comfortable testers, accept the confound, or ship a
   Vietnamese catalogue early?
6. **Agent-skill deduplication** — three copies exist; which location is canonical?
7. **Desktop send accelerator** — `Ctrl/Cmd+Enter`, or button-only?
8. **Advanced Setup field set** — still unvalidated with users (carried over from `ADV-M0-R1`).

## M1 Prerequisites (blockers 1–3)

1. iOS build path secured (Mac or cloud builds + Apple Developer membership).
2. `.gitignore` created **before** any dependency install or scaffold.
3. Dev Supabase project created by the owner; credentials outside the repository; production
   unreachable from agent tooling.
4. Owner sign-off on D2, D7, D9, D11 and the roadmap resequencing.
5. Open questions 1–3 answered.
6. Agent-skill directories deduplicated.

## Recommended Next Task

**Product-owner review of `handoff/LW-M0-R2/`**, specifically the four changed decisions and the
roadmap resequencing, followed by resolution of the three M1 blockers.

Then **LW-M1 — Foundation** per [ROADMAP.md](docs/ROADMAP.md): Expo/Expo Router shell on
Android/iOS/Web, dev Supabase with Authoring Data schema, design tokens, and the shared composer
built to [UX_CONTRACT.md](docs/UX_CONTRACT.md) — now including i18n scaffolding and Unicode/IME-safe
composer behaviour in its evidence bar.

Do not begin the next task until explicitly instructed.
