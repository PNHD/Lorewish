/**
 * Provider adapter registry + selection (AI PROVIDER ARCHITECTURE in the
 * task brief). Adding a provider means adding one adapter class here — no
 * change to turn-pipeline.ts, quality-gate.ts, or context-assembler.ts,
 * which is the whole point of the NarrativeProvider interface.
 *
 * IMPORTANT — credential status as of the LW-M2-R2 owner-initiated local
 * bakeoff: `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` were supplied by the owner
 * in a local, gitignored `.env.local`, loaded only via an explicit env-file
 * mechanism (`node --env-file=.env.local`) for the `npm run bakeoff` CLI —
 * never inherited by this process's ambient environment, never committed,
 * never logged, never present in CI, and never set as a Supabase Edge
 * Function secret (the deployed `submit-turn` function is untouched by this
 * bakeoff and still has no real provider configured). `OPENAI_API_KEY` and
 * `ANTHROPIC_API_KEY` remain absent everywhere. See
 * docs/NARRATIVE_MODEL_EVALUATION.md for the full credential/result record.
 * The Anthropic adapter's request shape was verified against
 * https://platform.claude.com/docs/en/api/messages on 2026-08-10 (endpoint,
 * headers, tool-forced structured output via tool_choice, and the
 * claude-sonnet-5 constraint that non-default temperature/top_p/top_k return
 * a 400 error — so this adapter deliberately never sets them). It is
 * believed correct against current public docs, not proven against a real
 * response.
 *
 * The Gemini adapter's request shape was verified against
 * https://ai.google.dev/api/generate-content and
 * https://ai.google.dev/gemini-api/docs/structured-output on 2026-08-10
 * (endpoint, `x-goog-api-key` header — the current documented alternative to
 * the legacy `?key=` query parameter, which would otherwise put the secret in
 * server access logs — and `generationConfig.responseSchema` for
 * schema-validated structured output). LOREWISH_NARRATIVE_MODEL selects
 * between the two model ids recorded in docs/NARRATIVE_MODEL_EVALUATION.md
 * (`gemini-3.6-flash` quality tier, `gemini-3.5-flash-lite` cheap tier);
 * an unrecognized model id fails fast at construction rather than silently
 * mis-costing generations against the wrong price table. Like the Anthropic
 * adapter, this is believed correct against current public docs, never
 * exercised against a real response — no GEMINI_API_KEY exists in this
 * environment.
 *
 * The DeepSeek adapter's request shape was verified against
 * https://api-docs.deepseek.com/api/create-chat-completion on 2026-08-10
 * (OpenAI-compatible `/chat/completions` endpoint, `Authorization: Bearer`
 * header, `response_format: {type: "json_object"}`). DeepSeek's JSON mode
 * does not enforce a response *shape* the way Gemini/Anthropic's schema-based
 * approaches do, so the target shape is additionally spelled out in the
 * prompt itself (DEEPSEEK_SCHEMA_INSTRUCTION) — an adaptation at the provider
 * boundary, not a change to the canonical StructuredGenerationResultSchema.
 * DEEPSEEK_API_KEY was supplied by the owner in a local, gitignored
 * `.env.local` for an owner-initiated bakeoff — never committed, never
 * logged, loaded only via an explicit env-file mechanism.
 */

import type { NarrativeContext, NarrativeProvider, ProviderCallMetadata, ProviderCallResult } from "./types.ts";
import { ProviderOutputError, ProviderTransportError } from "./types.ts";
import { FakeNarrativeProvider } from "./fake-provider.ts";

const RESULT_TOOL_SCHEMA = {
  type: "object",
  properties: {
    narrative: { type: "string" },
    dialogue: {
      type: "array",
      items: {
        type: "object",
        properties: { speaker: { type: "string" }, line: { type: "string" } },
        required: ["speaker", "line"],
      },
    },
    state_changes: { type: "array", items: { type: "string" } },
    canon_candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["run", "branch"] },
          fact_key: { type: "string" },
          fact_text: { type: "string" },
        },
        required: ["scope", "fact_key", "fact_text"],
      },
    },
    character_memory_candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          character_id: { type: "string" },
          memory_type: {
            type: "string",
            enum: ["player_fact", "character_fact", "relationship_fact", "shared_event", "promise", "discovery"],
          },
          fact_key: { type: "string" },
          fact_text: { type: "string" },
          salience: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["character_id", "memory_type", "fact_key", "fact_text", "salience"],
      },
    },
    next_choices: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, label: { type: "string" } },
        required: ["id", "label"],
      },
    },
    boundary_kind: { type: "string", enum: ["none", "checkpoint", "ending"] },
    structured_outcome: { type: "object" },
  },
  required: ["narrative", "boundary_kind"],
} as const;

