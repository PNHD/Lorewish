import { describe, expect, it, vi } from "vitest";

import {
  BetaCapacityReachedError,
  BudgetedCharacterChatProvider,
  BudgetedNarrativeProvider,
  type ProviderAttemptBudget,
} from "./provider-budget.ts";
import { ProviderTransportError, type ProviderCallResult } from "./types.ts";

const metadata = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  inputTokens: 11,
  outputTokens: 7,
  costMicros: 3,
  latencyMs: 25,
};
const result: ProviderCallResult = { result: {}, metadata };

function budget(reservations: Array<"reserved" | "capacity">): ProviderAttemptBudget & {
  reserve: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  return {
    reserve: vi.fn(async () => reservations[index++] === "capacity"
      ? { status: "BETA_CAPACITY_REACHED" as const, resetAt: "2026-08-12T00:00:00Z" }
      : { status: "reserved" as const, attemptId: `attempt-${index}`, remaining: 249 - index }),
    complete: vi.fn(async () => undefined),
  };
}

describe("shared provider attempt budget", () => {
  it("denies before constructing or calling the Story provider", async () => {
    const shared = budget(["capacity"]);
    const factory = vi.fn(() => ({ id: "deepseek", generateTurn: vi.fn() }));
    const provider = new BudgetedNarrativeProvider({
      userId: "guest-a", isAnonymous: true, provider: "deepseek", model: "deepseek-v4-flash",
      budget: shared, providerFactory: factory,
    });
    await expect(provider.generateTurn({} as never)).rejects.toBeInstanceOf(BetaCapacityReachedError);
    expect(factory).not.toHaveBeenCalled();
    expect(shared.complete).not.toHaveBeenCalled();
  });

  it("reserves and completes every successful real Story attempt with server metadata", async () => {
    const shared = budget(["reserved", "reserved"]);
    const generateTurn = vi.fn().mockResolvedValue(result);
    const provider = new BudgetedNarrativeProvider({
      userId: "guest-a", isAnonymous: true, provider: "deepseek", model: "deepseek-v4-flash",
      budget: shared, providerFactory: () => ({ id: "deepseek", generateTurn }),
    });
    await provider.generateTurn({} as never);
    await provider.generateTurn({} as never);
    expect(shared.reserve).toHaveBeenCalledTimes(2);
    expect(generateTurn).toHaveBeenCalledTimes(2);
    expect(shared.complete).toHaveBeenNthCalledWith(1, {
      attemptId: "attempt-1", succeeded: true, metadata,
    });
  });

  it("keeps a failed provider attempt reserved and records failure", async () => {
    const shared = budget(["reserved"]);
    const provider = new BudgetedNarrativeProvider({
      userId: "guest-a", isAnonymous: true, provider: "deepseek", model: "deepseek-v4-flash",
      budget: shared,
      providerFactory: () => ({
        id: "deepseek",
        generateTurn: vi.fn().mockRejectedValue(new ProviderTransportError("timeout", "timeout")),
      }),
    });
    await expect(provider.generateTurn({} as never)).rejects.toBeInstanceOf(ProviderTransportError);
    expect(shared.complete).toHaveBeenCalledWith({
      attemptId: "attempt-1", succeeded: false, metadata: null,
    });
  });

  it("uses the same budget contract for Story and Character Chat", async () => {
    const shared = budget(["reserved", "capacity"]);
    const story = new BudgetedNarrativeProvider({
      userId: "guest-a", isAnonymous: true, provider: "deepseek", model: "deepseek-v4-flash",
      budget: shared, providerFactory: () => ({ id: "deepseek", generateTurn: vi.fn().mockResolvedValue(result) }),
    });
    const chatFactory = vi.fn(() => ({ id: "deepseek", generateChat: vi.fn().mockResolvedValue(result) }));
    const chat = new BudgetedCharacterChatProvider({
      userId: "guest-a", isAnonymous: true, provider: "deepseek", model: "deepseek-v4-flash",
      budget: shared, providerFactory: chatFactory,
    });
    await story.generateTurn({} as never);
    await expect(chat.generateChat({} as never)).rejects.toBeInstanceOf(BetaCapacityReachedError);
    expect(shared.reserve.mock.calls.map((call) => call[0].generationKind)).toEqual(["story", "chat"]);
    expect(chatFactory).not.toHaveBeenCalled();
  });
});
