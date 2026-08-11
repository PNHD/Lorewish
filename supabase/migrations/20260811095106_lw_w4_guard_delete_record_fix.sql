-- LW-W4-R1 forward-only repair: DELETE triggers have OLD but no table-shaped
-- NEW record. The W3 runtime-character exception read NEW.origin before
-- checking TG_OP safely, which blocked auth.users -> stories cascades even
-- for probe/empty Stories. Preserve every setup-lock and runtime provenance
-- rule while accessing only the record available for the current operation.
create or replace function public.lw_guard_started_story_setup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
begin
  if tg_table_name = 'characters' and tg_op = 'INSERT' then
    if new.origin = 'runtime' then
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
  end if;

  if tg_table_name = 'stories' then
    v_story_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_story_id := case when tg_op = 'DELETE' then old.story_id else new.story_id end;
  end if;

  if exists (
    select 1
    from public.player_runs pr
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

revoke execute on function public.lw_guard_started_story_setup()
  from public, anon, authenticated, service_role;
