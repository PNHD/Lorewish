/**
 * In-memory TurnRepository used only by tests. Mirrors the semantics of the
 * real lw_* SQL RPCs (supabase/migrations/20260810190000_m2_story_engine_schema.sql)
 * closely enough to exercise the turn-pipeline state machine, idempotency,
 * atomic-failure-leaves-scene-unchanged, and branch/canon isolation
 * behaviour without a live Postgres instance. It is a third implementation
 * of the branch-scene-history algorithm (alongside the SQL function and
 * supabase-repository.ts's TS reimplementation) — kept deliberately close to
 * both so a divergence would show up as a failing test against the shared
 * fixtures in narrative-golden-set, not just an internal inconsistency.
 */

import { randomUUID } from "node:crypto";
import type { ActionType, BoundaryKind, StorySetup, StructuredGenerationResult } from "../types.ts";
import type {
  CommitOutcome,
  ContextInputs,
  FailOutcome,
  PrecheckOutcome,
  SceneRow,
  TurnRepository,
} from "../repository.ts";
import { RepositoryForbiddenError, RepositoryValidationError } from "../repository.ts";

interface Run {
  id: string;
  activeBranchId: string;
  status: "active" | "completed";
  storySetup: StorySetup;
  startingCharacterId: string | null;
}

interface Branch {
  id: string;
  runId: string;
  parentBranchId: string | null;
  forkSceneId: string | null;
  branchSeq: number;
}

interface Scene {
  id: string;
  branchId: string;
  seqInBranch: number;
  boundaryKind: BoundaryKind;
  narrative: string;
  dialogue: unknown[];
  stateChangeSummary: string[];
  nextChoices: { id: string; label: string }[];
  structuredOutcome: Record<string, unknown>;
}

interface Turn {
  id: string;
  runId: string;
  branchId: string;
  sourceSceneId: string | null;
  actionType: ActionType;
  status: "generating" | "committed" | "failed";
  resultSceneId: string | null;
  errorClass: string | null;
}

interface CanonFact {
  id: string;
  runId: string;
  scope: "run" | "branch";
  branchId: string | null;
  factKey: string;
  factText: string;
  sourceSceneId: string | null;
  createdAt: string;
  characterId?: string;
  memoryType?: "player_fact" | "character_fact" | "relationship_fact" | "shared_event" | "promise" | "discovery";
  salience?: number;
  supersedesFactId?: string | null;
}

export class InMemoryTurnRepository implements TurnRepository {
  runs = new Map<string, Run>();
  branches = new Map<string, Branch>();
  scenes = new Map<string, Scene>();
  turns = new Map<string, Turn>();
  canonFacts: CanonFact[] = [];
  private dailyCap = 30;
  private generationCount = 0;
  commitHistory: {
    turnId: string;
    generationAttemptCount: number;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
    latencyMs: number;
  }[] = [];
  failHistory: {
    turnId: string;
    errorClass: string;
    generationAttemptCount: number;
    costMicros: number;
  }[] = [];
  /** Test hook: force ALLOWANCE_EXHAUSTED without submitting 30 turns. */
  forceAllowanceExhausted = false;

