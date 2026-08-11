import { describe, expect, it, vi } from "vitest";
import {
  AlphaAccessForbiddenError,
  authorizeAlphaProvider,
  mapAlphaAccessError,
  type AlphaAccessGate,
} from "./alpha-access.ts";
import { FakeNarrativeProvider } from "./fake-provider.ts";

describe("server-enforced alpha generation access", () => {
  it("returns a clean 403 mapping for a denied account", () => {
    expect(mapAlphaAccessError(new AlphaAccessForbiddenError())).toEqual({
      status: 403,
      body: { error: "alpha_access_required" },
    });
  });

  it("does not construct or call a provider when the allowlist denies the user", async () => {
    const gate: AlphaAccessGate = {
      assertAllowed: vi.fn().mockRejectedValue(new AlphaAccessForbiddenError()),
    };
    const providerFactory = vi.fn(() => new FakeNarrativeProvider());

    await expect(authorizeAlphaProvider(gate, "test-jwt", providerFactory)).rejects.toBeInstanceOf(
      AlphaAccessForbiddenError
    );
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it("constructs the provider only after an enabled adult alpha account passes", async () => {
    const order: string[] = [];
    const gate: AlphaAccessGate = {
      assertAllowed: vi.fn(async () => {
        order.push("allowlist");
        return { userId: "user-1" };
      }),
    };
    const providerFactory = vi.fn(() => {
      order.push("provider");
      return new FakeNarrativeProvider();
    });

    await expect(authorizeAlphaProvider(gate, "test-jwt", providerFactory)).resolves.toBeInstanceOf(
      FakeNarrativeProvider
    );
    expect(order).toEqual(["allowlist", "provider"]);
  });
});
