-- The service_role intentionally has no direct SELECT on auth.users. The
-- provider-attempt table's foreign key is the authoritative existence check,
-- while the Edge Function supplies an identity already verified by Auth.
-- Keep the budget RPC security-invoker and service-only instead of widening
-- auth schema privileges or making this function SECURITY DEFINER.
create or replace function public.lw_reserve_provider_attempt(
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
  if p_user_id is null
    or p_generation_kind not in ('story', 'chat')
    or nullif(btrim(p_provider), '') is null
    or nullif(btrim(p_model), '') is null
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

revoke execute on function public.lw_reserve_provider_attempt(
  uuid, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.lw_reserve_provider_attempt(
  uuid, boolean, text, text, text
) to service_role;
