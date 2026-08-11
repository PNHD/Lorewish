import type { ContentLanguage, SubmitTurnArgs } from "@/lib/story-engine";

export type SetupPath = "quick" | "advanced";
export type GenreId = "fantasy" | "romance" | "adventure";
export type Tone = "light" | "balanced" | "dark";
export type NarrativePov = "first_person" | "second_person" | "third_person";

export const GENRE_OPTIONS: readonly { id: GenreId; label: string }[] = [
  { id: "fantasy", label: "Fantasy" },
  { id: "romance", label: "Romance" },
  { id: "adventure", label: "Adventure" },
];

export const STARTER_OPTIONS = {
  fantasy: {
    premise: {
      en: "A sealed forest shrine wakes when you arrive, and its last guardian asks for your help.",
      vi: "Một ngôi đền bị phong ấn giữa rừng thức tỉnh khi bạn đến, và người canh giữ cuối cùng cầu xin bạn giúp đỡ.",
    },
    character: { name: "Mira", role: "guardian of the sealed shrine", relationship: "a wary guide who needs the player" },
  },
  romance: {
    premise: {
      en: "You return to a rain-soaked coastal town and meet the friend whose last letter you never answered.",
      vi: "Bạn trở về thị trấn ven biển trong cơn mưa và gặp lại người bạn có lá thư cuối cùng bạn chưa từng hồi đáp.",
    },
    character: { name: "Linh", role: "owner of the old bookshop", relationship: "a once-close friend with unfinished feelings" },
  },
  adventure: {
    premise: {
      en: "A stolen map points beyond the city walls, and the only person who can read it has just found you.",
      vi: "Một tấm bản đồ bị đánh cắp chỉ đường ra ngoài thành, và người duy nhất đọc được nó vừa tìm đến bạn.",
    },
    character: { name: "Rin", role: "disgraced royal cartographer", relationship: "an uneasy expedition partner" },
  },
} as const;

export const ADDRESS_PRESETS = {
  anh_em: {
    speakerSelfReference: "anh",
    speakerAddressesTargetAs: "em",
    targetSelfReference: "em",
    targetAddressesSpeakerAs: "anh",
  },
  chi_em: {
    speakerSelfReference: "chị",
    speakerAddressesTargetAs: "em",
    targetSelfReference: "em",
    targetAddressesSpeakerAs: "chị",
  },
  toi_cau: {
    speakerSelfReference: "tôi",
    speakerAddressesTargetAs: "cậu",
    targetSelfReference: "tôi",
    targetAddressesSpeakerAs: "cậu",
  },
  ta_nguoi: {
    speakerSelfReference: "ta",
    speakerAddressesTargetAs: "ngươi",
    targetSelfReference: "ta",
    targetAddressesSpeakerAs: "ngươi",
  },
} as const;

export type AddressPresetId = keyof typeof ADDRESS_PRESETS;

export interface StorySetupDraft {
  path: SetupPath;
  contentLanguage: ContentLanguage;
  genre: GenreId;
  premise: string;
  worldSetting: string;
  tone: Tone;
  narrativePov: NarrativePov;
  playerRole: string;
  playerName: string;
  playerDescription: string;
  characterName: string;
  characterRole: string;
  characterDescription: string;
  characterRelationship: string;
  characterAliases: string;
  addressPreset: AddressPresetId;
}

export function createDefaultDraft(locale: ContentLanguage): StorySetupDraft {
  return {
    path: "quick",
    contentLanguage: locale,
    genre: "fantasy",
    premise: "",
    worldSetting: "",
    tone: "balanced",
    narrativePov: "second_person",
    playerRole: locale === "vi" ? "người lữ hành" : "traveler",
    playerName: "",
    playerDescription: "",
    characterName: "",
    characterRole: "",
    characterDescription: "",
    characterRelationship: "",
    characterAliases: "",
    addressPreset: "toi_cau",
  };
}

export type SetupErrorKey =
  | "premise"
  | "playerRole"
  | "characterName"
  | "characterRole"
  | "characterRelationship";

export function validateDraft(draft: StorySetupDraft): Partial<Record<SetupErrorKey, true>> {
  if (draft.path === "quick") return {};
  const errors: Partial<Record<SetupErrorKey, true>> = {};
  if (!draft.premise.trim()) errors.premise = true;
  if (!draft.playerRole.trim()) errors.playerRole = true;
  if (!draft.characterName.trim()) errors.characterName = true;
  if (!draft.characterRole.trim()) errors.characterRole = true;
  if (!draft.characterRelationship.trim()) errors.characterRelationship = true;
  return errors;
}

function cleanOptional(value: string): string | undefined {
  const cleaned = value.trim();
  return cleaned || undefined;
}

export function toStorySetup(draft: StorySetupDraft): NonNullable<SubmitTurnArgs["storySetup"]> {
  if (Object.keys(validateDraft(draft)).length > 0) {
    throw new Error("story setup is incomplete");
  }
  const starter = STARTER_OPTIONS[draft.genre];
  const quick = draft.path === "quick";
  const character = quick
    ? starter.character
    : {
        name: draft.characterName.trim(),
        role: draft.characterRole.trim(),
        relationship: draft.characterRelationship.trim(),
      };

  return {
    premise: quick ? starter.premise[draft.contentLanguage] : draft.premise.trim(),
    genre: draft.genre,
    contentLanguage: draft.contentLanguage,
    storyMode: "narrative",
    worldSetting: quick ? undefined : cleanOptional(draft.worldSetting),
    tone: quick ? "balanced" : draft.tone,
    narrativePov: quick ? "second_person" : draft.narrativePov,
    playerRole: quick
      ? draft.contentLanguage === "vi"
        ? "người lữ hành"
        : "traveler"
      : draft.playerRole.trim(),
    playerName: quick ? undefined : cleanOptional(draft.playerName),
    playerDescription: quick ? undefined : cleanOptional(draft.playerDescription),
    startingCharacter: {
      name: character.name,
      role: character.role,
      description: quick ? undefined : cleanOptional(draft.characterDescription),
      relationship: character.relationship,
      aliases: quick
        ? []
        : draft.characterAliases
            .split(",")
            .map((alias) => alias.trim())
            .filter(Boolean),
      addressTerms: draft.contentLanguage === "vi" ? ADDRESS_PRESETS[draft.addressPreset] : undefined,
    },
  };
}

export const STORY_SETUP_EDIT_POLICY = {
  beforeFirstScene: "safe_to_edit",
  afterFirstScene: {
    uiLocale: "safe_to_edit",
    canonicalSetup: "locked",
    characterIdentity: "locked",
    addressTerms: "locked",
    futureRetcon: "new_branch_or_future_feature",
  },
} as const;
