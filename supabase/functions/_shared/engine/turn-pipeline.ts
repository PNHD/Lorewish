/**
 * The turn state machine (CONTINUOUS_PLAY_CONTRACT.md §3): PRECHECK ->
 * GENERATING -> VALIDATING -> COMMITTING -> RESOLVED, with the ONE REPAIR MAX
 * rule from the task brief and NARRATIVE_QUALITY_CONTRACT.md §D wired in.
 *
 * Pure orchestration: takes a TurnRepository (persistence) and a
 * NarrativeProvider (generation) as dependencies, so it can be exercised in
 * tests against the in-memory fake repository and FakeNarrativeProvider
 * without a live database or network call, and reused unmodified by the
 * real submit-turn Edge Function against the Supabase-backed repository.
 */

import { assembleContext } from "./context-assembler.ts";
import { evaluateGeneratedResult, type SanitizedGenerationFailureClass } from "./generation-validation.ts";
import type { TurnRepository } from "./repository.ts";
import {
  type ActionType,
  type NarrativeProvider,
  type ProviderCallMetadata,
  type StorySetup,
  type StructuredGenerationResult,
} from "./types.ts";
import { ProviderOutputError, ProviderTransportError } from "./types.ts";
import { BetaCapacityReachedError } from "./provider-budget.ts";

export interface SubmitTurnRequest {
  turnId: string;
  playerRunId: string | null;
  actionType: ActionType;
  selectedChoiceId?: string | null;
  rawAction?: string | null;
  storySetup?: StorySetup | null;
}

export type SubmitTurnResult =
  | { status: "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING"; scene: unknown; turnId: string }
  | { status: "GENERATION_FAILED"; turnId: string; errorClass: string }
  | { status: "ALLOWANCE_EXHAUSTED"; resetAt: string }
  | { status: "BETA_CAPACITY_REACHED"; resetAt: string }
  | { status: "in_flight"; turnId: string };

/** Provider call result plus whatever validation/quality-gate outcome it produced, for one attempt. */
async function attemptGeneration(
  provider: NarrativeProvider,
  contextInput: Parameters<typeof assembleContext>[0]
): Promise<
  | { ok: true; result: StructuredGenerationResult; metadata: { provider: string; model: string; inputTokens: number; outputTokens: number; costMicros: number; latencyMs: number } }
  | { ok: false; errorClass: "capacity_reached"; resetAt: string; metadata: null }
  | {
      ok: false;
      errorClass: "output_blocked" | "unusable_output" | "transport_failure";
      failureClass: SanitizedGenerationFailureClass;
      repairInstruction: string;
      metadata: ProviderCallMetadata | null;
    }
> {
  const context = assembleContext(contextInput);

  let raw;
  try {
    raw = await provider.generateTurn(context);
  } catch (err) {
    if (err instanceof BetaCapacityReachedError) {
      return {
        ok: false,
        errorClass: "capacity_reached",
        resetAt: err.resetAt,
        metadata: null,
      };
    }
    if (err instanceof ProviderTransportError) {
      return {
        ok: false,
        errorClass: "transport_failure",
        failureClass: err.failureKind,
        repairInstruction: err.failureKind,
        metadata: null,
      };
    }
    if (err instanceof ProviderOutputError) {
      return {
        ok: false,
        errorClass: "unusable_output",
        failureClass: err.failureKind,
        repairInstruction: err.failureKind,
        metadata: err.metadata,
      };
    }
    // LW-M2-R2 fix: any other adapter-level throw (a provider returning a
    // response that could not even be parsed into a candidate `result` —
    // e.g. DeepSeek's response_format=json_object occasionally producing
    // text that isn't valid JSON, found live via the DeepSeek bakeoff) is
    // this provider's own equivalent of "the output was unusable", exactly
    // like a StructuredGenerationResultSchema validation failure below. It
    // must resolve through the same one-repair-then-GENERATION_FAILED path,
    // never propagate uncaught — an uncaught throw here would crash
    // submitTurn entirely instead of resolving to one of
    // CONTINUOUS_PLAY_CONTRACT.md §2's five defined play states. No cost is
    // attributed: the adapter never returned a ProviderCallResult to read a
    // cost from.
    return { ok: false, errorClass: "unusable_output", failureClass: "other", repairInstruction: "other", metadata: null };
  }

  const validation = evaluateGeneratedResult(
    raw.result,
    context.contentLanguage,
    context.recentScenes.length === 0 ? context.characters : [],
    context.characters
  );
  if (!validation.ok) {
    return {
      ok: false,
      errorClass: validation.pipelineErrorClass,
      failureClass: validation.failureClass,
      repairInstruction: validation.repairInstruction,
      metadata: raw.metadata,
    };
  }

  return {
    ok: true,
    result: validation.result,
    metadata: {
      provider: raw.metadata.provider,
      model: raw.metadata.model,
      inputTokens: raw.metadata.inputTokens,
      outputTokens: raw.metadata.outputTokens,
      costMicros: raw.metadata.costMicros,
      latencyMs: raw.metadata.latencyMs,
    },
  };
}

