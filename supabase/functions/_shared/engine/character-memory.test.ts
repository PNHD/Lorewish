import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildPrompt } from "./providers.ts";
import { submitTurn } from "./turn-pipeline.ts";
import { InMemoryTurnRepository } from "./test-support/in-memory-repository.ts";
import type { NarrativeContext, NarrativeProvider, ProviderCallResult, StorySetup } from "./types.ts";

const SETUP: StorySetup = {
  premise: "A guardian and a traveler enter a sealed shrine.",
  genre: "fantasy",
  contentLanguage: "en",
  storyMode: "narrative",
  worldSetting: "A drowned valley beneath a permanent moon.",
  tone: "balanced",
  narrativePov: "second_person",
  playerRole: "traveling archivist",
  playerName: "Ari",
  playerDescription: "Keeps promises even when afraid.",
  startingCharacter: {
    name: "Mira",
    role: "guardian of the sealed shrine",
    description: "Watchful and precise.",
    relationship: "a wary guide",
    aliases: ["the guardian"],
    addressTerms: {
      speakerSelfReference: "tôi",
      speakerAddressesTargetAs: "cậu",
      targetSelfReference: "tôi",
      targetAddressesSpeakerAs: "cậu",
    },
  },
};

class MemoryProvider implements NarrativeProvider {
  readonly id = "memory-test";
  seen: NarrativeContext[] = [];

  async generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    this.seen.push(context);
    const characterId = context.characters[0]?.id;
    const action = context.playerAction ?? "";
    const memory = action.includes("promise")
      ? { character_id: characterId, memory_type: "promise", fact_key: "return_the_sword", fact_text: "Ari promised Mira to return the sword.", salience: 5 }
      : action.includes("distrust")
        ? { character_id: characterId, memory_type: "relationship_fact", fact_key: "mira_trust_state", fact_text: "Mira distrusts Ari after the lie.", salience: 4 }
        : action.includes("trust")
          ? { character_id: characterId, memory_type: "relationship_fact", fact_key: "mira_trust_state", fact_text: "Mira now trusts Ari after the rescue.", salience: 5 }
          : action.includes("secret")
            ? { character_id: characterId, memory_type: "discovery", fact_key: "ari_hidden_name", fact_text: "Mira learned Ari's hidden name.", salience: 5 }
            : null;
    return {
      result: {
        narrative: context.actionType === "start" ? "Mira opens the sealed shrine and studies Ari carefully." : `Mira watches as Ari acts: ${action}.`,
        dialogue: [],
        state_changes: [],
        canon_candidates: [],
        character_memory_candidates: memory ? [memory] : [],
        next_choices: [
          { id: "continue", label: "Continue into the shrine" },
          { id: "wait", label: "Wait and listen" },
        ],
        boundary_kind: "none",
        structured_outcome: { rolled: false },
      },
      metadata: { provider: this.id, model: "test", inputTokens: 1, outputTokens: 1, costMicros: 0, latencyMs: 1 },
    };
  }
}

async function start(repo: InMemoryTurnRepository, provider: NarrativeProvider = new MemoryProvider()) {
  const result = await submitTurn(repo, provider, {
    turnId: randomUUID(),
    playerRunId: null,
    actionType: "start",
    storySetup: SETUP,
  });
  if (!("scene" in result)) throw new Error("start failed");
  const run = [...repo.runs.values()][0];
  return { run, sceneId: result.scene.id as string };
}

async function act(repo: InMemoryTurnRepository, provider: NarrativeProvider, runId: string, rawAction: string) {
  return submitTurn(repo, provider, {
    turnId: randomUUID(),
    playerRunId: runId,
    actionType: "custom_action",
    rawAction,
  });
}

