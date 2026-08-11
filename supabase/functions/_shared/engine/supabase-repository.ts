/**
 * TurnRepository implementation backed by a live Supabase project. Deno-only
 * (uses the `npm:@supabase/supabase-js` specifier and a service-role key) —
 * imported only from the submit-turn / replay-branch Edge Functions, never
 * from a test file.
 *
 * Reads use the SERVICE-ROLE client deliberately (trusted server boundary,
 * TECHNICAL_ARCHITECTURE.md §4): rather than depend on whether `service_role`
 * happens to inherit EXECUTE on the internal lw_branch_scene_ids() helper
 * (which is revoked from anon/authenticated and not explicitly re-granted to
 * anyone), branch-scene-history resolution is reimplemented here in
 * TypeScript against direct table reads. This duplicates the SQL helper's
 * logic once, deliberately, rather than taking a dependency on an
 * unconfirmed grant.
 *
 * Every mutating call still goes through the lw_* SECURITY DEFINER RPCs —
 * this file never inserts into scenes/turns/canon_facts directly, even
 * though the service-role key technically could. That would defeat the
 * ownership verification those functions perform.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ActionType, BoundaryKind, ContextCanonFact, ContextCharacter, ContextScene, StorySetup, StructuredGenerationResult } from "./types.ts";
import type { CommitOutcome, ContextInputs, FailOutcome, PrecheckOutcome, SceneRow, TurnRepository } from "./repository.ts";
import { RepositoryForbiddenError, RepositoryValidationError } from "./repository.ts";

/**
 * SQLSTATEs the LW-M2-R2 corrective migration
 * (20260810220000_m2_error_mapping_and_allowance_fix.sql) raises for the two
 * known client-triggerable failures. supabase-js's PostgrestError exposes
 * the raised SQLSTATE as `.code` — translating it here, once, keeps every
 * other RPC error path (a genuine unexpected server fault) falling through
 * to the generic Error branch unchanged.
 */
const SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";
const SQLSTATE_INVALID_PARAMETER_VALUE = "22023";

function throwTypedRpcError(rpcName: string, error: { code?: string; message: string }): never {
  if (error.code === SQLSTATE_INSUFFICIENT_PRIVILEGE) {
    throw new RepositoryForbiddenError(`${rpcName}: not authorized`);
  }
  if (error.code === SQLSTATE_INVALID_PARAMETER_VALUE) {
    throw new RepositoryValidationError(`${rpcName}: invalid request`);
  }
  throw new Error(`${rpcName} failed: ${error.message}`);
}

function toSceneRow(row: Record<string, unknown>): SceneRow {
  return {
    id: row.id as string,
    runBranchId: row.run_branch_id as string,
    seqInBranch: row.seq_in_branch as number,
    boundaryKind: row.boundary_kind as BoundaryKind,
    narrative: row.narrative as string,
    dialogue: (row.dialogue as unknown[]) ?? [],
    stateChangeSummary: (row.state_change_summary as string[]) ?? [],
    nextChoices: (row.next_choices as { id: string; label: string }[]) ?? [],
    structuredOutcome: (row.structured_outcome as Record<string, unknown>) ?? {},
  };
}

export class SupabaseTurnRepository implements TurnRepository {
  private readonly userClient: SupabaseClient;
  private readonly serviceClient: SupabaseClient;

  /**
   * `anonKey` is the project's real publishable/anon API key — required as
   * the client's `apikey` header regardless of which user is calling; the
   * user's own identity is carried entirely by the `Authorization: Bearer
   * <userJwt>` header layered on top via `global.headers`, which is what
   * makes RLS resolve `auth.uid()` to that user. Passing the user's JWT
   * itself as the client "key" (this file's first version did, and it
   * produced "Invalid API key" from every call) is a different, wrong
   * thing — `apikey` and `Authorization` are separate concerns even though
   * both are bearer-token-shaped strings.
   */
  constructor(supabaseUrl: string, anonKey: string, userJwt: string, serviceRoleKey: string) {
    this.userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    this.serviceClient = createClient(supabaseUrl, serviceRoleKey);
  }

