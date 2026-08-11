import { getSupabaseClient } from "@/lib/supabase";
import { toCamelScene } from "./story-engine-response";

export { toCamelScene } from "./story-engine-response";

/**
 * Client-side wrapper around the M2 story engine's server boundary
 * (TECHNICAL_ARCHITECTURE.md §3: the client never calls an AI provider
 * directly). Every mutating call goes through the submit-turn / replay-branch
 * Edge Functions; every read goes through the lw_get_run_state RPC, which is
 * SECURITY DEFINER and verifies ownership itself
 * (supabase/migrations/20260810190000_m2_story_engine_schema.sql). This file
 * has no fallback path that writes to scenes/turns/canon_facts directly —
 * there is no grant that would let it succeed.
 */

export type ContentLanguage = "en" | "vi";
export type StoryMode = "narrative" | "adventure";
export type ActionType = "start" | "choice" | "custom_action";

export interface SceneDto {
  id: string;
  runBranchId: string;
  seqInBranch: number;
  boundaryKind: "none" | "checkpoint" | "ending";
  narrative: string;
  dialogue: { speaker: string; line: string }[];
  stateChangeSummary: string[];
  nextChoices: { id: string; label: string }[];
  structuredOutcome: Record<string, unknown>;
}

export type PlayState =
  | { status: "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING"; scene: SceneDto; turnId: string }
  | { status: "GENERATION_FAILED"; turnId: string; errorClass: string }
  | { status: "ALLOWANCE_EXHAUSTED"; resetAt: string }
  | { status: "BETA_CAPACITY_REACHED"; resetAt: string }
  | { status: "in_flight"; turnId: string };

async function functionsUrl(path: string): Promise<string> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
  return `${base}/functions/v1/${path}`;
}

async function requireAccessToken(): Promise<string> {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}

export interface SubmitTurnArgs {
  turnId: string;
  playerRunId: string | null;
  actionType: ActionType;
  selectedChoiceId?: string;
  rawAction?: string;
  storySetup?: {
    premise: string;
    genre: string;
    contentLanguage: ContentLanguage;
    storyMode: StoryMode;
    worldSetting?: string;
    tone: "light" | "balanced" | "dark";
    narrativePov: "first_person" | "second_person" | "third_person";
    playerRole: string;
    playerName?: string;
    playerDescription?: string;
    startingCharacter?: {
      name: string;
      role: string;
      description?: string;
      relationship: string;
      aliases: string[];
      addressTerms?: {
        speakerSelfReference: string;
        speakerAddressesTargetAs: string;
        targetSelfReference: string;
        targetAddressesSpeakerAs: string;
      };
    };
  };
}

export async function submitTurn(args: SubmitTurnArgs): Promise<PlayState & { playerRunId?: string }> {
  const token = await requireAccessToken();
  let response: Response;
  try {
    response = await fetch(await functionsUrl("submit-turn"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        turn_id: args.turnId,
        player_run_id: args.playerRunId,
        action_type: args.actionType,
        selected_choice_id: args.selectedChoiceId ?? null,
        raw_action: args.rawAction ?? null,
        story_setup: args.storySetup ?? null,
      }),
    });
  } catch {
    throw new Error("network_error");
  }

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((json.error as string) ?? `submit-turn failed with HTTP ${response.status}`);
  }

  const status = json.status as string;
  const turnId = (json.turnId ?? json.turn_id) as string;
  if (status === "CONTINUE_READY" || status === "EXPLICIT_CHECKPOINT" || status === "TERMINAL_ENDING") {
    return { status, scene: toCamelScene(json.scene as Record<string, unknown>)!, turnId };
  }
  if (status === "GENERATION_FAILED") {
    return { status, turnId, errorClass: (json.errorClass ?? json.error_class) as string };
  }
  if (status === "ALLOWANCE_EXHAUSTED") {
    return { status, resetAt: (json.resetAt ?? json.reset_at) as string };
  }
  if (status === "BETA_CAPACITY_REACHED") {
    return { status, resetAt: (json.resetAt ?? json.reset_at) as string };
  }
  if (status === "committed") {
    // Idempotent replay of an already-committed turn (precheck short-circuit).
    const scene = toCamelScene(json.scene as Record<string, unknown>)!;
    return {
      status: scene.boundaryKind === "ending" ? "TERMINAL_ENDING" : scene.boundaryKind === "checkpoint" ? "EXPLICIT_CHECKPOINT" : "CONTINUE_READY",
      scene,
      turnId,
    };
  }
  return { status: "in_flight", turnId };
}

export async function replayFromScene(playerRunId: string, sourceSceneId: string): Promise<{ runBranchId: string; scene: SceneDto }> {
  const token = await requireAccessToken();
  const response = await fetch(await functionsUrl("replay-branch"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ player_run_id: playerRunId, source_scene_id: sourceSceneId }),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((json.error as string) ?? `replay-branch failed with HTTP ${response.status}`);
  }
  return { runBranchId: json.run_branch_id as string, scene: toCamelScene(json.scene as Record<string, unknown>)! };
}

export interface RunStateDto {
  playerRunId: string;
  runBranchId: string;
  status: "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING";
  scene: SceneDto | null;
  scenes: SceneDto[];
  storyTitle: string;
  storyPremise: string;
  contentLanguage: ContentLanguage;
  branchSeq: number;
  characters: RunCharacterDto[];
  startingCharacter: { name: string; role: string | null; relationship: string | null } | null;
}

export interface RunCharacterDto {
  id: string;
  name: string;
  role: string | null;
  relationship: string | null;
  description: string | null;
  origin: "authored" | "runtime";
}

export async function getRunState(playerRunId: string): Promise<RunStateDto> {
  const { data, error } = await getSupabaseClient().rpc("lw_get_run_state", { p_player_run_id: playerRunId });
  if (error) throw new Error(error.message);
  const payload = data as Record<string, unknown>;
  const characters = (payload.characters as RunCharacterDto[] | undefined) ?? [];
  return {
    playerRunId,
    runBranchId: payload.run_branch_id as string,
    status: payload.status as RunStateDto["status"],
    scene: toCamelScene(payload.scene as Record<string, unknown>),
    scenes: ((payload.scenes as Record<string, unknown>[] | undefined) ?? [])
      .map((scene) => toCamelScene(scene))
      .filter((scene): scene is SceneDto => Boolean(scene)),
    storyTitle: payload.story_title as string,
    storyPremise: payload.story_premise as string,
    contentLanguage: (payload.content_language as ContentLanguage) ?? "en",
    branchSeq: (payload.branch_seq as number) ?? 0,
    characters,
    startingCharacter: characters[0]
      ? { name: characters[0].name, role: characters[0].role, relationship: characters[0].relationship }
      : null,
  };
}

/** Generates a client-side turn_id, reused across retries of the same intent (CONTINUOUS_PLAY_CONTRACT.md §7). */
export function newTurnId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `turn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
