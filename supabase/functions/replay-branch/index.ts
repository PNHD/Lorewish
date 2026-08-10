/**
 * POST /functions/v1/replay-branch — "Replay from here"
 * (UX_CONTRACT.md §9, CONTINUOUS_PLAY_CONTRACT.md §6A). A pure state
 * operation: no provider call, no allowance touch. This Edge Function is a
 * thin, authenticated wrapper around lw_replay_from_scene — it exists as an
 * HTTP endpoint (rather than a direct client RPC call) only so the client
 * has one consistent request pattern for every run-mutating action, and so
 * this action is trivially rate-limitable at the same layer as submit-turn
 * if that becomes necessary later.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  if (typeof body.player_run_id !== "string" || typeof body.source_scene_id !== "string") {
    return new Response(JSON.stringify({ error: "missing_required_fields" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  // `anonKey` is the client's `apikey` header; the caller's identity is
  // carried by the separate `Authorization: Bearer <userJwt>` header — see
  // the equivalent comment on SupabaseTurnRepository's constructor.
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });

  const { data, error } = await client.rpc("lw_replay_from_scene", {
    p_player_run_id: body.player_run_id,
    p_source_scene_id: body.source_scene_id,
  });

  if (error) {
    console.error("[replay-branch] rpc error", error);
    return new Response(JSON.stringify({ error: "replay_failed", message: error.message }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
});
