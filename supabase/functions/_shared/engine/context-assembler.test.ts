import { describe, expect, it } from "vitest";
import { assembleContext, CONTEXT_BUDGET } from "./context-assembler.ts";
import type { AssembleContextInput } from "./context-assembler.ts";

function scene(seq: number): AssembleContextInput["allScenesOldestFirst"][number] {
  return {
    seqInBranch: seq,
    boundaryKind: "none",
    narrative: `Scene ${seq} narrative.`,
    dialogue: [],
    stateChangeSummary: [],
    playerAction: null,
  };
}

function fact(key: string, daysAgo: number, scope: "run" | "branch" = "run") {
  return {
    id: `fact-${key}`,
    scope,
    factKey: key,
    factText: `Fact ${key}`,
    createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  };
}

function baseInput(overrides: Partial<AssembleContextInput> = {}): AssembleContextInput {
  return {
    contentLanguage: "en",
    genre: "fantasy",
    storyMode: "narrative",
    premise: "A quiet village hides a secret.",
    worldSetting: null,
    playerRole: null,
    playerName: null,
    playerDescription: null,
    tone: null,
    narrativePov: null,
    characters: [],
    allScenesOldestFirst: [],
    allCanonFacts: [],
    allCharacterMemories: [],
    actionType: "custom_action",
    playerAction: "look around",
    selectedChoiceLabel: null,
    repairReason: null,
    ...overrides,
  };
}

describe("bounded context assembler — CONTEXT test category", () => {
  it("includes only the last N scenes verbatim (bounded context)", () => {
    const scenes = Array.from({ length: 10 }, (_, i) => scene(i));
    const ctx = assembleContext(baseInput({ allScenesOldestFirst: scenes }));
    expect(ctx.recentScenes).toHaveLength(CONTEXT_BUDGET.maxRecentScenes);
    expect(ctx.recentScenes.map((s) => s.seqInBranch)).toEqual([7, 8, 9]);
  });

  it("summarizes older scenes instead of replaying them", () => {
    const scenes = Array.from({ length: 10 }, (_, i) => scene(i));
    const ctx = assembleContext(baseInput({ allScenesOldestFirst: scenes }));
    expect(ctx.olderHistorySummary).not.toBeNull();
    expect(ctx.olderHistorySummary).toContain("7");
  });

  it("returns no summary when history fits entirely within the recent-scene budget", () => {
    const scenes = [scene(0), scene(1)];
    const ctx = assembleContext(baseInput({ allScenesOldestFirst: scenes }));
    expect(ctx.olderHistorySummary).toBeNull();
    expect(ctx.recentScenes).toHaveLength(2);
  });

  it("truncates canon facts to the budget, ranked by recency", () => {
    const facts = Array.from({ length: 20 }, (_, i) => fact(`f${i}`, i));
    const ctx = assembleContext(baseInput({ allCanonFacts: facts }));
    expect(ctx.canonFacts).toHaveLength(CONTEXT_BUDGET.maxCanonFacts);
    // Most recent (smallest daysAgo) facts must be the ones kept.
    expect(ctx.canonFacts.map((f) => f.factKey)).toEqual(
      Array.from({ length: CONTEXT_BUDGET.maxCanonFacts }, (_, i) => `f${i}`)
    );
  });

  it("bounds character memory and prioritizes unresolved promises, relationship state, and salience", () => {
    const memories = Array.from({ length: 20 }, (_, index) => ({
      id: `memory-${index}`,
      characterId: "character-1",
      characterName: "Mira",
      memoryType: (index === 19 ? "promise" : index === 18 ? "relationship_fact" : "shared_event") as "promise" | "relationship_fact" | "shared_event",
      factKey: `memory_key_${index}`,
      factText: `Memory ${index}`,
      salience: index % 5 + 1,
      supersedesFactId: null,
      createdAt: new Date(index * 1000).toISOString(),
    }));
    const ctx = assembleContext(baseInput({ allCharacterMemories: memories }));
    expect(ctx.characterMemories).toHaveLength(CONTEXT_BUDGET.maxCharacterMemories);
    expect(ctx.characterMemories.slice(0, 2).map((memory) => memory.memoryType)).toEqual(["promise", "relationship_fact"]);
  });

  it("never truncates structured character identity, even under budget pressure", () => {
    const characters = Array.from({ length: 25 }, (_, i) => ({
      id: `character-${i}`,
      name: `Character ${i}`,
      aliases: [],
      role: null,
      description: null,
      storyRelationship: null,
    }));
    const ctx = assembleContext(baseInput({ characters }));
    expect(ctx.characters).toHaveLength(25);
  });

  it("carries the repair reason through only when a repair is running", () => {
    const ctx = assembleContext(baseInput({ repairReason: "wrong_language" }));
    expect(ctx.repairReason).toBe("wrong_language");
    const ctxNoRepair = assembleContext(baseInput());
    expect(ctxNoRepair.repairReason).toBeNull();
  });
});
