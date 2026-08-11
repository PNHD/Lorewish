import { describe, expect, it } from "vitest";

import { assembleCharacterChatContext, boundRecentChat, CHAT_HISTORY_LIMIT, validateCharacterChatResult } from "./character-chat.ts";
import { buildCharacterChatPrompt } from "./providers.ts";
import { InMemoryTurnRepository } from "./test-support/in-memory-repository.ts";
import { StructuredGenerationResultSchema, type AddressTerms, type StorySetup } from "./types.ts";

async function storyWithMira(addressTerms?: AddressTerms) {
  const repo = new InMemoryTurnRepository();
  const setup: StorySetup = {
    premise: "Mira guards the hidden key.", genre: "mystery", contentLanguage: "vi", storyMode: "narrative",
    tone: "balanced", narrativePov: "second_person", playerRole: "người giữ chìa khóa", playerName: "An",
    startingCharacter: { name: "Mira", role: "người canh giữ", relationship: "đồng minh dè dặt", aliases: [], addressTerms },
  };
  const precheck = await repo.precheckAndStartTurn({ turnId: crypto.randomUUID(), playerRunId: null, actionType: "start", selectedChoiceId: null, rawAction: null, storySetup: setup });
  if (precheck.status !== "proceed") throw new Error("unexpected precheck");
  const characterId = repo.runs.get(precheck.playerRunId)!.startingCharacterId!;
  const committed = await repo.commitTurn({
    turnId: precheck.turnId,
    result: StructuredGenerationResultSchema.parse({
      narrative: "Mira biết An đã giấu chiếc chìa khóa dưới bậc đá.", next_choices: [],
      character_memory_candidates: [{ character_id: characterId, memory_type: "discovery", fact_key: "player_hid_key", fact_text: "An giấu chiếc chìa khóa dưới bậc đá.", salience: 5 }],
    }),
    generationAttemptCount: 1, provider: "fake", model: "chat-contract", inputTokens: 1, outputTokens: 1, costMicros: 0, latencyMs: 1,
  });
  return { repo, precheck, characterId, openingSceneId: committed.scene.id };
}

describe("branch-bound non-canonical Character Chat", () => {
  it("bounds recent Chat independently from Story context", () => {
    const messages = Array.from({ length: 31 }, (_, index) => ({ role: index % 2 ? "character" as const : "player" as const, content: `message-${index}` }));
    const bounded = boundRecentChat(messages);
    expect(bounded).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(bounded[0].content).toBe("message-11");
  });

  it("keeps Chat-only knowledge out of Story until explicit promotion, then isolates it from the parent branch", async () => {
    const { repo, precheck, characterId, openingSceneId } = await storyWithMira();
    const childBranch = repo.replayFromScene(precheck.playerRunId, openingSceneId).runBranchId;
    const before = await repo.loadContextInputs(precheck.playerRunId, childBranch);
    const chatContext = assembleCharacterChatContext({ inputs: before, characterId, recentChat: [], playerMessage: "Tôi thú nhận đã đánh tráo chiếc chìa khóa." });
    expect(chatContext.characterMemories.map((memory) => memory.factKey)).toContain("player_hid_key");

    const providerCall = {
      result: { reply: "Mira im lặng rất lâu rồi gật đầu.", chat_memory_candidates: [{ memory_type: "player_fact", fact_key: "player_swapped_key", fact_text: "An thú nhận đã đánh tráo chiếc chìa khóa.", salience: 5 }] },
      metadata: { provider: "fake", model: "chat", inputTokens: 4, outputTokens: 5, costMicros: 0, latencyMs: 1 },
    };
    const validated = validateCharacterChatResult(providerCall);
    expect(validated.ok).toBe(true);
    expect((await repo.loadContextInputs(precheck.playerRunId, childBranch)).allCharacterMemories.map((memory) => memory.factKey)).not.toContain("player_swapped_key");

    if (!validated.ok) throw new Error("unexpected validation failure");
    repo.promoteChatMemory({ playerRunId: precheck.playerRunId, runBranchId: childBranch, characterId, sourceChatMessageId: "chat-message-1", candidate: validated.result.chat_memory_candidates[0] });
    expect((await repo.loadContextInputs(precheck.playerRunId, childBranch)).allCharacterMemories.map((memory) => memory.factKey)).toContain("player_swapped_key");
    expect((await repo.loadContextInputs(precheck.playerRunId, repo.branches.get(childBranch)!.parentBranchId!)).allCharacterMemories.map((memory) => memory.factKey)).not.toContain("player_swapped_key");
  });

  it.each([
    ["anh", "em", "em", "anh"],
    ["chị", "em", "em", "chị"],
    ["tôi", "cậu", "tôi", "cậu"],
    ["ta", "ngươi", "ta", "ngươi"],
  ])("preserves VI address direction %s/%s", async (playerSelf, playerAddresses, characterSelf, characterAddresses) => {
    const { repo, precheck, characterId } = await storyWithMira({
      speakerSelfReference: playerSelf, speakerAddressesTargetAs: playerAddresses,
      targetSelfReference: characterSelf, targetAddressesSpeakerAs: characterAddresses,
    });
    const inputs = await repo.loadContextInputs(precheck.playerRunId, precheck.runBranchId);
    const context = assembleCharacterChatContext({ inputs, characterId, recentChat: [], playerMessage: "Mira có nhớ không?" });
    const prompt = buildCharacterChatPrompt(context);
    expect(prompt.system).toContain("Vietnamese");
    expect(prompt.user).toContain(`Player self=${playerSelf}; player addresses character=${playerAddresses}; character self=${characterSelf}; character addresses player=${characterAddresses}`);
  });

  it("rejects a VI Character Chat reply that substitutes a configured pronoun", async () => {
    const { repo, precheck, characterId } = await storyWithMira({
      speakerSelfReference: "em", speakerAddressesTargetAs: "chị",
      targetSelfReference: "chị", targetAddressesSpeakerAs: "em",
    });
    const inputs = await repo.loadContextInputs(precheck.playerRunId, precheck.runBranchId);
    const context = assembleCharacterChatContext({ inputs, characterId, recentChat: [], playerMessage: "Chị có nhớ em không?" });
    const result = validateCharacterChatResult({
      result: { reply: "Ta vẫn nhớ em.", chat_memory_candidates: [] },
      metadata: { provider: "fake", model: "chat", inputTokens: 1, outputTokens: 1, costMicros: 0, latencyMs: 1 },
    }, context);
    expect(result).toMatchObject({ ok: false, errorClass: "validation_error" });
  });

  it("makes the single repair instruction explicit at the provider boundary", async () => {
    const { repo, precheck, characterId } = await storyWithMira({
      speakerSelfReference: "em", speakerAddressesTargetAs: "chị",
      targetSelfReference: "chị", targetAddressesSpeakerAs: "em",
    });
    const inputs = await repo.loadContextInputs(precheck.playerRunId, precheck.runBranchId);
    const context = assembleCharacterChatContext({ inputs, characterId, recentChat: [], playerMessage: "Chị có nhớ em không?" });
    const prompt = buildCharacterChatPrompt({ ...context, repairReason: "address terms drifted" });
    expect(prompt.system).toContain("only repair attempt");
    expect(prompt.system).toContain("address terms drifted");
  });
});
