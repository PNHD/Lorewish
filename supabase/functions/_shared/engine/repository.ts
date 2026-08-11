/**
 * The persistence boundary the turn pipeline depends on. A real
 * implementation (supabase-repository.ts) calls the lw_* SQL RPCs over
 * supabase-js from the Edge Function. Tests use the in-memory fake below,
 * which mirrors the RPC contracts closely enough to exercise the pipeline's
 * state machine without a live Postgres instance.
 */

import type {
  ActionType,
  BoundaryKind,
  ContextCanonFact,
  ContextCharacter,
  ContextScene,
  StorySetup,
  StructuredGenerationResult,
} from "./types.ts";

export type PrecheckOutcome =
  | {
      status: "proceed";
      turnId: string;
      playerRunId: string;
      runBranchId: string;
      sourceSceneId: string | null;
      selectedChoiceLabel: string | null;
    }
  | { status: "in_flight"; turnId: string }
  | { status: "committed"; turnId: string; scene: SceneRow }
  | { status: "ALLOWANCE_EXHAUSTED"; resetAt: string }
  | { status: "GENERATION_FAILED"; turnId: string; errorClass: "input_rejected" };

export interface SceneRow {
  id: string;
  runBranchId: string;
  seqInBranch: number;
  boundaryKind: BoundaryKind;
  narrative: string;
  dialogue: unknown[];
  stateChangeSummary: string[];
  nextChoices: { id: string; label: string }[];
  structuredOutcome: Record<string, unknown>;
}

export interface CommitOutcome {
  status: "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING";
  scene: SceneRow;
  turnId: string;
}

export interface FailOutcome {
  status: "GENERATION_FAILED";
  turnId: string;
  errorClass: string;
}

export interface ContextInputs {
  contentLanguage: string;
  genre: string;
  storyMode: "narrative" | "adventure";
  premise: string;
  worldSetting: string | null;
  playerRole: string | null;
  tone: "light" | "balanced" | "dark" | null;
  narrativePov: "first_person" | "second_person" | "third_person" | null;
  characters: ContextCharacter[];
  allScenesOldestFirst: ContextScene[];
  allCanonFacts: ContextCanonFact[];
}

/**
 * Raised by a TurnRepository implementation for a client-triggerable
 * authorization failure (e.g. submitting a turn against a run the caller
 * does not own) — distinct from an unexpected server fault, so the Edge
 * Function boundary (see mapRepositoryErrorToHttpStatus below) can answer
 * with a clean 403 instead of a generic 500. LW-M2-R2 fix for a known M2-R1
 * polish issue; see the migration comment in
 * supabase/migrations/20260810220000_m2_error_mapping_and_allowance_fix.sql.
 */
export class RepositoryForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryForbiddenError";
  }
}

/**
 * Raised by a TurnRepository implementation for a client-triggerable
 * input-validation failure (e.g. an invalid/stale selected_choice_id) —
 * mapped to a clean 400 rather than a generic 500. Same fix as
 * RepositoryForbiddenError above.
 */
export class RepositoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryValidationError";
  }
}

/**
 * Pure, runtime-agnostic mapping from a TurnRepository error to the HTTP
 * response an Edge Function should send. Factored out of submit-turn/index.ts
 * (a Deno-only entrypoint that can't be exercised by vitest under Node) so
 * this specific behavior — the actual fix for the two known M2-R1 issues —
 * is unit-testable. Never leaks the underlying error's message/stack to the
 * client; callers should still log the original error server-side.
 */
export function mapRepositoryErrorToHttpStatus(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof RepositoryForbiddenError) {
    return { status: 403, body: { error: "forbidden" } };
  }
  if (err instanceof RepositoryValidationError) {
    return { status: 400, body: { error: "invalid_request" } };
  }
  return { status: 500, body: { error: "internal_error" } };
}

export interface TurnRepository {
  precheckAndStartTurn(args: {
    turnId: string;
    playerRunId: string | null;
    actionType: ActionType;
    selectedChoiceId: string | null;
    rawAction: string | null;
    storySetup: StorySetup | null;
  }): Promise<PrecheckOutcome>;

  loadContextInputs(playerRunId: string, runBranchId: string): Promise<ContextInputs>;

  commitTurn(args: {
    turnId: string;
    result: StructuredGenerationResult;
    generationAttemptCount: number;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    latencyMs: number;
  }): Promise<CommitOutcome>;

  failTurn(args: {
    turnId: string;
    errorClass: "output_blocked" | "unusable_output" | "transport_failure";
    generationAttemptCount: number;
    costMicros: number;
  }): Promise<FailOutcome>;
}
