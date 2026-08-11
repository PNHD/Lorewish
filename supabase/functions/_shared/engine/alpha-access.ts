export class AlphaAccessForbiddenError extends Error {
  constructor() {
    super("AI alpha generation access is not enabled for this account");
    this.name = "AlphaAccessForbiddenError";
  }
}

export class GenerationUnauthenticatedError extends Error {
  constructor() {
    super("unauthenticated");
    this.name = "GenerationUnauthenticatedError";
  }
}

export interface AlphaAccessGate {
  assertAllowed(userJwt: string): Promise<{ userId: string; isAnonymous: boolean }>;
}

export function authorizeGenerationUser(
  gate: AlphaAccessGate,
  userJwt: string,
): Promise<{ userId: string; isAnonymous: boolean }> {
  return gate.assertAllowed(userJwt);
}

/** The DEV allowlist is a rollout/cost control, not an age-verification mechanism. */
export function isAlphaGenerationEnabled(row: { enabled?: boolean | null } | null): boolean {
  return row?.enabled === true;
}

/**
 * Ordering is security-significant: provider construction happens only after
 * the server-side allowlist check succeeds.
 */
export async function authorizeAlphaProvider<T>(
  gate: AlphaAccessGate,
  userJwt: string,
  providerFactory: () => T
): Promise<T> {
  await gate.assertAllowed(userJwt);
  return providerFactory();
}

export function mapAlphaAccessError(err: unknown): { status: number; body: { error: string } } | null {
  if (err instanceof GenerationUnauthenticatedError) {
    return { status: 401, body: { error: "unauthenticated" } };
  }
  if (err instanceof AlphaAccessForbiddenError) {
    return { status: 403, body: { error: "alpha_access_required" } };
  }
  return null;
}
