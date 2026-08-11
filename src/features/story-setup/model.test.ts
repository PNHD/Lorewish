import { describe, expect, it } from "vitest";

import {
  ADDRESS_PRESETS,
  createDefaultDraft,
  STORY_SETUP_EDIT_POLICY,
  toStorySetup,
  validateDraft,
} from "./model";

describe("Advanced Setup and Quick Start model", () => {
  it("keeps Quick Start to language + genre/starter + start with safe defaults", () => {
    const draft = createDefaultDraft("en");
    expect(validateDraft(draft)).toEqual({});
    expect(toStorySetup(draft)).toMatchObject({
      contentLanguage: "en",
      genre: "fantasy",
      playerRole: "traveler",
      tone: "balanced",
      narrativePov: "second_person",
      startingCharacter: { name: "Mira" },
    });
  });

  it("propagates every engine-relevant Advanced Setup field", () => {
    const draft = {
      ...createDefaultDraft("vi"),
      path: "advanced" as const,
      premise: "Một lời hứa kéo dài qua hai thế hệ.",
      worldSetting: "Huế trong một mùa mưa không dứt.",
      playerRole: "người giữ thư viện",
      playerName: "An",
      playerDescription: "Luôn giữ lời dù phải trả giá.",
      characterName: "Linh",
      characterRole: "người đưa thư",
      characterDescription: "Bình tĩnh và quan sát tinh tế.",
      characterRelationship: "người bạn cũ đang mất niềm tin",
      characterAliases: "Linh, cô Linh",
      addressPreset: "anh_em" as const,
    };
    expect(toStorySetup(draft)).toMatchObject({
      premise: draft.premise,
      worldSetting: draft.worldSetting,
      playerRole: draft.playerRole,
      playerName: "An",
      playerDescription: draft.playerDescription,
      startingCharacter: {
        name: "Linh",
        role: "người đưa thư",
        description: draft.characterDescription,
        relationship: draft.characterRelationship,
        aliases: ["Linh", "cô Linh"],
        addressTerms: ADDRESS_PRESETS.anh_em,
      },
    });
  });

  it.each([
    ["anh_em", ["anh", "em", "em", "anh"]],
    ["chi_em", ["chị", "em", "em", "chị"]],
    ["toi_cau", ["tôi", "cậu", "tôi", "cậu"]],
    ["ta_nguoi", ["ta", "ngươi", "ta", "ngươi"]],
  ] as const)("preserves four-slot directionality for %s", (preset, expected) => {
    expect(Object.values(ADDRESS_PRESETS[preset])).toEqual(expected);
  });

  it("locks canonical setup after the first Scene while leaving UI locale safe", () => {
    expect(STORY_SETUP_EDIT_POLICY.afterFirstScene.canonicalSetup).toBe("locked");
    expect(STORY_SETUP_EDIT_POLICY.afterFirstScene.characterIdentity).toBe("locked");
    expect(STORY_SETUP_EDIT_POLICY.afterFirstScene.uiLocale).toBe("safe_to_edit");
  });
});
