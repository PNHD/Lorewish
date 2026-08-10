/**
 * Provider adapter registry + selection (AI PROVIDER ARCHITECTURE in the
 * task brief). Adding a provider means adding one adapter class here — no
 * change to turn-pipeline.ts, quality-gate.ts, or context-assembler.ts,
 * which is the whole point of the NarrativeProvider interface.
 *
 * IMPORTANT — none of these real adapters has been exercised against a live
 * API in this task: no OpenAI/Anthropic/Gemini credential is configured in
 * this environment (checked via `env`, not printed — see
 * docs/NARRATIVE_MODEL_EVALUATION.md, NARRATIVE_PROVIDER_CREDENTIAL_REQUIRED).
 * The Anthropic adapter's request shape was verified against
 * https://platform.claude.com/docs/en/api/messages on 2026-08-10 (endpoint,
 * headers, tool-forced structured output via tool_choice, and the
 * claude-sonnet-5 constraint that non-default temperature/top_p/top_k return
 * a 400 error — so this adapter deliberately never sets them). It is
 * believed correct against current public docs, not proven against a real
 * response.
 */

import type { NarrativeContext, NarrativeProvider, ProviderCallResult } from "./types.ts";
import { ProviderTransportError } from "./types.ts";
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

function buildPrompt(context: NarrativeContext): { system: string; user: string } {
  const langName = context.contentLanguage.startsWith("vi") ? "Vietnamese" : "English";
  const system = [
    `You are the narrative engine for Lorewish, an interactive fiction app.`,
    `Write directly in natural, native ${langName} — never translate from another language, never produce literal machine-translation-style phrasing.`,
    `Avoid generic AI-narration cliches ("little did you know", "the air was thick with tension", "a sense of unease washed over you") unless the scene genuinely warrants them.`,
    `Never break character, never mention being an AI, never use meta-commentary.`,
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

  const user = [
    `Genre: ${context.genre}. Story mode: ${context.storyMode}. Content language: ${context.contentLanguage}.`,
    `Premise: ${context.premise}`,
    context.worldSetting ? `World/setting: ${context.worldSetting}` : "",
    context.playerRole ? `Player role: ${context.playerRole}` : "",
    context.tone ? `Tone: ${context.tone}` : "",
    context.olderHistorySummary ? `Earlier history: ${context.olderHistorySummary}` : "",
    historyLines ? `Recent scenes:\n${historyLines}` : "",
    canonLines ? `Known facts:\n${canonLines}` : "",
    context.actionType === "start"
      ? "Generate the opening scene for this story."
      : `Player action (${context.actionType}): ${context.selectedChoiceLabel ?? context.playerAction}`,
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

/** Not implemented in this task — same reasoning as OpenAiNarrativeProvider. */
export class GeminiNarrativeProvider implements NarrativeProvider {
  readonly id = "gemini";
  generateTurn(_context: NarrativeContext): Promise<ProviderCallResult> {
    throw new Error(
      "GeminiNarrativeProvider is not implemented — no GEMINI_API_KEY was available to build or verify this adapter. See docs/NARRATIVE_MODEL_EVALUATION.md."
    );
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
  if (configured === "gemini") return new GeminiNarrativeProvider();

  console.warn(
    "[lorewish] LOREWISH_NARRATIVE_PROVIDER is not set to a real provider — using FakeNarrativeProvider. " +
      "This is expected in this milestone (no AI provider credential configured). " +
      "See docs/NARRATIVE_MODEL_EVALUATION.md."
  );
  return new FakeNarrativeProvider();
}
