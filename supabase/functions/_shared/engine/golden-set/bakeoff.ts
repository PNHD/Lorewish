#!/usr/bin/env -S node --import tsx
/**
 * Model Bakeoff Harness (task brief's MODEL BAKEOFF HARNESS section) —
 * DEV-ONLY, OWNER-INITIATED. Never run automatically in CI (see
 * .github/workflows/ci.yml, which does not invoke this script) and never
 * run on every push. It runs the Narrative Golden Set
 * (golden-set/cases.ts) against one configured provider adapter and
 * produces a compact, comparable report — no API keys or raw secret headers
 * are ever written to the report.
 *
 * Runtime note: this file is intentionally plain, dependency-light
 * TypeScript runnable under Node via `tsx` (no Deno required), even though
 * the engine it exercises also runs inside Deno Edge Functions in
 * production — providers.ts and the rest of _shared/engine/ have no
 * Deno-only or Node-only APIs (fetch, performance.now(), process.env are all
 * accessed through small parameters/abstractions), so the same code path is
 * genuinely exercised here, not a reimplementation.
 *
 * Usage:
 *   npm run bakeoff                       # uses the fake provider (default; no cost)
 *   LOREWISH_NARRATIVE_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm run bakeoff
 */

import { writeFileSync } from "node:fs";
import { GOLDEN_SET, type GoldenCase } from "./cases.ts";
import { selectProvider } from "../providers.ts";
import { runQualityGate } from "../quality-gate.ts";
import { StructuredGenerationResultSchema } from "../types.ts";
import type { NarrativeContext } from "../types.ts";

interface CaseResult {
  caseId: string;
  language: string;
  genre: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostMicros: number;
  schemaValid: boolean;
  qualityGatePassed: boolean;
  qualityFailures: string[];
  repairRequired: boolean;
  finalPass: boolean;
  narrativeSample: string;
  /** Set when the provider itself threw (e.g. an unparseable response) rather than returning a schema-invalid result — LW-M2-R2, found live via DeepSeek. */
  providerErrorNote: string | null;
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
    characters: c.characterIdentity.map((ch, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: ch.name,
      aliases: ch.aliases,
      role: null,
      description: null,
      storyRelationship: null,
      addressTerms: c.formsOfAddress
        ? {
            speakerSelfReference: c.formsOfAddress.speakerSelfReference,
            speakerAddressesTargetAs: c.formsOfAddress.speakerAddressesTargetAs,
            targetSelfReference: c.formsOfAddress.targetSelfReference,
            targetAddressesSpeakerAs: c.formsOfAddress.targetAddressesSpeakerAs,
          }
        : undefined,
    })),
    recentScenes: [],
    olderHistorySummary: c.startingSituation,
    characterMemories: [],
    canonFacts: [],
    actionType: "custom_action",
    playerAction: c.initialDecision,
    selectedChoiceLabel: null,
    repairReason: null,
  };
}

/**
 * Wraps one provider.generateTurn call so a thrown, non-transport adapter
 * error (e.g. DeepSeek's response_format=json_object occasionally producing
 * text that isn't valid JSON — found live) is treated as "no usable result",
 * the harness-level equivalent of turn-pipeline.ts's attemptGeneration fix
 * (see turn-pipeline.ts), instead of crashing the whole bakeoff run.
 */
async function attemptOnce(
  provider: ReturnType<typeof selectProvider>,
  context: NarrativeContext
): Promise<{ raw: Awaited<ReturnType<typeof provider.generateTurn>> | null; errorNote: string | null }> {
  try {
    return { raw: await provider.generateTurn(context), errorNote: null };
  } catch (err) {
    return { raw: null, errorNote: (err as Error).message };
  }
}

async function runCase(provider: ReturnType<typeof selectProvider>, goldenCase: GoldenCase): Promise<CaseResult> {
  const context = toContext(goldenCase);
  let repairRequired = false;

  let attempt = await attemptOnce(provider, context);
  let parsed = attempt.raw ? StructuredGenerationResultSchema.safeParse(attempt.raw.result) : null;
  let gate = parsed?.success ? runQualityGate(parsed.data, goldenCase.language) : { passed: false, failures: ["malformed_choices" as const] };

  if (!parsed?.success || !gate.passed) {
    repairRequired = true;
    const repairReason = attempt.errorNote ?? (parsed?.success ? gate.failures.join(",") : "malformed_output");
    attempt = await attemptOnce(provider, { ...context, repairReason });
    parsed = attempt.raw ? StructuredGenerationResultSchema.safeParse(attempt.raw.result) : null;
    gate = parsed?.success ? runQualityGate(parsed.data, goldenCase.language) : { passed: false, failures: ["malformed_choices" as const] };
  }

  const raw = attempt.raw;
  return {
    caseId: goldenCase.id,
    language: goldenCase.language,
    genre: goldenCase.genre,
    provider: raw?.metadata.provider ?? provider.id,
    model: raw?.metadata.model ?? "unknown",
    inputTokens: raw?.metadata.inputTokens ?? 0,
    outputTokens: raw?.metadata.outputTokens ?? 0,
    latencyMs: raw?.metadata.latencyMs ?? 0,
    estimatedCostMicros: raw?.metadata.costMicros ?? 0,
    schemaValid: parsed?.success ?? false,
    qualityGatePassed: gate.passed,
    qualityFailures: gate.failures,
    repairRequired,
    finalPass: (parsed?.success ?? false) && gate.passed,
    narrativeSample: parsed?.success ? parsed.data.narrative.slice(0, 400) : "(no usable narrative — see providerErrorNote/qualityFailures)",
    providerErrorNote: attempt.errorNote,
  };
}

async function main() {
  const provider = selectProvider({ get: (k) => process.env[k] });
  console.log(`[bakeoff] Running Narrative Golden Set (${GOLDEN_SET.length} cases) against provider: ${provider.id}`);

  const results: CaseResult[] = [];
  for (const goldenCase of GOLDEN_SET) {
    const result = await runCase(provider, goldenCase);
    results.push(result);
    console.log(
      `[bakeoff] ${result.caseId.padEnd(16)} pass=${result.finalPass} repair=${result.repairRequired} tokens=${result.inputTokens}/${result.outputTokens} latency=${result.latencyMs}ms`
    );
  }

  const passCount = results.filter((r) => r.finalPass).length;
  const totalCostMicros = results.reduce((sum, r) => sum + r.estimatedCostMicros, 0);
  const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

  const summary = {
    provider: provider.id,
    generatedAt: new Date().toISOString(),
    caseCount: GOLDEN_SET.length,
    passCount,
    failCount: GOLDEN_SET.length - passCount,
    repairRequiredCount: results.filter((r) => r.repairRequired).length,
    totalEstimatedCostMicros: totalCostMicros,
    totalLatencyMs,
    results,
  };

  const outPath = process.argv[2] ?? "bakeoff-report.json";
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`[bakeoff] ${passCount}/${GOLDEN_SET.length} cases passed. Report written to ${outPath}`);

  if (provider.id === "fake-deterministic") {
    console.log(
      "[bakeoff] NOTE: ran against the fake deterministic provider (no real AI provider credential configured). " +
        "This demonstrates the harness end-to-end but says nothing about real narrative quality — " +
        "see docs/NARRATIVE_MODEL_EVALUATION.md, NARRATIVE_PROVIDER_CREDENTIAL_REQUIRED."
    );
  }
}

main().catch((err) => {
  console.error("[bakeoff] failed:", err);
  process.exitCode = 1;
});
