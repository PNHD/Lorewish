-- LW-W3-R2: branch-bound Character Chat, explicit canon promotion, and
-- server-controlled runtime Character creation. Forward-only, DEV first.

alter table public.characters
  add column origin text not null default 'authored'
    check (origin in ('authored', 'runtime')),
  add column source_scene_id uuid references public.scenes(id) on delete set null,
  add column created_by_turn_id uuid references public.turns(id) on delete set null,
  add column introduced_run_branch_id uuid references public.run_branches(id) on delete cascade,
  add column normalized_name text generated always as (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  ) stored;

alter table public.characters
  add constraint characters_runtime_provenance check (
    (origin = 'authored' and source_scene_id is null and created_by_turn_id is null and introduced_run_branch_id is null)
    or
    (origin = 'runtime' and source_scene_id is not null and created_by_turn_id is not null and introduced_run_branch_id is not null)
  );

create unique index characters_story_normalized_name_uidx
  on public.characters(story_id, normalized_name);
create index characters_source_scene_id_idx on public.characters(source_scene_id);
create index characters_created_by_turn_id_idx on public.characters(created_by_turn_id);
create index characters_introduced_branch_id_idx on public.characters(introduced_run_branch_id);

comment on column public.characters.origin is
  'authored setup identity or runtime identity atomically introduced by a committed Scene.';
comment on column public.characters.source_scene_id is
  'Runtime Character visibility/provenance anchor. Authored Characters have no source Scene.';

create table public.character_chat_threads (
  id uuid primary key default gen_random_uuid(),
  player_run_id uuid not null references public.player_runs(id) on delete cascade,
  run_branch_id uuid not null references public.run_branches(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_run_id, run_branch_id, character_id)
);

create index character_chat_threads_run_branch_id_idx on public.character_chat_threads(run_branch_id);
create index character_chat_threads_character_id_idx on public.character_chat_threads(character_id);

create table public.character_chat_messages (
  id uuid primary key,
  thread_id uuid not null references public.character_chat_threads(id) on delete cascade,
  role text not null check (role in ('player', 'character')),
  content text not null check (char_length(content) between 1 and 4000),
  reply_to_message_id uuid references public.character_chat_messages(id) on delete cascade,
  generation_status text check (generation_status in ('pending', 'completed', 'failed')),
  error_class text check (error_class in ('provider_error', 'validation_error', 'transport_error')),
  provider text,
  model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  provider_cost_micros bigint check (provider_cost_micros is null or provider_cost_micros >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  memory_candidates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(memory_candidates) = 'array' and jsonb_array_length(memory_candidates) <= 5),
  created_at timestamptz not null default now(),
  check (
    (role = 'player' and generation_status is not null and jsonb_array_length(memory_candidates) = 0)
    or
    (role = 'character' and generation_status is null and error_class is null)
  )
);

create index character_chat_messages_thread_created_idx
  on public.character_chat_messages(thread_id, created_at, id);
create index character_chat_messages_reply_to_idx on public.character_chat_messages(reply_to_message_id);

alter table public.canon_facts
  add column source_chat_message_id uuid references public.character_chat_messages(id) on delete set null,
  add column source_chat_candidate_index smallint;

alter table public.canon_facts
  add constraint canon_facts_chat_provenance check (
    (origin = 'story_scene' and source_chat_message_id is null and source_chat_candidate_index is null)
    or
    (origin = 'character_chat' and character_id is not null and source_chat_message_id is not null
      and source_chat_candidate_index between 0 and 4)
  );

create unique index canon_facts_chat_candidate_uidx
  on public.canon_facts(source_chat_message_id, source_chat_candidate_index)
  where source_chat_message_id is not null;
create index canon_facts_run_branch_id_idx on public.canon_facts(run_branch_id);
create index canon_facts_source_turn_id_idx on public.canon_facts(source_turn_id);

alter table public.character_chat_threads enable row level security;
alter table public.character_chat_messages enable row level security;