  async precheckAndStartTurn(args: {
    turnId: string;
    playerRunId: string | null;
    actionType: ActionType;
    selectedChoiceId: string | null;
    rawAction: string | null;
    storySetup: StorySetup | null;
  }): Promise<PrecheckOutcome> {
    const { data, error } = await this.userClient.rpc("lw_precheck_and_start_turn", {
      p_turn_id: args.turnId,
      p_player_run_id: args.playerRunId,
      p_action_type: args.actionType,
      p_selected_choice_id: args.selectedChoiceId,
      p_raw_action: args.rawAction,
      p_story_setup: args.storySetup
        ? {
            premise: args.storySetup.premise,
            genre: args.storySetup.genre,
            content_language: args.storySetup.contentLanguage,
            story_mode: args.storySetup.storyMode,
            starting_character: args.storySetup.startingCharacter
              ? {
                  name: args.storySetup.startingCharacter.name,
                  identity: args.storySetup.startingCharacter.identity,
                  relationship: args.storySetup.startingCharacter.relationship,
                  address_terms: args.storySetup.startingCharacter.addressTerms
                    ? {
                        speaker_self_reference:
                          args.storySetup.startingCharacter.addressTerms.speakerSelfReference,
                        speaker_addresses_target_as:
                          args.storySetup.startingCharacter.addressTerms.speakerAddressesTargetAs,
                        target_self_reference:
                          args.storySetup.startingCharacter.addressTerms.targetSelfReference,
                        target_addresses_speaker_as:
                          args.storySetup.startingCharacter.addressTerms.targetAddressesSpeakerAs,
                      }
                    : null,
                }
              : null,
          }
        : null,
    });
    if (error) throwTypedRpcError("lw_precheck_and_start_turn", error);

    const status = data.status as string;
    if (status === "proceed") {
      return {
        status: "proceed",
        turnId: data.turn_id,
        playerRunId: data.player_run_id,
        runBranchId: data.run_branch_id,
        sourceSceneId: data.source_scene_id ?? null,
        selectedChoiceLabel: data.selected_choice_label ?? null,
      };
    }
    if (status === "in_flight") return { status: "in_flight", turnId: data.turn_id };
    if (status === "committed") return { status: "committed", turnId: data.turn_id, scene: toSceneRow(data.scene) };
    if (status === "ALLOWANCE_EXHAUSTED") return { status: "ALLOWANCE_EXHAUSTED", resetAt: data.reset_at };
    if (status === "GENERATION_FAILED") {
      return { status: "GENERATION_FAILED", turnId: data.turn_id, errorClass: "input_rejected" };
    }
    throw new Error(`lw_precheck_and_start_turn: unexpected status ${status}`);
  }

  /** Reimplements lw_branch_scene_ids() in TS — see file header for why. */
  private async resolveBranchScenes(runBranchId: string): Promise<Record<string, unknown>[]> {
    type BranchRow = { id: string; parent_branch_id: string | null; fork_scene_id: string | null };
    const chain: BranchRow[] = [];
    let cursor: string | null = runBranchId;
    while (cursor) {
      const { data, error } = await this.serviceClient
        .from("run_branches")
        .select("id, parent_branch_id, fork_scene_id")
        .eq("id", cursor)
        .single();
      if (error || !data) throw new Error(`resolveBranchScenes: branch ${cursor} not found`);
      chain.push(data as BranchRow);
      cursor = (data as BranchRow).parent_branch_id;
    }
    // chain[0] = target branch, chain[last] = root. Compute each ancestor's
    // upper bound from the child directly below it in the chain (needs the
    // fork scene's seq_in_branch — a lookup per ancestor).
    const segments: { branchId: string; upperBoundSeq: number | null }[] = chain.map((branch) => ({
      branchId: branch.id,
      upperBoundSeq: null,
    }));

    for (let idx = 1; idx < chain.length; idx++) {
      const child = chain[idx - 1];
      if (!child.fork_scene_id) continue;
      const { data } = await this.serviceClient
        .from("scenes")
        .select("seq_in_branch")
        .eq("id", child.fork_scene_id)
        .single();
      segments[idx].upperBoundSeq = data ? (data.seq_in_branch as number) : null;
    }

    const allScenes: Record<string, unknown>[] = [];
    // Iterate root-first (reverse of chain order) for chronological output.
    for (let idx = segments.length - 1; idx >= 0; idx--) {
      const seg = segments[idx];
      let query = this.serviceClient.from("scenes").select("*").eq("run_branch_id", seg.branchId);
      if (seg.upperBoundSeq !== null) query = query.lte("seq_in_branch", seg.upperBoundSeq);
      const { data, error } = await query.order("seq_in_branch", { ascending: true });
      if (error) throw new Error(`resolveBranchScenes: ${error.message}`);
      allScenes.push(...((data as Record<string, unknown>[]) ?? []));
    }
    return allScenes;
  }

