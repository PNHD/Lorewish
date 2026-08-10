/**
 * Narrative Golden Set (NARRATIVE_QUALITY_CONTRACT.md §F) — six original
 * scenarios, EN/VI × Fantasy/Romance/Adventure. Written for this task, not
 * copied or adapted from any existing product or published work (NO
 * COMPETITOR CLONING in the task brief). These are executable test fixtures
 * for the dev-only Model Bakeoff Harness (golden-set/bakeoff.ts), not exact
 * expected-prose answers — narrative generation is nondeterministic, so each
 * case specifies structure and invariants to check, never a golden string.
 */

import type { ContentLanguage } from "../types.ts";

export interface GoldenCase {
  id: string;
  language: ContentLanguage;
  genre: "fantasy" | "romance" | "adventure";
  premise: string;
  playerRole: string;
  startingSituation: string;
  /** Canonical character identity the generated prose must stay consistent with (P4). */
  characterIdentity: {
    name: string;
    aliases: string[];
    pronounsOrAddress: string;
  }[];
  /** For Vietnamese cases: the four-slot address model this scenario exercises (NARRATIVE_QUALITY_CONTRACT.md §C). */
  formsOfAddress?: {
    speakerSelfReference: string;
    speakerAddressesTargetAs: string;
    targetSelfReference: string;
    targetAddressesSpeakerAs: string;
  };
  /** The player's first decision, offered as a custom action to exercise D5's unconstrained-input path. */
  initialDecision: string;
  /** Facts the generated continuity must still hold by the scenario's later turns. */
  expectedInvariantFacts: string[];
  /** Contradictions that would indicate a consistency break (P4) if they appeared. */
  prohibitedContradictions: string[];
  /** Which of §F's stress dimensions this case is designed to exercise. */
  stressCoverage: (
    | "dialogue"
    | "forms_of_address"
    | "relationship_change"
    | "branching"
    | "custom_action"
    | "continuity"
    | "emotional_scene"
  )[];
}

