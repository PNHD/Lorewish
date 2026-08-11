import { moderateOutputText } from "./moderation.ts";
import { storyDialogueHasAddressTermDrift } from "./address-terms.ts";
import { runQualityGate, type QualityFailureCode } from "./quality-gate.ts";
import {
  StructuredGenerationResultSchema,
  type ContentLanguage,
  type ContextCharacter,
  type StructuredGenerationResult,
} from "./types.ts";

export type GenerationQualityFailure = QualityFailureCode | "address_terms_drift" | "character_identity_missing" | "character_memory_unknown" | "runtime_character_duplicate";

export type SanitizedGenerationFailureClass =
  | "invalid_json"
  | "truncated_json"
  | "valid_json_wrong_shape"
  | "missing_required_fields"
  | "invalid_choices"
  | "quality_gate"
  | "language_failure"
  | "provider_transport"
  | "provider_http"
  | "timeout"
  | "output_blocked"
  | "other";

export type GenerationValidationResult =
  | { ok: true; result: StructuredGenerationResult; qualityFailures: []; schemaIssues: []; repairInstruction: null }
  | {
      ok: false;
      failureClass: SanitizedGenerationFailureClass;
      pipelineErrorClass: "output_blocked" | "unusable_output";
      qualityFailures: GenerationQualityFailure[];
      schemaIssues: { path: string; code: string }[];
      repairInstruction: string;
    };

function classifySchemaFailure(issues: { code: string; path: PropertyKey[]; received?: unknown }[]): SanitizedGenerationFailureClass {
  if (issues.some((issue) => issue.path[0] === "next_choices")) return "invalid_choices";
  if (issues.some((issue) => issue.code === "invalid_type" && issue.received === "undefined")) {
    return "missing_required_fields";
  }
  return "valid_json_wrong_shape";
}

function classifyQualityFailure(failures: QualityFailureCode[]): SanitizedGenerationFailureClass {
  if (failures.includes("malformed_choices")) return "invalid_choices";
  if (
    failures.some((failure) =>
      (["wrong_language", "language_drift", "language_mixing"] as QualityFailureCode[]).includes(failure)
    )
  ) {
    return "language_failure";
  }
  return "quality_gate";
}

