-- LW-W3-R1: Advanced Setup persistence + durable, branch-aware character memory.
-- Character memory extends canon_facts; no redundant memory table is created.

alter table public.story_configurations
  add column player_name text check (char_length(player_name) <= 200),
  add column player_description text check (char_length(player_description) <= 2000);

alter table public.characters
  add column role text check (char_length(role) <= 500);

alter table public.canon_facts
  add column character_id uuid references public.characters(id) on delete cascade,
  add column memory_type text,
  add column salience smallint,
  add column supersedes_fact_id uuid references public.canon_facts(id) on delete set null;

alter table public.canon_facts
  add constraint canon_facts_character_memory_shape check (
    (
      character_id is null
      and memory_type is null
      and salience is null
      and supersedes_fact_id is null
    )
    or
    (
      character_id is not null
      and scope = 'branch'
      and run_branch_id is not null
      and memory_type in (
        'player_fact', 'character_fact', 'relationship_fact',
        'shared_event', 'promise', 'discovery'
      )
      and salience between 1 and 5
    )
  );

comment on column public.canon_facts.character_id is
  'Canonical authored Character that owns/knows this durable memory. Null for non-character canon.';
comment on column public.canon_facts.memory_type is
  'Typed character-memory category. Character memory is always branch-scoped.';
comment on column public.canon_facts.supersedes_fact_id is
  'Prior visible memory with the same character_id + fact_key. Current state is derived per branch ancestry, never globally mutated.';

create index canon_facts_character_id_idx on public.canon_facts(character_id);
create index canon_facts_supersedes_fact_id_idx on public.canon_facts(supersedes_fact_id);
create index canon_facts_memory_retrieval_idx
  on public.canon_facts(player_run_id, character_id, fact_key, created_at desc)
  where character_id is not null;

-- Before the first generated Scene, authoring rows may be edited normally.
-- Once canon exists, identity/config changes require a future explicit retcon
-- or new-branch feature; direct silent rewrites are rejected at the database.
create or replace function public.lw_guard_started_story_setup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
begin
  if tg_table_name = 'stories' then
    v_story_id := coalesce(new.id, old.id);
  else
    v_story_id := coalesce(new.story_id, old.story_id);
  end if;

  if exists (
    select 1
    from public.player_runs pr
    join public.run_branches rb on rb.player_run_id = pr.id
    join public.scenes s on s.run_branch_id = rb.id
    where pr.story_id = v_story_id
  ) then
    raise exception 'story setup is locked after the first generated scene'
      using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.lw_guard_started_story_setup() from public, anon, authenticated, service_role;

create trigger stories_guard_started_setup
  before update or delete on public.stories
  for each row execute function public.lw_guard_started_story_setup();
create trigger story_configurations_guard_started_setup
  before update or delete on public.story_configurations
  for each row execute function public.lw_guard_started_story_setup();
create trigger characters_guard_started_setup
  before insert or update or delete on public.characters
  for each row execute function public.lw_guard_started_story_setup();

-- Latest precheck contract, extended only for Advanced Setup persistence.
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
  v_daily_cap constant integer := 30;
  v_generation_count integer;
  v_valid_choice boolean;
  v_selected_choice_label text;
  v_blocked boolean;
  v_scene_json jsonb;
  v_starting_character jsonb;
