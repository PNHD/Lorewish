#!/usr/bin/env -S node --import tsx
/** DEV-only DeepSeek continuity soak: 8 independent sequences, opening + 3 continuations each. */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DeepSeekNarrativeProvider, type DeepSeekStructuredOutputMode } from "../providers.ts";
import { evaluateGeneratedResult } from "../generation-validation.ts";
import { submitTurn } from "../turn-pipeline.ts";
import { InMemoryTurnRepository } from "../test-support/in-memory-repository.ts";
import {
  ProviderOutputError,
  ProviderTransportError,
  type NarrativeContext,
  type NarrativeProvider,
  type ProviderCallMetadata,
  type ProviderCallResult,
} from "../types.ts";
import { GOLDEN_SET, type GoldenCase } from "./cases.ts";

const HARD_COST_CAP_MICROS = 1_000_000;
const SEQUENCE_CASE_IDS = [
  "en-fantasy-01",
  "en-romance-01",
  "en-adventure-01",
  "en-fantasy-01",
  "vi-fantasy-01",
  "vi-romance-01",
  "vi-adventure-01",
  "vi-romance-01",
] as const;

const FACT_MARKERS: Record<string, string[]> = {
  "en-fantasy-01": ["curse", "founder"],
  "en-romance-01": ["restaurant", "Idris"],
  "en-adventure-01": ["reef", "ship"],
  "vi-fantasy-01": ["ngọc", "kinh đô", "Lâm Vũ"],
  "vi-romance-01": ["sách", "Thảo Chi", "ba tuần"],
  "vi-adventure-01": ["san hô", "tàu", "bão"],
};

interface CallRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  costMicros: number;
  latencyMs: number;
  failureClass: string | null;
  schemaIssues: { path: string; code: string }[];
  qualityFailures: string[];
  actionType: string;
  selectedChoiceLabel: string | null;
  playerAction: string | null;
}

class RecordingProvider implements NarrativeProvider {
  readonly id = "deepseek";
  constructor(private readonly inner: NarrativeProvider, readonly calls: CallRecord[]) {}

  private record(
    context: NarrativeContext,
    metadata: ProviderCallMetadata,
    failureClass: string | null,
    schemaIssues: { path: string; code: string }[] = [],
    qualityFailures: string[] = []
  ) {
    this.calls.push({
      provider: metadata.provider,
      model: metadata.model,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      cacheHitTokens: metadata.cacheHitTokens ?? 0,
      cacheMissTokens: metadata.cacheMissTokens ?? metadata.inputTokens,
      costMicros: metadata.costMicros,
      latencyMs: metadata.latencyMs,
      failureClass,
      schemaIssues,
      qualityFailures,
      actionType: context.actionType,
      selectedChoiceLabel: context.selectedChoiceLabel,
      playerAction: context.playerAction,
    });
  }

  async generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    try {
      const result = await this.inner.generateTurn(context);
      const validation = evaluateGeneratedResult(
        result.result,
        context.contentLanguage,
        context.recentScenes.length === 0 ? context.characters : []
      );
      this.record(
        context,
        result.metadata,
        validation.ok ? null : validation.failureClass,
        validation.schemaIssues,
        validation.qualityFailures
      );
      return result;
    } catch (err) {
      if (err instanceof ProviderOutputError) {
        this.record(context, err.metadata, err.failureKind);
      } else if (err instanceof ProviderTransportError) {
        this.calls.push({
          provider: this.id,
          model: "unknown",
          inputTokens: 0,
          outputTokens: 0,
          cacheHitTokens: 0,
          cacheMissTokens: 0,
          costMicros: 0,
          latencyMs: 0,
          failureClass: err.failureKind,
          schemaIssues: [],
          qualityFailures: [],
          actionType: context.actionType,
          selectedChoiceLabel: context.selectedChoiceLabel,
          playerAction: context.playerAction,
        });
      }
      throw err;
    }
  }
}

