import { describe, expect, it } from "vitest";
import { runQualityGate } from "./quality-gate.ts";
import type { StructuredGenerationResult } from "./types.ts";

function baseResult(overrides: Partial<StructuredGenerationResult> = {}): StructuredGenerationResult {
  return {
    narrative:
      "The lantern light wavered as you stepped into the hall. Dust rose from the old floorboards with every footfall. Somewhere ahead, a door swung shut on its own.",
    dialogue: [],
    state_changes: [],
    canon_candidates: [],
    next_choices: [
      { id: "advance", label: "Walk toward the sound" },
      { id: "retreat", label: "Back away slowly" },
    ],
    boundary_kind: "none",
    structured_outcome: {},
    ...overrides,
  };
}

describe("quality gate — QUALITY test category", () => {
  it("passes clean English prose", () => {
    const gate = runQualityGate(baseResult(), "en");
    expect(gate.passed).toBe(true);
    expect(gate.failures).toEqual([]);
  });

  it("passes clean Vietnamese prose written natively (not transliterated)", () => {
    const result = baseResult({
      narrative:
        "Ánh đèn lồng chao đảo khi bạn bước vào hành lang tối. Bụi bay lên từ những tấm ván sàn cũ kỹ theo từng bước chân. Đâu đó phía trước, một cánh cửa tự đóng sầm lại.",
    });
    const gate = runQualityGate(result, "vi");
    expect(gate.passed).toBe(true);
  });

  it("fails wrong-language generation: vi expected, en delivered", () => {
    const result = baseResult({ narrative: "The door creaks open in the wrong language entirely." });
    const gate = runQualityGate(result, "vi");
    expect(gate.passed).toBe(false);
    expect(gate.failures).toContain("wrong_language");
  });

  it("fails wrong-language generation: en expected, vi delivered", () => {
    const result = baseResult({
      narrative:
        "Cánh cửa kẽo kẹt mở ra bằng một ngôn ngữ hoàn toàn sai lầm và đây là câu thứ hai bằng tiếng Việt.",
    });
    const gate = runQualityGate(result, "en");
    expect(gate.passed).toBe(false);
    expect(gate.failures).toContain("wrong_language");
  });

  it("detects language drift from vi into en mid-scene", () => {
    const result = baseResult({
      narrative:
        "Ánh đèn lồng chao đảo khi bạn bước vào hành lang tối và bụi bay lên từ sàn nhà. " +
        "The door creaked further open. It kept creaking for a while longer now.",
    });
    const gate = runQualityGate(result, "vi");
    expect(gate.failures).toContain("language_drift");
  });

  it("flags malformed structured result: empty narrative", () => {
    const result = baseResult({ narrative: "" });
    const gate = runQualityGate(result, "en");
    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(["empty_narrative"]);
  });

  it("flags an abrupt pseudo-ending when boundary_kind was not set to ending", () => {
    const result = baseResult({ narrative: "You walk into the hall. The End." });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("abrupt_pseudo_ending");
  });

  it("does not flag pseudo-ending when boundary_kind genuinely is ending", () => {
    const result = baseResult({ narrative: "You walk into the hall. The End.", boundary_kind: "ending" });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).not.toContain("abrupt_pseudo_ending");
  });

  it("rejects 'to be continued' in every state (CONTINUOUS_PLAY_CONTRACT.md §1)", () => {
    const result = baseResult({ narrative: "You step through the door. To be continued." });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("prohibited_continuation_copy");
  });

  it("rejects the Vietnamese 'to be continued' equivalent", () => {
    const result = baseResult({
      narrative: "Ánh đèn lồng chao đảo khi bạn bước vào. Câu chuyện còn tiếp. Đâu đó phía trước có tiếng động.",
    });
    const gate = runQualityGate(result, "vi");
    expect(gate.failures).toContain("prohibited_continuation_copy");
  });

  it("detects an unresolved template token leaking into prose", () => {
    const result = baseResult({ narrative: "You step forward, {{player_name}} pauses at the threshold." });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("unresolved_template_token");
  });

  it("detects duplicate sentences within one scene", () => {
    const result = baseResult({
      narrative:
        "The lantern light wavered as you stepped into the hall. Something rustled far above. " +
        "The lantern light wavered as you stepped into the hall.",
    });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("duplicate_sentences");
  });

  it("detects excessive repetition of a short phrase", () => {
    const result = baseResult({
      narrative:
        "the shadow grows the shadow grows near the door the shadow grows again and the shadow grows once more tonight",
    });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("excessive_repetition");
  });

  it("catches generic 'as an AI' meta-language leakage", () => {
    const result = baseResult({ narrative: "As an AI, I will now describe the hallway for you in detail." });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("meta_ai_language");
  });

  it("LW-M2-R2: does not flag correct Vietnamese prose as language_mixing (regression — real repro from the live Gemini bakeoff)", () => {
    // Real narrative captured from a live gemini-3.6-flash bakeoff run. The
    // pre-fix detectLanguageMixing regex (`\b[a-zA-Z]+(?:\s+[a-zA-Z]+){3,}\b`)
    // treated JS's ASCII-only `\b`/`\w` boundary next to a diacritic letter as
    // splitting "mắt" into the ASCII fragment "m", which chained with
    // "nghi"/"trong" into a false 4-word "English run" ("nghi trong m") —
    // entirely correct Vietnamese prose, wrongly failed on every affected
    // case. See quality-gate.ts's detectLanguageMixing for the fix.
    const result = baseResult({
      narrative:
        "Dưới ánh đuốc chập chờn của trạm gác đèo Sương Thần, vị tướng già nheo mắt nhìn kỹ con dấu sáp đỏ trên tờ chiếu chỉ. " +
        "Gió lạnh từ phương bắc rít qua từng khe đá, mang theo mùi khét nhạt nhòa của ma thuật tàn tích. " +
        "Ông ta chậm rãi cuộn tờ giấy lại, ngón tay gõ nhịp đều đặn lên chuôi kiếm chằng chịt vết sẹo. " +
        "Sự hoài nghi trong mắt vị tướng vẫn chưa hề tan biến khi ánh nhìn của ông ta dừng lại ở chiếc hộp phong ấn trên lưng bạn.",
    });
    const gate = runQualityGate(result, "vi");
    expect(gate.failures).not.toContain("language_mixing");
    expect(gate.passed).toBe(true);
  });

  it("still detects a genuine 4+-word English sentence fragment embedded in Vietnamese prose", () => {
    const result = baseResult({
      narrative:
        "Ánh đèn lồng chao đảo khi bạn bước vào hành lang tối. " +
        "She looked at him and smiled warmly before turning away. " +
        "Đâu đó phía trước, một cánh cửa tự đóng sầm lại.",
    });
    const gate = runQualityGate(result, "vi");
    expect(gate.failures).toContain("language_mixing");
  });

  it("does not flag a short (<=3 word) English proper-noun-shaped fragment as mixing", () => {
    // "chữ" and "được" both carry diacritics, so they correctly bound the
    // English run to exactly 3 words (Grand, Hotel, Lobby) — below the >= 4
    // threshold. (An earlier draft of this test used an accent-free
    // Vietnamese word directly adjacent to the English fragment, which
    // legitimately extends the counted run — a real, pre-existing limitation
    // of an accent-presence heuristic, not something this fix changes.)
    const result = baseResult({
      narrative:
        "Ánh đèn lồng chao đảo khi bạn bước vào hành lang tối, nơi tấm biển đề chữ Grand Hotel Lobby được treo lệch. " +
        "Đâu đó phía trước, một cánh cửa tự đóng sầm lại.",
    });
    const gate = runQualityGate(result, "vi");
    expect(gate.failures).not.toContain("language_mixing");
  });

  it("flags cosmetic-paraphrase choices as malformed", () => {
    const result = baseResult({
      next_choices: [
        { id: "yes", label: "Yes" },
        { id: "sure", label: "yes" },
      ],
    });
    const gate = runQualityGate(result, "en");
    expect(gate.failures).toContain("malformed_choices");
  });

  it("requires 2-4 choices for every non-ending scene", () => {
    expect(runQualityGate(baseResult({ next_choices: [] }), "en").failures).toContain(
      "malformed_choices"
    );
    expect(
      runQualityGate(baseResult({ next_choices: [{ id: "only", label: "Only option" }] }), "en")
        .failures
    ).toContain("malformed_choices");
    expect(
      runQualityGate(baseResult({ boundary_kind: "ending", next_choices: [] }), "en").failures
    ).not.toContain("malformed_choices");
  });
});