/**
 * DeepSeek strict-tool schemas require every property of every object to be
 * required and `additionalProperties:false`. This provider-side schema is
 * deliberately stricter than transport JSON while remaining a subset of
 * StructuredGenerationResultSchema. Lorewish still re-validates with Zod.
 */
export const DEEPSEEK_STRICT_RESULT_SCHEMA = {
  type: "object",
  properties: {
    narrative: { type: "string" },
    dialogue: {
      type: "array",
      items: {
        type: "object",
        properties: { speaker: { type: "string" }, line: { type: "string" } },
        required: ["speaker", "line"],
        additionalProperties: false,
      },
    },
    state_changes: { type: "array", items: { type: "string" } },
    canon_candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["run", "branch"] },
          fact_key: {
            type: "string",
            pattern: "^[a-z][a-z0-9_]{1,79}$",
            description: "ASCII lowercase snake_case only, even when the story language is Vietnamese.",
          },
          fact_text: { type: "string" },
        },
        required: ["scope", "fact_key", "fact_text"],
        additionalProperties: false,
      },
    },
    character_memory_candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          character_id: { type: "string", format: "uuid" },
          memory_type: {
            type: "string",
            enum: ["player_fact", "character_fact", "relationship_fact", "shared_event", "promise", "discovery"],
          },
          fact_key: {
            type: "string",
            pattern: "^[a-z][a-z0-9_]{1,79}$",
            description: "Stable conflict key. Reuse the same key when a later fact supersedes an earlier state.",
          },
          fact_text: { type: "string" },
          salience: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["character_id", "memory_type", "fact_key", "fact_text", "salience"],
        additionalProperties: false,
      },
    },
    next_choices: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, label: { type: "string" } },
        required: ["id", "label"],
        additionalProperties: false,
      },
    },
    boundary_kind: { type: "string", enum: ["none", "checkpoint", "ending"] },
    structured_outcome: {
      anyOf: [
        {
          type: "object",
          properties: { rolled: { type: "boolean" } },
          required: ["rolled"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            rolled: { type: "boolean" },
            band: { type: "string", enum: ["success", "partial", "fail"] },
          },
          required: ["rolled", "band"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: [
    "narrative",
    "dialogue",
    "state_changes",
    "canon_candidates",
    "character_memory_candidates",
    "next_choices",
    "boundary_kind",
    "structured_outcome",
  ],
  additionalProperties: false,
} as const;

export function buildPrompt(context: NarrativeContext): { system: string; user: string } {
  const langName = context.contentLanguage.startsWith("vi") ? "Vietnamese" : "English";
  const system = [
    `You are the narrative engine for Lorewish, an interactive fiction app.`,
    `Write directly in natural, native ${langName} — never translate from another language, never produce literal machine-translation-style phrasing.`,
    `Avoid generic AI-narration cliches ("little did you know", "the air was thick with tension", "a sense of unease washed over you") unless the scene genuinely warrants them.`,
    `Never break character, never mention being an AI, never use meta-commentary.`,
    `Every canon_candidates fact_key must be ASCII lowercase snake_case matching ^[a-z][a-z0-9_]{1,79}$, even when writing Vietnamese. Never put diacritics, spaces, or punctuation in fact_key.`,
    `Character memory is canonical structured state, not a transcript. Emit character_memory_candidates only for durable, relevant facts. Copy character_id exactly from CHARACTER IDENTITY. Reuse fact_key when a relationship/state fact supersedes an earlier one. Never emit configured address terms as memory updates.`,
    `boundary_kind must be "ending" ONLY for a genuine, deliberate story conclusion — never because the scene is merely well-paced or you are unsure how to continue. Default to "none".`,
    `Prohibited copy in any language: "to be continued" or any equivalent phrase.`,
    context.repairReason
      ? `The previous attempt failed an automated quality check for: ${context.repairReason}. Correct that specific issue.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const historyLines = context.recentScenes
    .map((s) => `Scene ${s.seqInBranch}${s.boundaryKind !== "none" ? ` [${s.boundaryKind}]` : ""}: ${s.narrative}`)
    .join("\n\n");

  const canonLines = context.canonFacts.map((f) => `- (${f.scope}) ${f.factText}`).join("\n");

  const memoryLines = context.characterMemories
    .map((memory) => `- [${memory.memoryType}; salience=${memory.salience}] ${memory.characterName}: ${memory.factText}`)
    .join("\n");

  const characterLines = context.characters
    .map((character) => {
      const identity = [
        `${character.name} (character_id=${character.id})`,
        character.aliases.length ? `aliases: ${character.aliases.join(", ")}` : "",
        character.role ? `role: ${character.role}` : "",
        character.description ? `identity/role: ${character.description}` : "",
        character.storyRelationship ? `relationship: ${character.storyRelationship}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      if (!character.addressTerms) return `- ${identity}`;
      const terms = character.addressTerms;
      return (
        `- ${identity}; configured address terms: ` +
        `speaker self=${terms.speakerSelfReference}, speaker addresses character=${terms.speakerAddressesTargetAs}, ` +
        `character self=${terms.targetSelfReference}, character addresses speaker=${terms.targetAddressesSpeakerAs}`
      );
    })
    .join("\n");

  const user = [
    `STORY CONFIG\nGenre: ${context.genre}\nStory mode: ${context.storyMode}\nContent language: ${context.contentLanguage}\nPremise: ${context.premise}${context.worldSetting ? `\nWorld/setting: ${context.worldSetting}` : ""}${context.tone ? `\nTone: ${context.tone}` : ""}${context.narrativePov ? `\nNarrative POV: ${context.narrativePov}` : ""}`,
    `PLAYER IDENTITY\nRole: ${context.playerRole ?? "unspecified"}${context.playerName ? `\nName: ${context.playerName}` : ""}${context.playerDescription ? `\nDescription: ${context.playerDescription}` : ""}`,
    characterLines
      ? `CHARACTER IDENTITY\nPreserve these authored identities; never silently replace them with invented NPCs.\n${characterLines}`
      : "CHARACTER IDENTITY\nNo authored starting character.",
    context.characters.some((character) => character.addressTerms)
      ? `ADDRESS TERMS\nConfigured terms are immutable authoring data for this turn. Preserve speaker/target directionality.\n${context.characters
          .filter((character) => character.addressTerms)
          .map((character) => {
            const terms = character.addressTerms!;
            return `- ${character.name}: player self=${terms.speakerSelfReference}; player addresses character=${terms.speakerAddressesTargetAs}; character self=${terms.targetSelfReference}; character addresses player=${terms.targetAddressesSpeakerAs}`;
          })
          .join("\n")}`
      : "ADDRESS TERMS\nNo configured address terms.",
    `RECENT SCENES\n${context.olderHistorySummary ? `${context.olderHistorySummary}\n` : ""}${historyLines || "No prior scenes."}`,
    `RELEVANT CHARACTER MEMORY\n${memoryLines || "No relevant durable character memory yet."}`,
    `CANON FACTS\n${canonLines || "No additional canon facts yet."}`,
    context.actionType === "start"
      ? "PLAYER ACTION\nGenerate the opening scene for this story."
      : `PLAYER ACTION\nType: ${context.actionType}\nAction: ${context.selectedChoiceLabel ?? context.playerAction}`,
    "Return 2-4 meaningfully distinct next choices unless this is a true ending.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

export class AnthropicNarrativeProvider implements NarrativeProvider {
  readonly id = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = "claude-sonnet-5") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    const { system, user } = buildPrompt(context);
    const started = performance.now();

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2048,
          system,
          messages: [{ role: "user", content: user }],
          tools: [
            {
              name: "emit_story_turn",
              description: "Emit the structured result of this story turn.",
              input_schema: RESULT_TOOL_SCHEMA,
            },
          ],
          tool_choice: { type: "tool", name: "emit_story_turn" },
          // Deliberately no temperature/top_p/top_k: claude-sonnet-5 returns
          // a 400 error for any non-default sampling parameter.
        }),
      });
    } catch (err) {
      throw new ProviderTransportError(`anthropic fetch failed: ${(err as Error).message}`);
    }

    if (response.status >= 500 || response.status === 429) {
      throw new ProviderTransportError(`anthropic transport error: HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`anthropic API error: HTTP ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    const toolUse = (body.content ?? []).find((block: { type: string }) => block.type === "tool_use");
    if (!toolUse) {
      throw new Error("anthropic response contained no tool_use block");
    }

    const latencyMs = Math.round(performance.now() - started);
    const usage = body.usage ?? { input_tokens: 0, output_tokens: 0 };
    // Anthropic per-token pricing per docs/NARRATIVE_MODEL_EVALUATION.md's
    // owner-verified baseline (introductory, through 2026-08-31):
    // $2/1M input, $10/1M output. Configuration, not a standing architectural
    // fact — see TECHNICAL_ARCHITECTURE.md §10.
    const costMicros = Math.round(usage.input_tokens * 2 + usage.output_tokens * 10);

    return {
      result: toolUse.input,
      metadata: {
        provider: this.id,
        model: this.model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        costMicros,
        latencyMs,
      },
    };
  }
}

