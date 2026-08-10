/**
 * Deterministic Narrative Quality Gate (NARRATIVE_QUALITY_CONTRACT.md §D).
 *
 * "Deterministic checks are preferred wherever a check can be made
 * deterministic." This module implements every check in §D's minimum set
 * that can be judged without a model-based critic. It does NOT judge
 * whether prose is beautiful — naturalness (§E) is a separate, qualitative
 * signal produced by the dev-only bakeoff harness's optional model-based
 * critic, never by this module.
 */

import type { ContentLanguage, StructuredGenerationResult } from "./types.ts";

export type QualityFailureCode =
  | "wrong_language"
  | "language_drift"
  | "language_mixing"
  | "empty_narrative"
  | "unresolved_template_token"
  | "duplicate_sentences"
  | "excessive_repetition"
  | "meta_ai_language"
  | "prohibited_continuation_copy"
  | "abrupt_pseudo_ending"
  | "malformed_choices";

export interface QualityGateResult {
  passed: boolean;
  failures: QualityFailureCode[];
}

const META_AI_PHRASES = [
  "as an ai",
  "as a language model",
  "i cannot generate",
  "i'm just an ai",
  "i am an ai",
  "as an ai language model",
];

// "To be continued" and close variants are prohibited copy in EVERY state,
// per CONTINUOUS_PLAY_CONTRACT.md §1 — this is the prose-level enforcement
// of that rule, checked before any scene can be materialized as canon.
const PROHIBITED_CONTINUATION_PATTERNS = [
  /to be continued/i,
  /còn tiếp/i,
  /sẽ được tiếp tục/i,
];

const ABRUPT_ENDING_PATTERNS = [/\bthe end\b\.?\s*$/i, /\bkết thúc\b\.?\s*$/i];

/** Very small, intentionally conservative Vietnamese-diacritic detector. */
const VIETNAMESE_DIACRITIC_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeForDuplicateCheck(sentence: string): string {
  return sentence.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

/** Deterministic expected-language check: presence/absence of Vietnamese diacritics is a strong, cheap signal for en vs vi. */
function detectLanguageMismatch(
  text: string,
  expected: ContentLanguage
): { wrongLanguage: boolean; drift: boolean } {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { wrongLanguage: false, drift: false };

  const expectsVietnamese = expected.startsWith("vi");
  const perSentenceHasDiacritics = sentences.map((s) => VIETNAMESE_DIACRITIC_RE.test(s));
  const overallHasDiacritics = perSentenceHasDiacritics.some(Boolean);

  // Word-level ratio rather than a sentence-count threshold, so a single
  // long sentence (no terminal punctuation splits) is still judged
  // correctly rather than needing >=2 sentences to trigger.
  const words = text.split(/\s+/).filter(Boolean);
  const diacriticWordCount = words.filter((w) => VIETNAMESE_DIACRITIC_RE.test(w)).length;
  const diacriticRatio = words.length > 0 ? diacriticWordCount / words.length : 0;

  // Wrong language outright: expected Vietnamese but nothing in the whole
  // scene carries a Vietnamese diacritic (a real Vietnamese scene of any
  // length reliably does), or expected English but a substantial share of
  // words carry one (a real English scene essentially never does, aside
  // from an occasional loanword/proper noun, which this ratio tolerates).
  const wrongLanguage = expectsVietnamese
    ? !overallHasDiacritics
    : words.length >= 4 && diacriticRatio > 0.15;

  // Drift: expected language holds for a contiguous prefix then flips for a
  // contiguous suffix (only meaningful once wrongLanguage is false and there
  // are enough sentences to show a boundary).
  let drift = false;
  if (!wrongLanguage && sentences.length >= 3) {
    const flags = expectsVietnamese ? perSentenceHasDiacritics : perSentenceHasDiacritics.map((v) => !v);
    const firstFalseIdx = flags.findIndex((v) => !v);
    if (firstFalseIdx > 0 && firstFalseIdx < flags.length - 1) {
      const tailAllFalse = flags.slice(firstFalseIdx).every((v) => !v);
      if (tailAllFalse) drift = true;
    }
  }

  return { wrongLanguage, drift };
}

/**
 * A narrow, deliberately conservative check: a long run (>= 4 consecutive
 * words) of plain-ASCII-only alphabetic words embedded inside otherwise
 * clearly Vietnamese prose, excluding short/likely-proper-noun runs.
 *
 * LW-M2-R2 fix: the original implementation used `\b[a-zA-Z]+(?:\s+[a-zA-Z]+){3,}\b`,
 * which JS's ASCII-only `\b`/`\w` treats as a word boundary right next to any
 * Vietnamese diacritic letter (which is not in `\w`). That silently splits a
 * single correct Vietnamese word like "mắt" into ASCII fragments ("m" before
 * the diacritic "ắt"), which can then chain together with genuinely separate
 * words into a false 4-token "English run" — found live via the Gemini
 * bakeoff on entirely correct Vietnamese prose ("... trong mắt ..." flagged
 * from the fragment "nghi trong m"). Operating on whole whitespace-delimited
 * words instead of sub-word regex matches — and requiring the WHOLE word
 * (after stripping surrounding punctuation) to be pure a-zA-Z — makes this
 * impossible: a word containing any Vietnamese diacritic can never itself
 * count as an "ASCII word", so it can never be silently fragmented into one.
 */
function detectLanguageMixing(text: string, expected: ContentLanguage): boolean {
  if (!expected.startsWith("vi")) return false;
  if (!VIETNAMESE_DIACRITIC_RE.test(text)) return false; // nothing to mix into

  const words = text.split(/\s+/).filter(Boolean);
  let run = 0;
  for (const raw of words) {
    const core = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""); // strip surrounding punctuation
    const isPureAsciiWord = core.length > 0 && /^[a-zA-Z]+$/.test(core);
    if (isPureAsciiWord) {
      run += 1;
      if (run >= 4) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

function detectDuplicateSentences(text: string): boolean {
  const sentences = splitSentences(text).map(normalizeForDuplicateCheck).filter((s) => s.length > 8);
  const seen = new Set<string>();
  for (const s of sentences) {
    if (seen.has(s)) return true;
    seen.add(s);
  }
  return false;
}

function detectExcessiveRepetition(text: string): boolean {
  // A phrase (3+ word n-gram) repeating 3+ times in one scene is well past
  // natural rhetorical repetition for a 40-90 word paragraph pacing target.
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 12) return false;
  const counts = new Map<string, number>();
  for (let i = 0; i + 3 <= words.length; i++) {
    const gram = words.slice(i, i + 3).join(" ");
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count >= 3) return true;
  }
  return false;
}

function detectMetaAiLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return META_AI_PHRASES.some((phrase) => lower.includes(phrase));
}