/** Lorewish's authoritative semantic validation, shared by live pipeline and soak harness. */
export function evaluateGeneratedResult(
  raw: unknown,
  language: ContentLanguage,
  requiredStartingCharacters: ContextCharacter[] = [],
  availableCharacters: ContextCharacter[] = requiredStartingCharacters
): GenerationValidationResult {
  const parsed = StructuredGenerationResultSchema.safeParse(raw);
  if (!parsed.success) {
    const schemaIssues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code }));
    const factKeyFailure = schemaIssues.some((issue) =>
      /^canon_candidates\.\d+\.fact_key$/.test(issue.path)
    );
    return {
      ok: false,
      failureClass: classifySchemaFailure(parsed.error.issues),
      pipelineErrorClass: "unusable_output",
      qualityFailures: [],
      schemaIssues,
      repairInstruction: factKeyFailure
        ? "canon_candidates fact_key failed validation; every fact_key must be ASCII lowercase snake_case matching ^[a-z][a-z0-9_]{1,79}$, including in Vietnamese stories"
        : `structured result failed schema validation at: ${schemaIssues.map((issue) => `${issue.path || "root"} (${issue.code})`).join(", ")}`,
    };
  }

  const moderation = moderateOutputText(parsed.data.narrative);
  if (moderation.blocked) {
    return {
      ok: false,
      failureClass: "output_blocked",
      pipelineErrorClass: "output_blocked",
      qualityFailures: [],
      schemaIssues: [],
      repairInstruction: "output was blocked by moderation",
    };
  }

  const availableCharacterIds = new Set(availableCharacters.map((character) => character.id));
  if (
    parsed.data.character_memory_candidates.some(
      (candidate) => !availableCharacterIds.has(candidate.character_id)
    )
  ) {
    return {
      ok: false,
      failureClass: "valid_json_wrong_shape",
      pipelineErrorClass: "unusable_output",
      qualityFailures: ["character_memory_unknown"],
      schemaIssues: [],
      repairInstruction: "character memory referenced an unknown character_id; copy the UUID exactly from CHARACTER IDENTITY",
    };
  }

  const existingIdentityKeys = new Set(
    availableCharacters
      .flatMap((character) => [character.name, ...character.aliases])
      .map((value) => value.trim().toLocaleLowerCase(language).replace(/\s+/g, " "))
  );
  const duplicatesExistingCharacter = parsed.data.new_character_candidates.some((candidate) =>
    [candidate.name, ...candidate.aliases]
      .map((value) => value.trim().toLocaleLowerCase(language).replace(/\s+/g, " "))
      .some((identity) => existingIdentityKeys.has(identity))
  );
  if (duplicatesExistingCharacter) {
    return {
      ok: false,
      failureClass: "valid_json_wrong_shape",
      pipelineErrorClass: "unusable_output",
      qualityFailures: ["runtime_character_duplicate"],
      schemaIssues: [],
      repairInstruction: "new_character_candidates duplicated an existing canonical name or alias; omit existing characters and do not fuzzy-merge identities",
    };
  }

  if (language === "vi" && storyDialogueHasAddressTermDrift(parsed.data.dialogue, availableCharacters)) {
    return {
      ok: false,
      failureClass: "quality_gate",
      pipelineErrorClass: "unusable_output",
      qualityFailures: ["address_terms_drift"],
      schemaIssues: [],
      repairInstruction: "Vietnamese address terms drifted; rewrite every participant dialogue line using exactly the configured player-self/player-to-character/character-self/character-to-player terms and no substitute pronouns",
    };
  }

  if (requiredStartingCharacters.length > 0) {
    const identitySurface = [
      parsed.data.narrative,
      ...parsed.data.dialogue.flatMap((line) => [line.speaker, line.line]),
    ]
      .join("\n")
      .toLocaleLowerCase(language);
    const missingIdentity = requiredStartingCharacters.some((character) => {
      const namedIdentityPresent = [character.name, ...character.aliases].some((identity) =>
        identitySurface.includes(identity.toLocaleLowerCase(language))
      );
      // Vietnamese dialogue can identify the authored participant through a
      // stable reciprocal address register without unnaturally repeating the
      // proper name. Require every configured term; one generic pronoun alone
      // is not sufficient identity evidence.
      const addressIdentityPresent = character.addressTerms
        ? Object.values(character.addressTerms).every((term) =>
            identitySurface.includes(term.toLocaleLowerCase(language))
          )
        : false;
      return !namedIdentityPresent && !addressIdentityPresent;
    });
    if (missingIdentity) {
      return {
        ok: false,
        failureClass: "quality_gate",
        pipelineErrorClass: "unusable_output",
        qualityFailures: ["character_identity_missing"],
        schemaIssues: [],
        repairInstruction: "configured canonical starting character identity was missing; use the configured name or alias and do not replace the character",
      };
    }
  }

  const quality = runQualityGate(parsed.data, language);
  if (!quality.passed) {
    const languageFailure = quality.failures.some((failure) =>
      (["wrong_language", "language_drift", "language_mixing"] as QualityFailureCode[]).includes(failure)
    );
    return {
      ok: false,
      failureClass: classifyQualityFailure(quality.failures),
      pipelineErrorClass: "unusable_output",
      qualityFailures: quality.failures,
      schemaIssues: [],
      repairInstruction: languageFailure
        ? `language validation failed; rewrite every narrative, dialogue, state change, canon fact, and choice label entirely in ${language === "vi" ? "Vietnamese" : "English"}, except established proper names; do not add untranslated foreign-language phrases`
        : `quality gate failed: ${quality.failures.join(", ")}`,
    };
  }

  return { ok: true, result: parsed.data, qualityFailures: [], schemaIssues: [], repairInstruction: null };
}