create policy "character_chat_threads_select_own"
  on public.character_chat_threads for select to authenticated
  using (exists (
    select 1 from public.player_runs pr
    where pr.id = character_chat_threads.player_run_id
      and pr.owner_user_id = (select auth.uid())
  ));

create policy "character_chat_messages_select_own"
  on public.character_chat_messages for select to authenticated
  using (exists (
    select 1
    from public.character_chat_threads thread
    join public.player_runs pr on pr.id = thread.player_run_id
    where thread.id = character_chat_messages.thread_id
      and pr.owner_user_id = (select auth.uid())
  ));

revoke all on public.character_chat_threads, public.character_chat_messages from public, anon, authenticated;
grant select on public.character_chat_threads, public.character_chat_messages to authenticated;

-- Preserve the authored setup lock. The only post-start exception is a fully
-- provenanced runtime INSERT whose Scene and Turn already agree inside the
-- same server-only canonical commit transaction.
create or replace function public.lw_guard_started_story_setup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
begin
  if tg_table_name = 'characters' and tg_op = 'INSERT' and new.origin = 'runtime' then
    if exists (
      select 1
      from public.scenes s
      join public.turns t on t.id = s.generation_turn_id
      join public.player_runs pr on pr.id = t.player_run_id
      where s.id = new.source_scene_id
        and t.id = new.created_by_turn_id
        and s.run_branch_id = new.introduced_run_branch_id
        and t.run_branch_id = new.introduced_run_branch_id
        and pr.story_id = new.story_id
        and t.status = 'generating'
    ) then
      return new;
    end if;
    raise exception 'runtime character provenance is invalid' using errcode = '22023';
  end if;

  if tg_table_name = 'stories' then
    v_story_id := coalesce(new.id, old.id);
  else
    v_story_id := coalesce(new.story_id, old.story_id);
  end if;

  if exists (
    select 1 from public.player_runs pr
    join public.run_branches rb on rb.player_run_id = pr.id
    join public.scenes s on s.run_branch_id = rb.id
    where pr.story_id = v_story_id
  ) then
    raise exception 'story setup is locked after the first generated scene' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function public.lw_guard_started_story_setup() from public, anon, authenticated, service_role;

-- The canonical Story commit is server-only in R2. An authenticated browser
-- can start a Turn but cannot forge provider output, audit metadata, a Scene,
-- or a runtime Character.
revoke execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, jsonb, integer, text,
  text, integer, integer, bigint, integer
) from public, anon, authenticated, service_role;
drop function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, jsonb, integer, text,
  text, integer, integer, bigint, integer
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
  p_new_character_candidates jsonb,
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
  v_turn public.turns%rowtype;
  v_scene_id uuid;
  v_next_seq integer;
  v_fact jsonb;
  v_memory jsonb;
  v_candidate jsonb;
  v_character_id uuid;
  v_supersedes_fact_id uuid;
  v_existing_scene public.scenes%rowtype;
  v_normalized_name text;
