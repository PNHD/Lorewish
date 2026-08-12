import { describe, expect, it } from "vitest";

import { ownershipError } from "./ownership-error";

describe("ownershipError (LW-W5-R1-R1 cross-guest error shape)", () => {
  it("maps a 42501 (insufficient_privilege) Postgres error to a literal 'forbidden' message", () => {
    const err = ownershipError({ code: "42501", message: "chat thread: run not owned" }, "fallback");
    expect(err.message).toBe("forbidden");
  });

  it("preserves the original message for any other error code", () => {
    const err = ownershipError({ code: "22023", message: "chat thread: character not visible" }, "fallback");
    expect(err.message).toBe("chat thread: character not visible");
  });

  it("falls back to the provided default when there is no error but also no data", () => {
    const err = ownershipError(null, "chat_thread_failed");
    expect(err.message).toBe("chat_thread_failed");
  });

  it("falls back to the provided default when the error has no message", () => {
    const err = ownershipError({ code: "08000" }, "chat_start_failed");
    expect(err.message).toBe("chat_start_failed");
  });
});