function identityPresent(text: string, goldenCase: GoldenCase): boolean {
  const normalized = text.toLocaleLowerCase(goldenCase.language);
  return goldenCase.characterIdentity.every((character) =>
    [character.name, ...character.aliases].some((identity) =>
      normalized.includes(identity.toLocaleLowerCase(goldenCase.language))
    )
  );
}

function prohibitedEnding(text: string): boolean {
  return /\bto be continued\b|còn tiếp|còn nữa|hồi sau/i.test(text);
}

function sceneText(scene: { narrative: string; dialogue: unknown[] }): string {
  const dialogue = (scene.dialogue as { speaker?: string; line?: string }[])
    .flatMap((line) => [line.speaker ?? "", line.line ?? ""])
    .join("\n");
  return `${scene.narrative}\n${dialogue}`;
}

async function main() {
  const outputPath = resolve(process.argv[2] ?? "handoff/LW-M2-R3/continuity-results.json");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is required; load .env.local explicitly");
  const model = process.env.LOREWISH_NARRATIVE_MODEL ?? "deepseek-v4-flash";
  const repairModel = process.env.LOREWISH_NARRATIVE_REPAIR_MODEL ?? model;
  const outputMode = (process.env.LOREWISH_DEEPSEEK_STRUCTURED_OUTPUT ?? "strict_tool") as DeepSeekStructuredOutputMode;
  const results: Record<string, unknown>[] = [];
  const allCalls: CallRecord[] = [];

  for (let sequenceIndex = 0; sequenceIndex < SEQUENCE_CASE_IDS.length; sequenceIndex += 1) {
    const caseId = SEQUENCE_CASE_IDS[sequenceIndex];
    const goldenCase = GOLDEN_SET.find((candidate) => candidate.id === caseId)!;
    const sequenceCalls: CallRecord[] = [];
    const provider = new RecordingProvider(
      new DeepSeekNarrativeProvider(apiKey, model, { structuredOutputMode: outputMode }),
      sequenceCalls
    );
    const repairProvider = new RecordingProvider(
      new DeepSeekNarrativeProvider(apiKey, repairModel, { structuredOutputMode: outputMode }),
      sequenceCalls
    );
    const repo = new InMemoryTurnRepository();
    const scenes: { id: string; runBranchId: string; boundaryKind: string; narrative: string; dialogue: unknown[]; nextChoices: { id: string; label: string }[] }[] = [];
    const checks: Record<string, boolean> = {};
    const turnResults: { turn: string; status: string; calls: number }[] = [];

    const opening = await submitTurn(repo, provider, {
      turnId: randomUUID(),
      playerRunId: null,
      actionType: "start",
      storySetup: {
        premise: `${goldenCase.premise} ${goldenCase.startingSituation}`,
        genre: goldenCase.genre,
        contentLanguage: goldenCase.language,
        storyMode: "narrative",
        tone: "balanced",
        narrativePov: "second_person",
        playerRole: "traveler",
        startingCharacter: {
          name: goldenCase.characterIdentity[0].name,
          role: "canonical starting character",
          description: `${goldenCase.characterIdentity[0].pronounsOrAddress}; ${goldenCase.startingSituation}`,
          relationship: "canonical starting character whose identity must persist",
          aliases: [],
          addressTerms: goldenCase.formsOfAddress,
        },
      },
    }, repairProvider);
    turnResults.push({ turn: "opening", status: opening.status, calls: sequenceCalls.length });
    if (!("scene" in opening)) {
      results.push({ sequence: sequenceIndex + 1, caseId, language: goldenCase.language, passed: false, failure: `opening_${opening.status}` });
      allCalls.push(...sequenceCalls);
      continue;
    }
    scenes.push(opening.scene as typeof scenes[number]);
    const run = [...repo.runs.values()][0];
    const originalBranchId = run.activeBranchId;

    for (let continuation = 1; continuation <= 3; continuation += 1) {
      const current = scenes.at(-1)!;
      const callsBefore = sequenceCalls.length;
      const sceneCountBefore = repo.scenes.size;
      const useChoice = continuation !== 2 && current.nextChoices.length > 0;
      const action = useChoice
        ? {
            actionType: "choice" as const,
            selectedChoiceId: current.nextChoices[0].id,
            rawAction: undefined,
            expectedDelivery: current.nextChoices[0].label,
          }
        : {
            actionType: "custom_action" as const,
            selectedChoiceId: undefined,
            rawAction:
              goldenCase.language === "vi"
                ? `Hỏi ${goldenCase.characterIdentity[0].name} nhắc lại nhiệm vụ hiện tại và hậu quả của quyết định vừa rồi trước khi hành động.`
                : `Ask ${goldenCase.characterIdentity[0].name} to restate the current mission and the consequence of the last decision before acting.`,
            expectedDelivery: null,
          };
      const turn = await submitTurn(repo, provider, {
        turnId: randomUUID(),
        playerRunId: run.id,
        actionType: action.actionType,
        selectedChoiceId: action.selectedChoiceId,
        rawAction: action.rawAction,
      }, repairProvider);
      turnResults.push({ turn: `continuation_${continuation}`, status: turn.status, calls: sequenceCalls.length - callsBefore });
      if (!("scene" in turn)) {
        checks[`continuation_${continuation}_no_partial_commit`] = repo.scenes.size === sceneCountBefore;
        continue;
      }
      scenes.push(turn.scene as typeof scenes[number]);
      const firstCallForTurn = sequenceCalls[callsBefore];
      checks[`continuation_${continuation}_action_delivered`] = useChoice
        ? firstCallForTurn?.selectedChoiceLabel === action.expectedDelivery
        : firstCallForTurn?.playerAction === action.rawAction;
    }

    const texts = scenes.map(sceneText);
    checks.configuredIdentityInOpening = identityPresent(texts[0], goldenCase);
    checks.noProhibitedContinuationCopy = texts.every((text) => !prohibitedEnding(text));
    checks.noRandomTerminalEnding = scenes.every((scene) => scene.boundaryKind !== "ending");
    const combined = texts.join("\n").toLocaleLowerCase(goldenCase.language);
    const customActionScene = scenes[2] ? sceneText(scenes[2]).toLocaleLowerCase(goldenCase.language) : "";
    const factMarkerSurface = (FACT_MARKERS[caseId] ?? []).every((marker) =>
      customActionScene.includes(marker.toLocaleLowerCase(goldenCase.language))
    );
    if (goldenCase.formsOfAddress) {
      const configuredAddressTermsSurface = [
        goldenCase.formsOfAddress.speakerSelfReference,
        goldenCase.formsOfAddress.speakerAddressesTargetAs,
        goldenCase.formsOfAddress.targetSelfReference,
        goldenCase.formsOfAddress.targetAddressesSpeakerAs,
      ].every((term) => combined.includes(term.toLocaleLowerCase("vi")));
    }

    const firstScene = scenes[0];
    const lastOriginalScene = scenes.at(-1)!;
    repo.canonFacts.push({
      id: randomUUID(),
      runId: run.id,
      scope: "branch",
      branchId: originalBranchId,
      factKey: `sequence_${sequenceIndex + 1}_branch_only`,
      factText: "Synthetic branch-only continuity sentinel.",
      sourceSceneId: lastOriginalScene.id,
      createdAt: new Date().toISOString(),
    });
    const { runBranchId: alternateBranchId } = repo.replayFromScene(run.id, firstScene.id);
    const alternateContext = await repo.loadContextInputs(run.id, alternateBranchId);
    checks.crossBranchCanonIsolated = !alternateContext.allCanonFacts.some((fact) =>
      fact.factKey.includes("branch_only")
    );
    checks.oldBranchIntact = repo.branches.has(originalBranchId) && originalBranchId !== alternateBranchId;

    const hardChecksPassed = Object.values(checks).every(Boolean);
    const passed = turnResults.filter((turn) => turn.turn.startsWith("continuation")).length === 3 &&
      turnResults.filter((turn) => turn.turn.startsWith("continuation")).every((turn) =>
        ["CONTINUE_READY", "EXPLICIT_CHECKPOINT"].includes(turn.status)
      ) &&
      hardChecksPassed;
    results.push({
      sequence: sequenceIndex + 1,
      caseId,
      language: goldenCase.language,
      genre: goldenCase.genre,
      openingPlusContinuationTurns: turnResults.length,
      continuationTurns: 3,
      turnResults,
      checks,
      observations: {
        factMarkerSurfaceAfterExplicitMissionPrompt: factMarkerSurface,
        configuredAddressTermsSurface: goldenCase.formsOfAddress
          ? [
              goldenCase.formsOfAddress.speakerSelfReference,
              goldenCase.formsOfAddress.speakerAddressesTargetAs,
              goldenCase.formsOfAddress.targetSelfReference,
              goldenCase.formsOfAddress.targetAddressesSpeakerAs,
            ].every((term) => combined.includes(term.toLocaleLowerCase("vi")))
          : null,
      },
      passed,
      representativeSnippets: scenes.slice(0, 2).map((scene) => scene.narrative.slice(0, 240)),
    });
    allCalls.push(...sequenceCalls);
    const totalCost = allCalls.reduce((sum, call) => sum + call.costMicros, 0);
    if (totalCost > HARD_COST_CAP_MICROS) throw new Error("$1 continuity cost cap exceeded");
    console.log(`[continuity] sequence=${sequenceIndex + 1} case=${caseId} passed=${passed} cost=$${(totalCost / 1_000_000).toFixed(6)}`);
  }

  const continuationTurns = results.reduce(
    (sum, result) => sum + Number(result.continuationTurns ?? 0),
    0
  );
  const report = {
    campaign: "LW-M2-R3_DEEPSEEK_FLASH_CONTINUITY",
    generatedAt: new Date().toISOString(),
    model,
    repairModel,
    structuredOutputMode: outputMode,
    thinkingMode: "disabled",
    syntheticOnly: true,
    sequences: results.length,
    enSequences: results.filter((result) => result.language === "en").length,
    viSequences: results.filter((result) => result.language === "vi").length,
    continuationTurns,
    sequencePass: results.filter((result) => result.passed).length,
    sequenceFailure: results.filter((result) => !result.passed).length,
    providerCalls: allCalls.length,
    repairCalls: results.reduce(
      (sum, result) => sum + ((result.turnResults as { calls: number }[] | undefined) ?? []).reduce((inner, turn) => inner + Math.max(0, turn.calls - 1), 0),
      0
    ),
    inputTokens: allCalls.reduce((sum, call) => sum + call.inputTokens, 0),
    outputTokens: allCalls.reduce((sum, call) => sum + call.outputTokens, 0),
    cacheHitTokens: allCalls.reduce((sum, call) => sum + call.cacheHitTokens, 0),
    cacheMissTokens: allCalls.reduce((sum, call) => sum + call.cacheMissTokens, 0),
    actualCostMicros: allCalls.reduce((sum, call) => sum + call.costMicros, 0),
    actualCostUsd: allCalls.reduce((sum, call) => sum + call.costMicros, 0) / 1_000_000,
    providerHttpErrors: allCalls.filter((call) => call.failureClass === "provider_http").length,
    timeouts: allCalls.filter((call) => call.failureClass === "timeout").length,
    results,
    calls: allCalls,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`[continuity] wrote sanitized report to ${outputPath}`);
}

main().catch((err) => {
  console.error("[continuity] failed:", (err as Error).message);
  process.exitCode = 1;
});