export async function submitTurn(
  repo: TurnRepository,
  provider: NarrativeProvider,
  request: SubmitTurnRequest,
  repairProvider: NarrativeProvider = provider
): Promise<SubmitTurnResult> {
  const precheck = await repo.precheckAndStartTurn({
    turnId: request.turnId,
    playerRunId: request.playerRunId,
    actionType: request.actionType,
    selectedChoiceId: request.selectedChoiceId ?? null,
    rawAction: request.rawAction ?? null,
    storySetup: request.storySetup ?? null,
  });

  if (precheck.status === "in_flight") {
    return { status: "in_flight", turnId: precheck.turnId };
  }
  if (precheck.status === "committed") {
    return { status: sceneStatus(precheck.scene.boundaryKind), scene: precheck.scene, turnId: precheck.turnId };
  }
  if (precheck.status === "ALLOWANCE_EXHAUSTED") {
    return { status: "ALLOWANCE_EXHAUSTED", resetAt: precheck.resetAt };
  }
  if (precheck.status === "GENERATION_FAILED") {
    return { status: "GENERATION_FAILED", turnId: precheck.turnId, errorClass: precheck.errorClass };
  }

  // precheck.status === "proceed" from here on.
  const contextInputs = await repo.loadContextInputs(precheck.playerRunId, precheck.runBranchId);
  const baseContextInput = {
    ...contextInputs,
    actionType: request.actionType,
    playerAction: request.rawAction ?? null,
    selectedChoiceLabel: precheck.selectedChoiceLabel,
    repairReason: null as string | null,
  };

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatencyMs = 0;
  const attemptedModels: string[] = [];
  const accumulate = (metadata: ProviderCallMetadata | null) => {
    if (!metadata) return;
    totalCost += metadata.costMicros;
    totalInputTokens += metadata.inputTokens;
    totalOutputTokens += metadata.outputTokens;
    totalLatencyMs += metadata.latencyMs;
    attemptedModels.push(metadata.model);
  };

  let attempt = await attemptGeneration(provider, baseContextInput);
  let attemptCount = 0;

  if (!attempt.ok && attempt.errorClass === "capacity_reached") {
    await repo.failTurn({
      turnId: request.turnId,
      errorClass: "capacity_reached",
      generationAttemptCount: 0,
      costMicros: 0,
    });
    return { status: "BETA_CAPACITY_REACHED", resetAt: attempt.resetAt };
  }
  attemptCount += 1;

  if (!attempt.ok) {
    accumulate(attempt.metadata);
    if (attempt.errorClass === "transport_failure") {
      // "At most one transparent automatic retry, transport-level failures
      // only, under the same key" (CONTINUOUS_PLAY_CONTRACT.md §8).
      attempt = await attemptGeneration(provider, baseContextInput);
    } else {
      // Quality-gate / moderation failure: at most one automatic repair
      // (NARRATIVE_QUALITY_CONTRACT.md §D), with the failure reason fed back.
      attempt = await attemptGeneration(repairProvider, {
        ...baseContextInput,
        repairReason: attempt.repairInstruction,
      });
    }

    if (!attempt.ok && attempt.errorClass === "capacity_reached") {
      await repo.failTurn({
        turnId: request.turnId,
        errorClass: "capacity_reached",
        generationAttemptCount: attemptCount,
        costMicros: totalCost,
      });
      return { status: "BETA_CAPACITY_REACHED", resetAt: attempt.resetAt };
    }
    attemptCount += 1;
  }

  if (!attempt.ok) {
    accumulate(attempt.metadata);
    const fail = await repo.failTurn({
      turnId: request.turnId,
      errorClass: attempt.errorClass,
      generationAttemptCount: attemptCount,
      costMicros: totalCost,
    });
    return { status: "GENERATION_FAILED", turnId: fail.turnId, errorClass: fail.errorClass };
  }

  accumulate(attempt.metadata);
  const commit = await repo.commitTurn({
    turnId: request.turnId,
    result: attempt.result,
    generationAttemptCount: attemptCount,
    provider: attempt.metadata.provider,
    model: attemptedModels.join(" -> ") || attempt.metadata.model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costMicros: totalCost,
    latencyMs: totalLatencyMs,
  });

  return { status: commit.status, scene: commit.scene, turnId: commit.turnId };
}

function sceneStatus(boundaryKind: string): "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING" {
  if (boundaryKind === "ending") return "TERMINAL_ENDING";
  if (boundaryKind === "checkpoint") return "EXPLICIT_CHECKPOINT";
  return "CONTINUE_READY";
}
