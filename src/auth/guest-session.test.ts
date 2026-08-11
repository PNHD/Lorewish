import type { Session } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureGuestSession, resetGuestSessionSingleFlightForTests } from "./guest-session";

const session = { access_token: "test", user: { id: "guest-1", is_anonymous: true } } as Session;

afterEach(() => resetGuestSessionSingleFlightForTests());

describe("lazy anonymous session", () => {
  it("reuses an existing session without creating a Guest", async () => {
    const signInAnonymously = vi.fn();
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        signInAnonymously,
      },
    };
    await expect(ensureGuestSession(client)).resolves.toBe(session);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates at most one Guest for concurrent Start clicks", async () => {
    let resolveCreation!: (value: { data: { session: Session }; error: null }) => void;
    const signInAnonymously = vi.fn(() => new Promise<{
      data: { session: Session };
      error: null;
    }>((resolve) => { resolveCreation = resolve; }));
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously,
      },
    };
    const first = ensureGuestSession(client);
    const second = ensureGuestSession(client);
    await vi.waitFor(() => expect(signInAnonymously).toHaveBeenCalledTimes(1));
    resolveCreation({ data: { session }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([session, session]);
  });

  it("passes a CAPTCHA token only when one is available", async () => {
    const signInAnonymously = vi.fn().mockResolvedValue({ data: { session }, error: null });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously,
      },
    };
    await ensureGuestSession(client, "turnstile-token");
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: "turnstile-token" } });
  });
});
