import { authorizeAlphaProvider, mapAlphaAccessError } from "../_shared/engine/alpha-access.ts";
import { selectCharacterChatProvider } from "../_shared/engine/providers.ts";
import { ChatGenerationError, SupabaseCharacterChatRepository } from "../_shared/engine/supabase-chat-repository.ts";
import { SupabaseAlphaAccessGate } from "../_shared/engine/supabase-alpha-access.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
  const userJwt = authHeader.slice("Bearer ".length);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_misconfigured" }, 500);

  try {
    const repository = new SupabaseCharacterChatRepository(supabaseUrl, anonKey, userJwt, serviceRoleKey);
    if (body.action === "open") {
      if (typeof body.player_run_id !== "string" || typeof body.character_id !== "string") {
        return json({ error: "missing_required_fields" }, 400);
      }
      return json(await repository.open(body.player_run_id, body.character_id));
    }
    if (body.action === "send") {
      if (typeof body.thread_id !== "string" || typeof body.message_id !== "string" || typeof body.content !== "string") {
        return json({ error: "missing_required_fields" }, 400);
      }
      const gate = new SupabaseAlphaAccessGate(supabaseUrl, anonKey, serviceRoleKey);
      const provider = await authorizeAlphaProvider(gate, userJwt, () =>
        selectCharacterChatProvider({ get: (key) => Deno.env.get(key) })
      );
      const result = await repository.send({
        threadId: body.thread_id,
        messageId: body.message_id,
        content: body.content,
        provider,
      });
      return json(result);
    }
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    console.error("[character-chat] error", error);
    const alpha = mapAlphaAccessError(error);
    if (alpha) return json(alpha.body, alpha.status);
    if (error instanceof ChatGenerationError) {
      return json({ error: error.errorClass }, error.errorClass === "validation_error" ? 422 : 502);
    }
    const message = (error as Error).message;
    if (message === "unauthenticated") return json({ error: "unauthenticated" }, 401);
    if (message === "forbidden") return json({ error: "forbidden" }, 403);
    return json({ error: "internal_error" }, 500);
  }
});
