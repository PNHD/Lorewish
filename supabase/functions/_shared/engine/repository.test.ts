/**
 * Unit tests for the LW-M2-R2 fix to two known M2-R1 polish issues: cross-user
 * turn submission and an invalid selected_choice_id both used to fall through
 * to a generic HTTP 500 from submit-turn/index.ts. mapRepositoryErrorToHttpStatus
 * is the pure function that fix lives in (factored out specifically so it is
 * testable under vitest/Node without a Deno runtime) — see
 * supabase/migrations/20260810220000_m2_error_mapping_and_allowance_fix.sql
 * for the SQL half of this fix.
 */
import { describe, expect, it } from "vitest";
import {
  RepositoryForbiddenError,
  RepositoryValidationError,
  mapRepositoryErrorToHttpStatus,
} from "./repository.ts";

describe("mapRepositoryErrorToHttpStatus", () => {
  it("maps a cross-user / not-owned authorization failure to a clean 403", () => {
    const { status, body } = mapRepositoryErrorToHttpStatus(
      new RepositoryForbiddenError("lw_precheck_and_start_turn: not authorized")
    );
    expect(status).toBe(403);
    expect(body).toEqual({ error: "forbidden" });
  });

  it("maps an invalid selected_choice_id (or other input-validation) failure to a clean 400", () => {
    const { status, body } = mapRepositoryErrorToHttpStatus(
      new RepositoryValidationError("lw_precheck_and_start_turn: invalid request")
    );
    expect(status).toBe(400);
    expect(body).toEqual({ error: "invalid_request" });
  });

  it("falls back to a generic 500 for an unexpected server-side error, never leaking its message", () => {
    const { status, body } = mapRepositoryErrorToHttpStatus(
      new Error("connection to database lost: fatal internal detail nobody should see")
    );
    expect(status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("fatal internal detail");
  });

  it("falls back to a generic 500 for a thrown non-Error value", () => {
    const { status, body } = mapRepositoryErrorToHttpStatus("a raw string throw, not an Error instance");
    expect(status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
  });
});