begin
  if p_boundary_kind not in ('none', 'checkpoint', 'ending') then
    raise exception 'lw_commit_turn: invalid boundary_kind %', p_boundary_kind using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_new_character_candidates, '[]'::jsonb)) > 3 then
    raise exception 'lw_commit_turn: too many runtime characters' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_character_memory_candidates, '[]'::jsonb)) m
    group by m ->> 'character_id', m ->> 'fact_key' having count(*) > 1
  ) then
    raise exception 'lw_commit_turn: duplicate character memory key' using errcode = '22023';
  end if;

  select t.* into v_turn from public.turns t where t.id = p_turn_id for update;
  if not found then raise exception 'lw_commit_turn: turn not found' using errcode = '42501'; end if;
  if v_turn.status = 'committed' then
    select * into v_existing_scene from public.scenes where id = v_turn.result_scene_id;
    return jsonb_build_object(
      'status', case when v_existing_scene.boundary_kind = 'ending' then 'TERMINAL_ENDING'
                     when v_existing_scene.boundary_kind = 'checkpoint' then 'EXPLICIT_CHECKPOINT'
                     else 'CONTINUE_READY' end,
      'scene', to_jsonb(v_existing_scene.*), 'turn_id', v_turn.id
    );
  end if;
  if v_turn.status != 'generating' then raise exception 'lw_commit_turn: turn is not committable'; end if;

  for v_memory in select * from jsonb_array_elements(coalesce(p_character_memory_candidates, '[]'::jsonb)) loop
    begin v_character_id := (v_memory ->> 'character_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'lw_commit_turn: invalid character_id' using errcode = '22023';
    end;
    perform 1 from public.characters c
    join public.player_runs pr on pr.story_id = c.story_id
    where c.id = v_character_id and pr.id = v_turn.player_run_id
      and (c.origin = 'authored' or c.source_scene_id in (
        select * from public.lw_branch_scene_ids(v_turn.run_branch_id)
      ));
    if not found then raise exception 'lw_commit_turn: character is not visible to this branch' using errcode = '22023'; end if;
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

  for v_candidate in select * from jsonb_array_elements(coalesce(p_new_character_candidates, '[]'::jsonb)) loop
    v_normalized_name := lower(regexp_replace(btrim(v_candidate ->> 'name'), '\s+', ' ', 'g'));
    if v_normalized_name = ''
      or coalesce(char_length(v_candidate ->> 'role'), 0) not between 1 and 500
      or coalesce(char_length(v_candidate ->> 'description'), 0) not between 1 and 2000
      or coalesce(char_length(v_candidate ->> 'relationship'), 0) not between 1 and 500
      or jsonb_typeof(coalesce(v_candidate -> 'aliases', '[]'::jsonb)) != 'array'
      or jsonb_array_length(coalesce(v_candidate -> 'aliases', '[]'::jsonb)) > 10 then
      raise exception 'lw_commit_turn: malformed runtime character' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.characters c
      join public.player_runs pr on pr.story_id = c.story_id
      where pr.id = v_turn.player_run_id and (
        c.normalized_name = v_normalized_name
        or exists (select 1 from unnest(c.aliases) a where lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) = v_normalized_name)
        or exists (
          select 1 from jsonb_array_elements_text(coalesce(v_candidate -> 'aliases', '[]'::jsonb)) as ca(alias_value)
          where lower(regexp_replace(btrim(ca.alias_value), '\s+', ' ', 'g')) = c.normalized_name
             or exists (select 1 from unnest(c.aliases) a where lower(regexp_replace(btrim(a), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(ca.alias_value), '\s+', ' ', 'g')))
        )
      )
    ) then
      insert into public.characters (
        story_id, name, aliases, role, description, story_relationship, origin,
        source_scene_id, created_by_turn_id, introduced_run_branch_id
      ) select
        pr.story_id, v_candidate ->> 'name',
        array(select jsonb_array_elements_text(coalesce(v_candidate -> 'aliases', '[]'::jsonb))),
        v_candidate ->> 'role', v_candidate ->> 'description', v_candidate ->> 'relationship',
        'runtime', v_scene_id, v_turn.id, v_turn.run_branch_id
      from public.player_runs pr where pr.id = v_turn.player_run_id;
    end if;
  end loop;

  for v_fact in select * from jsonb_array_elements(coalesce(p_canon_candidates, '[]'::jsonb)) loop
    insert into public.canon_facts (
      player_run_id, scope, run_branch_id, origin, fact_key, fact_text, source_turn_id, source_scene_id
    ) values (
      v_turn.player_run_id, coalesce(v_fact ->> 'scope', 'branch'),
      case when coalesce(v_fact ->> 'scope', 'branch') = 'branch' then v_turn.run_branch_id else null end,
      'story_scene', v_fact ->> 'fact_key', v_fact ->> 'fact_text', v_turn.id, v_scene_id
    );
  end loop;

  for v_memory in select * from jsonb_array_elements(coalesce(p_character_memory_candidates, '[]'::jsonb)) loop
    v_character_id := (v_memory ->> 'character_id')::uuid;
    v_supersedes_fact_id := null;
    select cf.id into v_supersedes_fact_id from public.canon_facts cf
    where cf.player_run_id = v_turn.player_run_id and cf.character_id = v_character_id
      and cf.fact_key = v_memory ->> 'fact_key'
      and cf.source_scene_id in (select * from public.lw_branch_scene_ids(v_turn.run_branch_id))
      and not exists (
        select 1 from public.canon_facts newer where newer.supersedes_fact_id = cf.id
          and newer.source_scene_id in (select * from public.lw_branch_scene_ids(v_turn.run_branch_id))
      )
    order by cf.created_at desc, cf.id desc limit 1;

    insert into public.canon_facts (
      player_run_id, scope, run_branch_id, origin, fact_key, fact_text,
      source_turn_id, source_scene_id, character_id, memory_type, salience, supersedes_fact_id
    ) values (
      v_turn.player_run_id, 'branch', v_turn.run_branch_id, 'story_scene',
      v_memory ->> 'fact_key', v_memory ->> 'fact_text', v_turn.id, v_scene_id,
      v_character_id, v_memory ->> 'memory_type', (v_memory ->> 'salience')::smallint, v_supersedes_fact_id
    );
  end loop;

  update public.turns set status = 'committed', result_scene_id = v_scene_id,
    generation_attempt_count = p_generation_attempt_count, provider = p_provider, model = p_model,
    input_tokens = p_input_tokens, output_tokens = p_output_tokens,
    provider_cost_micros = p_provider_cost_micros, latency_ms = p_latency_ms,
    user_allowance_debited = true where id = p_turn_id;
  update public.player_runs set status = case when p_boundary_kind = 'ending' then 'completed' else status end
  where id = v_turn.player_run_id;

  insert into public.usage_counters(user_id, usage_date, generation_count)
  select pr.owner_user_id, (timezone('utc', now()))::date, 1
  from public.player_runs pr where pr.id = v_turn.player_run_id
  on conflict (user_id) do update set
    generation_count = case when public.usage_counters.usage_date = (timezone('utc', now()))::date
      then public.usage_counters.generation_count + 1 else 1 end,
    usage_date = (timezone('utc', now()))::date;

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
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb, integer,
  text, text, integer, integer, bigint, integer
) from public, anon, authenticated;
grant execute on function public.lw_commit_turn(
  uuid, text, jsonb, jsonb, jsonb, jsonb, text, jsonb, jsonb, jsonb, integer,
  text, text, integer, integer, bigint, integer
) to service_role;