begin
  if v_caller is null then
    raise exception 'lw_precheck_and_start_turn: no authenticated caller';
  end if;
  if p_action_type not in ('start', 'choice', 'custom_action') then
    raise exception 'lw_precheck_and_start_turn: invalid action_type %', p_action_type using errcode = '22023';
  end if;

  select * into v_existing_turn from public.turns where id = p_turn_id;
  if found then
    if v_existing_turn.player_run_id != v_player_run_id and p_player_run_id is not null then
      raise exception 'lw_precheck_and_start_turn: turn_id already belongs to a different run' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.player_runs pr
      where pr.id = v_existing_turn.player_run_id and pr.owner_user_id = v_caller
    ) then
      raise exception 'lw_precheck_and_start_turn: not authorized' using errcode = '42501';
    end if;
    if v_existing_turn.status = 'committed' then
      select to_jsonb(s.*) into v_scene_json from public.scenes s where s.id = v_existing_turn.result_scene_id;
      return jsonb_build_object('status', 'committed', 'turn_id', v_existing_turn.id, 'scene', v_scene_json);
    elsif v_existing_turn.status = 'failed' then
      return jsonb_build_object('status', 'GENERATION_FAILED', 'turn_id', v_existing_turn.id, 'error_class', v_existing_turn.error_class);
    else
      return jsonb_build_object('status', 'in_flight', 'turn_id', v_existing_turn.id);
    end if;
  end if;

  if v_player_run_id is null then
    if p_action_type != 'start' or p_story_setup is null then
      raise exception 'lw_precheck_and_start_turn: p_story_setup is required to start a new run' using errcode = '22023';
    end if;
    if nullif(btrim(p_story_setup ->> 'premise'), '') is null
      or nullif(btrim(p_story_setup ->> 'player_role'), '') is null
    then
      raise exception 'lw_precheck_and_start_turn: premise and player_role are required' using errcode = '22023';
    end if;

    v_starting_character := p_story_setup -> 'starting_character';
    if coalesce(jsonb_typeof(v_starting_character), 'null') <> 'null' then
      if jsonb_typeof(v_starting_character) <> 'object'
        or nullif(btrim(v_starting_character ->> 'name'), '') is null
        or nullif(btrim(v_starting_character ->> 'role'), '') is null
        or nullif(btrim(v_starting_character ->> 'relationship'), '') is null
        or coalesce(jsonb_typeof(v_starting_character -> 'aliases'), 'array') <> 'array'
      then
        raise exception 'lw_precheck_and_start_turn: invalid starting_character' using errcode = '22023';
      end if;
    end if;

    insert into public.stories (owner_user_id, title, premise, content_language, genre, story_mode)
    values (
      v_caller,
      left(coalesce(nullif(p_story_setup ->> 'premise', ''), 'Untitled story'), 200),
      p_story_setup ->> 'premise',
      p_story_setup ->> 'content_language',
      coalesce(p_story_setup ->> 'genre', 'adventure'),
      coalesce(p_story_setup ->> 'story_mode', 'narrative')
    ) returning id into v_story_id;

    insert into public.story_configurations (
      story_id, world_setting, player_role, player_name, player_description,
      starting_situation, tone, narrative_pov
    ) values (
      v_story_id,
      nullif(p_story_setup ->> 'world_setting', ''),
      p_story_setup ->> 'player_role',
      nullif(p_story_setup ->> 'player_name', ''),
      nullif(p_story_setup ->> 'player_description', ''),
      p_story_setup ->> 'premise',
      coalesce(p_story_setup ->> 'tone', 'balanced'),
      coalesce(p_story_setup ->> 'narrative_pov', 'second_person')
    );

    if coalesce(jsonb_typeof(v_starting_character), 'null') = 'object' then
      insert into public.characters (
        story_id, name, aliases, role, description, story_relationship, address_terms
      ) values (
        v_story_id,
        left(v_starting_character ->> 'name', 200),
        coalesce(array(select jsonb_array_elements_text(v_starting_character -> 'aliases')), '{}'),
        left(v_starting_character ->> 'role', 500),
        nullif(left(v_starting_character ->> 'description', 2000), ''),
        left(v_starting_character ->> 'relationship', 500),
        nullif(v_starting_character -> 'address_terms', 'null'::jsonb)
      );
    end if;

    insert into public.player_runs (owner_user_id, story_id)
    values (v_caller, v_story_id) returning id into v_player_run_id;
    insert into public.run_branches (player_run_id, parent_branch_id, fork_scene_id, branch_seq)
    values (v_player_run_id, null, null, 0) returning id into v_run_branch_id;
    update public.player_runs set active_branch_id = v_run_branch_id where id = v_player_run_id;
  else
    select pr.active_branch_id into v_run_branch_id
    from public.player_runs pr
    where pr.id = v_player_run_id and pr.owner_user_id = v_caller
    for update;
    if not found then
      raise exception 'lw_precheck_and_start_turn: run not found or not owned by caller' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.turns
      where run_branch_id = v_run_branch_id and status in ('pending', 'generating')
    ) then
      raise exception 'lw_precheck_and_start_turn: a turn is already in flight on this run';
    end if;
    select scene_id into v_source_scene_id
    from public.lw_branch_scene_ids(v_run_branch_id) with ordinality as t(scene_id, ord)
    order by ord desc limit 1;
    if p_action_type = 'choice' then
      select c ->> 'label' into v_selected_choice_label
      from public.scenes s, jsonb_array_elements(s.next_choices) c
      where s.id = v_source_scene_id and c ->> 'id' = p_selected_choice_id limit 1;
      v_valid_choice := v_selected_choice_label is not null;
      if not v_valid_choice then
        raise exception 'lw_precheck_and_start_turn: selected_choice_id is not a current choice' using errcode = '22023';
      end if;
    end if;
  end if;

  insert into public.usage_counters (user_id, usage_date, generation_count)
  values (v_caller, v_today, 0)
  on conflict (user_id) do update
    set generation_count = case
      when public.usage_counters.usage_date = v_today then public.usage_counters.generation_count else 0 end,
      usage_date = v_today
  returning generation_count into v_generation_count;
  if v_generation_count >= v_daily_cap then
    return jsonb_build_object('status', 'ALLOWANCE_EXHAUSTED', 'reset_at', (v_today + 1)::timestamptz);
  end if;

  v_blocked := p_raw_action is not null and lower(p_raw_action) ~ '\y(csam|child sexual|bestiality)\y';
  if v_blocked then
    insert into public.turns (
      id, player_run_id, run_branch_id, source_scene_id, action_type,
      raw_player_action, selected_choice_id, status, error_class
    ) values (
      p_turn_id, v_player_run_id, v_run_branch_id, v_source_scene_id, p_action_type,
      p_raw_action, p_selected_choice_id, 'failed', 'input_rejected'
    );
    return jsonb_build_object('status', 'GENERATION_FAILED', 'turn_id', p_turn_id, 'error_class', 'input_rejected');
  end if;

  update public.usage_counters set generation_count = generation_count + 1 where user_id = v_caller;
  insert into public.turns (
    id, player_run_id, run_branch_id, source_scene_id, action_type,
    raw_player_action, selected_choice_id, status
  ) values (
    p_turn_id, v_player_run_id, v_run_branch_id, v_source_scene_id, p_action_type,
    p_raw_action, p_selected_choice_id, 'generating'
  );
  return jsonb_build_object(
    'status', 'proceed', 'turn_id', p_turn_id, 'player_run_id', v_player_run_id,
    'run_branch_id', v_run_branch_id, 'source_scene_id', v_source_scene_id,
    'selected_choice_label', v_selected_choice_label
  );
