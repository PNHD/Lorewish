/**
 * Output moderation placeholder (MVP_SPEC.md §1.12, TECHNICAL_ARCHITECTURE.md
 * §5 `moderateContent`).
 *
 * No moderation provider is configured in this milestone — no AI provider
 * credential exists locally (see docs/NARRATIVE_MODEL_EVALUATION.md). This
 * is a documented, minimal deterministic stand-in so the
 * VALIDATING -> output moderation -> GENERATION_FAILED(output_blocked) path
 * in CONTINUOUS_PLAY_CONTRACT.md §3 is real and testable, not a TODO. A real
 * moderateContent call (provider-backed or a dedicated moderation API) MUST
 * replace this before any public/anonymous traffic reaches the generation
 * path — see docs/NARRATIVE_MODEL_EVALUATION.md's open item list.
 */

const BLOCKED_OUTPUT_PATTERNS = [/\b(csam|child sexual|bestiality)\b/i];

export interface ModerationResult {
  blocked: boolean;
  category: string | null;
}

export function moderateOutputText(text: string): ModerationResult {
  for (const pattern of BLOCKED_OUTPUT_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, category: "policy_violation_placeholder" };
    }
  }
  return { blocked: false, category: null };
}
