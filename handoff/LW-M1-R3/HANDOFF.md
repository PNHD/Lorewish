# LW-M1-R3 — Live Privilege Hardening + Repository/CI Closeout

**Verdict: M1 PASS**, with Android *runtime* evidence explicitly deferred.

| | |
|---|---|
| Baseline commit (verified) | `f97dd28afe80571baa7492adf165611bc3bc7c6c` |
| **FINAL IMPLEMENTATION_HEAD** | **`ec45f664d2541ea26d548b29832eb854a4b05c23`** |
| Head chain | `e4749e6` → `6820de9` → `3661d0a` → `e689178` → `ec45f66` |
| Closeout branch | `feature/lw-m1-foundation-closeout` (from `f97dd28`) |
| Supabase project | `lorewish-dev` / `sfarcofvqfeobtcizxyv` / `ap-southeast-1` |
| Corrective migration | `20260810065727_m1_least_privilege_hardening` (applied) |
| Draft PR | https://github.com/PNHD/Lorewish/pull/1 — **not merged** |
| Repository | `PNHD/Lorewish` — **PUBLIC** (owner decision), default branch `main` |

---

## 1. Baseline truth (verified, not taken from the R2 report)

| Claim | Verification | Result |
|---|---|---|
| HEAD is `f97dd28…` | `git rev-parse HEAD` | confirmed |
| local `main` is `b2a817e` (M0 only) | `git rev-parse main` | confirmed |
| repo was private | `gh repo view` | confirmed |
| only the feature branch existed remotely | `git ls-remote --heads origin` | confirmed |
| feature branch was the default branch | `gh repo view` | confirmed |
| linked project is `sfarcofvqfeobtcizxyv` | `supabase projects list` + `.temp/project-ref` | confirmed |

`doodle-world-studio` (`etmqrpoefkcahyvaimiw`) was never contacted. The linked ref was re-verified
immediately before `supabase db push`, as a hard gate.

## 2. The live grant bug — CONFIRMED

`grants-before.txt`, captured before any mutation. All five authoring tables:

```
relacl = {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres,
          authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}
```

`anon` and `authenticated` each held **all seven** table privileges — SELECT, INSERT, UPDATE, DELETE
**plus TRUNCATE, TRIGGER and REFERENCES**.

**Root cause** (`pg_default_acl`, Q9): the public schema carried a `postgres`-role default of
`arwdDxtm` for the Data API roles, so every `create table` was auto-granted `ALL` *before* the
foundation migration's own `grant` statements ran. Those grants were a subset of what had already
been handed out, so they changed nothing.

**Framing, stated precisely:**

- **Not a confirmed data breach.** No probe, in R2 or R3, ever returned another user's row or an
  anonymous read of real data. R2's RLS result stands.
- **It mattered anyway.** RLS constrains row-level DML; `TRUNCATE` is a whole-table operation no row
  policy governs, and `REFERENCES`/`TRIGGER` are surface RLS never sees.
- **Preserved, not erased.** `20260810013158_m1_foundation_schema.sql` was not edited; its incorrect
  comment remains as audit history.

## 3. Corrective migration

`20260810065727_m1_least_privilege_hardening.sql`, applied via `supabase db push --linked`:

1. `revoke all` from `anon, authenticated` on all five tables.
2. Re-grant exactly the required DML; `anon` receives nothing.
3. `alter default privileges for role postgres in schema public revoke all on tables/sequences from
   anon, authenticated` — Supabase's documented remedy for a pre-change project.
4. `revoke execute on function public.set_updated_at()` from `public, anon, authenticated`.

`service_role` deliberately untouched. **No Supabase mutation was made after this migration.**

## 4. Final grant matrix — verified live

`grants-after.txt`; machine-checked expected-vs-actual **10/10 PASS, 0 FAIL**. Re-confirmed
read-only at handoff time (`supabase-migrations.txt`).

| Table | `anon` | `authenticated` |
|---|---|---|
| `profiles` | *(zero privileges)* | SELECT, INSERT, UPDATE |
| `stories` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `story_configurations` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `worlds` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |
| `characters` | *(zero privileges)* | SELECT, INSERT, UPDATE, DELETE |

`anon` privilege count: **0**. TRUNCATE/TRIGGER/REFERENCES held by a client role: **none**.
Resulting ACL: `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwd/postgres}`
(`arw` for `profiles`). `profiles` has no DELETE by design — removal is via `auth.users` cascade.

