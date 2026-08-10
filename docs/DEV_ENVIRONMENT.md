# Dev Environment — Supabase (`lorewish-dev`)

Status: LW-M1-R2. Records configuration for the dev Supabase project that is **not**
represented as a SQL migration — either because it is Auth/dashboard-only configuration, or
because it is a deliberate, documented decision about what this task did *not* automate.

## Project identity

- Name: `lorewish-dev`
- Project ref: `sfarcofvqfeobtcizxyv`
- Project URL: `https://sfarcofvqfeobtcizxyv.supabase.co`
- Region: `ap-southeast-1`
- Organization: `dbodjqmarksspvyknnlv`
- This is a **dev-only** project. Never connect Lorewish application code to `doodle-world-studio`
  (a different project in the same organization) or to any other project in this organization.

## Auth — Site URL and Redirect URLs (manual dashboard step, not automated)

`supabase/config.toml`'s `[auth]` section is **not** pushed to this project via
`supabase config push` in this task. `config push` overwrites the *entire* remote project
configuration (API, DB, Auth, Storage settings — not just the `[auth]` block) with whatever is in
the local `config.toml`, which is CLI-scaffold-default content this task did not fully audit
against the project's actual current settings. Given the live project already existed before this
task and its current full configuration was not independently verified field-by-field, pushing the
scaffold file risked silently changing settings unrelated to what this task needed (e.g.
`enable_confirmations = false` in the scaffolded `[auth.email]` block — the *local dev* CLI
default — would have **turned off email confirmation on the live dev project**, which directly
contradicts this task's instruction to preserve the secure default). Documenting the two fields
that actually need to be set, for the project owner to apply once in the dashboard, is the safer
path.

**Required values** (Supabase dashboard → this project → Authentication → URL Configuration):

| Field | Value |
|---|---|
| Site URL | `https://lorewish.pages.dev` |
| Additional Redirect URLs | `https://lorewish.pages.dev/account`, `http://localhost:8081/account`, `http://localhost:3000/account` |

The three redirect URLs cover: the live deployment's account route (email-confirmation links land
here), the `expo start --web` dev server (port 8081, per `.claude/launch.json`'s `lorewish-dev`
profile), and the static-export local preview server (port 3000, the `lorewish-web` profile).

**Email confirmation**: left at whatever the project's own default already is (Supabase's current
project-creation default is confirmations **on**). No change was made by this task. Verified
indirectly: a real sign-up attempt against this project's Auth API during LW-M1-R2 testing
returned `429 over_email_send_rate_limit` on a syntactically valid signup — meaning a confirmation
email send was actually attempted, which would not happen if confirmations were off. If a future
task needs confirmations off for a specific, scoped dev-testing reason, that decision must be made
and recorded explicitly here, not defaulted into silently by pushing a scaffold config file.

## Data API object privileges — the non-negotiable migration rule *(added by LW-M1-R3)*

**Every Lorewish migration that creates an application table MUST revoke inherited/default client
grants and then add the exact explicit grants it needs, in the same migration.**

This is not a style preference. It is the direct consequence of a real defect found in review.

### What went wrong in LW-M1-R2

`20260810013158_m1_foundation_schema.sql` ends with an explicit, minimal `grant` block and a comment
asserting that Supabase's current default does not auto-expose new public-schema tables, so `anon`
would receive nothing. The comment was wrong for this project. Live inspection of the database after
R2 (`handoff/LW-M1-R3/grants-before.txt`) found every one of the five authoring tables carrying:

