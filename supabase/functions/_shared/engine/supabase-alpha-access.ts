import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AlphaAccessForbiddenError,
  GenerationUnauthenticatedError,
  isAlphaGenerationEnabled,
  type AlphaAccessGate,
} from "./alpha-access.ts";

/** Trusted Edge Function implementation; the browser never receives the service-role key. */
export class SupabaseAlphaAccessGate implements AlphaAccessGate {
  constructor(
    private readonly supabaseUrl: string,
    private readonly anonKey: string,
    private readonly serviceRoleKey: string
  ) {}

  async assertAllowed(userJwt: string): Promise<{ userId: string; isAnonymous: boolean }> {
    const authClient = createClient(this.supabaseUrl, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(userJwt);
    if (userError || !userData.user) {
      throw new GenerationUnauthenticatedError();
    }

    const serviceClient = createClient(this.supabaseUrl, this.serviceRoleKey);
    const { data, error } = await serviceClient
      .from("alpha_generation_access")
      .select("enabled")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    // W4 public-beta policy: a valid anonymous or permanent user is allowed
    // by default. An explicit legacy/admin row with enabled=false is a deny
    // override; enabled=true remains an allow/testing override.
    if (error || (data !== null && !isAlphaGenerationEnabled(data))) {
      throw new AlphaAccessForbiddenError();
    }
    return {
      userId: userData.user.id,
      isAnonymous: userData.user.is_anonymous === true,
    };
  }
}