  private resolveBranchSceneIds(branchId: string): string[] {
    const chain: Branch[] = [];
    let cursor: string | null = branchId;
    while (cursor) {
      const b = this.branches.get(cursor);
      if (!b) throw new Error(`branch ${cursor} not found`);
      chain.push(b);
      cursor = b.parentBranchId;
    }
    const segments = chain.map((b, idx) => {
      if (idx === 0) return { branchId: b.id, upperBoundSeq: null as number | null };
      const child = chain[idx - 1];
      const forkScene = child.forkSceneId ? this.scenes.get(child.forkSceneId) : undefined;
      return { branchId: b.id, upperBoundSeq: forkScene ? forkScene.seqInBranch : null };
    });
    const ids: string[] = [];
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const sceneList = [...this.scenes.values()]
        .filter((s) => s.branchId === seg.branchId)
        .filter((s) => seg.upperBoundSeq === null || s.seqInBranch <= seg.upperBoundSeq)
        .sort((a, b) => a.seqInBranch - b.seqInBranch);
      ids.push(...sceneList.map((s) => s.id));
    }
    return ids;
  }

  private toSceneRow(s: Scene): SceneRow {
    return {
      id: s.id,
      runBranchId: s.branchId,
      seqInBranch: s.seqInBranch,
      boundaryKind: s.boundaryKind,
      narrative: s.narrative,
      dialogue: s.dialogue,
      stateChangeSummary: s.stateChangeSummary,
      nextChoices: s.nextChoices,
      structuredOutcome: s.structuredOutcome,
    };
  }

  async precheckAndStartTurn(args: {
    turnId: string;
    playerRunId: string | null;
    actionType: ActionType;
    selectedChoiceId: string | null;
    rawAction: string | null;
    storySetup: StorySetup | null;
  }): Promise<PrecheckOutcome> {
    const existing = this.turns.get(args.turnId);
    if (existing) {
      if (existing.status === "committed") {
        const scene = this.scenes.get(existing.resultSceneId!)!;
        return { status: "committed", turnId: existing.id, scene: this.toSceneRow(scene) };
      }
      if (existing.status === "failed") {
        return { status: "GENERATION_FAILED", turnId: existing.id, errorClass: "input_rejected" };
      }
      return { status: "in_flight", turnId: existing.id };
    }

    let runId = args.playerRunId;
    let branchId: string;
    let selectedChoiceLabel: string | null = null;

    if (!runId) {
      if (!args.storySetup) throw new Error("storySetup required to start a new run");
      runId = randomUUID();
      branchId = randomUUID();
      this.branches.set(branchId, { id: branchId, runId, parentBranchId: null, forkSceneId: null, branchSeq: 0 });
      this.runs.set(runId, {
        id: runId,
        activeBranchId: branchId,
        status: "active",
        storySetup: args.storySetup,
        startingCharacterId: args.storySetup.startingCharacter ? randomUUID() : null,
      });
    } else {
      const run = this.runs.get(runId);
      // Mirrors lw_precheck_and_start_turn's "run not found or not owned by
      // caller" branch (supabase-repository.ts / the LW-M2-R2 migration) —
      // this fake has no separate caller-identity concept, so "run does not
      // exist in this repository" is the reachable analog of "not this
      // caller's run". Real cross-user ownership is exercised live (see
      // handoff/LW-M2-R1/rls-test-results.txt), not by this in-memory double.
      if (!run) throw new RepositoryForbiddenError("run not found or not owned by caller");
      branchId = run.activeBranchId;
      const inFlight = [...this.turns.values()].some(
        (t) => t.branchId === branchId && t.status === "generating"
      );
      if (inFlight) throw new Error("a turn is already in flight on this run");
    }

    const sceneIds = this.resolveBranchSceneIds(branchId);
    const sourceSceneId = sceneIds.length ? sceneIds[sceneIds.length - 1] : null;

    if (args.actionType === "choice" && sourceSceneId) {
      const scene = this.scenes.get(sourceSceneId)!;
      const valid = scene.nextChoices.some((c) => c.id === args.selectedChoiceId);
      if (!valid) {
        throw new RepositoryValidationError(`selected_choice_id ${args.selectedChoiceId} is not a current choice`);
      }
      selectedChoiceLabel = scene.nextChoices.find((c) => c.id === args.selectedChoiceId)?.label ?? null;
    }

    if (this.forceAllowanceExhausted || this.generationCount >= this.dailyCap) {
      return { status: "ALLOWANCE_EXHAUSTED", resetAt: new Date(Date.now() + 86400000).toISOString() };
    }

    if (args.rawAction?.includes("__SIMULATE_INPUT_REJECTED__")) {
      this.turns.set(args.turnId, {
        id: args.turnId,
        runId,
        branchId,
        sourceSceneId,
        actionType: args.actionType,
        status: "failed",
        resultSceneId: null,
        errorClass: "input_rejected",
      });
      return { status: "GENERATION_FAILED", turnId: args.turnId, errorClass: "input_rejected" };
    }

    this.turns.set(args.turnId, {
      id: args.turnId,
      runId,
      branchId,
      sourceSceneId,
      actionType: args.actionType,
      status: "generating",
      resultSceneId: null,
      errorClass: null,
    });

    return {
      status: "proceed",
      turnId: args.turnId,
      playerRunId: runId,
      runBranchId: branchId,
      sourceSceneId,
      selectedChoiceLabel,
    };
  }

  async loadContextInputs(playerRunId: string, runBranchId: string): Promise<ContextInputs> {
    const run = this.runs.get(playerRunId)!;
    const sceneIds = this.resolveBranchSceneIds(runBranchId);
    const allScenesOldestFirst = sceneIds.map((id) => {
      const s = this.scenes.get(id)!;
      return {
        seqInBranch: s.seqInBranch,
        boundaryKind: s.boundaryKind,
        narrative: s.narrative,
        dialogue: s.dialogue as never[],
        stateChangeSummary: s.stateChangeSummary,
        playerAction: null,
      };
    });

    const runScope = this.canonFacts.filter((f) => f.runId === playerRunId && f.scope === "run" && !f.characterId);
    const branchScope = this.canonFacts.filter(
      (f) => f.runId === playerRunId && f.scope === "branch" && !f.characterId && f.sourceSceneId && sceneIds.includes(f.sourceSceneId)
    );
    const visibleMemories = this.canonFacts.filter(
      (f) => f.runId === playerRunId && Boolean(f.characterId) && f.sourceSceneId && sceneIds.includes(f.sourceSceneId)
    );
    const supersededMemoryIds = new Set(
      visibleMemories.map((memory) => memory.supersedesFactId).filter((id): id is string => Boolean(id))
    );

    return {
      contentLanguage: run.storySetup.contentLanguage,
      genre: run.storySetup.genre,
      storyMode: run.storySetup.storyMode,
      premise: run.storySetup.premise,
      worldSetting: run.storySetup.worldSetting ?? null,
      playerRole: run.storySetup.playerRole,
      playerName: run.storySetup.playerName ?? null,
      playerDescription: run.storySetup.playerDescription ?? null,
      tone: run.storySetup.tone,
      narrativePov: run.storySetup.narrativePov,
      characters: run.storySetup.startingCharacter
        ? [
            {
              id: run.startingCharacterId!,
              name: run.storySetup.startingCharacter.name,
              aliases: run.storySetup.startingCharacter.aliases,
              role: run.storySetup.startingCharacter.role,
              description: run.storySetup.startingCharacter.description ?? null,
              storyRelationship: run.storySetup.startingCharacter.relationship,
              addressTerms: run.storySetup.startingCharacter.addressTerms,
            },
          ]
        : [],
      allScenesOldestFirst,
      allCanonFacts: [...runScope, ...branchScope].map((f) => ({
        id: f.id,
        scope: f.scope,
        factKey: f.factKey,
        factText: f.factText,
        createdAt: f.createdAt,
      })),
      allCharacterMemories: visibleMemories
        .filter((memory) => !supersededMemoryIds.has(memory.id))
        .map((memory) => ({
          id: memory.id,
          characterId: memory.characterId!,
          characterName: run.storySetup.startingCharacter?.name ?? "Unknown character",
          memoryType: memory.memoryType!,
          factKey: memory.factKey,
          factText: memory.factText,
          salience: memory.salience!,
          supersedesFactId: memory.supersedesFactId ?? null,
          createdAt: memory.createdAt,
        })),
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
    this.commitHistory.push({ ...args });
    const turn = this.turns.get(args.turnId);
    if (!turn) throw new Error("turn not found");
    if (turn.status === "committed") {
      const scene = this.scenes.get(turn.resultSceneId!)!;
      return {
        status: scene.boundaryKind === "ending" ? "TERMINAL_ENDING" : scene.boundaryKind === "checkpoint" ? "EXPLICIT_CHECKPOINT" : "CONTINUE_READY",
        scene: this.toSceneRow(scene),
        turnId: turn.id,
      };
    }
    if (turn.status !== "generating") throw new Error(`turn ${args.turnId} is not committable (status=${turn.status})`);
    if (
      args.result.character_memory_candidates.some(
        (candidate) => candidate.character_id !== this.runs.get(turn.runId)?.startingCharacterId
      )
    ) {
      throw new Error("character memory references a character outside this run's Story");
    }

    const existingSeqs = [...this.scenes.values()].filter((s) => s.branchId === turn.branchId).map((s) => s.seqInBranch);
    const nextSeq = existingSeqs.length ? Math.max(...existingSeqs) + 1 : 0;
    const sceneId = randomUUID();
    const scene: Scene = {
      id: sceneId,
      branchId: turn.branchId,
      seqInBranch: nextSeq,
      boundaryKind: args.result.boundary_kind,
      narrative: args.result.narrative,
      dialogue: args.result.dialogue,
      stateChangeSummary: args.result.state_changes,
      nextChoices: args.result.next_choices,
      structuredOutcome: args.result.structured_outcome,
    };
    this.scenes.set(sceneId, scene);

    for (const candidate of args.result.canon_candidates) {
      this.canonFacts.push({
        id: randomUUID(),
        runId: turn.runId,
        scope: candidate.scope,
        branchId: candidate.scope === "branch" ? turn.branchId : null,
        factKey: candidate.fact_key,
        factText: candidate.fact_text,
        sourceSceneId: sceneId,
        createdAt: new Date().toISOString(),
      });
    }

    for (const candidate of args.result.character_memory_candidates) {
      const visibleSceneIds = this.resolveBranchSceneIds(turn.branchId);
      const visibleForKey = this.canonFacts
        .filter(
          (fact) =>
            fact.runId === turn.runId &&
            fact.characterId === candidate.character_id &&
            fact.factKey === candidate.fact_key &&
            fact.sourceSceneId &&
            visibleSceneIds.includes(fact.sourceSceneId)
        );
      const alreadySuperseded = new Set(
        visibleForKey.map((fact) => fact.supersedesFactId).filter((id): id is string => Boolean(id))
      );
      const previous = visibleForKey.filter((fact) => !alreadySuperseded.has(fact.id)).at(-1);
      this.canonFacts.push({
        id: randomUUID(),
        runId: turn.runId,
        scope: "branch",
        branchId: turn.branchId,
        factKey: candidate.fact_key,
        factText: candidate.fact_text,
        sourceSceneId: sceneId,
        createdAt: new Date(Date.now() + this.canonFacts.length).toISOString(),
        characterId: candidate.character_id,
        memoryType: candidate.memory_type,
        salience: candidate.salience,
        supersedesFactId: previous?.id ?? null,
      });
    }

    turn.status = "committed";
    turn.resultSceneId = sceneId;

    const run = this.runs.get(turn.runId)!;
    if (args.result.boundary_kind === "ending") run.status = "completed";

    this.generationCount += 1;

    return {
      status: scene.boundaryKind === "ending" ? "TERMINAL_ENDING" : scene.boundaryKind === "checkpoint" ? "EXPLICIT_CHECKPOINT" : "CONTINUE_READY",
      scene: this.toSceneRow(scene),
      turnId: turn.id,
    };
  }

  async failTurn(args: {
    turnId: string;
    errorClass: "output_blocked" | "unusable_output" | "transport_failure";
    generationAttemptCount: number;
    costMicros: number;
  }): Promise<FailOutcome> {
    this.failHistory.push({ ...args });
    const turn = this.turns.get(args.turnId);
    if (!turn) throw new Error("turn not found");
    if (turn.status === "committed") throw new Error("cannot fail a committed turn");
    turn.status = "failed";
    turn.errorClass = args.errorClass;
    return { status: "GENERATION_FAILED", turnId: turn.id, errorClass: args.errorClass };
  }

  getGenerationCount(): number {
    return this.generationCount;
  }

  /** Test helper: "Replay from here", mirroring lw_replay_from_scene. */
  replayFromScene(playerRunId: string, sourceSceneId: string): { runBranchId: string } {
    const scene = this.scenes.get(sourceSceneId);
    if (!scene) throw new Error("scene not found");
    const sourceBranch = this.branches.get(scene.branchId)!;
    const run = this.runs.get(playerRunId)!;
    const siblingSeqs = [...this.branches.values()].filter((b) => b.runId === playerRunId).map((b) => b.branchSeq);
    const nextSeq = siblingSeqs.length ? Math.max(...siblingSeqs) + 1 : 0;
    const newBranchId = randomUUID();
    this.branches.set(newBranchId, {
      id: newBranchId,
      runId: playerRunId,
      parentBranchId: sourceBranch.id,
      forkSceneId: sourceSceneId,
      branchSeq: nextSeq,
    });
    run.activeBranchId = newBranchId;
    return { runBranchId: newBranchId };
  }
}