## 5. Security regression — 30/30 PASS

`rls-test-results.txt`. Real HTTPS calls to the live Data API; two ephemeral accounts created and
deleted via the Auth Admin API; cleanup verified by re-query (**0** remaining test accounts).

**The bar was raised.** R2 accepted `200 []` as anonymous denial — that only proves a row policy
filtered rows, not that the role lacks a grant. This run requires an object-level denial:

```
GET /rest/v1/stories   (publishable key, no user JWT)
→ 401 {"code":"42501","message":"permission denied for table stories",
       "hint":"Grant the required privileges to the current role with:
               GRANT SELECT ON public.stories TO anon;"}
```

PostgREST naming the grant that *would* be needed is direct confirmation none exists.

| Class | Assertion | Result |
|---|---|---|
| A | anon SELECT ×5 tables, anon INSERT, anon bulk DELETE — object-permission denial | 7/7 |
| B/G | owner CRUD: create, read, update, child insert ×3, child update, child delete | 8/8 |
| C | B cannot read/update/delete A's Story, StoryConfiguration, World | 5/5 |
| D | ownership tamper both directions | 2/2 |
| E | B attaching World / Character / StoryConfiguration to A's Story | 3/3 |
| F | profiles allowed ops work; DELETE refused at object level | 4/4 |
| Z | A's data intact after every attack | 1/1 |

Two results worth calling out: the **`set_updated_at` trigger still fires** after its `EXECUTE` was
revoked (Postgres checks that at `CREATE TRIGGER` time, not per firing — asserted empirically via a
changed `updated_at`, not assumed); and **`DELETE` on `profiles` is refused at the object layer**,
the one place the privilege layer rather than RLS is the control.

**Advisors**: 0 security findings, 0 performance findings.

## 6. Future default-privilege policy — A *and* B, now covering functions