/**
 * Not implemented in this task — no credential to build or verify against.
 * Present so the provider registry demonstrates provider-agnosticism and so
 * a future task with an OpenAI key has a typed slot to fill in, per
 * docs/NARRATIVE_MODEL_EVALUATION.md.
 */
export class OpenAiNarrativeProvider implements NarrativeProvider {
  readonly id = "openai";
  generateTurn(_context: NarrativeContext): Promise<ProviderCallResult> {
    throw new Error(
      "OpenAiNarrativeProvider is not implemented — no OPENAI_API_KEY was available to build or verify this adapter. See docs/NARRATIVE_MODEL_EVALUATION.md."
    );
  }
}

/**
 * Pricing per 1M tokens — re-verified against https://api-docs.deepseek.com/quick_start/pricing
 * on 2026-08-11 (docs/NARRATIVE_MODEL_EVALUATION.md §8). `inputCacheHit` is DeepSeek's documented
 * cache-discounted rate for prompt tokens served from their prompt cache.
 */
const DEEPSEEK_PRICING_USD_PER_1M: Record<string, { inputCacheMiss: number; inputCacheHit: number; output: number }> = {
  "deepseek-v4-flash": { inputCacheMiss: 0.14, inputCacheHit: 0.0028, output: 0.28 },
  "deepseek-v4-pro": { inputCacheMiss: 0.435, inputCacheHit: 0.003625, output: 0.87 },
};

