import { authorizeGenerationUser, mapAlphaAccessError } from "../_shared/engine/alpha-access.ts";
import { selectCharacterChatProvider } from "../_shared/engine/providers.ts";
import { ChatAllowanceExhaustedError, ChatGenerationError, SupabaseCharacterChatRepository } from "../_shared/engine/supabase-chat-repository.ts";
import { SupabaseAlphaAccessGate } from "../_shared/engine/supabase-alpha-access.ts";
import { BetaCapacityReachedError, BudgetedCharacterChatProvider } from "../_shared/engine/provider-budget.ts";
import { SupabaseProviderAttemptBudget } from "../_shared/engine/supabase-provider-budget.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, cors: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, CORS_HEADERS, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, CORS_HEADERS, 401);
  const userJwt = authHeader.slice("Bearer ".length);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, CORS_HEADERS, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_misconfigured" }, CORS_HEADERS, 500);

  try {
    const repository = new SupabaseCharacterChatRepository(supabaseUrl, anonKey, userJwt, serviceRoleKey);
    if (body.action === "open") {
      if (typeof body.player_run_id !== "string" || typeof body.character_id !== "string") {
        return json({ error: "missing_required_fields" }, CORS_HEADERS, 400);
      }
      return json(await repository.open(body.player_run_id, body.character_id), CORS_HEADERS);
    }
    if (body.action === "send") {
      if (typeof body.thread_id !== "string" || typeof body.message_id !== "string" || typeof body.content !== "string") {
        return json({ error: "missing_required_fields" }, CORS_HEADERS, 400);
      }
      const configuredProvider = Deno.env.get("LOREWISH_NARRATIVE_PROVIDER");
      const configuredModel = Deno.env.get("LOREWISH_NARRATIVE_MODEL") ?? "deepseek-v4-flash";
      if (configuredProvider !== "deepseek" || configuredModel !== "deepseek-v4-flash") {
        throw new Error("W4 Character Chat requires DeepSeek deepseek-v4-flash");
      }
      const identity = await authorizeGenerationUser(
        new SupabaseAlphaAccessGate(supabaseUrl, anonKey, serviceRoleKey),
        userJwt,
      );
      const provider = new BudgetedCharacterChatProvider({
        ...identity,
        provider: configuredProvider,
        model: configuredModel,
        budget: new SupabaseProviderAttemptBudget(supabaseUrl, serviceRoleKey),
        providerFactory: () => selectCharacterChatProvider({ get: (key) => Deno.env.get(key) }),
      });
      const result = await repository.send({
        threadId: body.thread_id,
        messageId: body.message_id,
        content: body.content,
        provider,
      });
      return json(result, CORS_HEADERS);
    }
    return json({ error: "invalid_action" }, CORS_HEADERS, 400);
  } catch (error) {
    console.error("[character-chat] error", error);
    const alpha = mapAlphaAccessError(error);
    if (alpha) return json(alpha.body, CORS_HEADERS, alpha.status);
    if (error instanceof ChatAllowanceExhaustedError) {
      return json({ error: "chat_allowance_exhausted", reset_at: error.resetAt }, CORS_HEADERS, 429);
    }
    if (error instanceof BetaCapacityReachedError) {
      return json({ error: "beta_capacity_reached", reset_at: error.resetAt }, CORS_HEADERS, 429);
    }
    if (error instanceof ChatGenerationError) {
      return json({ error: error.errorClass }, CORS_HEADERS, error.errorClass === "validation_error" ? 422 : 502);
    }
    const message = (error as Error).message;
    if (message === "unauthenticated") return json({ error: "unauthenticated" }, CORS_HEADERS, 401);
    if (message === "forbidden") return json({ error: "forbidden" }, CORS_HEADERS, 403);
    return json({ error: "internal_error" }, CORS_HEADERS, 500);
  }
});
