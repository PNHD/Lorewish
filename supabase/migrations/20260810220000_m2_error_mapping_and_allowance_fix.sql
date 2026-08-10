-- LW-M2-R2 — corrective migration for two M2-R1 known issues. Per the
-- project's established pattern (see the M1-R3 corrective migration's own
-- header), an already-applied migration is never rewritten; this is a new
-- migration that `create or replace`s the three affected functions.
--
-- FIX 1 — clean HTTP status for two client-triggerable failures
-- ----------------------------------------------------------------
-- lw_precheck_and_start_turn previously raised a plain `raise exception
-- 'text'` (SQLSTATE P0001) for both (a) a caller submitting a turn against a
-- run they don't own and (b) an invalid selected_choice_id. supabase-js's
-- PostgrestError carries the SQLSTATE as `.code`, but supabase-repository.ts
-- discarded it and wrapped every RPC error in a generic `Error`, which
-- submit-turn/index.ts's catch-all then always answered with HTTP 500 —
-- correct in that the action was blocked, wrong in that a legitimate client
-- validation/authorization failure looked identical to a real server fault.
-- The two exceptions below now raise with an explicit, meaningful SQLSTATE
-- (42501 insufficient_privilege; 22023 invalid_parameter_value — the same
-- convention this project already uses for RLS/grant reasoning, not an
-- invented code) so the TypeScript layer can distinguish them without
-- parsing message text. See supabase-repository.ts and
-- supabase/functions/_shared/engine/repository.ts
-- (RepositoryForbiddenError / RepositoryValidationError /
-- mapRepositoryErrorToHttpStatus) and submit-turn/index.ts for the other
-- half of this fix.
--
-- FIX 2 — concurrent-run allowance overrun (usage_counters)
-- ----------------------------------------------------------------
-- Documented in CURRENT_WORK.md's M2-R1 Known Issues: the daily cap was
-- checked at precheck time but only INCREMENTED at commit time, which is a
-- separate transaction after the (network-bound) provider call. Two
-- concurrent turns on two DIFFERENT runs owned by the same user could both
-- read generation_count=29 (cap 30) before either committed, both proceed,
-- and both later commit — 31 total for the day, one over cap. The
-- player_runs row lock only serializes concurrent turns on the SAME run; it
-- does nothing for two different runs owned by the same user.
--
-- Fix: reserve the allowance unit at PRECHECK time, inside the same
-- transaction as the cap check, by incrementing usage_counters.generation_count
-- immediately after the check passes (not at commit). The upsert already
-- takes a row lock on that user's usage_counters row, held for the rest of
-- this transaction; moving the increment inside that same transaction closes
-- the check-then-increment race for any two runs owned by the same user, not
-- just two turns on the same run. lw_commit_turn no longer increments (the
-- reservation already happened). lw_fail_turn now releases the reservation
-- (decrements by 1, floored at 0, only for the current UTC day) since a
-- failed turn must not count against the cap, per
-- NARRATIVE_QUALITY_CONTRACT.md §D's billing rule extended to the daily
-- counter, not just the per-turn audit column.
--
-- Residual, accepted risk (recorded per the task's "do not silently ignore
-- it" instruction, not fixed further): if the Edge Function process is
-- killed between precheck reserving the unit and either commit or fail ever
-- running (e.g. a platform-level execution-timeout kill, not a normal
-- provider/transport failure — those already retry/fail inside the same
-- call), the reservation is never released and one allowance unit leaks for
-- that user for the rest of that UTC day. This is strictly narrower than the
-- race being fixed (requires a mid-flight process kill, not just concurrent
-- requests), self-heals at the next UTC day boundary, and is judged
-- acceptable for closed M2 testing rather than building reservation
-- expiry/GC, which would start to look like the M4 credit ledger this task
-- is explicitly not scoped to build.

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
      -- The caller-triggerable case this migration's FIX 1 addresses:
      -- either the run genuinely does not exist, or it exists but is owned
      -- by someone else — both are an authorization failure from this
      -- caller's point of view, never distinguished to avoid confirming run
      -- existence to a non-owner.
      raise exception 'lw_precheck_and_start_turn: run not found or not owned by caller'
        using errcode = '42501';
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
        -- The other caller-triggerable case FIX 1 addresses: a stale or
        -- forged choice id is a client input-validation problem, not a
        -- server fault.
        raise exception 'lw_precheck_and_start_turn: selected_choice_id % is not a current choice', p_selected_choice_id
          using errcode = '22023';
      end if;
    end if;
  end if;

  -- ---- Allowance check + reservation (FIX 2) ------------------------------
  -- This upsert takes a row lock on the caller's usage_counters row, held
  -- for the rest of this transaction. The cap check and the reservation
  -- increment below both happen inside that same lock window, so a second
  -- concurrent precheck for the same user (on any run) blocks here until
  -- this transaction commits and sees the post-reservation count — not the
  -- stale pre-reservation count a separate later commit-time increment would
  -- have raced against. See the migration header for the full analysis and
  -- accepted residual risk.
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
    -- Not reserved above the cap check, and not consumed here either: input
    -- rejected at precheck never reaches a provider call, so it must not
    -- count against the daily allowance (CONTINUOUS_PLAY_CONTRACT.md §8).
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

  -- ---- Reserve the allowance unit now that this turn will actually
  -- attempt a provider call. lw_commit_turn no longer increments; lw_fail_turn
  -- releases this reservation if the turn does not commit.
  update public.usage_counters
  set generation_count = generation_count + 1
  where user_id = v_caller;

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
-- lw_commit_turn — FIX 2: no longer increments usage_counters. The unit was
-- already reserved by lw_precheck_and_start_turn; committing must not spend
-- a second one for the same turn.
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

  -- FIX 2: usage_counters.generation_count is NOT incremented here anymore —
  -- lw_precheck_and_start_turn already reserved this turn's unit atomically
  -- with the cap check. Incrementing again here would double-count.

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
-- lw_fail_turn — FIX 2: releases the allowance reservation
-- lw_precheck_and_start_turn made, since a failed turn commits no Scene and
-- must not count against the daily cap. Floored at 0 and scoped to "still
-- the same UTC day" so a release racing a midnight date-rollover cannot
-- corrupt the next day's fresh counter.
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

  -- Release the reservation lw_precheck_and_start_turn made for this turn.
  -- Every path that reaches "proceed" (and therefore a possible fail) went
  -- through exactly one reservation increment, so exactly one release here
  -- is correct regardless of whether a repair attempt ran inside
  -- turn-pipeline.ts (that loop is internal to one precheck/commit-or-fail
  -- pair, per NARRATIVE_QUALITY_CONTRACT.md §D).
  update public.usage_counters
  set generation_count = greatest(generation_count - 1, 0)
  where user_id = v_caller and usage_date = (timezone('utc', now()))::date;

  return jsonb_build_object('status', 'GENERATION_FAILED', 'turn_id', p_turn_id, 'error_class', p_error_class);
end;
$$;

revoke execute on function public.lw_fail_turn(uuid, text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.lw_fail_turn(uuid, text, integer, bigint) to authenticated;
