import { describe, expect, it } from "vitest";

import { evaluateGeneratedResult } from "./generation-validation.ts";
import { InMemoryTurnRepository } from "./test-support/in-memory-repository.ts";
import { StructuredGenerationResultSchema, type StorySetup } from "./types.ts";

const SETUP: StorySetup = {
  premise: "A sealed archive remembers every promise.",
  genre: "mystery",
  contentLanguage: "en",
  storyMode: "narrative",
  tone: "balanced",
  narrativePov: "second_person",
  playerRole: "an archivist",
  startingCharacter: {
    name: "Mira", role: "archive keeper", relationship: "wary ally", aliases: ["Keeper Mira"],
  },
};

async function begin(repo: InMemoryTurnRepository) {
  const precheck = await repo.precheckAndStartTurn({
    turnId: crypto.randomUUID(), playerRunId: null, actionType: "start",
    selectedChoiceId: null, rawAction: null, storySetup: SETUP,
  });
  if (precheck.status !== "proceed") throw new Error("unexpected precheck");
  return precheck;
}

async function commit(repo: InMemoryTurnRepository, turnId: string, result: unknown) {
  return repo.commitTurn({
    turnId,
    result: StructuredGenerationResultSchema.parse(result),
    generationAttemptCount: 1, provider: "fake", model: "runtime-test",
    inputTokens: 10, outputTokens: 20, costMicros: 0, latencyMs: 1,
  });
}

describe("runtime Character foundation", () => {
  it("creates a validated notable Character atomically with its Scene and exposes it on the next turn", async () => {
    const repo = new InMemoryTurnRepository();
    const first = await begin(repo);
    const opening = await commit(repo, first.turnId, { narrative: "Mira opens the archive.", next_choices: [] });
    const next = await repo.precheckAndStartTurn({
      turnId: crypto.randomUUID(), playerRunId: first.playerRunId, actionType: "custom_action",
      selectedChoiceId: null, rawAction: "Ask who is watching.", storySetup: null,
    });
    if (next.status !== "proceed") throw new Error("unexpected next precheck");
    await commit(repo, next.turnId, {
      narrative: "A courier named Ilya steps from the stacks.",
      new_character_candidates: [{
        temporary_key: "archive_courier", name: "Ilya", role: "archive courier",
        description: "A careful messenger with ink-stained gloves.", relationship: "newly encountered ally", aliases: ["the courier"],
      }],
      next_choices: [],
    });
    const context = await repo.loadContextInputs(first.playerRunId, next.runBranchId);
    expect(context.characters.map((character) => character.name)).toEqual(["Mira", "Ilya"]);
    expect(context.characters.find((character) => character.name === "Ilya")?.origin).toBe("runtime");

    const sibling = repo.replayFromScene(first.playerRunId, opening.scene.id).runBranchId;
    const siblingContext = await repo.loadContextInputs(first.playerRunId, sibling);
    expect(siblingContext.characters.map((character) => character.name)).toEqual(["Mira"]);
  });

  it("does not persist a runtime Character when no canonical commit occurs", async () => {
    const repo = new InMemoryTurnRepository();
    await begin(repo);
    expect([...repo.characters.values()].map((character) => character.name)).toEqual(["Mira"]);
    expect(repo.scenes.size).toBe(0);
  });

  it("rejects an exact existing name or alias before commit and never fuzzy-merges", async () => {
    const repo = new InMemoryTurnRepository();
    const first = await begin(repo);
    const context = await repo.loadContextInputs(first.playerRunId, first.runBranchId);
    const duplicate = evaluateGeneratedResult({
      narrative: "A second keeper appears, calling herself Keeper Mira.", dialogue: [], state_changes: [],
      canon_candidates: [], character_memory_candidates: [],
      new_character_candidates: [{ temporary_key: "second_keeper", name: "Keeper Mira", role: "keeper", description: "A duplicate identity.", relationship: "unknown", aliases: [] }],
      next_choices: [], boundary_kind: "none", structured_outcome: {},
    }, "en", context.characters, context.characters);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.qualityFailures).toContain("runtime_character_duplicate");
  });
});