export type DeepSeekStructuredOutputMode = "json_object" | "strict_tool";

function parseProviderJson(
  content: string,
  finishReason: unknown,
  metadata: ProviderCallMetadata
): unknown {
  const trimmed = content.trim();
  // Serialization-only hardening: accept exactly one complete Markdown JSON
  // fence and nothing before/after it. Never search prose for a JSON-looking
  // substring or invent absent semantic fields.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const failureKind = finishReason === "length" ? "truncated_json" : "invalid_json";
    throw new ProviderOutputError(
      `deepseek response content was not valid JSON (${failureKind})`,
      failureKind,
      metadata
    );
  }
}

/**
 * DeepSeek's `response_format: {type: "json_object"}` guarantees syntactically valid JSON but,
 * unlike Gemini's `responseSchema` or Anthropic's tool-forced schema, does NOT enforce a specific
 * shape (https://api-docs.deepseek.com/api/create-chat-completion, verified 2026-08-10) — the docs
 * explicitly warn the caller must additionally instruct the desired shape via the prompt itself, or
 * generation can run to the token limit as whitespace. This is the provider-boundary adaptation the
 * task brief calls for ("If provider structured output behavior differs: adapt at the provider
 * boundary. Do NOT weaken the Lorewish canonical schema to fit one provider.") — the canonical
 * StructuredGenerationResultSchema is unchanged; this is an extra prompt instruction, appended only
 * for this adapter, describing that same shape in plain JSON-Schema-shaped text.
 */
const DEEPSEEK_SCHEMA_INSTRUCTION = `Respond with ONLY a single JSON object — no markdown code fences, no commentary before or after — matching exactly this shape:
{"narrative": string, "dialogue": [{"speaker": string, "line": string}], "state_changes": [string], "canon_candidates": [{"scope": "run"|"branch", "fact_key": string, "fact_text": string}], "character_memory_candidates": [{"character_id": uuid, "memory_type": "player_fact"|"character_fact"|"relationship_fact"|"shared_event"|"promise"|"discovery", "fact_key": string, "fact_text": string, "salience": 1|2|3|4|5}], "next_choices": [{"id": string, "label": string}], "boundary_kind": "none"|"checkpoint"|"ending", "structured_outcome": {}}
"narrative" and "boundary_kind" are required. Every other field must still be present — use an empty array/object when there is nothing to report, never omit the key.`;