```
relacl = {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
          authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

`anon` and `authenticated` each held **all seven** table privileges — SELECT, INSERT, UPDATE, DELETE
**plus TRUNCATE, TRIGGER and REFERENCES**. The cause was `pg_default_acl`: this project predates /
did not have the "tables are not exposed to the Data API automatically" behaviour enabled, so every
`create table` was auto-granted `ALL` to the Data API roles *before* the migration's own `grant`
statements ran. The explicit grants were never ignored — they were simply a subset of what had
already been handed out, so they changed nothing.

### Grants and RLS are separate layers

R2's adversarial RLS probes genuinely passed, and that result still stands: no cross-user or
anonymous **row** access ever succeeded. But RLS policies only constrain row-level
SELECT/INSERT/UPDATE/DELETE. **`TRUNCATE` is a whole-table operation that no row policy governs**,
and `REFERENCES`/`TRIGGER` are schema-level surface RLS never sees. Correct RLS does not make an
unnecessary object privilege harmless. Never reason about one layer as if it covered the other.

### What LW-M1-R3 changed

`20260810065727_m1_least_privilege_hardening.sql` revoked everything from both client roles on the
five tables and re-granted only the exact DML (verified live in
`handoff/LW-M1-R3/grants-after.txt`):

| Table | `anon` | `authenticated` |
|---|---|---|
| `profiles` | *(none)* | SELECT, INSERT, UPDATE |
| `stories` | *(none)* | SELECT, INSERT, UPDATE, DELETE |
| `story_configurations` | *(none)* | SELECT, INSERT, UPDATE, DELETE |
| `worlds` | *(none)* | SELECT, INSERT, UPDATE, DELETE |
| `characters` | *(none)* | SELECT, INSERT, UPDATE, DELETE |

`profiles` has no DELETE by design — profile rows are removed only by the `auth.users`
`ON DELETE CASCADE`, never by a client call. `service_role` was deliberately left untouched.

### Future exposure is now opt-in — but only partly, and that is why the rule stands

The same migration also applied Supabase's own documented remedy for an existing project
([changelog 45329](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)),
scoped to the `postgres` role's default ACL in `public`:

```sql
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
```

`REVOKE ALL`, not the four DML verbs the changelog names, because the live default handed out
`arwdDxtm` — revoking only DML would have left TRUNCATE/TRIGGER/REFERENCES defaulting onto every new
table. Verified afterwards: the `postgres`/`public`/tables default is now
`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — `anon` and `authenticated` are gone.

This was **not** done via `supabase config push` (`[api] auto_expose_new_tables`). That command
pushes the *entire* local `config.toml`, which is CLI-scaffold content — pushing it would among other
things set `enable_confirmations = false` and rewrite `site_url` to `127.0.0.1:3000` on the live
project. Same reasoning as the Auth section above.

**Three gaps remain, and none of them are closed by the statement above:**

1. A separate `supabase_admin`-owned default ACL for `public` still grants `arwdDxtm` on tables to
   `anon`/`authenticated`. This role's defaults cannot be altered from a `postgres` connection. It
   does not govern migration-created objects (`supabase db push` connects as `postgres`), but it
   does mean "automatic exposure is disabled" is **not** true of this database in general.
2. The **function** default ACL still grants `EXECUTE` to `anon`/`authenticated` on new
   `public` functions. Any future RPC helper is callable by an anonymous client the moment it is
   created unless the migration revokes it.
3. A table created by any path other than a `postgres`-role migration — the dashboard SQL editor
   running as another role, a restore, a platform-side change — is not covered.

So: **the migration rule is the control, and the default-privilege change is defence in depth.**
Do not invert that. Do not write a migration that relies on the default being safe.

### The rule, concretely

The rule is about **every object kind whose default ACL can hand privileges to a client role** —
tables, functions and sequences — not tables alone. Gap 2 above is not hypothetical: the function
default still grants `EXECUTE` to `anon` and `authenticated`, so the *first* M2 RPC is anonymously
callable the moment it is created unless its migration says otherwise.

**Tables.** Every migration creating a table in `public` must contain, for that table:

```sql
revoke all on table public.<name> from anon, authenticated;
grant <only the verbs the app actually calls> on public.<name> to authenticated;
-- and, if and only if the data is genuinely public-readable:
-- grant select on public.<name> to anon;
```

Plus: enable RLS and write the policies. Never grant TRUNCATE, TRIGGER or REFERENCES to a client
role.

