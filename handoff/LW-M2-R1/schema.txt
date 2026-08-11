-- LW-M2-R1 — Real Interactive Story Engine runtime schema.
--
-- Scope: player_runs, run_branches, scenes, turns, canon_facts, usage_counters.
-- Explicitly NOT in this migration: character_relationships, chat_threads,
-- generated_assets, credit_ledger, moderation audit tables beyond what a turn
-- itself records — all later milestones (M3+/M4).
--
-- ARCHITECTURE THIS SCHEMA ENFORCES
-- ----------------------------------
-- Per TECHNICAL_ARCHITECTURE.md §4 ("Runtime API Boundary") and AGENT_TOOLING.md
-- standing rule 6: the client never gets a direct mutation path onto Scene,
-- CanonFact, Turn-success or Branch state. `authenticated` receives SELECT only
-- on every table below (RLS-scoped to the caller's own player_runs). All writes
-- happen through four SECURITY DEFINER functions (lw_precheck_and_start_turn,
-- lw_commit_turn, lw_fail_turn, lw_replay_from_scene) which independently
-- verify auth.uid() ownership on every call — SECURITY DEFINER bypasses RLS
-- entirely, so RLS on these tables is defence in depth for reads, not the
-- control for writes. This mirrors the LW-M1-R3 lesson: grants and RLS are
-- separate layers, and neither is assumed safe by default.
--
-- BRANCH-SAFE SCENE ORDERING
-- --------------------------
-- Per the task brief: "Do not use one global monotonically increasing sequence
-- as the only branch identity." Scenes are ordered by (run_branch_id,
-- seq_in_branch), branch-local and starting at 0. A branch created by "Replay
-- from here" does NOT copy the scenes it forked from — it stores
-- fork_scene_id (a pointer to the scene on the PARENT branch it forked from)
-- and begins its own seq_in_branch at 0 for whatever it plays next. The full
-- playable history of a branch is therefore the parent chain's scenes up to
-- (and including) each ancestor's fork point, followed by this branch's own
-- scenes — resolved by the recursive helper lw_branch_scene_ids() below, never
-- by a single global counter.
--
-- CANON ISOLATION ACROSS BRANCHES
-- --------------------------------
-- canon_facts.scope is 'run' (visible from every branch of the PlayerRun) or
-- 'branch' (visible only where lw_branch_scene_ids() for the *target* branch
-- includes the fact's source_scene_id). Because that helper never includes a
-- sibling branch's scenes, or a parent branch's scenes *after* the fork point,
-- a fact recorded on one branch cannot leak into a sibling or into the parent
-- branch's continued timeline — isolation falls out of the scene-history
-- resolution rather than needing a second, separately-maintained rule.

-- ---------------------------------------------------------------------------
-- player_runs — one player's instance of playing a Story (DOMAIN_MODEL §2).
-- ---------------------------------------------------------------------------

create table public.player_runs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  -- Nullable only for the instant between run creation and root-branch
  -- creation inside lw_precheck_and_start_turn's bootstrap path — both writes
  -- happen in the same transaction, so no committed row is ever seen with a
  -- null pointer.
  active_branch_id uuid,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.player_runs is
  'One player''s playthrough of a Story. content_language is read via story_id, never duplicated here (DOMAIN_MODEL.md §8) — a run does not have its own language independent of the story it is playing.';

create index player_runs_owner_user_id_idx on public.player_runs (owner_user_id);
create index player_runs_story_id_idx on public.player_runs (story_id);

alter table public.player_runs enable row level security;

create trigger player_runs_set_updated_at
  before update on public.player_runs
  for each row execute function public.set_updated_at();

create policy "player_runs_select_own"
  on public.player_runs for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

-- No insert/update/delete policy for any client role: every write goes
-- through a SECURITY DEFINER function below. A policy-less table still denies
-- all DML for a role with no matching policy, but the object grant (bottom of
-- file) is the actual control per the LW-M1-R3 rule — RLS is not relied on
-- alone to prevent client writes here.

-- ---------------------------------------------------------------------------
-- run_branches — a player-timeline branch within one PlayerRun.
-- "Replay from here" (UX_CONTRACT.md §9, CONTINUOUS_PLAY_CONTRACT.md §6A)
-- creates a row here; it never copies scenes.
-- ---------------------------------------------------------------------------

create table public.run_branches (
  id uuid primary key default gen_random_uuid(),
  player_run_id uuid not null references public.player_runs (id) on delete cascade,
  parent_branch_id uuid references public.run_branches (id) on delete cascade,
  -- The scene on parent_branch_id this branch forked from. Null only for the
  -- root branch (parent_branch_id is also null there).
  fork_scene_id uuid,
  -- Per-run branch ordering (0 = root), assigned inside the SECURITY DEFINER
  -- function under a row lock on the parent player_run — never a global
  -- sequence, so it stays meaningful ("branch #2 of this run") without
  -- colliding across runs.
  branch_seq integer not null,
  created_at timestamptz not null default now(),
  check ((parent_branch_id is null) = (fork_scene_id is null)),
  unique (player_run_id, branch_seq)
);

comment on table public.run_branches is
  'A player-timeline branch (DOMAIN_MODEL.md §2 Branch/BranchHistory). Forking never copies scenes — fork_scene_id points at the parent branch''s scene it continues from; see lw_branch_scene_ids().';

create index run_branches_player_run_id_idx on public.run_branches (player_run_id);
create index run_branches_parent_branch_id_idx on public.run_branches (parent_branch_id);

alter table public.run_branches enable row level security;

create policy "run_branches_select_own"
  on public.run_branches for select
  to authenticated
  using (
    exists (
      select 1 from public.player_runs pr
      where pr.id = run_branches.player_run_id
        and pr.owner_user_id = (select auth.uid())
    )
  );

-- player_runs.active_branch_id -> run_branches.id is added after this table
-- exists, since the two tables reference each other.
alter table public.player_runs
  add constraint player_runs_active_branch_id_fkey
  foreign key (active_branch_id) references public.run_branches (id);

-- ---------------------------------------------------------------------------
-- scenes — durable narrative truth after a turn succeeds (DOMAIN_MODEL §2).
-- ---------------------------------------------------------------------------

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  run_branch_id uuid not null references public.run_branches (id) on delete cascade,
  -- Branch-local ordering — see the file header. Never read across branches
  -- without lw_branch_scene_ids().
  seq_in_branch integer not null,
  -- The scene this one causally follows: either the previous scene on the
  -- same branch, or (for a branch's first own scene) the fork_scene on the
  -- parent branch. Purely an audit/debug trail — lw_branch_scene_ids() is the
  -- authoritative history resolver, not this pointer.
  parent_scene_id uuid references public.scenes (id),
  boundary_kind text not null default 'none'
    check (boundary_kind in ('none', 'checkpoint', 'ending')),
  narrative text not null check (char_length(narrative) > 0),
  -- Array of {speaker: text, line: text} — DIALOGUE channel, UX_CONTRACT §1A.
  dialogue jsonb not null default '[]'::jsonb,
  -- Array of short strings for the SYSTEM/STATE CHANGE channel — never prose,
  -- never inline in `narrative` (UX_CONTRACT §1A hard rule).
  state_change_summary jsonb not null default '[]'::jsonb,
  -- Light Roll outcome, if any: {rolled: bool, band: 'success'|'partial'|'fail', ...}.
  structured_outcome jsonb not null default '{}'::jsonb,
  -- 2-4 predefined next actions: [{id: text, label: text}]. Always paired
  -- with the always-available composer on the client (UX_CONTRACT §7) — an
  -- empty array here is valid and does not create a dead end.
  next_choices jsonb not null default '[]'::jsonb,
  -- Provenance: which turn produced this scene. Nullable so a future authored
  -- seed Scene (CORE_LOOPS.md §4) can be represented without a synthetic turn.
  generation_turn_id uuid,
  created_at timestamptz not null default now(),
  unique (run_branch_id, seq_in_branch)
);

comment on table public.scenes is
  'Materialized narrative truth (DOMAIN_MODEL.md §2). boundary_kind is set only from a validated structured generation result or an authored seed ending — never inferred from output shape (CONTINUOUS_PLAY_CONTRACT.md §2).';

create index scenes_run_branch_id_idx on public.scenes (run_branch_id);
create index scenes_generation_turn_id_idx on public.scenes (generation_turn_id);

alter table public.scenes enable row level security;

create policy "scenes_select_own"
  on public.scenes for select
  to authenticated
  using (
    exists (
      select 1 from public.run_branches rb
      join public.player_runs pr on pr.id = rb.player_run_id
      where rb.id = scenes.run_branch_id
        and pr.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- turns — one player intent and its generation lifecycle (DOMAIN_MODEL §11).
-- id IS the client-generated turn_id: the client mints it once at intent and
-- resubmits the same value on every retry, which is what makes the primary
-- key itself the idempotency guarantee (CONTINUOUS_PLAY_CONTRACT.md §7).
-- ---------------------------------------------------------------------------

create table public.turns (
  id uuid primary key,
  player_run_id uuid not null references public.player_runs (id) on delete cascade,
  run_branch_id uuid not null references public.run_branches (id) on delete cascade,
  -- The scene current at INTENT_ACCEPTED time. Null only for a run's
  -- bootstrap 'start' turn, which has no prior scene to point at.
  source_scene_id uuid references public.scenes (id),
  action_type text not null check (action_type in ('start', 'choice', 'custom_action')),
  raw_player_action text check (char_length(raw_player_action) <= 4000),
  selected_choice_id text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'committed', 'failed')),
  -- Initial attempt + at most one automatic repair, per
  -- NARRATIVE_QUALITY_CONTRACT.md §D. Never more than 2 in MVP.
  generation_attempt_count integer not null default 0,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  -- Micro-dollars (1,000,000 = US$1) so provider cost never needs floats.
  provider_cost_micros bigint,
  latency_ms integer,
  -- The one allowance-facing fact per NARRATIVE_QUALITY_CONTRACT.md §D's
  -- billing rule: true iff this turn committed a Scene. provider_cost_micros
  -- may be non-zero even when this stays false (failed attempts still cost
  -- real money; the platform absorbs it, the player is not charged).
  user_allowance_debited boolean not null default false,
  error_class text
    check (error_class in (
      'input_rejected', 'output_blocked', 'unusable_output', 'transport_failure'
    )),
  result_scene_id uuid references public.scenes (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.turns is
  'One player intent through its generation lifecycle (DOMAIN_MODEL.md §11, CONTINUOUS_PLAY_CONTRACT.md §3). id is the client-generated turn_id; a resubmission with the same id is idempotent by primary key.';

create index turns_player_run_id_idx on public.turns (player_run_id);
create index turns_run_branch_id_idx on public.turns (run_branch_id);

alter table public.turns enable row level security;

create trigger turns_set_updated_at
  before update on public.turns
  for each row execute function public.set_updated_at();

create policy "turns_select_own"
  on public.turns for select
  to authenticated
  using (
    exists (
      select 1 from public.player_runs pr
      where pr.id = turns.player_run_id
        and pr.owner_user_id = (select auth.uid())
    )
  );

-- scenes.generation_turn_id -> turns.id is added after turns exists (the two
-- tables reference each other: a turn points at the scene it produced, a
-- scene points at the turn that produced it).
alter table public.scenes
  add constraint scenes_generation_turn_id_fkey
  foreign key (generation_turn_id) references public.turns (id);

-- ---------------------------------------------------------------------------
-- canon_facts — durable structured truth (DOMAIN_MODEL §2). Structured facts
-- only, never a transcript: "CanonFact is structured durable truth, not a
-- transcript" (task brief).
-- ---------------------------------------------------------------------------

create table public.canon_facts (
  id uuid primary key default gen_random_uuid(),
  player_run_id uuid not null references public.player_runs (id) on delete cascade,
  scope text not null check (scope in ('run', 'branch')),
  -- Required exactly when scope = 'branch'; null when scope = 'run'. See the
  -- file header on how branch isolation is actually enforced (via
  -- lw_branch_scene_ids() over source_scene_id, not by filtering on this
  -- column alone — this column is a query-optimization denormalization of
  -- "which branch recorded this", not the isolation mechanism itself).
  run_branch_id uuid references public.run_branches (id) on delete cascade,
  origin text not null default 'story_scene'
    check (origin in ('story_scene', 'character_chat')),
  -- Short stable slug for dedup/lookup, e.g. "told_elandra_real_name".
  fact_key text not null check (fact_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  fact_text text not null check (char_length(fact_text) between 1 and 500),
  source_turn_id uuid references public.turns (id),
  source_scene_id uuid references public.scenes (id),
  created_at timestamptz not null default now(),
  check ((scope = 'branch') = (run_branch_id is not null))
);

comment on table public.canon_facts is
  'Durable structured fact (DOMAIN_MODEL.md §2), not prose transcript. scope=run is visible on every branch of the PlayerRun; scope=branch is visible only where lw_branch_scene_ids() for the target branch includes source_scene_id.';

create index canon_facts_player_run_id_idx on public.canon_facts (player_run_id);
create index canon_facts_source_scene_id_idx on public.canon_facts (source_scene_id);

alter table public.canon_facts enable row level security;

create policy "canon_facts_select_own"
  on public.canon_facts for select
  to authenticated
  using (
    exists (
      select 1 from public.player_runs pr
      where pr.id = canon_facts.player_run_id
        and pr.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- usage_counters — MVP free-daily-allowance counter (DOMAIN_MODEL §3
-- UsageCounter; superseded by CreditLedger at M4, not built now).
-- ---------------------------------------------------------------------------

create table public.usage_counters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  generation_count integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.usage_counters is
  'Per-user free daily generation allowance (MVP UsageCounter, DOMAIN_MODEL.md §3). One row per user; usage_date resets generation_count to 0 in lw_precheck_and_start_turn when the stored date is no longer today (UTC).';

alter table public.usage_counters enable row level security;

create policy "usage_counters_select_own"
  on public.usage_counters for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- lw_branch_scene_ids — internal helper. Resolves the full ordered scene
-- history for a branch: ancestor branches' scenes up to (and including) each
-- fork point, followed by this branch's own scenes. See file header.
--
-- Not granted to any client role (see below) — it performs no ownership
-- check of its own and is only ever called from inside another SECURITY
-- DEFINER function that has already verified the caller owns the run. If it
-- were exposed directly, a caller could supply an arbitrary branch_id from
-- another user's run; the ids returned would still be unreadable via
-- scenes/canon_facts RLS, but there is no reason to rely on that as the only
-- guard when the function is not needed by any client-facing flow.
-- ---------------------------------------------------------------------------

create or replace function public.lw_branch_scene_ids(p_branch_id uuid)
returns table (scene_id uuid)
language sql
stable
set search_path = ''
as $$
  with recursive chain as (
    select rb.id as branch_id, rb.parent_branch_id, rb.fork_scene_id, 0 as depth
    from public.run_branches rb
    where rb.id = p_branch_id
    union all
    select rb.id, rb.parent_branch_id, rb.fork_scene_id, c.depth + 1
    from public.run_branches rb
    join chain c on rb.id = c.parent_branch_id
  ),
  bounds as (
    select
      c.branch_id,
      c.depth,
      (
        select s.seq_in_branch
        from chain child
        join public.scenes s on s.id = child.fork_scene_id
        where child.depth = c.depth - 1
      ) as upper_bound_seq
    from chain c
  )
  select s.id
  from bounds b
  join public.scenes s on s.run_branch_id = b.branch_id
  where b.upper_bound_seq is null or s.seq_in_branch <= b.upper_bound_seq
  order by b.depth desc, s.seq_in_branch asc;
$$;

revoke execute on function public.lw_branch_scene_ids(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- lw_precheck_and_start_turn — PRECHECK phase of CONTINUOUS_PLAY_CONTRACT.md
-- §3, plus the run-bootstrap path for a brand-new PlayerRun. Runs entirely
-- inside one transaction; the row lock on player_runs serializes concurrent
-- turns on the same run (the "maximum one in-flight turn per run" control).
--
-- AUTHORIZATION CONTRACT: SECURITY DEFINER. Callable only by `authenticated`
-- (see grant below). Verifies (select auth.uid()) against
-- player_runs.owner_user_id itself — never trusts p_player_run_id as proof of
-- ownership, per TECHNICAL_ARCHITECTURE.md §4's "a gateway function that
-- trusts a client-supplied player_run_id ... is a data-leak and a
-- billing-abuse vector" warning. When p_player_run_id is null it creates a
-- brand-new Story + StoryConfiguration + PlayerRun + root branch owned by the
-- caller, so there is nothing to authorize yet.
--
-- Returns one of:
--   {status: 'proceed', turn_id, player_run_id, run_branch_id, source_scene_id}
--   {status: 'in_flight', turn_id}
--   {status: 'committed', turn_id, scene: <row>}          -- idempotent replay
--   {status: 'ALLOWANCE_EXHAUSTED', reset_at}
--   {status: 'GENERATION_FAILED', error_class: 'input_rejected', turn_id}
-- ---------------------------------------------------------------------------

create or replace function public.lw_precheck_and_start_turn(
  p_turn_id uuid,
  p_player_run_id uuid,
  p_action_type text,
  p_selected_choice_id text default null,
  p_raw_action text default null,
  p_story_setup jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_player_run_id uuid := p_player_run_id;
  v_run_branch_id uuid;
  v_source_scene_id uuid;
  v_story_id uuid;
  v_existing_turn public.turns%rowtype;
  v_today date := (timezone('utc', now()))::date;
  v_daily_cap constant integer := 30; -- MVP UsageCounter cap; see DOMAIN_MODEL.md §3.
  v_generation_count integer;
  v_valid_choice boolean;
  v_blocked boolean;
  v_scene_json jsonb;
begin
  if v_caller is null then
    raise exception 'lw_precheck_and_start_turn: no authenticated caller';
  end if;

  if p_action_type not in ('start', 'choice', 'custom_action') then
    raise exception 'lw_precheck_and_start_turn: invalid action_type %', p_action_type;
  end if;

  -- ---- Idempotency: a turn with this id already exists -------------------
  select * into v_existing_turn from public.turns where id = p_turn_id;
  if found then
    if v_existing_turn.player_run_id != v_player_run_id and p_player_run_id is not null then
      raise exception 'lw_precheck_and_start_turn: turn_id % already belongs to a different run', p_turn_id;
    end if;
    if not exists (
      select 1 from public.player_runs pr
      where pr.id = v_existing_turn.player_run_id and pr.owner_user_id = v_caller
    ) then
      raise exception 'lw_precheck_and_start_turn: not authorized';
    end if;
    if v_existing_turn.status = 'committed' then
      select to_jsonb(s.*) into v_scene_json
      from public.scenes s where s.id = v_existing_turn.result_scene_id;
      return jsonb_build_object(
        'status', 'committed',
        'turn_id', v_existing_turn.id,
        'scene', v_scene_json
      );
    elsif v_existing_turn.status = 'failed' then
      return jsonb_build_object(
        'status', 'GENERATION_FAILED',
        'turn_id', v_existing_turn.id,
        'error_class', v_existing_turn.error_class
      );
    else
      return jsonb_build_object('status', 'in_flight', 'turn_id', v_existing_turn.id);
    end if;
  end if;

  -- ---- Bootstrap a brand-new run, or resolve + lock the existing one -----
  if v_player_run_id is null then
    if p_action_type != 'start' or p_story_setup is null then
      raise exception 'lw_precheck_and_start_turn: p_story_setup is required to start a new run';
    end if;

    insert into public.stories (owner_user_id, title, premise, content_language, genre, story_mode)
    values (
      v_caller,
      left(coalesce(nullif(p_story_setup ->> 'premise', ''), 'Untitled story'), 200),
      p_story_setup ->> 'premise',
      p_story_setup ->> 'content_language',
      coalesce(p_story_setup ->> 'genre', 'adventure'),
      coalesce(p_story_setup ->> 'story_mode', 'narrative')
    )
    returning id into v_story_id;

    insert into public.story_configurations (story_id, starting_situation)
    values (v_story_id, p_story_setup ->> 'premise');

    insert into public.player_runs (owner_user_id, story_id)
    values (v_caller, v_story_id)
    returning id into v_player_run_id;

    insert into public.run_branches (player_run_id, parent_branch_id, fork_scene_id, branch_seq)
    values (v_player_run_id, null, null, 0)
    returning id into v_run_branch_id;

    update public.player_runs set active_branch_id = v_run_branch_id where id = v_player_run_id;
  else
    select pr.active_branch_id into v_run_branch_id
    from public.player_runs pr
    where pr.id = v_player_run_id and pr.owner_user_id = v_caller
    for update;

    if not found then
      raise exception 'lw_precheck_and_start_turn: run not found or not owned by caller';
    end if;

    -- One in-flight turn per run: reject a second concurrent submission
    -- rather than silently starting a competing generation.
    if exists (
      select 1 from public.turns
      where run_branch_id = v_run_branch_id and status in ('pending', 'generating')
    ) then
      raise exception 'lw_precheck_and_start_turn: a turn is already in flight on this run';
    end if;

    -- Current scene = tip of this branch's resolved history. `with
    -- ordinality` pins the row we take as the last one lw_branch_scene_ids
    -- actually produced, rather than relying on plan-dependent row order
    -- surviving an unordered OFFSET.
    select scene_id into v_source_scene_id
    from public.lw_branch_scene_ids(v_run_branch_id) with ordinality as t(scene_id, ord)
    order by ord desc
    limit 1;

    if p_action_type = 'choice' then
      select exists (
        select 1
        from public.scenes s, jsonb_array_elements(s.next_choices) c
        where s.id = v_source_scene_id and c ->> 'id' = p_selected_choice_id
      ) into v_valid_choice;
      if not v_valid_choice then
        raise exception 'lw_precheck_and_start_turn: selected_choice_id % is not a current choice', p_selected_choice_id;
      end if;
    end if;
  end if;

  -- ---- Allowance check (skipped for a precheck-rejected input below) -----
  insert into public.usage_counters (user_id, usage_date, generation_count)
  values (v_caller, v_today, 0)
  on conflict (user_id) do update
    set generation_count = case
      when public.usage_counters.usage_date = v_today then public.usage_counters.generation_count
      else 0
    end,
    usage_date = v_today
  returning generation_count into v_generation_count;

  if v_generation_count >= v_daily_cap then
    return jsonb_build_object(
      'status', 'ALLOWANCE_EXHAUSTED',
      'reset_at', (v_today + 1)::timestamptz
    );
  end if;

  -- ---- Deterministic input moderation placeholder -------------------------
  -- No moderation provider is configured in this milestone (no AI provider
  -- credential exists locally — see docs/NARRATIVE_MODEL_EVALUATION.md). This
  -- is a documented, minimal stand-in (fixed phrase blocklist) so the
  -- PRECHECK -> moderate -> GENERATION_FAILED(input_rejected) path in
  -- CONTINUOUS_PLAY_CONTRACT.md §3 is real and testable, not a TODO. It must
  -- be replaced by a real moderateContent call before any public traffic.
  v_blocked := p_raw_action is not null and (
    lower(p_raw_action) ~ '\y(csam|child sexual|bestiality)\y'
  );

  if v_blocked then
    insert into public.turns (
      id, player_run_id, run_branch_id, source_scene_id, action_type,
      raw_player_action, selected_choice_id, status, error_class
    ) values (
      p_turn_id, v_player_run_id, v_run_branch_id, v_source_scene_id, p_action_type,
      p_raw_action, p_selected_choice_id, 'failed', 'input_rejected'
    );
    return jsonb_build_object(
      'status', 'GENERATION_FAILED',
      'turn_id', p_turn_id,
      'error_class', 'input_rejected'
    );
  end if;

  -- ---- Proceed: create the turn row and hand off to the caller -----------
  insert into public.turns (
    id, player_run_id, run_branch_id, source_scene_id, action_type,
    raw_player_action, selected_choice_id, status
  ) values (
    p_turn_id, v_player_run_id, v_run_branch_id, v_source_scene_id, p_action_type,
    p_raw_action, p_selected_choice_id, 'generating'
  );

  return jsonb_build_object(
    'status', 'proceed',
    'turn_id', p_turn_id,
    'player_run_id', v_player_run_id,
    'run_branch_id', v_run_branch_id,
    'source_scene_id', v_source_scene_id
  );
end;
$$;

revoke execute on function public.lw_precheck_and_start_turn(
  uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.lw_precheck_and_start_turn(
  uuid, uuid, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- lw_commit_turn — the CONTINUOUS_PLAY_CONTRACT.md §4 atomic commit point.
-- Called by the submit-turn Edge Function only after the provider's output
-- has passed schema + business-rule validation and the quality gate
-- (NARRATIVE_QUALITY_CONTRACT.md §D) in trusted server code. This function
-- performs the "nothing until VALIDATING passes" materialization in one
-- transaction: Scene + CanonFacts + Turn success + allowance debit together,
-- or none of it.
--
-- AUTHORIZATION CONTRACT: SECURITY DEFINER, `authenticated` only. Verifies
-- ownership via the turn's own player_run, not via any argument the caller
-- could forge.
-- ---------------------------------------------------------------------------

create or replace function public.lw_commit_turn(
  p_turn_id uuid,
  p_narrative text,
  p_dialogue jsonb,
  p_state_change_summary jsonb,
  p_structured_outcome jsonb,
  p_next_choices jsonb,
  p_boundary_kind text,
  p_canon_candidates jsonb,
  p_generation_attempt_count integer,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_provider_cost_micros bigint,
  p_latency_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_turn public.turns%rowtype;
  v_scene_id uuid;
  v_next_seq integer;
  v_fact jsonb;
  v_existing_scene public.scenes%rowtype;
begin
  if p_boundary_kind not in ('none', 'checkpoint', 'ending') then
    raise exception 'lw_commit_turn: invalid boundary_kind %', p_boundary_kind;
  end if;

  select t.* into v_turn
  from public.turns t
  join public.player_runs pr on pr.id = t.player_run_id
  where t.id = p_turn_id and pr.owner_user_id = v_caller
  for update of t;

  if not found then
    raise exception 'lw_commit_turn: turn not found or not owned by caller';
  end if;

  if v_turn.status = 'committed' then
    -- Already committed (a duplicate commit call for the same key): no-op,
    -- return the existing Scene rather than creating a second one.
    select * into v_existing_scene from public.scenes where id = v_turn.result_scene_id;
    return jsonb_build_object(
      'status', case
        when v_existing_scene.boundary_kind = 'ending' then 'TERMINAL_ENDING'
        when v_existing_scene.boundary_kind = 'checkpoint' then 'EXPLICIT_CHECKPOINT'
        else 'CONTINUE_READY'
      end,
      'scene', to_jsonb(v_existing_scene.*),
      'turn_id', v_turn.id
    );
  end if;

  if v_turn.status != 'generating' then
    raise exception 'lw_commit_turn: turn % is not in a committable state (status=%)', p_turn_id, v_turn.status;
  end if;

  select coalesce(max(seq_in_branch), -1) + 1 into v_next_seq
  from public.scenes where run_branch_id = v_turn.run_branch_id;

  insert into public.scenes (
    run_branch_id, seq_in_branch, parent_scene_id, boundary_kind, narrative,
    dialogue, state_change_summary, structured_outcome, next_choices,
    generation_turn_id
  ) values (
    v_turn.run_branch_id, v_next_seq, v_turn.source_scene_id, p_boundary_kind, p_narrative,
    coalesce(p_dialogue, '[]'::jsonb), coalesce(p_state_change_summary, '[]'::jsonb),
    coalesce(p_structured_outcome, '{}'::jsonb), coalesce(p_next_choices, '[]'::jsonb),
    v_turn.id
  )
  returning id into v_scene_id;

  for v_fact in select * from jsonb_array_elements(coalesce(p_canon_candidates, '[]'::jsonb))
  loop
    insert into public.canon_facts (
      player_run_id, scope, run_branch_id, origin, fact_key, fact_text,
      source_turn_id, source_scene_id
    ) values (
      v_turn.player_run_id,
      coalesce(v_fact ->> 'scope', 'branch'),
      case when coalesce(v_fact ->> 'scope', 'branch') = 'branch' then v_turn.run_branch_id else null end,
      'story_scene',
      v_fact ->> 'fact_key',
      v_fact ->> 'fact_text',
      v_turn.id,
      v_scene_id
    );
  end loop;

  update public.turns set
    status = 'committed',
    result_scene_id = v_scene_id,
    generation_attempt_count = p_generation_attempt_count,
    provider = p_provider,
    model = p_model,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    provider_cost_micros = p_provider_cost_micros,
    latency_ms = p_latency_ms,
    user_allowance_debited = true
  where id = p_turn_id;

  update public.player_runs set
    status = case when p_boundary_kind = 'ending' then 'completed' else status end
  where id = v_turn.player_run_id;

  insert into public.usage_counters (user_id, usage_date, generation_count)
  values (v_caller, (timezone('utc', now()))::date, 1)
  on conflict (user_id) do update
    set generation_count = case
      when public.usage_counters.usage_date = (timezone('utc', now()))::date
        then public.usage_counters.generation_count + 1
      else 1
    end,
    usage_date = (timezone('utc', now()))::date;

  return jsonb_build_object(
    'status', case
      when p_boundary_kind = 'ending' then 'TERMINAL_ENDING'
      when p_boundary_kind = 'checkpoint' then 'EXPLICIT_CHECKPOINT'
      else 'CONTINUE_READY'
    end,
    'scene', (select to_jsonb(s.*) from public.scenes s where s.id = v_scene_id),
    'turn_id', p_turn_id
  );
end;
$$;

revoke execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, integer, text, text,
  integer, integer, bigint, integer
) from public, anon, authenticated;
grant execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, integer, text, text,
  integer, integer, bigint, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- lw_fail_turn — resolves a turn to GENERATION_FAILED. Never debits
-- allowance (NARRATIVE_QUALITY_CONTRACT.md §D, CONTINUOUS_PLAY_CONTRACT.md
-- §8). provider_cost_micros is still recorded for internal accounting even
-- on failure — the platform absorbs it, the player is not billed.
-- ---------------------------------------------------------------------------

create or replace function public.lw_fail_turn(
  p_turn_id uuid,
  p_error_class text,
  p_generation_attempt_count integer,
  p_provider_cost_micros bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_turn public.turns%rowtype;
begin
  if p_error_class not in ('input_rejected', 'output_blocked', 'unusable_output', 'transport_failure') then
    raise exception 'lw_fail_turn: invalid error_class %', p_error_class;
  end if;

  select t.* into v_turn
  from public.turns t
  join public.player_runs pr on pr.id = t.player_run_id
  where t.id = p_turn_id and pr.owner_user_id = v_caller
  for update of t;

  if not found then
    raise exception 'lw_fail_turn: turn not found or not owned by caller';
  end if;

  if v_turn.status = 'committed' then
    raise exception 'lw_fail_turn: turn % already committed, cannot fail it', p_turn_id;
  end if;

  update public.turns set
    status = 'failed',
    error_class = p_error_class,
    generation_attempt_count = p_generation_attempt_count,
    provider_cost_micros = p_provider_cost_micros
  where id = p_turn_id;

  return jsonb_build_object('status', 'GENERATION_FAILED', 'turn_id', p_turn_id, 'error_class', p_error_class);
end;
$$;

revoke execute on function public.lw_fail_turn(uuid, text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.lw_fail_turn(uuid, text, integer, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- lw_replay_from_scene — "Replay from here" (UX_CONTRACT.md §9,
-- CONTINUOUS_PLAY_CONTRACT.md §6A). A pure state write: no provider call, no
-- allowance touch, cannot fail for provider reasons.
-- ---------------------------------------------------------------------------

create or replace function public.lw_replay_from_scene(
  p_player_run_id uuid,
  p_source_scene_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_source_branch_id uuid;
  v_new_branch_id uuid;
  v_next_branch_seq integer;
begin
  select rb.id into v_source_branch_id
  from public.scenes s
  join public.run_branches rb on rb.id = s.run_branch_id
  where s.id = p_source_scene_id and rb.player_run_id = p_player_run_id;

  if not found then
    raise exception 'lw_replay_from_scene: scene does not belong to this run';
  end if;

  perform 1 from public.player_runs
  where id = p_player_run_id and owner_user_id = v_caller
  for update;

  if not found then
    raise exception 'lw_replay_from_scene: run not found or not owned by caller';
  end if;

  select coalesce(max(branch_seq), -1) + 1 into v_next_branch_seq
  from public.run_branches where player_run_id = p_player_run_id;

  insert into public.run_branches (player_run_id, parent_branch_id, fork_scene_id, branch_seq)
  values (p_player_run_id, v_source_branch_id, p_source_scene_id, v_next_branch_seq)
  returning id into v_new_branch_id;

  update public.player_runs set active_branch_id = v_new_branch_id where id = p_player_run_id;

  return jsonb_build_object(
    'status', 'CONTINUE_READY',
    'run_branch_id', v_new_branch_id,
    'scene', (select to_jsonb(s.*) from public.scenes s where s.id = p_source_scene_id)
  );
end;
$$;

revoke execute on function public.lw_replay_from_scene(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lw_replay_from_scene(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- lw_get_run_state — read path for reload/resume. Derives play state from
-- the tip of the active branch's resolved history (CONTINUOUS_PLAY_CONTRACT.md
-- §2's derivation rule), never from any separately stored "current state"
-- flag. SECURITY DEFINER because it needs lw_branch_scene_ids(); verifies
-- ownership itself rather than relying on RLS.
-- ---------------------------------------------------------------------------

create or replace function public.lw_get_run_state(p_player_run_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_run public.player_runs%rowtype;
  v_scene_id uuid;
begin
  select * into v_run from public.player_runs
  where id = p_player_run_id and owner_user_id = v_caller;

  if not found then
    raise exception 'lw_get_run_state: run not found or not owned by caller';
  end if;

  select scene_id into v_scene_id
  from public.lw_branch_scene_ids(v_run.active_branch_id) with ordinality as t(scene_id, ord)
  order by ord desc
  limit 1;

  return jsonb_build_object(
    'player_run', to_jsonb(v_run.*),
    'run_branch_id', v_run.active_branch_id,
    'status', case
      when v_scene_id is null then 'CONTINUE_READY'
      else (
        select case s.boundary_kind
          when 'ending' then 'TERMINAL_ENDING'
          when 'checkpoint' then 'EXPLICIT_CHECKPOINT'
          else 'CONTINUE_READY'
        end
        from public.scenes s where s.id = v_scene_id
      )
    end,
    'scene', (select to_jsonb(s.*) from public.scenes s where s.id = v_scene_id)
  );
end;
$$;

revoke execute on function public.lw_get_run_state(uuid) from public, anon, authenticated;
grant execute on function public.lw_get_run_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Explicit Data API grants — SELECT only for every table above. No client
-- role ever receives INSERT/UPDATE/DELETE on player_runs, run_branches,
-- scenes, turns or canon_facts: every write is mediated by the SECURITY
-- DEFINER functions above, which is the actual "client cannot directly
-- create authoritative Scene/CanonFact" control. anon receives nothing.
-- Per AGENT_TOOLING.md standing rule 6, the default ACL is never assumed
-- safe: every grant below is explicit, and every function above starts from
-- `revoke ... from public, anon, authenticated` before any selective re-grant.
-- ---------------------------------------------------------------------------

grant select on public.player_runs    to authenticated;
grant select on public.run_branches   to authenticated;
grant select on public.scenes         to authenticated;
grant select on public.turns          to authenticated;
grant select on public.canon_facts    to authenticated;
grant select on public.usage_counters to authenticated;
