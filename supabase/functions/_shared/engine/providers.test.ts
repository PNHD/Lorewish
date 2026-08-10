/**
 * Gemini adapter unit tests (LW-M2-R2). No live network call — global.fetch
 * is mocked throughout, matching this task's credential-safety rule (no
 * GEMINI_API_KEY exists in this environment; see
 * docs/NARRATIVE_MODEL_EVALUATION.md, GEMINI_API_KEY_REQUIRED). These tests
 * verify the adapter's own parsing/error-normalization contract, not real
 * narrative quality.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiNarrativeProvider } from "./providers.ts";
import { ProviderTransportError } from "./types.ts";
import type { NarrativeContext } from "./types.ts";

function baseContext(): NarrativeContext {
  return {
    contentLanguage: "en",
    genre: "fantasy",
    storyMode: "narrative",
    premise: "A test premise.",
    worldSetting: null,
    playerRole: null,
    tone: null,
    narrativePov: "second_person",
    characters: [],
    recentScenes: [],
    olderHistorySummary: null,
    canonFacts: [],
    actionType: "custom_action",
    playerAction: "push the door",
    selectedChoiceLabel: null,
    repairReason: null,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const VALID_RESULT = {
  narrative: "The door creaks open into a dim hallway.",
  dialogue: [],
  state_changes: [],
  canon_candidates: [],
  next_choices: [{ id: "a", label: "Step inside" }],
  boundary_kind: "none",
  structured_outcome: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiNarrativeProvider — construction", () => {
  it("fails fast on an unrecognized model id (no network call attempted)", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(() => new GeminiNarrativeProvider("fake-key", "gemini-not-a-real-model")).toThrow(/unrecognized model/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("GeminiNarrativeProvider — successful parse + accounting", () => {
  it("extracts the structured result, token usage, and computes cost from the documented pricing table", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESULT) }] } }],
        usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200 },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new GeminiNarrativeProvider("fake-key", "gemini-3.6-flash");
    const { result, metadata } = await provider.generateTurn(baseContext());

    expect(result).toEqual(VALID_RESULT);
    expect(metadata.provider).toBe("gemini");
    expect(metadata.model).toBe("gemini-3.6-flash");
    expect(metadata.inputTokens).toBe(1000);
    expect(metadata.outputTokens).toBe(200);
    // gemini-3.6-flash: $1.50/1M input, $7.50/1M output (docs/NARRATIVE_MODEL_EVALUATION.md).
    expect(metadata.costMicros).toBe(Math.round(1000 * 1.5 + 200 * 7.5));
    expect(metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("computes cost from the cheap-tier pricing when constructed with gemini-3.5-flash-lite", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESULT) }] } }],
        usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200 },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new GeminiNarrativeProvider("fake-key", "gemini-3.5-flash-lite");
    const { metadata } = await provider.generateTurn(baseContext());
    expect(metadata.costMicros).toBe(Math.round(1000 * 0.3 + 200 * 2.5));
  });

  it("sends the API key via the x-goog-api-key header, never in the URL query string", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESULT) }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new GeminiNarrativeProvider("super-secret-key", "gemini-3.6-flash");
    await provider.generateTurn(baseContext());

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("super-secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("super-secret-key");
  });
});

describe("GeminiNarrativeProvider — error normalization", () => {
  it("normalizes HTTP 500 as a transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("server exploded", { status: 500 })));
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toBeInstanceOf(ProviderTransportError);
  });

  it("normalizes HTTP 429 as a transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toBeInstanceOf(ProviderTransportError);
  });

  it("normalizes a network-level fetch failure as a transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")));
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(ProviderTransportError);
  });

  it("normalizes a request timeout (AbortError) as a transport error, not a silent hang", async () => {
    // Simulates the internal AbortController firing without waiting out the
    // real 30s bound — exercises the exact AbortError branch the adapter
    // checks, independent of real timing.
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(ProviderTransportError);
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/timed out/i);
  });

  it("a non-ok, non-transport status (e.g. 400) throws a normal Error carrying the provider's own body, never the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid request: bad schema", { status: 400 }))
    );
    const provider = new GeminiNarrativeProvider("super-secret-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/HTTP 400/);
    try {
      await provider.generateTurn(baseContext());
      throw new Error("expected generateTurn to throw");
    } catch (err) {
      expect((err as Error).message).not.toContain("super-secret-key");
    }
  });
});

describe("GeminiNarrativeProvider — malformed structured provider response", () => {
  it("throws a clean error when the response has no candidates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { candidates: [] })));
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/no usable candidate text/i);
  });

  it("throws a clean error when the candidate text is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: "not { valid json" }] } }] })
      )
    );
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/not valid JSON/i);
  });

  it("a malformed response is a normal Error, not a ProviderTransportError — it must not trigger the transport auto-retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { candidates: [] })));
    const provider = new GeminiNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.not.toBeInstanceOf(ProviderTransportError);
  });
});