/**
 * Real server-side adapter against DeepSeek's OpenAI-compatible chat completions endpoint
 * (https://api-docs.deepseek.com/api/create-chat-completion, verified 2026-08-10).
 * LOREWISH_NARRATIVE_MODEL selects between the two model ids recorded in
 * docs/NARRATIVE_MODEL_EVALUATION.md §8 (`deepseek-v4-pro` quality tier, `deepseek-v4-flash` cheap
 * tier); an unrecognized model id fails fast at construction, same as GeminiNarrativeProvider.
 */
export class DeepSeekNarrativeProvider implements NarrativeProvider {
  readonly id = "deepseek";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly structuredOutputMode: DeepSeekStructuredOutputMode;
  private readonly pricing: { inputCacheMiss: number; inputCacheHit: number; output: number };
  private readonly timeoutMs = 30_000;

  constructor(
    apiKey: string,
    model = "deepseek-v4-flash",
    options: { structuredOutputMode?: DeepSeekStructuredOutputMode } = {}
  ) {
    const pricing = DEEPSEEK_PRICING_USD_PER_1M[model];
    if (!pricing) {
      throw new Error(
        `DeepSeekNarrativeProvider: unrecognized model "${model}" — no pricing entry exists, so cost accounting would be silently wrong. ` +
          `Known models: ${Object.keys(DEEPSEEK_PRICING_USD_PER_1M).join(", ")}. See docs/NARRATIVE_MODEL_EVALUATION.md.`
      );
    }
    this.apiKey = apiKey;
    this.model = model;
    // DeepSeek's beta strict-tool mode was prototyped live in LW-M2-R3, but
    // still emitted malformed function arguments for both Flash and Pro.
    // Official JSON object mode was more stable for this workload; Lorewish's
    // Zod schema remains authoritative for shape and semantics.
    this.structuredOutputMode = options.structuredOutputMode ?? "json_object";
    this.pricing = pricing;
  }

  async generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    const { system, user } = buildPrompt(context);
    const started = performance.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      const strictTool = this.structuredOutputMode === "strict_tool";
      response = await fetch(
        strictTool
          ? "https://api.deepseek.com/beta/chat/completions"
          : "https://api.deepseek.com/chat/completions",
        {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: strictTool ? system : `${system}\n\n${DEEPSEEK_SCHEMA_INSTRUCTION}`,
            },
            { role: "user", content: user },
          ],
          max_tokens: 2048,
          ...(strictTool
            ? {
                tools: [
                  {
                    type: "function",
                    function: {
                      name: "emit_story_turn",
                      description: "Emit one Lorewish structured story turn.",
                      strict: true,
                      parameters: DEEPSEEK_STRICT_RESULT_SCHEMA,
                    },
                  },
                ],
                tool_choice: { type: "function", function: { name: "emit_story_turn" } },
              }
            : { response_format: { type: "json_object" } }),
          // LW-M2-R2 fix, found live: DeepSeek's V4 models default to a
          // "thinking" mode whose reasoning tokens are drawn from the same
          // max_tokens budget as the visible answer (confirmed via
          // usage.completion_tokens_details.reasoning_tokens). For some
          // prompts — Vietnamese narrative generation in particular —
          // reasoning alone consumed the entire 2048-token budget, leaving
          // ZERO tokens for the actual JSON content and producing an empty,
          // unparseable response on every such call. Narrative generation
          // has no use for chain-of-thought reasoning exposed to the
          // player (the Anthropic adapter similarly never opts into
          // extended thinking) — disabling it removes the failure mode
          // entirely and is materially cheaper (verified live: 957 total
          // tokens with thinking disabled vs. 2048 reasoning tokens and
          // zero usable output with it left at its default).
          thinking: { type: "disabled" },
        }),
      }
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new ProviderTransportError(
          `deepseek request timed out after ${this.timeoutMs}ms`,
          "timeout"
        );
      }
      throw new ProviderTransportError(
        `deepseek fetch failed: ${(err as Error).message}`,
        "provider_transport"
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 500 || response.status === 429) {
      throw new ProviderTransportError(
        `deepseek transport error: HTTP ${response.status}`,
        "provider_http"
      );
    }
    if (!response.ok) {
      // Provider error body only — never the key, which is never included in
      // any request/response body to begin with.
      throw new ProviderTransportError(
        `deepseek API error: HTTP ${response.status} ${await response.text()}`,
        "provider_http"
      );
    }

    const body = await response.json();
    const latencyMs = Math.round(performance.now() - started);
    const usage = body?.usage ?? {};
    const cacheHitTokens = usage.prompt_cache_hit_tokens ?? 0;
    // If the API does not report a cache split, treat the full prompt as a
    // cache miss — the conservative default, never assuming an unconfirmed
    // discount.
    const cacheMissTokens = usage.prompt_cache_miss_tokens ?? (usage.prompt_tokens ?? 0) - cacheHitTokens;
    const inputTokens = usage.prompt_tokens ?? cacheHitTokens + cacheMissTokens;
    const outputTokens = usage.completion_tokens ?? 0;
    const costMicros = Math.round(
      cacheHitTokens * this.pricing.inputCacheHit +
        cacheMissTokens * this.pricing.inputCacheMiss +
        outputTokens * this.pricing.output
    );
    const metadata: ProviderCallMetadata = {
      provider: this.id,
      model: this.model,
      inputTokens,
      outputTokens,
      cacheHitTokens,
      cacheMissTokens,
      costMicros,
      latencyMs,
    };

    const message = body?.choices?.[0]?.message;
    const finishReason = body?.choices?.[0]?.finish_reason;
    const content =
      this.structuredOutputMode === "strict_tool"
        ? message?.tool_calls?.find(
            (call: { function?: { name?: string } }) => call?.function?.name === "emit_story_turn"
          )?.function?.arguments
        : message?.content;
    if (typeof content !== "string") {
      throw new ProviderOutputError(
        `deepseek response contained no usable ${this.structuredOutputMode === "strict_tool" ? "tool arguments" : "message content"}`,
        "provider_response",
        metadata
      );
    }

    const parsedResult = parseProviderJson(content, finishReason, metadata);

    return {
      result: parsedResult,
      metadata,
    };
  }
}

