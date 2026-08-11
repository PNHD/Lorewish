-- LW-W3-R2-R1 — forward-only repair for Story allowance double-debit and
-- Character Chat message-id/content idempotency.
--
-- The already-applied W3-R2 migration extended lw_commit_turn for runtime
-- Characters but accidentally restored the old commit-time usage counter
-- increment. lw_precheck_and_start_turn already reserves exactly one unit,
-- and lw_fail_turn releases that reservation. Successful commit must only
-- materialize canonical output and provider accounting; it must not debit the
-- Story allowance again.

create or replace function public.lw_commit_turn(
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

  -- The allowance unit was atomically reserved by lw_precheck_and_start_turn.
  -- Do not touch usage_counters here: success consumes that one reservation,
  -- and the committed-turn early return above remains allowance-idempotent.

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

-- A repeated Chat message id is idempotent only when it represents the exact
-- same persisted player message. Reject mismatched content before the caller
-- can generate against text that is not the canonical database record.
create or replace function public.lw_start_chat_generation(
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
  if v_message.content is distinct from btrim(p_content) then
    raise exception 'chat message: idempotency content mismatch' using errcode = '22023';
  end if;
  return to_jsonb(v_message.*);
end; $$;

revoke execute on function public.lw_start_chat_generation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.lw_start_chat_generation(uuid, uuid, uuid, text)
  to service_role;
