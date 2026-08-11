import type { Session } from "@supabase/supabase-js";

type GuestAuthClient = {
  auth: {
    getSession(): Promise<{ data: { session: Session | null } }>;
    signInAnonymously(credentials?: { options?: { captchaToken?: string } }): Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
  };
};

let guestCreationInFlight: Promise<Session> | null = null;

/**
 * Lazy, process-wide single flight. It never signs out, clears storage, or
 * replaces a valid identity, including after quota exhaustion.
 */
export async function ensureGuestSession(
  client: GuestAuthClient,
  captchaToken?: string,
): Promise<Session> {
  const { data: current } = await client.auth.getSession();
  if (current.session) return current.session;
  if (guestCreationInFlight) return guestCreationInFlight;

  guestCreationInFlight = (async () => {
    // Recheck after joining the single-flight boundary: an auth refresh or
    // another listener may have restored a session since the first read.
    const { data: refreshed } = await client.auth.getSession();
    if (refreshed.session) return refreshed.session;

    const credentials = captchaToken
      ? { options: { captchaToken } }
      : undefined;
    const { data, error } = await client.auth.signInAnonymously(credentials);
    if (error || !data.session) {
      throw new Error(error?.message ?? "guest_session_unavailable");
    }
    return data.session;
  })().finally(() => {
    guestCreationInFlight = null;
  });

  return guestCreationInFlight;
}

export function resetGuestSessionSingleFlightForTests() {
  guestCreationInFlight = null;
}