/**
 * Pricing per 1M tokens, in whole US dollars (converted to per-token
 * micro-dollars below) — re-verified against https://ai.google.dev/gemini-api/docs/pricing
 * on 2026-08-10. Configuration, not a standing architectural fact (same
 * status as the Anthropic pricing comment below), and deliberately keyed by
 * exact API model id so an unrecognized id fails fast instead of silently
 * billing against the wrong tier.
 */
const GEMINI_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
};

const GEMINI_RESULT_SCHEMA = RESULT_TOOL_SCHEMA;

/**
 * Real server-side adapter against the Gemini API's generateContent endpoint
 * (https://ai.google.dev/api/generate-content, verified 2026-08-10).
 * Structured output is enforced by the provider itself via
 * generationConfig.responseSchema/responseMimeType — the same
 * StructuredGenerationResultSchema the fake and Anthropic providers produce
 * is still re-validated by turn-pipeline.ts after this returns, so a
 * schema-conformant-but-wrong-shaped Gemini response is caught the same way
 * a malformed Anthropic or fake response would be (never a provider-specific
 * bypass of the quality gate).
 *
 * NEVER exercised against a live network call in this task — no
 * GEMINI_API_KEY exists in this environment. See
 * docs/NARRATIVE_MODEL_EVALUATION.md, GEMINI_API_KEY_REQUIRED.
 */
export class GeminiNarrativeProvider implements NarrativeProvider {
  readonly id = "gemini";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly pricing: { input: number; output: number };
  /** Bounded generation timeout — no request is allowed to hang indefinitely. */
  private readonly timeoutMs = 30_000;

  constructor(apiKey: string, model = "gemini-3.6-flash") {
    const pricing = GEMINI_PRICING_USD_PER_1M[model];
    if (!pricing) {
      throw new Error(
        `GeminiNarrativeProvider: unrecognized model "${model}" — no pricing entry exists, so cost accounting would be silently wrong. ` +
          `Known models: ${Object.keys(GEMINI_PRICING_USD_PER_1M).join(", ")}. See docs/NARRATIVE_MODEL_EVALUATION.md.`
      );
    }
    this.apiKey = apiKey;
    this.model = model;
    this.pricing = pricing;
  }

