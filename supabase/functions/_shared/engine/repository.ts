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
  StructuredGenerationResult,
} from "./types.ts";

export interface StorySetup {
  premise: string;
  genre: string;
  contentLanguage: string;
  storyMode: "narrative" | "adventure";
}

export type PrecheckOutcome =
  | { status: "proceed"; turnId: string; playerRunId: string; runBranchId: string; sourceSceneId: string | null }
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
