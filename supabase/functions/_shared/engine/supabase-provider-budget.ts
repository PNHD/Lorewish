import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import type {
  ProviderAttemptBudget,
  ProviderAttemptReservation,
} from "./provider-budget.ts";
import type { ProviderCallMetadata } from "./types.ts";

export class SupabaseProviderAttemptBudget implements ProviderAttemptBudget {
  private readonly serviceClient: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.serviceClient = createClient(supabaseUrl, serviceRoleKey);
  }

  async reserve(args: {
    userId: string;
    isAnonymous: boolean;
    generationKind: "story" | "chat";
    provider: string;
    model: string;
  }): Promise<ProviderAttemptReservation> {
    const { data, error } = await this.serviceClient.rpc("lw_reserve_provider_attempt", {
      p_user_id: args.userId,
      p_is_anonymous: args.isAnonymous,
      p_generation_kind: args.generationKind,
      p_provider: args.provider,
      p_model: args.model,
    });
    if (error || !data) {
      throw new Error(`provider budget reservation failed: ${error?.message ?? "empty response"}`);
    }
    if (data.status === "BETA_CAPACITY_REACHED") {
      return { status: "BETA_CAPACITY_REACHED", resetAt: data.reset_at as string };
    }
    return {
      status: "reserved",
      attemptId: data.attempt_id as string,
      remaining: data.remaining as number,
    };
  }

  async complete(args: {
    attemptId: string;
    succeeded: boolean;
    metadata: ProviderCallMetadata | null;
  }): Promise<void> {
    const { error } = await this.serviceClient.rpc("lw_complete_provider_attempt", {
      p_attempt_id: args.attemptId,
      p_succeeded: args.succeeded,
      p_input_tokens: args.metadata?.inputTokens ?? null,
      p_output_tokens: args.metadata?.outputTokens ?? null,
      p_cost_micros: args.metadata?.costMicros ?? null,
    });
    if (error) throw new Error(`provider budget completion failed: ${error.message}`);
  }
}
