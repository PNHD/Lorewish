import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260811075526_lw_w3_r2_roleplay_chat_runtime_characters.sql", "utf8");
const repairSql = readFileSync("supabase/migrations/20260811085819_lw_w3_r2_allowance_double_debit_repair.sql", "utf8");

describe("LW-W3-R2 database authority contract", () => {
  it("keeps post-start authored mutation locked while admitting only provenanced runtime inserts", () => {
    expect(sql).toContain("new.origin = 'runtime'");
    expect(sql).toContain("runtime character provenance is invalid");
    expect(sql).toContain("story setup is locked after the first generated scene");
  });

  it("makes canonical Story/runtime commit server-only", () => {
    expect(sql).toMatch(/revoke execute on function public\.lw_commit_turn[\s\S]*from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.lw_commit_turn[\s\S]*to service_role;/);
  });

  it("binds chat threads to run + branch + character and promotion to exact provenance", () => {
    expect(sql).toContain("unique (player_run_id, run_branch_id, character_id)");
    expect(sql).toContain("source_chat_message_id");
    expect(sql).toContain("source_chat_candidate_index");
    expect(sql).toContain("pr.active_branch_id = thread.run_branch_id");
  });

  it("does not grant browser writes to Chat storage or anonymous inference state", () => {
    expect(sql).toContain("revoke all on public.character_chat_threads, public.character_chat_messages from public, anon, authenticated");
    expect(sql).toContain("grant select on public.character_chat_threads, public.character_chat_messages to authenticated");
    expect(sql).not.toContain("grant insert on public.character_chat_messages to authenticated");
  });

  it("repairs Story allowance accounting without changing the W3-R2 commit authority", () => {
    const commitBody = repairSql.match(
      /create or replace function public\.lw_commit_turn\([\s\S]*?\nend;\n\$\$;/,
    )?.[0];

    expect(commitBody).toBeDefined();
    expect(commitBody).not.toContain("insert into public.usage_counters");
    expect(commitBody).not.toMatch(/update public\.usage_counters\s+set generation_count/);
    expect(repairSql).toMatch(/grant execute on function public\.lw_commit_turn[\s\S]*to service_role;/);
    expect(repairSql).not.toMatch(/grant execute on function public\.lw_commit_turn[\s\S]*to authenticated;/);
  });

  it("rejects a reused Chat message id when canonical content differs", () => {
    expect(repairSql).toContain("v_message.content is distinct from btrim(p_content)");
    expect(repairSql).toContain("chat message: idempotency content mismatch");
    expect(repairSql).toMatch(/grant execute on function public\.lw_start_chat_generation[\s\S]*to service_role;/);
  });
});
