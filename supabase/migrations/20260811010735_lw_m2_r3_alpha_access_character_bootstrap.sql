-- LW-M2-R3: server-controlled adult AI-alpha access and minimal turn-1
-- canonical character bootstrap. No policy below makes Lorewish an 18+
-- product; AI_ALPHA_18_PLUS_ONLY is a temporary provider-testing constraint.

create table public.alpha_generation_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  adult_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint alpha_generation_access_enabled_requires_adult
    check (not enabled or adult_confirmed_at is not null)
);

comment on table public.alpha_generation_access is
  'AI_ALPHA_18_PLUS_ONLY. Service/admin-controlled temporary DeepSeek alpha access; not a permanent product age policy.';

alter table public.alpha_generation_access enable row level security;

-- Start from a known-empty client privilege set. There are deliberately no
-- anon/authenticated policies and no client DML grants, so normal users
-- cannot read or self-enable this allowlist.
revoke all on table public.alpha_generation_access from public, anon, authenticated;
grant select, insert, update, delete on table public.alpha_generation_access to service_role;

alter table public.characters
  add column address_terms jsonb;

alter table public.characters
  add constraint characters_address_terms_shape check (
    address_terms is null or (
      jsonb_typeof(address_terms) = 'object'
      and jsonb_object_length(address_terms) = 4
      and address_terms ?& array[
        'speaker_self_reference',
        'speaker_addresses_target_as',
        'target_self_reference',
        'target_addresses_speaker_as'
      ]
      and jsonb_typeof(address_terms -> 'speaker_self_reference') = 'string'
      and jsonb_typeof(address_terms -> 'speaker_addresses_target_as') = 'string'
      and jsonb_typeof(address_terms -> 'target_self_reference') = 'string'
      and jsonb_typeof(address_terms -> 'target_addresses_speaker_as') = 'string'
    )
  );

comment on column public.characters.address_terms is
  'Optional EN/VI address-term bootstrap for the first scene; long-term relationship memory remains M3.';

-- Replace the latest precheck function without changing its authorization,
-- idempotency, allowance, moderation, or grant contract. The only behavior
-- added is an atomic Character insert when starting_character is configured.
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
    raise exception 'lw_precheck_and_start_turn: invalid action_type %', p_action_type;
  end if;

  select * into v_existing_turn from public.turns where id = p_turn_id;
  if found then
    if v_existing_turn.player_run_id != v_player_run_id and p_player_run_id is not null then
      raise exception 'lw_precheck_and_start_turn: turn_id % already belongs to a different run', p_turn_id
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.player_runs pr
      where pr.id = v_existing_turn.player_run_id and pr.owner_user_id = v_caller
    ) then
      raise exception 'lw_precheck_and_start_turn: not authorized'
        using errcode = '42501';
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

  if v_player_run_id is null then
    if p_action_type != 'start' or p_story_setup is null then
      raise exception 'lw_precheck_and_start_turn: p_story_setup is required to start a new run';
    end if;

    v_starting_character := p_story_setup -> 'starting_character';
    if coalesce(jsonb_typeof(v_starting_character), 'null') <> 'null' then
      if jsonb_typeof(v_starting_character) <> 'object'
        or nullif(btrim(v_starting_character ->> 'name'), '') is null
        or nullif(btrim(v_starting_character ->> 'identity'), '') is null
        or nullif(btrim(v_starting_character ->> 'relationship'), '') is null
      then
        raise exception 'lw_precheck_and_start_turn: invalid starting_character'
          using errcode = '22023';
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
    )
    returning id into v_story_id;

    insert into public.story_configurations (story_id, starting_situation)
    values (v_story_id, p_story_setup ->> 'premise');

    if coalesce(jsonb_typeof(v_starting_character), 'null') = 'object' then
      insert into public.characters (
        story_id, name, aliases, description, story_relationship, address_terms
      ) values (
        v_story_id,
        left(v_starting_character ->> 'name', 200),
        '{}',
        left(v_starting_character ->> 'identity', 1000),
        left(v_starting_character ->> 'relationship', 500),
        nullif(v_starting_character -> 'address_terms', 'null'::jsonb)
      );
    end if;

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
      raise exception 'lw_precheck_and_start_turn: run not found or not owned by caller'
        using errcode = '42501';
    end if;

    if exists (
      select 1 from public.turns
      where run_branch_id = v_run_branch_id and status in ('pending', 'generating')
    ) then
      raise exception 'lw_precheck_and_start_turn: a turn is already in flight on this run';
    end if;

    select scene_id into v_source_scene_id
    from public.lw_branch_scene_ids(v_run_branch_id) with ordinality as t(scene_id, ord)
    order by ord desc
    limit 1;

    if p_action_type = 'choice' then
      select c ->> 'label' into v_selected_choice_label
      from public.scenes s, jsonb_array_elements(s.next_choices) c
      where s.id = v_source_scene_id and c ->> 'id' = p_selected_choice_id
      limit 1;
      v_valid_choice := v_selected_choice_label is not null;
      if not v_valid_choice then
        raise exception 'lw_precheck_and_start_turn: selected_choice_id % is not a current choice', p_selected_choice_id
          using errcode = '22023';
      end if;
    end if;
  end if;

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

  update public.usage_counters
  set generation_count = generation_count + 1
  where user_id = v_caller;

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
    'source_scene_id', v_source_scene_id,
    'selected_choice_label', v_selected_choice_label
  );
end;
$$;

revoke execute on function public.lw_precheck_and_start_turn(
  uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.lw_precheck_and_start_turn(
  uuid, uuid, text, text, text, jsonb
) to authenticated;