**Option A applied and verified.** The `postgres`/`public`/tables default is now
`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — both client roles removed; sequences
likewise. Not done via `supabase config push`, which pushes the entire scaffold `config.toml` and
would have set `enable_confirmations = false` and rewritten `site_url` on the live project.

**Automatic exposure is NOT fully disabled, and this package does not claim it is.** Remaining gaps:
a `supabase_admin`-owned default ACL a `postgres` connection cannot alter; the **function** default
ACL, still granting `EXECUTE` to `anon`/`authenticated`; and any table created outside a
`postgres`-role migration.

**Option B is the primary control, and the closeout correction made it object-kind complete:**

> Every Lorewish migration creating an application **table, function or sequence** MUST revoke
> inherited/default client grants and then add exact explicit grants in the same migration.

For **functions/RPCs** specifically — the gap that bites first in M2:

- `revoke execute on function public.<name>(<args>) from public, anon, authenticated;` — **all
  three**. Revoking only the named roles leaves the `PUBLIC` grant they both inherit.
- Re-grant only when the function is intentionally client-callable, to the narrowest role.
- Document the **intended caller role and authorization contract**; for `SECURITY DEFINER`, how it
  verifies ownership itself, since definer rights bypass RLS entirely. A `SECURITY DEFINER` function
  granted to `anon` is an anonymous, RLS-free entry point.
- Never assume the function default ACL is safe.

Recorded in `docs/DEV_ENVIRONMENT.md`, `docs/TECHNICAL_ARCHITECTURE.md` §4, `docs/AGENT_TOOLING.md`
rules 6–7. **The two existing helper functions were not modified** — live inspection confirms
`handle_new_user()` and `set_updated_at()` are already at `{postgres=X/postgres,service_role=X/postgres}`.

## 7. Repository normalization and PUBLIC visibility

- Local `main` (`b2a817e`, M0 baseline) pushed **unchanged** — not moved to a feature tip.
- Default branch changed to **`main`**.
- Neither existing feature branch deleted.
- `feature/lw-m1-foundation-closeout` created from the **actual reviewed R2 tip `f97dd28`**.
- **Draft** PR #1 → `main`, **not merged**.

### Actions quota exhaustion → owner-approved PUBLIC visibility

The private Actions quota hit **2,000 / 2,000 minutes**; every job of the `6820de9` run failed
before its first step with *"The job was not started because recent account payments have failed or
your spending limit needs to be increased."* Private repos meter minutes and macOS bills at 10×.

The owner explicitly authorized making the repository **PUBLIC** so development is unblocked, with
consequences understood: history and Actions logs become public, anyone may clone or fork, and
**going private later does not recall clones or existing forks**.

**Pre-public secret gate — PASSED.** `secret-audit-full-history.txt`: **223 blobs across 14 commits
and 7 refs**, 19 credential pattern classes, **0 real secrets**.

- One hit, adjudicated benign: `password: "account.errorWeakPassword"` — an entry in the
  Supabase-error-code → i18n-key map; the regex fired because the *key* ends in "password".
- No `.env` ever committed; `.env.example` tracked by design with **empty** values.
- **No build output ever committed**, so no `EXPO_PUBLIC_` value was ever inlined into a tracked
  artifact.
- The real publishable key appears in **no blob**; the only committed `sb_publishable_` string is
  the non-functional CI placeholder.
- No service-role key, access token, GitHub/Cloudflare/Expo token, DB password, connection string or
  private key anywhere in history.

The Supabase ref and URL remain visible by design — public identifiers, not secrets. With `anon` at
**zero** table privileges and RLS enforcing owner-only rows, they disclose nothing exploitable.
That property is exactly what this task established, and it is what makes public visibility safe.

> **An earlier audit run was discarded, not trusted:** it reported "CLEAN" while scanning **0**
> blobs, because the shell had changed directory out of the repository and every `git` command
> failed silently. A clean verdict from an empty scan is the exact false negative that must never
> gate a visibility change.

Verified: `visibility = PUBLIC`, `isPrivate = false`, `forkCount = 0`, default branch `main`.

### `REPOSITORY_VISIBILITY_REVIEW_REQUIRED`

The repository **stays public** after this task; reverting is an owner decision. Before reverting,
evaluate: whether public forks exist; whether Actions still depends on public-runner economics;
whether another CI path has replaced it.

## 8. CI — three corrections, all evidenced

See `ci-results.txt` for full data.

**(a) Documentation-only pushes no longer build.** `paths-ignore` (`docs/**`, `handoff/**`, `*.md`)
on `push` and `pull_request`. Verified two ways:

- *Replay* against real history: all 16 files of `f97dd28` — the docs-only R2 commit that burned
  ~37 minutes — match the list, so it would be skipped; `6716f64` (14 build-relevant files) and
  `5fd64d4` still build.
- *Live*: the two documentation-only commits at the end of this task (`e689178`, `ec45f66`) produced
  **no `push` run at all**, while every source/workflow commit did.

**Honest limitation:** the `pull_request` trigger still fires for those commits, because GitHub
evaluates `paths-ignore` for `pull_request` against the **entire PR diff**, not the newest commit,
and this PR's cumulative diff includes `ci.yml` and the migration. That is expected GitHub
behaviour, not a misconfiguration. An earlier revision of `CURRENT_WORK.md` claimed such a commit
"triggers no workflow run at all"; that overclaim was corrected in commit `ec45f66` rather than
quietly dropped. What Step 10 asked for still holds: a docs-only push to a branch **without** an
open PR — the `f97dd28` case — is skipped entirely.

**(b) One commit no longer runs two native matrices.** The key was
`${{ github.workflow }}-${{ github.ref }}`, which differs between `push`
(`refs/heads/…`) and `pull_request` (`refs/pull/1/merge`), so both ran.

On `e4749e6` this was not merely wasteful — the two matrices contended and each pushed the other
past a timeout, in *opposite* jobs:

| Job | push `31364937721` | PR `31364972116` | solo baseline |
|---|---|---|---|
| iOS | **success 25m21s** | cancelled at 30m45s (30m cap) | ~25m |
| Android | cancelled at 45m13s (45m cap) | **success 44m40s** | ~35m |

The two Android jobs finished five seconds apart. Every job did pass in one run or the other, so the
commit was sound and both timeouts were artefacts of duplication.

Key is now `${{ github.workflow }}-${{ github.head_ref || github.ref_name }}`.

**(c) Fork PRs cannot spend the native budget.** Workflow-level `permissions: contents: read`; both
native jobs gated on
`github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`.
A fork PR gets the cheap web/JS job only. **Owner work is unaffected** — every push to
`main`/`feature/**` and every same-repo PR satisfies the condition, so this withholds cost, never
correctness. The workflow uses `pull_request`, **never `pull_request_target`**, and says so in-file
so a later change does not "fix" the secrets question the dangerous way; it needs no secrets at all.

### Authoritative public CI evidence

| Run | Event | Result |
|---|---|---|
| `31369932367` | `push` | **cancelled** by the shared concurrency group |
| `31369936191` | `pull_request` | **success** — Web 52s, Android **19m20s**, iOS **27m54s** |

All five required properties hold: public runners **start** despite the exhausted private quota;
duplicate events yield **one** matrix, not two (the cancellation is expected PASS behaviour); Web,
Android and iOS Simulator all pass. Android at **19m20s** here versus **44m40s** under contention
independently confirms the contention diagnosis.

**Recommendation (not applied):** iOS ran **27m54s** against `timeout-minutes: 30` — only ~2 minutes
of headroom. Raising that cap was deliberately kept out of the bounded corrections and is now
recommended rather than optional. Android is comfortable (19m20s against 45m).

## 9. Native evidence status

- **iOS — ACCEPTED**, and now stronger than at R2: the public run compiled, installed, launched,
  confirmed the process alive via `simctl spawn launchctl list`, and captured a screenshot. EAS was
  **not** re-run. **No physical-iPhone validation is claimed.**
- **Android — `ANDROID_RUNTIME_EVIDENCE_DEFERRED`.** The APK builds, is signed, and embeds the JS
  bundle — now re-proven green on public runners. The **runtime was never observed** on a device or
  emulator. **Not claimed as PASS.** **Required closeout point: Android runtime evidence must be
  obtained before any external native beta or Play Store release testing.** Does not block M1 under
  the web-first strategy.

## 10. Evidence-generation property (the R2 process defect, fixed)

R2's `git-log.txt` was generated *before* its final commits, so it named an older HEAD than the
report did. For R3, `IMPLEMENTATION_HEAD` moved four times — each move forced by evidence the
previous head produced — and **every file here was regenerated from the final head, `ec45f66`,
after it existed and was pushed**.

The chain terminates because the final two commits are documentation-only: the `push` trigger skips
them, and the claim recorded about them does not depend on any run's outcome, so recording it cannot
invalidate it.

`handoff/LW-M1-R3/` is deliberately **untracked** and `Lorewish_*_handoff.zip` is gitignored, so
packaging cannot move the head its own evidence describes. The working tree is therefore *not* clean
at handoff time — by design — and `git-status.txt` records exactly that.

## 11. Scope

**No M2 work.** The live public schema contains exactly the five M1 authoring tables
(`grants-after.txt` V15), and `src/` contains no M2 concept. No `PlayerRun`, `StoryState`, runtime
scenes, branches, `CanonFact`, character memory, AI gateway, LLM provider, image generation, roll
mechanics, credits, ads, payments, publishing, social or recommendation code or schema exists.

## 12. Files in this package

| File | What it is |
|---|---|
| `HANDOFF.md` | this document |
| `grants-before.txt` | 13 read-only forensic queries, before any mutation |
| `grants-after.txt` | 15 verification queries incl. machine-checked pass gates |
| `rls-test-results.txt` | 30 adversarial probes against the live Data API |
| `supabase-advisors.txt` | security + performance advisors |
| `supabase-migrations.txt` | migration state + final read-only grant re-confirmation |
| `secret-audit-full-history.txt` | **pre-public gate** — 223 blobs, all refs, 19 pattern classes |
| `git-status.txt` | working tree at handoff time |
| `git-log.txt` | history + head chain, generated after the final head |
| `git-branches.txt` | branches, visibility, default branch, PR |
| `ci-results.txt` | path-filter replay, duplicate-run analysis, public run results |
| `files-changed.txt` | `f97dd28..ec45f66` stat and name-status |
| `git-diff.patch` | full diff for the same range |
| `test-results.txt` | typecheck, lint, `diff --check`, secret scan |

## 13. Recommended next task

**LW-M2-R1 — Real Interactive Story Engine Vertical Slice.** Not started here.

Carry into it: every new table, **function** and sequence must revoke inherited grants and add exact
explicit grants in the same migration (§6). The first M2 RPC is the exact case the function rule
exists for.
