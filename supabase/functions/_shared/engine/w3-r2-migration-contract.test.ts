import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260811075526_lw_w3_r2_roleplay_chat_runtime_characters.sql", "utf8");

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
});
