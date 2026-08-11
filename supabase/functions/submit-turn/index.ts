/**
 * POST /functions/v1/submit-turn — the one client-facing entry point for
 * every generation-producing turn (start / choice / custom_action).
 * TECHNICAL_ARCHITECTURE.md §3: the client never calls an AI provider
 * directly and never holds a provider key; this Edge Function is the only
 * place that does. See supabase/functions/_shared/engine/turn-pipeline.ts
 * for the actual state machine — this file is thin request/response glue.
 *
 * Auth: requires a real Supabase-authenticated user (the caller's JWT is
 * forwarded to the lw_* RPCs, which resolve auth.uid() from it and verify
 * ownership themselves — this function does not trust any client-supplied
 * user or run id as proof of ownership). No anonymous/guest path exists in
 * M2, per the task brief's ABUSE / COST GATE section — a public repo and a
 * public preview URL make an unauthenticated paid-generation endpoint an
 * unacceptable risk at this stage.
 */

import { submitTurn } from "../_shared/engine/turn-pipeline.ts";
import { SupabaseTurnRepository } from "../_shared/engine/supabase-repository.ts";
import { selectProvider } from "../_shared/engine/providers.ts";
import { mapRepositoryErrorToHttpStatus } from "../_shared/engine/repository.ts";
import { authorizeAlphaProvider, mapAlphaAccessError } from "../_shared/engine/alpha-access.ts";
import { SupabaseAlphaAccessGate } from "../_shared/engine/supabase-alpha-access.ts";
import { ActionTypeSchema, StorySetupSchema } from "../_shared/engine/types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
  const userJwt = authHeader.slice("Bearer ".length);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const req_ = body as Record<string, unknown>;
  const actionType = ActionTypeSchema.safeParse(req_.action_type);
  const storySetup = req_.story_setup == null ? null : StorySetupSchema.safeParse(req_.story_setup);
  if (
    typeof req_.turn_id !== "string" ||
    !actionType.success ||
    (storySetup !== null && !storySetup.success) ||
    (actionType.success && actionType.data === "start" && storySetup === null)
  ) {
    return new Response(JSON.stringify({ error: "missing_required_fields" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  try {
    const gate = new SupabaseAlphaAccessGate(supabaseUrl, anonKey, serviceRoleKey);
    const provider = await authorizeAlphaProvider(gate, userJwt, () => {
      if (!Deno.env.get("LOREWISH_NARRATIVE_PROVIDER")) {
        throw new Error("LOREWISH_NARRATIVE_PROVIDER is required for the AI alpha");
      }
      return selectProvider({ get: (k) => Deno.env.get(k) });
    });
    const repo = new SupabaseTurnRepository(supabaseUrl, anonKey, userJwt, serviceRoleKey);
    const result = await submitTurn(repo, provider, {
      turnId: req_.turn_id as string,
      playerRunId: (req_.player_run_id as string) ?? null,
      actionType: actionType.data,
      selectedChoiceId: (req_.selected_choice_id as string) ?? null,
      rawAction: (req_.raw_action as string) ?? null,
      storySetup: storySetup?.success ? storySetup.data : null,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  } catch (err) {
    // Full error detail is deliberately never returned to the caller here —
    // internal retry/provider/stack detail must not reach a normal user
    // (task brief, GENERATION UX section). Server-side console.error is the
    // only diagnostic surface. The two known, client-triggerable failures
    // (cross-user submission, invalid selected_choice_id) are typed errors
    // from the repository layer and map to a clean 403/400 here instead of
    // falling through to the generic 500 below — see
    // supabase/functions/_shared/engine/repository.ts,
    // mapRepositoryErrorToHttpStatus.
    console.error("[submit-turn] error", err);
    const mappedAlpha = mapAlphaAccessError(err);
    const { status, body } = mappedAlpha ?? mapRepositoryErrorToHttpStatus(err);
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
