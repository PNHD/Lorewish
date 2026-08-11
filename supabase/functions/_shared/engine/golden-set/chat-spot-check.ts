import { validateCharacterChatResult } from "../character-chat.ts";
import { buildCharacterChatPrompt, DeepSeekCharacterChatProvider } from "../providers.ts";
import { CharacterChatResultSchema, type CharacterChatContext, type ContextCharacterMemory } from "../types.ts";

const MAX_COST_MICROS = 250_000;

function context(language: "en" | "vi", playerMessage: string, memories: ContextCharacterMemory[] = []): CharacterChatContext {
  return {
    contentLanguage: language,
    genre: "mystery",
    storyMode: "narrative",
    premise: language === "vi" ? "Một thư khố ghi nhớ mọi lời hứa." : "An archive remembers every promise.",
    worldSetting: language === "vi" ? "Một thành phố mưa bên bờ biển." : "A rain-bound coastal city.",
    playerRole: language === "vi" ? "người giữ chìa khóa" : "the key keeper",
    playerName: "An",
    playerDescription: null,
    character: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Mira",
      aliases: [],
      role: language === "vi" ? "người canh thư khố" : "archive keeper",
      description: language === "vi" ? "Bình tĩnh, sắc sảo và luôn nhớ giá của một lời hứa." : "Calm, incisive, and mindful of every promise's cost.",
      storyRelationship: language === "vi" ? "đồng minh dè dặt" : "a wary ally",
      addressTerms: language === "vi" ? {
        speakerSelfReference: "anh",
        speakerAddressesTargetAs: "em",
        targetSelfReference: "em",
        targetAddressesSpeakerAs: "anh",
      } : undefined,
    },
    recentScenes: [{
      seqInBranch: 2, boundaryKind: "none",
      narrative: language === "vi" ? "Mira nhìn thấy An giấu chiếc chìa khóa dưới bậc đá." : "Mira saw An hide the key beneath the stone step.",
      dialogue: [], stateChangeSummary: [], playerAction: null,
    }],
    characterMemories: memories,
    recentChat: [],
    playerMessage,
  };
}

const visibleMemory: ContextCharacterMemory = {
  id: "11111111-1111-4111-8111-111111111111",
  characterId: "33333333-3333-4333-8333-333333333333",
  characterName: "Mira",
  memoryType: "discovery",
  factKey: "player_hid_key",
  factText: "An hid the key beneath the stone step.",
  salience: 5,
  supersedesFactId: null,
  createdAt: "2026-08-11T00:00:00Z",
};

const promotedMemory: ContextCharacterMemory = {
  ...visibleMemory,
  id: "22222222-2222-4222-8222-222222222222",
  memoryType: "player_fact",
  factKey: "player_confessed_swap",
  factText: "An explicitly confessed to swapping the archive key.",
};

const cases = [
  { id: "en-key", context: context("en", "Do you remember where I hid the key?", [visibleMemory]) },
  { id: "en-relationship", context: context("en", "Tell me what you still trust about me.", [visibleMemory]) },
  { id: "vi-address", context: context("vi", "Em còn nhớ anh đã giấu chìa khóa ở đâu không?", [visibleMemory]) },
  { id: "vi-confession", context: context("vi", "Anh muốn thú nhận một điều, nhưng chuyện này chưa xảy ra trong chính truyện.", [visibleMemory]) },
  { id: "branch-isolation", context: context("en", "What do you know about this path?", [visibleMemory]), forbidden: "sibling-only future coronation" },
  { id: "promoted-memory", context: context("en", "What confession do you remember?", [visibleMemory, promotedMemory]), required: promotedMemory.factText },
];

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log(JSON.stringify({ status: "DEEPSEEK_CREDENTIAL_NOT_AVAILABLE", credentialPresent: false }));
    return;
  }
  const model = process.env.LOREWISH_NARRATIVE_MODEL ?? "deepseek-v4-flash";
  const provider = new DeepSeekCharacterChatProvider(apiKey, model);
  let totalCostMicros = 0;
  const results: Record<string, unknown>[] = [];
  for (const item of cases) {
    const prompt = buildCharacterChatPrompt(item.context);
    if (item.forbidden && prompt.user.includes(item.forbidden)) throw new Error(`${item.id}: forbidden branch text leaked into prompt`);
    if (item.required && !prompt.user.includes(item.required)) throw new Error(`${item.id}: promoted memory missing from prompt`);
    const call = await provider.generateChat(item.context);
    totalCostMicros += call.metadata.costMicros;
    if (totalCostMicros > MAX_COST_MICROS) throw new Error("CHAT_SPOT_CHECK_COST_CAP_EXCEEDED");
    const validated = validateCharacterChatResult(call);
    results.push({
      id: item.id,
      schemaValid: validated.ok,
      provider: call.metadata.provider,
      model: call.metadata.model,
      inputTokens: call.metadata.inputTokens,
      outputTokens: call.metadata.outputTokens,
      costMicros: call.metadata.costMicros,
      latencyMs: call.metadata.latencyMs,
    });
    if (!validated.ok) {
      const parsed = CharacterChatResultSchema.safeParse(call.result);
      const issues = parsed.success
        ? [{ path: "reply", code: "moderation_blocked" }]
        : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code }));
      throw new Error(`${item.id}: invalid Character Chat result ${JSON.stringify(issues)}`);
    }
  }
  console.log(JSON.stringify({ status: "DEEPSEEK_CHAT_SPOT_CHECK_PASS", credentialPresent: true, totalCostMicros, maxCostMicros: MAX_COST_MICROS, cases: results }, null, 2));
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
