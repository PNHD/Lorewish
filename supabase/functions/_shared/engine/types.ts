/**
 * Shared, runtime-agnostic types for the M2 story engine.
 *
 * Deliberately dependency-free beyond zod (works via `npm:zod` under Deno in
 * the Edge Functions and as a normal npm dependency under Node/vitest for
 * tests) so this module is importable from both runtimes without a build
 * step or code duplication. Do not import anything Deno-only (`Deno.*`) or
 * Node-only (`node:*`) here — see supabase/functions/_shared/engine/README
 * if one gets added; for now this comment is the boundary contract.
 */

import { z } from "zod";

/** `en` | `vi` at launch (NARRATIVE_QUALITY_CONTRACT.md §B) — BCP-47-shaped, not a closed enum, to match the stories.content_language column. */
export const ContentLanguageSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/);
export type ContentLanguage = z.infer<typeof ContentLanguageSchema>;

export const BoundaryKindSchema = z.enum(["none", "checkpoint", "ending"]);
export type BoundaryKind = z.infer<typeof BoundaryKindSchema>;

export const ActionTypeSchema = z.enum(["start", "choice", "custom_action"]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

/** UX_CONTRACT.md §1A DIALOGUE channel — one attributed line. */
export const DialogueLineSchema = z.object({
  speaker: z.string().min(1).max(200),
  line: z.string().min(1).max(2000),
});
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

/** UX_CONTRACT.md §1A SYSTEM/STATE CHANGE channel — short labels, never prose. */
export const StateChangeItemSchema = z.string().min(1).max(160);

/** 2-4 predefined next actions (NEXT CHOICES section of the task brief). */
export const ChoiceOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

/** A candidate durable fact the provider proposes; the app decides what to keep (DOMAIN_MODEL.md §5). */
export const CanonCandidateSchema = z.object({
  scope: z.enum(["run", "branch"]),
  fact_key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{1,79}$/),
  fact_text: z.string().min(1).max(500),
});
export type CanonCandidate = z.infer<typeof CanonCandidateSchema>;

/** Light Roll outcome (ADVENTURE mode only) — server decides the roll, never the model. */
export const StructuredOutcomeSchema = z
  .object({
    rolled: z.boolean().default(false),
    band: z.enum(["success", "partial", "fail"]).optional(),
  })
  .catchall(z.unknown());

/**
 * The server-validated shape a provider MUST produce (STRUCTURED GENERATION
 * CONTRACT in the task brief). Provider JSON never maps directly into the
 * database — this schema, and the quality gate in quality-gate.ts, sit
 * between provider output and lw_commit_turn.
 */
export const StructuredGenerationResultSchema = z.object({
  narrative: z.string().min(1).max(8000),
  dialogue: z.array(DialogueLineSchema).max(20).default([]),
  state_changes: z.array(StateChangeItemSchema).max(10).default([]),
  canon_candidates: z.array(CanonCandidateSchema).max(10).default([]),
  next_choices: z.array(ChoiceOptionSchema).min(0).max(4).default([]),
  boundary_kind: BoundaryKindSchema.default("none"),
  structured_outcome: StructuredOutcomeSchema.default({}),
});
export type StructuredGenerationResult = z.infer<
  typeof StructuredGenerationResultSchema
>;

/**
 * Vietnamese four-slot address model (NARRATIVE_QUALITY_CONTRACT.md §C).
 * Conceptual plumbing carried through context in M2; CharacterRelationship
 * (run-scoped, M3) is what will eventually populate this per NPC. English
 * stories never populate this with placeholder Vietnamese-shaped data.
 */
export const AddressTermsSchema = z.object({
  speakerSelfReference: z.string().min(1).max(40),
  speakerAddressesTargetAs: z.string().min(1).max(40),
  targetSelfReference: z.string().min(1).max(40),
  targetAddressesSpeakerAs: z.string().min(1).max(40),
});
export type AddressTerms = z.infer<typeof AddressTermsSchema>;

