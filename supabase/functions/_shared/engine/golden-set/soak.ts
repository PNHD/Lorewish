#!/usr/bin/env -S node --import tsx
/**
 * DEV-only, owner-initiated bounded DeepSeek soak. Never called by CI.
 * Writes sanitized attempt classifications/metrics, not raw provider bodies.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { evaluateGeneratedResult, type SanitizedGenerationFailureClass } from "../generation-validation.ts";
import { DeepSeekNarrativeProvider, type DeepSeekStructuredOutputMode } from "../providers.ts";
import {
  ProviderOutputError,
  ProviderTransportError,
  type NarrativeContext,
  type NarrativeProvider,
  type ProviderCallMetadata,
} from "../types.ts";
import { GOLDEN_SET, type GoldenCase } from "./cases.ts";

const HARD_COST_CAP_MICROS = 1_000_000; // $1 USD
const MAX_TOKENS_PER_CALL = 20_000;
const DEFAULT_RUNS = 8;

interface AttemptRecord {
  caseId: string;
  run: number;
  attempt: "initial" | "repair";
  language: string;
  genre: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  costMicros: number;
  latencyMs: number;
  schemaValid: boolean;
  qualityGatePassed: boolean;
  qualityFailures: string[];
  schemaIssues: { path: string; code: string }[];
  passed: boolean;
  failureClass: SanitizedGenerationFailureClass | null;
  repairInstruction: string | null;
}

function toContext(c: GoldenCase): NarrativeContext {
  return {
    contentLanguage: c.language,
    genre: c.genre,
    storyMode: "narrative",
    premise: c.premise,
    worldSetting: null,
    playerRole: c.playerRole,
    playerName: null,
    playerDescription: null,
    tone: null,
    narrativePov: "second_person",
    characters: c.characterIdentity.map((character, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: character.name,
      aliases: character.aliases,
      role: null,
      description: character.pronounsOrAddress,
      storyRelationship: "canonical starting character",
      addressTerms: c.formsOfAddress,
    })),
    recentScenes: [],
    olderHistorySummary: c.startingSituation,
    characterMemories: [],
    canonFacts: c.expectedInvariantFacts.map((fact, index) => ({
      scope: "run",
      id: `golden-fact-${index}`,
      factKey: `golden_fact_${index}`,
      factText: fact,
      createdAt: new Date(0).toISOString(),
    })),
    actionType: "custom_action",
    playerAction: c.initialDecision,
    selectedChoiceLabel: null,
    repairReason: null,
  };
}

function emptyMetadata(provider: NarrativeProvider): ProviderCallMetadata {
  return {
    provider: provider.id,
    model: "unknown",
    inputTokens: 0,
    outputTokens: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    costMicros: 0,
    latencyMs: 0,
  };
}

async function runAttempt(
  provider: NarrativeProvider,
  goldenCase: GoldenCase,
  context: NarrativeContext,
  run: number,
  attempt: "initial" | "repair"
): Promise<AttemptRecord> {
  let metadata = emptyMetadata(provider);
  try {
    const call = await provider.generateTurn(context);
    metadata = call.metadata;
    const validation = evaluateGeneratedResult(call.result, goldenCase.language, context.characters);
    if (validation.ok) {
      return {
        caseId: goldenCase.id,
        run,
        attempt,
        language: goldenCase.language,
        genre: goldenCase.genre,
        provider: metadata.provider,
        model: metadata.model,
        inputTokens: metadata.inputTokens,
        outputTokens: metadata.outputTokens,
        cacheHitTokens: metadata.cacheHitTokens ?? 0,
        cacheMissTokens: metadata.cacheMissTokens ?? metadata.inputTokens,
        costMicros: metadata.costMicros,
        latencyMs: metadata.latencyMs,
        schemaValid: true,
        qualityGatePassed: true,
        qualityFailures: [],
        schemaIssues: [],
        passed: true,
        failureClass: null,
        repairInstruction: null,
      };
    }
    const schemaValid = ![
      "valid_json_wrong_shape",
      "missing_required_fields",
      "invalid_choices",
    ].includes(validation.failureClass) || validation.qualityFailures.includes("malformed_choices");
    return {
      caseId: goldenCase.id,
      run,
      attempt,
      language: goldenCase.language,
      genre: goldenCase.genre,
      provider: metadata.provider,
      model: metadata.model,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      cacheHitTokens: metadata.cacheHitTokens ?? 0,
      cacheMissTokens: metadata.cacheMissTokens ?? metadata.inputTokens,
      costMicros: metadata.costMicros,
      latencyMs: metadata.latencyMs,
      schemaValid,
      qualityGatePassed: false,
      qualityFailures: validation.qualityFailures,
      schemaIssues: validation.schemaIssues,
      passed: false,
      failureClass: validation.failureClass,
      repairInstruction: validation.repairInstruction,
    };
  } catch (err) {
    let failureClass: SanitizedGenerationFailureClass = "other";
    if (err instanceof ProviderOutputError) {
      metadata = err.metadata;
      failureClass = err.failureKind;
    } else if (err instanceof ProviderTransportError) {
      failureClass = err.failureKind;
    }
    return {
      caseId: goldenCase.id,
      run,
      attempt,
      language: goldenCase.language,
      genre: goldenCase.genre,
      provider: metadata.provider,
      model: metadata.model,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      cacheHitTokens: metadata.cacheHitTokens ?? 0,
      cacheMissTokens: metadata.cacheMissTokens ?? metadata.inputTokens,
      costMicros: metadata.costMicros,
      latencyMs: metadata.latencyMs,
      schemaValid: false,
      qualityGatePassed: false,
      qualityFailures: [],
      schemaIssues: [],
      passed: false,
      failureClass,
      repairInstruction: failureClass,
    };
  }
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)];
}

function latencySummary(values: number[]) {
  return {
    minMs: values.length ? Math.min(...values) : 0,
    medianMs: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: values.length ? Math.max(...values) : 0,
  };
}

function countFailures(attempts: AttemptRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of attempts) {
    if (record.failureClass) counts[record.failureClass] = (counts[record.failureClass] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const runs = Number(process.argv[2] ?? DEFAULT_RUNS);
  const outputPath = resolve(process.argv[3] ?? "handoff/LW-M2-R3/soak-results.json");
  if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error("runs must be an integer from 1 to 20");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is required; load .env.local explicitly");

  const model = process.env.LOREWISH_NARRATIVE_MODEL ?? "deepseek-v4-flash";
  const outputMode = (process.env.LOREWISH_DEEPSEEK_STRUCTURED_OUTPUT ?? "strict_tool") as DeepSeekStructuredOutputMode;
  if (outputMode !== "strict_tool" && outputMode !== "json_object") throw new Error("invalid structured output mode");
  const primary = new DeepSeekNarrativeProvider(apiKey, model, { structuredOutputMode: outputMode });
  const repairModel = process.env.LOREWISH_NARRATIVE_REPAIR_MODEL ?? model;
  const repair = new DeepSeekNarrativeProvider(apiKey, repairModel, { structuredOutputMode: outputMode });

  const requestedCaseIds = (process.env.LOREWISH_SOAK_CASE_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const campaignCases = requestedCaseIds.length
    ? GOLDEN_SET.filter((candidate) => requestedCaseIds.includes(candidate.id))
    : GOLDEN_SET;
  if (campaignCases.length === 0) throw new Error("LOREWISH_SOAK_CASE_IDS matched no Golden Set cases");

  const initialGenerationCount = campaignCases.length * runs;
  const maxCalls = initialGenerationCount * 2;
  // Conservative campaign estimate: every intent repairs, 5k cache-miss input
  // + 2048 output tokens per call at Flash rates. The runtime cap remains $1.
  const estimatedUpperBoundUsd = maxCalls * ((5_000 * 0.14 + 2_048 * 0.28) / 1_000_000);
  console.log(
    `[soak] ${initialGenerationCount} initial generations; max ${maxCalls} calls; conservative Flash upper bound $${estimatedUpperBoundUsd.toFixed(4)}; hard cap $1.0000`
  );

  const checkpointPath = `${outputPath}.checkpoint`;
  let attempts: AttemptRecord[] = [];
  let intents: { caseId: string; run: number; initialPass: boolean; repairRequired: boolean; repairSuccess: boolean; finalPass: boolean }[] = [];
  let totalCostMicros = 0;
  if (process.env.LOREWISH_SOAK_RESUME === "1" && existsSync(checkpointPath)) {
    const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
    attempts = checkpoint.attempts;
    intents = checkpoint.intents;
    totalCostMicros = checkpoint.totalCostMicros;
    console.log(`[soak] resuming from ${intents.length}/${initialGenerationCount} completed intents`);
  }

  for (let run = 1; run <= runs; run += 1) {
    for (const goldenCase of campaignCases) {
      if (intents.some((intent) => intent.run === run && intent.caseId === goldenCase.id)) continue;
      const context = toContext(goldenCase);
      const initial = await runAttempt(primary, goldenCase, context, run, "initial");
      attempts.push(initial);
      totalCostMicros += initial.costMicros;
      if (initial.inputTokens + initial.outputTokens > MAX_TOKENS_PER_CALL) {
        throw new Error(`token explosion guard tripped for ${goldenCase.id} run ${run}`);
      }
      if (totalCostMicros > HARD_COST_CAP_MICROS) throw new Error("$1 DeepSeek hard cost cap exceeded");

      let finalPass = initial.passed;
      let repairSuccess = false;
      if (!initial.passed) {
        const repaired = await runAttempt(
          repair,
          goldenCase,
          { ...context, repairReason: initial.repairInstruction ?? initial.failureClass ?? "other" },
          run,
          "repair"
        );
        attempts.push(repaired);
        totalCostMicros += repaired.costMicros;
        if (repaired.inputTokens + repaired.outputTokens > MAX_TOKENS_PER_CALL) {
          throw new Error(`token explosion guard tripped for repair ${goldenCase.id} run ${run}`);
        }
        if (totalCostMicros > HARD_COST_CAP_MICROS) throw new Error("$1 DeepSeek hard cost cap exceeded");
        repairSuccess = repaired.passed;
        finalPass = repaired.passed;
      }
      intents.push({
        caseId: goldenCase.id,
        run,
        initialPass: initial.passed,
        repairRequired: !initial.passed,
        repairSuccess,
        finalPass,
      });
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(
        checkpointPath,
        JSON.stringify({ model, repairModel, outputMode, runs, attempts, intents, totalCostMicros }, null, 2)
      );
      console.log(
        `[soak] run=${run} case=${goldenCase.id} initial=${initial.passed} repair=${!initial.passed} final=${finalPass} cost=$${(totalCostMicros / 1_000_000).toFixed(6)}`
      );
    }
  }

  const initialAttempts = attempts.filter((attempt) => attempt.attempt === "initial");
  const repairAttempts = attempts.filter((attempt) => attempt.attempt === "repair");
  const byDimension = (key: "language" | "genre") =>
    Object.fromEntries(
      [...new Set(initialAttempts.map((attempt) => attempt[key]))].map((value) => {
        const dimensionAttempts = initialAttempts.filter((attempt) => attempt[key] === value);
        const dimensionIntents = intents.filter((intent) => {
          const source = GOLDEN_SET.find((candidate) => candidate.id === intent.caseId)!;
          return source[key] === value;
        });
        return [
          value,
          {
            initialGenerations: dimensionAttempts.length,
            initialPass: dimensionAttempts.filter((attempt) => attempt.passed).length,
            repairRequired: dimensionIntents.filter((intent) => intent.repairRequired).length,
            finalPass: dimensionIntents.filter((intent) => intent.finalPass).length,
            finalFailure: dimensionIntents.filter((intent) => !intent.finalPass).length,
          },
        ];
      })
    );

  const attemptLatencies = attempts.filter((attempt) => attempt.latencyMs > 0).map((attempt) => attempt.latencyMs);
  const report = {
    campaign: "LW-M2-R3_DEEPSEEK_FLASH_SOAK",
    generatedAt: new Date().toISOString(),
    provider: "deepseek",
    model,
    repairModel,
    structuredOutputMode: outputMode,
    thinkingMode: "disabled",
    syntheticOnly: true,
    hardCostCapUsd: 1,
    estimatedUpperBoundUsd,
    summary: {
      initialGenerations: initialAttempts.length,
      initialPass: initialAttempts.filter((attempt) => attempt.passed).length,
      schemaValidRate: initialAttempts.filter((attempt) => attempt.schemaValid).length / initialAttempts.length,
      qualityGatePassRate: initialAttempts.filter((attempt) => attempt.qualityGatePassed).length / initialAttempts.length,
      repairRequired: repairAttempts.length,
      repairRate: repairAttempts.length / initialAttempts.length,
      repairSuccess: repairAttempts.filter((attempt) => attempt.passed).length,
      finalPass: intents.filter((intent) => intent.finalPass).length,
      finalFailure: intents.filter((intent) => !intent.finalPass).length,
      finalFailureRate: intents.filter((intent) => !intent.finalPass).length / intents.length,
      inputTokens: attempts.reduce((sum, attempt) => sum + attempt.inputTokens, 0),
      outputTokens: attempts.reduce((sum, attempt) => sum + attempt.outputTokens, 0),
      cacheHitTokens: attempts.reduce((sum, attempt) => sum + attempt.cacheHitTokens, 0),
      cacheMissTokens: attempts.reduce((sum, attempt) => sum + attempt.cacheMissTokens, 0),
      actualCostMicros: totalCostMicros,
      actualCostUsd: totalCostMicros / 1_000_000,
      latency: latencySummary(attemptLatencies),
      providerHttpErrors: attempts.filter((attempt) => attempt.failureClass === "provider_http").length,
      timeouts: attempts.filter((attempt) => attempt.failureClass === "timeout").length,
      failureClassesInitial: countFailures(initialAttempts),
      failureClassesRepair: countFailures(repairAttempts),
    },
    byLanguage: byDimension("language"),
    byGenre: byDimension("genre"),
    attempts,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`[soak] wrote sanitized report to ${outputPath}`);
}

main().catch((err) => {
  console.error("[soak] failed:", (err as Error).message);
  process.exitCode = 1;
});
