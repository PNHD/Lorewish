import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) throw new Error("DEV Supabase public configuration is required");
const supabaseUrl: string = url;
const supabasePublishableKey: string = publishableKey;

const probeRun = `lw-w4-isolation-${Date.now()}`;
const makeClient = () => createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jwtPayload(token: string): Record<string, unknown> {
  const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

async function createGuest(client: SupabaseClient) {
  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { lw_probe_run: probeRun } },
  });
  if (error || !data.session || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message}`);
  assert(data.user.is_anonymous === true, "auth user is not anonymous");
  assert(jwtPayload(data.session.access_token).is_anonymous === true, "JWT is_anonymous claim missing");
  return { session: data.session, user: data.user };
}

async function insertStory(client: SupabaseClient, ownerUserId: string, title: string) {
  const { data, error } = await client.from("stories").insert({
    owner_user_id: ownerUserId,
    title,
    premise: "Rollback-safe Guest isolation probe",
    content_language: "en",
    genre: "adventure",
    story_mode: "narrative",
  }).select("id").single();
  if (error || !data) throw new Error(`own Story insert failed: ${error?.message}`);
  return data.id as string;
}

async function main() {
  const guestAClient = makeClient();
  const guestBClient = makeClient();
  const guestA = await createGuest(guestAClient);
  const guestB = await createGuest(guestBClient);

  const { data: profileA, error: profileAError } = await guestAClient
    .from("profiles").select("id, display_name").eq("id", guestA.user.id).single();
  assert(!profileAError && profileA?.id === guestA.user.id, "Guest A profile trigger failed");
  assert(profileA.display_name === null, "Guest profile fabricated a display name");

  const { data: crossProfile } = await guestBClient
    .from("profiles").select("id").eq("id", guestA.user.id);
  assert(crossProfile?.length === 0, "Guest B read Guest A profile");

  const storyA = await insertStory(guestAClient, guestA.user.id, `${probeRun}-A`);
  const storyB = await insertStory(guestBClient, guestB.user.id, `${probeRun}-B`);

  const { data: crossRead } = await guestBClient.from("stories").select("id").eq("id", storyA);
  assert(crossRead?.length === 0, "Guest B read Guest A Story");
  const { data: crossUpdate } = await guestBClient.from("stories").update({ title: "forbidden" }).eq("id", storyA).select("id");
  assert(crossUpdate?.length === 0, "Guest B updated Guest A Story");
  const { error: crossChildError } = await guestBClient.from("story_configurations").insert({
    story_id: storyA,
    player_role: "forbidden attachment",
  });
  assert(Boolean(crossChildError), "Guest B attached child state to Guest A Story");

  const { data: reverseRead } = await guestAClient.from("stories").select("id").eq("id", storyB);
  assert(reverseRead?.length === 0, "Guest A read Guest B Story");

  const noJwt = await fetch(`${supabaseUrl}/functions/v1/submit-turn`, {
    method: "POST", headers: { apikey: supabasePublishableKey, "content-type": "application/json" }, body: "{}",
  });
  assert(noJwt.status === 401, `submit-turn no-JWT status was ${noJwt.status}`);
  const invalidJwt = await fetch(`${supabaseUrl}/functions/v1/character-chat`, {
    method: "POST",
    headers: { apikey: supabasePublishableKey, authorization: "Bearer invalid.jwt.value", "content-type": "application/json" },
    body: JSON.stringify({ action: "send" }),
  });
  assert(invalidJwt.status === 401, `character-chat invalid-JWT status was ${invalidJwt.status}`);

  const { error: budgetRpcError } = await guestAClient.rpc("lw_provider_daily_summary", {});
  assert(Boolean(budgetRpcError), "Guest executed service-only provider summary RPC");
  const { error: alphaReadError } = await guestAClient.from("alpha_generation_access").select("user_id");
  assert(Boolean(alphaReadError), "Guest read alpha admin table");

  await guestAClient.from("stories").delete().eq("id", storyA);
  await guestBClient.from("stories").delete().eq("id", storyB);

  console.log(JSON.stringify({
    status: "W4_LIVE_GUEST_ISOLATION_PASS",
    anonymousSessions: 2,
    profileNullPii: true,
    crossGuestStoryRead: false,
    crossGuestStoryWrite: false,
    crossGuestChildAttach: false,
    noJwtStatus: noJwt.status,
    invalidJwtStatus: invalidJwt.status,
    serviceTelemetryClientAccess: false,
    probeRun,
  }));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
