import { describe, expect, it } from "vitest";

import { attachPromotionState, promotedKeySet } from "./chat-memory-promotion";

describe("chat memory promotion state (LW-W5-R1 P0-3)", () => {
  it("marks a candidate promoted when a matching canon_facts row exists", () => {
    const messages = [
      {
        id: "msg-1",
        role: "character",
        memory_candidates: [
          { fact_key: "likes_tea", fact_text: "Likes tea" },
          { fact_key: "fears_storms", fact_text: "Fears storms" },
        ],
      },
    ];
    const promotedFacts = [{ source_chat_message_id: "msg-1", source_chat_candidate_index: 0 }];

    const result = attachPromotionState(messages, promotedFacts);

    expect(result[0].memory_candidates[0].promoted).toBe(true);
    expect(result[0].memory_candidates[1].promoted).toBe(false);
  });

  it("leaves every candidate unpromoted when there are no matching canon_facts rows", () => {
    const messages = [
      { id: "msg-1", role: "character", memory_candidates: [{ fact_key: "likes_tea", fact_text: "Likes tea" }] },
    ];

    const result = attachPromotionState(messages, []);

    expect(result[0].memory_candidates[0].promoted).toBe(false);
  });

  it("does not cross-attribute promotion between different messages or candidate indexes", () => {
    const messages = [
      { id: "msg-1", role: "character", memory_candidates: [{ fact_key: "a" }, { fact_key: "b" }] },
      { id: "msg-2", role: "character", memory_candidates: [{ fact_key: "a" }] },
    ];
    // msg-1's candidate 1 is promoted, and msg-2's candidate 0 shares an index
    // with msg-1's candidate 0 (which is NOT promoted) — the key must be
    // scoped by message id, not just candidate index.
    const promotedFacts = [{ source_chat_message_id: "msg-1", source_chat_candidate_index: 1 }];

    const result = attachPromotionState(messages, promotedFacts);

    expect(result[0].memory_candidates[0].promoted).toBe(false);
    expect(result[0].memory_candidates[1].promoted).toBe(true);
    expect(result[1].memory_candidates[0].promoted).toBe(false);
  });

  it("ignores canon_facts rows with a null candidate index (story-scene-origin facts)", () => {
    const keys = promotedKeySet([{ source_chat_message_id: "msg-1", source_chat_candidate_index: null }]);
    expect(keys.size).toBe(0);
  });

  it("handles a player message with no memory_candidates without throwing", () => {
    const messages = [{ id: "msg-1", role: "player", memory_candidates: [] }];
    const result = attachPromotionState(messages, []);
    expect(result[0].memory_candidates).toEqual([]);
  });
});
