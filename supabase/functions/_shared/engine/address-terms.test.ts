import { describe, expect, it } from "vitest";

import { characterReplyHasAddressTermDrift, storyDialogueHasAddressTermDrift } from "./address-terms.ts";
import type { AddressTerms, ContextCharacter } from "./types.ts";

const chiEm: AddressTerms = {
  speakerSelfReference: "em",
  speakerAddressesTargetAs: "chị",
  targetSelfReference: "chị",
  targetAddressesSpeakerAs: "em",
};

const hanh: ContextCharacter = {
  id: "char-1",
  name: "Hạnh",
  aliases: [],
  role: "Chị họ",
  description: null,
  storyRelationship: null,
  addressTerms: chiEm,
};

describe("characterReplyHasAddressTermDrift", () => {
  it("does not flag a reply that uses the configured chị/em terms", () => {
    expect(characterReplyHasAddressTermDrift("Chị không giận đâu. Em về là chị mừng rồi.", hanh)).toBe(false);
  });

  it("flags a reply where the character drifts to tôi for self-reference", () => {
    expect(characterReplyHasAddressTermDrift("Tôi không giận đâu. Em về là tôi mừng rồi.", hanh)).toBe(true);
  });

  it("flags a reply where the character addresses the player with the wrong term", () => {
    expect(characterReplyHasAddressTermDrift("Chị không giận đâu. Cậu về là chị mừng rồi.", hanh)).toBe(true);
  });

  it("does not flag third-party narrative references that merely contain an address term", () => {
    expect(characterReplyHasAddressTermDrift("Chị nghe nói anh ấy cũng ghé qua hôm qua.", hanh)).toBe(false);
  });

  it("does not flag characters with no configured address terms", () => {
    const noTerms: ContextCharacter = { ...hanh, addressTerms: undefined };
    expect(characterReplyHasAddressTermDrift("Tôi không rõ nữa.", noTerms)).toBe(false);
  });
});

describe("storyDialogueHasAddressTermDrift", () => {
  it("does not flag dialogue that respects the configured terms for both participants", () => {
    const dialogue = [
      { speaker: "Hạnh", line: "Em về đó hả? Chị cứ tưởng em quên đường về nhà rồi." },
      { speaker: "you", line: "Em xin lỗi chị, em bận quá." },
    ];
    expect(storyDialogueHasAddressTermDrift(dialogue, [hanh])).toBe(false);
  });

  it("flags dialogue where the character's line drifts from the configured terms", () => {
    const dialogue = [{ speaker: "Hạnh", line: "Ngươi về đó hả? Ta cứ tưởng ngươi quên đường về nhà rồi." }];
    expect(storyDialogueHasAddressTermDrift(dialogue, [hanh])).toBe(true);
  });

  it("flags dialogue where the player line drifts from the configured terms", () => {
    const dialogue = [{ speaker: "you", line: "Tôi xin lỗi chị, tôi bận quá." }];
    expect(storyDialogueHasAddressTermDrift(dialogue, [hanh])).toBe(true);
  });

  it("matches the speaker by alias when the name does not match directly", () => {
    const aliased: ContextCharacter = { ...hanh, aliases: ["Chị Hạnh"] };
    const dialogue = [{ speaker: "Chị Hạnh", line: "Em về đó hả? Chị mừng lắm." }];
    expect(storyDialogueHasAddressTermDrift(dialogue, [aliased])).toBe(false);
  });
});