  async loadContextInputs(playerRunId: string, runBranchId: string): Promise<ContextInputs> {
    const { data: run, error: runError } = await this.serviceClient
      .from("player_runs")
      .select("story_id")
      .eq("id", playerRunId)
      .single();
    if (runError || !run) throw new Error("loadContextInputs: run not found");

    const [{ data: story }, { data: config }, { data: characters }] = await Promise.all([
      this.serviceClient.from("stories").select("*").eq("id", run.story_id).single(),
      this.serviceClient.from("story_configurations").select("*").eq("story_id", run.story_id).maybeSingle(),
      this.serviceClient.from("characters").select("*").eq("story_id", run.story_id),
    ]);

    const sceneRows = await this.resolveBranchScenes(runBranchId);
    const sceneIds = sceneRows.map((s) => s.id as string);

    const { data: runScopeFacts } = await this.serviceClient
      .from("canon_facts")
      .select("*")
      .eq("player_run_id", playerRunId)
      .eq("scope", "run");

    const branchScopeFacts = sceneIds.length
      ? (
          await this.serviceClient
            .from("canon_facts")
            .select("*")
            .eq("player_run_id", playerRunId)
            .eq("scope", "branch")
            .in("source_scene_id", sceneIds)
        ).data ?? []
      : [];

    const allCanonFacts: ContextCanonFact[] = [...(runScopeFacts ?? []), ...branchScopeFacts].map((f) => ({
      scope: f.scope,
      factKey: f.fact_key,
      factText: f.fact_text,
      createdAt: f.created_at,
    }));

    const allScenesOldestFirst: ContextScene[] = sceneRows.map((s) => ({
      seqInBranch: s.seq_in_branch as number,
      boundaryKind: s.boundary_kind as BoundaryKind,
      narrative: s.narrative as string,
      dialogue: (s.dialogue as ContextScene["dialogue"]) ?? [],
      stateChangeSummary: (s.state_change_summary as string[]) ?? [],
      playerAction: null,
    }));

    const contextCharacters: ContextCharacter[] = (characters ?? []).map((c) => {
      const terms = c.address_terms as Record<string, string> | null;
      return {
        name: c.name,
        aliases: c.aliases ?? [],
        description: c.description,
        storyRelationship: c.story_relationship,
        addressTerms: terms
          ? {
              speakerSelfReference: terms.speaker_self_reference,
              speakerAddressesTargetAs: terms.speaker_addresses_target_as,
              targetSelfReference: terms.target_self_reference,
              targetAddressesSpeakerAs: terms.target_addresses_speaker_as,
            }
          : undefined,
      };
    });

    return {
      contentLanguage: story?.content_language ?? "en",
      genre: story?.genre ?? "adventure",
      storyMode: (story?.story_mode as "narrative" | "adventure") ?? "narrative",
      premise: story?.premise ?? "",
      worldSetting: config?.world_setting ?? null,
      playerRole: config?.player_role ?? null,
      tone: (config?.tone as "light" | "balanced" | "dark" | null) ?? null,
      narrativePov: (config?.narrative_pov as ContextInputs["narrativePov"]) ?? null,
      characters: contextCharacters,
      allScenesOldestFirst,
      allCanonFacts,
    };
  }

  async commitTurn(args: {
    turnId: string;
    result: StructuredGenerationResult;
    generationAttemptCount: number;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    latencyMs: number;
  }): Promise<CommitOutcome> {
    const { data, error } = await this.userClient.rpc("lw_commit_turn", {
      p_turn_id: args.turnId,
      p_narrative: args.result.narrative,
      p_dialogue: args.result.dialogue,
      p_state_change_summary: args.result.state_changes,
      p_structured_outcome: args.result.structured_outcome,
      p_next_choices: args.result.next_choices,
      p_boundary_kind: args.result.boundary_kind,
      p_canon_candidates: args.result.canon_candidates,
      p_generation_attempt_count: args.generationAttemptCount,
      p_provider: args.provider,
      p_model: args.model,
      p_input_tokens: args.inputTokens,
      p_output_tokens: args.outputTokens,
      p_provider_cost_micros: args.costMicros,
      p_latency_ms: args.latencyMs,
    });
    if (error) throwTypedRpcError("lw_commit_turn", error);
    return { status: data.status, scene: toSceneRow(data.scene), turnId: data.turn_id };
  }

  async failTurn(args: {
    turnId: string;
    errorClass: "output_blocked" | "unusable_output" | "transport_failure";
    generationAttemptCount: number;
    costMicros: number;
  }): Promise<FailOutcome> {
    const { data, error } = await this.userClient.rpc("lw_fail_turn", {
      p_turn_id: args.turnId,
      p_error_class: args.errorClass,
      p_generation_attempt_count: args.generationAttemptCount,
      p_provider_cost_micros: args.costMicros,
    });
    if (error) throwTypedRpcError("lw_fail_turn", error);
    return { status: "GENERATION_FAILED", turnId: data.turn_id, errorClass: data.error_class };
  }
}
