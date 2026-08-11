/**
 * Gemini + DeepSeek adapter unit tests (LW-M2-R2). No live network call in
 * this suite — global.fetch is mocked throughout, so this suite runs the
 * same in CI (no credentials) as it does locally with a real
 * GEMINI_API_KEY/DEEPSEEK_API_KEY loaded (docs/NARRATIVE_MODEL_EVALUATION.md).
 * These tests verify each adapter's own parsing/error-normalization
 * contract, not real narrative quality — real-quality evidence comes only
 * from the owner-initiated `npm run bakeoff` runs recorded in
 * handoff/LW-M2-R2/ and narrative-samples/.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepSeekNarrativeProvider, GeminiNarrativeProvider } from "./providers.ts";
import { ProviderOutputError, ProviderTransportError } from "./types.ts";
import type { NarrativeContext } from "./types.ts";

function baseContext(): NarrativeContext {
  return {
    contentLanguage: "en",
    genre: "fantasy",
    storyMode: "narrative",
    premise: "A test premise.",
    worldSetting: null,
    playerRole: null,
    playerName: null,
    playerDescription: null,
    tone: null,
    narrativePov: "second_person",
    characters: [],
    recentScenes: [],
    olderHistorySummary: null,
    characterMemories: [],
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

  it("LW-M2-R2: bills thoughtsTokenCount (thinking tokens) as output — found live, a trivial prompt returned 9 visible tokens but 104 thinking tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESULT) }] } }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 9, thoughtsTokenCount: 104, totalTokenCount: 116 },
        })
      )
    );
    const provider = new GeminiNarrativeProvider("fake-key", "gemini-3.6-flash");
    const { metadata } = await provider.generateTurn(baseContext());
    expect(metadata.outputTokens).toBe(9 + 104);
    expect(metadata.costMicros).toBe(Math.round(3 * 1.5 + (9 + 104) * 7.5));
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

function deepSeekResponse(status: number, content: string, usage: Record<string, number> = {}): Response {
  return jsonResponse(status, {
    id: "test",
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          tool_calls: [
            {
              id: "call_test",
              type: "function",
              function: { name: "emit_story_turn", arguments: content },
            },
          ],
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, ...usage },
  });
}

describe("DeepSeekNarrativeProvider — construction", () => {
  it("fails fast on an unrecognized model id (no network call attempted)", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(() => new DeepSeekNarrativeProvider("fake-key", "deepseek-not-a-real-model")).toThrow(/unrecognized model/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("DeepSeekNarrativeProvider — successful parse + accounting", () => {
  it("extracts the structured result and computes cost with no cache split reported (full prompt treated as cache-miss)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(deepSeekResponse(200, JSON.stringify(VALID_RESULT))));
    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-pro");
    const { result, metadata } = await provider.generateTurn(baseContext());

    expect(result).toEqual(VALID_RESULT);
    expect(metadata.provider).toBe("deepseek");
    expect(metadata.model).toBe("deepseek-v4-pro");
    expect(metadata.inputTokens).toBe(100);
    expect(metadata.outputTokens).toBe(50);
    // No cache split is reported, so all input is conservatively costed as cache miss.
    expect(metadata.costMicros).toBe(Math.round(100 * 0.435 + 50 * 0.87));
  });

  it("uses the discounted cache-hit rate for deepseek-v4-flash when the API reports a cache split", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        deepSeekResponse(200, JSON.stringify(VALID_RESULT), {
          prompt_tokens: 1000,
          prompt_cache_hit_tokens: 800,
          prompt_cache_miss_tokens: 200,
        })
      )
    );
    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-flash");
    const { metadata } = await provider.generateTurn(baseContext());
    // 800 cache-hit @ $0.0028/1M + 200 cache-miss @ $0.14/1M + 50 output @ $0.28/1M.
    expect(metadata.costMicros).toBe(Math.round(800 * 0.0028 + 200 * 0.14 + 50 * 0.28));
  });

  it("sends the API key via the Authorization: Bearer header, never in the request URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deepSeekResponse(200, JSON.stringify(VALID_RESULT)));
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new DeepSeekNarrativeProvider("super-secret-key");
    await provider.generateTurn(baseContext());

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("super-secret-key");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer super-secret-key");
  });

  it("instructs the target JSON shape in the prompt, since response_format=json_object does not enforce one", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deepSeekResponse(200, JSON.stringify(VALID_RESULT)));
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-flash", {
      structuredOutputMode: "json_object",
    });
    await provider.generateTurn(baseContext());

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(init.body as string);
    expect(requestBody.response_format).toEqual({ type: "json_object" });
    expect(requestBody.messages[0].content).toMatch(/narrative/);
    expect(requestBody.messages[0].content).toMatch(/boundary_kind/);
  });

  it("uses the official strict tool schema on DeepSeek's documented beta base URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deepSeekResponse(200, JSON.stringify(VALID_RESULT)));
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-flash", {
      structuredOutputMode: "strict_tool",
    });
    await provider.generateTurn(baseContext());

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(init.body as string);
    expect(url).toBe("https://api.deepseek.com/beta/chat/completions");
    expect(requestBody.response_format).toBeUndefined();
    expect(requestBody.tools[0].function.strict).toBe(true);
    expect(requestBody.tools[0].function.parameters.additionalProperties).toBe(false);
    expect(requestBody.tools[0].function.parameters.required).toContain("next_choices");
    expect(requestBody.tool_choice).toEqual({
      type: "function",
      function: { name: "emit_story_turn" },
    });
  });

  it("includes configured identity, relationship, and Vietnamese address terms in first-turn context", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deepSeekResponse(200, JSON.stringify(VALID_RESULT)));
    vi.stubGlobal("fetch", fetchSpy);
    const context = baseContext();
    context.contentLanguage = "vi";
    context.actionType = "start";
    context.characters = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Tướng Lâm Vũ",
        aliases: ["Tướng quân"],
        role: "tướng biên phòng",
        description: "vị tướng biên phòng",
        storyRelationship: "người chặn đoàn hộ tống",
        addressTerms: {
          speakerSelfReference: "tôi",
          speakerAddressesTargetAs: "tướng quân",
          targetSelfReference: "ta",
          targetAddressesSpeakerAs: "cậu",
        },
      },
    ];

    await new DeepSeekNarrativeProvider("fake-key").generateTurn(context);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(init.body as string);
    const prompt = requestBody.messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toContain("Tướng Lâm Vũ");
    expect(prompt).toContain("vị tướng biên phòng");
    expect(prompt).toContain("người chặn đoàn hộ tống");
    expect(prompt).toContain("speaker self=tôi");
    expect(prompt).toContain("character addresses speaker=cậu");
  });

  it("LW-M2-R2: disables thinking mode — found live, default thinking can consume the entire max_tokens budget on reasoning and return empty content", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(deepSeekResponse(200, JSON.stringify(VALID_RESULT)));
    vi.stubGlobal("fetch", fetchSpy);

    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-flash", {
      structuredOutputMode: "strict_tool",
    });
    await provider.generateTurn(baseContext());

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(init.body as string);
    expect(requestBody.thinking).toEqual({ type: "disabled" });
  });
});

describe("DeepSeekNarrativeProvider — error normalization", () => {
  it("normalizes HTTP 500 as a transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("server exploded", { status: 500 })));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toBeInstanceOf(ProviderTransportError);
  });

  it("normalizes HTTP 429 as a transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toBeInstanceOf(ProviderTransportError);
  });

  it("normalizes a network-level fetch failure as a transport error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(ProviderTransportError);
  });

  it("normalizes a request timeout (AbortError) as a transport error", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/timed out/i);
  });

  it("a non-ok, non-transport status throws a normal Error carrying the provider's own body, never the API key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid request", { status: 400 })));
    const provider = new DeepSeekNarrativeProvider("super-secret-key");
    try {
      await provider.generateTurn(baseContext());
      throw new Error("expected generateTurn to throw");
    } catch (err) {
      expect((err as Error).message).toMatch(/HTTP 400/);
      expect((err as Error).message).not.toContain("super-secret-key");
    }
  });
});

describe("DeepSeekNarrativeProvider — malformed structured provider response", () => {
  it("throws a clean error when the response has no choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { choices: [] })));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/no usable (message content|tool arguments)/i);
  });

  it("throws a clean error when the message content is not valid JSON (the exact failure mode DeepSeek's own docs warn about)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(deepSeekResponse(200, "not { valid json")));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.toThrow(/not valid JSON/i);
  });

  it("a malformed response is a normal Error, not a ProviderTransportError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { choices: [] })));
    const provider = new DeepSeekNarrativeProvider("fake-key");
    await expect(provider.generateTurn(baseContext())).rejects.not.toBeInstanceOf(ProviderTransportError);
  });

  it("accepts one harmless complete Markdown JSON fence without weakening semantic validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(deepSeekResponse(200, `\`\`\`json\n${JSON.stringify(VALID_RESULT)}\n\`\`\``))
    );
    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-flash", {
      structuredOutputMode: "json_object",
    });
    await expect(provider.generateTurn(baseContext())).resolves.toMatchObject({ result: VALID_RESULT });
  });

  it("classifies finish_reason=length invalid JSON as truncated and retains billed metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          choices: [
            {
              message: {
                tool_calls: [
                  { function: { name: "emit_story_turn", arguments: '{"narrative":"cut off"' } },
                ],
              },
              finish_reason: "length",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        })
      )
    );
    const provider = new DeepSeekNarrativeProvider("fake-key", "deepseek-v4-flash", {
      structuredOutputMode: "strict_tool",
    });
    try {
      await provider.generateTurn(baseContext());
      throw new Error("expected ProviderOutputError");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderOutputError);
      expect((err as ProviderOutputError).failureKind).toBe("truncated_json");
      expect((err as ProviderOutputError).metadata.inputTokens).toBe(100);
      expect((err as ProviderOutputError).metadata.outputTokens).toBe(50);
      expect((err as ProviderOutputError).metadata.costMicros).toBeGreaterThan(0);
    }
  });
});