function detectUnresolvedTemplateTokens(text: string): boolean {
  return /\{\{\s*[\w.]+\s*\}\}/.test(text) || /\[\[\s*[\w.]+\s*\]\]/.test(text);
}

function detectProhibitedContinuationCopy(text: string): boolean {
  return PROHIBITED_CONTINUATION_PATTERNS.some((re) => re.test(text));
}

/**
 * Abrupt pseudo-ending: the prose-level counterpart to
 * CONTINUOUS_PLAY_CONTRACT.md §2's rule that boundary_kind=ending is never
 * inferred from output shape. If the model's PROSE reads like an ending
 * ("The End.") but the structured boundary_kind it returned is NOT "ending",
 * that is a contradiction the gate must catch — committing it would let a
 * pseudo-ending slip through under a non-terminal state.
 */
function detectAbruptPseudoEnding(text: string, boundaryKind: string): boolean {
  if (boundaryKind === "ending") return false;
  return ABRUPT_ENDING_PATTERNS.some((re) => re.test(text.trim()));
}

function detectMalformedChoices(result: StructuredGenerationResult): boolean {
  if (result.boundary_kind === "ending") return false; // no choices expected at a true ending
  const ids = result.next_choices.map((c) => c.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) return true; // duplicate choice ids
  const labels = result.next_choices.map((c) => c.label.trim().toLowerCase());
  const uniqueLabels = new Set(labels);
  return uniqueLabels.size !== labels.length; // cosmetic paraphrase duplicates
}

export function runQualityGate(
  result: StructuredGenerationResult,
  expectedLanguage: ContentLanguage
): QualityGateResult {
  const failures: QualityFailureCode[] = [];

  if (result.narrative.trim().length === 0) {
    failures.push("empty_narrative");
    // Nothing else is checkable meaningfully on empty prose.
    return { passed: false, failures };
  }

  const { wrongLanguage, drift } = detectLanguageMismatch(result.narrative, expectedLanguage);
  if (wrongLanguage) failures.push("wrong_language");
  if (drift) failures.push("language_drift");
  if (detectLanguageMixing(result.narrative, expectedLanguage)) failures.push("language_mixing");
  if (detectUnresolvedTemplateTokens(result.narrative)) failures.push("unresolved_template_token");
  if (detectDuplicateSentences(result.narrative)) failures.push("duplicate_sentences");
  if (detectExcessiveRepetition(result.narrative)) failures.push("excessive_repetition");
  if (detectMetaAiLanguage(result.narrative)) failures.push("meta_ai_language");
  if (detectProhibitedContinuationCopy(result.narrative)) failures.push("prohibited_continuation_copy");
  if (detectAbruptPseudoEnding(result.narrative, result.boundary_kind)) failures.push("abrupt_pseudo_ending");
  if (detectMalformedChoices(result)) failures.push("malformed_choices");

  return { passed: failures.length === 0, failures };
}
