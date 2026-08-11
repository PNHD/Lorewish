/**
 * Pure mapping from raw chat messages + canon_facts promotion rows to
 * messages whose memory_candidates carry a `promoted` flag — the missing
 * read that makes "Remember in story" show a stable state after reload
 * (LW-W5-R1 P0-3). Kept dependency-free (no `npm:` Supabase client import)
 * so it can run under vitest; supabase-chat-repository.ts is the Deno-only
 * caller that fetches the two inputs this function combines.
 */

export type ChatMessageLike = {
  id: string;
  role: string;
  memory_candidates: Record<string, unknown>[] | null;
  [key: string]: unknown;
};

export type PromotedFactRow = {
  source_chat_message_id: string | null;
  source_chat_candidate_index: number | null;
};

export function promotedKeySet(promotedFacts: PromotedFactRow[]): Set<string> {
  return new Set(
    promotedFacts
      .filter((fact) => fact.source_chat_message_id !== null && fact.source_chat_candidate_index !== null)
      .map((fact) => `${fact.source_chat_message_id}:${fact.source_chat_candidate_index}`),
  );
}

export function attachPromotionState<T extends ChatMessageLike>(
  messages: T[],
  promotedFacts: PromotedFactRow[],
): (T & { memory_candidates: (Record<string, unknown> & { promoted: boolean })[] })[] {
  const promoted = promotedKeySet(promotedFacts);
  return messages.map((message) => ({
    ...message,
    memory_candidates: (message.memory_candidates ?? []).map((candidate, index) => ({
      ...candidate,
      promoted: promoted.has(`${message.id}:${index}`),
    })),
  }));
}
