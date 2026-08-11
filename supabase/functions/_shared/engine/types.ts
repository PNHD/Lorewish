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

export const CharacterMemoryTypeSchema = z.enum([
  "player_fact",
  "character_fact",
  "relationship_fact",
  "shared_event",
  "promise",
  "discovery",
]);
export type CharacterMemoryType = z.infer<typeof CharacterMemoryTypeSchema>;

/**
 * Character-scoped durable memory proposed by the same validated generation
 * call as the Scene. `fact_key` is the deterministic conflict/supersession
 * key; the database resolves it only against facts visible in this branch.
 */
export const CharacterMemoryCandidateSchema = z.object({
  character_id: z.string().uuid(),
  memory_type: CharacterMemoryTypeSchema,
  fact_key: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  fact_text: z.string().min(1).max(500),
  salience: z.number().int().min(1).max(5).default(3),
});
export type CharacterMemoryCandidate = z.infer<typeof CharacterMemoryCandidateSchema>;

/**
 * A notable NPC proposed by the same Story generation call that creates the
 * Scene where they first appear. The provider supplies identity only; the
 * canonical UUID and provenance are owned by the database commit.
 */
export const RuntimeCharacterCandidateSchema = z
  .object({
    temporary_key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    name: z.string().min(1).max(200),
    role: z.string().min(1).max(500),
    description: z.string().min(1).max(2000),
    relationship: z.string().min(1).max(500),
    aliases: z.array(z.string().min(1).max(200)).max(10).default([]),
  })
  .strict();
export type RuntimeCharacterCandidate = z.infer<typeof RuntimeCharacterCandidateSchema>;

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
export const StructuredGenerationResultSchema = z
  .object({
    narrative: z.string().min(1).max(8000),
    dialogue: z.array(DialogueLineSchema).max(20).default([]),
    state_changes: z.array(StateChangeItemSchema).max(10).default([]),
    canon_candidates: z.array(CanonCandidateSchema).max(10).default([]),
    character_memory_candidates: z.array(CharacterMemoryCandidateSchema).max(10).default([]),
    new_character_candidates: z.array(RuntimeCharacterCandidateSchema).max(3).default([]),
    next_choices: z.array(ChoiceOptionSchema).min(0).max(4).default([]),
    boundary_kind: BoundaryKindSchema.default("none"),
    structured_outcome: StructuredOutcomeSchema.default({}),
  })
  .superRefine((result, ctx) => {
    const keys = new Set<string>();
    result.character_memory_candidates.forEach((candidate, index) => {
      const key = `${candidate.character_id}:${candidate.fact_key}`;
      if (keys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["character_memory_candidates", index, "fact_key"],
          message: "duplicate character memory key in one generation result",
        });
      }
      keys.add(key);
    });
    const temporaryKeys = new Set<string>();
    const normalizedNames = new Set<string>();
    result.new_character_candidates.forEach((candidate, index) => {
      const normalizedName = candidate.name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
      if (temporaryKeys.has(candidate.temporary_key)) {
        ctx.addIssue({ code: "custom", path: ["new_character_candidates", index, "temporary_key"], message: "duplicate temporary character key" });
      }
      if (normalizedNames.has(normalizedName)) {
        ctx.addIssue({ code: "custom", path: ["new_character_candidates", index, "name"], message: "duplicate normalized character name" });
      }
      temporaryKeys.add(candidate.temporary_key);
      normalizedNames.add(normalizedName);
    });
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
    role: z.string().min(1).max(500),
    description: z.string().max(2000).optional(),
    relationship: z.string().min(1).max(500),
    aliases: z.array(z.string().min(1).max(200)).max(10).default([]),
    addressTerms: AddressTermsSchema.optional(),
  })
  .strict();
export type StartingCharacter = z.infer<typeof StartingCharacterSchema>;

/** Quick Start defaults and Advanced Setup share this canonical input shape. */
export const StorySetupSchema = z
  .object({
    premise: z.string().min(1).max(4000),
    genre: z.string().min(1).max(80),
    contentLanguage: ContentLanguageSchema,
    storyMode: z.enum(["narrative", "adventure"]),
    worldSetting: z.string().max(4000).optional(),
    tone: z.enum(["light", "balanced", "dark"]).default("balanced"),
    narrativePov: z.enum(["first_person", "second_person", "third_person"]).default("second_person"),
    playerRole: z.string().min(1).max(1000),
    playerName: z.string().max(200).optional(),
    playerDescription: z.string().max(2000).optional(),
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
  id: string;
  scope: "run" | "branch";
  factKey: string;
  factText: string;
  createdAt: string;
}

export interface ContextCharacterMemory {
  id: string;
  characterId: string;
  characterName: string;
  memoryType: CharacterMemoryType;
  factKey: string;
  factText: string;
  salience: number;
  supersedesFactId: string | null;
  createdAt: string;
}

export interface ContextCharacter {
  id: string;
  name: string;
  aliases: string[];
  role: string | null;
  description: string | null;
  storyRelationship: string | null;
  origin?: "authored" | "runtime";
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
  playerName: string | null;
  playerDescription: string | null;
  tone: "light" | "balanced" | "dark" | null;
  narrativePov: "first_person" | "second_person" | "third_person" | null;
  characters: ContextCharacter[];
  recentScenes: ContextScene[];
  /** Older branch history beyond the recent-scene budget, summarized (DOMAIN_MODEL.md §7). */
  olderHistorySummary: string | null;
  characterMemories: ContextCharacterMemory[];
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

export const ChatMemoryCandidateSchema = z.object({
  memory_type: CharacterMemoryTypeSchema,
  fact_key: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  fact_text: z.string().min(1).max(500),
  salience: z.number().int().min(1).max(5),
}).strict();
export type ChatMemoryCandidate = z.infer<typeof ChatMemoryCandidateSchema>;

export const CharacterChatResultSchema = z.object({
  reply: z.string().min(1).max(4000),
  chat_memory_candidates: z.array(ChatMemoryCandidateSchema).max(5).default([]),
}).strict();
export type CharacterChatResult = z.infer<typeof CharacterChatResultSchema>;

export interface ChatMessageContext {
  role: "player" | "character";
  content: string;
}

/** Explicitly separated context sections for a branch-bound side conversation. */
export interface CharacterChatContext {
  contentLanguage: ContentLanguage;
  genre: string;
  storyMode: "narrative" | "adventure";
  premise: string;
  worldSetting: string | null;
  playerRole: string | null;
  playerName: string | null;
  playerDescription: string | null;
  character: ContextCharacter;
  recentScenes: ContextScene[];
  characterMemories: ContextCharacterMemory[];
  recentChat: ChatMessageContext[];
  playerMessage: string;
}

export interface CharacterChatProvider {
  readonly id: string;
  generateChat(context: CharacterChatContext): Promise<ProviderCallResult>;
}
