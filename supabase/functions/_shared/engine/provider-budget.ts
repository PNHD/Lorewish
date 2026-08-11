import {
  ProviderOutputError,
  type CharacterChatContext,
  type CharacterChatProvider,
  type NarrativeContext,
  type NarrativeProvider,
  type ProviderCallMetadata,
  type ProviderCallResult,
} from "./types.ts";

export type ProviderGenerationKind = "story" | "chat";

export class BetaCapacityReachedError extends Error {
  constructor(readonly resetAt: string) {
    super("BETA_CAPACITY_REACHED");
    this.name = "BetaCapacityReachedError";
  }
}

export type ProviderAttemptReservation =
  | { status: "reserved"; attemptId: string; remaining: number }
  | { status: "BETA_CAPACITY_REACHED"; resetAt: string };

export interface ProviderAttemptBudget {
  reserve(args: {
    userId: string;
    isAnonymous: boolean;
    generationKind: ProviderGenerationKind;
    provider: string;
    model: string;
  }): Promise<ProviderAttemptReservation>;
  complete(args: {
    attemptId: string;
    succeeded: boolean;
    metadata: ProviderCallMetadata | null;
  }): Promise<void>;
}

type BudgetedProviderArgs<T> = {
  userId: string;
  isAnonymous: boolean;
  provider: string;
  model: string;
  budget: ProviderAttemptBudget;
  providerFactory: () => T;
};

async function callWithBudget(
  args: BudgetedProviderArgs<unknown>,
  generationKind: ProviderGenerationKind,
  call: () => Promise<ProviderCallResult>,
): Promise<ProviderCallResult> {
  const reservation = await args.budget.reserve({
    userId: args.userId,
    isAnonymous: args.isAnonymous,
    generationKind,
    provider: args.provider,
    model: args.model,
  });
  if (reservation.status === "BETA_CAPACITY_REACHED") {
    throw new BetaCapacityReachedError(reservation.resetAt);
  }

  let result: ProviderCallResult;
  try {
    result = await call();
  } catch (error) {
    await args.budget.complete({
      attemptId: reservation.attemptId,
      succeeded: false,
      metadata: error instanceof ProviderOutputError ? error.metadata : null,
    });
    throw error;
  }
  await args.budget.complete({
    attemptId: reservation.attemptId,
    succeeded: true,
    metadata: result.metadata,
  });
  return result;
}

/**
 * The real adapter is lazy: global exhaustion returns before a provider
 * object is constructed, and every retry/repair reserves its own attempt.
 */
export class BudgetedNarrativeProvider implements NarrativeProvider {
  readonly id: string;
  private provider: NarrativeProvider | null = null;

  constructor(private readonly args: BudgetedProviderArgs<NarrativeProvider>) {
    this.id = args.provider;
  }

  generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    return callWithBudget(this.args, "story", () => {
      this.provider ??= this.args.providerFactory();
      return this.provider.generateTurn(context);
    });
  }
}

export class BudgetedCharacterChatProvider implements CharacterChatProvider {
  readonly id: string;
  private provider: CharacterChatProvider | null = null;

  constructor(private readonly args: BudgetedProviderArgs<CharacterChatProvider>) {
    this.id = args.provider;
  }

  generateChat(context: CharacterChatContext): Promise<ProviderCallResult> {
    return callWithBudget(this.args, "chat", () => {
      this.provider ??= this.args.providerFactory();
      return this.provider.generateChat(context);
    });
  }
}
