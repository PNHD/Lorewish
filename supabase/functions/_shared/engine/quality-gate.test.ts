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
});
