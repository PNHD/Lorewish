import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AlphaAccessForbiddenError,
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

  async assertAllowed(userJwt: string): Promise<{ userId: string }> {
    const authClient = createClient(this.supabaseUrl, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(userJwt);
    if (userError || !userData.user || userData.user.is_anonymous) {
      throw new AlphaAccessForbiddenError();
    }

    const serviceClient = createClient(this.supabaseUrl, this.serviceRoleKey);
    const { data, error } = await serviceClient
      .from("alpha_generation_access")
      .select("enabled")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error || !isAlphaGenerationEnabled(data)) {
      throw new AlphaAccessForbiddenError();
    }
    return { userId: userData.user.id };
  }
}
