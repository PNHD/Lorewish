-- Preserve already-spent attempt/cost metadata when the shared budget allows
-- an initial provider call but denies a repair/retry. A denial before the
-- first provider call passes zero/zero and still refunds the Story allowance.
revoke execute on function public.lw_fail_turn_capacity(uuid)
  from public, anon, authenticated, service_role;
drop function public.lw_fail_turn_capacity(uuid);

create function public.lw_fail_turn_capacity(
  p_turn_id uuid,
  p_generation_attempt_count integer,
  p_provider_cost_micros bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_turn public.turns%rowtype;
  v_owner_user_id uuid;
begin
  if p_generation_attempt_count < 0 or p_provider_cost_micros < 0 then
    raise exception 'lw_fail_turn_capacity: invalid accounting' using errcode = '22023';
  end if;

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
      generation_attempt_count = p_generation_attempt_count,
      provider_cost_micros = p_provider_cost_micros
  where id = p_turn_id;

  update public.usage_counters
  set generation_count = greatest(generation_count - 1, 0), updated_at = now()
  where user_id = v_owner_user_id;

  return jsonb_build_object('status', 'BETA_CAPACITY_REACHED', 'turn_id', p_turn_id);
end;
$$;

revoke execute on function public.lw_fail_turn_capacity(uuid, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.lw_fail_turn_capacity(uuid, integer, bigint)
  to service_role;
