-- Deterministic rollback-only W4 quota/budget/accounting contract.
-- Run against linked DEV with:
--   npx supabase db query --linked --file supabase/tests/lw_w4_guest_beta_contract.sql

begin;

do $probe$
declare
  v_guest uuid := gen_random_uuid();
  v_turn uuid := gen_random_uuid();
  v_exhausted_turn uuid := gen_random_uuid();
  v_run uuid;
  v_character uuid;
  v_thread uuid;
  v_message uuid := gen_random_uuid();
  v_character_message uuid := gen_random_uuid();
  v_result jsonb;
  v_count integer;
  v_summary jsonb;
  i integer;
begin
  insert into auth.users(
    id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_guest, 'authenticated', 'authenticated', true,
    '{"provider":"anonymous","providers":[]}'::jsonb,
    '{}'::jsonb, now(), now()
  );
  perform set_config('request.jwt.claim.sub', v_guest::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_guest::text,
      'role', 'authenticated',
      'is_anonymous', true
    )::text,
    true
  );

  if not exists (
    select 1 from public.profiles
    where id = v_guest and display_name is null
  ) then
    raise exception 'anonymous profile trigger or null-PII contract failed';
  end if;

  insert into public.usage_counters(
    user_id, usage_date, generation_count, chat_generation_count
  ) values (v_guest, (timezone('utc', now()))::date, 19, 29);

  v_result := public.lw_precheck_and_start_turn(
    v_turn, null, 'start', null, null,
    jsonb_build_object(
      'premise', 'W4 rollback-only Guest quota probe.',
      'player_role', 'archivist',
      'content_language', 'en',
      'genre', 'mystery',
      'story_mode', 'narrative',
      'starting_character', jsonb_build_object(
        'name', 'Mira Probe', 'aliases', '[]'::jsonb,
        'role', 'keeper', 'relationship', 'trusted ally'
      )
    )
  );
  if v_result ->> 'status' != 'proceed' then
    raise exception 'Guest Story reservation at 19 did not proceed: %', v_result;
  end if;
  v_run := (v_result ->> 'player_run_id')::uuid;
  select c.id into v_character
  from public.characters c
  join public.player_runs pr on pr.story_id = c.story_id
  where pr.id = v_run limit 1;

  select generation_count into v_count
  from public.usage_counters where user_id = v_guest;
  if v_count != 20 then
    raise exception 'Guest Story reserve expected 20, got %', v_count;
  end if;

  perform public.lw_fail_turn_capacity(v_turn, 0, 0);
  select generation_count into v_count
  from public.usage_counters where user_id = v_guest;
  if v_count != 19 then
    raise exception 'capacity denial did not refund Story reservation: %', v_count;
  end if;

  update public.usage_counters set generation_count = 20 where user_id = v_guest;
  v_result := public.lw_precheck_and_start_turn(
    v_exhausted_turn, null, 'start', null, null,
    jsonb_build_object(
      'premise', 'must not persist', 'player_role', 'probe',
      'content_language', 'en', 'genre', 'mystery', 'story_mode', 'narrative'
    )
  );
  if v_result ->> 'status' != 'ALLOWANCE_EXHAUSTED'
    or exists (select 1 from public.turns where id = v_exhausted_turn)
  then
    raise exception 'Guest Story cap 20 failed: %', v_result;
  end if;

  v_result := public.lw_get_or_create_chat_thread(v_run, v_character);
  v_thread := (v_result ->> 'id')::uuid;
  v_result := public.lw_start_chat_generation(
    v_guest, v_thread, v_message, 'First quota probe message.'
  );
  if v_result ->> 'status' != 'proceed' then
    raise exception 'Chat reservation at 29 did not proceed: %', v_result;
  end if;
  select chat_generation_count into v_count
  from public.usage_counters where user_id = v_guest;
  if v_count != 30 then raise exception 'Chat reserve expected 30, got %', v_count; end if;

  perform public.lw_fail_chat_generation(
    v_guest, v_message, 'provider_error', null, null, null, null, null, null
  );
  select chat_generation_count into v_count
  from public.usage_counters where user_id = v_guest;
  if v_count != 29 then raise exception 'Chat failure refund expected 29, got %', v_count; end if;

  v_result := public.lw_start_chat_generation(
    v_guest, v_thread, v_message, 'First quota probe message.'
  );
  if v_result ->> 'status' != 'proceed' then raise exception 'Chat retry did not proceed'; end if;
  perform public.lw_commit_chat_generation(
    v_guest, v_message, v_character_message, 'Reply.', '[]'::jsonb,
    'fake', 'fake', 1, 1, 0, 1
  );
  select chat_generation_count into v_count
  from public.usage_counters where user_id = v_guest;
  if v_count != 30 then raise exception 'successful Chat did not consume exactly one unit'; end if;

  v_result := public.lw_start_chat_generation(
    v_guest, v_thread, v_message, 'First quota probe message.'
  );
  if v_result ->> 'status' != 'completed' then
    raise exception 'completed Chat duplicate was not idempotent: %', v_result;
  end if;
  select chat_generation_count into v_count
  from public.usage_counters where user_id = v_guest;
  if v_count != 30 then raise exception 'completed Chat duplicate debited again'; end if;

  v_result := public.lw_start_chat_generation(
    v_guest, v_thread, gen_random_uuid(), 'Exhausted message.'
  );
  if v_result ->> 'status' != 'CHAT_ALLOWANCE_EXHAUSTED' then
    raise exception 'Chat cap 30 failed: %', v_result;
  end if;

  -- Isolate today's budget inside this transaction; rollback restores any
  -- pre-existing live telemetry exactly.
  delete from private.provider_attempts
  where usage_date = (timezone('utc', now()))::date;
  delete from private.provider_daily_telemetry
  where usage_date = (timezone('utc', now()))::date;
  delete from private.provider_daily_budget
  where usage_date = (timezone('utc', now()))::date;

  for i in 1..250 loop
    v_result := public.lw_reserve_provider_attempt(
      v_guest, true, case when i = 250 then 'chat' else 'story' end,
      'deepseek', 'deepseek-v4-flash'
    );
    if v_result ->> 'status' != 'reserved' then
      raise exception 'provider reservation % failed: %', i, v_result;
    end if;
    perform public.lw_complete_provider_attempt(
      (v_result ->> 'attempt_id')::uuid, true, 1, 2, 3
    );
  end loop;

  v_result := public.lw_reserve_provider_attempt(
    v_guest, true, 'story', 'deepseek', 'deepseek-v4-flash'
  );
  if v_result ->> 'status' != 'BETA_CAPACITY_REACHED' then
    raise exception '251st provider attempt was not denied: %', v_result;
  end if;

  v_summary := public.lw_provider_daily_summary(null);
  if (v_summary ->> 'total_attempts')::integer != 250
    or (v_summary ->> 'story_attempts')::integer != 249
    or (v_summary ->> 'chat_attempts')::integer != 1
    or (v_summary ->> 'remaining_attempts')::integer != 0
    or (v_summary ->> 'unique_guest_users')::integer != 1
    or (v_summary #>> '{providers,0,total_input_tokens}')::bigint != 250
    or (v_summary #>> '{providers,0,total_output_tokens}')::bigint != 500
    or (v_summary #>> '{providers,0,total_cost_micros}')::bigint != 750
  then
    raise exception 'provider summary mismatch: %', v_summary;
  end if;

  if has_function_privilege(
      'authenticated',
      'public.lw_reserve_provider_attempt(uuid,boolean,text,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated', 'public.lw_provider_daily_summary(date)', 'EXECUTE'
    )
    or has_table_privilege(
      'authenticated', 'private.provider_attempts', 'SELECT'
    )
  then
    raise exception 'client role can access provider budget/telemetry';
  end if;

  raise notice 'W4_GUEST_QUOTA_AND_PROVIDER_BUDGET_PASS';
end;
$probe$;

rollback;