end;
$$;

revoke execute on function public.lw_precheck_and_start_turn(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.lw_precheck_and_start_turn(uuid, uuid, text, text, text, jsonb)
  to authenticated;

-- Replace the commit RPC with a signature that accepts validated character
-- memory candidates. Dropping the old overload prevents any stale path from
-- committing a Scene without the complete canonical payload contract.
revoke execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, integer, text, text,
  integer, integer, bigint, integer
) from public, anon, authenticated;
drop function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, integer, text, text,
  integer, integer, bigint, integer
);

create function public.lw_commit_turn(
  p_turn_id uuid,
  p_narrative text,
  p_dialogue jsonb,
  p_state_change_summary jsonb,
  p_structured_outcome jsonb,
  p_next_choices jsonb,
  p_boundary_kind text,
  p_canon_candidates jsonb,
  p_character_memory_candidates jsonb,
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
  v_memory jsonb;
  v_character_id uuid;
  v_supersedes_fact_id uuid;
  v_existing_scene public.scenes%rowtype;
begin
  if p_boundary_kind not in ('none', 'checkpoint', 'ending') then
    raise exception 'lw_commit_turn: invalid boundary_kind %', p_boundary_kind using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_character_memory_candidates, '[]'::jsonb)) m
    group by m ->> 'character_id', m ->> 'fact_key'
    having count(*) > 1
  ) then
    raise exception 'lw_commit_turn: duplicate character memory key' using errcode = '22023';
  end if;

  select t.* into v_turn
  from public.turns t
  join public.player_runs pr on pr.id = t.player_run_id
  where t.id = p_turn_id and pr.owner_user_id = v_caller
  for update of t;
  if not found then
    raise exception 'lw_commit_turn: turn not found or not owned by caller' using errcode = '42501';
  end if;
  if v_turn.status = 'committed' then
    select * into v_existing_scene from public.scenes where id = v_turn.result_scene_id;
    return jsonb_build_object(
      'status', case when v_existing_scene.boundary_kind = 'ending' then 'TERMINAL_ENDING'
                     when v_existing_scene.boundary_kind = 'checkpoint' then 'EXPLICIT_CHECKPOINT'
                     else 'CONTINUE_READY' end,
      'scene', to_jsonb(v_existing_scene.*), 'turn_id', v_turn.id
    );
  end if;
  if v_turn.status != 'generating' then
    raise exception 'lw_commit_turn: turn is not in a committable state';
  end if;

  -- Validate all character references before the first canonical write.
  for v_memory in select * from jsonb_array_elements(coalesce(p_character_memory_candidates, '[]'::jsonb))
  loop
    begin
      v_character_id := (v_memory ->> 'character_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'lw_commit_turn: invalid character_id' using errcode = '22023';
    end;
    perform 1
    from public.characters c
    join public.player_runs pr on pr.story_id = c.story_id
    where c.id = v_character_id and pr.id = v_turn.player_run_id;
    if not found then
      raise exception 'lw_commit_turn: character does not belong to this run story' using errcode = '22023';
    end if;
  end loop;

  select coalesce(max(seq_in_branch), -1) + 1 into v_next_seq
  from public.scenes where run_branch_id = v_turn.run_branch_id;
  insert into public.scenes (
    run_branch_id, seq_in_branch, parent_scene_id, boundary_kind, narrative,
    dialogue, state_change_summary, structured_outcome, next_choices, generation_turn_id
  ) values (
    v_turn.run_branch_id, v_next_seq, v_turn.source_scene_id, p_boundary_kind, p_narrative,
    coalesce(p_dialogue, '[]'::jsonb), coalesce(p_state_change_summary, '[]'::jsonb),
    coalesce(p_structured_outcome, '{}'::jsonb), coalesce(p_next_choices, '[]'::jsonb), v_turn.id
  ) returning id into v_scene_id;

  for v_fact in select * from jsonb_array_elements(coalesce(p_canon_candidates, '[]'::jsonb))
  loop
    insert into public.canon_facts (
      player_run_id, scope, run_branch_id, origin, fact_key, fact_text, source_turn_id, source_scene_id
    ) values (
      v_turn.player_run_id, coalesce(v_fact ->> 'scope', 'branch'),
      case when coalesce(v_fact ->> 'scope', 'branch') = 'branch' then v_turn.run_branch_id else null end,
      'story_scene', v_fact ->> 'fact_key', v_fact ->> 'fact_text', v_turn.id, v_scene_id
    );
  end loop;

  for v_memory in select * from jsonb_array_elements(coalesce(p_character_memory_candidates, '[]'::jsonb))
  loop
    v_character_id := (v_memory ->> 'character_id')::uuid;
    v_supersedes_fact_id := null;
    select cf.id into v_supersedes_fact_id
    from public.canon_facts cf
    where cf.player_run_id = v_turn.player_run_id
      and cf.character_id = v_character_id
      and cf.fact_key = v_memory ->> 'fact_key'
      and cf.source_scene_id in (select * from public.lw_branch_scene_ids(v_turn.run_branch_id))
      and not exists (
        select 1 from public.canon_facts newer
        where newer.supersedes_fact_id = cf.id
          and newer.source_scene_id in (select * from public.lw_branch_scene_ids(v_turn.run_branch_id))
      )
    order by cf.created_at desc, cf.id desc
    limit 1;

    insert into public.canon_facts (
      player_run_id, scope, run_branch_id, origin, fact_key, fact_text,
      source_turn_id, source_scene_id, character_id, memory_type, salience, supersedes_fact_id
    ) values (
      v_turn.player_run_id, 'branch', v_turn.run_branch_id, 'story_scene',
      v_memory ->> 'fact_key', v_memory ->> 'fact_text', v_turn.id, v_scene_id,
      v_character_id, v_memory ->> 'memory_type', (v_memory ->> 'salience')::smallint,
      v_supersedes_fact_id
    );
  end loop;

  update public.turns set
    status = 'committed', result_scene_id = v_scene_id,
    generation_attempt_count = p_generation_attempt_count,
    provider = p_provider, model = p_model, input_tokens = p_input_tokens,
    output_tokens = p_output_tokens, provider_cost_micros = p_provider_cost_micros,
    latency_ms = p_latency_ms, user_allowance_debited = true
  where id = p_turn_id;
  update public.player_runs set
    status = case when p_boundary_kind = 'ending' then 'completed' else status end
  where id = v_turn.player_run_id;

  return jsonb_build_object(
    'status', case when p_boundary_kind = 'ending' then 'TERMINAL_ENDING'
                   when p_boundary_kind = 'checkpoint' then 'EXPLICIT_CHECKPOINT'
                   else 'CONTINUE_READY' end,
    'scene', (select to_jsonb(s.*) from public.scenes s where s.id = v_scene_id),
    'turn_id', p_turn_id
  );
end;
$$;

revoke execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, jsonb, integer, text,
  text, integer, integer, bigint, integer
) from public, anon, authenticated;
grant execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, jsonb, integer, text,
  text, integer, integer, bigint, integer
) to authenticated;