-- Branch-specific thread creation is safe for the owning signed-in player;
-- message writes and provider accounting remain server-only below.
create function public.lw_get_or_create_chat_thread(p_player_run_id uuid, p_character_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := (select auth.uid());
  v_run public.player_runs%rowtype;
  v_thread public.character_chat_threads%rowtype;
begin
  select * into v_run from public.player_runs
  where id = p_player_run_id and owner_user_id = v_caller;
  if not found then raise exception 'chat thread: run not owned' using errcode = '42501'; end if;
  perform 1 from public.characters c where c.id = p_character_id and c.story_id = v_run.story_id
    and (c.origin = 'authored' or c.source_scene_id in (select * from public.lw_branch_scene_ids(v_run.active_branch_id)));
  if not found then raise exception 'chat thread: character not visible' using errcode = '22023'; end if;
  insert into public.character_chat_threads(player_run_id, run_branch_id, character_id)
  values (v_run.id, v_run.active_branch_id, p_character_id)
  on conflict (player_run_id, run_branch_id, character_id) do update
    set updated_at = public.character_chat_threads.updated_at
  returning * into v_thread;
  return to_jsonb(v_thread.*);
end; $$;

revoke execute on function public.lw_get_or_create_chat_thread(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lw_get_or_create_chat_thread(uuid, uuid) to authenticated;

create function public.lw_start_chat_generation(
  p_owner_user_id uuid, p_thread_id uuid, p_message_id uuid, p_content text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message public.character_chat_messages%rowtype;
begin
  if char_length(btrim(p_content)) not between 1 and 4000 then
    raise exception 'chat message: invalid content' using errcode = '22023';
  end if;
  perform 1 from public.character_chat_threads thread
  join public.player_runs pr on pr.id = thread.player_run_id
  where thread.id = p_thread_id and pr.owner_user_id = p_owner_user_id;
  if not found then raise exception 'chat message: thread not owned' using errcode = '42501'; end if;
  insert into public.character_chat_messages(id, thread_id, role, content, generation_status)
  values (p_message_id, p_thread_id, 'player', btrim(p_content), 'pending')
  on conflict (id) do update set
    generation_status = case when public.character_chat_messages.generation_status = 'failed' then 'pending' else public.character_chat_messages.generation_status end,
    error_class = case when public.character_chat_messages.generation_status = 'failed' then null else public.character_chat_messages.error_class end
  returning * into v_message;
  if v_message.thread_id != p_thread_id or v_message.role != 'player' then
    raise exception 'chat message: id collision' using errcode = '22023';
  end if;
  return to_jsonb(v_message.*);
end; $$;

create function public.lw_commit_chat_generation(
  p_owner_user_id uuid, p_player_message_id uuid, p_character_message_id uuid,
  p_reply text, p_memory_candidates jsonb, p_provider text, p_model text,
  p_input_tokens integer, p_output_tokens integer, p_provider_cost_micros bigint, p_latency_ms integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_player public.character_chat_messages%rowtype; v_character public.character_chat_messages%rowtype;
begin
  select m.* into v_player from public.character_chat_messages m
  join public.character_chat_threads thread on thread.id = m.thread_id
  join public.player_runs pr on pr.id = thread.player_run_id
  where m.id = p_player_message_id and m.role = 'player' and pr.owner_user_id = p_owner_user_id
  for update of m;
  if not found then raise exception 'chat commit: message not owned' using errcode = '42501'; end if;
  if v_player.generation_status = 'completed' then
    return (select to_jsonb(m.*) from public.character_chat_messages m where m.reply_to_message_id = v_player.id);
  end if;
  if v_player.generation_status != 'pending' then raise exception 'chat commit: not pending'; end if;
  if char_length(btrim(p_reply)) not between 1 and 4000
    or jsonb_typeof(coalesce(p_memory_candidates, '[]'::jsonb)) != 'array'
    or jsonb_array_length(coalesce(p_memory_candidates, '[]'::jsonb)) > 5 then
    raise exception 'chat commit: malformed output' using errcode = '22023';
  end if;
  insert into public.character_chat_messages(
    id, thread_id, role, content, reply_to_message_id, memory_candidates
  ) values (
    p_character_message_id, v_player.thread_id, 'character', btrim(p_reply), v_player.id,
    coalesce(p_memory_candidates, '[]'::jsonb)
  ) returning * into v_character;
  update public.character_chat_messages set generation_status = 'completed', provider = p_provider,
    model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens,
    provider_cost_micros = p_provider_cost_micros, latency_ms = p_latency_ms
  where id = v_player.id;
  update public.character_chat_threads set updated_at = now() where id = v_player.thread_id;
  return to_jsonb(v_character.*);
end; $$;

create function public.lw_fail_chat_generation(
  p_owner_user_id uuid, p_player_message_id uuid, p_error_class text,
  p_provider text default null, p_model text default null, p_input_tokens integer default null,
  p_output_tokens integer default null, p_provider_cost_micros bigint default null, p_latency_ms integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message public.character_chat_messages%rowtype;
begin
  if p_error_class not in ('provider_error', 'validation_error', 'transport_error') then
    raise exception 'chat fail: invalid class' using errcode = '22023';
  end if;
  update public.character_chat_messages m set generation_status = 'failed', error_class = p_error_class,
    provider = p_provider, model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens,
    provider_cost_micros = p_provider_cost_micros, latency_ms = p_latency_ms
  from public.character_chat_threads thread, public.player_runs pr
  where m.id = p_player_message_id and m.role = 'player' and m.thread_id = thread.id
    and thread.player_run_id = pr.id and pr.owner_user_id = p_owner_user_id
    and m.generation_status = 'pending'
  returning m.* into v_message;
  if not found then raise exception 'chat fail: message not owned or pending' using errcode = '42501'; end if;
  return to_jsonb(v_message.*);
end; $$;

revoke execute on function public.lw_start_chat_generation(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.lw_commit_chat_generation(uuid, uuid, uuid, text, jsonb, text, text, integer, integer, bigint, integer) from public, anon, authenticated;
revoke execute on function public.lw_fail_chat_generation(uuid, uuid, text, text, text, integer, integer, bigint, integer) from public, anon, authenticated;
grant execute on function public.lw_start_chat_generation(uuid, uuid, uuid, text) to service_role;
grant execute on function public.lw_commit_chat_generation(uuid, uuid, uuid, text, jsonb, text, text, integer, integer, bigint, integer) to service_role;
grant execute on function public.lw_fail_chat_generation(uuid, uuid, text, text, text, integer, integer, bigint, integer) to service_role;

create function public.lw_promote_chat_memory(p_character_message_id uuid, p_candidate_index integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := (select auth.uid());
  v_thread public.character_chat_threads%rowtype;
  v_message public.character_chat_messages%rowtype;
  v_candidate jsonb;
  v_source_scene_id uuid;
  v_existing public.canon_facts%rowtype;
  v_fact public.canon_facts%rowtype;
begin
  if p_candidate_index not between 0 and 4 then raise exception 'promotion: invalid candidate' using errcode = '22023'; end if;
  select m.* into v_message from public.character_chat_messages m where m.id = p_character_message_id and m.role = 'character';
  if not found then raise exception 'promotion: message not found' using errcode = '22023'; end if;
  select thread.* into v_thread from public.character_chat_threads thread
  join public.player_runs pr on pr.id = thread.player_run_id
  where thread.id = v_message.thread_id and pr.owner_user_id = v_caller
    and pr.active_branch_id = thread.run_branch_id;
  if not found then raise exception 'promotion: wrong owner or branch' using errcode = '42501'; end if;
  v_candidate := v_message.memory_candidates -> p_candidate_index;
  if v_candidate is null or v_candidate ->> 'fact_key' !~ '^[a-z][a-z0-9_]{1,79}$'
    or v_candidate ->> 'memory_type' not in ('player_fact','character_fact','relationship_fact','shared_event','promise','discovery')
    or char_length(v_candidate ->> 'fact_text') not between 1 and 500
    or (v_candidate ->> 'salience')::integer not between 1 and 5 then
    raise exception 'promotion: malformed candidate' using errcode = '22023';
  end if;
  select * into v_fact from public.canon_facts
  where source_chat_message_id = p_character_message_id and source_chat_candidate_index = p_candidate_index;
  if found then return to_jsonb(v_fact.*); end if;
  select scene_id into v_source_scene_id
  from public.lw_branch_scene_ids(v_thread.run_branch_id) with ordinality as visible(scene_id, ord)
  order by ord desc limit 1;
  if v_source_scene_id is null then raise exception 'promotion: branch has no Scene' using errcode = '22023'; end if;
  select cf.* into v_existing from public.canon_facts cf
  where cf.player_run_id = v_thread.player_run_id and cf.character_id = v_thread.character_id
    and cf.fact_key = v_candidate ->> 'fact_key'
    and cf.source_scene_id in (select * from public.lw_branch_scene_ids(v_thread.run_branch_id))
    and (cf.origin = 'story_scene' or cf.run_branch_id = v_thread.run_branch_id)
    and not exists (select 1 from public.canon_facts newer where newer.supersedes_fact_id = cf.id
      and newer.source_scene_id in (select * from public.lw_branch_scene_ids(v_thread.run_branch_id)))
  order by cf.created_at desc, cf.id desc limit 1;
  insert into public.canon_facts(
    player_run_id, scope, run_branch_id, origin, fact_key, fact_text, source_scene_id,
    character_id, memory_type, salience, supersedes_fact_id,
    source_chat_message_id, source_chat_candidate_index
  ) values (
    v_thread.player_run_id, 'branch', v_thread.run_branch_id, 'character_chat',
    v_candidate ->> 'fact_key', v_candidate ->> 'fact_text', v_source_scene_id,
    v_thread.character_id, v_candidate ->> 'memory_type', (v_candidate ->> 'salience')::smallint,
    v_existing.id, p_character_message_id, p_candidate_index
  ) returning * into v_fact;
  return to_jsonb(v_fact.*);
end; $$;

revoke execute on function public.lw_promote_chat_memory(uuid, integer) from public, anon, authenticated;
grant execute on function public.lw_promote_chat_memory(uuid, integer) to authenticated;

-- Reading state now exposes only branch-visible canonical Characters and a
-- human-sized alternate-path label input; no chat transcript is mixed in.
create or replace function public.lw_get_run_state(p_player_run_id uuid)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare v_caller uuid := (select auth.uid()); v_run public.player_runs%rowtype; v_scene_id uuid; v_branch_seq integer;
begin
  select * into v_run from public.player_runs where id = p_player_run_id and owner_user_id = v_caller;
  if not found then raise exception 'lw_get_run_state: run not found or not owned by caller' using errcode = '42501'; end if;
  select branch_seq into v_branch_seq from public.run_branches where id = v_run.active_branch_id;
  select scene_id into v_scene_id from public.lw_branch_scene_ids(v_run.active_branch_id) with ordinality as t(scene_id, ord)
  order by ord desc limit 1;
  return jsonb_build_object(
    'player_run', to_jsonb(v_run.*), 'run_branch_id', v_run.active_branch_id, 'branch_seq', v_branch_seq,
    'status', case when v_scene_id is null then 'CONTINUE_READY' else (
      select case s.boundary_kind when 'ending' then 'TERMINAL_ENDING' when 'checkpoint' then 'EXPLICIT_CHECKPOINT' else 'CONTINUE_READY' end
      from public.scenes s where s.id = v_scene_id) end,
    'scene', (select to_jsonb(s.*) from public.scenes s where s.id = v_scene_id),
    'scenes', coalesce((select jsonb_agg(to_jsonb(s.*) order by visible.ord)
      from public.lw_branch_scene_ids(v_run.active_branch_id) with ordinality as visible(scene_id, ord)
      join public.scenes s on s.id = visible.scene_id), '[]'::jsonb),
    'story_title', (select st.title from public.stories st where st.id = v_run.story_id),
    'story_premise', (select st.premise from public.stories st where st.id = v_run.story_id),
    'content_language', (select st.content_language from public.stories st where st.id = v_run.story_id),
    'characters', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'role', c.role, 'relationship', c.story_relationship,
      'description', c.description, 'origin', c.origin
    ) order by c.created_at, c.id) from public.characters c
      where c.story_id = v_run.story_id and (c.origin = 'authored' or c.source_scene_id in (
        select * from public.lw_branch_scene_ids(v_run.active_branch_id)
      ))), '[]'::jsonb)
  );
end; $$;

revoke execute on function public.lw_get_run_state(uuid) from public, anon, authenticated;
grant execute on function public.lw_get_run_state(uuid) to authenticated;
