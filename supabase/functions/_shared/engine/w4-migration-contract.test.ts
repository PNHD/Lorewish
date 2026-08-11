import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260811093214_lw_w4_guest_beta_safety.sql",
  "utf8",
).toLowerCase();
const serviceRoleRepairSql = readFileSync(
  "supabase/migrations/20260811101330_lw_w4_provider_budget_service_role_fix.sql",
  "utf8",
).toLowerCase();

describe("W4 guest beta migration contract", () => {
  it("keeps Guest Story and Chat allowances independent", () => {
    expect(sql).toContain("v_generation_count >= 20");
    expect(sql).toContain("v_chat_count >= 30");
    expect(sql).toContain("chat_generation_count = chat_generation_count + 1");
    expect(sql).toContain("chat_generation_count = greatest(chat_generation_count - 1, 0)");
  });

  it("preserves Story reservation/refund and blocks the old internal RPC from clients", () => {
    expect(sql).toContain("generation_count = greatest(generation_count - 1, 0)");
    expect(sql).toMatch(/revoke execute on function public\.lw_internal_precheck_and_start_turn[\s\S]*?from public, anon, authenticated, service_role/);
  });

  it("atomically hard-caps shared real-provider attempts at 250", () => {
    expect(sql).toContain("total_attempts between 0 and 250");
    expect(sql).toContain("where private.provider_daily_budget.total_attempts < 250");
    expect(sql).toContain("'beta_capacity_reached'");
    expect(sql).toContain("generation_kind in ('story', 'chat')");
  });

  it("keeps provider telemetry private and server-only", () => {
    expect(sql).toContain("create schema if not exists private");
    expect(sql).toContain("revoke all on all tables in schema private from public, anon, authenticated");
    expect(sql).toMatch(/grant execute on function public\.lw_reserve_provider_attempt[\s\S]*?to service_role/);
    expect(sql).not.toContain("raw_player_action text");
  });

  it("keeps anonymous profiles nullable and does not fabricate PII", () => {
    expect(sql).toContain("display_name remains nullable");
    expect(sql).not.toContain("fake email");
  });

  it("lets service-role callers reserve through the authoritative private FK without auth.users reads", () => {
    expect(serviceRoleRepairSql).toContain("p_user_id is null");
    expect(serviceRoleRepairSql).toContain("security invoker");
    expect(serviceRoleRepairSql).not.toContain("select 1 from auth.users");
  });
});
