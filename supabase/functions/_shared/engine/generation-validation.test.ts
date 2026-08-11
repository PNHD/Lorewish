import { describe, expect, it } from "vitest";
import { evaluateGeneratedResult } from "./generation-validation.ts";

const valid = {
  narrative: "The old gate opens and the road continues beyond it.",
  dialogue: [],
  state_changes: [],
  canon_candidates: [],
  next_choices: [
    { id: "continue", label: "Continue down the road" },
    { id: "wait", label: "Wait beside the gate" },
  ],
  boundary_kind: "none",
  structured_outcome: { rolled: false },
};

describe("generation failure classification", () => {
  it("distinguishes missing fields from generic wrong shape", () => {
    expect(evaluateGeneratedResult({ boundary_kind: "none" }, "en")).toMatchObject({
      ok: false,
      failureClass: "missing_required_fields",
    });
    expect(evaluateGeneratedResult({ ...valid, narrative: 42 }, "en")).toMatchObject({
      ok: false,
      failureClass: "valid_json_wrong_shape",
    });
  });

  it("classifies invalid choice structure and quality-gate duplicate choices", () => {
    expect(evaluateGeneratedResult({ ...valid, next_choices: [{ id: "x" }] }, "en")).toMatchObject({
      ok: false,
      failureClass: "invalid_choices",
    });
    expect(
      evaluateGeneratedResult(
        { ...valid, next_choices: [{ id: "x", label: "Go" }, { id: "x", label: "Wait" }] },
        "en"
      )
    ).toMatchObject({ ok: false, failureClass: "invalid_choices" });
  });

  it("classifies language failures separately from other quality failures", () => {
    expect(
      evaluateGeneratedResult(
        { ...valid, narrative: "Bạn bước qua cánh cổng và tiếp tục trên con đường phía trước." },
        "en"
      )
    ).toMatchObject({ ok: false, failureClass: "language_failure" });
    expect(
      evaluateGeneratedResult({ ...valid, narrative: "As an AI, I cannot continue this story." }, "en")
    ).toMatchObject({ ok: false, failureClass: "quality_gate" });
  });

  it("gives language repair an actionable target language instead of only an internal code", () => {
    const failure = evaluateGeneratedResult(
      { ...valid, narrative: "Bạn bước qua cánh cổng và tiếp tục trên con đường phía trước." },
      "en"
    );
    expect(failure).toMatchObject({ ok: false, failureClass: "language_failure" });
    if (!failure.ok) expect(failure.repairInstruction).toContain("entirely in English");
  });

  it("rejects a first scene that silently replaces a configured character identity", () => {
    const configured = [
      {
        name: "Captain Ysolde Marrow",
        aliases: ["Marrow"],
        description: "guard captain",
        storyRelationship: "first person to meet the player",
      },
    ];
    expect(evaluateGeneratedResult(valid, "en", configured)).toMatchObject({
      ok: false,
      qualityFailures: ["character_identity_missing"],
    });
    expect(
      evaluateGeneratedResult(
        { ...valid, narrative: "Captain Ysolde Marrow opens the gate and studies you carefully." },
        "en",
        configured
      )
    ).toMatchObject({ ok: true });
  });

  it("accepts a Vietnamese opening identified by the complete configured address register", () => {
    const configured = [
      {
        name: "Biên tập viên Thảo Chi",
        aliases: ["Thảo Chi", "chị Chi"],
        description: "the strict editor",
        storyRelationship: "the player's co-creator",
        addressTerms: {
          speakerSelfReference: "em",
          speakerAddressesTargetAs: "chị",
          targetSelfReference: "chị",
          targetAddressesSpeakerAs: "em",
        },
      },
    ];
    expect(
      evaluateGeneratedResult(
        {
          ...valid,
          narrative: "Chị đặt bản thảo xuống và nhìn thẳng sang em.",
          dialogue: [
            { speaker: "Biên tập viên", line: "Chị cần em sửa phần này trước ngày mai." },
            { speaker: "Người họa sĩ", line: "Em hiểu, chị cứ nói rõ từng điểm." },
          ],
        },
        "vi",
        configured
      )
    ).toMatchObject({ ok: true });
  });
});