describe("durable character memory", () => {
  it("propagates Advanced Setup through persisted context to the provider", async () => {
    const repo = new InMemoryTurnRepository();
    const provider = new MemoryProvider();
    await start(repo, provider);
    expect(provider.seen[0]).toMatchObject({
      premise: SETUP.premise,
      worldSetting: SETUP.worldSetting,
      playerRole: SETUP.playerRole,
      playerName: SETUP.playerName,
      characters: [{ name: "Mira", role: SETUP.startingCharacter?.role, storyRelationship: SETUP.startingCharacter?.relationship }],
    });
  });

  it("persists and deterministically retrieves typed character memory", async () => {
    const repo = new InMemoryTurnRepository();
    const provider = new MemoryProvider();
    const { run } = await start(repo, provider);
    await act(repo, provider, run.id, "promise to return the sword");
    const context = await repo.loadContextInputs(run.id, run.activeBranchId);
    expect(context.allCharacterMemories).toMatchObject([
      { memoryType: "promise", factKey: "return_the_sword", salience: 5, characterName: "Mira" },
    ]);
  });

  it("supersedes a relationship state without destroying auditable history", async () => {
    const repo = new InMemoryTurnRepository();
    const provider = new MemoryProvider();
    const { run } = await start(repo, provider);
    await act(repo, provider, run.id, "distrust after a lie");
    await act(repo, provider, run.id, "trust after the rescue");
    const history = repo.canonFacts.filter((fact) => fact.factKey === "mira_trust_state");
    expect(history).toHaveLength(2);
    expect(history[1].supersedesFactId).toBe(history[0].id);
    const context = await repo.loadContextInputs(run.id, run.activeBranchId);
    expect(context.allCharacterMemories.filter((memory) => memory.factKey === "mira_trust_state")).toMatchObject([
      { factText: "Mira now trusts Ari after the rescue." },
    ]);
  });

  it("inherits parent memory to a replay point and prevents future-memory leakage", async () => {
    const repo = new InMemoryTurnRepository();
    const provider = new MemoryProvider();
    const { run, sceneId: openingSceneId } = await start(repo, provider);
    const promiseResult = await act(repo, provider, run.id, "promise to return the sword");
    if (!("scene" in promiseResult)) throw new Error("promise turn failed");
    await act(repo, provider, run.id, "share a secret hidden name");
    const parentBranchId = run.activeBranchId;

    const inheritedBranch = repo.replayFromScene(run.id, promiseResult.scene.id as string).runBranchId;
    const inherited = await repo.loadContextInputs(run.id, inheritedBranch);
    expect(inherited.allCharacterMemories.some((memory) => memory.factKey === "return_the_sword")).toBe(true);
    expect(inherited.allCharacterMemories.some((memory) => memory.factKey === "ari_hidden_name")).toBe(false);

    const siblingBeforeMemory = repo.replayFromScene(run.id, openingSceneId).runBranchId;
    const sibling = await repo.loadContextInputs(run.id, siblingBeforeMemory);
    expect(sibling.allCharacterMemories).toHaveLength(0);
    const parent = await repo.loadContextInputs(run.id, parentBranchId);
    expect(parent.allCharacterMemories.some((memory) => memory.factKey === "ari_hidden_name")).toBe(true);
  });

  it("does not persist memory or a Scene when generation fails validation", async () => {
    const repo = new InMemoryTurnRepository();
    const good = new MemoryProvider();
    const { run } = await start(repo, good);
    const sceneCount = repo.scenes.size;
    const memoryCount = repo.canonFacts.filter((fact) => fact.characterId).length;
    const bad: NarrativeProvider = {
      id: "bad",
      async generateTurn(context) {
        return {
          result: {
            narrative: "As an AI, I cannot continue this story.",
            dialogue: [], state_changes: [], canon_candidates: [],
            character_memory_candidates: [{ character_id: context.characters[0].id, memory_type: "discovery", fact_key: "should_not_commit", fact_text: "This must not persist.", salience: 5 }],
            next_choices: [{ id: "a", label: "Try again" }, { id: "b", label: "Wait" }],
            boundary_kind: "none", structured_outcome: { rolled: false },
          },
          metadata: { provider: "bad", model: "bad", inputTokens: 1, outputTokens: 1, costMicros: 0, latencyMs: 1 },
        };
      },
    };
    const result = await act(repo, bad, run.id, "trigger rejected generation");
    expect(result.status).toBe("GENERATION_FAILED");
    expect(repo.scenes.size).toBe(sceneCount);
    expect(repo.canonFacts.filter((fact) => fact.characterId)).toHaveLength(memoryCount);
  });

  it("renders the context contract as clearly separated prompt sections", async () => {
    const repo = new InMemoryTurnRepository();
    const provider = new MemoryProvider();
    const { run } = await start(repo, provider);
    await act(repo, provider, run.id, "promise to return the sword");
    await act(repo, provider, run.id, "continue");
    const prompt = buildPrompt(provider.seen.at(-1)!);
    for (const section of ["STORY CONFIG", "PLAYER IDENTITY", "CHARACTER IDENTITY", "ADDRESS TERMS", "RECENT SCENES", "RELEVANT CHARACTER MEMORY", "CANON FACTS", "PLAYER ACTION"]) {
      expect(prompt.user).toContain(section);
    }
    expect(prompt.user).toContain("player self=tôi");
    expect(prompt.user).toContain("Ari promised Mira to return the sword.");
  });
});
