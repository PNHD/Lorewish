import type { NarrativeProvider } from "./types.ts";

export class AlphaAccessForbiddenError extends Error {
  constructor() {
    super("AI alpha generation access is not enabled for this account");
    this.name = "AlphaAccessForbiddenError";
  }
}

export interface AlphaAccessGate {
  assertAllowed(userJwt: string): Promise<{ userId: string }>;
}

/**
 * Ordering is security-significant: provider construction happens only after
 * the server-side allowlist check succeeds.
 */
export async function authorizeAlphaProvider(
  gate: AlphaAccessGate,
  userJwt: string,
  providerFactory: () => NarrativeProvider
): Promise<NarrativeProvider> {
  await gate.assertAllowed(userJwt);
  return providerFactory();
}

export function mapAlphaAccessError(err: unknown): { status: number; body: { error: string } } | null {
  if (err instanceof AlphaAccessForbiddenError) {
    return { status: 403, body: { error: "alpha_access_required" } };
  }
  return null;
}
