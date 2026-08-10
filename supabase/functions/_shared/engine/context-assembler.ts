/**
 * Bounded Context Assembler (DOMAIN_MODEL.md §7, D19).
 *
 * "Assemble the relevant canon" without a ceiling means the context, and
 * therefore the cost, of generating scene N grows with N. This module
 * enforces an explicit per-capability budget rather than ever passing "all
 * facts for this run":
 *
 *  - Structured identity state (character fields) is always included and
 *    never truncated.
 *  - CanonFacts are recency-ranked and truncated to MAX_CANON_FACTS.
 *  - Only the last MAX_RECENT_SCENES materialized scenes are included
 *    verbatim; anything older is folded into a one-line summary rather than
 *    replayed (DOMAIN_MODEL.md §7's "older branch history is summarized").
 *
 * Budgets are named constants here, not scattered magic numbers, so a future
 * task can move them into real configuration (DOMAIN_MODEL.md §7: "the
 * budget is configuration, not a constant in code") without touching call
 * sites.
 */

import type {
  ActionType,
  ContentLanguage,
  ContextCanonFact,
  ContextCharacter,
  ContextScene,
  NarrativeContext,
} from "./types.ts";

export const CONTEXT_BUDGET = {
  maxRecentScenes: 3,
  maxCanonFacts: 12,
} as const;

export interface AssembleContextInput {
  contentLanguage: ContentLanguage;
  genre: string;
  storyMode: "narrative" | "adventure";
  premise: string;
  worldSetting: string | null;
  playerRole: string | null;
  tone: "light" | "balanced" | "dark" | null;
  narrativePov: "first_person" | "second_person" | "third_person" | null;
  characters: ContextCharacter[];
  /** All materialized scenes for the active branch, oldest first. */
  allScenesOldestFirst: ContextScene[];
  /** All canon facts already scoped to this run+branch (isolation already applied by the caller). */
  allCanonFacts: ContextCanonFact[];
  actionType: ActionType;
  playerAction: string | null;
  selectedChoiceLabel: string | null;
  repairReason: string | null;
}

function summarizeOlderScenes(older: ContextScene[], contentLanguage: ContentLanguage): string | null {
  if (older.length === 0) return null;
  const checkpointCount = older.filter((s) => s.boundaryKind === "checkpoint").length;
  const label = contentLanguage.startsWith("vi")
    ? `Trước đó, câu chuyện đã trải qua ${older.length} cảnh (${checkpointCount} điểm dừng), dẫn tới hiện tại.`
    : `Earlier, the story passed through ${older.length} scenes (${checkpointCount} checkpoints) leading to now.`;
  return label;
}

function rankCanonFacts(facts: ContextCanonFact[], budget: number): ContextCanonFact[] {
  // Recency-first ranking is deliberately the whole heuristic for M2 —
  // DOMAIN_MODEL.md §7 explicitly allows "recency plus character/scene
  // relevance" and says no embedding infrastructure is required for MVP.
  return [...facts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, budget);
}

export function assembleContext(input: AssembleContextInput): NarrativeContext {
  const recentScenes = input.allScenesOldestFirst.slice(-CONTEXT_BUDGET.maxRecentScenes);
  const olderScenes = input.allScenesOldestFirst.slice(
    0,
    Math.max(0, input.allScenesOldestFirst.length - CONTEXT_BUDGET.maxRecentScenes)
  );

  return {
    contentLanguage: input.contentLanguage,
    genre: input.genre,
    storyMode: input.storyMode,
    premise: input.premise,
    worldSetting: input.worldSetting,
    playerRole: input.playerRole,
    tone: input.tone,
    narrativePov: input.narrativePov,
    // Identity state is never truncated — the entire P4 consistency
    // guarantee depends on it surviving budget pressure intact.
    characters: input.characters,
    recentScenes,
    olderHistorySummary: summarizeOlderScenes(olderScenes, input.contentLanguage),
    canonFacts: rankCanonFacts(input.allCanonFacts, CONTEXT_BUDGET.maxCanonFacts),
    actionType: input.actionType,
    playerAction: input.playerAction,
    selectedChoiceLabel: input.selectedChoiceLabel,
    repairReason: input.repairReason,
  };
}
