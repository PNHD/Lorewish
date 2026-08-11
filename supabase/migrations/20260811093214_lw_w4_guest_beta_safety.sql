-- LW-W4-R1 -- Guest-first beta safety, independent Story/Chat allowances,
-- and one shared server-only provider circuit breaker.

-- Anonymous auth users have no email or identity, but the existing trigger
-- inserts only id + locale. Correct the stale comment; no fake PII is added.
comment on table public.profiles is
  'Private 1:1 profile for permanent and anonymous auth users. Email and identity metadata are not duplicated here; display_name remains nullable.';

-- Story and Character Chat use independent successful-generation allowances.
alter table public.usage_counters
  add column chat_generation_count integer not null default 0
  check (chat_generation_count >= 0);

alter table public.usage_counters
  add constraint usage_counters_generation_count_nonnegative
  check (generation_count >= 0);

comment on table public.usage_counters is
  'Per-user UTC-day successful generation allowances. generation_count is Story; chat_generation_count is Character Chat. Reservations happen before provider access and failures release only the matching reservation.';

-- Any path which advances usage_date must reset both independent counters.
create function public.lw_reset_usage_counters_for_new_utc_day()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.usage_date is distinct from old.usage_date then
    new.generation_count := 0;
    new.chat_generation_count := 0;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.lw_reset_usage_counters_for_new_utc_day()
  from public, anon, authenticated, service_role;

create trigger usage_counters_reset_for_new_utc_day
  before update of usage_date on public.usage_counters
  for each row execute function public.lw_reset_usage_counters_for_new_utc_day();

-- Preserve the exact W3 implementation as an internal primitive. The W4
-- wrapper keeps permanent-user cap 30 while atomically limiting anonymous
-- users to 20. Existing turn ids bypass the cap precheck so committed/failed
-- idempotent replies remain observable even after the user reaches the cap.
alter function public.lw_precheck_and_start_turn(uuid, uuid, text, text, text, jsonb)
  rename to lw_internal_precheck_and_start_turn;

revoke execute on function public.lw_internal_precheck_and_start_turn(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated, service_role;

create function public.lw_precheck_and_start_turn(
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
  v_today date := (timezone('utc', now()))::date;
  v_generation_count integer;
  v_is_anonymous boolean := coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false);
begin
  if v_caller is null then
    raise exception 'lw_precheck_and_start_turn: no authenticated caller' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.turns t
    join public.player_runs pr on pr.id = t.player_run_id
    where t.id = p_turn_id and pr.owner_user_id = v_caller
  ) then
    return public.lw_internal_precheck_and_start_turn(
      p_turn_id, p_player_run_id, p_action_type, p_selected_choice_id,
      p_raw_action, p_story_setup
    );
  end if;

  if v_is_anonymous then
    insert into public.usage_counters (
      user_id, usage_date, generation_count, chat_generation_count
    ) values (v_caller, v_today, 0, 0)
    on conflict (user_id) do update
      set usage_date = v_today
    returning generation_count into v_generation_count;

    if v_generation_count >= 20 then
      return jsonb_build_object(
        'status', 'ALLOWANCE_EXHAUSTED',
        'reset_at', (v_today + 1)::timestamptz
      );
    end if;
  end if;

  return public.lw_internal_precheck_and_start_turn(
    p_turn_id, p_player_run_id, p_action_type, p_selected_choice_id,
    p_raw_action, p_story_setup
  );
end;
$$;

