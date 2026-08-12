/**
 * Maps a Postgres ownership-check failure (SQLSTATE 42501,
 * insufficient_privilege — every cross-owner RPC guard in the character-chat
 * migrations raises this exact code) to the literal "forbidden" message the
 * edge function's catch block already maps to a clean 403 response.
 *
 * Before this, character-chat's `open()`/`send()` fell through to their
 * RPC's raw exception text (e.g. "chat thread: run not owned"), which
 * matched neither "unauthenticated" nor "forbidden" and landed on a generic
 * 500 — access was still correctly denied (no data crossed the guest
 * boundary), just with a worse error shape than the identical check in
 * `loadThread()` already had (LW-W5-R1-R1).
 *
 * Matching on the SQLSTATE rather than the exception message text is
 * deliberate: message wording is free to change in a future migration
 * without silently breaking this mapping again.
 */
export function ownershipError(error: { code?: string; message?: string } | null, fallback: string): Error {
  if (error?.code === "42501") return new Error("forbidden");
  return new Error(error?.message ?? fallback);
}
