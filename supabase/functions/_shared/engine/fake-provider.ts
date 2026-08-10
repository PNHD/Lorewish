/**
 * A deterministic, dependency-free NarrativeProvider used for tests and for
 * dev/local operation of the engine when no real AI provider credential is
 * configured (see docs/NARRATIVE_MODEL_EVALUATION.md —
 * NARRATIVE_PROVIDER_CREDENTIAL_REQUIRED). It never calls the network.
 *
 * It is intentionally NOT a quality bar for "reads like natural human
 * narrative" — that bar can only be met and evaluated by a real model (see
 * the Model Bakeoff Harness). This provider exists to exercise the turn
 * state machine, the quality gate, idempotency and the atomic commit path
 * end to end without spending money or requiring network access.
 *
 * Special trigger substrings in a custom action let tests deterministically
 * exercise failure paths without needing a mock framework:
 *   "__SIMULATE_TIMEOUT__"      -> throws ProviderTransportError
 *   "__SIMULATE_WRONG_LANGUAGE__" -> returns prose in the other language
 *   "__SIMULATE_TEMPLATE_LEAK__"  -> leaves an unresolved {{token}} in prose
 *   "__SIMULATE_TO_BE_CONTINUED__" -> emits prohibited CPC copy
 *   "__SIMULATE_EMPTY__"        -> returns an empty narrative
 */

import type {
  ContentLanguage,
  NarrativeContext,
  NarrativeProvider,
  ProviderCallResult,
} from "./types.ts";
import { ProviderTransportError } from "./types.ts";

const EN_OPENERS = [
  "The door creaks open before you decide whether to knock.",
  "Rain needles the window while the lamp gutters low.",
  "Somewhere past the treeline, something answers your steps with its own.",
];

const VI_OPENERS = [
  "Cánh cửa kẽo kẹt mở ra trước khi bạn kịp quyết định có nên gõ hay không.",
  "Mưa rơi lộp độp trên khung cửa sổ trong khi ngọn đèn dầu chập chờn.",
  "Đâu đó sau rặng cây, có thứ gì đó đáp lại từng bước chân của bạn.",
];

function pick<T>(arr: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[hash % arr.length];
}

function opener(contentLanguage: ContentLanguage, seed: string): string {
  return contentLanguage.startsWith("vi") ? pick(VI_OPENERS, seed) : pick(EN_OPENERS, seed);
}

function describeAction(context: NarrativeContext): string {
  if (context.actionType === "start") {
    return context.contentLanguage.startsWith("vi")
      ? `Câu chuyện bắt đầu: ${context.premise}`
      : `The story begins: ${context.premise}`;
  }
  const action = context.selectedChoiceLabel ?? context.playerAction ?? "";
  return context.contentLanguage.startsWith("vi")
    ? `Bạn quyết định: ${action}.`
    : `You decide: ${action}.`;
}

function buildChoices(contentLanguage: ContentLanguage, seed: string) {
  const en = [
    { id: "press_forward", label: "Press forward into the dark" },
    { id: "call_out", label: "Call out and announce yourself" },
    { id: "search_surroundings", label: "Search your surroundings first" },
  ];
  const vi = [
    { id: "press_forward", label: "Tiến thẳng vào bóng tối" },
    { id: "call_out", label: "Lên tiếng để báo hiệu sự hiện diện của mình" },
    { id: "search_surroundings", label: "Quan sát xung quanh trước đã" },
  ];
  const source = contentLanguage.startsWith("vi") ? vi : en;
  // Two or three choices, varied deterministically by seed — never identical
  // cosmetic paraphrases (NEXT CHOICES section of the task brief already
  // guarantees distinctness because these three represent materially
  // different intents: advance, signal, investigate).
  const count = 2 + (seed.length % 2);
  return source.slice(0, count);
}

export class FakeNarrativeProvider implements NarrativeProvider {
  readonly id = "fake-deterministic";

  async generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    const seed = `${context.actionType}:${context.playerAction ?? ""}:${context.recentScenes.length}`;
    const start = performance.now();
    const raw = context.playerAction ?? "";

    if (raw.includes("__SIMULATE_TIMEOUT__")) {
      throw new ProviderTransportError("fake provider: simulated transport timeout");
    }

    let narrative = `${opener(context.contentLanguage, seed)} ${describeAction(context)}`;
    let boundary_kind: "none" | "checkpoint" | "ending" = "none";

    if (raw.includes("__SIMULATE_WRONG_LANGUAGE__")) {
      // Emit the OTHER language than the one requested, to exercise the
      // quality gate's expected-language check.
      narrative = context.contentLanguage.startsWith("vi")
        ? "The door creaks open in the wrong language entirely."
        : "Cánh cửa kẽo kẹt mở ra bằng một ngôn ngữ hoàn toàn sai.";
    }
    if (raw.includes("__SIMULATE_TEMPLATE_LEAK__")) {
      narrative += " {{player_name}} paused.";
    }
    if (raw.includes("__SIMULATE_TO_BE_CONTINUED__")) {
      narrative += " To be continued.";
    }
    if (raw.includes("__SIMULATE_EMPTY__")) {
      narrative = "";
    }
    if (raw.includes("__SIMULATE_ENDING__")) {
      boundary_kind = "ending";
      narrative += context.contentLanguage.startsWith("vi")
        ? " Câu chuyện khép lại tại đây, trọn vẹn."
        : " The story closes here, complete.";
    }
    if (raw.includes("__SIMULATE_CHECKPOINT__")) {
      boundary_kind = "checkpoint";
    }

    const latencyMs = Math.round(performance.now() - start) + 5;

    return {
      result: {
        narrative,
        dialogue: [],
        state_changes: context.actionType === "start" ? [] : ["A small consequence was noted."],
        canon_candidates:
          context.actionType === "start"
            ? [
                {
                  scope: "run",
                  fact_key: "story_started",
                  fact_text: context.contentLanguage.startsWith("vi")
                    ? `Câu chuyện bắt đầu với: ${context.premise}`
                    : `The story began with: ${context.premise}`,
                },
              ]
            : [],
        next_choices: boundary_kind === "ending" ? [] : buildChoices(context.contentLanguage, seed),
        boundary_kind,
        structured_outcome: {},
      },
      metadata: {
        provider: this.id,
        model: "fake-v1",
        inputTokens: Math.max(1, Math.round(JSON.stringify(context).length / 4)),
        outputTokens: Math.max(1, Math.round(narrative.length / 4)),
        costMicros: 0,
        latencyMs,
      },
    };
  }
}