revoke execute on function public.lw_precheck_and_start_turn(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.lw_precheck_and_start_turn(uuid, uuid, text, text, text, jsonb)
  to authenticated;

-- Capacity denial is a durable failed Turn with zero provider attempt. It has
-- a distinct internal class so reload/idempotency never turns it into a
-- generic provider error. The public UI maps it to BETA_CAPACITY_REACHED.
alter table public.turns drop constraint turns_error_class_check;
alter table public.turns add constraint turns_error_class_check
  check (error_class in (
    'input_rejected', 'output_blocked', 'unusable_output',
    'transport_failure', 'capacity_reached'
  ));

create function public.lw_fail_turn_capacity(p_turn_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_turn public.turns%rowtype;
  v_owner_user_id uuid;
begin
  select t.* into v_turn
  from public.turns t
  where t.id = p_turn_id
  for update of t;

  if not found then
    raise exception 'lw_fail_turn_capacity: turn not found' using errcode = '22023';
  end if;
  select pr.owner_user_id into v_owner_user_id
  from public.player_runs pr
  where pr.id = v_turn.player_run_id;
  if v_turn.status = 'failed' and v_turn.error_class = 'capacity_reached' then
    return jsonb_build_object('status', 'BETA_CAPACITY_REACHED', 'turn_id', p_turn_id);
  end if;
  if v_turn.status not in ('pending', 'generating') then
    raise exception 'lw_fail_turn_capacity: turn is not in flight' using errcode = '22023';
  end if;

  update public.turns
  set status = 'failed', error_class = 'capacity_reached',
      generation_attempt_count = 0, provider_cost_micros = 0
  where id = p_turn_id;

  update public.usage_counters
  set generation_count = greatest(generation_count - 1, 0), updated_at = now()
  where user_id = v_owner_user_id;

  return jsonb_build_object('status', 'BETA_CAPACITY_REACHED', 'turn_id', p_turn_id);
end;
$$;

revoke execute on function public.lw_fail_turn_capacity(uuid)
  from public, anon, authenticated;
grant execute on function public.lw_fail_turn_capacity(uuid) to service_role;

-- Chat start is the authoritative reservation and idempotency boundary.
-- New/retried failed messages reserve one Chat unit. Pending/completed
-- duplicates never reserve or call the provider again.
create or replace function public.lw_start_chat_generation(
  p_owner_user_id uuid, p_thread_id uuid, p_message_id uuid, p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.character_chat_messages%rowtype;
  v_existing public.character_chat_messages%rowtype;
  v_today date := (timezone('utc', now()))::date;
  v_chat_count integer;
  v_reply jsonb;
begin
  if char_length(btrim(p_content)) not between 1 and 4000 then
    raise exception 'chat message: invalid content' using errcode = '22023';
  end if;
  perform 1 from public.character_chat_threads thread
  join public.player_runs pr on pr.id = thread.player_run_id
  where thread.id = p_thread_id and pr.owner_user_id = p_owner_user_id;
  if not found then
    raise exception 'chat message: thread not owned' using errcode = '42501';
  end if;

  select * into v_existing
  from public.character_chat_messages
  where id = p_message_id
  for update;

  if found then
    if v_existing.thread_id != p_thread_id or v_existing.role != 'player'
      or v_existing.content is distinct from btrim(p_content)
    then
      raise exception 'chat message: idempotency mismatch' using errcode = '22023';
    end if;
    if v_existing.generation_status = 'completed' then
      select to_jsonb(m.*) into v_reply
      from public.character_chat_messages m
      where m.reply_to_message_id = v_existing.id;
      return jsonb_build_object('status', 'completed', 'player_message', to_jsonb(v_existing.*), 'character_message', v_reply);
    end if;
    if v_existing.generation_status = 'pending' then
      return jsonb_build_object('status', 'in_flight', 'player_message', to_jsonb(v_existing.*));
    end if;
  end if;

  insert into public.usage_counters (
    user_id, usage_date, generation_count, chat_generation_count
  ) values (p_owner_user_id, v_today, 0, 0)
  on conflict (user_id) do update set usage_date = v_today
  returning chat_generation_count into v_chat_count;

  if v_chat_count >= 30 then
    return jsonb_build_object(
      'status', 'CHAT_ALLOWANCE_EXHAUSTED',
      'reset_at', (v_today + 1)::timestamptz
    );
  end if;

  update public.usage_counters
  set chat_generation_count = chat_generation_count + 1, updated_at = now()
  where user_id = p_owner_user_id;

  if v_existing.id is null then
    insert into public.character_chat_messages(
      id, thread_id, role, content, generation_status
    ) values (p_message_id, p_thread_id, 'player', btrim(p_content), 'pending')
    returning * into v_message;
  else
    update public.character_chat_messages
    set generation_status = 'pending', error_class = null,
        provider = null, model = null, input_tokens = null,
        output_tokens = null, provider_cost_micros = null, latency_ms = null
    where id = p_message_id
    returning * into v_message;
  end if;

  return jsonb_build_object('status', 'proceed', 'player_message', to_jsonb(v_message.*));
end;
$$;

revoke execute on function public.lw_start_chat_generation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.lw_start_chat_generation(uuid, uuid, uuid, text)
  to service_role;

alter table public.character_chat_messages
  drop constraint character_chat_messages_error_class_check;
alter table public.character_chat_messages
  add constraint character_chat_messages_error_class_check
  check (error_class in (
    'provider_error', 'validation_error', 'transport_error', 'capacity_reached'
  ));

create or replace function public.lw_fail_chat_generation(
  p_owner_user_id uuid, p_player_message_id uuid, p_error_class text,
  p_provider text default null, p_model text default null,
  p_input_tokens integer default null, p_output_tokens integer default null,
  p_provider_cost_micros bigint default null, p_latency_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.character_chat_messages%rowtype;
begin
  if p_error_class not in (
    'provider_error', 'validation_error', 'transport_error', 'capacity_reached'
  ) then
    raise exception 'chat fail: invalid class' using errcode = '22023';
  end if;

  update public.character_chat_messages m
  set generation_status = 'failed', error_class = p_error_class,
      provider = p_provider, model = p_model,
      input_tokens = p_input_tokens, output_tokens = p_output_tokens,
      provider_cost_micros = p_provider_cost_micros, latency_ms = p_latency_ms
  from public.character_chat_threads thread, public.player_runs pr
  where m.id = p_player_message_id and m.role = 'player'
    and m.thread_id = thread.id and thread.player_run_id = pr.id
    and pr.owner_user_id = p_owner_user_id and m.generation_status = 'pending'
  returning m.* into v_message;

  if not found then
    select m.* into v_message
    from public.character_chat_messages m
    join public.character_chat_threads thread on thread.id = m.thread_id
    join public.player_runs pr on pr.id = thread.player_run_id
    where m.id = p_player_message_id and m.role = 'player'
      and pr.owner_user_id = p_owner_user_id and m.generation_status = 'failed';
    if not found then
      raise exception 'chat fail: message not owned or pending' using errcode = '42501';
    end if;
    return to_jsonb(v_message.*);
  end if;

  update public.usage_counters
  set chat_generation_count = greatest(chat_generation_count - 1, 0),
      updated_at = now()
  where user_id = p_owner_user_id;

  return to_jsonb(v_message.*);
end;
$$;

revoke execute on function public.lw_fail_chat_generation(
  uuid, uuid, text, text, text, integer, integer, bigint, integer
) from public, anon, authenticated;
grant execute on function public.lw_fail_chat_generation(
  uuid, uuid, text, text, text, integer, integer, bigint, integer
) to service_role;

-- Private provider budget/telemetry. These tables are not in an exposed
-- schema and contain no Story/Chat text.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.provider_daily_budget (
  usage_date date primary key,
  total_attempts integer not null default 0 check (total_attempts between 0 and 250),
  story_attempts integer not null default 0 check (story_attempts >= 0),
  chat_attempts integer not null default 0 check (chat_attempts >= 0),
  updated_at timestamptz not null default now()
);

create table private.provider_daily_telemetry (
  usage_date date not null,
  provider text not null,
  model text not null,
  story_attempts integer not null default 0 check (story_attempts >= 0),
  chat_attempts integer not null default 0 check (chat_attempts >= 0),
  total_input_tokens bigint not null default 0 check (total_input_tokens >= 0),
  total_output_tokens bigint not null default 0 check (total_output_tokens >= 0),
  total_cost_micros bigint not null default 0 check (total_cost_micros >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, provider, model)
);

create table private.provider_attempts (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null,
  user_id uuid references auth.users(id) on delete set null,
  is_anonymous boolean not null,
  generation_kind text not null check (generation_kind in ('story', 'chat')),
  provider text not null,
  model text not null,
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cost_micros bigint check (cost_micros is null or cost_micros >= 0),
  succeeded boolean
);

create index provider_attempts_user_id_idx
  on private.provider_attempts(user_id);
create index provider_attempts_daily_guests_idx
  on private.provider_attempts(usage_date, is_anonymous, user_id);

revoke all on all tables in schema private from public, anon, authenticated;
grant select, insert, update on private.provider_daily_budget to service_role;
grant select, insert, update on private.provider_daily_telemetry to service_role;
grant select, insert, update on private.provider_attempts to service_role;

create function public.lw_reserve_provider_attempt(
  p_user_id uuid, p_is_anonymous boolean, p_generation_kind text,
  p_provider text, p_model text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_budget private.provider_daily_budget%rowtype;
  v_attempt_id uuid;
begin
  if p_generation_kind not in ('story', 'chat')
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_model), '') is null
    or not exists (select 1 from auth.users where id = p_user_id)
  then
    raise exception 'lw_reserve_provider_attempt: invalid arguments' using errcode = '22023';
  end if;

  insert into private.provider_daily_budget(
    usage_date, total_attempts, story_attempts, chat_attempts
  ) values (
    v_today, 1,
    case when p_generation_kind = 'story' then 1 else 0 end,
    case when p_generation_kind = 'chat' then 1 else 0 end
  )
  on conflict (usage_date) do update
  set total_attempts = private.provider_daily_budget.total_attempts + 1,
      story_attempts = private.provider_daily_budget.story_attempts
        + case when p_generation_kind = 'story' then 1 else 0 end,
      chat_attempts = private.provider_daily_budget.chat_attempts
        + case when p_generation_kind = 'chat' then 1 else 0 end,
      updated_at = now()
  where private.provider_daily_budget.total_attempts < 250
  returning * into v_budget;

  if not found then
    return jsonb_build_object(
      'status', 'BETA_CAPACITY_REACHED',
      'reset_at', (v_today + 1)::timestamptz
    );
  end if;

  insert into private.provider_daily_telemetry(
    usage_date, provider, model, story_attempts, chat_attempts
  ) values (
    v_today, btrim(p_provider), btrim(p_model),
    case when p_generation_kind = 'story' then 1 else 0 end,
    case when p_generation_kind = 'chat' then 1 else 0 end
  )
  on conflict (usage_date, provider, model) do update
  set story_attempts = private.provider_daily_telemetry.story_attempts
        + excluded.story_attempts,
      chat_attempts = private.provider_daily_telemetry.chat_attempts
        + excluded.chat_attempts,
      updated_at = now();

  insert into private.provider_attempts(
    usage_date, user_id, is_anonymous, generation_kind, provider, model
  ) values (
    v_today, p_user_id, p_is_anonymous, p_generation_kind,
    btrim(p_provider), btrim(p_model)
  ) returning id into v_attempt_id;

  return jsonb_build_object(
    'status', 'reserved', 'attempt_id', v_attempt_id,
    'remaining', 250 - v_budget.total_attempts
  );
end;
$$;

create function public.lw_complete_provider_attempt(
  p_attempt_id uuid, p_succeeded boolean,
  p_input_tokens integer default null, p_output_tokens integer default null,
  p_cost_micros bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt private.provider_attempts%rowtype;
begin
  if coalesce(p_input_tokens, 0) < 0 or coalesce(p_output_tokens, 0) < 0
    or coalesce(p_cost_micros, 0) < 0
  then
    raise exception 'lw_complete_provider_attempt: invalid metadata' using errcode = '22023';
  end if;

  select * into v_attempt
  from private.provider_attempts
  where id = p_attempt_id
  for update;
  if not found then
    raise exception 'lw_complete_provider_attempt: attempt not found' using errcode = '22023';
  end if;
  if v_attempt.completed_at is not null then
    return jsonb_build_object('status', 'already_completed');
  end if;

  update private.provider_attempts
  set completed_at = now(), succeeded = p_succeeded,
      input_tokens = p_input_tokens, output_tokens = p_output_tokens,
      cost_micros = p_cost_micros
  where id = p_attempt_id;

  update private.provider_daily_telemetry
  set total_input_tokens = total_input_tokens + coalesce(p_input_tokens, 0),
      total_output_tokens = total_output_tokens + coalesce(p_output_tokens, 0),
      total_cost_micros = total_cost_micros + coalesce(p_cost_micros, 0),
      updated_at = now()
  where usage_date = v_attempt.usage_date
    and provider = v_attempt.provider and model = v_attempt.model;

  return jsonb_build_object('status', 'completed');
end;
$$;

create function public.lw_provider_daily_summary(p_usage_date date default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'usage_date', coalesce(p_usage_date, (timezone('utc', now()))::date),
    'total_attempts', coalesce(b.total_attempts, 0),
    'story_attempts', coalesce(b.story_attempts, 0),
    'chat_attempts', coalesce(b.chat_attempts, 0),
    'remaining_attempts', 250 - coalesce(b.total_attempts, 0),
    'unique_guest_users', (
      select count(distinct a.user_id)
      from private.provider_attempts a
      where a.usage_date = coalesce(p_usage_date, (timezone('utc', now()))::date)
        and a.is_anonymous and a.user_id is not null
    ),
    'providers', coalesce((
      select jsonb_agg(to_jsonb(t.*) order by t.provider, t.model)
      from private.provider_daily_telemetry t
      where t.usage_date = coalesce(p_usage_date, (timezone('utc', now()))::date)
    ), '[]'::jsonb)
  )
  from (select 1) seed
  left join private.provider_daily_budget b
    on b.usage_date = coalesce(p_usage_date, (timezone('utc', now()))::date);
$$;

revoke execute on function public.lw_reserve_provider_attempt(uuid, boolean, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.lw_complete_provider_attempt(uuid, boolean, integer, integer, bigint)
  from public, anon, authenticated;
revoke execute on function public.lw_provider_daily_summary(date)
  from public, anon, authenticated;
grant execute on function public.lw_reserve_provider_attempt(uuid, boolean, text, text, text)
  to service_role;
grant execute on function public.lw_complete_provider_attempt(uuid, boolean, integer, integer, bigint)
  to service_role;
grant execute on function public.lw_provider_daily_summary(date)
  to service_role;

-- Keep Data API access explicit. Browsers can read only their own allowance
-- row through existing RLS; no client role can see/write private telemetry.
grant select (user_id, usage_date, generation_count, chat_generation_count, updated_at)
  on public.usage_counters to authenticated;