export const GOLDEN_SET: GoldenCase[] = [
  {
    id: "en-fantasy-01",
    language: "en",
    genre: "fantasy",
    premise: "A wandering healer arrives at a village bound by a decades-old curse that silences anyone who speaks the founder's name.",
    playerRole: "a traveling healer with no memory of their own hometown",
    startingSituation: "The player is stopped at the village gate by a guard captain who refuses entry until they prove they mean no harm.",
    characterIdentity: [
      { name: "Captain Ysolde Marrow", aliases: ["the Captain", "Marrow"], pronounsOrAddress: "she/her" },
    ],
    initialDecision: "Show the guard captain the healer's satchel and ask what the village fears.",
    expectedInvariantFacts: [
      "The village is bound by a curse tied to speaking the founder's name.",
      "Captain Ysolde Marrow is the guard who first meets the player.",
    ],
    prohibitedContradictions: [
      "Captain Marrow being referred to as male or by a different name later in the same run.",
      "The curse's trigger condition (speaking the founder's name) changing to something else without an explicit story reason.",
    ],
    stressCoverage: ["dialogue", "custom_action", "continuity"],
  },
  {
    id: "en-romance-01",
    language: "en",
    genre: "romance",
    premise: "Two rival chefs are forced to co-run a struggling seaside restaurant for one summer after inheriting it jointly.",
    playerRole: "one of the two co-inheriting chefs",
    startingSituation: "The player arrives on the first morning to find their rival already rearranging the kitchen without asking.",
    characterIdentity: [
      { name: "Idris Callahan", aliases: ["Idris"], pronounsOrAddress: "he/him" },
    ],
    initialDecision: "Confront Idris about rearranging the kitchen, but propose splitting the menu instead of fighting over it.",
    expectedInvariantFacts: [
      "The player and Idris jointly inherited the restaurant.",
      "The restaurant is on the coast and struggling financially at the start.",
    ],
    prohibitedContradictions: [
      "Idris being a stranger with no prior claim to the restaurant.",
      "The relationship tone flattening to purely platonic with no romantic tension despite the premise, absent an explicit player choice steering it that way.",
    ],
    stressCoverage: ["dialogue", "relationship_change", "emotional_scene", "custom_action"],
  },
  {
    id: "en-adventure-01",
    language: "en",
    genre: "adventure",
    premise: "A small crew charters a boat to an uncharted reef rumored to hide a sunken trading ship, racing a storm season deadline.",
    playerRole: "the crew's navigator",
    startingSituation: "The boat's engine sputters within sight of the reef, and the captain wants a decision before the tide turns.",
    characterIdentity: [
      { name: "Captain Reyes", aliases: ["the Captain"], pronounsOrAddress: "they/them" },
    ],
    initialDecision: "Risk a quick dive to check the propeller before the tide traps the boat against the reef.",
    expectedInvariantFacts: [
      "The crew is searching for a sunken trading ship near an uncharted reef.",
      "There is a storm-season time pressure driving the crew's decisions.",
    ],
    prohibitedContradictions: [
      "The reef being described as already fully charted/mapped, contradicting the premise.",
      "Captain Reyes's pronouns switching mid-story without narrative cause.",
    ],
    stressCoverage: ["branching", "continuity", "custom_action"],
  },
  {
    id: "vi-fantasy-01",
    language: "vi",
    genre: "fantasy",
    premise: "Một pháp sư trẻ được giao nhiệm vụ hộ tống viên ngọc trấn yểm cuối cùng về kinh đô trước khi biên giới phía bắc sụp đổ.",
    playerRole: "một pháp sư trẻ mới được phong làm sứ giả hộ tống",
    startingSituation: "Ngay đêm đầu tiên lên đường, đoàn hộ tống bị chặn lại bởi một vị tướng biên phòng nghi ngờ giấy tờ của họ.",
    characterIdentity: [
      { name: "Tướng Lâm Vũ", aliases: ["Tướng quân", "Lâm Vũ"], pronounsOrAddress: "ông ấy" },
    ],
    formsOfAddress: {
      speakerSelfReference: "tôi",
      speakerAddressesTargetAs: "tướng quân",
      targetSelfReference: "ta",
      targetAddressesSpeakerAs: "cậu",
    },
    initialDecision: "Trình giấy tờ và xin phép giải thích trực tiếp lý do hộ tống viên ngọc.",
    expectedInvariantFacts: [
      "Người chơi đang hộ tống viên ngọc trấn yểm cuối cùng về kinh đô.",
      "Tướng Lâm Vũ là người chặn đoàn hộ tống lại vào đêm đầu tiên.",
    ],
    prohibitedContradictions: [
      "Tướng Lâm Vũ đổi giới tính hoặc tên gọi mà không có lý do trong câu chuyện.",
      "Cách xưng hô giữa người chơi và Tướng Lâm Vũ thay đổi đột ngột mà không có sự kiện nào giải thích.",
    ],
    stressCoverage: ["dialogue", "forms_of_address", "continuity"],
  },
  {
    id: "vi-romance-01",
    language: "vi",
    genre: "romance",
    premise: "Một họa sĩ minh họa sách và một biên tập viên khó tính buộc phải cùng hoàn thành một cuốn sách tranh trong ba tuần trước hạn chót.",
    playerRole: "họa sĩ minh họa của cuốn sách",
    startingSituation: "Buổi họp đầu tiên, biên tập viên thẳng thừng chê bản phác thảo và yêu cầu vẽ lại toàn bộ.",
    characterIdentity: [
      { name: "Biên tập viên Thảo Chi", aliases: ["Thảo Chi", "chị Chi"], pronounsOrAddress: "chị ấy" },
    ],
    formsOfAddress: {
      speakerSelfReference: "em",
      speakerAddressesTargetAs: "chị",
      targetSelfReference: "chị",
      targetAddressesSpeakerAs: "em",
    },
    initialDecision: "Bình tĩnh hỏi Thảo Chi cụ thể điều gì trong bản phác thảo khiến chị ấy không hài lòng.",
    expectedInvariantFacts: [
      "Người chơi và Thảo Chi đang cùng hoàn thành một cuốn sách tranh trong ba tuần.",
      "Thảo Chi là biên tập viên khó tính của cuốn sách.",
    ],
    prohibitedContradictions: [
      "Cách xưng hô 'em'/'chị' đổi thành 'tôi'/'bạn' một cách vô cớ giữa hai người.",
      "Thời hạn ba tuần bị bỏ quên hoặc thay đổi mà không có lý do trong câu chuyện.",
    ],
    stressCoverage: ["dialogue", "forms_of_address", "relationship_change", "emotional_scene"],
  },
  {
    id: "vi-adventure-01",
    language: "vi",
    genre: "adventure",
    premise: "Một nhóm thám hiểm nhỏ thuê thuyền ra một rạn san hô chưa có trên bản đồ để tìm một con tàu buôn bị đắm, chạy đua với mùa bão sắp tới.",
    playerRole: "người dẫn đường của nhóm thám hiểm",
    startingSituation: "Máy thuyền chết ngay khi rạn san hô hiện ra trước mắt, và thuyền trưởng cần một quyết định trước khi con nước đổi chiều.",
    characterIdentity: [
      { name: "Thuyền trưởng Bình", aliases: ["Thuyền trưởng"], pronounsOrAddress: "anh ấy" },
    ],
    initialDecision: "Đề nghị lặn xuống kiểm tra chân vịt ngay trước khi thuyền bị mắc kẹt vào rạn san hô.",
    expectedInvariantFacts: [
      "Nhóm đang tìm một con tàu buôn bị đắm gần một rạn san hô chưa có trên bản đồ.",
      "Có áp lực thời gian từ mùa bão sắp đến.",
    ],
    prohibitedContradictions: [
      "Rạn san hô được mô tả là đã có đầy đủ trên bản đồ, mâu thuẫn với tiền đề.",
      "Thuyền trưởng Bình đổi tên hoặc giới tính giữa chừng câu chuyện.",
    ],
    stressCoverage: ["branching", "continuity", "custom_action"],
  },
];
