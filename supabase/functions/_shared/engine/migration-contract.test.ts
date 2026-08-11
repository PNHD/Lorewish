import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../migrations/20260811062636_lw_w3_character_memory.sql", import.meta.url),
  "utf8",
);

describe("LW-W3 character-memory migration contract", () => {
  it("extends canon_facts instead of creating a redundant memory table", () => {
    expect(sql).toContain("alter table public.canon_facts");
    expect(sql).not.toMatch(/create\s+table[\s\S]*character_memor/i);
  });

  it("keeps character memories branch-scoped and auditable", () => {
    expect(sql).toContain("scope = 'branch'");
    expect(sql).toContain("supersedes_fact_id uuid references public.canon_facts(id)");
    expect(sql).toContain("canon_facts_memory_retrieval_idx");
  });

  it("validates every character reference before inserting a scene", () => {
    const validation = sql.indexOf("-- Validate all character references before the first canonical write.");
    const sceneInsert = sql.indexOf("insert into public.scenes", validation);
    expect(validation).toBeGreaterThan(-1);
    expect(sceneInsert).toBeGreaterThan(validation);
  });

  it("locks canonical setup after the first generated scene", () => {
    expect(sql).toContain("lw_guard_started_story_setup");
    expect(sql).toContain("story setup is locked after the first generated scene");
    expect(sql).toContain("characters_guard_started_setup");
  });

  it("adds no direct client table write grant", () => {
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on/i);
    expect(sql).toContain("grant execute on function public.lw_commit_turn");
  });
});
