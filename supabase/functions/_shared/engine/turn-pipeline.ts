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
import { moderateOutputText } from "./moderation.ts";
import { runQualityGate } from "./quality-gate.ts";
import type { TurnRepository } from "./repository.ts";
import {
  StructuredGenerationResultSchema,
  type ActionType,
  type NarrativeProvider,
  type StructuredGenerationResult,
} from "./types.ts";
import { ProviderTransportError } from "./types.ts";

export interface SubmitTurnRequest {
  turnId: string;
  playerRunId: string | null;
  actionType: ActionType;
  selectedChoiceId?: string | null;
  rawAction?: string | null;
  storySetup?: {
    premise: string;
    genre: string;
    contentLanguage: string;
    storyMode: "narrative" | "adventure";
  } | null;
}

export type SubmitTurnResult =
  | { status: "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING"; scene: unknown; turnId: string }
  | { status: "GENERATION_FAILED"; turnId: string; errorClass: string }
  | { status: "ALLOWANCE_EXHAUSTED"; resetAt: string }
  | { status: "in_flight"; turnId: string };

/** Provider call result plus whatever validation/quality-gate outcome it produced, for one attempt. */
async function attemptGeneration(
  provider: NarrativeProvider,
  contextInput: Parameters<typeof assembleContext>[0]
): Promise<
  | { ok: true; result: StructuredGenerationResult; metadata: { provider: string; model: string; inputTokens: number; outputTokens: number; costMicros: number; latencyMs: number } }
  | { ok: false; errorClass: "output_blocked" | "unusable_output" | "transport_failure"; costMicros: number }
> {
  const context = assembleContext(contextInput);

  let raw;
  try {
    raw = await provider.generateTurn(context);
  } catch (err) {
    if (err instanceof ProviderTransportError) {
      return { ok: false, errorClass: "transport_failure", costMicros: 0 };
    }
    throw err;
  }

  const parsed = StructuredGenerationResultSchema.safeParse(raw.result);
  if (!parsed.success) {
    return { ok: false, errorClass: "unusable_output", costMicros: raw.metadata.costMicros };
  }

  const moderation = moderateOutputText(parsed.data.narrative);
  if (moderation.blocked) {
    return { ok: false, errorClass: "output_blocked", costMicros: raw.metadata.costMicros };
  }

  const gate = runQualityGate(parsed.data, context.contentLanguage);
  if (!gate.passed) {
    return { ok: false, errorClass: "unusable_output", costMicros: raw.metadata.costMicros };
  }

  return {
    ok: true,
    result: parsed.data,
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
  request: SubmitTurnRequest
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
    selectedChoiceLabel: null, // choice label resolution lives with the source scene; not needed by the fake pipeline path
    repairReason: null as string | null,
  };

  let totalCost = 0;
  let attempt = await attemptGeneration(provider, baseContextInput);
  let attemptCount = 1;

  if (!attempt.ok) {
    totalCost += attempt.costMicros;
    if (attempt.errorClass === "transport_failure") {
      // "At most one transparent automatic retry, transport-level failures
      // only, under the same key" (CONTINUOUS_PLAY_CONTRACT.md §8).
      attempt = await attemptGeneration(provider, baseContextInput);
      attemptCount += 1;
    } else {
      // Quality-gate / moderation failure: at most one automatic repair
      // (NARRATIVE_QUALITY_CONTRACT.md §D), with the failure reason fed back.
      attempt = await attemptGeneration(provider, {
        ...baseContextInput,
        repairReason: attempt.errorClass,
      });
      attemptCount += 1;
    }
  }

  if (!attempt.ok) {
    totalCost += attempt.costMicros;
    const fail = await repo.failTurn({
      turnId: request.turnId,
      errorClass: attempt.errorClass,
      generationAttemptCount: attemptCount,
      costMicros: totalCost,
    });
    return { status: "GENERATION_FAILED", turnId: fail.turnId, errorClass: fail.errorClass };
  }

  totalCost += attempt.metadata.costMicros;
  const commit = await repo.commitTurn({
    turnId: request.turnId,
    result: attempt.result,
    generationAttemptCount: attemptCount,
    provider: attempt.metadata.provider,
    model: attempt.metadata.model,
    inputTokens: attempt.metadata.inputTokens,
    outputTokens: attempt.metadata.outputTokens,
    costMicros: totalCost,
    latencyMs: attempt.metadata.latencyMs,
  });

  return { status: commit.status, scene: commit.scene, turnId: commit.turnId };
}

function sceneStatus(boundaryKind: string): "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING" {
  if (boundaryKind === "ending") return "TERMINAL_ENDING";
  if (boundaryKind === "checkpoint") return "EXPLICIT_CHECKPOINT";
  return "CONTINUE_READY";
}
