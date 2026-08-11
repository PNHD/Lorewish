-- Deterministic rollback-only integration contract for LW-W3-R2-R1.
-- Run against the linked DEV project with:
--   npx supabase db query --linked --file supabase/tests/lw_w3_r2_allowance_regression.sql

begin;

do $probe$
declare
  v_owner uuid := gen_random_uuid();
  v_success_turn uuid := gen_random_uuid();
  v_failed_turn uuid := gen_random_uuid();
  v_exhausted_turn uuid := gen_random_uuid();
  v_player_message uuid := gen_random_uuid();
  v_character_message uuid := gen_random_uuid();
  v_run uuid;
  v_character uuid;
  v_thread uuid;
  v_result jsonb;
  v_generation_count integer;
  v_scene_count integer;
  v_mismatch_rejected boolean := false;
begin
  insert into auth.users(
    id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_owner, 'authenticated', 'authenticated', 'lw-w3-r2-r1-rollback@example.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Allowance Repair Probe"}'::jsonb,
    now(), now()
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  -- Start from deterministic counter N = 7.
  insert into public.usage_counters(user_id, usage_date, generation_count)
  values (v_owner, (timezone('utc', now()))::date, 7);

  v_result := public.lw_precheck_and_start_turn(
    v_success_turn,
    null,
    'start',
    null,
    null,
    jsonb_build_object(
      'premise', 'Rollback-only allowance repair probe.',
      'player_role', 'archivist',
      'content_language', 'en',
      'genre', 'mystery',
      'story_mode', 'narrative',
      'starting_character', jsonb_build_object(
        'name', 'Mira Probe',
        'aliases', jsonb_build_array('Probe Mira'),
        'role', 'keeper',
        'description', 'Synthetic rollback-only Character.',
        'relationship', 'wary ally'
      )
    )
  );
  if v_result ->> 'status' != 'proceed' then
    raise exception 'successful precheck did not proceed: %', v_result;
  end if;
  v_run := (v_result ->> 'player_run_id')::uuid;
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 8 then
    raise exception 'successful precheck expected N+1=8, got %', v_generation_count;
  end if;

  v_result := public.lw_commit_turn(
    v_success_turn,
    'The archive doors open.',
    '[]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'none',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    1,
    'fake',
    'allowance-regression-probe',
    1,
    1,
    0,
    1
  );
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 8 then
    raise exception 'successful commit double-debited allowance: expected 8, got %', v_generation_count;
  end if;
  select count(*) into v_scene_count
  from public.scenes s
  join public.run_branches rb on rb.id = s.run_branch_id
  where rb.player_run_id = v_run;
  if v_scene_count != 1 then
    raise exception 'successful commit expected one Scene, got %', v_scene_count;
  end if;

  -- The same committed-turn request is a no-op for Scene and allowance state.
  perform public.lw_commit_turn(
    v_success_turn,
    'Ignored duplicate payload.',
    '[]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'none',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    2,
    'fake',
    'ignored-duplicate',
    2,
    2,
    99,
    2
  );
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 8 then
    raise exception 'duplicate commit changed allowance: expected 8, got %', v_generation_count;
  end if;
  select count(*) into v_scene_count
  from public.scenes s
  join public.run_branches rb on rb.id = s.run_branch_id
  where rb.player_run_id = v_run;
  if v_scene_count != 1 then
    raise exception 'duplicate commit created another Scene';
  end if;

  -- A provider/generation failure releases the precheck reservation.
  v_result := public.lw_precheck_and_start_turn(
    v_failed_turn, v_run, 'custom_action', null, 'Trigger a synthetic failure.', null
  );
  if v_result ->> 'status' != 'proceed' then
    raise exception 'failed-turn precheck did not proceed: %', v_result;
  end if;
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 9 then
    raise exception 'failed-turn precheck expected 9, got %', v_generation_count;
  end if;
  perform public.lw_fail_turn(v_failed_turn, 'transport_failure', 1, 5);
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 8 then
    raise exception 'failed generation did not release reservation: expected 8, got %', v_generation_count;
  end if;

  -- Exhaustion neither reserves another unit nor creates generation state.
  update public.usage_counters set generation_count = 30 where user_id = v_owner;
  v_result := public.lw_precheck_and_start_turn(
    v_exhausted_turn, v_run, 'custom_action', null, 'Must not generate.', null
  );
  if v_result ->> 'status' != 'ALLOWANCE_EXHAUSTED' then
    raise exception 'expected ALLOWANCE_EXHAUSTED, got %', v_result;
  end if;
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 30 or exists(select 1 from public.turns where id = v_exhausted_turn) then
    raise exception 'allowance exhaustion mutated counter or created a Turn';
  end if;
  update public.usage_counters set generation_count = 8 where user_id = v_owner;

  -- Chat start + successful reply remains outside Story allowance accounting.
  select c.id into v_character
  from public.characters c
  join public.player_runs pr on pr.story_id = c.story_id
  where pr.id = v_run
  order by c.created_at, c.id
  limit 1;
  v_thread := (public.lw_get_or_create_chat_thread(v_run, v_character) ->> 'id')::uuid;
  perform public.lw_start_chat_generation(v_owner, v_thread, v_player_message, 'Canonical player message.');
  perform public.lw_start_chat_generation(v_owner, v_thread, v_player_message, 'Canonical player message.');
  begin
    perform public.lw_start_chat_generation(v_owner, v_thread, v_player_message, 'Different provider prompt.');
  exception when sqlstate '22023' then
    v_mismatch_rejected := true;
  end;
  if not v_mismatch_rejected then
    raise exception 'mismatched Chat message-id reuse was not rejected';
  end if;
  if (select content from public.character_chat_messages where id = v_player_message) != 'Canonical player message.' then
    raise exception 'mismatched Chat retry changed canonical content';
  end if;
  perform public.lw_commit_chat_generation(
    v_owner,
    v_player_message,
    v_character_message,
    'Synthetic in-character reply.',
    '[]'::jsonb,
    'fake',
    'allowance-regression-probe',
    2,
    3,
    0,
    1
  );
  select generation_count into v_generation_count
  from public.usage_counters where user_id = v_owner;
  if v_generation_count != 8 then
    raise exception 'Character Chat mutated Story allowance: expected 8, got %', v_generation_count;
  end if;
end
$probe$;

rollback;

select
  'ALLOWANCE_REGRESSION_ROLLBACK_ONLY_PASS' as result,
  'N=7; precheck=8; commit=8; duplicate_commit=8' as successful_story,
  'precheck=9; fail=8' as failed_story,
  'at_cap=30; exhausted=30; no_turn=true' as exhausted_story,
  'before=8; chat_start_and_commit=8' as character_chat,
  'same_id_same_content=accepted; same_id_different_content=rejected' as chat_idempotency;