-- Return just enough authored setup for the story-first reading header.
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
    raise exception 'lw_get_run_state: run not found or not owned by caller' using errcode = '42501';
  end if;
  select scene_id into v_scene_id
  from public.lw_branch_scene_ids(v_run.active_branch_id) with ordinality as t(scene_id, ord)
  order by ord desc limit 1;
  return jsonb_build_object(
    'player_run', to_jsonb(v_run.*),
    'run_branch_id', v_run.active_branch_id,
    'status', case when v_scene_id is null then 'CONTINUE_READY' else (
      select case s.boundary_kind when 'ending' then 'TERMINAL_ENDING'
        when 'checkpoint' then 'EXPLICIT_CHECKPOINT' else 'CONTINUE_READY' end
      from public.scenes s where s.id = v_scene_id
    ) end,
    'scene', (select to_jsonb(s.*) from public.scenes s where s.id = v_scene_id),
    'story_title', (select st.title from public.stories st where st.id = v_run.story_id),
    'story_premise', (select st.premise from public.stories st where st.id = v_run.story_id),
    'starting_character', (
      select jsonb_build_object('name', c.name, 'role', c.role, 'relationship', c.story_relationship)
      from public.characters c where c.story_id = v_run.story_id order by c.created_at, c.id limit 1
    )
  );
end;
$$;

revoke execute on function public.lw_get_run_state(uuid) from public, anon, authenticated;
grant execute on function public.lw_get_run_state(uuid) to authenticated;

-- Existing table RLS and SELECT-only runtime grants remain authoritative.
-- No new client write path is granted by this migration.
