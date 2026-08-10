-- LW-M1-R2 — M1 foundation schema: authoring data only.
--
-- Scope: profiles, stories, story_configurations, worlds, characters.
-- Explicitly NOT in this migration (later milestones): player_runs, story_states,
-- materialized runtime scenes, branch_history, canon_facts, generation_proposals,
-- AI audit logs, credit ledger, payments, social graph, comments, followers,
-- creator analytics.
--
-- Every table below has RLS enabled with an owner-only policy set. Ownership is
-- always resolved against auth.uid() (never a client-supplied column) and, for
-- child tables of Story, via the parent Story's owner_user_id rather than a
-- duplicated owner column.

-- ---------------------------------------------------------------------------
-- Shared helper: updated_at maintenance trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per persistent authenticated user, keyed by auth.users.id.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  -- BCP-47-shaped (e.g. "en", "vi", "en-US") rather than an enum of the two
  -- languages the product ships today, so adding a UI locale later is a data
  -- change, not a schema migration.
  preferred_ui_locale text not null default 'en'
    check (preferred_ui_locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Persistent authenticated-user profile, 1:1 with auth.users. Not created for guest/preview usage.';

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: profile deletion happens only via auth.users cascade.

-- Minimal, deterministic auth.users trigger: create a profile row the moment a
-- persistent account is created. security definer is required to insert into
-- public.profiles from a trigger firing on auth.users (a schema the calling
-- role does not otherwise have insert rights into); search_path is pinned
-- empty and every reference is schema-qualified to avoid search-path
-- hijacking, per Supabase's SECURITY DEFINER guidance.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, preferred_ui_locale)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_ui_locale', ''), 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- stories — private authoring unit, owned by exactly one user.
-- ---------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  premise text check (char_length(premise) <= 4000),
  -- Content language of the story's prose — independent of the author's UI
  -- locale (a Vietnamese-UI user can author an English-content story). Free
  -- text validated by shape, not an enum, so a third shipped language is a
  -- data change.
  content_language text not null
    check (content_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  -- Locale-independent slug, not an enum, so the genre taxonomy can grow
  -- (PRODUCT_VISION.md §6 / UX_CONTRACT.md §10) without a schema migration.
  genre text not null check (genre ~ '^[a-z][a-z0-9_]{1,49}$'),
  -- MVP ships two story modes (Narrative, Adventure); RPG is a reserved,
  -- not-yet-built third mode (PRODUCT_VISION.md P6, D6). A check constraint
  -- (not a Postgres enum type) so adding "rpg" is an ALTER TABLE, not a type
  -- migration touching every dependent column.
  story_mode text not null default 'narrative'
    check (story_mode in ('narrative', 'adventure')),
  -- M1: visibility is effectively private. The single allowed value is
  -- intentional scope (no public-publishing feature exists yet), expandable
  -- by a future migration widening this check constraint.
  visibility text not null default 'private'
    check (visibility in ('private')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stories is
  'Private authoring unit owned by one user. M1: visibility is always private; no public-publishing path exists yet.';

create index stories_owner_user_id_idx on public.stories (owner_user_id);

alter table public.stories enable row level security;

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

create policy "stories_select_own"
  on public.stories for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy "stories_insert_own"
  on public.stories for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy "stories_update_own"
  on public.stories for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy "stories_delete_own"
  on public.stories for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

-- ---------------------------------------------------------------------------
-- story_configurations — the Advanced Setup field set, 1:1 with a Story.
-- Ownership is verified via the parent Story (no duplicated owner_user_id).
-- ---------------------------------------------------------------------------

create table public.story_configurations (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null unique references public.stories (id) on delete cascade,
  world_setting text check (char_length(world_setting) <= 4000),
  player_role text check (char_length(player_role) <= 1000),
  starting_situation text check (char_length(starting_situation) <= 4000),
  tone text check (tone in ('light', 'balanced', 'dark')),
  narrative_pov text check (narrative_pov in ('first_person', 'second_person', 'third_person')),
  -- Distinct from story_mode above: story_mode is the player-facing MVP
  -- toggle (Narrative/Adventure); randomness_mode is the generation-config
  -- knob it drives. Kept as its own field per M1-R2 scope rather than
  -- inferred implicitly, so a story_mode/randomness_mode divergence is
  -- representable if a future mode needs it.
  randomness_mode text not null default 'off'
    check (randomness_mode in ('off', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.story_configurations is
  'Advanced Setup field set for a Story (world/setting, player role, starting situation, tone, POV, randomness). Ownership via parent Story.';

alter table public.story_configurations enable row level security;

create trigger story_configurations_set_updated_at
  before update on public.story_configurations
  for each row execute function public.set_updated_at();

create policy "story_configurations_select_via_story"
  on public.story_configurations for select
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_configurations.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "story_configurations_insert_via_story"
  on public.story_configurations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.stories s
      where s.id = story_configurations.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "story_configurations_update_via_story"
  on public.story_configurations for update
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_configurations.story_id
        and s.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = story_configurations.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "story_configurations_delete_via_story"
  on public.story_configurations for delete
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_configurations.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- worlds — world/setting as a first-class entity, scoped to one Story.
-- Not a reusable-world marketplace (deliberately out of M1 scope).
-- ---------------------------------------------------------------------------

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.worlds is
  'World/setting entity scoped to one Story. Not shared or reusable across stories in M1.';

create index worlds_story_id_idx on public.worlds (story_id);

alter table public.worlds enable row level security;

create trigger worlds_set_updated_at
  before update on public.worlds
  for each row execute function public.set_updated_at();

create policy "worlds_select_via_story"
  on public.worlds for select
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = worlds.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "worlds_insert_via_story"
  on public.worlds for insert
  to authenticated
  with check (
    exists (
      select 1 from public.stories s
      where s.id = worlds.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "worlds_update_via_story"
  on public.worlds for update
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = worlds.story_id
        and s.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = worlds.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "worlds_delete_via_story"
  on public.worlds for delete
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = worlds.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- characters — canonical character identity foundation, scoped to one Story.
-- No M3 memory/relationship runtime (CharacterRelationship, CanonFact) here.
-- ---------------------------------------------------------------------------

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  aliases text[] not null default '{}',
  description text check (char_length(description) <= 2000),
  -- Free-text relationship/reference to the player role (e.g. "mentor",
  -- "rival" — DOMAIN_MODEL.md §1 P4 example), not an enum: relationship
  -- framing is author prose, not a fixed taxonomy.
  story_relationship text check (char_length(story_relationship) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.characters is
  'Canonical character identity foundation, scoped to one Story. Run-scoped CharacterRelationship/forms-of-address (NARRATIVE_QUALITY_CONTRACT.md §C) are M2/M3 scope, not modeled here.';

create index characters_story_id_idx on public.characters (story_id);

alter table public.characters enable row level security;

create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

create policy "characters_select_via_story"
  on public.characters for select
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = characters.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "characters_insert_via_story"
  on public.characters for insert
  to authenticated
  with check (
    exists (
      select 1 from public.stories s
      where s.id = characters.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "characters_update_via_story"
  on public.characters for update
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = characters.story_id
        and s.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.stories s
      where s.id = characters.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

create policy "characters_delete_via_story"
  on public.characters for delete
  to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = characters.story_id
        and s.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Explicit Data API grants. Supabase's current default does NOT auto-expose
-- newly created public-schema tables to anon/authenticated (config.toml
-- auto_expose_new_tables is unset), so each role's access is granted here
-- deliberately rather than relying on a legacy default. `anon` receives no
-- grant on any of these tables — every table here is private authoring data;
-- an unauthenticated client must not be able to read or write any of it, and
-- RLS has no effect on a role with no grant on the table at all.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.stories to authenticated;
grant select, insert, update, delete on public.story_configurations to authenticated;
grant select, insert, update, delete on public.worlds to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
