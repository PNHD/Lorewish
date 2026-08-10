-- LW-M1-R3 — corrective least-privilege hardening for the M1 authoring tables.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- 20260810013158_m1_foundation_schema.sql granted an explicit, minimal DML set to
-- `authenticated` and deliberately granted nothing to `anon`, and its trailing
-- comment asserted that Supabase's current default does not auto-expose new
-- public-schema tables. That assertion was WRONG for this project. It is left in
-- place unedited as audit history; this migration is the correction.
--
-- Direct inspection of the live lorewish-dev database (ref sfarcofvqfeobtcizxyv)
-- after R2 — captured verbatim in handoff/LW-M1-R3/grants-before.txt — showed
-- every one of the five authoring tables carrying:
--
--   relacl = {postgres=arwdDxtm/postgres,
--             anon=arwdDxtm/postgres,
--             authenticated=arwdDxtm/postgres,
--             service_role=arwdDxtm/postgres}
--
-- i.e. anon and authenticated each held ALL SEVEN table privileges — SELECT,
-- INSERT, UPDATE, DELETE plus TRUNCATE, TRIGGER and REFERENCES — not the narrow
-- set the migration asked for. The source was pg_default_acl: this project still
-- carries the legacy "automatically expose new tables" default for the public
-- schema, so every CREATE TABLE was auto-granted ALL to the Data API roles before
-- the migration's own GRANT statements ever ran. The explicit GRANTs were not
-- ignored — they were simply a subset of what had already been handed out.
--
-- GRANTS AND RLS ARE SEPARATE LAYERS. R2's adversarial probes did pass: RLS
-- blocked every cross-user and unauthenticated ROW access that was tested, and
-- that result still stands. But RLS policies only constrain row-level
-- SELECT/INSERT/UPDATE/DELETE. TRUNCATE is a whole-table operation that no row
-- policy governs, and REFERENCES/TRIGGER are schema-level surface that RLS never
-- sees. Holding those privileges is not made harmless by RLS being correct.
--
-- This migration narrows object privileges to exactly the app's needs and stops
-- the same defaulting from silently re-arming on every future table.

-- ---------------------------------------------------------------------------
-- 1. Strip every inherited privilege from both client roles.
--
--    REVOKE ALL, not a targeted revoke of the unwanted verbs: the goal is a
--    known-empty starting point, so the grants below are the complete and only
--    description of what a client role can do. service_role is deliberately left
--    untouched — redesigning it is out of scope for this task, and it is never
--    used from application code.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles             from anon, authenticated;
revoke all on table public.stories              from anon, authenticated;
revoke all on table public.story_configurations from anon, authenticated;
revoke all on table public.worlds               from anon, authenticated;
revoke all on table public.characters           from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Re-grant the exact DML the application needs — and nothing else.
--
--    `anon` intentionally receives NOTHING. Every table here is private
--    authoring data; an unauthenticated client must have no object-level reach
--    into it at all, so that denial does not depend on a policy predicate
--    evaluating correctly.
--
--    profiles has no DELETE: profile rows are removed only by the
--    auth.users ON DELETE CASCADE, never by a client call. This mirrors the
--    absence of a delete policy on profiles in the foundation migration.
-- ---------------------------------------------------------------------------

grant select, insert, update         on public.profiles             to authenticated;
grant select, insert, update, delete on public.stories              to authenticated;
grant select, insert, update, delete on public.story_configurations to authenticated;
grant select, insert, update, delete on public.worlds               to authenticated;
grant select, insert, update, delete on public.characters           to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Make future exposure opt-in instead of automatic.
--
--    This is Supabase's own documented remedy for a project created before the
--    2026-04-28 "tables not exposed to the Data and GraphQL API automatically"
--    change: run ALTER DEFAULT PRIVILEGES for role `postgres` in schema `public`
--    to drop the inherited grants for the Data API roles. It is scoped to the
--    `postgres` role's own default ACL (defaclrole = postgres, confirmed present
--    in grants-before.txt Q9), which is the entry that applies to objects created
--    by migrations — `supabase db push` connects as postgres.
--
--    REVOKE ALL rather than the documented `select, insert, update, delete`:
--    the live default handed out arwdDxtm, so revoking only the four DML verbs
--    would leave TRUNCATE/TRIGGER/REFERENCES defaulting onto every new table.
--
--    Existing objects are unaffected by this statement — that is what step 1
--    above is for.
--
--    service_role's default is deliberately left in place (out of scope, see
--    above), as is the separate `supabase_admin` default ACL for this schema,
--    which this role cannot alter and which does not govern migration-created
--    objects.
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Close the matching hole on the shared trigger helper.
--
--    The foundation migration revoked EXECUTE on handle_new_user() from the
--    client roles but left set_updated_at() at Postgres's default of EXECUTE to
--    PUBLIC (confirmed live: proacl = {=X/postgres,...,anon=X/postgres,
--    authenticated=X/postgres,...}). Applying the same treatment for
--    consistency.
--
--    This does not disturb the six BEFORE UPDATE triggers that call it:
--    Postgres checks EXECUTE on a trigger function when the trigger is CREATED,
--    not on each firing, and those triggers already exist. Verified empirically
--    after applying — see handoff/LW-M1-R3/rls-test-results.txt, which confirms
--    an authenticated UPDATE still succeeds and still bumps updated_at.
-- ---------------------------------------------------------------------------

revoke execute on function public.set_updated_at() from public, anon, authenticated;
