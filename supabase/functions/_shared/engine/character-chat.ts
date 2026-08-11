import { moderateOutputText } from "./moderation.ts";
import { characterReplyHasAddressTermDrift } from "./address-terms.ts";
import {
  CharacterChatResultSchema,
  type CharacterChatContext,
  type ChatMessageContext,
  type ProviderCallResult,
} from "./types.ts";
import type { ContextInputs } from "./repository.ts";

export const CHAT_HISTORY_LIMIT = 20;
export const CHAT_STORY_SCENE_LIMIT = 3;

export function boundRecentChat(messages: ChatMessageContext[]): ChatMessageContext[] {
  return messages.slice(-CHAT_HISTORY_LIMIT);
}

export function assembleCharacterChatContext(args: {
  inputs: ContextInputs;
  characterId: string;
  recentChat: ChatMessageContext[];
  playerMessage: string;
}): CharacterChatContext {
  const character = args.inputs.characters.find((item) => item.id === args.characterId);
  if (!character) throw new Error("character_not_visible");
  return {
    contentLanguage: args.inputs.contentLanguage,
    genre: args.inputs.genre,
    storyMode: args.inputs.storyMode,
    premise: args.inputs.premise,
    worldSetting: args.inputs.worldSetting,
    playerRole: args.inputs.playerRole,
    playerName: args.inputs.playerName,
    playerDescription: args.inputs.playerDescription,
    character,
    recentScenes: args.inputs.allScenesOldestFirst.slice(-CHAT_STORY_SCENE_LIMIT),
    characterMemories: args.inputs.allCharacterMemories.filter((memory) => memory.characterId === character.id),
    recentChat: boundRecentChat(args.recentChat),
    playerMessage: args.playerMessage,
  };
}

export function validateCharacterChatResult(call: ProviderCallResult, context?: CharacterChatContext) {
  const parsed = CharacterChatResultSchema.safeParse(call.result);
  if (!parsed.success) {
    return { ok: false as const, errorClass: "validation_error" as const, metadata: call.metadata };
  }
  if (moderateOutputText(parsed.data.reply).blocked) {
    return { ok: false as const, errorClass: "validation_error" as const, metadata: call.metadata };
  }
  if (
    context?.contentLanguage === "vi" &&
    characterReplyHasAddressTermDrift(parsed.data.reply, context.character)
  ) {
    return { ok: false as const, errorClass: "validation_error" as const, metadata: call.metadata };
  }
  return { ok: true as const, result: parsed.data, metadata: call.metadata };
}