**Functions / RPCs.** Every migration creating a function in `public` must **start** from no client
access and add it back only deliberately:

```sql
-- Always, immediately after create function — never omitted, never conditional:
revoke execute on function public.<name>(<argtypes>) from public, anon, authenticated;

-- Then, ONLY if this function is intentionally client-callable, re-grant to the
-- narrowest role that must call it:
-- grant execute on function public.<name>(<argtypes>) to authenticated;
```

`from public, anon, authenticated` — all three. `PUBLIC` is the pseudo-role Postgres grants `EXECUTE`
to by default on every new function; revoking only `anon`/`authenticated` leaves the `PUBLIC` grant
in place, and both roles still inherit it. The foundation migration's treatment of
`handle_new_user()` is the correct pattern; `set_updated_at()` was the miss LW-M1-R3 closed.

Every function that keeps a client `EXECUTE` grant must carry a comment stating its
**authorization contract**:

- which role is intended to call it (`authenticated`, or `service_role` / server-side only),
- what it does with `auth.uid()` — a `SECURITY DEFINER` function runs with the definer's rights and
  **bypasses RLS entirely**, so it must verify ownership itself rather than trusting any argument,
- `set search_path = ''` with every reference schema-qualified, per Supabase's `SECURITY DEFINER`
  guidance.

A `SECURITY DEFINER` function granted to `anon` is a full RLS bypass reachable without a login.
Treat any such grant as requiring an explicit, written justification, not a default.

**Sequences.** If a table ever uses `serial`/`identity` (M1 uses `gen_random_uuid()` throughout, so
none exist today), the same applies — a client role needs `USAGE` on the sequence to insert:

```sql
revoke all on sequence public.<name> from anon, authenticated;
-- only if a client role genuinely inserts into the owning table:
-- grant usage, select on sequence public.<name> to authenticated;
```

**Never assume the default ACL is safe for any of these three.** The R2 defect was exactly that
assumption applied to tables; the function default is still live and still broad.

**Verify against the live database, never against the migration text.** The whole R2 defect was a
migration that read correctly and a database that was not. The checks are:

```sql
-- tables
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon','authenticated')
group by grantee, table_name order by grantee, table_name;

-- functions: proacl must not name anon/authenticated, and must not be null
-- (null = Postgres default = EXECUTE to PUBLIC), unless deliberately granted
select p.proname, p.prosecdef as security_definer,
       coalesce(p.proacl::text, '(null = default: EXECUTE to PUBLIC)') as proacl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;

-- sequences
select sequence_name, grantee, privilege_type
from information_schema.usage_privileges
where object_schema = 'public' and grantee in ('anon','authenticated');
```

Run them with `supabase db query --linked "<sql>"` (Management API; needs no database password and no
local Docker). `anon` must not appear at all for private tables, and a `proacl` of `(null)` on a new
function means the revoke was forgotten.

## Auth — providers

Email/password only. Do not enable Google/Apple/Facebook/Discord/other OAuth providers, and do not
enable anonymous sign-ins (`enable_anonymous_sign_ins`) — both are explicitly out of scope for
LW-M1-R2 (see `CURRENT_WORK.md` — Guest Behavior).

## Data API keys

Client code uses the **publishable key** (`sb_publishable_...`), read from
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). The service-role/secret key is never
used in application code — only from ephemeral local tooling (e.g. one-off adversarial RLS test
scripts run from a developer machine to create/delete disposable test accounts), and is never
written to a tracked file.

## Local Supabase CLI

`supabase/config.toml` exists for local project identity (`supabase init` output) and is committed.
`supabase link --project-ref sfarcofvqfeobtcizxyv` links a working copy to this project; re-run it
after a fresh clone. No local Supabase stack (`supabase start`, Docker) was used for this task —
Docker Desktop was not running in this environment, so migrations were authored as SQL files and
applied directly to the linked remote dev project with `supabase db push`, then verified with
`supabase migration list` and `supabase db advisors --linked`.
