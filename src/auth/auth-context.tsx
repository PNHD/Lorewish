import type { Session, User } from "@supabase/supabase-js";
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import { ensureGuestSession } from "@/auth/guest-session";

export type AuthStatus = "loading" | "signed_out" | "guest_creating" | "signed_in" | "error";

/**
 * Product-facing error categories, mapped from raw Supabase Auth errors so
 * screens never render Supabase's own error jargon directly (per this
 * task's requirement). Kept small and closed — extend deliberately, not by
 * passing raw error.message through as a fallback for unmapped codes.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_already_exists"
  | "weak_password"
  | "invalid_email"
  | "unknown";

export type AuthActionResult =
  | { kind: "signed_in" }
  | { kind: "check_email" }
  | { kind: "signed_out" }
  | { kind: "error"; code: AuthErrorCode };

function toAuthErrorCode(error: unknown): AuthErrorCode {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message?.toLowerCase() ?? "";

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "user_already_exists";
  }
  if (code === "weak_password" || message.includes("password")) {
    return "weak_password";
  }
  if (code === "email_address_invalid" || (message.includes("invalid") && message.includes("email"))) {
    return "invalid_email";
  }
  return "unknown";
}

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  ensureProductSession: (captchaToken?: string) => Promise<Session>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setStatus(data.session ? "signed_in" : "signed_out");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? "signed_in" : "signed_out");
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,

      async ensureProductSession(captchaToken) {
        if (session) return session;
        setStatus("guest_creating");
        try {
          const nextSession = await ensureGuestSession(getSupabaseClient(), captchaToken);
          setSession(nextSession);
          setStatus("signed_in");
          return nextSession;
        } catch (error) {
          setStatus("error");
          throw error;
        }
      },

      async signUp(email, password) {
        const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
        if (error) return { kind: "error", code: toAuthErrorCode(error) };
        // A session on the response means email confirmation is currently
        // disabled on this project; no session means "check your email" is
        // the correct next state. Either is a valid outcome of the secure
        // default — this branches on what actually happened rather than
        // assuming confirmation is on or off.
        return data.session ? { kind: "signed_in" } : { kind: "check_email" };
      },

      async signIn(email, password) {
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
        if (error) return { kind: "error", code: toAuthErrorCode(error) };
        return { kind: "signed_in" };
      },

      async signOut() {
        const { error } = await getSupabaseClient().auth.signOut();
        if (error) return { kind: "error", code: toAuthErrorCode(error) };
        return { kind: "signed_out" };
      },
    }),
    [status, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