  async generateTurn(context: NarrativeContext): Promise<ProviderCallResult> {
    const { system, user } = buildPrompt(context);
    const started = performance.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Header form, not `?key=` — the documented alternative that
            // keeps the secret out of URLs, server access logs, and any
            // intermediary tooling that logs request URLs but not headers.
            "x-goog-api-key": this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: GEMINI_RESULT_SCHEMA,
              maxOutputTokens: 2048,
            },
          }),
        }
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new ProviderTransportError(`gemini request timed out after ${this.timeoutMs}ms`);
      }
      throw new ProviderTransportError(`gemini fetch failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 500 || response.status === 429) {
      throw new ProviderTransportError(`gemini transport error: HTTP ${response.status}`);
    }
    if (!response.ok) {
      // Provider error body only — never the key, which is never included in
      // any request/response body to begin with.
      throw new Error(`gemini API error: HTTP ${response.status} ${await response.text()}`);
    }

    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("gemini response contained no usable candidate text");
    }

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(text);
    } catch {
      throw new Error("gemini response candidate text was not valid JSON");
    }

    const latencyMs = Math.round(performance.now() - started);
    const usage = body?.usageMetadata ?? {};
    const inputTokens = usage.promptTokenCount ?? 0;
    // Gemini's current model family bills "thinking" tokens
    // (usageMetadata.thoughtsTokenCount) at the same output rate as visible
    // candidate text (docs/NARRATIVE_MODEL_EVALUATION.md §7's pricing is
    // explicitly "per 1M output tokens, including thinking tokens") — found
    // live: a trivial prompt returned candidatesTokenCount=9 but
    // thoughtsTokenCount=104, over 10x the visible output, which
    // candidatesTokenCount alone would have silently left out of cost
    // accounting entirely.
    const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
    const costMicros = Math.round(inputTokens * this.pricing.input + outputTokens * this.pricing.output);

    return {
      result: parsedResult,
      metadata: {
        provider: this.id,
        model: this.model,
        inputTokens,
        outputTokens,
        costMicros,
        latencyMs,
      },
    };
  }
}

/**
 * Selects a provider from environment configuration. Falls back to the fake
 * deterministic provider — and logs loudly that it did — when no real
 * provider credential is configured, which is the actual state of this
 * environment for the whole of this task.
 */
export function selectProvider(env: { get(key: string): string | undefined }): NarrativeProvider {
  const configured = env.get("LOREWISH_NARRATIVE_PROVIDER");
  if (configured === "anthropic") {
    const key = env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("LOREWISH_NARRATIVE_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
    return new AnthropicNarrativeProvider(key, env.get("LOREWISH_NARRATIVE_MODEL") ?? "claude-sonnet-5");
  }
  if (configured === "openai") return new OpenAiNarrativeProvider();
  if (configured === "gemini") {
    const key = env.get("GEMINI_API_KEY") ?? env.get("GOOGLE_AI_API_KEY");
    if (!key) throw new Error("LOREWISH_NARRATIVE_PROVIDER=gemini but neither GEMINI_API_KEY nor GOOGLE_AI_API_KEY is set");
    return new GeminiNarrativeProvider(key, env.get("LOREWISH_NARRATIVE_MODEL") ?? "gemini-3.6-flash");
  }
  if (configured === "deepseek") {
    const key = env.get("DEEPSEEK_API_KEY");
    if (!key) throw new Error("LOREWISH_NARRATIVE_PROVIDER=deepseek but DEEPSEEK_API_KEY is not set");
    const mode = env.get("LOREWISH_DEEPSEEK_STRUCTURED_OUTPUT") ?? "json_object";
    if (mode !== "json_object" && mode !== "strict_tool") {
      throw new Error(`Unsupported LOREWISH_DEEPSEEK_STRUCTURED_OUTPUT mode: ${mode}`);
    }
    return new DeepSeekNarrativeProvider(
      key,
      env.get("LOREWISH_NARRATIVE_MODEL") ?? "deepseek-v4-flash",
      { structuredOutputMode: mode }
    );
  }

  console.warn(
    "[lorewish] LOREWISH_NARRATIVE_PROVIDER is not set to a real provider — using FakeNarrativeProvider. " +
      "This is expected in this milestone (no AI provider credential configured). " +
      "See docs/NARRATIVE_MODEL_EVALUATION.md."
  );
  return new FakeNarrativeProvider();
}