export const StartingCharacterSchema = z
  .object({
    name: z.string().min(1).max(200),
    identity: z.string().min(1).max(1000),
    relationship: z.string().min(1).max(500),
    addressTerms: AddressTermsSchema.optional(),
  })
  .strict();
export type StartingCharacter = z.infer<typeof StartingCharacterSchema>;

/** Minimal M2-R3 turn-1 bootstrap only; advanced setup remains M3. */
export const StorySetupSchema = z
  .object({
    premise: z.string().min(1).max(5000),
    genre: z.string().min(1).max(80),
    contentLanguage: ContentLanguageSchema,
    storyMode: z.enum(["narrative", "adventure"]),
    startingCharacter: StartingCharacterSchema.optional(),
  })
  .strict();
export type StorySetup = z.infer<typeof StorySetupSchema>;

/** A single prior scene, trimmed to what context assembly needs. */
export interface ContextScene {
  seqInBranch: number;
  boundaryKind: BoundaryKind;
  narrative: string;
  dialogue: DialogueLine[];
  stateChangeSummary: string[];
  playerAction: string | null;
}

export interface ContextCanonFact {
  scope: "run" | "branch";
  factKey: string;
  factText: string;
  createdAt: string;
}

export interface ContextCharacter {
  name: string;
  aliases: string[];
  description: string | null;
  storyRelationship: string | null;
  /** Present only when contentLanguage calls for it (NARRATIVE_QUALITY_CONTRACT.md §C). */
  addressTerms?: AddressTerms;
}

/** The bounded, assembled input handed to a NarrativeProvider (DOMAIN_MODEL.md §7). */
export interface NarrativeContext {
  contentLanguage: ContentLanguage;
  genre: string;
  storyMode: "narrative" | "adventure";
  premise: string;
  worldSetting: string | null;
  playerRole: string | null;
  tone: "light" | "balanced" | "dark" | null;
  narrativePov: "first_person" | "second_person" | "third_person" | null;
  characters: ContextCharacter[];
  recentScenes: ContextScene[];
  /** Older branch history beyond the recent-scene budget, summarized (DOMAIN_MODEL.md §7). */
  olderHistorySummary: string | null;
  canonFacts: ContextCanonFact[];
  actionType: ActionType;
  playerAction: string | null;
  selectedChoiceLabel: string | null;
  /** Set only when a repair attempt is running (NARRATIVE_QUALITY_CONTRACT.md §D repair loop). */
  repairReason: string | null;
}

export interface ProviderCallMetadata {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  costMicros: number;
  latencyMs: number;
}

export interface ProviderCallResult {
  /** Provider payload before Lorewish's authoritative Zod validation. */
  result: unknown;
  metadata: ProviderCallMetadata;
}

/** Raised by a provider adapter for a transport-level failure (timeout, 5xx, connection reset). */
export class ProviderTransportError extends Error {
  readonly failureKind: "timeout" | "provider_http" | "provider_transport";

  constructor(
    message: string,
    failureKind: "timeout" | "provider_http" | "provider_transport" = "provider_transport"
  ) {
    super(message);
    this.name = "ProviderTransportError";
    this.failureKind = failureKind;
  }
}

/**
 * A billed provider call completed, but its structured payload could not be
 * parsed. Metadata is retained so failed/repair calls are still costed.
 */
export class ProviderOutputError extends Error {
  readonly failureKind: "invalid_json" | "truncated_json" | "provider_response";
  readonly metadata: ProviderCallMetadata;

  constructor(
    message: string,
    failureKind: "invalid_json" | "truncated_json" | "provider_response",
    metadata: ProviderCallMetadata
  ) {
    super(message);
    this.name = "ProviderOutputError";
    this.failureKind = failureKind;
    this.metadata = metadata;
  }
}

/**
 * Provider-agnostic gateway boundary (AI PROVIDER ARCHITECTURE in the task
 * brief). Never called from a browser/native client — only from this Edge
 * Function's server-side code.
 */
export interface NarrativeProvider {
  readonly id: string;
  generateTurn(context: NarrativeContext): Promise<ProviderCallResult>;
}
